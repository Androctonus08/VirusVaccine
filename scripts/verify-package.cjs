'use strict';
// Packaged application smoke test. Uses a temporary Chromium profile so it
// cannot alter the operator's VirusVaccine profile; runs one harmless scan.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
async function main() {
  const root = path.resolve(__dirname, '..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'virusvaccine-package-'));
  let application;
  try {
    const file = path.join(temporary, 'ordinary-note.txt'); await fs.writeFile(file, 'A harmless note for the packaged VirusVaccine smoke test.');
    const executable = path.join(root, 'dist/win-unpacked/VirusVaccine.exe');
    const env = { ...process.env, VIRUSVACCINE_RUNTIME_DIR: path.join(root, '.runtime') }; delete env.ELECTRON_RUN_AS_NODE;
    application = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${path.join(temporary,'profile')}`], env, timeout: 30000 });
    const page = await application.firstWindow();
    const info = await application.evaluate(({ app }) => ({ packaged: app.isPackaged, data: app.getPath('userData'), version: app.getVersion(), name: app.getName() }));
    assert.equal(info.packaged, true); assert.equal(path.resolve(info.data), path.join(temporary,'profile'));
    const snapshot = () => page.evaluate(() => window.vaccine.invoke('state:get'));
    await expect.poll(async () => (await snapshot()).engine.ready, { timeout: 30000 }).toBe(true);
    if ((await snapshot()).notice?.type === 'error') throw new Error((await snapshot()).notice.message);
    await application.evaluate(({ dialog }, chosen) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] }); }, file);
    await page.getByRole('button', { name: 'Scan center', exact: true }).first().click();
    await page.getByRole('button', { name: 'Choose a file', exact: true }).click();
    await expect.poll(async () => (await snapshot()).scan.status, { timeout: 90000 }).toBe('completed');
    const state = await snapshot(); assert.equal(state.scan.scanned,1); assert.equal(state.scan.detections.length,0); assert.equal(state.scan.errors,0);
    const result = { passed: true, packaged: info.packaged, version: info.version, appName: info.name, scan: { status: state.scan.status, scanned: state.scan.scanned, detections: state.scan.detections.length, errors: state.scan.errors }, checkedAt: new Date().toISOString() };
    await fs.mkdir(path.join(root, 'review/private'), { recursive: true });
    await fs.writeFile(path.join(root, 'review/private/package-review.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally {
    if (application) await application.close();
    assert.ok(path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith('virusvaccine-package-'));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

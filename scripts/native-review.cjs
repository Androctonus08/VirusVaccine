'use strict';
// Real Electron and ClamAV checks using one harmless temporary document.
// Native selection and quick-scan paths are isolated in these test processes only.
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'review/private/native-ui');
  await fs.mkdir(output, { recursive: true });
  const dataDir = await fs.mkdtemp(path.join(root, 'review/private/native-data-'));
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'virusvaccine-ui-'));
  const file = path.join(fixture, 'ordinary-note.txt');
  await fs.writeFile(file, 'A harmless document used to check the VirusVaccine desktop interface.\n');
  const env = { ...process.env, VIRUSVACCINE_RUNTIME_DIR: path.join(root, '.runtime'), VIRUSVACCINE_DATA_DIR: dataDir };
  delete env.ELECTRON_RUN_AS_NODE;
  let application;
  try {
    application = await electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root], env, timeout: 30000 });
    let page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await expect(page.getByRole('heading', { name: 'Your security workspace' })).toBeVisible();
    const snapshot = () => page.evaluate(() => window.vaccine.invoke('state:get'));
    await expect.poll(async () => (await snapshot()).engine.ready, { timeout: 30000 }).toBe(true);
    await expect.poll(async () => (await snapshot()).system.message, { timeout: 30000 }).not.toBe('Checking Windows security status');
    const initial = await snapshot();
    if (initial.notice?.type === 'error') throw new Error(initial.notice.message);
    expect(await application.evaluate(({ app }) => app.getPath('userData'))).toBe(env.VIRUSVACCINE_DATA_DIR);
    await page.screenshot({ path: path.join(output, 'native-overview.png'), fullPage: true });
    for (const name of ['Scan center', 'Quarantine', 'Scan history', 'Automation', 'System security', 'About VirusVaccine']) {
      await page.getByRole('button', { name, exact: true }).first().click();
      await expect(page.locator('#page-name')).toHaveText(name);
    }
    await page.getByRole('button', { name: 'System security', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'native-system.png'), fullPage: true });
    await application.evaluate(({ dialog }, chosenFile) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenFile] }); }, file);
    await page.getByRole('button', { name: 'Scan center', exact: true }).first().click();
    await page.getByRole('button', { name: 'Choose a file', exact: true }).click();
    await expect.poll(async () => (await snapshot()).scan.status, { timeout: 90000 }).toMatch(/^(completed|partial|failed|cancelled)$/);
    const fileResult = await snapshot();
    expect(fileResult.scan.status, fileResult.scan.message).toBe('completed');
    expect(fileResult.scan.scanned).toBe(1);
    expect(fileResult.scan.detections.length).toBe(0);
    await expect.poll(async () => (await snapshot()).history[0]?.id, { timeout: 5000 }).toBe(fileResult.scan.id);
    await page.screenshot({ path: path.join(output, 'native-scan.png'), fullPage: true });
    await page.getByRole('button', { name: 'Scan history', exact: true }).click();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: path.join(output, 'native-history.png'), fullPage: true });

    const completedMode = async mode => {
      await expect.poll(async () => (await snapshot()).history.find(item => item.mode === mode)?.status, { timeout: 90000 }).toMatch(/^(completed|partial|failed|cancelled)$/);
      const scan = (await snapshot()).history.find(item => item.mode === mode);
      expect(scan.status, scan.message).toBe('completed');
      expect(scan.scanned).toBe(1);
      expect(scan.errors).toBe(0);
      expect(scan.skipped).toBe(0);
      expect(scan.detections.length).toBe(0);
      return scan;
    };
    await application.evaluate(({ dialog }, chosenFolder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenFolder] }); }, fixture);
    await page.getByRole('button', { name: 'Automation', exact: true }).click();
    await page.getByRole('button', { name: 'Add a folder' }).click();
    await expect(page.getByText(fixture, { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Enable folder watch' }).click();
    await expect.poll(async () => (await snapshot()).watch.enabled).toBe(true);
    await fs.appendFile(file, 'This ordinary text was changed to exercise opt-in folder monitoring.\n');
    const watchResult = await completedMode('watch');
    await page.getByRole('switch', { name: 'Enable folder watch' }).click();
    await expect.poll(async () => (await snapshot()).watch.enabled).toBe(false);
    console.log('Folder monitoring passed: changed harmless file scanned by the real engine.');

    // Only the fixture is reachable through the production quick-scan profile.
    await application.evaluate(({ app }, chosenFolder) => {
      for (const name of ['downloads', 'desktop', 'temp']) app.setPath(name, chosenFolder);
    }, fixture);
    const quickPaths = await application.evaluate(({ app }) => ['downloads', 'desktop', 'temp'].map(name => app.getPath(name)));
    expect(quickPaths).toEqual([fixture, fixture, fixture]);
    const hour = new Date().getHours();
    await page.getByLabel('Scan time').selectOption(String(hour));
    await expect.poll(async () => (await snapshot()).schedule.hour).toBe(hour);
    await page.getByRole('switch', { name: 'Enable daily quick scan' }).click();
    await expect.poll(async () => (await snapshot()).schedule.enabled).toBe(true);
    const scheduledResult = await completedMode('scheduled');
    await page.getByRole('switch', { name: 'Enable daily quick scan' }).click();
    await expect.poll(async () => (await snapshot()).schedule.enabled).toBe(false);
    const beforeRestart = await snapshot();
    expect(beforeRestart.schedule.lastRun).toBeTruthy();
    expect(beforeRestart.watch.folders).toEqual([fixture]);
    await page.screenshot({ path: path.join(output, 'native-automation.png'), fullPage: true });
    console.log('Daily scheduling passed: real quick scan restricted to the harmless fixture.');

    await application.close();
    application = await electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [root], env, timeout: 30000 });
    page = await application.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await expect.poll(async () => (await snapshot()).engine.ready, { timeout: 30000 }).toBe(true);
    const result = await snapshot();
    expect(result.watch.enabled).toBe(false);
    expect(result.watch.folders).toEqual([fixture]);
    expect(result.schedule).toEqual(beforeRestart.schedule);
    expect(result.history.map(item => item.id)).toEqual(beforeRestart.history.map(item => item.id));
    expect(result.scan.status).toBe('idle');
    await page.getByRole('button', { name: 'Automation', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Enable folder watch' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: 'Enable daily quick scan' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByLabel('Scan time')).toHaveValue(String(hour));
    await page.getByRole('button', { name: 'Scan history', exact: true }).click();
    await expect(page.getByText('Scheduled scan', { exact: true })).toBeVisible();
    await expect(page.getByText('Folder watch', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, 'native-history-restarted.png'), fullPage: true });
    expect(errors).toEqual([]);
    const sanitizeScan = scan => ({ mode: scan.mode, status: scan.status, scanned: scan.scanned, detections: scan.detections.length, skipped: scan.skipped, errors: scan.errors, elapsedMs: scan.elapsedMs });
    const publicReport = { status: 'passed', checkedAt: new Date().toISOString(), engineVersion: result.engine.version, officialDefinitionsUpdatedAt: result.engine.definitionsUpdatedAt, testScope: 'Real Windows Electron application and ClamAV engine; one harmless temporary document. Native picker and quick-scan paths are redirected only inside test processes.', scans: [sanitizeScan(fileResult.scan), sanitizeScan(watchResult), sanitizeScan(scheduledResult)], restartPersistence: { watchFolders: true, watchDisabled: true, scheduleHour: true, scheduleDisabled: true, scheduleLastRun: true, scanHistory: true }, windowsStatus: { antivirusRegistrations: initial.system.antivirus.length, firewallProfiles: initial.system.firewall.length }, rendererErrors: errors.length, limitations: 'These functional checks do not establish malware detection efficacy, performance parity, or real-time execution protection.' };
    await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(publicReport, null, 2) + '\n');
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ ...publicReport, history: result.history, watch: result.watch, schedule: result.schedule, systemMessage: initial.system.message, consoleErrors: errors }, null, 2));
    console.log('Native Electron review passed: all routes, Windows status, real file/watch/scheduled scans, settings and history preserved across restart.');
    console.log(`Windows status: ${initial.system.antivirus.length} antivirus registrations, ${initial.system.firewall.length} firewall profiles.`);
    console.log(`Private review artifacts: ${output}`);
  } finally {
    if (application) await application.close();
    await fs.unlink(file);
    await fs.rmdir(fixture);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

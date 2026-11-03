'use strict';
// Exercise the production Scanner and Quarantine with a real ClamAV process.
// The signature matches only a fresh random text marker created by this test.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { Engine } = require('../src/main/engine.cjs');
const { Scanner } = require('../src/main/scanner.cjs');
const { Quarantine } = require('../src/main/quarantine.cjs');
async function main() {
  const runtime = path.resolve(__dirname, '../.runtime');
  const engine = new Engine(runtime);
  const status = await engine.status(); assert.equal(status.ready, true, 'Run npm run verify:engine first');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virusvaccine-pipeline-'));
  try {
    const source = path.join(root, 'harmless-marker.txt');
    const marker = `VirusVaccine benign integration marker ${randomUUID()} ${randomBytes(32).toString('hex')}`;
    const bytes = Buffer.from(marker); await fs.writeFile(source, bytes);
    const database = path.join(root, 'database'); await fs.mkdir(database);
    await fs.writeFile(path.join(database, 'test.ndb'), `VirusVaccine.HarmlessIntegration:0:*:${bytes.toString('hex')}\n`);
    const adapter = { binaryPath: engine.binaryPath, databaseDir: database, status: async () => status };
    const scanner = new Scanner({ engine: adapter, workDir: path.join(root, 'work') });
    await scanner.start('file', [source]);
    assert.equal(scanner.state.status, 'completed', scanner.state.message);
    assert.equal(scanner.state.detections.length, 1);
    assert.match(scanner.state.detections[0].name, /HarmlessIntegration/);
    assert.equal(scanner.state.detections[0].sha256, createHash('sha256').update(bytes).digest('hex'));
    const quarantine = new Quarantine(path.join(root, 'vault'), randomBytes(32)); await quarantine.load();
    const saved = await quarantine.add(scanner.state.detections[0]); assert.equal(saved.sourceRemoved, true);
    await assert.rejects(fs.stat(source), { code: 'ENOENT' });
    const encrypted = await fs.readFile(path.join(root, 'vault', `${saved.id}.vvq`)); assert.equal(encrypted.includes(bytes), false);
    const restored = path.join(root, 'restored.txt'); await quarantine.restore(saved.id, restored);
    assert.deepEqual(await fs.readFile(restored), bytes); await quarantine.delete(saved.id);
    assert.equal(quarantine.items.length, 0);
    const report = { passed: true, engineVersion: status.version, realClamAV: true, productionScanner: true, harmlessCustomMarker: true, detectionFingerprint: true, encryptedQuarantine: true, restoreIntegrity: true, deleteCopy: true, malwareEfficacyTested: false, completedAt: new Date().toISOString() };
    await fs.writeFile(path.join(runtime, 'pipeline-verification.json'), JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally {
    assert.ok(path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('virusvaccine-pipeline-'));
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });

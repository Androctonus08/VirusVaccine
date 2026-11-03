'use strict';

// A real engine smoke test using ordinary text plus a locally-generated,
// harmless marker signature. No live malware, EICAR file, or AV exclusion.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Engine, RELEASE, run, inside, noLinks } = require('../src/main/engine.cjs');

async function main() {
  const runtime = path.resolve(__dirname, '..', '.runtime');
  let lastMessage = '', lastBucket = -1;
  const engine = new Engine(runtime, state => {
    const bucket = state.progress === null ? -1 : Math.floor(state.progress / 10);
    if (state.message !== lastMessage || bucket !== lastBucket) {
      lastMessage = state.message;
      lastBucket = bucket;
      // Never print local user paths or complete upstream logs to published reports.
      const stage = /Downloading official/.test(state.message) ? 'archive-download' : /Extracting/.test(state.message) ? 'extract' : /definitions|daily|main|bytecode|database/i.test(state.message) ? 'definitions' : state.busy ? 'setup' : 'ready-check';
      process.stdout.write(`${JSON.stringify({ event: 'engine-progress', stage, percent: state.progress })}\n`);
    }
  });
  let setupError = null;
  try { await engine.install(); } catch (error) { setupError = error; }
  const status = await engine.status();
  if (!status.installed) throw setupError || new Error('Engine installation did not complete.');
  const help = await run(engine.binaryPath, ['--help'], { timeout: 30000 });
  const work = await fs.mkdtemp(path.join(runtime, '.verification-'));
  const report = { engineVersion: RELEASE.version, pinnedArchiveSha256: RELEASE.sha256, installed: status.installed, officialDefinitionsReady: status.ready, officialDefinitionsCheckedAt: status.definitionsUpdatedAt, realTimeProtectionTested: false, malwareEfficacyTested: false, results: {} };
  try {
    const unicodeName = 'ordinary text r\u00e9sum\u00e9-\u062a\u062d\u0642\u0642-\u5b89\u5168.txt';
    const benign = path.join(work, unicodeName);
    const markerFile = path.join(work, 'harmless-marker.txt');
    const signature = path.join(work, 'local-test.ndb');
    const marker = `VirusVaccine harmless verification marker ${crypto.randomUUID()} ${crypto.randomBytes(32).toString('hex')}`;
    await fs.writeFile(benign, 'A normal document for checking the scanner. This contains no malware.\n');
    await fs.writeFile(markerFile, marker);
    await fs.writeFile(signature, `VirusVaccine.HarmlessPipelineTest:0:*:${Buffer.from(marker).toString('hex')}\n`);
    const shared = ['--stdout', '--allmatch=yes', '--follow-dir-symlinks=0', '--follow-file-symlinks=0', '--max-filesize=128M', '--max-scansize=512M', '--max-recursion=16', '--max-files=10000', '--alert-exceeds-max=yes', '--alert-encrypted=yes'];
    const clean = await run(engine.binaryPath, [`--database=${signature}`, ...shared, benign], { timeout: 60000 });
    const detected = await run(engine.binaryPath, [`--database=${signature}`, ...shared, markerFile], { timeout: 60000 });
    const failed = await run(engine.binaryPath, [`--database=${path.join(work, 'does-not-exist.ndb')}`, ...shared, benign], { timeout: 60000 });
    const fileList = path.join(work, 'scan-files.txt');
    await fs.writeFile(fileList, `${benign}\n`);
    const fromList = await run(engine.binaryPath, [`--database=${signature}`, ...shared, `--file-list=${fileList}`], { timeout: 60000 });
    report.results.customDatabaseBenign = clean.code === 0 && /Infected files:\s+0/.test(clean.output);
    report.results.harmlessMarkerDetected = detected.code === 1 && /VirusVaccine\.HarmlessPipelineTest.*FOUND/.test(detected.output);
    report.results.missingDatabaseFails = failed.code === 2;
    report.results.utf8FileListAndOutput = fromList.code === 0 && fromList.output.includes(`${unicodeName}: OK`);
    report.results.supportedFlags = ['--recursive', '--follow-dir-symlinks', '--follow-file-symlinks', '--stdout', '--infected', '--max-filesize', '--max-scansize'].every(flag => help.output.includes(flag));
    report.results.exitCodes = { benign: clean.code, harmlessMarker: detected.code, unavailableDatabase: failed.code };
    if (status.ready) {
      const official = await run(engine.binaryPath, [`--database=${engine.databaseDir}`, ...shared, benign], { timeout: 10 * 60 * 1000 });
      report.results.officialDatabaseBenign = official.code === 0 && /Infected files:\s+0/.test(official.output);
      const knownViruses = official.output.match(/Known viruses:\s+(\d+)/);
      report.officialSignatureCount = knownViruses ? Number(knownViruses[1]) : null;
    } else report.results.officialDatabaseBenign = 'not-run: official definitions unavailable';
    if (setupError) report.definitionUpdateError = setupError.message.replaceAll(runtime, '[runtime]').slice(0, 1600);
    report.completedAt = new Date().toISOString();
    report.passed = report.results.customDatabaseBenign && report.results.harmlessMarkerDetected && report.results.missingDatabaseFails && report.results.utf8FileListAndOutput && report.results.supportedFlags && report.results.officialDatabaseBenign === true;
    await fs.writeFile(path.join(runtime, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ event: 'engine-verification', ...report })}\n`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    if (inside(runtime, work)) { await noLinks(work); await fs.rm(work, { recursive: true, force: true }); }
  }
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ event: 'engine-verification-error', message: error.message.replaceAll(path.resolve(__dirname, '..'), '[project]').slice(0, 1600) })}\n`);
  process.exitCode = 1;
});

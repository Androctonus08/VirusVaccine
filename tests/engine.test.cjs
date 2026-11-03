'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const { EventEmitter } = require('node:events');
const { Engine, RELEASE, definitionFiles, noLinks, inside, downloadVerified, run } = require('../src/main/engine.cjs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virusvaccine-engine-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('missing engine and definitions never report ready', async t => {
  const root = await fixture(t);
  const engine = new Engine(path.join(root, 'not-yet-created'));
  const status = await engine.status();
  assert.equal(status.installed, false);
  assert.equal(status.ready, false);
  assert.equal(status.definitionsUpdatedAt, null);
});

test('setup refuses to overwrite unrelated directories', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'keep.txt'), 'existing user data');
  const engine = new Engine(root);
  await assert.rejects(engine.update(), /does not belong to VirusVaccine/);
  assert.equal(await fs.readFile(path.join(root, 'keep.txt'), 'utf8'), 'existing user data');
  assert.equal((await engine.status()).ready, false);
});

test('runtime path cannot follow a directory junction', async t => {
  const root = await fixture(t);
  const target = path.join(root, 'target');
  const link = path.join(root, 'redirect');
  await fs.mkdir(target);
  await fs.symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(noLinks(link), /without junctions or symbolic links/);
  await assert.rejects(new Engine(link).update(), /without junctions or symbolic links/);
});

test('concurrent operations are rejected before invoking an updater', async t => {
  const root = await fixture(t);
  const engine = new Engine(root);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = engine._exclusive('update', () => gate);
  await assert.rejects(engine.update(), /already running/);
  release();
  await first;
  assert.equal((await engine.status()).busy, false);
});

test('database readiness requires complete official headers and a recent validation receipt', async t => {
  const root = await fixture(t);
  const engine = new Engine(root);
  await engine._owned(true);
  await fs.mkdir(engine.installDir);
  await fs.mkdir(engine.databaseDir);
  await fs.writeFile(engine.binaryPath, 'fixture binary, never executed');
  await fs.writeFile(path.join(engine.installDir, 'freshclam.exe'), 'fixture updater, never executed');
  await fs.writeFile(path.join(root, 'installed.json'), JSON.stringify({ version: RELEASE.version, archiveSha256: RELEASE.sha256 }));
  for (const name of ['main', 'daily', 'bytecode']) {
    const header = `ClamAV-VDB:01 Jan 2000 00-00 +0000:1234:5000:90:placeholder:signature:builder:1`;
    await fs.writeFile(path.join(engine.databaseDir, `${name}.cvd`), header.padEnd(512, ' ') + 'fixture, not an actual signed database');
  }
  assert.equal((await engine.status()).ready, false, 'file presence alone is not enough');
  const databases = await definitionFiles(engine.databaseDir);
  await fs.writeFile(path.join(root, 'definitions.json'), JSON.stringify({ checkedAt: new Date().toISOString(), databases }));
  assert.equal((await engine.status()).ready, true);
  await fs.appendFile(path.join(engine.databaseDir, 'daily.cvd'), 'changed');
  assert.equal((await engine.status()).ready, false, 'unexpected database changes invalidate the receipt');
  await fs.writeFile(path.join(root, 'definitions.json'), JSON.stringify({ checkedAt: new Date(Date.now() - 8 * 86400000).toISOString(), databases: await definitionFiles(engine.databaseDir) }));
  assert.equal((await engine.status()).ready, false, 'old validation receipts require an update');
});

test('root directory and paths containing newlines are rejected', () => {
  assert.throws(() => new Engine(path.parse(process.cwd()).root), /drive root/);
  assert.throws(() => new Engine('bad\npath'), /Invalid engine/);
  assert.equal(inside('C:\\runtime', 'C:\\runtime-other'), false);
});

test('archive download enforces trusted HTTPS hosts, exact length and pinned digest', async t => {
  const root = await fixture(t);
  const payload = Buffer.from('A harmless archive stand-in for streaming verification only.');
  const release = { bytes: payload.length, sha256: crypto.createHash('sha256').update(payload).digest('hex') };
  t.mock.method(https, 'get', (url, options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    process.nextTick(() => {
      const response = new PassThrough();
      response.statusCode = 200;
      response.headers = { 'content-length': String(payload.length) };
      callback(response);
      response.end(payload);
    });
    return request;
  });
  const url = 'https://github.com/Cisco-Talos/clamav/test';
  const archive = path.join(root, 'verified.zip');
  await downloadVerified(url, archive, release);
  assert.deepEqual(await fs.readFile(archive), payload);
  await assert.rejects(downloadVerified(url, path.join(root, 'wrong-hash.zip'), { ...release, sha256: '0'.repeat(64) }), /SHA-256/);
  await assert.rejects(downloadVerified(url, path.join(root, 'wrong-size.zip'), { ...release, bytes: 1 }), /size does not match/);
  await assert.rejects(downloadVerified('http://github.com/test', path.join(root, 'http.zip'), release), /untrusted/);
  await assert.rejects(downloadVerified('https://untrusted.example/test', path.join(root, 'foreign.zip'), release), /untrusted/);
  await assert.rejects(downloadVerified(url, archive, release), /EEXIST/);
  assert.deepEqual(await fs.readFile(archive), payload, 'pre-existing files remain unchanged');
});

test('cancellation kills an owned child before releasing the operation lock', { timeout: 20000 }, async t => {
  const root = await fixture(t);
  const engine = new Engine(root);
  let started;
  const childStarted = new Promise(resolve => { started = resolve; });
  const first = engine._exclusive('update', () => run(process.execPath, ['-e', 'console.log("ready"); setInterval(() => {}, 1000)'], { signal: engine._controller.signal, onLine: line => { if (line === 'ready') started(); }, timeout: 15000 }));
  // Observe failure immediately: spawn/setup errors must fail the test rather
  // than leave it waiting forever for a child that never printed its handshake.
  const earlyExit = first.then(() => { throw new Error('The owned child exited before cancellation was requested.'); });
  let startupTimer;
  const startupTimeout = new Promise((resolve, reject) => {
    startupTimer = setTimeout(() => reject(new Error('The owned child did not report readiness within 10 seconds.')), 10000);
  });
  try {
    await Promise.race([childStarted, earlyExit, startupTimeout]);
    clearTimeout(startupTimer);
    const rejected = assert.rejects(first, /cancelled/);
    assert.equal(engine.cancel(), true);
    await assert.rejects(engine.update(), /already running/);
    await rejected;
    assert.equal((await engine.status()).busy, false);
    assert.equal((await engine.status()).ready, false);
    assert.equal(engine.cancel(), false);
    await engine._exclusive('update', async () => {});
    assert.equal((await engine.status()).busy, false);
  } finally {
    clearTimeout(startupTimer);
    engine.cancel();
    await first.catch(() => {});
  }
});

test('aborted downloads stop before opening a connection or writing files', async t => {
  const root = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(downloadVerified(RELEASE.url, path.join(root, 'never.zip'), RELEASE, () => {}, controller.signal), /cancelled/);
  await assert.rejects(fs.stat(path.join(root, 'never.zip')), { code: 'ENOENT' });
});

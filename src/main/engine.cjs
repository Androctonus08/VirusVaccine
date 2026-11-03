'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');

// Pinned to the Windows x64 portable archive published by Cisco Talos.
// Updating the version requires reviewing the upstream release and its SHA-256.
const RELEASE = Object.freeze({
  version: '1.5.4',
  url: 'https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.win.x64.zip',
  bytes: 225774978,
  sha256: '0d9e0228b2674137ea1a2853566c98a0278ad52ab2582c3d6dbd75373848c395',
});
const OWNER = 'VirusVaccine isolated ClamAV runtime v1';
const MAX_DATABASE_AGE = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

async function noLinks(target, create = false) {
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = await fsp.lstat(current); } catch (error) {
      if (error.code !== 'ENOENT' || !create) throw error;
      await fsp.mkdir(current);
      stat = await fsp.lstat(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Runtime path must contain only regular directories, without junctions or symbolic links.');
  }
  return absolute;
}

function inside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function regularFile(filename) {
  try {
    const stat = await fsp.lstat(filename);
    return stat.isFile() && !stat.isSymbolicLink() ? stat : null;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function jsonFile(filename) {
  if (!(await regularFile(filename))) return null;
  try { return JSON.parse(await fsp.readFile(filename, 'utf8')); } catch { return null; }
}

async function saveJson(filename, value) {
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await fsp.rename(temporary, filename);
}

function outputError(output, fallback) {
  const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const useful = lines.filter(line => /error|warning|blocked|cool.down|forbidden|failed/i.test(line));
  return (useful.slice(-5).join(' ') || lines.slice(-3).join(' ') || fallback).slice(0, 1600);
}

function readyMessage(state) {
  return !state.installed ? 'Set up the independent ClamAV engine to scan files.' : !state.definitionsUpdatedAt ? 'Engine installed. Download verified threat definitions to start scanning.' : !state.ready ? 'Threat definitions need an update before scanning.' : 'ClamAV is ready for on-demand scanning. Real-time protection is not provided.';
}

function cancelled(signal) {
  if (signal?.aborted) throw new Error('Engine operation cancelled.');
}

function run(binary, args, { timeout = 15 * 60 * 1000, onLine = () => {}, env = process.env, cwd, signal } = {}) {
  return new Promise((resolve, reject) => {
    cancelled(signal);
    const child = spawn(binary, args, { shell: false, windowsHide: true, env, cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    const abort = () => child.kill();
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const append = chunk => {
      const text = chunk.toString('utf8');
      output = (output + text).slice(-65536);
      for (const line of text.split(/\r?\n/)) if (line.trim()) onLine(line.trim().slice(0, 500));
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', (code, exitSignal) => {
      cleanup();
      if (signal?.aborted) reject(new Error('Engine operation cancelled.'));
      else if (timedOut) reject(new Error('The engine operation timed out. Try again when your connection is stable.'));
      else resolve({ code, signal: exitSignal, output });
    });
  });
}

async function downloadVerified(url, destination, release = RELEASE, progress = () => {}, signal) {
  const hash = crypto.createHash('sha256');
  let received = 0;
  async function responseFor(address, redirects = 0) {
    cancelled(signal);
    const parsed = new URL(address);
    if (parsed.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname) || parsed.username || parsed.password) throw new Error('Refusing an untrusted engine download URL.');
    if (redirects > 5) throw new Error('Too many engine download redirects.');
    const response = await new Promise((resolve, reject) => {
      const req = https.get(parsed, { headers: { 'User-Agent': 'VirusVaccine/0.1', Accept: 'application/octet-stream' } }, resolve);
      const abort = () => req.destroy(new Error('Engine operation cancelled.'));
      signal?.addEventListener('abort', abort, { once: true });
      req.once('close', () => signal?.removeEventListener('abort', abort));
      req.setTimeout(45000, () => req.destroy(new Error('Engine download connection timed out.')));
      req.on('error', reject);
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      response.resume();
      return responseFor(new URL(response.headers.location, parsed).href, redirects + 1);
    }
    if (response.statusCode !== 200) { response.resume(); throw new Error(`Engine download failed (HTTP ${response.statusCode}).`); }
    const contentLength = response.headers['content-length'];
    if (contentLength && Number(contentLength) !== release.bytes) { response.destroy(); throw new Error('Engine archive size does not match the pinned release.'); }
    return response;
  }
  const response = await responseFor(url);
  const timer = setTimeout(() => response.destroy(new Error('Engine download timed out.')), 30 * 60 * 1000);
  const meter = new Transform({ transform(chunk, encoding, callback) {
    received += chunk.length;
    if (received > release.bytes) return callback(new Error('Engine archive exceeds its expected size.'));
    hash.update(chunk);
    progress(Math.floor(received / release.bytes * 100));
    callback(null, chunk);
  } });
  try {
    await pipeline(response, meter, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal });
    if (received !== release.bytes || hash.digest('hex') !== release.sha256) throw new Error('Engine archive failed SHA-256 verification. It was not installed.');
  } finally { clearTimeout(timer); }
}

const EXTRACT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($env:VV_ARCHIVE)
try {
  [long]$total = 0
  if ($archive.Entries.Count -gt 10000) { throw 'Too many archive entries' }
  foreach ($entry in $archive.Entries) {
    $entryPath = $entry.FullName.Replace('/', '\')
    if ([System.IO.Path]::IsPathRooted($entryPath) -or $entryPath.Contains(':') -or (($entryPath -split '\\') -contains '..')) { throw 'Unsafe archive path' }
    if ((($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Archive symbolic links are not allowed' }
    $total += $entry.Length
    if ($entry.Length -gt 400MB -or $total -gt 2GB) { throw 'Archive expansion exceeds limit' }
  }
} finally { $archive.Dispose() }
Expand-Archive -LiteralPath $env:VV_ARCHIVE -DestinationPath $env:VV_EXTRACT -ErrorAction Stop
`;

async function inspectTree(directory) {
  for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Engine directory contains a symbolic link.');
    if (entry.isDirectory()) await inspectTree(target);
    else if (!entry.isFile()) throw new Error('Engine directory contains a non-regular file.');
  }
}

async function definitionFiles(databaseDir) {
  const result = {};
  for (const name of ['main', 'daily', 'bytecode']) {
    let found = false;
    for (const extension of ['cld', 'cvd']) {
      const filename = path.join(databaseDir, `${name}.${extension}`);
      const stat = await regularFile(filename);
      if (!stat || stat.size < 512) continue;
      const file = await fsp.open(filename, 'r');
      try {
        const bytes = Buffer.alloc(512);
        await file.read(bytes, 0, bytes.length, 0);
        if (bytes.toString('ascii', 0, 11) !== 'ClamAV-VDB:') continue;
        const fields = bytes.toString('ascii').split(':');
        if (!/^\d+$/.test(fields[2] || '')) continue;
        result[name] = { version: Number(fields[2]), bytes: stat.size };
        found = true;
        break;
      } finally { await file.close(); }
    }
    if (!found) return null;
  }
  return result;
}

class Engine {
  constructor(runtimeDir, onChange = () => {}) {
    if (typeof runtimeDir !== 'string' || /[\r\n\0]/.test(runtimeDir)) throw new Error('Invalid engine directory.');
    this.runtimeDir = path.resolve(runtimeDir);
    if (this.runtimeDir === path.parse(this.runtimeDir).root) throw new Error('The drive root cannot be used as an engine directory.');
    this.installDir = path.join(this.runtimeDir, `clamav-${RELEASE.version}`);
    this.databaseDir = path.join(this.runtimeDir, 'database');
    this.binaryPath = path.join(this.installDir, 'clamscan.exe');
    this.onChange = onChange;
    this.state = { installed: false, version: null, ready: false, definitionsUpdatedAt: null, busy: false, message: 'Set up the independent ClamAV engine to scan files.', progress: null };
  }

  _change(patch) {
    Object.assign(this.state, patch);
    try { this.onChange({ ...this.state }); } catch { /* Observers must not break an engine operation. */ }
  }

  async _owned(create = false) {
    try { await noLinks(this.runtimeDir, create); } catch (error) { if (!create && error.code === 'ENOENT') return false; throw error; }
    const marker = path.join(this.runtimeDir, 'virusvaccine-runtime.json');
    const owner = await jsonFile(marker);
    if (owner?.owner === OWNER) return true;
    if (!create && !owner) return false;
    const entries = await fsp.readdir(this.runtimeDir);
    if (entries.length !== 0) throw new Error('Refusing to use an existing directory that does not belong to VirusVaccine.');
    await fsp.writeFile(marker, JSON.stringify({ owner: OWNER }), { flag: 'wx', mode: 0o600 });
    return true;
  }

  async status() {
    if (!(await this._owned())) {
      Object.assign(this.state, { installed: false, version: null, ready: false, definitionsUpdatedAt: null });
      return { ...this.state };
    }
    const manifest = await jsonFile(path.join(this.runtimeDir, 'installed.json'));
    let installed = false, definitions = null;
    if (manifest?.version === RELEASE.version && manifest?.archiveSha256 === RELEASE.sha256) {
      try {
        await noLinks(this.installDir);
        installed = !!(await regularFile(this.binaryPath)) && !!(await regularFile(path.join(this.installDir, 'freshclam.exe')));
        await noLinks(this.databaseDir);
        definitions = await definitionFiles(this.databaseDir);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const receipt = await jsonFile(path.join(this.runtimeDir, 'definitions.json'));
    const checkedAt = receipt?.checkedAt && Number.isFinite(Date.parse(receipt.checkedAt)) ? receipt.checkedAt : null;
    const fresh = checkedAt && Date.now() - Date.parse(checkedAt) >= 0 && Date.now() - Date.parse(checkedAt) <= MAX_DATABASE_AGE;
    const verified = definitions && receipt?.databases && Object.keys(definitions).every(name => definitions[name].version === receipt.databases[name]?.version && definitions[name].bytes === receipt.databases[name]?.bytes);
    Object.assign(this.state, { installed, version: installed ? RELEASE.version : null, ready: !!(installed && verified && fresh), definitionsUpdatedAt: verified ? checkedAt : null });
    if (!this.state.busy && !this.state.message.startsWith('Could not')) {
      this.state.message = readyMessage(this.state);
    }
    return { ...this.state };
  }

  async _exclusive(operation, task) {
    if (this.state.busy) throw new Error('An engine operation is already running.');
    const controller = new AbortController();
    this._controller = controller;
    this._change({ busy: true, progress: null, message: operation === 'install' ? 'Preparing the independent ClamAV engine…' : 'Checking official threat definitions…' });
    try {
      await this._owned(true);
      cancelled(controller.signal);
      await task();
      cancelled(controller.signal);
      const status = await this.status();
      cancelled(controller.signal);
      const complete = { ...status, busy: false, progress: null, message: readyMessage(status) };
      this._controller = null;
      this._change(complete);
      return complete;
    } catch (error) {
      await this.status().catch(() => {});
      this._controller = null;
      this._change({ busy: false, progress: null, message: `Could not ${operation === 'install' ? 'finish engine setup' : 'update threat definitions'}: ${error.message}` });
      throw error;
    } finally { if (this._controller === controller) this._controller = null; }
  }

  cancel() {
    if (!this._controller || !this.state.busy) return false;
    this._controller.abort();
    return true;
  }

  dispose() {
    this.cancel();
    this.onChange = () => {};
  }

  async install() {
    return this._exclusive('install', async () => {
      if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This release supports Windows x64 only.');
      if (!(await this.status()).installed) {
        const existing = await fsp.lstat(this.installDir).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
        if (existing) throw new Error('An unverified engine directory already exists. No existing files were overwritten.');
        const staging = await fsp.mkdtemp(path.join(this.runtimeDir, '.install-'));
        const archive = path.join(staging, 'clamav.zip');
        const extracted = path.join(staging, 'extracted');
        try {
          let lastProgress = -1;
          this._change({ message: 'Downloading official ClamAV (226 MB)…', progress: 0 });
          await downloadVerified(RELEASE.url, archive, RELEASE, value => { if (value !== lastProgress) { lastProgress = value; this._change({ progress: value }); } }, this._controller.signal);
          this._change({ message: 'Archive verified. Extracting the isolated engine…', progress: null });
          const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
          const extractedResult = await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', EXTRACT_SCRIPT], { env: { ...process.env, VV_ARCHIVE: archive, VV_EXTRACT: extracted }, timeout: 10 * 60 * 1000, signal: this._controller.signal });
          if (extractedResult.code !== 0) throw new Error(outputError(extractedResult.output, 'The engine archive could not be extracted.'));
          await inspectTree(extracted);
          const candidates = [extracted, ...(await fsp.readdir(extracted, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => path.join(extracted, entry.name))];
          let engineFolder;
          for (const candidate of candidates) if (await regularFile(path.join(candidate, 'clamscan.exe')) && await regularFile(path.join(candidate, 'freshclam.exe'))) { engineFolder = candidate; break; }
          if (!engineFolder) throw new Error('The verified archive did not contain the expected ClamAV executables.');
          const version = await run(path.join(engineFolder, 'clamscan.exe'), ['--version'], { timeout: 30000, signal: this._controller.signal });
          if (version.code !== 0 || !version.output.includes(`ClamAV ${RELEASE.version}`)) throw new Error('The downloaded engine did not pass its version check.');
          await fsp.rename(engineFolder, this.installDir);
          await saveJson(path.join(this.runtimeDir, 'installed.json'), { version: RELEASE.version, archiveSha256: RELEASE.sha256, installedAt: new Date().toISOString() });
        } finally {
          // Only the freshly-created, verified child directory is ever removed.
          if (inside(this.runtimeDir, staging)) { await noLinks(staging); await inspectTree(staging); await fsp.rm(staging, { recursive: true, force: true }); }
        }
      }
      await this._updateDefinitions();
    });
  }

  async update() {
    return this._exclusive('update', async () => {
      if (!(await this.status()).installed) throw new Error('Install the ClamAV engine first.');
      await this._updateDefinitions();
    });
  }

  async _updateDefinitions() {
    await noLinks(this.databaseDir, true);
    await inspectTree(this.databaseDir);
    const config = path.join(this.runtimeDir, 'freshclam.conf');
    const existingConfig = await fsp.lstat(config).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
    if (existingConfig?.isSymbolicLink() || (existingConfig && !existingConfig.isFile())) throw new Error('Unsafe FreshClam configuration path.');
    await fsp.writeFile(config, 'DNSDatabaseInfo current.cvd.clamav.net\nDatabaseMirror database.clamav.net\nConnectTimeout 30\nReceiveTimeout 180\nMaxAttempts 2\nTestDatabases yes\nScriptedUpdates yes\nBytecode yes\n', { mode: 0o600 });
    this._change({ message: 'Downloading and validating official threat definitions. The first update may take several minutes…', progress: null });
    const result = await run(path.join(this.installDir, 'freshclam.exe'), [`--config-file=${config}`, `--datadir=${this.databaseDir}`, '--stdout'], { cwd: this.installDir, timeout: 20 * 60 * 1000, signal: this._controller.signal, onLine: line => { if (/up.to.date|updated|download|testing|warning|error|blocked/i.test(line)) this._change({ message: line }); } });
    if (result.code !== 0) throw new Error(outputError(result.output, `FreshClam exited with code ${result.code}.`));
    const databases = await definitionFiles(this.databaseDir);
    if (!databases) throw new Error('FreshClam finished without all required official databases. Scanning remains unavailable.');
    await saveJson(path.join(this.runtimeDir, 'definitions.json'), { checkedAt: new Date().toISOString(), databases });
  }
}

module.exports = { Engine, RELEASE, downloadVerified, definitionFiles, noLinks, inside, run };

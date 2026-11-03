'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { MAX_FILE_BYTES, key, within, fingerprint } = require('./files.cjs');

function initialScan() { return { id: null, status: 'idle', mode: null, startedAt: null, finishedAt: null, scanned: 0, total: 0, skipped: 0, errors: 0, current: '', detections: [], message: '', elapsedMs: 0 }; }
function parseResult(line) {
  let match = /^(.*): (.+) FOUND$/.exec(line);
  if (match) return { path: match[1], kind: /^(Heuristics\.(Limits\.Exceeded|Encrypted))/.test(match[2]) ? 'limited' : 'threat', name: match[2] };
  match = /^(.*): OK$/.exec(line);
  if (match) return { path: match[1], kind: 'ok' };
  match = /^(.*): (.+) ERROR$/.exec(line);
  return match ? { path: match[1], kind: 'error', name: match[2] } : null;
}
class Scanner {
  constructor({ engine, workDir, excluded = [], onChange = () => {}, onComplete = () => {}, spawnProcess = spawn }) {
    this.engine = engine; this.workDir = workDir; this.excluded = excluded; this.onChange = onChange; this.onComplete = onComplete;
    this.state = initialScan(); this.child = null; this.cancelled = false; this.running = false; this.lastEmit = 0;
    this.spawnProcess = spawnProcess;
  }
  emit(force = false) { this.state.elapsedMs = this.state.startedAt ? Date.now() - Date.parse(this.state.startedAt) : 0; if (force || Date.now() - this.lastEmit > 150) { this.lastEmit = Date.now(); this.onChange(this.state); } }
  cancel() { if (!this.running) return; this.cancelled = true; this.state.message = 'Stopping scan…'; this.child?.kill(); this.emit(true); }
  async start(mode, roots) {
    if (this.running) throw new Error('A scan is already running');
    const engine = await this.engine.status();
    if (!engine.ready || engine.busy) throw new Error('Install the engine and update its definitions before scanning');
    if (!Array.isArray(roots) || !roots.length || roots.some(p => !path.isAbsolute(p))) throw new Error('Choose at least one scan location');
    this.running = true; this.cancelled = false;
    this.state = { ...initialScan(), id: randomUUID(), mode, roots, status: 'enumerating', startedAt: new Date().toISOString(), message: 'Finding files to scan…', engineVersion: engine.version, definitionsUpdatedAt: engine.definitionsUpdatedAt };
    this.emit(true);
    const files = new Map(), completed = new Set(), findings = new Map(); let capReached = false, runtimeError = null;
    const list = path.join(this.workDir, `${this.state.id}.txt`);
    try {
      const visit = async file => {
        if (this.cancelled || capReached) return;
        if (files.has(key(file))) return;
        if (this.excluded.some(root => within(file, root))) { this.state.skipped++; return; }
        if (/[\r\n\0]/.test(file)) { this.state.skipped++; return; }
        try {
          const stat = await fs.lstat(file);
          if (stat.isSymbolicLink() || key(await fs.realpath(file)) !== key(file)) { this.state.skipped++; return; }
          if (stat.isDirectory()) {
            const directory = await fs.opendir(file);
            for await (const entry of directory) { if (this.cancelled || capReached) break; await visit(path.join(file, entry.name)); }
          } else if (stat.isFile()) {
            if (stat.size > MAX_FILE_BYTES) this.state.skipped++;
            else { files.set(key(file), { path: file, stat }); this.state.total = files.size; }
            if (files.size >= 50000) { capReached = true; this.state.skipped++; }
          } else this.state.skipped++;
          this.state.current = file; this.emit();
        } catch { this.state.errors++; this.emit(); }
      };
      for (const root of roots) await visit(path.resolve(root));
      if (this.cancelled) return;
      if (!files.size) { this.state.message = 'No eligible files were found in the selected locations.'; return; }
      await fs.mkdir(this.workDir, { recursive: true });
      await fs.writeFile(list, [...files.values()].map(x => x.path).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
      this.state.status = 'scanning'; this.state.message = 'Scanning with ClamAV. Engine loading may take a moment.'; this.emit(true);
      let buffer = '', errorTail = '', loadedSignatures = null;
      const line = raw => {
        const value = raw.replace(/\r$/, ''); const parsed = parseResult(value);
        const signatureSummary = /^Known viruses:\s+(\d+)\s*$/.exec(value);
        if (signatureSummary) loadedSignatures = Number(signatureSummary[1]);
        if (!parsed) { if (/ERROR|WARNING|LibClamAV Error/i.test(value)) errorTail = (errorTail + value + '\n').slice(-3000); return; }
        const entry = files.get(key(parsed.path));
        if (!entry) { if (parsed.kind !== 'ok') errorTail = (errorTail + 'Unmatched scanner output\n').slice(-3000); return; }
        if (!completed.has(key(parsed.path))) { completed.add(key(parsed.path)); this.state.scanned = completed.size; }
        this.state.current = entry.path;
        if (parsed.kind === 'threat') {
          const known = findings.get(key(entry.path));
          if (known) known.name += `; ${parsed.name}`;
          else { const item = { id: randomUUID(), path: entry.path, name: parsed.name, size: entry.stat.size, sha256: null, quarantined: false }; findings.set(key(entry.path), item); this.state.detections.push(item); }
        } else if (parsed.kind === 'limited') this.state.skipped++;
        else if (parsed.kind === 'error') this.state.errors++;
        this.emit();
      };
      const result = await new Promise((resolve, reject) => {
        const child = this.spawnProcess(this.engine.binaryPath, [
          `--database=${this.engine.databaseDir}`, `--file-list=${list}`, '--stdout', '--allmatch=yes',
          '--follow-dir-symlinks=0', '--follow-file-symlinks=0', '--max-filesize=128M', '--max-scansize=512M',
          '--max-recursion=16', '--max-files=10000', '--max-scantime=30000', '--alert-exceeds-max=yes', '--alert-encrypted=yes', '--fail-if-cvd-older-than=7',
        ], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        this.child = child;
        child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => { buffer += chunk; if (buffer.length > 1024 * 1024) { runtimeError = 'Scanner output exceeded its safety limit'; child.kill(); return; } let n; while ((n = buffer.indexOf('\n')) >= 0) { line(buffer.slice(0, n)); buffer = buffer.slice(n + 1); } });
        child.stderr.on('data', chunk => { errorTail = (errorTail + chunk).slice(-3000); });
        child.once('error', reject); child.once('close', code => { if (buffer) line(buffer); resolve(code); });
        if (this.cancelled) child.kill();
      });
      this.child = null;
      if (this.cancelled) return;
      if (runtimeError) throw new Error(runtimeError);
      if (result !== 0 && result !== 1) throw new Error(`ClamAV could not complete the scan (exit ${result}). ${errorTail.trim() || 'Check engine definitions and file access.'}`);
      if (!Number.isSafeInteger(loadedSignatures) || loadedSignatures < 1) throw new Error('ClamAV did not confirm any loaded signatures. Update the engine definitions before scanning again.');
      if (result === 1 && !findings.size && !this.state.skipped) throw new Error('ClamAV reported a finding without a matching file result. The scan cannot be considered complete.');
      if (errorTail.trim()) this.state.errors++;
      // Every submitted file needs an explicit terminal result. Unreadable,
      // unrecognised or silently omitted output never counts as a clean scan.
      const missing = files.size - completed.size;
      if (missing > 0) this.state.errors += missing;
      this.state.status = 'finishing'; this.state.message = 'Verifying detected files…'; this.emit(true);
      for (const finding of findings.values()) {
        if (this.cancelled) break;
        try { const digest = await fingerprint(finding.path, files.get(key(finding.path)).stat); finding.sha256 = digest.sha256; }
        catch (error) { finding.actionError = error.message; this.state.errors++; }
      }
      this.state.message = capReached ? 'The 50,000-file limit was reached. Scan smaller folders to cover the remaining files.' : 'Scan finished. Review findings and any skipped or unreadable files.';
    } catch (error) { this.state.status = 'failed'; this.state.message = error.message; this.state.errors++; }
    finally {
      this.child = null; this.running = false;
      if (this.cancelled) { this.state.status = 'cancelled'; this.state.message = 'Scan cancelled. Only the files shown as scanned were checked.'; }
      else if (this.state.status !== 'failed') this.state.status = this.state.errors || this.state.skipped || !files.size ? 'partial' : 'completed';
      this.state.finishedAt = new Date().toISOString(); this.state.current = ''; this.emit(true);
      await fs.rm(list, { force: true }).catch(() => {});
      await this.onComplete(structuredClone(this.state));
    }
    return this.state;
  }
}
module.exports = { Scanner, initialScan, parseResult };

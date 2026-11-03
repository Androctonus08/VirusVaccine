'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }).catch(() => {}); }
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw new Error('Saved VirusVaccine data could not be read. Keep the data folder intact and contact support.'); }
}
class Store {
  constructor(dir) { this.file = path.join(dir, 'state.json'); this.data = null; this.queue = Promise.resolve(); }
  async load() {
    const value = await readJson(this.file, { schema: 1, history: [], activities: [], watch: { enabled: false, folders: [] }, schedule: { enabled: false, hour: 12, lastRun: null } });
    if (value.schema !== 1 || !Array.isArray(value.history) || !Array.isArray(value.activities) || !Array.isArray(value.watch?.folders)) throw new Error('Unsupported saved data format');
    this.data = value; return value;
  }
  save() { const data = structuredClone(this.data); this.queue = this.queue.catch(() => {}).then(() => atomicJson(this.file, data)); return this.queue; }
  activity(title, detail = '') { this.data.activities.unshift({ id: randomUUID(), title, detail, at: new Date().toISOString() }); this.data.activities = this.data.activities.slice(0, 100); }
}
module.exports = { atomicJson, readJson, Store };

'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } = require('node:crypto');
const { atomicJson, readJson } = require('./storage.cjs');
const { ordinaryFile, sameStat, within, key, MAX_FILE_BYTES } = require('./files.cjs');

class Quarantine {
  constructor(directory, encryptionKey, protectedRoots = []) {
    if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) throw new Error('A 256-bit quarantine key is required');
    this.dir = directory; this.encryptionKey = encryptionKey; this.protectedRoots = protectedRoots; this.items = []; this.busy = false;
  }
  async load() {
    await fs.mkdir(this.dir, { recursive: true });
    this.items = await readJson(path.join(this.dir, 'index.json'), []);
    if (!Array.isArray(this.items) || this.items.some(x => !/^[a-f0-9-]{36}$/.test(x.id) || !path.isAbsolute(x.originalPath) || !/^[a-f0-9]{64}$/.test(x.sha256))) throw new Error('Quarantine metadata is damaged. Preserve the data folder.');
    return this.items;
  }
  async save() { await atomicJson(path.join(this.dir, 'index.json'), this.items); }
  async exclusively(action) { if (this.busy) throw new Error('Another quarantine operation is running'); this.busy = true; try { return await action(); } finally { this.busy = false; } }
  async add(detection) {
    return this.exclusively(async () => {
      if (!detection || !/^[a-f0-9]{64}$/.test(detection.sha256 ?? '')) throw new Error('This finding cannot be quarantined until it has been scanned and verified again');
      const source = detection.path;
      if (this.protectedRoots.some(root => within(source, root)) || within(source, this.dir)) throw new Error('VirusVaccine does not move operating system or installed application files. Review this finding with your primary antivirus.');
      const initial = await ordinaryFile(source);
      const handle = await fs.open(source, 'r');
      let bytes;
      try {
        if (!sameStat(initial, await handle.stat())) throw new Error('The file changed while opening it');
        bytes = await handle.readFile();
        if (bytes.length > MAX_FILE_BYTES || !sameStat(initial, await handle.stat())) throw new Error('The file changed while reading it');
      } finally { await handle.close(); }
      if (createHash('sha256').update(bytes).digest('hex') !== detection.sha256 || !sameStat(initial, await fs.lstat(source))) throw new Error('The file changed after scanning. Run a new scan before moving it.');
      const id = randomUUID(), iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      cipher.setAAD(Buffer.from(id));
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]); bytes.fill(0);
      const payload = Buffer.concat([Buffer.from('VVQ1'), iv, cipher.getAuthTag(), ciphertext]);
      const destination = path.join(this.dir, `${id}.vvq`);
      const entry = { id, name: detection.name, originalPath: source, sha256: detection.sha256, size: initial.size, createdAt: new Date().toISOString(), sourceRemoved: false };
      await fs.writeFile(destination, payload, { flag: 'wx', mode: 0o600 });
      // Journal the encrypted copy before removing a source. Interrupted moves
      // are recoverable and are never silently shown as successful quarantine.
      this.items.unshift(entry); await this.save();
      try {
        if (!sameStat(initial, await ordinaryFile(source))) throw new Error('The source changed before removal');
        // Move into a unique same-volume staging directory first. If the source
        // was replaced at the boundary, preserve it instead of unlinking it.
        const staging = await fs.mkdtemp(path.join(path.dirname(source), '.virusvaccine-move-'));
        entry.recoveryPath = path.join(staging, 'source'); await this.save();
        await fs.rename(source, entry.recoveryPath);
        const stagedStat = await ordinaryFile(entry.recoveryPath);
        const check = await fs.readFile(entry.recoveryPath);
        const matches = createHash('sha256').update(check).digest('hex') === detection.sha256; check.fill(0);
        if (!matches || !sameStat(initial, stagedStat)) throw new Error('The source changed during the move; its staged contents have been preserved');
        await fs.unlink(entry.recoveryPath); entry.sourceRemoved = true;
        delete entry.recoveryPath; await this.save(); await fs.rmdir(staging).catch(() => {});
      } catch (error) { entry.error = `An encrypted recovery copy was saved, but source removal was not confirmed: ${error.message}${entry.recoveryPath ? `. Check the preserved staging path: ${entry.recoveryPath}` : ''}`; await this.save(); throw new Error(entry.error); }
      return entry;
    });
  }
  async restore(id, destination) {
    return this.exclusively(async () => {
      const entry = this.items.find(x => x.id === id); if (!entry) throw new Error('Quarantined item not found');
      if (!path.isAbsolute(destination) || /[\r\n\0]/.test(destination) || within(destination, this.dir) || this.protectedRoots.some(root => within(destination, root))) throw new Error('Choose a destination outside protected application and system folders');
      const parent = path.dirname(destination);
      if (key(await fs.realpath(parent)) !== key(parent)) throw new Error('Restoring through a junction or symbolic link is not supported');
      const data = await fs.readFile(path.join(this.dir, `${id}.vvq`));
      if (data.length < 32 || data.subarray(0, 4).toString() !== 'VVQ1') throw new Error('Invalid quarantine container');
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, data.subarray(4, 16));
      decipher.setAAD(Buffer.from(id)); decipher.setAuthTag(data.subarray(16, 32));
      let bytes;
      try { bytes = Buffer.concat([decipher.update(data.subarray(32)), decipher.final()]); }
      catch { throw new Error('Quarantine authentication failed. The item was not restored.'); }
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) { bytes.fill(0); throw new Error('Quarantine integrity verification failed'); }
      try { await fs.writeFile(destination, bytes, { flag: 'wx', mode: 0o600 }); }
      finally { bytes.fill(0); }
      entry.lastRestoredAt = new Date().toISOString(); entry.lastRestoredTo = destination; await this.save();
      // Keep the encrypted copy until separately deleted by the user.
      return { path: destination, retained: true };
    });
  }
  async delete(id) {
    return this.exclusively(async () => {
      if (!this.items.some(x => x.id === id)) throw new Error('Quarantined item not found');
      await fs.unlink(path.join(this.dir, `${id}.vvq`)); this.items = this.items.filter(x => x.id !== id); await this.save();
    });
  }
}
module.exports = { Quarantine };

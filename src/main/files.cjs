'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_FILE_BYTES = 128 * 1024 * 1024;
const key = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
function within(file, root) { const relative = path.relative(key(root), key(file)); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); }
function sameStat(a, b) { return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs; }
async function ordinaryFile(file) {
  if (!path.isAbsolute(file) || /[\r\n\0]/.test(file)) throw new Error('Unsupported file path');
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Links and special files cannot be quarantined');
  if (key(await fs.realpath(file)) !== key(file)) throw new Error('Files reached through a junction or symbolic link cannot be quarantined');
  if (stat.size > MAX_FILE_BYTES) throw new Error('This file exceeds the 128 MB quarantine limit');
  return stat;
}
async function fingerprint(file, expected) {
  const initial = await ordinaryFile(file);
  if (expected && !sameStat(initial, expected)) throw new Error('The file changed after it was selected for scanning. Scan it again.');
  const handle = await fs.open(file, 'r');
  try {
    const opened = await handle.stat();
    if (!sameStat(initial, opened)) throw new Error('The file changed while opening it');
    const hash = crypto.createHash('sha256');
    const stream = handle.createReadStream({ autoClose: false });
    for await (const chunk of stream) hash.update(chunk);
    if (!sameStat(opened, await handle.stat()) || !sameStat(opened, await fs.lstat(file))) throw new Error('The file changed while reading it');
    return { sha256: hash.digest('hex'), size: opened.size, stat: opened };
  } finally { await handle.close(); }
}
module.exports = { MAX_FILE_BYTES, key, within, sameStat, ordinaryFile, fingerprint };

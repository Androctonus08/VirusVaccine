'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomBytes, createHash } = require('node:crypto');
const { Quarantine } = require('../src/main/quarantine.cjs');
async function setup(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'virusvaccine-test-')));
  t.after(async () => { assert.ok(path.basename(root).startsWith('virusvaccine-test-')); await fs.rm(root, { recursive: true, force: true }); });
  const quarantine = new Quarantine(path.join(root,'vault'), randomBytes(32)); await quarantine.load();
  const source = path.join(root, 'harmless-source.txt'), bytes = Buffer.from('This is an ordinary benign file for quarantine testing.'); await fs.writeFile(source,bytes);
  return { root, quarantine, source, bytes, detection: { id:'test',path:source,name:'VirusVaccine.Test',sha256:createHash('sha256').update(bytes).digest('hex') } };
}
test('encrypted quarantine round-trip preserves bytes and never overwrites a restore destination', async t => {
  const { root, quarantine, source, bytes, detection } = await setup(t);
  const entry = await quarantine.add(detection); assert.equal(entry.sourceRemoved,true);
  await assert.rejects(fs.stat(source),{code:'ENOENT'});
  const encrypted = await fs.readFile(path.join(root,'vault',entry.id+'.vvq')); assert.equal(encrypted.includes(bytes),false);
  const restored = path.join(root,'restored.txt'); await quarantine.restore(entry.id,restored); assert.deepEqual(await fs.readFile(restored),bytes);
  await assert.rejects(quarantine.restore(entry.id,restored),{code:'EEXIST'}); assert.equal(quarantine.items.length,1);
  await quarantine.delete(entry.id); assert.equal(quarantine.items.length,0); assert.deepEqual(await fs.readFile(restored),bytes);
});
test('changed source cannot be removed using an old detection', async t => {
  const {quarantine,source,detection}=await setup(t); await fs.writeFile(source,'new legitimate content');
  await assert.rejects(quarantine.add(detection),/changed/); assert.equal(await fs.readFile(source,'utf8'),'new legitimate content'); assert.equal(quarantine.items.length,0);
});
test('tampered ciphertext fails authentication without writing a restored file', async t => {
  const {root,quarantine,detection}=await setup(t); const entry=await quarantine.add(detection); const file=path.join(root,'vault',entry.id+'.vvq');
  const payload=await fs.readFile(file); payload[payload.length-1]^=1; await fs.writeFile(file,payload);
  const restored=path.join(root,'restored.txt'); await assert.rejects(quarantine.restore(entry.id,restored),/authentication/); await assert.rejects(fs.stat(restored),{code:'ENOENT'});
});
test('hard links and protected application files cannot be moved', async t => {
  const {root,quarantine,source,detection}=await setup(t); await fs.link(source,path.join(root,'link.txt'));
  await assert.rejects(quarantine.add(detection),/Links/); await fs.unlink(path.join(root,'link.txt'));
  quarantine.protectedRoots.push(root); await assert.rejects(quarantine.add(detection),/operating system/); assert.ok(await fs.stat(source));
});
test('a different Windows-user vault key cannot restore content', async t => {
  const {root,quarantine,detection}=await setup(t); const entry=await quarantine.add(detection);
  const wrong=new Quarantine(path.join(root,'vault'),randomBytes(32)); await wrong.load(); await assert.rejects(wrong.restore(entry.id,path.join(root,'output.txt')),/authentication/);
});

test('a replacement at the move boundary is preserved instead of deleted', async t => {
  const {root,quarantine,source,detection}=await setup(t);
  const save=quarantine.save.bind(quarantine); let replaced=false;
  quarantine.save=async () => { await save(); if (quarantine.items[0]?.recoveryPath && !replaced) { replaced=true; await fs.writeFile(source,'replacement must survive'); } };
  await assert.rejects(quarantine.add(detection), /preserved/);
  const entry=quarantine.items[0]; assert.equal(entry.sourceRemoved,false);
  assert.equal(await fs.readFile(entry.recoveryPath,'utf8'),'replacement must survive');
  const restored=path.join(root,'original-copy.txt'); await quarantine.restore(entry.id,restored);
  assert.equal(createHash('sha256').update(await fs.readFile(restored)).digest('hex'),detection.sha256);
});

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { analyzeUrl, analyzeMessage, cleanUrl, exportCompanion, providerUrl } = require('../src/main/protection.cjs');
test('link checks expose the actual host and suspicious formats without safe verdicts', () => {
  const disguised = analyzeUrl('https://trusted.example@192.0.2.2:8080/login');
  assert.equal(disguised.hostname,'192.0.2.2'); assert.equal(disguised.reasons.length,3);
  assert.match(analyzeUrl('https://xn--bcher-kva.example/').reasons.join(' '), /internationalized/);
  assert.match(analyzeUrl('https://bit.ly/fixture').reasons.join(' '), /shortened/);
  assert.match(analyzeUrl('http://example.com/').reasons.join(' '), /unencrypted/);
  assert.equal(analyzeUrl('https://example.com/').verdict,'No listed warning signs found');
  for (const input of ['javascript:alert(1)','file:///C:/Windows','https://example.com\n.evil.test','https://example.com\\@evil.test','https://']) assert.throws(()=>analyzeUrl(input));
});
test('message checks explain signals, bound link processing, and reject empty or oversized input', () => {
  const result = analyzeMessage('URGENT: send your OTP and pay a processing fee in gift cards. https://trusted.example@192.0.2.2/');
  assert.equal(result.reasons.length,3); assert.equal(result.links[0].hostname,'192.0.2.2');
  assert.equal(analyzeMessage('Meeting tomorrow at noon.').verdict,'No listed warning signs found');
  assert.equal(analyzeMessage('https://example.com/ '.repeat(10)).omittedLinks,2);
  assert.throws(()=>analyzeMessage('')); assert.throws(()=>analyzeMessage('a'.repeat(4001)));
});
test('URL cleanup preserves raw query encoding, repeated fields, fragments and signed links', () => {
  const result = cleanUrl('https://example.com/x?a=%20&a=+&utm_source=test&fbclid=1#part');
  assert.equal(result.url,'https://example.com/x?a=%20&a=+#part'); assert.deepEqual(result.removed,['utm_source','fbclid']);
  assert.equal(cleanUrl('https://example.com/?%75tm_medium=social#part').url,'https://example.com/#part');
  assert.equal(cleanUrl('https://example.com/?q=a%26utm_source%3Dx').url,'https://example.com/?q=a%26utm_source%3Dx');
  const signed = 'https://example.com/?X-Amz-Signature=abc&utm_source=email';
  assert.equal(cleanUrl(signed).url,signed); assert.match(cleanUrl(signed).note,/left unchanged/);
  assert.throws(()=>cleanUrl('https://user:password@example.com'));
});
test('provider opener is a fixed allowlist', () => {
  assert.equal(providerUrl('wireguard'),'https://www.wireguard.com/install/');
  for(const id of ['toString','__proto__','https://evil.example']) assert.throws(()=>providerUrl(id));
});
test('companion export contains only shipped files and refuses to overwrite', async () => {
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'virusvaccine-export-'));
  try { const result=await exportCompanion(path.resolve('src/companion'),temp); const files=await fs.readdir(result.path); assert.equal(files.length,6); assert.ok(files.includes('manifest.json')); await assert.rejects(exportCompanion(path.resolve('src/companion'),temp),{code:'EEXIST'}); assert.equal(JSON.parse(await fs.readFile(path.join(result.path,'manifest.json'),'utf8')).version,'0.2.0'); }
  finally { assert.equal(path.dirname(temp),os.tmpdir()); assert.ok(path.basename(temp).startsWith('virusvaccine-export-')); await fs.rm(temp,{recursive:true,force:true}); }
});

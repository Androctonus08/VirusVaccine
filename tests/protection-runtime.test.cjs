'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {softmax,imageTensor,audioTensor,summarize,Media}=require('../src/main/media.cjs');
const firewall=require('../src/main/firewall.cjs');
test('model preprocessing checks bounds, channel order, silence and nonfinite outputs',()=>{
  const rgb=Buffer.alloc(224*224*3);rgb[0]=255;const pixels=imageTensor(rgb);assert.equal(pixels[0],1);assert.equal(pixels[224*224],-1);assert.equal(pixels.length,224*224*3);
  assert.throws(()=>imageTensor(Buffer.alloc(10)));assert.throws(()=>softmax([NaN,1],0));assert.throws(()=>softmax([1,2,3],0));assert.ok(Math.abs(softmax([1000,1000],0)-0.5)<1e-6);
  const audio=Buffer.alloc(16000*4);assert.throws(()=>audioTensor(audio),/silent/);audio.writeFloatLE(Infinity,0);assert.throws(()=>audioTensor(audio),/Invalid/);
  for(let i=0;i<16000;i++)audio.writeFloatLE(Math.sin(i/10),i*4);const normalized=audioTensor(audio);assert.ok(Math.abs(normalized.reduce((x,y)=>x+y,0)/16000)<0.001);
  assert.equal(summarize([]),null);assert.equal(summarize([0.1]).assessment,'Model did not flag these samples');assert.equal(summarize([0.5]).assessment,'Inconclusive model scores');
});
test('firewall scripts quote paths and limit removal to owned identifiers',()=>{
  const id='VirusVaccine.App.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const script=firewall.addScript("C:\\Example's App\\client.exe",id);assert.ok(script.includes("'C:\\Example''s App\\client.exe'"));assert.match(script,/-Direction Outbound -Action Block/);
  assert.throws(()=>firewall.removeScript("OtherRule';Remove-Item C:\\"));assert.match(firewall.removeScript(id),/ownership mismatch/);
  assert.doesNotMatch(script,/Set-NetFirewallProfile|Disable-NetFirewall|Remove-NetFirewallRule/);
});
test('firewall selection rejects system components and linked executables',async()=>{
  // Windows runners may expose TEMP through an 8.3 alias. The fixture must use
  // the same expanded path a native executable picker supplies.
  const temporary=await fs.realpath(os.tmpdir());const root=await fs.mkdtemp(path.join(temporary,'vv-firewall-input-'));try{
    const file=path.join(root,'client.exe');await fs.writeFile(file,'harmless fixture');assert.equal((await firewall.target(file)).path,file);
    const link=path.join(root,'alias.exe');await fs.link(file,link);await assert.rejects(firewall.target(file),/ordinary/);
    await fs.mkdir(path.join(root,'McAfee'));const protectedFile=path.join(root,'McAfee','client.exe');await fs.writeFile(protectedFile,'fixture');await assert.rejects(firewall.target(protectedFile),/does not block/);
  }finally{assert.equal(path.dirname(root),temporary);await fs.rm(root,{recursive:true,force:true});}
});
test('uninstalled media models cannot produce a result',async()=>{
  const m=new Media(path.join(os.tmpdir(),'missing-media-assets'));await m.status();assert.equal(m.state.ready,false);await assert.rejects(m.analyze('C:\\fixture.mp4'),/Set up/);assert.equal(m.state.result,null);
});

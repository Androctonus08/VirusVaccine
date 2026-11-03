'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {Scanner,parseResult}=require('../src/main/scanner.cjs');
async function setup(t,behavior='clean') {
  const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'virusvaccine-scan-')));
  t.after(async()=>{assert.ok(path.basename(root).startsWith('virusvaccine-scan-'));await fs.rm(root,{recursive:true,force:true});});
  const target=path.join(root,'target');await fs.mkdir(target); const file=path.join(target,'résumé-安全 harmless.txt');await fs.writeFile(file,'harmless scanner fixture');
  const script=path.join(root,'fake-engine.cjs'); await fs.writeFile(script,`const fs=require('node:fs');const args=process.argv.slice(2);const files=fs.readFileSync(args.find(x=>x.startsWith('--file-list=')).slice(12),'utf8').trim().split('\\n');const mode=${JSON.stringify(behavior)};console.log('Known viruses: '+(mode==='zero'?0:1));if(mode==='slow'){setTimeout(()=>{},30000)}else if(mode==='failure'){process.stderr.write('database unavailable');process.exitCode=2}else if(mode!=='missing'){for(const file of files) console.log(file+': '+(mode==='threat'?'VirusVaccine.Harmless FOUND':mode==='limit'?'Heuristics.Limits.Exceeded.MaxFileSize FOUND':'OK'));process.exitCode=mode==='threat'||mode==='limit'?1:0}`);
  const scanner=new Scanner({engine:{binaryPath:'unused',databaseDir:root,status:async()=>({ready:true,busy:false,version:'test'})},workDir:path.join(root,'work'),spawnProcess:(_binary,args,options)=>{assert.ok(args.includes('--alert-exceeds-max=yes'));assert.equal(options.shell,false);return spawn(process.execPath,[script,...args],options);}});
  return{scanner,root,target,file};
}
test('safe argument lists preserve Unicode paths and explicit clean results',async t=>{const{scanner,target}=await setup(t);await scanner.start('folder',[target]);assert.equal(scanner.state.status,'completed');assert.equal(scanner.state.scanned,1);assert.equal(scanner.state.errors,0);});
test('detections carry a verified file hash for quarantine',async t=>{const{scanner,target,file}=await setup(t,'threat');await scanner.start('folder',[target]);assert.equal(scanner.state.detections[0].path,file);assert.match(scanner.state.detections[0].sha256,/^[a-f0-9]{64}$/);});
test('silent omitted files produce a partial scan, never a clean result',async t=>{const{scanner,target}=await setup(t,'missing');await scanner.start('folder',[target]);assert.equal(scanner.state.status,'partial');assert.equal(scanner.state.errors,1);});
test('archive limits are coverage gaps rather than quarantineable malware',async t=>{const{scanner,target}=await setup(t,'limit');await scanner.start('folder',[target]);assert.equal(scanner.state.status,'partial');assert.equal(scanner.state.skipped,1);assert.equal(scanner.state.detections.length,0);});
test('engine failure remains a failed scan',async t=>{const{scanner,target}=await setup(t,'failure');await scanner.start('folder',[target]);assert.equal(scanner.state.status,'failed');assert.match(scanner.state.message,/database unavailable/);});
test('cancellation waits for the owned scanner process to exit',{timeout:10000},async t=>{
  const{scanner,target}=await setup(t,'slow');const work=scanner.start('folder',[target]);const deadline=Date.now()+5000;
  try {
    while(scanner.state.status!=='scanning') {
      if(Date.now()>deadline||['completed','partial','failed'].includes(scanner.state.status))throw new Error('Scanner did not start: '+scanner.state.message);
      await new Promise(r=>setTimeout(r,5));
    }
    scanner.cancel();await work;assert.equal(scanner.state.status,'cancelled');assert.equal(scanner.child,null);assert.equal(scanner.running,false);
  } finally {scanner.cancel();await work;}
});
test('Windows paths and malicious-looking filenames stay data',()=>{assert.deepEqual(parseResult('C:\\data\\<img src=x>.txt: Test.Marker FOUND'),{path:'C:\\data\\<img src=x>.txt',kind:'threat',name:'Test.Marker'});assert.equal(parseResult('arbitrary diagnostic'),null);});

test('zero loaded signatures never produce a clean scan',async t=>{const{scanner,target}=await setup(t,'zero');await scanner.start('folder',[target]);assert.equal(scanner.state.status,'failed');assert.match(scanner.state.message,/loaded signatures/);});

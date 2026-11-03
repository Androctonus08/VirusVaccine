'use strict';
// Real native agent + ClamAV protocol test, using a random harmless signature.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{promisify}=require('node:util'),{randomUUID}=require('node:crypto');
const run=promisify(execFile);
(async()=>{
  const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'vv-guard-test-'));
  const engine=path.join(root,'.runtime','clamav-1.5.4','clamd.exe'),agent=path.join(root,'dist/native/VirusVaccineGuardAgent.exe');
  let daemon;try{
    const database=path.join(temp,'database');await fs.mkdir(database);
    const marker='VirusVaccine harmless native bridge fixture '+randomUUID();
    await fs.writeFile(path.join(database,'fixture.ndb'),'VirusVaccine.NativeFixture:0:*:'+Buffer.from(marker).toString('hex')+'\n');
    const clean=path.join(temp,'clean.txt'),detected=path.join(temp,'marker.txt'),empty=path.join(temp,'empty.txt');
    await fs.writeFile(clean,'Ordinary document for the native scanner test.');await fs.writeFile(detected,marker);await fs.writeFile(empty,'');
    const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));
    const config=path.join(temp,'clamd.conf');await fs.writeFile(config,`DatabaseDirectory "${database}"\nTCPSocket ${port}\nTCPAddr 127.0.0.1\nForeground yes\nMaxThreads 2\nStreamMaxLength 128M\nMaxFileSize 128M\nMaxScanSize 128M\nMaxScanTime 15000\nAlertExceedsMax yes\n`);
    daemon=spawn(engine,['--config-file='+config],{windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';daemon.stdout.on('data',x=>{log+=x});daemon.stderr.on('data',x=>{log+=x});
    for(let i=0;i<100;i++) {const ready=await new Promise(resolve=>{const socket=net.connect(port,'127.0.0.1');socket.setTimeout(500);socket.on('connect',()=>{socket.destroy();resolve(true)});socket.on('error',()=>resolve(false));socket.on('timeout',()=>{socket.destroy();resolve(false)});});if(ready)break;if(daemon.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,100));}
    async function scan(file,pid=daemon.pid){try{const r=await run(agent,['--scan',String(port),String(pid),file],{windowsHide:true,timeout:30000});return{code:0,out:r.stdout.trim()}}catch(e){return{code:e.code,out:e.stdout?.trim(),error:e.stderr}}}
    assert.deepEqual(await scan(clean),{code:0,out:'CLEAN'});assert.equal((await scan(detected)).code,1);assert.equal((await scan(empty)).code,0);
    assert.equal((await scan(clean,process.pid)).code,2,'An unrelated TCP listener PID must not be trusted');
    const large=path.join(temp,'over-limit.bin');const handle=await fs.open(large,'wx');await handle.truncate(129*1024*1024);await handle.close();assert.equal((await scan(large)).code,2,'Over-limit input must not be clean');
    daemon.kill();await new Promise(resolve=>daemon.once('exit',resolve));assert.equal((await scan(clean)).code,2,'Offline scanner must return unknown');
    await fs.mkdir(path.join(root,'review/private'),{recursive:true});await fs.writeFile(path.join(root,'review/private/guard-verification.json'),JSON.stringify({passed:true,clean:true,harmlessSignature:true,emptyFile:true,wrongListenerRejected:true,offlineUnknown:true,kernelRuntimeTested:false},null,2));
    console.log('Native ClamAV bridge passed clean, harmless detection, empty file, wrong-listener and offline checks. Kernel enforcement was not exercised.');
  }finally{if(daemon?.exitCode===null)daemon.kill();assert.equal(path.dirname(temp),os.tmpdir());assert.ok(path.basename(temp).startsWith('vv-guard-test-'));await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});

'use strict';
// Actual ONNX + decoder integration; generated signals do not measure detector accuracy.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),{Media}=require('../src/main/media.cjs');
(async()=>{
  const root=path.resolve(__dirname,'..'),out=path.join(root,'review/private/media-tests');await fs.mkdir(out,{recursive:true});
  const media=new Media(path.join(root,'.runtime/media'));await media.status();assert.equal(media.state.ready,true,'Download pinned media assets first');
  const file=path.join(out,'generated.mp4');await run(path.join(media.bin,'ffmpeg.exe'),['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=320x240:rate=1','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','2','-c:v','mpeg4','-pix_fmt','yuv420p','-c:a','aac',file],{windowsHide:true,timeout:20000});
  const result=await media.analyze(file);assert.equal(result.visual.samples,2);assert.equal(result.audio.samples,1);for(const kind of ['audio','visual'])assert.ok(result[kind].mean>=0&&result[kind].mean<=1);assert.equal(media.state.busy,false);
  const invalid=path.join(out,'unsupported.mp4');await fs.writeFile(invalid,'ordinary text');await assert.rejects(media.analyze(invalid),/decoded|stream/);assert.equal(media.state.result,null);assert.equal(media.state.busy,false);
  const playlist=path.join(out,'network.m3u8');await fs.writeFile(playlist,'#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nhttps://example.com/media.ts\n');await assert.rejects(media.analyze(playlist),/decoded/);
  const job=media.analyze(file);setTimeout(()=>media.cancel(),500);await assert.rejects(job,/stopped|cancel/i);assert.equal(media.state.busy,false);
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,actualModels:true,audioAndVideo:true,invalidInputRejected:true,playlistRejected:true,cancelled:true,accuracyMeasured:false},null,2));
  console.log('Local media integration passed real audio/video inference, invalid input, playlist rejection and cancellation. Detection accuracy was not measured.');
})().catch(error=>{console.error(error);process.exitCode=1});

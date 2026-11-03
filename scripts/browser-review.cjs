'use strict';
// Isolated browser fixtures only. Never load an operator's existing browser profile.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(),'virusvaccine-browser-'));
  const extension = path.join(temporary,'extension'); let context;
  await fs.mkdir(extension);
  for (const file of ['manifest.json','trackers.json','checks.js','popup.html','popup.css','popup.js']) await fs.copyFile(path.resolve('src/companion',file),path.join(extension,file));
  let trackerHits = 0, cacheHits = 0;
  const server = http.createServer((request,response) => {
    response.setHeader('Access-Control-Allow-Origin','*');
    if(request.url.startsWith('/tracker')) trackerHits++;
    if(request.url.startsWith('/cache')) { cacheHits++; response.setHeader('Cache-Control','public, max-age=3600'); }
    response.setHeader('Content-Type','text/html'); response.end('<!doctype html><title>Local browser test</title><p>Harmless fixture</p>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port;
  try {
    context=await chromium.launchPersistentContext(path.join(temporary,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,`--host-resolver-rules=MAP doubleclick.net 127.0.0.1, EXCLUDE localhost`,'--no-proxy-server']});
    // Discover this isolated profile's unpacked extension without a service worker.
    const management=await context.newPage(); await management.goto('chrome://extensions');
    const extensions=await management.evaluate(()=>new Promise(resolve=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true},resolve)));
    const id=extensions.find(item=>item.name==='VirusVaccine Browser Companion')?.id; assert.ok(id,'Unpacked extension must load');
    const popup=await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.locator('#blocking-status')).toHaveText('Blocking enabled in this browser');
    const site=await context.newPage(); await site.goto(`http://127.0.0.1:${port}/`);
    const fetchTracker=()=>site.evaluate(async url=>{try{return (await fetch(url)).status;}catch{return 'blocked';}},`http://doubleclick.net:${port}/tracker?case=${Math.random()}`);
    assert.equal(await fetchTracker(),'blocked'); assert.equal(trackerHits,0);
    await popup.getByRole('button',{name:'Pause blocking'}).click(); await expect(popup.locator('#blocking-status')).toHaveText('Tracker blocking is paused');
    assert.equal(await fetchTracker(),200); assert.equal(trackerHits,1);
    await popup.getByRole('button',{name:'Enable blocking'}).click(); await expect(popup.locator('#blocking-status')).toHaveText('Blocking enabled in this browser');
    assert.equal(await fetchTracker(),'blocked'); assert.equal(trackerHits,1);
    await popup.getByLabel('HTTP or HTTPS link').fill('https://example.com/?utm_source=test&q=%20'); await popup.getByRole('button',{name:'Remove tracking parameters'}).click();
    await expect(popup.getByLabel('Cleaned link')).toHaveValue('https://example.com/?q=%20');
    await popup.getByLabel('HTTP or HTTPS link').fill('https://trusted.example@192.0.2.2/');await popup.getByRole('button',{name:'Check link',exact:true}).click();await expect(popup.locator('#link-result')).toContainText('Actual hostname: 192.0.2.2');
    await site.evaluate(()=>{document.cookie='fixture=present; path=/'; localStorage.setItem('keep','fixture');});
    const fetchCache=()=>site.evaluate(async()=> (await fetch('/cache')).text()); await fetchCache(); await fetchCache(); assert.equal(cacheHits,1);
    await popup.getByRole('button',{name:'Clear selected data'}).click();await expect(popup.getByRole('alert')).toContainText('Confirm the deletion');assert.ok((await context.cookies()).some(cookie=>cookie.name==='fixture'));
    // Default cache-only cleanup must preserve cookies and local storage.
    await popup.getByLabel('Time range').selectOption('all');await popup.getByLabel('I understand and want to delete the selected data.').check();await popup.getByRole('button',{name:'Clear selected data'}).click();await expect(popup.locator('#cleanup-result')).toContainText('completed the cleanup request');
    await fetchCache();assert.equal(cacheHits,2);assert.ok((await context.cookies()).some(cookie=>cookie.name==='fixture'));
    // Explicit cookie selection removes the fixture cookie without clearing local storage.
    await popup.getByLabel('Cached files',{exact:true}).uncheck();await popup.getByLabel('Cookies (can sign you out)',{exact:true}).check();await popup.getByLabel('I understand and want to delete the selected data.').check();await popup.getByRole('button',{name:'Clear selected data'}).click();await expect(popup.locator('#cleanup-result')).toContainText('completed the cleanup request');
    assert.ok(!(await context.cookies()).some(cookie=>cookie.name==='fixture'));assert.equal(await site.evaluate(()=>localStorage.getItem('keep')),'fixture');
    const output=path.resolve('review/private/browser');await fs.mkdir(output,{recursive:true});await popup.screenshot({path:path.join(output,'companion.png'),fullPage:true});
    console.log('Browser companion passed real blocking, pause/resume, link inspection/cleanup, deletion confirmation, cache cleanup, cookie cleanup, and retained-data checks in an isolated profile.');
  } finally {if(context) await context.close();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('virusvaccine-browser-'));await fs.rm(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

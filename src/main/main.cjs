'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Tray, Menu, nativeImage, Notification } = require('electron');
const fs = require('node:fs/promises');
const { watch } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomBytes } = require('node:crypto');
const { Engine } = require('./engine.cjs');
const { Scanner } = require('./scanner.cjs');
const { Quarantine } = require('./quarantine.cjs');
const { Store } = require('./storage.cjs');
const { key, within } = require('./files.cjs');
const { securityStatus } = require('./system.cjs');
const protection = require('./protection.cjs');
const firewall = require('./firewall.cjs');
const guard = require('./guard.cjs');
const { Media } = require('./media.cjs');

if (!app.isPackaged && process.env.VIRUSVACCINE_DATA_DIR) app.setPath('userData', path.resolve(process.env.VIRUSVACCINE_DATA_DIR));
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  let window, engine, scanner, store, quarantine, tray, automationTimer, media;
  let firewallBusy = false;
  let firewallState = {available:false,rules:[],profiles:[],message:'Reading firewall status'};
  let guardState = {active:false,driver:'Checking',agent:'Checking',message:'Checking development driver status'};
  let quitting = false, initialized = false, launching = false, notice = null, backgroundNoticeShown = false;
  let system = { antivirus: [], firewall: [], message: 'Checking Windows security status' };
  let engineState = { installed: false, ready: false, busy: false, version: null, definitionsUpdatedAt: null, message: 'Checking scanning engine', progress: null };
  const watchers = new Map(), pending = new Set();
  let watchMessage = 'Off', maintenance = false;
  const entry = path.resolve(__dirname, '../renderer/index.html');
  const entryUrl = pathToFileURL(entry).href;
  const dataDir = app.getPath('userData');
  const runtime = process.env.VIRUSVACCINE_RUNTIME_DIR ? path.resolve(process.env.VIRUSVACCINE_RUNTIME_DIR) : path.join(dataDir, 'engine');
  const protectedRoots = [dataDir, runtime, app.getAppPath(), process.env.WINDIR, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);

  function snapshot() {
    return { version: app.getVersion(), engine: engineState, scan: scanner?.state, history: store?.data?.history ?? [], quarantine: quarantine?.items ?? [],
      watch: { ...(store?.data?.watch ?? { enabled: false, folders: [] }), message: watchMessage }, schedule: store?.data?.schedule ?? { enabled: false, hour: 12, lastRun: null },
      system, firewall: {...firewallState,busy:firewallBusy}, guard:guardState, media:media?.state, activities: store?.data?.activities ?? [], notice };
  }
  function emit() { if (window && !window.isDestroyed()) window.webContents.send('vaccine:state', snapshot()); }
  function failure(error) { notice = { type: 'error', message: error?.message || String(error) }; emit(); }
  function background(promise) { promise.catch(failure); return { started: true }; }
  function assertIdle() { if (scanner.running || launching || maintenance || engineState.busy) throw new Error('Wait for the current scan or engine update to finish'); }
  function checkObject(payload) { if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid request'); }
  function showWindow() { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); }
  async function confirm(title, message, detail, destructive = false) {
    const result = await dialog.showMessageBox(window, { type: 'warning', title, message, detail, buttons: ['Cancel', destructive ? 'Delete permanently' : 'Continue'], defaultId: 0, cancelId: 0, noLink: true });
    return result.response === 1;
  }
  async function quickRoots() {
    const values = [app.getPath('downloads'), app.getPath('desktop'), app.getPath('temp')];
    return (await Promise.all(values.map(async p => await fs.stat(p).then(s => s.isDirectory() ? p : null).catch(() => null)))).filter(Boolean);
  }
  async function startScan(mode, roots) {
    assertIdle(); launching = true; notice = null;
    try { await scanner.start(mode, roots); }
    finally { launching = false; emit(); }
  }
  async function refreshSystem() { system = await securityStatus(); emit(); }
  async function refreshProtection() { [firewallState,guardState] = await Promise.all([firewall.list(),guard.status()]); emit(); }
  function stopWatchers() { for (const item of watchers.values()) item.close(); watchers.clear(); pending.clear(); }
  async function setWatchers() {
    stopWatchers();
    if (!store.data.watch.enabled) { watchMessage = 'Off'; emit(); return; }
    let errors = 0;
    for (const folder of store.data.watch.folders) {
      try {
        if (key(await fs.realpath(folder)) !== key(folder)) throw new Error('Folder is now a junction');
        const watcher = watch(folder, { recursive: true }, (_type, name) => {
          if (!name) return;
          const target = path.resolve(folder, name.toString());
          if (!within(target, folder) || protectedRoots.some(root => within(target, root))) return;
          if (pending.size >= 1000) { watchMessage = 'Change queue reached its limit. Run a folder scan to check remaining files.'; emit(); return; }
          pending.add(target);
        });
        watcher.on('error', () => { watchMessage = 'A folder watcher stopped. Run a folder scan and re-enable monitoring.'; watcher.close(); watchers.delete(folder); emit(); });
        watchers.set(folder, watcher);
      } catch { errors++; }
    }
    watchMessage = errors ? 'Some selected folders could not be monitored. Review their availability.' : watchers.size ? 'Watching for changes while VirusVaccine is running. Files can execute before a scan finishes.' : 'Add a folder to monitor'; emit();
  }
  async function automate() {
    if (!initialized || scanner.running || launching || maintenance || engineState.busy || !engineState.ready) return;
    const now = new Date(), day = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
    const schedule = store.data.schedule;
    if (schedule.enabled && schedule.hour <= now.getHours() && schedule.lastRun !== day) {
      schedule.lastRun = day; await store.save();
      await startScan('scheduled', await quickRoots()); return;
    }
    if (store.data.watch.enabled && pending.size) {
      const files = [...pending].slice(0, 200); for (const file of files) pending.delete(file);
      const existing = [];
      for (const file of files) { const stat = await fs.lstat(file).catch(() => null); if (stat?.isFile()) existing.push(file); }
      if (existing.length) await startScan('watch', existing);
    }
  }
  async function handle(action, payload) {
    if (action === 'state:get') return snapshot();
    if (!initialized) throw new Error('VirusVaccine is still starting');
    notice = null;
    if (action === 'protection:refresh') return background(refreshProtection());
    if (action === 'firewall:block' || action === 'firewall:remove') {
      if(firewallBusy) throw new Error('Finish the current firewall change first');
      firewallBusy=true;emit();
      try {
        let result;
        if(action === 'firewall:block') {
          const selection=await dialog.showOpenDialog(window,{title:'Choose the application to block from outbound connections',properties:['openFile','dontAddToRecent'],filters:[{name:'Windows applications',extensions:['exe']}]});
          if(selection.canceled || !selection.filePaths.length) return {cancelled:true};
          const selected=await firewall.target(selection.filePaths[0]);
          if(!await confirm('Block application connections','Block outbound network traffic for this application?',selected.path+'\n\nWindows will ask for administrator approval. Remove the VirusVaccine rule here to undo the block.'))return{cancelled:true};
          result=await firewall.block(selected.path);
        } else {
          checkObject(payload);firewallState=await firewall.list();
          const rule=firewallState.rules.find(item=>item.id===payload.id);if(!rule)throw new Error('Rule no longer exists');
          if(!await confirm('Remove application block','Remove this VirusVaccine firewall rule?',rule.program+'\n\nOther firewall policies may still restrict this application.'))return{cancelled:true};
          result=await firewall.remove(rule.id);
        }
        return result;
      } finally {firewallBusy=false;await refreshProtection();}
    }
    if(action === 'media:install') {
      if(media.state.busy)throw new Error('Media analysis is busy');
      if(!await confirm('Set up local media analysis','Download the analysis models and decoder?','Approximately 546 MB will be downloaded from the pinned model and decoder releases. Analysis then runs on this computer. These experimental models can be wrong.'))return{cancelled:true};
      return background(media.install());
    }
    if(action === 'media:analyze') {
      if(media.state.busy)throw new Error('Media analysis is busy');
      const selection=await dialog.showOpenDialog(window,{title:'Choose media to analyze locally',properties:['openFile','dontAddToRecent'],filters:[{name:'Media',extensions:['mp4','mov','mkv','webm','avi','wav','mp3','flac','ogg','aac','jpg','jpeg','png','webp','bmp']}]});
      if(selection.canceled || !selection.filePaths.length)return{cancelled:true};
      return background(media.analyze(selection.filePaths[0]));
    }
    if(action === 'media:cancel'){media.cancel();return{cancelled:true};}
    if (action === 'tools:message' || action === 'tools:link' || action === 'tools:clean-link') {
      checkObject(payload);
      return protection[action === 'tools:message' ? 'analyzeMessage' : action === 'tools:link' ? 'analyzeUrl' : 'cleanUrl'](payload.text);
    }
    if (action === 'browser:export') {
      const selection = await dialog.showOpenDialog(window, { title: 'Choose where to save the browser companion folder', properties: ['openDirectory','createDirectory','dontAddToRecent'] });
      if (selection.canceled || !selection.filePaths.length) return { cancelled: true };
      return protection.exportCompanion(path.resolve(__dirname, '../companion'), selection.filePaths[0]);
    }
    if (action === 'provider:open') { checkObject(payload); await shell.openExternal(protection.providerUrl(payload.id)); return {}; }
    if (action === 'engine:install' || action === 'engine:update') {
      assertIdle(); maintenance = true;
      return background((async () => { try { await engine[action === 'engine:install' ? 'install' : 'update'](); store.activity('Engine updated', 'Official ClamAV engine and signature status checked'); await store.save(); } finally { maintenance = false; engineState = await engine.status(); emit(); } })());
    }
    if (action === 'scan:start') {
      checkObject(payload); assertIdle();
      if (!['quick','full','file','folder'].includes(payload.mode)) throw new Error('Unknown scan type');
      if (!engineState.ready) throw new Error('Set up the engine and definitions first');
      let roots;
      if (payload.mode === 'quick') roots = await quickRoots();
      else {
        const selection = await dialog.showOpenDialog(window, { title: payload.mode === 'full' ? 'Choose a drive root to scan (for example C:\\)' : 'Choose what to scan', properties: [payload.mode === 'file' ? 'openFile' : 'openDirectory', 'multiSelections', 'dontAddToRecent'] });
        if (selection.canceled || !selection.filePaths.length) return { cancelled: true }; roots = selection.filePaths;
      }
      return background(startScan(payload.mode, roots));
    }
    if (action === 'scan:cancel') { scanner.cancel(); return { cancelled: true }; }
    if (action === 'scan:export') {
      const selection = await dialog.showSaveDialog(window, { title: 'Export local scan report', defaultPath: `VirusVaccine-report-${new Date().toISOString().slice(0,10)}.json`, filters: [{name:'JSON report',extensions:['json']}] });
      if (selection.canceled) return { cancelled: true };
      await fs.writeFile(selection.filePath, JSON.stringify({ product: 'VirusVaccine', version: app.getVersion(), exportedAt: new Date().toISOString(), engine: engineState, scan: scanner.state, history: store.data.history, scope: 'On-demand and after-change malware scanning; no execution blocking or efficacy certification' }, null, 2), { mode: 0o600 });
      return { exported: true };
    }
    if (action.startsWith('quarantine:')) {
      checkObject(payload); if (typeof payload.id !== 'string') throw new Error('Invalid finding'); assertIdle();
      if (action === 'quarantine:add') {
        const item = scanner.state.detections.find(x => x.id === payload.id);
        if (!item || item.quarantined) throw new Error('Finding is no longer available');
        if (!await confirm('Quarantine file', 'Move this detected file into encrypted quarantine?', `${item.path}\n\nDetection: ${item.name}\n\nThe original will be removed only after an encrypted recovery copy is saved.`)) return { cancelled: true };
        await quarantine.add(item); item.quarantined = true; store.activity('File quarantined', path.basename(item.path));
      } else if (action === 'quarantine:restore') {
        const item = quarantine.items.find(x => x.id === payload.id); if (!item) throw new Error('Item no longer exists');
        if (!await confirm('Restore detected file', 'Restoring a detected file can put this computer at risk.', `Detection: ${item.name}\n\nOnly continue if you have independently verified it is safe. The encrypted copy will remain in quarantine.`)) return { cancelled: true };
        const destination = await dialog.showSaveDialog(window, { title: 'Restore without replacing an existing file', defaultPath: path.join(app.getPath('downloads'), path.basename(item.originalPath)) });
        if (destination.canceled) return { cancelled: true };
        await quarantine.restore(item.id, destination.filePath); store.activity('Quarantine copy restored', path.basename(destination.filePath));
      } else if (action === 'quarantine:delete') {
        const item = quarantine.items.find(x => x.id === payload.id); if (!item) throw new Error('Item no longer exists');
        if (!await confirm('Delete quarantined copy', 'Permanently delete this encrypted copy?', `${path.basename(item.originalPath)}\n\nThis cannot be undone. Any copies previously restored are not deleted.`, true)) return { cancelled: true };
        await quarantine.delete(item.id); store.activity('Quarantined copy deleted', path.basename(item.originalPath));
      } else throw new Error('Unknown quarantine action');
      await store.save(); emit(); return snapshot();
    }
    if (action === 'watch:add') {
      const result = await dialog.showOpenDialog(window, { title: 'Monitor a folder for changes while VirusVaccine is running', properties: ['openDirectory','dontAddToRecent'] });
      if (result.canceled || !result.filePaths.length) return { cancelled: true };
      const folder = result.filePaths[0];
      if (protectedRoots.some(root => within(folder, root) || within(root, folder))) throw new Error('Choose a personal folder outside system, application, and VirusVaccine data directories');
      if (key(await fs.realpath(folder)) !== key(folder)) throw new Error('Monitoring junctions and symbolic links is not supported');
      if (!store.data.watch.folders.some(x => key(x) === key(folder))) store.data.watch.folders.push(folder);
      if (store.data.watch.folders.length > 10) { store.data.watch.folders.pop(); throw new Error('Monitor up to ten folders'); }
      await store.save(); await setWatchers(); return snapshot();
    }
    if (action === 'watch:remove') { checkObject(payload); store.data.watch.folders = store.data.watch.folders.filter(x => x !== payload.path); await store.save(); await setWatchers(); return snapshot(); }
    if (action === 'watch:toggle') { checkObject(payload); if (typeof payload.enabled !== 'boolean') throw new Error('Invalid monitoring choice'); if (payload.enabled && !engineState.ready) throw new Error('Set up the engine first'); store.data.watch.enabled = payload.enabled; await store.save(); await setWatchers(); return snapshot(); }
    if (action === 'schedule:set') { checkObject(payload); if (typeof payload.enabled !== 'boolean' || !Number.isInteger(payload.hour) || payload.hour < 0 || payload.hour > 23) throw new Error('Choose an hour from 0 to 23'); if (payload.enabled && !engineState.ready) throw new Error('Set up the engine first'); store.data.schedule = { ...store.data.schedule, enabled: payload.enabled, hour: payload.hour }; await store.save(); emit(); return snapshot(); }
    if (action === 'system:refresh') return background(refreshSystem());
    if (action === 'system:open') { checkObject(payload); const pages = { security: 'windowsdefender:', firewall: 'windowsdefender://network/', privacy: 'ms-settings:privacy', camera: 'ms-settings:privacy-webcam', microphone: 'ms-settings:privacy-microphone' }; const url = Object.hasOwn(pages, payload.page) ? pages[payload.page] : null; if (!url) throw new Error('Unknown Windows settings page'); await shell.openExternal(url); return {}; }
    if (action === 'app:open-data') { const error = await shell.openPath(dataDir); if (error) throw new Error(error); return {}; }
    if (action === 'app:website') { await shell.openExternal('https://github.com/Androctonus08/VirusVaccine'); return {}; }
    throw new Error('Unsupported action');
  }
  async function initialize() {
    await fs.mkdir(dataDir, { recursive: true }); store = new Store(dataDir); await store.load();
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows secure storage is unavailable. Quarantine cannot be initialized safely.');
    const keyFile = path.join(dataDir, 'quarantine-key.dpapi'); let encryptionKey;
    try { encryptionKey = Buffer.from((await safeStorage.decryptStringAsync(await fs.readFile(keyFile))).result, 'base64'); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('The quarantine key cannot be decrypted for this Windows user. Preserve your data folder.'); encryptionKey = randomBytes(32); await fs.writeFile(keyFile, await safeStorage.encryptStringAsync(encryptionKey.toString('base64')), { flag: 'wx', mode: 0o600 }); }
    quarantine = new Quarantine(path.join(dataDir, 'quarantine'), encryptionKey, protectedRoots); await quarantine.load();
    engine = new Engine(runtime, value => { if (value && typeof value === 'object') engineState = value; emit(); }); engineState = await engine.status();
    scanner = new Scanner({ engine, workDir: path.join(dataDir,'scan-work'), excluded: [dataDir,runtime], onChange: () => emit(), onComplete: async result => {
      store.data.history.unshift({ ...result, threats: result.detections.length }); store.data.history = store.data.history.slice(0, 50);
      store.activity(result.status === 'completed' ? 'Scan completed' : `Scan ${result.status}`, `${result.scanned} files checked · ${result.detections.length} detections · ${result.skipped} skipped`);
      await store.save(); emit();
      if (result.detections.length && Notification.isSupported()) new Notification({ title: 'VirusVaccine found a suspicious file', body: 'Open VirusVaccine to review the findings. No file has been moved automatically.' }).on('click', showWindow).show();
    } });
    media = new Media(path.join(runtime,'media'),()=>emit());
    await media.status();
    initialized = true; await setWatchers(); background(refreshSystem()); background(refreshProtection()); emit();
    automationTimer = setInterval(() => { background(automate()); }, 15000);
  }
  app.whenReady().then(async () => {
    window = new BrowserWindow({ width: 1240, height: 850, minWidth: 900, minHeight: 680, title: 'VirusVaccine', backgroundColor: '#f4f7fb', autoHideMenuBar: true,
      icon: path.join(__dirname,'../renderer/assets/icon.ico'), webPreferences: { preload: path.join(__dirname,'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== entryUrl) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
    ipcMain.handle('vaccine:action', async (event, action, payload) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== entryUrl) throw new Error('Untrusted request');
      if (typeof action !== 'string' || action.length > 50 || JSON.stringify(payload ?? null).length > 8192) throw new Error('Invalid request');
      try { return await handle(action, payload); } catch (error) { failure(error); throw new Error(error.message); }
    });
    window.on('close', event => {
      if (!quitting && (scanner?.running || engineState.busy || media?.state.busy || firewallBusy || store?.data?.watch.enabled || store?.data?.schedule.enabled)) {
        event.preventDefault(); window.hide();
        if (!backgroundNoticeShown && Notification.isSupported()) { backgroundNoticeShown = true; new Notification({ title: 'VirusVaccine is running in the tray', body: 'Use the tray menu to open or quit. Scans and enabled monitoring continue while it is running.' }).on('click',showWindow).show(); }
      }
    });
    const icon = nativeImage.createFromPath(path.join(__dirname,'../renderer/assets/icon.ico'));
    if (!icon.isEmpty()) { tray = new Tray(icon); tray.setToolTip('VirusVaccine · independent malware scanner'); tray.setContextMenu(Menu.buildFromTemplate([{ label:'Open VirusVaccine',click:showWindow },{ type:'separator' },{ label:'Quit VirusVaccine',click:() => app.quit() }])); tray.on('double-click',showWindow); }
    await window.loadFile(entry);
    try { await initialize(); } catch (error) { failure(error); }
  }).catch(error => { dialog.showErrorBox('VirusVaccine could not start', error.message); app.quit(); });
  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { quitting = true; clearInterval(automationTimer); stopWatchers(); scanner?.cancel(); engine?.cancel(); media?.cancel(); });
}

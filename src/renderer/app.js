'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const NS = 'http://www.w3.org/2000/svg';
  const paths = {
    grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
    scan: ['M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5', 'M8 12l3 3 5-6'],
    shield: ['M12 3 4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6l-8-3Z', 'm8 12 3 3 5-6'],
    quarantine: ['M5 8h14v13H5z', 'M3 3h18v5H3z', 'M10 12h4'],
    history: ['M3 11a9 9 0 1 1 2.8 7', 'M3 4v7h7', 'M12 7v6l4 2'],
    automation: ['M12 8v4l3 2', 'M12 3a9 9 0 1 1-9 9', 'M3 3v6h6'],
    device: ['M3 4h18v13H3z', 'M8 21h8', 'M12 17v4'],
    folder: ['M3 5h6l2 3h10v12H3z'],
    file: ['M6 3h8l4 4v14H6z', 'M14 3v5h4', 'M9 12h6M9 16h4'],
    bolt: ['m13 2-9 12h7l-1 8L21 9h-8l1-7Z'],
    arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
    refresh: ['M20 8a8 8 0 0 0-14-3L3 8', 'M3 3v5h5', 'M4 16a8 8 0 0 0 14 3l3-3', 'M16 16h5v5'],
    download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 17v4h16v-4'],
    upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 17v4h16v-4'],
    check: ['m5 12 4 4L19 6'],
    info: ['M12 17v-5', 'M12 8h.01'],
    warning: ['m12 3 10 18H2L12 3Z', 'M12 9v5', 'M12 18h.01'],
    close: ['m6 6 12 12M6 18 18 6'],
    trash: ['M3 6h18', 'M9 6V3h6v3', 'M5 6l1 15h12l1-15', 'M10 10v7M14 10v7'],
    restore: ['M3 10h7', 'M3 10V3', 'M4 9a8 8 0 1 1 0 7'],
    plus: ['M12 5v14M5 12h14'],
    external: ['M14 3h7v7', 'm21 3-11 11', 'M10 3H3v18h18v-7'],
    lock: ['M5 10h14v11H5z', 'M8 10V6a4 4 0 0 1 8 0v4', 'M12 14v3'],
    eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z'],
    stop: ['M6 6h12v12H6z'],
    heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
    network: ['M12 3v7', 'M5 15v-5h14v5', 'M2 15h6v6H2z', 'M16 15h6v6h-6z'],
    circle: [],
  };
  function icon(name, size = 19) {
    const svg = document.createElementNS(NS, 'svg');
    Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.65', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }).forEach(([key, value]) => svg.setAttribute(key, value));
    if (name === 'info' || name === 'circle' || name === 'eye') {
      const circle = document.createElementNS(NS, 'circle');
      Object.entries({ cx: 12, cy: 12, r: name === 'eye' ? 3 : 9 }).forEach(([key, value]) => circle.setAttribute(key, value));
      svg.append(circle);
    }
    for (const d of paths[name] || paths.shield) { const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); svg.append(path); }
    return svg;
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }
  function append(parent, ...children) { children.filter(Boolean).flat().forEach((child) => parent.append(child)); return parent; }
  function button(label, options = {}) {
    const element = node('button', options.className || 'button', undefined);
    element.type = 'button';
    if (options.icon) element.append(icon(options.icon, options.iconSize || 15));
    element.append(node('span', '', label));
    element.disabled = !!options.disabled;
    if (options.key) element.dataset.focus = options.key;
    if (options.title) element.title = options.title;
    if (options.onClick) element.addEventListener('click', options.onClick);
    return element;
  }
  function pill(text, tone = '', dot = false) { return append(node('span', `pill ${tone}`), dot ? node('span', 'pill-dot') : null, node('span', '', text)); }
  function tileIcon(name, tone = '') { return append(node('div', `tile-icon ${tone}`), icon(name, 20)); }
  function heading(title, description, trailing) { return append(node('div', 'page-heading'), append(node('div'), node('h1', '', title), description ? node('p', '', description) : null), trailing); }
  function sectionHeading(title, description, trailing) { return append(node('div', 'section-heading'), append(node('div'), node('h2', '', title), description ? node('p', '', description) : null), trailing); }
  function notice(text, tone = '', symbol = 'info') { return append(node('div', `notice ${tone}`), icon(symbol, 17), node('p', '', text)); }
  function empty(title, description, symbol, action) { return append(node('div', 'empty-state'), append(node('div', 'empty-icon'), icon(symbol, 27)), node('h3', '', title), node('p', '', description), action); }
  function metric(label, value, symbol, tone = '') { return append(node('div', 'card metric-card'), tileIcon(symbol, tone), append(node('div'), node('strong', '', value), node('p', '', label))); }
  function statusRow(label, value, symbol) { return append(node('div', 'status-row'), append(node('span', 'status-label'), symbol ? icon(symbol, 14) : null, node('span', '', label)), value instanceof Node ? value : node('span', 'status-value', value)); }
  function number(value) { return Number(value || 0).toLocaleString(); }
  function date(value, full = false) { if (!value) return 'Not yet'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'Unavailable' : parsed.toLocaleString(undefined, full ? { dateStyle: 'medium', timeStyle: 'short' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function elapsed(value) { const seconds = Math.floor((Number(value) || 0) / 1000); if (seconds < 60) return `${seconds}s`; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`; }
  function bytes(value) { const size = Number(value || 0); if (size < 1024) return `${size} B`; if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`; return `${(size / 1048576).toFixed(1)} MB`; }
  function filename(path) { return String(path || 'Unknown file').split(/[\\/]/).pop() || String(path); }
  function modeLabel(mode) { return ({ quick: 'Quick scan', full: 'Full scan', file: 'File scan', folder: 'Folder scan', custom: 'Custom scan', watch: 'Folder watch', scheduled: 'Scheduled scan' })[mode] || 'Scan'; }
  const defaults = { version: '0.1.0', engine: { installed: false, ready: false, busy: false, message: 'Install the scanning engine to begin' }, scan: { status: 'idle', scanned: 0, total: 0, skipped: 0, errors: 0, detections: [] }, history: [], quarantine: [], watch: { enabled: false, folders: [], message: 'Off' }, schedule: { enabled: false, hour: 12 }, system: { antivirus: [], firewall: [], message: 'Checking Windows security status' }, activities: [], notice: null };
  let state = defaults;
  let loaded = false;
  let route = 'overview';
  let lastNotice = '';
  let toastTimer;
  const pending = new Set();
  const routes = [ ['overview', 'Overview', 'grid'], ['scan', 'Scan center', 'scan'], ['quarantine', 'Quarantine', 'quarantine'], ['history', 'Scan history', 'history'], ['automation', 'Automation', 'automation'], ['system', 'System security', 'device'] ];
  const pageNames = Object.fromEntries([...routes, ['about', 'About VirusVaccine']]);
  const main = $('#main');
  const activeScan = () => ['running', 'starting', 'preparing', 'enumerating', 'scanning', 'finishing', 'cancelling'].includes(state.scan.status);
  const canScan = () => state.engine.ready && !state.engine.busy && !activeScan() && !pending.has('scan:start');
  const canManageEngine = () => !state.engine.busy && !activeScan() && !pending.has('engine:install') && !pending.has('engine:update');

  function notify(message, error = false) {
    clearTimeout(toastTimer);
    const toast = append(node('div', `toast${error ? ' error' : ''}`), icon(error ? 'warning' : 'info', 17), node('span', '', message));
    const close = button('', { className: 'icon-button', icon: 'close', onClick: () => $('#notifications').replaceChildren() });
    close.setAttribute('aria-label', 'Dismiss notification');
    toast.append(close); $('#notifications').replaceChildren(toast);
    if (!error) toastTimer = setTimeout(() => $('#notifications').replaceChildren(), 7000);
  }
  function applyState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    state = { ...defaults, ...snapshot, engine: { ...defaults.engine, ...snapshot.engine }, scan: { ...defaults.scan, ...snapshot.scan }, watch: { ...defaults.watch, ...snapshot.watch }, schedule: { ...defaults.schedule, ...snapshot.schedule }, system: { ...defaults.system, ...snapshot.system } };
    loaded = true;
    const noticeKey = JSON.stringify(state.notice);
    if (state.notice && noticeKey !== lastNotice) notify(typeof state.notice === 'string' ? state.notice : state.notice.message || 'Application status changed', state.notice.type === 'error');
    lastNotice = noticeKey;
    render();
  }
  async function invoke(action, payload, success) {
    if (!window.vaccine) { notify('The desktop connection is unavailable. Open VirusVaccine from the installed desktop app.', true); return null; }
    if (pending.has(action)) return null;
    pending.add(action); render();
    try {
      const result = await window.vaccine.invoke(action, payload);
      if (result?.ok === false || result?.error) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'The operation could not be completed.');
      if (result?.engine && result?.scan) applyState(result);
      if (result?.cancelled) return result;
      if (success) notify(success);
      if (action !== 'state:get') applyState(await window.vaccine.invoke('state:get'));
      return result;
    } catch (error) {
      notify(String(error?.message || error).replace(/^Error invoking remote method '[^']+': Error: /, ''), true);
      return null;
    } finally { pending.delete(action); render(); }
  }
  function navigate(next) {
    if (!pageNames[next]) next = 'overview';
    route = next; window.location.hash = next; render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0);
  }
  for (const [key, label, symbol] of routes) {
    const item = button(label, { className: 'nav-item', icon: symbol, key: `nav-${key}`, onClick: () => navigate(key) });
    item.dataset.route = key; item.title = label; $('#navigation').append(item);
  }
  $('#about-link').addEventListener('click', () => navigate('about'));
  $('#refresh-button').append(icon('refresh', 17));
  $('#refresh-button').addEventListener('click', () => invoke('state:get'));
  $('.skip-link').addEventListener('click', (event) => { event.preventDefault(); main.focus(); main.scrollIntoView({ block: 'start' }); });
  window.addEventListener('hashchange', () => { route = pageNames[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'overview'; render(); });
  route = pageNames[window.location.hash.slice(1)] ? window.location.hash.slice(1) : 'overview';

  function heroArt() {
    const wrapper = node('div', 'hero-art'); wrapper.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 205 190'); svg.setAttribute('class', 'hero-graphic');
    const shape = (tag, attributes) => { const element = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value); svg.append(element); return element; };
    shape('circle', { cx: 105, cy: 96, r: 83, class: 'orbit' }); shape('circle', { cx: 105, cy: 96, r: 63, class: 'orbit' }); shape('circle', { cx: 105, cy: 96, r: 45, fill: '#e7f1ff' });
    shape('path', { d: 'M105 35 150 52v36c0 29-23 48-45 59-23-11-45-30-45-59V52l45-17Z', fill: '#d9e8fa', transform: 'translate(0 10)' });
    shape('path', { d: 'M105 28 150 45v36c0 29-23 48-45 59-23-11-45-30-45-59V45l45-17Z', fill: '#1768d4' });
    shape('path', { d: 'M105 40 140 53v28c0 23-17 39-35 48-18-9-35-25-35-48V53l35-13Z', fill: '#2987e2' });
    shape('path', { d: 'm86 80 14 15 26-34', fill: 'none', stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    shape('rect', { x: 157, y: 40, width: 27, height: 28, rx: 8, class: 'satellite' }); shape('path', { d: 'm164 54 4 4 7-9', class: 'small-check' });
    shape('rect', { x: 16, y: 104, width: 31, height: 31, rx: 9, class: 'satellite' }); shape('path', { d: 'M27 115v9h10v-9M29 115v-3a3 3 0 0 1 6 0v3', fill: 'none', stroke: '#7e9fc4', 'stroke-width': 1.8, 'stroke-linejoin': 'round' });
    shape('circle', { cx: 155, cy: 157, r: 5, fill: '#d3e5fc' }); shape('circle', { cx: 49, cy: 29, r: 3, fill: '#a9c9ef' }); shape('circle', { cx: 188, cy: 111, r: 3, fill: '#a6d6d1' });
    return append(wrapper, svg);
  }
  function engineLabel() { return state.engine.busy ? 'Engine working' : activeScan() ? 'Scan in progress' : state.engine.ready ? 'Scanner ready' : state.engine.installed ? 'Setup needed' : 'Setup required'; }
  function progressBar(percent, indeterminate = false) {
    const track = node('div', 'progress-track'); track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', 'Operation progress'); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100');
    const bar = node('div', `progress-bar${indeterminate ? ' indeterminate' : ''}`);
    if (!indeterminate) { const bounded = Math.max(0, Math.min(100, Number(percent) || 0)); bar.style.setProperty('--progress', `${bounded}%`); track.setAttribute('aria-valuenow', String(Math.round(bounded))); }
    return append(track, bar);
  }
  function enginePanel() {
    const box = node('section', 'card');
    const actions = node('div', 'engine-actions');
    if (!state.engine.installed) actions.append(button(state.engine.busy ? 'Installing…' : 'Set up engine', { icon: 'download', key: 'engine-install', disabled: !canManageEngine(), onClick: () => invoke('engine:install') }));
    else actions.append(button(state.engine.busy ? 'Working…' : 'Update definitions', { className: 'button secondary', icon: 'refresh', key: 'engine-update', disabled: !canManageEngine(), onClick: () => invoke('engine:update') }));
    append(box, append(node('div', 'engine-panel'), append(node('div', 'engine-info'), tileIcon('shield'), append(node('div'), node('h3', '', 'ClamAV scanning engine'), node('p', '', state.engine.message || (state.engine.ready ? 'Ready for on-demand file scanning' : 'Complete setup before scanning')))), actions));
    if (state.engine.busy) {
      const progress = state.engine.progress;
      const value = typeof progress === 'number' ? progress : progress?.percent;
      append(box, append(node('div', 'progress-section'), progressBar(value, value === undefined || value === null), node('p', 'engine-progress-caption', 'Downloads and definition updates may take a few minutes.')));
    }
    return box;
  }
  function scanOption(mode, compact = false) {
    const options = { quick: ['Quick scan', 'Check common user locations where downloaded files arrive.', 'bolt', '', 'Start quick scan'], full: ['Full scan', 'Choose a drive or folder to inspect its accessible files.', 'device', 'purple', 'Choose scan location'], file: ['Scan a file', 'Get a second look at a download or suspicious file.', 'file', 'teal', 'Choose a file'], folder: ['Scan a folder', 'Inspect a folder and the files inside its subfolders.', 'folder', 'purple', 'Choose a folder'] };
    const [title, description, symbol, tone, label] = options[mode];
    const box = append(node('div', 'card scan-option'), tileIcon(symbol, tone), append(node('div'), node('h3', '', title), node('p', '', description)));
    if (compact) append(box, append(node('div', 'arrow-top'), icon('arrow', 16)));
    append(box, button(label, { className: compact ? 'link-button' : 'button secondary small', icon: compact ? null : symbol, key: `scan-${mode}`, disabled: !canScan(), title: !state.engine.ready ? 'Set up the engine before scanning' : activeScan() ? 'Wait for the current scan to finish' : '', onClick: () => invoke('scan:start', { mode }) }));
    return box;
  }
  function renderOverview() {
    const view = document.createDocumentFragment();
    append(view, heading('Your security workspace', 'A little attention today. More confidence in every file.', pill(engineLabel(), state.engine.ready ? 'blue' : 'amber', true)));
    const hero = node('section', 'hero');
    const title = state.engine.busy ? 'Getting your scanner ready.' : state.engine.ready ? 'Your next scan starts here.' : state.engine.installed ? 'Refresh your threat definitions.' : 'A fresh start for safer files.';
    const description = state.engine.busy ? (state.engine.message || 'Installing the independent ClamAV engine and its threat definitions.') : state.engine.ready ? 'Scan the files that matter with an independent malware engine. You choose what to check and what happens next.' : state.engine.installed ? (state.engine.message || 'Your engine is installed. Update its threat definitions before starting your next scan.') : 'Set up your independent malware scanner, then inspect downloads, documents, and drives. Your files stay on this computer.';
    const copy = append(node('div', 'hero-copy'), node('div', 'eyebrow', 'MEET YOUR INDEPENDENT SCANNER'), node('h2', '', title), node('p', '', description));
    if (state.engine.busy) append(copy, button('View engine progress', { icon: 'arrow', onClick: () => navigate('scan') }));
    else if (state.engine.ready) append(copy, button(activeScan() ? 'View current scan' : 'Start quick scan', { icon: activeScan() ? 'scan' : 'bolt', key: 'hero-primary', disabled: !activeScan() && !canScan(), onClick: () => activeScan() ? navigate('scan') : invoke('scan:start', { mode: 'quick' }) }));
    else append(copy, button(state.engine.installed ? 'Update threat definitions' : 'Set up VirusVaccine', { icon: 'download', key: 'hero-primary', disabled: !canManageEngine(), onClick: () => invoke(state.engine.installed ? 'engine:update' : 'engine:install') }));
    append(hero, copy, heroArt()); append(view, hero);
    if (activeScan()) append(view, scanProgress());
    append(view, sectionHeading('Choose your next check', null, button('Scan center', { className: 'link-button', icon: 'arrow', onClick: () => navigate('scan') })), append(node('div', 'scan-options'), scanOption('quick', true), scanOption('file', true), scanOption('folder', true)));
    const engine = append(node('section', 'card info-card'), append(node('div', 'card-title-row'), node('h2', '', 'Scanner status'), pill(state.engine.ready ? 'Ready' : 'Not ready', state.engine.ready ? 'blue' : 'amber')), statusRow('Scanning engine', state.engine.version || 'Not installed', 'shield'), statusRow('Threat definitions', date(state.engine.definitionsUpdatedAt), 'refresh'), statusRow('Folder watch', state.watch.enabled ? 'Watching selected folders' : 'Off', 'eye'), node('p', 'card-footnote', 'On-demand detection. No real-time execution blocking.'));
    const latest = state.history[0];
    const activity = append(node('section', 'card info-card'), append(node('div', 'card-title-row'), node('h2', '', 'Your last scan'), button('View history', { className: 'link-button', onClick: () => navigate('history') })));
    if (latest) append(activity, statusRow(modeLabel(latest.mode), historyStatus(latest)), statusRow('Files checked', number(latest.scanned), 'file'), statusRow('Detections', number(latest.threats), 'scan'), node('p', 'card-footnote', date(latest.finishedAt || latest.startedAt, true)));
    else append(activity, append(node('p', 'empty-inline'), icon('history', 18), node('span', '', 'Your scan history starts here.')), node('p', 'card-footnote', 'Run your first scan to see its results, file count, and time. No files have been checked yet.'));
    append(view, sectionHeading('At a glance'), append(node('div', 'two-columns'), engine, activity));
    return view;
  }
  function historyStatus(item) {
    const partial = item.status === 'partial' || (item.status === 'completed' && (item.skipped > 0 || item.errors > 0));
    const status = partial ? 'Partial' : ({ completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed', running: 'Running' })[item.status] || item.status || 'Unknown';
    return pill(status, partial || item.status === 'cancelled' ? 'amber' : item.status === 'failed' ? 'red' : 'blue');
  }
  function scanProgress() {
    const scan = state.scan; const running = activeScan();
    const title = running ? scan.status === 'cancelling' ? 'Stopping your scan…' : `${modeLabel(scan.mode)} in progress` : `${modeLabel(scan.mode)} ${scan.status === 'completed' ? 'completed' : scan.status || ''}`;
    const box = node('section', 'card scan-progress');
    const spinner = tileIcon(running ? 'scan' : 'file');
    const controls = running ? button('Stop scan', { className: 'button secondary small', icon: 'stop', key: 'cancel-scan', disabled: scan.status === 'cancelling' || pending.has('scan:cancel'), onClick: () => invoke('scan:cancel') }) : button('Export report', { className: 'button secondary small', icon: 'download', key: 'export-current', disabled: pending.has('scan:export'), onClick: () => invoke('scan:export', undefined, 'Scan report exported.') });
    append(box, append(node('div', 'progress-heading'), append(node('div'), spinner, append(node('div'), node('h2', '', title), node('p', '', scan.message || (running ? 'Checking accessible files with ClamAV' : 'Review scan coverage and any detections below')))), controls));
    if (running) append(box, progressBar(scan.total > 0 ? scan.scanned / scan.total * 100 : null, !scan.total));
    const stats = node('div', 'scan-stats');
    for (const [label, value, warning] of [['Files checked', number(scan.scanned)], ['Detections', number(scan.detections.length), scan.detections.length > 0], ['Skipped / errors', `${number(scan.skipped)} / ${number(scan.errors)}`, scan.skipped > 0 || scan.errors > 0], ['Elapsed time', elapsed(scan.elapsedMs)]]) append(stats, append(node('div', `scan-stat${warning ? ' warning' : ''}`), node('strong', '', value), node('span', '', label)));
    append(box, stats);
    if (running && scan.current) append(box, append(node('div', 'current-file'), icon('file', 13), node('span', '', scan.current)));
    if (!running) {
      const partial = scan.status !== 'completed' || scan.skipped > 0 || scan.errors > 0;
      append(box, node('p', 'card-footnote', scan.detections.length ? 'Detections need your review. Files are not quarantined automatically.' : partial ? 'This scan did not check every file. Review skipped files and errors; it cannot establish that the selected location is free of malware.' : 'No detections in the files checked. A scan cannot guarantee that a file or computer is free of malware.'));
    }
    return box;
  }
  function renderScan() {
    const view = document.createDocumentFragment();
    append(view, heading('Scan center', 'Choose what to inspect. Review every result. Keep control of your files.', pill(engineLabel(), state.engine.ready ? 'blue' : 'amber', true)), enginePanel());
    if (state.scan.status !== 'idle') append(view, scanProgress());
    if (state.scan.detections.length) append(view, sectionHeading('Detections', 'Review each detection before deciding whether to quarantine it.'), detectionTable());
    append(view, sectionHeading('Start a scan', 'Only accessible files are checked. Large, encrypted, or inaccessible files may be skipped.'), append(node('div', 'all-scan-options'), scanOption('quick'), scanOption('full'), scanOption('file'), scanOption('folder')));
    return view;
  }
  function table(headers, rows) {
    const element = node('table'); const head = node('thead'); const headingRow = node('tr');
    headers.forEach((text) => { const th = node('th', '', text); th.scope = 'col'; headingRow.append(th); }); head.append(headingRow);
    const body = node('tbody'); rows.forEach((cells) => { const tr = node('tr'); cells.forEach((value) => { const cell = node('td'); cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? ''))); tr.append(cell); }); body.append(tr); });
    return append(node('div', 'card table-card'), append(node('div', 'table-wrap'), append(element, head, body)));
  }
  function fileCell(path, detail) { const name = node('strong', 'file-label', filename(path)); name.title = String(path); const sub = node('span', 'file-path', detail || path); sub.title = String(detail || path); return append(node('div'), name, sub); }
  function detectionTable() {
    return table(['Detected file', 'Engine detection', 'Action'], state.scan.detections.map((item) => [fileCell(item.path, item.path), append(node('div'), node('strong', '', item.name), node('span', 'file-path', bytes(item.size))), item.quarantined ? pill('Quarantined', 'blue') : button('Quarantine', { className: 'button secondary small', icon: 'quarantine', key: `quarantine-${item.id}`, disabled: activeScan() || pending.has('quarantine:add'), onClick: () => invoke('quarantine:add', { id: item.id }, 'File moved to encrypted quarantine.') })]));
  }
  function renderQuarantine() {
    const view = document.createDocumentFragment();
    append(view, heading('Quarantine', 'An encrypted local vault for files you choose to isolate.', pill(`${number(state.quarantine.length)} ${state.quarantine.length === 1 ? 'file' : 'files'}`, 'blue')), notice('Restore only files you trust. You choose a restore location; the encrypted copy stays in this vault until you delete it. Deleting a vault copy does not remove any restored copies.', 'amber', 'warning'));
    if (!state.quarantine.length) return append(view, append(node('section', 'card'), empty('Nothing in quarantine', 'Files appear here after you review a scan detection and choose Quarantine. An empty vault does not indicate your computer is protected.', 'quarantine', button('Open scan center', { className: 'button secondary', icon: 'scan', onClick: () => navigate('scan') }))));
    if (state.quarantine.some((item) => item.sourceRemoved !== true)) append(view, notice('Some entries are recovery copies only: removal of the original file was not confirmed. Those source files may still be present and must not be considered isolated.', 'red', 'warning'));
    append(view, table(['File / detection', 'Vault status', 'Size', 'Actions'], state.quarantine.map((item) => [fileCell(item.originalPath, item.name), append(node('div'), pill(item.sourceRemoved === true ? 'Source removed' : 'Recovery copy only', item.sourceRemoved === true ? 'blue' : 'amber'), node('span', 'file-path', item.error || (item.lastRestoredAt ? `Copy restored ${date(item.lastRestoredAt)}` : date(item.createdAt)))), bytes(item.size), append(node('div', 'table-actions'), button('Restore', { className: 'button secondary small', icon: 'restore', key: `restore-${item.id}`, disabled: activeScan() || pending.has('quarantine:restore'), onClick: () => invoke('quarantine:restore', { id: item.id }, 'File restored to your chosen location. Its encrypted vault copy was retained.') }), button('Delete', { className: 'button ghost-danger small', icon: 'trash', key: `delete-${item.id}`, disabled: activeScan() || pending.has('quarantine:delete'), onClick: () => invoke('quarantine:delete', { id: item.id }, 'Encrypted vault copy permanently deleted.') }))])));
    return view;
  }
  function renderHistory() {
    const view = document.createDocumentFragment();
    const completed = state.history.filter((item) => item.status === 'completed' && !item.skipped && !item.errors).length;
    append(view, heading('Scan history', 'The checks you ran, the files inspected, and the coverage of each scan.', button('Export report', { className: 'button secondary', icon: 'download', key: 'export-history', disabled: !state.history.length || pending.has('scan:export'), onClick: () => invoke('scan:export', undefined, 'Scan report exported.') })), append(node('div', 'stat-strip'), metric('Recorded scans', number(state.history.length), 'history'), metric('Completed without skips', number(completed), 'check', 'teal'), metric('Total recorded detections', number(state.history.reduce((sum, item) => sum + Number(item.threats || 0), 0)), 'scan', 'purple')));
    if (!state.history.length) append(view, append(node('section', 'card'), empty('A new chapter for your files', 'Run your first scan to build a useful record. Completed, partial, stopped, and failed scans appear here.', 'history', button('Start a scan', { icon: 'scan', onClick: () => navigate('scan') }))));
    else append(view, table(['Scan', 'Status', 'Checked', 'Detections', 'Skipped / errors', 'Duration'], state.history.map((item) => [append(node('div'), node('strong', '', modeLabel(item.mode)), node('span', 'file-path', date(item.startedAt))), historyStatus(item), number(item.scanned), number(item.threats), `${number(item.skipped)} / ${number(item.errors)}`, elapsed(item.elapsedMs)])));
    if (state.activities.length) {
      append(view, sectionHeading('Recent activity'));
      const list = node('div', 'card activity-list');
      state.activities.slice(0, 12).forEach((item) => append(list, append(node('div', 'activity-item'), node('span'), append(node('div'), node('strong', '', typeof item === 'string' ? item : item.title || item.message || item.action || item.type || 'Application activity'), item.detail ? node('p', 'card-footnote', item.detail) : null, node('small', '', date(item.at || item.createdAt || item.timestamp))))));
      append(view, list);
    }
    return view;
  }
  function toggle(label, enabled, callback, key, disabled = false) {
    const element = node('button', 'toggle'); element.type = 'button'; element.setAttribute('role', 'switch'); element.setAttribute('aria-checked', String(!!enabled)); element.setAttribute('aria-label', label); element.dataset.focus = key; element.disabled = disabled; element.addEventListener('click', () => callback(!enabled)); return element;
  }
  function renderAutomation() {
    const view = document.createDocumentFragment();
    append(view, heading('A helpful routine', 'Optional checks for the places and times that work for you.'), notice('Automation runs only while VirusVaccine is open. Folder watch scans after files change; it does not block file execution or replace real-time antivirus.'));
    const watch = node('section', 'card setting-block');
    append(watch, append(node('div', 'setting-row'), append(node('div'), node('h2', '', 'Watch selected folders'), node('p', '', 'Check new and changed files in folders you choose. Review any detections in Scan center.')), toggle('Enable folder watch', state.watch.enabled, (enabled) => invoke('watch:toggle', { enabled }), 'watch-toggle', pending.has('watch:toggle') || !state.engine.ready && !state.watch.enabled)));
    const folders = node('div', 'folder-list');
    if (!state.watch.folders.length) append(folders, node('p', 'empty-inline', 'No folders selected. Add a folder to get started.'));
    for (const path of state.watch.folders) append(folders, append(node('div', 'folder-row'), append(node('div', 'folder-name'), icon('folder', 17), node('span', '', path)), button('Remove', { className: 'link-button', key: `remove-folder-${path}`, disabled: pending.has('watch:remove'), onClick: () => invoke('watch:remove', { path }) })));
    append(watch, folders, button('Add a folder', { className: 'button secondary small', icon: 'plus', key: 'watch-add', disabled: pending.has('watch:add'), onClick: () => invoke('watch:add') }), node('p', 'setting-meta', state.watch.message || (state.watch.enabled ? 'Folder watch enabled while the app is open.' : 'Folder watch is off.')));
    const schedule = node('section', 'card setting-block');
    append(schedule, append(node('div', 'setting-row'), append(node('div'), node('h2', '', 'Daily quick scan'), node('p', '', 'Build a daily habit with a quick scan at your preferred hour. Your computer and the app must be running.')), toggle('Enable daily quick scan', state.schedule.enabled, (enabled) => invoke('schedule:set', { enabled, hour: state.schedule.hour }), 'schedule-toggle', pending.has('schedule:set') || !state.engine.ready && !state.schedule.enabled)));
    const label = node('label', '', 'Scan time'); label.htmlFor = 'schedule-hour';
    const select = node('select', 'select'); select.id = 'schedule-hour'; select.dataset.focus = 'schedule-hour';
    for (let hour = 0; hour < 24; hour++) { const option = node('option', '', new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })); option.value = String(hour); option.selected = hour === Number(state.schedule.hour); select.append(option); }
    select.disabled = pending.has('schedule:set');
    select.addEventListener('change', () => invoke('schedule:set', { enabled: state.schedule.enabled, hour: Number(select.value) }, 'Daily scan time saved.'));
    append(schedule, append(node('div', 'form-row'), label, select, node('span', 'muted', 'Local computer time')), node('p', 'setting-meta', `Last scheduled scan: ${date(state.schedule.lastRun, true)}`));
    append(view, watch, schedule);
    if (!state.engine.ready) append(view, notice('Set up the scanning engine before turning on automation.', 'amber'));
    return view;
  }
  function productName(item) { return typeof item === 'string' ? item : item.displayName || item.name || item.Name || item.profile || 'Windows-reported product'; }
  function renderSystem() {
    const view = document.createDocumentFragment();
    append(view, heading('Windows security, at a glance', 'Read-only information reported by Windows on this computer.', button('Refresh status', { className: 'button secondary', icon: 'refresh', key: 'system-refresh', disabled: pending.has('system:refresh'), onClick: () => invoke('system:refresh') })), notice('VirusVaccine does not change or disable your antivirus or firewall. Manage those protections in Windows Security or the application that provides them.'));
    const antivirus = append(node('section', 'card'), append(node('div', 'card-title-row'), node('h2', '', 'Registered antivirus'), pill(`${state.system.antivirus.length} reported`, 'blue')));
    if (!state.system.antivirus.length) append(antivirus, node('p', 'empty-inline', 'No product information available. This does not establish whether protection is enabled.'));
    state.system.antivirus.forEach((item) => append(antivirus, append(node('div', 'system-product'), append(node('div'), append(node('div', 'product-icon'), tileIcon('shield')), append(node('div'), node('h3', '', productName(item)), node('p', '', item.stateText || item.status || (item.productState !== undefined ? `Windows product state: ${item.productState}` : 'Registered with Windows Security Center')))), pill('Reported', 'blue'))));
    append(antivirus, button('Open Windows Security', { className: 'link-button', icon: 'external', key: 'open-security', onClick: () => invoke('system:open', { page: 'security' }) }));
    const firewall = append(node('section', 'card'), append(node('div', 'card-title-row'), node('h2', '', 'Windows firewall'), pill('Read only')));
    if (!state.system.firewall.length) append(firewall, node('p', 'empty-inline', 'Firewall profile information is unavailable. Check Windows Security for current settings.'));
    state.system.firewall.forEach((item) => { const enabled = item.enabled ?? item.Enabled; append(firewall, statusRow(productName(item), enabled === true || enabled === 1 ? pill('Enabled', 'blue') : enabled === false || enabled === 0 ? pill('Disabled', 'amber') : pill('Unknown'), 'network')); });
    append(firewall, button('Open firewall settings', { className: 'link-button', icon: 'external', key: 'open-firewall', onClick: () => invoke('system:open', { page: 'firewall' }) }));
    append(view, append(node('div', 'two-columns'), antivirus, firewall), node('p', 'card-footnote', state.system.message || 'Windows status is a point-in-time snapshot, not a verification of protection.'));
    return view;
  }
  function renderAbout() {
    const view = document.createDocumentFragment();
    append(view, heading('Built for a second look', 'Understand what VirusVaccine does—and where its protection ends.'));
    const card = node('section', 'card'); const image = node('img'); image.src = 'assets/logo.svg'; image.alt = ''; image.width = 54; image.height = 59;
    append(card, append(node('div', 'about-brand'), image, append(node('div'), node('h2', '', 'VirusVaccine'), node('p', '', `Version ${state.version} · Independent, open-source desktop scanner`))), node('p', 'about-text', 'VirusVaccine brings an independent ClamAV malware scanning engine into a clear, local desktop workspace. It can inspect accessible files, report engine detections, and isolate files you choose. It is an early release and has not been independently benchmarked against commercial antivirus suites.'), node('p', 'about-text', 'Your files stay on your computer. Engine setup and threat-definition updates require an internet connection. Scan results, settings, history, and the quarantine vault are stored locally. The application is not affiliated with or endorsed by McAfee. ClamAV® is a trademark of Cisco Systems, Inc.'));
    const list = node('div', 'capability-list');
    const capabilities = [['On-demand malware scans', 'Quick checks and file, folder, or selected drive scans powered by ClamAV signatures.', 'scan', true], ['Quarantine you control', 'Move detected files into a local vault, restore them, or permanently delete them.', 'quarantine', true], ['Optional automation', 'Check changed files in selected folders or run a daily quick scan while the app remains open.', 'automation', true], ['Transparent scan coverage', 'Review detected, skipped, and inaccessible files. Partial checks are never a guarantee of safety.', 'history', true], ['No real-time execution blocking', 'Folder watch checks after changes. No kernel driver, boot-time scanning, or ransomware behavior shield is installed.', 'lock', false], ['No VPN or identity monitoring', 'No VPN service, identity recovery, browser filtering, firewall enforcement, or commercial feature-parity claim.', 'network', false]];
    for (const [title, description, symbol, available] of capabilities) append(list, append(node('div', `capability${available ? '' : ' unavailable'}`), icon(symbol, 18), append(node('div'), node('h3', '', title), node('p', '', description))));
    append(card, list, append(node('div', 'about-actions'), button('View source on GitHub', { className: 'button secondary', icon: 'external', key: 'open-website', onClick: () => invoke('app:website') }), button('Open local app data', { className: 'button secondary', icon: 'folder', key: 'open-data', onClick: () => invoke('app:open-data') })));
    append(view, card); return view;
  }
  const renderers = { overview: renderOverview, scan: renderScan, quarantine: renderQuarantine, history: renderHistory, automation: renderAutomation, system: renderSystem, about: renderAbout };
  function render() {
    document.querySelectorAll('[data-route]').forEach((item) => { const active = item.dataset.route === route; item.classList.toggle('active', active); if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current'); });
    $('#page-name').textContent = pageNames[route]; $('#version').textContent = `OPEN SOURCE · V${state.version}`;
    if (!loaded) return;
    const focusKey = document.activeElement?.dataset.focus;
    const oldScroll = window.scrollY;
    main.replaceChildren(renderers[route]());
    if (focusKey) { const target = Array.from(document.querySelectorAll('[data-focus]')).find((element) => element.dataset.focus === focusKey); if (target && !target.disabled) target.focus({ preventScroll: true }); }
    if (window.scrollY !== oldScroll) window.scrollTo(0, oldScroll);
  }
  if (window.vaccine) {
    const unsubscribe = window.vaccine.subscribe(applyState);
    window.addEventListener('beforeunload', () => { if (typeof unsubscribe === 'function') unsubscribe(); }, { once: true });
    invoke('state:get');
  } else {
    loaded = true; render(); notify('Desktop connection unavailable. Run VirusVaccine as a desktop application to enable scanning.', true);
  }
})();

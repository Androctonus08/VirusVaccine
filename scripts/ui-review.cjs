'use strict';
// Renderer-only contract and visual checks. This never scans user files or downloads an engine.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const contract = require('../docs/ui-contract.json');

(async () => {
  const output = path.resolve(__dirname, '../review/private/renderer');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript((initial) => {
      window.reviewState = structuredClone(initial);
      window.reviewCalls = [];
      let callback;
      window.reviewPush = patch => { Object.assign(window.reviewState, patch); callback(structuredClone(window.reviewState)); };
      window.vaccine = {
        subscribe: cb => { callback = cb; return () => {}; },
        invoke: async (action, payload) => {
          window.reviewCalls.push({ action, payload });
          if (window.reviewFail === action) throw new Error('Test operation could not be completed.');
          if (action === 'state:get') return structuredClone(window.reviewState);
          if (action === 'watch:toggle') window.reviewState.watch.enabled = payload.enabled;
          if (action === 'schedule:set') Object.assign(window.reviewState.schedule, payload);
          if (action === 'watch:add') window.reviewState.watch.folders.push('C:\\Example folder');
          if (action === 'watch:remove') window.reviewState.watch.folders = window.reviewState.watch.folders.filter(p => p !== payload.path);
          return { started: true };
        }
      };
    }, contract.state);
    await page.goto(pathToFileURL(path.resolve(__dirname, '../src/renderer/index.html')).href);
    await expect(page.getByRole('heading', { name: 'Your security workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start quick scan', exact: true })).toBeDisabled();
    await page.screenshot({ path: path.join(output, '01-overview-1100.png'), fullPage: true });
    await page.getByRole('button', { name: 'Set up VirusVaccine' }).click();
    expect(await page.evaluate(() => window.reviewCalls.some(call => call.action === 'engine:install'))).toBe(true);
    await page.evaluate(() => window.reviewPush({ engine: { installed: true, ready: true, version: 'ClamAV 1.4.3', busy: false, definitionsUpdatedAt: new Date().toISOString(), message: 'Engine and definitions ready' }, system: { antivirus: [{ name: 'Example registered antivirus', productState: 266240 }], firewall: [{ name: 'Domain', enabled: true }, { name: 'Public', enabled: false }], message: 'Windows-reported state' } }));
    await page.getByRole('button', { name: 'Scan center', exact: true }).first().click();
    await page.locator('.skip-link').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#page-name')).toHaveText('Scan center');
    await expect(page.locator('main')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Start quick scan', exact: true })).toBeEnabled();
    for (const [label, mode] of [['Start quick scan', 'quick'], ['Choose scan location', 'full'], ['Choose a file', 'file'], ['Choose a folder', 'folder']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      expect(await page.evaluate(mode => window.reviewCalls.some(call => call.action === 'scan:start' && call.payload.mode === mode), mode)).toBe(true);
    }
    await page.evaluate(() => window.reviewPush({ scan: { ...window.reviewState.scan, id: 'scan-review', status: 'enumerating', mode: 'folder', startedAt: new Date().toISOString(), current: 'C:\\Samples\\<img src=x onerror="window.xss=true">.txt' } }));
    await expect(page.getByRole('button', { name: 'Stop scan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start quick scan', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Stop scan' }).click();
    expect(await page.evaluate(() => window.reviewCalls.some(call => call.action === 'scan:cancel'))).toBe(true);
    await page.evaluate(() => window.reviewPush({ scan: { ...window.reviewState.scan, status: 'partial', scanned: 42, skipped: 3, errors: 1, elapsedMs: 12800, message: 'Scan finished with coverage gaps.', detections: [{ id: 'review-detection', path: 'C:\\Samples\\<img src=x onerror="window.xss=true">.txt', name: '<script>window.xss=true</script>', size: 4000, quarantined: false }] }, history: [{ id: 'scan-review', mode: 'folder', status: 'partial', scanned: 42, skipped: 3, errors: 1, threats: 1, startedAt: new Date().toISOString(), elapsedMs: 12800 }] }));
    await expect(page.getByText('<script>window.xss=true</script>', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => !!window.xss)).toBe(false);
    await page.getByRole('button', { name: 'Quarantine', exact: true }).last().click();
    expect(await page.evaluate(() => window.reviewCalls.some(call => call.action === 'quarantine:add' && call.payload.id === 'review-detection'))).toBe(true);
    await page.screenshot({ path: path.join(output, '02-scan-results-1100.png'), fullPage: true });
    await page.evaluate(() => window.reviewPush({ quarantine: [{ id: 'review-vault', originalPath: 'C:\\Samples\\example.txt', name: 'Test.Signature', size: 4000, createdAt: new Date().toISOString(), sourceRemoved: false, error: 'Original removal not confirmed' }] }));
    await page.locator('#navigation').getByRole('button', { name: 'Quarantine', exact: true }).click();
    await expect(page.getByText('Recovery copy only', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    for (const action of ['quarantine:restore', 'quarantine:delete']) expect(await page.evaluate(action => window.reviewCalls.some(call => call.action === action && call.payload.id === 'review-vault'), action)).toBe(true);
    await page.getByRole('button', { name: 'Scan history', exact: true }).click();
    await expect(page.getByText('Partial', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Export report', exact: true }).click();
    expect(await page.evaluate(() => window.reviewCalls.some(call => call.action === 'scan:export'))).toBe(true);
    await page.getByRole('button', { name: 'Automation', exact: true }).click();
    await page.getByRole('button', { name: 'Add a folder' }).click();
    await expect(page.getByText('C:\\Example folder', { exact: true })).toBeVisible();
    await page.getByRole('switch', { name: 'Enable folder watch' }).click();
    await expect(page.getByRole('switch', { name: 'Enable folder watch' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('switch', { name: 'Enable daily quick scan' }).click();
    await page.getByLabel('Scan time').selectOption('17');
    expect(await page.evaluate(() => window.reviewState.schedule)).toMatchObject({ enabled: true, hour: 17 });
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page.getByText('C:\\Example folder', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'System security', exact: true }).click();
    await expect(page.getByText('Windows product state: 266240')).toBeVisible();
    await page.getByRole('button', { name: 'Open Windows Security' }).click();
    await page.getByRole('button', { name: 'Open firewall settings' }).click();
    await page.evaluate(() => { window.reviewFail = 'system:refresh'; });
    await page.getByRole('button', { name: 'Refresh status' }).click();
    await expect(page.getByText('Test operation could not be completed.')).toBeVisible();
    await page.getByRole('button', { name: 'About VirusVaccine', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No real-time execution blocking' })).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    for (const size of [{ width: 1100, height: 760 }, { width: 900, height: 680 }]) {
      await page.setViewportSize(size);
      for (const route of ['overview', 'scan', 'quarantine', 'history', 'automation', 'system', 'about']) {
        await page.evaluate(route => { window.location.hash = route; }, route);
        await expect(page.locator('#page-name')).toHaveText(({ overview: 'Overview', scan: 'Scan center', quarantine: 'Quarantine', history: 'Scan history', automation: 'Automation', system: 'System security', about: 'About VirusVaccine' })[route]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: path.join(output, `${route}-${size.width}.png`), fullPage: true });
      }
    }
    await page.evaluate(() => { window.location.hash = 'overview'; });
    await page.locator('main').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('BUTTON');
    expect(errors).toEqual([]);
    console.log('Renderer review passed: all routes at 1100/900px, action payloads, setup/partial/recovery/error states, text injection safety, keyboard focus, screenshots.');
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

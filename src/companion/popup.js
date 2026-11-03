'use strict';
const $ = id => document.getElementById(id);
function node(tag, text) { const result = document.createElement(tag); result.textContent = text; return result; }
function report(error) { $('error').textContent = error.message || String(error); }
let blocking = false;
async function refresh() { blocking = (await chrome.declarativeNetRequest.getEnabledRulesets()).includes('trackers'); $('blocking-status').textContent = blocking ? 'Blocking enabled in this browser' : 'Tracker blocking is paused'; $('blocking-toggle').textContent = blocking ? 'Pause blocking' : 'Enable blocking'; $('blocking-toggle').disabled = false; }
$('blocking-toggle').addEventListener('click', async () => { $('blocking-toggle').disabled = true; try { await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: blocking ? [] : ['trackers'], disableRulesetIds: blocking ? ['trackers'] : [] }); await refresh(); } catch (error) { report(error); $('blocking-toggle').disabled = false; } });
$('check').addEventListener('click', () => { $('error').textContent = ''; $('link-result').replaceChildren(); try { const result = VaccineChecks.analyzeUrl($('url').value); const box = node('div', ''); box.className = 'result'; box.append(node('strong', result.verdict), node('p', 'Actual hostname: ' + result.hostname)); const list = node('ul', ''); result.reasons.forEach(reason => list.append(node('li', reason))); box.append(list, node('p', result.limitation)); $('link-result').append(box); } catch (error) { report(error); } });
$('clean').addEventListener('click', () => { $('error').textContent = ''; $('link-result').replaceChildren(); try { const result = VaccineChecks.cleanUrl($('url').value); const field = node('textarea', ''); field.value = result.url; field.readOnly = true; field.setAttribute('aria-label', 'Cleaned link'); $('link-result').append(node('p', result.note), field); field.select(); } catch (error) { report(error); } });
$('cleanup').addEventListener('click', async () => {
  $('error').textContent = ''; $('cleanup-result').textContent = '';
  if (!$('confirm').checked) return report(new Error('Confirm the deletion before continuing.'));
  const data = {}; if ($('cache').checked) data.cache = true; if ($('cookies').checked) data.cookies = true;
  if (!Object.keys(data).length) return report(new Error('Select cached files or cookies.'));
  const duration = { hour: 3600000, day: 86400000, week: 604800000, all: 0 }[$('period').value];
  if (duration === undefined) return report(new Error('Choose a supported time range.'));
  $('cleanup').disabled = true; $('cleanup-result').textContent = 'Clearing selected data…';
  try { await chrome.browsingData.remove({ since: duration ? Date.now() - duration : 0, originTypes: { unprotectedWeb: true, protectedWeb: false, extension: false } }, data); $('cleanup-result').textContent = 'The browser completed the cleanup request. Other types of tracking data may remain.'; $('confirm').checked = false; } catch (error) { $('cleanup-result').textContent = ''; report(error); } finally { $('cleanup').disabled = false; }
});
// These labels describe the packaged rules; no downloaded list or telemetry.
for (const domain of ['doubleclick.net','google-analytics.com','googlesyndication.com','bat.bing.com','clarity.ms','hotjar.com','hotjar.io','api.mixpanel.com','api.segment.io','cdn.segment.com','scorecardresearch.com','ads-twitter.com']) $('domains').append(node('li', domain));
refresh().catch(report);

'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const checks = require('../companion/checks.js');
const providerUrls = Object.freeze({ wireguard: 'https://www.wireguard.com/install/', breaches: 'https://haveibeenpwned.com/NotifyMe', breachAccount: 'https://haveibeenpwned.com/', integrationDocs: 'https://github.com/Androctonus08/VirusVaccine/blob/main/docs/PROVIDERS.md' });
const companionFiles = ['manifest.json','checks.js','popup.html','popup.css','popup.js','trackers.json'];
async function exportCompanion(source, parent) {
  const destination = path.join(parent, 'VirusVaccineBrowser-0.2.0');
  // A new folder only: never merge with or replace an existing installation.
  await fs.mkdir(destination);
  for (const name of companionFiles) await fs.writeFile(path.join(destination, name), await fs.readFile(path.join(source, name)), { flag: 'wx' });
  return { path: destination };
}
function providerUrl(id) { if (!Object.hasOwn(providerUrls, id)) throw new Error('Unknown provider'); return providerUrls[id]; }
module.exports = { ...checks, exportCompanion, providerUrl };

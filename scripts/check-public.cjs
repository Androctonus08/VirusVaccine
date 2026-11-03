'use strict';
// Guard publication boundaries without storing private values in this file.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const disallowed = files.filter(file => /(^|\/)(private|review|\.runtime|node_modules)(\/|$)|(^|\/)\.env|\.(?:dpapi|vvq|p8|pfx|pem|key|cvd|cld|ndb)$/.test(file));
if (disallowed.length) throw new Error('Local or private artifacts are tracked: ' + disallowed.join(', '));
const scope = JSON.parse(fs.readFileSync('research/feature-matrix.json', 'utf8'));
const allowed = new Set(['schema_version', 'title', 'scope', 'features']);
if (Object.keys(scope).some(key => !allowed.has(key))) throw new Error('Feature scope must not contain machine observations');
const featureKeys = new Set(['id', 'name', 'implementation', 'design_requirement']);
if (scope.features.some(feature => Object.keys(feature).some(key => !featureKeys.has(key)))) throw new Error('Feature entries must contain design information only');
console.log('Public source excludes local reports, evidence, vaults and machine inventory.');

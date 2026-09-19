#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
let failures = 0;
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function sha(file) { return crypto.createHash('sha256').update(read(file)).digest('hex'); }
function assert(condition, message) {
  if (!condition) { failures += 1; console.error(`FAIL: ${message}`); }
  else console.log(`OK: ${message}`);
}
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const app = read('src/App.js');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const people = read('api/system-admin/people.js');
const peopleSearch = read('api/system-admin/people-search.js');
const workspaces = read('api/system-admin/workspaces.js');
const fakeProfile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
const auditHelpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
const routeMatrix = read('scripts/86chaos-release-gate/route-access-matrix.cjs');
const sinceRunner = read('scripts/run-tests-since-16-0-170.cjs');

assert(pkg.version === '16.0.192', 'package.json version is 16.0.192');
assert(lock.version === '16.0.192' && lock.packages?.['']?.version === '16.0.192', 'package-lock root versions are 16.0.192');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-192.js', 'test:source points to 16.0.192 validator');
assert(version.version === '16.0.192' && version.build === '16.0.192', 'public/version.json version/build are 16.0.192');
assert(version.releaseTitle === 'Failed Release Gate Blocker Repair', '16.0.192 release title is limited to failed release-gate repair');
assert(appCore.includes("CURRENT_VERSION = '16.0.192'"), 'app core CURRENT_VERSION is 16.0.192');
assert(apiVersion.includes("APP_VERSION = '16.0.192'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.192'"), 'api version reports 16.0.192');
assert(fs.existsSync(path.join(root, 'scripts/validate-16-0-192.js')), '16.0.192 validator exists');
assert(fs.existsSync(path.join(root, 'scripts/validate-16-0-191.js')), '16.0.191 validator was preserved');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

const switchBlock = app.match(/const switchWorkspace = \(workspace\) => \{[\s\S]*?addToast\('Workspace Switched'/)?.[0] || '';
assert(switchBlock.includes('transitionActiveTabState(nextDefaultTab);'), 'workspace switch uses canonical transitionActiveTabState helper');
assert(!/activeTabStateRef\.current = nextDefaultTab;\s*setActiveTabState\(nextDefaultTab\);/.test(switchBlock), 'workspace switch no longer bypasses schedule-builder query subtab setup');
assert(/if \(normalized === 'schedule'\)[\s\S]*setActiveScheduleSubTab\('schedule-builder'\)/.test(app), 'canonical route helper maps schedule to schedule-builder before render');

for (const [name, source, code, message] of [
  ['people', people, 'system-admin-people-failed', 'Could not load people.'],
  ['people-search', peopleSearch, 'system-admin-people-search-failed', 'Could not search people.'],
  ['workspaces', workspaces, 'system-admin-workspaces-failed', 'Could not load workspaces.'],
]) {
  assert(source.includes("if (req.method !== 'GET')"), `${name} method guard preserved`);
  assert(source.includes('try {') && source.includes('} catch (error) {'), `${name} has controlled unexpected-error boundary`);
  assert(source.includes(`code: '${code}'`) && source.includes(`error: '${message}'`), `${name} returns controlled public 500 shape`);
  assert(!/stack\s*:/.test(source), `${name} does not return stack traces`);
}

assert(/staff:\s*\[[^\]]*'hr-training'[^\]]*\]/s.test(routeMatrix), 'staff route matrix includes hr-training');
assert(fakeProfile.includes('validAllenCurrentWeekShifts') && fakeProfile.includes("date !== tomorrowStr") && fakeProfile.includes('QA fixture requires a valid Allen QA shift date distinct from Sara QA conflict date.'), 'Allen Request Off fixture derives from a real valid Allen shift distinct from Sara conflict');
assert(auditHelpers.includes('\\bInvalid Date\\b(?!s)'), 'BAD_VALUE_RE distinguishes literal Invalid Date from invalid dates prose');

assert(fs.existsSync(path.join(root, 'api/release-gate-16-0-192-source-regressions.test.cjs')), '16.0.192 source regression exists');
assert(fs.existsSync(path.join(root, 'api/system-admin-controlled-errors-16-0-192.test.cjs')), '16.0.192 System Admin controlled error regression exists');
assert(sinceRunner.includes('api/release-gate-16-0-192-source-regressions.test.cjs'), 'targeted runner includes 16.0.192 source regression');
assert(sinceRunner.includes('api/system-admin-controlled-errors-16-0-192.test.cjs'), 'targeted runner includes 16.0.192 System Admin controlled error regression');

if (failures) {
  console.error(`16.0.192 source validation failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log('16.0.192 source validation passed.');

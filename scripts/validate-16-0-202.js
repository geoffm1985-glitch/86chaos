#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => { if (!condition) { console.error(`FAIL: ${message}`); process.exit(1); } console.log(`PASS: ${message}`); };
const sha = (file) => crypto.createHash('sha256').update(read(file)).digest('hex');
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const app = read('src/App.js');
const hr = read('src/features/hr.jsx');
const management = read('src/features/management.jsx');
const manifest = json('scripts/repair-regression-pack-16.0.202.json');
assert(pkg.version === '16.0.202', 'package.json version is 16.0.202');
assert(lock.version === '16.0.202' && lock.packages?.['']?.version === '16.0.202', 'package-lock root version is 16.0.202');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-202.js', 'test:source points to 16.0.202 validator');
assert(pkg.scripts['test:repair-16-0-202'] === 'npm run test:repair-current', '16.0.202 repair alias exists');
assert(version.version === '16.0.202' && version.build === '16.0.202', 'public version/build are 16.0.202');
assert(appCore.includes("CURRENT_VERSION = '16.0.202'"), 'app core CURRENT_VERSION is 16.0.202');
assert(apiVersion.includes("APP_VERSION = '16.0.202'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.202'"), 'API version constants are 16.0.202');
assert(app.includes("activeTabState === 'today' ? 8 : 30"), 'Today restaurantAdminAlerts demand is capped to 8 without changing non-Today cap');
assert(app.includes("activeTabState === 'team' ? 220 : (wantsToday ? 75 : 90)"), 'Today roster cap is reduced while team roster cap is preserved');
assert(app.includes("activeTabState === 'menu-intelligence' ? 500 : 80"), 'Today menu dependency summary cap is reduced while full Menu Intelligence cap is preserved');
assert(hr.includes('getCountFromServer') && hr.includes("debugLabel: `hr:${activeTab}:manuals`"), 'HR overview uses aggregate counts and scoped/labeled listeners');
assert(hr.includes("enabled: !!restaurantId && manager && activeTab === 'performance'"), 'confidential HR performance notes load only on the performance section');
assert(management.includes("audit-log:latest-75") && management.includes('limitCount: 75'), 'Audit log latest view uses a tighter recent-record cap');
assert(appCore.includes('getFirebaseUsageDiagnostics') && appCore.includes('recordFirestoreWriteDiagnostic'), 'local Firebase usage diagnostics and write counters remain available');
assert(manifest.version === '16.0.202', 'repair regression manifest is 16.0.202');
assert(read('scripts/run-repair-regression-pack.cjs').includes('repair-regression-pack-16.0.202.json'), 'repair local runner points to 16.0.202 manifest');
assert(read('scripts/run-repair-browser-regression.cjs').includes('repair-regression-16.0.202.json'), 'repair browser runner points to 16.0.202 manifest');
const expected = {
  'firestore.rules': '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9',
  'storage.rules': '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c',
  'database.rules.json': '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138',
  'firestore.indexes.json': 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b',
  'firebase.json': 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4'
};
for (const [file, hash] of Object.entries(expected)) assert(sha(file) === hash, `${file} frozen hash unchanged`);
console.log('16.0.202 conservative Firebase read/write baseline validation complete.');

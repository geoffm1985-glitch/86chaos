const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.76 source validation failed: ${message}`);
    process.exitCode = 1;
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const app = read('src/App.js');
const management = read('src/features/management.jsx');
const vercel = json('vercel.json');
const schedule = read('src/features/schedule.jsx');

assert(pkg.version === '16.0.76', 'package.json version is 16.0.76');
assert(lock.version === '16.0.76' && lock.packages?.['']?.version === '16.0.76', 'package-lock root version is 16.0.76');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-76.js', 'test:source points at 16.0.76 validator');
assert(version.version === '16.0.76' && version.build === '16.0.76', 'public version/build is 16.0.76');
assert(appCore.includes("CURRENT_VERSION = '16.0.76'"), 'appCore CURRENT_VERSION is 16.0.76');
assert(apiVersion.includes("APP_VERSION = '16.0.76'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.76'"), 'API version constants are 16.0.76');
assert(app.includes('clearRuntimeRecoveryCaches'), 'runtime recovery has a cache/service-worker clearing helper');
assert(app.includes('hardRecoverRuntimeSection'), 'runtime recovery button uses hard recovery helper');
assert(app.includes('Clear App Cache & Reload'), 'runtime recovery button clearly describes the hard refresh behavior');
assert(app.includes("await clearRuntimeRecoveryCaches('auto-chunk-recovery')"), 'automatic chunk recovery clears stale caches before reload');
assert(!app.includes('activeLocalDeleteKeysSet'), 'App does not reference the old misspelled delete-marker variable');
assert(management.includes('attention: response.ok && result.ok === false'), 'diagnostic API checks distinguish HTTP 200 attention from transport errors');
assert(management.includes("check.attention ? 'ATTENTION'"), 'System Administrator health badge shows ATTENTION instead of ERR 200 for ok:false diagnostics');
assert(vercel.crons?.some(c => c.path === '/api/firestore-backup' && c.schedule === '0 9 * * *'), 'Vercel crons include the daily Firestore backup route');
assert(vercel.crons?.some(c => c.path === '/api/firestore-backup-watchdog'), 'Vercel crons preserve backup watchdog route');
const tabMasterStart = schedule.indexOf('const TabMasterSchedule =');
const tabMasterReturn = schedule.indexOf('<div className="schedule-desktop', tabMasterStart);
const myNextDecl = schedule.indexOf('const myNextShift =', tabMasterStart);
const myNextUse = schedule.indexOf('{myNextShift ?', tabMasterStart);
assert(tabMasterStart >= 0 && myNextDecl > tabMasterStart && myNextDecl < tabMasterReturn && myNextDecl < myNextUse, 'TabMasterSchedule defines myNextShift before render uses it');
assert(!schedule.includes('activeLocalDeleteKeysSet'), 'Schedule code does not reference the old misspelled delete-marker variable');
assert(!schedule.includes('Active punch query needs the deployed timePunches'), 'Schedule no longer shows developer-index warning text to staff');
assert(schedule.includes('index-light'), 'Active punch listener uses the index-light sync path');

if (!process.exitCode) console.log('16.0.76 source validator passed.');

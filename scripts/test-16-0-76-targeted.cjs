#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.76 targeted test failed: ${message}`);
    process.exitCode = 1;
  }
};

const version = json('public/version.json');
const pkg = json('package.json');
const schedule = read('src/features/schedule.jsx');
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');

assert(version.version === '16.0.76', 'version.json reports 16.0.76');
assert(pkg.version === '16.0.76', 'package.json reports 16.0.76');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-76.js', 'test:source points to the 16.0.76 validator');
assert(apiVersion.includes("APP_VERSION = '16.0.76'"), 'API version constant is 16.0.76');
assert(appCore.includes("CURRENT_VERSION = '16.0.76'"), 'appCore CURRENT_VERSION is 16.0.76');

const tabMasterStart = schedule.indexOf('const TabMasterSchedule =');
const tabMasterReturn = schedule.indexOf('<div className="schedule-desktop', tabMasterStart);
const myNextDecl = schedule.indexOf('const myNextShift =', tabMasterStart);
const myNextUse = schedule.indexOf('{myNextShift ?', tabMasterStart);
assert(tabMasterStart >= 0, 'TabMasterSchedule exists');
assert(myNextDecl > tabMasterStart, 'TabMasterSchedule declares myNextShift');
assert(myNextUse > tabMasterStart, 'TabMasterSchedule renders myNextShift');
assert(myNextDecl < tabMasterReturn, 'myNextShift is declared before TabMasterSchedule JSX render');
assert(myNextDecl < myNextUse, 'myNextShift is declared before JSX uses it');
assert(schedule.includes('const myMonthShifts = dedupeScheduleShiftsByDatePersonTime'), 'TabMasterSchedule declares My Published Schedule list before render');
assert(!schedule.includes('activeLocalDeleteKeysSet'), 'old misspelled delete-marker variable is not referenced');
assert(!schedule.includes('Active punch query needs the deployed timePunches'), 'developer-only index warning is not shown to employees');
assert(schedule.includes('Clock-in status could not sync yet. Your schedule is still available.'), 'clock sync warning is plain English and does not block Schedule');
assert(schedule.includes('index-light'), 'active punch sync uses the index-light listener path');
assert(!/where\('status',\s*'in'/.test(schedule.slice(tabMasterStart, tabMasterReturn)), 'TabMasterSchedule active-punch listener does not depend on status-in composite query before render');

if (!process.exitCode) console.log('16.0.76 targeted Schedule runtime guard tests passed.');

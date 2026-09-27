#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const sha = file => crypto.createHash('sha256').update(read(file).replace(/\r\n?/g, '\n')).digest('hex');
const validationVersion = process.env.CHAOS_VALIDATION_VERSION || '16.0.233';
const validationReleaseTitle = process.env.CHAOS_VALIDATION_RELEASE_TITLE || 'Schedule Tools Period Awareness';
const validationScript = process.env.CHAOS_VALIDATION_SCRIPT || 'scripts/validate-16-0-233.js';
let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log(`OK: ${message}`);
  else { failures += 1; console.error(`FAIL: ${message}`); }
};

const inherited = childProcess.spawnSync(process.execPath, ['scripts/validate-16-0-231.js'], {
  cwd: root,
  encoding: 'utf8',
  env: {
    ...process.env,
    CHAOS_VALIDATION_VERSION: validationVersion,
    CHAOS_VALIDATION_RELEASE_TITLE: validationReleaseTitle,
    CHAOS_VALIDATION_SCRIPT: validationScript
  }
});
if (inherited.stdout) process.stdout.write(inherited.stdout);
if (inherited.stderr) process.stderr.write(inherited.stderr);
assert(inherited.status === 0, 'all inherited 16.0.231 source, security, UI, reminder, AI and release-evidence invariants pass');

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const schedule = read('src/features/schedule.jsx');
const periodShared = read('src/core/scheduleToolsPeriod.shared.js');
const periodBrowser = read('src/core/scheduleToolsPeriod.js');
const warningShared = read('src/core/scheduleWarningControls.shared.js');

assert(pkg.version === validationVersion, `package.json version is ${validationVersion}`);
assert(lock.version === validationVersion && lock.packages?.['']?.version === validationVersion, `package-lock root versions are ${validationVersion}`);
assert(pkg.scripts['test:source'] === `node ${validationScript}` && pkg.scripts[`validate:${validationVersion}`] === `node ${validationScript}`, `source and explicit ${validationVersion} validators are wired`);
assert(version.version === validationVersion && version.build === validationVersion && version.releaseTitle === validationReleaseTitle, `public version metadata identifies ${validationVersion}`);
assert(apiVersion.includes(`APP_VERSION = '${validationVersion}'`) && apiVersion.includes(`SECURITY_SCHEMA_VERSION = '${validationVersion}'`), `API reports ${validationVersion}`);
assert(appCore.includes(`CURRENT_VERSION = '${validationVersion}'`), `app reports ${validationVersion}`);
assert(read('src/core/customerHelpKnowledge.js').includes(`CUSTOMER_HELP_VERSION = '${validationVersion}'`) && read('src/core/customerHelpKnowledge.cjs').includes(`CUSTOMER_HELP_VERSION = '${validationVersion}'`), 'customer Help version mirrors remain synchronized');

assert(periodShared.includes('deriveScheduleToolsPeriod') && periodShared.includes('buildWeekSegments') && periodShared.includes('mode: normalizedMode'), 'one pure helper derives the active period and its week segments');
assert(periodShared.includes("normalizedMode === 'monthly'") && periodShared.includes('requestedWeeks * 7'), 'period helper preserves month-only and configured-week semantics');
assert(periodShared.includes('filterScheduleToolsRecords') && periodShared.includes('recordWorkspace !== expectedWorkspace'), 'period filtering excludes explicit foreign-workspace records');
assert(periodShared.includes('assessScheduleToolsCompleteness') && periodShared.includes('reached its retrieval limit'), 'incomplete or capped evidence cannot report complete Schedule Tools results');
assert(periodBrowser.includes("import './scheduleToolsPeriod.shared'"), 'browser period wrapper uses the shared pure implementation');

assert(schedule.includes('period={scheduleToolsPeriod}') && schedule.includes('periodDates: activePeriodDates') && schedule.includes('periodShifts: activePeriodShifts'), 'Schedule Tools counts and coverage share one active period');
assert(!schedule.includes('const weekDates = getWeekDates(currentDate);'), 'Schedule Tools no longer owns a hard-coded seven-day analysis window');
assert(warningShared.includes('const matchingDates = dates.filter') && warningShared.includes('periodWeeks'), 'coverage targets recur per date and workload warnings remain weekly inside longer periods');
assert(schedule.includes('recurringDatesForWeekday(activePeriod, row.dayIndex)') && schedule.includes('activePeriodShifts.filter(s => getShiftDateKey(s) === m.date)'), 'templates and Fill Coverage Gaps use every eligible active-period date');
assert(schedule.includes('getActiveAvailabilityForDate(u.id, date, availabilityRecords)') && schedule.includes('timeOffMatchesPerson(request, u)'), 'Fill Coverage Gaps respects approved availability and Request Off records');
assert(schedule.includes('buildCanonicalScheduleCreateFields(date, appUser.restaurantId)') && schedule.includes("source: 'schedule_copilot'"), 'period-created drafts retain canonical date and tenant fields');
assert(schedule.includes('onReviewPublish?.()') && schedule.includes("publishPickerSource === 'schedule-tools' ? schedulePeriodDays : publicationWeekDays"), 'Schedule Tools delegates to the mature publisher with an active-period-only scope');
assert(schedule.includes('writeBatch(db)') && schedule.includes('verificationFailures') && schedule.includes('buildCanonicalScheduleIdentityBlock'), 'batched publishing, verification reads, and canonical identity safeguards remain intact');
assert(schedule.includes('deriveScheduleToolsCopyWeek(activePeriod)') && schedule.includes('Copy Previous Week'), 'Copy Previous Week remains an explicit weekly action');
assert(app.includes("useLiveCollectionState('shifts'") && app.includes('rawScheduleDateKeyShiftsState'), 'canonical and rescue listener completeness is exposed without adding per-day listeners');
assert((schedule.match(/useLiveCollectionState\('shifts'/g) || []).length === 0, 'Schedule Tools reuses loaded shifts instead of creating a shift listener');
assert(schedule.includes('Schedule check incomplete:') && !schedule.includes('No schedule warning dragons spotted this week.'), 'incomplete data and empty states use honest period-aware language');
assert(read('src/styles.css').includes('.schedule-tools-period-label') && read('src/styles.css').includes('overflow-wrap: anywhere'), 'longer period labels wrap safely on mobile');
assert(fs.existsSync(path.join(root, 'api/schedule-tools-period-awareness-16-0-233.test.cjs')), 'focused 16.0.233 period regression suite is included');

// Security and infrastructure remain byte-for-byte frozen from certified 16.0.232.
const unchanged = {
  'firestore.rules': '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9',
  'firestore.indexes.json': 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b',
  'storage.rules': '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c',
  'database.rules.json': '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138',
  'firebase.json': 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4',
  'public/firebase-messaging-sw.js': '46c7f5760350721d424ba6db9a3a9127449fbb670a24b04328e71d3a74ed2366',
  'vercel.json': '3a42afbec525fe1abfe52f28d9b973c9494bdaca6edf3b0ed1a43f30c69db276'
};
for (const [file, expected] of Object.entries(unchanged)) assert(sha(file) === expected, `${file} unchanged`);

if (failures) {
  console.error(`16.0.233 source validation failed with ${failures} failure(s).`);
  process.exit(1);
}
console.log(`${validationVersion} source validation passed with certified 16.0.233 Schedule Tools invariants.`);

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.80 targeted Schedule Builder chip visual test failed: ${message}`);
    process.exitCode = 1;
  }
};

const version = json('public/version.json');
const pkg = json('package.json');
const lock = json('package-lock.json');
const schedule = read('src/features/schedule.jsx');
const styles = read('src/styles.css');
const plannerTest = read('src/core/scheduleQueryPlanner.test.js');
const javaCheck = read('scripts/86chaos-release-gate/check-java-prerequisite.cjs');
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const sessionAccess = read('src/core/sessionAccess.js');
const authFeature = read('src/features/auth.jsx');

assert(version.version === '16.0.80' && version.build === '16.0.80', 'version.json reports 16.0.80');
assert(pkg.version === '16.0.80', 'package.json reports 16.0.80');
assert(lock.version === '16.0.80' && lock.packages?.['']?.version === '16.0.80', 'package-lock root version is 16.0.80');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-80.js', 'test:source points to the 16.0.80 validator');
assert(apiVersion.includes("APP_VERSION = '16.0.80'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.80'"), 'API version constants are 16.0.80');
assert(appCore.includes("CURRENT_VERSION = '16.0.80'"), 'appCore CURRENT_VERSION is 16.0.80');

assert(schedule.includes('className={`schedule-builder-time-chip w-full rounded font-bold'), 'Schedule Builder still renders the same shift chip element and text class');
assert(schedule.includes('handleDeleteSpecificShift(event, shift, u, d)'), 'shift chip click/delete interaction remains wired to the same handler');
assert(schedule.includes('formatShortTime(shift.startTime)}-${formatShortTime(shift.endTime)'), 'shift time format remains unchanged');

const marker = '16.0.78 Schedule Builder shift chip surface correction';
const idx = styles.indexOf(marker);
assert(idx >= 0, '16.0.80 final Schedule Builder chip surface block exists');
const finalBlock = styles.slice(idx);

assert(/\.schedule-builder-desktop-table[\s\S]*\.schedule-builder-time-chip/.test(finalBlock), 'final rules are scoped to the Schedule Builder table chip');
assert(!/schedule-builder-events-cell[\s\S]{0,300}width:\s*fit-content/.test(finalBlock), 'event-row chips are not targeted by the shift-chip fit-content rule');
assert(finalBlock.includes('.desktop-pro-shell .app-content-shell .schedule-builder-desktop-table button.schedule-builder-time-chip'), 'final chip rules outrank the generic compact desktop button rule');
assert(/display:\s*inline-flex !important/.test(finalBlock), 'shift chips use a single compact colored inline-flex surface');
assert(/align-self:\s*center !important/.test(finalBlock), 'shift chips are centered instead of stretched by the flex column');
assert(/width:\s*fit-content !important/.test(finalBlock), 'colored chip sizes to the time text instead of filling the cell');
assert(/max-width:\s*calc\(100% - 4px\) !important/.test(finalBlock), 'colored chip remains contained within its date cell');
assert(/min-height:\s*0 !important/.test(finalBlock), 'generic button minimum height is disabled only for these chips');
assert(/padding:\s*1px 3px !important/.test(finalBlock), 'visual vertical padding is reduced without changing typography');
assert(/border-radius:\s*5px !important/.test(finalBlock), 'visible box radius is compact');
assert(/white-space:\s*nowrap !important/.test(finalBlock), 'shift time is forced to one horizontal line');
assert(/writing-mode:\s*horizontal-tb !important/.test(finalBlock), 'vertical writing mode is blocked');
assert(/word-break:\s*normal !important/.test(finalBlock), 'word breaking is not used to split time ranges');
assert(/overflow-wrap:\s*normal !important/.test(finalBlock), 'overflow wrapping is disabled');
assert(/flex-wrap:\s*nowrap !important/.test(finalBlock), 'chip content cannot wrap within the colored surface');
assert(/overflow:\s*hidden !important/.test(finalBlock), 'text cannot visibly escape outside the colored box');
assert(/text-overflow:\s*clip !important/.test(finalBlock), 'normal shift ranges are not ellipsized');
assert(/background-clip:\s*padding-box !important/.test(finalBlock), 'the full visible role-colored chip surface is painted as one box');
assert(/contain:\s*paint !important/.test(finalBlock), 'chip paint is contained inside its own colored surface');
assert(/> \* \{[\s\S]*background:\s*transparent !important/.test(finalBlock), 'nested text elements cannot paint a smaller competing highlight');

assert(/font-size:\s*9px !important/.test(finalBlock), 'base chip text size remains the current 16.0.77 size');
assert(/@media \(min-width:\s*1024px\)[\s\S]*font-size:\s*12px !important/.test(finalBlock), 'desktop chip text size remains the current 16.0.77 runtime size');
assert(/@media \(max-width:\s*420px\)[\s\S]*font-size:\s*8\.5px !important/.test(finalBlock), 'narrow-mobile chip text size remains the current 16.0.77 size');
assert(/letter-spacing:\s*-0\.035em !important/.test(finalBlock), 'base chip letter spacing remains the current 16.0.77 spacing');
assert(/@media \(max-width:\s*420px\)[\s\S]*letter-spacing:\s*-0\.055em !important/.test(finalBlock), 'narrow-mobile chip letter spacing remains the current 16.0.77 spacing');
assert(!/16\.0\.78[\s\S]*font-weight\s*:/.test(finalBlock), '16.0.80 does not change the current font weight');
assert(!/16\.0\.78[\s\S]*(^|[^-])width:\s*100% !important/m.test(finalBlock), 'final 16.0.80 chip surface does not force full-cell width');
assert(!/16\.0\.78[\s\S]*overflow:\s*visible !important/.test(finalBlock), 'final 16.0.80 chip surface does not allow time text outside the colored background');
assert(!/16\.0\.78[\s\S]*white-space:\s*normal !important/.test(finalBlock), 'final 16.0.80 chip surface does not reintroduce wrapping');
assert(!/16\.0\.78[\s\S]*<br\s*\/?\s*>/.test(finalBlock), 'no line break tags are introduced for shift labels');


assert(plannerTest.includes("selected month plus outer schedule weeks"), 'My Schedule Jest test title documents outer-week behavior');
assert(plannerTest.includes("['date', '>=', '2026-06-29']") && plannerTest.includes("['date', '<=', '2026-08-02']"), 'My Schedule Jest expectation uses June 29 through August 2 for July 2026 Monday weeks');
assert(plannerTest.includes("not.toContainEqual(['scheduleUserId', '==', 'sched_u1'])"), 'My Schedule test still protects legacy shift visibility by avoiding scheduleUserId-only Firestore equality');
assert(javaCheck.includes('java -version') && javaCheck.includes('BLOCKED'), 'Java prerequisite checker marks Firebase rules emulator tests as blocked when Java is missing');
assert(fs.existsSync(path.join(root, 'INSTALL_AND_RUN_86CHAOS_ULTIMATE_TESTS.ps1')) && fs.existsSync(path.join(root, 'INSTALL_AND_RUN_86CHAOS_ULTIMATE_TESTS.cmd')), 'V9 installer files are present in the source root');
assert(app.includes('shouldHoldAccessHydration({'), 'cached session access hydration gate is wired into App');
assert(app.includes('Restoring session'), 'hard refresh shows a restoring-session state while permissions hydrate');
assert(app.includes('res.status === 401') && app.includes('forceTokenRefresh'), 'whoami verification refreshes the Firebase ID token after an initial 401');
assert(app.includes('nextRetryInMs') && app.includes('TRANSIENT_FAILURE'), 'transient whoami failures retry without demoting verified access');
assert(sessionAccess.includes('shouldHoldAccessHydration') && sessionAccess.includes('mergeVerifiedAccess'), 'testable session access helpers are present');
assert(authFeature.includes('accessHydrationRequired: true') && authFeature.includes('profileDocId') && !authFeature.includes('...activeUser,'), 'login reload cache does not persist authoritative role or permission objects');
assert(read('src/core/sessionAccess.test.js').includes('normal users do not become system administrators from cached data'), 'refresh/access tests protect against cached-data privilege gain');


if (!process.exitCode) console.log('16.0.80 targeted release-gate and Schedule Builder preservation tests passed.');

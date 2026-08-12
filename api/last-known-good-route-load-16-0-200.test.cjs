'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('schedule and management chunks defensively resolve new CommonJS helpers', () => {
  const schedule = read('src/features/schedule.jsx');
  const management = read('src/features/management.jsx');
  assert.match(schedule, /import \* as scheduleRescueDiagnosticsModule from ['"]\.\.\/core\/scheduleRescueDiagnostics\.cjs['"]/, 'Schedule imports rescue diagnostics as a namespace for Vite/CJS interop');
  assert.match(schedule, /function|const resolveScheduleCjsModule/, 'Schedule has a CJS namespace resolver');
  assert.match(schedule, /fallbackBuildMyScheduleIncompleteWarningView/, 'Schedule has a safe fallback for rescue-warning diagnostics');
  assert.match(schedule, /const buildMyScheduleIncompleteWarningView = typeof scheduleRescueDiagnostics\.buildMyScheduleIncompleteWarningView === ['"]function['"]/, 'Schedule uses resolved rescue-warning helper only after verifying it is callable');
  assert.doesNotMatch(schedule, /import scheduleRescueDiagnostics from ['"]\.\.\/core\/scheduleRescueDiagnostics\.cjs['"]/, 'Schedule no longer uses default-only import for the new CJS diagnostics helper');

  assert.match(management, /import \* as presenceTruthModuleValue from ['"]\.\.\/core\/presenceTruth\.cjs['"]/, 'Management imports presence truth as a namespace for CJS interop');
  assert.match(management, /import \* as scheduleEfficiencyModuleValue from ['"]\.\.\/core\/scheduleEfficiency\.cjs['"]/, 'Management imports schedule efficiency as a namespace for CJS interop');
  assert.match(management, /fallbackClassifySystemAdminPresenceRow/, 'Management can render even if CJS helper resolution changes');
  assert.match(management, /typeof presenceTruth\.classifySystemAdminPresenceRow === ['"]function['"]/, 'Management verifies the presence classifier before calling it');
  assert.doesNotMatch(management, /import presenceTruthModule from ['"]\.\.\/core\/presenceTruth\.cjs['"]/, 'Management no longer uses default-only import for presence truth');
  assert.doesNotMatch(management, /import scheduleEfficiencyModule from ['"]\.\.\/core\/scheduleEfficiency\.cjs['"]/, 'Management no longer uses default-only import for schedule efficiency');
});

test('route error boundary resets by Schedule subtab without remounting Schedule on every click', () => {
  const app = read('src/App.js');
  assert.doesNotMatch(app, /key=\{`\$\{activeTabState\}-\$\{activeScheduleSubTab \|\| ['"]no-subtab['"]\}-/, 'surface boundary key must not include the active Schedule subtab');
  assert.doesNotMatch(app, /<React\.Fragment\s+key=\{`[^`]*activeScheduleSubTab/, 'route fragment key must not include the active Schedule subtab');
  assert.match(app, /resetKey=\{`\$\{activeTabState\}-\$\{activeScheduleSubTab \|\| ['"]no-subtab['"]\}-/, 'surface boundary resetKey still includes the active Schedule subtab for error recovery');
  assert.match(app, /activeSubTab=\{activeScheduleSubTab \|\| ['"]['"]\}/, 'error boundary receives active subtab context');
  assert.match(app, /activeSubTab: context\.activeSubTab/, 'runtime reports include active subtab context');
  assert.match(app, /activeSubTab: this\.props\.activeSubTab/, 'error boundary forwards active subtab context to runtime reporting');
});

test('automatic crash reports surface route and subtab breadcrumbs to Vercel logs without exposing secrets', () => {
  const reportBug = read('api/report-bug.js');
  assert.match(reportBug, /activeSubTab: cleanText\(body\.activeSubTab \|\| body\.subTab \|\| crashFields\.subTab/, 'crash report stores active subtab safely');
  assert.match(reportBug, /\[report-bug\] client-runtime-crash/, 'automatic crashes get a compact Vercel log marker');
  assert.match(reportBug, /errorMessage: cleanText\(report\.errorMessage \|\| report\.rawMessage \|\| ['"]['"], 240\)/, 'logged crash message is bounded');
  assert.doesNotMatch(reportBug, /console\.info\([^\)]*rawStack/s, 'compact Vercel marker does not log raw stack payloads');
});

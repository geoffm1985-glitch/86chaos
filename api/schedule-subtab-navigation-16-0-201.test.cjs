#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src/App.js'), 'utf8');

test('Schedule subtab clicks do not remount TabMasterSchedule back to My Schedule', () => {
  const boundaryKeyMatch = appSource.match(/<AppSurfaceErrorBoundary\s+key=\{`([^`]+)`\}/);
  assert.ok(boundaryKeyMatch, 'AppSurfaceErrorBoundary key should be present');
  assert.equal(boundaryKeyMatch[1].includes('activeScheduleSubTab'), false, 'boundary key must not include activeScheduleSubTab because that remounts the Schedule surface after every subtab click');

  const fragmentKeyMatch = appSource.match(/<React\.Fragment\s+key=\{`([^`]+)`\}/);
  assert.ok(fragmentKeyMatch, 'route fragment key should be present');
  assert.equal(fragmentKeyMatch[1].includes('activeScheduleSubTab'), false, 'route fragment key must not include activeScheduleSubTab because that resets TabMasterSchedule local subTab state');

  assert.match(appSource, /activeSubTab=\{activeScheduleSubTab \|\| ''\}/, 'runtime diagnostics should still receive the active schedule subtab');
  assert.match(appSource, /resetKey=\{`\$\{activeTabState\}-\$\{activeScheduleSubTab \|\| 'no-subtab'\}/, 'error boundary reset key can still clear a crashed schedule section when the subtab changes');
});

test('Schedule routes seed TabMasterSchedule from parent subtab state instead of a hard-coded default', () => {
  assert.match(appSource, /activeTabState === 'schedule'[\s\S]*?initialSubTab=\{activeScheduleSubTab \|\| "schedule-builder"\}/, 'manager Schedule route seeds from activeScheduleSubTab');
  assert.match(appSource, /activeTabState === 'published'[\s\S]*?initialSubTab=\{activeScheduleSubTab \|\| "my-schedule"\}/, 'published Time Clock & Schedule route seeds from activeScheduleSubTab');
  assert.doesNotMatch(appSource, /activeTabState === 'published'[\s\S]*?<TabMasterSchedule[\s\S]*?initialSubTab="my-schedule"/, 'published route must not hard-code My Schedule after subtab clicks');
});

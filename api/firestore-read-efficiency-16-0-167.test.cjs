const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/App.js'), 'utf8');
const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
const appCore = fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');
const inventory = fs.readFileSync(path.join(root, 'src/features/inventory.jsx'), 'utf8');

test('App resolves the requested URL tab before first top-level listener planning', () => {
  assert.match(app, /function resolveInitialTopLevelTab|const resolveInitialTopLevelTab/);
  assert.match(app, /new URLSearchParams\(window\.location\.search\)[\s\S]*params\.get\('tab'\)/);
  assert.match(app, /const \[initialRouteState\][\s\S]*resolveInitialTopLevelTab\(appUser\?\.preferences\?\.defaultTab/);
  assert.match(app, /const \[activeTabState, setActiveTabState\] = useState\(initialRouteState\.topLevelTab\)/);
  assert.doesNotMatch(app, /const \[activeTabState, setActiveTabState\] = useState\(\(\) => normalizeRouteTab\(appUser\?\.preferences\?\.defaultTab \|\| 'today'\)\)/);
});

test('App primes Schedule and Published with route-aware initial subtabs before query planning', () => {
  assert.match(app, /SCHEDULE_INITIAL_SUBTABS/);
  assert.match(app, /defaultScheduleSubTabForTopLevelTab/);
  assert.match(app, /normalized === 'schedule'[\s\S]*return 'schedule-builder'/);
  assert.match(app, /return 'my-schedule'/);
  assert.match(app, /peekScheduleFocusSubTab/);
  assert.match(app, /sessionStorage\?\.getItem\('scheduleFocus'\)/);
  assert.match(app, /const \[activeScheduleSubTab, setActiveScheduleSubTab\] = useState\(\(\) => initialRouteState\.scheduleSubTab/);
  assert.match(app, /setActiveScheduleSubTab\(defaultScheduleSubTabForTopLevelTab\(normalized\)\)/);
});

test('Schedule Copilot realtime reads are gated until Copilot is opened', () => {
  assert.match(schedule, /const \[open, setOpen\] = useState\(false\);[\s\S]*const copilotReadEnabled = Boolean\(open && appUser\?\.restaurantId\)/);
  assert.match(schedule, /useLiveCollection\('scheduleTemplates'[\s\S]*enabled: copilotReadEnabled[\s\S]*debugLabel: 'schedule:copilot:templates'/);
  assert.match(schedule, /useLiveCollection\('scheduleCoverageTargets'[\s\S]*enabled: copilotReadEnabled[\s\S]*debugLabel: 'schedule:copilot:coverage-targets'/);
  assert.match(schedule, /useLiveCollection\('roles'[\s\S]*enabled: copilotReadEnabled[\s\S]*debugLabel: 'schedule:copilot:roles'/);
  assert.match(schedule, /Open Copilot Tools for coverage targets, warnings & templates/);
});

test('active punch listener only attaches on My Schedule and preserves listener infrastructure', () => {
  assert.match(schedule, /if \(subTab !== 'my-schedule'\) \{\s*setActivePunch\(null\);\s*return undefined;\s*\}/);
  assert.match(schedule, /\}, \[subTab, appUser\?\.id, appUser\?\.restaurantId/);
  assert.match(app, /rawScheduleDateKeyShifts/);
  assert.match(app, /mergeLoadedScheduleShifts/);
  assert.match(appCore, /LIVE_COLLECTION_RELEASE_GRACE_MS\s*=\s*6 \* 60 \* 1000/);
  assert.match(appCore, /liveCollectionRegistry/);
  assert.match(appCore, /stale|closed|INTERNAL ASSERTION/i);
  assert.match(inventory, /opsIntelEnabled\s*=\s*false/);
});

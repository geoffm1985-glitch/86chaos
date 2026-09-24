'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.1.3 Kitchen Command Center owns the localized full-date formatter it renders', () => {
  const source = read('src/features/operations.jsx');
  const start = source.indexOf('const TabOpsCenter =');
  const end = source.indexOf('const TabToday =', start);
  const block = source.slice(start, end);
  assert.match(block, /const \{ formatFullDate \} = useI18n\(\);/);
  assert.match(block, /\{formatFullDate\(today\)\}/);
});

test('17.1.3 Message Board keeps its events listener alive and shows a saved post immediately', () => {
  const planner = read('src/core/scheduleQueryPlanner.js');
  const management = read('src/features/management.jsx');
  assert.match(planner, /wantsOperationalEvents = wantsToday \|\| activeTabState === 'messages' \|\| activeTabState === 'ops'/);
  assert.match(planner, /eventsEnabled: wantsOperationalEvents/);
  assert.match(planner, /eventEnabled: wantsOperationalEvents/);
  const app = read('src/App.js');
  assert.match(app, /const eventLimitCount = activeTabState === 'messages' \? Math\.max\(schedulePlan\.eventLimit \|\| 0, 90\)/);
  assert.match(management, /const \[optimisticPosts, setOptimisticPosts\] = useState\(\[\]\)/);
  assert.match(management, /postedRef = await addDoc\(collection\(db, "events"\), postedData\)/);
  assert.match(management, /setOptimisticPosts\(current => \[\{ id: postedRef\.id, \.\.\.postedData \}/);
  const save = management.indexOf('postedRef = await addDoc');
  const push = management.indexOf("await secureFetch('/api/send-push'", save);
  assert.ok(save >= 0 && push > save, 'Message Board saves the post before sending the push notification');
});

test('17.1.3 Schedule Builder pins the day/date row while tightening the mobile workbench', () => {
  const schedule = read('src/features/schedule.jsx');
  const css = read('src/concept17.css');
  assert.match(schedule, /schedule-builder-grid-scroll overflow-x-auto/);
  assert.match(schedule, /<thead className="schedule-builder-sticky-head">/);
  assert.match(css, /\.schedule-builder-grid-scroll[\s\S]*max-height:/);
  assert.match(css, /\.schedule-builder-desktop-table \.schedule-builder-sticky-head th[\s\S]*position: sticky !important;[\s\S]*top: 0 !important;/);
  assert.match(css, /\.schedule-builder-workbench[\s\S]*gap: 5px !important;/);
  assert.match(css, /\.schedule-builder-desktop-table th:first-child,[\s\S]*width: 96px !important;/);
});

test('17.1.3 puts 86Voice in the first visual slot of the mobile bottom toolbar', () => {
  const shell = read('src/components/concept17.jsx');
  const common = read('src/components/common.jsx');
  const css = read('src/concept17.css');
  const navStart = shell.indexOf('data-testid="concept17-mobile-bottom-nav"');
  const voiceButton = shell.indexOf('data-testid="concept17-mobile-voice-button"', navStart);
  const items = shell.indexOf('items.slice(0, 4).map', navStart);
  assert.ok(voiceButton > navStart && items > voiceButton, 'real 86Voice button is first in the mobile toolbar');
  assert.match(shell, /data-shell-action="voice"/);
  assert.match(common, /className="voice-command-trigger no-compact/);
  assert.match(css, /\.concept17-mobile-nav[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
});

test('17.1.3 Kitchen Tools badges stay horizontal instead of stacking letters', () => {
  const source = read('src/features/intelligence.jsx');
  const css = read('src/concept17.css');
  assert.match(source, /kitchen-tool-status-badge/);
  assert.match(source, /whitespace-nowrap shrink-0/);
  assert.match(css, /\.kitchen-tool-status-badge[\s\S]*white-space: nowrap !important;[\s\S]*word-break: keep-all !important;/);
});

test('17.1.3 suppresses the reconnect banner when this device already has a healthy push token', () => {
  const app = read('src/App.js');
  assert.match(app, /const currentDevicePushHealthy = Boolean\(notificationPermissionGranted/);
  assert.match(app, /currentPushDevice\?\.token/);
  assert.match(app, /liveAppUser\?\.fcmToken && liveAppUser\?\.pushRepairStatus === 'connected'/);
  assert.match(app, /pushRepairFlagged && !currentDevicePushHealthy/);
});

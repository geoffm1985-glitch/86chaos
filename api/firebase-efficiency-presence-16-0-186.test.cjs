'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('device presence aggregation is implemented for multi-device online truth', () => {
  const route = read('api/presence-workspace-summary.js');
  assert.match(route, /function aggregateRtdbDevicePresence/);
  assert.match(route, /onlineDevices\.length > 0/);
  assert.match(route, /activeSessionCount: onlineDevices\.length/);
  assert.match(route, /rtdb-status-sessions-api/);
  assert.match(route, /status\/\$\{restaurantId\}/);
  assert.doesNotMatch(route, /presence\/\$\{restaurantId\}/);
});
test('client presence writes one online session and does not duplicate online truth to statusSummary', () => {
  const appCore = read('src/core/appCore.js');
  assert.match(appCore, /LOW_COST_PRESENCE_TREE = 'status'/);
  assert.match(appCore, /rtdbSet\(sessionRef, onlinePayload\)/);
  assert.match(appCore, /LOW_COST_PRESENCE_SUMMARY_TREE = 'statusSummary'/);
  assert.match(appCore, /`\$\{LOW_COST_PRESENCE_TREE\}\/\$\{workspaceKey\}\/\$\{authUidKey\}\/sessions\/\$\{connectionId\}`/);
  assert.match(appCore, /rtdbOnDisconnect\(sessionRef\)\.remove\(\)/);
  assert.match(appCore, /rtdbOnDisconnect\(summaryRef\)\.set\(lastSeenPayload\)/);
  assert.doesNotMatch(appCore, /rtdbSet\(summaryRef, \{ \.\.\.onlinePayload/);
});

test('personal reminders do not run a 90-second polling interval', () => {
  const reminders = read('src/core/personalReminderQueries.js');
  assert.match(reminders, /PERSONAL_REMINDER_STALE_MS = 7 \* 60 \* 1000/);
  assert.doesNotMatch(reminders, /setInterval\(/);
  assert.match(reminders, /refreshIfStale/);
});

test('inventory PAR typing is local and commits only on explicit boundary', () => {
  const inventory = read('src/features/inventory.jsx');
  assert.match(inventory, /parDrafts/);
  assert.match(inventory, /onChange=\{\(e\) => setParDraftValue\(item\.id, e\.target\.value\)\}/);
  assert.match(inventory, /onBlur=\{\(e\) => commitParDraft\(item, e\.target\.value\)\}/);
  assert.match(inventory, /before: item/);
});

test('HR and audit log large reads are gated or snapshot-based', () => {
  const hr = read('src/features/hr.jsx');
  const management = read('src/features/management.jsx');
  assert.match(hr, /hrOverviewActive/);
  assert.match(hr, /activeTab === 'performance'/);
  assert.match(hr, /debugLabel: `hr:\$\{activeTab\}:manuals`/);
  assert.doesNotMatch(management, /const logs = useLiveCollection\('auditLogs'/);
  assert.match(management, /Snapshot-based view/);
  assert.match(management, /Load More/);
});


test('shared listener lifecycle uses adaptive release windows', () => {
  const appCore = read('src/core/appCore.js');
  assert.match(appCore, /HOT_LIVE_COLLECTION_RELEASE_GRACE_MS = 60 \* 1000/);
  assert.match(appCore, /ADMIN_LIVE_COLLECTION_RELEASE_GRACE_MS = 20 \* 1000/);
  assert.match(appCore, /liveCollectionReleaseGraceMs/);
  assert.match(appCore, /releasePolicy/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.24 Clear Month control and destructive confirmation remain present after the 17.0.25 reliability repair', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /data-chaos-workflow-id="schedule-clear-month"/);
  assert.match(schedule, /onClick=\{handleClearScheduleMonth\}/);
  assert.match(schedule, /Delete ALL saved shifts from \$\{monthLabel\}/);
  assert.match(schedule, /This includes draft and published shifts/);
  assert.match(schedule, /Events and time-off requests will NOT be deleted/);
  assert.match(schedule, /Restore cleared shifts will be available/);
  assert.doesNotMatch(schedule, /This cannot be undone/);
});

test('17.0.24 Clear Month now delegates canonical and legacy tenant cleanup to the authenticated server boundary', () => {
  const schedule = read('src/features/schedule.jsx');
  const route = read('api/schedule-shift-delete.js');
  assert.match(route, /action === 'preview-month'/);
  assert.match(schedule, /restore-cleared-month':'clear-month'/);
  assert.match(route, /TENANT_FIELDS = \['restaurantId', 'workspaceId', 'tenantId'\]/);
  assert.match(route, /shiftBelongsToMonth/);
  assert.match(route, /prepareScheduleClear\(\{db,ctx,restaurantId,month,rows:preview.rows\}\)/);
  assert.match(route, /advanceScheduleClear\(\{db,ctx,body\}\)/);
});

test('17.0.24 Clear Month still verifies deletion and refuses to silently accept remaining shift records', () => {
  const schedule = read('src/features/schedule.jsx');
  const route = read('api/schedule-shift-delete.js');
  assert.match(route, /successful Firestore batch commit is authoritative/);
  assert.match(route, /return \{ initialCount, deletedCount, remainingCount: 0 \}/);
  assert.match(schedule, /if\(!result\?\.done\)throw new Error/);
  assert.match(schedule, /Completed chunks retain recovery receipts/);
  assert.match(schedule, /applyReviewedMonthResult\(result\)/);
  assert.match(schedule, /previous\.filter\(row=>!affected\.has\(getShiftWritableDocId\(row\)\)\)/);
});

test('17.0.24 Clear Month remains inside existing Schedule Builder authority and does not create a client permission bypass', () => {
  const schedule = read('src/features/schedule.jsx');
  const route = read('api/schedule-shift-delete.js');
  assert.match(schedule, /\{subTab === 'schedule' && \(/);
  assert.match(schedule, /subTab === 'schedule-builder' && scheduleBuilderProps/);
  assert.match(route, /requiredPermissions: \['schedule'\]/);
  assert.match(route, /canManageSchedule\(ctx\)/);
  assert.doesNotMatch(schedule, /clearMonthPermission|scheduleClearMonthPermission|canClearMonthPermission/);
});

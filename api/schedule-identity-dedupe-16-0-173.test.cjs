'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('resolveSchedulePersonForShift uses shift employee aliases without Firestore doc id', () => {
  const planner = read('src/core/scheduleQueryPlanner.js');
  assert.match(planner, /DURABLE_SHIFT_EMPLOYEE_ID_FIELDS/);
  const fieldBlock = planner.match(/DURABLE_SHIFT_EMPLOYEE_ID_FIELDS\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
  assert.doesNotMatch(fieldBlock, /['"]id['"]/);
  assert.match(planner, /collectScheduleShiftDurableIdentityAliases/);
  assert.match(planner, /resolveSchedulePersonForShift/);
});

test('Month View dedupes duplicate published shift documents and suppresses stale unresolved placeholders', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /collapseScheduleDisplayShifts/);
  assert.match(schedule, /shiftLooksUnresolvedForScheduleDisplay/);
  assert.match(schedule, /assignedSlots\.has\(slotKey\)/);
  assert.match(schedule, /shiftsByDate\.get\(date\) \|\| \[\]/);
  assert.doesNotMatch(schedule, /onClick=\{\(\)=>window\.print\(\)\}/);
  assert.match(schedule, /printWindow\.document\.write\(buildPrintableCalendarHtml\(\)\)/);
});

test('workspace user display name does not prefer restaurant name or machine login over person name', () => {
  const app = read('src/App.js');
  assert.match(app, /resolveWorkspacePersonDisplayName/);
  assert.match(app, /looksLikeWorkspaceBusinessName/);
  assert.match(app, /looksLikeMachineLoginName/);
  assert.match(app, /name: resolveWorkspacePersonDisplayName\(member, accountUser, member\)/);
  assert.match(app, /name: resolveWorkspacePersonDisplayName\(workspace, currentUser, workspace\)/);
});

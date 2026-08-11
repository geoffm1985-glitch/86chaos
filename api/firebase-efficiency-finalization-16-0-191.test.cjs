'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const scheduleEfficiency = require('../src/core/scheduleEfficiency.cjs');
const scheduleIdentity = require('../src/core/scheduleIdentity.cjs');
const cacheScope = require('../src/core/cacheScope.cjs');

const start = '2026-07-27';
const end = '2026-08-31';
const currentUser = {
  id: 'App-Allen',
  scheduleUserId: 'Sched-Allen',
  employeeId: 'EMP-Allen-001',
  rosterUserId: 'ROST-Allen',
  authUid: 'Auth-Allen',
  accountUserId: 'Acct-Allen',
  email: 'Allen@Example.com',
  employeeName: 'Allen Smith'
};
const baseRoster = [
  { id: 'Roster-Allen', scheduleUserId: 'Sched-Allen', employeeId: 'EMP-Allen-001', rosterUserId: 'ROST-Allen', authUid: 'Auth-Allen', employeeEmail: 'Allen@Example.com', employeeName: 'Allen Smith', isActive: true },
  { id: 'Roster-Bob', employeeId: 'EMP-Bob', employeeEmail: 'bob@example.com', employeeName: 'Bob Cook', isActive: true }
];

function makeRows() {
  const rows = [];
  for (let i = 0; i < 1600; i += 1) {
    rows.push({ id: `other-${String(i).padStart(4, '0')}`, employeeId: `EMP-Other-${i}`, scheduleDateKey: '2026-08-15', date: '2026-08-15', startTime: '09:00' });
  }
  rows.splice(1501, 0, { id: 'legacy-after-1500', employeeId: 'EMP-Allen-001', scheduleDateKey: '2026-08-15', date: '2026-08-15', startTime: '17:00' });
  rows.push({ id: 'date-only-legacy', employeeId: 'EMP-Allen-001', date: '2026-08-18', startTime: '11:00' });
  rows.push({ id: 'scheduleDateKey-only-legacy', employeeId: 'EMP-Allen-001', scheduleDateKey: '2026-08-19', startTime: '12:00' });
  rows.push({ id: 'imported-restored-legacy', employeeEmail: 'allen@example.com', date: '2026-08-20', restoredAt: '2026-08-02T12:00:00Z', importSource: 'legacy-csv', startTime: '13:00' });
  rows.push({ id: 'adjacent-month-pay-period', employeeId: 'EMP-Allen-001', date: '2026-07-30', startTime: '14:00' });
  rows.push({ id: 'unique-name-legacy', employeeName: 'Allen Smith', date: '2026-08-22', startTime: '15:00' });
  rows.push({ id: 'first-name-only', employeeName: 'Allen', date: '2026-08-23', startTime: '16:00' });
  return rows;
}

test('legacy rescue planner no longer fans arbitrary durable aliases through employeeId', () => {
  const plan = scheduleEfficiency.buildMyScheduleLegacyRescueQuerySources({ user: currentUser, roster: baseRoster, start, end, pageSize: 120 });
  assert.equal(plan.employeeIdIndexedQueryCount, 0);
  assert.deepEqual(plan.sources.map(src => src.id), ['legacy-scheduleDateKey-range', 'legacy-date-range']);
  assert.equal(plan.sources.some(src => src.identityField === 'employeeId'), false);
  assert.deepEqual(scheduleEfficiency.collectExactEmployeeIdValues(currentUser), ['EMP-Allen-001']);
  assert.equal(scheduleEfficiency.collectExactEmployeeIdValues(currentUser)[0], 'EMP-Allen-001');
});

test('single production identity matcher handles IDs, email, unique names, and ambiguous names', () => {
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ scheduleUserId: 'Sched-Allen', date: '2026-08-10' }, currentUser, baseRoster), true);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeId: 'EMP-Allen-001', date: '2026-08-10' }, currentUser, baseRoster), true);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ authUid: 'Auth-Allen', date: '2026-08-10' }, currentUser, baseRoster), true);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeEmail: 'allen@example.com', date: '2026-08-10' }, currentUser, baseRoster), true);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen Smith', date: '2026-08-10' }, currentUser, baseRoster), true);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-10' }, currentUser, baseRoster), true);
  const ambiguousRoster = [...baseRoster, { id: 'Roster-Allen-2', employeeId: 'EMP-Allen-2', employeeName: 'Allen Jones', isActive: true }];
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-10' }, currentUser, ambiguousRoster), false);
});

test('legacy rescue remains complete past 1500 rows and includes historical date forms', () => {
  const rescue = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: makeRows(), user: currentUser, roster: baseRoster, start, end, pageSize: 120 });
  const ids = new Set(rescue.matched.map(row => row.id));
  assert.equal(rescue.evaluatedAllPages, true);
  assert.equal(rescue.truncated, false);
  assert.ok(rescue.pageCount > 12);
  assert.ok(rescue.delivered > 1500);
  assert.ok(ids.has('legacy-after-1500'));
  assert.ok(ids.has('date-only-legacy'));
  assert.ok(ids.has('scheduleDateKey-only-legacy'));
  assert.ok(ids.has('imported-restored-legacy'));
  assert.ok(ids.has('adjacent-month-pay-period'));
  assert.ok(ids.has('unique-name-legacy'));
});

test('roster identity fingerprint changes when active/name/email identity state changes', () => {
  const rosterA = [...baseRoster, { id: 'Roster-Allen-2', employeeId: 'EMP-Allen-2', employeeName: 'Allen Jones', employeeEmail: 'allen2@example.com', isActive: true }];
  const rosterB = rosterA.map(row => row.id === 'Roster-Allen-2' ? { ...row, isActive: false } : row);
  const fpA = scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, rosterA);
  const fpB = scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, rosterB);
  assert.notEqual(fpA, fpB);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-23' }, currentUser, rosterA), false);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-23' }, currentUser, rosterB), true);
  const rosterC = baseRoster.map(row => row.id === 'Roster-Allen' ? { ...row, employeeEmail: 'allen.fixed@example.com' } : row);
  assert.notEqual(scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, baseRoster), scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, rosterC));
});

test('partial rescue failure is explicit and My Schedule has a visible retry warning path', () => {
  const rescue = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: makeRows(), user: currentUser, roster: baseRoster, start, end, pageSize: 120, failSourceId: 'legacy-date-range' });
  assert.equal(rescue.evaluatedAllPages, false);
  assert.equal(rescue.error, 'simulated-query-failure');
  const app = read('src/App.js');
  const schedule = read('src/features/schedule.jsx');
  assert.match(app, /myScheduleLegacyRescueState=/);
  assert.match(app, /onRetryMyScheduleLegacyRescue/);
  assert.match(schedule, /Schedule may be incomplete/);
  assert.match(schedule, /Retry legacy shifts/);
});

test('Refresh Brief scoped cache behavior remains Today-only', () => {
  const boundary = cacheScope.buildTodayBriefCacheBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u' });
  assert.equal(cacheScope.cacheEntryMatchesBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: 'today-brief', debugLabel: 'app:today:shifts' }, boundary), true);
  assert.equal(cacheScope.cacheEntryMatchesBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: '', debugLabel: 'app:schedule:my-schedule:shifts-date-plan' }, boundary), false);
  assert.equal(cacheScope.cacheEntryMatchesBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: '', debugLabel: 'app:team:workspace-members' }, boundary), false);
});

test('16.0.191 efficiency report documents no redundant employeeId fanout and incomplete-state behavior', () => {
  const report = JSON.parse(read('docs/firebase-efficiency-16.0.191-report.json'));
  assert.equal(report.version, '16.0.191');
  assert.equal(report.mySchedule.candidate.employeeIdIndexedQueryCount.value, 0);
  assert.equal(report.mySchedule.candidate.redundantEmployeeIdFanout.value, false);
  assert.equal(report.mySchedule.candidate.incompleteWarning.value, true);
  assert.equal(report.mySchedule.candidate.retryAction.value, true);
});

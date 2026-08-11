'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const scheduleEfficiency = require('../src/core/scheduleEfficiency.cjs');
const scheduleIdentity = require('../src/core/scheduleIdentity.cjs');
const scheduleRescueDiagnostics = require('../src/core/scheduleRescueDiagnostics.cjs');
const cacheScope = require('../src/core/cacheScope.cjs');

const start = '2026-07-27';
const end = '2026-08-31';
const currentUser = {
  id: 'App-Allen',
  scheduleUserId: 'Sched-Allen',
  employeeId: 'EMP-Allen-001',
  rosterUserId: 'ROST-Allen',
  authUid: 'Auth-Allen',
  uid: 'FirebaseUid-Allen',
  accountUserId: 'Acct-Allen',
  email: 'Allen@Example.com',
  employeeName: 'Allen Smith'
};
const baseRoster = [
  { id: 'Roster-Allen', scheduleUserId: 'Sched-Allen', employeeId: 'EMP-Allen-001', rosterUserId: 'ROST-Allen', authUid: 'Auth-Allen', uid: 'FirebaseUid-Allen', userId: 'User-Allen', accountUserId: 'Acct-Allen', employeeEmail: 'Allen@Example.com', employeeName: 'Allen Smith', isActive: true },
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
  rows.push({ id: 'duplicate-current-user', employeeId: 'EMP-Allen-001', scheduleDateKey: '2026-08-24', date: '2026-08-24', startTime: '17:30' });
  return rows;
}

function fixtureRescue() {
  return scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: makeRows(), user: currentUser, roster: baseRoster, start, end, pageSize: 120 });
}

test('scheduleQueryPlanner no longer contains a second My Schedule identity algorithm', () => {
  const qp = read('src/core/scheduleQueryPlanner.js');
  assert.match(qp, /scheduleIdentity\.shiftMatchesMyScheduleIdentity\(shift, user, roster\)/);
  assert.match(qp, /scheduleIdentity\.collectDurableAliases/);
  assert.doesNotMatch(qp, /const MY_SCHEDULE_ID_FIELDS/);
  assert.doesNotMatch(qp, /function normalizeMyScheduleEmailValue/);
  assert.doesNotMatch(qp, /const uniqueRosterMatch/);
  assert.doesNotMatch(qp, /fallback to this duplicate algorithm/i);
});

test('one production matcher covers IDs, email, names, ambiguous names, inactive duplicate, and missing identity', () => {
  const cases = [
    ['scheduleUserId', { scheduleUserId: 'Sched-Allen' }, true],
    ['employeeId', { employeeId: 'EMP-Allen-001' }, true],
    ['rosterUserId', { rosterUserId: 'ROST-Allen' }, true],
    ['userId', { userId: 'User-Allen' }, true],
    ['Auth UID', { authUid: 'Auth-Allen' }, true],
    ['account user ID', { accountUserId: 'Acct-Allen' }, true],
    ['email', { employeeEmail: 'allen@example.com' }, true],
    ['full name', { employeeName: 'Allen Smith' }, true],
    ['unique first name', { employeeName: 'Allen' }, true],
    ['missing identity', { employeeName: 'Unknown Person' }, false]
  ];
  for (const [label, shift, expected] of cases) {
    assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ ...shift, date: '2026-08-10' }, currentUser, baseRoster), expected, label);
  }
  const ambiguousRoster = [...baseRoster, { id: 'Roster-Allen-2', employeeId: 'EMP-Allen-2', employeeName: 'Allen Jones', isActive: true }];
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-10' }, currentUser, ambiguousRoster), false, 'ambiguous first name');
  const inactiveDuplicate = ambiguousRoster.map(row => row.id === 'Roster-Allen-2' ? { ...row, isActive: false } : row);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-10' }, currentUser, inactiveDuplicate), true, 'inactive duplicate no longer ambiguous');
  assert.equal(scheduleEfficiency.shiftMatchesMyScheduleIdentity, scheduleIdentity.shiftMatchesMyScheduleIdentity);
});

test('employeeId equality filters are not produced from arbitrary durable aliases and exact case is preserved', () => {
  const plan = scheduleEfficiency.buildMyScheduleLegacyRescueQuerySources({ user: currentUser, roster: baseRoster, start, end, pageSize: 120 });
  assert.equal(plan.employeeIdIndexedQueryCount, 0);
  assert.equal(plan.sources.some(src => src.identityField === 'employeeId'), false);
  assert.deepEqual(plan.sources.map(src => src.id), ['legacy-scheduleDateKey-range', 'legacy-date-range']);
  assert.deepEqual(scheduleEfficiency.collectExactEmployeeIdValues(currentUser), ['EMP-Allen-001']);
  assert.equal(scheduleEfficiency.collectMyScheduleDurableAliases(currentUser).includes('sched-allen'), true, 'scheduleUserId can be a matcher alias');
  assert.equal(plan.sources.some(src => src.identityValue === 'sched-allen'), false, 'scheduleUserId not queried as employeeId');
});

test('legacy rescue metrics are measured from the 1600+ fixture and preserve all required historical forms', () => {
  const rescue = fixtureRescue();
  const ids = new Set(rescue.matched.map(row => row.id));
  assert.equal(rescue.evaluatedAllPages, true);
  assert.equal(rescue.truncated, false);
  assert.ok(rescue.pageCount > 12);
  assert.ok(rescue.delivered > 1500);
  assert.equal(rescue.queryRequestCount, rescue.scheduleDateKeyPageCount + rescue.datePageCount);
  assert.ok(rescue.scheduleDateKeyPageCount > 0);
  assert.ok(rescue.datePageCount > 0);
  assert.ok(rescue.duplicateDeliveries > 0);
  assert.equal(rescue.employeeIdIndexedQueryCount, 0);
  for (const id of ['legacy-after-1500', 'date-only-legacy', 'scheduleDateKey-only-legacy', 'imported-restored-legacy', 'adjacent-month-pay-period', 'unique-name-legacy', 'first-name-only']) {
    assert.ok(ids.has(id), id);
  }
});

test('roster identity fingerprint changes rerun conditions for active/name/email identity state', () => {
  const rosterA = [...baseRoster, { id: 'Roster-Allen-2', employeeId: 'EMP-Allen-2', employeeName: 'Allen Jones', employeeEmail: 'allen2@example.com', isActive: true }];
  const rosterB = rosterA.map(row => row.id === 'Roster-Allen-2' ? { ...row, isActive: false } : row);
  assert.notEqual(scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, rosterA), scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, rosterB));
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-23' }, currentUser, rosterA), false);
  assert.equal(scheduleIdentity.shiftMatchesMyScheduleIdentity({ employeeName: 'Allen', date: '2026-08-23' }, currentUser, rosterB), true);
  const rosterC = baseRoster.map(row => row.id === 'Roster-Allen' ? { ...row, employeeEmail: 'allen.fixed@example.com' } : row);
  assert.notEqual(scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, baseRoster), scheduleEfficiency.buildMyScheduleRosterIdentityFingerprint(currentUser, rosterC));
});

test('retry telemetry records real user retries and success/failure state can be truthful', () => {
  let t = scheduleEfficiency.advanceMyScheduleRescueRetryTelemetry({}, { contextKey: 'r|u|range', refreshKey: 0 });
  assert.equal(t.retryCount, 0);
  const failed = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: makeRows(), user: currentUser, roster: baseRoster, start, end, pageSize: 120, failSourceId: 'legacy-date-range' });
  assert.equal(failed.error, 'simulated-query-failure');
  assert.equal(failed.evaluatedAllPages, false);
  assert.equal(failed.lastAttemptSucceeded, false);
  t = scheduleEfficiency.advanceMyScheduleRescueRetryTelemetry(t, { contextKey: 'r|u|range', refreshKey: 1 });
  assert.equal(t.retryCount, 1);
  const success = fixtureRescue();
  assert.equal(success.evaluatedAllPages, true);
  assert.equal(success.lastAttemptSucceeded, true);
  t = scheduleEfficiency.advanceMyScheduleRescueRetryTelemetry(t, { contextKey: 'r|u|range', refreshKey: 2 });
  assert.equal(t.retryCount, 2);
  const reset = scheduleEfficiency.advanceMyScheduleRescueRetryTelemetry(t, { contextKey: 'r|other|range', refreshKey: 2 });
  assert.equal(reset.retryCount, 0);
});

test('staff sees plain incomplete warning while privileged diagnostics are sanitized', () => {
  const staff = { id: 'staff1', permissions: { schedule: true } };
  const owner = { id: 'owner1', isOwner: true };
  const raw = 'FirebaseError: permission-denied token=abc123 apiKey=secret stack line 1';
  const staffView = scheduleRescueDiagnostics.buildMyScheduleIncompleteWarningView({ user: staff, error: raw, incomplete: true });
  assert.equal(staffView.visible, true);
  assert.equal(staffView.retryVisible, true);
  assert.equal(staffView.technicalError, '');
  const ownerView = scheduleRescueDiagnostics.buildMyScheduleIncompleteWarningView({ user: owner, error: raw, incomplete: true });
  assert.match(ownerView.technicalError, /FirebaseError/);
  assert.doesNotMatch(ownerView.technicalError, /abc123|secret/);
});

test('16.0.192 report contains measured rescue telemetry from the deterministic fixture', () => {
  const report = JSON.parse(read('docs/firebase-efficiency-16.0.192-report.json'));
  const metrics = report.mySchedule.candidate.rescueMetrics;
  assert.equal(report.version, '16.0.192');
  for (const key of ['queryRequestCount', 'scheduleDateKeyPageCount', 'datePageCount', 'documentsDelivered', 'duplicateDeliveries', 'uniqueMatchingLegacyRows', 'employeeIdIndexedQueryCount']) {
    assert.equal(metrics[key].label, 'MEASURED', key);
    assert.equal(typeof metrics[key].value, 'number', key);
  }
  assert.equal(metrics.employeeIdIndexedQueryCount.value, 0);
  assert.equal(metrics.evaluatedAllPages.value, true);
  assert.equal(metrics.truncated.value, false);
});

test('Refresh Brief scoped cache behavior remains green', () => {
  const boundary = cacheScope.buildTodayBriefCacheBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u' });
  assert.equal(cacheScope.cacheEntryMatchesBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: 'today-brief', debugLabel: 'app:today:shifts' }, boundary), true);
  assert.equal(cacheScope.cacheEntryMatchesBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: '', debugLabel: 'app:schedule:my-schedule:shifts-date-plan' }, boundary), false);
  assert.equal(cacheScope.cacheEntryMatchesBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: '', debugLabel: 'app:team:workspace-members' }, boundary), false);
});

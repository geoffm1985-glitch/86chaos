'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const scheduleEfficiency = require('../src/core/scheduleEfficiency.cjs');
const todayDemand = require('../src/core/todayDemandPlan.cjs');
const cacheScope = require('../src/core/cacheScope.cjs');

const start = '2026-08-01';
const end = '2026-08-31';
const currentUser = { id: 'app-allen', scheduleUserId: 'sched-allen', employeeId: 'emp-allen', rosterUserId: 'rost-allen', email: 'allen@example.com', employeeName: 'Allen Smith' };
const roster = [currentUser, { id: 'app-bob', employeeId: 'emp-bob', email: 'bob@example.com', employeeName: 'Bob Cook' }];

function makeLargeScheduleFixture() {
  const rows = [];
  for (let i = 0; i < 1600; i += 1) {
    rows.push({ id: `other-${String(i).padStart(4, '0')}`, employeeId: `other-${i}`, scheduleDateKey: '2026-08-15', date: '2026-08-15', startTime: '09:00' });
  }
  rows.splice(1500, 0, { id: 'legacy-after-1500', employeeId: 'emp-allen', scheduleDateKey: '2026-08-15', date: '2026-08-15', startTime: '17:00' });
  rows.push({ id: 'date-only-legacy', employeeId: 'emp-allen', date: '2026-08-18', startTime: '11:00' });
  rows.push({ id: 'scheduleDateKey-only-legacy', employeeId: 'emp-allen', scheduleDateKey: '2026-08-19', startTime: '12:00' });
  rows.push({ id: 'email-legacy', employeeEmail: 'allen@example.com', date: '2026-08-20', startTime: '13:00' });
  rows.push({ id: 'name-legacy-unique', employeeName: 'Allen Smith', date: '2026-08-21', startTime: '14:00' });
  rows.push({ id: 'ambiguous-first-name', employeeName: 'Allen', date: '2026-08-22', startTime: '15:00' });
  return rows;
}

test('My Schedule legacy rescue evaluates the bounded range past 1,440 rows with no silent maxPages ceiling', () => {
  const workspaceRows = makeLargeScheduleFixture();
  const rescue = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows, user: currentUser, roster, start, end, pageSize: 120 });
  assert.equal(rescue.evaluatedAllPages, true);
  assert.equal(rescue.truncated, false);
  assert.ok(rescue.pageCount > 12, 'rescue exhausted the date window instead of stopping after maxPages=12');
  assert.ok(rescue.delivered > 1440);
  assert.ok(rescue.matched.some(row => row.id === 'legacy-after-1500'));
  assert.ok(rescue.querySourcesUsed.includes('legacy-scheduleDateKey-range'));
  assert.ok(rescue.querySourcesUsed.includes('legacy-date-range'));
});

test('My Schedule rescues date-only, scheduleDateKey-only, email, and unique-name legacy forms safely', () => {
  const rescue = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: makeLargeScheduleFixture(), user: currentUser, roster, start, end, pageSize: 120 });
  const ids = new Set(rescue.matched.map(row => row.id));
  assert.ok(ids.has('date-only-legacy'));
  assert.ok(ids.has('scheduleDateKey-only-legacy'));
  assert.ok(ids.has('email-legacy'));
  assert.ok(ids.has('name-legacy-unique'));
});

test('ambiguous first-name legacy fixture is not assigned to the current employee', () => {
  const ambiguousRoster = [currentUser, { id: 'app-allen-2', employeeId: 'emp-allen-2', employeeName: 'Allen Jones' }];
  const rescue = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: makeLargeScheduleFixture(), user: currentUser, roster: ambiguousRoster, start, end, pageSize: 120 });
  assert.equal(rescue.matched.some(row => row.id === 'ambiguous-first-name'), false);
});

test('canonical primary query remains employee-specific while legacy rescue sources cover old forms', () => {
  const app = read('src/App.js');
  assert.match(app, /usePaginatedMyScheduleLegacyRescue\(/);
  assert.doesNotMatch(app, /maxPages:\s*12/);
  assert.match(app, /roster:\s*users \|\| \[\]/);
  const plan = scheduleEfficiency.buildMyScheduleLegacyRescueQuerySources({ user: currentUser, roster, start, end, pageSize: 120 });
  assert.equal(plan.employeeIdIndexedQueryCount, 0);
  assert.equal(plan.sources.some(src => src.type === 'identity-date' && src.identityField === 'employeeId'), false);
  assert.ok(plan.sources.some(src => src.dateField === 'scheduleDateKey'));
  assert.ok(plan.sources.some(src => src.dateField === 'date'));
});

test('Refresh Brief cache invalidation is scoped to today-brief and preserves Schedule/Team caches', () => {
  const boundary = cacheScope.buildTodayBriefCacheBoundary({ projectId: 'p', restaurantId: 'r', viewerUid: 'u' });
  const todayShift = { projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: 'today-brief', debugLabel: 'app:today:shifts' };
  const todayAlert = { projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: 'today-brief', debugLabel: 'app:today:restaurant-admin-alerts' };
  const schedule = { projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: '', debugLabel: 'app:schedule:my-schedule:shifts-date-plan' };
  const team = { projectId: 'p', restaurantId: 'r', viewerUid: 'u', cacheScope: '', debugLabel: 'app:team:workspace-members' };
  assert.equal(cacheScope.cacheEntryMatchesBoundary(todayShift, boundary), true);
  assert.equal(cacheScope.cacheEntryMatchesBoundary(todayAlert, boundary), true);
  assert.equal(cacheScope.cacheEntryMatchesBoundary(schedule, boundary), false);
  assert.equal(cacheScope.cacheEntryMatchesBoundary(team, boundary), false);
});

test('Today demand plan reports scoped refresh and zero unrelated cache rereads', () => {
  const plan = todayDemand.buildTodayDemandPlan();
  assert.equal(plan.cacheScope, 'today-brief');
  assert.equal(plan.scopedRefresh.invalidatesScope, 'today-brief');
  assert.equal(plan.scopedRefresh.nonTodayCacheInvalidations, 0);
  assert.equal(plan.scopedRefresh.ttlMs, 45000);
  assert.equal(plan.scopedRefresh.usesRefreshKey, true);
  assert.equal(todayDemand.buildTodayDemandPlan({ cacheHit: true }).snapshotRequests, 0);
  assert.equal(todayDemand.buildTodayDemandPlan({ cacheHit: true, manualRefresh: true }).snapshotRequests, Object.keys(plan.candidate).length);
});

test('live Today wiring uses stable TTL, refreshKey, and today-brief cache scope', () => {
  const app = read('src/App.js');
  const operations = read('src/features/operations.jsx');
  assert.match(app, /const TODAY_SNAPSHOT_TTL_MS = 45_000/);
  assert.doesNotMatch(app, /45_000 \+ todayRefreshNonce/);
  assert.match(app, /cacheScope:\s*'today-brief'/);
  assert.match(app, /refreshKey:\s*wantsToday \? todayRefreshNonce : 0/);
  assert.match(operations, /cacheScope:\s*'today-brief'/);
  assert.match(operations, /refreshKey:\s*Number\(briefRefreshNonce \|\| 0\)/);
  assert.doesNotMatch(operations, /45_000 \+ Number\(briefRefreshNonce/);
});

test('16.0.190 efficiency report is truthful about >1440 rescue and scoped Refresh Brief', () => {
  const report = JSON.parse(read('docs/firebase-efficiency-16.0.190-report.json'));
  assert.equal(report.version, '16.0.190');
  assert.equal(report.mySchedule.candidate.legacyBeyond1500Visible.value, true);
  assert.equal(report.mySchedule.candidate.truncated.value, false);
  assert.equal(report.today.candidate.refreshBrief.nonTodayCacheInvalidations.value, 0);
  assert.equal(report.today.candidate.refreshBrief.invalidates.value, 'today-brief only');
});

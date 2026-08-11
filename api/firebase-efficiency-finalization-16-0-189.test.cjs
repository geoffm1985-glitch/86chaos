'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const presenceTruth = require('../src/core/presenceTruth.cjs');
const todayDemand = require('../src/core/todayDemandPlan.cjs');
const menuPagination = require('../src/core/menuScanPagination.cjs');
const scheduleEfficiency = require('../src/core/scheduleEfficiency.cjs');

function makeScans(count) {
  return Array.from({ length: count }, (_, idx) => ({ id: `scan-${String(idx + 1).padStart(3, '0')}`, createdAt: `2026-08-${String(Math.floor(idx / 4) + 1).padStart(2, '0')}T${String(23 - (idx % 20)).padStart(2, '0')}:00:00.000Z` }));
}

function makeScheduleRows() {
  const rows = [];
  for (let i = 1; i <= 199; i += 1) rows.push({ id: `other-${String(i).padStart(3, '0')}`, employeeId: `other-${i}`, scheduleDateKey: '2026-08-11', date: '2026-08-11', startTime: '09:00' });
  rows.splice(150, 0, { id: 'legacy-current-after-120', employeeId: 'legacy-current', scheduleDateKey: '2026-08-11', date: '2026-08-11', startTime: '17:00' });
  rows.unshift({ id: 'canonical-current', scheduleUserId: 'sched-current', scheduleDateKey: '2026-08-11', date: '2026-08-11', startTime: '08:00' });
  return rows;
}

test('authoritative RTDB session remains online beyond 90 seconds and offline is honored', () => {
  const now = Date.parse('2026-08-11T12:00:00.000Z');
  const old = now - (12 * 60 * 1000);
  const active = presenceTruth.classifySystemAdminPresenceRow({ online: true, state: 'online', presenceSource: 'rtdb-status-sessions-api', connectedAt: old }, { nowMs: now, fetchedAtMs: now, fallbackOnlineWindowMs: 90_000 });
  const offline = presenceTruth.classifySystemAdminPresenceRow({ online: false, state: 'offline', presenceSource: 'rtdb-status-sessions-api', connectedAt: old }, { nowMs: now, fetchedAtMs: now, fallbackOnlineWindowMs: 90_000 });
  assert.equal(active.online, true);
  assert.equal(active.reason, 'active-rtdb-status-session');
  assert.equal(offline.online, false);
});

test('presence connect does not duplicate online statusSummary and disconnect preserves Last Seen', () => {
  assert.deepEqual(presenceTruth.buildPresenceMutationPlan('connect'), { sessionWrites: 1, statusSummaryOnlineWrites: 0, lastSeenWrites: 0, sessionRemovals: 0, heartbeatWrites: 0, firestoreWrites: 0 });
  assert.deepEqual(presenceTruth.buildPresenceMutationPlan('disconnect'), { sessionWrites: 0, statusSummaryOnlineWrites: 0, lastSeenWrites: 1, sessionRemovals: 1, heartbeatWrites: 0, firestoreWrites: 0 });
  assert.equal(presenceTruth.aggregateSessionPresence([{ online: true }, { online: false }]).online, true);
  assert.equal(presenceTruth.aggregateSessionPresence([]).online, false);
});

test('Today demand plan includes admin alerts and ops intelligence with no live listeners', () => {
  const plan = todayDemand.buildTodayDemandPlan();
  assert.equal(plan.candidate.restaurantAdminAlerts, 8);
  assert.equal(plan.candidate.opsIntelligenceReports, 3);
  assert.equal(plan.activeListeners, 0);
  assert.equal(plan.candidateMaxInitialDocs, 277);
  assert.equal(todayDemand.buildTodayDemandPlan({ cacheHit: true }).snapshotRequests, 0);
  assert.equal(todayDemand.buildTodayDemandPlan({ cacheHit: true, manualRefresh: true }).snapshotRequests, Object.keys(plan.candidate).length);
});

test('live Today wiring uses Refresh Brief and avoids ops-intelligence live listener', () => {
  const app = read('src/App.js');
  const operations = read('src/features/operations.jsx');
  assert.match(app, /onRefreshBrief=\{refreshTodayBrief\}/);
  assert.match(operations, /data-testid="refresh-manager-brief"/);
  assert.match(operations, /useLiveCollection\('opsIntelligenceReports'[^;]+live:\s*false/s);
  assert.doesNotMatch(operations, /useLiveCollectionState\('opsIntelligenceReports'/);
});

test('Menu scan cursor pagination appends page 2 without rereading page 1', () => {
  const page = menuPagination.simulateCursorPagination(makeScans(45), 20);
  const p1 = new Set(page.page1.map(row => row.id));
  assert.equal(page.page1.length, 20);
  assert.equal(page.page2.length, 20);
  assert.equal(page.page2.some(row => p1.has(row.id)), false);
  assert.equal(page.combined.length, 40);
  const intelligence = read('src/features/intelligence.jsx');
  assert.match(intelligence, /startAfter\(scanCursor\)/);
  assert.doesNotMatch(intelligence, /setScanPageLimit\(v => v \+ 20\)/);
});

test('live My Schedule rescue paginates past 120 and merge excludes other employees', () => {
  const user = { id: 'current', scheduleUserId: 'sched-current', employeeId: 'legacy-current', email: 'cook@example.com' };
  const rows = makeScheduleRows();
  const rescue = scheduleEfficiency.simulatePaginatedMyScheduleLegacyRescue({ workspaceRows: rows, user, pageSize: 120 });
  const canonical = rows.filter(row => row.scheduleUserId === 'sched-current');
  const merged = scheduleEfficiency.mergeMyScheduleCanonicalAndLegacy({ canonical, legacyPages: rescue.pages, user });
  assert.ok(rescue.delivered > 120);
  assert.ok(merged.some(row => row.id === 'legacy-current-after-120'));
  assert.ok(merged.some(row => row.id === 'canonical-current'));
  assert.equal(merged.some(row => String(row.id).startsWith('other-')), false);
  const app = read('src/App.js');
  assert.match(app, /usePaginatedMyScheduleLegacyRescue/);
  assert.match(app, /mergeMyScheduleCanonicalAndLegacy/);
});

test('modern QA shift payloads use canonical date fields while legacy fixtures stay distinguishable', () => {
  const fields = scheduleEfficiency.buildCanonicalShiftDateFields('2026-08-11');
  assert.deepEqual(fields, { date: '2026-08-11', scheduleDateKey: '2026-08-11', shiftDate: '2026-08-11', scheduleMonth: '2026-08' });
  const management = read('src/features/management.jsx');
  assert.match(management, /createModernQaShiftPayload/);
  assert.match(management, /modernQaFixture:\s*true/);
  assert.match(management, /buildCanonicalShiftDateFields\(dateValue\)/);
});

test('corrected efficiency report records truthful Today and My Schedule metrics', () => {
  const report = JSON.parse(read('docs/firebase-efficiency-16.0.189-report.json'));
  assert.equal(report.version, '16.0.189');
  assert.equal(report.today.candidate.activeListeners.value, 0);
  assert.equal(report.today.candidate.initialDocuments.value, 277);
  assert.equal(report.today.candidate.snapshotRequests.value, 11);
  assert.equal(report.menu.dependencyDocsBeforeGraph.candidate, 0);
  assert.equal(report.mySchedule.candidate.legacyBeyond120Visible.value, true);
  assert.equal(report.bulkAudit.reviewResult.value, 'reviewed, intentionally preserved');
});

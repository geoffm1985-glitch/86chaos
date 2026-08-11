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

function makeRows(count) {
  const rows = [];
  for (let i = 1; i <= count; i += 1) rows.push({ id: `scan-${String(i).padStart(3, '0')}`, createdAt: `2026-08-${String(Math.ceil(i / 4)).padStart(2, '0')}T${String(23 - (i % 20)).padStart(2, '0')}:00:00.000Z` });
  return rows;
}

test('System Administrator authoritative RTDB session remains online beyond 90 seconds', () => {
  const now = Date.parse('2026-08-11T12:00:00.000Z');
  const old = now - (12 * 60 * 1000);
  const active = presenceTruth.classifySystemAdminPresenceRow({ online: true, state: 'online', presenceSource: 'rtdb-status-sessions-api', connectedAt: old }, { nowMs: now, fetchedAtMs: now, fallbackOnlineWindowMs: 90_000 });
  assert.equal(active.online, true);
  assert.equal(active.reason, 'active-rtdb-status-session');
  const offline = presenceTruth.classifySystemAdminPresenceRow({ online: false, state: 'offline', presenceSource: 'rtdb-status-sessions-api', connectedAt: old }, { nowMs: now, fetchedAtMs: now, fallbackOnlineWindowMs: 90_000 });
  assert.equal(offline.online, false);
});

test('presence connect writes one session only and disconnect updates Last Seen', () => {
  assert.deepEqual(presenceTruth.buildPresenceMutationPlan('connect'), { sessionWrites: 1, statusSummaryOnlineWrites: 0, lastSeenWrites: 0, sessionRemovals: 0, heartbeatWrites: 0, firestoreWrites: 0 });
  assert.deepEqual(presenceTruth.buildPresenceMutationPlan('disconnect'), { sessionWrites: 0, statusSummaryOnlineWrites: 0, lastSeenWrites: 1, sessionRemovals: 1, heartbeatWrites: 0, firestoreWrites: 0 });
  assert.equal(presenceTruth.aggregateSessionPresence([{ online: true }, { online: true }]).online, true);
  assert.equal(presenceTruth.aggregateSessionPresence([{ online: true }, { online: false }]).activeSessionCount, 1);
  assert.equal(presenceTruth.aggregateSessionPresence([]).online, false);
  const source = read('src/core/appCore.js');
  assert.match(source, /rtdbSet\(sessionRef, onlinePayload\)/);
  assert.doesNotMatch(source, /rtdbSet\(summaryRef, \{ \.\.\.onlinePayload/);
});

test('Team presence cache suppresses repeat API fetch inside TTL', async () => {
  let calls = 0;
  const cache = presenceTruth.createTtlRequestCache(45_000);
  const load = async () => { calls += 1; return [{ id: 'u1' }]; };
  const first = await cache('proj:rest', load, 1000);
  const second = await cache('proj:rest', load, 40_000);
  const third = await cache('proj:rest', load, 50_500);
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(third.fromCache, false);
  assert.equal(calls, 2);
});

test('Today demand plan remains bounded without adding live listeners', () => {
  const plan = todayDemand.buildTodayDemandPlan();
  assert.equal(plan.candidateMaxInitialDocs, 277);
  assert.ok(plan.candidateMaxInitialDocs <= plan.baselineMaxInitialDocs);
  assert.equal(plan.activeListeners, 0);
  assert.equal(plan.candidate.shifts, 48);
  assert.equal(plan.candidate.timePunches, 18);
  assert.equal(plan.candidate.restaurantAdminAlerts, 8);
  assert.equal(plan.candidate.opsIntelligenceReports, 3);
});

test('Menu scan cursor pagination appends page 2 without rereading page 1', () => {
  const rows = makeRows(45);
  const page = menuPagination.simulateCursorPagination(rows, 20);
  assert.equal(page.page1.length, 20);
  assert.equal(page.page2.length, 20);
  const p1 = new Set(page.page1.map(r => r.id));
  assert.equal(page.page2.some(r => p1.has(r.id)), false);
  assert.equal(page.combined.length, 40);
  assert.equal(new Set(page.combined.map(r => r.id)).size, 40);
  const src = read('src/features/intelligence.jsx');
  assert.match(src, /startAfter\(scanCursor\)/);
  assert.doesNotMatch(src, /setScanPageLimit\(v => v \+ 20\)/);
});

test('My Schedule helper keeps matching legacy shift beyond broad cap and excludes other employees', () => {
  const user = { id: 'emp-current', scheduleUserId: 'sched-current', employeeId: 'legacy-current', email: 'cook@example.com' };
  const canonical = [{ id: 'can-1', scheduleUserId: 'sched-current', date: '2026-08-11', startTime: '09:00' }];
  const first120 = Array.from({ length: 120 }, (_, idx) => ({ id: `other-${idx}`, employeeId: `other-${idx}`, scheduleDateKey: '2026-08-11', date: '2026-08-11' }));
  const beyond120 = [{ id: 'legacy-current-beyond-120', employeeId: 'legacy-current', scheduleDateKey: '2026-08-12', date: '2026-08-12' }];
  const merged = scheduleEfficiency.mergeMyScheduleCanonicalAndLegacy({ canonical, legacyPages: [first120, beyond120], user });
  assert.ok(merged.some(row => row.id === 'can-1'));
  assert.ok(merged.some(row => row.id === 'legacy-current-beyond-120'));
  assert.equal(merged.some(row => String(row.id).startsWith('other-')), false);
});

test('canonical shift writer payloads use synchronized date fields', () => {
  const fields = scheduleEfficiency.buildCanonicalShiftDateFieldsForTest('2026-08-11');
  assert.deepEqual(fields, { date: '2026-08-11', scheduleDateKey: '2026-08-11', shiftDate: '2026-08-11', scheduleMonth: '2026-08' });
  const scheduleSource = read('src/features/schedule.jsx');
  const importSource = read('api/import-cheers-july-schedule.js');
  assert.match(scheduleSource, /\.\.\.buildCanonicalShiftDateFields\(dateKey\)/);
  assert.match(importSource, /shiftDate: date/);
});

test('bulk safeWrite/audit review preserves unsafe workflows and documents no-op path', () => {
  const report = read('docs/firebase-efficiency-16.0.189-report.md');
  assert.match(report, /PAR two-digit typing/);
  assert.match(report, /retained/);
  assert.match(report, /Deferred/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./_schedule-publish-core.cjs');
const service = require('./_schedule-publish-service.cjs');

const roles = [{ id: 'r1', name: 'Kitchen', revision: 1, previousNames: [] }];
const roleRevision = 'roles-v1|r1:1:0:kitchen:';

function evidence(shift, person) {
  const expected = core.expectedFingerprint(shift, core.resolveRole(shift, roles), person);
  const { contentDigest, ...state } = expected;
  return { id: shift.id, contentDigest, state };
}

test('top-level navigation leaves Schedule Builder synchronously instead of deferring the route update', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/App.js'), 'utf8');
  const start = source.indexOf('const transitionActiveTabState = useCallback((nextTab) => {');
  const end = source.indexOf('const disarmPwaBackExit', start);
  assert.ok(start >= 0 && end > start, 'top-level transition block exists');
  const block = source.slice(start, end);
  assert.match(block, /activeTabStateRef\.current = normalized;\s*setActiveTabState\(normalized\);/);
  assert.doesNotMatch(block, /React\.startTransition/);
});

test('canonical workspace member merge preserves matched user display identity while membership identity remains canonical', async () => {
  const makeDoc = (id, data) => ({ id, data: () => data });
  const user = {
    restaurantId: 'tenant', userId: 'u1', authUid: 'u1', employeeId: 'e1', scheduleUserId: 'e1',
    rosterUserId: 'e1', name: 'Employee One', email: 'one@example.invalid', isActive: true
  };
  const member = {
    restaurantId: 'tenant', userId: 'u1', employeeId: '', scheduleUserId: '', rosterUserId: '',
    name: '', email: '', isActive: true
  };
  const db = { collection(name) { return { where() { return this; }, get: async () => ({ docs: name === 'users' ? [makeDoc('u1', user)] : [makeDoc('m1', member)] }) }; } };
  const people = await service.loadRosterPeople(db, 'tenant');
  assert.equal(people.length, 1);
  assert.equal(people[0]._source, 'canonical');
  assert.equal(people[0].scheduleUserId, 'm1');
  assert.equal(people[0].employeeId, 'm1');
  assert.equal(people[0].rosterUserId, 'm1');
  assert.equal(people[0].name, 'Employee One');
  assert.equal(people[0].email, 'one@example.invalid');
});

test('server can publish a confirmed legacy shift using the same shift-only identity fallback the Schedule Builder renders', () => {
  const shift = {
    id: 'legacy-shift-1', restaurantId: 'tenant', date: '2026-09-20', scheduleDateKey: '2026-09-20',
    employeeId: 'legacy-e1', employeeName: 'Legacy Employee', role: 'Kitchen', rosterRoleId: 'r1',
    rosterRoleNameSnapshot: 'Kitchen', startTime: '09:00', endTime: '17:00', revision: 1, updatedAt: 'v1'
  };
  const clientSynthetic = {
    id: 'legacy-e1', uid: 'legacy-e1', userId: 'legacy-e1', scheduleUserId: 'legacy-e1', employeeId: 'legacy-e1',
    name: 'Legacy Employee', displayName: 'Legacy Employee', fullName: 'Legacy Employee', email: '', emailLower: '',
    role: 'Kitchen', restaurantId: 'tenant', isActive: true, scheduleOnly: true, source: 'shift-roster-fallback'
  };
  const resolved = service.resolveEmployeeForPublishShift(shift, []);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.source, 'shift-identity-fallback');
  const plan = core.buildCanonicalServerPlan({
    restaurantId: 'tenant', operationId: 'operation_1717_legacy_publish', dayKeys: ['2026-09-20'], allRoles: true,
    roles, shifts: [{ ...shift, _employeeResolution: resolved }], expectedShifts: [evidence(shift, clientSynthetic)],
    roleConfigurationRevision: roleRevision
  });
  assert.deepEqual(plan.candidates.map(row => row.id), ['legacy-shift-1']);
  assert.deepEqual(plan.unresolvedEmployees, []);
  assert.equal(plan.candidates[0].employeeId, 'legacy-e1');
});

test('legacy shift-only identity fallback does not override a real inactive roster identity', () => {
  const shift = {
    id: 'inactive-shift', restaurantId: 'tenant', date: '2026-09-20', scheduleDateKey: '2026-09-20',
    employeeId: 'inactive-e1', employeeName: 'Inactive Employee', role: 'Kitchen', rosterRoleId: 'r1',
    rosterRoleNameSnapshot: 'Kitchen', startTime: '09:00', endTime: '17:00'
  };
  const resolved = service.resolveEmployeeForPublishShift(shift, [{ id: 'inactive-e1', employeeId: 'inactive-e1', name: 'Inactive Employee', isActive: false }]);
  assert.equal(resolved.ok, false);
});

test('legacy shift-only identity fallback requires the same named shift identity the browser uses', () => {
  const shift = { id: 'id-only', restaurantId: 'tenant', employeeId: 'legacy-e1' };
  const resolved = service.resolveEmployeeForPublishShift(shift, []);
  assert.equal(resolved.ok, false);
});

test('nineteen legacy schedule-only employees become publish candidates instead of employee-review rows', () => {
  const shifts = Array.from({ length: 19 }, (_, index) => ({
    id: `legacy-${index + 1}`, restaurantId: 'tenant', date: '2026-09-20', scheduleDateKey: '2026-09-20',
    employeeId: `legacy-e${index + 1}`, employeeName: `Legacy Employee ${index + 1}`, role: 'Kitchen', rosterRoleId: 'r1',
    rosterRoleNameSnapshot: 'Kitchen', startTime: '09:00', endTime: '17:00', revision: 1, updatedAt: `v${index + 1}`
  }));
  const resolvedShifts = shifts.map(shift => ({ ...shift, _employeeResolution: service.resolveEmployeeForPublishShift(shift, []) }));
  const expectedShifts = shifts.map(shift => evidence(shift, service.buildShiftIdentityFallback(shift)));
  const plan = core.buildCanonicalServerPlan({
    restaurantId: 'tenant', operationId: 'operation_1717_nineteen_legacy', dayKeys: ['2026-09-20'], allRoles: true,
    roles, shifts: resolvedShifts, expectedShifts, roleConfigurationRevision: roleRevision
  });
  assert.equal(plan.candidates.length, 19);
  assert.equal(plan.unresolvedEmployees.length, 0);
});


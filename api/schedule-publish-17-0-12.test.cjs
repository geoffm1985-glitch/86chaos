'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./_schedule-publish-core.cjs');
const rolesCore = require('../src/core/rosterRoleIdentityCore.cjs');

const root = path.resolve(__dirname, '..');
const plannerSource = () => fs.readFileSync(path.join(root, 'src/core/scheduleQueryPlanner.js'), 'utf8');

const role = { id: 'kitchen', name: 'Kitchen', revision: 1, previousNames: [] };
const roleRevision = () => {
  const normalized = rolesCore.normalizeRosterRole(role);
  const row = `${normalized.id}:${normalized.revision}:${normalized.archived ? 1 : 0}:${String(normalized.name || '').trim().replace(/\s+/g, ' ').toLowerCase()}:${normalized.previousNames.map(value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()).sort().join(',')}`;
  return `roles-v1|${row}`;
};

function publishedLegacyShift() {
  return {
    id: 'shift-legacy-identity',
    restaurantId: 'r1',
    workspaceId: 'r1',
    date: '2026-09-20',
    scheduleDateKey: '2026-09-20',
    rosterRoleId: 'kitchen',
    rosterRoleNameSnapshot: 'Kitchen',
    role: 'Kitchen',
    scheduleUserId: 'employee-1',
    employeeId: 'employee-1',
    rosterUserId: 'employee-1',
    // userId/authUid/assignedUserId intentionally absent. Older published shifts
    // can have the durable roster IDs without every newer canonical alias.
    employeeName: 'Employee One',
    assignedName: 'Employee One',
    employeeEmail: 'one@example.com',
    assignedEmail: 'one@example.com',
    startTime: '16:00',
    endTime: '21:00',
    isPublished: true,
    published: true,
    status: 'published',
    publishStatus: 'published',
    scheduleId: 'schedule-existing',
    revision: 2,
    updatedAt: '2026-09-20T20:00:00.000Z',
    _employeeResolution: {
      ok: true,
      person: {
        id: 'employee-1',
        scheduleUserId: 'employee-1',
        employeeId: 'employee-1',
        rosterUserId: 'employee-1',
        userId: 'account-1',
        authUid: 'account-1',
        assignedUserId: 'employee-1',
        email: 'one@example.com',
        name: 'Employee One'
      }
    }
  };
}

test('published legacy identity repair stays in the confirmed candidate set', () => {
  const shift = publishedLegacyShift();
  const desired = core.canonicalEmployeeIdentity(shift._employeeResolution.person, shift);
  assert.equal(core.identityMatches(shift, desired), false, 'server correctly requires the missing canonical aliases to be repaired');

  assert.throws(() => core.buildCanonicalServerPlan({
    restaurantId: 'r1',
    operationId: 'publish_operation_1712',
    dayKeys: ['2026-09-20'],
    allRoles: true,
    roles: [role],
    shifts: [shift],
    expectedShifts: [],
    roleConfigurationRevision: roleRevision(),
    actor: { uid: 'manager-1' }
  }), error => error?.code === 'candidate_set_changed' && error?.details?.actualIds?.includes('shift-legacy-identity'));

  const source = plannerSource();
  assert.match(source, /return wanted && \(!actual \|\| wanted !== actual\);/, 'browser publish readiness treats a missing desired alias the same way as the server');
  assert.doesNotMatch(source, /const missingRequired = \['scheduleUserId', 'employeeId', 'rosterUserId', 'employeeName', 'assignedName'\]/, 'browser no longer invents name-only candidate repairs that the server does not select');
});

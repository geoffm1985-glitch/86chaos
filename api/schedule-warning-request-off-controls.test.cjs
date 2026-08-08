'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  scheduleWarningEmployeeLabel,
  buildCoverageVarianceRows,
  requestMatchesEmployeeFilter,
  isRequestOffBulkEligible,
} = require('../src/core/scheduleWarningControls.cjs');

test('schedule requested-off warning resolver uses canonical person data and never Someone', () => {
  const label = scheduleWarningEmployeeLabel(
    { employeeId: 'stale-id', employeeName: 'Imported Label' },
    { id: 'roster-1', employeeName: 'Allen Bates', email: 'allen@example.com' }
  );
  assert.equal(label, 'Allen Bates');
  assert.notEqual(label, 'Someone');
});

test('schedule warning fallback uses legitimate shift metadata or unresolved employee, never Someone', () => {
  assert.equal(scheduleWarningEmployeeLabel({ employeeEmail: 'shift.person@example.com' }, null), 'shift.person@example.com');
  assert.equal(scheduleWarningEmployeeLabel({}, null), 'Unresolved employee');
  assert.notEqual(scheduleWarningEmployeeLabel({}, null), 'Someone');
});

test('coverage variance rows report under, exact, and over target math from one helper', () => {
  const weekDates = ['2026-08-02', '2026-08-03', '2026-08-04'];
  const target = role => ({ id: `target-${role}`, dayIndex: 0, role, startTime: '09:00', endTime: '17:00', count: role === 'Kitchen' ? 2 : 3 });
  const roleMatcher = (shiftRole, targetRole) => String(shiftRole || '').toLowerCase() === String(targetRole || '').toLowerCase();

  const under = buildCoverageVarianceRows({
    coverageTargets: [target('Kitchen')],
    weekDates,
    weekShifts: [{ date: '2026-08-02', role: 'Kitchen', startTime: '09:00' }],
    roleMatcher,
  });
  assert.equal(under.length, 1);
  assert.equal(under[0].type, 'under');
  assert.equal(under[0].needed, 1);
  assert.equal(under[0].existing, 1);
  assert.equal(under[0].target, 2);

  const exact = buildCoverageVarianceRows({
    coverageTargets: [target('Kitchen')],
    weekDates,
    weekShifts: [
      { date: '2026-08-02', role: 'Kitchen', startTime: '09:00' },
      { date: '2026-08-02', role: 'Kitchen', startTime: '09:00' },
    ],
    roleMatcher,
  });
  assert.equal(exact.length, 0);

  const over = buildCoverageVarianceRows({
    coverageTargets: [target('Bar')],
    weekDates,
    weekShifts: Array.from({ length: 5 }, () => ({ date: '2026-08-02', role: 'Bar', startTime: '09:00' })),
    roleMatcher,
  });
  assert.equal(over.length, 1);
  assert.equal(over[0].type, 'over');
  assert.equal(over[0].over, 2);
  assert.equal(over[0].existing, 5);
  assert.equal(over[0].target, 3);
});

test('Request Off employee filter uses request subject identity and not audit actor fields', () => {
  const request = {
    id: 'req-1',
    employeeName: 'Allen Bates',
    employeeEmail: 'allen@example.com',
    userId: 'allen-auth',
    createdByName: 'Sara Manager',
    requestedByName: 'Sara Manager',
    createdBy: 'manager-auth',
    requestedBy: 'manager-auth',
  };
  assert.equal(requestMatchesEmployeeFilter(request, 'Allen'), true);
  assert.equal(requestMatchesEmployeeFilter(request, 'allen@example.com'), true);
  assert.equal(requestMatchesEmployeeFilter(request, 'Sara'), false);
  assert.equal(requestMatchesEmployeeFilter(request, 'manager-auth'), false);
});

test('Request Off bulk eligibility excludes hidden, archived, wrong-workspace, and nonpending approve rows', () => {
  const options = {
    visibleIds: ['req-visible', 'req-approved', 'req-archived', 'req-other-workspace'],
    workspaceId: 'cheers_chilton_01',
    canManage: true,
    normalizeStatus: r => String(r.status || 'pending').toLowerCase(),
    isArchivedRequest: r => r.archived === true || r.processed === true || ['archived', 'processed'].includes(String(r.status || '').toLowerCase()),
  };
  assert.equal(isRequestOffBulkEligible({ id: 'req-visible', restaurantId: 'cheers_chilton_01', status: 'pending' }, { ...options, requirePending: true }), true);
  assert.equal(isRequestOffBulkEligible({ id: 'req-hidden', restaurantId: 'cheers_chilton_01', status: 'pending' }, { ...options, requirePending: true }), false);
  assert.equal(isRequestOffBulkEligible({ id: 'req-archived', restaurantId: 'cheers_chilton_01', status: 'pending', archived: true }, { ...options, requirePending: true }), false);
  assert.equal(isRequestOffBulkEligible({ id: 'req-other-workspace', restaurantId: 'other', status: 'pending' }, { ...options, requirePending: true }), false);
  assert.equal(isRequestOffBulkEligible({ id: 'req-approved', restaurantId: 'cheers_chilton_01', status: 'approved' }, { ...options, requirePending: true }), false);
  assert.equal(isRequestOffBulkEligible({ id: 'req-approved', restaurantId: 'cheers_chilton_01', status: 'approved' }, { ...options, requirePending: false }), true);
});

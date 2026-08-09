'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  scheduleWarningEmployeeLabel,
  buildCoverageVarianceRows,
  buildScheduleConflictWarningRows,
  requestMatchesEmployeeFilter,
  isRequestOffBulkEligible,
  asFunction,
} = require('../src/core/scheduleWarningControls.cjs');


test('Schedule browser import contract uses native ESM named warning helpers', () => {
  const root = path.join(__dirname, '..');
  const scheduleSource = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
  const browserWrapper = fs.readFileSync(path.join(root, 'src/core/scheduleWarningControls.js'), 'utf8');
  const sharedSource = fs.readFileSync(path.join(root, 'src/core/scheduleWarningControls.shared.js'), 'utf8');
  const cjsWrapper = fs.readFileSync(path.join(root, 'src/core/scheduleWarningControls.cjs'), 'utf8');

  assert.match(scheduleSource, /from '\.\.\/core\/scheduleWarningControls';/, 'Schedule browser code should use the native ESM warning helper wrapper');
  assert.doesNotMatch(scheduleSource, /scheduleWarningControls\.cjs/, 'Schedule browser code must not directly import the CommonJS helper');
  assert.doesNotMatch(scheduleSource, /scheduleWarningControlExports/, 'Schedule browser code should not rely on a CJS compatibility spread during render');

  [
    'buildCoverageVarianceRows',
    'buildScheduleConflictWarningRows',
    'scheduleWarningEmployeeLabel',
    'warningShiftContext',
    'requestMatchesEmployeeFilter',
    'isRequestOffBulkEligible',
  ].forEach(name => {
    assert.match(browserWrapper, new RegExp(`export const ${name} = scheduleWarningControls\\.${name};`), `${name} should be an explicit browser ESM named export`);
    assert.match(sharedSource, new RegExp(`function ${name}\\b|const ${name}\\b`), `${name} should be defined in the shared implementation`);
  });
  assert.match(cjsWrapper, /require\('\.\/scheduleWarningControls\.shared\.js'\)/, 'Node CJS wrapper should load the same shared implementation');
});

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


test('schedule conflict warnings tolerate resolver failures and keep valid warning rows', () => {
  const warnings = buildScheduleConflictWarningRows({
    weekStart: '2026-08-02',
    schedule: [{
      id: 'shift-allen',
      employeeId: 'allen-id',
      employeeName: 'Allen QA',
      employeeEmail: 'allen@example.com',
      date: '2026-08-08',
      startTime: '4p',
      endTime: '9p',
      role: 'Cook',
    }],
    allUsers: [{ id: 'allen-id', name: 'Allen QA', email: 'allen@example.com', isActive: true }],
    requests: [{ id: 'off-allen', userId: 'allen-id', employeeName: 'Allen QA', date: '2026-08-08', status: 'approved' }],
    resolvePerson: () => { throw new Error('legacy resolver failure'); },
    matchesTimeOff: (request, person) => request.userId === person.employeeId || request.userId === person.id,
    isActiveRequest: request => ['pending', 'approved'].includes(String(request.status || '').toLowerCase()),
    employeeLabeler: scheduleWarningEmployeeLabel,
    fingerprintBuilder: (...parts) => parts.join('|'),
    formatDate: date => date,
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /^Allen QA is scheduled on requested-off date 2026-08-08\.$/);
  assert.notEqual(warnings[0].message.includes('Someone'), true);
});

test('current QA seed deterministically produces an over-coverage bartender row', () => {
  const { buildFakeRestaurantProfile } = require('../tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
  const profile = buildFakeRestaurantProfile({
    restaurantId: 'qa_release_gate_fixture',
    runId: '2026-08-08T16-46-19',
    anchorDate: new Date('2026-08-08T12:00:00Z'),
  });
  const weekDates = ['2026-08-02','2026-08-03','2026-08-04','2026-08-05','2026-08-06','2026-08-07','2026-08-08'];
  const bartenderTarget = profile.collections.scheduleCoverageTargets.find(target => target.dayIndex === 2 && target.role === 'Bartender');
  assert.ok(bartenderTarget, 'QA seed should include deterministic Tuesday Bartender coverage target');
  const rows = buildCoverageVarianceRows({
    coverageTargets: [bartenderTarget],
    weekDates,
    weekShifts: profile.collections.shifts,
    roleMatcher: (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase(),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'over');
  assert.equal(rows[0].existing, 2);
  assert.equal(rows[0].target, 1);
  assert.equal(rows[0].over, 1);
});

test('schedule warning model survives malformed legacy records without taking down the route', () => {
  assert.doesNotThrow(() => buildCoverageVarianceRows({
    coverageTargets: [null, { dayIndex: 2, role: 'Bartender', count: 1 }, { dayIndex: 2, role: { malformed: true }, count: 1 }],
    weekDates: ['2026-08-02','2026-08-03','2026-08-04'],
    weekShifts: [null, { date: '2026-08-04', role: 'Bartender' }],
    canonicalRole: role => {
      if (typeof role === 'object') throw new Error('malformed role');
      return role;
    },
  }));
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


test('schedule warning helpers ignore malformed injected callbacks instead of crashing render', () => {
  assert.equal(asFunction('not-callable', () => 'fallback')(), 'fallback');

  const coverageRows = buildCoverageVarianceRows({
    coverageTargets: [{ id: 'target-kitchen', dayIndex: 0, role: 'Kitchen', startTime: '09:00', count: 2 }],
    weekDates: ['2026-08-02'],
    weekShifts: [{ date: '2026-08-02', role: 'Kitchen', startTime: '09:00' }],
    roleMatcher: 'legacy bad role matcher',
    canonicalRole: 'legacy bad canonical role',
  });
  assert.equal(coverageRows.length, 1);
  assert.equal(coverageRows[0].type, 'under');
  assert.equal(coverageRows[0].needed, 1);

  assert.doesNotThrow(() => buildScheduleConflictWarningRows({
    weekStart: '2026-08-02',
    schedule: [{ id: 'shift-legacy', employeeName: 'Legacy Person', date: '2026-08-08' }],
    allUsers: [{ id: 'legacy-user', name: 'Legacy Person' }],
    requests: [{ id: 'bad-request', employeeName: 'Legacy Person', date: '2026-08-08', status: 'approved' }],
    resolvePerson: 'not a resolver',
    matchesTimeOff: 'not a matcher',
    isActiveRequest: 'not a status function',
    employeeLabeler: 'not a labeler',
    shiftContext: 'not a shift context function',
    fingerprintBuilder: 'not a fingerprint function',
    formatDate: 'not a date formatter',
  }));
});

const integrity = require('./scheduleIntegrity.shared.js');
const { getFirebaseUsageDiagnostics, resetFirebaseUsageDiagnostics, recordScheduleOperationDiagnostic } = require('./appCore');

const people = [
  { id: 'employee-1', uid: 'auth-1', name: 'Alex Cook', email: 'alex@example.com', isActive: true },
  { id: 'employee-2', uid: 'auth-2', name: 'Sam Cook', email: 'sam@example.com', isActive: true },
  { id: 'employee-old', uid: 'auth-old', name: 'Pat Historical', email: 'pat@example.com', isActive: false, historical: true },
  { id: 'display-1', name: 'Display Only', syntheticScheduleIdentity: true, isActive: false }
];

const canonicalShift = (patch = {}) => ({
  id: 'shift-1', restaurantId: 'r1', workspaceId: 'r1', date: '2026-09-13', scheduleDateKey: '2026-09-13', scheduleMonth: '2026-09',
  employeeId: 'employee-1', scheduleUserId: 'employee-1', employeeName: 'Alex Cook', employeeEmail: 'alex@example.com', startTime: '09:00', endTime: '17:00', ...patch
});

describe('canonical schedule date writes', () => {
  test('new and moved shifts receive all canonical date mirrors across a month boundary', () => {
    expect(integrity.buildCanonicalScheduleDatePatch('2026-10-01')).toEqual({ date: '2026-10-01', scheduleDateKey: '2026-10-01', scheduleMonth: '2026-10' });
    expect(integrity.buildCanonicalScheduleCreateFields('2026-10-01', 'r1')).toEqual({ date: '2026-10-01', scheduleDateKey: '2026-10-01', scheduleMonth: '2026-10', restaurantId: 'r1', workspaceId: 'r1' });
    expect(() => integrity.buildCanonicalScheduleDatePatch('2026-02-30')).toThrow(/valid YYYY-MM-DD/);
  });

  test.each([['startTime', '09:00'], ['endTime', '17:00']])('unchanged %s creates a zero-write plan', (field, value) => {
    expect(integrity.buildScheduleQuickEditMutation(canonicalShift(), { [field]: value })).toMatchObject({ skipped: true, payload: {}, changedFields: [] });
  });

  test('unchanged employee assignment creates a zero-write plan', () => {
    expect(integrity.buildScheduleQuickEditMutation(canonicalShift(), { employeeId: 'employee-1', scheduleUserId: 'employee-1' })).toMatchObject({ skipped: true, payload: {}, changedFields: [] });
  });

  test('same-date move creates a zero-write plan and actual move changes exactly the date mirrors plus audit metadata', () => {
    expect(integrity.buildScheduleQuickEditMutation(canonicalShift(), { date: '2026-09-13' }).skipped).toBe(true);
    const moved = integrity.buildScheduleQuickEditMutation(canonicalShift(), { date: '2026-10-01' }, { actorId: 'manager', nowIso: '2026-09-13T12:00:00.000Z' });
    expect(moved.skipped).toBe(false);
    expect(moved.changedFields.sort()).toEqual(['date', 'scheduleDateKey', 'scheduleMonth']);
    expect(moved.payload).toEqual({ date: '2026-10-01', scheduleDateKey: '2026-10-01', scheduleMonth: '2026-10', updatedAt: '2026-09-13T12:00:00.000Z', updatedBy: 'manager' });
  });
});

describe('read-only schedule integrity classification', () => {
  const complete = { restaurantId: 'r1', people, scanComplete: true, identityLookupComplete: true, canonicalVisible: true };

  test('healthy canonical identity, email fallback, full-name fallback, and legitimate open shift stay distinct', () => {
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift(), complete).classification).toBe('HEALTHY');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: '', scheduleUserId: '', employeeEmail: 'alex@example.com' }), complete)).toMatchObject({ classification: 'LEGACY_BUT_VALID', issueFlags: expect.arrayContaining(['legacy-only identity']) });
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: '', scheduleUserId: '', employeeEmail: '', employeeName: 'Alex Cook' }), complete).classification).toBe('LEGACY_BUT_VALID');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: '', scheduleUserId: '', employeeEmail: '', employeeName: 'Unassigned' }), complete).classification).toBe('HEALTHY');
  });

  test('valid legacy date remains valid and rescue evidence is preserved', () => {
    const result = integrity.classifyScheduleIntegrityRecord(canonicalShift({ date: '', scheduleDateKey: '2026-09-13', scheduleMonth: '' }), { ...complete, canonicalVisible: false, rescueVisible: true });
    expect(result.classification).toBe('LEGACY_BUT_VALID');
    expect(result.issueFlags).toEqual(expect.arrayContaining(['legacy-only date', 'rescue-dependent record', 'record that canonical reads alone would miss']));
  });

  test('conflicting durable identity or durable-id versus email evidence is ambiguous', () => {
    const conflictingIds = integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: 'employee-1', scheduleUserId: 'employee-2' }), complete);
    expect(conflictingIds.classification).toBe('AMBIGUOUS');
    const contradictory = integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: 'employee-1', scheduleUserId: 'employee-1', employeeEmail: 'sam@example.com' }), complete);
    expect(contradictory.classification).toBe('AMBIGUOUS');
    expect(contradictory.issueFlags).toContain('conflicting identity aliases');
  });

  test('ambiguous names, incomplete lookup, complete orphan resolution, and case-only collisions are honest', () => {
    const sameNames = [...people, { id: 'employee-3', name: 'Alex Cook', isActive: true }];
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: '', scheduleUserId: '', employeeEmail: '' }), { ...complete, people: sameNames }).classification).toBe('AMBIGUOUS');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: 'missing', scheduleUserId: 'missing' }), { ...complete, identityLookupComplete: false }).classification).toBe('UNVERIFIABLE');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: 'missing', scheduleUserId: 'missing', employeeEmail: '', employeeName: 'Former Person' }), complete).classification).toBe('ORPHANED');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeName: 'Alex Cook', assignedName: 'alex cook' }), complete).issueFlags).toContain('case-only identity collision');
  });

  test('inactive historical and explicit synthetic display identities are not mistaken for orphaned people', () => {
    const historical = integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: 'employee-old', scheduleUserId: 'employee-old', employeeName: 'Pat Historical', employeeEmail: 'pat@example.com' }), complete);
    expect(historical.classification).toBe('LEGACY_BUT_VALID');
    expect(historical.issueFlags).toEqual(expect.arrayContaining(['inactive historical employee', 'deleted/historical employee']));
    const synthetic = integrity.classifyScheduleIntegrityRecord(canonicalShift({ employeeId: 'display-1', scheduleUserId: 'display-1', employeeName: 'Display Only', employeeEmail: '' }), complete);
    expect(synthetic.issueFlags).toContain('synthetic schedule-only display identity');
  });

  test('date conflicts, invalid dates, and unusable times are malformed while OPEN/CLOSE remains usable', () => {
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ scheduleDateKey: '2026-09-14' }), complete).classification).toBe('MALFORMED');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ date: '2026-02-30', scheduleDateKey: '' }), complete).classification).toBe('MALFORMED');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ startTime: '25:99' }), complete).classification).toBe('MALFORMED');
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift({ startTime: 'OPEN', endTime: 'CLOSE' }), complete).classification).not.toBe('MALFORMED');
  });

  test('duplicate candidates keep raw records separate and do not collide across employee or date', () => {
    const duplicate = { ...canonicalShift(), id: 'shift-2' };
    const otherEmployee = canonicalShift({ id: 'shift-3', employeeId: 'employee-2', scheduleUserId: 'employee-2', employeeName: 'Sam Cook', employeeEmail: 'sam@example.com' });
    const otherDate = canonicalShift({ id: 'shift-4', date: '2026-09-14', scheduleDateKey: '2026-09-14' });
    const results = integrity.classifyScheduleIntegrityRecords([canonicalShift(), duplicate, otherEmployee, otherDate], complete);
    expect(results).toHaveLength(4);
    expect(results.slice(0, 2).every(row => row.classification === 'DUPLICATE_CANDIDATE')).toBe(true);
    expect(results[2].classification).toBe('HEALTHY');
    expect(results[3].classification).toBe('HEALTHY');
  });

  test('an incomplete scan cannot report full health', () => {
    expect(integrity.classifyScheduleIntegrityRecord(canonicalShift(), { ...complete, scanComplete: false }).classification).toBe('UNVERIFIABLE');
  });
});

describe('schedule operation evidence', () => {
  test('no-op, actual edit, rescue reason, and audit reads are counted in memory without audit writes', () => {
    resetFirebaseUsageDiagnostics();
    recordScheduleOperationDiagnostic('skippedNoOpWrites');
    recordScheduleOperationDiagnostic('quickEditWrites');
    recordScheduleOperationDiagnostic('directSdkWrites');
    recordScheduleOperationDiagnostic('auditDocumentReads', 3);
    recordScheduleOperationDiagnostic('auditPages');
    recordScheduleOperationDiagnostic('rescueActivation', 1, 'canonical-window-empty');
    const evidence = getFirebaseUsageDiagnostics().schedule;
    expect(evidence).toMatchObject({ skippedNoOpWrites: 1, quickEditWrites: 1, directSdkWrites: 1, auditDocumentReads: 3, auditPages: 1, auditWrites: 0 });
    expect(evidence.rescueActivationsByReason['canonical-window-empty']).toBe(1);
  });
});

import { buildScheduleQueryPlan, getCanonicalScheduleUserId, buildScheduleDateKeyRangeClauses, mergeLoadedScheduleShifts, shouldEnableScheduleDateKeyRescue, scheduleQueryDateRangeMonths } from './scheduleQueryPlanner';

describe('schedule query planner', () => {
  const staff = { id: 'u1', scheduleUserId: 'sched_u1', role: 'staff', permissions: {} };
  const manager = { id: 'm1', isAdmin: true, permissions: { schedule: true } };
  test('staff My Schedule loads selected month plus outer schedule weeks for canonical-user filtering', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'my-schedule', appUser: staff, currentDate: '2026-07-15' });
    expect(plan.shiftClauses).toContainEqual(['date', '>=', '2026-06-29']);
    expect(plan.shiftClauses).toContainEqual(['date', '<=', '2026-08-02']);
    expect(plan.shiftClauses).not.toContainEqual(['scheduleUserId', '==', 'sched_u1']);
    expect(plan.shiftClauses).not.toContainEqual(['employeeId', '==', 'sched_u1']);
    expect(plan.shiftClauses).not.toContainEqual(['rosterUserId', '==', 'sched_u1']);
    expect(plan.needsRoster).toBe(true);
    expect(plan.shiftLimit).toBeGreaterThanOrEqual(420);
  });
  test('manager Schedule Builder loads team planning data', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'schedule-builder', appUser: manager, currentDate: '2026-07-15' });
    expect(plan.needsRoster).toBe(true);
    expect(plan.needsAvailability).toBe(true);
    expect(plan.needsTemplates).toBe(true);
    expect(plan.shiftLimit).toBeGreaterThan(100);
  });
  test('staff time off is user scoped', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'time-off', appUser: staff, currentDate: '2026-07-15' });
    expect(plan.timeOffClauses).toContainEqual(['userId', '==', 'u1']);
  });

  test('manager Request Off loads all active requested days for workflow review', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'time-off', appUser: manager, currentDate: '2026-07-15' });
    expect(plan.timeOffClauses).toContainEqual(['status', 'in', ['pending', 'approved']]);
    expect(plan.timeOffClauses).not.toContainEqual(['date', '>=', '2026-06-15']);
    expect(plan.timeOffLimit).toBeGreaterThanOrEqual(500);
  });

  test('trade board uses created available/open statuses', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'trade-board', appUser: manager, currentDate: '2026-07-15' });
    expect(plan.swapClauses).toContainEqual(['status', 'in', ['available', 'open']]);
  });

  test('schedule screen can rescue scheduleDateKey-only shift records', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'full-schedule', appUser: staff, currentDate: '2026-08-15' });
    const rescueClauses = buildScheduleDateKeyRangeClauses(plan.shiftClauses);
    expect(rescueClauses).toContainEqual(['scheduleDateKey', '>=', '2026-08-01']);
    expect(rescueClauses).toContainEqual(['scheduleDateKey', '<=', '2026-08-31']);
    expect(rescueClauses).not.toContainEqual(['date', '>=', '2026-08-01']);
  });

  test('scheduleDateKey rescue stays off when canonical schedule rows are loaded and no rescue metadata exists', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'full-schedule', appUser: manager, currentDate: '2026-08-15' });
    expect(scheduleQueryDateRangeMonths(plan.shiftClauses)).toContain('2026-08');
    expect(shouldEnableScheduleDateKeyRescue({
      wantsShiftData: true,
      wantsScheduleScreen: true,
      canonicalState: { resolved: true, data: [{ id: 'canonical', date: '2026-08-02' }] },
      clientData: {},
      shiftClauses: plan.shiftClauses
    })).toBe(false);
  });

  test('scheduleDateKey rescue turns on for empty canonical windows or known legacy rescue months', () => {
    const plan = buildScheduleQueryPlan({ activeTabState: 'schedule', activeScheduleSubTab: 'full-schedule', appUser: manager, currentDate: '2026-08-15' });
    expect(shouldEnableScheduleDateKeyRescue({
      wantsShiftData: true,
      wantsScheduleScreen: true,
      canonicalState: { resolved: true, data: [] },
      clientData: {},
      shiftClauses: plan.shiftClauses
    })).toBe(true);
    expect(shouldEnableScheduleDateKeyRescue({
      wantsShiftData: true,
      wantsScheduleScreen: true,
      canonicalState: { resolved: false, data: [{ id: 'canonical', date: '2026-08-02' }] },
      clientData: { scheduleRescueProtectedMonths: ['2026-08'], scheduleRescueEnforceProtected: true },
      shiftClauses: plan.shiftClauses
    })).toBe(true);
  });

  test('loaded shifts are merged and normalized for employee-facing schedule tabs', () => {
    const merged = mergeLoadedScheduleShifts(
      [{ id: 'a', restaurantId: 'r1', date: '2026-08-02', employeeName: 'Alex', startTime: '09:00', endTime: '17:00' }],
      [{ id: 'a', restaurantId: 'r1', scheduleDateKey: '2026-08-02', employeeName: 'Alex', role: 'Cook', startTime: '09:00', endTime: '17:00' }],
      [{ id: 'b', restaurantId: 'r1', scheduleDateKey: '2026-08-03', employeeName: 'Sam', role: 'Server', startTime: '10:00', endTime: '16:00' }]
    );
    expect(merged).toHaveLength(2);
    expect(merged.find(shift => shift.id === 'a')).toMatchObject({ date: '2026-08-02', scheduleDateKey: '2026-08-02', role: 'Cook' });
    expect(merged.find(shift => shift.id === 'b')).toMatchObject({ date: '2026-08-03', scheduleDateKey: '2026-08-03', scheduleMonth: '2026-08' });
  });
  test('identity chooses canonical scheduleUserId first', () => {
    expect(getCanonicalScheduleUserId({ scheduleUserId: 's', employeeId: 'e', id: 'i' })).toBe('s');
  });
});

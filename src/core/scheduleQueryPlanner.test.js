import { buildScheduleQueryPlan, getCanonicalScheduleUserId, buildScheduleDateKeyRangeClauses, mergeLoadedScheduleShifts } from './scheduleQueryPlanner';

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

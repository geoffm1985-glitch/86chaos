import { buildScheduleQueryPlan, getCanonicalScheduleUserId } from './scheduleQueryPlanner';

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
  test('identity chooses canonical scheduleUserId first', () => {
    expect(getCanonicalScheduleUserId({ scheduleUserId: 's', employeeId: 'e', id: 'i' })).toBe('s');
  });
});

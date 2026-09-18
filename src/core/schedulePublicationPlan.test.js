import { buildSchedulePublicationPlan } from './schedulePublicationPlan';

const roles = [{ id: 'grill-id', name: 'Grill', revision: 2 }, { id: 'bar-id', name: 'Bar', revision: 1 }];
const shifts = [
  { id: 's1', restaurantId: 'r', date: '2026-09-18', employeeId: 'e1', role: 'Grill', revision: 4, updatedAt: 'a' },
  { id: 's2', restaurantId: 'r', date: '2026-09-18', employeeId: 'e2', rosterRoleId: 'bar-id', role: 'Bar', revision: 1, updatedAt: 'b' },
];

test('role publishing follows the shift role rather than every employee role', () => {
  const plan = buildSchedulePublicationPlan({ restaurantId: 'r', period: { start: '2026-09-18', end: '2026-09-18' }, selectedRoleIds: ['grill-id'], allRoles: false, candidateShifts: shifts, rosterRoles: roles, actor: { uid: 'manager' } });
  expect(plan.candidateShiftIds).toEqual(['s1']);
  expect(plan.affectedEmployeeIds).toEqual(['e1']);
  expect(plan.affectedRoleIds).toEqual(['grill-id']);
  expect(plan.shifts[0]).toMatchObject({ migrateRoleIdentity: true, expectedRevision: 4 });
});

test('ambiguous legacy role identity is review-only', () => {
  const plan = buildSchedulePublicationPlan({ restaurantId: 'r', allRoles: true, candidateShifts: [shifts[0]], rosterRoles: [...roles, { id: 'old', name: 'Other', previousNames: ['Grill'] }] });
  expect(plan.candidateShiftIds).toEqual([]);
  expect(plan.unresolvedRoles[0].reason).toBe('ambiguous-legacy-role-name');
});

import { activeRosterRoles, buildRosterRoleArchiveFields, buildRosterRoleRenameFields, resolveShiftRosterRole } from './rosterRoleIdentity';

const roles = [
  { id: 'r1', name: 'Grill', revision: 3, previousNames: ['Line'], restaurantId: 'tenant-a' },
  { id: 'r2', name: 'Expo', revision: 1, restaurantId: 'tenant-a' },
];

test('canonical role id survives rename and preserves a snapshot', () => {
  const resolved = resolveShiftRosterRole({ rosterRoleId: 'r1', role: 'Line' }, roles);
  expect(resolved).toMatchObject({ ok: true, rosterRoleId: 'r1', rosterRoleNameSnapshot: 'Grill', migratable: false });
  expect(buildRosterRoleRenameFields(roles[0], 'Hot Line', '2026-09-18T00:00:00.000Z')).toMatchObject({ name: 'Hot Line', revision: 4, previousNames: ['Line', 'Grill'] });
});

test('legacy names migrate only when unique and active', () => {
  expect(resolveShiftRosterRole({ role: 'Line' }, roles)).toMatchObject({ ok: true, rosterRoleId: 'r1', migratable: true });
  expect(resolveShiftRosterRole({ role: 'Line' }, [...roles, { id: 'r3', name: 'Other', previousNames: ['Line'] }]).reason).toBe('ambiguous-legacy-role-name');
  const archived = [{ ...roles[0], archivedAt: '2026-09-18T00:00:00.000Z' }];
  expect(resolveShiftRosterRole({ role: 'Line' }, archived).reason).toBe('legacy-role-resolves-to-archived-role');
});

test('archiving is additive and archived roles leave the active selector', () => {
  expect(buildRosterRoleArchiveFields(roles[0], '2026-09-18T00:00:00.000Z')).toMatchObject({ archived: true, revision: 4 });
  expect(activeRosterRoles([{ ...roles[0], archivedAt: 'x' }, roles[1]]).map(role => role.id)).toEqual(['r2']);
});

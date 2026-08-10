import { resolveRouteAccess } from './featureAccess';

const workspace = {
  subscription: {
    planId: 'owner_pro',
    status: 'active',
  },
};

describe('audit route access', () => {
  test('ordinary restaurant manager is denied audit even with settings permission', () => {
    const manager = {
      isAdmin: true,
      isOwner: false,
      accountOwner: false,
      workspaceOwner: false,
      permissions: { settings: true, audit: true, schedule: true },
    };
    const access = resolveRouteAccess({ route: 'audit', workspace, user: manager });
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('permission_locked');
    expect(access.roleReason).toBe('owner_or_platform_admin_required');
  });

  test('owner and verified platform admin are allowed audit', () => {
    expect(resolveRouteAccess({ route: 'audit', workspace, user: { isOwner: true } }).allowed).toBe(true);
    expect(resolveRouteAccess({ route: 'audit', workspace, user: { isAdmin: true }, serverVerifiedPlatformAdmin: true }).allowed).toBe(true);
  });

  test('manager schedule access remains unchanged', () => {
    const access = resolveRouteAccess({ route: 'schedule', workspace, user: { isAdmin: true, permissions: { schedule: true } } });
    expect(access.allowed).toBe(true);
  });
});

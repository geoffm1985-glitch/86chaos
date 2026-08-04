import { WHOAMI_STATES, PLATFORM_ADMIN_ACCESS_STATES, classifyWhoamiResponse, isTransientWhoamiFailure, mergeVerifiedAccess, resolvePlatformAdminAccessState, shouldHoldAccessHydration } from './sessionAccess';

describe('session access hydration and whoami verification', () => {
  it('holds role-gated navigation while a cached refresh session is hydrating', () => {
    expect(shouldHoldAccessHydration({ hasCachedSession: true, authPending: true })).toBe(true);
    expect(shouldHoldAccessHydration({ hasCachedSession: true, profileLoading: true })).toBe(true);
    expect(shouldHoldAccessHydration({ hasCachedSession: true, membershipLoading: true })).toBe(true);
    expect(shouldHoldAccessHydration({ hasCachedSession: true, whoamiStatus: WHOAMI_STATES.PENDING })).toBe(true);
  });

  it('does not hold navigation after sign out or after authoritative hydration finishes', () => {
    expect(shouldHoldAccessHydration({ hasCachedSession: true, signedOut: true, authPending: true })).toBe(false);
    expect(shouldHoldAccessHydration({ hasCachedSession: false, authPending: true })).toBe(false);
    expect(shouldHoldAccessHydration({ hasCachedSession: true, whoamiStatus: WHOAMI_STATES.DENIED })).toBe(false);
  });

  it('classifies 503, timeout, network, and unavailable whoami errors as transient', () => {
    expect(isTransientWhoamiFailure({ status: 503 })).toBe(true);
    expect(isTransientWhoamiFailure({ error: 'network failed to fetch' })).toBe(true);
    expect(isTransientWhoamiFailure({ error: 'request timeout' })).toBe(true);
    expect(classifyWhoamiResponse({ ok: false, status: 503, data: { error: 'The service is currently unavailable.' } }).status).toBe(WHOAMI_STATES.TRANSIENT_FAILURE);
  });

  it('treats a successful superAdmin=false whoami response as definitive denial', () => {
    const result = classifyWhoamiResponse({ ok: true, status: 200, data: { superAdmin: false } });
    expect(result.status).toBe(WHOAMI_STATES.DENIED);
    expect(result.definitive).toBe(true);
  });

  it('merges verified System Administrator access without removing workspace identity or permissions', () => {
    const user = {
      id: 'uid-1',
      restaurantId: 'cheers_chilton_01',
      availableWorkspaces: [{ restaurantId: 'cheers_chilton_01' }],
      permissions: { schedule: true },
      preferences: { defaultTab: 'schedule' }
    };
    const next = mergeVerifiedAccess(user, { ok: true, status: WHOAMI_STATES.VERIFIED, superAdmin: true, firestoreSystemAdministrator: true });
    expect(next.isSuperAdmin).toBe(true);
    expect(next.systemAccess.superAdmin).toBe(true);
    expect(next.restaurantId).toBe(user.restaurantId);
    expect(next.availableWorkspaces).toBe(user.availableWorkspaces);
    expect(next.permissions.schedule).toBe(true);
    expect(next.preferences).toBe(user.preferences);
  });

  it('transient whoami failures keep the current verified administrator state', () => {
    const verified = { id: 'uid-1', isSuperAdmin: true, systemAccess: { superAdmin: true }, permissions: { systemAdmin: true } };
    const next = mergeVerifiedAccess(verified, { ok: false, status: WHOAMI_STATES.TRANSIENT_FAILURE, statusCode: 503, definitive: false });
    expect(next).toEqual(verified);
  });

  it('definitive superAdmin denial removes platform access', () => {
    const verified = { id: 'uid-1', isSuperAdmin: true, systemAccess: { superAdmin: true }, permissions: { systemAdmin: true, godmode: true, schedule: true } };
    const next = mergeVerifiedAccess(verified, { ok: true, status: WHOAMI_STATES.DENIED, superAdmin: false, definitive: true });
    expect(next.isSuperAdmin).toBe(false);
    expect(next.systemAccess.superAdmin).toBe(false);
    expect(next.permissions.systemAdmin).toBe(false);
    expect(next.permissions.godmode).toBe(false);
    expect(next.permissions.schedule).toBe(true);
  });

  it('normal users do not become system administrators from cached data', () => {
    const user = { id: 'staff-1', isSuperAdmin: false, permissions: { schedule: true } };
    const next = mergeVerifiedAccess(user, { ok: true, status: WHOAMI_STATES.DENIED, superAdmin: false, definitive: true });
    expect(next.isSuperAdmin).toBe(false);
    expect(next.permissions.schedule).toBe(true);
  });

  it('uses one platform-admin state for verified, pending, temporary, and denied access', () => {
    const verified = resolvePlatformAdminAccessState({
      user: { id: 'root', email: 'geoffm1985@gmail.com' },
      verification: { ok: true, status: WHOAMI_STATES.VERIFIED, superAdmin: true, platformAuthority: { superAdmin: true, source: 'protected-root-admin' } },
      masterAdminEmail: 'geoffm1985@gmail.com'
    });
    expect(verified.state).toBe(PLATFORM_ADMIN_ACCESS_STATES.VERIFIED);
    expect(verified.canRenderProtectedControls).toBe(true);
    expect(verified.showDrawerEntry).toBe(true);

    const pending = resolvePlatformAdminAccessState({
      user: { id: 'root', email: 'geoffm1985@gmail.com' },
      verification: { status: WHOAMI_STATES.PENDING },
      masterAdminEmail: 'geoffm1985@gmail.com'
    });
    expect(pending.state).toBe(PLATFORM_ADMIN_ACCESS_STATES.PENDING);
    expect(pending.showDrawerEntry).toBe(true);
    expect(pending.canRenderProtectedControls).toBe(false);

    const temporary = resolvePlatformAdminAccessState({
      user: { id: 'root', email: 'geoffm1985@gmail.com' },
      verification: { status: WHOAMI_STATES.TRANSIENT_FAILURE, statusCode: 503, reasonCategory: 'firestore-profile-read-unavailable', retryable: true },
      masterAdminEmail: 'geoffm1985@gmail.com'
    });
    expect(temporary.state).toBe(PLATFORM_ADMIN_ACCESS_STATES.TEMPORARILY_UNAVAILABLE);
    expect(temporary.retryable).toBe(true);
    expect(temporary.canRenderProtectedControls).toBe(false);

    const denied = resolvePlatformAdminAccessState({
      user: { id: 'kitchen', email: 'kitchen@example.com', role: 'Kitchen', permissions: { systemAdmin: true, godmode: true } },
      verification: { status: WHOAMI_STATES.DENIED, statusCode: 403, superAdmin: false, definitive: true },
      masterAdminEmail: 'geoffm1985@gmail.com'
    });
    expect(denied.state).toBe(PLATFORM_ADMIN_ACCESS_STATES.DENIED);
    expect(denied.showDrawerEntry).toBe(false);
    expect(denied.canRenderProtectedControls).toBe(false);
  });

  it('does not grant protected controls from public master-email hints alone', () => {
    const state = resolvePlatformAdminAccessState({
      user: { id: 'root', email: 'geoffm1985@gmail.com' },
      verification: { status: WHOAMI_STATES.IDLE },
      masterAdminEmail: 'geoffm1985@gmail.com'
    });
    expect(state.state).toBe(PLATFORM_ADMIN_ACCESS_STATES.PENDING);
    expect(state.showDrawerEntry).toBe(true);
    expect(state.canRenderProtectedControls).toBe(false);
  });

});
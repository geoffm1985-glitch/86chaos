// Authenticated session/access hydration helpers.
// These helpers intentionally keep authorization state transitions testable outside React.

export const WHOAMI_STATES = Object.freeze({
  IDLE: 'idle',
  PENDING: 'pending',
  RETRYING: 'retrying',
  VERIFIED: 'verified',
  DENIED: 'denied',
  TRANSIENT_FAILURE: 'transient-failure',
  SIGNED_OUT: 'signed-out'
});

export const transientWhoamiStatusCodes = new Set([408, 429, 500, 502, 503, 504]);

export const isTransientWhoamiFailure = (input = {}) => {
  const status = Number(input.status || input.statusCode || 0);
  const message = String(input.error || input.message || input.statusText || '').toLowerCase();
  return transientWhoamiStatusCodes.has(status) ||
    /timeout|network|failed to fetch|unavailable|temporar|abort|app check|expired token|auth restoration|malformed/.test(message);
};

export const classifyWhoamiResponse = ({ ok = false, status = 0, data = {}, error = '' } = {}) => {
  if (ok === true) {
    return {
      status: data?.superAdmin === true ? WHOAMI_STATES.VERIFIED : WHOAMI_STATES.DENIED,
      ok: true,
      statusCode: status || 200,
      definitive: true,
      ...data
    };
  }
  const statusCode = Number(status || data?.statusCode || 0);
  if (statusCode === 401) {
    return { status: WHOAMI_STATES.DENIED, ok: false, statusCode, definitive: true, ...data, error: data?.error || error || 'Unauthorized' };
  }
  if (isTransientWhoamiFailure({ status: statusCode, error: data?.error || error })) {
    return { status: WHOAMI_STATES.TRANSIENT_FAILURE, ok: false, statusCode, definitive: false, ...data, error: data?.error || error || 'Temporary verification failure' };
  }
  return { status: WHOAMI_STATES.DENIED, ok: false, statusCode, definitive: true, ...data, error: data?.error || error || 'System Administrator verification denied' };
};

export const mergeVerifiedAccess = (user = {}, verification = {}) => {
  if (!user) return user;
  const state = verification?.status || '';
  const successful = verification?.ok === true;
  if (successful && verification?.superAdmin === true) {
    return {
      ...user,
      isSuperAdmin: true,
      systemAccess: { ...(user.systemAccess || {}), superAdmin: true },
      permissions: { ...(user.permissions || {}) },
      superAdminAccessSource: verification.platformAuthority?.source || (verification.protectedRootAdminMatched ? 'protected-root-admin'
        : verification.serverMasterAdminMatched ? 'server-master-admin-env'
          : verification.customClaimSuperAdmin ? 'firebase-custom-claim'
            : verification.firestoreSuperAdmin ? 'firestore-profile-flag'
              : 'api-whoami')
    };
  }
  if ((state === WHOAMI_STATES.DENIED || (successful && verification?.superAdmin !== true)) && verification?.definitive === true) {
    return {
      ...user,
      isSuperAdmin: false,
      systemAccess: { ...(user.systemAccess || {}), superAdmin: false },
      permissions: { ...(user.permissions || {}), systemAdmin: false, godmode: false },
      superAdminAccessSource: 'server-verified-not-system-admin'
    };
  }
  return user;
};

export const shouldHoldAccessHydration = ({
  hasCachedSession = false,
  signedOut = false,
  authPending = false,
  profileLoading = false,
  membershipLoading = false,
  whoamiStatus = WHOAMI_STATES.IDLE,
  localUserLooksSystemAdmin = false,
  roleControlsHydrating = false
} = {}) => {
  if (signedOut) return false;
  if (!hasCachedSession) return false;
  if (authPending || profileLoading || membershipLoading || roleControlsHydrating) return true;
  if (whoamiStatus === WHOAMI_STATES.PENDING || whoamiStatus === WHOAMI_STATES.RETRYING) return true;
  // A completed retry budget that ends in a temporary System Administrator verification failure
  // must not freeze the whole authenticated app. The godmode route shows a scoped
  // verification screen instead, while normal restaurant tabs remain usable.
  return false;
};

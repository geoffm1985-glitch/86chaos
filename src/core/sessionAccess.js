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

export const PLATFORM_ADMIN_ACCESS_STATES = Object.freeze({
  IDLE: 'idle',
  VERIFIED: 'verified',
  PENDING: 'pending',
  TEMPORARILY_UNAVAILABLE: 'temporarily-unavailable',
  DENIED: 'denied',
  SIGNED_OUT: 'signed-out'
});

export const transientWhoamiStatusCodes = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const normalizeEmail = (value = '') => String(value || '').toLowerCase().trim();
const clean = (value = '') => String(value == null ? '' : value).trim();

const TRUSTED_PLATFORM_AUTHORITY_SOURCES = new Set([
  'protected-root-admin',
  'server-master-admin-env',
  'firebase-custom-claim',
  'firestore-profile-flag',
  'api-whoami'
]);

export const isTransientWhoamiFailure = (input = {}) => {
  const status = Number(input.status || input.statusCode || 0);
  const reasonCategory = String(input.reasonCategory || '').toLowerCase();
  const message = String(input.error || input.message || input.statusText || '').toLowerCase();
  return transientWhoamiStatusCodes.has(status) ||
    /non-json|html|vercel|stale api|wrong firebase project|runtime|timeout|network|failed to fetch|unavailable|temporar|abort|app check|expired token|auth restoration|malformed/.test(`${reasonCategory} ${message}`);
};

export const sanitizeWhoamiVerification = (verification = {}) => {
  if (!verification || typeof verification !== 'object') return { status: WHOAMI_STATES.IDLE };
  const platformAuthority = verification.platformAuthority && typeof verification.platformAuthority === 'object'
    ? {
        superAdmin: verification.platformAuthority.superAdmin === true,
        protected: verification.platformAuthority.protected === true,
        authoritative: verification.platformAuthority.authoritative === true,
        temporarilyUnavailable: verification.platformAuthority.temporarilyUnavailable === true,
        source: clean(verification.platformAuthority.source),
        workspaceRole: clean(verification.platformAuthority.workspaceRole),
        restaurantRole: clean(verification.platformAuthority.restaurantRole)
      }
    : {};
  return {
    status: verification.status || WHOAMI_STATES.IDLE,
    ok: verification.ok === true,
    statusCode: Number(verification.statusCode || verification.status || 0) || 0,
    definitive: verification.definitive === true,
    superAdmin: verification.superAdmin === true,
    platformSuperAdmin: verification.platformSuperAdmin === true,
    platformAuthority,
    platformAuthorityProtected: verification.platformAuthorityProtected === true,
    platformAuthorityAuthoritative: verification.platformAuthorityAuthoritative === true,
    platformAuthorityTemporarilyUnavailable: verification.platformAuthorityTemporarilyUnavailable === true,
    protectedRootAdminMatched: verification.protectedRootAdminMatched === true,
    serverMasterAdminMatched: verification.serverMasterAdminMatched === true,
    customClaimSuperAdmin: verification.customClaimSuperAdmin === true,
    firestoreSuperAdmin: verification.firestoreSuperAdmin === true,
    firestoreSystemAdministrator: verification.firestoreSystemAdministrator === true,
    firestoreSuperAdminFlag: verification.firestoreSuperAdminFlag === true,
    firestoreProfileFound: verification.firestoreProfileFound === true,
    firestoreProfileRole: clean(verification.firestoreProfileRole),
    firestoreRestaurantId: clean(verification.firestoreRestaurantId),
    masterAdminEnvConfigured: verification.masterAdminEnvConfigured === true,
    masterAdminEmailCount: Number(verification.masterAdminEmailCount || 0) || 0,
    reasonCategory: clean(verification.reasonCategory),
    retryable: verification.retryable === true,
    version: clean(verification.version || verification.appVersion),
    runtime: verification.runtime && typeof verification.runtime === 'object'
      ? {
          firebaseProjectId: clean(verification.runtime.firebaseProjectId),
          firebaseStorageBucket: clean(verification.runtime.firebaseStorageBucket),
          vercelEnv: clean(verification.runtime.vercelEnv)
        }
      : undefined,
    error: clean(verification.error).slice(0, 300),
    lastTransientFailure: clean(verification.lastTransientFailure).slice(0, 300),
    transientFailureAt: clean(verification.transientFailureAt),
    nextRetryInMs: Number(verification.nextRetryInMs || 0) || 0,
    attempt: Number(verification.attempt || 0) || 0,
    uid: clean(verification.uid),
    email: clean(verification.email)
  };
};

export const platformAuthoritySourceFrom = (verification = {}, user = {}) => clean(
  verification?.platformAuthority?.source ||
  user?.platformAdminVerification?.platformAuthority?.source ||
  user?.serverAdminCheck?.platformAuthority?.source ||
  user?.superAdminAccessSource ||
  ''
);

export const hasServerVerifiedPlatformAuthority = (verification = {}) => {
  if (!verification || typeof verification !== 'object') return false;
  const source = platformAuthoritySourceFrom(verification);
  const trustedSource = TRUSTED_PLATFORM_AUTHORITY_SOURCES.has(source);
  return Boolean(
    (verification.status === WHOAMI_STATES.VERIFIED || verification.ok === true) &&
    verification.superAdmin === true &&
    (
      verification.platformAuthority?.superAdmin === true ||
      verification.platformSuperAdmin === true ||
      verification.protectedRootAdminMatched === true ||
      verification.serverMasterAdminMatched === true ||
      verification.customClaimSuperAdmin === true ||
      verification.firestoreSuperAdmin === true ||
      verification.firestoreSystemAdministrator === true ||
      trustedSource
    )
  );
};

export const userHasServerVerifiedPlatformAuthority = (user = {}) => {
  const verification = user?.serverAdminCheck || user?.platformAdminVerification || {};
  return hasServerVerifiedPlatformAuthority(verification);
};

export const userHasLocalPlatformAdminHint = (user = {}, masterAdminEmail = '') => {
  const normalizedMasterEmail = normalizeEmail(masterAdminEmail);
  const normalizedUserEmail = normalizeEmail(user?.email || user?.employeeEmail || user?.accountProfile?.email || '');
  return Boolean(
    user?.pendingSystemAdminVerification === true ||
    user?.isSuperAdmin === true ||
    user?.systemAccess?.superAdmin === true ||
    (normalizedMasterEmail && normalizedUserEmail && normalizedUserEmail === normalizedMasterEmail)
  );
};

export const resolvePlatformAdminAccessState = ({ user = {}, verification = null, masterAdminEmail = '' } = {}) => {
  const safeVerification = sanitizeWhoamiVerification(verification || user?.serverAdminCheck || user?.platformAdminVerification || {});
  const source = platformAuthoritySourceFrom(safeVerification, user);
  const verified = hasServerVerifiedPlatformAuthority(safeVerification);
  const localHint = userHasLocalPlatformAdminHint(user, masterAdminEmail);
  const status = safeVerification.status || WHOAMI_STATES.IDLE;
  const signedIn = Boolean(user?.id || user?.uid || user?.email || safeVerification.uid || safeVerification.email);
  const base = {
    state: PLATFORM_ADMIN_ACCESS_STATES.IDLE,
    verified: false,
    pending: false,
    temporarilyUnavailable: false,
    denied: false,
    definitive: false,
    retryable: false,
    showDrawerEntry: false,
    canRenderProtectedControls: false,
    source,
    reasonCategory: safeVerification.reasonCategory || '',
    statusCode: safeVerification.statusCode || 0,
    verification: safeVerification
  };

  if (verified) {
    return {
      ...base,
      state: PLATFORM_ADMIN_ACCESS_STATES.VERIFIED,
      verified: true,
      showDrawerEntry: true,
      canRenderProtectedControls: true,
      source: source || 'api-whoami',
      definitive: true
    };
  }
  if (status === WHOAMI_STATES.SIGNED_OUT) {
    return { ...base, state: PLATFORM_ADMIN_ACCESS_STATES.SIGNED_OUT, denied: true, definitive: true };
  }
  if (status === WHOAMI_STATES.DENIED && safeVerification.definitive === true) {
    return { ...base, state: PLATFORM_ADMIN_ACCESS_STATES.DENIED, denied: true, definitive: true };
  }
  if (status === WHOAMI_STATES.PENDING || status === WHOAMI_STATES.RETRYING || (status === WHOAMI_STATES.IDLE && localHint)) {
    return {
      ...base,
      state: PLATFORM_ADMIN_ACCESS_STATES.PENDING,
      pending: true,
      retryable: true,
      showDrawerEntry: localHint,
      reasonCategory: safeVerification.reasonCategory || 'server-verification-pending'
    };
  }
  if (status === WHOAMI_STATES.TRANSIENT_FAILURE) {
    return {
      ...base,
      state: PLATFORM_ADMIN_ACCESS_STATES.TEMPORARILY_UNAVAILABLE,
      temporarilyUnavailable: true,
      retryable: true,
      showDrawerEntry: localHint,
      reasonCategory: safeVerification.reasonCategory || 'temporary-verification-failure'
    };
  }
  return {
    ...base,
    state: signedIn ? PLATFORM_ADMIN_ACCESS_STATES.DENIED : PLATFORM_ADMIN_ACCESS_STATES.IDLE,
    denied: signedIn,
    definitive: false
  };
};

export const classifyWhoamiResponse = ({ ok = false, status = 0, data = {}, error = '' } = {}) => {
  if (ok === true) {
    return sanitizeWhoamiVerification({
      status: data?.superAdmin === true ? WHOAMI_STATES.VERIFIED : WHOAMI_STATES.DENIED,
      ok: true,
      statusCode: status || 200,
      definitive: true,
      ...data
    });
  }
  const statusCode = Number(status || data?.statusCode || 0);
  if (statusCode === 401) {
    return sanitizeWhoamiVerification({ status: WHOAMI_STATES.DENIED, ok: false, statusCode, definitive: true, ...data, error: data?.error || error || 'Unauthorized' });
  }
  if (isTransientWhoamiFailure({ status: statusCode, error: data?.error || error, reasonCategory: data?.reasonCategory })) {
    return sanitizeWhoamiVerification({ status: WHOAMI_STATES.TRANSIENT_FAILURE, ok: false, statusCode, definitive: false, ...data, error: data?.error || error || 'Temporary verification failure' });
  }
  return sanitizeWhoamiVerification({ status: WHOAMI_STATES.DENIED, ok: false, statusCode, definitive: true, ...data, error: data?.error || error || 'System Administrator verification denied' });
};

export const mergeVerifiedAccess = (user = {}, verification = {}) => {
  if (!user) return user;
  const safeVerification = sanitizeWhoamiVerification(verification);
  const state = safeVerification.status || '';
  const successful = safeVerification.ok === true;
  if (successful && safeVerification.superAdmin === true) {
    const source = platformAuthoritySourceFrom(safeVerification) || (safeVerification.protectedRootAdminMatched ? 'protected-root-admin'
      : safeVerification.serverMasterAdminMatched ? 'server-master-admin-env'
        : safeVerification.customClaimSuperAdmin ? 'firebase-custom-claim'
          : safeVerification.firestoreSuperAdmin ? 'firestore-profile-flag'
            : 'api-whoami');
    return {
      ...user,
      isSuperAdmin: true,
      systemAccess: { ...(user.systemAccess || {}), superAdmin: true },
      permissions: { ...(user.permissions || {}) },
      superAdminAccessSource: source,
      platformAdminVerification: { ...safeVerification, platformAuthority: { ...(safeVerification.platformAuthority || {}), source } },
      pendingSystemAdminVerification: false
    };
  }
  if ((state === WHOAMI_STATES.DENIED || (successful && safeVerification.superAdmin !== true)) && safeVerification.definitive === true) {
    return {
      ...user,
      isSuperAdmin: false,
      systemAccess: { ...(user.systemAccess || {}), superAdmin: false },
      permissions: { ...(user.permissions || {}), systemAdmin: false, godmode: false },
      superAdminAccessSource: 'server-verified-not-system-admin',
      platformAdminVerification: safeVerification,
      pendingSystemAdminVerification: false
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

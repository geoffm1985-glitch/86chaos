'use strict';
function clean(value = '') { return String(value == null ? '' : value).trim(); }
function norm(value = '') { return clean(value).toLowerCase(); }
function uniqueCleanList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const cleaned = clean(value);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}
function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate().getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}
function toIso(value) {
  const ms = toMillis(value);
  return ms ? new Date(ms).toISOString() : '';
}
function newestIso(values = []) {
  const ms = values.map(toMillis).filter(Boolean);
  return ms.length ? new Date(Math.max(...ms)).toISOString() : '';
}
function safeWorkspace(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: clean(data.name || data.restaurantName || data.displayName || doc.id),
    ownerEmail: clean(data.ownerEmail || data.billingEmail || ''),
    ownerName: clean(data.ownerName || ''),
    isActive: data.isActive !== false,
    status: clean(data.status || (data.isActive === false ? 'inactive' : 'active')),
    planId: clean(data.planId || data.subscription?.planId || data.selectedFutureTier || ''),
    createdAt: data.createdAt || data.created || '',
    updatedAt: data.updatedAt || data.lastUpdatedAt || '',
    environment: clean(process.env.VERCEL_ENV || process.env.CHAOS_ENV || ''),
  };
}
function safeUser(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    uid: clean(data.uid || data.authUid || doc.id),
    authUid: clean(data.authUid || data.uid || ''),
    name: clean(data.name || data.displayName || data.fullName || data.email || doc.id),
    email: norm(data.email || data.emailLower || ''),
    role: clean(data.role || data.accountRole || ''),
    restaurantId: clean(data.restaurantId || data.activeRestaurantId || data.defaultRestaurantId || ''),
    workspaceIds: Array.isArray(data.workspaceIds) ? data.workspaceIds.map(clean).filter(Boolean) : [],
    isActive: data.isActive !== false && data.disabled !== true && data.deleted !== true && data.archived !== true,
  };
}
const EDITABLE_PERMISSION_KEYS = ['schedule', 'events', 'ops', 'inventory', 'prep', 'sales', 'team', 'labor'];
function safePermissions(permissions = {}) {
  return EDITABLE_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = permissions?.[key] === true;
    return acc;
  }, {});
}
function workspaceIdsForPlatformUser(data = {}) {
  const ids = [data.restaurantId || data.activeRestaurantId || data.defaultRestaurantId];
  if (Array.isArray(data.workspaceIds)) ids.push(...data.workspaceIds);
  if (data.memberships && typeof data.memberships === 'object') {
    Object.entries(data.memberships).forEach(([workspaceId, membership]) => {
      if (membership && typeof membership === 'object' && membership.isActive !== false) ids.push(workspaceId);
    });
  }
  return uniqueCleanList(ids);
}
function countUniqueActivePushDevices(data = {}) {
  const tokens = new Set();
  const remember = (token, meta = {}) => {
    if (meta && typeof meta === 'object' && meta.active === false) return;
    const cleanToken = clean(token);
    if (cleanToken) tokens.add(cleanToken);
  };
  remember(data.fcmToken, { active: true });
  (Array.isArray(data.fcmTokens) ? data.fcmTokens : []).forEach((entry) => {
    remember(typeof entry === 'string' ? entry : entry?.token || entry?.fcmToken, typeof entry === 'object' && entry ? entry : {});
  });
  (Array.isArray(data.pushTokens) ? data.pushTokens : []).forEach((entry) => {
    remember(typeof entry === 'string' ? entry : entry?.token || entry?.fcmToken, typeof entry === 'object' && entry ? entry : {});
  });
  if (data.pushDevices && typeof data.pushDevices === 'object') {
    Object.values(data.pushDevices).forEach((entry) => {
      remember(typeof entry === 'string' ? entry : entry?.token || entry?.fcmToken, typeof entry === 'object' && entry ? entry : {});
    });
  }
  return tokens.size;
}
function pushLastSyncForPlatformUser(data = {}) {
  const values = [data.fcmTokenUpdatedAt, data.lastPushTokenSyncAt];
  const collectMeta = (entry) => {
    if (entry && typeof entry === 'object') values.push(entry.lastVerifiedAt, entry.updatedAt, entry.fcmTokenUpdatedAt, entry.createdAt);
  };
  (Array.isArray(data.fcmTokens) ? data.fcmTokens : []).forEach(collectMeta);
  (Array.isArray(data.pushTokens) ? data.pushTokens : []).forEach(collectMeta);
  if (data.pushDevices && typeof data.pushDevices === 'object') Object.values(data.pushDevices).forEach(collectMeta);
  return newestIso(values);
}
function safePlatformUser(doc) {
  const data = doc.data() || {};
  const deviceDiagnostics = data.deviceDiagnostics && typeof data.deviceDiagnostics === 'object'
    ? { gpsPermission: clean(data.deviceDiagnostics.gpsPermission || '') }
    : undefined;
  const row = {
    id: doc.id,
    uid: clean(data.uid || data.authUid || doc.id),
    authUid: clean(data.authUid || data.uid || ''),
    name: clean(data.name || data.displayName || data.fullName || data.email || doc.id),
    email: norm(data.email || data.emailLower || ''),
    phone: clean(data.phone || data.phoneNumber || ''),
    photoURL: clean(data.photoURL || data.avatarUrl || ''),
    role: clean(data.role || data.accountRole || ''),
    restaurantId: clean(data.restaurantId || data.activeRestaurantId || data.defaultRestaurantId || ''),
    workspaceIds: workspaceIdsForPlatformUser(data),
    isActive: data.isActive !== false && data.disabled !== true && data.deleted !== true && data.archived !== true,
    isAdmin: data.isAdmin === true,
    isSuperAdmin: data.isSuperAdmin === true || data.systemAccess?.superAdmin === true,
    forcePasswordChange: data.forcePasswordChange === true,
    wage: data.wage ?? '',
    permissions: safePermissions(data.permissions || {}),
    gpsPermission: clean(data.gpsPermission || ''),
    activeTab: clean(data.activeTab || ''),
    activeHost: clean(data.activeHost || ''),
    lastActive: data.lastActive || '',
    lastOnline: data.lastOnline || '',
    lastSeen: data.lastSeen || '',
    createdAt: data.createdAt || '',
    importedAt: data.importedAt || '',
    updatedAt: data.updatedAt || '',
    notificationPermission: clean(data.notificationPermission || ''),
    pushTokenPermission: clean(data.pushTokenPermission || ''),
    pushTokenHost: clean(data.pushTokenHost || ''),
    pushNeedsRepair: data.pushNeedsRepair === true,
    pushForceServiceWorkerRefresh: data.pushForceServiceWorkerRefresh === true,
    pushRepairStatus: clean(data.pushRepairStatus || ''),
    lastPushFailureCode: clean(data.lastPushFailureCode || ''),
    lastPushRepairError: clean(data.lastPushRepairError || ''),
    pushDeviceCount: countUniqueActivePushDevices(data),
    pushLastSyncAt: pushLastSyncForPlatformUser(data)
  };
  if (deviceDiagnostics) row.deviceDiagnostics = deviceDiagnostics;
  return row;
}
module.exports = { clean, norm, safeWorkspace, safeUser, safePlatformUser, countUniqueActivePushDevices, pushLastSyncForPlatformUser, workspaceIdsForPlatformUser };

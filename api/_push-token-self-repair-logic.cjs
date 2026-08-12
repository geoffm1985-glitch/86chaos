'use strict';

const norm = (value = '') => String(value || '').toLowerCase().trim();
const cleanId = (value = '') => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);

const EXACT_ALLOWED_PUSH_FIELDS = new Set([
  'fcmToken',
  'fcmTokenUpdatedAt',
  'lastPushTokenSyncAt',
  'notificationPermission',
  'pushTokenPermission',
  'pushTokenHost',
  'pushTokenCanonical',
  'pushTokenDedupeVersion',
  'pushNeedsRepair',
  'pushForceServiceWorkerRefresh',
  'pushRepairStatus',
  'pushRepairCompletedAt',
  'pushRepairCompletedHost',
  'lastPushRepairError',
  'lastPushFailureCode'
]);


function buildStablePushRepairRequestId(user = {}, context = {}) {
  const stableServerId = String(user.pushTokenRepairNonce || user.pushRepairRequestId || '').trim();
  if (stableServerId) return stableServerId;
  const authUserId = String(context.authUid || context.uid || user.authUid || user.uid || user.userId || user.accountUserId || user.id || user.email || 'user').trim();
  const workspaceId = String(context.restaurantId || user.restaurantId || 'workspace').trim();
  const deviceId = cleanId(context.deviceId || 'device');
  const host = String(context.host || 'host').toLowerCase().trim();
  return `legacy-active:${authUserId}:${workspaceId}:${deviceId}:${host}`;
}

function decodedIdentity(decoded = {}) {
  return {
    uid: String(decoded.uid || '').trim(),
    email: norm(decoded.email || decoded.firebase?.identities?.email?.[0] || '')
  };
}

function profileMatchesDecoded(profile = {}, profileDocId = '', decoded = {}) {
  const identity = decodedIdentity(decoded);
  if (!identity.uid && !identity.email) return false;
  const ids = [profileDocId, profile.id, profile.uid, profile.authUid, profile.userId, profile.accountUserId, profile.firebaseUid]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  if (identity.uid && ids.includes(identity.uid)) return true;
  const emails = [profile.email, profile.userEmail, profile.employeeEmail, profile.accountEmail]
    .map(norm)
    .filter(Boolean);
  return Boolean(identity.email && emails.includes(identity.email));
}

function collectOwnProfileCandidateIds(decoded = {}, requestedProfileDocId = '', caller = {}) {
  const identity = decodedIdentity(decoded);
  const ids = [requestedProfileDocId, caller.id, caller.profileDocId, caller.accountProfile?.id, caller.userId, caller.uid, caller.authUid, identity.uid]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(value => value.slice(0, 180));
  return [...new Set(ids)];
}

function isSafePushDeviceField(field = '') {
  const text = String(field || '');
  if (!text.startsWith('pushDevices.')) return false;
  const deviceId = text.slice('pushDevices.'.length);
  return Boolean(deviceId && deviceId === cleanId(deviceId));
}

function sanitizeSelfRepairPatch(patch = {}) {
  const clean = {};
  const rejected = [];
  Object.entries(patch || {}).forEach(([field, value]) => {
    if (EXACT_ALLOWED_PUSH_FIELDS.has(field)) {
      clean[field] = value;
      return;
    }
    if (isSafePushDeviceField(field) && value && typeof value === 'object' && !Array.isArray(value)) {
      clean[field] = value;
      return;
    }
    rejected.push(field);
  });
  return { ok: Object.keys(clean).length > 0 && rejected.length === 0, patch: clean, rejected };
}

function readPath(source = {}, dottedPath = '') {
  return String(dottedPath || '').split('.').filter(Boolean).reduce((current, part) => (current && typeof current === 'object' ? current[part] : undefined), source);
}

function verifySelfRepairReadback(verified = {}, patch = {}) {
  const errors = [];
  if (Object.prototype.hasOwnProperty.call(patch, 'fcmToken') && verified.fcmToken !== patch.fcmToken) errors.push('fcmToken');
  if (Object.prototype.hasOwnProperty.call(patch, 'notificationPermission') && verified.notificationPermission !== patch.notificationPermission) errors.push('notificationPermission');
  if (Object.prototype.hasOwnProperty.call(patch, 'pushNeedsRepair') && verified.pushNeedsRepair !== patch.pushNeedsRepair) errors.push('pushNeedsRepair');
  if (Object.prototype.hasOwnProperty.call(patch, 'pushForceServiceWorkerRefresh') && verified.pushForceServiceWorkerRefresh !== patch.pushForceServiceWorkerRefresh) errors.push('pushForceServiceWorkerRefresh');
  if (Object.prototype.hasOwnProperty.call(patch, 'pushRepairStatus') && verified.pushRepairStatus !== patch.pushRepairStatus) errors.push('pushRepairStatus');
  Object.entries(patch || {}).forEach(([field, value]) => {
    if (!isSafePushDeviceField(field)) return;
    const saved = readPath(verified, field);
    if (!saved || typeof saved !== 'object') {
      errors.push(field);
      return;
    }
    if (value?.token && saved.token !== value.token) errors.push(`${field}.token`);
    if (value?.permission && saved.permission !== value.permission) errors.push(`${field}.permission`);
  });
  return { ok: errors.length === 0, errors };
}

module.exports = {
  EXACT_ALLOWED_PUSH_FIELDS,
  buildStablePushRepairRequestId,
  cleanId,
  collectOwnProfileCandidateIds,
  decodedIdentity,
  isSafePushDeviceField,
  norm,
  profileMatchesDecoded,
  readPath,
  sanitizeSelfRepairPatch,
  verifySelfRepairReadback
};

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

module.exports = {
  EXACT_ALLOWED_PUSH_FIELDS,
  cleanId,
  collectOwnProfileCandidateIds,
  decodedIdentity,
  isSafePushDeviceField,
  norm,
  profileMatchesDecoded,
  sanitizeSelfRepairPatch
};

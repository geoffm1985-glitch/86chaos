'use strict';

const SYSTEM_ADMIN_SOURCE_LABELS = Object.freeze({
  SERVER_MASTER_EMAIL: 'server-master-admin-env',
  CUSTOM_CLAIM: 'firebase-custom-claim',
  FIRESTORE_PROFILE_FLAG: 'firestore-profile-flag',
  PROTECTED_ROOT: 'protected-root-admin'
});

function norm(value = '') {
  return String(value || '').toLowerCase().trim();
}

function truthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function profileDisabled(profile = {}) {
  if (!profile || typeof profile !== 'object') return false;
  return profile.isActive === false || /disabled|inactive|locked|deleted|removed/i.test(String(profile.status || ''));
}

function hasFirestorePlatformAdminFlag(profile = {}) {
  if (!profile || typeof profile !== 'object') return false;
  // Platform authority must come only from fields treated as server-owned by the
  // existing rules/model. Tenant-editable restaurant permissions and workspace
  // role metadata are display-only and must never grant System Administrator.
  return Boolean(
    truthy(profile.isSuperAdmin) ||
    truthy(profile.systemAccess?.superAdmin)
  );
}

function roleTextForDisplay(profile = {}) {
  return [
    profile?.role,
    profile?.roleName,
    profile?.accountRole,
    profile?.title,
    profile?.jobTitle,
    profile?.systemRole
  ].filter(Boolean).map(value => String(value).trim()).filter(Boolean).join(' ');
}

function decidePlatformAdminAuthority({ decoded = {}, profile = null, masterEmails = [], protectedRootEmails = [] } = {}) {
  const email = norm(decoded.email || profile?.email || profile?.emailLower || '');
  const normalizedMasterEmails = new Set((masterEmails || []).map(norm).filter(Boolean));
  const normalizedProtectedEmails = new Set((protectedRootEmails || []).map(norm).filter(Boolean));
  const disabled = profileDisabled(profile || {});
  const firestoreSuperAdminFlag = !disabled && hasFirestorePlatformAdminFlag(profile || {});
  const customClaimSuperAdmin = truthy(decoded.superAdmin) || truthy(decoded.systemAccess?.superAdmin);
  const protectedRootAdminMatched = Boolean(email && normalizedProtectedEmails.has(email));
  const serverMasterAdminMatched = Boolean(email && normalizedMasterEmails.has(email));
  const superAdmin = Boolean(customClaimSuperAdmin || protectedRootAdminMatched || serverMasterAdminMatched || firestoreSuperAdminFlag);
  const source = customClaimSuperAdmin ? SYSTEM_ADMIN_SOURCE_LABELS.CUSTOM_CLAIM
    : protectedRootAdminMatched ? SYSTEM_ADMIN_SOURCE_LABELS.PROTECTED_ROOT
      : serverMasterAdminMatched ? SYSTEM_ADMIN_SOURCE_LABELS.SERVER_MASTER_EMAIL
        : firestoreSuperAdminFlag ? SYSTEM_ADMIN_SOURCE_LABELS.FIRESTORE_PROFILE_FLAG
          : '';
  return {
    superAdmin,
    authoritative: true,
    protected: protectedRootAdminMatched,
    source,
    customClaimSuperAdmin,
    protectedRootAdminMatched,
    serverMasterAdminMatched,
    firestoreSuperAdmin: firestoreSuperAdminFlag,
    firestoreSuperAdminFlag,
    firestoreProfileDisabled: disabled,
    firestoreRoleText: roleTextForDisplay(profile || {}),
    workspaceRole: String(profile?.role || profile?.workspaceRole || '').trim()
  };
}

module.exports = {
  SYSTEM_ADMIN_SOURCE_LABELS,
  decidePlatformAdminAuthority,
  hasFirestorePlatformAdminFlag,
  profileDisabled,
  roleTextForDisplay,
  norm,
  truthy
};

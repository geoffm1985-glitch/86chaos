'use strict';

function normalizeEmail(value = '') {
  return String(value || '').toLowerCase().trim();
}

function cleanString(value = '') {
  return String(value || '').trim();
}

function safeMembershipIdPart(value = '') {
  return cleanString(value).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}

function canonicalMembershipDocId(uid = '', restaurantId = '') {
  const userPart = safeMembershipIdPart(uid);
  const restaurantPart = safeMembershipIdPart(restaurantId);
  if (!userPart || !restaurantPart) return '';
  return `${userPart}_${restaurantPart}`.slice(0, 240);
}

function isActiveWorkspaceMembership(member = {}) {
  const status = String(member.status || member.recordStatus || member.membershipStatus || '').toLowerCase().trim();
  return member.isActive !== false && member.deleted !== true && member.isDeleted !== true && member.removed !== true && !['deleted', 'removed', 'inactive', 'disabled', 'deactivated'].includes(status);
}

function buildTargetIdentity(targetUid = '', targetEmail = '', targetProfile = {}) {
  const ids = new Set([targetUid, targetProfile?.id, targetProfile?.uid, targetProfile?.authUid, targetProfile?.userId, targetProfile?.accountUserId]
    .map(cleanString)
    .filter(Boolean));
  const emails = new Set([targetEmail, targetProfile?.email, targetProfile?.employeeEmail, targetProfile?.userEmail]
    .map(normalizeEmail)
    .filter(Boolean));
  return { ids, emails };
}

function membershipMatchesTargetIdentity(member = {}, targetIdentity = {}, docId = '') {
  const ids = targetIdentity.ids || new Set();
  const emails = targetIdentity.emails || new Set();
  const cleanDocId = cleanString(docId || member.id || member.membershipId || '');
  if (cleanDocId && Array.from(ids).some(id => cleanDocId === id || cleanDocId.startsWith(`${safeMembershipIdPart(id)}_`))) return true;
  const memberIds = [member.userId, member.uid, member.authUid, member.accountUserId, member.id, member.membershipUserId]
    .map(cleanString)
    .filter(Boolean);
  if (memberIds.some(id => ids.has(id))) return true;
  const memberEmails = [member.email, member.emailLower, member.employeeEmail, member.userEmail]
    .map(normalizeEmail)
    .filter(Boolean);
  return memberEmails.some(email => emails.has(email));
}

function targetWorkspaceIds(targetUid = '', targetProfile = {}) {
  const ids = new Set();
  [targetProfile.restaurantId, targetProfile.activeRestaurantId, targetProfile.defaultRestaurantId].forEach(value => {
    const clean = cleanString(value);
    if (clean) ids.add(clean);
  });
  if (Array.isArray(targetProfile.workspaceIds)) targetProfile.workspaceIds.forEach(value => {
    const clean = cleanString(value);
    if (clean) ids.add(clean);
  });
  if (targetProfile.memberships && typeof targetProfile.memberships === 'object') {
    Object.keys(targetProfile.memberships).forEach(value => {
      const clean = cleanString(value);
      if (clean) ids.add(clean);
    });
  }
  return Array.from(ids);
}

module.exports = {
  normalizeEmail,
  cleanString,
  safeMembershipIdPart,
  canonicalMembershipDocId,
  isActiveWorkspaceMembership,
  buildTargetIdentity,
  membershipMatchesTargetIdentity,
  targetWorkspaceIds
};

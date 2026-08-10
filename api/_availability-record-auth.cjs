'use strict';
function cleanString(value, fallback = '') { return String(value == null ? fallback : value).trim(); }
function norm(value = '') { return cleanString(value).toLowerCase(); }
function memberDocId(uid, restaurantId) {
  return `${cleanString(uid).replace(/[^A-Za-z0-9_-]/g, '_')}_${cleanString(restaurantId).replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
}
function isActiveMembership(record = {}) {
  if (!record || typeof record !== 'object') return false;
  const status = norm(record.status || record.recordStatus || record.membershipStatus || '');
  return record.isActive !== false && record.disabled !== true && record.deleted !== true && record.removed !== true && !['inactive', 'disabled', 'deleted', 'removed', 'deactivated'].includes(status);
}
function canDeleteAvailabilityRecord({ decoded = {}, caller = {}, membership = {}, restaurant = {}, restaurantId = '' } = {}) {
  const email = norm(decoded.email || caller.email || membership.email || '');
  const masterEmails = String(process.env.MASTER_ADMIN_EMAILS || process.env.MASTER_ADMIN_EMAIL || '')
    .split(',')
    .map(norm)
    .filter(Boolean);
  const isSuperAdmin = caller.isSuperAdmin === true || caller.superAdmin === true || caller.platformAdmin === true || masterEmails.includes(email);
  const isOwner =
    caller.isOwner === true || caller.accountOwner === true || caller.workspaceOwner === true ||
    membership.isOwner === true || membership.accountOwner === true || membership.workspaceOwner === true ||
    decoded.uid === restaurant.ownerUid || decoded.uid === restaurant.ownerUserId ||
    (email && [restaurant.ownerEmail, restaurant.ownerEmailLower, restaurant.ownerUserEmail].map(norm).includes(email));
  const permissions = { ...(caller.permissions || {}), ...(membership.permissions || {}) };
  const isAdmin = caller.isAdmin === true || membership.isAdmin === true;
  const scopedMember = isActiveMembership(membership) || caller.restaurantId === restaurantId || caller.activeRestaurantId === restaurantId || caller.defaultRestaurantId === restaurantId;
  return Boolean(isSuperAdmin || (scopedMember && (isOwner || isAdmin || permissions.schedule === true || permissions.team === true)));
}
module.exports = { cleanString, norm, memberDocId, isActiveMembership, canDeleteAvailabilityRecord };

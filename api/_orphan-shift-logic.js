'use strict';

function safeText(value = '', max = 180) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/(token|secret|private[_ -]?key|authorization)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]')
    .trim()
    .slice(0, max);
}
function normalizeEmail(value = '') { return String(value || '').trim().toLowerCase(); }
function shiftIdentity(shift = {}) {
  return String(shift.scheduleUserId || shift.userId || shift.rosterUserId || shift.authUid || shift.employeeId || '').trim();
}
function alternateEmails(shift = {}) {
  return [...new Set([shift.employeeEmail, shift.assignedEmail, shift.userEmail, shift.email].map(normalizeEmail).filter(Boolean))];
}
function userMatchesRestaurant(user = {}, restaurantId = '') {
  if (!restaurantId) return false;
  if ([user.restaurantId, user.activeRestaurantId, user.defaultRestaurantId].some(id => String(id || '') === String(restaurantId))) return true;
  if (Array.isArray(user.workspaceIds) && user.workspaceIds.map(String).includes(String(restaurantId))) return true;
  if (user.memberships && typeof user.memberships === 'object') {
    const membership = user.memberships[restaurantId];
    if (membership && membership.isActive !== false && membership.disabled !== true) return true;
  }
  return false;
}
function baseShiftClassification(shift = {}, id = '') {
  const restaurantId = String(shift.restaurantId || shift.workspaceId || '').trim();
  const identity = shiftIdentity(shift);
  const emails = alternateEmails(shift);
  const evidence = {
    scheduleUserId: shift.scheduleUserId || '',
    userId: shift.userId || '',
    rosterUserId: shift.rosterUserId || '',
    authUid: shift.authUid || '',
    employeeId: shift.employeeId || '',
    emails
  };
  if (!restaurantId) return { terminal: true, classification: 'ambiguous', id, restaurantId, identity, reason: 'Shift has no restaurant/workspace identity.', evidence };
  if (!identity) return { terminal: true, classification: 'ambiguous', id, restaurantId, identity, reason: 'Shift has no canonical identity. Missing identity is never auto-deleted.', evidence };
  return { terminal: false, id, restaurantId, identity, emails, evidence };
}

module.exports = { safeText, normalizeEmail, shiftIdentity, alternateEmails, userMatchesRestaurant, baseShiftClassification };

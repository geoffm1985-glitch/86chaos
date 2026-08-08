'use strict';
function clean(value = '') { return String(value == null ? '' : value).trim(); }
function norm(value = '') { return clean(value).toLowerCase(); }
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
module.exports = { clean, norm, safeWorkspace, safeUser };

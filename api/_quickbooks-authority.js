'use strict';
const { initAdmin, authorize, requireAppCheckIfEnforced } = require('./_chaos-admin');
async function authorizeQuickBooks(req, restaurantId) {
  const app = initAdmin(req);
  const ctx = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
  if (!ctx.ok) throw Object.assign(new Error(ctx.error), { statusCode: ctx.status || 403 });
  if (!restaurantId || ctx.restaurantId !== restaurantId || !(ctx.isSuperAdmin || ctx.user?.isAdmin || ctx.user?.isOwner || ctx.user?.accountOwner || ctx.user?.workspaceOwner)) throw Object.assign(new Error('Workspace owner or administrator approval is required.'), { statusCode: 403 });
  const check = await requireAppCheckIfEnforced(ctx.app || app, req);
  if (!check.ok) throw Object.assign(new Error(check.error), { statusCode: check.status || 401 });
  return ctx;
}
module.exports = { authorizeQuickBooks };

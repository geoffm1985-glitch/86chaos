'use strict';
const { assertTenant, safeId, hash } = require('./_invoice-approval');
const { finiteNumber, normalizeUnit, convertQuantity } = require('../src/core/restaurantPack.cjs');
const fail = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'MENU_REVIEW_REQUIRED' }); };
async function approveMenu({ db, ctx, scan, approved }) {
  if (approved !== true || !scan || !String(scan.storagePath || '').startsWith(`${ctx.restaurantId}/`)) fail('A workspace menu scan and explicit human approval are required.');
  if (!Array.isArray(scan.menuItems) || scan.menuItems.length > 400 || Buffer.byteLength(JSON.stringify(scan)) > 650000) fail('Menu review exceeds the safe document limit. Split the menu.');
  const sourceKey = scan.scanRequestId || scan.storagePath;
  const id = `menu_${hash(`${ctx.restaurantId}|${sourceKey}`)}`;
  const ref = db.collection('menuIntelligenceScans').doc(id);
  const links = [];
  for (const item of scan.menuItems) {
    for (const ingredient of item.ingredients || []) {
      if (!(ingredient.matchedInventoryItemId || ingredient.batchRecipeId) || ingredient.reviewStatus !== 'approved' || ingredient.approved === false) continue;
      if (!safeId(ingredient.batchRecipeId || ingredient.matchedInventoryItemId)) fail('Invalid ingredient selection.');
      const quantity = finiteNumber(ingredient.estimatedQuantity ?? ingredient.quantity);
      if (quantity === null || quantity <= 0 || convertQuantity(1, ingredient.estimatedUnit || ingredient.unit, ingredient.estimatedUnit || ingredient.unit) === null) fail('Every approved link needs a positive portion quantity and unit.');
      links.push({ item, ingredient, quantity });
    }
  }
  if (!links.length || links.length > 400) fail('Review between 1 and 400 ingredient links per scan.');
  return db.runTransaction(async tx => {
    const prior = await tx.get(ref);
    if (prior.exists) { assertTenant(prior.data(), ctx.restaurantId); return { id, duplicate: true, saved: prior.data().dependencyCount || 0 }; }
    const ids = [...new Set(links.filter(link => !link.ingredient.batchRecipeId).map(link => link.ingredient.matchedInventoryItemId))];
    const snapshots = await Promise.all(ids.map(itemId => tx.get(db.collection('inventoryItems').doc(itemId))));
    const inventory = new Map(snapshots.map(snap => { assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId); return [snap.id, snap.data()]; }));
    const recipeIds = [...new Set(links.map(link => link.ingredient.batchRecipeId).filter(Boolean))];
    const recipeSnaps = await Promise.all(recipeIds.map(recipeId => tx.get(db.collection('recipes').doc(recipeId))));
    const recipes = new Map(recipeSnaps.map(snap => { assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId); if (!snap.data().costingApprovedAt) fail('Approve the batch ingredients and yield in Recipes first.'); return [snap.id, snap.data()]; }));
    const at = new Date().toISOString();
    links.forEach(({ item, ingredient, quantity }, index) => {
      const batch = ingredient.batchRecipeId ? recipes.get(ingredient.batchRecipeId) : null;
      const product = batch ? { name: batch.title } : inventory.get(ingredient.matchedInventoryItemId);
      if (batch && convertQuantity(quantity, ingredient.estimatedUnit || ingredient.unit, batch.batchYieldUnit) === null) fail('Menu portion unit must agree with the approved batch yield unit.');
      if (product.inventorySourceType === 'non_food_supply' || /suppl|cleaning/i.test(product.category || '')) fail('Food-cost links cannot use non-food supplies.');
      tx.set(db.collection('menuDependencies').doc(`${id}_${index}`), { restaurantId: ctx.restaurantId, menuItemName: String(item.name || 'Menu item').slice(0, 160),
        menuCategory: String(item.category || '').slice(0, 100), menuDescription: String(item.description || '').slice(0, 500), menuItemPrice: finiteNumber(item.price) || 0,
        menuItemPriceText: String(item.priceText || '').slice(0, 80), ingredientName: String(ingredient.name || product.name).slice(0, 160),
        inventoryItemId: batch ? '' : ingredient.matchedInventoryItemId, inventoryItemName: batch ? '' : product.name, batchRecipeId: ingredient.batchRecipeId || '', estimatedQuantity: quantity,
        estimatedUnit: normalizeUnit(ingredient.estimatedUnit || ingredient.unit), portionConfidence: ingredient.portionConfidence || 'estimated', confidence: ingredient.confidence || 'reviewed',
        source: 'menu_intelligence_ai_review', status: 'approved', approvedAt: at, approvedBy: ctx.uid, scanId: id,
        scanFileName: String(scan.fileName || '').slice(0, 200), scanStoragePath: scan.storagePath });
    });
    tx.set(ref, { restaurantId: ctx.restaurantId, fileName: String(scan.fileName || '').slice(0, 200), storagePath: scan.storagePath,
      uploadedFileName: String(scan.uploadedFileName || '').slice(0, 200), downloadUrl: String(scan.downloadUrl || '').slice(0, 2000), compression: scan.compression || null,
      menuItemCount: scan.menuItems.length, dependencyCount: links.length, menuItemsWithPrices: scan.menuItems.filter(item => Number(item.price) > 0).length,
      menuCostingEnabled: true, status: 'approved', createdAt: at, approvedAt: at, approvedBy: ctx.uid, sourceIdentity: id });
    tx.set(db.collection('auditLogs').doc(id), { restaurantId: ctx.restaurantId, userId: ctx.uid, action: 'MENU_INTELLIGENCE_APPROVED', target: ref.path,
      timestamp: at, details: `${links.length} explicitly reviewed ingredient links.`, sourceIdentity: id });
    return { id, saved: links.length, duplicate: false };
  });
}
module.exports = { approveMenu };

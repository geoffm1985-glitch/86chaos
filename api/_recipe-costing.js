'use strict';
const { assertTenant, safeId } = require('./_invoice-approval');
const { finiteNumber, usableYield, normalizeUnit, convertQuantity } = require('../src/core/restaurantPack.cjs');
const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
async function recipeCosting({ db, ctx, body }) {
  if (!safeId(body.recipeId)) fail('Select a recipe.');
  const ref = db.collection('recipes').doc(body.recipeId);
  if (body.action === 'recipe-costing-read') {
    const snap = await ref.get(); assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId);
    const ids = (snap.data().costingDependencyIds || []).filter(safeId).slice(0, 80);
    const rows = ids.length ? await db.getAll(...ids.map(id => db.collection('menuDependencies').doc(id))) : [];
    return { rows: rows.filter(row => row.exists && row.data().restaurantId === ctx.restaurantId).map(row => ({ id: row.id, ...row.data() })) };
  }
  if (body.action !== 'recipe-costing-approve' || body.approved !== true) fail('Explicit approval of batch ingredients and yield is required.');
  const amount = finiteNumber(body.yieldQuantity); const percent = finiteNumber(body.yieldPercent); const unit = normalizeUnit(body.yieldUnit);
  if (!usableYield(amount, percent) || convertQuantity(1, unit, unit) === null) fail('Enter a valid batch yield, unit, and usable yield percentage.');
  const rows = body.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 80) fail('A batch needs 1–80 reviewed ingredient rows.');
  rows.forEach(row => { if (!safeId(row.inventoryItemId) || !(finiteNumber(row.batchQuantity) > 0) || convertQuantity(1, row.batchUnit, row.batchUnit) === null) fail('Each batch ingredient needs an inventory item, positive quantity, and supported unit.'); });
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref); assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId);
    const oldIds = (snap.data().costingDependencyIds || []).filter(safeId).slice(0, 80);
    const oldLinks = await Promise.all(oldIds.map(id => tx.get(db.collection('menuDependencies').doc(id))));
    oldLinks.filter(row => row.exists).forEach(row => { assertTenant(row.data(), ctx.restaurantId); if (row.data().recipeId !== ref.id || row.data().source !== 'approved_batch_recipe') fail('Invalid batch dependency reference.'); });
    const items = await Promise.all(rows.map(row => tx.get(db.collection('inventoryItems').doc(row.inventoryItemId))));
    items.forEach(item => { assertTenant(item.exists ? item.data() : null, ctx.restaurantId); if (item.data().inventorySourceType === 'non_food_supply' || /suppl|cleaning/i.test(item.data().category || '')) fail('A batch recipe cannot use non-food supplies.'); });
    const sameYield = snap.data().batchYieldQuantity === amount && snap.data().batchYieldUnit === unit && snap.data().batchYieldPercent === percent;
    const sameRows = oldLinks.length === rows.length && oldLinks.every((link, i) => link.exists && link.data().inventoryItemId === rows[i].inventoryItemId && link.data().batchQuantity === Number(rows[i].batchQuantity) && link.data().batchUnit === normalizeUnit(rows[i].batchUnit));
    if (sameYield && sameRows) return { id: ref.id, approvedAt: snap.data().costingApprovedAt, duplicate: true };
    if ((body.expectedApprovedAt || '') !== (snap.data().costingApprovedAt || '')) fail('The recipe costing changed. Reopen this recipe before approving.');
    const ids = rows.map((row, index) => `batch_${ref.id}_${index}`); const at = new Date().toISOString();
    rows.forEach((row, index) => tx.set(db.collection('menuDependencies').doc(ids[index]), { restaurantId: ctx.restaurantId, recipeId: ref.id,
      recipeName: snap.data().title, ingredientName: items[index].data().name, inventoryItemId: row.inventoryItemId, inventoryItemName: items[index].data().name,
      batchQuantity: Number(row.batchQuantity), batchUnit: normalizeUnit(row.batchUnit), source: 'approved_batch_recipe', status: 'approved', approvedAt: at, approvedBy: ctx.uid }));
    oldIds.filter(id => !ids.includes(id)).forEach(id => tx.delete(db.collection('menuDependencies').doc(id)));
    tx.update(ref, { batchYieldQuantity: amount, batchYieldUnit: unit, batchYieldPercent: percent, costingApprovedAt: at, costingApprovedBy: ctx.uid, costingDependencyIds: ids });
    tx.set(db.collection('auditLogs').doc(), { restaurantId: ctx.restaurantId, userId: ctx.uid, action: 'BATCH_COSTING_APPROVED', target: ref.path, timestamp: at,
      details: { previousYield: snap.data().batchYieldQuantity || null, yieldQuantity: amount, yieldUnit: unit, yieldPercent: percent, ingredientCount: rows.length,
        before: oldLinks.filter(link => link.exists).map(link => ({ inventoryItemId: link.data().inventoryItemId, batchQuantity: link.data().batchQuantity, batchUnit: link.data().batchUnit })),
        after: rows.map(row => ({ inventoryItemId: row.inventoryItemId, batchQuantity: Number(row.batchQuantity), batchUnit: normalizeUnit(row.batchUnit) })) } });
    return { id: ref.id, approvedAt: at };
  });
}
module.exports = { recipeCosting };

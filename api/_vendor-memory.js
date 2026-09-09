'use strict';
const { assertTenant, safeId, mappingId } = require('./_invoice-approval');
const { buildApprovedMapping } = require('../src/core/vendorProductMemory.cjs');
function reject(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
async function vendorMemory({ db, ctx, body }) {
  if (!safeId(body.vendorId)) reject('Select a vendor first.');
  const vendorRef = db.collection('vendors').doc(body.vendorId);
  const vendorSnap = await vendorRef.get();
  assertTenant(vendorSnap.exists ? vendorSnap.data() : null, ctx.restaurantId);
  const collection = vendorRef.collection('productMappings');
  if (body.action === 'vendor-memory-resolve') {
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 150) : [];
    const ids = [...new Set(rows.map(mappingId))];
    const snapshots = ids.length ? await db.getAll(...ids.map(id => collection.doc(id))) : [];
    return { mappings: snapshots.filter(snap => snap.exists && snap.data().restaurantId === ctx.restaurantId).map(snap => ({ id: snap.id, ...snap.data() })) };
  }
  if (body.action === 'vendor-memory-list') {
    let q = collection.orderBy('__name__').limit(51);
    if (body.cursor) { if (!safeId(body.cursor)) reject('Invalid cursor.'); q = q.startAfter(collection.doc(body.cursor)); }
    const snap = await q.get(); const page = snap.docs.slice(0, 50);
    return { mappings: page.filter(row => row.data().restaurantId === ctx.restaurantId).map(row => ({ id: row.id, ...row.data() })), nextCursor: snap.docs.length > 50 ? page[page.length - 1].id : null };
  }
  if (!['vendor-memory-edit', 'vendor-memory-revoke'].includes(body.action) || !safeId(body.mappingId)) reject('Invalid mapping action.');
  const ref = collection.doc(body.mappingId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref); assertTenant(snap.exists ? snap.data() : null, ctx.restaurantId);
    const previous = snap.data();
    if (body.expectedApprovedAt !== previous.approvedAt) reject('This mapping changed. Reload it before editing.', 409);
    if (body.action === 'vendor-memory-revoke' && previous.active === false) return { id: ref.id, noOp: true };
    const at = new Date().toISOString(); let next;
    if (body.action === 'vendor-memory-revoke') next = { ...previous, active: false, state: 'revoked', revokedAt: at, revokedBy: ctx.uid };
    else {
      if (!safeId(body.inventoryItemId) || !String(body.packSize || '').trim()) reject('Select the correct item and package size.');
      const itemSnap = await tx.get(db.collection('inventoryItems').doc(body.inventoryItemId));
      assertTenant(itemSnap.exists ? itemSnap.data() : null, ctx.restaurantId);
      next = buildApprovedMapping({ restaurantId: ctx.restaurantId, vendorId: vendorRef.id, vendorName: vendorSnap.data().name,
        row: { productCode: previous.productCode, itemName: previous.originalDescription, packSize: body.packSize,
          uom: body.purchaseUnit || previous.purchaseUnit, priceUnit: previous.priceUnit, unitPrice: previous.approvedUnitPrice },
        inventoryItem: { id: itemSnap.id, ...itemSnap.data() }, approvedBy: ctx.uid, approvedAt: at, previous });
      next.useCount = previous.useCount || 0; next.lastUsedAt = previous.lastUsedAt || '';
      if (previous.active && previous.inventoryItemId === next.inventoryItemId && previous.approvedPackSize === next.approvedPackSize && previous.purchaseUnit === next.purchaseUnit) return { id: ref.id, noOp: true };
    }
    tx.set(ref, next);
    tx.set(db.collection('auditLogs').doc(), { restaurantId: ctx.restaurantId, userId: ctx.uid, action: body.action, target: ref.path, timestamp: at,
      details: { before: { inventoryItemId: previous.inventoryItemId, packSize: previous.approvedPackSize, active: previous.active },
        after: { inventoryItemId: next.inventoryItemId, packSize: next.approvedPackSize, active: next.active } } });
    return { id: ref.id, mapping: { id: ref.id, ...next } };
  });
}
module.exports = { vendorMemory };

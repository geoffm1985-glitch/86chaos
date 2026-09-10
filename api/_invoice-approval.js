'use strict';
const crypto = require('crypto');
const { classifyInvoiceRow, inferInvoiceProductFields } = require('./_invoice-classification');
const { resolveInvoiceQuantity, finiteNumber, parseCasePack, convertQuantity } = require('../src/core/restaurantPack.cjs');
const { codeFor, descriptionFor, buildApprovedMapping, mappingConflicts, normalize } = require('../src/core/vendorProductMemory.cjs');
const fail = (message, code = 'INVOICE_REVIEW_REQUIRED', statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
function assertTenant(record, restaurantId) {
  if (!record || record.restaurantId !== restaurantId) fail('Record does not belong to this workspace.', 'WORKSPACE_MISMATCH', 403);
}
function mappingId(row) { return hash(codeFor(row) ? `sku:${codeFor(row)}` : `description:${descriptionFor(row)}`); }
function invoiceIdentity(restaurantId, invoice) {
  const source = invoice.invoiceNumber && invoice.vendorName
    ? `${normalize(invoice.vendorName)}|${String(invoice.invoiceNumber).trim()}|${String(invoice.invoiceDate || '').trim()}`
    : invoice.sourceSha256 || invoice.scanRequestId;
  if (!source) fail('Scan source identity is missing. Scan the invoice again.');
  return `scan_${hash(`${restaurantId}|${source}`)}`;
}
function approvalValues(row, inventory) {
  const converted = resolveInvoiceQuantity(row, inventory);
  const manualQty = finiteNumber(row.reviewedStockQuantity); const manualCost = finiteNumber(row.reviewedStockUnitCost);
  const manuallyReviewed = row.quantityConfirmed === true && String(row.reviewNote || '').trim().length >= 4;
  if ((converted.needsReview || row.matchNeedsReview) && !manuallyReviewed) fail(`Review ${row.itemName || 'product'}: ${converted.reasons.join(' ') || 'Confirm the match conflict.'}`);
  const stockQuantity = manuallyReviewed ? manualQty : converted.stockQuantity;
  const stockUnitCost = manuallyReviewed ? manualCost : converted.stockUnitCost;
  if (stockQuantity === null || stockQuantity < 0 || stockQuantity > 100000 || (stockQuantity > 0 && (stockUnitCost === null || stockUnitCost < 0 || stockUnitCost > 1000000))) fail('Enter the actual received stock quantity and cost per inventory unit.');
  return { stockQuantity, stockUnitCost, manuallyReviewed, converted };
}
function buildInventoryApprovalPatch(row, item, source) {
  const values = approvalValues(row, item);
  const patch = { currentStock: Number(item.currentStock || 0) + values.stockQuantity, lastInvoiceId: source.invoiceId,
    lastInvoiceApprovedAt: source.approvedAt, lastInvoiceApprovedBy: source.approvedBy, lastInvoiceRaw: row };
  if (values.stockQuantity > 0) {
    patch.price = values.stockUnitCost; patch.latestPrice = values.stockUnitCost;
    patch.latestCost = values.stockUnitCost; patch.latestCostApprovedAt = source.approvedAt;
  }
  if (!item.pfgCode && codeFor(row)) patch.pfgCode = codeFor(row);
  return { patch, values };
}
async function approveInvoice({ db, ctx, invoice, approved }) {
  if (approved !== true) fail('Human approval is required.');
  const restaurantId = ctx.restaurantId;
  if (!restaurantId || !ctx.uid) fail('Workspace authorization is required.', 'WORKSPACE_MISMATCH', 403);
  if (!invoice || (invoice.skippedRows || []).length) fail('Resolve every Needs Review row before approving.');
  if (!Array.isArray(invoice.lineItems) || !invoice.lineItems.length || invoice.lineItems.length > 150) fail('Approve between 1 and 150 product rows at a time; split larger invoices before scanning.');
  if (Buffer.byteLength(JSON.stringify(invoice)) > 650000) fail('Invoice review exceeds the safe record size. Split the document.');
  const invoiceId = invoiceIdentity(restaurantId, invoice);
  const invoiceRef = db.collection('invoices').doc(invoiceId);
  const vendorId = invoice.vendorId || `scan_${hash(`${restaurantId}|${normalize(invoice.vendorName)}`).slice(0, 40)}`;
  if (!safeId(vendorId) || !String(invoice.vendorName || '').trim()) fail('Select or name the invoice vendor.');
  const vendorRef = db.collection('vendors').doc(vendorId);
  const rows = invoice.lineItems.map(input => {
    const row = inferInvoiceProductFields(input); const classification = classifyInvoiceRow(row);
    if (classification.kind === 'document') fail('Document charges or headers cannot be approved as inventory.');
    if (classification.kind === 'review' && input.humanProductConfirmed !== true) fail('Confirm uncertain product rows in Needs Review.');
    if (!row.matchedItemId || (row.matchedItemId !== 'CREATE_NEW' && !safeId(row.matchedItemId))) fail('Every purchased row needs an inventory selection.');
    return { ...row, scannerClassification: classification.kind === 'non_food' ? 'non_food' : 'stock' };
  });
  const itemRefs = rows.map((row, index) => db.collection('inventoryItems').doc(row.matchedItemId === 'CREATE_NEW' ? `scan_${hash(`${invoiceId}|${index}`).slice(0, 40)}` : row.matchedItemId));
  const mappingRefs = rows.map(row => vendorRef.collection('productMappings').doc(mappingId(row)));
  return db.runTransaction(async tx => {
    const existing = await tx.get(invoiceRef);
    if (existing.exists) { assertTenant(existing.data(), restaurantId); return { id: invoiceId, duplicate: true, updated: 0, created: 0 }; }
    const [vendorSnap, ...snaps] = await Promise.all([tx.get(vendorRef), ...itemRefs.map(ref => tx.get(ref)), ...mappingRefs.map(ref => tx.get(ref))]);
    if (vendorSnap.exists) assertTenant(vendorSnap.data(), restaurantId);
    const at = new Date().toISOString(); const staged = new Map(); const stagedMappings = new Map(); let created = 0; let updated = 0;
    const approvedRows = [];
    rows.forEach((row, index) => {
      const itemRef = itemRefs[index]; const itemSnap = snaps[index];
      const priorMapping = snaps[rows.length + index];
      if (priorMapping.exists) assertTenant(priorMapping.data(), restaurantId);
      const isNew = row.matchedItemId === 'CREATE_NEW';
      if (!isNew) { if (!itemSnap.exists) fail('Selected inventory item no longer exists.'); assertTenant(itemSnap.data(), restaurantId); }
      const pack = parseCasePack(row.reviewedPackSize || row.packSize);
      const item = staged.get(itemRef.id) || (isNew ? { id: itemRef.id, name: row.itemName, restaurantId, supplierId: vendorId,
        category: row.scannerClassification === 'non_food' ? 'Supplies' : 'Other', pfgCode: codeFor(row), packSize: row.reviewedPackSize || row.packSize || '',
        inventoryUnit: 'case', yieldQty: pack.known && pack.unit === 'each' ? pack.amount : 0,
        weightPerStockUnit: pack.known ? convertQuantity(pack.amount, pack.unit, 'lb') || 0 : 0,
        currentStock: 0, parLevel: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null,
        inventorySourceType: row.scannerClassification === 'non_food' ? 'non_food_supply' : 'food_product' } : { id: itemSnap.id, ...itemSnap.data() });
      if (row.scannerClassification === 'non_food' && item.inventorySourceType !== 'non_food_supply' && !/suppl|paper|clean/i.test(item.category || '')) fail('A purchased supply cannot be matched to a food ingredient.');
      if (priorMapping.exists && priorMapping.data().active === true) {
        const conflicts = mappingConflicts(priorMapping.data(), row);
        if (priorMapping.data().inventoryItemId !== itemRef.id) conflicts.push('The selected item differs from the approved vendor mapping.');
        if (conflicts.length && !(row.quantityConfirmed === true && String(row.reviewNote || '').trim().length >= 4)) fail(conflicts.join(' '));
      }
      const { patch, values } = buildInventoryApprovalPatch(row, item, { invoiceId, approvedAt: at, approvedBy: ctx.uid });
      const after = { ...item, ...patch, updatedAt: at, updatedBy: ctx.uid };
      staged.set(itemRef.id, after);
      if (isNew) created++; else updated++;
      approvedRows.push({ ...row, matchedItemId: itemRef.id, approvedStockQuantity: values.stockQuantity, approvedStockUnitCost: values.stockUnitCost,
        approvedBy: ctx.uid, approvedAt: at, previousStock: item.currentStock || 0, previousCost: item.price ?? null });
      // Revocation is sticky: approving another invoice must not silently reactivate a revoked mapping.
      if (!priorMapping.exists || priorMapping.data().active !== false) {
        const sameInvoiceMapping = stagedMappings.get(mappingRefs[index].path)?.data;
        if (sameInvoiceMapping && (sameInvoiceMapping.inventoryItemId !== itemRef.id || mappingConflicts(sameInvoiceMapping, row).length)) fail('The same vendor product has conflicting matches or package details in this invoice. Resolve the duplicate product before approval.');
        stagedMappings.set(mappingRefs[index].path, { ref: mappingRefs[index], data: buildApprovedMapping({ restaurantId, vendorId, vendorName: invoice.vendorName,
          row, inventoryItem: after, approvedBy: ctx.uid, approvedAt: at, previous: priorMapping.exists ? priorMapping.data() : {} }) });
      }
    });
    for (const { ref, data } of stagedMappings.values()) tx.set(ref, data);
    if (!vendorSnap.exists) tx.set(vendorRef, { restaurantId, name: String(invoice.vendorName).slice(0, 160), rep: '', email: '', phone: '', createdAt: at, createdBy: ctx.uid });
    for (const [id, data] of staged) { const { id: ignored, ...payload } = data; tx.set(db.collection('inventoryItems').doc(id), payload); }
    tx.set(invoiceRef, { ...invoice, lineItems: approvedRows, vendorId, restaurantId, status: 'approved', approvalVersion: 1,
      processedAt: at, processedBy: ctx.user?.name || ctx.uid, approvedAt: at, approvedBy: ctx.uid, sourceIdentity: invoiceId });
    tx.set(db.collection('auditLogs').doc(invoiceId), { restaurantId, userId: ctx.uid, userName: ctx.user?.name || '', action: 'INVOICE_APPROVED',
      target: `invoices/${invoiceId}`, timestamp: at, details: `${rows.length} reviewed rows; record-level before/after evidence is stored in the approved invoice.`, sourceInvoiceId: invoiceId });
    return { id: invoiceId, vendorId, duplicate: false, updated, created };
  });
}
module.exports = { approveInvoice, approvalValues, buildInventoryApprovalPatch, mappingId, invoiceIdentity, assertTenant, safeId, hash };

'use strict';
const { packAgrees, normalizeUnit, resolveInvoiceQuantity, finiteNumber } = globalThis.__86ChaosRestaurantPackShared;
const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sku = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const codeFor = row => sku(row.productCode || row.sku || row.pfgCode || row.code || '');
const descriptionFor = row => normalize(row.itemName || row.description || row.name || '');
function mappingConflicts(mapping, row) {
  const reasons = [];
  if (mapping.approvedPackSize && !packAgrees(mapping.approvedPackSize, row.packSize)) reasons.push('The approved vendor mapping has a different package size.');
  if (mapping.purchaseUnit && normalizeUnit(mapping.purchaseUnit) !== normalizeUnit(row.uom || row.unit)) reasons.push('The purchase unit changed since the last approval.');
  if (mapping.priceUnit && normalizeUnit(mapping.priceUnit) !== normalizeUnit(row.priceUnit || row.uom || row.unit)) reasons.push('The vendor price basis changed.');
  const previous = finiteNumber(mapping.approvedUnitPrice); const current = finiteNumber(row.unitPrice);
  if (previous > 0 && current !== null && Math.abs(current - previous) / previous > 0.35) reasons.push('Unit price differs by more than 35% from the approved mapping.');
  if (row.substitution === true || /substitut/i.test(row.rawText || '')) reasons.push('The vendor marked a substitution.');
  return reasons;
}
function mappingIsScoped(mapping, context) {
  return mapping.restaurantId === context.restaurantId && mapping.active === true && mapping.state !== 'revoked'
    && (context.vendorId ? mapping.vendorId === context.vendorId : normalize(mapping.vendorName) === normalize(context.vendorName) && Boolean(context.vendorName));
}
function similarity(a, b) {
  const left = new Set(normalize(a).split(' ').filter(Boolean)); const right = new Set(normalize(b).split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0;
  return [...left].filter(w => right.has(w)).length / Math.max(left.size, right.size);
}
function suggestInvoiceMatch(row = {}, inventory = [], mappings = [], context = {}) {
  if (row.scannerClassification === 'document') return { matchedItemId: '', needsReview: false, explanation: 'Document or charge row; excluded from inventory.', reasons: [] };
  const items = inventory.filter(item => (!item.restaurantId || item.restaurantId === context.restaurantId)
    && (row.scannerClassification !== 'non_food' || item.inventorySourceType === 'non_food_supply' || /suppl|paper|clean/i.test(item.category || '')));
  const learned = mappings.filter(mapping => mappingIsScoped(mapping, context)
    && (codeFor(row) ? sku(mapping.productCode) === codeFor(row) : mapping.normalizedDescription === descriptionFor(row)));
  const mappedItems = learned.map(mapping => ({ mapping, item: items.find(item => item.id === mapping.inventoryItemId) })).filter(hit => hit.item);
  let match = null; let explanation = ''; let reasons = [];
  if (new Set(mappedItems.map(hit => hit.item.id)).size > 1) reasons.push('Two approved vendor mappings point to different inventory items.');
  else if (mappedItems.length) {
    match = mappedItems[0].item;
    reasons = mappingConflicts(mappedItems[0].mapping, row);
    explanation = `Matched from a previously approved vendor mapping${codeFor(row) ? ` for SKU ${codeFor(row)}` : ''}.`;
  } else {
    const exact = items.filter(item => codeFor(row) && codeFor(item) === codeFor(row)
      && context.vendorId && (item.supplierId || item.vendorId) === context.vendorId);
    if (exact.length === 1) { match = exact[0]; explanation = `Matched by exact vendor SKU ${codeFor(row)}.`; }
    else if (exact.length > 1) reasons.push('Two inventory items use this vendor SKU.');
    else {
      const scored = items.map(item => ({ item, score: Math.max(similarity(descriptionFor(row), item.name), ...(Array.isArray(item.aliases) ? item.aliases : []).slice(0, 40).map(alias => similarity(descriptionFor(row), alias))) })).sort((a, b) => b.score - a.score);
      if (scored[0]?.score >= 0.8 && (!scored[1] || scored[0].score - scored[1].score >= 0.15)) {
        match = scored[0].item; explanation = 'Matched by strong normalized product-name similarity.';
      } else if (scored[0]?.score >= 0.5) reasons.push('Two inventory items have similar names or the product name is incomplete.');
    }
  }
  if (!match) reasons.push('No unambiguous approved inventory match exists. Choose an item or add a new one.');
  const quantity = resolveInvoiceQuantity(row, match || {});
  reasons = [...new Set([...reasons, ...quantity.reasons])];
  return { matchedItemId: match?.id || '', matchedItemName: match?.name || '', quantity,
    mappingId: mappedItems[0]?.mapping?.id || '', needsReview: reasons.length > 0,
    confidence: match && !reasons.length ? 'high' : match ? 'medium' : 'needs review',
    explanation: [explanation, reasons.length ? `Needs Review: ${reasons.join(' ')}` : 'Vendor and package evidence are ready for manager approval.'].filter(Boolean).join(' '), reasons };
}
function buildApprovedMapping({ restaurantId, vendorId, vendorName, row, inventoryItem, approvedBy, approvedAt, previous = {} }) {
  if (!restaurantId || !vendorId || !inventoryItem?.id || !approvedBy || !approvedAt) throw new Error('An approved workspace/vendor/product decision is required.');
  return { restaurantId, vendorId, vendorName: String(vendorName || '').slice(0, 160), productCode: codeFor(row),
    normalizedDescription: descriptionFor(row), originalDescription: String(row.itemName || row.description || '').slice(0, 240),
    inventoryItemId: inventoryItem.id, inventoryItemName: inventoryItem.name,
    approvedPackSize: String(row.reviewedPackSize || row.packSize || '').slice(0, 80), inventoryUnit: normalizeUnit(inventoryItem.inventoryUnit || 'case'),
    purchaseUnit: normalizeUnit(row.uom || row.unit), priceUnit: normalizeUnit(row.priceUnit || row.uom || row.unit),
    approvedUnitPrice: finiteNumber(row.unitPrice), matchQuality: 'human-approved', approvedBy, approvedAt,
    lastUsedAt: approvedAt, useCount: Math.max(0, Number(previous.useCount || 0)) + 1, active: true, state: 'active', evidenceVersion: 1 };
}
const vendorProductMemoryShared = { normalize, sku, codeFor, descriptionFor, mappingConflicts, mappingIsScoped, suggestInvoiceMatch, buildApprovedMapping };

// One implementation for the browser and Node, using the existing shared-helper pattern.
(function publishVendorProductMemory(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosVendorProductMemoryShared', {
    value: vendorProductMemoryShared,
    configurable: true,
    writable: true,
  });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);

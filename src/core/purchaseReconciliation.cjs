'use strict';

const rows = value => Array.isArray(value) ? value : [];
const text = value => String(value == null ? '' : value).trim();
const lower = value => text(value).toLowerCase();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = value => Number.isInteger(value) ? value : Math.round(number(value) * 100);
const close = (a,b,tolerance=0.001) => Math.abs(number(a)-number(b)) <= tolerance;
const unitAliases = Object.freeze({ ea:'each', each:'each', unit:'each', units:'each', cs:'case', case:'case', cases:'case', lb:'lb', lbs:'lb', pound:'lb', pounds:'lb', oz:'oz', ounce:'oz', ounces:'oz' });
const unit = value => unitAliases[lower(value)] || lower(value);

function convertQuantity(quantity, fromUnit, toUnit, packSize = 1) {
  const from = unit(fromUnit), to = unit(toUnit), qty = number(quantity), pack = Math.max(0.000001, number(packSize) || 1);
  if (!from || !to || from === to) return { ok:true, quantity:qty, factor:1 };
  if (from === 'case' && to === 'each') return { ok:true, quantity:qty * pack, factor:pack };
  if (from === 'each' && to === 'case') return { ok:true, quantity:qty / pack, factor:1 / pack };
  if (from === 'lb' && to === 'oz') return { ok:true, quantity:qty * 16, factor:16 };
  if (from === 'oz' && to === 'lb') return { ok:true, quantity:qty / 16, factor:1 / 16 };
  return { ok:false, quantity:qty, factor:null };
}

function reconcilePurchaseLine(input = {}) {
  const ordered = input.ordered || {}, shipped = input.shipped || {}, received = input.received || {}, invoiced = input.invoiced || {};
  const packSize = number(received.packSize || invoiced.packSize || ordered.packSize || input.packSize) || 1;
  const canonicalUnit = unit(received.unit || received.uom || ordered.unit || ordered.uom || invoiced.unit || invoiced.uom || 'each');
  const oq = convertQuantity(ordered.quantity, ordered.unit || ordered.uom || canonicalUnit, canonicalUnit, packSize);
  const sq = convertQuantity(shipped.quantity, shipped.unit || shipped.uom || canonicalUnit, canonicalUnit, packSize);
  const rq = convertQuantity(received.quantity, received.unit || received.uom || canonicalUnit, canonicalUnit, packSize);
  const iq = convertQuantity(invoiced.quantity, invoiced.unit || invoiced.uom || canonicalUnit, canonicalUnit, packSize);
  const orderedQty = oq.quantity, shippedQty = shipped.quantity == null ? orderedQty : sq.quantity, receivedQty = received.quantity == null ? 0 : rq.quantity, invoicedQty = invoiced.quantity == null ? 0 : iq.quantity;
  const orderedPrice = cents(ordered.unitPriceCents ?? ordered.unitPrice), invoicePrice = cents(invoiced.unitPriceCents ?? invoiced.unitPrice);
  const substitution = Boolean(received.substitution || invoiced.substitution || (text(received.productId) && text(ordered.productId) && text(received.productId) !== text(ordered.productId)));
  const backorderQty = number(received.backorderQuantity ?? shipped.backorderQuantity ?? Math.max(0, orderedQty - shippedQty));
  const partial = received.quantity != null && receivedQty > 0 && receivedQty < orderedQty;
  const missingReceiving = received.quantity == null && !received.catchWeight;
  const catchWeight = number(received.catchWeight || invoiced.catchWeight);
  const packMismatch = [oq,sq,rq,iq].some(result => !result.ok) || (number(ordered.packSize) && number(received.packSize) && !close(ordered.packSize, received.packSize));
  const quantityVariance = missingReceiving ? null : Math.round((invoicedQty - receivedQty) * 1000) / 1000;
  const priceVarianceCents = orderedPrice && invoicePrice ? invoicePrice - orderedPrice : 0;
  const duplicateSuspicion = Boolean(input.duplicateInvoice || (input.invoiceNumber && rows(input.existingInvoices).some(row => text(row.invoiceNumber) === text(input.invoiceNumber) && text(row.vendorId) === text(input.vendorId) && (!input.invoiceId || text(row.id) !== text(input.invoiceId)))));
  let classification = 'matched';
  const reasons = [];
  if (duplicateSuspicion) { classification='duplicate suspicion'; reasons.push('Vendor invoice number already exists.'); }
  else if (missingReceiving) { classification='missing receiving record'; reasons.push('Invoice/PO line has no receiving quantity.'); }
  else if (substitution) { classification='substitution'; reasons.push('Received/invoiced product differs from the ordered product.'); }
  else if (backorderQty > 0) { classification='backorder'; reasons.push(`${backorderQty} ${canonicalUnit} remain backordered.`); }
  else if (packMismatch) { classification='pack discrepancy'; reasons.push('Pack/unit conversion is missing or configured pack sizes disagree.'); }
  else if (!close(quantityVariance,0)) { classification='quantity discrepancy'; reasons.push(`Invoiced quantity differs from received quantity by ${quantityVariance}.`); }
  else if (priceVarianceCents !== 0) { classification='price discrepancy'; reasons.push(`Invoice unit price differs from ordered price by ${priceVarianceCents} cents.`); }
  else if (partial) { classification='quantity discrepancy'; reasons.push('Receiving is partial and requires review before close.'); }
  else if (catchWeight > 0) reasons.push(`Catch weight ${catchWeight} recorded and reconciled to the configured unit.`);
  const identitySignals = [input.productId || ordered.productId, input.sku || ordered.sku, input.vendorProductId, input.upc].filter(Boolean).length;
  let confidence = Math.max(0.2, Math.min(1, 0.45 + identitySignals * 0.15 + ([oq,sq,rq,iq].every(result => result.ok) ? 0.15 : 0)));
  if (input.matchConfidence != null) confidence = Math.max(0, Math.min(1, number(input.matchConfidence)));
  if (confidence < 0.6 && classification === 'matched') { classification='low-confidence match'; reasons.push('Product identity evidence is too weak for an automatic match.'); }
  const reviewRequired = classification !== 'matched' || confidence < 0.8 || catchWeight > 0 || partial;
  return {
    schemaVersion:1,
    workspaceId:text(input.workspaceId || input.restaurantId),
    lineId:text(input.lineId || input.id),
    classification,
    orderedQuantity:orderedQty,
    shippedQuantity:shippedQty,
    receivedQuantity:receivedQty,
    invoicedQuantity:invoicedQty,
    canonicalUnit,
    packSize,
    splitCase:Boolean(input.splitCase || received.splitCase || (canonicalUnit === 'each' && unit(ordered.unit || ordered.uom) === 'case')),
    catchWeight:catchWeight || null,
    partialDelivery:partial,
    backorderQuantity:backorderQty,
    substitution,
    quantityVariance,
    orderedUnitPriceCents:orderedPrice,
    invoicedUnitPriceCents:invoicePrice,
    priceVarianceCents,
    extendedPriceVarianceCents:Math.round((invoicePrice * invoicedQty) - (orderedPrice * orderedQty)),
    duplicateSuspicion,
    confidence:Math.round(confidence * 100) / 100,
    reasons,
    reviewRequired,
    automaticInventoryMutation:false,
    automaticPayment:false,
    automaticAccountingPost:false,
    automaticOrdering:false
  };
}

function reconcilePurchaseDocument(input = {}) {
  const lines = rows(input.lines).map(line => reconcilePurchaseLine({ ...input, ...line, existingInvoices:input.existingInvoices }));
  const counts = lines.reduce((acc,row) => { acc[row.classification]=(acc[row.classification] || 0) + 1; return acc; },{});
  return { schemaVersion:1, workspaceId:text(input.workspaceId || input.restaurantId), documentId:text(input.documentId || input.invoiceId || input.invoiceNumber), lines, counts, status:lines.every(row => row.classification === 'matched' && !row.reviewRequired) ? 'matched' : 'review required', reviewRequired:lines.some(row => row.reviewRequired), automaticActions:false };
}

module.exports = { convertQuantity, reconcilePurchaseLine, reconcilePurchaseDocument };

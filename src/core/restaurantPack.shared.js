'use strict';

const NUMBER = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const UNITS = Object.freeze({ lb: ['weight', 16], oz: ['weight', 1], kg: ['weight', 35.27396195], g: ['weight', 0.03527396195],
  'fl oz': ['volume', 1], gal: ['volume', 128], qt: ['volume', 32], pt: ['volume', 16], cup: ['volume', 8], tbsp: ['volume', 0.5], tsp: ['volume', 1 / 6],
  each: ['count', 1], case: ['case', 1], bag: ['bag', 1], pack: ['pack', 1] });
function normalizeUnit(value = '') {
  const u = String(value || '').toLowerCase().replace(/\./g, '').trim().replace(/\s+/g, ' ');
  return ({ lbs: 'lb', pound: 'lb', pounds: 'lb', ounces: 'oz', ounce: 'oz', floz: 'fl oz', 'fluid ounces': 'fl oz',
    cs: 'case', cases: 'case', ea: 'each', ct: 'each', count: 'each', pc: 'each', pcs: 'each', pieces: 'each', unit: 'each', units: 'each',
    pk: 'pack', pkg: 'pack', bags: 'bag', gallon: 'gal', gallons: 'gal', quart: 'qt', quarts: 'qt', grams: 'g', kilograms: 'kg' })[u] || u;
}
function finiteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(value).trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function convertQuantity(amount, from, to) {
  const a = UNITS[normalizeUnit(from)]; const b = UNITS[normalizeUnit(to)];
  if (finiteNumber(amount) === null || !a || !b || a[0] !== b[0]) return null;
  return Number(amount) * a[1] / b[1];
}
function parseCasePack(value = '') {
  const text = String(value || '').trim().toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').replace(/(lb|oz|kg|g|gal|qt)\s+(?:case|cs)$/, '$1');
  const unknown = reason => ({ raw: String(value || ''), known: false, amount: null, unit: '', innerCount: null, innerAmount: null, reason });
  if (!text) return unknown('Package size is missing.');
  if (/catch|\bcw\b|variable|approx|substitut|\?/.test(text)) return unknown('Catch weight or substitution requires the actual delivered package or weight.');
  const match = text.match(new RegExp(`^(${NUMBER})\\s*(?:/|x)\\s*(${NUMBER})\\s*([a-z ]+)$`));
  const single = !match && text.match(new RegExp(`^(${NUMBER})\\s*([a-z ]+)$`));
  if (!match && !single) return unknown('Package format is not clear. Confirm the case contents.');
  const count = match ? Number(match[1]) : 1;
  const innerAmount = Number(match ? match[2] : single[1]);
  const unit = normalizeUnit(match ? match[3] : single[2]);
  if (!UNITS[unit] || count <= 0 || innerAmount <= 0 || count * innerAmount > 1000000) return unknown('Package count or unit is invalid.');
  return { raw: String(value), known: true, amount: count * innerAmount, unit, innerCount: count, innerAmount, reason: '' };
}
function packAgrees(a, b) {
  const first = parseCasePack(a); const second = parseCasePack(b);
  if (!first.known || !second.known) return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && Boolean(a);
  const converted = convertQuantity(first.amount, first.unit, second.unit);
  return converted !== null && Math.abs(converted - second.amount) < 0.00001 && first.innerCount === second.innerCount;
}
function resolveInvoiceQuantity(row = {}, inventory = {}) {
  const reasons = [];
  const fields = ['receivedQty', 'receivedQuantity', 'shippedQty', 'shippedQuantity', 'quantity', 'qty'];
  const field = fields.find(key => row[key] !== '' && row[key] !== null && row[key] !== undefined);
  const delivered = field ? finiteNumber(row[field]) : null;
  const purchaseUnit = normalizeUnit(row.uom || row.unit || row.unitOfMeasure || '');
  const stockUnit = normalizeUnit(inventory.inventoryUnit || inventory.stockUnit || 'case');
  const pack = parseCasePack(row.packSize || inventory.packSize || '');
  if (!pack.known) reasons.push(pack.reason);
  if (delivered === null || delivered < 0) reasons.push('Confirm the delivered quantity; ordered quantity alone is not a receipt.');
  if (!purchaseUnit) reasons.push('Quantity could mean cases or individual units. Confirm the purchase unit.');
  if (Number(row.backOrderedQty || row.backorderedQty || 0) > 0 && !/received|shipped/i.test(field || '')) reasons.push('Backordered quantity needs an explicit shipped or received quantity.');
  if (row.substitution === true || /substitut/i.test(row.rawText || '')) reasons.push('Vendor substitution needs review.');
  const catchWeight = row.isCatchWeight === true || /catch|\bcw\b|variable/i.test(`${row.packSize || ''} ${row.rawText || ''}`);
  if (catchWeight) reasons.push('Catch weight needs the actual delivered weight and price basis.');
  if (row.packSize && inventory.packSize && !packAgrees(row.packSize, inventory.packSize)) reasons.push('Package size conflicts with the inventory record.');
  let stockQuantity = delivered === null ? null : convertQuantity(delivered, purchaseUnit, stockUnit);
  if (stockQuantity === null && delivered !== null && pack.known) {
    if (purchaseUnit === 'case') stockQuantity = convertQuantity(delivered * pack.amount, pack.unit, stockUnit);
    else if (stockUnit === 'case') {
      const contents = convertQuantity(delivered, purchaseUnit, pack.unit);
      if (contents !== null) stockQuantity = contents / pack.amount;
    }
  }
  if (stockQuantity === null) reasons.push('Purchase unit cannot be safely converted to the inventory count unit.');
  const total = finiteNumber(row.totalPrice ?? row.extendedPrice ?? row.lineTotal);
  const unitPrice = finiteNumber(row.unitPrice ?? row.casePrice);
  const priceUnit = normalizeUnit(row.priceUnit || purchaseUnit);
  let stockUnitCost = stockQuantity > 0 && total !== null && total >= 0 ? total / stockQuantity : null;
  if (stockUnitCost === null && delivered > 0 && stockQuantity > 0 && unitPrice !== null && unitPrice >= 0 && priceUnit === purchaseUnit) stockUnitCost = unitPrice * delivered / stockQuantity;
  if (priceUnit !== purchaseUnit && total === null) reasons.push('The price unit differs from the purchase unit. Confirm the extended price.');
  if (stockUnitCost === null && stockQuantity !== 0) reasons.push('Latest cost cannot be established from this row.');
  return { delivered, sourceField: field || '', purchaseUnit, stockUnit, stockQuantity, stockUnitCost, pack, catchWeight, needsReview: reasons.length > 0, reasons };
}
function usableYield(amount, yieldPercent = 100) {
  const n = finiteNumber(amount); const p = finiteNumber(yieldPercent);
  return n !== null && n > 0 && p !== null && p > 0 && p <= 100 ? n * p / 100 : null;
}
const restaurantPackShared = { normalizeUnit, finiteNumber, convertQuantity, parseCasePack, packAgrees, resolveInvoiceQuantity, usableYield };

// One implementation for the browser and Node, using the existing shared-helper pattern.
(function publishRestaurantPack(root) {
  if (!root) return;
  Object.defineProperty(root, '__86ChaosRestaurantPackShared', {
    value: restaurantPackShared,
    configurable: true,
    writable: true,
  });
})(typeof globalThis !== 'undefined' ? globalThis : undefined);

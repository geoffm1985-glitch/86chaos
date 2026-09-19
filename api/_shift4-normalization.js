'use strict';

const crypto = require('crypto');
const SCHEMA_VERSION = 3;
const IDENTITY_VERSION = 2;
const PROVIDER = 'shift4';
const PROVIDER_PRODUCT = 'shift4-dine';
const ALLOWED_TICKET_TYPES = new Set(['sale', 'refund', 'void', 'overring', 'open']);
const NUMERIC_EXPORT_FIELDS = new Set(['schemaVersion','identityVersion','quantity','unitAmountCents','grossAmountCents','netAmountCents','discountAmountCents','taxAmountCents','tipAmountCents','gratuityAmountCents','surchargeAmountCents']);

const text = (value, max = 240) => typeof value === 'string' ? (value.trim().slice(0, max) || null) : (typeof value === 'number' && Number.isSafeInteger(value) ? String(value).slice(0, max) : null);
const rawIdentity = value => typeof value === 'string' ? value.trim() : (typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '');
function strictNumber(value, { integer = false } = {}) {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(value))) return { ok: false, value: null };
  return { ok: true, value };
}
const money = value => strictNumber(value, { integer: true });
const quantity = value => {
  const parsed = strictNumber(value); return parsed.ok && parsed.value != null && Math.abs(parsed.value) <= 1000000000 ? parsed : (parsed.value == null && parsed.ok ? parsed : { ok: false, value: null });
};
const checkedSubtract = (left, right) => left == null || right == null || !Number.isSafeInteger(left - right) ? null : left - right;
const checkedAdd = (left, right) => left == null || right == null || !Number.isSafeInteger(left + right) ? null : left + right;
const iso = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value); return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
const businessDate = (value, timeZone) => {
  const parsed = iso(value); if (!parsed || !String(timeZone || '').trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(parsed));
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${byType.year}-${byType.month}-${byType.day}`;
  } catch (_) { return null; }
};
const stableId = (...parts) => crypto.createHash('sha256').update(JSON.stringify(parts.map(value => [typeof value, String(value ?? '')]))).digest('hex');
const legacyStableId = (...parts) => crypto.createHash('sha256').update(parts.map(value => String(value || '')).join('|')).digest('hex');

function buildMenuIndexes(menu = {}) {
  const categoryByItem = new Map(); const categoryByRef = new Map();
  for (const category of Array.isArray(menu.categories) ? menu.categories : []) {
    const categoryRef = text(category?.posRef, 160); if (!categoryRef) continue;
    categoryByRef.set(categoryRef, text(category?.name));
    for (const itemRef of Array.isArray(category?.items) ? category.items : []) { const ref = rawIdentity(itemRef); if (ref) categoryByItem.set(ref, { ref: categoryRef, name: text(category?.name) }); }
  }
  const itemByRef = new Map();
  for (const item of Array.isArray(menu.items) ? menu.items : []) {
    const ref = rawIdentity(item?.posRef); if (!ref) continue;
    const price = money(item?.price);
    itemByRef.set(ref, { ref, name: text(item?.name), priceCents: price.ok ? price.value : null, category: categoryByItem.get(ref) || null });
  }
  return { categoryByItem, categoryByRef, itemByRef };
}

function baseRecord({ restaurantId, providerLocationId, recordType, sourceRecordId, sourceParentId = null, businessDate: date, importRunId }) {
  return { schemaVersion: SCHEMA_VERSION, identityVersion: IDENTITY_VERSION, provider: PROVIDER, providerProduct: PROVIDER_PRODUCT, restaurantId: text(restaurantId, 240), providerLocationId: text(providerLocationId, 160), recordType, sourceRecordId: text(sourceRecordId, 500), sourceParentId: text(sourceParentId, 500), businessDate: date, importRunId: text(importRunId, 160), status: 'draft', approvalRequired: true };
}
function validateMoneyFields(source, fields) {
  const values = {}; const invalid = [];
  for (const field of fields) { const parsed = money(source?.[field]); values[field] = parsed.value; if (!parsed.ok) invalid.push(field); }
  return { values, invalid };
}
const reject = (rejected, reason, sourceRecordId = null, field = null) => rejected.push({ reason, sourceRecordId: text(sourceRecordId, 500), field });

function normalizeShift4Tickets({ restaurantId, providerLocationId, tickets, menu = {}, importRunId, timeZone }) {
  const records = []; const rejected = []; const indexes = buildMenuIndexes(menu); const locationId = rawIdentity(providerLocationId);
  for (const ticket of Array.isArray(tickets) ? tickets : []) {
    const ticketRef = rawIdentity(ticket?.posRef); const type = text(ticket?.type, 40)?.toLowerCase();
    const rowLocation = rawIdentity(ticket?.locationId);
    if (rowLocation && rowLocation !== locationId) { reject(rejected, 'location_mismatch', ticketRef); continue; }
    const openedAt = iso(ticket?.openedAt); const closedAt = iso(ticket?.closedAt); const date = businessDate(closedAt || openedAt, timeZone);
    if (!ticketRef || !date || !ALLOWED_TICKET_TYPES.has(type)) { reject(rejected, !ticketRef ? 'missing_ticket_reference' : !date ? 'invalid_ticket_timestamp' : 'unsupported_ticket_type', ticketRef); continue; }
    const ticketMoney = validateMoneyFields(ticket, ['totalItems','totalGrand','totalDiscounts','totalTax','totalTips','totalGratuities','totalSurcharges']);
    const ticketNet = checkedSubtract(ticketMoney.values.totalGrand, ticketMoney.values.totalTax);
    if (ticketMoney.invalid.length || (ticketMoney.values.totalGrand != null && ticketMoney.values.totalTax != null && ticketNet == null)) reject(rejected, 'invalid_ticket_money', ticketRef, ticketMoney.invalid.join(',') || 'derivedNet');
    else {
      const v = ticketMoney.values; const ticketBase = baseRecord({ restaurantId, providerLocationId, recordType: 'ticket', sourceRecordId: ticketRef, businessDate: date, importRunId });
      records.push({ ...ticketBase, idempotencyKey: stableId(restaurantId, PROVIDER, providerLocationId, 'ticket', ticketRef), legacyIdempotencyKey: legacyStableId(restaurantId, PROVIDER, providerLocationId, 'ticket', ticketRef), ticketType: type, orderNumber: text(ticket.orderNumber, 120), openedAt, closedAt, employeeRef: text(ticket.closedByEmployeeRef || ticket.openedByEmployeeRef, 160), employeeName: text(ticket.closedByEmployee || ticket.openedByEmployee, 160), grossAmountCents: v.totalItems, netAmountCents: ticketNet, discountAmountCents: v.totalDiscounts, taxAmountCents: v.totalTax, tipAmountCents: v.totalTips, gratuityAmountCents: v.totalGratuities, surchargeAmountCents: v.totalSurcharges, sourceUpdatedAt: null });
    }
    for (const item of Array.isArray(ticket.ticketItems) ? ticket.ticketItems : []) {
      const itemPosRef = rawIdentity(item?.posRef); if (!itemPosRef) { reject(rejected, 'missing_item_reference', ticketRef); continue; }
      const itemMoney = validateMoneyFields(item, ['unitPrice','itemAmount','modifierAmount','discountAmount','price','tax']); const parsedQuantity = quantity(item.quantity);
      const itemGross = checkedAdd(itemMoney.values.itemAmount, itemMoney.values.modifierAmount);
      if (itemMoney.invalid.length || !parsedQuantity.ok || (itemMoney.values.itemAmount != null && itemMoney.values.modifierAmount != null && itemGross == null)) { reject(rejected, !parsedQuantity.ok ? 'invalid_item_quantity' : 'invalid_item_money', itemPosRef, !parsedQuantity.ok ? 'quantity' : (itemMoney.invalid.join(',') || 'derivedGross')); continue; }
      const itemRef = rawIdentity(item.itemRef || item.item?.posRef); const menuItem = itemRef ? indexes.itemByRef.get(itemRef) : null; const category = (itemRef && indexes.categoryByItem.get(itemRef)) || null; const v = itemMoney.values;
      records.push({
        ...baseRecord({ restaurantId, providerLocationId, recordType: 'ticketItem', sourceRecordId: itemPosRef, sourceParentId: ticketRef, businessDate: date, importRunId }),
        idempotencyKey: stableId(restaurantId, PROVIDER, providerLocationId, 'ticketItem', ticketRef, itemPosRef), legacyIdempotencyKey: legacyStableId(restaurantId, PROVIDER, providerLocationId, 'ticketItem', `${ticketRef}:${itemPosRef}`),
        ticketType: text(item.type, 40)?.toLowerCase() || type, orderNumber: text(ticket.orderNumber, 120), openedAt, closedAt,
        employeeRef: text(ticket.closedByEmployeeRef || ticket.openedByEmployeeRef, 160), employeeName: text(ticket.closedByEmployee || ticket.openedByEmployee, 160),
        menuItemRef: text(itemRef, 240), menuItemName: text(item.name || menuItem?.name, 240), categoryRef: text(item.departmentRef || category?.ref || item.revenueClassRef, 160), categoryName: text(item.departmentName || category?.name, 240),
        quantity: parsedQuantity.value, isNonSalesRevenue: typeof item.isNonSalesRevenue === 'boolean' ? item.isNonSalesRevenue : null,
        unitAmountCents: v.unitPrice, grossAmountCents: itemGross, netAmountCents: v.price,
        discountAmountCents: v.discountAmount, taxAmountCents: v.tax, tipAmountCents: null, gratuityAmountCents: null, surchargeAmountCents: null, sourceUpdatedAt: iso(item.addedAt)
      });
    }
  }
  return { records, rejected };
}

const EXPORT_FIELDS = Object.freeze(['schemaVersion','identityVersion','provider','providerProduct','providerLocationId','recordType','sourceRecordId','sourceParentId','businessDate','openedAt','closedAt','ticketType','orderNumber','employeeRef','employeeName','menuItemRef','menuItemName','categoryRef','categoryName','quantity','isNonSalesRevenue','unitAmountCents','grossAmountCents','netAmountCents','discountAmountCents','taxAmountCents','tipAmountCents','gratuityAmountCents','surchargeAmountCents','sourceCompleteness','status','approvalRequired']);
function spreadsheetSafeText(value) {
  const string = String(value == null ? '' : value); return /^\s*[=+\-@]/.test(string) ? `'${string}` : string;
}
function csvEscape(value, field) {
  if (value == null) return '';
  if (NUMERIC_EXPORT_FIELDS.has(field) && typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `"${spreadsheetSafeText(value).replace(/"/g, '""')}"`;
}
function projectRecord(record) { return Object.fromEntries(EXPORT_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(record || {}, field)).map(field => [field, record[field]])); }
function recordsToCsv(records = []) { return '\uFEFF' + [EXPORT_FIELDS.join(','), ...(records || []).map(record => EXPORT_FIELDS.map(field => csvEscape(record?.[field], field)).join(','))].join('\r\n'); }
function recordsToJson({ restaurantId, providerLocationId, requestedFrom, requestedTo, completeness, records, sourceCompleteness = 'unknown' }) {
  return { schemaVersion: SCHEMA_VERSION, provider: PROVIDER, providerProduct: PROVIDER_PRODUCT, restaurantId, providerLocationId, requestedFrom, requestedTo, completeness, sourceCompleteness, amountUnit: 'integer US cents where field names end in Cents', amountSemantics: 'Ticket totals and ticket-item amounts are separate review records and are not additive. Ticket surcharge totals are reported separately. No amount is posted to accounting.', businessDateConvention: 'closedAt in the selected location timezone; openedAt is used only when closedAt is unavailable', records: (records || []).map(projectRecord) };
}

module.exports = { SCHEMA_VERSION, IDENTITY_VERSION, PROVIDER, PROVIDER_PRODUCT, EXPORT_FIELDS, buildMenuIndexes, normalizeShift4Tickets, recordsToCsv, recordsToJson, projectRecord, spreadsheetSafeText, strictNumber, stableId, legacyStableId, businessDate, checkedAdd, checkedSubtract };

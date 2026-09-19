'use strict';

const DEFAULT_TIER_PRICES = Object.freeze({
  shift: 49,
  operations: 99,
  smart_kitchen: 179,
  owner_pro: 299
});

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function timestampToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value.seconds === 'number') {
    const ms = value.seconds * 1000 + Math.floor((Number(value.nanoseconds || 0) || 0) / 1000000);
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === 'number') {
    const date = new Date(value > 1000000000000 ? value : value * 1000);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

function toIsoIfTimestamp(value) {
  const date = timestampToDate(value);
  return date ? date.toISOString() : '';
}

function adminSafeText(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const iso = toIsoIfTimestamp(value);
  if (iso) return iso;
  if (Array.isArray(value)) return value.map(item => adminSafeText(item, '')).filter(Boolean).join(', ') || fallback;
  if (isPlainObject(value)) {
    const preferred = value.message || value.errorMessage || value.error || value.status || value.label || value.title || value.name || value.id || value.code;
    if (preferred && preferred !== value) return adminSafeText(preferred, fallback);
    try {
      return JSON.stringify(value, (_, nested) => {
        const nestedIso = toIsoIfTimestamp(nested);
        return nestedIso || nested;
      }).slice(0, 700);
    } catch (_) {
      return '[object]';
    }
  }
  try { return String(value); } catch (_) { return fallback; }
}

function finiteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTierPriceMap(value = {}, fallback = DEFAULT_TIER_PRICES) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(Object.entries(fallback).map(([key, defaultValue]) => [key, finiteNumber(source[key], defaultValue)]));
}

function normalizeAdminRecord(collection = 'records', id = '', data = {}, diagnostics = []) {
  const source = isPlainObject(data) ? data : {};
  const normalized = { id, ...source };
  for (const [field, value] of Object.entries(normalized)) {
    if (field === 'id') continue;
    const iso = toIsoIfTimestamp(value);
    if (iso) normalized[field] = iso;
  }
  if (!isPlainObject(data)) diagnostics.push({ collection, id, field: '*', reason: 'record was not an object' });
  return normalized;
}

function normalizeCrashReport(id = '', data = {}, diagnostics = []) {
  const record = normalizeAdminRecord('crashReports', id, data, diagnostics);
  for (const field of ['errorName', 'errorMessage', 'message', 'route', 'activeTab', 'appVersion', 'deploymentId', 'browser', 'userAgent']) {
    if (Object.prototype.hasOwnProperty.call(record, field)) record[field] = adminSafeText(record[field], '');
  }
  if (record.rawStack != null) record.rawStack = adminSafeText(record.rawStack, '');
  if (record.componentStack != null) record.componentStack = adminSafeText(record.componentStack, '');
  return record;
}

function normalizeAuditLog(id = '', data = {}, diagnostics = []) {
  const record = normalizeAdminRecord('auditLogs', id, data, diagnostics);
  for (const field of ['action', 'details', 'message', 'target', 'userName', 'userEmail', 'restaurantId']) {
    if (Object.prototype.hasOwnProperty.call(record, field)) record[field] = adminSafeText(record[field], '');
  }
  return record;
}

function normalizeRestaurantRecord(id = '', data = {}, diagnostics = []) {
  const record = normalizeAdminRecord('restaurants', id, data, diagnostics);
  for (const field of ['name', 'restaurantName', 'businessName', 'ownerEmail', 'status', 'plan', 'subscriptionTier', 'restaurantId']) {
    if (Object.prototype.hasOwnProperty.call(record, field)) record[field] = adminSafeText(record[field], '');
  }
  return record;
}

function safeDiagnostic(collection, id, field, reason) {
  return {
    collection: adminSafeText(collection, 'unknown').slice(0, 80),
    id: adminSafeText(id, 'unknown').slice(0, 160),
    field: adminSafeText(field, '*').slice(0, 120),
    reason: adminSafeText(reason, 'Malformed live data skipped.').slice(0, 240)
  };
}

module.exports = {
  DEFAULT_TIER_PRICES,
  adminSafeText,
  finiteNumber,
  normalizeAdminRecord,
  normalizeAuditLog,
  normalizeCrashReport,
  normalizeRestaurantRecord,
  normalizeTierPriceMap,
  safeArray,
  safeDiagnostic,
  timestampToDate
};

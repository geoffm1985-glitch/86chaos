'use strict';

const crypto = require('crypto');

const VOLATILE_AUTOMATION_KEYS = new Set([
  'generatedAt','createdAt','finishedAt','startedAt','runId','queryTiming','sourceQueryStats','deliveryStats',
  'attemptedAt','lastCheckedAt','lastAttemptedRunAt','lastSuccessfulRunAt','durationMs','elapsedMs','timingMs',
  'reportId','historyRunId','latestHistoryRunId','lastRunId'
]);
const UNORDERED_AUTOMATION_ARRAY_KEYS = new Set(['inventoryItems','vendors','users','recipes','menuDependencies','tasks','maintenanceLogs','auditLogs','criticalFindings']);

function contentHash(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value || {})).digest('hex');
}
function stripGeneratedLines(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .filter(line => !/^\s*Generated\b/i.test(line) && !/^\s*Run ID\b/i.test(line))
    .join('\n')
    .trim();
}
function stableBusinessSortValue(value = {}) {
  return String(value.id || value.itemId || value.recipeId || value.vendorId || value.shiftId || value.findingId || value.entityId || value.title || value.name || JSON.stringify(value));
}
function stripVolatileAutomationFields(value, parentKey = '') {
  if (Array.isArray(value)) {
    const mapped = value.map(item => stripVolatileAutomationFields(item, parentKey));
    if (UNORDERED_AUTOMATION_ARRAY_KEYS.has(parentKey)) return mapped.sort((a,b) => stableBusinessSortValue(a).localeCompare(stableBusinessSortValue(b)));
    return mapped;
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (VOLATILE_AUTOMATION_KEYS.has(key)) return;
      const next = stripVolatileAutomationFields(value[key], key);
      if (next !== undefined) out[key] = next;
    });
    return out;
  }
  if (typeof value === 'string') return stripGeneratedLines(value);
  return value === undefined ? null : value;
}
function stableMeaningfulAutomationHash(value) {
  return contentHash(stripVolatileAutomationFields(value));
}
function hasModernPushDeviceRegistry(user = {}) {
  return Boolean(user.pushDevices && typeof user.pushDevices === 'object' && Object.keys(user.pushDevices).length > 0);
}
function isEligiblePushDevice(device = {}, now = Date.now(), maxAgeDays = Number(process.env.PUSH_DEVICE_MAX_AGE_DAYS || 45)) {
  if (!device || typeof device !== 'object') return false;
  const permission = String(device.permission || device.notificationPermission || '').toLowerCase();
  if (device.active === false || device.disabled === true || permission !== 'granted') return false;
  const lastVerified = new Date(device.lastVerifiedAt || device.fcmTokenUpdatedAt || device.updatedAt || 0).getTime();
  const maxAgeMs = Math.max(1, Number(maxAgeDays) || 45) * 24 * 60 * 60 * 1000;
  return !lastVerified || now - lastVerified <= maxAgeMs;
}
function collectEligibleAutomationTokens(user = {}, now = Date.now()) {
  const tokens = new Set();
  if (hasModernPushDeviceRegistry(user)) {
    Object.values(user.pushDevices || {}).forEach(device => {
      const token = String(device?.token || device?.fcmToken || '').trim();
      if (token && isEligiblePushDevice(device, now)) tokens.add(token);
    });
    return [...tokens];
  }
  const primary = String(user.fcmToken || '').trim();
  if (primary) tokens.add(primary);
  (Array.isArray(user.fcmTokens) ? user.fcmTokens : []).forEach(token => { token = String(token || '').trim(); if (token) tokens.add(token); });
  (Array.isArray(user.pushTokens) ? user.pushTokens : []).forEach(row => {
    const token = String(typeof row === 'string' ? row : row?.token || row?.fcmToken || '').trim();
    if (token) tokens.add(token);
  });
  return [...tokens];
}
function stableAlertIdentity({ restaurantId = '', type = '', source = '', entityId = '', payload = {} } = {}) {
  const resolvedEntity = entityId || payload.itemId || payload.recipeId || payload.vendorId || payload.shiftId || payload.findingId || payload.id || payload.itemName || payload.recipeName || payload.title || 'general';
  return crypto.createHash('sha1').update([restaurantId, source, type, resolvedEntity].map(v => String(v || '').trim().toLowerCase()).join('|')).digest('hex').slice(0, 32);
}

module.exports = {
  VOLATILE_AUTOMATION_KEYS,
  UNORDERED_AUTOMATION_ARRAY_KEYS,
  contentHash,
  stripGeneratedLines,
  stripVolatileAutomationFields,
  stableMeaningfulAutomationHash,
  hasModernPushDeviceRegistry,
  isEligiblePushDevice,
  collectEligibleAutomationTokens,
  stableAlertIdentity
};

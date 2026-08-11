'use strict';
const identity = require('./scheduleIdentity.cjs');

function normalizeDateKey(value = '') {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = raw ? new Date(`${raw}T12:00:00`) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}
function buildCanonicalShiftDateFieldsForTest(dateValue = '') {
  const date = normalizeDateKey(dateValue);
  return { date, scheduleDateKey: date, shiftDate: date, scheduleMonth: date.slice(0, 7) };
}
function buildMyScheduleLegacyRescueQuerySources({ user = {}, roster = [], start = '', end = '', pageSize = 120 } = {}) {
  const context = identity.buildIdentityContext(user, roster);
  const sources = [];
  // 16.0.191 intentionally does NOT fan arbitrary durable aliases through employeeId.
  // The broad bounded range rescues must run for scheduleDateKey-only, date-only, email,
  // and safe-name legacy rows, so employeeId equality queries would be reread and do not save reads.
  sources.push({ id: 'legacy-scheduleDateKey-range', type: 'range', dateField: 'scheduleDateKey', start, end, pageSize });
  sources.push({ id: 'legacy-date-range', type: 'range', dateField: 'date', start, end, pageSize });
  return { sources, identity: context, exactEmployeeIdValuesAvailable: context.exactEmployeeIds || [], employeeIdIndexedQueryCount: 0, strategy: 'broad-compatibility-no-redundant-employeeId-fanout', pageSize };
}
function mergeMyScheduleCanonicalAndLegacy({ canonical = [], legacyPages = [], user = {}, roster = [] } = {}) {
  const byId = new Map();
  let duplicatesRemoved = 0;
  const add = (row, source) => {
    if (!row || !identity.shiftMatchesMyScheduleIdentity(row, user, roster)) return;
    const key = String(row.id || `${row.date || row.scheduleDateKey || row.shiftDate}:${row.startTime || ''}:${row.endTime || ''}:${row.scheduleUserId || row.employeeId || row.userId || row.employeeName || ''}`);
    if (byId.has(key)) { duplicatesRemoved += 1; return; }
    byId.set(key, { ...row, _myScheduleSource: source });
  };
  canonical.forEach(row => add(row, 'canonical'));
  legacyPages.flat().forEach(row => add(row, 'legacy-rescue'));
  return Array.from(byId.values())
    .sort((a,b) => String(a.date || a.scheduleDateKey || a.shiftDate || '').localeCompare(String(b.date || b.scheduleDateKey || b.shiftDate || '')) || String(a.startTime || '').localeCompare(String(b.startTime || '')))
    .map(row => ({ ...row, _duplicatesRemoved: duplicatesRemoved }));
}
function simulatePaginatedMyScheduleLegacyRescue({ workspaceRows = [], user = {}, roster = [], pageSize = 120, start = '', end = '', failSourceId = '' } = {}) {
  const plan = buildMyScheduleLegacyRescueQuerySources({ user, roster, start, end, pageSize });
  const pages = [];
  const seenIds = new Set();
  const deliveredIds = new Set();
  let delivered = 0;
  let pagesFetched = 0;
  let duplicatesRemoved = 0;
  let duplicateDeliveries = 0;
  let queryRequestCount = 0;
  let scheduleDateKeyPageCount = 0;
  let datePageCount = 0;
  const querySourcesUsed = [];
  for (const source of plan.sources) {
    querySourcesUsed.push(source.id);
    if (failSourceId && source.id === failSourceId) {
      const failedMatched = mergeMyScheduleCanonicalAndLegacy({ canonical: [], legacyPages: pages, user, roster });
      return { pages, delivered, documentsDelivered: delivered, matched: failedMatched, pageCount: pagesFetched, pagesFetched, duplicatesRemoved, duplicateDeliveries, duplicateDocuments: duplicateDeliveries, uniqueMatchingLegacyRows: failedMatched.length, queryRequestCount, scheduleDateKeyPageCount, datePageCount, evaluatedAllPages: false, truncated: false, error: 'simulated-query-failure', lastAttemptSucceeded: false, querySourcesUsed, employeeIdIndexedQueryCount: plan.employeeIdIndexedQueryCount };
    }
    const filtered = workspaceRows.filter(row => {
      if (!identity.shiftDateInRange(row, start, end)) return false;
      const dateValue = String(row?.[source.dateField] || '').slice(0, 10);
      return Boolean(dateValue) && (!start || dateValue >= start) && (!end || dateValue <= end);
    }).sort((a, b) => String(a[source.dateField] || a.scheduleDateKey || a.date || a.shiftDate || '').localeCompare(String(b[source.dateField] || b.scheduleDateKey || b.date || b.shiftDate || '')) || String(a.id || '').localeCompare(String(b.id || '')));
    for (let i = 0; i < filtered.length; i += pageSize) {
      const page = filtered.slice(i, i + pageSize);
      if (!page.length) continue;
      pagesFetched += 1;
      queryRequestCount += 1;
      if (source.dateField === 'scheduleDateKey') scheduleDateKeyPageCount += 1;
      if (source.dateField === 'date') datePageCount += 1;
      delivered += page.length;
      const matchingPage = [];
      page.forEach(row => {
        const id = String(row.id || '');
        if (id && deliveredIds.has(id)) duplicateDeliveries += 1;
        if (id) deliveredIds.add(id);
        if (id && seenIds.has(id)) { duplicatesRemoved += 1; return; }
        if (!identity.shiftMatchesMyScheduleIdentity(row, user, roster)) return;
        if (id) seenIds.add(id);
        matchingPage.push(row);
      });
      pages.push(matchingPage);
    }
  }
  const merged = mergeMyScheduleCanonicalAndLegacy({ canonical: [], legacyPages: pages, user, roster });
  return { pages, delivered, documentsDelivered: delivered, matched: merged, pageCount: pagesFetched, pagesFetched, duplicatesRemoved, duplicateDeliveries, duplicateDocuments: duplicateDeliveries, uniqueMatchingLegacyRows: merged.length, queryRequestCount, scheduleDateKeyPageCount, datePageCount, evaluatedAllPages: true, truncated: false, error: null, lastAttemptSucceeded: true, querySourcesUsed, employeeIdIndexedQueryCount: plan.employeeIdIndexedQueryCount };
}

function advanceMyScheduleRescueRetryTelemetry(previous = {}, { contextKey = '', refreshKey = 0 } = {}) {
  const prev = previous && typeof previous === 'object' ? previous : {};
  if (String(prev.contextKey || '') !== String(contextKey || '')) {
    return { contextKey: String(contextKey || ''), lastRefreshKey: refreshKey, retryCount: 0, contextChanged: true, retryTriggered: false };
  }
  if (prev.lastRefreshKey !== refreshKey) {
    return { contextKey: String(contextKey || ''), lastRefreshKey: refreshKey, retryCount: Number(prev.retryCount || 0) + 1, contextChanged: false, retryTriggered: true };
  }
  return { contextKey: String(contextKey || ''), lastRefreshKey: refreshKey, retryCount: Number(prev.retryCount || 0), contextChanged: false, retryTriggered: false };
}

module.exports = {
  buildCanonicalShiftDateFields: buildCanonicalShiftDateFieldsForTest,
  buildCanonicalShiftDateFieldsForTest,
  normalizeIdentityValue: identity.normalizeIdentityValue,
  collectMyScheduleIdentityAliases: (...records) => identity.unique([...identity.collectDurableAliases(...records), ...identity.collectEmailAliases(...records)], value => value),
  collectMyScheduleDurableAliases: identity.collectDurableAliases,
  collectMyScheduleEmailAliases: identity.collectEmailAliases,
  collectMyScheduleNameAliases: identity.collectNameAliases,
  resolveRosterPersonForUser: identity.resolveRosterPersonForUser,
  buildMyScheduleIdentityContext: identity.buildIdentityContext,
  buildMyScheduleRosterIdentityFingerprint: identity.buildRosterIdentityFingerprint,
  collectExactEmployeeIdValues: identity.collectExactEmployeeIdValues,
  buildMyScheduleLegacyRescueQuerySources,
  shiftMatchesMyScheduleIdentity: identity.shiftMatchesMyScheduleIdentity,
  shiftDateInRange: identity.shiftDateInRange,
  simulatePaginatedMyScheduleLegacyRescue,
  mergeMyScheduleCanonicalAndLegacy,
  advanceMyScheduleRescueRetryTelemetry
};

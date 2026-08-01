"use strict";

const DIAGNOSTIC_STORAGE_KEY = "86chaos:runtimeErrorDiagnostics";
const DELIVERED_PREFIX = "86chaos:runtimeReport:delivered:";
const IN_FLIGHT_PREFIX = "86chaos:runtimeReport:inFlight:";
const FAILURE_PREFIX = "86chaos:runtimeReport:failed:";
const DEFAULT_REPORT_REQUEST_TIMEOUT_MS = 12000;
const DEFAULT_IN_FLIGHT_STALE_MS = DEFAULT_REPORT_REQUEST_TIMEOUT_MS + 8000;

function safeString(value, max = 2000) {
  return String(value == null ? "" : value)
    .replace(/(Bearer\s+)[A-Za-z0-9._\-+/=]+/gi, "$1[redacted]")
    .replace(/(token|password|secret|api[_-]?key|private[_-]?key)(["'\s:=]+)[^\s"'}]+/gi, "$1$2[redacted]")
    .slice(0, max);
}

function createFallbackReportId(prefix = "local") {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}_${random}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}

function normalizeReportId(value) {
  const raw = safeString(value, 120).trim();
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{5,119}$/.test(raw) ? raw : "";
}

function storageGet(storage, key) {
  try { return storage?.getItem?.(key) || ""; } catch (_) { return ""; }
}
function storageSet(storage, key, value) {
  try { storage?.setItem?.(key, String(value)); return true; } catch (_) { return false; }
}
function storageRemove(storage, key) {
  try { storage?.removeItem?.(key); } catch (_) {}
}

function hashLike(text = "") {
  let hash = 5381;
  const raw = String(text || "");
  for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

function parseReportMarker(raw = '') {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return { at: raw };
  }
}
function markerAgeMs(marker = {}, now = Date.now()) {
  const at = Number(marker.atMs || 0) || Date.parse(marker.at || '');
  return Number.isFinite(at) && at > 0 ? Math.max(0, now - at) : Number.POSITIVE_INFINITY;
}
function isInFlightMarkerStale(marker = {}, staleMs = DEFAULT_IN_FLIGHT_STALE_MS, now = Date.now()) {
  return markerAgeMs(marker, now) > Number(staleMs || DEFAULT_IN_FLIGHT_STALE_MS);
}

function buildRuntimeReportFingerprint(kind, error = {}, context = {}) {
  return [
    kind || "runtime",
    safeString(error?.name || "Error", 120),
    safeString(error?.message || error || "", 500),
    safeString(context.appVersion || "", 80),
    safeString(context.route || "", 300),
    safeString(context.activeTab || "", 80),
    safeString(context.chunkUrl || "", 500),
  ].join("|");
}

function beginReportSubmission(storage, fingerprint, options = {}) {
  const key = hashLike(fingerprint);
  const deliveredKey = `${DELIVERED_PREFIX}${key}`;
  const inFlightKey = `${IN_FLIGHT_PREFIX}${key}`;
  const delivered = normalizeReportId(storageGet(storage, deliveredKey));
  if (delivered) return { ok: false, state: "delivered", reportId: delivered, key, deliveredKey, inFlightKey };
  const now = Date.now();
  const rawInFlight = storageGet(storage, inFlightKey);
  if (rawInFlight) {
    const marker = parseReportMarker(rawInFlight);
    if (!isInFlightMarkerStale(marker, options.staleMs || DEFAULT_IN_FLIGHT_STALE_MS, now)) {
      return { ok: false, state: "in-flight", key, deliveredKey, inFlightKey, marker };
    }
    storageRemove(storage, inFlightKey);
  }
  storageSet(storage, inFlightKey, JSON.stringify({ at: new Date(now).toISOString(), atMs: now, fallbackReportId: options.fallbackReportId || '' }));
  return { ok: true, state: "started", key, deliveredKey, inFlightKey };
}

function completeReportSubmission(storage, fingerprint, reportId, fallbackReportId = "") {
  const key = hashLike(fingerprint);
  const cleanReportId = normalizeReportId(reportId);
  storageRemove(storage, `${IN_FLIGHT_PREFIX}${key}`);
  if (!cleanReportId) {
    storageSet(storage, `${FAILURE_PREFIX}${key}`, JSON.stringify({ reason: "malformed response", at: new Date().toISOString(), fallbackReportId }));
    return { ok: false, reason: "malformed response" };
  }
  storageSet(storage, `${DELIVERED_PREFIX}${key}`, cleanReportId);
  storageRemove(storage, `${FAILURE_PREFIX}${key}`);
  return { ok: true, reportId: cleanReportId };
}

function failReportSubmission(storage, fingerprint, reason = "request failed", fallbackReportId = "") {
  const key = hashLike(fingerprint);
  storageRemove(storage, `${IN_FLIGHT_PREFIX}${key}`);
  storageSet(storage, `${FAILURE_PREFIX}${key}`, JSON.stringify({ reason: safeString(reason, 180), at: new Date().toISOString(), fallbackReportId }));
  return { ok: false, reason };
}

function createRuntimeDiagnostic({ fallbackReportId = "", serverReportId = "", status = "caught", error = {}, componentStack = "", route = "", activeTab = "", appVersion = "", deployedVersion = "", uid = "", workspaceId = "", browser = "", viewport = "", category = "runtime" } = {}) {
  return {
    fallbackReportId: safeString(fallbackReportId, 100),
    serverReportId: safeString(serverReportId, 120),
    status: safeString(status, 80),
    category: safeString(category, 80),
    errorName: safeString(error?.name || "Error", 140),
    errorMessage: safeString(error?.message || error || "", 2000),
    rawStack: safeString(error?.stack || "", 6000),
    componentStack: safeString(componentStack || "", 6000),
    route: safeString(route, 300),
    activeTab: safeString(activeTab, 80),
    appVersion: safeString(appVersion, 80),
    deployedVersion: safeString(deployedVersion, 80),
    uid: safeString(uid, 140),
    workspaceId: safeString(workspaceId, 160),
    browser: safeString(browser, 400),
    viewport: safeString(viewport, 80),
    timestamp: new Date().toISOString(),
  };
}

function rememberLocalRuntimeDiagnostic(storage, diagnostic = {}) {
  try {
    const existing = JSON.parse(storageGet(storage, DIAGNOSTIC_STORAGE_KEY) || "[]");
    const next = [diagnostic, ...(Array.isArray(existing) ? existing : [])].slice(0, 20);
    storageSet(storage, DIAGNOSTIC_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {
    storageSet(storage, DIAGNOSTIC_STORAGE_KEY, JSON.stringify([diagnostic].slice(0, 1)));
  }
}

module.exports = {
  DIAGNOSTIC_STORAGE_KEY,
  createFallbackReportId,
  normalizeReportId,
  buildRuntimeReportFingerprint,
  beginReportSubmission,
  completeReportSubmission,
  failReportSubmission,
  createRuntimeDiagnostic,
  rememberLocalRuntimeDiagnostic,
  parseReportMarker,
  markerAgeMs,
  isInFlightMarkerStale,
  DEFAULT_REPORT_REQUEST_TIMEOUT_MS,
  DEFAULT_IN_FLIGHT_STALE_MS,
  safeString,
};

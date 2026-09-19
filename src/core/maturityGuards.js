// 86 Chaos maturity guardrails: app-only helpers for local resilience,
// diagnostics, and safe offline recovery. These helpers intentionally do not
// import Firebase, call APIs, or mutate backend state.

const DEFAULT_QUEUE_LIMIT = 75;
const DEFAULT_EVENT_LIMIT = 80;

const SENSITIVE_KEY_PATTERN = /(password|temporarypassword|token|secret|apikey|api_key|privatekey|private_key|authorization|bearer|cookie|session|fcm|ssn|wage|hourlyrate|payrate|email|phone|address)/i;

export const isPlainObject = (value) => Boolean(
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

export const safeJsonParse = (text, fallback = null) => {
  if (text === null || text === undefined || text === '') return fallback;
  try { return JSON.parse(String(text)); }
  catch (_) { return fallback; }
};

export const clampText = (value = '', max = 240) => String(value || '').slice(0, Math.max(0, max));

export const redactSensitiveValue = (value, depth = 0) => {
  if (depth > 6) return '[depth-limit]';
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redactSensitiveValue(item, depth + 1));
  if (isPlainObject(value)) {
    return Object.entries(value).slice(0, 120).reduce((out, [key, val]) => {
      out[key] = SENSITIVE_KEY_PATTERN.test(String(key || '')) ? '[redacted]' : redactSensitiveValue(val, depth + 1);
      return out;
    }, {});
  }
  if (typeof value === 'string') return value.length > 1200 ? `${value.slice(0, 1200)}…` : value;
  return value;
};

export const readJsonFromStorage = (storage, key, fallback = null) => {
  if (!storage || !key) return { value: fallback, ok: false, repaired: false, error: 'storage-unavailable' };
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined || raw === '') return { value: fallback, ok: true, repaired: false, error: '' };
    const parsed = JSON.parse(raw);
    return { value: parsed, ok: true, repaired: false, error: '' };
  } catch (error) {
    try { storage.setItem(`${key}_corrupt_${Date.now()}`, clampText(storage.getItem(key) || '', 5000)); } catch (_) {}
    try { storage.removeItem(key); } catch (_) {}
    return { value: fallback, ok: false, repaired: true, error: error?.message || 'json-parse-failed' };
  }
};

export const writeJsonToStorage = (storage, key, value) => {
  if (!storage || !key) return { ok: false, error: 'storage-unavailable' };
  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true, error: '' };
  } catch (error) {
    return { ok: false, error: error?.message || 'storage-write-failed' };
  }
};

export const stablePayloadKey = (value) => {
  if (Array.isArray(value)) return `[${value.map(stablePayloadKey).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stablePayloadKey(value[key])}`).join(',')}}`;
  try { return JSON.stringify(value); } catch (_) { return String(value || ''); }
};

export const offlineWriteFingerprint = (item = {}) => [
  clampText(item.collectionName || item.collection || '', 120),
  clampText(item.docId || '', 160),
  clampText(item.action || 'set', 30),
  stablePayloadKey(redactSensitiveValue(item.data || {}))
].join('|');

export const normalizeOfflineQueueItem = (item = {}, nowIso = new Date().toISOString()) => {
  if (!isPlainObject(item)) return null;
  const collectionName = clampText(item.collectionName || item.collection || '', 120).trim();
  const action = clampText(item.action || 'set', 30).trim();
  if (!collectionName || !['add', 'set', 'update', 'delete'].includes(action)) return null;
  const data = isPlainObject(item.data) ? redactSensitiveValue(item.data) : {};
  const docId = clampText(item.docId || '', 180).trim();
  if (['set', 'update', 'delete'].includes(action) && !docId) return null;
  const base = {
    id: clampText(item.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`, 80),
    idempotencyKey: clampText(item.idempotencyKey || offlineWriteFingerprint({ collectionName, docId, action, data }), 600),
    queuedAt: clampText(item.queuedAt || nowIso, 40),
    lastTriedAt: clampText(item.lastTriedAt || '', 40),
    collectionName,
    docId,
    action,
    data,
    label: clampText(item.label || '', 180),
    attemptCount: Math.max(0, Number(item.attemptCount || 0) || 0),
    lastError: clampText(item.lastError || '', 500)
  };
  return base;
};

export const normalizeOfflineQueue = (rawQueue = [], options = {}) => {
  const maxItems = Math.max(1, Number(options.maxItems || DEFAULT_QUEUE_LIMIT) || DEFAULT_QUEUE_LIMIT);
  const nowIso = options.nowIso || new Date().toISOString();
  const input = Array.isArray(rawQueue) ? rawQueue : [];
  const byKey = new Map();
  for (const rawItem of input) {
    const item = normalizeOfflineQueueItem(rawItem, nowIso);
    if (!item) continue;
    byKey.set(item.idempotencyKey, { ...(byKey.get(item.idempotencyKey) || {}), ...item });
  }
  return Array.from(byKey.values()).slice(-maxItems);
};

export const appendOfflineQueueItem = (queue = [], item = {}, options = {}) => {
  const normalized = normalizeOfflineQueueItem(item, options.nowIso || new Date().toISOString());
  if (!normalized) return normalizeOfflineQueue(queue, options);
  return normalizeOfflineQueue([...(Array.isArray(queue) ? queue : []), normalized], options);
};

export const classifyRuntimeIssue = (errorOrMessage = '') => {
  const text = [errorOrMessage?.code, errorOrMessage?.name, errorOrMessage?.message, String(errorOrMessage || '')].filter(Boolean).join(' ').toLowerCase();
  if (/permission|denied|unauthorized|forbidden/.test(text)) return 'permission';
  if (/offline|network|failed to fetch|unavailable|connection|timeout/.test(text)) return 'network';
  if (/quota|storage|exceeded/.test(text)) return 'browser-storage';
  if (/firebase|firestore|auth|messaging/.test(text)) return 'firebase-client';
  if (/json|parse|syntax/.test(text)) return 'data-shape';
  return 'unknown';
};

export const recordLocalRuntimeEvent = (storage, event = {}, options = {}) => {
  const key = options.key || 'chaosLocalRuntimeEvents';
  const maxItems = Math.max(1, Number(options.maxItems || DEFAULT_EVENT_LIMIT) || DEFAULT_EVENT_LIMIT);
  const existing = readJsonFromStorage(storage, key, []).value;
  const row = {
    id: clampText(event.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`, 80),
    at: clampText(event.at || new Date().toISOString(), 40),
    type: clampText(event.type || 'runtime', 80),
    severity: ['info', 'warning', 'error'].includes(event.severity) ? event.severity : 'warning',
    source: clampText(event.source || '', 160),
    issueType: clampText(event.issueType || classifyRuntimeIssue(event.error || event.message || ''), 80),
    message: clampText(event.message || event.error?.message || '', 800),
    detail: redactSensitiveValue(event.detail || {})
  };
  const next = [...(Array.isArray(existing) ? existing : []), row].slice(-maxItems);
  writeJsonToStorage(storage, key, next);
  return next;
};

export const buildLocalMaturitySnapshot = ({ queue = [], listenerDiagnostics = {}, runtimeEvents = [] } = {}) => ({
  generatedAt: new Date().toISOString(),
  offlineQueueDepth: Array.isArray(queue) ? queue.length : 0,
  offlineQueueRetrying: Array.isArray(queue) ? queue.filter(item => Number(item.attemptCount || 0) > 0).length : 0,
  activeListeners: Number(listenerDiagnostics?.activeListeners || 0) || 0,
  activeDocuments: Number(listenerDiagnostics?.activeDocuments || 0) || 0,
  listenerReuseCount: Number(listenerDiagnostics?.listenerReuseCount || 0) || 0,
  recentRuntimeEvents: Array.isArray(runtimeEvents) ? runtimeEvents.slice(-10) : []
});

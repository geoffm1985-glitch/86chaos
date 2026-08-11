'use strict';

function parsePresenceTimeMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate().getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function getPresenceLastMs(row = {}) {
  return Math.max(
    parsePresenceTimeMs(row.lastHeartbeatAt),
    parsePresenceTimeMs(row.presenceUpdatedAt),
    parsePresenceTimeMs(row.lastActive),
    parsePresenceTimeMs(row.lastSeen),
    parsePresenceTimeMs(row.lastOnline),
    parsePresenceTimeMs(row.lastChanged),
    parsePresenceTimeMs(row.connectedAt),
    parsePresenceTimeMs(row.heartbeatEpochMs)
  );
}

function isExplicitlyOffline(row = {}) {
  return row.online === false || row.onlineState === 'offline' || row.state === 'offline';
}

function isAuthoritativeSessionPresence(row = {}) {
  const source = String(row.presenceSource || row.source || '').toLowerCase();
  return source.includes('rtdb-status-sessions') || source.includes('status-sessions-presence');
}

function classifySystemAdminPresenceRow(row = {}, opts = {}) {
  const nowMs = Number(opts.nowMs || Date.now());
  const fallbackOnlineWindowMs = Number(opts.fallbackOnlineWindowMs || opts.onlineWindowMs || 90_000);
  const fetchedAtMs = Number(opts.fetchedAtMs || 0);
  const lastMs = getPresenceLastMs(row);
  const authoritative = isAuthoritativeSessionPresence(row);
  const explicitOffline = isExplicitlyOffline(row);
  if (authoritative) {
    return {
      online: row.online === true && !explicitOffline,
      authoritative,
      explicitOffline,
      lastMs,
      reason: row.online === true && !explicitOffline ? 'active-rtdb-status-session' : 'authoritative-session-offline'
    };
  }
  const online = Boolean(fetchedAtMs && lastMs && !explicitOffline && (nowMs - lastMs) <= fallbackOnlineWindowMs);
  return { online, authoritative, explicitOffline, lastMs, reason: online ? 'fresh-legacy-fallback' : 'not-online' };
}

function aggregateSessionPresence(sessionRows = []) {
  const active = (sessionRows || []).filter(row => row && (row.online === true || row.state === 'online'));
  return { online: active.length > 0, activeSessionCount: active.length };
}

function buildPresenceMutationPlan(event = 'connect') {
  if (event === 'connect') return { sessionWrites: 1, statusSummaryOnlineWrites: 0, lastSeenWrites: 0, sessionRemovals: 0, heartbeatWrites: 0, firestoreWrites: 0 };
  if (event === 'disconnect') return { sessionWrites: 0, statusSummaryOnlineWrites: 0, lastSeenWrites: 1, sessionRemovals: 1, heartbeatWrites: 0, firestoreWrites: 0 };
  return { sessionWrites: 0, statusSummaryOnlineWrites: 0, lastSeenWrites: 0, sessionRemovals: 0, heartbeatWrites: 0, firestoreWrites: 0 };
}

function createTtlRequestCache(ttlMs = 45_000) {
  let cached = null;
  return async function getOrLoad(key, loader, nowMs = Date.now()) {
    if (cached && cached.key === key && nowMs - cached.loadedAt < ttlMs) return { value: cached.value, fromCache: true, requestCount: 0 };
    const value = await loader();
    cached = { key, loadedAt: nowMs, value };
    return { value, fromCache: false, requestCount: 1 };
  };
}

module.exports = {
  parsePresenceTimeMs,
  getPresenceLastMs,
  isExplicitlyOffline,
  isAuthoritativeSessionPresence,
  classifySystemAdminPresenceRow,
  aggregateSessionPresence,
  buildPresenceMutationPlan,
  createTtlRequestCache
};

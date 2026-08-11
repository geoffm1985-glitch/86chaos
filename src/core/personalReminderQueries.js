import React, { useEffect, useMemo, useRef, useState } from 'react';
import { auth, secureFetch } from './appCore';

const PERSONAL_REMINDER_REFRESH_MS = 7 * 60 * 1000;
const PERSONAL_REMINDER_STALE_MS = 7 * 60 * 1000;
const reminderApiReaders = new Map();

export const resolveAuthenticatedReminderUid = (appUser = {}) => (
  auth?.currentUser?.uid || appUser?.authUid || appUser?.uid || appUser?.id || appUser?.userId || ''
);

export const reminderBelongsToUser = (reminder = {}, uid = '') => {
  const userUid = String(uid || '').trim();
  if (!userUid) return false;
  const participants = Array.isArray(reminder.participantUserIds) ? reminder.participantUserIds.map(value => String(value || '').trim()).filter(Boolean) : [];
  return participants.includes(userUid);
};

export const mergeReminderRows = (...groups) => {
  const map = new Map();
  groups.flat().filter(Boolean).forEach((row) => {
    const key = row.id || row.docId || `${row.restaurantId || ''}:${row.createdAt || ''}:${row.title || row.message || ''}`;
    if (!map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
};

export const sortReminderRows = (rows = []) => [...rows].sort((a, b) => {
  const aTime = String(a.nextDispatchAt || a.scheduledAt || a.snoozedUntil || a.terminalAt || a.updatedAt || a.createdAt || '');
  const bTime = String(b.nextDispatchAt || b.scheduledAt || b.snoozedUntil || b.terminalAt || b.updatedAt || b.createdAt || '');
  return aTime.localeCompare(bTime);
});

export const buildReminderQuerySpecs = (uid = '') => {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return [];
  return [
    { key: 'canonical-participant', whereClauses: [['participantSchemaVersion', '==', 1], ['participantUserIds', 'array-contains', safeUid]] }
  ];
};

function reminderReaderKey(restaurantId = '', uid = '', limitCount = 80) {
  return [String(restaurantId || '').trim(), String(uid || '').trim(), Number(limitCount || 80) || 80].join('|');
}

function getReminderReaderEntry(key, defaults = {}) {
  let entry = reminderApiReaders.get(key);
  if (!entry) {
    entry = {
      key,
      restaurantId: defaults.restaurantId || '',
      uid: defaults.uid || '',
      limitCount: defaults.limitCount || 80,
      data: [],
      error: null,
      stale: false,
      loading: false,
      lastLoadedAt: 0,
      inFlight: null,
      subscribers: new Set(),
      releaseTimer: null,
      requestCount: 0,
    };
    reminderApiReaders.set(key, entry);
  }
  return entry;
}

function notifyReminderSubscribers(entry) {
  const snapshot = { data: entry.data || [], error: entry.error || null, stale: entry.stale === true, loading: entry.loading === true, requestCount: entry.requestCount || 0 };
  entry.subscribers.forEach(fn => {
    try { fn(snapshot); } catch (_) {}
  });
}

async function fetchReminderEntry(entry, { force = false, debugLabel = '' } = {}) {
  if (!entry.restaurantId || !entry.uid) return entry.data || [];
  if (!force && entry.lastLoadedAt && Date.now() - entry.lastLoadedAt < PERSONAL_REMINDER_STALE_MS) return entry.data || [];
  if (entry.inFlight) return entry.inFlight;
  entry.loading = true;
  entry.error = null;
  notifyReminderSubscribers(entry);
  entry.inFlight = secureFetch('/api/personal-reminder-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId: entry.restaurantId,
      limitCount: entry.limitCount,
      querySignature: 'participantSchemaVersion==1;participantUserIds array-contains auth.uid',
      debugLabel: debugLabel || 'personal-reminders:api-reader'
    })
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        const err = new Error(data?.error || `Personal reminder reader failed (${response.status})`);
        err.code = data?.code || 'personal-reminder-list-failed';
        throw err;
      }
      const rows = Array.isArray(data?.reminders) ? data.reminders : [];
      entry.data = rows;
      entry.error = null;
      entry.stale = false;
      entry.lastLoadedAt = Date.now();
      entry.requestCount = Number(entry.requestCount || 0) + 1;
      return entry.data;
    })
    .catch((err) => {
      const code = String(err?.code || err?.name || 'personal-reminder-list-failed');
      entry.error = code;
      entry.stale = true;
      // Preserve last valid data and report only safe diagnostics. The direct
      // Firestore listener is intentionally not kept alive beside this reader.
      console.warn('Handled personal reminder reader failure', {
        operation: 'personal-reminder-list',
        route: 'personal-reminders',
        workspaceId: entry.restaurantId,
        querySignature: 'canonical-participant-api-reader',
        debugLabel: debugLabel || 'personal-reminders:api-reader',
        code
      });
      return entry.data || [];
    })
    .finally(() => {
      entry.loading = false;
      entry.inFlight = null;
      notifyReminderSubscribers(entry);
    });
  return entry.inFlight;
}

export const requestPersonalReminderRefresh = ({ restaurantId = '', uid = '' } = {}) => {
  const wantedRestaurant = String(restaurantId || '').trim();
  const wantedUid = String(uid || '').trim();
  reminderApiReaders.forEach((entry) => {
    if (wantedRestaurant && entry.restaurantId !== wantedRestaurant) return;
    if (wantedUid && entry.uid !== wantedUid) return;
    fetchReminderEntry(entry, { force: true, debugLabel: 'personal-reminders:manual-refresh' });
  });
};

export const __getPersonalReminderReaderDiagnostics = () => Array.from(reminderApiReaders.values()).map(entry => ({
  key: entry.key,
  restaurantId: entry.restaurantId,
  uidPresent: Boolean(entry.uid),
  subscribers: entry.subscribers.size,
  requestCount: entry.requestCount || 0,
  stale: entry.stale === true,
  loading: entry.loading === true,
  lastLoadedAt: entry.lastLoadedAt || 0,
}));

export const usePersonalReminderRows = (appUser = {}, options = {}) => {
  const uid = resolveAuthenticatedReminderUid(appUser);
  const restaurantId = appUser?.restaurantId || '';
  const enabled = options.enabled !== false && Boolean(restaurantId && uid);
  const limitCount = options.limitCount || 80;
  const debugLabel = options.debugLabel || 'personal-reminders';
  const key = reminderReaderKey(restaurantId, uid, limitCount);
  const mountedRef = useRef(true);
  const [readerState, setReaderState] = useState({ data: [], error: null, stale: false, loading: enabled });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setReaderState({ data: [], error: null, stale: false, loading: false });
      return undefined;
    }
    const entry = getReminderReaderEntry(key, { restaurantId, uid, limitCount });
    entry.restaurantId = restaurantId;
    entry.uid = uid;
    entry.limitCount = limitCount;
    const subscriber = (state) => { if (mountedRef.current) setReaderState(state); };
    entry.subscribers.add(subscriber);
    if (entry.releaseTimer) {
      clearTimeout(entry.releaseTimer);
      entry.releaseTimer = null;
    }
    subscriber({ data: entry.data || [], error: entry.error || null, stale: entry.stale === true, loading: entry.loading === true });
    fetchReminderEntry(entry, { force: false, debugLabel });
    const refreshIfStale = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!entry.lastLoadedAt || Date.now() - entry.lastLoadedAt >= Math.max(60_000, Number(options.staleMs || PERSONAL_REMINDER_STALE_MS))) {
        fetchReminderEntry(entry, { force: true, debugLabel: `${debugLabel}:stale-refresh` });
      }
    };
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.releaseTimer = setTimeout(() => {
          const latest = reminderApiReaders.get(key);
          if (latest && latest.subscribers.size === 0) reminderApiReaders.delete(key);
        }, 30_000);
      }
    };
  }, [enabled, key, restaurantId, uid, limitCount, debugLabel, options.refreshMs]);

  return useMemo(() => sortReminderRows(
    mergeReminderRows(readerState.data)
      .filter(row => row?.restaurantId === restaurantId && reminderBelongsToUser(row, uid))
  ), [readerState.data, restaurantId, uid]);
};

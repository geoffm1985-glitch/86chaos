import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './appCore';

const REGISTRY_VERSION = 'v1';
const MAX_LOCAL_ALERTS = 180;

const stableHash = (value = '') => {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const safeId = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'alert';

const buildIdentity = ({ userId, workspaceId, alertId }) => {
  const scope = `${userId || 'guest'}|${workspaceId || 'global'}|${alertId || 'alert'}`;
  return `${safeId(alertId)}_${stableHash(scope)}`;
};

const localRegistryKey = ({ userId, workspaceId }) =>
  `chaosSeenAlerts_${REGISTRY_VERSION}_${safeId(userId || 'guest')}_${stableHash(workspaceId || 'global')}`;

const readLocalRegistry = (scope) => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(localRegistryKey(scope)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
};

const writeLocalRegistry = (scope, registry) => {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = Object.fromEntries(
      Object.entries(registry || {})
        .sort(([, left], [, right]) => Number(right?.seenAtMs || 0) - Number(left?.seenAtMs || 0))
        .slice(0, MAX_LOCAL_ALERTS)
    );
    localStorage.setItem(localRegistryKey(scope), JSON.stringify(trimmed));
  } catch (_) {}
};

const isMatchingEntry = (entry, fingerprint) => {
  if (!entry || entry.fingerprint !== fingerprint) return false;
  if (entry.expiresAtMs && Number(entry.expiresAtMs) <= Date.now()) return false;
  return true;
};

const readRemoteEntry = (user, identity) => user?.preferences?.seenAlerts?.[identity] || null;

export const buildAlertFingerprint = (...parts) => stableHash(parts
  .flat(Infinity)
  .map(part => {
    if (part === null || part === undefined) return '';
    if (typeof part === 'object') {
      try { return JSON.stringify(part, Object.keys(part).sort()); } catch (_) { return String(part); }
    }
    return String(part);
  })
  .join('|'));

export const useRememberedAlert = ({
  user,
  workspaceId,
  alertId,
  fingerprint,
  enabled = true,
  expiresAfterMs = null
}) => {
  const userId = user?.id || user?.uid || user?.userId || user?.email || 'guest';
  const scope = useMemo(() => ({ userId, workspaceId: workspaceId || user?.restaurantId || 'global' }), [userId, workspaceId, user?.restaurantId]);
  const identity = useMemo(() => buildIdentity({ ...scope, alertId }), [scope, alertId]);

  const calculateDismissed = useCallback(() => {
    if (!enabled || !fingerprint) return false;
    const localEntry = readLocalRegistry(scope)[identity];
    if (isMatchingEntry(localEntry, fingerprint)) return true;
    return isMatchingEntry(readRemoteEntry(user, identity), fingerprint);
  }, [enabled, fingerprint, identity, scope, user]);

  const [isDismissed, setIsDismissed] = useState(calculateDismissed);

  useEffect(() => {
    setIsDismissed(calculateDismissed());
  }, [calculateDismissed]);

  const dismiss = useCallback(async () => {
    const seenAtMs = Date.now();
    const entry = {
      fingerprint,
      seenAt: new Date(seenAtMs).toISOString(),
      seenAtMs,
      workspaceId: scope.workspaceId,
      alertId: safeId(alertId),
      ...(expiresAfterMs ? { expiresAtMs: seenAtMs + expiresAfterMs } : {})
    };

    const local = readLocalRegistry(scope);
    local[identity] = entry;
    writeLocalRegistry(scope, local);
    setIsDismissed(true);

    if (!user?.id || user.id === 'dev-backdoor') return;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        [`preferences.seenAlerts.${identity}`]: entry
      });
    } catch (error) {
      console.warn('Alert seen-state could not sync to Firestore. Local memory remains active.', error?.message || error);
    }
  }, [alertId, expiresAfterMs, fingerprint, identity, scope, user?.id]);

  return { isDismissed, dismiss, identity };
};

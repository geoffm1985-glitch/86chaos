import { useMemo } from 'react';
import { auth, useLiveCollection } from './appCore';

export const resolveAuthenticatedReminderUid = (appUser = {}) => (
  auth?.currentUser?.uid || appUser?.authUid || appUser?.uid || appUser?.id || appUser?.userId || ''
);

export const reminderBelongsToUser = (reminder = {}, uid = '') => {
  const userUid = String(uid || '').trim();
  if (!userUid) return false;
  const participants = Array.isArray(reminder.participantUserIds) ? reminder.participantUserIds.map(String) : [];
  return participants.includes(userUid) ||
    String(reminder.userId || '') === userUid ||
    String(reminder.assignedToUserId || '') === userUid ||
    String(reminder.createdBy || '') === userUid;
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
    { key: 'canonical-participant', whereClauses: [['participantUserIds', 'array-contains', safeUid]] },
    { key: 'legacy-user-id', whereClauses: [['userId', '==', safeUid]] },
    { key: 'legacy-assigned-to', whereClauses: [['assignedToUserId', '==', safeUid]] },
    { key: 'legacy-created-by', whereClauses: [['createdBy', '==', safeUid]] }
  ];
};

export const usePersonalReminderRows = (appUser = {}, options = {}) => {
  const uid = resolveAuthenticatedReminderUid(appUser);
  const restaurantId = appUser?.restaurantId || '';
  const enabled = options.enabled !== false && Boolean(restaurantId && uid);
  const limitCount = options.limitCount || 80;
  const specs = buildReminderQuerySpecs(uid);
  const canonicalRows = useLiveCollection('personalReminders', restaurantId, {
    enabled,
    whereClauses: specs[0]?.whereClauses || [],
    limitCount,
    fallbackLimitCount: options.fallbackLimitCount || 40,
    debugLabel: `${options.debugLabel || 'personal-reminders'}:canonical`
  });
  const legacyUserRows = useLiveCollection('personalReminders', restaurantId, {
    enabled,
    whereClauses: specs[1]?.whereClauses || [],
    limitCount,
    fallbackLimitCount: options.fallbackLimitCount || 40,
    debugLabel: `${options.debugLabel || 'personal-reminders'}:legacy-user-id`
  });
  const legacyAssignedRows = useLiveCollection('personalReminders', restaurantId, {
    enabled,
    whereClauses: specs[2]?.whereClauses || [],
    limitCount,
    fallbackLimitCount: options.fallbackLimitCount || 40,
    debugLabel: `${options.debugLabel || 'personal-reminders'}:legacy-assigned-to`
  });
  const legacyCreatedRows = useLiveCollection('personalReminders', restaurantId, {
    enabled,
    whereClauses: specs[3]?.whereClauses || [],
    limitCount,
    fallbackLimitCount: options.fallbackLimitCount || 40,
    debugLabel: `${options.debugLabel || 'personal-reminders'}:legacy-created-by`
  });
  return useMemo(() => sortReminderRows(
    mergeReminderRows(canonicalRows, legacyUserRows, legacyAssignedRows, legacyCreatedRows)
      .filter(row => row?.restaurantId === restaurantId && reminderBelongsToUser(row, uid))
  ), [canonicalRows, legacyUserRows, legacyAssignedRows, legacyCreatedRows, restaurantId, uid]);
};

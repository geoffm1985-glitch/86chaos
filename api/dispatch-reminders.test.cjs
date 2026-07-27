'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectEligibleTokens,
  occurrenceKeyForReminder,
  getZonedParts,
  getNextRecurringReminderAt,
  buildRecurringSuccessUpdate,
  buildRetryUpdate
} = require('./_reminder-dispatch-logic');

test('modern device registry never revives denied or disabled legacy tokens', () => {
  const user = {
    fcmToken: 'legacy-token',
    fcmTokens: ['legacy-token-2'],
    pushDevices: {
      denied: { token: 'legacy-token', active: true, permission: 'denied', lastVerifiedAt: '2026-07-26T00:00:00.000Z' },
      disabled: { token: 'disabled-token', active: false, permission: 'granted', lastVerifiedAt: '2026-07-26T00:00:00.000Z' },
      active: { token: 'active-token', active: true, permission: 'granted', lastVerifiedAt: '2026-07-26T00:00:00.000Z' }
    }
  };
  assert.deepEqual(collectEligibleTokens(user, Date.parse('2026-07-27T00:00:00.000Z')), ['active-token']);
});

test('retry preserves the same occurrence identity and does not mark success', () => {
  const key = occurrenceKeyForReminder('rem-1', '2026-07-26T18:00:00.000Z');
  const update = buildRetryUpdate({
    reminder: { occurrenceScheduledAt: '2026-07-26T18:00:00.000Z' },
    occurrenceKey: key,
    occurrenceAt: '2026-07-26T18:00:00.000Z',
    nowIso: '2026-07-26T18:00:01.000Z',
    retryIso: '2026-07-26T18:15:00.000Z',
    error: 'temporary'
  });
  assert.equal(update.currentOccurrenceKey, key);
  assert.equal(update.occurrenceScheduledAt, '2026-07-26T18:00:00.000Z');
  assert.equal(update.dispatchedAt, null);
  assert.equal(update.nextDispatchAt, '2026-07-26T18:15:00.000Z');
});

test('successful recurring occurrence receives a new key for the next occurrence', () => {
  const deliveredKey = occurrenceKeyForReminder('rem-1', '2026-07-26T18:00:00.000Z');
  const update = buildRecurringSuccessUpdate({
    docId: 'rem-1',
    reminder: { scheduledAt: '2026-07-26T18:00:00.000Z', timezone: 'America/Chicago' },
    deliveredOccurrenceKey: deliveredKey,
    nextScheduledAt: '2026-07-27T18:00:00.000Z',
    nowIso: '2026-07-26T18:00:02.000Z',
    successCount: 1
  });
  assert.equal(update.lastSuccessfulOccurrenceKey, deliveredKey);
  assert.equal(update.currentOccurrenceKey, occurrenceKeyForReminder('rem-1', '2026-07-27T18:00:00.000Z'));
  assert.notEqual(update.currentOccurrenceKey, update.lastSuccessfulOccurrenceKey);
  assert.equal(update.dispatchedAt, null);
});

test('monthly recurrence clamps January 31 to the final day of February', () => {
  const next = getNextRecurringReminderAt(
    '2028-01-31T15:00:00.000Z',
    'monthly',
    { timezone: 'UTC', localScheduledClockTime: '15:00', recurrenceAnchorDay: 31 },
    Date.parse('2028-01-31T15:01:00.000Z')
  );
  assert.equal(next, '2028-02-29T15:00:00.000Z');
});

test('daily recurrence preserves local wall-clock time across DST', () => {
  const next = getNextRecurringReminderAt(
    '2026-03-08T07:30:00.000Z',
    'daily',
    { timezone: 'America/Chicago', localScheduledClockTime: '01:30' },
    Date.parse('2026-03-08T07:31:00.000Z')
  );
  const parts = getZonedParts(new Date(next), 'America/Chicago');
  assert.equal(parts.hour, 1);
  assert.equal(parts.minute, 30);
  assert.equal(parts.day, 9);
});

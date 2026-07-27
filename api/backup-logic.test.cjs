'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  durationToSeconds,
  databaseResourceFromSchedule,
  scheduleIsDaily,
  successfulBackupForDatabase,
  sanitizeBackupError
} = require('./_backup-logic');

test('Google Duration retention is normalized to seconds', () => {
  assert.equal(durationToSeconds('2592000s'), 2592000);
  assert.equal(durationToSeconds('30d'), 2592000);
  assert.equal(durationToSeconds('604800.5s'), 604800.5);
});

test('schedule database parser extracts exact database and never assumes a fallback', () => {
  assert.equal(databaseResourceFromSchedule({ name:'projects/p1/databases/(default)/backupSchedules/s1' }), 'projects/p1/databases/(default)');
  assert.equal(databaseResourceFromSchedule({ name:'unexpected-resource' }), '');
});

test('daily recurrence is recognized only from explicit recurrence data', () => {
  assert.equal(scheduleIsDaily({ dailyRecurrence:{} }), true);
  assert.equal(scheduleIsDaily({ recurrence:'DAILY' }), true);
  assert.equal(scheduleIsDaily({ name:'daily-looking-name' }), false);
});

test('successful backup requires exact database and READY state', () => {
  const result = successfulBackupForDatabase([
    { database:'projects/p1/databases/other', state:'READY', snapshotTime:'2026-07-27T00:00:00Z' },
    { database:'projects/p1/databases/(default)', state:'CREATING', snapshotTime:'2026-07-28T00:00:00Z' },
    { database:'projects/p1/databases/(default)', state:'READY', snapshotTime:'2026-07-26T00:00:00Z' }
  ], 'projects/p1/databases/(default)');
  assert.equal(result.snapshotTime, '2026-07-26T00:00:00Z');
});

test('backup errors redact credential-like values', () => {
  const safe = sanitizeBackupError('authorization=secret-token private_key=abc Bearer very-secret-value');
  assert.doesNotMatch(safe, /secret-token|very-secret-value|private_key=abc/);
});

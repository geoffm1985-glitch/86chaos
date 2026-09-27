'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'firestore-backup-watchdog.js'), 'utf8');

test('native backup watchdog bounds Google Admin API I/O and pagination', () => {
  assert.match(source, /DEFAULT_ADMIN_API_TIMEOUT_MS\s*=\s*8000/);
  assert.match(source, /BACKUP_WATCHDOG_ADMIN_API_TIMEOUT_MS/);
  assert.match(source, /AbortController/);
  assert.match(source, /signal:\s*controller\.signal/);
  assert.match(source, /admin_api_timeout/);
  assert.match(source, /DEFAULT_ADMIN_API_MAX_PAGES\s*=\s*10/);
  assert.match(source, /BACKUP_WATCHDOG_ADMIN_API_MAX_PAGES/);
  assert.match(source, /pagination exceeded the safe limit/);
  assert.match(source, /admin_api_pagination_limit/);
});

test('native backup watchdog surfaces bounded-work observability without exposing credentials', () => {
  assert.match(source, /lastWatchdogDurationMs/);
  assert.match(source, /nativeBackupAdminApiTimeoutMs/);
  assert.match(source, /nativeBackupAdminApiMaxPages/);
  const errorResponse = source.slice(source.indexOf('return res.status(code).json'));
  assert.doesNotMatch(errorResponse, /access_token|accessToken|privateKey|private_key/);
});

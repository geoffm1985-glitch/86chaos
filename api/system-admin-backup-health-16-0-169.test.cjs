'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('System Administrator backup status is loaded through server route instead of browser Firestore', () => {
  const management = read('src/features/management.jsx');
  assert.doesNotMatch(management, /listenDoc\('backupStatus'/, 'backupStatus browser listener must be removed');
  assert.doesNotMatch(management, /getDoc\(doc\(db,\s*'system',\s*'backupStatus'\)\)/, 'refreshHealthDashboard must not read backupStatus through client Firestore');
  assert.match(management, /backupResult\.backupStatus/, 'Health dashboard consumes backupStatus from list-backups response');
  assert.match(management, /setBackupStatus\(result\.backupStatus\)/, 'backup list loader applies server backupStatus');
});

test('list-backups returns a sanitized server-side backupStatus subset', () => {
  const source = read('api/list-backups.js');
  assert.match(source, /function safeBackupStatus/);
  assert.match(source, /collection\('system'\)\.doc\('backupStatus'\)\.get\(\)/);
  assert.match(source, /backupStatus/);
  for (const forbidden of ['privateKey', 'serviceAccount', 'credentials', 'accessToken', 'refreshToken', 'authorization', 'cronSecret']) {
    const safeBody = source.slice(source.indexOf('function safeBackupStatus'), source.indexOf('async function readSafeBackupStatus'));
    assert.equal(safeBody.includes(`'${forbidden}'`) || safeBody.includes(`"${forbidden}"`), false, `${forbidden} must not be in allowed backupStatus fields`);
  }
});

test('watchdog preserves native Admin API architecture and maps 403 to precise IAM diagnostics', () => {
  const source = read('api/firestore-backup-watchdog.js');
  assert.match(source, /backupSchedules/);
  assert.match(source, /locations\/\-\/backups/);
  assert.doesNotMatch(source, /\/api\/firestore-backup['"`]/, 'watchdog must not trigger custom JSON backup route');
  assert.match(source, /datastore\.backupSchedules\.list/);
  assert.match(source, /datastore\.backups\.list/);
  assert.match(source, /roles\/datastore\.backupSchedulesViewer/);
  assert.match(source, /roles\/datastore\.backupsViewer/);
  assert.match(source, /errorCategory:[\s\S]*permission_denied/);
  const returnPayload = source.slice(source.indexOf('return res.status(code).json'));
  assert.doesNotMatch(returnPayload, /access_token|accessToken|privateKey|private_key/, 'error response must not expose tokens or private keys');
});

test('health-checks uses server Admin Firestore read for latency diagnostics', () => {
  const source = read('api/health-checks.js');
  assert.match(source, /collection\('system'\)\.doc\('backupStatus'\)\.get\(\)/);
  assert.match(source, /firestoreLatencyMs/);
  assert.match(source, /firestoreReadOk/);
});

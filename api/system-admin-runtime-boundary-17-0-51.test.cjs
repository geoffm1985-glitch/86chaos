
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const safety = require('../src/core/systemAdminDataSafety.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.51 System Administrator live listeners use safe normalizers before state update', () => {
  const source = read('src/features/management.jsx');
  assert.match(source, /mapDocs\('restaurantAdminAlerts', normalizeSystemAdminAlert\)/);
  assert.match(source, /mapDocs\('superAdmins', normalizeSystemAdminUser\)/);
  assert.match(source, /normalizeSystemAdminStatusRecord\('restoreDrillStatus'/);
  assert.match(source, /normalizeSystemAdminStatusRecord\('operationsReview'/);
  assert.match(source, /adminSafeText\(restoreDrillStatus\?\.status/);
});

test('17.0.51 System Administrator boundary converts malformed directly-rendered fields to scalars', () => {
  const alert = safety.normalizeSystemAdminAlert('bad-live-alert', {
    title: { message: 'Alert title' }, type: { label: 'ops' }, status: { status: 'open' },
    restaurantName: { name: 'Workspace' }, detail: { error: 'Needs review' },
    updatedAt: { _seconds: 1785540560, _nanoseconds: 0 }
  });
  for (const field of ['title','type','status','restaurantName','detail','updatedAt']) assert.equal(typeof alert[field], 'string');
  const restore = safety.normalizeSystemAdminStatusRecord('restoreDrillStatus', 'restoreDrillStatus', { status: { label: 'passed' }, lastDrillAt: { _seconds: 1785540560 } });
  assert.equal(typeof restore.status, 'string');
  assert.equal(typeof restore.lastDrillAt, 'string');
});

test('17.0.51 Play Store regression explicitly rejects the System Administrator App Recovery state', () => {
  const browser = read('tests/86chaos-release-gate/64-system-admin-recovery-boundary-17-0-51.spec.cjs');
  assert.match(browser, /APP RECOVERY/);
  assert.match(browser, /This section hit a snag/);
  assert.match(browser, /gotoTab\(page, 'godmode'/);
});

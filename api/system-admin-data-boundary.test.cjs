'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const safety = require('../src/core/systemAdminDataSafety.cjs');

test('System Administrator pricing defaults survive missing or malformed pricing doc', () => {
  const prices = safety.normalizeTierPriceMap(null, safety.DEFAULT_TIER_PRICES);
  assert.equal(prices.smart_kitchen, 179);
  assert.equal(prices.owner_pro, 299);
  const malformed = safety.normalizeTierPriceMap({ smart_kitchen: { seconds: 1 }, owner_pro: '399' }, safety.DEFAULT_TIER_PRICES);
  assert.equal(malformed.smart_kitchen, 179);
  assert.equal(malformed.owner_pro, 399);
});

test('System Administrator safe text never returns raw Firestore objects as React children', () => {
  assert.equal(safety.adminSafeText({ seconds: 1785540560, nanoseconds: 0 }).startsWith('2026-'), true);
  assert.equal(typeof safety.adminSafeText({ nested: { ok: true } }), 'string');
  assert.notEqual(safety.adminSafeText({ nested: { ok: true } }), '[object Object]');
});

test('sanitized m1iJOS8qGXf1by5VPTx3-like crash shape normalizes without throwing', () => {
  const diagnostics = [];
  const crash = safety.normalizeCrashReport('m1iJOS8qGXf1by5VPTx3', {
    message: { error: 'Cannot read properties of undefined' },
    errorName: 'TypeError',
    rawStack: { message: 'at TabGodMode (/static/js/main.js:1:1)' },
    componentStack: { message: 'TabGodMode' },
    time: { seconds: 1785540560, nanoseconds: 0 },
    diagnostics: { field: { seconds: 1 } }
  }, diagnostics);
  assert.equal(crash.id, 'm1iJOS8qGXf1by5VPTx3');
  assert.equal(crash.errorName, 'TypeError');
  assert.equal(typeof crash.message, 'string');
  assert.equal(typeof crash.rawStack, 'string');
});

test('malformed audit log details normalize to strings', () => {
  const log = safety.normalizeAuditLog('audit-1', { action: 'BUG_REPORT_SUBMITTED', details: { target: 'crashReports/x' }, timestamp: { seconds: 1785540560 } });
  assert.equal(typeof log.details, 'string');
  assert.equal(typeof log.timestamp, 'string');
});

test('malformed restaurant record is sanitized, not thrown', () => {
  const diagnostics = [];
  const row = safety.normalizeRestaurantRecord('restaurant-1', { name: { bad: true }, lastActive: { seconds: 1785540560 } }, diagnostics);
  assert.equal(typeof row.name, 'string');
  assert.equal(typeof row.lastActive, 'string');
});


test('Admin SDK timestamp JSON and System Administrator live status records normalize before React render', () => {
  const adminTimestamp = { _seconds: 1785540560, _nanoseconds: 125000000 };
  assert.equal(safety.adminSafeText(adminTimestamp).startsWith('2026-'), true);
  const restore = safety.normalizeSystemAdminStatusRecord('restoreDrillStatus', 'restoreDrillStatus', {
    status: { label: 'passed' },
    restoreProjectId: { id: 'demo-restore' },
    sourceBackupPath: { message: 'gs://safe-backup' },
    lastDrillAt: adminTimestamp
  });
  assert.equal(typeof restore.status, 'string');
  assert.equal(typeof restore.restoreProjectId, 'string');
  assert.equal(typeof restore.sourceBackupPath, 'string');
  assert.equal(typeof restore.lastDrillAt, 'string');
});

test('restaurant admin alerts cannot pass raw object fields into System Administrator React children', () => {
  const alert = safety.normalizeSystemAdminAlert('alert-1', {
    title: { message: 'Review inventory' },
    type: { label: 'inventory' },
    status: { status: 'open' },
    restaurantName: { name: 'Cheers' },
    detail: { message: 'Check count variance' },
    updatedAt: { _seconds: 1785540560, _nanoseconds: 0 }
  });
  for (const field of ['title', 'type', 'status', 'restaurantName', 'detail', 'updatedAt']) assert.equal(typeof alert[field], 'string', field);
});

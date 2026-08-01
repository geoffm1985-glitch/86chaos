'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const runtimeReportState = require('../src/core/runtimeReportState.cjs');
const adminSafety = require('../src/core/systemAdminDataSafety.cjs');

test('runtime report helper exports callable functions used by App error boundary', () => {
  for (const name of [
    'createFallbackReportId',
    'buildRuntimeReportFingerprint',
    'beginReportSubmission',
    'completeReportSubmission',
    'failReportSubmission',
    'createRuntimeDiagnostic',
    'rememberLocalRuntimeDiagnostic',
    'normalizeReportId'
  ]) {
    assert.equal(typeof runtimeReportState[name], 'function', `${name} should be callable`);
  }
  const fallbackId = runtimeReportState.createFallbackReportId('section');
  assert.match(fallbackId, /^section_/);
});

test('System Administrator data safety helper exports callable sanitizers', () => {
  for (const name of [
    'adminSafeText',
    'finiteNumber',
    'normalizeAuditLog',
    'normalizeCrashReport',
    'normalizeRestaurantRecord',
    'normalizeTierPriceMap',
    'safeDiagnostic'
  ]) {
    assert.equal(typeof adminSafety[name], 'function', `${name} should be callable`);
  }
  assert.equal(adminSafety.adminSafeText({ message: 'safe message' }), 'safe message');
});

test('browser source uses namespace interop and local fallbacks for CJS helpers', () => {
  const appSource = fs.readFileSync('src/App.js', 'utf8');
  const managementSource = fs.readFileSync('src/features/management.jsx', 'utf8');
  assert.match(appSource, /import \* as runtimeReportStateModule from ['"]\.\/core\/runtimeReportState\.cjs['"]/);
  assert.match(appSource, /typeof runtimeReportState\.createFallbackReportId === 'function'/);
  assert.match(appSource, /fallbackReportIdFactory/);
  assert.match(managementSource, /import \* as adminSafetyModule from ['"]\.\.\/core\/systemAdminDataSafety\.cjs['"]/);
  assert.match(managementSource, /typeof adminSafety\.adminSafeText === 'function'/);
  assert.match(managementSource, /fallbackAdminSafeText/);
});

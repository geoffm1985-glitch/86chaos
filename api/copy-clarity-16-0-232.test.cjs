'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('inventory ordering copy describes suggestions, drafts, and manager review', () => {
  const source = read('src/features/inventory.jsx');
  for (const removed of ['Python Intelligence Layer', 'Run Python Forecast', 'Apply Selected to Draft', 'No order pressure detected.']) {
    assert.equal(source.includes(removed), false, `active inventory copy must not include: ${removed}`);
  }
  assert.match(source, /Order Suggestions/);
  assert.match(source, /Run Order Forecast/);
  assert.match(source, /Add Selected to Order Draft/);
  assert.match(source, /Nothing needs ordering right now/);
  assert.match(source, /Nothing is ordered until a manager reviews the draft and sends it/);
});

test('ordinary recovery and sign-in copy avoids implementation terminology', () => {
  const app = read('src/App.js');
  const auth = read('src/features/auth.jsx');
  assert.equal(app.includes('A stale app chunk failed to load'), false);
  assert.match(app, /Refresh App/);
  assert.equal(auth.includes('Save & Enter OS'), false);
  assert.match(auth, /Save Password & Sign In/);
});

test('schedule actions state their outcome while stable accessibility hooks remain', () => {
  const source = read('src/features/schedule.jsx');
  assert.match(source, /Open Schedule Tools/);
  assert.match(source, /Fill Coverage Gaps/);
  assert.match(source, /t\('builder\.reviewPublish'\)/);
  assert.match(source, /t\('builder\.copyMonth'\)/);
  assert.match(source, /aria-label="Open Copilot Tools"/);
  assert.match(source, /aria-label="Smart Fill"/);
  assert.ok(source.includes("aria-label={t('builder.copyMonth')}"));
});

test('manager and kitchen screens lead with restaurant language', () => {
  const operations = read('src/features/operations.jsx');
  const intelligence = read('src/features/intelligence.jsx');
  const management = read('src/features/management.jsx');
  assert.match(operations, /Restaurant Check/);
  assert.match(operations, /Menu Items Affected/);
  assert.match(intelligence, /Kitchen Tools/);
  assert.match(management, /Restaurant Check Follow-up/);
  assert.match(management, /Schedule Integrity Audit \(Read Only\)/);
  assert.match(management, /No schedule data will be changed/);
});

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');

test('failed-current manifest contains only the three latest mobile Request Off failures', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/reported-failed-only-20260809-004632.json'), 'utf8'));
  const rows = manifest.selected || [];
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(row => row.project === 'chromium').length, 0);
  assert.equal(rows.filter(row => row.project === 'mobile-chromium').length, 3);
  const expected = new Set([
    'Request Off employee filter narrows and clears manager-visible requests',
    'Approve All Visible updates only filtered visible pending requests',
    'Archive All Visible archives only filtered visible eligible requests',
  ]);
  assert.deepEqual(new Set(rows.map(row => row.leafTitle)), expected);
  assert.ok(rows.every(row => row.selectionReasons?.includes('uploaded_latest_failed_report_failure')));
});

test('compact mobile inputs with leading icons reserve placeholder space', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /16\.0\.162 targeted mobile polish/);
  assert.match(css, /svg\.absolute \+ input/);
  assert.match(css, /padding-left:\s*2\.75rem\s*!important/);
});

test('System Administrator light cards remap slate-50 through slate-200 text to readable ink', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  assert.match(css, /16\.0\.162 targeted System Administrator mobile readability repair/);
  assert.match(css, /text-slate-50/);
  assert.match(css, /text-slate-100/);
  assert.match(css, /text-slate-200/);
});

test('Firestore persistence is guarded for multi-tab PWA/browser sessions', () => {
  const appCore = fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');
  assert.match(appCore, /enableMultiTabIndexedDbPersistence/);
  assert.match(appCore, /__chaosFirestorePersistenceInit/);
  assert.match(appCore, /Offline persistence unavailable in this browser session/);
});

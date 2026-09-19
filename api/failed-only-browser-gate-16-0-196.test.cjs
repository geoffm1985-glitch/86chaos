const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('Document Vault source evidence uses explicit restaurant scoped path guard', () => {
  const source = read('src/features/management.jsx');
  assert.match(source, /isValidVaultStoragePath/);
  assert.match(source, /pathValue\.startsWith\(`restaurants\/\$\{rid\}\/back-office\/document-vault\/\$\{recordId\}\//);
  assert.match(source, /Replacement Blocked|Download Blocked/);
});

test('exhaustive state discovery accepts current Open-prefixed controls and waits for nested surfaces', () => {
  const source = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(source, /stripOpenPrefix\s*=/);
  assert.match(source, /async function waitForStateControl/);
  assert.match(source, /STATE_INTERACTIVE_SELECTOR/);
  assert.match(source, /stateControlIndexes/);
  assert.match(source, /Open\\s\+/);
});

test('mutation actionability probing uses stable descriptors instead of live nth indexes', () => {
  const source = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  const fn = source.slice(source.indexOf('async function probeMutationActionability'), source.indexOf('async function auditState'));
  assert.match(fn, /collectControls\(page\)/);
  assert.match(fn, /locatorFromDescriptor\(page, row\)/);
  assert.doesNotMatch(fn, /buttons\.nth\(i\)/);
  assert.match(fn, /mutation-actionability-deferred-after-ui-overlay-or-dom-change/);
});


test('bundled latest failed-only fallback narrows the next browser run to seven remaining failures', () => {
  const manifest = JSON.parse(read('scripts/86chaos-release-gate/reported-failed-only-20260824-002634.json'));
  assert.equal(manifest.totalSelected, 7);
  assert.equal(manifest.desktopSelected, 4);
  assert.equal(manifest.mobileSelected, 3);
  assert.equal(manifest.previousFailuresSelected, 7);
  assert.equal(manifest.previousTimeoutsSelected, 0);
  assert.equal(manifest.selected.some(row => /schedule-request-off-management/.test(row.specPath || row.spec || '')), false);
  assert.equal(manifest.selected.every(row => String(row.priorStatus || '').toLowerCase() === 'failed'), true);
});

test('failed-only manifest recovery can prefer the 20260824 seven-failure fallback', () => {
  const source = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  assert.match(source, /loadBundledCurrentFailedOnlyFallback/);
  assert.match(source, /reported-failed-only-20260824-002634\.json/);
  assert.match(source, /bundled-latest-failed-only-20260824-002634-fail-only/);
});

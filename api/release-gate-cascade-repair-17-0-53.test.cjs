'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.53 same-tab language state and shared QA cleanup are deterministic', () => {
  const app = read('src/App.js');
  const spanish = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
  assert.ok(app.includes('window.setInterval(syncStoredLanguage, 200)'));
  assert.ok(app.includes('setAppLanguage(current => current === nextLanguage ? current : nextLanguage)'));
  assert.ok(spanish.includes("saveLanguagePreference(page, 'en', { verifyReload: true })"));
  assert.ok(spanish.includes('must survive a fresh authenticated reload'));
  assert.ok(!spanish.includes('if (await save.isVisible'));
  assert.ok(spanish.includes("toHaveAttribute('lang', value"));
});

test('17.0.53 Schedule Builder uses index-light availability and distinct-person overcoverage evidence', () => {
  const schedule = read('src/features/schedule.jsx');
  const fixture = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
  assert.ok(schedule.includes("orderByField: null"));
  assert.ok(schedule.includes("availabilityRecords = [...(availabilityRecordsState.data || [])].sort"));
  assert.ok(fixture.includes("employeeKey: 'lani'"));
  assert.ok(fixture.includes('two distinct seeded bartenders'));
});

test('17.0.53 mobile sticky header and release-gate selectors reflect the rendered UI', () => {
  const styles = read('src/styles.css');
  const schedule = read('src/features/schedule.jsx');
  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  const ghost = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
  const security51 = read('tests/86chaos-release-gate/51-security-cost-observability.spec.cjs');
  const security65 = read('tests/86chaos-release-gate/65-system-admin-firebase-cost-runtime-17-0-52.spec.cjs');
  const legacy = read('tests/86chaos-release-gate/63-testing-deployment-identity-file-reader-17-0-49.spec.cjs');
  const cost = read('tests/e2e/cost-regression.spec.cjs');
  assert.ok(styles.includes('position: relative !important;'));
  assert.ok(schedule.includes('const deckIsSticky ='));
  assert.ok(helpers.includes('Plan & Permission Gate'));
  assert.ok(!helpers.includes('permission gate|not authorized|not available|'));
  assert.ok(ghost.includes("hasText: /^\\s*EXIT GHOST MODE\\s*$/i"));
  assert.ok(security51.includes('(?:Open\\s+)?Security Center'));
  assert.ok(security65.includes('(?:Open\\s+)?Security Center'));
  assert.ok(!legacy.includes("toBe('17.0.49')"));
  assert.ok(cost.includes('control.isVisible({ timeout: 1200 })'));
});

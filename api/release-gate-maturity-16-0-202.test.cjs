'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('16.0.202 presence expected timeout is fail-soft and non-5xx without adding polling', () => {
  const api = read('api/presence-workspace-summary.js');
  const app = read('src/App.js');
  assert.match(api, /PRESENCE_SUMMARY_TIMEOUT_MS/);
  assert.match(api, /withTimeout\(ctx\.app\.database\(\)\.ref\(`statusSummary/);
  assert.match(api, /err\?\.code === 'presence-summary-timeout'/);
  assert.match(api, /res\.status\(200\)\.json\(\{/);
  assert.match(api, /degraded: true/);
  assert.match(api, /retryable: true/);
  assert.doesNotMatch(api, /presence-summary-timeout' \? 504 : 500/);
  assert.equal((app.match(/presence-workspace-summary/g) || []).length, 1, 'client still makes only one presence-summary fetch site');
  assert.match(app, /keeping last-known-good summary/);
});

test('16.0.202 Back Office tabs have valid tablist semantics and tests target tab role', () => {
  const management = read('src/features/management.jsx');
  const vaultSpec = read('tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs');
  assert.match(management, /role="tablist"/);
  assert.match(management, /aria-label="Back Office sections"/);
  assert.match(management, /role="tab" aria-label=\{label\}/);
  assert.match(management, /\["documents","Document Vault"\]/);
  assert.match(management, /\["quickbooks","QuickBooks"\]/);
  assert.ok(vaultSpec.includes("page.getByRole('tab', { name: /^Document Vault$/i }).first()"));
  assert.doesNotMatch(vaultSpec, /getByRole\('button', \{ name: \/\^\(\?:Open \)\?Document Vault/);
});

test('16.0.202 route settle and form reconstruction are deterministic rather than broad or hidden', () => {
  const audit = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  const exhaustive = read('tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');
  assert.match(audit, /renderedRouteIdentityReady/);
  assert.match(audit, /'back-office': \[\/\^Back Office Suite\$\/i, \/\^Back Office Guardrails\$\/i\]/);
  assert.doesNotMatch(audit, /Back Office\|QuickBooks\|Owner\|Accountant\|Records/);
  assert.match(exhaustive, /`\$\{parts\.join\(''\)\}:visible`/);
  assert.match(exhaustive, /module\.exports = \{[\s\S]*formControlSelectorFor[\s\S]*locatorFromFormDescriptor/);
});

test('16.0.202 schedule readiness and responsive matrix retain coverage in bounded shards', () => {
  const schedule = read('tests/86chaos-full-audit/04-schedule-math-oracle.spec.cjs');
  const responsive = read('tests/86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs');
  assert.match(schedule, /waitForScheduleSeedLabels|timeout: 45000/);
  assert.match(schedule, /Schedule Builder should hydrate current-run QA staff\/events/);
  for (const vp of ['narrow-phone','phone','tablet','laptop','desktop']) assert.match(responsive, new RegExp(`name:'${vp}'`));
  assert.match(responsive, /for \(const vp of VIEWPORTS\)/);
  assert.match(responsive, /test\.setTimeout\(35\*60\*1000\)/);
  assert.match(responsive, /auditViewport\(browser, vp, testInfo\)/);
});

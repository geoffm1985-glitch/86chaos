'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const inv = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');

test('schema v3 keeps repeated leaf titles under different describes separate', () => {
  const output = [
    '[chromium] › tests/e2e/authenticated-release.spec.cjs:10:5 › system-admin › opens every permitted primary surface without fatal errors',
    '[chromium] › tests/e2e/authenticated-release.spec.cjs:20:5 › staff › opens every permitted primary surface without fatal errors'
  ].join('\n');
  const records = inv.parsePlaywrightListOutput(output, process.cwd());
  assert.equal(records.length, 2);
  assert.notEqual(records[0].stableKey, records[1].stableKey);
  assert.deepEqual(records.map(r => r.fullSuitePath).sort(), ['staff', 'system-admin']);
});

test('schema v3 records actual expanded dynamic titles from Playwright discovery', () => {
  const output = '[mobile-chromium] › tests/e2e/layout.spec.cjs:3:1 › compact layout › does not create body-level horizontal overflow at 390x844';
  const [record] = inv.parsePlaywrightListOutput(output, process.cwd());
  assert.equal(record.leafTitle, 'does not create body-level horizontal overflow at 390x844');
  assert.ok(!record.leafTitle.includes('${'));
});

test('project applicability does not invent mobile V8 coverage', () => {
  assert.deepEqual(inv.projectsForSpec('tests/e2e/runtime-code-coverage.spec.cjs'), ['chromium']);
});

test('duplicate stable identities fail validation', () => {
  const output = [
    '[chromium] › tests/a.spec.cjs:1:1 › role › same title',
    '[chromium] › tests/a.spec.cjs:2:1 › role › same title'
  ].join('\n');
  assert.throws(() => inv.parsePlaywrightListOutput(output, process.cwd()), /duplicate/i);
});

test('inventory fails closed when shared registration hides test declarations', () => {
  const hidden = '[chromium] › fixtures/testing-promotion-scenarios.cjs:6:3 › promoted identity';
  assert.throws(() => inv.parsePlaywrightListOutput(hidden + '\nTotal: 1 test in 1 file'), /omitted 1 test declarations/);
  assert.throws(() => inv.parsePlaywrightListOutput(hidden), /omitted 1 test declarations/);
});

test('inventory compares discovered declarations against Playwright totals', () => {
  const line = '[chromium] › e2e/promotion.spec.cjs:1:1 › promoted identity';
  assert.equal(inv.parsePlaywrightListOutput(line + '\nTotal: 1 test in 1 file').length, 1);
  assert.throws(() => inv.parsePlaywrightListOutput(line + '\nTotal: 2 tests in 1 file'), /count mismatch/);
  assert.throws(() => inv.parsePlaywrightListOutput('Total: 1 test in 1 file'), /count mismatch/);
  assert.throws(() => inv.parsePlaywrightListOutput(line + '\nTotal: 1 test in 1 file\nTotal: 1 test in 1 file'), /count mismatch/);
});

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const { RELEASE_TEST_MATCH, RELEASE_CRITICAL_SPECS, specIsInReleaseUniverse } = require('../scripts/86chaos-release-gate/release-test-universe.cjs');

test('full release universe includes e2e and critical release specs', () => {
  assert.ok(RELEASE_TEST_MATCH.includes('e2e/**/*.spec.cjs'));
  for (const spec of RELEASE_CRITICAL_SPECS) assert.equal(specIsInReleaseUniverse(spec), true, `${spec} must be in the release universe`);
});

test('release inventory discovery uses side-effect-free inventory config', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'playwright.inventory.config.cjs'), 'utf8');
  assert.match(source, /RELEASE_TEST_MATCH/);
  assert.doesNotMatch(source, /generatePlaywrightInventory/);
  assert.doesNotMatch(source, /globalSetup/);
  assert.doesNotMatch(source, /globalTeardown/);
});

test('real Playwright list discovery does not recurse when Playwright is installed', { skip: !fs.existsSync(path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js')) }, () => {
  const cli = path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
  const result = childProcess.spawnSync(process.execPath, [cli, 'test', '--config=playwright.inventory.config.cjs', '--list'], {
    cwd: process.cwd(),
    env: { ...process.env, CHAOS_INVENTORY_DISCOVERY: '1' },
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `Playwright list should exit 0. stderr=${String(result.stderr || '').slice(-1000)}`);
  const parsed = inv.parsePlaywrightListOutput(`${result.stdout}\n${result.stderr}`, process.cwd());
  assert.ok(parsed.length > 0, 'inventory contains discovered tests');
  assert.equal(inv.titleContainsTemplate(parsed).length, 0, 'no ${...} titles');
  assert.equal(inv.validateInventoryRecords(parsed).duplicateIdentityCount, 0, 'no duplicate stable identities');
  const promotionSpecs = ['e2e/testing-promotion-19.spec.cjs', '86chaos-release-gate/107-testing-promotion-19.spec.cjs'];
  const promotion = parsed.filter(row => promotionSpecs.includes(row.specPath));
  assert.equal(promotion.length, 16, 'all four promotion cases in both specs and both browser projects must be discovered');
  for (const spec of promotionSpecs) for (const project of ['chromium', 'mobile-chromium']) {
    assert.equal(promotion.filter(row => row.specPath === spec && row.project === project).length, 4, `${spec}/${project}`);
  }
  const phaseSpecs=['e2e/schedule-builder-phase1-19.spec.cjs','86chaos-release-gate/108-schedule-builder-phase1-19.spec.cjs'];
  const phase=parsed.filter(row=>phaseSpecs.includes(row.specPath));
  assert.equal(phase.filter(row=>row.leafTitle.startsWith('Phase 1 ')).length,84,'all original seven Phase 1 workflows in both wrappers and six browser projects remain discovered');
  assert.equal(phase.filter(row=>row.leafTitle==='Local emulator reload acknowledges listener removal and restores authoritative scheduling').length,12,'both new local lifecycle wrappers cover all six browser projects');
  assert.equal(phase.length,96,'original workflows and new lifecycle contracts are all discovered');
  for(const spec of phaseSpecs)for(const project of ['chromium','mobile-chromium','edge-pwa','firefox-pwa','webkit-pwa','mobile-webkit-pwa'])assert.equal(phase.filter(row=>row.specPath===spec && row.project===project).length,8,`${spec}/${project}`);
});

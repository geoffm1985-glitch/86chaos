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
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('17.0.18 pre-Playwright phase contains only bounded source readiness checks and heavy certification groups run post-Playwright', () => {
  const runner = read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
  const pre = runner.match(/const preCommands = \[([\s\S]*?)\];/);
  const post = runner.match(/const postCommands = \[([\s\S]*?)\];/);
  assert.ok(pre && post, 'release-check runner must define explicit pre and post phases');
  for (const required of ['source validator', 'api syntax', 'python syntax']) assert.match(pre[1], new RegExp(required));
  for (const forbidden of ['hostile certification', 'POS Bridge Firestore', 'schedule publication', 'recovery drill', 'scale and completeness', 'server tests', 'client tests', 'production build']) {
    assert.doesNotMatch(pre[1], new RegExp(forbidden), `${forbidden} must not block Playwright startup`);
  }
  for (const required of ['hostile certification', 'POS Bridge Firestore', 'schedule publication', 'recovery drill', 'scale and completeness', 'server tests', 'client tests', 'production build']) {
    assert.match(post[1], new RegExp(required), `${required} must remain mandatory post-Playwright evidence`);
  }
  assert.match(runner, /phase === 'post'.*writeJavaPreflight/s);
  assert.match(runner, /complete canonical firestore\/storage emulator rules tests/);
  assert.match(runner, /tailLimit: 512 \* 1024/);
});

test('17.0.18 main Playwright universe owns mobile voice layout and schedule publish no longer starts a second Playwright process', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  assert.equal(universe.specIsInReleaseUniverse('tests/layout/mobile-voice-17-0-5.spec.cjs'), true);
  assert.doesNotMatch(pkg.scripts['test:schedule-publish'], /playwright|test:mobile-voice-layout/i);
  assert.match(pkg.scripts['test:schedule-publish'], /schedule-publish-17-0-0\.test\.cjs/);
  const config = read('playwright.play-store-release.config.cjs');
  assert.match(config, /layout/);
  assert.match(config, /mobile-chromium[\s\S]*testIgnore:[^\n]*layout/);
  const inventoryConfig = read('playwright.inventory.config.cjs');
  assert.match(inventoryConfig, /mobile-chromium[\s\S]*testIgnore:[^\n]*layout/);
  const inventory = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');
  assert.deepEqual(inventory.projectsForSpec('layout/mobile-voice-17-0-5.spec.cjs'), ['chromium']);
});

test('17.0.18 historical release-gate execution assertion follows current package version instead of hardcoding 17.0.11', () => {
  const historical = read('api/release-gate-execution-17-0-5.test.cjs');
  assert.doesNotMatch(historical, /17\\\.0\\\.11 source validation passed/);
  assert.match(historical, /local\.version/);
  assert.match(historical, /source validation passed/);
});

test('17.0.18 full gate starts Playwright before post-Playwright certification checks and preserves accurate zero-test semantics', () => {
  const gate = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const pre = gate.indexOf('run-node-release-checks.cjs --phase pre');
  const playwright = gate.indexOf('Run-LiveStep "Playwright release gate"');
  const post = gate.indexOf('run-node-release-checks.cjs --phase post');
  assert.ok(pre > 0 && playwright > pre && post > playwright, `expected pre -> Playwright -> post ordering, got ${pre}/${playwright}/${post}`);
  assert.match(gate, /playwrightStarted = \$true/);
  assert.match(gate, /blockedBeforeTestExecution = \$true/);
  assert.match(gate, /blockingReason.*playwrightStarted -ne \$true/);
  assert.doesNotMatch(gate.slice(pre, playwright), /Java prerequisite/);
});

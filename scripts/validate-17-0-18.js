#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-18.js');
assert.equal(pkg.version, '17.0.18');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.releaseTitle, 'Release Gate Baseline Restoration and Playwright Start Repair');
for (const file of ['src/core/appCore.js', 'api/_version.js', 'api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.18'"));
for (const directory of ['src', 'api', 'scripts', 'test-tools', 'tests']) assert(fs.statSync(directory).isDirectory(), `${directory} is required`);
for (const file of ['firebase.json', 'vercel.json', 'firestore.rules', 'storage.rules', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1', 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1', 'RELEASE_TEST_POLICY.md', 'RELEASE_17_0_18.md', '.gitignore', 'release-source-manifest.json']) assert(fs.statSync(file).isFile(), `${file} is required`);
assert.equal(json('test-tools/certification/groups.json').release, pkg.version);
assert.equal(json('test-tools/regressions/registry.json').release, pkg.version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, pkg.version);

const updater = read('RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1');
assert(updater.includes("[string]$ExpectedVersion = '17.0.18'"));
assert(updater.includes("@('switch', 'testing')"));
assert(updater.includes("$env:GIT_PAGER = 'cat'"));
assert(updater.includes("$env:PAGER = 'cat'"));
assert(updater.includes('--no-pager'));
assert(updater.includes("$env:NODE_OPTIONS = '--max-old-space-size=4096'"));
assert(updater.includes("$env:GENERATE_SOURCEMAP = 'false'"));
assert(updater.includes("$env:CHAOS_RELEASE_CHECK_HEARTBEAT_MS = '15000'"));
assert(updater.includes("@('run', 'test:play-store')"));
assert(!/test:play-store:(?:failed|delta|repair)/.test(updater));

const installer = read('scripts/86chaos-release-workflow/install-app-only.cjs');
assert(installer.includes('recoverableIncompleteCheckout'));
assert(installer.includes('Refusing to overwrite meaningful pre-existing repository changes'));
assert(installer.includes('--untracked-files=normal'));
assert(!installer.includes('--untracked-files=all'));
assert(installer.includes('maxBuffer: 8 * 1024 * 1024'));

const runner = read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
assert(runner.includes('const preCommands = ['));
assert(runner.includes('const postCommands = ['));
assert(runner.includes("phase === 'pre'"));
assert(runner.includes("phase === 'post'"));
assert(runner.includes('tailLimit: 512 * 1024'));
assert(runner.includes('runStreamedCommand'));
assert(runner.includes('STILL RUNNING'));
assert(runner.includes('writeJavaPreflight'));
assert(runner.includes('complete canonical firestore/storage emulator rules tests'));
const preBlock = runner.match(/const preCommands = \[([\s\S]*?)\];/)[1];
for (const forbidden of ['hostile certification', 'POS Bridge Firestore', 'schedule publication', 'recovery drill', 'server tests', 'client tests', 'production build']) assert(!preBlock.includes(forbidden), `${forbidden} must not block Playwright startup`);

const gate = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const pre = gate.indexOf('run-node-release-checks.cjs --phase pre');
const playwright = gate.indexOf('Run-LiveStep "Playwright release gate"');
const post = gate.indexOf('run-node-release-checks.cjs --phase post');
assert(pre > 0 && playwright > pre && post > playwright);
assert(gate.includes('postPlaywrightChecksStarted'));
assert(gate.includes('postPlaywrightChecksPassed'));
assert(gate.includes("--timeout 21600"));
assert(gate.includes("run-observable-command.cjs --label 'Playwright release gate'"));
assert(gate.includes('TOTAL ELAPSED TIME:'));
assert(gate.lastIndexOf('TOTAL ELAPSED TIME:') > gate.lastIndexOf('Exported:'));

const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
assert(universe.includes("'layout/**/*.spec.cjs'"));
assert(!pkg.scripts['test:schedule-publish'].includes('playwright'));
const pwConfig = read('playwright.play-store-release.config.cjs');
assert(pwConfig.includes('layout'));
assert(read('playwright.inventory.config.cjs').includes('layout'));
assert(read('scripts/86chaos-release-gate/playwright-inventory.cjs').includes("return ['chromium']"));

const historical = read('api/release-gate-execution-17-0-5.test.cjs');
assert(!historical.includes('/17\\.0\\.11 source validation passed/'));
assert(historical.includes('local.version'));

assert(pkg.scripts['test:hostile:contracts'].includes('api/release-gate-playwright-start-17-0-18.test.cjs'));
assert(pkg.scripts['test:repair:17.0.18'].includes('api/release-gate-playwright-start-17-0-18.test.cjs'));
assert(pkg.scripts['test:repair:17.0.18'].includes('api/release-gate-failure-extractor.test.cjs'));
assert(pkg.scripts['test:release:fast'].includes('validate:17.0.18'));
assert(pkg.scripts['test:new-implementations'].includes('validate:17.0.18'));
assert(json('test-tools/regressions/registry.json').defects.some(row => row.defectId === 'RG-PLAYWRIGHT-START-BASELINE-RESTORATION-1718' && row.fixedVersion === '17.0.18'));

const safetyScript = read('scripts/verify-repository-safety.cjs');
assert(safetyScript.includes("allowedTrackedExclusions=new Set(['release-source-manifest.json'])"));

console.log('17.0.18 source validation passed; this does not certify the release.');

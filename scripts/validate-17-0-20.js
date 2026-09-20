#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { validateCurrentReleaseMetadata } = require('./86chaos-release-gate/current-release-metadata.cjs');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const expected = '17.0.20';
const releaseTitle = 'Bounded Actionable Failure Evidence Repair';

assert.equal(pkg.version, expected);
assert.equal(lock.version, expected);
assert.equal(lock.packages[''].version, expected);
assert.equal(version.version, expected);
assert.equal(version.build, expected);
assert.equal(version.releaseTitle, releaseTitle);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-20.js');
for (const file of ['src/core/appCore.js', 'api/_version.js', 'api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.20'"), `${file} current release metadata`);
for (const directory of ['src', 'api', 'scripts', 'test-tools', 'tests']) assert(fs.statSync(directory).isDirectory(), `${directory} is required`);
for (const file of ['firebase.json', 'vercel.json', 'firestore.rules', 'storage.rules', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1', 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1', 'RELEASE_TEST_POLICY.md', 'RELEASE_17_0_20.md', '.gitignore', 'release-source-manifest.json']) assert(fs.statSync(file).isFile(), `${file} is required`);
assert.equal(json('test-tools/certification/groups.json').release, expected);
assert.equal(json('test-tools/regressions/registry.json').release, expected);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, expected);
const metadata = validateCurrentReleaseMetadata(process.cwd());
assert.equal(metadata.ok, true, metadata.errors.join('\n'));

const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
assert(collector.includes("'playwright-test-inventory.json'"));
assert(collector.includes('fullUniverseValidation'));
assert(collector.includes('fullMissingExecutions'));
assert(collector.includes('fullExtraExecutions'));
assert(collector.includes("['failed', 'cancelled', 'blocked', 'timedOut', 'interrupted']"));
assert(collector.includes('normalizePlaywrightResults'));
assert(collector.includes('attemptsTotal'));
assert(collector.includes('retryAttemptHistory'));
assert(collector.includes("if (require.main === module) process.exitCode = summary.ok ? 0 : 1;"));

const normalizer = read('scripts/86chaos-release-gate/playwright-result-normalizer.cjs');
assert(normalizer.includes('attemptCount'));
assert(normalizer.includes('flaky'));
assert(normalizer.includes('duplicateExecutions'));

const inventory = read('scripts/86chaos-release-gate/playwright-inventory.cjs');
assert(inventory.includes('findFocusedTestDeclarations'));
assert(inventory.includes('Focused Playwright declarations are forbidden in release mode'));
assert.equal(json('test-tools/certification/groups.json').groups['hostile-contracts'].mandatory, true);
for (const config of ['playwright.play-store-release.config.cjs', 'playwright.inventory.config.cjs', 'playwright.failed-release.config.cjs']) {
  assert.match(read(config), /forbidOnly:\s*true/);
}

const failureExtractor = read('scripts/86chaos-release-gate/failure-extractor.cjs');
const streamed = read('scripts/86chaos-release-gate/streamed-command-runner.cjs');
assert(failureExtractor.includes('createActionableFailureCapture'));
assert(streamed.includes('failureCapture.feed'));
assert(streamed.includes('failureEvidence: failureCapture.finish()'));
assert(streamed.includes('512 * 1024'));

const gate = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const pre = gate.indexOf('run-node-release-checks.cjs --phase pre');
const playwright = gate.indexOf('Run-LiveStep "Playwright release gate"');
const post = gate.indexOf('run-node-release-checks.cjs --phase post');
assert(pre > 0 && playwright > pre && post > playwright, 'full gate order must remain readiness -> Playwright -> heavy certification');
assert(gate.includes('$CollectorExit = Run-CollectorStep'));
assert(gate.includes('$CollectorVerdictValid'));
assert(gate.includes("Collector summary is malformed because the required ok verdict is missing."));
assert(gate.includes('$RunnerState.finalExitCode'));
assert(gate.includes('Release gate passed.'));
assert(gate.lastIndexOf('TOTAL ELAPSED TIME:') > gate.lastIndexOf('Exported:'));

const updater = read('RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1');
assert(updater.includes("[string]$ExpectedVersion = '17.0.20'"));
assert(updater.includes('$script:SameVersionResume'));
assert(updater.includes('$script:ResumeExistingCommit'));
assert(updater.includes('Verified clean already-committed'));
assert(updater.includes('Empty commit will not be created'));
assert(updater.includes('origin/testing already points to'));
assert(updater.includes('merge-base --is-ancestor'));
assert(updater.includes("$env:GIT_PAGER = 'cat'"));
assert(updater.includes("$env:PAGER = 'cat'"));
assert(updater.includes('git --no-pager'));
assert(updater.includes("@('run', 'test:play-store')"));
assert(!/test:play-store:(?:failed|delta|repair)/.test(updater));

assert(!pkg.scripts['test:schedule-publish'].match(/playwright|test:mobile-voice-layout/i));
assert(pkg.scripts['test:hostile:contracts'].includes('api/release-gate-certification-integrity-17-0-19.test.cjs'));
assert(pkg.scripts['test:hostile:contracts'].includes('api/failure-extractor-bounded-17-0-20.test.cjs'));
assert(pkg.scripts['test:repair:17.0.20'].includes('api/release-gate-maturity-16-0-207.test.cjs'));
assert(pkg.scripts['test:repair:17.0.20'].includes('api/release-gate-certification-integrity-17-0-19.test.cjs'));
assert(pkg.scripts['test:repair:17.0.20'].includes('api/failure-extractor-bounded-17-0-20.test.cjs'));
assert(pkg.scripts['test:release:fast'].includes('validate:17.0.20'));
assert(pkg.scripts['test:new-implementations'].includes('validate:17.0.20'));
assert(json('test-tools/regressions/registry.json').defects.some(row => row.defectId === 'RG-FAILURE-EVIDENCE-BOUNDED-PRIORITY-1720' && row.fixedVersion === expected));

const safetyScript = read('scripts/verify-repository-safety.cjs');
assert(safetyScript.includes("allowedTrackedExclusions=new Set(['release-source-manifest.json'])"));
assert(failureExtractor.includes('diagnosticLimit'));
assert(failureExtractor.includes('dedupeLimit'));
assert(failureExtractor.includes('retainedState'));
assert(failureExtractor.includes('Firebase permission denial in failing command'));
assert(failureExtractor.includes('copyString'));
console.log('17.0.20 source validation passed; this does not certify the release.');

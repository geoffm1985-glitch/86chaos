#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-16.js');
assert.equal(pkg.version, '17.0.16');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.releaseTitle, 'Generated Artifact-Aware Checkout Recovery Repair');
for (const file of ['src/core/appCore.js', 'api/_version.js', 'api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.16'"));
for (const directory of ['src', 'api', 'scripts', 'test-tools', 'tests']) assert(fs.statSync(directory).isDirectory(), `${directory} is required`);
for (const file of ['firebase.json', 'vercel.json', 'firestore.rules', 'storage.rules', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1', 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1', 'RELEASE_TEST_POLICY.md', 'RELEASE_17_0_16.md', '.gitignore', 'release-source-manifest.json']) assert(fs.statSync(file).isFile(), `${file} is required`);
assert.equal(json('test-tools/certification/groups.json').release, pkg.version);
assert.equal(json('test-tools/regressions/registry.json').release, pkg.version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, pkg.version);

const updater = read('RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1');
const installer = read('scripts/86chaos-release-workflow/install-app-only.cjs');
const extract = updater.indexOf("Invoke-Stage 'extract and validate release ZIP'");
const repo = updater.indexOf("Invoke-Stage 'verify repository and testing branch'");
const transition = updater.indexOf("Invoke-Stage 'identify release transition or safe resume'");
const install = updater.indexOf("Invoke-Stage 'install release ZIP into repository'");
const safety = updater.indexOf("Invoke-Stage 'repository safety before dependencies'");
assert(extract > 0 && repo > extract && transition > repo && install > transition && safety > install);
assert(updater.includes("[string]$ExpectedVersion = '17.0.16'"));
assert(updater.includes('Git HEAD recovery baseline'));
assert(updater.includes('Recovery upgrade mode:'));
assert(updater.includes('Release ZIP extracted and installed into repository'));
assert(updater.includes("@('switch', 'testing')"));
assert(updater.includes("$env:GIT_PAGER = 'cat'"));
assert(updater.includes("$env:PAGER = 'cat'"));
assert(updater.includes('--no-pager'));
assert(updater.includes("$env:NODE_OPTIONS = '--max-old-space-size=4096'"));
assert(updater.includes("$env:GENERATE_SOURCEMAP = 'false'"));
assert(updater.includes("$env:CHAOS_RELEASE_CHECK_HEARTBEAT_MS = '15000'"));
assert(updater.includes("@('run', 'test:play-store')"));
assert(!/test:play-store:(?:failed|delta|repair)/.test(updater));

assert(installer.includes('recoverableIncompleteCheckout'));
assert(installer.includes("gitShow(repositoryRoot, 'HEAD:package.json')"));
assert(installer.includes("gitShow(repositoryRoot, 'HEAD:release-source-manifest.json')"));
assert(installer.includes('recoveredIncompleteCheckout'));
assert(installer.includes('Refusing to overwrite meaningful pre-existing repository changes'));
assert(installer.includes('ignorableUntrackedRepositoryEntry'));
assert(installer.includes('preservedLocalArtifactPath'));
assert(installer.includes("String(row.status || '') === '??'"));

const runner = read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
const streamed = read('scripts/86chaos-release-gate/streamed-command-runner.cjs');
assert(runner.includes('runStreamedCommand'));
assert(runner.includes('STILL RUNNING'));
assert(runner.includes("result.status === 'timedOut'"));
assert(streamed.includes("'taskkill'"));
assert(streamed.includes("'/T', '/F'"));
assert(pkg.scripts['test:hostile:contracts'].includes('--test-concurrency=1'));
assert(pkg.scripts['test:hostile:contracts'].includes('api/release-workflow-self-heal-17-0-15.test.cjs'));
assert(pkg.scripts['test:hostile:contracts'].includes('api/release-workflow-generated-artifacts-17-0-16.test.cjs'));
assert(pkg.scripts['test:repair:17.0.16'].includes('api/release-workflow-generated-artifacts-17-0-16.test.cjs'));
assert(pkg.scripts['test:repair:17.0.16'].includes('api/release-workflow-self-heal-17-0-15.test.cjs'));
assert(pkg.scripts['test:release:fast'].includes('validate:17.0.16'));
assert(pkg.scripts['test:new-implementations'].includes('validate:17.0.16'));
assert(json('test-tools/regressions/registry.json').defects.some(row => row.defectId === 'RG-AUTOMATED-ZIP-SELF-HEAL-1715' && row.fixedVersion === '17.0.15'));
assert(json('test-tools/regressions/registry.json').defects.some(row => row.defectId === 'RG-GENERATED-ARTIFACT-RECOVERY-1716' && row.fixedVersion === '17.0.16'));

const playStoreRunner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
assert(playStoreRunner.includes('TOTAL ELAPSED TIME:'));
assert(playStoreRunner.includes('Update-TotalTimingEvidence'));
assert(playStoreRunner.lastIndexOf('TOTAL ELAPSED TIME:') > playStoreRunner.lastIndexOf('Exported:'));
const safetyScript = read('scripts/verify-repository-safety.cjs');
assert(safetyScript.includes("allowedTrackedExclusions=new Set(['release-source-manifest.json'])"));

console.log('17.0.16 source validation passed; this does not certify the release.');

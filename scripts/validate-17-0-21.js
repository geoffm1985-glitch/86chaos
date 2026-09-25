#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const pkg=json('package.json'),lock=json('package-lock.json'),version=json('public/version.json');
assert.equal(pkg.version,'17.0.21');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert.equal(version.version,pkg.version);
assert.equal(version.build,pkg.version);
assert.equal(version.releaseTitle,'Release Gate Direct Playwright Process Repair');
assert.equal(pkg.scripts['test:source'],'node scripts/validate-17-0-21.js');
assert.equal(pkg.scripts['validate:17.0.21'],'node scripts/validate-17-0-21.js');
assert(pkg.scripts['test:repair:17.0.21']?.includes('release-gate-schedule-runner-17-0-18.test.cjs'),'17.0.21 repair test covers the mobile layout launch contract');
const releaseChecks=read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
assert(releaseChecks.includes("command: 'node node_modules/@playwright/test/cli.js test --config=playwright.layout.config.cjs'"),'layout smoke retains the locked local Playwright CLI');
assert(releaseChecks.includes('executable: process.execPath'),'layout smoke uses the current Node executable directly');
assert(releaseChecks.includes("args: [path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test', '--config=playwright.layout.config.cjs']"),'layout smoke uses argument-safe direct CLI invocation');
assert(releaseChecks.includes('timeoutMs: 180_000'),'layout smoke retains the bounded 180-second process limit');
assert(!releaseChecks.includes('--timeout 180 -- node node_modules/@playwright/test/cli.js'),'layout smoke no longer nests the Playwright CLI inside a second Node watchdog');
assert(releaseChecks.includes("const timedOut = child.error?.code === 'ETIMEDOUT'"),'direct timeout is classified deterministically');
assert(releaseChecks.includes('result.exitCode = timedOut ? 124'),'direct timeout preserves exit code 124');
// Preserve the 17.0.20 structured source-validator contract repair.
const execution=read('api/release-gate-execution-17-0-5.test.cjs');
assert(!execution.includes('assert.match(good.result.stdout,/source validation passed/)'),'source-validator execution test stays independent of success prose');
assert(execution.includes("assert.equal(started.group,'source validator')"),'structured source-validator evidence remains enforced');
// Preserve the 17.0.19 expected-version pinning repair.
const full=read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const preflight=read('scripts/86chaos-release-gate/preflight-env.cjs');
assert(full.includes("SetEnvironmentVariable('CHAOS_EXPECTED_VERSION', $PackageVersion, 'Process')"),'full gate still pins expected version from package.json');
assert(preflight.includes("TARGET_ENV_KEYS.filter(key => key !== 'CHAOS_EXPECTED_VERSION')"),'full certification still ignores stale persisted expected-version conflicts');
// Preserve application releases without modifying their behavior.
for(const file of ['src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.21'"),`${file} carries 17.0.21`);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release,pkg.version);
console.log('17.0.21 direct Playwright process validation passed; this does not certify the release.');

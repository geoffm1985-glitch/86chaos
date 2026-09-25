#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const pkg=json('package.json'),lock=json('package-lock.json'),version=json('public/version.json');
assert.equal(pkg.version,'17.0.20');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert.equal(version.version,pkg.version);
assert.equal(version.build,pkg.version);
assert.equal(version.releaseTitle,'Release Gate Source Validator Contract Repair');
assert.equal(pkg.scripts['test:source'],'node scripts/validate-17-0-20.js');
assert.equal(pkg.scripts['validate:17.0.20'],'node scripts/validate-17-0-20.js');
assert(pkg.scripts['test:repair:17.0.20']?.includes('release-gate-execution-17-0-5.test.cjs'),'17.0.20 repair includes the actual hostile execution regression');
assert(pkg.scripts['test:hostile:contracts']?.includes('release-gate-execution-17-0-5.test.cjs'),'source-validator execution regression remains permanent hostile coverage');
const execution=read('api/release-gate-execution-17-0-5.test.cjs');
assert(!execution.includes('assert.match(good.result.stdout,/source validation passed/)'),'hostile execution test no longer depends on mutable validator success prose');
assert(execution.includes("assert.equal(started.group,'source validator')"),'hostile execution test checks structured source-validator group evidence');
assert(execution.includes("assert.equal(started.command,'npm run test:source')"),'hostile execution test checks the exact mandatory command');
assert(execution.includes("assert.match(good.result.stdout,/\\[release-check\\] source validator: npm run test:source/)"),'hostile execution test checks stable preflight launch evidence');
// Preserve 17.0.19 expected-version pinning.
const full=read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const preflight=read('scripts/86chaos-release-gate/preflight-env.cjs');
assert(full.includes("SetEnvironmentVariable('CHAOS_EXPECTED_VERSION', $PackageVersion, 'Process')"),'full gate still pins expected version from package.json');
assert(preflight.includes("TARGET_ENV_KEYS.filter(key => key !== 'CHAOS_EXPECTED_VERSION')"),'full certification still ignores stale persisted expected-version conflicts');
// Preserve 17.0.18 subprocess repair.
const releaseChecks=read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
assert(releaseChecks.includes('--timeout 600 -- npm run test:schedule-publish:core'),'schedule core remains separated');
assert(releaseChecks.includes("group: 'mobile layout Playwright smoke'"),'mobile layout Playwright remains its own observable step');
// Preserve 17.0.17 app repairs.
const service=read('api/_schedule-publish-service.cjs');
assert(service.includes('resolveEmployeeForPublishShift'),'legacy publish identity repair preserved');
const app=read('src/App.js');
const navStart=app.indexOf('const transitionActiveTabState = useCallback((nextTab) => {');
const navEnd=app.indexOf('const disarmPwaBackExit',navStart);
assert(navStart>=0&&navEnd>navStart&&!app.slice(navStart,navEnd).includes('React.startTransition'),'synchronous top-level navigation preserved');
for(const file of ['src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.20'"),`${file} carries 17.0.20`);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release,pkg.version);
console.log('17.0.20 source validation passed; this does not certify the release.');

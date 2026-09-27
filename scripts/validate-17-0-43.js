#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),version='17.0.43';
const p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,version);assert.equal(l.version,version);assert.equal(l.packages[''].version,version);assert.equal(v.version,version);assert.equal(v.build,version);
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-43.js');assert.equal(p.scripts['validate:17.0.43'],'node scripts/validate-17-0-43.js');assert.equal(p.scripts['test:repair:17.0.43'],'npm run test:current-release-targeted');
assert.ok(p.scripts['test:current-release-targeted'].includes('api/testing-gate-17-0-43.test.cjs'));
assert.match(read('api/_version.js'),/APP_VERSION = '17\.0\.43'/);assert.match(read('api/_version.js'),/SECURITY_SCHEMA_VERSION = '17\.0\.43'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '17\.0\.43'/);assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '17\.0\.43'/);
for(const f of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(f).release,version);
const workflow=read('.github/workflows/testing-targeted-delta.yml');assert.ok(workflow.includes('[full-gate]'));assert.ok(workflow.includes('Run 17.0.43 targeted delta only'));assert.ok(workflow.includes('58-testing-gate-17-0-43.spec.cjs'));assert.ok(workflow.includes('version=$(node -p "require(\'./package.json\').version")'));assert.ok(!workflow.includes('CHAOS_EXPECTED_VERSION=$(node -p \\"'));
assert.ok(read('scripts/86chaos-release-gate/release-test-universe.cjs').includes('58-testing-gate-17-0-43.spec.cjs'));
console.log('17.0.43 testing gate trigger and identity validation passed.');

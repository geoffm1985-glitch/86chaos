#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),version='17.0.45';
const p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,version);assert.equal(l.version,version);assert.equal(l.packages[''].version,version);assert.equal(v.version,version);assert.equal(v.build,version);
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-45.js');assert.equal(p.scripts['validate:17.0.45'],'node scripts/validate-17-0-45.js');assert.equal(p.scripts['test:repair:17.0.45'],'npm run test:current-release-targeted');
assert.ok(p.scripts['test:current-release-targeted'].includes('api/customer-help-version-17-0-45.test.cjs'));
assert.ok(p.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-45.js'));
assert.match(read('api/_version.js'),/APP_VERSION = '17\.0\.45'/);assert.match(read('api/_version.js'),/SECURITY_SCHEMA_VERSION = '17\.0\.45'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '17\.0\.45'/);assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '17\.0\.45'/);
for(const f of ['src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs'])assert.match(read(f),/CUSTOMER_HELP_VERSION = '17\.0\.45'/);
for(const f of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(f).release,version);
const workflow=read('.github/workflows/testing-targeted-delta.yml');assert.ok(workflow.includes('Run 17.0.45 targeted delta only'));assert.ok(workflow.includes('60-customer-help-version-17-0-45.spec.cjs'));
assert.ok(read('scripts/86chaos-release-gate/release-test-universe.cjs').includes('60-customer-help-version-17-0-45.spec.cjs'));
console.log('17.0.45 customer Help JS/CJS release-version parity validation passed.');

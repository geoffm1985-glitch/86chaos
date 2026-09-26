#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,'17.0.37'); assert.equal(l.version,'17.0.37'); assert.equal(l.packages[''].version,'17.0.37'); assert.equal(v.version,'17.0.37');
assert.equal(p.dependencies['firebase-admin'],'14.5.0'); assert.equal(l.packages['node_modules/firebase-admin'].version,'14.5.0');
assert.equal(p.overrides?.['jwks-rsa']?.jose,'4.15.9'); assert.equal(l.packages['node_modules/jwks-rsa'].version,'4.1.0'); assert.equal(l.packages['node_modules/jwks-rsa/node_modules/jose'].version,'4.15.9');
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-37.js'); assert.equal(p.scripts['validate:17.0.37'],'node scripts/validate-17-0-37.js');
assert(p.scripts['test:current-release-targeted'].includes('firebase-admin-runtime-17-0-37.test.cjs')); assert(p.scripts['test:current-release-targeted'].includes('firebase-admin-url-api-17-0-36.test.cjs'));
const universe=read('scripts/86chaos-release-gate/release-test-universe.cjs'); assert(universe.includes('45-firebase-admin-url-api.spec.cjs')); assert(universe.includes('46-firebase-admin-runtime-module-load.spec.cjs'));
const deployed=read('tests/86chaos-release-gate/46-firebase-admin-runtime-module-load.spec.cjs'); assert(deployed.includes('/api/personal-reminder-list')); assert(deployed.includes('toBe(405)'));
assert(read('src/core/localReminderBridge.js').includes('LocalNotifications'));
const workflow=read('.github/workflows/testing-targeted-delta.yml'); assert(workflow.includes('npm run test:current-release-targeted')); assert(!workflow.includes('npm run test:play-store')); assert(!workflow.includes('Run full Release Gate'));
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release,'17.0.37');
console.log('17.0.37 emergency reminder runtime compatibility validation passed; this does not certify the full release gate.');

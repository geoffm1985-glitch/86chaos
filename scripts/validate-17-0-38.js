#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,'17.0.38');assert.equal(l.version,'17.0.38');assert.equal(l.packages[''].version,'17.0.38');assert.equal(v.version,'17.0.38');
assert.equal(p.dependencies['firebase-admin'],'14.5.0');assert.equal(l.packages['node_modules/firebase-admin'].version,'14.5.0');
assert.equal(p.overrides?.['jwks-rsa']?.jose,'4.15.9');assert.equal(l.packages['node_modules/jwks-rsa/node_modules/jose'].version,'4.15.9');
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-38.js');assert.equal(p.scripts['validate:17.0.38'],'node scripts/validate-17-0-38.js');
assert(p.scripts['test:current-release-targeted'].includes('reminder-mobile-runtime-17-0-38.test.cjs'));assert(p.scripts['test:current-release-targeted'].includes('firebase-admin-runtime-17-0-37.test.cjs'));
const bridge=read('src/core/localReminderBridge.js'),ui=read('src/features/intelligence.jsx');assert(bridge.includes('normalizeDeviceLocalReminder'));assert(ui.includes('normalizeReminderUiRow'));assert(ui.includes('data-reminder-runtime-safety="17.0.38"'));
const universe=read('scripts/86chaos-release-gate/release-test-universe.cjs');assert(universe.includes('46-firebase-admin-runtime-module-load.spec.cjs'));assert(universe.includes('47-reminder-mobile-runtime-recovery.spec.cjs'));
const workflow=read('.github/workflows/testing-targeted-delta.yml');assert(workflow.includes('[full-gate]'));assert(workflow.includes('npm run test:current-release-targeted'));assert(workflow.includes('npm run test:play-store'));
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(file).release,'17.0.38');
console.log('17.0.38 mobile reminder render recovery validation passed.');

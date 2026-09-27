#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));
const version='17.0.41';
const p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,version);assert.equal(l.version,version);assert.equal(l.packages[''].version,version);assert.equal(v.version,version);assert.equal(v.build,version);
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-41.js');assert.equal(p.scripts['validate:17.0.41'],'node scripts/validate-17-0-41.js');assert.equal(p.scripts['test:repair:17.0.41'],'npm run test:current-release-targeted');
assert.ok(p.scripts['test:current-release-targeted'].includes('api/emergency-runtime-sticky-17-0-41.test.cjs'));
assert.match(read('api/_version.js'),/APP_VERSION = '17\.0\.41'/);assert.match(read('api/_version.js'),/SECURITY_SCHEMA_VERSION = '17\.0\.41'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '17\.0\.41'/);assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '17\.0\.41'/);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(file).release,version);
const operations=read('src/features/operations.jsx');
for(const moduleName of ['restaurantReadiness','needsAttention','restaurantKnowledgeGraph','smartPrepIntelligence','operationalHistoryIntelligence']){
  assert.ok(operations.includes(`../core/${moduleName}.js`),`${moduleName} browser ESM import exists`);
  assert.ok(!operations.includes(`../core/${moduleName}.cjs`),`${moduleName} CommonJS browser import removed`);
}
for(const file of ['src/core/restaurantReadiness.js','src/core/needsAttention.js','src/core/restaurantKnowledgeGraph.js','src/core/smartPrepIntelligence.js','src/core/operationalHistoryIntelligence.js'])assert.ok(fs.existsSync(path.join(root,file)),`${file} exists`);
const schedule=read('src/features/schedule.jsx');assert.match(schedule,/const deckHeight = Math\.ceil\(scheduleBuilderControlDeckRef\.current/);assert.doesNotMatch(schedule,/viewportWidth <= 720[\s\S]{0,100}setScheduleBuilderStickyTop\(0\)/);
const styles=read('src/styles.css');assert.match(styles,/schedule-builder-sticky-day-header[\s\S]{0,220}top:\s*var\(--schedule-builder-sticky-top/);
const sourceTest=read('api/emergency-runtime-sticky-17-0-41.test.cjs');for(const marker of ['browser-native intelligence modules','sticky day header reserves the live control-deck height','build-only push suppression'])assert.ok(sourceTest.includes(marker));
const browser=read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');for(const marker of ['Ve is not a function','restaurant-readiness-score','schedule-builder-control-deck','schedule-builder-sticky-day-header'])assert.ok(browser.includes(marker));
const universe=read('scripts/86chaos-release-gate/release-test-universe.cjs');assert.ok(universe.includes('56-manager-brief-sticky-day-header.spec.cjs'));
const workflow=read('.github/workflows/testing-targeted-delta.yml');assert.ok(workflow.includes("[build-only]"));assert.ok(workflow.includes('Run 17.0.41 targeted delta only'));assert.ok(workflow.includes('56-manager-brief-sticky-day-header.spec.cjs'));
console.log('17.0.41 emergency Manager Brief runtime and sticky Schedule Builder header validation passed.');

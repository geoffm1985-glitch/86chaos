#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'); const read=f=>fs.readFileSync(path.join(root,f),'utf8'); const json=f=>JSON.parse(read(f));
const version='17.0.42',p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,version);assert.equal(l.version,version);assert.equal(l.packages[''].version,version);assert.equal(v.version,version);assert.equal(v.build,version);
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-42.js');assert.equal(p.scripts['validate:17.0.42'],'node scripts/validate-17-0-42.js');assert.equal(p.scripts['test:repair:17.0.42'],'npm run test:current-release-targeted');
assert.ok(p.scripts['test:current-release-targeted'].includes('api/emergency-sticky-touch-17-0-42.test.cjs'));
assert.match(read('api/_version.js'),/APP_VERSION = '17\.0\.42'/);assert.match(read('api/_version.js'),/SECURITY_SCHEMA_VERSION = '17\.0\.42'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '17\.0\.42'/);assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '17\.0\.42'/);
for(const f of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(f).release,version);
const schedule=read('src/features/schedule.jsx');for(const marker of ['scheduleBuilderHeaderTouchRef',"touchState.axis === 'vertical'",'scrollHost.scrollTop += deltaY',"addEventListener('touchmove', onTouchMove, { passive: false })"])assert.ok(schedule.includes(marker),marker);
const styles=read('src/styles.css');for(const marker of ['touch-action: pan-x','overflow-y: hidden !important','translateZ(0)'])assert.ok(styles.includes(marker),marker);
const sourceTest=read('api/emergency-sticky-touch-17-0-42.test.cjs');assert.ok(sourceTest.includes('hands vertical touch drags'));
const browser=read('tests/86chaos-release-gate/57-sticky-header-touch-handoff.spec.cjs');for(const marker of ['schedule-builder-header-scroll','touchmove','headerTop','deckBottom'])assert.ok(browser.includes(marker));
const universe=read('scripts/86chaos-release-gate/release-test-universe.cjs');assert.ok(universe.includes('57-sticky-header-touch-handoff.spec.cjs'));
const workflow=read('.github/workflows/testing-targeted-delta.yml');assert.ok(workflow.includes('[build-only]'));assert.ok(workflow.includes('Run 17.0.42 targeted delta only'));assert.ok(workflow.includes('57-sticky-header-touch-handoff.spec.cjs'));
console.log('17.0.42 emergency Schedule Builder direct-touch sticky header validation passed.');

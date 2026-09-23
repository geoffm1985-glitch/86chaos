#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8');
const json=f=>JSON.parse(read(f));
const pkg=json('package.json'),lock=json('package-lock.json'),version=json('public/version.json');
assert.equal(pkg.version,'17.0.26');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert.equal(version.version,pkg.version);
assert.equal(version.build,pkg.version);
assert.equal(version.releaseTitle,'Phase 1 Spanish Interface');
assert.equal(pkg.scripts['test:source'],'node scripts/validate-17-0-26.js');
assert.equal(pkg.scripts['validate:17.0.26'],'node scripts/validate-17-0-26.js');
assert(pkg.scripts['test:repair:17.0.26']?.includes('test:current-release-targeted'),'17.0.26 repair test uses current release targeted suite');
assert(pkg.scripts['test:current-release-targeted']?.includes('api/i18n-phase1-17-0-26.test.cjs'),'current release targeted suite includes Phase 1 Spanish regression');
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'),'delta runs current release targeted regressions before scoped Playwright');

const app=read('src/App.js');
const i18n=read('src/core/i18n.cjs');
const i18nReact=read('src/core/i18n.js');
const common=read('src/components/common.jsx');
const management=read('src/features/management.jsx');
const operations=read('src/features/operations.jsx');
const schedule=read('src/features/schedule.jsx');
const phaseTest=read('api/i18n-phase1-17-0-26.test.cjs');
const deployedTest=read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');

assert(app.includes('I18nProvider'),'app is wrapped in the i18n provider');
assert(app.includes('liveAppUser?.preferences?.language'),'app reads the signed-in user language preference');
assert(app.includes("document.documentElement.lang = appLanguage === 'es' ? 'es' : 'en'"),'document language follows app preference');
assert(i18n.includes("SUPPORTED_APP_LANGUAGES = Object.freeze(['en', 'es'])"),'English and Spanish are the supported Phase 1 languages');
assert(i18n.includes("'drawer.timeClockSchedule': 'Reloj y horario'"),'Spanish navigation dictionary is bundled');
assert(i18n.includes("'schedule.clockIn': 'FICHAR ENTRADA'"),'Spanish time-clock copy is bundled');
assert(i18nReact.includes('export const I18nProvider'),'React translation provider exists');
assert(management.includes('data-testid="app-language-select"'),'Settings exposes the per-user language selector');
assert(management.includes('...prefs, defaultTab, timeFormat, language'),'language is saved inside the user preferences map');
assert(common.includes("t('drawer.prepTasks')"),'global navigation uses translation keys');
assert(operations.includes("t('today.managerBrief')"),'Today / Manager Brief uses translation keys');
assert(operations.includes("t('prep.foodPrep')"),'Prep & Tasks uses translation keys');
assert(schedule.includes("t('schedule.mySchedule')"),'Time Clock & Schedule uses translation keys');
assert(schedule.includes("t('builder.clearMonth')"),'Schedule Builder primary controls use translation keys');
assert(schedule.includes("t('requestOff.policy')"),'Request Off policy uses translation keys');
assert(phaseTest.includes('getMissingTranslationKeys'),'Node regression checks Spanish dictionary completeness');
assert(deployedTest.includes("selectOption('es')"),'deployed release-gate test switches the actual app to Spanish');
assert(deployedTest.includes("selectOption(originalLanguage || 'en')"),'deployed language test restores its test account preference');

// Preserve 17.0.25 delete/delta and 17.0.23 Request Off authority contracts.
const deleteRoute=read('api/schedule-shift-delete.js');
const delta=read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const policy=read('src/core/timeOffPolicy.js');
assert(schedule.includes("secureFetch('/api/schedule-shift-delete'"),'Schedule Builder shift deletion remains on authenticated server boundary');
assert(deleteRoute.includes("action === 'clear-month'"),'Clear Month server operation remains present');
assert(delta.includes('A clean full baseline with zero FAIL/TIMEOUT rows is still a valid delta baseline.'),'clean full delta baseline repair remains present');
assert(!/permissions\?\.(?:schedule|team|settings)/.test(policy),'Request Off policy configuration remains owner/admin only');

for(const file of ['src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.26'"),`${file} carries 17.0.26`);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release,pkg.version);
console.log('17.0.26 Phase 1 Spanish Interface validation passed; this does not certify the release.');

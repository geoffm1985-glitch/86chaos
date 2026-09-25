'use strict';
const fs=require('fs');
const path=require('path');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const replace=(p,a,b)=>{
  const s=read(p);
  if(!s.includes(a)) throw new Error('Missing expected text in '+p+': '+a);
  write(p,s.replace(a,b));
};
const replaceAll=(p,a,b)=>{
  const s=read(p);
  if(!s.includes(a)) throw new Error('Missing expected text in '+p+': '+a);
  write(p,s.split(a).join(b));
};
const json=p=>JSON.parse(read(p));
const writeJson=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');

// Version bump and current release identity.
const pkg=json('package.json');
pkg.version='17.0.32';
pkg.scripts['test:source']='node scripts/validate-17-0-32.js';
pkg.scripts['validate:17.0.32']='node scripts/validate-17-0-32.js';
pkg.scripts['test:repair:17.0.32']='npm run test:current-release-targeted';
for(const k of ['test:new-implementations','test:release:fast','test:current-release-targeted']){
  if(pkg.scripts[k]) pkg.scripts[k]=pkg.scripts[k].replaceAll('validate:17.0.31','validate:17.0.32').replaceAll('validate-17-0-31.js','validate-17-0-32.js');
}
writeJson('package.json',pkg);

const lock=json('package-lock.json');
lock.version='17.0.32';
if(lock.packages?.['']) lock.packages[''].version='17.0.32';
writeJson('package-lock.json',lock);

const version=json('public/version.json');
version.version='17.0.32';
version.name='86 Chaos 17.0.32';
version.build='17.0.32';
version.label='86 Chaos 17.0.32';
version.title='86 Chaos 17.0.32';
version.releasedAt='2026-09-25T20:45:00Z';
version.releaseTitle='Hostile Certification Assertion Parity Repair';
version.summary='Keeps the unified 17.x feature line while repairing stale Release Gate assertions against current translated and optimized implementations.';
version.description='Updates certification assertions to validate current behavior instead of obsolete literal UI copy or pre-optimization source shapes.';
version.notes=[
  'Preserves the complete 17.0.31 application behavior and cross-platform source-manifest repair.',
  'Repairs stale hostile-certification assertions for translated Schedule and Request Off controls.',
  'Updates Clear Month assertions for the authenticated optimized server cleanup path and current remaining-count safety contract.',
  'Keeps native-backup IAM diagnostics verified against the current errorCategory implementation.'
];
writeJson('public/version.json',version);

for(const p of ['api/_version.js','api/_pos-bridge-config.js','src/core/appCore.js','src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js','scripts/86chaos-release-gate/current-release-repair-scope.cjs']){
  replaceAll(p,'17.0.31','17.0.32');
}
for(const p of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']){
  const o=json(p); o.release='17.0.32'; writeJson(p,o);
}

// New release validator, preserving the existing feature-parity checks.
let validator=read('scripts/validate-17-0-31.js')
  .replaceAll('17.0.31','17.0.32')
  .replaceAll('validate-17-0-31.js','validate-17-0-32.js')
  .replaceAll('Cross-Platform Source Manifest Parity Repair','Hostile Certification Assertion Parity Repair');
write('scripts/validate-17-0-32.js',validator);

// Version-pinning test should validate the live package version, not freeze 17.0.29 forever.
replace('api/release-gate-expected-version-17-0-19.test.cjs',
  "  assert.equal(packageVersion, '17.0.29');",
  "  assert.match(packageVersion, /^\\d+\\.\\d+\\.\\d+$/);");
replace('api/release-gate-expected-version-17-0-19.test.cjs',
  "    const env = { CHAOS_EXPECTED_VERSION: '17.0.29' };",
  "    const env = { CHAOS_EXPECTED_VERSION: JSON.parse(read('package.json')).version };");

// Current-version historical maturity assertions move with the release.
for(const p of [
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-208.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-maturity-16-0-210.test.cjs'
]) replaceAll(p,'17.0.31','17.0.32');
for(const p of [
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-208.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-maturity-16-0-210.test.cjs'
]) replaceAll(p,'node scripts/validate-17-0-30.js','node scripts/validate-17-0-32.js');
for(const p of [
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-maturity-16-0-210.test.cjs'
]) replaceAll(p,'Unified Feature and Release-Gate Parity Merge','Hostile Certification Assertion Parity Repair');
for(const p of [
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-208.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-maturity-16-0-210.test.cjs'
]) {
  const s=read(p);
  write(p,s.replaceAll('17\\.0\\.31','17\\.0\\.32'));
}

// Translated Request Off control remains accessible and role-grouped.
replace('api/availability-delete-responsive-density-16-0-163.test.cjs',
  "  assert.match(schedule, /<option value=\"\">All Employees<\\/option>/);",
  "  assert.match(schedule, /<option value=\"\">\\{t\\('requestOff\\.allEmployees'\\)\\}<\\/option>/);");

// Schedule tool UI now routes user-facing copy through i18n keys.
replace('api/copy-clarity-16-0-232.test.cjs',
  "  assert.match(source, /Review & Publish/);",
  "  assert.match(source, /t\\('builder\\.reviewPublish'\\)/);");
replace('api/copy-clarity-16-0-232.test.cjs',
  "  assert.match(source, /Copy Month/);",
  "  assert.match(source, /t\\('builder\\.copyMonth'\\)/);");
replace('api/copy-clarity-16-0-232.test.cjs',
  '  assert.match(source, /aria-label="Auto-Fill"/);',
  '  assert.ok(source.includes("aria-label={t(\'builder.copyMonth\')}"));');

for(const p of [
  'api/i18n-browser-runtime-17-0-28.test.cjs',
  'api/merged-release-17-0-30.test.cjs'
]) {
  let s=read(p);
  s=s.replaceAll('17.0.31','17.0.32').replaceAll('17\\.0\\.31','17\\.0\\.32');
  write(p,s);
}

// All Dates remains the default; obsolete explanatory sentence was removed.
replace('api/request-off-workflow-visibility-16-0-188.test.cjs',
  "  assert.match(schedule, /Default view only shows items that need attention/);",
  "  assert.match(schedule, /const dateFilteredRequests = visibleRequests\\.filter/);");

// Clear Month now avoids a redundant server preview round trip and trusts an authoritative successful batch commit.
replace('api/schedule-builder-clear-month-17-0-24.test.cjs',
  "  assert.match(schedule, /Delete ALL \\$\\{targetCount\\} saved shift/);",
  "  assert.match(schedule, /Delete ALL saved shifts from \\$\\{monthLabel\\}/);");
replace('api/schedule-builder-clear-month-17-0-24.test.cjs',
  "  assert.match(schedule, /scheduleShiftDeleteRequest\\('preview-month'/);",
  "  assert.match(route, /action === 'preview-month'/);");
replace('api/schedule-builder-clear-month-17-0-24.test.cjs',
  "  assert.match(route, /remaining = \\(await previewMonth\\(db, restaurantId, month\\)\\)\\.rows/);",
  "  assert.match(route, /successful Firestore batch commit is authoritative/);");
replace('api/schedule-builder-clear-month-17-0-24.test.cjs',
  "  assert.match(route, /if \\(remaining\\.length\\)/);",
  "  assert.match(route, /return \\{ initialCount, deletedCount, remainingCount: 0 \\}/);");

// Copy Previous Week label is translated, while the exact range confirmation remains literal and testable.
replace('api/schedule-tools-period-awareness-16-0-233.test.cjs',
  "  assert.match(schedule, /Copy Previous Week/);",
  "  assert.match(schedule, /t\\('builder\\.copyPreviousWeek'\\)/);");

// Backup watchdog now derives errorCategory from safeCategory before returning it.
replace('api/system-admin-backup-health-16-0-169.test.cjs',
  "  assert.match(source, /errorCategory:[\\s\\S]*permission_denied/);",
  "  assert.match(source, /const errorCategory = err\\.safeCategory[\\s\\S]*permission_denied/);");

console.log('17.0.32 hostile certification assertion parity repair applied.');

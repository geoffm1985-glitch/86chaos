'use strict';
const fs=require('fs');
const path=require('path');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const json=p=>JSON.parse(read(p));
const writeJson=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const replaceAll=(p,a,b)=>{
  const s=read(p);
  if(!s.includes(a)) throw new Error('Missing expected text in '+p+': '+a);
  write(p,s.split(a).join(b));
};

// Release identity.
const pkg=json('package.json');
pkg.version='17.0.33';
for(const [k,v] of Object.entries(pkg.scripts||{})){
  if(typeof v==='string'){
    pkg.scripts[k]=v
      .replaceAll('validate:17.0.32','validate:17.0.33')
      .replaceAll('validate-17-0-32.js','validate-17-0-33.js');
  }
}
pkg.scripts['validate:17.0.33']='node scripts/validate-17-0-33.js';
pkg.scripts['test:repair:17.0.33']='npm run test:current-release-targeted';
writeJson('package.json',pkg);

const lock=json('package-lock.json');
lock.version='17.0.33';
if(lock.packages?.['']) lock.packages[''].version='17.0.33';
writeJson('package-lock.json',lock);

const version=json('public/version.json');
version.version='17.0.33';
version.name='86 Chaos 17.0.33';
version.build='17.0.33';
version.label='86 Chaos 17.0.33';
version.title='86 Chaos 17.0.33';
version.releasedAt='2026-09-26T02:40:00Z';
version.releaseTitle='Customer Help Release Identity Parity Repair';
version.summary='Repairs stale customer-help and current-release version assertions that blocked the full Release Gate before Playwright.';
version.description='Keeps 17.0.32 application behavior unchanged while making release-version certification checks follow the active release identity.';
version.notes=[
  'Preserves the complete 17.0.32 application behavior and hostile-certification assertion repair.',
  'Makes Customer Help release identity verification compare against the package release instead of a stale hard-coded version.',
  'Updates current-release maturity and i18n certification assertions for 17.0.33.',
  'Adds full server-test validation before the candidate can move to testing.'
];
writeJson('public/version.json',version);

for(const p of [
  'api/_version.js',
  'api/_pos-bridge-config.js',
  'src/core/appCore.js',
  'src/core/customerHelpKnowledge.js',
  'src/core/customerHelpKnowledge.cjs',
  'src/core/schedulePdf.js',
  'scripts/86chaos-release-gate/current-release-repair-scope.cjs'
]) replaceAll(p,'17.0.32','17.0.33');

for(const p of [
  'test-tools/certification/groups.json',
  'test-tools/regressions/registry.json',
  'test-tools/certification/cost-performance-baselines.json'
]){
  const o=json(p); o.release='17.0.33'; writeJson(p,o);
}

// The failing Customer Help test should track package identity so this cannot recur next bump.
{
  const p='api/customer-help-intelligence.test.cjs';
  let s=read(p);
  s=s.replace(
    "test('customer Help version and Custom Shift questions are current for 17.0.31', () => {\n  assert.equal(help.CUSTOMER_HELP_VERSION, '17.0.31');",
    "test('customer Help version matches the active package release and Custom Shift questions stay current', () => {\n  const packageVersion = require('../package.json').version;\n  assert.equal(help.CUSTOMER_HELP_VERSION, packageVersion);"
  );
  if(!s.includes("assert.equal(help.CUSTOMER_HELP_VERSION, packageVersion);")) throw new Error('Customer Help version assertion repair did not apply');
  write(p,s);
}

// Current-release identity assertions.
for(const p of [
  'api/merged-release-17-0-30.test.cjs',
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-208.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-maturity-16-0-210.test.cjs'
]){
  let s=read(p);
  s=s.replaceAll('17.0.32','17.0.33').replaceAll('17\\.0\\.32','17\\.0\\.33');
  s=s.replaceAll('validate-17-0-32.js','validate-17-0-33.js');
  s=s.replaceAll('Hostile Certification Assertion Parity Repair','Customer Help Release Identity Parity Repair');
  write(p,s);
}
{
  const p='api/i18n-browser-runtime-17-0-28.test.cjs';
  let s=read(p).replaceAll("17\\.0\\.32","17\\.0\\.33");
  write(p,s);
}

// New release validator copied forward from the validated 17.0.32 contract.
let validator=read('scripts/validate-17-0-32.js')
  .replaceAll('17.0.32','17.0.33')
  .replaceAll('validate-17-0-32.js','validate-17-0-33.js')
  .replaceAll('Hostile Certification Assertion Parity Repair','Customer Help Release Identity Parity Repair');
write('scripts/validate-17-0-33.js',validator);

console.log('17.0.33 customer-help release identity parity repair applied.');

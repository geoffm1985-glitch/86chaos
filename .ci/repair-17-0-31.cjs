'use strict';
const fs=require('fs');
const path=require('path');

const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>{ fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,s.endsWith('\n')?s:s+'\n'); };
const replace=(f,a,b)=>{
  const s=read(f);
  if(!s.includes(a)) throw new Error(`${f}: missing expected text ${a}`);
  write(f,s.split(a).join(b));
};

const VERSION='17.0.31';
const OLD='17.0.30';
const TITLE='Cross-Platform Source Manifest Parity Repair';

let attrs=read('.gitattributes');
if(!/^\*\.ts text eol=lf$/m.test(attrs)) attrs += '\n*.ts text eol=lf';
if(!/^\*\.tsx text eol=lf$/m.test(attrs)) attrs += '\n*.tsx text eol=lf';
write('.gitattributes',attrs);

replace(
  'scripts/86chaos-release-gate/source-identity.cjs',
  'json|css|html|md|txt|ps1|cmd|yml|yaml|rules|py|toml|sh)$/i',
  'json|css|html|md|txt|ps1|cmd|yml|yaml|rules|py|toml|sh|ts|tsx)$/i'
);

const directVersionFiles=[
  'api/_pos-bridge-config.js',
  'api/_version.js',
  'api/customer-help-intelligence.test.cjs',
  'api/merged-release-17-0-30.test.cjs',
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-208.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-maturity-16-0-210.test.cjs',
  'api/i18n-browser-runtime-17-0-28.test.cjs',
  'scripts/86chaos-release-gate/current-release-repair-scope.cjs',
  'src/core/appCore.js',
  'src/core/customerHelpKnowledge.cjs',
  'src/core/customerHelpKnowledge.js',
  'src/core/schedulePdf.js',
  'tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs',
  'tests/86chaos-release-gate/42-merged-17-0-30-parity.spec.cjs'
];
for(const f of directVersionFiles){
  const before=read(f);
  const after=before
    .replaceAll(OLD,VERSION)
    .replaceAll('17\\.0\\.30','17\\.0\\.31');
  if(after===before) throw new Error(`${f}: no active 17.0.30 version marker found`);
  write(f,after);
}

const pkg=JSON.parse(read('package.json'));
pkg.version=VERSION;
pkg.scripts['test:source']='node scripts/validate-17-0-31.js';
pkg.scripts['validate:17.0.31']='node scripts/validate-17-0-31.js';
pkg.scripts['test:repair:17.0.31']='npm run test:current-release-targeted';
for(const [k,v] of Object.entries(pkg.scripts)){
  if(typeof v==='string') pkg.scripts[k]=v
    .replaceAll('validate:17.0.30','validate:17.0.31')
    .replaceAll('validate-17-0-30.js','validate-17-0-31.js');
}
pkg.scripts['test:current-release-targeted']=pkg.scripts['test:current-release-targeted']
  .replace('node --test ','node --test api/source-manifest-parity-17-0-31.test.cjs ');
write('package.json',JSON.stringify(pkg,null,2));

const lock=JSON.parse(read('package-lock.json'));
lock.version=VERSION;
if(lock.packages?.['']) lock.packages[''].version=VERSION;
write('package-lock.json',JSON.stringify(lock,null,2));

const version=JSON.parse(read('public/version.json'));
for(const k of ['version','build']) version[k]=VERSION;
for(const k of ['name','label','title']) if(version[k]) version[k]=String(version[k]).replaceAll(OLD,VERSION);
version.releaseTitle=TITLE;
write('public/version.json',JSON.stringify(version,null,2));

for(const f of [
  'test-tools/certification/cost-performance-baselines.json',
  'test-tools/certification/groups.json',
  'test-tools/regressions/registry.json'
]){
  const j=JSON.parse(read(f));
  j.release=VERSION;
  write(f,JSON.stringify(j,null,2));
}

const oldValidator=read('scripts/validate-17-0-30.js');
write(
  'scripts/validate-17-0-31.js',
  oldValidator.replaceAll(OLD,VERSION).replaceAll('Unified Feature and Release-Gate Parity Merge',TITLE)
);

write('RELEASE_17_0_31.md', [
  '# 86 Chaos 17.0.31',
  '',
  '## Cross-Platform Source Manifest Parity Repair',
  '',
  '17.0.31 preserves the complete 17.0.30 unified feature set and repairs certification source identity parity across Linux/Vercel and Windows release-gate runners.',
  '',
  '- Adds explicit LF normalization for TypeScript and TSX source files.',
  '- Adds explicit Git EOL rules for .ts and .tsx files.',
  '- Regenerates the bundled release source manifest only after the final source is assembled.',
  '- Adds unit and Play Store release-gate coverage that fails if cross-platform source hashing diverges again.',
  '- Makes no intentional restaurant workflow or UI feature removals.'
].join('\n'));

write('api/source-manifest-parity-17-0-31.test.cjs', [
  "'use strict';",
  "const test=require('node:test');",
  "const assert=require('node:assert/strict');",
  "const fs=require('fs');",
  "const path=require('path');",
  "const identity=require('../scripts/86chaos-release-gate/source-identity.cjs');",
  "const root=path.resolve(__dirname,'..');",
  "",
  "test('17.0.31 normalizes TypeScript CRLF and LF identically',()=>{",
  "  for(const file of ['functions/src/example.ts','src/example.tsx']){",
  "    const lf=Buffer.from('const value = 1;\\nexport default value;\\n','utf8');",
  "    const crlf=Buffer.from('const value = 1;\\r\\nexport default value;\\r\\n','utf8');",
  "    assert.equal(identity.hash(identity.sourceBytes(file,crlf)),identity.hash(identity.sourceBytes(file,lf)),file);",
  "  }",
  "});",
  "",
  "test('17.0.31 declares deterministic TypeScript Git line endings',()=>{",
  "  const attrs=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');",
  "  assert.match(attrs,/^\\*\\.ts text eol=lf$/m);",
  "  assert.match(attrs,/^\\*\\.tsx text eol=lf$/m);",
  "});",
  "",
  "test('17.0.31 bundled manifest exactly matches tracked certification source',()=>{",
  "  const captured=identity.captureSourceIdentity(root);",
  "  const bundled=identity.readBundledSourceManifest(root);",
  "  assert.ok(bundled);",
  "  assert.equal(captured.sourceHash,bundled.sourceHash);",
  "  assert.equal(captured.files.length,bundled.files.length);",
  "});"
].join('\n'));

write('tests/86chaos-release-gate/43-source-manifest-cross-platform-parity.spec.cjs', [
  "'use strict';",
  "const {test,expect}=require('@playwright/test');",
  "const fs=require('fs');",
  "const path=require('path');",
  "const identity=require('../../scripts/86chaos-release-gate/source-identity.cjs');",
  "const root=path.resolve(__dirname,'../..');",
  "",
  "test.describe('17.0.31 source manifest cross-platform parity',()=>{",
  "  test('tracked source, bundled manifest, and TypeScript newline normalization remain deterministic',async()=>{",
  "    const captured=identity.captureSourceIdentity(root);",
  "    const bundled=identity.readBundledSourceManifest(root);",
  "    expect(bundled).toBeTruthy();",
  "    expect(captured.sourceHash).toBe(bundled.sourceHash);",
  "    const lf=Buffer.from('export const x = 1;\\n','utf8');",
  "    const crlf=Buffer.from('export const x = 1;\\r\\n','utf8');",
  "    expect(identity.hash(identity.sourceBytes('functions/src/x.ts',crlf))).toBe(identity.hash(identity.sourceBytes('functions/src/x.ts',lf)));",
  "    const attrs=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');",
  "    expect(attrs).toMatch(/^\\*\\.ts text eol=lf$/m);",
  "    expect(attrs).toMatch(/^\\*\\.tsx text eol=lf$/m);",
  "  });",
  "});"
].join('\n'));

const scopePath='scripts/86chaos-release-gate/current-release-repair-scope.cjs';
let scope=read(scopePath);
scope=scope.replace(
  /const CURRENT_RELEASE_CARRY_FORWARD_NOTE = '[^']*';/,
  "const CURRENT_RELEASE_CARRY_FORWARD_NOTE = '17.0.31 preserves the complete 17.0.30 unified feature set and adds cross-platform source-manifest parity coverage for Windows and Vercel/Linux certification runners.';"
);
write(scopePath,scope);

console.log('Applied 17.0.31 source-manifest parity repair.');

#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const pkg=json('package.json'), lock=json('package-lock.json'), version=json('public/version.json');
const app=read('src/App.js'), shell=read('src/components/concept17.jsx'), common=read('src/components/common.jsx'), css=read('src/concept17.css'), management=read('src/features/management.jsx'), runner=read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), scope=read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');

assert.equal(pkg.version,'17.1.17');
assert.equal(lock.version,pkg.version);
assert.equal(lock.packages[''].version,pkg.version);
assert.equal(version.version,pkg.version);
assert.equal(version.build,pkg.version);
assert.equal(version.releaseTitle,'Footer Version and Experimental Certification Repair');
assert.equal(pkg.scripts['test:source'],'node scripts/validate-17-1-17.js');
assert.equal(pkg.scripts['validate:17.1.17'],'node scripts/validate-17-1-17.js');
assert(pkg.scripts['test:repair:17.1.17']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.1.17'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/footer-version-copyright-17-1-17.test.cjs'));
for(const file of ['src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js','src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js']) assert(read(file).includes('17.1.17'),`${file} carries 17.1.17`);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release,pkg.version);

assert(app.includes('data-testid="app-version-copyright"'),'footer exposes stable version/copyright identity');
assert(app.includes('Version {CURRENT_VERSION} • © 2026 Chilton App Works LLC'),'footer binds current version and copyright together');
assert(css.includes('17.1.17 footer version/copyright visibility repair'),'footer mobile visibility contract is present');
assert(runner.includes("$CanonicalTestingUrl = 'https://testing.86chaos.com'"),'testing target remains available');
assert(runner.includes("$CanonicalExperimentalUrl = 'https://experimental.86chaos.com'"),'experimental target is explicit');
assert(runner.includes("if (-not $ExpectedBranch) { $ExpectedBranch = 'testing' }"),'testing remains the default branch');
assert(runner.includes('CHAOS_RELEASE_GATE_TARGET_URL'),'CI can pin an exact immutable deployment');
assert(runner.includes("SetEnvironmentVariable('CHAOS_EXPECTED_BRANCH', $ExpectedBranch, 'Process')"),'full gate pins branch identity');

assert(app.includes('const shellNavSections = ['),'categorized shell menu remains');
assert(shell.includes('className="concept17-mobile-nav-item concept17-mobile-voice-button"'),'mobile 86Voice stays visible');
assert(!common.includes('data-testid="drawer-86voice-button"'),'More drawer still does not duplicate 86Voice');
assert(!app.includes('className="concept17-mobile-menu-toggle"'),'mobile hamburger remains removed');
assert(shell.includes('<img src="/6139.png" alt="86 Chaos Kitchen Management OS" className="concept17-brand-logo" />'),'supplied shell logo remains');
assert(/@media \(min-width: 1180px\)[\s\S]*\.concept17-menu-drawer\s*\{\s*display: none !important;/.test(css),'legacy overlay drawer remains hidden on desktop');
for(const label of ['Shift Note','86 Alert','Maintenance','Announcement','General']) assert(management.includes(`'${label}'`),`${label} control remains`);

assert(css.includes('17.1.14 Vercel-safe reference asset resolution repair'),'Vercel asset repair marker remains');
assert(!css.includes("url('/concept17-kitchen-reference.jpg')"),'Vercel-breaking root URL stays removed');
const data=css.match(/--c17-ref-kitchen-image:\s*url\("data:image\/jpeg;base64,([^"]+)"\);/);
assert(data,'embedded reference JPEG data URI remains');
const decoded=Buffer.from(data[1],'base64'), original=fs.readFileSync(path.join(root,'public/concept17-kitchen-reference.jpg'));
assert.equal(sha256(decoded),sha256(original),'embedded reference image remains byte-identical');

assert(exists('RELEASE_17_1_17.md'));
assert(exists('api/footer-version-copyright-17-1-17.test.cjs'));
assert(exists('tests/86chaos-new-implementations/31-footer-version-copyright.spec.cjs'));
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.1.17'"));
assert(scope.includes('31-footer-version-copyright.spec.cjs'));
assert(scope.includes('30-navigation-logo-toolbar-fit.spec.cjs'));

const manifestPath=path.join(root,'release-source-manifest.json');
if(fs.existsSync(manifestPath)){
 const manifest=json('release-source-manifest.json'), identity=captureSourceIdentity(root);
 assert.equal(manifest.version,pkg.version,'release source manifest version matches');
 assert.equal(manifest.sourceHash,identity.sourceHash,'release source manifest matches current source tree');
 assert.equal(hash(JSON.stringify(manifest.files)),manifest.sourceHash,'source manifest self-hash is valid');
 assert.deepEqual(manifest.files,identity.files,'source manifest inventory matches');
 if(exists('public/build-identity.json')){
  const buildIdentity=json('public/build-identity.json');
  assert.equal(buildIdentity.version,pkg.version,'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash,identity.sourceHash,'build identity source hash matches manifest');
 }
}
console.log('17.1.17 footer identity and experimental full-gate targeting validation passed with 17.1.16 protections intact.');

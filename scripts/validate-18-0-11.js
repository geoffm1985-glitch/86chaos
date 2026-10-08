#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),json=file=>JSON.parse(read(file));
const v='18.0.11',p=json('package.json'),l=json('package-lock.json'),pub=json('public/version.json'),contract=json('mobile/native-platform-contract.json');
assert.equal(p.version,v);assert.equal(l.version,v);assert.equal(l.packages[''].version,v);assert.equal(pub.version,v);assert.equal(pub.build,v);
assert.equal(p.scripts['test:source'],'node scripts/validate-18-0-11.js');assert.equal(p.scripts['validate:18.0.11'],'node scripts/validate-18-0-11.js');
assert.match(p.scripts['test:mobile-foundation'],/mobile-native-container-insets-18-0-7\.test\.cjs/);
assert.match(read('api/_version.js'),/APP_VERSION = '18\.0\.11'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '18\.0\.11'/);
assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '18\.0\.11'/);
const activity=read('android/app/src/main/java/com/chiltonappworks/chaos86/MainActivity.java');
assert.match(activity,/findViewById\(android\.R\.id\.content\)/);assert.match(activity,/setOnApplyWindowInsetsListener\(contentView/);
assert.match(activity,/webView\.setPadding\(0, 0, 0, 0\)/);assert.doesNotMatch(activity,/setOnApplyWindowInsetsListener\(webView/);
assert.match(read('android/app/build.gradle'),/versionCode 180011/);assert.match(read('android/app/build.gradle'),/versionName "18\.0\.11"/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/CURRENT_PROJECT_VERSION = 180011;/);assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/MARKETING_VERSION = 18\.0\.11;/);
assert.equal(contract.release,v);assert.equal(contract.nativeViewport.android.containerPadding,true);assert.equal(contract.nativeViewport.android.webViewPadding,false);
assert.match(read('scripts/86chaos-release-gate/release-test-universe.cjs'),/61-native-container-insets\.spec\.cjs/);
assert.match(read('playwright.mobile-foundation.config.cjs'),/61-native-container-insets/);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(file).release,v);
console.log('18.0.11 native container inset repair validated.');

// Full production behavior and sealed-source validation remain mandatory.
{
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f).replace(/^\uFEFF/, ''));
const exists = f => fs.existsSync(path.join(root, f));
const version = '18.0.11';

const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '18\.0\.11'/);
assert.match(read('api/_version.js'), /APP_VERSION = '18\.0\.11'/);
assert.match(read('api/_version.js'), /SECURITY_SCHEMA_VERSION = '18\.0\.11'/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '18\.0\.11'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '18\.0\.11'/);

for (const f of [
  'test-tools/certification/groups.json',
  'test-tools/certification/cost-performance-baselines.json',
  'test-tools/regressions/registry.json'
]) assert.equal(json(f).release, version);

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-18-0-11.js');
assert.equal(pkg.scripts['validate:18.0.11'], 'node scripts/validate-18-0-11.js');
assert.equal(pkg.scripts['test:repair:18.0.11'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-owned-full-fidelity-17-0-84\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-18-0-11.js'));

const profile = 'tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs';
const ghostSpec = 'tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs';
const exportSpec = 'tests/86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs';
const chunkSpec = 'tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs';
const coverageSpec = 'tests/86chaos-release-gate/21-runtime-code-coverage.spec.cjs';
const nodeRegression = 'api/release-gate-owned-full-fidelity-17-0-84.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/96-owned-full-fidelity-17-0-84.spec.cjs';
const e2eSpec = 'tests/e2e/owned-full-fidelity-17-0-84.spec.cjs';

for (const f of [profile, ghostSpec, exportSpec, chunkSpec, coverageSpec, nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_84.md']) {
  assert.equal(exists(f), true, `${f} exists`);
}

assert.match(read(profile), /timeOffPolicy:\s*\{\s*enabled:\s*false,/);
assert.match(read(ghostSpec), /Request Off conflict date cell for \$\{conflictDate\} should be selectable/);
const exportSource = read(exportSpec);
assert.match(exportSource, /let authRecoveries = 0/);
assert.match(exportSource, /never a repeating logout loop/);
assert.match(exportSource, /must remain authenticated after at most one recovery/);
const chunkSource = read(chunkSpec);
assert.match(chunkSource, /recoveredHealthyApp \|\| usableRecoveryUi/);
assert.doesNotMatch(chunkSource, /Repeated chunk failure must provide a usable update\/recovery action/);
const coverageSource = read(coverageSpec);
assert.match(coverageSource, /name: \/open sign out\|log out\/i/);
assert.match(coverageSource, /reload after logout must stay signed out/);
assert.match(coverageSource, /Verified System Administrator must actually enter godmode before runtime coverage is scored/);
assert.doesNotMatch(coverageSource, /page\.context\(\)\.clearCookies\(\)[\s\S]{0,120}about:blank/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /tests\/86chaos-release-gate\/96-owned-full-fidelity-17-0-84\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/owned-full-fidelity-17-0-84\.spec\.cjs/);
assert.ok(json('test-tools/regressions/registry.json').regressions.some(row => row.defectId === 'RG-OWNED-FULL-GATE-FIDELITY-17084'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.84 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches completed 17.0.84 tree');

for (const f of [profile, ghostSpec, exportSpec, chunkSpec, coverageSpec, nodeRegression, releaseSpec, e2eSpec]) {
  const row = manifest.files.find(item => item.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}

console.log('86 Chaos 17.0.84 owned full-gate fidelity repair validation PASS');

}

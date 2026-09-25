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

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const app = read('src/App.js');
const common = read('src/components/common.jsx');
const css = read('src/concept17.css');
const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');

assert.equal(pkg.version, '17.1.15');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Authenticated App Shell Hook-Order Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-1-15.js');
assert.equal(pkg.scripts['validate:17.1.15'], 'node scripts/validate-17-1-15.js');
assert(pkg.scripts['test:repair:17.1.15']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.1.15'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/app-shell-hook-order-17-1-15.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/vercel-reference-asset-resolution-17-1-14.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/pixel-reference-full-app-17-1-13.test.cjs'));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.1.15'), `${file} carries 17.1.15`);
for (const file of [
  'test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches`);

const hook = app.indexOf('const openVoiceFromShell = useCallback(() => {');
const labelsReturn = app.indexOf('if (labelsToPrint) return');
const hydrationReturn = app.indexOf('if (cachedSessionAccessHydrating) {');
const loginReturn = app.indexOf('if (!liveAppUser) return <I18nProvider');
assert(hook > 0, 'shared 86Voice callback exists');
assert(hook < labelsReturn, 'hook is above label-print early return');
assert(hook < hydrationReturn, 'hook is above session-hydration early return');
assert(hook < loginReturn, 'hook is above signed-out early return');
assert(!/\buse(?:State|Effect|Memo|Callback|Ref|Reducer|Context|LayoutEffect|DeferredValue|ImperativeHandle)\s*\(/.test(app.slice(labelsReturn)), 'no App hook is declared after first conditional App return');
assert(app.includes('onVoice={openVoiceFromShell}'), 'App passes the shared Voice callback to real shell surfaces');
assert(common.includes('data-testid="drawer-86voice-button"'), 'shared DrawerMenu visibly preserves 86Voice access');
assert(common.includes('window.setTimeout(() => onVoice(), 40)'), 'shared DrawerMenu calls the App Voice controller');

assert(css.includes('17.1.13 approved-reference full-app visual parity pass'), 'approved redesign carry-forward marker remains');
assert(css.includes('17.1.14 Vercel-safe reference asset resolution repair'), 'Vercel asset repair carry-forward marker remains');
assert(!css.includes("url('/concept17-kitchen-reference.jpg')"), 'Vercel-breaking root URL remains removed');
assert(css.includes('var(--c17-ref-kitchen-image)'), 'reference surfaces still use Vercel-safe image variable');
const data = css.match(/--c17-ref-kitchen-image:\s*url\("data:image\/jpeg;base64,([^"]+)"\);/);
assert(data, 'embedded reference JPEG data URI exists');
const decoded = Buffer.from(data[1], 'base64');
const original = fs.readFileSync(path.join(root, 'public/concept17-kitchen-reference.jpg'));
assert.equal(sha256(decoded), sha256(original), 'embedded image remains byte-identical to approved reference');

assert(exists('RELEASE_17_1_15.md'));
assert(exists('api/app-shell-hook-order-17-1-15.test.cjs'));
assert(exists('tests/86chaos-new-implementations/29-authenticated-shell-hook-order.spec.cjs'));
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.1.15'"));
assert(scope.includes('29-authenticated-shell-hook-order.spec.cjs'));
assert(scope.includes('28-approved-reference-full-app-parity.spec.cjs'));

const manifestPath = path.join(root, 'release-source-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = json('release-source-manifest.json');
  const identity = captureSourceIdentity(root);
  assert.equal(manifest.version, pkg.version, 'release source manifest version matches');
  assert.equal(manifest.sourceHash, identity.sourceHash, 'release source manifest matches current source tree');
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.sourceHash, 'source manifest self-hash is valid');
  assert.deepEqual(manifest.files, identity.files, 'source manifest inventory matches');
  const buildIdentity = json('public/build-identity.json');
  assert.equal(buildIdentity.version, pkg.version, 'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash, identity.sourceHash, 'build identity source hash matches manifest');
}

console.log('17.1.15 authenticated App-shell hook-order repair validation passed; approved redesign and all carry-forward protections remain intact.');

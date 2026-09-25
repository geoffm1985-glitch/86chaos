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
const css = read('src/concept17.css');
const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');

assert.equal(pkg.version, '17.1.14');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Vercel Reference Asset Resolution Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-1-14.js');
assert.equal(pkg.scripts['validate:17.1.14'], 'node scripts/validate-17-1-14.js');
assert(pkg.scripts['test:repair:17.1.14']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.1.14'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/vercel-reference-asset-resolution-17-1-14.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/pixel-reference-full-app-17-1-13.test.cjs'));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.1.14'), `${file} carries 17.1.14`);
for (const file of [
  'test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches`);

assert(css.includes('17.1.13 approved-reference full-app visual parity pass'), 'approved redesign carry-forward marker remains');
assert(css.includes('17.1.14 Vercel-safe reference asset resolution repair'), 'deployment repair marker exists');
assert(!css.includes("url('/concept17-kitchen-reference.jpg')"), 'Vercel-breaking root URL is removed');
assert(css.includes('var(--c17-ref-kitchen-image)'), 'reference surfaces use Vercel-safe image variable');
const data = css.match(/--c17-ref-kitchen-image:\s*url\(\"data:image\/jpeg;base64,([^\"]+)\"\);/);
assert(data, 'embedded reference JPEG data URI exists');
const decoded = Buffer.from(data[1], 'base64');
const original = fs.readFileSync(path.join(root, 'public/concept17-kitchen-reference.jpg'));
assert.equal(sha256(decoded), sha256(original), 'embedded image is byte-identical to approved reference');
assert(exists('RELEASE_17_1_14.md'));
assert(exists('api/vercel-reference-asset-resolution-17-1-14.test.cjs'));
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.1.14'"));
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

console.log('17.1.14 Vercel reference-asset repair validation passed; targeted source/deployment regression is clean.');

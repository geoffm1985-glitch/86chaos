'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.69';
const target = 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.69'/);
assert.match(read('api/_version.js'), /17\.0\.69/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.69'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.69'"));
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-69.js');
assert.equal(pkg.scripts['validate:17.0.69'], 'node scripts/validate-17-0-69.js');
assert.equal(pkg.scripts['test:repair:17.0.69'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-source-manifest-authority-17-0-69\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-69.js'));

for (const file of [
  'api/release-gate-source-manifest-authority-17-0-69.test.cjs',
  'tests/86chaos-release-gate/81-source-manifest-authority-17-0-69.spec.cjs',
  'tests/e2e/source-manifest-authority-17-0-69.spec.cjs',
  'RELEASE_17_0_69.md',
]) assert.equal(exists(file), true, `${file} exists`);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
const releaseSpec = 'tests/86chaos-release-gate/81-source-manifest-authority-17-0-69.spec.cjs';
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /81-source-manifest-authority-17-0-69\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/source-manifest-authority-17-0-69\.spec\.cjs/);

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.69 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches the completed 17.0.69 tree');
const targetRow = manifest.files.find(row => row.file === target);
assert.ok(targetRow, `${target} is sealed in the manifest`);
assert.equal(targetRow.sha256, identityApi.hash(identityApi.sourceBytes(target, fs.readFileSync(path.join(root, target)))));

console.log('86 Chaos 17.0.69 source manifest authority repair validation PASS');

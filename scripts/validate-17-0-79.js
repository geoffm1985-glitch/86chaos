'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const exists = f => fs.existsSync(path.join(root, f));
const version = '17.0.79';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.79'/);
assert.match(read('api/_version.js'), /17\.0\.79/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '17\.0\.79'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '17\.0\.79'/);
for (const f of ['test-tools/certification/groups.json', 'test-tools/certification/cost-performance-baselines.json', 'test-tools/regressions/registry.json']) assert.equal(json(f).release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-79.js');
assert.equal(pkg.scripts['validate:17.0.79'], 'node scripts/validate-17-0-79.js');
assert.equal(pkg.scripts['test:repair:17.0.79'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-emulator-runtime-equivalent-baseline-17-0-79\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-79.js'));

const nodeRegression = 'api/release-gate-emulator-runtime-equivalent-baseline-17-0-79.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/91-emulator-runtime-equivalent-baseline-17-0-79.spec.cjs';
const e2eSpec = 'tests/e2e/emulator-runtime-equivalent-baseline-17-0-79.spec.cjs';
for (const f of [nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_79.md']) assert.equal(exists(f), true, `${f} exists`);

const helper = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
assert.match(helper, /EXPLICIT_RUNTIME_EQUIVALENT_BASELINE_PAIRS/);
assert.match(helper, /'17\.0\.77\|17\.0\.76'/);
assert.match(helper, /firebaseTarget/);
assert.match(helper, /demo-86chaos/);
assert.match(helper, /runtime behavior is unchanged/i);
assert.match(helper, /baselineVersionsAreCompatible/);
assert.match(helper, /isExplicitRuntimeEquivalentEmulatorBaseline/);
assert.match(read('RELEASE_17_0_77.md'), /Runtime behavior is unchanged/i);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /91-emulator-runtime-equivalent-baseline-17-0-79\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/emulator-runtime-equivalent-baseline-17-0-79\.spec\.cjs/);
assert.ok(json('test-tools/regressions/registry.json').regressions.some(r => r.defectId === 'RG-MANAGED-EMULATOR-BASELINE-LINEAGE-17079'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.79 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches completed 17.0.79 tree');
for (const f of [nodeRegression, releaseSpec, e2eSpec, 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs']) {
  const row = manifest.files.find(x => x.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}

console.log('86 Chaos 17.0.79 managed emulator baseline lineage repair validation PASS');

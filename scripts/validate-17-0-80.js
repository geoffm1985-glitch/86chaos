'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f).replace(/^\uFEFF/, ''));
const exists = f => fs.existsSync(path.join(root, f));
const version = '17.0.80';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.80'/);
assert.match(read('api/_version.js'), /17\.0\.80/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '17\.0\.80'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '17\.0\.80'/);
for (const f of ['test-tools/certification/groups.json', 'test-tools/certification/cost-performance-baselines.json', 'test-tools/regressions/registry.json']) assert.equal(json(f).release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-80.js');
assert.equal(pkg.scripts['validate:17.0.80'], 'node scripts/validate-17-0-80.js');
assert.equal(pkg.scripts['test:repair:17.0.80'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-failure-lineage-baseline-17-0-80\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-80.js'));

const nodeRegression = 'api/release-gate-failure-lineage-baseline-17-0-80.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/92-failure-lineage-baseline-17-0-80.spec.cjs';
const e2eSpec = 'tests/e2e/failure-lineage-baseline-17-0-80.spec.cjs';
for (const f of [nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_80.md']) assert.equal(exists(f), true, `${f} exists`);

const helper = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
assert.match(helper, /isExplicitCompletedFailureLineage/);
assert.match(helper, /17\.0\.77\|17\.0\.76/);
assert.match(helper, /full-failure-lineage/);
assert.match(helper, /unexpected > 0/);
assert.match(helper, /baselineVersionsAreCompatible\(meta\) \|\| isExplicitCompletedFailureLineage\(meta, completed\)/);
assert.match(helper, /isExplicitRuntimeEquivalentEmulatorBaseline/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /92-failure-lineage-baseline-17-0-80\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/failure-lineage-baseline-17-0-80\.spec\.cjs/);
assert.ok(json('test-tools/regressions/registry.json').regressions.some(r => r.defectId === 'RG-COMPLETED-FULL-FAILURE-LINEAGE-17080'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.80 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches completed 17.0.80 tree');
for (const f of [nodeRegression, releaseSpec, e2eSpec, 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs']) {
  const row = manifest.files.find(x => x.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}

console.log('86 Chaos 17.0.80 completed full failure-lineage recovery validation PASS');

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.71';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.71'/);
assert.match(read('api/_version.js'), /17\.0\.71/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.71'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.71'"));
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-71.js');
assert.equal(pkg.scripts['validate:17.0.71'], 'node scripts/validate-17-0-71.js');
assert.equal(pkg.scripts['test:repair:17.0.71'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /failed-only-manifest-emulator-target-17-0-71\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-71.js'));

const crossVersion = read('api/failed-only-manifest-cross-version.test.cjs');
assert.match(crossVersion, /const \{ expectedFirebaseProject \} = require\('\.\.\/scripts\/86chaos-firebase-target\.cjs'\);/);
assert.equal((crossVersion.match(/firebaseProjectId: expectedFirebaseProject\(process\.env\)/g) || []).length, 3);
assert.match(crossVersion, /environment-preflight\.json'\), \{ runId: 'baseline-run',[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);

const nodeRegression = 'api/failed-only-manifest-emulator-target-17-0-71.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/83-failed-only-manifest-emulator-target-17-0-71.spec.cjs';
const e2eSpec = 'tests/e2e/failed-only-manifest-emulator-target-17-0-71.spec.cjs';
for (const file of [nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_71.md']) {
  assert.equal(exists(file), true, `${file} exists`);
}

const nodeSource = read(nodeRegression);
assert.match(nodeSource, /runCrossVersionFixture\('emulator'\)/);
assert.match(nodeSource, /runCrossVersionFixture\('live'\)/);
assert.match(nodeSource, /# pass 11/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec), '17.0.71 release-gate regression is mandatory');
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /83-failed-only-manifest-emulator-target-17-0-71\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/failed-only-manifest-emulator-target-17-0-71\.spec\.cjs/);

const registry = json('test-tools/regressions/registry.json');
assert.ok(registry.regressions.some(row => row.defectId === 'RG-FAILED-ONLY-EMULATOR-TARGET-17071'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.71 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches the completed 17.0.71 tree');
const repairedRow = manifest.files.find(row => row.file === 'api/failed-only-manifest-cross-version.test.cjs');
assert.ok(repairedRow, 'repaired cross-version fixture is sealed in the manifest');
assert.equal(repairedRow.sha256, identityApi.hash(identityApi.sourceBytes(repairedRow.file, fs.readFileSync(path.join(root, repairedRow.file)))));

console.log('86 Chaos 17.0.71 failed-only manifest emulator target repair validation PASS');

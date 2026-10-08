'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.72';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.72'/);
assert.match(read('api/_version.js'), /17\.0\.72/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.72'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.72'"));
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-72.js');
assert.equal(pkg.scripts['validate:17.0.72'], 'node scripts/validate-17-0-72.js');
assert.equal(pkg.scripts['test:repair:17.0.72'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /failed-only-manifest-reporter-independence-17-0-72\.test\.cjs/);
assert.match(pkg.scripts['test:current-release-targeted'], /failed-only-manifest-emulator-target-17-0-71\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-72.js'));

const crossVersion = read('api/failed-only-manifest-cross-version.test.cjs');
assert.match(crossVersion, /const \{ expectedFirebaseProject \} = require\('\.\.\/scripts\/86chaos-firebase-target\.cjs'\);/);
assert.equal((crossVersion.match(/firebaseProjectId: expectedFirebaseProject\(process\.env\)/g) || []).length, 3);
assert.match(crossVersion, /environment-preflight\.json'\), \{ runId: 'baseline-run',[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);

const repairedWrapper = 'api/failed-only-manifest-emulator-target-17-0-71.test.cjs';
const nodeRegression = 'api/failed-only-manifest-reporter-independence-17-0-72.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/84-failed-only-manifest-reporter-independence-17-0-72.spec.cjs';
const e2eSpec = 'tests/e2e/failed-only-manifest-reporter-independence-17-0-72.spec.cjs';
for (const file of [repairedWrapper, nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_72.md']) {
  assert.equal(exists(file), true, `${file} exists`);
}

const wrapperSource = read(repairedWrapper);
assert.match(wrapperSource, /assert\.equal\(result\.status, 0/);
assert.doesNotMatch(wrapperSource, /# pass 11/);
assert.doesNotMatch(wrapperSource, /# fail 0/);
assert.match(wrapperSource, /Target Firebase project must be demo-86chaos/);

const nodeSource = read(nodeRegression);
assert.match(nodeSource, /NODE_OPTIONS: '--test-reporter=spec'/);
assert.match(nodeSource, /failed-only-manifest-emulator-target-17-0-71\.test\.cjs/);
assert.match(nodeSource, /assert\.equal\(result\.status, 0, output\)/);

const releaseSource = read(releaseSpec);
assert.match(releaseSource, /not\.toContain\('# pass 11'\)/);
assert.match(releaseSource, /failed-only-manifest-reporter-independence-17-0-72\.test\.cjs/);
const e2eSource = read(e2eSpec);
assert.match(e2eSource, /RELEASE_CRITICAL_SPECS/);
assert.match(e2eSource, /testing-targeted-delta\.yml/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec), '17.0.72 release-gate regression is mandatory');
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /84-failed-only-manifest-reporter-independence-17-0-72\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/failed-only-manifest-reporter-independence-17-0-72\.spec\.cjs/);

const registry = json('test-tools/regressions/registry.json');
assert.ok(registry.regressions.some(row => row.defectId === 'RG-NESTED-NODE-REPORTER-INDEPENDENCE-17072'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.72 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches the completed 17.0.72 tree');
for (const sealedFile of [repairedWrapper, nodeRegression, releaseSpec, e2eSpec]) {
  const repairedRow = manifest.files.find(row => row.file === sealedFile);
  assert.ok(repairedRow, `${sealedFile} is sealed in the manifest`);
  assert.equal(repairedRow.sha256, identityApi.hash(identityApi.sourceBytes(repairedRow.file, fs.readFileSync(path.join(root, repairedRow.file)))));
}

console.log('86 Chaos 17.0.72 nested Node reporter independence repair validation PASS');

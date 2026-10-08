'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.73';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.73'/);
assert.match(read('api/_version.js'), /17\.0\.73/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.73'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.73'"));
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-73.js');
assert.equal(pkg.scripts['validate:17.0.73'], 'node scripts/validate-17-0-73.js');
assert.equal(pkg.scripts['test:repair:17.0.73'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /failed-only-repair-selection-emulator-target-17-0-73\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-73.js'));

const fixture = read('api/failed-only-repair-selection-16-0-153.test.cjs');
assert.match(fixture, /const \{ expectedFirebaseProject \} = require\('\.\.\/scripts\/86chaos-firebase-target\.cjs'\);/);
assert.match(fixture, /environment-preflight\.json'\), \{[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);
assert.match(fixture, /currentSourceVersion: '16\.0\.159'[\s\S]*firebaseProjectId: expectedFirebaseProject\(process\.env\)/);

const nodeRegression = 'api/failed-only-repair-selection-emulator-target-17-0-73.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/85-failed-only-repair-selection-emulator-target-17-0-73.spec.cjs';
const e2eSpec = 'tests/e2e/failed-only-repair-selection-emulator-target-17-0-73.spec.cjs';
for (const file of [nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_73.md']) assert.equal(exists(file), true, `${file} exists`);

const nodeSource = read(nodeRegression);
assert.match(nodeSource, /for \(const target of \['emulator', 'live'\]\)/);
assert.match(nodeSource, /failed-only-repair-selection-16-0-153\.test\.cjs/);
assert.match(nodeSource, /assert\.equal\(result\.status, 0/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec), '17.0.73 release-gate regression is mandatory');
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /85-failed-only-repair-selection-emulator-target-17-0-73\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/failed-only-repair-selection-emulator-target-17-0-73\.spec\.cjs/);

const registry = json('test-tools/regressions/registry.json');
assert.ok(registry.regressions.some(row => row.defectId === 'RG-FAILED-ONLY-RECOVERY-EMULATOR-TARGET-17073'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.73 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches the completed 17.0.73 tree');
for (const sealedFile of ['api/failed-only-repair-selection-16-0-153.test.cjs', nodeRegression, releaseSpec, e2eSpec]) {
  const repairedRow = manifest.files.find(row => row.file === sealedFile);
  assert.ok(repairedRow, `${sealedFile} is sealed in the manifest`);
  assert.equal(repairedRow.sha256, identityApi.hash(identityApi.sourceBytes(repairedRow.file, fs.readFileSync(path.join(root, repairedRow.file)))));
}

console.log('86 Chaos 17.0.73 failed-only recovery emulator target repair validation PASS');

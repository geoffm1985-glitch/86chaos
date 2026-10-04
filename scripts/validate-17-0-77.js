'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.77';

const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.77'/);
assert.match(read('api/_version.js'), /17\.0\.77/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.77'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.77'"));

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-77.js');
assert.equal(pkg.scripts['validate:17.0.77'], 'node scripts/validate-17-0-77.js');
assert.equal(pkg.scripts['test:repair:17.0.77'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-server-certification-drift-17-0-77\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-77.js'));

const hostile = read('api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs');
assert.match(hostile, /scripts\?\.\['test:source'\]/);
assert.match(hostile, /validatorMatch\[1\]/);
assert.doesNotMatch(hostile, /cp\.spawnSync\(process\.execPath, \['scripts\/validate-17-0-70\.js'\]/);

const maturity207 = read('api/release-gate-maturity-16-0-207.test.cjs');
assert.match(maturity207, /role="tab"\[\\s\\S\]\{0,180\}aria-label/);

const maturity209 = read('api/release-gate-maturity-16-0-209.test.cjs');
assert.match(maturity209, /getByTestId\\\('schedule-copilot-warnings-tab'/);

const observability = read('api/release-gate-runner-observability.test.cjs');
assert.match(observability, /yardmaster-dependency-install\.cjs/);
assert.match(observability, /dependencyInstaller/);
assert.match(observability, /'--timeout','1800'/);

const coverage = read('api/schedule-warning-request-off-controls.test.cjs');
assert.match(coverage, /assert\.equal\(rows\[0\]\.existing, 2\)/);
assert.match(coverage, /assert\.equal\(rows\[0\]\.target, 1\)/);
assert.match(coverage, /assert\.equal\(rows\[0\]\.over, 1\)/);

const spanish = read('api/spanish-release-gate-fidelity-17-0-29.test.cjs');
assert.match(spanish, /toHaveAttribute.*value/);
assert.match(spanish, /selectOption.*value/);
assert.match(spanish, /saveLanguagePreference.*es/);

const nodeRegression = 'api/release-gate-server-certification-drift-17-0-77.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs';
const e2eSpec = 'tests/e2e/server-certification-drift-17-0-77.spec.cjs';
for (const file of [nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_77.md']) assert.equal(exists(file), true, file + ' exists');

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec), '17.0.77 release-gate regression is mandatory');
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /89-server-certification-drift-17-0-77\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/server-certification-drift-17-0-77\.spec\.cjs/);

const registry = json('test-tools/regressions/registry.json');
assert.ok(registry.regressions.some(row => row.defectId === 'RG-SERVER-CERTIFICATION-DRIFT-17077'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.77 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches the completed 17.0.77 tree');

for (const sealedFile of [
  'api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs',
  'api/release-gate-maturity-16-0-207.test.cjs',
  'api/release-gate-maturity-16-0-209.test.cjs',
  'api/release-gate-runner-observability.test.cjs',
  'api/schedule-warning-request-off-controls.test.cjs',
  'api/spanish-release-gate-fidelity-17-0-29.test.cjs',
  nodeRegression,
  releaseSpec,
  e2eSpec,
]) {
  const row = manifest.files.find(item => item.file === sealedFile);
  assert.ok(row, sealedFile + ' is sealed in the manifest');
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}

console.log('86 Chaos 17.0.77 server certification drift repair validation PASS');

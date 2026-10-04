'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.75';

const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.75'/);
assert.match(read('api/_version.js'), /17\.0\.75/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(
  json('test-tools/certification/cost-performance-baselines.json').release,
  version
);
assert.equal(json('test-tools/regressions/registry.json').release, version);

assert.ok(
  read('src/core/customerHelpKnowledge.cjs').includes(
    "CUSTOMER_HELP_VERSION = '17.0.75'"
  )
);

assert.ok(
  read('src/core/customerHelpKnowledge.js').includes(
    "CUSTOMER_HELP_VERSION = '17.0.75'"
  )
);

assert.equal(
  pkg.scripts['test:source'],
  'node scripts/validate-17-0-75.js'
);

assert.equal(
  pkg.scripts['validate:17.0.75'],
  'node scripts/validate-17-0-75.js'
);

assert.equal(
  pkg.scripts['test:repair:17.0.75'],
  'npm run test:current-release-targeted'
);

assert.match(
  pkg.scripts['test:current-release-targeted'],
  /qa-role-fixture-emulator-target-17-0-75\.test\.cjs/
);

assert.ok(
  pkg.scripts['test:current-release-targeted'].endsWith(
    'node scripts/validate-17-0-75.js'
  )
);

const roleSource = read('api/qa-role-definitions.test.cjs');

assert.match(roleSource, /EXPECTED_FIREBASE_PROJECT/);
assert.match(
  roleSource,
  /firebaseProjectId: EXPECTED_FIREBASE_PROJECT/
);
assert.match(
  roleSource,
  /runtimeProjectId: EXPECTED_FIREBASE_PROJECT/
);
assert.match(
  roleSource,
  /analyzeRoleRows\(baseRows, EXPECTED_FIREBASE_PROJECT\)/
);
assert.match(
  roleSource,
  /analyzeRoleRows\(badRows, EXPECTED_FIREBASE_PROJECT\)/
);
assert.doesNotMatch(
  roleSource,
  /firebaseProjectId: 'chaos-test-d1601'/
);

const nodeRegression =
  'api/qa-role-fixture-emulator-target-17-0-75.test.cjs';

const releaseSpec =
  'tests/86chaos-release-gate/87-qa-role-emulator-target-17-0-75.spec.cjs';

const e2eSpec =
  'tests/e2e/qa-role-emulator-target-17-0-75.spec.cjs';

for (const file of [
  nodeRegression,
  releaseSpec,
  e2eSpec,
  'RELEASE_17_0_75.md'
]) {
  assert.equal(exists(file), true, file + ' exists');
}

const nodeSource = read(nodeRegression);

assert.match(nodeSource, /runRoleFixture\('emulator'\)/);
assert.match(nodeSource, /runRoleFixture\('live'\)/);
assert.match(
  nodeSource,
  /expectedFirebaseProject\(env\), 'demo-86chaos'/
);
assert.match(
  nodeSource,
  /expectedFirebaseProject\(env\), 'chaos-test-d1601'/
);

const universe = require(
  './86chaos-release-gate/release-test-universe.cjs'
);

assert.ok(
  universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec),
  '17.0.75 release-gate regression is mandatory'
);

const workflow = read(
  '.github/workflows/testing-targeted-delta.yml'
);

assert.match(
  workflow,
  /87-qa-role-emulator-target-17-0-75\.spec\.cjs/
);

assert.match(
  workflow,
  /tests\/e2e\/qa-role-emulator-target-17-0-75\.spec\.cjs/
);

const registry = json('test-tools/regressions/registry.json');

assert.ok(
  registry.regressions.some(
    row => row.defectId === 'RG-QA-ROLE-EMULATOR-TARGET-17075'
  )
);

const identityApi = require(
  './86chaos-release-gate/source-identity.cjs'
);

const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');

assert.equal(manifest.version, version);

assert.equal(
  manifest.sourceHash,
  identity.sourceHash,
  'bundled release source manifest matches current 17.0.75 source'
);

assert.deepEqual(
  manifest.files,
  identity.files,
  'bundled manifest file inventory matches the completed 17.0.75 tree'
);

for (const sealedFile of [
  'api/qa-role-definitions.test.cjs',
  nodeRegression,
  releaseSpec,
  e2eSpec
]) {
  const row = manifest.files.find(
    item => item.file === sealedFile
  );

  assert.ok(
    row,
    sealedFile + ' is sealed in the manifest'
  );

  assert.equal(
    row.sha256,
    identityApi.hash(
      identityApi.sourceBytes(
        row.file,
        fs.readFileSync(path.join(root, row.file))
      )
    )
  );
}

console.log(
  '86 Chaos 17.0.75 QA role emulator target fixture repair validation PASS'
);

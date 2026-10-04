'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));

const version = '17.0.74';
const nodeRegression =
  'api/partial-run-evidence-emulator-target-17-0-74.test.cjs';
const releaseSpec =
  'tests/86chaos-release-gate/86-partial-run-evidence-emulator-target-17-0-74.spec.cjs';
const e2eSpec =
  'tests/e2e/partial-run-evidence-emulator-target-17-0-74.spec.cjs';

const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);

assert.match(
  read('src/core/appCore.js'),
  /CURRENT_VERSION = '17\.0\.74'/
);
assert.match(read('api/_version.js'), /17\.0\.74/);

assert.equal(
  json('test-tools/certification/groups.json').release,
  version
);
assert.equal(
  json('test-tools/certification/cost-performance-baselines.json').release,
  version
);
assert.equal(
  json('test-tools/regressions/registry.json').release,
  version
);

assert.ok(
  read('src/core/customerHelpKnowledge.cjs')
    .includes("CUSTOMER_HELP_VERSION = '17.0.74'")
);
assert.ok(
  read('src/core/customerHelpKnowledge.js')
    .includes("CUSTOMER_HELP_VERSION = '17.0.74'")
);

assert.equal(
  pkg.scripts['test:source'],
  'node scripts/validate-17-0-74.js'
);
assert.equal(
  pkg.scripts['validate:17.0.74'],
  'node scripts/validate-17-0-74.js'
);
assert.equal(
  pkg.scripts['test:repair:17.0.74'],
  'npm run test:current-release-targeted'
);
assert.match(
  pkg.scripts['test:current-release-targeted'],
  /partial-run-evidence-emulator-target-17-0-74\.test\.cjs/
);
assert.ok(
  pkg.scripts['test:current-release-targeted']
    .endsWith('node scripts/validate-17-0-74.js')
);

const legacy =
  read('api/partial-run-evidence-16-0-231.test.cjs');

assert.match(
  legacy,
  /const \{ expectedFirebaseProject \} = require\('\.\.\/scripts\/86chaos-firebase-target\.cjs'\);/
);
assert.equal(
  (
    legacy.match(
      /firebaseProjectId: expectedFirebaseProject\(process\.env\)/g
    ) || []
  ).length,
  2
);
assert.doesNotMatch(
  legacy,
  /firebaseProjectId: 'chaos-test-d1601'/
);
assert.match(
  legacy,
  /\['firebaseProjectId', 'cheers-34b8d'\]/
);

for (const file of [
  nodeRegression,
  releaseSpec,
  e2eSpec,
  'RELEASE_17_0_74.md',
]) {
  assert.equal(exists(file), true, `${file} exists`);
}

const nodeSource = read(nodeRegression);
assert.match(
  nodeSource,
  /for \(const target of \['emulator', 'live'\]\)/
);
assert.match(
  nodeSource,
  /assert\.equal\(result\.status, 0, output\)/
);

const releaseSource = read(releaseSpec);
assert.match(releaseSource, /expectedFirebaseProject/);

const independentSource = read(e2eSpec);
assert.match(independentSource, /RELEASE_CRITICAL_SPECS/);
assert.match(
  independentSource,
  /testing-targeted-delta\.yml/
);

const universe =
  require('./86chaos-release-gate/release-test-universe.cjs');

assert.ok(
  universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec),
  '17.0.74 release-gate regression is mandatory'
);

const workflow =
  read('.github/workflows/testing-targeted-delta.yml');

assert.ok(workflow.includes(releaseSpec));
assert.ok(workflow.includes(e2eSpec));

const registry =
  json('test-tools/regressions/registry.json');

assert.ok(
  registry.regressions.some(
    row =>
      row.defectId ===
      'RG-PARTIAL-RESUME-EMULATOR-TARGET-17074'
  )
);

const identityApi =
  require('./86chaos-release-gate/source-identity.cjs');

const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');

assert.equal(manifest.version, version);
assert.equal(
  manifest.sourceHash,
  identity.sourceHash,
  'bundled release source manifest matches current 17.0.74 source'
);
assert.deepEqual(
  manifest.files,
  identity.files,
  'bundled manifest file inventory matches the completed 17.0.74 tree'
);

for (const sealedFile of [
  'api/partial-run-evidence-16-0-231.test.cjs',
  nodeRegression,
  releaseSpec,
  e2eSpec,
]) {
  const row =
    manifest.files.find(item => item.file === sealedFile);

  assert.ok(row, `${sealedFile} is sealed in the manifest`);

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
  '86 Chaos 17.0.74 partial-resume Firebase target fixture repair validation PASS'
);
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f).replace(/^\uFEFF/, ''));
const exists = f => fs.existsSync(path.join(root, f));
const version = '17.0.83';

const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.83'/);
assert.match(read('api/_version.js'), /APP_VERSION = '17\.0\.83'/);
assert.match(read('api/_version.js'), /SECURITY_SCHEMA_VERSION = '17\.0\.83'/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '17\.0\.83'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '17\.0\.83'/);

for (const f of [
  'test-tools/certification/groups.json',
  'test-tools/certification/cost-performance-baselines.json',
  'test-tools/regressions/registry.json'
]) {
  assert.equal(json(f).release, version);
}

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-83.js');
assert.equal(pkg.scripts['validate:17.0.83'], 'node scripts/validate-17-0-83.js');
assert.equal(pkg.scripts['test:repair:17.0.83'], 'npm run test:current-release-targeted');
assert.match(
  pkg.scripts['test:current-release-targeted'],
  /release-gate-request-off-maturity-refactor-17-0-83\.test\.cjs/
);
assert.ok(
  pkg.scripts['test:current-release-targeted'].endsWith(
    'node scripts/validate-17-0-83.js'
  )
);

const historical = 'api/release-gate-maturity-16-0-210.test.cjs';
const nodeRegression =
  'api/release-gate-request-off-maturity-refactor-17-0-83.test.cjs';
const helper =
  'tests/e2e/utils/schedule-request-off-fixture-anchor.cjs';
const requestOffSpec =
  'tests/e2e/schedule-request-off-management.spec.cjs';
const releaseSpec =
  'tests/86chaos-release-gate/95-request-off-maturity-refactor-17-0-83.spec.cjs';
const e2eSpec =
  'tests/e2e/request-off-maturity-refactor-17-0-83.spec.cjs';

for (const f of [
  historical,
  nodeRegression,
  helper,
  requestOffSpec,
  releaseSpec,
  e2eSpec,
  'RELEASE_17_0_83.md'
]) {
  assert.equal(exists(f), true, `${f} exists`);
}

const maturity = read(historical);
assert.match(
  maturity,
  /const anchorHelper = read\('tests\/e2e\/utils\/schedule-request-off-fixture-anchor\.cjs'\)/
);
assert.match(
  maturity,
  /assert\.match\(anchorHelper, \/return fixture\\\.currentWeekStart/
);
assert.doesNotMatch(
  maturity,
  /assert\.match\(spec, \/return fixture\\\.currentWeekStart/
);

const helperSource = read(helper);
assert.match(
  helperSource,
  /return fixture\.currentWeekStart \|\| overCoverageDate \|\| fixture\.anchor/
);

const requestSource = read(requestOffSpec);
assert.match(requestSource, /scheduleFixtureDateFromSeed/);
assert.match(
  requestSource,
  /fixtureDateOverride \|\| scheduleFixtureDateFromSeed\(seed\)/
);
assert.match(
  requestSource,
  /request-off-workflow-panel div\.font-black\.text-white\.text-sm/
);

const nodeSource = read(nodeRegression);
assert.match(
  nodeSource,
  /historical 16\.0\.210 maturity check follows the extracted Request Off anchor helper/
);
assert.match(
  nodeSource,
  /archive-only maturity evidence remains attached to the real Request Off workflow row/
);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));

const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(
  workflow,
  /tests\/86chaos-release-gate\/95-request-off-maturity-refactor-17-0-83\.spec\.cjs/
);
assert.match(
  workflow,
  /tests\/e2e\/request-off-maturity-refactor-17-0-83\.spec\.cjs/
);

assert.ok(
  json('test-tools/regressions/registry.json').regressions.some(
    row => row.defectId === 'RG-REQUEST-OFF-MATURITY-REFACTOR-17083'
  )
);

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');

assert.equal(manifest.version, version);
assert.equal(
  manifest.sourceHash,
  identity.sourceHash,
  'bundled release source manifest matches current 17.0.83 source'
);
assert.deepEqual(
  manifest.files,
  identity.files,
  'bundled manifest file inventory matches completed 17.0.83 tree'
);

for (const f of [
  historical,
  nodeRegression,
  helper,
  requestOffSpec,
  releaseSpec,
  e2eSpec
]) {
  const row = manifest.files.find(item => item.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
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
  '86 Chaos 17.0.83 Request Off maturity refactor certification repair validation PASS'
);
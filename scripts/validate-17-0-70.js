'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const version = '17.0.70';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.70'/);
assert.match(read('api/_version.js'), /17\.0\.70/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.ok(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.70'"));
assert.ok(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.70'"));
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-70.js');
assert.equal(pkg.scripts['validate:17.0.70'], 'node scripts/validate-17-0-70.js');
assert.equal(pkg.scripts['test:repair:17.0.70'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-hostile-fixture-manifest-17-0-70\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-70.js'));

const historical = read('api/release-gate-execution-17-0-5.test.cjs');
assert.match(historical, /JSON\.stringify\(\{schemaVersion:2,version:initial\.version,sourceHash:initial\.sourceHash,files:initial\.files\}/);
assert.doesNotMatch(historical, /JSON\.stringify\(\{schemaVersion:1,sourceHash:initial\.sourceHash,files:initial\.files\}/);
assert.match(historical, /const good=run\('good-source'/);
assert.match(historical, /assert\.equal\(good\.result\.status,0/);

const releaseSpec = 'tests/86chaos-release-gate/82-release-gate-hostile-fixture-manifest-17-0-70.spec.cjs';
const e2eSpec = 'tests/e2e/release-gate-hostile-fixture-manifest-17-0-70.spec.cjs';
for (const file of [
  'api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs',
  releaseSpec,
  e2eSpec,
  'RELEASE_17_0_70.md',
]) assert.equal(exists(file), true, `${file} exists`);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec), '17.0.70 release-gate regression is mandatory');
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /82-release-gate-hostile-fixture-manifest-17-0-70\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/release-gate-hostile-fixture-manifest-17-0-70\.spec\.cjs/);

const registry = json('test-tools/regressions/registry.json');
assert.ok(registry.regressions.some(row => row.defectId === 'RG-HOSTILE-FIXTURE-MANIFEST-VERSION-17070'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.70 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches the completed 17.0.70 tree');
const repairedRow = manifest.files.find(row => row.file === 'api/release-gate-execution-17-0-5.test.cjs');
assert.ok(repairedRow, 'historical hostile fixture is sealed in the manifest');
assert.equal(repairedRow.sha256, identityApi.hash(identityApi.sourceBytes(repairedRow.file, fs.readFileSync(path.join(root, repairedRow.file)))));

console.log('86 Chaos 17.0.70 hostile fixture manifest version repair validation PASS');

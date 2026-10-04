'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f).replace(/^\uFEFF/, ''));
const exists = f => fs.existsSync(path.join(root, f));
const version = '17.0.82';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.82'/);
assert.match(read('api/_version.js'), /17\.0\.82/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '17\.0\.82'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '17\.0\.82'/);
for (const f of ['test-tools/certification/groups.json', 'test-tools/certification/cost-performance-baselines.json', 'test-tools/regressions/registry.json']) assert.equal(json(f).release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-82.js');
assert.equal(pkg.scripts['validate:17.0.82'], 'node scripts/validate-17-0-82.js');
assert.equal(pkg.scripts['test:repair:17.0.82'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-failed-new-lineage-repair-17-0-82\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-82.js'));

const helper = 'tests/e2e/utils/schedule-request-off-fixture-anchor.cjs';
const nodeRegression = 'api/release-gate-failed-new-lineage-repair-17-0-82.test.cjs';
const repairedServerSpec = 'tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs';
const repairedRequestOffSpec = 'tests/e2e/schedule-request-off-management.spec.cjs';
const releaseSpec = 'tests/86chaos-release-gate/94-failed-new-lineage-repair-17-0-82.spec.cjs';
const e2eSpec = 'tests/e2e/failed-new-lineage-repair-17-0-82.spec.cjs';
for (const f of [helper, nodeRegression, repairedServerSpec, repairedRequestOffSpec, releaseSpec, e2eSpec, 'RELEASE_17_0_82.md']) {
  assert.equal(exists(f), true, `${f} exists`);
}

const helperSource = read(helper);
assert.match(helperSource, /return fixture\.currentWeekStart \|\| overCoverageDate \|\| fixture\.anchor/);
assert.match(helperSource, /function scheduleRequestOffConflictAnchorFromSeed/);
assert.match(helperSource, /return fixture\.anchor \|\| String\(seed\?\.seedAnchorDate \|\| ''\)\.slice\(0, 10\)/);
assert.match(helperSource, /currentWeekStart is 2026-09-28 while Allen's conflict is 2026-10-03/);

const requestOffSource = read(repairedRequestOffSpec);
assert.match(requestOffSource, /scheduleRequestOffConflictAnchorFromSeed/);
assert.match(requestOffSource, /openSchedule\(page, seed, scheduleRequestOffConflictAnchorFromSeed\(seed\)\)/);
assert.match(requestOffSource, /await openSchedule\(page, seed\);/);
assert.match(requestOffSource, /resetSeededRequestOffFixture\(seed, 'allen'\)/);

const serverSource = read(repairedServerSpec);
assert.match(serverSource, /expect\(spanish\)\.toMatch\(\/saveLanguagePreference\/\)/);
const repairedSpanishLine = serverSource.split('\n').find(line => line.includes('expect(spanish).toContain'));
assert.ok(repairedSpanishLine, '17.0.77 Spanish certification source uses literal nested-regex containment');
assert.ok(repairedSpanishLine.includes('saveLanguagePreference\\\\(page,\\\\s*'));
assert.ok(repairedSpanishLine.includes('es'));
assert.doesNotMatch(serverSource, /expect\(spanish\)\.toMatch\(\/saveLanguagePreference\\\(\[\^\)\]\*\['"\]es\['"\]\//);

const nodeSource = read(nodeRegression);
assert.match(nodeSource, /scheduleFixtureDateFromSeed/);
assert.match(nodeSource, /scheduleRequestOffConflictAnchorFromSeed/);
assert.match(nodeSource, /2026-09-28/);
assert.match(nodeSource, /2026-10-04/);
assert.match(nodeSource, /server-certification regression matches the escaped Spanish assertion source instead of pretending it is executable syntax/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /tests\/86chaos-release-gate\/94-failed-new-lineage-repair-17-0-82\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/failed-new-lineage-repair-17-0-82\.spec\.cjs/);
assert.ok(json('test-tools/regressions/registry.json').regressions.some(r => r.defectId === 'RG-FAILED-NEW-LINEAGE-FIDELITY-17082'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.82 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches completed 17.0.82 tree');
for (const f of [helper, nodeRegression, repairedServerSpec, repairedRequestOffSpec, releaseSpec, e2eSpec]) {
  const row = manifest.files.find(x => x.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}

console.log('86 Chaos 17.0.82 failed+new lineage fidelity repair validation PASS');

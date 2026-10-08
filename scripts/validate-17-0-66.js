
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const version = '17.0.66';
const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.66'/);
assert.match(read('api/_version.js'), /17\.0\.66/);
assert.equal(json('test-tools/certification/groups.json').release, version);
assert.equal(json('test-tools/certification/cost-performance-baselines.json').release, version);
assert.equal(json('test-tools/regressions/registry.json').release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-66.js');
assert.equal(pkg.scripts['validate:17.0.66'], 'node scripts/validate-17-0-66.js');
assert.equal(pkg.scripts['test:repair:17.0.66'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-lineage-suite-prefix-17-0-66\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-66.js'));

const utilsSource = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
assert.match(utilsSource, /canonicalSuitePathForSpec/);
assert.match(utilsSource, /normalizeRel\(parts\[0\]\) === normalizeRel\(specPath\)/);
const utils = require('./86chaos-release-gate/failed-only-manifest-utils.cjs');
const specPath = '86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs';
const legacySpec = '86chaos-release-gate\\56-manager-brief-sticky-day-header.spec.cjs';
const suite = '56 Manager Brief runtime + sticky Schedule Builder day header';
const retired = 'Schedule Builder day/date header stays below the sticky control deck during vertical scroll';
const current = 'Schedule Builder day/date header stays pinned while compact control deck scrolls away';
const project = 'mobile-chromium';
const legacySuite = `${legacySpec} > ${suite}`;
const migrated = utils.qualifyManifestSelectionsWithCurrentInventory({
  selected: [{ specPath, title: retired, exactTestTitle: retired, fullSuitePath: legacySuite, fullTitle: `${legacySuite} > ${retired}`, project, projects: [project], priorStatus: 'failed' }],
}, { currentRecords: [{ specPath, title: current, exactTestTitle: current, leafTitle: current, fullSuitePath: suite, fullTitle: `${suite} > ${current}`, suitePathParts: [suite], titlePathParts: [suite, current], project, stableKey: `${specPath}\u0000${suite}\u0000${current}\u0000${project}` }] });
assert.equal(migrated.totalSelected, 1);
assert.equal(migrated.selected[0].exactTestTitle, current);
assert.equal(migrated.selected[0].fullSuitePath, suite);
assert.equal(migrated.selected[0].migratedFromRetiredIdentity, true);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
const releaseSpec = 'tests/86chaos-release-gate/78-release-gate-lineage-suite-prefix-17-0-66.spec.cjs';
const e2eSpec = 'tests/e2e/release-gate-lineage-title-migration.spec.cjs';
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
for (const file of ['api/release-gate-lineage-suite-prefix-17-0-66.test.cjs', releaseSpec, e2eSpec, 'RELEASE_17_0_66.md']) assert.equal(fs.existsSync(path.join(root, file)), true, `${file} exists`);
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /78-release-gate-lineage-suite-prefix-17-0-66\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/release-gate-lineage-title-migration\.spec\.cjs/);
assert.equal(read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '17.0.66'"), true);
assert.equal(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '17.0.66'"), true);

const identity = require('./86chaos-release-gate/source-identity.cjs').captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.66 source');
console.log('86 Chaos 17.0.66 failed+new suite-prefix canonicalization validation PASS');

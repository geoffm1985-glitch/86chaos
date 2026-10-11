'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f).replace(/^\uFEFF/, ''));
const exists = f => fs.existsSync(path.join(root, f));
const version = '17.0.86';

const pkg = json('package.json');
const lock = json('package-lock.json');

assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.86'/);
assert.match(read('api/_version.js'), /APP_VERSION = '17\.0\.86'/);
assert.match(read('api/_version.js'), /SECURITY_SCHEMA_VERSION = '17\.0\.86'/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '17\.0\.86'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '17\.0\.86'/);

for (const f of [
  'test-tools/certification/groups.json',
  'test-tools/certification/cost-performance-baselines.json',
  'test-tools/regressions/registry.json'
]) assert.equal(json(f).release, version);

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-86.js');
assert.equal(pkg.scripts['validate:17.0.86'], 'node scripts/validate-17-0-86.js');
assert.equal(pkg.scripts['test:repair:17.0.86'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-owned-full-fidelity-17-0-84\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-86.js'));

const profile = 'tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs';
const ghostSpec = 'tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs';
const exportSpec = 'tests/86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs';
const chunkSpec = 'tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs';
const coverageSpec = 'tests/86chaos-release-gate/21-runtime-code-coverage.spec.cjs';
const nodeRegression = 'api/release-gate-owned-full-fidelity-17-0-84.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/96-owned-full-fidelity-17-0-84.spec.cjs';
const e2eSpec = 'tests/e2e/owned-full-fidelity-17-0-84.spec.cjs';

for (const f of [profile, ghostSpec, exportSpec, chunkSpec, coverageSpec, nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_84.md']) {
  assert.equal(exists(f), true, `${f} exists`);
}

assert.match(read(profile), /timeOffPolicy:\s*\{\s*enabled:\s*false,/);
assert.match(read(ghostSpec), /Request Off conflict date cell for \$\{conflictDate\} should be selectable/);
const exportSource = read(exportSpec);
assert.match(exportSource, /let authRecoveries = 0/);
assert.match(exportSource, /never a repeating logout loop/);
assert.match(exportSource, /must remain authenticated after at most one recovery/);
const chunkSource = read(chunkSpec);
assert.match(chunkSource, /recoveredHealthyApp \|\| usableRecoveryUi/);
assert.doesNotMatch(chunkSource, /Repeated chunk failure must provide a usable update\/recovery action/);
const coverageSource = read(coverageSpec);
assert.match(coverageSource, /name: \/open sign out\|log out\/i/);
assert.match(coverageSource, /reload after logout must stay signed out/);
assert.match(coverageSource, /Verified System Administrator must actually enter godmode before runtime coverage is scored/);
assert.doesNotMatch(coverageSource, /page\.context\(\)\.clearCookies\(\)[\s\S]{0,120}about:blank/);

const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /tests\/86chaos-release-gate\/96-owned-full-fidelity-17-0-84\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/owned-full-fidelity-17-0-84\.spec\.cjs/);
assert.ok(json('test-tools/regressions/registry.json').regressions.some(row => row.defectId === 'RG-OWNED-FULL-GATE-FIDELITY-17084'));

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.84 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches completed 17.0.84 tree');

for (const f of [profile, ghostSpec, exportSpec, chunkSpec, coverageSpec, nodeRegression, releaseSpec, e2eSpec]) {
  const row = manifest.files.find(item => item.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}

for (const file of ['api/demand-history.js','api/_item-demand-history.js','api/intelligence-connections-17-0-85.test.cjs','api/item-demand-history-17-0-85.test.cjs','src/core/intelligenceConnections.shared.js','src/components/ItemSalesHistoryReview.test.jsx','src/core/purchasingWorkflow.test.js','test-tools/intelligence-purchasing-emulator.test.cjs','RELEASE_17_0_85.md']) assert.ok(manifest.files.some(row=>row.file===file),file+' is sealed');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes('tests/86chaos-release-gate/98-intelligence-connections-17-0-85.spec.cjs'));
assert.ok(workflow.includes('tests/86chaos-release-gate/98-intelligence-connections-17-0-85.spec.cjs'));
assert.ok(workflow.includes('tests/e2e/intelligence-connections-17-0-85.spec.cjs'));
assert.ok(pkg.scripts['test:current-release-targeted'].includes('npm run test:intelligence-connections'));
for (const file of ['api/operational-history.js','api/_operational-history.js','api/_operational-review.js','api/operational-completion-17-0-86.test.cjs','src/core/operationalEvidence.shared.js','src/core/attendanceEvidence.shared.js','src/hooks/useOperationalHistory.js','src/hooks/useWorkspaceBackupEvidence.js','src/components/VendorCatalogReview.jsx','src/components/OperationalCompletion.test.jsx','test-tools/load-restaurant-model.cjs','RELEASE_17_0_86.md']) assert.ok(manifest.files.some(row=>row.file===file),file+' is sealed');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes('tests/86chaos-release-gate/99-operational-completion-17-0-86.spec.cjs'));
assert.ok(workflow.includes('tests/86chaos-release-gate/99-operational-completion-17-0-86.spec.cjs'));
assert.ok(workflow.includes('tests/e2e/operational-completion-17-0-86.spec.cjs'));
assert.ok(pkg.scripts['test:current-release-targeted'].includes('npm run test:operational-completion'));
assert.ok(pkg.scripts['test:operational-completion'].includes('npm run test:intelligence-connections:emulator'));
assert.equal(require('../src/core/customerHelpKnowledge.cjs').validateCustomerHelpCorpus().ok,true);
for(const file of ['tests/86chaos-release-gate/100-operational-reliability.spec.cjs','src/components/OperationalReliability.test.jsx','api/reliability-release-gate.test.cjs','api/reliability-qa-cleanup.test.cjs','api/_qa-reviewed-cleanup.js','scripts/86chaos-release-gate/final-gate-outcome.cjs','scripts/86chaos-release-gate/device-evidence.cjs','test-tools/certification/device-acceptance.json'])assert.ok(manifest.files.some(row=>row.file===file),file+' is sealed');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes('tests/86chaos-release-gate/100-operational-reliability.spec.cjs'));
assert.ok(pkg.scripts['test:current-release-targeted'].includes('npm run test:reliability'));
assert.equal(json('test-tools/certification/device-acceptance.json').checks.length,16);
for(const file of ['api/_schedule-forecast-draft.js','api/reliability-forecast-draft.test.cjs','api/today-recipe-evidence.test.cjs'])assert.ok(manifest.files.some(row=>row.file===file),file+' is sealed');
new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(path.join(root,'tests/86chaos-release-gate/100-operational-reliability.spec.cjs')));
console.log('86 Chaos 17.0.86 intelligence connections and preserved full-gate repairs validation PASS');

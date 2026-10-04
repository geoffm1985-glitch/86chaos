'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const exists = f => fs.existsSync(path.join(root, f));
const version = '17.0.78';

const pkg = json('package.json');
const lock = json('package-lock.json');
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[''].version, version);
assert.equal(json('public/version.json').version, version);
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION = '17\.0\.78'/);
assert.match(read('api/_version.js'), /17\.0\.78/);
assert.match(read('src/core/customerHelpKnowledge.cjs'), /CUSTOMER_HELP_VERSION = '17\.0\.78'/);
assert.match(read('src/core/customerHelpKnowledge.js'), /CUSTOMER_HELP_VERSION = '17\.0\.78'/);
for (const f of ['test-tools/certification/groups.json', 'test-tools/certification/cost-performance-baselines.json', 'test-tools/regressions/registry.json']) assert.equal(json(f).release, version);
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-78.js');
assert.equal(pkg.scripts['validate:17.0.78'], 'node scripts/validate-17-0-78.js');
assert.equal(pkg.scripts['test:repair:17.0.78'], 'npm run test:current-release-targeted');
assert.match(pkg.scripts['test:current-release-targeted'], /release-gate-emulator-playwright-fidelity-17-0-78\.test\.cjs/);
assert.ok(pkg.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-78.js'));

const nodeRegression = 'api/release-gate-emulator-playwright-fidelity-17-0-78.test.cjs';
const releaseSpec = 'tests/86chaos-release-gate/90-emulator-playwright-fidelity-17-0-78.spec.cjs';
const e2eSpec = 'tests/e2e/emulator-playwright-fidelity-17-0-78.spec.cjs';
for (const f of [nodeRegression, releaseSpec, e2eSpec, 'RELEASE_17_0_78.md', 'tests/86chaos-release-gate/utils/yardmaster-runtime-target.cjs']) assert.equal(exists(f), true, `${f} exists`);
const universe = require('./86chaos-release-gate/release-test-universe.cjs');
assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(releaseSpec));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow, /90-emulator-playwright-fidelity-17-0-78\.spec\.cjs/);
assert.match(workflow, /tests\/e2e\/emulator-playwright-fidelity-17-0-78\.spec\.cjs/);
assert.ok(json('test-tools/regressions/registry.json').regressions.some(r => r.defectId === 'RG-YARDMASTER-EMULATOR-BROWSER-FIDELITY-17078'));

const pwa = read('tests/86chaos-release-gate/25-pwa-android-installability.spec.cjs');
const reminder = read('tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs');
const security = read('tests/86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs');
const sticky = read('tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs');
const cost = read('tests/e2e/cost-regression.spec.cjs');
const requestOff = read('tests/e2e/schedule-request-off-management.spec.cjs');
assert.match(pwa, /isManagedYardmasterEmulator/);
assert.match(pwa, /deployed release candidate must activate a service worker/i);
assert.match(reminder, /registration\.showNotification/);
assert.match(reminder, /listener-backed reminder list/);
assert.match(security, /HSTS is intentionally absent on the non-release HTTP loopback emulator/);
assert.match(sticky, /containmentRoom/);
assert.match(cost, /Show directory/);
assert.match(cost, /single-workspace owners expose the current workspace as a non-switching control/);
assert.match(requestOff, /Seeded Request Off conflict must hydrate/);

const identityApi = require('./86chaos-release-gate/source-identity.cjs');
const identity = identityApi.captureSourceIdentity(root);
const manifest = json('release-source-manifest.json');
assert.equal(manifest.version, version);
assert.equal(manifest.sourceHash, identity.sourceHash, 'bundled release source manifest matches current 17.0.78 source');
assert.deepEqual(manifest.files, identity.files, 'bundled manifest file inventory matches completed 17.0.78 tree');
for (const f of [nodeRegression, releaseSpec, e2eSpec, 'tests/86chaos-release-gate/22-security-headers-input-fuzz.spec.cjs', 'tests/86chaos-release-gate/25-pwa-android-installability.spec.cjs', 'tests/86chaos-release-gate/35-reminder-notification-certification.spec.cjs', 'tests/86chaos-release-gate/56-manager-brief-sticky-day-header.spec.cjs', 'tests/e2e/cost-regression.spec.cjs', 'tests/e2e/schedule-request-off-management.spec.cjs']) {
  const row = manifest.files.find(x => x.file === f);
  assert.ok(row, `${f} is sealed in manifest`);
  assert.equal(row.sha256, identityApi.hash(identityApi.sourceBytes(row.file, fs.readFileSync(path.join(root, row.file)))));
}
console.log('86 Chaos 17.0.78 Yardmaster emulator browser fidelity repair validation PASS');

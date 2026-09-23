#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.version, '17.0.29');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Spanish Release-Gate Locator Fidelity Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-29.js');
assert.equal(pkg.scripts['validate:17.0.29'], 'node scripts/validate-17-0-29.js');
assert(pkg.scripts['test:repair:17.0.29']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/spanish-release-gate-fidelity-17-0-29.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/i18n-browser-runtime-17-0-28.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/schedule-shift-assignment-emergency-17-0-27.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/i18n-phase1-17-0-26.test.cjs'));
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'));

const browserI18n = read('src/core/i18n.js');
const nodeI18n = read('src/core/i18n.cjs');
const app = read('src/App.js');
const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
const browserSmoke = read('tests/86chaos-new-implementations/10-app-bootstrap-i18n-runtime.spec.cjs');
const schedule = read('src/features/schedule.jsx');
const assignRoute = read('api/schedule-shift-assign.js');

assert(!/from\s+['\"][^'\"]+\.cjs['\"]/i.test(browserI18n), 'browser i18n must not import a .cjs runtime module');
assert(!/module\.exports\s*=/.test(browserI18n), 'browser i18n must remain executable ESM');
assert(browserI18n.includes("SUPPORTED_APP_LANGUAGES = Object.freeze(['en', 'es'])"));
assert(browserI18n.includes('function normalizeAppLanguage('));
assert(browserI18n.includes('function translate('));
assert(browserI18n.includes('export const I18nProvider'));
assert(nodeI18n.includes("SUPPORTED_APP_LANGUAGES = Object.freeze(['en', 'es'])"));
assert(app.includes("from './core/i18n'"));
assert(!app.includes("core/i18n.cjs"));
assert(app.includes('<I18nProvider language={appLanguage}>'));
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.0.29'"));
assert(scope.includes('08-phase1-spanish-interface.spec.cjs'));
assert(scope.includes('09-schedule-builder-shift-assignment.spec.cjs'));
assert(scope.includes('10-app-bootstrap-i18n-runtime.spec.cjs'));
assert(scope.includes("fullSuitePath: '17.0.27 Schedule Builder shift assignment emergency repair'"));
assert(browserSmoke.includes('page.on(\'pageerror\''));
const spanishGate = read('tests/86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs');
assert(spanishGate.includes("locator('button.settings-tab-button').filter({ hasText: /^Preferencias$/i })"));
assert(!spanishGate.includes("getByRole('button', { name: /preferencias/i })"));
assert(browserSmoke.includes('Version 17\\.0\\.29'));

// Preserve the emergency shift assignment repair and earlier schedule deletion/delta behavior.
assert(schedule.includes("secureFetch('/api/schedule-shift-assign'"));
assert(schedule.includes('data-testid="schedule-builder-assign"'));
assert(assignRoute.includes("requiredPermissions: ['schedule']"));
assert(assignRoute.includes('db.batch()'));
assert(read('api/schedule-shift-delete.js').includes("action === 'clear-month'"));
assert(read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs').includes('A clean full baseline with zero FAIL/TIMEOUT rows is still a valid delta baseline.'));
assert(!/permissions\?\.(?:schedule|team|settings)/.test(read('src/core/timeOffPolicy.js')));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.0.29'), `${file} carries current version 17.0.29`);
for (const file of [
  'test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches package version`);

const manifestPath = path.join(root, 'release-source-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = json('release-source-manifest.json');
  const identity = captureSourceIdentity(root);
  assert.equal(manifest.sourceHash, identity.sourceHash, 'release source manifest matches current source tree');
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.sourceHash, 'release source manifest self-hash is valid');
  assert.deepEqual(manifest.files, identity.files, 'release source manifest file inventory matches current source tree');
  const buildIdentity = json('public/build-identity.json');
  assert.equal(buildIdentity.version, pkg.version, 'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash, identity.sourceHash, 'build identity source hash matches manifest');
}

console.log('17.0.29 Spanish Release-Gate Locator Fidelity Repair validation passed; this does not certify the release.');

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const app = read('src/App.js');
const shell = read('src/components/concept17.jsx');
const drawer = read('src/components/DrawerMenu.js');
const css = read('src/concept17.css');
const today = read('src/features/operations.jsx');
const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');

assert.equal(pkg.version, '17.1.13');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Approved Reference Full-App Visual Parity');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-1-13.js');
assert.equal(pkg.scripts['validate:17.1.13'], 'node scripts/validate-17-1-13.js');
assert(pkg.scripts['test:repair:17.1.13']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.1.13'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/pixel-reference-full-app-17-1-13.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/mobile-voice-pwa-panel-17-1-12.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/app-wide-concept1-complete-migration-17-1-2.test.cjs'));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.1.13'), `${file} carries 17.1.13`);
for (const file of [
  'test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches`);

assert(app.includes("const preferredMobileRoutes = ['today', 'published', 'ops', 'team']"));
assert(app.indexOf("{ id: 'today',") < app.indexOf("{ id: 'published',"), 'Today is first in approved primary order');
assert(app.includes('concept17-header-search'));
assert(app.includes('concept17-workspace-header'));
assert(app.includes('concept17-header-bell'));
assert(app.includes('concept17-header-avatar'));
assert(!app.includes('concept17-header-report'));
assert(shell.includes('Concept17Wordmark'));
assert(shell.includes('concept17-sidebar-brand-menu'));
assert(shell.includes('items.slice(0, 4).map'));
assert(shell.includes('data-testid="concept17-mobile-voice-button"'));
assert(drawer.includes('data-testid="drawer-86voice-button"'));
assert(css.includes('17.1.13 approved-reference full-app visual parity pass'));
assert(css.includes("url('/concept17-kitchen-reference.jpg')"));
assert(css.includes('grid-template-columns: repeat(5,minmax(0,1fr)) !important'));
assert(css.includes('Universal visual language for every existing page, nested tab, table, form'));
assert(exists('public/concept17-kitchen-reference.jpg'));
assert(exists('RELEASE_17_1_13.md'));
assert(exists('api/pixel-reference-full-app-17-1-13.test.cjs'));
assert(exists('tests/86chaos-new-implementations/28-approved-reference-full-app-parity.spec.cjs'));
for (const marker of ['concept17-reference-desktop','concept17-reference-mobile','Owner & Admin Alerts','Suggested Next Steps','Role Home',"t('today.myPreferences')"]) assert(today.includes(marker), `Today keeps ${marker}`);
for (const file of ['src/features/schedule.jsx','src/features/inventory.jsx','src/features/management.jsx','src/features/hr.jsx','src/features/intelligence.jsx']) assert(exists(file), `${file} preserved`);
assert(!/id:\s*['"]orders['"][\s\S]{0,80}Orders\s*&\s*Tickets/i.test(`${app}\n${shell}`));
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.1.13'"));
assert(scope.includes('28-approved-reference-full-app-parity.spec.cjs'));
assert(scope.includes("exactTestTitle: 'Today is the first primary tab on desktop and mobile'"));
assert(scope.includes("exactTestTitle: 'all five bottom-toolbar labels stay on one line at narrow-phone width'"));
assert(scope.includes("exactTestTitle: 'mobile toolbar uses the approved five-slot layout and keeps 86Voice in More'"));

const manifestPath = path.join(root, 'release-source-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = json('release-source-manifest.json');
  const identity = captureSourceIdentity(root);
  assert.equal(manifest.sourceHash, identity.sourceHash, 'release source manifest matches current source tree');
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.sourceHash, 'source manifest self-hash is valid');
  assert.deepEqual(manifest.files, identity.files, 'source manifest inventory matches');
  const buildIdentity = json('public/build-identity.json');
  assert.equal(buildIdentity.version, pkg.version, 'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash, identity.sourceHash, 'build identity source hash matches manifest');
}

console.log('17.1.13 visual parity validation passed; this validates source/release identity and does not by itself certify the full Play Store gate.');

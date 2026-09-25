#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const app = read('src/App.js');
const shell = read('src/components/concept17.jsx');
const common = read('src/components/common.jsx');
const css = read('src/concept17.css');
const management = read('src/features/management.jsx');
const scope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');

assert.equal(pkg.version, '17.1.16');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Navigation, Brand, and Mobile Voice Toolbar Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-1-16.js');
assert.equal(pkg.scripts['validate:17.1.16'], 'node scripts/validate-17-1-16.js');
assert(pkg.scripts['test:repair:17.1.16']?.includes('test:current-release-targeted'));
assert(pkg.scripts['test:release:fast']?.includes('validate:17.1.16'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/navigation-brand-toolbar-17-1-16.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/app-shell-hook-order-17-1-15.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/vercel-reference-asset-resolution-17-1-14.test.cjs'));
assert(pkg.scripts['test:current-release-targeted']?.includes('api/pixel-reference-full-app-17-1-13.test.cjs'));

for (const file of [
  'src/core/appCore.js','api/_version.js','api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs','src/core/schedulePdf.js',
]) assert(read(file).includes('17.1.16'), `${file} carries 17.1.16`);
for (const file of [
  'test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches`);

// Preserve the 17.1.15 authenticated hook-order repair.
const hook = app.indexOf('const openVoiceFromShell = useCallback(() => {');
const labelsReturn = app.indexOf('if (labelsToPrint) return');
const hydrationReturn = app.indexOf('if (cachedSessionAccessHydrating) {');
const loginReturn = app.indexOf('if (!liveAppUser) return <I18nProvider');
assert(hook > 0 && hook < labelsReturn && hook < hydrationReturn && hook < loginReturn, '86Voice hook stays above every App early return');
assert(!/\buse(?:State|Effect|Memo|Callback|Ref|Reducer|Context|LayoutEffect|DeferredValue|ImperativeHandle)\s*\(/.test(app.slice(labelsReturn)), 'no App hook is declared after first conditional App return');

// Complete legacy menu universe in the new categorized desktop sidebar.
const sectionOrder = [
  ['drawer.peopleScheduling', ['published','team','hr-training']],
  ['drawer.today', ['today','ops','reminders','events','messages']],
  ['drawer.kitchenOperations', ['prep','inventory','recipes']],
  ['drawer.businessFinancials', ['financials','back-office','maintenance']],
  ['drawer.toolsAutomation', ['ai-tools','menu-intelligence']],
  ['drawer.systemSupport', ['settings','help','audit','godmode']],
];
let sectionCursor = app.indexOf('const shellNavSections = [');
assert(sectionCursor > 0, 'categorized shell menu exists');
for (const [label, ids] of sectionOrder) {
  const labelAt = app.indexOf(label, sectionCursor);
  assert(labelAt > sectionCursor, `${label} remains in requested category order`);
  let cursor = labelAt;
  for (const id of ids) {
    const at = app.indexOf(`'${id}'`, cursor);
    assert(at > cursor, `${id} remains in requested category order`);
    cursor = at;
  }
  sectionCursor = labelAt;
}
assert(app.includes('sections={shellNavSections}'), 'desktop sidebar receives categorized legacy menu');
assert(shell.includes('concept17-sidebar-section-label'), 'new sidebar renders category labels');
assert(shell.includes('data-testid="concept17-sidebar-report-problem"'), 'desktop sidebar preserves Report Problem');
assert(shell.includes('data-testid="concept17-sidebar-logout"'), 'desktop sidebar preserves Log Out');
assert(/@media \(min-width: 1180px\)[\s\S]*\.concept17-menu-drawer\s*\{\s*display: none !important;/.test(css), 'overlay drawer is removed from desktop');
assert(/window\.matchMedia\?\.\('\(min-width: 1180px\)'\)\.matches\) return;/.test(app), 'desktop openMenu cannot activate the legacy overlay drawer');

// Mobile requested behavior.
assert(shell.includes('className="concept17-mobile-nav-item concept17-mobile-voice-button"'), 'mobile 86Voice is a visible toolbar item');
assert(shell.indexOf('data-testid="concept17-mobile-voice-button"') < shell.indexOf('items.slice(0, 4).map'), '86Voice is the first toolbar item');
assert(!shell.includes('concept17-voice-regression-proxy'), 'no hidden Voice proxy replaces the visible toolbar action');
assert(!common.includes('data-testid="drawer-86voice-button"'), 'More drawer no longer duplicates 86Voice');
assert(/17\.1\.16 navigation\/logo\/desktop control-fit repair[\s\S]*grid-template-columns:\s*repeat\(6,minmax\(0,1fr\)\)/.test(css), 'mobile toolbar has six equal slots');
assert(!app.includes('className="concept17-mobile-menu-toggle"'), 'mobile/tablet hamburger is removed from the rendered shell');

// Experimental install identity must be selected before any generic manifest can be discovered.
const indexHtml = read('public/index.html');
const experimentalManifest = json('public/manifest-experimental.json');
assert.equal(experimentalManifest.name, '86chaos experimental');
assert.equal(experimentalManifest.short_name, '86chaos experimental');
assert.equal(experimentalManifest.id, '/86-chaos-experimental-pwa');
assert(indexHtml.includes("else if (experimentalHost) manifest.setAttribute('href', '/manifest-experimental.json')"), 'experimental hostname selects its dedicated install manifest');
assert(!/<link[^>]+rel=["']manifest["'][^>]+href=["']%PUBLIC_URL%\/manifest\.json["']/i.test(indexHtml), 'generic manifest is not discoverable before hostname selection');

// Supplied brand artwork replaces generated generic wordmark.
assert(shell.includes('<img src="/6139.png" alt="86 Chaos Kitchen Management OS" className="concept17-brand-logo" />'), 'new shell uses supplied 6139 logo');
assert(!shell.includes('concept17-wordmark-86'), 'generated generic 86 text wordmark is gone');
assert(!shell.includes('concept17-wordmark-chaos'), 'generated generic CHAOS text wordmark is gone');
assert(common.includes('<img src="/6139.png" alt="86 Chaos Kitchen Management OS"'), 'Kitchen TV uses supplied logo artwork');

// Desktop Message Board labels remain horizontal.
for (const label of ['Shift Note','86 Alert','Maintenance','Announcement','General']) assert(management.includes(`'${label}'`), `${label} control remains`);
assert(/\.concept17-messages-surface \.message-board-composer-grid\s*\{[\s\S]*repeat\(5, minmax\(108px, 1fr\)\)/.test(css), 'desktop composer allocates readable width');
assert(/\.concept17-messages-surface \.message-board-control\s*\{[\s\S]*white-space:\s*nowrap !important;[\s\S]*word-break:\s*keep-all !important;[\s\S]*overflow-wrap:\s*normal !important;/.test(css), 'desktop message labels cannot stack vertically');

// Vercel-safe image repair remains byte-identical.
assert(css.includes('17.1.14 Vercel-safe reference asset resolution repair'), 'Vercel asset repair marker remains');
assert(!css.includes("url('/concept17-kitchen-reference.jpg')"), 'Vercel-breaking root URL stays removed');
const data = css.match(/--c17-ref-kitchen-image:\s*url\("data:image\/jpeg;base64,([^"]+)"\);/);
assert(data, 'embedded reference JPEG data URI remains');
const decoded = Buffer.from(data[1], 'base64');
const original = fs.readFileSync(path.join(root, 'public/concept17-kitchen-reference.jpg'));
assert.equal(sha256(decoded), sha256(original), 'embedded reference image remains byte-identical');

assert(exists('RELEASE_17_1_16.md'));
assert(exists('api/navigation-brand-toolbar-17-1-16.test.cjs'));
assert(exists('tests/86chaos-new-implementations/30-navigation-logo-toolbar-fit.spec.cjs'));
assert(scope.includes("const CURRENT_RELEASE_VERSION = '17.1.16'"));
assert(scope.includes('30-navigation-logo-toolbar-fit.spec.cjs'));
assert(scope.includes('29-authenticated-shell-hook-order.spec.cjs'));

const manifestPath = path.join(root, 'release-source-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = json('release-source-manifest.json');
  const identity = captureSourceIdentity(root);
  assert.equal(manifest.version, pkg.version, 'release source manifest version matches');
  assert.equal(manifest.sourceHash, identity.sourceHash, 'release source manifest matches current source tree');
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.sourceHash, 'source manifest self-hash is valid');
  assert.deepEqual(manifest.files, identity.files, 'source manifest inventory matches');
  const buildIdentity = json('public/build-identity.json');
  assert.equal(buildIdentity.version, pkg.version, 'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash, identity.sourceHash, 'build identity source hash matches manifest');
}

console.log('17.1.16 navigation, brand, mobile Voice toolbar, and desktop control-fit validation passed with all carry-forward protections intact.');

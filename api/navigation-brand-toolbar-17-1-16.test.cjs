'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const LEGACY_SECTION_ORDER = [
  ['peopleScheduling', ['published','team','hr-training']],
  ['today', ['today','ops','reminders','events','messages']],
  ['kitchenOperations', ['prep','inventory','recipes']],
  ['businessFinancials', ['financials','back-office','maintenance']],
  ['toolsAutomation', ['ai-tools','menu-intelligence']],
  ['systemSupport', ['settings','help','audit','godmode']],
];

test('17.1.16 desktop sidebar inherits the full legacy menu order and categories without a second desktop drawer', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');

  assert.match(app, /const shellNavSections = \[/);
  let priorSection = app.indexOf('const shellNavSections = [');
  for (const [key, ids] of LEGACY_SECTION_ORDER) {
    const sectionAt = app.indexOf(`drawer.${key}`, priorSection);
    assert.ok(sectionAt > priorSection, `${key} category stays in legacy order`);
    let priorItem = sectionAt;
    for (const id of ids) {
      const marker = `'${id}'`;
      const itemAt = app.indexOf(marker, priorItem);
      assert.ok(itemAt > priorItem, `${id} stays in the ${key} legacy order`);
      priorItem = itemAt;
    }
    priorSection = sectionAt;
  }

  assert.match(app, /sections=\{shellNavSections\}/);
  assert.match(app, /window\.matchMedia\?\.\('\(min-width: 1180px\)'\)\.matches\) return;/, 'desktop openMenu is a no-op so the legacy overlay cannot replace the new rail');
  assert.match(shell, /concept17-sidebar-section-label/);
  assert.match(shell, /data-testid="concept17-sidebar-report-problem"/);
  assert.match(shell, /data-testid="concept17-sidebar-logout"/);
  assert.match(css, /@media \(min-width: 1180px\)[\s\S]*\.concept17-menu-drawer\s*\{\s*display: none !important;/);
  assert.doesNotMatch(shell, /concept17-sidebar-brand-menu[\s\S]*<Menu/);

  const common = read('src/components/common.jsx');
  let commonSectionCursor = common.indexOf('const menuSections = [');
  assert.ok(commonSectionCursor > 0, 'legacy More menu category model remains present for mobile/tablet');
  for (const [key, ids] of LEGACY_SECTION_ORDER) {
    const sectionAt = common.indexOf(`drawer.${key}`, commonSectionCursor);
    assert.ok(sectionAt > commonSectionCursor, `${key} stays in the same order in the legacy menu model`);
    let priorItem = sectionAt;
    for (const id of ids) {
      const itemAt = common.indexOf(`'${id}'`, priorItem);
      assert.ok(itemAt > priorItem, `${id} stays aligned between the legacy menu and redesigned sidebar`);
      priorItem = itemAt;
    }
    commonSectionCursor = sectionAt;
  }
});

test('17.1.16 removes the phone hamburger and restores visible 86Voice as the first of six bottom-toolbar actions', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const common = read('src/components/common.jsx');
  const css = read('src/concept17.css');

  const navStart = shell.indexOf('data-testid="concept17-mobile-bottom-nav"');
  const voice = shell.indexOf('data-testid="concept17-mobile-voice-button"', navStart);
  const routes = shell.indexOf('items.slice(0, 4).map', navStart);
  assert.ok(navStart >= 0 && voice > navStart && routes > voice, '86Voice is the first visible mobile toolbar action');
  assert.match(shell, /className="concept17-mobile-nav-item concept17-mobile-voice-button"/);
  assert.match(shell, /data-shell-action="voice"/);
  assert.doesNotMatch(shell, /concept17-voice-regression-proxy/);
  assert.doesNotMatch(common, /data-testid="drawer-86voice-button"/);
  assert.match(css, /17\.1\.16 navigation\/logo\/desktop control-fit repair[\s\S]*grid-template-columns:\s*repeat\(6,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(app, /className="concept17-mobile-menu-toggle"/);
});

test('17.1.16 uses the supplied 86 Chaos logo artwork instead of the generated generic text wordmark', () => {
  const shell = read('src/components/concept17.jsx');
  const common = read('src/components/common.jsx');
  const operations = read('src/features/operations.jsx');
  assert.match(shell, /<img src="\/6139\.png" alt="86 Chaos Kitchen Management OS" className="concept17-brand-logo" \/>/);
  assert.doesNotMatch(shell, /concept17-wordmark-86/);
  assert.doesNotMatch(shell, /concept17-wordmark-chaos/);
  assert.match(common, /<img src="\/6139\.png" alt="86 Chaos Kitchen Management OS"/);
  assert.doesNotMatch(operations, /referenceRestaurant[\s\S]{0,100}\|\| '86 Chaos'/);
});

test('17.1.16 keeps desktop Message Board category controls readable on one line', () => {
  const css = read('src/concept17.css');
  const management = read('src/features/management.jsx');
  for (const label of ['Shift Note','86 Alert','Maintenance','Announcement','General']) assert.ok(management.includes(`'${label}'`));
  assert.match(css, /\.concept17-messages-surface \.message-board-composer-grid\s*\{[\s\S]*repeat\(5, minmax\(108px, 1fr\)\)/);
  assert.match(css, /\.concept17-messages-surface \.message-board-control\s*\{[\s\S]*white-space:\s*nowrap !important;[\s\S]*word-break:\s*keep-all !important;[\s\S]*overflow-wrap:\s*normal !important;/);
});


test('17.1.16 selects the experimental install manifest before the browser can discover a generic PWA manifest', () => {
  const index = read('public/index.html');
  const experimental = JSON.parse(read('public/manifest-experimental.json'));
  const testing = JSON.parse(read('public/manifest-testing.json'));

  assert.equal(experimental.name, '86chaos experimental');
  assert.equal(experimental.short_name, '86chaos experimental');
  assert.equal(experimental.id, '/86-chaos-experimental-pwa');
  assert.equal(testing.name, '86chaos testing');
  assert.match(index, /document\.createElement\('link'\)/);
  assert.match(index, /manifest\.rel = 'manifest'/);
  assert.match(index, /experimentalHost\) manifest\.setAttribute\('href', '\/manifest-experimental\.json'\)/);
  assert.match(index, /testingHost\) manifest\.setAttribute\('href', '\/manifest-testing\.json'\)/);
  assert.doesNotMatch(index, /<link[^>]+rel=["']manifest["'][^>]+href=["']%PUBLIC_URL%\/manifest\.json["']/i, 'generic manifest is not discoverable before host selection');
  assert.match(index, /experimentalHost \? '86chaos experimental'/);
});

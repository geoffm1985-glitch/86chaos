'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const REQUIRED_FEATURE_FILES = [
  'src/features/schedule.jsx',
  'src/features/operations.jsx',
  'src/features/inventory.jsx',
  'src/features/management.jsx',
  'src/features/hr.jsx',
  'src/features/intelligence.jsx',
];

const REQUIRED_PRIMARY_ROUTES = [
  'today','ops','prep','inventory','recipes','team','published','financials','messages','godmode','settings','help',
];

test('17.1.13 desktop shell matches the approved reference hierarchy and removes duplicate top-right menus', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');
  const catalogStart = app.indexOf('const shellNavCatalog = [');
  assert.ok(catalogStart >= 0, 'primary shell catalog exists');
  let prior = catalogStart;
  for (const route of REQUIRED_PRIMARY_ROUTES) {
    const marker = `{ id: '${route}',`;
    const at = app.indexOf(marker, catalogStart);
    assert.ok(at > prior, `${route} remains present in approved sidebar order`);
    prior = at;
  }
  assert.match(shell, /data-testid="concept17-desktop-sidebar"/);
  assert.match(shell, /<Concept17Wordmark/);
  assert.match(shell, /concept17-sidebar-brand-menu/);
  assert.match(app, /data-testid="concept17-command-header"/);
  assert.match(app, /concept17-header-search/);
  assert.match(app, /concept17-workspace-header/);
  assert.match(app, /concept17-header-bell/);
  assert.match(app, /concept17-header-avatar/);
  assert.doesNotMatch(app, /concept17-header-report/);
  assert.doesNotMatch(app, /concept17-desktop-menu-toggle/);
  assert.match(css, /Top command bar\. Desktop intentionally has no duplicate hamburger\/report menu/);
  assert.match(css, /@media \(min-width: 1180px\)[\s\S]*\.concept17-mobile-nav\s*\{\s*display: none !important;/);
});

test('17.1.13 mobile shell matches the approved five-slot reference while preserving 86Voice access', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const drawer = read('src/components/DrawerMenu.js');
  const css = read('src/concept17.css');
  assert.match(app, /const preferredMobileRoutes = \['today', 'published', 'ops', 'team'\]/);
  assert.match(shell, /items\.slice\(0, 4\)\.map/);
  assert.match(shell, /<MoreHorizontal size=\{20\}/);
  assert.match(css, /17\.1\.13 approved-reference full-app visual parity pass[\s\S]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(shell, /data-testid="concept17-mobile-voice-button"/);
  assert.match(drawer, /data-testid="drawer-86voice-button"/);
  assert.match(app, /onVoice=\{openVoiceFromShell\}/);
  assert.match(app, /data-testid="concept17-mobile-contextbar"/);
  assert.match(app, /concept17-mobile-open-status/);
});

test('17.1.13 applies the approved photo-backed visual frame to every route and subtab without removing workflows', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');
  assert.match(app, /<Concept17RouteFrame/);
  assert.match(app, /data-concept-route=\{activeTabState\}/);
  assert.match(shell, /export const Concept17RouteFrame/);
  assert.match(shell, /data-testid="concept17-route-heading"/);
  assert.match(css, /var\(--c17-ref-kitchen-image\)/);
  assert.match(css, /Universal visual language for every existing page, nested tab, table, form/);
  assert.match(css, /\.concept17-route-page table/);
  assert.match(css, /\.concept17-subtab-bar/);
  for (const file of REQUIRED_FEATURE_FILES) assert.ok(exists(file), `${file} is preserved`);
  assert.ok(exists('public/concept17-kitchen-reference.jpg'), 'approved-reference kitchen crop exists');
  assert.ok(fs.statSync(path.join(root, 'public/concept17-kitchen-reference.jpg')).size > 10000, 'reference kitchen crop is nonempty');
});

test('17.1.13 Manager Brief adds the approved desktop/mobile composition while retaining mature Today functions', () => {
  const today = read('src/features/operations.jsx');
  for (const marker of [
    'concept17-reference-desktop',
    'concept17-home-hero',
    'concept17-home-metrics',
    'concept17-home-primary-grid',
    'concept17-home-shortcuts',
    'concept17-reference-mobile',
    'concept17-mobile-manager-card',
    'concept17-mobile-metrics',
    'concept17-mobile-priorities',
    'concept17-mobile-shortcuts',
    'Owner & Admin Alerts',
    'Suggested Next Steps',
    'Role Home',
    "t('today.myPreferences')",
  ]) assert.ok(today.includes(marker), `Today retains ${marker}`);
});

test('17.1.13 preserves all existing route families and does not reintroduce standalone Orders & Tickets', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  for (const route of [
    'published','schedule','events','today','ops','prep','inventory','recipes','team','financials','sales','labor',
    'back-office','messages','reminders','ai-tools','menu-intelligence','hr-training','maintenance','settings','help','godmode','audit',
  ]) {
    assert.ok(shell.includes(`${route}:`) || shell.includes(`'${route}':`), `route frame copy remains for ${route}`);
  }
  assert.doesNotMatch(`${app}\n${shell}`, /id:\s*['"]orders['"][\s\S]{0,80}Orders\s*&\s*Tickets/i);
  const schedule = read('src/features/schedule.jsx');
  const inventory = read('src/features/inventory.jsx');
  const management = read('src/features/management.jsx');
  for (const marker of ['my-schedule','full-schedule','month-view','trade-board','time-off','availability','schedule-builder']) assert.ok(schedule.includes(marker), `schedule subpage ${marker} preserved`);
  for (const marker of ['count','order','ai-order','manage','vendors','invoices','waste']) assert.ok(inventory.includes(marker), `inventory subpage ${marker} preserved`);
  for (const marker of ['profile','accountSecurity','preferences','alerts','billing','workspace','branding','integrations']) assert.ok(management.includes(marker), `settings subpage ${marker} preserved`);
});

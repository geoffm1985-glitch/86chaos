'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('17.1.0 uses one shared Concept 1 shell across desktop and mobile without adding Orders & Tickets', () => {
  const app = read('src/App.js');
  const index = read('src/index.js');
  const shell = read('src/components/concept17.jsx');
  const css = read('src/concept17.css');

  assert.match(index, /import "\.\/concept17\.css";/);
  assert.match(app, /concept17-shell desktop-pro-shell/);
  assert.match(app, /<Concept17Sidebar/);
  assert.match(app, /<Concept17MobileNav/);
  assert.match(app, /data-testid="concept17-command-header"/);
  assert.match(app, /className="concept17-header-search"/);
  assert.match(shell, /data-testid="concept17-desktop-sidebar"/);
  assert.match(shell, /data-testid="concept17-mobile-bottom-nav"/);
  assert.match(css, /--c17-sidebar-width: 224px/);
  assert.match(css, /@media \(min-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.concept17-shell \.chaos-card/);
  assert.doesNotMatch(`${app}\n${shell}`, /Orders\s*&\s*Tickets/i);
});

test('17.1.0 System Administrator exposes all 21 real tools while preserving featured-card geometry', () => {
  const management = read('src/features/management.jsx');
  const historicalBrowser = read('tests/86chaos-new-implementations/14-system-admin-complete-directory-desktop.spec.cjs');
  assert.match(management, /className="admin37-featured-test-frame" data-testid="system-admin-featured-card"/);
  assert.match(management, /className="admin-concept1-exact-card admin37-featured-card" data-testid="system-admin-directory-card" data-admin-tab=\{tab\.id\}/);
  assert.match(historicalBrowser, /toHaveCount\(21, \{ timeout: 15000 \}\)/);
});

test('17.1.0 shell chrome remains aligned in English and Spanish dictionaries', () => {
  const browserI18n = read('src/core/i18n.js');
  const nodeI18n = read('src/core/i18n.cjs');
  for (const key of ['shell.home','shell.kitchen','shell.prep','shell.inventory','shell.schedule','shell.staff','shell.more','shell.searchAria','shell.searchPlaceholder','shell.switchWorkspace','shell.openProfileMenu']) {
    assert.match(browserI18n, new RegExp(`['\"]${key.replace('.', '\\.')}`));
    assert.match(nodeI18n, new RegExp(`['\"]${key.replace('.', '\\.')}`));
  }
  assert.match(browserI18n, /'shell\.home': 'Inicio'/);
  assert.match(nodeI18n, /'shell\.searchAria': 'Buscar en 86 Chaos'/);
});

test('17.1.0 preserves testing-only identity and production safety boundaries', () => {
  const manifest = json('public/manifest.json');
  const testingManifest = json('public/manifest-testing.json');
  const core = read('src/core/appCore.js');
  const mutationSafety = read('scripts/86chaos-release-gate/mutation-safety.cjs');
  assert.equal(manifest.name, '86 Chaos');
  assert.equal(testingManifest.name, '86chaos testing');
  assert.match(core, /currentHostname === 'testing\.86chaos\.com'/);
  assert.match(mutationSafety, /CANONICAL_TESTING_HOST = 'testing\.86chaos\.com'/);
  assert.doesNotMatch(core, /startLowCostPresenceSession|useLowCostPresenceSummary|presenceSessions/);
});

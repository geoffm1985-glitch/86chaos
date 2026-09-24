'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const APP_ROUTES = [
  'today','ops','prep','inventory','recipes','schedule','published','events',
  'financials','sales','labor','back-office','messages','team','hr-training',
  'maintenance','settings','help','reminders','ai-tools','menu-intelligence','godmode'
];

test('17.1.1 wraps every real routed workflow in the deep Concept 1 migration frame', () => {
  const app = read('src/App.js');
  const css = read('src/concept17.css');

  assert.match(app, /className=\{`concept17-route-page concept17-route-\$\{/);
  assert.match(app, /data-concept-route=\{activeTabState\}/);
  assert.match(app, /data-concept-subroute=/);
  assert.match(css, /17\.1\.1 deep-page migration/);
  assert.match(css, /\.concept17-route-page/);
  assert.match(css, /\.concept17-route-settings \.settings-page/);
  assert.match(css, /\.concept17-route-inventory \.inventory-subtabs/);
  assert.match(css, /\.concept17-route-page \.schedule-builder-control-deck/);
  assert.match(css, /\.concept17-route-financials \.financial-center-desktop/);
  assert.match(css, /\.concept17-route-hr-training \.hr-desktop/);
  assert.match(css, /\.concept17-route-godmode/);
  assert.match(css, /@media \(min-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);

  for (const route of APP_ROUTES) {
    assert.ok(app.includes(route), `route ${route} remains present`);
  }
});

test('17.1.1 deep migration covers cards, tabs, forms, tables and mobile geometry instead of only recoloring the shell', () => {
  const css = read('src/concept17.css');
  for (const required of [
    '.concept17-route-page .chaos-card',
    '.concept17-route-page .settings-tab-bar',
    '.concept17-route-page .inventory-subtabs',
    '.concept17-route-page [role="tab"]',
    ".concept17-route-page input:not([type='checkbox'])",
    '.concept17-route-page select',
    '.concept17-route-page table',
    '.concept17-route-page table th',
    '.concept17-route-page table td',
    '.concept17-route-page [data-testid="schedule-builder-cell"]',
    'grid-template-columns: repeat(2, minmax(0, 1fr))',
    'max-width: 1480px',
  ]) assert.ok(css.includes(required), `Concept 1 deep CSS contains ${required}`);
});

test('17.1.1 keeps the actual 86 Chaos brand assets in shell chrome', () => {
  const common = read('src/components/common.jsx');
  const shell = read('src/components/concept17.jsx');
  assert.match(common, /src="\/86chaos-icon-48-v2\.png"/);
  assert.match(common, /src="\/6139\.png"/);
  assert.match(common, /86 Chaos branding is always displayed/);
  assert.match(shell, /<CheersLogo clientData=\{clientData\} \/>/);
});

test('17.1.1 repairs the Vercel named-import failure against pinned lucide-react 0.344.0', () => {
  const shell = read('src/components/concept17.jsx');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['lucide-react'], '^0.344.0');
  assert.match(shell, /HelpCircle/);
  assert.doesNotMatch(shell, /CircleHelp/);
});

test('17.1.1 still does not expose Orders & Tickets', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  assert.doesNotMatch(`${app}\n${shell}`, /Orders\s*&\s*Tickets/i);
});

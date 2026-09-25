'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const ROUTES = ['published','schedule','events','today','ops','prep','inventory','recipes','team','financials','sales','labor','back-office','messages','reminders','ai-tools','menu-intelligence','hr-training','maintenance','settings','help','godmode','audit'];
const SURFACE_MARKERS = {
  'src/features/schedule.jsx': ['concept17-timeclock-surface','concept17-schedule-builder-surface','concept17-subtab-bar'],
  'src/features/operations.jsx': ['concept17-prep-surface','concept17-recipes-surface','concept17-maintenance-surface','concept17-ops-surface','concept17-today-surface','concept17-subtab-bar'],
  'src/features/inventory.jsx': ['concept17-inventory-surface','concept17-subtab-bar'],
  'src/features/management.jsx': ['concept17-team-surface','concept17-messages-surface','concept17-settings-surface','concept17-audit-surface','concept17-help-surface','concept17-financials-surface','concept17-back-office-surface','concept17-subtab-bar'],
  'src/features/hr.jsx': ['concept17-hr-surface','concept17-subtab-bar'],
  'src/features/intelligence.jsx': ['concept17-intelligence-surface'],
};

test('17.1.2 shell preserves the approved primary navigation destinations on desktop and mobile', () => {
  const app = read('src/App.js');
  const common = read('src/components/common.jsx');
  const shell = read('src/components/concept17.jsx');
  const catalogStart = app.indexOf('const shellNavCatalog = [');
  const timeClockPos = app.indexOf("{ id: 'published',", catalogStart);
  const todayPos = app.indexOf("{ id: 'today',", catalogStart);
  assert.ok(timeClockPos > catalogStart && todayPos > timeClockPos, 'Time Clock & Schedule precedes Today in the restored legacy desktop menu order');
  assert.match(app, /const preferredMobileRoutes = \['today', 'published', 'ops', 'team'/);
  assert.ok(common.includes("pushTab({ id: 'published'") && common.includes("pushTab({ id: 'today'"), 'drawer preserves both Time Clock and Today destinations');
  assert.match(shell, /published:\s*CalendarClock/);
  assert.match(shell, /item\.id === 'published' && \['published', 'schedule'\]\.includes\(activeTab\)/);
});

test('17.1.2 wraps every routed workflow in the complete bilingual Concept 1 page frame', () => {
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  assert.match(app, /<Concept17RouteFrame/);
  assert.match(app, /route=\{activeTabState\}/);
  assert.match(app, /subroute=\{\['schedule','published'\]\.includes\(activeTabState\)/);
  assert.match(shell, /export const Concept17RouteFrame/);
  assert.match(shell, /const ROUTE_COPY_ES =/);
  assert.match(shell, /Personas • Proceso • Ganancia/);
  assert.match(shell, /data-testid="concept17-route-heading"/);
  for (const route of ROUTES) assert.ok(shell.includes(`${route}:`) || shell.includes(`'${route}':`), `route frame copy exists for ${route}`);
});

test('17.1.2 explicitly migrates every feature family instead of relying on a shell-only recolor', () => {
  for (const [file, markers] of Object.entries(SURFACE_MARKERS)) {
    const text = read(file);
    for (const marker of markers) assert.ok(text.includes(marker), `${file} contains ${marker}`);
  }
  const css = read('src/concept17.css');
  for (const token of [
    '17.1.2 COMPLETE CONCEPT 1 PAGE MIGRATION',
    '.concept17-route-heading',
    '.concept17-route-body :where(.max-w-sm',
    '.concept17-subtab-bar',
    '.chaos-modal-panel',
    '.concept17-schedule-builder-surface',
    '.concept17-route-godmode .admin37-all-tools-grid',
    "appearance: none !important",
    '@media (min-width: 1024px)',
    '@media (max-width: 767px)',
  ]) assert.ok(css.includes(token), `complete Concept 1 CSS contains ${token}`);
});


test('17.1.2 gives every stateful tab family an explicit Concept 1 subtab surface contract', () => {
  const schedule = read('src/features/schedule.jsx');
  const prep = read('src/features/operations.jsx');
  const inventory = read('src/features/inventory.jsx');
  const management = read('src/features/management.jsx');
  const hr = read('src/features/hr.jsx');

  assert.match(schedule, /data-concept-subtab=\{`timeclock-\$\{subTab\}`\}/);
  for (const id of ['my-schedule','full-schedule','month-view','trade-board','time-off','availability','schedule-builder']) assert.ok(schedule.includes(`'${id}'`), `Time Clock subtab ${id} exists`);
  for (const marker of ['concept17-schedule-admin-surface','concept17-month-surface','concept17-availability-surface','concept17-timeoff-surface','concept17-schedule-builder-surface']) assert.ok(schedule.includes(marker), `schedule carries ${marker}`);
  assert.match(schedule, /data-concept-subtab=\{`schedule-\$\{subTab\}`\}/);
  assert.match(schedule, /data-concept-subtab=\{`schedule-builder-tool-\$\{activeTool\}`\}/);
  for (const id of ['targets','templates','template-editor','drag','warnings']) assert.ok(schedule.includes(`['${id}'`) || schedule.includes(`'${id}',`), `Schedule Builder tool tab ${id} exists`);

  assert.match(prep, /data-concept-subtab=\{`prep-\$\{subTab\}`\}/);
  for (const id of ['prep','line-check','daily','weekly','monthly']) assert.ok(prep.includes(`'${id}'`), `Prep subtab ${id} exists`);
  assert.match(prep, /data-concept-subtab=\{`maintenance-\$\{subTab\}`\}/);
  for (const id of ['issues','pm']) assert.ok(prep.includes(`'${id}'`), `Maintenance subtab ${id} exists`);

  assert.match(inventory, /data-concept-subtab=\{`inventory-\$\{invTab\}`\}/);
  for (const id of ['count','order','ai-order','manage','vendors','invoices','waste']) assert.ok(inventory.includes(`'${id}'`), `Inventory subtab ${id} exists`);
  for (const id of ['count','ai-order','order','manage','vendors','invoices','waste']) assert.ok(inventory.includes(`data-concept-subtab="inventory-${id}"`), `Inventory ${id} has an explicit subtab surface`);
  assert.match(inventory, /data-concept-subtab=\{`inventory-invoice-review-\$\{invoiceReviewTab\}`\}/);
  for (const id of ['matched','skipped','raw']) assert.ok(inventory.includes(`['${id}'`) || inventory.includes(`'${id}',`), `Invoice review tab ${id} exists`);
  assert.match(prep, /data-concept-subtab=\{`ops-specials-\$\{specialView\}`\}/);
  assert.match(inventory, /data-concept-subtab=\{`inventory-waste-mode-\$\{wMode\}`\}/);
  assert.match(schedule, /data-concept-subtab=\{`availability-mode-\$\{mode\}`\}/);

  assert.match(management, /data-concept-subtab=\{`settings-\$\{subTab\}`\}/);
  for (const id of ['profile','accountSecurity','preferences','alerts','billing','workspace','branding','integrations']) assert.ok(management.includes(`'${id}'`), `Settings subtab ${id} exists`);
  assert.match(management, /data-concept-subtab=\{`financials-\$\{subTab\}`\}/);
  for (const id of ['overview','daily-close','sales','labor','tips','cogs','expenses','pnl','targets','reports']) assert.ok(management.includes(`id: '${id}'`), `Financials subtab ${id} exists`);
  assert.match(management, /data-concept-subtab=\{`labor-\$\{subTab\}`\}/);
  for (const id of ['fixer','editor','review','tips','export']) assert.ok(management.includes(`['${id}'`), `Labor subtab ${id} exists`);
  assert.match(management, /data-concept-subtab=\{`labor-export-\$\{exportMode\}`\}/);
  assert.match(management, /data-concept-subtab=\{`help-\$\{selectedArticleId/);
  const intelligence = read('src/features/intelligence.jsx');
  assert.match(intelligence, /data-concept-subtab=\{`reminders-share-\$\{shareMode\}`\}/);
  assert.match(management, /data-concept-subtab=\{`back-office-\$\{subTab\}`\}/);
  for (const id of ['dashboard','deposits','approvals','documents','reports','quickbooks','accountant-packet','owner-rollup']) assert.ok(management.includes(`"${id}"`) || management.includes(`'${id}'`), `Back Office subtab ${id} exists`);
  assert.match(management, /data-concept-subtab=\{`system-admin-\$\{subTab\}`\}/);

  assert.match(hr, /data-concept-subtab=\{`hr-\$\{activeTab\}`\}/);
  for (const id of ['overview','manuals','onboarding','certifications','performance']) assert.ok(hr.includes(`'${id}'`), `HR subtab ${id} exists`);
});

test('17.1.2 repairs the System Administrator exact 21-card contract without duplicate admin identities', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /const directoryAdminTabs = adminTabs\.filter\(tab => tab\.id !== 'overview'\)/);
  assert.match(management, /data-admin-shortcut=\{tab\.id\}/);
  assert.match(management, /\{directoryAdminTabs\.map\(tab => \{/);
  const directoryIdentity = 'data-testid="system-admin-directory-card" data-admin-tab={tab.id}';
  assert.equal(management.split(directoryIdentity).length - 1, 1, 'canonical directory identity appears exactly once in source');
  assert.doesNotMatch(management, /admin37-featured-card" data-testid="system-admin-directory-card"/);
});



test('17.1.2 has an explicit route-by-route visual blueprint instead of generic theme inheritance', () => {
  const css = read('src/concept17.css');
  const routeSelectors = [
    'concept17-route-team','concept17-route-messages','concept17-route-settings','concept17-route-audit',
    'concept17-route-help','concept17-route-recipes','concept17-route-reminders','concept17-route-ai-tools',
    'concept17-route-menu-intelligence','concept17-route-financials','concept17-route-sales','concept17-route-labor',
    'concept17-route-back-office','concept17-route-published','concept17-route-schedule','concept17-route-events',
    'concept17-route-inventory','concept17-route-godmode'
  ];
  for (const selector of routeSelectors) assert.ok(css.includes(`.${selector}`), `visual blueprint includes ${selector}`);
  for (const state of [
    'timeclock-my-schedule','timeclock-full-schedule','timeclock-month-view','timeclock-trade-board','timeclock-time-off','timeclock-availability','timeclock-schedule-builder',
    'schedule-schedule','schedule-events','schedule-builder-tool-targets','schedule-builder-tool-templates','schedule-builder-tool-template-editor','schedule-builder-tool-drag','schedule-builder-tool-warnings',
    'prep-prep','prep-line-check','prep-daily','prep-weekly','prep-monthly','maintenance-issues','maintenance-pm',
    'inventory-count','inventory-order','inventory-ai-order','inventory-manage','inventory-vendors','inventory-invoices','inventory-waste',
    'inventory-invoice-review-matched','inventory-invoice-review-skipped','inventory-invoice-review-raw','ops-specials-current','ops-specials-all',
    'settings-profile','settings-accountSecurity','settings-preferences','settings-alerts','settings-billing','settings-workspace','settings-branding','settings-integrations',
    'financials-overview','financials-daily-close','financials-sales','financials-labor','financials-tips','financials-cogs','financials-expenses','financials-pnl','financials-targets','financials-reports',
    'labor-fixer','labor-editor','labor-review','labor-tips','labor-export',
    'back-office-dashboard','back-office-deposits','back-office-approvals','back-office-documents','back-office-reports','back-office-quickbooks','back-office-accountant-packet','back-office-owner-rollup',
    'hr-overview','hr-manuals','hr-onboarding','hr-certifications','hr-performance'
  ]) assert.ok(css.includes(`data-concept-subtab='${state}'`), `explicit Concept 1 CSS blueprint exists for ${state}`);
  for (const prefix of ['availability-mode-','labor-export-','reminders-share-','inventory-waste-mode-','help-']) {
    assert.ok(css.includes(`data-concept-subtab^='${prefix}'`) || css.includes(`data-concept-subtab='help-`), `nested Concept 1 CSS blueprint exists for ${prefix}`);
  }
  assert.match(css, /17\.1\.2 ROUTE-BY-ROUTE CONCEPT 1 BLUEPRINT MATRIX/);
  assert.match(css, /concept17-route-team[\s\S]*grid-template-columns: minmax\(320px, \.78fr\) minmax\(0, 1\.52fr\)/);
  assert.match(css, /concept17-route-messages[\s\S]*grid-template-columns: minmax\(350px, \.72fr\) minmax\(0, 1\.48fr\)/);
});

test('17.1.2 redesigns login and protected auth states and keeps both 86 Chaos brand assets', () => {
  const auth = read('src/features/auth.jsx');
  const css = read('src/concept17.css');
  const common = read('src/components/common.jsx');
  assert.match(auth, /chaos-login-screen/);
  assert.match(auth, /chaos-login-card/);
  assert.match(auth, /chaos-login-logo/);
  assert.match(css, /\.chaos-login-screen/);
  assert.match(css, /\.chaos-login-card/);
  assert.match(common, /86chaos-icon-48-v2\.png/);
  assert.match(common, /6139\.png/);
});

test('17.1.2 System Administrator subpages expose an explicit Concept 1 back control', () => {
  const management = read('src/features/management.jsx');
  assert.match(management, /data-testid="system-admin-subpage-back"/);
  assert.match(management, /onClick=\{\(\) => selectAdminTab\('overview'\)\}/);
});

test('17.1.2 preserves 86 Chaos branding and does not add Orders & Tickets', () => {
  const common = read('src/components/common.jsx');
  const app = read('src/App.js');
  const shell = read('src/components/concept17.jsx');
  assert.match(common, /src="\/86chaos-icon-48-v2\.png"/);
  assert.match(common, /src="\/6139\.png"/);
  assert.match(common, /86 Chaos branding is always displayed/);
  assert.doesNotMatch(`${app}\n${shell}`, /Orders\s*&\s*Tickets/i);
});

test('17.1.2 retains the pinned lucide-compatible HelpCircle import for Vercel builds', () => {
  const shell = read('src/components/concept17.jsx');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['lucide-react'], '^0.344.0');
  assert.match(shell, /HelpCircle/);
  assert.doesNotMatch(shell, /CircleHelp/);
});

test('17.1.2 routes active workflow modals through the shared Concept 1 dialog system', () => {
  const common = read('src/components/common.jsx');
  const css = read('src/concept17.css');
  assert.match(common, /chaos-modal-backdrop/);
  assert.match(common, /chaos-modal-panel/);
  assert.match(common, /role="dialog"/);
  assert.match(common, /aria-modal="true"/);
  assert.match(css, /\.chaos-modal-backdrop/);
  assert.match(css, /\.chaos-modal-panel/);
  assert.match(css, /\.chaos-modal-header/);
  for (const file of ['src/features/hr.jsx','src/features/intelligence.jsx','src/features/inventory.jsx','src/features/management.jsx','src/features/operations.jsx','src/features/schedule.jsx']) {
    const source = read(file);
    if (source.includes('<Modal ')) assert.match(source, /from ['"]\.\.\/components\/common['"]/, `${file} uses the shared Concept 1 Modal`);
  }
});

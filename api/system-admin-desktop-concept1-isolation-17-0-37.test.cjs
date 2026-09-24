'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const EXPECTED_SUBPAGES = [
  'health','deployment','manual','forensics','retention','data','security','admins','roles',
  'tenants','users','setup','support','ai-usage','automation','push','maintenance','v14','history','ops','danger'
];

test('17.0.37 desktop home restores the Concept 1 two-two-three featured-card hierarchy', () => {
  const source = read('src/features/management.jsx');
  const css = read('src/styles.css');
  assert.match(source, /featuredAdminTabIds = \['roles', 'push', 'security', 'forensics', 'support', 'deployment', 'history'\]/);
  assert.match(source, /admin37-featured-grid admin37-featured-grid-primary/);
  assert.match(source, /featuredAdminTabs\.slice\(0, 4\)/);
  assert.match(source, /admin37-featured-grid admin37-featured-grid-secondary/);
  assert.match(source, /featuredAdminTabs\.slice\(4, 7\)/);
  assert.match(source, /data-testid="system-admin-featured-card"/);
  assert.match(css, /17\.0\.37 System Administrator desktop Concept 1 isolation/);
  assert.match(css, /admin37-featured-grid-primary[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0,1fr\)\)/);
  assert.match(css, /admin37-featured-grid-secondary[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0,1fr\)\)/);
});

test('17.0.37 keeps every real System Administrator page on the home screen without replacing the Concept 1 featured layout', () => {
  const source = read('src/features/management.jsx');
  const groupsStart = source.indexOf('const adminTabGroups = [');
  const groupsEnd = source.indexOf('const adminGroupTitleKey', groupsStart);
  assert.ok(groupsStart >= 0 && groupsEnd > groupsStart);
  const groupSource = source.slice(groupsStart, groupsEnd);
  for (const id of ['overview', ...EXPECTED_SUBPAGES]) assert.match(groupSource, new RegExp(`id:'${id.replace('-', '\\-')}'`), `canonical admin group includes ${id}`);
  assert.equal(EXPECTED_SUBPAGES.length, 21);
  assert.match(source, /const directoryAdminTabs = adminTabs\.filter\(tab => tab\.id !== 'overview'\)/);
  assert.match(source, /data-admin-shortcut=\{tab\.id\}/);
  assert.match(source, /data-testid="system-admin-complete-directory"/);
  assert.match(source, /data-testid="system-admin-directory-card"/);
  assert.match(source, /All System Administrator Tools/);
});

test('17.0.37 desktop subpages override legacy compact admin CSS instead of inheriting the old console look', () => {
  const css = read('src/styles.css');
  assert.match(css, /Isolate every desktop subpage from the legacy compact\/light admin CSS/);
  assert.match(css, /admin-concept1-subpage-active #admin-content-start \.chaos-card[\s\S]*border-radius:\s*16px !important/);
  assert.match(css, /admin-concept1-subpage-active #admin-content-start \.text-sm \{ font-size: 12px !important; \}/);
  assert.match(css, /admin-concept1-subpage-active #admin-content-start input:not\(\[type="checkbox"\]\)[\s\S]*min-height:\s*40px !important/);
  assert.match(css, /admin-concept1-metric-grid[\s\S]*repeat\(4, minmax\(0,1fr\)\)/);
});

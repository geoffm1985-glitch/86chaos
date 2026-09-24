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

test('17.0.36 System Administrator home renders every internal subpage from the canonical grouped directory', () => {
  const source = read('src/features/management.jsx');
  const groupsStart = source.indexOf('const adminTabGroups = [');
  const groupsEnd = source.indexOf('const adminGroupTitleKey', groupsStart);
  assert.ok(groupsStart >= 0 && groupsEnd > groupsStart, 'adminTabGroups source must exist');
  const groupSource = source.slice(groupsStart, groupsEnd);
  for (const id of ['overview', ...EXPECTED_SUBPAGES]) assert.match(groupSource, new RegExp(`id:'${id.replace('-', '\\-')}'`), `canonical admin group includes ${id}`);
  assert.match(source, /localizedAdminTabGroups\.map\(group =>/);
  assert.match(source, /group\.tabs\.filter\(tab => tab\.id !== 'overview'\)/);
  assert.match(source, /data-testid="system-admin-complete-directory"/);
  assert.match(source, /data-testid="system-admin-directory-card"/);
  assert.match(source, /data-admin-tab=\{tab\.id\}/);
  assert.equal(EXPECTED_SUBPAGES.length, 21);
});

test('17.0.36 removes the native all-tools select that could explode over the desktop layout', () => {
  const source = read('src/features/management.jsx');
  assert.doesNotMatch(source, /id="system-admin-tool-jump"/);
  assert.doesNotMatch(source, /aria-label="All System Administrator tools"/);
  assert.match(source, /admin-concept1-subpage-location/);
  assert.match(source, /All System Administrator Tools/);
});

test('17.0.36 directory and subpages share the Concept 1 responsive card system', () => {
  const css = read('src/styles.css');
  assert.match(css, /17\.0\.36 complete System Administrator directory \+ desktop repair/);
  assert.match(css, /\.admin46-shell \.admin-concept1-directory-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*admin-concept1-directory-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*admin-concept1-directory-grid[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /admin-concept1-subpage-active #admin-content-start \.chaos-card/);
  assert.match(css, /admin-concept1-subpage-location/);
});

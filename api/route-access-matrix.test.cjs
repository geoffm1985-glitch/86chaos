'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { APP_ROUTE_IDS, normalizeRouteId, expectedRoutesForRole } = require('../scripts/86chaos-release-gate/route-access-matrix.cjs');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('canonical route matrix uses current route IDs and includes every primary app route', () => {
  assert.equal(normalizeRouteId('hr'), 'hr-training');
  assert.equal(normalizeRouteId('kitchen'), 'ops');
  for (const route of ['today','published','schedule','events','ops','financials','sales','labor','back-office','messages','prep','recipes','inventory','ai-tools','menu-intelligence','reminders','team','hr-training','maintenance','godmode','audit','help','settings']) {
    assert.ok(APP_ROUTE_IDS.includes(route), `missing route ${route}`);
  }
  assert.equal(APP_ROUTE_IDS.includes('hr'), false);
  assert.equal(APP_ROUTE_IDS.includes('kitchen'), false);
});

test('staff route expectations use Published Schedule and do not expect Schedule Builder or Maintenance by default', () => {
  const staff = expectedRoutesForRole('staff');
  const byRoute = Object.fromEntries(staff.map(row => [row.route, row]));
  assert.equal(byRoute.published.directNavigationAllowed, true);
  assert.equal(byRoute.schedule.directNavigationAllowed, false);
  assert.equal(byRoute.maintenance.directNavigationAllowed, false);
  assert.equal(byRoute.godmode.directNavigationAllowed, false);
});

test('browser authenticated-release tests are derived from the shared route matrix helper', () => {
  const source = read('tests/e2e/authenticated-release.spec.cjs');
  assert.match(source, /expectedRoutesForRole/);
  assert.doesNotMatch(source, /tabs:\s*\[/, 'browser role coverage must not drift into independent handwritten tab lists');
  assert.doesNotMatch(source, /'kitchen'/);
  assert.doesNotMatch(source, /'hr'/);
});

test('App drawer search and voice navigation use the canonical route-access resolver', () => {
  const common = read('src/components/common.jsx');
  const app = read('src/App.js');
  assert.match(common, /resolveRouteAccess/);
  assert.match(common, /canVoiceOpenTab/);
  assert.match(common, /GlobalSearchModal/);
  assert.match(app, /planAccess\.canRoute\(activeTabState/);
  assert.match(app, /routeAccess\.allowed/);
});

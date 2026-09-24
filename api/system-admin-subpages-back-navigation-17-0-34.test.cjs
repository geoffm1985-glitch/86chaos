'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.34 applies the Concept 1 visual system to every System Administrator subpage', () => {
  const management = read('src/features/management.jsx');
  const css = read('src/styles.css');
  assert.match(management, /admin-concept1-subpage-active/);
  assert.match(management, /data-testid="system-admin-concept1-subpage"/);
  assert.match(management, /admin-concept1-subpage-hero/);
  assert.match(management, /admin-concept1-subpage-location/);
  assert.match(management, /admin-concept1-subpage-home/);
  assert.match(css, /17\.0\.34 System Administrator Concept 1 subpage unification/);
  assert.match(css, /admin-concept1-subpage-active[\s\S]*\.chaos-card/);
  assert.match(css, /linear-gradient\(145deg, #242c32 0%, #1b2228 100%\)/);
  assert.match(css, /admin-concept1-subpage-active[\s\S]*\.chaos-input/);
  assert.match(css, /admin-concept1-subpage-active[\s\S]*\.chaos-button-primary/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*admin-concept1-subpage-hero/);
});

test('17.0.34 drawer navigation to System Administrator always resets the live admin route to home', () => {
  const app = read('src/App.js');
  const management = read('src/features/management.jsx');
  const drawer = read('src/components/DrawerMenu.js');
  assert.match(drawer, /setActiveTab\(tab\.id\)/);
  assert.match(app, /if \(tab === 'godmode'\)/);
  assert.match(app, /chaos:system-admin-home/);
  assert.match(management, /window\.addEventListener\('chaos:system-admin-home'/);
  assert.match(management, /returnHome = \(\) => setSubTab\('overview'\)/);
});

test('17.0.34 back behavior returns one page, then exits the standalone PWA on a second press inside two seconds', () => {
  const app = read('src/App.js');
  const management = read('src/features/management.jsx');
  assert.match(app, /CHAOS_PWA_BACK_EXIT_WINDOW_MS = 2000/);
  assert.match(app, /previousTab:/);
  assert.match(app, /currentAdminSubTab:/);
  assert.match(app, /previousAdminSubTab:/);
  assert.match(app, /Returned to the previous page\. Press back again within 2 seconds to exit\./);
  assert.match(app, /if \(state\.armed\)[\s\S]*window\.history\.back\(\)/);
  assert.doesNotMatch(app, /window\.close\(/);
  assert.match(management, /chaos:system-admin-subtab-changed/);
  assert.match(app, /chaos:system-admin-back-target/);
});

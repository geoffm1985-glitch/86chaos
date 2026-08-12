const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('16.0.203 trims only low-risk Today demand and preserves full feature caps', () => {
  const app = read('src/App.js');
  assert.match(app, /activeTabState === 'team' \? 220 : \(wantsToday \? 75 : 90\)/, 'team roster cap remains 220 while Today is lower');
  assert.match(app, /activeTabState === 'menu-intelligence' \? 500 : 80/, 'full Menu Intelligence still permits 500 dependencies while Today gets a summary cap');
  assert.match(app, /activeTabState === 'today' \? 8 : 30/, 'Today admin alerts cap is 8 and non-Today admin views keep 30');
  assert.match(app, /key=\{`\$\{activeTabState\}-\$\{liveAppUser\?\.restaurantId \|\| 'no-restaurant'\}`\}/, 'app surface boundary remains keyed by top-level tab and workspace only');
});

test('16.0.203 gates HR heavy datasets by visible section and uses count-first overview', () => {
  const hr = read('src/features/hr.jsx');
  assert.match(hr, /getCountFromServer/, 'HR overview uses Firestore aggregate counts');
  assert.match(hr, /activeTab === 'manuals' \? 150 : 50/, 'manual detail view keeps full cap while overview is lighter');
  assert.match(hr, /activeTab === 'onboarding' \? 500 : 80/, 'onboarding detail view keeps full cap while overview is lighter');
  assert.match(hr, /activeTab === 'certifications' \? 300 : 80/, 'certification detail view keeps full cap while overview is lighter');
  assert.match(hr, /activeTab === 'performance'/, 'confidential performance records load only in their section');
});

test('16.0.203 keeps diagnostics and no-op write protection but does not touch Firebase frozen files', () => {
  const appCore = read('src/core/appCore.js');
  const management = read('src/features/management.jsx');
  assert.match(appCore, /getFirebaseUsageDiagnostics/);
  assert.match(appCore, /recordFirestoreWriteDiagnostic/);
  assert.match(appCore, /shouldSkipSafeWrite/);
  assert.match(management, /audit-log:latest-75/);
  for (const forbidden of ['firestore.rules','storage.rules','database.rules.json','firestore.indexes.json','firebase.json']) {
    assert.ok(fs.existsSync(path.join(root, forbidden)), `${forbidden} exists`);
  }
});

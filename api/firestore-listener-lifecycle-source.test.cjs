const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const appCore = fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');
const appShell = fs.readFileSync(path.join(root, 'src/App.js'), 'utf8');

test('shared Firestore listeners ignore stale callbacks after registry release', () => {
  assert.match(appCore, /FIRESTORE_INTERNAL_ASSERTION_RE = \/INTERNAL ASSERTION FAILED\|Unexpected state\/i/);
  assert.match(appCore, /function releaseLiveCollectionEntry/);
  assert.match(appCore, /function releaseLiveDocumentEntry/);
  assert.match(appCore, /entry\.closed === true \|\| liveCollectionRegistry\.get\(key\) !== entry/);
  assert.match(appCore, /entry\.closed === true \|\| liveDocumentRegistry\.get\(key\) !== entry/);
});

test('Firestore internal assertion tears down the poisoned listener so the next subscription gets a clean listener', () => {
  assert.match(appCore, /firestore-internal-assertion-rebuild/);
  assert.match(appCore, /releaseLiveCollectionEntry\(key, entry, \{ reason: 'firestore-internal-assertion-rebuild', cache: false \}\)/);
  assert.match(appCore, /releaseLiveDocumentEntry\(key, entry, \{ reason: 'firestore-internal-assertion-rebuild', cache: false \}\)/);
  assert.doesNotMatch(appCore, /INTERNAL ASSERTION FAILED[\s\S]{0,160}ignore/i, 'internal assertions should not be converted into ignore-list suppression');
});

test('removed active workspace clears client access instead of keeping stale cached session state', () => {
  assert.match(appShell, /currentWorkspaceMembershipInactive/);
  assert.match(appShell, /chaos:workspace-memberships-changed/);
  assert.match(appShell, /clearSessionAndLogout\(\)/);
  assert.match(appShell, /localStorage\.removeItem\(`chaosActiveRestaurantId_\$\{appUser\.id\}`\)/);
});

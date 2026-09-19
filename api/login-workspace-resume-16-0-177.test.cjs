const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('login bootstrap gives preview profile hydration enough time before showing account-profile failure', () => {
  const auth = read('src/features/auth.jsx');
  assert.match(auth, /withOperationTimeout\(\s*loadLoginBootstrapFromServer\(firebaseUser\),\s*10000,\s*'Server login bootstrap'\s*\)/);
  assert.match(auth, /withOperationTimeout\(\s*getDoc\(userDocRef\),\s*2500,\s*'Browser account profile lookup'\s*\)/);
  assert.match(auth, /withOperationTimeout\(\s*getDoc\(doc\(db, 'users', candidate\)\),\s*2500,\s*'Browser email profile lookup'\s*\)/);
  assert.match(auth, /withOperationTimeout\(\s*getDocs\(query\(collection\(db, 'users'\), where\('email', '==', candidate\)\)\),\s*3000,\s*'Browser email field profile lookup'\s*\)/);
  assert.doesNotMatch(auth, /withOperationTimeout\(\s*loadLoginBootstrapFromServer\(firebaseUser\),\s*1800,\s*'Server login bootstrap'/);
});

test('release-gate route settling selects the current QA workspace before asserting protected routes', () => {
  const helpers = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  assert.match(helpers, /async function chooseQaWorkspace\(page\)/);
  assert.equal(helpers.includes('new RegExp(`^Open\\\\s+${escapeRegex(preferred)}'), true);
  assert.match(helpers, /getByRole\('button', \{ name: preferredRe \}\)/);
  assert.match(helpers, /intercepts pointer events\|not stable\|receives pointer events\|timeout/i);
  assert.match(helpers, /button\.evaluate\(\(el\) => el\.click\(\)\)/);
  assert.match(helpers, /choose workspace\|select workspace\|select restaurant\|choose restaurant/i);
  assert.match(helpers, /await chooseQaWorkspace\(page\)/);
});

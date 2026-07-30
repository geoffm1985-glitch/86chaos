const fs = require('fs');
const assert = require('assert');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const auth = read('src/features/auth.jsx');
const bootstrap = read('api/login-bootstrap.js');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const apiVersion = read('api/_version.js');
const appCore = read('src/core/appCore.js');

assert(auth.includes('const cleanEmail = normEmail(email);'), 'login form normalizes typed email before Firebase Auth');
assert(auth.includes('getDoc(doc(db, \'users\', candidate))'), 'browser login tries normalized email document IDs');
assert(auth.includes('browserProfileMatchedBy: \'email-doc-id\''), 'browser login records email-doc-id fallback');
assert(auth.includes("where('email', '==', candidate)"), 'browser login tries normalized email field lookup');
assert(!auth.includes('no matching Firestore profile could be loaded. ${authDiagnosticSuffix()}'), 'profile-missing login error no longer leaks Firebase project/key/appCheck diagnostics');
assert(auth.includes('Try the email in all lowercase once'), 'profile-missing login error gives a plain-English lowercase recovery hint');

assert(bootstrap.includes('const docIdCandidates = Array.from(new Set([email, rawEmail].filter(Boolean)))'), 'server bootstrap tries normalized/raw email document IDs');
assert(bootstrap.includes("const fields = ['emailLowercase', 'normalizedEmail', 'authEmail', 'email']"), 'server bootstrap checks normalized email fields before giving up');
assert(bootstrap.includes("profileDocMatchedBy = matchedBy"), 'server bootstrap preserves how the profile was matched');
assert(bootstrap.includes("return finish(snap, 'email-doc-id'"), 'server bootstrap can load legacy users/<lowercase email> profiles');

assert.strictEqual(pkg.version, '16.0.71', 'package version is 16.0.71');
assert.strictEqual(pkg.scripts['test:source'], 'node scripts/validate-16-0-71.js', 'test:source points at current validator');
assert.strictEqual(version.version, '16.0.71', 'public version is 16.0.71');
assert(apiVersion.includes("APP_VERSION = '16.0.71'"), 'API version is 16.0.71');
assert(appCore.includes("CURRENT_VERSION = '16.0.71'"), 'app core version is 16.0.71');

console.log('16.0.71 targeted login-profile casing test passed.');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Staff Roster lets managers edit an existing employee email in the form', () => {
  const source = read('src/features/management.jsx');
  assert.match(source, /const \[originalEmail, setOriginalEmail\] = useState\(''\)/);
  assert.match(source, /updates Firebase login email/);
  assert.doesNotMatch(source, /disabled=\{!!editingUserId\}/, 'editing mode must not disable the email input');
  assert.doesNotMatch(source, /Cannot be changed after creation/, 'editing copy must not tell managers email is locked forever');
});

test('staff-member update changes Firebase Auth email before saving roster aliases', () => {
  const source = read('api/staff-member.js');
  const updateBlock = source.slice(source.indexOf("if (action === 'update')"), source.indexOf("if (action === 'deactivate'"));
  assert.match(updateBlock, /const nextEmail = norm\(body\.email \|\| currentEmail\)/);
  assert.match(updateBlock, /auth\.getUserByEmail\(nextEmail\)/, 'must check that the new email is not already owned by a different Firebase Auth user');
  assert.match(updateBlock, /auth\.updateUser\(targetAuthUid, \{ email: nextEmail, emailVerified: false, displayName \}\)/, 'must update Firebase Auth, not just Firestore');
  assert.ok(updateBlock.indexOf('auth.updateUser(targetAuthUid') < updateBlock.indexOf('upsertAccountAndMembership('), 'Auth email update should happen before Firestore roster save');
  assert.match(updateBlock, /authEmailUpdated/);
  assert.match(updateBlock, /forceLogoutReason: 'staff-login-email-changed'/, 'changed login email should force the employee to refresh and sign in with the new email');
});

test('staff-member email update keeps legacy Firestore email aliases synchronized', () => {
  const source = read('api/staff-member.js');
  assert.match(source, /emailLower: canonicalEmail/);
  assert.match(source, /employeeEmail: canonicalEmail/);
  assert.match(source, /userEmail: canonicalEmail/);
  assert.match(source, /authEmail: canonicalEmail/);
  assert.match(source, /emailLower: accountEmail/);
  assert.match(source, /employeeEmail: accountEmail/);
  assert.match(source, /userEmail: accountEmail/);
});

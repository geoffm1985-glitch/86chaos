'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  AUTHORITATIVE_PROFILE_AUTHORITY_FIELDS,
  AUTHORITATIVE_SYSTEM_ACCESS_FIELDS,
  decidePlatformAdminAuthority
} = require('./_platform-admin-authority.cjs');

const root = path.join(__dirname, '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'src', 'App.js'), 'utf8');
const whoamiSource = fs.readFileSync(path.join(root, 'api', 'whoami.js'), 'utf8');

test('platform authority resolver exposes one canonical list protected by Firestore rules', () => {
  assert.deepEqual(AUTHORITATIVE_PROFILE_AUTHORITY_FIELDS, ['isSuperAdmin', 'systemAccess']);
  assert.deepEqual(AUTHORITATIVE_SYSTEM_ACCESS_FIELDS, ['superAdmin']);
  for (const field of AUTHORITATIVE_PROFILE_AUTHORITY_FIELDS) {
    assert.match(rules, new RegExp(`['\"]${field}['\"]`), `${field} is named in firestore rules`);
  }
  assert.match(rules, /platformAuthorityCreateIsSafe/);
  assert.match(rules, /systemAccessCreateIsSafe/);
  assert.match(rules, /authorityFlagCreateIsSafe\(data\.get\('isSuperAdmin', false\)\)/);
  assert.match(rules, /authorityFlagCreateIsSafe\(data\.systemAccess\.get\('superAdmin', false\)\)/);
  assert.match(rules, /affectedKeys\(\)\.hasAny\(\['isSuperAdmin',[^\]]*'systemAccess'/s);
});

test('tenant-editable metadata fields remain denied by the server authority resolver', () => {
  const tenantEditableShapes = [
    { permissions: { systemAdmin: true } },
    { permissions: { godmode: true } },
    { platformAccess: { superAdmin: true } },
    { platformAuthority: { systemAdministrator: true } },
    { role: 'System Administrator' }
  ];
  for (const profile of tenantEditableShapes) {
    const decision = decidePlatformAdminAuthority({
      decoded: { uid: 'ordinary', email: 'ordinary@example.com' },
      profile: { email: 'ordinary@example.com', restaurantId: 'tenant_a', ...profile },
      masterEmails: [],
      protectedRootEmails: []
    });
    assert.equal(decision.superAdmin, false, JSON.stringify(profile));
  }
});

test('client hydration and whoami keep platform authority separate from restaurant roles', () => {
  assert.doesNotMatch(appSource, /localRoleLooksSystemAdmin/);
  assert.match(appSource, /serverAdminCheckTemporarilyUnavailable/);
  assert.match(appSource, /serverAdminCheckPending \|\| serverAdminCheckTemporarilyUnavailable/);
  assert.match(whoamiSource, /reasonCategory/);
  assert.match(whoamiSource, /firestore-profile-read-unavailable/);
  assert.match(whoamiSource, /res\.status\(403\)/);
  assert.match(whoamiSource, /res\.status\(401\)/);
  assert.match(whoamiSource, /respondTemporary\(res, 503/);
});


test('server and rules reject non-boolean platform-authority values', () => {
  const unsafeValues = ['true', 1, '1', 'yes', [], {}, 'TRUE'];
  for (const value of unsafeValues) {
    const fromProfile = decidePlatformAdminAuthority({
      decoded: { uid: 'u', email: 'u@example.com' },
      profile: { email: 'u@example.com', isSuperAdmin: value, systemAccess: { superAdmin: value } },
      masterEmails: [],
      protectedRootEmails: []
    });
    assert.equal(fromProfile.superAdmin, false, `profile authority ${JSON.stringify(value)} must be denied`);
    const fromClaims = decidePlatformAdminAuthority({
      decoded: { uid: 'u', email: 'u@example.com', superAdmin: value, systemAccess: { superAdmin: value } },
      profile: { email: 'u@example.com' },
      masterEmails: [],
      protectedRootEmails: []
    });
    assert.equal(fromClaims.superAdmin, false, `claim authority ${JSON.stringify(value)} must be denied`);
  }
  assert.match(rules, /function authorityFlagCreateIsSafe\(value\)/);
  assert.match(rules, /value is bool && value == false/);
});

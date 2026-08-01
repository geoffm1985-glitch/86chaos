'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decidePlatformAdminAuthority, hasFirestorePlatformAdminFlag } = require('./_platform-admin-authority.cjs');
const fs = require('fs');
const path = require('path');
const sessionAccessSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'sessionAccess.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');

test('protected founding account keeps platform authority while restaurant role stays Kitchen', () => {
  const decision = decidePlatformAdminAuthority({
    decoded: { uid: 'founder-uid', email: 'geoffm1985@gmail.com' },
    profile: { id: 'founder-uid', email: 'geoffm1985@gmail.com', role: 'Kitchen', isSuperAdmin: false, restaurantId: 'cheers' },
    masterEmails: [],
    protectedRootEmails: ['geoffm1985@gmail.com']
  });
  assert.equal(decision.superAdmin, true);
  assert.equal(decision.protected, true);
  assert.equal(decision.workspaceRole, 'Kitchen');
  assert.equal(decision.source, 'protected-root-admin');
});

test('server-protected isSuperAdmin flag is accepted independently from ordinary role text', () => {
  const decision = decidePlatformAdminAuthority({
    decoded: { uid: 'u1', email: 'admin@example.com' },
    profile: { id: 'u1', email: 'admin@example.com', role: 'Kitchen', isSuperAdmin: true },
    masterEmails: [],
    protectedRootEmails: []
  });
  assert.equal(decision.superAdmin, true);
  assert.equal(decision.firestoreSuperAdmin, true);
  assert.equal(decision.source, 'firestore-profile-flag');
  assert.equal(decision.workspaceRole, 'Kitchen');
});

test('server-protected systemAccess flag is accepted independently from ordinary role text', () => {
  const decision = decidePlatformAdminAuthority({
    decoded: { uid: 'u1b', email: 'admin2@example.com' },
    profile: { id: 'u1b', email: 'admin2@example.com', role: 'Kitchen', systemAccess: { superAdmin: true } },
    masterEmails: [],
    protectedRootEmails: []
  });
  assert.equal(decision.superAdmin, true);
  assert.equal(decision.firestoreSuperAdmin, true);
});

test('restaurant role text alone is display only and does not grant platform authority', () => {
  const decision = decidePlatformAdminAuthority({
    decoded: { uid: 'u2', email: 'employee@example.com' },
    profile: { id: 'u2', email: 'employee@example.com', role: 'System Administrator', isSuperAdmin: false },
    masterEmails: [],
    protectedRootEmails: []
  });
  assert.equal(decision.superAdmin, false);
  assert.equal(decision.firestoreSuperAdmin, false);
  assert.equal(decision.firestoreRoleText.includes('System Administrator'), true);
});

test('tenant-editable profile permission and platform metadata fields do not grant platform authority', () => {
  const unsafeProfiles = [
    { role: 'Kitchen', permissions: { systemAdmin: true } },
    { role: 'Kitchen', permissions: { godmode: true } },
    { role: 'Kitchen', platformAccess: { superAdmin: true } },
    { role: 'Kitchen', platformAuthority: { systemAdministrator: true } },
    { role: 'Owner', permissions: { systemAdmin: true, godmode: true }, platformAccess: { superAdmin: true }, platformAuthority: { systemAdministrator: true } }
  ];
  for (const profile of unsafeProfiles) {
    const decision = decidePlatformAdminAuthority({
      decoded: { uid: `user-${Math.random()}`, email: 'kitchen@example.com' },
      profile: { id: 'profile', email: 'kitchen@example.com', ...profile },
      masterEmails: [],
      protectedRootEmails: []
    });
    assert.equal(decision.superAdmin, false, JSON.stringify(profile));
    assert.equal(hasFirestorePlatformAdminFlag(profile), false, JSON.stringify(profile));
  }
});

test('normal owners managers staff and restaurant admins remain denied without protected platform authority', () => {
  for (const role of ['Owner', 'Manager', 'Staff', 'Administrator', 'General Manager', 'Kitchen']) {
    const decision = decidePlatformAdminAuthority({
      decoded: { uid: `u-${role}`, email: `${role.replace(/\s+/g, '').toLowerCase()}@example.com` },
      profile: { role, email: `${role.replace(/\s+/g, '').toLowerCase()}@example.com` },
      masterEmails: [],
      protectedRootEmails: []
    });
    assert.equal(decision.superAdmin, false, role);
  }
});

test('custom Auth claims can grant platform authority without relying on profile role fields', () => {
  const decision = decidePlatformAdminAuthority({
    decoded: { uid: 'claim-admin', email: 'claim@example.com', superAdmin: true },
    profile: { role: 'Kitchen', email: 'claim@example.com' },
    masterEmails: [],
    protectedRootEmails: []
  });
  assert.equal(decision.superAdmin, true);
  assert.equal(decision.customClaimSuperAdmin, true);
});

test('session access helper preserves verified access on transient failures and removes it on authoritative denial', () => {
  assert.match(sessionAccessSource, /TRANSIENT_FAILURE/);
  assert.match(sessionAccessSource, /return user;/);
  assert.match(sessionAccessSource, /verification\?\.definitive === true/);
  assert.match(sessionAccessSource, /server-verified-not-system-admin/);
  assert.match(sessionAccessSource, /platformAuthority\?\.source/);
});

test('App access hydration path uses declared platform marker variables and no stale localRoleLooksSystemAdmin identifier', () => {
  assert.doesNotMatch(appSource, /localRoleLooksSystemAdmin/);
  assert.match(appSource, /const localProfileHasSystemAdminMarker = Boolean/);
  assert.match(appSource, /localUserLooksSystemAdmin: Boolean\(serverSaysSuperAdmin \|\| localProfileHasSystemAdminMarker\)/);
  assert.doesNotMatch(appSource, /permissions\?\.systemAdmin === true\s*\|\|\s*\n\s*liveAppUser\?\.permissions\?\.godmode === true/);
});

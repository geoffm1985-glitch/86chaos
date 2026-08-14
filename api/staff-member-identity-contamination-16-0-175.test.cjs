const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'firebase-admin') {
    return { firestore: { FieldValue: { arrayUnion: (...values) => ({ __arrayUnion: values }) } } };
  }
  if (request === './_firebase-project-admin' || request.endsWith('/_firebase-project-admin')) {
    return { getAdminAppForRequest: () => ({ firestore: () => ({}), auth: () => ({}) }) };
  }
  return originalLoad.apply(this, arguments);
};
const staffMember = require('./staff-member.js');
Module._load = originalLoad;
const { resolveTargetDisplayName, callerIdentityNameKeys } = staffMember._test;
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('staff email update preserves target name when caller identity is accidentally submitted', () => {
  const ctx = {
    decoded: { uid: 'system_admin_uid', name: 'Geoff Test' },
    callerDocId: 'system_admin_uid',
    callerEmail: 'geoffm1985@gmail.com',
    callerProfile: { name: 'Geoff Test' },
    caller: { name: 'Geoff Test' }
  };
  const current = { name: 'P Test', email: 'old@example.com' };
  const targetUser = { uid: 'employee_uid', name: 'P Test', email: 'old@example.com' };
  const resolved = resolveTargetDisplayName(ctx, { name: 'Geoff Test', email: 'p@p.com' }, current, targetUser, 'employee_uid');
  assert.equal(resolved, 'P Test');
});

test('staff email update still allows a real target name edit that is not the caller identity', () => {
  const ctx = {
    decoded: { uid: 'system_admin_uid', name: 'Geoff Test' },
    callerDocId: 'system_admin_uid',
    callerEmail: 'geoffm1985@gmail.com',
    callerProfile: { name: 'Geoff Test' }
  };
  const current = { name: 'P Test', email: 'old@example.com' };
  const targetUser = { uid: 'employee_uid', name: 'P Test', email: 'old@example.com' };
  const resolved = resolveTargetDisplayName(ctx, { name: 'Pat Test', email: 'p@p.com' }, current, targetUser, 'employee_uid');
  assert.equal(resolved, 'Pat Test');
});

test('staff email update can update caller own profile name without false contamination guard', () => {
  const ctx = {
    decoded: { uid: 'system_admin_uid', name: 'Geoff Test' },
    callerDocId: 'system_admin_uid',
    callerEmail: 'geoffm1985@gmail.com',
    callerProfile: { name: 'Geoff Test' }
  };
  const current = { name: 'Old Admin Name', email: 'geoffm1985@gmail.com' };
  const targetUser = { uid: 'system_admin_uid', name: 'Old Admin Name', email: 'geoffm1985@gmail.com' };
  const resolved = resolveTargetDisplayName(ctx, { name: 'Geoff Test' }, current, targetUser, 'system_admin_uid');
  assert.equal(resolved, 'Geoff Test');
});

test('staff-member update sanitizes submitted name before Firebase Auth and Firestore membership writes', () => {
  const source = read('api/staff-member.js');
  assert.match(source, /const displayName = resolveTargetDisplayName\(ctx, body, current, targetUser, targetAuthUid \|\| targetUid\);/);
  assert.match(source, /const safeUpdateBody = \{ \.\.\.body, name: displayName, email: nextEmail \};/);
  assert.match(source, /buildMembershipPayload\(ctx, targetAuthUid \|\| targetUid, safeUpdateBody, current\)/);
  assert.doesNotMatch(source, /buildMembershipPayload\(ctx, targetAuthUid \|\| targetUid, \{ \.\.\.body, email: nextEmail \}, current\)/);
});

test('target/caller identity keys include real caller names but do not depend on target email', () => {
  const keys = callerIdentityNameKeys({ callerEmail: 'geoffm1985@gmail.com', callerProfile: { name: 'Geoff Test' }, decoded: { name: 'Geoff Test' } });
  assert.equal(keys.has('geoff test'), true);
  assert.equal(keys.has('geoffm1985@gmail.com'), true);
  assert.equal(keys.has('geoffm1985'), true);
  assert.equal(keys.has('p@p.com'), false);
});

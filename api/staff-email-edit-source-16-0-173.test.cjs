'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
const management = read('src/features/management.jsx');
const staffMember = read('api/staff-member.js');
const userActions = read('api/system-admin/user-actions.js');
const helper = read('api/_account-email-change.cjs');
const tabTeam = management.slice(management.indexOf('const TabTeam'), management.indexOf('const TabDailyClose') > management.indexOf('const TabTeam') ? management.indexOf('const TabDailyClose') : management.indexOf('const TabGodMode'));

test('active TabTeam email field remains editable in edit mode with clear login-email help', () => {
  assert.ok(tabTeam.includes('const canManageTeam = Boolean'), 'existing authorization model remains in TabTeam');
  assert.equal(tabTeam.includes('Cannot be changed after creation'), false);
  assert.equal(/disabled=\{!!editingUserId\}/.test(tabTeam), false);
  assert.equal(/cursor-not-allowed/.test(tabTeam.slice(tabTeam.indexOf('<label className={T.label}>Email'), tabTeam.indexOf('<div><label className={T.label}>Phone'))), false);
  assert.ok(tabTeam.includes("Changing this email changes the employee's login email"));
  assert.ok(tabTeam.includes('Their password stays the same'));
  assert.ok(tabTeam.includes('setEditingOriginalEmail'));
  assert.ok(tabTeam.includes('window.confirm(`Change this employee'));
});

test('Staff Roster does not use client Firebase updateEmail and sends updates to server', () => {
  assert.equal(/updateEmail\s*\(/.test(tabTeam), false);
  assert.ok(tabTeam.includes("secureFetch('/api/staff-member'"));
  assert.ok(tabTeam.includes("action: 'update'"));
});

test('staff-member uses canonical helper when submitted email differs and old-email-first expression is gone', () => {
  assert.ok(staffMember.includes("require('./_account-email-change.cjs')"));
  assert.ok(staffMember.includes('changeAccountLoginEmail'));
  assert.ok(staffMember.includes('submittedEmail !== currentEmail'));
  assert.ok(staffMember.includes('emailChanged: emailChangeResult.emailChanged === true'));
  assert.equal(staffMember.includes('current.email || targetUser.email || body.email'), false);
});

test('System Admin support-update uses the same canonical helper for email changes', () => {
  assert.ok(userActions.includes("require('../_account-email-change.cjs')"));
  assert.ok(userActions.includes('changeAccountLoginEmail'));
  assert.ok(userActions.includes("action === 'support-update'"));
  assert.ok(userActions.includes('submittedEmail !== currentEmail'));
  assert.equal(userActions.includes('if (input.email) patch.email = clean(input.email)'), false);
});

test('canonical helper is server Admin SDK oriented and protects sensitive identity work', () => {
  assert.ok(helper.includes('auth.updateUser(authUid, { email: newEmail, emailVerified: false })'));
  assert.ok(helper.includes('auth.revokeRefreshTokens(authUid)'));
  assert.ok(helper.includes("forceLogoutReason: 'staff-email-changed'"));
  assert.ok(helper.includes('STAFF_EMAIL_UPDATE'));
  assert.equal(/password\s*:/.test(helper), false);
});

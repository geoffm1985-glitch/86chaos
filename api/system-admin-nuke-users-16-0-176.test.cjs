'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const management = fs.readFileSync(path.join(root, 'src/features/management.jsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'api/system-admin/user-actions.js'), 'utf8');
test('UI Nuke Users no longer directly deletes user profiles', () => {
  const start = management.indexOf('const handleNukeData');
  const end = management.indexOf('// --- SHOWCASE GENERATOR', start);
  const block = management.slice(start, end);
  assert.match(block, /purge-workspace-users/);
  assert.match(block, /postSystemAdminAction\('\/api\/system-admin\/user-actions'/);
  const usersBranch = block.slice(block.indexOf("if (c === 'users')"), block.indexOf('continue;', block.indexOf("if (c === 'users')")) + 'continue;'.length);
  assert.doesNotMatch(usersBranch, /deleteDoc\(/);
});
test('System Administrator purge route uses canonical workspace lifecycle safeguards', () => {
  for (const needle of ['requireSystemAdmin(req)','purge-workspace-users','workspaceMembers','PURGE_WORKSPACE_USERS','isProtectedRootAdminEmail','updateUser(targetUid, { disabled: true })','multiWorkspacePreserved','SYSTEM_ADMIN_PURGE_WORKSPACE_USERS']) {
    assert.match(route, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(route, /api\/delete-users-bulk/);
  assert.doesNotMatch(route, /arbitrary collection/);
});

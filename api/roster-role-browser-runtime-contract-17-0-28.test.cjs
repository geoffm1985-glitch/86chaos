'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const browserWrapper = read('src/core/rosterRoleIdentity.js');
const nodeProxy = read('src/core/rosterRoleIdentityCore.cjs');
const sharedPath = path.join(root, 'src/core/rosterRoleIdentity.shared.js');
const shared = require(sharedPath);

test('17.0.28 browser roster-role identity wrapper cannot be emitted as a CRA cjs media URL', () => {
  assert.match(browserWrapper, /require\('\.\/rosterRoleIdentity\.shared\.js'\)/);
  assert.doesNotMatch(browserWrapper, /rosterRoleIdentityCore\.cjs/);
  assert.match(nodeProxy, /module\.exports = require\('\.\/rosterRoleIdentity\.shared\.js'\)/);
});

test('17.0.28 shared roster-role identity implementation exposes every schedule runtime helper', () => {
  for (const name of ['cleanRoleName','roleNameKey','normalizeRosterRole','activeRosterRoles','resolveShiftRosterRole','copyRosterRoleFields']) {
    assert.equal(typeof shared[name], 'function', `${name} must be callable`);
  }
  const roles = shared.activeRosterRoles([{ id:'kitchen', name:'Kitchen' }]);
  assert.equal(roles.length, 1);
  const resolved = shared.resolveShiftRosterRole({ role:'Kitchen' }, roles);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.rosterRoleId, 'kitchen');
});

test('17.0.28 production bundle verifier rejects rosterRoleIdentityCore cjs media emission', () => {
  const verifier = read('scripts/verify-schedule-runtime-bundle.cjs');
  assert.match(verifier, /rosterRoleIdentityCore/);
  assert.match(verifier, /static[\\/]media/);
});

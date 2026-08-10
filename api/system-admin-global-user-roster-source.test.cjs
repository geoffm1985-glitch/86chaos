'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('System Administrator people endpoint is server-authorized, paginated, and workspaceMembers-enriched', () => {
  const route = read('api/system-admin/people.js');
  assert.match(route, /authorize\(req,\s*app,\s*\{\s*allowTenantAdmin:\s*false,\s*allowCrossProjectMaster:\s*true\s*\}\)/s);
  assert.match(route, /ctx\.isSuperAdmin\s*!==\s*true/);
  assert.match(route, /db\.collection\('users'\)/);
  assert.match(route, /FieldPath\.documentId\(\)/);
  assert.match(route, /startAfter\(cursor\)/);
  assert.match(route, /hasMore/);
  assert.match(route, /nextCursor/);
  assert.match(route, /db\.collection\('workspaceMembers'\)/);
  assert.match(route, /loadCanonicalWorkspaceMemberIndex/);
  assert.match(route, /canonicalWorkspaceIdsForUser/);
  assert.doesNotMatch(route, /for\s*\([^)]*user[\s\S]{0,200}collection\('workspaceMembers'\)/, 'must not do one workspaceMembers query per user');
});

test('System Administrator active management component uses authoritative people roster for tenants and push only', () => {
  const source = read('src/features/management.jsx');
  assert.match(source, /\/api\/system-admin\/people/);
  assert.match(source, /loadSystemAdminPeopleRoster/);
  assert.match(source, /subTab === 'tenants' \|\| subTab === 'push'/);
  assert.match(source, /subTab === 'users' \|\| subTab === 'live'/);
  assert.doesNotMatch(source, /subTab === 'users' \|\| subTab === 'push' \|\| subTab === 'live'/);
  assert.match(source, /getSystemAdminUserWorkspaceIds\(u\)\.includes\(selectedClient\.id\)/);
  assert.match(source, /getSystemAdminUserWorkspaceIds\(u\)\.some\(workspaceId => selectedPushRestaurantIds\.includes\(workspaceId\)\)/);
  assert.match(source, /getUserPushDeviceCount\(u\) > 0 \? 'On' : 'Off'/);
});

test('System Administrator safe platform rows do not return raw push tokens and preserve workspaces', () => {
  const safeRows = read('api/system-admin-safe-rows.cjs');
  assert.match(safeRows, /function safePlatformUser/);
  assert.match(safeRows, /workspaceIdsForPlatformUser\(data = \{\}, canonicalWorkspaceIds = \[\]\)/);
  assert.match(safeRows, /workspaceMemberIsActive/);
  assert.match(safeRows, /workspaceMemberIdentityKeys/);
  assert.match(safeRows, /countUniqueActivePushDevices/);
  assert.match(safeRows, /pushLastSyncForPlatformUser/);
  assert.match(safeRows, /pushDeviceCount/);
  const functionBody = safeRows.slice(safeRows.indexOf('function safePlatformUser'));
  assert.doesNotMatch(functionBody, /fcmToken\s*:/);
  assert.doesNotMatch(functionBody, /fcmTokens\s*:/);
  assert.doesNotMatch(functionBody, /pushTokens\s*:/);
  assert.doesNotMatch(functionBody, /pushDevices\s*:/);
  assert.doesNotMatch(safeRows, /displayName[\s\S]{0,160}workspaceMemberIdentityKeys/, 'workspace membership identity must not rely on display name');
});

test('Failed-current infrastructure remains untouched by global roster repair', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:play-store:failed-current'], /reported-failed-only/);
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const config = read('playwright.failed-release.config.cjs');
  assert.match(prepare, /reported-failed-only-20260810-015004\.json/);
  assert.match(config, /expected 6 selected FAIL identities/);
});

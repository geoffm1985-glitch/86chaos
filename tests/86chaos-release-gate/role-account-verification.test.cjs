const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const verifierPath = path.join(root, 'scripts/86chaos-release-gate/verify-role-accounts.cjs');

function freshRequire(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

async function withAppUrl(fn) {
  const old = process.env.APP_URL;
  process.env.APP_URL = 'https://86chaos-git-testing-example.vercel.app';
  try { return await fn(); }
  finally {
    if (old === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = old;
  }
}

function response(status, body, statusText = status === 403 ? 'Forbidden' : 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    async text() { return JSON.stringify(body); },
  };
}

test('role preflight accepts authoritative 403 /api/whoami denial for normal owner account', async () => withAppUrl(async () => {
  const { fetchWhoami, analyzeRoleRows } = freshRequire(verifierPath);
  const row = await fetchWhoami({
    key: 'owner',
    label: 'Owner',
    emailEnv: 'OWNER_EMAIL',
    passwordEnv: 'OWNER_PASSWORD',
    email: '86chaos.qa.owner.20260729-1302@example.test',
    uid: 'uid-owner',
    idToken: 'redacted-token',
    firebaseProjectId: 'chaos-test-d1601',
    role: 'Owner',
    restaurantRole: 'Owner',
    isAdmin: true,
    isOwner: true,
    accountOwner: true,
    workspaceOwner: true,
    expectedSuperAdmin: false,
    expectedPlatformAuthority: false,
  }, async () => response(403, {
    ok: false,
    uid: 'uid-owner',
    email: '86chaos.qa.owner.20260729-1302@example.test',
    superAdmin: false,
    platformAuthorityAuthoritative: true,
    platformAuthority: { superAdmin: false, authoritative: true, workspaceRole: 'Owner', restaurantRole: 'Owner' },
    runtime: { firebaseProjectId: 'chaos-test-d1601' },
  }));

  assert.equal(row.uid, 'uid-owner');
  assert.equal(row.whoamiStatus, 403);
  assert.equal(row.whoamiExpectedDenial, true);
  assert.equal(row.expectedDenialVerified, true);
  assert.equal(row.superAdmin, false);
  assert.deepEqual(analyzeRoleRows([row]), []);
}));

test('role preflight still rejects 403 /api/whoami response for System Administrator account', async () => withAppUrl(async () => {
  const { fetchWhoami } = freshRequire(verifierPath);
  await assert.rejects(() => fetchWhoami({
    key: 'systemAdmin',
    label: 'System Administrator',
    emailEnv: 'SYSTEM_ADMIN_EMAIL',
    passwordEnv: 'SYSTEM_ADMIN_PASSWORD',
    email: '86chaos.qa.system-admin.20260729-1302@example.test',
    uid: 'uid-system-admin',
    idToken: 'redacted-token',
    firebaseProjectId: 'chaos-test-d1601',
    role: 'Kitchen',
    restaurantRole: 'Kitchen',
    expectedSuperAdmin: true,
    expectedPlatformAuthority: true,
  }, async () => response(403, {
    ok: false,
    uid: 'uid-system-admin',
    email: '86chaos.qa.system-admin.20260729-1302@example.test',
    superAdmin: false,
    runtime: { firebaseProjectId: 'chaos-test-d1601' },
  })), /HTTP 403 Forbidden/);
}));

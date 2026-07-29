const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const provisionAccountsPath = path.join(root, 'scripts/86chaos-release-gate/provision-test-accounts.cjs');
const runContextPath = path.join(root, 'scripts/86chaos-release-gate/run-context.cjs');

function freshRequire(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}

function withTempCwd(fn) {
  const oldCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-temp-users-'));
  process.chdir(dir);
  try { return fn(dir); }
  finally { process.chdir(oldCwd); fs.rmSync(dir, { recursive: true, force: true }); }
}

function withQaAccountEnv(fn) {
  const keys = ['SYSTEM_ADMIN_EMAIL','SYSTEM_ADMIN_PASSWORD','OWNER_EMAIL','OWNER_PASSWORD','MANAGER_EMAIL','MANAGER_PASSWORD','STAFF_EMAIL','STAFF_PASSWORD','CHAOS_QA_AUTO_PROVISION_TEST_USERS','CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS','MASTER_ADMIN_EMAIL','REACT_APP_FIREBASE_PROJECT_ID','REACT_APP_TEST_FIREBASE_PROJECT_ID','CHAOS_RELEASE_GATE_RUN_ID','CHAOS_FULL_AUDIT_RUN_ID','CHAOS_RELEASE_GATE_RUN_DIR'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.SYSTEM_ADMIN_EMAIL = '86chaos.qa.system.unit@example.test';
  process.env.SYSTEM_ADMIN_PASSWORD = 'UnitPass!111111111';
  process.env.OWNER_EMAIL = '86chaos.qa.owner.unit@example.test';
  process.env.OWNER_PASSWORD = 'UnitPass!222222222';
  process.env.MANAGER_EMAIL = '86chaos.qa.manager.unit@example.test';
  process.env.MANAGER_PASSWORD = 'UnitPass!333333333';
  process.env.STAFF_EMAIL = '86chaos.qa.staff.unit@example.test';
  process.env.STAFF_PASSWORD = 'UnitPass!444444444';
  process.env.CHAOS_QA_AUTO_PROVISION_TEST_USERS = 'true';
  process.env.CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS = 'true';
  try { return fn(); }
  finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

function makeFakeAdminApp() {
  const usersByEmail = new Map();
  const claimsByUid = new Map();
  const profiles = new Map();
  const auth = {
    async getUserByEmail(email) {
      const row = usersByEmail.get(String(email).toLowerCase());
      if (!row) { const error = new Error('user-not-found'); error.code = 'auth/user-not-found'; throw error; }
      return row;
    },
    async createUser(input) {
      const uid = `uid-${usersByEmail.size + 1}`;
      const row = { uid, email: String(input.email).toLowerCase(), displayName: input.displayName, disabled: false };
      usersByEmail.set(row.email, row);
      return row;
    },
    async updateUser(uid, patch) {
      const row = [...usersByEmail.values()].find(user => user.uid === uid);
      Object.assign(row, patch);
      return row;
    },
    async setCustomUserClaims(uid, claims) { claimsByUid.set(uid, claims); },
  };
  const firestore = () => ({
    collection(collectionName) {
      return { doc(id) { return { async set(data) { profiles.set(`${collectionName}/${id}`, data); } }; } };
    },
  });
  return { auth: () => auth, firestore, usersByEmail, claimsByUid, profiles };
}

test('provisioner refuses to use protected root administrator email as disposable QA account', () => {
  const { validateProvisionSafety } = freshRequire(provisionAccountsPath);
  const errors = validateProvisionSafety([
    { key: 'systemAdmin', emailEnv: 'SYSTEM_ADMIN_EMAIL', passwordEnv: 'SYSTEM_ADMIN_PASSWORD', label: 'System Administrator', email: 'geoffm1985@gmail.com', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'owner', emailEnv: 'OWNER_EMAIL', passwordEnv: 'OWNER_PASSWORD', label: 'Owner', email: '86chaos.qa.owner@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'manager', emailEnv: 'MANAGER_EMAIL', passwordEnv: 'MANAGER_PASSWORD', label: 'Manager', email: '86chaos.qa.manager@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', label: 'Staff', email: '86chaos.qa.staff@example.test', password: 'x', emailPresent: true, passwordPresent: true },
  ]);
  assert.ok(errors.some(error => /protected root administrator email/.test(error)));
});

test('provisioner gives System Administrator claims only to the system account', () => {
  const { safeClaimPatchForAccount } = freshRequire(provisionAccountsPath);
  assert.equal(safeClaimPatchForAccount({ key: 'systemAdmin' }).superAdmin, true);
  assert.equal(safeClaimPatchForAccount({ key: 'systemAdmin' }).systemAdministrator, true);
  assert.equal(safeClaimPatchForAccount({ key: 'manager' }).superAdmin, false);
  assert.equal(safeClaimPatchForAccount({ key: 'manager' }).systemAdministrator, false);
});

test('provisioner creates four distinct mocked users and writes no passwords or tokens to report', async () => withTempCwd(async () => {
  await withQaAccountEnv(async () => {
    process.env.CHAOS_RELEASE_GATE_RUN_ID = 'temp-users-unit';
    process.env.CHAOS_FULL_AUDIT_RUN_ID = 'temp-users-unit';
    delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
    delete require.cache[require.resolve(runContextPath)];
    delete require.cache[require.resolve(provisionAccountsPath)];
    const fake = makeFakeAdminApp();
    const { provisionTestAccounts } = require(provisionAccountsPath);
    const report = await provisionTestAccounts({ loadEnvironment: false, enabled: true, adminApp: fake });
    assert.equal(report.ok, true);
    assert.equal(report.accounts.length, 4);
    assert.equal(new Set(report.accounts.map(a => a.uid)).size, 4);
    assert.equal([...fake.claimsByUid.values()].filter(c => c.superAdmin === true).length, 1);
    assert.ok(fake.profiles.size >= 4);
    assert.doesNotMatch(JSON.stringify(report), /UnitPass|idToken|refreshToken|private_key/i);
  });
}));

test('release-gate runners provision temporary accounts before role preflight and Playwright', () => {
  for (const file of ['RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /Provision temporary release-gate test accounts/);
    assert.match(source, /provision-test-accounts\.cjs/);
    assert.ok(source.indexOf('Install Chromium browser') < source.indexOf('Provision temporary release-gate test accounts'));
    assert.ok(source.indexOf('Provision temporary release-gate test accounts') < source.indexOf('Verify release-gate role accounts'));
    assert.ok(source.indexOf('Verify release-gate role accounts') < source.indexOf('$RunnerState.playwrightStarted = $true'));
  }
});

test('generated temporary-user env file is intentionally not inside committed source ZIP root', () => {
  assert.equal(fs.existsSync(path.join(root, '.env.test.local')), false);
  assert.equal(fs.existsSync(path.join(root, 'release-gate-temp-users.env.test.local')), false);
});

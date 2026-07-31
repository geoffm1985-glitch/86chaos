#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { ensureRunDir, getRunFile, writeJson } = require('./run-context.cjs');
const { loadEnv } = require('../86chaos-full-audit/env-loader.cjs');
const { EXPECTED_FIREBASE_PROJECT, ROLE_DEFINITIONS, readConfiguredAccounts, validateLocalRoleEnv, analyzeRoleRows, verifyRoleAccounts } = require('./verify-role-accounts.cjs');

const PROTECTED_ROOT_EMAILS = new Set(['geoffm1985@gmail.com']);
const SAFE_TEMP_EMAIL_RE = /(^86chaos[.+_-]?qa|[.+_-]86chaos[.+_-]?qa|release[.+_-]?gate|qa[.+_-]?release)/i;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function bool(value) {
  return /^(1|true|yes|y)$/i.test(String(value || '').trim());
}

function nowIso() {
  return new Date().toISOString();
}

function roleForKey(key) {
  if (key === 'systemAdmin') return { role: 'System Administrator', superAdmin: true, systemAdministrator: true, isAdmin: true, isOwner: true };
  if (key === 'owner') return { role: 'Owner', superAdmin: false, systemAdministrator: false, isAdmin: true, isOwner: true };
  if (key === 'manager') return { role: 'General Manager', superAdmin: false, systemAdministrator: false, isAdmin: true, isOwner: false };
  return { role: 'Line Cook', superAdmin: false, systemAdministrator: false, isAdmin: false, isOwner: false };
}

function profileForAccount(account, uid, runId) {
  const role = roleForKey(account.key);
  return {
    uid,
    id: uid,
    email: normalizeEmail(account.email),
    displayName: account.name || account.label,
    name: account.name || account.label,
    role: role.role,
    isAdmin: role.isAdmin,
    isOwner: role.isOwner,
    superAdmin: role.superAdmin,
    systemAdministrator: role.systemAdministrator,
    firestoreSuperAdmin: role.superAdmin,
    firestoreSystemAdministrator: role.systemAdministrator,
    qaOwned: true,
    testingOnly: true,
    qaRunId: runId,
    createdBy: '86chaos-release-gate-account-provisioner',
    updatedAt: nowIso(),
  };
}

function safeClaimPatchForAccount(account) {
  if (account.key === 'systemAdmin') {
    return {
      superAdmin: true,
      systemAdmin: true,
      systemAdministrator: true,
      chaosSystemAdministrator: true,
      qaReleaseGateRole: 'systemAdmin',
      qaReleaseGateOnly: true,
    };
  }
  return {
    superAdmin: false,
    systemAdmin: false,
    systemAdministrator: false,
    chaosSystemAdministrator: false,
    qaReleaseGateRole: account.key,
    qaReleaseGateOnly: true,
  };
}

function validateProvisionSafety(accounts) {
  const errors = [];
  errors.push(...validateLocalRoleEnv(accounts, EXPECTED_FIREBASE_PROJECT));
  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    if (!email) continue;
    if (PROTECTED_ROOT_EMAILS.has(email)) {
      errors.push(`${account.emailEnv} is the protected root administrator email and cannot be used as a disposable release-gate test account.`);
    }
    if (!SAFE_TEMP_EMAIL_RE.test(email) && !bool(process.env.CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS)) {
      errors.push(`${account.emailEnv} (${email}) does not look like a dedicated 86 Chaos QA account. Use generated QA emails or set CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS=true only for testing-only accounts.`);
    }
  }
  return [...new Set(errors)];
}

async function getDefaultAdminApp(projectId) {
  const { getAdminAppForProject } = require('../../api/_firebase-project-admin.js');
  return getAdminAppForProject(projectId, { requireCredentials: true });
}

async function upsertAuthUser(auth, account) {
  let existing = null;
  const email = normalizeEmail(account.email);
  try {
    existing = await auth.getUserByEmail(email);
  } catch (error) {
    const code = String(error?.code || error?.errorInfo?.code || '');
    if (!/user-not-found/i.test(code)) throw error;
  }
  const displayName = account.name || account.label;
  if (existing?.uid) {
    await auth.updateUser(existing.uid, {
      email,
      password: account.password,
      emailVerified: true,
      disabled: false,
      displayName,
    });
    return { uid: existing.uid, created: false, email };
  }
  const created = await auth.createUser({
    email,
    password: account.password,
    emailVerified: true,
    disabled: false,
    displayName,
  });
  return { uid: created.uid, created: true, email };
}

async function setClaims(auth, uid, account) {
  const claims = safeClaimPatchForAccount(account);
  await auth.setCustomUserClaims(uid, claims);
  return claims;
}

async function writeProfile(db, account, uid, runId) {
  if (!db || typeof db.collection !== 'function') return { skipped: true, reason: 'Firestore Admin client unavailable' };
  const profile = profileForAccount(account, uid, runId);
  await db.collection('users').doc(uid).set(profile, { merge: true });
  return { skipped: false, collection: 'users', id: uid };
}

async function provisionTestAccounts(options = {}) {
  const root = options.root || process.cwd();
  if (options.loadEnvironment !== false) loadEnv(root);
  const { runId, runDir } = ensureRunDir();
  const out = options.reportPath || getRunFile('test-account-provisioning.json', runId);
  const enabled = options.enabled !== undefined ? options.enabled : bool(process.env.CHAOS_QA_AUTO_PROVISION_TEST_USERS);
  const report = {
    ok: true,
    skipped: !enabled,
    runId,
    generatedAt: nowIso(),
    firebaseProjectId: EXPECTED_FIREBASE_PROJECT,
    accounts: [],
    errors: [],
    notes: [],
  };
  if (!enabled) {
    const accounts = readConfiguredAccounts();
    const envErrors = validateLocalRoleEnv(accounts, EXPECTED_FIREBASE_PROJECT);
    report.skipped = true;
    report.status = 'verifying-existing-accounts';
    report.notes.push('CHAOS_QA_AUTO_PROVISION_TEST_USERS is not enabled; verifying existing release-gate role accounts from .env.test.local before allowing Playwright.');
    if (envErrors.length) {
      report.ok = false;
      report.blocked = true;
      report.status = 'blocked';
      report.errors = [...new Set(envErrors)];
      report.manualConfigurationRequired = [
        'Provide four valid, unique, dedicated testing accounts in .env.test.local, or explicitly enable temporary provisioning for chaos-test-d1601.',
        'Required names: SYSTEM_ADMIN_EMAIL/PASSWORD, OWNER_EMAIL/PASSWORD, MANAGER_EMAIL/PASSWORD, STAFF_EMAIL/PASSWORD.',
        'Do not reuse the protected founding administrator or a System Administrator account for owner, manager, or staff.'
      ];
      writeJson(out, report);
      return report;
    }
    try {
      const verified = await verifyRoleAccounts({ throwOnFailure: false });
      report.verifiedExistingAccounts = true;
      report.roleVerificationOutput = verified.out;
      report.accounts = (verified.report.accounts || []).map(row => ({ key: row.key, label: row.label, emailEnv: row.emailEnv, email: row.email, uid: row.uid, superAdmin: row.superAdmin }));
      if (verified.report.ok !== true) {
        report.ok = false;
        report.blocked = true;
        report.status = 'blocked';
        report.errors = [...new Set(verified.report.errors || ['Existing release-gate role accounts could not be verified.'])];
        report.manualConfigurationRequired = verified.report.manualConfigurationRequired || [];
      }
    } catch (error) {
      report.ok = false;
      report.blocked = true;
      report.status = 'blocked';
      report.errors = [error.message || String(error)];
    }
    writeJson(out, report);
    return report;
  }

  const accounts = readConfiguredAccounts();
  const safetyErrors = validateProvisionSafety(accounts);
  if (safetyErrors.length) {
    report.ok = false;
    report.errors = safetyErrors;
    writeJson(out, report);
    return report;
  }

  let app;
  try {
    app = options.adminApp || await getDefaultAdminApp(EXPECTED_FIREBASE_PROJECT);
  } catch (error) {
    report.ok = false;
    report.errors.push(`Testing Firebase Admin credentials are required to auto-provision release-gate users for ${EXPECTED_FIREBASE_PROJECT}. Configure FIREBASE_TEST_SERVICE_ACCOUNT_KEY or another supported testing service-account env var, or create the accounts manually.`);
    report.errors.push(error.message || String(error));
    writeJson(out, report);
    return report;
  }

  const auth = options.auth || app.auth();
  const db = options.firestore || (typeof app.firestore === 'function' ? app.firestore() : null);
  const rows = [];
  for (const account of accounts) {
    try {
      const user = await upsertAuthUser(auth, account);
      const claims = await setClaims(auth, user.uid, account);
      const profileWrite = await writeProfile(db, account, user.uid, runId);
      const role = roleForKey(account.key);
      rows.push({
        key: account.key,
        label: account.label,
        emailEnv: account.emailEnv,
        email: normalizeEmail(account.email),
        uid: user.uid,
        created: user.created,
        customClaimsWritten: Object.keys(claims).sort(),
        expectedSuperAdmin: role.superAdmin,
        profileWrite,
      });
    } catch (error) {
      rows.push({ key: account.key, label: account.label, emailEnv: account.emailEnv, email: normalizeEmail(account.email), error: error.message || String(error) });
      report.errors.push(`${account.emailEnv} provisioning failed: ${error.message || String(error)}`);
    }
  }

  const roleRows = rows.map((row) => ({
    key: row.key,
    emailEnv: row.emailEnv,
    email: row.email,
    uid: row.uid || '',
    firebaseProjectId: EXPECTED_FIREBASE_PROJECT,
    runtimeProjectId: EXPECTED_FIREBASE_PROJECT,
    superAdmin: row.key === 'systemAdmin',
    customClaimSuperAdmin: row.key === 'systemAdmin',
    serverMasterAdminMatched: false,
    firestoreSuperAdmin: row.key === 'systemAdmin',
    firestoreSystemAdministrator: row.key === 'systemAdmin',
  }));
  report.errors.push(...analyzeRoleRows(roleRows, EXPECTED_FIREBASE_PROJECT));
  report.errors = [...new Set(report.errors)];
  report.ok = report.errors.length === 0;
  report.skipped = false;
  report.accounts = rows;
  report.notes.push('Passwords, tokens, service-account values, and API keys are intentionally not written to this report.');
  writeJson(out, report);
  return report;
}

if (require.main === module) {
  provisionTestAccounts()
    .then((report) => {
      console.log(JSON.stringify({ ok: report.ok, skipped: report.skipped, runId: report.runId, firebaseProjectId: report.firebaseProjectId, accounts: report.accounts.map(a => ({ key: a.key, emailEnv: a.emailEnv, email: a.email, uid: a.uid, created: a.created, expectedSuperAdmin: a.expectedSuperAdmin, error: a.error || '' })), errors: report.errors, notes: report.notes }, null, 2));
      if (!report.ok) process.exitCode = 1;
    })
    .catch((error) => {
      const { runId } = ensureRunDir();
      writeJson(getRunFile('test-account-provisioning.json', runId), { ok: false, runId, generatedAt: nowIso(), errors: [error.message || String(error)] });
      console.error(error.stack || error.message || String(error));
      process.exitCode = 1;
    });
}

module.exports = {
  PROTECTED_ROOT_EMAILS,
  SAFE_TEMP_EMAIL_RE,
  profileForAccount,
  safeClaimPatchForAccount,
  validateProvisionSafety,
  provisionTestAccounts,
};

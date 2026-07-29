#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ensureRunDir, writeJson, getRoleReportPath, readJsonIfExists } = require('./run-context.cjs');
const { loadEnv, env } = require('../86chaos-full-audit/env-loader.cjs');
const { readFirebaseConfig } = require('../86chaos-full-audit/firebase-client.cjs');

const EXPECTED_FIREBASE_PROJECT = 'chaos-test-d1601';
const ROLE_DEFINITIONS = [
  { key: 'systemAdmin', label: 'System Administrator', emailEnv: 'SYSTEM_ADMIN_EMAIL', passwordEnv: 'SYSTEM_ADMIN_PASSWORD', expectedSuperAdmin: true, name: 'QA System Administrator', role: 'Owner', isAdmin: true, isOwner: true, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, settings: true, ops: true, maintenance: true } },
  { key: 'owner', label: 'Owner', emailEnv: 'OWNER_EMAIL', passwordEnv: 'OWNER_PASSWORD', expectedSuperAdmin: false, name: 'QA Owner Login', role: 'Owner', isAdmin: true, isOwner: true, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, settings: true, ops: true, maintenance: true } },
  { key: 'manager', label: 'Manager', emailEnv: 'MANAGER_EMAIL', passwordEnv: 'MANAGER_PASSWORD', expectedSuperAdmin: false, name: 'QA Manager Login', role: 'Manager', isAdmin: true, isOwner: false, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, ops: true, maintenance: true } },
  { key: 'staff', label: 'Staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', expectedSuperAdmin: false, name: 'QA Staff Login', role: 'Line Cook', isAdmin: false, isOwner: false, permissions: { help: true } },
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function splitEmailList(value) {
  return String(value || '')
    .split(/[;,\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

function appUrl(pathOrTab = '') {
  const base = env('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL').replace(/\/+$/, '');
  if (!base) return '';
  if (!pathOrTab) return base;
  if (/^https?:\/\//i.test(pathOrTab)) return pathOrTab;
  if (String(pathOrTab).startsWith('/')) return `${base}${pathOrTab}`;
  return `${base}/?tab=${encodeURIComponent(pathOrTab)}`;
}

function safeAccountDefinition(def) {
  return {
    key: def.key,
    label: def.label,
    emailEnv: def.emailEnv,
    passwordEnv: def.passwordEnv,
    expectedSuperAdmin: def.expectedSuperAdmin,
    name: def.name,
    role: def.role,
    isAdmin: def.isAdmin === true,
    isOwner: def.isOwner === true,
    permissions: def.permissions || {},
  };
}

function readConfiguredAccounts() {
  return ROLE_DEFINITIONS.map((def) => {
    const email = normalizeEmail(process.env[def.emailEnv]);
    const password = process.env[def.passwordEnv] || '';
    return { ...safeAccountDefinition(def), email, password, emailPresent: Boolean(email), passwordPresent: Boolean(password) };
  });
}

function buildMasterEmailSet() {
  return new Set([
    normalizeEmail(process.env.MASTER_ADMIN_EMAIL),
    normalizeEmail(process.env.REACT_APP_MASTER_ADMIN_EMAIL),
    ...splitEmailList(process.env.MASTER_ADMIN_EMAILS),
    ...splitEmailList(process.env.REACT_APP_MASTER_ADMIN_EMAILS),
  ].filter(Boolean));
}

function validateLocalRoleEnv(accounts, expectedProject = EXPECTED_FIREBASE_PROJECT) {
  const errors = [];
  for (const account of accounts) {
    if (!account.emailPresent) errors.push(`${account.emailEnv} is missing. Configure ${account.emailEnv}=<dedicated testing ${account.label.toLowerCase()} email> in .env.test.local.`);
    if (!account.passwordPresent) errors.push(`${account.passwordEnv} is missing. Configure ${account.passwordEnv}=<dedicated testing ${account.label.toLowerCase()} password> in .env.test.local.`);
  }
  const seenEmails = new Map();
  for (const account of accounts.filter(a => a.email)) {
    if (seenEmails.has(account.email)) {
      const first = seenEmails.get(account.email);
      errors.push(`${first.emailEnv} and ${account.emailEnv} must be different accounts. Do not reuse SYSTEM_ADMIN_EMAIL, OWNER_EMAIL, MANAGER_EMAIL, or STAFF_EMAIL.`);
    } else {
      seenEmails.set(account.email, account);
    }
  }
  const manager = accounts.find(a => a.key === 'manager');
  const masterEmails = buildMasterEmailSet();
  if (manager?.email && masterEmails.has(manager.email)) {
    errors.push(`MANAGER_EMAIL resolves to a configured master-admin email. Configure MANAGER_EMAIL with a dedicated non-System-Administrator testing account.`);
  }
  if (process.env.REACT_APP_FIREBASE_PROJECT_ID && process.env.REACT_APP_FIREBASE_PROJECT_ID !== expectedProject) {
    errors.push(`REACT_APP_FIREBASE_PROJECT_ID points to ${process.env.REACT_APP_FIREBASE_PROJECT_ID}; release-gate role tests require ${expectedProject}.`);
  }
  if (process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID && process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID !== expectedProject) {
    errors.push(`REACT_APP_TEST_FIREBASE_PROJECT_ID points to ${process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID}; release-gate role tests require ${expectedProject}.`);
  }
  return errors;
}

async function fetchJson(url, options = {}, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable. Run the release gate under Node 24.');
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { rawText: text }; }
  if (!response.ok) {
    const safeText = typeof text === 'string' ? text.slice(0, 1000) : '';
    throw new Error(`HTTP ${response.status} ${response.statusText || ''} for ${url}: ${safeText}`.trim());
  }
  return data;
}

async function signInAccount(account, config, fetchImpl = global.fetch) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
  const signed = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password, returnSecureToken: true }),
  }, fetchImpl);
  if (!signed.idToken || !signed.localId) throw new Error(`${account.emailEnv} could not sign into Firebase Auth or did not return a Firebase UID.`);
  return { ...account, uid: signed.localId, idToken: signed.idToken, firebaseProjectId: config.projectId };
}

async function fetchWhoami(account, fetchImpl = global.fetch) {
  const url = appUrl('/api/whoami');
  if (!url) throw new Error('APP_URL or CHAOS_BASE_URL is missing, so /api/whoami cannot be verified.');
  const whoami = await fetchJson(url, { method: 'GET', headers: { Authorization: `Bearer ${account.idToken}` } }, fetchImpl);
  return {
    key: account.key,
    label: account.label,
    emailEnv: account.emailEnv,
    passwordEnv: account.passwordEnv,
    email: account.email,
    uid: account.uid,
    whoamiUid: whoami.uid || '',
    whoamiEmail: normalizeEmail(whoami.email),
    superAdmin: whoami.superAdmin === true,
    customClaimSuperAdmin: whoami.customClaimSuperAdmin === true,
    serverMasterAdminMatched: whoami.serverMasterAdminMatched === true,
    firestoreSuperAdmin: whoami.firestoreSuperAdmin === true,
    firestoreSystemAdministrator: whoami.firestoreSystemAdministrator === true,
    firestoreProfileRole: whoami.firestoreProfileRole || '',
    runtimeProjectId: whoami.runtime?.firebaseProjectId || '',
    firebaseProjectId: account.firebaseProjectId || '',
  };
}

function safeRow(row) {
  return {
    key: row.key,
    label: row.label,
    emailEnv: row.emailEnv,
    email: row.email,
    uid: row.uid,
    whoamiUid: row.whoamiUid || '',
    whoamiEmail: row.whoamiEmail || '',
    superAdmin: row.superAdmin === true,
    customClaimSuperAdmin: row.customClaimSuperAdmin === true,
    serverMasterAdminMatched: row.serverMasterAdminMatched === true,
    firestoreSuperAdmin: row.firestoreSuperAdmin === true,
    firestoreSystemAdministrator: row.firestoreSystemAdministrator === true,
    firestoreProfileRole: row.firestoreProfileRole || '',
    runtimeProjectId: row.runtimeProjectId || '',
    firebaseProjectId: row.firebaseProjectId || '',
  };
}

function analyzeRoleRows(rows, expectedProject = EXPECTED_FIREBASE_PROJECT) {
  const errors = [];
  const emails = new Map();
  const uids = new Map();
  for (const row of rows) {
    if (!row.email) errors.push(`${row.emailEnv || row.key} is missing an email.`);
    if (row.email) {
      if (emails.has(row.email)) errors.push(`${emails.get(row.email).emailEnv} and ${row.emailEnv} resolve to the same email ${row.email}.`);
      else emails.set(row.email, row);
    }
    if (!row.uid) errors.push(`${row.emailEnv || row.key} did not resolve to a Firebase UID.`);
    if (row.uid) {
      if (uids.has(row.uid)) errors.push(`${uids.get(row.uid).emailEnv} and ${row.emailEnv} resolve to the same Firebase UID ${row.uid}.`);
      else uids.set(row.uid, row);
    }
    if (row.firebaseProjectId && row.firebaseProjectId !== expectedProject) errors.push(`${row.emailEnv} signed into Firebase project ${row.firebaseProjectId}; expected ${expectedProject}.`);
    if (row.runtimeProjectId && row.runtimeProjectId !== expectedProject) errors.push(`${row.emailEnv} /api/whoami reported Firebase project ${row.runtimeProjectId}; expected ${expectedProject}.`);
  }
  const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
  if (byKey.systemAdmin && byKey.systemAdmin.superAdmin !== true) {
    errors.push(`SYSTEM_ADMIN_EMAIL is not server-verified as System Administrator. Configure SYSTEM_ADMIN_EMAIL with the dedicated testing System Administrator account.`);
  }
  for (const key of ['owner', 'manager', 'staff']) {
    const row = byKey[key];
    if (!row) continue;
    if (row.superAdmin === true) {
      const envName = key === 'owner' ? 'OWNER_EMAIL' : key === 'manager' ? 'MANAGER_EMAIL' : 'STAFF_EMAIL';
      const roleName = key === 'owner' ? 'Owner' : key === 'manager' ? 'Manager' : 'Staff';
      errors.push(`${envName} resolves to a System Administrator account. Configure ${envName} with a dedicated non-System-Administrator ${roleName.toLowerCase()} testing account.`);
    }
  }
  const manager = byKey.manager;
  if (manager && (manager.customClaimSuperAdmin || manager.serverMasterAdminMatched || manager.firestoreSuperAdmin || manager.firestoreSystemAdministrator)) {
    const reasons = [];
    if (manager.customClaimSuperAdmin) reasons.push('customClaimSuperAdmin=true');
    if (manager.serverMasterAdminMatched) reasons.push('serverMasterAdminMatched=true');
    if (manager.firestoreSuperAdmin) reasons.push('firestoreSuperAdmin=true');
    if (manager.firestoreSystemAdministrator) reasons.push('firestoreSystemAdministrator=true');
    errors.push(`MANAGER_EMAIL is configured as System Administrator (${reasons.join(', ')}). Configure MANAGER_EMAIL with a dedicated non-System-Administrator testing account.`);
  }
  return errors;
}

function buildReport({ runId, runDir, expectedProject, appUrlValue, config, rows, errors, phase = 'complete' }) {
  const safeRows = rows.map(safeRow);
  return {
    ok: errors.length === 0,
    runId,
    generatedAt: new Date().toISOString(),
    phase,
    appUrl: appUrlValue || '',
    expectedFirebaseProjectId: expectedProject,
    firebaseProjectId: config?.projectId || '',
    allEmailsUnique: new Set(safeRows.map(row => row.email).filter(Boolean)).size === safeRows.filter(row => row.email).length,
    allUidsUnique: new Set(safeRows.map(row => row.uid).filter(Boolean)).size === safeRows.filter(row => row.uid).length,
    accounts: safeRows,
    manualConfigurationRequired: errors.length ? [
      'A dedicated non-System-Administrator manager account must be configured in .env.test.local before the release gate can run.',
      'MANAGER_EMAIL=<dedicated testing manager email>',
      'MANAGER_PASSWORD=<dedicated testing manager password>',
      'Do not reuse SYSTEM_ADMIN_EMAIL, OWNER_EMAIL, or STAFF_EMAIL.',
    ] : [],
    errors,
  };
}

async function verifyRoleAccounts(options = {}) {
  const root = options.root || process.cwd();
  if (options.loadEnvironment !== false) loadEnv(root);
  const { runId, runDir } = ensureRunDir();
  const expectedProject = options.expectedProject || EXPECTED_FIREBASE_PROJECT;
  const fetchImpl = options.fetchImpl || global.fetch;
  const rows = [];
  const accounts = [];
  const errors = [];
  let config = null;
  try {
    config = options.config || readFirebaseConfig();
  } catch (error) {
    errors.push(`Could not read Firebase testing config for role preflight: ${error.message}`);
  }
  const configured = readConfiguredAccounts();
  errors.push(...validateLocalRoleEnv(configured, expectedProject));
  if (config?.projectId && config.projectId !== expectedProject) {
    errors.push(`Firebase config projectId is ${config.projectId}; release-gate role tests require ${expectedProject}.`);
  }
  if (errors.length === 0 && config) {
    for (const account of configured) {
      try {
        const signed = await signInAccount(account, config, fetchImpl);
        accounts.push(signed);
        rows.push(await fetchWhoami(signed, fetchImpl));
      } catch (error) {
        rows.push({ ...account, uid: '', firebaseProjectId: config.projectId, runtimeProjectId: '', superAdmin: false, customClaimSuperAdmin: false, serverMasterAdminMatched: false, firestoreSuperAdmin: false, firestoreSystemAdministrator: false, error: error.message });
        errors.push(`${account.emailEnv} role verification failed: ${error.message}`);
      }
    }
  } else {
    for (const account of configured) rows.push({ ...account, uid: '', firebaseProjectId: config?.projectId || '', runtimeProjectId: '', superAdmin: false, customClaimSuperAdmin: false, serverMasterAdminMatched: false, firestoreSuperAdmin: false, firestoreSystemAdministrator: false });
  }
  errors.push(...analyzeRoleRows(rows, expectedProject));
  const uniqueErrors = [...new Set(errors)];
  const report = buildReport({ runId, runDir, expectedProject, appUrlValue: appUrl(), config, rows, errors: uniqueErrors, phase: options.phase || 'role-preflight' });
  const out = options.reportPath || getRoleReportPath(runId);
  if (options.writeReport !== false) writeJson(out, report);
  if (!report.ok && options.throwOnFailure) {
    const err = new Error(report.errors.join('\n'));
    err.report = report;
    throw err;
  }
  return { report, accounts, out };
}

function validateRoleReportForSeed(report, runId, expectedProject = EXPECTED_FIREBASE_PROJECT) {
  const errors = [];
  if (!report) errors.push('Current-run role-identity-verification.json is missing. Run Verify release-gate role accounts before QA seeding.');
  if (report && report.ok !== true) errors.push(...(Array.isArray(report.errors) && report.errors.length ? report.errors : ['Current-run role account verification is not ok:true.']));
  if (report && report.runId !== runId) errors.push(`Role verification report runId=${report.runId || '(missing)'} does not match current runId=${runId}.`);
  if (report && report.expectedFirebaseProjectId && report.expectedFirebaseProjectId !== expectedProject) errors.push(`Role verification expected project ${report.expectedFirebaseProjectId}; expected ${expectedProject}.`);
  if (report && report.firebaseProjectId && report.firebaseProjectId !== expectedProject) errors.push(`Role verification Firebase project ${report.firebaseProjectId}; expected ${expectedProject}.`);
  const rows = Array.isArray(report?.accounts) ? report.accounts : [];
  if (rows.length !== ROLE_DEFINITIONS.length) errors.push(`Role verification report has ${rows.length} accounts; expected ${ROLE_DEFINITIONS.length}.`);
  errors.push(...analyzeRoleRows(rows, expectedProject));
  return { ok: errors.length === 0, errors: [...new Set(errors)], accounts: rows };
}

if (require.main === module) {
  verifyRoleAccounts({ throwOnFailure: false })
    .then(({ report, out }) => {
      console.log(JSON.stringify({ ok: report.ok, output: out, firebaseProjectId: report.firebaseProjectId, accounts: report.accounts.map(row => ({ key: row.key, emailEnv: row.emailEnv, email: row.email, uid: row.uid, superAdmin: row.superAdmin, customClaimSuperAdmin: row.customClaimSuperAdmin, serverMasterAdminMatched: row.serverMasterAdminMatched, firestoreSuperAdmin: row.firestoreSuperAdmin, firestoreSystemAdministrator: row.firestoreSystemAdministrator, firestoreProfileRole: row.firestoreProfileRole, runtimeProjectId: row.runtimeProjectId })), errors: report.errors, manualConfigurationRequired: report.manualConfigurationRequired }, null, 2));
      if (!report.ok) process.exitCode = 1;
    })
    .catch((error) => {
      const { runId } = ensureRunDir();
      const out = getRoleReportPath(runId);
      const report = { ok: false, runId, generatedAt: new Date().toISOString(), phase: 'role-preflight-crash', errors: [error.message || String(error)] };
      writeJson(out, report);
      console.error(error.stack || error.message || String(error));
      process.exitCode = 1;
    });
}

module.exports = {
  EXPECTED_FIREBASE_PROJECT,
  ROLE_DEFINITIONS,
  readConfiguredAccounts,
  validateLocalRoleEnv,
  analyzeRoleRows,
  verifyRoleAccounts,
  validateRoleReportForSeed,
};

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { ensureRunDir, getSeedReportPath, getRoleReportPath, getSetupStatePath, readJsonIfExists, writeJson } = require('../86chaos-release-gate/run-context.cjs');
const { applyQaWorkspaceEnv, validateQaWorkspaceName } = require('../86chaos-release-gate/qa-workspace.cjs');
const { assertMutationSafety } = require('../86chaos-release-gate/mutation-safety.cjs');
const { runId: RUN_ID, runDir: RELEASE_RUN_DIR } = ensureRunDir();
const OUT_DIR = path.join(process.cwd(), 'test-results');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(RELEASE_RUN_DIR, { recursive: true });
const QA_RESTAURANT_NAME = applyQaWorkspaceEnv(process.env, RUN_ID);
const REPORT_PATH = getSeedReportPath(RUN_ID);
const LEGACY_REPORT_PATH = path.join(OUT_DIR, '86chaos-full-audit-seed-report.json');

const SETUP_STATE_PATH = getSetupStatePath(RUN_ID);
function mergeSetupState(patch = {}) {
  const current = readJsonIfExists(SETUP_STATE_PATH) || {};
  writeJson(SETUP_STATE_PATH, {
    ...current,
    runId: RUN_ID,
    qaWorkspaceName: QA_RESTAURANT_NAME,
    updatedAt: new Date().toISOString(),
    ...patch,
  });
}

function writeReportSync(report) {
  const payload = JSON.stringify({ runId: RUN_ID, generatedAt: new Date().toISOString(), mode: 'seed', ...report }, null, 2);
  fs.writeFileSync(REPORT_PATH, payload);
  fs.writeFileSync(LEGACY_REPORT_PATH, payload);
}

process.on('uncaughtException', (error) => {
  writeReportSync({ ok: false, error: error.stack || error.message, phase: 'uncaughtException' });
  console.error(error.stack || error.message);
  process.exit(1);
});
process.on('unhandledRejection', (error) => {
  writeReportSync({ ok: false, error: error.stack || error.message || String(error), phase: 'unhandledRejection' });
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});

let loadEnv, env, boolEnv;
let readFirebaseConfig;
let buildFakeRestaurantProfile, summarizeSchedule;

try {
  ({ loadEnv, env, boolEnv } = require('./env-loader.cjs'));
  ({ readFirebaseConfig } = require('./firebase-client.cjs'));
  ({ verifyRoleAccounts, validateRoleReportForSeed } = require('../86chaos-release-gate/verify-role-accounts.cjs'));
  ({ buildFakeRestaurantProfile } = require('../../tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs'));
  ({ summarizeSchedule } = require('../../tests/86chaos-full-audit/utils/math-oracle.cjs'));
} catch (error) {
  writeReportSync({ ok: false, error: error.stack || error.message, phase: 'top-level-require' });
  console.error(error.stack || error.message);
  process.exit(1);
}

loadEnv(process.cwd());
const ALLOW_MUTATION = boolEnv('CHAOS_ALLOW_MUTATION');

const COLLECTION_ORDER = [
  'restaurantAdminAlerts', 'eventReminders', 'personalReminders', 'scheduleCoverageTargets', 'scheduleTemplates', 'availabilityRecords', 'shiftSwaps', 'timePunches', 'timeOffRequests', 'shifts', 'events', 'financialExpenses', 'sales', 'maintenanceLogs', 'pmSchedules', 'tasks', 'prepItems', 'menuDependencies', 'recipes', 'inventoryItems', 'vendors', 'users'
];

async function writeReport(report) {
  writeReportSync(report);
}

function appUrl(pathOrTab = '') {
  const base = env('APP_URL', 'CHAOS_BASE_URL').replace(/\/+$/, '');
  if (!pathOrTab) return base;
  if (/^https?:\/\//i.test(pathOrTab)) return pathOrTab;
  if (String(pathOrTab).startsWith('/')) return `${base}${pathOrTab}`;
  return `${base}/?tab=${encodeURIComponent(pathOrTab)}`;
}

function asFirestoreValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) {
    const values = value.map(asFirestoreValue).filter(Boolean);
    return values.length ? { arrayValue: { values } } : { arrayValue: {} };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      const converted = asFirestoreValue(v);
      if (converted) fields[k] = converted;
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFirestoreDocument(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data || {})) {
    const converted = asFirestoreValue(v);
    if (converted) fields[k] = converted;
  }
  return { fields };
}

async function pageFetchJson(page, request) {
  return page.evaluate(async ({ url, method, headers, body }) => {
    const response = await fetch(url, {
      method: method || 'GET',
      headers: headers || {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { rawText: text }; }
    if (!response.ok) {
      const detail = typeof text === 'string' ? text.slice(0, 1400) : '';
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${detail}`);
    }
    return data;
  }, request);
}

function firestoreRest(config, idToken) {
  const encodedProject = encodeURIComponent(config.projectId);
  const base = `https://firestore.googleapis.com/v1/projects/${encodedProject}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  return { base, headers };
}

function parseDocId(docName = '') {
  return String(docName || '').split('/').pop() || '';
}

async function createDoc(page, rest, colName, payload) {
  const url = `${rest.base}/${encodeURIComponent(colName)}`;
  const response = await pageFetchJson(page, { url, method: 'POST', headers: rest.headers, body: toFirestoreDocument(payload) });
  return { collection: colName, id: parseDocId(response.name), name: payload.name || payload.title || payload.employeeName || '', docName: response.name };
}

async function patchDoc(page, rest, colName, docId, payload) {
  const url = `${rest.base}/${encodeURIComponent(colName)}/${encodeURIComponent(docId)}`;
  const response = await pageFetchJson(page, { url, method: 'PATCH', headers: rest.headers, body: toFirestoreDocument(payload) });
  return { collection: colName, id: parseDocId(response.name), docName: response.name };
}

async function deleteDocName(page, rest, docName) {
  if (!docName) return;
  const url = `https://firestore.googleapis.com/v1/${docName}`;
  await pageFetchJson(page, { url, method: 'DELETE', headers: rest.headers });
}

async function queryQaOwned(page, rest, colName, restaurantId) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: colName }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'qaOwned' }, op: 'EQUAL', value: { booleanValue: true } } },
            { fieldFilter: { field: { fieldPath: 'restaurantId' }, op: 'EQUAL', value: { stringValue: restaurantId } } },
          ],
        },
      },
      limit: 500,
    },
  };
  const rows = await pageFetchJson(page, { url: `${rest.base}:runQuery`, method: 'POST', headers: rest.headers, body });
  return (rows || []).map(r => r.document).filter(Boolean);
}



async function getDocByName(page, rest, docName) {
  if (!docName) return null;
  try {
    return await pageFetchJson(page, { url: `https://firestore.googleapis.com/v1/${docName}`, method: 'GET', headers: rest.headers });
  } catch (error) {
    if (/HTTP 404\b/.test(error.message || '')) return null;
    throw error;
  }
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  return undefined;
}

function fromFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

const EXPECTED_MINIMUM_COUNTS = {
  users: 7,
  workspaceMembers: 4,
  vendors: 2,
  inventoryItems: 4,
  recipes: 2,
  menuDependencies: 2,
  shifts: 15,
  timeOffRequests: 2,
  events: 3,
  timePunches: 2,
  prepItems: 2,
  tasks: 2,
  maintenanceLogs: 2,
  pmSchedules: 2,
  sales: 14,
  financialExpenses: 2,
  restaurantAdminAlerts: 2,
  personalReminders: 2,
  availabilityRecords: 3,
  scheduleTemplates: 1,
  scheduleCoverageTargets: 2,
};

function summarizeCreatedDocuments(createdByCollection = {}, memberships = [], restaurantRef = null, restaurantId = '') {
  const rows = [];
  if (restaurantRef) rows.push({ collection: 'restaurants', id: restaurantRef.id || restaurantId, docName: restaurantRef.docName, restaurantId, qaRunId: RUN_ID, expectedQaOwned: true });
  for (const [collection, docs] of Object.entries(createdByCollection || {})) {
    for (const doc of docs || []) rows.push({ collection, id: doc.id, docName: doc.docName, name: doc.name || '', restaurantId, qaRunId: RUN_ID, expectedQaOwned: true });
  }
  for (const doc of memberships || []) rows.push({ collection: 'workspaceMembers', id: doc.id, docName: doc.docName, restaurantId, qaRunId: RUN_ID, expectedQaOwned: true, roleKey: doc.key });
  return rows;
}

async function verifySeedDocuments(page, rest, seededDocuments, expectedCounts, restaurantId) {
  const verifiedCounts = {};
  const missing = [];
  const bad = [];
  const verifiedDocuments = [];
  for (const row of seededDocuments) {
    if (!row.docName) {
      missing.push({ ...row, reason: 'missing document resource name in seed report' });
      continue;
    }
    const remote = await getDocByName(page, rest, row.docName);
    if (!remote) {
      missing.push({ ...row, reason: 'document was not readable after creation' });
      continue;
    }
    const data = fromFirestoreFields(remote.fields || {});
    const problems = [];
    if (row.collection !== 'restaurants' && data.restaurantId !== restaurantId) problems.push(`restaurantId=${data.restaurantId || '(missing)'}`);
    if (data.qaOwned !== true) problems.push(`qaOwned=${String(data.qaOwned)}`);
    if (data.qaRunId !== RUN_ID) problems.push(`qaRunId=${data.qaRunId || '(missing)'}`);
    if (problems.length) bad.push({ collection: row.collection, id: row.id, docName: row.docName, problems });
    verifiedCounts[row.collection] = (verifiedCounts[row.collection] || 0) + 1;
    verifiedDocuments.push({ collection: row.collection, id: row.id, docName: row.docName, restaurantId: data.restaurantId || restaurantId, qaRunId: data.qaRunId || '', qaOwned: data.qaOwned === true });
  }
  const countFailures = [];
  for (const [collection, minimum] of Object.entries(expectedCounts)) {
    const actual = verifiedCounts[collection] || 0;
    if (actual < minimum) countFailures.push({ collection, expectedMinimum: minimum, actual });
  }
  const workspaceMemberIds = seededDocuments.filter(row => row.collection === 'workspaceMembers').map(row => row.id).filter(Boolean);
  if (new Set(workspaceMemberIds).size !== workspaceMemberIds.length) {
    countFailures.push({ collection: 'workspaceMembers', expected: 'unique ids', actual: workspaceMemberIds });
  }
  return {
    ok: missing.length === 0 && bad.length === 0 && countFailures.length === 0,
    expectedCounts,
    verifiedCounts,
    verifiedDocuments,
    missing,
    bad,
    countFailures,
  };
}

async function deleteQaOwned(page, rest, restaurantId) {
  const deleted = [];
  for (const colName of COLLECTION_ORDER) {
    try {
      const docs = await queryQaOwned(page, rest, colName, restaurantId);
      for (const doc of docs) await deleteDocName(page, rest, doc.name);
      deleted.push({ collection: colName, count: docs.length });
    } catch (error) {
      deleted.push({ collection: colName, error: error.message });
    }
  }
  return deleted;
}

async function addCollection(page, rest, colName, records, idKeys = []) {
  const created = [];
  for (const record of records) {
    const payload = { ...record };
    const meta = {};
    for (const key of idKeys) {
      if (payload[key] !== undefined) { meta[key] = payload[key]; delete payload[key]; }
    }
    const ref = await createDoc(page, rest, colName, payload);
    created.push({ ...ref, ...meta });
  }
  return created;
}

function withIds(profile, createdIds) {
  const userIdsByKey = Object.fromEntries((createdIds.users || []).map(x => [x.idKey, x.id]));
  const vendorIdsByKey = Object.fromEntries((createdIds.vendors || []).map(x => [x.key, x.id]));
  for (const shift of profile.collections.shifts) {
    if (shift.employeeKey && userIdsByKey[shift.employeeKey]) { const uid = userIdsByKey[shift.employeeKey]; shift.employeeId = uid; shift.scheduleUserId = uid; shift.userId = uid; shift.rosterUserId = uid; }
    delete shift.employeeKey;
  }
  for (const item of profile.collections.inventoryItems) {
    if (item.vendorKey && vendorIdsByKey[item.vendorKey]) item.supplierId = vendorIdsByKey[item.vendorKey];
    delete item.vendorKey;
  }
  for (const req of profile.collections.timeOffRequests) {
    if (req.userKey && userIdsByKey[req.userKey]) { const uid = userIdsByKey[req.userKey]; req.userId = uid; req.employeeId = uid; req.createdBy = uid; }
    delete req.userKey;
  }
  for (const rec of profile.collections.availabilityRecords) {
    if (rec.userKey && userIdsByKey[rec.userKey]) { const uid = userIdsByKey[rec.userKey]; rec.userId = uid; rec.employeeId = uid; rec.scheduleUserId = uid; }
    delete rec.userKey;
  }
  for (const punch of profile.collections.timePunches) {
    if (punch.employeeKey && userIdsByKey[punch.employeeKey]) { const uid = userIdsByKey[punch.employeeKey]; punch.employeeId = uid; punch.scheduleUserId = uid; punch.userId = uid; }
    delete punch.employeeKey;
  }
  return { userIdsByKey, vendorIdsByKey };
}

async function main() {
  const qaNameCheck = validateQaWorkspaceName(QA_RESTAURANT_NAME, RUN_ID);
  if (!qaNameCheck.ok) throw new Error(`QA workspace name failed safety validation: ${qaNameCheck.errors.join('; ')}`);
  const earlyMutationSafety = assertMutationSafety({ env: process.env, runId: RUN_ID, requireAdminCredentials: false });
  if (!earlyMutationSafety.ok) throw new Error(`QA seed mutation safety failed: ${earlyMutationSafety.errors.join('; ')}`);
  mergeSetupState({ writesStarted: false, mutationSafety: earlyMutationSafety, qaWorkspaceValidation: qaNameCheck });
  const report = { ok: false, warnings: [] };
  let browser;
  try {
    report.env = {
      appUrlPresent: Boolean(env('APP_URL', 'CHAOS_BASE_URL')),
      expectedVersion: env('CHAOS_EXPECTED_VERSION'),
      mutation: env('CHAOS_ALLOW_MUTATION'),
      createRestaurant: env('CHAOS_QA_CREATE_RESTAURANT'),
      workspace: env('CHAOS_QA_WORKSPACE'),
      ownerEmailPresent: Boolean(env('OWNER_EMAIL', 'TEST_OWNER_EMAIL', 'ADMIN_EMAIL', 'MANAGER_EMAIL', 'TEST_EMAIL')),
    };
    if (!ALLOW_MUTATION) throw new Error('CHAOS_ALLOW_MUTATION=true is required before seeding fake restaurant data.');
    if (!report.env.appUrlPresent) throw new Error('APP_URL or CHAOS_BASE_URL is required before browser-based seeding can run.');

    const config = readFirebaseConfig();
    const mutationSafety = assertMutationSafety({ env: process.env, runId: RUN_ID, projectId: config.projectId, requireAdminCredentials: false });
    if (!mutationSafety.ok) throw new Error(`QA seed mutation safety failed: ${mutationSafety.errors.join('; ')}`);
    report.mutationSafety = mutationSafety;
    report.firebaseProjectId = config.projectId;
    report.seedMethod = 'browser-origin-rest';
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    await page.goto(appUrl('today'), { waitUntil: 'domcontentloaded', timeout: 60000 });

    const roleReportPath = getRoleReportPath(RUN_ID);
    const existingRoleReport = readJsonIfExists(roleReportPath);
    const roleReportValidation = validateRoleReportForSeed(existingRoleReport, RUN_ID);
    if (!roleReportValidation.ok) {
      throw new Error(`Role identity preflight failed before QA data writes:\n${roleReportValidation.errors.join('\n')}`);
    }
    const verifiedRoles = await verifyRoleAccounts({ writeReport: true, throwOnFailure: true, phase: 'seed-role-verification' });
    report.roleIdentityVerification = verifiedRoles.report;
    const roleAccounts = verifiedRoles.accounts;
    const writer = roleAccounts.find(account => account.key === 'systemAdmin') || roleAccounts.find(account => account.key === 'owner');
    if (!writer) throw new Error('No System Administrator test account was available for QA setup.');
    report.signedInAs = writer.email;
    report.signedInUid = writer.uid;
    report.roleAccounts = roleAccounts.map(({ key, email, uid, role }) => ({ key, email, uid, role }));
    const rest = firestoreRest(config, writer.idToken);

    let restaurantId = env('CHAOS_QA_RESTAURANT_ID');
    let restaurantRef = null;
    if (!restaurantId && boolEnv('CHAOS_QA_CREATE_RESTAURANT')) {
      const restRef = await createDoc(page, rest, 'restaurants', {
        name: QA_RESTAURANT_NAME,
        restaurantName: QA_RESTAURANT_NAME,
        ownerEmail: roleAccounts.find(account => account.key === 'owner')?.email || writer.email,
        ownerUid: roleAccounts.find(account => account.key === 'owner')?.uid || writer.uid,
        isActive: true,
        subscriptionStatus: 'beta',
        planId: 'owner_pro',
        qaOwned: true,
        qaRunId: RUN_ID,
        qaCleanupName: QA_RESTAURANT_NAME,
        createdBy: '86chaos-full-audit',
        source: '86chaos-full-audit',
        createdAt: new Date().toISOString(),
        systemSettings: { overtime: 40, enableTargets: true, targetLaborPct: 23 },
        features: { schedule: true, events: true, ops: true, messages: true, prep: true, recipes: true, inventory: true, sales: true, team: true, maintenance: true, timesheets: true, labor: true },
      });
      restaurantRef = restRef;
      restaurantId = restRef.id;
      report.createdRestaurant = true;
      mergeSetupState({ writesStarted: true, qaDataWritesStarted: true, restaurantId, temporaryRestaurantId: restaurantId, qaWorkspaceName: QA_RESTAURANT_NAME, createdRestaurant: true, cleanupAllowed: true });
    }
    if (!restaurantId) throw new Error('No QA restaurant target found. Set CHAOS_QA_RESTAURANT_ID or set CHAOS_QA_CREATE_RESTAURANT=true.');
    report.restaurantId = restaurantId;
    report.restaurantName = QA_RESTAURANT_NAME;

    report.deletedOldQaData = await deleteQaOwned(page, rest, restaurantId);
    report.memberships = [];
    for (const account of roleAccounts) {
      const membership = {
        userId: account.uid,
        uid: account.uid,
        authUid: account.uid,
        email: account.email,
        name: account.name,
        role: account.role,
        restaurantId,
        restaurantName: QA_RESTAURANT_NAME,
        isAdmin: account.isAdmin === true,
        isOwner: account.isOwner === true,
        isSuperAdmin: false,
        systemAdministratorVerifiedByWhoami: account.key === 'systemAdmin',
        accountOwner: account.accountOwner === true,
        workspaceOwner: account.workspaceOwner === true,
        permissions: account.permissions || {},
        isActive: true,
        qaOwned: true,
        qaRunId: RUN_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ref = await patchDoc(page, rest, 'workspaceMembers', `${account.uid}_${restaurantId}`, membership);
      report.memberships.push({ key: account.key, uid: account.uid, email: account.email, id: ref.id, docName: ref.docName, role: account.role, isAdmin: membership.isAdmin, isOwner: membership.isOwner, accountOwner: membership.accountOwner, workspaceOwner: membership.workspaceOwner });
    }
    const memberIds = report.memberships.map(m => m.id);
    if (new Set(memberIds).size !== report.memberships.length) throw new Error(`Role membership documents were not unique: ${memberIds.join(', ')}`);
    const systemAdminMembership = report.memberships.find(m => m.key === 'systemAdmin');
    if (!systemAdminMembership || systemAdminMembership.role !== 'Kitchen' || systemAdminMembership.isAdmin === true || systemAdminMembership.isOwner === true || systemAdminMembership.accountOwner === true || systemAdminMembership.workspaceOwner === true) {
      throw new Error('QA System Administrator must seed as Kitchen and non-owner/non-admin. Platform authority must remain independent of restaurant authority.');
    }
    report.membershipVerification = { ok: true, count: report.memberships.length, ids: memberIds };

    const seedAnchorDate = new Date();
    report.seedAnchorDate = seedAnchorDate.toISOString();
    const profile = buildFakeRestaurantProfile({ restaurantId, runId: RUN_ID, anchorDate: seedAnchorDate });
    const today = new Date().toISOString().slice(0, 10);
    const roleByKey = Object.fromEntries(roleAccounts.map(account => [account.key, account]));
    for (const key of ['manager', 'staff']) {
      const account = roleByKey[key];
      if (!account) continue;
      profile.collections.shifts.push({
        restaurantId,
        scheduleUserId: account.uid,
        employeeId: account.uid,
        userId: account.uid,
        rosterUserId: account.uid,
        authUid: account.uid,
        employeeName: account.name,
        employeeEmail: account.email,
        role: account.role,
        date: today,
        startTime: key === 'manager' ? '09:00' : '11:00',
        endTime: key === 'manager' ? '17:00' : '19:00',
        status: 'published',
        published: true,
        qaOwned: true,
        qaRunId: RUN_ID,
      });
      profile.collections.availabilityRecords.push({ restaurantId, userId: account.uid, employeeId: account.uid, scheduleUserId: account.uid, employeeName: account.name, dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' }), availableFrom: '08:00', availableTo: '22:00', isActive: true, qaOwned: true, qaRunId: RUN_ID });
    }
    const created = {};
    created.users = await addCollection(page, rest, 'users', profile.collections.users, ['idKey']);
    created.vendors = await addCollection(page, rest, 'vendors', profile.collections.vendors, ['key']);
    const ids = withIds(profile, created);
    for (const colName of ['inventoryItems', 'recipes', 'menuDependencies', 'shifts', 'timeOffRequests', 'events', 'timePunches', 'prepItems', 'tasks', 'maintenanceLogs', 'pmSchedules', 'sales', 'financialExpenses', 'restaurantAdminAlerts', 'personalReminders', 'availabilityRecords', 'scheduleTemplates', 'scheduleCoverageTargets']) {
      created[colName] = await addCollection(page, rest, colName, profile.collections[colName] || []);
    }

    report.seededDocuments = summarizeCreatedDocuments(created, report.memberships, restaurantRef, restaurantId);
    mergeSetupState({ writesStarted: true, qaDataWritesStarted: true, seeded: true, restaurantId, temporaryRestaurantId: restaurantId, seededDocumentCount: report.seededDocuments.length, createdDocumentIds: report.seededDocuments });
    report.expectedCounts = EXPECTED_MINIMUM_COUNTS;
    report.createdCounts = Object.fromEntries(Object.entries(created).map(([k, v]) => [k, v.length]));
    report.createdCounts.workspaceMembers = report.memberships.length;
    report.createdCounts.restaurants = restaurantRef ? 1 : 0;
    report.verification = await verifySeedDocuments(page, rest, report.seededDocuments, EXPECTED_MINIMUM_COUNTS, restaurantId);
    report.ok = report.verification.ok === true;
    mergeSetupState({ verified: report.ok === true, verificationOk: report.verification?.ok === true });
    report.profile = { restaurantId, restaurantName: QA_RESTAURANT_NAME, users: created.users, createdCounts: report.createdCounts, ids, expectations: profile.expectations, scheduleTruth: summarizeSchedule(profile.collections.shifts) };
    if (!report.ok) throw new Error(`Seed verification failed. Missing=${report.verification.missing.length}; bad=${report.verification.bad.length}; countFailures=${report.verification.countFailures.length}.`);
    await writeReport(report);
    console.log(`Seeded and verified fake QA restaurant data for ${restaurantId}. Report: ${REPORT_PATH}`);
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
    await writeReport(report);
    console.error(error.stack || error.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

if (require.main === module) main();

module.exports = {
  EXPECTED_MINIMUM_COUNTS,
  verifySeedDocuments,
  summarizeCreatedDocuments,
  fromFirestoreFields,
  fromFirestoreValue,
};

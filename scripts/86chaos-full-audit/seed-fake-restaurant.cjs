#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(process.cwd(), 'test-results');
fs.mkdirSync(OUT_DIR, { recursive: true });
const RUN_ID = process.env.CHAOS_FULL_AUDIT_RUN_ID || process.env.CHAOS_RELEASE_GATE_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const QA_RESTAURANT_NAME = '86 Chaos Full Audit QA Restaurant';
const REPORT_PATH = path.join(OUT_DIR, '86chaos-full-audit-seed-report.json');

function writeReportSync(report) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ runId: RUN_ID, generatedAt: new Date().toISOString(), mode: 'seed', ...report }, null, 2));
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

function getSeedCredentials() {
  const email = env('SYSTEM_ADMIN_EMAIL', 'CHAOS_SYSTEM_ADMIN_EMAIL', 'OWNER_EMAIL');
  const password = env('SYSTEM_ADMIN_PASSWORD', 'CHAOS_SYSTEM_ADMIN_PASSWORD', 'OWNER_PASSWORD');
  if (!email || !password) throw new Error('Missing SYSTEM_ADMIN_EMAIL/SYSTEM_ADMIN_PASSWORD for QA restaurant creation.');
  return { email: String(email).trim(), password };
}

function getRoleCredentials() {
  return [
    { key: 'systemAdmin', email: env('SYSTEM_ADMIN_EMAIL', 'CHAOS_SYSTEM_ADMIN_EMAIL'), password: env('SYSTEM_ADMIN_PASSWORD', 'CHAOS_SYSTEM_ADMIN_PASSWORD'), name: 'QA System Administrator', role: 'Owner', isAdmin: true, isOwner: true, isSuperAdmin: true, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, settings: true, ops: true, maintenance: true } },
    { key: 'owner', email: env('OWNER_EMAIL', 'CHAOS_OWNER_EMAIL'), password: env('OWNER_PASSWORD', 'CHAOS_OWNER_PASSWORD'), name: 'QA Owner Login', role: 'Owner', isAdmin: true, isOwner: true, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, settings: true, ops: true, maintenance: true } },
    { key: 'manager', email: env('MANAGER_EMAIL', 'CHAOS_MANAGER_EMAIL'), password: env('MANAGER_PASSWORD', 'CHAOS_MANAGER_PASSWORD'), name: 'QA Manager Login', role: 'Manager', isAdmin: true, isOwner: false, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, ops: true, maintenance: true } },
    { key: 'staff', email: env('STAFF_EMAIL', 'CHAOS_STAFF_EMAIL'), password: env('STAFF_PASSWORD', 'CHAOS_STAFF_PASSWORD'), name: 'QA Staff Login', role: 'Line Cook', isAdmin: false, isOwner: false, permissions: { help: true } },
  ];
}

async function signInAccount(page, config, account) {
  if (!account.email || !account.password) throw new Error(`Missing ${account.key} credentials.`);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
  const signed = await pageFetchJson(page, {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: account.email, password: account.password, returnSecureToken: true },
  });
  if (!signed.idToken || !signed.localId) throw new Error(`Firebase Auth did not return an ID token and UID for ${account.key}.`);
  return { ...account, email: String(account.email).trim().toLowerCase(), uid: signed.localId, idToken: signed.idToken };
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
    report.firebaseProjectId = config.projectId;
    report.seedMethod = 'browser-origin-rest';
    const { chromium } = require('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await context.newPage();
    await page.goto(appUrl('today'), { waitUntil: 'domcontentloaded', timeout: 60000 });

    const roleAccounts = [];
    for (const role of getRoleCredentials()) roleAccounts.push(await signInAccount(page, config, role));
    const writer = roleAccounts.find(account => account.key === 'systemAdmin') || roleAccounts.find(account => account.key === 'owner');
    if (!writer) throw new Error('No System Administrator test account was available for QA setup.');
    report.signedInAs = writer.email;
    report.signedInUid = writer.uid;
    report.roleAccounts = roleAccounts.map(({ key, email, uid, role }) => ({ key, email, uid, role }));
    const rest = firestoreRest(config, writer.idToken);

    let restaurantId = env('CHAOS_QA_RESTAURANT_ID');
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
      restaurantId = restRef.id;
      report.createdRestaurant = true;
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
        isSuperAdmin: account.isSuperAdmin === true,
        accountOwner: account.isOwner === true,
        workspaceOwner: account.isOwner === true,
        permissions: account.permissions || {},
        isActive: true,
        qaOwned: true,
        qaRunId: RUN_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ref = await patchDoc(page, rest, 'workspaceMembers', `${account.uid}_${restaurantId}`, membership);
      report.memberships.push({ key: account.key, uid: account.uid, email: account.email, id: ref.id, role: account.role });
    }
    const profile = buildFakeRestaurantProfile({ restaurantId, runId: RUN_ID, anchorDate: new Date() });
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

    report.ok = true;
    report.profile = { restaurantId, restaurantName: QA_RESTAURANT_NAME, users: created.users, createdCounts: Object.fromEntries(Object.entries(created).map(([k, v]) => [k, v.length])), ids, expectations: profile.expectations, scheduleTruth: summarizeSchedule(profile.collections.shifts) };
    await writeReport(report);
    console.log(`Seeded fake QA restaurant data for ${restaurantId}. Report: ${REPORT_PATH}`);
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

main();

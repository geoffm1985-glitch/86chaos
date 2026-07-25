#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadEnv, env, boolEnv } = require('./env-loader.cjs');
const { initFirebase, signInOwner, findCurrentRestaurantId } = require('./firebase-client.cjs');
const { buildFakeRestaurantProfile } = require('../../tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
const { summarizeSchedule } = require('../../tests/86chaos-full-audit/utils/math-oracle.cjs');

loadEnv(process.cwd());

const OUT_DIR = path.join(process.cwd(), 'test-results');
fs.mkdirSync(OUT_DIR, { recursive: true });
const RUN_ID = env('CHAOS_FULL_AUDIT_RUN_ID') || new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_PATH = path.join(OUT_DIR, '86chaos-full-audit-seed-report.json');
const ALLOW_MUTATION = boolEnv('CHAOS_ALLOW_MUTATION');

const COLLECTION_ORDER = [
  'restaurantAdminAlerts', 'eventReminders', 'personalReminders', 'scheduleCoverageTargets', 'scheduleTemplates', 'availabilityRecords', 'shiftSwaps', 'timePunches', 'timeOffRequests', 'shifts', 'events', 'financialExpenses', 'sales', 'maintenanceLogs', 'pmSchedules', 'tasks', 'prepItems', 'menuDependencies', 'recipes', 'inventoryItems', 'vendors', 'users'
];

async function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function withIds(profile, createdIds) {
  const userIdsByKey = Object.fromEntries((createdIds.users || []).map(x => [x.idKey, x.id]));
  const vendorIdsByKey = Object.fromEntries((createdIds.vendors || []).map(x => [x.key, x.id]));
  for (const shift of profile.collections.shifts) {
    if (shift.employeeKey && userIdsByKey[shift.employeeKey]) shift.employeeId = userIdsByKey[shift.employeeKey];
    delete shift.employeeKey;
  }
  for (const item of profile.collections.inventoryItems) {
    if (item.vendorKey && vendorIdsByKey[item.vendorKey]) item.supplierId = vendorIdsByKey[item.vendorKey];
    delete item.vendorKey;
  }
  for (const req of profile.collections.timeOffRequests) {
    if (req.userKey && userIdsByKey[req.userKey]) req.userId = userIdsByKey[req.userKey];
    delete req.userKey;
  }
  for (const rec of profile.collections.availabilityRecords) {
    if (rec.userKey && userIdsByKey[rec.userKey]) rec.userId = userIdsByKey[rec.userKey];
    delete rec.userKey;
  }
  for (const punch of profile.collections.timePunches) {
    if (punch.employeeKey && userIdsByKey[punch.employeeKey]) punch.employeeId = userIdsByKey[punch.employeeKey];
    delete punch.employeeKey;
  }
  return { userIdsByKey, vendorIdsByKey };
}

async function deleteQaOwned(firebase, restaurantId) {
  const { collection, query, where, getDocs, deleteDoc, doc } = firebase.firestore;
  const deleted = [];
  for (const colName of COLLECTION_ORDER) {
    let snap;
    try {
      snap = await getDocs(query(collection(firebase.db, colName), where('qaOwned', '==', true)));
    } catch (error) {
      deleted.push({ collection: colName, error: error.message });
      continue;
    }
    const docs = snap.docs.filter(d => (d.data() || {}).restaurantId === restaurantId);
    for (const d of docs) {
      await deleteDoc(doc(firebase.db, colName, d.id));
    }
    deleted.push({ collection: colName, count: docs.length });
  }
  return deleted;
}

async function addCollection(firebase, colName, records, idKeys = []) {
  const { collection, addDoc } = firebase.firestore;
  const created = [];
  for (const record of records) {
    const payload = { ...record };
    const meta = {};
    for (const key of idKeys) {
      if (payload[key] !== undefined) { meta[key] = payload[key]; delete payload[key]; }
    }
    const ref = await addDoc(collection(firebase.db, colName), payload);
    created.push({ collection: colName, id: ref.id, ...meta, name: payload.name || payload.title || payload.employeeName || '' });
  }
  return created;
}

async function main() {
  const report = { runId: RUN_ID, generatedAt: new Date().toISOString(), ok: false, mode: 'seed', warnings: [] };
  try {
    if (!ALLOW_MUTATION) throw new Error('CHAOS_ALLOW_MUTATION=true is required before seeding fake restaurant data.');
    const firebase = await initFirebase();
    report.firebaseProjectId = firebase.config.projectId;
    const signed = await signInOwner(firebase);
    report.signedInAs = signed.email;
    report.signedInUid = signed.user.uid;

    let restaurantId = env('CHAOS_QA_RESTAURANT_ID');
    if (!restaurantId && boolEnv('CHAOS_QA_SEED_CURRENT_RESTAURANT')) {
      restaurantId = await findCurrentRestaurantId(firebase, signed.email, signed.user.uid);
      report.warnings.push('Seeded into the signed-in account current restaurant because CHAOS_QA_SEED_CURRENT_RESTAURANT=true. Use a disposable QA workspace whenever possible.');
    }
    if (!restaurantId && boolEnv('CHAOS_QA_CREATE_RESTAURANT')) {
      const { collection, addDoc, setDoc, doc } = firebase.firestore;
      const restRef = await addDoc(collection(firebase.db, 'restaurants'), {
        name: '86 Chaos Full Audit QA Restaurant', ownerEmail: String(signed.email).toLowerCase(), ownerUid: signed.user.uid, isActive: true, subscriptionStatus: 'beta', planId: 'owner_pro', qaOwned: true, qaRunId: RUN_ID, createdAt: new Date().toISOString(), systemSettings: { overtime: 40, enableTargets: true, targetLaborPct: 23 }, features: { schedule: true, events: true, ops: true, messages: true, prep: true, recipes: true, inventory: true, sales: true, team: true, maintenance: true, timesheets: true, labor: true }
      });
      restaurantId = restRef.id;
      await setDoc(doc(firebase.db, 'workspaceMembers', `${signed.user.uid}_${restaurantId}`), {
        userId: signed.user.uid, uid: signed.user.uid, email: String(signed.email).toLowerCase(), name: 'QA Owner Login', role: 'Owner', restaurantId, restaurantName: '86 Chaos Full Audit QA Restaurant', isAdmin: true, isOwner: true, accountOwner: true, workspaceOwner: true, permissions: { schedule: true, inventory: true, financials: true, team: true, events: true, settings: true }, isActive: true, qaOwned: true, qaRunId: RUN_ID, createdAt: new Date().toISOString()
      }, { merge: true });
      report.createdRestaurant = true;
    }
    if (!restaurantId) {
      throw new Error('No QA restaurant target found. Set CHAOS_QA_RESTAURANT_ID, or set CHAOS_QA_CREATE_RESTAURANT=true, or set CHAOS_QA_SEED_CURRENT_RESTAURANT=true for a disposable workspace only.');
    }
    report.restaurantId = restaurantId;

    const deleted = await deleteQaOwned(firebase, restaurantId);
    report.deletedOldQaData = deleted;
    const profile = buildFakeRestaurantProfile({ restaurantId, runId: RUN_ID, anchorDate: new Date() });
    const created = {};
    created.users = await addCollection(firebase, 'users', profile.collections.users, ['idKey']);
    created.vendors = await addCollection(firebase, 'vendors', profile.collections.vendors, ['key']);
    const ids = withIds(profile, created);
    for (const colName of ['inventoryItems', 'recipes', 'menuDependencies', 'shifts', 'timeOffRequests', 'events', 'timePunches', 'prepItems', 'tasks', 'maintenanceLogs', 'pmSchedules', 'sales', 'financialExpenses', 'restaurantAdminAlerts', 'personalReminders', 'availabilityRecords', 'scheduleTemplates', 'scheduleCoverageTargets']) {
      created[colName] = await addCollection(firebase, colName, profile.collections[colName] || []);
    }
    const expectedSummary = summarizeSchedule(profile.collections.shifts);
    report.ok = true;
    report.profile = {
      restaurantId,
      users: created.users,
      createdCounts: Object.fromEntries(Object.entries(created).map(([k, v]) => [k, v.length])),
      ids,
      expectations: profile.expectations,
      scheduleTruth: expectedSummary,
    };
    await writeReport(report);
    console.log(`Seeded fake QA restaurant data for ${restaurantId}. Report: ${REPORT_PATH}`);
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
    await writeReport(report);
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

main();

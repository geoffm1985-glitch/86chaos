#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadEnv, env, boolEnv } = require('./env-loader.cjs');
const { initFirebase, signInOwner } = require('./firebase-client.cjs');
loadEnv(process.cwd());
const OUT_DIR = path.join(process.cwd(), 'test-results');
fs.mkdirSync(OUT_DIR, { recursive: true });
const REPORT_PATH = path.join(OUT_DIR, '86chaos-full-audit-cleanup-report.json');
const COLLECTIONS = ['restaurantAdminAlerts', 'eventReminders', 'personalReminders', 'scheduleCoverageTargets', 'scheduleTemplates', 'availabilityRecords', 'shiftSwaps', 'timePunches', 'timeOffRequests', 'shifts', 'events', 'financialExpenses', 'sales', 'maintenanceLogs', 'pmSchedules', 'tasks', 'prepItems', 'menuDependencies', 'recipes', 'inventoryItems', 'vendors', 'users'];
async function main() {
  const report = { generatedAt: new Date().toISOString(), ok: false, deleted: [] };
  try {
    if (!boolEnv('CHAOS_ALLOW_MUTATION')) throw new Error('CHAOS_ALLOW_MUTATION=true required for cleanup.');
    const firebase = await initFirebase();
    await signInOwner(firebase);
    const seedPath = path.join(OUT_DIR, '86chaos-full-audit-seed-report.json');
    const restaurantId = env('CHAOS_QA_RESTAURANT_ID') || (fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8'))?.restaurantId : '');
    if (!restaurantId) throw new Error('No restaurantId found for cleanup.');
    const { collection, query, where, getDocs, deleteDoc, doc } = firebase.firestore;
    for (const colName of COLLECTIONS) {
      let count = 0;
      const snap = await getDocs(query(collection(firebase.db, colName), where('qaOwned', '==', true)));
      for (const d of snap.docs) {
        const data = d.data() || {};
        if (data.restaurantId !== restaurantId) continue;
        await deleteDoc(doc(firebase.db, colName, d.id));
        count += 1;
      }
      report.deleted.push({ collection: colName, count });
    }
    report.ok = true;
    report.restaurantId = restaurantId;
  } catch (error) {
    report.error = error.stack || error.message;
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`Cleanup report: ${REPORT_PATH}`);
  }
}
main();

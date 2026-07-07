const { initAdmin, readBody, authorize, serializeIssue, writeAudit, clean } = require('./_chaos-admin');

const COLLECTIONS = ['users','restaurants','shifts','timePunches','inventoryItems','vendors','orders','invoices','recipes','prepItems','tasks','tempLogs','wasteLogs','maintenanceLogs','pmSchedules','events','roles','lineCheckItems','menuDependencies'];
const DATE_FIELDS = ['date','createdAt','updatedAt','timestamp','clockInTime','clockOutTime','reportedAt','lastUpdated'];
const PRIVATE_KEYS = ['password','temporaryPassword','ssn','address','phone','email','wage','hourlyRate','payRate','fcmToken'];
function badDate(v) { if (!v || typeof v !== 'string') return false; const maybe = /\d{4}-\d{2}-\d{2}/.test(v) || v.includes('T'); return maybe && Number.isNaN(new Date(v).getTime()); }
function hasPrivateDemoField(data) { return PRIVATE_KEYS.filter(k => Object.prototype.hasOwnProperty.call(data || {}, k) && data[k]); }
function isTenantCollection(c) { return c !== 'restaurants' && c !== 'users'; }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  const started = Date.now();
  try {
    const app = initAdmin();
    const body = await readBody(req);
    const targetRestaurantId = clean(body.restaurantId || '');
    const repair = body.repair === true;
    const auth = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    if (!targetRestaurantId && !auth.isSuperAdmin) return res.status(403).json({ ok: false, error: 'Choose a workspace before running schema repair.' });
    const db = app.firestore();
    const issues = [];
    const repairs = [];
    let scannedDocuments = 0;
    for (const collectionName of COLLECTIONS) {
      let query = db.collection(collectionName).limit(900);
      if (targetRestaurantId && collectionName !== 'restaurants') {
        if (collectionName === 'users') query = db.collection(collectionName).where('restaurantId','==',targetRestaurantId).limit(900);
        else if (isTenantCollection(collectionName)) query = db.collection(collectionName).where('restaurantId','==',targetRestaurantId).limit(900);
      }
      let docsForScan;
      if (collectionName === 'restaurants' && targetRestaurantId) {
        const one = await db.collection(collectionName).doc(targetRestaurantId).get();
        docsForScan = one.exists ? [one] : [];
      } else {
        const snap = await query.get().catch(async () => db.collection(collectionName).limit(200).get());
        docsForScan = snap.docs;
      }
      for (const docSnap of docsForScan) {
        const id = docSnap.id;
        const data = docSnap.data() || {};
        scannedDocuments += 1;
        if (collectionName === 'restaurants') {
          const ss = data.systemSettings || {};
          const branding = ss.branding || data.branding || {};
          if ((branding.appName && branding.appName !== '86 Chaos') || (ss.appName && ss.appName !== '86 Chaos')) issues.push(serializeIssue('warning', collectionName, id, '86 Chaos app name is not locked in branding settings.', true, 'systemSettings.branding.appName'));
          if (!Object.prototype.hasOwnProperty.call(ss, 'tips')) issues.push(serializeIssue('warning', collectionName, id, 'Mandatory tip declaration is missing from workspace settings. Legacy docs default to enabled at runtime, but repair should stamp it explicitly.', true, 'systemSettings.tips'));
          if (data.demoMode === true || data.isDemo === true) {
            const priv = hasPrivateDemoField(data);
            if (priv.length) issues.push(serializeIssue('high', collectionName, id, `Demo workspace contains private top-level fields: ${priv.join(', ')}`, false, 'demoPrivacy'));
          }
        }
        if (isTenantCollection(collectionName) && !data.restaurantId) issues.push(serializeIssue('high', collectionName, id, 'Missing restaurantId tenant key.', !!targetRestaurantId, 'restaurantId'));
        if (isTenantCollection(collectionName) && targetRestaurantId && data.restaurantId && data.restaurantId !== targetRestaurantId) issues.push(serializeIssue('high', collectionName, id, `Restaurant mismatch: ${data.restaurantId}`, false, 'restaurantId'));
        DATE_FIELDS.forEach(f => { if (badDate(data[f])) issues.push(serializeIssue('warning', collectionName, id, `Invalid date value in ${f}.`, false, f)); });
        if (collectionName === 'shifts') {
          if (!data.employeeId) issues.push(serializeIssue('warning', collectionName, id, 'Shift has no employeeId.', false, 'employeeId'));
          if (!data.date) issues.push(serializeIssue('high', collectionName, id, 'Shift has no date.', false, 'date'));
          if (!data.startTime || !data.endTime) issues.push(serializeIssue('warning', collectionName, id, 'Shift is missing start or end time.', false, 'time'));
        }
        if (collectionName === 'timePunches' && data.status === 'clocked_in' && data.date) {
          const age = (Date.now() - new Date(`${data.date}T12:00:00`).getTime()) / 86400000;
          if (age > 2) issues.push(serializeIssue('warning', collectionName, id, 'Clock-in appears stale and may need manager review.', false, 'status'));
        }
        if (collectionName === 'inventoryItems') {
          if (Number(data.currentStock || 0) < 0) issues.push(serializeIssue('warning', collectionName, id, 'Inventory currentStock is below zero.', true, 'currentStock'));
          if (Number(data.parLevel || 0) < 0) issues.push(serializeIssue('warning', collectionName, id, 'Inventory parLevel is below zero.', true, 'parLevel'));
        }
      }
    }
    if (repair) {
      const batch = db.batch();
      let batchCount = 0;
      const commit = async () => { if (batchCount) { await batch.commit(); batchCount = 0; } };
      for (const issue of issues.filter(i => i.repairable)) {
        if (issue.collection === 'restaurants' && issue.field === 'systemSettings.branding.appName') {
          batch.set(db.collection('restaurants').doc(issue.id), { systemSettings: { branding: { appName: '86 Chaos' }, appName: '86 Chaos' }, updatedAt: new Date().toISOString() }, { merge: true });
          repairs.push(`Locked 86 Chaos branding for ${issue.id}`); batchCount += 1;
        }
        if (issue.collection === 'restaurants' && issue.field === 'systemSettings.tips') {
          batch.set(db.collection('restaurants').doc(issue.id), { systemSettings: { tips: true }, updatedAt: new Date().toISOString() }, { merge: true });
          repairs.push(`Stamped mandatory tip declaration default for ${issue.id}`); batchCount += 1;
        }
        if (issue.field === 'restaurantId' && targetRestaurantId && isTenantCollection(issue.collection)) {
          batch.set(db.collection(issue.collection).doc(issue.id), { restaurantId: targetRestaurantId, schemaRepairedAt: new Date().toISOString(), schemaRepairSource: 'v14-schema-doctor' }, { merge: true });
          repairs.push(`Stamped restaurantId on ${issue.collection}/${issue.id}`); batchCount += 1;
        }
        if (issue.collection === 'inventoryItems' && (issue.field === 'currentStock' || issue.field === 'parLevel')) {
          batch.set(db.collection('inventoryItems').doc(issue.id), { [issue.field]: 0, schemaRepairedAt: new Date().toISOString() }, { merge: true });
          repairs.push(`Clamped ${issue.field} to zero for ${issue.id}`); batchCount += 1;
        }
        if (batchCount >= 350) await commit();
      }
      await commit();
    }
    const summary = { ok: issues.filter(i => i.severity === 'high').length === 0, repair, scannedDocuments, issueCount: issues.length, high: issues.filter(i => i.severity === 'high').length, warnings: issues.filter(i => i.severity === 'warning').length, repairable: issues.filter(i => i.repairable).length, repairs, durationMs: Date.now() - started, generatedAt: new Date().toISOString(), restaurantId: targetRestaurantId || 'all', issues: issues.slice(0, 500) };
    await writeAudit(db, auth, repair ? 'SCHEMA_DOCTOR_REPAIR' : 'SCHEMA_DOCTOR_DRY_RUN', targetRestaurantId || 'all', `Scanned ${scannedDocuments}; issues ${issues.length}; repairs ${repairs.length}.`, targetRestaurantId || auth.restaurantId);
    return res.status(200).json(summary);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, durationMs: Date.now() - started });
  }
};

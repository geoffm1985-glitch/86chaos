const {
  admin,
  getAdminAppForRequest,
  authorize,
  readBody,
  requireAppCheckIfEnforced,
  writeAudit,
  masterEmails
} = require('./_chaos-admin');

const CONFIRMATION = 'DELETE QA AUDIT RESTAURANTS';
const APPROVED_QA_SOURCES = new Set(['86chaos-full-audit', '86chaos-full-audit-seed', '86chaos-full-audit-qa']);
const PAGE_SIZE = 450;

const normalize = (value = '') => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
const clean = (value = '') => String(value || '').trim();
const unique = (values = []) => [...new Set(values.filter(Boolean))];
const safeIso = () => new Date().toISOString();
const toPlainTimestamp = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value || '');
};

const COLLECTION_CLEANUP_RULES = {
  accountDeletionRequests: ['restaurantId', 'workspaceId', 'targetRestaurantId'],
  aiRequestLocks: ['restaurantId', 'workspaceId'],
  aiUsage: ['restaurantId', 'workspaceId'],
  apiRateLimits: ['restaurantId', 'workspaceId'],
  auditLogs: ['restaurantId', 'workspaceId'],
  availabilityRecords: ['restaurantId', 'workspaceId'],
  backOfficeRecords: ['restaurantId', 'workspaceId'],
  crashReports: ['restaurantId', 'workspaceId'],
  eventReminders: ['restaurantId', 'workspaceId'],
  events: ['restaurantId', 'workspaceId'],
  financialExpenses: ['restaurantId', 'workspaceId'],
  inventoryItems: ['restaurantId', 'workspaceId'],
  invoices: ['restaurantId', 'workspaceId'],
  lineCheckItems: ['restaurantId', 'workspaceId'],
  livePresence: ['restaurantId', 'workspaceId'],
  maintenanceLogs: ['restaurantId', 'workspaceId'],
  menuDependencies: ['restaurantId', 'workspaceId'],
  menuIntelligenceScans: ['restaurantId', 'workspaceId'],
  opsIntelligenceReports: ['restaurantId', 'workspaceId'],
  personalReminders: ['restaurantId', 'workspaceId'],
  pmSchedules: ['restaurantId', 'workspaceId'],
  prepCategories: ['restaurantId', 'workspaceId'],
  prepItems: ['restaurantId', 'workspaceId'],
  pythonAutomationConfigs: ['restaurantId', 'workspaceId'],
  pythonAutomationRuns: ['restaurantId', 'workspaceId'],
  recipes: ['restaurantId', 'workspaceId'],
  restaurantAdminAlerts: ['restaurantId', 'workspaceId'],
  restoreDrills: ['restaurantId', 'workspaceId'],
  roles: ['restaurantId', 'workspaceId'],
  sales: ['restaurantId', 'workspaceId'],
  scheduleCoverageTargets: ['restaurantId', 'workspaceId'],
  scheduleRestoreRuns: ['restaurantId', 'workspaceId'],
  scheduleRestoreSeeds: ['restaurantId', 'workspaceId'],
  scheduleTemplates: ['restaurantId', 'workspaceId'],
  securityAlerts: ['restaurantId', 'workspaceId'],
  shiftSwaps: ['restaurantId', 'workspaceId'],
  shifts: ['restaurantId', 'workspaceId'],
  tasks: ['restaurantId', 'workspaceId'],
  timeOffRequests: ['restaurantId', 'workspaceId'],
  timePunches: ['restaurantId', 'workspaceId'],
  trainingManuals: ['restaurantId', 'workspaceId'],
  userSecurityAlerts: ['restaurantId', 'workspaceId'],
  vendors: ['restaurantId', 'workspaceId'],
  wasteLogs: ['restaurantId', 'workspaceId'],
  workspaceMembers: ['restaurantId', 'workspaceId']
};

const STORAGE_PREFIXES = (restaurantId) => [
  `${restaurantId}/profilePhotos/`,
  `${restaurantId}/brandAssets/`,
  `${restaurantId}/messageAttachments/`,
  `${restaurantId}/maintenancePhotos/`,
  `${restaurantId}/invoices/`,
  `${restaurantId}/menuUploads/`,
  `${restaurantId}/hrTrainingManuals/`,
  `messages/${restaurantId}/`,
  `events/${restaurantId}/`
];

function isVerifiedFullAuditQaRestaurant(restaurant = {}) {
  const qaOwned = restaurant.qaOwned === true;
  const source = normalize(restaurant.source || restaurant.createdBy || restaurant.createdByTool || restaurant.qaSource || '');
  const name = normalize(restaurant.name || restaurant.restaurantName || restaurant.displayName || '');
  if (!qaOwned) return { ok: false, matchedBy: '' };
  if (APPROVED_QA_SOURCES.has(source)) return { ok: true, matchedBy: 'qaOwned+source' };
  if (name === '86 chaos full audit qa restaurant') return { ok: true, matchedBy: 'qaOwned+exact-name' };
  if (name.startsWith('86 chaos full audit qa restaurant ')) return { ok: true, matchedBy: 'qaOwned+name-prefix' };
  return { ok: false, matchedBy: '' };
}

function summarizeCandidate(id, data, matchedBy) {
  return {
    id,
    name: clean(data.name || data.restaurantName || id),
    qaOwned: data.qaOwned === true,
    source: clean(data.source || data.createdBy || data.createdByTool || data.qaSource || ''),
    qaRunId: clean(data.qaRunId || ''),
    createdAt: toPlainTimestamp(data.createdAt),
    deletedAt: toPlainTimestamp(data.deletedAt),
    matchedBy
  };
}

async function loadVerifiedCandidates(db) {
  const candidates = [];
  const restaurants = db.collection('restaurants');
  let query = restaurants.where('qaOwned', '==', true).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
  let last = null;
  for (;;) {
    const snap = await query.get();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const verdict = isVerifiedFullAuditQaRestaurant(data);
      if (verdict.ok) candidates.push(summarizeCandidate(docSnap.id, data, verdict.matchedBy));
    }
    if (snap.size < PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
    query = restaurants.where('qaOwned', '==', true).orderBy(admin.firestore.FieldPath.documentId()).startAfter(last).limit(PAGE_SIZE);
  }
  return candidates;
}

async function queryAllByField(db, collectionName, field, value, op = '==') {
  const docs = [];
  let last = null;
  for (;;) {
    let q = db.collection(collectionName).where(field, op, value).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    docs.push(...snap.docs);
    if (snap.size < PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return docs;
}

async function deleteQueryResults(db, bulkWriter, collectionName, field, restaurantId, seen, row, totals) {
  let last = null;
  for (;;) {
    let q = db.collection(collectionName).where(field, '==', restaurantId).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    for (const docSnap of snap.docs) {
      const key = `${collectionName}/${docSnap.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ref = docSnap.ref;
      const writePromise = bulkWriter.delete(ref).then(() => {
        row.collections[collectionName] = (row.collections[collectionName] || 0) + 1;
        totals.documentsDeleted += 1;
        totals.byCollection[collectionName] = (totals.byCollection[collectionName] || 0) + 1;
      }).catch((err) => {
        row.errors.push(`${collectionName}/${docSnap.id}: ${err?.message || err}`);
      });
      row.writePromises.push(writePromise);
    }
    if (snap.size < PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
}

function userQaOwned(data = {}) {
  const source = normalize(data.source || data.createdBy || data.createdByTool || data.qaSource || '');
  const email = normalize(data.email || data.userEmail || '');
  const controlledQaEmail = email.endsWith('@86chaos-full-audit.local') || email.includes('+86chaos-full-audit');
  return data.qaOwned === true || APPROVED_QA_SOURCES.has(source) || (controlledQaEmail && (data.qaSeeded === true || APPROVED_QA_SOURCES.has(source)));
}

function hasNonQaWorkspace(data = {}, qaRestaurantId = '') {
  const workspaceIds = Array.isArray(data.workspaceIds) ? data.workspaceIds.filter(Boolean) : [];
  if (workspaceIds.some(id => id !== qaRestaurantId)) return true;
  const memberships = data.memberships && typeof data.memberships === 'object' ? data.memberships : {};
  if (Object.keys(memberships).some(id => id && id !== qaRestaurantId)) return true;
  const refs = [data.restaurantId, data.activeRestaurantId, data.defaultRestaurantId].filter(Boolean);
  return refs.some(id => id !== qaRestaurantId);
}

function hasProtectedClaims(claims = {}) {
  return Boolean(
    claims.superAdmin === true ||
    claims.isSuperAdmin === true ||
    claims.systemAdministrator === true ||
    claims.systemAdmin === true ||
    claims.masterAdmin === true ||
    claims.protectedInternalAdmin === true ||
    claims.role === 'super-admin' ||
    claims.role === 'system-admin' ||
    claims.role === 'master-admin'
  );
}

function protectedUser(data = {}, uid = '', ctx = {}, protectedEmails = new Set(), authRecord = null) {
  const email = normalize(data.email || data.userEmail || authRecord?.email || '');
  return Boolean(
    uid === ctx.uid ||
    data.isSuperAdmin === true ||
    data.systemAccess?.superAdmin === true ||
    data.superAdmin === true ||
    protectedEmails.has(email) ||
    hasProtectedClaims(authRecord?.customClaims || {})
  );
}

async function collectWorkspaceMembers(db, restaurantId) {
  const refs = new Map();
  for (const field of ['restaurantId', 'workspaceId']) {
    const docs = await queryAllByField(db, 'workspaceMembers', field, restaurantId);
    docs.forEach(d => refs.set(d.ref.path, d));
  }
  return [...refs.values()];
}

async function collectAffectedUsers(db, restaurantId, workspaceMemberDocs = []) {
  const refs = new Map();
  const addDocs = (docs) => docs.forEach(d => refs.set(d.id, d));
  addDocs(await queryAllByField(db, 'users', 'restaurantId', restaurantId));
  addDocs(await queryAllByField(db, 'users', 'activeRestaurantId', restaurantId));
  addDocs(await queryAllByField(db, 'users', 'defaultRestaurantId', restaurantId));
  addDocs(await queryAllByField(db, 'users', 'workspaceIds', restaurantId, 'array-contains'));
  for (const memberSnap of workspaceMemberDocs) {
    const member = memberSnap.data() || {};
    const uid = clean(member.userId || member.uid || member.memberId || member.userUid || '');
    if (!uid || refs.has(uid)) continue;
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.exists) refs.set(userSnap.id, userSnap);
  }
  return [...refs.values()];
}

async function cleanupUsersForRestaurant(app, db, bulkWriter, restaurantId, ctx, row, totals, workspaceMemberDocs = []) {
  const protectedEmails = new Set(masterEmails().map(normalize));
  const users = await collectAffectedUsers(db, restaurantId, workspaceMemberDocs);
  for (const userSnap of users) {
    const data = userSnap.data() || {};
    const uid = userSnap.id;
    let authRecord = null;
    try { authRecord = await app.auth().getUser(uid); } catch (err) { if (err?.code !== 'auth/user-not-found') throw err; }
    const nonQaWorkspace = hasNonQaWorkspace(data, restaurantId);
    const isProtected = protectedUser(data, uid, ctx, protectedEmails, authRecord);
    if (nonQaWorkspace || isProtected || !userQaOwned(data)) {
      const remainingWorkspaceIds = Array.isArray(data.workspaceIds) ? data.workspaceIds.filter(id => id && id !== restaurantId) : [];
      const remainingMemberships = { ...(data.memberships || {}) };
      delete remainingMemberships[restaurantId];
      const replacement = remainingWorkspaceIds[0] || Object.keys(remainingMemberships)[0] || '';
      const patch = { workspaceIds: remainingWorkspaceIds, memberships: remainingMemberships, updatedAt: safeIso(), qaCleanupLastUpdatedAt: safeIso() };
      if (data.restaurantId === restaurantId) patch.restaurantId = replacement || admin.firestore.FieldValue.delete();
      if (data.activeRestaurantId === restaurantId) patch.activeRestaurantId = replacement || admin.firestore.FieldValue.delete();
      if (data.defaultRestaurantId === restaurantId) patch.defaultRestaurantId = replacement || admin.firestore.FieldValue.delete();
      const promise = bulkWriter.set(userSnap.ref, patch, { merge: true }).then(() => {
        row.usersUpdated += 1;
        totals.usersUpdated += 1;
      }).catch((err) => row.errors.push(`users/${uid}: ${err?.message || err}`));
      row.writePromises.push(promise);
      continue;
    }

    const promise = bulkWriter.delete(userSnap.ref).then(() => {
      row.usersUpdated += 1;
      totals.usersUpdated += 1;
      row.authDeleteQueue.push(uid);
    }).catch((err) => row.errors.push(`users/${uid}: ${err?.message || err}`));
    row.writePromises.push(promise);
  }
}

async function deleteWorkspaceMembers(bulkWriter, workspaceMemberDocs = [], row, totals) {
  for (const memberSnap of workspaceMemberDocs) {
    const promise = bulkWriter.delete(memberSnap.ref).then(() => {
      row.collections.workspaceMembers = (row.collections.workspaceMembers || 0) + 1;
      totals.documentsDeleted += 1;
      totals.byCollection.workspaceMembers = (totals.byCollection.workspaceMembers || 0) + 1;
    }).catch((err) => row.errors.push(`${memberSnap.ref.path}: ${err?.message || err}`));
    row.writePromises.push(promise);
  }
}

async function cleanupStorageForRestaurant(app, restaurantId, row, totals) {
  let bucket;
  try {
    bucket = app.storage().bucket();
  } catch (err) {
    row.errors.push(`storage: ${err?.message || 'Storage bucket is unavailable.'}`);
    return;
  }
  for (const prefix of STORAGE_PREFIXES(restaurantId)) {
    let query = { prefix, autoPaginate: false, maxResults: PAGE_SIZE };
    for (;;) {
      const [files, , response] = await bucket.getFiles(query);
      for (const file of files) {
        try {
          await file.delete({ ignoreNotFound: true });
          row.storageObjectsDeleted += 1;
          totals.storageObjectsDeleted += 1;
        } catch (err) {
          row.errors.push(`storage/${file.name}: ${err?.message || err}`);
        }
      }
      const nextPageToken = response?.nextPageToken;
      if (!nextPageToken) break;
      query = { ...query, pageToken: nextPageToken };
    }
  }
}

async function executeCleanup(app, db, ctx, candidateIds = []) {
  const verified = await loadVerifiedCandidates(db);
  const verifiedById = new Map(verified.map(row => [row.id, row]));
  const approvedIds = unique(candidateIds.map(clean)).filter(id => verifiedById.has(id));
  const rejectedIds = unique(candidateIds.map(clean)).filter(id => id && !verifiedById.has(id));
  if (!approvedIds.length) {
    const err = new Error('No supplied candidate IDs still pass server-side QA validation.');
    err.status = 400;
    throw err;
  }

  const totals = { restaurantsDeleted: 0, documentsDeleted: 0, storageObjectsDeleted: 0, usersUpdated: 0, authUsersDeleted: 0, byCollection: {}, incompleteRestaurants: 0 };
  const restaurants = [];
  for (const restaurantId of approvedIds) {
    const candidate = verifiedById.get(restaurantId);
    const row = { id: restaurantId, name: candidate.name, matchedBy: candidate.matchedBy, collections: {}, storageObjectsDeleted: 0, usersUpdated: 0, authUsersDeleted: 0, deletedRestaurant: false, errors: [], writePromises: [], authDeleteQueue: [] };
    const seenDocs = new Set();
    const bulkWriter = db.bulkWriter();
    bulkWriter.onWriteError((error) => {
      row.errors.push(`${error.documentRef?.path || 'unknown'}: ${error.message}`);
      return false;
    });
    try {
      const workspaceMemberDocs = await collectWorkspaceMembers(db, restaurantId);
      await cleanupUsersForRestaurant(app, db, bulkWriter, restaurantId, ctx, row, totals, workspaceMemberDocs);
      await deleteWorkspaceMembers(bulkWriter, workspaceMemberDocs, row, totals);
      for (const [collectionName, fields] of Object.entries(COLLECTION_CLEANUP_RULES)) {
        if (collectionName === 'users' || collectionName === 'workspaceMembers') continue;
        for (const field of fields) {
          await deleteQueryResults(db, bulkWriter, collectionName, field, restaurantId, seenDocs, row, totals);
        }
      }
      await bulkWriter.close();
      await Promise.allSettled(row.writePromises);
      if (!row.errors.length) {
        for (const uid of row.authDeleteQueue) {
          try {
            await app.auth().deleteUser(uid);
            row.authUsersDeleted += 1;
            totals.authUsersDeleted += 1;
          } catch (err) {
            if (err?.code !== 'auth/user-not-found') row.errors.push(`auth/${uid}: ${err?.message || err}`);
          }
        }
      }
      if (!row.errors.length) await cleanupStorageForRestaurant(app, restaurantId, row, totals);
      if (!row.errors.length) {
        await db.collection('restaurants').doc(restaurantId).delete();
        row.deletedRestaurant = true;
        totals.restaurantsDeleted += 1;
      } else {
        totals.incompleteRestaurants += 1;
      }
    } catch (err) {
      row.errors.push(err?.message || String(err));
      totals.incompleteRestaurants += 1;
      try { await bulkWriter.close(); } catch (_) {}
    }
    delete row.writePromises;
    delete row.authDeleteQueue;
    restaurants.push(row);
  }
  return { totals, restaurants, rejectedIds };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  let app;
  let db;
  let ctx;
  try {
    app = getAdminAppForRequest(req, { requireCredentials: true });
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    ctx = await authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true });
    if (!ctx.ok) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error });
    if (!ctx.isSuperAdmin) return res.status(403).json({ ok: false, error: 'Super administrator access is required for Full Audit QA cleanup.' });
    app = ctx.app || app;
    db = ctx.db || app.firestore();

    const body = await readBody(req);
    const mode = body?.mode === 'execute' ? 'execute' : 'dry-run';
    if (mode === 'dry-run') {
      const candidates = await loadVerifiedCandidates(db);
      await writeAudit(db, ctx, 'FULL_AUDIT_QA_CLEANUP_DRY_RUN', 'restaurants', JSON.stringify({ candidateCount: candidates.length, candidateIds: candidates.map(c => c.id) }).slice(0, 900), 'system');
      return res.status(200).json({ ok: true, mode: 'dry-run', candidateCount: candidates.length, candidates });
    }

    if (body.confirmation !== CONFIRMATION) return res.status(400).json({ ok: false, error: `Type ${CONFIRMATION} to run this cleanup.` });
    if (!Array.isArray(body.candidateIds) || body.candidateIds.length === 0) return res.status(400).json({ ok: false, error: 'Execute mode requires exact candidateIds from a successful dry-run.' });
    const result = await executeCleanup(app, db, ctx, body.candidateIds);
    const errors = result.restaurants.flatMap(r => (r.errors || []).map(error => `${r.id}: ${error}`));
    await writeAudit(db, ctx, 'FULL_AUDIT_QA_CLEANUP_EXECUTE', 'restaurants', JSON.stringify({ candidateIds: body.candidateIds, restaurantsDeleted: result.totals.restaurantsDeleted, documentCountsByCollection: result.totals.byCollection, storageObjectsDeleted: result.totals.storageObjectsDeleted, usersUpdated: result.totals.usersUpdated, authUsersDeleted: result.totals.authUsersDeleted, incompleteRestaurants: result.totals.incompleteRestaurants, rejectedIds: result.rejectedIds, errors: errors.slice(0, 20) }).slice(0, 1800), 'system');
    return res.status(200).json({ ok: true, mode: 'execute', ...result.totals, restaurants: result.restaurants, rejectedIds: result.rejectedIds, errors });
  } catch (err) {
    const status = err?.status || err?.statusCode || 500;
    try { if (db && ctx) await writeAudit(db, ctx, 'FULL_AUDIT_QA_CLEANUP_ERROR', 'restaurants', String(err?.message || err).slice(0, 900), 'system'); } catch (_) {}
    return res.status(status).json({ ok: false, error: err?.message || 'Full Audit QA cleanup failed.' });
  }
};

module.exports.isVerifiedFullAuditQaRestaurant = isVerifiedFullAuditQaRestaurant;
module.exports.COLLECTION_CLEANUP_RULES = COLLECTION_CLEANUP_RULES;

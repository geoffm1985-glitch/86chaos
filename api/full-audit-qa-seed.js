const { admin, initAdmin, authorize, readBody, writeAudit, clean, norm, memberDocId } = require('./_chaos-admin');

const TESTING_PROJECT_ID = 'chaos-test-d1601';
const QA_PREFIX = '86 Chaos Release Gate QA ';
const MAX_DOCS = 900;
const PAGE_SIZE = 450;
const ALLOWED_COLLECTIONS = new Set([
  'users', 'vendors', 'inventoryItems', 'recipes', 'menuDependencies', 'shifts', 'timeOffRequests',
  'events', 'timePunches', 'prepItems', 'tasks', 'maintenanceLogs', 'pmSchedules', 'sales',
  'financialExpenses', 'restaurantAdminAlerts', 'personalReminders', 'availabilityRecords',
  'scheduleTemplates', 'scheduleCoverageTargets', 'workspaceMembers'
]);

function safeId(value = '', max = 240) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, max);
}
function docName(projectId, collection, id) {
  return `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
}
function isoNow() { return new Date().toISOString(); }
function isSafeQaEmail(email = '') {
  return norm(email).endsWith('@example.test');
}
function isSafeRunId(runId = '') {
  const value = String(runId || '').trim();
  return value.length >= 8 && value.length <= 80 && /^[A-Za-z0-9_.:-]+$/.test(value);
}
function isSafeQaWorkspaceName(name = '', runId = '') {
  return String(name || '') === `${QA_PREFIX}${runId}`;
}
function validateBase({ req, auth, body, projectId }) {
  const errors = [];
  const runId = clean(body.runId, '');
  const restaurantId = safeId(body.restaurantId || '', 180);
  const workspaceName = clean(body.workspaceName || body.restaurantName || '', '');
  const expectedProjectId = clean(body.expectedProjectId || TESTING_PROJECT_ID, '');
  const host = clean(req.headers['x-forwarded-host'] || req.headers.host || '', '').toLowerCase();
  if (!auth.isSuperAdmin) errors.push('System Administrator authority is required.');
  if (projectId !== TESTING_PROJECT_ID) errors.push(`QA seed route only runs against ${TESTING_PROJECT_ID}; current project is ${projectId || '(missing)'}.`);
  if (expectedProjectId !== TESTING_PROJECT_ID) errors.push(`expectedProjectId must be ${TESTING_PROJECT_ID}.`);
  if (/app\.86chaos\.com|(^|\.)86chaos\.com/i.test(host)) errors.push('QA seed route refused a production host.');
  if (!isSafeRunId(runId)) errors.push('runId is missing or unsafe.');
  if (!restaurantId) errors.push('restaurantId is missing.');
  if (workspaceName && !isSafeQaWorkspaceName(workspaceName, runId)) errors.push(`workspaceName must be exactly "${QA_PREFIX}${runId}".`);
  return { ok: errors.length === 0, errors, runId, restaurantId, workspaceName };
}
function validateRoleAccounts(accounts = [], restaurantId = '', runId = '') {
  const errors = [];
  const rows = Array.isArray(accounts) ? accounts : [];
  const required = new Set(['systemAdmin', 'owner', 'manager', 'staff']);
  const seenKeys = new Set();
  const seenEmails = new Set();
  const seenUids = new Set();
  for (const row of rows) {
    const key = clean(row.key || '', '');
    const email = norm(row.email || '');
    const uid = clean(row.uid || '', '');
    if (!required.has(key)) errors.push(`Unexpected QA role account key ${key || '(missing)'}.`);
    seenKeys.add(key);
    if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) errors.push(`${key || 'role'} uid is missing or unsafe.`);
    if (!isSafeQaEmail(email)) errors.push(`${key || 'role'} email must be a dedicated @example.test QA account.`);
    if (seenEmails.has(email)) errors.push(`Duplicate QA role email ${email}.`);
    if (seenUids.has(uid)) errors.push(`Duplicate QA role uid ${uid}.`);
    seenEmails.add(email);
    seenUids.add(uid);
  }
  for (const key of required) if (!seenKeys.has(key)) errors.push(`Missing ${key} QA role account.`);
  return { ok: errors.length === 0, errors };
}
function validateRestaurantPayload(data = {}, restaurantId = '', runId = '', workspaceName = '') {
  const errors = [];
  if (!data || typeof data !== 'object') errors.push('restaurant payload is missing.');
  if (data.qaOwned !== true) errors.push('restaurant.qaOwned must be true.');
  if (data.qaRunId !== runId) errors.push('restaurant.qaRunId must match runId.');
  if (data.createdBy !== '86chaos-full-audit') errors.push('restaurant.createdBy must be 86chaos-full-audit.');
  const name = clean(data.name || data.restaurantName || data.qaCleanupName || '', '');
  if (workspaceName && name !== workspaceName) errors.push('restaurant name must match the current QA workspace name.');
  if (data.restaurantId && data.restaurantId !== restaurantId) errors.push('restaurant.restaurantId must match the document id.');
  return errors;
}
function validateDocuments(documents = [], restaurantId = '', runId = '') {
  const errors = [];
  const rows = Array.isArray(documents) ? documents : [];
  if (rows.length > MAX_DOCS) errors.push(`Too many QA documents requested (${rows.length}); max ${MAX_DOCS}.`);
  for (const [index, row] of rows.entries()) {
    const collection = clean(row.collection || '', '');
    const id = safeId(row.id || '', 240);
    const data = row.data && typeof row.data === 'object' ? row.data : null;
    if (!ALLOWED_COLLECTIONS.has(collection)) errors.push(`Document ${index} uses unsupported collection ${collection || '(missing)'}.`);
    if (!id || id !== String(row.id || '')) errors.push(`Document ${index} has an unsafe id.`);
    if (!data) errors.push(`Document ${index} is missing data.`);
    if (data && data.restaurantId !== restaurantId) errors.push(`${collection}/${id} restaurantId does not match current QA restaurant.`);
    if (data && data.qaOwned !== true) errors.push(`${collection}/${id} qaOwned must be true.`);
    if (data && data.qaRunId !== runId) errors.push(`${collection}/${id} qaRunId must match runId.`);
    if (data && data.createdBy !== '86chaos-full-audit') errors.push(`${collection}/${id} createdBy must be 86chaos-full-audit.`);
  }
  return { ok: errors.length === 0, errors, rows };
}
function roleMembership(row = {}, restaurantId = '', workspaceName = '', runId = '') {
  return {
    userId: row.uid,
    uid: row.uid,
    authUid: row.uid,
    email: norm(row.email),
    name: row.name || row.email || row.key,
    role: row.role || row.restaurantRole || (row.key === 'owner' ? 'Owner' : row.key === 'manager' ? 'Manager' : row.key === 'staff' ? 'Line Cook' : 'Kitchen'),
    restaurantId,
    restaurantName: workspaceName,
    isAdmin: row.isAdmin === true,
    isOwner: row.isOwner === true,
    accountOwner: row.accountOwner === true,
    workspaceOwner: row.workspaceOwner === true,
    isSuperAdmin: false,
    systemAdministratorVerifiedByWhoami: row.key === 'systemAdmin',
    permissions: row.permissions || {},
    isActive: true,
    qaOwned: true,
    qaRunId: runId,
    createdBy: '86chaos-full-audit',
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}
async function commitInChunks(db, writes = []) {
  let committed = 0;
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + 400);
    for (const write of chunk) {
      if (write.type === 'set') batch.set(write.ref, write.data, write.options || {});
      if (write.type === 'delete') batch.delete(write.ref);
      if (write.type === 'update') batch.update(write.ref, write.data);
    }
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}
async function queryQaDocs(db, collection, restaurantId, runId) {
  const docs = [];
  let query = db.collection(collection).where('restaurantId', '==', restaurantId).where('qaRunId', '==', runId).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
  for (;;) {
    const snap = await query.get();
    docs.push(...snap.docs);
    if (snap.size < PAGE_SIZE) break;
    query = db.collection(collection).where('restaurantId', '==', restaurantId).where('qaRunId', '==', runId).orderBy(admin.firestore.FieldPath.documentId()).startAfter(snap.docs[snap.docs.length - 1]).limit(PAGE_SIZE);
  }
  return docs;
}
async function verifyDocs(db, projectId, documents, restaurantId, runId) {
  const verifiedCounts = {};
  const missing = [];
  const bad = [];
  for (const row of documents) {
    const snap = await db.collection(row.collection).doc(row.id).get();
    if (!snap.exists) { missing.push({ collection: row.collection, id: row.id, docName: docName(projectId, row.collection, row.id) }); continue; }
    const data = snap.data() || {};
    const problems = [];
    if (data.restaurantId !== restaurantId) problems.push(`restaurantId=${data.restaurantId || '(missing)'}`);
    if (data.qaOwned !== true) problems.push(`qaOwned=${String(data.qaOwned)}`);
    if (data.qaRunId !== runId) problems.push(`qaRunId=${data.qaRunId || '(missing)'}`);
    if (problems.length) bad.push({ collection: row.collection, id: row.id, problems });
    verifiedCounts[row.collection] = (verifiedCounts[row.collection] || 0) + 1;
  }
  return { ok: missing.length === 0 && bad.length === 0, verifiedCounts, missing, bad };
}

function documentVaultPrefix(restaurantId = '') {
  return `restaurants/${safeId(restaurantId, 180)}/back-office/document-vault/`;
}

function boolMeta(value) {
  return value === true || String(value || '').toLowerCase() === 'true';
}

function storageObjectSafetyErrors(metadata = {}, restaurantId = '', runId = '') {
  const name = String(metadata.name || '').trim();
  const prefix = documentVaultPrefix(restaurantId);
  const meta = metadata.metadata && typeof metadata.metadata === 'object' ? metadata.metadata : {};
  const errors = [];
  if (!name.startsWith(prefix)) errors.push('object path is outside the exact current-run Document Vault prefix');
  if (meta.restaurantId && meta.restaurantId !== restaurantId) errors.push('metadata.restaurantId does not match the current QA restaurant');
  if (meta.qaRunId && meta.qaRunId !== runId) errors.push('metadata.qaRunId belongs to another QA run');
  if (Object.prototype.hasOwnProperty.call(meta, 'qaOwned') && !boolMeta(meta.qaOwned)) errors.push('metadata.qaOwned is not true');
  return errors;
}

async function listDocumentVaultFiles(bucket, restaurantId) {
  const prefix = documentVaultPrefix(restaurantId);
  const files = [];
  let query = { prefix, autoPaginate: false, maxResults: PAGE_SIZE };
  for (;;) {
    const [pageFiles, , response] = await bucket.getFiles(query);
    for (const file of pageFiles || []) files.push(file);
    const nextPageToken = response?.nextPageToken;
    if (!nextPageToken) break;
    query = { ...query, pageToken: nextPageToken };
  }
  return { prefix, files };
}

async function cleanupCurrentRunDocumentVaultStorage(app, restaurantId = '', runId = '') {
  const prefix = documentVaultPrefix(restaurantId);
  const result = {
    ok: false,
    method: 'server-admin-document-vault-prefix',
    prefix,
    objectsFound: 0,
    objectsDeleted: 0,
    objectsRemaining: 0,
    deleted: [],
    failures: [],
    unresolved: [],
    remaining: [],
  };
  let bucket;
  try {
    bucket = app.storage().bucket();
  } catch (error) {
    result.failures.push({ prefix, error: error?.message || 'Firebase Storage bucket is unavailable.' });
    return result;
  }

  let files = [];
  try {
    ({ files } = await listDocumentVaultFiles(bucket, restaurantId));
  } catch (error) {
    result.failures.push({ prefix, error: `Document Vault Storage list failed: ${error?.message || error}` });
    return result;
  }
  result.objectsFound = files.length;

  for (const file of files) {
    const fallbackMetadata = { name: file.name || '', metadata: {} };
    let metadata = fallbackMetadata;
    try {
      const [loaded] = typeof file.getMetadata === 'function' ? await file.getMetadata() : [fallbackMetadata];
      metadata = { ...fallbackMetadata, ...(loaded || {}), name: loaded?.name || file.name || '' };
    } catch (error) {
      result.failures.push({ storagePath: file.name || '', error: `metadata read failed: ${error?.message || error}` });
      continue;
    }
    const safetyErrors = storageObjectSafetyErrors(metadata, restaurantId, runId);
    if (safetyErrors.length) {
      result.unresolved.push({ storagePath: file.name || metadata.name || '', errors: safetyErrors });
      continue;
    }
    try {
      if (typeof file.delete !== 'function') throw new Error('Storage file delete function is unavailable.');
      await file.delete({ ignoreNotFound: true });
      result.objectsDeleted += 1;
      result.deleted.push(file.name || metadata.name || '');
    } catch (error) {
      result.failures.push({ storagePath: file.name || metadata.name || '', error: error?.message || String(error) });
    }
  }

  try {
    const remaining = await listDocumentVaultFiles(bucket, restaurantId);
    result.remaining = (remaining.files || []).map(file => file.name || '').filter(Boolean);
    result.objectsRemaining = result.remaining.length;
  } catch (error) {
    result.failures.push({ prefix, error: `Document Vault Storage remaining verification failed: ${error?.message || error}` });
  }
  result.ok = result.failures.length === 0 && result.unresolved.length === 0 && result.objectsRemaining === 0;
  return result;
}

async function seedQa(req, res, { auth, db, projectId, body, base }) {
  const roleCheck = validateRoleAccounts(body.roleAccounts, base.restaurantId, base.runId);
  const docCheck = validateDocuments(body.documents, base.restaurantId, base.runId);
  const restaurantPayload = body.restaurant && typeof body.restaurant === 'object' ? body.restaurant : {};
  const restaurantErrors = validateRestaurantPayload(restaurantPayload, base.restaurantId, base.runId, base.workspaceName);
  const errors = [...roleCheck.errors, ...docCheck.errors, ...restaurantErrors];
  if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' '), errors });

  const writes = [];
  const restaurantRef = db.collection('restaurants').doc(base.restaurantId);
  writes.push({ type: 'set', ref: restaurantRef, data: { ...restaurantPayload, restaurantId: base.restaurantId, updatedAt: isoNow() }, options: { merge: false } });

  for (const row of body.roleAccounts) {
    const membership = roleMembership(row, base.restaurantId, base.workspaceName, base.runId);
    const memberId = memberDocId(row.uid, base.restaurantId);
    writes.push({ type: 'set', ref: db.collection('workspaceMembers').doc(memberId), data: membership, options: { merge: false } });
    const userPatch = {
      email: norm(row.email),
      name: row.name || row.email || row.key,
      isActive: true,
      activeRestaurantId: base.restaurantId,
      defaultRestaurantId: base.restaurantId,
      lastWorkspaceId: base.restaurantId,
      workspaceIds: admin.firestore.FieldValue.arrayUnion(base.restaurantId),
      memberships: { [base.restaurantId]: membership },
      qaRoleAccount: true,
      qaLastRunId: base.runId,
      updatedAt: isoNow(),
      updatedBy: auth.email || auth.uid || 'system-admin',
    };
    writes.push({ type: 'set', ref: db.collection('users').doc(row.uid), data: userPatch, options: { merge: true } });
  }

  for (const row of docCheck.rows) {
    writes.push({ type: 'set', ref: db.collection(row.collection).doc(row.id), data: row.data, options: { merge: false } });
  }
  await commitInChunks(db, writes);

  const seededDocuments = [
    { collection: 'restaurants', id: base.restaurantId, docName: docName(projectId, 'restaurants', base.restaurantId), restaurantId: base.restaurantId, qaRunId: base.runId, expectedQaOwned: true },
    ...docCheck.rows.map(row => ({ collection: row.collection, id: row.id, docName: docName(projectId, row.collection, row.id), restaurantId: base.restaurantId, qaRunId: base.runId, expectedQaOwned: true, ...(row.meta || {}) })),
    ...body.roleAccounts.map(row => ({ collection: 'workspaceMembers', id: memberDocId(row.uid, base.restaurantId), docName: docName(projectId, 'workspaceMembers', memberDocId(row.uid, base.restaurantId)), restaurantId: base.restaurantId, qaRunId: base.runId, expectedQaOwned: true, roleKey: row.key })),
  ];
  const createdCounts = seededDocuments.reduce((counts, row) => {
    counts[row.collection] = (counts[row.collection] || 0) + 1;
    return counts;
  }, {});
  const verification = await verifyDocs(db, projectId, docCheck.rows, base.restaurantId, base.runId);
  const output = { ok: verification.ok === true, action: 'seed', projectId, restaurantId: base.restaurantId, restaurantName: base.workspaceName, seedMethod: 'server-verified-qa-seed-api', seededDocuments, createdCounts, verification };
  await writeAudit(db, auth, 'QA_RELEASE_GATE_SEED', base.restaurantId, JSON.stringify({ runId: base.runId, docs: seededDocuments.length, method: output.seedMethod }), base.restaurantId);
  return res.status(output.ok ? 200 : 500).json(output);
}
async function cleanupQa(req, res, { app, auth, db, projectId, body, base }) {
  const restaurantRef = db.collection('restaurants').doc(base.restaurantId);
  const restaurantSnap = await restaurantRef.get();
  if (restaurantSnap.exists) {
    const data = restaurantSnap.data() || {};
    const name = clean(data.name || data.restaurantName || data.qaCleanupName || '', '');
    const errors = [];
    if (data.qaOwned !== true) errors.push('restaurant.qaOwned is not true');
    if (data.qaRunId !== base.runId) errors.push('restaurant.qaRunId does not match current run');
    if (base.workspaceName && name !== base.workspaceName) errors.push('restaurant name does not match current QA workspace');
    if (errors.length) return res.status(409).json({ ok: false, error: `Cleanup refused non-current/non-QA restaurant: ${errors.join('; ')}` });
  }

  let storage = { ok: true, method: 'server-admin-document-vault-prefix', prefix: documentVaultPrefix(base.restaurantId), objectsFound: 0, objectsDeleted: 0, objectsRemaining: 0, deleted: [], failures: [], unresolved: [], remaining: [], skipped: !restaurantSnap.exists };
  if (restaurantSnap.exists) storage = await cleanupCurrentRunDocumentVaultStorage(app, base.restaurantId, base.runId);
  if (storage.ok !== true) {
    const failures = [
      ...(storage.failures || []).map(row => ({ collection: '_storage', ...row })),
      ...(storage.unresolved || []).map(row => ({ collection: '_storage', ...row, error: row.error || (row.errors || []).join('; ') || 'unresolved storage ownership evidence' })),
    ];
    const remaining = (storage.objectsRemaining || 0) > 0 ? [{ collection: '_storage', count: storage.objectsRemaining, prefix: storage.prefix }] : [];
    const output = {
      ok: false,
      action: 'cleanup',
      projectId,
      restaurantId: base.restaurantId,
      restaurantExisted: restaurantSnap.exists,
      restaurantDeleted: false,
      deletedOrUpdated: 0,
      failures,
      remaining,
      storage,
      storageObjectsFound: storage.objectsFound || 0,
      storageObjectsDeleted: storage.objectsDeleted || 0,
      storageObjectsRemaining: storage.objectsRemaining || 0,
      cleanupMethod: 'server-verified-qa-seed-api'
    };
    await writeAudit(db, auth, 'QA_RELEASE_GATE_CLEANUP_STORAGE_BLOCKED', base.restaurantId, JSON.stringify({ runId: base.runId, failures: failures.length, remaining: remaining.length, storageObjectsFound: output.storageObjectsFound, storageObjectsDeleted: output.storageObjectsDeleted, storageObjectsRemaining: output.storageObjectsRemaining }).slice(0, 900), base.restaurantId);
    return res.status(207).json(output);
  }

  const refs = new Map();
  const addRef = (collection, id) => {
    const safeCollection = clean(collection || '', '');
    const safeDoc = safeId(id || '', 240);
    if (!safeCollection || !safeDoc) return;
    if (safeCollection === 'restaurants') return;
    if (!ALLOWED_COLLECTIONS.has(safeCollection)) return;
    refs.set(`${safeCollection}/${safeDoc}`, db.collection(safeCollection).doc(safeDoc));
  };
  for (const row of Array.isArray(body.seededDocuments) ? body.seededDocuments : []) addRef(row.collection, row.id);
  for (const collection of ALLOWED_COLLECTIONS) {
    const docs = await queryQaDocs(db, collection, base.restaurantId, base.runId).catch(() => []);
    for (const doc of docs) refs.set(`${collection}/${doc.id}`, doc.ref);
  }

  const roleAccounts = Array.isArray(body.roleAccounts) ? body.roleAccounts : [];
  for (const row of roleAccounts) addRef('workspaceMembers', memberDocId(row.uid, base.restaurantId));

  const writes = [];
  for (const ref of refs.values()) writes.push({ type: 'delete', ref });
  if (restaurantSnap.exists) writes.push({ type: 'delete', ref: restaurantRef });
  for (const row of roleAccounts) {
    if (!row.uid) continue;
    const userRef = db.collection('users').doc(row.uid);
    writes.push({ type: 'update', ref: userRef, data: {
      workspaceIds: admin.firestore.FieldValue.arrayRemove(base.restaurantId),
      [`memberships.${base.restaurantId}`]: admin.firestore.FieldValue.delete(),
      activeRestaurantId: admin.firestore.FieldValue.delete(),
      defaultRestaurantId: admin.firestore.FieldValue.delete(),
      lastWorkspaceId: admin.firestore.FieldValue.delete(),
      qaLastRunId: admin.firestore.FieldValue.delete(),
      updatedAt: isoNow(),
      updatedBy: auth.email || auth.uid || 'system-admin',
    } });
  }

  let committed = 0;
  const failures = [];
  for (const write of writes) {
    try { committed += await commitInChunks(db, [write]); }
    catch (error) { failures.push({ path: write.ref.path, error: String(error?.message || error).slice(0, 300) }); }
  }
  const remaining = [];
  for (const collection of ALLOWED_COLLECTIONS) {
    const docs = await queryQaDocs(db, collection, base.restaurantId, base.runId).catch(() => []);
    if (docs.length) remaining.push({ collection, count: docs.length });
  }
  const restaurantAfter = await restaurantRef.get();
  if (restaurantAfter.exists) remaining.push({ collection: 'restaurants', count: 1 });
  for (const failure of storage.failures || []) failures.push({ collection: '_storage', ...failure });
  for (const row of storage.unresolved || []) failures.push({ collection: '_storage', ...row, error: row.error || (row.errors || []).join('; ') || 'unresolved storage ownership evidence' });
  if ((storage.objectsRemaining || 0) > 0) remaining.push({ collection: '_storage', count: storage.objectsRemaining, prefix: storage.prefix });
  const output = {
    ok: failures.length === 0 && remaining.length === 0 && storage.ok === true,
    action: 'cleanup',
    projectId,
    restaurantId: base.restaurantId,
    restaurantExisted: restaurantSnap.exists,
    restaurantDeleted: restaurantSnap.exists && !restaurantAfter.exists,
    deletedOrUpdated: committed,
    failures,
    remaining,
    storage,
    storageObjectsFound: storage.objectsFound || 0,
    storageObjectsDeleted: storage.objectsDeleted || 0,
    storageObjectsRemaining: storage.objectsRemaining || 0,
    cleanupMethod: 'server-verified-qa-seed-api'
  };
  await writeAudit(db, auth, 'QA_RELEASE_GATE_CLEANUP', base.restaurantId, JSON.stringify({ runId: base.runId, ok: output.ok, failures: failures.length, remaining: remaining.length, storageObjectsFound: output.storageObjectsFound, storageObjectsDeleted: output.storageObjectsDeleted, storageObjectsRemaining: output.storageObjectsRemaining }), base.restaurantId);
  return res.status(output.ok ? 200 : 207).json(output);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  try {
    const app = initAdmin(req);
    const db = app.firestore();
    const auth = await authorize(req, app, { allowTenantAdmin: false });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    const body = await readBody(req);
    const projectId = app.options?.projectId || auth.app?.options?.projectId || '';
    const base = validateBase({ req, auth, body, projectId });
    if (!base.ok) return res.status(403).json({ ok: false, error: base.errors.join(' '), errors: base.errors });
    const ctx = { app, auth, db, projectId, body, base };
    if (body.action === 'seed') return seedQa(req, res, ctx);
    if (body.action === 'cleanup') return cleanupQa(req, res, ctx);
    return res.status(400).json({ ok: false, error: 'Unsupported action. Use seed or cleanup.' });
  } catch (error) {
    const message = String(error?.message || error || 'QA seed route failed').replace(/(token|secret|private[_ -]?key|authorization|password)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]').slice(0, 600);
    return res.status(500).json({ ok: false, error: message });
  }
};

module.exports.config = { maxDuration: 300 };
module.exports.validateDocuments = validateDocuments;
module.exports.cleanupCurrentRunDocumentVaultStorage = cleanupCurrentRunDocumentVaultStorage;
module.exports.storageObjectSafetyErrors = storageObjectSafetyErrors;
module.exports.documentVaultPrefix = documentVaultPrefix;

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { loadEnv, env, boolEnv } = require('./env-loader.cjs');
const { readFirebaseConfig } = require('./firebase-client.cjs');
const { ensureRunDir, getSeedReportPath, getCleanupReportPath, getSetupStatePath, readJsonIfExists, writeJson } = require('../86chaos-release-gate/run-context.cjs');
const { resolveQaWorkspaceName, validateQaWorkspaceName } = require('../86chaos-release-gate/qa-workspace.cjs');
const { assertMutationSafety } = require('../86chaos-release-gate/mutation-safety.cjs');

loadEnv(process.cwd());

const { runId: RUN_ID, runDir: RELEASE_RUN_DIR } = ensureRunDir();
const REPORT_PATH = getCleanupReportPath(RUN_ID);
const GHOST_TARGET_AUTH_PATH = path.join(RELEASE_RUN_DIR, 'ghost-target-auth.json');
const QA_RESTAURANT_NAME = resolveQaWorkspaceName(process.env, RUN_ID);
const COLLECTIONS = [
  'restaurantAdminAlerts', 'eventReminders', 'personalReminders', 'scheduleCoverageTargets',
  'scheduleTemplates', 'availabilityRecords', 'shiftSwaps', 'timePunches', 'timeOffRequests',
  'shifts', 'events', 'financialExpenses', 'sales', 'maintenanceLogs', 'pmSchedules', 'tasks',
  'prepItems', 'menuDependencies', 'recipes', 'inventoryItems', 'vendors', 'users', 'workspaceMembers'
];


async function deleteGhostTargetAuthAccount(projectId) {
  const ghost = readJsonIfExists(GHOST_TARGET_AUTH_PATH) || null;
  if (!ghost?.uid) return { attempted: false, deleted: 0, verifiedAbsent: false, reason: 'missing ghost-target-auth.json' };
  const { getAdminAppForProject } = require('../../api/_firebase-project-admin.js');
  const app = getAdminAppForProject(projectId, { requireCredentials: true });
  const auth = app.auth();
  try {
    await auth.deleteUser(ghost.uid);
  } catch (error) {
    const code = String(error?.code || error?.errorInfo?.code || '');
    if (!/user-not-found/i.test(code)) return { attempted: true, deleted: 0, verifiedAbsent: false, uid: ghost.uid, error: error.message || String(error) };
  }
  let verifiedAbsent = false;
  try {
    await auth.getUser(ghost.uid);
  } catch (error) {
    const code = String(error?.code || error?.errorInfo?.code || '');
    verifiedAbsent = /user-not-found/i.test(code);
  }
  return { attempted: true, deleted: 1, verifiedAbsent, uid: ghost.uid, email: ghost.email || '' };
}

function buildFirebaseAuthRequestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const base = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || '';
  if (base) {
    try {
      const origin = new URL(base).origin;
      headers.Origin = origin;
      headers.Referer = `${origin}/`;
    } catch (_) {
      headers.Referer = String(base);
    }
  }
  return headers;
}

function writeReport(report) {
  writeJson(REPORT_PATH, {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    runDir: RELEASE_RUN_DIR,
    cleanupMethod: 'server-verified-qa-seed-api',
    ...report,
  });
}

function appUrl(pathOrTab = '') {
  const base = env('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL').replace(/\/+$/, '');
  if (!pathOrTab) return base;
  if (/^https?:\/\//i.test(pathOrTab)) return pathOrTab;
  if (String(pathOrTab).startsWith('/')) return `${base}${pathOrTab}`;
  return `${base}/?tab=${encodeURIComponent(pathOrTab)}`;
}

function getCredentials() {
  const email = env('SYSTEM_ADMIN_EMAIL', 'CHAOS_SYSTEM_ADMIN_EMAIL', 'OWNER_EMAIL');
  const password = env('SYSTEM_ADMIN_PASSWORD', 'CHAOS_SYSTEM_ADMIN_PASSWORD', 'OWNER_PASSWORD');
  if (!email || !password) throw new Error('Missing SYSTEM_ADMIN_EMAIL/SYSTEM_ADMIN_PASSWORD for QA cleanup.');
  return { email: String(email).trim(), password };
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
  return { base, headers, projectId: config.projectId };
}

function storageRest(config, idToken) {
  const bucket = config.storageBucket || '';
  const base = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o`;
  const headers = { Authorization: `Bearer ${idToken}` };
  return { base, headers, bucket, projectId: config.projectId };
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
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)]));
  return undefined;
}
function firestoreDocData(doc) { return Object.fromEntries(Object.entries(doc?.fields || {}).map(([k, v]) => [k, fromFirestoreValue(v)])); }

async function getDocByName(page, rest, docName) {
  if (!docName) return null;
  try { return await pageFetchJson(page, { url: `https://firestore.googleapis.com/v1/${docName}`, method: 'GET', headers: rest.headers }); }
  catch (error) { if (/HTTP 404\b/.test(error.message || '')) return null; throw error; }
}

async function deleteDocName(page, rest, docName) {
  if (!docName) return { ok: false, reason: 'missing docName' };
  try {
    await pageFetchJson(page, { url: `https://firestore.googleapis.com/v1/${docName}`, method: 'DELETE', headers: rest.headers });
    return { ok: true };
  } catch (error) {
    if (/HTTP 404\b/.test(error.message || '')) return { ok: true, alreadyAbsent: true };
    return { ok: false, error: error.message };
  }
}

function makeFieldFilter(fieldPath, op, value) { return { fieldFilter: { field: { fieldPath }, op, value } }; }
function strValue(value) { return { stringValue: String(value) }; }
function boolValue(value) { return { booleanValue: value === true }; }

async function queryCurrentRunDocs(page, rest, colName, restaurantId, limit = 500) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: colName }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            makeFieldFilter('qaOwned', 'EQUAL', boolValue(true)),
            makeFieldFilter('restaurantId', 'EQUAL', strValue(restaurantId)),
            makeFieldFilter('qaRunId', 'EQUAL', strValue(RUN_ID)),
          ],
        },
      },
      limit,
    },
  };
  const rows = await pageFetchJson(page, { url: `${rest.base}:runQuery`, method: 'POST', headers: rest.headers, body });
  return (rows || []).map(r => r.document).filter(Boolean);
}

function buildExpectedByCollection(seed = {}) {
  const expected = {};
  for (const row of seed.seededDocuments || []) {
    if (row.collection === 'restaurants') continue;
    expected[row.collection] = (expected[row.collection] || 0) + 1;
  }
  for (const [collection, count] of Object.entries(seed.expectedCounts || {})) {
    expected[collection] = Math.max(expected[collection] || 0, Number(count) || 0);
  }
  return expected;
}

function encodeObjectName(name) { return encodeURIComponent(String(name || '')); }

async function listStorageObjects(page, storage, prefix) {
  const objects = [];
  let pageToken = '';
  for (let guard = 0; guard < 40; guard += 1) {
    const params = new URLSearchParams({ prefix, maxResults: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await pageFetchJson(page, { url: `${storage.base}?${params.toString()}`, method: 'GET', headers: storage.headers });
    for (const item of data?.items || []) objects.push(item);
    pageToken = data?.nextPageToken || '';
    if (!pageToken) break;
  }
  return objects;
}

async function deleteStorageObject(page, storage, name) {
  try {
    await pageFetchJson(page, { url: `${storage.base}/${encodeObjectName(name)}`, method: 'DELETE', headers: storage.headers });
    return { ok: true };
  } catch (error) {
    if (/HTTP 404\b/.test(error.message || '')) return { ok: true, alreadyAbsent: true };
    return { ok: false, error: error.message || String(error) };
  }
}

function documentVaultObjectOwnershipErrors(object = {}, restaurantId) {
  const meta = object.metadata || {};
  const errors = [];
  if (!String(object.name || '').startsWith(`restaurants/${restaurantId}/back-office/document-vault/`)) errors.push('path is outside current-run Document Vault prefix');
  if (meta.purpose !== 'document-vault') errors.push('missing purpose=document-vault metadata');
  if (meta.restaurantId !== restaurantId) errors.push('metadata restaurantId does not match current-run restaurant');
  if (meta.source !== '86chaos-document-vault') errors.push('missing 86 Chaos Document Vault source metadata');
  if (meta.qaRunId && meta.qaRunId !== RUN_ID) errors.push('qaRunId metadata belongs to another run');
  return errors;
}

async function cleanupDocumentVaultStorage(page, storage, restaurantId) {
  const prefix = `restaurants/${restaurantId}/back-office/document-vault/`;
  const removed = [];
  const failed = [];
  const unresolved = [];
  const objects = await listStorageObjects(page, storage, prefix);
  for (const object of objects) {
    const evidenceErrors = documentVaultObjectOwnershipErrors(object, restaurantId);
    if (evidenceErrors.length) {
      unresolved.push({ storagePath: object.name || '', missingOwnershipEvidence: evidenceErrors });
      continue;
    }
    const deleted = await deleteStorageObject(page, storage, object.name);
    if (deleted.ok) removed.push(object.name);
    else failed.push({ storagePath: object.name || '', error: deleted.error || 'delete failed' });
  }
  const remainingObjects = await listStorageObjects(page, storage, prefix).catch(() => []);
  const remaining = remainingObjects.map(object => object.name || '').filter(Boolean);
  return { prefix, found: objects.length, removed, failed, unresolved, remaining };
}

function validateSeedForCleanup(seed, currentRunId, setupState = {}) {
  const errors = [];
  const warnings = [];
  const setupHasEvidence = Boolean(setupState && Object.keys(setupState).length);
  const seededRows = Array.isArray(seed?.seededDocuments) ? seed.seededDocuments : [];
  const writesStarted = setupState?.writesStarted === true || setupState?.qaDataWritesStarted === true || seed?.createdRestaurant === true || seededRows.length > 0;
  if (!seed && !setupHasEvidence) errors.push('Current-run seed report and setup state are missing.');
  if (seed && seed.runId && seed.runId !== currentRunId) errors.push(`Seed report runId ${seed.runId || '(missing)'} does not match current run ${currentRunId}.`);
  if (setupState && setupState.runId && setupState.runId !== currentRunId) errors.push(`Setup state runId ${setupState.runId || '(missing)'} does not match current run ${currentRunId}.`);
  const restaurantId = seed?.restaurantId || seed?.profile?.restaurantId || setupState?.restaurantId || setupState?.temporaryRestaurantId || '';
  if (!restaurantId && writesStarted) errors.push('Current-run writes started but no restaurantId is recorded.');
  if (!writesStarted) errors.push('No current-run writes were recorded.');
  if (seed && seed.ok !== true) warnings.push('Seed report is not ok:true; cleanup will proceed only for exact current-run QA records.');
  if (seed && seed.verification?.ok !== true) warnings.push('Seed verification did not complete; cleanup will still remove exact current-run QA records.');
  return { ok: errors.length === 0, errors, warnings, restaurantId, writesStarted };
}

async function cleanupCurrentRun({ page, rest, storage, seed = {}, restaurantId }) {
  const expected = buildExpectedByCollection(seed || {});
  const deleted = {};
  const alreadyAbsent = {};
  const failed = [];
  const additionalRunRecords = {};
  const remaining = {};
  let documentVaultStorage = { prefix: `restaurants/${restaurantId}/back-office/document-vault/`, found: 0, removed: [], failed: [], unresolved: [], remaining: [] };
  const seededRows = (Array.isArray(seed?.seededDocuments) ? seed.seededDocuments : []).filter(row => row.collection !== 'restaurants');

  for (const row of seededRows) {
    const before = await getDocByName(page, rest, row.docName);
    if (!before) {
      alreadyAbsent[row.collection] = (alreadyAbsent[row.collection] || 0) + 1;
      continue;
    }
    const result = await deleteDocName(page, rest, row.docName);
    if (result.ok && result.alreadyAbsent) alreadyAbsent[row.collection] = (alreadyAbsent[row.collection] || 0) + 1;
    else if (result.ok) deleted[row.collection] = (deleted[row.collection] || 0) + 1;
    else failed.push({ collection: row.collection, id: row.id, docName: row.docName, error: result.error || result.reason || 'delete failed' });
  }

  for (const colName of COLLECTIONS) {
    let extraDeleted = 0;
    for (let guard = 0; guard < 40; guard += 1) {
      const docs = await queryCurrentRunDocs(page, rest, colName, restaurantId, 500);
      if (!docs.length) break;
      for (const doc of docs) {
        const result = await deleteDocName(page, rest, doc.name);
        if (result.ok) extraDeleted += 1;
        else failed.push({ collection: colName, docName: doc.name, error: result.error || result.reason || 'delete failed' });
      }
      if (docs.length < 500) break;
    }
    if (extraDeleted) additionalRunRecords[colName] = extraDeleted;
  }

  for (const colName of COLLECTIONS) {
    try {
      const docs = await queryCurrentRunDocs(page, rest, colName, restaurantId, 500);
      if (docs.length) remaining[colName] = docs.length;
    } catch (error) {
      failed.push({ collection: colName, error: `remaining verification failed: ${error.message}` });
    }
  }

  if (storage) {
    try {
      documentVaultStorage = await cleanupDocumentVaultStorage(page, storage, restaurantId);
    } catch (error) {
      failed.push({ collection: '_storage', prefix: documentVaultStorage.prefix, error: `Document Vault Storage cleanup failed: ${error.message}` });
    }
  }

  return {
    expected,
    deleted,
    alreadyAbsent,
    failed: failed.concat((documentVaultStorage.failed || []).map(row => ({ collection: '_storage', ...row }))),
    additionalRunRecords,
    remaining: { ...remaining, ...(documentVaultStorage.remaining?.length ? { _storage: documentVaultStorage.remaining.length } : {}) },
    storageObjectsRemoved: documentVaultStorage.removed || [],
    storageObjectsFound: documentVaultStorage.found || 0,
    unresolvedQaLeftovers: documentVaultStorage.unresolved || []
  };
}


async function fetchJson(url, options = {}, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable. Run the release gate under Node 24.');
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { rawText: text }; }
  if (!response.ok) {
    const safeText = String(text || '').replace(/(token|secret|private[_ -]?key|authorization|password)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]').slice(0, 1200);
    throw new Error(`HTTP ${response.status} ${response.statusText || ''} for ${url}: ${safeText}`.trim());
  }
  return data;
}

async function signInForIdToken(config, email, password) {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
  const signed = await fetchJson(signInUrl, {
    method: 'POST',
    headers: buildFirebaseAuthRequestHeaders(),
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!signed.idToken) throw new Error('Firebase Auth cleanup sign-in did not return idToken.');
  return signed;
}

function buildApiHeaders(idToken) {
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  const base = appUrl();
  if (base) {
    try {
      const origin = new URL(base).origin;
      headers.Origin = origin;
      headers.Referer = `${origin}/`;
    } catch (_) {
      headers.Referer = String(base);
    }
  }
  return headers;
}

async function callQaSeedApi(action, idToken, body) {
  const url = appUrl('/api/full-audit-qa-seed');
  if (!url) throw new Error('APP_URL or CHAOS_BASE_URL is required before server-verified QA cleanup can run.');
  return fetchJson(url, {
    method: 'POST',
    headers: buildApiHeaders(idToken),
    body: JSON.stringify({ action, ...body }),
  });
}

function roleAccountsForCleanup(seed = {}) {
  const fromSeed = Array.isArray(seed.roleAccounts) ? seed.roleAccounts : [];
  const fromVerification = Array.isArray(seed.roleIdentityVerification?.accounts) ? seed.roleIdentityVerification.accounts : [];
  const rows = fromSeed.length ? fromSeed : fromVerification;
  return rows.map(row => ({
    key: row.key,
    email: row.email,
    uid: row.uid,
    name: row.name || row.label || row.email || row.key,
    role: row.role || row.restaurantRole || '',
    restaurantRole: row.restaurantRole || row.role || '',
    isAdmin: row.isAdmin === true,
    isOwner: row.isOwner === true,
    accountOwner: row.accountOwner === true,
    workspaceOwner: row.workspaceOwner === true,
    permissions: row.permissions || {},
  })).filter(row => row.key && row.email && row.uid);
}

function nodeFetchPage() {
  return {
    evaluate: async (fn, request) => fn(request),
  };
}

async function main() {
  const report = { ok: false, expected: {}, deleted: {}, alreadyAbsent: {}, failed: [], remaining: {}, additionalRunRecords: {}, warnings: [] };
  try {
    if (!boolEnv('CHAOS_ALLOW_MUTATION')) throw new Error('CHAOS_ALLOW_MUTATION=true required for cleanup.');
    if (!env('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL')) throw new Error('APP_URL / CHAOS_BASE_URL required for server-verified cleanup.');

    const seedPath = getSeedReportPath(RUN_ID);
    const seed = readJsonIfExists(seedPath);
    report.seedReportPath = seedPath;
    const setupState = readJsonIfExists(getSetupStatePath(RUN_ID));
    const validation = validateSeedForCleanup(seed, RUN_ID, setupState || {});
    report.seedValidation = validation;
    if (!validation.ok) {
      const seededRows = Array.isArray(seed?.seededDocuments) ? seed.seededDocuments : [];
      const noCurrentRunQaData = !validation.writesStarted && !validation.restaurantId && seed?.createdRestaurant !== true && seededRows.length === 0 && setupState?.seeded !== true;
      if (noCurrentRunQaData) {
        writeReport({
          ...report,
          ok: true,
          skipped: true,
          cleanupMethod: 'server-verified-qa-seed-api',
          reason: 'Cleanup safely skipped because QA setup did not create a current-run restaurant or seeded child records.',
          setupState: setupState || null,
        });
        return;
      }
      throw new Error(`Cleanup refused before deleting anything:\n${validation.errors.join('\n')}`);
    }
    const restaurantId = validation.restaurantId;
    const qaNameCheck = validateQaWorkspaceName(QA_RESTAURANT_NAME, RUN_ID);
    if (!qaNameCheck.ok) throw new Error(`QA cleanup workspace name failed safety validation: ${qaNameCheck.errors.join('; ')}`);
    report.qaWorkspaceName = QA_RESTAURANT_NAME;

    const config = readFirebaseConfig();
    const mutationSafety = assertMutationSafety({ env: process.env, runId: RUN_ID, projectId: config.projectId, requireAdminCredentials: false });
    if (!mutationSafety.ok) throw new Error(`QA cleanup mutation safety failed: ${mutationSafety.errors.join('; ')}`);
    report.mutationSafety = mutationSafety;
    const { email, password } = getCredentials();
    const signed = await signInForIdToken(config, email, password);
    report.signedInAs = email;
    report.restaurantId = restaurantId;
    report.restaurantName = seed?.restaurantName || seed?.profile?.restaurantName || QA_RESTAURANT_NAME;
    report.cleanupMethod = 'server-verified-qa-seed-api';

    const apiResult = await callQaSeedApi('cleanup', signed.idToken, {
      runId: RUN_ID,
      expectedProjectId: config.projectId,
      restaurantId,
      workspaceName: report.restaurantName,
      seededDocuments: Array.isArray(seed?.seededDocuments) ? seed.seededDocuments : [],
      roleAccounts: roleAccountsForCleanup(seed || {}),
    });
    report.apiResult = { ok: apiResult.ok === true, action: apiResult.action, projectId: apiResult.projectId, cleanupMethod: apiResult.cleanupMethod };
    report.failed = Array.isArray(apiResult.failures) ? apiResult.failures : [];
    report.remaining = Array.isArray(apiResult.remaining) && apiResult.remaining.length ? Object.fromEntries(apiResult.remaining.map(row => [row.collection, row.count || 1])) : {};
    report.deletedOrUpdated = apiResult.deletedOrUpdated || 0;

    const storageResult = apiResult.storage || {};
    report.storage = storageResult;
    report.storageObjectsRemoved = Array.isArray(storageResult.deleted) ? storageResult.deleted : [];
    report.storageObjectsFound = Number(apiResult.storageObjectsFound ?? storageResult.objectsFound ?? 0);
    report.storageObjectsDeleted = Number(apiResult.storageObjectsDeleted ?? storageResult.objectsDeleted ?? report.storageObjectsRemoved.length ?? 0);
    report.storageObjectsRemaining = Number(apiResult.storageObjectsRemaining ?? storageResult.objectsRemaining ?? 0);
    report.unresolvedQaLeftovers = Array.isArray(storageResult.unresolved) ? storageResult.unresolved : [];
    if (report.storageObjectsRemaining > 0) report.remaining._storage = report.storageObjectsRemaining;

    report.expected = buildExpectedByCollection(seed || {});
    report.restaurantExisted = apiResult.restaurantExisted === true;
    report.restaurantDeleted = apiResult.restaurantDeleted === true ? 1 : 0;
    report.restaurantRemaining = Array.isArray(apiResult.remaining) && apiResult.remaining.some(row => row.collection === 'restaurants');
    report.temporaryAuthAccounts = { ghostTarget: await deleteGhostTargetAuthAccount(config.projectId).catch(error => ({ attempted: true, deleted: 0, verifiedAbsent: false, error: error.message || String(error) })) };
    report.temporaryAuthAccountsDeleted = Number(report.temporaryAuthAccounts.ghostTarget?.deleted || 0);
    if (report.temporaryAuthAccounts.ghostTarget?.attempted && report.temporaryAuthAccounts.ghostTarget?.verifiedAbsent !== true) {
      report.failed.push({ collection: '_auth', error: report.temporaryAuthAccounts.ghostTarget?.error || 'Temporary Ghost-target Auth account was not verified absent after cleanup.' });
    }
    report.accountedFailures = [];
    report.ok = apiResult.ok === true && report.failed.length === 0 && Object.keys(report.remaining).length === 0 && (report.unresolvedQaLeftovers || []).length === 0;
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    report.ok = false;
    report.error = error.stack || error.message;
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    writeReport(report);
    console.log(`Cleanup report: ${REPORT_PATH}`);
  }
}

if (require.main === module) main();

module.exports = {
  validateSeedForCleanup,
  buildExpectedByCollection,
  cleanupCurrentRun,
  firestoreDocData,
  cleanupDocumentVaultStorage,
  documentVaultObjectOwnershipErrors,
  deleteGhostTargetAuthAccount,
  storageRest,
  COLLECTIONS,
  QA_RESTAURANT_NAME,
};

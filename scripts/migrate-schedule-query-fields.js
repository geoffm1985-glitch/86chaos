#!/usr/bin/env node
'use strict';

const { getAdminAppForProject, TRUSTED_PROJECTS } = require('../api/_firebase-project-admin');

const BATCH_LIMIT = 400;
const TARGET_COLLECTIONS = ['shifts', 'timeOffRequests', 'shiftSwaps', 'availabilityRecords', 'timePunches'];

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find(v => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function requireProject() {
  const projectId = arg('project', process.env.FIREBASE_PROJECT_ID || '');
  if (!TRUSTED_PROJECTS.includes(projectId)) throw new Error(`Refusing schedule migration for unknown Firebase project "${projectId || '(missing)'}".`);
  if (projectId === 'cheers-34b8d' && arg('confirm-production') !== 'MIGRATE SCHEDULE QUERY FIELDS') throw new Error('Production schedule migration requires --confirm-production="MIGRATE SCHEDULE QUERY FIELDS".');
  return projectId;
}
function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const y = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${y}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  }
  return '';
}
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function restaurantIdFor(data = {}) { return String(data.restaurantId || data.workspaceId || '').trim(); }
function addToSetMap(map, key, value) {
  const normalized = String(key || '').trim();
  if (!normalized || !value) return;
  if (!map.has(normalized)) map.set(normalized, new Set());
  map.get(normalized).add(value);
}
async function readAll(db, collectionName) {
  const rows = [];
  let last = null;
  for (;;) {
    let q = db.collection(collectionName).orderBy('__name__').limit(BATCH_LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    rows.push(...snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    last = snap.docs[snap.docs.length - 1];
  }
  return rows;
}
async function buildIdentityIndex(db) {
  const [users, memberships] = await Promise.all([readAll(db, 'users'), readAll(db, 'workspaceMembers')]);
  const byRestaurant = new Map();
  const ensure = restaurantId => {
    if (!byRestaurant.has(restaurantId)) byRestaurant.set(restaurantId, { ids: new Map(), emails: new Map(), people: new Map() });
    return byRestaurant.get(restaurantId);
  };
  const register = (restaurantId, person = {}) => {
    if (!restaurantId || !person.canonicalId) return;
    const idx = ensure(restaurantId);
    idx.people.set(person.canonicalId, person);
    [person.canonicalId, person.userId, person.id, person.uid, person.authUid, person.rosterUserId, person.employeeId, person.membershipId]
      .filter(Boolean).forEach(value => addToSetMap(idx.ids, value, person.canonicalId));
    [person.email, person.employeeEmail, person.assignedEmail].map(normalizeEmail).filter(Boolean)
      .forEach(value => addToSetMap(idx.emails, value, person.canonicalId));
  };
  users.forEach(user => {
    const restaurants = new Set([user.restaurantId, user.activeRestaurantId, user.defaultRestaurantId, ...(Array.isArray(user.workspaceIds) ? user.workspaceIds : [])].filter(Boolean));
    restaurants.forEach(restaurantId => register(String(restaurantId), {
      ...user,
      canonicalId: String(user.scheduleUserId || user.userId || user.id),
      userId: String(user.userId || user.id),
      id: user.id
    }));
  });
  memberships.forEach(member => {
    const restaurantId = restaurantIdFor(member);
    if (!restaurantId || member.isActive === false || member.status === 'inactive') return;
    const linkedUser = users.find(user => user.id === member.userId || user.id === member.uid || user.id === member.authUid || normalizeEmail(user.email) === normalizeEmail(member.email));
    const canonicalId = String(member.scheduleUserId || linkedUser?.scheduleUserId || member.userId || linkedUser?.userId || linkedUser?.id || member.uid || member.authUid || member.id);
    register(restaurantId, {
      ...(linkedUser || {}),
      ...member,
      canonicalId,
      membershipId: member.id,
      userId: String(member.userId || linkedUser?.userId || linkedUser?.id || canonicalId)
    });
  });
  return byRestaurant;
}
function resolveScheduleIdentity(data = {}, identityIndex) {
  const restaurantId = restaurantIdFor(data);
  const idx = identityIndex.get(restaurantId);
  if (!idx) return { status: 'manual_resolution_required', reason: 'restaurant_has_no_identity_index' };
  const existing = String(data.scheduleUserId || '').trim();
  if (existing) {
    const matches = idx.ids.get(existing);
    if (matches?.size === 1) {
      const canonicalId = [...matches][0];
      return { status: 'resolved', canonicalId, person: idx.people.get(canonicalId) || {} };
    }
    return { status: 'manual_resolution_required', reason: matches?.size > 1 ? 'existing_schedule_user_id_is_ambiguous' : 'existing_schedule_user_id_not_in_tenant' };
  }
  const candidateMatches = new Set();
  [data.userId, data.authUid, data.uid, data.rosterUserId, data.employeeId, data.assignedUserId]
    .filter(Boolean).forEach(value => (idx.ids.get(String(value).trim()) || []).forEach(id => candidateMatches.add(id)));
  if (candidateMatches.size === 1) {
    const canonicalId = [...candidateMatches][0];
    return { status: 'resolved', canonicalId, person: idx.people.get(canonicalId) || {} };
  }
  if (candidateMatches.size > 1) return { status: 'manual_resolution_required', reason: 'legacy_identity_fields_resolve_to_multiple_users' };
  const emailMatches = new Set();
  [data.employeeEmail, data.assignedEmail, data.email].map(normalizeEmail).filter(Boolean)
    .forEach(value => (idx.emails.get(value) || []).forEach(id => emailMatches.add(id)));
  if (emailMatches.size === 1) {
    const canonicalId = [...emailMatches][0];
    return { status: 'resolved', canonicalId, person: idx.people.get(canonicalId) || {}, resolvedBy: 'unique_email' };
  }
  return { status: 'manual_resolution_required', reason: emailMatches.size > 1 ? 'email_identity_is_ambiguous' : 'no_unique_tenant_identity_match' };
}
function identityPatch(resolution = {}, data = {}) {
  if (resolution.status !== 'resolved') return {
    scheduleIdentityMigrationStatus: 'manual_resolution_required',
    scheduleIdentityMigrationReason: resolution.reason || 'unknown_identity'
  };
  const person = resolution.person || {};
  return {
    scheduleUserId: resolution.canonicalId,
    userId: String(person.userId || person.id || data.userId || resolution.canonicalId),
    rosterUserId: String(person.rosterUserId || data.rosterUserId || person.id || resolution.canonicalId),
    authUid: String(person.authUid || person.uid || person.id || data.authUid || ''),
    employeeId: String(person.employeeId || data.employeeId || person.rosterUserId || person.id || resolution.canonicalId),
    employeeEmail: String(person.email || data.employeeEmail || data.assignedEmail || ''),
    scheduleIdentityMigrationStatus: 'resolved',
    scheduleIdentityMigrationReason: resolution.resolvedBy || 'canonical_tenant_identity'
  };
}
function patchFor(collectionName, data, identityIndex) {
  const patch = {};
  if (!data.restaurantId && data.workspaceId) patch.restaurantId = data.workspaceId;
  if (collectionName === 'shifts') {
    const date = normalizeDate(data.date || data.scheduleDateKey || data.shiftDate || data.day);
    if (date && data.date !== date) patch.date = date;
    if (date && data.shiftDate !== date) patch.shiftDate = date;
    Object.assign(patch, identityPatch(resolveScheduleIdentity(data, identityIndex), data));
  }
  if (collectionName === 'availabilityRecords' || collectionName === 'timePunches') {
    Object.assign(patch, identityPatch(resolveScheduleIdentity(data, identityIndex), data));
    if (collectionName === 'timePunches') {
      const date = normalizeDate(data.date || data.clockInDate || data.shiftDate);
      if (date && data.date !== date) patch.date = date;
    }
  }
  if (collectionName === 'shiftSwaps') {
    const date = normalizeDate(data.shiftDate || data.date || data.requestedDate || data.day);
    if (date && data.shiftDate !== date) patch.shiftDate = date;
    if (date && data.date !== date) patch.date = date;
    if (!data.requesterUserId && (data.originalUserId || data.userId || data.createdBy)) patch.requesterUserId = data.originalUserId || data.userId || data.createdBy;
    if (!data.sourceEmployeeId && (data.originalEmployeeId || data.employeeId)) patch.sourceEmployeeId = data.originalEmployeeId || data.employeeId;
    if (!data.status && data.available === true) patch.status = 'available';
  }
  if (collectionName === 'timeOffRequests') {
    const date = normalizeDate(data.date || data.startDate || data.requestedDate || data.day);
    if (date && data.date !== date) patch.date = date;
    // Time-off ownership intentionally remains the authenticated user ID, not scheduleUserId.
  }
  return patch;
}
function hasDiff(before, patch) {
  return Object.entries(patch).some(([key, value]) => before[key] !== value);
}
async function migrateCollection(db, collectionName, dryRun, identityIndex) {
  const counts = { scanned: 0, malformed: 0, alreadyCorrect: 0, wouldUpdate: 0, updated: 0, manualResolutionRequired: 0 };
  const manualResolution = [];
  let last = null;
  for (;;) {
    let q = db.collection(collectionName).orderBy('__name__').limit(BATCH_LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    let writes = 0;
    snap.docs.forEach(docSnap => {
      counts.scanned += 1;
      last = docSnap;
      const data = docSnap.data();
      const patch = patchFor(collectionName, data, identityIndex);
      if (!data.restaurantId && !data.workspaceId) counts.malformed += 1;
      if (patch.scheduleIdentityMigrationStatus === 'manual_resolution_required') {
        counts.manualResolutionRequired += 1;
        if (manualResolution.length < 250) manualResolution.push({ id: docSnap.id, restaurantId: restaurantIdFor(data), reason: patch.scheduleIdentityMigrationReason, legacy: { employeeId: data.employeeId || '', userId: data.userId || '', rosterUserId: data.rosterUserId || '', email: data.employeeEmail || data.assignedEmail || '' } });
      }
      if (!hasDiff(data, patch)) { counts.alreadyCorrect += 1; return; }
      counts.wouldUpdate += 1;
      if (!dryRun) { batch.update(docSnap.ref, patch); writes += 1; }
    });
    if (!dryRun && writes) { await batch.commit(); counts.updated += writes; }
  }
  return { ...counts, manualResolution };
}
async function main() {
  const projectId = requireProject();
  const dryRun = !hasFlag('execute');
  const app = getAdminAppForProject(projectId, { requireCredentials: true });
  const db = app.firestore();
  const identityIndex = await buildIdentityIndex(db);
  const result = { ok: true, projectId, dryRun, collections: {} };
  for (const name of TARGET_COLLECTIONS) result.collections[name] = await migrateCollection(db, name, dryRun, identityIndex);
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; });

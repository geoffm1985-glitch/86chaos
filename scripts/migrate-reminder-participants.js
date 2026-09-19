#!/usr/bin/env node
'use strict';

const { getAdminAppForProject, TRUSTED_PROJECTS } = require('../api/_firebase-project-admin');

const BATCH_LIMIT = 400;
function arg(name, fallback = '') { const prefix = `--${name}=`; const found = process.argv.find(v => v.startsWith(prefix)); return found ? found.slice(prefix.length) : fallback; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function requireProject() {
  const projectId = arg('project', process.env.FIREBASE_PROJECT_ID || '');
  if (!TRUSTED_PROJECTS.includes(projectId)) throw new Error(`Refusing participant migration for unknown Firebase project "${projectId || '(missing)'}".`);
  if (projectId === 'cheers-34b8d' && arg('confirm-production') !== 'MIGRATE REMINDER PARTICIPANTS') throw new Error('Production participant migration requires --confirm-production="MIGRATE REMINDER PARTICIPANTS".');
  return projectId;
}
function participantIds(data) {
  const creator = String(data.createdBy || data.userId || '').trim();
  const assigned = String(data.assignedToUserId || data.assigneeId || '').trim();
  const ids = [];
  if (creator) ids.push(creator);
  if (assigned && assigned !== creator) ids.push(assigned);
  return Array.from(new Set(ids)).slice(0, 2);
}
async function isActiveTenantMember(db, userId, restaurantId) {
  if (!userId || !restaurantId) return false;
  const userSnap = await db.collection('users').doc(userId).get();
  if (userSnap.exists) {
    const user = userSnap.data() || {};
    if (user.disabled !== true && user.isActive !== false && (
      [user.restaurantId, user.activeRestaurantId, user.defaultRestaurantId].some(id => String(id || '') === String(restaurantId)) ||
      (Array.isArray(user.workspaceIds) && user.workspaceIds.map(String).includes(String(restaurantId))) ||
      (user.memberships && typeof user.memberships === 'object' && user.memberships[restaurantId] && user.memberships[restaurantId].isActive !== false)
    )) return true;
  }
  for (const field of ['userId','uid','authUid']) {
    const snap = await db.collection('workspaceMembers').where('restaurantId','==',restaurantId).where(field,'==',userId).limit(1).get();
    if (!snap.empty && snap.docs[0].data()?.isActive !== false) return true;
  }
  return false;
}

function terminalAtFor(data = {}) {
  const status = String(data.status || '').toLowerCase();
  if (!['sent','done','completed','dismissed','archived','cancelled','canceled'].includes(status)) return data.terminalAt || null;
  return data.terminalAt || data.completedAt || data.dispatchedAt || data.cancelledAt || data.dismissedAt || data.archivedAt || data.updatedAt || null;
}
function arraysEqual(a, b) { return JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort()); }
async function main() {
  const projectId = requireProject();
  const dryRun = !hasFlag('execute');
  const app = getAdminAppForProject(projectId, { requireCredentials: true });
  const db = app.firestore();
  const counts = { scanned: 0, alreadyCorrect: 0, wouldUpdate: 0, updated: 0, malformed: 0 };
  let last = null;
  for (;;) {
    let q = db.collection('personalReminders').orderBy('__name__').limit(BATCH_LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    let writes = 0;
    for (const docSnap of snap.docs) {
      counts.scanned += 1;
      last = docSnap;
      const data = docSnap.data() || {};
      const ids = participantIds(data);
      const restaurantId = String(data.restaurantId || data.workspaceId || '').trim();
      if (!ids.length || !restaurantId) { counts.malformed += 1; continue; }
      const valid = [];
      for (const id of ids) if (await isActiveTenantMember(db, id, restaurantId)) valid.push(id);
      const creator = String(data.createdBy || data.userId || '').trim();
      if (!creator || !valid.includes(creator) || valid.length !== ids.length) { counts.malformed += 1; continue; }
      const terminalAt = terminalAtFor(data);
      const patch = { participantUserIds: valid.slice(0, 2), participantSchemaVersion: 1 };
      if (terminalAt && data.terminalAt !== terminalAt) patch.terminalAt = terminalAt;
      if (arraysEqual(data.participantUserIds, patch.participantUserIds) && data.participantSchemaVersion === 1 && (!terminalAt || data.terminalAt === terminalAt)) { counts.alreadyCorrect += 1; continue; }
      counts.wouldUpdate += 1;
      if (!dryRun) { batch.update(docSnap.ref, patch); writes += 1; }
    }
    if (!dryRun && writes) { await batch.commit(); counts.updated += writes; }
  }
  console.log(JSON.stringify({ ok: true, projectId, dryRun, personalReminders: counts }, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; });

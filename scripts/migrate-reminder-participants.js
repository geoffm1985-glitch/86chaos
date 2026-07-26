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
  const ids = [data.userId, data.createdBy, data.assignedToUserId, data.assigneeId, data.ownerId];
  if (Array.isArray(data.sharedWithUserIds)) ids.push(...data.sharedWithUserIds);
  if (Array.isArray(data.participantUserIds)) ids.push(...data.participantUserIds);
  return Array.from(new Set(ids.map(v => String(v || '').trim()).filter(Boolean))).slice(0, 50);
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
    snap.docs.forEach(docSnap => {
      counts.scanned += 1;
      last = docSnap;
      const data = docSnap.data();
      const ids = participantIds(data);
      if (!ids.length) counts.malformed += 1;
      if (arraysEqual(data.participantUserIds, ids)) { counts.alreadyCorrect += 1; return; }
      counts.wouldUpdate += 1;
      if (!dryRun) { batch.update(docSnap.ref, { participantUserIds: ids }); writes += 1; }
    });
    if (!dryRun && writes) { await batch.commit(); counts.updated += writes; }
  }
  console.log(JSON.stringify({ ok: true, projectId, dryRun, personalReminders: counts }, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; });

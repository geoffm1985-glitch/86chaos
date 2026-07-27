#!/usr/bin/env node
'use strict';
const { getAdminAppForProject, TRUSTED_PROJECTS } = require('../api/_firebase-project-admin');
const LIMIT = 350;
const cleanId = value => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
const canonicalId = (uid, restaurantId) => `${cleanId(uid)}_${cleanId(restaurantId)}`.slice(0, 240);
const arg = (name, fallback = '') => { const prefix = `--${name}=`; const row = process.argv.find(v => v.startsWith(prefix)); return row ? row.slice(prefix.length) : fallback; };
const execute = process.argv.includes('--execute');
async function main() {
  const projectId = arg('project', process.env.FIREBASE_PROJECT_ID || '');
  if (!TRUSTED_PROJECTS.includes(projectId)) throw new Error(`Refusing workspace membership migration for unknown project "${projectId || '(missing)'}".`);
  if (projectId === 'cheers-34b8d' && arg('confirm-production') !== 'MIGRATE WORKSPACE MEMBERSHIPS') throw new Error('Production migration requires --confirm-production="MIGRATE WORKSPACE MEMBERSHIPS".');
  const app = getAdminAppForProject(projectId, { requireCredentials: true });
  const db = app.firestore();
  const result = { ok:true, projectId, dryRun:!execute, scanned:0, alreadyCanonical:0, wouldWrite:0, written:0, ambiguous:[] };
  let last = null;
  for (;;) {
    let q = db.collection('workspaceMembers').orderBy('__name__').limit(LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch(); let writes = 0;
    for (const row of snap.docs) {
      result.scanned += 1; last = row;
      const data = row.data() || {};
      const uid = String(data.userId || data.uid || data.authUid || '').trim();
      const restaurantId = String(data.restaurantId || data.workspaceId || '').trim();
      if (!uid || !restaurantId) { if (result.ambiguous.length < 250) result.ambiguous.push({ id:row.id, reason:'missing userId or restaurantId' }); continue; }
      const id = canonicalId(uid, restaurantId);
      if (row.id === id && data.userId === uid && data.restaurantId === restaurantId) { result.alreadyCanonical += 1; continue; }
      result.wouldWrite += 1;
      if (execute) {
        const target = db.collection('workspaceMembers').doc(id);
        batch.set(target, { ...data, id, membershipId:id, userId:uid, restaurantId, workspaceId:restaurantId, membershipSchemaVersion:1, migratedAt:new Date().toISOString() }, { merge:true });
        if (row.id !== id) batch.delete(row.ref);
        writes += row.id === id ? 1 : 2;
      }
    }
    if (execute && writes) { await batch.commit(); result.written += writes; }
    if (snap.size < LIMIT) break;
  }
  console.log(JSON.stringify(result,null,2));
}
main().catch(error => { console.error(JSON.stringify({ok:false,error:error.message},null,2)); process.exitCode=1; });

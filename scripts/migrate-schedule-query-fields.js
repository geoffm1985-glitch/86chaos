#!/usr/bin/env node
'use strict';

const { getAdminAppForProject, TRUSTED_PROJECTS } = require('../api/_firebase-project-admin');

const BATCH_LIMIT = 400;

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
function patchFor(collectionName, data) {
  const patch = {};
  if (!data.restaurantId && data.workspaceId) patch.restaurantId = data.workspaceId;
  if (collectionName === 'shifts') {
    const date = normalizeDate(data.date || data.scheduleDateKey || data.shiftDate || data.day);
    if (date && data.date !== date) patch.date = date;
  }
  if (collectionName === 'timeOffRequests') {
    const date = normalizeDate(data.date || data.startDate || data.requestedDate || data.day);
    if (date && data.date !== date) patch.date = date;
  }
  return patch;
}
function hasDiff(before, patch) {
  return Object.entries(patch).some(([key, value]) => before[key] !== value);
}
async function migrateCollection(db, collectionName, dryRun) {
  const counts = { scanned: 0, malformed: 0, alreadyCorrect: 0, wouldUpdate: 0, updated: 0 };
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
      const patch = patchFor(collectionName, data);
      if (!data.restaurantId && !data.workspaceId) counts.malformed += 1;
      if (!hasDiff(data, patch)) { counts.alreadyCorrect += 1; return; }
      counts.wouldUpdate += 1;
      if (!dryRun) { batch.update(docSnap.ref, patch); writes += 1; }
    });
    if (!dryRun && writes) { await batch.commit(); counts.updated += writes; }
  }
  return counts;
}
async function main() {
  const projectId = requireProject();
  const dryRun = !hasFlag('execute');
  const app = getAdminAppForProject(projectId, { requireCredentials: true });
  const db = app.firestore();
  const result = { ok: true, projectId, dryRun, collections: {} };
  for (const name of ['shifts', 'timeOffRequests']) result.collections[name] = await migrateCollection(db, name, dryRun);
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; });

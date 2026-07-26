#!/usr/bin/env node
'use strict';

const { getAdminAppForProject, TRUSTED_PROJECTS } = require('../api/_firebase-project-admin');

const BATCH_LIMIT = 400;
const NOW_ISO = new Date().toISOString();

function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find(v => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function requireProject() {
  const projectId = arg('project', process.env.FIREBASE_PROJECT_ID || '');
  if (!TRUSTED_PROJECTS.includes(projectId)) {
    throw new Error(`Refusing reminder migration for unknown Firebase project "${projectId || '(missing)'}".`);
  }
  if (projectId === 'cheers-34b8d' && arg('confirm-production') !== 'MIGRATE REMINDER DISPATCH QUEUE') {
    throw new Error('Production reminder migration requires --confirm-production="MIGRATE REMINDER DISPATCH QUEUE".');
  }
  return projectId;
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function computeDispatchPatch(reminder = {}) {
  const status = normalizeStatus(reminder.status);
  const cancelled = status === 'cancelled' || status === 'canceled' || status === 'done' || status === 'completed' || status === 'dismissed' || reminder.cancelledAt || reminder.completedAt;
  if (cancelled) {
    return {
      dispatchEligible: false,
      nextDispatchAt: null,
      dispatchAttemptAt: reminder.dispatchAttemptAt || null,
      dispatchLeaseUntil: null,
      dispatchKey: reminder.dispatchKey || `${reminder.restaurantId || 'global'}:${reminder.userId || reminder.createdBy || 'unknown'}:${reminder.scheduledAt || reminder.id || ''}`
    };
  }
  const next = reminder.nextDispatchAt || reminder.snoozedUntil || reminder.nextReminderAt || reminder.scheduledAt || reminder.dueAt || '';
  return {
    dispatchEligible: !!next,
    nextDispatchAt: next || null,
    dispatchAttemptAt: reminder.dispatchAttemptAt || null,
    dispatchLeaseUntil: null,
    dispatchKey: reminder.dispatchKey || `${reminder.restaurantId || 'global'}:${reminder.userId || reminder.createdBy || 'unknown'}:${next || reminder.id || ''}`
  };
}

function meaningfulDiff(before, patch) {
  return Object.entries(patch).some(([key, value]) => {
    const current = before[key] === undefined ? null : before[key];
    return JSON.stringify(current) !== JSON.stringify(value);
  });
}

async function migrateCollection(db, collectionName, dryRun) {
  const counts = { scanned: 0, alreadyCorrect: 0, wouldUpdate: 0, updated: 0, malformed: 0, statuses: {} };
  let last = null;
  for (;;) {
    let q = db.collection(collectionName).orderBy('__name__').limit(BATCH_LIMIT);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    let batchWrites = 0;
    snap.docs.forEach(docSnap => {
      counts.scanned += 1;
      last = docSnap;
      const data = { id: docSnap.id, ...docSnap.data() };
      const status = normalizeStatus(data.status) || '(blank)';
      counts.statuses[status] = (counts.statuses[status] || 0) + 1;
      if (!data.scheduledAt && !data.nextReminderAt && !data.nextDispatchAt && !data.dueAt) counts.malformed += 1;
      const patch = computeDispatchPatch(data);
      if (!meaningfulDiff(data, patch)) {
        counts.alreadyCorrect += 1;
        return;
      }
      counts.wouldUpdate += 1;
      if (!dryRun) {
        batch.update(docSnap.ref, patch);
        batchWrites += 1;
      }
    });
    if (!dryRun && batchWrites) {
      await batch.commit();
      counts.updated += batchWrites;
    }
  }
  return counts;
}

async function main() {
  const projectId = requireProject();
  const dryRun = !hasFlag('execute');
  const app = getAdminAppForProject(projectId, { requireCredentials: true });
  const db = app.firestore();
  const result = { ok: true, projectId, dryRun, generatedAt: NOW_ISO, collections: {} };
  result.collections.personalReminders = await migrateCollection(db, 'personalReminders', dryRun);
  result.collections.eventReminders = await migrateCollection(db, 'eventReminders', dryRun);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

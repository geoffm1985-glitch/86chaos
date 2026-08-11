#!/usr/bin/env node
'use strict';

const { getAdminAppForProject, TRUSTED_PROJECTS } = require('../api/_firebase-project-admin');

const PAGE_SIZE = 450;
function arg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find(v => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return '';
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}
function monthFromDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : ''; }
function envClass(projectId) {
  if (projectId === 'chaos-test-d1601') return 'qa-test';
  if (projectId === 'cheers-34b8d') return 'production-read-only';
  return 'unknown-refused';
}
function requireProject() {
  const projectId = arg('project', process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '');
  if (!TRUSTED_PROJECTS.includes(projectId)) throw new Error(`READ ONLY schedule audit refused unknown Firebase project "${projectId || '(missing)'}".`);
  return projectId;
}
async function readAllShifts(db) {
  const rows = [];
  let last = null;
  for (;;) {
    let q = db.collection('shifts').orderBy('__name__').limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    rows.push(...snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }
  return rows;
}
function analyze(rows) {
  const stats = {
    totalShiftRecordsInspected: rows.length,
    missingScheduleUserId: 0,
    missingCanonicalDate: 0,
    missingScheduleDateKey: 0,
    missingScheduleMonth: 0,
    conflictingDateVersusScheduleDateKey: 0,
    conflictingIdentityFields: 0,
    unresolvedEmployees: 0,
    duplicateOrAmbiguousIdentities: 0,
    malformedDates: 0,
    legacyIdentityAliasUsage: 0,
    legacyDateFieldUsage: 0,
    unsafeForAutomaticNormalization: 0,
    examples: []
  };
  const seenIdentityByDate = new Map();
  const remember = (row, reason) => {
    if (stats.examples.length < 25) stats.examples.push({ id: row.id, reason });
  };
  rows.forEach(row => {
    const date = normalizeDate(row.date || row.shiftDate || row.scheduleDate || '');
    const keyDate = normalizeDate(row.scheduleDateKey || '');
    const identity = String(row.scheduleUserId || row.employeeId || row.userId || row.uid || row.authUid || row.staffId || '').trim();
    if (!row.scheduleUserId) { stats.missingScheduleUserId += 1; remember(row, 'missing scheduleUserId'); }
    if (!date) { stats.missingCanonicalDate += 1; stats.malformedDates += 1; remember(row, 'missing/malformed canonical date'); }
    if (!row.scheduleDateKey) { stats.missingScheduleDateKey += 1; remember(row, 'missing scheduleDateKey'); }
    if (date && keyDate && date !== keyDate) { stats.conflictingDateVersusScheduleDateKey += 1; remember(row, 'date conflicts with scheduleDateKey'); }
    if (!row.scheduleMonth && monthFromDate(date || keyDate)) { stats.missingScheduleMonth += 1; }
    if (!identity) { stats.unresolvedEmployees += 1; remember(row, 'unresolved employee identity'); }
    const ids = [row.scheduleUserId, row.employeeId, row.userId, row.uid, row.authUid, row.staffId].filter(Boolean).map(String);
    if (new Set(ids).size > 1) stats.conflictingIdentityFields += 1;
    if (!row.scheduleUserId && (row.employeeId || row.userId || row.uid || row.authUid || row.staffId)) stats.legacyIdentityAliasUsage += 1;
    if (!row.date && (row.shiftDate || row.scheduleDate || row.scheduleDateKey)) stats.legacyDateFieldUsage += 1;
    const dedupeKey = `${row.restaurantId || row.workspaceId || ''}|${identity}|${date || keyDate}|${row.startTime || ''}|${row.endTime || ''}`;
    if (dedupeKey.replace(/\|/g, '')) {
      if (seenIdentityByDate.has(dedupeKey)) { stats.duplicateOrAmbiguousIdentities += 1; remember(row, 'duplicate/ambiguous schedule identity/date/time'); }
      else seenIdentityByDate.set(dedupeKey, row.id);
    }
    if (!row.scheduleUserId || !date || !row.scheduleDateKey || (date && keyDate && date !== keyDate) || !identity || new Set(ids).size > 1) stats.unsafeForAutomaticNormalization += 1;
  });
  return stats;
}
async function main() {
  const projectId = requireProject();
  const app = getAdminAppForProject(projectId);
  const db = app.firestore();
  console.log('86 Chaos schedule query-field audit');
  console.log(`Project: ${projectId}`);
  console.log(`Environment: ${envClass(projectId)}`);
  console.log('READ ONLY: true');
  console.log('Mutation capability: none');
  const rows = await readAllShifts(db);
  const stats = analyze(rows);
  console.log(JSON.stringify({ ok: true, projectId, environment: envClass(projectId), readOnly: true, stats }, null, 2));
}
if (require.main === module) main().catch(err => { console.error(err?.message || err); process.exit(1); });
module.exports = { normalizeDate, analyze, envClass };

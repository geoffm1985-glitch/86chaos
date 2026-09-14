const { admin, initAdmin, readBody, authorize, clean } = require('./_chaos-admin');
const { classifyScheduleIntegrityRecords } = require('../src/core/scheduleIntegrity.shared.js');

const MAX_PAGE_SIZE = 200;
const MAX_WINDOW_ROWS_PER_QUERY = 300;
const MAX_IDENTITY_ROWS_PER_QUERY = 500;

const clamp = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.parseInt(value, 10) || fallback));

function mapDocument(docSnap, source) {
  return { id: docSnap.id, ...(docSnap.data() || {}), _auditSources: [source] };
}

function mergeRawRows(rows = []) {
  const byId = new Map();
  rows.forEach(row => {
    const previous = byId.get(row.id);
    if (!previous) byId.set(row.id, row);
    else byId.set(row.id, { ...previous, _auditSources: [...new Set([...(previous._auditSources || []), ...(row._auditSources || [])])] });
  });
  return [...byId.values()];
}

async function readCompleteShiftPage(db, restaurantId, pageSize, cursor = {}) {
  const plans = [
    { key: 'restaurantId', field: 'restaurantId' },
    { key: 'workspaceId', field: 'workspaceId' }
  ];
  const rows = [];
  const failures = [];
  const nextCursor = {};
  let complete = true;
  let queryAttempts = 0;
  let querySuccesses = 0;
  let documentsReturned = 0;
  let redactedScopeConflicts = 0;
  for (const plan of plans) {
    const streamCursor = cursor?.[plan.key] && typeof cursor[plan.key] === 'object'
      ? cursor[plan.key]
      : { after: clean(cursor?.[plan.key] || ''), done: false };
    if (streamCursor.done === true) {
      nextCursor[plan.key] = { after: clean(streamCursor.after || ''), done: true };
      continue;
    }
    try {
      queryAttempts += 1;
      let query = db.collection('shifts').where(plan.field, '==', restaurantId).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
      if (streamCursor.after) query = query.startAfter(clean(streamCursor.after));
      const snap = await query.get();
      querySuccesses += 1;
      documentsReturned += snap.docs.length;
      const scopedDocs = plan.field === 'workspaceId'
        ? snap.docs.filter(docSnap => {
            const primaryTenant = clean(docSnap.data()?.restaurantId || '');
            if (primaryTenant && primaryTenant !== restaurantId) redactedScopeConflicts += 1;
            return !primaryTenant;
          })
        : snap.docs;
      rows.push(...scopedDocs.map(docSnap => mapDocument(docSnap, `complete:${plan.field}`)));
      if (snap.docs.length === pageSize) {
        complete = false;
        nextCursor[plan.key] = { after: snap.docs[snap.docs.length - 1].id, done: false };
      } else nextCursor[plan.key] = { after: snap.docs[snap.docs.length - 1]?.id || streamCursor.after || '', done: true };
    } catch (err) {
      complete = false;
      nextCursor[plan.key] = { after: streamCursor.after || '', done: false };
      failures.push({ stage: `shift:${plan.field}`, message: err?.message || String(err) });
    }
  }
  const allDone = plans.every(plan => nextCursor[plan.key]?.done === true);
  return { rows: mergeRawRows(rows), failures, complete: complete && allDone && redactedScopeConflicts === 0, nextCursor: allDone ? null : nextCursor, queryAttempts, querySuccesses, documentsReturned, redactedScopeConflicts };
}

async function readWindowShifts(db, restaurantId, startDate, endDate) {
  const plans = [
    { key: 'restaurant-date', tenantField: 'restaurantId', dateField: 'date', visibility: 'canonical' },
    { key: 'restaurant-scheduleDateKey', tenantField: 'restaurantId', dateField: 'scheduleDateKey', visibility: 'rescue' },
    { key: 'workspace-date', tenantField: 'workspaceId', dateField: 'date', visibility: 'canonical' },
    { key: 'workspace-scheduleDateKey', tenantField: 'workspaceId', dateField: 'scheduleDateKey', visibility: 'rescue' }
  ];
  const rows = [];
  const failures = [];
  let complete = true;
  let queryAttempts = 0;
  let querySuccesses = 0;
  let documentsReturned = 0;
  let redactedScopeConflicts = 0;
  for (const plan of plans) {
    try {
      queryAttempts += 1;
      const snap = await db.collection('shifts')
        .where(plan.tenantField, '==', restaurantId)
        .where(plan.dateField, '>=', startDate)
        .where(plan.dateField, '<=', endDate)
        .limit(MAX_WINDOW_ROWS_PER_QUERY)
        .get();
      querySuccesses += 1;
      documentsReturned += snap.docs.length;
      const scopedDocs = plan.tenantField === 'workspaceId'
        ? snap.docs.filter(docSnap => {
            const primaryTenant = clean(docSnap.data()?.restaurantId || '');
            if (primaryTenant && primaryTenant !== restaurantId) redactedScopeConflicts += 1;
            return !primaryTenant;
          })
        : snap.docs;
      rows.push(...scopedDocs.map(docSnap => mapDocument(docSnap, `window:${plan.key}:${plan.visibility}`)));
      if (snap.docs.length === MAX_WINDOW_ROWS_PER_QUERY) complete = false;
    } catch (err) {
      complete = false;
      failures.push({ stage: `shift:${plan.key}`, message: err?.message || String(err) });
    }
  }
  return { rows: mergeRawRows(rows), failures, complete: complete && redactedScopeConflicts === 0, nextCursor: null, queryAttempts, querySuccesses, documentsReturned, redactedScopeConflicts };
}

async function readAuthorizedPeople(db, restaurantId) {
  const plans = [
    { key: 'users-primary', build: () => db.collection('users').where('restaurantId', '==', restaurantId).limit(MAX_IDENTITY_ROWS_PER_QUERY) },
    { key: 'users-workspaceIds', build: () => db.collection('users').where('workspaceIds', 'array-contains', restaurantId).limit(MAX_IDENTITY_ROWS_PER_QUERY) },
    { key: 'workspaceMembers', build: () => db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).limit(MAX_IDENTITY_ROWS_PER_QUERY) }
  ];
  const people = [];
  const failures = [];
  let complete = true;
  let queryAttempts = 0;
  let querySuccesses = 0;
  let documentsReturned = 0;
  for (const plan of plans) {
    try {
      queryAttempts += 1;
      const snap = await plan.build().get();
      querySuccesses += 1;
      documentsReturned += snap.docs.length;
      people.push(...snap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}), identitySource: plan.key })));
      if (snap.docs.length === MAX_IDENTITY_ROWS_PER_QUERY) complete = false;
    } catch (err) {
      complete = false;
      failures.push({ stage: `identity:${plan.key}`, message: err?.message || String(err) });
    }
  }
  const byPerson = new Map();
  people.forEach(person => {
    const durable = clean(person.userId || person.uid || person.authUid || person.accountUserId || '');
    const key = durable ? `user:${durable}` : person.identitySource.startsWith('users-') ? `user:${person.id}` : `membership:${person.id}`;
    const previous = byPerson.get(key);
    if (!previous) {
      byPerson.set(key, { ...person, identitySources: [person.identitySource] });
      return;
    }
    byPerson.set(key, {
      ...previous,
      ...person,
      id: previous.id || person.id,
      identitySources: [...new Set([...(previous.identitySources || []), person.identitySource])],
      isActive: previous.isActive === false || person.isActive === false ? false : previous.isActive ?? person.isActive
    });
  });
  const unique = [...byPerson.values()];
  return { people: unique, failures, complete, queryAttempts, querySuccesses, documentsReturned };
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  const startedAt = Date.now();
  try {
    const app = initAdmin(req);
    const body = await readBody(req);
    const restaurantId = clean(body.restaurantId || '');
    const mode = clean(body.mode || 'window').toLowerCase() === 'complete' ? 'complete' : 'window';
    if (!restaurantId) return res.status(400).json({ ok: false, error: 'Choose a workspace before running Schedule Integrity Audit.' });
    const auth = await authorize(req, app, { allowTenantAdmin: true, targetRestaurantId: restaurantId });
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    const db = app.firestore();
    const pageSize = clamp(body.pageSize, 100, 10, MAX_PAGE_SIZE);
    const startDate = clean(body.startDate || '');
    const endDate = clean(body.endDate || '');
    if (mode === 'window' && (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate)) {
      return res.status(400).json({ ok: false, error: 'Window audit requires a valid startDate and endDate.' });
    }

    const [shiftRead, identityRead] = await Promise.all([
      mode === 'complete'
        ? readCompleteShiftPage(db, restaurantId, pageSize, body.cursor || {})
        : readWindowShifts(db, restaurantId, startDate, endDate),
      readAuthorizedPeople(db, restaurantId)
    ]);
    const lookupFailures = [...shiftRead.failures, ...identityRead.failures];
    const scanComplete = shiftRead.complete === true;
    const identityLookupComplete = identityRead.complete === true;
    const results = classifyScheduleIntegrityRecords(shiftRead.rows, {
      restaurantId,
      people: identityRead.people,
      scanComplete,
      identityLookupComplete,
      lookupFailures
    }).map((result, index) => {
      const raw = shiftRead.rows[index] || {};
      const sources = raw._auditSources || [];
      return {
        ...result,
        evidence: {
          ...result.evidence,
          visibility: {
            ...result.evidence.visibility,
            canonical: sources.some(source => source.endsWith(':canonical') || source.includes('complete:')),
            rescue: sources.some(source => source.endsWith(':rescue'))
          },
          querySources: sources
        }
      };
    });
    const counts = results.reduce((acc, row) => { acc[row.classification] = (acc[row.classification] || 0) + 1; return acc; }, {});
    return res.status(200).json({
      ok: true,
      readOnly: true,
      writesPerformed: 0,
      mode,
      restaurantId,
      requestedWindow: mode === 'window' ? { startDate, endDate } : null,
      scanComplete,
      identityLookupComplete,
      complete: scanComplete && identityLookupComplete && lookupFailures.length === 0 && !shiftRead.nextCursor,
      cursor: body.cursor || null,
      nextCursor: shiftRead.nextCursor,
      pageSize: mode === 'complete' ? pageSize : null,
      limitations: [
        'Tenant-scoped audit cannot discover records that have neither restaurantId nor workspaceId.',
        mode === 'window' ? 'Window audit may not discover malformed records outside retrievable date shapes.' : null,
        'Classification never authorizes repair, deletion, merge, or migration.'
      ].filter(Boolean),
      redactedScopeConflicts: shiftRead.redactedScopeConflicts || 0,
      lookupFailures,
      counts,
      results,
      operationEvidence: {
        sdkQueryAttempts: shiftRead.queryAttempts + identityRead.queryAttempts,
        sdkQuerySuccesses: shiftRead.querySuccesses + identityRead.querySuccesses,
        scheduleQueryAttempts: shiftRead.queryAttempts,
        scheduleQuerySuccesses: shiftRead.querySuccesses,
        identityQueryAttempts: identityRead.queryAttempts,
        identityQuerySuccesses: identityRead.querySuccesses,
        scheduleDocumentsReturned: shiftRead.documentsReturned,
        uniqueScheduleRecords: shiftRead.rows.length,
        redactedScopeConflicts: shiftRead.redactedScopeConflicts || 0,
        identityDocumentsReturned: identityRead.documentsReturned,
        uniqueIdentityRecords: identityRead.people.length,
        writes: 0,
        pages: 1,
        lookupFailures: lookupFailures.length,
        billingClaim: 'Operation and observed-document evidence only; not an exact Firestore billing calculation.'
      },
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt
    });
  } catch (err) {
    return res.status(500).json({ ok: false, readOnly: true, writesPerformed: 0, error: err?.message || String(err), durationMs: Date.now() - startedAt });
  }
}

handler._test = { mergeRawRows, readCompleteShiftPage, readWindowShifts, readAuthorizedPeople };
module.exports = handler;

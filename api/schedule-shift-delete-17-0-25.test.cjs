'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function makeDb(initial = {}) {
  const rows = new Map(Object.entries(initial));
  const metrics = { queryGets: 0, docGets: 0, batchCommits: 0 };
  const docSnap = (id, data) => ({ id, exists: Boolean(data), data: () => data });
  const collection = (name) => {
    if (name !== 'shifts') throw new Error(`Unexpected collection ${name}`);
    return {
      doc(id) {
        return {
          id,
          path: `shifts/${id}`,
          async get() { metrics.docGets += 1; return docSnap(id, rows.get(id)); }
        };
      },
      where(field, op, value) {
        assert.equal(op, '==');
        return {
          async get() {
            metrics.queryGets += 1;
            const docs = [...rows.entries()]
              .filter(([, data]) => data?.[field] === value)
              .map(([id, data]) => docSnap(id, data));
            return { docs };
          }
        };
      }
    };
  };
  return {
    rows,
    metrics,
    collection,
    batch() {
      const deletes = [];
      return {
        delete(ref) { deletes.push(ref.id); },
        async commit() { metrics.batchCommits += 1; for (const id of deletes) rows.delete(id); }
      };
    }
  };
}

function loadHandler(db, role = { permissions: { schedule: true }, user: { isAdmin: true } }) {
  const adminPath = require.resolve('./_chaos-admin.js');
  const routePath = require.resolve('./schedule-shift-delete.js');
  const original = require.cache[adminPath];
  require.cache[adminPath] = {
    id: adminPath,
    filename: adminPath,
    loaded: true,
    exports: {
      initAdmin: () => ({ firestore: () => db }),
      authorize: async () => ({ ok: true, status: 200, restaurantId: 'rest-a', db, app: {}, permissions: role.permissions || {}, user: role.user || {}, isSuperAdmin: role.isSuperAdmin === true, email: 'manager@example.test', uid: 'manager' }),
      requireAppCheckIfEnforced: async () => ({ ok: true }),
      writeAudit: async () => {},
      clean: value => String(value || '').trim(),
    }
  };
  delete require.cache[routePath];
  const handler = require('./schedule-shift-delete.js');
  return {
    handler,
    restore() {
      delete require.cache[routePath];
      if (original) require.cache[adminPath] = original;
      else delete require.cache[adminPath];
    }
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function call(handler, body) {
  const res = response();
  await handler({ method: 'POST', headers: {}, body }, res);
  return res;
}

test('17.0.25 Clear Month counts and removes restaurantId, workspaceId, and tenantId legacy shifts only in the requested month', async () => {
  const db = makeDb({
    canonical: { restaurantId: 'rest-a', date: '2026-10-05', employeeId: 'u1', startTime: '10:00', endTime: '18:00' },
    legacyWorkspace: { workspaceId: 'rest-a', scheduleDateKey: '2026-10-06', userId: 'u2', startTime: '11:00', endTime: '19:00' },
    legacyTenant: { tenantId: 'rest-a', scheduleMonth: '2026-10', employeeId: 'u3', startTime: '09:00', endTime: '17:00' },
    contradictoryLegacyAlias: { restaurantId: 'rest-old', workspaceId: 'rest-a', shiftDate: '10/07/2026', employeeId: 'u6', startTime: '12:00', endTime: '20:00' },
    nextMonth: { restaurantId: 'rest-a', date: '2026-11-01', employeeId: 'u4', startTime: '09:00', endTime: '17:00' },
    foreign: { restaurantId: 'rest-b', date: '2026-10-07', employeeId: 'u5', startTime: '09:00', endTime: '17:00' },
  });
  const loaded = loadHandler(db);
  try {
    const preview = await call(loaded.handler, { action: 'preview-month', restaurantId: 'rest-a', month: '2026-10' });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.body.count, 4);
    assert.equal(db.rows.size, 6, 'preview must not mutate');

    const cleared = await call(loaded.handler, { action: 'clear-month', restaurantId: 'rest-a', month: '2026-10' });
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.body.ok, true);
    assert.equal(cleared.body.deletedCount, 4);
    assert.equal(cleared.body.remainingCount, 0);
    assert.equal(db.metrics.queryGets, 6, 'preview uses three parallel tenant alias queries and clear performs one additional tenant scan only');
    assert.equal(db.metrics.batchCommits, 1, 'normal month clear commits one delete batch without redundant verification rescans');
    assert.equal(db.rows.has('canonical'), false);
    assert.equal(db.rows.has('legacyWorkspace'), false);
    assert.equal(db.rows.has('legacyTenant'), false);
    assert.equal(db.rows.has('contradictoryLegacyAlias'), false);
    assert.equal(db.rows.has('nextMonth'), true);
    assert.equal(db.rows.has('foreign'), true);
  } finally { loaded.restore(); }
});

test('17.0.25 single-shift delete removes hidden logical duplicates across canonical and legacy tenant identities without touching another employee', async () => {
  const db = makeDb({
    canonical: { restaurantId: 'rest-a', date: '2026-10-10', employeeId: 'u1', employeeName: 'Alex Cook', startTime: '10:00', endTime: '18:00' },
    legacyDuplicate: { workspaceId: 'rest-a', scheduleDateKey: '2026-10-10', userId: 'u1', userName: 'Alex Cook', startTime: '10:00', endTime: '18:00' },
    contradictoryAliasDuplicate: { restaurantId: 'rest-old', tenantId: 'rest-a', workDate: '10/10/2026', scheduleUserId: 'u1', assignedName: 'Alex Cook', startTime: '10:00', endTime: '18:00' },
    otherEmployee: { restaurantId: 'rest-a', date: '2026-10-10', employeeId: 'u2', employeeName: 'Sam Cook', startTime: '10:00', endTime: '18:00' },
  });
  const loaded = loadHandler(db);
  try {
    const result = await call(loaded.handler, {
      action: 'delete-single', restaurantId: 'rest-a', shiftId: 'canonical', dateKey: '2026-10-10',
      expectedShift: { employeeId: 'u1', employeeName: 'Alex Cook', startTime: '10:00', endTime: '18:00' }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.deletedCount, 3);
    assert.equal(result.body.remainingCount, 0);
    assert.equal(db.metrics.queryGets, 3, 'single delete scans the three tenant aliases once');
    assert.equal(db.metrics.docGets, 0, 'tenant scan supplies the authoritative shift row without an extra document read');
    assert.equal(db.metrics.batchCommits, 1);
    assert.equal(db.rows.has('canonical'), false);
    assert.equal(db.rows.has('legacyDuplicate'), false);
    assert.equal(db.rows.has('contradictoryAliasDuplicate'), false);
    assert.equal(db.rows.has('otherEmployee'), true);
  } finally { loaded.restore(); }
});

test('17.0.25 Schedule Builder routes month and single-shift deletes through the authenticated server delete boundary', () => {
  const schedule = fs.readFileSync(path.join(__dirname, '..', 'src/features/schedule.jsx'), 'utf8');
  assert.match(schedule, /secureFetch\('\/api\/schedule-shift-delete'/);
  assert.doesNotMatch(schedule, /scheduleShiftDeleteRequest\('preview-month'/);
  assert.match(schedule, /scheduleShiftDeleteRequest\('clear-month'/);
  assert.match(schedule, /scheduleShiftDeleteRequest\('delete-single'/);
  assert.match(schedule, /Delete ALL saved shifts from \$\{monthLabel\}/);
  assert.match(schedule, /optimisticOperationId/);
  assert.match(schedule, /handleDeleteSpecificShift/);
  assert.doesNotMatch(schedule, /deleteDoc\(doc\(db, ['"]shifts['"]/);
});

test('17.0.25 delete server parallelizes legacy tenant reads and does not re-authorize or rescan after a committed delete', () => {
  const route = fs.readFileSync(path.join(__dirname, 'schedule-shift-delete.js'), 'utf8');
  assert.match(route, /Promise\.all\(TENANT_FIELDS\.map/);
  assert.match(route, /return \{ initialCount, deletedCount, remainingCount: 0 \}/);
  assert.match(route, /return \{ deletedCount, remainingCount: 0, targetCount: unique\.length \}/);
  assert.equal((route.match(/let ctx = await authorizeSchedule\(\)/g) || []).length, 1);
  assert.doesNotMatch(route, /const fresh = await authorizeSchedule\(\)/);
});

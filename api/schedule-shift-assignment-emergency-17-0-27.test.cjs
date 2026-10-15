'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function makeDb() {
  const rows = new Map();
  const metrics = { commits: 0, sets: 0 };
  const receipts = new Map();let autoId=0;
  return {
    rows,
    metrics,
    collection(name) {
      return {
        doc(id) { return { id:id || `auto_${++autoId}`, path: `${name}/${id || `auto_${autoId}`}`,name }; }
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const tx={get:async ref=>{const store=ref.name==='shifts'?rows:receipts;const key=ref.name==='shifts'?ref.id:ref.path;return{exists:store.has(key),data:()=>store.get(key)};},create(ref,data){metrics.sets++;writes.push([ref,JSON.parse(JSON.stringify(data))]);}};
      const result=await callback(tx);if(writes.length){metrics.commits++;for(const [ref,data] of writes)(ref.name==='shifts'?rows:receipts).set(ref.name==='shifts'?ref.id:ref.path,data);}return result;
    }
  };
}

function loadHandler(db, role = { permissions: { schedule: true }, user: { isAdmin: true } }) {
  const adminPath = require.resolve('./_chaos-admin.js');
  const routePath = require.resolve('./schedule-shift-assign.js');
  const original = require.cache[adminPath];
  require.cache[adminPath] = {
    id: adminPath,
    filename: adminPath,
    loaded: true,
    exports: {
      initAdmin: () => ({ firestore: () => db }),
      authorize: async () => ({ ok: true, status: 200, restaurantId: 'rest-a', db, app: {}, permissions: role.permissions || {}, user: role.user || {}, isSuperAdmin: role.isSuperAdmin === true, email: 'manager@example.test', uid: 'manager-uid' }),
      requireAppCheckIfEnforced: async () => ({ ok: true }),
      writeAudit: async () => {},
      clean: value => String(value || '').trim(),
    }
  };
  delete require.cache[routePath];
  const handler = require('./schedule-shift-assign.js');
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

const assignment = {
  restaurantId: 'evil-tenant',
  workspaceId: 'evil-tenant',
  date: '2026-10-12',
  scheduleDateKey: '2026-10-12',
  scheduleMonth: '2026-10',
  scheduleUserId: 'employee-a',
  employeeId: 'employee-a',
  rosterUserId: 'employee-a',
  userId: 'auth-a',
  authUid: 'auth-a',
  accountUserId: 'auth-a',
  assignedUserId: 'employee-a',
  employeeName: 'Alex QA',
  assignedName: 'Alex QA',
  employeeEmail: 'alex@example.test',
  assignedEmail: 'alex@example.test',
  role: 'Kitchen',
  rosterRoleId: 'role-kitchen',
  rosterRoleNameSnapshot: 'Kitchen',
  startTime: '10:00',
  endTime: '18:00',
  isPublished: true,
  publishState: 'published',
  createdBy: 'attacker',
  updatedBy: 'attacker',
  assignmentSource: 'client-forged'
};

test('17.0.27 authenticated shift assignment creates canonical draft shifts and ignores client publication/tenant authority', async () => {
  const db = makeDb();
  const loaded = loadHandler(db);
  try {
    const result = await call(loaded.handler, { restaurantId: 'rest-a', operationId: 'qa-op-1', assignments: [assignment] });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.createdCount, 1);
    assert.equal(db.metrics.commits, 1);
    assert.equal(db.rows.size, 1);
    const [id, saved] = [...db.rows.entries()][0];
    assert.match(id, /^sb_[a-f0-9]{28}$/);
    assert.equal(saved.restaurantId, 'rest-a');
    assert.equal(saved.workspaceId, 'rest-a');
    assert.equal(saved.date, '2026-10-12');
    assert.equal(saved.scheduleDateKey, '2026-10-12');
    assert.equal(saved.scheduleMonth, '2026-10');
    assert.equal(saved.isPublished, false);
    assert.equal(saved.publishState, 'draft');
    assert.equal(saved.scheduleBuilderDraft, true);
    assert.equal(saved.readyToPublish, true);
    assert.equal(saved.createdBy, 'manager-uid');
    assert.equal(saved.updatedBy, 'manager-uid');
    assert.equal(saved.employeeId, 'employee-a');
    assert.equal(saved.role, 'Kitchen');
  } finally { loaded.restore(); }
});

test('17.0.27 assignment operation IDs are idempotent for an accidental request replay', async () => {
  const db = makeDb();
  const loaded = loadHandler(db);
  try {
    const body = { restaurantId: 'rest-a', operationId: 'same-operation', assignments: [assignment] };
    const first = await call(loaded.handler, body);
    const second = await call(loaded.handler, body);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.body.created[0].id, second.body.created[0].id);
    assert.equal(db.rows.size, 1, 'replaying one assignment operation must not create a duplicate shift document');
  } finally { loaded.restore(); }
});

test('17.0.27 assignment server requires actual Schedule Builder authority', async () => {
  const db = makeDb();
  const loaded = loadHandler(db, { permissions: {}, user: { isAdmin: false, isOwner: false } });
  try {
    const result = await call(loaded.handler, { restaurantId: 'rest-a', operationId: 'blocked-op', assignments: [assignment] });
    assert.equal(result.statusCode, 403);
    assert.equal(result.body.code, 'schedule_permission_required');
    assert.equal(db.rows.size, 0);
  } finally { loaded.restore(); }
});

test('assignment replay preserves a later published edit and altered operation intent is refused',async()=>{
  const db=makeDb(),loaded=loadHandler(db);
  try {
    const body={restaurantId:'rest-a',operationId:'replay-protection',assignments:[assignment]};
    const first=await call(loaded.handler,body),id=first.body.created[0].id;
    db.rows.set(id,{...db.rows.get(id),isPublished:true,revision:9,startTime:'11:00',notes:'Newer manager work'});
    const sets=db.metrics.sets,second=await call(loaded.handler,body);
    assert.equal(second.statusCode,200);assert.equal(second.body.duplicate,true);assert.equal(second.body.created[0].isPublished,true);assert.equal(db.metrics.sets,sets);assert.equal(db.rows.get(id).notes,'Newer manager work');
    const changed=await call(loaded.handler,{...body,assignments:[{...assignment,startTime:'12:00'}]});
    assert.equal(changed.statusCode,409);assert.equal(changed.body.code,'operation_reused');assert.equal(db.rows.size,1);
  }finally{loaded.restore();}
});

test('17.0.27 Schedule Builder assignment uses the authenticated server boundary, reports failure, and clears stale delete tombstones for re-added shifts', () => {
  const schedule = fs.readFileSync(path.join(__dirname, '..', 'src/features/schedule.jsx'), 'utf8');
  const start = schedule.indexOf('const handleAssign = async () =>');
  const end = schedule.indexOf('const saveReviewedRoles', start);
  assert(start >= 0 && end > start, 'handleAssign source block should be present');
  const block = schedule.slice(start, end);
  assert.match(block, /secureFetch\('\/api\/schedule-shift-assign'/);
  assert.match(block, /assignmentOperationId/);
  assert.match(block, /setLocalBuilderDeletedShiftMarkers\(prev => prev\.filter/);
  assert.match(block, /addToast\('Assignment Failed'/);
  assert.doesNotMatch(block, /addDoc\(collection\(db, ["']shifts["']/);
  assert.match(schedule, /data-testid="schedule-builder-assign"/);
  assert.match(schedule, /data-testid="schedule-builder-cell"/);
});

test('17.0.27 assignment browser coverage remains in the advancing current-release delta scope', () => {
  const scope = require('../scripts/86chaos-release-gate/current-release-repair-scope.cjs');
  const packageVersion = require('../package.json').version;
  assert.equal(scope.CURRENT_RELEASE_VERSION, packageVersion);
  assert(scope.CURRENT_RELEASE_REPAIR_SCOPE.length >= 4);
  const paths = new Set(scope.CURRENT_RELEASE_REPAIR_SCOPE.map(row => row.specPath));
  assert(paths.has('86chaos-new-implementations/08-phase1-spanish-interface.spec.cjs'));
  assert(paths.has('86chaos-new-implementations/09-schedule-builder-shift-assignment.spec.cjs'));
  const result = scope.resolveCurrentReleaseRepairScope({ currentRecords: scope.CURRENT_RELEASE_REPAIR_SCOPE });
  assert.equal(result.ok, true);
  assert.equal(result.totalSelected, scope.CURRENT_RELEASE_REPAIR_SCOPE.length);
  assert.deepEqual(new Set(result.selected.map(row => row.project)), new Set(['chromium', 'mobile-chromium']));
});

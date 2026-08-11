'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

function installFirebaseAdminStub() {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'firebase-admin') {
      return {
        apps: [],
        initializeApp: () => ({}),
        app: () => ({}),
        credential: { cert: value => value, applicationDefault: () => ({}) },
        firestore: {
          FieldValue: {
            serverTimestamp: () => 'SERVER_TIMESTAMP',
            delete: () => Symbol.for('delete'),
            arrayUnion: (...values) => ({ arrayUnion: values }),
            arrayRemove: (...values) => ({ arrayRemove: values })
          },
          Timestamp: { now: () => new Date('2026-08-10T00:00:00.000Z') }
        }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => { Module._load = originalLoad; };
}

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function setDotted(target, key, value) {
  if (!key.includes('.')) { target[key] = value; return; }
  const parts = key.split('.');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}
function mergePatch(target, patch) {
  for (const [key, value] of Object.entries(patch || {})) setDotted(target, key, clone(value));
}
class FakeDocSnapshot {
  constructor(id, ref, data) { this.id = id; this.ref = ref; this._data = data; this.exists = data !== undefined; }
  data() { return clone(this._data || {}); }
}
class FakeQuerySnapshot {
  constructor(docs) { this.docs = docs; this.empty = docs.length === 0; this.size = docs.length; }
  forEach(fn) { this.docs.forEach(fn); }
}
class FakeDocRef {
  constructor(db, collectionName, id) { this.db = db; this.collectionName = collectionName; this.id = id; }
  async get() { return new FakeDocSnapshot(this.id, this, this.db.get(this.collectionName, this.id)); }
  async set(patch, opts = {}) { this.db.set(this.collectionName, this.id, patch, opts); }
}
class FakeQuery {
  constructor(db, collectionName, filters = [], limitValue = Infinity, startAfterId = '', ordered = false) {
    this.db = db; this.collectionName = collectionName; this.filters = filters; this.limitValue = limitValue; this.startAfterId = startAfterId; this.ordered = ordered;
  }
  where(field, op, value) { return new FakeQuery(this.db, this.collectionName, [...this.filters, { field, op, value }], this.limitValue, this.startAfterId, this.ordered); }
  orderBy() { return new FakeQuery(this.db, this.collectionName, this.filters, this.limitValue, this.startAfterId, true); }
  limit(n) { return new FakeQuery(this.db, this.collectionName, this.filters, Number(n), this.startAfterId, this.ordered); }
  startAfter(doc) { return new FakeQuery(this.db, this.collectionName, this.filters, this.limitValue, doc?.id || String(doc || ''), this.ordered); }
  async get() {
    let rows = Array.from(this.db.data[this.collectionName]?.entries() || []);
    rows = rows.filter(([id, row]) => this.filters.every(filter => filter.op === '==' && row?.[filter.field] === filter.value));
    rows.sort((a, b) => a[0].localeCompare(b[0]));
    if (this.startAfterId) rows = rows.filter(([id]) => id > this.startAfterId);
    rows = rows.slice(0, this.limitValue);
    return new FakeQuerySnapshot(rows.map(([id, row]) => new FakeDocSnapshot(id, new FakeDocRef(this.db, this.collectionName, id), row)));
  }
}
class FakeCollectionRef extends FakeQuery {
  constructor(db, collectionName) { super(db, collectionName); }
  doc(id) { return new FakeDocRef(this.db, this.collectionName, id); }
  async add(data) { const id = `auto_${this.db.added.length + 1}`; this.db.set(this.collectionName, id, data, { merge: false }); this.db.added.push({ collectionName: this.collectionName, id, data: clone(data) }); return this.doc(id); }
}
class FakeBatch {
  constructor(db) { this.db = db; this.ops = []; }
  set(ref, patch, opts) { this.ops.push({ ref, patch: clone(patch), opts }); }
  async commit() {
    this.db.batchCommitCount += 1;
    if (this.db.failNextCommit) { this.db.failNextCommit = false; throw new Error('forced batch failure'); }
    for (const op of this.ops) this.db.set(op.ref.collectionName, op.ref.id, op.patch, op.opts || { merge: true });
  }
}
class FakeDB {
  constructor(seed = {}) {
    this.data = { users: new Map(), workspaceMembers: new Map(), restaurants: new Map(), auditLogs: new Map() };
    this.added = [];
    this.batchCommitCount = 0;
    this.failNextCommit = false;
    for (const [collectionName, rows] of Object.entries(seed)) {
      if (!this.data[collectionName]) this.data[collectionName] = new Map();
      for (const [id, row] of Object.entries(rows || {})) this.data[collectionName].set(id, clone(row));
    }
  }
  collection(name) { if (!this.data[name]) this.data[name] = new Map(); return new FakeCollectionRef(this, name); }
  batch() { return new FakeBatch(this); }
  get(collectionName, id) { return this.data[collectionName]?.get(id); }
  set(collectionName, id, patch, opts = {}) {
    if (!this.data[collectionName]) this.data[collectionName] = new Map();
    const current = opts.merge === false ? {} : clone(this.data[collectionName].get(id) || {});
    mergePatch(current, patch);
    this.data[collectionName].set(id, current);
  }
}
function makeAuth(db, options = {}) {
  const users = new Map(Object.entries(options.authUsers || {}));
  const updates = [];
  const authApi = {
    async getUser(uid) {
      if (options.getUserFails) throw new Error('forced auth lookup failure');
      return users.get(uid) || { uid, disabled: false };
    },
    async updateUser(uid, patch) {
      updates.push({ uid, patch: clone(patch) });
      if (options.updateUserFails) throw new Error('forced auth disable failure');
      if (options.rollbackFails && patch.disabled === false) throw new Error('forced rollback failure');
      const current = users.get(uid) || { uid, disabled: false };
      users.set(uid, { ...current, ...patch });
      return users.get(uid);
    }
  };
  return {
    db,
    ctx: { uid: options.callerUid || 'sysadmin1', callerDocId: options.callerUid || 'sysadmin1', email: options.callerEmail || 'sysadmin@example.com', callerEmail: options.callerEmail || 'sysadmin@example.com', isSuperAdmin: true },
    app: { auth: () => authApi },
    authUsers: users,
    authUpdates: updates
  };
}
function loadUserActions() {
  const restore = installFirebaseAdminStub();
  const modulePath = path.join(root, 'api/system-admin/user-actions.js');
  delete require.cache[require.resolve(modulePath)];
  const mod = require(modulePath);
  restore();
  return mod._test;
}
const lifecycle = loadUserActions();

async function runPurge(seed, options = {}) {
  const db = new FakeDB(seed);
  const auth = makeAuth(db, options);
  const result = await lifecycle.purgeWorkspaceUsers(auth, { restaurantId: 'r1', confirmation: 'PURGE_WORKSPACE_USERS:r1' });
  return { db, auth, result };
}

test('historical runner safety and current repair manifests validate invariants', () => {
  const runner = read('RUN_86CHAOS_FULL_TEST_SUITE.ps1');
  assert.match(runner, /function\s+SafeProjectBlockReason/);
  assert.match(runner, /cheers-34b8d/);
  assert.match(runner, /__conflict__/);
  assert.match(runner, /Firebase project identity is missing or unknown/);
  assert.match(runner, /Cost regression depends on a successful current Full Playwright release gate\./);
  const manifest176 = json('scripts/repair-regression-pack-16.0.176.json');
  const manifest177 = json('scripts/repair-regression-pack-16.0.177.json');
  assert.ok(manifest176.localCommands.some(entry => entry.group === 'Current Source Validator' && entry.cmd.join(' ') === 'node scripts/validate-16-0-176.js'));
  assert.ok(manifest177.localCommands.some(entry => entry.group === 'Current Source Validator' && entry.cmd.join(' ') === 'node scripts/validate-16-0-177.js'));
  assert.match(read('scripts/validate-16-0-176.js'), /scripts\/test-16-0-176-targeted\.cjs/);
  assert.match(read('scripts/validate-16-0-177.js'), /scripts\/test-16-0-177-targeted\.cjs/);
  assert.doesNotMatch(read('package.json'), /audit fix --force/);
  assert.match(read('RUN_86CHAOS_FULL_TEST_SUITE.ps1'), /npm audit --audit-level=high/);
});

test('bulk Nuke Users skips owner identities from restaurant document', async () => {
  for (const [ownerField, ownerValue, memberData] of [
    ['ownerUid', 'owner1', { uid: 'owner1', userId: 'owner1' }],
    ['ownerUserId', 'owner2', { uid: 'owner2', userId: 'owner2' }],
    ['ownerEmail', 'owner@example.com', { uid: 'owner3', email: 'owner@example.com', emailLower: 'owner@example.com' }]
  ]) {
    const { db, auth, result } = await runPurge({
      restaurants: { r1: { [ownerField]: ownerValue } },
      users: { [memberData.uid]: { email: memberData.email || `${memberData.uid}@example.com`, restaurantId: 'r1' } },
      workspaceMembers: { [`${memberData.uid}_r1`]: { restaurantId: 'r1', isActive: true, ...memberData } }
    });
    assert.equal(result.body.protectedSkipped, 1);
    assert.equal(auth.authUpdates.length, 0);
    assert.equal(db.get('workspaceMembers', `${memberData.uid}_r1`).isActive, true);
  }
});

test('bulk Nuke Users skips caller, protected root, and platform admin identities', async () => {
  const { db, auth, result } = await runPurge({
    restaurants: { r1: {} },
    users: {
      sysadmin1: { uid: 'sysadmin1', email: 'sysadmin@example.com', restaurantId: 'r1' },
      root1: { uid: 'root1', email: 'geoffm1985@gmail.com', restaurantId: 'r1' },
      platform1: { uid: 'platform1', email: 'platform@example.com', restaurantId: 'r1', platformAdmin: true }
    },
    workspaceMembers: {
      sysadmin1_r1: { restaurantId: 'r1', uid: 'sysadmin1', userId: 'sysadmin1', isActive: true },
      root1_r1: { restaurantId: 'r1', uid: 'root1', userId: 'root1', email: 'geoffm1985@gmail.com', isActive: true },
      platform1_r1: { restaurantId: 'r1', uid: 'platform1', userId: 'platform1', isActive: true }
    }
  }, { callerUid: 'sysadmin1', callerEmail: 'sysadmin@example.com' });
  assert.equal(result.body.protectedSkipped, 3);
  assert.equal(auth.authUpdates.length, 0);
  assert.equal(db.get('workspaceMembers', 'root1_r1').isActive, true);
});

test('ordinary single-workspace employee is deactivated and Auth disabled with audit', async () => {
  const { db, auth, result } = await runPurge({
    restaurants: { r1: {} },
    users: { emp1: { uid: 'emp1', email: 'emp1@example.com', restaurantId: 'r1', memberships: { r1: { restaurantId: 'r1', isActive: true } } } },
    workspaceMembers: { emp1_r1: { restaurantId: 'r1', uid: 'emp1', userId: 'emp1', isActive: true } }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.targetMembershipsDeactivated, 1);
  assert.equal(result.body.authDisabled, 1);
  assert.equal(db.get('workspaceMembers', 'emp1_r1').isActive, false);
  assert.equal(db.get('users', 'emp1').memberships.r1.isActive, false);
  assert.equal(db.get('users', 'emp1').forceLogout, true);
  assert.equal(auth.authUsers.get('emp1').disabled, true);
  assert.ok(db.added.some(row => row.collectionName === 'auditLogs'));
});

test('multi-workspace aliases and legacy active memberships preserve Auth and reroute workspace fields', async () => {
  for (const [field, value] of [['authUid', 'emp2'], ['accountUserId', 'emp2'], ['emailLower', 'emp2@example.com'], ['employeeEmail', 'emp2@example.com'], ['userEmail', 'emp2@example.com']]) {
    const { db, auth, result } = await runPurge({
      restaurants: { r1: {} },
      users: { emp2: { uid: 'emp2', email: 'emp2@example.com', restaurantId: 'r1', activeRestaurantId: 'r1', defaultRestaurantId: 'r1' } },
      workspaceMembers: {
        emp2_r1: { restaurantId: 'r1', uid: 'emp2', userId: 'emp2', email: 'emp2@example.com', isActive: true },
        [`other_${field}`]: { restaurantId: 'r2', [field]: value, status: 'active' }
      }
    });
    assert.equal(result.body.multiWorkspacePreserved, 1, field);
    assert.equal(auth.authUpdates.length, 0, field);
    assert.equal(db.get('users', 'emp2').restaurantId, 'r2', field);
    assert.equal(db.get('users', 'emp2').activeRestaurantId, 'r2', field);
    assert.equal(db.get('users', 'emp2').defaultRestaurantId, 'r2', field);
  }
});

test('Auth disable failure prevents Firestore commit', async () => {
  const { db, result } = await runPurge({
    restaurants: { r1: {} },
    users: { emp3: { uid: 'emp3', email: 'emp3@example.com', restaurantId: 'r1' } },
    workspaceMembers: { emp3_r1: { restaurantId: 'r1', uid: 'emp3', userId: 'emp3', isActive: true } }
  }, { updateUserFails: true });
  assert.equal(result.status, 207);
  assert.equal(result.body.failed, 1);
  assert.equal(db.batchCommitCount, 0);
  assert.equal(db.get('workspaceMembers', 'emp3_r1').isActive, true);
});

test('Firestore commit failure after Auth disable triggers rollback and reports failure', async () => {
  const db = new FakeDB({
    restaurants: { r1: {} },
    users: { emp4: { uid: 'emp4', email: 'emp4@example.com', restaurantId: 'r1' } },
    workspaceMembers: { emp4_r1: { restaurantId: 'r1', uid: 'emp4', userId: 'emp4', isActive: true } }
  });
  db.failNextCommit = true;
  const auth = makeAuth(db);
  const result = await lifecycle.purgeWorkspaceUsers(auth, { restaurantId: 'r1', confirmation: 'PURGE_WORKSPACE_USERS:r1' });
  assert.equal(result.status, 207);
  assert.equal(result.body.failed, 1);
  assert.equal(result.body.partialFailure, 1);
  assert.equal(auth.authUsers.get('emp4').disabled, false);
  assert.equal(result.body.failures[0].authRollbackAttempted, true);
  assert.equal(result.body.failures[0].authRollbackSucceeded, true);
});

test('Auth rollback failure is visible as partial failure', async () => {
  const db = new FakeDB({
    restaurants: { r1: {} },
    users: { emp5: { uid: 'emp5', email: 'emp5@example.com', restaurantId: 'r1' } },
    workspaceMembers: { emp5_r1: { restaurantId: 'r1', uid: 'emp5', userId: 'emp5', isActive: true } }
  });
  db.failNextCommit = true;
  const auth = makeAuth(db, { rollbackFails: true });
  const result = await lifecycle.purgeWorkspaceUsers(auth, { restaurantId: 'r1', confirmation: 'PURGE_WORKSPACE_USERS:r1' });
  assert.equal(result.status, 207);
  assert.equal(result.body.partialFailure, 1);
  assert.equal(auth.authUsers.get('emp5').disabled, true);
  assert.equal(result.body.failures[0].authRollbackAttempted, true);
  assert.equal(result.body.failures[0].authRollbackSucceeded, false);
});

test('workspace purge enumeration paginates beyond 500 candidates', async () => {
  const workspaceMembers = {};
  const users = {};
  for (let i = 0; i < 525; i += 1) {
    const uid = `bulk${String(i).padStart(3, '0')}`;
    workspaceMembers[`${uid}_r1`] = { restaurantId: 'r1', uid, userId: uid, isActive: true };
    users[uid] = { uid, email: `${uid}@example.com`, restaurantId: 'r1' };
  }
  const { result } = await runPurge({ restaurants: { r1: {} }, users, workspaceMembers });
  assert.equal(result.body.considered, 525);
});

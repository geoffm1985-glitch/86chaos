'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function snap(id, value) {
  return {
    id,
    exists: value !== undefined,
    data: () => value === undefined ? undefined : { ...value }
  };
}

function createFakeDb(seed = {}) {
  const rows = new Map();
  for (const [collectionName, documents] of Object.entries(seed)) {
    rows.set(collectionName, new Map(Object.entries(documents || {}).map(([id, value]) => [id, { ...value }])));
  }
  const metrics = {
    pointReads: 0,
    queryDocumentReads: 0,
    writes: 0,
    pointReadsByCollection: {},
    queryGetsByCollection: {},
    userReadIds: []
  };
  let generatedId = 0;

  const collectionRows = (name) => {
    if (!rows.has(name)) rows.set(name, new Map());
    return rows.get(name);
  };

  const makeRef = (collectionName, requestedId = '') => {
    const id = requestedId || `generated-${++generatedId}`;
    return {
      id,
      collectionName,
      async get() {
        metrics.pointReads += 1;
        metrics.pointReadsByCollection[collectionName] = Number(metrics.pointReadsByCollection[collectionName] || 0) + 1;
        if (collectionName === 'users') metrics.userReadIds.push(id);
        return snap(id, collectionRows(collectionName).get(id));
      },
      async set(value, options = {}) {
        metrics.writes += 1;
        const previous = collectionRows(collectionName).get(id) || {};
        collectionRows(collectionName).set(id, options.merge ? { ...previous, ...value } : { ...value });
      },
      async update(value) {
        metrics.writes += 1;
        const previous = collectionRows(collectionName).get(id) || {};
        collectionRows(collectionName).set(id, { ...previous, ...value });
      },
      _transactionUpdate(value) {
        metrics.writes += 1;
        const previous = collectionRows(collectionName).get(id) || {};
        collectionRows(collectionName).set(id, { ...previous, ...value });
      }
    };
  };

  const makeQuery = (collectionName, clauses = [], maxRows = Infinity) => ({
    doc(id) { return makeRef(collectionName, id); },
    where(field, operator, value) { return makeQuery(collectionName, [...clauses, { field, operator, value }], maxRows); },
    orderBy() { return makeQuery(collectionName, clauses, maxRows); },
    limit(value) { return makeQuery(collectionName, clauses, Math.max(0, Number(value) || 0)); },
    async get() {
      metrics.queryGetsByCollection[collectionName] = Number(metrics.queryGetsByCollection[collectionName] || 0) + 1;
      const matches = [...collectionRows(collectionName).entries()].filter(([, value]) => clauses.every(clause => {
        const actual = value?.[clause.field];
        if (clause.operator === '==') return actual === clause.value;
        if (clause.operator === '<=') return actual != null && String(actual) <= String(clause.value);
        if (clause.operator === 'array-contains') return Array.isArray(actual) && actual.includes(clause.value);
        return true;
      })).slice(0, maxRows);
      metrics.queryDocumentReads += matches.length;
      const docs = matches.map(([id, value]) => snap(id, value));
      return { size: docs.length, empty: docs.length === 0, docs, forEach(fn) { docs.forEach(fn); } };
    }
  });

  const db = {
    collection(name) { return makeQuery(name); },
    async runTransaction(worker) {
      return worker({
        get: ref => ref.get(),
        update: (ref, value) => ref._transactionUpdate(value)
      });
    }
  };

  return {
    db,
    metrics,
    get(collectionName, id) { return collectionRows(collectionName).get(id); }
  };
}

function responseRecorder() {
  const response = { statusCode: 200, body: null };
  response.status = (statusCode) => { response.statusCode = statusCode; return response; };
  response.json = (body) => { response.body = body; return body; };
  return response;
}

function loadWithChaosAdmin(moduleName, chaosExports) {
  const chaosPath = require.resolve('./_chaos-admin');
  const targetPath = require.resolve(moduleName);
  const previousChaos = require.cache[chaosPath];
  const previousTarget = require.cache[targetPath];
  require.cache[chaosPath] = { id: chaosPath, filename: chaosPath, loaded: true, exports: chaosExports };
  delete require.cache[targetPath];
  const loaded = require(targetPath);
  return {
    loaded,
    restore() {
      delete require.cache[targetPath];
      if (previousTarget) require.cache[targetPath] = previousTarget;
      if (previousChaos) require.cache[chaosPath] = previousChaos;
      else delete require.cache[chaosPath];
    }
  };
}

function saveChaosExports(app) {
  return {
    getAdminAppForRequest: () => app,
    readBody: async req => req.body || {},
    requireAppCheckIfEnforced: async () => ({ ok: true }),
    norm: value => String(value || '').toLowerCase().trim(),
    userHasWorkspace: (user, restaurantId) => Boolean(
      user?.restaurantId === restaurantId ||
      user?.workspaceIds?.includes?.(restaurantId) ||
      (user?.memberships?.[restaurantId] && user.memberships[restaurantId].isActive !== false)
    ),
    readWorkspaceMember: async (db, uid, email, restaurantId) => {
      const id = `${String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_')}_${String(restaurantId || '').replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 240);
      const direct = await db.collection('workspaceMembers').doc(id).get();
      if (direct.exists && direct.data()?.isActive !== false) return { id: direct.id, ...direct.data() };
      if (!email) return null;
      const byEmail = await db.collection('workspaceMembers').where('restaurantId', '==', restaurantId).where('email', '==', String(email).toLowerCase()).limit(1).get();
      return byEmail.empty ? null : { id: byEmail.docs[0].id, ...byEmail.docs[0].data() };
    }
  };
}

async function runSave({ seed, decoded, body }) {
  const fake = createFakeDb(seed);
  const app = {
    auth: () => ({ verifyIdToken: async () => decoded }),
    firestore: () => fake.db
  };
  const moduleHandle = loadWithChaosAdmin('./personal-reminder-save.js', saveChaosExports(app));
  try {
    const response = responseRecorder();
    await moduleHandle.loaded({ method: 'POST', headers: { authorization: 'Bearer signed-user-token' }, body }, response);
    return { ...fake, response };
  } finally {
    moduleHandle.restore();
  }
}

test('self reminder stores the canonical push profile with exactly one Firestore read and one write', async () => {
  const result = await runSave({
    seed: {
      users: {
        'auth-1': { authUid: 'auth-1', email: 'owner@example.test', name: 'Owner', restaurantId: 'qa-rest', isActive: true, profileDocId: 'profile-owner' }
      }
    },
    decoded: { uid: 'auth-1', email: 'owner@example.test', name: 'Owner' },
    body: { restaurantId: 'qa-rest', assignedToUserId: 'auth-1', title: 'Check the walk-in', scheduledAt: '2030-01-02T12:00:00.000Z', timezone: 'UTC' }
  });
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.metrics.pointReads, 1);
  assert.equal(result.metrics.queryDocumentReads, 0);
  assert.equal(result.metrics.writes, 1);
  const saved = result.get('personalReminders', result.response.body.reminderId);
  assert.equal(saved.assignedToUserId, 'auth-1');
  assert.equal(saved.recipientProfileId, 'profile-owner');
  assert.deepEqual(saved.participantUserIds, ['auth-1']);
});

test('shared reminder separates recipient auth identity from profile document in two reads and one write', async () => {
  const result = await runSave({
    seed: {
      users: {
        'auth-1': { authUid: 'auth-1', email: 'owner@example.test', restaurantId: 'qa-rest', isActive: true },
        'legacy-profile': { authUid: 'auth-2', email: 'cook@example.test', name: 'Cook', restaurantId: 'qa-rest', isActive: true }
      }
    },
    decoded: { uid: 'auth-1', email: 'owner@example.test', name: 'Owner' },
    body: { restaurantId: 'qa-rest', assignedToUserId: 'legacy-profile', title: 'Start the stock', scheduledAt: '2030-01-02T12:00:00.000Z', timezone: 'UTC' }
  });
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.metrics.pointReads, 2);
  assert.equal(result.metrics.queryDocumentReads, 0);
  assert.equal(result.metrics.writes, 1);
  const saved = result.get('personalReminders', result.response.body.reminderId);
  assert.equal(saved.assignedToUserId, 'auth-2');
  assert.equal(saved.recipientProfileId, 'legacy-profile');
  assert.deepEqual(saved.participantUserIds, ['auth-1', 'auth-2']);
});

test('due reminder reads one canonical recipient, sends one visible FCM payload, and cannot dispatch twice', async () => {
  const now = new Date().toISOString();
  const dueAt = new Date(Date.now() - 60_000).toISOString();
  const fake = createFakeDb({
    personalReminders: {
      'reminder-1': {
        restaurantId: 'qa-rest',
        title: 'Check the walk-in',
        status: 'scheduled',
        dispatchEligible: true,
        nextDispatchAt: dueAt,
        scheduledAt: dueAt,
        occurrenceScheduledAt: dueAt,
        currentOccurrenceKey: `reminder-1:${dueAt}`,
        assignedToUserId: 'auth-1',
        recipientProfileId: 'profile-owner',
        recurrence: 'none'
      }
    },
    users: {
      'profile-owner': {
        authUid: 'auth-1',
        pushDevices: {
          phone: { token: 'fcm-token-1', permission: 'granted', active: true, lastVerifiedAt: now }
        }
      }
    },
    eventReminders: {}
  });
  const messages = [];
  const app = {
    options: { projectId: 'chaos-test-d1601' },
    firestore: () => fake.db,
    messaging: () => ({
      sendEachForMulticast: async payload => {
        messages.push(payload);
        return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
      }
    })
  };
  const moduleHandle = loadWithChaosAdmin('./dispatch-reminders.js', { initAdmin: () => app });
  const oldSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-cron-secret';
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const first = responseRecorder();
    await moduleHandle.loaded({ method: 'GET', headers: { authorization: 'Bearer test-cron-secret' } }, first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.body.sent, 1);
    assert.equal(first.body.recipientReads, 1);
    assert.equal(first.body.recipientFallbackReads, 0);
    assert.equal(first.body.transactionReads, 1);
    assert.equal(first.body.documentsWritten, 2);
    assert.deepEqual(fake.metrics.userReadIds, ['profile-owner']);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].tokens, ['fcm-token-1']);
    assert.equal(messages[0].notification.title, '86 Chaos Reminder');
    assert.equal(messages[0].notification.body, 'Check the walk-in');
    assert.equal(messages[0].webpush.notification.title, '86 Chaos Reminder');
    assert.equal(messages[0].webpush.notification.body, 'Check the walk-in');
    assert.equal(messages[0].webpush.fcmOptions.link, '/?tab=reminders');
    assert.equal(fake.get('personalReminders', 'reminder-1').status, 'sent');

    const second = responseRecorder();
    await moduleHandle.loaded({ method: 'GET', headers: { authorization: 'Bearer test-cron-secret' } }, second);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.queried, 0);
    assert.equal(second.body.sent, 0);
    assert.equal(messages.length, 1);
  } finally {
    console.info = originalInfo;
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
    moduleHandle.restore();
  }
});

test('legacy reminder fallback is bounded to direct document reads and never scans users', async () => {
  const now = new Date().toISOString();
  const fake = createFakeDb({
    users: {
      'auth-legacy': { authUid: 'auth-legacy', email: 'legacy@example.test' },
      'legacy@example.test': {
        authUid: 'auth-legacy',
        email: 'legacy@example.test',
        pushDevices: { phone: { token: 'legacy-token', permission: 'granted', active: true, lastVerifiedAt: now } }
      }
    }
  });
  const moduleHandle = loadWithChaosAdmin('./dispatch-reminders.js', { initAdmin: () => ({}) });
  try {
    const resolved = await moduleHandle.loaded._test.resolvePersonalReminderRecipient(fake.db, {
      assignedToUserId: 'auth-legacy',
      assignedToEmail: 'legacy@example.test',
      shared: false
    });
    assert.deepEqual(resolved.tokens, ['legacy-token']);
    assert.equal(resolved.profileId, 'legacy@example.test');
    assert.equal(resolved.reads, 2);
    assert.equal(resolved.fallbackReads, 1);
    assert.equal(fake.metrics.queryGetsByCollection.users || 0, 0);
  } finally {
    moduleHandle.restore();
  }
});

test('foreground reminder delivery creates a real system notification without Firebase activity', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.js'), 'utf8');
  const start = appSource.indexOf('const showForegroundPushNotification');
  const end = appSource.indexOf('const clearChunkRecoveryMarkers', start);
  assert.ok(start >= 0 && end > start, 'foreground notification helper must exist');
  const helper = appSource.slice(start, end);
  assert.match(helper, /Notification\.permission !== 'granted'/);
  assert.match(helper, /navigator\.serviceWorker\.ready/);
  assert.match(helper, /registration\.showNotification\(title/);
  assert.match(helper, /data:\s*\{\s*url,\s*notificationTag:\s*tag\s*\}/);
  assert.doesNotMatch(helper, /onSnapshot|getDoc|getDocs|addDoc|setDoc|updateDoc|secureFetch|setInterval/);
  const foregroundHandler = appSource.slice(appSource.indexOf('// --- FOREGROUND NOTIFICATION CATCHER ---'), appSource.indexOf('const handleKey', appSource.indexOf('// --- FOREGROUND NOTIFICATION CATCHER ---')));
  assert.match(foregroundHandler, /showForegroundPushNotification\(payload\)/);
});

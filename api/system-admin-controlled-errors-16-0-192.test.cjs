'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function withAdminMock(run) {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'firebase-admin') return { firestore: { FieldPath: { documentId: () => ({ __name: true }) } } };
    if (request === '../_chaos-admin') {
      return {
        admin: { firestore: { FieldPath: { documentId: () => ({ __name: true }) } } },
        getAdminAppForRequest: () => ({ options: { projectId: 'test-project' }, firestore: () => ({ collection: () => { throw new Error('SECRET_STACK_SHOULD_NOT_LEAK'); } }) }),
        authorize: async (_req, app) => ({ ok: true, isSuperAdmin: true, db: app.firestore(), app })
      };
    }
    return originalLoad.apply(this, arguments);
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    await run();
  } finally {
    console.error = originalError;
    Module._load = originalLoad;
    for (const key of Object.keys(require.cache)) {
      if (/api[\\/]system-admin[\\/](people|people-search|workspaces)\.js$/.test(key)) delete require.cache[key];
    }
  }
}

async function assertControlled500(file, expectedCode, expectedMessage) {
  await withAdminMock(async () => {
    const handler = require(`./${file}`);
    const res = makeRes();
    await handler({ method: 'GET', query: { userId: 'any' } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.code, expectedCode);
    assert.equal(res.body?.error, expectedMessage);
    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes('SECRET_STACK_SHOULD_NOT_LEAK'), false);
    assert.equal(/stack|privateKey|serviceAccount|credential|token/i.test(serialized), false);
  });
}

test('system-admin people returns a controlled public 500 on unexpected database failure', async () => {
  await assertControlled500('system-admin/people.js', 'system-admin-people-failed', 'Could not load people.');
});

test('system-admin people-search returns a controlled public 500 on unexpected database failure', async () => {
  await assertControlled500('system-admin/people-search.js', 'system-admin-people-search-failed', 'Could not search people.');
});

test('system-admin workspaces returns a controlled public 500 on unexpected database failure', async () => {
  await assertControlled500('system-admin/workspaces.js', 'system-admin-workspaces-failed', 'Could not load workspaces.');
});

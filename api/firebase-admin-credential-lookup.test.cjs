const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const helperPath = path.resolve(__dirname, './_firebase-project-admin.js');

function freshHelper() {
  const originalLoad = Module._load;
  const fakeAdmin = {
    apps: [],
    credential: { cert: credentialInput => credentialInput },
    initializeApp(options, name) {
      const app = { name, options, auth: () => ({}), firestore: () => ({}) };
      this.apps.push(app);
      return app;
    },
  };
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'firebase-admin') return fakeAdmin;
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[require.resolve(helperPath)];
  try { return require(helperPath); }
  finally { Module._load = originalLoad; }
}

function withEnv(patch, fn) {
  const keys = [
    'FIREBASE_TEST_SERVICE_ACCOUNT_KEY',
    'TEST_FIREBASE_SERVICE_ACCOUNT_KEY',
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'FIREBASE_ADMIN_CREDENTIALS',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'GOOGLE_FIREBASE_SERVICE_ACCOUNT_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GCLOUD_SERVICE_ACCOUNT_KEY_PATH',
    'FIREBASE_SERVICE_ACCOUNT_KEY_PATH',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, patch);
  try { return fn(); }
  finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}

function credential(projectId = 'chaos-test-d1601') {
  return {
    type: 'service_account',
    project_id: projectId,
    client_email: `firebase-adminsdk-unit@${projectId}.iam.gserviceaccount.com`,
    private_key: '-----BEGIN PRIVATE KEY-----\\nUNIT\\n-----END PRIVATE KEY-----\\n',
  };
}

test('testing Admin helper accepts the existing generic FIREBASE_SERVICE_ACCOUNT_KEY when project_id matches', () => withEnv({
  FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify(credential('chaos-test-d1601')),
}, () => {
  const { readProjectCredential } = freshHelper();
  const found = readProjectCredential('chaos-test-d1601');
  assert.equal(found.source, 'FIREBASE_SERVICE_ACCOUNT_KEY');
  assert.equal(found.credential.projectId, 'chaos-test-d1601');
}));

test('testing Admin helper accepts the existing GOOGLE_APPLICATION_CREDENTIALS service-account file path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-google-creds-'));
  const file = path.join(dir, 'service-account.json');
  fs.writeFileSync(file, JSON.stringify(credential('chaos-test-d1601')));
  try {
    withEnv({ GOOGLE_APPLICATION_CREDENTIALS: file }, () => {
      const { readProjectCredential } = freshHelper();
      const found = readProjectCredential('chaos-test-d1601');
      assert.equal(found.source, 'GOOGLE_APPLICATION_CREDENTIALS');
      assert.equal(found.credential.projectId, 'chaos-test-d1601');
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

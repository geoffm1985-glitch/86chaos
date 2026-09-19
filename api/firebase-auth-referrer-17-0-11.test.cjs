'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const auth = require('../scripts/86chaos-release-gate/verify-role-accounts.cjs');
const referrer = require('../scripts/86chaos-release-gate/firebase-auth-referrer.cjs');

const IMMUTABLE_APP = 'https://86chaos-a5s8ndel8-cheers-portal-s-projects.vercel.app';
const STABLE_AUTH = 'https://86chaos-git-testing-cheers-portal-s-projects.vercel.app';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    text: async () => JSON.stringify(body),
  };
}

test('17.0.11 keeps immutable app identity separate from the approved Firebase Auth referrer', async () => {
  const saved = { APP_URL: process.env.APP_URL, CHAOS_BASE_URL: process.env.CHAOS_BASE_URL, CHAOS_FIREBASE_AUTH_REFERRER_URL: process.env.CHAOS_FIREBASE_AUTH_REFERRER_URL };
  process.env.APP_URL = IMMUTABLE_APP;
  process.env.CHAOS_BASE_URL = IMMUTABLE_APP;
  process.env.CHAOS_FIREBASE_AUTH_REFERRER_URL = STABLE_AUTH;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('identitytoolkit.googleapis.com')) return response(200, { idToken: 'test-token', localId: 'test-uid' });
    return response(200, { uid: 'test-uid', email: 'qa@example.test', runtime: { firebaseProjectId: 'chaos-test-d1601' }, superAdmin: false });
  };
  try {
    const account = { key: 'staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', email: 'qa@example.test', password: 'not-a-real-secret', expectedPlatformAuthority: false };
    const signed = await auth.signInAccount(account, { apiKey: 'test-api-key', projectId: 'chaos-test-d1601' }, fetchImpl);
    await auth.fetchWhoami(signed, fetchImpl);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /^https:\/\/identitytoolkit\.googleapis\.com\//);
    assert.equal(calls[0].options.headers.Origin, STABLE_AUTH);
    assert.equal(calls[0].options.headers.Referer, `${STABLE_AUTH}/`);
    assert.notEqual(calls[0].options.headers.Origin, IMMUTABLE_APP);
    assert.equal(calls[1].url, `${IMMUTABLE_APP}/api/whoami`);
    assert.equal(calls[1].options.headers.Origin, undefined);
    assert.equal(calls[1].options.headers.Referer, undefined);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('17.0.11 rejects production, wildcard, and immutable Firebase Auth referrer configurations', () => {
  assert.equal(referrer.validateFirebaseAuthReferrer({ env: { CHAOS_FIREBASE_AUTH_REFERRER_URL: STABLE_AUTH }, firebaseProjectId: 'chaos-test-d1601' }).ok, true);
  assert.equal(referrer.validateFirebaseAuthReferrer({ env: { CHAOS_FIREBASE_AUTH_REFERRER_URL: 'https://*.vercel.app' }, firebaseProjectId: 'chaos-test-d1601' }).ok, false);
  assert.equal(referrer.validateFirebaseAuthReferrer({ env: { CHAOS_FIREBASE_AUTH_REFERRER_URL: IMMUTABLE_APP }, firebaseProjectId: 'chaos-test-d1601' }).ok, false);
  assert.equal(referrer.validateFirebaseAuthReferrer({ env: { CHAOS_FIREBASE_AUTH_REFERRER_URL: STABLE_AUTH }, firebaseProjectId: 'cheers-34b8d' }).ok, false);
});

test('17.0.11 leaves the 17.0.10 Firebase, Vercel, Firestore, and Storage security configuration unchanged', () => {
  const expected = {
    'firebase.json': 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4',
    'vercel.json': '3a42afbec525fe1abfe52f28d9b973c9494bdaca6edf3b0ed1a43f30c69db276',
    'firestore.rules': 'b52341b1950783547b28448d9eb13b79872175bb0c6f5f8637852e46f16bb4f2',
    'storage.rules': '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c',
  };
  for (const [file, sha256] of Object.entries(expected)) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, `${file} security boundary changed`);
  }
});

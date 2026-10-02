'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const target = require('../scripts/86chaos-firebase-target.cjs');

test('17.0.54 target defaults LIVE and explicit emulator uses demo project', () => {
  assert.equal(target.getFirebaseTarget({}).target, 'LIVE');
  assert.equal(target.expectedFirebaseProject({}), 'chaos-test-d1601');
  const emulator = target.getFirebaseTarget({ REACT_APP_86CHAOS_FIREBASE_TARGET: 'emulator' });
  assert.equal(emulator.target, 'EMULATOR');
  assert.equal(emulator.projectId, 'demo-86chaos');
  assert.equal(emulator.host, '127.0.0.1');
  assert.deepEqual(emulator.ports, { firestore: 8080, auth: 9099, functions: 5001, database: 9000, storage: 9199 });
  assert.throws(() => target.getFirebaseTarget({ REACT_APP_86CHAOS_FIREBASE_TARGET: 'emulator', REACT_APP_86CHAOS_FIREBASE_EMULATOR_HOST: 'remote.example.test' }), /non-loopback/i);
});

test('17.0.54 emulator environment routes Firebase service clients locally', () => {
  const env = { REACT_APP_86CHAOS_FIREBASE_TARGET: 'emulator' };
  target.applyFirebaseEmulatorEnv(env);
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  assert.equal(env.FUNCTIONS_EMULATOR_HOST, '127.0.0.1:5001');
  assert.equal(env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9000');
  assert.equal(env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
  assert.match(target.firebaseAuthRestUrl('demo', 'signInWithPassword', env), /^http:\/\/127\.0\.0\.1:9099\//);
  assert.equal(target.firestoreRestOrigin(env), 'http://127.0.0.1:8080');
  assert.equal(target.storageRestOrigin(env), 'http://127.0.0.1:9199');
});

test('17.0.54 Web SDK wires all supported Firebase emulators before app traffic', () => {
  const appCore = read('src/core/appCore.js');
  const targetSource = read('src/core/firebaseTarget.js');
  for (const marker of ['connectFirestoreEmulator', 'connectAuthEmulator', 'connectFunctionsEmulator', 'connectDatabaseEmulator', 'connectStorageEmulator']) assert.match(appCore, new RegExp(marker));
  assert.ok(appCore.indexOf('connectFirestoreEmulator') < appCore.indexOf('enableChaosFirestorePersistence()'));
  assert.match(appCore, /projectId:\s*firebaseEmulatorSettings\.projectId/);
  assert.match(targetSource, /will not fall back to live Firebase/i);
  for (const service of ['Firestore', 'Authentication', 'Functions', 'Realtime Database', 'Storage']) assert.match(targetSource, new RegExp("probe\\('"+service+"'"));
});

test('17.0.54 startup and secondary Auth are fail closed', () => {
  const god = read('src/components/TabGodMode.js');
  const index = read('src/index.js');
  assert.match(god, /firebaseRuntimeTarget === 'EMULATOR'.*connectAuthEmulator/);
  assert.match(index, /firebaseEmulatorReadiness\.then\(renderApp\)\.catch/);
  assert.match(index, /firebase-emulator-startup-failure/);
  assert.match(index, /did not fall back to live Firebase/);
});

test('17.0.54 canonical Firebase rules and ports remain authoritative', () => {
  const config = JSON.parse(read('firebase.json'));
  assert.equal(config.firestore.rules, 'firestore.rules');
  assert.equal(config.firestore.indexes, 'firestore.indexes.json');
  assert.equal(config.storage.rules, 'storage.rules');
  assert.equal(config.database.rules, 'database.rules.json');
  assert.deepEqual(
    [config.emulators.firestore.port, config.emulators.auth.port, config.emulators.functions.port, config.emulators.database.port, config.emulators.storage.port],
    [8080, 9099, 5001, 9000, 9199]
  );
});

test('17.0.54 release-gate seed cleanup Auth and presence share emulator target', () => {
  const source = [
    'scripts/86chaos-full-audit/firebase-client.cjs',
    'scripts/86chaos-full-audit/seed-fake-restaurant.cjs',
    'scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs',
    'scripts/86chaos-release-gate/verify-role-accounts.cjs',
    'scripts/86chaos-release-gate/server-firebase-boundary-preflight.cjs',
    'scripts/86chaos-release-gate/mutation-safety.cjs',
    'api/_firebase-project-admin.js',
    'api/full-audit-qa-seed.js',
    'api/presence-snapshot.js'
  ].map(read).join('\n');
  assert.match(source, /applyFirebaseEmulatorEnv|expectedFirebaseProject/);
  assert.match(source, /firebaseAuthRestUrl/);
  assert.match(source, /firestoreRestOrigin/);
  assert.match(source, /storageRestOrigin/);
  assert.match(source, /demo-86chaos|target\.projectId|firebaseTarget\.projectId/);
});

test('17.0.54 cloud-only differences are explicitly retained for LIVE verification', () => {
  const docs = read('docs/firebase-emulator-bridge-17.0.54.md');
  const boundary = read('scripts/86chaos-release-gate/server-firebase-boundary-preflight.cjs');
  assert.match(boundary, /liveVerificationRequired:\s*true/);
  for (const marker of ['FCM', 'App Check', 'MFA', 'IAM', 'Vercel']) assert.match(docs, new RegExp(marker, 'i'));
});

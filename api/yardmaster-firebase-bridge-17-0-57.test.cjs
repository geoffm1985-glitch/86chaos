'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const bridge = require('../yardmaster.firebase.json');
const pkg = require('../package.json');
const firebase = require('../firebase.json');
const target = require('../scripts/86chaos-firebase-target.cjs');
const { prepareYardmasterEnv } = require('../scripts/start-yardmaster.cjs');
const { connectedAcknowledgment, CONNECT_POLICY } = require('../scripts/yardmaster-readiness.cjs');

test('17.0.57 root bridge satisfies Yardmaster schema and preserves complete gate commands', () => {
  assert.equal(bridge.schema, 1);
  assert.equal(bridge.projectId, target.emulatorConfig.projectId);
  assert.equal(bridge.firebaseConfig, 'firebase.json');
  assert.deepEqual(bridge.products.slice().sort(), Object.keys(target.emulatorConfig.ports).sort());
  const url = new URL(bridge.localApp.url);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(bridge.localApp.readyPath, '/api/firebase-target');
  for (const name of [bridge.localApp.startScript, ...Object.values(bridge.scripts)]) assert.ok(pkg.scripts[name], name);
  assert.equal(bridge.scripts.full, 'test:play-store');
  assert.equal(bridge.scripts.delta, 'test:play-store:delta');
  assert.equal(bridge.scripts.playwright, 'test:playwright');
  for (const product of bridge.products) {
    assert.ok(firebase.emulators[product]);
    assert.equal(firebase.emulators[product].host, '127.0.0.1');
    assert.equal(firebase.emulators[product].port, target.emulatorConfig.ports[product]);
  }
  for (const file of [firebase.firestore.rules, firebase.firestore.indexes, firebase.storage.rules, firebase.database.rules, path.join(firebase.functions.source, 'package.json')]) assert.ok(fs.existsSync(path.join(root, file)));
});

test('17.0.57 pinned Yardmaster target overrides stale live settings and maps all SDK ports', () => {
  const env = { YARDMASTER_FIREBASE_TARGET: 'emulator', REACT_APP_86CHAOS_FIREBASE_TARGET: 'live', FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080', FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:15001', REACT_APP_FIREBASE_PROJECT_ID: 'cheers-34b8d' };
  prepareYardmasterEnv(env);
  assert.equal(env.REACT_APP_86CHAOS_FIREBASE_TARGET, 'emulator');
  assert.equal(env.REACT_APP_FIREBASE_PROJECT_ID, 'demo-86chaos');
  assert.equal(env.REACT_APP_86CHAOS_FIRESTORE_EMULATOR_PORT, '18080');
  assert.equal(env.REACT_APP_86CHAOS_FUNCTIONS_EMULATOR_PORT, '15001');
  assert.equal(env.HOST, '127.0.0.1');
  assert.equal(env.PORT, '3000');
  assert.equal(env.BROWSER, 'none');
  assert.throws(() => prepareYardmasterEnv({}), /explicit emulator/);
  assert.throws(() => prepareYardmasterEnv({ YARDMASTER_FIREBASE_TARGET: 'live', REACT_APP_86CHAOS_FIREBASE_TARGET: 'emulator' }), /explicit emulator/);
  assert.throws(() => prepareYardmasterEnv({ YARDMASTER_FIREBASE_TARGET: 'emulator', FIRESTORE_EMULATOR_HOST: 'remote.example:8080' }), /non-loopback/);
});

test('17.0.57 readiness refuses live, missing SDK connections, mismatched ports and unavailable services', () => {
  const selected = target.getFirebaseTarget({ YARDMASTER_FIREBASE_TARGET: 'emulator' });
  const diagnostics = { target: 'EMULATOR', projectId: bridge.projectId, failClosed: true, connectedProducts: bridge.products, emulator: { host: selected.host, ...Object.fromEntries(Object.entries(selected.ports).map(([key, value]) => [key + 'Port', value])) } };
  assert.deepEqual(connectedAcknowledgment(diagnostics, { ok: true }, selected), { target: 'emulator', projectId: bridge.projectId, blockLiveFirebase: true, products: bridge.products });
  assert.throws(() => connectedAcknowledgment({ ...diagnostics, projectId: 'cheers-34b8d' }, { ok: true }, selected));
  assert.throws(() => connectedAcknowledgment({ ...diagnostics, connectedProducts: ['auth', 'firestore'] }, { ok: true }, selected));
  assert.throws(() => connectedAcknowledgment({ ...diagnostics, emulator: { ...diagnostics.emulator, functionsPort: 7777 } }, { ok: true }, selected));
  assert.throws(() => connectedAcknowledgment(diagnostics, { ok: false }, selected));
  assert.throws(() => connectedAcknowledgment(diagnostics, { ok: true }, target.getFirebaseTarget({})));
  const connectPolicy = CONNECT_POLICY.split(';').map(part => part.trim()).find(part => part.startsWith('connect-src ')) || '';
  assert.match(connectPolicy, /connect-src 'self' http:\/\/127\.0\.0\.1:\*/);
  assert.doesNotMatch(connectPolicy, /googleapis|firebaseio|https:/);
});

test('17.0.57 ordinary production target and environment remain unchanged', () => {
  const env = { REACT_APP_FIREBASE_PROJECT_ID: 'cheers-34b8d' };
  const before = { ...env };
  assert.equal(target.applyFirebaseEmulatorEnv(env).target, 'LIVE');
  assert.deepEqual(env, before);
  assert.equal(target.emulatorConfig.productionProjectId, 'cheers-34b8d');
});

test('17.0.57 exact regression is mandatory in the release gate and focused runner', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  const spec = 'tests/86chaos-release-gate/69-yardmaster-firebase-bridge-17-0-57.spec.cjs';
  assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(spec));
  assert.ok(universe.specIsInReleaseUniverse(spec));
  assert.match(pkg.scripts['test:current-release-targeted'], /yardmaster-firebase-bridge-17-0-57/);
  const focused = fs.readFileSync(path.join(root, 'scripts/run-firebase-bridge-tests.cjs'), 'utf8');
  assert.match(focused, /emulators:exec/);
  assert.doesNotMatch(focused, /npm run test:play-store|deploy/);
});

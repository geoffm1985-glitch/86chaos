'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {childEnvironment}=require('../scripts/run-isolated-server-tests.cjs');
const {safeTestTarget}=require('../test-tools/pos-bridge-simulator.cjs');
test('a deployed testing gate pins its server children to their private emulator project',()=>{
  const parent={YARDMASTER_FIREBASE_TARGET:'live',REACT_APP_86CHAOS_FIREBASE_TARGET:'live',FIREBASE_PROJECT_ID:'chaos-test-d1601',FIREBASE_ACTIVE_PROJECT_ID:'chaos-test-d1601',GCLOUD_PROJECT:'demo-86chaos',FIRESTORE_EMULATOR_HOST:'127.0.0.1:32123',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:32124',APP_URL:'https://testing.86chaos.com'};
  const original={...parent},env=childEnvironment(parent);
  assert.equal(env.YARDMASTER_FIREBASE_TARGET,'emulator');
  assert.equal(env.CHAOS_BLOCK_LIVE_FIREBASE,'1');
  for(const key of ['GCLOUD_PROJECT','FIREBASE_PROJECT_ID','FIREBASE_ACTIVE_PROJECT_ID'])assert.equal(env[key],'demo-86chaos');
  assert.equal(env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:32123');
  assert.equal(env.FIREBASE_STORAGE_EMULATOR_HOST,'127.0.0.1:32124');
  assert.equal(safeTestTarget('http://127.0.0.1:5001',env),true);
  assert.deepEqual(parent,original);
});
test('isolated SDK hosts override inherited browser ports without mutating the parent',()=>{
  const parent={YARDMASTER_FIREBASE_TARGET:'emulator',FIRESTORE_EMULATOR_HOST:'127.0.0.1:32123',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:32124',REACT_APP_86CHAOS_FIRESTORE_EMULATOR_PORT:'8080',REACT_APP_86CHAOS_STORAGE_EMULATOR_PORT:'9199',TEMP:'private-service-temp',TMP:'private-service-temp',CHAOS_SERVER_PARENT_TEMP:'original-temp',CHAOS_SERVER_PARENT_TMP:'original-tmp'};
  const original={...parent},env=childEnvironment(parent);
  assert.equal(env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:32123');
  assert.equal(env.FIREBASE_STORAGE_EMULATOR_HOST,'127.0.0.1:32124');
  assert.equal(env.GCLOUD_PROJECT,'demo-86chaos');
  assert.equal(env.TEMP,'original-temp');assert.equal(env.TMP,'original-tmp');
  assert.equal(env.CHAOS_SERVER_PARENT_TEMP,undefined);
  assert.deepEqual(parent,original);
});

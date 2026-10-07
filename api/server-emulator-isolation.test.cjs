'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {childEnvironment}=require('../scripts/run-isolated-server-tests.cjs');
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

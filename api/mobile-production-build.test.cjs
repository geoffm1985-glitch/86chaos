'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {productionEnvironment,verifyProductionConfiguration,UPDATED_ORIGIN}=require('../scripts/build-production-apk.cjs');
test('production APK overrides inherited testing Firebase and both API destinations',()=>{
  const e=productionEnvironment({REACT_APP_FIREBASE_DEPLOYMENT_MODE:'testing',REACT_APP_FIREBASE_ACTIVE_PROJECT_ID:'chaos-test-d1601',REACT_APP_NATIVE_API_BASE_URL:'https://testing.86chaos.com',REACT_APP_NATIVE_UPDATED_API_BASE_URL:'https://testing.86chaos.com'});
  assert.equal(e.REACT_APP_FIREBASE_DEPLOYMENT_MODE,'production');assert.equal(e.REACT_APP_FIREBASE_ACTIVE_PROJECT_ID,'cheers-34b8d');
  assert.equal(e.REACT_APP_NATIVE_API_BASE_URL,'https://app.86chaos.com');assert.equal(e.REACT_APP_NATIVE_UPDATED_API_BASE_URL,UPDATED_ORIGIN);
});
test('production APK removes inherited emulator and Vercel source identity overrides',()=>{
  const e=productionEnvironment({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',REACT_APP_86CHAOS_FIREBASE_TARGET:'emulator',YARDMASTER_FIREBASE_TARGET:'emulator',CHAOS_BLOCK_LIVE_FIREBASE:'1',VERCEL_GIT_COMMIT_SHA:'wrong',GOOGLE_APPLICATION_CREDENTIALS:'local-test-key'});
  for(const k of ['FIRESTORE_EMULATOR_HOST','YARDMASTER_FIREBASE_TARGET','CHAOS_BLOCK_LIVE_FIREBASE','VERCEL_GIT_COMMIT_SHA','GOOGLE_APPLICATION_CREDENTIALS'])assert.equal(e[k],undefined);
  assert.equal(e.REACT_APP_86CHAOS_FIREBASE_TARGET,'live');
});
const services=require('../android/app/google-services.json'),cap=require('../capacitor.config.json'),contract=require('../mobile/native-platform-contract.json');
test('production APK accepts the reviewed production native configuration',()=>assert.doesNotThrow(()=>verifyProductionConfiguration(services,cap,contract)));
test('production APK rejects testing native Firebase resources',()=>assert.throws(()=>verifyProductionConfiguration(require('../mobile/testing/google-services.json'),cap,contract),/production Firebase/));
test('production APK rejects testing native origin and API destinations',()=>{
  assert.throws(()=>verifyProductionConfiguration(services,{...cap,server:{...cap.server,hostname:'testing.86chaos.com'}},contract),/production native origin/);
  const changed=JSON.parse(JSON.stringify(contract));changed.nativeApiBridge.updatedRoutes.backendBaseUrl='https://testing.86chaos.com';
  assert.throws(()=>verifyProductionConfiguration(services,cap,changed));
});
test('former testing APK CLI refuses execution before building or modifying source',()=>{
  const r=cp.spawnSync(process.execPath,['scripts/build-testing-apk.cjs'],{encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stderr,/Testing Firebase APKs are forbidden/);
});

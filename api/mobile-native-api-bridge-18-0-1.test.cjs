'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test('18.0.1 native API bridge intercepts only local /api traffic and targets testing backend',()=>{
  const core=read('src/core/appCore.js');
  const cap=json('capacitor.config.json');
  const contract=json('mobile/native-platform-contract.json');
  assert.equal(cap.server.hostname,'testing.86chaos.com');
  assert.equal(contract.nativeApiBridge.backendBaseUrl,'https://testing.86chaos.com');
  assert.equal(contract.nativeApiBridge.transport,'CapacitorHttp');
  assert.match(core,/import \{ Capacitor, CapacitorHttp \} from '@capacitor\/core'/);
  assert.match(core,/NATIVE_API_BASE_URL[\s\S]{0,180}https:\/\/testing\.86chaos\.com/);
  assert.match(core,/nativeApiRequestPath/);
  assert.match(core,/^\/api\//m);
  assert.match(core,/CapacitorHttp\.request\(/);
  assert.match(core,/window\.fetch = nativeApiFetch/);
  assert.match(core,/Firebase SDK unchanged|firebaseTransport/i);
});

test('18.0.1 native release identities align on Android and iOS',()=>{
  const pkg=json('package.json');
  const android=read('android/app/build.gradle');
  const ios=read('ios/App/App.xcodeproj/project.pbxproj');
  assert.equal(pkg.version,'18.0.1');
  assert.match(android,/versionCode 180001/);
  assert.match(android,/versionName "18\.0\.1"/);
  assert.match(ios,/CURRENT_PROJECT_VERSION = 180001;/);
  assert.match(ios,/MARKETING_VERSION = 18\.0\.1;/);
});

test('Android preview publishing stays isolated to explicit mobile preview commits',()=>{
  const workflow=read('.github/workflows/mobile-targeted-gate.yml');
  assert.match(workflow,/\[android-preview\]/);
  assert.match(workflow,/assembleDebug/);
  assert.match(workflow,/86chaos-mobile-preview-debug-keystore-v1/);
  assert.match(workflow,/mobile-v18\.0\.1-preview/);
  assert.match(workflow,/--prerelease/);
});

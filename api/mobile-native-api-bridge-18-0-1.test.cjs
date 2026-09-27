'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));
const escVersion=value=>String(value).split('.').join('\\.');

test('18.0.x native API bridge intercepts only local /api traffic and targets testing backend',()=>{
  const core=read('src/core/appCore.js');
  const cap=json('capacitor.config.json');
  const contract=json('mobile/native-platform-contract.json');
  assert.equal(cap.server.hostname,'testing.86chaos.com');
  assert.equal(contract.nativeApiBridge.backendBaseUrl,'https://testing.86chaos.com');
  assert.equal(contract.nativeApiBridge.transport,'CapacitorHttp');
  assert.match(core,/import \{ Capacitor, CapacitorHttp \} from '@capacitor\/core'/);
  assert.match(core,/NATIVE_API_BASE_URL[\s\S]{0,180}https:\/\/testing\.86chaos\.com/);
  assert.match(core,/nativeApiRequestPath/);
  assert.match(core,/if \(\/\^\\\/api\\\//);
  assert.match(core,/CapacitorHttp\.request\(/);
  assert.match(core,/window\.fetch = nativeApiFetch/);
  assert.equal(contract.nativeApiBridge.firebaseTransport,'browser Firebase SDK unchanged');
});

test('current 18.0.x native release identities align on Android and iOS',()=>{
  const pkg=json('package.json');
  const contract=json('mobile/native-platform-contract.json');
  const android=read('android/app/build.gradle');
  const ios=read('ios/App/App.xcodeproj/project.pbxproj');
  assert.match(pkg.version,/^18\.0\.\d+$/);
  assert.equal(contract.release,pkg.version);
  assert.equal(contract.capacitor.android.versionName,pkg.version);
  assert.equal(contract.capacitor.ios.marketingVersion,pkg.version);
  assert.match(android,new RegExp('versionCode '+contract.capacitor.android.versionCode+'\\b'));
  assert.match(android,new RegExp('versionName "'+escVersion(pkg.version)+'"'));
  assert.match(ios,new RegExp('CURRENT_PROJECT_VERSION = '+contract.capacitor.ios.currentProjectVersion+';'));
  assert.match(ios,new RegExp('MARKETING_VERSION = '+escVersion(pkg.version)+';'));
});

test('Android preview publishing stays isolated to explicit mobile preview commits',()=>{
  const workflow=read('.github/workflows/mobile-targeted-gate.yml');
  const pkg=json('package.json');
  assert.match(workflow,/\[android-preview\]/);
  assert.match(workflow,/assembleDebug/);
  assert.match(workflow,/86chaos-mobile-preview-debug-keystore-v1/);
  assert.match(workflow,new RegExp('mobile-v'+escVersion(pkg.version)+'-preview'));
  assert.match(workflow,/--prerelease/);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test('18.0.0 is pinned to the exact deployed 17.0.42 mobile baseline',()=>{
  const pkg=json('package.json');
  const lock=json('package-lock.json');
  const version=json('public/version.json');
  const contract=json('mobile/native-platform-contract.json');
  assert.match(pkg.version,/^18\.0\./);
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[''].version,pkg.version);
  assert.equal(version.version,pkg.version);
  assert.equal(contract.baseline.version,'17.0.42');
  assert.equal(contract.baseline.commit,'e35079bccabb967b5a637b8faa6f40b5f0af2e31');
  assert.equal(contract.branch,'mobile');
});

test('Capacitor contract packages the local React build for both Android and iOS',()=>{
  const config=json('capacitor.config.json');
  const contract=json('mobile/native-platform-contract.json');
  assert.equal(config.appId,'com.chiltonappworks.chaos86');
  assert.equal(config.appName,'86 Chaos');
  assert.equal(config.webDir,'build');
  assert.equal(config.server.androidScheme,'https');
  assert.equal(config.server.iosScheme,'https');
  assert.equal(config.server.url,undefined,'native package must not remote-load a mutable web URL');
  const pkg=json('package.json');
  assert.match(pkg.dependencies['@capacitor/core'],/^\^8\./);
  assert.match(pkg.dependencies['@capacitor/android'],/^\^8\./);
  assert.match(pkg.dependencies['@capacitor/ios'],/^\^8\./);
  assert.match(pkg.devDependencies['@capacitor/cli'],/^\^8\./);
  assert.deepEqual(contract.platforms,['android','ios']);
  assert.equal(contract.equalPlatformPriority,true);
  assert.deepEqual(contract.requiredCoverage.includes('android-responsive'),true);
  assert.deepEqual(contract.requiredCoverage.includes('ios-responsive'),true);
  assert.deepEqual(contract.requiredCoverage.includes('real-device-before-public-release'),true);
});

test('mobile branch remains locked to testing Firebase and introduces no paid service',()=>{
  const contract=json('mobile/native-platform-contract.json');
  const core=read('src/core/appCore.js');
  assert.equal(contract.firebase.environment,'testing');
  assert.equal(contract.firebase.projectId,'chaos-test-d1601');
  assert.equal(contract.firebase.separateMobileProject,false);
  assert.equal(contract.firebase.productionProjectAllowed,false);
  assert.equal(contract.costControls.newPaidServices,false);
  assert.match(core,/currentHostname\.endsWith\('\.vercel\.app'\)/);
  assert.match(core,/\? 'chaos-test-d1601'/);
});

test('backgrounded native Android and iOS sessions shed idle Firestore listeners quickly while preserving cache',()=>{
  const core=read('src/core/appCore.js');
  const contract=json('mobile/native-platform-contract.json');
  assert.equal(contract.costControls.nativeBackgroundReleaseGraceMs,15000);
  assert.equal(contract.costControls.persistentLocalCache,true);
  assert.equal(contract.costControls.sharedListeners,true);
  assert.equal(contract.costControls.realtimeDatabasePresenceInsteadOfFirestoreHeartbeat,true);
  assert.equal(contract.capacitor.version,'8.5.2');
  assert.ok(contract.capacitor.android.versionCode>=180000);
  assert.equal(contract.capacitor.android.versionName,pkg.version);
  assert.ok(contract.capacitor.ios.currentProjectVersion>=180000);
  assert.equal(contract.capacitor.ios.marketingVersion,pkg.version);
  const androidBuild=read('android/app/build.gradle');
  const androidManifest=read('android/app/src/main/AndroidManifest.xml');
  const iosProject=read('ios/App/App.xcodeproj/project.pbxproj');
  const iosPlist=read('ios/App/App/Info.plist');
  assert.match(androidBuild,/versionCode 18\d{4}/);
  assert.match(androidBuild,new RegExp(`versionName "${pkg.version.replace(/\./g,'\\.') }"`));
  assert.match(androidManifest,/android\.permission\.CAMERA/);
  assert.match(androidManifest,/android\.permission\.RECORD_AUDIO/);
  assert.match(androidManifest,/android\.permission\.POST_NOTIFICATIONS/);
  assert.match(iosProject,/CURRENT_PROJECT_VERSION = 18\d{4};/);
  assert.match(iosProject,new RegExp(`MARKETING_VERSION = ${pkg.version.replace(/\./g,'\\.')};`));
  assert.match(iosPlist,/NSCameraUsageDescription/);
  assert.match(iosPlist,/NSMicrophoneUsageDescription/);
  assert.match(core,/getNativeMobilePlatform/);
  assert.match(core,/platform === 'android' \|\| platform === 'ios'/);
  assert.match(core,/MOBILE_NATIVE_BACKGROUND_RELEASE_GRACE_MS = 15 \* 1000/);
  assert.match(core,/nativeRuntimeIsBackgrounded/);
  assert.match(core,/listenerReleaseGraceMs\(current, 'collection'\)/);
  assert.match(core,/listenerReleaseGraceMs\(current, 'document'\)/);
  assert.match(core,/setLiveCacheEntry\(liveCollectionSessionCache/);
  assert.match(core,/setLiveCacheEntry\(liveDocumentSessionCache/);
});

test('18.0.0 mobile change has explicit Release Gate coverage and isolated Vercel deployment',()=>{
  const vercel=json('vercel.json');
  const universe=read('scripts/86chaos-release-gate/release-test-universe.cjs');
  assert.equal(vercel.git.deploymentEnabled.mobile,true);
  assert.match(universe,/58-native-mobile-cost-foundation\.spec\.cjs/);
  const pkg=json('package.json');
  assert.match(pkg.scripts['test:current-release-targeted'],/mobile-native-foundation-18-0-0\.test\.cjs/);
  assert.equal(pkg.scripts['test:mobile-release-gate'],'playwright test --config=playwright.mobile-foundation.config.cjs');
});

#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),json=file=>JSON.parse(read(file));
const v='18.0.3',p=json('package.json'),l=json('package-lock.json'),pub=json('public/version.json'),cap=json('capacitor.config.json'),contract=json('mobile/native-platform-contract.json');
assert.equal(p.version,v);assert.equal(l.version,v);assert.equal(l.packages[''].version,v);assert.equal(pub.version,v);assert.equal(pub.build,v);
assert.equal(p.scripts['test:source'],'node scripts/validate-18-0-3.js');assert.equal(p.scripts['validate:18.0.3'],'node scripts/validate-18-0-3.js');
assert.match(p.scripts['test:current-release-targeted'],/mobile-native-api-bridge-18-0-1\.test\.cjs/);
assert.match(read('api/_version.js'),/APP_VERSION = '18\.0\.3'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '18\.0\.3'/);
assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '18\.0\.3'/);
assert.equal(cap.server.hostname,'testing.86chaos.com');assert.equal(contract.release,v);
assert.equal(contract.capacitor.android.versionCode,180003);assert.equal(contract.capacitor.android.versionName,v);
assert.equal(contract.capacitor.ios.currentProjectVersion,180003);assert.equal(contract.capacitor.ios.marketingVersion,v);
assert.equal(contract.nativeApiBridge.backendBaseUrl,'https://testing.86chaos.com');assert.equal(contract.nativeApiBridge.transport,'CapacitorHttp');
assert.match(read('src/core/appCore.js'),/CapacitorHttp\.request\(/);assert.match(read('src/core/appCore.js'),/window\.fetch = nativeApiFetch/);
assert.match(read('android/app/build.gradle'),/versionCode 180003/);assert.match(read('android/app/build.gradle'),/versionName "18\.0\.3"/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/CURRENT_PROJECT_VERSION = 180003;/);assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/MARKETING_VERSION = 18\.0\.3;/);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(file).release,v);
console.log('18.0.3 targeted mobile patch-safety repair validated.');

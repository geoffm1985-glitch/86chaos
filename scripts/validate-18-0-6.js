#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),bin=file=>fs.readFileSync(path.join(root,file)),json=file=>JSON.parse(read(file));
const v='18.0.6',p=json('package.json'),l=json('package-lock.json'),pub=json('public/version.json'),contract=json('mobile/native-platform-contract.json');
assert.equal(p.version,v);assert.equal(l.version,v);assert.equal(l.packages[''].version,v);assert.equal(pub.version,v);assert.equal(pub.build,v);
assert.equal(p.scripts['test:source'],'node scripts/validate-18-0-6.js');assert.equal(p.scripts['validate:18.0.6'],'node scripts/validate-18-0-6.js');
assert.match(read('api/_version.js'),/APP_VERSION = '18\.0\.6'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '18\.0\.6'/);
assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '18\.0\.6'/);
assert.match(read('android/app/build.gradle'),/versionCode 180006/);assert.match(read('android/app/build.gradle'),/versionName "18\.0\.6"/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/CURRENT_PROJECT_VERSION = 180006;/);assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/MARKETING_VERSION = 18\.0\.6;/);
assert.match(read('android/app/src/main/java/com/chiltonappworks/chaos86/MainActivity.java'),/WindowInsetsCompat\.Type\.systemBars\(\)/);
assert.match(read('android/app/src/main/AndroidManifest.xml'),/@drawable\/chaos86_app_icon/);
assert.ok(bin('android/app/src/main/res/drawable-nodpi/chaos86_app_icon.png').equals(bin('public/86chaos-pwa-512-v4.png')));
assert.equal(contract.release,v);assert.equal(contract.capacitor.android.versionCode,180006);assert.equal(contract.capacitor.ios.currentProjectVersion,180006);
assert.doesNotMatch(read('api/mobile-native-system-bars-branding-18-0-4.test.cjs'),/assert\.equal\(pkg\.version,'18\.0\.4'\)/);
for(const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(file).release,v);
console.log('18.0.6 native targeted identity test repair validated.');

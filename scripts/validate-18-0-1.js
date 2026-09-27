#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const v='18.0.1',p=json('package.json'),l=json('package-lock.json'),pub=json('public/version.json'),cap=json('capacitor.config.json'),contract=json('mobile/native-platform-contract.json');
assert.equal(p.version,v);assert.equal(l.version,v);assert.equal(l.packages[''].version,v);assert.equal(pub.version,v);assert.equal(pub.build,v);
assert.equal(p.scripts['test:source'],'node scripts/validate-18-0-1.js');
assert.equal(p.scripts['validate:18.0.1'],'node scripts/validate-18-0-1.js');
assert.match(p.scripts['test:current-release-targeted'],/mobile-native-api-bridge-18-0-1\.test\.cjs/);
assert.match(read('api/_version.js'),/APP_VERSION = '18\.0\.1'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '18\.0\.1'/);
assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '18\.0\.1'/);
assert.equal(cap.server.hostname,'testing.86chaos.com');
assert.equal(contract.release,v);assert.equal(contract.nativeApiBridge.backendBaseUrl,'https://testing.86chaos.com');assert.equal(contract.nativeApiBridge.transport,'CapacitorHttp');
assert.match(read('src/core/appCore.js'),/CapacitorHttp\.request\(/);assert.match(read('src/core/appCore.js'),/window\.fetch = nativeApiFetch/);
assert.match(read('android/app/build.gradle'),/versionCode 180001/);assert.match(read('android/app/build.gradle'),/versionName "18\.0\.1"/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/CURRENT_PROJECT_VERSION = 180001;/);assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/MARKETING_VERSION = 18\.0\.1;/);
for(const f of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(f).release,v);
assert.match(read('scripts/86chaos-release-gate/release-test-universe.cjs'),/59-native-packaged-api-bridge\.spec\.cjs/);
console.log('18.0.1 native packaged API bridge validated.');

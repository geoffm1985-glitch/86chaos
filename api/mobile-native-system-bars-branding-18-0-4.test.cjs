'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const bin=file=>fs.readFileSync(path.join(root,file));
const json=file=>JSON.parse(read(file));

test('18.0.x Android WebView respects status navigation and cutout insets',()=>{
  const activity=read('android/app/src/main/java/com/chiltonappworks/chaos86/MainActivity.java');
  assert.match(activity,/WindowCompat\.setDecorFitsSystemWindows\(getWindow\(\), false\)/);
  assert.match(activity,/WindowInsetsCompat\.Type\.systemBars\(\)/);
  assert.match(activity,/WindowInsetsCompat\.Type\.displayCutout\(\)/);
  assert.match(activity,/setOnApplyWindowInsetsListener/);
  assert.match(activity,/view\.setPadding\(safeInsets\.left, safeInsets\.top, safeInsets\.right, safeInsets\.bottom\)/);
  assert.match(activity,/setAppearanceLightStatusBars\(false\)/);
  assert.match(activity,/setAppearanceLightNavigationBars\(false\)/);
});

test('18.0.x Android launcher uses the branded 86 Chaos asset instead of Capacitor defaults',()=>{
  const manifest=read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest,/android:icon="@drawable\/chaos86_app_icon"/);
  assert.match(manifest,/android:roundIcon="@drawable\/chaos86_app_icon"/);
  assert.ok(bin('android/app/src/main/res/drawable-nodpi/chaos86_app_icon.png').equals(bin('public/86chaos-pwa-512-v4.png')));
});

test('native Android and iPhone runtime paths are explicitly marked for safe-area behavior',()=>{
  const core=read('src/core/appCore.js');
  const css=read('src/styles.css');
  assert.match(core,/installNativeViewportClass/);
  assert.match(core,/chaos-native-runtime/);
  assert.match(core,/chaos-native-\$\{platform\}/);
  assert.match(css,/html\.chaos-native-ios body/);
  assert.match(css,/env\(safe-area-inset-top, 0px\)/);
  assert.match(css,/env\(safe-area-inset-bottom, 0px\)/);
});

test('18.0.4 native identities remain aligned',()=>{
  const pkg=json('package.json');
  const android=read('android/app/build.gradle');
  assert.equal(pkg.version,'18.0.4');
  assert.match(android,/versionCode 180004/);
  assert.match(android,/versionName "18\.0\.4"/);
});

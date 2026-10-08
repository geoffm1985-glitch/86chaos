'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));

test('Android activity constrains the native content container instead of padding the WebView',()=>{
  const activity=read('android/app/src/main/java/com/chiltonappworks/chaos86/MainActivity.java');
  assert.match(activity,/findViewById\(android\.R\.id\.content\)/);
  assert.match(activity,/setOnApplyWindowInsetsListener\(contentView/);
  assert.match(activity,/ViewCompat\.requestApplyInsets\(contentView\)/);
  assert.match(activity,/contentView\.setBackgroundColor/);
  assert.match(activity,/webView\.setPadding\(0, 0, 0, 0\)/);
  assert.match(activity,/setClipToPadding\(true\)/);
  assert.match(activity,/WindowInsetsCompat\.Type\.systemBars\(\)/);
  assert.match(activity,/WindowInsetsCompat\.Type\.displayCutout\(\)/);
  assert.doesNotMatch(activity,/setOnApplyWindowInsetsListener\(webView/);
});

test('18.0.7 native container inset contract remains active for the current Android build',()=>{
  const pkg=json('package.json');
  const contract=json('mobile/native-platform-contract.json');
  const android=read('android/app/build.gradle');
  assert.match(pkg.version,/^18\.0\.\d+$/);
  assert.equal(contract.release,pkg.version);
  assert.equal(contract.nativeViewport.android.containerPadding,true);
  assert.equal(contract.nativeViewport.android.webViewPadding,false);
  assert.equal(contract.nativeViewport.android.clipToPadding,true);
  assert.match(android,new RegExp(`versionCode ${contract.capacitor.android.versionCode}`));
  assert.ok(android.includes(`versionName "${pkg.version}"`));
});

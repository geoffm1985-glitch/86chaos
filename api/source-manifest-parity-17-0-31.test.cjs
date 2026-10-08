'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const identity=require('../scripts/86chaos-release-gate/source-identity.cjs');
const root=path.resolve(__dirname,'..');

test('17.0.31 normalizes TypeScript CRLF and LF identically',()=>{
  for(const file of ['functions/src/example.ts','src/example.tsx']){
    const lf=Buffer.from('const value = 1;\nexport default value;\n','utf8');
    const crlf=Buffer.from('const value = 1;\r\nexport default value;\r\n','utf8');
    assert.equal(identity.hash(identity.sourceBytes(file,crlf)),identity.hash(identity.sourceBytes(file,lf)),file);
  }
});

test('17.0.31 declares deterministic TypeScript Git line endings',()=>{
  const attrs=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');
  assert.match(attrs,/^\*\.ts text eol=lf$/m);
  assert.match(attrs,/^\*\.tsx text eol=lf$/m);
});

test('native Android and iOS source hashes survive Windows and Linux checkouts',()=>{
  const lf=Buffer.from('native source line\nsecond line\n','utf8');
  const crlf=Buffer.from('native source line\r\nsecond line\r\n','utf8');
  for(const file of ['android/app/build.gradle','android/gradle.properties','android/app/proguard-rules.pro','android/MainActivity.java','android/AndroidManifest.xml','android/gradlew','android/gradlew.bat','ios/project.pbxproj','ios/Info.plist','ios/AppDelegate.swift','ios/Main.storyboard','ios/debug.xcconfig']){
    assert.equal(identity.hash(identity.sourceBytes(file,crlf)),identity.hash(identity.sourceBytes(file,lf)),file);
  }
  for(const file of ['android/gradle/wrapper/gradle-wrapper.jar','android/icon.png']){
    assert.notEqual(identity.hash(identity.sourceBytes(file,crlf)),identity.hash(identity.sourceBytes(file,lf)),file);
  }
});

test('clean native checkout matches the committed source inventory',t=>{
  const git=identity.gitIdentity(root);
  if(git.dirty){t.skip('requires a clean committed checkout');return;}
  const committed=identity.committedSourceFiles(root);
  if(committed)assert.deepEqual(identity.captureSourceIdentity(root).files,committed);
});

test('17.0.31 bundled manifest exactly matches tracked certification source',()=>{
  const captured=identity.captureSourceIdentity(root);
  const bundled=identity.readBundledSourceManifest(root);
  assert.ok(bundled);
  assert.equal(captured.sourceHash,bundled.sourceHash);
  assert.equal(captured.files.length,bundled.files.length);
});

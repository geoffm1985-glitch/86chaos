'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),json=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
test('17.0.37 pins jwks-rsa to CommonJS-compatible JOSE 4.15.9 while retaining Firebase Admin 14.5',()=>{
  const pkg=json('package.json'),lock=json('package-lock.json');
  assert.equal(pkg.dependencies['firebase-admin'],'14.5.0');
  assert.equal(lock.packages['node_modules/firebase-admin'].version,'14.5.0');
  assert.equal(pkg.overrides?.['jwks-rsa']?.jose,'4.15.9');
  assert.equal(lock.packages['node_modules/jwks-rsa'].version,'4.1.0');
  assert.equal(lock.packages['node_modules/jwks-rsa/node_modules/jose'].version,'4.15.9');
  assert.match(lock.packages['node_modules/jwks-rsa/node_modules/jose'].resolved,/jose-4\.15\.9\.tgz$/);
});
test('installed jwks-rsa dependency sees nested JOSE 4 and Firebase Admin request paths remain WHATWG-based',()=>{
  const nested=path.join(root,'node_modules','jwks-rsa','node_modules','jose','package.json');
  assert.ok(fs.existsSync(nested),'npm ci must materialize the overridden nested JOSE package');
  assert.equal(JSON.parse(fs.readFileSync(nested,'utf8')).version,'4.15.9');
  assert.doesNotThrow(()=>require('jwks-rsa'));
  for(const file of ['node_modules/firebase-admin/lib/utils/api-request.js','node_modules/firebase-admin/lib/utils/validator.js']){
    const source=fs.readFileSync(path.join(root,file),'utf8'); assert.doesNotMatch(source,/\burl\.parse\s*\(/);
  }
});

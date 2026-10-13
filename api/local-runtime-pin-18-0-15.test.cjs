'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {assertPinMatches,createRuntimePin}=require('../scripts/pin-local-release-runtime.cjs');
const {prepareYardmasterEnv}=require('../scripts/start-yardmaster.cjs');
const identity={commit:'a'.repeat(40),branch:'mobile',version:'18.0.15',sourceHash:'b'.repeat(64),dirty:false};
test('local release identity rejects changed source, commit, branch, version and dirty evidence',()=>{
  assert.doesNotThrow(()=>assertPinMatches(identity,{...identity}));
  for(const patch of [{commit:'c'.repeat(40)},{sourceHash:'d'.repeat(64)},{branch:'testing'},{version:'17.0.86'},{dirty:true}])assert.throws(()=>assertPinMatches(identity,{...identity,...patch}),error=>error.code==='local_release_source_changed');
});
test('local source pin remains immutable when a production build overwrites public metadata',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-runtime-pin-'));let callback,current={...identity},closed=false;
  fs.writeFileSync(path.join(temp,'release-source-manifest.json'),JSON.stringify({sourceHash:identity.sourceHash}));
  try{
    const pin=createRuntimePin(temp,{capture:()=>current,stamp:()=>({...identity,identityStampStatus:'verified'}),watch:(_root,_options,listener)=>{callback=listener;return{on(){},close(){closed=true;}};}});
    fs.mkdirSync(path.join(temp,'public'));fs.writeFileSync(path.join(temp,'public/build-identity.json'),JSON.stringify({commit:'different-build'}));
    callback('change','public/build-identity.json');assert.equal(pin.verify().commit,identity.commit);
    current={...identity,sourceHash:'changed'};callback('change','src/App.js');assert.throws(()=>pin.verify());pin.close();assert.equal(closed,true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('local emulator startup never inherits cloud Git identity authority',()=>{
  const env={YARDMASTER_FIREBASE_TARGET:'emulator',VERCEL:'1',VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:'wrong',VERCEL_GIT_COMMIT_REF:'main'};
  prepareYardmasterEnv(env);assert.equal(env.VERCEL,undefined);assert.equal(env.VERCEL_GIT_COMMIT_SHA,undefined);assert.equal(env.REACT_APP_86CHAOS_FIREBASE_TARGET,'emulator');
});

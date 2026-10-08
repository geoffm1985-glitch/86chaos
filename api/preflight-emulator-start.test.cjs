'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const target=require('../scripts/86chaos-firebase-target.cjs');
function fixture(report,{selection='emulator',preflightExit=0,sourceExit=0}={}){
  const calls=[],evidence=[];
  const fakeProcess={execPath:process.execPath,platform:process.platform,env:{YARDMASTER_FIREBASE_TARGET:selection,APP_URL:'https://testing.86chaos.com',CHAOS_BASE_URL:'https://testing.86chaos.com',CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL:'https://stale.vercel.app'}};
  const module={exports:{}};
  const context={module,exports:module.exports,process:fakeProcess,__dirname:path.join(root,'scripts/86chaos-release-gate'),console:{log(){}},URL,
    require(name){
      if(name==='node:child_process')return {spawnSync(command,args,options){calls.push({command,args,env:{...options.env}});return {status:calls.length===1?preflightExit:sourceExit}}};
      if(name==='node:fs')return {readFileSync:()=>JSON.stringify(report),writeFileSync(file,text){evidence.push(JSON.parse(text))}};
      if(name==='node:path')return path;
      if(name==='../86chaos-firebase-target.cjs')return target;
      if(name==='./run-context.cjs')return {ensureRunDir:()=>({runDir:'fixture-run'})};
      throw new Error('Unexpected fixture dependency: '+name);
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/86chaos-release-gate/preflight-and-start.cjs'),'utf8'),context);
  return {start:module.exports.start,calls,evidence};
}
const local={ok:true,firebaseTarget:'EMULATOR',firebaseProjectId:'demo-86chaos',appUrl:'http://127.0.0.1:3000',resolvedImmutableDeploymentUrl:''};
test('launch readiness: verified emulator reaches the source validator and preserves loopback target',()=>{
  const f=fixture(local);assert.equal(f.start(),0);assert.equal(f.calls.length,2);
  for(const call of f.calls){assert.equal(call.env.APP_URL,local.appUrl);assert.equal(call.env.CHAOS_BASE_URL,local.appUrl)}
  assert.equal(f.calls[1].env.CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL,undefined);
  assert.equal(f.evidence[0].certified,false);
});
for(const [label,change] of [['remote URL',{appUrl:'https://testing.86chaos.com'}],['live project',{firebaseProjectId:'cheers-34b8d'}],['unproven selection',{firebaseTarget:'LIVE'}]]){
  test('launch readiness: emulator rejects '+label,()=>{const f=fixture({...local,...change});assert.throws(f.start,/local Firebase emulator target/);assert.equal(f.calls.length,1)});
}
test('launch readiness: live testing still requires immutable deployment evidence',()=>{const f=fixture({...local,firebaseTarget:'LIVE'},{selection:'live'});assert.throws(f.start,/immutable deployment/);assert.equal(f.calls.length,1)});
test('launch readiness: a verified live deployment retains its identity',()=>{const report={...local,firebaseTarget:'LIVE',resolvedImmutableDeploymentUrl:'https://86chaos-exact.vercel.app'};const f=fixture(report,{selection:'live'});assert.equal(f.start(),0);assert.equal(f.calls[1].env.CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL,report.resolvedImmutableDeploymentUrl)});
test('launch readiness: failed preflight never launches source validation',()=>{const f=fixture(local,{preflightExit:2});assert.equal(f.start(),2);assert.equal(f.calls.length,1)});
test('launch readiness: source validation failure still blocks tests',()=>{const f=fixture(local,{sourceExit:3});assert.equal(f.start(),3);assert.equal(f.evidence[0].exitCode,3)});

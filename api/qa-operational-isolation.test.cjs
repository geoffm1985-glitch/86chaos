'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {profileForAccount}=require('../scripts/86chaos-release-gate/provision-test-accounts.cjs');
const onboarding=require('../scripts/86chaos-release-gate/qa-onboarding-baseline.cjs');
const {restoreQaLanguage}=require('../tests/86chaos-full-audit/utils/qa-language-isolation.cjs');

test('operational QA profiles are configured before authentication hydration',()=>{
  for(const key of ['owner','manager','staff','systemAdmin']){
    const profile=profileForAccount({key,email:`86chaos.qa.${key}@example.test`,label:key},`qa-${key}`,'current-run');
    assert.equal(profile.onboardingComplete,true);assert.equal(profile.onboardingTourSeen,true);assert.equal(profile.managerOnboardingSeen,true);assert.equal(profile.preferences.language,'en');
    assert.equal(profile.testingOnly,true);assert.equal(profile.qaOwned,true);
  }
  assert.equal(Object.isFrozen(onboarding),true);
});

function fixture(){
  const account={email:'86chaos.qa.owner@example.test'};
  const fields={email:{stringValue:account.email},qaRoleAccount:{booleanValue:true},qaLastRunId:{stringValue:'current-run'},preferences:{mapValue:{fields:{language:{stringValue:'es'},timeFormat:{stringValue:'24h'}}}}};
  const calls=[];
  const input={account,seed:{ok:true,runId:'current-run',firebaseProjectId:'chaos-test-d1601',roleAccounts:[{uid:'qa-owner',email:account.email}]},runId:'current-run',config:{projectId:'chaos-test-d1601'},signed:{uid:'qa-owner',email:account.email,idToken:'test-token',firebaseProjectId:'chaos-test-d1601'},origin:'https://firestore.googleapis.com',fetchImpl:async(url,init)=>{calls.push({url:String(url),init});if(init.method==='PATCH')fields.preferences.mapValue.fields.language.stringValue='en';return {ok:true,status:200,json:async()=>({fields})};}};
  return {input,fields,calls};
}
test('language cleanup verifies English independently of a browser page and preserves other preferences',async()=>{
  const {input,calls,fields}=fixture();await restoreQaLanguage(input);
  assert.equal(calls.length,3);assert.equal(calls[1].init.method,'PATCH');
  assert.equal(new URL(calls[1].url).searchParams.get('updateMask.fieldPaths'),'preferences.language');
  assert.equal(fields.preferences.mapValue.fields.timeFormat.stringValue,'24h');
  assert.equal(fields.preferences.mapValue.fields.language.stringValue,'en');
});
test('language cleanup refuses stale seed evidence before any write',async()=>{const {input,calls}=fixture();input.seed.runId='old-run';await assert.rejects(restoreQaLanguage(input),/current QA seed/);assert.equal(calls.length,0);});
test('language cleanup refuses foreign project evidence before any write',async()=>{const {input,calls}=fixture();input.config.projectId='production';await assert.rejects(restoreQaLanguage(input),/foreign Firebase/);assert.equal(calls.length,0);});
test('language cleanup refuses protected or mismatched accounts',async()=>{for(const mutate of [x=>x.account.email='geoffm1985@gmail.com',x=>x.signed.uid='other-user',x=>x.signed.email='other@example.test']){const {input,calls}=fixture();mutate(input);await assert.rejects(restoreQaLanguage(input),/unverified QA account/);assert.equal(calls.length,0);}});
test('language cleanup refuses stale or unowned persisted profiles',async()=>{for(const mutate of [x=>x.qaRoleAccount.booleanValue=false,x=>x.qaLastRunId.stringValue='old-run',x=>x.email.stringValue='other@example.test']){const {input,fields,calls}=fixture();mutate(fields);await assert.rejects(restoreQaLanguage(input),/stale or unowned/);assert.equal(calls.length,1);}});
test('language cleanup propagates write failures instead of claiming restoration',async()=>{const {input}=fixture();const original=input.fetchImpl;input.fetchImpl=async(url,init)=>init.method==='PATCH'?{ok:false,status:403}:original(url,init);await assert.rejects(restoreQaLanguage(input),/failed \(403\)/);});
test('language cleanup requires independent readback after a successful write',async()=>{const {input}=fixture();const original=input.fetchImpl;input.fetchImpl=async(url,init)=>init.method==='PATCH'?{ok:true,json:async()=>({})}:original(url,init);await assert.rejects(restoreQaLanguage(input),/could not verify/);});

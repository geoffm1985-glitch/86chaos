'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readMfaEnrollment,mfaCoverage,configurationEvidence}=require('./_security-posture-evidence.cjs');
test('MFA enrollment cannot be established by a writable profile flag',async()=>{
  const app={auth:()=>({getUser:async()=>({multiFactor:{enrolledFactors:[]}})})};
  assert.deepEqual(await readMfaEnrollment(app,{id:'a',mfaEnabled:true,multiFactorEnabled:true}),{state:'verified-auth',enrolled:false});
});
test('MFA Auth lookup failure stays unknown and does not become a clean account',async()=>{
  const enrollment=await readMfaEnrollment({auth:()=>({getUser:async()=>{throw new Error('unavailable');}})},{id:'a',mfaEnabled:true});
  assert.equal(enrollment.state,'unknown');
  assert.equal(mfaCoverage({pairs:[{enrollment}],elevatedCount:1,userCount:1}).status,'unknown');
});
test('bounded MFA sampling cannot label unexamined accounts protected',()=>{
  const pairs=[{enrollment:{state:'verified-auth',enrolled:true}}];
  assert.equal(mfaCoverage({pairs,elevatedCount:201,userCount:300}).complete,false);
  assert.equal(mfaCoverage({pairs,elevatedCount:1,userCount:500}).status,'unknown');
  assert.equal(mfaCoverage({pairs,elevatedCount:1,userCount:1}).status,'verified-sample-clear');
});
test('configuration reports separate API controls from unverified live console/rules/credentials',()=>{
  const result=configurationEvidence({projectId:'demo-86chaos',appCheckEnforced:true,mfaEnforced:false,securityStatus:{firestoreRulesPublishedAt:'today',firestoreRulesSourceHash:'hash'}});
  assert.equal(result.apiAppCheckEnforced,true);assert.equal(result.firebaseConsoleAppCheckEnforcement,'unknown');assert.equal(result.firestoreRules.liveVerified,false);assert.equal(result.storageRules.status,'unknown');
});

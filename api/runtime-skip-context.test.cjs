'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {validateReleaseSkips,requiredSkipCoverage}=require('../scripts/86chaos-release-gate/expected-skips.cjs');
const targets=[
  {file:'86chaos-release-gate/69-yardmaster-firebase-bridge-17-0-57.spec.cjs',title:'17.0.57 Yardmaster Firebase bridge > local Yardmaster observes actual SDK readiness and blocks live Firebase',reason:'Requires the focused local emulator bridge runner.'},
  {file:'86chaos-release-gate/76-emulator-runtime-boundaries-17-0-64.spec.cjs',title:'17.0.64 emulator runtime-boundary cascade repair > System Administrator emulator route has no Firestore internal assertion, Storage-root 501, or CRA runtime overlay',reason:'This runtime regression is specific to the Yardmaster Firebase emulator target.'}
];
const context={target:'LIVE',projectId:'chaos-test-d1601',appUrl:'https://testing.86chaos.com'};
function rows(target){const skipped={...target,projectName:'chromium',status:'skipped',annotations:[{type:'skip',description:target.reason}]};return [skipped,...requiredSkipCoverage(skipped).map(row=>({...row,status:'passed'}))];}
for(const target of targets){
 test(target.file+' requires verified testing context and real companion evidence',()=>{
   assert.equal(validateReleaseSkips(rows(target),{firebaseContext:context}).ok,true);
   for(const firebaseContext of [null,{...context,target:'EMULATOR'},{...context,projectId:'cheers-34b8d'},{...context,appUrl:'https://app.86chaos.com'}])assert.equal(validateReleaseSkips(rows(target),{firebaseContext}).ok,false);
   assert.equal(validateReleaseSkips(rows(target).slice(0,1),{firebaseContext:context}).ok,false);
   const failed=rows(target);failed[1].status='failed';assert.equal(validateReleaseSkips(failed,{firebaseContext:context}).ok,false);
   const forged=rows(target);forged[0].annotations=[];assert.equal(validateReleaseSkips(forged,{firebaseContext:context}).ok,false);
 });
}
test('desktop direct-touch exclusion requires its identical mobile test to actually pass',()=>{
 const target={file:'86chaos-release-gate/57-sticky-header-touch-handoff.spec.cjs',title:'57 Schedule Builder direct-touch sticky header handoff > mobile direct-touch drag keeps day header below sticky control deck',reason:'Direct-touch regression is mobile-specific.'};
 assert.equal(validateReleaseSkips(rows(target)).ok,true);
 assert.equal(validateReleaseSkips(rows(target).slice(0,1)).ok,false);
 const failed=rows(target);failed[1].status='timedOut';assert.equal(validateReleaseSkips(failed).ok,false);
});

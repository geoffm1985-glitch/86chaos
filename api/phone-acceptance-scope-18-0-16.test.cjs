const test=require('node:test'),assert=require('node:assert/strict');
const {resolvePhoneAcceptanceScope}=require('../scripts/86chaos-release-gate/phone-acceptance-scope.cjs');
test('full scope retains connected-phone evidence requirements by default',()=>{
  assert.deepEqual(resolvePhoneAcceptanceScope(),{connectedPhoneExcluded:false,excludedArtifactGroups:[],failures:[]});
});
test('explicit local demo scope excludes only phone acceptance artifacts and disclaims physical certification',()=>{
  const scope=resolvePhoneAcceptanceScope({requested:true,target:'emulator',projectId:'demo-86chaos',appUrl:'http://127.0.0.1:3000'});
  assert.equal(scope.connectedPhoneExcluded,true);assert.deepEqual(scope.excludedArtifactGroups,['real-device','native-mobile-foundation']);assert.match(scope.label,/certification is not granted/);
});
test('live, foreign-project and nonlocal exclusions fail closed',()=>{
  for(const patch of [{target:'live'},{projectId:'cheers-34b8d'},{appUrl:'https://app.86chaos.com'},{appUrl:'http://127.0.0.1.evil.test'}]){
    const scope=resolvePhoneAcceptanceScope({requested:true,target:'emulator',projectId:'demo-86chaos',appUrl:'http://127.0.0.1:3000',...patch});
    assert.equal(scope.connectedPhoneExcluded,false);assert.equal(scope.excludedArtifactGroups.length,0);assert.equal(scope.failures.length,1);
  }
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),script=path.join(root,'scripts/validate-current-release.cjs');
const contractPath=path.join(root,'mobile/native-platform-contract.json');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const code=Number(fs.readFileSync(path.join(root,'android/app/build.gradle'),'utf8').match(/versionCode (\d+)/)[1]);
function coherentContract(){
 const contract=JSON.parse(fs.readFileSync(contractPath,'utf8'));
 contract.release=version;
 Object.assign(contract.capacitor.android,{versionName:version,versionCode:code});
 Object.assign(contract.capacitor.ios,{marketingVersion:version,currentProjectVersion:code});
 return contract;
}
function validate(contract){
 const localRequire=createRequire(script),fakeFs=Object.create(fs);
 fakeFs.readFileSync=(file,...args)=>path.resolve(String(file))===contractPath?JSON.stringify(contract):fs.readFileSync(file,...args);
 // Run the complete real pre-push validator. Only this contract's input bytes
 // are substituted; every other source, native project and release check runs.
 vm.runInNewContext(fs.readFileSync(script,'utf8'),{
  require:name=>name==='node:fs'?fakeFs:localRequire(name),
  // Host JSON preserves prototypes for the validator's strict manifest-array
  // equality against its required source-identity module in the host realm.
  __dirname:path.dirname(script),__filename:script,console:{log(){}},process,JSON
 },{filename:script,timeout:10000});
}
test('actual pre-push validator accepts coherent native release names and codes',()=>{
 assert.doesNotThrow(()=>validate(coherentContract()));
});
for(const [platform,field,wrong] of [
 ['android','versionName','0.0.1'],['android','versionCode',1],
 ['ios','marketingVersion','0.0.1'],['ios','currentProjectVersion',1]
])test(`actual pre-push validator rejects stale ${platform}.${field} even with the correct root release`,()=>{
 const contract=coherentContract();contract.capacitor[platform][field]=wrong;
 assert.throws(()=>validate(contract),error=>error.code==='ERR_ASSERTION'&&error.message.includes(`${platform}.${field}`));
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const identity=require('../scripts/86chaos-release-gate/source-identity.cjs');
const stamp=require('../scripts/stamp-build-identity.cjs');

function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vercel-protected-1709-'));
 fs.mkdirSync(path.join(dir,'public'),{recursive:true});fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.mkdirSync(path.join(dir,'test-tools/certification'),{recursive:true});
 const files={'package.json':'{"version":"17.0.9"}\n','public/version.json':'{"version":"17.0.9","releaseTitle":"Request Off Runtime and Release Gate Identity Repair"}\n','src/app.js':'export default 1;\n','test-tools/certification/groups.json':'{"groups":{}}\n','firestore.rules':'rules-v1\n','firebase.json':'firebase-v1\n','vercel.json':'vercel-v1\n'};
 for(const [name,value] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(dir,name)),{recursive:true});fs.writeFileSync(path.join(dir,name),value);}
 const manifestFiles=Object.keys(files).map(file=>({file,sha256:identity.hash(identity.sourceBytes(file,fs.readFileSync(path.join(dir,file))))})).sort((a,b)=>a.file.localeCompare(b.file));
 fs.writeFileSync(path.join(dir,'release-source-manifest.json'),JSON.stringify({schemaVersion:1,sourceHash:identity.hash(JSON.stringify(manifestFiles)),files:manifestFiles},null,2)+'\n');
 return {dir,manifestFiles};
}
function withVercel(fn){const keys=['VERCEL','VERCEL_GIT_COMMIT_SHA','VERCEL_GIT_COMMIT_REF','VERCEL_URL'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));try{process.env.VERCEL='1';process.env.VERCEL_GIT_COMMIT_SHA='1234567890123456789012345678901234567890';process.env.VERCEL_GIT_COMMIT_REF='testing';process.env.VERCEL_URL='fixture.vercel.app';return fn();}finally{for(const [k,v] of Object.entries(before))v===undefined?delete process.env[k]:process.env[k]=v;}}

test('17.0.9 Vercel protected config hashes come from committed manifest, not transformed workspace bytes',()=>{const {dir,manifestFiles}=fixture();try{withVercel(()=>{fs.writeFileSync(path.join(dir,'vercel.json'),'platform-normalized-vercel\n');const result=stamp.buildIdentityPayload(dir);const expected=Object.fromEntries(manifestFiles.map(r=>[r.file,r.sha256]));assert.equal(result.identityStampStatus,'verified');assert.equal(result.protectedConfigEvidence,'bundled-manifest');assert.equal(result.vercelConfigHash,expected['vercel.json']);assert.equal(result.firebaseConfigHash,expected['firebase.json']);assert.equal(result.rulesHash,expected['firestore.rules']);assert.notEqual(result.vercelConfigHash,identity.hash(identity.sourceBytes('vercel.json',fs.readFileSync(path.join(dir,'vercel.json')))));});}finally{fs.rmSync(dir,{recursive:true,force:true});}});

test('17.0.9 local protected config evidence still hashes actual local source',()=>{const {dir}=fixture();try{delete process.env.VERCEL;fs.writeFileSync(path.join(dir,'vercel.json'),'local-change\n');const result=stamp.buildIdentityPayload(dir);assert.equal(result.protectedConfigEvidence,'workspace-source');assert.equal(result.vercelConfigHash,identity.hash(identity.sourceBytes('vercel.json',fs.readFileSync(path.join(dir,'vercel.json')))));}finally{fs.rmSync(dir,{recursive:true,force:true});}});

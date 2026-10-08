#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {applyFirebaseEmulatorEnv,LOOPBACK_RE}=require('../86chaos-firebase-target.cjs');
function start() {
  const firebaseTarget=applyFirebaseEmulatorEnv(process.env);
  const preflight=cp.spawnSync(process.execPath,[path.join(__dirname,'preflight-env.cjs')],{stdio:'inherit',env:process.env});
  if(preflight.status!==0) return preflight.status||1;
  const {runDir}=require('./run-context.cjs').ensureRunDir();
  const report=JSON.parse(fs.readFileSync(path.join(runDir,'environment-preflight.json'),'utf8'));
  if(!report.ok) throw new Error('Environment preflight failed.');
  if(firebaseTarget.emulator){
    const local=new URL(report.appUrl);
    if(report.firebaseTarget!=='EMULATOR'||report.firebaseProjectId!==firebaseTarget.projectId||local.protocol!=='http:'||!LOOPBACK_RE.test(local.hostname)) throw new Error('Preflight did not prove the local Firebase emulator target.');
  }else if(!report.resolvedImmutableDeploymentUrl) throw new Error('Preflight did not prove an immutable deployment.');
  const target=firebaseTarget.emulator?report.appUrl:(process.env.APP_URL || process.env.CHAOS_BASE_URL);
  const env={...process.env,APP_URL:target,CHAOS_BASE_URL:target};
  if(firebaseTarget.emulator)delete env.CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL;
  else env.CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL=report.resolvedImmutableDeploymentUrl;
  // This dependency-free mandatory group executes immediately after preflight.
  // Later local checks record it again in the canonical certification evidence.
  console.log('[release-check] source validator: npm run test:source');
  const result=cp.spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','test:source'],{stdio:'inherit',env,shell:process.platform==='win32'});
  fs.writeFileSync(path.join(runDir,'preflight-test-start.json'),JSON.stringify({group:'source validator',command:'npm run test:source',started:true,exitCode:result.status,appUrl:env.APP_URL,certified:false},null,2));
  return result.status===0?0:(result.status||1);
}
if(require.main===module) {try{process.exitCode=start();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={start};

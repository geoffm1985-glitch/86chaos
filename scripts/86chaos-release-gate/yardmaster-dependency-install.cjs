'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function managedEmulator(env){return env.YARDMASTER_FIREBASE_TARGET==='emulator'&&env.YARDMASTER_FIREBASE_PROJECT==='demo-86chaos'&&env.CHAOS_BLOCK_LIVE_FIREBASE==='1'}
async function dependencyInstall({root=process.cwd(),env=process.env,request=fetch,run=cp.spawnSync}={}){
 const base=path.join(root,'scripts','86chaos-release-gate');
 if(managedEmulator(env)){
  const bridge=JSON.parse(fs.readFileSync(path.join(root,'yardmaster.firebase.json'),'utf8'));
  const url=new URL(bridge.localApp.url);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.protocol!=='http:')throw Error('Yardmaster dependency reuse requires a loopback app.');
  const response=await request(url.href.replace(/\/$/,'')+bridge.localApp.readyPath,{signal:AbortSignal.timeout(5000),cache:'no-store'});
  const state=await response.json();
  const isolated=state?.target==='emulator'&&state.projectId===bridge.projectId&&state.blockLiveFirebase===true;
  if(!isolated)throw Error('Prepared Yardmaster app did not acknowledge emulator isolation; dependencies were not changed.');
  const bootstrapPending=response.ok===false&&response.status===503&&state.ready===false;
  if(response.ok!==true&&!bootstrapPending)throw Error(`Prepared Yardmaster local app readiness request failed${response.status?` (HTTP ${response.status})`:''}; dependencies were not changed.`);
  console.log(bootstrapPending
    ? 'Prepared Yardmaster app is emulator-isolated while browser SDK readiness is pending; verifying required modules without npm ci.'
    : 'Reusing dependencies of the running Yardmaster emulator app; verifying required modules. npm ci would remove files from the active app.');
  return run(process.execPath,[path.join(base,'dependency-preflight.cjs')],{cwd:root,env,stdio:'inherit',windowsHide:true}).status??1;
 }
 return run(process.execPath,[path.join(base,'run-observable-command.cjs'),'--label','Install locked test dependencies','--heartbeat','20','--timeout','1800','--','npm','ci','--include=dev','--no-audit','--no-fund'],{cwd:root,env,stdio:'inherit',windowsHide:true}).status??1;
}
module.exports={managedEmulator,dependencyInstall};
if(require.main===module)dependencyInstall().then(code=>{process.exitCode=code}).catch(error=>{console.error(error.message);process.exitCode=1});

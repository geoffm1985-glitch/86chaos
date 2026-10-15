'use strict';
const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),net=require('node:net');
async function main(){
  const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-schedule-'));
  const config=path.join(folder,'firebase.json');
  fs.writeFileSync(config,JSON.stringify({firestore:{rules:path.resolve('firestore.rules'),indexes:path.resolve('firestore.indexes.json')},emulators:{firestore:{host:'127.0.0.1',port},ui:{enabled:false},singleProjectMode:true}},null,2));
  const packagePath=require.resolve('firebase-tools/package.json'),pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
  const bin=path.resolve(path.dirname(packagePath),typeof pkg.bin==='string'?pkg.bin:pkg.bin.firebase);
  const project='demo-86chaos-scheduling';
  const result=cp.spawnSync(process.execPath,[bin,'emulators:exec','--only','firestore','--project',project,'--config',config,`"${process.execPath}" --test test-tools/schedule-workspace-emulator.test.cjs`],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,env:{...process.env,GCLOUD_PROJECT:project,GOOGLE_CLOUD_PROJECT:project,FIREBASE_PROJECT_ID:project,REACT_APP_FIREBASE_PROJECT_ID:project,REACT_APP_TEST_FIREBASE_PROJECT_ID:project,CHAOS_BLOCK_LIVE_FIREBASE:'1',JAVA_TOOL_OPTIONS:'-Xms64m -Xmx512m -XX:+ExitOnOutOfMemoryError'}});
  process.exitCode=result.status===0?0:result.status || 1;
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});

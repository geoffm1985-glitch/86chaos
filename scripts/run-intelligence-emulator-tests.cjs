'use strict';
const cp=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const net=require('node:net');

async function main() {
  const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-intelligence-'));
  const config=path.join(directory,'firebase.json');
  fs.writeFileSync(config,JSON.stringify({firestore:{rules:path.resolve('firestore.rules'),indexes:path.resolve('firestore.indexes.json')},emulators:{firestore:{host:'127.0.0.1',port},ui:{enabled:false},singleProjectMode:true}},null,2));
  const packagePath=require.resolve('firebase-tools/package.json');
  const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
  const bin=path.resolve(path.dirname(packagePath),typeof pkg.bin==='string'?pkg.bin:pkg.bin.firebase);
  const command=`"${process.execPath}" --test test-tools/intelligence-purchasing-emulator.test.cjs`;
  // Child-only environment; the authenticated production/test projects are never selected.
  const result=cp.spawnSync(process.execPath,[bin,'emulators:exec','--only','firestore','--project','demo-86chaos-intelligence','--config',config,command],{cwd:process.cwd(),stdio:'inherit',windowsHide:true,env:{...process.env,GCLOUD_PROJECT:'demo-86chaos-intelligence'}});
  // Leave the small temporary configuration for diagnostics; no recursive filesystem deletion.
  process.exitCode=result.status===0?0:(result.status || 1);
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});

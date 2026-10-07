#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),cp=require('node:child_process');
const {applyFirebaseEmulatorEnv}=require('./86chaos-firebase-target.cjs');

async function reservePorts(count) {
  const servers=[],ports=[];
  try {
    for(let i=0;i<count;i++) {
      const server=net.createServer();servers.push(server);
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
      ports.push(server.address().port);
    }
    return ports;
  } finally { await Promise.all(servers.filter(s=>s.listening).map(s=>new Promise(resolve=>s.close(resolve)))); }
}

function childEnvironment(inherited) {
  const env={...inherited};
  // Firebase CLI assigns isolated SDK hosts. An inherited browser port must
  // never override those hosts when application modules normalize the target.
  for(const product of ['FIRESTORE','STORAGE'])delete env['REACT_APP_86CHAOS_'+product+'_EMULATOR_PORT'];
  for(const key of ['TEMP','TMP']) {
    const original=env['CHAOS_SERVER_PARENT_'+key];
    if(original)env[key]=original;else delete env[key];
    delete env['CHAOS_SERVER_PARENT_'+key];
  }
  applyFirebaseEmulatorEnv(env);
  return env;
}

async function run({testFiles=[],env=process.env,root=process.cwd()}={}) {
  const [firestore,storage,hub,logging]=await reservePorts(4);
  const tempRoot=path.resolve(os.tmpdir());
  const temp=fs.mkdtempSync(path.join(tempRoot,'86chaos-server-emulators-'));
  const configPath=path.join(temp,'firebase.json');
  const cliPackage=require.resolve('firebase-tools/package.json',{paths:[root]});
  const pkg=JSON.parse(fs.readFileSync(cliPackage,'utf8'));
  const cli=path.resolve(path.dirname(cliPackage),typeof pkg.bin==='string'?pkg.bin:pkg.bin.firebase);
  fs.writeFileSync(configPath,JSON.stringify({firestore:{rules:path.join(root,'firestore.rules'),indexes:path.join(root,'firestore.indexes.json')},storage:{rules:path.join(root,'storage.rules')},emulators:{firestore:{host:'127.0.0.1',port:firestore},storage:{host:'127.0.0.1',port:storage},hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}}));
  const serviceEnv={...env,TEMP:temp,TMP:temp,CHAOS_SERVER_PARENT_TEMP:env.TEMP||'',CHAOS_SERVER_PARENT_TMP:env.TMP||'',CHAOS_SERVER_TEST_FILES:JSON.stringify(testFiles)};
  delete serviceEnv.FIREBASE_EMULATOR_HUB;delete serviceEnv.FIREBASE_CONFIG;
  const command='"'+process.execPath+'" "'+__filename+'" --child';
  console.log('Server tests use isolated Firestore and Storage emulators; app QA profiles remain outside their cleanup.');
  try {
    const child=cp.spawn(process.execPath,[cli,'emulators:exec','--only','firestore,storage','--project','demo-86chaos','--config',configPath,command],{cwd:root,env:serviceEnv,stdio:'inherit',windowsHide:true});
    return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code??1));});
  } finally {
    const resolved=path.resolve(temp);
    if(!resolved.startsWith(tempRoot+path.sep)||!path.basename(resolved).startsWith('86chaos-server-emulators-'))throw new Error('Unsafe emulator temporary directory');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}

if(require.main===module) {
  if(process.argv.includes('--child')) {
    const env=childEnvironment(process.env),files=JSON.parse(env.CHAOS_SERVER_TEST_FILES||'[]');
    delete env.CHAOS_SERVER_TEST_FILES;
    const result=cp.spawnSync(process.execPath,['--test',...(files.length?files:['api/*.test.cjs'])],{cwd:process.cwd(),env,stdio:'inherit',windowsHide:true});
    process.exitCode=result.status??1;
  } else run().then(code=>{process.exitCode=code;}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={run,childEnvironment};

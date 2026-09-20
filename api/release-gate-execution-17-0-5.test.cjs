'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {captureSourceIdentity,hash,sourceBytes,excludedFile}=require('../scripts/86chaos-release-gate/source-identity.cjs');
test('17.0.5 actual preflight pins immutable identity and executes mandatory source tests; mismatches execute zero tests',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gate-execution-1705-')),repo=path.join(temp,'repo');
 try{
 fs.cpSync(root,repo,{recursive:true,filter:source=>source===root||!excludedFile(path.relative(root,source))});
 const git=args=>{const result=cp.spawnSync('git',args,{cwd:repo,encoding:'utf8'});assert.equal(result.status,0,result.stderr);};
 git(['init','-b','testing']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','17.0.5 source fixture']);
 const local=captureSourceIdentity(repo),alias='https://86chaos-git-testing-fixture.vercel.app',pinned='https://86chaos-immutable-fixture.vercel.app';
 const config={};for(const [key,file] of Object.entries({rulesHash:'firestore.rules',firebaseConfigHash:'firebase.json',vercelConfigHash:'vercel.json'}))config[key]=hash(sourceBytes(file,fs.readFileSync(path.join(repo,file))));
 const verified={identityStampStatus:'verified',sourceEvidence:'bundled-manifest',workspaceVerification:'vercel-git-metadata'};
 const client={...local,sourceManifestHash:local.sourceHash,firebaseTestingProject:'chaos-test-d1601',...verified,...config};
 const server={version:local.version,sourceManifestHash:local.sourceHash,gitCommit:local.commit,gitBranch:'testing',vercelDeploymentId:'dpl_fixture1705',vercelDeploymentUrl:pinned,vercelProjectId:'prj_fixture1705',firebaseTestingProject:'chaos-test-d1601',...verified,...config};
 const fixture=path.join(temp,'http.json'),stub=path.join(temp,'transport.cjs');
 fs.writeFileSync(stub,`const fs=require('node:fs');const fixture=JSON.parse(fs.readFileSync(process.env.GATE_HTTP_FIXTURE,'utf8'));global.fetch=async input=>{const url=new URL(input);fs.appendFileSync(process.env.GATE_HTTP_TRACE,url.href+'\\n');const row=url.pathname==='/api/build-identity'?fixture.server:url.pathname==='/build-identity.json'?fixture.client:url.pathname==='/version.json'?{version:fixture.client.version}:{};return new Response(JSON.stringify(row),{status:200,headers:{'Content-Type':'application/json'}});};`);
 const env={...process.env};for(const key of Object.keys(env))if(/^(CHAOS_|VERCEL|APP_URL|BASE_URL|REACT_APP_)/.test(key))delete env[key];
 Object.assign(env,{NODE_OPTIONS:`--require=${JSON.stringify(stub)}`,GATE_HTTP_FIXTURE:fixture,GATE_HTTP_TRACE:path.join(temp,'http.log'),APP_URL:alias,CHAOS_BASE_URL:alias,CHAOS_CERTIFICATION_MODE:'true',CHAOS_ALLOW_MUTATION:'false',CHAOS_QA_AUTO_PROVISION_TEST_USERS:'false',REACT_APP_FIREBASE_PROJECT_ID:'chaos-test-d1601',REACT_APP_FIREBASE_API_KEY:'fixture-key',REACT_APP_FIREBASE_AUTH_DOMAIN:'chaos-test-d1601.firebaseapp.com',REACT_APP_FIREBASE_APP_ID:'fixture-app'});
 for(const name of ['OWNER','MANAGER','STAFF','SYSTEM_ADMIN']){env[name+'_EMAIL']=name.toLowerCase()+'@example.invalid';env[name+'_PASSWORD']='fixture-only';}
 const run=(id,observed)=>{fs.writeFileSync(fixture,JSON.stringify(observed));const runDir=path.join(repo,'test-results',id);const result=cp.spawnSync(process.execPath,['scripts/86chaos-release-gate/preflight-and-start.cjs'],{cwd:repo,env:{...env,CHAOS_RELEASE_GATE_RUN_ID:id,CHAOS_RELEASE_GATE_RUN_DIR:runDir},encoding:'utf8',maxBuffer:10*1024*1024});return{result,runDir};};
 const bad=run('bad-source',{client,server:{...server,sourceManifestHash:'0'.repeat(64)}});assert.notEqual(bad.result.status,0);assert.equal(fs.existsSync(path.join(bad.runDir,'preflight-test-start.json')),false);
 const good=run('good-source',{client,server});assert.equal(good.result.status,0,good.result.stdout+'\n'+good.result.stderr);
 const started=JSON.parse(fs.readFileSync(path.join(good.runDir,'preflight-test-start.json'),'utf8'));assert.equal(started.started,true);assert.equal(started.exitCode,0);assert.equal(started.appUrl,alias);assert.equal(started.certified,false);assert.match(good.result.stdout,/source validation passed/);
 const trace=fs.readFileSync(env.GATE_HTTP_TRACE,'utf8');assert(trace.includes(pinned+'/api/build-identity'));assert(trace.includes(pinned+'/build-identity.json'));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

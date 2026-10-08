'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const express=require('express');const {installLocalApi}=require('./yardmaster-api.cjs');
const env={YARDMASTER_FIREBASE_TARGET:'emulator',CHAOS_BLOCK_LIVE_FIREBASE:'1'};
test('local API routes preserve authentication, query, body and JSON denial instead of HTML',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ym-local-api-'));
 fs.writeFileSync(path.join(root,'whoami.js'),`module.exports=(req,res)=>req.headers.authorization==='Bearer fixture-token'?res.json({superAdmin:true,runtime:{firebaseProjectId:'demo-86chaos'},query:req.query,body:req.body}):res.status(401).json({error:'Sign in required'});`);
 const app=express();installLocalApi(app,{apiRoot:root,env});app.use((req,res)=>res.send('<html>CRA fallback</html>'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const denied=await fetch(url+'/api/whoami');assert.equal(denied.status,401);assert.deepEqual(await denied.json(),{error:'Sign in required'});
  const allowed=await fetch(url+'/api/whoami?role=admin',{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:JSON.stringify({value:7})});
  assert.deepEqual(await allowed.json(),{superAdmin:true,runtime:{firebaseProjectId:'demo-86chaos'},query:{role:'admin'},body:{value:7}});
  for(const route of ['missing','_chaos-admin','whoami.test']){const r=await fetch(url+'/api/'+route);assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/json/)}
 }finally{await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true})}
});
test('local API refuses live or unguarded targets',()=>{
 for(const source of [{YARDMASTER_FIREBASE_TARGET:'live'}, {YARDMASTER_FIREBASE_TARGET:'emulator'}])assert.throws(()=>installLocalApi(express(),{env:source}),/blocked-live demo emulator/);
});

'use strict';
const fs=require('node:fs'),path=require('node:path');
const {getFirebaseTarget}=require('./86chaos-firebase-target.cjs');
function installLocalApi(app,{apiRoot=path.resolve(__dirname,'../api'),env=process.env}={}){
 const target=getFirebaseTarget(env);
 if(!target.emulator||target.projectId!=='demo-86chaos'||env.CHAOS_BLOCK_LIVE_FIREBASE!=='1')throw new Error('Local Yardmaster API requires the blocked-live demo emulator target.');
 const root=path.resolve(apiRoot);
 app.use('/api',require('express').json({limit:'20mb'}),async(req,res)=>{
  // Serve existing authenticated handlers, never CRA's HTML fallback or helpers.
  const relative=req.path.replace(/^\//,'');
  if(!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(relative))return res.status(404).json({error:'API route not found'});
  const file=path.resolve(root,relative+'.js');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.status(404).json({error:'API route not found'});
  try{
   const handler=require(file);
   if(typeof handler!=='function')return res.status(404).json({error:'API route not found'});
   await handler(req,res);
  }catch(error){if(!res.headersSent)res.status(500).json({error:'Local API handler failed',detail:String(error.message||error)})}
 });
}
module.exports={installLocalApi};

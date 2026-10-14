'use strict';
const fs=require('node:fs'),path=require('node:path');
const {captureSourceIdentity,excludedFile,hash,sourceBytes}=require('./86chaos-release-gate/source-identity.cjs');
const {buildIdentityPayload}=require('./stamp-build-identity.cjs');
function assertPinMatches(pinned,current) {
  if(!pinned?.commit||!pinned?.sourceHash||!current?.commit||current.dirty||current.commit!==pinned.commit||current.branch!==pinned.branch||current.version!==pinned.version||current.sourceHash!==pinned.sourceHash)throw Object.assign(new Error('Local release source changed. Restart with the sealed pushed source before testing.'),{code:'local_release_source_changed'});
}
function createRuntimePin(root,{capture=captureSourceIdentity,stamp=buildIdentityPayload,watch=fs.watch}={}) {
  const pinned=capture(root);
  if(pinned.dirty||!pinned.commit||!pinned.branch||!pinned.sourceHash)throw new Error('A local release runtime requires clean Git and sealed source identity.');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-source-manifest.json'),'utf8'));
  if(manifest.sourceHash!==pinned.sourceHash)throw new Error('Seal the current mobile source before starting its release runtime.');
  const identity={...stamp(root),commit:pinned.commit,branch:pinned.branch,sourceHash:pinned.sourceHash,sourceManifestHash:pinned.sourceHash,localRuntimePinned:true,runtimeStartedAt:new Date().toISOString()};
  assertPinMatches(pinned,capture(root));
  let changed=false,invalid=false;
  const notifiedFiles=new Set();
  const pinnedFiles=new Map((pinned.files||[]).map(row=>[row.file,row.sha256]));
  const watcher=watch(root,{recursive:true},(_,name)=>{
    const relative=String(name||'').replace(/\\/g,'/');
    if(!relative||relative==='.git/HEAD'||relative.startsWith('.git/refs/')||relative==='release-source-manifest.json'||!excludedFile(relative)){changed=true;notifiedFiles.add(relative);}
  });
  watcher.on?.('error',()=>{invalid=true;});
  const verify=()=>{
    if(invalid)throw new Error('Local release source watcher is unavailable.');
    if(changed){
      // Windows can notify unchanged files during reads/metadata refreshes. Check
      // their actual normalized bytes before blocking requests on a full Git scan.
      // Unknown paths, deletions and changed bytes still require strict capture.
      const unchanged=[...notifiedFiles].every(file=>{
        if(!pinnedFiles.has(file))return false;
        try{return hash(sourceBytes(file,fs.readFileSync(path.join(root,file))))===pinnedFiles.get(file);}catch{return false;}
      });
      if(!unchanged)assertPinMatches(pinned,capture(root));
      changed=false;notifiedFiles.clear();
    }
    return identity;
  };
  return{identity,verify,close:()=>watcher.close()};
}
function installRuntimePin(app,{root=path.resolve(__dirname,'..')}={}) {
  const pin=createRuntimePin(root);
  app.use((req,res,next)=>{
    try{pin.verify();next();}catch(error){console.error('[local-runtime-pin] verification refused:',error.code||error.name,error.message);res.setHeader('Cache-Control','no-store');res.status(503).json({ok:false,code:'local_release_source_changed',error:'The local release runtime source changed. Restart it from the current sealed pushed commit.'});}
  });
  app.get('/build-identity.json',(req,res)=>{res.setHeader('Cache-Control','no-store');res.json(pin.identity);});
  app.get('/api/build-identity',(req,res)=>{
    const id=pin.identity;res.setHeader('Cache-Control','no-store');
    res.json({ok:true,version:id.version,sourceManifestHash:id.sourceManifestHash,sourceEvidence:id.sourceEvidence||'workspace-source',workspaceVerification:id.workspaceVerification||'startup-verified',identityStampStatus:id.identityStampStatus,sourceArchiveSha256:id.sourceArchiveSha256,gitCommit:id.commit,gitBranch:id.branch,vercelDeploymentId:null,vercelDeploymentUrl:id.previewUrl,vercelProjectId:null,firebaseTestingProject:id.firebaseTestingProject,rulesHash:id.rulesHash,firebaseConfigHash:id.firebaseConfigHash,vercelConfigHash:id.vercelConfigHash,protectedConfigEvidence:id.protectedConfigEvidence,localRuntimePinned:true,runtimeStartedAt:id.runtimeStartedAt});
  });
  return pin;
}
module.exports={assertPinMatches,createRuntimePin,installRuntimePin};

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRuntimePin}=require('../scripts/pin-local-release-runtime.cjs');
const {hash,sourceBytes}=require('../scripts/86chaos-release-gate/source-identity.cjs');
test('unchanged file notifications avoid full capture while edits, deletions and unknown paths stay strict',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-pin-content-'));
 const file='app.js',bytes=Buffer.from('const value = 1;\n');
 fs.writeFileSync(path.join(root,file),bytes);
 let current={commit:'a'.repeat(40),branch:'mobile',version:'18.0.18',sourceHash:'b'.repeat(64),dirty:false,files:[{file,sha256:hash(sourceBytes(file,bytes))}]};
 fs.writeFileSync(path.join(root,'release-source-manifest.json'),JSON.stringify({sourceHash:current.sourceHash}));
 let listener,onError,captures=0;
 const pin=createRuntimePin(root,{capture:()=>{captures++;return current;},stamp:()=>current,watch:(_root,_options,callback)=>{listener=callback;return{on:(_event,callback)=>{onError=callback;},close(){}};}});
 try{
  const initial=captures;
  for(let n=0;n<50;n++){listener('change',file);pin.verify();}
  assert.equal(captures,initial,'Metadata-only events must not repeat whole-tree capture');
  fs.writeFileSync(path.join(root,file),'const value = 2;\n');current={...current,dirty:true};listener('change',file);
  assert.throws(()=>pin.verify(),error=>error.code==='local_release_source_changed');
  fs.unlinkSync(path.join(root,file));assert.throws(()=>pin.verify());
  fs.writeFileSync(path.join(root,file),bytes);listener('change','new.js');assert.throws(()=>pin.verify());
  listener('change','.git/HEAD');assert.throws(()=>pin.verify());
  onError();assert.throws(()=>pin.verify(),/watcher is unavailable/);
 }finally{pin.close();fs.rmSync(root,{recursive:true,force:true});}
});

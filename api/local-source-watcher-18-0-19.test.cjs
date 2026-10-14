'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {EventEmitter}=require('node:events');
const {createSourceWatcher}=require('../scripts/watch-release-source.cjs');
const {captureSourceIdentity}=require('../scripts/86chaos-release-gate/source-identity.cjs');
const {createRuntimePin}=require('../scripts/pin-local-release-runtime.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-watch-source-'));
 const git=args=>cp.execFileSync('git',args,{cwd:root,windowsHide:true,stdio:'pipe'});
 fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.join(root,'empty'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'18.0.19'}));
 fs.writeFileSync(path.join(root,'src/app.js'),'module.exports=1;\n');
 fs.writeFileSync(path.join(root,'.gitignore'),'node_modules/\ntest-results/\n.runtime-cache/\nrelease-source-manifest.json\n');
 for(const directory of ['node_modules','test-results','.runtime-cache'])fs.mkdirSync(path.join(root,directory));
 git(['init','--initial-branch=mobile']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture']);
 return{root,git,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('source scopes exclude generated and Git-ignored trees while retaining empty directories and Git identity',()=>{
 const f=fixture(),handles=[],events=[];let watcher;
 try{
  const fake=(directory,options,callback)=>{const handle=new EventEmitter();handle.close=()=>{};handles.push({directory,options,callback,handle});return handle;};
  watcher=createSourceWatcher(f.root,(...event)=>events.push(event),{watch:fake});
  for(const directory of ['node_modules','test-results','.runtime-cache'])assert(!handles.some(row=>row.directory.startsWith(path.join(f.root,directory))));
  assert(handles.some(row=>row.directory===path.join(f.root,'empty')&&!row.options.recursive));
  const rootWatch=handles.find(row=>row.directory===f.root);assert.equal(rootWatch.options.recursive,false);
  rootWatch.callback('change','test-results');assert.equal(events.length,0);
  rootWatch.callback('change','src');assert.equal(events.length,0,'Child directory metadata is covered by its own source watcher');
  const srcWatch=handles.find(row=>row.directory===path.join(f.root,'src'));
  srcWatch.callback('change','app.js');assert.deepEqual(events.pop(),['change','src/app.js']);
  srcWatch.callback('change',null);assert.equal(events.length,0,'Anonymous unchanged events require no full capture');
  fs.writeFileSync(path.join(f.root,'src/app.js'),'module.exports=2;\n');srcWatch.callback('change',null);assert.deepEqual(events.pop(),['change','src/app.js']);
  fs.mkdirSync(path.join(f.root,'new'));rootWatch.callback('rename','new');
  assert(handles.some(row=>row.directory===path.join(f.root,'new')),'New eligible directories must be watched');
  const refs=handles.find(row=>row.directory===path.join(f.root,'.git','refs'));
  assert.equal(refs.options.recursive,true);events.length=0;refs.callback('change','heads/mobile');assert.equal(events.length,0);
  f.git(['checkout','-b','different']);handles.find(row=>row.directory===path.join(f.root,'.git')).callback('change','HEAD');assert.equal(events.pop()[1],'.git/HEAD');
  let error;watcher.on('error',value=>{error=value;});srcWatch.handle.emit('error',new Error('watch lost'));assert.match(error.message,/watch lost/);
 }finally{watcher?.close();f.close();}
});
test('linked worktrees watch their external Git HEAD and shared refs',()=>{
 const f=fixture(),linked=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-watch-linked-')),handles=[],events=[];let watcher;
 try{
  f.git(['worktree','add','-b','linked',linked]);
  watcher=createSourceWatcher(linked,(...event)=>events.push(event),{watch:(directory,options,callback)=>{const handle=new EventEmitter();handle.close=()=>{};handles.push({directory,options,callback});return handle;}});
  const gitDirectory=cp.execFileSync('git',['-C',linked,'rev-parse','--absolute-git-dir'],{encoding:'utf8',windowsHide:true}).trim();
  assert(!gitDirectory.startsWith(linked+path.sep));
  const head=handles.find(row=>row.directory===path.resolve(gitDirectory));assert(head,'External worktree HEAD watcher missing');
  assert(handles.some(row=>row.directory===path.join(f.root,'.git','refs')),'Shared ref watcher missing');
  cp.execFileSync('git',['-C',linked,'checkout','-b','linked-new'],{windowsHide:true,stdio:'pipe'});
  head.callback('change',null);assert.equal(events.pop()[1],'.git/HEAD');
  let pointerError;watcher.on('error',error=>{pointerError=error;});
  const pointer=path.join(linked,'.git'),contents=fs.readFileSync(pointer);
  try{fs.writeFileSync(pointer,'gitdir: missing\n',{flag:'r+'});handles.find(row=>row.directory===linked).callback('change','.git');assert.match(pointerError.message,/Git directory pointer changed/);}finally{fs.writeFileSync(pointer,contents,{flag:'r+'});}
 }finally{watcher?.close();f.git(['worktree','remove','--force',linked]);f.close();}
});
test('ignored output bursts do not recapture source, but new source and Git HEAD changes still fail strict verification',async()=>{
 const f=fixture();let pin,captures=0;const observed=[];
 try{
  const original=captureSourceIdentity(f.root);fs.writeFileSync(path.join(f.root,'release-source-manifest.json'),JSON.stringify({sourceHash:original.sourceHash}));
  pin=createRuntimePin(f.root,{capture:root=>{captures++;return captureSourceIdentity(root);},stamp:()=>original,watch:(root,_options,listener)=>createSourceWatcher(root,listener,{watch:(directory,options,callback)=>fs.watch(directory,options,(event,name)=>{observed.push({directory:path.relative(root,directory),event,name:String(name||'')});callback(event,name);})})});
  const initial=captures;
  for(let n=0;n<1000;n++)fs.writeFileSync(path.join(f.root,'test-results',n+'.txt'),'generated output\n');
  await new Promise(resolve=>setTimeout(resolve,250));pin.verify();assert.equal(captures,initial,JSON.stringify(observed));
  fs.writeFileSync(path.join(f.root,'empty','new.js'),'module.exports=2;\n');
  await new Promise(resolve=>setTimeout(resolve,250));assert.throws(()=>pin.verify(),error=>error.code==='local_release_source_changed');
  fs.unlinkSync(path.join(f.root,'empty','new.js'));pin.verify();
  f.git(['checkout','-b','different']);await new Promise(resolve=>setTimeout(resolve,250));assert.throws(()=>pin.verify(),error=>error.code==='local_release_source_changed');
 }finally{pin?.close();f.close();}
});

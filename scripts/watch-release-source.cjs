'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {EventEmitter}=require('node:events');
const {excludedFile,hash,sourceBytes}=require('./86chaos-release-gate/source-identity.cjs');

function ignoredPaths(root,files){
 if(!files.length)return new Set();
 const result=cp.spawnSync('git',['-C',root,'check-ignore','-z','--stdin'],{input:files.join('\0')+'\0',encoding:'utf8',windowsHide:true});
 if(result.error||![0,1].includes(result.status))throw new Error('Cannot resolve ignored paths for the local source watcher.');
 return new Set(String(result.stdout||'').split('\0').filter(Boolean).map(file=>file.replace(/\\/g,'/').replace(/\/$/,'')));
}

function createSourceWatcher(root,listener,{watch=fs.watch}={}){
 root=path.resolve(root);
 const result=new EventEmitter(),handles=new Map(),known=new Set(),ignored=new Set(),snapshots=new Map();
 let closed=false;
 const normalize=value=>String(value||'').replace(/\\/g,'/');
 const isIgnored=file=>[...ignored].some(prefix=>file===prefix||file.startsWith(prefix+'/'));
 const attach=(directory,recursive,callback)=>{
  const key=directory+'|'+recursive;
  if(closed||handles.has(key))return;
  const handle=watch(directory,{recursive},callback);
  handles.set(key,handle);
  handle.on?.('error',error=>{if(!closed)result.emit('error',error);});
 };
 const special=file=>file==='.git'||file==='release-source-manifest.json';
 const readDirectory=directory=>{
  const entries=fs.readdirSync(directory,{withFileTypes:true}).map(entry=>({entry,relative:normalize(path.relative(root,path.join(directory,entry.name)))})).filter(row=>special(row.relative)||(!excludedFile(row.relative)&&!isIgnored(row.relative)));
  const unknown=entries.filter(row=>!special(row.relative)&&!known.has(row.relative));
  for(const file of ignoredPaths(root,unknown.map(row=>row.relative+(row.entry.isDirectory()?'/':''))))ignored.add(file);
  return entries.filter(row=>special(row.relative)||!isIgnored(row.relative));
 };
 const snapshot=entries=>new Map(entries.map(({entry,relative})=>[relative,entry.isDirectory()?'directory':hash(sourceBytes(relative,fs.readFileSync(path.join(root,relative))))]));
 const visit=directory=>{
  if(closed)return;
  const entries=readDirectory(directory);
  snapshots.set(directory,snapshot(entries));
  attach(directory,false,(event,name)=>{
   if(closed)return;
   // Windows can report an anonymous notification even for ignored descendants.
   // Prove eligible direct child bytes/membership unchanged before ignoring it.
   if(!name){
    try{
     const currentEntries=readDirectory(directory),current=snapshot(currentEntries),previous=snapshots.get(directory);
     for(const file of new Set([...previous.keys(),...current.keys()])){
      if(previous.get(file)!==current.get(file)){
       if(file==='.git')throw new Error('Local Git directory pointer changed; restart the sealed runtime.');
       listener(event,file);
      }
     }
     snapshots.set(directory,current);
     for(const {entry,relative} of currentEntries)if(entry.isDirectory()&&!special(relative)&&!known.has(relative)){known.add(relative);visit(path.join(root,relative));}
    }catch(error){result.emit('error',error);}
    return;
   }
   const relative=normalize(path.relative(root,path.join(directory,String(name))));
   if(relative==='.git'){
    try{
     const file=path.join(root,relative),current=fs.statSync(file).isDirectory()?'directory':hash(sourceBytes(relative,fs.readFileSync(file)));
     if(current!==snapshots.get(directory).get(relative))throw new Error('Local Git directory pointer changed; restart the sealed runtime.');
    }catch(error){result.emit('error',error);}
    return;
   }
   if(!special(relative)&&(excludedFile(relative)||isIgnored(relative)))return;
   try{
    if(event==='change'&&snapshots.get(directory).get(relative)==='directory'&&fs.existsSync(path.join(root,relative))&&fs.statSync(path.join(root,relative)).isDirectory())return;
    if(!known.has(relative)){
     const candidate=path.join(root,relative);
     const isDirectory=fs.existsSync(candidate)&&fs.statSync(candidate).isDirectory();
     if(!special(relative)&&ignoredPaths(root,[relative+(isDirectory?'/':'')]).has(relative)){ignored.add(relative);return;}
     known.add(relative);
     if(isDirectory)visit(candidate);
    }
    listener(event,relative);
   }catch(error){result.emit('error',error);}
  });
  for(const {entry,relative} of entries){
   if(isIgnored(relative))continue;
   known.add(relative);
   if(entry.isDirectory()&&!special(relative))visit(path.join(root,relative));
  }
 };
 result.close=()=>{closed=true;for(const handle of handles.values())handle.close();handles.clear();};
 try{
  // Nonrecursive eligible directories prevent generated output storms from
  // overflowing the root recursive watcher and producing anonymous events.
  visit(root);
  const git=cp.spawnSync('git',['-C',root,'rev-parse','--absolute-git-dir','--path-format=absolute','--git-common-dir'],{encoding:'utf8',windowsHide:true});
  if(git.error||git.status!==0)throw new Error('Cannot resolve local Git identity watch paths.');
  const gitDirectories=[...new Set(git.stdout.trim().split(/\r?\n/).map(value=>path.resolve(value)))];
  const [gitDirectory,commonDirectory=gitDirectory]=git.stdout.trim().split(/\r?\n/).map(value=>path.resolve(value));
  const readGitIdentity=()=>{
   const read=file=>{try{return fs.readFileSync(file,'utf8');}catch(error){if(error.code==='ENOENT')return '';throw error;}};
   const head=read(path.join(gitDirectory,'HEAD')),values=[head,read(path.join(commonDirectory,'packed-refs'))];
   let reference=head.match(/^ref:\s*(refs\/[^\r\n]+)/)?.[1];
   const seen=new Set();
   while(reference){
    if(seen.has(reference)||reference.includes('..'))throw new Error('Invalid symbolic Git identity reference.');
    seen.add(reference);const contents=read(path.join(commonDirectory,reference));values.push(reference,contents);
    reference=contents.match(/^ref:\s*(refs\/[^\r\n]+)/)?.[1];
   }
   return JSON.stringify(values);
  };
  let gitIdentity=readGitIdentity();
  const gitChanged=event=>{try{const current=readGitIdentity();if(current!==gitIdentity){gitIdentity=current;listener(event,'.git/HEAD');}}catch(error){result.emit('error',error);}};
  for(const directory of gitDirectories){
   attach(directory,false,(event,name)=>{
    if(!name||['HEAD','packed-refs','refs'].includes(String(name)))gitChanged(event);
   });
   const refs=path.join(directory,'refs');
   if(fs.existsSync(refs))attach(refs,true,gitChanged);
  }
 }catch(error){result.close();throw error;}
 return result;
}
function watchReleaseSource(root,_options,listener){return createSourceWatcher(root,listener);}
module.exports={createSourceWatcher,watchReleaseSource};

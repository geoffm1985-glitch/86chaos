'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const safety=fs.readFileSync(path.join(root,'scripts/verify-repository-safety.cjs'),'utf8');

test('17.0.10 repository safety explicitly allows and requires the committed release manifest',()=>{
  assert.match(safety,/allowedTrackedExclusions=new Set\(\['release-source-manifest\.json'\]\)/);
  assert.match(safety,/release-source-manifest\.json/);
});

test('17.0.10 repository safety passes with tracked release manifest and rejects tracked generated identity',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-safety-1710-'));
  try{
    for(const d of ['src','api','scripts','test-tools','tests'])fs.mkdirSync(path.join(dir,d),{recursive:true});
    for(const f of ['package.json','package-lock.json','vercel.json','firebase.json','RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1','.gitignore','release-source-manifest.json'])fs.writeFileSync(path.join(dir,f),'{}\n');
    fs.copyFileSync(path.join(root,'scripts/verify-repository-safety.cjs'),path.join(dir,'scripts/verify-repository-safety.cjs'));
    fs.mkdirSync(path.join(dir,'scripts/86chaos-release-gate'),{recursive:true});
    fs.copyFileSync(path.join(root,'scripts/86chaos-release-gate/source-identity.cjs'),path.join(dir,'scripts/86chaos-release-gate/source-identity.cjs'));
    for(let i=0;i<810;i++)fs.writeFileSync(path.join(dir,'src',`f${i}.js`),'export default 1;\n');
    const git=args=>cp.spawnSync('git',args,{cwd:dir,encoding:'utf8'});
    assert.equal(git(['init','-b','testing']).status,0);
    assert.equal(git(['add','.']).status,0);
    let run=cp.spawnSync(process.execPath,['scripts/verify-repository-safety.cjs'],{cwd:dir,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr+run.stdout);
    fs.mkdirSync(path.join(dir,'public'),{recursive:true});fs.writeFileSync(path.join(dir,'public/build-identity.json'),'{}\n');
    assert.equal(git(['add','-f','public/build-identity.json']).status,0);
    run=cp.spawnSync(process.execPath,['scripts/verify-repository-safety.cjs'],{cwd:dir,encoding:'utf8'});
    assert.notEqual(run.status,0);
    assert.match(run.stderr,/public\/build-identity\.json/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

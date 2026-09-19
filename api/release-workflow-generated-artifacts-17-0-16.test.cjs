'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const workflow = require('../scripts/86chaos-release-workflow/install-app-only.cjs');

const TEXT_EXTENSIONS = /\.(?:js|jsx|cjs|mjs|json|css|html|md|txt|ps1|cmd|yml|yaml|rules|py|toml|sh)$/i;
function sourceBytes(file, bytes) { return TEXT_EXTENSIONS.test(file) || ['.gitignore','.gitattributes','.npmrc'].includes(path.posix.basename(file)) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes; }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function git(cwd, args) { const result=cp.spawnSync('git',args,{cwd,encoding:'utf8'}); assert.equal(result.status,0,result.stderr); return String(result.stdout||''); }
function writeFile(rootDir, relative, content='fixture\n') { const target=path.join(rootDir,relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content); }
function manifestFor(rootDir) {
  const files=[];
  const walk=dir=>{ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ const absolute=path.join(dir,entry.name), relative=path.relative(rootDir,absolute).replace(/\\/g,'/'); if(entry.isDirectory()) walk(absolute); else if(entry.isFile()&&relative!=='release-source-manifest.json') files.push(relative); } };
  walk(rootDir);
  const rows=files.sort().map(file=>({file,sha256:sha(sourceBytes(file,fs.readFileSync(path.join(rootDir,file))))}));
  const manifest={schemaVersion:1,sourceHash:sha(Buffer.from(JSON.stringify(rows))),files:rows};
  fs.writeFileSync(path.join(rootDir,'release-source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
function completeSource(base, version, marker) {
  const source=path.join(base,`source-${version.replace(/\./g,'-')}-${marker}`); fs.mkdirSync(source,{recursive:true});
  for(const relative of workflow.REQUIRED_PATHS){
    if(relative==='release-source-manifest.json') continue;
    const target=path.join(source,relative);
    if(path.extname(relative)||/RUN_/.test(relative)){ fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target, relative==='package.json'?JSON.stringify({version})+'\n':'fixture\n'); }
    else fs.mkdirSync(target,{recursive:true});
  }
  writeFile(source,'.gitignore','node_modules/\n.env\n.env.*\n.vercel/\n.firebase/\nbuild/\ncoverage/\nplaywright-report/\ntest-results/\n*.log\n');
  writeFile(source,'src/marker.js',`${marker}\n`);
  manifestFor(source);
  return source;
}
function repositoryFromSource(base, source) {
  const repo=path.join(base,'repo'); fs.mkdirSync(repo);
  git(repo,['init','-b','testing']); git(repo,['config','user.email','fixture@example.invalid']); git(repo,['config','user.name','Fixture']);
  fs.cpSync(source,repo,{recursive:true}); git(repo,['add','.']); git(repo,['commit','-m','baseline']); return repo;
}

test('17.0.16 installer ignores untracked generated artifacts when .gitignore is missing and restores the release safely',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-generated-recovery-1716-'));
  try{
    const baseline=completeSource(temp,'17.0.13','baseline');
    const repo=repositoryFromSource(temp,baseline);
    for(const relative of ['package.json','release-source-manifest.json','.gitignore','src/marker.js']) fs.rmSync(path.join(repo,relative),{force:true});
    writeFile(repo,'node_modules/@google-cloud/cloud-sql-connector/node_modules/google-auth-library/build/src/auth/gdchclient.js','generated dependency\n');
    writeFile(repo,'build/stale.js','generated build\n');
    writeFile(repo,'coverage/coverage-final.json','{}\n');
    const raw=workflow.repositoryChangeEntries(repo);
    assert(raw.some(row=>row.status==='??' && row.file.includes('node_modules/')),'fixture must expose node_modules as untracked without .gitignore');
    const incoming=completeSource(temp,'17.0.16','incoming');
    const result=workflow.copyApplicationOverlay(incoming,repo,'17.0.16');
    assert.equal(result.recoveredIncompleteCheckout,true);
    assert(result.ignoredLocalArtifacts.some(file=>file.includes('node_modules/')));
    assert(result.ignoredLocalArtifacts.some(file=>file.startsWith('build/')));
    assert.equal(workflow.readPackageVersion(repo),'17.0.16');
    assert.equal(fs.readFileSync(path.join(repo,'src/marker.js'),'utf8'),'incoming\n');
    assert.equal(fs.readFileSync(path.join(repo,'.gitignore'),'utf8').includes('node_modules/'),true);
    assert.equal(fs.existsSync(path.join(repo,'node_modules/@google-cloud/cloud-sql-connector/node_modules/google-auth-library/build/src/auth/gdchclient.js')),true);
    assert.equal(workflow.verifyManifestSnapshot(repo,workflow.readReleaseManifest(repo)).ok,true);
    assert.equal(fs.existsSync(path.join(repo,'.git')),true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.16 installer preserves local environment/dependency artifacts that a valid app-only ZIP cannot overwrite',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-local-preserve-1716-'));
  try{
    const baseline=completeSource(temp,'17.0.15','baseline');
    const repo=repositoryFromSource(temp,baseline);
    fs.rmSync(path.join(repo,'.gitignore'),{force:true});
    writeFile(repo,'.env.test.local','LOCAL_ONLY=1\n');
    writeFile(repo,'.vercel/project.json','{"projectId":"local"}\n');
    writeFile(repo,'node_modules/local-only.txt','dependency cache\n');
    const incoming=completeSource(temp,'17.0.16','incoming');
    const result=workflow.copyApplicationOverlay(incoming,repo,'17.0.16');
    assert(result.ignoredLocalArtifacts.includes('.env.test.local'));
    assert(result.ignoredLocalArtifacts.some(file=>file==='.vercel/' || file==='.vercel/project.json'));
    assert.equal(fs.readFileSync(path.join(repo,'.env.test.local'),'utf8'),'LOCAL_ONLY=1\n');
    assert.equal(fs.readFileSync(path.join(repo,'.vercel/project.json'),'utf8'),'{"projectId":"local"}\n');
    assert.equal(fs.readFileSync(path.join(repo,'node_modules/local-only.txt'),'utf8'),'dependency cache\n');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.16 installer still refuses untracked source files and modified tracked source during recovery',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-real-source-refuse-1716-'));
  try{
    const baseline=completeSource(temp,'17.0.15','baseline');
    const repo=repositoryFromSource(temp,baseline);
    fs.rmSync(path.join(repo,'package.json'),{force:true});
    fs.rmSync(path.join(repo,'.gitignore'),{force:true});
    writeFile(repo,'node_modules/cache.js','generated\n');
    writeFile(repo,'src/local-user-file.js','do not overwrite me\n');
    fs.writeFileSync(path.join(repo,'src/marker.js'),'user modified tracked source\n');
    const incoming=completeSource(temp,'17.0.16','incoming');
    assert.throws(()=>workflow.copyApplicationOverlay(incoming,repo,'17.0.16'),error=>{
      assert.match(String(error.message),/Refusing to overwrite meaningful pre-existing repository changes/);
      assert.match(String(error.message),/src\/local-user-file\.js|src\/marker\.js/);
      return true;
    });
    assert.equal(fs.readFileSync(path.join(repo,'src/local-user-file.js'),'utf8'),'do not overwrite me\n');
    assert.equal(fs.readFileSync(path.join(repo,'src/marker.js'),'utf8'),'user modified tracked source\n');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

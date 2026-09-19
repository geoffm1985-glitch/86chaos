'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const workflow = require('../scripts/86chaos-release-workflow/install-app-only.cjs');
const root = path.resolve(__dirname, '..');

const TEXT_EXTENSIONS = /\.(?:js|jsx|cjs|mjs|json|css|html|md|txt|ps1|cmd|yml|yaml|rules|py|toml|sh)$/i;
function sourceBytes(file, bytes) { return TEXT_EXTENSIONS.test(file) || ['.gitignore','.gitattributes','.npmrc'].includes(path.posix.basename(file)) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes; }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function git(cwd, args) { const result=cp.spawnSync('git',args,{cwd,encoding:'utf8'}); assert.equal(result.status,0,result.stderr); return String(result.stdout||''); }
function writeFile(rootDir, relative, content='fixture\n') { const target=path.join(rootDir,relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content); }
function manifestFor(rootDir, files) {
  const rows=[...files].sort().map(file=>({file,sha256:sha(sourceBytes(file,fs.readFileSync(path.join(rootDir,file))))}));
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
  writeFile(source,'src/marker.js',`${marker}\n`);
  const files=[];
  const walk=dir=>{ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ const absolute=path.join(dir,entry.name), relative=path.relative(source,absolute).replace(/\\/g,'/'); if(entry.isDirectory()) walk(absolute); else if(entry.isFile()&&relative!=='release-source-manifest.json') files.push(relative); } };
  walk(source); manifestFor(source,files); return source;
}
function repositoryFromSource(base, source) {
  const repo=path.join(base,'repo'); fs.mkdirSync(repo);
  git(repo,['init','-b','testing']); git(repo,['config','user.email','fixture@example.invalid']); git(repo,['config','user.name','Fixture']);
  fs.cpSync(source,repo,{recursive:true});
  git(repo,['add','.']); git(repo,['commit','-m','baseline']);
  return repo;
}

test('17.0.15 installer self-heals a checkout with package.json and other tracked app files missing',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-self-heal-1715-'));
  try{
    const baseline=completeSource(temp,'17.0.13','baseline');
    const repo=repositoryFromSource(temp,baseline);
    fs.rmSync(path.join(repo,'package.json'));
    fs.rmSync(path.join(repo,'release-source-manifest.json'));
    fs.rmSync(path.join(repo,'src','marker.js'));
    const incoming=completeSource(temp,'17.0.15','incoming');
    const result=workflow.copyApplicationOverlay(incoming,repo,'17.0.15');
    assert.equal(result.recoveredIncompleteCheckout,true);
    assert.equal(result.gitPreserved,true);
    assert.equal(workflow.readPackageVersion(repo),'17.0.15');
    assert.equal(fs.readFileSync(path.join(repo,'src','marker.js'),'utf8'),'incoming\n');
    assert.equal(workflow.verifyManifestSnapshot(repo,workflow.readReleaseManifest(repo)).ok,true);
    assert.equal(fs.existsSync(path.join(repo,'.git')),true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.15 self-heal refuses a damaged checkout when real user edits are also present',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-self-heal-refuse-1715-'));
  try{
    const baseline=completeSource(temp,'17.0.13','baseline');
    const repo=repositoryFromSource(temp,baseline);
    fs.rmSync(path.join(repo,'package.json'));
    fs.writeFileSync(path.join(repo,'src','marker.js'),'user edit\n');
    const incoming=completeSource(temp,'17.0.15','incoming');
    assert.throws(()=>workflow.copyApplicationOverlay(incoming,repo,'17.0.15'),/Refusing to overwrite meaningful pre-existing repository changes/);
    assert.equal(fs.readFileSync(path.join(repo,'src','marker.js'),'utf8'),'user edit\n');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.15 PowerShell workflow validates the ZIP before repository version inspection and installs before npm validation',()=>{
  const script=fs.readFileSync(path.join(root,'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'),'utf8');
  const extract=script.indexOf("Invoke-Stage 'extract and validate release ZIP'");
  const repo=script.indexOf("Invoke-Stage 'verify repository and testing branch'");
  const transition=script.indexOf("Invoke-Stage 'identify release transition or safe resume'");
  const install=script.indexOf("Invoke-Stage 'install release ZIP into repository'");
  const safety=script.indexOf("Invoke-Stage 'repository safety before dependencies'");
  assert(extract>0 && repo>extract && transition>repo && install>transition && safety>install);
  assert.match(script,/Git HEAD recovery baseline/);
  assert.match(script,/Recovery upgrade mode:/);
  assert.match(script,/Release ZIP extracted and installed into repository/);
  assert.doesNotMatch(script,/Repository package\.json is missing: \$currentPackagePath/);
  assert.doesNotMatch(script,/test:play-store:(?:failed|delta|repair)/);
  assert.match(script,/@\('run', 'test:play-store'\)/);
});

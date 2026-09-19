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
function git(cwd, args) { const result = cp.spawnSync('git', args, { cwd, encoding:'utf8' }); assert.equal(result.status,0,result.stderr); return String(result.stdout||''); }
function writeFile(root, relative, content='fixture\n') { const target=path.join(root,relative); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content); }
function manifestFor(root, files) {
  const rows=[...files].sort().map(file=>({file,sha256:sha(sourceBytes(file,fs.readFileSync(path.join(root,file))))}));
  const manifest={schemaVersion:1,sourceHash:sha(Buffer.from(JSON.stringify(rows))),files:rows};
  fs.writeFileSync(path.join(root,'release-source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
function completeSource(base, version, marker, extras={}) {
  const source=path.join(base,`source-${version.replace(/\./g,'-')}-${marker}`); fs.mkdirSync(source,{recursive:true});
  for(const relative of workflow.REQUIRED_PATHS){
    const target=path.join(source,relative);
    if(relative==='release-source-manifest.json') continue;
    if(path.extname(relative)||/RUN_/.test(relative)){ fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target, relative==='package.json'?JSON.stringify({version})+'\n':'fixture\n'); }
    else fs.mkdirSync(target,{recursive:true});
  }
  writeFile(source,'src/marker.js',`${marker}\n`);
  for(const [relative,content] of Object.entries(extras)) writeFile(source,relative,content);
  const files=[];
  const walk=(dir)=>{ for(const entry of fs.readdirSync(dir,{withFileTypes:true})){ const absolute=path.join(dir,entry.name), relative=path.relative(source,absolute).replace(/\\/g,'/'); if(entry.isDirectory()) walk(absolute); else if(entry.isFile() && relative!=='release-source-manifest.json') files.push(relative); } };
  walk(source); manifestFor(source,files);
  return source;
}
function repository(base, version='17.0.11') {
  const repo=path.join(base,'repo'); fs.mkdirSync(repo);
  git(repo,['init','-b','testing']); git(repo,['config','user.email','fixture@example.invalid']); git(repo,['config','user.name','Fixture']);
  writeFile(repo,'package.json',JSON.stringify({version})+'\n'); writeFile(repo,'tracked.txt','base\n');
  git(repo,['add','.']); git(repo,['commit','-m','base']);
  return repo;
}

test('17.0.13 updater resumes a coherent interrupted 17.0.12 candidate and overlays 17.0.13 safely',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-resume-1713-'));
  try{
    const repo=repository(temp);
    const oldCandidate=completeSource(temp,'17.0.12','old-candidate');
    const first=workflow.copyApplicationOverlay(oldCandidate,repo,'17.0.12');
    assert.equal(first.gitPreserved,true);
    assert.equal(workflow.meaningfulRepositoryChanges(repo).length>0,true);
    const incoming=completeSource(temp,'17.0.13','new-candidate');
    const result=workflow.copyApplicationOverlay(incoming,repo,'17.0.13');
    assert.equal(result.resumedVerifiedCandidate,true);
    assert.equal(workflow.readPackageVersion(repo),'17.0.13');
    assert.equal(fs.readFileSync(path.join(repo,'src','marker.js'),'utf8'),'new-candidate\n');
    assert.equal(workflow.verifyManifestSnapshot(repo,workflow.readReleaseManifest(repo)).ok,true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.13 updater permits same-version resume only when current candidate is manifest-coherent',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-same-1713-'));
  try{
    const repo=repository(temp,'17.0.12');
    const candidate=completeSource(temp,'17.0.13','candidate-a');
    workflow.copyApplicationOverlay(candidate,repo,'17.0.13');
    const rerun=completeSource(temp,'17.0.13','candidate-b');
    const result=workflow.copyApplicationOverlay(rerun,repo,'17.0.13');
    assert.equal(result.resumedVerifiedCandidate,true);
    assert.equal(fs.readFileSync(path.join(repo,'src','marker.js'),'utf8'),'candidate-b\n');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.13 updater still refuses user edits and unmanifested dirty paths',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-refuse-1713-'));
  try{
    const repo=repository(temp);
    const oldCandidate=completeSource(temp,'17.0.12','old-candidate');
    workflow.copyApplicationOverlay(oldCandidate,repo,'17.0.12');
    fs.writeFileSync(path.join(repo,'src','marker.js'),'user edit\n');
    const incoming=completeSource(temp,'17.0.13','new-candidate');
    assert.throws(()=>workflow.copyApplicationOverlay(incoming,repo,'17.0.13'),/Refusing to overwrite meaningful pre-existing repository changes/);
    fs.writeFileSync(path.join(repo,'src','marker.js'),'old-candidate\n');
    fs.writeFileSync(path.join(repo,'personal-note.txt'),'do not overwrite\n');
    assert.throws(()=>workflow.copyApplicationOverlay(incoming,repo,'17.0.13'),/unmanifested dirty path|personal-note\.txt/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.13 updater removes only verified stale prior-release source files',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-stale-1713-'));
  try{
    const repo=repository(temp);
    const oldCandidate=completeSource(temp,'17.0.12','old-candidate',{'src/obsolete-release-file.js':'obsolete\n'});
    workflow.copyApplicationOverlay(oldCandidate,repo,'17.0.12');
    const incoming=completeSource(temp,'17.0.13','new-candidate');
    const result=workflow.copyApplicationOverlay(incoming,repo,'17.0.13');
    assert(result.removedFiles.includes('src/obsolete-release-file.js'));
    assert.equal(fs.existsSync(path.join(repo,'src','obsolete-release-file.js')),false);
    assert.equal(fs.existsSync(path.join(repo,'.git')),true);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('17.0.13 PowerShell workflow accepts immediate predecessor or same-version resume and stays non-interactive',()=>{
  const script=fs.readFileSync(path.join(root,'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'),'utf8');
  assert.match(script,/ExpectedVersion = '17\.0\.13'/);
  assert.match(script,/currentVersion -eq \$ExpectedVersion/);
  assert.match(script,/currentVersion -eq \$previousVersion/);
  assert.match(script,/Resume mode:/);
  assert.match(script,/Upgrade mode:/);
  assert.match(script,/GIT_PAGER = 'cat'/);
  assert.match(script,/git --no-pager/);
  assert.doesNotMatch(script,/test:play-store:(?:failed|delta|repair)/);
  assert.match(script,/@\('run', 'test:play-store'\)/);
});

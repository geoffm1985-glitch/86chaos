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
function git(cwd, args, options = {}) {
  const result = cp.spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return String(result.stdout || '');
}
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

function populateLargeDependencyTree(repo, count = 7000) {
  const dir=path.join(repo,'node_modules','@google-cloud','cloud-sql-connector','node_modules','google-auth-library','build','src','auth','generated');
  fs.mkdirSync(dir,{recursive:true});
  const suffix='x'.repeat(92);
  for(let index=0; index<count; index+=1){
    const name=`generated-${String(index).padStart(5,'0')}-${suffix}.js`;
    fs.writeFileSync(path.join(dir,name),'module.exports = true;\n');
  }
}

test('17.0.17 repository inspection stays bounded when missing .gitignore exposes a node_modules tree larger than spawnSync default maxBuffer',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-git-status-buffer-1717-'));
  try{
    const baseline=completeSource(temp,'17.0.16','baseline');
    const repo=repositoryFromSource(temp,baseline);
    for(const relative of ['package.json','release-source-manifest.json','.gitignore','src/marker.js']) fs.rmSync(path.join(repo,relative),{force:true});
    populateLargeDependencyTree(repo);

    const recursiveStatus=git(repo,['status','--porcelain=v1','--untracked-files=all']);
    assert(Buffer.byteLength(recursiveStatus,'utf8') > 1024 * 1024, 'fixture must exceed Node spawnSync default maxBuffer when recursively enumerated');

    const bounded=workflow.repositoryChangeEntries(repo);
    const dependencyRows=bounded.filter(row=>row.file.startsWith('node_modules'));
    assert.equal(dependencyRows.length,1,'directory-level status should collapse node_modules to one row');
    assert.equal(dependencyRows[0].status,'??');
    assert.match(dependencyRows[0].file,/^node_modules\/?$/);

    const incoming=completeSource(temp,'17.0.17','incoming');
    const result=workflow.copyApplicationOverlay(incoming,repo,'17.0.17');
    assert.equal(result.recoveredIncompleteCheckout,true);
    assert(result.ignoredLocalArtifacts.some(file=>/^node_modules\/?$/.test(file)));
    assert.equal(workflow.readPackageVersion(repo),'17.0.17');
    assert.equal(fs.readFileSync(path.join(repo,'src/marker.js'),'utf8'),'incoming\n');
    assert.equal(workflow.verifyManifestSnapshot(repo,workflow.readReleaseManifest(repo)).ok,true);
    assert.equal(fs.existsSync(path.join(repo,'.git')),true);
  }finally{ fs.rmSync(temp,{recursive:true,force:true}); }
});

test('17.0.17 bounded untracked reporting still exposes real untracked files inside tracked source directories',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chaos-git-status-source-1717-'));
  try{
    const baseline=completeSource(temp,'17.0.16','baseline');
    const repo=repositoryFromSource(temp,baseline);
    fs.rmSync(path.join(repo,'.gitignore'),{force:true});
    writeFile(repo,'node_modules/cache.js','generated\n');
    writeFile(repo,'src/local-user-file.js','do not overwrite\n');
    const entries=workflow.repositoryChangeEntries(repo);
    assert(entries.some(row=>row.status==='??' && row.file==='src/local-user-file.js'));
    assert(entries.some(row=>row.status==='??' && /^node_modules\/?$/.test(row.file)));
    const incoming=completeSource(temp,'17.0.17','incoming');
    assert.throws(()=>workflow.copyApplicationOverlay(incoming,repo,'17.0.17'),/Refusing to overwrite meaningful pre-existing repository changes/);
    assert.equal(fs.readFileSync(path.join(repo,'src/local-user-file.js'),'utf8'),'do not overwrite\n');
  }finally{ fs.rmSync(temp,{recursive:true,force:true}); }
});

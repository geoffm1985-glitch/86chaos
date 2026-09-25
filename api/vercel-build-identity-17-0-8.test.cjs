'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');
const stamp = require('../scripts/stamp-build-identity.cjs');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-identity-1708-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'test-tools/certification'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.8"}\n');
  fs.writeFileSync(path.join(dir, 'src/app.js'), 'export default 1;\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'docs\n');
  fs.writeFileSync(path.join(dir, 'public/version.json'), JSON.stringify({ version:'17.0.8', releaseTitle:'Vercel Deployment-Safe Identity Repair' })+'\n');
  fs.writeFileSync(path.join(dir, 'test-tools/certification/groups.json'), '{"groups":{}}\n');
  for (const name of ['firestore.rules','firebase.json','vercel.json']) fs.writeFileSync(path.join(dir, name), name+'\n');
  const files = ['README.md','package.json','public/version.json','src/app.js','test-tools/certification/groups.json','firestore.rules','firebase.json','vercel.json'].map(file => ({
    file,
    sha256: identity.hash(identity.sourceBytes(file, fs.readFileSync(path.join(dir, file)))),
  })).sort((a,b)=>a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  fs.writeFileSync(path.join(dir, 'release-source-manifest.json'), JSON.stringify({ schemaVersion:1, sourceHash:identity.hash(JSON.stringify(files)), files }, null, 2)+'\n');
  return dir;
}

function withVercelEnv(fn) {
  const keys=['VERCEL','VERCEL_GIT_COMMIT_SHA','VERCEL_GIT_COMMIT_REF','VERCEL_URL','CHAOS_STRICT_VERCEL_BUILD_WORKSPACE'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    process.env.VERCEL='1';
    process.env.VERCEL_GIT_COMMIT_SHA='89abcdef0123456789abcdef0123456789abcdef';
    process.env.VERCEL_GIT_COMMIT_REF='testing';
    process.env.VERCEL_URL='fixture.vercel.app';
    delete process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE;
    return fn();
  } finally {
    for (const [key,value] of Object.entries(previous)) value===undefined?delete process.env[key]:process.env[key]=value;
  }
}

test('17.0.8 Vercel build identity is bound to Git metadata and manifest without workspace scan', () => {
  const dir=fixture();
  const originalSpawnSync=cp.spawnSync;
  try {
    withVercelEnv(()=>{
      fs.writeFileSync(path.join(dir,'src/app.js'),'export default 2;\n');
      fs.writeFileSync(path.join(dir,'src/extra.js'),'export default true;\n');
      fs.unlinkSync(path.join(dir,'README.md'));
      cp.spawnSync=()=>{throw new Error('git subprocess must not run in Vercel build identity');};
      const result=identity.captureBuildSourceIdentity(dir);
      assert.equal(result.version,'17.0.8');
      assert.equal(result.sourceEvidence,'bundled-manifest');
      assert.equal(result.workspaceVerification,'vercel-git-metadata');
      assert.equal(result.commit,process.env.VERCEL_GIT_COMMIT_SHA);
      assert.equal(result.branch,'testing');
      assert.deepEqual(result.buildSourceChanges,[]);
      assert.match(result.sourceHash,/^[a-f0-9]{64}$/);
    });
  } finally { cp.spawnSync=originalSpawnSync; fs.rmSync(dir,{recursive:true,force:true}); }
});

test('17.0.8 keeps strict workspace verification as an opt-in diagnostic', () => {
  const dir=fixture();
  try {
    withVercelEnv(()=>{
      process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE='1';
      fs.writeFileSync(path.join(dir,'src/app.js'),'export default 2;\n');
      assert.throws(()=>identity.captureBuildSourceIdentity(dir),/Build source differs from release source/);
    });
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('17.0.8 identity stamp degrades instead of aborting deployment when manifest evidence is unavailable', () => {
  const dir=fixture();
  try {
    withVercelEnv(()=>{
      fs.unlinkSync(path.join(dir,'release-source-manifest.json'));
      const result=stamp.writeBuildIdentity(dir);
      assert.equal(result.identityStampStatus,'degraded');
      assert.equal(result.sourceManifestHash,null);
      assert.equal(result.commit,process.env.VERCEL_GIT_COMMIT_SHA);
      assert.equal(result.branch,'testing');
      const written=JSON.parse(fs.readFileSync(path.join(dir,'public/build-identity.json'),'utf8'));
      assert.equal(written.identityStampStatus,'degraded');
      assert.match(written.identityStampError,/release source manifest/i);
    });
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

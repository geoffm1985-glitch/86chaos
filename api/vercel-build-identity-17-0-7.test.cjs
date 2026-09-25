'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-identity-1707-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.7"}\n');
  fs.writeFileSync(path.join(dir, 'src/app.js'), 'export default 1;\n');
  const files = ['package.json', 'src/app.js'].map(file => ({
    file,
    sha256: identity.hash(identity.sourceBytes(file, fs.readFileSync(path.join(dir, file)))),
  })).sort((a,b)=>a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  fs.writeFileSync(path.join(dir, 'release-source-manifest.json'), JSON.stringify({ schemaVersion: 1, sourceHash: identity.hash(JSON.stringify(files)), files }, null, 2) + '\n');
  return dir;
}

test('17.0.7 Vercel identity does not invoke git and binds to Vercel metadata plus bundled source manifest', () => {
  const dir = fixture();
  const prev = { VERCEL: process.env.VERCEL, VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA, VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF };
  const originalSpawnSync = cp.spawnSync;
  try {
    process.env.VERCEL = '1';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef0123456789abcdef0123456789abcdef01';
    process.env.VERCEL_GIT_COMMIT_REF = 'testing';
    cp.spawnSync = () => { throw new Error('git subprocess must not run in Vercel identity path'); };
    const result = identity.captureBuildSourceIdentity(dir);
    assert.equal(result.version, '17.0.7');
    assert.equal(result.sourceEvidence, 'bundled-manifest');
    assert.equal(result.commit, process.env.VERCEL_GIT_COMMIT_SHA);
    assert.equal(result.branch, 'testing');
    assert.equal(result.dirty, false);
    assert.deepEqual(result.dirtyPaths, []);
  } finally {
    cp.spawnSync = originalSpawnSync;
    for (const [key,value] of Object.entries(prev)) value === undefined ? delete process.env[key] : process.env[key] = value;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

function writeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vercel-identity-1706-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.6"}\n');
  fs.writeFileSync(path.join(dir, 'src/app.js'), 'let value = 1;\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'docs\n');
  const files = ['README.md', 'package.json', 'src/app.js'].map(file => ({
    file,
    sha256: identity.hash(identity.sourceBytes(file, fs.readFileSync(path.join(dir, file)))),
  })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  fs.writeFileSync(path.join(dir, 'release-source-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    sourceHash: identity.hash(JSON.stringify(files)),
    files,
  }, null, 2) + '\n');
  return dir;
}

test('17.0.6 Vercel build identity works without .git and preserves exact build-input verification', () => {
  const dir = writeFixture();
  const previous = {
    VERCEL: process.env.VERCEL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  };
  try {
    process.env.VERCEL = '1';
    process.env.VERCEL_GIT_COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
    process.env.VERCEL_GIT_COMMIT_REF = 'testing';
    const first = identity.captureBuildSourceIdentity(dir);
    assert.equal(first.version, '17.0.6');
    assert.equal(first.sourceEvidence, 'bundled-manifest');
    assert.equal(first.commit, process.env.VERCEL_GIT_COMMIT_SHA);
    assert.equal(first.branch, 'testing');
    assert.equal(first.dirty, false);

    fs.unlinkSync(path.join(dir, 'README.md'));
    const filtered = identity.captureBuildSourceIdentity(dir);
    assert.equal(filtered.sourceHash, first.sourceHash);
    assert.deepEqual(filtered.buildSourceChanges, [{ file: 'README.md', reason: 'absent', buildInput: false }]);

    fs.writeFileSync(path.join(dir, 'src/app.js'), 'let value = 2;\n');
    assert.throws(() => identity.captureBuildSourceIdentity(dir), /Build source differs from release source: src\/app\.js \(modified\)/);
    fs.writeFileSync(path.join(dir, 'src/app.js'), 'let value = 1;\n');

    fs.writeFileSync(path.join(dir, 'src/extra.js'), 'export default true;\n');
    assert.throws(() => identity.captureBuildSourceIdentity(dir), /Unmanifested build inputs: src\/extra\.js/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

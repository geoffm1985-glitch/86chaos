'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-history-17012-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.12"}\n');
  fs.writeFileSync(path.join(dir, 'src/app.js'), 'let value=1;\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'Source docs\n');
  const git = args => {
    const result = cp.spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git(['init', '-b', 'testing']);
  git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']);
  const source = identity.captureSourceIdentity(dir);
  fs.writeFileSync(
    path.join(dir, 'release-source-manifest.json'),
    JSON.stringify({ schemaVersion: 1, sourceHash: source.sourceHash, files: source.files }, null, 2) + '\n'
  );
  return { dir, source };
}

function withVercelEnv(fn) {
  const keys = ['VERCEL', 'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'CHAOS_STRICT_VERCEL_BUILD_WORKSPACE'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.VERCEL = '1';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef0123456789abcdef0123456789abcdef01';
    process.env.VERCEL_GIT_COMMIT_REF = 'testing';
    delete process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE;
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      value === undefined ? delete process.env[key] : process.env[key] = value;
    }
  }
}

test('17.0.12 normal Vercel identity stays manifest/Git-bound while strict diagnostics catch modified and deleted build inputs', () => {
  const { dir, source } = fixture();
  try {
    withVercelEnv(() => {
      fs.unlinkSync(path.join(dir, 'README.md'));
      fs.writeFileSync(path.join(dir, 'src/app.js'), 'let value=2;\n');

      const normal = identity.captureBuildSourceIdentity(dir);
      assert.equal(normal.sourceHash, source.sourceHash);
      assert.equal(normal.sourceEvidence, 'bundled-manifest');
      assert.equal(normal.workspaceVerification, 'vercel-git-metadata');
      assert.deepEqual(normal.buildSourceChanges, []);

      process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE = '1';
      assert.throws(() => identity.captureBuildSourceIdentity(dir), /Build source differs from release source/);

      fs.writeFileSync(path.join(dir, 'src/app.js'), 'let value=1;\n');
      const strict = identity.captureBuildSourceIdentity(dir);
      assert.equal(strict.workspaceVerification, 'strict-diagnostic');
      assert.deepEqual(strict.buildSourceChanges, [{ file: 'README.md', reason: 'absent', buildInput: false }]);

      fs.unlinkSync(path.join(dir, 'src/app.js'));
      assert.throws(() => identity.captureBuildSourceIdentity(dir), /src\/app\.js \(absent\)/);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

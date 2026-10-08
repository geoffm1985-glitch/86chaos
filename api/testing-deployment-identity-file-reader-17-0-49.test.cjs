'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('17.0.49 deployment wait parses oversized build identity from a file instead of argv', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-deploy-identity-'));
  try {
    const identityPath = path.join(dir, 'build-identity.json');
    const versionPath = path.join(dir, 'version.json');
    const commit = '11ff89c4dae82a22d7a473a2e8de4b589b734a8f';
    fs.writeFileSync(identityPath, JSON.stringify({ gitCommit: commit, padding: 'x'.repeat(1024 * 1024) }));
    fs.writeFileSync(versionPath, JSON.stringify({ version: '17.0.49' }));

    const read = (kind, file) => cp.spawnSync(process.execPath, ['scripts/ci/read-deployment-identity.cjs', kind, file], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    const commitResult = read('commit', identityPath);
    const versionResult = read('version', versionPath);
    assert.equal(commitResult.status, 0, commitResult.stderr);
    assert.equal(versionResult.status, 0, versionResult.stderr);
    assert.equal(commitResult.stdout, commit);
    assert.equal(versionResult.stdout, '17.0.49');

    const workflow = fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8');
    assert.match(workflow, /curl --fail --silent --show-error -o \"\$identity_file\"/);
    assert.match(workflow, /read-deployment-identity\.cjs commit \"\$identity_file\"/);
    assert.match(workflow, /read-deployment-identity\.cjs version \"\$version_file\"/);
    assert.doesNotMatch(workflow, /JSON\.parse\(process\.argv\[1\]\).*\"\$identity\"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

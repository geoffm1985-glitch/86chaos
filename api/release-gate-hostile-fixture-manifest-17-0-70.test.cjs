'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const historicalFixture = path.join(root, 'api/release-gate-execution-17-0-5.test.cjs');

test('17.0.70 hostile preflight fixture writes schema/version/source hash/file inventory together', () => {
  const source = fs.readFileSync(historicalFixture, 'utf8');
  assert.match(source, /JSON\.stringify\(\{schemaVersion:2,version:initial\.version,sourceHash:initial\.sourceHash,files:initial\.files\}/);
  assert.match(source, /const good=run\('good-source'/);
  assert.match(source, /assert\.equal\(good\.result\.status,0/);
});

test('17.0.70 synthetic hostile fixture manifest satisfies the current source validator', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hostile-manifest-17070-'));
  const repo = path.join(temp, 'repo');
  try {
    fs.cpSync(root, repo, { recursive: true, filter: source => source === root || !identity.excludedFile(path.relative(root, source)) });
    const captured = identity.captureSourceIdentity(repo);
    fs.writeFileSync(path.join(repo, 'release-source-manifest.json'), JSON.stringify({
      schemaVersion: 2,
      version: captured.version,
      sourceHash: captured.sourceHash,
      files: captured.files,
    }, null, 2) + '\n');
    const currentValidator = String(require('../package.json').scripts['test:source'] || '').match(/^node\s+(.+\.js)$/)?.[1];
    assert.ok(currentValidator, 'current test:source script exposes the active source validator');
    const result = cp.spawnSync(process.execPath, [currentValidator], {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

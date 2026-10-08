'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');

test('17.0.60 source inventory is Git/ZIP invariant for overlaid repairs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-source-inventory-'));
  try {
    fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.60"}\n');
    fs.writeFileSync(path.join(dir, 'source.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(dir, '.npmrc'), 'fund=false\n');
    cp.spawnSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    cp.spawnSync('git', ['add', 'package.json', 'source.js', '.npmrc'], { cwd: dir, stdio: 'ignore' });
    fs.writeFileSync(path.join(dir, 'api', 'overlay-repair.test.cjs'), "'use strict';\n");

    const files = identity.sourceFiles(dir);
    assert.ok(files.includes('api/overlay-repair.test.cjs'), 'unindexed Yardmaster repair file remains source evidence');
    assert.ok(!files.includes('.npmrc'), 'local-only npm config cannot change application source identity');

    const captured = identity.captureSourceIdentity(dir);
    fs.writeFileSync(path.join(dir, 'release-source-manifest.json'), JSON.stringify({ schemaVersion: 2, sourceHash: captured.sourceHash, files: captured.files }, null, 2) + '\n');
    const bundled = identity.readBundledSourceManifest(dir);
    assert.equal(bundled.sourceHash, captured.sourceHash);
    assert.deepEqual(bundled.files, captured.files);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('17.0.60 manifest parity still rejects real application-source drift', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-source-drift-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.60"}\n');
    fs.writeFileSync(path.join(dir, 'source.js'), 'one\n');
    const before = identity.captureSourceIdentity(dir);
    fs.writeFileSync(path.join(dir, 'source.js'), 'two\n');
    const after = identity.captureSourceIdentity(dir);
    assert.notEqual(after.sourceHash, before.sourceHash);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('17.0.60 repair is mandatory in release-gate and Playwright inventory', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  const spec = 'tests/86chaos-release-gate/72-release-gate-source-inventory-17-0-60.spec.cjs';
  const pkg = require('../package.json');
  assert.ok(pkg.scripts['test:current-release-targeted'].includes('release-gate-source-inventory-17-0-60.test.cjs'));
  assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(spec));
  assert.match(fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8'), /72-release-gate-source-inventory-17-0-60\.spec\.cjs/);
});

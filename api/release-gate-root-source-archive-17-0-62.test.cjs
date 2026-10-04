'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const identity = require('../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');

function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function copyInventory(from, to, rows) {
  for (const row of rows) {
    const source = path.join(from, row.file);
    const target = path.join(to, row.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

test('17.0.62 root 86 Chaos source ZIP artifact cannot change Git versus packaged source identity', () => {
  const gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-git-root-archive-'));
  const zipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-zip-root-archive-'));
  try {
    write(path.join(gitDir, 'package.json'), '{"version":"17.0.62"}\n');
    write(path.join(gitDir, 'source.js'), 'module.exports = 1;\n');
    cp.spawnSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
    cp.spawnSync('git', ['add', 'package.json', 'source.js'], { cwd: gitDir, stdio: 'ignore' });

    // Exact checkout-only artifact that caused the 17.0.61 parity failure.
    write(path.join(gitDir, '86chaos-17.0.57-EXACT-FAILED-SOURCE.zip'), Buffer.from('stale source archive'));
    // A real unindexed repair must still remain visible to certification.
    write(path.join(gitDir, 'api', 'overlay-repair.test.cjs'), "'use strict';\n");
    // A nested ZIP may be a deliberate runtime asset and must not be hidden.
    write(path.join(gitDir, 'public', 'assets', '86chaos-demo.zip'), Buffer.from('runtime asset'));

    const gitCaptured = identity.captureSourceIdentity(gitDir);
    assert.ok(!gitCaptured.files.some(row => row.file === '86chaos-17.0.57-EXACT-FAILED-SOURCE.zip'), 'root source handoff ZIP is not application source');
    assert.ok(gitCaptured.files.some(row => row.file === 'api/overlay-repair.test.cjs'), 'real unindexed repair remains source evidence');
    assert.ok(gitCaptured.files.some(row => row.file === 'public/assets/86chaos-demo.zip'), 'nested runtime ZIP remains source evidence');

    copyInventory(gitDir, zipDir, gitCaptured.files);
    const zipCaptured = identity.captureSourceIdentity(zipDir);
    assert.equal(zipCaptured.sourceHash, gitCaptured.sourceHash);
    assert.deepEqual(zipCaptured.files, gitCaptured.files);
  } finally {
    fs.rmSync(gitDir, { recursive: true, force: true });
    fs.rmSync(zipDir, { recursive: true, force: true });
  }
});

test('17.0.62 root source archive repair is mandatory in release-gate and Playwright inventory', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  const spec = 'tests/86chaos-release-gate/74-release-gate-root-source-archive-17-0-62.spec.cjs';
  const pkg = require('../package.json');
  assert.ok(pkg.scripts['test:current-release-targeted'].includes('release-gate-root-source-archive-17-0-62.test.cjs'));
  assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(spec));
  assert.match(fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8'), /74-release-gate-root-source-archive-17-0-62\.spec\.cjs/);
});

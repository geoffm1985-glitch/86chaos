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

test('17.0.61 Git inventory excludes ignored machine-local files but retains unindexed repairs', () => {
  const gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-git-source-'));
  const zipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-zip-source-'));
  try {
    write(path.join(gitDir, 'package.json'), '{"version":"17.0.61"}\n');
    write(path.join(gitDir, 'source.js'), 'module.exports = 1;\n');
    write(path.join(gitDir, '.gitignore'), 'local-machine.json\n');
    write(path.join(gitDir, '.npmrc'), 'fund=false\n');
    cp.spawnSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
    cp.spawnSync('git', ['add', 'package.json', 'source.js', '.gitignore', '.npmrc'], { cwd: gitDir, stdio: 'ignore' });
    write(path.join(gitDir, 'api', 'overlay-repair.test.cjs'), "'use strict';\n");
    write(path.join(gitDir, 'local-machine.json'), '{"machine":true}\n');

    const gitCaptured = identity.captureSourceIdentity(gitDir);
    assert.ok(gitCaptured.files.some(row => row.file === 'api/overlay-repair.test.cjs'), 'unindexed Yardmaster repair remains source evidence');
    assert.ok(!gitCaptured.files.some(row => row.file === 'local-machine.json'), 'Git-ignored machine-local file is not packaged source evidence');
    assert.ok(!gitCaptured.files.some(row => row.file === '.npmrc'), 'explicit local npm config remains excluded');

    copyInventory(gitDir, zipDir, gitCaptured.files);
    const zipCaptured = identity.captureSourceIdentity(zipDir);
    assert.equal(zipCaptured.sourceHash, gitCaptured.sourceHash);
    assert.deepEqual(zipCaptured.files, gitCaptured.files);
  } finally {
    fs.rmSync(gitDir, { recursive: true, force: true });
    fs.rmSync(zipDir, { recursive: true, force: true });
  }
});

test('17.0.61 ignored-local-source repair is mandatory in release-gate and Playwright inventory', () => {
  const universe = require('../scripts/86chaos-release-gate/release-test-universe.cjs');
  const spec = 'tests/86chaos-release-gate/73-release-gate-ignored-local-source-17-0-61.spec.cjs';
  const pkg = require('../package.json');
  assert.ok(pkg.scripts['test:current-release-targeted'].includes('release-gate-ignored-local-source-17-0-61.test.cjs'));
  assert.ok(universe.RELEASE_CRITICAL_SPECS.includes(spec));
  assert.match(fs.readFileSync(path.join(root, '.github/workflows/testing-targeted-delta.yml'), 'utf8'), /73-release-gate-ignored-local-source-17-0-61\.spec\.cjs/);
});

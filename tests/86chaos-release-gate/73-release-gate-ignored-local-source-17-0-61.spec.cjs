const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const identity = require('../../scripts/86chaos-release-gate/source-identity.cjs');

function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function copyInventory(from, to, rows) {
  for (const row of rows) {
    const source = path.join(from, row.file);
    const target = path.join(to, row.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

test.describe('17.0.61 ignored local source boundary repair', () => {
  test('Git checkout and packaged ZIP keep the same fingerprint with ignored local state present', () => {
    const gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-pw-git-source-'));
    const zipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-pw-zip-source-'));
    try {
      write(path.join(gitDir, 'package.json'), '{"version":"17.0.61"}\n');
      write(path.join(gitDir, 'source.js'), 'module.exports = 1;\n');
      write(path.join(gitDir, '.gitignore'), 'local-machine.json\n');
      cp.spawnSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
      cp.spawnSync('git', ['add', 'package.json', 'source.js', '.gitignore'], { cwd: gitDir, stdio: 'ignore' });
      write(path.join(gitDir, 'api', 'overlay-repair.test.cjs'), "'use strict';\n");
      write(path.join(gitDir, 'local-machine.json'), '{"machine":true}\n');

      const gitCaptured = identity.captureSourceIdentity(gitDir);
      expect(gitCaptured.files.some(row => row.file === 'api/overlay-repair.test.cjs')).toBe(true);
      expect(gitCaptured.files.some(row => row.file === 'local-machine.json')).toBe(false);
      copyInventory(gitDir, zipDir, gitCaptured.files);
      const zipCaptured = identity.captureSourceIdentity(zipDir);
      expect(zipCaptured.sourceHash).toBe(gitCaptured.sourceHash);
      expect(zipCaptured.files).toEqual(gitCaptured.files);
    } finally {
      fs.rmSync(gitDir, { recursive: true, force: true });
      fs.rmSync(zipDir, { recursive: true, force: true });
    }
  });
});

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

test.describe('17.0.62 root source archive boundary repair', () => {
  test('checkout-only stale source ZIP cannot change packaged certification fingerprint', () => {
    const gitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-pw-git-root-archive-'));
    const zipDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-pw-zip-root-archive-'));
    try {
      write(path.join(gitDir, 'package.json'), '{"version":"17.0.62"}\n');
      write(path.join(gitDir, 'source.js'), 'module.exports = 1;\n');
      cp.spawnSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
      cp.spawnSync('git', ['add', 'package.json', 'source.js'], { cwd: gitDir, stdio: 'ignore' });
      write(path.join(gitDir, '86chaos-17.0.57-EXACT-FAILED-SOURCE.zip'), Buffer.from('stale source archive'));
      write(path.join(gitDir, 'api', 'overlay-repair.test.cjs'), "'use strict';\n");
      write(path.join(gitDir, 'public', 'assets', '86chaos-demo.zip'), Buffer.from('runtime asset'));

      const gitCaptured = identity.captureSourceIdentity(gitDir);
      expect(gitCaptured.files.some(row => row.file === '86chaos-17.0.57-EXACT-FAILED-SOURCE.zip')).toBe(false);
      expect(gitCaptured.files.some(row => row.file === 'api/overlay-repair.test.cjs')).toBe(true);
      expect(gitCaptured.files.some(row => row.file === 'public/assets/86chaos-demo.zip')).toBe(true);
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

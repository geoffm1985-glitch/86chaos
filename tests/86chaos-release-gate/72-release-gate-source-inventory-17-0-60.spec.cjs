const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const identity = require('../../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.60 Git/ZIP source inventory parity repair', () => {
  test('Git/ZIP source inventory remains deterministic in Playwright regression', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-pw-source-inventory-'));
    try {
      fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"17.0.60"}\n');
      fs.writeFileSync(path.join(dir, 'source.js'), 'module.exports = 1;\n');
      fs.writeFileSync(path.join(dir, '.npmrc'), 'fund=false\n');
      cp.spawnSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
      cp.spawnSync('git', ['add', 'package.json', 'source.js', '.npmrc'], { cwd: dir, stdio: 'ignore' });
      fs.writeFileSync(path.join(dir, 'api', 'overlay-repair.test.cjs'), "'use strict';\n");
      const captured = identity.captureSourceIdentity(dir);
      expect(captured.files.some(row => row.file === 'api/overlay-repair.test.cjs')).toBe(true);
      expect(captured.files.some(row => row.file === '.npmrc')).toBe(false);
      fs.writeFileSync(path.join(dir, 'release-source-manifest.json'), JSON.stringify({ schemaVersion: 2, sourceHash: captured.sourceHash, files: captured.files }, null, 2) + '\n');
      const bundled = identity.readBundledSourceManifest(dir);
      expect(bundled.sourceHash).toBe(captured.sourceHash);
      expect(bundled.files).toEqual(captured.files);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('current bundled manifest matches current application source inventory', () => {
    const bundled = identity.readBundledSourceManifest(root);
    const captured = identity.captureSourceIdentity(root);
    expect(bundled).toBeTruthy();
    expect(bundled.sourceHash).toBe(captured.sourceHash);
    expect(bundled.files).toEqual(captured.files);
  });
});

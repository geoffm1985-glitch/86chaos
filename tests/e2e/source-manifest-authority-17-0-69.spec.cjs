'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '../..');
const target = 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs';

test.describe('17.0.69 independent source manifest regression', () => {
  test('the exact file from the captured inverse-hash failure cannot be stale in the bundle', async () => {
    const manifest = identity.readBundledSourceManifest(root);
    const row = manifest.files.find(entry => entry.file === target);
    expect(row).toBeTruthy();
    expect(row.sha256).toBe(identity.hash(identity.sourceBytes(target, fs.readFileSync(path.join(root, target)))));
  });

  test('source identity remains fail-closed after the final release tree is sealed', async () => {
    const manifest = identity.readBundledSourceManifest(root);
    const captured = identity.captureSourceIdentity(root);
    expect(manifest.sourceHash).toBe(captured.sourceHash);
    expect(manifest.files.length).toBe(captured.files.length);
  });
});

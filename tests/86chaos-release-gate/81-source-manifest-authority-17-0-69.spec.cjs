'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '../..');
const target = 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs';

test.describe('17.0.69 source manifest authority repair', () => {
  test('drifted failed-only utility bytes are exactly the bytes sealed in the release manifest', async () => {
    const bundled = identity.readBundledSourceManifest(root);
    const row = bundled.files.find(entry => entry.file === target);
    expect(row).toBeTruthy();
    const actual = identity.hash(identity.sourceBytes(target, fs.readFileSync(path.join(root, target))));
    expect(row.sha256).toBe(actual);
  });

  test('complete packaged source and bundled manifest resolve to the same source hash', async () => {
    const bundled = identity.readBundledSourceManifest(root);
    const captured = identity.captureSourceIdentity(root);
    expect(bundled.sourceHash).toBe(captured.sourceHash);
    expect(bundled.files).toEqual(captured.files);
  });
});

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const identity = require('../../scripts/86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test.describe('17.0.59 release-gate staleness and manifest parity repair', () => {
  test('historical release-gate wiring tracks the active validator across later patch versions', () => {
    const pkg = JSON.parse(read('package.json'));
    const historical = read('api/firebase-emulator-entry-import-17-0-56.test.cjs');
    const activeValidator = `validate-${pkg.version.replace(/\./g, '-')}.js`;
    expect(historical).not.toMatch(/validate-17-0-57\.js/);
    expect(pkg.scripts['test:current-release-targeted']).toContain(activeValidator);
    expect(pkg.scripts['test:current-release-targeted']).toContain('release-gate-staleness-manifest-17-0-59.test.cjs');
  });

  test('bundled certification manifest is byte-for-byte current with the repaired source inventory', () => {
    const captured = identity.captureSourceIdentity(root);
    const bundled = identity.readBundledSourceManifest(root);
    expect(bundled).toBeTruthy();
    expect(bundled.sourceHash).toBe(captured.sourceHash);
    expect(bundled.files).toEqual(captured.files);
  });
});

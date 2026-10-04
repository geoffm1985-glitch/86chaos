'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.72 nested Node reporter independence', () => {
  test('nested cross-version validation trusts child exit status instead of TAP summary text', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-manifest-emulator-target-17-0-71.test.cjs'), 'utf8');
    expect(source).toContain('assert.equal(result.status, 0');
    expect(source).not.toContain('# pass 11');
    expect(source).not.toContain('# fail 0');
  });

  test('targeted regression reproduces a non-TAP reporter environment', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-manifest-reporter-independence-17-0-72.test.cjs'), 'utf8');
    expect(source).toContain("NODE_OPTIONS: '--test-reporter=spec'");
    expect(source).toContain("api/failed-only-manifest-emulator-target-17-0-71.test.cjs");
    expect(source).toContain('assert.equal(result.status, 0, output)');
  });
});

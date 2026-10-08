'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.71 failed-only manifest Firebase target coherence', () => {
  test('current target validation uses the shared Firebase target resolver instead of a live-project literal', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-manifest-cross-version.test.cjs'), 'utf8');
    expect(source).toContain("const { expectedFirebaseProject } = require('../scripts/86chaos-firebase-target.cjs');");
    expect((source.match(/firebaseProjectId: expectedFirebaseProject\(process\.env\)/g) || []).length).toBe(3);
  });

  test('targeted Node regression executes the historical server fixture in emulator and live modes', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-manifest-emulator-target-17-0-71.test.cjs'), 'utf8');
    expect(source).toContain("runCrossVersionFixture('emulator')");
    expect(source).toContain("runCrossVersionFixture('live')");
    expect(source).toContain("YARDMASTER_FIREBASE_PROJECT: target === 'emulator' ? 'demo-86chaos' : 'chaos-test-d1601'");
  });
});

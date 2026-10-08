'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.73 failed-only recovery Firebase target coherence', () => {
  test('current recovery validation uses the shared Firebase target while historical evidence stays live-project evidence', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-repair-selection-16-0-153.test.cjs'), 'utf8');
    expect(source).toContain("const { expectedFirebaseProject } = require('../scripts/86chaos-firebase-target.cjs');");
    expect(source).toMatch(/environment-preflight\.json'[\s\S]*firebaseProjectId: 'chaos-test-d1601'/);
    expect(source).toMatch(/currentSourceVersion: '16\.0\.159'[\s\S]*firebaseProjectId: expectedFirebaseProject\(process\.env\)/);
  });

  test('targeted Node regression executes the exact recovery fixture in emulator and live modes', async () => {
    const source = fs.readFileSync(path.join(root, 'api/failed-only-repair-selection-emulator-target-17-0-73.test.cjs'), 'utf8');
    expect(source).toContain("for (const target of ['emulator', 'live'])");
    expect(source).toContain("YARDMASTER_FIREBASE_PROJECT: target === 'emulator' ? 'demo-86chaos' : 'chaos-test-d1601'");
    expect(source).toContain("api/failed-only-repair-selection-16-0-153.test.cjs");
  });
});

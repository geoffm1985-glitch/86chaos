'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.75 QA role Firebase target fixture repair', () => {
  test('role fixture resolves current project identity through the shared target resolver', async () => {
    const source = fs.readFileSync(
      path.join(root, 'api/qa-role-definitions.test.cjs'),
      'utf8'
    );

    expect(source).toContain('EXPECTED_FIREBASE_PROJECT');
    expect(source).toContain('firebaseProjectId: EXPECTED_FIREBASE_PROJECT');
    expect(source).toContain('runtimeProjectId: EXPECTED_FIREBASE_PROJECT');
    expect(source).not.toContain("firebaseProjectId: 'chaos-test-d1601'");
  });

  test('targeted server regression executes the role fixture in emulator and live modes', async () => {
    const source = fs.readFileSync(
      path.join(root, 'api/qa-role-fixture-emulator-target-17-0-75.test.cjs'),
      'utf8'
    );

    expect(source).toContain("runRoleFixture('emulator')");
    expect(source).toContain("runRoleFixture('live')");
    expect(source).toContain("expectedFirebaseProject(env), 'demo-86chaos'");
    expect(source).toContain("expectedFirebaseProject(env), 'chaos-test-d1601'");
  });
});

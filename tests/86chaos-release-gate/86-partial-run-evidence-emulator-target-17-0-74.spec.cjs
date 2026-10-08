'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test.describe('17.0.74 partial-resume Firebase target fixture repair', () => {
  test('historical preflight fixtures derive both Firebase project identities from the shared target resolver', async () => {
    const source = fs.readFileSync(
      path.join(root, 'api/partial-run-evidence-16-0-231.test.cjs'),
      'utf8'
    );

    expect(source).toContain(
      "const { expectedFirebaseProject } = require('../scripts/86chaos-firebase-target.cjs');"
    );

    expect(
      (
        source.match(
          /firebaseProjectId: expectedFirebaseProject\(process\.env\)/g
        ) || []
      ).length
    ).toBe(2);

    expect(source).not.toContain(
      "firebaseProjectId: 'chaos-test-d1601'"
    );
  });

  test('targeted server regression explicitly covers emulator and live target modes', async () => {
    const source = fs.readFileSync(
      path.join(
        root,
        'api/partial-run-evidence-emulator-target-17-0-74.test.cjs'
      ),
      'utf8'
    );

    expect(source).toContain(
      "for (const target of ['emulator', 'live'])"
    );
    expect(source).toContain(
      'assert.equal(result.status, 0, output)'
    );
    expect(source).toContain(
      'Partial resume refused: the test workspace environment does not match'
    );
  });
});
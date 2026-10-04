'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const fixturePath = path.join(root, 'api/release-gate-execution-17-0-5.test.cjs');

test.describe('17.0.70 hostile fixture manifest compatibility repair', () => {
  test('historical hostile good-path fixture supplies the current manifest version contract', async () => {
    const source = fs.readFileSync(fixturePath, 'utf8');
    expect(source).toMatch(/schemaVersion:2,version:initial\.version,sourceHash:initial\.sourceHash,files:initial\.files/);
    expect(source).toMatch(/const good=run\('good-source'/);
    expect(source).toMatch(/assert\.equal\(good\.result\.status,0/);
  });

  test('targeted Node regression executes the current source validator against a synthetic hostile manifest', async () => {
    const targeted = fs.readFileSync(path.join(root, 'api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs'), 'utf8');
    expect(targeted).toContain("scripts?.['test:source']");
    expect(targeted).toContain('validatorMatch[1]');
    expect(targeted).toContain('version: captured.version');
  });
});

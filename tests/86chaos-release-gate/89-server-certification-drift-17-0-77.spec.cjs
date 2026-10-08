'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.77 server certification drift repair', () => {
  test('release-gate source assertions follow the current stable contracts', async () => {
    const hostile = read('api/release-gate-hostile-fixture-manifest-17-0-70.test.cjs');
    const schedule = read('api/schedule-warning-request-off-controls.test.cjs');
    const spanish = read('api/spanish-release-gate-fidelity-17-0-29.test.cjs');
    expect(hostile).toContain("scripts['test:source']");
    expect(hostile).not.toContain("cp.spawnSync(process.execPath, ['scripts/validate-17-0-70.js']");
    expect(read('api/release-gate-maturity-16-0-209.test.cjs')).toContain('schedule-copilot-warnings-tab');
    expect(read('api/release-gate-runner-observability.test.cjs')).toContain('yardmaster-dependency-install');
    expect(schedule).toMatch(/assert\.equal\(rows\[0\]\.existing,\s*2\)/);
    expect(schedule).toMatch(/assert\.equal\(rows\[0\]\.target,\s*1\)/);
    expect(spanish).toMatch(/saveLanguagePreference/);
    expect(spanish).toContain("assert.match(spec, /saveLanguagePreference\\(page,\\s*['\\\"]es['\\\"]\\)/);");
  });
});

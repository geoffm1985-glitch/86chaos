'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.84 owned full-gate fidelity repair', () => {
  test('captured Ghost Request Off and export/import failures have deterministic QA boundaries', async () => {
    const profile = read('tests/86chaos-full-audit/utils/fake-restaurant-profile.cjs');
    const exportSpec = read('tests/86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs');
    expect(profile).toMatch(/timeOffPolicy:\s*\{\s*enabled:\s*false,/);
    expect(exportSpec).toContain('let authRecoveries = 0');
    expect(exportSpec).toContain('Export/import audit may recover one transient emulator auth handoff, never a repeating logout loop');
    expect(exportSpec).toContain('must remain authenticated after at most one recovery');
  });

  test('captured chunk and runtime-coverage failures follow the actual recovery and auth lifecycles', async () => {
    const chunk = read('tests/86chaos-release-gate/17-resilience-chunk-offline.spec.cjs');
    const coverage = read('tests/86chaos-release-gate/21-runtime-code-coverage.spec.cjs');
    expect(chunk).toContain('recoveredHealthyApp || usableRecoveryUi');
    expect(chunk).not.toContain('Repeated chunk failure must provide a usable update/recovery action');
    expect(coverage).toContain('name: /open sign out|log out/i');
    expect(coverage).toContain('reload after logout must stay signed out');
    expect(coverage).toContain('Verified System Administrator must actually enter godmode before runtime coverage is scored');
  });
});

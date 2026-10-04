'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {
  scheduleFixtureDateFromSeed,
  scheduleRequestOffConflictAnchorFromSeed,
} = require('../e2e/utils/schedule-request-off-fixture-anchor.cjs');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test.describe('17.0.82 failed+new lineage repair', () => {
  test('Request Off boundary seed keeps coverage in September but runs the conflict identity assertion in October', async () => {
    const seed = {
      seedAnchorDate: '2026-10-04T15:08:50.000-05:00',
      ghostRequestOffConflictDate: '2026-10-05',
      profile: { expectations: { fixture: {
        anchor: '2026-10-04',
        currentWeekStart: '2026-09-28',
        shifts: [{ employeeName: 'Chuck QA', role: 'Bartender', startTime: '10a', date: '2026-09-29' }],
      } } },
    };
    expect(scheduleFixtureDateFromSeed(seed)).toBe('2026-09-28');
    expect(scheduleRequestOffConflictAnchorFromSeed(seed)).toBe('2026-10-04');
    const scheduleSpec = read('tests/e2e/schedule-request-off-management.spec.cjs');
    expect(scheduleSpec).toContain('openSchedule(page, seed, scheduleRequestOffConflictAnchorFromSeed(seed))');
  });

  test('17.0.77 Spanish source assertion follows its actual escaped source contract', async () => {
    const driftSpec = read('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
    const exactNestedAssertion = "assert.match(spec, /saveLanguagePreference\\(page,\\s*['\\\"]es['\\\"]\\)/);";
    expect(read('api/spanish-release-gate-fidelity-17-0-29.test.cjs')).toContain(exactNestedAssertion);
    expect(driftSpec).toContain(`expect(spanish).toContain(${JSON.stringify(exactNestedAssertion)});`);
    expect(driftSpec).not.toContain("expect(spanish).toMatch(/saveLanguagePreference\\([^)]*['\"]es['\"]/);");
  });
});

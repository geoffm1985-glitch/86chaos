'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  scheduleFixtureDateFromSeed,
  scheduleRequestOffConflictAnchorFromSeed,
} = require('../tests/e2e/utils/schedule-request-off-fixture-anchor.cjs');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const historicalBoundarySeed = {
  seedAnchorDate: '2026-10-04T15:08:50.000-05:00',
  ghostRequestOffConflictDate: '2026-10-05',
  profile: {
    expectations: {
      fixture: {
        anchor: '2026-10-04',
        currentWeekStart: '2026-09-28',
        shifts: [
          { employeeName: 'Chuck QA', role: 'Bartender', startTime: '10a', date: '2026-09-29' },
          { employeeName: 'Allen QA', role: 'Cook', startTime: '4p', endTime: '9p', date: '2026-10-03' },
        ],
      },
    },
  },
};

test('17.0.82 Request Off regression anchors the conflict test in October without moving coverage math out of September', () => {
  assert.equal(scheduleFixtureDateFromSeed(historicalBoundarySeed), '2026-09-28');
  assert.equal(scheduleRequestOffConflictAnchorFromSeed(historicalBoundarySeed), '2026-10-04');
  const spec = read('tests/e2e/schedule-request-off-management.spec.cjs');
  assert.match(spec, /openSchedule\(page, seed, scheduleRequestOffConflictAnchorFromSeed\(seed\)\)/);
  assert.match(spec, /openSchedule\(page, seed\);[\s\S]{0,900}Coverage target hydration should expose the seeded under-target warning/);
});

test('17.0.82 server-certification regression matches the escaped Spanish assertion source instead of pretending it is executable syntax', () => {
  const releaseSpec = read('tests/86chaos-release-gate/89-server-certification-drift-17-0-77.spec.cjs');
  const spanishSource = read('api/spanish-release-gate-fidelity-17-0-29.test.cjs');
  const exactNestedAssertion = "assert.match(spec, /saveLanguagePreference\\(page,\\s*['\\\"]es['\\\"]\\)/);";
  assert.ok(spanishSource.includes(exactNestedAssertion));
  assert.ok(releaseSpec.includes(`expect(spanish).toContain(${JSON.stringify(exactNestedAssertion)});`));
  assert.doesNotMatch(releaseSpec, /expect\(spanish\)\.toMatch\(\/saveLanguagePreference\\\(\[\^\)\]\*\['\"]es\['\"]\//);
});

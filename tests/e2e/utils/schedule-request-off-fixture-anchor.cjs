'use strict';

function fixtureFromSeed(seed = {}) {
  return seed?.profile?.expectations?.fixture || seed?.profile?.fixture || {};
}

function scheduleFixtureDateFromSeed(seed = {}) {
  const fixture = fixtureFromSeed(seed);
  const overCoverageDate = (fixture.shifts || []).find(row => row?.employeeName === 'Chuck QA' && row?.role === 'Bartender' && String(row?.startTime || '').toLowerCase() === '10a')?.date;
  // Coverage fixtures are built inside the fixture's Monday-based current week.
  // Keep that week anchor for coverage math so the seeded over-target Tuesday stays visible.
  return fixture.currentWeekStart || overCoverageDate || fixture.anchor || seed?.ghostRequestOffConflictDate || '2026-08-04';
}

function scheduleRequestOffConflictAnchorFromSeed(seed = {}) {
  const fixture = fixtureFromSeed(seed);
  // Request Off conflict assertions need the month containing the seeded request/shift pair.
  // On the 2026-10-04 seed, currentWeekStart is 2026-09-28 while Allen's conflict is 2026-10-03;
  // freezing to the week start correctly opens September and therefore cannot show that October conflict.
  return fixture.anchor || String(seed?.seedAnchorDate || '').slice(0, 10) || seed?.ghostRequestOffConflictDate || scheduleFixtureDateFromSeed(seed);
}

module.exports = {
  scheduleFixtureDateFromSeed,
  scheduleRequestOffConflictAnchorFromSeed,
};

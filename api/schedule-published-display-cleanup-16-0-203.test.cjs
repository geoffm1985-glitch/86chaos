const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('16.0.203 published Schedule views clean duplicate/placeholder shift display without changing builder data', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const cleanPublishedScheduleDisplayShifts = \(shiftList = \[\], roster = \[\]\) => \{/, 'published schedule display cleaner exists');
  assert.match(schedule, /const activeMonthShifts = cleanPublishedScheduleDisplayShifts\(shifts \|\| \[\], users\)/, 'Full Schedule uses cleaned published display list');
  assert.match(schedule, /const shiftsForDay = cleanPublishedScheduleDisplayShifts\(shifts \|\| \[\], users\)/, 'Month View uses cleaned published display list');
  assert.match(schedule, /if \(isExplicitScheduleDraft\(shift\)\) return false;/, 'explicit drafts cannot leak into published schedule views');
  assert.match(schedule, /shiftHasAssignedPersonEvidence\(shift, roster\)/, 'assigned staff evidence is preserved instead of hiding real shifts');
  assert.match(schedule, /hasExplicitOpenShiftIntent\(shift\)/, 'explicit open shifts remain supported');
});

test('16.0.203 Schedule display names prefer real staff names over generated login handles', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const looksLikeGeneratedLoginName = \(value = ''\) => \{/, 'generated login-name detector exists');
  assert.match(schedule, /const pickScheduleDisplayName = \(\.\.\.values\) => \{/, 'display name picker exists');
  assert.match(schedule, /person\?\.employeeName,\s*\n\s*person\?\.displayName,\s*\n\s*person\?\.fullName,\s*\n\s*person\?\.assignedName,\s*\n\s*person\?\.name/s, 'roster display order prefers human fields before account name');
  assert.match(schedule, /return pickScheduleDisplayName\(getScheduleShiftFallbackName\(shift\), getSchedulePersonName\(person\), fallback\) \|\| fallback;/, 'shift labels keep saved shift name before falling back to account name');
});

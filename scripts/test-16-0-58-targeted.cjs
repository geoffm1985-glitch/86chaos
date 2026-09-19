#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const schedulePath = path.join(root, 'src', 'features', 'schedule.jsx');
const schedule = fs.readFileSync(schedulePath, 'utf8');

function includes(fragment, message) {
  assert.ok(schedule.includes(fragment), message);
}

includes('const id = String(shift?.id || \'\').trim();', 'Delete marker matching should first inspect the Firestore document id.');
includes('if (id) return markerKeySet.has(`id:${id}`);', 'Shifts with a real document id should only be hidden by a matching deleted document id.');
includes('return getScheduleShiftLocalDeleteKeys(shift).some(key => markerKeySet.has(key));', 'Fallback/fingerprint delete matching should remain for legacy no-id preview records only.');

const helperMatch = schedule.match(/const shiftMatchesLocalDeleteMarkers = \(shift = \{\}, markerKeySet = new Set\(\)\) => \{[\s\S]*?\n\};/);
assert.ok(helperMatch, 'Could not locate shiftMatchesLocalDeleteMarkers helper.');
const helper = helperMatch[0];
const idCheckIndex = helper.indexOf('if (id) return markerKeySet.has(`id:${id}`);');
const fallbackIndex = helper.indexOf('return getScheduleShiftLocalDeleteKeys(shift).some');
assert.ok(idCheckIndex > -1 && fallbackIndex > idCheckIndex, 'ID-only matching must run before fallback/fingerprint matching.');

// Simulate the bug: deleting Julia 10a-4p creates a fingerprint marker. Re-adding the same shift gets a new Firestore id.
// The new id must not be hidden merely because employee/date/time match the deleted shift.
const deletedMarkers = new Set(['id:old-shift-1', 'fp:2026-08-01|julia|kitchen|10:00|16:00', 'fallback:cheers|2026-08-01|julia|10:00|16:00']);
function fixedMatcherForIdShift(shift, markers) {
  const id = String(shift?.id || '').trim();
  if (id) return markers.has(`id:${id}`);
  return false;
}
assert.strictEqual(fixedMatcherForIdShift({ id: 'old-shift-1' }, deletedMarkers), true, 'The exact deleted Firestore doc should stay hidden while the listener catches up.');
assert.strictEqual(fixedMatcherForIdShift({ id: 'new-shift-2' }, deletedMarkers), false, 'A re-added shift with a new Firestore id must appear even if employee/date/time match the deleted shift.');

// The assign path still needs to create an immediate local echo after Firestore returns the saved id.
includes('savedShiftEchoes.push({ ...shiftData, id: savedRef.id, localEcho: true });', 'Re-added shifts should still get a local echo with the new Firestore id.');
includes('setLocalBuilderShiftEchoes(prev => mergeVisibleScheduleShifts(prev, savedShiftEchoes));', 'Re-added shifts should become visible immediately after save.');

console.log('16.0.58 targeted schedule delete-and-reassign visibility test passed.');

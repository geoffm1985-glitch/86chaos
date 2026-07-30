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

includes('const [localBuilderDeletedShiftMarkers, setLocalBuilderDeletedShiftMarkers] = useState([]);', 'Schedule Builder should track recently deleted shift markers locally.');
includes('const activeLocalDeleteKeySet = new Set(activeLocalDeleteMarkers.map(marker => marker.key).filter(Boolean));', 'Schedule Builder should build an active local delete key set.');
includes('const visibleShifts = visibleSourceShifts.filter(shift => !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet));', 'Visible Schedule Builder shifts should filter out locally deleted shifts while Firestore catches up.');
includes('const deletedMarkers = buildLocalShiftDeletionMarkers(existingShifts);', 'Delete handler should create markers for every deleted visible shift.');
includes('setLocalBuilderDeletedShiftMarkers(prev => mergeLocalShiftDeletionMarkers(prev, deletedMarkers));', 'Delete handler should save local delete markers after Firestore delete succeeds.');
includes('setLocalBuilderShiftEchoes(prev => prev.filter(shift => !shiftMatchesLocalDeleteMarkers(shift, deletedKeySet)));', 'Delete handler should remove matching optimistic shift echoes immediately.');
includes('setAutoFillVisibleShifts(prev => prev.filter(shift => !shiftMatchesLocalDeleteMarkers(shift, deletedKeySet)));', 'Delete handler should remove matching auto-fill preview shifts immediately.');
includes('SHIFT_LOCAL_DELETE_MARKER_TTL_MS = 120000', 'Delete markers should be temporary, not permanent hidden-state.');
includes('stillVisibleInLiveSnapshot || stillInsideGraceWindow', 'Delete markers should survive listener lag but expire once snapshots settle.');

const deleteBlockMatch = schedule.match(/const handleCellClick = async \(d, empId\) => \{[\s\S]*?const handleAssign = async \(\) => \{/);
assert.ok(deleteBlockMatch, 'Could not locate Schedule Builder delete handler block.');
const deleteBlock = deleteBlockMatch[0];
assert.ok(deleteBlock.indexOf('await Promise.all(deleteTargets.map') < deleteBlock.indexOf('setLocalBuilderDeletedShiftMarkers'), 'Local removal should happen only after Firestore delete succeeds.');
assert.ok(deleteBlock.indexOf('setLocalBuilderDeletedShiftMarkers') < deleteBlock.indexOf("addToast('Shift Deleted'"), 'The UI should hide deleted shifts before showing the success toast.');

console.log('16.0.56 targeted schedule-delete test passed.');

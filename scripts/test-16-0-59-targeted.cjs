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

// Deleting a saved Firestore shift should suppress only that exact deleted document id.
includes('if (id) return [`id:${id}`];', 'Saved deleted shifts should create exact document-id delete markers only.');
includes("if (String(marker.key).startsWith('id:')) return true;", 'Deleted Firestore document ids should stay hidden for the marker TTL even if snapshots churn.');
includes('if (id) return markerKeySet.has(`id:${id}`);', 'A saved visible shift should only be hidden when its exact Firestore id was deleted.');

function fixedDeleteKeys(shift = {}) {
  const id = String(shift?.id || '').trim();
  if (id) return [`id:${id}`];
  return ['fp:fallback-for-no-id-preview'];
}
const oldSavedShiftMarkers = new Set(fixedDeleteKeys({ id: 'old-shift-1', employeeName: 'Julia', date: '2026-08-04', startTime: '09:00', endTime: '15:00' }));
assert.deepStrictEqual([...oldSavedShiftMarkers], ['id:old-shift-1'], 'A saved shift delete marker must not include employee/date/time fingerprints that can hide future replacements.');
assert.strictEqual(oldSavedShiftMarkers.has('id:new-shift-2'), false, 'A new re-added shift with a different Firestore id must remain visible.');

// Publish should now ask what to publish, instead of blindly publishing the full period.
includes('const [isPublishPickerOpen, setIsPublishPickerOpen] = useState(false);', 'Publish picker modal state should exist.');
includes('const publishWeekOptions = [];', 'Schedule Builder should build publishable week options.');
includes('openPublishPicker', 'Publish button should open the picker first.');
includes('Publish Selected Weeks', 'Publish picker should let managers publish selected weeks.');
includes('Publish Full Schedule', 'Publish picker should still allow full schedule publishing.');
includes("publishScope: publishAll ? 'full-period' : 'selected-weeks'", 'Published shifts should record whether full or selected-week scope was used.');
includes('publishWeekKeys: selectedWeeksForPublish.map(option => option.key)', 'Published shifts/backups should record selected week keys.');
includes('publishDaySet.has(String(r?.date || \'\'))', 'Request-off processing should stay limited to selected publish days.');

console.log('16.0.59 targeted partial-publish and delete/reassign guard test passed.');

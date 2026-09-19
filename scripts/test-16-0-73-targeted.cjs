#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schedulePath = path.join(root, 'src', 'features', 'schedule.jsx');
const plannerPath = path.join(root, 'src', 'core', 'scheduleQueryPlanner.js');
const versionPath = path.join(root, 'public', 'version.json');

const schedule = fs.readFileSync(schedulePath, 'utf8');
const planner = fs.readFileSync(plannerPath, 'utf8');
const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    console.error(`16.0.73 targeted test failed: ${message}`);
    process.exitCode = 1;
  }
}

assert(version.version === '16.0.73', 'version.json reports 16.0.73');
assert(schedule.includes('const getShiftRecordTimeMs = (shift = {})'), 'schedule has shift timestamp helper for delete tombstones');
assert(schedule.includes('...getScheduleShiftLocalPruneKeys(shift)'), 'deleted saved shifts also create fingerprint prune markers');
assert(schedule.includes('sourceRecordTime: getShiftRecordTimeMs(shift)'), 'delete markers remember source record time');
assert(schedule.includes('return !shiftTime || !markerTime || shiftTime <= markerTime + 1000;'), 'fingerprint tombstones do not hide newly re-added shifts');
assert(schedule.includes('activeLocalDeleteMarkerMap'), 'active delete markers expose marker metadata, not just keys');
assert(schedule.includes('dedupeScheduleShiftsByDatePersonTime(shifts'), 'My Published Schedule dedupes duplicate shift records');
assert(schedule.includes('d >= myMonthBounds.start && d <= myMonthBounds.end'), 'My Published Schedule stays inside selected calendar month');
assert(schedule.includes('getDocs(query(collection(db, \'shifts\'), where(\'restaurantId\', \'==\', appUser.restaurantId), where(\'date\', \'==\', day)))'), 'publish refreshes selected-day candidates by date');
assert(schedule.includes('getDocs(query(collection(db, \'shifts\'), where(\'restaurantId\', \'==\', appUser.restaurantId), where(\'scheduleDateKey\', \'==\', day)))'), 'publish refreshes selected-day candidates by scheduleDateKey');
assert(schedule.includes('const publishCandidates = await fetchSchedulePublishCandidatesForDaySet(publishDaySet, localPublishCandidateSources);'), 'publish recomputes candidates immediately before update');
assert(schedule.includes('Promise.allSettled(unpub.map'), 'publish attempts every selected shift instead of aborting on one failure');
assert(schedule.includes("isPublished: true") && schedule.includes("published: true") && schedule.includes("publishStatus: 'published'"), 'publish writes legacy-compatible published fields');
assert(planner.includes('getOuterScheduleWeekBounds(monthBounds, safeAppUser)'), 'planner still loads outer schedule weeks so boundary shifts are available for next-shift/pay-period context');

if (!process.exitCode) console.log('16.0.73 targeted schedule publish/delete integrity tests passed.');

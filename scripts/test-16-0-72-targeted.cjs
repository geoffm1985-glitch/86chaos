const fs = require('fs');
const assert = require('assert');
const schedule = fs.readFileSync('src/features/schedule.jsx', 'utf8');
const planner = fs.readFileSync('src/core/scheduleQueryPlanner.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = JSON.parse(fs.readFileSync('public/version.json', 'utf8'));
const apiVersion = fs.readFileSync('api/_version.js', 'utf8');
const appCore = fs.readFileSync('src/core/appCore.js', 'utf8');

assert.strictEqual(pkg.version, '16.0.72', 'package version is 16.0.72');
assert.strictEqual(version.version, '16.0.72', 'public version is 16.0.72');
assert(apiVersion.includes("APP_VERSION = '16.0.72'"), 'API version is 16.0.72');
assert(appCore.includes("CURRENT_VERSION = '16.0.72'"), 'app core version is 16.0.72');

assert(schedule.includes('const mySchedulePeriodBounds = getScheduleOuterWeekBounds'), 'My Schedule must calculate the full outer schedule period');
assert(schedule.includes('d >= mySchedulePeriodBounds.start && d <= mySchedulePeriodBounds.end'), 'My Schedule must include previous/next month pay-period shifts');
assert(!schedule.includes('getShiftDateKey(s).startsWith(monthStr) && isScheduleShiftPublished(s) && isShiftStillCurrentOrUpcoming'), 'My Schedule must not filter employee shift list only by visible month');
assert(schedule.includes('My Published Schedule'), 'My Schedule list heading should no longer imply visible month only');
assert(schedule.includes('No published shifts found for this schedule period.'), 'empty state must explain schedule-period scope');

assert(schedule.includes('mergeSchedulePublishCandidates('), 'publishing must merge all visible and loaded candidate shifts');
assert(schedule.includes('autoFillVisibleShifts.filter(shift => shift?.restaurantId === appUser?.restaurantId)'), 'publishing must include saved auto-fill visible shifts');
assert(schedule.includes('const publishCandidates = mergeSchedulePublishCandidates(publicationPeriodShifts, visibleSourceShifts, autoFillVisibleShifts, localBuilderShiftEchoes)'), 'handlePublish must recompute candidates at click time');
assert(schedule.includes('getShiftWritableDocId(shift)'), 'publish candidate logic must support doc IDs beyond just shift.id');
assert(schedule.includes('Promise.allSettled(unpub.map'), 'publish must try every selected shift instead of aborting on first failure');
assert(schedule.includes('published: true') && schedule.includes("status: 'published'") && schedule.includes("publishStatus: 'published'"), 'publish must write legacy-compatible published markers');
assert(schedule.includes('scheduleDateKey: dateKey'), 'publish must preserve/write scheduleDateKey for employee-facing lookup');
assert(schedule.includes('setLocalBuilderPublishedShiftIds'), 'published shifts should show immediately while listener catches up');
assert(schedule.includes('Partially Published'), 'partial publish failures should be reported clearly');
assert(planner.includes('getOuterScheduleWeekBounds(monthBounds, safeAppUser)'), 'query planner should load outer week bounds for My Schedule');

console.log('16.0.72 targeted schedule publish/My Schedule test passed.');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.67 targeted test failed: ${message}`);
    process.exitCode = 1;
  }
};
const schedule = read('src/features/schedule.jsx');
const planner = read('src/core/scheduleQueryPlanner.js');
const help = read('src/features/management.jsx');
const manual = read('src/features/trainingManual.js');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));

assert(pkg.version === '16.0.67', 'package.json version is 16.0.67');
assert(version.version === '16.0.67' && version.build === '16.0.67', 'public version is 16.0.67');

assert(schedule.includes('const getShiftDateKey = (shift = {})'), 'shared shift date key helper exists');
assert(schedule.includes('const getScheduleOuterWeekBounds'), 'schedule builder can derive full outer week bounds');
assert(schedule.includes('const publicationWeekBounds = getScheduleOuterWeekBounds(schedulePeriodBounds, schedulePublishingSettings);'), 'publish picker uses full outer week bounds');
assert(schedule.includes('const publicationWeekDays = buildDateRange(publicationWeekBounds.start, publicationWeekBounds.end);'), 'publish picker builds full publication week days');
assert(schedule.includes('const publicationPeriodShifts = publicationSourceShifts.filter'), 'publish logic uses publication-period source shifts');
assert(schedule.includes('selectedPublishDrafts = publicationPeriodShifts.filter'), 'selected publish drafts come from publication-period shifts');
assert(schedule.includes('fullPublishDrafts = publicationPeriodShifts.filter'), 'full publish drafts come from publication-period shifts');
assert(schedule.includes('unpublishedShiftIds: unpub.map(s => s.id).filter(Boolean)'), 'publish backup records exact shift IDs that were published');
assert(schedule.includes('const scheduledHoursTrackerSourceShifts = mergeVisibleScheduleShifts(shifts, localBuilderShiftEchoes)'), 'scheduled hours tracker uses loaded pay-period shifts, not only visible month shifts');
assert(schedule.includes('getShiftDateKey(s).startsWith(monthStr)'), 'employee-facing month filters use date or scheduleDateKey');

assert(planner.includes('getOuterScheduleWeekBounds'), 'schedule query planner has outer week bounds helper');
assert(planner.includes('const myScheduleBounds = getOuterScheduleWeekBounds(monthBounds, safeAppUser);'), 'My Schedule query loads full outer pay-period weeks');
assert(planner.includes("['date','>=', myScheduleBounds.start]") && planner.includes("['date','<=', myScheduleBounds.end]"), 'My Schedule shift query uses outer pay-period week bounds');

assert(manual.includes('Publish Selected Weeks makes only the selected week dates visible to staff'), 'training manual documents partial week publishing');
assert(manual.includes('Week 1 can count late-July shifts'), 'training manual documents previous-month Week 1 hours');
assert(manual.includes('Menu item costing'), 'training manual documents menu item costing');
assert(manual.includes('geoffm1985@gmail.com cannot be demoted'), 'system administrator manual documents protected root account');
assert(help.includes("id:'schedule-partial-publish-my-schedule'"), 'Help Center article covers partial schedule publish and My Schedule');
assert(help.includes("id:'scheduled-hours-pay-period-week-one'"), 'Help Center article covers Week 1 pay-period hours');
assert(help.includes("id:'menu-item-costing-ai-matching'"), 'Help Center article covers menu item costing');
assert(help.includes("id:'protected-root-admin-account'"), 'System Administrator Help article covers protected root account');

if (!process.exitCode) console.log('16.0.67 targeted schedule publish/My Schedule/help-manual test passed.');

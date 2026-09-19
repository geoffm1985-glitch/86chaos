const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('manager Request Off workflow loads all active requested days instead of only the visible date window', () => {
  const planner = read('src/core/scheduleQueryPlanner.js');
  assert.match(planner, /activeScheduleSubTab === 'time-off'/);
  assert.match(planner, /timeOffClauses: canManageSchedule\s*\? \[\['status','in',activeStatuses\]\]/);
  assert.match(planner, /timeOffLimit: canManageSchedule \? 500 : 120/);
  assert.match(planner, /show every active requested day off/);
  assert.doesNotMatch(planner, /timeOffClauses: canManageSchedule\s*\? \[\['date','>=', recentWindowStart\], \['date','<=', scheduleWindowEnd\]\]/);
});

test('Request Off workflow defaults to All Dates so pending requests outside this month are visible', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /const \[dateFilter, setDateFilter\] = useState\('all'\)/);
  assert.match(schedule, /\['all','All Dates'\]/);
  assert.match(schedule, /Default view only shows items that need attention/);
});

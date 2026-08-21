const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('manager Request Off query plan uses active-status listener and client-side filtering', () => {
  const planner = fs.readFileSync(path.join(root, 'src/core/scheduleQueryPlanner.js'), 'utf8');
  assert.match(planner, /activeScheduleSubTab === 'time-off'/);
  assert.match(planner, /timeOffClauses: canManageSchedule\s*\? \[\['status','in',activeStatuses\]\]/);
  assert.ok(planner.includes('TabTimeOff applies') && planner.includes('date/status/employee filters client-side after this active-status listener loads.'));
  assert.ok(!planner.includes("timeOffClauses: canManageSchedule\n        ? [['date','>=', recentWindowStart], ['date','<=', scheduleWindowEnd]]"));
});

test('Request Off workflow starts on All Dates so active requests are not hidden by month', () => {
  const schedule = fs.readFileSync(path.join(root, 'src/features/schedule.jsx'), 'utf8');
  assert.match(schedule, /const \[dateFilter, setDateFilter\] = useState\('all'\)/);
  assert.match(schedule, /\['all','All Dates'\]/);
});

test('real 86 Chaos header logo assets referenced by the app are present', () => {
  const common = fs.readFileSync(path.join(root, 'src/components/common.jsx'), 'utf8');
  assert.match(common, /src="\/86chaos-icon-48-v2\.png"/);
  assert.match(common, /src="\/6139\.png"/);
  assert.doesNotMatch(common, /wisco\.png/);
  for (const file of ['public/86chaos-icon-48-v2.png', 'public/6139.png']) {
    const stat = fs.statSync(path.join(root, file));
    assert.ok(stat.size > 1000, `${file} should be a real non-empty asset`);
  }
});

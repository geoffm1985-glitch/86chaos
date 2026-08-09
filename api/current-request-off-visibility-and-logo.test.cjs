const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

test('manager Request Off query plan uses date-window listener and client-side status filtering', () => {
  const planner = fs.readFileSync(path.join(root, 'src/core/scheduleQueryPlanner.js'), 'utf8');
  assert.match(planner, /activeScheduleSubTab === 'time-off'/);
  assert.match(planner, /timeOffClauses: canManageSchedule\s*\? \[\['date','>=', recentWindowStart\], \['date','<=', scheduleWindowEnd\]\]/);
  assert.match(planner, /TabTimeOff already applies the status\/date\/employee filters client-side/);
  assert.doesNotMatch(planner, /\? \[\['status','in',activeStatuses\], \['date','>=', recentWindowStart\]\]/);
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

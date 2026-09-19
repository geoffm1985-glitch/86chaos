const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Month View notifies App when its subtab is selected so the correct month shift query loads', () => {
  const master = read('src/components/TabMasterSchedule.js');
  assert.match(master, /onSubTabChange = null/);
  assert.match(master, /const changeSubTab = \(nextSubTab\) => \{/);
  assert.match(master, /if \(typeof onSubTabChange === 'function'\) onSubTabChange\(normalized\)/);
  assert.match(master, /onClick=\{\(\) => changeSubTab\(tab\)\}/);
});

test('Month View print uses a generated print document from the visible month shifts', () => {
  const month = read('src/components/TabMonth.js');
  assert.match(month, /const visibleMonthShifts = useMemo/);
  assert.match(month, /dateKey\.startsWith\(monthStr\)/);
  assert.match(month, /shift\?\.isPublished === true/);
  assert.match(month, /const shiftsByDate = useMemo/);
  assert.match(month, /const buildPrintableCalendarHtml = \(\) => \{/);
  assert.match(month, /printWindow\.document\.write\(buildPrintableCalendarHtml\(\)\)/);
  assert.match(month, /getShiftDisplayName\(shift, userLookup\)/, 'printed shifts must resolve names from durable roster identity aliases');
});

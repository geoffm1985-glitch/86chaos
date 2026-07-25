const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const schedule = read('src/features/schedule.jsx');
const app = read('src/App.js');
const appCore = read('src/core/appCore.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

assert(pkg.version === '15.0.99', 'package.json version is 15.0.99');
assert(version.version === '15.0.99' && version.build === '15.0.99', 'public/version.json is 15.0.99');
assert(appCore.includes("CURRENT_VERSION = '15.0.99'"), 'CURRENT_VERSION is 15.0.99');
assert(app.includes("limitCount: wantsScheduleScreen ? 1000 : 180"), 'timeOffRequests schedule load cap increased from 70 to 1000');
assert(schedule.includes('recordMatchesPerson') && schedule.includes('shiftMatchesPerson') && schedule.includes('timeOffMatchesPerson'), 'shared schedule identity matching helpers exist');
assert(schedule.includes('shiftMatchesPerson(s, appUser) && String(s.date || \'\').startsWith(monthStr)'), 'My Month Shifts uses durable shift/person matching');
assert(schedule.includes('shiftMatchesPerson(s, appUser) && s.isPublished && isShiftStillCurrentOrUpcoming'), 'Next Shift uses durable shift/person matching');
assert(schedule.includes('timeOffMatchesPerson(r, u) && isActiveTimeOffRequest(r)'), 'Schedule Builder shows active pending/approved request-off records');
assert(schedule.includes('visibleRequests = (timeOffRequests || []).filter(r => canManage || timeOffMatchesPerson(r, appUser))'), 'Request Off calendar uses durable request/person matching');

if (process.exitCode) process.exit(1);
console.log('15.0.99 request-off/schedule visibility validator passed.');

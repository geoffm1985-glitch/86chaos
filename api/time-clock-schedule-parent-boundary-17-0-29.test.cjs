'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/features/schedule.jsx', 'utf8');

function masterScheduleBody(text) {
  const start = text.indexOf('const TabMasterSchedule =');
  const end = text.indexOf('\nconst TabSchedule =', start);
  assert(start >= 0, 'TabMasterSchedule must exist');
  assert(end > start, 'TabMasterSchedule boundary must be detectable');
  return text.slice(start, end);
}

test('17.0.29 parent Time Clock and Schedule route matches known-good 16.0.227 lazy safety boundary', () => {
  const body = masterScheduleBody(source);
  const hookStart = body.indexOf("const [rosterFilterDate, setRosterFilterDate] = useState('');");
  assert(hookStart > 0, 'known-good first parent hook must remain present');
  const beforeFirstHook = body.slice(0, hookStart);

  for (const forbidden of [
    'safeScheduleObjectRows(',
    'safeScheduleRosterRows(',
    'safeScheduleShiftRows(',
    'safeScheduleAvailabilityRows(',
    'safeScheduleEventRows(',
    'mergeRequestOffWorkflowRows('
  ]) {
    assert(!beforeFirstHook.includes(forbidden), `${forbidden} must not execute eagerly at the parent route boundary`);
  }

  assert(body.includes("const availabilityRecords = Array.isArray(availabilityRecordsState.data) ? availabilityRecordsState.data : [];"), 'parent availability read must remain non-throwing and unsanitized until the active subtab needs it');
  assert(body.includes("subTab === 'schedule-builder'"), 'Schedule Builder remains a lazy subtab');
  assert(body.includes('availabilityRecords={safeScheduleAvailabilityRows(availabilityRecords)}'), 'Schedule Builder keeps localized availability sanitization');
  assert(body.includes("subTab === 'time-off'"), 'Request Off remains a lazy subtab');
  assert(body.includes('timeOffRequests={mergeRequestOffWorkflowRows(timeOffRequests)}'), 'Request Off keeps localized request normalization');
});

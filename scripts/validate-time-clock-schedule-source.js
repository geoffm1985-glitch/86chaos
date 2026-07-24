#!/usr/bin/env node
// Source-level guard for 86 Chaos Time Clock & Schedule fixes that are hard to prove from live UI without seed data.
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel}. Run this from the repo root after copying the test pack into the app.`);
  return fs.readFileSync(p, 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function has(text, re, message) {
  assert(re.test(text), message);
}

const app = read('src/App.js');
const schedule = read('src/features/schedule.jsx');
const pkg = JSON.parse(read('package.json'));

assert(/^16\./.test(pkg.version), `Expected major version 16.x for record keeping, found ${pkg.version}`);
has(app, /timeOffRequests[\s\S]{0,220}limitCount:\s*wantsScheduleScreen\s*\?\s*1000\s*:\s*180/, 'Schedule screens must load up to 1000 request-off records, not the old tiny limit.');
has(schedule, /const shiftMatchesPerson = \(shift = \{\}, person = \{\}\) => \{[\s\S]*?Do NOT use createdBy\/author fields here[\s\S]*?employeeEmail[\s\S]*?assignedEmail[\s\S]*?rosterUserId[\s\S]*?assignedUserId[\s\S]*?first-name matching only/s, 'My Schedule shift matching must support roster IDs, auth IDs, employee IDs, emails, names, and legacy first-name fallback.');
has(schedule, /const isActiveTimeOffRequest = \(request = \{\}\) => \{[\s\S]*?denied[\s\S]*?rejected[\s\S]*?cancelled/s, 'Active request-off logic must exclude denied/cancelled/archived but include pending and approved.');
has(schedule, /requestedAt:\s*nowIso[\s\S]*requestedAtMs:\s*Date\.now\(\)[\s\S]*requestTimestamp:\s*nowIso[\s\S]*submittedAt:\s*nowIso/s, 'Request-off submissions must be timestamped.');
has(schedule, /Requested \{formatClockDateTime\(r\.requestedAt \|\| r\.submittedAt \|\| r\.createdAt \|\| r\.requestTimestamp\)/, 'Request-off cards must display the submitted timestamp.');
has(schedule, /priorRequestInfoForDate[\s\S]*isRequestOffConflictCountable[\s\S]*people\.size/s, 'Request Off must count prior requests on the same date by unique person.');
has(schedule, /window\.confirm[\s\S]*has already been requested off[\s\S]*peopleText[\s\S]*It might not be available/s, 'Request Off must warn when another person already requested the selected day.');
has(schedule, /priorCount > 0[\s\S]*\{priorCount\}\s*req/s, 'Request Off calendar must show the prior-request count badge.');
has(schedule, /timeOffMatchesPerson\(r, u\) && isActiveTimeOffRequest\(r\)/, 'Schedule Builder grid must match request-offs with the shared robust person matcher.');
has(schedule, /if \(!r\.isPartial\) return true;[\s\S]*shift\.startTime < \(r\.endTime \|\| '23:59'\)[\s\S]*shift\.endTime > \(r\.startTime \|\| '00:00'\)/, 'Schedule Builder must detect full-day and partial-day request-off conflicts.');
has(schedule, /Partial Day Only\?/, 'Request Off must support partial-day requests.');
has(schedule, /Cannot request past dates/, 'Request Off must block past dates.');
has(schedule, /time-off requests close once that schedule period has been published|blocks employee time-off requests after that date has already been published/i, 'Request Off must respect published-schedule lockout settings.');

const hardLimitPatterns = [
  /max(?:imum)?\s*(?:days|requests|time.?off)/i,
  /requestOffLimit/i,
  /timeOffLimit/i,
  /ptoLimit/i,
];
const foundHardLimit = hardLimitPatterns.some((re) => re.test(schedule));
assert(!foundHardLimit, 'This version appears to contain a hard request-off limit. If that was intentional, update this validator and the app setting docs.');

console.log('PASS: Time Clock & Schedule source guards passed for request-off, My Schedule, Schedule Builder, partial days, timestamps, and current no-hard-limit behavior.');

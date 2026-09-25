'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./_time-off-policy.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('17.0.23 monthly cutoff is calculated from planned release day without auto-publishing', () => {
  const p = policy.normalizePolicy({ enabled:true, cutoffDaysBeforeRelease:10, monthlyReleaseDay:25 });
  const schedule = { schedulePublishMode:'monthly' };
  assert.equal(policy.releaseDateForRequestDate('2026-11-12', p, schedule), '2026-10-25');
  assert.equal(policy.cutoffDateForRequestDate('2026-11-12', p, schedule), '2026-10-15');
  assert.equal(policy.evaluatePolicyDate({ requestDate:'2026-11-12', today:'2026-10-15', policy:p, scheduleSettings:schedule }).allowed, true);
  const closed = policy.evaluatePolicyDate({ requestDate:'2026-11-12', today:'2026-10-16', policy:p, scheduleSettings:schedule });
  assert.equal(closed.allowed, false);
  assert.equal(closed.code, 'cutoff-closed');
});

test('17.0.23 blackout ranges block normal requests but account owner/admin override remains explicit', () => {
  const p = policy.normalizePolicy({ enabled:true, cutoffDaysBeforeRelease:0, monthlyReleaseDay:28, blackouts:[{ id:'nye', startDate:'2026-12-31', endDate:'2027-01-01', reason:'Holiday staffing' }] });
  const blocked = policy.evaluatePolicyDate({ requestDate:'2026-12-31', today:'2026-09-22', policy:p, scheduleSettings:{ schedulePublishMode:'monthly' } });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'blackout');
  assert.match(blocked.reason, /Holiday staffing/);
  const override = policy.evaluatePolicyDate({ requestDate:'2026-12-31', today:'2026-09-22', policy:p, scheduleSettings:{ schedulePublishMode:'monthly' }, canOverride:true });
  assert.equal(override.allowed, true);
  assert.equal(override.overridden, true);
});

test('17.0.23 policy controls are owner/admin only, never schedule/team/settings permission only', () => {
  const restaurant = { ownerEmail:'owner@example.com', ownerUserId:'owner-id' };
  assert.equal(policy.callerCanConfigurePolicy({ uid:'owner-id', email:'other@example.com', workspaceProfile:{} }, restaurant), true);
  assert.equal(policy.callerCanConfigurePolicy({ uid:'admin', email:'admin@example.com', workspaceProfile:{ isAdmin:true } }, restaurant), true);
  assert.equal(policy.callerCanConfigurePolicy({ uid:'manager', email:'manager@example.com', workspaceProfile:{ isManager:true, permissions:{ schedule:true, team:true, settings:true } } }, restaurant), false);
  assert.equal(policy.callerCanConfigurePolicy({ uid:'staff', email:'staff@example.com', workspaceProfile:{ permissions:{ settings:true } } }, restaurant), false);
});

test('17.0.23 policy is dormant until explicitly enabled and blackouts are bounded', () => {
  const p = policy.normalizePolicy({ blackouts:Array.from({length:120},(_,i)=>({ id:String(i), date:`2026-12-${String((i%28)+1).padStart(2,'0')}` })) });
  assert.equal(p.enabled, false);
  assert.equal(p.blackouts.length, 100);
  const result = policy.evaluatePolicyDate({ requestDate:'2026-12-10', today:'2026-12-01', policy:p, scheduleSettings:{ schedulePublishMode:'monthly' } });
  assert.equal(result.allowed, true);
  assert.equal(result.code, 'disabled');
});

test('17.0.23 Request Off UI and API use the strict policy authority contract', () => {
  const schedule = read('src/features/schedule.jsx');
  const route = read('api/time-off-request.js');
  const voice = read('src/components/common.jsx');
  assert.match(schedule, /canConfigureRequestOffPolicy = !requestOffGhostMode && canConfigureTimeOffPolicy\(appUser, clientData\)/);
  assert.match(schedule, /requestOffApi\('policy-save'/);
  assert.match(schedule, /requestOffApi\('policy-check'/);
  assert.match(route, /action === 'policy-save'/);
  assert.match(route, /Only the account owner or a workspace administrator can change the Request Off cutoff or blackout dates/);
  assert.match(voice, /action:'policy-check'/);
  assert.doesNotMatch(read('src/core/timeOffPolicy.js'), /permissions\?\.(?:schedule|team|settings)/);
});

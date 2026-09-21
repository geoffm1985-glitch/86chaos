'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./_schedule-publish-core.cjs');

const roles = [{ id:'r1', name:'Grill', revision:2, previousNames:['Line'] }, { id:'r2', name:'Bar', revision:1, previousNames:[] }];
const roleRevision = 'roles-v1|r1:2:0:grill:line|r2:1:0:bar:';
const people = {
  e1:{id:'e1',scheduleUserId:'e1',employeeId:'e1',rosterUserId:'e1',userId:'e1',authUid:'e1',assignedUserId:'e1',name:'Employee One',email:'one@example.invalid'},
  e2:{id:'e2',scheduleUserId:'e2',employeeId:'e2',rosterUserId:'e2',userId:'e2',authUid:'e2',assignedUserId:'e2',name:'Employee Two',email:'two@example.invalid'}
};
const draft = {id:'draft',restaurantId:'tenant',date:'2026-09-20',scheduleDateKey:'2026-09-20',employeeId:'e1',role:'Line',startTime:'09:00',endTime:'17:00',revision:3,updatedAt:'draft-v3',_employeeResolution:{ok:true,person:people.e1}};
const canonical2 = core.canonicalEmployeeIdentity(people.e2, {});
const published = {id:'published',restaurantId:'tenant',date:'2026-09-20',scheduleDateKey:'2026-09-20',employeeId:'e2',rosterRoleId:'r2',rosterRoleNameSnapshot:'Bar',role:'Bar',startTime:'10:00',endTime:'18:00',revision:1,updatedAt:'published-v1',isPublished:true,published:true,status:'published',publishStatus:'published',scheduleId:'schedule-existing',...canonical2,_employeeResolution:{ok:true,person:people.e2}};

function evidence(shift) {
  const role = core.resolveRole(shift, roles);
  const person = core.intentionalOpenShift(shift) ? null : shift._employeeResolution?.person;
  const expected = core.expectedFingerprint(shift, role, person);
  const { contentDigest, ...state } = expected;
  return { id:shift.id, contentDigest, state };
}
function plan(overrides={}) {
  return core.buildCanonicalServerPlan({
    restaurantId:'tenant', operationId:'operation_1714_authoritative', dayKeys:['2026-09-20'],
    allRoles:true, roles, shifts:[draft,published], expectedShifts:[evidence(draft),evidence(published)],
    roleConfigurationRevision:roleRevision, actor:{uid:'manager'}, ...overrides
  });
}

test('authoritative confirmed superset writes only the stale/draft candidate', () => {
  const result = plan();
  assert.deepEqual(result.candidates.map(row=>row.id), ['draft']);
  assert.deepEqual(result.unchangedShiftIds, ['published']);
  assert.equal(result.writeCount, 1);
  assert.deepEqual(result.affectedEmployeeIds, ['e1']);
});

test('missing evidence for a writable shift still fails closed', () => {
  assert.throws(() => plan({ expectedShifts:[evidence(published)] }), error =>
    error?.code === 'candidate_set_changed' && error?.details?.missingEvidenceIds?.includes('draft'));
});

test('extra no-write evidence does not abort the authoritative writable plan', () => {
  const ghost = { ...evidence(published), id:'ghost' };
  const result = plan({ expectedShifts:[evidence(draft), evidence(published), ghost] });
  assert.deepEqual(result.candidates.map(row=>row.id), ['draft']);
  assert.deepEqual(result.unchangedShiftIds, ['published']);
});

test('changed unchanged-shift evidence still fails before publication', () => {
  const stale = evidence(published);
  stale.state = { ...stale.state, startTime:'11:00' };
  stale.contentDigest = core.digest(stale.state);
  assert.throws(() => plan({ expectedShifts:[evidence(draft), stale] }), error => error?.code === 'confirmed_shift_changed');
});

test('explicit open shifts remain publishable without an employee identity', () => {
  const open = {id:'open',restaurantId:'tenant',date:'2026-09-20',scheduleDateKey:'2026-09-20',rosterRoleId:'r1',rosterRoleNameSnapshot:'Grill',role:'Grill',startTime:'12:00',endTime:'20:00',isOpenShift:true,_employeeResolution:{ok:false,reason:'missing'}};
  const result = core.buildCanonicalServerPlan({restaurantId:'tenant',operationId:'operation_1714_open_shift',dayKeys:['2026-09-20'],allRoles:true,roles,shifts:[open],expectedShifts:[evidence(open)],roleConfigurationRevision:roleRevision});
  assert.deepEqual(result.candidates.map(row=>row.id), ['open']);
  assert.equal(result.candidates[0].intentionalOpen, true);
  assert.deepEqual(result.affectedEmployeeIds, []);
});

test('browser source uses server reads and includes unchanged selected evidence', () => {
  const source = fs.readFileSync(path.join(__dirname,'../src/features/schedule.jsx'),'utf8');
  assert.match(source, /getDocsFromServer\(candidateQuery\)/);
  assert.match(source, /const confirmedEvidenceRows = \[\.\.\.updatePlan, \.\.\.alreadyValid\];/);
  assert.match(source, /isIntentionalOpenScheduleShift\(shift\)/);
  assert.match(source, /desiredEmployeeIdentity: item\.intentionalOpen \? null/);
});

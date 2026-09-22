'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('./_schedule-publish-core.cjs');
const service=require('./_schedule-publish-service.cjs');

const roles=[{id:'r1',name:'Grill',revision:1,previousNames:[]}];
const roleRevision='roles-v1|r1:1:0:grill:';
const clientPerson={id:'e1',scheduleUserId:'e1',employeeId:'e1',rosterUserId:'e1',userId:'e1',authUid:'e1',name:'Employee One',email:'one@example.invalid'};
const baseShift={id:'s1',restaurantId:'tenant',date:'2026-09-20',scheduleDateKey:'2026-09-20',employeeId:'e1',rosterRoleId:'r1',rosterRoleNameSnapshot:'Grill',role:'Grill',startTime:'09:00',endTime:'17:00',revision:1,updatedAt:'one'};
function evidence(shift,person=clientPerson){const expected=core.expectedFingerprint(shift,core.resolveRole(shift,roles),person),{contentDigest,...state}=expected;return{id:shift.id,contentDigest,state};}

test('remaining client-only confirmed row does not abort when authoritative server will not write it',()=>{
  const shift={...baseShift,_employeeResolution:{ok:false,reason:'unresolved-durable-employee-reference'}};
  const plan=core.buildCanonicalServerPlan({restaurantId:'tenant',operationId:'operation_1715_unresolved',dayKeys:['2026-09-20'],allRoles:true,roles,shifts:[shift],expectedShifts:[evidence(shift)],roleConfigurationRevision:roleRevision});
  assert.deepEqual(plan.candidates,[]);
  assert.deepEqual(plan.unresolvedEmployees,[{shiftId:'s1',reason:'unresolved-durable-employee-reference'}]);
});

test('missing client confirmation for an authoritative writable shift still fails closed',()=>{
  const shift={...baseShift,_employeeResolution:{ok:true,person:clientPerson}};
  assert.throws(()=>core.buildCanonicalServerPlan({restaurantId:'tenant',operationId:'operation_1715_missing',dayKeys:['2026-09-20'],allRoles:true,roles,shifts:[shift],expectedShifts:[],roleConfigurationRevision:roleRevision}),e=>e.code==='candidate_set_changed'&&e.details.missingEvidenceIds.includes('s1'));
});

test('server roster includes active tenant user identity even before workspaceMembers migration catches up',async()=>{
  const makeDoc=(id,data)=>({id,data:()=>data});
  const db={collection(name){return{where(){return this;},get:async()=>({docs:name==='users'?[makeDoc('e1',{restaurantId:'tenant',employeeId:'e1',scheduleUserId:'e1',name:'Employee One',email:'one@example.invalid',isActive:true})]:[]})};}};
  const people=await service.loadRosterPeople(db,'tenant');
  assert.equal(people.length,1);
  assert.equal(people[0]._source,'user-identity-fallback');
  const resolved=service.resolveEmployeeForShift(baseShift,people);
  assert.equal(resolved.ok,true);
  assert.equal(resolved.person.employeeId,'e1');
});

test('canonical workspace member still wins when it matches the user row',async()=>{
  const makeDoc=(id,data)=>({id,data:()=>data});
  const user={restaurantId:'tenant',employeeId:'e1',scheduleUserId:'e1',userId:'u1',name:'Employee One',email:'one@example.invalid',isActive:true};
  const member={restaurantId:'tenant',employeeId:'e1',scheduleUserId:'e1',userId:'u1',name:'Employee One',email:'one@example.invalid',isActive:true};
  const db={collection(name){return{where(){return this;},get:async()=>({docs:name==='users'?[makeDoc('u1',user)]:[makeDoc('m1',member)]})};}};
  const people=await service.loadRosterPeople(db,'tenant');
  assert.equal(people.length,1);
  assert.equal(people[0]._source,'canonical');
  assert.equal(people[0].workspaceMemberId,'m1');
});

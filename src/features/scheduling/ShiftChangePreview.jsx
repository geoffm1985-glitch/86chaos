import React from 'react';
import { workspaceAliases, workspaceSamePerson } from '../../core/scheduleWorkspace';
function State({shift,people,roles,empty}) {
  if(!shift)return <p>{empty}</p>;
  const primary=shift.employeeId || shift.scheduleUserId;
  const person=primary?people.find(person=>workspaceAliases(person).has(primary)):people.find(person=>workspaceSamePerson(shift,person));
  const role=roles.find(role=>role.id===shift.rosterRoleId)?.name || shift.rosterRoleNameSnapshot || shift.role || 'Role needs review';
  return <div><p><strong>{shift.isOpenShift?'Open / unassigned':person?.name || shift.employeeName || 'Employee identity needs review'}</strong></p><p>{shift.date || shift.scheduleDateKey} · {shift.startTime}–{shift.endTime}</p><p>{role}{shift.station || shift.location?` · ${shift.station || shift.location}`:''}</p><p>{Number(shift.breakMinutes || 0)} break minutes · {shift.paidBreak?'paid':'unpaid'}</p>{shift.notes && <p>Notes: {shift.notes}</p>}</div>;
}
export function ShiftChangePreview({changes,shifts,people,roles=[]}) {
  return <div className="sw-change-previews">{changes.map((change,index)=>{
    const before=change.kind==='create'?null:shifts.find(shift=>shift.id===change.id);
    const after=change.kind==='delete'?null:{...before,...change.patch,scheduleDateKey:change.patch?.date || before?.scheduleDateKey};
    return <article key={change.id || index} className="sw-change-preview"><h3>{change.kind==='create'?'Create shift':change.kind==='delete'?'Cancel / delete shift':'Change shift'}</h3><div className="sw-editor-times"><section aria-label="Before change"><h4>Before</h4><State shift={before} people={people} roles={roles} empty="New shift"/></section><section aria-label="After change"><h4>After</h4><State shift={after} people={people} roles={roles} empty="Shift removed; recovery history retained"/></section></div></article>;
  })}</div>;
}

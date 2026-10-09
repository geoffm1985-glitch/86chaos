'use strict';
function zonedAttendanceTime(date,time,timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '') || !timeZone) return null;
  const desired=Date.parse(`${date}T${time}:00Z`);if(!Number.isFinite(desired))return null;
  try {
    const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const wall=at=>{const fields=Object.fromEntries(formatter.formatToParts(new Date(at)).map(part=>[part.type,part.value]));return Date.parse(`${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:00Z`);};
    let candidate=desired;for(let i=0;i<3;i++)candidate+=desired-wall(candidate);
    if(wall(candidate)!==desired || wall(candidate-3600000)===desired || wall(candidate+3600000)===desired)return null;
    return candidate;
  }catch(_){return null;}
}
function attendanceFindings({workspaceId,shifts,punches,users,policy,now}) {
  const findings=[],reasons=[];
  punches=(punches || []).filter(row=>row.restaurantId===workspaceId);
  if(policy?.enabled!==true)return {findings,reasons:['Attendance checks need a reviewed workspace policy.'],policyConfigured:false};
  const grace=Number(policy.graceMinutes),breakLimit=Number(policy.maxOpenBreakMinutes);
  if(!Number.isFinite(grace) || grace<0 || grace>120 || !Number.isFinite(breakLimit) || breakLimit<1 || breakLimit>240 || !policy.timeZone)return {findings,reasons:['Review attendance policy timezone, grace and open-break limits.'],policyConfigured:false};
  const roster=(users || []).filter(person=>person.restaurantId===workspaceId);
  const identity=row=>{
    const ids=[row.employeeId,row.userId,row.authUid,row.scheduleUserId,row.rosterUserId,row.id].filter(Boolean);
    const matches=roster.filter(person=>[person.id,person.uid,person.authUid,person.userId,person.rosterUserId].some(id=>ids.includes(id)));
    return matches.length===1 ? matches[0].authUid || matches[0].uid || matches[0].userId || matches[0].id : null;
  };
  const iso=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?ms:null;};
  const add=(kind,employeeId,evidenceIds,reason)=>findings.push({id:`clock:${kind}:${evidenceIds.join(':')}`,kind,employeeId,evidenceIds,reason,reviewRequired:true});
  for(const shift of (shifts || []).filter(row=>row.restaurantId===workspaceId && row.isPublished===true && !row.cancelled && !row.isDeleted && !row.deletedAt)) {
    const employeeId=identity(shift);if(!employeeId){reasons.push('A published shift has an unresolved employee identity.');continue;}
    const date=String(shift.date || shift.scheduleDateKey || '').slice(0,10);
    const next=new Date(`${date}T12:00:00Z`);if(!Number.isFinite(next.getTime())){reasons.push('A published shift has an invalid date.');continue;}next.setUTCDate(next.getUTCDate()+1);
    const start=iso(shift.startAt) ?? zonedAttendanceTime(date,shift.startTime,policy.timeZone);
    const end=iso(shift.endAt) ?? zonedAttendanceTime(shift.endTime<=shift.startTime?next.toISOString().slice(0,10):date,shift.endTime,policy.timeZone);
    if(start===null || end===null || end<=start){reasons.push('A shift time is missing or ambiguous; review its timezone/date.');continue;}
    if(now<start+grace*60000)continue;
    const matching=(punches || []).filter(row=>identity(row)===employeeId).map(row=>({row,start:iso(row.clockIn || row.clockInTime || row.clockInAt),end:iso(row.clockOut || row.clockOutTime)})).filter(row=>row.start!==null && (row.row.shiftId===shift.id || row.start<=end && (row.end??now)>=start-4*3600000 && Math.abs(row.start-start)<=12*3600000));
    if(!matching.length){add('shift-punch-review',employeeId,[shift.id],'No matching punch is visible for this published shift. Verify attendance and the source records with the employee.');continue;}
    const first=matching.sort((a,b)=>a.start-b.start)[0];
    if(first.start>start+grace*60000)add('late-start-review',employeeId,[shift.id,first.row.id],`The first matching punch begins ${Math.round((first.start-start)/60000)} minutes after the scheduled start. Review the configured grace and context.`);
    const last=matching.reduce((a,b)=>(a.end??now)>(b.end??now)?a:b);
    if(last.end!==null && last.end<end-grace*60000 && now>=end)add('early-end-review',employeeId,[shift.id,last.row.id],'The last matching punch ends before the scheduled end. Review approved changes before drawing a conclusion.');
  }
  for(const punch of punches || [])if(punch.status==='on_break') {
    const employeeId=identity(punch),start=iso(punch.breakStart || punch.breakStartTime || punch.breakStartedAt || (punch.breaks || []).find(row=>!row.end)?.start);
    if(!employeeId || start===null){reasons.push('An open break has incomplete identity or start-time evidence.');continue;}
    if(now-start>breakLimit*60000)add('open-break-review',employeeId,[punch.id],`The open break exceeds the configured ${breakLimit}-minute review threshold. Verify whether the return punch is missing.`);
  }
  return {findings,reasons:[...new Set(reasons)],policyConfigured:true};
}
Object.defineProperty(globalThis,'__86ChaosAttendanceEvidence',{value:{zonedAttendanceTime,attendanceFindings},configurable:true,writable:true});

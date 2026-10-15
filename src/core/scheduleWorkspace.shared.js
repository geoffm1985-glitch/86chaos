'use strict';

// Shared editing rules only. Schedule Copilot remains the scheduling engine.
const workspaceText = value => String(value == null ? '' : value).trim();
const workspaceDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const identityFields = ['id','scheduleUserId','employeeId','rosterUserId','userId','authUid','accountUserId','assignedUserId','membershipId','workspaceMemberId'];
const editableFields = ['date','startTime','endTime','employeeId','scheduleUserId','rosterUserId','userId','authUid','accountUserId','assignedUserId','employeeName','employeeEmail','rosterRoleId','rosterRoleNameSnapshot','role','station','notes','shiftType','isOpenShift','breakMinutes','paidBreak','endsNextDay','startFold','endFold'];
function workspaceDate(value) {
  const text = workspaceText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text+'T12:00:00Z')) && new Date(text+'T12:00:00Z').toISOString().slice(0,10) === text;
}
function shiftDateBy(date, amount) {
  if (!workspaceDate(date) || !Number.isInteger(amount)) throw new Error('A valid calendar date is required.');
  const day = new Date(date+'T12:00:00Z'); day.setUTCDate(day.getUTCDate()+amount); return day.toISOString().slice(0,10);
}
function workspaceWeek(date) {
  const weekday = new Date(date+'T12:00:00Z').getUTCDay();
  const monday = shiftDateBy(date,-((weekday+6)%7));
  return Array.from({length:7},(_,index)=>shiftDateBy(monday,index));
}
function workspaceMinutes(value, { date, settings = {}, edge = 'start' } = {}) {
  let text = workspaceText(value).toUpperCase();
  if (['OPEN','CLOSE','CL'].includes(text)) {
    const weekday = workspaceDays[new Date(date+'T12:00:00Z').getUTCDay()];
    const hours = settings.operatingHours?.[weekday] || settings.operatingHours?.[weekday?.toLowerCase()] || {};
    text = workspaceText(text === 'OPEN' ? (hours.open || hours.start || settings.openingTime) : (hours.close || hours.end || settings.closingTime)).toUpperCase();
    if (!text || ['OPEN','CLOSE','CL'].includes(text)) throw new Error('Configure operating hours before using symbolic opening or closing times.');
  }
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?$/);
  if (!match) throw new Error('Enter a valid shift time.');
  let hour = Number(match[1]); const minute = Number(match[2] || 0);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 24 || (hour === 24 && minute !== 0))) throw new Error('Enter a valid shift time.');
  if (match[3]) hour = hour%12 + (match[3].startsWith('P') ? 12 : 0);
  if (hour === 24 && edge !== 'end') throw new Error('Use midnight (00:00) for a shift start.');
  return hour*60+minute;
}
const zoneFormatters = new Map();
const zoneCandidateCache = new Map();
function zonedCandidates(date, minutes, timeZone) {
  const cacheKey=JSON.stringify([date,minutes,timeZone]);
  if(zoneCandidateCache.has(cacheKey))return zoneCandidateCache.get(cacheKey);
  let day = date; if (minutes === 1440) { day = shiftDateBy(date,1); minutes = 0; }
  const hour = Math.floor(minutes/60), minute = minutes%60;
  const wall = Date.parse(`${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) { formatter = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}); if (zoneFormatters.size > 20) zoneFormatters.clear(); zoneFormatters.set(timeZone,formatter); }
  const candidates = new Set();
  for (let delta=-36;delta<=36;delta+=6) {
    const sample = wall+delta*3600000;
    const parts = Object.fromEntries(formatter.formatToParts(new Date(sample)).map(part=>[part.type,part.value]));
    const rendered = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    const candidate = wall-(rendered-sample);
    const actual = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map(part=>[part.type,part.value]));
    if (`${actual.year}-${actual.month}-${actual.day}` === day && Number(actual.hour) === hour && Number(actual.minute) === minute) candidates.add(candidate);
  }
  const result=Object.freeze([...candidates].sort((a,b)=>a-b));
  if(zoneCandidateCache.size>=2048)zoneCandidateCache.clear();
  zoneCandidateCache.set(cacheKey,result);return result;
}
function workspaceInterval(shift, settings = {}) {
  const date = workspaceText(shift.scheduleDateKey || shift.date);
  if (!workspaceDate(date)) throw new Error('A valid shift date is required.');
  const startMinute = workspaceMinutes(shift.startTime,{date,settings});
  const endMinute = workspaceMinutes(shift.endTime,{date,settings,edge:'end'});
  const explicit=shift.endsNextDay===true || shift.isOvernight===true || shift.overnight===true || shift.crossesMidnight===true;
  const startText=workspaceText(shift.startTime).toUpperCase(),endText=workspaceText(shift.endTime).toUpperCase();
  const meridiemNight=/P(?:M)?$/.test(startText) && /A(?:M)?$/.test(endText) && (startMinute>=1080 || endMinute<=360);
  const clockNight=!/[AP](?:M)?$/.test(startText) && !/[AP](?:M)?$/.test(endText) && startMinute>=1080 && endMinute<=600;
  if(startMinute===endMinute && !explicit)throw new Error('Start and end times must differ.');
  if(endMinute<startMinute && !(explicit || meridiemNight || clockNight || ['CLOSE','CL'].includes(endText)))throw new Error('End time precedes start time. Correct AM/PM or explicitly confirm Ends next day.');
  if(explicit && endMinute>startMinute && endMinute!==1440)throw new Error('A next-day finish must be no later than the starting clock time.');
  const endDate = endMinute < startMinute || (endMinute===startMinute && explicit) ? shiftDateBy(date,1) : date;
  const zone = workspaceText(settings.timezone || settings.timeZone || 'America/Chicago');
  const starts = zonedCandidates(date,startMinute,zone), ends = zonedCandidates(endDate,endMinute,zone);
  if (!starts.length || !ends.length) throw new Error('This local time does not exist during the daylight-saving transition. Choose another time.');
  const start = starts[shift.startFold === 'later' ? starts.length-1 : 0];
  const end = ends[shift.endFold === 'earlier' ? 0 : ends.length-1];
  if (end <= start || end-start > 26*3600000) throw new Error('Choose a forward shift lasting no more than one calendar day.');
  return {start,end,hours:(end-start)/3600000,overnight:endDate !== date || endMinute === 1440,ambiguous:starts.length>1 || ends.length>1,timeZone:zone};
}
function workspaceAliases(row = {}) { return new Set(identityFields.map(field=>workspaceText(row[field])).filter(Boolean)); }
function workspaceSamePerson(a,b) { const aliases = workspaceAliases({...a,id:undefined}); return [...workspaceAliases(b)].some(id=>aliases.has(id)); }
function workspaceActive(shift) { return !shift.archived && !shift.cancelled && !shift.cancelledAt && !shift.deleted && !shift.isDeleted && !shift.deletedAt && !['cancelled','canceled','deleted','archived'].includes(workspaceText(shift.status).toLowerCase()); }
function workspaceEditable(shift = {}) {
  const row = Object.fromEntries(editableFields.filter(field=>shift[field] !== undefined).map(field=>[field,shift[field]]));
  row.date = workspaceText(shift.scheduleDateKey || shift.date);
  row.station = workspaceText(shift.station || shift.location);
  row.notes = workspaceText(shift.notes || shift.shiftNotes);
  row.isOpenShift = shift.isOpenShift === true || shift.openShift === true || ['open','unassigned-open'].includes(shift.assignmentType || shift.assignmentStatus);
  row.breakMinutes = Number(shift.breakMinutes || 0); row.paidBreak = shift.paidBreak === true;
  row.endsNextDay=shift.endsNextDay===true || shift.isOvernight===true || shift.overnight===true || shift.crossesMidnight===true;
  return row;
}
function workspaceStamp(value) {
  try {
    if(value?.toDate)return value.toDate().toISOString();
    if(value instanceof Date)return value.toISOString();
    const seconds=value?.seconds ?? value?._seconds;
    if(Number.isFinite(seconds))return new Date(seconds*1000+Math.floor(Number(value.nanoseconds ?? value._nanoseconds ?? 0)/1000000)).toISOString();
  } catch (_) { return ''; }
  return workspaceText(value);
}
function workspaceEvidence(shift) {
  if (!shift) return null;
  return JSON.stringify({revision:Number(shift.revision || 0),updatedAt:workspaceStamp(shift.updatedAt),published:shift.isPublished===true || shift.published===true,editable:Object.fromEntries(Object.entries(workspaceEditable(shift)).sort(([a],[b])=>a.localeCompare(b)))});
}
function workspaceSnapshotReady(snapshot, maximum=Infinity) {
  return Boolean(snapshot?.resolved && !snapshot.stale && !snapshot.error && Array.isArray(snapshot.data) && snapshot.data.length<maximum);
}
function workspaceMergeSnapshots(previous, snapshots, {start,end,maximum=Infinity,dateFields=['scheduleDateKey','date']}={}) {
  const verified=snapshots.length>0 && snapshots.every(snapshot=>workspaceSnapshotReady(snapshot,maximum));
  const inScope=row=>{const date=dateFields.map(field=>row[field]).find(Boolean);return date && date>=start && date<=end;};
  // A verified empty result is authoritative too: remove stale parent rows in this scope.
  const rows=new Map(previous.filter(row=>!verified || !inScope(row)).map(row=>[row.id,row]));
  for(const snapshot of snapshots)for(const row of snapshot.data || []) {
    const known=rows.get(row.id),revision=Number(row.revision || 0),knownRevision=Number(known?.revision || 0);
    if(!known || revision>knownRevision || (revision===knownRevision && workspaceStamp(row.updatedAt)>=workspaceStamp(known.updatedAt)))rows.set(row.id,row);
  }
  return [...rows.values()];
}
function workspaceAvailability(shift, person, records, settings = {}) {
  const interval = workspaceInterval(shift,settings), date = shift.date || shift.scheduleDateKey;
  const relevant = (records || []).filter(record=>workspaceSamePerson(record,person) && !record.archived && ['approved','active'].includes(workspaceText(record.status).toLowerCase()));
  let covered = interval.start, unknown = false;
  const windows = [], denied = [];
  for (const day of [shiftDateBy(date,-1),date,shiftDateBy(date,1)]) {
    const record = relevant.filter(row=>(!row.effectiveStartDate || row.effectiveStartDate<=day) && (!row.effectiveEndDate || row.effectiveEndDate>=day)).sort((a,b)=>workspaceText(b.updatedAt || b.createdAt).localeCompare(workspaceText(a.updatedAt || a.createdAt)))[0];
    const fullDay = workspaceInterval({date:day,startTime:'00:00',endTime:'24:00',fullDay:true},settings);
    if (!record) { if (fullDay.start < interval.end && fullDay.end > interval.start) unknown = true; continue; }
    const name = workspaceDays[new Date(day+'T12:00:00Z').getUTCDay()];
    const entry = record.weeklyAvailability?.[name] || record.weeklyAvailability?.[name.toLowerCase()];
    if (entry && entry.available !== false) windows.push(workspaceInterval({date:day,startTime:entry.start || entry.startTime || '00:00',endTime:entry.end || entry.endTime || '24:00',fullDay:true},settings));
    for (const win of record.unavailableWindows || []) if ((!win.date || win.date === day) && (!win.day || [name,name.toLowerCase()].includes(win.day))) denied.push(workspaceInterval({date:day,startTime:win.start || win.startTime || '00:00',endTime:win.end || win.endTime || '24:00',fullDay:true},settings));
  }
  if (denied.some(win=>win.start<interval.end && win.end>interval.start)) return {state:'unavailable',message:'This shift overlaps an approved unavailable window.'};
  for (const win of windows.sort((a,b)=>a.start-b.start)) if (win.start <= covered && win.end > covered) covered = win.end;
  if (covered >= interval.end) return {state:'available',message:'Approved availability covers this shift.'};
  return unknown ? {state:'unknown',message:'Approved availability is incomplete. Confirm availability with this employee.'} : {state:'unavailable',message:'This shift falls outside approved availability.'};
}
function validateWorkspaceShift(shift, context = {}) {
  const errors = [], warnings = []; let interval;
  try { interval = workspaceInterval(shift,context.settings); } catch(error) { errors.push({code:'invalid_time',message:error.message}); }
  const open = workspaceEditable(shift).isOpenShift;
  const people = (context.people || []).filter(person=>workspaceSamePerson(shift,person));
  const person = people.length === 1 ? people[0] : null;
  if (!open && (!person || person.isActive === false)) errors.push({code:'employee_unavailable',message:'Choose one active employee with a verified roster identity.'});
  if (context.roles && !context.roles.some(role=>role.id === shift.rosterRoleId && !role.archived && !role.archivedAt)) errors.push({code:'role_unavailable',message:'Choose an active restaurant role.'});
  if (!Number.isFinite(Number(shift.breakMinutes || 0)) || Number(shift.breakMinutes || 0)<0 || (interval && Number(shift.breakMinutes || 0)>=interval.hours*60)) errors.push({code:'invalid_break',message:'Break minutes must be nonnegative and shorter than the shift.'});
  if (workspaceText(shift.notes).length>2000 || workspaceText(shift.station).length>100) errors.push({code:'invalid_details',message:'Shorten the shift notes or station name.'});
  if (interval?.ambiguous) warnings.push({code:'dst_ambiguity',message:'This shift crosses an ambiguous clock change. Review the selected occurrence and duration.'});
  if(interval?.hours>12)warnings.push({code:'long_shift',message:`This shift spans ${interval.hours.toFixed(1)} hours. Review rest, overtime and configured restaurant policies.`});
  if (!open && person && interval) {
    for (const other of context.shifts || []) {
      if (other.id === shift.id || !workspaceActive(other) || !workspaceSamePerson(other,person)) continue;
      const otherDate=other.scheduleDateKey || other.date;
      if(workspaceDate(otherDate) && (otherDate<shiftDateBy(shift.date || shift.scheduleDateKey,-1) || otherDate>shiftDateBy(shift.date || shift.scheduleDateKey,1)))continue;
      try { const slot=workspaceInterval(other,context.settings); if (slot.start<interval.end && slot.end>interval.start) errors.push({code:'overlap',shiftId:other.id,message:`This employee already has an overlapping shift on ${other.date || other.scheduleDateKey}.`}); }
      catch (_) { errors.push({code:'unverified_existing_shift',shiftId:other.id,message:'An existing shift has invalid times. Repair it before assigning this employee.'}); }
    }
    for (const request of context.timeOff || []) if (workspaceActive(request) && workspaceSamePerson(request,person) && ['approved','accepted'].includes(workspaceText(request.status).toLowerCase())) {
      try { const slot=workspaceInterval({date:request.date || request.scheduleDateKey,startTime:request.isPartial ? request.startTime : '00:00',endTime:request.isPartial ? request.endTime : '24:00',fullDay:!request.isPartial},context.settings); if (slot.start<interval.end && slot.end>interval.start) errors.push({code:'approved_time_off',evidenceId:request.id,message:'Approved time off overlaps this shift.'}); } catch (_) { errors.push({code:'unverified_time_off',message:'Approved time-off evidence is malformed. Review it before assignment.'}); }
    }
    try { const availability=workspaceAvailability(shift,person,context.availability,context.settings); (availability.state==='unavailable' ? errors : availability.state==='unknown' ? warnings : []).push({code:'availability_'+availability.state,message:availability.message}); } catch (_) { errors.push({code:'invalid_availability',message:'Availability times are invalid. Review the approved record.'}); }
    if (workspaceText(shift.station)) {
      const qualified=(context.competencies || []).some(review=>workspaceSamePerson({authUid:review.userId},person) && review.roleId===shift.rosterRoleId && workspaceText(review.station).toLowerCase()===workspaceText(shift.station).toLowerCase() && review.reviewedBy && review.reviewedBy!==review.userId && !review.revokedAt && (!review.expiresAt || Date.parse(review.expiresAt)>Number(context.now || Date.now())));
      if (!qualified) (context.qualificationsVerified===false ? warnings : errors).push({code:'station_qualification',message:context.qualificationsVerified===false?'Station competency will be verified by the server before saving.':'This station requires a current manager-verified competency for the selected role.'});
    }
  }
  return {ok:!errors.length,errors,warnings,interval,person};
}
const scheduleWorkspaceShared = {editableFields,workspaceDate,shiftDateBy,workspaceWeek,workspaceMinutes,workspaceInterval,workspaceAliases,workspaceSamePerson,workspaceActive,workspaceEditable,workspaceStamp,workspaceEvidence,workspaceSnapshotReady,workspaceMergeSnapshots,workspaceAvailability,validateWorkspaceShift};
Object.defineProperty(globalThis,'__86ChaosScheduleWorkspaceShared',{value:scheduleWorkspaceShared,configurable:true,writable:true});
if (typeof module !== 'undefined' && module.exports) module.exports = scheduleWorkspaceShared;

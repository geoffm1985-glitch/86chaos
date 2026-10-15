import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/common';
import { useLiveCollectionState } from '../../core/appCore';
import { buildCoverageVarianceRows } from '../../core/scheduleWarningControls';
import { workspaceEditable, workspaceEvidence, workspaceWeek, workspaceDate, shiftDateBy, workspaceActive, workspaceSamePerson, workspaceInterval, workspaceSnapshotReady, workspaceMergeSnapshots, validateWorkspaceShift } from '../../core/scheduleWorkspace';
import { useScheduleEdits } from './useScheduleEdits';
import { loadScheduleWeekVerified } from './scheduleWorkspaceData';
import './scheduleWorkspace.css';
import { ShiftChangePreview } from './ShiftChangePreview';

const clean=value=>String(value == null?'':value).trim();
const dateLabel=(date,options={weekday:'short',month:'short',day:'numeric'})=>new Intl.DateTimeFormat(undefined,{...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const personName=person=>person?.name || person?.displayName || person?.email || 'Unnamed employee';
const shiftTime=shift=>`${shift.startTime}–${shift.endTime}`;
const published=shift=>Boolean(shift?.isPublished || shift?.published || shift?.status==='published');
const identityKeys=['employeeId','scheduleUserId','rosterUserId','userId','authUid','accountUserId','assignedUserId','employeeName','employeeEmail'];
function chooseEmployee(draft,id) { const next={...draft};for(const key of identityKeys)delete next[key];return{...next,employeeId:id,isOpenShift:!id}; }
function readDraft(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch (_) { return null; } }
function writeDraft(key,value) { try { if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key); } catch (_) {} }

export const ScheduleWorkspace=forwardRef(function ScheduleWorkspace({currentDate,users=[],shifts=[],timeOffRequests=[],availabilityRecords=[],events=[],roles=[],appUser,sourceState=null,onNavigate,onPublish,onSmartSchedule,onApplied,legacyView=false,onLegacyView},ref) {
  const [anchor,setAnchor]=useState(currentDate),[day,setDay]=useState(currentDate);
  const [employeeFilter,setEmployeeFilter]=useState(''),[roleFilter,setRoleFilter]=useState(''),[stationFilter,setStationFilter]=useState(''),[typeFilter,setTypeFilter]=useState(''),[statusFilter,setStatusFilter]=useState('');
  const [collapsed,setCollapsed]=useState(new Set()),[selected,setSelected]=useState(new Set());
  const [editor,setEditor]=useState(null),[preview,setPreview]=useState(null),[reason,setReason]=useState(''),[localError,setLocalError]=useState(''),[copying,setCopying]=useState(false),[historyReview,setHistoryReview]=useState(null);
  const [bulkTarget,setBulkTarget]=useState(''),[bulkEmployee,setBulkEmployee]=useState(''),[bulkMode,setBulkMode]=useState(null);
  const dragIds=useRef([]),touchStart=useRef(null),editorBody=useRef(null),workspaceBody=useRef(null);
  const tenant=appUser?.restaurantId || '',actor=appUser?.authUid || appUser?.uid || appUser?.id || '';
  const settings=appUser?.systemSettings || {};
  const dates=useMemo(()=>workspaceWeek(anchor),[anchor]);
  const dateStart=shiftDateBy(dates[0],-1),dateEnd=shiftDateBy(dates[6],1);
  const weekDateState=useLiveCollectionState('shifts',tenant,{enabled:!legacyView,requireServerSnapshot:true,whereClauses:[['date','>=',dateStart],['date','<=',dateEnd]],limitCount:5001,debugLabel:'schedule:weekly:date'});
  const weekKeyState=useLiveCollectionState('shifts',tenant,{enabled:!legacyView,requireServerSnapshot:true,whereClauses:[['scheduleDateKey','>=',dateStart],['scheduleDateKey','<=',dateEnd]],limitCount:5001,debugLabel:'schedule:weekly:canonical-date'});
  const weekOffState=useLiveCollectionState('timeOffRequests',tenant,{enabled:!legacyView,requireServerSnapshot:true,whereClauses:[['date','>=',dateStart],['date','<=',dateEnd]],limitCount:1001,debugLabel:'schedule:weekly:time-off'});
  const coverageState=useLiveCollectionState('scheduleCoverageTargets',tenant,{enabled:!legacyView,requireServerSnapshot:true,limitCount:200,debugLabel:'schedule:weekly:coverage'});
  const weekEventsState=useLiveCollectionState('events',tenant,{enabled:!legacyView,requireServerSnapshot:true,whereClauses:[['date','>=',dates[0]],['date','<=',dates[6]]],limitCount:501,debugLabel:'schedule:weekly:events'});
  const incoming=useMemo(()=>legacyView?shifts:workspaceMergeSnapshots(shifts,[weekDateState,weekKeyState],{start:dateStart,end:dateEnd,maximum:5001}),[legacyView,shifts,weekDateState,weekKeyState,dateStart,dateEnd]);
  const liveSource={resolved:legacyView?sourceState?.resolved:workspaceSnapshotReady(weekDateState,5001) && workspaceSnapshotReady(weekKeyState,5001),stale:legacyView?sourceState?.stale:weekDateState.stale || weekKeyState.stale,error:legacyView?sourceState?.error:weekDateState.error || weekKeyState.error};
  const actions=useScheduleEdits({appUser,shifts:incoming,sourceState:liveSource,onApplied});
  const people=useMemo(()=>users.filter(person=>person.isActive!==false),[users]);
  const offRows=useMemo(()=>workspaceMergeSnapshots(timeOffRequests,[weekOffState],{start:dateStart,end:dateEnd,maximum:1001,dateFields:['date']}),[timeOffRequests,weekOffState,dateStart,dateEnd]);
  const weekShifts=useMemo(()=>actions.visibleShifts.filter(row=>workspaceActive(row) && dates.includes(row.scheduleDateKey || row.date)),[actions.visibleShifts,dates]);
  const eventRows=useMemo(()=>workspaceMergeSnapshots(events,[weekEventsState],{start:dates[0],end:dates[6],maximum:501,dateFields:['date']}).filter(row=>workspaceActive(row) && dates.includes(row.date)),[events,weekEventsState,dates]);
  const context=useMemo(()=>({people,roles,shifts:actions.visibleShifts,timeOff:offRows,availability:availabilityRecords,settings,qualificationsVerified:false}),[people,roles,actions.visibleShifts,offRows,availabilityRecords,settings]);
  const stations=useMemo(()=>[...new Set([...(Array.isArray(settings.stations)?settings.stations.map(row=>typeof row==='string'?row:row.name):[]),...weekShifts.map(row=>row.station || row.location)].map(clean).filter(Boolean))].sort(),[settings.stations,weekShifts]);
  const coverageShifts=useMemo(()=>weekShifts.filter(row=>{if(workspaceEditable(row).isOpenShift || people.filter(person=>workspaceSamePerson(row,person)).length!==1)return false;try{workspaceInterval(row,settings);return true;}catch(_){return false;}}),[weekShifts,people,settings]);
  const coverageWarnings=useMemo(()=>buildCoverageVarianceRows({periodDates:dates,periodShifts:coverageShifts,coverageTargets:coverageState.data}),[dates,coverageShifts,coverageState.data]);
  const rows=useMemo(()=>{
    const result=people.filter(person=>(!employeeFilter || person.id===employeeFilter) && (!roleFilter || person.rosterRoleId===roleFilter || person.role===roles.find(role=>role.id===roleFilter)?.name || weekShifts.some(shift=>shift.rosterRoleId===roleFilter && workspaceSamePerson(shift,person)))).map(person=>({...person,_rowKey:person.id,_shifts:[]}));
    const byId=new Map(result.map(person=>[person.id,person]));
    const open={id:'__open',_rowKey:'__open',name:'Open shifts',role:'Open shifts',_shifts:[]},unresolved={id:'__unresolved',_rowKey:'__unresolved',name:'Employee identity needs review',role:'Needs review',_shifts:[]};
    for(const shift of weekShifts){
      if(stationFilter && clean(shift.station || shift.location)!==stationFilter)continue;
      if(typeFilter && (shift.shiftType || 'regular')!==typeFilter)continue;
      if(statusFilter && (statusFilter==='open'?!workspaceEditable(shift).isOpenShift:statusFilter==='published'?!published(shift):published(shift)))continue;
      if(roleFilter && shift.rosterRoleId!==roleFilter)continue;
      if(workspaceEditable(shift).isOpenShift){if(!employeeFilter)open._shifts.push(shift);continue;}
      const matches=people.filter(person=>workspaceSamePerson(shift,person));
      if(matches.length===1)byId.get(matches[0].id)?._shifts.push(shift);
      else if(!employeeFilter)unresolved._shifts.push(shift);
    }
    if(open._shifts.length || !employeeFilter)result.push(open);
    if(unresolved._shifts.length)result.push(unresolved);
    return result;
  },[people,roles,weekShifts,employeeFilter,roleFilter,stationFilter,typeFilter,statusFilter]);
  const groups=useMemo(()=>Object.entries(rows.reduce((map,person)=>{const group=person.role || 'Unassigned role';(map[group] ||= []).push(person);return map;},{})).sort(([a],[b])=>a.localeCompare(b)),[rows]);
  const hours=useMemo(()=>weekShifts.reduce((total,shift)=>{try{return total+Math.max(0,workspaceInterval(shift,settings).hours-(shift.paidBreak?0:Number(shift.breakMinutes || 0)/60));}catch(_){return total;}},0),[weekShifts,settings]);
  const draftKey=`86chaos:schedule-draft:${tenant}:${actor}`;
  const [recovered,setRecovered]=useState(()=>readDraft(draftKey));
  useEffect(()=>{setAnchor(currentDate);setDay(currentDate);setSelected(new Set());},[currentDate]);
  useEffect(()=>{if(editor)writeDraft(draftKey,editor);},[draftKey,editor]);
  const openEditor=(before=null,date=day,personId='')=>{
    actions.clearError();setLocalError('');setReason('');
    const person=people.find(person=>person.id===personId) || people.find(person=>before && workspaceSamePerson(before,person));
    const role=roles.find(role=>role.id===(before?.rosterRoleId || person?.rosterRoleId)) || roles.find(role=>role.name===(before?.role || person?.role));
    const draft=before?workspaceEditable(before):{date,startTime:'16:00',endTime:'21:00',employeeId:person?.id || '',rosterRoleId:role?.id || '',station:'',notes:'',shiftType:'regular',isOpenShift:!person,breakMinutes:0,paidBreak:false};
    const initialDraft=before && person?chooseEmployee(draft,person.id):draft;
    setEditor({before,draft:initialDraft,initialDraft:{...initialDraft}});
  };
  useImperativeHandle(ref,()=>({openShift:(shift,person,date)=>openEditor(shift,date,person?.id)}));
  const navigate=(date)=>{setAnchor(date);setDay(date);setSelected(new Set());onNavigate?.(date);};
  const editorCheck=useMemo(()=>editor?validateWorkspaceShift({...editor.draft,id:editor.before?.id},{...context}):null,[editor,context]);
  const requestReview=(changes,title)=>{setPreview({changes,title});setReason('');setLocalError('');};
  const focusResult=result=>{
    const row=(result.currentResults || result.results || []).find(row=>row.after);
    if(row && dates.includes(row.after.date))setDay(row.after.date);
    window.setTimeout(()=>{
      const cards=[...(workspaceBody.current?.querySelectorAll('[data-shift-id]') || [])];
      const card=cards.find(card=>card.dataset.shiftId===row?.id && card.getClientRects().length);
      (card?.querySelector('.sw-shift-edit') || workspaceBody.current?.querySelector('[data-testid="schedule-add-shift"]'))?.focus({preventScroll:true});
    },0);
  };
  const finishEdit=result=>{setPreview(null);setEditor(null);setSelected(new Set());writeDraft(draftKey,null);setRecovered(null);setLocalError('');focusResult(result);};
  const apply=async(changes,review={})=>{
    const result=await actions.change(changes,{acknowledgedWarnings:true,...review});
    if(result)finishEdit(result);
    return result;
  };
  const retryPending=async()=>{
    const changes=actions.pending?.body.changes;
    const sameDraft=editor && changes?.length===1 && changes[0].patch && workspaceEvidence(editor.draft)===workspaceEvidence(changes[0].patch);
    const result=await actions.retry();
    if(!result)return;
    if(!editor || sameDraft)finishEdit(result);
    else setLocalError('The original request is confirmed. Your newer unsaved draft is retained. Reopen the current shift before applying further changes.');
  };
  const containDialogFocus=event=>{
    if(event.key!=='Tab')return;
    const dialog=event.target.closest('[role="dialog"]');
    if(!dialog || !dialog.querySelector('.sw-editor'))return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[href],[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hidden && element.getAttribute('aria-hidden')!=='true');
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey && (event.target===first || event.target===dialog)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && (event.target===last || event.target===dialog)){event.preventDefault();first?.focus();}
  };
  const saveEditor=()=>{
    if(!editor || actions.busy)return;
    if(actions.pending){setLocalError('Confirm the outcome of the pending edit before saving another change.');return;}
    if(editor.before && editor.initialDraft && workspaceEvidence(editor.draft)===workspaceEvidence(editor.initialDraft)){actions.markUnchanged();setEditor(null);writeDraft(draftKey,null);setRecovered(null);return;}
    if(editorCheck?.errors.length){setLocalError(editorCheck.errors.map(row=>row.message).join(' '));return;}
    const changes=[{kind:editor.before?'update':'create',...(editor.before?{id:editor.before.id,expected:workspaceEvidence(editor.before)}:{}),patch:editor.draft}];
    if(published(editor.before) || actions.error?.code==='published_review_required')requestReview(changes,'Review published shift change');else apply(changes);
  };
  const previewPublished=Boolean(preview && (actions.error?.code==='published_review_required' || preview.changes.some(change=>published(actions.visibleShifts.find(row=>row.id===change.id)))));
  const prepareMove=(ids,targetDate,targetEmployee='',copy=false)=>{
    if(!workspaceDate(targetDate)){setLocalError('Choose a valid destination date.');return;}
    const originals=ids.map(id=>actions.visibleShifts.find(row=>row.id===id)).filter(Boolean);
    if(!originals.length)return;
    const firstDate=originals[0].scheduleDateKey || originals[0].date;
    const delta=Math.round((Date.parse(targetDate+'T12:00:00Z')-Date.parse(firstDate+'T12:00:00Z'))/86400000);
    const changes=originals.map(original=>{let patch={...workspaceEditable(original),date:shiftDateBy(original.scheduleDateKey || original.date,delta)};if(targetEmployee)patch=chooseEmployee(patch,targetEmployee==='__open'?'':targetEmployee);return{kind:copy?'create':'update',...(copy?{}:{id:original.id,expected:workspaceEvidence(original)}),patch};});
    requestReview(changes,copy?'Preview copied shifts':'Preview moved shifts');
  };
  const copyPrevious=async()=>{
    setCopying(true);setLocalError('');
    try{const previous=await loadScheduleWeekVerified(tenant,shiftDateBy(dates[0],-7));if(!previous.length){setLocalError('The previous week has no verified shifts to copy.');return;}if(previous.length>150)throw new Error('Review up to 150 shifts in one atomic copy. Use Monthly & advanced tools to copy a larger period, or select smaller groups.');requestReview(previous.map(original=>({kind:'create',patch:{...workspaceEditable(original),date:shiftDateBy(original.scheduleDateKey || original.date,7)}})),'Review previous-week copy');}catch(error){setLocalError(error.message);}finally{setCopying(false);}
  };
  const compensate=async(mode)=>{
    if(actions[mode+'NeedsReview']){setHistoryReview(mode);setReason('');return;}
    await actions[mode]({acknowledgedWarnings:true});
  };
  const shiftCard=(shift,person)=>{
    let warnings=[];try{const own=person.id.startsWith('__')?context.shifts:context.shifts.filter(row=>workspaceSamePerson(row,person));const result=validateWorkspaceShift({...workspaceEditable(shift),id:shift.id},{...context,shifts:own});warnings=[...result.errors,...result.warnings];}catch(_){warnings=[{message:'Shift evidence needs review.'}];}
    return <div key={shift.id} className={`sw-shift-card ${published(shift)?'sw-published':'sw-draft'}`} data-testid="schedule-shift-card" data-shift-id={shift.id} data-published={published(shift)} draggable={!actions.busy} onDragStart={event=>{dragIds.current=selected.has(shift.id)?[...selected]:[shift.id];event.dataTransfer.setData('application/x-86chaos-shifts',JSON.stringify(dragIds.current));event.dataTransfer.effectAllowed='copyMove';}} onDragEnd={()=>{dragIds.current=[];}}>
      <label className="sw-select-shift"><input type="checkbox" aria-label={`Select ${personName(person)} shift ${shiftTime(shift)} on ${shift.date}`} checked={selected.has(shift.id)} onChange={event=>setSelected(previous=>{const next=new Set(previous);event.target.checked?next.add(shift.id):next.delete(shift.id);return next;})}/></label>
      <button type="button" className="sw-shift-edit" onClick={()=>openEditor(shift,shift.date,person.id.startsWith('__')?'':person.id)} aria-label={`Edit shift ${shiftTime(shift)} for ${personName(person)} on ${shift.date}`}><strong>{shiftTime(shift)}</strong><span>{shift.rosterRoleNameSnapshot || shift.role || 'Role needs review'}{shift.station || shift.location?` · ${shift.station || shift.location}`:''}</span><span>{published(shift)?'Published':'Draft'}{shift.isOpenShift?' · Open':''}{warnings.length?` · ${warnings.length} review item${warnings.length===1?'':'s'}`:''}</span></button>
    </div>;
  };
  const cell=(person,date)=>{
    const cards=person._shifts.filter(row=>(row.scheduleDateKey || row.date)===date);
    const leave=offRows.filter(row=>workspaceActive(row) && row.date===date && workspaceSamePerson(row,person) && ['approved','accepted'].includes(clean(row.status).toLowerCase()));
    return <div className="sw-cell" data-testid="weekly-schedule-cell" data-date={date} data-employee-id={person.id} onDragOver={event=>{if(dragIds.current.length){event.preventDefault();event.dataTransfer.dropEffect=event.altKey?'copy':'move';}}} onDrop={event=>{event.preventDefault();const ids=dragIds.current;if(ids.length && person.id!=='__unresolved')prepareMove(ids,date,person.id,event.altKey);dragIds.current=[];}}>
      {leave.map(row=><span className="sw-time-off" key={row.id}>Approved time off{row.isPartial?` · ${row.startTime}–${row.endTime}`:''}</span>)}
      {cards.map(shift=>shiftCard(shift,person))}
      <button type="button" className="sw-quick-add" aria-label={`Add shift for ${personName(person)} on ${date}`} onClick={()=>openEditor(null,date,person.id.startsWith('__')?'':person.id)}>＋ Add shift</button>
    </div>;
  };
  const calendar=useMemo(()=> (<>
<div className="sw-desktop-scroll" data-testid="weekly-schedule-scroll" tabIndex={0} aria-label="Scrollable seven-day schedule"><table className="sw-week-table" data-testid="weekly-schedule-grid"><thead data-testid="schedule-builder-sticky-day-header"><tr><th scope="col">Employee / role</th>{dates.map(date=><th key={date} scope="col">{dateLabel(date)}</th>)}</tr></thead><tbody>{groups.map(([group,peopleInGroup])=><React.Fragment key={group}><tr className="sw-role-group"><th colSpan={8}><button type="button" aria-expanded={!collapsed.has(group)} onClick={()=>setCollapsed(previous=>{const next=new Set(previous);next.has(group)?next.delete(group):next.add(group);return next;})}>{collapsed.has(group)?'▸':'▾'} {group} · {peopleInGroup.length}</button></th></tr>{!collapsed.has(group) && peopleInGroup.map(person=><tr key={person._rowKey}><th scope="row"><strong>{personName(person)}</strong><span>{person.role || 'Unassigned role'}</span></th>{dates.map(date=><td key={date}>{cell(person,date)}</td>)}</tr>)}</React.Fragment>)}</tbody></table></div>
      <div className="sw-mobile-calendar" data-testid="mobile-schedule-calendar"><nav className="sw-day-strip" aria-label="Days of this week">{dates.map(date=><button type="button" aria-pressed={date===day} data-date={date} key={date} onClick={()=>setDay(date)}>{dateLabel(date,{weekday:'short',day:'numeric'})}</button>)}</nav><div className="sw-mobile-day-nav" data-testid="mobile-schedule-day-header"><button type="button" aria-label="Previous day" onClick={()=>{const next=shiftDateBy(day,-1);dates.includes(next)?setDay(next):navigate(next);}}>←</button><strong>{dateLabel(day)}</strong><button type="button" aria-label="Next day" onClick={()=>{const next=shiftDateBy(day,1);dates.includes(next)?setDay(next):navigate(next);}}>→</button></div><div onTouchStart={event=>{if(!event.target.closest('button,input,select,textarea'))touchStart.current=event.touches[0];}} onTouchEnd={event=>{const start=touchStart.current;touchStart.current=null;if(!start)return;const end=event.changedTouches[0];if(Math.abs(end.clientX-start.clientX)>80 && Math.abs(end.clientY-start.clientY)<40){const next=shiftDateBy(day,end.clientX<start.clientX?1:-1);dates.includes(next)?setDay(next):navigate(next);}}}>{groups.map(([group,peopleInGroup])=><div className="sw-mobile-group" key={group}><button type="button" aria-expanded={!collapsed.has(group)} onClick={()=>setCollapsed(previous=>{const next=new Set(previous);next.has(group)?next.delete(group):next.add(group);return next;})}>{group}</button>{!collapsed.has(group) && peopleInGroup.map(person=><article key={person._rowKey}><h3>{personName(person)}</h3>{cell(person,day)}</article>)}</div>)}</div></div>
</>),[dates,groups,collapsed,selected,day,context,actions.busy,people,roles]);
  const closeEditor=()=>{if(!actions.busy){if(editor){writeDraft(draftKey,editor);setRecovered(editor);}setEditor(null);}};
  return <section ref={workspaceBody} className="schedule-workspace" data-testid="schedule-workspace" aria-label="Weekly Schedule Builder" onKeyDownCapture={containDialogFocus}>
    <div className="sw-toolbar"><button type="button" data-testid="schedule-add-shift" onClick={()=>openEditor()}>Add Shift</button><button type="button" onClick={copyPrevious} disabled={actions.busy || copying}>{copying?'Loading verified shifts…':'Copy Previous Week'}</button><button type="button" onClick={onSmartSchedule}>Smart Schedule</button><button type="button" onClick={onPublish}>Review &amp; Publish</button></div>
    <div className="sw-context"><div><button type="button" aria-label="Previous week" onClick={()=>navigate(shiftDateBy(dates[0],-7))}>←</button><strong>{dateLabel(dates[0],{month:'short',day:'numeric'})} – {dateLabel(dates[6],{month:'short',day:'numeric',year:'numeric'})}</strong><button type="button" aria-label="Next week" onClick={()=>navigate(shiftDateBy(dates[0],7))}>→</button></div><div><button type="button" onClick={()=>compensate('undo')} disabled={actions.busy || !actions.canUndo}>Undo</button><button type="button" onClick={()=>compensate('redo')} disabled={actions.busy || !actions.canRedo}>Redo</button><button type="button" onClick={()=>onLegacyView?.(!legacyView)}>{legacyView?'Simple weekly view':'Monthly & advanced tools'}</button></div></div>
    <p className="sw-sync" role="status">{actions.sync==='saving'?'Saving — awaiting server confirmation':actions.sync==='verified'?'Saved and verified by the server':actions.sync==='unchanged'?'No changes to save':actions.sync==='unknown'?'Save outcome unknown. Review the schedule or explicitly retry the same request.':liveSource.error?'Schedule verification failed. Cached preview; saving will recheck current data.':liveSource.stale || !liveSource.resolved?'Schedule preview is cached or loading; current state is not yet verified.':'Schedule loaded from the server.'} · {hours.toFixed(1)} scheduled hours · {weekShifts.filter(published).length} published · {weekShifts.filter(row=>!published(row)).length} drafts</p>
    {actions.pending && <button type="button" onClick={retryPending} disabled={actions.busy}>Review outcome and retry the same saved request</button>}
    {(localError || actions.error) && <div className="sw-error" role="alert">{localError || actions.error.message}{actions.error?.findings?.map((finding,index)=><p key={index}>{finding.message}</p>)}</div>}
    {!editor && recovered && <button type="button" onClick={()=>{setEditor(recovered);setLocalError('Review this recovered draft against current schedule data before saving.');}}>Recover unsaved shift draft</button>}
    <details className="sw-filters"><summary>Filter schedule</summary><label>Employee<select value={employeeFilter} onChange={event=>setEmployeeFilter(event.target.value)}><option value="">All employees</option>{people.map(person=><option key={person.id} value={person.id}>{personName(person)}</option>)}</select></label><label>Role<select value={roleFilter} onChange={event=>setRoleFilter(event.target.value)}><option value="">All roles</option>{roles.map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label>Station<select value={stationFilter} onChange={event=>setStationFilter(event.target.value)}><option value="">All stations</option>{stations.map(station=><option key={station}>{station}</option>)}</select></label><label>Shift type<select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="">All shift types</option>{['regular','opening','closing','event'].map(type=><option key={type}>{type}</option>)}</select></label><label>Publication<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">All shifts</option><option value="draft">Draft</option><option value="published">Published</option><option value="open">Open shifts</option></select></label></details>
    {!legacyView && <>
      <div className="sw-warnings" aria-label="Coverage and event warnings">{!workspaceSnapshotReady(coverageState,200)?<p>Coverage targets are not verified yet.</p>:coverageWarnings.length?<details><summary>{coverageWarnings.length} coverage warnings</summary>{coverageWarnings.map((warning,index)=><p key={index}>{warning.message || `${warning.date}: ${warning.role} coverage needs review`}</p>)}</details>:<p>Configured coverage checks found no variance; missing targets do not establish complete staffing.</p>}{weekShifts.length>coverageShifts.length && <p>{weekShifts.length-coverageShifts.length} open, invalid or unresolved shifts are excluded from filled coverage.</p>}{eventRows.map(event=><p key={event.id}>{dateLabel(event.date)} · {event.title || event.name || 'Restaurant event'}</p>)}{(!workspaceSnapshotReady(weekEventsState,501) || !workspaceSnapshotReady(weekOffState,1001)) && <p>Events or time-off evidence is still loading or unverified.</p>}</div>
      {selected.size>0 && <div className="sw-bulk" role="status">{selected.size} shifts selected <button type="button" onClick={()=>{setBulkMode('move');setBulkTarget(day);setBulkEmployee('');}}>Move / Reassign Selected</button><button type="button" onClick={()=>{setBulkMode('copy');setBulkTarget(shiftDateBy(day,7));setBulkEmployee('');}}>Copy Selected</button><button type="button" onClick={()=>setSelected(new Set())}>Clear Selection</button></div>}
      {calendar}
    </>}
    <Modal isOpen={Boolean(editor) && !preview} onClose={closeEditor} title={editor?.before?'Edit shift':'Add shift'} sizeClass="max-w-xl"><div className="sw-editor" ref={editorBody} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();closeEditor();}}}>
      {editor && <><p>{published(editor.before)?'Published shift — changes require an audited review.':'Draft shift — Save confirms the authoritative server result.'}</p><label>Assigned employee<select data-testid="shift-editor-employee" value={editor.draft.isOpenShift?'':editor.draft.employeeId || ''} onChange={event=>setEditor(previous=>({...previous,draft:chooseEmployee(previous.draft,event.target.value)}))}><option value="">Open / unassigned shift</option>{people.map(person=><option key={person.id} value={person.id}>{personName(person)}</option>)}</select></label><label>Date<input type="date" data-testid="shift-editor-date" value={editor.draft.date} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,date:event.target.value}}))}/></label><div className="sw-editor-times"><label>Start time<input data-testid="shift-editor-start" value={editor.draft.startTime} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,startTime:event.target.value}}))} placeholder="16:00 or OPEN"/></label><label>End time<input data-testid="shift-editor-end" value={editor.draft.endTime} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,endTime:event.target.value}}))} placeholder="21:00 or CLOSE"/></label></div><label><input type="checkbox" checked={editor.draft.endsNextDay===true} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,endsNextDay:event.target.checked}}))}/> Ends next day (confirm an extended overnight shift)</label>{editorCheck?.interval?.overnight && <p>This shift ends on the next calendar day.</p>}<label>Position / role<select data-testid="shift-editor-role" value={editor.draft.rosterRoleId || ''} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,rosterRoleId:event.target.value,role:roles.find(role=>role.id===event.target.value)?.name || ''}}))}><option value="">Choose a role</option>{roles.map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label>{stations.length>0 && <label>Station<select value={editor.draft.station || ''} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,station:event.target.value}}))}><option value="">No station</option>{stations.map(station=><option key={station}>{station}</option>)}</select></label>}<label>Shift type<select value={editor.draft.shiftType || 'regular'} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,shiftType:event.target.value}}))}>{['regular','opening','closing','event'].map(type=><option key={type}>{type}</option>)}</select></label><label>Shift notes<textarea data-testid="shift-editor-notes" maxLength={2000} value={editor.draft.notes || ''} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,notes:event.target.value}}))}/></label><div className="sw-editor-times"><label>Break minutes<input type="number" min="0" step="1" value={editor.draft.breakMinutes || 0} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,breakMinutes:Number(event.target.value)}}))}/></label><label><input type="checkbox" checked={editor.draft.paidBreak===true} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,paidBreak:event.target.checked}}))}/> Paid break</label></div>{editorCheck?.interval?.ambiguous && <div className="sw-editor-times">{['start','end'].map(edge=><label key={edge}>{edge} clock occurrence<select value={editor.draft[edge+'Fold'] || (edge==='start'?'earlier':'later')} onChange={event=>setEditor(previous=>({...previous,draft:{...previous.draft,[edge+'Fold']:event.target.value}}))}><option>earlier</option><option>later</option></select></label>)}</div>}<div className="sw-editor-findings" aria-live="polite">{[...(editorCheck?.errors || []),...(editorCheck?.warnings || [])].map((finding,index)=><p key={index}>{finding.message}</p>)}</div>{(localError || actions.error) && <p role="alert">{localError || actions.error.message}</p>}<div className="sw-editor-actions"><button type="button" data-testid="shift-editor-save" disabled={actions.busy} onClick={saveEditor}>{actions.busy?'Awaiting confirmation…':'Save shift'}</button><button type="button" disabled={actions.busy} onClick={closeEditor}>Cancel</button>{editor.before && <><button type="button" onClick={()=>setEditor(previous=>({before:null,draft:{...previous.draft,date:shiftDateBy(previous.draft.date,1)}}))}>Duplicate</button><button type="button" onClick={()=>editorBody.current?.querySelector('[data-testid="shift-editor-date"]')?.focus()}>Move</button><button type="button" onClick={()=>editorBody.current?.querySelector('[data-testid="shift-editor-employee"]')?.focus()}>Reassign</button><button type="button" className="sw-delete" onClick={()=>requestReview([{kind:'delete',id:editor.before.id,expected:workspaceEvidence(editor.before)}],'Confirm shift deletion — Undo remains available')}>Delete shift</button></>}</div></>}
    </div></Modal>
    <Modal isOpen={Boolean(preview)} onClose={()=>{if(!actions.busy)setPreview(null);}} title={preview?.title || 'Review changes'} sizeClass="max-w-2xl"><div className="sw-editor"><p>Nothing changes until you confirm. The server will recheck availability, time off, overlap, qualifications and current revisions.</p><ShiftChangePreview changes={preview?.changes || []} shifts={actions.visibleShifts} people={people} roles={roles}/>{previewPublished && <label>Reason for published change<textarea value={reason} minLength={4} maxLength={500} onChange={event=>setReason(event.target.value)}/></label>}{actions.error && <p role="alert">{actions.error.message}</p>}<button type="button" data-testid="schedule-confirm-preview" disabled={actions.busy || (previewPublished && reason.trim().length<4)} onClick={()=>apply(preview.changes,{confirmedPublished:previewPublished,reason:previewPublished?reason:''})}>{actions.busy?'Verifying…':'Confirm changes'}</button><button type="button" disabled={actions.busy} onClick={()=>setPreview(null)}>Cancel</button></div></Modal>
    <Modal isOpen={Boolean(bulkMode)} onClose={()=>setBulkMode(null)} title={bulkMode==='copy'?'Copy selected shifts':'Move / reassign selected shifts'}><div className="sw-editor"><label>Move the first selected shift to<input type="date" value={bulkTarget} onChange={event=>setBulkTarget(event.target.value)}/></label><p>Other selected shifts retain their relative dates.</p><label>Employee<select value={bulkEmployee} onChange={event=>setBulkEmployee(event.target.value)}><option value="">Keep each assignment</option><option value="__open">Open / unassigned</option>{people.map(person=><option key={person.id} value={person.id}>{personName(person)}</option>)}</select></label><button type="button" onClick={()=>{prepareMove([...selected],bulkTarget,bulkEmployee,bulkMode==='copy');setBulkMode(null);}}>Preview changes</button></div></Modal>
    <Modal isOpen={Boolean(historyReview)} onClose={()=>{if(!actions.busy)setHistoryReview(null);}} title={`Review published ${historyReview || 'recovery'}`}><div className="sw-editor"><p>This creates an audited compensating change. It cannot overwrite a newer edit.</p><label>Reason<textarea value={reason} onChange={event=>setReason(event.target.value)}/></label><button type="button" disabled={actions.busy || reason.trim().length<4} onClick={async()=>{const result=await actions[historyReview]({acknowledgedWarnings:true,confirmedPublished:true,reason});if(result)setHistoryReview(null);}}>Confirm {historyReview}</button></div></Modal>
  </section>;
});

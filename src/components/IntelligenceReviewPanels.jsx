import React,{useState} from 'react';
import {secureFetch} from '../core/appCore';

const box = 'rounded-xl border border-[#2A353D] bg-[#12161A] p-3 min-w-0';
const button = 'min-h-[44px] rounded-lg border border-[#D4A381]/40 px-3 py-2 text-xs font-bold text-[#E6BB9F] disabled:opacity-50';

export function DemandHistoryStatus({ history }) {
  return <div data-testid="demand-history-status" role="status" className="mt-2 text-xs text-slate-400">
    {history.allowed === false ? 'Sales read permission is required for demand history.' : !history.complete ? `Demand evidence incomplete: ${(history.reasons || []).join(' ')}` : `${history.rows.length} verified item sales rows in the 112-day window.`}
    {history.aggregateOnlyDays > 0 && <span> {history.aggregateOnlyDays} day(s) contain totals without item-level sales. Totals cannot predict individual menu items.</span>}
  </div>;
}

export function ForecastReviewPanel({ report, blocked, busy, onReview }) {
  return <section data-testid="schedule-demand-forecast" className="space-y-3">
    <h4 className="text-base font-black text-white">Forecast-aware coverage review</h4>
    <p className="text-xs text-slate-400">Compare configured role coverage with the recent sales trend for comparable weekdays. Recommendations create drafts only after review.</p>
    {!report.allowed ? <p role="status">{report.reason}</p> : !report.rows.length ? <p role="status">Configure role coverage targets and load comparable sales history to review demand.</p> : report.rows.map(row => <article key={row.id} className={box}>
      <h5 className="font-bold text-white">{row.date} · {row.role}</h5>
      <p className="mt-1 text-xs text-slate-300">{row.reason}</p>
      {row.state === 'recommendation' && <><p className="mt-1 text-xs text-slate-400">{row.evidence.dates.length} comparable days · {Math.round(row.confidence*100)}% confidence · {row.startTime}–{row.endTime} · {row.existing} existing · {row.needed} draft(s) to review.</p><details className="mt-2 text-xs text-slate-400"><summary>Demand evidence</summary><p>Comparable dates: {row.evidence.dates.join(', ')}. Average daily sales {row.evidence.average.toFixed(2)}; recent average {row.evidence.recent.toFixed(2)}; forecast {row.evidence.expectedDemand.toFixed(2)}. Configured coverage is the baseline, scaled by the observed trend.</p></details><button type="button" className={`${button} mt-2`} disabled={blocked || busy || !row.needed || row.needed > 20} onClick={() => onReview(row)}>Review forecast drafts</button>{row.needed > 20 && <p className="text-xs text-amber-200">Review large staffing changes in Schedule Builder; this action is limited to 20 drafts.</p>}</>}
    </article>)}
    <p className="text-xs text-slate-500">No automatic publishing or coverage-target changes.</p>
  </section>;
}

export function ClockReviewPanel({ report, onReview }) {
  if (!report.allowed) return null;
  return <section data-testid="time-clock-awareness" className={box}>
    <h3 className="font-black text-white">Time Clock awareness</h3>
    {!report.complete ? <p role="status" className="mt-2 text-xs text-amber-200">Clock review incomplete: {(report.reasons || []).join(' ')}</p> : report.findings.length ? report.findings.map(row => <div key={row.id} className="mt-2 text-xs text-slate-300"><strong>{row.employeeName}</strong>: {row.reason}</div>) : <p className="mt-2 text-xs text-slate-400">No open-punch exceptions in the verified 14-day window.</p>}
    {report.complete && report.reasons?.length>0 && <p role="status" className="mt-2 text-xs text-amber-200">Attendance coverage: {report.reasons.join(' ')}</p>}
    <button type="button" className={`${button} mt-3`} onClick={onReview}>Review Time Clock</button>
    <p className="mt-2 text-xs text-slate-500">Manager review only. Punches and payroll are never changed by these findings.</p>
  </section>;
}

export function HistorySourceReview({history,sources}) {
  return <section data-testid="history-source-review" className="mt-3 space-y-2">
    <p className="text-xs text-slate-400">Load the 180-day history one page at a time. Coverage stays incomplete until the source finishes; undated records and scan limits remain visible.</p>
    {sources.map(({key,label})=>{const source=history.sources[key];return <div key={key} className={box}><p className="text-xs text-slate-300">{label}: {source ? `${source.data?.length || 0} records · ${source.scanned || 0} scanned · ${source.complete?'Window verified':'Coverage incomplete'}`:'Not loaded'}</p>{source?.undated>0 && <p className="text-xs text-amber-200">{source.undated} records have no usable timestamp.</p>}{source?.truncated && <p className="text-xs text-amber-200">The scan limit was reached. This window cannot be called complete.</p>}{source?.error && <p role="alert" className="text-xs text-amber-200">{source.error}</p>}<button type="button" className={`${button} mt-2`} disabled={history.loading || source?.truncated} onClick={()=>history.load(key,Boolean(source?.resolved && !source?.nextCursor && !source?.error))}>{source?.resolved && !source?.nextCursor && !source?.error?`Refresh ${label.toLowerCase()}`:source?.error?`Retry ${label.toLowerCase()}`:source?.nextCursor?`Load more ${label.toLowerCase()}`:`Load ${label.toLowerCase()}`}</button></div>;})}
    {history.loading && <p role="status" className="text-xs text-slate-400">Loading historical evidence…</p>}
  </section>;
}

export function AttendancePolicyReview({appUser,policy,workspaceTimeZone,onSaved}) {
  const [draft,setDraft]=useState({enabled:policy?.enabled===true,graceMinutes:policy?.graceMinutes ?? 5,maxOpenBreakMinutes:policy?.maxOpenBreakMinutes ?? 30,timeZone:policy?.timeZone || workspaceTimeZone || 'America/Chicago'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[savedPolicy,setSavedPolicy]=useState(policy);
  const save=async()=>{setBusy(true);setError('');try{const response=await secureFetch('/api/safe-write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId:appUser.restaurantId,action:'attendance-policy-approve',approved:true,policy:draft,expectedApprovedAt:savedPolicy?.approvedAt || ''})});const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || 'Policy was not saved.');setSavedPolicy(result.policy);onSaved(result.policy);}catch(problem){setError(problem.message);}finally{setBusy(false);}};
  return <section data-testid="attendance-policy-review" className={box}><h4 className="font-bold text-white">Attendance review policy</h4><p className="mt-2 text-xs text-slate-400">Review thresholds flag records for a manager. They do not determine misconduct or change pay. Save explicitly to enable or change attendance checks.</p><label className="min-h-[44px] flex gap-2 items-center text-xs text-slate-300"><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})}/>Enable shift/punch attendance review</label><div className="space-y-2 text-xs text-slate-300">{[['graceMinutes','Start/end grace minutes'],['maxOpenBreakMinutes','Open-break review minutes'],['timeZone','Workspace attendance timezone']].map(([key,label])=><label className="block" key={key}>{label}<input aria-label={label} className="w-full min-h-[44px] bg-[#0B0E11] p-2 rounded-lg" type={key==='timeZone'?'text':'number'} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/></label>)}</div><button className={`${button} mt-3`} disabled={busy} type="button" onClick={save}>{busy?'Saving policy…':'Approve attendance review policy'}</button>{error && <p role="alert" className="text-xs text-amber-200 mt-2">{error}</p>}</section>;
}

export function TrainingFollowUpPanel({rows}) {
  return <section data-testid="training-follow-up" className={box}><h4 className="font-bold text-white">Operational training follow-up</h4>{!rows.length?<p className="mt-2 text-xs text-slate-400">No evidence-linked assignments are loaded.</p>:rows.slice(0,10).map(row=><article key={row.id} className="mt-3 text-xs text-slate-300"><strong>{row.employeeName}</strong><p>{row.completed}/{row.total} checklist items complete{row.completedAt?` · ${row.observedDays} observed days since completion`:''}.</p><p className="mt-1 text-slate-400">{row.reason}</p><p className="mt-1 text-slate-500">{row.evidenceIds.length} source records · {row.repeatedEvidenceIds.length} later matching records.</p></article>)}</section>;
}

export function TrainingReviewPanel({ opportunities, allowed, onReview }) {
  return <div data-testid="operational-training-review" className="space-y-2 mt-2">
    {opportunities.slice(0,4).map(row => <article key={row.id} className={box}>
      <h4 className="text-sm font-black text-white">{row.title}</h4><p className="mt-1 text-xs text-slate-400">{row.reason}</p>
      <p className="mt-1 text-xs text-slate-500">Roles: {(row.roleScope || []).join(', ')} · {row.evidenceIds.length} evidence record(s).</p>
      {allowed && <button type="button" className={`${button} mt-2`} onClick={() => onReview(row)}>Review training checklist</button>}
    </article>)}
    {!allowed && opportunities.length > 0 && <p className="text-xs text-slate-500">HR permission is required to review assignments.</p>}
  </div>;
}

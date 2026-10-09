import React from 'react';

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
    <button type="button" className={`${button} mt-3`} onClick={onReview}>Review Time Clock</button>
    <p className="mt-2 text-xs text-slate-500">Manager review only. Punches and payroll are never changed by these findings.</p>
  </section>;
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

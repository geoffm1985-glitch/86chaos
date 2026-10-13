import React, { useEffect, useRef, useState } from 'react';
import { T, downloadCsvRows } from '../core/appCore';
import { operationalReviewBoundary } from '../core/workspaceContext';
import { invoiceReviewRequest } from './InvoiceReviewTools';

export function FoodSafetyAuditReview(props) {
  return <FoodSafetyAuditWorkspace key={operationalReviewBoundary(props.appUser)} {...props}/>;
}
function FoodSafetyAuditWorkspace({ appUser }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today), [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [followUpLogId, setFollowUpLogId] = useState(''), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false);
  const alive = useRef(true), active = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async work => { if (active.current) return; active.current = true; setBusy(true); setError(''); try { await work(); } catch (problem) { if (alive.current) setError(problem.message); } finally { active.current = false; if (alive.current) setBusy(false); } };
  const load = after => run(async () => {
    const result = await invoiceReviewRequest(appUser, { action: 'food-safety-export', startDate, endDate, cursor: after });
    if (alive.current) setReport(previous => ({ ...result, rows: after ? [...previous.rows, ...result.rows] : result.rows }));
  });
  const close = () => run(async () => {
    const result = await invoiceReviewRequest(appUser, { action: 'food-safety-close', logId: selected.id, expectedTimestamp: selected.timestamp, followUpLogId, note, confirmed });
    if (alive.current) { setReport(previous => ({ ...previous, rows: previous.rows.map(row => row.id === selected.id ? { ...row, closure: result.closure, integrity: 'verified' } : row) })); setSelected(null); }
  });
  const changeWindow = (setter, value) => { setter(value); setReport(null); setSelected(null); };
  const exportRows = () => downloadCsvRows(`86chaos-food-safety-${startDate}-${endDate}.csv`, [
    ['Record ID','Date','Item','Location','Temperature F','Result','Corrective action','Notes','Logged by','Logged at','Closure status','Closed by','Closed at','Follow-up record','Verification note','Integrity'],
    ...report.rows.map(row => [row.id,row.date,row.itemName,row.location,row.temp ?? '',row.status,row.correctiveAction,row.notes,row.loggedBy,row.timestamp,row.closure?.status || 'open',row.closure?.closedBy || '',row.closure?.closedAt || '',row.closure?.followUpLogId || '',row.closure?.note || '',row.integrity])
  ]);
  return <section data-testid="food-safety-audit" className={`${T.card} p-4 space-y-3`}>
    <h3 className="font-black text-white">Food safety audit and closure</h3>
    <p className="text-xs text-slate-400">Review up to 31 days. Closure preserves the original reading and requires a later safe check for the same item. Review all pages before exporting.</p>
    <div className="flex flex-wrap gap-2"><label>Audit start date<input aria-label="Audit start date" type="date" disabled={busy} value={startDate} onChange={e => changeWindow(setStartDate,e.target.value)} className={T.input}/></label><label>Audit end date<input aria-label="Audit end date" type="date" disabled={busy} value={endDate} onChange={e => changeWindow(setEndDate,e.target.value)} className={T.input}/></label></div>
    <button type="button" disabled={busy} onClick={() => load(null)} className={T.btnAlt}>Load food safety audit</button>
    {report && <><p role="status">{report.rows.length} records loaded · {report.complete ? 'Window fully loaded' : 'More evidence remains'}</p>{report.rows.map(row => <article key={row.id} className="text-xs border-t border-slate-700 pt-2 space-y-1"><strong>{row.itemName} · {row.temp == null ? row.result : `${row.temp}°F`} · {row.status}</strong><p>{row.timestamp} · {row.correctiveAction || 'No corrective action recorded'}</p><p>Record {row.id} · {row.integrity}</p>{row.closure ? <p>Closed {row.closure.closedAt}: {row.closure.note}</p> : row.status === 'Attention' && <button type="button" disabled={busy} className={T.btnAlt} onClick={() => { setSelected(row); setFollowUpLogId(''); setNote(''); setConfirmed(false); }}>Review closure for {row.itemName}</button>}</article>)}{report.nextCursor && <button type="button" disabled={busy} className={T.btnAlt} onClick={() => load(report.nextCursor)}>Load more audit records</button>}<button type="button" disabled={busy || !report.complete} className={T.btnAlt} onClick={exportRows}>Export complete food safety audit CSV</button></>}
    {selected && <fieldset className="space-y-2 border border-amber-800 p-3"><legend>Close attention record for {selected.itemName}</legend><label>Later safe check<select aria-label="Later safe check" disabled={busy} value={followUpLogId} onChange={e => { setFollowUpLogId(e.target.value); setConfirmed(false); }} className={T.input}><option value="">Select verified follow-up</option>{(report?.rows || []).filter(row => row.itemId === selected.itemId && row.status === 'Safe' && Date.parse(row.timestamp) > Date.parse(selected.timestamp)).map(row => <option key={row.id} value={row.id}>{row.timestamp} · {row.temp ?? row.result}</option>)}</select></label><label>Manager closure note<textarea aria-label="Manager closure note" maxLength={1000} disabled={busy} value={note} onChange={e => { setNote(e.target.value); setConfirmed(false); }} className={T.input}/></label><label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I verified the corrective action and follow-up check.</label><button type="button" className={T.btn} disabled={busy || !confirmed || !followUpLogId || note.trim().length < 4} onClick={close}>Save reviewed closure</button><button type="button" disabled={busy} className={T.btnAlt} onClick={() => setSelected(null)}>Cancel closure</button></fieldset>}
    {busy && <p role="status">Loading food safety evidence…</p>}{error && <p role="alert">{error}</p>}
  </section>;
}

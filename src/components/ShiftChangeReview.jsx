import React, { useEffect, useRef, useState } from 'react';
import { secureFetch, T } from '../core/appCore';
import { operationalReviewBoundary } from '../core/workspaceContext';

export function ShiftChangeReview(props) {
  return <ShiftChangeWorkspace key={`${operationalReviewBoundary(props.appUser)}|${Boolean(props.workspaceReview)}`} {...props}/>;
}
function ShiftChangeWorkspace({ appUser, workspaceReview = false }) {
  const [rows, setRows] = useState([]), [cursor, setCursor] = useState(null), [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), request = useRef(null), active = useRef(false);
  const canManage = Boolean(appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.isSuperAdmin || appUser?.permissions?.schedule || appUser?.permissions?.team);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  const call = async payload => {
    request.current = new AbortController();
    const response = await secureFetch('/api/safe-write', { method: 'POST', signal: request.current.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, restaurantId: appUser.restaurantId }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Published shift review could not be loaded.');
    return result;
  };
  const run = async work => {
    if (active.current) return;
    active.current = true; setBusy(true); setError('');
    try { await work(); } catch (problem) { if (alive.current) setError(problem.message); }
    finally { active.current = false; if (alive.current) setBusy(false); }
  };
  const load = after => run(async () => {
    const result = await call({ action: 'shift-change-list', scope: workspaceReview ? 'workspace' : 'self', cursor: after });
    if (alive.current) { setRows(previous => after ? [...previous, ...result.rows] : result.rows); setCursor(result.nextCursor); setLoaded(true); }
  });
  const acknowledge = row => run(async () => {
    const result = await call({ action: 'shift-change-acknowledge', version: row.version, confirmed: true });
    if (alive.current) setRows(previous => previous.map(item => item.version === row.version ? { ...item, acknowledgments: { ...item.acknowledgments, [appUser.authUid || appUser.uid || appUser.id]: result.acknowledgedAt } } : item));
  });
  if (!appUser?.restaurantId || appUser.demoMode || appUser.isDemo || (workspaceReview && !canManage)) return null;
  const uid = appUser.authUid || appUser.uid || appUser.id;
  return <section className={`${T.card} p-4 space-y-3`} data-testid="published-shift-changes">
    <h3 className="font-black text-white">{workspaceReview ? 'Published shift change evidence' : 'Review published shift changes'}</h3>
    <p className="text-xs text-slate-400">Acknowledgment confirms that you reviewed this published version. It does not approve a pay adjustment or determine an attendance penalty.</p>
    <button type="button" disabled={busy} className={T.btnAlt} onClick={() => load(null)}>{loaded ? 'Refresh published changes' : 'Load published changes'}</button>
    {loaded && !rows.length && <p role="status">No published changes are recorded in this page.</p>}
    {rows.map(row => <article key={row.version} className="border-t border-slate-700 pt-3 text-xs space-y-2">
      {row.after.cancelled && <p className="text-amber-200 font-bold">Published shift cancelled</p>}
      <strong>{row.after.date} · {row.after.startTime}–{row.after.endTime} · {row.after.role} · {row.after.employeeName || 'Open shift'}</strong>
      <p>Published {row.publishedAt}. {row.current ? 'Current published version' : 'Superseded publication'}.</p>
      {row.before && <p>Previously: {row.before.date} · {row.before.startTime}–{row.before.endTime} · {row.before.role} · {row.before.employeeName || 'Open shift'}</p>}
      <p>Changed: {row.changedFields.join(', ')}.</p>
      {workspaceReview ? <><p>{Object.keys(row.acknowledgments || {}).length}/{row.recipientUids.length} employee acknowledgments.</p><p>Push status: {row.notification?.state}. Provider acceptance does not prove delivery.</p></> : row.acknowledgments?.[uid] ? <p role="status">Acknowledged {row.acknowledgments[uid]}</p> : row.current && <button type="button" disabled={busy} className={T.btn} onClick={() => acknowledge(row)}>I reviewed this published shift</button>}
    </article>)}
    {cursor && <button type="button" disabled={busy} className={T.btnAlt} onClick={() => load(cursor)}>Load more published changes</button>}
    {busy && <p role="status">Loading published shift evidence…</p>}{error && <p role="alert">{error}</p>}
  </section>;
}

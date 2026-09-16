import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { T, secureFetch } from '../core/appCore';

async function responseJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.message || 'The Shift4 request failed safely.');
  return payload;
}

export default function Shift4IntegrationPanel({ restaurantId, initialProvider = '', onSaveProvider, addToast }) {
  const [provider, setProvider] = useState(initialProvider || '');
  const [status, setStatus] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [latest, setLatest] = useState(null);
  const [records, setRecords] = useState([]);
  const [reviewPage, setReviewPage] = useState(null);
  const [busy, setBusy] = useState('');
  const isShift4 = provider === 'shift4';
  const selected = useMemo(() => locations.find(location => String(location.id) === String(selectedLocationId)), [locations, selectedLocationId]);

  useEffect(() => { setProvider(initialProvider || ''); }, [initialProvider]);

  const run = useCallback(async (label, action) => {
    setBusy(label);
    try { return await action(); }
    catch (error) { addToast?.('Shift4', error.message || 'The request failed safely.'); return null; }
    finally { setBusy(''); }
  }, [addToast]);

  const loadStatus = useCallback(() => run('status', async () => {
    const payload = await responseJson(await secureFetch(`/api/shift4-status?restaurantId=${encodeURIComponent(restaurantId)}`));
    setStatus(payload);
    if (payload.selectedLocation?.id) setSelectedLocationId(String(payload.selectedLocation.id));
    if (payload.suggestedYesterday) { setFrom(current => current || payload.suggestedYesterday); setTo(current => current || payload.suggestedYesterday); }
    return payload;
  }), [restaurantId, run]);

  useEffect(() => { if (isShift4 && restaurantId) loadStatus(); }, [isShift4, restaurantId, loadStatus]);

  const saveProvider = () => run('save', async () => {
    await onSaveProvider(provider);
    addToast?.('Provider Saved', provider === 'shift4' ? 'Shift4 Dine selected. OAuth credentials remain server-only.' : 'Provider note saved. No POS secret was stored.');
  });
  const connect = () => run('connect', async () => {
    const payload = await responseJson(await secureFetch('/api/shift4-connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId }) }));
    window.location.assign(payload.authorizationUrl);
  });
  const testConnection = () => run('test', async () => {
    const payload = await responseJson(await secureFetch('/api/shift4-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId }) }));
    setStatus(current => ({ ...(current || {}), state: payload.state }));
    addToast?.('Shift4', payload.message);
  });
  const loadLocations = () => run('locations', async () => {
    const payload = await responseJson(await secureFetch(`/api/shift4-locations?restaurantId=${encodeURIComponent(restaurantId)}`));
    setLocations(payload.locations || []);
  });
  const saveLocation = () => run('location', async () => {
    if (!selectedLocationId) throw new Error('Choose a Shift4 Dine location.');
    const payload = await responseJson(await secureFetch('/api/shift4-select-location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, locationId: selectedLocationId }) }));
    setStatus(current => ({ ...(current || {}), selectedLocation: payload.selectedLocation, state: 'connected' }));
    addToast?.('Shift4 Location', `${payload.selectedLocation.name} selected.`);
  });
  const importRange = (requestedFrom = from, requestedTo = to) => run('import', async () => {
    const payload = await responseJson(await secureFetch('/api/shift4-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId, from: requestedFrom, to: requestedTo }) }));
    setLatest(payload.summary); setRecords(payload.preview?.records || []); setReviewPage(null);
    addToast?.('Shift4 Import', payload.summary?.status !== 'complete' ? 'Incomplete/unverified source data was saved for review and was not marked complete.' : 'Read-only Shift4 import completed for review.');
  });
  const importYesterday = () => { const day = status?.suggestedYesterday; if (!day) return addToast?.('Shift4', 'Select a verified location so Yesterday can be calculated in its timezone.'); setFrom(day); setTo(day); return importRange(day, day); };
  const loadReview = (cursor = '') => run('review', async () => {
    if (!from || !to) throw new Error('Choose the review date range.');
    const payload = await responseJson(await secureFetch(`/api/shift4-records?restaurantId=${encodeURIComponent(restaurantId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`));
    setRecords(current => cursor ? [...current, ...(payload.records || [])] : (payload.records || [])); setReviewPage(payload.page); return payload;
  });
  const exportRange = format => run(`export-${format}`, async () => {
    const response = await secureFetch(`/api/shift4-export?restaurantId=${encodeURIComponent(restaurantId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=${format}`);
    if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.message || 'Export failed safely.'); }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `86chaos-shift4-${from}-to-${to}.${format}`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  return <div className={`${T.card} p-4 sm:p-5 border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.05)] space-y-4`} data-testid="pos-integration-panel">
    <div className="border-b border-[#2A353D] pb-2">
      <h2 className="text-base font-black text-blue-400">Point of Sale (POS) Sync</h2>
      <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Controlled provider setup and review-first imports. No POS import posts automatically to restaurant operations.</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
      <div><label className={T.label}>POS Provider</label><select aria-label="POS Provider" value={provider} onChange={event => setProvider(event.target.value)} className={T.input}>
        <option value="">None / Manual Entry</option><option value="Square">Square</option><option value="Toast">Toast</option><option value="Clover">Clover</option><option value="TouchBistro">TouchBistro</option><option value="shift4">Shift4 Dine</option>
      </select></div>
      <button type="button" className={T.btnAlt} disabled={!!busy} onClick={saveProvider}>{busy === 'save' ? 'Saving…' : 'Save Provider'}</button>
    </div>
    {!isShift4 && <div className="p-3 rounded-xl border border-amber-900/40 bg-amber-950/20 text-[10px] font-bold text-amber-100">Provider selection is a planning note only. Live credentials and webhook automation are not enabled for this provider.</div>}
    {isShift4 && <div className="space-y-4" data-testid="shift4-controls">
      <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Read-only Shift4 Dine bridge</div>
        <p className="text-xs text-emerald-50 mt-1">86 Chaos can read authorized Shift4 sales data, but it does not send operational changes back to Shift4.</p>
        <p className="text-[10px] text-emerald-100/80 mt-1">Imported POS data is for review and does not automatically change inventory, accounting, scheduling, payroll, Daily Close, or orders.</p>
      </div>
      <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 text-[10px] font-bold text-amber-100">Pilot boundary: the published Shift4 ticket-retrieve contract does not currently provide 86 Chaos a verified endpoint-specific completion signal. Imports are preserved as incomplete review data until Shift4 confirms the contract.</div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl"><div className={T.label}>Connection Status</div><div className="text-sm font-black text-white" data-testid="shift4-status">{status?.state || 'Not checked'}</div><div className="text-[10px] text-slate-400 mt-1">{status?.configured === false ? 'Server environment setup is incomplete.' : status?.selectedLocation?.name || 'No Shift4 Dine location selected.'}</div></div>
        <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl"><div className={T.label}>Last Successful Import</div><div className="text-xs font-bold text-white">{status?.lastSuccessfulImportAt ? new Date(status.lastSuccessfulImportAt).toLocaleString() : 'None yet'}</div><div className="text-[10px] text-slate-400 mt-1">Latest: {latest?.status || status?.latestImportStatus?.status || 'No import'}</div></div>
      </div>
      <div className="grid sm:grid-cols-3 gap-2"><button type="button" className={T.btn} disabled={!!busy} onClick={connect}>{status?.state === 'connected' ? 'Reconnect Shift4' : 'Connect Shift4'}</button><button type="button" className={T.btnAlt} disabled={!!busy} onClick={testConnection}>Test Connection</button><button type="button" className={T.btnAlt} disabled={!!busy} onClick={loadLocations}>Load Locations</button></div>
      {locations.length > 0 && <div><label className={T.label}>Verified Shift4 Dine Location</label><div className="grid sm:grid-cols-[1fr_auto] gap-2"><select aria-label="Shift4 location" className={T.input} value={selectedLocationId} onChange={event => setSelectedLocationId(event.target.value)}><option value="">Choose location…</option>{locations.map(location => <option key={location.id} value={location.id} disabled={location.supportStatus !== 'supported'}>{location.name} — {location.supportStatus}</option>)}</select><button type="button" className={T.btnAlt} disabled={!!busy || selected?.supportStatus !== 'supported'} onClick={saveLocation}>Save Location</button></div>{selected && <p className="text-[10px] text-slate-400 mt-1">{selected.supportReason}</p>}</div>}
      <div className="grid sm:grid-cols-2 gap-2"><div><label className={T.label}>From</label><input aria-label="Shift4 import from" type="date" value={from} onChange={event => setFrom(event.target.value)} className={T.input}/></div><div><label className={T.label}>To (7-day maximum)</label><input aria-label="Shift4 import to" type="date" value={to} onChange={event => setTo(event.target.value)} className={T.input}/></div></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2"><button type="button" className={T.btnAlt} disabled={!!busy || !status?.suggestedYesterday} onClick={importYesterday}>Import Yesterday</button><button type="button" className={T.btn} disabled={!!busy || !from || !to} onClick={() => importRange()}>{busy === 'import' ? 'Importing…' : 'Import from Shift4'}</button><button type="button" className={T.btnAlt} disabled={!!busy || !from || !to} onClick={() => loadReview()}>Review Stored Data</button><button type="button" className={T.btnAlt} disabled={!!busy || !from || !to} onClick={() => exportRange('csv')}>Export CSV</button><button type="button" className={T.btnAlt} disabled={!!busy || !from || !to} onClick={() => exportRange('json')}>Export JSON</button></div>
      {latest && <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl text-xs text-slate-300" data-testid="shift4-import-summary"><span className="font-black text-white uppercase">{latest.status}</span> · {latest.rawSourceRowsReceived} raw tickets · {latest.uniqueTicketsRetained} unique tickets · {latest.normalizedRecords} review rows · {latest.inserted} inserted · {latest.updated} updated · {latest.unchanged} unchanged · {latest.normalizationRejected} normalization rejected</div>}
      {records.length > 0 && <div><div className="text-[10px] font-bold text-slate-400 mb-1">Review preview/page: {records.length} rows loaded. {reviewPage?.hasMore ? 'More stored rows are available.' : reviewPage ? 'End of stored range.' : 'Import response is limited to the first 100 normalized rows.'}</div><div className="overflow-x-auto max-h-64"><table className="w-full text-xs"><thead><tr>{['Date','Type','Ticket / item','Qty','Net cents','Review'].map(label => <th className={T.th} key={label}>{label}</th>)}</tr></thead><tbody>{records.map((record, index) => <tr key={`${record.providerLocationId}|${record.recordType}|${record.sourceParentId || ''}|${record.sourceRecordId}|${index}`}><td className={T.row}>{record.businessDate}</td><td className={T.row}>{record.recordType}</td><td className={T.row}>{record.menuItemName || record.orderNumber || record.sourceRecordId}</td><td className={T.row}>{record.quantity ?? ''}</td><td className={T.row}>{record.netAmountCents ?? ''}</td><td className={T.row}>Draft only</td></tr>)}</tbody></table></div>{reviewPage?.hasMore && <button type="button" className={`${T.btnAlt} mt-2`} disabled={!!busy} onClick={() => loadReview(reviewPage.nextCursor)}>Load Next 100</button>}</div>}
      <div className="p-3 rounded-xl border border-slate-700 bg-slate-900/30 text-[10px] font-bold text-slate-300">Webhook automation is deferred. Manual imports work without a webhook, and 86 Chaos does not present an unverified POS webhook URL.</div>
    </div>}
  </div>;
}

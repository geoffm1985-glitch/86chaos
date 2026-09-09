import React, { useState } from 'react';
import { T, secureFetch } from '../core/appCore';
import restaurantPackHelpers from '../core/restaurantPack.js';

const { resolveInvoiceQuantity } = restaurantPackHelpers;

export async function invoiceReviewRequest(user, payload) {
  if (user?.demoMode || user?.isDemo) throw new Error('Demo mode cannot access live invoice approvals or product memory.');
  const response = await secureFetch('/api/safe-write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, restaurantId: user?.restaurantId }) });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.error || 'Invoice review could not be saved.');
  return result;
}

export function InvoiceRowReview({ row, inventoryItem, onChange, onResearch }) {
  const quantity = resolveInvoiceQuantity(row, inventoryItem || {});
  const review = row.matchNeedsReview || quantity.needsReview;
  const canConfirm = row.reviewedStockQuantity !== '' && row.reviewedStockQuantity != null && row.reviewedStockUnitCost !== '' && row.reviewedStockUnitCost != null && String(row.reviewNote || '').trim().length >= 4;
  return <div className="space-y-2 text-xs">
    <p className={review ? 'text-amber-200' : 'text-emerald-200'}>{row.matchExplanation || quantity.reasons.join(' ') || 'Review the selected product and received quantity before approval.'}</p>
    {review && <div className="rounded-lg border border-amber-800 p-2 space-y-2">
      <div className="font-bold">Confirm actual delivery in inventory units ({quantity.stockUnit || 'case'})</div>
      <div className="grid grid-cols-2 gap-2">
        <label>Received stock units<input aria-label="Reviewed stock quantity" type="number" min="0" step="any" value={row.reviewedStockQuantity ?? ''} onChange={e => onChange({ reviewedStockQuantity: e.target.value, quantityConfirmed: false })} className={T.input}/></label>
        <label>Cost per stock unit<input aria-label="Reviewed stock unit cost" type="number" min="0" step="any" value={row.reviewedStockUnitCost ?? ''} onChange={e => onChange({ reviewedStockUnitCost: e.target.value, quantityConfirmed: false })} className={T.input}/></label>
      </div>
      <label className="block">Confirmed package<input aria-label="Reviewed package size" value={row.reviewedPackSize ?? row.packSize ?? ''} onChange={e => onChange({ reviewedPackSize: e.target.value, quantityConfirmed: false })} className={T.input}/></label>
      <label className="block">What did you verify?<input aria-label="Invoice review note" maxLength={240} placeholder="Actual weight, split case, substitution, or corrected match" value={row.reviewNote || ''} onChange={e => onChange({ reviewNote: e.target.value, quantityConfirmed: false })} className={T.input}/></label>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={row.quantityConfirmed === true} disabled={!canConfirm} onChange={e => onChange({ quantityConfirmed: e.target.checked })}/>I verified this product, quantity, and cost.</label>
    </div>}
    {onResearch && review && <button type="button" onClick={onResearch} className={T.btnAlt}>Find product evidence</button>}
    {row.researchEvidence && <div className="rounded border border-slate-700 p-2">
      <p>{row.researchEvidence.reason || 'Public evidence is advisory and still needs review.'}</p>
      {(row.researchEvidence.products || []).map((product, index) => <p key={index} className="mt-1"><a href={product.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-300 underline">{product.name}</a> {product.brands} {product.package || ''}</p>)}
    </div>}
  </div>;
}

export function VendorMemoryPanel({ appUser, vendors, inventoryItems, addToast }) {
  const [vendorId, setVendorId] = useState(''); const [rows, setRows] = useState([]); const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false); const [edit, setEdit] = useState(null);
  const load = async (id, after = null) => {
    if (!id) return;
    setBusy(true);
    try { const result = await invoiceReviewRequest(appUser, { action: 'vendor-memory-list', vendorId: id, cursor: after }); setRows(previous => after ? [...previous, ...result.mappings] : result.mappings); setCursor(result.nextCursor); }
    catch (error) { addToast('Product Memory', error.message); } finally { setBusy(false); }
  };
  const save = async (row, revoke = false) => {
    setBusy(true);
    try {
      const result = await invoiceReviewRequest(appUser, { action: revoke ? 'vendor-memory-revoke' : 'vendor-memory-edit', vendorId, mappingId: row.id,
        expectedApprovedAt: row.approvedAt, inventoryItemId: row.inventoryItemId, packSize: row.approvedPackSize, purchaseUnit: row.purchaseUnit });
      setRows(previous => previous.map(existing => existing.id === row.id ? result.mapping || { ...existing, active: !revoke } : existing)); setEdit(null);
      addToast('Product Memory', revoke ? 'Mapping revoked. Future scans require a fresh review.' : 'Approved mapping saved.');
    } catch (error) { addToast('Product Memory', error.message); } finally { setBusy(false); }
  };
  return <section className={`${T.card} p-4 space-y-3`}>
    <h3 className="font-black text-white">Learned vendor products</h3>
    <p className="text-xs text-slate-400">Review, correct, or revoke matches learned from approved invoices. Changed packages still require review.</p>
    <select aria-label="Product memory vendor" value={vendorId} disabled={busy} onChange={e => { setVendorId(e.target.value); setRows([]); setEdit(null); setCursor(null); load(e.target.value); }} className={T.input}>
      <option value="">Choose vendor</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
    </select>
    {vendorId && !busy && !rows.length && <p className="text-xs text-slate-400">No learned mappings for this vendor yet.</p>}
    {rows.map(row => <div key={row.id} className="border-t border-slate-700 pt-2 text-xs space-y-2">
      <p className="font-bold text-white">{row.productCode || row.originalDescription} → {row.inventoryItemName} · {row.approvedPackSize} · {row.active ? 'Active' : 'Revoked'}</p>
      <p className="text-slate-400">Used on {row.useCount || 0} approved invoice rows. Last approved {String(row.approvedAt || '').slice(0, 10)}.</p>
      {edit?.id === row.id ? <div className="space-y-2">
        <select aria-label="Correct mapping item" className={T.input} value={edit.inventoryItemId} onChange={e => setEdit({ ...edit, inventoryItemId: e.target.value })}>{inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input aria-label="Correct mapping package" value={edit.approvedPackSize} onChange={e => setEdit({ ...edit, approvedPackSize: e.target.value })} className={T.input}/>
        <button type="button" disabled={busy} onClick={() => save(edit)} className={T.btn}>Approve correction</button> <button type="button" onClick={() => setEdit(null)} className={T.btnAlt}>Cancel</button>
      </div> : <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => setEdit({ ...row })} className={T.btnAlt}>Edit</button>{row.active && <button type="button" disabled={busy} onClick={() => save(row, true)} className={T.btnAlt}>Revoke</button>}</div>}
    </div>)}
    {cursor && <button type="button" disabled={busy} onClick={() => load(vendorId, cursor)} className={T.btnAlt}>Load more mappings</button>}
    {busy && <p className="text-xs text-slate-400">Loading…</p>}
  </section>;
}

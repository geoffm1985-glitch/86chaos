import React, { useState } from 'react';
import { T, useLiveCollection } from '../core/appCore';
import { invoiceReviewRequest } from './InvoiceReviewTools';
import { getBatchRecipeCost } from '../core/menuCosting';

export default function RecipeBatchCostEditor({ recipe, appUser, onSaved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [amount, setAmount] = useState(recipe.batchYieldQuantity || '');
  const [unit, setUnit] = useState(recipe.batchYieldUnit || 'fl oz');
  const [percent, setPercent] = useState(recipe.batchYieldPercent ?? 100);
  const inventory = useLiveCollection('inventoryItems', appUser?.restaurantId, { enabled: open, limitCount: 350 });
  const start = async () => {
    setBusy(true); setError('');
    try { const result = await invoiceReviewRequest(appUser, { action: 'recipe-costing-read', recipeId: recipe.id }); setRows(result.rows); setOpen(true); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const update = (index, patch) => setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  const save = async () => {
    setBusy(true); setError('');
    try {
      const result = await invoiceReviewRequest(appUser, { action: 'recipe-costing-approve', approved: true, recipeId: recipe.id,
        expectedApprovedAt: recipe.costingApprovedAt || '', rows, yieldQuantity: amount, yieldUnit: unit, yieldPercent: percent });
      onSaved?.({ ...recipe, costingApprovedAt: result.approvedAt, batchYieldQuantity: Number(amount), batchYieldUnit: unit, batchYieldPercent: Number(percent) });
      setOpen(false);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const previewRecipe = { ...recipe, costingApprovedAt: 'preview', costingDependencyIds: rows.map((_, i) => String(i)), batchYieldQuantity: amount, batchYieldUnit: unit, batchYieldPercent: percent };
  const cost = getBatchRecipeCost({ recipe: previewRecipe, inventoryItems: inventory, menuDependencies: rows.map((row, i) => ({ ...row, id: String(i), recipeId: recipe.id, source: 'approved_batch_recipe', status: 'approved' })) });
  return <section className="border border-[#2A353D] rounded-xl p-3 space-y-3">
    <button type="button" className={T.btnAlt} disabled={busy} onClick={() => open ? setOpen(false) : start()}>{open ? 'Close batch costing' : 'Review batch ingredients & yield'}</button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {open && <>
      <p className="text-xs text-slate-400">Enter one full batch. Usable yield accounts for waste or cooking loss. These quantities only affect costing after you approve them.</p>
      {rows.map((row, i) => <div key={i} className="flex flex-wrap gap-2">
        <select aria-label={`Batch ingredient ${i + 1}`} className={T.input} value={row.inventoryItemId || ''} onChange={e => update(i, { inventoryItemId: e.target.value })}><option value="">Choose inventory ingredient</option>{inventory.filter(item => item.inventorySourceType !== 'non_food_supply').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input aria-label={`Batch quantity ${i + 1}`} className={T.input} inputMode="decimal" placeholder="Quantity in full batch" value={row.batchQuantity ?? ''} onChange={e => update(i, { batchQuantity: e.target.value })}/>
        <input aria-label={`Batch unit ${i + 1}`} className={T.input} placeholder="lb, oz, fl oz, each" value={row.batchUnit || ''} onChange={e => update(i, { batchUnit: e.target.value })}/>
        <button type="button" className={T.btnAlt} onClick={() => setRows(rows.filter((_, index) => i !== index))}>Remove</button>
      </div>)}
      <button type="button" className={T.btnAlt} disabled={rows.length >= 80} onClick={() => setRows([...rows, { inventoryItemId: '', batchQuantity: '', batchUnit: '' }])}>Add batch ingredient</button>
      <label className={T.label}>Finished batch yield<input className={T.input} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}/></label>
      <label className={T.label}>Yield unit<input className={T.input} value={unit} onChange={e => setUnit(e.target.value)}/></label>
      <label className={T.label}>Usable yield %<input className={T.input} type="number" min="0.01" max="100" value={percent} onChange={e => setPercent(e.target.value)}/></label>
      <p className="text-sm text-[#D4A381]">{cost.ready ? `Review preview: $${cost.totalCost.toFixed(2)} per batch; $${cost.unitCost.toFixed(4)} per ${cost.unit}.` : 'Cost needs review: check package units, ingredient costs, and usable yield.'}</p>
      <button type="button" className={T.btn} disabled={busy || !rows.length} onClick={save}>Approve batch costing</button>
    </>}
  </section>;
}

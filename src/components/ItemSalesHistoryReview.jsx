import {reviewedServingConversion} from '../core/operationalEvidence';
import React,{useState} from 'react';
import { hasAnyPermission,secureFetch } from '../core/appCore';

// RFC-style quoted fields and escaped quotes, bounded before parsing.
export function parseItemSalesCsv(value) {
  if(value.length>200000)throw new Error('Use a CSV smaller than 200 KB.');
  const records=[],row=[];let cell='',quoted=false;
  for(let i=0;i<=value.length;i++) {
    const char=value[i];
    if(char==='"') {if(quoted && value[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted && (char===',' || char==='\n' || char===undefined)) {row.push(cell.trim());cell='';if(char!==','){if(row.some(Boolean))records.push([...row]);row.length=0;}}
    else if(char!=='\r')cell+=char;
  }
  if(quoted)throw new Error('A quoted CSV field is unfinished.');
  const headers=(records.shift() || []).map(key=>key.toLowerCase());
  const required=['date','item','quantity','sourceid','lineid'];
  if(required.some(key=>!headers.includes(key)))throw new Error('CSV headers must include date,item,quantity,sourceId,lineId.');
  if(!records.length || records.length>200)throw new Error('Review between 1 and 200 rows per import.');
  return records.map(cells=>{if(cells.length!==headers.length)throw new Error('CSV rows must have the same columns as the header.');const values=Object.fromEntries(headers.map((key,index)=>[key,cells[index]]));const quantity=values.quantity==='' ? NaN : Number(values.quantity);if(!Number.isFinite(quantity) || quantity<0 || quantity>100000)throw new Error('Quantities must be non-negative numbers. Keep refunds separate.');return {businessDate:values.date,itemName:values.item,quantity,sourceId:values.sourceid,lineId:values.lineid,recipeId:''};});
}
export default function ItemSalesHistoryReview({appUser,recipes,onImported,addToast}) {
  const [open,setOpen]=useState(false),[csv,setCsv]=useState(''),[rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  if(appUser?.demoMode || appUser?.isDemo || !hasAnyPermission(appUser,['sales','salesEdit','financialEdit']))return null;
  const soldRecipes=recipes.filter(recipe=>recipe.restaurantId===appUser.restaurantId);
  const bulkRecipe = row => soldRecipes.find(recipe=>recipe.id===row.recipeId && !reviewedServingConversion(recipe).ready);
  const conversionReady = row => reviewedServingConversion(soldRecipes.find(recipe=>recipe.id===row.recipeId),row.servingConversion || {}).ready;
  const updateConversion = (index,patch) => setRows(previous=>previous.map((row,i)=>i===index?{...row,servingConversion:{...row.servingConversion,...patch}}:row));
  const preview=()=>{try{setRows(parseItemSalesCsv(csv).map(row=>{const matches=soldRecipes.filter(recipe=>String(recipe.title || recipe.name || '').trim().toLowerCase()===row.itemName.toLowerCase());return {...row,recipeId:matches.length===1?matches[0].id:''};}));setError('');}catch(problem){setRows([]);setError(problem.message);}};
  const approve=async()=>{
    if(busy || !rows.length || rows.some(row=>!row.recipeId || !conversionReady(row)))return;setBusy(true);setError('');
    try {
      const response=await secureFetch('/api/demand-history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({restaurantId:appUser.restaurantId,action:'import',approved:true,rows:rows.map(({itemName,...row})=>row)})});const result=await response.json();if(!response.ok || !result.ok)throw new Error(result.error || 'History was not saved.');
      addToast('Item Sales History Saved',`${result.imported} new rows; ${result.duplicates} unchanged source lines.`);setRows([]);setCsv('');onImported();
    } catch(problem) {setError(problem.message);}finally{setBusy(false);}
  };
  return <div data-testid="item-sales-history-review" className="mt-3 border-t border-[#2A353D] pt-3">
    <button type="button" className="min-h-[44px] text-xs font-bold text-[#E6BB9F]" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>Review item sales history</button>
    {open && <div className="space-y-3 text-xs text-slate-300"><p>Paste an item-sales CSV from your reviewed source. Match each item to a recipe before approving. Imports only record demand history; they do not change Daily Close, stock, orders, or POS processing.</p><p>Required columns: date,item,quantity,sourceId,lineId. Use stable receipt/source and line IDs so retries cannot duplicate demand. Quantities are sold servings; For bulk recipes, review sold servings per usable batch against the displayed recipe yield.</p><textarea aria-label="Item sales CSV" rows={5} value={csv} onChange={event=>{setCsv(event.target.value);setRows([]);}} className="w-full rounded-lg bg-[#0B0E11] border border-[#2A353D] p-2"/><button type="button" onClick={preview} disabled={busy} className="min-h-[44px] rounded-lg border border-[#D4A381]/40 px-3">Preview and match rows</button>{error && <p role="alert" className="text-amber-200">{error}</p>}
    <div className="max-h-80 overflow-auto space-y-2">{rows.map((row,index)=><div key={index} className="rounded-lg border border-[#2A353D] p-2"><p>{row.businessDate} · {row.itemName} · {row.quantity} servings</p><select aria-label={`Recipe for sales row ${index+1}`} value={row.recipeId} onChange={event=>setRows(previous=>previous.map((item,i)=>i===index?{...item,recipeId:event.target.value,servingConversion:null}:item))} className="mt-2 w-full min-h-[44px] bg-[#0B0E11] p-2"><option value="">Select the sold-item recipe</option>{soldRecipes.map(recipe=><option key={recipe.id} value={recipe.id}>{recipe.title || recipe.name}</option>)}</select>{bulkRecipe(row) && <div className="mt-2 space-y-2"><p>Current batch: {bulkRecipe(row).batchYieldQuantity || 'Unknown'} {bulkRecipe(row).batchYieldUnit} · {bulkRecipe(row).batchYieldPercent ?? 100}% usable yield.</p>{!bulkRecipe(row).costingApprovedAt && <p className="text-amber-200">Approve this recipe’s yield in Recipes before reviewing a serving conversion.</p>}<label>Sold servings per usable batch<input aria-label={`Servings per batch for sales row ${index+1}`} type="number" min="0.001" max="100000" step="any" value={row.servingConversion?.servingsPerBatch || ''} onChange={event=>{const recipe=bulkRecipe(row);updateConversion(index,{servingsPerBatch:event.target.value,yieldQuantity:recipe.batchYieldQuantity,yieldPercent:recipe.batchYieldPercent ?? 100,yieldUnit:String(recipe.batchYieldUnit).toLowerCase(),costingApprovedAt:recipe.costingApprovedAt || '',reviewed:false});}} className="w-full min-h-[44px] bg-[#0B0E11] p-2"/></label><label className="flex gap-2 min-h-[44px] items-center"><input type="checkbox" checked={row.servingConversion?.reviewed===true} onChange={event=>updateConversion(index,{reviewed:event.target.checked})}/>I reviewed this conversion against the current usable batch yield.</label></div>}
    <p className="mt-1 text-slate-500">Source {row.sourceId} · line {row.lineId}</p></div>)}</div>
    {!!rows.length && <button type="button" disabled={busy || rows.some(row=>!row.recipeId || !conversionReady(row))} onClick={approve} className="min-h-[44px] rounded-lg border border-emerald-500/40 px-3 disabled:opacity-50">{busy?'Saving reviewed history…':`Approve ${rows.length} reviewed sales rows`}</button>}
    </div>}
  </div>;
}

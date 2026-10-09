import React,{useEffect,useRef,useState} from 'react';
import {T,hasAnyPermission} from '../core/appCore';
import {invoiceReviewRequest} from './InvoiceReviewTools';
import {reviewCsv} from '../core/reviewCsv';

function VendorCatalogWorkspace({appUser,vendors}) {
  const [vendorId,setVendorId]=useState(''),[csv,setCsv]=useState(''),[preview,setPreview]=useState([]),[products,setProducts]=useState([]),[cursor,setCursor]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const boundary=useRef('');boundary.current=`${appUser?.restaurantId}|${vendorId}`;
  useEffect(()=>{setVendorId('');setProducts([]);setPreview([]);setCsv('');setCursor(null);setError('');},[appUser?.restaurantId]);
  if(!hasAnyPermission(appUser,['inventory','team']) || appUser?.demoMode || appUser?.isDemo)return null;
  const load=async(id,after=null)=>{const key=`${appUser.restaurantId}|${id}`;setBusy(true);setError('');try{const result=await invoiceReviewRequest(appUser,{action:'vendor-catalog-list',vendorId:id,cursor:after});if(boundary.current===key){setProducts(old=>after?[...old,...result.products]:result.products);setCursor(result.nextCursor);}}catch(problem){if(boundary.current===key)setError(problem.message);}finally{setBusy(false);}};
  const parse=()=>{try{const rows=reviewCsv(csv,{required:['sku','name','packsize','purchaseunit','unitprice','sourceurl']});setPreview(rows.map(row=>({sku:row.sku,name:row.name,packSize:row.packsize,purchaseUnit:row.purchaseunit,unitPrice:row.unitprice,sourceUrl:row.sourceurl})));setError('');}catch(problem){setPreview([]);setError(problem.message);}};
  const save=async()=>{setBusy(true);setError('');try{await invoiceReviewRequest(appUser,{action:'vendor-catalog-import',vendorId,rows:preview,approved:true,expectedVersions:Object.fromEntries(products.map(row=>[row.code,row.approvedAt]))});setPreview([]);setCsv('');await load(vendorId);}catch(problem){setError(problem.message);}finally{setBusy(false);}};
  const revoke=async row=>{if(!window.confirm(`Revoke catalog evidence for ${row.name}? Future research will exclude it.`))return;setBusy(true);try{await invoiceReviewRequest(appUser,{action:'vendor-catalog-revoke',vendorId,productId:row.id,expectedApprovedAt:row.approvedAt,approved:true});await load(vendorId);}catch(problem){setError(problem.message);}finally{setBusy(false);}};
  return <section data-testid="vendor-catalog-review" className={`${T.card} p-4 space-y-3`}>
    <h3 className="font-black text-white">Reviewed vendor catalog</h3><p className="text-xs text-slate-400">Keep distributor product evidence separate from stock and invoice approvals. Review SKU, package, purchase unit, price and a public catalog link before approving.</p>
    <select aria-label="Catalog vendor" className={T.input} value={vendorId} disabled={busy} onChange={event=>{const id=event.target.value;boundary.current=`${appUser.restaurantId}|${id}`;setVendorId(id);setProducts([]);setPreview([]);setCsv('');setCursor(null);setError('');if(id)load(id);}}><option value="">Choose vendor</option>{vendors.map(vendor=><option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select>
    {vendorId && <><p className="text-xs text-slate-400">CSV columns: sku,name,packSize,purchaseUnit,unitPrice,sourceUrl. Links must use HTTPS and omit private tokens or query parameters. Approving catalog evidence never changes stock, costs, orders, or learned matches.</p><textarea aria-label="Vendor catalog CSV" rows={4} className={T.input} value={csv} onChange={event=>{setCsv(event.target.value);setPreview([]);}}/><button aria-label="Preview catalog evidence" type="button" className={T.btnAlt} disabled={busy} onClick={parse}>Preview catalog evidence</button>
      {preview.map((row,index)=><p key={index} className="text-xs text-slate-300">{row.sku} · {row.name} · {row.packSize} · {row.purchaseUnit} · {row.unitPrice || 'Price unknown'}</p>)}{!!preview.length && <button aria-label={`Approve ${preview.length} catalog rows`} type="button" disabled={busy} onClick={save} className={T.btn}>Approve {preview.length} catalog rows</button>}
      {products.map(row=><div key={row.id} className="text-xs border-t border-slate-700 pt-2 text-slate-300"><p>{row.code} · {row.name} · {row.packSize} · {row.active?'Active':'Revoked'} · Reviewed {String(row.approvedAt).slice(0,10)}</p>{row.active && <button type="button" disabled={busy} className={`${T.btnAlt} mt-2`} onClick={()=>revoke(row)}>Revoke catalog evidence</button>}</div>)}
      {cursor && <button type="button" disabled={busy} className={T.btnAlt} onClick={()=>load(vendorId,cursor)}>Load more catalog products</button>}
    </>}{busy && <p role="status" className="text-xs text-slate-400">Loading catalog evidence…</p>}{error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
  </section>;
}

export default function VendorCatalogReview(props) {return <VendorCatalogWorkspace key={`${props.appUser?.restaurantId}|${props.appUser?.uid || props.appUser?.id || ''}|${JSON.stringify(props.appUser?.permissions || {})}`} {...props}/>;}

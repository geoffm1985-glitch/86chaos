import React, { useState } from 'react';
import posNormalizationHelpers from '../core/posNormalization.js';
import { T } from '../core/appCore';

const { POS_FIELDS, parsePosCsv, normalizePosImport } = posNormalizationHelpers;
export default function PosImportReview({ restaurantId, onUseDaily }) {
  const [text, setText] = useState(''); const [parsed, setParsed] = useState(null); const [mapping, setMapping] = useState({});
  const [provider, setProvider] = useState('manual'); const [draft, setDraft] = useState(null); const [error, setError] = useState('');
  const run = fn => { try { setError(''); fn(); } catch (err) { setError(err.message); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = '86chaos-pos-review-draft.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <details className={`${T.card} p-3`}><summary className="font-bold text-[#D4A381] cursor-pointer">Review POS CSV import</summary><div className="space-y-3 mt-3">
    <p className="text-xs text-slate-400">Map a CSV export to a review draft. Daily, item, and category rows remain separate to avoid double-counting. Item IDs can map to your menu; no live POS connection is used.</p>
    <input aria-label="POS source" className={T.input} placeholder="Source name" value={provider} onChange={e => { setProvider(e.target.value); setDraft(null); }}/>
    <textarea aria-label="POS CSV" className={T.input} rows="4" placeholder="recordType,date,posId,menuItemName,quantity,netSales" value={text} onChange={e => { setText(e.target.value); setParsed(null); setDraft(null); }}/>
    <button type="button" className={T.btnAlt} onClick={() => run(() => { setParsed(parsePosCsv(text)); setDraft(null); })}>Read CSV columns</button>
    {parsed && <><div className="grid sm:grid-cols-3 gap-2">{POS_FIELDS.map(field => <label key={field} className={T.label}>{field}<select className={T.input} value={mapping[field] || (parsed.headers.includes(field) ? field : '')} onChange={e => { setMapping({ ...mapping, [field]: e.target.value || '__unmapped__' }); setDraft(null); }}><option value="">Not provided</option>{parsed.headers.map(header => <option key={header}>{header}</option>)}</select></label>)}</div><button type="button" className={T.btnAlt} onClick={() => run(() => setDraft(normalizePosImport({ ...parsed, mapping, provider, restaurantId })))}>Preview normalized rows</button></>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {draft && <><p className="text-sm text-slate-300">{draft.records.length} draft rows; {draft.records.filter(row => row.mappingNeedsReview).length} menu mappings need review.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Date','Type','Item / category','Count','Net sales','Review'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{draft.records.map((row, i) => <tr key={i}><td>{row.date}</td><td>{row.recordType}</td><td>{row.menuItemName || row.category}</td><td>{row.quantity}</td><td>{row.netSales}</td><td>{row.recordType === 'daily' && <button type="button" className={T.btnAlt} onClick={() => onUseDaily(row)}>Use in Daily Close form</button>}</td></tr>)}</tbody></table></div><button type="button" className={T.btnAlt} onClick={download}>Download review draft</button><p className="text-xs text-slate-400">Review and save Daily Close separately. Import previews do not change financial records.</p></>}
  </div></details>;
}

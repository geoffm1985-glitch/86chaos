import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { TrendingUp, DollarSign, Edit, Trash2 } from 'lucide-react';

const TabSales = ({ sales = [], appUser, addToast, db, T, getToday }) => {
  const [date, setDate] = useState(getToday());
  const [grossSales, setGrossSales] = useState('');
  const [notes, setNotes] = useState('');
  const [editingSale, setEditingSale] = useState(null);

  const resetForm = () => {
    setDate(getToday());
    setGrossSales('');
    setNotes('');
    setEditingSale(null);
  };

  const handleSaveSales = async (e) => {
    e.preventDefault();
    if (!grossSales || isNaN(grossSales)) return addToast('Error', 'Valid sales amount required.');

    const payload = {
      date: date,
      amount: parseFloat(grossSales),
      notes: notes.trim(),
      loggedBy: appUser.name,
      restaurantId: appUser.restaurantId,
      timestamp: new Date().toISOString()
    };

    try {
      if (editingSale) {
        await updateDoc(doc(db, "sales", editingSale.id), payload);
        addToast('Updated', 'Sales record updated successfully.');
      } else {
        await addDoc(collection(db, "sales"), payload);
        addToast('Saved', 'Daily sales logged.');
      }
      resetForm();
    } catch (err) {
      addToast('Error', 'Failed to save sales data.');
    }
  };

  const handleDeleteSales = async (id) => {
    if (!window.confirm("Permanently delete this sales record?")) return;
    try {
      await deleteDoc(doc(db, "sales", id));
      addToast('Deleted', 'Sales record removed.');
    } catch (err) {
      addToast('Error', 'Failed to delete record.');
    }
  };

  const handleEditClick = (sale) => {
    setDate(sale.date);
    setGrossSales(sale.amount);
    setNotes(sale.notes || '');
    setEditingSale(sale);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sort sales newest first
  const sortedSales = [...sales].sort((a,b) => b.date.localeCompare(a.date));
  
  // Calculate trailing 7 days average
  const last7Days = sortedSales.slice(0, 7);
  const avgSales = last7Days.length > 0 
    ? last7Days.reduce((sum, s) => sum + s.amount, 0) / last7Days.length 
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      <div className={`flex items-center gap-3 border-b ${T.border} pb-3`}>
        <TrendingUp size={24} className="text-emerald-500"/>
        <h2 className="text-2xl font-black text-white">Sales Tracker</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* FORM */}
        <form onSubmit={handleSaveSales} className={`${T.card} p-5 space-y-4 h-fit`}>
          <div className="flex justify-between items-center border-b border-[#2A353D] pb-3 mb-2">
            <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest flex items-center gap-2">
              {editingSale ? 'Edit Record' : 'Log Daily Sales'}
            </h3>
            {editingSale && <button type="button" onClick={resetForm} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white">Cancel ✖</button>}
          </div>

          <div>
            <label className={T.label}>Business Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={T.input} required />
          </div>

          <div>
            <label className={T.label}>Gross Sales ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
              <input type="number" step="0.01" value={grossSales} onChange={e=>setGrossSales(e.target.value)} className={`${T.input} pl-8`} placeholder="Ex: 4500.00" required />
            </div>
          </div>

          <div>
            <label className={T.label}>End of Day Notes (Optional)</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="2" className={T.input} placeholder="e.g. Busy dinner rush, weather was bad..."></textarea>
          </div>

          <button type="submit" className={`w-full ${T.btn} py-3`}>{editingSale ? 'Update Sales Data' : 'Lock in Sales'}</button>
        </form>

        {/* METRICS DASHBOARD */}
        <div className="space-y-4">
          <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-emerald-900/30`}>
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-2"><DollarSign size={14}/> Trailing 7-Day Average</div>
            <div className="text-4xl font-black text-white">${avgSales.toFixed(2)}</div>
            <div className="text-[9px] text-slate-500 font-bold uppercase mt-2">Calculated from the last {last7Days.length} recorded entries</div>
          </div>
          
          <div className={`${T.card} p-5`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] border-b border-[#2A353D] pb-2 mb-3">Recent Ledger</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
              {sortedSales.length === 0 && <div className={`text-sm font-bold ${T.muted} text-center py-4`}>No sales data logged yet.</div>}
              {sortedSales.map(sale => (
                <div key={sale.id} className="bg-[#12161A] border border-[#2A353D] p-3 rounded-lg flex justify-between items-center group">
                  <div>
                    <div className="font-bold text-white text-sm">{sale.date}</div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">Logged by {sale.loggedBy}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-black text-emerald-400">${Number(sale.amount).toFixed(2)}</div>
                    {(appUser?.isAdmin) && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditClick(sale)} className="p-1.5 text-slate-400 hover:text-white transition-colors bg-[#1A2126] rounded border border-[#2A353D]"><Edit size={12}/></button>
                        <button onClick={() => handleDeleteSales(sale.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors bg-[#1A2126] rounded border border-[#2A353D]"><Trash2 size={12}/></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TabSales;

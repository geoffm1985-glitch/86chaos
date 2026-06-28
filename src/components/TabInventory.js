import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Camera, Search, Trash2, Edit, Plus, Check, Send, MessageSquare, Package, ClipboardList, Loader2 } from 'lucide-react';

const TabInventory = ({ inventoryItems = [], vendors = [], wasteLogs = [], sales, invoices = [], addToast, appUser, db, Modal, T, getToday }) => {
  const [invTab, setInvTab] = useState('count'); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const [viewInvoice, setViewInvoice] = useState(null);

  // Inventory Form
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState(''); const [newItemCode, setNewItemCode] = useState(''); const [newItemSupplier, setNewItemSupplier] = useState(''); const [newItemPackSize, setNewItemPackSize] = useState('1 CS'); const [newItemYield, setNewItemYield] = useState('1'); const [newItemPrice, setNewItemPrice] = useState(''); 
  const [editItem, setEditItem] = useState(null); 
  const [orderOverrides, setOrderOverrides] = useState({}); 
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, vendorId: null, items: [] });
  
  // Vendor Form
  const [vName, setVName] = useState(''); const [vRep, setVRep] = useState(''); const [vPhone, setVPhone] = useState(''); const [vEmail, setVEmail] = useState(''); const [vDays, setVDays] = useState([]); const [vTime, setVTime] = useState('');
  const [editVendor, setEditVendor] = useState(null);

  // Waste Form States
  const [wItemId, setWItemId] = useState(''); 
  const [wQty, setWQty] = useState(''); 
  const [wReason, setWReason] = useState('Dropped / Spilled');
  const [editWaste, setEditWaste] = useState(null);
  const [wSearchTerm, setWSearchTerm] = useState(''); 
  const [wasteSearch, setWasteSearch] = useState(''); 

  // AI Invoice Scanner State
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [scannedInvoice, setScannedInvoice] = useState(null);

  const hasInvPerms = appUser?.isAdmin || appUser?.permissions?.inventory || appUser?.permissions?.team;

  // --- LOGIC ---
  const handleAddItem = async (e) => { e.preventDefault(); if (!newItemName.trim() || !newItemSupplier) return addToast('Error', 'Name and Vendor required.'); await addDoc(collection(db, "inventoryItems"), { name: newItemName.trim(), category: newItemCat || 'Other', pfgCode: newItemCode.trim(), supplierId: newItemSupplier, packSize: newItemPackSize.trim(), yieldQty: parseInt(newItemYield) || 1, price: parseFloat(newItemPrice) || 0, parLevel: 0, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null, restaurantId: appUser.restaurantId }); setNewItemName(''); setNewItemCode(''); setNewItemPrice(''); setNewItemYield('1'); addToast('Inventory Updated', 'Item cataloged.'); };
  const handleSaveEdit = async (e) => { e.preventDefault(); await updateDoc(doc(db, "inventoryItems", editItem.id), { name: editItem.name.trim(), category: editItem.category || 'Other', pfgCode: (editItem.pfgCode || '').trim(), supplierId: editItem.supplierId, packSize: editItem.packSize, yieldQty: parseInt(editItem.yieldQty) || 1, price: parseFloat(editItem.price) || 0 }); setEditItem(null); addToast('Item Updated', 'Master file overwritten.'); };
  const updateStock = async (id, newStock) => await updateDoc(doc(db, "inventoryItems", id), { currentStock: Math.max(0, parseFloat(newStock) || 0) });
  const updatePar = async (id, newPar) => await updateDoc(doc(db, "inventoryItems", id), { parLevel: Math.max(0, parseFloat(newPar) || 0) });
  const handleOrderChange = (id, change, currentQty) => setOrderOverrides(prev => ({ ...prev, [id]: Math.max(0, currentQty + change) }));
  
  const handleAddVendor = async (e) => { e.preventDefault(); if(!vName.trim()) return; await addDoc(collection(db, "vendors"), { name: vName.trim(), rep: vRep.trim(), phone: vPhone.trim(), email: vEmail.trim(), cutOffDays: vDays, cutOffTime: vTime, restaurantId: appUser.restaurantId }); setVName(''); setVRep(''); setVPhone(''); setVEmail(''); setVDays([]); setVTime(''); addToast('Vendor Added', 'Directory updated.'); };
  const handleSaveVendorEdit = async (e) => { e.preventDefault(); await updateDoc(doc(db, "vendors", editVendor.id), { name: editVendor.name, rep: editVendor.rep, phone: editVendor.phone, email: editVendor.email, cutOffDays: editVendor.cutOffDays || [], cutOffTime: editVendor.cutOffTime || '' }); setEditVendor(null); addToast('Vendor Updated', 'Profile saved.'); };
  const toggleVendorDay = (day, isEdit = false) => { if (isEdit) { const d = editVendor.cutOffDays || []; setEditVendor({...editVendor, cutOffDays: d.includes(day) ? d.filter(x=>x!==day) : [...d, day]}); } else { setVDays(vDays.includes(day) ? vDays.filter(x=>x!==day) : [...vDays, day]); } };

  const handleLogWaste = async (e) => {
    e.preventDefault(); if(!wItemId || !wQty) return; const item = inventoryItems.find(i => i.id === wItemId); if(!item) return;
    const qtyNum = parseFloat(wQty); const yieldDivider = parseFloat(item.yieldQty) || 1; 
    const stockDeduction = qtyNum / yieldDivider; const costLost = ((item.price || 0) / yieldDivider) * qtyNum; 
    await addDoc(collection(db, "wasteLogs"), { itemId: item.id, itemName: item.name, qty: qtyNum, costLost, reason: wReason, loggedBy: appUser.name, date: getToday(), timestamp: new Date().toISOString(), restaurantId: appUser.restaurantId });
    await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: Math.max(0, item.currentStock - stockDeduction) });
    setWItemId(''); setWQty(''); setWSearchTerm(''); addToast('Burn Logged', `$${costLost.toFixed(2)} deducted from stock.`);
  };

  const handleDeleteWaste = async (log) => {
    if (!window.confirm(`Delete burn log for ${log.itemName} and restore stock?`)) return;
    const item = inventoryItems.find(i => i.id === log.itemId);
    if (item) {
       const yieldDivider = parseFloat(item.yieldQty) || 1;
       const stockRestoration = (parseFloat(log.qty) || 0) / yieldDivider;
       await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: Math.max(0, (item.currentStock||0) + stockRestoration) });
    }
    await deleteDoc(doc(db, "wasteLogs", log.id));
    addToast('Log Deleted', 'Stock restored successfully.');
  };

  const handleSaveWasteEdit = async (e) => {
    e.preventDefault();
    const log = editWaste;
    const item = inventoryItems.find(i => i.id === log.itemId);
    if (item) {
       const originalLog = wasteLogs.find(w => w.id === log.id);
       const oldQty = parseFloat(originalLog.qty) || 0;
       const newQty = parseFloat(log.qty) || 0;
       const yieldDivider = parseFloat(item.yieldQty) || 1;
       const stockDifference = (newQty - oldQty) / yieldDivider; 
       const newCostLost = ((item.price || 0) / yieldDivider) * newQty;

       await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: Math.max(0, (item.currentStock||0) - stockDifference) });
       await updateDoc(doc(db, "wasteLogs", log.id), { qty: newQty, reason: log.reason, costLost: newCostLost });
    } else {
       await updateDoc(doc(db, "wasteLogs", log.id), { qty: log.qty, reason: log.reason });
    }
    setEditWaste(null);
    addToast('Log Updated', 'Burn log and stock adjusted.');
  };

  const itemsToOrder = inventoryItems.filter(i => { const override = orderOverrides[i.id]; return override !== undefined ? override > 0 : (i.currentStock || 0) < (i.parLevel || 0); });
  const vendorsWithDeficits = vendors.filter(v => itemsToOrder.some(i => i.supplierId === v.id));
  const pendingVendors = vendors.filter(v => inventoryItems.some(i => i.supplierId === v.id && (i.pendingQty || 0) > 0));

  const handleReviewOrder = (vendorId) => {
    const list = itemsToOrder.filter(i => i.supplierId === vendorId).map(item => { const deficit = Math.max(0, (item.parLevel||0) - (item.currentStock||0)); const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.ceil(deficit); return { ...item, orderQty: qty }; }).filter(i => i.orderQty > 0);
    if (list.length === 0) return addToast('Order Empty', `No deficits for this vendor.`);
    setConfirmModal({ isOpen: true, vendorId, items: list });
  };

  const executeOrder = async (method) => {
    const { vendorId, items } = confirmModal; const vendor = vendors.find(v => v.id === vendorId);
    
    let bodyText = items.map(i => `${i.orderQty}x ${i.pfgCode ? `[${i.pfgCode}] ` : ''}${i.name} (${i.packSize})`).join('%0D%0A');
    let fullText = `Order via 86chaos%0D%0A%0D%0A${bodyText}`;

    try { await navigator.clipboard.writeText(decodeURIComponent(fullText)); } catch (e) { console.log(e); }

    if (method === 'csv') {
      let csvContent = "data:text/csv;charset=utf-8,Qty,Code,Name,Pack Size\n" + items.map(i => `${i.orderQty},"${i.pfgCode||''}","${i.name}","${i.packSize||''}"`).join("\n");
      const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `Order_${(vendor?.name||'Vendor').replace(/\s+/g,'_')}_${getToday()}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      addToast('Exported', 'Order downloaded as Spreadsheet.');
    } else if (method === 'email') {
      const emailUrl = `mailto:${vendor?.email||''}?subject=Cheers Order&body=${fullText}`;
      if (emailUrl.length > 2000) { addToast('📋 Order Copied!', 'List is huge! We opened email, just tap and PASTE.'); window.location.href = `mailto:${vendor?.email||''}?subject=Cheers Order (Paste From Clipboard)`; } 
      else { window.location.href = emailUrl; }
    } else if (method === 'sms') {
      const smsUrl = `sms:${vendor?.phone||''}?body=${fullText}`;
      if (smsUrl.length > 2000) { addToast('📋 Order Copied!', 'List is huge! We opened SMS, just tap and PASTE.'); window.location.href = `sms:${vendor?.phone||''}`; } 
      else { window.location.href = smsUrl; }
    } else {
      addToast('Copied', 'Order list copied to clipboard!');
    }
    
    for (const item of items) { await updateDoc(doc(db, "inventoryItems", item.id), { pendingQty: item.orderQty, lastOrderedQty: item.orderQty, lastOrderedDate: getToday() }); }
    setOrderOverrides({}); setConfirmModal({ isOpen: false, vendorId: null, items: [] });
  };

  const handleReceiveDelivery = async (vendorId) => {
    const itemsToReceive = inventoryItems.filter(i => i.supplierId === vendorId && (i.pendingQty || 0) > 0);
    for (const item of itemsToReceive) {
      await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: (parseFloat(item.currentStock) || 0) + (parseFloat(item.pendingQty) || 0), pendingQty: 0 });
    }
    addToast('Delivery Accepted', `Stock automatically updated for ${itemsToReceive.length} items.`);
  };

  // --- CSV INVENTORY UPLOAD ---
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm(`Upload ${file.name} to your inventory?`)) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split('\n').filter(row => row.trim());
        let addedCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(/(?!\B"[^"]*),(?![^"]*"\B)/).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 2) continue; 
          
          const name = cols[0];
          const category = cols[1] || 'Other';
          const code = cols[2] || '';
          const packSize = cols[3] || '1 CS';
          const yieldQty = parseFloat(cols[4]) || 1;
          const price = parseFloat(cols[5]) || 0;
          const vendorName = cols[6] || 'Unassigned Vendor';

          let vId = '';
          let existingVendor = vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase());
          
          if (existingVendor) {
            vId = existingVendor.id;
          } else {
            const newVRef = await addDoc(collection(db, "vendors"), { name: vendorName, rep: "", email: "", phone: "", restaurantId: appUser.restaurantId });
            vId = newVRef.id;
            vendors.push({id: vId, name: vendorName}); 
          }

          await addDoc(collection(db, "inventoryItems"), {
            name, category, pfgCode: code, packSize, yieldQty, price, parLevel: 0,
            lastOrderedQty: 0, lastOrderedDate: null, supplierId: vId, currentStock: 0, pendingQty: 0, isStarred: false, restaurantId: appUser.restaurantId
          });
          addedCount++;
        }
        addToast("Upload Complete", `Successfully imported ${addedCount} items.`);
      } catch (err) {
        addToast("Error", "Failed to parse CSV file. Ensure it matches the exact template format.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  // --- AI INVOICE SCANNER ENGINE (WITH RECONCILIATION) ---
  const handleScanInvoice = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
       addToast('Error', 'File too large. Please keep images or PDFs under 5MB.');
       return;
    }

    setIsScanningInvoice(true);
    addToast('Scanning Invoice', 'Extracting line items and checking stock...');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (event) => {
      const base64String = event.target.result;
      const mimeType = file.type;

      try {
        const response = await fetch('/api/scan-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64String, mimeType })
        });

        if (!response.ok) throw new Error('Failed to scan invoice. Check backend logs.');

        const data = await response.json();
        
        // AUTO-MATCHING LOGIC
        const reconciledItems = (data.lineItems || []).map(item => {
           // Attempt to find a direct match in the database by name or code
           const match = inventoryItems.find(inv => 
              inv.name.toLowerCase() === item.itemName.toLowerCase() || 
              (inv.pfgCode && item.itemName.includes(inv.pfgCode))
           );
           return { ...item, matchedItemId: match ? match.id : "" };
        });

        setScannedInvoice({ ...data, lineItems: reconciledItems });
        addToast('Success', 'Invoice extracted! Please verify matched items.');
      } catch (err) {
        addToast('Error', err.message);
      } finally {
        setIsScanningInvoice(false);
      }
    };
    e.target.value = '';
  };

  const handleApproveInvoice = async () => {
     try {
       // 1. Log the invoice record for history
       await addDoc(collection(db, "invoices"), {
         ...scannedInvoice,
         restaurantId: appUser.restaurantId,
         processedAt: new Date().toISOString(),
         processedBy: appUser.name
       });

       // 2. Resolve Vendor (Auto-Create if Missing)
       let vId = '';
       let existingVendor = vendors.find(v => v.name.toLowerCase() === (scannedInvoice.vendorName || '').toLowerCase());
       
       if (existingVendor) {
          vId = existingVendor.id;
       } else if (scannedInvoice.vendorName) {
          const newVRef = await addDoc(collection(db, "vendors"), { 
            name: scannedInvoice.vendorName, 
            rep: "", email: "", phone: "", 
            restaurantId: appUser.restaurantId 
          });
          vId = newVRef.id;
       }

       // 3. Loop through and apply stock updates OR create new items
       let updateCount = 0;
       let newCount = 0;
       
       for (const item of scannedInvoice.lineItems) {
          if (item.matchedItemId === 'CREATE_NEW') {
             // Create a brand new item in inventory
             await addDoc(collection(db, "inventoryItems"), {
                name: item.itemName,
                category: 'Other', 
                pfgCode: '', 
                supplierId: vId,
                packSize: item.packSize || '1 CS',
                yieldQty: 1, 
                price: parseFloat(item.unitPrice) || 0,
                parLevel: 0,
                currentStock: parseFloat(item.quantity) || 0,
                pendingQty: 0,
                isStarred: false,
                lastOrderedDate: null,
                restaurantId: appUser.restaurantId
             });
             newCount++;
          } else if (item.matchedItemId) {
             // Update existing item
             const invItem = inventoryItems.find(i => i.id === item.matchedItemId);
             if (invItem) {
                const addedStock = parseFloat(item.quantity) || 0;
                await updateDoc(doc(db, "inventoryItems", invItem.id), { 
                   currentStock: (parseFloat(invItem.currentStock) || 0) + addedStock 
                });
                updateCount++;
             }
          }
       }

       addToast('Invoice Processed', `Updated ${updateCount} items and added ${newCount} new items.`);
       setScannedInvoice(null);
     } catch(e) {
       addToast('Error', 'Failed to process invoice updates.');
     }
  };

  const groupedItems = inventoryItems.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).reduce((acc, item) => { const cat = item.category || 'Uncategorized'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});
  const orderTotal = confirmModal.items.reduce((sum, item) => sum + ((item.price||0) * item.orderQty), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24">
      
      <Modal isOpen={!!scannedInvoice} onClose={() => setScannedInvoice(null)} title="Reconcile & Approve Invoice">
        {scannedInvoice && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
              <div>
                <div className="font-black text-white text-lg">{scannedInvoice.vendorName}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{scannedInvoice.invoiceDate}</div>
              </div>
              <div className="text-xl font-black text-emerald-400">${Number(scannedInvoice.invoiceTotal || 0).toFixed(2)}</div>
            </div>
            
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest text-center mt-2 mb-1">Stock Matcher</p>
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {(scannedInvoice.lineItems || []).map((item, idx) => (
                <div key={idx} className="p-3 bg-[#1A2126] flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white text-sm">{item.itemName}</div>
                      <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-widest mt-0.5">
                        {item.quantity} {item.packSize} @ ${Number(item.unitPrice || 0).toFixed(2)}/ea
                      </div>
                    </div>
                    <div className="font-black text-slate-300">${Number(item.totalPrice || 0).toFixed(2)}</div>
                  </div>
                  
                  <select 
                    value={item.matchedItemId} 
                    onChange={(e) => {
                       const newItems = [...scannedInvoice.lineItems];
                       newItems[idx].matchedItemId = e.target.value;
                       setScannedInvoice({...scannedInvoice, lineItems: newItems});
                    }}
                    className={`${T.input} py-2 text-xs font-bold outline-none cursor-pointer ${item.matchedItemId === 'CREATE_NEW' ? 'border-blue-500/50 text-blue-400 bg-blue-900/10' : item.matchedItemId ? 'border-emerald-500/50 text-emerald-400 bg-emerald-900/10' : 'border-orange-500/50 text-orange-400 bg-orange-900/10'}`}
                  >
                    <option value="">-- Do Not Import / Skip --</option>
                    <option value="CREATE_NEW">➕ Add as New Item</option>
                    {inventoryItems.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button onClick={handleApproveInvoice} className={`w-full ${T.btn} py-3`}>Approve & Update Stock</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Details">
        {viewInvoice && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
              <div>
                <div className="font-black text-white text-lg">{viewInvoice.vendorName}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{viewInvoice.invoiceDate}</div>
              </div>
              <div className="text-xl font-black text-emerald-400">${Number(viewInvoice.invoiceTotal || 0).toFixed(2)}</div>
            </div>
            
            <div className="max-h-60 overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {(viewInvoice.lineItems || []).map((item, idx) => (
                <div key={idx} className="p-2.5 bg-[#1A2126] flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-sm">{item.itemName}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {item.quantity} {item.packSize} @ ${Number(item.unitPrice || 0).toFixed(2)}/ea
                    </div>
                    {item.matchedItemId && item.matchedItemId !== 'CREATE_NEW' && <div className="text-[8px] text-emerald-500 font-black uppercase mt-1">Matched to Inventory</div>}
                    {item.matchedItemId === 'CREATE_NEW' && <div className="text-[8px] text-blue-400 font-black uppercase mt-1">Added as New Item</div>}
                  </div>
                  <div className="font-black text-slate-300">${Number(item.totalPrice || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setViewInvoice(null)} className={`w-full ${T.btnAlt} py-3`}>Close</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, vendorId: null, items: [] })} title={`Review Order: ${vendors.find(v=>v.id===confirmModal.vendorId)?.name}`}>
         <div className="space-y-4">
           <div className={`max-h-60 overflow-y-auto border ${T.border} rounded-xl divide-y divide-[#2A353D]`}>{confirmModal.items.map(item => (<div key={item.id} className="p-3 flex justify-between items-center bg-[#12161A]"><div><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-xs ${T.muted}`}>{item.packSize}</span><div className="text-[9px] text-[#D4A381] mt-0.5 uppercase tracking-widest font-black">Est: ${((item.price||0) * item.orderQty).toFixed(2)}</div></div><div className={`font-black ${T.copper} text-lg`}>{item.orderQty}</div></div>))}</div>
           <div className="flex justify-between items-center bg-[#1A2126] p-3 rounded-xl border border-[#2A353D]"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estimated Total</span><span className="text-lg font-black text-emerald-400">${orderTotal.toFixed(2)}</span></div>
           <div className="grid grid-cols-2 gap-2">
             <button onClick={() => executeOrder('email')} className={`w-full ${T.btn} flex items-center justify-center gap-2 py-2 text-xs`}><Send size={16}/> Email</button>
             <button onClick={() => executeOrder('sms')} className={`w-full ${T.btn} flex items-center justify-center gap-2 py-2 text-xs`}><MessageSquare size={16}/> Text</button>
             <button onClick={() => executeOrder('csv')} className={`w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-emerald-400 transition-all px-2 py-2 text-xs flex items-center justify-center gap-2`}><Package size={16}/> CSV Export</button>
             <button onClick={() => executeOrder('copy')} className={`w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-[#D4A381] transition-all px-2 py-2 text-xs flex items-center justify-center gap-2`}><ClipboardList size={16}/> Copy List</button>
           </div>
         </div>
      </Modal>

      <Modal isOpen={!!editVendor} onClose={() => setEditVendor(null)} title="Edit Vendor">
        {editVendor && (
          <form onSubmit={handleSaveVendorEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><input type="text" value={editVendor.name} onChange={e=>setEditVendor({...editVendor, name: e.target.value})} className={T.input} required placeholder="Company Name"/><input type="text" value={editVendor.rep || ''} onChange={e=>setEditVendor({...editVendor, rep: e.target.value})} className={T.input} placeholder="Rep Name"/></div>
            <div className="grid grid-cols-2 gap-3"><input type="tel" value={editVendor.phone || ''} onChange={e=>setEditVendor({...editVendor, phone: e.target.value})} className={T.input} placeholder="Phone"/><input type="email" value={editVendor.email || ''} onChange={e=>setEditVendor({...editVendor, email: e.target.value})} className={T.input} placeholder="Email"/></div>
            <div>
              <label className={T.label}>Order Cut-Off Time</label>
              <input type="time" value={editVendor.cutOffTime || ''} onChange={e=>setEditVendor({...editVendor, cutOffTime: e.target.value})} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Order Cut-Off Days</label>
              <div className="flex flex-wrap gap-2 mt-1">{weekDays.map(d=><button type="button" key={d} onClick={()=>toggleVendorDay(d, true)} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${editVendor.cutOffDays?.includes(d) ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:text-white'}`}>{d.substring(0,3)}</button>)}</div>
            </div>
            <button type="submit" className={`w-full ${T.btn} mt-2`}>Save Vendor Details</button>
          </form>
        )}
      </Modal>

      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b ${T.border} pb-3`}>
        <h2 className="text-2xl font-black flex items-center gap-2 text-white"><ClipboardList size={24} className={T.copper}/> Inventory</h2>
        <div className={`bg-[#12161A] p-1 rounded-xl flex border ${T.border} overflow-x-auto w-full sm:w-auto no-scrollbar`}>
          <button onClick={() => setInvTab('count')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'count' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>count</button>
          {hasInvPerms && <button onClick={() => setInvTab('order')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'order' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>order</button>}
          {hasInvPerms && <button onClick={() => setInvTab('manage')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'manage' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>manage</button>}
          {hasInvPerms && <button onClick={() => setInvTab('vendors')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'vendors' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>vendors</button>}
          {hasInvPerms && <button onClick={() => setInvTab('invoices')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'invoices' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>🧾 Invoices</button>}
          <button onClick={() => setInvTab('waste')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex items-center gap-1 ${invTab === 'waste' ? `bg-red-500/20 text-red-500 shadow-sm border border-red-500/50` : 'text-slate-400 hover:text-red-400'}`}>🚨 Burn Log</button>
        </div>
      </div>

      {invTab === 'count' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <input type="text" placeholder="Search product or code..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={T.input} />
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className={`text-base font-black border-b ${T.border} pb-0.5 uppercase tracking-wide text-slate-400`}>{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{items.map(item => (
                  <div key={item.id} className={`${T.card} p-2 flex items-center justify-between gap-2`}>
                    <div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name}</div><div className={`text-[9px] font-bold ${T.muted}
 uppercase`}>{vendors.find(v=>v.id===item.supplierId)?.name || 'No Vendor'}   {item.packSize || '1 CS'}   YIELD: {item.yieldQty||1}</div></div>
                    <div className={`flex items-center gap-2 bg-[#12161A] p-1 rounded-md border ${T.border} flex-shrink-0`}>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>PAR</span><input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} disabled={!hasInvPerms} className={`w-8 text-center font-bold border rounded py-0.5 outline-none text-xs bg-[#1A2126] text-white border-[#2A353D]`} /></div>
                      <div className={`h-6 w-px bg-[#2A353D]`}></div>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>STOCK</span><div className="flex items-center gap-1"><button onClick={() => updateStock(item.id, (item.currentStock||0) - 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white hover:text-[#D4A381]`}>-</button><span className={`w-6 text-center font-black text-sm ${(item.currentStock||0) < (item.parLevel||0) ? 'text-red-500' : 'text-white'}`}>{Number(item.currentStock||0).toFixed(2).replace(/\.00$/, '')}</span><button onClick={() => updateStock(item.id, (item.currentStock||0) + 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white hover:text-[#D4A381]`}>+</button></div></div>
                    </div>
                  </div>
                ))}</div>
            </div>
          ))}
        </div>
      )}

      {hasInvPerms && invTab === 'order' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          
          {pendingVendors.length > 0 && (
            <div className="mb-6 space-y-4">
              <h3 className="text-sm font-black text-emerald-400 border-b border-[#2A353D] pb-2 uppercase tracking-widest">Inbound Deliveries</h3>
              {pendingVendors.map(vendor => {
                 const vItems = inventoryItems.filter(i => i.supplierId === vendor.id && (i.pendingQty || 0) > 0);
                 return (
                   <div key={`pending-${vendor.id}`} className={`${T.card} overflow-hidden border-emerald-900/50`}>
                     <div className={`p-4 bg-[#12161A] border-b ${T.border} flex justify-between items-center`}>
                       <h3 className="font-black text-lg text-white">{vendor.name} Delivery</h3>
                       <span className={`bg-emerald-900/20 border border-emerald-500/50 text-emerald-400 px-3 py-1 rounded-full font-black text-[10px] uppercase`}>{vItems.length} Pending</span>
                     </div>
                     <div className="p-4 space-y-2">
                       {vItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-sm font-bold text-slate-300">
                            <span className="truncate pr-4">{item.name} <span className="text-[10px] text-slate-500 font-normal">({item.packSize})</span></span>
                            <span className="text-emerald-400 font-black">+{item.pendingQty}</span>
                          </div>
                       ))}
                     </div>
                     <div className={`p-4 bg-[#12161A] border-t ${T.border}`}>
                       <button onClick={() => handleReceiveDelivery(vendor.id)} className={`w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-black py-2 rounded-xl transition-colors`}>✅ Accept & Add to Inventory</button>
                     </div>
                   </div>
                 )
              })}
            </div>
          )}

          {vendorsWithDeficits.length === 0 ? <div className={`${T.card} p-8 text-center text-slate-400 font-bold`}>No deficit alerts.</div> : vendorsWithDeficits.map(vendor => {
              const vendorItems = itemsToOrder.filter(i => i.supplierId === vendor.id);
              return (
                <div key={vendor.id} className={`${T.card} overflow-hidden`}>
                  <div className={`p-4 bg-[#12161A] border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-lg text-white">{vendor.name} Order</h3><span className={`bg-[#1A2126] border ${T.border} ${T.copper} px-3 py-1 rounded-full font-black text-[10px] uppercase`}>{vendorItems.length} Items</span></div>
                  <table className="w-full text-left">
                    <tbody className={`divide-y ${T.border}`}>{vendorItems.map(item => {
                      const deficit = Math.max(0, (item.parLevel||0) - (item.currentStock||0));
                      const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.ceil(deficit);
                      return (
                        <tr key={item.id} className={T.row}>
                          <td className="p-3"><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-[9px] font-bold ${T.muted} uppercase`}>Par: {item.parLevel||0}   Case: ${Number(item.price||0).toFixed(2)}</span></td>
                          <td className="p-3"><div className="flex items-center justify-end gap-1"><button onClick={()=>handleOrderChange(item.id, -1, currentOrder)} className={`w-8 h-8 rounded-lg bg-[#12161A] border ${T.border} font-bold text-white`}>-</button><input type="number" min="0" value={currentOrder} onChange={e=>setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))} className={`w-12 h-8 text-center font-black bg-[#12161A] border ${T.border} ${T.copper} rounded-lg outline-none`}/><button onClick={()=>handleOrderChange(item.id, 1, currentOrder)} className={`w-8 h-8 rounded-lg bg-[#12161A] border ${T.border} font-bold text-white`}>+</button></div></td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                  <div className={`p-4 bg-[#12161A] border-t ${T.border} text-right`}><button onClick={()=>handleReviewOrder(vendor.id)} className={`${T.btn} px-4 py-2 flex items-center justify-center gap-2 ml-auto`}><Check size={16}/> Dispatch</button></div>
                </div>
              )
            })
          }
        </div>
      )}

      {hasInvPerms && invTab === 'manage' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">{editItem && (<form onSubmit={handleSaveEdit} className="space-y-3"><div><label className={T.label}>Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className={T.input} required /></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Category</label><select value={editItem.category || 'Produce'} onChange={e => setEditItem({...editItem, category: e.target.value})} className={T.input}>{['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className={T.label}>Vendor</label><select value={editItem.supplierId || ''} onChange={e => setEditItem({...editItem, supplierId: e.target.value})} className={T.input} required><option value="">Select...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Case Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className={T.input} /></div><div><label className={T.label}>Units per Case (Yield)</label><input type="number" min="1" value={editItem.yieldQty || 1} onChange={e => setEditItem({...editItem, yieldQty: e.target.value})} className={T.input} required /></div></div><button type="submit" className={`w-full ${T.btn}`}>Save Changes</button></form>)}</Modal>

          <div className="flex flex-col gap-3 mb-6">
            
            {/* INVOICE SCANNER: Split Camera & Upload */}
            <div className={`flex bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-16 ${isScanningInvoice ? 'opacity-50 pointer-events-none' : ''}`}>
               <label className="w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                  {isScanningInvoice ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                  <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleScanInvoice} className="hidden" disabled={isScanningInvoice} />
               </label>
               <label className="flex-1 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381] font-black uppercase tracking-widest text-[11px] sm:text-xs" title="Upload Photo or PDF">
                  <span>📄 Scan Invoice (PDF/Photo)</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleScanInvoice} className="hidden" disabled={isScanningInvoice} />
               </label>
            </div>

            {/* CSV IMPORT */}
            <label className={`flex items-center justify-center gap-2 bg-[#12161A] text-slate-300 border border-[#2A353D] hover:bg-[#1A2126] font-black uppercase tracking-widest h-16 rounded-xl shadow-lg transition-all cursor-pointer`}>
              <span className="text-[11px] sm:text-xs">📊 Import CSV</span>
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            </label>

          </div>

          <form onSubmit={handleAddItem} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest">Add New Item</h3>
            <div className="grid grid-cols-1 gap-3">
              <input type="text" placeholder="Item Name..." value={newItemName} onChange={e=>setNewItemName(e.target.value)} className={T.input} required/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={newItemCat} onChange={e=>setNewItemCat(e.target.value)} className={T.input}><option disabled value="">Category...</option>{['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}</select>
              <select value={newItemSupplier} onChange={e=>setNewItemSupplier(e.target.value)} className={T.input} required><option value="">Select Vendor...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={T.label}>Case Price ($)</label><input type="number" step="0.01" placeholder="Ex: 24.50" value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} className={T.input}/></div>
              <div><label className={T.label}>Units per Case (Yield)</label><input type="number" min="1" placeholder="Ex: 12" value={newItemYield} onChange={e=>setNewItemYield(e.target.value)} className={T.input} required/></div>
            </div>
            <button type="submit" className={`w-full ${T.btn} py-2`}><Plus size={18} className="inline mr-2"/> Add Item to Master List</button>
          </form>
          <div className={`${T.card} divide-y ${T.border}`}>{inventoryItems.map(item => (<div key={item.id} className={`${T.row} flex justify-between items-center`}><div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name} <span className="text-[10px] text-slate-500 font-normal">[{item.pfgCode}]</span></div><div className="text-[10px] text-[#D4A381] font-black uppercase mt-0.5 tracking-widest">Case: ${Number(item.price||0).toFixed(2)}   Yield: {item.yieldQty||1}</div></div><div className="flex gap-2"><button onClick={()=>setEditItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button><button onClick={()=>deleteDoc(doc(db,"inventoryItems",item.id))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
        </div>
      )}

      {hasInvPerms && invTab === 'vendors' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleAddVendor} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest">Add Vendor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="text" placeholder="Company Name..." value={vName} onChange={e=>setVName(e.target.value)} className={T.input} required/><input type="text" placeholder="Rep Name..." value={vRep} onChange={e=>setVRep(e.target.value)} className={T.input}/><input type="tel" placeholder="Phone (For SMS Orders)" value={vPhone} onChange={e=>setVPhone(e.target.value)} className={T.input}/><input type="email" placeholder="Email (For PDF Orders)" value={vEmail} onChange={e=>setVEmail(e.target.value)} className={T.input}/></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={T.label}>Cut-Off Time</label><input type="time" value={vTime} onChange={e=>setVTime(e.target.value)} className={T.input}/></div>
              <div><label className={T.label}>Cut-Off Days</label><div className="flex flex-wrap gap-1 mt-1">{weekDays.map(d=><button type="button" key={d} onClick={()=>toggleVendorDay(d)} className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${vDays.includes(d) ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#12161A] text-slate-400 border-[#2A353D]'}`}>{d.substring(0,3)}</button>)}</div></div>
            </div>
            <button type="submit" className={`w-full ${T.btn} py-2`}>Save Vendor</button>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{vendors.map(v => (<div key={v.id} className={`${T.card} p-4`}><div className="flex justify-between items-start"><h4 className="font-black text-white text-lg">{v.name}</h4><button onClick={()=>setEditVendor(v)} className="text-slate-400 hover:text-white"><Edit size={14}/></button></div><div className={`text-xs font-bold ${T.muted} mt-1 space-y-1`}><p>Rep: {v.rep || 'N/A'}</p><p>Phone: {v.phone || 'N/A'}</p><p>Email: {v.email || 'N/A'}</p><p className="text-[#D4A381] mt-2">Cut-Off: {v.cutOffDays?.length > 0 ? v.cutOffDays.join(', ') : 'None'} {v.cutOffTime ? `@ ${v.cutOffTime}` : ''}</p></div><button onClick={()=>deleteDoc(doc(db,"vendors",v.id))} className="mt-4 text-[10px] uppercase font-black tracking-widest text-red-500 hover:text-red-400">Remove Vendor</button></div>))}</div>
        </div>
      )}

      {hasInvPerms && invTab === 'invoices' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className="font-black text-sm text-white flex items-center gap-2">Invoice History</h3>
              <span className="bg-[#1A2126] text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">{invoices.length} Total</span>
            </div>
            <div className={`divide-y ${T.border} max-h-[60vh] overflow-y-auto custom-scrollbar`}>
              {invoices.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold">No invoices logged yet.</div>
              ) : (
                invoices.sort((a,b) => new Date(b.processedAt || 0) - new Date(a.processedAt || 0)).map(inv => (
                  <div key={inv.id} className={`${T.row} flex justify-between items-center p-4`}>
                    <div>
                      <div className="font-black text-white text-base">{inv.vendorName}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inv Date: {inv.invoiceDate}</div>
                      <div className="text-[9px] text-slate-500 mt-1">Processed by {inv.processedBy} on {new Date(inv.processedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-emerald-400 font-black text-lg">${Number(inv.invoiceTotal || 0).toFixed(2)}</div>
                      <button onClick={() => setViewInvoice(inv)} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">View</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {invTab === 'waste' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          
          <Modal isOpen={!!editWaste} onClose={() => setEditWaste(null)} title="Edit Burn Log">
            {editWaste && (
              <form onSubmit={handleSaveWasteEdit} className="space-y-3">
                <div><label className={T.label}>Item</label><input type="text" value={editWaste.itemName} disabled className={`${T.input} opacity-50 cursor-not-allowed`} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={T.label}>Qty Wasted</label><input type="number" min="1" value={editWaste.qty} onChange={e=>setEditWaste({...editWaste, qty: e.target.value})} className={T.input} required/></div>
                  <div><label className={T.label}>Reason</label><select value={editWaste.reason} onChange={e=>setEditWaste({...editWaste, reason: e.target.value})} className={T.input}><option>Dropped / Spilled</option><option>Expired / Bad Quality</option><option>Cooked Incorrectly</option><option>Comped</option></select></div>
                </div>
                <button type="submit" className={`w-full ${T.btn} mt-2`}>Update & Adjust Stock</button>
              </form>
            )}
          </Modal>

          <form onSubmit={handleLogWaste} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-red-400 tracking-widest flex items-center gap-2">🚨 The Burn Log</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              
              {/* THE FILTERABLE DROPDOWN */}
              <div className="space-y-2">
                <input type="text" placeholder="Type to filter inventory..." value={wSearchTerm} onChange={e=>setWSearchTerm(e.target.value)} className={`${T.input} py-2 text-xs border-red-900/30 focus:border-red-500`} />
                <select value={wItemId} onChange={e=>setWItemId(e.target.value)} className={T.input} required>
                  <option value="">Select Item to Burn...</option>
                  {inventoryItems
                    .filter(i => (i.name||'').toLowerCase().includes((wSearchTerm||'').toLowerCase()) || (i.pfgCode||'').toLowerCase().includes((wSearchTerm||'').toLowerCase()))
                    .map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div>
                <input type="number" min="0" step="any" placeholder="Qty Wasted (Individual Units)..." value={wQty} onChange={e=>setWQty(e.target.value)} className={T.input} required/>
                <span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase tracking-widest">Input individual units, not cases</span>
              </div>
              
              <select value={wReason} onChange={e=>setWReason(e.target.value)} className={T.input}>
                <option>Dropped / Spilled</option>
                <option>Expired / Bad Quality</option>
                <option>Cooked Incorrectly</option>
                <option>Comped</option>
              </select>
            </div>
            <button type="submit" className={`w-full bg-red-900/50 hover:bg-red-900 border border-red-500/50 text-white font-black tracking-widest uppercase text-sm py-2 rounded-xl transition-colors mt-2`}>
              Log Waste & Deduct Stock
            </button>
          </form>
          
          {/* SEARCH BAR */}
          <div className="relative w-full mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" size={20}/>
            <input type="text" placeholder="Search logs by item, reason, person, or date..." value={wasteSearch} onChange={(e)=>setWasteSearch(e.target.value)} className={`${T.input} pl-12 border-red-900/30 focus:border-red-500/50`}/>
          </div>

          <div className={`${T.card} divide-y ${T.border}`}>
            <div className={T.th}><span>{wasteSearch ? 'Search Results' : "Today's Burn"}</span></div>
            {wasteLogs.filter(w => wasteSearch ? (w.itemName+w.reason+w.loggedBy+w.date).toLowerCase().includes(wasteSearch.toLowerCase()) : w.date === getToday()).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(w => (
              <div key={w.id} className={`${T.row} flex justify-between items-center`}>
                <div className="flex-1"> 
                  <span className="font-bold text-white text-sm block">{w.qty}x {w.itemName}</span>
                  <span className={`text-[9px] font-bold ${T.muted} uppercase`}>{w.date} • {w.reason}   By {w.loggedBy}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-black text-red-400 text-sm">-${w.costLost?.toFixed(2)}</div>
                  <div className="flex gap-1 border-l border-[#2A353D] pl-3 ml-1">
                    <button onClick={() => setEditWaste({...w})} className="p-1.5 text-slate-400 hover:text-white transition-colors"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteWaste(w)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
            {wasteLogs.filter(w => wasteSearch ? (w.itemName+w.reason+w.loggedBy+w.date).toLowerCase().includes(wasteSearch.toLowerCase()) : w.date === getToday()).length === 0 && <div className="p-4 text-center text-slate-400 font-bold text-sm">No waste logs found.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabInventory;

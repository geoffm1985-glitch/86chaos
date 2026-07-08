import React, { useState } from 'react';
import { Bell, Calendar, Check, Clock, Loader2, Mic, Package, Plus, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { T, db, storage, secureFetch, useLiveCollection, formatClockDateTime, getToday, logAudit } from '../core/appCore';
import { Modal, SmartEmptyState } from '../components/common';
import { canUseMenuIntelligence, getZeroStockMenuImpacts } from '../core/menuIntelligence';
import { makeReminderDate, parseReminderCommand, toDateInputValue, toTimeInputValue } from '../core/reminderUtils';

const getInitialReminderDate = () => {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return { date: toDateInputValue(d), time: toTimeInputValue(d) };
};

const TabPersonalReminders = ({ appUser, addToast }) => {
  const initial = getInitialReminderDate();
  const reminders = useLiveCollection('personalReminders', appUser?.restaurantId, {
    whereClauses: [['userId', '==', appUser?.id || '']],
    limitCount: 200,
    fallbackLimitCount: 100
  });
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dateInput, setDateInput] = useState(initial.date);
  const [timeInput, setTimeInput] = useState(initial.time);
  const [editing, setEditing] = useState(null);
  const [listening, setListening] = useState(false);
  const sortedReminders = [...reminders].sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')));
  const pendingReminders = sortedReminders.filter(r => r.status !== 'done' && r.status !== 'cancelled');
  const completedReminders = sortedReminders.filter(r => r.status === 'done' || r.status === 'cancelled').slice(0, 20);

  const applyParsedText = (value) => {
    const parsed = parseReminderCommand(value);
    if (parsed) {
      setTitle(parsed.title);
      if (parsed.dateInput) setDateInput(parsed.dateInput);
      if (parsed.timeInput) setTimeInput(parsed.timeInput);
      if (parsed.needsManualTime) addToast('Needs Time', 'I found the reminder text. Pick the date and time before saving.');
    } else {
      setTitle(value);
    }
  };

  const startListening = () => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) return addToast('Mic Unavailable', 'This browser does not support built-in speech recognition. Type the reminder instead.');
    try {
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.interimResults = false;
      setListening(true);
      rec.onresult = (event) => {
        const text = event.results?.[0]?.[0]?.transcript || '';
        setListening(false);
        applyParsedText(text);
      };
      rec.onerror = () => { setListening(false); addToast('Voice Error', 'Could not hear the reminder clearly.'); };
      rec.onend = () => setListening(false);
      rec.start();
    } catch (err) {
      setListening(false);
      addToast('Voice Error', 'Could not start the microphone.');
    }
  };

  const resetForm = () => {
    const next = getInitialReminderDate();
    setTitle('');
    setNotes('');
    setDateInput(next.date);
    setTimeInput(next.time);
    setEditing(null);
  };

  const saveReminder = async (e) => {
    e.preventDefault();
    if (!title.trim()) return addToast('Missing Text', 'Type what you want to be reminded about.');
    const scheduledDate = makeReminderDate(dateInput, timeInput);
    if (!scheduledDate) return addToast('Missing Time', 'Choose a valid reminder date and time.');
    const payload = {
      restaurantId: appUser.restaurantId,
      userId: appUser.id || '',
      userEmail: appUser.email || '',
      title: title.trim(),
      notes: notes.trim(),
      scheduledAt: scheduledDate.toISOString(),
      status: 'scheduled',
      updatedAt: new Date().toISOString(),
      source: editing ? 'manual_update' : 'manual_private_reminder'
    };
    if (editing?.id) {
      await updateDoc(doc(db, 'personalReminders', editing.id), payload);
      addToast('Reminder Updated', title.trim());
    } else {
      await addDoc(collection(db, 'personalReminders'), {
        ...payload,
        createdAt: new Date().toISOString(),
        createdBy: appUser.id || '',
        dispatchedAt: null,
        dispatchKey: ''
      });
      addToast('Reminder Saved', `${title.trim()} at ${formatClockDateTime(scheduledDate.toISOString())}.`);
    }
    await logAudit(appUser, editing ? 'REMINDER_UPDATED' : 'REMINDER_CREATED', title.trim(), scheduledDate.toISOString());
    resetForm();
  };

  const editReminder = (reminder) => {
    const d = reminder.scheduledAt ? new Date(reminder.scheduledAt) : new Date();
    setEditing(reminder);
    setTitle(reminder.title || '');
    setNotes(reminder.notes || '');
    setDateInput(toDateInputValue(d));
    setTimeInput(toTimeInputValue(d));
  };

  const markDone = async (reminder) => {
    await updateDoc(doc(db, 'personalReminders', reminder.id), { status: 'done', completedAt: new Date().toISOString() });
    addToast('Reminder Done', reminder.title || 'Reminder');
  };

  const removeReminder = async (reminder) => {
    if (!window.confirm('Delete this private reminder?')) return;
    await deleteDoc(doc(db, 'personalReminders', reminder.id));
    addToast('Reminder Deleted', reminder.title || 'Reminder');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A353D] pb-3">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-white"><Bell size={24} className={T.copper}/> My Reminders</h2>
          <p className="text-xs text-slate-400 font-bold mt-1">Private reminders for this signed-in user only.</p>
        </div>
        <button type="button" onClick={startListening} className={`${T.btnAlt} flex items-center justify-center gap-2 ${listening ? 'text-red-300 border-red-500/40' : ''}`}><Mic size={16}/> {listening ? 'Listening' : 'Speak Reminder'}</button>
      </div>

      <form onSubmit={saveReminder} className={`${T.card} p-4 grid lg:grid-cols-[1.4fr_.7fr_.55fr_auto] gap-3 items-end`}>
        <div>
          <label className={T.label}>Reminder</label>
          <input value={title} onChange={e => setTitle(e.target.value)} onBlur={e => /^remind me/i.test(e.target.value) && applyParsedText(e.target.value)} className={T.input} placeholder="Remind me tomorrow at 9 AM to order buns" />
        </div>
        <div>
          <label className={T.label}>Date</label>
          <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} className={T.input} />
        </div>
        <div>
          <label className={T.label}>Time</label>
          <input type="time" value={timeInput} onChange={e => setTimeInput(e.target.value)} className={T.input} />
        </div>
        <button className={`${T.btn} h-11 flex items-center justify-center gap-2`}>{editing ? <Save size={16}/> : <Plus size={16}/>} {editing ? 'Save' : 'Add'}</button>
        <div className="lg:col-span-4">
          <label className={T.label}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className={T.input} placeholder="Optional private note" />
          {editing && <button type="button" onClick={resetForm} className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Cancel edit</button>}
        </div>
      </form>

      <div className="grid lg:grid-cols-[1fr_.8fr] gap-4">
        <div className={`${T.card} overflow-hidden`}>
          <div className={T.th}>Upcoming</div>
          {pendingReminders.length === 0 ? <SmartEmptyState title="No reminders yet" desc="Add one by typing or using the mic." /> : pendingReminders.map(reminder => (
            <div key={reminder.id} className={`${T.row} flex items-center justify-between gap-3`}>
              <div className="min-w-0">
                <div className="font-black text-white text-sm truncate">{reminder.title}</div>
                <div className="text-[10px] text-[#D4A381] font-black uppercase tracking-widest mt-1 flex items-center gap-1"><Clock size={12}/> {reminder.scheduledAt ? formatClockDateTime(reminder.scheduledAt) : 'No time'}</div>
                {reminder.notes && <div className="text-xs text-slate-500 font-bold mt-1 truncate">{reminder.notes}</div>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => markDone(reminder)} className="p-2 rounded-lg bg-emerald-900/20 text-emerald-300 border border-emerald-900/50"><Check size={16}/></button>
                <button onClick={() => editReminder(reminder)} className="p-2 rounded-lg bg-[#12161A] text-slate-300 border border-[#2A353D]"><Calendar size={16}/></button>
                <button onClick={() => removeReminder(reminder)} className="p-2 rounded-lg bg-red-900/20 text-red-300 border border-red-900/50"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
        <div className={`${T.card} overflow-hidden`}>
          <div className={T.th}>Recently Closed</div>
          {completedReminders.length === 0 ? <div className="p-6 text-center text-xs font-bold text-slate-500">Completed and cancelled reminders show here.</div> : completedReminders.map(reminder => (
            <div key={reminder.id} className={`${T.row}`}>
              <div className="font-bold text-slate-300 text-sm line-through">{reminder.title}</div>
              <div className="text-[10px] text-slate-500 font-bold mt-1">{reminder.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TabMenuIntelligence = ({ appUser, clientData, inventoryItems = [], addToast }) => {
  const allowed = canUseMenuIntelligence(appUser, clientData);
  const menuDependencies = useLiveCollection('menuDependencies', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && allowed, limitCount: 500 });
  const scans = useLiveCollection('menuIntelligenceScans', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && allowed, limitCount: 60 });
  const [file, setFile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const impacts = getZeroStockMenuImpacts(inventoryItems, menuDependencies);

  if (!allowed) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className={`${T.card} p-8 text-center`}>
          <Sparkles className="mx-auto text-slate-500 mb-3" size={38}/>
          <h2 className="text-xl font-black text-white">Menu Intelligence is owner controlled</h2>
          <p className="text-sm text-slate-400 font-bold mt-2">Ask the account owner to grant Menu Intelligence access in Settings.</p>
        </div>
      </div>
    );
  }

  const scanMenu = async () => {
    if (!file) return addToast('Choose File', 'Upload a menu image or PDF first.');
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90);
      const path = `${appUser.restaurantId}/menuUploads/menu-${Date.now()}-${safeName}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
      const downloadUrl = await getDownloadURL(fileRef);
      const response = await secureFetch('/api/scan-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          fileName: file.name,
          contentType: file.type,
          storagePath: path,
          downloadUrl,
          inventoryItems: inventoryItems.map(i => ({ id: i.id, name: i.name, category: i.category }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || 'Menu scan failed.');
      setScanResult({ ...result, storagePath: path, downloadUrl, fileName: file.name });
      setReviewOpen(true);
      addToast('Menu Scanned', 'Review the AI matches before saving.');
    } catch (err) {
      addToast('Scan Failed', err.message || 'Could not scan menu.');
    }
    setBusy(false);
  };

  const updateMenuItem = (itemIdx, patch) => {
    const menuItems = [...(scanResult?.menuItems || [])];
    menuItems[itemIdx] = { ...menuItems[itemIdx], ...patch };
    setScanResult({ ...scanResult, menuItems });
  };

  const updateIngredient = (itemIdx, ingIdx, patch) => {
    const menuItems = [...(scanResult?.menuItems || [])];
    const ingredients = [...(menuItems[itemIdx].ingredients || [])];
    ingredients[ingIdx] = { ...ingredients[ingIdx], ...patch };
    menuItems[itemIdx] = { ...menuItems[itemIdx], ingredients };
    setScanResult({ ...scanResult, menuItems });
  };

  const approveMenu = async () => {
    const menuItems = scanResult?.menuItems || [];
    let saved = 0;
    for (const item of menuItems) {
      for (const ingredient of item.ingredients || []) {
        if (!ingredient.matchedInventoryItemId) continue;
        const inventoryItem = inventoryItems.find(inv => inv.id === ingredient.matchedInventoryItemId);
        await addDoc(collection(db, 'menuDependencies'), {
          restaurantId: appUser.restaurantId,
          menuItemName: item.name || 'Menu item',
          menuCategory: item.category || '',
          menuDescription: item.description || '',
          ingredientName: ingredient.name || inventoryItem?.name || '',
          inventoryItemId: ingredient.matchedInventoryItemId,
          inventoryItemName: inventoryItem?.name || ingredient.matchedInventoryItemName || ingredient.name || '',
          confidence: ingredient.confidence || item.confidence || 'reviewed',
          source: 'menu_intelligence_ai_review',
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: appUser.name || appUser.email || appUser.id || '',
          scanFileName: scanResult.fileName || '',
          scanStoragePath: scanResult.storagePath || ''
        });
        saved++;
      }
    }
    await addDoc(collection(db, 'menuIntelligenceScans'), {
      restaurantId: appUser.restaurantId,
      fileName: scanResult.fileName || '',
      storagePath: scanResult.storagePath || '',
      downloadUrl: scanResult.downloadUrl || '',
      menuItemCount: menuItems.length,
      dependencyCount: saved,
      status: 'approved',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: appUser.id || ''
    });
    await logAudit(appUser, 'MENU_INTELLIGENCE_APPROVED', `${menuItems.length} menu items`, `${saved} dependencies`);
    addToast('Menu Intelligence Saved', `${saved} ingredient links approved.`);
    setReviewOpen(false);
    setScanResult(null);
    setFile(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A353D] pb-3">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-white"><Sparkles size={24} className={T.copper}/> Menu Intelligence</h2>
          <p className="text-xs text-slate-400 font-bold mt-1">Upload a menu, review AI ingredient links, and let 86 alerts show menu impact.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_.9fr] gap-4">
        <div className={`${T.card} p-4 space-y-4`}>
          <div className="border border-dashed border-[#2A353D] rounded-xl p-5 text-center bg-[#12161A]">
            <Upload className="mx-auto text-[#D4A381] mb-3" size={30}/>
            <label className={`${T.btnAlt} inline-flex items-center gap-2 cursor-pointer`}>
              Choose Menu Image or PDF
              <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
            <div className="text-xs font-bold text-slate-400 mt-3">{file ? file.name : 'No file selected'}</div>
          </div>
          <button onClick={scanMenu} disabled={busy || !file} className={`${T.btn} w-full flex items-center justify-center gap-2 disabled:opacity-50`}>{busy ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>} Scan Menu</button>
          <div className="text-[10px] text-slate-500 font-bold leading-snug">AI results are not saved until you approve them. Regular staff cannot browse uploaded menu records unless the owner grants access.</div>
        </div>

        <div className={`${T.card} overflow-hidden`}>
          <div className={T.th}>Current Menu Impacts</div>
          {impacts.length === 0 ? <div className="p-6 text-center text-xs text-slate-500 font-bold">No zero-stock menu impacts found yet.</div> : impacts.slice(0, 10).map(row => (
            <div key={row.item.id} className={`${T.row}`}>
              <div className="font-black text-white text-sm flex items-center gap-2"><Package size={14} className="text-red-300"/> {row.item.name}</div>
              <div className="text-[10px] text-red-200 font-bold mt-1">Impacts: {row.impacts.map(i => i.name).join(', ')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${T.card} overflow-hidden`}>
        <div className={T.th}>Recent Menu Scans</div>
        {scans.length === 0 ? <div className="p-6 text-center text-xs text-slate-500 font-bold">No approved menu scans yet.</div> : scans.slice(0, 12).map(scan => (
          <div key={scan.id} className={`${T.row} flex justify-between gap-3`}>
            <div className="min-w-0"><div className="font-black text-white text-sm truncate">{scan.fileName || 'Menu scan'}</div><div className="text-[10px] text-slate-500 font-bold mt-1">{scan.menuItemCount || 0} menu items, {scan.dependencyCount || 0} links</div></div>
            <div className="text-[10px] text-[#D4A381] font-black uppercase tracking-widest">{scan.status || 'saved'}</div>
          </div>
        ))}
      </div>

      <Modal isOpen={reviewOpen} onClose={() => setReviewOpen(false)} title="Review Menu Intelligence" sizeClass="max-w-5xl">
        <div className="space-y-4">
          {(scanResult?.menuItems || []).length === 0 ? <SmartEmptyState title="Nothing found" desc="The scanner did not return menu items." /> : (scanResult.menuItems || []).map((item, itemIdx) => (
            <div key={itemIdx} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 space-y-3">
              <div className="grid sm:grid-cols-[1fr_.45fr] gap-2">
                <input value={item.name || ''} onChange={e => updateMenuItem(itemIdx, { name: e.target.value })} className={T.input} placeholder="Menu item name" />
                <input value={item.category || ''} onChange={e => updateMenuItem(itemIdx, { category: e.target.value })} className={T.input} placeholder="Category" />
              </div>
              <textarea value={item.description || ''} onChange={e => updateMenuItem(itemIdx, { description: e.target.value })} className={T.input} rows={2} placeholder="Description" />
              <div className="space-y-2">
                {(item.ingredients || []).map((ingredient, ingIdx) => (
                  <div key={ingIdx} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input value={ingredient.name || ''} onChange={e => updateIngredient(itemIdx, ingIdx, { name: e.target.value })} className={T.input} placeholder="Ingredient" />
                    <select value={ingredient.matchedInventoryItemId || ''} onChange={e => updateIngredient(itemIdx, ingIdx, { matchedInventoryItemId: e.target.value })} className={T.input}>
                      <option value="">No inventory match</option>
                      {inventoryItems.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                    </select>
                    <button type="button" onClick={() => {
                      const ingredients = [...(item.ingredients || [])];
                      ingredients.splice(ingIdx, 1);
                      updateMenuItem(itemIdx, { ingredients });
                    }} className="p-3 rounded-xl border border-red-900/50 text-red-300 bg-red-900/10"><X size={16}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => updateMenuItem(itemIdx, { ingredients: [...(item.ingredients || []), { name: '', matchedInventoryItemId: '', confidence: 'manual' }] })} className={T.btnAlt}>Add Ingredient</button>
              </div>
            </div>
          ))}
          <button onClick={approveMenu} className={`${T.btn} w-full flex items-center justify-center gap-2`}><Check size={18}/> Approve Reviewed Menu Links</button>
        </div>
      </Modal>
    </div>
  );
};

export { TabPersonalReminders, TabMenuIntelligence };

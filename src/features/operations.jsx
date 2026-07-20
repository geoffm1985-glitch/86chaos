import React, { useState, useEffect, useRef } from 'react';
import { Archive, Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe, Sparkles } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon, getRestaurantExportPrefix, safeFilenamePart, downloadCsvRows, openPrintableReport, buildMenuDependencyReport, safeWriteWithQueue, replayOfflineQueue } from '../core/appCore';
import { buildPrepCreatePayload, buildPrepQuantityUpdate, findPrepMatch, formatPrepAmount, parsePrepCommandItems, summarizePrepResults } from '../core/smartPrep';
import { buildEightySixAlertDetails, buildMenuImpactText, getMenuImpactForInventoryItem, getZeroStockMenuImpacts, resolveEightySixInventoryMatch } from '../core/menuIntelligence';
import { prepareScannerUploadFile, isPdfFile } from '../core/fileCompression';
import { createAiScanIdempotencyKey, resolveClientScanPageCount, normalizeAiUsage, aiPageLimitMessage } from '../core/aiScanUsage';
import { buildAiOrderAssistant, formatAiOrderDraftText, summarizeAiOrderAssistant } from '../core/aiOrderAssistant';
import { classifyInvoiceRow, inferInvoiceProductFields, invoiceProductKey, invoiceRowText, isPurchasedInvoiceLine, LEADING_PURCHASE_RE, normalizeInvoiceName as normalizeName, normalizeInvoiceSku as normalizeSku } from '../core/invoiceRowClassification';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';
import { usePlanAccess } from '../hooks/usePlanAccess';
import { FEATURE_KEYS } from '../config/plans';

const readableApiError = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || value.name || 'Unknown error';
  if (typeof value === 'object') {
    const direct = value.message || value.error || value.detail || value.reason || value.code;
    if (direct && direct !== value) return readableApiError(direct);
    try { return JSON.stringify(value); } catch (err) { return String(value); }
  }
  return String(value);
};


const PREP_TASK_TEMPLATE_PACKS = {
  kitchenOpenClose: {
    label: 'Kitchen Open/Close',
    items: [
      { title: 'AM line temp check', category: 'General', frequency: 'daily' },
      { title: 'PM line flip and label sweep', category: 'General', frequency: 'daily' },
      { title: 'Clean fryer filter area', category: 'Cleaning', frequency: 'weekly', targetDay: 'Monday' },
      { title: 'Deep clean grill backsplash', category: 'Cleaning', frequency: 'weekly', targetDay: 'Wednesday' },
      { title: 'Monthly dry storage wipe-down', category: 'Cleaning', frequency: 'monthly', targetDate: '1' }
    ]
  },
  prepRhythm: {
    label: 'Prep Rhythm',
    items: [
      { title: 'Check sauces and dressings', category: 'General', frequency: 'daily' },
      { title: 'Portion burger toppings', category: 'General', frequency: 'daily' },
      { title: 'Build weekend prep list', category: 'General', frequency: 'weekly', targetDay: 'Thursday' },
      { title: 'Freezer pull audit', category: 'General', frequency: 'weekly', targetDay: 'Sunday' },
      { title: 'Review par levels', category: 'General', frequency: 'monthly', targetDate: '15' }
    ]
  }
};

const TabPrep = ({ currentDate, appUser, addToast, setLabelsToPrint }) => {
  const prepItems = useLiveCollection('prepItems', appUser?.restaurantId, { limitCount: 250 });
  const tasks = useLiveCollection('tasks', appUser?.restaurantId, { limitCount: 350 });
  const [subTab, setSubTab] = useState('prep');
  const [prepDate, setPrepDate] = useState(currentDate);
  useEffect(() => {
    try {
      if (sessionStorage.getItem('prepFocus') === 'plan') {
        sessionStorage.removeItem('prepFocus');
        setSubTab('prep');
        setTaskFreq('daily');
      }
    } catch (e) {}
  }, []);

  // --- USDA Food Safety Standards Engine ---
  const USDA_CATEGORIES = {
    'Cold Holding (≤ 41°F)': { max: 41 },
    'Hot Holding (≥ 135°F)': { min: 135 },
    'Poultry / Reheat (≥ 165°F)': { min: 165 },
    'Ground Meats (≥ 155°F)': { min: 155 },
    'Whole Meats / Fish (≥ 145°F)': { min: 145 }
  };

  const evaluateTemp = (temp, cat) => {
    const rules = USDA_CATEGORIES[cat];
    if (!rules) return 'Unknown';
    const t = parseFloat(temp);
    if (rules.max && t > rules.max) return 'Danger';
    if (rules.min && t < rules.min) return 'Danger';
    return 'Safe';
  };

  // Sync internal prepDate with global currentDate
  useEffect(() => { setPrepDate(currentDate); }, [currentDate]);

  // Permissions
  const canManageLineChecks = appUser?.isAdmin || appUser?.permissions?.team || appUser?.permissions?.prep;
  const safePrepWrite = (args) => safeWriteWithQueue({ user: appUser, addToast, ...args });

  // Local selection state (Fixes checkboxes staying checked across days)
  const [selectedPreps, setSelectedPreps] = useState([]);
  useEffect(() => { setSelectedPreps([]); }, [prepDate]);

  // Prep Form State
  const [text, setText] = useState(''); 
  const [station, setStation] = useState('Grill'); 
  const dbPrepCats = useLiveCollection('prepCategories', appUser?.restaurantId, { limitCount: 100 }); 
  const displayStations = dbPrepCats.length > 0 ? dbPrepCats.map(c => c.name).sort() : ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'];
  const [isMaster, setIsMaster] = useState(true);
  
  // Task Form State
  const [taskText, setTaskText] = useState(''); 
  const [taskCat, setTaskCat] = useState('Cleaning'); 
  const [taskFreq, setTaskFreq] = useState('daily');
  const [taskTargetDay, setTaskTargetDay] = useState('Monday'); 
  const [taskTargetDate, setTaskTargetDate] = useState('1');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskTemplatePack, setTaskTemplatePack] = useState('kitchenOpenClose');

  // Line Check State
  const lineChecks = useLiveCollection('lineCheckItems', appUser?.restaurantId, { limitCount: 150 });
  const tempLogs = useLiveCollection('tempLogs', appUser?.restaurantId, { limitCount: 150 });
  
  const [lcSearch, setLcSearch] = useState('');
  const [lcName, setLcName] = useState('');
  const [lcCat, setLcCat] = useState('Cold Holding (≤ 41°F)');
  const [temps, setTemps] = useState({});
  const [correctiveActions, setCorrectiveActions] = useState({});
  const [editLineCheckItem, setEditLineCheckItem] = useState(null);

  // --- PREP LOGIC ---
  const activePrep = prepItems.filter(p => p.date === prepDate || p.isMaster);
  const selectedActivePrep = activePrep.filter(item => selectedPreps.includes(item.id));
  
  const handleAddPrep = async (e) => { 
    e.preventDefault(); 
    if(text.trim()) { 
      const parsedItems = parsePrepCommandItems(text);
      const results = [];
      const firstTargetDate = parsedItems.find(item => item.prepDate)?.prepDate || '';
      for (const parsed of parsedItems.length ? parsedItems : [{ itemText: text.trim(), amount: 1, unit: 'item', increment: false }]) {
        const targetPrepDate = parsed.prepDate || prepDate;
        const activePrepForDate = prepItems.filter(p => p.date === targetPrepDate || p.isMaster);
        const match = findPrepMatch(activePrepForDate, parsed, targetPrepDate);
        if (match?.id) {
          await safePrepWrite({
            action: 'update',
            collectionName: "prepItems",
            docId: match.id,
            label: "Prep quantity",
            before: match,
            data: buildPrepQuantityUpdate({ existingItem: match, parsedItem: parsed, actorName: appUser.name, prepDate: targetPrepDate, source: 'manual_smart_prep' })
          });
          results.push({ type: 'updated', name: match.text || parsed.itemText });
        } else {
          await safePrepWrite({
            action: 'add',
            collectionName: "prepItems",
            label: "Prep item",
            data: buildPrepCreatePayload({ parsedItem: parsed, appUser, prepDate: targetPrepDate, station, isMaster: parsed.prepDate ? false : isMaster, sourceText: text, source: 'manual_smart_prep' })
          });
          results.push({ type: 'created', name: parsed.itemText });
        }
      }
      if (firstTargetDate) setPrepDate(firstTargetDate);
      if (addToast) addToast('Prep Updated', summarizePrepResults(results));
      setText(''); 
    } 
  };
  
  const toggleSelection = (id) => {
    setSelectedPreps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePrepStatus = async (item) => { 
    if (item.isMaster) { 
      const dts = {...(item.completedDates||{})}; 
      if (dts[prepDate]) {
        delete dts[prepDate]; 
      } else {
        dts[prepDate] = appUser.name;
      }
      await safePrepWrite({ action: 'update', collectionName: "prepItems", docId: item.id, label: "Prep completion", before: item, data: { completedDates: dts } }); 
    } else { 
      await safePrepWrite({ action: 'update', collectionName: "prepItems", docId: item.id, label: "Prep completion", before: item, data: { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null } }); 
    } 
  };
  
  const groupedPrep = activePrep.reduce((acc, i) => { const s = i.station || 'General'; if(!acc[s]) acc[s]=[]; acc[s].push(i); return acc; }, {});

  // --- LINE CHECK LOGIC ---
  const handleAddLineCheck = async (e) => {
    e.preventDefault();
    if(lcName.trim()) {
      await safePrepWrite({ action: 'add', collectionName: "lineCheckItems", label: "Line check item", data: {
        name: lcName.trim(),
        category: lcCat,
        restaurantId: appUser.restaurantId
      } });
      setLcName('');
    }
  };

  const handleSaveLineCheckEdit = async (e) => {
    e.preventDefault();
    await safePrepWrite({ action: 'update', collectionName: "lineCheckItems", docId: editLineCheckItem.id, label: "Line check item", before: editLineCheckItem, data: {
      name: editLineCheckItem.name.trim(),
      category: editLineCheckItem.category
    } });
    setEditLineCheckItem(null);
  };

  const handleLogTemp = async (item) => {
    const val = temps[item.id];
    if (!val) return;
    
    const status = evaluateTemp(val, item.category);
    const correctiveAction = String(correctiveActions[item.id] || '').trim();
    if (status === 'Danger' && !correctiveAction) {
      alert('Corrective action is required for an out-of-range temperature. Example: moved to walk-in, discarded, reheated to safe temp, called manager.');
      return;
    }
    
    await safePrepWrite({ action: 'add', collectionName: "tempLogs", label: "Temperature log", data: {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      temp: parseFloat(val),
      status: status,
      correctiveAction,
      managerReviewRequired: status === 'Danger',
      reviewedByManager: false,
      loggedBy: appUser.name,
      date: getToday(),
      timestamp: new Date().toISOString(),
      restaurantId: appUser.restaurantId
    } });
    
    setTemps({...temps, [item.id]: ''});
    setCorrectiveActions({...correctiveActions, [item.id]: ''});
  };

  const filteredLineChecks = lineChecks
    .filter(lc => (lc.name || '').toLowerCase().includes(lcSearch.toLowerCase()))
    .sort((a, b) => a.category.localeCompare(b.category));

  // --- TASK LOGIC ---
  const handleAddTask = async (e) => { 
    e.preventDefault(); 
    if(taskText.trim()) { 
      if (editingTaskId) {
        await safePrepWrite({ action: 'update', collectionName: "tasks", docId: editingTaskId, label: "Task", data: { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null } });
        setEditingTaskId(null);
      } else {
        await safePrepWrite({ action: 'add', collectionName: "tasks", label: "Task", data: { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null, completions: {}, restaurantId: appUser.restaurantId } }); 
      }
      setTaskText(''); 
    } 
  };


  const addTaskTemplatePack = async () => {
    const pack = PREP_TASK_TEMPLATE_PACKS[taskTemplatePack] || PREP_TASK_TEMPLATE_PACKS.kitchenOpenClose;
    const existingKeys = new Set(tasks.map(t => `${String(t.title || '').toLowerCase()}|${t.frequency || 'daily'}|${t.targetDay || ''}|${t.targetDate || ''}`));
    const toCreate = (pack.items || []).filter(t => !existingKeys.has(`${String(t.title || '').toLowerCase()}|${t.frequency || 'daily'}|${t.targetDay || ''}|${t.targetDate || ''}`));
    if (!toCreate.length) return addToast('Templates Already Loaded', `${pack.label} is already present.`);
    for (const t of toCreate) {
      await safePrepWrite({ quiet: true, action: 'add', collectionName: 'tasks', label: 'Recurring prep template', data: { ...t, completions: {}, restaurantId: appUser.restaurantId, source: 'prep-template-pack', templatePack: taskTemplatePack, createdAt: new Date().toISOString(), createdBy: appUser?.name || appUser?.email || '86 Chaos' } });
    }
    addToast('Prep Templates Added', `${toCreate.length} recurring task template(s) added.`);
  };

  const editTask = (t) => {
    setTaskText(t.title);
    setTaskCat(t.category || 'Cleaning');
    setTaskFreq(t.frequency || 'daily');
    if (t.frequency === 'weekly') setTaskTargetDay(t.targetDay || 'Monday');
    if (t.frequency === 'monthly') setTaskTargetDate(t.targetDate || '1');
    setEditingTaskId(t.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelTaskEdit = () => {
    setTaskText('');
    setEditingTaskId(null);
  };
  
  const getTaskPeriodKey = (freq) => {
    if (freq === 'daily') return prepDate;
    if (freq === 'weekly') { 
      const d = new Date(prepDate+'T12:00:00'); 
      const day = d.getDay(); 
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); 
      return formatDate(d); 
    }
    if (freq === 'monthly') return prepDate.substring(0, 7);
  };

  const toggleTaskStatus = async (task) => {
    const periodKey = getTaskPeriodKey(task.frequency);
    const updatedCompletions = { ...(task.completions || {}) };
    if (updatedCompletions[periodKey]) { 
      delete updatedCompletions[periodKey]; 
    } else { 
      updatedCompletions[periodKey] = { by: appUser.name, at: formatClockTime(new Date()) }; 
    }
    await safePrepWrite({ action: 'update', collectionName: "tasks", docId: task.id, label: "Task completion", before: task, data: { completions: updatedCompletions } });
  };

  const renderTasks = (freqFilter) => {
    const filteredTasks = tasks.filter(t => t.frequency === freqFilter);
    const grouped = filteredTasks.reduce((acc, t) => { if(!acc[t.category]) acc[t.category]=[]; acc[t.category].push(t); return acc; }, { 'Cleaning': [], 'General': [] });
    const periodKey = getTaskPeriodKey(freqFilter);
    
    return (
      <div className="space-y-4 mt-4">
        {canManageLineChecks && (
          <form onSubmit={handleAddTask} className={`${T.card} p-3 flex flex-col md:flex-row gap-2 items-center bg-[#1A2126]`}>
            {editingTaskId && <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2 whitespace-nowrap">Editing Task</div>}
            <input type="text" value={taskText} onChange={e=>setTaskText(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-sm font-medium text-white" placeholder={`New ${freqFilter} task...`} required/>
            <div className="flex w-full md:w-auto gap-2">
              <select value={taskCat} onChange={e=>setTaskCat(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white"><option>Cleaning</option><option>General</option></select>
              {freqFilter === 'weekly' && <select value={taskTargetDay} onChange={e=>setTaskTargetDay(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d}>{d}</option>)}</select>}
              {freqFilter === 'monthly' && <select value={taskTargetDate} onChange={e=>setTaskTargetDate(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white">{Array.from({length:31}).map((_,i)=><option key={i+1}>{i+1}</option>)}</select>}
              <button type="submit" className={`${T.btn} px-4 py-2 flex items-center justify-center`}>{editingTaskId ? <Check size={18}/> : <Plus size={18}/>}</button>
              {editingTaskId && <button type="button" onClick={cancelTaskEdit} className={`${T.btnAlt} px-4 py-2 flex items-center justify-center border-red-900/50 text-red-400 hover:text-red-300`}><X size={18}/></button>}
            </div>
          </form>
        )}

        {canManageLineChecks && (
          <div className={`${T.card} p-3 bg-[#0B0E11] border-dashed flex flex-col sm:flex-row gap-2 sm:items-center justify-between`}>
            <div><div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Recurring Prep Templates</div><div className="text-[11px] text-slate-400 font-bold">Load a starter pack of daily, weekly, and monthly kitchen tasks. Existing matching tasks are skipped.</div></div>
            <div className="flex gap-2 w-full sm:w-auto"><select value={taskTemplatePack} onChange={e => setTaskTemplatePack(e.target.value)} className={`${T.input} text-xs`}>
              {Object.entries(PREP_TASK_TEMPLATE_PACKS).map(([key, pack]) => <option key={key} value={key}>{pack.label}</option>)}
            </select><button type="button" onClick={addTaskTemplatePack} className={T.btnAlt}>Load</button></div>
          </div>
        )}

        {['Cleaning', 'General'].map(cat => {
          if (grouped[cat].length === 0) return null;
          return (
            <div key={cat} className={`${T.card} overflow-hidden`}>
              <div className={T.th}><span>{cat} Tasks</span></div>
              <div className={`divide-y ${T.border}`}>
                {grouped[cat].map(t => {
                  const completion = t.completions?.[periodKey];
                  const isDone = !!completion;
                  return (
                    <div key={t.id} className={`${T.row} flex items-center justify-between gap-3`}>
                      <div>
                        <div className={`text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>{t.title}</div>
                        <div className={`text-[9px] font-black uppercase mt-1 flex gap-2`}>
                          {freqFilter === 'weekly' && <span className="text-[#D4A381]">Due: {t.targetDay}s</span>}
                          {freqFilter === 'monthly' && <span className="text-[#D4A381]">Due: {t.targetDate}{t.targetDate.endsWith('1') && t.targetDate !== '11' ? 'st' : t.targetDate.endsWith('2') && t.targetDate !== '12' ? 'nd' : t.targetDate.endsWith('3') && t.targetDate !== '13' ? 'rd' : 'th'}</span>}
                          {isDone && <span className="text-emerald-500 tracking-wider">✓ {completion.by} @ {completion.at}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>toggleTaskStatus(t)} className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all ${isDone ? 'bg-[#12161A] text-emerald-500 border border-emerald-900/50' : `${T.grad} text-slate-900`}`}>{isDone ? <Check size={20}/> : <div className="w-4 h-4 border-2 border-slate-900 rounded-sm"></div>}</button>
                        {canManageLineChecks && <button onClick={()=>editTask(t)} className="text-slate-500 hover:text-[#D4A381] p-2"><Edit size={16}/></button>}
                        {canManageLineChecks && <button onClick={()=>safePrepWrite({ action: "delete", collectionName: "tasks", docId: t.id, label: "Task", before: t })} className="text-slate-500 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-40">
      
      {/* EDIT LINE CHECK MODAL */}
      <Modal isOpen={!!editLineCheckItem} onClose={() => setEditLineCheckItem(null)} title="Edit Line Check">
        {editLineCheckItem && (
          <form onSubmit={handleSaveLineCheckEdit} className="space-y-4">
            <div>
              <label className={T.label}>Item / Cooler Name</label>
              <input type="text" value={editLineCheckItem.name} onChange={e=>setEditLineCheckItem({...editLineCheckItem, name: e.target.value})} className={T.input} required />
            </div>
            <div>
              <label className={T.label}>USDA Safe Temp Rule</label>
              <select value={editLineCheckItem.category} onChange={e=>setEditLineCheckItem({...editLineCheckItem, category: e.target.value})} className={T.input}>
                {Object.keys(USDA_CATEGORIES).map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className={`w-full ${T.btn}`}>Save Changes</button>
          </form>
        )}
      </Modal>

      <div className="flex flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['prep', 'line-check', 'daily', 'weekly', 'monthly'].map((tab) => (
          <button key={tab} onClick={() => { setSubTab(tab); if(tab !== 'prep' && tab !== 'line-check') setTaskFreq(tab); }} className={`px-3 sm:px-5 py-2.5 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all flex-1 sm:flex-none ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab === 'prep' ? 'Food Prep' : tab === 'line-check' ? 'Line Check' : `${tab} Tasks`}
          </button>
        ))}
      </div>

      {subTab === 'line-check' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
              <input type="text" placeholder="Search logs & coolers..." value={lcSearch} onChange={e=>setLcSearch(e.target.value)} className={`${T.input} pl-10`} />
            </div>
          </div>

          {canManageLineChecks && (
            <form onSubmit={handleAddLineCheck} className={`${T.card} p-3 flex flex-col sm:flex-row gap-3 items-center bg-[#1A2126]`}>
              <input type="text" value={lcName} onChange={e=>setLcName(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl text-sm outline-none font-medium text-white placeholder-slate-500" placeholder="Add cooler or food item..." required/>
              <div className="flex w-full sm:w-auto gap-2 items-center">
                <select value={lcCat} onChange={e=>setLcCat(e.target.value)} className="w-full sm:w-48 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-[#D4A381]">
                  {Object.keys(USDA_CATEGORIES).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <button type="submit" className={`${T.btn} py-2 px-4 flex-shrink-0`}><Plus size={18}/></button>
              </div>
            </form>
          )}

          <div className={`${T.card} overflow-hidden`}>
            <div className={T.th}>USDA Safety & Temp Log (Today)</div>
            <div className={`divide-y ${T.border}`}>
              {filteredLineChecks.length === 0 && <div className="p-6 text-center font-bold text-slate-500 text-sm">No items configured for line check.</div>}
              {filteredLineChecks.map(item => {
                // Find latest log for this item TODAY
                const todaysLogs = tempLogs.filter(l => l.itemId === item.id && l.date === getToday()).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
                const latestLog = todaysLogs.length > 0 ? todaysLogs[0] : null;

                return (
                  <div key={item.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                    <div className="flex-1">
                      <div className="font-bold text-white text-base">{item.name}</div>
                      <div className="text-[10px] text-[#D4A381] font-black uppercase tracking-widest mt-0.5">{item.category}</div>
                      
                      {latestLog ? (
                        <div className={`text-[10px] font-black mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-md border ${latestLog.status === 'Safe' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
                          <span className="text-sm">{latestLog.temp}°F</span> 
                          <span>({latestLog.status})</span>
                          <span className="opacity-70 font-bold border-l border-current pl-2 ml-1">By {latestLog.loggedBy} at {formatClockTime(latestLog.timestamp)}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">Not logged yet today</div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 md:self-end">
                      <div className="flex items-center gap-1 bg-[#12161A] p-1 rounded-lg border border-[#2A353D]">
                        <input type="number" step="0.1" value={temps[item.id] || ''} onChange={e=>setTemps({...temps, [item.id]: e.target.value})} placeholder="°F" className="w-16 bg-transparent text-white font-black text-center text-sm outline-none" />
                        <button onClick={() => handleLogTemp(item)} disabled={!temps[item.id]} className="bg-slate-800 text-white disabled:opacity-50 px-3 py-1.5 rounded text-xs font-black uppercase hover:bg-slate-700 transition-colors">Log</button>
                        {temps[item.id] && evaluateTemp(temps[item.id], item.category) === 'Danger' && (
                          <input type="text" value={correctiveActions[item.id] || ''} onChange={e=>setCorrectiveActions({...correctiveActions, [item.id]: e.target.value})} placeholder="Corrective action required" className="w-full sm:w-48 bg-red-950/30 border border-red-900/50 text-red-100 rounded-lg px-2 py-1.5 text-xs font-bold outline-none" />
                        )}
                      </div>
                      
                      {canManageLineChecks && (
                        <div className="flex gap-1 border-l border-[#2A353D] pl-3">
                          <button onClick={() => setEditLineCheckItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button>
                          <button onClick={() => { if(window.confirm(`Delete ${item.name}?`)) safePrepWrite({ action: "delete", collectionName: "lineCheckItems", docId: item.id, label: "Line check item", before: item }); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'prep' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-3 flex justify-between items-center bg-[#1A2126]`}>
            <h3 className={`font-black flex items-center gap-2 text-sm text-white uppercase tracking-wider`}><ClipboardList size={18} className={T.copper}/> Target Date:</h3>
            <input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-1.5 bg-[#12161A] border border-[#2A353D] rounded-lg outline-none text-sm font-bold text-[#D4A381] shadow-inner"/>
          </div>
          <form onSubmit={handleAddPrep} className={`${T.card} p-3 flex flex-col sm:flex-row gap-3 items-center bg-[#1A2126]`}>
            <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl text-sm outline-none font-medium text-white placeholder-slate-500" placeholder="Add prep item..." required/>
            <div className="flex w-full sm:w-auto gap-3 items-center">
              <select value={station} onChange={e=>setStation(e.target.value)} className="w-full sm:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-white">{displayStations.map(s => <option key={s} value={s}>{s}</option>)}</select> 
              <label className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold ${T.muted} cursor-pointer`}><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4 accent-[#8F6040] bg-[#12161A] border-[#2A353D] rounded"/> Master</label>
              <button className={`${T.btn} py-2 px-4`}><Plus size={18}/></button>
            </div>
          </form>
          
          <div className={`${T.card} overflow-hidden`}>
            {Object.entries(groupedPrep).map(([stationName, items]) => (
              <div key={stationName}>
                <div className={T.th}><span>{stationName} Station</span><span className="float-right text-slate-500">{items.filter(i => (i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted)).length}/{items.length} Done</span></div>
                <div className={`divide-y ${T.border}`}>
                  {items.map(i=>{
                    const isDone = i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted; 
                    const doneBy = i.isMaster ? i.completedDates?.[prepDate] : i.completedBy; 
                    const qty = i.qty ?? 1;
                    const isSelected = selectedPreps.includes(i.id);
                    
                    return (
                    <div key={i.id} className={`${T.row} ${isSelected ? 'bg-[#12161A]' : ''} flex items-center gap-2`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(i.id)} className="w-5 h-5 rounded accent-[#8F6040] bg-[#12161A] border-[#2A353D] flex-shrink-0 cursor-pointer" />
                      <div className="flex-1 min-w-0"><span className={`text-sm font-bold ${isDone?'line-through text-slate-500':'text-white'}`}>{i.text}</span> {doneBy && <span className={`text-[9px] font-black text-emerald-500 bg-emerald-900/20 border border-emerald-900/50 px-1.5 py-0.5 rounded ml-2`}>✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-slate-500 uppercase mt-0.5">Master Task</span>}</div>
                      {i.quantityChangedAfterCompletion && <span className="text-[9px] font-black text-amber-300 bg-amber-900/20 border border-amber-900/50 px-1.5 py-0.5 rounded">QTY CHANGED</span>}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`flex items-center bg-[#12161A] rounded-lg border ${T.border} h-8`}><button onClick={async ()=> await safePrepWrite({ action: "update", collectionName: "prepItems", docId: i.id, label: "Prep quantity", before: i, data: { qty: Math.max(0, qty - 1), unit: i.unit || 'item', lastQuantityChangeAt: new Date().toISOString(), lastQuantityChangeBy: appUser.name, quantityChangedAfterCompletion: isDone } })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">-</button><span className="min-w-10 px-1 text-center text-xs font-bold text-[#D4A381]">{formatPrepAmount(qty, i.unit)}</span><button onClick={async ()=> await safePrepWrite({ action: "update", collectionName: "prepItems", docId: i.id, label: "Prep quantity", before: i, data: { qty: qty + 1, unit: i.unit || 'item', lastQuantityChangeAt: new Date().toISOString(), lastQuantityChangeBy: appUser.name, quantityChangedAfterCompletion: isDone } })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">+</button></div>
                        <button onClick={()=>togglePrepStatus(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-sm ${isDone?'bg-[#12161A] text-slate-500 border border-[#2A353D]':`${T.grad} text-slate-900`}`}>{isDone ? <Repeat size={14}/> : <Check size={16}/>}</button>
                        <button onClick={()=>{ safePrepWrite({ action: "delete", collectionName: "prepItems", docId: i.id, label: "Prep item", before: i }); }} className="text-slate-500 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ))}
          </div>
          <div className={`fixed bottom-0 left-0 right-0 p-4 bg-[#161D22] border-t ${T.border} z-50 backdrop-blur-md bg-opacity-95`}>
            <div className="max-w-2xl mx-auto flex gap-3">
              <button onClick={() => {
                  if (selectedActivePrep.length === 0) {
                    addToast?.('Choose Prep Items', 'Select at least one item from this prep date before printing labels.');
                    return;
                  }
                  const labels = selectedActivePrep.map((item, index) => ({
                    ...item,
                    printId: `${item.id || 'prep'}-${prepDate}-${index}`,
                    labelQuantity: formatPrepAmount(item.qty ?? 1, item.unit || 'item')
                  }));
                  setLabelsToPrint({items: labels, prepDate});
              }} disabled={selectedActivePrep.length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><ClipboardList size={18}/> Print {selectedActivePrep.length || ''} {selectedActivePrep.length === 1 ? 'Label' : 'Labels'}</button>
              <p className="absolute left-4 right-4 -top-5 text-center text-[10px] font-bold text-slate-500">* Intended for use with Brother QL-810W label printer.</p>
              
              <button onClick={async () => { 
                  for(const item of selectedActivePrep){
                      if(item.isMaster){ 
                          const dts={...(item.completedDates||{})}; 
                          dts[prepDate]=appUser.name; 
                          await safePrepWrite({ action: "update", collectionName: "prepItems", docId: item.id, label: "Prep bulk completion", before: item, data: { completedDates:dts } }); 
                      } else {
                          await safePrepWrite({ action: "update", collectionName: "prepItems", docId: item.id, label: "Prep bulk completion", before: item, data: { isCompleted:true, completedBy:appUser.name } }); 
                      }
                  } 
                  setSelectedPreps([]);
              }} disabled={selectedActivePrep.length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><Check size={18}/> Mark Done</button>
            </div>
          </div>
  
      </div>
      )}

      {subTab !== 'prep' && subTab !== 'line-check' && <div className="animate-[slideIn_0.2s_ease-out]">{renderTasks(subTab)}</div>}
    </div>
  );
};

const TabRecipes = ({ appUser, addToast, voiceRecipeTarget = null }) => {
  const recipes = useLiveCollection('recipes', appUser?.restaurantId, { limitCount: 350 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('All'); 
  const [isFormOpen, setIsFormOpen] = useState(false); 
  const [activeRecipe, setActiveRecipe] = useState(null); 
  const [yieldMult, setYieldMult] = useState(1);
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const safeRecipeWrite = (args) => safeWriteWithQueue({ user: appUser, addToast, ...args });

  // --- SCREEN WAKE LOCK ENGINE ---
  const [isAwake, setIsAwake] = useState(false);
  const [wakeLock, setWakeLock] = useState(null);

  const toggleWakeLock = async () => {
    if (!isAwake) {
      try {
        if ('wakeLock' in navigator) {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
          setIsAwake(true);
          addToast('Screen Awake', 'Screen will stay on. Perfect for messy hands.');
          
          // Browsers automatically release the lock if the user switches tabs/minimizes
          lock.addEventListener('release', () => { setIsAwake(false); setWakeLock(null); });
        } else {
          addToast('Error', 'Screen Wake Lock is not supported on this device/browser.');
        }
      } catch (err) { addToast('Error', err.message); }
    } else {
      if (wakeLock) {
        await wakeLock.release();
        setWakeLock(null);
      }
      setIsAwake(false);
      addToast('Screen Normal', 'Screen sleep timeout restored.');
    }
  };

  const handleScanRecipe = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    addToast('Scanning', 'Optimizing and reading recipe...');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        // Compress the image on the device BEFORE sending it to Vercel/Gemini
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; // Drops a massive photo down to ~200KB instantly
        let scaleSize = 1;
        if (img.width > MAX_WIDTH) {
           scaleSize = MAX_WIDTH / img.width;
        }
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64Compressed = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = base64Compressed.split(',')[1];

        try {
          const idempotencyKey = createAiScanIdempotencyKey('recipe', appUser?.restaurantId);
          // THIS IS THE CRITICAL BLOCK. It MUST explicitly say POST.
          const response = await secureFetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              restaurantId: appUser?.restaurantId,
              idempotencyKey
            })
          });

          // Prevent the "Unexpected token A" HTML crash
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
             throw new Error("Vercel Server Error: Payload too large or backend crashed.");
          }

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to scan recipe.');

          setTitle(data.title || '');
          setPrepTime(data.prepTime || '--');
          setYieldAmt(data.yieldAmt || '--');
          setIngredients(data.ingredients || '');
          setInstructions(data.instructions || '');
          
          setIsFormOpen(true);
          addToast('Success', 'Recipe extracted! Please review.');
        } catch (err) {
          addToast('Error', err.message);
        } finally {
          setIsScanning(false);
        }
      };
    };
    e.target.value = ''; // Reset input so you can scan the same file again if needed
  };
  
  const parseAndMultiply = (text, mult) => { if (mult === 1) return text; const match = text.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s+(.*)/); if (!match) return text; let numStr = match[1], rest = match[2], val = 0; if (numStr.includes('/')) { const parts = numStr.split(' '); if (parts.length === 2) { const [n, d] = parts[1].split('/'); val = parseFloat(parts[0]) + (parseFloat(n) / parseFloat(d)); } else { const [n, d] = numStr.split('/'); val = parseFloat(n) / parseFloat(d); } } else { val = parseFloat(numStr); } let finalVal = val * mult; let cleanVal = Number.isInteger(finalVal) ? finalVal.toString() : finalVal.toFixed(2); if (cleanVal.endsWith('.50')) cleanVal = cleanVal.replace('.50', ' 1/2').trim(); else if (cleanVal.endsWith('.25')) cleanVal = cleanVal.replace('.25', ' 1/4').trim(); else if (cleanVal.endsWith('.75')) cleanVal = cleanVal.replace('.75', ' 3/4').trim(); else if (cleanVal.endsWith('.33')) cleanVal = cleanVal.replace('.33', ' 1/3').trim(); else if (cleanVal.endsWith('.67')) cleanVal = cleanVal.replace('.67', ' 2/3').trim(); if (cleanVal.startsWith('0 ')) cleanVal = cleanVal.substring(2); return `${cleanVal} ${rest}`; };
  
  const [title, setTitle] = useState(''); 
  const [category, setCategory] = useState('Sauce/Dressing'); 
  const [prepTime, setPrepTime] = useState(''); 
  const [yieldAmt, setYieldAmt] = useState(''); 
  const [ingredients, setIngredients] = useState('');
 
  const [instructions, setInstructions] = useState('');
  const categories = ['All', 'Sauce/Dressing', 'Meat Prep', 'Appetizer', 'Entree', 'Side', 'Dessert', 'Cocktail'];

  const resetForm = () => {
    setTitle(''); setCategory('Sauce/Dressing'); setPrepTime(''); setYieldAmt(''); setIngredients(''); setInstructions(''); setEditingRecipeId(null);
  };

  const handleEdit = () => {
    setTitle(activeRecipe.title);
    setCategory(activeRecipe.category || 'Sauce/Dressing');
    setPrepTime(activeRecipe.prepTime === '--' ? '' : activeRecipe.prepTime);
    setYieldAmt(activeRecipe.yieldAmt === '--' ? '' : activeRecipe.yieldAmt);
    setIngredients(activeRecipe.ingredients);
    setInstructions(activeRecipe.instructions);
    setEditingRecipeId(activeRecipe.id);
    setActiveRecipe(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e) => { 
    e.preventDefault(); 
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) return addToast('Error', 'Missing fields.'); 
    try { 
      if (editingRecipeId) {
        await safeRecipeWrite({ action: "update", collectionName: "recipes", docId: editingRecipeId, label: "Recipe", before: recipes.find(r => r.id === editingRecipeId), data: { 
          title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), lastUpdated: new Date().toISOString() 
        } }); 
        addToast('Recipe Updated', `${title} updated successfully.`); 
      } else {
        await safeRecipeWrite({ action: "add", collectionName: "recipes", label: "Recipe", data: { 
          title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), authorName: appUser.name, authorId: appUser.id, lastUpdated: new Date().toISOString(), restaurantId: appUser.restaurantId 
        } }); 
        addToast('Recipe Saved', `${title} added to the book.`); 
      }
      setIsFormOpen(false); 
      resetForm();
    } catch (err) { addToast('Error', 'Could not save.'); } 
  };
  
  const handleDelete = async (id) => { if (!window.confirm("Delete recipe?")) return; await safeRecipeWrite({ action: "delete", collectionName: "recipes", docId: id, label: "Recipe", before: recipes.find(r => r.id === id) }); setActiveRecipe(null); addToast('Deleted', 'Recipe removed.'); };
  
  const handleInjectLegacyRecipes = async () => {
    const legacyData = [
      {
        title: "French Onion Dip", category: "Sauce/Dressing", prepTime: "10 mins", yieldAmt: "--",
        ingredients: "2 Packs French Onion Dip\n3 Cups Cottage Cheese\n3 Cups Sour Cream",
        instructions: "Combine all ingredients.\nUse Vita Mix, leave a little chunky."
      },
      {
        title: "Chili", category: "Entree", prepTime: "1 hour", yieldAmt: "--",
        ingredients: "2 (5lb) Beef logs\nPeppers/Onion\n3 cans Tomato Soup (Basement)\n4 cans Tomato Juice (Basement)\n1 can Chili Bean (Basement)\n1 can Diced Tomato (Basement)\n2 (4oz) cups Chili powder\n1 (4oz) cup Kosher salt\n1 (2oz) cup pepper\n1 (2oz) cup garlic granulated\n1 (2oz) cup oregano\n1 (2oz) cup Italian\n1/2 (2oz) cup red pep flakes",
        instructions: "Brown the beef logs and drain grease.\nSauté peppers and onions.\nCombine beef, sautéed veggies, tomato soup, tomato juice, chili beans, and diced tomatoes in a large pot.\nStir in all seasonings (chili powder, salt, pepper, garlic, oregano, italian, red pepper flakes).\nSimmer until flavors are thoroughly combined."
      },
      {
        title: "Beer Dip", category: "Appetizer", prepTime: "15 mins", yieldAmt: "--",
        ingredients: "2 Bottles Miller Light\n1 package Ranch Seasoning\n1 package Softened Cream Cheese\n3 Cups Shredded Cheese",
        instructions: "Whisk together the Miller Light and Ranch Seasoning.\nHand mix the beer/ranch mixture with the softened cream cheese until whippy.\nFold in the shredded cheese to the mixture. Make sure it is properly mixed to the bottom."
      },
      {
        title: "Beer Cheese", category: "Sauce/Dressing", prepTime: "30 mins", yieldAmt: "--",
        ingredients: "1 lb Butter\n1 lb Flour\n1/2 Tablespoon Dry mustard powder\n1/2 Tablespoon Onion powder\n1/2 Tablespoon Garlic granulated\n1/2 Tablespoon Pepper\n1 Tablespoon Salt\n1 Pint Spotted Cow\n1 gallon milk\n80 slices american (Two Blocks)\n8 cups shredded cheddar",
        instructions: "Start with a gallon of milk over a double boiler.\nIn a separate pot, melt the butter. Once melted, add the flour and all seasonings (mustard, onion, garlic, pepper, salt). Whisk together to make a roux.\nOnce combined, add the pint of Spotted Cow to the roux and mix well.\nOnce the milk is steaming, add your roux and mix thoroughly.\nImmediately after, add the American and cheddar cheeses and mix thoroughly.\nTake off heat and cool down."
      },
      {
        title: "Cheesy Potato Bacon Soup", category: "Side", prepTime: "45 mins", yieldAmt: "2 White Buckets",
        ingredients: "1 White Bucket Peeled Potatoes\n1 1/2 Budlight Pitchers Water\n1 Bag Cheese Mix\n1 Gallon Milk\n1 Bag Bacon Bits\n1 Block American Cheese\n1 Tablespoon granulated garlic\n1 Tablespoon granulated onion\n1 Tablespoon Kosher Salt\n1/2 Tablespoon Black pepper",
        instructions: "Put peeled potatoes through potato slicer and dice small. Boil, then drain.\nUse metal pot for double boiler. Use second metal pot on top.\nBring 1 1/2 Budlight pitchers of water to a steam.\nWhisk 1 bag of cheese mix into the steaming water.\nAdd 1 gallon milk, 1 bag bacon bits, and all seasonings (garlic, onion, salt, pepper).\nGradually add American cheese block by slice. Heat until cheese is thoroughly combined.\nSplit the boiled potatoes and the cheese sauce evenly between two white buckets."
      }
    ];

    let count = 0;
    for (const recipe of legacyData) {
      if (!recipes.find(r => r.title === recipe.title)) {
        await safeRecipeWrite({ action: "add", collectionName: "recipes", label: "Legacy recipe", data: { ...recipe, authorName: "System", authorId: "system", lastUpdated: new Date().toISOString(), restaurantId: appUser.restaurantId } });
        count++;
      }
    }
    addToast('Import Complete', `Injected ${count} legacy recipes.`);
  };

  const normalizeRecipeVoiceText = (value = '') => String(value || '').toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  const findBestRecipeForVoice = (queryText = '') => {
    const q = normalizeRecipeVoiceText(queryText);
    if (!q) return null;
    const qWords = q.split(' ').filter(w => w.length > 2);
    const scored = (recipes || []).map(recipe => {
      const titleText = normalizeRecipeVoiceText(recipe.title || '');
      const ingredientText = normalizeRecipeVoiceText(recipe.ingredients || '').slice(0, 1000);
      let score = 0;
      if (recipe.id && voiceRecipeTarget?.recipeId && recipe.id === voiceRecipeTarget.recipeId) score += 220;
      if (titleText === q) score += 170;
      if (titleText.startsWith(q) || q.startsWith(titleText)) score += 95;
      if (titleText.includes(q) || q.includes(titleText)) score += 70;
      const titleWords = titleText.split(' ').filter(w => w.length > 2);
      const hits = qWords.filter(w => titleWords.some(t => t === w || t.includes(w) || w.includes(t))).length;
      score += hits * 26;
      if (qWords.length && hits === qWords.length) score += 40;
      if (ingredientText && qWords.some(w => ingredientText.includes(w))) score += 8;
      return { recipe, score };
    }).sort((a,b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].recipe : null;
  };

  useEffect(() => {
    if (!voiceRecipeTarget?.id) return;
    const queryText = voiceRecipeTarget.recipeTitle || voiceRecipeTarget.query || '';
    if (!queryText) return;
    setFilterCat('All');
    setSearchTerm(queryText);
    const match = findBestRecipeForVoice(queryText);
    if (match) {
      setActiveRecipe(match);
      setYieldMult(1);
      addToast('Recipe Opened', match.title || queryText);
    } else {
      addToast('Recipe Search', `Searching Recipe Book for “${queryText}”.`);
    }
  }, [voiceRecipeTarget?.id, recipes.length]);

  const filteredRecipes = recipes.filter(r => { const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.ingredients.toLowerCase().includes(searchTerm.toLowerCase()); const matchesCat = filterCat === 'All' || r.category === filterCat; return matchesSearch && matchesCat; }).sort((a,b) => a.title.localeCompare(b.title));

  // Determine if the current user has permission to edit/delete the viewed recipe
  const canManageRecipes = appUser?.isAdmin || appUser?.permissions?.team || appUser?.permissions?.prep || appUser?.isSuperAdmin || (MASTER_ADMIN_EMAIL && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase());
  const canModifyRecipe = activeRecipe && (canManageRecipes || appUser?.id === activeRecipe.authorId);

  return (
    <div className="recipes-desktop max-w-7xl mx-auto space-y-4 pb-12 animate-[slideIn_0.2s_ease-out] recipe-compact">
      
      {/* THE NEW SLEEK CONTROL PANEL */}
      <div className="bg-[#1A2126] border border-[#2A353D] rounded-2xl shadow-lg overflow-hidden mb-4">
        {/* Search / Filter Area */}
        <div className="p-3 sm:p-4 flex flex-col md:flex-row gap-3 border-b border-[#2A353D] bg-[#12161A]/50">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
            <input 
              type="text" 
              placeholder="Search specs or ingredients..." 
              value={searchTerm} 
              onChange={(e)=>setSearchTerm(e.target.value)} 
              className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-sm font-medium rounded-xl pl-11 pr-4 py-3 outline-none focus:border-[#D4A381] transition-colors shadow-inner"
            />
          </div>
          <div className="relative md:w-64 shrink-0">
            <select 
              value={filterCat} 
              onChange={(e)=>setFilterCat(e.target.value)} 
              className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#D4A381] transition-colors appearance-none shadow-inner cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none rotate-90" size={16}/>
          </div>
        </div>

        {/* Action Buttons Area */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Left Side Actions (Screen Lock / Import) */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={toggleWakeLock} 
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${isAwake ? 'bg-amber-900/20 text-amber-400 border-amber-900/50 shadow-[0_0_10px_rgba(251,191,36,0.1)]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:text-amber-400 hover:border-amber-900/50'}`}
              title="Keep Screen On"
            >
              <Sun size={16} className={isAwake ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">{isAwake ? 'Screen Locked' : 'Keep Awake'}</span>
              <span className="sm:hidden">Awake</span>
            </button>

            {(MASTER_ADMIN_EMAIL && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) && (
              <button onClick={handleInjectLegacyRecipes} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[#12161A] text-slate-400 border border-[#2A353D] hover:text-emerald-400 transition-all">
                <Package size={16} /> <span className="hidden sm:inline">Import</span>
              </button>
            )}
          </div>

          {/* Right Side Actions (AI Scan & New Spec) */}
          {canManageRecipes && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
              
              {/* Unified Scan/Upload Button */}
              <div className={`flex w-full sm:w-auto bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-slate-300 hover:text-[#D4A381]" title="Take Photo">
                    {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                    <span className="text-[11px] font-black uppercase tracking-widest sm:hidden">Photo</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleScanRecipe} className="hidden" disabled={isScanning} />
                 </label>
                 <label className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-[#1A2126] transition-colors text-slate-300 hover:text-[#D4A381]" title="Upload File">
                    <span className="text-[11px] font-black uppercase tracking-widest">Upload File</span>
                    <input type="file" accept="image/*" onChange={handleScanRecipe} className="hidden" disabled={isScanning} />
                 </label>
              </div>

              {/* Primary CTA */}
              <button onClick={() => { resetForm(); setIsFormOpen(true); }} className={`w-full sm:w-auto bg-gradient-to-r from-[#C59373] to-[#8F6040] hover:from-[#D4A381] hover:to-[#A37050] text-slate-900 shadow-lg px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all`}>
                <Plus size={16}/> New Spec
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RECIPE GRID */}
      {filteredRecipes.length === 0 ? (
        <div className={`text-center py-24 px-4 border border-dashed border-[#2A353D] bg-[#1A2126]/50 rounded-3xl`}>
          <div className="bg-[#12161A] w-20 h-20 mx-auto rounded-full flex items-center justify-center border border-[#2A353D] mb-4 shadow-inner">
            <ChefHat className={T.copper} size={32}/>
          </div>
          <h3 className="text-lg font-black text-white">No specs found.</h3>
          <p className="text-sm font-medium text-slate-500 mt-2">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredRecipes.map(r => (
            <div key={r.id} onClick={() => { setActiveRecipe(r); setYieldMult(1); }} className="recipe-card-v13 group relative bg-[#1A2126] rounded-lg border border-[#2A353D] hover:border-[#D4A381]/50 overflow-hidden flex flex-col h-full cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
              
              {/* Card Header Pattern */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C59373] to-[#8F6040] opacity-20 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="p-2.5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest bg-[#12161A] text-[#D4A381] border border-[#2A353D] px-2 py-0.5 rounded shadow-sm">
                    {r.category}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-[#12161A] border border-[#2A353D] flex items-center justify-center text-slate-400 group-hover:text-[#D4A381] group-hover:bg-[#1A2126] transition-all">
                    <ChevronRight size={13} />
                  </div>
                </div>
                
                <h3 className="text-[15px] font-black text-white mb-1 leading-tight group-hover:text-[#D4A381] transition-colors line-clamp-2">
                  {r.title}
                </h3>
                
                <div className="mt-auto pt-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 bg-[#12161A] p-1.5 rounded-md border border-[#2A353D]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={12} className="text-slate-500 shrink-0"/> 
                      <span className="truncate">{r.prepTime}</span>
                    </div>
                    <div className="w-px h-4 bg-[#2A353D] shrink-0 mx-2"></div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Scale size={12} className="text-slate-500 shrink-0"/> 
                      <span className="truncate">Yield: {r.yieldAmt}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <Modal isOpen={!!activeRecipe} onClose={() => setActiveRecipe(null)} title="Spec Sheet">
        {activeRecipe && (
          <div className="space-y-6">
            <div className={`border-b ${T.border} pb-4`}><h2 className="text-2xl font-black text-white leading-tight mb-2">{activeRecipe.title}</h2><div className={`flex flex-wrap gap-2 text-xs font-bold ${T.muted}`}><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md`}>{activeRecipe.category}</span><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md flex items-center gap-1`}><Clock size={12}/> {activeRecipe.prepTime}</span><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md flex items-center gap-1 ${yieldMult !== 1 ? T.copper : ''}`}><Scale size={12}/> Yield: {parseAndMultiply(activeRecipe.yieldAmt, yieldMult)}</span></div></div>
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#12161A] p-3 rounded-xl border ${T.border} mb-6`}><span className={`text-[10px] font-black uppercase ${T.muted} tracking-widest`}>Yield Multiplier</span><div className={`flex bg-[#1A2126] rounded-lg p-1 border ${T.border}`}>{[0.5, 1, 2, 4].map(m => (<button key={m} onClick={() => setYieldMult(m)} className={`px-4 py-1.5 text-xs font-black rounded-md transition-all ${yieldMult === m ? `${T.grad} text-slate-900` : `text-slate-500 hover:text-white`}`}>{m}x</button>))}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2 space-y-3"><h4 className={`text-[10px] font-black ${T.muted} uppercase tracking-widest border-b ${T.border} pb-1`}>Ingredients <span className={`lowercase ml-1 ${yieldMult !== 1 ? T.copper : ''}`}>({yieldMult}x)</span></h4><ul className="space-y-2 text-sm font-bold text-slate-300">{activeRecipe.ingredients.split('\n').map((ing, i) => ing.trim() && <li key={i} className="flex items-start gap-2"><div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${yieldMult !== 1 ? 'bg-[#D4A381]' : 'bg-slate-500'}`}/><span>{parseAndMultiply(ing, yieldMult)}</span></li>)}</ul></div>
              <div className="md:col-span-3 space-y-3"><h4 className={`text-[10px] font-black ${T.muted} uppercase tracking-widest border-b ${T.border} pb-1`}>Method</h4><div className="space-y-3 text-sm font-medium text-slate-300">{activeRecipe.instructions.split('\n').map((step, i) => step.trim() && <p key={i} className="leading-relaxed"><strong className="text-white mr-1">{i+1}.</strong>{step}</p>)}</div></div>
            </div>
            
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t ${T.border} mt-6`}>
              <div className={`text-[10px] font-bold ${T.muted}`}>
                Added by {activeRecipe.authorName} <br/> 
                {activeRecipe.lastUpdated && <span className="opacity-70">Updated: {new Date(activeRecipe.lastUpdated).toLocaleDateString()}</span>}
              </div>
              
              {canModifyRecipe && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={handleEdit} className="flex-1 sm:flex-none flex justify-center items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300 bg-[#12161A] border border-[#2A353D] px-4 py-2 rounded-lg transition-colors"><Edit size={14}/> Edit</button>
                  <button onClick={() => handleDelete(activeRecipe.id)} className="flex-1 sm:flex-none flex justify-center items-center gap-1 text-xs font-bold text-red-500 hover:text-red-400 bg-[#12161A] border border-[#2A353D] px-4 py-2 rounded-lg transition-colors"><Trash2 size={14}/> Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingRecipeId ? "Edit Spec" : "Add New Spec"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className={T.label}>Recipe Title</label><input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} className={T.input} required placeholder="e.g. House Ranch"/></div>
          <div className="grid grid-cols-3 gap-3"><div><label className={T.label}>Category</label><select value={category} onChange={(e)=>setCategory(e.target.value)} className={T.input}>{categories.slice(1).map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className={T.label}>Prep Time</label><input type="text" value={prepTime} onChange={(e)=>setPrepTime(e.target.value)} className={T.input} placeholder="e.g. 15 mins"/></div><div><label className={T.label}>Yield</label><input type="text" value={yieldAmt} onChange={(e)=>setYieldAmt(e.target.value)} className={T.input} placeholder="e.g. 4 Quarts"/></div></div>
          <div><label className={T.label}>Ingredients (One per line)</label><textarea value={ingredients} onChange={(e)=>setIngredients(e.target.value)} rows="5" className={T.input} required placeholder="1 Cup Mayo&#10;1/2 Cup Buttermilk&#10;1 Tbsp Dill"/></div>
          <div><label className={T.label}>Method / Instructions (One step per line)</label><textarea value={instructions} onChange={(e)=>setInstructions(e.target.value)} rows="5" className={T.input} required placeholder="Combine mayo and buttermilk in cambro.&#10;Whisk in dry seasoning.&#10;Label and date."/></div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingRecipeId ? "Update Recipe" : "Save Recipe"}</button>
        </form>
      </Modal>
    </div>
  );
};

const TabMaintenance = ({ appUser, addToast }) => {
  const logs = useLiveCollection('maintenanceLogs', appUser?.restaurantId, { limitCount: 200 });
  const pmSchedules = useLiveCollection('pmSchedules', appUser?.restaurantId, { limitCount: 150 });
  
  const [subTab, setSubTab] = useState('issues'); // 'issues' or 'pm'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPmModalOpen, setIsPmModalOpen] = useState(false);
  
  // Reactive Form State
  const [equipment, setEquipment] = useState('');
  const [issue, setIssue] = useState('');
  const [urgency, setUrgency] = useState('Standard');
  const [status, setStatus] = useState('Reported');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [editingLogId, setEditingLogId] = useState(null);
  const [issueSearch, setIssueSearch] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState('Open');

  // PM Form State
  const [pmTitle, setPmTitle] = useState('');
  const [pmEquipment, setPmEquipment] = useState('');
  const [pmDays, setPmDays] = useState('30');
  const [editingPmId, setEditingPmId] = useState(null);
  const safeMaintenanceWrite = (args) => safeWriteWithQueue({ user: appUser, addToast, ...args });

  const resetForm = () => {
    setEquipment(''); setIssue(''); setUrgency('Standard'); 
    setStatus('Reported'); setCost(''); setNotes(''); setEditingLogId(null);
  };

  const resetPmForm = () => {
    setPmTitle(''); setPmEquipment(''); setPmDays('30'); setEditingPmId(null);
  };

  const handleEdit = (log) => {
    setEquipment(log.equipment); setIssue(log.issue); setUrgency(log.urgency);
    setStatus(log.status); setCost(log.cost || ''); setNotes(log.notes || '');
    setEditingLogId(log.id); setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!equipment.trim() || !issue.trim()) return addToast('Error', 'Equipment and issue are required.');
    
    const payload = {
      equipment: equipment.trim(),
      issue: issue.trim(),
      urgency,
      status,
      cost: parseFloat(cost) || 0,
      notes: notes.trim(),
      restaurantId: appUser.restaurantId,
      lastUpdated: new Date().toISOString(),
      updatedBy: appUser.name
    };

    try {
      if (editingLogId) {
        if (status === 'Resolved' && logs.find(l => l.id === editingLogId)?.status !== 'Resolved') {
            payload.resolvedAt = new Date().toISOString();
        }
        await safeMaintenanceWrite({ action: "update", collectionName: "maintenanceLogs", docId: editingLogId, label: "Maintenance log", before: logs.find(l => l.id === editingLogId), data: payload });
        addToast('Updated', 'Maintenance log updated successfully.');
      } else {
        payload.reportedAt = new Date().toISOString();
        payload.reportedBy = appUser.name;
        await safeMaintenanceWrite({ action: "add", collectionName: "maintenanceLogs", label: "Maintenance log", data: payload });
        addToast('Logged', 'New equipment issue reported.');
      }
      setIsModalOpen(false); resetForm();
    } catch (err) { addToast('Error', err.message); }
  };

  // --- PM ENGINE LOGIC ---
  const handleSavePm = async (e) => {
    e.preventDefault();
    if(!pmTitle || !pmEquipment || !pmDays) return;
    const payload = {
      title: pmTitle.trim(),
      equipment: pmEquipment.trim(),
      frequencyDays: parseInt(pmDays) || 30,
      restaurantId: appUser.restaurantId,
      lastUpdatedBy: appUser.name
    };
    try {
      if (editingPmId) {
        await safeMaintenanceWrite({ action: "update", collectionName: "pmSchedules", docId: editingPmId, label: "PM schedule", before: pmSchedules.find(p => p.id === editingPmId), data: payload });
        addToast('Updated', 'PM Schedule updated.');
      } else {
        payload.lastCompleted = getToday(); // Default to today on creation
        await safeMaintenanceWrite({ action: "add", collectionName: "pmSchedules", label: "PM schedule", data: payload });
        addToast('Created', 'New PM Schedule active.');
      }
      setIsPmModalOpen(false); resetPmForm();
    } catch (err) { addToast('Error', err.message); }
  };

  const handleMarkPmDone = async (pm) => {
    if(!window.confirm(`Mark ${pm.title} as completed for today?`)) return;
    try {
      // 1. Update the PM tracker
      await safeMaintenanceWrite({ action: "update", collectionName: "pmSchedules", docId: pm.id, label: "PM completion", before: pm, data: { lastCompleted: getToday() } });
      
      // 2. Auto-generate a historical paper trail in the main logs
      await safeMaintenanceWrite({ action: "add", collectionName: "maintenanceLogs", label: "PM completion log", data: {
        equipment: pm.equipment,
        issue: `[PM COMPLETED] ${pm.title}`,
        urgency: 'Standard',
        status: 'Resolved',
        cost: 0,
        notes: `Routine Preventative Maintenance. Cycle: ${pm.frequencyDays} days.`,
        restaurantId: appUser.restaurantId,
        reportedAt: new Date().toISOString(),
        reportedBy: appUser.name,
        resolvedAt: new Date().toISOString(),
        updatedBy: appUser.name,
        lastUpdated: new Date().toISOString()
      } });
      
      addToast('PM Completed', 'Schedule reset and historical log created.');
    } catch (e) { addToast('Error', e.message); }
  };

  const getStatusColor = (s) => {
    if (s === 'Reported') return 'text-orange-400 bg-orange-900/20 border-orange-900/50';
    if (s === 'In Progress' || s === 'Pending Parts') return 'text-blue-400 bg-blue-900/20 border-blue-900/50';
    if (s === 'Resolved') return 'text-emerald-400 bg-emerald-900/20 border-emerald-900/50';
    return 'text-slate-400 bg-slate-900/20 border-slate-700';
  };

  const getUrgencyColor = (u) => {
    if (u === 'Critical') return 'text-red-500 font-black animate-pulse';
    if (u === 'High') return 'text-orange-500 font-bold';
    return 'text-slate-400';
  };

  // Calculate Overdue PMs for the notification dot
  const todayMs = new Date(getToday()+'T12:00:00').getTime();
  const overdueCount = pmSchedules.filter(pm => {
    const lastMs = new Date(pm.lastCompleted+'T12:00:00').getTime();
    return (pm.frequencyDays - Math.floor((todayMs - lastMs) / 86400000)) <= 0;
  }).length;

  const openLogs = logs.filter(log => (log.status || 'Reported') !== 'Resolved');
  const criticalLogs = openLogs.filter(log => ['Critical', 'High'].includes(log.urgency));
  const inProgressLogs = openLogs.filter(log => ['In Progress', 'Pending Parts'].includes(log.status));
  const totalRepairCost = logs.reduce((sum, log) => sum + (Number(log.cost) || 0), 0);
  const sortedLogs = logs.slice().sort((a,b) => {
    if ((a.status || 'Reported') !== 'Resolved' && (b.status || 'Reported') === 'Resolved') return -1;
    if ((a.status || 'Reported') === 'Resolved' && (b.status || 'Reported') !== 'Resolved') return 1;
    const urgencyRank = { Critical: 0, High: 1, Standard: 2 };
    const rankDiff = (urgencyRank[a.urgency] ?? 3) - (urgencyRank[b.urgency] ?? 3);
    if (rankDiff) return rankDiff;
    return new Date(b.lastUpdated || b.reportedAt || 0) - new Date(a.lastUpdated || a.reportedAt || 0);
  });
  const normalizedIssueSearch = issueSearch.trim().toLowerCase();
  const visibleLogs = sortedLogs.filter(log => {
    const matchesStatus = issueStatusFilter === 'All'
      || (issueStatusFilter === 'Open' && (log.status || 'Reported') !== 'Resolved')
      || log.status === issueStatusFilter;
    const haystack = `${log.equipment || ''} ${log.issue || ''} ${log.notes || ''} ${log.reportedBy || ''}`.toLowerCase();
    return matchesStatus && (!normalizedIssueSearch || haystack.includes(normalizedIssueSearch));
  });
  const sortedPmSchedules = pmSchedules.slice().sort((a,b) => {
    const aLast = new Date((a.lastCompleted || getToday())+'T12:00:00').getTime();
    const bLast = new Date((b.lastCompleted || getToday())+'T12:00:00').getTime();
    const aLeft = Number(a.frequencyDays || 30) - Math.floor((todayMs - aLast) / 86400000);
    const bLeft = Number(b.frequencyDays || 30) - Math.floor((todayMs - bLast) / 86400000);
    return aLeft - bLeft;
  });

  return (
    <div className="maintenance-center-compact desktop-ops-page max-w-7xl mx-auto space-y-3 pb-24 animate-[slideIn_0.2s_ease-out]">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingLogId ? "Update Maintenance Record" : "Report Equipment Issue"}>
        <form onSubmit={handleSave} className="space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className={T.label}>Equipment / Area</label><input type="text" value={equipment} onChange={e=>setEquipment(e.target.value)} className={T.input} placeholder="Walk-in cooler, fryer 1, prep sink" required /></div>
            <div><label className={T.label}>Urgency</label><select value={urgency} onChange={e=>setUrgency(e.target.value)} className={T.input}><option value="Standard">Standard</option><option value="High">High</option><option value="Critical">Critical / Down</option></select></div>
          </div>
          <div><label className={T.label}>Issue</label><textarea value={issue} onChange={e=>setIssue(e.target.value)} rows="3" className={T.input} placeholder="Describe what is happening and when it started." required /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className={T.label}>Status</label><select value={status} onChange={e=>setStatus(e.target.value)} className={T.input}><option value="Reported">Reported</option><option value="In Progress">In Progress</option><option value="Pending Parts">Pending Parts</option><option value="Resolved">Resolved</option></select></div>
            <div><label className={T.label}>Repair Cost</label><input type="number" step="0.01" min="0" value={cost} onChange={e=>setCost(e.target.value)} className={T.input} placeholder="0.00" /></div>
          </div>
          <div><label className={T.label}>Vendor / Repair Notes</label><input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className={T.input} placeholder="Vendor, part ordered, temporary workaround" /></div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingLogId ? 'Save Changes' : 'Create Maintenance Record'}</button>
        </form>
      </Modal>

      <Modal isOpen={isPmModalOpen} onClose={() => { setIsPmModalOpen(false); resetPmForm(); }} title={editingPmId ? "Edit Preventative Schedule" : "New Preventative Schedule"}>
        <form onSubmit={handleSavePm} className="space-y-3">
          <div><label className={T.label}>Task</label><input type="text" value={pmTitle} onChange={e=>setPmTitle(e.target.value)} className={T.input} placeholder="Clean condenser coils" required /></div>
          <div><label className={T.label}>Equipment / Area</label><input type="text" value={pmEquipment} onChange={e=>setPmEquipment(e.target.value)} className={T.input} placeholder="Walk-in cooler" required /></div>
          <div><label className={T.label}>Repeat Every</label><div className="flex items-center gap-2"><input type="number" min="1" value={pmDays} onChange={e=>setPmDays(e.target.value)} className={T.input} required /><span className="text-xs font-bold text-slate-400">days</span></div></div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingPmId ? 'Save Schedule' : 'Create Schedule'}</button>
        </form>
      </Modal>

      <div className={`${T.card} p-3`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D4A381]">Equipment Care</div>
            <h1 className="text-xl font-black text-white leading-tight flex items-center gap-2"><Wrench size={19} className={T.copper}/> Maintenance Center</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">Repairs, costs, vendors, and preventative work in one compact workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { resetForm(); setIsModalOpen(true); }} className={`${T.btn} flex items-center gap-1.5`}><Plus size={14}/> Report Issue</button>
            <button onClick={() => { resetPmForm(); setIsPmModalOpen(true); }} className={`${T.btnAlt} flex items-center gap-1.5`}><Calendar size={14}/> Add PM</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ['Open Repairs', openLogs.length, openLogs.length ? 'text-orange-300' : 'text-emerald-400'],
          ['High Priority', criticalLogs.length, criticalLogs.length ? 'text-red-400' : 'text-emerald-400'],
          ['In Progress', inProgressLogs.length, 'text-blue-300'],
          ['Recorded Cost', `$${totalRepairCost.toFixed(2)}`, 'text-[#D4A381]']
        ].map(([label,value,color]) => <div key={label} className="maintenance-summary-card bg-[#1A2126] border border-[#2A353D]"><div className="text-[9px] uppercase tracking-widest font-black text-slate-500">{label}</div><div className={`text-lg font-black mt-1 ${color}`}>{value}</div></div>)}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#2A353D] pb-2">
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar">
          <button onClick={() => setSubTab('issues')} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${subTab === 'issues' ? `${T.grad} text-slate-900` : 'bg-[#1A2126] text-slate-400 border border-[#2A353D]'}`}>Repair Board</button>
          <button onClick={() => setSubTab('pm')} className={`relative flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${subTab === 'pm' ? `${T.grad} text-slate-900` : 'bg-[#1A2126] text-slate-400 border border-[#2A353D]'}`}>Preventative Maintenance{overdueCount > 0 && <span className="ml-2 inline-flex min-w-4 h-4 px-1 rounded-full bg-red-500 text-white items-center justify-center text-[9px]">{overdueCount}</span>}</button>
        </div>
        {subTab === 'issues' && <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input value={issueSearch} onChange={e=>setIssueSearch(e.target.value)} className={`${T.input} md:w-56`} placeholder="Search equipment, issue, vendor" />
          <select value={issueStatusFilter} onChange={e=>setIssueStatusFilter(e.target.value)} className={`${T.input} md:w-36`}><option value="Open">Open</option><option value="All">All</option><option value="Reported">Reported</option><option value="In Progress">In Progress</option><option value="Pending Parts">Pending Parts</option><option value="Resolved">Resolved</option></select>
        </div>}
      </div>

      {subTab === 'issues' && <div className="animate-[slideIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-2"><div><h2 className="text-sm font-black text-white">Repair Board</h2><p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{visibleLogs.length} record{visibleLogs.length === 1 ? '' : 's'} shown</p></div></div>
        {visibleLogs.length === 0 ? <SmartEmptyState icon={<Wrench size={22}/>} title="No maintenance records match" desc="Change the filter or report a new equipment issue." /> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {visibleLogs.map(log => {
            const reportedDate = log.reportedAt ? new Date(log.reportedAt).toLocaleDateString() : 'Date unavailable';
            const isResolved = (log.status || 'Reported') === 'Resolved';
            const isPmLog = String(log.issue || '').includes('[PM COMPLETED]');
            return <article key={log.id} className={`maintenance-record-card bg-[#1A2126] border ${log.urgency === 'Critical' && !isResolved ? 'border-red-500/50' : 'border-[#2A353D]'} ${isResolved ? 'opacity-75' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5"><h3 className="font-black text-white truncate">{log.equipment || 'Equipment'}</h3><span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStatusColor(log.status || 'Reported')}`}>{log.status || 'Reported'}</span>{isPmLog && <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-blue-900/50 bg-blue-900/20 text-blue-300">PM History</span>}</div>
                  <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${getUrgencyColor(log.urgency)}`}>{isPmLog ? 'Preventative maintenance' : `${log.urgency || 'Standard'} priority`}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0"><button onClick={() => handleEdit(log)} className="no-compact w-8 h-8 rounded-lg border border-[#2A353D] bg-[#12161A] text-slate-400 hover:text-[#D4A381] flex items-center justify-center" title="Edit record"><Edit size={14}/></button><button onClick={() => { if(window.confirm('Delete this maintenance record permanently?')) safeMaintenanceWrite({ action: 'delete', collectionName: 'maintenanceLogs', docId: log.id, label: 'Maintenance log', before: log }); }} className="no-compact w-8 h-8 rounded-lg border border-[#2A353D] bg-[#12161A] text-slate-400 hover:text-red-400 flex items-center justify-center" title="Delete record"><Trash2 size={14}/></button></div>
              </div>
              <div className="mt-2 rounded-lg bg-[#12161A] border border-[#2A353D] px-3 py-2 text-sm font-bold text-slate-200 leading-snug">{String(log.issue || '').replace('[PM COMPLETED] ', '')}</div>
              {log.notes && <div className="mt-2 text-xs font-bold text-[#D4A381] line-clamp-2">{log.notes}</div>}
              <div className="mt-2 pt-2 border-t border-[#2A353D] grid grid-cols-2 sm:grid-cols-3 gap-2 text-[9px] uppercase tracking-widest font-black text-slate-500"><span>Reported {reportedDate}</span><span className="truncate">By {log.reportedBy || log.updatedBy || 'Unknown'}</span><span className="text-right sm:text-left">Cost ${Number(log.cost || 0).toFixed(2)}</span></div>
            </article>;
          })}
        </div>}
      </div>}

      {subTab === 'pm' && <div className="animate-[slideIn_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-2"><div><h2 className="text-sm font-black text-white">Preventative Maintenance</h2><p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Recurring equipment care and due dates</p></div></div>
        {sortedPmSchedules.length === 0 ? <SmartEmptyState icon={<Calendar size={22}/>} title="No preventative schedules" desc="Add recurring equipment care to build the maintenance calendar." /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {sortedPmSchedules.map(pm => {
            const lastCompleted = pm.lastCompleted || getToday();
            const lastMs = new Date(lastCompleted+'T12:00:00').getTime();
            const daysSince = Math.max(0, Math.floor((todayMs - lastMs) / 86400000));
            const frequency = Math.max(1, Number(pm.frequencyDays || 30));
            const daysLeft = frequency - daysSince;
            const progress = Math.max(0, Math.min(100, Math.round((daysSince / frequency) * 100)));
            const statusText = daysLeft <= 0 ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue` : daysLeft <= 7 ? `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : `${daysLeft} days left`;
            const statusClass = daysLeft <= 0 ? 'text-red-300 border-red-500/40 bg-red-950/20' : daysLeft <= 7 ? 'text-orange-300 border-orange-500/40 bg-orange-950/20' : 'text-emerald-300 border-emerald-500/30 bg-emerald-950/10';
            return <article key={pm.id} className="maintenance-record-card bg-[#1A2126] border border-[#2A353D]">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-black text-white truncate">{pm.title}</h3><div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381] mt-1 truncate">{pm.equipment}</div></div><span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border flex-shrink-0 ${statusClass}`}>{statusText}</span></div>
              <div className="mt-3"><div className="h-1.5 rounded-full bg-[#0B0E11] overflow-hidden"><div className={`${daysLeft <= 0 ? 'bg-red-500' : daysLeft <= 7 ? 'bg-orange-400' : 'bg-emerald-500'} h-full rounded-full`} style={{ width: `${Math.max(4, progress)}%` }} /></div><div className="flex justify-between text-[9px] uppercase tracking-widest font-black text-slate-500 mt-1"><span>Last {new Date(lastCompleted+'T12:00:00').toLocaleDateString()}</span><span>Every {frequency} days</span></div></div>
              <div className="mt-3 flex gap-1.5"><button onClick={() => handleMarkPmDone(pm)} className={`${T.btn} flex-1 flex items-center justify-center gap-1`}><Check size={13}/> Complete</button><button onClick={() => { setPmTitle(pm.title); setPmEquipment(pm.equipment); setPmDays(String(pm.frequencyDays || 30)); setEditingPmId(pm.id); setIsPmModalOpen(true); }} className="no-compact w-9 h-9 rounded-lg border border-[#2A353D] bg-[#12161A] text-slate-400 hover:text-[#D4A381] flex items-center justify-center"><Edit size={14}/></button><button onClick={() => { if(window.confirm('Delete this preventative schedule?')) safeMaintenanceWrite({ action: 'delete', collectionName: 'pmSchedules', docId: pm.id, label: 'PM schedule', before: pm }); }} className="no-compact w-9 h-9 rounded-lg border border-[#2A353D] bg-[#12161A] text-slate-400 hover:text-red-400 flex items-center justify-center"><Trash2 size={14}/></button></div>
            </article>;
          })}
        </div>}
      </div>}
    </div>
  );

};

const TabOpsCenter = ({ currentDate, appUser, users = [], shifts = [], events = [], sales = [], timePunches = [], addToast, setActiveTab, clientData = {} }) => {
  const opsPlanAccess = usePlanAccess(appUser, clientData);
  const canUseBasicInventory = opsPlanAccess.canUse(FEATURE_KEYS.BASIC_INVENTORY).allowed || opsPlanAccess.canUse(FEATURE_KEYS.BURN_LOG).allowed;
  const canUseMenuIntelligence = opsPlanAccess.canUse(FEATURE_KEYS.MENU_INTELLIGENCE).allowed || opsPlanAccess.canUse(FEATURE_KEYS.DEPENDENCY_TOOLS).allowed;
  const canUseCleaningRoutines = opsPlanAccess.canUse(FEATURE_KEYS.CLEANING_ROUTINES).allowed;
  const canUseKitchenCommand = opsPlanAccess.canUse(FEATURE_KEYS.KITCHEN_COMMAND).allowed;
  const inventoryItems = useLiveCollection('inventoryItems', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseBasicInventory, limitCount: 500 });
  const wasteLogs = useLiveCollection('wasteLogs', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseBasicInventory, limitCount: 200 });
  const maintenanceLogs = useLiveCollection('maintenanceLogs', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseCleaningRoutines, limitCount: 200 });
  const pmSchedules = useLiveCollection('pmSchedules', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseCleaningRoutines, limitCount: 150 });
  const tasks = useLiveCollection('tasks', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseKitchenCommand, limitCount: 350 });
  const recipes = useLiveCollection('recipes', appUser?.restaurantId, { enabled: !!appUser?.restaurantId, limitCount: 350 });
  const menuDependencies = useLiveCollection('menuDependencies', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseMenuIntelligence, limitCount: 500 });
  const kitchenSpecials = useLiveCollection('kitchenSpecials', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseKitchenCommand, limitCount: 250 });
  const [depRecipeId, setDepRecipeId] = useState('');
  const [depInventoryItemId, setDepInventoryItemId] = useState('');
  const [depNotes, setDepNotes] = useState('');
  const [specialEditorOpen, setSpecialEditorOpen] = useState(false);
  const [specialSaving, setSpecialSaving] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState(null);
  const [specialView, setSpecialView] = useState('current');
  const [specialForm, setSpecialForm] = useState({
    name: '', startDate: currentDate || getToday(), endDate: currentDate || getToday(), description: '', price: '', allergens: '', dietaryNotes: '', prepNotes: '', status: 'Scheduled'
  });
  const safeOpsWrite = (args) => safeWriteWithQueue({ user: appUser, addToast, ...args });
  const configuredRosterRoles = Array.isArray(clientData?.rosterRoles)
    ? clientData.rosterRoles.map(r => typeof r === 'string' ? r : (r?.name || r?.label || r?.title)).filter(Boolean)
    : Array.isArray(clientData?.systemSettings?.rosterRoles)
      ? clientData.systemSettings.rosterRoles.map(r => typeof r === 'string' ? r : (r?.name || r?.label || r?.title)).filter(Boolean)
      : [];
  const hasCustomRosterRoles = configuredRosterRoles.length > 0;
  const legacyManagerRoleFallback = !hasCustomRosterRoles && ['General Manager', 'Manager', 'Kitchen Manager', 'Operations Manager', 'Store Manager', 'Owner', 'Shift Lead', 'Lead', 'Supervisor'].includes(String(appUser?.role || ''));
  const canManageSpecials = Boolean(
    appUser?.isSuperAdmin || appUser?.systemAccess?.superAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.owner || appUser?.workspaceOwner ||
    appUser?.permissions?.prep || appUser?.permissions?.ops || appUser?.permissions?.team || legacyManagerRoleFallback
  );
  const dependencyInventoryOptions = Array.from(inventoryItems.reduce((map, item) => {
    const name = String(item?.name || item?.itemName || '').replace(/\s+/g, ' ').trim();
    if (!item?.id || !name || name.length < 2 || name.length > 100 || item.isArchived === true || item.deleted === true) return map;
    const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const looksLikeNoise = !/[a-z]{2}/i.test(name)
      || /^(?:inventory item|item|product|unknown|misc|n\/?a)$/i.test(name)
      || /(?:\bshipper\b|\bbill to\b|\bship to\b|\bdue \d|\bt\/?wt\b|\bsuite \d|\bhighway\b|\bhwy\b|\bphone\b|\bfax\b|\binvoice\b|\baccount\b)/i.test(name)
      || /(?:\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/.test(name)
      || /^(?:[\d./-]+\s*){2,}$/.test(name);
    if (looksLikeNoise) return map;
    const classification = classifyInvoiceRow({
      itemName: name,
      description: name,
      rawText: name,
      rowType: 'item',
      quantity: 1,
      uom: item.unit || item.uom || 'EA',
      productCode: item.productCode || item.sku || ''
    });
    if (classification.kind === 'document') return map;
    if (!map.has(normalized)) map.set(normalized, { ...item, name });
    return map;
  }, new Map()).values()).sort((a,b) => a.name.localeCompare(b.name));
  const hiddenDependencyNoiseCount = Math.max(0, inventoryItems.length - dependencyInventoryOptions.length);

  const today = currentDate || getToday();
  const todayDate = new Date(today + 'T12:00:00');
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(todayDate.getDate() - 1);
  const yesterday = formatDate(yesterdayDate);
  const todayName = todayDate.toLocaleDateString('en-US', { weekday: 'long' });
  const monthStr = getMonthStr(today);

  const sortedSpecials = [...kitchenSpecials].sort((a, b) => {
    const dateDiff = String(b.startDate || '').localeCompare(String(a.startDate || ''));
    return dateDiff || String(a.name || '').localeCompare(String(b.name || ''));
  });
  const currentSpecials = sortedSpecials.filter(special => {
    const start = special.startDate || today;
    const end = special.endDate || start;
    return special.isArchived !== true && ['Scheduled', 'Active', 'Sold Out'].includes(special.status || 'Scheduled') && start <= today && end >= today;
  });
  const upcomingSpecials = sortedSpecials
    .filter(special => special.isArchived !== true && ['Scheduled', 'Active'].includes(special.status || 'Scheduled') && (special.startDate || '') > today)
    .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
  const displayedSpecials = canManageSpecials && specialView === 'all'
    ? sortedSpecials
    : [...currentSpecials, ...upcomingSpecials].filter((special, index, rows) => rows.findIndex(row => row.id === special.id) === index).slice(0, 8);

  const resetSpecialForm = () => {
    setSpecialForm({ name: '', startDate: today, endDate: today, description: '', price: '', allergens: '', dietaryNotes: '', prepNotes: '', status: 'Scheduled' });
    setEditingSpecial(null);
  };

  const openNewSpecial = () => {
    resetSpecialForm();
    setSpecialEditorOpen(true);
  };

  const openSpecialEditor = (special) => {
    setEditingSpecial(special);
    setSpecialForm({
      name: special.name || '',
      startDate: special.startDate || today,
      endDate: special.endDate || special.startDate || today,
      description: special.description || '',
      price: special.price === 0 || special.price ? String(special.price) : '',
      allergens: special.allergens || '',
      dietaryNotes: special.dietaryNotes || '',
      prepNotes: special.prepNotes || '',
      status: special.status || 'Scheduled'
    });
    setSpecialEditorOpen(true);
  };

  const handleSaveSpecial = async (event) => {
    event.preventDefault();
    if (specialSaving) return;
    const name = specialForm.name.replace(/\s+/g, ' ').trim();
    const startDate = specialForm.startDate || today;
    const endDate = specialForm.endDate || startDate;
    const parsedPrice = Number(specialForm.price || 0);
    if (!name) return addToast('Special Name Needed', 'Enter the name guests and the kitchen should use.');
    if (endDate < startDate) return addToast('Check Service Dates', 'The end date cannot be before the start date.');
    const payload = {
      name: name.slice(0, 120),
      startDate,
      endDate,
      description: specialForm.description.trim().slice(0, 1200),
      price: Number.isFinite(parsedPrice) ? Math.min(100000, Math.max(0, parsedPrice)) : 0,
      allergens: specialForm.allergens.trim().slice(0, 500),
      dietaryNotes: specialForm.dietaryNotes.trim().slice(0, 500),
      prepNotes: specialForm.prepNotes.trim().slice(0, 1200),
      status: specialForm.status,
      isArchived: specialForm.status === 'Archived',
      restaurantId: appUser.restaurantId,
      ...(editingSpecial ? {} : { createdAt: new Date().toISOString(), createdBy: appUser?.name || appUser?.email || 'Kitchen Manager' })
    };
    try {
      setSpecialSaving(true);
      await safeOpsWrite({
        action: editingSpecial ? 'update' : 'add',
        collectionName: 'kitchenSpecials',
        docId: editingSpecial?.id || '',
        label: editingSpecial ? 'Kitchen special updated' : 'Kitchen special published',
        before: editingSpecial,
        data: payload
      });
      setSpecialEditorOpen(false);
      resetSpecialForm();
    } catch (_) {
      // safeWriteWithQueue already presents the user-facing save error.
    } finally {
      setSpecialSaving(false);
    }
  };

  const handleArchiveSpecial = async (special) => {
    if (!window.confirm(`Archive ${special.name || 'this special'}? It will remain in the history.`)) return;
    try {
      await safeOpsWrite({
        action: 'update', collectionName: 'kitchenSpecials', docId: special.id, label: 'Kitchen special archived', before: special,
        data: { status: 'Archived', isArchived: true, archivedAt: new Date().toISOString(), archivedBy: appUser?.name || appUser?.email || 'Kitchen Manager' }
      });
    } catch (_) {}
  };

  const handleSpecialStatus = async (special, status) => {
    try {
      await safeOpsWrite({
        action: 'update', collectionName: 'kitchenSpecials', docId: special.id, label: `Special marked ${status}`, before: special,
        data: { status, isArchived: false }
      });
    } catch (_) {}
  };

  const sameDay = (date) => date === today;
  const openMaintenance = maintenanceLogs.filter(l => (l.status || 'Reported') !== 'Resolved');
  const criticalMaintenance = openMaintenance.filter(l => l.urgency === 'Critical' || l.urgency === 'High');
  const lowStockItems = inventoryItems
    .filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) < Number(i.parLevel || 0))
    .sort((a, b) => ((Number(a.currentStock || 0) / Math.max(1, Number(a.parLevel || 1))) - (Number(b.currentStock || 0) / Math.max(1, Number(b.parLevel || 1)))));
  const pendingOrderItems = inventoryItems.filter(i => Number(i.pendingQty || 0) > 0);
  const todayWaste = wasteLogs.filter(w => w.date === today);
  const todayEvents = events.filter(e => (e.date || '').startsWith(today) || e.date === today);
  const importantEvents = todayEvents.filter(e => e.isImportant || (e.title || '').toLowerCase().includes('86'));
  const commandActiveUserIds = new Set(users.filter(u => u?.isActive !== false).flatMap(u => [u.id, u.uid, u.authUid, u.userId].filter(Boolean)));
  const todayShifts = shifts
    .filter(s => s.date === today && s.isPublished && s.isDeleted !== true && s.cancelled !== true && !s.deletedAt)
    .filter(s => !s.employeeId || commandActiveUserIds.has(s.employeeId))
    .sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const activePunches = timePunches.filter(p => p.date === today && ['clocked_in', 'on_break'].includes(p.status));
  const yesterdaySales = sales.find(s => s.date === yesterday);
  const todaySales = sales.find(s => s.date === today);
  const monthSales = sales.filter(s => (s.date || '').startsWith(monthStr));

  const handleAddMenuDependency = async (e) => {
    e.preventDefault();
    const recipe = recipes.find(r => r.id === depRecipeId);
    const item = inventoryItems.find(i => i.id === depInventoryItemId);
    if (!recipe || !item) return addToast('Dependency Needed', 'Choose both a menu item/recipe and an inventory item.');
    const alreadyExists = menuDependencies.some(dep => dep.recipeId === recipe.id && dep.inventoryItemId === item.id);
    if (alreadyExists) return addToast('Already Mapped', 'That dependency is already in the menu graph.');
    await safeOpsWrite({ action: 'add', collectionName: 'menuDependencies', label: 'Menu dependency', data: {
      recipeId: recipe.id,
      recipeName: recipe.name || recipe.title || 'Recipe',
      inventoryItemId: item.id,
      inventoryItemName: item.name || 'Inventory item',
      dependencyType: 'ingredient',
      notes: depNotes.trim(),
      createdAt: new Date().toISOString(),
      createdBy: appUser?.name || appUser?.email || 'Kitchen Command Center',
      restaurantId: appUser.restaurantId
    } });
    setDepNotes('');
    addToast('Dependency Mapped', `${recipe.name || recipe.title || 'Recipe'} now watches ${item.name}.`);
  };

  const handleDeleteMenuDependency = async (dep) => {
    if (!window.confirm(`Remove dependency: ${dep.recipeName || 'Recipe'} → ${dep.inventoryItemName || 'item'}?`)) return;
    await safeOpsWrite({ action: 'delete', collectionName: 'menuDependencies', docId: dep.id, label: 'Menu dependency', before: dep });
  };

  const parseShiftHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = String(start).split(':').map(Number);
    let eh = 23; let em = 0;
    if (end !== 'CLOSE') {
      const parts = String(end).split(':').map(Number);
      eh = parts[0]; em = parts[1] || 0;
    }
    const startM = (sh * 60) + (sm || 0);
    let endM = (eh * 60) + (em || 0);
    if (endM <= startM) endM += 24 * 60;
    return Math.max(0, (endM - startM) / 60);
  };

  const punchHours = (p) => {
    if (!p.clockInTime) return 0;
    const end = p.clockOutTime ? new Date(p.clockOutTime) : new Date();
    const rawMins = (end - new Date(p.clockInTime)) / 60000;
    return Math.max(0, (rawMins - Number(p.breakMinutes || 0)) / 60);
  };

  const todayLaborCost = timePunches.filter(p => p.date === today).reduce((sum, p) => {
    const emp = users.find(u => u.id === p.employeeId);
    return sum + (punchHours(p) * Number(emp?.wage || 0));
  }, 0);

  const taskPeriodKey = (task, dateStr) => {
    if ((task.frequency || 'daily') === 'daily') return dateStr;
    if (task.frequency === 'weekly') {
      const d = new Date(dateStr + 'T12:00:00');
      const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      return formatDate(d);
    }
    if (task.frequency === 'monthly') return dateStr.substring(0, 7);
    return dateStr;
  };

  const taskIsDueToday = (task) => {
    if ((task.frequency || 'daily') === 'daily') return true;
    if (task.frequency === 'weekly') return !task.targetDay || task.targetDay === todayName;
    if (task.frequency === 'monthly') return String(task.targetDate || '1') === String(todayDate.getDate());
    return true;
  };

  const dueTasks = tasks.filter(taskIsDueToday);
  const doneTasks = dueTasks.filter(t => !!t.completions?.[taskPeriodKey(t, today)]);
  const openTasks = dueTasks.filter(t => !t.completions?.[taskPeriodKey(t, today)]);
  const taskPct = dueTasks.length ? Math.round((doneTasks.length / dueTasks.length) * 100) : 100;

  const todayMs = new Date(today + 'T12:00:00').getTime();
  const overduePm = pmSchedules.filter(pm => {
    if (!pm.lastCompleted) return true;
    const lastMs = new Date(pm.lastCompleted + 'T12:00:00').getTime();
    const daysSince = Math.floor((todayMs - lastMs) / 86400000);
    return (Number(pm.frequencyDays || 30) - daysSince) <= 0;
  });

  const avgMonthSales = monthSales.length ? monthSales.reduce((s, d) => s + Number(d.grossSales || 0), 0) / monthSales.length : 0;
  const sameWeekdaySales = sales.filter(s => {
    if (!s.date || s.date >= today) return false;
    return new Date(s.date + 'T12:00:00').getDay() === todayDate.getDay();
  }).slice(-8);
  const forecastSales = sameWeekdaySales.length
    ? sameWeekdaySales.reduce((sum, s) => sum + Number(s.grossSales || 0), 0) / sameWeekdaySales.length
    : avgMonthSales;

  const laborPct = todaySales?.grossSales ? Math.round((todayLaborCost / Math.max(1, Number(todaySales.grossSales))) * 1000) / 10 : null;
  const wasteCost = todayWaste.reduce((sum, w) => sum + Number(w.cost || 0), 0);

  const healthParts = [
    Math.max(0, 100 - (lowStockItems.length * 4)),
    Math.max(0, 100 - (openMaintenance.length * 8) - (criticalMaintenance.length * 10)),
    taskPct,
    Math.max(0, 100 - (todayWaste.length * 6)),
    laborPct === null ? 90 : Math.max(0, 100 - Math.max(0, laborPct - 25) * 4)
  ];
  const healthScore = Math.round(healthParts.reduce((a,b)=>a+b,0) / healthParts.length);

  const prepForecast = [
    { label: 'Forecast Sales', value: forecastSales ? `$${Math.round(forecastSales).toLocaleString()}` : 'Needs sales data', note: sameWeekdaySales.length ? 'Based on same weekdays' : 'Based on month average' },
    { label: hasCustomRosterRoles ? 'Roster Coverage' : 'Kitchen Coverage', value: `${todayShifts.filter(s => (hasCustomRosterRoles ? configuredRosterRoles : ['Kitchen','Cook','Line Cook','Prep Cook','Chef','Sous Chef']).includes(s.role)).length} scheduled`, note: `${todayShifts.length} total published shifts` },
    { label: 'Prep Pressure', value: forecastSales > avgMonthSales * 1.15 && avgMonthSales > 0 ? 'High' : forecastSales > 0 ? 'Normal' : 'Unknown', note: forecastSales > avgMonthSales * 1.15 && avgMonthSales > 0 ? 'Sales forecast is above normal' : 'No spike detected' },
    { label: 'Low Stock', value: `${lowStockItems.length} items`, note: lowStockItems.slice(0, 3).map(i => i.name).join(', ') || 'No par issues found' }
  ];

  const scheduleWarnings = users.map(u => {
    const weekShifts = shifts.filter(s => s.employeeId === u.id && s.isPublished && s.date >= today && s.date <= formatDate(new Date(todayDate.getTime() + 6 * 86400000)));
    const hours = weekShifts.reduce((sum, s) => sum + parseShiftHours(s.startTime, s.endTime), 0);
    const days = [...new Set(weekShifts.map(s => s.date))].length;
    if (hours >= 38) return `${u.name} is projected near overtime (${hours.toFixed(1)} hrs).`;
    if (days >= 6) return `${u.name} has ${days} scheduled days in the next week.`;
    return null;
  }).filter(Boolean).slice(0, 5);

  const stockNeed = (item) => Math.max(0, Math.ceil(Number(item.parLevel || 0) - Number(item.currentStock || 0)));
  const urgent86Items = lowStockItems.filter(i => Number(i.currentStock || 0) <= 0 || (Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) / Math.max(1, Number(i.parLevel || 1)) <= 0.25));
  const dependencyReport = buildMenuDependencyReport({ recipes, inventoryItems, prepItems: tasks, menuDependencies, events });
  const affectedMenuItems = dependencyReport.affectedRecipes.slice(0, 12);
  const menuGraphCoverage = recipes.length ? Math.round((new Set(menuDependencies.map(dep => dep.recipeId)).size / recipes.length) * 100) : 0;

  const recommendations = [
    affectedMenuItems.length > 0 ? `Menu dependency: ${affectedMenuItems[0].recipe.name || affectedMenuItems[0].recipe.title || 'A recipe'} is affected by ${affectedMenuItems[0].lowStockMatches.map(i => i.name).join(', ')}.` : (lowStockItems.length > 0 ? `Order check: ${lowStockItems.slice(0, 3).map(i => i.name).join(', ')} ${lowStockItems.length > 3 ? `and ${lowStockItems.length - 3} more` : ''}.` : 'Inventory pars look clean right now.'),
    criticalMaintenance.length > 0 ? `Maintenance first: ${criticalMaintenance[0].equipment} needs attention.` : 'No high priority equipment fires showing.',
    openTasks.length > 0 ? `Opening focus: ${openTasks.slice(0, 3).map(t => t.title).join(', ')}.` : "Today's task list is buttoned up.",
    overduePm.length > 0 ? `Preventative maintenance overdue: ${overduePm.slice(0, 2).map(pm => pm.title).join(', ')}.` : 'Preventative maintenance countdowns are quiet.',
    scheduleWarnings.length > 0 ? scheduleWarnings[0] : 'No immediate schedule warnings detected.'
  ];

  const suggestedPrepTasks = [
    ...lowStockItems.slice(0, 4).map(i => `Prep/order recovery: ${i.name} is below par by ${stockNeed(i)}.`),
    forecastSales > avgMonthSales * 1.15 && avgMonthSales > 0 ? 'High forecast: add backup proteins, fries, sauces, and expo garnish before rush.' : null,
    importantEvents.length > 0 ? `Event prep: review ${importantEvents.slice(0, 2).map(e => e.title).join(' / ')}.` : null,
    criticalMaintenance.length > 0 ? `Equipment watch: ${criticalMaintenance[0].equipment} needs manager follow-up.` : null,
    todayShifts.filter(s => (hasCustomRosterRoles ? configuredRosterRoles : ['Kitchen','Cook','Line Cook','Prep Cook','Chef','Sous Chef']).includes(s.role)).length < 2 ? 'Coverage risk: verify roster-role coverage before peak service.' : null
  ].filter(Boolean).slice(0, 8);

  const handleBuildSmartOrder = async () => {
    const items = lowStockItems.filter(i => stockNeed(i) > 0);
    if (items.length === 0) return addToast('AI Ordering', 'No below-par items found.');
    if (!window.confirm(`Build pending order quantities for ${items.length} below-par items?`)) return;
    try {
      await Promise.all(items.map(i => safeOpsWrite({ action: 'update', collectionName: 'inventoryItems', docId: i.id, label: 'AI ordering', before: i, data: {
        pendingQty: Math.max(Number(i.pendingQty || 0), stockNeed(i)),
        lastAiOrderDate: getToday(),
        lastAiOrderBy: appUser?.name || 'Kitchen Command Center'
      } })));
      await logAudit(appUser, 'AI_ORDERING_BUILT', 'inventoryItems', `Queued ${items.length} below-par items from Kitchen Command Center.`);
      addToast('AI Ordering Built', `${items.length} item(s) queued for ordering.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const handleCreateSmartPrepTasks = async () => {
    if (suggestedPrepTasks.length === 0) return addToast('Smart Prep', 'No smart prep tasks needed right now.');
    if (!window.confirm(`Create ${suggestedPrepTasks.length} smart prep task(s) for today?`)) return;
    try {
      const existingToday = new Set(tasks.filter(t => t.source === 'ops-smart-prep' && t.generatedForDate === today).map(t => t.title));
      const adds = suggestedPrepTasks
        .filter(title => !existingToday.has(title))
        .map(title => safeOpsWrite({ action: 'add', collectionName: 'tasks', label: 'Smart prep task', data: {
          title,
          category: 'Smart Prep',
          frequency: 'daily',
          generatedForDate: today,
          generatedAt: new Date().toISOString(),
          source: 'ops-smart-prep',
          completions: {},
          restaurantId: appUser.restaurantId
        } }));
      await Promise.all(adds);
      await logAudit(appUser, 'SMART_PREP_CREATED', 'tasks', `Created ${adds.length} smart prep tasks for ${today}.`);
      addToast('Smart Prep Created', `${adds.length} task(s) added to Prep & Tasks.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const handlePost86Alert = async () => {
    if (urgent86Items.length === 0) return addToast('86 Radar', 'No urgent 86/low-stock items found.');
    const watched = urgent86Items.slice(0, 10);
    const alertLines = watched.map(i => {
      const impactText = buildMenuImpactText(i, menuDependencies);
      return `• ${i.name}: ${Number(i.currentStock || 0)} on hand / par ${Number(i.parLevel || 0)}${impactText ? `\n  ${impactText}` : ''}`;
    });
    const menuImpactItems = watched
      .flatMap(i => getMenuImpactForInventoryItem(i, menuDependencies).map(row => row.name))
      .filter(Boolean);
    const dedupedImpacts = Array.from(new Set(menuImpactItems));
    const text = `86 / Low Stock Watch:\n${alertLines.join('\n')}`;
    try {
      await safeOpsWrite({ action: 'add', collectionName: 'events', label: '86 alert', data: {
        date: new Date().toISOString(),
        title: text,
        type: 'note',
        messageCategory: '86 Alert',
        author: appUser?.name || 'Kitchen Command Center',
        isImportant: true,
        restaurantId: appUser.restaurantId,
        replies: [],
        commandCenterAlert: true,
        managerBriefAlert: true,
        kitchenCommandCenterAlert: true,
        menuImpact: dedupedImpacts.length ? `No longer available from the menu: ${dedupedImpacts.slice(0, 8).join(', ')}` : '',
        menuImpactItems: dedupedImpacts,
        source: 'kitchen_command_center_86_watch'
      } });
      addToast('86 Alert Posted', dedupedImpacts.length ? 'Posted with Menu Intelligence impact.' : 'Important low-stock alert posted to Message Board.');
    } catch (err) { addToast('Error', err.message); }
  };

  const handleMarkOpsReviewed = async () => {
    try {
      await logAudit(appUser, 'OPS_REVIEWED', 'ops', `Reviewed Kitchen Command Center for ${today}. Health score ${healthScore}/100.`);
      addToast('Kitchen Command Reviewed', 'Review logged to audit trail.');
    } catch (err) { addToast('Error', err.message); }
  };

  const timeline = [
    ...timePunches.filter(p => p.date === today).map(p => ({
      at: p.clockOutTime || p.clockInTime,
      type: p.clockOutTime ? 'Clock Out' : 'Clock In',
      title: `${p.employeeName || users.find(u => u.id === p.employeeId)?.name || 'Staff'} ${p.clockOutTime ? 'clocked out' : 'clocked in'}`,
      detail: p.status || ''
    })),
    ...todayWaste.map(w => ({ at: w.timestamp || today, type: 'Waste', title: `${w.itemName || 'Item'} wasted`, detail: `${w.qty || ''} ${w.reason || ''}` })),
    ...maintenanceLogs.filter(l => (l.reportedAt || '').startsWith(today) || (l.lastUpdated || '').startsWith(today)).map(l => ({ at: l.lastUpdated || l.reportedAt, type: 'Maintenance', title: l.equipment, detail: l.issue })),
    ...todayEvents.map(e => ({ at: e.date || e.timestamp || today, type: e.messageCategory || e.type || 'Event', title: e.title || 'Event', detail: e.notes || e.menuImpact || e.author || '' })),
    ...currentSpecials.map(special => ({ at: `${special.startDate || today}T12:00:00`, type: `Special - ${special.status || 'Scheduled'}`, title: special.name || 'Kitchen special', detail: special.description || special.prepNotes || '' })),
    ...todayShifts.slice(0, 12).map(s => ({ at: `${today}T${s.startTime || '00:00'}:00`, type: 'Scheduled', title: `${users.find(u => u.id === s.employeeId)?.name || 'Staff'} ${s.role || ''}`, detail: `${formatShortTime(s.startTime)} - ${formatShortTime(s.endTime)}` }))
  ].filter(x => x.at).sort((a,b) => new Date(b.at) - new Date(a.at)).slice(0, 18);

  const briefText = () => {
    const lines = [
      `Good morning, ${appUser?.name?.split(' ')[0] || 'team'}.`,
      `Restaurant health score: ${healthScore}/100.`,
      yesterdaySales ? `Yesterday sales: $${Number(yesterdaySales.grossSales || 0).toLocaleString()}.` : 'Yesterday sales are not entered yet.',
      todaySales ? `Today sales entered: $${Number(todaySales.grossSales || 0).toLocaleString()}.` : 'Today sales are not entered yet.',
      `Today: ${todayShifts.length} shifts, ${activePunches.length} currently clocked in.`,
      `Open tasks: ${openTasks.length}. Low-stock items: ${lowStockItems.length}. Open maintenance: ${openMaintenance.length}.`,
      currentSpecials.length ? `Current specials: ${currentSpecials.map(special => special.name).join(', ')}.` : 'No current specials are posted.',
      `Top priority: ${recommendations.find(Boolean) || 'Keep service smooth.'}`
    ];
    return lines.join('\n');
  };

  const handlePostBrief = async () => {
    try {
      await safeOpsWrite({ action: 'add', collectionName: 'events', label: 'Morning brief', data: {
        date: new Date().toISOString(),
        title: briefText(),
        type: 'note',
        author: appUser?.name || 'Kitchen Command Center',
        isImportant: false,
        restaurantId: appUser.restaurantId,
        replies: []
      } });
      addToast('Morning Brief Posted', 'Saved to the Message Board for the team.');
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  const handleSeedKitchenOps = async () => {
    if (!window.confirm('Add the default end-all kitchen tasks and PM schedules? Existing matching titles will be skipped.')) return;
    const defaultTasks = [
      { title: 'Opening line check completed', category: 'General', frequency: 'daily' },
      { title: 'Cooler and freezer temps logged', category: 'General', frequency: 'daily' },
      { title: '86 list reviewed with FOH', category: 'General', frequency: 'daily' },
      { title: 'Fryer filter and oil quality checked', category: 'Cleaning', frequency: 'daily' },
      { title: 'Expo station stocked before rush', category: 'General', frequency: 'daily' },
      { title: 'Walk-in shelves wiped down', category: 'Cleaning', frequency: 'weekly', targetDay: 'Monday' },
      { title: 'Deep clean fryer bay', category: 'Cleaning', frequency: 'weekly', targetDay: 'Tuesday' },
      { title: 'Check first aid and burn kit', category: 'General', frequency: 'monthly', targetDate: '1' }
    ];
    const defaultPm = [
      { title: 'Clean hood filters', equipment: 'Hood System', frequencyDays: 7 },
      { title: 'Delime dish machine', equipment: 'Dish Machine', frequencyDays: 30 },
      { title: 'Inspect cooler gaskets', equipment: 'Coolers', frequencyDays: 30 },
      { title: 'Grease trap service check', equipment: 'Grease Trap', frequencyDays: 30 },
      { title: 'Fire suppression visual check', equipment: 'Fire Suppression', frequencyDays: 90 }
    ];
    try {
      const existingTaskTitles = new Set(tasks.map(t => (t.title || '').toLowerCase()));
      const existingPmTitles = new Set(pmSchedules.map(p => (p.title || '').toLowerCase()));
      const taskAdds = defaultTasks
        .filter(t => !existingTaskTitles.has(t.title.toLowerCase()))
        .map(t => safeOpsWrite({ action: 'add', collectionName: 'tasks', label: 'Seed kitchen task', data: { ...t, completions: {}, restaurantId: appUser.restaurantId } }));
      const pmAdds = defaultPm
        .filter(p => !existingPmTitles.has(p.title.toLowerCase()))
        .map(p => safeOpsWrite({ action: 'add', collectionName: 'pmSchedules', label: 'Seed PM schedule', data: { ...p, lastCompleted: getToday(), lastUpdatedBy: appUser.name, restaurantId: appUser.restaurantId } }));
      await Promise.all([...taskAdds, ...pmAdds]);
      addToast('Kitchen Standards Seeded', `Added ${taskAdds.length + pmAdds.length} operating standards.`);
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  const openInventoryFocus = () => { sessionStorage.setItem('inventoryFocus', 'belowPar'); setActiveTab?.('inventory'); };
  const openAiOrdering = () => { sessionStorage.setItem('inventoryFocus', 'aiOrder'); setActiveTab?.('inventory'); };
  const openPrepPlan = () => { sessionStorage.setItem('prepFocus', 'plan'); setActiveTab?.('prep'); };

  const kpiCards = [
    { label: 'Shift Health', value: `${healthScore}/100`, detail: healthScore >= 85 ? 'Looking good' : healthScore >= 70 ? 'Check weak spots' : 'Needs manager attention' },
    { label: 'Open Tasks', value: `${openTasks.length}`, detail: `${doneTasks.length}/${dueTasks.length || 0} completed today` },
    { label: 'Specials', value: `${currentSpecials.length}`, detail: currentSpecials.length ? 'On for service today' : `${upcomingSpecials.length} upcoming` },
    { label: 'Low Stock', value: `${lowStockItems.length}`, detail: `${pendingOrderItems.length} already pending` },
    { label: 'Menu Impact', value: `${affectedMenuItems.length}`, detail: affectedMenuItems.length ? 'Menu items affected' : 'Menu looks clear' },
    { label: 'Maintenance', value: `${openMaintenance.length}`, detail: `${criticalMaintenance.length} high priority` },
    { label: 'Labor Now', value: laborPct === null ? `$${todayLaborCost.toFixed(0)}` : `${laborPct}%`, detail: activePunches.length ? `${activePunches.length} clocked in` : 'Nobody clocked in' },
    { label: 'Waste Today', value: `${todayWaste.length}`, detail: wasteCost ? `$${wasteCost.toFixed(2)} logged` : 'No cost logged' }
  ];

  return (
    <div className="kitchen-command-compact desktop-ops-page max-w-7xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      <div className={`${T.card} command-hero p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] overflow-hidden relative`}>
        <div className="absolute -top-8 -right-6 text-[120px] font-black text-[#D4A381]/5 leading-none">86</div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4A381] mb-2">Shift Snapshot</div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Kitchen Command Center</h1>
            <p className="text-sm text-slate-400 font-medium mt-2 max-w-2xl">A short list of what needs attention right now.</p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button onClick={handlePostBrief} className={`${T.btn} flex items-center justify-center gap-2`}><Send size={16}/> Post Brief</button>
            <button onClick={openPrepPlan} className={`${T.btnAlt} flex items-center justify-center gap-2`}><ClipboardList size={16}/> Prep Plan</button>
            <button onClick={openAiOrdering} className={`${T.btnAlt} flex items-center justify-center gap-2`}><Package size={16}/> AI Ordering</button>
            <button onClick={openInventoryFocus} className={`${T.btnAlt} flex items-center justify-center gap-2`}><Bell size={16}/> 86 Alert</button>
            <button onClick={handleMarkOpsReviewed} className={`${T.btnAlt} flex items-center justify-center gap-2`}><Check size={16}/> Reviewed</button>
            {(appUser?.isAdmin || appUser?.permissions?.prep || appUser?.permissions?.team) && <button onClick={handleSeedKitchenOps} className={`${T.btnAlt} flex items-center justify-center gap-2`}><Plus size={16}/> Seed Standards</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">
        {kpiCards.map(card => (
          <button key={card.label} type="button" onClick={card.label === 'Low Stock' ? openInventoryFocus : undefined} className={`${T.card} command-kpi p-3 text-center ${card.label === 'Low Stock' ? 'hover:border-red-500/60 transition-colors cursor-pointer' : 'cursor-default'}`}>
            <div className={`text-[9px] font-black uppercase tracking-widest ${T.muted}`}>{card.label}</div>
            <div className="command-kpi-value text-xl font-black text-[#D4A381] mt-1">{card.value}</div>
            <div className="text-[10px] text-slate-500 font-bold mt-1 truncate">{card.detail}</div>
          </button>
        ))}
      </div>

      <div className={`${T.card} command-card p-4 grid grid-cols-1 lg:grid-cols-3 gap-3`}>
        <div className="lg:col-span-2">
          <h2 className="font-black text-white flex items-center gap-2"><Scale size={18} className={T.copper}/> Do These First</h2>
          <p className="text-xs text-slate-400 font-bold mt-1">The few actions managers need during service.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Suggested Prep</div><div className="text-xl font-black text-white">{suggestedPrepTasks.length}</div></div>
          <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2"><div className="text-[9px] font-black uppercase tracking-widest text-slate-500">86 Watch</div><div className={`text-xl font-black ${urgent86Items.length ? 'text-red-400' : 'text-emerald-400'}`}>{urgent86Items.length}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${T.card} command-card p-4 lg:col-span-2`}>
          <div className="flex items-center justify-between border-b border-[#2A353D] pb-3 mb-3">
            <h2 className="font-black text-white flex items-center gap-2"><ChefHat size={18} className={T.copper}/> Today’s Priorities</h2>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{formatDisplayFullDate(today)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Priority {idx + 1}</div>
                <div className="text-sm font-bold text-slate-200 leading-snug">{rec}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${T.card} command-card p-4`}>
          <h2 className="font-black text-white flex items-center gap-2 border-b border-[#2A353D] pb-3 mb-3"><TrendingUp size={18} className={T.copper}/> Prep Forecast</h2>
          <div className="space-y-2">
            {prepForecast.map(row => (
              <div key={row.label} className="flex justify-between gap-3 bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{row.label}</div>
                  <div className="text-xs text-slate-400 font-bold mt-1">{row.note}</div>
                </div>
                <div className="text-sm font-black text-[#D4A381] text-right whitespace-nowrap">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${T.card} overflow-hidden`}>
          <div className={`${T.th} flex items-center gap-2`}><Package size={14}/> Stock to Check</div>
          <div className={`divide-y ${T.border} command-scroll max-h-[360px] overflow-y-auto custom-scrollbar`}>
            {lowStockItems.length === 0 && <div className="p-6 text-center text-slate-500 font-bold text-sm">No par problems detected.</div>}
            {lowStockItems.slice(0, 12).map(item => {
              const par = Number(item.parLevel || 0);
              const stock = Number(item.currentStock || 0);
              const needed = Math.max(0, par - stock);
              return (
                <button key={item.id} type="button" onClick={openInventoryFocus} className={`${T.row} w-full text-left flex justify-between items-center gap-3 hover:border-red-500/40`}>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{item.name}</div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Stock {stock} / Par {par}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-orange-400">Order {needed}</div>
                    <div className="text-[9px] text-slate-500 font-bold">${Number(item.price || 0).toFixed(2)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${T.card} overflow-hidden`}>
          <div className={`${T.th} flex items-center gap-2`}><Wrench size={14}/> Fixes to Check</div>
          <div className={`divide-y ${T.border} command-scroll max-h-[360px] overflow-y-auto custom-scrollbar`}>
            {openMaintenance.length === 0 && overduePm.length === 0 && <div className="p-6 text-center text-slate-500 font-bold text-sm">No equipment warnings right now.</div>}
            {criticalMaintenance.concat(openMaintenance.filter(l => !criticalMaintenance.includes(l))).slice(0, 8).map(log => (
              <div key={log.id} className={`${T.row}`}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{log.equipment}</div>
                    <div className="text-xs text-slate-400 font-medium mt-1 line-clamp-2">{log.issue}</div>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${log.urgency === 'Critical' ? 'text-red-500' : log.urgency === 'High' ? 'text-orange-400' : 'text-slate-500'}`}>{log.urgency || 'Standard'}</span>
                </div>
              </div>
            ))}
            {overduePm.slice(0, 4).map(pm => (
              <div key={pm.id} className={`${T.row} bg-red-950/10`}>
                <div className="text-sm font-bold text-red-300">PM Overdue: {pm.title}</div>
                <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">{pm.equipment} • every {pm.frequencyDays} days</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${T.card} overflow-hidden`}>
          <div className={`${T.th} flex items-center gap-2`}><Users size={14}/> Labor & Schedule Warnings</div>
          <div className={`divide-y ${T.border}`}>
            {scheduleWarnings.length === 0 && <div className="p-6 text-center text-slate-500 font-bold text-sm">No obvious schedule warnings in the next week.</div>}
            {scheduleWarnings.map((w, idx) => <div key={idx} className={`${T.row} text-sm font-bold text-slate-200`}>{w}</div>)}
            {todayShifts.slice(0, 8).map(s => (
              <div key={s.id} className={`${T.row} flex justify-between items-center text-xs`}>
                <span className="font-bold text-white">{users.find(u => u.id === s.employeeId)?.name || 'Staff'} <span className="text-slate-500">{s.role}</span></span>
                <span className="font-mono text-[#D4A381]">{formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${T.card} overflow-hidden`}>
          <div className={`${T.th} flex items-center gap-2`}><Clock size={14}/> Kitchen Timeline</div>
          <div className={`divide-y ${T.border} command-scroll max-h-[420px] overflow-y-auto custom-scrollbar`}>
            {timeline.length === 0 && <div className="p-6 text-center text-slate-500 font-bold text-sm">No timeline activity for this day yet.</div>}
            {timeline.map((item, idx) => (
              <div key={`${item.type}-${idx}`} className={`${T.row} flex gap-3`}>
                <div className="text-[10px] font-mono text-[#D4A381] w-16 flex-shrink-0">{formatClockTime(item.at)}</div>
                <div className="min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.type}</div>
                  <div className="text-sm font-bold text-white truncate">{item.title}</div>
                  {item.detail && <div className="text-xs text-slate-400 truncate">{item.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className={`${T.card} command-card overflow-hidden`} aria-labelledby="kitchen-specials-heading">
        <div className="p-4 sm:p-5 border-b border-[#2A353D] bg-gradient-to-r from-[#1A2126] to-[#12161A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="kitchen-specials-heading" className="text-lg font-black text-white flex items-center gap-2"><Star size={19} className={T.copper}/> Service Specials</h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">The official list for pre-shift, line execution, allergens, and 86 status. Posted directly - no AI.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManageSpecials && <>
                <button type="button" onClick={() => setSpecialView('current')} className={`${specialView === 'current' ? T.btn : T.btnAlt} px-3`}>Current</button>
                <button type="button" onClick={() => setSpecialView('all')} className={`${specialView === 'all' ? T.btn : T.btnAlt} px-3`}>All & History</button>
                <button type="button" onClick={openNewSpecial} className={`${T.btn} flex items-center gap-1.5`}><Plus size={15}/> Add Special</button>
              </>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <div className="bg-[#0B0E11]/70 border border-[#2A353D] rounded-xl p-3"><div className="text-[11px] uppercase tracking-wider font-black text-slate-500">On Today</div><div className="text-2xl font-black text-[#D4A381] mt-1">{currentSpecials.length}</div></div>
            <div className="bg-[#0B0E11]/70 border border-[#2A353D] rounded-xl p-3"><div className="text-[11px] uppercase tracking-wider font-black text-slate-500">Upcoming</div><div className="text-2xl font-black text-white mt-1">{upcomingSpecials.length}</div></div>
            <div className="bg-[#0B0E11]/70 border border-[#2A353D] rounded-xl p-3"><div className="text-[11px] uppercase tracking-wider font-black text-slate-500">Sold Out</div><div className="text-2xl font-black text-red-300 mt-1">{currentSpecials.filter(s => s.status === 'Sold Out').length}</div></div>
            <div className="bg-[#0B0E11]/70 border border-[#2A353D] rounded-xl p-3"><div className="text-[11px] uppercase tracking-wider font-black text-slate-500">Total Records</div><div className="text-2xl font-black text-white mt-1">{kitchenSpecials.length}</div></div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {displayedSpecials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#3A464F] bg-[#0B0E11]/50 p-7 text-center">
              <Star size={26} className="mx-auto text-[#D4A381] mb-2"/>
              <div className="font-black text-white">No specials are posted for service</div>
              <div className="text-sm text-slate-400 mt-1">{canManageSpecials ? 'Add a special so the whole kitchen has one accurate source of truth.' : 'Your kitchen lead will post upcoming and current specials here.'}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {displayedSpecials.map(special => {
                const isCurrent = currentSpecials.some(row => row.id === special.id);
                const serviceDates = special.startDate === special.endDate || !special.endDate
                  ? formatDisplayFullDate(special.startDate)
                  : `${formatDisplayDate(special.startDate)} - ${formatDisplayDate(special.endDate)}`;
                const statusClass = special.status === 'Sold Out' ? 'border-red-500/50 bg-red-950/20 text-red-300' : special.status === 'Active' ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300' : special.status === 'Archived' ? 'border-slate-600 bg-slate-900/40 text-slate-400' : special.status === 'Draft' ? 'border-amber-500/40 bg-amber-950/20 text-amber-300' : 'border-[#D4A381]/40 bg-[#D4A381]/10 text-[#E7B997]';
                return <article key={special.id} className={`rounded-2xl border p-4 ${isCurrent ? 'border-[#D4A381]/50 bg-gradient-to-br from-[#1A2126] to-[#12161A]' : 'border-[#2A353D] bg-[#12161A]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {isCurrent && <span className="text-[11px] font-black uppercase tracking-wider text-[#D4A381]">On Today</span>}
                        <span className={`text-[11px] font-black uppercase tracking-wider border rounded-full px-2 py-1 ${statusClass}`}>{special.status || 'Scheduled'}</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-2 leading-tight">{special.name}</h3>
                      <div className="text-xs font-bold text-slate-400 mt-1">{serviceDates}</div>
                    </div>
                    <div className="text-right flex-shrink-0"><div className="text-xl font-black text-[#D4A381]">{Number(special.price || 0) > 0 ? `$${Number(special.price).toFixed(2)}` : 'Market'}</div><div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Menu price</div></div>
                  </div>
                  {special.description && <p className="text-sm leading-relaxed font-medium text-slate-200 mt-3 whitespace-pre-wrap">{special.description}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div className="rounded-xl border border-[#2A353D] bg-[#0B0E11]/70 p-3"><div className="text-[11px] font-black uppercase tracking-wider text-orange-300">Allergens</div><div className="text-sm text-slate-300 font-medium mt-1 whitespace-pre-wrap">{special.allergens || 'None listed - verify the recipe before answering a guest.'}</div></div>
                    <div className="rounded-xl border border-[#2A353D] bg-[#0B0E11]/70 p-3"><div className="text-[11px] font-black uppercase tracking-wider text-emerald-300">Dietary Notes</div><div className="text-sm text-slate-300 font-medium mt-1 whitespace-pre-wrap">{special.dietaryNotes || 'No dietary claims listed.'}</div></div>
                  </div>
                  {special.prepNotes && <div className="rounded-xl border border-[#2A353D] bg-[#0B0E11]/70 p-3 mt-2"><div className="text-[11px] font-black uppercase tracking-wider text-[#D4A381]">Prep / 86 Notes</div><div className="text-sm text-slate-200 font-medium mt-1 whitespace-pre-wrap">{special.prepNotes}</div></div>}
                  {canManageSpecials && <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#2A353D]">
                    {special.status === 'Sold Out' ? <button type="button" onClick={() => handleSpecialStatus(special, 'Active')} className={T.btnAlt}>Put Back On</button> : special.status !== 'Archived' && <button type="button" onClick={() => handleSpecialStatus(special, 'Sold Out')} className={T.btnAlt}>Mark Sold Out</button>}
                    <button type="button" onClick={() => openSpecialEditor(special)} className={`${T.btnAlt} flex items-center gap-1.5`}><Edit size={14}/> Edit</button>
                    {special.status !== 'Archived' && <button type="button" onClick={() => handleArchiveSpecial(special)} className={`${T.btnAlt} flex items-center gap-1.5 text-red-300`}><Archive size={14}/> Archive</button>}
                  </div>}
                </article>;
              })}
            </div>
          )}
        </div>
      </section>

      <div className={`${T.card} command-card p-4`}>
        <div className="flex items-center justify-between border-b border-[#2A353D] pb-3 mb-3">
          <h2 className="font-black text-white flex items-center gap-2"><BookOpen size={18} className={T.copper}/> Recipe & Menu Brain</h2>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{recipes.length} recipes tracked</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Use Before It Hurts</div>
            <div className="text-sm font-bold text-white">{lowStockItems.length ? 'Avoid specials using low-stock items.' : 'Inventory is flexible enough for specials.'}</div>
          </div>
          <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Specials Signal</div>
            <div className="text-sm font-bold text-white">{forecastSales > avgMonthSales * 1.15 && avgMonthSales > 0 ? 'Run fast, high-margin items today.' : 'Normal day: good test window for a new special.'}</div>
          </div>
          <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-1">86 Watch</div>
            <div className="text-sm font-bold text-white">{importantEvents.length ? importantEvents[0].title : 'No critical 86 notes posted today.'}</div>{importantEvents[0]?.notes && <div className="text-[11px] text-slate-400 font-bold mt-1 whitespace-pre-wrap line-clamp-3">{importantEvents[0].notes}</div>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
          <form onSubmit={handleAddMenuDependency} className="xl:col-span-2 bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-black text-white text-sm">Dependency Graph Editor</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Manual recipe → inventory links make 86 alerts smarter than text guessing.</div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">{menuGraphCoverage}% mapped</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select value={depRecipeId} onChange={e => setDepRecipeId(e.target.value)} className={T.input}>
                <option value="">Choose recipe/menu item</option>
                {recipes.slice().sort((a,b)=>String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''))).map(r => <option key={r.id} value={r.id}>{r.title || r.name || 'Recipe'}</option>)}
              </select>
              <select value={depInventoryItemId} onChange={e => setDepInventoryItemId(e.target.value)} className={T.input}>
                <option value="">Choose inventory item ({dependencyInventoryOptions.length})</option>
                {dependencyInventoryOptions.map(i => <option key={i.id} value={i.id}>{i.name} • {i.category || 'Inventory'} • Stock {Number(i.currentStock || 0)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input value={depNotes} onChange={e => setDepNotes(e.target.value)} className={T.input} placeholder="Optional note, station, substitute, or recovery hint" />
              <button className={T.btn}>Map Dependency</button>
            </div>
            <div className="text-[9px] font-bold text-slate-500">Showing real inventory records only.{hiddenDependencyNoiseCount > 0 ? ` ${hiddenDependencyNoiseCount} invoice-noise or duplicate record${hiddenDependencyNoiseCount === 1 ? '' : 's'} hidden from this chooser.` : ''}</div>
          </form>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
            <div className="font-black text-white text-sm">Graph Status</div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Links</div><div className="text-xl font-black text-white">{menuDependencies.length}</div></div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Collisions</div><div className="text-xl font-black text-orange-300">{affectedMenuItems.length}</div></div>
            </div>
            <div className="mt-3 max-h-28 overflow-y-auto custom-scrollbar space-y-1">
              {menuDependencies.length === 0 && <div className="text-xs text-slate-500 font-bold">No manual links yet. Start with your best sellers and 86-prone ingredients.</div>}
              {menuDependencies.slice(0, 8).map(dep => <div key={dep.id} className="flex items-center justify-between gap-2 bg-[#12161A] border border-[#2A353D] rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-300"><span className="truncate">{dep.recipeName} → {dep.inventoryItemName}</span><button type="button" onClick={() => handleDeleteMenuDependency(dep)} className="text-red-400 hover:text-red-300 flex-shrink-0">Remove</button></div>)}
            </div>
          </div>
        </div>
        <div className="mt-4 bg-[#0B0E11] border border-[#2A353D] rounded-xl overflow-hidden">
          <div className="p-3 border-b border-[#2A353D] flex items-center justify-between gap-2"><div className="font-black text-white text-sm">Menu Dependency Radar</div><span className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">v15.0.83 precision graph</span></div>
          <div className="divide-y divide-[#2A353D] max-h-[260px] overflow-y-auto custom-scrollbar">
            {affectedMenuItems.length === 0 && <div className="p-4 text-xs font-bold text-slate-500">No dependency collisions detected. Map recipes to ingredients above, or add ingredient names to recipes to sharpen the radar.</div>}
            {affectedMenuItems.map(({ recipe, lowStockMatches, prepMatches, explicitDependencies, eightySixAlerts, confidence, matchReasons }) => (
              <div key={recipe.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0"><div className="font-black text-white text-sm truncate">{recipe.name || recipe.title || 'Recipe'}</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{lowStockMatches.length ? `Affected by ${lowStockMatches.map(i => i.name).join(', ')}` : 'Affected by 86/prep signal'}</div><div className="text-[10px] text-slate-600 font-bold mt-1">{explicitDependencies?.length ? 'Manual graph link • ' : (matchReasons?.length ? `High-confidence match: ${matchReasons.slice(0, 2).join(', ')} • ` : 'Signal match • ')}{confidence ? `${Math.round(confidence)}% confidence • ` : ''}{prepMatches?.length ? `${prepMatches.length} prep signal(s) • ` : ''}{eightySixAlerts?.length ? `${eightySixAlerts.length} active 86 alert(s)` : ''}</div></div>
                <div className="text-[10px] font-black uppercase tracking-widest text-orange-300">{lowStockMatches.some(i => Number(i.pendingQty || 0) > 0) ? 'Recovery pending' : 'Needs action'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={specialEditorOpen} onClose={() => { setSpecialEditorOpen(false); resetSpecialForm(); }} title={editingSpecial ? 'Edit Service Special' : 'Add Service Special'} sizeClass="max-w-3xl">
        <form onSubmit={handleSaveSpecial} className="space-y-4">
          <div className="rounded-xl border border-[#2A353D] bg-[#0B0E11] p-3 text-sm text-slate-300">
            Keep this practical: what the dish is, when it runs, what the line needs to know, and exactly what staff may say about allergens or dietary needs.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
            <div><label className={T.label}>Special Name</label><input value={specialForm.name} onChange={e => setSpecialForm(form => ({ ...form, name: e.target.value }))} className={T.input} maxLength={120} required placeholder="e.g. Friday Fish Fry" /></div>
            <div><label className={T.label}>Menu Price</label><input type="number" min="0" max="100000" step="0.01" value={specialForm.price} onChange={e => setSpecialForm(form => ({ ...form, price: e.target.value }))} className={T.input} placeholder="0.00" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={T.label}>First Service Date</label><input type="date" value={specialForm.startDate} onChange={e => setSpecialForm(form => ({ ...form, startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate }))} className={T.input} required /></div>
            <div><label className={T.label}>Last Service Date</label><input type="date" min={specialForm.startDate} value={specialForm.endDate} onChange={e => setSpecialForm(form => ({ ...form, endDate: e.target.value }))} className={T.input} required /></div>
            <div><label className={T.label}>Service Status</label><select value={specialForm.status} onChange={e => setSpecialForm(form => ({ ...form, status: e.target.value }))} className={T.input}><option>Draft</option><option>Scheduled</option><option>Active</option><option>Sold Out</option>{editingSpecial?.status === 'Archived' && <option>Archived</option>}</select></div>
          </div>
          <div><label className={T.label}>Guest-Facing Description</label><textarea rows="3" maxLength={1200} value={specialForm.description} onChange={e => setSpecialForm(form => ({ ...form, description: e.target.value }))} className={T.input} placeholder="Plain-English description, sides, preparation, and what makes it special." /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={T.label}>Allergens</label><textarea rows="3" maxLength={500} value={specialForm.allergens} onChange={e => setSpecialForm(form => ({ ...form, allergens: e.target.value }))} className={T.input} placeholder="List known allergens and cross-contact cautions. Never guess." /></div>
            <div><label className={T.label}>Dietary Notes</label><textarea rows="3" maxLength={500} value={specialForm.dietaryNotes} onChange={e => setSpecialForm(form => ({ ...form, dietaryNotes: e.target.value }))} className={T.input} placeholder="Only verified claims, substitutions, and restrictions." /></div>
          </div>
          <div><label className={T.label}>Prep, Pickup & 86 Notes</label><textarea rows="4" maxLength={1200} value={specialForm.prepNotes} onChange={e => setSpecialForm(form => ({ ...form, prepNotes: e.target.value }))} className={T.input} placeholder="Station, batch size, plating, pickup call, pars, substitutions, and what to do when sold out." /></div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setSpecialEditorOpen(false); resetSpecialForm(); }} className={T.btnAlt}>Cancel</button>
            <button type="submit" disabled={specialSaving} className={`${T.btn} flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait`}>{specialSaving ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} {specialSaving ? 'Saving...' : editingSpecial ? 'Save Changes' : specialForm.status === 'Draft' ? 'Save Draft' : 'Publish Special'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const TabToday = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOffRequests, events, sales, timePunches, inventoryItems, maintenanceLogs, prepItems, tasks, recipes, menuDependencies = [], clientData, setActiveTab, addToast, registerUndo }) => {
  const todayPlanAccess = usePlanAccess(appUser, clientData);
  const canUseManagerBrief = todayPlanAccess.canUse(FEATURE_KEYS.MANAGER_BRIEF).allowed;
  const canUseBasicInventory = todayPlanAccess.canUse(FEATURE_KEYS.BASIC_INVENTORY).allowed || todayPlanAccess.canUse(FEATURE_KEYS.BURN_LOG).allowed;
  const canUseMenuIntelligence = todayPlanAccess.canUse(FEATURE_KEYS.MENU_INTELLIGENCE).allowed || todayPlanAccess.canUse(FEATURE_KEYS.SMART_86_ALERTS).allowed;
  const canUseAiOrdering = todayPlanAccess.canUse(FEATURE_KEYS.AI_ORDER_ASSISTANT).allowed;
  const canUsePythonIntelligence = todayPlanAccess.canUse(FEATURE_KEYS.PYTHON_INTELLIGENCE).allowed;
  const canUseLabor = todayPlanAccess.canUse(FEATURE_KEYS.LABOR_COMMAND).allowed || todayPlanAccess.canUse(FEATURE_KEYS.TIME_CLOCK).allowed;
  const canUseScheduleBuilder = todayPlanAccess.canUse(FEATURE_KEYS.SCHEDULE_BUILDER).allowed;
  const canUseCleaningRoutines = todayPlanAccess.canUse(FEATURE_KEYS.CLEANING_ROUTINES).allowed;
  const [expanded, setExpanded] = useState({ brief: true, setup: false, problems: true, prefs: false });
  const [briefOpsIntel, setBriefOpsIntel] = useState(null);
  const [briefOpsLoading, setBriefOpsLoading] = useState(false);
  const [briefOpsError, setBriefOpsError] = useState('');
  const [briefOpsCopied, setBriefOpsCopied] = useState(false);
  const today = getToday();
  const profile = getHomeProfile(appUser);
  const safeTodayWrite = (args) => safeWriteWithQueue({ user: appUser, addToast, ...args });
  const activeUserIds = new Set(users.filter(u => u?.isActive !== false).flatMap(u => [u.id, u.uid, u.authUid, u.userId].filter(Boolean)));
  const todaysShifts = shifts
    .filter(s => s.date === today && s.isPublished && s.isDeleted !== true && s.cancelled !== true && !s.deletedAt)
    .filter(s => !s.employeeId || activeUserIds.has(s.employeeId))
    .sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const myShift = todaysShifts.find(s => [appUser.id, appUser.uid, appUser.authUid].filter(Boolean).includes(s.employeeId));
  const activePunches = canUseLabor ? timePunches.filter(p => ['clocked_in','on_break'].includes(p.status)) : [];
  const importantNotes = events.filter(e => e.type === 'note' && e.isImportant).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
  const todayEvents = events.filter(e => e.type === 'special_event' && e.date === today).sort((a,b) => (a.time || '').localeCompare(b.time || ''));
  const lowStock = canUseBasicInventory ? inventoryItems.filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) < Number(i.parLevel || 0)).sort((a,b) => (Number(a.currentStock||0) - Number(a.parLevel||0)) - (Number(b.currentStock||0) - Number(b.parLevel||0))).slice(0, 8) : [];
  const urgentMaintenance = canUseCleaningRoutines ? maintenanceLogs.filter(m => !['Completed','Closed','Resolved'].includes(m.status) && ['High','Critical'].includes(m.urgency)).slice(0, 5) : [];
  const openPrep = prepItems.filter(p => (p.date === today || p.date === 'MASTER') && !p.isCompleted).slice(0, 8);
  const pendingRequests = canUseScheduleBuilder ? timeOffRequests.filter(r => r.status === 'pending').slice(0, 5) : [];
  const openSwaps = canUseScheduleBuilder ? shiftSwaps.filter(s => s.status === 'available' && s.date >= today).slice(0, 5) : [];
  const briefVendors = useLiveCollection('vendors', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseAiOrdering, limitCount: 80, fallbackLimitCount: 35 });
  const briefWasteLogs = useLiveCollection('wasteLogs', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseAiOrdering, limitCount: 120, fallbackLimitCount: 35 });
  const briefInvoices = useLiveCollection('invoices', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUseAiOrdering, limitCount: 80, fallbackLimitCount: 30 });
  const briefAvailabilityRecords = useLiveCollection('availabilityRecords', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUsePythonIntelligence, limitCount: 160, fallbackLimitCount: 45 });
  const briefReminders = useLiveCollection('personalReminders', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUsePythonIntelligence, limitCount: 160, fallbackLimitCount: 45 });
  const briefAuditLogs = useLiveCollection('auditLogs', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && canUsePythonIntelligence, limitCount: 160, fallbackLimitCount: 45 });
  const aiBrief = canUseAiOrdering ? buildAiOrderAssistant({ inventoryItems, vendors: briefVendors, wasteLogs: briefWasteLogs, invoices: briefInvoices, events, prepItems, menuDependencies, currentDate: today, daysAhead: 7, eventDaysAhead: 14 }) : { managerBrief: [], recommendations: [], eventNeeds: [], priceWarnings: [] };
  const aiBriefTop = aiBrief.recommendations?.filter(row => row.suggestedQty > 0).slice(0, 3) || [];
  const briefOpsSummary = briefOpsIntel?.summary || {};
  const briefOpsFindings = [
    ...(briefOpsIntel?.priceWatch || []).map(row => ({ area: 'Inventory', title: row.itemName || 'Price watch', detail: row.summary || row.detail || 'Review invoice pricing.', tab: 'inventory', focus: 'invoices', severity: row.severity || 'medium' })),
    ...(briefOpsIntel?.invoiceAnomalies || []).map(row => ({ area: 'Inventory', title: row.title || 'Invoice anomaly', detail: row.detail || row.recommendation || 'Review invoice history.', tab: 'inventory', focus: 'invoices', severity: row.severity || 'medium' })),
    ...(briefOpsIntel?.parRecommendations || []).map(row => ({ area: 'Inventory', title: row.itemName ? `Par review: ${row.itemName}` : 'Par recommendation', detail: row.reason || `Suggested par ${row.suggestedPar || ''}`.trim() || 'Review par level.', tab: 'inventory', focus: 'belowPar', severity: 'medium' })),
    ...(briefOpsIntel?.wasteInsights || []).map(row => ({ area: 'Inventory', title: row.itemName ? `Waste pattern: ${row.itemName}` : 'Waste pattern', detail: row.suggestion || row.detail || 'Review burn/waste logs.', tab: 'inventory', focus: 'waste', severity: row.severity || 'medium' })),
    ...(briefOpsIntel?.eventSupplyPlan || []).map(row => ({ area: 'Event Calendar', title: row.eventTitle || row.title || 'Event supply risk', detail: row.summary || row.detail || 'Review event supply planning.', tab: 'events', severity: row.severity || 'medium' })),
    ...(briefOpsIntel?.menuCosting || []).map(row => ({ area: 'Menu Intelligence', title: row.recipeName || 'Menu costing review', detail: row.foodCostPct ? `${row.foodCostPct}% food cost estimate. Review recipe links and invoice costs.` : 'Review recipe costing and ingredient links.', tab: 'menu-intelligence', severity: 'low' })),
    ...(briefOpsIntel?.laborScheduleWarnings || []).map(row => ({ area: 'Financials', title: row.title || 'Labor/schedule warning', detail: row.detail || 'Review labor, punches, or schedule coverage.', tab: String(row.type || '').includes('request') || String(row.title || '').toLowerCase().includes('request') ? 'published' : 'financials', scheduleFocus: String(row.title || '').toLowerCase().includes('availability') ? 'availability' : 'time-off', severity: row.severity || 'medium' })),
    ...(briefOpsIntel?.dataHealth || []).map(row => ({ area: row.area || 'System Administrator', title: row.title || 'Data health finding', detail: Array.isArray(row.issues) ? row.issues.join(', ') : (row.detail || 'Review the affected records.'), tab: String(row.area || '').toLowerCase().includes('inventory') ? 'inventory' : String(row.area || '').toLowerCase().includes('menu') ? 'menu-intelligence' : String(row.area || '').toLowerCase().includes('staff') ? 'team' : 'godmode', severity: row.severity || 'medium' })),
    ...(briefOpsIntel?.backupChecks || []).map(row => ({ area: 'System Administrator', title: row.title || 'Backup check', detail: row.detail || row.recommendation || 'Review backup center.', tab: 'godmode', severity: row.status === 'attention' ? 'high' : 'low' }))
  ].slice(0, 18);
  const recentTabs = (() => { try { return JSON.parse(localStorage.getItem(`recentTabs_${appUser.id}`) || '[]'); } catch { return []; } })();
  const setupItems = [
    { label: 'Restaurant profile', done: !!clientData?.name, tab: 'settings', allowed: appUser?.isAdmin || appUser?.permissions?.settings },
    { label: 'Add team members', done: users.length > 1, tab: 'team', allowed: appUser?.isAdmin || appUser?.permissions?.team },
    { label: 'Build this week schedule', done: shifts.some(s => s.date >= today), tab: 'schedule', allowed: canUseScheduleBuilder },
    { label: 'Add recipes', done: recipes.length > 0, tab: 'recipes', allowed: true },
    { label: 'Add inventory items', done: inventoryItems.length > 0, tab: 'inventory', allowed: canUseBasicInventory },
    { label: 'Post first announcement', done: events.some(e => e.type === 'note'), tab: 'messages', allowed: true },
    { label: 'Add maintenance log', done: maintenanceLogs.length > 0, tab: 'maintenance', allowed: canUseCleaningRoutines }
  ].filter(item => item.allowed !== false);
  const setupDone = setupItems.filter(i => i.done).length;
  const setupTotal = Math.max(1, setupItems.length);
  const openInventoryFocus = () => { sessionStorage.setItem('inventoryFocus', 'belowPar'); setActiveTab('inventory'); };
  const openAiOrdering = () => { sessionStorage.setItem('inventoryFocus', 'aiOrder'); setActiveTab('inventory'); };
  const openPrepPlan = () => { sessionStorage.setItem('prepFocus', 'plan'); setActiveTab('prep'); };
  const openMaintenanceCenter = () => { setActiveTab('maintenance'); };
  const openMessageBoard = () => { setActiveTab('messages'); };
  const open86Center = () => { sessionStorage.setItem('inventoryFocus', 'belowPar'); setActiveTab('inventory'); };
  const openOpsFinding = (row = {}) => {
    const tab = row.tab || 'godmode';
    try {
      if (tab === 'inventory' && row.focus) sessionStorage.setItem('inventoryFocus', row.focus === 'invoices' ? 'invoices' : row.focus === 'waste' ? 'waste' : row.focus);
      if (tab === 'published' && row.scheduleFocus) sessionStorage.setItem('scheduleFocus', row.scheduleFocus);
    } catch (e) {}
    setActiveTab(tab);
  };
  const runBriefPythonOps = async () => {
    if (!appUser?.restaurantId) return addToast?.('Missing Workspace', 'Choose a workspace before running Python Ops Scan.');
    if (!canUsePythonIntelligence) return addToast?.('Smart Kitchen Required', 'Python Ops Scan starts with Smart Kitchen.');
    setBriefOpsLoading(true);
    setBriefOpsError('');
    setBriefOpsCopied(false);
    try {
      const response = await secureFetch('/api/python-ops-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          currentDate: today,
          daysAhead: 7,
          inventoryItems,
          vendors: briefVendors,
          wasteLogs: briefWasteLogs,
          invoices: briefInvoices,
          events,
          prepItems,
          menuDependencies,
          recipes,
          users,
          shifts,
          timePunches,
          timeOffRequests,
          availabilityRecords: briefAvailabilityRecords,
          reminders: briefReminders,
          tasks,
          maintenanceLogs,
          auditLogs: briefAuditLogs,
          backupStatus: {}
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(readableApiError(payload?.error || payload?.message || payload) || 'Python Ops Intelligence failed.');
      setBriefOpsIntel(payload);
      addToast?.('Python Ops Scan Ready', `${payload?.summary?.dataHealthCount || 0} data issues, ${payload?.summary?.laborWarningCount || 0} labor warnings, ${payload?.summary?.menuCostCount || 0} menu cost checks.`);
    } catch (error) {
      const message = error?.message || 'Python Ops Intelligence is unavailable.';
      setBriefOpsError(message);
      addToast?.('Python Ops Scan Unavailable', message);
    } finally {
      setBriefOpsLoading(false);
    }
  };
  const copyBriefOpsReport = async () => {
    const value = briefOpsIntel?.reports?.text || JSON.stringify(briefOpsIntel || {}, null, 2);
    if (!briefOpsIntel) return addToast?.('No Report Ready', 'Run Python Ops Scan first.');
    try {
      await navigator.clipboard.writeText(value);
      setBriefOpsCopied(true);
      setTimeout(() => setBriefOpsCopied(false), 1600);
      addToast?.('Ops Report Copied', 'Paste it into a document, email, or notes for review.');
    } catch (err) {
      addToast?.('Copy Failed', 'Your browser blocked clipboard access.');
    }
  };
  const problems = [
    canUseBasicInventory && lowStock.length ? { tone: 'red', title: 'Inventory below par', detail: `${lowStock.length} item${lowStock.length===1?'':'s'} need attention.`, tab: 'inventory', onClick: openInventoryFocus } : null,
    canUseCleaningRoutines && urgentMaintenance.length ? { tone: 'red', title: 'Maintenance urgent', detail: `${urgentMaintenance.length} high priority issue${urgentMaintenance.length===1?'':'s'} open.`, tab: 'maintenance' } : null,
    canUseScheduleBuilder && pendingRequests.length ? { tone: 'amber', title: 'Time off pending', detail: `${pendingRequests.length} request${pendingRequests.length===1?'':'s'} waiting.`, tab: 'schedule' } : null,
    canUseScheduleBuilder && openSwaps.length ? { tone: 'blue', title: 'Shift trade board', detail: `${openSwaps.length} shift${openSwaps.length===1?'':'s'} available.`, tab: 'published' } : null,
    canUseScheduleBuilder && !todaysShifts.length ? { tone: 'amber', title: 'No published shifts today', detail: 'Check schedule coverage before service.', tab: 'schedule' } : null
  ].filter(Boolean);

  const quickCreate = async (kind) => {
    try {
      let undoMeta = null;
      if (kind === '86') {
        const item = prompt('What item is 86\'d or low?');
        if (!item) return;
        const resolved = resolveEightySixInventoryMatch(item, inventoryItems, menuDependencies);
        const inventoryItem = resolved?.item || null;
        const impactText = inventoryItem ? buildMenuImpactText(inventoryItem, menuDependencies) : '';
        const impactItems = inventoryItem ? getMenuImpactForInventoryItem(inventoryItem, menuDependencies).map(i => i.name).filter(Boolean) : [];
        const matchText = inventoryItem && String(inventoryItem.name || '').toLowerCase() !== String(item || '').toLowerCase()
          ? `Inventory match: ${inventoryItem.name}${resolved?.method === 'menuIntelligence' ? ' (matched through Menu Intelligence)' : ''}.`
          : '';
        const notes = [matchText, impactText, resolved?.matchedMenuItemName ? `Menu phrase matched: ${resolved.matchedMenuItemName}.` : ''].filter(Boolean).join('\n');
        const result = await safeTodayWrite({ action: 'add', collectionName: 'events', label: 'Manager Brief quick 86 alert', data: {
          restaurantId: appUser.restaurantId, type: 'note', title: `86 ALERT: ${item}`, messageCategory: '86 Alert', author: appUser.name, isImportant: true, date: new Date().toISOString(), replies: [], readBy: [{ userId: appUser.id, name: appUser.name, at: new Date().toISOString() }],
          notes, menuImpact: impactText, menuImpactItems: impactItems, inventoryItemId: inventoryItem?.id || '', inventoryItemName: inventoryItem?.name || '', requestedItemName: item, commandCenterAlert: true, managerBriefAlert: true, kitchenCommandCenterAlert: true, source: 'manager_brief_quick_86'
        } });
        undoMeta = { collectionName: 'events', id: result.id, before: result.payload };
        addToast('86 Alert Posted', impactText ? `${item} posted with menu impact.` : item);
      }
      if (kind === 'prep') {
        const item = prompt('Prep task to add for today?');
        if (!item) return;
        const result = await safeTodayWrite({ action: 'add', collectionName: 'prepItems', label: 'Today quick prep', data: { restaurantId: appUser.restaurantId, date: today, text: item, station: 'General', isCompleted: false, qty: 1, createdAt: new Date().toISOString(), createdBy: appUser.name } });
        undoMeta = { collectionName: 'prepItems', id: result.id, before: result.payload };
        addToast('Prep Added', item);
      }
      if (kind === 'maintenance') {
        const issue = prompt('Maintenance issue?');
        if (!issue) return;
        const result = await safeTodayWrite({ action: 'add', collectionName: 'maintenanceLogs', label: 'Today quick maintenance', data: { restaurantId: appUser.restaurantId, equipment: 'General', issue, urgency: 'High', status: 'Reported', reportedAt: new Date().toISOString(), reportedBy: appUser.name } });
        undoMeta = { collectionName: 'maintenanceLogs', id: result.id, before: result.payload };
        addToast('Maintenance Added', issue);
      }
      if (kind === 'message') {
        const msg = prompt('Message to post?');
        if (!msg) return;
        const result = await safeTodayWrite({ action: 'add', collectionName: 'events', label: 'Today quick message', data: { restaurantId: appUser.restaurantId, type: 'note', title: msg, messageCategory: 'Shift Note', author: appUser.name, isImportant: false, date: new Date().toISOString(), replies: [] } });
        undoMeta = { collectionName: 'events', id: result.id, before: result.payload };
        addToast('Message Posted', msg.slice(0, 60));
      }
      if (undoMeta?.id) registerUndo?.({ label: `Undo ${kind}`, action: async () => { await safeTodayWrite({ action: 'delete', collectionName: undoMeta.collectionName, docId: undoMeta.id, label: `Undo ${kind}`, before: undoMeta.before }); addToast('Undone', 'The last quick action was removed.'); } });
    } catch (err) { addToast('Could not save', err.message || 'Permission or connection issue.'); }
  };

  const seedDemoData = async () => {
    if (!appUser?.isAdmin && !appUser?.isSuperAdmin) return addToast('Manager Only', 'Ask a manager to seed demo data.');
    if (!window.confirm('Add a complete demo set to this workspace? This adds sample recipes, prep, inventory, messages, events, and maintenance.')) return;
    const stamp = new Date().toISOString();
    await Promise.all([
      safeTodayWrite({ action: 'add', collectionName: 'events', label: 'Seed demo announcement', data: { restaurantId: appUser.restaurantId, type: 'note', title: 'DEMO: Tonight has live music and heavy dinner volume expected.', messageCategory: 'Announcement', author: '86 Demo', isImportant: true, date: stamp, replies: [], readBy: [] } }),
      safeTodayWrite({ action: 'add', collectionName: 'events', label: 'Seed demo event', data: { restaurantId: appUser.restaurantId, type: 'special_event', title: 'DEMO: Patio Rush / Live Music', date: today, time: '19:00', notes: 'Expect extra bar and fryer volume.', addedBy: '86 Demo' } }),
      safeTodayWrite({ action: 'add', collectionName: 'prepItems', label: 'Seed demo prep', data: { restaurantId: appUser.restaurantId, date: today, text: 'DEMO: Portion burger patties', station: 'Grill', qty: 24, isCompleted: false } }),
      safeTodayWrite({ action: 'add', collectionName: 'prepItems', label: 'Seed demo prep', data: { restaurantId: appUser.restaurantId, date: today, text: 'DEMO: Backup ranch and blue cheese', station: 'Cold', qty: 2, isCompleted: false } }),
      safeTodayWrite({ action: 'add', collectionName: 'inventoryItems', label: 'Seed demo inventory', data: { restaurantId: appUser.restaurantId, name: 'DEMO Chicken Breast', category: 'Protein', parLevel: 3, currentStock: 1, pendingQty: 0, price: 84, packSize: '40 lb case', yieldQty: 1, isStarred: true } }),
      safeTodayWrite({ action: 'add', collectionName: 'inventoryItems', label: 'Seed demo inventory', data: { restaurantId: appUser.restaurantId, name: 'DEMO Fries', category: 'Frozen', parLevel: 5, currentStock: 2, pendingQty: 0, price: 33, packSize: 'Case', yieldQty: 1, isStarred: true } }),
      safeTodayWrite({ action: 'add', collectionName: 'maintenanceLogs', label: 'Seed demo maintenance', data: { restaurantId: appUser.restaurantId, equipment: 'DEMO Fryer #2', issue: 'Filter due before dinner rush', urgency: 'High', status: 'Reported', reportedAt: stamp, reportedBy: '86 Demo' } }),
      safeTodayWrite({ action: 'add', collectionName: 'recipes', label: 'Seed demo recipe', data: { restaurantId: appUser.restaurantId, title: 'DEMO House Ranch', category: 'Sauce/Dressing', prepTime: '10 mins', yieldAmt: '1 gallon', ingredients: 'Mayo\nButtermilk\nRanch seasoning', instructions: 'Whisk. Label. Chill.', authorName: '86 Demo', lastUpdated: stamp } })
    ]);
    addToast('Demo Mode Seeded', 'Sample operating data was added to this workspace.');
  };

  const applyNotificationPreset = async () => {
    const presets = {
      manager: { notifSchedule: true, notifMessages: true, notifTrades: true, notifReminders: true, notifLevel: 'all', muteOnDaysOff: false },
      kitchen: { notifSchedule: true, notifMessages: true, notifTrades: false, notifReminders: true, notifLevel: 'mentions', keywords: '86,prep,critical,walk-in,fryer,line' },
      bar: { notifSchedule: true, notifMessages: true, notifTrades: true, notifReminders: false, notifLevel: 'mentions', keywords: 'bar,bartender,beer,86,critical' },
      service: { notifSchedule: true, notifMessages: true, notifTrades: true, notifReminders: false, notifLevel: 'critical' },
      staff: { notifSchedule: true, notifMessages: true, notifTrades: true, notifReminders: false, notifLevel: 'critical' }
    };
    await updateDoc(doc(db, 'users', appUser.id), { preferences: { ...(appUser.preferences || {}), ...(presets[profile] || presets.staff) } });
    addToast('Notification Preset Applied', 'Your alerts now match your role.');
  };

  const heroTitle = canUseManagerBrief ? (profile === 'manager' || profile === 'system' ? 'Manager Brief' : profile === 'kitchen' ? 'Kitchen Brief' : profile === 'bar' ? 'Bar Brief' : profile === 'service' ? 'Service Brief' : 'Today Brief') : 'Today Home';
  const topPriority = problems[0]?.detail || (myShift ? `You work ${formatShortTime(myShift.startTime)}-${formatShortTime(myShift.endTime)} as ${myShift.role}.` : 'No urgent problems detected.');
  const managerBriefMathText = `${todaysShifts.length} On Schedule ${activePunches.length} Clocked In ${problems.length} Needs Eyes`;

  return <div className="manager-brief-compact desktop-ops-page max-w-7xl mx-auto space-y-3 pb-24 animate-[slideIn_0.2s_ease-out]">
    <div className="brief-hero cockpit-panel rounded-2xl p-4 sm:p-5 cockpit-grid overflow-hidden relative">
      <div className="absolute -right-8 -top-8 text-[9rem] font-black text-white/5 leading-none">86</div>
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">{formatDisplayFullDate(today)}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">{heroTitle}</h1>
          <p className="text-sm text-slate-300 font-bold mt-2 max-w-2xl leading-snug">{topPriority}</p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2" data-testid="manager-brief-math-summary">{managerBriefMathText}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 min-w-[230px]">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-2 text-center"><div className="text-lg font-black text-white">{todaysShifts.length}</div><div className="text-[8px] uppercase tracking-widest font-black text-slate-500">On Schedule</div></div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-2 text-center"><div className="text-lg font-black text-emerald-400">{activePunches.length}</div><div className="text-[8px] uppercase tracking-widest font-black text-slate-500">Clocked In</div></div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-2 text-center"><div className="text-lg font-black text-red-300">{problems.length}</div><div className="text-[8px] uppercase tracking-widest font-black text-slate-500">Needs Eyes</div></div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <button onClick={open86Center} className="brief-quick-action bg-red-900/20 border border-red-500/40 text-red-300 rounded-xl p-3 font-black text-xs uppercase tracking-widest">Open 86 Alerts</button>
      <button onClick={openPrepPlan} className="brief-quick-action bg-[#1A2126] border border-[#2A353D] text-[#D4A381] rounded-xl p-3 font-black text-xs uppercase tracking-widest">Open Prep</button>
      <button onClick={openMessageBoard} className="brief-quick-action bg-[#1A2126] border border-[#2A353D] text-slate-200 rounded-xl p-3 font-black text-xs uppercase tracking-widest">Open Messages</button>
      {canUseCleaningRoutines && <button onClick={openMaintenanceCenter} className="brief-quick-action bg-amber-900/20 border border-amber-500/40 text-amber-300 rounded-xl p-3 font-black text-xs uppercase tracking-widest">Open Fix It</button>}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 space-y-3">
        <div className={`${T.card} brief-card p-4`}>
          <button className="w-full flex justify-between items-center" onClick={() => setExpanded(e => ({...e, problems: !e.problems}))}><h2 className="font-black text-white text-lg">Need Attention</h2><ChevronRight className={`transition-transform ${expanded.problems ? 'rotate-90' : ''}`} size={18}/></button>
          {expanded.problems && <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {problems.length ? problems.map((p, idx) => <MiniProblemCard key={idx} {...p} action="Open" onClick={() => p.onClick ? p.onClick() : setActiveTab(p.tab)} />) : <SmartEmptyState icon={<Check size={24}/>} title="Nothing urgent right now" desc="Everything looks clear right now." />}
          </div>}
        </div>

        {canUseAiOrdering && (aiBriefTop.length || aiBrief.eventNeeds?.length) && <div className={`${T.card} brief-card p-4 border-[#D4A381]/30`}>
          <div className="flex justify-between items-center gap-2"><h2 className="font-black text-white text-lg flex items-center gap-2"><Sparkles size={18} className="text-[#D4A381]"/> AI Ordering Attention</h2><button onClick={() => { sessionStorage.setItem('inventoryFocus', 'aiOrder'); setActiveTab('inventory'); }} className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Open AI Ordering</button></div>
          <div className="grid sm:grid-cols-3 gap-2 mt-3">
            {aiBriefTop.length ? aiBriefTop.map(row => <MiniProblemCard key={row.itemId || row.itemName} title={row.itemName} detail={`Suggest ${row.suggestedQty}${row.reasons?.[0] ? ` • ${row.reasons[0]}` : ''}`} action="Review" onClick={() => { sessionStorage.setItem('inventoryFocus', 'aiOrder'); setActiveTab('inventory'); }} />) : <MiniProblemCard title="Order Draft" detail="No urgent order items. Review event supply checks." action="Open" onClick={() => { sessionStorage.setItem('inventoryFocus', 'aiOrder'); setActiveTab('inventory'); }} />}
          </div>
        </div>}

        {canUsePythonIntelligence && <div className={`${T.card} brief-card p-4 border-purple-500/30`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-white text-lg flex items-center gap-2"><Sparkles size={18} className="text-purple-300"/> Python Ops Scan</h2>
              <p className="text-xs text-slate-400 font-bold mt-1 leading-snug">Runs the deeper ops check from Manager Brief, then lets you tap each finding to jump to the place that fixes it.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={runBriefPythonOps} disabled={briefOpsLoading} className="rounded-xl bg-purple-900/20 border border-purple-500/40 text-purple-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-purple-900/30 disabled:opacity-60">{briefOpsLoading ? 'Scanning…' : 'Run Ops Scan'}</button>
              {briefOpsIntel && <button onClick={copyBriefOpsReport} className="rounded-xl bg-[#12161A] border border-[#2A353D] text-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest">{briefOpsCopied ? 'Copied' : 'Copy Report'}</button>}
            </div>
          </div>
          {briefOpsError && <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs font-bold text-amber-100">Python Ops scan did not finish: {briefOpsError}</div>}
          {briefOpsIntel && <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {[['Prices', briefOpsSummary.priceWarningCount || 0], ['Pars', briefOpsSummary.parRecommendationCount || 0], ['Waste', briefOpsSummary.wasteInsightCount || 0], ['Menu', briefOpsSummary.menuCostCount || 0], ['Labor', briefOpsSummary.laborWarningCount || 0], ['Health', briefOpsSummary.dataHealthCount || 0], ['Backups', briefOpsSummary.backupCheckCount || 0]].map(([label, value]) => <div key={label} className="rounded-xl border border-purple-500/20 bg-[#12161A] p-2 text-center"><div className="font-black text-white">{value}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">{label}</div></div>)}
            </div>
            <div className="space-y-2">
              {briefOpsFindings.length ? briefOpsFindings.map((row, idx) => <button key={`${row.area}-${row.title}-${idx}`} onClick={() => openOpsFinding(row)} className="w-full text-left rounded-xl border border-purple-500/20 bg-[#12161A] hover:border-[#D4A381]/50 p-3 transition-colors"><div className="flex items-center justify-between gap-2"><div className="text-[9px] uppercase tracking-widest font-black text-purple-200">{row.area}</div><div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381]">Open Fix</div></div><div className="font-black text-white text-sm mt-1">{row.title}</div><div className="text-xs text-slate-400 font-bold mt-1 leading-snug">{row.detail}</div></button>) : <SmartEmptyState icon={<Check size={22}/>} title="No major ops findings" desc="The scan did not find a priority problem in this window." />}
            </div>
          </div>}
        </div>}

        <div className={`${T.card} brief-card p-4`}>
          <h2 className="font-black text-white text-lg mb-3">Role Home</h2>
          {profile === 'kitchen' && <div className="grid sm:grid-cols-3 gap-2"><MiniProblemCard title="Prep" detail={`${openPrep.length} open prep items`} action="Open Prep" onClick={() => setActiveTab('prep')} /><MiniProblemCard title="86 Watch" detail={`${lowStock.length} low stock item(s)`} action="Inventory" onClick={openInventoryFocus} /><MiniProblemCard title="Recipes" detail={`${recipes.length} recipes available`} action="Open" onClick={() => setActiveTab('recipes')} /></div>}
          {profile === 'manager' || profile === 'system' ? <div className="grid sm:grid-cols-3 gap-2">{canUseLabor && <MiniProblemCard title="Labor" detail={`${activePunches.length}/${todaysShifts.length} clocked in`} action="Labor" onClick={() => setActiveTab('labor')} />}{canUseScheduleBuilder && <MiniProblemCard title="Requests" detail={`${pendingRequests.length} pending`} action="Review" onClick={() => setActiveTab('schedule')} />}{canUseManagerBrief && <MiniProblemCard title="Kitchen Command" detail="Open Kitchen Command Center" action="Open" onClick={() => setActiveTab('ops')} />}{!canUseLabor && !canUseScheduleBuilder && !canUseManagerBrief && <MiniProblemCard title="Today Home" detail="Messages, prep, recipes, reminders, and Help Center are available on this plan." action="Open Help" onClick={() => setActiveTab('help')} />}</div> : null}
          {['service','bar','staff'].includes(profile) && <div className="grid sm:grid-cols-3 gap-2"><MiniProblemCard title="My Shift" detail={myShift ? `${formatShortTime(myShift.startTime)}-${formatShortTime(myShift.endTime)}` : 'No shift today'} action="Open" onClick={() => setActiveTab('published')} /><MiniProblemCard title="Messages" detail={`${importantNotes.length} important post(s)`} action="Read" onClick={() => setActiveTab('messages')} /><MiniProblemCard title="Trade Board" detail={`${openSwaps.length} available`} action="Open" onClick={() => setActiveTab('published')} /></div>}
        </div>

        <div className={`${T.card} brief-card p-4`}>
          <div className="flex justify-between items-center gap-2"><h2 className="font-black text-white text-lg">Important Messages</h2><button onClick={() => setActiveTab('messages')} className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Open Board</button></div>
          <div className="mt-3 space-y-2">{importantNotes.length ? importantNotes.map(n => <div key={n.id} className="bg-red-950/10 border border-red-500/30 rounded-xl p-3"><div className="text-[9px] font-black uppercase tracking-widest text-red-300">{n.messageCategory || 'Important'} • {n.author}</div><div className="text-sm text-white font-bold mt-1 line-clamp-2">{n.title}</div>{(n.notes || n.menuImpact) && <div className="text-[11px] text-slate-300 font-bold mt-1 whitespace-pre-wrap line-clamp-3">{n.notes || n.menuImpact}</div>}</div>) : <SmartEmptyState icon={<MessageSquare size={22}/>} title="No important posts" desc="When a manager marks something important, it lands here first." />}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className={`${T.card} brief-card p-4`}>
          <button className="w-full flex justify-between items-center" onClick={() => setExpanded(e => ({...e, setup: !e.setup}))}><h2 className="font-black text-white text-lg">Setup Checklist</h2><span className="text-[10px] font-black text-[#D4A381]">{setupDone}/{setupTotal}</span></button>
          {expanded.setup && <div className="mt-3 space-y-2">{setupItems.map(item => <button key={item.label} onClick={() => setActiveTab(item.tab)} className="w-full flex items-center justify-between gap-2 bg-[#0B0E11] border border-[#2A353D] rounded-xl px-3 py-2 text-left"><span className="text-xs font-bold text-slate-200">{item.label}</span><span className={`text-[9px] font-black uppercase tracking-widest ${item.done ? 'text-emerald-400' : 'text-amber-400'}`}>{item.done ? 'Done' : 'Open'}</span></button>)}<button onClick={seedDemoData} className="w-full mt-2 bg-[#D4A381] text-slate-900 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest">Seed Demo Mode</button></div>}
        </div>
        <div className={`${T.card} brief-card p-4`}>
          <h2 className="font-black text-white text-lg mb-3">Recently Used</h2>
          <div className="flex flex-wrap gap-2">{recentTabs.length ? recentTabs.map(t => <button key={t} onClick={() => setActiveTab(t)} className="px-3 py-2 bg-[#0B0E11] border border-[#2A353D] rounded-lg text-[10px] text-slate-300 font-black uppercase tracking-widest">{t}</button>) : <p className="text-xs text-slate-500 font-bold">Tabs you use will appear here.</p>}</div>
        </div>
        <div className={`${T.card} brief-card p-4`}>
          <button className="w-full flex justify-between items-center" onClick={() => setExpanded(e => ({...e, prefs: !e.prefs}))}><h2 className="font-black text-white text-lg">My Preferences</h2><Settings size={16}/></button>
          {expanded.prefs && <div className="mt-3 space-y-2"><button onClick={applyNotificationPreset} className="w-full bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Apply {profile} Notification Preset</button><button onClick={() => setActiveTab('settings')} className="w-full bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-slate-300">Open Full Settings</button></div>}
        </div>
      </div>
    </div>
  </div>;
};

export { TabPrep, TabRecipes, TabMaintenance, TabOpsCenter, TabToday };

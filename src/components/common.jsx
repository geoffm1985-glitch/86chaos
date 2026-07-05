import React, { useState, useEffect } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon } from '../core/appCore';

const CheersLogo = () => (
  <div className="flex items-center gap-2 sm:gap-3 cursor-pointer transition-opacity hover:opacity-80">
    <img src="/wisco.png" alt="86 App Icon" className="h-8 w-8 sm:h-9 w-auto" />
    <img src="/6139.png" alt="86 Chaos OS" className="h-5 sm:h-6 w-auto" />
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-[#12161A]/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md transition-opacity">
      <div className={`${T.card} max-w-md w-full max-h-[90vh] overflow-y-auto`}>
        <div className={`flex justify-between items-center p-4 border-b ${T.border}`}>
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#12161A] rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, hasUnreadMessages, hasMyShiftAlert, hasScheduleBuilderAlert, clientFeatures = {}, addToast }) => {
  const [menuSearch, setMenuSearch] = useState('');

  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};
  const isGod = appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() || appUser?.isSuperAdmin;

  const isEnabled = (feat) => clientFeatures[feat] !== false;

  tabs.push({ id: 'today', label: 'Today Command Center', icon: <Star size={18}/>, dot: hasUnreadMessages || hasMyShiftAlert || hasScheduleBuilderAlert });
  if (isEnabled('schedule')) tabs.push({ id: 'published', label: 'Time Clock & Shifts', icon: <Clock size={18}/>, dot: hasMyShiftAlert }); 
  if (isEnabled('labor') && (isGod || appUser?.isAdmin || perms.labor || perms.schedule || perms.sales)) tabs.push({ id: 'labor', label: 'Labor & Timesheets', icon: <Scale size={18}/> });
  if (isEnabled('ops') && (isGod || appUser?.isAdmin || perms.ops)) tabs.push({ id: 'ops', label: 'Ops Command Center', icon: <ChefHat size={18}/> }); 
  if (isEnabled('messages')) tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/>, dot: hasUnreadMessages });
  if (isEnabled('events') && (appUser?.isAdmin || perms.events || perms.schedule || perms.team)) tabs.push({ id: 'events', label: 'Event Calendar', icon: <Star size={18}/> });
  if (isEnabled('prep') && (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep)) tabs.push({ id: 'prep', label: 'Prep & Tasks', icon: <ClipboardList size={18}/> });
  if (isEnabled('recipes') && (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep || perms.team)) tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> });
  if (isEnabled('inventory') && (appUser?.isAdmin || perms.inventory || perms.team)) tabs.push({ id: 'inventory', label: 'Inventory & Orders', icon: <Package size={18}/> });  
  if (isEnabled('schedule') && (appUser?.isAdmin || perms.schedule)) tabs.push({ id: 'schedule', label: 'Schedule Builder', icon: <Calendar size={18}/>, dot: hasScheduleBuilderAlert });
  if (isEnabled('team') && (appUser?.isAdmin || perms.team)) tabs.push({ id: 'team', label: 'Staff Roster', icon: <Users size={18}/> });
  if (isEnabled('maintenance') && (appUser?.isAdmin || perms.team)) tabs.push({ id: 'maintenance', label: 'Maintenance Log', icon: <Wrench size={18}/> });
  if (isEnabled('sales') && (appUser?.isAdmin || perms.sales)) tabs.push({ id: 'sales', label: 'Daily Ledger', icon: <TrendingUp size={18}/> });
  
  const isTrueGod = (appUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() || appUser?.isSuperAdmin === true;
  if (isTrueGod) tabs.push({ id: 'godmode', label: 'System Administrator', icon: <Globe size={18}/> });
  if (appUser?.isAdmin || isTrueGod) tabs.push({ id: 'audit', label: 'System Audit', icon: <Shield size={18}/> });  
  tabs.push({ id: 'help', label: 'Help Center', icon: <BookOpen size={18}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  const menuActions = [
    { id: 'help-add-staff', label: 'How to add staff', tab: 'help', keywords: 'employee team roster invite user password' },
    { id: 'help-fix-punch', label: 'Fix a missed punch', tab: 'help', keywords: 'time clock timesheet labor punch clock out forgot' },
    { id: 'help-schedule-template', label: 'Create schedule templates', tab: 'help', keywords: 'copy week schedule template coverage smart fill' },
    { id: 'help-permissions', label: 'Update permissions', tab: 'help', keywords: 'tab access manage user permissions ops labor inventory' },
    { id: 'go-labor-punch', label: 'Add/Edit Time Punch', tab: 'labor', keywords: 'timesheet labor clock in out edit punch payroll' },
    { id: 'go-schedule-template', label: 'Schedule Templates', tab: 'schedule', keywords: 'builder copy previous week template smart fill coverage' },
    { id: 'go-support', label: 'Contact Support / Bug Report', tab: 'help', keywords: 'support faq problem broken help manual' }
  ];
  const q = menuSearch.trim().toLowerCase();
  const visibleTabs = q ? tabs.filter(t => `${t.label} ${t.id}`.toLowerCase().includes(q)) : tabs;
  const visibleActions = q ? menuActions.filter(a => `${a.label} ${a.keywords}`.toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-[#12161A]/60 backdrop-blur-sm" onClick={onClose}></div>
          <div className={`w-72 bg-[#1A2126] border-l ${T.border} h-full shadow-2xl flex flex-col relative animate-[slideIn_0.3s_ease-out]`}>
            <div className={`p-4 border-b ${T.border} bg-[#12161A] flex justify-between items-start`}>
               <div className="flex items-center gap-3">
                 <img src={getAvatar(appUser.name, appUser.photoURL)} alt="Profile" className={`w-10 h-10 rounded-full border ${T.border} object-cover`}/>
                 <div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Signed in as</div>
                   <div className="text-white font-black text-lg tracking-tight leading-none">{appUser.name}</div>
                   <div className={`flex items-center gap-1 ${T.copper} text-[10px] font-bold uppercase tracking-wider mt-1 bg-[#1A2126] border ${T.border} w-max px-2 py-0.5 rounded-md`}>{appUser.isAdmin && <Shield size={10} />} {appUser.role}</div>
                 </div>
               </div>
               <button onClick={onClose} className="p-1.5 bg-[#1A2126] border border-[#2A353D] rounded-full text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
            </div>
            <div className="p-3 border-b border-[#2A353D]">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Search menu, help, tools..." className="w-full bg-[#12161A] border border-[#2A353D] rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white outline-none focus:border-[#D4A381]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
               {visibleTabs.length === 0 && visibleActions.length === 0 && <div className="p-4 text-center text-xs font-bold text-slate-500 border border-dashed border-[#2A353D] rounded-xl">No menu results. Try “schedule”, “punch”, “recipe”, or “help”.</div>}
               {visibleTabs.map(tab => (
                 <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? `${T.grad} text-slate-900 shadow-md` : 'text-slate-400 hover:bg-[#12161A] hover:text-white'}`}>
                   <div className="flex items-center gap-3">
                     <div className="relative">
                       <span className={activeTab === tab.id ? 'text-slate-900' : T.copper}>{tab.icon}</span>
                       {tab.dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1A2126] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
                     </div>
                     {tab.label}
                   </div>
                 </button>
               ))}
               {visibleActions.length > 0 && <div className="pt-3 mt-2 border-t border-[#2A353D]"><div className="text-[9px] uppercase tracking-widest font-black text-slate-500 px-2 mb-1">Suggested actions</div>{visibleActions.map(a => (
                 <button key={a.id} onClick={() => { setActiveTab(a.tab); setMenuSearch(''); onClose(); }} className="w-full text-left px-3 py-2 rounded-xl font-bold text-xs text-slate-300 hover:bg-[#12161A] hover:text-[#D4A381] transition-colors flex items-center gap-2"><Search size={13}/> {a.label}</button>
               ))}</div>}
            </div>
            <div className={`p-3 border-t ${T.border} bg-[#12161A] space-y-2`}>
             <button onClick={() => { setAppUser(null); localStorage.removeItem('86chaosUser'); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 text-sm font-bold rounded-xl hover:bg-red-900/20 transition-colors"><LogOut size={16} /> Log Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const DayDotPrintScreen = ({ labelsToPrint, prepDate, appUser, onClose }) => {
  useEffect(() => {
    const handleBackButton = () => onClose(); window.history.pushState({ tab: 'prep', printScreen: true }, ''); window.addEventListener('popstate', handleBackButton);
    const timer = setTimeout(() => window.print(), 800);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', handleBackButton); };
  }, [onClose]);
  return (
    <div id="master-print-wrapper" className="fixed inset-0 z-[999999] bg-white overflow-y-auto text-black print:static print:block print:overflow-visible print:h-auto print:w-auto">
      <style>{`@media print { 
        @page { size: 3.5in 1.1in; margin: 0; } 
        body, html { margin: 0 !important; background: white !important; height: auto !important; } 
        #master-print-wrapper { position: static !important; overflow: visible !important; height: auto !important; display: block !important; }
        .no-print { display: none !important; } 
        .dk-label { width: 3.5in !important; height: 1.1in !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.05in 0.15in !important; box-sizing: border-box !important; page-break-after: always !important; margin: 0 !important; font-family: sans-serif !important; overflow: hidden !important; } 
        .dk-title { font-size: 16px !important; font-weight: 900 !important; text-transform: uppercase !important; text-align: center !important; margin-bottom: 2px !important; } 
        .dk-row { display: flex !important; justify-content: space-between !important; font-size: 11px !important; font-weight: bold !important; margin-bottom: 2px !important; } 
        .dk-exp { display: flex !important; justify-content: center !important; font-size: 14px !important; font-weight: 900 !important; border-top: 2px solid black !important; padding-top: 2px !important; } 
      }`}</style>
      <div className="no-print p-6 flex flex-col items-center justify-center min-h-screen bg-slate-100">
         <Loader2 className="animate-spin text-[#8F6040] mb-6" size={64} />
         <h2 className="text-3xl font-black text-slate-900 mb-2">Generating Labels</h2>
         <button onClick={() => window.history.back()} className="bg-slate-900 text-white px-10 py-5 rounded-xl font-black text-lg shadow-xl hover:bg-slate-800 w-full max-w-xs mt-8">Return to App</button>
      </div>
      <div id="print-data">
        {labelsToPrint.map((item, idx) => {
          const prepDateParts = formatDisplayDate(prepDate).split(','); const prepStr = prepDateParts.length > 1 ? prepDateParts[1].trim() : formatDisplayDate(prepDate);
          return (<div key={`print-${idx}`} className="dk-label"><div className="dk-title">{item.text}</div><div className="dk-row"><span>PREP: {prepStr}</span><span>EMP: {appUser?.name ? appUser.name.split(' ')[0].toUpperCase() : '___'}</span></div><div className="dk-exp">EXP: {getExpDate(prepDate)}</div></div>);
        })}
      </div>
    </div>
  );
};

const MapClickListener = ({ setLat, setLon }) => {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat);
      setLon(e.latlng.lng);
    },
  });
  return null;
};

const SmartEmptyState = ({ icon = <Star size={24}/>, title, desc, actionLabel, onAction }) => (
  <div className="rounded-2xl border border-dashed border-[#2A353D] bg-[#12161A]/60 p-5 text-center">
    <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-[#0B0E11] border border-[#2A353D] text-[#D4A381] flex items-center justify-center">{icon}</div>
    <h3 className="text-sm font-black text-white">{title}</h3>
    {desc && <p className="text-xs text-slate-500 font-bold mt-1 leading-snug">{desc}</p>}
    {actionLabel && onAction && <button onClick={onAction} className="mt-3 px-3 py-2 rounded-lg bg-[#D4A381] text-slate-900 text-[10px] font-black uppercase tracking-widest">{actionLabel}</button>}
  </div>
);

const MiniProblemCard = ({ tone='amber', title, detail, action, onClick }) => {
  const tones = {
    red: 'border-red-500/40 bg-red-950/10 text-red-300',
    amber: 'border-amber-500/40 bg-amber-950/10 text-amber-300',
    blue: 'border-blue-500/40 bg-blue-950/10 text-blue-300',
    emerald: 'border-emerald-500/40 bg-emerald-950/10 text-emerald-300'
  };
  return <div className={`rounded-xl border p-3 ${tones[tone] || tones.amber}`}>
    <div className="text-[10px] font-black uppercase tracking-widest">{title}</div>
    <div className="text-xs text-slate-300 font-bold mt-1 leading-snug">{detail}</div>
    {action && <button onClick={onClick} className="mt-2 text-[9px] font-black uppercase tracking-widest underline underline-offset-4">{action}</button>}
  </div>;
};

const getHomeProfile = (user) => {
  const role = (user?.role || '').toLowerCase();
  if (user?.isSuperAdmin || user?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) return 'system';
  if (user?.isAdmin || user?.permissions?.ops || user?.permissions?.sales || user?.permissions?.team || user?.permissions?.schedule || user?.permissions?.labor) return 'manager';
  if (role.includes('cook') || role.includes('chef') || role.includes('kitchen') || role.includes('prep') || user?.permissions?.prep) return 'kitchen';
  if (role.includes('bartender') || role.includes('bar')) return 'bar';
  if (role.includes('server') || role.includes('host')) return 'service';
  return 'staff';
};

const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
  if (!inTime || !outTime) return 0;
  const start = new Date(inTime);
  const end = new Date(outTime);
  const diff = (end - start) / 36e5;
  return Math.max(0, diff - ((parseFloat(breakMins) || 0) / 60));
};

const getWeekStart = (dateStr) => {
  const d = new Date((dateStr || getToday()) + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return formatDate(d);
};

const getWeekDates = (dateStr) => {
  const start = new Date(getWeekStart(dateStr) + 'T12:00:00');
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatDate(d);
  });
};

const roleMatches = (userRole = '', targetRole = '') => {
  if (!targetRole) return true;
  const u = String(userRole).toLowerCase();
  const t = String(targetRole).toLowerCase();
  if (u.includes(t) || t.includes(u)) return true;
  const bucket = Object.entries(ROLE_KEYWORDS).find(([label, words]) => label.toLowerCase() === t || words.some(w => t.includes(w)));
  return bucket ? bucket[1].some(w => u.includes(w)) : false;
};

const toLocalTimeInput = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toTimeString().slice(0,5); } catch(e) { return ''; }
};

const makeLocalIso = (date, time) => {
  if (!date || !time) return '';
  return new Date(`${date}T${time}:00`).toISOString();
};

const PunchTable = ({ rows, openEditPunch, forceOut, approvePunch, deletePunch }) => (
  <div className={`${T.card} overflow-hidden`}>
    <div className="bg-[#12161A] border-b border-[#2A353D] p-3 flex justify-between items-center"><h3 className="font-black text-[#D4A381] text-xs uppercase tracking-widest">Punch Ledger</h3><span className="text-[10px] font-bold text-slate-500">{rows.length} records</span></div>
    <div className="divide-y divide-[#2A353D]">
      {rows.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-500">No punches match this filter.</div>}
      {rows.map(({ punch:p, emp, hours, pay, tips, issue }) => <div key={p.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#12161A]/50">
        <div><div className="font-black text-white text-sm">{emp.name || p.employeeName || 'Unknown'} {issue && <span className="ml-2 text-[8px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded uppercase tracking-widest">{issue}</span>}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.date ? formatDisplayDate(p.date) : 'No date'} • {emp.role || 'No role'}</div></div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 text-xs font-mono"><span className="text-emerald-400">IN {formatClockTime(p.clockInTime) || '—'}</span><span className="text-red-400">OUT {formatClockTime(p.clockOutTime) || '—'}</span><span className="text-white">{Math.max(0,hours).toFixed(2)}h</span><span className="text-[#D4A381]">${pay.toFixed(2)}</span><span className="text-slate-400">Tips ${tips.toFixed(2)}</span></div>
        <div className="flex gap-2"><button onClick={() => openEditPunch(p)} className="p-2 bg-[#12161A] border border-[#2A353D] rounded-lg text-slate-400 hover:text-[#D4A381]"><Edit size={14}/></button>{['clocked_in','on_break'].includes(p.status) && <button onClick={() => forceOut(p)} className="px-2 bg-red-900/20 border border-red-900/50 rounded-lg text-[10px] font-black text-red-300">Out</button>}{p.isUnscheduled && !p.isApproved && <button onClick={() => approvePunch(p)} className="px-2 bg-amber-900/20 border border-amber-900/50 rounded-lg text-[10px] font-black text-amber-300">Approve</button>}<button onClick={() => deletePunch(p)} className="p-2 bg-[#12161A] border border-[#2A353D] rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={14}/></button></div>
      </div>)}
    </div>
  </div>
);

const StatusTile = ({ label, value }) => <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase tracking-widest font-black text-slate-500">{label}</div><div className="text-xl font-black text-white">{value}</div></div>;

const FriendlyEmpty = ({ title, text }) => <div className="border border-dashed border-[#2A353D] rounded-xl p-5 text-center"><div className="font-black text-white text-sm">{title}</div><p className="text-xs text-slate-400 font-bold mt-1">{text}</p></div>;

const GlobalSearchModal = ({ isOpen, onClose, queryText, setQueryText, users, events, shifts, recipes, inventoryItems, maintenanceLogs, setActiveTab }) => {
  if (!isOpen) return null;
  const q = queryText.trim().toLowerCase();
  const results = q ? [
    ...users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'User', title: x.name, detail: x.email || x.role, tab: 'team' })),
    ...recipes.filter(r => `${r.title} ${r.ingredients}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Recipe', title: x.title, detail: x.category, tab: 'recipes' })),
    ...inventoryItems.filter(i => `${i.name} ${i.category}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Inventory', title: x.name, detail: `Stock ${x.currentStock || 0} / Par ${x.parLevel || 0}`, tab: 'inventory' })),
    ...events.filter(e => `${e.title} ${e.author} ${e.notes}`.toLowerCase().includes(q)).slice(0, 6).map(x => ({ kind: x.type === 'special_event' ? 'Event' : 'Message', title: x.title, detail: x.date || x.author, tab: x.type === 'special_event' ? 'events' : 'messages' })),
    ...maintenanceLogs.filter(m => `${m.equipment} ${m.issue}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Maintenance', title: x.equipment, detail: x.issue, tab: 'maintenance' })),
    ...shifts.filter(s => `${s.role} ${s.date}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Shift', title: `${x.role} ${x.date}`, detail: `${formatShortTime(x.startTime)}-${formatShortTime(x.endTime)}`, tab: 'schedule' }))
  ].slice(0, 18) : [];
  return <div className="fixed inset-0 z-[100000] bg-[#0B0E11]/90 backdrop-blur-md p-4 flex items-start justify-center pt-10">
    <div className="w-full max-w-2xl cockpit-panel rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-[#2A353D] flex items-center gap-2"><Search size={18} className="text-[#D4A381]"/><input autoFocus value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Search people, recipes, messages, inventory, events..." className="flex-1 bg-transparent outline-none text-white font-bold"/><button onClick={onClose} className="p-2 rounded-lg hover:bg-[#12161A]"><X size={18}/></button></div>
      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-2 space-y-1">{q && results.length === 0 && <SmartEmptyState title="Nothing found" desc="Try a recipe name, employee, inventory item, or event." />}{results.map((r, idx) => <button key={idx} onClick={() => { setActiveTab(r.tab); onClose(); }} className="w-full text-left p-3 rounded-xl border border-[#2A353D] bg-[#12161A] hover:border-[#D4A381]/40"><div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381]">{r.kind}</div><div className="font-black text-white text-sm mt-1">{r.title}</div><div className="text-xs text-slate-500 font-bold mt-0.5 truncate">{r.detail}</div></button>)}</div>
    </div>
  </div>;
};

const QuickActionDock = ({ appUser, setActiveTab, openSearch, openTV, addToast }) => {
  const [open, setOpen] = useState(false);
  const profile = getHomeProfile(appUser);
  const actions = [
    { label: 'Today', tab: 'today' },
    { label: 'Search', fn: openSearch },
    { label: 'Kitchen TV', fn: openTV },
    profile === 'kitchen' ? { label: 'Recipes', tab: 'recipes' } : null,
    profile === 'kitchen' ? { label: 'Prep', tab: 'prep' } : null,
    ['manager','system'].includes(profile) ? { label: 'Ops', tab: 'ops' } : null,
    ['manager','system'].includes(profile) ? { label: 'Schedule', tab: 'schedule' } : null,
    { label: 'Message Board', tab: 'messages' },
    { label: 'My Shift', tab: 'published' }
  ].filter(Boolean);
  return <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-2">
    {open && <div className="cockpit-panel rounded-2xl p-2 w-52 space-y-1 shadow-2xl">{actions.map(a => <button key={a.label} onClick={() => { setOpen(false); a.fn ? a.fn() : setActiveTab(a.tab); }} className="w-full text-left px-3 py-2 rounded-xl bg-[#0B0E11] hover:bg-[#12161A] border border-[#2A353D] text-xs font-black uppercase tracking-widest text-slate-300 hover:text-[#D4A381]">{a.label}</button>)}</div>}
    <button onClick={() => setOpen(!open)} className="no-compact w-14 h-14 rounded-full bg-[#0B0E11] border border-[#D4A381]/50 text-[#D4A381] shadow-2xl flex items-center justify-center"><Menu size={24}/></button>
  </div>;
};

const KitchenTVMode = ({ isOpen, onClose, shifts, events, prepItems, maintenanceLogs, inventoryItems }) => {
  if (!isOpen) return null;
  const today = getToday();
  const todaysShifts = shifts.filter(s => s.date === today && s.isPublished).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  const prep = prepItems.filter(p => (p.date === today || p.date === 'MASTER') && !p.isCompleted).slice(0, 10);
  const alerts = events.filter(e => e.type === 'note' && e.isImportant).slice(0, 5);
  const todayEvents = events.filter(e => e.type === 'special_event' && e.date === today);
  const maint = maintenanceLogs.filter(m => !['Completed','Closed','Resolved'].includes(m.status)).slice(0, 5);
  const low = inventoryItems.filter(i => Number(i.parLevel||0) > 0 && Number(i.currentStock||0) <= Number(i.parLevel||0)).slice(0, 6);
  return <div className="fixed inset-0 z-[100000] bg-[#0B0E11] text-white p-5 sm:p-8 overflow-y-auto">
    <div className="flex justify-between items-start mb-6"><div><div className="text-[#D4A381] text-sm font-black uppercase tracking-widest">86 Chaos Kitchen TV</div><h1 className="text-4xl sm:text-6xl font-black">{formatDisplayFullDate(today)}</h1></div><button onClick={onClose} className="bg-white text-slate-900 rounded-xl px-4 py-2 font-black uppercase text-xs">Exit</button></div>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="cockpit-panel rounded-2xl p-5"><h2 className="text-2xl font-black mb-3">Prep Now</h2>{prep.length ? prep.map(p => <div key={p.id} className="text-xl font-bold border-b border-[#2A353D] py-2">{p.text}</div>) : <p className="text-slate-500 text-xl">Prep is clear.</p>}</div>
      <div className="cockpit-panel rounded-2xl p-5"><h2 className="text-2xl font-black mb-3">86 / Alerts</h2>{alerts.length ? alerts.map(a => <div key={a.id} className="text-xl font-bold border-b border-red-500/30 py-2 text-red-300">{a.title}</div>) : <p className="text-slate-500 text-xl">No active alerts.</p>}{low.map(i => <div key={i.id} className="text-xl font-bold border-b border-red-500/30 py-2 text-red-300">Low: {i.name}</div>)}</div>
      <div className="cockpit-panel rounded-2xl p-5"><h2 className="text-2xl font-black mb-3">Today</h2>{todayEvents.map(e => <div key={e.id} className="text-xl font-bold border-b border-[#2A353D] py-2">{e.time || ''} {e.title}</div>)}{todaysShifts.slice(0,8).map(s => <div key={s.id} className="text-xl font-bold border-b border-[#2A353D] py-2">{formatShortTime(s.startTime)} {s.role}</div>)}{maint.map(m => <div key={m.id} className="text-xl font-bold border-b border-amber-500/30 py-2 text-amber-300">Fix: {m.equipment}</div>)}</div>
    </div>
  </div>;
};

const ChangeLogModal = ({ isOpen, onClose }) => isOpen ? <Modal isOpen={isOpen} onClose={onClose} title={`What's New in ${CURRENT_VERSION}`}>
  <div className="space-y-3 text-sm text-slate-300 font-bold leading-snug">
    <p>New manager workflow tools: Labor & Timesheets is now its own tab, the side menu has a search box, Schedule Builder has editable templates, coverage targets, Smart Fill, Drag Board, Copy Previous Week, and Publish Preview, and Help Center now includes searchable instructions for every new tool.</p>
    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-widest font-black">
      {['Labor tab','Punch Fixer','Menu search','Help Center','Schedule templates','Coverage targets','Smart Fill','Drag Board','Copy week','Publish preview','Payroll CSV','Support articles'].map(x => <div key={x} className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 text-[#D4A381]">{x}</div>)}
    </div>
    <button onClick={onClose} className={`w-full ${T.btn}`}>Got it</button>
  </div>
</Modal> : null;

const UndoBar = ({ undoItem, clearUndo }) => {
  if (!undoItem) return null;
  return <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[99999] cockpit-panel rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xl">
    <div><div className="text-xs font-black text-white uppercase tracking-widest">Action saved</div><div className="text-[10px] text-slate-500 font-bold">You can reverse this for a short time.</div></div>
    <button onClick={async () => { await undoItem.action(); clearUndo(); }} className="px-3 py-2 bg-[#D4A381] text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest">{undoItem.label || 'Undo'}</button>
  </div>;
};

export { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar };

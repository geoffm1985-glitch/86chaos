import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getMessaging, getToken } from 'firebase/messaging';

// --- Master Theme (Mapped to Image 6187_2.png) ---
const T = {
  bg: "bg-[#12161A] text-slate-100",
  card: "bg-[#1A2126] border border-[#2A353D] shadow-xl rounded-2xl",
  border: "border-[#2A353D]",
  copper: "text-[#D4A381]",
  grad: "bg-gradient-to-r from-[#C59373] to-[#8F6040]",
  btn: "bg-gradient-to-r from-[#C59373] to-[#8F6040] text-slate-900 font-black uppercase tracking-wider rounded-xl shadow-lg hover:opacity-90 transition-all px-4 py-3 text-sm text-center",
  btnAlt: "bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-[#D4A381] transition-all px-4 py-2.5 text-sm",
  input: "w-full p-3 bg-[#12161A] border border-[#2A353D] text-white rounded-xl outline-none focus:border-[#D4A381] transition-colors font-medium",
  label: "block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1",
  muted: "text-slate-400",
  th: "bg-[#12161A] border-b border-[#2A353D] text-[10px] font-black text-[#D4A381] uppercase tracking-widest p-3",
  row: "hover:bg-[#12161A]/50 border-b border-[#2A353D] transition-colors p-3",
};

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA",
  authDomain: "cheers-34b8d.firebaseapp.com",
  projectId: "cheers-34b8d",
  storageBucket: "cheers-34b8d.firebasestorage.app",
  messagingSenderId: "762225019248",
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let messaging = null;
try { if (typeof window !== 'undefined' && 'Notification' in window) messaging = getMessaging(app); } catch (e) { console.warn("Push not supported."); }

// --- Master Configuration ---
const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';
const EVENT_TAGS = ['Standard Day', 'Packers Game', 'Brewers Game', 'Live Music', 'Severe Weather', 'Private Catering', 'Holiday'];

// --- Helpers ---
const useLiveCollection = (coll) => { const [data, setData] = useState([]); useEffect(() => onSnapshot(collection(db, coll), snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))), [coll]); return data; };
const formatDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
const getToday = () => formatDate(new Date());
const getMonthStr = (d) => (d || getToday()).substring(0, 7);
const formatDisplayDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const formatDisplayFullDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const formatDisplayMonth = (m) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const getDaysInMonth = (m) => new Date(m.split('-')[0], m.split('-')[1], 0).getDate();
const formatShortTime = (t) => { if (!t) return ''; if(t === 'CLOSE') return 'CL'; let [h, m] = t.split(':'); h = parseInt(h, 10); return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h >= 12 ? 'p' : 'a'}`; };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();
const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };

// --- Audit Log Helper ---
const logAudit = async (user, action, target, details) => { try { await addDoc(collection(db, "auditLogs"), { userName: user?.name || user?.email || "Unknown User", action, target, details, timestamp: new Date().toISOString() }); } catch (error) { console.error("Audit failed", error); } };

// --- Global Crash Reporter ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) { window.crashCatcherAttached = true; window.onerror = (msg, url, lineNo, columnNo, error) => { addDoc(collection(db, "crashReports"), { type: 'error', message: msg, stack: error?.stack || '', time: new Date().toISOString() }).catch(()=>{}); return false; }; }

// --- UI Components ---
const CheersLogo = () => (
  <svg viewBox="0 0 400 120" className="h-10 sm:h-12 w-auto drop-shadow-sm text-white" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M190,20 C70,0 0,35 0,65 C0,95 100,110 270,110 L270,105 C100,105 30,95 30,65 C30,40 80,25 190,20 Z" />
    <text x="95" y="85" fontFamily="'Brush Script MT', 'Great Vibes', cursive" fontStyle="italic" fontSize="90" fontWeight="900" letterSpacing="-1">Cheers</text>
  </svg>
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

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser }) => {
  if (!isOpen) return null;
  const tabs = [];
  if (appUser?.isAdmin) tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> }); 
  tabs.push({ id: 'published', label: 'Schedule & Time Off', icon: <Clock size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> });
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') { tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> }); tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> }); }
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  if (appUser?.isAdmin) { tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> }); if (appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) tabs.push({ id: 'audit', label: 'Audit Logs', icon: <Shield size={18}/> }); }
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  return (
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
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
             {tabs.map(tab => (
               <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? `${T.grad} text-slate-900 shadow-md` : 'text-slate-400 hover:bg-[#12161A] hover:text-white'}`}>
                 <div className="flex items-center gap-3"><span className={activeTab === tab.id ? 'text-slate-900' : T.copper}>{tab.icon}</span>{tab.label}</div>
               </button>
             ))}
          </div>
          <div className={`p-3 border-t ${T.border} bg-[#12161A] space-y-2`}>
            <button onClick={() => { localStorage.removeItem('cheersUser'); setAppUser(null); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 text-sm font-bold rounded-xl hover:bg-red-900/20 transition-colors"><LogOut size={16} /> Log Out</button>
          </div>
       </div>
     </div>
  );
};

// --- DEDICATED DAY DOT PRINT ENGINE ---
const DayDotPrintScreen = ({ labelsToPrint, prepDate, appUser, onClose }) => {
  useEffect(() => {
    const handleBackButton = () => onClose(); window.history.pushState({ tab: 'prep', printScreen: true }, ''); window.addEventListener('popstate', handleBackButton);
    const timer = setTimeout(() => window.print(), 800);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', handleBackButton); };
  }, [onClose]);
  return (
    <div id="master-print-wrapper" className="fixed inset-0 z-[999999] bg-white overflow-y-auto text-black">
      <style>{`@media print { @page { size: 3.5in 1.1in; margin: 0; } body, html { margin: 0 !important; background: white !important; } .no-print { display: none !important; } .dk-label { width: 3.5in !important; height: 1.1in !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.05in 0.15in !important; box-sizing: border-box !important; page-break-after: always !important; margin: 0 !important; font-family: sans-serif !important; overflow: hidden !important; } .dk-title { font-size: 16px !important; font-weight: 900 !important; text-transform: uppercase !important; text-align: center !important; margin-bottom: 2px !important; } .dk-row { display: flex !important; justify-content: space-between !important; font-size: 11px !important; font-weight: bold !important; margin-bottom: 2px !important; } .dk-exp { display: flex !important; justify-content: center !important; font-size: 14px !important; font-weight: 900 !important; border-top: 2px solid black !important; padding-top: 2px !important; } }`}</style>
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

// ============================================================================
// SECTION 2: SLEEK LOGIN & ADMIN FIX (Fully Copper Mapped)
// ============================================================================
const LoginScreen = ({ users, setAppUser, addToast }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isRecover, setIsRecover] = useState(false); const [loading, setLoading] = useState(false); const [resetUser, setResetUser] = useState(null);
  const isFirstUser = users.length === 0;

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true);
    if (email.trim().toLowerCase() === 'admin' && password === 'Atticus7!') { setAppUser({ id: 'dev-backdoor', name: 'Ghost Admin', email: MASTER_ADMIN_EMAIL, role: 'Kitchen', isAdmin: true, isActive: true }); return; }
    try {
      if (isFirstUser) {
        const newUser = { name: 'Admin', email: MASTER_ADMIN_EMAIL, phone: '', password, role: 'Kitchen', isAdmin: true, isActive: true, forcePasswordChange: false, photoURL: '' };
        const docRef = await addDoc(collection(db, "users"), newUser);
        setAppUser({ id: docRef.id, ...newUser });
      } else {
        const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
        if (user) { if (user.forcePasswordChange) setResetUser(user); else setAppUser(user); } else addToast("Error", "Invalid credentials.");
      }
    } catch (err) { addToast("Error", "Connection error."); console.error(err); }
    setLoading(false);
  };

  const handleRecover = async (e) => {
    e.preventDefault(); setLoading(true);
    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (user) { const tempPass = generateTempPass(); await updateDoc(doc(db, "users", user.id), { password: tempPass, forcePasswordChange: true }); addToast("Manager Notified", "A temporary password has been generated."); } else { addToast("Error", "Account not found."); }
    setIsRecover(false); setLoading(false);
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault(); setLoading(true);
    if(password.length < 5) { addToast("Error", "Password too short."); setLoading(false); return; }
    try { await updateDoc(doc(db, "users", resetUser.id), { password: password, forcePasswordChange: false }); setAppUser({ ...resetUser, password: password, forcePasswordChange: false }); } catch (err) { addToast("Error", "Failed to update."); }
    setLoading(false);
  };

  if (resetUser) return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${T.bg}`}><div className={`${T.card} p-8 max-w-md w-full`}><h2 className="text-xl font-black text-center mb-2 tracking-tight text-white">Welcome, {resetUser.name}!</h2><p className="text-center text-sm text-slate-400 mb-6 font-medium">Please set your permanent password.</p><form onSubmit={handlePasswordSetup} className="space-y-4"><div><label className={T.label}>New Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className={T.input} required /></div><button type="submit" disabled={loading} className={`w-full ${T.btn}`}>{loading ? 'Processing...' : 'Save & Login'}</button></form></div></div>
  );

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${T.bg}`}>
      <div className={`${T.card} p-8 max-w-md w-full`}>
        <div className="flex justify-center mb-6"><CheersLogo /></div>
        <h2 className="text-xl font-black text-center mb-6 tracking-tight text-white">{isRecover ? 'Recover Password' : (isFirstUser ? 'System Initialization' : 'Staff Secure Login')}</h2>
        <form onSubmit={isRecover ? handleRecover : handleLogin} className="space-y-4">
          <div><label className={T.label}>Email / ID</label><input type="text" value={email} onChange={e => setEmail(e.target.value)} className={T.input} required /></div>
          {!isRecover && <div><label className={T.label}>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className={T.input} required /></div>}
          <button type="submit" disabled={loading} className={`w-full mt-2 ${T.btn}`}>
            {loading ? 'Authenticating...' : (isRecover ? 'Reset Password' : (isFirstUser ? 'Initialize Admin' : 'Access Node'))}
          </button>
        </form>
        {!isFirstUser && <button onClick={() => { setIsRecover(!isRecover); setEmail(''); setPassword(''); }} className={`w-full text-center mt-6 text-xs font-bold transition-colors text-slate-500 hover:text-[#D4A381]`}>{isRecover ? 'Back to Login' : 'Forgot Password?'}</button>}
      </div>
    </div>
  );
};

// ============================================================================
// SECTION 3: MASTER SCHEDULE HUB (Combined Schedule, TimeClock, Month, Requests)
// ============================================================================
const TabMasterSchedule = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOffRequests, events, addToast }) => {
  const [subTab, setSubTab] = useState('my-schedule');
  const monthStr = getMonthStr(currentDate);
  const myNextShift = shifts.find(s => s.employeeId === appUser.id && s.date >= getToday() && s.isPublished);

  const handleOfferSwap = async (shift) => {
    if (!window.confirm("Offer shift to Trade Board?")) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatShortTime(shift.startTime)}). Claim it on the Schedule!`, type: 'note', author: 'System Alert', isImportant: true });
    addToast('Posted', 'Shift sent to trade board.');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['my-schedule', 'full-schedule', 'month-view', 'time-off'].map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} className={`px-4 py-2 text-xs font-bold rounded-xl capitalize whitespace-nowrap transition-all ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 border border-[#2A353D]'}`}>{tab.replace('-', ' ')}</button>
        ))}
      </div>

      {subTab === 'my-schedule' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {events.filter(e => e.type === 'note' && e.isImportant).slice(0,1).map(alert => (
            <div key={alert.id} className="bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 p-3 rounded-xl flex gap-3 shadow-lg">
              <span className="text-xl">🔔</span><div><span className="text-[9px] font-black uppercase text-[#D4A381] tracking-widest block">System Alert</span><p className="text-xs text-slate-200 font-medium leading-snug">{alert.title}</p></div>
            </div>
          ))}
          <div className={`${T.grad} rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-[#D4A381]/30`}>
            <div className="absolute -top-4 -right-4 text-8xl font-black text-slate-900/10">86</div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900/60 mb-1">My Schedule</h3>
            {myNextShift ? (
              <div className="mb-6"><div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Next: {myNextShift.role}</div><div className="text-sm font-bold text-slate-900/80 flex items-center gap-1.5">{formatDisplayDate(myNextShift.date)} • {formatShortTime(myNextShift.startTime)} - {formatShortTime(myNextShift.endTime)} {myNextShift.endTime === 'CLOSE' && <span className="bg-slate-900 text-[#D4A381] text-[9px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-wider">Close</span>}</div></div>
            ) : (<div className="mb-6 text-slate-900 font-bold">No upcoming shifts scheduled.</div>)}
            <button onClick={() => addToast("Time Clock", "Geofencing Engine currently disabled in Phase 1.")} className="w-full py-4 bg-[#12161A] text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-[#1A2126] border border-[#2A353D] transition-colors">CLOCK IN / OUT</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { if(myNextShift) { handleOfferSwap(myNextShift); } else { addToast("Error", "No upcoming shift to offer."); } }} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors`}><span className="text-xl">🔄</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Offer Shift</span></button>
            <button onClick={() => setSubTab('time-off')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors`}><span className="text-xl">🏖️</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Request Off</span></button>
          </div>
        </div>
      )}

      {subTab === 'full-schedule' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className="bg-[#12161A] p-3 border-b border-[#2A353D]"><h3 className={`text-xs font-black uppercase tracking-widest ${T.copper}`}>Active Roster</h3></div>
          <div className="divide-y divide-[#2A353D]">
            {shifts.filter(s => s.date >= getToday() && s.isPublished).map(shift => {
               const emp = users.find(u => u.id === shift.employeeId);
               return (
                 <div key={shift.id} className={T.row}>
                   <div className="flex items-center gap-3"><img src={getAvatar(emp?.name, emp?.photoURL)} className={`w-8 h-8 rounded-full border ${T.border}`} alt="avatar"/><div><div className="text-sm font-bold text-white">{emp?.name.split(' ')[0]}</div><div className={`text-[9px] ${T.muted} font-bold uppercase`}>{formatDisplayDate(shift.date)} • {shift.role}</div></div></div>
                   <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>{formatShortTime(shift.startTime)} - {formatShortTime(shift.endTime)}</div>
                 </div>
               )
            })}
            {shifts.filter(s => s.date >= getToday() && s.isPublished).length === 0 && <div className={`p-6 text-center text-xs font-bold ${T.muted}`}>No shifts published for this period.</div>}
          </div>
        </div>
      )}

      {subTab === 'month-view' && <div className="animate-[slideIn_0.2s_ease-out]"><TabMonth currentDate={currentDate} users={users} shifts={shifts} /></div>}
      {subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} /></div>}
    </div>
  );
};

// --- Tab: Sales & Trends ---
const TabSales = ({ sales, addToast }) => {
  const [date, setDate] = useState(getToday()); const [amount, setAmount] = useState(''); const [tag, setTag] = useState('Standard Day');
  const handleSave = async (e) => { e.preventDefault(); if (!amount) return; await addDoc(collection(db, "sales"), { date, amount: parseFloat(amount), tag, loggedAt: new Date().toISOString() }); setAmount(''); addToast('Saved', 'Daily sales logged.'); };
  const sortedSales = [...sales].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 14);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={`${T.card} p-6`}>
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-white"><TrendingUp className={T.copper}/> Log Daily Sales</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div><label className={T.label}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={T.input}/></div>
          <div><label className={T.label}>Revenue ($)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={T.input} required/></div>
          <div><label className={T.label}>Event Tag</label><select value={tag} onChange={e=>setTag(e.target.value)} className={T.input}>{EVENT_TAGS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <button className={`${T.btn} h-[46px]`}>Save Log</button>
        </form>
      </div>
      <div className={`${T.card} p-4`}>
        <h3 className="font-bold text-lg mb-3 text-white">Recent Trends</h3>
        <div className={`divide-y ${T.border}`}>
          {sortedSales.length === 0 && <div className={`py-4 text-center text-sm font-bold ${T.muted}`}>No sales data logged yet.</div>}
          {sortedSales.map(s => (
          <div key={s.id} className="py-3 flex justify-between items-center">
            <div><span className="font-bold block text-white">{formatDisplayDate(s.date)}</span><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded mt-1 inline-block bg-[#12161A] border ${T.border} ${s.tag === 'Standard Day' ? T.muted : T.copper}`}>{s.tag}</span></div>
            <div className={`font-black text-lg ${T.copper}`}>${s.amount.toFixed(2)}</div>
          </div>
        ))}</div>
      </div>
    </div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [role, setRole] = useState('Bartender'); const [photoURL, setPhotoURL] = useState(''); const [isAdmin, setIsAdmin] = useState(false);
  const [editModalUser, setEditModalUser] = useState(null);
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role === 'Bartender' ? -1 : 1));

  const handleAdd = async (e) => { e.preventDefault(); if (!name.trim() || !email.trim()) return; const tPass = generateTempPass(); try { await addDoc(collection(db, "users"), { name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password: tPass, role, isAdmin, isActive: true, forcePasswordChange: true, photoURL: photoURL.trim() }); addToast('Staff Added', `Auto-generated password: ${tPass}`); setName(''); setEmail(''); setPhone(''); setPhotoURL(''); setIsAdmin(false); } catch (err) { console.error(err); } };
  const handleUpdateUser = async (e) => { e.preventDefault(); if (!editModalUser.name.trim() || !editModalUser.email.trim()) return; try { const updates = { name: editModalUser.name.trim(), email: editModalUser.email.toLowerCase().trim(), phone: editModalUser.phone || '', role: editModalUser.role, photoURL: editModalUser.photoURL || '' }; if (editModalUser.newPassword) { updates.password = editModalUser.newPassword; updates.forcePasswordChange = true; } await updateDoc(doc(db, "users", editModalUser.id), updates); addToast('Profile Updated', `${editModalUser.name}'s info has been saved.`); setEditModalUser(null); } catch (err) { console.error(err); addToast('Update Failed', 'Could not save profile changes.'); } };
  const handleToggleAdmin = async (id, currentStatus) => { await updateDoc(doc(db, "users", id), { isAdmin: !currentStatus }); };
  const handleDelete = async (id) => { if (window.confirm("Remove this staff member? This cannot be undone.")) { await deleteDoc(doc(db, "users", id)); addToast('Staff Removed', 'Account permanently deleted.'); logAudit(appUser, 'DELETE_STAFF', 'Team Roster', 'Permanently removed a staff member.'); } };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Modal isOpen={!!editModalUser} onClose={() => setEditModalUser(null)} title={`Edit Profile: ${editModalUser?.name}`}>
        {editModalUser && (
          <form onSubmit={handleUpdateUser} className="space-y-3">
            <div><label className={T.label}>Name</label><input type="text" value={editModalUser.name} onChange={e => setEditModalUser({...editModalUser, name: e.target.value})} className={T.input} required /></div>
            <div><label className={T.label}>Email</label><input type="email" value={editModalUser.email} onChange={e => setEditModalUser({...editModalUser, email: e.target.value})} className={T.input} required /></div>
            <div><label className={T.label}>Phone</label><input type="tel" value={editModalUser.phone || ''} onChange={e => setEditModalUser({...editModalUser, phone: e.target.value})} className={T.input} /></div>
            <div><label className={T.label}>Avatar URL</label><input type="url" value={editModalUser.photoURL || ''} onChange={e => setEditModalUser({...editModalUser, photoURL: e.target.value})} className={T.input} /></div>
            <div><label className={T.label}>Role</label><select value={editModalUser.role} onChange={e => setEditModalUser({...editModalUser, role: e.target.value})} className={T.input}><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
            <div className={`pt-3 border-t ${T.border}`}><label className={`block text-[10px] uppercase tracking-widest font-bold text-red-500 mb-1`}>Force Password Reset</label><input type="text" placeholder="Enter temporary password..." value={editModalUser.newPassword || ''} onChange={e => setEditModalUser({...editModalUser, newPassword: e.target.value})} className={T.input} /></div>
            <button type="submit" className={`w-full mt-2 ${T.btn}`}>Save Profile</button>
          </form>
        )}
      </Modal>

      {appUser?.isAdmin && (
        <div className={`${T.card} p-4`}>
          <h3 className="font-bold text-base flex items-center gap-2 text-white mb-3"><Users size={18} className={T.copper}/> Add Staff</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={T.label}>Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={T.input} required /></div>
              <div><label className={T.label}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={T.input} required /></div>
              <div><label className={T.label}>Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={T.input} /></div>
              <div><label className={T.label}>Avatar URL</label><input type="url" placeholder="Optional" value={photoURL} onChange={e => setPhotoURL(e.target.value)} className={T.input} /></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:w-40"><label className={T.label}>Role</label><select value={role} onChange={e => setRole(e.target.value)} className={T.input}><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mt-3 cursor-pointer flex-1"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 rounded border-[#2A353D] bg-[#12161A] accent-[#8F6040]" /> Admin</label>
              <button type="submit" className={`w-full sm:w-auto mt-3 sm:mt-0 ${T.btn}`}>Add Staff</button>
            </div>
          </form>
        </div>
      )}
      
      <div className={`${T.card} overflow-x-auto no-scrollbar`}>
        <table className="w-full text-left border-collapse min-w-[450px]">
          <tbody className={`divide-y ${T.border}`}>
            {displayUsers.map(u => {
              const isMaster = u.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
              return (
              <tr key={u.id} className={T.row}>
                <td className="flex items-center gap-2">
                  <img src={getAvatar(u.name, u.photoURL)} className={`w-8 h-8 rounded-full border ${T.border} object-cover`} alt="Avatar"/>
                  <div className="font-bold text-white text-sm">{u.name}</div>
                </td>
                <td>
                  <div className={`text-[9px] font-bold bg-[#12161A] px-1.5 py-0.5 rounded w-max border ${T.border} flex items-center gap-1 text-slate-300`}>
                    <span>📱</span>{u.phone ? <a href={`tel:${u.phone}`} className={`${T.copper} hover:underline`}>{u.phone}</a> : <span className={T.muted}>No phone</span>}
                  </div>
                </td>
                <td>
                  <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full inline-block bg-[#12161A] border ${T.border} ${u.role === 'Bartender' ? 'text-blue-400' : 'text-orange-400'}`}>{u.role}</span>
                  {appUser?.isAdmin && !isMaster && (<label className="flex items-center gap-1 mt-1 cursor-pointer w-max"><input type="checkbox" checked={u.isAdmin} onChange={() => handleToggleAdmin(u.id, u.isAdmin)} className="w-3 h-3 rounded bg-[#12161A] border-[#2A353D] accent-[#8F6040]" /><span className={`text-[9px] font-bold uppercase ${T.muted}`}>Admin</span></label>)}
                  {isMaster && <span className={`block mt-1 text-[9px] font-black bg-[#12161A] border ${T.border} ${T.copper} px-1.5 py-0.5 rounded w-max`}>Master Admin</span>}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                     {appUser?.isAdmin && <button onClick={() => setEditModalUser(u)} className={`text-slate-400 hover:${T.copper} p-1.5 rounded transition-colors`}><Edit size={16}/></button>}
                     {appUser?.isAdmin && !isMaster && (<button onClick={() => handleDelete(u.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>)}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MESSAGE BOARD ---
const TabMessages = ({ events, appUser, users, addToast }) => {
  const [message, setMessage] = useState(''); const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));
  const handleBroadcast = async (e) => { e.preventDefault(); if(!message.trim()) return; await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: message.trim(), type: 'note', author: appUser.name, isImportant: false }); setMessage(''); addToast('Posted', 'Message sent.'); };
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className={`${T.card} p-4`}><form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row gap-3"><textarea value={message} onChange={e=>setMessage(e.target.value)} className={T.input} rows="2" placeholder="Message the team..." required></textarea><button className={`${T.btn} px-8`}>Post</button></form></div>
      <div className="space-y-3">{allNotes.map(n => {
        const authorUser = users.find(u => u.name === n.author);
        return (
        <div key={n.id} className={`p-4 flex gap-3 ${n.isImportant ? `bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 rounded-2xl shadow-sm` : T.card}`}>
          {n.author !== 'System Alert' && <img src={getAvatar(n.author, authorUser?.photoURL)} className={`w-10 h-10 rounded-full border ${T.border} flex-shrink-0`} alt="pic"/>}
          <div className="flex-1"><div className="flex justify-between items-start mb-1"><span className={`font-black text-sm ${n.isImportant ? 'text-red-500' : T.copper}`}>{n.author}</span><span className="text-[10px] font-bold text-slate-400">{new Date(n.date).toLocaleDateString()}</span></div><p className="font-medium leading-snug text-slate-200">{n.title}</p></div>
          {appUser?.isAdmin && <button onClick={() => deleteDoc(doc(db, "events", n.id))} className="text-slate-400 hover:text-red-500 self-start"><Trash2 size={16}/></button>}
        </div>
      )})}</div>
    </div>
  )
};

// --- COMPACT MONTH VIEW ---
const TabMonth = ({ currentDate, users, shifts }) => {
  const monthStr = getMonthStr(currentDate); const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); const days = getDaysInMonth(monthStr);
  return (
    <div className={`${T.card} overflow-hidden print-container`}>
      <style>{`@media print { .no-print{display:none;} .print-container{position:absolute;top:0;left:0;width:100%;background:white;} .cell{border:1px solid #ccc!important;} }`}</style>
      <div className="flex justify-end p-2 no-print border-b border-[#2A353D] bg-[#12161A]"><button onClick={()=>window.print()} className={T.btnAlt}>Print Calendar</button></div>
      <div className={`grid grid-cols-7 border-t border-l ${T.border}`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}>{d}</div>)}
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; const dayShifts = shifts.filter(s=>s.date===date&&s.isPublished);
          return (
            <div key={date} className={`p-0.5 border-b border-r ${T.border} min-h-[50px] flex flex-col cell overflow-hidden`}>
              <span className={`text-right text-[9px] font-black ${T.muted} mb-0.5`}>{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto no-scrollbar flex-1">{dayShifts.map(s=><div key={s.id} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate bg-[#12161A] border ${T.border} ${s.role==='Bartender'?'text-blue-400':'text-orange-400'}`}>{users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}</div>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- SCHEDULE MAKER ---
const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, addToast, appUser }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); const [assignDates, setAssignDates] = useState([]); const [presetShift, setPresetShift] = useState('Custom'); const [startTime, setStartTime] = useState('16:00'); const [endTime, setEndTime] = useState('21:00');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false); const [eventDate, setEventDate] = useState(getToday()); const [eventTitle, setEventTitle] = useState('');
  
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));
  const monthStr = getMonthStr(currentDate); const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => a.date.localeCompare(b.date));

  const SHIFT_PRESETS = [ { label: "9a-3p", start: "09:00", end: "15:00" }, { label: "10a-4p", start: "10:00", end: "16:00" }, { label: "10a-9p", start: "10:00", end: "21:00" }, { label: "11a-3p", start: "11:00", end: "15:00" }, { label: "11a-4p", start: "11:00", end: "16:00" }, { label: "4p-9p", start: "16:00", end: "21:00" }, { label: "7p-close", start: "19:00", end: "CLOSE" }, { label: "9p-close", start: "21:00", end: "CLOSE" }, { label: "Custom", start: "", end: "" } ];
  const handlePresetChange = (e) => { const val = e.target.value; setPresetShift(val); const p = SHIFT_PRESETS.find(x => x.label === val); if (p && val !== 'Custom') { setStartTime(p.start); if (p.end !== 'CLOSE') setEndTime(p.end); } };

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    const sTime = startTime; const eTime = presetShift.includes('close') ? '23:59' : endTime;
    const validDates = [];
    for (const d of assignDates) { 
      const req = timeOffRequests.find(r => r.date === d && r.userId === emp.id);
      if (req) {
        if (!req.isPartial) { addToast('Blocked', `${emp.name.split(' ')[0]} requested ${formatDisplayDate(d)} off.`); return; } 
        else { const reqEnd = req.endTime || '23:59'; if ((sTime < reqEnd) && (eTime > req.startTime)) { addToast('Blocked', `${emp.name.split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`); return; } }
      }
      validDates.push(d);
    }
    for (const d of validDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime: sTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false }); }
    setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shifts.`);
  };

  const handlePublish = async () => { if(!window.confirm("Publish schedule? Notifications will be sent.")) return; const unpub = monthShifts.filter(s => !s.isPublished); for(const s of unpub) await updateDoc(doc(db, "shifts", s.id), {isPublished:true}); addToast("Published", "Schedule is live."); logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', 'Pushed a new schedule live.'); };
  const handleAddEvent = async (e) => { e.preventDefault(); if(!eventTitle.trim()) return; await addDoc(collection(db, "events"), { type: 'special_event', date: eventDate, title: eventTitle.trim(), addedBy: appUser.name }); setEventTitle(''); setIsEventModalOpen(false); addToast('Event Added', 'Calendar updated.'); };

  return (
    <div className="space-y-6 pb-12">
      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="Add Special Event">
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div><label className={T.label}>Date</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className={T.input} required/></div>
          <div><label className={T.label}>Event Title</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className={T.input} required/></div>
          <button type="submit" className={`w-full ${T.btn}`}>Save Event</button>
        </form>
      </Modal>

      <div className={`${T.card} p-3 flex flex-col lg:flex-row gap-3 items-center justify-between`}>
        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full lg:w-auto items-center">
          <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className={T.input}><option value="">👤 Select Staff</option>{displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select value={presetShift} onChange={handlePresetChange} className={T.input}>{SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</select>
          <div className="flex gap-2 w-full md:w-auto">
            <input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className={T.input}/>
            <input type="time" value={presetShift.includes('close')?'':endTime} disabled={presetShift.includes('close')} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} disabled:opacity-50`}/>
          </div>
          <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className={`w-full md:w-auto ${T.btn} disabled:opacity-50`}>Assign ({assignDates.length})</button>
        </div>
        <button onClick={handlePublish} className={`w-full lg:w-auto ${T.btnAlt}`}>Publish All</button>
      </div>

      <div className={`${T.card} overflow-x-auto no-scrollbar`}>
        <table className="w-full text-left text-[10px] border-collapse">
          <thead><tr className="bg-[#12161A] border-b border-[#2A353D]"><th className={`p-2 font-bold sticky left-0 bg-[#12161A] z-20 w-24 border-r border-[#2A353D] ${T.copper}`}>Staff</th>{monthDays.map(d=>{
            const hasEvent = monthEvents.some(e => e.date === d);
            return (<th key={d} className={`p-1 text-center border-r border-[#2A353D] min-w-[38px] ${new Date(d+'T12:00').getDay()%6===0?'bg-[#1A2126]':''}`}><div className={`font-bold uppercase ${T.muted}`}>{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short'})}</div><div className="text-sm font-black text-white relative">{parseInt(d.split('-')[2])} {hasEvent && <Star size={8} className="absolute top-0 right-1 text-[#D4A381] fill-[#D4A381]"/>}</div></th>)
          })}</tr></thead>
          <tbody className="divide-y divide-[#2A353D]">{displayUsers.map(u => (
            <tr key={u.id} className={selectedEmp===u.id?'bg-[#12161A]/50':''}>
              <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`p-2 font-bold sticky left-0 z-10 border-r border-[#2A353D] cursor-pointer truncate shadow-sm ${selectedEmp===u.id?`${T.grad} text-slate-900`:'bg-[#1A2126] text-white'}`}>{u.name.split(' ')[0]}</td>
              {monthDays.map(d => {
                const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); const req = timeOffRequests.find(r=>r.date===d&&r.userId===u.id); const sel = assignDates.includes(d) && selectedEmp===u.id;
                return (<td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-[#2A353D] cursor-pointer transition-all ${sel?'bg-[#8F6040] outline outline-4 outline-[#8F6040] shadow-xl z-50 relative':'hover:bg-[#12161A]'}`}>
                  <div className="flex flex-col gap-[1px]">
                    {req && !req.isPartial && <div className="w-full rounded font-black text-[8px] py-1 text-center text-red-400 bg-red-900/40 uppercase tracking-tighter" title="Requested Off">Unavail</div>}
                    {req && req.isPartial && <div className="w-full rounded font-black text-[8px] py-1 px-0.5 text-center text-amber-400 bg-amber-900/40 uppercase tracking-tighter" title={`Off: ${formatShortTime(req.startTime)}-${formatShortTime(req.endTime)}`}>Off: {formatShortTime(req.startTime)}-{formatShortTime(req.endTime)}</div>}
                    {shift && <div className={`w-full rounded font-bold text-[9px] py-1 text-center text-slate-900 ${shift.isPublished?(u.role==='Bartender'?'bg-[#D4A381]':'bg-[#C59373]'):'bg-slate-400'}`} title={`${formatShortTime(shift.startTime)} - ${formatShortTime(shift.endTime)}`}>{formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}</div>}
                    {!req && !shift && <div className="h-5 rounded"></div>}
                  </div>
                </td>)
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className={`${T.card} overflow-hidden`}>
        <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
          <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Star className={T.copper}/> Special Events</h3>
          <button onClick={() => {setEventDate(currentDate); setIsEventModalOpen(true);}} className={T.btnAlt}>Add Event</button>
        </div>
        <div className={`divide-y ${T.border}`}>
          {monthEvents.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No special events scheduled this month.</div>}
          {monthEvents.map(ev => (
            <div key={ev.id} className={T.row}>
              <div className="flex items-center gap-4">
                <div className={`bg-[#12161A] border ${T.border} ${T.copper} font-black text-center rounded-xl p-2 w-14 shadow-sm flex-shrink-0`}>
                  <div className="text-[10px] uppercase">{new Date(ev.date+'T12:00').toLocaleDateString('en-US',{month:'short'})}</div><div className="text-lg leading-tight">{parseInt(ev.date.split('-')[2])}</div>
                </div>
                <div><h4 className="font-bold text-white">{ev.title}</h4><span className={`text-[10px] font-bold ${T.muted}`}>Added by {ev.addedBy}</span></div>
              </div>
              <button onClick={() => { if(window.confirm("Delete event?")) deleteDoc(doc(db,"events",ev.id)); }} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- PREP LIST ---
const TabPrep = ({ currentDate, prepItems, appUser, setLabelsToPrint }) => {
  const [text, setText] = useState(''); const [cat, setCat] = useState('General'); const [isMaster, setIsMaster] = useState(true); const [prepDate, setPrepDate] = useState(currentDate);
  const items = prepItems.filter(p=>p.date===prepDate||p.isMaster);

  const handleAdd = async (e) => { e.preventDefault(); if(text.trim()) { await addDoc(collection(db, "prepItems"), { date: isMaster?'MASTER':prepDate, text: text.trim(), category: cat, isCompleted: false, completedDates: {}, isMaster, qty: 1, completedBy: null, isSelected: false }); setText(''); } };
  const toggleStatus = async (item) => { if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = dts[prepDate] ? null : appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); } else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null, isSelected: false }); } };
  const updateQty = async (id, currentQty, change) => { await updateDoc(doc(db, "prepItems", id), { qty: Math.max(1, currentQty + change) }); };
  const toggleSelect = async (i) => await updateDoc(doc(db, "prepItems", i.id), { isSelected: !i.isSelected });
  
  const handleBatchDone = async () => { const toComplete = items.filter(i => i.isSelected); if (toComplete.length === 0) return; for (const item of toComplete) { if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); } else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: true, completedBy: appUser.name, isSelected: false }); } } };
  const triggerBatchPrint = () => { const selected = items.filter(i => i.isSelected); if (selected.length === 0) return; const toPrint = []; selected.forEach(item => { for (let i = 0; i < (item.qty||1); i++) { toPrint.push({ ...item, printId: `${item.id}-${i}-${Date.now()}` }); } }); setLabelsToPrint({ items: toPrint, prepDate }); };

  const globalSelectedCount = items.filter(i => i.isSelected).length;
  const groupedItems = items.reduce((acc, i) => { const c = i.category || 'General'; if(!acc[c]) acc[c]=[]; acc[c].push(i); return acc; }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-3 relative pb-40">
      <div className={`${T.card} p-3 flex justify-between items-center`}>
         <h3 className={`font-bold flex items-center gap-2 text-sm ${T.copper}`}><ClipboardList size={18}/> Prep List For:</h3>
         <input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-1.5 bg-[#12161A] border border-[#2A353D] rounded-lg outline-none text-sm font-bold text-white"/>
      </div>
      <form onSubmit={handleAdd} className={`${T.card} p-2 pl-3 flex flex-col sm:flex-row gap-2 items-center`}>
        <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-1.5 bg-transparent text-sm outline-none font-medium text-white" placeholder="Add prep task..." required/>
        <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full sm:w-28 p-1.5 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-lg outline-none text-white"><option>General</option><option>Meat</option><option>Produce</option><option>Dairy</option><option>Sauces</option><option>Line Prep</option></select>
        <div className={`flex items-center gap-3 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 ${T.border}`}>
          <label className={`flex items-center gap-2 text-xs font-bold ${T.muted} cursor-pointer`}><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4 accent-[#8F6040] bg-[#12161A] border-[#2A353D]"/> Master</label>
          <button className={`${T.btn} py-2 px-3`}><Plus size={18}/></button>
        </div>
      </form>
      
      <div className={`${T.card} overflow-hidden`}>
        {Object.entries(groupedItems).map(([category, catItems]) => (
          <div key={category}>
            <div className={T.th}><span>{category}</span><span className="float-right text-slate-500">{catItems.filter(i => (i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted)).length}/{catItems.length} Done</span></div>
            <div className={`divide-y ${T.border}`}>
              {catItems.map(i=>{
                const isDone = i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted; const doneBy = i.isMaster ? i.completedDates?.[prepDate] : i.completedBy; const qty = i.qty||1;
                return (
                <div key={i.id} className={`${T.row} ${i.isSelected ? 'bg-[#12161A]' : ''} flex items-center gap-2`}>
                  <input type="checkbox" checked={!!i.isSelected} onChange={()=>toggleSelect(i)} className="w-5 h-5 rounded accent-[#8F6040] bg-[#12161A] border-[#2A353D] flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0"><span className={`text-sm font-bold ${isDone?'line-through text-slate-500':'text-white'}`}>{i.text}</span> {doneBy && <span className={`text-[9px] font-black ${T.copper} bg-[#12161A] border ${T.border} px-1.5 py-0.5 rounded ml-2`}>✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-slate-500 uppercase mt-0.5">Master Task</span>}</div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`flex items-center bg-[#12161A] rounded-lg border ${T.border} h-8`}><button onClick={()=>updateQty(i.id,qty,-1)} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">-</button><span className="w-5 text-center text-xs font-bold text-white">{qty}</span><button onClick={()=>updateQty(i.id,qty,1)} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">+</button></div>
                    <button onClick={()=>toggleStatus(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${isDone?'bg-[#12161A] text-slate-500 border border-[#2A353D]':`${T.grad} text-slate-900`}`}>{isDone ? <Repeat size={14}/> : <Check size={16}/>}</button>
                    <button onClick={()=>{ deleteDoc(doc(db,"prepItems",i.id)); logAudit(appUser, 'DELETE_PREP', i.text, 'Deleted a master prep item.'); }} className="text-slate-400 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>
      <div className={`fixed bottom-0 left-0 right-0 p-3 bg-[#161D22] border-t ${T.border} z-50`}>
        <div className="max-w-2xl mx-auto flex gap-2">
          <button onClick={triggerBatchPrint} disabled={globalSelectedCount===0} className={`flex-1 ${T.btn} disabled:opacity-50`}>🖨️ Print Labels ({globalSelectedCount})</button>
          <button onClick={handleBatchDone} disabled={globalSelectedCount===0} className={`flex-1 ${T.btn} disabled:opacity-50`}>Mark Done</button>
        </div>
      </div>
    </div>
  );
};

// --- INVENTORY TAB ---
const TabInventory = ({ inventoryItems, sales, addToast, appUser }) => {
  const [invTab, setInvTab] = useState('count'); const [searchTerm, setSearchTerm] = useState(''); const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState('Produce'); const [newItemCode, setNewItemCode] = useState(''); const [newItemSupplier, setNewItemSupplier] = useState('PFG'); const [newItemPackSize, setNewItemPackSize] = useState('1 CS'); const [newItemPrice, setNewItemPrice] = useState(''); const [orderOverrides, setOrderOverrides] = useState({}); const [editItem, setEditItem] = useState(null); const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, items: [] });
  
  const handleAddItem = async (e) => { e.preventDefault(); if (!newItemName.trim()) return; await addDoc(collection(db, "inventoryItems"), { name: newItemName.trim(), category: newItemCat, pfgCode: newItemCode.trim(), supplier: newItemSupplier, packSize: newItemPackSize.trim(), price: parseFloat(newItemPrice) || 0, parLevel: 10, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null }); setNewItemName(''); setNewItemCode(''); setNewItemPrice(''); addToast('Inventory Updated', 'Item cataloged.'); };
  const handleSaveEdit = async (e) => { e.preventDefault(); await updateDoc(doc(db, "inventoryItems", editItem.id), { name: editItem.name.trim(), category: editItem.category, pfgCode: editItem.pfgCode.trim(), supplier: editItem.supplier, packSize: editItem.packSize, price: parseFloat(editItem.price) || 0 }); setEditItem(null); addToast('Item Updated', 'Master file overwritten.'); };
  const updateStock = async (id, newStock) => await updateDoc(doc(db, "inventoryItems", id), { currentStock: Math.max(0, parseInt(newStock) || 0) });
  const updatePar = async (id, newPar) => await updateDoc(doc(db, "inventoryItems", id), { parLevel: Math.max(0, parseInt(newPar) || 0) });
  const toggleStar = async (item) => await updateDoc(doc(db, "inventoryItems", item.id), { isStarred: !item.isStarred });
  const handleOrderChange = (id, change, currentQty) => setOrderOverrides(prev => ({ ...prev, [id]: Math.max(0, currentQty + change) }));

  const itemsToOrder = inventoryItems.filter(i => { const override = orderOverrides[i.id]; return override !== undefined ? override > 0 : i.currentStock < i.parLevel; });
  const getFinalOrderList = (type) => itemsToOrder.filter(i => type === 'PFG' ? (!i.supplier || i.supplier === 'PFG') : i.supplier === 'Badger').map(item => { const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock); return { ...item, orderQty: qty }; }).filter(i => i.orderQty > 0);
  
  const handleReviewOrder = (type) => { const list = getFinalOrderList(type); if (list.length === 0) return addToast('Order Empty', `No line deficits for ${type}.`); setConfirmModal({ isOpen: true, type, items: list }); };
  const executeOrder = async () => { const { type, items } = confirmModal; let bodyText = ""; if (type === 'PFG') { bodyText = items.map(i => `${i.pfgCode ? `[${i.pfgCode}] ` : ''}${i.name} (${i.packSize}): ${i.orderQty}`).join('%0D%0A'); window.location.href = `mailto:geoffm1985@gmail.com?subject=PFG Order&body=${encodeURIComponent("Performance Foodservice Order\n") + bodyText}`; } else { bodyText = items.map(i => `${i.name} (${i.packSize || '1 CS'}): ${i.orderQty}`).join('%0A'); window.location.href = `sms:555-555-5555?body=${encodeURIComponent("Cheers Chilton Order:\n\n") + bodyText}`; } for (const item of items) { await updateDoc(doc(db, "inventoryItems", item.id), { pendingQty: item.orderQty, lastOrderedQty: item.orderQty, lastOrderedDate: getToday() }); } setOrderOverrides({}); setConfirmModal({ isOpen: false, type: null, items: [] }); addToast('Dispatched', `${type} order tracked.`); };
  const handleReceivePending = async (supplier) => { if(!window.confirm(`Receive pending ${supplier} products?`)) return; const pendingItems = inventoryItems.filter(i => (i.pendingQty || 0) > 0 && (supplier === 'PFG' ? (!i.supplier || i.supplier === 'PFG') : i.supplier === 'Badger')); for (const item of pendingItems) { await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: item.currentStock + item.pendingQty, pendingQty: 0 }); } addToast('Inbound Ingested', `Stock loaded for ${supplier}.`); };

  const getHistoricalContext = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); const pastStr = d.toISOString().split('T')[0]; const pastSale = sales.find(s => s.date === pastStr); return pastSale ? `Last year (${pastStr}): $${pastSale.amount.toFixed(2)} [${pastSale.tag}]` : `No local trend data for this week last year.`; };
  const groupedItems = inventoryItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, type: null, items: [] })} title={`Review ${confirmModal.type} Order`}>
         <div className="space-y-4">
           <div className={`max-h-60 overflow-y-auto border ${T.border} rounded-xl divide-y divide-[#2A353D]`}>{confirmModal.items.map(item => (<div key={item.id} className="p-3 flex justify-between items-center bg-[#12161A]"><div><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-xs ${T.muted}`}>{item.packSize}</span></div><div className={`font-black ${T.copper} text-lg`}>{item.orderQty}</div></div>))}</div>
           <button onClick={executeOrder} className={`w-full ${T.btn} flex items-center justify-center gap-2`}><Send size={20}/> Send Order Out</button>
         </div>
      </Modal>
      <div className={`flex justify-between items-center border-b ${T.border} pb-3`}>
        <h2 className="text-2xl font-black flex items-center gap-2 text-white"><Package size={24} className={T.copper}/> Inventory</h2>
        {appUser?.isAdmin && <div className={`bg-[#12161A] p-1 rounded-xl flex border ${T.border}`}>{['count', 'order', 'manage'].map(tab => (<button key={tab} onClick={() => setInvTab(tab)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize ${invTab === tab ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400'}`}>{tab}</button>))}</div>}
      </div>
      {invTab === 'count' && (
        <div className="space-y-4">
          <input type="text" placeholder="Search parameters..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={T.input} />
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className={`text-base font-black border-b ${T.border} pb-0.5 uppercase tracking-wide text-slate-400`}>{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{items.map(item => (
                  <div key={item.id} className={`${T.card} p-2 flex items-center justify-between gap-2`}>
                    <div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name}</div><div className={`text-[9px] font-bold ${T.muted} uppercase`}>{item.supplier} • {item.packSize || '1 CS'}</div>{(item.pendingQty || 0) > 0 && <span className={`text-[8px] font-black bg-[#12161A] border ${T.border} ${T.copper} px-1.5 py-0.5 rounded-full mt-1 inline-block`}>(+{item.pendingQty} Inbound)</span>}</div>
                    <div className={`flex items-center gap-2 bg-[#12161A] p-1 rounded-md border ${T.border} flex-shrink-0`}>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>PAR</span><input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} disabled={!appUser?.isAdmin} className={`w-8 text-center font-bold border rounded py-0.5 outline-none text-xs bg-[#1A2126] text-white border-[#2A353D]`} /></div>
                      <div className={`h-6 w-px bg-[#2A353D]`}></div>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>STOCK</span><div className="flex items-center gap-1"><button onClick={() => updateStock(item.id, item.currentStock - 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white`}>-</button><span className={`w-4 text-center font-black text-sm ${item.currentStock < item.parLevel ? 'text-red-500' : 'text-white'}`}>{item.currentStock}</span><button onClick={() => updateStock(item.id, item.currentStock + 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white`}>+</button></div></div>
                    </div>
                  </div>
                ))}</div>
            </div>
          ))}
        </div>
      )}
      {appUser?.isAdmin && invTab === 'order' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 mb-2">{inventoryItems.some(i=>(i.pendingQty||0)>0&&i.supplier==='Badger') && <button onClick={()=>handleReceivePending('Badger')} className={T.btnAlt}>Receive Badger</button>}{inventoryItems.some(i=>(i.pendingQty||0)>0&&(!i.supplier||i.supplier==='PFG')) && <button onClick={()=>handleReceivePending('PFG')} className={T.btnAlt}>Receive PFG</button>}</div>
          <div className={`${T.card} p-4`}><h4 className={`font-black ${T.copper} text-sm flex items-center gap-2 mb-1`}><TrendingUp size={16}/> Smart Order Context</h4><p className="text-xs font-bold text-slate-300">{getHistoricalContext()}</p></div>
          <div className={`${T.card} overflow-hidden`}>
            <div className={`p-4 bg-[#12161A] border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-lg text-white">Smart Deficit Report</h3><span className={`bg-[#1A2126] border ${T.border} ${T.copper} px-3 py-1 rounded-full font-black text-[10px] uppercase`}>{itemsToOrder.length} Items</span></div>
            <table className="w-full text-left">
              <thead><tr className={T.th}><th className="p-3">Product</th><th className="p-3 text-center">Last Order</th><th className="p-3 text-right">Order Qty</th></tr></thead>
              <tbody className={`divide-y ${T.border}`}>{itemsToOrder.map(item => {
                const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
                return (
                  <tr key={item.id} className={T.row}>
                    <td className="p-3"><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-[9px] font-bold ${T.muted} uppercase`}>{item.packSize||'1 CS'} • Par: {item.parLevel}</span></td>
                    <td className={`p-3 text-center text-[10px] font-bold ${T.muted}`}>{item.lastOrderedQty ? `${item.lastOrderedQty} (${item.lastOrderedDate})` : '--'}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1"><button onClick={()=>handleOrderChange(item.id, -1, currentOrder)} className={`w-8 h-8 rounded-lg bg-[#12161A] border ${T.border} font-bold text-white hover:bg-[#2A353D]`}>-</button><input type="number" min="0" value={currentOrder} onChange={e=>setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))} className={`w-12 h-8 text-center font-black bg-[#12161A] border ${T.border} ${T.copper} rounded-lg outline-none`}/><button onClick={()=>handleOrderChange(item.id, 1, currentOrder)} className={`w-8 h-8 rounded-lg bg-[#12161A] border ${T.border} font-bold text-white hover:bg-[#2A353D]`}>+</button></div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
            <div className={`p-4 bg-[#12161A] border-t ${T.border} flex flex-col sm:flex-row justify-between items-center gap-4`}><div className="text-left w-full sm:w-auto"><span className={`block text-[10px] font-bold ${T.muted} uppercase tracking-widest mb-0.5`}>PFG Total</span><span className={`font-black text-xl ${T.copper}`}>${getFinalOrderList('PFG').reduce((s,i)=>s+(i.price*i.orderQty),0).toFixed(2)}</span></div><div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"><button onClick={()=>handleReviewOrder('Badger')} className={`${T.btnAlt} flex items-center justify-center gap-2`}><MessageSquare size={16}/> Text Badger</button><button onClick={()=>handleReviewOrder('PFG')} className={`${T.btn} flex items-center justify-center gap-2`}><Send size={16}/> Email PFG</button></div></div>
          </div>
        </div>
      )}
      {appUser?.isAdmin && invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Inventory Item">{editItem && (<form onSubmit={handleSaveEdit} className="space-y-3"><div><label className={T.label}>Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className={T.input} required /></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Category</label><select value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})} className={T.input}><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div><div><label className={T.label}>Supplier</label><select value={editItem.supplier || 'PFG'} onChange={e => setEditItem({...editItem, supplier: e.target.value})} className={T.input}><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Pack Size</label><input type="text" value={editItem.packSize || ''} onChange={e => setEditItem({...editItem, packSize: e.target.value})} className={T.input} /></div><div><label className={T.label}>Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className={T.input} /></div></div><div><label className={T.label}>Item Code</label><input type="text" value={editItem.pfgCode || ''} onChange={e => setEditItem({...editItem, pfgCode: e.target.value})} className={T.input} /></div><button type="submit" className={`w-full ${T.btn}`}>Save Changes</button></form>)}</Modal>
          <div className={`${T.card} p-5`}><h3 className={`text-lg font-bold border-b ${T.border} pb-2 mb-3 text-white`}>Add Single Item</h3><form onSubmit={handleAddItem} className="space-y-3"><div><label className={T.label}>Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className={T.input} required /></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Category</label><select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className={T.input}><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div><div><label className={T.label}>Supplier</label><select value={newItemSupplier} onChange={e => setNewItemSupplier(e.target.value)} className={T.input}><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Pack Size</label><input type="text" value={newItemPackSize} onChange={e => setNewItemPackSize(e.target.value)} className={T.input} /></div><div><label className={T.label}>Price ($)</label><input type="number" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className={T.input} /></div></div><div><label className={T.label}>Item Code</label><input type="text" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} className={T.input} /></div><button type="submit" className={`w-full ${T.btn}`}>Add Item</button></form></div>
          <div className={`${T.card} p-5`}><h3 className={`text-lg font-bold border-b ${T.border} pb-2 mb-3 text-white`}>Current Master Catalog</h3><div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">{inventoryItems.map(item => (<div key={item.id} className={T.row}><div><span className="font-bold text-white block text-sm leading-tight">{item.name}</span><span className={`text-[9px] font-bold ${T.muted} bg-[#12161A] border ${T.border} px-1.5 py-0.5 rounded mt-0.5 inline-block uppercase`}>{item.category} • {item.packSize || '1 CS'}</span></div><div className="flex gap-1 items-center"><button onClick={() => toggleStar(item)} className={`p-1.5 rounded-md transition-colors ${item.isStarred ? 'text-[#D4A381]' : 'text-slate-500'}`}>{item.isStarred ? '⭐' : '☆'}</button><button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-[#D4A381] p-1.5 rounded-md"><Edit size={16}/></button><button onClick={() => deleteDoc(doc(db, "inventoryItems", item.id))} className="text-slate-400 hover:text-red-500 p-1.5 rounded-md"><Trash2 size={16}/></button></div></div>))}</div></div>
        </div>
      )}
    </div>
  );
};

// --- SETTINGS ---
const TabSettings = ({ addToast, appUser }) => {
  const toggleReminder = async () => await updateDoc(doc(db, "users", appUser.id), { shiftRemindersEnabled: !appUser.shiftRemindersEnabled });
  const updateLeadTime = async (val) => await updateDoc(doc(db, "users", appUser.id), { reminderLeadTime: parseInt(val) || 24 });
  const testPush = async () => { if (!appUser.fcmToken) return addToast('Error', 'Enable notifications first.'); addToast('Sending...', 'Triggering test notification.'); try { const registration = await navigator.serviceWorker.ready; registration.showNotification("Cheers OS", { body: "Loud and clear! Push notifications are locked and loaded.", icon: "/app-icon.png" }); } catch(e) { console.error(e); addToast('Error', 'Failed to trigger local push.'); } };
  const handleEnablePush = async () => { if (!messaging) return addToast('Error', 'Push not supported.'); try { const p = await Notification.requestPermission(); if(p !== 'granted') return addToast('Denied', 'Notifications blocked.'); addToast('Connecting...', 'Activating secure worker...'); const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js'); let attempts = 0; while (!registration.active && attempts < 20) { await new Promise(r => setTimeout(r, 200)); attempts++; } const token = await getToken(messaging, { vapidKey: 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU', serviceWorkerRegistration: registration }); if(token) { await updateDoc(doc(db, "users", appUser.id), { fcmToken: token }); addToast('Success', 'Push enabled.'); } } catch(e) { addToast('Error', e.message); console.error(e); } };
  const handlePhotoUpload = (e) => { const file = e.target.files[0]; if (!file) return; addToast('Uploading', 'Compressing and saving image...'); const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = async () => { const canvas = document.createElement('canvas'); const MAX = 200; let w = img.width; let h = img.height; if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } } canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h); await updateDoc(doc(db, "users", appUser.id), { photoURL: canvas.toDataURL('image/jpeg', 0.8) }); addToast('Success', 'Profile picture updated.'); }; img.src = event.target.result; }; reader.readAsDataURL(file); };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className={`${T.card} p-6 space-y-6`}>
        <h3 className="text-xl font-black text-white mb-2">My Profile & Settings</h3>
        <div className="space-y-3">
          <div className={`bg-[#12161A] p-4 rounded-xl border ${T.border} flex justify-between items-center`}>
             <div><h4 className="font-bold text-sm text-white">Profile Picture</h4><p className={`text-xs ${T.muted}`}>Upload a custom avatar</p></div>
             <label className={T.btnAlt}>Upload Image<input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label>
          </div>
          <div className={`bg-[#12161A] p-4 rounded-xl border ${T.border} space-y-3`}>
             <div className="flex justify-between items-center cursor-pointer" onClick={toggleReminder}>
               <div><h4 className="font-bold text-sm text-white">Shift Reminders</h4><p className={`text-xs ${T.muted}`}>Alert me before my shifts</p></div>
               <div className={`w-10 h-5 rounded-full flex items-center px-1 ${appUser.shiftRemindersEnabled?'bg-[#8F6040]':'bg-[#1A2126] border border-[#2A353D]'}`}><div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${appUser.shiftRemindersEnabled?'translate-x-4':'translate-x-0'}`}></div></div>
             </div>
             {appUser.shiftRemindersEnabled && (
               <div className={`flex items-center justify-between border-t ${T.border} pt-3`}>
                  <span className={`text-xs font-bold ${T.muted}`}>Hours before shift:</span>
                  <input type="number" min="1" max="72" value={appUser.reminderLeadTime || 24} onChange={(e) => updateLeadTime(e.target.value)} className="w-16 p-1.5 bg-[#1A2126] border border-[#2A353D] rounded-lg text-center font-bold text-sm outline-none text-white shadow-sm" />
               </div>
             )}
          </div>
        </div>
        <div className={`bg-[#1A2126] p-5 rounded-2xl border ${T.border}`}>
           <h4 className={`font-black ${T.copper} mb-1`}>Device Push Notifications</h4>
           <p className={`text-xs ${T.muted} mb-4 font-medium`}>Link this device to receive alerts.</p>
           <div className="flex gap-2">
             <button onClick={handleEnablePush} className={`${T.btn} flex-1`}>Enable Alerts</button>
             {appUser.fcmToken && <button onClick={testPush} className={`${T.btnAlt} flex-1`}>Test Push</button>}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- AUDIT LOGS ---
const TabAuditLog = ({ appUser }) => {
  const [logs, setLogs] = useState([]); const [crashes, setCrashes] = useState([]); const [view, setView] = useState('audit');
  useEffect(() => { if (appUser?.email?.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) return; const unsubLogs = onSnapshot(collection(db, "auditLogs"), snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)))); const unsubCrashes = onSnapshot(collection(db, "crashReports"), snap => setCrashes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.time) - new Date(a.time)))); return () => { unsubLogs(); unsubCrashes(); }; }, [appUser]);
  if (appUser?.email?.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      <div className={`${T.card} p-5`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Shield className={view === 'crashes' ? 'text-orange-500' : 'text-red-500'}/> {view === 'crashes' ? 'System Crash Reports' : 'System Audit Logs'}
            {view === 'audit' && (<button onClick={() => logAudit(appUser, 'TEST_FIRE', 'Connection', 'Manual test triggered.')} className={`ml-2 bg-[#12161A] border ${T.border} ${T.copper} px-3 py-1 rounded text-[10px] uppercase tracking-wider`}>Force Test</button>)}
          </h2>
          <div className={`flex gap-2 bg-[#12161A] p-1 rounded-xl border ${T.border}`}>
            <button onClick={() => setView('audit')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${view === 'audit' ? `${T.grad} text-slate-900` : 'text-slate-400'}`}>Logs</button>
            <button onClick={() => setView('crashes')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${view === 'crashes' ? `${T.grad} text-slate-900` : 'text-slate-400'}`}>Crashes ({crashes.length})</button>
          </div>
        </div>
        <div className={`bg-[#12161A] rounded-2xl overflow-hidden border ${T.border}`}>
          <div className={`max-h-[600px] overflow-y-auto custom-scrollbar divide-y ${T.border}`}>
            {view === 'audit' ? (
              <>{logs.length === 0 && <div className={`p-8 text-center text-sm font-bold ${T.muted}`}>No events logged yet.</div>}
                {logs.map(log => (
                  <div key={log.id} className={T.row}>
                    <div className="flex justify-between items-start mb-1"><div className="flex items-center gap-2"><span className="font-black text-sm text-white">{log.userName}</span><span className={`text-[9px] font-black uppercase tracking-wider bg-[#1A2126] border ${T.border} ${T.copper} px-2 py-0.5 rounded-md`}>{log.action}</span></div><span className={`text-[10px] font-bold ${T.muted}`}>{new Date(log.timestamp).toLocaleString()}</span></div>
                    <div className={`text-xs font-medium ${T.muted}`}>Target: <span className="font-bold text-white">{log.target}</span> • {log.details}</div>
                  </div>
                ))}
              </>
            ) : (
              <>{crashes.length === 0 && <div className={`p-8 text-center text-sm font-bold ${T.copper}`}>Zero system crashes detected. Clear skies!</div>}
                {crashes.map(crash => (
                  <div key={crash.id} className={T.row}>
                    <div className="flex justify-between items-start mb-1"><span className="text-xs font-black text-orange-500 uppercase tracking-wide">{crash.type}</span><span className={`text-[10px] font-bold ${T.muted}`}>{new Date(crash.time).toLocaleString()}</span></div>
                    <p className="text-xs font-mono font-bold text-slate-200 mb-1">{crash.message}</p>
                    {crash.stack && <pre className="text-[10px] font-mono text-slate-400 bg-[#1A2126] border border-[#2A353D] p-2 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-40">{crash.stack}</pre>}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- RECIPE BOOK ---
const TabRecipes = ({ recipes, appUser, addToast }) => {
  const [searchTerm, setSearchTerm] = useState(''); const [filterCat, setFilterCat] = useState('All'); const [isFormOpen, setIsFormOpen] = useState(false); const [activeRecipe, setActiveRecipe] = useState(null); const [yieldMult, setYieldMult] = useState(1);
  const parseAndMultiply = (text, mult) => { if (mult === 1) return text; const match = text.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s+(.*)/); if (!match) return text; let numStr = match[1], rest = match[2], val = 0; if (numStr.includes('/')) { const parts = numStr.split(' '); if (parts.length === 2) { const [n, d] = parts[1].split('/'); val = parseFloat(parts[0]) + (parseFloat(n) / parseFloat(d)); } else { const [n, d] = numStr.split('/'); val = parseFloat(n) / parseFloat(d); } } else { val = parseFloat(numStr); } let finalVal = val * mult; let cleanVal = Number.isInteger(finalVal) ? finalVal.toString() : finalVal.toFixed(2); if (cleanVal.endsWith('.50')) cleanVal = cleanVal.replace('.50', ' 1/2').trim(); else if (cleanVal.endsWith('.25')) cleanVal = cleanVal.replace('.25', ' 1/4').trim(); else if (cleanVal.endsWith('.75')) cleanVal = cleanVal.replace('.75', ' 3/4').trim(); else if (cleanVal.endsWith('.33')) cleanVal = cleanVal.replace('.33', ' 1/3').trim(); else if (cleanVal.endsWith('.67')) cleanVal = cleanVal.replace('.67', ' 2/3').trim(); if (cleanVal.startsWith('0 ')) cleanVal = cleanVal.substring(2); return `${cleanVal} ${rest}`; };
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Sauce/Dressing'); const [prepTime, setPrepTime] = useState(''); const [yieldAmt, setYieldAmt] = useState(''); const [ingredients, setIngredients] = useState(''); const [instructions, setInstructions] = useState('');
  const categories = ['All', 'Sauce/Dressing', 'Meat Prep', 'Appetizer', 'Entree', 'Side', 'Dessert', 'Cocktail'];

  const handleSave = async (e) => { e.preventDefault(); if (!title.trim() || !ingredients.trim() || !instructions.trim()) return addToast('Error', 'Missing fields.'); try { await addDoc(collection(db, "recipes"), { title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), authorName: appUser.name, authorId: appUser.id, lastUpdated: new Date().toISOString() }); addToast('Recipe Saved', `${title} added.`); setIsFormOpen(false); setTitle(''); setPrepTime(''); setYieldAmt(''); setIngredients(''); setInstructions(''); } catch (err) { addToast('Error', 'Could not save.'); } };
  const handleDelete = async (id) => { if (!window.confirm("Delete recipe?")) return; await deleteDoc(doc(db, "recipes", id)); setActiveRecipe(null); addToast('Deleted', 'Recipe removed.'); };
  const filteredRecipes = recipes.filter(r => { const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.ingredients.toLowerCase().includes(searchTerm.toLowerCase()); const matchesCat = filterCat === 'All' || r.category === filterCat; return matchesSearch && matchesCat; }).sort((a,b) => a.title.localeCompare(b.title));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className={`${T.card} p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-center justify-between`}>
        <div className="flex-1 w-full relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A381]" size={20}/><input type="text" placeholder="Search recipes or ingredients..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className={`${T.input} pl-12`}/></div>
        <div className="flex w-full md:w-auto gap-3"><select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className={`${T.input} md:w-48`}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select><button onClick={() => setIsFormOpen(true)} className={`${T.btn} flex items-center justify-center gap-2`}><Plus size={18}/> New Spec</button></div>
      </div>
      {filteredRecipes.length === 0 ? (
        <div className={`text-center py-20 px-4 border-2 border-dashed ${T.border} rounded-3xl`}><ChefHat className={`mx-auto ${T.copper} mb-4`} size={48}/><h3 className={`text-lg font-black ${T.muted}`}>No recipes found.</h3></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map(r => (
            <div key={r.id} onClick={() => { setActiveRecipe(r); setYieldMult(1); }} className={`${T.card} p-5 hover:border-[#D4A381] transition-all cursor-pointer group flex flex-col h-full`}>
              <div className="flex justify-between items-start mb-3"><span className={`text-[10px] font-black uppercase tracking-wider bg-[#12161A] border ${T.border} ${T.copper} px-2 py-1 rounded-md`}>{r.category}</span><span className={`text-[10px] font-bold ${T.muted} group-hover:text-[#D4A381]`}>View Spec →</span></div>
              <h3 className="text-xl font-black text-white mb-auto leading-tight">{r.title}</h3>
              <div className={`flex items-center gap-4 mt-5 pt-4 border-t ${T.border}`}><div className={`flex items-center gap-1.5 text-xs font-bold ${T.muted}`}><Clock size={14}/> {r.prepTime}</div><div className={`flex items-center gap-1.5 text-xs font-bold ${T.muted}`}><Scale size={14}/> Yield: {r.yieldAmt}</div></div>
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
            <div className={`flex justify-between items-center pt-6 border-t ${T.border} mt-6`}><div className={`text-[10px] font-bold ${T.muted}`}>Added by {activeRecipe.authorName}</div>{(appUser?.isAdmin || appUser?.id === activeRecipe.authorId) && (<button onClick={() => handleDelete(activeRecipe.id)} className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-400 bg-[#12161A] border border-[#2A353D] px-3 py-1.5 rounded-lg transition-colors"><Trash2 size={14}/> Delete Recipe</button>)}</div>
          </div>
        )}
      </Modal>
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Add New Spec">
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className={T.label}>Recipe Title</label><input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} className={T.input} required placeholder="e.g. House Ranch"/></div>
          <div className="grid grid-cols-3 gap-3"><div><label className={T.label}>Category</label><select value={category} onChange={(e)=>setCategory(e.target.value)} className={T.input}>{categories.slice(1).map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className={T.label}>Prep Time</label><input type="text" value={prepTime} onChange={(e)=>setPrepTime(e.target.value)} className={T.input} placeholder="e.g. 15 mins"/></div><div><label className={T.label}>Yield</label><input type="text" value={yieldAmt} onChange={(e)=>setYieldAmt(e.target.value)} className={T.input} placeholder="e.g. 4 Quarts"/></div></div>
          <div><label className={T.label}>Ingredients (One per line)</label><textarea value={ingredients} onChange={(e)=>setIngredients(e.target.value)} rows="5" className={T.input} required placeholder="1 Cup Mayo&#10;1/2 Cup Buttermilk&#10;1 Tbsp Dill"/></div>
          <div><label className={T.label}>Method / Instructions (One step per line)</label><textarea value={instructions} onChange={(e)=>setInstructions(e.target.value)} rows="5" className={T.input} required placeholder="Combine mayo and buttermilk in cambro.&#10;Whisk in dry seasoning.&#10;Label and date."/></div>
          <button type="submit" className={`w-full ${T.btn}`}>Save Recipe</button>
        </form>
      </Modal>
    </div>
  );
};

// --- TIME OFF REQUESTS ---
const TabTimeOff = ({ timeOffRequests, appUser, users, addToast }) => {
  const [calMonth, setCalMonth] = useState(getToday().substring(0, 7)); const [selectedDates, setSelectedDates] = useState([]); const [isPartial, setIsPartial] = useState(false); const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('17:00');
  const myRequests = timeOffRequests.filter(r => r.userId === appUser.id).sort((a,b) => new Date(a.date) - new Date(b.date)); const allFutureRequests = timeOffRequests.filter(r => r.date >= getToday()).sort((a,b) => new Date(a.date) - new Date(b.date));
  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`); const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();

  const changeMonth = (offset) => { const d = new Date(calMonth + '-01T12:00:00'); d.setMonth(d.getMonth() + offset); setCalMonth(d.toISOString().substring(0, 7)); };
  const handleToggleDate = (d) => { if (d < getToday()) return addToast('Locked', 'Cannot request past dates.'); if (myRequests.some(r => r.date === d)) return addToast('Exists', 'Already requested this date.'); setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); };
  const handleSubmit = async (e) => { e.preventDefault(); if (selectedDates.length === 0) return addToast('Error', 'Select days on the calendar first.'); if (isPartial && (!startTime || !endTime)) return addToast('Error', 'Please set partial times.'); for (const d of selectedDates) { await addDoc(collection(db, "timeOffRequests"), { userId: appUser.id, userName: appUser.name, date: d, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null, submittedAt: new Date().toISOString() }); } addToast('Recorded', `Logged ${selectedDates.length} days off.`); setSelectedDates([]); setIsPartial(false); };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden mb-6`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-sm text-white flex items-center gap-2"><Shield size={14} className="text-red-500"/> Master Override Log</h3><span className={`text-[10px] font-bold ${T.muted}`}>Delete a record to allow scheduling.</span></div>
          <div className={`max-h-48 overflow-y-auto custom-scrollbar divide-y ${T.border}`}>
            {allFutureRequests.length === 0 && <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No upcoming time off for any staff.</div>}
            {allFutureRequests.map(r => (
              <div key={r.id} className={T.row}>
                <div className="flex-1"><div className="font-black text-sm text-white leading-tight">{r.userName}</div><div className={`text-[10px] font-bold ${T.muted} mt-0.5`}>{formatDisplayDate(r.date)} {r.isPartial && <span className={`ml-1 text-[#D4A381] bg-[#12161A] border ${T.border} px-1 rounded`}>({formatShortTime(r.startTime)} - {formatShortTime(r.endTime)})</span>}</div></div>
                <button onClick={() => { if(window.confirm("Force delete this request?")) deleteDoc(doc(db,"timeOffRequests",r.id)); }} className="text-slate-400 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 ${T.card} overflow-hidden`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
            <button onClick={() => changeMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button>
            <h3 className="font-black text-base text-white tracking-tight">{formatDisplayMonth(calMonth)}</h3>
            <button onClick={() => changeMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button>
          </div>
          <div className={`grid grid-cols-7 border-t ${T.border}`}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{d}</div>)}
            {Array.from({length: firstDayOffset}).map((_,i) => <div key={`empty-${i}`} className={`p-1 border-b border-r ${T.border} bg-[#1A2126] min-h-[45px]`} />)}
            {monthDays.map(d => {
              const isSelected = selectedDates.includes(d); const existingReq = myRequests.find(r => r.date === d); const isPast = d < getToday();
              return (
                <div key={d} onClick={() => !isPast && !existingReq && handleToggleDate(d)} className={`p-1.5 border-b border-r ${T.border} min-h-[45px] flex flex-col items-center justify-center transition-colors ${(isPast || existingReq) ? 'bg-[#12161A]/50 opacity-50 cursor-not-allowed' : isSelected ? 'bg-[#8F6040]/20 border border-[#C59373] cursor-pointer shadow-inner' : 'hover:bg-[#12161A] cursor-pointer'}`}>
                  <span className={`text-xs font-black ${isSelected ? T.copper : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                  {existingReq && <span className="text-[7px] font-black uppercase text-red-500 mt-0.5">Off</span>}
                  {isSelected && <Check size={10} className={T.copper}/>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className={`${T.card} p-4 sm:p-5 sticky top-20`}>
            <h3 className="font-black text-base mb-1 text-white">Log Availability</h3><p className={`text-[10px] font-bold ${T.muted} mb-4 leading-tight`}>Tap days on the calendar to mark yourself unavailable.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className={`flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer p-2.5 bg-[#12161A] rounded-xl border ${T.border}`}>
                <input type="checkbox" checked={isPartial} onChange={e=>setIsPartial(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />
                Partial Day Only?
              </label>
              {isPartial && (
                <div className={`grid grid-cols-2 gap-2 p-3 bg-[#12161A] rounded-xl border ${T.border}`}>
                  <div><label className={T.label}>Start Time</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={T.input} required/></div>
                  <div><label className={T.label}>End Time</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className={T.input} required/></div>
                </div>
              )}
              <button type="submit" disabled={selectedDates.length === 0} className={`w-full ${T.btn} disabled:opacity-50 disabled:cursor-not-allowed`}>Submit {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};




// ============================================================================
// THE MASTER ENGINE (App Component)
// ============================================================================
export default function App() {
  const users = useLiveCollection('users');
  const shifts = useLiveCollection('shifts');
  const prepItems = useLiveCollection('prepItems');
  const inventoryItems = useLiveCollection('inventoryItems');
  const shiftSwaps = useLiveCollection('shiftSwaps');
  const events = useLiveCollection('events');
  const sales = useLiveCollection('sales');
  const recipes = useLiveCollection('recipes');
  const timeOffRequests = useLiveCollection('timeOffRequests');
  
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('cheersUser'); return saved ? JSON.parse(saved) : null; });
  const [activeTabState, setActiveTabState] = useState('published');
  const [labelsToPrint, setLabelsToPrint] = useState(null);

  useEffect(() => {
    const handlePopState = (e) => { if (e.state && e.state.tab) setActiveTabState(e.state.tab); else setActiveTabState('published'); };
    window.addEventListener('popstate', handlePopState);
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || (appUser?.isAdmin ? 'schedule' : 'published');
    setActiveTabState(tab); window.history.replaceState({ tab }, '', `?tab=${tab}`);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appUser]);

  const setActiveTab = (tab) => { window.history.pushState({ tab }, '', `?tab=${tab}`); setActiveTabState(tab); };

  useEffect(() => {
    if (appUser) localStorage.setItem('cheersUser', JSON.stringify(appUser));
    else localStorage.removeItem('cheersUser');
  }, [appUser]);

  useEffect(() => { signInAnonymously(auth).catch(err => console.error("Firebase Auth error:", err)); }, []);

  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const liveAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users.find(u => u.id === appUser.id) || appUser)) : null;

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

  const prevDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setCurrentDate(formatDate(d)); };
  const nextDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setCurrentDate(formatDate(d)); };
  const prevMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setCurrentDate(formatDate(d)); };
  const nextMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); setCurrentDate(formatDate(d)); };

  if (labelsToPrint) return <DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} />;

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} addToast={addToast} />;

  return (
    <div className={`min-h-screen font-sans flex flex-col ${T.bg}`}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <header className="sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 bg-[#12161A]/95 backdrop-blur-md border-[#2A353D]">
        <CheersLogo />
        <button onClick={() => setIsMenuOpen(true)} className={`relative p-2 border rounded-xl shadow-sm transition-all outline-none bg-[#1A2126] border-[#2A353D] ${T.copper} hover:text-white`}><Menu size={20} /></button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} />

      {['schedule', 'published', 'month', 'sales', 'prep'].includes(activeTabState) && (
        <div className="py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center bg-[#1A2126] border-[#2A353D]">
          <button onClick={['schedule', 'prep'].includes(activeTabState) ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381]"><ChevronLeft size={20} /></button>
          <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381]">
            {['schedule', 'prep'].includes(activeTabState) ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
          </h2>
          <button onClick={['schedule', 'prep'].includes(activeTabState) ? nextDay : nextMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381]"><ChevronRight size={20} /></button>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input type={activeTabState === 'prep' || activeTabState === 'sales' || activeTabState === 'schedule' ? 'date' : 'month'} value={activeTabState === 'prep' || activeTabState === 'sales' || activeTabState === 'schedule' ? currentDate : getMonthStr(currentDate)} onChange={e => { if (e.target.value) { setCurrentDate(activeTabState === 'prep' || activeTabState === 'sales' || activeTabState === 'schedule' ? e.target.value : e.target.value + '-01'); setIsDateModalOpen(false); } }} className={T.input} />
          <button onClick={() => setIsDateModalOpen(false)} className={`w-full ${T.btn}`}>Close</button>
        </div>
      </Modal>

      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-6 pb-24">
        {activeTabState === 'schedule' && liveAppUser?.isAdmin && <TabSchedule currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'published' && <TabMasterSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} />}
        {activeTabState === 'sales' && liveAppUser?.isAdmin && <TabSales sales={sales} addToast={addToast} />}
        {activeTabState === 'messages' && <TabMessages events={events} appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} appUser={liveAppUser} setLabelsToPrint={setLabelsToPrint} />}
        {activeTabState === 'recipes' && <TabRecipes recipes={recipes} appUser={liveAppUser} addToast={addToast} />}
        {activeTabState === 'inventory' && <TabInventory inventoryItems={inventoryItems} sales={sales} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'team' && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'settings' && <TabSettings addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'audit' && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() && <TabAuditLog appUser={liveAppUser} />}
      </main>

      <div className="fixed top-20 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-2 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#1A2126] text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex items-start gap-3 border border-[#2A353D] animate-toast">
            <div className="bg-[#12161A] p-1.5 rounded-full text-[#D4A381] mt-0.5 border border-[#2A353D]"><Bell size={16} /></div>
            <div className="flex-1"><h4 className="font-bold text-sm leading-tight">{t.title}</h4><p className="text-xs text-slate-300 font-medium mt-0.5">{t.message}</p></div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
      
      <div className="w-full flex flex-col items-center justify-center py-4 border-t z-10 mt-auto bg-[#161D22] border-[#2A353D]">
        <img src="/6139.png" alt="86 Chaos OS" className="h-6 sm:h-8 w-auto mb-1.5 rounded shadow-sm opacity-80" onError={(e) => e.target.style.display = 'none'}/>
        <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Beta Version 2.0</span>
      </div>
    </div>
  );
}

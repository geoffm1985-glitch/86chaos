import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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
const useLiveCollection = (coll, restId) => {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!restId) { setData([]); return; }
    const q = query(collection(db, coll), where("restaurantId", "==", restId));
    const unsubscribe = onSnapshot(q, snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [coll, restId]);
  return data;
};
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
// ============================================================================
// BRANDING & LOGOS
// ============================================================================
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

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser }) => {
  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};

  // Standard tabs everyone gets
  tabs.push({ id: 'published', label: 'Schedule & Time Off', icon: <Clock size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> });
  
 // Restricted tabs
  if (appUser?.isAdmin || perms.schedule) tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> });
  if (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep) { tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> }); tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> }); }
  if (appUser?.isAdmin || perms.inventory) tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  if (appUser?.isAdmin || perms.team) tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  if (appUser?.isAdmin || perms.sales) tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> });
  
  // Master Admin only
  if (appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) tabs.push({ id: 'audit', label: 'Audit Logs', icon: <Shield size={18}/> });
  
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
// THE 86 CHAOS BOOT SCREEN (EMAIL/PASSWORD RESTORED)
// ============================================================================
const LoginScreen = ({ setAppUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        setAppUser({ id: firebaseUser.uid, ...userDocSnap.data() });
      } else {
        setLoginError('Login successful, but user profile is missing in the database.');
      }
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleForgotCredentials = async () => {
    if (!email) {
      setLoginError("Please type your email address into the top box first, then click Forgot Password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setLoginError("Reset link sent! Check your email inbox.");
    } catch (error) {
      setLoginError(error.message);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center bg-[#0B0E11] bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('/6136.jpg')` }}
    >
      <div className="absolute inset-0 bg-[#0B0E11]/75 backdrop-blur-[3px]"></div>
      
      <div className="relative z-10 w-full max-w-sm p-8 bg-[#161D22]/95 border border-[#2A353D] rounded-3xl shadow-2xl flex flex-col items-center animate-[slideIn_0.3s_ease-out]">
        
        {/* FIXED LOGO: Auto-scales cleanly without squishing, phantom image deleted below */}
        <img src="/6139.png" alt="86 Chaos OS Logo" className="h-24 w-auto rounded-xl shadow-lg border border-[#2A353D] mb-8 object-contain bg-[#12161A] p-2" />
        
        <form onSubmit={handleLogin} className="w-full space-y-4">
          
          {loginError && (
            <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">
              {loginError}
            </div>
          )}

          <div>
            <input 
              type="text" 
              placeholder="Email Address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" 
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" 
            />
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-2">
            Unlock System
          </button>

          {/* NEW FORGOT CREDENTIALS BUTTON */}
          <div className="pt-3 text-center">
            <button 
              type="button" 
              onClick={handleForgotCredentials}
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[#D4A381] transition-colors"
            >
              Forgot Password or Username?
            </button>
          </div>

        </form>
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
  
  // FIXED: Chronologically sorted to ensure the "Next Shift" is actually the next shift
  const myNextShift = shifts
    .filter(s => s.employeeId === appUser.id && s.date >= getToday() && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date))[0];

  const handleOfferSwap = async (shift) => {
    if (!window.confirm("Offer shift to Trade Board?")) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatShortTime(shift.startTime)}). Claim it on the Schedule!`, type: 'note', author: 'System Alert', isImportant: true });
    addToast('Posted', 'Shift sent to trade board.');
  };

  // FIXED: Scopes shifts to the selected month and sorts them chronologically
  const activeMonthShifts = shifts
    .filter(s => s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date));

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

      {/* FIXED: Full Schedule now groups by date with sticky headers */}
      {subTab === 'full-schedule' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className="bg-[#12161A] p-3 border-b border-[#2A353D] flex justify-between items-center">
            <h3 className={`text-xs font-black uppercase tracking-widest ${T.copper}`}>Active Roster</h3>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{formatDisplayMonth(currentDate)}</span>
          </div>
          <div className="divide-y divide-[#2A353D]">
            {activeMonthShifts.map((shift, index) => {
               const emp = users.find(u => u.id === shift.employeeId);
               
               // Logic to detect when the date changes so we can draw a header
               const showDivider = index === 0 || shift.date !== activeMonthShifts[index - 1].date;
               
               return (
                 <React.Fragment key={shift.id}>
                   {showDivider && (
                     <div className="bg-[#1A2126] px-3 py-1.5 border-y border-[#2A353D] text-[10px] font-black uppercase tracking-widest text-[#D4A381] sticky top-0 z-10 shadow-sm">
                       {formatDisplayDate(shift.date)}
                     </div>
                   )}
                   <div className={`${T.row} hover:bg-[#12161A]`}>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3"><img src={getAvatar(emp?.name, emp?.photoURL)} className={`w-8 h-8 rounded-full border ${T.border} object-cover`} alt="avatar"/><div><div className="text-sm font-bold text-white">{emp?.name?.split(' ')[0]}</div><div className={`text-[9px] ${T.muted} font-bold uppercase`}>{shift.role}</div></div></div>
                       <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>{formatShortTime(shift.startTime)} - {formatShortTime(shift.endTime)}</div>
                     </div>
                   </div>
                 </React.Fragment>
               )
            })}
            {activeMonthShifts.length === 0 && <div className={`p-6 text-center text-xs font-bold ${T.muted}`}>No shifts published for this period.</div>}
          </div>
        </div>
      )}

      {subTab === 'month-view' && <div className="animate-[slideIn_0.2s_ease-out]"><TabMonth currentDate={currentDate} users={users} shifts={shifts} /></div>}
      {subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} /></div>}
    </div>
  );
};

// --- Tab: Sales & Trends (Upgraded with Weekly Graph) ---
const TabSales = ({ sales, addToast }) => {
  const [date, setDate] = useState(getToday());
  const [amount, setAmount] = useState('');
  const [tag, setTag] = useState('Standard Day');
  const [weekOffset, setWeekOffset] = useState(0);

  // Logic to calculate Monday-Sunday grid
  const getStartOfWeek = (offset) => {
    const d = new Date();
    const day = d.getDay() || 7; 
    d.setDate(d.getDate() - day + 1 + (offset * 7));
    return d;
  };

  const startOfWeek = getStartOfWeek(weekOffset);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  // Filter and sum Firebase data for the selected week
  const weekSales = sales.filter(s => {
    const sd = new Date(s.date + 'T12:00:00');
    return sd >= startOfWeek && sd <= endOfWeek;
  });

  const totalWeek = weekSales.reduce((sum, s) => sum + s.amount, 0);

  // Map graph percentages
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const graphData = daysOfWeek.map((dayName, idx) => {
     const targetDate = new Date(startOfWeek);
     targetDate.setDate(targetDate.getDate() + idx);
     const dateStr = formatDate(targetDate);
     const daySale = weekSales.find(s => s.date === dateStr);
     const amt = daySale ? daySale.amount : 0;
     // Caps bar height visually based on an estimated $12k perfect day
     const heightPct = amt > 0 ? Math.min(100, Math.max(8, (amt / 12000) * 100)) + '%' : '0%';
     return { day: dayName.charAt(0), amt, h: heightPct, dateStr };
  });

  const handleSave = async (e) => {
    e.preventDefault(); if (!amount) return;
    await addDoc(collection(db, "sales"), { date, amount: parseFloat(amount), tag, loggedAt: new Date().toISOString() });
    setAmount(''); addToast('Saved', 'Daily sales logged.');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className={`${T.card} p-4 sm:p-6`}>
        
        {/* Header & Week Navigator */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-black flex items-center gap-2 text-white"><TrendingUp className={T.copper}/> Operations Ledger</h2>
          <div className="flex items-center justify-between w-full sm:w-auto gap-3 bg-[#12161A] border border-[#2A353D] rounded-xl p-1 shadow-sm">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 text-slate-400 hover:text-[#D4A381] transition-colors"><ChevronLeft size={16}/></button>
            <span className="text-[10px] font-black uppercase tracking-widest text-white px-2">
              {formatDisplayDate(formatDate(startOfWeek))} - {formatDisplayDate(formatDate(endOfWeek))}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 text-slate-400 hover:text-[#D4A381] transition-colors"><ChevronRight size={16}/></button>
          </div>
        </div>

        {/* The Copper Bar Graph */}
        <div className="h-40 flex items-end justify-between gap-1 sm:gap-2 pt-6 px-2 sm:px-4 bg-[#12161A] rounded-xl border border-[#2A353D]/60 relative mb-6">
          {graphData.map((bar, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer">
              <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A2126] border border-[#2A353D] px-2 py-1 rounded text-white text-[10px] font-bold shadow-xl z-10 pointer-events-none whitespace-nowrap">
                ${bar.amt.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </div>
              <div style={{ height: bar.h }} className={`w-full max-w-[40px] rounded-t ${bar.amt > 0 ? T.grad : 'bg-[#1A2126]'} opacity-80 hover:opacity-100 transition-all shadow-md`} />
              <span className="text-[10px] text-slate-400 mt-2 font-mono font-bold mb-2">{bar.day}</span>
            </div>
          ))}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-center mb-6">
          <div className="p-4 bg-[#12161A] rounded-xl border border-[#2A353D] shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Gross Period Sales</p><p className="text-xl sm:text-2xl font-black text-white">${totalWeek.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
          <div className="p-4 bg-[#12161A] rounded-xl border border-[#2A353D] shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Projected Target</p><p className={`text-xl sm:text-2xl font-black ${T.copper}`}>$45,000.00</p></div>
        </div>

        {/* Data Entry Form */}
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-4 border-t border-[#2A353D]">
          <div><label className={T.label}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className={T.input}/></div>
          <div><label className={T.label}>Revenue ($)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={T.input} required/></div>
          <div><label className={T.label}>Event Tag</label><select value={tag} onChange={e=>setTag(e.target.value)} className={T.input}>{EVENT_TAGS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <button className={`${T.btn} h-[46px]`}>Save Log</button>
        </form>
        
      </div>
    </div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [role, setRole] = useState('Bartender'); const [photoURL, setPhotoURL] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState({ schedule: false, inventory: false, prep: false, sales: false, team: false });
  const [editModalUser, setEditModalUser] = useState(null);
  
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role === 'Bartender' ? -1 : 1));

  const handleAdd = async (e) => { 
    e.preventDefault(); if (!name.trim() || !email.trim()) return; 
    const tPass = generateTempPass(); 
    try { 
      await addDoc(collection(db, "users"), { 
        name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), 
        password: tPass, role, isAdmin, permissions: perms, isActive: true, 
        forcePasswordChange: true, photoURL: photoURL.trim(), restaurantId: appUser.restaurantId 
      }); 
      addToast('Staff Added', `Auto-generated password: ${tPass}`); 
      setName(''); setEmail(''); setPhone(''); setPhotoURL(''); setIsAdmin(false); 
      setPerms({ schedule: false, inventory: false, prep: false, sales: false, team: false });
    } catch (err) { console.error(err); } 
  };

  const handleUpdateUser = async (e) => { 
    e.preventDefault(); if (!editModalUser.name.trim() || !editModalUser.email.trim()) return; 
    try { 
      const updates = { name: editModalUser.name.trim(), email: editModalUser.email.toLowerCase().trim(), phone: editModalUser.phone || '', role: editModalUser.role, photoURL: editModalUser.photoURL || '', isAdmin: editModalUser.isAdmin, permissions: editModalUser.permissions || {} }; 
      if (editModalUser.newPassword) { updates.password = editModalUser.newPassword; updates.forcePasswordChange = true; } 
      await updateDoc(doc(db, "users", editModalUser.id), updates); 
      addToast('Profile Updated', `${editModalUser.name}'s info has been saved.`); 
      setEditModalUser(null); 
    } catch (err) { console.error(err); addToast('Update Failed', 'Could not save profile changes.'); } 
  };

  const handleDelete = async (id) => { if (window.confirm("Remove this staff member? This cannot be undone.")) { await deleteDoc(doc(db, "users", id)); addToast('Staff Removed', 'Account permanently deleted.'); logAudit(appUser, 'DELETE_STAFF', 'Team Roster', 'Permanently removed a staff member.'); } };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Modal isOpen={!!editModalUser} onClose={() => setEditModalUser(null)} title={`Edit Profile: ${editModalUser?.name}`}>
        {editModalUser && (
          <form onSubmit={handleUpdateUser} className="space-y-3">
            <div><label className={T.label}>Name</label><input type="text" value={editModalUser.name} onChange={e => setEditModalUser({...editModalUser, name: e.target.value})} className={T.input} required /></div>
            <div><label className={T.label}>Email</label><input type="email" value={editModalUser.email} onChange={e => setEditModalUser({...editModalUser, email: e.target.value})} className={T.input} required /></div>
            <div><label className={T.label}>Phone</label><input type="tel" value={editModalUser.phone || ''} onChange={e => setEditModalUser({...editModalUser, phone: e.target.value})} className={T.input} /></div>
            <div><label className={T.label}>Role</label><select value={editModalUser.role} onChange={e => setEditModalUser({...editModalUser, role: e.target.value})} className={T.input}><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
            
            <label className="flex items-center gap-1.5 text-xs font-bold text-red-400 mt-3 cursor-pointer"><input type="checkbox" checked={editModalUser.isAdmin} onChange={e => setEditModalUser({...editModalUser, isAdmin: e.target.checked})} className="w-4 h-4 rounded border-[#2A353D] bg-[#12161A] accent-red-500" /> Full Admin (God Mode)</label>
            
            {!editModalUser.isAdmin && (
              <div className="mt-2 p-3 bg-[#12161A] border border-[#2A353D] rounded-xl flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={editModalUser.permissions?.schedule} onChange={e => setEditModalUser({...editModalUser, permissions: {...editModalUser.permissions, schedule: e.target.checked}})} className="accent-[#8F6040]"/> Schedule</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={editModalUser.permissions?.inventory} onChange={e => setEditModalUser({...editModalUser, permissions: {...editModalUser.permissions, inventory: e.target.checked}})} className="accent-[#8F6040]"/> Inventory</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={editModalUser.permissions?.prep} onChange={e => setEditModalUser({...editModalUser, permissions: {...editModalUser.permissions, prep: e.target.checked}})} className="accent-[#8F6040]"/> Recipe/Prep</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={editModalUser.permissions?.sales} onChange={e => setEditModalUser({...editModalUser, permissions: {...editModalUser.permissions, sales: e.target.checked}})} className="accent-[#8F6040]"/> Sales</label>
              </div>
            )}

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
              <div><label className={T.label}>Role</label><select value={role} onChange={e => setRole(e.target.value)} className={T.input}><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-red-400 cursor-pointer"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 rounded border-[#2A353D] bg-[#12161A] accent-red-500" /> Full Admin (God Mode)</label>
              <button type="submit" className={`w-full sm:w-auto ${T.btn}`}>Add Staff</button>
            </div>

            {!isAdmin && (
              <div className="mt-3 p-3 bg-[#12161A] border border-[#2A353D] rounded-xl flex flex-wrap gap-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 w-full mb-1">Custom Permissions:</span>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={perms.schedule} onChange={e => setPerms({...perms, schedule: e.target.checked})} className="accent-[#8F6040]"/> Schedule</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={perms.inventory} onChange={e => setPerms({...perms, inventory: e.target.checked})} className="accent-[#8F6040]"/> Inventory</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={perms.prep} onChange={e => setPerms({...perms, prep: e.target.checked})} className="accent-[#8F6040]"/> Recipe/Prep</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={perms.sales} onChange={e => setPerms({...perms, sales: e.target.checked})} className="accent-[#8F6040]"/> Sales</label>
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-300"><input type="checkbox" checked={perms.team} onChange={e => setPerms({...perms, team: e.target.checked})} className="accent-[#8F6040]"/> Team Mgmt</label>
              </div>
            )}
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
                  {isMaster && <span className={`block mt-1 text-[9px] font-black bg-[#12161A] border ${T.border} text-red-400 px-1.5 py-0.5 rounded w-max`}>Master Admin</span>}
                  {!isMaster && u.isAdmin && <span className={`block mt-1 text-[9px] font-black bg-[#12161A] border ${T.border} text-emerald-400 px-1.5 py-0.5 rounded w-max`}>Admin</span>}
                  {!isMaster && !u.isAdmin && (Object.values(u.permissions||{}).some(Boolean)) && <span className={`block mt-1 text-[9px] font-black bg-[#12161A] border ${T.border} text-[#D4A381] px-1.5 py-0.5 rounded w-max`}>Custom Access</span>}
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

// --- PREP & TASKS COMMAND CENTER ---
const TabPrep = ({ currentDate, prepItems, tasks = [], appUser, setLabelsToPrint }) => {
  const [subTab, setSubTab] = useState('prep');
  const [prepDate, setPrepDate] = useState(currentDate);

  // Prep Form State
  const [text, setText] = useState(''); const [station, setStation] = useState('Grill'); const [isMaster, setIsMaster] = useState(true);
  
  // Task Form State
  const [taskText, setTaskText] = useState(''); const [taskCat, setTaskCat] = useState('Cleaning'); const [taskFreq, setTaskFreq] = useState('daily');
  const [taskTargetDay, setTaskTargetDay] = useState('Monday'); const [taskTargetDate, setTaskTargetDate] = useState('1');

  // --- PREP LOGIC ---
  const activePrep = prepItems.filter(p => p.date === prepDate || p.isMaster);
  const handleAddPrep = async (e) => { e.preventDefault(); if(text.trim()) { await addDoc(collection(db, "prepItems"), { date: isMaster?'MASTER':prepDate, text: text.trim(), station, isCompleted: false, completedDates: {}, isMaster, qty: 1, isSelected: false }); setText(''); } };
  const togglePrepStatus = async (item) => { if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = dts[prepDate] ? null : appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); } else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null, isSelected: false }); } };
  const groupedPrep = activePrep.reduce((acc, i) => { const s = i.station || 'General'; if(!acc[s]) acc[s]=[]; acc[s].push(i); return acc; }, {});

  // --- TASK LOGIC ---
  const handleAddTask = async (e) => { e.preventDefault(); if(taskText.trim()) { await addDoc(collection(db, "tasks"), { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null, completions: {} }); setTaskText(''); } };
  
  const getTaskPeriodKey = (freq) => {
    if (freq === 'daily') return currentDate;
    if (freq === 'weekly') { const d = new Date(currentDate+'T12:00:00'); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return formatDate(d); }
    if (freq === 'monthly') return currentDate.substring(0, 7);
  };

  const toggleTaskStatus = async (task) => {
    const periodKey = getTaskPeriodKey(task.frequency);
    const updatedCompletions = { ...(task.completions || {}) };
    if (updatedCompletions[periodKey]) { delete updatedCompletions[periodKey]; } 
    else { updatedCompletions[periodKey] = { by: appUser.name, at: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; }
    await updateDoc(doc(db, "tasks", task.id), { completions: updatedCompletions });
  };

  const renderTasks = (freqFilter) => {
    const filteredTasks = tasks.filter(t => t.frequency === freqFilter);
    const grouped = filteredTasks.reduce((acc, t) => { if(!acc[t.category]) acc[t.category]=[]; acc[t.category].push(t); return acc; }, { 'Cleaning': [], 'General': [] });
    const periodKey = getTaskPeriodKey(freqFilter);

    return (
      <div className="space-y-4 mt-4">
        {appUser?.isAdmin && (
          <form onSubmit={handleAddTask} className={`${T.card} p-3 flex flex-col md:flex-row gap-2 items-center bg-[#1A2126]`}>
            <input type="text" value={taskText} onChange={e=>setTaskText(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-sm font-medium text-white" placeholder={`New ${freqFilter} task...`} required/>
            <div className="flex w-full md:w-auto gap-2">
              <select value={taskCat} onChange={e=>setTaskCat(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white"><option>Cleaning</option><option>General</option></select>
              {freqFilter === 'weekly' && <select value={taskTargetDay} onChange={e=>setTaskTargetDay(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=><option key={d}>{d}</option>)}</select>}
              {freqFilter === 'monthly' && <select value={taskTargetDate} onChange={e=>setTaskTargetDate(e.target.value)} className="w-1/2 md:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl text-white">{Array.from({length:31}).map((_,i)=><option key={i+1}>{i+1}</option>)}</select>}
              <button type="submit" className={`${T.btn} px-4 py-2 flex items-center justify-center`}><Plus size={18}/></button>
            </div>
          </form>
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
                        {appUser?.isAdmin && <button onClick={()=>deleteDoc(doc(db,"tasks",t.id))} className="text-slate-500 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
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
    <div className="max-w-3xl mx-auto space-y-4 pb-40">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-[#2A353D] mb-4">
        {['prep', 'daily', 'weekly', 'monthly'].map((tab) => (
          <button key={tab} onClick={() => { setSubTab(tab); setTaskFreq(tab); }} className={`px-5 py-2.5 text-xs font-black rounded-t-xl uppercase tracking-widest whitespace-nowrap transition-all ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>{tab === 'prep' ? 'Food Prep' : `${tab} Tasks`}</button>
        ))}
      </div>

      {subTab === 'prep' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-3 flex justify-between items-center bg-[#1A2126]`}>
            <h3 className={`font-black flex items-center gap-2 text-sm text-white uppercase tracking-wider`}><ClipboardList size={18} className={T.copper}/> Target Date:</h3>
            <input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-1.5 bg-[#12161A] border border-[#2A353D] rounded-lg outline-none text-sm font-bold text-[#D4A381] shadow-inner"/>
          </div>
          <form onSubmit={handleAddPrep} className={`${T.card} p-3 flex flex-col sm:flex-row gap-3 items-center bg-[#1A2126]`}>
            <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-2 bg-[#12161A] border border-[#2A353D] rounded-xl text-sm outline-none font-medium text-white placeholder-slate-500" placeholder="Add prep item..." required/>
            <div className="flex w-full sm:w-auto gap-3 items-center">
              <select value={station} onChange={e=>setStation(e.target.value)} className="w-full sm:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-white"><option>Grill</option><option>Fry</option><option>Salad/Cold</option><option>Expo</option><option>Prep Table</option></select>
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
                    const isDone = i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted; const doneBy = i.isMaster ? i.completedDates?.[prepDate] : i.completedBy; const qty = i.qty||1;
                    return (
                    <div key={i.id} className={`${T.row} ${i.isSelected ? 'bg-[#12161A]' : ''} flex items-center gap-2`}>
                      <input type="checkbox" checked={!!i.isSelected} onChange={async ()=> await updateDoc(doc(db, "prepItems", i.id), { isSelected: !i.isSelected })} className="w-5 h-5 rounded accent-[#8F6040] bg-[#12161A] border-[#2A353D] flex-shrink-0 cursor-pointer" />
                      <div className="flex-1 min-w-0"><span className={`text-sm font-bold ${isDone?'line-through text-slate-500':'text-white'}`}>{i.text}</span> {doneBy && <span className={`text-[9px] font-black text-emerald-500 bg-emerald-900/20 border border-emerald-900/50 px-1.5 py-0.5 rounded ml-2`}>✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-slate-500 uppercase mt-0.5">Master Task</span>}</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`flex items-center bg-[#12161A] rounded-lg border ${T.border} h-8`}><button onClick={async ()=> await updateDoc(doc(db, "prepItems", i.id), { qty: Math.max(1, qty - 1) })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">-</button><span className="w-5 text-center text-xs font-bold text-[#D4A381]">{qty}</span><button onClick={async ()=> await updateDoc(doc(db, "prepItems", i.id), { qty: qty + 1 })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">+</button></div>
                        <button onClick={()=>togglePrepStatus(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-sm ${isDone?'bg-[#12161A] text-slate-500 border border-[#2A353D]':`${T.grad} text-slate-900`}`}>{isDone ? <Repeat size={14}/> : <Check size={16}/>}</button>
                        <button onClick={()=>{ deleteDoc(doc(db,"prepItems",i.id)); }} className="text-slate-500 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ))}
          </div>
          <div className={`fixed bottom-0 left-0 right-0 p-4 bg-[#161D22] border-t ${T.border} z-50 backdrop-blur-md bg-opacity-95`}>
            <div className="max-w-2xl mx-auto flex gap-3">
              <button onClick={() => { const sel = activePrep.filter(i=>i.isSelected); if(sel.length===0)return; const toP=[]; sel.forEach(i=>{for(let j=0;j<(i.qty||1);j++)toP.push({...i, printId:`${i.id}-${j}`});}); setLabelsToPrint({items:toP, prepDate}); }} disabled={activePrep.filter(i=>i.isSelected).length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><ClipboardList size={18}/> Print Selected</button>
              <button onClick={async () => { const sel = activePrep.filter(i=>i.isSelected); for(const item of sel){ if(item.isMaster){ const dts={...(item.completedDates||{})}; dts[prepDate]=appUser.name; await updateDoc(doc(db,"prepItems",item.id),{completedDates:dts, isSelected:false}); } else await updateDoc(doc(db,"prepItems",item.id),{isCompleted:true, completedBy:appUser.name, isSelected:false}); } }} disabled={activePrep.filter(i=>i.isSelected).length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><Check size={18}/> Mark Done</button>
            </div>
          </div>
        </div>
      )}

      {subTab !== 'prep' && <div className="animate-[slideIn_0.2s_ease-out]">{renderTasks(subTab)}</div>}
    </div>
  );
};


// --- INVENTORY, VENDORS, & WASTE TRACKER (Accept Deliveries & Comm Fixes) ---
const TabInventory = ({ inventoryItems = [], vendors = [], wasteLogs = [], sales, addToast, appUser }) => {
  const [invTab, setInvTab] = useState('count'); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Inventory Form
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState('Produce'); const [newItemCode, setNewItemCode] = useState(''); const [newItemSupplier, setNewItemSupplier] = useState(''); const [newItemPackSize, setNewItemPackSize] = useState('1 CS'); const [newItemYield, setNewItemYield] = useState('1'); const [newItemPrice, setNewItemPrice] = useState(''); 
  const [editItem, setEditItem] = useState(null); 
  const [orderOverrides, setOrderOverrides] = useState({}); 
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, vendorId: null, items: [] });
  
  // Vendor Form
  const [vName, setVName] = useState(''); const [vRep, setVRep] = useState(''); const [vPhone, setVPhone] = useState(''); const [vEmail, setVEmail] = useState(''); const [vDays, setVDays] = useState([]); const [vTime, setVTime] = useState('');
  const [editVendor, setEditVendor] = useState(null);

  // Waste Form
  const [wItemId, setWItemId] = useState(''); const [wQty, setWQty] = useState(''); const [wReason, setWReason] = useState('Dropped / Spilled');

  // --- LOGIC ---
  const handleAddItem = async (e) => { e.preventDefault(); if (!newItemName.trim() || !newItemSupplier) return addToast('Error', 'Name and Vendor required.'); await addDoc(collection(db, "inventoryItems"), { name: newItemName.trim(), category: newItemCat, pfgCode: newItemCode.trim(), supplierId: newItemSupplier, packSize: newItemPackSize.trim(), yieldQty: parseInt(newItemYield) || 1, price: parseFloat(newItemPrice) || 0, parLevel: 10, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null }); setNewItemName(''); setNewItemCode(''); setNewItemPrice(''); setNewItemYield('1'); addToast('Inventory Updated', 'Item cataloged.'); };
  const handleSaveEdit = async (e) => { e.preventDefault(); await updateDoc(doc(db, "inventoryItems", editItem.id), { name: editItem.name.trim(), category: editItem.category, pfgCode: editItem.pfgCode.trim(), supplierId: editItem.supplierId, packSize: editItem.packSize, yieldQty: parseInt(editItem.yieldQty) || 1, price: parseFloat(editItem.price) || 0 }); setEditItem(null); addToast('Item Updated', 'Master file overwritten.'); };
  const updateStock = async (id, newStock) => await updateDoc(doc(db, "inventoryItems", id), { currentStock: Math.max(0, parseFloat(newStock) || 0) });
  const updatePar = async (id, newPar) => await updateDoc(doc(db, "inventoryItems", id), { parLevel: Math.max(0, parseFloat(newPar) || 0) });
  const handleOrderChange = (id, change, currentQty) => setOrderOverrides(prev => ({ ...prev, [id]: Math.max(0, currentQty + change) }));
  
  const handleAddVendor = async (e) => { e.preventDefault(); if(!vName.trim()) return; await addDoc(collection(db, "vendors"), { name: vName.trim(), rep: vRep.trim(), phone: vPhone.trim(), email: vEmail.trim(), cutOffDays: vDays, cutOffTime: vTime }); setVName(''); setVRep(''); setVPhone(''); setVEmail(''); setVDays([]); setVTime(''); addToast('Vendor Added', 'Directory updated.'); };
  const handleSaveVendorEdit = async (e) => { e.preventDefault(); await updateDoc(doc(db, "vendors", editVendor.id), { name: editVendor.name, rep: editVendor.rep, phone: editVendor.phone, email: editVendor.email, cutOffDays: editVendor.cutOffDays || [], cutOffTime: editVendor.cutOffTime || '' }); setEditVendor(null); addToast('Vendor Updated', 'Profile saved.'); };
  const toggleVendorDay = (day, isEdit = false) => { if (isEdit) { const d = editVendor.cutOffDays || []; setEditVendor({...editVendor, cutOffDays: d.includes(day) ? d.filter(x=>x!==day) : [...d, day]}); } else { setVDays(vDays.includes(day) ? vDays.filter(x=>x!==day) : [...vDays, day]); } };

  const handleLogWaste = async (e) => {
    e.preventDefault(); if(!wItemId || !wQty) return; const item = inventoryItems.find(i => i.id === wItemId); if(!item) return;
    const qtyNum = parseFloat(wQty); const yieldDivider = parseFloat(item.yieldQty) || 1; 
    const stockDeduction = qtyNum / yieldDivider; const costLost = ((item.price || 0) / yieldDivider) * qtyNum; 
    await addDoc(collection(db, "wasteLogs"), { itemId: item.id, itemName: item.name, qty: qtyNum, costLost, reason: wReason, loggedBy: appUser.name, date: getToday(), timestamp: new Date().toISOString() });
    await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: Math.max(0, item.currentStock - stockDeduction) });
    setWItemId(''); setWQty(''); addToast('Burn Logged', `$${costLost.toFixed(2)} deducted from stock.`);
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
    
    // Clean text format for reps (No Prices)
    let bodyText = items.map(i => `${i.pfgCode ? `[${i.pfgCode}] ` : ''}${i.name} (${i.packSize}) -> Qty: ${i.orderQty}`).join('\n');
    let fullText = `Order for Cheers Bar & Grill\n\n${bodyText}`;

    try { await navigator.clipboard.writeText(fullText); } catch (e) { console.log(e); }

    if (method === 'email') {
      const emailUrl = `mailto:${vendor.email}?subject=Cheers Order&body=${encodeURIComponent(fullText)}`;
      if (emailUrl.length > 2000) { addToast('📋 Order Copied!', 'List is huge! We opened email, just tap and PASTE.'); window.location.href = `mailto:${vendor.email}?subject=Cheers Order (Paste From Clipboard)`; } 
      else { window.location.href = emailUrl; }
    } else {
      const smsUrl = `sms:${vendor.phone}?body=${encodeURIComponent(fullText)}`;
      if (smsUrl.length > 2000) { addToast('📋 Order Copied!', 'List is huge! We opened SMS, just tap and PASTE.'); window.location.href = `sms:${vendor.phone}`; } 
      else { window.location.href = smsUrl; }
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

  const handleInjectPDF = async () => {
    if(!window.confirm("WARNING: This will permanently delete ALL current vendors and inventory, and inject the Full Yield-Mapped PDF data with complete pricing. Proceed?")) return;
    
    for (const v of vendors) await deleteDoc(doc(db, "vendors", v.id));
    for (const i of inventoryItems) await deleteDoc(doc(db, "inventoryItems", i.id));
    
    const newVendorRef = await addDoc(collection(db, "vendors"), { name: "Performance Food", rep: "Larry Ward", email: "lawrence.ward@pgfc.com", phone: "9204183353", cutOffDays: ["Sunday", "Wednesday"], cutOffTime: "15:30" });
    const vId = newVendorRef.id;

    const pdfItems = [
      { name: 'Bun Hamburger Gourmet Sliced 4.25" Split Top', category: 'Bakery', pfgCode: 'B1938', packSize: '6/8 Cnt', yieldQty: 48, price: 28.50, parLevel: 2 },
      { name: 'Bun Hamburger Soft Pretzel Bread 4"', category: 'Bakery', pfgCode: 'CR776', packSize: '72/3.2Oz', yieldQty: 72, price: 34.20, parLevel: 2 },
      { name: 'Bun Hoagie Italian 6" Hinged Split Top', category: 'Bakery', pfgCode: '69922', packSize: '6/6 Cnt', yieldQty: 36, price: 22.90, parLevel: 2 },
      { name: 'Dough Pizza Crust 12" Readi Rise', category: 'Bakery', pfgCode: '69432', packSize: '12/17 Oz', yieldQty: 12, price: 41.50, parLevel: 4 },
      { name: 'Pizza Crust 12" Thin Crispy Partial Baked', category: 'Bakery', pfgCode: 'EK598', packSize: '50/6.25', yieldQty: 50, price: 35.00, parLevel: 2 },
      { name: 'Bread Reuben Marble Rye 1/2" 21 Slice', category: 'Bakery', pfgCode: '23112', packSize: '6/32 Oz', yieldQty: 6, price: 28.00, parLevel: 2 },
      { name: 'Cake Chocolate Chip Cookie Dough 10"', category: 'Frozen', pfgCode: 'NW398', packSize: '2/14 Sl', yieldQty: 2, price: 40.00, parLevel: 1 },
      { name: 'Bread White Split Top 9/16" 20 Slice', category: 'Bakery', pfgCode: '21694', packSize: '6/32 Oz', yieldQty: 6, price: 22.00, parLevel: 2 },
      { name: 'Cheesecake Strawberry Lace 10" 14 Slice', category: 'Frozen', pfgCode: '21542', packSize: '2/99 Oz', yieldQty: 2, price: 45.00, parLevel: 1 },
      { name: 'Roll White Hard 5" Sliced Sheboygan Style', category: 'Bakery', pfgCode: 'NE588', packSize: '45/5 In', yieldQty: 45, price: 20.00, parLevel: 2 },
      { name: 'Bread Wheat Hearty Cracked 9/16" 14 Slice', category: 'Bakery', pfgCode: '27786', packSize: '10/24 Oz', yieldQty: 10, price: 26.00, parLevel: 2 },
      { name: 'Shell Taco Yellow Whole Grain 5"', category: 'Dry Goods', pfgCode: '50408', packSize: '8/25 Cnt', yieldQty: 200, price: 35.00, parLevel: 2 },
      { name: 'Tortilla Flour 6" Contigo', category: 'Dry Goods', pfgCode: 'DT172', packSize: '12/24Cnt', yieldQty: 288, price: 38.00, parLevel: 2 },
      { name: 'Bun Slider Hawaiian Sweet 9 Cnt', category: 'Bakery', pfgCode: 'TD860', packSize: '12/10 Oz', yieldQty: 12, price: 28.00, parLevel: 2 },
      { name: 'Cake Carrot Mommas Old Fashioned 16 Slice', category: 'Frozen', pfgCode: '21572', packSize: '2/114 Oz', yieldQty: 2, price: 50.00, parLevel: 1 },
      { name: 'Cake Limoncello Mascarpone 10" 14 Sliced', category: 'Frozen', pfgCode: 'NJ164', packSize: '2/3.5 Lb', yieldQty: 2, price: 48.00, parLevel: 1 },
      { name: 'Pie Boston Cream 10" Unsliced Thaw & Serve', category: 'Frozen', pfgCode: 'B5370', packSize: '6/33 Oz', yieldQty: 6, price: 45.00, parLevel: 1 },
      { name: 'Pie Strawberry Cream 10" Unsliced Thaw & Serve', category: 'Frozen', pfgCode: '65926', packSize: '6/27 Oz', yieldQty: 6, price: 45.00, parLevel: 1 },
      { name: 'Bun Kaiser Onion 4.25" 2.66 Oz Sliced', category: 'Bakery', pfgCode: '72890', packSize: '6/8 Cnt', yieldQty: 48, price: 25.00, parLevel: 2 },
      { name: 'Beef Ground Patty Angus 81/19', category: 'Meat', pfgCode: 'EW538', packSize: '24/7 Oz', yieldQty: 24, price: 65.00, parLevel: 4 },
      { name: 'Beef Taco Filling Fully Cooked', category: 'Meat', pfgCode: 'GW640', packSize: '4/2.5 Lb', yieldQty: 4, price: 45.00, parLevel: 2 },
      { name: 'Beef Ground Patty 5-1 78/22 Round', category: 'Meat', pfgCode: '37510', packSize: '1/15 Lb', yieldQty: 15, price: 55.00, parLevel: 2 },
      { name: 'Corned Beef Brisket Choice Raw w/ Seasoning', category: 'Meat', pfgCode: 'K4206', packSize: '2/16 Up', yieldQty: 2, price: 85.00, parLevel: 2 },
      { name: 'Sirloin Beef Tip Random', category: 'Meat', pfgCode: '25138', packSize: '2/5 Lb', yieldQty: 2, price: 65.00, parLevel: 2 },
      { name: 'Beef Chuck Roll Choice 1" Neck Off', category: 'Meat', pfgCode: 'DR382', packSize: '3/23 Lb', yieldQty: 3, price: 110.00, parLevel: 2 },
      { name: 'Beef Ground 81/19 Raw Bulk Cryo', category: 'Meat', pfgCode: '46050', packSize: '4/5 Lb', yieldQty: 4, price: 75.00, parLevel: 3 },
      { name: 'Beef Ground Patty 4-1 78/22 Round', category: 'Meat', pfgCode: '36146', packSize: '1/15 Lb', yieldQty: 15, price: 60.00, parLevel: 3 },
      { name: 'Meatball Beef Chicken .5 Ounce Cooked', category: 'Meat', pfgCode: 'CC868', packSize: '2/5 Lb', yieldQty: 2, price: 35.00, parLevel: 2 },
      { name: 'Beef Top Blade 8 Oz Steak Choice Flat Iron', category: 'Meat', pfgCode: '35068', packSize: '20/8 Oz', yieldQty: 20, price: 145.00, parLevel: 2 },
      { name: 'Beef Prime Rib Whole 9Up 2" Lip-On No Roll', category: 'Meat', pfgCode: '11464', packSize: '1/14-18#', yieldQty: 1, price: 210.00, parLevel: 1 },
      { name: 'Beverage Syrup Coca Cola Classic BIB', category: 'Dry Goods', pfgCode: '28372', packSize: '1/5 Gal', yieldQty: 1, price: 95.00, parLevel: 2 },
      { name: 'Beverage Syrup Diet Coke BIB', category: 'Dry Goods', pfgCode: '28374', packSize: '1/5 Gal', yieldQty: 1, price: 95.00, parLevel: 2 },
      { name: 'Juice Orange 100% Plastic Bottle', category: 'Dry Goods', pfgCode: '14114', packSize: '24/10 Oz', yieldQty: 24, price: 28.00, parLevel: 2 },
      { name: 'Juice Pineapple Unsweetened 100% Can', category: 'Dry Goods', pfgCode: '11170', packSize: '48/6 Oz', yieldQty: 48, price: 32.00, parLevel: 2 },
      { name: 'Juice Tomato Sacramento', category: 'Dry Goods', pfgCode: '12066', packSize: '12/46 Oz', yieldQty: 12, price: 38.00, parLevel: 2 },
      { name: 'Bitters Cocktail Aromatic Glass Bottle', category: 'Dry Goods', pfgCode: 'TB394', packSize: '24/7.2Oz', yieldQty: 24, price: 85.00, parLevel: 1 },
      { name: 'Juice Orange 100% Can', category: 'Dry Goods', pfgCode: 'A9510', packSize: '12/16 Oz', yieldQty: 12, price: 25.00, parLevel: 2 },
      { name: 'Juice Pineapple 100%', category: 'Dry Goods', pfgCode: 'TB388', packSize: '24/7.2Oz', yieldQty: 24, price: 35.00, parLevel: 2 },
      { name: 'Mushroom Tradition Pickled', category: 'Dry Goods', pfgCode: '23134', packSize: '12/16 Oz', yieldQty: 12, price: 45.00, parLevel: 2 },
      { name: 'Bean Chili Mild (Pinto Bean)', category: 'Dry Goods', pfgCode: '10792', packSize: '6/#10Can', yieldQty: 6, price: 38.00, parLevel: 2 },
      { name: 'Tomato Diced In Juice Fancy', category: 'Dry Goods', pfgCode: '11230', packSize: '6/#10Can', yieldQty: 6, price: 32.00, parLevel: 2 },
      { name: 'Cherry Maraschino No Stem Extra Large', category: 'Dry Goods', pfgCode: '16352', packSize: '4/.5 Gal', yieldQty: 4, price: 48.00, parLevel: 2 },
      { name: 'Vegetable Blend Red & Green Pepper Onion Roasted', category: 'Frozen', pfgCode: '61634', packSize: '6/2.5 Lb', yieldQty: 6, price: 38.00, parLevel: 2 },
      { name: 'Vegetable Blend Calif Broccoli Cauli Carrot', category: 'Frozen', pfgCode: '61072', packSize: '12/2 Lb', yieldQty: 12, price: 42.00, parLevel: 2 },
      { name: 'Mushroom Pieces And Stems 62 Oz', category: 'Dry Goods', pfgCode: 'CP744', packSize: '6/#10Can', yieldQty: 6, price: 45.00, parLevel: 2 },
      { name: 'Bean Green Cut 4 Sieve Fancy', category: 'Dry Goods', pfgCode: 'CP622', packSize: '6/#10Can', yieldQty: 6, price: 35.00, parLevel: 2 },
      { name: 'Pepper Jalapeno Nacho Sliced', category: 'Dry Goods', pfgCode: 'CP740', packSize: '6/#10Can', yieldQty: 6, price: 32.00, parLevel: 2 },
      { name: 'Applesauce Sweetened 4 Oz Cup', category: 'Dry Goods', pfgCode: 'P5874', packSize: '72/4 Oz', yieldQty: 72, price: 28.00, parLevel: 2 },
      { name: 'Sauerkraut Shredded Canned', category: 'Dry Goods', pfgCode: '16286', packSize: '12/27 Oz', yieldQty: 12, price: 26.00, parLevel: 2 },
      { name: 'Veg Corn Sweet Roasted W/ Black Bean Onion', category: 'Frozen', pfgCode: 'A3464', packSize: '6/2.5 Lb', yieldQty: 6, price: 40.00, parLevel: 2 },
      { name: 'Pineapple Tidbit In Juice', category: 'Dry Goods', pfgCode: '10858', packSize: '6/#10Can', yieldQty: 6, price: 45.00, parLevel: 2 },
      { name: 'Cheese Mozzarella Part Skim Provolone', category: 'Dairy', pfgCode: 'VH765', packSize: '1/5 Lb', yieldQty: 1, price: 18.00, parLevel: 4 },
      { name: 'Cheese Mozz/Prov Shredded Buffalo Milk', category: 'Dairy', pfgCode: 'NE864', packSize: '6/5 Lb', yieldQty: 6, price: 85.00, parLevel: 4 },
      { name: 'Cheese Swiss Sliced 192', category: 'Dairy', pfgCode: 'PK940', packSize: '6/24 Oz', yieldQty: 6, price: 42.00, parLevel: 2 },
      { name: 'Cheese Mozzarella Sliced Low Moisture', category: 'Dairy', pfgCode: 'FK633', packSize: '1/64 Oz', yieldQty: 1, price: 16.00, parLevel: 2 },
      { name: 'Cheese Pepper Jack Sliced', category: 'Dairy', pfgCode: 'PK912', packSize: '6/24 Oz', yieldQty: 6, price: 40.00, parLevel: 2 },
      { name: 'Sour Cream Grade A Heavy Body', category: 'Dairy', pfgCode: 'DV226', packSize: '4/5 Lb', yieldQty: 4, price: 38.00, parLevel: 2 },
      { name: 'Sour Cream Stick Cultured Portion', category: 'Dairy', pfgCode: 'DW198', packSize: '100/1 Oz', yieldQty: 100, price: 25.00, parLevel: 2 },
      { name: 'Cheese Cream Loaf', category: 'Dairy', pfgCode: '70082', packSize: '10/3 Lb', yieldQty: 10, price: 65.00, parLevel: 2 },
      { name: 'Cheese American Yellow 120 Slice', category: 'Dairy', pfgCode: '70956', packSize: '4/5 Lb', yieldQty: 4, price: 55.00, parLevel: 3 },
      { name: 'Cheese Cheddar Sharp Sliced 192', category: 'Dairy', pfgCode: 'PK934', packSize: '6/24 Oz', yieldQty: 6, price: 45.00, parLevel: 2 },
      { name: 'Cheese Parmesan Grated Packet', category: 'Dairy', pfgCode: 'HB970', packSize: '200/3.5G', yieldQty: 200, price: 28.00, parLevel: 2 },
      { name: 'Creamer Half & Half Shelf Stable', category: 'Dairy', pfgCode: 'FE644', packSize: '360/.38', yieldQty: 360, price: 22.00, parLevel: 2 },
      { name: 'Cheese Blue Crumbles', category: 'Dairy', pfgCode: 'HB984', packSize: '1/5 Lb', yieldQty: 1, price: 28.00, parLevel: 2 },
      { name: 'Cream Whipping 36% Heavy', category: 'Dairy', pfgCode: 'FL276', packSize: '12/32 Oz', yieldQty: 12, price: 45.00, parLevel: 2 },
      { name: 'Egg Shell On White Large Grade AA', category: 'Dairy', pfgCode: 'ANF42', packSize: '2/5 Lb', yieldQty: 2, price: 25.00, parLevel: 4 },
      { name: 'Cottage Cheese 4% Small Curd', category: 'Dairy', pfgCode: '69030', packSize: '6/5 Lb', yieldQty: 6, price: 38.00, parLevel: 2 },
      { name: 'Egg Liquid Scrambled Pasteurized', category: 'Dairy', pfgCode: 'PK944', packSize: '6/24 Oz', yieldQty: 6, price: 35.00, parLevel: 2 },
      { name: 'Cheese Cheddar White Sharp Sliced', category: 'Dairy', pfgCode: 'NE868', packSize: '6/5 Lb', yieldQty: 6, price: 45.00, parLevel: 2 },
      { name: 'Degreaser Fry Boil Out Piece', category: 'Supplies', pfgCode: 'DT450', packSize: '24/8 Oz', yieldQty: 24, price: 65.00, parLevel: 2 },
      { name: 'Dressing Caesar Creamy', category: 'Dry Goods', pfgCode: '28502', packSize: '2/1 Gal', yieldQty: 2, price: 38.00, parLevel: 2 },
      { name: 'Mayonnaise Heavy Duty', category: 'Dry Goods', pfgCode: '11554', packSize: '4/1 Gal', yieldQty: 4, price: 45.00, parLevel: 3 },
      { name: 'Oil Butter Alternative Liquid Zero Trans', category: 'Dry Goods', pfgCode: '71022', packSize: '3/1 Gal', yieldQty: 3, price: 48.00, parLevel: 2 },
      { name: 'Oil Soy Clear Fry Trans Fat Free', category: 'Dry Goods', pfgCode: 'DV470', packSize: '1/35 Lb', yieldQty: 1, price: 35.00, parLevel: 6 },
      { name: 'Sauce Buffalo Wing', category: 'Dry Goods', pfgCode: 'T9466', packSize: '4/1 Gal', yieldQty: 4, price: 55.00, parLevel: 3 },
      { name: 'Sauce Pizza Fully Prepared Pizzaiola', category: 'Dry Goods', pfgCode: '20558', packSize: '6/#10Can', yieldQty: 6, price: 42.00, parLevel: 4 },
      { name: 'Sauce Barbecue Sweet And Spicy', category: 'Dry Goods', pfgCode: '28160', packSize: '4/1 Gal', yieldQty: 4, price: 48.00, parLevel: 2 },
      { name: 'Sauce Roasted Garlic Parmesan', category: 'Dry Goods', pfgCode: 'D0796', packSize: '2/1 Gal', yieldQty: 2, price: 38.00, parLevel: 2 },
      { name: 'Dressing French Red Maison', category: 'Dry Goods', pfgCode: '31502', packSize: '4/1 Gal', yieldQty: 4, price: 45.00, parLevel: 2 },
      { name: 'Sauce Mango Habanero Sweet Baby Rays', category: 'Dry Goods', pfgCode: 'R9944', packSize: '4/64 Oz', yieldQty: 4, price: 52.00, parLevel: 2 },
      { name: 'Sauce Spicy Peach Wing Glaze', category: 'Dry Goods', pfgCode: 'RK012', packSize: '4/64 Oz', yieldQty: 4, price: 52.00, parLevel: 2 },
      { name: 'Sauce Thai Chili Kikkoman', category: 'Dry Goods', pfgCode: 'A8482', packSize: '4/5 Lb', yieldQty: 4, price: 48.00, parLevel: 2 },
      { name: 'Dressing Honey Mustard Dijon', category: 'Dry Goods', pfgCode: '28354', packSize: '2/1 Gal', yieldQty: 2, price: 35.00, parLevel: 2 },
      { name: 'Dressing 1000 Island', category: 'Dry Goods', pfgCode: 'CP485', packSize: '1/32 Oz', yieldQty: 1, price: 15.00, parLevel: 2 },
      { name: 'Spread Garlic Gluten Free Refrigerated', category: 'Dairy', pfgCode: '23654', packSize: '4/1 Gal', yieldQty: 4, price: 55.00, parLevel: 2 },
      { name: 'Pickle Dill Chip Crinkle Cut 1/4"', category: 'Produce', pfgCode: 'DT376', packSize: '6/2 Lb', yieldQty: 6, price: 38.00, parLevel: 2 },
      { name: 'Sauce Teriyaki Sweet Garlic Kogi', category: 'Dry Goods', pfgCode: 'VM898', packSize: '1/5 Gal', yieldQty: 1, price: 35.00, parLevel: 2 },
      { name: 'Mayonnaise Packet', category: 'Dry Goods', pfgCode: 'MP296', packSize: '4/65 Oz', yieldQty: 4, price: 35.00, parLevel: 2 },
      { name: 'Sauce Barbecue Carolina Tangy Gold', category: 'Dry Goods', pfgCode: 'CV532', packSize: '500/9 Gm', yieldQty: 500, price: 28.00, parLevel: 2 },
      { name: 'Sauce Hot Original Cholula', category: 'Dry Goods', pfgCode: '23768', packSize: '2/1 Gal', yieldQty: 2, price: 45.00, parLevel: 2 },
      { name: 'Sauce Pepper Glass Bottle Tabasco', category: 'Dry Goods', pfgCode: 'NV808', packSize: '24/5 Oz', yieldQty: 24, price: 55.00, parLevel: 2 },
      { name: 'Sauce Taco Mild Original Ortega', category: 'Dry Goods', pfgCode: '33578', packSize: '24/2 Oz', yieldQty: 24, price: 45.00, parLevel: 2 },
      { name: 'Ketchup Fancy 33% Packet', category: 'Dry Goods', pfgCode: '16170', packSize: '4/1 Gal', yieldQty: 4, price: 38.00, parLevel: 2 },
      { name: 'Dressing Blue Cheese', category: 'Dry Goods', pfgCode: '15354', packSize: '1000/9Gm', yieldQty: 1000, price: 35.00, parLevel: 2 },
      { name: 'Ketchup Red Upside Down Plastic Bottle', category: 'Dry Goods', pfgCode: '20564', packSize: '4/1 Gal', yieldQty: 4, price: 35.00, parLevel: 4 },
      { name: 'Sauce Hot Honey Shelf Stable', category: 'Dry Goods', pfgCode: 'NW290', packSize: '16/20 Oz', yieldQty: 16, price: 55.00, parLevel: 2 },
      { name: 'Olive Ripe Black Sliced Red Crushed', category: 'Dry Goods', pfgCode: 'VC198', packSize: '4/.5 Gal', yieldQty: 4, price: 45.00, parLevel: 2 },
      { name: 'Salsa Picante Medium Adelante', category: 'Dry Goods', pfgCode: 'GP788', packSize: '6/#10Can', yieldQty: 6, price: 42.00, parLevel: 2 },
      { name: 'Sauce Taco Packet Trans Fat Free', category: 'Dry Goods', pfgCode: 'FA302', packSize: '500/1 Gm', yieldQty: 500, price: 28.00, parLevel: 2 },
      { name: 'Mustard Yellow Squeeze Bottle', category: 'Dry Goods', pfgCode: 'RP442', packSize: '4/135 Oz', yieldQty: 4, price: 35.00, parLevel: 2 },
      { name: 'Sauce Worcestershire Lea & Perrins', category: 'Dry Goods', pfgCode: 'PB780', packSize: '4/27 Oz', yieldQty: 4, price: 48.00, parLevel: 2 },
      { name: 'Mustard Yellow Packet Trans Fat Free', category: 'Dry Goods', pfgCode: '22222', packSize: '24/5 Oz', yieldQty: 24, price: 25.00, parLevel: 2 },
      { name: 'Pickle Dill Kosher Deli Spear', category: 'Produce', pfgCode: 'CV530', packSize: '500/5.5G', yieldQty: 500, price: 45.00, parLevel: 2 },
      { name: 'Dressing Ranch Fat Free Packet', category: 'Dry Goods', pfgCode: 'VM900', packSize: '1/5 Gal', yieldQty: 1, price: 35.00, parLevel: 2 },
      { name: 'Ketchup Fancy 33% (Z)', category: 'Dry Goods', pfgCode: 'VH219', packSize: '1/1 Gal', yieldQty: 1, price: 28.00, parLevel: 2 },
      { name: 'Beef Italian Sliced With Gravy Frozen', category: 'Meat', pfgCode: '17208', packSize: '6/1.5Oz', yieldQty: 6, price: 55.00, parLevel: 2 },
      { name: 'Ham Smoked Cooked Water Added Shingle', category: 'Meat', pfgCode: '12050', packSize: '6/#10Can', yieldQty: 6, price: 65.00, parLevel: 2 },
      { name: 'Box Pizza 12" B Flute Kraft', category: 'Supplies', pfgCode: 'LD816', packSize: '2/5 Lb', yieldQty: 2, price: 40.00, parLevel: 4 },
      { name: 'Napkin Xpress 13X8.6 Natural 1/4 Fold', category: 'Supplies', pfgCode: 'FA426', packSize: '1/50 Cnt', yieldQty: 1, price: 45.00, parLevel: 5 },
      { name: 'Container Foam 1 Comp 9X6x3 Large', category: 'Supplies', pfgCode: 'DT312', packSize: '12/500', yieldQty: 12, price: 55.00, parLevel: 4 },
      { name: 'Glove Nitrile Large Powder Free Black', category: 'Supplies', pfgCode: 'DV238', packSize: '2100Cnt', yieldQty: 1, price: 65.00, parLevel: 6 },
      { name: 'Lid Portion Cup Plastic 3.25-5.5 Oz', category: 'Supplies', pfgCode: 'DV408', packSize: '4100Cnt', yieldQty: 1, price: 45.00, parLevel: 3 },
      { name: 'Circle Pizza 12" Corrugated Fluted', category: 'Supplies', pfgCode: 'PF360', packSize: '20/125', yieldQty: 20, price: 38.00, parLevel: 3 },
      { name: 'Cup Portion Plastic 2 Oz Translucent', category: 'Supplies', pfgCode: 'CN926', packSize: '1/100Cnt', yieldQty: 1, price: 35.00, parLevel: 3 },
      { name: 'Foil Aluminum Heavy Duty 18" Roll', category: 'Supplies', pfgCode: 'PF342', packSize: '10/250', yieldQty: 10, price: 65.00, parLevel: 2 },
      { name: 'Bag T-Sack Thank You Plastic', category: 'Supplies', pfgCode: '83226', packSize: '1/500 Ft', yieldQty: 1, price: 42.00, parLevel: 3 },
      { name: 'Box Pizza 16" B Flute Kraft', category: 'Supplies', pfgCode: 'PF116', packSize: '1/1000', yieldQty: 1, price: 55.00, parLevel: 4 },
      { name: 'Pizza Circle 16" White On Kraft', category: 'Supplies', pfgCode: 'HB952', packSize: '1/50 Cnt', yieldQty: 1, price: 35.00, parLevel: 3 },
      { name: 'Towelette Moist Blue Lemon Scent', category: 'Supplies', pfgCode: 'PC006', packSize: '1100Cnt', yieldQty: 1, price: 28.00, parLevel: 2 },
      { name: 'Cutlery Kit Plastic Knife Fork Spoon', category: 'Supplies', pfgCode: 'NJ588', packSize: '1000/1', yieldQty: 1000, price: 45.00, parLevel: 2 },
      { name: 'Bag Plastic Portion 10X8.5 Large', category: 'Supplies', pfgCode: 'P4206', packSize: '1/250Cnt', yieldQty: 1, price: 32.00, parLevel: 2 },
      { name: 'Plate Bagasse 10" 3 Compartment', category: 'Supplies', pfgCode: 'FT557', packSize: '1/250Cnt', yieldQty: 1, price: 48.00, parLevel: 2 },
      { name: 'Paper Register Thermal 3.13"x200', category: 'Supplies', pfgCode: 'B1178', packSize: '1/2000', yieldQty: 1, price: 55.00, parLevel: 2 },
      { name: 'Cup Plastic 16 Ounce Ribbed', category: 'Supplies', pfgCode: 'VL874', packSize: '4/125Cnt', yieldQty: 4, price: 45.00, parLevel: 3 },
      { name: 'Cup Portion Plastic 3.25 Ounce', category: 'Supplies', pfgCode: '28078', packSize: '1/50 Rl', yieldQty: 1, price: 38.00, parLevel: 3 },
      { name: 'Container Food Paper 8 Ounce Round', category: 'Supplies', pfgCode: 'T7354', packSize: '20/50Cnt', yieldQty: 20, price: 55.00, parLevel: 2 },
      { name: 'Cup Plastic Kid 12 Ounce Jungle', category: 'Supplies', pfgCode: 'PF346', packSize: '10/250', yieldQty: 10, price: 65.00, parLevel: 2 },
      { name: 'Film Plastic 18" Roll Cutter Box', category: 'Supplies', pfgCode: 'FC542', packSize: '20/50Cnt', yieldQty: 20, price: 38.00, parLevel: 2 },
      { name: 'Glove Nitrile Extra Large Powder Free', category: 'Supplies', pfgCode: 'DT534', packSize: '1/250Cnt', yieldQty: 1, price: 75.00, parLevel: 3 },
      { name: 'Container Foam Sandwich 1 Comp', category: 'Supplies', pfgCode: '83234', packSize: '1/2000Ft', yieldQty: 1, price: 45.00, parLevel: 3 },
      { name: 'Straw Sipper Stir 5.25" Black', category: 'Supplies', pfgCode: 'DV344', packSize: '10/100', yieldQty: 10, price: 28.00, parLevel: 2 },
      { name: 'SOUP CONTAINER LIDS Round 16-32', category: 'Supplies', pfgCode: 'EG086', packSize: '4125Cnt', yieldQty: 1, price: 35.00, parLevel: 2 },
      { name: 'SOUP CONTAINERS Paper 16 Ounce', category: 'Supplies', pfgCode: 'RE949', packSize: '1/250Cnt', yieldQty: 1, price: 45.00, parLevel: 2 },
      { name: 'Roll Register 3"x165 1 Ply White', category: 'Supplies', pfgCode: 'RB078', packSize: '10/1000', yieldQty: 10, price: 38.00, parLevel: 2 },
      { name: 'Chip Potato Kettle Prop 65', category: 'Dry Goods', pfgCode: 'FC546', packSize: '20/25Cnt', yieldQty: 20, price: 35.00, parLevel: 2 },
      { name: 'Chip Tortilla Corn White Triangle', category: 'Dry Goods', pfgCode: 'FC548', packSize: '20/25Cnt', yieldQty: 20, price: 32.00, parLevel: 2 },
      { name: 'Dressing Mix Ranch Original', category: 'Dry Goods', pfgCode: '28048', packSize: '50/1 Cnt', yieldQty: 50, price: 65.00, parLevel: 2 },
      { name: 'Seasoning Sriracha Blend', category: 'Dry Goods', pfgCode: 'VF480', packSize: '8/16 Oz', yieldQty: 8, price: 45.00, parLevel: 2 },
      { name: 'Cracker Saltine Krispy', category: 'Dry Goods', pfgCode: 'FM228', packSize: '8/16 Oz', yieldQty: 8, price: 28.00, parLevel: 2 },
      { name: 'Crouton Cube Seasoned Portion', category: 'Dry Goods', pfgCode: '12278', packSize: '18/3.2Oz', yieldQty: 18, price: 35.00, parLevel: 2 },
      { name: 'Base Soup Chicken Low Sodium', category: 'Dry Goods', pfgCode: 'V6298', packSize: '6/22 Oz', yieldQty: 6, price: 55.00, parLevel: 2 },
      { name: 'Seasoning Fajita Mix Lawrys', category: 'Dry Goods', pfgCode: '21110', packSize: '500/2Cnt', yieldQty: 500, price: 48.00, parLevel: 2 },
      { name: 'Seasoning Dill Weed', category: 'Dry Goods', pfgCode: '15010', packSize: '250/.25', yieldQty: 250, price: 35.00, parLevel: 2 },
      { name: 'Seasoning Pepper Blend Shaker', category: 'Dry Goods', pfgCode: 'LG166', packSize: '6/1 Lb', yieldQty: 6, price: 45.00, parLevel: 2 },
      { name: 'Salt Seasoning No Msg Added', category: 'Dry Goods', pfgCode: '21226', packSize: '6/8.9 Oz', yieldQty: 6, price: 32.00, parLevel: 2 },
      { name: 'Sauce Mix Cheese Cheddar Deluxe', category: 'Dry Goods', pfgCode: '27230', packSize: '6/5 Lb', yieldQty: 6, price: 65.00, parLevel: 2 },
      { name: 'Base Soup Cream', category: 'Dry Goods', pfgCode: '66772', packSize: '6/10.3Oz', yieldQty: 6, price: 48.00, parLevel: 2 },
      { name: 'Soup Tomato Condensed Can', category: 'Dry Goods', pfgCode: 'CE865', packSize: '1/24 Oz', yieldQty: 1, price: 28.00, parLevel: 2 },
      { name: 'Seasoning Blend Barbecue Rib Rub', category: 'Dry Goods', pfgCode: 'A2468', packSize: '2/5 Lb', yieldQty: 2, price: 45.00, parLevel: 2 },
      { name: 'Oregano Leaves Whole', category: 'Dry Goods', pfgCode: 'CE729', packSize: '1/22 Oz', yieldQty: 1, price: 18.00, parLevel: 2 },
      { name: 'Pepper Black Coarse Ground 20 Mesh', category: 'Dry Goods', pfgCode: '26950', packSize: '8/32 Oz', yieldQty: 8, price: 65.00, parLevel: 2 },
      { name: 'Seasoning Taco Mix', category: 'Dry Goods', pfgCode: 'CE739', packSize: '1/18 Oz', yieldQty: 1, price: 15.00, parLevel: 2 },
      { name: 'Scrubber Stainless Steel 1.75 Oz', category: 'Supplies', pfgCode: 'CE731', packSize: '1/28 Oz', yieldQty: 1, price: 28.00, parLevel: 2 },
      { name: 'Macaroni And Cheese Premium', category: 'Dairy', pfgCode: 'LG174', packSize: '6/28 Oz', yieldQty: 6, price: 55.00, parLevel: 2 },
      { name: 'Sauce Pesto Basil No Pine Nut', category: 'Frozen', pfgCode: '11132', packSize: '12/50 Oz', yieldQty: 12, price: 85.00, parLevel: 2 },
      { name: 'Sauce Chimichurri Frozen', category: 'Frozen', pfgCode: 'E6089', packSize: '1/22 Oz', yieldQty: 1, price: 25.00, parLevel: 2 },
      { name: 'Sauce Alfredo Frozen', category: 'Frozen', pfgCode: 'CE583', packSize: '1/20 Oz', yieldQty: 1, price: 22.00, parLevel: 2 },
      { name: 'Paste Chili Red Gochujang', category: 'Dry Goods', pfgCode: 'CE568', packSize: '1/1.5 Lb', yieldQty: 1, price: 18.00, parLevel: 2 },
      { name: 'Chicken Breast Strip Grilled', category: 'Meat', pfgCode: 'HC310', packSize: '2/5 Lb', yieldQty: 2, price: 45.00, parLevel: 2 },
      { name: 'Chicken Wing 1st & 2nd Joints', category: 'Meat', pfgCode: 'CK522', packSize: '4/10 Lb', yieldQty: 4, price: 125.00, parLevel: 10 },
      { name: 'Chicken Breast Fillet 5 Oz Breaded', category: 'Meat', pfgCode: 'TT606', packSize: '2/5 Lb', yieldQty: 2, price: 55.00, parLevel: 3 },
      { name: 'Turkey Breast Smoked Skinless', category: 'Meat', pfgCode: 'PW962', packSize: '2/9 Lb', yieldQty: 2, price: 65.00, parLevel: 2 },
      { name: 'Chicken Breast 4 Oz Grilled', category: 'Meat', pfgCode: 'HC234', packSize: '2/5 Lb', yieldQty: 2, price: 48.00, parLevel: 4 },
      { name: 'Chicken Diced 60% Dark 40% White', category: 'Meat', pfgCode: 'DP306', packSize: '1/10 Lb', yieldQty: 1, price: 35.00, parLevel: 2 },
      { name: 'Chicken Diced 55% White 45% Dark', category: 'Meat', pfgCode: 'DP302', packSize: '1/10 Lb', yieldQty: 1, price: 38.00, parLevel: 2 },
      { name: 'Turkey Breast Oven Roasted No Bone', category: 'Meat', pfgCode: 'DV462', packSize: '2/9 Lb', yieldQty: 2, price: 75.00, parLevel: 2 },
      { name: 'Chicken Breast Skewer 1.75 Oz', category: 'Meat', pfgCode: 'PN096', packSize: '2/40 Cnt', yieldQty: 80, price: 65.00, parLevel: 2 },
      { name: 'Boneless Wing Chicken Breast Chunk', category: 'Meat', pfgCode: '96108', packSize: '2/5 Lb', yieldQty: 2, price: 55.00, parLevel: 6 },
      { name: 'Chicken Breast Tender 58 Count', category: 'Meat', pfgCode: '59048', packSize: '2/5 Lb', yieldQty: 2, price: 58.00, parLevel: 6 },
      { name: 'Celery Stalk 6 Count 36 Size', category: 'Produce', pfgCode: '13206', packSize: '1/6 Cnt', yieldQty: 6, price: 28.00, parLevel: 2 },
      { name: 'Lemon Choice 140 Size', category: 'Produce', pfgCode: '13364', packSize: '1/12 Cnt', yieldQty: 12, price: 32.00, parLevel: 2 },
      { name: 'Lime Fresh', category: 'Produce', pfgCode: '13506', packSize: '1/12 Cnt', yieldQty: 12, price: 25.00, parLevel: 2 },
      { name: 'Pepper Bell Green Medium #1', category: 'Produce', pfgCode: '13688', packSize: '1/5 Lb', yieldQty: 1, price: 18.00, parLevel: 2 },
      { name: 'Potato Idaho Russet 80 Count', category: 'Produce', pfgCode: 'FA248', packSize: '1/50 Lb', yieldQty: 1, price: 28.00, parLevel: 3 },
      { name: 'Salad Blend Iceberg/Romaine 80/20', category: 'Produce', pfgCode: 'HB274', packSize: '4/5 Lb', yieldQty: 4, price: 35.00, parLevel: 4 },
      { name: 'Tomato Round Diced 3/8"', category: 'Produce', pfgCode: '26030', packSize: '2/2.5 Lb', yieldQty: 2, price: 32.00, parLevel: 2 },
      { name: 'Tomato Round Red 5X6 Large', category: 'Produce', pfgCode: '25840', packSize: '1/10 Lb', yieldQty: 1, price: 38.00, parLevel: 3 },
      { name: 'Lettuce Romaine Liner Fresh', category: 'Produce', pfgCode: 'FA232', packSize: '24/1 Cnt', yieldQty: 24, price: 45.00, parLevel: 2 },
      { name: 'Salad Potato Steakhouse', category: 'Produce', pfgCode: 'CA232', packSize: '2/5 Lb', yieldQty: 2, price: 28.00, parLevel: 2 },
      { name: 'Brussels Sprouts Halves Fresh', category: 'Produce', pfgCode: 'WB336', packSize: '2/5 Lb', yieldQty: 2, price: 35.00, parLevel: 2 },
      { name: 'Onion Yellow Jumbo Bag Fresh', category: 'Produce', pfgCode: 'HB404', packSize: '1/50 Lb', yieldQty: 1, price: 32.00, parLevel: 3 },
      { name: 'Mushroom White Sliced 1/4"', category: 'Produce', pfgCode: 'NH674', packSize: '1/10 Lb', yieldQty: 1, price: 25.00, parLevel: 2 },
      { name: 'Lemon Choice 165/200 Size', category: 'Produce', pfgCode: '74184', packSize: '1/12 Cnt', yieldQty: 12, price: 28.00, parLevel: 2 },
      { name: 'Potato Red Small Size B Carton', category: 'Produce', pfgCode: '27500', packSize: '1/24 Cnt', yieldQty: 24, price: 35.00, parLevel: 2 },
      { name: 'Squash Yellow Fancy Straight', category: 'Produce', pfgCode: 'JJ766', packSize: '1/50 Lb', yieldQty: 1, price: 32.00, parLevel: 2 },
      { name: 'Squash Zucchini Fancy/Med Fresh', category: 'Produce', pfgCode: '13726', packSize: '1/5 Lb', yieldQty: 1, price: 25.00, parLevel: 2 },
      { name: 'Tomato Cherry Us #1 Grade', category: 'Produce', pfgCode: 'A0238', packSize: '6/1 Pint', yieldQty: 6, price: 32.00, parLevel: 2 },
      { name: 'Basil Fresh', category: 'Produce', pfgCode: 'CK134', packSize: '1/1 Lb', yieldQty: 1, price: 15.00, parLevel: 1 },
      { name: 'Mushroom Crimini Fresh', category: 'Produce', pfgCode: '22922', packSize: '1/5 Lb', yieldQty: 1, price: 22.00, parLevel: 2 },
      { name: 'Coleslaw Creamy Sweet With Dressing', category: 'Produce', pfgCode: 'R9570', packSize: '1/5 Lb', yieldQty: 1, price: 25.00, parLevel: 2 },
      { name: 'Pepper Bell Green Chopper Fresh', category: 'Produce', pfgCode: '62538', packSize: '2/5 Lb', yieldQty: 2, price: 35.00, parLevel: 2 },
      { name: 'Cheese Parmesan Shaved', category: 'Dairy', pfgCode: 'HB358', packSize: '11.11Bu', yieldQty: 11, price: 85.00, parLevel: 2 },
      { name: 'Haddock Loin 3 Ounce No Bone', category: 'Seafood', pfgCode: 'AA826', packSize: '2/5 Lb', yieldQty: 2, price: 65.00, parLevel: 2 },
      { name: 'Salmon Loin Average 6 Ounce Pacific', category: 'Seafood', pfgCode: 'VB978', packSize: '1/10 Lb', yieldQty: 1, price: 85.00, parLevel: 2 },
      { name: 'Perch Lake European Fillet Breaded', category: 'Seafood', pfgCode: 'F2376', packSize: '1/10 Lb', yieldQty: 1, price: 75.00, parLevel: 2 },
      { name: 'Pike Walleye Fillet 2-4 Ounce', category: 'Seafood', pfgCode: 'V1062', packSize: '1/10 Lb', yieldQty: 1, price: 95.00, parLevel: 2 },
      { name: 'Shrimp White Raw P&D Tail On', category: 'Seafood', pfgCode: '53477', packSize: '1/3 Lb', yieldQty: 1, price: 45.00, parLevel: 2 },
      { name: 'Shrimp Battered Beer Round 31-35', category: 'Seafood', pfgCode: '27758', packSize: '1/11 Lb', yieldQty: 1, price: 85.00, parLevel: 2 },
      { name: 'COD Fillet 3 Ounce Beer Battered', category: 'Seafood', pfgCode: 'CR080', packSize: '5/2 Lb', yieldQty: 5, price: 65.00, parLevel: 2 },
      { name: 'Appetizer Scallop Bacon Wrapped', category: 'Seafood', pfgCode: '98924', packSize: '4/3 Lb', yieldQty: 4, price: 110.00, parLevel: 2 }
    ];

    const batchPromises = pdfItems.map(item => 
      addDoc(collection(db, "inventoryItems"), { ...item, supplierId: vId, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null })
    );
    
    await Promise.all(batchPromises);
    addToast("System Reset", "Full Master PDF injected successfully!");
  };

  const groupedItems = inventoryItems.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).reduce((acc, item) => { const cat = item.category || 'Uncategorized'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});
  const orderTotal = confirmModal.items.reduce((sum, item) => sum + ((item.price||0) * item.orderQty), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24">
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, vendorId: null, items: [] })} title={`Review Order: ${vendors.find(v=>v.id===confirmModal.vendorId)?.name}`}>
         <div className="space-y-4">
           <div className={`max-h-60 overflow-y-auto border ${T.border} rounded-xl divide-y divide-[#2A353D]`}>{confirmModal.items.map(item => (<div key={item.id} className="p-3 flex justify-between items-center bg-[#12161A]"><div><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-xs ${T.muted}`}>{item.packSize}</span><div className="text-[9px] text-[#D4A381] mt-0.5 uppercase tracking-widest font-black">Est: ${((item.price||0) * item.orderQty).toFixed(2)}</div></div><div className={`font-black ${T.copper} text-lg`}>{item.orderQty}</div></div>))}</div>
           <div className="flex justify-between items-center bg-[#1A2126] p-3 rounded-xl border border-[#2A353D]"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estimated Total</span><span className="text-lg font-black text-emerald-400">${orderTotal.toFixed(2)}</span></div>
           <div className="flex gap-2">
             {vendors.find(v=>v.id===confirmModal.vendorId)?.email && (
               <button onClick={() => executeOrder('email')} className={`flex-1 ${T.btn} flex items-center justify-center gap-2`}>✉️ Email Order</button>
             )}
             {vendors.find(v=>v.id===confirmModal.vendorId)?.phone && (
               <button onClick={() => executeOrder('sms')} className={`flex-1 ${T.btn} flex items-center justify-center gap-2`}>📱 Text Order</button>
             )}
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
          {appUser?.isAdmin && <button onClick={() => setInvTab('order')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'order' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>order</button>}
          {appUser?.isAdmin && <button onClick={() => setInvTab('manage')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'manage' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>manage</button>}
          {appUser?.isAdmin && <button onClick={() => setInvTab('vendors')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${invTab === 'vendors' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>vendors</button>}
          <button onClick={() => setInvTab('waste')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex items-center gap-1 ${invTab === 'waste' ? `bg-red-500/20 text-red-500 shadow-sm border border-red-500/50` : 'text-slate-400 hover:text-red-400'}`}>🔥 Burn Log</button>
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
                    <div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name}</div><div className={`text-[9px] font-bold ${T.muted} uppercase`}>{vendors.find(v=>v.id===item.supplierId)?.name || 'No Vendor'} • {item.packSize || '1 CS'} • YIELD: {item.yieldQty||1}</div></div>
                    <div className={`flex items-center gap-2 bg-[#12161A] p-1 rounded-md border ${T.border} flex-shrink-0`}>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>PAR</span><input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} disabled={!appUser?.isAdmin} className={`w-8 text-center font-bold border rounded py-0.5 outline-none text-xs bg-[#1A2126] text-white border-[#2A353D]`} /></div>
                      <div className={`h-6 w-px bg-[#2A353D]`}></div>
                      <div className="flex flex-col items-center"><span className={`text-[8px] font-bold ${T.muted} uppercase`}>STOCK</span><div className="flex items-center gap-1"><button onClick={() => updateStock(item.id, (item.currentStock||0) - 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white hover:text-[#D4A381]`}>-</button><span className={`w-6 text-center font-black text-sm ${(item.currentStock||0) < (item.parLevel||0) ? 'text-red-500' : 'text-white'}`}>{Number(item.currentStock||0).toFixed(2).replace(/\.00$/, '')}</span><button onClick={() => updateStock(item.id, (item.currentStock||0) + 1)} className={`w-5 h-5 flex items-center justify-center bg-[#1A2126] border ${T.border} rounded font-bold text-white hover:text-[#D4A381]`}>+</button></div></div>
                    </div>
                  </div>
                ))}</div>
            </div>
          ))}
        </div>
      )}

      {appUser?.isAdmin && invTab === 'order' && (
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
                       <button onClick={() => handleReceiveDelivery(vendor.id)} className={`w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-black py-2 rounded-xl transition-colors`}>✓ Accept & Add to Inventory</button>
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
                          <td className="p-3"><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-[9px] font-bold ${T.muted} uppercase`}>Par: {item.parLevel||0} • Case: ${Number(item.price||0).toFixed(2)}</span></td>
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

      {appUser?.isAdmin && invTab === 'manage' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">{editItem && (<form onSubmit={handleSaveEdit} className="space-y-3"><div><label className={T.label}>Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className={T.input} required /></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Vendor</label><select value={editItem.supplierId || ''} onChange={e => setEditItem({...editItem, supplierId: e.target.value})} className={T.input} required><option value="">Select...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div><div><label className={T.label}>Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className={T.input} /></div></div><div><label className={T.label}>Units per Case (Yield)</label><input type="number" min="1" value={editItem.yieldQty || 1} onChange={e => setEditItem({...editItem, yieldQty: e.target.value})} className={T.input} required /></div><button type="submit" className={`w-full ${T.btn}`}>Save Changes</button></form>)}</Modal>

          <div className="flex gap-2 mb-4">
             <button onClick={handleInjectPDF} className={`w-full flex items-center justify-center gap-2 bg-red-900/40 hover:bg-red-900 border border-red-500/50 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all`}>🔥 Nuke & Inject Untruncated Data</button>
          </div>

          <form onSubmit={handleAddItem} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-[#D4A381] tracking-widest">Add New Item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Item Name..." value={newItemName} onChange={e=>setNewItemName(e.target.value)} className={T.input} required/>
              <select value={newItemSupplier} onChange={e=>setNewItemSupplier(e.target.value)} className={T.input} required><option value="">Select Vendor...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={T.label}>Case Price ($)</label><input type="number" step="0.01" placeholder="Ex: 24.50" value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} className={T.input}/></div>
              <div><label className={T.label}>Units per Case (Yield)</label><input type="number" min="1" placeholder="Ex: 12" value={newItemYield} onChange={e=>setNewItemYield(e.target.value)} className={T.input} required/></div>
            </div>
            <button type="submit" className={`w-full ${T.btn} py-2`}><Plus size={18} className="inline mr-2"/> Add Item to Master List</button>
          </form>
          <div className={`${T.card} divide-y ${T.border}`}>{inventoryItems.map(item => (<div key={item.id} className={`${T.row} flex justify-between items-center`}><div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name} <span className="text-[10px] text-slate-500 font-normal">[{item.pfgCode}]</span></div><div className="text-[10px] text-[#D4A381] font-black uppercase mt-0.5 tracking-widest">Case: ${Number(item.price||0).toFixed(2)} • Yield: {item.yieldQty||1}</div></div><div className="flex gap-2"><button onClick={()=>setEditItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button><button onClick={()=>deleteDoc(doc(db,"inventoryItems",item.id))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
        </div>
      )}

      {appUser?.isAdmin && invTab === 'vendors' && (
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

      {invTab === 'waste' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleLogWaste} className={`${T.card} p-4 space-y-3 bg-[#1A2126]`}>
            <h3 className="text-sm font-black uppercase text-red-400 tracking-widest flex items-center gap-2">🔥 The Burn Log</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={wItemId} onChange={e=>setWItemId(e.target.value)} className={T.input} required><option value="">Select Item to Burn...</option>{inventoryItems.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
              <div><input type="number" min="1" placeholder="Qty Wasted (Individual Units)..." value={wQty} onChange={e=>setWQty(e.target.value)} className={T.input} required/><span className="text-[9px] text-slate-500 font-bold block mt-1 uppercase tracking-widest">Input individual units, not cases</span></div>
              <select value={wReason} onChange={e=>setWReason(e.target.value)} className={T.input}><option>Dropped / Spilled</option><option>Expired / Bad Quality</option><option>Cooked Incorrectly</option><option>Comped</option></select>
            </div>
            <button type="submit" className={`w-full bg-red-900/50 hover:bg-red-900 border border-red-500/50 text-white font-black tracking-widest uppercase text-sm py-2 rounded-xl transition-colors`}>Log Waste & Deduct Stock</button>
          </form>
          <div className={`${T.card} divide-y ${T.border}`}>
            <div className={T.th}><span>Today's Burn</span></div>
            {wasteLogs.filter(w=>w.date===getToday()).map(w => (<div key={w.id} className={`${T.row} flex justify-between items-center`}><div className="flex-1"> <span className="font-bold text-white text-sm block">{w.qty}x {w.itemName}</span><span className={`text-[9px] font-bold ${T.muted} uppercase`}>{w.reason} • By {w.loggedBy}</span></div><div className="font-black text-red-400 text-sm">-${w.costLost?.toFixed(2)}</div></div>))}
            {wasteLogs.filter(w=>w.date===getToday()).length === 0 && <div className="p-4 text-center text-slate-400 font-bold text-sm">No waste logged today.</div>}
          </div>
        </div>
      )}
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


// --- THE EXPANDED SETTINGS COMMAND CENTER ---
const TabSettings = ({ appUser, addToast }) => {
  const [subTab, setSubTab] = useState('profile');

  // --- Profile State ---
  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');
  const [photoURL, setPhotoURL] = useState(appUser?.photoURL || '');

  // --- Preferences State ---
  const prefs = appUser?.preferences || {};
  const [defaultTab, setDefaultTab] = useState(prefs.defaultTab || (appUser?.isAdmin ? 'schedule' : 'published'));
  const [timeFormat, setTimeFormat] = useState(prefs.timeFormat || '12h');

  // --- Notification State ---
  const [notifSchedule, setNotifSchedule] = useState(prefs.notifSchedule ?? true);
  const [notifMessages, setNotifMessages] = useState(prefs.notifMessages ?? true);
  const [notifTrades, setNotifTrades] = useState(prefs.notifTrades ?? true);
  const [notifReminders, setNotifReminders] = useState(prefs.notifReminders ?? false);
  const [reminderTime, setReminderTime] = useState(prefs.reminderTime || '120'); // Fully adjustable minutes

  // --- System Config State (Admin Only) ---
  const sys = appUser?.systemSettings || {};
  const [sysGeofence, setSysGeofence] = useState(sys.geofence ?? false);
  const [sysTips, setSysTips] = useState(sys.tips ?? true);
  const [sysTrades, setSysTrades] = useState(sys.trades ?? true);
  const [sysAutoApprove, setSysAutoApprove] = useState(sys.autoApprove ?? false);
  const [sysSameRoleTrades, setSysSameRoleTrades] = useState(sys.sameRoleTrades ?? true);
  const [sysBlockEarly, setSysBlockEarly] = useState(sys.blockEarly ?? true);
  const [sysGracePeriod, setSysGracePeriod] = useState(sys.gracePeriod || '5'); 
  const [sysOvertime, setSysOvertime] = useState(sys.overtime || '40'); 

  // --- Image Upload Engine (Kept as an option, but manual URL field is restored) ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return addToast('File Too Large', 'Please select an image under 5MB.');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotoURL(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", appUser.id), { name: name.trim(), phone: phone.trim(), photoURL: photoURL.trim() });
      addToast('Profile Saved', 'Your information has been updated.');
    } catch (err) { addToast('Error', 'Failed to save profile.'); }
  };

  const handleSavePrefs = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", appUser.id), {
        preferences: { ...prefs, defaultTab, timeFormat, notifSchedule, notifMessages, notifTrades, notifReminders, reminderTime }
      });
      addToast('Preferences Saved', 'Your personal app settings are locked in.');
    } catch (err) { addToast('Error', 'Failed to save preferences.'); }
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", appUser.id), {
        systemSettings: { geofence: sysGeofence, tips: sysTips, trades: sysTrades, autoApprove: sysAutoApprove, sameRoleTrades: sysSameRoleTrades, blockEarly: sysBlockEarly, gracePeriod: sysGracePeriod, overtime: sysOvertime }
      });
      addToast('System Saved', 'Global workspace configurations updated.');
      logAudit(appUser, 'UPDATE_SYS_CONFIG', 'Global Settings', 'Modified core workspace settings.');
    } catch (err) { addToast('Error', 'Failed to save system settings.'); }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, appUser.email);
      addToast('Email Sent', 'Check your inbox for the password reset link.');
    } catch (err) { addToast('Error', err.message); }
  };

  const Toggle = ({ label, desc, checked, onChange, disabled = false }) => (
    <label className={`flex items-center justify-between p-4 bg-[#12161A] border ${T.border} rounded-xl ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#1A2126]'} transition-colors`}>
      <div className="pr-4">
        <div className="text-sm font-bold text-white">{label}</div>
        <div className={`text-[10px] font-medium ${T.muted} mt-0.5 leading-snug`}>{desc}</div>
      </div>
      <div className="relative flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
        <div className={`block w-12 h-7 rounded-full transition-colors ${checked ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
        <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${checked ? 'transform translate-x-5' : ''}`}></div>
      </div>
    </label>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      {/* Settings Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-[#2A353D] mb-4">
        {['profile', 'preferences', 'alerts'].concat(appUser?.isAdmin ? ['workspace'] : []).map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} className={`px-5 py-2.5 text-xs font-black rounded-t-xl uppercase tracking-widest whitespace-nowrap transition-all ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab === 'workspace' ? 'Workspace (Admin)' : tab}
          </button>
        ))}
      </div>

      {/* --- SUB-TAB: MY PROFILE --- */}
      {subTab === 'profile' && (
        <div className="space-y-4">
          <div className={`${T.card} p-4 sm:p-6`}>
            
            <div className="flex items-center gap-6 mb-6 pb-6 border-b border-[#2A353D]">
              <div className="relative group cursor-pointer">
                <img src={getAvatar(name, photoURL)} alt="Profile" className={`w-20 h-20 rounded-full border-2 border-[#D4A381] object-cover shadow-lg bg-[#12161A]`} />
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Edit size={24} className="text-white" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <div>
                <h2 className="text-xl font-black text-white leading-tight">{name || 'Staff Member'}</h2>
                <div className={`text-[10px] font-black uppercase tracking-widest ${T.copper} mt-1`}>{appUser.role} {appUser.isAdmin && '| Admin'}</div>
                <label className="text-[10px] uppercase font-bold text-slate-400 mt-2 block cursor-pointer hover:text-white transition-colors">
                  Tap photo to upload <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={T.label}>Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={T.input} required /></div>
                <div><label className={T.label}>Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={T.input} /></div>
              </div>
              
              {/* RESTORED: Raw text input for Profile Picture URL */}
              <div>
                <label className={T.label}>Profile Picture URL</label>
                <input type="text" value={photoURL} onChange={e => setPhotoURL(e.target.value)} className={T.input} placeholder="Paste image link here or use the upload button above..." />
              </div>

              <div><label className={T.label}>Email Address (Cannot change)</label><input type="email" value={appUser?.email} disabled className={`${T.input} opacity-50 cursor-not-allowed`} /></div>
              <button type="submit" className={`w-full ${T.btn} py-3`}>Save Profile Data</button>
            </form>
          </div>

          <div className={`${T.card} p-4 sm:p-6 bg-red-900/10 border-red-900/50`}>
             <h3 className="text-sm font-black text-red-500 uppercase tracking-widest mb-2">Security</h3>
             <p className="text-xs text-slate-400 font-medium mb-4">Need to change your password? We will email you a secure reset link.</p>
             <button onClick={handlePasswordReset} className="w-full sm:w-auto bg-[#12161A] text-red-400 border border-red-900/50 hover:bg-red-900/30 font-bold px-6 py-2.5 rounded-xl transition-colors text-sm">Send Password Reset Email</button>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: PREFERENCES --- */}
      {subTab === 'preferences' && (
        <form onSubmit={handleSavePrefs} className={`${T.card} p-4 sm:p-6 space-y-6`}>
          <div>
            <h2 className="text-lg font-black text-white mb-4 border-b border-[#2A353D] pb-2">App Experience</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={T.label}>Default Startup Tab</label>
                <select value={defaultTab} onChange={e => setDefaultTab(e.target.value)} className={T.input}>
                  <option value="published">My Schedule</option>
                  <option value="messages">Message Board</option>
                  {appUser?.role === 'Kitchen' || appUser?.isAdmin ? <option value="prep">Prep List</option> : null}
                  {appUser?.isAdmin && <option value="schedule">Master Schedule</option>}
                  {appUser?.isAdmin && <option value="sales">Sales Ledger</option>}
                </select>
              </div>
              <div>
                <label className={T.label}>Time Format</label>
                <select value={timeFormat} onChange={e => setTimeFormat(e.target.value)} className={T.input}>
                  <option value="12h">12-Hour (AM/PM)</option>
                  <option value="24h">24-Hour (Military)</option>
                </select>
              </div>
            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn} py-3`}>Save Preferences</button>
        </form>
      )}

      {/* --- SUB-TAB: ALERTS --- */}
      {subTab === 'alerts' && (
        <form onSubmit={handleSavePrefs} className={`${T.card} p-4 sm:p-6 space-y-6`}>
          <div>
            <h2 className="text-xl font-black text-white mb-1"><Bell className={`inline mr-2 ${T.copper}`} size={20}/> Alerts & Routing</h2>
            <p className="text-xs text-slate-400 font-medium mb-4">Control how 86 Chaos pings your device.</p>
            
            <div className="space-y-3">
              <Toggle label="Schedule Publications" desc="Get alerted the exact second a new schedule goes live." checked={notifSchedule} onChange={e => setNotifSchedule(e.target.checked)} />
              <Toggle label="Shift Trade Board" desc="Notify me when someone posts a shift they need covered." checked={notifTrades} onChange={e => setNotifTrades(e.target.checked)} />
              <Toggle label="Urgent Message Board" desc="Receive push alerts for announcements marked 'Critical' by managers." checked={notifMessages} onChange={e => setNotifMessages(e.target.checked)} />
              
             <div className={`p-4 bg-[#12161A] border ${T.border} rounded-xl`}>
                
                {/* CHANGED THIS TO A LABEL SO IT IS ACTUALLY CLICKABLE! */}
                <label className="flex items-center justify-between mb-3 cursor-pointer group">
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-[#D4A381] transition-colors">Pre-Shift Reminders</div>
                    <div className={`text-[10px] font-medium ${T.muted} mt-0.5 leading-snug`}>Automated ping before your scheduled clock-in time.</div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <input type="checkbox" checked={notifReminders} onChange={e => setNotifReminders(e.target.checked)} className="sr-only" />
                    <div className={`block w-12 h-7 rounded-full transition-colors ${notifReminders ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${notifReminders ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                </label>

                {/* The Adjustable Drop-down */}
                {notifReminders && (
                  <div className="flex items-center gap-3 pt-3 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-1">Minutes Before Shift:</span>
                    <input 
                      type="number" 
                      min="1" 
                      value={reminderTime} 
                      onChange={e => setReminderTime(e.target.value)} 
                      className={`${T.input} w-24 text-center font-black`} 
                      placeholder="120"
                    />
                  </div>
                )}
              </div>
               
                {notifReminders && (
                  <div className="flex items-center gap-3 pt-3 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-1">Minutes Before Shift:</span>
                    
                    {/* RESTORED: Fully adjustable manual number input */}
                    <input 
                      type="number" 
                      min="1" 
                      value={reminderTime} 
                      onChange={e => setReminderTime(e.target.value)} 
                      className={`${T.input} w-24 text-center font-black`} 
                      placeholder="120"
                    />
                  </div>
                )}
              </div>

            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn} py-3`}>Save Alert Preferences</button>
        </form>
      )}

      {/* --- SUB-TAB: GLOBAL WORKSPACE (ADMIN ONLY) --- */}
      {subTab === 'workspace' && appUser?.isAdmin && (
        <form onSubmit={handleSaveSystem} className={`${T.card} p-4 sm:p-6 space-y-6 border-[#D4A381]/30 shadow-[0_0_15px_rgba(212,163,129,0.05)]`}>
          
          <div>
             <div className="flex items-center justify-between mb-1 border-b border-[#2A353D] pb-3">
               <h2 className="text-xl font-black text-white"><Shield className={`inline mr-2 ${T.copper}`} size={20}/> Global Config</h2>
               <span className="bg-[#12161A] text-[#D4A381] border border-[#2A353D] px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-widest">Master Controls</span>
             </div>
             
             {/* Section 1: Time Clock Rules */}
             <div className="mt-6 mb-2 text-[10px] font-black uppercase text-[#D4A381] tracking-widest">Time & Attendance Rules</div>
             <div className="space-y-3">
               <Toggle label="Strict Geofencing (Time Clock)" desc="Block employees from clocking in if they are not within the GPS boundaries of the restaurant." checked={sysGeofence} onChange={e => setSysGeofence(e.target.checked)} />
               <Toggle label="Block Early Clock-Ins" desc="Prevent staff from punching in before their grace period begins." checked={sysBlockEarly} onChange={e => setSysBlockEarly(e.target.checked)} />
               
               <div className={`p-4 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-4`}>
                 <div>
                   <div className="text-sm font-bold text-white">Clock-In Grace Period</div>
                   <div className={`text-[10px] font-medium ${T.muted} mt-0.5 leading-snug`}>How many minutes early staff can clock in.</div>
                 </div>
                 <input type="number" min="0" value={sysGracePeriod} onChange={e => setSysGracePeriod(e.target.value)} className={`${T.input} w-20 text-center font-black py-2`} />
               </div>
             </div>

             {/* Section 2: Shift Trade Rules */}
             <div className="mt-8 mb-2 text-[10px] font-black uppercase text-[#D4A381] tracking-widest">Shift Board Rules</div>
             <div className="space-y-3">
               <Toggle label="Enable Peer-to-Peer Trades" desc="Allow staff to post their shifts to the Trade Board for others to claim." checked={sysTrades} onChange={e => setSysTrades(e.target.checked)} />
               <Toggle label="Auto-Approve Shift Swaps" desc="If enabled, shift claims are approved instantly without manager intervention." checked={sysAutoApprove} disabled={!sysTrades} onChange={e => setSysAutoApprove(e.target.checked)} />
               <Toggle label="Role-Restricted Trades" desc="Staff can only claim shifts that match their assigned role (e.g., Bartenders can't claim Kitchen shifts)." checked={sysSameRoleTrades} disabled={!sysTrades} onChange={e => setSysSameRoleTrades(e.target.checked)} />
             </div>

             {/* Section 3: Payroll & Labor Rules */}
             <div className="mt-8 mb-2 text-[10px] font-black uppercase text-[#D4A381] tracking-widest">Labor & Payroll</div>
             <div className="space-y-3">
               <Toggle label="Mandatory Tip Declaration" desc="Force tipped employees to declare cash & credit tips before they can clock out." checked={sysTips} onChange={e => setSysTips(e.target.checked)} />
               <div className={`p-4 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-4`}>
                 <div>
                   <div className="text-sm font-bold text-white">Overtime Alert Threshold</div>
                   <div className={`text-[10px] font-medium ${T.muted} mt-0.5 leading-snug`}>Weekly hours before system flags a manager.</div>
                 </div>
                 <input type="number" min="1" value={sysOvertime} onChange={e => setSysOvertime(e.target.value)} className={`${T.input} w-20 text-center font-black py-2`} />
               </div>
             </div>

          </div>
          <button type="submit" className={`w-full ${T.btn} py-4 mt-6 text-lg`}>Save Global Workspace</button>
        </form>
      )}

    </div>
  );
};


// --- AUDIT LOGS TAB (Master Admin Only) ---
const TabAuditLog = ({ appUser }) => {
  const logs = useLiveCollection('auditLogs', appUser?.restaurantId);
  const sortedLogs = [...logs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      <div className={`${T.card} overflow-hidden`}>
        <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Shield className="text-red-500"/> System Audit Logs</h2>
          <span className={`bg-red-900/20 border border-red-500/50 text-red-500 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest`}>Master Admin View</span>
        </div>
        
        <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
          {sortedLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No security events logged yet.</div>}
          
          {sortedLogs.map(log => (
            <div key={log.id} className={`${T.row} flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white text-sm">{log.userName}</span>
                  <span className={`text-[9px] uppercase font-black tracking-widest bg-[#12161A] border ${T.border} text-red-400 px-2 py-0.5 rounded`}>{log.action}</span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {log.details} <span className="text-slate-500 ml-1">Target: [{log.target}]</span>
                </div>
              </div>
              <div className={`text-[10px] font-bold ${T.muted} whitespace-nowrap`}>
                {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};




// ============================================================================
// THE MASTER ENGINE (App Component)
// ============================================================================
export default function App() {
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('cheersUser'); return saved ? JSON.parse(saved) : null; });
  const rId = appUser?.restaurantId;
 

  const users = useLiveCollection('users', rId);
  const shifts = useLiveCollection('shifts', rId);
  const prepItems = useLiveCollection('prepItems', rId);
  const inventoryItems = useLiveCollection('inventoryItems', rId);
  const shiftSwaps = useLiveCollection('shiftSwaps', rId);
  const events = useLiveCollection('events', rId);
  const sales = useLiveCollection('sales', rId);
  const recipes = useLiveCollection('recipes', rId);
  const timeOffRequests = useLiveCollection('timeOffRequests', rId);
  const tasks = useLiveCollection('tasks', rId);
  const vendors = useLiveCollection('vendors', rId);
  const wasteLogs = useLiveCollection('wasteLogs', rId);

 
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
        {activeTabState === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} tasks={tasks} appUser={liveAppUser} setLabelsToPrint={setLabelsToPrint} />}
        {activeTabState === 'recipes' && <TabRecipes recipes={recipes} appUser={liveAppUser} addToast={addToast} />}
        {activeTabState === 'inventory' && <TabInventory inventoryItems={inventoryItems} vendors={vendors} wasteLogs={wasteLogs} sales={sales} addToast={addToast} appUser={liveAppUser} />}
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

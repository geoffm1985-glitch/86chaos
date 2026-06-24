import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug } from 'lucide-react';import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
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
// 1. TEST DATABASE CONFIG (Sandbox)
const testConfig = {
  apiKey: "AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw",
  authDomain: "chaos-test-d1601.firebaseapp.com",
  projectId: "chaos-test-d1601",
  storageBucket: "chaos-test-d1601.firebasestorage.app",
  messagingSenderId: "534993379994",
  appId: "1:534993379994:web:9fefb6e10309223afe7523"
};

// 2. MAIN PRODUCTION DATABASE CONFIG (Live Data)
const prodConfig = {
  apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA",
  authDomain: "cheers-34b8d.firebaseapp.com",
  projectId: "cheers-34b8d",
  storageBucket: "cheers-34b8d.firebasestorage.app",
  messagingSenderId: "762225019248",
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5",
  measurementId: "G-JFZ6EZB0E3"
};

// 3. THE SWITCHER (Automatically routes the database based on the URL)
const firebaseConfig = window.location.hostname === 'app.86chaos.com' ? prodConfig : testConfig;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let messaging = null;
try { if (typeof window !== 'undefined' && 'Notification' in window) messaging = getMessaging(app); } catch (e) { console.warn("Push not supported."); }

// --- Master Configuration ---
const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';
const EVENT_TAGS = ['Standard Day', 'Packers Game', 'Brewers Game', 'Live Music', 'Severe Weather', 'Private Catering', 'Holiday'];

// --- VERSION TRACKING ---
const CURRENT_VERSION = '3.1.1';


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
const formatShortTime = (t) => { if (!t) return ''; if(t === 'CLOSE') return 'CL'; try { let [h, m] = t.split(':'); h = parseInt(h, 10); return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h >= 12 ? 'p' : 'a'}`; } catch(e){ return t; } };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();
const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };

// --- Audit Log Helper ---
const logAudit = async (user, action, target, details) => { try { await addDoc(collection(db, "auditLogs"), { userName: user?.name || user?.email || "Unknown User", action, target, details, timestamp: new Date().toISOString(), restaurantId: user?.restaurantId }); } catch (error) { console.error("Audit failed", error); } };

// --- Global Crash Reporter ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) { window.crashCatcherAttached = true; window.onerror = (msg, url, lineNo, columnNo, error) => { addDoc(collection(db, "crashReports"), { type: 'error', message: msg, stack: error?.stack || '', time: new Date().toISOString() }).catch(()=>{}); return false; }; }

// --- HOLIDAY & TIME ENGINE ---
const HOLIDAYS = {
  // Fixed Date Holidays (Work every year)
  "01-01": "New Year's Day", "02-14": "Valentine's Day", "03-17": "St. Patrick's Day", 
  "05-05": "Cinco de Mayo", "07-04": "Independence Day", "10-31": "Halloween", 
  "11-11": "Veterans Day", "12-24": "Christmas Eve", "12-25": "Christmas Day", "12-31": "NYE",
  
  // 2026 Floating Holidays
  "2026-02-08": "Super Bowl", "2026-03-31": "Opening Day", "2026-04-05": "Easter", "2026-05-10": "Mother's Day", 
  "2026-05-25": "Memorial Day", "2026-06-21": "Father's Day", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving",

  // 2027 Floating Holidays
  "2027-02-14": "Super Bowl", "2027-03-25": "Opening Day", "2027-03-28": "Easter", "2027-05-09": "Mother's Day", 
  "2027-05-31": "Memorial Day", "2027-06-20": "Father's Day", "2027-09-06": "Labor Day", "2027-11-25": "Thanksgiving",

  // 2028 Floating Holidays
  "2028-02-13": "Super Bowl", "2028-03-30": "Opening Day", "2028-04-16": "Easter", "2028-05-14": "Mother's Day", 
  "2028-05-29": "Memorial Day", "2028-06-18": "Father's Day", "2028-09-04": "Labor Day", "2028-11-23": "Thanksgiving"
};
const getHoliday = (dateStr) => {
  if (!dateStr) return null;
  const mmdd = dateStr.substring(5);
  return HOLIDAYS[dateStr] || HOLIDAYS[mmdd] || null;
};

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

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, hasUnreadMessages }) => {
  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};

  // Standard tabs everyone gets
  tabs.push({ id: 'published', label: 'Schedule & Time Off', icon: <Clock size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/>, dot: hasUnreadMessages });
  
 // Restricted tabs
  if (appUser?.isAdmin || perms.schedule) tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> });
  if (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep) { tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> }); tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> }); }
if (appUser?.isAdmin || perms.inventory || perms.team) tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
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
                 <div className="flex items-center gap-3">
                   <div className="relative">
                     <span className={activeTab === tab.id ? 'text-slate-900' : T.copper}>{tab.icon}</span>
                     {tab.dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1A2126] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
                   </div>
                   {tab.label}
                 </div>
               </button>
             ))}
          </div>
          <div className={`p-3 border-t ${T.border} bg-[#12161A] space-y-2`}>
           <button 
  onClick={() => { window.location.href = "mailto:support@86chaos.com?subject=86chaos Beta Bug Report&body=Please describe the issue or error you found:%0D%0A%0D%0A"; }} 
  className="w-full flex items-center justify-center gap-2 py-2.5 text-orange-400 text-sm font-bold rounded-xl hover:bg-orange-900/20 transition-colors border border-orange-900/30"
>
  <Bug size={16} /> Report a Bug / Error
</button>
            <button onClick={() => { localStorage.removeItem('86chaosUser'); setAppUser(null); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 text-sm font-bold rounded-xl hover:bg-red-900/20 transition-colors"><LogOut size={16} /> Log Out</button>
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

// ============================================================================
// THE 86 CHAOS BOOT SCREEN (EMAIL/PASSWORD & FORCED RESET)
// ============================================================================
const LoginScreen = ({ setAppUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // New state to hold the user temporarily if they need to change their password
  const [pendingUser, setPendingUser] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = { id: firebaseUser.uid, ...userDocSnap.data() };
        
        // INTERCEPT: If the flag is true, hold them in the pending state
        if (userData.forcePasswordChange) {
          setPendingUser(userData);
        } else {
          setAppUser(userData); // Let them into the OS
        }
      } else {
        setLoginError('Login successful, but user profile is missing in the database.');
      }
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleForcePasswordChange = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (newPass !== confirmPass) return setLoginError('Passwords do not match.');
    if (newPass.length < 6) return setLoginError('Password must be at least 6 characters.');

    try {
      // 1. Update the secure Firebase Auth password
      await updatePassword(auth.currentUser, newPass);
      
      // 2. Flip the database flag so they are never asked again, and track the new text password
      await updateDoc(doc(db, "users", pendingUser.id), { 
        forcePasswordChange: false,
        password: newPass 
      });
      
      // 3. Unlock the system
      setAppUser({ ...pendingUser, forcePasswordChange: false, password: newPass });
      
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
        
        <img src="/6139.png" alt="86 Chaos OS Logo" className="h-24 w-auto rounded-xl shadow-lg border border-[#2A353D] mb-8 object-contain bg-[#12161A] p-2" />
        
        {/* IF THEY NEED TO CHANGE PASSWORD, RENDER THIS FORM */}
        {pendingUser ? (
          <form onSubmit={handleForcePasswordChange} className="w-full space-y-4 animate-[slideIn_0.2s_ease-out]">
            <div className="text-center mb-4">
              <h2 className="text-xl font-black text-white leading-tight">Welcome, {pendingUser.name.split(' ')[0]}!</h2>
              <p className="text-xs text-[#D4A381] font-bold mt-1 uppercase tracking-widest">Please set a permanent password.</p>
            </div>
            
            {loginError && <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">{loginError}</div>}

            <div>
              <input type="password" placeholder="New Password (min 6 chars)" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" required />
            </div>
            <div>
              <input type="password" placeholder="Confirm New Password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" required />
            </div>
            
            <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-2">
              Save & Enter OS
            </button>
          </form>
        ) : (
          /* OTHERWISE, RENDER THE STANDARD LOGIN FORM */
          <form onSubmit={handleLogin} className="w-full space-y-4">
            
            {loginError && <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold text-center">{loginError}</div>}

            <div>
              <input type="text" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" />
            </div>
            <div>
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full text-center text-lg font-bold bg-[#0B0E11] border border-[#2A353D] rounded-xl py-4 text-white focus:outline-none focus:border-[#D4A381] transition-colors shadow-inner" />
            </div>
            
            <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-2">
              Unlock System
            </button>

            <div className="pt-3 text-center">
              <button type="button" onClick={handleForgotCredentials} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[#D4A381] transition-colors">
                Forgot Password or Username?
              </button>
            </div>
          </form>
        )}

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
  
  const myMonthShifts = shifts
    .filter(s => s.employeeId === appUser.id && s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date));

  const myNextShift = shifts
    .filter(s => s.employeeId === appUser.id && s.date >= getToday() && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date))[0];

  const handleOfferSwap = async (shift) => {
    if (!window.confirm("Offer shift to Trade Board?")) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available', restaurantId: appUser.restaurantId });
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatShortTime(shift.startTime)}). Claim it on the Schedule!`, type: 'note', author: 'System Alert', isImportant: true, restaurantId: appUser.restaurantId });
    addToast('Posted', 'Shift sent to trade board.');
  };

  const activeMonthShifts = shifts
    .filter(s => s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date));

return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['my-schedule', 'full-schedule', 'month-view', 'time-off'].map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab.replace('-', ' ')}
          </button>
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

          <div className={`${T.card} overflow-hidden mt-4`}>
            <div className={T.th}>My Month Shifts</div>
            <div className={`divide-y ${T.border}`}>
              {myMonthShifts.length === 0 ? (
                <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No shifts scheduled for you this month.</div>
              ) : (
                myMonthShifts.map(s => (
                  <div key={s.id} className={`${T.row} flex justify-between items-center`}>
                    <div>
                      <div className="font-bold text-white text-sm">{formatDisplayDate(s.date)}</div>
                      <div className={`text-[9px] font-black uppercase tracking-widest ${T.copper} mt-0.5`}>{s.role}</div>
                    </div>
                    <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>
                      {formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'full-schedule' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className="bg-[#12161A] p-3 border-b border-[#2A353D] flex justify-between items-center">
            <h3 className={`text-xs font-black uppercase tracking-widest ${T.copper}`}>Active Roster</h3>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{formatDisplayMonth(currentDate)}</span>
          </div>
          <div className="divide-y divide-[#2A353D]">
            {activeMonthShifts.map((shift, index) => {
               const emp = users.find(u => u.id === shift.employeeId);
               const showDivider = index === 0 || shift.date !== activeMonthShifts[index - 1].date;
               
               return (
                 <React.Fragment key={shift.id}>
                   {showDivider && (
                     <div className="bg-[#1A2126] px-3 py-2 border-y border-[#2A353D] text-[10px] font-black uppercase tracking-widest text-[#D4A381] sticky top-0 z-10 shadow-sm flex flex-wrap items-center gap-2">
                       <span>{formatDisplayDate(shift.date)}</span>
                       {getHoliday(shift.date) && <span className="bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">{getHoliday(shift.date)}</span>}
                       {events.filter(e => e.type === 'special_event' && e.date === shift.date).map(ev => (
                         <span key={ev.id} className="bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                           {ev.title} {ev.time && `@ ${formatShortTime(ev.time)}`}
                         </span>
                       ))}
                     </div>
                   )}
                   <div className={`${T.row} hover:bg-[#12161A]`}>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3"><img src={getAvatar(emp?.name, emp?.photoURL)} className={`w-8 h-8 rounded-full border ${T.border} object-cover`} alt="avatar"/><div><div className="text-sm font-bold text-white">{emp?.name ? emp.name.split(' ')[0] : 'Unknown'}</div><div className={`text-[9px] ${T.muted} font-bold uppercase`}>{shift.role}</div></div></div>
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
{subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} events={events} /></div>}    </div>
  );
};

// --- TEAM MANAGEMENT ---
const TabTeam = ({ users, appUser, addToast }) => {
  const canManageTeam = appUser.isAdmin || appUser.permissions?.team;
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [role, setRole] = useState('Bartender'); 
  const [photoURL, setPhotoURL] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState({ schedule: false, inventory: false, prep: false, sales: false, team: false });
  const [editingUserId, setEditingUserId] = useState(null);

  const dbRoles = useLiveCollection('roles', appUser?.restaurantId);
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  const roles = dbRoles.length > 0 ? dbRoles.map(r => r.name).sort() : DEFAULT_ROLES;
  
  const generateTempPass = () => Math.random().toString(36).slice(-6);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setPhotoURL(''); setRole('Bartender'); setIsAdmin(false); setPerms({ schedule: false, inventory: false, prep: false, sales: false, team: false }); setEditingUserId(null);
  };

  const handleEditClick = (u) => {
    setName(u.name); setEmail(u.email); setPhone(u.phone || ''); setPhotoURL(u.photoURL || ''); setRole(u.role || 'Bartender'); setIsAdmin(u.isAdmin || false); setPerms(u.permissions || { schedule: false, inventory: false, prep: false, sales: false, team: false }); setEditingUserId(u.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => { 
    e.preventDefault(); if (!name.trim() || !email.trim() || !phone.trim()) return; 
    
    if (editingUserId) {
        try {
            await updateDoc(doc(db, "users", editingUserId), {
                name: name.trim(), phone: phone.trim(), role, isAdmin, permissions: perms, photoURL: photoURL.trim()
            });
            addToast('Updated', `${name}'s profile has been updated.`);
            resetForm();
        } catch(err) { addToast('Error', err.message); }
        return;
    }

    const tPass = generateTempPass(); 
    try { 
      const secondaryApp = initializeApp(firebaseConfig, "TeamBuilderApp_" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.toLowerCase().trim(), tPass);
      const newAuthUid = userCredential.user.uid;
      
      await secondaryAuth.signOut();

      await setDoc(doc(db, "users", newAuthUid), { 
        name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), 
        password: tPass, role, isAdmin, permissions: perms, isActive: true, 
        forcePasswordChange: true, photoURL: photoURL.trim(), restaurantId: appUser.restaurantId 
      }); 
      
      const welcomeMsg = `Welcome to 86chaos!\n\nAccess the 86 Chaos OS here: https://app.86chaos.com\n\nUsername: ${email.toLowerCase().trim()}\nTemporary Password: ${tPass}\n\nPlease log in and update your password.`;
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && phone.trim()) {
        const smsChar = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
        window.location.href = `sms:${phone.trim()}${smsChar}body=${encodeURIComponent(welcomeMsg)}`;
      } else {
        window.location.href = `mailto:${email.toLowerCase().trim()}?subject=${encodeURIComponent("Your 86 Chaos Account")}&body=${encodeURIComponent(welcomeMsg)}`;
      }

      addToast('Staff Added', `Account created successfully.`); 
      resetForm();
    } catch (err) { 
      console.error(err); 
      addToast('Error', err.message || 'Failed to create user account.');
    } 
  };

  const handleDeactivate = async (u) => { 
    if (!window.confirm(`Terminate ${u.name}? They will be removed from the active roster but their historical schedule data will be preserved.`)) return; 
    await updateDoc(doc(db, "users", u.id), { isActive: false }); 
    addToast('Terminated', `${u.name} deactivated.`); 
  };

  const handlePasswordReset = async (u) => {
    if (!window.confirm(`Send a password reset email to ${u.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, u.email);
      addToast('Sent', `Reset email sent to ${u.email}`);
    } catch(err) { addToast('Error', err.message); }
  };

  const activeUsers = users.filter(u => u.isActive !== false).sort((a, b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));

return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      
      {canManageTeam && (
        <form onSubmit={handleSave} className={`${T.card} p-4 sm:p-6 space-y-2`}>
          {editingUserId && (
            <div className="bg-blue-900/40 border border-blue-500/50 p-3 rounded-xl flex justify-between items-center">
              <span className="text-blue-400 font-bold text-xs uppercase tracking-widest">Editing Staff Member</span>
              <button type="button" onClick={resetForm} className="text-white text-xs font-bold hover:text-blue-300">Cancel Edit ✕</button>
            </div>
          )}
          
          <div><label className={T.label}>Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className={T.input} required placeholder="e.g. Gordon Ramsay" /></div>
          
          <div>
            <label className={T.label}>Email {editingUserId && <span className="text-slate-500 lowercase normal-case ml-1">(Cannot be changed after creation)</span>}</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={!!editingUserId} className={`${T.input} ${editingUserId ? 'opacity-50 cursor-not-allowed' : ''}`} required />
          </div>
          
          <div><label className={T.label}>Phone</label><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={T.input} required /></div>
          
          <div><label className={T.label}>Role</label><select value={role} onChange={e=>setRole(e.target.value)} className={T.input}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          
         {appUser?.isAdmin && (
            <label className="flex items-center gap-3 p-4 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="w-5 h-5 accent-red-500 bg-[#1A2126] border-[#2A353D] rounded" />
              <span className="text-sm font-black text-red-500">Full Admin (God Mode)</span>
            </label>
          )}
          
          {!isAdmin && (
            <div className="p-4 bg-[#12161A] rounded-xl border border-[#2A353D]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Custom Permissions:</p>
              <div className="flex flex-wrap gap-4">
                {Object.keys(perms).map(k => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 uppercase">
                    <input type="checkbox" checked={perms[k]} onChange={e=>setPerms({...perms, [k]: e.target.checked})} className="w-4 h-4 accent-[#8F6040] bg-[#1A2126] border-[#2A353D] rounded" /> 
                    {k.replace('team', 'team mgmt').replace('prep', 'recipe/prep')}
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <button type="submit" className={`w-full ${T.btn}`}>{editingUserId ? 'UPDATE STAFF PROFILE' : 'ADD STAFF'}</button>
        </form>
      )}
      
      <div className={`${T.card} overflow-hidden`}>
        <div className="divide-y divide-[#2A353D]">
          {activeUsers.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No active staff found.</div>}
          
          {activeUsers.map(u => (
            <div key={u.id} className="p-2.5 border-b border-[#2A353D] hover:bg-[#12161A] transition-colors flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-xs flex-shrink-0 ${u.isAdmin ? 'bg-red-900/50 border border-red-500/50' : 'bg-[#1A2126] border border-[#2A353D]'}`}>
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm leading-tight truncate">{u.name} {u.isAdmin && <span className="ml-1 text-[7px] uppercase tracking-widest bg-red-500 text-white px-1 py-0.5 rounded-sm">Admin</span>}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${u.role==='Bartender'?'bg-blue-900/20 text-blue-400 border-blue-900/50':'bg-[#12161A] text-[#D4A381] border-[#2A353D]'}`}>{u.role}</span>
                    {u.phone && <span className="text-[9px] font-bold text-slate-500 truncate">{u.phone}</span>}
                  </div>
                </div>
              </div>
              
           {(appUser?.isAdmin || (canManageTeam && !u.isAdmin)) && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handlePasswordReset(u)} className="px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-blue-400 transition-colors bg-[#12161A] rounded border border-[#2A353D]">Reset</button>
                  <button onClick={() => handleEditClick(u)} className="p-1 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded border border-[#2A353D]"><Edit size={12}/></button>
                  <button onClick={() => handleDeactivate(u)} className="p-1 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded border border-[#2A353D]"><Trash2 size={12}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

// --- MESSAGE BOARD ---
const TabMessages = ({ events, appUser, users, addToast }) => {
  const [message, setMessage] = useState(''); 
  const [replyTexts, setReplyTexts] = useState({});
  
  const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));
  
  const handleBroadcast = async (e) => { 
    e.preventDefault(); 
    if(!message.trim()) return; 
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: message.trim(), type: 'note', author: appUser.name, isImportant: false, restaurantId: appUser.restaurantId, replies: [] }); 
    setMessage(''); 
    addToast('Posted', 'Message sent.'); 
  };

  const handleReplyChange = (id, text) => {
    setReplyTexts(prev => ({ ...prev, [id]: text }));
  };

  const handleSendReply = async (e, eventId) => {
    e.preventDefault();
    const text = replyTexts[eventId];
    if (!text || !text.trim()) return;

    const targetEvent = events.find(ev => ev.id === eventId);
    const currentReplies = targetEvent.replies || [];
    const newReply = {
        id: Date.now().toString(),
        author: appUser.name,
        text: text.trim(),
        timestamp: new Date().toISOString()
    };

    try {
        await updateDoc(doc(db, "events", eventId), {
            replies: [...currentReplies, newReply]
        });
        setReplyTexts(prev => ({ ...prev, [eventId]: '' }));
    } catch (err) {
        addToast('Error', 'Could not post reply.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className={`${T.card} p-4`}><form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row gap-3"><textarea value={message} onChange={e=>setMessage(e.target.value)} className={T.input} rows="2" placeholder="Message the team..." required></textarea><button className={`${T.btn} px-8`}>Post</button></form></div>
      <div className="space-y-3">{allNotes.map(n => {
        const authorUser = users.find(u => u.name === n.author);
        return (
        <div key={n.id} className={`p-4 flex gap-3 ${n.isImportant ? `bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 rounded-2xl shadow-sm` : T.card}`}>
          {n.author !== 'System Alert' && <img src={getAvatar(n.author, authorUser?.photoURL)} className={`w-10 h-10 rounded-full border ${T.border} flex-shrink-0`} alt="pic"/>}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <span className={`font-black text-sm ${n.isImportant ? 'text-red-500' : T.copper}`}>{n.author}</span>
              <span className="text-[10px] font-bold text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
            </div>
            <p className="font-medium leading-snug text-slate-200 break-words">{n.title}</p>
            
            {/* Replies Section */}
            {(n.replies && n.replies.length > 0) && (
              <div className="space-y-2 mt-3 mb-3 pl-3 border-l-2 border-[#2A353D]">
                {n.replies.map(r => (
                  <div key={r.id} className="text-sm break-words">
                    <span className={`font-black text-[9px] uppercase tracking-widest mr-2 ${T.copper}`}>{r.author}</span>
                    <span className="text-slate-300 font-medium text-xs">{r.text}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Reply Input */}
            {n.author !== 'System Alert' && (
              <form onSubmit={(e) => handleSendReply(e, n.id)} className="flex gap-2 mt-3">
                <input 
                  type="text" 
                  placeholder="Reply..." 
                  value={replyTexts[n.id] || ''} 
                  onChange={(e) => handleReplyChange(n.id, e.target.value)} 
                  className="flex-1 bg-[#0B0E11] border border-[#2A353D] text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#D4A381] transition-colors"
                />
                <button type="submit" disabled={!replyTexts[n.id]?.trim()} className="bg-[#1A2126] text-[#D4A381] px-3 py-2 rounded-lg flex items-center justify-center border border-[#2A353D] disabled:opacity-50 hover:bg-[#2A353D] transition-colors"><Send size={14}/></button>
              </form>
            )}
          </div>
          {appUser?.isAdmin && <button onClick={() => deleteDoc(doc(db, "events", n.id))} className="text-slate-400 hover:text-red-500 self-start p-1"><Trash2 size={16}/></button>}
        </div>
      )})}</div>
    </div>
  )
};

// --- SCHEDULE MAKER (Monthly View, Single Page Desktop, Scrolling Mobile) ---
const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, addToast, appUser }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); 
  const [assignDates, setAssignDates] = useState([]); 
  const [presetShift, setPresetShift] = useState('Custom'); 
  const [startTime, setStartTime] = useState('16:00'); 
  const [endTime, setEndTime] = useState('21:00');
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false); 
  const [eventDate, setEventDate] = useState(getToday()); 
  const [eventTime, setEventTime] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  
  const monthStr = getMonthStr(currentDate); 
  const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  // FIX: Filter out deactivated employees so they don't cause ghost duplicates
  const activeRoster = users.filter(u => u.isActive !== false);

  // Sort display users for the dropdown
  const displayUsers = [...activeRoster].sort((a,b) => {
    const roleA = a.role || 'Unassigned';
    const roleB = b.role || 'Unassigned';
    const nameA = a.name || 'Unknown';
    const nameB = b.name || 'Unknown';
    return roleA === roleB ? nameA.localeCompare(nameB) : roleA.localeCompare(roleB);
  });
  
  // RESTORED: Group users by role for the categorized table
  const groupedUsers = activeRoster.reduce((acc, user) => {
    const role = user.role || 'Unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});
  const sortedRoles = Object.keys(groupedUsers).sort();

  // RESTORED: Dynamic color coding for roles
  const getRoleColors = (role, isPublished) => {
    if (!isPublished) return 'bg-slate-400 text-slate-900';
    const r = (role || '').toLowerCase();
    if (r.includes('bartender')) return 'bg-blue-400 text-blue-950';
    if (r.includes('cook') || r.includes('chef') || r.includes('kitchen')) return 'bg-orange-400 text-orange-950';
    if (r.includes('server') || r.includes('wait')) return 'bg-pink-400 text-pink-950';
    if (r.includes('host')) return 'bg-emerald-400 text-emerald-950';
    if (r.includes('manager')) return 'bg-purple-400 text-purple-950';
    if (r.includes('dish')) return 'bg-cyan-400 text-cyan-950';
    return 'bg-[#D4A381] text-slate-900'; // Default Copper
  };

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
        if (!req.isPartial) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} requested ${formatDisplayDate(d)} off.`); return; } 
        else { const reqEnd = req.endTime || '23:59'; if ((sTime < reqEnd) && (eTime > req.startTime)) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`); return; } }
      }
      validDates.push(d);
    }
    for (const d of validDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role || 'Unassigned', startTime: sTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false, restaurantId: appUser.restaurantId }); }
    setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shifts.`);
  };

  const handlePublish = async () => { if(!window.confirm("Publish schedule? Notifications will be sent.")) return; const unpub = monthShifts.filter(s => !s.isPublished); for(const s of unpub) await updateDoc(doc(db, "shifts", s.id), {isPublished:true}); addToast("Published", "Schedule is live."); logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', 'Pushed a new schedule live.'); };
  
  const handleAddEvent = async (e) => { 
    e.preventDefault(); 
    if(!eventTitle.trim()) return; 
    
    if (editingEventId) {
      await updateDoc(doc(db, "events", editingEventId), { date: eventDate, time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim() });
      addToast('Updated', 'Event modified successfully.');
    } else {
      await addDoc(collection(db, "events"), { type: 'special_event', date: eventDate, time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim(), addedBy: appUser.name, restaurantId: appUser.restaurantId }); 
      addToast('Event Added', 'Calendar updated.');
    }
    setEventTitle(''); setEventTime(''); setEventNotes(''); setEditingEventId(null); setIsEventModalOpen(false); 
  };

  const openEditEventModal = (ev) => {
    setEventDate(ev.date);
    setEventTime(ev.time || '');
    setEventTitle(ev.title || '');
    setEventNotes(ev.notes || '');
    setEditingEventId(ev.id);
    setIsEventModalOpen(true);
  };

  const openNewEventModal = () => {
    setEventDate(currentDate);
    setEventTime('');
    setEventTitle('');
    setEventNotes('');
    setEditingEventId(null);
    setIsEventModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title={editingEventId ? "Edit Special Event" : "Add Special Event"}>
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={T.label}>Date</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className={T.input} required/></div>
            <div><label className={T.label}>Time (Optional)</label><input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className={T.input}/></div>
          </div>
          <div><label className={T.label}>Event Title</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className={T.input} placeholder="e.g., Packers Playoff Game" required/></div>
          <div><label className={T.label}>Notes (Optional)</label><textarea rows="2" value={eventNotes} onChange={e=>setEventNotes(e.target.value)} className={T.input} placeholder="Extra details..."/></div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingEventId ? 'Update Event' : 'Save Event'}</button>
        </form>
      </Modal>

      <div className={`${T.card} p-2 sm:p-3 flex flex-col lg:flex-row gap-2 items-center justify-between`}>
        <div className="grid grid-cols-2 lg:flex lg:flex-nowrap gap-2 w-full lg:w-auto items-center">
          <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className={`${T.input} col-span-1 py-1.5 px-2 text-[11px] sm:text-xs h-9`}><option value="">👤 Select Staff</option>{displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select value={presetShift} onChange={handlePresetChange} className={`${T.input} col-span-1 py-1.5 px-2 text-[11px] sm:text-xs h-9`}>{SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</select>
          <div className="flex gap-2 w-full col-span-2 lg:col-span-1 lg:w-auto">
            <input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-1/2 lg:w-auto py-1.5 px-2 text-[11px] sm:text-xs h-9`}/>
            <input type="time" value={presetShift.includes('close')?'':endTime} disabled={presetShift.includes('close')} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-1/2 lg:w-auto py-1.5 px-2 text-[11px] sm:text-xs h-9 disabled:opacity-50`}/>
          </div>
          <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className={`w-full col-span-2 lg:col-span-1 lg:w-auto ${T.btn} py-1.5 px-3 text-xs h-9 disabled:opacity-50 flex items-center justify-center`}>Assign ({assignDates.length})</button>
        </div>
        <div className="flex w-full lg:w-auto gap-2">
          <button onClick={handlePublish} className={`flex-1 lg:flex-none ${T.btnAlt} py-1.5 text-xs h-9 flex items-center justify-center`}>Publish</button>
          <button onClick={openNewEventModal} className={`flex-1 lg:flex-none ${T.btnAlt} border-[#D4A381] text-[#D4A381] py-1.5 text-xs h-9 flex items-center justify-center`}>+ Event</button>
        </div>
      </div>

      <div className={`${T.card} w-full overflow-hidden`}>
        <div className="overflow-x-auto w-full no-scrollbar">
          <table className="w-full text-left text-[10px] border-collapse table-fixed min-w-[1200px] xl:min-w-full">
            <thead>
              <tr className="bg-[#12161A] border-b border-[#2A353D]">
                <th className={`p-1 sm:p-2 font-bold bg-[#12161A] sticky left-0 z-20 w-16 sm:w-24 border-r border-[#2A353D] ${T.copper} truncate`}>Staff</th>
                {monthDays.map(d => {
                  const holiday = getHoliday(d);
                  const dayEvents = monthEvents.filter(e => e.date === d);
                  const hasAlert = holiday || dayEvents.length > 0;
                  
                  return (
                  <th key={d} className={`p-0.5 sm:p-1 text-center border-r border-[#2A353D] align-top relative group cursor-help ${new Date(d+'T12:00').getDay()%6===0?'bg-[#1A2126]':''}`}>
                    <div className={`font-bold uppercase text-[8px] sm:text-[9px] ${T.muted}`}>{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'narrow'})}</div>
                    <div className={`text-xs sm:text-sm font-black mt-0.5 ${hasAlert ? (holiday ? 'text-amber-400' : 'text-red-400') : 'text-white'}`}>
                      {parseInt(d.split('-')[2])}
                    </div>
                    
                    {/* Desktop Hover Tooltip for Holidays/Events */}
                    {hasAlert && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-[#1A2126] border border-[#D4A381] text-white text-[10px] p-2 rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none transition-all">
                        {holiday && <div className="text-amber-400 font-black mb-1 leading-tight">{holiday}</div>}
                        {dayEvents.map(ev => (
                          <div key={ev.id} className="text-red-400 font-bold leading-tight mt-1 border-t border-[#2A353D] pt-1">
                            {ev.title} {ev.time && <span className="block text-white opacity-80">{formatShortTime(ev.time)}</span>}
                            {ev.notes && <span className="block text-slate-300 font-normal mt-0.5">{ev.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </th>
                )})}
              </tr>
            </thead>
         <tbody className="divide-y divide-[#2A353D]">
              {sortedRoles.map(role => (
                <React.Fragment key={`role-group-${role}`}>
                  <tr className="bg-[#1A2126]">
                    <td colSpan={monthDays.length + 1} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${T.copper} border-b border-[#2A353D] sticky left-0 z-10`}>
                      {role}
                    </td>
                  </tr>
                  {groupedUsers[role].sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(u => (
                    <tr key={u.id} className={selectedEmp===u.id?'bg-[#12161A]/50':''}>
                      <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`px-2 py-1 text-xs font-bold sticky left-0 z-10 border-r border-[#2A353D] cursor-pointer truncate shadow-sm ${selectedEmp===u.id?`${T.grad} text-slate-900`:'bg-[#1A2126] text-white'}`}>{u.name.split(' ')[0]}</td>
                      {monthDays.map(d => {
                        const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); 
                        const req = timeOffRequests.find(r=>r.date===d&&r.userId===u.id); 
                        const sel = assignDates.includes(d) && selectedEmp===u.id;
                        return (
                        <td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-[#2A353D] cursor-pointer transition-all align-top h-7 sm:h-8 ${sel?'bg-[#8F6040] outline outline-2 outline-[#D4A381] shadow-inner z-0 relative':'hover:bg-[#12161A]'}`}>
                        <div className="flex flex-col gap-[1px] w-full justify-start overflow-hidden">
                          {req && !req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-red-400 bg-red-900/40 uppercase tracking-tighter" title="Requested Off">Off</div>}
                          {req && req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-amber-400 bg-amber-900/40 uppercase tracking-tighter truncate" title={`Off: ${formatShortTime(req.startTime)}-${formatShortTime(req.endTime)}`}>{formatShortTime(req.startTime)}-{formatShortTime(req.endTime)}</div>}
                          {shift && <div className={`w-full rounded font-bold text-[7px] sm:text-[8px] py-0.5 text-center truncate ${getRoleColors(shift.role, shift.isPublished)}`} title={`${formatShortTime(shift.startTime)} - ${formatShortTime(shift.endTime)}`}>{formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}</div>}
                        </div>
                      </td>)
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Event Ledger underneath for clear visibility */}
      <div className={`${T.card} overflow-hidden`}>
        <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
          <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Star className={T.copper}/> Monthly Events Ledger</h3>
        </div>
        <div className={`divide-y ${T.border}`}>
          {monthEvents.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No special events scheduled this month.</div>}
          {monthEvents.map(ev => (
            <div key={ev.id} className={`${T.row} flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
              <div className="flex items-start sm:items-center gap-4">
                <div className={`bg-[#12161A] border ${T.border} ${T.copper} font-black text-center rounded-xl p-2 w-14 shadow-sm flex-shrink-0`}>
                  <div className="text-[10px] uppercase">{new Date(ev.date+'T12:00').toLocaleDateString('en-US',{month:'short'})}</div><div className="text-lg leading-tight">{parseInt(ev.date.split('-')[2])}</div>
                </div>
                <div>
                  <h4 className="font-bold text-white">{ev.title} {ev.time && <span className="text-[#D4A381] ml-2">@ {formatShortTime(ev.time)}</span>}</h4>
                  {ev.notes && <p className="text-xs text-slate-300 mt-1 font-medium bg-[#12161A] p-2 rounded-lg border border-[#2A353D]">{ev.notes}</p>}
                  <span className={`text-[10px] font-bold ${T.muted} block mt-1`}>Added by {ev.addedBy}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:self-end self-start">
                <button onClick={() => openEditEventModal(ev)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Edit size={14}/></button>
                <button onClick={() => { if(window.confirm("Delete event?")) deleteDoc(doc(db,"events",ev.id)); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- COMPACT MONTH VIEW ---
const TabMonth = ({ currentDate, users, shifts }) => {
  const monthStr = getMonthStr(currentDate); 
  const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); 
  const days = getDaysInMonth(monthStr);
  
  // Calculate how many weeks this month spans to perfectly stretch the grid rows on paper
  const totalCells = firstDay + days;
  const weeks = Math.ceil(totalCells / 7);

  return (
    <div className={`${T.card} overflow-hidden print-container`}>
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          body * { visibility: hidden; }
          
          /* Hijack the entire printed page */
          .print-container, .print-container * { visibility: visible; }
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            background: white !important;
            z-index: 999999 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important; 
            page-break-inside: avoid !important;
          }
          
          .no-print { display: none !important; }
          
          /* The Header */
          .print-header { 
            display: block !important; 
            text-align: center !important; 
            font-size: 22px !important; 
            font-weight: 900 !important; 
            color: black !important; 
            margin-top: 0 !important;
            margin-bottom: 8px !important; 
            text-transform: uppercase !important; 
            height: 30px !important;
          }
          
          /* The Grid - Stretches to fill exact remaining space on the paper */
          .print-grid {
            flex-grow: 1 !important;
            display: grid !important;
            grid-template-rows: 25px repeat(${weeks}, 1fr) !important;
            border-top: 2px solid black !important;
            border-left: 2px solid black !important;
            height: calc(100vh - 45px) !important; /* Math: 100% minus the header height to prevent page 2 bleed */
            max-height: calc(100vh - 45px) !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
          
          /* The Cells */
          .cell {
            border-right: 2px solid black !important;
            border-bottom: 2px solid black !important;
            background: white !important;
            color: black !important;
            min-height: 0 !important;
            padding: 3px !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          
          .cell-header-text { color: black !important; font-size: 11px !important; font-weight: 900 !important; }
          .cell-date { font-size: 13px !important; font-weight: 900 !important; color: black !important; margin-bottom: 2px !important; }
          
          /* The Shifts */
          .print-shift {
            background: #f8fafc !important;
            color: black !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 4px !important;
            padding: 1px 4px !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            margin-bottom: 2px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      
      <div className="flex justify-end p-2 no-print border-b border-[#2A353D] bg-[#12161A]">
        <button onClick={()=>window.print()} className={T.btnAlt}>🖨️ Print Calendar</button>
      </div>
      
      <div className="hidden print:block print-header">
        86chaos Schedule • {formatDisplayMonth(monthStr)}
      </div>

      <div className={`grid grid-cols-7 border-t border-l ${T.border} print-grid`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}><span className="print-text-dark cell-header-text">{d}</span></div>)}
        
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}
        
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; 
          const dayShifts = shifts.filter(s=>s.date===date&&s.isPublished);
          return (
            <div key={date} className={`p-0.5 border-b border-r ${T.border} min-h-[50px] flex flex-col cell`}>
              <span className={`text-right text-[9px] font-black ${T.muted} mb-0.5 cell-date`}>{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto no-scrollbar flex-1">
                {dayShifts.map(s=>(
                  <div key={s.id} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate bg-[#12161A] border ${T.border} ${s.role==='Bartender'?'text-blue-400':'text-orange-400'} print-shift`}>
                    {users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- PREP & TASKS COMMAND CENTER ---
const TabPrep = ({ currentDate, prepItems, tasks = [], appUser, setLabelsToPrint }) => {
  const [subTab, setSubTab] = useState('prep');
  const [prepDate, setPrepDate] = useState(currentDate);

  // Sync internal prepDate with global currentDate if user uses the top header arrows
  useEffect(() => { setPrepDate(currentDate); }, [currentDate]);

  // Local selection state (Fixes checkboxes staying checked across days)
  const [selectedPreps, setSelectedPreps] = useState([]);

  // Prep Form State
  const [text, setText] = useState(''); 
  const [station, setStation] = useState('Grill'); 
  const dbPrepCats = useLiveCollection('prepCategories', appUser?.restaurantId); 
  const displayStations = dbPrepCats.length > 0 ? dbPrepCats.map(c => c.name).sort() : ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'];
  const [isMaster, setIsMaster] = useState(true);
  
  // Task Form State
  const [taskText, setTaskText] = useState(''); 
  const [taskCat, setTaskCat] = useState('Cleaning'); 
  const [taskFreq, setTaskFreq] = useState('daily');
  const [taskTargetDay, setTaskTargetDay] = useState('Monday'); 
  const [taskTargetDate, setTaskTargetDate] = useState('1');
  const [editingTaskId, setEditingTaskId] = useState(null);

  // --- PREP LOGIC ---
  const activePrep = prepItems.filter(p => p.date === prepDate || p.isMaster);
  
  const handleAddPrep = async (e) => { 
    e.preventDefault(); 
    if(text.trim()) { 
      await addDoc(collection(db, "prepItems"), { 
        date: isMaster ? 'MASTER' : prepDate, 
        text: text.trim(), 
        station, 
        isCompleted: false, 
        completedDates: {}, 
        isMaster, 
        qty: 1,
        restaurantId: appUser.restaurantId
      }); 
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
        delete dts[prepDate]; // Cleanly removes completion for this specific date
      } else {
        dts[prepDate] = appUser.name;
      }
      await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts }); 
    } else { 
      await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null }); 
    } 
  };
  
  const groupedPrep = activePrep.reduce((acc, i) => { const s = i.station || 'General'; if(!acc[s]) acc[s]=[]; acc[s].push(i); return acc; }, {});

  // --- TASK LOGIC ---
  const handleAddTask = async (e) => { 
    e.preventDefault(); 
    if(taskText.trim()) { 
      if (editingTaskId) {
        await updateDoc(doc(db, "tasks", editingTaskId), { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null });
        setEditingTaskId(null);
      } else {
        await addDoc(collection(db, "tasks"), { title: taskText.trim(), category: taskCat, frequency: taskFreq, targetDay: taskFreq === 'weekly' ? taskTargetDay : null, targetDate: taskFreq === 'monthly' ? taskTargetDate : null, completions: {}, restaurantId: appUser.restaurantId }); 
      }
      setTaskText(''); 
    } 
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
  
  // FIX: Anchor Tasks to prepDate, not global currentDate
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
      updatedCompletions[periodKey] = { by: appUser.name, at: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }; 
    }
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
                        {appUser?.isAdmin && <button onClick={()=>editTask(t)} className="text-slate-500 hover:text-[#D4A381] p-2"><Edit size={16}/></button>}
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
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['prep', 'daily', 'weekly', 'monthly'].map((tab) => (
          <button key={tab} onClick={() => { setSubTab(tab); setTaskFreq(tab); }} className={`px-2 sm:px-5 py-2.5 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>{tab === 'prep' ? 'Food Prep' : `${tab} Tasks`}</button>
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
<select value={station} onChange={e=>setStation(e.target.value)} className="w-full sm:w-32 p-2 text-xs font-bold bg-[#12161A] border border-[#2A353D] rounded-xl outline-none text-white">{displayStations.map(s => <option key={s} value={s}>{s}</option>)}</select>              <label className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold ${T.muted} cursor-pointer`}><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4 accent-[#8F6040] bg-[#12161A] border-[#2A353D] rounded"/> Master</label>
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
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`flex items-center bg-[#12161A] rounded-lg border ${T.border} h-8`}><button onClick={async ()=> await updateDoc(doc(db, "prepItems", i.id), { qty: Math.max(0, qty - 1) })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">-</button><span className="w-5 text-center text-xs font-bold text-[#D4A381]">{qty}</span><button onClick={async ()=> await updateDoc(doc(db, "prepItems", i.id), { qty: qty + 1 })} className="w-6 h-full font-bold text-white hover:bg-[#1A2126]">+</button></div>
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
              <button onClick={() => { 
                  const sel = activePrep.filter(i=>selectedPreps.includes(i.id)); 
                  if(sel.length===0)return; 
                  const toP=[]; 
                  sel.forEach(i=>{for(let j=0;j<(i.qty ?? 1);j++)toP.push({...i, printId:`${i.id}-${j}`});}); 
                  setLabelsToPrint({items:toP, prepDate}); 
              }} disabled={selectedPreps.length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><ClipboardList size={18}/> Print Selected</button>
              
              <button onClick={async () => { 
                  const sel = activePrep.filter(i=>selectedPreps.includes(i.id)); 
                  for(const item of sel){ 
                      if(item.isMaster){ 
                          const dts={...(item.completedDates||{})}; 
                          dts[prepDate]=appUser.name; 
                          await updateDoc(doc(db,"prepItems",item.id),{completedDates:dts}); 
                      } else {
                          await updateDoc(doc(db,"prepItems",item.id),{isCompleted:true, completedBy:appUser.name}); 
                      }
                  } 
                  setSelectedPreps([]);
              }} disabled={selectedPreps.length===0} className={`flex-1 ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}><Check size={18}/> Mark Done</button>
            </div>
          </div>
        </div>
      )}

      {subTab !== 'prep' && <div className="animate-[slideIn_0.2s_ease-out]">{renderTasks(subTab)}</div>}
    </div>
  );
};

// --- INVENTORY, VENDORS, & WASTE TRACKER ---
const TabInventory = ({ inventoryItems = [], vendors = [], wasteLogs = [], sales, addToast, appUser }) => {
  const [invTab, setInvTab] = useState('count'); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Inventory Form
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState(''); const [newItemCode, setNewItemCode] = useState(''); const [newItemSupplier, setNewItemSupplier] = useState(''); const [newItemPackSize, setNewItemPackSize] = useState('1 CS'); const [newItemYield, setNewItemYield] = useState('1'); const [newItemPrice, setNewItemPrice] = useState(''); 
  const [editItem, setEditItem] = useState(null); 
  const [orderOverrides, setOrderOverrides] = useState({}); 
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, vendorId: null, items: [] });
  
  // Vendor Form
  const [vName, setVName] = useState(''); const [vRep, setVRep] = useState(''); const [vPhone, setVPhone] = useState(''); const [vEmail, setVEmail] = useState(''); const [vDays, setVDays] = useState([]); const [vTime, setVTime] = useState('');
  const [editVendor, setEditVendor] = useState(null);

  // Waste Form
  const [wItemId, setWItemId] = useState(''); const [wQty, setWQty] = useState(''); const [wReason, setWReason] = useState('Dropped / Spilled');
  const [editWaste, setEditWaste] = useState(null);

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
    setWItemId(''); setWQty(''); addToast('Burn Logged', `$${costLost.toFixed(2)} deducted from stock.`);
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
    
    // Clean text format for reps (No Prices, Quantity First)
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
        // Start at index 1 to skip the header row
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

  const groupedItems = inventoryItems.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).reduce((acc, item) => { const cat = item.category || 'Uncategorized'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {});
  const orderTotal = confirmModal.items.reduce((sum, item) => sum + ((item.price||0) * item.orderQty), 0);

  // Master Permission Check for Inventory Tabs
  const hasInvPerms = appUser?.isAdmin || appUser?.permissions?.inventory || appUser?.permissions?.team;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-24">
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, vendorId: null, items: [] })} title={`Review Order: ${vendors.find(v=>v.id===confirmModal.vendorId)?.name}`}>
         <div className="space-y-4">
           <div className={`max-h-60 overflow-y-auto border ${T.border} rounded-xl divide-y divide-[#2A353D]`}>{confirmModal.items.map(item => (<div key={item.id} className="p-3 flex justify-between items-center bg-[#12161A]"><div><span className="font-bold text-sm block text-white">{item.name}</span><span className={`text-xs ${T.muted}`}>{item.packSize}</span><div className="text-[9px] text-[#D4A381] mt-0.5 uppercase tracking-widest font-black">Est: ${((item.price||0) * item.orderQty).toFixed(2)}</div></div><div className={`font-black ${T.copper} text-lg`}>{item.orderQty}</div></div>))}</div>
           <div className="flex justify-between items-center bg-[#1A2126] p-3 rounded-xl border border-[#2A353D]"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estimated Total</span><span className="text-lg font-black text-emerald-400">${orderTotal.toFixed(2)}</span></div>
           <div className="grid grid-cols-2 gap-2">
             <button onClick={() => executeOrder('email')} className={`w-full ${T.btn} flex items-center justify-center gap-2 py-2 text-xs`}>✉️ Email</button>
             <button onClick={() => executeOrder('sms')} className={`w-full ${T.btn} flex items-center justify-center gap-2 py-2 text-xs`}>📱 Text</button>
             <button onClick={() => executeOrder('csv')} className={`w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-emerald-400 transition-all px-2 py-2 text-xs flex items-center justify-center gap-2`}>📊 CSV Export</button>
             <button onClick={() => executeOrder('copy')} className={`w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-[#D4A381] transition-all px-2 py-2 text-xs flex items-center justify-center gap-2`}>📋 Copy List</button>
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

      {hasInvPerms && invTab === 'manage' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">{editItem && (<form onSubmit={handleSaveEdit} className="space-y-3"><div><label className={T.label}>Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className={T.input} required /></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Category</label><select value={editItem.category || 'Produce'} onChange={e => setEditItem({...editItem, category: e.target.value})} className={T.input}>{['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className={T.label}>Vendor</label><select value={editItem.supplierId || ''} onChange={e => setEditItem({...editItem, supplierId: e.target.value})} className={T.input} required><option value="">Select...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div></div><div className="grid grid-cols-2 gap-3"><div><label className={T.label}>Case Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className={T.input} /></div><div><label className={T.label}>Units per Case (Yield)</label><input type="number" min="1" value={editItem.yieldQty || 1} onChange={e => setEditItem({...editItem, yieldQty: e.target.value})} className={T.input} required /></div></div><button type="submit" className={`w-full ${T.btn}`}>Save Changes</button></form>)}</Modal>

          <div className="flex gap-2 mb-4">
            <label className={`w-full flex items-center justify-center gap-2 bg-[#12161A] text-[#D4A381] border border-[#2A353D] hover:bg-[#1A2126] font-black uppercase tracking-widest py-3 rounded-xl shadow-lg transition-all cursor-pointer`}>
              <span>⬇️ Import Inventory from CSV Spreadsheet</span>
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
          <div className={`${T.card} divide-y ${T.border}`}>{inventoryItems.map(item => (<div key={item.id} className={`${T.row} flex justify-between items-center`}><div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name} <span className="text-[10px] text-slate-500 font-normal">[{item.pfgCode}]</span></div><div className="text-[10px] text-[#D4A381] font-black uppercase mt-0.5 tracking-widest">Case: ${Number(item.price||0).toFixed(2)} • Yield: {item.yieldQty||1}</div></div><div className="flex gap-2"><button onClick={()=>setEditItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button><button onClick={()=>deleteDoc(doc(db,"inventoryItems",item.id))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
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
            {wasteLogs.filter(w=>w.date===getToday()).map(w => (
              <div key={w.id} className={`${T.row} flex justify-between items-center`}>
                <div className="flex-1"> 
                  <span className="font-bold text-white text-sm block">{w.qty}x {w.itemName}</span>
                  <span className={`text-[9px] font-bold ${T.muted} uppercase`}>{w.reason} • By {w.loggedBy}</span>
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
            {wasteLogs.filter(w=>w.date===getToday()).length === 0 && <div className="p-4 text-center text-slate-400 font-bold text-sm">No waste logged today.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// --- RECIPE BOOK ---
const TabRecipes = ({ recipes, appUser, addToast }) => {
  const [searchTerm, setSearchTerm] = useState(''); 
  const [filterCat, setFilterCat] = useState('All'); 
  const [isFormOpen, setIsFormOpen] = useState(false); 
  const [activeRecipe, setActiveRecipe] = useState(null); 
  const [yieldMult, setYieldMult] = useState(1);
  const [editingRecipeId, setEditingRecipeId] = useState(null);

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
        await updateDoc(doc(db, "recipes", editingRecipeId), { 
          title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), lastUpdated: new Date().toISOString() 
        }); 
        addToast('Recipe Updated', `${title} updated successfully.`); 
      } else {
        await addDoc(collection(db, "recipes"), { 
          title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--', ingredients: ingredients.trim(), instructions: instructions.trim(), authorName: appUser.name, authorId: appUser.id, lastUpdated: new Date().toISOString(), restaurantId: appUser.restaurantId 
        }); 
        addToast('Recipe Saved', `${title} added to the book.`); 
      }
      setIsFormOpen(false); 
      resetForm();
    } catch (err) { addToast('Error', 'Could not save.'); } 
  };
  
  const handleDelete = async (id) => { if (!window.confirm("Delete recipe?")) return; await deleteDoc(doc(db, "recipes", id)); setActiveRecipe(null); addToast('Deleted', 'Recipe removed.'); };
  
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
        await addDoc(collection(db, "recipes"), { ...recipe, authorName: "System", authorId: "system", lastUpdated: new Date().toISOString(), restaurantId: appUser.restaurantId });
        count++;
      }
    }
    addToast('Import Complete', `Injected ${count} legacy recipes.`);
  };

  const filteredRecipes = recipes.filter(r => { const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.ingredients.toLowerCase().includes(searchTerm.toLowerCase()); const matchesCat = filterCat === 'All' || r.category === filterCat; return matchesSearch && matchesCat; }).sort((a,b) => a.title.localeCompare(b.title));

  // Determine if the current user has permission to edit/delete the viewed recipe
  const canModifyRecipe = activeRecipe && (appUser?.isAdmin || appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com' || appUser?.id === activeRecipe.authorId);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className={`${T.card} p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-center justify-between`}>
        <div className="flex-1 w-full relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A381]" size={20}/><input type="text" placeholder="Search recipes or ingredients..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className={`${T.input} pl-12`}/></div>
        <div className="flex w-full md:w-auto gap-3">
          <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className={`${T.input} md:w-48`}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <button onClick={handleInjectLegacyRecipes} className={`bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-emerald-400 transition-all px-4 py-2 text-sm flex items-center justify-center gap-2`} title="Inject Card Recipes">⬇️ Import</button>
          <button onClick={() => { resetForm(); setIsFormOpen(true); }} className={`${T.btn} flex items-center justify-center gap-2`}><Plus size={18}/> New Spec</button>
        </div>
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

// --- TIME OFF REQUESTS ---
const TabTimeOff = ({ timeOffRequests, appUser, users, addToast, events = [] }) => {
  const [calMonth, setCalMonth] = useState(getToday().substring(0, 7)); 
  const [selectedDates, setSelectedDates] = useState([]); 
  const [isPartial, setIsPartial] = useState(false); 
  const [startTime, setStartTime] = useState('09:00'); 
  const [endTime, setEndTime] = useState('17:00');

  // Filter requests specific to the logged-in user
  const myRequests = timeOffRequests.filter(r => r.userId === appUser.id).sort((a,b) => new Date(a.date) - new Date(b.date)); 
  const myFutureRequests = myRequests.filter(r => r.date >= getToday());
  const allFutureRequests = timeOffRequests.filter(r => r.date >= getToday()).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`); 
  const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();

  // Pull in the events for the current calendar month
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(calMonth));

  const changeMonth = (offset) => { 
    const d = new Date(calMonth + '-01T12:00:00'); d.setMonth(d.getMonth() + offset); setCalMonth(d.toISOString().substring(0, 7)); 
  };

  const handleToggleDate = (d) => { 
    if (d < getToday()) return addToast('Locked', 'Cannot request past dates.'); 
    
    // Check if they already requested this day
    const existingReq = myRequests.find(r => r.date === d); 
    if (existingReq) { 
      if (window.confirm(`Cancel your time-off request for ${formatDisplayDate(d)}?`)) {
        deleteDoc(doc(db, "timeOffRequests", existingReq.id));
        addToast('Canceled', 'Time off request removed.');
      }
      return; 
    } 
    
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); 
  };
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if (selectedDates.length === 0) return addToast('Error', 'Select days on the calendar first.'); 
    if (isPartial && (!startTime || !endTime)) return addToast('Error', 'Please set partial times.'); 
    
    for (const d of selectedDates) { 
      await addDoc(collection(db, "timeOffRequests"), { 
        userId: appUser.id, userName: appUser.name, date: d, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null, submittedAt: new Date().toISOString(), restaurantId: appUser.restaurantId 
      }); 
    } 
    addToast('Recorded', `Logged ${selectedDates.length} days off.`); 
    setSelectedDates([]); 
    setIsPartial(false); 
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden mb-6`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
            <h3 className="font-black text-sm text-white flex items-center gap-2"><Shield size={14} className="text-red-500"/> Master Override Log</h3>
            <span className={`text-[10px] font-bold ${T.muted}`}>Delete a record to allow scheduling.</span>
          </div>
          <div className={`max-h-48 overflow-y-auto custom-scrollbar divide-y ${T.border}`}>
            {allFutureRequests.length === 0 && <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No upcoming time off for any staff.</div>}
            {allFutureRequests.map(r => (
              <div key={r.id} className={T.row}>
                <div className="flex-1">
                  <div className="font-black text-sm text-white leading-tight">{r.userName}</div>
                  <div className={`text-[10px] font-bold ${T.muted} mt-0.5`}>{formatDisplayDate(r.date)} {r.isPartial && <span className={`ml-1 text-[#D4A381] bg-[#12161A] border ${T.border} px-1 rounded`}>({formatShortTime(r.startTime)} - {formatShortTime(r.endTime)})</span>}</div>
                </div>
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
              const isSelected = selectedDates.includes(d); 
              const existingReq = myRequests.find(r => r.date === d); 
              const isPast = d < getToday();
              const holiday = getHoliday(d);
              const dayEvents = monthEvents.filter(e => e.date === d);

              return (
                <div key={d} onClick={() => !isPast && handleToggleDate(d)} className={`p-1 border-b border-r ${T.border} min-h-[50px] flex flex-col items-center justify-start pt-1 transition-colors ${isPast ? 'bg-[#12161A]/50 opacity-50 cursor-not-allowed' : existingReq ? 'bg-red-900/10 cursor-pointer hover:bg-red-900/20 border border-red-900/30 shadow-inner' : isSelected ? 'bg-[#8F6040]/20 border border-[#C59373] cursor-pointer shadow-inner' : 'hover:bg-[#12161A] cursor-pointer'}`}>
                  <span className={`text-xs font-black ${isSelected ? T.copper : existingReq ? 'text-red-400' : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                  
                  {holiday && <span className="text-[6px] sm:text-[7px] text-amber-500 font-bold uppercase text-center leading-tight mt-0.5 px-0.5">{holiday}</span>}
                  {dayEvents.map(ev => (
                    <span key={ev.id} className="text-[6px] sm:text-[7px] text-blue-400 font-bold uppercase text-center leading-tight mt-0.5 px-0.5 w-full truncate" title={ev.title}>
                      {ev.title}
                    </span>
                  ))}

                  {existingReq && <span className="text-[7px] font-black uppercase text-red-500 mt-auto mb-1">Off</span>}
                  {isSelected && <Check size={10} className={`mt-auto mb-1 ${T.copper}`}/>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className={`${T.card} p-4 sm:p-5 sticky top-20`}>
            <h3 className="font-black text-base mb-1 text-white">Log Availability</h3>
            <p className={`text-[10px] font-bold ${T.muted} mb-4 leading-tight`}>Tap days on the calendar to mark yourself unavailable.</p>
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

            {/* --- NEW SECTION: MY PENDING REQUESTS --- */}
            <div className="mt-6 pt-6 border-t border-[#2A353D]">
              <h3 className="font-black text-sm text-white mb-3">My Pending Requests</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {myFutureRequests.length === 0 && <div className="text-xs font-bold text-slate-500 text-center py-2 border border-dashed border-[#2A353D] rounded-xl">No upcoming requests.</div>}
                {myFutureRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-[#12161A] p-2.5 rounded-xl border border-[#2A353D] hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="text-xs font-bold text-white">{formatDisplayDate(r.date)}</div>
                      {r.isPartial ? (
                        <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-wider mt-0.5">{formatShortTime(r.startTime)} - {formatShortTime(r.endTime)}</div>
                      ) : (
                        <div className="text-[9px] text-red-400 font-black uppercase tracking-wider mt-0.5">Full Day Off</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { if(window.confirm(`Cancel your request for ${formatDisplayDate(r.date)}?`)) deleteDoc(doc(db,"timeOffRequests",r.id)); }}
                      className="text-slate-400 hover:text-red-500 p-2 transition-colors bg-[#1A2126] rounded-lg border border-[#2A353D]"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

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
  const [reminderTime, setReminderTime] = useState(prefs.reminderTime || '120'); 

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

  // --- Role Management State (Admin Only) ---
  const [newRoleName, setNewRoleName] = useState('');
  const [newPrepCat, setNewPrepCat] = useState('');
  const dbPrepCats = useLiveCollection('prepCategories', appUser?.restaurantId);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const dbRoles = useLiveCollection('roles', appUser?.restaurantId);
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  const displayRoles = dbRoles.length > 0 
    ? dbRoles.sort((a,b) => a.name.localeCompare(b.name)) 
    : DEFAULT_ROLES.map(r => ({ id: r, name: r, isDefault: true }));

  // --- Image Upload Engine ---
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

  // --- Role Handlers ---
  const handleAddRole = async (e) => {
    e.preventDefault();
    if(!newRoleName.trim()) return;
    if (dbRoles.length === 0) {
      for (const r of DEFAULT_ROLES) await addDoc(collection(db, "roles"), { name: r, restaurantId: appUser.restaurantId });
    }
    await addDoc(collection(db, "roles"), { name: newRoleName.trim(), restaurantId: appUser.restaurantId });
    setNewRoleName('');
    addToast('Role Added', 'New role is now available.');
  };

  const handleSaveRoleEdit = async (role, newName) => {
    if (!newName.trim() || newName.trim() === role.name) {
      setEditingRoleId(null);
      return;
    }
    setEditingRoleId(null);
    if (role.isDefault) {
       for (const r of DEFAULT_ROLES) {
         if (r === role.name) {
           await addDoc(collection(db, "roles"), { name: newName.trim(), restaurantId: appUser.restaurantId });
         } else {
           await addDoc(collection(db, "roles"), { name: r, restaurantId: appUser.restaurantId });
         }
       }
    } else {
       await updateDoc(doc(db, "roles", role.id), { name: newName.trim() });
    }
    addToast('Role Updated', 'Role name changed.');
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Delete role: ${role.name}?`)) return;
    if (role.isDefault) {
      for (const r of DEFAULT_ROLES) {
        if (r !== role.name) await addDoc(collection(db, "roles"), { name: r, restaurantId: appUser.restaurantId });
      }
    } else {
      await deleteDoc(doc(db, "roles", role.id));
    }
    addToast('Role Deleted', 'Role removed from roster options.');
  };

  const Toggle = ({ label, desc, checked, onChange, disabled = false }) => (
    <label className={`flex items-center justify-between p-3 bg-[#12161A] border ${T.border} rounded-xl ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#1A2126]'} transition-colors`}>
      <div className="pr-3">
        <div className="text-xs font-bold text-white">{label}</div>
        <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>{desc}</div>
      </div>
      <div className="relative flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
      </div>
    </label>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      {/* Settings Navigation (Compact Mobile Grid) */}
      <div className={`grid ${appUser?.isAdmin ? 'grid-cols-2 sm:flex sm:flex-wrap' : 'grid-cols-3'} gap-2 border-b border-[#2A353D] mb-4 pb-2`}>
        {['profile', 'preferences', 'alerts'].concat(appUser?.isAdmin ? ['workspace'] : []).map((tab) => (
          <button type="button" key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-5 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* --- SUB-TAB: MY PROFILE --- */}
      {subTab === 'profile' && (
        <div className="space-y-3">
          <div className={`${T.card} p-3 sm:p-5`}>
            
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#2A353D]">
              <div className="relative group cursor-pointer">
                <img src={getAvatar(name, photoURL)} alt="Profile" className={`w-14 h-14 rounded-full border-2 border-[#D4A381] object-cover shadow-lg bg-[#12161A]`} />
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Edit size={16} className="text-white" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">{name || 'Staff Member'}</h2>
                <div className={`text-[9px] font-black uppercase tracking-widest ${T.copper} mt-0.5`}>{appUser.role} {appUser.isAdmin && '| Admin'}</div>
                <label className="text-[9px] uppercase font-bold text-slate-400 mt-1 block cursor-pointer hover:text-white transition-colors">
                  Tap photo to upload <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={T.label}>Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={`${T.input} py-2 text-sm`} required /></div>
                <div><label className={T.label}>Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${T.input} py-2 text-sm`} /></div>
              </div>
              
              <div>
                <label className={T.label}>Profile Picture URL</label>
                <input type="text" value={photoURL} onChange={e => setPhotoURL(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Paste image link here or use the upload button above..." />
              </div>

              <div><label className={T.label}>Email Address (Cannot change)</label><input type="email" value={appUser?.email} disabled className={`${T.input} py-2 text-sm opacity-50 cursor-not-allowed`} /></div>
              <button type="submit" className={`w-full ${T.btn} py-2`}>Save Profile</button>
            </form>
          </div>

          <div className={`${T.card} p-3 sm:p-5 bg-red-900/10 border-red-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
             <div>
               <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Security</h3>
               <p className="text-[10px] text-slate-400 font-medium">Get a secure password reset link.</p>
             </div>
             <button type="button" onClick={handlePasswordReset} className="w-full sm:w-auto bg-[#12161A] text-red-400 border border-red-900/50 hover:bg-red-900/30 font-bold px-4 py-2 rounded-xl transition-colors text-xs whitespace-nowrap">Reset Password</button>
          </div>
        </div>
      )}

     {/* --- SUB-TAB: PREFERENCES --- */}
      {subTab === 'preferences' && (
        <div className="space-y-4">
          <form onSubmit={handleSavePrefs} className={`${T.card} p-3 sm:p-5 space-y-4`}>
            <div>
              <h2 className="text-base font-black text-white mb-3 border-b border-[#2A353D] pb-2">App Experience</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={T.label}>Default Startup Tab</label>
                  <select value={defaultTab} onChange={e => setDefaultTab(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="published">My Schedule</option>
                    <option value="messages">Message Board</option>
                    {appUser?.role === 'Kitchen' || appUser?.isAdmin ? <option value="prep">Prep List</option> : null}
                    {appUser?.isAdmin && <option value="schedule">Master Schedule</option>}
                    {appUser?.isAdmin && <option value="sales">Sales Ledger</option>}
                  </select>
                </div>
                <div>
                  <label className={T.label}>Time Format</label>
                  <select value={timeFormat} onChange={e => setTimeFormat(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="12h">12-Hour (AM/PM)</option>
                    <option value="24h">24-Hour (Military)</option>
                  </select>
                </div>
              </div>
            </div>
            <button type="submit" className={`w-full ${T.btn} py-2`}>Save Preferences</button>
          </form>

          {appUser?.isAdmin && (
            <div className={`${T.card} p-3 sm:p-5 space-y-3 animate-[slideIn_0.2s_ease-out]`}>
              <div>
                <h2 className="text-base font-black text-white mb-1">Roster Roles</h2>
                <p className="text-[10px] text-slate-400 font-medium mb-3">Add, edit, or remove job titles.</p>
                
                <form onSubmit={handleAddRole} className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input type="text" value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} placeholder="New Role Name..." className={`${T.input} py-2 text-sm`} required />
                  <button type="submit" className={`${T.btn} py-2 whitespace-nowrap`}><Plus size={16} className="inline mr-1"/> Add Role</button>
                </form>
                
                <div className="flex flex-wrap gap-2">
                  {displayRoles.map(role => (
                    <div key={role.id} className="flex items-center gap-2 bg-[#12161A] border border-[#2A353D] px-2 py-1 rounded-lg shadow-sm">
                      {editingRoleId === role.id ? (
                        <input type="text" autoFocus defaultValue={role.name} onBlur={(e) => handleSaveRoleEdit(role, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRoleEdit(role, e.target.value)} className="bg-transparent text-white text-[10px] font-bold outline-none border-b border-[#D4A381] w-20" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">{role.name}</span>
                      )}
                      <div className="flex gap-1 border-l border-[#2A353D] pl-1.5 ml-0.5">
                        <button type="button" onClick={() => setEditingRoleId(role.id)} className="text-slate-500 hover:text-[#D4A381]"><Edit size={10}/></button>
                        <button type="button" onClick={() => handleDeleteRole(role)} className="text-slate-500 hover:text-red-500"><Trash2 size={10}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            <div className="pt-4 mt-4 border-t border-[#2A353D]">
                <h2 className="text-base font-black text-white mb-2">Prep Stations</h2>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={newPrepCat} onChange={e=>setNewPrepCat(e.target.value)} placeholder="New Station..." className={`${T.input} py-2 text-sm`} />
                  <button type="button" onClick={async () => { 
                    if(!newPrepCat.trim()) return; 
                    if (dbPrepCats.length === 0) {
                      for (const c of ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table']) await addDoc(collection(db, "prepCategories"), { name: c, restaurantId: appUser.restaurantId });
                    }
                    await addDoc(collection(db, "prepCategories"), { name: newPrepCat.trim(), restaurantId: appUser.restaurantId }); 
                    setNewPrepCat(''); 
                  }} className={`${T.btn} py-2 whitespace-nowrap`}>Add Station</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(dbPrepCats.length > 0 ? dbPrepCats : ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'].map(c => ({id: c, name: c, isDefault: true}))).sort((a,b) => a.name.localeCompare(b.name)).map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 bg-[#12161A] border border-[#2A353D] px-2 py-1 rounded-lg shadow-sm">
                      <span className="text-[10px] font-bold text-slate-300">{cat.name}</span>
                      <button type="button" onClick={async () => { 
                        if(!window.confirm(`Delete ${cat.name}?`)) return; 
                        if(cat.isDefault) {
                          const defaults = ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'].filter(c => c !== cat.name);
                          for (const c of defaults) await addDoc(collection(db, "prepCategories"), { name: c, restaurantId: appUser.restaurantId });
                        } else {
                          await deleteDoc(doc(db, "prepCategories", cat.id)); 
                        }
                      }} className="text-slate-500 hover:text-red-500 pl-1 border-l border-[#2A353D] ml-1"><Trash2 size={10}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SUB-TAB: ALERTS --- */}
      {subTab === 'alerts' && (
        <form onSubmit={handleSavePrefs} className={`${T.card} p-3 sm:p-5 space-y-4`}>
          <div>
            <h2 className="text-base font-black text-white mb-1"><Bell className={`inline mr-2 ${T.copper}`} size={16}/> Alerts & Routing</h2>
            <p className="text-[10px] text-slate-400 font-medium mb-3">Control how 86 Chaos pings your device.</p>
            
            <div className="space-y-2">
              <Toggle label="Schedule Publications" desc="Get alerted the exact second a new schedule goes live." checked={notifSchedule} onChange={e => setNotifSchedule(e.target.checked)} />
              <Toggle label="Shift Trade Board" desc="Notify me when someone posts a shift they need covered." checked={notifTrades} onChange={e => setNotifTrades(e.target.checked)} />
              <Toggle label="Urgent Message Board" desc="Receive push alerts for announcements marked 'Critical' by managers." checked={notifMessages} onChange={e => setNotifMessages(e.target.checked)} />
              
              <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl`}>
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[#D4A381] transition-colors">Pre-Shift Reminders</div>
                    <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Automated ping before your scheduled clock-in time.</div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <input type="checkbox" checked={notifReminders} onChange={e => setNotifReminders(e.target.checked)} className="sr-only" />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${notifReminders ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${notifReminders ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                </label>

                {notifReminders && (
                  <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">Minutes Before Shift:</span>
                    <input 
                      type="number" 
                      min="1" 
                      value={reminderTime} 
                      onChange={e => setReminderTime(e.target.value)} 
                      className={`${T.input} w-20 py-1 text-center text-xs font-black`} 
                      placeholder="120"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn} py-2`}>Save Alerts</button>
        </form>
      )}

      {/* --- SUB-TAB: GLOBAL WORKSPACE (ADMIN ONLY) --- */}
      {subTab === 'workspace' && appUser?.isAdmin && (
        <form onSubmit={handleSaveSystem} className={`${T.card} p-3 sm:p-5 space-y-4 border-[#D4A381]/30 shadow-[0_0_15px_rgba(212,163,129,0.05)]`}>
          
          <div>
             <div className="flex items-center justify-between mb-1 border-b border-[#2A353D] pb-2">
               <h2 className="text-base font-black text-white"><Shield className={`inline mr-2 ${T.copper}`} size={16}/> Global Config</h2>
               <span className="bg-[#12161A] text-[#D4A381] border border-[#2A353D] px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-widest">Master Controls</span>
             </div>
             
             <div className="mt-4 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Time & Attendance Rules</div>
             <div className="space-y-2">
               <Toggle label="Strict Geofencing (Time Clock)" desc="Block employees from clocking in if they are not within the GPS boundaries of the restaurant." checked={sysGeofence} onChange={e => setSysGeofence(e.target.checked)} />
               <Toggle label="Block Early Clock-Ins" desc="Prevent staff from punching in before their grace period begins." checked={sysBlockEarly} onChange={e => setSysBlockEarly(e.target.checked)} />
               
               <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-3`}>
                 <div>
                   <div className="text-xs font-bold text-white">Clock-In Grace Period</div>
                   <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>How many minutes early staff can clock in.</div>
                 </div>
                 <input type="number" min="0" value={sysGracePeriod} onChange={e => setSysGracePeriod(e.target.value)} className={`${T.input} w-16 text-center font-black py-1.5 text-xs`} />
               </div>
             </div>

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Shift Board Rules</div>
             <div className="space-y-2">
               <Toggle label="Enable Peer-to-Peer Trades" desc="Allow staff to post their shifts to the Trade Board for others to claim." checked={sysTrades} onChange={e => setSysTrades(e.target.checked)} />
               <Toggle label="Auto-Approve Shift Swaps" desc="If enabled, shift claims are approved instantly without manager intervention." checked={sysAutoApprove} disabled={!sysTrades} onChange={e => setSysAutoApprove(e.target.checked)} />
               <Toggle label="Role-Restricted Trades" desc="Staff can only claim shifts that match their assigned role (e.g., Bartenders can't claim Kitchen shifts)." checked={sysSameRoleTrades} disabled={!sysTrades} onChange={e => setSysSameRoleTrades(e.target.checked)} />
             </div>

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Labor & Payroll</div>
             <div className="space-y-2">
               <Toggle label="Mandatory Tip Declaration" desc="Force tipped employees to declare cash & credit tips before they can clock out." checked={sysTips} onChange={e => setSysTips(e.target.checked)} />
               <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-3`}>
                 <div>
                   <div className="text-xs font-bold text-white">Overtime Alert Threshold</div>
                   <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Weekly hours before system flags a manager.</div>
                 </div>
                 <input type="number" min="1" value={sysOvertime} onChange={e => setSysOvertime(e.target.value)} className={`${T.input} w-16 text-center font-black py-1.5 text-xs`} />
               </div>
             </div>

          </div>
          <button type="submit" className={`w-full ${T.btn} py-3 mt-4 text-sm`}>Save Global Workspace</button>
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

// --- SALES & TRENDS TAB ---
const TabSales = ({ sales, addToast, appUser }) => {
  const getMonday = (dStr) => {
    const d = new Date(dStr + 'T12:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const [weekStart, setWeekStart] = useState(getMonday(getToday()));
  const [editData, setEditData] = useState({});

  const weekDays = Array.from({length: 7}).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    const newEditData = {};
    weekDays.forEach(date => {
      const daySale = sales.find(s => s.date === date);
      newEditData[date] = {
        grossSales: daySale?.grossSales || '',
        laborCost: daySale?.laborCost || '',
        foodCost: daySale?.foodCost || '',
        notes: daySale?.notes || ''
      };
    });
    setEditData(newEditData);
  }, [weekStart, sales]);

  const changeWeek = (offset) => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setWeekStart(newDate);
  };

  const handleSave = async (date) => {
    const data = editData[date];
    const existing = sales.find(s => s.date === date);
    const payload = {
      date,
      grossSales: parseFloat(data.grossSales) || 0,
      laborCost: parseFloat(data.laborCost) || 0,
      foodCost: parseFloat(data.foodCost) || 0,
      notes: data.notes || '',
      restaurantId: appUser.restaurantId,
      loggedBy: appUser.name,
      timestamp: new Date().toISOString()
    };

    try {
      if (existing) {
        await updateDoc(doc(db, "sales", existing.id), payload);
      } else {
        await addDoc(collection(db, "sales"), payload);
      }
      addToast('Saved', `Data for ${new Date(date+'T12:00').toLocaleDateString()} locked in.`);
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  const handleInputChange = (date, field, value) => {
    setEditData(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }));
  };

  let wtdGross = 0; let wtdLabor = 0; let wtdFood = 0;
  weekDays.forEach(d => {
    const s = sales.find(x => x.date === d);
    if (s) { wtdGross += (s.grossSales||0); wtdLabor += (s.laborCost||0); wtdFood += (s.foodCost||0); }
  });
  const wtdLaborPct = wtdGross > 0 ? ((wtdLabor / wtdGross) * 100).toFixed(1) : 0;
  const wtdFoodPct = wtdGross > 0 ? ((wtdFood / wtdGross) * 100).toFixed(1) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      {/* Tight Weekly Controls */}
      <div className="flex justify-between items-center bg-[#1A2126] border border-[#2A353D] rounded-xl p-2 shadow-sm">
         <button onClick={() => changeWeek(-1)} className="p-2 bg-[#12161A] text-slate-400 rounded-lg hover:text-[#D4A381] border border-[#2A353D] transition-colors"><ChevronLeft size={18} /></button>
         <div className="text-center">
           <h2 className="text-sm font-black text-white uppercase tracking-widest">Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h2>
         </div>
         <button onClick={() => changeWeek(1)} className="p-2 bg-[#12161A] text-slate-400 rounded-lg hover:text-[#D4A381] border border-[#2A353D] transition-colors"><ChevronRight size={18} /></button>
      </div>

      {/* Slim WTD KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Gross</div><div className="text-sm sm:text-lg font-black text-[#D4A381]">${wtdGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div>
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Labor</div><div className={`text-sm sm:text-lg font-black ${wtdLaborPct > 30 ? 'text-red-400' : 'text-emerald-400'}`}>{wtdLaborPct}%</div></div>
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Food</div><div className={`text-sm sm:text-lg font-black ${wtdFoodPct > 33 ? 'text-red-400' : 'text-emerald-400'}`}>{wtdFoodPct}%</div></div>
      </div>

      {/* Ultra-Compact 7-Day Ledger */}
      <div className={`${T.card} overflow-hidden`}>
         <div className="divide-y divide-[#2A353D]">
           {weekDays.map(date => {
              const data = editData[date] || { grossSales: '', laborCost: '', foodCost: '', notes: '' };
              const isToday = date === getToday();
              const hasData = sales.find(s => s.date === date);

              return (
                <div key={date} className={`p-2 sm:p-3 flex flex-col gap-1.5 ${isToday ? 'bg-[#12161A] border-l-2 border-[#D4A381]' : 'hover:bg-[#12161A]/50 transition-colors'}`}>
                   <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-[#D4A381]' : 'text-slate-300'}`}>{new Date(date+'T12:00').toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span>
                      <div className="flex items-center gap-2">
                         {hasData && <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-900/20 px-1.5 py-0.5 rounded">Saved</span>}
                         {hasData && appUser?.isAdmin && <button onClick={() => { if(window.confirm("Delete record?")) deleteDoc(doc(db,"sales",hasData.id)); }} className="text-slate-500 hover:text-red-500"><Trash2 size={12}/></button>}
                      </div>
                   </div>
                   <div className="flex gap-1.5">
                      <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.grossSales} onChange={e=>handleInputChange(date, 'grossSales', e.target.value)} placeholder="Gross" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                      <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.laborCost} onChange={e=>handleInputChange(date, 'laborCost', e.target.value)} placeholder="Labor" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                      <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.foodCost} onChange={e=>handleInputChange(date, 'foodCost', e.target.value)} placeholder="Food" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                      <button onClick={()=>handleSave(date)} className="w-8 sm:w-10 bg-gradient-to-r from-[#C59373] to-[#8F6040] text-slate-900 font-black rounded flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"><Check size={14}/></button>
                   </div>
                </div>
              )
           })}
         </div>
      </div>
    </div>
  );
};


// ============================================================================
// THE MASTER ENGINE (App Component)
// ============================================================================
export default function App() {
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('86chaosUser'); return saved ? JSON.parse(saved) : null; });
  const rId = appUser?.restaurantId;

  // --- VERSION CHECKER STATE & LOGIC ---
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.version !== CURRENT_VERSION) {
            setShowUpdateBanner(true);
          }
        }
      } catch (error) {
        console.warn("Background version check failed:", error);
      }
    };

    // Check instantly on load, then every 3 minutes silently
    checkAppVersion();
    const versionInterval = setInterval(checkAppVersion, 3 * 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);
 

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
    if (appUser) localStorage.setItem('86chaosUser', JSON.stringify(appUser));
    else localStorage.removeItem('86chaosUser');
  }, [appUser]);

  

  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

const liveAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users.find(u => u.id === appUser.id) || appUser)) : null;

  // Unread messages logic
  const latestNoteDate = events.filter(e => e.type === 'note').reduce((max, n) => Math.max(max, new Date(n.date).getTime()), 0);
  const lastReadMsg = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadMsg`) || '0') : 0;
  const hasUnreadMessages = latestNoteDate > lastReadMsg && activeTabState !== 'messages';

  useEffect(() => {
    if (activeTabState === 'messages' && liveAppUser) {
      localStorage.setItem(`${liveAppUser.id}_lastReadMsg`, Date.now().toString());
    }
  }, [activeTabState, events, liveAppUser]);

 

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

{/* UPDATE ALERT BANNER */}
      {showUpdateBanner && (
        <div className="bg-red-600 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[9999] shadow-2xl uppercase tracking-wider">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 animate-pulse text-sm">🚨</span>
            <span className="truncate">System update available. Refresh to prevent database desync.</span>
          </div>
          <button 
            onClick={() => window.location.reload(true)} 
            className="bg-white text-red-600 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3"
          >
            REFRESH NOW
          </button>
        </div>
      )}


<header className="sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 bg-[#12161A]/95 backdrop-blur-md border-[#2A353D]">
        <CheersLogo />

        {/* DYNAMIC RESTAURANT NAME */}
        {liveAppUser && (
          <div className="flex-1 text-center px-4 truncate mt-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500">
              {liveAppUser.restaurantName || "Cheers"}
            </span>
          </div>
        )}

        <button onClick={() => setIsMenuOpen(true)} className={`relative p-2 border rounded-xl shadow-sm transition-all outline-none bg-[#1A2126] border-[#2A353D] ${T.copper} hover:text-white flex-shrink-0`}>
          <Menu size={20} />
          {hasUnreadMessages && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#12161A] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
        </button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} />

<DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} />
    {['schedule', 'published', 'month', 'sales', 'prep'].includes(activeTabState) && (
        <div className="py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center bg-[#1A2126] border-[#2A353D]">
          {activeTabState === 'sales' ? (
            <div className="w-full text-center">
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">Sales & Trends</h2>
            </div>
          ) : (
            <>
              <button onClick={activeTabState === 'prep' ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381]"><ChevronLeft size={20} /></button>
              <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381]">
                {activeTabState === 'prep' ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
              </h2>
              <button onClick={activeTabState === 'prep' ? nextDay : nextMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381]"><ChevronRight size={20} /></button>
            </>
          )}
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input 
            type={activeTabState === 'prep' || activeTabState === 'sales' ? 'date' : 'month'} 
            value={activeTabState === 'prep' || activeTabState === 'sales' ? currentDate : getMonthStr(currentDate)} 
            onChange={e => { 
              if (e.target.value) { 
                setCurrentDate(activeTabState === 'prep' || activeTabState === 'sales' ? e.target.value : e.target.value + '-01'); 
                setIsDateModalOpen(false); 
              } 
            }} 
            className={T.input} 
          />
          <button onClick={() => setIsDateModalOpen(false)} className={`w-full ${T.btn}`}>Close</button>
        </div>
      </Modal>

      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-6 pb-24">
        {activeTabState === 'schedule' && liveAppUser?.isAdmin && <TabSchedule currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'published' && <TabMasterSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} />}
{activeTabState === 'sales' && liveAppUser?.isAdmin && <TabSales sales={sales} addToast={addToast} appUser={liveAppUser} />}        {activeTabState === 'messages' && <TabMessages events={events} appUser={liveAppUser} users={users} addToast={addToast} />}
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
        <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Beta Version 3.1.1</span>
      </div>
    </div>
  );
}

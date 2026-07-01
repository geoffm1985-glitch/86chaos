import React, { useState, useEffect } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe } from 'lucide-react';import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';


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
const storage = getStorage(app);
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

// Kitchen Wi-Fi Armor: Keep app working in walk-in coolers
enableIndexedDbPersistence(db).catch((err) => console.warn("Offline mode issue:", err.code));

const auth = getAuth(app);

// --- Master Configuration ---
const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';
const EVENT_TAGS = ['Standard Day', 'Packers Game', 'Brewers Game', 'Live Music', 'Severe Weather', 'Private Catering', 'Holiday'];

// --- VERSION TRACKING ---
const CURRENT_VERSION = '9.5.0';

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

// --- Global Crash Reporter & Telemetry Engine ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) { 
  window.crashCatcherAttached = true; 
  window.breadcrumbs = [];

// Silently record the last 15 buttons clicked
  window.addEventListener('click', (e) => {
    let target = e.target;
    // Find the closest button if they clicked an icon inside a button
    let btn = target.closest('button');
    if (btn) {
      // Improved logic: Check title, aria-label, text, or the SVG class name
      let text = btn.title || btn.getAttribute('aria-label') || btn.innerText || '';
      if (!text.trim()) {
        const svg = btn.querySelector('svg');
        if (svg && svg.classList && svg.classList.length > 0) {
           // Extracts 'Trash2' or 'Edit' from the Lucide SVG class
           text = svg.classList[0].replace('lucide-', '').replace('lucide', 'Icon');
        } else {
           text = 'Icon Button';
        }
      }
      if (text.length > 40) text = text.substring(0, 40) + '...';
      window.breadcrumbs.push({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}), action: 'Clicked', target: text.trim().replace(/\n/g, ' ') });
      if (window.breadcrumbs.length > 15) window.breadcrumbs.shift();
    }
  }, true);

  window.onerror = (msg, url, lineNo, columnNo, error) => { 
    addDoc(collection(db, "crashReports"), { 
      type: 'error', 
      message: msg, 
      stack: error?.stack || '', 
      breadcrumbs: window.breadcrumbs || [], // Attach the breadcrumbs to the crash
      userAgent: navigator.userAgent, // Captures device, OS, and browser info
      screenSize: `${window.innerWidth}x${window.innerHeight}`, // Helps debug UI clipping
      time: new Date().toISOString() 
    }).catch(()=>{}); 
    return false; 
  }; 
}

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


// --- SYSTEM AUDIT LOGGER ---
const logAudit = async (user, action, target, details) => {
  if (!user || !user.restaurantId) return;
  try {
    await addDoc(collection(db, "auditLogs"), {
      userId: user.id || 'system',
      userName: user.name || 'System',
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
      restaurantId: user.restaurantId,
      isGhost: user.isGhost || false
    });
  } catch (err) { console.error("Audit log failed:", err); }
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

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, hasUnreadMessages, hasMyShiftAlert, hasScheduleBuilderAlert, clientFeatures = {} }) => {
  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};
  const isGod = appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() || appUser?.isSuperAdmin;

  // Helper: If a feature is undefined, it defaults to true (prevents breaking legacy setups like Cheers)
  const isEnabled = (feat) => clientFeatures[feat] !== false;

  // --- 1. The Daily Hub ---
  if (isEnabled('schedule')) tabs.push({ id: 'published', label: 'My Shift', icon: <Clock size={18}/>, dot: hasMyShiftAlert }); 
  if (isEnabled('messages')) tabs.push({ id: 'messages', label: 'The Board', icon: <MessageSquare size={18}/>, dot: hasUnreadMessages });
  
  // --- 2. Back of House (Kitchen) ---
  if (isEnabled('prep') && (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep)) tabs.push({ id: 'prep', label: 'Prep & Tasks', icon: <ClipboardList size={18}/> });
  if (isEnabled('recipes') && (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep || perms.team)) tabs.push({ id: 'recipes', label: 'Spec Book', icon: <BookOpen size={18}/> });
  if (isEnabled('inventory') && (appUser?.isAdmin || perms.inventory || perms.team)) tabs.push({ id: 'inventory', label: 'Stock & Orders', icon: <Package size={18}/> });  
  
// --- 3. Management ---
  if (isEnabled('schedule') && (appUser?.isAdmin || perms.schedule)) tabs.push({ id: 'schedule', label: 'Schedule Builder', icon: <Calendar size={18}/>, dot: hasScheduleBuilderAlert });
  if (isEnabled('team') && (appUser?.isAdmin || perms.team)) tabs.push({ id: 'team', label: 'Staff Roster', icon: <Users size={18}/> });
  if (isEnabled('maintenance') && (appUser?.isAdmin || perms.team)) tabs.push({ id: 'maintenance', label: 'Maintenance Log', icon: <Wrench size={18}/> });
  if (isEnabled('sales') && (appUser?.isAdmin || perms.sales)) tabs.push({ id: 'sales', label: 'Daily Ledger', icon: <TrendingUp size={18}/> });
  
// --- 4. System & Security ---
  const isTrueGod = (appUser?.email || '').toLowerCase() === 'geoffm1985@gmail.com' || appUser?.isSuperAdmin === true || (appUser?.name || '').includes('Geoff');
  if (isTrueGod) tabs.push({ id: 'godmode', label: 'System Administrator', icon: <Globe size={18}/> });
  if (appUser?.isAdmin || isTrueGod) tabs.push({ id: 'audit', label: 'System Audit', icon: <Shield size={18}/> });  
  tabs.push({ id: 'settings', label: 'Preferences', icon: <Settings size={18}/> });
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
                     {tab.dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1A2126] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
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
  const [rememberMe, setRememberMe] = useState(true);
  
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
          localStorage.setItem('chaosRememberMe', rememberMe);
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
      localStorage.setItem('chaosRememberMe', rememberMe);
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
      await sendPasswordResetEmail(auth,
 email);
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

            <label className="flex items-center justify-center gap-2 cursor-pointer mt-2">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-[#D4A381] bg-[#0B0E11] border border-[#2A353D] rounded cursor-pointer" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Remember Me</span>
            </label>
            
            <button type="submit" className="w-full bg-gradient-to-r from-[#D4A381] to-[#b58563] text-slate-900 font-black tracking-widest uppercase text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(212,163,129,0.2)] hover:scale-[1.02] transition-all mt-4">
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
  
  // --- TIME CLOCK LOGIC ---
  const [activePunch, setActivePunch] = useState(null);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipCash, setTipCash] = useState('');
  const [tipCredit, setTipCredit] = useState('');

  useEffect(() => {
    if (!appUser?.id) return;
    const q = query(
      collection(db, 'timePunches'), 
      where('employeeId', '==', appUser.id), 
      where('status', 'in', ['clocked_in', 'on_break'])
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) { setActivePunch({ id: snap.docs[0].id, ...snap.docs[0].data() }); } 
      else { setActivePunch(null); }
    });
    return () => unsub();
  }, [appUser?.id]);



// --- GEOFENCE MATH ENGINE ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c) * 3.28084; // Convert final result to feet
  };

const handleClockIn = async () => {
    // Check if scheduled today
    const isScheduledToday = shifts.some(s => s.employeeId === appUser.id && s.date === getToday() && s.isPublished);
    
    let isUnscheduled = false;
    if (!isScheduledToday) {
       const confirmUnscheduled = window.confirm("You are not scheduled for a shift today. Do you want to proceed with an unscheduled clock-in?");
       if (!confirmUnscheduled) return;
       isUnscheduled = true;
    }

    const executePunch = async () => {
      try {
        await addDoc(collection(db, "timePunches"), { 
          employeeId: appUser.id, employeeName: appUser.name, clockInTime: new Date().toISOString(), 
          status: 'clocked_in', restaurantId: appUser.restaurantId, date: getToday(), breakMinutes: 0,
          isUnscheduled: isUnscheduled, isApproved: !isUnscheduled
        });
        
        // Blast the manager alert to the Message Board
        if (isUnscheduled) {
           await addDoc(collection(db, "events"), { 
             date: new Date().toISOString(), title: `UNSCHEDULED PUNCH: ${appUser.name.split(' ')[0]} clocked in without a scheduled shift. Please review in Timesheets.`, 
             type: 'note', author: 'System Alert', isImportant: true, restaurantId: appUser.restaurantId, replies: [] 
           });
        }
        
        addToast('Clocked In', isUnscheduled ? 'Unscheduled shift started. Manager notified.' : 'Shift started successfully.');
      } catch (e) { addToast('Error', e.message); }
    };

    if (appUser?.systemSettings?.geofence) {
      if (!navigator.geolocation) return addToast('Error', 'Your device does not support location tracking.');
      
      const targetLat = parseFloat(appUser.systemSettings.lat);
      const targetLon = parseFloat(appUser.systemSettings.lon);
      const allowedRadius = parseInt(appUser.systemSettings.geofenceRadius) || 300; // Default to 300 feet
      
      if (!targetLat || !targetLon) return addToast('Geofence Error', 'Location coordinates are not set in Workspace settings yet.');
      
      addToast('Locating...', 'Verifying GPS coordinates. Hold still.');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calculateDistance(targetLat, targetLon, pos.coords.latitude, pos.coords.longitude);
          if (dist <= allowedRadius) executePunch();
          else addToast('Access Denied', `Too far away. Move closer to the restaurant. (${Math.round(dist)} feet away)`);
        },
        (err) => addToast('Location Error', err.code === 1 ? 'Location access denied. Please allow location access in your browser to clock in.' : 'Could not lock GPS. Step outside the walk-in and try again.'),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      executePunch();
    }
  };

  const handleStartBreak = async () => {
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: new Date().toISOString(), status: 'on_break' });
    addToast('Break Started', 'Enjoy your break.');
  };

  const handleEndBreak = async () => {
    const breakStart = new Date(activePunch.breakStartTime);
    const now = new Date();
    const mins = (now - breakStart) / 60000;
    const currentBreaks = activePunch.breakMinutes || 0;
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: null, breakMinutes: currentBreaks + mins, status: 'clocked_in' });
    addToast('Break Ended', 'Welcome back to work.');
  };

  const initiateClockOut = () => {
    if (appUser?.systemSettings?.tips) { setIsTipModalOpen(true); } 
    else { finalizeClockOut(); }
  };

  const finalizeClockOut = async (e) => {
    if(e) e.preventDefault();
    if (!activePunch) return;
    try {
      let finalBreakMins = activePunch.breakMinutes || 0;
      if (activePunch.status === 'on_break') {
         const breakStart = new Date(activePunch.breakStartTime);
         finalBreakMins += (new Date() - breakStart) / 60000;
      }
      
      await updateDoc(doc(db, "timePunches", activePunch.id), { 
        clockOutTime: new Date().toISOString(), 
        status: 'clocked_out',
        cashTips: parseFloat(tipCash) || 0,
        creditTips: parseFloat(tipCredit) || 0,
        breakMinutes: finalBreakMins,
        breakStartTime: null
      });
      
      setIsTipModalOpen(false);
      setTipCash(''); setTipCredit('');
      addToast('Clocked Out', 'Shift ended. Great work today!');
    } catch (err) { addToast('Error', err.message); }
  };

// --- SHIFT LOGIC ---
  const myMonthShifts = shifts
    .filter(s => s.employeeId === appUser.id && s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

  const myNextShift = shifts
    .filter(s => s.employeeId === appUser.id && s.date >= getToday() && s.isPublished)
    .sort((a,b) => a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date))[0];

  const activeMonthShifts = shifts
    .filter(s => s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date === b.date ? (a.startTime || '').localeCompare(b.startTime || '') : a.date.localeCompare(b.date));

  // --- TRADE BOARD LOGIC ---
  const availableSwaps = shiftSwaps
    .filter(s => s.status === 'available' && s.date >= getToday())
    .sort((a,b) => a.date.localeCompare(b.date));

  const handleCancelSwap = async (swapId) => {
    if (!window.confirm("Remove this shift from the Trade Board?")) return;
    await deleteDoc(doc(db, "shiftSwaps", swapId));
    addToast('Revoked', 'Shift removed from Trade Board.');
  };

const handleOfferSwap = async (shift) => {
    if (!window.confirm(`Offer your ${shift.role} shift on ${formatDisplayDate(shift.date)} to the Trade Board?`)) return;
    
    try {
      // 1. Add the swap to the database
      await addDoc(collection(db, "shiftSwaps"), {
        shiftId: shift.id,
        originalEmployeeId: appUser.id,
        role: shift.role,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        status: 'available',
        restaurantId: appUser.restaurantId,
        listedAt: new Date().toISOString()
      });
      
      addToast('Listed', 'Shift is now on the Trade Board.');
      setSubTab('trade-board');

      // 2. Trigger the Universal Push Cannon
      try {
        await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            restaurantId: appUser.restaurantId,
            type: 'trade', // This tells the cannon to respect the notifTrades toggle
            title: '🔄 Shift up for grabs!',
            body: `${appUser.name.split(' ')[0]} just posted a ${shift.role} shift on ${formatDisplayDate(shift.date)}.`,
            textContent: '', // Not a message, so no keyword scanning needed
            isCritical: false
          })
        });
      } catch (err) {
        console.error("Failed to trigger push:", err);
      }

    } catch (e) {
      addToast('Error', e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      
      <Modal isOpen={isTipModalOpen} onClose={() => setIsTipModalOpen(false)} title="Declare Tips">
        <form onSubmit={finalizeClockOut} className="space-y-4">
          <p className="text-xs text-slate-300 font-bold mb-2">Please declare your tips for this shift before clocking out.</p>
          <div>
            <label className={T.label}>Cash Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCash} onChange={e=>setTipCash(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <div>
            <label className={T.label}>Credit Card Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCredit} onChange={e=>setTipCredit(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <button type="submit" className={`w-full ${T.btn}`}>Finalize Clock Out</button>
        </form>
      </Modal>

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
              <Bell size={24} className="text-red-500 flex-shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase text-[#D4A381] tracking-widest block">System Alert</span>
                <p className="text-xs text-slate-200 font-medium leading-snug">{alert.title}</p>
              </div>
            </div>
          ))}
          <div className={`${T.grad} rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-[#D4A381]/30`}>
            <div className="absolute -top-4 -right-4 text-8xl font-black text-slate-900/10">86</div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900/60 mb-1">My Schedule</h3>
            {myNextShift ? (
              <div className="mb-6"><div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Next: {myNextShift.role}</div><div className="text-sm font-bold text-slate-900/80 flex items-center gap-1.5">{formatDisplayDate(myNextShift.date)}   {formatShortTime(myNextShift.startTime)} - {formatShortTime(myNextShift.endTime)} {myNextShift.endTime === 'CLOSE' && <span className="bg-slate-900 text-[#D4A381] text-[9px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-wider">Close</span>}</div></div>
            ) : (<div className="mb-6 text-slate-900 font-bold">No upcoming shifts scheduled.</div>)}
            
            {activePunch ? (
              <div className="space-y-2 relative z-10">
                <button onClick={initiateClockOut} className="w-full py-4 bg-red-900/80 text-red-100 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-red-800 border border-red-500/50 transition-all flex flex-col items-center justify-center gap-1">
                  <span>CLOCK OUT</span>
                  <span className="text-[10px] text-red-300 font-medium normal-case tracking-normal">Clocked in at {new Date(activePunch.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </button>
                {appUser?.systemSettings?.breaks && (
                  activePunch.status === 'on_break' ? (
                    <button onClick={handleEndBreak} className="w-full py-3 bg-blue-900/80 text-blue-100 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-800 border border-blue-500/50 transition-all">END BREAK</button>
                  ) : (
                    <button onClick={handleStartBreak} className="w-full py-3 bg-slate-800/50 text-slate-900 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 hover:text-white border border-slate-700 transition-all">START UNPAID BREAK</button>
                  )
                )}
              </div>
            ) : (
              <button onClick={handleClockIn} className="w-full py-4 bg-emerald-600/20 text-emerald-400 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-600/30 border border-emerald-500/50 transition-all relative z-10">
                CLOCK IN
              </button>
            )}

          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSubTab('trade-board')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors relative`}>
              <Repeat size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Trade Board</span>
              {availableSwaps.length > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">{availableSwaps.length}</span>}
            </button>
            <button onClick={() => setSubTab('time-off')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors`}>
              <Calendar size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Request Off</span>
            </button>
          </div>

          <div className={`${T.card} overflow-hidden mt-4`}>
            <div className={T.th}>My Month Shifts</div>
            <div className={`divide-y ${T.border}`}>
              {myMonthShifts.length === 0 ? (
                <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No shifts scheduled for you this month.</div>
              ) : (
                myMonthShifts.map(s => {
                  const isFuture = s.date >= getToday();
                  const isOffered = shiftSwaps.some(swap => swap.shiftId === s.id && swap.status === 'available');

                  return (
                    <div key={s.id} className={`${T.row} flex justify-between items-center`}>
                      <div>
                        <div className="font-bold text-white text-sm">{formatDisplayDate(s.date)}</div>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${T.copper} mt-0.5`}>{s.role}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>
                          {formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}
                        </div>
                        {isFuture && (
                          isOffered ? (
                            <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 bg-orange-900/20 border border-orange-900/50 px-2 py-1 rounded">Listed</span>
                          ) : (
                            <button onClick={() => handleOfferSwap(s)} className="text-[8px] font-black uppercase tracking-widest bg-[#1A2126] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] hover:border-[#D4A381]/50 px-2 py-1 rounded transition-colors shadow-sm">
                              Swap
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* THE TRADE BOARD */}
      {subTab === 'trade-board' && (
        <div className="animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Repeat size={18} /> Trade Board</h3>
              <button onClick={() => setSubTab('my-schedule')} className="text-xs font-bold text-slate-400 hover:text-white border border-[#2A353D] px-3 py-1.5 rounded-lg">Back to Dashboard</button>
            </div>
            
            <div className={`divide-y ${T.border}`}>
              {availableSwaps.length === 0 ? (
                <div className={`p-8 text-center text-sm font-bold ${T.muted}`}>No shifts currently available.</div>
              ) : (
                availableSwaps.map(swap => {
                  const isMine = swap.originalEmployeeId === appUser.id;
                  const originalEmp = users.find(u => u.id === swap.originalEmployeeId);
                  
                  return (
                    <div key={swap.id} className={`${T.row} p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                      <div>
                        <div className="font-bold text-white text-base">{formatDisplayDate(swap.date)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mt-0.5">
                          {swap.role}   {formatShortTime(swap.startTime)} - {formatShortTime(swap.endTime)}
                        </div>
                        <div className="text-xs text-slate-400 font-medium mt-1">Listed by {originalEmp?.name || 'Unknown Staff'}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {isMine ? (
                          <button onClick={() => handleCancelSwap(swap.id)} className="w-full sm:w-auto px-4 py-2 bg-red-900/20 text-red-500 text-xs font-black uppercase tracking-widest rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Revoke Listing</button>
                        ) : (
                          <button onClick={() => handleClaimShift(swap)} className="w-full sm:w-auto px-4 py-2 bg-emerald-900/20 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-lg border border-emerald-900/50 hover:bg-emerald-900/40 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.1)]">Claim Shift</button>
                        )}
                      </div>
                    </div>
                  );
                })
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
      {subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} events={events} /></div>}  
    </div>
  );
};

// --- TEAM MANAGEMENT ---
const TabTeam = ({ users, appUser, addToast }) => {
  const canManageTeam = appUser.isAdmin || appUser.permissions?.team;
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [role, setRole] = useState('Bartender'); 
  const [wage, setWage] = useState(''); 
  const [photoURL, setPhotoURL] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState({ schedule: false, inventory: false, prep: false, sales: false, team: false });
  const [editingUserId, setEditingUserId] = useState(null);

  const dbRoles = useLiveCollection('roles', appUser?.restaurantId);
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  const roles = dbRoles.length > 0 ? dbRoles.map(r => r.name).sort() : DEFAULT_ROLES;
  
  const generateTempPass = () => Math.random().toString(36).slice(-6);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setWage(''); setPhotoURL(''); setRole('Bartender'); setIsAdmin(false); setPerms({ schedule: false, inventory: false, prep: false, sales: false, team: false }); setEditingUserId(null);
  };

  const handleEditClick = (u) => {
    setName(u.name); setEmail(u.email); setPhone(u.phone || ''); setWage(u.wage || ''); setPhotoURL(u.photoURL || ''); setRole(u.role || 'Bartender'); setIsAdmin(u.isAdmin || false); setPerms(u.permissions || { schedule: false, inventory: false, prep: false, sales: false, team: false }); setEditingUserId(u.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => { 
    e.preventDefault(); if (!name.trim() || !email.trim() || !phone.trim()) return; 
    
    if (editingUserId) {
        try {
            await updateDoc(doc(db, "users", editingUserId), {
                name: name.trim(), phone: phone.trim(), role, wage: parseFloat(wage) || 0, isAdmin, permissions: perms, photoURL: photoURL.trim()
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
        password: tPass, role, wage: parseFloat(wage) || 0, isAdmin, permissions: perms, isActive: true, 
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
    if (!window.confirm(`Terminate ${u.name}? This will permanently delete their global account from the entire system.`)) return; 
    await deleteDoc(doc(db, "users", u.id)); 
    addToast('Terminated', `${u.name}'s account has been completely erased.`); 
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
              <button type="button" onClick={resetForm} className="text-white text-xs font-bold hover:text-blue-300">Cancel Edit ?</button>
            </div>
          )}
          
          <div><label className={T.label}>Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className={T.input} required placeholder="e.g. Gordon Ramsay" /></div>
          
          <div>
            <label className={T.label}>Email {editingUserId && <span className="text-slate-500 lowercase normal-case ml-1">(Cannot be changed after creation)</span>}</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={!!editingUserId} className={`${T.input} ${editingUserId ? 'opacity-50 cursor-not-allowed' : ''}`} required />
          </div>

          
          <div><label className={T.label}>Phone</label><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={T.input} required /></div>
          
          <div><label className={T.label}>Role</label><select value={role} onChange={e=>setRole(e.target.value)} className={T.input}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          
          {/* STRICTLY LOCKED TO ADMINS */}
          {appUser?.isAdmin && (
            <div>
              <label className={T.label}>Hourly Wage ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                <input type="number" step="0.01" min="0" value={wage} onChange={e=>setWage(e.target.value)} className={`${T.input} pl-8`} placeholder="Ex: 15.50" />
              </div>
            </div>
          )}

  {appUser?.isAdmin && (
            <label className="flex items-center gap-3 p-4 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="w-5 h-5 accent-red-500 bg-[#1A2126] border-[#2A353D] rounded" />
              <span className="text-sm font-black text-red-500">Store Manager (Full Admin)</span>
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
                    {appUser?.isAdmin && u.wage > 0 && <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-900/10 border border-emerald-900/30 px-1.5 py-0.5 rounded ml-1">${Number(u.wage).toFixed(2)}/hr</span>}
                    {appUser?.isAdmin && <span className={`text-[8px] font-black uppercase tracking-widest ml-1 ${(!u.lastActive || Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000) > 1) ? 'text-red-500' : 'text-emerald-500'}`}>{!u.lastActive ? 'Never' : Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000) === 0 ? 'Active Today' : `Inactive ${Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000)} days`}</span>}
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
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));
  
  const handleBroadcast = async (e) => { 
    e.preventDefault(); 
    if(!message.trim() && !imageFile) return; 
    setIsUploading(true);

    let photoUrl = null;
    if (imageFile) {
      try {
        const fileRef = ref(storage, `messages/${appUser.restaurantId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsUploading(false);
        return;
      }
    }

const isCritical = message.trim().toLowerCase().includes('!critical');
    const finalMessage = message.trim().replace(/!critical/ig, '').trim();

    await addDoc(collection(db, "events"), { 
      date: new Date().toISOString(), 
      title: finalMessage, 
      type: 'note', 
      author: appUser.name, 
      isImportant: isCritical, 
      restaurantId: appUser.restaurantId, 
      replies: [],
      imageUrl: photoUrl 
    }); 
    
    // --- NEW: TRIGGER UNIVERSAL PUSH NOTIFICATION ---
    try {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restaurantId: appUser.restaurantId,
          type: 'message',
          title: isCritical ? '🚨 CRITICAL ALERT' : `New Message from ${appUser.name.split(' ')[0]}`,
          body: finalMessage,
          textContent: finalMessage,
          isCritical: isCritical
        })
      });
    } catch (err) {
      console.error("Failed to trigger push:", err);
    }

    setMessage(''); 
    setImageFile(null);
    setIsUploading(false);
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
      <div className={`${T.card} p-4`}>
        <form onSubmit={handleBroadcast} className="flex flex-col gap-3">
          <textarea value={message} onChange={e=>setMessage(e.target.value)} className={T.input} rows="2" placeholder="Message the team... (Photo optional)"></textarea>
          
          {imageFile && (
            <div className="text-xs text-emerald-400 font-bold bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50 flex justify-between items-center">
              <span className="truncate pr-2">📷 {imageFile.name} attached</span>
              <button type="button" onClick={()=>setImageFile(null)} className="text-red-400 hover:text-red-300 p-1"><X size={14}/></button>
            </div>
          )}

<div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full">
            <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-12 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
               <label className="flex-1 sm:w-16 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                  <Camera size={20} />
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => setImageFile(e.target.files[0])} className="hidden" disabled={isUploading} />
               </label>
               <label className="flex-1 sm:w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381]" title="Upload Photo">
                  <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="hidden" disabled={isUploading} />
               </label>
            </div>
            <button type="submit" disabled={isUploading || (!message.trim() && !imageFile)} className={`flex-1 sm:flex-1 ${T.btn} h-12 disabled:opacity-50 flex items-center justify-center`}>
              {isUploading ? <Loader2 className="animate-spin" size={20}/> : 'Post'}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-3">{allNotes.map(n => {
        const authorUser = users.find(u => u.name === n.author);
        return (
        <div key={n.id} className={`p-4 flex gap-3 ${n.isImportant ? `bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 rounded-2xl shadow-sm` : T.card}`}>
          {n.author !== 'System Alert' && <img src={getAvatar(n.author, authorUser?.photoURL)} className={`w-10 h-10 rounded-full border ${T.border} flex-shrink-0 object-cover`} alt="pic"/>}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <span className={`font-black text-sm ${n.isImportant ? 'text-red-500' : T.copper}`}>{n.author}</span>
              <span className="text-[10px] font-bold text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
            </div>
            {n.title && <p className="font-medium leading-snug text-slate-200 break-words whitespace-pre-wrap">{n.title}</p>}
            
            {/* RENDER THE IMAGE IF IT HAS ONE */}
            {n.imageUrl && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#2A353D] shadow-inner bg-[#0B0E11]">
                <img src={n.imageUrl} alt="Attached" className="w-full max-h-96 object-contain" />
              </div>
            )}
            
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
const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, timePunches = [], addToast, appUser }) => {
  const [subTab, setSubTab] = useState('schedule'); 
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
  const [eventImageFile, setEventImageFile] = useState(null);
  const [isEventUploading, setIsEventUploading] = useState(false);

  // --- AUTO-POPULATE STATE ---
  const [isAutoPopulateModalOpen, setIsAutoPopulateModalOpen] = useState(false);
  const [autoPopSourceMonth, setAutoPopSourceMonth] = useState('');
  
  const monthStr = getMonthStr(currentDate); 
  const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  // --- CUSTOM DROPDOWN TIME GENERATOR ---
  const TIME_OPTIONS = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 15) {
      TIME_OPTIONS.push(`${String(i).padStart(2, '0')}:${String(j).padStart(2, '0')}`);
    }
  }

  // --- CUSTOM SHIFT PRESETS LOGIC ---
  const [customPresets, setCustomPresets] = useState([]);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetStart, setNewPresetStart] = useState('16:00');
  const [newPresetEnd, setNewPresetEnd] = useState('21:00');

  useEffect(() => {
    const saved = localStorage.getItem(`customPresets_${appUser?.restaurantId}`);
    if (saved) {
      setCustomPresets(JSON.parse(saved));
    } else {
      const seed = [ 
        { id: '1', label: "9a-3p", start: "09:00", end: "15:00" }, { id: '2', label: "10a-4p", start: "10:00", end: "16:00" }, 
        { id: '3', label: "10a-9p", start: "10:00", end: "21:00" }, { id: '4', label: "11a-3p", start: "11:00", end: "15:00" }, 
        { id: '5', label: "11a-4p", start: "11:00", end: "16:00" }, { id: '6', label: "4p-9p", start: "16:00", end: "21:00" }
      ];
      setCustomPresets(seed);
      localStorage.setItem(`customPresets_${appUser?.restaurantId}`, JSON.stringify(seed));
    }
  }, [appUser?.restaurantId]);

  const saveCustomPresetsLocally = (newPresets) => {
    setCustomPresets(newPresets);
    localStorage.setItem(`customPresets_${appUser?.restaurantId}`, JSON.stringify(newPresets));
  };

  const SHIFT_PRESETS = [
    ...[...customPresets].sort((a,b) => a.start.localeCompare(b.start)),
    { id: 'custom', label: "Custom", start: "", end: "" }
  ];

  const handlePresetChange = (e) => { 
    const val = e.target.value; 
    setPresetShift(val); 
    const p = SHIFT_PRESETS.find(x => x.label === val); 
    if (p && val !== 'Custom') { 
      setStartTime(p.start); 
      setEndTime(p.end); 
    } 
  };

  const handleSavePreset = (e) => {
    e.preventDefault();
    if (!newPresetLabel || !newPresetStart || !newPresetEnd) return;
    
    if (editingPresetId) {
      const updated = customPresets.map(p => 
        p.id === editingPresetId ? { ...p, label: newPresetLabel.trim(), start: newPresetStart, end: newPresetEnd } : p
      );
      saveCustomPresetsLocally(updated);
      addToast('Updated', 'Shift preset updated.');
    } else {
      const newPreset = {
        id: Date.now().toString(),
        label: newPresetLabel.trim(),
        start: newPresetStart,
        end: newPresetEnd
      };
      saveCustomPresetsLocally([...customPresets, newPreset]);
      addToast('Saved', 'New shift preset added.');
    }
    cancelPresetEdit();
  };

  const handleEditPreset = (preset) => {
    setNewPresetLabel(preset.label);
    setNewPresetStart(preset.start);
    setNewPresetEnd(preset.end);
    setEditingPresetId(preset.id);
    document.getElementById('preset-modal-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelPresetEdit = () => {
    setNewPresetLabel('');
    setNewPresetStart('16:00');
    setNewPresetEnd('21:00');
    setEditingPresetId(null);
  };

  const handleDeletePreset = (id) => {
    if(window.confirm('Delete this preset?')) {
      const filtered = customPresets.filter(p => p.id !== id);
      saveCustomPresetsLocally(filtered);
    }
  };

  // --- PAYROLL DATE RANGE ---
  const [periodStart, setPeriodStart] = useState(`${monthStr}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);

  // --- LABOR & FINANCIAL TARGETS ---
  const [isTargetSettingsOpen, setIsTargetSettingsOpen] = useState(false);
  const [targetSales, setTargetSales] = useState(appUser?.systemSettings?.targetSales || '0');
  const [targetLaborPct, setTargetLaborPct] = useState(appUser?.systemSettings?.targetLaborPct || '0');
  
  const handleSaveTargets = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "restaurants", appUser.restaurantId), {
        'systemSettings.targetSales': parseFloat(targetSales) || 0,
        'systemSettings.targetLaborPct': parseFloat(targetLaborPct) || 0,
        'systemSettings.enableTargets': true
      });
      addToast('Saved', 'Financial and labor targets updated.');
      setIsTargetSettingsOpen(false);
    } catch (err) { addToast('Error', err.message); }
  };

  useEffect(() => {
    setPeriodStart(`${monthStr}-01`);
    setPeriodEnd(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);
  }, [monthStr]);

  const activeRoster = users.filter(u => u.isActive !== false);

  const displayUsers = [...activeRoster].sort((a,b) => {
    const roleA = a.role || 'Unassigned';
    const roleB = b.role || 'Unassigned';
    const nameA = a.name || 'Unknown';
    const nameB = b.name || 'Unknown';
    return roleA === roleB ? nameA.localeCompare(nameB) : roleA.localeCompare(roleB);
  });
  
  const groupedUsers = activeRoster.reduce((acc, user) => {
    const role = user.role || 'Unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});
  const sortedRoles = Object.keys(groupedUsers).sort();

  const getRoleColors = (role, isPublished) => {
    if (!isPublished) return 'bg-slate-400 text-slate-900';
    const r = (role || '').toLowerCase();
    if (r.includes('bartender')) return 'bg-blue-400 text-blue-950';
    if (r.includes('cook') || r.includes('chef') || r.includes('kitchen')) return 'bg-orange-400 text-orange-950';
    if (r.includes('server') || r.includes('wait')) return 'bg-pink-400 text-pink-950';
    if (r.includes('host')) return 'bg-emerald-400 text-emerald-950';
    if (r.includes('manager')) return 'bg-purple-400 text-purple-950';
    if (r.includes('dish')) return 'bg-cyan-400 text-cyan-950';
    return 'bg-[#D4A381] text-slate-900'; 
  };

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    const validDates = [];
    for (const d of assignDates) { 
      const existingShift = monthShifts.find(s => s.date === d && s.employeeId === emp.id);
      if (existingShift) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is already scheduled on ${formatDisplayDate(d)}.`); return; }
      
      const req = timeOffRequests.find(r => r.date === d && r.userId === emp.id && r.status !== 'pending');
      if (req) {
        if (!req.isPartial) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} requested ${formatDisplayDate(d)} off.`); return; } 
        else { const reqEnd = req.endTime || '23:59'; if ((startTime < reqEnd) && (endTime > req.startTime)) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`); return; } }
      }
      validDates.push(d);
    }
    for (const d of validDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role || 'Unassigned', startTime: startTime, endTime: endTime, isPublished: false, restaurantId: appUser.restaurantId }); }
    setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shifts.`);
  };

const handlePublish = async () => { 
    if(!window.confirm("Publish schedule? Notifications will be sent.")) return; 
    
    const unpub = shifts.filter(s => !s.isPublished); 
    
    if (unpub.length === 0) {
      addToast('Notice', 'No unpublished shifts found.');
      return;
    }
    
    addToast('Publishing...', `Pushing ${unpub.length} shifts live. Please wait.`);
    
    try {
      await Promise.all(unpub.map(s => updateDoc(doc(db, "shifts", s.id), { isPublished: true })));
      
      addToast("Published", "Schedule is live."); 
      logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', `Pushed ${unpub.length} shifts live.`); 

// --- NEW: TRIGGER PUSH NOTIFICATIONS ---
      try {
        addToast('Pinging Server', 'Sending alert request to Vercel...');
        const pushRes = await fetch('/api/send-schedule-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            restaurantId: appUser.restaurantId,
            restaurantName: appUser.restaurantName || 'Your restaurant'
          })
        });
        
        const pushData = await pushRes.json();
        console.log("VERCEL RESPONSE:", pushData);
        
        if (pushData.message) {
          // This catches the "No devices registered" silent exit
          addToast('Server Reply', pushData.message); 
        } else if (pushData.success) {
          addToast('Alerts Sent!', `Successfully pushed to ${pushData.sentCount} devices.`);
        } else {
          addToast('API Error', pushData.error || 'Unknown server error');
        }

      } catch (pushErr) {
        console.error("Failed to send push notifications:", pushErr);
        addToast('Network Error', 'Failed to reach Vercel API.');
      }

    } catch (err) {
      addToast("Error", "Some shifts failed to publish. Check connection and try again.");
    }
  };
  
  const handleAddEvent = async (e) => { 
    e.preventDefault(); 
    if(!eventTitle.trim()) return; 
    setIsEventUploading(true);

    let photoUrl = null;
    if (eventImageFile) {
      try {
        const fileRef = ref(storage, `events/${appUser.restaurantId}/${Date.now()}_${eventImageFile.name}`);
        await uploadBytes(fileRef, eventImageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsEventUploading(false);
        return;
      }
    }

    const eventData = { date: eventDate, time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim() };
    if (photoUrl) eventData.imageUrl = photoUrl; 

    if (editingEventId) {
      await updateDoc(doc(db, "events", editingEventId), eventData);
      addToast('Updated', 'Event modified successfully.');
    } else {
      await addDoc(collection(db, "events"), { type: 'special_event', ...eventData, addedBy: appUser.name, restaurantId: appUser.restaurantId }); 
      addToast('Event Added', 'Calendar updated.');
    }
    setEventTitle(''); setEventTime(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventUploading(false); setIsEventModalOpen(false); 
  };

  const openEditEventModal = (ev) => {
    setEventDate(ev.date); setEventTime(ev.time || ''); setEventTitle(ev.title || ''); setEventNotes(ev.notes || ''); setEditingEventId(ev.id); setEventImageFile(null); setIsEventModalOpen(true);
  };

  const openNewEventModal = () => {
    setEventDate(currentDate); setEventTime(''); setEventTitle(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventModalOpen(true);
  };

  // --- AUTO-POPULATE SCHEDULE ENGINE ---
  const handleAutoPopulate = async () => {
    if (!autoPopSourceMonth) return addToast('Error', 'Please select a source month.');
    const sourceShifts = shifts.filter(s => s.date.startsWith(autoPopSourceMonth));
    if (sourceShifts.length === 0) return addToast('Empty', 'No shifts found in the selected month.');

    const targetMonth = getMonthStr(currentDate);
    if (autoPopSourceMonth === targetMonth) return addToast('Error', 'Cannot copy to the exact same month.');

    // Calculate Day Offset to cleanly align days of the week (Monday to Monday)
    let sMon = new Date(autoPopSourceMonth + '-01T12:00:00');
    while(sMon.getDay() !== 1) sMon.setDate(sMon.getDate() + 1);

    let tMon = new Date(targetMonth + '-01T12:00:00');
    while(tMon.getDay() !== 1) tMon.setDate(tMon.getDate() + 1);

    const dayOffset = Math.round((tMon - sMon) / (1000 * 60 * 60 * 24));

    let addedCount = 0;
    for (const s of sourceShifts) {
      const sDate = new Date(s.date + 'T12:00:00');
      sDate.setDate(sDate.getDate() + dayOffset);
      const newDateStr = sDate.toISOString().split('T')[0];

      if (newDateStr.startsWith(targetMonth)) {
        // Prevent exact duplicates 
        const exists = shifts.find(existing => existing.date === newDateStr && existing.employeeId === s.employeeId && existing.role === s.role && existing.startTime === s.startTime && existing.endTime === s.endTime);
        
        if (!exists) {
          await addDoc(collection(db, "shifts"), { 
            date: newDateStr, 
            employeeId: s.employeeId, 
            role: s.role, 
            startTime: s.startTime, 
            endTime: s.endTime, 
            isPublished: false, 
            restaurantId: appUser.restaurantId 
          });
          addedCount++;
        }
      }
    }
    setIsAutoPopulateModalOpen(false);
    setAutoPopSourceMonth('');
    addToast('Populated', `Drafted ${addedCount} shifts. Conflicts are highlighted in red.`);
  };

  // --- LABOR PROJECTION ENGINE ---
  const calculateShiftHours = (start, end) => {
    if (!start || !end) return 0;
    let sH = parseInt(start.split(':')[0]), sM = parseInt(start.split(':')[1]) / 60;
    let eH = parseInt(end.split(':')[0]), eM = parseInt(end.split(':')[1]) / 60;
    let total = (eH + eM) - (sH + sM);
    if (total < 0) total += 24; 
    return total;
  };

  let projectedMonthLabor = 0;
  const projectedDailyLabor = {};
  monthDays.forEach(d => projectedDailyLabor[d] = 0);

  monthShifts.forEach(shift => {
    const emp = users.find(u => u.id === shift.employeeId);
    const wage = emp?.wage || 0; 
    const hours = calculateShiftHours(shift.startTime, shift.endTime);
    const cost = hours * wage;
    
    projectedMonthLabor += cost;
    if (projectedDailyLabor[shift.date] !== undefined) {
      projectedDailyLabor[shift.date] += cost;
    }
  });

  const periodPunches = timePunches.filter(p => p.date >= periodStart && p.date <= periodEnd).sort((a,b) => new Date(a.clockInTime || 0) - new Date(b.clockInTime || 0));
  
  const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
      if (!inTime || !outTime) return 0;
      const rawMins = (new Date(outTime) - new Date(inTime)) / 60000;
      return Math.max(0, (rawMins - breakMins) / 60);
  };

  const getWeekStart = (dateString) => {
      const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
      let d = new Date(dateString + 'T12:00:00');
      while (d.getDay() !== startDayInt) { d.setDate(d.getDate() - 1); }
      return d.toISOString().split('T')[0];
  };
  const payrollSummary = {};
  const weeklyHours = {}; 
  const OT_THRESHOLD = parseFloat(appUser?.systemSettings?.overtime || 40);

  periodPunches.forEach(p => {
      if (p.status === 'clocked_in' || !p.clockOutTime) return;
      
      const emp = users.find(u => u.id === p.employeeId);
      if (!payrollSummary[p.employeeId]) {
          payrollSummary[p.employeeId] = {
              name: p.employeeName || 'Unknown', regHours: 0, otHours: 0, cashTips: 0, creditTips: 0, rate: emp?.wage || 0, pay: 0
          };
      }
      
      const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
      const weekKey = `${p.employeeId}_${getWeekStart(p.date)}`;
      const prevWeeklyHours = weeklyHours[weekKey] || 0;
      const newWeeklyHours = prevWeeklyHours + hours;
      
      let reg = 0; let ot = 0;
      if (prevWeeklyHours >= OT_THRESHOLD) { ot = hours; } else if (newWeeklyHours > OT_THRESHOLD) { reg = OT_THRESHOLD - prevWeeklyHours; ot = newWeeklyHours - OT_THRESHOLD; } else { reg = hours; }
      
      weeklyHours[weekKey] = newWeeklyHours;
      payrollSummary[p.employeeId].regHours += reg; payrollSummary[p.employeeId].otHours += ot;
      payrollSummary[p.employeeId].cashTips += (parseFloat(p.cashTips) || 0); payrollSummary[p.employeeId].creditTips += (parseFloat(p.creditTips) || 0);
      
      const rate = emp?.wage || 0;
      payrollSummary[p.employeeId].pay += (reg * rate) + (ot * rate * 1.5);
  });
  
  const summaryList = Object.values(payrollSummary).sort((a, b) => a.name.localeCompare(b.name));
  const actualPeriodLabor = summaryList.reduce((acc, s) => acc + s.pay, 0);

  const handleForceClockOut = async (punch) => {
      if (!window.confirm(`Force clock out ${punch.employeeName}?`)) return;
      await updateDoc(doc(db, "timePunches", punch.id), { clockOutTime: new Date().toISOString(), status: 'clocked_out' });
      addToast('Updated', `Punched out ${punch.employeeName}.`);
  };

  const handleDeletePunch = async (id) => {
      if (!window.confirm("Delete this time punch permanently?")) return;
      await deleteDoc(doc(db, "timePunches", id));
      addToast('Deleted', 'Time punch removed.');
  };

const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [editingPunch, setEditingPunch] = useState(null);
  const [editPunchEmpId, setEditPunchEmpId] = useState(''); // NEW: For creating punches
  const [editPunchIn, setEditPunchIn] = useState('');
  const [editPunchOut, setEditPunchOut] = useState('');
  const [editBreakMins, setEditBreakMins] = useState('');
  const [editCash, setEditCash] = useState('');
  const [editCredit, setEditCredit] = useState('');

  const openEditPunchModal = (punch) => {
    setEditingPunch(punch);
    const formatForInput = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setEditPunchIn(formatForInput(punch.clockInTime));
    setEditPunchOut(punch.clockOutTime && punch.status === 'clocked_out' ? formatForInput(punch.clockOutTime) : '');
    setEditBreakMins(punch.breakMinutes || 0);
    setEditCash(punch.cashTips || 0);
    setEditCredit(punch.creditTips || 0);
    setIsPunchModalOpen(true);
  };

  const openAddPunchModal = () => {
    setEditingPunch(null);
    setEditPunchEmpId('');
    setEditPunchIn('');
    setEditPunchOut('');
    setEditBreakMins('0');
    setEditCash('0');
    setEditCredit('0');
    setIsPunchModalOpen(true);
  };

  const handleSavePunchEdit = async (e) => {
    e.preventDefault();
    try {
      if (editingPunch) {
        if (!editPunchIn) return;
        const updateData = { clockInTime: new Date(editPunchIn).toISOString(), breakMinutes: parseFloat(editBreakMins) || 0, cashTips: parseFloat(editCash) || 0, creditTips: parseFloat(editCredit) || 0 };
        if (editPunchOut) { updateData.clockOutTime = new Date(editPunchOut).toISOString(); updateData.status = 'clocked_out'; } else { updateData.clockOutTime = null; updateData.status = 'clocked_in'; }
        await updateDoc(doc(db, "timePunches", editingPunch.id), updateData);
        addToast('Updated', 'Time punch modified successfully.');
      } else {
        if (!editPunchEmpId || !editPunchIn) return addToast('Error', 'Employee and Clock In Time required.');
        const emp = users.find(u => u.id === editPunchEmpId);
        const newData = {
          employeeId: emp.id,
          employeeName: emp.name,
          clockInTime: new Date(editPunchIn).toISOString(),
          breakMinutes: parseFloat(editBreakMins) || 0,
          cashTips: parseFloat(editCash) || 0,
          creditTips: parseFloat(editCredit) || 0,
          date: editPunchIn.split('T')[0], // Extract YYYY-MM-DD
          restaurantId: appUser.restaurantId
        };
        if (editPunchOut) { newData.clockOutTime = new Date(editPunchOut).toISOString(); newData.status = 'clocked_out'; } 
        else { newData.clockOutTime = null; newData.status = 'clocked_in'; }
        await addDoc(collection(db, "timePunches"), newData);
        addToast('Added', 'Missing time punch created.');
      }
      setIsPunchModalOpen(false);
      setEditingPunch(null);
    } catch (err) { addToast('Error', err.message); }
  };

const handleExportTimesheets = () => {
    if (periodPunches.length === 0) return addToast("Empty", "No punches to export for this period.");
    const pStartStr = new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const pEndStr = new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Header for the Payroll Summary
    let csv = `"--- PAYROLL SUMMARY ---"\n"Pay Period: ${pStartStr} - ${pEndStr}"\n\n"Employee Name","Reg Hours","OT Hours","Hourly Rate","Total Gross Pay","Declared Cash Tips","Declared Credit Tips"\n`;
    summaryList.forEach(s => { 
      csv += `"${s.name}","${s.regHours.toFixed(2)}","${s.otHours.toFixed(2)}","$${s.rate.toFixed(2)}","$${s.pay.toFixed(2)}","$${s.cashTips.toFixed(2)}","$${s.creditTips.toFixed(2)}"\n`; 
    });
    
    // Header for Individual Punches
    csv += '\n"--- INDIVIDUAL PUNCHES ---"\n"Employee Name","Date","Clock In","Clock Out","Break (Mins)","Total Hours","Hourly Rate","Total Pay","Cash Tips","Credit Tips"\n';
    
    const sortedPunches = [...periodPunches].sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));
    sortedPunches.forEach(p => {
       const emp = users.find(u => u.id === p.employeeId); 
       const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0); 
       const rate = emp?.wage || 0; 
       const estCost = hours * rate; 
       const inStr = p.clockInTime ? new Date(p.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown';
       const outStr = p.status === 'clocked_in' ? 'ON CLOCK' : (p.clockOutTime ? new Date(p.clockOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown');
       
       csv += `"${p.employeeName || 'Unknown'}","${p.date || 'Unknown'}","${inStr}","${outStr}","${p.breakMinutes||0}","${hours.toFixed(2)}","$${rate.toFixed(2)}","$${estCost.toFixed(2)}","$${parseFloat(p.cashTips||0).toFixed(2)}","$${parseFloat(p.creditTips||0).toFixed(2)}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); 
    link.setAttribute("href", url); 
    link.setAttribute("download", `Payroll_Export_${periodStart}_to_${periodEnd}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    URL.revokeObjectURL(url); 
    addToast('Exported', 'Spreadsheet generated.');
  };

  const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
  const endDayInt = startDayInt === 0 ? 6 : startDayInt - 1;

  const weeksInMonth = []; let currentWeek = [];
  monthDays.forEach(d => { currentWeek.push(d); if (new Date(d+'T12:00').getDay() === endDayInt) { weeksInMonth.push(currentWeek); currentWeek = []; } });
  if (currentWeek.length > 0) weeksInMonth.push(currentWeek);

  const scheduledHours = displayUsers.map(u => {
     const userShifts = monthShifts.filter(s => s.employeeId === u.id);
     const weekly = weeksInMonth.map(weekDaysArr => { return weekDaysArr.reduce((sum, d) => { const shift = userShifts.find(s => s.date === d); return sum + (shift ? calculateShiftHours(shift.startTime, shift.endTime) : 0); }, 0); });
     return { id: u.id, name: u.name, weekly, total: weekly.reduce((a,b)=>a+b,0) };
  }).filter(u => u.total > 0);

  return (
    <div className="space-y-4 pb-12 w-full">

{/* MANAGER EXPLANATION BANNER */}
      {timeOffRequests.filter(r => r.status === 'pending' && r.date.startsWith(monthStr)).length > 0 && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-3">
            <Shield className="text-red-500 flex-shrink-0 animate-pulse" size={24} />
            <div>
              <h3 className="text-red-400 font-black text-sm uppercase tracking-widest">Action Required</h3>
              <p className="text-xs text-red-200/80 font-medium mt-0.5">
                You have pending time-off requests this month. Go to <strong className="text-white">My Shift {'->'} Request Off</strong> to approve them in the Master Override Log.
              </p>
            </div>
          </div>
        </div>
      )}

    
      {/* --- AUTO POPULATE MODAL --- */}
      <Modal isOpen={isAutoPopulateModalOpen} onClose={() => setIsAutoPopulateModalOpen(false)} title="Auto-Populate Schedule">
        <div className="space-y-4">
          <p className="text-xs text-slate-300 font-bold leading-relaxed">
            Select a previous month to copy shifts from. <br/><br/>
            <span className="text-[#D4A381]">Smart Mapping:</span> Days will automatically align to match the correct day of the week (e.g. 1st Monday to 1st Monday). All copied shifts will be added as unpublished drafts.
          </p>
          <div>
            <label className={T.label}>Source Month</label>
            <input type="month" value={autoPopSourceMonth} onChange={e=>setAutoPopSourceMonth(e.target.value)} className={T.input} />
          </div>
          <button onClick={handleAutoPopulate} className={`w-full ${T.btn} py-3`}>Copy Schedule</button>
        </div>
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title={editingEventId ? "Edit Special Event" : "Add Special Event"}>
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={T.label}>Date</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className={T.input} required/></div>
         <div>
              <label className={T.label}>Time (Optional)</label>
              <input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className={T.input}/>
            </div>
          </div>
        <div><label className={T.label}>Event Title</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className={T.input} placeholder="e.g., Packers Playoff Game" required/></div>
          <div>
            <label className={T.label}>Notes & Photo (Optional)</label>
            <textarea rows="2" value={eventNotes} onChange={e=>setEventNotes(e.target.value)} className={`${T.input} mb-2`} placeholder="Extra details..."/>
            
            {eventImageFile && (
              <div className="text-xs text-emerald-400 font-bold bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50 flex justify-between items-center mb-2">
                <span className="truncate pr-2">📷 {eventImageFile.name} attached</span>
                <button type="button" onClick={()=>setEventImageFile(null)} className="text-red-400 hover:text-red-300 p-1"><X size={14}/></button>
              </div>
            )}
            
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full">
              <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-12 ${isEventUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:w-16 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                    <Camera size={20} />
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
                 <label className="flex-1 sm:w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381]" title="Upload Photo">
                    <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                    <input type="file" accept="image/*" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
              </div>
              <button type="submit" disabled={isEventUploading || !eventTitle.trim()} className={`flex-1 sm:flex-1 ${T.btn} h-12 disabled:opacity-50 flex items-center justify-center`}>
                {isEventUploading ? <Loader2 className="animate-spin" size={20}/> : (editingEventId ? 'Update Event' : 'Save Event')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

<Modal isOpen={isPunchModalOpen} onClose={()=>setIsPunchModalOpen(false)} title={editingPunch ? `Edit Punch: ${editingPunch?.employeeName}` : "Add Missing Time Punch"}>
        <form onSubmit={handleSavePunchEdit} className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          {!editingPunch && (
            <div>
              <label className={T.label}>Select Employee</label>
              <select value={editPunchEmpId} onChange={e=>setEditPunchEmpId(e.target.value)} className={T.input} required>
                <option value="">-- Select Staff Member --</option>
                {users.filter(u => u.isActive !== false).sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={T.label}>Clock In Time</label>
              <input type="datetime-local" value={editPunchIn} onChange={e=>setEditPunchIn(e.target.value)} className={T.input} required/>
            </div>
            <div>
              <label className={T.label}>Clock Out Time (Leave blank if currently on clock)</label>
              <input type="datetime-local" value={editPunchOut} onChange={e=>setEditPunchOut(e.target.value)} className={T.input}/>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={T.label}>Break (Mins)</label>
              <input type="number" min="0" value={editBreakMins} onChange={e=>setEditBreakMins(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Cash Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCash} onChange={e=>setEditCash(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Credit Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCredit} onChange={e=>setEditCredit(e.target.value)} className={T.input}/>
            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn}`}>{editingPunch ? 'Save Changes' : 'Create Time Punch'}</button>
        </form>
      </Modal>

      {/* --- PRESET MANAGER MODAL --- */}
      <Modal isOpen={isPresetModalOpen} onClose={() => { setIsPresetModalOpen(false); cancelPresetEdit(); }} title="Manage Custom Shifts">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 pb-10">
            <form id="preset-modal-form" onSubmit={handleSavePreset} className="space-y-3 p-4 bg-[#1A2126] border border-[#2A353D] rounded-xl">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-[#D4A381] uppercase tracking-widest">{editingPresetId ? 'Edit Preset' : 'Add New Preset'}</h4>
                    {editingPresetId && <button type="button" onClick={cancelPresetEdit} className="text-xs font-bold text-slate-400 hover:text-white transition-colors">Cancel ✖</button>}
                </div>
                <div>
                    <label className={T.label}>Label (e.g., "Mid Shift 12p-5p")</label>
                    <input type="text" value={newPresetLabel} onChange={e=>setNewPresetLabel(e.target.value)} className={T.input} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={T.label}>Start Time</label>
                        <select value={newPresetStart} onChange={e=>setNewPresetStart(e.target.value)} className={T.input} required>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatShortTime(t)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={T.label}>End Time</label>
                        <select value={newPresetEnd} onChange={e=>setNewPresetEnd(e.target.value)} className={T.input} required>
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatShortTime(t)}</option>)}
                        </select>
                    </div>
                </div>
                <button type="submit" className={`w-full ${T.btn} py-3 text-sm flex items-center justify-center`}><Plus size={18} className="inline mr-2"/> {editingPresetId ? 'Update Preset' : 'Save Custom Time'}</button>
            </form>

            <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-[#2A353D] pb-2">Your Custom Shifts</h4>
                {customPresets.length === 0 && <p className="text-xs font-bold text-slate-500 text-center p-4 border border-dashed border-[#2A353D] rounded-xl">No custom times added yet.</p>}
                {customPresets.map(preset => (
                    <div key={preset.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-lg border border-[#2A353D]">
                        <div>
                            <div className="font-bold text-base text-white">{preset.label}</div>
                            <div className="text-xs font-mono font-bold text-[#D4A381]">{formatShortTime(preset.start)} - {formatShortTime(preset.end)}</div>
                        </div>
                        <div className="flex items-center gap-1 border-l border-[#2A353D] pl-2 ml-2">
                            <button type="button" onClick={() => handleEditPreset(preset)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#1A2126] rounded border border-[#2A353D]">
                                <Edit size={16}/>
                            </button>
                            <button type="button" onClick={() => handleDeletePreset(preset.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#1A2126] rounded border border-[#2A353D]">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </Modal>

      {/* TOP NAVIGATION TOGGLE */}
      <div className="flex flex-wrap gap-2 border-b border-[#2A353D] pb-3 mb-4">
        <button onClick={() => setSubTab('schedule')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'schedule' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Schedule Maker</button>
        <button onClick={() => setSubTab('events')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'events' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Events Ledger</button>
        {appUser?.isAdmin && (
          <button onClick={() => setSubTab('timesheets')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'timesheets' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Timesheets & Labor</button>
        )}
      </div>

      {subTab === 'schedule' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          
          <div className={`${T.card} p-3 sm:p-4 flex flex-col 2xl:flex-row gap-3 items-center justify-between`}>
            <div className="flex flex-wrap xl:flex-nowrap gap-3 w-full 2xl:w-auto items-center">
              
              {/* Staff Selector */}
              <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className={`${T.input} w-full sm:w-auto sm:flex-1 xl:w-40 py-2.5 px-3 text-sm font-bold h-12 shadow-inner shrink-0`}>
                <option value="">-- Select Staff --</option>
                {displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              
              {/* Preset Selector & Edit Button */}
              <div className="flex gap-2 items-center w-full sm:w-auto sm:flex-1 xl:w-auto shrink-0">
                <select value={presetShift} onChange={handlePresetChange} className={`${T.input} w-full py-2.5 px-3 text-sm font-bold h-12 shadow-inner`}>
                  {SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
                <button onClick={() => setIsPresetModalOpen(true)} className="px-4 bg-[#12161A] text-slate-400 hover:text-[#D4A381] border border-[#2A353D] rounded-xl transition-colors h-12 flex items-center justify-center shrink-0 shadow-sm" title="Edit Presets">
                  <Edit size={18} />
                </button>
              </div>

        {/* Custom Time Overrides */}
              <div className="flex gap-2 w-full sm:w-auto sm:flex-1 xl:w-auto shrink-0">
                <div className="relative flex-1 xl:w-32">
                    <span className="absolute -top-2.5 left-2 bg-[#1A2126] px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">In</span>
                    <input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-full py-2.5 px-2 text-sm font-bold h-12 shadow-inner`}/>
                </div>
                <div className="relative flex-1 xl:w-32">
                    <span className="absolute -top-2.5 left-2 bg-[#1A2126] px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Out</span>
                    <input type="time" value={endTime} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-full py-2.5 px-2 text-sm font-bold h-12 shadow-inner`}/>
                </div>
              </div>

              {/* Assign Button */}
              <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className={`w-full xl:w-auto ${T.btn} py-2.5 px-6 text-sm h-12 disabled:opacity-50 flex items-center justify-center shadow-lg shrink-0 whitespace-nowrap`}>Assign ({assignDates.length})</button>

            </div>
            
            {/* Action Row */}
            <div className="flex w-full 2xl:w-auto gap-2 items-center pt-3 2xl:pt-0 border-t 2xl:border-t-0 border-[#2A353D]">
              <div className="hidden sm:flex flex-col items-end mr-3 bg-[#12161A] border border-[#2A353D] px-4 py-1.5 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Proj. Month Labor</span>
                <span className="text-emerald-400 font-black text-base">${projectedMonthLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <button onClick={() => setIsAutoPopulateModalOpen(true)} className={`flex-1 2xl:flex-none ${T.btnAlt} border-blue-900/50 text-blue-400 py-2.5 h-12 flex items-center justify-center font-black`}><Repeat size={16} className="mr-1"/> Auto-Fill</button>
              <button onClick={handlePublish} className={`flex-1 2xl:flex-none ${T.btnAlt} py-2.5 h-12 flex items-center justify-center font-black`}>Publish</button>
              <button onClick={openNewEventModal} className={`flex-1 2xl:flex-none ${T.btnAlt} border-[#D4A381] text-[#D4A381] py-2.5 h-12 flex items-center justify-center font-black`}><Plus size={16} className="mr-1"/> Event</button>
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
                            const req = timeOffRequests.find(r=>r.date===d&&r.userId===u.id && r.status !== 'pending'); 
                            const sel = assignDates.includes(d) && selectedEmp===u.id;

                            // Conflict Check: Alert if a shift overlaps with ANY time-off request (pending or approved)
                            const allUserReqs = timeOffRequests.filter(r => r.date === d && r.userId === u.id);
                            const hasConflict = shift && allUserReqs.some(r => {
                               if (!r.isPartial) return true; // Full day off conflict
                               return (shift.startTime < (r.endTime || '23:59')) && (shift.endTime > (r.startTime || '00:00'));
                            });

                            return (
                            <td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-[#2A353D] cursor-pointer transition-all align-top h-7 sm:h-8 ${sel?'bg-[#8F6040] outline outline-2 outline-[#D4A381] shadow-inner z-0 relative':'hover:bg-[#12161A]'}`}>
                            <div className="flex flex-col gap-[1px] w-full justify-start overflow-hidden">
                              {req && !req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-red-400 bg-red-900/40 uppercase tracking-tighter" title="Requested Off">Off</div>}
                              {req && req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-amber-400 bg-amber-900/40 uppercase tracking-tighter truncate" title={`Off: ${formatShortTime(req.startTime)}-${formatShortTime(req.endTime)}`}>{formatShortTime(req.startTime)}-{formatShortTime(req.endTime)}</div>}
                              {shift && (
                                <div 
                                  className={`w-full rounded font-bold text-[7px] sm:text-[8px] py-0.5 text-center truncate ${getRoleColors(shift.role, shift.isPublished)} ${hasConflict ? 'border-2 border-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''}`} 
                                  title={`${formatShortTime(shift.startTime)} - ${formatShortTime(shift.endTime)} ${hasConflict ? '(CONFLICT DETECTED)' : ''}`}
                                >
                                  {formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}
                                </div>
                              )}
                            </div>
                          </td>)
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr className="bg-[#0B0E11] border-t-2 border-[#D4A381]/30">
                    <td className={`px-2 py-2 text-[8px] font-black uppercase tracking-widest text-[#D4A381] sticky left-0 z-10 border-r border-[#2A353D] text-right shadow-md`}>
                      Proj. Cost
                    </td>
                    {monthDays.map(d => (
                      <td key={`cost-${d}`} className={`p-1 border-r border-[#2A353D] text-center align-middle font-black text-[9px] sm:text-[10px] ${projectedDailyLabor[d] > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        ${projectedDailyLabor[d].toFixed(0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className={`${T.card} overflow-hidden mt-6`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-sm flex items-center gap-2 ${T.copper}`}><Clock className={T.copper} size={16}/> Scheduled Hours Tracker</h3>
              <span className={`text-[9px] font-bold ${T.muted} uppercase tracking-widest`}>OT Threshold: {appUser?.systemSettings?.overtime || 40}h</span>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#1A2126] border-b border-[#2A353D] text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-3 border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 w-24">Employee</th>
                    {weeksInMonth.map((w, i) => <th key={i} className="p-3 text-center border-r border-[#2A353D]">Wk {i+1}<div className="text-[7px] text-slate-600 mt-0.5">{parseInt(w[0].split('-')[2])}-{parseInt(w[w.length-1].split('-')[2])}</div></th>)}
                    <th className="p-3 text-center text-[#D4A381]">Month Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A353D]">
                  {scheduledHours.length === 0 && <tr><td colSpan={weeksInMonth.length + 2} className="p-6 text-center text-slate-500 font-bold">No hours scheduled yet.</td></tr>}
                  {scheduledHours.map(u => (
                    <tr key={u.id} className="hover:bg-[#12161A]/50 transition-colors">
                      <td className="p-3 font-bold text-white border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 truncate">{u.name.split(' ')[0]}</td>
                      {u.weekly.map((hrs, i) => (
                        <td key={i} className={`p-3 text-center font-black border-r border-[#2A353D] ${hrs > parseFloat(appUser?.systemSettings?.overtime || 40) ? 'text-red-500 bg-red-900/10' : hrs > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {hrs > 0 ? hrs.toFixed(1) : '-'}
                        </td>
                      ))}
                      <td className="p-3 text-center font-black text-[#D4A381] bg-[#12161A]/30">{u.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- THE NEW EVENTS LEDGER SUB-TAB --- */}
      {subTab === 'events' && (
        <div className="animate-[slideIn_0.2s_ease-out] space-y-4">
          <div className="flex gap-2">
             <button onClick={openNewEventModal} className={`${T.btn} flex items-center justify-center gap-2`}><Plus size={16}/> Add Special Event</button>
          </div>
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
                  <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white">{ev.title} {ev.time && <span className="text-[#D4A381] ml-2">@ {formatShortTime(ev.time)}</span>}</h4>
                      {ev.notes && <p className="text-xs text-slate-300 mt-1 font-medium bg-[#12161A] p-2 rounded-lg border border-[#2A353D] whitespace-pre-wrap">{ev.notes}</p>}
                      {ev.imageUrl && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#2A353D] shadow-inner bg-[#0B0E11] max-w-sm">
                          <img src={ev.imageUrl} alt="Attached" className="w-full max-h-48 object-contain" />
                        </div>
                      )}
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
      )}

{/* THE TIMESHEET SUB-TAB (Secured & Safed) */}
      {subTab === 'timesheets' && appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}>Payroll</h3>
              <div className="flex items-center gap-2 bg-[#1A2126] border border-[#2A353D] p-1.5 rounded-lg shadow-inner">
                 <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
                 <span className="text-slate-500 font-black text-[10px] uppercase">to</span>
                 <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={openAddPunchModal} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-[#D4A381] transition-colors flex items-center gap-2"><Plus size={14}/> Add Punch</button>
              <button onClick={handleExportTimesheets} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-emerald-400 transition-colors flex items-center gap-2">📋 Export CSV</button>
              <div className="bg-[#1A2126] border border-[#2A353D] px-3 py-1.5 rounded-lg flex flex-col items-end shadow-sm">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Period Labor</span>
                <span className="text-emerald-400 font-black text-sm">${actualPeriodLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

{/* TARGETS DASHBOARD */}
          {appUser?.systemSettings?.enableTargets && (
            <div className="bg-[#0B0E11] p-4 border-b border-[#2A353D] flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-6">
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Period Sales</div>
                   <div className="text-lg font-black text-white">${parseFloat(appUser.systemSettings.targetSales || 0).toLocaleString()}</div>
                 </div>
                 <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Labor %</div>
                   <div className="text-lg font-black text-white">{parseFloat(appUser.systemSettings.targetLaborPct || 0).toFixed(1)}%</div>
                 </div>
                 <div className="border-l border-[#2A353D] pl-6">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Period Labor %</div>
                   <div className={`text-lg font-black ${((actualPeriodLabor / parseFloat(appUser.systemSettings.targetSales || 1)) * 100) > parseFloat(appUser.systemSettings.targetLaborPct || 100) ? 'text-red-400' : 'text-emerald-400'}`}>
                     {appUser.systemSettings.targetSales > 0 ? ((actualPeriodLabor / parseFloat(appUser.systemSettings.targetSales)) * 100).toFixed(1) : '0.0'}%
                   </div>
                 </div>
              </div>
              <button onClick={() => setIsTargetSettingsOpen(!isTargetSettingsOpen)} className="text-xs font-bold text-slate-400 hover:text-[#D4A381] border border-[#2A353D] bg-[#1A2126] px-3 py-1.5 rounded-lg transition-colors">Configure Targets</button>
            </div>
          )}

          {!appUser?.systemSettings?.enableTargets && (
            <div className="bg-[#0B0E11] p-3 border-b border-[#2A353D] text-right">
              <button onClick={() => setIsTargetSettingsOpen(!isTargetSettingsOpen)} className="text-xs font-bold text-slate-400 hover:text-[#D4A381] transition-colors">Configure Financial Targets</button>
            </div>
          )}

          {isTargetSettingsOpen && (
            <form onSubmit={handleSaveTargets} className="p-4 bg-[#1A2126] border-b border-[#2A353D] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={T.label}>Period Sales Target ($)</label>
                  <input type="number" step="0.01" value={targetSales} onChange={e=>setTargetSales(e.target.value)} className={T.input} placeholder="e.g. 50000" />
                </div>
                <div>
                  <label className={T.label}>Target Labor Cost (%)</label>
                  <input type="number" step="0.1" value={targetLaborPct} onChange={e=>setTargetLaborPct(e.target.value)} className={T.input} placeholder="e.g. 25.5" />
                </div>
              </div>
              <div className="flex gap-2">
                 <button type="submit" className={`flex-1 ${T.btn} py-2 text-xs`}>Save Targets</button>
                 <button type="button" onClick={async () => { await updateDoc(doc(db, "restaurants", appUser.restaurantId), { 'systemSettings.enableTargets': false }); setIsTargetSettingsOpen(false); }} className={`px-4 bg-red-900/20 text-red-500 font-bold text-xs rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-colors`}>Disable</button>
              </div>
            </form>
          )}

          {summaryList.length > 0 && (
            <div className="p-4 border-b border-[#2A353D] bg-[#0B0E11]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Period Payroll Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {summaryList.map(s => (
                  <div key={s.name} className="bg-[#1A2126] p-3 rounded-xl border border-[#2A353D] flex justify-between items-center shadow-sm hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                        REG: {s.regHours.toFixed(2)}h | OT: {s.otHours.toFixed(2)}h
                      </div>
                      <div className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mt-0.5">
                        TIPS: ${(s.cashTips + s.creditTips).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[#D4A381] font-black text-lg">${s.pay.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`divide-y ${T.border}`}>
            {periodPunches.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No clock-ins recorded for this period.</div>}
            
            {periodPunches.sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0)).map(p => {
               const emp = users.find(u => u.id === p.employeeId);
               const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
               const cost = hours * (emp?.wage || 0);
               const isClockedIn = p.status === 'clocked_in' || p.status === 'on_break';
               
               const safeIn = p.clockInTime ? new Date(p.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'ERR';
               const safeOut = isClockedIn ? '---' : (p.clockOutTime ? new Date(p.clockOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'ERR');
               
               return (
                 <div key={p.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                   <div>
<div className="font-bold text-white text-base">
  {p.employeeName || 'Unknown'}
  {p.isUnscheduled && !p.isApproved && <span className="ml-2 text-[8px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-black align-middle">Unscheduled</span>}
</div>                     <div className={`text-[10px] font-black uppercase tracking-widest ${T.muted} mt-0.5`}>
                       {p.date ? formatDisplayDate(p.date) : 'Unknown Date'}
                     </div>
                   </div>
                   <div className="flex items-center gap-6">
                     <div className="text-right">
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-emerald-400">IN:</span> {safeIn}
                       </div>
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-red-400">OUT:</span> {safeOut}
                       </div>
                     </div>
                     <div className="text-right border-l border-[#2A353D] pl-6 w-24">
                       <div className={`text-sm font-black ${isClockedIn ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{isClockedIn ? 'ON CLOCK' : `${hours.toFixed(2)} hrs`}</div>
                       <div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest">${cost.toFixed(2)}</div>
                     </div>
                     <div className="flex gap-2 border-l border-[#2A353D] pl-4">
                       {isClockedIn && <button onClick={() => handleForceClockOut(p)} className="px-3 py-1 bg-red-900/20 text-red-500 text-[10px] font-black uppercase rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Force Out</button>}
    {p.isUnscheduled && !p.isApproved && <button onClick={() => updateDoc(doc(db, "timePunches", p.id), { isApproved: true })} className="px-3 py-1 bg-amber-900/20 text-amber-400 text-[10px] font-black uppercase rounded-lg border border-amber-900/50 hover:bg-amber-900/40 transition-colors animate-pulse">Approve</button>}
                       <button onClick={() => openEditPunchModal(p)} className="p-2 text-slate-400 hover:text-[#D4A381] bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Edit size={14}/></button>
                       <button onClick={() => handleDeletePunch(p.id)} className="p-2 text-slate-400 hover:text-red-500 bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Trash2 size={14}/></button>
                     </div>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPACT MONTH VIEW ---
const TabMonth = ({ currentDate, users, shifts }) => {
  const [roleFilter, setRoleFilter] = useState('All');
  const uniqueRoles = ['All', ...new Set(users.map(u => u.role).filter(Boolean))].sort();

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
            height: calc(100vh - 45px) !important; /* Math: 100% minus the header
 height to prevent page 2 bleed */
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
      
<div className="flex justify-between items-center p-2 no-print border-b border-[#2A353D] bg-[#12161A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">Filter Role:</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] text-xs font-bold rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-inner">
            {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? 'Whole Schedule' : r}</option>)}
          </select>
        </div>
        <button onClick={()=>window.print()} className={T.btnAlt}>🖨️ Print Calendar</button>
      </div>
      
      <div className="hidden print:block print-header">
        86chaos Schedule {roleFilter !== 'All' ? `- ${roleFilter}` : ''}   {formatDisplayMonth(monthStr)}
      </div>

      <div className={`grid grid-cols-7 border-t border-l ${T.border} print-grid`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}><span className="print-text-dark cell-header-text">{d}</span></div>)}
        
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}
        
{Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; 
const dayShifts = shifts
            .filter(s => s.date === date && s.isPublished && (roleFilter === 'All' || s.role === roleFilter))
            .sort((a, b) => {
              if (a.role !== b.role) return (a.role || '').localeCompare(b.role || '');
              return (a.startTime || '').localeCompare(b.startTime || '');
            });
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


// --- PREP, LINE CHECKS & TASKS COMMAND CENTER ---
const TabPrep = ({ currentDate, appUser, setLabelsToPrint }) => {
  const prepItems = useLiveCollection('prepItems', appUser?.restaurantId);
  const tasks = useLiveCollection('tasks', appUser?.restaurantId);
  const [subTab, setSubTab] = useState('prep');
  const [prepDate, setPrepDate] = useState(currentDate);

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

  // Line Check State
  const lineChecks = useLiveCollection('lineCheckItems', appUser?.restaurantId);
  const tempLogs = useLiveCollection('tempLogs', appUser?.restaurantId);
  
  const [lcSearch, setLcSearch] = useState('');
  const [lcName, setLcName] = useState('');
  const [lcCat, setLcCat] = useState('Cold Holding (≤ 41°F)');
  const [temps, setTemps] = useState({});
  const [editLineCheckItem, setEditLineCheckItem] = useState(null);

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
        delete dts[prepDate]; 
      } else {
        dts[prepDate] = appUser.name;
      }
      await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts }); 
    } else { 
      await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null }); 
    } 
  };
  
  const groupedPrep = activePrep.reduce((acc, i) => { const s = i.station || 'General'; if(!acc[s]) acc[s]=[]; acc[s].push(i); return acc; }, {});

  // --- LINE CHECK LOGIC ---
  const handleAddLineCheck = async (e) => {
    e.preventDefault();
    if(lcName.trim()) {
      await addDoc(collection(db, "lineCheckItems"), {
        name: lcName.trim(),
        category: lcCat,
        restaurantId: appUser.restaurantId
      });
      setLcName('');
    }
  };

  const handleSaveLineCheckEdit = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "lineCheckItems", editLineCheckItem.id), {
      name: editLineCheckItem.name.trim(),
      category: editLineCheckItem.category
    });
    setEditLineCheckItem(null);
  };

  const handleLogTemp = async (item) => {
    const val = temps[item.id];
    if (!val) return;
    
    const status = evaluateTemp(val, item.category);
    
    await addDoc(collection(db, "tempLogs"), {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      temp: parseFloat(val),
      status: status,
      loggedBy: appUser.name,
      date: getToday(),
      timestamp: new Date().toISOString(),
      restaurantId: appUser.restaurantId
    });
    
    setTemps({...temps, [item.id]: ''});
  };

  const filteredLineChecks = lineChecks
    .filter(lc => (lc.name || '').toLowerCase().includes(lcSearch.toLowerCase()))
    .sort((a, b) => a.category.localeCompare(b.category));

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
                        {canManageLineChecks && <button onClick={()=>deleteDoc(doc(db,"tasks",t.id))} className="text-slate-500 hover:text-red-500 p-2"><Trash2 size={16}/></button>}
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
                          <span className="opacity-70 font-bold border-l border-current pl-2 ml-1">By {latestLog.loggedBy} at {new Date(latestLog.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">Not logged yet today</div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 md:self-end">
                      <div className="flex items-center gap-1 bg-[#12161A] p-1 rounded-lg border border-[#2A353D]">
                        <input type="number" step="0.1" value={temps[item.id] || ''} onChange={e=>setTemps({...temps, [item.id]: e.target.value})} placeholder="°F" className="w-16 bg-transparent text-white font-black text-center text-sm outline-none" />
                        <button onClick={() => handleLogTemp(item)} disabled={!temps[item.id]} className="bg-slate-800 text-white disabled:opacity-50 px-3 py-1.5 rounded text-xs font-black uppercase hover:bg-slate-700 transition-colors">Log</button>
                      </div>
                      
                      {canManageLineChecks && (
                        <div className="flex gap-1 border-l border-[#2A353D] pl-3">
                          <button onClick={() => setEditLineCheckItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button>
                          <button onClick={() => { if(window.confirm(`Delete ${item.name}?`)) deleteDoc(doc(db,"lineCheckItems",item.id)); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
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

      {subTab !== 'prep' && subTab !== 'line-check' && <div className="animate-[slideIn_0.2s_ease-out]">{renderTasks(subTab)}</div>}
    </div>
  );
};

// --- INVENTORY, VENDORS, & WASTE TRACKER ---
const TabInventory = ({ addToast, appUser }) => {
  const inventoryItems = useLiveCollection('inventoryItems', appUser?.restaurantId);
  const vendors = useLiveCollection('vendors', appUser?.restaurantId);
  const wasteLogs = useLiveCollection('wasteLogs', appUser?.restaurantId);
  const [invTab, setInvTab] = useState('count');
  const [searchTerm, setSearchTerm] = useState(''); 
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Fetch invoices securely directly inside this tab
  const invoices = useLiveCollection('invoices', appUser?.restaurantId);
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
  const [wSearchTerm, setWSearchTerm] = useState(''); // Search filter for selecting items to burn
  const [wasteSearch, setWasteSearch] = useState(''); // Search filter for looking up past burn logs

  // AI Invoice Scanner State
  const [isScanningInvoice, setIsScanningInvoice] = useState(false);
  const [scannedInvoice, setScannedInvoice] = useState(null);

  // Master Permission Check for Inventory Tabs
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
    } else if (method === 'edi') {
      if (!vendor?.ediEndpoint) return addToast('Missing Configuration', 'Please add an EDI API Endpoint URL in the Vendor Settings first.');
      addToast('Transmitting', `Establishing secure handshake with ${vendor.name}...`);
      
      // Compile machine-readable payload
      const ediPayload = {
        restaurantId: appUser.restaurantId,
        timestamp: new Date().toISOString(),
        items: items.map(i => ({ sku: i.pfgCode || 'UNKNOWN', quantity: i.orderQty, packSize: i.packSize }))
      };

      try {
        // Simulate API Handshake to Broadliner
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(`EDI Payload sent to ${vendor.ediEndpoint}:`, ediPayload);
        addToast('EDI Success', `Order securely injected into ${vendor.name}'s system.`);
      } catch (err) {
        addToast('EDI Failure', 'Connection timed out. Retrying...');
        return; // Abort stock updates on failure
      }
    } else {
      addToast('Copied', 'Order list copied to clipboard!');
    }
    
    for (const item of items) { await updateDoc(doc(db, "inventoryItems", item.id), { pendingQty: item.orderQty, lastOrderedQty: item.orderQty, lastOrderedDate: getToday() }); }
  };

  const handleReceiveDelivery = async (vendorId) => {
    const itemsToReceive = inventoryItems.filter(i => i.supplierId === vendorId && (i.pendingQty || 0) > 0);
    for (const item of itemsToReceive) {
      await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: (parseFloat(item.currentStock) || 0) + (parseFloat(item.pendingQty) || 0), pendingQty: 0 });
    }
    addToast('Delivery Accepted', `Stock automatically updated for ${itemsToReceive.length} items.`);
  };

  const handleUpdatePendingQty = async (itemId, newQty) => {
    await updateDoc(doc(db, "inventoryItems", itemId), { pendingQty: Math.max(0, parseInt(newQty) || 0) });
  };

  const handleCancelDelivery = async (vendorId) => {
    if (!window.confirm("Cancel this dispatched order? This will clear all pending incoming stock for this vendor.")) return;
    const itemsToCancel = inventoryItems.filter(i => i.supplierId === vendorId && (i.pendingQty || 0) > 0);
    for (const item of itemsToCancel) {
      await updateDoc(doc(db, "inventoryItems", item.id), { pendingQty: 0 });
    }
    addToast('Order Canceled', 'Pending quantities cleared.');
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
          // Catch every possible key name the AI might use for the SKU/Product Code
          const incomingCode = item.productCode || item.sku || item.itemNumber || item.pfgCode || item.code || item.itemCode || '';

          if (item.matchedItemId === 'CREATE_NEW') {
             await addDoc(collection(db, "inventoryItems"), {
                name: item.itemName,
                category: 'Other', 
                pfgCode: incomingCode, 
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
             const invItem = inventoryItems.find(i => i.id === item.matchedItemId);
             if (invItem) {
                const addedStock = parseFloat(item.quantity) || 0;
                const updates = { 
                   currentStock: (parseFloat(invItem.currentStock) || 0) + addedStock 
                };
                
                // If the item doesn't have a product code yet, but the invoice found one, save it
                if (!invItem.pfgCode && incomingCode) {
                   updates.pfgCode = incomingCode;
                }

                await updateDoc(doc(db, "inventoryItems", invItem.id), updates);
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
      
      {/* INVOICE RECONCILIATION MODAL */}
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
            
            <div className="flex justify-between items-center mt-2 mb-1">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest pl-1">Stock Matcher</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const newItems = scannedInvoice.lineItems.map(i => ({...i, matchedItemId: ''})); setScannedInvoice({...scannedInvoice, lineItems: newItems}); }} className="text-[9px] bg-[#1A2126] text-slate-400 border border-[#2A353D] hover:text-white px-2 py-1 rounded font-black uppercase tracking-widest transition-colors shadow-sm">
                  Clear All
                </button>
                <button type="button" onClick={() => { const newItems = scannedInvoice.lineItems.map(i => ({...i, matchedItemId: i.matchedItemId || 'CREATE_NEW'})); setScannedInvoice({...scannedInvoice, lineItems: newItems}); }} className="text-[9px] bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 px-2 py-1 rounded font-black uppercase tracking-widest transition-colors shadow-sm">
                  Mark Unmatched as New
                </button>
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar border border-[#2A353D] rounded-xl divide-y divide-[#2A353D]">
              {(scannedInvoice.lineItems || []).map((item, idx) => (
                <div key={idx} className="p-3 bg-[#1A2126] flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
<div className="font-bold text-white text-sm flex items-center gap-1.5">
  {item.productCode && <span className="text-[#D4A381] font-black">[{item.productCode}]</span>}
  {item.itemName}
</div>                      <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-widest mt-0.5">
                        {item.quantity} {item.packSize} @ ${Number(item.unitPrice || 0).toFixed(2)}/ea
                      </div>
                    </div>
                    <div className="font-black text-slate-300">${Number(item.totalPrice || 0).toFixed(2)}</div>
                  </div>
                  
                  {/* RECONCILIATION DROPDOWN */}
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

      {/* VIEW PAST INVOICE DETAILS MODAL */}
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
              <button onClick={() => executeOrder('edi')} className={`w-full col-span-2 bg-blue-900/20 text-blue-400 font-black tracking-widest uppercase border border-blue-900/50 hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2 py-3 text-xs rounded-xl shadow-[0_0_10px_rgba(59,130,246,0.1)]`}><Globe size={16}/> Direct EDI Sync</button>
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
              <label className={T.label}>Direct EDI / API Webhook URL</label>
              <input type="url" value={editVendor.ediEndpoint || ''} onChange={e=>setEditVendor({...editVendor, ediEndpoint: e.target.value})} className={`${T.input} border-blue-900/50 focus:border-blue-500`} placeholder="https://api.sysco.com/v1/orders..." />
            </div>
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
        <div className={`bg-[#12161A] p-1 rounded-xl flex flex-wrap border ${T.border} w-full sm:w-auto`}>
          <button onClick={() => setInvTab('count')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'count' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>count</button>
          {hasInvPerms && <button onClick={() => setInvTab('order')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'order' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>order</button>}
          {hasInvPerms && <button onClick={() => setInvTab('manage')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'manage' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>manage</button>}
          {hasInvPerms && <button onClick={() => setInvTab('vendors')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'vendors' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>vendors</button>}
          {hasInvPerms && <button onClick={() => setInvTab('invoices')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex-1 sm:flex-none ${invTab === 'invoices' ? `${T.grad} text-slate-900 shadow-sm` : 'text-slate-400 hover:text-white'}`}>🧾 Invoices</button>}
          <button onClick={() => setInvTab('waste')} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all flex items-center justify-center gap-1 flex-1 sm:flex-none ${invTab === 'waste' ? `bg-red-500/20 text-red-500 shadow-sm border border-red-500/50` : 'text-slate-400 hover:text-red-400'}`}>🚨 Burn Log</button>
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
                    <div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name}</div><div className={`text-[9px] font-bold ${T.muted} uppercase`}>{vendors.find(v=>v.id===item.supplierId)?.name || 'No Vendor'}   {item.packSize || '1 CS'}   YIELD: {item.yieldQty||1}</div></div>
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
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-black">+</span>
                              <input type="number" min="0" value={item.pendingQty} onChange={(e) => handleUpdatePendingQty(item.id, e.target.value)} className="w-16 bg-[#1A2126] border border-[#2A353D] text-emerald-400 font-black text-center py-1 rounded outline-none" />
                            </div>
                          </div>
                       ))}
                     </div>
                     <div className={`p-4 bg-[#12161A] border-t ${T.border} flex gap-2`}>
                       <button onClick={() => handleReceiveDelivery(vendor.id)} className={`flex-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white font-black py-2 rounded-xl transition-colors`}>✅ Accept & Add</button>
                       <button onClick={() => handleCancelDelivery(vendor.id)} className={`px-4 bg-red-900/20 hover:bg-red-900 border border-red-500/50 text-red-400 hover:text-white font-black py-2 rounded-xl transition-colors`} title="Cancel Order"><X size={18}/></button>
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
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">
             {editItem && (
               <form onSubmit={handleSaveEdit} className="space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="col-span-2 sm:col-span-1">
                     <label className={T.label}>Product Number / SKU</label>
                     <input type="text" value={editItem.pfgCode || ''} onChange={e => setEditItem({...editItem, pfgCode: e.target.value})} className={T.input} />
                   </div>
                   <div className="col-span-2 sm:col-span-1">
                     <label className={T.label}>Name</label>
                     <input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className={T.input} required />
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className={T.label}>Category</label>
                     <select value={editItem.category || 'Produce'} onChange={e => setEditItem({...editItem, category: e.target.value})} className={T.input}>
                       {['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className={T.label}>Vendor</label>
                     <select value={editItem.supplierId || ''} onChange={e => setEditItem({...editItem, supplierId: e.target.value})} className={T.input} required>
                       <option value="">Select...</option>
                       {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                     </select>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className={T.label}>Case Price ($)</label>
                     <input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className={T.input} />
                   </div>
                   <div>
                     <label className={T.label}>Units per Case (Yield)</label>
                     <input type="number" min="1" value={editItem.yieldQty || 1} onChange={e => setEditItem({...editItem, yieldQty: e.target.value})} className={T.input} required />
                   </div>
                 </div>
                 <button type="submit" className={`w-full ${T.btn}`}>Save Changes</button>
               </form>
             )}
          </Modal>

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
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <input type="text" placeholder="Prod # / SKU" value={newItemCode} onChange={e=>setNewItemCode(e.target.value)} className={`${T.input} col-span-2 sm:col-span-1 py-1.5 text-xs`} />
              <input type="text" placeholder="Item Name..." value={newItemName} onChange={e=>setNewItemName(e.target.value)} className={`${T.input} col-span-2 py-1.5 text-xs`} required/>
              <select value={newItemCat} onChange={e=>setNewItemCat(e.target.value)} className={`${T.input} col-span-2 sm:col-span-1 py-1.5 text-xs`}><option disabled value="">Category...</option>{['Produce', 'Meat', 'Seafood', 'Dairy', 'Bakery', 'Frozen', 'Dry Goods', 'Supplies', 'Beverage', 'Other'].map(c=><option key={c} value={c}>{c}</option>)}</select>
              <select value={newItemSupplier} onChange={e=>setNewItemSupplier(e.target.value)} className={`${T.input} col-span-2 sm:col-span-1 py-1.5 text-xs`} required><option value="">Vendor...</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
              <input type="number" step="0.01" placeholder="Case $" value={newItemPrice} onChange={e=>setNewItemPrice(e.target.value)} className={`${T.input} col-span-1 py-1.5 text-xs`}/>
              <input type="number" min="1" placeholder="Yield" value={newItemYield} onChange={e=>setNewItemYield(e.target.value)} className={`${T.input} col-span-1 py-1.5 text-xs`} required/>
            </div>
            <div className="flex justify-end mt-2">
              <button type="submit" className={`w-full sm:w-auto ${T.btn} py-2 px-6`}><Plus size={18} className="inline mr-2"/> Add to Master List</button>
            </div>
          </form>

          {/* SEARCH BAR */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A381]" size={20}/>
            <input type="text" placeholder="Search master list by name or product number..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className={`${T.input} pl-12`}/>
          </div>

          <div className={`${T.card} divide-y ${T.border}`}>{inventoryItems.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).map(item => (<div key={item.id} className={`${T.row} flex justify-between items-center`}><div className="flex-1 min-w-0"><div className="font-bold text-white text-sm truncate">{item.name} <span className="text-[10px] text-slate-500 font-normal">{item.pfgCode ? `[${item.pfgCode}]` : ''}</span></div><div className="text-[10px] text-[#D4A381] font-black uppercase mt-0.5 tracking-widest">Case: ${Number(item.price||0).toFixed(2)}   Yield: {item.yieldQty||1}</div></div><div className="flex gap-2"><button onClick={()=>setEditItem(item)} className="p-2 text-slate-400 hover:text-white"><Edit size={16}/></button><button onClick={() => { if(window.confirm(`Are you sure you want to delete ${item.name}?`)) deleteDoc(doc(db,"inventoryItems",item.id)); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div></div>))}</div>
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

// --- RECIPE BOOK ---
const TabRecipes = ({ appUser, addToast }) => {
  const recipes = useLiveCollection('recipes', appUser?.restaurantId);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('All'); 
  const [isFormOpen, setIsFormOpen] = useState(false); 
  const [activeRecipe, setActiveRecipe] = useState(null); 
  const [yieldMult, setYieldMult] = useState(1);
const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

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

        try {
          // THIS IS THE CRITICAL BLOCK. It MUST explicitly say POST.
          const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Compressed })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to scan. Check API key or Vercel logs.');
          }

          const data = await response.json();
          
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
        instructions: "Brown the beef logs and drain grease.\nSaut  peppers and onions.\nCombine beef, saut ed veggies, tomato soup, tomato juice, chili beans, and diced tomatoes in a large pot.\nStir in all seasonings (chili powder, salt, pepper, garlic, oregano, italian, red pepper flakes).\nSimmer until flavors are thoroughly combined."
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
  const canManageRecipes = appUser?.isAdmin || appUser?.permissions?.team || appUser?.permissions?.prep || appUser?.isSuperAdmin || appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
  const canModifyRecipe = activeRecipe && (canManageRecipes || appUser?.id === activeRecipe.authorId);
return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className={`${T.card} p-4 sm:p-5 flex flex-col gap-4`}>
        
        {/* Top Row: Search and Category Filter */}
        <div className="flex flex-col md:flex-row gap-3 w-full">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A381]" size={20}/>
            <input type="text" placeholder="Search recipes or ingredients..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className={`${T.input} pl-12`}/>
          </div>
          <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className={`${T.input} md:w-48`}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

{/* Bottom Row: Action Buttons */}
        <div className="flex flex-wrap gap-2 justify-end w-full">
          
          <button onClick={toggleWakeLock} className={`bg-[#12161A] border border-[#2A353D] font-bold rounded-xl transition-all px-4 py-2 text-xs flex items-center justify-center gap-2 ${isAwake ? 'text-amber-400 border-amber-900/50 bg-amber-900/10' : 'text-slate-300 hover:text-amber-400'}`} title="Keep Screen On">
            <Sun size={16} className={isAwake ? 'animate-pulse' : ''} />
            {isAwake ? 'Screen Locked On' : 'Keep Screen On'}
          </button>

          {/* ONLY GEOFF CAN SEE THIS BUTTON */}
          {appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() && (
            <button onClick={handleInjectLegacyRecipes} className={`bg-[#12161A] text-slate-300 border border-[#2A353D] font-bold rounded-xl hover:text-emerald-400 transition-all px-4 py-2 text-xs flex items-center justify-center gap-2`} title="Inject Card Recipes"><Package size={16} /> Import</button>
          )}

          {canManageRecipes && (
            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
              
              <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm ${isScanning ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-slate-300 hover:text-[#D4A381]" title="Take Photo">
                    {isScanning ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                    {/* capture="environment" forces the camera open instantly */}
                    <input type="file" accept="image/*" capture="environment" onChange={handleScanRecipe} className="hidden" disabled={isScanning} />
                 </label>
                 <label className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 cursor-pointer hover:bg-[#1A2126] transition-colors text-slate-300 hover:text-[#D4A381]" title="Upload Photo">
                    <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                    {/* No capture tag allows file gallery selection */}
                    <input type="file" accept="image/*" onChange={handleScanRecipe} className="hidden" disabled={isScanning} />
                 </label>
              </div>

              <button onClick={() => { resetForm(); setIsFormOpen(true); }} className={`${T.btn} flex-1 sm:flex-none flex items-center justify-center gap-2 whitespace-nowrap py-2 px-4 text-xs`}>
                <Plus size={16}/> New Spec
              </button>
            </div>
          )}
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
            <div className={`border-b ${T.border} pb-4`}><h2 className="text-2xl font-black text-white leading-tight mb-2">{activeRecipe.title}</h2><div className={`flex flex-wrap gap-2 text-xs font-bold ${T.muted}`}><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md`}>{activeRecipe.category}</span><span className={`bg-[#12161A]
border ${T.border} px-2 py-1 rounded-md flex items-center gap-1`}><Clock size={12}/> {activeRecipe.prepTime}</span><span className={`bg-[#12161A] border ${T.border} px-2 py-1 rounded-md flex items-center gap-1 ${yieldMult !== 1 ? T.copper : ''}`}><Scale size={12}/> Yield: {parseAndMultiply(activeRecipe.yieldAmt, yieldMult)}</span></div></div>
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

  const myRequests = timeOffRequests.filter(r => r.userId === appUser.id).sort((a,b) => new Date(a.date) - new Date(b.date)); 
  const myFutureRequests = myRequests.filter(r => r.date >= getToday());
  const allFutureRequests = timeOffRequests.filter(r => r.date >= getToday()).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`); 
  const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();

const monthEvents = events.filter(e => e.type === 'special_event' && e.date?.startsWith(calMonth));
  const changeMonth = (offset) => { 
    const d = new Date(calMonth + '-01T12:00:00'); d.setMonth(d.getMonth() + offset); setCalMonth(d.toISOString().substring(0, 7)); 
  };

  const handleToggleDate = (d) => { 
    if (d < getToday()) return addToast('Locked', 'Cannot request past dates.'); 
    
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
    
    const currentMonth = getToday().substring(0, 7);

    for (const d of selectedDates) { 
      const reqMonth = d.substring(0, 7);
      const needsApproval = reqMonth <= currentMonth;

      await addDoc(collection(db, "timeOffRequests"), { 
        userId: appUser.id, userName: appUser.name, date: d, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null, submittedAt: new Date().toISOString(), restaurantId: appUser.restaurantId,
        status: needsApproval ? 'pending' : 'approved'
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
            <span className={`text-[10px] font-bold ${T.muted}`}>Approve or delete requests.</span>
          </div>
          <div className={`max-h-48 overflow-y-auto custom-scrollbar divide-y ${T.border}`}>
            {allFutureRequests.length === 0 && <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No upcoming time off for any staff.</div>}
            {allFutureRequests.map(r => (
              <div key={r.id} className={T.row}>
                <div className="flex-1">
                  <div className="font-black text-sm text-white leading-tight">{r.userName}</div>
          <div className={`text-[10px] font-bold ${T.muted} mt-0.5 flex flex-wrap items-center gap-2`}>
                    {formatDisplayDate(r.date)} {r.isPartial && <span className={`text-[#D4A381] bg-[#12161A] border ${T.border} px-1 rounded`}>({formatShortTime(r.startTime)} - {formatShortTime(r.endTime)})</span>}
                    {r.status === 'pending' && <span className="bg-orange-900/40 text-orange-400 border border-orange-900/50 px-1.5 py-0.5 rounded uppercase tracking-widest text-[8px]">Pending</span>}
                    {r.submittedAt && <span className="text-slate-500 border-l border-[#2A353D] pl-2 ml-1">Req: {new Date(r.submittedAt).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'pending' && (
                    <button onClick={() => updateDoc(doc(db, "timeOffRequests", r.id), { status: 'approved' })} className="text-slate-400 hover:text-emerald-500 p-1.5 bg-[#12161A] border border-[#2A353D] rounded"><Check size={14}/></button>
                  )}
                  <button onClick={() => { if(window.confirm("Force delete this request?")) deleteDoc(doc(db,"timeOffRequests",r.id)); }} className="text-slate-400 hover:text-red-500 p-1.5 bg-[#12161A] border border-[#2A353D] rounded"><Trash2 size={14}/></button>
                </div>
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

                  {existingReq && <span className={`text-[7px] font-black uppercase mt-auto mb-1 ${existingReq.status === 'pending' ? 'text-orange-400' : 'text-red-500'}`}>{existingReq.status === 'pending' ? 'Pend' : 'Off'}</span>}
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
              <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={T.label}>Start Time</label>
                        <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={T.input} required />
                    </div>
                    <div>
                        <label className={T.label}>End Time</label>
                        <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className={T.input} required />
                    </div>
                </div>
              )}
              <button type="submit" disabled={selectedDates.length === 0} className={`w-full ${T.btn} disabled:opacity-50 disabled:cursor-not-allowed`}>Submit {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}</button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#2A353D]">
              <h3 className="font-black text-sm text-white mb-3">My Pending Requests</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {myFutureRequests.length === 0 && <div className="text-xs font-bold text-slate-500 text-center py-2 border border-dashed border-[#2A353D] rounded-xl">No upcoming requests.</div>}
                {myFutureRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-[#12161A] p-2.5 rounded-xl border border-[#2A353D] hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {formatDisplayDate(r.date)}
                        {r.status === 'pending' && <span className="bg-orange-900/40 text-orange-400 border border-orange-900/50 px-1 rounded uppercase tracking-widest text-[8px]">Pending</span>}
                      </div>
             {r.isPartial ? (
                        <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-wider mt-0.5">{formatShortTime(r.startTime)} - {formatShortTime(r.endTime)}</div>
                      ) : (
                        <div className="text-[9px] text-red-400 font-black uppercase tracking-wider mt-0.5">Full Day Off</div>
                      )}
                      {r.submittedAt && <div className="text-[9px] font-bold text-slate-500 mt-1">Submitted: {new Date(r.submittedAt).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</div>}
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
const TabSettings = ({ appUser, addToast, users = [], clientData = {} }) => {
  const [subTab, setSubTab] = useState('profile');
  const [newOwnerId, setNewOwnerId] = useState('');

  // --- Profile State ---
  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');
  const [photoURL, setPhotoURL] = useState(appUser?.photoURL || '');

  // --- Preferences State ---
  const prefs = appUser?.preferences || {};
  const [defaultTab, setDefaultTab] = useState(prefs.defaultTab || (appUser?.isAdmin ? 'schedule' : 'published'));
  const [timeFormat, setTimeFormat] = useState(prefs.timeFormat || '12h');
  const [payPeriod, setPayPeriod] = useState(prefs.payPeriod || 'Bi-Weekly'); 
  const [payPeriodStart, setPayPeriodStart] = useState(prefs.payPeriodStart || 'Monday');
  
  // --- Notification State ---
  const [notifSchedule, setNotifSchedule] = useState(prefs.notifSchedule ?? true);
  const [notifMessages, setNotifMessages] = useState(prefs.notifMessages ?? true);
  const [notifTrades, setNotifTrades] = useState(prefs.notifTrades ?? true);
  const [notifReminders, setNotifReminders] = useState(prefs.notifReminders ?? false);
  const [reminderTime, setReminderTime] = useState(prefs.reminderTime || '120'); 

  // --- Advanced SaaS Notification States ---
  const [notifLevel, setNotifLevel] = useState(prefs.notifLevel || 'all');
  const [keywords, setKeywords] = useState(prefs.keywords || '');
  const [muteOnDaysOff, setMuteOnDaysOff] = useState(prefs.muteOnDaysOff ?? false);
  const [dndEnabled, setDndEnabled] = useState(prefs.dndEnabled ?? false);
  const [dndStart, setDndStart] = useState(prefs.dndStart || '22:00');
  const [dndEnd, setDndEnd] = useState(prefs.dndEnd || '08:00');

  // --- System Config State (Admin Only) ---
  const sys = appUser?.systemSettings || {};
  const [sysGeofence, setSysGeofence] = useState(sys.geofence ?? false);
  const [sysAddress, setSysAddress] = useState(sys.address || '');
  const [sysLat, setSysLat] = useState(sys.lat || '');
  const [sysLon, setSysLon] = useState(sys.lon || '');
  const [sysRadius, setSysRadius] = useState(sys.geofenceRadius || '300');
  const [sysBreaks, setSysBreaks] = useState(sys.breaks ?? false); 
  const [sysTips, setSysTips] = useState(sys.tips ?? true);
  const [sysTrades, setSysTrades] = useState(sys.trades ?? true);
  const [sysAutoApprove, setSysAutoApprove] = useState(sys.autoApprove ?? false);
  const [sysSameRoleTrades, setSysSameRoleTrades] = useState(sys.sameRoleTrades ?? true);
  const [sysBlockEarly, setSysBlockEarly] = useState(sys.blockEarly ?? true);
  const [sysGracePeriod, setSysGracePeriod] = useState(sys.gracePeriod || '5'); 
  const [sysOvertime, setSysOvertime] = useState(sys.overtime || '40'); 
  const [sysWageAccess, setSysWageAccess] = useState(sys.wageAccess || []);
  const [sysEnableIpWhitelist, setSysEnableIpWhitelist] = useState(sys.enableIpWhitelist ?? false);
  const [sysIpWhitelist, setSysIpWhitelist] = useState(sys.ipWhitelist || '');

const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        
        // --- NEW: THE SMART TARGET LOCK ---
        const activeVapidKey = window.location.hostname === 'app.86chaos.com' 
          ? 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU' // Production
          : 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc'; // Testing Sandbox

        const currentToken = await getToken(messaging, { 
          vapidKey: activeVapidKey 
        });
        
        if (currentToken) {
          await updateDoc(doc(db, "users", appUser.id), { fcmToken: currentToken });
          addToast('Success', 'Push notifications enabled for this device.');
        }
      } else {
        addToast('Denied', 'You blocked notifications in your browser settings.');
      }
    } catch (error) {
      console.error(error);
      addToast('Error', 'Could not enable notifications.');
    }
  };

  const handleGeocodeAddress = async () => {
    if (!sysAddress.trim()) return addToast('Error', 'Please enter a full address first.');
    addToast('Locating...', 'Searching map database...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sysAddress)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setSysLat(parseFloat(data[0].lat).toFixed(4));
        setSysLon(parseFloat(data[0].lon).toFixed(4));
        addToast('Found', 'Coordinates locked in.');
      } else {
        addToast('Error', 'Address not found. Try adding city and state.');
      }
    } catch (err) { addToast('Error', 'Failed to reach map service.'); }
  };

  // --- Role Management State (Admin Only) ---
  const [newRoleName, setNewRoleName] = useState('');
  const [newPrepCat, setNewPrepCat] = useState('');
  const dbPrepCats = useLiveCollection('prepCategories', appUser?.restaurantId);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const dbRoles = useLiveCollection('roles', appUser?.restaurantId);
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  
  const displayRoles = dbRoles.length > 0 
    ? [...dbRoles].sort((a,b) => a.name.localeCompare(b.name)) 
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
        preferences: { 
          ...prefs, defaultTab, timeFormat, payPeriod, payPeriodStart,
          notifSchedule, notifMessages, notifTrades, notifReminders, reminderTime,
          notifLevel, keywords, muteOnDaysOff, dndEnabled, dndStart, dndEnd
        }
      });
      addToast('Preferences Saved', 'Your personal app settings are locked in.');
    } catch (err) { addToast('Error', 'Failed to save preferences.'); }
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    try {
      const targetId = appUser?.restaurantId || 'legacy-sandbox';
      await setDoc(doc(db, "restaurants", targetId), {
        systemSettings: { 
          geofence: sysGeofence, address: sysAddress, lat: parseFloat(sysLat) || 0, lon: parseFloat(sysLon) || 0, geofenceRadius: parseInt(sysRadius) || 300,
          breaks: sysBreaks, tips: sysTips, trades: sysTrades, autoApprove: sysAutoApprove, sameRoleTrades: sysSameRoleTrades, blockEarly: sysBlockEarly, gracePeriod: sysGracePeriod, overtime: sysOvertime,
          wageAccess: sysWageAccess, enableIpWhitelist: sysEnableIpWhitelist, ipWhitelist: sysIpWhitelist
        }
      }, { merge: true });
      addToast('System Saved', 'Global workspace configurations updated.');
    } catch (err) { addToast('Error', err.message); }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, appUser.email);
      addToast('Email Sent', 'Check your inbox for the password reset link.');
    } catch (err) { addToast('Error', err.message); }
  };

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
      <div className={`grid ${appUser?.isAdmin ? 'grid-cols-2 sm:flex sm:flex-wrap' : 'grid-cols-3'} gap-2 border-b border-[#2A353D] mb-4 pb-2`}>
        {['profile', 'preferences', 'alerts'].concat(appUser?.isAdmin ? ['workspace', 'integrations'] : []).map((tab) => (
          <button type="button" key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-5 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

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
                    <option value="team">Team Roster</option>
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
            {appUser?.isAdmin && (
              <div className="pt-2">
                <h2 className="text-base font-black text-emerald-400 mb-3 border-b border-[#2A353D] pb-2">Payroll Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={T.label}>Default Pay Period</label>
                    <select value={payPeriod} onChange={e => setPayPeriod(e.target.value)} className={`${T.input} py-2 text-sm`}>
                      <option value="Weekly">Weekly</option>
                      <option value="Bi-Weekly">Bi-Weekly</option>
                      <option value="Semi-Monthly">Semi-Monthly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className={T.label}>Work Week Starts On</label>
                    <select value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className={`${T.input} py-2 text-sm`}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
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
                  {(dbPrepCats.length > 0 ? [...dbPrepCats] : ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'].map(c => ({id: c, name: c, isDefault: true}))).sort((a,b) => a.name.localeCompare(b.name)).map(cat => (
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

      {subTab === 'alerts' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleSavePrefs} className={`${T.card} p-3 sm:p-5 space-y-5`}>
            
            {/* SLEEK CONNECTION STATUS BAR */}
            <div className="p-3 bg-[#0B0E11] border border-[#2A353D] rounded-xl flex justify-between items-center gap-3">
              <div>
                <div className="text-sm font-black text-white flex items-center gap-2">Device Connection</div>
                <div className="text-[9px] font-medium text-slate-400 mt-0.5 leading-snug">
                  Browser Status: {typeof window !== 'undefined' && typeof Notification !== 'undefined' ? (Notification.permission === 'granted' ? 'Allowed' : Notification.permission === 'denied' ? 'Blocked via Browser Settings' : 'Not Configured') : 'Not Supported'}
                </div>
              </div>
              {typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <button onClick={handleEnableNotifications} type="button" className="px-4 py-2 bg-gradient-to-r from-[#C59373] to-[#8F6040] hover:opacity-80 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors shadow-md whitespace-nowrap">
                  Connect Device
                </button>
              )}
              {typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted' && (
                <div className="px-3 py-1.5 bg-emerald-900/20 border border-emerald-900/50 text-emerald-500 font-black text-[10px] uppercase tracking-widest rounded-lg flex items-center gap-1">
                  <Check size={12}/> Connected
                </div>
              )}
            </div>

            <div>
              <h2 className="text-base font-black text-white mb-1"><Bell className={`inline mr-2 ${T.copper}`} size={16}/> Alerts & Routing</h2>
              <p className="text-[10px] text-slate-400 font-medium mb-4">Control exactly when and how 86 Chaos pings your device.</p>
              
              <div className="space-y-2 mb-6">
                <Toggle label="Schedule Publications" desc="Get alerted the exact second a new schedule goes live." checked={notifSchedule} onChange={e => setNotifSchedule(e.target.checked)} />
                <Toggle label="Shift Trade Board" desc="Notify me when someone posts a shift they need covered." checked={notifTrades} onChange={e => setNotifTrades(e.target.checked)} />
                <Toggle label="Smart Mute: Days Off" desc="Automatically silence all non-critical notifications if you are not scheduled to work today." checked={muteOnDaysOff} onChange={e => setMuteOnDaysOff(e.target.checked)} />
              </div>

              <h3 className="text-xs font-black uppercase text-[#D4A381] tracking-widest border-b border-[#2A353D] pb-1 mb-3">Message Board Rules</h3>
              <div className="space-y-3 mb-6">
                <select value={notifLevel} onChange={e => setNotifLevel(e.target.value)} className={T.input}>
                  <option value="all">Notify me for ALL new messages</option>
                  <option value="mentions">Only notify me for @mentions & Keywords</option>
                  <option value="critical">Only notify me for Critical Manager Alerts</option>
                </select>

                {notifLevel === 'mentions' && (
                  <div className="animate-[slideIn_0.2s_ease-out]">
                    <label className={T.label}>Keyword Alerts (Comma Separated)</label>
                    <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. 86, emergency, VIP, cooler" className={`${T.input} text-sm`} />
                    <p className="text-[9px] text-slate-500 mt-1 font-bold">You will be pinged anytime someone types these exact words.</p>
                  </div>
                )}
              </div>

              <h3 className="text-xs font-black uppercase text-[#D4A381] tracking-widest border-b border-[#2A353D] pb-1 mb-3">Timing & Delays</h3>
              <div className="space-y-2">
                <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl`}>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-[#D4A381] transition-colors">Quiet Hours (Do Not Disturb)</div>
                      <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Hold all non-critical notifications until morning.</div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <input type="checkbox" checked={dndEnabled} onChange={e => setDndEnabled(e.target.checked)} className="sr-only" />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${dndEnabled ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${dndEnabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                  {dndEnabled && (
                    <div className="flex items-center gap-3 pt-3 mt-3 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                      <input type="time" value={dndStart} onChange={e => setDndStart(e.target.value)} className={`${T.input} py-1.5 text-xs text-center`} />
                      <span className="text-[9px] font-black text-slate-500 uppercase">TO</span>
                      <input type="time" value={dndEnd} onChange={e => setDndEnd(e.target.value)} className={`${T.input} py-1.5 text-xs text-center`} />
                    </div>
                  )}
                </div>

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
                      <input type="number" min="1" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className={`${T.input} w-20 py-1 text-center text-xs font-black`} placeholder="120" />
                    </div>
                  )}
                </div>
              </div>

            </div>
            <button type="submit" className={`w-full ${T.btn} py-3 text-sm mt-4`}>Save Alert Preferences</button>
          </form>
        </div>
      )}

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
              {sysGeofence && (
                 <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl space-y-3 animate-[slideIn_0.2s_ease-out] ml-4">
                   <div>
                     <label className={T.label}>Street Address (To auto-find coordinates)</label>
                     <div className="flex gap-2">
                       <input type="text" value={sysAddress} onChange={e=>setSysAddress(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. 26 N State St, Chilton, WI"/>
                       <button type="button" onClick={handleGeocodeAddress} className={`${T.btn} py-1.5 px-4 text-xs whitespace-nowrap`}>Find GPS</button>
                     </div>
                   </div>
                   <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#2A353D]">
                     <div><label className={T.label}>Latitude</label><input type="number" step="any" value={sysLat} onChange={e=>setSysLat(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. 44.0300"/></div>
                     <div><label className={T.label}>Longitude</label><input type="number" step="any" value={sysLon} onChange={e=>setSysLon(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. -88.1630"/></div>
                     <div><label className={T.label}>Radius (Feet)</label><input type="number" min="10" value={sysRadius} onChange={e=>setSysRadius(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. 300"/></div>
                   </div>
                 </div>
               )}
               <Toggle label="Unpaid Break Tracking" desc="Allow staff to clock out for unpaid breaks during their shift." checked={sysBreaks} onChange={e => setSysBreaks(e.target.checked)} />
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
               <Toggle label="Role-Restricted Trades" desc="Staff can only claim shifts that match their assigned role." checked={sysSameRoleTrades} disabled={!sysTrades} onChange={e => setSysSameRoleTrades(e.target.checked)} />
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

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Security & Access Control</div>
             <div className="space-y-2">
               <Toggle label="Strict IP Whitelisting" desc="Only allow app access from specific IP addresses (e.g., the restaurant's secure Wi-Fi)." checked={sysEnableIpWhitelist} onChange={e => setSysEnableIpWhitelist(e.target.checked)} />
               {sysEnableIpWhitelist && (
                 <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl animate-[slideIn_0.2s_ease-out] ml-4">
                   <label className={T.label}>Authorized IP Addresses (Comma Separated)</label>
                   <input type="text" value={sysIpWhitelist} onChange={e=>setSysIpWhitelist(e.target.value)} className={`${T.input} py-1.5 text-xs font-mono`} placeholder="e.g. 192.168.1.1, 10.0.0.5" />
                 </div>
               )}

               <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl mt-2">
                 <div className="text-xs font-bold text-white mb-1">Wage Visibility Exceptions</div>
                 <div className={`text-[9px] font-medium ${T.muted} mb-3 leading-snug`}>By default, only Full Admins can see hourly wages and labor costs. Select specific employees below to grant them exception access to view wages.</div>
                 <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-[#0B0E11] p-2 border border-[#2A353D] rounded-lg">
                   {users.filter(u => u.isActive !== false && !u.isAdmin).map(u => (
                     <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#1A2126] p-1.5 rounded transition-colors">
                       <input type="checkbox" checked={sysWageAccess.includes(u.id)} onChange={e => {
                         if (e.target.checked) setSysWageAccess([...sysWageAccess, u.id]);
                         else setSysWageAccess(sysWageAccess.filter(id => id !== u.id));
                       }} className="w-3.5 h-3.5 accent-[#8F6040] bg-[#12161A] border-[#2A353D]" />
                       <span className="text-[10px] font-bold text-slate-300">{u.name} <span className="text-slate-500 font-normal">({u.role})</span></span>
                     </label>
                   ))}
                   {users.filter(u => u.isActive !== false && !u.isAdmin).length === 0 && <div className="text-[10px] text-slate-500 text-center py-2">No non-admin staff available.</div>}
                 </div>
               </div>
             </div>

          </div>
          <button type="submit" className={`w-full ${T.btn} py-3 mt-4 text-sm`}>Save Global Workspace</button>
        </form>
      )}

      {/* --- TRANSFER OWNERSHIP ZONE --- */}
      {subTab === 'workspace' && (appUser?.email?.toLowerCase() === clientData?.ownerEmail?.toLowerCase() || appUser?.isSuperAdmin || appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com') && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!newOwnerId) return addToast('Error', 'Select a new owner.');
          if (prompt(`CRITICAL: Type "TRANSFER" to hand over ownership of this workspace. You will lose master control.`) !== 'TRANSFER') return addToast('Aborted', 'Transfer canceled.');
          
          const newOwner = users.find(u => u.id === newOwnerId);
          try {
            await updateDoc(doc(db, "users", newOwner.id), { isAdmin: true });
            await updateDoc(doc(db, "restaurants", appUser.restaurantId), { ownerName: newOwner.name, ownerEmail: newOwner.email });
            addToast('Transferred', `Ownership transferred to ${newOwner.name}.`);
            setNewOwnerId('');
          } catch(err) { addToast('Error', err.message); }
        }} className={`${T.card} p-4 sm:p-5 mt-4 border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]`}>
           <div className="mb-3 border-b border-[#2A353D] pb-2">
             <h2 className="text-base font-black text-red-500">Transfer Ownership</h2>
             <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Permanently transfer billing and master control to another active team member.</p>
           </div>
           <div className="flex flex-col sm:flex-row gap-3">
             <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)} className={T.input} required>
               <option value="">Select New Owner...</option>
               {users.filter(u => u.isActive && u.id !== appUser.id).map(u => (
                 <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
               ))}
             </select>
             <button type="submit" className="bg-red-900/20 text-red-500 font-black tracking-widest uppercase border border-red-900/50 rounded-xl px-6 py-3 hover:bg-red-900/40 transition-colors whitespace-nowrap">Transfer</button>
           </div>
        </form>
      )}

      {/* --- INTEGRATIONS ZONE --- */}
      {subTab === 'integrations' && appUser?.isAdmin && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          
          <div className={`${T.card} p-4 sm:p-5 border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.05)]`}>
             <div className="mb-4 border-b border-[#2A353D] pb-2">
               <h2 className="text-base font-black text-blue-400">Point of Sale (POS) Sync</h2>
               <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Automatically pull daily sales data directly into your Daily Ledger.</p>
             </div>
             <form onSubmit={async (e) => {
                e.preventDefault();
                await setDoc(doc(db, "restaurants", appUser.restaurantId), { integrations: { posProvider: e.target.posProvider.value, posApiKey: e.target.posApiKey.value } }, { merge: true });
                addToast('Saved', 'POS API Configuration Saved.');
             }} className="space-y-3">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className={T.label}>POS Provider</label>
                   <select name="posProvider" defaultValue={clientData?.integrations?.posProvider || ''} className={T.input}>
                     <option value="">None / Manual Entry</option>
                     <option value="Square">Square</option>
                     <option value="Toast">Toast</option>
                     <option value="Clover">Clover</option>
                     <option value="TouchBistro">TouchBistro</option>
                   </select>
                 </div>
                 <div>
                   <label className={T.label}>Secure API Key / Access Token</label>
                   <input type="password" name="posApiKey" defaultValue={clientData?.integrations?.posApiKey || ''} className={T.input} placeholder="sk_live_..." />
                 </div>
               </div>
               <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl">
                 <label className={T.label}>Your Webhook URL (Paste this into your POS dashboard)</label>
                 <code className="text-[10px] text-emerald-400 break-all select-all block mt-1">https://app.86chaos.com/api/webhooks/pos-sync?tenant={appUser.restaurantId}</code>
               </div>
               <button type="submit" className="bg-blue-900/20 text-blue-400 font-black tracking-widest uppercase border border-blue-900/50 rounded-xl w-full py-3 hover:bg-blue-900/40 transition-colors">Connect POS</button>
             </form>
          </div>

          <div className={`${T.card} p-4 sm:p-5 border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.05)]`}>
             <div className="mb-4 border-b border-[#2A353D] pb-2">
               <h2 className="text-base font-black text-emerald-500">Payroll Provider API</h2>
               <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Sync approved timesheets directly to your payroll processor.</p>
             </div>
             <form onSubmit={async (e) => {
                e.preventDefault();
                await setDoc(doc(db, "restaurants", appUser.restaurantId), { integrations: { payrollProvider: e.target.payrollProvider.value, payrollApiKey: e.target.payrollApiKey.value } }, { merge: true });
                addToast('Saved', 'Payroll API Configuration Saved.');
             }} className="space-y-3">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className={T.label}>Payroll Provider</label>
                   <select name="payrollProvider" defaultValue={clientData?.integrations?.payrollProvider || ''} className={T.input}>
                     <option value="">None / CSV Export Only</option>
                     <option value="Gusto">Gusto</option>
                     <option value="ADP">ADP Run</option>
                     <option value="Paychex">Paychex</option>
                     <option value="QuickBooks">QuickBooks Time</option>
                   </select>
                 </div>
                 <div>
                   <label className={T.label}>Secure API Key / Bearer Token</label>
                   <input type="password" name="payrollApiKey" defaultValue={clientData?.integrations?.payrollApiKey || ''} className={T.input} placeholder="eyJhbGciOiJIUzI1Ni..." />
                 </div>
               </div>
               <button type="submit" className="bg-emerald-900/20 text-emerald-400 font-black tracking-widest uppercase border border-emerald-900/50 rounded-xl w-full py-3 hover:bg-emerald-900/40 transition-colors">Connect Payroll</button>
             </form>
          </div>

        </div>
      )}

    </div>
  );
};


// --- MAINTENANCE LOG TAB ---
const TabMaintenance = ({ appUser, addToast }) => {
  const logs = useLiveCollection('maintenanceLogs', appUser?.restaurantId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [equipment, setEquipment] = useState('');
  const [issue, setIssue] = useState('');
  const [urgency, setUrgency] = useState('Standard');
  const [status, setStatus] = useState('Reported');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [editingLogId, setEditingLogId] = useState(null);

  const resetForm = () => {
    setEquipment(''); setIssue(''); setUrgency('Standard'); 
    setStatus('Reported'); setCost(''); setNotes(''); setEditingLogId(null);
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
        await updateDoc(doc(db, "maintenanceLogs", editingLogId), payload);
        addToast('Updated', 'Maintenance log updated successfully.');
      } else {
        payload.reportedAt = new Date().toISOString();
        payload.reportedBy = appUser.name;
        await addDoc(collection(db, "maintenanceLogs"), payload);
        addToast('Logged', 'New equipment issue reported.');
      }
      setIsModalOpen(false); resetForm();
    } catch (err) { addToast('Error', err.message); }
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingLogId ? "Update Maintenance Log" : "Report Equipment Issue"}>
        <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={T.label}>Equipment / Area</label>
              <input type="text" value={equipment} onChange={e=>setEquipment(e.target.value)} className={T.input} placeholder="e.g. Walk-in Cooler, Fryer #1" required />
            </div>
            <div>
              <label className={T.label}>Urgency Level</label>
              <select value={urgency} onChange={e=>setUrgency(e.target.value)} className={T.input}>
                <option value="Standard">Standard (Monitor)</option>
                <option value="High">High (Needs Repair Soon)</option>
                <option value="Critical">Critical (Down/Safety Hazard)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={T.label}>Issue Description</label>
            <textarea value={issue} onChange={e=>setIssue(e.target.value)} rows="2" className={T.input} placeholder="What is broken or acting up?" required></textarea>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#2A353D]">
            <div>
              <label className={T.label}>Current Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} className={T.input}>
                <option value="Reported">Reported (Open)</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Parts">Pending Parts</option>
                <option value="Resolved">Resolved / Fixed</option>
              </select>
            </div>
            <div>
              <label className={T.label}>Repair Cost ($)</label>
              <input type="number" step="0.01" min="0" value={cost} onChange={e=>setCost(e.target.value)} className={T.input} placeholder="Invoice or part cost..." />
            </div>
          </div>
          <div>
            <label className={T.label}>Repair Notes / Vendor Used</label>
            <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className={T.input} placeholder="e.g. Call Steve's HVAC, ordered part on Amazon" />
          </div>
          <button type="submit" className={`w-full ${T.btn} py-3 mt-2`}>{editingLogId ? 'Update Log' : 'Submit Report'}</button>
        </form>
      </Modal>

      <div className="flex justify-between items-center bg-[#1A2126] p-4 rounded-2xl border border-[#2A353D] shadow-lg">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2"><Settings className={T.copper} size={24}/> Equipment & Maintenance</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Track repairs, vendors, and maintenance costs.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className={`${T.btn} flex items-center gap-2 px-4 py-2 text-xs`}><Plus size={16}/> Report Issue</button>
      </div>

      <div className={`${T.card} overflow-hidden`}>
        <div className={T.th}>Active & Resolved Issues</div>
        <div className={`divide-y ${T.border}`}>
          {logs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold text-sm">No maintenance issues logged. Kitchen is 100% operational.</div>}
          
          {logs.sort((a,b) => {
             // Sort by unresolved first, then by urgency, then by date
             if (a.status !== 'Resolved' && b.status === 'Resolved') return -1;
             if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
             if (a.urgency === 'Critical' && b.urgency !== 'Critical') return -1;
             if (b.urgency === 'Critical' && a.urgency !== 'Critical') return 1;
             return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
          }).map(log => (
            <div key={log.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4 ${log.status === 'Resolved' ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-base">{log.equipment}</span>
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStatusColor(log.status)}`}>{log.status}</span>
                  {log.status === 'Resolved' && log.cost > 0 && <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-900/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-900/30">Cost: ${parseFloat(log.cost).toFixed(2)}</span>}
                </div>
                <div className="text-sm font-medium text-slate-300 mt-1">{log.issue}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-2 flex gap-3 flex-wrap">
                  <span className={getUrgencyColor(log.urgency)}>Priority: {log.urgency}</span>
                  <span>Reported: {new Date(log.reportedAt).toLocaleDateString()} by {log.reportedBy}</span>
                  {log.notes && <span className="text-[#D4A381]">Notes: {log.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 md:self-end">
                <button onClick={() => handleEdit(log)} className="p-2 text-slate-400 hover:text-[#D4A381] bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Edit size={14}/></button>
                <button onClick={() => { if(window.confirm("Delete this log permanently?")) deleteDoc(doc(db,"maintenanceLogs",log.id)); }} className="p-2 text-slate-400 hover:text-red-500 bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



// --- AUDIT LOGS TAB (Master Admin Only) ---
const TabAuditLog = ({ appUser }) => {
  const logs = useLiveCollection('auditLogs', appUser?.restaurantId);
  const isGeoff = appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com';
  const sortedLogs = [...logs]
    .filter(log => isGeoff ? true : log.action !== 'APP_INSTALLED')
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

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
const TabSales = ({ sales, timePunches = [], users = [], addToast, appUser }) => {
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

  // --- AUTO-LABOR CALCULATION ENGINE ---
  const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
      if (!inTime) return 0;
      const end = outTime ? new Date(outTime) : new Date(); // If currently on clock, calc up to this exact minute
      const rawMins = (end - new Date(inTime)) / 60000;
      return Math.max(0, (rawMins - breakMins) / 60);
  };

  const getDailyLabor = (date) => {
      const dayPunches = timePunches.filter(p => p.date === date);
      return dayPunches.reduce((acc, p) => {
          const emp = users.find(u => u.id === p.employeeId);
          const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
          return acc + (hours * (emp?.wage || 0));
      }, 0);
  };

  useEffect(() => {
    const newEditData = {};
    weekDays.forEach(date => {
      const daySale = sales.find(s => s.date === date);
      newEditData[date] = {
        grossSales: daySale?.grossSales || '',
        laborCost: daySale?.laborCost !== undefined ? daySale.laborCost : '',
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
    const autoLabor = getDailyLabor(date);
    
    // If they didn't type anything, grab the auto-calculated labor
    const finalLabor = data.laborCost !== '' ? parseFloat(data.laborCost) : autoLabor;

    const payload = {
      date,
      grossSales: parseFloat(data.grossSales) || 0,
      laborCost: finalLabor || 0,
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
    const autoLabor = getDailyLabor(d);
    if (s) { 
      wtdGross += (s.grossSales||0); 
      wtdLabor += (s.laborCost > 0 ? s.laborCost : autoLabor); 
      wtdFood += (s.foodCost||0); 
    } else {
      wtdLabor += autoLabor; // Add auto-labor even if not saved yet to show running trends
    }
  });
  
  const wtdLaborPct = wtdGross > 0 ? ((wtdLabor / wtdGross) * 100).toFixed(1) : 0;
  const wtdFoodPct = wtdGross > 0 ? ((wtdFood / wtdGross) * 100).toFixed(1) : 0;
  const wtdProfit = wtdGross - (wtdLabor + wtdFood);

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

      {/* Expanded WTD KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Gross</div><div className="text-sm sm:text-lg font-black text-[#D4A381]">${wtdGross.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div></div>
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Labor</div><div className={`text-sm sm:text-lg font-black ${wtdLaborPct > 30 ? 'text-red-400' : 'text-emerald-400'}`}>{wtdLaborPct}%</div></div>
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Food</div><div className={`text-sm sm:text-lg font-black ${wtdFoodPct > 33 ? 'text-red-400' : 'text-emerald-400'}`}>{wtdFoodPct}%</div></div>
        <div className={`${T.card} p-2
 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Profit</div><div className={`text-sm sm:text-lg font-black ${wtdProfit < 0 ? 'text-red-400' : 'text-emerald-400'}`}>${wtdProfit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div></div>
      </div>

      {/* Ultra-Compact 7-Day Ledger with Notes */}
      <div className={`${T.card} overflow-hidden`}>
         <div className="divide-y divide-[#2A353D]">
           {weekDays.map(date => {
              const data = editData[date] || { grossSales: '', laborCost: '', foodCost: '', notes: '' };
              const isToday = date === getToday();
              const hasData = sales.find(s => s.date === date);
              const autoLabor = getDailyLabor(date);
              
              const displayLabor = data.laborCost !== '' ? data.laborCost : (autoLabor > 0 ? autoLabor.toFixed(2) : '');

              return (
                <div key={date} className={`p-2 sm:p-3 flex flex-col gap-2 ${isToday ? 'bg-[#12161A] border-l-2 border-[#D4A381]' : 'hover:bg-[#12161A]/50 transition-colors'}`}>
                   <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-[#D4A381]' : 'text-slate-300'}`}>{new Date(date+'T12:00').toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span>
                      <div className="flex items-center gap-2">
                         {data.laborCost === '' && autoLabor > 0 && <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-900/50">Auto-Labor</span>}
                         {hasData && <span className="text-[8px] text-[#D4A381] font-black uppercase tracking-widest bg-[#8F6040]/20 px-1.5 py-0.5 rounded border border-[#D4A381]/30">Saved</span>}
                         {hasData && appUser?.isAdmin && <button onClick={() => { if(window.confirm("Delete record?")) deleteDoc(doc(db,"sales",hasData.id)); }} className="text-slate-500 hover:text-red-500"><Trash2 size={12}/></button>}
                      </div>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.grossSales} onChange={e=>handleInputChange(date, 'grossSales', e.target.value)} placeholder="Gross" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                        <div className="relative flex-1"><span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold ${data.laborCost === '' && autoLabor > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>$</span><input type="number" value={displayLabor} onChange={e=>handleInputChange(date, 'laborCost', e.target.value)} placeholder="Labor" className={`w-full bg-[#0B0E11] border border-[#2A353D] text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381] ${data.laborCost === '' && autoLabor > 0 ? 'text-emerald-400 bg-emerald-900/10 border-emerald-900/50' : 'text-white'}`} /></div>
                        <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.foodCost} onChange={e=>handleInputChange(date, 'foodCost', e.target.value)} placeholder="Food" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                      </div>
                      <div className="flex gap-1.5">
                        <input type="text" value={data.notes} onChange={e=>handleInputChange(date, 'notes', e.target.value)} placeholder="Context notes (e.g., Event, Weather, Promos)..." className="flex-1 w-full bg-[#0B0E11] border border-[#2A353D] text-slate-300 text-[10px] sm:text-xs font-medium px-2 py-1.5 rounded outline-none focus:border-[#D4A381]" />
                        <button onClick={()=>handleSave(date)} className="w-16 bg-gradient-to-r from-[#C59373] to-[#8F6040] text-slate-900 text-[10px] font-black uppercase tracking-wider rounded flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity">Save</button>
                      </div>
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
// ADMINISTRATOR COMMAND CENTER (Formerly God Mode)
// ============================================================================
const TabGodMode = ({ appUser, addToast, setGhostTenant }) => {
  const [subTab, setSubTab] = useState('overview');
  
  // Master Data States
  const [restaurants, setRestaurants] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [crashLogs, setCrashLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [userCounts, setUserCounts] = useState({});
  const [totalInstalls, setTotalInstalls] = useState(0); 

// Form States
  const [rName, setRName] = useState(''); const [rAddress, setRAddress] = useState(''); const [oName, setOName] = useState(''); const [oEmail, setOEmail] = useState(''); const [oPhone, setOPhone] = useState('');  const [adminEmail, setAdminEmail] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
const [editingRest, setEditingRest] = useState(null);
  const [forgeEventTitle, setForgeEventTitle] = useState(''); const [forgeEventDate, setForgeEventDate] = useState(getToday());
  const [userSearch, setUserSearch] = useState('');

  // Live Banner States
  const [bannerTarget, setBannerTarget] = useState('ALL');
  const [bannerText, setBannerText] = useState('');

  const handlePushBanner = async (e) => {
    e.preventDefault();
    if (!bannerText.trim()) return addToast('Error', 'Banner text required.');
    if (!window.confirm("Pin this banner to the top of the app?")) return;
    
    addToast('Deploying', 'Pushing banner to selected workspace(s)...');
    try {
      if (bannerTarget === 'ALL') {
        const promises = restaurants.map(r => updateDoc(doc(db, "restaurants", r.id), { systemBanner: bannerText.trim() }));
        await Promise.all(promises);
      } else {
        await updateDoc(doc(db, "restaurants", bannerTarget), { systemBanner: bannerText.trim() });
      }
      addToast('Success', 'Banner deployed successfully.');
      setBannerText('');
    } catch(err) { addToast('Error', err.message); }
  };

  const handleClearBanner = async () => {
    if (!window.confirm("Clear active banners for the selected target?")) return;
    addToast('Clearing', 'Removing banners...');
    try {
      if (bannerTarget === 'ALL') {
        const promises = restaurants.map(r => updateDoc(doc(db, "restaurants", r.id), { systemBanner: null }));
        await Promise.all(promises);
      } else {
        await updateDoc(doc(db, "restaurants", bannerTarget), { systemBanner: null });
      }
      addToast('Success', 'Banner(s) cleared.');
    } catch(err) { addToast('Error', err.message); }
  };
  
  // Nuke Security States
  const [nukeTarget, setNukeTarget] = useState(null);
  const [nukePassword, setNukePassword] = useState('');
  const [isNuking, setIsNuking] = useState(false);
  // --- RAW JSON INSPECTOR STATE ---
  const [isRawInspectorOpen, setIsRawInspectorOpen] = useState(false);
  const [rawInspectorId, setRawInspectorId] = useState('');
  const [rawInspectorCollection, setRawInspectorCollection] = useState('users');
  const [rawInspectorData, setRawInspectorData] = useState(null);

  const handleFetchRawDoc = async (e) => {
    e.preventDefault();
    if (!rawInspectorId.trim()) return;
    try {
      const docSnap = await getDoc(doc(db, rawInspectorCollection, rawInspectorId.trim()));
      if (docSnap.exists()) setRawInspectorData({ id: docSnap.id, ...docSnap.data() });
      else addToast('Not Found', 'No document found with that ID in that collection.');
    } catch(err) { addToast('Error', err.message); }
  };

  // Fetch Global Intelligence
  useEffect(() => {
    const unsubRests = onSnapshot(collection(db, 'restaurants'), snap => setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubAdmins = onSnapshot(query(collection(db, 'users'), where('isSuperAdmin', '==', true)), snap => setSuperAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const uList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(uList);
      const counts = {}; uList.forEach(u => { if (u.restaurantId) counts[u.restaurantId] = (counts[u.restaurantId] || 0) + 1; });
      setUserCounts(counts);
    });
    const unsubCrashes = onSnapshot(collection(db, 'crashReports'), snap => setCrashLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.time||0) - new Date(a.time||0)).slice(0, 50)));
    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), snap => {
       const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setAuditLogs(rawLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100));
       setTotalInstalls(rawLogs.filter(log => log.action === 'APP_INSTALLED').length);
    });
    return () => { unsubRests(); unsubAdmins(); unsubUsers(); unsubCrashes(); unsubAudit(); };
  }, []);

// --- 1. TENANT MANAGEMENT & DEPLOYMENT ---
  const handleDeployTenant = async (e) => {
    e.preventDefault(); if (!rName.trim() || !oEmail.trim() || !oName.trim() || !rAddress.trim()) return;
    try {
      const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true, maintenance: true, timesheets: true };
      const newRestRef = await addDoc(collection(db, "restaurants"), { 
        name: rName.trim(), 
        ownerName: oName.trim(), 
        ownerEmail: oEmail.toLowerCase().trim(), 
        ownerPhone: oPhone.trim(),
        isActive: true, 
        isReadOnly: false, 
        features: defaultFeatures, 
        labs: {}, 
        planType: 'Trial', 
        billingStatus: 'Paid', 
        createdAt: new Date().toISOString(), 
        lastActive: new Date().toISOString(),
        systemSettings: { address: rAddress.trim(), geofenceRadius: 300 }
      });
      const tPass = generateTempPass(); const secondaryApp = initializeApp(firebaseConfig, "TenantBuilder_" + Date.now()); const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, oEmail.toLowerCase().trim(), tPass); const newAuthUid = userCredential.user.uid; await secondaryAuth.signOut();
      await setDoc(doc(db, "users", newAuthUid), { name: oName.trim(), email: oEmail.toLowerCase().trim(), password: tPass, role: 'General Manager', isAdmin: true, isActive: true, forcePasswordChange: true, restaurantId: newRestRef.id, restaurantName: rName.trim(), permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true } });
      const welcomeMsg = `Welcome to 86chaos!\n\nYour restaurant OS is live. Access it here: https://app.86chaos.com\n\nUsername: ${oEmail.toLowerCase().trim()}\nTemporary Password: ${tPass}\n\nPlease log in to set a permanent password.`;
      window.location.href = `mailto:${oEmail.toLowerCase().trim()}?subject=${encodeURIComponent(`Your 86 Chaos OS: ${rName.trim()}`)}&body=${encodeURIComponent(welcomeMsg)}`;
addToast('Tenant Deployed', `${rName} is now live.`); setRName(''); setOName(''); setOEmail(''); setOPhone(''); setRAddress('');    } catch (error) { addToast('Deployment Failed', error.message); }
  };

const handleUpdateTenant = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "restaurants", editingRest.id), {
      name: editingRest.name,
      ownerName: editingRest.ownerName || '',
      ownerEmail: editingRest.ownerEmail || '',
      ownerPhone: editingRest.ownerPhone || '',
      'systemSettings.address': editingRest.systemSettings?.address || '',
      isActive: editingRest.isActive,
      isReadOnly: editingRest.isReadOnly || false,
      features: editingRest.features || {},
      labs: editingRest.labs || {},
      planType: editingRest.planType || 'Pro',
      billingStatus: editingRest.billingStatus || 'Paid'
    });
    setEditingRest(null); addToast('Updated', 'Restaurant profile saved.');
  };

  const handleDeleteTenant = async (id, name) => {
    if (prompt(`CRITICAL WARNING: This completely destroys a business's data. Type "NUKE" to erase ${name}.`) !== 'NUKE') return addToast('Aborted', 'Deletion canceled.');
    await deleteDoc(doc(db, "restaurants", id)); addToast('Deleted', `${name} has been erased from existence.`);
  };

  const handleExportData = async (rest) => {
    addToast('Compiling Data', 'Building CSV payload...');
    const uSnap = await getDocs(query(collection(db, 'users'), where('restaurantId', '==', rest.id)));
    let csv = "ID,Name,Email,Role,Phone,Status\n";
    uSnap.forEach(d => { const u = d.data(); csv += `"${d.id}","${u.name}","${u.email}","${u.role}","${u.phone||''}","${u.isActive?'Active':'Terminated'}"\n`; });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv)); link.setAttribute("download", `${rest.name.replace(/\s+/g, '_')}_Users_Export.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    addToast('Export Complete', 'Data delivered to downloads folder.');
  };

  // --- DATABASE SNAPSHOT ENGINE (BACKUP & RESTORE) ---
  const handleCreateBackup = async (rest) => {
    addToast('Backing Up', `Compiling database snapshot for ${rest.name}...`);
    const collectionsToBackup = ['users', 'shifts', 'recipes', 'inventoryItems', 'vendors', 'invoices', 'timePunches', 'sales', 'events', 'tasks', 'wasteLogs', 'timeOffRequests', 'prepCategories', 'roles', 'shiftSwaps', 'maintenanceLogs'];
    const snapshot = { metadata: { restaurantId: rest.id, restaurantName: rest.name, timestamp: new Date().toISOString() }, data: {} };

    try {
      for (const colName of collectionsToBackup) {
        const q = query(collection(db, colName), where("restaurantId", "==", rest.id));
        const snap = await getDocs(q);
        snapshot.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `86chaos_Backup_${rest.name.replace(/\s+/g, '_')}_${getToday()}.json`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addToast('Backup Complete', 'JSON snapshot downloaded successfully.');
    } catch (err) { addToast('Backup Failed', err.message); }
  };

  const handleRestoreBackup = async (e, rest) => {
    const file = e.target.files[0];
    if (!file) return;
    if (prompt(`CRITICAL: Type "RESTORE" to inject this backup file into ${rest.name}'s database.`) !== 'RESTORE') {
      e.target.value = '';
      return addToast('Aborted', 'Restore canceled.');
    }

    addToast('Restoring', 'Injecting data. Do not close your browser...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (backup.metadata.restaurantId !== rest.id) return addToast('Error', 'Tenant ID mismatch. You cannot restore a backup from a different workspace.');

        let restoredCount = 0;
        for (const [colName, docs] of Object.entries(backup.data)) {
          const promises = docs.map(d => {
             const { id, ...data } = d;
             return setDoc(doc(db, colName, id), data);
          });
          await Promise.all(promises);
          restoredCount += docs.length;
        }
        addToast('Restore Complete', `Successfully injected ${restoredCount} documents.`);
      } catch (err) { addToast('Error', 'Invalid backup file or upload failed.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- EMPLOYEE SPECIFIC BACKUP & RESTORE ENGINE ---
  const handleBackupEmployee = async (u) => {
    addToast('Backing Up', `Compiling data for ${u.name}...`);
    const snapshot = { metadata: { userId: u.id, userName: u.name, timestamp: new Date().toISOString() }, data: { users: [u], shifts: [], timePunches: [], timeOffRequests: [] } };
    try {
      const shiftsSnap = await getDocs(query(collection(db, 'shifts'), where('employeeId', '==', u.id)));
      snapshot.data.shifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const punchesSnap = await getDocs(query(collection(db, 'timePunches'), where('employeeId', '==', u.id)));
      snapshot.data.timePunches = punchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const timeOffSnap = await getDocs(query(collection(db, 'timeOffRequests'), where('userId', '==', u.id)));
      snapshot.data.timeOffRequests = timeOffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `86chaos_Employee_${u.name.replace(/\s+/g, '_')}_${getToday()}.json`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Backup Complete', 'Employee JSON downloaded.');
    } catch (err) { addToast('Error', err.message); }
  };

  const handleRestoreEmployee = async (e, u) => {
    const file = e.target.files[0];
    if (!file) return;
    if (prompt(`CRITICAL: Type "RESTORE" to inject this backup into ${u.name}'s profile.`) !== 'RESTORE') {
      e.target.value = ''; return addToast('Aborted', 'Restore canceled.');
    }
    addToast('Restoring', 'Injecting employee data...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (backup.metadata.userId !== u.id && !window.confirm("ID mismatch. Inject anyway?")) return;
        let count = 0;
        for (const [colName, docs] of Object.entries(backup.data)) {
          const promises = docs.map(d => {
            const { id, ...data } = d;
            return setDoc(doc(db, colName, id), data);
          });
          await Promise.all(promises);
          count += docs.length;
        }
        addToast('Restore Complete', `Injected ${count} records.`);
      } catch (err) { addToast('Error', 'Invalid backup file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteGlobalUser = async (u) => {
    if (prompt(`CRITICAL: Type "DELETE" to permanently erase ${u.name} and all their access.`) !== 'DELETE') {
      return addToast('Aborted', 'User deletion canceled.');
    }
    try {
      await deleteDoc(doc(db, "users", u.id));
      addToast('Terminated', `User ${u.name} has been erased.`);
    } catch (err) {
      addToast('Error', 'Could not delete user.');
    }
  };

  // --- OBLITERATION ENGINE ---
  const handleNukeData = async (e) => {
    e.preventDefault();
    if (!nukePassword) return addToast('Error', 'Password required.');
    setIsNuking(true);
    
    try {
      await signInWithEmailAndPassword(auth, appUser.email, nukePassword);
      
      let cols = [];
      if (nukeTarget.type === 'inventory') cols = ['inventoryItems', 'vendors', 'invoices'];
      else if (nukeTarget.type === 'schedule') cols = ['shifts', 'timeOffRequests', 'shiftSwaps'];
      else if (nukeTarget.type === 'recipes') cols = ['recipes'];
      else if (nukeTarget.type === 'events') cols = ['events'];
      else if (nukeTarget.type === 'users') cols = ['users'];
      else if (nukeTarget.type === 'everything') cols = ['inventoryItems', 'vendors', 'invoices', 'users', 'recipes', 'shifts', 'timeOffRequests', 'shiftSwaps', 'events', 'wasteLogs', 'sales', 'maintenanceLogs'];

      let totalDeleted = 0;
      for (const c of cols) {
        const snap = await getDocs(query(collection(db, c), where("restaurantId", "==", nukeTarget.rest.id)));
        const deletePromises = [];
        
        snap.forEach(d => {
           if (c === 'users' && d.id === appUser.id) return;
           deletePromises.push(deleteDoc(doc(db, c, d.id)));
        });
        
        await Promise.all(deletePromises);
        totalDeleted += deletePromises.length;
      }

      addToast('Obliterated', `Deleted ${totalDeleted} documents for ${nukeTarget.rest.name}.`);
      setNukeTarget(null);
      setNukePassword('');
      setEditingRest(null); 
    } catch (err) {
      addToast('Error', 'Authentication failed or deletion error. Check your password.');
    }
    setIsNuking(false);
  };

  // --- 2. SYSTEM OPERATIONS & FORGE ---
  const handleMegaphone = async (e) => {
    e.preventDefault(); 
    if(!broadcastMsg.trim()) return; 
    if(!window.confirm("Blast this to EVERY restaurant?")) return;
    
    addToast('Broadcasting', 'Pushing message to all shards...');
    let success = 0; let failed = 0;
    
    for (const r of restaurants) {
      try {
        await addDoc(collection(db, "events"), { 
          date: new Date().toISOString(), title: broadcastMsg.trim(), type: 'note', author: 'System Alert', isImportant: true, restaurantId: r.id, replies: [] 
        });
        success++;
      } catch (err) { failed++; }
    }
    
    if (failed > 0) addToast('Partial Alert', `Sent to ${success}, but Firebase blocked ${failed}. Check console.`);
    else addToast('Megaphone', `Message blasted successfully to ${success} locations.`);
    setBroadcastMsg('');
  };

 const handleForgePush = async (e, type) => {
    e.preventDefault(); 
    if(!window.confirm(`Push this ${type} to ALL clients globally?`)) return;
    
    addToast('Deploying', `Pushing ${type} to all shards...`);
    let success = 0; let failed = 0;

    for (const r of restaurants) {
      try {
        if (type === 'Event') await addDoc(collection(db, "events"), { type: 'special_event', date: forgeEventDate, title: forgeEventTitle.trim(), addedBy: '86 Chaos System', restaurantId: r.id });
        success++;
      } catch (err) { failed++; }
    }
    
    if (failed > 0) addToast('Partial Deploy', `Pushed to ${success}, but failed on ${failed}.`);
    else addToast('Forge Deployed', `${type} injected globally into ${success} databases.`);
    setForgeEventTitle('');
  };

               const handleTestPush = async () => {
    if (!window.confirm("Fire a test notification to all opted-in devices in your workspace?")) return;
    addToast('Pinging Server', 'Firing test shot to Vercel...');
    try {
      const pushRes = await fetch('/api/send-schedule-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restaurantId: appUser.restaurantId,
          restaurantName: 'TEST MODE'
        })
      });
      const pushData = await pushRes.json();
      if (pushData.message) addToast('Server Reply', pushData.message); 
      else if (pushData.success) addToast('Success', `Test pushed to ${pushData.sentCount} devices.`);
      else addToast('API Error', pushData.error || 'Unknown error');
    } catch (err) {
      addToast('Network Error', 'Failed to reach Vercel.');
    }
  };   

  const handleOrphanSweep = async () => {
    if(!window.confirm("Scan platform for dead shifts (shifts attached to deleted users)?")) return;
    addToast('Scanning', 'Running orphan sweep...');
    const sSnap = await getDocs(collection(db, 'shifts')); let deadCount = 0;
    sSnap.forEach(d => { const s = d.data(); if (!allUsers.find(u => u.id === s.employeeId)) { deleteDoc(doc(db, "shifts", d.id)); deadCount++; } });
    addToast('Sweep Complete', `Purged ${deadCount} orphaned database documents.`);
  };

  const handleForceRefresh = async () => {
    if (!window.confirm("🚨 CRITICAL: This will send a hard-refresh command to EVERY active browser connected to 86 Chaos globally. Proceed?")) return;
    addToast('Executing', 'Sending refresh signal...');
    const stamp = new Date().toISOString(); let count = 0;
    for (const r of restaurants) {
       try { await updateDoc(doc(db, "restaurants", r.id), { forceRefresh: stamp }); count++; } catch(e){}
    }
    addToast('Refresh Broadcast', `Hard reload signal sent to ${count} databases.`);
  };

  const handleGlobalLockdown = async (lock) => {
    if (lock) {
        if (prompt('CRITICAL: This will instantly lock out EVERY client workspace (except yours) by triggering the billing lock screen. Type "LOCKDOWN" to proceed.') !== 'LOCKDOWN') return;
        addToast('Executing', 'Initiating global lockdown...');
    } else {
        if (!window.confirm('Restore access to all suspended workspaces?')) return;
        addToast('Executing', 'Lifting lockdown...');
    }
    
    let count = 0;
    for (const r of restaurants) {
      if (r.id !== appUser.restaurantId) {
        try { await updateDoc(doc(db, "restaurants", r.id), { billingStatus: lock ? 'Past Due' : 'Paid' }); count++; } catch(e){}
      }
    }
    addToast(lock ? 'Lockdown Complete' : 'Unlocked', `${count} workspaces have been ${lock ? 'suspended' : 'restored'}.`);
  };

const handleGrantAccess = async (e) => { e.preventDefault(); const snap = await getDocs(query(collection(db, "users"), where("email", "==", adminEmail.toLowerCase().trim()))); if (snap.empty) return addToast('Not Found', 'User not found.'); await updateDoc(doc(db, "users", snap.docs[0].id), { isSuperAdmin: true }); setAdminEmail(''); addToast('Granted', 'Access given. The user MUST log out and log back in to see the new tab.'); };  const handleRevokeAccess = async (user) => { if (!window.confirm(`Revoke Admin from ${user.name}?`)) return; await updateDoc(doc(db, "users", user.id), { isSuperAdmin: false }); addToast('Revoked', 'Access removed.'); };

  // --- CALCULATIONS ---
  const mrr = restaurants.reduce((acc, r) => acc + (r.planType === 'Enterprise' ? 199 : r.planType === 'Pro' ? 99 : 0), 0);
  const timeAgo = (dateStr) => { if (!dateStr) return 'Never'; const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)); if (days === 0) return 'Active Today'; if (days === 1) return 'Active Yesterday'; return `Inactive ${days} days`; };
  const staleTenants = restaurants.filter(r => r.isActive && Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000) > 21);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      {/* MASTER NAVIGATION */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 border-b border-[#2A353D] mb-6 pb-4">
        {[{id:'overview', label:'Metrics'}, {id:'tenants', label:'Clients'}, {id:'users', label:'Global Users'}, {id:'forge', label:'The Forge'}, {id:'support', label:'Support'}, {id:'forensics', label:'Forensics'}, {id:'ops', label:'Operations'}, {id:'admins', label:'Access'}].map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-2 py-2.5 text-[10px] sm:text-[11px] font-black rounded-xl uppercase tracking-widest transition-all ${subTab === t.id ? 'bg-red-600 text-white shadow-lg scale-[1.02]' : 'bg-[#1A2126] text-slate-400 border border-[#2A353D] hover:text-white hover:border-slate-500'}`}>{t.label}</button>
        ))}
      </div>

      <Modal isOpen={!!editingRest} onClose={() => setEditingRest(null)} title={`Manage Client: ${editingRest?.name}`}>
        {editingRest && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleUpdateTenant} className="space-y-4">
     <div><label className={T.label}>Business Name</label><input type="text" value={editingRest.name} onChange={e => setEditingRest({...editingRest, name: e.target.value})} className={T.input} required /></div>
              <div><label className={T.label}>Owner Name</label><input type="text" value={editingRest.ownerName || ''} onChange={e => setEditingRest({...editingRest, ownerName: e.target.value})} className={T.input} required /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={T.label}>Owner Email</label><input type="email" value={editingRest.ownerEmail || ''} onChange={e => setEditingRest({...editingRest, ownerEmail: e.target.value})} className={T.input} required /></div>
                <div><label className={T.label}>Owner Phone</label><input type="tel" value={editingRest.ownerPhone || ''} onChange={e => setEditingRest({...editingRest, ownerPhone: e.target.value})} className={T.input} required /></div>
              </div>
              <div><label className={T.label}>Street Address</label><input type="text" value={editingRest.systemSettings?.address || ''} onChange={e => setEditingRest({...editingRest, systemSettings: { ...editingRest.systemSettings, address: e.target.value }})} className={T.input} /></div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div><label className={T.label}>Plan Tier</label><select value={editingRest.planType || 'Pro'} onChange={e => setEditingRest({...editingRest, planType: e.target.value})} className={T.input}><option>Trial</option><option>Pro</option><option>Enterprise</option></select></div>
                <div><label className={T.label}>Billing Status</label><select value={editingRest.billingStatus || 'Paid'} onChange={e => setEditingRest({...editingRest, billingStatus: e.target.value})} className={`${T.input} ${editingRest.billingStatus === 'Past Due' ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}`}><option value="Paid">Paid (Active)</option><option value="Past Due">Past Due (Lock App)</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="flex items-center gap-2 p-3 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer"><input type="checkbox" checked={editingRest.isActive} onChange={e => setEditingRest({...editingRest, isActive: e.target.checked})} className="w-4 h-4 accent-emerald-500" /><span className={`text-xs font-black ${editingRest.isActive ? 'text-emerald-500' : 'text-slate-500'}`}>System Active</span></label>
                <label className="flex items-center gap-2 p-3 bg-blue-900/10 rounded-xl border border-blue-900/50 cursor-pointer"><input type="checkbox" checked={editingRest.isReadOnly} onChange={e => setEditingRest({...editingRest, isReadOnly: e.target.checked})} className="w-4 h-4 accent-blue-500" /><span className={`text-xs font-black ${editingRest.isReadOnly ? 'text-blue-500' : 'text-slate-500'}`}>Read-Only Mode</span></label>
              </div>
              <div className="pt-2 border-t border-[#2A353D]">
                 <label className={T.label}>Module Access</label>
                 <div className="grid grid-cols-2 gap-2 mt-2">
                    {['schedule', 'messages', 'prep', 'recipes', 'inventory', 'sales', 'team', 'maintenance', 'timesheets'].map(feat => (
                      <label key={feat} className="flex items-center gap-2 bg-[#12161A] p-2.5 rounded-lg border border-[#2A353D] cursor-pointer hover:bg-[#1A2126]">
                        <input type="checkbox" checked={editingRest.features ? editingRest.features[feat] : true} onChange={e => setEditingRest({...editingRest, features: { ...(editingRest.features || {}), [feat]: e.target.checked }})} className="w-4 h-4 accent-[#8F6040]" />
                        <span className="text-xs font-bold text-slate-300 capitalize">{feat}</span>
                      </label>
                    ))}
                 </div>
              </div>
              
              {/* LABS / CANARY ROLLOUT */}
              <div className="pt-2 border-t border-[#2A353D]">
                <label className={T.label}>Labs / Beta Features (Canary Rollout)</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2 bg-[#12161A] p-2.5 rounded-lg border border-[#2A353D] cursor-pointer hover:bg-[#1A2126]">
                    <input type="checkbox" checked={editingRest.labs?.laborProjection || false} onChange={e => setEditingRest({...editingRest, labs: { ...(editingRest.labs || {}), laborProjection: e.target.checked }})} className="w-4 h-4 accent-purple-500" />
                    <span className="text-xs font-bold text-purple-400 capitalize">Labor Projections</span>
                  </label>
                </div>
              </div>

              <button type="submit" className={`w-full ${T.btn} bg-gradient-to-r from-red-600 to-red-800 text-white mt-4`}>Save Configuration</button>
            </form>

            {/* BACKUP & RESTORE */}
            <div className="pt-4 border-t border-[#2A353D] mt-4 space-y-3">
              <h4 className="text-[10px] uppercase tracking-widest text-emerald-500 font-black mb-2">Database Backup & Recovery</h4>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleCreateBackup(editingRest)} className="w-full bg-emerald-900/20 text-emerald-400 font-bold py-2.5 rounded-lg border border-emerald-900/50 hover:bg-emerald-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                  💾 Download JSON
                </button>
                <label className="w-full bg-blue-900/20 text-blue-400 font-bold py-2.5 rounded-lg border border-blue-900/50 hover:bg-blue-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                  <span>🔄 Upload Restore</span>
                  <input type="file" accept=".json" onChange={(e) => handleRestoreBackup(e, editingRest)} className="hidden" />
                </label>
              </div>
              <button type="button" onClick={() => handleExportData(editingRest)} className="w-full bg-[#12161A] text-slate-300 font-bold py-2 rounded-xl border border-[#2A353D] hover:text-white transition-all text-xs flex items-center justify-center gap-2 mt-2">
                <ClipboardList size={14}/> Download CSV User Export
              </button>
            </div>

            {/* DANGER ZONE */}
            <div className="pt-4 border-t border-red-900/50 mt-4 space-y-3">
              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-red-500 font-black mb-2 text-center">Danger Zone (Data Wipes)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'inventory', label: 'Inventory & Vendors' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Inventory</button>
                  <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'schedule', label: 'Schedule & Time Off' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Schedule</button>
                  <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'recipes', label: 'All Recipes' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Recipes</button>
                  <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'events', label: 'Events & Messages' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Events/Msgs</button>
                  <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'users', label: 'All Users/Staff' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Users</button>
                  <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'everything', label: 'ABSOLUTELY EVERYTHING' })} className="w-full bg-red-600/20 text-red-500 font-black py-2 rounded-lg border border-red-500/50 hover:bg-red-600 hover:text-white transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> NUKE ALL</button>
                </div>
              </div>
            </div>

          </div>
        )}
      </Modal>

      <Modal isOpen={!!nukeTarget} onClose={() => { setNukeTarget(null); setNukePassword(''); }} title={`⚠️ CRITICAL: Nuke ${nukeTarget?.label}`}>
        <form onSubmit={handleNukeData} className="space-y-4">
          <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-xl text-red-200 text-xs font-bold leading-relaxed">
            You are about to permanently delete <strong>{nukeTarget?.label}</strong> for <strong>{nukeTarget?.rest?.name}</strong>. This action cannot be undone.
          </div>
          <div>
            <label className={T.label}>Enter Your Master Admin Password</label>
            <input type="password" value={nukePassword} onChange={e => setNukePassword(e.target.value)} className={T.input} required placeholder="Authenticate to confirm..." disabled={isNuking} />
          </div>
          <button type="submit" disabled={isNuking} className={`w-full ${T.btn} bg-red-600 hover:bg-red-700 text-white flex justify-center items-center gap-2`}>
            {isNuking ? <Loader2 className="animate-spin" size={18} /> : <><Trash2 size={18} /> Permanently Delete Data</>}
          </button>
        </form>
      </Modal>

      {/* --- TAB: OVERVIEW --- */}
      {subTab === 'overview' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-emerald-900/30`}><div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Est. Platform MRR</div><div className="text-3xl lg:text-4xl font-black text-white">${mrr}<span className="text-sm lg:text-lg text-slate-500">/mo</span></div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest mb-1">Active Tenants</div><div className="text-3xl lg:text-4xl font-black text-white">{restaurants.filter(r=>r.isActive).length}</div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Network Users</div><div className="text-3xl lg:text-4xl font-black text-white">{allUsers.length}</div></div>
            {appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com' && (
              <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-fuchsia-900/30`}><div className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest mb-1">Total App Installs</div><div className="text-3xl lg:text-4xl font-black text-white">{totalInstalls}</div></div>
            )}          
          </div>

          {/* STALE ACCOUNT ALERTS */}
          {staleTenants.length > 0 && (
            <div className={`${T.card} p-6 border-orange-900/30`}>
              <h3 className="font-black text-lg text-white mb-2 flex items-center gap-2"><Bell className="text-orange-500" size={18}/> Stale Account Alerts</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3">These active accounts have not logged in for over 21 days.</p>
              <div className="space-y-2">
                {staleTenants.map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-lg border border-[#2A353D]">
                    <div><div className="font-bold text-sm text-white">{r.name}</div><div className="text-[10px] text-slate-500">{r.ownerEmail}</div></div>
                    <div className="text-orange-400 font-black text-xs">Inactive {Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000)} Days</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`${T.card} p-6 border-red-900/30`}>
            <h3 className="font-black text-lg text-white mb-2 flex items-center gap-2"><Shield className="text-red-500" size={18}/> System Status</h3>
            <div className="flex items-center gap-3"><span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-sm font-bold text-slate-300">All Database Shards Operational   Version {CURRENT_VERSION} Online</span></div>
          </div>
        </div>
      )}

      {/* --- TAB: TENANTS --- */}
      {subTab === 'tenants' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
 <form onSubmit={handleDeployTenant} className={`${T.card} p-5 border-red-900/50 shadow-[0_0_20px_rgba(220,38,38,0.1)]`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white flex items-center gap-2">Deploy New Workspace</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Restaurant Name" value={rName} onChange={e=>setRName(e.target.value)} className={T.input} required />
              <input type="text" placeholder="Full Street Address" value={rAddress} onChange={e=>setRAddress(e.target.value)} className={T.input} required />
              <input type="text" placeholder="Owner Name" value={oName} onChange={e=>setOName(e.target.value)} className={T.input} required />
              <input type="email" placeholder="Owner Email" value={oEmail} onChange={e=>setOEmail(e.target.value)} className={T.input} required />
              <input type="tel" placeholder="Owner Phone" value={oPhone} onChange={e=>setOPhone(e.target.value)} className={`${T.input} sm:col-span-2`} required />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg mt-4 transition-colors">Deploy Database & Email Credentials</button>
          </form>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-sm text-white">Client Roster</h3><span className="bg-[#1A2126] text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">{restaurants.length} Total</span></div>
            <div className={`divide-y ${T.border}`}>
              {restaurants.map(r => (
                <div key={r.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                  <div>
                    <div className="font-black text-white text-lg flex items-center gap-2 flex-wrap">
                      {r.name} 
                      {!r.isActive && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase">Suspended</span>}
                      {r.isReadOnly && <span className="bg-blue-900 text-blue-300 border border-blue-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">Read-Only</span>}
                      {r.billingStatus === 'Past Due' ? <span className="bg-red-900 text-red-400 border border-red-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">Past Due</span> : <span className="bg-emerald-900 text-emerald-400 border border-emerald-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">{r.planType || 'Pro'}</span>}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Owner: {r.ownerName} <span className="mx-1"> </span> {r.ownerEmail} {r.ownerPhone && <><span className="mx-1"> </span> {r.ownerPhone}</>}</div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">ID: {r.id} <span className="mx-1"> </span> <span className="text-[#D4A381]">{userCounts[r.id] || 0} Seats</span> <span className="mx-1"> </span> <span className={timeAgo(r.lastActive).includes('Inactive') ? 'text-red-400' : 'text-emerald-500'}>Ping: {timeAgo(r.lastActive)}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setGhostTenant({ id: r.id, name: r.name })} className="px-3 py-1.5 bg-purple-900/20 border border-purple-500/50 text-purple-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-purple-900/50 transition-colors shadow-sm flex items-center gap-1"><Moon size={14} /> Possess</button>
                    <button onClick={() => setEditingRest(r)} className="px-3 py-1.5 bg-[#12161A] border border-[#2A353D] text-slate-300 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:text-white transition-colors shadow-sm">Manage</button>
                    <button onClick={() => handleDeleteTenant(r.id, r.name)} className="px-3 py-1.5 bg-red-900/10 border border-red-900/30 text-red-500 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-900/40 transition-colors shadow-sm"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: GLOBAL USERS --- */}
      {subTab === 'users' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-4 flex gap-3 items-center`}>
            <Search className={T.copper} size={20}/>
            <input type="text" placeholder="Search any user by name, email, role, or ID..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} className={T.input}/>
          </div>
          <div className={`divide-y ${T.border} ${T.card} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {allUsers.filter(u => {
              const restName = restaurants.find(r => r.id === u.restaurantId)?.name || '';
              return (u.name + u.email + u.role + u.id + restName).toLowerCase().includes(userSearch.toLowerCase());
            }).slice(0, 50).map(u => {              
              const restName = restaurants.find(r => r.id === u.restaurantId)?.name || 'Unknown Location';
              return (
                <div key={u.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-3`}>
                  <div>
                    <div className="font-bold text-white text-sm">{u.name} {u.isAdmin && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase ml-1">Admin</span>}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{u.email} <span className="mx-1"> </span> <span className={T.copper}>{u.role}</span></div>
                    <div className="text-[9px] text-slate-500 mt-0.5 tracking-widest uppercase">{restName} <span className="mx-1">|</span> <span className={timeAgo(u.lastActive).includes('Inactive') ? 'text-red-400' : 'text-emerald-500'}>Ping: {timeAgo(u.lastActive)}</span></div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setGhostTenant({ id: u.restaurantId, name: restName, impersonate: u })} className="px-3 py-1.5 bg-fuchsia-900/20 border border-fuchsia-500/50 text-fuchsia-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-fuchsia-900/40 transition-colors shadow-sm flex items-center gap-1">
                      <Moon size={14} /> Possess
                    </button>
                    <button onClick={() => handleBackupEmployee(u)} className="p-1.5 bg-[#12161A] border border-[#2A353D] text-slate-400 hover:text-emerald-400 rounded-lg transition-colors shadow-sm" title="Download User Data JSON">
                      💾
                    </button>
                    <label className="p-1.5 bg-[#12161A] border border-[#2A353D] text-slate-400 hover:text-blue-400 rounded-lg transition-colors shadow-sm cursor-pointer" title="Inject Data to User">
                      <input type="file" accept=".json" onChange={(e) => handleRestoreEmployee(e, u)} className="hidden" />
                      🔄
                    </label>
              <button onClick={async () => {
                      if(!window.confirm(`Force ${u.name} to log out and clear their device cache?`)) return;
                      await updateDoc(doc(db, "users", u.id), { forceLogout: true });
                      addToast('Executed', 'Kill signal sent to user device.');
                    }} className="p-1.5 bg-orange-900/20 border border-orange-900/50 text-orange-500 hover:bg-orange-900/40 rounded-lg transition-colors shadow-sm" title="Force Logout & Cache Clear">
                      🔌
                    </button>
                    <button onClick={async () => {
                      if(!window.confirm(`Force ${u.name} into the Password Reset flow on their next login?`)) return;
                      await updateDoc(doc(db, "users", u.id), { forcePasswordChange: true });
                      addToast('Executed', 'User must reset password on next login.');
                    }} className="p-1.5 bg-yellow-900/20 border border-yellow-900/50 text-yellow-500 hover:bg-yellow-900/40 rounded-lg transition-colors shadow-sm" title="Force Password Reset Screen">
                      🔑
                    </button>
                    <button onClick={() => handleDeleteGlobalUser(u)} className="p-1.5 bg-red-900/10 border border-red-900/30 text-red-500 hover:bg-red-900/40 rounded-lg transition-colors shadow-sm" title="Delete Account">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

{/* --- TAB: THE FORGE --- */}
      {subTab === 'forge' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={(e) => handleForgePush(e, 'Event')} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white flex items-center gap-2"><Calendar className={T.copper} size={18}/> Global Event Injection</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Force an event onto every client's calendar simultaneously.</p></div>
            <div className="flex flex-col sm:flex-row gap-3"><input type="date" value={forgeEventDate} onChange={e=>setForgeEventDate(e.target.value)} className={`${T.input} sm:w-48`} required /><input type="text" placeholder="Event Title (e.g. Mother's Day)" value={forgeEventTitle} onChange={e=>setForgeEventTitle(e.target.value)} className={T.input} required /><button type="submit" className={`${T.btn} px-8 whitespace-nowrap`}>Push Event</button></div>
          </form>
        </div>
      )}

      {/* --- TAB: SUPPORT & CRASHES --- */}
      {subTab === 'support' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
            <h3 className="font-black text-sm text-white flex items-center gap-2"><Bug className="text-orange-500" size={18}/> Live Diagnostics / Bug Ledger</h3>
            <button onClick={() => { if(window.confirm("Clear all crash logs?")) { crashLogs.forEach(log => deleteDoc(doc(db, "crashReports", log.id))); } }} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 border border-[#2A353D] px-2 py-1 rounded transition-colors">Clear Logs</button>
          </div>
          <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {crashLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No bugs or crashes logged yet. System stable.</div>}
            {crashLogs.map(log => (
              <div key={log.id} className={`${T.row} flex flex-col gap-2`}>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/50 break-all leading-tight">{log.message}</span>
                  <span className={`text-[9px] font-bold ${T.muted} whitespace-nowrap ml-2`}>{new Date(log.time).toLocaleString()}</span>
                </div>
{/* HARDWARE DIAGNOSTICS UI */}
                        {(log.screenSize || log.userAgent) && (
                          <div className="text-[9px] mt-1.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-[#0B0E11] p-1.5 rounded-lg border border-[#2A353D]">
                            {log.screenSize && <span className="font-black text-blue-400 whitespace-nowrap">🖥️ {log.screenSize}</span>}
                            {log.userAgent && <span className="font-medium text-slate-500 truncate" title={log.userAgent}>📱 {log.userAgent}</span>}
                          </div>
                        )}

                
                {/* TELEMETRY BREADCRUMBS UI */}
                {log.breadcrumbs && log.breadcrumbs.length > 0 && (
                  <div className="bg-[#0B0E11] rounded-lg border border-[#2A353D] p-2 mt-1">
                     <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">User Action Telemetry (Last 15 Clicks)</div>
                     <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                       {log.breadcrumbs.map((crumb, idx) => (
                         <div key={idx} className="flex gap-2 hover:bg-[#12161A] px-1 rounded transition-colors">
                           <span className="text-emerald-500/70">[{crumb.time}]</span>
                           <span className="text-slate-500">{crumb.action}:</span>
                           <span className="text-blue-300">"{crumb.target}"</span>
                         </div>
                       ))}
                     </div>
                  </div>
                )}

                {log.stack && <div className="text-[9px] text-slate-500 font-mono mt-1 overflow-x-auto whitespace-pre-wrap bg-[#0B0E11] p-2 rounded border border-[#2A353D] opacity-70 hover:opacity-100 transition-opacity">{log.stack}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB: FORENSICS (GLOBAL AUDIT TRAIL) --- */}
<Modal isOpen={isRawInspectorOpen} onClose={() => { setIsRawInspectorOpen(false); setRawInspectorData(null); }} title="Raw Database Inspector">
        <div className="space-y-4">
          <form onSubmit={handleFetchRawDoc} className="flex gap-2">
            <select value={rawInspectorCollection} onChange={e=>setRawInspectorCollection(e.target.value)} className={`${T.input} w-1/3`}>
              <option value="users">Users</option>
              <option value="restaurants">Restaurants</option>
              <option value="shifts">Shifts</option>
              <option value="recipes">Recipes</option>
              <option value="inventoryItems">Inventory</option>
              <option value="timePunches">Time Punches</option>
            </select>
            <input type="text" value={rawInspectorId} onChange={e=>setRawInspectorId(e.target.value)} placeholder="Paste Document ID..." className={`${T.input} flex-1`} required />
            <button type="submit" className={`${T.btn} px-4`}><Search size={18}/></button>
          </form>
          {rawInspectorData && (
            <div className="bg-[#0B0E11] p-4 rounded-xl border border-[#2A353D] overflow-x-auto max-h-[50vh] custom-scrollbar">
              <pre className="text-[10px] text-emerald-400 font-mono leading-relaxed">
                {JSON.stringify(rawInspectorData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Modal>
      {subTab === 'forensics' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
<div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
            <h3 className="font-black text-sm text-white flex items-center gap-2"><Search className="text-blue-500" size={18}/> Global Forensics & Ghost Audit</h3>
            <button onClick={() => setIsRawInspectorOpen(true)} className="bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-2">
              <Wrench size={12} /> Inspect Raw JSON
            </button>
          </div>          <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {auditLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No forensic data logged yet.</div>}
            {auditLogs.map(log => (
              <div key={log.id} className={`${T.row} flex flex-col gap-1`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{log.userName}</span>
                    {log.isGhost && <span className="bg-purple-900/20 text-purple-400 border border-purple-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest flex items-center gap-1">👻 Ghost Action</span>}
                    <span className={`text-[9px] uppercase font-black tracking-widest bg-[#12161A] border ${T.border} text-blue-400 px-2 py-0.5 rounded`}>{log.action}</span>
                  </div>
                  <span className={`text-[9px] font-bold ${T.muted} whitespace-nowrap ml-2`}>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1">
                  {log.details} <span className="text-slate-500 ml-1">Target: [{log.target}]</span> <span className="text-[#D4A381] ml-1">Tenant ID: {log.restaurantId}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB: OPERATIONS --- */}
      {subTab === 'ops' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleMegaphone} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white">System Megaphone</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Push a priority system alert to the message board of every single restaurant.</p></div>
            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} rows="3" className={`${T.input} mb-3 border-[#D4A381]/50 focus:border-[#D4A381]`} placeholder="SYSTEM ALERT: Maintenance scheduled for 3AM..."></textarea>
            <button type="submit" className="w-full bg-[#12161A] text-[#D4A381] border border-[#2A353D] hover:bg-[#1A2126] font-black uppercase tracking-widest py-3 rounded-xl transition-colors">Blast Message</button>
          </form>

    <div className={`${T.card} p-5 border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.05)]`}>
            <form onSubmit={handlePushBanner}>
              <div className="mb-4 pb-2 border-b border-[#2A353D]">
                <h2 className="text-lg font-black text-blue-400 flex items-center gap-2"><Bell size={18}/> Top-of-App Banner Broadcast</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Pin a persistent, high-visibility alert directly below the main header.</p>
              </div>
              <div className="space-y-3">
                <select value={bannerTarget} onChange={e => setBannerTarget(e.target.value)} className={T.input}>
                  <option value="ALL">🚨 ALL WORKSPACES (GLOBAL)</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="text" value={bannerText} onChange={e => setBannerText(e.target.value)} placeholder="e.g. SYSTEM DEGRADED - POS SYNC IS CURRENTLY DOWN" className={T.input} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-sm">Pin Banner</button>
                  <button type="button" onClick={handleClearBanner} className="px-6 bg-[#12161A] text-slate-400 border border-[#2A353D] hover:text-red-400 font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-sm">Clear Selected</button>
                </div>
              </div>
            </form>

            {/* THE ACTIVE BANNER LEDGER */}
            {restaurants.filter(r => r.systemBanner).length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                <h3 className="text-[10px] font-black uppercase text-[#D4A381] tracking-widest mb-3">Currently Active Banners</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {restaurants.filter(r => r.systemBanner).map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-bold text-white truncate">{r.name}</div>
                        <div className="text-[10px] text-blue-400 font-bold mt-0.5 leading-snug break-words">"{r.systemBanner}"</div>
                      </div>
                      <button type="button" onClick={async () => {
                        if(!window.confirm(`Clear banner for ${r.name}?`)) return;
                        await updateDoc(doc(db, "restaurants", r.id), { systemBanner: null });
                        addToast('Cleared', `Banner removed from ${r.name}.`);
                      }} className="text-slate-400 hover:text-red-500 p-2 flex-shrink-0 transition-colors bg-[#1A2126] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${T.card} p-5 border-fuchsia-900/30`}>
              <h3 className="font-black text-white mb-1">Test Push Notifications</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Fires a live test ping through Vercel to verify tokens and Firebase Admin credentials are working.</p>
              <button onClick={handleTestPush} type="button" className="w-full bg-fuchsia-900/20 text-fuchsia-400 border border-fuchsia-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-fuchsia-900/40 transition-colors flex items-center justify-center gap-2"><Bell size={16}/> Fire Test Alert</button>
            </div>
            <div className={`${T.card} p-5 border-emerald-900/30`}>
              <h3 className="font-black text-white mb-1">Global Force Refresh</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Pushes a silent command to all active devices to instantly hard-reload the browser. Use after deploying new code.</p>
              <button onClick={handleForceRefresh} className="w-full bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-emerald-900/40 transition-colors">Execute Global Refresh</button>
            </div>
            <div className={`${T.card} p-5 border-blue-900/30`}>
              <h3 className="font-black text-white mb-1">Orphan Data Sweeper</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Scans all global databases for shifts assigned to employees that have been fully deleted. Reclaims server space.</p>
              <button onClick={handleOrphanSweep} className="w-full bg-blue-900/20 text-blue-400 border border-blue-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-blue-900/40 transition-colors">Run DB Sweep</button>
            </div>
            
            <div className={`${T.card} p-5 border-red-900/30 sm:col-span-2`}>
              <h3 className="font-black text-white mb-1">Global Lockdown</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Instantly suspends every tenant by triggering the Past Due billing lock. Bypasses your own workspace to prevent self-lockout.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleGlobalLockdown(true)} className="w-full bg-red-900/20 text-red-500 border border-red-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"><Shield size={16}/> Lock All</button>
                <button onClick={() => handleGlobalLockdown(false)} className="w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2">Unlock All</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- TAB: ACCESS CONTROL --- */}
      {subTab === 'admins' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleGrantAccess} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white">Grant Administrator Access</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Add a user's exact email address to grant full system control.</p></div>
            <div className="flex flex-col sm:flex-row gap-3"><input type="email" placeholder="User's exact email..." value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} className={T.input} required /><button type="submit" className={`${T.btn} px-8`}>Grant Access</button></div>
          </form>
          <div className={`${T.card} overflow-hidden`}><div className={`bg-[#12161A] p-4 border-b ${T.border}`}><h3 className="font-black text-sm text-white">Platform Administrators</h3></div><div className={`divide-y ${T.border}`}>{superAdmins.map(admin => (<div key={admin.id} className={`${T.row} flex justify-between items-center`}><div><div className="font-black text-white">{admin.name}</div><div className="text-[10px] font-bold text-slate-400">{admin.email}</div></div><button onClick={() => handleRevokeAccess(admin)} className="px-3 py-1.5 bg-[#12161A] border border-[#2A353D] text-red-500 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#1A2126] transition-colors">Revoke</button></div>))}</div></div>
        </div>
      )}
    </div>
  );
};



export default function App() {
  const [appUser, setAppUser] = useState(() => { 
    const savedLocal = localStorage.getItem('86chaosUser'); 
    const savedSession = sessionStorage.getItem('86chaosUser');
    return savedLocal ? JSON.parse(savedLocal) : (savedSession ? JSON.parse(savedSession) : null); 
  });
  // --- GHOST MODE & ROUTING STATE ---
  const [ghostTenant, setGhostTenant] = useState(null);
      
  const rId = ghostTenant ? ghostTenant.id : appUser?.restaurantId;
  
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

    checkAppVersion();
    const versionInterval = setInterval(checkAppVersion, 3 * 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);



  
                    
  // --- APP INSTALL TRACKER (NEW) ---
  useEffect(() => {
    const handleAppInstall = () => {
      const currentUser = JSON.parse(localStorage.getItem('86chaosUser'));
      logAudit(currentUser, 'APP_INSTALLED', 'Device OS', 'User installed 86chaos as a native app to their device.');
    };
    window.addEventListener('appinstalled', handleAppInstall);
    return () => window.removeEventListener('appinstalled', handleAppInstall);
  }, []);

// --- DATABASE IMPORTS (Optimized) ---
  const users = useLiveCollection('users', rId);
  const shifts = useLiveCollection('shifts', rId);
  const shiftSwaps = useLiveCollection('shiftSwaps', rId);
  const events = useLiveCollection('events', rId);
  const sales = useLiveCollection('sales', rId);
  const timeOffRequests = useLiveCollection('timeOffRequests', rId);
  const timePunches = useLiveCollection('timePunches', rId);
  
// --- LIVE APP USER LOGIC ---
  let liveAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users?.find(u => u.id === appUser.id) || appUser)) : null;
  if (ghostTenant && liveAppUser) {
    if (ghostTenant.impersonate) {
       // IMPERSONATION MODE: Inherit exact permissions of target user
       liveAppUser = { ...ghostTenant.impersonate, isGhost: true };
    } else {
       // STANDARD GHOST MODE: Enter as a super admin
       liveAppUser = { ...liveAppUser, restaurantId: ghostTenant.id, restaurantName: ghostTenant.name, isAdmin: true, role: 'System Administrator', isGhost: true };
    }
  }

  // --- REMOTE SESSION KILL SWITCH ---
  useEffect(() => {
    if (liveAppUser?.forceLogout) {
      updateDoc(doc(db, "users", liveAppUser.id), { forceLogout: false }).catch(()=>{});
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
      setAppUser(null);
      alert("Session terminated by System Administrator to clear a cache error. Please log in again.");
    }
  }, [liveAppUser?.forceLogout]);

  // --- GLOBAL WORKSPACE & HEALTH PING ---

  // --- GLOBAL WORKSPACE & HEALTH PING ---
  const [clientData, setClientData] = useState({});
  const clientFeatures = clientData?.features || {};

  if (liveAppUser && clientData?.systemSettings) {
     liveAppUser = { ...liveAppUser, systemSettings: clientData.systemSettings };
  }

  useEffect(() => {
    if (!rId) return;
    
    // 1. Fetch Master Client Data (Features & Billing)
    const unsub = onSnapshot(doc(db, 'restaurants', rId), (d) => {
      if (d.exists()) {
         const data = d.data();
         setClientData(data);
         
         // FORCE REFRESH LISTENER
         const localRefresh = sessionStorage.getItem('lastRefreshSignal');
         if (data.forceRefresh && data.forceRefresh !== localRefresh) {
            sessionStorage.setItem('lastRefreshSignal', data.forceRefresh);
            if (localRefresh) {
                // Instantly triggers a hard reload and pulls fresh cache from Vercel
                window.location.reload(true);
            }
         }
      }
    });

// 2. Health Ping (Only trigger if a real user is logging in, NOT Ghost Mode)
    if (!ghostTenant && appUser?.id) {
      const today = new Date().toDateString();
      const lastPing = localStorage.getItem(`ping_user_${appUser.id}`);
      if (lastPing !== today) {
        updateDoc(doc(db, 'restaurants', rId), { lastActive: new Date().toISOString() }).catch(()=>{});
        updateDoc(doc(db, 'users', appUser.id), { lastActive: new Date().toISOString() }).catch(()=>{});
        localStorage.setItem(`ping_user_${appUser.id}`, today);
      }
    }

    return () => unsub();
  }, [rId, ghostTenant]);

 
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
    const shouldRemember = localStorage.getItem('chaosRememberMe') !== 'false';
    if (appUser) {
      if (shouldRemember) {
        localStorage.setItem('86chaosUser', JSON.stringify(appUser));
        sessionStorage.removeItem('86chaosUser');
      } else {
        sessionStorage.setItem('86chaosUser', JSON.stringify(appUser));
        localStorage.removeItem('86chaosUser');
      }
    } else {
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
    }
  }, [appUser]);

  // --- AUTO-LOGOUT INACTIVITY TIMER (30 MINUTES) ---
  useEffect(() => {
    if (!appUser) return;
    let timeoutId;
    
    const logoutUser = () => {
      setAppUser(null);
      alert("You have been automatically logged out due to inactivity.");
    };
    
    const resetTimer = () => {
      clearTimeout(timeoutId);
      // Change the 30 below to whatever minute threshold you prefer
      timeoutId = setTimeout(logoutUser, 30 * 60 * 1000); 
    };
    
    // Listen for any kind of interaction
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();
    
    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [appUser]);
  

  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);


// --- NOTIFICATION DOT LOGIC (WITH READ RECEIPTS) ---
  // 1. Unread Messages (with NaN safety fallback)
  const latestNoteDate = events.filter(e => e.type === 'note').reduce((max, n) => {
     const dTime = new Date(n.date || 0).getTime();
     return isNaN(dTime) ? max : Math.max(max, dTime);
  }, 0);
  const lastReadMsg = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadMsg`) || '0') : 0;
  const hasUnreadMessages = latestNoteDate > lastReadMsg && activeTabState !== 'messages';

  // 2. Shift Swaps (Clear dot when they visit My Shift / Trade Board)
  const latestSwap = shiftSwaps.filter(s => s.status === 'available' && s.originalEmployeeId !== liveAppUser?.id).reduce((max, s) => Math.max(max, new Date(s.date).getTime()), 0);
  const lastReadSwaps = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadSwaps`) || '0') : 0;
  const hasAvailableSwaps = latestSwap > lastReadSwaps && activeTabState !== 'published'; 

  // 3. Manager Alerts (Clear dot when they visit Schedule Builder)
  const realCurrentMonthStr = getToday().substring(0, 7);
  const latestTimeOffReq = timeOffRequests.filter(r => r.status === 'pending' && r.date?.startsWith(realCurrentMonthStr)).reduce((max, r) => Math.max(max, new Date(r.submittedAt || 0).getTime()), 0);
  const lastReadTimeOff = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadTimeOff`) || '0') : 0;
  const isManagerAlert = !!(liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule) && (latestTimeOffReq > lastReadTimeOff) && activeTabState !== 'schedule';

  // Consolidated Alerts
  const hasMyShiftAlert = hasAvailableSwaps; 
  const hasScheduleBuilderAlert = isManagerAlert; 
  const hasAnyMenuAlert = hasUnreadMessages || hasMyShiftAlert || hasScheduleBuilderAlert; 

  // The "Read Receipt" Engine - Clears the dots instantly when tabs are opened
  useEffect(() => {
    if (!liveAppUser) return;
    if (activeTabState === 'messages') localStorage.setItem(`${liveAppUser.id}_lastReadMsg`, Date.now().toString());
    if (activeTabState === 'published') localStorage.setItem(`${liveAppUser.id}_lastReadSwaps`, Date.now().toString());
    if (activeTabState === 'schedule') localStorage.setItem(`${liveAppUser.id}_lastReadTimeOff`, Date.now().toString());
  }, [activeTabState, events, shiftSwaps, timeOffRequests, liveAppUser]);

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

// --- AUTO-ASK FOR NOTIFICATIONS ON LOGIN ---
  useEffect(() => {
    if (liveAppUser && !ghostTenant && typeof window !== 'undefined' && 'Notification' in window) {
      // Only ask if they haven't made a decision yet
      if (Notification.permission === 'default') {
        // Wait 2.5 seconds after app load so the browser doesn't flag it as spam
        setTimeout(() => {
          Notification.requestPermission().then(async (permission) => {
            if (permission === 'granted' && messaging) {
              const currentToken = await getToken(messaging, { 
                vapidKey: 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc' 
              });
              if (currentToken) {
                await updateDoc(doc(db, "users", liveAppUser.id), { fcmToken: currentToken });
                addToast('Success', 'Push notifications enabled for this device.');
              }
            }
          });
        }, 2500);
      }
    }
  }, [liveAppUser?.id]);
                      
  // --- FOREGROUND NOTIFICATION CATCHER ---
  useEffect(() => {
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      console.log("Foreground message caught:", payload);
      addToast(
        payload.notification?.title || 'System Alert', 
        payload.notification?.body || 'You have a new notification.'
      );
    });
    return () => unsub();
  }, [addToast, messaging]);

  const prevDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setCurrentDate(formatDate(d)); };
  const nextDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setCurrentDate(formatDate(d)); };
  const prevMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setCurrentDate(formatDate(d)); };
  const nextMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); setCurrentDate(formatDate(d)); };

  if (labelsToPrint) return <DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} />;

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} addToast={addToast} />;

  // BILLING LOCK SCREEN (Only locks real users, Super Admins in Ghost Mode bypass this)
  if (clientData?.billingStatus === 'Past Due' && !ghostTenant) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${T.bg}`}>
        <div className="bg-[#1A2126] p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-md w-full">
          <span className="text-6xl mb-4 block">🚫</span>
          <h1 className="text-2xl font-black text-white mb-2">Subscription Past Due</h1>
          <p className="text-slate-400 font-medium mb-6">Access to 86 Chaos has been temporarily suspended for {clientData.name || 'this workspace'}. Please contact your management team or 86 Chaos Support to renew your plan.</p>
          <button onClick={() => { localStorage.removeItem('86chaosUser'); setAppUser(null); }} className="w-full bg-red-900/20 text-red-500 font-black py-3 rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-all uppercase tracking-widest">Log Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col ${T.bg}`}>
      
      {/* GHOST MODE BANNER */}
      {ghostTenant && (
        <div className="bg-gradient-to-r from-purple-900 to-fuchsia-900 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[99999] shadow-2xl uppercase tracking-wider border-b border-fuchsia-500/50">
          <div className="flex items-center gap-2 min-w-0">
            <Moon size={16} className="flex-shrink-0 animate-pulse text-fuchsia-300" />
            <span className="truncate">GHOST MODE OVERRIDE: {ghostTenant.name}</span>
          </div>
          <button onClick={() => { setGhostTenant(null); window.history.pushState({ tab: 'godmode' }, '', '?tab=godmode'); setActiveTabState('godmode'); }} className="bg-white text-purple-900 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3">
            EXIT GHOST MODE
          </button>
        </div>
      )}
      
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 animate-pulse text-white"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
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
          {hasAnyMenuAlert && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#12161A] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
        </button>
      </header>

          {/* SYSTEM BROADCAST BANNER */}
      {clientData?.systemBanner && (
        <div className="bg-blue-600 border-b border-blue-800 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-center shadow-lg uppercase tracking-wider w-full relative z-30 animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 text-center">
            <Bell size={14} className="animate-pulse flex-shrink-0" />
            <span>{clientData.systemBanner}</span>
          </div>
        </div>
      )}

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} hasMyShiftAlert={hasMyShiftAlert} hasScheduleBuilderAlert={hasScheduleBuilderAlert} clientFeatures={clientFeatures} />
    
      {['schedule', 'published', 'month', 'sales', 'prep'].includes(activeTabState) && (
        <div className="py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center bg-[#1A2126] border-[#2A353D] relative">
          {activeTabState === 'sales' ? (
            <div className="w-full text-center">
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">Sales & Trends</h2>
            </div>
          ) : (
            <>
              <button onClick={activeTabState === 'prep' ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronLeft size={20} /></button>
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381] pointer-events-auto">
                  {activeTabState === 'prep' ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
                </h2>
              </div>

              <button onClick={activeTabState === 'prep' ? nextDay : nextMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronRight size={20} /></button>
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
{activeTabState === 'schedule' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule) && <TabSchedule currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} />}        {activeTabState === 'published' && <TabMasterSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} />}
{activeTabState === 'sales' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.sales) && <TabSales sales={sales} timePunches={timePunches} users={users} addToast={addToast} appUser={liveAppUser} />}        {activeTabState === 'messages' && <TabMessages events={events} appUser={liveAppUser} users={users} addToast={addToast} />}
{activeTabState === 'prep' && <TabPrep currentDate={currentDate} appUser={liveAppUser} setLabelsToPrint={setLabelsToPrint} />}
        {activeTabState === 'recipes' && <TabRecipes appUser={liveAppUser} addToast={addToast} />}
{activeTabState === 'inventory' && clientFeatures?.inventory !== false && <TabInventory addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'team' && clientFeatures?.team !== false && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'maintenance' && clientFeatures?.maintenance !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.team) && <TabMaintenance appUser={liveAppUser} addToast={addToast} />}
        {activeTabState === 'settings' && <TabSettings addToast={addToast} appUser={liveAppUser} clientData={clientData} users={users} />}
        {activeTabState === 'godmode' && <TabGodMode appUser={liveAppUser} addToast={addToast} setGhostTenant={setGhostTenant} />}
{activeTabState === 'audit' && (liveAppUser?.isAdmin || liveAppUser?.isSuperAdmin) && <TabAuditLog appUser={liveAppUser} />}      </main>
      <div className="fixed top-20 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-2 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#1A2126] text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex items-start gap-3 border border-[#2A353D] animate-toast">
            <div className="bg-[#12161A] p-1.5 rounded-full
 text-[#D4A381] mt-0.5 border border-[#2A353D]"><Bell size={16} /></div>
            <div className="flex-1"><h4 className="font-bold text-sm leading-tight">{t.title}</h4><p className="text-xs text-slate-300 font-medium mt-0.5">{t.message}</p></div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
      
<div className="w-full flex flex-col items-center justify-center py-4 border-t z-10 mt-auto bg-[#161D22] border-[#2A353D]">
        <img src="/6139.png" alt="86 Chaos OS" className="h-6 sm:h-8 w-auto mb-1.5 rounded shadow-sm opacity-80" onError={(e) => e.target.style.display = 'none'}/>
        <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Beta Version 9.5.0</span>
        <span className="text-slate-600 font-bold text-[8px] tracking-widest uppercase mt-1">© 2026 Chilton App Works</span>
      </div>
    </div>
  );
}

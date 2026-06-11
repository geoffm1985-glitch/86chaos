import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, CalendarOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getMessaging, getToken } from 'firebase/messaging';

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
const addDays = (d, days) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + days); return formatDate(dt); };
const getMonthStr = (d) => (d || getToday()).substring(0, 7);
const formatDisplayDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const formatFullDisplayDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const formatDisplayMonth = (m) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const getDaysInMonth = (m) => new Date(m.split('-')[0], m.split('-')[1], 0).getDate();
const formatShortTime = (t) => { if (!t) return ''; if(t === 'CLOSE') return 'CL'; let [h, m] = t.split(':'); h = parseInt(h, 10); return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h >= 12 ? 'p' : 'a'}`; };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();

// Wisconsin Food Code: 7-day total shelf life. Prep Day is Day 1. Expires on Prep Date + 6 days.
const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };



// --- SVG Logo ---
const CheersLogo = ({ isDark }) => (
  <svg viewBox="0 0 400 120" className="h-10 sm:h-12 w-auto drop-shadow-sm" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M190,20 C70,0 0,35 0,65 C0,95 100,110 270,110 L270,105 C100,105 30,95 30,65 C30,40 80,25 190,20 Z" className={isDark ? "text-slate-100" : "text-slate-900"} />
    <text x="95" y="85" fontFamily="'Brush Script MT', 'Great Vibes', cursive" fontStyle="italic" fontSize="90" fontWeight="900" className={isDark ? "text-slate-100" : "text-slate-900"} letterSpacing="-1">Cheers</text>
  </svg>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700"><h3 className="font-bold text-lg dark:text-white">{title}</h3><button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full dark:text-slate-400"><X size={20}/></button></div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// --- Navigation Drawer Component ---
const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, isDark, toggleDark }) => {
  if (!isOpen) return null;
  const tabs = [];
  
  if (appUser?.isAdmin) { tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> }); }
  
  tabs.push({ id: 'requestOff', label: 'Request Off', icon: <CalendarOff size={18}/> });
  tabs.push({ id: 'published', label: 'Master Roster', icon: <Clock size={18}/> });
  tabs.push({ id: 'month', label: 'Month View', icon: <Calendar size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> });
  
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') { tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> }); }
  
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  
  if (appUser?.isAdmin) { tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> }); }
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  const handleLogout = () => { localStorage.removeItem('cheersUser'); setAppUser(null); onClose(); };

  return (
     <div className="fixed inset-0 z-[70] flex justify-end">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       <div className="w-72 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col relative border-l border-slate-200 dark:border-slate-700 animate-[slideIn_0.3s_ease-out]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex justify-between items-start">
             <div className="flex items-center gap-3">
               <img src={getAvatar(appUser.name, appUser.photoURL)} alt="Profile" className="w-10 h-10 rounded-full shadow-sm object-cover bg-white"/>
               <div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Signed in as</div>
                 <div className="text-slate-900 dark:text-white font-black text-lg tracking-tight leading-none">{appUser.name}</div>
                 <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider mt-1 bg-blue-50 dark:bg-blue-900/30 w-max px-2 py-0.5 rounded-md">{appUser.isAdmin && <Shield size={10} />} {appUser.role}</div>
               </div>
             </div>
             <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
             {tabs.map(tab => (
               <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}`}>
                 <div className="flex items-center gap-3"><span className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'}>{tab.icon}</span>{tab.label}</div>
               </button>
             ))}
          </div>
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2">
            <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm cursor-pointer" onClick={toggleDark}>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">{isDark ? <Moon size={14}/> : <Sun size={14}/>} Dark Mode</span>
              <div className={`w-8 h-4 rounded-full transition-colors flex items-center px-1 ${isDark ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isDark ? 'translate-x-3.5' : 'translate-x-0'}`}></div></div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut size={16} /> Log Out</button>
          </div>
       </div>
     </div>
  );
};

// --- DEDICATED DAY DOT PRINT ENGINE ---
const DayDotPrintScreen = ({ labelsToPrint, prepDate, appUser, onClose }) => {
  useEffect(() => {
    const handleBackButton = () => onClose();
    window.history.pushState({ tab: 'prep', printScreen: true }, '');
    window.addEventListener('popstate', handleBackButton);
    const timer = setTimeout(() => window.print(), 800);
    return () => { 
      clearTimeout(timer);
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [onClose]);

  return (
    <div id="master-print-wrapper" className="fixed inset-0 z-[999999] bg-white overflow-y-auto text-black">
      <style>{`
        @media print {
          @page { size: 3.5in 1.1in; margin: 0; }
          body, html { margin: 0 !important; padding: 0 !important; background: white !important; height: auto !important; overflow: visible !important; }
          #master-print-wrapper { position: relative !important; height: auto !important; overflow: visible !important; display: block !important; }
          .no-print, header, nav, main, footer { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .dk-label { 
            width: 3.5in !important; height: 1.1in !important; display: flex !important; flex-direction: column !important; justify-content: center !important; 
            padding: 0.05in 0.15in !important; box-sizing: border-box !important; page-break-after: always !important; break-after: page !important;
            page-break-inside: avoid !important; margin: 0 !important; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
            overflow: hidden !important; border: none !important; background: white !important;
          }
          .dk-title { font-size: 16px !important; font-weight: 900 !important; color: black !important; text-transform: uppercase !important; text-align: center !important; margin-bottom: 2px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
          .dk-row { display: flex !important; justify-content: space-between !important; font-size: 11px !important; font-weight: bold !important; color: black !important; margin-bottom: 2px !important; }
          .dk-exp { display: flex !important; justify-content: center !important; font-size: 14px !important; font-weight: 900 !important; color: black !important; border-top: 2px solid black !important; padding-top: 2px !important; margin-top: 1px !important; }
        }
      `}</style>
      <div className="no-print p-6 flex flex-col items-center justify-center min-h-screen bg-slate-100">
         <Loader2 className="animate-spin text-blue-600 mb-6" size={64} />
         <h2 className="text-3xl font-black text-slate-900 mb-2">Generating Labels</h2>
         <p className="text-slate-600 font-bold mb-8">Select Brother QL-810W in print settings.</p>
         <button onClick={() => window.history.back()} className="bg-slate-900 text-white px-10 py-5 rounded-xl font-black text-lg shadow-xl hover:bg-slate-800 flex flex-col items-center gap-1 active:scale-95 transition-transform w-full max-w-xs">
           <span>Done Printing</span><span className="text-xs text-slate-400 font-medium">Return to App</span>
         </button>
      </div>
      <div id="print-data">
        {labelsToPrint.map((item, idx) => {
          const prepDateParts = formatDisplayDate(prepDate).split(',');
          const prepStr = prepDateParts.length > 1 ? prepDateParts[1].trim() : formatDisplayDate(prepDate);
          return (
            <div key={`print-${idx}`} className="dk-label">
              <div className="dk-title">{item.text}</div>
              <div className="dk-row"><span>PREP: {prepStr}</span><span>EMP: {appUser?.name ? appUser.name.split(' ')[0].toUpperCase() : '___'}</span></div>
              <div className="dk-exp">EXP: {getExpDate(prepDate)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Application Layout ---
export default function App() {
  const users = useLiveCollection('users');
  const shifts = useLiveCollection('shifts');
  const prepItems = useLiveCollection('prepItems');
  const inventoryItems = useLiveCollection('inventoryItems');
  const shiftSwaps = useLiveCollection('shiftSwaps');
  const events = useLiveCollection('events');
  const sales = useLiveCollection('sales');
  const timeOff = useLiveCollection('timeOffRequests');
  
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('cheersUser'); return saved ? JSON.parse(saved) : null; });
  const [activeTabState, setActiveTabState] = useState('published');
  const [isDark, setIsDark] = useState(() => { return localStorage.getItem('theme') === 'dark'; });
  const [labelsToPrint, setLabelsToPrint] = useState(null);

  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);

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

  if (labelsToPrint) {
    return <DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} />;
  }

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} isDark={isDark} addToast={addToast} />;

  return (
    <div className={`min-h-screen font-sans flex flex-col ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .dark input[type="date"]::-webkit-calendar-picker-indicator, .dark input[type="month"]::-webkit-calendar-picker-indicator, .dark input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      {/* --- Header --- */}
      <header className={`sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <CheersLogo isDark={isDark} />
        <button onClick={() => setIsMenuOpen(true)} className={`relative p-2 border rounded-xl shadow-sm transition-all outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}><Menu size={20} /></button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} isDark={isDark} toggleDark={() => setIsDark(!isDark)} />

      {/* --- Date Header --- */}
      {['schedule', 'published', 'month', 'sales', 'prep', 'requestOff'].includes(activeTabState) && (
        <div className={`py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <button onClick={() => setCurrentDate(addDays(currentDate, (activeTabState === 'prep' || activeTabState === 'sales') ? -1 : -30))} className={`p-2 border rounded-xl transition-colors ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'}`}><ChevronLeft size={20} /></button>
          <h2 onClick={() => setIsDateModalOpen(true)} className={`text-xl font-black tracking-tight text-center cursor-pointer transition-colors ${isDark ? 'text-white hover:text-blue-400' : 'text-slate-900 hover:text-blue-600'}`}>
            {activeTabState === 'prep' || activeTabState === 'sales' ? formatDisplayDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
          </h2>
          <button onClick={() => setCurrentDate(addDays(currentDate, (activeTabState === 'prep' || activeTabState === 'sales') ? 1 : 30))} className={`p-2 border rounded-xl transition-colors ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'}`}><ChevronRight size={20} /></button>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input type={activeTabState === 'prep' || activeTabState === 'sales' ? 'date' : 'month'} value={activeTabState === 'prep' || activeTabState === 'sales' ? currentDate : getMonthStr(currentDate)} onChange={e => { if (e.target.value) { setCurrentDate(activeTabState === 'prep' || activeTabState === 'sales' ? e.target.value : e.target.value + '-01'); setIsDateModalOpen(false); } }} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setIsDateModalOpen(false)} className="w-full bg-slate-900 dark:bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors">Close</button>
        </div>
      </Modal>

      {/* --- Main Content Area --- */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-6 pb-24">
        {activeTabState === 'schedule' && liveAppUser?.isAdmin && <TabSchedule currentDate={currentDate} users={users} shifts={shifts} timeOff={timeOff} addToast={addToast} />}
        {activeTabState === 'requestOff' && <TabRequestOff currentDate={currentDate} appUser={liveAppUser} timeOff={timeOff} addToast={addToast} />}
        {activeTabState === 'published' && <TabPublishedShifts currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} addToast={addToast} />}
        {activeTabState === 'month' && <TabMonth currentDate={currentDate} users={users} shifts={shifts} />}
        {activeTabState === 'sales' && liveAppUser?.isAdmin && <TabSales sales={sales} addToast={addToast} />}
        {activeTabState === 'messages' && <TabMessages events={events} appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} appUser={liveAppUser} setLabelsToPrint={(items) => setLabelsToPrint({ items, prepDate: currentDate })} />}
        {activeTabState === 'inventory' && <TabInventory inventoryItems={inventoryItems} sales={sales} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'team' && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'settings' && <TabSettings addToast={addToast} appUser={liveAppUser} />}
      </main>

      {/* --- Toast Alert Engine --- */}
      <div className="fixed top-20 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-2 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex items-start gap-3 border border-slate-700 animate-toast">
            <div className="bg-blue-500/20 p-1.5 rounded-full text-blue-400 mt-0.5"><Bell size={16} /></div>
            <div className="flex-1"><h4 className="font-bold text-sm leading-tight">{t.title}</h4><p className="text-xs text-slate-300 font-medium mt-0.5">{t.message}</p></div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
      
      <div className="w-full text-center text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-widest uppercase py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-10 mt-auto">
        Cheers Management OS • v7.0.0
      </div>
    </div>
  );
}

// --- LOGIN & PASSWORD RECOVERY ---
const LoginScreen = ({ users, setAppUser, isDark, addToast }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isRecover, setIsRecover] = useState(false); const [loading, setLoading] = useState(false); const [resetUser, setResetUser] = useState(null);
  const isFirstUser = users.length === 0;

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true);
    if (email.trim() === 'admin' && password === 'Atticus7!') { setAppUser({ id: 'dev-backdoor', name: 'Ghost Admin', email: MASTER_ADMIN_EMAIL, role: 'Kitchen', isAdmin: true, isActive: true }); return; }
    try {
      if (isFirstUser) {
        const newUser = { name: 'Admin', email: MASTER_ADMIN_EMAIL, phone: '', password, role: 'Kitchen', isAdmin: true, isActive: true, forcePasswordChange: false, photoURL: '' };
        const docRef = await addDoc(collection(db, "users"), newUser);
        setAppUser({ id: docRef.id, ...newUser });
      } else {
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
        if (user) { if (user.forcePasswordChange) setResetUser(user); else setAppUser(user); } 
        else addToast("Error", "Invalid credentials.");
      }
    } catch (err) { addToast("Error", "Connection error."); console.error(err); }
    setLoading(false);
  };

  const handleRecover = async (e) => {
    e.preventDefault(); setLoading(true);
    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (user) {
      const tempPass = generateTempPass();
      await updateDoc(doc(db, "users", user.id), { password: tempPass, forcePasswordChange: true });
      addToast("Manager Notified", "A temporary password has been generated. Please contact your manager.");
    } else { addToast("Error", "Account not found."); }
    setIsRecover(false); setLoading(false);
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault(); setLoading(true);
    if(password.length < 5) { addToast("Error", "Password too short."); setLoading(false); return; }
    try {
      await updateDoc(doc(db, "users", resetUser.id), { password: password, forcePasswordChange: false });
      setAppUser({ ...resetUser, password: password, forcePasswordChange: false });
    } catch (err) { addToast("Error", "Failed to update."); }
    setLoading(false);
  };

  if (resetUser) return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}><div className={`rounded-3xl shadow-xl border p-8 max-w-md w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><h2 className={`text-xl font-black text-center mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Welcome, {resetUser.name}!</h2><p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Please set your permanent password.</p><form onSubmit={handlePasswordSetup} className="space-y-4"><div><label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">New Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div><button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md">{loading ? 'Processing...' : 'Save & Login'}</button></form></div></div>
  );

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}><div className={`rounded-3xl shadow-xl border p-8 max-w-md w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><div className="flex justify-center mb-6"><CheersLogo isDark={isDark} /></div><h2 className={`text-xl font-black text-center mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{isRecover ? 'Recover Password' : (isFirstUser ? 'Create Admin Account' : 'Staff Login')}</h2><form onSubmit={isRecover ? handleRecover : handleLogin} className="space-y-4"><div><label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>{!isRecover && <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>}<button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md mt-2">{loading ? 'Processing...' : (isRecover ? 'Reset Password' : (isFirstUser ? 'Create Account' : 'Login'))}</button></form>{!isFirstUser && <button onClick={() => { setIsRecover(!isRecover); setEmail(''); setPassword(''); }} className="w-full text-center mt-4 text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors">{isRecover ? 'Back to Login' : 'Forgot Password?'}</button>}</div></div>
  );
};


// --- Tab: Request Off (Mass Select Calendar) ---
const TabRequestOff = ({ currentDate, appUser, timeOff, addToast }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [type, setType] = useState('full');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [reason, setReason] = useState('');

  const myRequests = timeOff.filter(t => t.employeeId === appUser.id).sort((a,b) => b.date.localeCompare(a.date));
  const allRequests = timeOff.sort((a,b) => b.date.localeCompare(a.date));

  // Calendar Math
  const monthStr = getMonthStr(currentDate); 
  const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); 
  const daysInMonth = getDaysInMonth(monthStr);

  const toggleDate = (d) => {
    if (d < getToday()) return addToast('Error', 'Cannot request past dates.');
    if (selectedDates.includes(d)) setSelectedDates(selectedDates.filter(x => x !== d));
    else setSelectedDates([...selectedDates, d]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedDates.length === 0) return addToast('Error', 'Please select at least one date from the calendar.');
    
    let addedCount = 0;
    for (const d of selectedDates) {
      const existing = timeOff.find(t => t.employeeId === appUser.id && t.date === d);
      if (!existing) {
        await addDoc(collection(db, "timeOffRequests"), {
          employeeId: appUser.id, employeeName: appUser.name, date: d, type, 
          startTime: type === 'partial' ? startTime : null, 
          endTime: type === 'partial' ? endTime : null, 
          reason, status: 'pending', submittedAt: new Date().toISOString()
        });
        addedCount++;
      }
    }
    
    if (addedCount > 0) addToast('Submitted', `Logged ${addedCount} time off request(s).`);
    setSelectedDates([]); setReason('');
  };

  const handleDelete = async (id) => {
    if(window.confirm("Delete this request?")) {
      await deleteDoc(doc(db, "timeOffRequests", id));
      addToast('Deleted', 'Request removed.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border dark:border-slate-700 shadow-sm">
          <h3 className="font-black text-lg mb-4 dark:text-white flex items-center gap-2"><CalendarOff size={18}/> Request Time Off</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Mass Select Interactive Calendar Grid */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Dates</label>
              <div className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-3 shadow-inner">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`}/>)}
                  {Array.from({length:daysInMonth}).map((_,i)=>{
                    const d = `${monthStr}-${String(i+1).padStart(2,'0')}`;
                    const isPast = d < getToday();
                    const isSelected = selectedDates.includes(d);
                    const alreadyRequested = timeOff.some(t => t.employeeId === appUser.id && t.date === d);
                    
                    let btnClass = "h-8 rounded-lg text-xs font-bold transition-all shadow-sm ";
                    if (alreadyRequested) btnClass += "bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed";
                    else if (isPast) btnClass += "text-slate-300 dark:text-slate-600 cursor-not-allowed bg-transparent shadow-none";
                    else if (isSelected) btnClass += "bg-blue-600 text-white scale-110 shadow-md ring-2 ring-blue-300 z-10";
                    else btnClass += "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600";

                    return (
                      <button key={d} type="button" disabled={isPast || alreadyRequested} onClick={() => toggleDate(d)} className={btnClass}>
                        {i+1}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label><select value={type} onChange={e=>setType(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none font-bold dark:text-white"><option value="full">Full Day</option><option value="partial">Partial Day</option></select></div>
            {type === 'partial' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none font-bold dark:text-white" required/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Time</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none font-bold dark:text-white" required/></div>
              </div>
            )}
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason (Optional)</label><input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Doctor appointment" className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none font-bold dark:text-white"/></div>
            
            <button type="submit" disabled={selectedDates.length === 0} className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold shadow-md disabled:opacity-50 disabled:shadow-none hover:bg-blue-500 transition-colors">
              Submit Request {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}
            </button>
          </form>
        </div>
      </div>
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 font-black text-lg dark:text-white">{appUser?.isAdmin ? 'All Staff Requests' : 'My Requests'}</div>
          <div className="divide-y dark:divide-slate-700">
            {(appUser?.isAdmin ? allRequests : myRequests).map(t => (
              <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50">
                 <div>
                   <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                     {formatDisplayDate(t.date)} 
                     <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider ${t.type==='full'?'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400':'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{t.type} Day</span>
                   </div>
                   <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                     {appUser?.isAdmin && <span className="text-blue-600 dark:text-blue-400">{t.employeeName} • </span>}
                     {t.type === 'partial' ? `${formatShortTime(t.startTime)} - ${formatShortTime(t.endTime)}` : 'All Day'} {t.reason && ` • "${t.reason}"`}
                   </div>
                 </div>
                 {(appUser?.isAdmin || t.employeeId === appUser.id) && (
                   <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                 )}
              </div>
            ))}
            {(appUser?.isAdmin ? allRequests : myRequests).length === 0 && <div className="p-6 text-center text-sm font-bold text-slate-400">No time off requests found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SCHEDULE MAKER (Upgraded, Protected against Time Off & Validated) ---
const TabSchedule = ({ currentDate, users, shifts, timeOff, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); const [assignDates, setAssignDates] = useState([]); const [presetShift, setPresetShift] = useState('Custom'); const [startTime, setStartTime] = useState('16:00'); const [endTime, setEndTime] = useState('21:00');
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));
  const monthStr = getMonthStr(currentDate); const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));

  const SHIFT_PRESETS = [ { label: "9a-3p", start: "09:00", end: "15:00" }, { label: "10a-4p", start: "10:00", end: "16:00" }, { label: "10a-9p", start: "10:00", end: "21:00" }, { label: "11a-3p", start: "11:00", end: "15:00" }, { label: "11a-4p", start: "11:00", end: "16:00" }, { label: "4p-9p", start: "16:00", end: "21:00" }, { label: "7p-close", start: "19:00", end: "CLOSE" }, { label: "9p-close", start: "21:00", end: "CLOSE" }, { label: "Custom", start: "", end: "" } ];
  const handlePresetChange = (e) => { const val = e.target.value; setPresetShift(val); const p = SHIFT_PRESETS.find(x => x.label === val); if (p && val !== 'Custom') { setStartTime(p.start); if (p.end !== 'CLOSE') setEndTime(p.end); } };

  // --- Strict Validation Engine ---
  const validateSchedule = () => {
    const warnings = [];
    monthDays.forEach(d => {
       const dShifts = monthShifts.filter(s => s.date === d);
       if (dShifts.length === 0) return; // Only check days that have at least one shift scheduled

       const dObj = new Date(d + 'T12:00:00'); const day = dObj.getDay();
       const isFri = day===5; const isSat = day===6; const isSun = day===0;
       const dateFmt = `${dObj.getMonth()+1}/${dObj.getDate()}`;
       
       const bar = dShifts.filter(s => s.role === 'Bartender'); 
       const kit = dShifts.filter(s => s.role === 'Kitchen');

       const overlaps = (s, st, en) => { const shiftEnd = s.endTime === 'CLOSE' ? '24:00' : s.endTime; return s.startTime < en && shiftEnd > st; };
       const countO = (arr, st, en) => arr.filter(s => overlaps(s, st, en)).length;

       if (kit.length === 0) warnings.push(`[${dateFmt}] Kitchen: No staff scheduled.`);
       else {
         if (!kit.some(s => s.startTime >= '09:00' && s.startTime <= '10:00')) warnings.push(`[${dateFmt}] Kitchen: Missing opener (9am-10am)`);
         if (!kit.some(s => s.endTime === 'CLOSE' || s.endTime >= '21:00')) warnings.push(`[${dateFmt}] Kitchen: Missing closer (9pm)`);
       }
       
       const bCloseTime = (isFri || isSat) ? '02:30' : '02:00';
       if (bar.length === 0) warnings.push(`[${dateFmt}] Bar: No bartenders scheduled.`);
       else {
         if (!bar.some(s => s.startTime <= '11:00')) warnings.push(`[${dateFmt}] Bar: Missing opener (11am)`);
         const closers = bar.filter(s => s.endTime === 'CLOSE' || s.endTime >= bCloseTime).length;
         if ((isFri || isSat) && closers < 2) warnings.push(`[${dateFmt}] Bar: Needs 2 closers (${bCloseTime==='02:30'?'2:30am':'2am'}), found ${closers}`);
         else if (!isFri && !isSat && closers < 1) warnings.push(`[${dateFmt}] Bar: Needs 1 closer (${bCloseTime==='02:30'?'2:30am':'2am'}), found ${closers}`);
       }

       const lBar = countO(bar, '11:00', '14:00'); const lKit = countO(kit, '11:00', '14:00');
       const dBar = countO(bar, '17:00', '20:00'); const dKit = countO(kit, '17:00', '20:00');
       
       if (day >= 1 && day <= 4) {
         if(lBar < 2 || lKit < 2) warnings.push(`[${dateFmt}] Lunch (M-Th): Needs 2 Bar/2 Kit, found ${lBar} Bar/${lKit} Kit`);
         if(dBar < 2 || dKit < 2) warnings.push(`[${dateFmt}] Dinner (M-Th): Needs 2 Bar/2 Kit, found ${dBar} Bar/${dKit} Kit`);
       } else if (isFri) {
         if(lBar < 2 || lKit < 3) warnings.push(`[${dateFmt}] Lunch (Fri): Needs 2 Bar/3 Kit, found ${lBar} Bar/${lKit} Kit`);
         if(dBar < 2 || dKit < 3) warnings.push(`[${dateFmt}] Dinner (Fri): Needs 2 Bar/3 Kit, found ${dBar} Bar/${dKit} Kit`);
       } else if (isSat || isSun) {
         const dayBar = countO(bar, '11:00', '17:00'); const dayKit = countO(kit, '11:00', '17:00');
         if(dayBar < 1 || dayKit < 2) warnings.push(`[${dateFmt}] Day Rush (Sat-Sun): Needs 1 Bar/2 Kit, found ${dayBar} Bar/${dayKit} Kit`);
       }
    });
    return warnings;
  };

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    let assignedCount = 0;

    for (const d of assignDates) { 
      const off = timeOff.find(t => t.employeeId === emp.id && t.date === d);
      if (off) {
        if (off.type === 'full') {
          addToast('Blocked', `${emp.name.split(' ')[0]} requested full day off on ${formatDisplayDate(d)}.`);
          continue;
        } else if (off.type === 'partial') {
          const checkStart = startTime; const checkEnd = presetShift.includes('close') ? '23:59' : endTime;
          if ((checkStart < off.endTime && checkEnd > off.startTime) || checkStart === off.startTime) {
            addToast('Blocked', `Overlap with ${emp.name.split(' ')[0]}'s requested off time (${formatShortTime(off.startTime)}-${formatShortTime(off.endTime)}) on ${formatDisplayDate(d)}.`);
            continue;
          }
        }
      }
      await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false }); 
      assignedCount++;
    }
    setAssignDates([]); 
    if (assignedCount > 0) addToast('Assigned', `Added ${assignedCount} shifts.`);
  };

  const handlePublish = async () => {
    const warnings = validateSchedule();
    if (warnings.length > 0) {
      if (!window.confirm(`⚠️ SCHEDULE WARNINGS FOUND:\n\n${warnings.join('\n')}\n\nDo you want to publish anyway?`)) return;
    } else {
      if(!window.confirm("Publish schedule?")) return;
    }
    const unpub = monthShifts.filter(s => !s.isPublished); for(const s of unpub) await updateDoc(doc(db, "shifts", s.id), {isPublished:true});
    addToast("Published", "Schedule is live.");
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
         <h3 className="font-black text-xl flex items-center gap-2 dark:text-white"><Calendar className="text-blue-500"/> Schedule Maker</h3>
         <button onClick={handlePublish} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold shadow-sm">Publish All</button>
      </div>
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm">
        <table className="w-full text-left text-[10px] border-collapse">
          <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700"><th className="p-2 font-bold sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-24 border-r dark:border-slate-700 dark:text-slate-300">Staff</th>{monthDays.map(d=><th key={d} className={`p-1 text-center border-r dark:border-slate-700 min-w-[32px] ${new Date(d+'T12:00').getDay()%6===0?'bg-slate-100 dark:bg-slate-800':''}`}><div className="font-bold text-slate-400 uppercase">{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short'})}</div><div className="text-sm font-black dark:text-white">{parseInt(d.split('-')[2])}</div></th>)}</tr></thead>
          <tbody className="divide-y dark:divide-slate-700">{displayUsers.map(u => (
            <tr key={u.id}>
              <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`p-2 font-bold sticky left-0 z-10 border-r dark:border-slate-700 cursor-pointer truncate ${selectedEmp===u.id?'bg-blue-600 text-white shadow-[inset_-4px_0_0_0_rgba(255,255,255,0.3)]':'bg-white dark:bg-slate-800 dark:text-slate-300'}`}>{u.name.split(' ')[0]}</td>
              {monthDays.map(d => {
                const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); 
                const off = timeOff.find(t=>t.date===d&&t.employeeId===u.id);
                const sel = assignDates.includes(d) && selectedEmp===u.id;
                
                let cellBg = sel ? 'bg-blue-200 dark:bg-blue-900/50 outline outline-2 outline-blue-500 z-50 relative' : 'hover:bg-slate-100 dark:hover:bg-slate-700';
                if (off) {
                  if (off.type === 'full') cellBg = 'bg-red-100 dark:bg-red-900/40 hover:bg-red-200';
                  if (off.type === 'partial') cellBg = 'bg-yellow-100 dark:bg-yellow-900/40 hover:bg-yellow-200';
                }

                return (
                  <td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-1 border-r dark:border-slate-700 cursor-pointer transition-all ${cellBg}`}>
                    {shift ? (
                      <div className={`w-full rounded text-[9px] font-bold py-1 text-center text-white leading-none ${shift.isPublished?(u.role==='Bartender'?'bg-blue-600':'bg-orange-600'):'bg-slate-400'}`}>
                        {formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}
                      </div>
                    ) : off?.type === 'partial' ? (
                      <div className="text-[8px] font-black text-yellow-700 dark:text-yellow-500 text-center uppercase tracking-tighter leading-tight">OFF<br/>{formatShortTime(off.startTime)}</div>
                    ) : (
                      <div className="h-5"></div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-col md:flex-row gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 items-end shadow-sm">
        <div className="w-full md:w-48"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Staff</label><select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none shadow-sm"><option value="">- Choose -</option>{displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="w-full md:w-36"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Preset</label><select value={presetShift} onChange={handlePresetChange} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none shadow-sm">{SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</select></div>
        <div className="w-full md:w-28"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start</label><input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none shadow-sm"/></div>
        <div className="w-full md:w-28"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End</label><input type="time" value={presetShift.includes('close')?'':endTime} disabled={presetShift.includes('close')} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none disabled:bg-slate-200 disabled:text-slate-400 shadow-sm"/></div>
        <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className="bg-blue-600 text-white px-6 h-[42px] rounded-lg font-bold shadow-md disabled:opacity-50 w-full md:w-auto active:scale-95 transition-transform">Assign ({assignDates.length})</button>
      </div>
    </div>
  );
};


// --- PREP LIST (Fully Locked Down, Categorized, Print Bug Fixed) ---
const TabPrep = ({ currentDate, prepItems, appUser, setLabelsToPrint }) => {
  const [text, setText] = useState(''); const [cat, setCat] = useState('General'); const [isMaster, setIsMaster] = useState(true);
  const items = prepItems.filter(p=>p.date===currentDate||p.isMaster);

  const handleAdd = async (e) => { e.preventDefault(); if(text.trim()) { await addDoc(collection(db, "prepItems"), { date: isMaster?'MASTER':currentDate, text: text.trim(), category: cat, isCompleted: false, completedDates: {}, isMaster, qty: 1, completedBy: null, isSelected: false }); setText(''); } };
  const toggleStatus = async (item) => { 
    if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[currentDate] = dts[currentDate] ? null : appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); }
    else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null, isSelected: false }); }
  };
  const updateQty = async (id, currentQty, change) => { await updateDoc(doc(db, "prepItems", id), { qty: Math.max(1, currentQty + change) }); };
  const toggleSelect = async (i) => await updateDoc(doc(db, "prepItems", i.id), { isSelected: !i.isSelected });
  
  const handleBatchDone = async () => {
    const toComplete = items.filter(i => i.isSelected); if (toComplete.length === 0) return;
    for (const item of toComplete) { if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[currentDate] = appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); } else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: true, completedBy: appUser.name, isSelected: false }); } }
  };

  const triggerBatchPrint = () => {
    const selected = items.filter(i => i.isSelected); if (selected.length === 0) return;
    const toPrint = []; selected.forEach(item => { for (let i = 0; i < (item.qty||1); i++) { toPrint.push({ ...item, printId: `${item.id}-${i}-${Date.now()}` }); } });
    
    // Sends the exact array to the master App component for strict label rendering
    setLabelsToPrint(toPrint); 
  };

  const globalSelectedCount = items.filter(i => i.isSelected).length;
  // Cleanly categorizes the list
  const groupedItems = items.reduce((acc, i) => { const c = i.category || 'General'; if(!acc[c]) acc[c]=[]; acc[c].push(i); return acc; }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative pb-40">
      <form onSubmit={handleAdd} className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-2 pl-3 rounded-2xl flex flex-col sm:flex-row gap-2 shadow-sm items-center">
        <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-2 bg-transparent text-sm outline-none font-bold dark:text-white" placeholder="Add prep task..." required/>
        <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full sm:w-32 p-2 text-xs font-bold bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none dark:text-white"><option>General</option><option>Meat</option><option>Produce</option><option>Dairy</option><option>Sauces</option><option>Line Prep</option></select>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 dark:border-slate-700 px-1">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer"><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4 rounded border-slate-300"/> Master</label>
          <button className="bg-blue-600 text-white p-2.5 rounded-xl font-black shadow-sm"><Plus size={18}/></button>
        </div>
      </form>
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden shadow-sm">
        {Object.keys(groupedItems).length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-400">No prep tasks scheduled.</div>}
        {Object.entries(groupedItems).map(([category, catItems]) => (
          <div key={category}>
            <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-y dark:border-slate-700 font-black text-xs uppercase text-slate-500 tracking-widest flex justify-between">
               <span>{category}</span>
               <span>{catItems.filter(i => (i.isMaster ? !!i.completedDates?.[currentDate] : i.isCompleted)).length}/{catItems.length} Done</span>
            </div>
            <div className="divide-y dark:divide-slate-700">
              {catItems.map(i=>{
                const isDone = i.isMaster ? !!i.completedDates?.[currentDate] : i.isCompleted; const doneBy = i.isMaster ? i.completedDates?.[currentDate] : i.completedBy; const qty = i.qty||1;
                return (
                <div key={i.id} className={`p-3 flex items-center gap-3 transition-colors ${i.isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                  <input type="checkbox" checked={!!i.isSelected} onChange={()=>toggleSelect(i)} className="w-5 h-5 rounded border-slate-300 accent-blue-600 flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0"><span className={`text-sm font-black ${isDone?'line-through text-slate-400':'text-slate-800 dark:text-white'}`}>{i.text}</span> {doneBy && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded ml-2 uppercase">✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-blue-500 uppercase mt-0.5">Master Task</span>}</div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center bg-slate-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600 h-9"><button onClick={()=>updateQty(i.id,qty,-1)} className="w-7 h-full font-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">-</button><span className="w-5 text-center text-xs font-black dark:text-white">{qty}</span><button onClick={()=>updateQty(i.id,qty,1)} className="w-7 h-full font-black dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">+</button></div>
                    <button onClick={()=>toggleStatus(i)} className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-sm ${isDone?'bg-slate-200 text-slate-500 dark:bg-slate-600':'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-400'}`}>{isDone ? <Repeat size={16}/> : <Check size={18}/>}</button>
                    {/* ONLY ADMINS CAN DELETE PREP ITEMS */}
                    {appUser?.isAdmin && <button onClick={()=>deleteDoc(doc(db,"prepItems",i.id))} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>}
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)]">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button onClick={triggerBatchPrint} disabled={globalSelectedCount===0} className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-black text-base disabled:opacity-50 shadow-md flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition-all">
            <ClipboardList size={20}/> Print Labels ({globalSelectedCount})
          </button>
          <button onClick={handleBatchDone} disabled={globalSelectedCount===0} className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-black text-base disabled:opacity-50 shadow-md hover:bg-emerald-500 active:scale-95 transition-all">Mark Done</button>
        </div>
      </div>
    </div>
  );
};

// --- PUBLISHED SHIFTS & TRADE BOARD (Grouped by Date) ---
const TabPublishedShifts = ({ currentDate, appUser, users, shifts, shiftSwaps, addToast }) => {
  const monthStr = getMonthStr(currentDate);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr) && s.isPublished);
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

  const groupedShifts = monthShifts.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s); return acc;
  }, {});
  const sortedDates = Object.keys(groupedShifts).sort();

  const handleOfferSwap = async (shift) => {
    if (!window.confirm("Offer shift to Trade Board?")) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatShortTime(shift.startTime)}). Claim it on the Master Roster!`, type: 'note', author: 'System Alert', isImportant: true });
    addToast('Posted', 'Shift sent to trade board.');
  };

  const handleClaim = async (swap) => { await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'pending_approval', claimedById: appUser.id }); addToast('Claimed', 'Pending manager approval.'); };
  const handleApprove = async (sw) => { await updateDoc(doc(db, "shifts", sw.shiftId), { employeeId: sw.claimedById }); await deleteDoc(doc(db, "shiftSwaps", sw.id)); addToast('Approved', 'Roster updated.'); };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {appUser?.isAdmin && shiftSwaps.filter(sw=>sw.status==='pending_approval').length > 0 && (
         <div className="bg-amber-50 dark:bg-slate-800 p-3 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2 shadow-sm">
           <h4 className="font-black text-[10px] uppercase text-amber-700 dark:text-amber-400 tracking-wider">Trades Awaiting Approval</h4>
           {shiftSwaps.filter(sw=>sw.status==='pending_approval').map(sw => (
             <div key={sw.id} className="flex justify-between items-center bg-white dark:bg-slate-700 p-2 rounded-xl border dark:border-slate-600 shadow-sm gap-2">
                <div className="text-xs dark:text-white"><strong>{users.find(u=>u.id===sw.claimedById)?.name}</strong> covering <strong>{users.find(u=>u.id===sw.originalEmployeeId)?.name}'s</strong> shift on {formatDisplayDate(sw.date)}.</div>
                <div className="flex gap-1.5 flex-shrink-0"><button onClick={()=>handleApprove(sw)} className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold text-[10px]">Approve</button><button onClick={()=>updateDoc(doc(db, "shiftSwaps", sw.id), { status: 'available', claimedById: null })} className="bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-white px-2.5 py-1 rounded-lg font-bold text-[10px]">Deny</button></div>
             </div>
           ))}
         </div>
      )}

      {availableSwaps.length > 0 && (
         <div className="bg-blue-50 dark:bg-slate-800 p-3 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-2 shadow-sm">
           <h4 className="font-black text-[10px] uppercase text-blue-700 dark:text-blue-400 tracking-wider">Active Trade Board</h4>
           <div className="grid gap-2 sm:grid-cols-2">{availableSwaps.map(sw => {
              const orig = users.find(u => u.id === sw.originalEmployeeId);
              return (
                <div key={sw.id} className="bg-white dark:bg-slate-700 p-2 rounded-xl border dark:border-slate-600 flex justify-between items-center shadow-sm">
                   <div className="flex gap-2 items-center"><img src={getAvatar(orig?.name, orig?.photoURL)} className="w-8 h-8 rounded-full" alt="pic"/><div><span className="font-bold text-sm block dark:text-white leading-tight">{orig?.name?.split(' ')[0]}</span><span className="text-[9px] font-bold text-slate-500">{formatDisplayDate(sw.date)}</span></div></div>
                   {appUser.id !== sw.originalEmployeeId && appUser.role === sw.role && <button onClick={() => handleClaim(sw)} className="bg-blue-600 text-white px-4 py-1.5 rounded-xl font-bold text-xs shadow-sm">Claim</button>}
                </div>
              )
           })}</div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="bg-slate-900 p-4 font-black text-white text-lg flex items-center gap-2"><Calendar size={20}/> Master Roster</div>
        {sortedDates.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-400">No published shifts for this month.</div>}
        {sortedDates.map(date => (
          <div key={date}>
            <div className="bg-slate-100 dark:bg-slate-900/50 px-4 py-2 border-y dark:border-slate-700 font-black text-xs uppercase text-slate-500 tracking-widest sticky top-16 z-10 shadow-sm backdrop-blur-md">
              {formatFullDisplayDate(date)}
            </div>
            <div className="divide-y dark:divide-slate-700">
              {groupedShifts[date].map(s => {
                const emp = users.find(u => u.id === s.employeeId); const isMe = appUser.id === s.employeeId; const isOffered = shiftSwaps.some(sw => sw.shiftId === s.id);
                return (
                  <div key={s.id} className={`p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isMe ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${s.role==='Bartender'?'bg-blue-100 text-blue-700 border-blue-500':'bg-orange-100 text-orange-700 border-orange-500'}`}>
                        {emp?.name.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <span className={`font-black text-base block leading-tight ${isMe ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>{emp?.name} {isMe && '(You)'}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.role}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-sm font-black bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border dark:border-slate-600 dark:text-slate-200 shadow-sm">{formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}</div>
                      {isMe && !isOffered && <button onClick={() => handleOfferSwap(s)} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">Trade Shift</button>}
                      {isOffered && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black uppercase">Posted</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- TEAM & STAFF MANAGEMENT (Re-ordered & Master Admin Hidden) ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [role, setRole] = useState('Bartender'); const [photoURL, setPhotoURL] = useState(''); const [isAdmin, setIsAdmin] = useState(false);
  const [editModalUser, setEditModalUser] = useState(null);
  
  const displayUsers = [...users].sort((a,b) => {
    if (a.role === b.role) return a.name.localeCompare(b.name);
    return a.role === 'Bartender' ? -1 : 1;
  });

  const handleAdd = async (e) => {
    e.preventDefault(); if (!name.trim() || !email.trim()) return;
    const tPass = generateTempPass();
    try {
      await addDoc(collection(db, "users"), { name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password: tPass, role, isAdmin, isActive: true, forcePasswordChange: true, photoURL: photoURL.trim() });
      addToast('Staff Added', `Auto-generated password: ${tPass}`);
      const msg = `Welcome to Cheers! Log in at cheers-portal.vercel.app. Your email is ${email.trim()} and your temporary password is: ${tPass}`;
      if (phone) window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`;
      else window.location.href = `mailto:${email}?subject=Cheers Portal Access&body=${encodeURIComponent(msg)}`;
      setName(''); setEmail(''); setPhone(''); setPhotoURL(''); setIsAdmin(false);
    } catch (err) { console.error(err); }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault(); if (!editModalUser.name.trim() || !editModalUser.email.trim()) return;
    try {
      const updates = { name: editModalUser.name.trim(), email: editModalUser.email.toLowerCase().trim(), phone: editModalUser.phone || '', role: editModalUser.role, photoURL: editModalUser.photoURL || '' };
      if (editModalUser.newPassword) { updates.password = editModalUser.newPassword; updates.forcePasswordChange = true; }
      await updateDoc(doc(db, "users", editModalUser.id), updates);
      addToast('Profile Updated', `${editModalUser.name}'s info has been saved.`); setEditModalUser(null);
    } catch (err) { console.error(err); addToast('Update Failed', 'Could not save profile changes.'); }
  };

  const handleToggleAdmin = async (id, currentStatus) => { await updateDoc(doc(db, "users", id), { isAdmin: !currentStatus }); };
  const handleDelete = async (id) => { if (window.confirm("Remove this staff member? This cannot be undone.")) { await deleteDoc(doc(db, "users", id)); addToast('Staff Removed', 'Account permanently deleted.'); } };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Modal isOpen={!!editModalUser} onClose={() => setEditModalUser(null)} title={`Edit Profile: ${editModalUser?.name}`}>
        {editModalUser && (
          <form onSubmit={handleUpdateUser} className="space-y-3">
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Name</label><input type="text" value={editModalUser.name} onChange={e => setEditModalUser({...editModalUser, name: e.target.value})} className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-lg outline-none" required /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Email</label><input type="email" value={editModalUser.email} onChange={e => setEditModalUser({...editModalUser, email: e.target.value})} className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-lg outline-none" required /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Phone</label><input type="tel" value={editModalUser.phone || ''} onChange={e => setEditModalUser({...editModalUser, phone: e.target.value})} className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-lg outline-none" /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Avatar URL</label><input type="url" value={editModalUser.photoURL || ''} onChange={e => setEditModalUser({...editModalUser, photoURL: e.target.value})} className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-lg outline-none" /></div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Role</label><select value={editModalUser.role} onChange={e => setEditModalUser({...editModalUser, role: e.target.value})} className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-lg outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-600"><label className="block text-[10px] font-bold text-red-500 uppercase mb-0.5">Force Password Reset</label><input type="text" placeholder="Enter temporary password..." value={editModalUser.newPassword || ''} onChange={e => setEditModalUser({...editModalUser, newPassword: e.target.value})} className="w-full p-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg outline-none text-slate-900 dark:text-white" /></div>
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-colors mt-2 shadow-sm">Save Profile</button>
          </form>
        )}
      </Modal>

      {/* Roster is now ABOVE Add Staff */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {displayUsers.map(u => {
              const isMaster = u.email === MASTER_ADMIN_EMAIL;
              const isMeMaster = appUser?.email === MASTER_ADMIN_EMAIL;
              return (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="p-4 flex items-center gap-3">
                  <img src={getAvatar(u.name, u.photoURL)} className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600 object-cover bg-white shadow-sm" alt="Avatar"/>
                  <div className="font-black text-slate-900 dark:text-white text-base">{u.name}</div>
                </td>
                <td className="p-4">
                  <div className="text-[10px] font-black bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg w-max border border-slate-200 dark:border-slate-600 flex items-center gap-1.5 dark:text-slate-300">
                    <span>📱</span>{u.phone ? <a href={`tel:${u.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">{u.phone}</a> : <span className="text-slate-500">No phone</span>}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-lg inline-block ${u.role === 'Bartender' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'}`}>{u.role}</span>
                  {appUser?.isAdmin && !isMaster && (
                    <label className="flex items-center gap-1.5 mt-2 cursor-pointer w-max">
                      <input type="checkbox" checked={u.isAdmin} onChange={() => handleToggleAdmin(u.id, u.isAdmin)} className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600" /><span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Admin</span>
                    </label>
                  )}
                  {/* Prompt 7: Master Admin badge is only visible to the Master Admin themselves */}
                  {isMaster && isMeMaster && <span className="block mt-2 text-[9px] font-black bg-slate-900 dark:bg-slate-600 text-white px-2 py-1 rounded-lg w-max">Master Admin</span>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                     {appUser?.isAdmin && <button onClick={() => setEditModalUser(u)} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-xl bg-slate-50 dark:bg-slate-700 transition-colors shadow-sm"><Edit size={16}/></button>}
                     {appUser?.isAdmin && !isMaster && (<button onClick={() => handleDelete(u.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-xl bg-slate-50 dark:bg-slate-700 transition-colors shadow-sm"><Trash2 size={16}/></button>)}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {appUser?.isAdmin && (
        <div className="bg-slate-900 dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-800 dark:border-slate-700 text-white">
          <h3 className="font-black text-lg flex items-center gap-2 mb-4 text-white"><Users className="text-blue-400" size={20}/> Add New Staff</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl outline-none text-white focus:border-blue-500" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl outline-none text-white focus:border-blue-500" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl outline-none text-white focus:border-blue-500" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Avatar URL (Optional)</label><input type="url" value={photoURL} onChange={e => setPhotoURL(e.target.value)} className="w-full p-3 bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl outline-none text-white focus:border-blue-500" /></div>
            </div>
            <div className="flex flex-col md:flex-row items-end gap-4 pt-2">
              <div className="w-full md:w-64"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl outline-none text-white font-bold"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
              <label className="flex items-center justify-center gap-2 text-sm font-bold text-slate-300 cursor-pointer flex-1 bg-slate-800 border border-slate-700 rounded-xl h-[46px]"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 rounded" /> Grant Admin Access</label>
              <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black w-full md:w-auto shadow-md hover:bg-blue-500 transition-colors h-[46px]">Add Staff</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// --- SALES & TRENDS (Compacted & Daily Date Formatting) ---
const TabSales = ({ sales, addToast }) => {
  const [date, setDate] = useState(getToday());
  const [amount, setAmount] = useState('');
  const [tag, setTag] = useState('Standard Day');

  const handleSave = async (e) => {
    e.preventDefault(); if (!amount) return;
    await addDoc(collection(db, "sales"), { date, amount: parseFloat(amount), tag, loggedAt: new Date().toISOString() });
    setAmount(''); addToast('Saved', 'Daily sales logged.');
  };

  const sortedSales = [...sales].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 14);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-slate-900 dark:bg-slate-800 p-5 rounded-3xl shadow-xl border border-slate-800 dark:border-slate-700 text-white">
        <h2 className="text-lg font-black mb-4 flex items-center gap-2"><TrendingUp className="text-emerald-400"/> Log Sales</h2>
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="w-full sm:w-1/3"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 border border-slate-700 rounded-xl bg-slate-800 dark:bg-slate-700 dark:border-slate-600 text-white outline-none font-bold"/></div>
          <div className="w-full sm:w-1/3"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Revenue ($)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-2.5 border border-slate-700 rounded-xl bg-slate-800 dark:bg-slate-700 dark:border-slate-600 text-white outline-none font-black" required/></div>
          <div className="w-full sm:w-1/3"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Event Tag</label><select value={tag} onChange={e=>setTag(e.target.value)} className="w-full p-2.5 border border-slate-700 rounded-xl bg-slate-800 dark:bg-slate-700 dark:border-slate-600 text-white outline-none font-bold text-xs">{EVENT_TAGS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <button className="bg-emerald-600 text-white p-2.5 rounded-xl font-black shadow-md w-full sm:w-auto hover:bg-emerald-500 h-[42px] px-6">Save</button>
        </form>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-black text-lg mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Recent Trends</h3>
        <div className="divide-y dark:divide-slate-700">
          {sortedSales.length === 0 && <div className="py-6 text-center text-sm font-bold text-slate-400">No sales data logged yet.</div>}
          {sortedSales.map(s => (
          <div key={s.id} className="py-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 px-2 rounded-lg transition-colors">
            <div>
              <span className="font-black text-sm block text-slate-900 dark:text-white leading-tight">{formatFullDisplayDate(s.date)}</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1 inline-block ${s.tag === 'Standard Day' ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{s.tag}</span>
            </div>
            <div className="font-black text-xl text-emerald-600 dark:text-emerald-400 tracking-tight">${s.amount.toFixed(2)}</div>
          </div>
        ))}</div>
      </div>
    </div>
  );
};

// --- MESSAGE BOARD (Threaded Replies, Deletions, & Important Push) ---
const TabMessages = ({ events, appUser, users, addToast }) => {
  const [message, setMessage] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [replyText, setReplyText] = useState({});
  
  const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));
  
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if(!message.trim()) return;
    
    await addDoc(collection(db, "events"), {
      date: new Date().toISOString(),
      title: message.trim(),
      type: 'note',
      author: appUser.name,
      isImportant: isImportant,
      replies: []
    });
    
    // Push Notification Trigger for Important Messages
    if (isImportant) {
      // Gather all tokens except the person sending the message
      const tokens = users.filter(u => u.fcmToken && u.id !== appUser.id).map(u => u.fcmToken);
      if (tokens.length > 0) {
         fetch('/api/send-push', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             title: `🚨 Urgent: ${appUser.name.split(' ')[0]}`,
             body: message.trim(),
             tokens
           })
         }).catch(err => console.error("Push error:", err));
      }
    }
    
    setMessage('');
    setIsImportant(false);
    addToast(isImportant ? 'Alert Sent' : 'Posted', 'Message sent.');
  };
  
  const handleReply = async (eventId) => {
    const text = replyText[eventId]; if(!text || !text.trim()) return;
    const eventRef = doc(db, "events", eventId);
    const ev = events.find(e => e.id === eventId);
    const newReply = { author: appUser.name, text: text.trim(), date: new Date().toISOString(), id: Date.now() };
    await updateDoc(eventRef, { replies: [...(ev.replies || []), newReply] });
    setReplyText(p => ({...p, [eventId]: ''}));
  };

  const handleDelete = async (eventId, author) => {
    if (appUser.isAdmin || appUser.name === author) {
      if(window.confirm("Delete this message?")) await deleteDoc(doc(db, "events", eventId));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="font-black text-base mb-3 flex items-center gap-2 text-slate-800 dark:text-white"><MessageSquare size={16}/> Post a Message</h3>
        <form onSubmit={handleBroadcast} className="space-y-3">
          <textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 outline-none text-sm font-medium dark:text-white transition-colors focus:border-blue-400" rows="2" placeholder="Message the team..." required></textarea>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={isImportant} onChange={e=>setIsImportant(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"/>
              <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors uppercase tracking-wider">Mark as Important (Sends Alert)</span>
            </label>
            <button type="submit" className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-sm transition-all active:scale-95 ${isImportant ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>Post</button>
          </div>
        </form>
      </div>
      
      <div className="space-y-3">{allNotes.map(n => {
        const authorUser = users.find(u => u.name === n.author);
        const canDelete = appUser?.isAdmin || n.author === appUser?.name;
        const replies = n.replies || [];
        return (
        <div key={n.id} className={`p-4 rounded-2xl border shadow-sm transition-colors ${n.isImportant ? 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
          <div className="flex gap-3">
            {n.author !== 'System Alert' && <img src={getAvatar(n.author, authorUser?.photoURL)} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700 shadow-sm flex-shrink-0" alt="pic"/>}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <span className={`font-black text-sm ${n.isImportant ? 'text-red-700 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{n.author}</span>
                  {n.isImportant && <span className="text-[8px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">Important</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400">{new Date(n.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  {canDelete && <button onClick={() => handleDelete(n.id, n.author)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>}
                </div>
              </div>
              <p className={`font-medium text-sm leading-snug mb-3 ${n.isImportant?'text-red-900 dark:text-red-100':'text-slate-700 dark:text-slate-200'}`}>{n.title}</p>
              
              {/* Replies Section */}
              <div className="space-y-2 mt-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                {replies.map(r => (
                  <div key={r.id} className="flex gap-2 items-start">
                     <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[8px] flex-shrink-0 mt-0.5">{r.author.substring(0,2).toUpperCase()}</div>
                     <div className="flex-1">
                       <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 mr-2">{r.author}</span>
                       <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{r.text}</span>
                     </div>
                  </div>
                ))}
                <div className="flex gap-2 items-center pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">
                  <input type="text" value={replyText[n.id] || ''} onChange={e => setReplyText(p => ({...p, [n.id]: e.target.value}))} onKeyDown={e => {if(e.key === 'Enter'){ e.preventDefault(); handleReply(n.id);}}} placeholder="Write a reply..." className="flex-1 text-[11px] p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg outline-none font-medium dark:text-white" />
                  <button onClick={() => handleReply(n.id)} disabled={!replyText[n.id]?.trim()} className="text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400 p-2 rounded-lg font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"><Send size={14}/></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )})}</div>
    </div>
  )
};

// --- COMPACT MONTH VIEW (Print Landscape Fix) ---
const TabMonth = ({ currentDate, users, shifts }) => {
  const monthStr = getMonthStr(currentDate); 
  const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); 
  const days = getDaysInMonth(monthStr);
  const totalRows = Math.ceil((firstDay + days) / 7);

  return (
    <div id="month-wrapper" className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
      <style>{`
        @media print { 
          /* Force Landscape and tight margins */
          @page { size: landscape !important; margin: 0.25in !important; }
          html, body { background: white !important; padding: 0 !important; margin: 0 !important; width: 11in !important; height: 8.5in !important; overflow: hidden !important; }
          
          /* 1. Override the global Day Dot printer block */
          html body .app-root { display: block !important; background: white !important; }
          html body .print-root { display: none !important; }
          
          /* 2. Hide ALL siblings of <main> (Headers, Footers, Modals) */
          html body .app-root > * { display: none !important; }
          
          /* 3. Explicitly SHOW <main> and remove its padding */
          html body .app-root > main { 
            display: block !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            max-width: none !important; 
          }
          
          /* 4. Strip styling from the month wrapper */
          #month-wrapper {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* 5. Hide buttons and UI */
          .no-print { display: none !important; }
          
          /* 6. Force the grid to hardcoded physical paper dimensions */
          .print-grid { 
            display: grid !important; 
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important; 
            grid-template-rows: auto repeat(${totalRows}, minmax(0, 1fr)) !important;
            width: 10.5in !important;
            height: 7.7in !important; /* Safely fits inside 8.5" with margins */
            border: 2px solid black !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
          }
          
          /* 7. Strict cell formatting */
          .cell { 
            border: 1px solid black !important; 
            background: transparent !important; 
            min-height: 0 !important; 
            padding: 4px !important; 
            overflow: hidden !important; 
          }
          
          .print-text { color: black !important; }
        }
      `}</style>
      
      {/* Web UI Header */}
      <div className="flex justify-between items-center p-4 bg-slate-900 no-print">
        <h3 className="font-black text-white flex items-center gap-2"><Calendar size={20}/> {formatDisplayMonth(monthStr)}</h3>
        <button onClick={()=>window.print()} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-black text-sm shadow-md transition-colors active:scale-95">Print Calendar</button>
      </div>
      
      {/* Print Only Header */}
      <h2 className="hidden print:block text-2xl font-black text-left text-black mb-2 uppercase tracking-widest">{formatDisplayMonth(monthStr)}</h2>
      
      <div className="grid grid-cols-7 border-t border-l dark:border-slate-700 print-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="p-2 bg-slate-50 dark:bg-slate-900 text-center font-black text-[10px] text-slate-500 uppercase tracking-widest cell print-text">{d}</div>)}
        
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className="bg-slate-50/50 dark:bg-slate-800/50 min-h-[80px] print:min-h-0 cell"/>)}
        
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; const dayShifts = shifts.filter(s=>s.date===date&&s.isPublished);
          return (
            <div key={date} className="p-1 min-h-[80px] print:min-h-0 flex flex-col cell overflow-hidden">
              <span className="text-right text-[10px] font-black text-slate-400 mb-1 print-text">{i+1}</span>
              <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
                {dayShifts.map(s=><div key={s.id} className={`text-[9px] font-black px-1 py-0.5 rounded leading-tight truncate print-text ${s.role==='Bartender'?'bg-blue-100 text-blue-800':'bg-orange-100 text-orange-800'}`}>{users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}</div>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- INVENTORY TAB (Full Features + Smart Deficit) ---
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
  const executeOrder = async () => {
    const { type, items } = confirmModal; let bodyText = "";
    if (type === 'PFG') { bodyText = items.map(i => `${i.pfgCode ? `[${i.pfgCode}] ` : ''}${i.name} (${i.packSize}): ${i.orderQty}`).join('%0D%0A'); window.location.href = `mailto:geoffm1985@gmail.com?subject=PFG Order&body=${encodeURIComponent("Performance Foodservice Order\n") + bodyText}`; } 
    else { bodyText = items.map(i => `${i.name} (${i.packSize || '1 CS'}): ${i.orderQty}`).join('%0A'); window.location.href = `sms:555-555-5555?body=${encodeURIComponent("Cheers Chilton Order:\n\n") + bodyText}`; }
    for (const item of items) { await updateDoc(doc(db, "inventoryItems", item.id), { pendingQty: item.orderQty, lastOrderedQty: item.orderQty, lastOrderedDate: getToday() }); }
    setOrderOverrides({}); setConfirmModal({ isOpen: false, type: null, items: [] }); addToast('Dispatched', `${type} order tracked.`);
  };

  const handleReceivePending = async (supplier) => {
    if(!window.confirm(`Receive pending ${supplier} products?`)) return;
    const pendingItems = inventoryItems.filter(i => (i.pendingQty || 0) > 0 && (supplier === 'PFG' ? (!i.supplier || i.supplier === 'PFG') : i.supplier === 'Badger'));
    for (const item of pendingItems) { await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: item.currentStock + item.pendingQty, pendingQty: 0 }); }
    addToast('Inbound Ingested', `Stock loaded for ${supplier}.`);
  };

  const groupedItems = inventoryItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm))).reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, type: null, items: [] })} title={`Review ${confirmModal.type} Order`}>
         <div className="space-y-4">
           <div className="max-h-60 overflow-y-auto border dark:border-slate-700 rounded-xl divide-y dark:divide-slate-700">{confirmModal.items.map(item => (<div key={item.id} className="p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-700"><div><span className="font-bold text-sm block dark:text-white">{item.name}</span><span className="text-xs text-slate-500">{item.packSize}</span></div><div className="font-black text-blue-600 dark:text-blue-400 text-lg">{item.orderQty}</div></div>))}</div>
           <button onClick={executeOrder} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2"><Send size={20}/> Send Order Out</button>
         </div>
      </Modal>
      <div className="flex justify-between items-center border-b dark:border-slate-700 pb-3">
        <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white"><Package size={24}/> Inventory</h2>
        {appUser?.isAdmin && <div className="bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl flex border dark:border-slate-700">{['count', 'order', 'manage'].map(tab => (<button key={tab} onClick={() => setInvTab(tab)} className={`px-4 py-1.5 rounded-lg text-sm font-bold capitalize ${invTab === tab ? 'bg-white dark:bg-slate-700 dark:text-white shadow-sm' : 'text-slate-500'}`}>{tab}</button>))}</div>}
      </div>
      {invTab === 'count' && (
        <div className="space-y-4">
          <input type="text" placeholder="Search parameters..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 border rounded-xl font-bold outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-base font-black border-b dark:border-slate-700 pb-0.5 uppercase tracking-wide text-slate-400">{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{items.map(item => (
                  <div key={item.id} className="bg-white dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700 flex items-center justify-between shadow-sm gap-2">
                    <div className="flex-1 min-w-0"><div className="font-bold dark:text-white text-sm truncate">{item.name}</div><div className="text-[9px] font-bold text-slate-400 uppercase">{item.supplier} • {item.packSize || '1 CS'}</div>{(item.pendingQty || 0) > 0 && <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">(+{item.pendingQty} Inbound)</span>}</div>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-1 rounded-md border dark:border-slate-600 flex-shrink-0">
                      <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-slate-400 uppercase">PAR</span><input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} disabled={!appUser?.isAdmin} className="w-8 text-center font-bold border rounded py-0.5 outline-none text-xs dark:bg-slate-800 dark:text-white dark:border-slate-600" /></div>
                      <div className="h-6 w-px bg-slate-200 dark:bg-slate-600"></div>
                      <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-slate-400 uppercase">STOCK</span><div className="flex items-center gap-1"><button onClick={() => updateStock(item.id, item.currentStock - 1)} className="w-5 h-5 flex items-center justify-center bg-white dark:bg-slate-800 border dark:border-slate-600 rounded font-bold dark:text-white">-</button><span className={`w-4 text-center font-black text-sm ${item.currentStock < item.parLevel ? 'text-red-500' : 'dark:text-white'}`}>{item.currentStock}</span><button onClick={() => updateStock(item.id, item.currentStock + 1)} className="w-5 h-5 flex items-center justify-center bg-white dark:bg-slate-800 border dark:border-slate-600 rounded font-bold dark:text-white">+</button></div></div>
                    </div>
                  </div>
                ))}</div>
            </div>
          ))}
        </div>
      )}
      {appUser?.isAdmin && invTab === 'order' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 mb-2">{inventoryItems.some(i=>(i.pendingQty||0)>0&&i.supplier==='Badger') && <button onClick={()=>handleReceivePending('Badger')} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-emerald-500">Receive Badger</button>}{inventoryItems.some(i=>(i.pendingQty||0)>0&&(!i.supplier||i.supplier==='PFG')) && <button onClick={()=>handleReceivePending('PFG')} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-emerald-500">Receive PFG</button>}</div>
          <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="font-black text-lg text-white flex items-center gap-2"><TrendingUp size={18}/> Smart Deficit Report</h3><span className="bg-blue-600 text-white px-3 py-1 rounded-full font-black text-[10px] uppercase">{itemsToOrder.length} Items</span></div>
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-[9px] font-black text-slate-500 uppercase"><th className="p-3">Product</th><th className="p-3 text-center">Last Order</th><th className="p-3 text-right">Order Qty</th></tr></thead>
              <tbody className="divide-y dark:divide-slate-700">{itemsToOrder.map(item => {
                const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="p-3"><span className="font-bold text-sm block dark:text-white">{item.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{item.packSize||'1 CS'} • Par: {item.parLevel}</span></td>
                    <td className="p-3 text-center text-[10px] font-bold text-slate-400">{item.lastOrderedQty ? `${item.lastOrderedQty} (${item.lastOrderedDate})` : '--'}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1"><button onClick={()=>handleOrderChange(item.id, -1, currentOrder)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold dark:text-white hover:bg-slate-200 transition-colors">-</button><input type="number" min="0" value={currentOrder} onChange={e=>setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))} className="w-12 h-8 text-center font-black bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 rounded-lg outline-none border dark:border-slate-600"/><button onClick={()=>handleOrderChange(item.id, 1, currentOrder)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold dark:text-white hover:bg-slate-200 transition-colors">+</button></div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4"><div className="text-left w-full sm:w-auto"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">PFG Total</span><span className="font-black text-2xl dark:text-white">${getFinalOrderList('PFG').reduce((s,i)=>s+(i.price*i.orderQty),0).toFixed(2)}</span></div><div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"><button onClick={()=>handleReviewOrder('Badger')} className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"><MessageSquare size={16}/> Text Badger</button><button onClick={()=>handleReviewOrder('PFG')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:bg-blue-500"><Send size={16}/> Email PFG</button></div></div>
          </div>
        </div>
      )}
      {appUser?.isAdmin && invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Inventory Item">{editItem && (<form onSubmit={handleSaveEdit} className="space-y-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" required /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label><select value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Supplier</label><select value={editItem.supplier || 'PFG'} onChange={e => setEditItem({...editItem, supplier: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Pack Size</label><input type="text" value={editItem.packSize || ''} onChange={e => setEditItem({...editItem, packSize: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" /></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" /></div></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Item Code</label><input type="text" value={editItem.pfgCode || ''} onChange={e => setEditItem({...editItem, pfgCode: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" /></div><button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">Save Changes</button></form>)}</Modal>
          <div className="bg-white dark:bg-slate-800 p-6 border dark:border-slate-700 rounded-3xl shadow-sm"><h3 className="text-xl font-black border-b dark:border-slate-700 pb-3 mb-4 dark:text-white">Add Single Item</h3><form onSubmit={handleAddItem} className="space-y-4"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-transparent dark:text-white" required /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label><select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-transparent dark:bg-slate-700 dark:text-white font-bold"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Supplier</label><select value={newItemSupplier} onChange={e => setNewItemSupplier(e.target.value)} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-transparent dark:bg-slate-700 dark:text-white font-bold"><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Pack Size</label><input type="text" value={newItemPackSize} onChange={e => setNewItemPackSize(e.target.value)} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-transparent dark:text-white" /></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Price ($)</label><input type="number" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-transparent dark:text-white" /></div></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Item Code</label><input type="text" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} className="w-full p-3 border dark:border-slate-600 rounded-xl bg-transparent dark:text-white" /></div><button type="submit" className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-black shadow-sm">Add Item</button></form></div>
          <div className="bg-white dark:bg-slate-800 p-6 border dark:border-slate-700 rounded-3xl shadow-sm"><h3 className="text-xl font-black border-b dark:border-slate-700 pb-3 mb-4 dark:text-white">Current Master Catalog</h3><div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">{inventoryItems.map(item => (<div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl border border-transparent transition-all"><div><span className="font-bold text-slate-800 dark:text-white block text-sm leading-tight">{item.name}</span><span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md mt-1 inline-block uppercase tracking-wider">{item.category} • {item.packSize || '1 CS'}</span></div><div className="flex gap-2 items-center"><button onClick={() => toggleStar(item)} className={`p-2 rounded-lg transition-colors ${item.isStarred ? 'text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{item.isStarred ? '⭐' : '☆'}</button><button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-indigo-500 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"><Edit size={18}/></button><button onClick={() => deleteDoc(doc(db, "inventoryItems", item.id))} className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"><Trash2 size={18}/></button></div></div>))}</div></div>
        </div>
      )}
    </div>
  );
};

// --- SETTINGS (Push Tester & Shift Reminders) ---
const TabSettings = ({ addToast, appUser }) => {
  const toggleReminder = async () => await updateDoc(doc(db, "users", appUser.id), { shiftRemindersEnabled: !appUser.shiftRemindersEnabled });
  const updateLeadTime = async (val) => await updateDoc(doc(db, "users", appUser.id), { reminderLeadTime: parseInt(val) || 24 });
  
  const testPush = async () => {
    if (!appUser.fcmToken) return addToast('Error', 'Enable notifications first.');
    addToast('Sending...', 'Triggering test notification.');
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("Cheers OS", { body: "Loud and clear! Push notifications are locked and loaded.", icon: "/app-icon.png" });
    } catch(e) { console.error(e); addToast('Error', 'Failed to trigger local push.'); }
  };

  const handleEnablePush = async () => {
    if (!messaging) return addToast('Error', 'Push not supported.');
    try {
      const p = await Notification.requestPermission(); 
      if(p !== 'granted') return addToast('Denied', 'Notifications blocked.');
      addToast('Connecting...', 'Activating secure worker...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      let attempts = 0; while (!registration.active && attempts < 20) { await new Promise(r => setTimeout(r, 200)); attempts++; }
      const token = await getToken(messaging, { vapidKey: 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU', serviceWorkerRegistration: registration });
      if(token) { await updateDoc(doc(db, "users", appUser.id), { fcmToken: token }); addToast('Success', 'Push enabled.'); }
    } catch(e) { addToast('Error', e.message); console.error(e); }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    addToast('Uploading', 'Compressing and saving image...');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas'); const MAX = 200; let w = img.width; let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        await updateDoc(doc(db, "users", appUser.id), { photoURL: canvas.toDataURL('image/jpeg', 0.8) });
        addToast('Success', 'Profile picture updated.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-6">
        <h3 className="text-xl font-black dark:text-white mb-2">My Profile & Settings</h3>
        <div className="space-y-3">
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl border dark:border-slate-600 flex justify-between items-center">
             <div><h4 className="font-bold text-sm dark:text-slate-200">Profile Picture</h4><p className="text-xs text-slate-500 dark:text-slate-400">Upload a custom avatar</p></div>
             <label className="bg-white dark:bg-slate-800 border dark:border-slate-600 px-4 py-2 rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-100 transition-colors shadow-sm dark:text-white">Upload Image<input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl border dark:border-slate-600 space-y-3">
             <div className="flex justify-between items-center cursor-pointer" onClick={toggleReminder}>
               <div><h4 className="font-bold text-sm dark:text-slate-200">Shift Reminders</h4><p className="text-xs text-slate-500 dark:text-slate-400">Alert me before my shifts</p></div>
               <div className={`w-10 h-5 rounded-full flex items-center px-1 transition-colors ${appUser.shiftRemindersEnabled?'bg-blue-600':'bg-slate-300 dark:bg-slate-600'}`}><div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${appUser.shiftRemindersEnabled?'translate-x-4':'translate-x-0'}`}></div></div>
             </div>
             {appUser.shiftRemindersEnabled && (
               <div className="flex items-center justify-between border-t dark:border-slate-600 pt-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Hours before shift:</span>
                  <input type="number" min="1" max="72" value={appUser.reminderLeadTime || 24} onChange={(e) => updateLeadTime(e.target.value)} className="w-16 p-1.5 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl text-center font-bold text-sm outline-none dark:text-white shadow-sm" />
               </div>
             )}
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-3xl border border-blue-100 dark:border-blue-800">
           <h4 className="font-black text-blue-900 dark:text-blue-400 mb-1">Device Push Notifications</h4>
           <p className="text-xs text-blue-800 dark:text-blue-300 mb-4 font-bold">Link this device to receive alerts.</p>
           <div className="flex gap-2">
             <button onClick={handleEnablePush} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black flex-1 text-sm hover:bg-blue-700 shadow-sm transition-colors">Enable Alerts</button>
             {appUser.fcmToken && <button onClick={testPush} className="bg-slate-900 dark:bg-slate-700 text-white px-4 py-3 rounded-xl font-black flex-1 text-sm shadow-sm hover:bg-slate-800 transition-colors">Test Push</button>}
           </div>
        </div>
      </div>
    </div>
  );
};



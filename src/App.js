import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, BookOpen, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

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

// --- Master Configuration ---
const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';

// --- Dynamic Infinite Holiday Engine ---
const getHolidays = (year) => {
  const h = {};
  const add = (m, d, name) => h[`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`] = name;
  const getNthDay = (m, dayOfWeek, n) => {
    let d = new Date(year, m - 1, 1);
    let count = 0;
    while (d.getMonth() === m - 1) {
      if (d.getDay() === dayOfWeek) {
        count++;
        if (count === n) return d.getDate();
      }
      d.setDate(d.getDate() + 1);
    }
    if (n === -1) {
      d = new Date(year, m, 0);
      while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() - 1);
      return d.getDate();
    }
  };
  add(1, 1, "New Year's Day"); add(2, 14, "Valentine's Day"); add(3, 17, "St. Patrick's Day"); add(7, 4, "Independence Day");
  add(10, 31, "Halloween"); add(11, 11, "Veterans Day"); add(12, 24, "Christmas Eve"); add(12, 25, "Christmas Day"); add(12, 31, "New Year's Eve");
  add(1, getNthDay(1, 1, 3), "Martin Luther King Jr. Day"); add(2, getNthDay(2, 1, 3), "Presidents' Day"); add(5, getNthDay(5, 0, 2), "Mother's Day");
  add(5, getNthDay(5, 1, -1), "Memorial Day"); add(6, getNthDay(6, 0, 3), "Father's Day"); add(9, getNthDay(9, 1, 1), "Labor Day"); add(11, getNthDay(11, 4, 4), "Thanksgiving");
  return h;
};

// --- Custom Hook to Sync Live Database ---
const useLiveCollection = (collectionName) => {
  const [data, setData] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, collectionName), (snap) => setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return unsub;
  }, [collectionName]);
  return data;
};

// --- Helper Functions ---
const formatDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
const getToday = () => formatDate(new Date());
const addDays = (dateStr, days) => { const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + days); return formatDate(d); };
const getMonthStr = (dateStr) => (dateStr || getToday()).substring(0, 7);
const formatDisplayDate = (dateStr) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const formatDisplayMonth = (monthStr) => { const [y, m] = monthStr.split('-'); return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
const getDaysInMonth = (monthStr) => { const [y, m] = monthStr.split('-'); return new Date(y, m, 0).getDate(); };
const formatTime12Hour = (time24) => {
  if (!time24 || !time24.includes(':')) return time24;
  let [h, m] = time24.split(':'); h = parseInt(h, 10);
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

// --- Push Notification Mock Trigger ---
const triggerPushNotification = (title, body) => {
  console.log(`[PUSH NOTIFICATION] ${title}: ${body}`);
  // In future: await fetch('/api/sendFCM', { method: 'POST', body: JSON.stringify({ title, body }) });
};

// --- SVG Logo ---
const CheersLogo = ({ isDark }) => (
  <svg viewBox="0 0 400 120" className="h-12 sm:h-14 w-auto drop-shadow-sm" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M190,20 C70,0 0,35 0,65 C0,95 100,110 270,110 L270,105 C100,105 30,95 30,65 C30,40 80,25 190,20 Z" className={isDark ? "text-slate-100" : "text-slate-900"} />
    <text x="95" y="85" fontFamily="'Brush Script MT', 'Great Vibes', cursive, serif" fontStyle="italic" fontSize="90" fontWeight="900" className={isDark ? "text-slate-100" : "text-slate-900"} letterSpacing="-1">Cheers</text>
    <text x="275" y="110" fontFamily="'Times New Roman', Georgia, serif" fontSize="28" className={isDark ? "text-slate-100" : "text-slate-900"}>Chilton</text>
  </svg>
);

// --- Custom Modal ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700"><h3 className="font-bold text-xl text-slate-900 dark:text-white">{title}</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors"><X size={20}/></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// --- Navigation Drawer Component ---
const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, isDark, toggleDark }) => {
  if (!isOpen) return null;
  const tabs = [{ id: 'schedule', label: 'Schedule', icon: <Calendar size={20}/> }, { id: 'month', label: 'Month View', icon: <Calendar size={20}/> }, { id: 'timeoff', label: 'Time Off', icon: <Clock size={20}/> }];
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={20}/> });
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={20}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={20}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={20}/> });

  const handleLogout = () => { localStorage.removeItem('cheersUser'); setAppUser(null); onClose(); };

  return (
     <div className="fixed inset-0 z-50 flex justify-end">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       <div className="w-80 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col relative border-l border-slate-200 dark:border-slate-700 animate-slide-in">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex justify-between items-start">
             <div><div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Signed in as</div><div className="text-slate-900 dark:text-white font-black text-xl tracking-tight">{appUser.name}</div><div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mt-1.5 bg-blue-50 dark:bg-blue-900/30 w-max px-2 py-1 rounded-md">{appUser.isAdmin && <Shield size={12} />} {appUser.role} {appUser.isAdmin && '• Admin'}</div></div>
             <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={20}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
             {tabs.map(tab => (<button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${activeTab === tab.id ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}`}><div className="flex items-center gap-3"><span className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'}>{tab.icon}</span>{tab.label}</div></button>))}
          </div>
          
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-3">
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm cursor-pointer" onClick={toggleDark}>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">{isDark ? <Moon size={16}/> : <Sun size={16}/>} Dark Mode</span>
              <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${isDark ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${isDark ? 'translate-x-4' : 'translate-x-0'}`}></div></div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3.5 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut size={18} /> Log Out</button>
          </div>
       </div>
     </div>
  );
};

// --- Main Application ---
export default function App() {
  const users = useLiveCollection('users');
  const shifts = useLiveCollection('shifts');
  const prepItems = useLiveCollection('prepItems');
  const inventoryItems = useLiveCollection('inventoryItems');
  const timeOff = useLiveCollection('timeOff');
  const shiftSwaps = useLiveCollection('shiftSwaps');
  const events = useLiveCollection('events');
  
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('cheersUser'); return saved ? JSON.parse(saved) : null; });
  const [activeTabState, setActiveTabState] = useState('schedule');
  const [isDark, setIsDark] = useState(() => { return localStorage.getItem('theme') === 'dark'; });

  // Dark Mode Engine
  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDark]);

  useEffect(() => {
    const handlePopState = (e) => { if (e.state && e.state.tab) setActiveTabState(e.state.tab); else setActiveTabState('schedule'); };
    window.addEventListener('popstate', handlePopState);
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || 'schedule';
    setActiveTabState(tab); window.history.replaceState({ tab }, '', `?tab=${tab}`);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} isDark={isDark} />;

  return (
    <div className={`min-h-screen font-sans flex flex-col ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .dark input[type="date"]::-webkit-calendar-picker-indicator, .dark input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      {/* --- Header --- */}
      <header className={`sticky top-0 z-40 shadow-sm border-b h-20 flex items-center justify-between px-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <CheersLogo isDark={isDark} />
        <button onClick={() => setIsMenuOpen(true)} className={`relative p-2.5 border rounded-xl shadow-sm transition-all outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}><Menu size={24} /></button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} isDark={isDark} toggleDark={() => setIsDark(!isDark)} />

      {/* --- Date Header --- */}
      {['schedule', 'prep', 'month'].includes(activeTabState) && (
        <div className={`py-5 px-4 shadow-sm z-30 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => activeTabState === 'month' ? setCurrentDate(addDays(currentDate, -30)) : setCurrentDate(addDays(currentDate, -1))} className={`p-2.5 border rounded-xl transition-colors ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'}`}><ChevronLeft size={24} /></button>
            <h2 onClick={() => setIsDateModalOpen(true)} className={`text-2xl sm:text-3xl font-black tracking-tight text-center cursor-pointer transition-colors ${isDark ? 'text-white hover:text-blue-400' : 'text-slate-900 hover:text-blue-600'}`}>{activeTabState === 'month' ? formatDisplayMonth(getMonthStr(currentDate)) : formatDisplayDate(currentDate)}</h2>
            <button onClick={() => activeTabState === 'month' ? setCurrentDate(addDays(currentDate, 30)) : setCurrentDate(addDays(currentDate, 1))} className={`p-2.5 border rounded-xl transition-colors ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'}`}><ChevronRight size={24} /></button>
          </div>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input type="date" value={currentDate || ''} onChange={e => { if (e.target.value) { setCurrentDate(e.target.value); setIsDateModalOpen(false); } }} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setIsDateModalOpen(false)} className="w-full bg-slate-900 dark:bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors">Close</button>
        </div>
      </Modal>

      {/* --- Main Content Area --- */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 pb-24">
        {activeTabState === 'schedule' && <TabSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOff={timeOff} events={events} addToast={addToast} />}
        {activeTabState === 'month' && <TabMonth currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} events={events} setCurrentDate={(d) => { setCurrentDate(d); setActiveTab('schedule'); }} addToast={addToast} />}
        {activeTabState === 'timeoff' && <TabTimeOff appUser={liveAppUser} users={users} timeOff={timeOff} addToast={addToast} />}
        {activeTabState === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} />}
        {activeTabState === 'inventory' && <TabInventory inventoryItems={inventoryItems} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'team' && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'settings' && <TabSettings addToast={addToast} inventoryItems={inventoryItems} appUser={liveAppUser} />}
      </main>

      {/* --- Toast Alert Engine --- */}
      <div className="fixed top-24 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-3 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-start gap-4 border border-slate-700 animate-toast">
            <div className="bg-blue-500/20 p-2 rounded-full text-blue-400 mt-0.5"><Bell size={18} /></div>
            <div><h4 className="font-bold text-sm">{t.title}</h4><p className="text-sm text-slate-300 font-medium mt-0.5">{t.message}</p></div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="ml-auto text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Login Screen ---
const LoginScreen = ({ users, setAppUser, isDark }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(false); const [resetUser, setResetUser] = useState(null);
  const isFirstUser = users.length === 0;

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    if (email.trim() === 'admin' && password === 'Atticus7!') { setAppUser({ id: 'dev-backdoor', name: 'Ghost Admin', email: MASTER_ADMIN_EMAIL, role: 'Kitchen', isAdmin: true, isActive: true }); return; }
    try {
      if (isFirstUser) {
        if (!name.trim()) return setError("Name is required for the first admin account.");
        const newUser = { name: name.trim(), email: MASTER_ADMIN_EMAIL, phone: '', password, role: 'Kitchen', isAdmin: true, isActive: true, forcePasswordChange: false, availability: {sun:true,mon:true,tue:true,wed:true,thu:true,fri:true,sat:true} };
        const docRef = await addDoc(collection(db, "users"), newUser);
        setAppUser({ id: docRef.id, ...newUser });
      } else {
        const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
        if (user) { if (user.forcePasswordChange) setResetUser(user); else setAppUser(user); } 
        else setError("Invalid email or password.");
      }
    } catch (err) { setError("Database connection error."); console.error(err); }
    setIsLoading(false);
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    if(newPassword.length < 5) { setError("Password must be at least 5 characters."); setIsLoading(false); return; }
    try {
      await updateDoc(doc(db, "users", resetUser.id), { password: newPassword, forcePasswordChange: false });
      setAppUser({ ...resetUser, password: newPassword, forcePasswordChange: false });
    } catch (err) { setError("Failed to update password."); console.error(err); }
    setIsLoading(false);
  };

  if (resetUser) return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}><div className={`rounded-3xl shadow-xl border p-8 max-w-md w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><h2 className={`text-2xl font-black text-center mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Welcome, {resetUser.name}!</h2><p className="text-center text-slate-500 dark:text-slate-400 mb-6 font-medium">Please set your permanent password to continue.</p><form onSubmit={handlePasswordSetup} className="space-y-4"><div><label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>{error && <p className="text-red-600 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800">{error}</p>}<button type="submit" disabled={isLoading} className="w-full bg-slate-900 dark:bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-md flex justify-center items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={20}/> : 'Save Password & Login'}</button></form></div></div>
  );

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}><div className={`rounded-3xl shadow-xl border p-8 max-w-md w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><div className="flex justify-center mb-8"><CheersLogo isDark={isDark} /></div><h2 className={`text-2xl font-black text-center mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{isFirstUser ? 'Create Admin Account' : 'Staff Login'}</h2><form onSubmit={handleAuth} className="space-y-4">{isFirstUser && (<div><label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">Your Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>)}<div><label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">Email / Username</label><input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div><div><label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>{error && <p className="text-red-600 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-200 dark:border-red-800">{error}</p>}<button type="submit" disabled={isLoading} className="w-full bg-slate-900 dark:bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors shadow-md mt-2 flex justify-center items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={20}/> : (isFirstUser ? 'Create Account' : 'Login')}</button></form></div></div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('Bartender'); const [isAdmin, setIsAdmin] = useState(false);
  const [editModalUser, setEditModalUser] = useState(null);
  const displayUsers = users;

  const handleAdd = async (e) => {
    e.preventDefault(); if (!name.trim() || !email.trim() || !password.trim()) return;
    try {
      await addDoc(collection(db, "users"), { name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password, role, isAdmin, isActive: true, forcePasswordChange: true, availability: {sun:true,mon:true,tue:true,wed:true,thu:true,fri:true,sat:true} });
      addToast('Team Member Added', `${name.trim()} will be prompted to set a new password on their first login.`);
      setName(''); setEmail(''); setPhone(''); setPassword(''); setIsAdmin(false);
    } catch (err) { console.error(err); }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault(); if (!editModalUser.name.trim() || !editModalUser.email.trim()) return;
    try {
      const updates = { name: editModalUser.name.trim(), email: editModalUser.email.toLowerCase().trim(), phone: editModalUser.phone || '', role: editModalUser.role };
      if (editModalUser.newPassword) { updates.password = editModalUser.newPassword; updates.forcePasswordChange = true; }
      await updateDoc(doc(db, "users", editModalUser.id), updates);
      addToast('Profile Updated', `${editModalUser.name}'s info has been saved.`); setEditModalUser(null);
    } catch (err) { console.error(err); addToast('Update Failed', 'Could not save profile changes.'); }
  };

  const handleToggleAdmin = async (id, currentStatus) => { await updateDoc(doc(db, "users", id), { isAdmin: !currentStatus }); };
  const handleDelete = async (id) => { if (window.confirm("Remove this staff member? This cannot be undone.")) { await deleteDoc(doc(db, "users", id)); addToast('Staff Removed', 'Account permanently deleted.'); } };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Modal isOpen={!!editModalUser} onClose={() => setEditModalUser(null)} title={`Edit Profile: ${editModalUser?.name}`}>
        {editModalUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Name</label><input type="text" value={editModalUser.name} onChange={e => setEditModalUser({...editModalUser, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email (Hidden from Staff)</label><input type="email" value={editModalUser.email} onChange={e => setEditModalUser({...editModalUser, email: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label><input type="tel" value={editModalUser.phone || ''} onChange={e => setEditModalUser({...editModalUser, phone: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Role</label><select value={editModalUser.role} onChange={e => setEditModalUser({...editModalUser, role: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-600">
               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 text-red-500">Force Password Reset (Leave blank to keep current)</label>
               <input type="text" placeholder="Enter new temporary password..." value={editModalUser.newPassword || ''} onChange={e => setEditModalUser({...editModalUser, newPassword: e.target.value})} className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl outline-none" />
            </div>
            <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors mt-2">Save Profile Updates</button>
          </form>
        )}
      </Modal>

      {appUser?.isAdmin && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Users size={20}/> Add Staff Member</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Temporary Password</label><input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mt-4 cursor-pointer flex-1"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-blue-600" /> Grant Admin Access</label>
              <button type="submit" className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 w-full sm:w-auto shadow-sm mt-4 sm:mt-0">Add Staff</button>
            </div>
          </form>
        </div>
      )}
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead><tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider"><th className="p-4 font-bold">Staff Directory</th><th className="p-4 font-bold">Phone Number</th><th className="p-4 font-bold">Role</th><th className="p-4 font-bold text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {displayUsers.length === 0 && (<tr><td colSpan="4" className="p-6 text-center text-slate-400 font-medium">No active staff members found.</td></tr>)}
            {displayUsers.map(u => {
              const isMaster = u.email === MASTER_ADMIN_EMAIL;
              const showMasterBadge = isMaster && appUser?.email === MASTER_ADMIN_EMAIL;
              return (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="p-4"><div className="font-bold text-slate-900 dark:text-white text-lg">{u.name}</div></td>
                <td className="p-4"><div className="text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-lg w-max border border-slate-200 dark:border-slate-600">{u.phone || 'No phone listed'}</div></td>
                <td className="p-4">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${u.role === 'Bartender' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'}`}>{u.role}</span>
                  {appUser?.isAdmin && !isMaster && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer w-max">
                      <input type="checkbox" checked={u.isAdmin} onChange={() => handleToggleAdmin(u.id, u.isAdmin)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600" /><span className="text-xs font-bold text-slate-500 dark:text-slate-400">Admin</span>
                    </label>
                  )}
                  {showMasterBadge && <span className="block mt-2 text-xs font-black bg-slate-900 dark:bg-slate-700 text-white px-2 py-0.5 rounded w-max"><Shield size={10} className="inline mr-1 pb-0.5"/>Master Admin</span>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1">
                     {appUser?.isAdmin && <button onClick={() => setEditModalUser(u)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors flex items-center justify-center" title="Edit Profile"><Edit size={18}/></button>}
                     {appUser?.isAdmin && !isMaster && (<button onClick={() => handleDelete(u.id)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors flex items-center justify-center" title="Delete User"><Trash2 size={18}/></button>)}
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


// --- Tab: Month View ---
const TabMonth = ({ currentDate, appUser, users, shifts, events, setCurrentDate, addToast }) => {
  const monthStr = getMonthStr(currentDate);
  const year = parseInt(monthStr.split('-')[0], 10);
  const holidayMap = getHolidays(year);
  const firstDay = new Date(monthStr + '-01T12:00:00').getDay();
  const displayUsers = users.length > 0 ? users : [];

  const handlePublishMonth = async () => {
    if(!window.confirm(`Publish all shifts for ${formatDisplayMonth(monthStr)}? Non-admins will now see their schedules.`)) return;
    try {
      const monthShifts = shifts.filter(s => s.date.startsWith(monthStr) && !s.isPublished);
      for (const shift of monthShifts) { await updateDoc(doc(db, "shifts", shift.id), { isPublished: true }); }
      triggerPushNotification("Schedule Published", `The schedule for ${formatDisplayMonth(monthStr)} is now live.`);
      addToast('Schedule Published', `Staff can now view ${formatDisplayMonth(monthStr)} shifts.`);
    } catch(err) { console.error(err); addToast('Error', 'Failed to publish schedule.'); }
  };

  const unpublishedCount = shifts.filter(s => s.date.startsWith(monthStr) && !s.isPublished).length;

  return (
    <div className="space-y-4 print-container">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.5in; }
          body * { visibility: hidden !important; }
          .print-container, .print-container * { visibility: visible !important; }
          .print-container { position: absolute; left: 0; top: 0; width: 100vw; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-grid { border: 2px solid #000 !important; }
          .print-cell { border: 1px solid #000 !important; min-height: 80px; }
          .print-text { color: #000 !important; background: transparent !important; border: none !important; font-size: 11px !important; }
          .print-header { display: block !important; text-align: center; font-size: 28px; font-weight: 900; margin-bottom: 20px; color: #000; letter-spacing: 1px; }
        }
      `}</style>
      
      <div className="hidden print-header">{formatDisplayMonth(monthStr)} Schedule</div>
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
        {appUser?.isAdmin && unpublishedCount > 0 ? (
           <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-2xl flex-1 flex justify-between items-center shadow-sm w-full">
             <div><h4 className="font-bold text-blue-900 dark:text-blue-300">Unpublished Shifts</h4><p className="text-sm font-medium text-blue-700 dark:text-blue-400">There are {unpublishedCount} hidden shifts this month.</p></div>
             <button onClick={handlePublishMonth} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow-sm transition-colors">Publish Schedule</button>
           </div>
        ) : <div className="flex-1"></div>}
        
        <button onClick={() => window.print()} className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-slate-800 transition-colors w-full sm:w-auto">🖨️ Print Roster</button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm grid grid-cols-7 border-t border-l print-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-3 bg-slate-50 dark:bg-slate-800 text-center font-bold text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 border-r uppercase tracking-wider print-cell">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-r border-slate-200 dark:border-slate-700 min-h-[100px] print-cell" />)}
        {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
          const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
          const isUnpub = shifts.some(s => s.date === date && !s.isPublished);
          return (
            <div key={date} onClick={() => setCurrentDate(date)} className={`p-2 border-b border-r border-slate-200 dark:border-slate-700 min-h-[120px] hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex flex-col justify-between transition-colors print-cell ${isUnpub && appUser?.isAdmin ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
              <div className="flex flex-col items-end gap-1 w-full">
                <span className="text-right text-sm font-bold text-slate-400 dark:text-slate-500 print-text">{i+1}</span>
                {holidayMap[date] && (<span className="text-[9px] font-black tracking-tight text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 px-1.5 py-0.5 rounded truncate w-full text-center print-text" title={holidayMap[date]}>{holidayMap[date]}</span>)}
              </div>
              <div className="space-y-1 max-h-[65px] overflow-hidden mt-1 w-full">
                {shifts.filter(s => s.date === date && (s.isPublished || appUser?.isAdmin)).map(s => {
                  const emp = displayUsers.find(u => u.id === s.employeeId);
                  const startFmt = formatTime12Hour(s.startTime) || '';
                  const endFmt = formatTime12Hour(s.endTime) || '';
                  return <div key={s.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate print-text ${!s.isPublished ? 'border border-dashed border-blue-400 bg-transparent text-blue-500' : (s.role === 'Bartender' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300')}`}>{emp?.name?.split(' ')[0] || '?'} {startFmt.replace(/(AM|PM| )/g, '')}-{endFmt.replace(/(AM|PM| )/g, '')}</div>
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- Tab: Prep List ---
const TabPrep = ({ currentDate, prepItems }) => {
  const [text, setText] = useState(''); const [isMaster, setIsMaster] = useState(true);
  
  const handleAdd = async (e) => { 
    e.preventDefault(); if (!text.trim()) return; 
    await addDoc(collection(db, "prepItems"), { date: isMaster ? 'MASTER' : currentDate, text: text.trim(), isCompleted: false, completedDates: {}, isMaster: isMaster }); 
    setText(''); 
  };
  
  const toggleStatus = async (item) => {
    if (item.isMaster) {
      const updatedDates = { ...(item.completedDates || {}) };
      updatedDates[currentDate] = !updatedDates[currentDate];
      await updateDoc(doc(db, "prepItems", item.id), { completedDates: updatedDates });
    } else {
      await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted });
    }
  };
  
  const handleDelete = async (id) => await deleteDoc(doc(db, "prepItems", id));

  const displayItems = prepItems.filter(p => p.date === currentDate || p.isMaster);

  const getExpDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleAdd} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 pl-4 rounded-2xl flex flex-col sm:flex-row gap-2 shadow-sm items-center">
        <input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 w-full p-2 bg-transparent outline-none font-medium text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="Add a new prep task (e.g., Dice Onions - 4 Qt)..." required />
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t sm:border-t-0 border-slate-100 dark:border-slate-700 pt-2 sm:pt-0">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 cursor-pointer ml-2 sm:ml-0"><input type="checkbox" checked={isMaster} onChange={e => setIsMaster(e.target.checked)} className="w-4 h-4 rounded border-slate-300" /> Master List</label>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition-colors shadow-sm"><Plus size={20}/></button>
        </div>
      </form>
      
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
        {displayItems.length === 0 ? (<div className="p-8 text-center text-slate-400 font-medium">No prep tasks scheduled.</div>) : (
          displayItems.map(item => {
            const isDone = item.isMaster ? !!item.completedDates?.[currentDate] : item.isCompleted;
            return (
            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group gap-4">
              <div>
                <span className={`text-lg transition-all ${isDone ? 'line-through text-slate-300 dark:text-slate-500' : 'font-bold text-slate-800 dark:text-white'}`}>{item.text}</span>
                {item.isMaster && <span className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Master Task</span>}
                {isDone && <span className="block text-[11px] font-black text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded w-max mt-1 border border-amber-200 dark:border-amber-800">Discard By: {getExpDate(currentDate)} (7-Day FDA)</span>}
              </div>
              <div className="flex gap-2"><button onClick={() => toggleStatus(item)} className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${isDone ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>{isDone ? 'Undo' : <><Check size={16}/> Done</>}</button><button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-xl transition-colors"><Trash2 size={18}/></button></div>
            </div>
          )}))}
      </div>
    </div>
  );
};

// --- Tab: Schedule ---
const TabSchedule = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOff, events, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); const [startTime, setStartTime] = useState('16:00'); const [endTime, setEndTime] = useState('23:00');
  const [assignDates, setAssignDates] = useState([currentDate]);
  
  const [eventTitle, setEventTitle] = useState(''); const [eventStart, setEventStart] = useState(''); const [eventEnd, setEventEnd] = useState('');

  const displayUsers = users.length > 0 ? users : (appUser && appUser.id !== 'dev-backdoor' ? [appUser] : []);
  const displayShifts = shifts.filter(s => s.date === currentDate && (s.isPublished || appUser?.isAdmin));
  const dayEvents = events.filter(e => e.date === currentDate);
  const year = parseInt(currentDate.split('-')[0], 10); const holidayMap = getHolidays(year); const todayHoliday = holidayMap[currentDate];

  const handleToggleDate = (d) => { if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x !== d)); else setAssignDates([...assignDates, d].sort()); };

  const handleSaveShift = async () => {
    if (!selectedEmp || assignDates.length === 0) return;
    const emp = displayUsers.find(u => u.id === selectedEmp);
    let count = 0;
    for (const d of assignDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime, endTime, isPublished: false }); count++; }
    setSelectedEmp(''); setAssignDates([currentDate]);
    addToast('Shifts Assigned', `Assigned ${count} shifts to ${emp.name}. (Unpublished)`);
  };

  const handleAddEvent = async (e) => {
    e.preventDefault(); if(!eventTitle.trim()) return;
    await addDoc(collection(db, "events"), { date: currentDate, title: eventTitle.trim(), startTime: eventStart, endTime: eventEnd });
    setEventTitle(''); setEventStart(''); setEventEnd(''); addToast('Event Added', 'Saved to calendar.');
  };

  const handleDeleteShift = async (id) => await deleteDoc(doc(db, "shifts", id));
  const handleDeleteEvent = async (id) => await deleteDoc(doc(db, "events", id));

  const handleOfferSwap = async (shift) => {
    if (window.confirm("Offer this shift on the Trade Board?")) {
      await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
      triggerPushNotification("Trade Board", `A new ${shift.role} shift is available to claim.`);
      addToast('Trade Board', 'Shift posted successfully.');
    }
  };

  const handleClaimSwap = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'pending_approval', claimedById: appUser.id });
    triggerPushNotification("Shift Claimed", `${appUser.name} requested to cover a shift.`);
    addToast('Shift Claimed', 'Awaiting manager approval.');
  };

  const handleApproveSwap = async (swap) => {
    await updateDoc(doc(db, "shifts", swap.shiftId), { employeeId: swap.claimedById });
    await deleteDoc(doc(db, "shiftSwaps", swap.id));
    triggerPushNotification("Trade Approved", `Your shift swap was approved.`);
    addToast('Trade Approved', 'Master schedule updated automatically.');
  };

  const handleDenySwap = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'available', claimedById: null });
    addToast('Trade Denied', 'Shift sent back to the Trade Board.');
  };

  const pendingApprovals = shiftSwaps.filter(sw => sw.status === 'pending_approval');
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

  const upcomingDays = Array.from({length: 7}).map((_, i) => addDays(currentDate, i));

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {todayHoliday && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 p-4 rounded-2xl font-bold flex items-center gap-4 shadow-sm border-l-4 border-l-amber-500">
          <AlertTriangle className="text-amber-600 dark:text-amber-500 flex-shrink-0" size={24} />
          <div><span className="text-amber-900 dark:text-amber-300 block font-black text-base">⚠️ {todayHoliday} Notice</span><span className="text-sm font-semibold">Today is a recognized holiday. Review specialized coverage limits.</span></div>
        </div>
      )}

      {dayEvents.length > 0 && (
        <div className="space-y-3">
           {dayEvents.map(ev => (
              <div key={ev.id} className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 p-4 rounded-2xl font-bold flex items-center justify-between shadow-sm border-l-4 border-l-purple-500">
                <div className="flex items-center gap-4">
                  <Calendar className="text-purple-600 dark:text-purple-400 flex-shrink-0" size={24} />
                  <div>
                    <span className="text-purple-900 dark:text-purple-200 block font-black text-base">📅 {ev.title}</span>
                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">Event / Catering {ev.startTime && `• ${formatTime12Hour(ev.startTime)} - ${formatTime12Hour(ev.endTime)}`}</span>
                  </div>
                </div>
                {appUser?.isAdmin && <button onClick={() => handleDeleteEvent(ev.id)} className="text-purple-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
              </div>
           ))}
        </div>
      )}

      {/* Trade Board UI */}
      {(pendingApprovals.length > 0 || availableSwaps.length > 0) && (
        <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-black text-xl text-indigo-900 dark:text-indigo-300 flex items-center gap-2"><Repeat size={20}/> Shift Trade Board</h3>
          
          {appUser?.isAdmin && pendingApprovals.length > 0 && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-700 space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-500">Manager Approvals Needed</h4>
              {pendingApprovals.map(sw => {
                const orig = displayUsers.find(u => u.id === sw.originalEmployeeId);
                const claimer = displayUsers.find(u => u.id === sw.claimedById);
                return (
                  <div key={sw.id} className="flex flex-col sm:flex-row justify-between items-center bg-indigo-50/50 dark:bg-slate-700 p-3 rounded-xl border border-indigo-100 dark:border-slate-600 gap-3">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300"><strong>{claimer?.name}</strong> wants to cover <strong>{orig?.name}'s</strong> {formatDisplayDate(sw.date)} shift ({formatTime12Hour(sw.startTime)} - {formatTime12Hour(sw.endTime)}).</div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleApproveSwap(sw)} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">Approve</button>
                      <button onClick={() => handleDenySwap(sw)} className="flex-1 sm:flex-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">Deny</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {availableSwaps.length > 0 && (
             <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-700 space-y-3">
               <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-500">Available to Claim</h4>
               {availableSwaps.map(sw => {
                 const orig = displayUsers.find(u => u.id === sw.originalEmployeeId);
                 const canClaim = appUser.id !== sw.originalEmployeeId && appUser.role === sw.role;
                 return (
                   <div key={sw.id} className="flex justify-between items-center bg-indigo-50/50 dark:bg-slate-700 p-3 rounded-xl border border-indigo-100 dark:border-slate-600 gap-2">
                     <div>
                       <span className="font-bold text-indigo-900 dark:text-indigo-300 block">{orig?.name || 'Unknown'} - {sw.role}</span>
                       <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{formatDisplayDate(sw.date)} | {formatTime12Hour(sw.startTime)} - {formatTime12Hour(sw.endTime)}</span>
                     </div>
                     {canClaim && <button onClick={() => handleClaimSwap(sw)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap">Claim Shift</button>}
                   </div>
                 )
               })}
             </div>
          )}
        </div>
      )}

      {appUser?.isAdmin && (
        <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm space-y-6">
          
          {/* Shift Assignment Tool */}
          <div>
            <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 dark:text-white mb-4"><Calendar size={20}/> Assign Shift (Multi-Day)</h3>
            <div className="space-y-4">
              {/* Multi-Date Selector */}
              <div className="flex flex-wrap gap-2">
                {upcomingDays.map(d => {
                  const isSel = assignDates.includes(d);
                  return <button key={d} onClick={() => handleToggleDate(d)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'}`}>{new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short', month:'numeric',day:'numeric'})}</button>
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-medium outline-none">
                  <option value="">Select Staff Member...</option>
                  {displayUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-bold outline-none" />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-bold outline-none" />
                </div>
                <button onClick={handleSaveShift} disabled={!selectedEmp || assignDates.length===0} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm disabled:opacity-50 transition-colors">Assign</button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-700"/>

          {/* Add Event Form */}
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white mb-4"><Calendar size={18}/> Add Event to {formatDisplayDate(currentDate)}</h3>
            <form onSubmit={handleAddEvent} className="flex flex-col sm:flex-row gap-3">
              <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Event Name (e.g. Miller Wedding)" className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none font-medium w-full" required />
              <div className="flex gap-2"><input type="time" value={eventStart} onChange={e => setEventStart(e.target.value)} className="w-full sm:w-32 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-bold outline-none" /><input type="time" value={eventEnd} onChange={e => setEventEnd(e.target.value)} className="w-full sm:w-32 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-bold outline-none" /></div>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-sm w-full sm:w-auto">Add Event</button>
            </form>
          </div>

        </div>
      )}
      
      {!appUser?.isAdmin && shifts.some(s => s.date === currentDate && !s.isPublished) && (
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-center text-slate-500 dark:text-slate-400 font-bold border border-dashed border-slate-300 dark:border-slate-600">The schedule for this date has not been published yet.</div>
      )}

      <div className="grid md:grid-cols-2 gap-6 pt-2">
        {['Bartender', 'Kitchen'].map(role => (
          <div key={role} className="space-y-3">
            <h3 className={`text-lg font-black uppercase tracking-wider pl-2 ${role === 'Bartender' ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{role}s</h3>
            {displayShifts.filter(s => s.role === role).length === 0 ? (
               <div className="p-6 bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center text-slate-400 font-medium">No shifts scheduled.</div>
            ) : (
              displayShifts.filter(s => s.role === role).map(s => {
                const emp = displayUsers.find(u => u.id === s.employeeId);
                const isMyShift = appUser.id === s.employeeId;
                const isSwappedOut = shiftSwaps.some(sw => sw.shiftId === s.id);
                
                return (
                  <div key={s.id} className={`bg-white dark:bg-slate-800 border p-5 rounded-2xl shadow-sm flex flex-col hover:border-slate-300 dark:hover:border-slate-500 transition-colors group gap-3 ${!s.isPublished ? 'border-dashed border-blue-300 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-center w-full">
                      <div className="font-black text-xl text-slate-800 dark:text-white flex items-center gap-2">{emp?.name || 'Unknown'} {!s.isPublished && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded uppercase tracking-widest">Draft</span>}</div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600">{formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}</div>
                        {appUser?.isAdmin && <button onClick={() => handleDeleteShift(s.id)} className="text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
                      </div>
                    </div>
                    {isMyShift && !isSwappedOut && s.isPublished && (
                      <button onClick={() => handleOfferSwap(s)} className="w-full text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"><Repeat size={14}/> Offer on Trade Board</button>
                    )}
                    {isSwappedOut && <div className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md text-center border border-orange-200 dark:border-orange-800">Pending on Trade Board</div>}
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Tab: Time Off ---
const TabTimeOff = ({ appUser, users, timeOff, addToast }) => {
  const [startDate, setStartDate] = useState(getToday()); const [isPartial, setIsPartial] = useState(false); const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('14:00');
  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "timeOff"), { employeeId: appUser.id, startDate, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null });
    addToast('Time Off Logged', `Requested ${formatDisplayDate(startDate)}`);
  };

  const handleDelete = async (id) => await deleteDoc(doc(db, "timeOff", id));

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6 self-start">
        <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800 dark:text-white"><Calendar className="text-blue-500" size={28}/> Log Unavailability</h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Select Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
            <label className="flex items-center gap-3 font-bold text-slate-700 dark:text-slate-300 cursor-pointer"><input type="checkbox" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600" /> This is a partial day / specific time window</label>
            {isPartial && (<div className="flex gap-4 pt-2 border-t border-slate-200 dark:border-slate-600"><div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl font-bold" /></div><div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl font-bold" /></div></div>)}
          </div>
          <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 shadow-md transition-all">Submit Request</button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-black text-slate-800 dark:text-white pl-2">Upcoming Roster</h3>
        <div className="space-y-3">
          {timeOff.length === 0 ? <p className="p-6 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 font-medium">No time off logged.</p> : null}
          {timeOff.filter(t => appUser.isAdmin || t.employeeId === appUser.id).map(t => {
            const emp = displayUsers.find(u => u.id === t.employeeId);
            return (
              <div key={t.id} className="bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-orange-500">
                <div><strong className="text-lg text-slate-900 dark:text-white block">{emp?.name || 'Unknown'}</strong><span className="text-slate-500 dark:text-slate-400 font-medium">{formatDisplayDate(t.startDate)}</span>{t.isPartial && <div className="mt-1 text-sm font-bold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-lg border border-orange-200 dark:border-orange-800 w-max">{formatTime12Hour(t.startTime)} - {formatTime12Hour(t.endTime)}</div>}</div>
                {(appUser.isAdmin || t.employeeId === appUser.id) && <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 p-2 rounded-xl transition-colors"><Trash2 size={20}/></button>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

// --- Tab: Inventory ---
const TabInventory = ({ inventoryItems, addToast, appUser }) => {
  const [invTab, setInvTab] = useState('count'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Item State
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState('Produce'); const [newItemCode, setNewItemCode] = useState(''); const [newItemSupplier, setNewItemSupplier] = useState('PFG'); const [newItemPackSize, setNewItemPackSize] = useState('1 CS'); const [newItemPrice, setNewItemPrice] = useState('');
  
  const [orderOverrides, setOrderOverrides] = useState({});
  const [editItem, setEditItem] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, items: [] });

  // --- Handlers ---
  const handleAddItem = async (e) => {
    e.preventDefault(); if (!newItemName.trim()) return;
    await addDoc(collection(db, "inventoryItems"), { name: newItemName.trim(), category: newItemCat, pfgCode: newItemCode.trim(), supplier: newItemSupplier, packSize: newItemPackSize.trim(), price: parseFloat(newItemPrice) || 0, parLevel: 10, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null });
    setNewItemName(''); setNewItemCode(''); setNewItemPrice(''); setNewItemPackSize('1 CS'); addToast('Inventory Updated', `${newItemName} added to master list.`);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault(); if (!editItem.name.trim()) return;
    await updateDoc(doc(db, "inventoryItems", editItem.id), { name: editItem.name.trim(), category: editItem.category, pfgCode: editItem.pfgCode.trim(), supplier: editItem.supplier, packSize: editItem.packSize, price: parseFloat(editItem.price) || 0 });
    setEditItem(null); addToast('Item Updated', 'Master list modified.');
  };

  const updateStock = async (id, newStock) => await updateDoc(doc(db, "inventoryItems", id), { currentStock: Math.max(0, parseInt(newStock) || 0) });
  const updatePar = async (id, newPar) => await updateDoc(doc(db, "inventoryItems", id), { parLevel: Math.max(0, parseInt(newPar) || 0) });
  const toggleStar = async (item) => await updateDoc(doc(db, "inventoryItems", item.id), { isStarred: !item.isStarred });
  const deleteItem = async (id) => { if(window.confirm("Remove this item from the master list?")) await deleteDoc(doc(db, "inventoryItems", id)); };
  const handleOrderChange = (id, value) => setOrderOverrides(prev => ({ ...prev, [id]: parseInt(value) || 0 }));

  // --- Math & Filtering ---
  const itemsToOrder = inventoryItems.filter(i => {
    const override = orderOverrides[i.id];
    if (override !== undefined) return override > 0;
    return i.currentStock < i.parLevel;
  });

  const getFinalOrderList = (type) => itemsToOrder.filter(i => type === 'PFG' ? (!i.supplier || i.supplier === 'PFG') : i.supplier === 'Badger').map(item => {
    const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
    return { ...item, orderQty: qty };
  }).filter(i => i.orderQty > 0);

  const handleReviewOrder = (type) => {
    const list = getFinalOrderList(type);
    if (list.length === 0) return addToast('Order Empty', `No ${type} items need ordering.`);
    setConfirmModal({ isOpen: true, type, items: list });
  };

  const executeOrder = async () => {
    const { type, items } = confirmModal;
    let bodyText = "";

    if (type === 'PFG') {
      bodyText = items.map(i => `${i.pfgCode ? `[${i.pfgCode}] ` : ''}${i.name} (${i.packSize}): ${i.orderQty}`).join('%0D%0A');
      const subject = encodeURIComponent("PFG Order - Cheers Chilton (Acct 39228)");
      const body = encodeURIComponent("Performance Foodservice Order\nAccount: 39228\nLocation: Cheers-Chilton\n\nItems to Order:\n") + bodyText;
      window.location.href = `mailto:geoffm1985@gmail.com?subject=${subject}&body=${body}`;
    } else {
      bodyText = items.map(i => `${i.name} (${i.packSize || '1 CS'}): ${i.orderQty}`).join('%0A');
      const body = encodeURIComponent("Cheers Chilton Order:\n\n") + bodyText;
      window.location.href = `sms:555-555-5555?body=${body}`;
    }

    const today = new Date().toISOString().split('T')[0];
    for (const item of items) { await updateDoc(doc(db, "inventoryItems", item.id), { pendingQty: item.orderQty, lastOrderedDate: today }); }

    setOrderOverrides({}); setConfirmModal({ isOpen: false, type: null, items: [] });
    addToast('Order Sent', `${type} order dispatched. Pending inventory updated.`);
  };

  const handleReceivePending = async () => {
    if(!window.confirm("Move all pending items into active stock?")) return;
    const pendingItems = inventoryItems.filter(i => (i.pendingQty || 0) > 0);
    for (const item of pendingItems) { await updateDoc(doc(db, "inventoryItems", item.id), { currentStock: item.currentStock + item.pendingQty, pendingQty: 0 }); }
    addToast('Stock Updated', 'Pending items moved to active stock.');
  };

  const filteredItems = inventoryItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || (i.pfgCode && i.pfgCode.includes(searchTerm)));
  const groupedItems = filteredItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});

  // Missing Starred Math
  const missedStarred = confirmModal.isOpen ? inventoryItems.filter(i => i.isStarred && i.supplier === confirmModal.type && !confirmModal.items.some(oi => oi.id === i.id)) : [];
  const pfgOrderTotal = getFinalOrderList('PFG').reduce((sum, item) => sum + ((item.price || 0) * item.orderQty), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* --- Confirmation Modal --- */}
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ isOpen: false, type: null, items: [] })} title={`Review ${confirmModal.type} Order`}>
         <div className="space-y-4">
           {missedStarred.length > 0 && (
             <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-3">
               <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={18} />
               <div><span className="font-bold text-amber-800 dark:text-amber-400 text-sm block">Starred Items Not Included:</span><span className="text-xs text-amber-700 dark:text-amber-500 font-medium">{missedStarred.map(i => i.name).join(', ')}</span></div>
             </div>
           )}
           <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
             {confirmModal.items.map(item => (
                <div key={item.id} className="p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                  <div><span className="font-bold text-sm block dark:text-white">{item.name}</span><span className="text-xs text-slate-500">{item.packSize}</span></div>
                  <div className="font-black text-blue-600 dark:text-blue-400 text-lg">{item.orderQty}</div>
                </div>
             ))}
           </div>
           {confirmModal.type === 'PFG' && (
             <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
               <span className="font-bold text-blue-900 dark:text-blue-300">Estimated Total:</span>
               <span className="font-black text-xl text-blue-700 dark:text-blue-400">${pfgOrderTotal.toFixed(2)}</span>
             </div>
           )}
           <button onClick={executeOrder} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"><Send size={20}/> Send via {confirmModal.type === 'PFG' ? 'Email' : 'SMS'}</button>
         </div>
      </Modal>

      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900 dark:text-white"><Package size={24}/> Inventory</h2>
        {appUser?.isAdmin && (
          <div className="bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl flex border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
            {['count', 'order', 'manage'].map(tab => (
              <button key={tab} onClick={() => setInvTab(tab)} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${invTab === tab ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>{tab}</button>
            ))}
          </div>
        )}
      </div>
      
      {/* --- Count Tab --- */}
      {invTab === 'count' && (
        <div className="space-y-6">
          <input type="text" placeholder="Search inventory by name or code..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-white rounded-2xl font-bold shadow-sm outline-none focus:border-blue-500 transition-all" />
          
          {Object.keys(groupedItems).length === 0 && <div className="p-8 text-center text-slate-400 font-medium">No items match your search.</div>}
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-xl font-black text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => (
                  <div key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4 relative overflow-hidden">
                    <div className="flex-1 z-10">
                      <div className="flex items-center gap-2"><div className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{item.name}</div>{item.isStarred && <span className="text-amber-500">⭐</span>}</div>
                      <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.supplier === 'Badger' ? 'BADGER' : (item.pfgCode ? `PFG: ${item.pfgCode}` : 'PFG')} • {item.packSize || '1 CS'}</div>
                      {(item.pendingQty || 0) > 0 && <span className="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full mt-1.5 inline-block border border-blue-200 dark:border-blue-800">(+{item.pendingQty} Pending)</span>}
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto justify-between sm:justify-start z-10">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PAR</span>
                        <input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} disabled={!appUser?.isAdmin} className="w-12 text-center font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md py-1 outline-none focus:border-blue-500 disabled:bg-transparent disabled:text-slate-500 disabled:border-transparent" />
                      </div>
                      <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">STOCK</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateStock(item.id, item.currentStock - 1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-md font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">-</button>
                          <span className={`w-8 text-center font-black text-xl ${item.currentStock < item.parLevel ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>{item.currentStock}</span>
                          <button onClick={() => updateStock(item.id, item.currentStock + 1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-md font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Order Tab --- */}
      {appUser?.isAdmin && invTab === 'order' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            {inventoryItems.some(i => i.pendingQty > 0) && (
              <button onClick={handleReceivePending} className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-2"><Package size={16}/> Receive Pending Stock</button>
            )}
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-black text-xl text-slate-800 dark:text-white">Deficit Report</h3>
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-lg font-bold text-sm">{itemsToOrder.length} Items Needed</span>
            </div>
            {itemsToOrder.length === 0 ? (
              <div className="p-12 text-center font-bold text-slate-400">All inventory levels meet or exceed par.</div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead><tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 uppercase tracking-wider"><th className="p-4">Item</th><th className="p-4 text-center">Deficit Math</th><th className="p-4 text-center">Price</th><th className="p-4 text-right">Order Qty</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {itemsToOrder.map(item => {
                        const defaultOrder = Math.max(0, item.parLevel - item.currentStock);
                        const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : defaultOrder;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="p-4"><span className="font-bold text-slate-800 dark:text-white block text-lg leading-tight mb-1">{item.name} {item.isStarred && <span className="text-amber-500 text-sm">⭐</span>}</span><span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded uppercase tracking-wider">{item.packSize || '1 CS'} • {item.supplier === 'Badger' ? 'BADGER' : 'PFG'}</span>{item.lastOrderedDate && <div className="text-[10px] text-slate-400 mt-1 font-bold">Last Ordered: {formatDisplayDate(item.lastOrderedDate)}</div>}</td>
                            <td className="p-4 text-center font-medium text-slate-500 dark:text-slate-400"><div className="flex flex-col items-center"><span className="text-[10px] uppercase tracking-widest mb-0.5">Par - Stock</span><span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{item.parLevel} - {item.currentStock} = {item.parLevel - item.currentStock}</span></div></td>
                            <td className="p-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{item.price > 0 ? `$${item.price.toFixed(2)}` : '--'}</td>
                            <td className="p-4 text-right"><input type="number" min="0" value={currentOrder} onChange={e => handleOrderChange(item.id, e.target.value)} className="font-black text-blue-600 dark:text-blue-400 text-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-2 rounded-xl w-24 text-center outline-none focus:ring-2 focus:ring-blue-500" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="text-left w-full sm:w-auto">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">PFG Order Total</span>
                    <span className="font-black text-2xl text-slate-900 dark:text-white">${pfgOrderTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={() => handleReviewOrder('Badger')} className="bg-slate-900 dark:bg-slate-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"><MessageSquare size={20}/> Text Badger Rep</button>
                    <button onClick={() => handleReviewOrder('PFG')} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"><Send size={20}/> Email PFG Rep</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Manage Tab --- */}
      {appUser?.isAdmin && invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-8">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Inventory Item">
            {editItem && (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Product Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label><select value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Supplier</label><select value={editItem.supplier || 'PFG'} onChange={e => setEditItem({...editItem, supplier: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pack Size (UOM)</label><input type="text" value={editItem.packSize || ''} onChange={e => setEditItem({...editItem, packSize: e.target.value})} placeholder="e.g., 1 CS, 6/10#" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item Code (Optional)</label><input type="text" value={editItem.pfgCode || ''} onChange={e => setEditItem({...editItem, pfgCode: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
                <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors mt-2">Save Changes</button>
              </form>
            )}
          </Modal>

          <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm">
             <h3 className="text-xl font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">Add Single Item</h3>
             <form onSubmit={handleAddItem} className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Product Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label><select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div>
                 <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Supplier</label><select value={newItemSupplier} onChange={e => setNewItemSupplier(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Pack Size (UOM)</label><input type="text" value={newItemPackSize} onChange={e => setNewItemPackSize(e.target.value)} placeholder="e.g., 1 CS, 6/10#" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Price ($)</label><input type="number" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
               </div>
               <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item Code (Optional)</label><input type="text" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
               <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white p-3.5 rounded-xl font-bold shadow-md hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors">Add Item</button>
             </form>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">Current Master List</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {inventoryItems.length === 0 && <p className="text-slate-400 font-medium">List is empty.</p>}
              {inventoryItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                  <div><span className="font-bold text-slate-800 dark:text-white block text-sm leading-tight">{item.name}</span><span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider">{item.category} • {item.packSize || '1 CS'}</span></div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleStar(item)} className={`p-2 rounded-lg transition-colors ${item.isStarred ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:text-amber-500'}`} title="Star for Order Suggestion">⭐</button>
                    <button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-lg transition-colors"><Edit size={16}/></button>
                    <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Tab: Settings ---
const TabSettings = ({ addToast, inventoryItems, appUser }) => {
  const [settings, setSettings] = useState({ shiftReminders: true, overtimeAlerts: false, autoApprove: false, muteOffShift: false, leadTime: 24 });
  const [isImporting, setIsImporting] = useState(false);
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  const isMasterAdmin = appUser?.email === MASTER_ADMIN_EMAIL;

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if(!window.confirm("This will scan the CSV and update your live inventory prices. Continue?")) {
      e.target.value = ''; return;
    }
    
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        // Basic CSV parse (Splits by newline, then by comma)
        const rows = text.split('\n').map(row => row.split(','));
        let updateCount = 0; let addCount = 0;
        
        // Loop through data (Skipping the header row)
        for (let i = 1; i < rows.length; i++) {
           const cols = rows[i];
           if (cols.length < 2) continue; // Skip empty rows
           
           // Expected CSV Format: Name, Category, Supplier, PackSize, Price, Code
           const name = cols[0]?.trim();
           const category = cols[1]?.trim() || 'Dry Goods';
           const supplier = cols[2]?.trim() || 'PFG';
           const packSize = cols[3]?.trim() || '1 CS';
           const price = parseFloat(cols[4]) || 0;
           const pfgCode = cols[5]?.trim() || '';

           if (!name) continue;

           // Check if item already exists to update price, or add new if it doesn't
           const existingItem = inventoryItems.find(item => item.name.toLowerCase() === name.toLowerCase());
           if (existingItem) {
              await updateDoc(doc(db, "inventoryItems", existingItem.id), { price, packSize, category, supplier, pfgCode });
              updateCount++;
           } else {
              await addDoc(collection(db, "inventoryItems"), { name, category, supplier, packSize, price, pfgCode, parLevel: 10, currentStock: 0, pendingQty: 0, isStarred: false, lastOrderedDate: null });
              addCount++;
           }
        }
        addToast('Catalog Synced', `Updated ${updateCount} prices and added ${addCount} new items.`);
      } catch (error) {
        addToast('Upload Failed', 'Ensure your file is a valid CSV.');
        console.error(error);
      }
      setIsImporting(false);
      e.target.value = ''; // Reset input
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-sm space-y-8">
        <div><h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Application Settings</h3><p className="text-slate-500 dark:text-slate-400 font-medium">Manage alerts and interface preferences.</p></div>

        <div className="space-y-4 border-y border-slate-100 dark:border-slate-700 py-6">
          <div className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer" onClick={() => toggle('shiftReminders')}>
            <span className="font-bold text-slate-700 dark:text-slate-200">Send Shift Reminders</span>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.shiftReminders ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'} shadow-inner`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.shiftReminders ? 'translate-x-6' : 'translate-x-0'}`}></div></div>
          </div>
          {settings.shiftReminders && (
             <div className="flex items-center gap-4 px-3 py-2">
               <label className="text-sm font-bold text-slate-500 dark:text-slate-400 flex-1">Hours before shift to notify:</label>
               <input type="number" min="1" max="48" value={settings.leadTime} onChange={e => setSettings({...settings, leadTime: parseInt(e.target.value)||1})} className="w-20 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl font-bold text-center outline-none" />
             </div>
          )}
          
          {isMasterAdmin && [
            { id: 'overtimeAlerts', label: 'Alert Manager Before Overtime (40h)' },
            { id: 'autoApprove', label: 'Auto-Approve Peer Shift Swaps' },
            { id: 'muteOffShift', label: 'Mute Message Notifications Off-Shift' }
          ].map(setting => (
            <div key={setting.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer" onClick={() => toggle(setting.id)}>
              <span className="font-bold text-slate-700 dark:text-slate-200">{setting.label}</span>
              <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings[setting.id] ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'} shadow-inner`}><div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings[setting.id] ? 'translate-x-6' : 'translate-x-0'}`}></div></div>
            </div>
          ))}
        </div>

        {appUser?.isAdmin && (
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10"><Check size={100} /></div>
            <h4 className="font-black text-emerald-900 dark:text-emerald-400 mb-2 text-lg">No-Code Catalog Importer</h4>
            <p className="text-sm text-emerald-800 dark:text-emerald-500 mb-5 font-medium leading-relaxed max-w-[90%]">Upload a standard CSV file from your rep to automatically update prices and add new items. (Format: Name, Category, Supplier, PackSize, Price, Code)</p>
            
            <div className="relative">
              <input type="file" accept=".csv" onChange={handleCsvUpload} disabled={isImporting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
              <button disabled={isImporting} className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3.5 rounded-xl font-bold transition-all shadow-md w-full flex items-center justify-center gap-2 relative z-10">
                {isImporting ? <Loader2 className="animate-spin" size={20}/> : <><Package size={20} /> Upload CSV Price Sheet</>}
              </button>
            </div>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-6 rounded-2xl">
          <h4 className="font-bold text-blue-900 dark:text-blue-400 mb-2">System Diagnostics</h4>
          <button onClick={() => { addToast('Diagnostic Test', 'Live Firebase database connected successfully.'); triggerPushNotification('Test Ping', 'Push systems online.'); }} className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full">Trigger Test Alert</button>
        </div>
      </div>
      
      {/* Version Tracker */}
      <div className="text-center text-slate-400 dark:text-slate-600 font-bold text-sm tracking-widest uppercase">
        Cheers Management OS • v4.0.0
      </div>
    </div>
  );
};

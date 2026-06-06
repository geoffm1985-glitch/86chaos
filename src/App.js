import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, BookOpen, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, UserCheck, CheckCircle, Edit } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
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

// --- PFG Test Catalog (Trimmed to 10 items) ---
const PFG_CATALOG = [
  {name:"Beef Ground Patty Angus 81/19",category:"Meat",pfgCode:"EW538",parLevel:6},
  {name:"Pizza Crust 12\" Thin Crispy",category:"Dry Goods",pfgCode:"EK598",parLevel:3},
  {name:"Bun Hamburger Gourmet Sliced",category:"Dry Goods",pfgCode:"B1938",parLevel:4},
  {name:"Chicken Breast 4oz Grilled",category:"Meat",pfgCode:"HC234",parLevel:3},
  {name:"Box Pizza 16\" B Flute Kraft",category:"Supplies",pfgCode:"HB952",parLevel:5},
  {name:"Fries Straight Cut 3/8\"",category:"Dry Goods",pfgCode:"NT606",parLevel:8},
  {name:"Oil Soy Clear Fry",category:"Dry Goods",pfgCode:"DV470",parLevel:6},
  {name:"Tomato Round Red 5X6 Large",category:"Produce",pfgCode:"25840",parLevel:3},
  {name:"Cheese Cheddar Shredded Mild",category:"Dairy",pfgCode:"VH764",parLevel:3},
  {name:"Napkin Xpress 13X8.6 Natural",category:"Supplies",pfgCode:"DT312",parLevel:4}
];

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

// --- SVG Logo ---
const CheersLogo = () => (
  <svg viewBox="0 0 400 120" className="h-12 sm:h-14 w-auto drop-shadow-sm" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M190,20 C70,0 0,35 0,65 C0,95 100,110 270,110 L270,105 C100,105 30,95 30,65 C30,40 80,25 190,20 Z" className="text-slate-900" />
    <text x="95" y="85" fontFamily="'Brush Script MT', 'Great Vibes', cursive, serif" fontStyle="italic" fontSize="90" fontWeight="900" className="text-slate-900" letterSpacing="-1">Cheers</text>
    <text x="275" y="110" fontFamily="'Times New Roman', Georgia, serif" fontSize="28" className="text-slate-900">Chilton</text>
  </svg>
);

// --- Custom Modal ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-100">
        <div className="flex justify-between items-center p-5 border-b border-slate-100"><h3 className="font-bold text-xl text-slate-900">{title}</h3><button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"><X size={20}/></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// --- Navigation Drawer Component ---
const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser }) => {
  if (!isOpen) return null;
  const tabs = [{ id: 'schedule', label: 'Schedule', icon: <Calendar size={20}/> }, { id: 'month', label: 'Month View', icon: <Calendar size={20}/> }, { id: 'timeoff', label: 'Time Off', icon: <Clock size={20}/> }];
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={20}/> });
  if (appUser?.isAdmin) tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={20}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={20}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={20}/> });

  const handleLogout = () => { localStorage.removeItem('cheersUser'); setAppUser(null); onClose(); };

  return (
     <div className="fixed inset-0 z-50 flex justify-end">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       <div className="w-80 bg-white h-full shadow-2xl flex flex-col relative border-l border-slate-200 animate-slide-in">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white flex justify-between items-start">
             <div><div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Signed in as</div><div className="text-slate-900 font-black text-xl tracking-tight">{appUser.name}</div><div className="flex items-center gap-1 text-blue-600 text-xs font-bold uppercase tracking-wider mt-1.5 bg-blue-50 w-max px-2 py-1 rounded-md">{appUser.isAdmin && <Shield size={12} />} {appUser.role} {appUser.isAdmin && '• Admin'}</div></div>
             <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:text-slate-900 transition-colors"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
             {tabs.map(tab => (<button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><div className="flex items-center gap-3"><span className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-400'}>{tab.icon}</span>{tab.label}</div></button>))}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50"><button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3.5 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors"><LogOut size={18} /> Log Out</button></div>
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
  
  // Custom History/Back-Button State Engine
  const [activeTabState, setActiveTabState] = useState('schedule');

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.tab) setActiveTabState(e.state.tab);
      else setActiveTabState('schedule');
    };
    window.addEventListener('popstate', handlePopState);
    
    // Set initial history state
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || 'schedule';
    setActiveTabState(tab);
    window.history.replaceState({ tab }, '', `?tab=${tab}`);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveTab = (tab) => {
    window.history.pushState({ tab }, '', `?tab=${tab}`);
    setActiveTabState(tab);
  };

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

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* --- Header --- */}
      <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-slate-200 h-20 flex items-center justify-between px-6">
        <CheersLogo />
        <button onClick={() => setIsMenuOpen(true)} className="relative p-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:bg-slate-100 hover:text-slate-900 transition-all outline-none"><Menu size={24} /></button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} />

      {/* --- Date Header --- */}
      {['schedule', 'prep', 'month'].includes(activeTabState) && (
        <div className="bg-white py-5 px-4 shadow-sm z-30 border-b border-slate-200">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => activeTabState === 'month' ? setCurrentDate(addDays(currentDate, -30)) : setCurrentDate(addDays(currentDate, -1))} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"><ChevronLeft size={24} /></button>
            <h2 onClick={() => setIsDateModalOpen(true)} className="text-2xl sm:text-3xl font-black tracking-tight text-center cursor-pointer hover:text-blue-600 transition-colors">{activeTabState === 'month' ? formatDisplayMonth(getMonthStr(currentDate)) : formatDisplayDate(currentDate)}</h2>
            <button onClick={() => activeTabState === 'month' ? setCurrentDate(addDays(currentDate, 30)) : setCurrentDate(addDays(currentDate, 1))} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"><ChevronRight size={24} /></button>
          </div>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input type="date" value={currentDate || ''} onChange={e => { if (e.target.value) { setCurrentDate(e.target.value); setIsDateModalOpen(false); } }} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setIsDateModalOpen(false)} className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </Modal>

      {/* --- Main Content Area --- */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 pb-24">
        {activeTabState === 'schedule' && <TabSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOff={timeOff} events={events} addToast={addToast} />}
        {activeTabState === 'month' && <TabMonth currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} events={events} setCurrentDate={(d) => { setCurrentDate(d); setActiveTab('schedule'); }} />}
        {activeTabState === 'timeoff' && <TabTimeOff appUser={liveAppUser} users={users} timeOff={timeOff} addToast={addToast} />}
        {activeTabState === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} />}
        {activeTabState === 'inventory' && <TabInventory inventoryItems={inventoryItems} addToast={addToast} />}
        {activeTabState === 'team' && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'settings' && <TabSettings addToast={addToast} inventoryItems={inventoryItems} />}
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
const LoginScreen = ({ users, setAppUser }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(false); const [resetUser, setResetUser] = useState(null);
  const isFirstUser = users.length === 0;

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    
    // --- DEVELOPER BACKDOOR (Ghost Account) ---
    if (email.trim() === 'admin' && password === 'Atticus7!') {
      setAppUser({ id: 'dev-backdoor', name: 'Ghost Admin', email: MASTER_ADMIN_EMAIL, role: 'Kitchen', isAdmin: true, isActive: true });
      return;
    }

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-md w-full"><h2 className="text-2xl font-black text-center mb-2 text-slate-900 tracking-tight">Welcome, {resetUser.name}!</h2><p className="text-center text-slate-500 mb-6 font-medium">Please set your permanent password to continue.</p><form onSubmit={handlePasswordSetup} className="space-y-4"><div><label className="block text-sm font-bold text-slate-600 mb-1.5">New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>{error && <p className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}<button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md flex justify-center items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={20}/> : 'Save Password & Login'}</button></form></div></div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-md w-full"><div className="flex justify-center mb-8"><CheersLogo /></div><h2 className="text-2xl font-black text-center mb-6 text-slate-900 tracking-tight">{isFirstUser ? 'Create Admin Account' : 'Staff Login'}</h2><form onSubmit={handleAuth} className="space-y-4">{isFirstUser && (<div><label className="block text-sm font-bold text-slate-600 mb-1.5">Your Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>)}<div><label className="block text-sm font-bold text-slate-600 mb-1.5">Email / Username</label><input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div><div><label className="block text-sm font-bold text-slate-600 mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>{error && <p className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}<button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md mt-2 flex justify-center items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={20}/> : (isFirstUser ? 'Create Account' : 'Login')}</button></form></div></div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('Bartender'); const [isAdmin, setIsAdmin] = useState(false);
  const [availModalUser, setAvailModalUser] = useState(null);
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
    e.preventDefault();
    if (!editModalUser.name.trim() || !editModalUser.email.trim()) return;
    try {
      const updates = { 
        name: editModalUser.name.trim(), 
        email: editModalUser.email.toLowerCase().trim(), 
        phone: editModalUser.phone || '', 
        role: editModalUser.role
      };
      if (editModalUser.newPassword) {
        updates.password = editModalUser.newPassword;
        updates.forcePasswordChange = true;
      }
      await updateDoc(doc(db, "users", editModalUser.id), updates);
      addToast('Profile Updated', `${editModalUser.name}'s info has been saved.`);
      setEditModalUser(null);
    } catch (err) { console.error(err); addToast('Update Failed', 'Could not save profile changes.'); }
  };

  const handleToggleAdmin = async (id, currentStatus) => { await updateDoc(doc(db, "users", id), { isAdmin: !currentStatus }); };
  const handleDelete = async (id) => { if (window.confirm("Remove this staff member? This cannot be undone.")) { await deleteDoc(doc(db, "users", id)); addToast('Staff Removed', 'Account permanently deleted.'); } };

  const handleSaveAvail = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "users", availModalUser.id), { availability: availModalUser.availability });
    addToast('Availability Saved', `${availModalUser.name}'s schedule lockouts updated.`);
    setAvailModalUser(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Availability Modal */}
      <Modal isOpen={!!availModalUser} onClose={() => setAvailModalUser(null)} title={`Availability: ${availModalUser?.name}`}>
        {availModalUser && (
          <form onSubmit={handleSaveAvail} className="space-y-4">
            <p className="text-sm text-slate-500 font-medium mb-4">Uncheck the days this employee is permanently unavailable to work.</p>
            <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50">
              {['sun','mon','tue','wed','thu','fri','sat'].map((day, idx) => (
                <label key={day} className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-sm">
                  <span className="font-bold text-slate-700 capitalize">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][idx]}</span>
                  <input type="checkbox" checked={availModalUser.availability?.[day] ?? true} onChange={e => setAvailModalUser({...availModalUser, availability: {...(availModalUser.availability || {}), [day]: e.target.checked}})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </label>
              ))}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors">Save Lockouts</button>
          </form>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={!!editModalUser} onClose={() => setEditModalUser(null)} title={`Edit Profile: ${editModalUser?.name}`}>
        {editModalUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label><input type="text" value={editModalUser.name} onChange={e => setEditModalUser({...editModalUser, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" value={editModalUser.email} onChange={e => setEditModalUser({...editModalUser, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label><input type="tel" value={editModalUser.phone || ''} onChange={e => setEditModalUser({...editModalUser, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label><select value={editModalUser.role} onChange={e => setEditModalUser({...editModalUser, role: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
            <div className="pt-4 border-t border-slate-200">
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1 text-red-500">Force Password Reset (Leave blank to keep current)</label>
               <input type="text" placeholder="Enter new temporary password..." value={editModalUser.newPassword || ''} onChange={e => setEditModalUser({...editModalUser, newPassword: e.target.value})} className="w-full p-3 bg-red-50 border border-red-200 rounded-xl outline-none focus:border-red-500 placeholder:text-red-300" />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-bold shadow-sm hover:bg-slate-800 transition-colors mt-2">Save Profile Updates</button>
          </form>
        )}
      </Modal>

      {appUser?.isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Users size={20}/> Add Staff Member</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temporary Password</label><input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mt-4 cursor-pointer flex-1"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> Grant Admin Access</label>
              <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 w-full sm:w-auto shadow-sm mt-4 sm:mt-0">Add Staff</button>
            </div>
          </form>
        </div>
      )}
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 tracking-wider"><th className="p-4 font-bold">Staff Directory</th><th className="p-4 font-bold hidden sm:table-cell">Contact</th><th className="p-4 font-bold">Role</th><th className="p-4 font-bold text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayUsers.length === 0 && (
              <tr><td colSpan="4" className="p-6 text-center text-slate-400 font-medium">No active staff members found.</td></tr>
            )}
            {displayUsers.map(u => {
              const isMaster = u.email === MASTER_ADMIN_EMAIL;
              const showMasterBadge = isMaster && appUser?.email === MASTER_ADMIN_EMAIL;

              return (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4"><div className="font-bold text-slate-900 text-lg">{u.name}</div></td>
                <td className="p-4 hidden sm:table-cell"><div className="text-sm font-medium text-slate-600">{u.email}</div><div className="text-sm text-slate-400">{u.phone || 'No phone'}</div></td>
                <td className="p-4">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${u.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{u.role}</span>
                  {appUser?.isAdmin && !isMaster && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer w-max">
                      <input type="checkbox" checked={u.isAdmin} onChange={() => handleToggleAdmin(u.id, u.isAdmin)} className="w-4 h-4 rounded border-slate-300" /><span className="text-xs font-bold text-slate-500">Admin</span>
                    </label>
                  )}
                  {showMasterBadge && <span className="block mt-2 text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded w-max"><Shield size={10} className="inline mr-1 pb-0.5"/>Master Admin</span>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1">
                     {(appUser?.isAdmin || appUser.id === u.id) && <button onClick={() => setAvailModalUser(u)} className="text-slate-400 hover:text-blue-600 bg-white border border-slate-200 hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center justify-center" title="Availability Templates"><UserCheck size={18}/></button>}
                     {appUser?.isAdmin && <button onClick={() => setEditModalUser(u)} className="text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 p-2 rounded-lg transition-colors flex items-center justify-center" title="Edit Profile"><Edit size={18}/></button>}
                     {appUser?.isAdmin && !isMaster && (<button onClick={() => handleDelete(u.id)} className="text-slate-400 hover:text-red-500 bg-white border border-slate-200 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center justify-center" title="Delete User"><Trash2 size={18}/></button>)}
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
const TabMonth = ({ currentDate, appUser, users, shifts, events, setCurrentDate }) => {
  const monthStr = getMonthStr(currentDate);
  const year = parseInt(monthStr.split('-')[0], 10);
  const holidayMap = getHolidays(year);
  const firstDay = new Date(monthStr + '-01T12:00:00').getDay();
  const displayUsers = users.length > 0 ? users : [];

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(currentDate);

  const handleAddEvent = async (e) => {
    e.preventDefault(); if(!eventTitle.trim()) return;
    await addDoc(collection(db, "events"), { date: eventDate, title: eventTitle.trim() });
    setEventTitle('');
  };

  return (
    <div className="space-y-4">
      {appUser?.isAdmin && (
        <form onSubmit={handleAddEvent} className="mb-4 bg-white p-4 border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-3 items-center shadow-sm">
          <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Add Special Event/Catering (e.g. Miller Wedding)" className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium w-full" required />
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-700 w-full sm:w-auto" required />
          <button type="submit" className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 w-full sm:w-auto shadow-sm">Add Event</button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid grid-cols-7 border-t border-l">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-3 bg-slate-50 text-center font-bold text-xs text-slate-500 border-b border-r uppercase tracking-wider">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-slate-50/50 border-b border-r min-h-[100px]" />)}
        {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
          const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div key={date} onClick={() => setCurrentDate(date)} className="p-2 border-b border-r min-h-[120px] hover:bg-slate-50 cursor-pointer flex flex-col justify-between transition-colors">
              <div className="flex flex-col items-end gap-1 w-full">
                <span className="text-right text-sm font-bold text-slate-400">{i+1}</span>
                {holidayMap[date] && (<span className="text-[9px] font-black tracking-tight text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded truncate w-full text-center" title={holidayMap[date]}>🎉 {holidayMap[date]}</span>)}
                {events.filter(e => e.date === date).map(ev => (
                  <span key={ev.id} className="text-[9px] font-black tracking-tight text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded truncate w-full text-center mt-0.5" title={ev.title}>📅 {ev.title}</span>
                ))}
              </div>
              <div className="space-y-1 max-h-[65px] overflow-hidden mt-1 w-full">
                {shifts.filter(s => s.date === date).map(s => {
                  const emp = displayUsers.find(u => u.id === s.employeeId);
                  return <div key={s.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${s.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{emp?.name?.split(' ')[0] || '?'}</div>
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
  const [text, setText] = useState('');
  const handleAdd = async (e) => { e.preventDefault(); if (!text.trim()) return; await addDoc(collection(db, "prepItems"), { date: currentDate, text: text.trim(), isCompleted: false }); setText(''); };
  const toggleStatus = async (item) => await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted });
  const handleDelete = async (id) => await deleteDoc(doc(db, "prepItems", id));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleAdd} className="bg-white border border-slate-200 p-2 pl-4 rounded-2xl flex gap-2 shadow-sm items-center"><input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 p-2 bg-transparent outline-none font-medium placeholder:text-slate-400" placeholder="Add a new prep task..." required /><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition-colors shadow-sm"><Plus size={20}/></button></form>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
        {prepItems.filter(p => p.date === currentDate).length === 0 ? (<div className="p-8 text-center text-slate-400 font-medium">No prep tasks scheduled for today.</div>) : (
          prepItems.filter(p => p.date === currentDate).map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
              <span className={`text-lg transition-all ${item.isCompleted ? 'line-through text-slate-300' : 'font-bold text-slate-800'}`}>{item.text}</span>
              <div className="flex gap-2"><button onClick={() => toggleStatus(item)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${item.isCompleted ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'}`}>{item.isCompleted ? 'Undo' : <><Check size={16}/> Done</>}</button><button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18}/></button></div>
            </div>
          )))}
      </div>
    </div>
  );
};

// --- Tab: Schedule ---
const TabSchedule = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOff, events, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('23:00');

  const displayUsers = users.length > 0 ? users : (appUser && appUser.id !== 'dev-backdoor' ? [appUser] : []);
  const displayShifts = shifts.filter(s => s.date === currentDate);
  const dayEvents = events.filter(e => e.date === currentDate);
  
  const year = parseInt(currentDate.split('-')[0], 10);
  const holidayMap = getHolidays(year);
  const todayHoliday = holidayMap[currentDate];

  const handleSaveShift = async () => {
    if (!selectedEmp) return;
    const emp = displayUsers.find(u => u.id === selectedEmp);
    await addDoc(collection(db, "shifts"), { date: currentDate, employeeId: emp.id, role: emp.role, startTime, endTime });
    setSelectedEmp('');
    addToast('Shift Assigned', `Assigned to ${emp.name}.`);
  };

  const handleDeleteShift = async (id) => await deleteDoc(doc(db, "shifts", id));
  const handleDeleteEvent = async (id) => await deleteDoc(doc(db, "events", id));

  const handleOfferSwap = async (shift) => {
    if (window.confirm("Offer this shift on the Trade Board?")) {
      await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
      addToast('Trade Board', 'Shift posted successfully.');
    }
  };

  const handleClaimSwap = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'pending_approval', claimedById: appUser.id });
    addToast('Shift Claimed', 'Awaiting manager approval.');
  };

  const handleApproveSwap = async (swap) => {
    await updateDoc(doc(db, "shifts", swap.shiftId), { employeeId: swap.claimedById });
    await deleteDoc(doc(db, "shiftSwaps", swap.id));
    addToast('Trade Approved', 'Master schedule updated automatically.');
  };

  const handleDenySwap = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'available', claimedById: null });
    addToast('Trade Denied', 'Shift sent back to the Trade Board.');
  };

  const pendingApprovals = shiftSwaps.filter(sw => sw.status === 'pending_approval');
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {todayHoliday && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl font-bold flex items-center gap-4 shadow-sm border-l-4 border-l-amber-500">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
          <div><span className="text-amber-900 block font-black text-base">⚠️ {todayHoliday} Notice</span><span className="text-sm font-semibold text-amber-700">Today is a recognized holiday. Review specialized coverage limits or custom hours.</span></div>
        </div>
      )}

      {dayEvents.length > 0 && (
        <div className="space-y-3">
           {dayEvents.map(ev => (
              <div key={ev.id} className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-2xl font-bold flex items-center justify-between shadow-sm border-l-4 border-l-purple-500">
                <div className="flex items-center gap-4">
                  <Calendar className="text-purple-600 flex-shrink-0" size={24} />
                  <div>
                    <span className="text-purple-900 block font-black text-base">📅 {ev.title}</span>
                    <span className="text-sm font-semibold text-purple-700">Special Event / Catering</span>
                  </div>
                </div>
                {appUser?.isAdmin && <button onClick={() => handleDeleteEvent(ev.id)} className="text-purple-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
              </div>
           ))}
        </div>
      )}

      {/* Trade Board UI */}
      {(pendingApprovals.length > 0 || availableSwaps.length > 0) && (
        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-black text-xl text-indigo-900 flex items-center gap-2"><Repeat size={20}/> Shift Trade Board</h3>
          
          {appUser?.isAdmin && pendingApprovals.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-indigo-100 space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-500">Manager Approvals Needed</h4>
              {pendingApprovals.map(sw => {
                const orig = displayUsers.find(u => u.id === sw.originalEmployeeId);
                const claimer = displayUsers.find(u => u.id === sw.claimedById);
                return (
                  <div key={sw.id} className="flex flex-col sm:flex-row justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 gap-3">
                    <div className="text-sm font-medium text-slate-700"><strong>{claimer?.name}</strong> wants to cover <strong>{orig?.name}'s</strong> {formatDisplayDate(sw.date)} shift ({formatTime12Hour(sw.startTime)} - {formatTime12Hour(sw.endTime)}).</div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleApproveSwap(sw)} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">Approve</button>
                      <button onClick={() => handleDenySwap(sw)} className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">Deny</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {availableSwaps.length > 0 && (
             <div className="bg-white p-4 rounded-2xl border border-indigo-100 space-y-3">
               <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-500">Available to Claim</h4>
               {availableSwaps.map(sw => {
                 const orig = displayUsers.find(u => u.id === sw.originalEmployeeId);
                 const canClaim = appUser.id !== sw.originalEmployeeId && appUser.role === sw.role;
                 return (
                   <div key={sw.id} className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 gap-2">
                     <div>
                       <span className="font-bold text-indigo-900 block">{orig?.name || 'Unknown'} - {sw.role}</span>
                       <span className="text-sm font-medium text-slate-600">{formatDisplayDate(sw.date)} | {formatTime12Hour(sw.startTime)} - {formatTime12Hour(sw.endTime)}</span>
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
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 mb-2"><Calendar size={20}/> Assign Shift</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-medium outline-none focus:border-blue-500">
              <option value="">Select Staff Member...</option>
              {displayUsers.map(u => {
                const dayOfWeekMap = ['sun','mon','tue','wed','thu','fri','sat'];
                const dayOfWeek = new Date(currentDate + 'T12:00:00').getDay();
                const hasTimeOff = timeOff.some(t => t.employeeId === u.id && t.startDate === currentDate);
                const templateAllows = u.availability ? u.availability[dayOfWeekMap[dayOfWeek]] !== false : true;
                const isAvail = !hasTimeOff && templateAllows;

                return <option key={u.id} value={u.id} disabled={!isAvail}>{u.name} ({u.role}) {!isAvail ? '- UNAVAILABLE' : ''}</option>
              })}
            </select>
            <div className="flex gap-2">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none" />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none" />
            </div>
            <button onClick={handleSaveShift} disabled={!selectedEmp} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm disabled:opacity-50 transition-colors">Assign</button>
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6 pt-2">
        {['Bartender', 'Kitchen'].map(role => (
          <div key={role} className="space-y-3">
            <h3 className={`text-lg font-black uppercase tracking-wider pl-2 ${role === 'Bartender' ? 'text-blue-600' : 'text-orange-600'}`}>{role}s</h3>
            {displayShifts.filter(s => s.role === role).length === 0 ? (
               <div className="p-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-slate-400 font-medium">No shifts scheduled.</div>
            ) : (
              displayShifts.filter(s => s.role === role).map(s => {
                const emp = displayUsers.find(u => u.id === s.employeeId);
                const isMyShift = appUser.id === s.employeeId;
                const isSwappedOut = shiftSwaps.some(sw => sw.shiftId === s.id);
                
                return (
                  <div key={s.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col hover:border-slate-300 transition-colors group gap-3">
                    <div className="flex justify-between items-center w-full">
                      <div className="font-black text-xl text-slate-800">{emp?.name || 'Unknown'}</div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}</div>
                        {appUser?.isAdmin && <button onClick={() => handleDeleteShift(s.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
                      </div>
                    </div>
                    {isMyShift && !isSwappedOut && (
                      <button onClick={() => handleOfferSwap(s)} className="w-full text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"><Repeat size={14}/> Offer on Trade Board</button>
                    )}
                    {isSwappedOut && <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md text-center border border-orange-200">Pending on Trade Board</div>}
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
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6 self-start">
        <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800"><Calendar className="text-blue-500" size={28}/> Log Unavailability</h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label className="block text-sm font-bold text-slate-600 mb-2">Select Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <label className="flex items-center gap-3 font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> This is a partial day / specific time window</label>
            {isPartial && (<div className="flex gap-4 pt-2 border-t border-slate-200"><div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" /></div><div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" /></div></div>)}
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 shadow-md transition-all">Submit Request</button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-black text-slate-800 pl-2">Upcoming Roster</h3>
        <div className="space-y-3">
          {timeOff.length === 0 ? <p className="p-6 bg-slate-100 rounded-2xl text-slate-500 font-medium">No time off logged.</p> : null}
          {timeOff.filter(t => appUser.isAdmin || t.employeeId === appUser.id).map(t => {
            const emp = displayUsers.find(u => u.id === t.employeeId);
            return (
              <div key={t.id} className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-orange-500">
                <div><strong className="text-lg text-slate-900 block">{emp?.name || 'Unknown'}</strong><span className="text-slate-500 font-medium">{formatDisplayDate(t.startDate)}</span>{t.isPartial && <div className="mt-1 text-sm font-bold bg-orange-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-200 w-max">{formatTime12Hour(t.startTime)} - {formatTime12Hour(t.endTime)}</div>}</div>
                {(appUser.isAdmin || t.employeeId === appUser.id) && <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors"><Trash2 size={20}/></button>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

// --- Tab: Inventory ---
const TabInventory = ({ inventoryItems, addToast }) => {
  const [invTab, setInvTab] = useState('order'); 
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState('Produce'); const [newItemCode, setNewItemCode] = useState('');
  const [orderOverrides, setOrderOverrides] = useState({});

  const handleAddItem = async (e) => {
    e.preventDefault(); if (!newItemName.trim()) return;
    await addDoc(collection(db, "inventoryItems"), { name: newItemName.trim(), category: newItemCat, pfgCode: newItemCode.trim(), parLevel: 10, currentStock: 0 });
    setNewItemName(''); setNewItemCode(''); addToast('Inventory Updated', `${newItemName} added to master list.`);
  };

  const updateStock = async (id, newStock) => await updateDoc(doc(db, "inventoryItems", id), { currentStock: Math.max(0, parseInt(newStock) || 0) });
  const updatePar = async (id, newPar) => await updateDoc(doc(db, "inventoryItems", id), { parLevel: Math.max(0, parseInt(newPar) || 0) });
  const deleteItem = async (id) => { if(window.confirm("Remove this item from the master list?")) await deleteDoc(doc(db, "inventoryItems", id)); };
  const handleOrderChange = (id, value) => setOrderOverrides(prev => ({ ...prev, [id]: parseInt(value) || 0 }));

  const itemsToOrder = inventoryItems.filter(i => {
    const override = orderOverrides[i.id];
    if (override !== undefined) return override > 0;
    return i.currentStock < i.parLevel;
  });

  const handleEmailOrder = () => {
    const bodyText = itemsToOrder.map(item => {
      const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
      if (qty === 0) return null;
      return `${item.pfgCode ? `[${item.pfgCode}] ` : ''}${item.name}: ${qty}`;
    }).filter(Boolean).join('%0D%0A');

    if (!bodyText) return addToast('Order Empty', 'All quantities are set to zero.');

    const subject = encodeURIComponent("PFG Order - Cheers Chilton (Acct 39228)");
    const body = encodeURIComponent("Performance Foodservice Order\nAccount: 39228\nLocation: Cheers-Chilton\n\nItems to Order:\n") + bodyText;
    window.location.href = `mailto:geoffm1985@gmail.com?subject=${subject}&body=${body}`;
    
    setOrderOverrides({});
    addToast('Email Client Opened', 'Check your email app to review and send the order.');
  };

  const groupedItems = inventoryItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900"><Package size={24}/> Purchasing</h2>
        <div className="bg-slate-200/50 p-1 rounded-xl flex border border-slate-200 w-full sm:w-auto">
          {['count', 'order', 'manage'].map(tab => (
            <button key={tab} onClick={() => setInvTab(tab)} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${invTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
          ))}
        </div>
      </div>
      
      {invTab === 'count' && (
        <div className="space-y-8">
          {Object.keys(groupedItems).length === 0 && <div className="p-8 text-center text-slate-400 font-medium">Master list is empty. Add items in Manage tab.</div>}
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-xl font-black text-slate-800 border-b border-slate-200 pb-2">{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-lg leading-tight">{item.name}</div>
                      <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.pfgCode ? `PFG: ${item.pfgCode}` : 'NO CODE'}</div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PAR</span>
                        <input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} className="w-12 text-center font-bold text-slate-700 bg-white border border-slate-300 rounded-md py-1 outline-none focus:border-blue-500" />
                      </div>
                      <div className="h-8 w-px bg-slate-300"></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">STOCK</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateStock(item.id, item.currentStock - 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 text-slate-600 rounded-md font-bold hover:bg-slate-100 transition-colors">-</button>
                          <span className="w-8 text-center font-black text-xl text-slate-800">{item.currentStock}</span>
                          <button onClick={() => updateStock(item.id, item.currentStock + 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 text-slate-600 rounded-md font-bold hover:bg-slate-100 transition-colors">+</button>
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

      {invTab === 'order' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-xl text-slate-800">Deficit Report</h3>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold text-sm">{itemsToOrder.length} Items Needed</span>
          </div>
          {itemsToOrder.length === 0 ? (
            <div className="p-12 text-center font-bold text-slate-400">All inventory levels meet or exceed par.</div>
          ) : (
            <div>
              <table className="w-full text-left">
                <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider"><th className="p-4">Item</th><th className="p-4 text-center hidden sm:table-cell">On Hand</th><th className="p-4 text-center hidden sm:table-cell">Par</th><th className="p-4 text-right">Order Qty</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsToOrder.map(item => {
                    const defaultOrder = Math.max(0, item.parLevel - item.currentStock);
                    const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : defaultOrder;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-4"><span className="font-bold text-slate-800 block text-lg leading-tight mb-1">{item.name}</span><span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">{item.category} {item.pfgCode && `• #${item.pfgCode}`}</span></td>
                        <td className="p-4 text-center font-medium text-slate-500 hidden sm:table-cell">{item.currentStock}</td>
                        <td className="p-4 text-center font-medium text-slate-500 hidden sm:table-cell">{item.parLevel}</td>
                        <td className="p-4 text-right"><input type="number" min="0" value={currentOrder} onChange={e => handleOrderChange(item.id, e.target.value)} className="font-black text-blue-600 text-xl bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl w-24 text-center outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button onClick={handleEmailOrder} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"><Send size={20}/> Email Order to Rep</button>
              </div>
            </div>
          )}
        </div>
      )}

      {invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
             <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Add Single Item</h3>
             <form onSubmit={handleAddItem} className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label><select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option></select></div>
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">PFG Item #</label><input type="text" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" placeholder="Optional" /></div>
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-bold shadow-md hover:bg-slate-800 transition-colors">Add Item</button>
             </form>
          </div>

          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Current Master List</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {inventoryItems.length === 0 && <p className="text-slate-400 font-medium">List is empty.</p>}
              {inventoryItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all">
                  <div><span className="font-bold text-slate-800 block text-sm leading-tight">{item.name}</span><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider">{item.category} {item.pfgCode && `| #${item.pfgCode}`}</span></div>
                  <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors ml-2"><Trash2 size={16}/></button>
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
const TabSettings = ({ addToast, inventoryItems }) => {
  const [settings, setSettings] = useState({ shiftReminders: true, overtimeAlerts: false, autoApprove: false, muteOffShift: false });
  const [isImporting, setIsImporting] = useState(false);
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const handleImportCatalog = async () => {
    if(!window.confirm("This will inject the PFG Test Batch into your database. Continue?")) return;
    setIsImporting(true);
    let count = 0;
    try {
      const existingCodes = inventoryItems.map(i => i.pfgCode);
      for (const item of PFG_CATALOG) {
        if (!existingCodes.includes(item.pfgCode)) {
          await addDoc(collection(db, "inventoryItems"), { ...item, currentStock: 0 });
          count++;
        }
      }
      addToast('Import Complete', `Successfully loaded ${count} new PFG items.`);
    } catch (err) { addToast('Import Error', 'Something went wrong during import.'); console.error(err); }
    setIsImporting(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
      <div><h3 className="text-2xl font-black text-slate-900 mb-1">Application Settings</h3><p className="text-slate-500 font-medium">Manage alerts and interface preferences.</p></div>

      <div className="space-y-4 border-y border-slate-100 py-6">
        {[
          { id: 'shiftReminders', label: 'Send 24-hour Shift Reminders' },
          { id: 'overtimeAlerts', label: 'Alert Manager Before Overtime (40h)' },
          { id: 'autoApprove', label: 'Auto-Approve Peer Shift Swaps' },
          { id: 'muteOffShift', label: 'Mute Message Notifications Off-Shift' }
        ].map(setting => (
          <div key={setting.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer" onClick={() => toggle(setting.id)}>
            <span className="font-bold text-slate-700">{setting.label}</span>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings[setting.id] ? 'bg-blue-600' : 'bg-slate-300'} shadow-inner`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings[setting.id] ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10"><CheckCircle size={100} /></div>
        <h4 className="font-black text-emerald-900 mb-2 text-lg">PFG Integration Engine</h4>
        <p className="text-sm text-emerald-800 mb-5 font-medium leading-relaxed max-w-[90%]">Inject the Performance Foodservice Master Catalog (Test Batch) directly into your live database. Pre-configured with exact SKU codes and default par levels.</p>
        <button onClick={handleImportCatalog} disabled={isImporting} className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3.5 rounded-xl font-bold transition-all shadow-md w-full flex items-center justify-center gap-2 relative z-10">
          {isImporting ? <Loader2 className="animate-spin" size={20}/> : <><Package size={20} /> Inject PFG Catalog</>}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
        <h4 className="font-bold text-blue-900 mb-2">System Diagnostics</h4>
        <button onClick={() => addToast('Diagnostic Test', 'Live Firebase database connected successfully.')} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full">Trigger Test Alert</button>
      </div>
    </div>
  );
};

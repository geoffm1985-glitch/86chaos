import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, BookOpen, Camera, Loader2, Printer, Image as ImageIcon, Package, ShoppingCart, ClipboardList, Filter, Menu, Settings, LogOut, Shield } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
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

// --- Helper Functions ---
const formatDate = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};
const getToday = () => formatDate(new Date());
const addDays = (dateStr, days) => {
  if (!dateStr) return getToday();
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return formatDate(d);
};
const getMonthStr = (dateStr) => (dateStr || getToday()).substring(0, 7);
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', options);
};
const formatDisplayMonth = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const getDaysInMonth = (monthStr) => {
  if (!monthStr) return 30;
  const [year, month] = monthStr.split('-');
  return new Date(year, month, 0).getDate();
};
const formatTime12Hour = (time24) => {
  if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return String(time24 || '');
  let [hours, minutes] = time24.split(':');
  hours = parseInt(hours, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
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
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h3 className="font-bold text-xl text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// --- Navigation Drawer Component ---
const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, unread }) => {
  if (!isOpen) return null;

  const tabs = [
    { id: 'schedule', label: 'Schedule', icon: <Calendar size={20}/> },
    { id: 'month', label: 'Month View', icon: <Calendar size={20}/> },
    { id: 'timeoff', label: 'Time Off', icon: <Clock size={20}/> }
  ];

  if (appUser?.isAdmin || appUser?.role === 'Kitchen') {
    tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={20}/> });
    tabs.push({ id: 'recipes', label: 'Recipes', icon: <BookOpen size={20}/> });
  }
  
  if (appUser?.isAdmin) {
    tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={20}/> });
  }

  tabs.push({ id: 'team', label: 'Team', icon: <Users size={20}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={20}/> });

  const handleLogout = () => {
    localStorage.removeItem('cheersUser');
    setAppUser(null);
    onClose();
  };

  return (
     <div className="fixed inset-0 z-50 flex justify-end">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       <div className="w-80 bg-white h-full shadow-2xl flex flex-col relative border-l border-slate-200 animate-slide-in">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white flex justify-between items-start">
             <div>
               <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Signed in as</div>
               <div className="text-slate-900 font-black text-xl tracking-tight">{appUser.name}</div>
               <div className="flex items-center gap-1 text-blue-600 text-xs font-bold uppercase tracking-wider mt-1.5 bg-blue-50 w-max px-2 py-1 rounded-md">
                 {appUser.isAdmin && <Shield size={12} />}
                 {appUser.role} {appUser.isAdmin && '• Admin'}
               </div>
             </div>
             <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:text-slate-900 transition-colors"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
             {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); onClose(); }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-400'}>{tab.icon}</span>
                    {tab.label}
                  </div>
                  {tab.badge && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm"></span>}
                </button>
             ))}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50">
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3.5 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors">
               <LogOut size={18} /> Log Out
             </button>
          </div>
       </div>
     </div>
  );
};

// --- Main Application ---
export default function App() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [prepItems, setPrepItems] = useState([]);
  const [recipes, setRecipes] = useState([{ id: 'r1', title: 'House Bacon Jam', ingredients: [{ text: '2 lbs Bacon' }, { text: '1 Onion' }], steps: [{ text: 'Render bacon.' }, { text: 'Sauté onions.' }] }]);
  const [vendors, setVendors] = useState([{ id: 'v1', name: 'Sysco', cutoffDays: ['Tuesday', 'Friday'], cutoffTime: '16:00' }]);
  const [inventoryItems, setInventoryItems] = useState([
    { id: 'i1', name: 'Chicken Breast', category: 'Meat', vendorId: 'v1', parLevel: 40, currentStock: 12, unit: 'lbs' }
  ]);
  const [timeOff, setTimeOff] = useState([]);
  
  // Persist User Login
  const [appUser, setAppUser] = useState(() => {
    const saved = localStorage.getItem('cheersUser');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (appUser) localStorage.setItem('cheersUser', JSON.stringify(appUser));
    else localStorage.removeItem('cheersUser');
  }, [appUser]);

  useEffect(() => {
    let unsubscribe = () => {};
    const initFirebase = async () => {
      try {
        await signInAnonymously(auth);
        unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
          const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(usersData);
        }, (error) => console.error("Firebase sync error:", error));
      } catch (err) { console.error("Firebase Auth error:", err); }
    };
    initFirebase();
    return () => unsubscribe();
  }, []);

  const mockDB = {
    users, setUsers, shifts, setShifts, prepItems, setPrepItems, recipes, setRecipes,
    timeOff, setTimeOff, vendors, setVendors, inventoryItems, setInventoryItems
  };

  const [activeTab, setActiveTab] = useState('schedule');
  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [settings, setSettings] = useState({ notifPub: true, notifChanges: true, autoApproveSwaps: false, darkMode: false, overtimeAlerts: true });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const liveAppUser = appUser ? (users.find(u => u.id === appUser.id) || appUser) : null;

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

  if (!liveAppUser) {
    return <LoginScreen users={users} setAppUser={setAppUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* --- Header --- */}
      <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-slate-200 h-20 flex items-center justify-between px-6">
        <CheersLogo />
        <button onClick={() => setIsMenuOpen(true)} className="relative p-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:bg-slate-100 hover:text-slate-900 transition-all outline-none">
          <Menu size={24} />
        </button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTab} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} unread={0} />

      {/* --- Date Header --- */}
      {['schedule', 'prep', 'month'].includes(activeTab) && (
        <div className="bg-white py-5 px-4 shadow-sm z-30 border-b border-slate-200">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => activeTab === 'month' ? setCurrentDate(addDays(currentDate, -30)) : setCurrentDate(addDays(currentDate, -1))} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600">
              <ChevronLeft size={24} />
            </button>
            <h2 onClick={() => setIsDateModalOpen(true)} className="text-2xl sm:text-3xl font-black tracking-tight text-center cursor-pointer hover:text-blue-600 transition-colors">
              {activeTab === 'month' ? formatDisplayMonth(getMonthStr(currentDate)) : formatDisplayDate(currentDate)}
            </h2>
            <button onClick={() => activeTab === 'month' ? setCurrentDate(addDays(currentDate, 30)) : setCurrentDate(addDays(currentDate, 1))} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600">
              <ChevronRight size={24} />
            </button>
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
        {activeTab === 'schedule' && <TabSchedule currentDate={currentDate} appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'month' && <TabMonth currentDate={currentDate} appUser={liveAppUser} mockDB={mockDB} setCurrentDate={(d) => { setCurrentDate(d); setActiveTab('schedule'); }} />}
        {activeTab === 'timeoff' && <TabTimeOff appUser={liveAppUser} mockDB={mockDB} addToast={addToast} />}
        {activeTab === 'prep' && <TabPrep currentDate={currentDate} appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'recipes' && <TabRecipes appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'inventory' && <TabInventory appUser={liveAppUser} mockDB={mockDB} addToast={addToast} />}
        {activeTab === 'team' && <TabTeam appUser={liveAppUser} mockDB={mockDB} addToast={addToast} />}
        {activeTab === 'settings' && <TabSettings settings={settings} setSettings={setSettings} addToast={addToast} />}
      </main>

      {/* --- Toast Alert Engine --- */}
      <div className="fixed top-24 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-3 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-start gap-4 border border-slate-700 animate-toast">
            <div className="bg-blue-500/20 p-2 rounded-full text-blue-400 mt-0.5"><Bell size={18} /></div>
            <div>
              <h4 className="font-bold text-sm">{t.title}</h4>
              <p className="text-sm text-slate-300 font-medium mt-0.5">{t.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="ml-auto text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Login Screen ---
const LoginScreen = ({ users, setAppUser }) => {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    try {
      const usersRef = collection(db, "users");
      if (users.length === 0) {
        const newUser = { name: name.trim(), role: 'Kitchen', isAdmin: true, isActive: true };
        const docRef = await addDoc(usersRef, newUser);
        setAppUser({ id: docRef.id, ...newUser });
        setIsLoading(false); return;
      }
      if (!inviteCode.trim()) { setError("Invite code required."); setIsLoading(false); return; }
      const q = query(usersRef, where("inviteCode", "==", inviteCode.trim().toUpperCase()));
      const codeSnapshot = await getDocs(q);
      if (codeSnapshot.empty) { setError("Invalid code."); setIsLoading(false); return; }
      
      const userDoc = codeSnapshot.docs[0];
      await updateDoc(doc(db, "users", userDoc.id), { inviteCode: null, isActive: true, name: name.trim() || userDoc.data().name });
      setAppUser({ id: userDoc.id, ...userDoc.data(), name: name.trim() || userDoc.data().name, isActive: true });
    } catch (err) { setError("Database error."); console.error(err); }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-md w-full">
        <div className="flex justify-center mb-8"><CheersLogo /></div>
        <h2 className="text-2xl font-black text-center mb-6 text-slate-900 tracking-tight">Staff Login</h2>
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5">Your Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
          </div>
          {users.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">6-Digit Access Code</label>
              <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-mono tracking-[0.2em] uppercase text-center focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
          )}
          {error && <p className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}
          <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md mt-2 flex justify-center items-center gap-2">
            {isLoading ? <Loader2 className="animate-spin" size={20}/> : 'Access Portal'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, mockDB, addToast }) => {
  const { users = [] } = mockDB || {};
  const [name, setName] = useState('');
  const [role, setRole] = useState('Bartender');
  const [isAdmin, setIsAdmin] = useState(false);

  // Fallback so it always shows the logged in user even if database is slow
  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);

  const handleAdd = async (e) => {
    e.preventDefault(); if (!name.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await addDoc(collection(db, "users"), { name: name.trim(), role, isAdmin, inviteCode: code, isActive: false });
      addToast('Team Member Added', `${name.trim()} added. Code: ${code}`);
      setName(''); setIsAdmin(false);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {appUser?.isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Users size={20}/> Invite New Staff</h3>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none">
                <option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 pb-3 cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> Admin
            </label>
            <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 w-full sm:w-auto shadow-sm">Add</button>
          </form>
        </div>
      )}
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 tracking-wider">
              <th className="p-4 font-bold">Staff Directory</th>
              <th className="p-4 font-bold">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayUsers.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-900 text-lg">{u.name}</div>
                  {u.inviteCode && <div className="mt-1 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-md px-2 py-1 w-max">PENDING CODE: {u.inviteCode}</div>}
                </td>
                <td className="p-4">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${u.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{u.role}</span>
                  {u.isAdmin && <span className="ml-2 text-xs font-bold bg-slate-800 text-white px-2 py-1 rounded-full"><Shield size={10} className="inline mr-1 pb-0.5"/>Admin</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Tab: Month View (Restored) ---
const TabMonth = ({ currentDate, appUser, mockDB, setCurrentDate }) => {
  const { users = [], shifts = [] } = mockDB || {};
  const monthStr = getMonthStr(currentDate);
  const firstDay = new Date(monthStr + '-01T12:00:00').getDay();

  // Fallback users for display
  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid grid-cols-7 border-t border-l">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-3 bg-slate-50 text-center font-bold text-xs text-slate-500 border-b border-r uppercase tracking-wider">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-slate-50/50 border-b border-r min-h-[100px]" />)}
        {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
          const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div key={date} onClick={() => setCurrentDate(date)} className="p-2 border-b border-r min-h-[120px] hover:bg-slate-50 cursor-pointer flex flex-col justify-between transition-colors">
              <div className="text-right text-sm font-bold text-slate-400">{i+1}</div>
              <div className="space-y-1 max-h-[85px] overflow-hidden">
                {shifts.filter(s => s.date === date).map(s => {
                  const emp = displayUsers.find(u => u.id === s.employeeId);
                  return <div key={s.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${s.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{emp?.name.split(' ')[0]}</div>
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- Tab: Recipes (Restored) ---
const TabRecipes = ({ appUser, mockDB }) => {
  const { recipes = [], setRecipes } = mockDB || {};
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState([{ text: '' }]);
  const [steps, setSteps] = useState([{ text: '' }]);

  const handleSaveRecipe = (e) => {
    e.preventDefault(); if (!title.trim()) return;
    setRecipes(prev => [...prev, { id: Date.now().toString(), title, ingredients: ingredients.filter(i => i.text.trim()), steps: steps.filter(s => s.text.trim()) }]);
    setIsCreating(false); setTitle(''); setIngredients([{ text: '' }]); setSteps([{ text: '' }]);
  };

  if (activeRecipe) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <button onClick={() => setActiveRecipe(null)} className="mb-6 text-slate-500 font-bold flex items-center gap-1 hover:text-slate-800"><ChevronLeft size={16}/> Back to Recipes</button>
        <h2 className="text-3xl font-black mb-8 text-slate-900">{activeRecipe.title}</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-lg border-b border-slate-200 pb-2 mb-4 text-slate-800">Ingredients</h3>
            <ul className="space-y-2">{activeRecipe.ingredients.map((ing, i) => <li key={i} className="flex items-start gap-2 font-medium text-slate-700"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div> {ing.text}</li>)}</ul>
          </div>
          <div>
            <h3 className="font-bold text-lg border-b border-slate-200 pb-2 mb-4 text-slate-800">Instructions</h3>
            <ol className="list-decimal pl-5 space-y-3 font-medium text-slate-700">{activeRecipe.steps.map((st, i) => <li key={i} className="pl-2">{st.text}</li>)}</ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><BookOpen size={24}/> Kitchen Cook Book</h2>
        <button onClick={() => setIsCreating(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 flex items-center gap-2"><Plus size={18}/> New Recipe</button>
      </div>
      {isCreating ? (
        <form onSubmit={handleSaveRecipe} className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-sm">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Recipe Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. House Bacon Jam" required />
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800">Save to Cook Book</button>
        </form>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {recipes.map(r => (
            <div key={r.id} onClick={() => setActiveRecipe(r)} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group">
              <h3 className="font-bold text-xl mb-2 text-slate-800 group-hover:text-blue-600 transition-colors">{r.title}</h3>
              <p className="text-sm text-slate-500 font-medium">{r.ingredients.length} ingredients • {r.steps.length} steps</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Tab: Prep List ---
const TabPrep = ({ currentDate, appUser, mockDB }) => {
  const { prepItems = [], setPrepItems } = mockDB || {};
  const [text, setText] = useState('');

  const handleAdd = (e) => {
    e.preventDefault(); if (!text.trim()) return;
    setPrepItems(prev => [...prev, { id: Date.now().toString(), date: currentDate, text, isCompleted: false }]);
    setText('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleAdd} className="bg-white border border-slate-200 p-2 pl-4 rounded-2xl flex gap-2 shadow-sm items-center">
        <input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 p-2 bg-transparent outline-none font-medium placeholder:text-slate-400" placeholder="Add a new prep task..." required />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition-colors shadow-sm"><Plus size={20}/></button>
      </form>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
        {prepItems.filter(p => p.date === currentDate).length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-medium">No prep tasks scheduled for today.</div>
        ) : (
          prepItems.filter(p => p.date === currentDate).map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
              <span className={`text-lg transition-all ${item.isCompleted ? 'line-through text-slate-300' : 'font-bold text-slate-800'}`}>{item.text}</span>
              <button onClick={() => setPrepItems(prev => prev.map(p => p.id === item.id ? {...p, isCompleted: !p.isCompleted} : p))} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${item.isCompleted ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'}`}>
                {item.isCompleted ? 'Undo' : <><Check size={16}/> Done</>}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Tab: Schedule ---
const TabSchedule = ({ currentDate, appUser, mockDB }) => {
  const { users = [], shifts = [], setShifts } = mockDB || {};
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('23:00');

  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);
  const displayShifts = shifts.filter(s => s.date === currentDate);

  const handleSaveShift = () => {
    if (!selectedEmp) return;
    const emp = displayUsers.find(u => u.id === selectedEmp);
    setShifts(prev => [...prev, { id: Date.now().toString(), date: currentDate, employeeId: emp.id, role: emp.role, startTime, endTime }]);
    setSelectedEmp('');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {appUser?.isAdmin && (
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 mb-2"><Calendar size={20}/> Assign Shift</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-medium outline-none focus:border-blue-500">
              <option value="">Select Staff Member...</option>
              {displayUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <div className="flex gap-2">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none" />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none" />
            </div>
            <button onClick={handleSaveShift} disabled={!selectedEmp} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm disabled:opacity-50 transition-colors">Assign</button>
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6">
        {['Bartender', 'Kitchen'].map(role => (
          <div key={role} className="space-y-3">
            <h3 className={`text-lg font-black uppercase tracking-wider pl-2 ${role === 'Bartender' ? 'text-blue-600' : 'text-orange-600'}`}>{role}s</h3>
            {displayShifts.filter(s => s.role === role).length === 0 ? (
               <div className="p-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-slate-400 font-medium">No shifts scheduled.</div>
            ) : (
              displayShifts.filter(s => s.role === role).map(s => {
                const emp = displayUsers.find(u => u.id === s.employeeId);
                return (
                  <div key={s.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex justify-between items-center hover:border-slate-300 transition-colors">
                    <div className="font-black text-xl text-slate-800">{emp?.name || 'Unknown'}</div>
                    <div className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}</div>
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
const TabTimeOff = ({ appUser, mockDB, addToast }) => {
  const { users = [], timeOff = [], setTimeOff } = mockDB || {};
  const [startDate, setStartDate] = useState(getToday());
  const [isPartial, setIsPartial] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('14:00');

  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTimeOff(prev => [...prev, { id: Date.now().toString(), employeeId: appUser.id, startDate, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null }]);
    addToast('Time Off Logged', `Requested ${formatDisplayDate(startDate)}`);
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
        <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800"><Calendar className="text-blue-500" size={28}/> Log Unavailability</h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">Select Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
          
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <label className="flex items-center gap-3 font-bold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              This is a partial day / specific time window
            </label>
            
            {isPartial && (
              <div className="flex gap-4 pt-2 border-t border-slate-200">
                 <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" /></div>
                 <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" /></div>
              </div>
            )}
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
              <div key={t.id} className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-orange-500">
                <div>
                  <strong className="text-lg text-slate-900 block">{emp?.name || 'Unknown'}</strong>
                  <span className="text-slate-500 font-medium">{formatDisplayDate(t.startDate)}</span>
                </div>
                {t.isPartial && <div className="text-sm font-bold bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 w-max">{formatTime12Hour(t.startTime)} - {formatTime12Hour(t.endTime)}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

// --- Tab: Inventory (Fixed List Display) ---
const TabInventory = ({ appUser, mockDB, addToast }) => {
  const { vendors = [], setVendors, inventoryItems = [], setInventoryItems } = mockDB || {};
  const [invTab, setInvTab] = useState('manage'); 
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState('Produce');

  const handleAddItem = (e) => {
    e.preventDefault(); if (!newItemName) return;
    setInventoryItems(prev => [...prev, { id: Date.now().toString(), name: newItemName, category: newItemCat, vendorId: vendors[0]?.id || '', parLevel: 10, currentStock: 0, unit: 'units' }]);
    setNewItemName(''); addToast('Inventory Updated', `${newItemName} added to master list.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900"><Package size={24}/> Purchasing</h2>
        <div className="bg-slate-200/50 p-1 rounded-xl flex border border-slate-200 w-full sm:w-auto">
          {['count', 'order', 'manage'].map(tab => (
            <button key={tab} onClick={() => setInvTab(tab)} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${invTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
          ))}
        </div>
      </div>
      
      {invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
             <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Add to Master List</h3>
             <form onSubmit={handleAddItem} className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none" required /></div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                 <select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none">
                   <option>Meat</option><option>Produce</option><option>Dry Goods</option><option>Liquor/Beer</option>
                 </select>
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-bold shadow-md hover:bg-slate-800 transition-colors">Add Item</button>
             </form>
          </div>

          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Current Master List</h3>
            <div className="space-y-2">
              {inventoryItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all">
                  <span className="font-bold text-slate-700">{item.name}</span>
                  <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {invTab !== 'manage' && <div className="text-center p-12 text-slate-400 font-bold bg-slate-100 rounded-3xl border border-dashed border-slate-300">Feature active. Add items in 'Manage' tab first.</div>}
    </div>
  );
};

// --- Tab: Settings ---
const TabSettings = ({ settings, setSettings, addToast }) => {
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  
  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-1">Portal Settings</h3>
        <p className="text-slate-500 font-medium">Manage alerts and application preferences.</p>
      </div>

      <div className="space-y-4 border-y border-slate-100 py-6">
        {[
          { id: 'notifPub', label: 'Push Notifications for Master Schedule' },
          { id: 'autoApproveSwaps', label: 'Auto-Approve Peer Shift Swaps' },
          { id: 'overtimeAlerts', label: 'Alert Manager Before Overtime (40h)' },
          { id: 'darkMode', label: 'Enable Dark Mode Interface (Beta)' }
        ].map(setting => (
          <div key={setting.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer" onClick={() => toggle(setting.id)}>
            <span className="font-bold text-slate-700">{setting.label}</span>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings[setting.id] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings[setting.id] ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
        <h4 className="font-bold text-blue-900 mb-2">Diagnostics</h4>
        <button onClick={() => addToast('System Diagnostic', 'Toast alert engine is fully operational.')} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full">
          Test Live Alert Engine
        </button>
      </div>
    </div>
  );
};

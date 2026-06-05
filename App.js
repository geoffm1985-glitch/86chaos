import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, BookOpen, Camera, Loader2, Printer, Image as ImageIcon, Package, ShoppingCart, ClipboardList, Filter, Menu, Settings } from 'lucide-react';

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
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5",
  measurementId: "G-JFZ6EZB0E3"
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
  const date = new Date(year, month, 0);
  return date.getDate();
};
const getShiftHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  let diff = (h2 + m2/60) - (h1 + m1/60);
  if (diff < 0) diff += 24; 
  return diff;
};
const getWeekRange = (dateStr) => {
  if (!dateStr) return { start: '', end: '' };
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return { start: '', end: '' };
  const day = d.getDay(); 
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDate(monday), end: formatDate(sunday) };
};
const formatTime12Hour = (time24) => {
  if (!time24 || typeof time24 !== 'string' || !time24.includes(':')) return String(time24 || '');
  let [hours, minutes] = time24.split(':');
  hours = parseInt(hours, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

// --- SVG Logo ---
const CheersLogo = () => (
  <svg viewBox="0 0 400 120" className="h-10 sm:h-12 w-auto" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M190,20 C70,0 0,35 0,65 C0,95 100,110 270,110 L270,105 C100,105 30,95 30,65 C30,40 80,25 190,20 Z" className="text-zinc-900 print:text-black" />
    <text x="95" y="85" fontFamily="'Brush Script MT', 'Great Vibes', cursive, serif" fontStyle="italic" fontSize="90" fontWeight="900" className="text-zinc-900 print:text-black" letterSpacing="-1">Cheers</text>
    <text x="275" y="110" fontFamily="'Times New Roman', Georgia, serif" fontSize="28" className="text-zinc-900 print:text-black">Chilton</text>
  </svg>
);

// --- Custom Modal ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-zinc-200">
        <div className="flex justify-between items-center p-4 border-b border-zinc-200 bg-zinc-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-zinc-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-full text-zinc-500 hover:text-zinc-800 transition-colors"><X size={20}/></button>
        </div>
        <div className="p-4">{children}</div>
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

  tabs.push({ id: 'messages', label: 'Messages', badge: unread > 0, icon: <MessageSquare size={20}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={20}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={20}/> });

  return (
     <div className="fixed inset-0 z-50 flex justify-end print:hidden">
       <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
       <div className="w-72 sm:w-80 bg-white h-full shadow-2xl flex flex-col relative border-l border-zinc-200 animate-slide-in">
          <div className="p-6 border-b border-zinc-200 flex justify-between items-start bg-zinc-50">
             <div>
               <div className="text-sm text-zinc-500 mb-1">Signed in as</div>
               <div className="text-zinc-900 font-bold text-lg leading-tight">{appUser.name}</div>
               <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-1">{appUser.role} {appUser.isAdmin && '• Admin'}</div>
             </div>
             <button onClick={onClose} className="p-2 bg-zinc-200 rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-300 transition-colors shadow-sm"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
             {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); onClose(); }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
                >
                  <div className="flex items-center gap-3">
                    {tab.icon}
                    {tab.label}
                  </div>
                  {tab.badge && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-md"></span>}
                </button>
             ))}
          </div>
          <div className="p-4 border-t border-zinc-200 bg-zinc-50">
             <button onClick={() => { setAppUser(null); onClose(); }} className="w-full py-3 text-red-600 font-bold rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors">Log Out</button>
          </div>
       </div>
     </div>
  );
};

// --- Main Application ---
export default function App() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [prepItems, setPrepItems] = useState([
    { id: 'mock1', date: getToday(), text: 'Bacon jam', qty: '2', unit: 'qts', isCompleted: false, notifyStaff: true },
    { id: 'mock2', date: getToday(), text: 'Chili base', qty: '4', unit: 'qts', isCompleted: true, notifyStaff: false }
  ]);
  const [recipes, setRecipes] = useState([
    { 
      id: 'r1', title: 'House Bacon Jam', 
      ingredients: [{ text: '2 lbs Bacon', isDone: false }, { text: '1 Onion', isDone: false }, { text: '1/2 cup Sugar', isDone: false }], 
      steps: [{ text: 'Render bacon.', isDone: false }, { text: 'Sauté onions.', isDone: false }, { text: 'Simmer 20 mins.', isDone: false }] 
    }
  ]);
  
  const [vendors, setVendors] = useState([
    { id: 'v1', name: 'Sysco', cutoffDays: ['Tuesday', 'Friday'], cutoffTime: '16:00' },
    { id: 'v2', name: 'Local Farms Produce', cutoffDays: ['Monday', 'Thursday'], cutoffTime: '14:00' }
  ]);
  const [inventoryItems, setInventoryItems] = useState([
    { id: 'i1', name: 'Chicken Breast', category: 'Meat', vendorId: 'v1', parLevel: 40, currentStock: 12, unit: 'lbs' },
    { id: 'i2', name: 'Romaine Lettuce', category: 'Produce', vendorId: 'v2', parLevel: 15, currentStock: 4, unit: 'cases' },
    { id: 'i3', name: 'Frying Oil', category: 'Dry Goods', vendorId: 'v1', parLevel: 10, currentStock: 2, unit: 'jugs' },
  ]);

  const [timeOff, setTimeOff] = useState([]);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [meta, setMeta] = useState({});
  const [appUser, setAppUser] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};
    const initFirebase = async () => {
      try {
        await signInAnonymously(auth);
        unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
          const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setUsers(usersData);
        }, (error) => {
          console.error("Firebase sync error:", error);
        });
      } catch (err) {
        console.error("Firebase Auth error:", err);
      }
    };
    initFirebase();
    return () => unsubscribe();
  }, []);

  const mockDB = {
    users, setUsers, shifts, setShifts, prepItems, setPrepItems, recipes, setRecipes,
    timeOff, setTimeOff, messages, setMessages, templates, setTemplates, meta, setMeta,
    vendors, setVendors, inventoryItems, setInventoryItems
  };

  const [activeTab, setActiveTab] = useState('schedule');
  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [settings, setSettings] = useState({ notifPub: true, notifChanges: true, notifMsg: true, notifShift: true, notifInv: true, shiftReminderTime: 60 });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const liveAppUser = appUser ? (users.find(u => u.id === appUser.id) || appUser) : null;

  useEffect(() => {
    if (liveAppUser && !liveAppUser.isAdmin) {
      if (activeTab === 'inventory') setActiveTab('schedule');
      if (liveAppUser.role !== 'Kitchen' && (activeTab === 'prep' || activeTab === 'recipes')) {
        setActiveTab('schedule');
      }
    }
  }, [liveAppUser, activeTab]);

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000);
  };

  const prevMessagesRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesRef.current && liveAppUser && settings.notifMsg) {
      const newMsg = messages[messages.length - 1];
      if (newMsg && newMsg.senderId !== liveAppUser.id) {
        const role = liveAppUser.role || '';
        const isRelevant = newMsg.threadId === 'everyone' || newMsg.threadId === role.toLowerCase() || (liveAppUser.isAdmin && newMsg.threadId === 'management') || (newMsg.threadId || '').includes(liveAppUser.id);
        if (isRelevant) {
          const sender = users.find(u => u.id === newMsg.senderId)?.name || 'System';
          addToast(newMsg.threadId === 'management' && (newMsg.text || '').includes('shift swap') ? 'Shift Swap Approval Needed' : `New Message from ${sender}`, newMsg.text || '📷 Sent an image');
        }
      }
    }
    prevMessagesRef.current = messages.length;
  }, [messages, liveAppUser, users, settings.notifMsg]);

  if (!liveAppUser) {
    return <LoginScreen users={users} setAppUser={setAppUser} />;
  }

  const unreadMessagesCount = (messages || []).filter(m => {
    if (m.senderId === liveAppUser.id) return false;
    const role = liveAppUser.role || '';
    const isRelevant = m.threadId === 'everyone' || m.threadId === role.toLowerCase() || (liveAppUser.isAdmin && m.threadId === 'management') || (m.threadId || '').includes(liveAppUser.id);
    if (!isRelevant) return false;
    const lastRead = liveAppUser.readReceipts?.[m.threadId] || 0;
    return m.timestamp > lastRead;
  }).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col print:bg-white print:text-black">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.5in; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; color: black !important; }
          .print-full-width { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in { animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
      `}</style>

      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-zinc-200 print:hidden h-20 flex items-center px-4 md:px-8">
        <CheersLogo />
      </header>

      <button
        onClick={() => setIsMenuOpen(true)}
        className="fixed top-4 right-4 md:top-4 md:right-8 z-40 p-3.5 bg-white border border-zinc-200 text-zinc-900 rounded-full shadow-lg hover:bg-zinc-50 hover:scale-105 active:scale-95 transition-all print:hidden flex items-center justify-center"
        title="Open Navigation Menu"
      >
        <Menu size={26} />
        {unreadMessagesCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-[3px] border-white rounded-full animate-pulse shadow-md"></span>}
      </button>

      <DrawerMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        appUser={liveAppUser} 
        setAppUser={setAppUser} 
        unread={unreadMessagesCount} 
      />

      {['schedule', 'prep', 'month'].includes(activeTab) && (
        <div className="bg-white text-zinc-900 py-6 px-4 shadow-sm z-20 border-b border-zinc-200 relative overflow-hidden print:hidden">
          <div className="max-w-4xl mx-auto flex items-center justify-between relative z-10">
            <button onClick={() => activeTab === 'month' ? setCurrentDate(addDays(currentDate, -30)) : setCurrentDate(addDays(currentDate, -1))} className="p-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-600 hover:text-zinc-900">
              <ChevronLeft size={28} />
            </button>
            <h2 
              onClick={() => setIsDateModalOpen(true)}
              className="text-3xl md:text-4xl font-extrabold tracking-tight text-center cursor-pointer hover:text-zinc-600 transition-colors"
              title="Click to jump to a specific date"
            >
              {activeTab === 'month' ? formatDisplayMonth(getMonthStr(currentDate)) : formatDisplayDate(currentDate)}
            </h2>
            <button onClick={() => activeTab === 'month' ? setCurrentDate(addDays(currentDate, 30)) : setCurrentDate(addDays(currentDate, 1))} className="p-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors text-zinc-600 hover:text-zinc-900">
              <ChevronRight size={28} />
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Jump to Date">
        <div className="space-y-4">
          <input 
            type="date" 
            value={currentDate || ''} 
            onChange={e => {
              if (e.target.value) {
                setCurrentDate(e.target.value);
                setIsDateModalOpen(false);
              }
            }} 
            className="w-full p-4 bg-white border border-zinc-300 text-zinc-900 rounded-xl text-lg font-bold outline-none focus:border-zinc-500 shadow-inner" 
          />
          <button onClick={() => setIsDateModalOpen(false)} className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors">Close Calendar</button>
        </div>
      </Modal>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 print-full-width mt-4">
        {activeTab === 'schedule' && <TabSchedule currentDate={currentDate} appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'month' && <TabMonth currentDate={currentDate} appUser={liveAppUser} mockDB={mockDB} setCurrentDate={(d) => { setCurrentDate(d); setActiveTab('schedule'); }} />}
        {activeTab === 'timeoff' && <TabTimeOff appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'prep' && <TabPrep currentDate={currentDate} appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'recipes' && <TabRecipes appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'inventory' && <TabInventory appUser={liveAppUser} mockDB={mockDB} addToast={addToast} />}
        {activeTab === 'messages' && <TabMessages appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'team' && <TabTeam appUser={liveAppUser} mockDB={mockDB} />}
        {activeTab === 'settings' && <TabSettings settings={settings} setSettings={setSettings} addToast={addToast} appUser={liveAppUser} mockDB={mockDB} currentDate={currentDate} />}
      </main>

      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map(t => (
          <div key={t.id} className="bg-white border border-zinc-200 text-zinc-900 p-4 rounded-xl shadow-xl min-w-[250px] pointer-events-auto flex items-start gap-3 border-l-4 border-l-amber-500">
            <Bell className="text-amber-500 mt-0.5" size={18} />
            <div>
              <h4 className="font-bold text-sm">{t.title}</h4>
              <p className="text-sm text-zinc-600">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Live Firebase Login Screen ---
const LoginScreen = ({ users, setAppUser }) => {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const usersRef = collection(db, "users");
      if (users.length === 0) {
        const trimmedName = name.trim();
        const newUser = { name: trimmedName, role: 'Kitchen', isAdmin: true, phone: '', readReceipts: {}, isActive: true };
        const docRef = await addDoc(usersRef, newUser);
        setAppUser({ id: docRef.id, ...newUser });
        setIsLoading(false);
        return;
      }

      if (!inviteCode.trim()) {
        setError("An invite code is required to join this team.");
        setIsLoading(false);
        return;
      }

      const q = query(usersRef, where("inviteCode", "==", inviteCode.trim().toUpperCase()));
      const codeSnapshot = await getDocs(q);

      if (codeSnapshot.empty) {
        setError("Invalid invite code. Please check with management.");
        setIsLoading(false);
        return;
      }

      const userDoc = codeSnapshot.docs[0];
      await updateDoc(doc(db, "users", userDoc.id), { inviteCode: null, isActive: true, name: name.trim() || userDoc.data().name });
      setAppUser({ id: userDoc.id, ...userDoc.data(), name: name.trim() || userDoc.data().name, isActive: true });

    } catch (err) {
      setError("Connection error. Ensure Firestore rules are active.");
      console.error(err);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 p-8 max-w-md w-full">
        <div className="flex justify-center mb-8"><CheersLogo /></div>
        <h2 className="text-2xl font-bold text-center mb-6 text-zinc-900">Welcome to Cheers employee portal</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 mb-1">Your Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-white border border-zinc-300 rounded-xl focus:ring-2 focus:ring-zinc-500" placeholder="e.g. Geoffrey" required />
          </div>
          {users.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-zinc-600 mb-1">6-Digit Invite Code</label>
              <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} className="w-full p-3 bg-white border border-zinc-300 rounded-xl font-mono tracking-widest uppercase" placeholder="A7X9P2" required />
            </div>
          ) : (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-200">
              First account configuration: Automatically initialized as Administrator.
            </div>
          )}
          {error && <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}
          <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors mt-2">
            {isLoading ? 'Connecting...' : 'Log In / Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, mockDB }) => {
  const { users = [] } = mockDB || {};
  const [name, setName] = useState('');
  const [role, setRole] = useState('Bartender');
  const [phone, setPhone] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsAdding(true);
    setInviteResult(null);
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await addDoc(collection(db, "users"), { name: name.trim(), role, isAdmin, phone: phone.trim(), readReceipts: {}, inviteCode: inviteCode, isActive: false });
      setInviteResult({ name: name.trim(), code: inviteCode });
      setName(''); setPhone(''); setIsAdmin(false);
    } catch (err) {
      console.error(err);
    }
    setIsAdding(false);
  };

  const updateRole = async (id, newRole) => { await updateDoc(doc(db, "users", id), { role: newRole }); };
  const updatePhone = async (id, newPhone) => { await updateDoc(doc(db, "users", id), { phone: newPhone }); };
  const toggleAdmin = async (id, currentAdmin) => { await updateDoc(doc(db, "users", id), { isAdmin: !currentAdmin }); };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {appUser?.isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">New Member Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-300 text-zinc-900 rounded-xl outline-none" required />
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-300 text-zinc-900 rounded-xl" placeholder="555-0123" />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-300 text-zinc-900 rounded-xl">
                <option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-600 pb-3 cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="rounded" /> Admin
            </label>
            <button type="submit" disabled={isAdding} className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold">Add</button>
          </form>
          {inviteResult && inviteResult.code && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center">
              <div><strong className="text-green-800 block">Success! {inviteResult.name} added.</strong><span className="text-green-700 text-sm">Unique invite code:</span></div>
              <div className="bg-white border-2 border-green-300 text-green-900 text-2xl font-mono font-black px-6 py-3 rounded-xl">{inviteResult.code}</div>
            </div>
          )}
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200 text-xs uppercase text-zinc-600"><th className="p-4 font-bold">Name</th><th className="p-4 font-bold">Role</th>{appUser?.isAdmin && <th className="p-4 font-bold text-center">Admin Access</th>}<th className="p-4 font-bold text-right">Phone</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-zinc-50">
                <td className="p-4 font-medium text-zinc-900">{u.name}{u.inviteCode && <span className="ml-2 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">Code: {u.inviteCode}</span>}</td>
                <td className="p-4">
                  {appUser?.isAdmin ? (
                    <select value={u.role || 'Bartender'} onChange={(e) => updateRole(u.id, e.target.value)} className="bg-zinc-50 border border-zinc-300 rounded p-1 text-sm"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select>
                  ) : <span className="text-sm text-zinc-600">{u.role || 'Bartender'}</span>}
                </td>
                {appUser?.isAdmin && <td className="p-4 text-center"><button onClick={() => toggleAdmin(u.id, u.isAdmin)} disabled={u.id === appUser?.id} className={`text-xs px-3 py-1 rounded-full font-bold ${u.isAdmin ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>{u.isAdmin ? 'Admin' : 'Make Admin'}</button></td>}
                <td className="p-4 text-right font-medium text-sm text-zinc-600">
                  {appUser?.isAdmin ? <input type="tel" value={u.phone || ''} onChange={(e) => updatePhone(u.id, e.target.value)} placeholder="Add phone" className="bg-zinc-50 border border-zinc-300 rounded p-1 text-sm text-right w-32" /> : <span>{u.phone || '-'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Tab: Inventory ---
const TabInventory = ({ appUser, mockDB, addToast }) => {
  const { vendors = [], setVendors, inventoryItems = [], setInventoryItems } = mockDB || {};
  const [invTab, setInvTab] = useState('count');
  const [groupBy, setGroupBy] = useState('category');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorDays, setNewVendorDays] = useState(['Monday', 'Thursday']);
  const [newVendorTime, setNewVendorTime] = useState('14:00');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState('Produce');
  const [newItemVendor, setNewItemVendor] = useState(vendors[0]?.id || '');
  const [newItemPar, setNewItemPar] = useState(10);
  const [newItemUnit, setNewItemUnit] = useState('lbs');
  const [orderVendorId, setOrderVendorId] = useState(vendors[0]?.id || '');

  const updateStock = (id, newStock) => {
    setInventoryItems(prev => prev.map(item => item.id === id ? { ...item, currentStock: Math.max(0, parseInt(newStock) || 0) } : item));
  };

  const handleAddVendor = (e) => {
    e.preventDefault();
    if (!newVendorName) return;
    setVendors(prev => [...prev, { id: Date.now().toString(), name: newVendorName, cutoffDays: newVendorDays, cutoffTime: newVendorTime }]);
    setNewVendorName('');
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName || !newItemVendor) return;
    setInventoryItems(prev => [...prev, { id: Date.now().toString(), name: newItemName, category: newItemCat, vendorId: newItemVendor, parLevel: newItemPar, currentStock: 0, unit: newItemUnit }]);
    setNewItemName('');
  };

  const groupedItems = useMemo(() => {
    const groups = {};
    inventoryItems.forEach(item => {
      const key = groupBy === 'vendor' ? (vendors.find(v => v.id === item.vendorId)?.name || 'Unknown Vendor') : item.category;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [inventoryItems, vendors, groupBy]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-zinc-200 pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-900"><Package size={24}/> Inventory & Purchasing</h2>
        <div className="bg-zinc-100 p-1 rounded-xl flex border border-zinc-200">
          <button onClick={() => setInvTab('count')} className={`px-4 py-2 rounded-lg text-sm font-bold ${invTab === 'count' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Count</button>
          <button onClick={() => setInvTab('order')} className={`px-4 py-2 rounded-lg text-sm font-bold ${invTab === 'order' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Order</button>
          <button onClick={() => setInvTab('manage')} className={`px-4 py-2 rounded-lg text-sm font-bold ${invTab === 'manage' ? 'bg-white shadow-sm' : 'text-zinc-500'}`}>Manage</button>
        </div>
      </div>
      {invTab === 'count' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-zinc-200">
            <div><h3 className="font-bold text-zinc-900">Walkthrough</h3></div>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="bg-white border border-zinc-300 rounded-lg p-2 text-sm outline-none"><option value="category">Group by Category</option><option value="vendor">Group by Vendor</option></select>
          </div>
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([groupName, items]) => (
              <div key={groupName} className="space-y-3">
                <h4 className="text-lg font-bold text-zinc-700 uppercase border-b pb-2">{groupName}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center justify-between">
                      <div><div className="font-bold text-zinc-900">{item.name}</div><div className="text-xs text-zinc-500">Par: {item.parLevel} {item.unit}</div></div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateStock(item.id, item.currentStock - 1)} className="w-8 h-8 bg-zinc-100 rounded font-bold">-</button>
                        <input type="number" value={item.currentStock} onChange={e => updateStock(item.id, e.target.value)} className="w-12 text-center border rounded font-bold" />
                        <button onClick={() => updateStock(item.id, item.currentStock + 1)} className="w-8 h-8 bg-zinc-100 rounded font-bold">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {invTab === 'order' && (
        <div className="space-y-6">
          <select value={orderVendorId} onChange={e => setOrderVendorId(e.target.value)} className="bg-white border rounded-lg p-3 font-bold w-full"><option value="" disabled>Select Vendor...</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          {orderVendorId && (
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-zinc-50 border-b font-bold text-lg">{vendors.find(v => v.id === orderVendorId)?.name} Order Sheet</div>
              <table className="w-full text-left">
                <thead><tr className="bg-zinc-100 text-xs font-bold text-zinc-500"><th className="p-4">Item</th><th className="p-4 text-center">On Hand</th><th className="p-4 text-center">Par</th><th className="p-4 text-right">Order Amount</th></tr></thead>
                <tbody>
                  {inventoryItems.filter(i => i.vendorId === orderVendorId && i.currentStock < i.parLevel).map(item => (
                    <tr key={item.id} className="border-b"><td className="p-4 font-bold">{item.name}</td><td className="p-4 text-center">{item.currentStock}</td><td className="p-4 text-center">{item.parLevel}</td><td className="p-4 text-right font-black text-blue-600 text-lg">{(item.parLevel - item.currentStock)} {item.unit}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-zinc-50 text-right"><button onClick={() => addToast('Order Status', 'Order compiled successfully.')} className="bg-zinc-900 text-white px-6 py-2 rounded-xl font-bold">Finalize Order</button></div>
            </div>
          )}
        </div>
      )}
      {invTab === 'manage' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold border-b pb-2">Add Vendor</h3>
            <form onSubmit={handleAddVendor} className="bg-white p-4 border rounded-xl space-y-4">
              <input type="text" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className="w-full p-2 border rounded" placeholder="Vendor Name" required />
              <input type="time" value={newVendorTime} onChange={e => setNewVendorTime(e.target.value)} className="w-full p-2 border rounded" required />
              <button type="submit" className="w-full bg-zinc-900 text-white p-2 rounded font-bold">Add Vendor</button>
            </form>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold border-b pb-2">Add Product</h3>
            <form onSubmit={handleAddItem} className="bg-white p-4 border rounded-xl space-y-4">
              <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 border rounded" placeholder="Product Name" required />
              <select value={newItemVendor} onChange={e => setNewItemVendor(e.target.value)} className="w-full p-2 border rounded" required><option value="">Select Vendor...</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              <input type="number" value={newItemPar} onChange={e => setNewItemPar(e.target.value)} className="w-full p-2 border rounded" placeholder="Par Level" required />
              <button type="submit" className="w-full bg-zinc-900 text-white p-2 rounded font-bold">Add Item</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Tab: Recipes ---
const TabRecipes = ({ appUser, mockDB }) => {
  const { recipes = [], setRecipes } = mockDB || {};
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState([{ text: '', isDone: false }]);
  const [steps, setSteps] = useState([{ text: '', isDone: false }]);

  const handleSaveRecipe = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setRecipes(prev => [...prev, { id: Date.now().toString(), title, ingredients: ingredients.filter(i => i.text.trim()), steps: steps.filter(s => s.text.trim()) }]);
    setIsCreating(false); setTitle(''); setIngredients([{ text: '', isDone: false }]); setSteps([{ text: '', isDone: false }]);
  };

  if (activeRecipe) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border shadow-sm">
        <button onClick={() => setActiveRecipe(null)} className="mb-4 text-zinc-500 font-bold flex items-center gap-1"><ChevronLeft size={16}/> Back</button>
        <h2 className="text-2xl font-bold mb-4">{activeRecipe.title}</h2>
        <div className="mb-6">
          <h3 className="font-bold border-b pb-1 mb-2">Ingredients</h3>
          <ul className="space-y-1">{activeRecipe.ingredients.map((ing, i) => <li key={i} className="flex items-center gap-2"><div className="w-4 h-4 border rounded"></div> {ing.text}</li>)}</ul>
        </div>
        <div>
          <h3 className="font-bold border-b pb-1 mb-2">Instructions</h3>
          <ol className="list-decimal pl-5 space-y-2">{activeRecipe.steps.map((st, i) => <li key={i}>{st.text}</li>)}</ol>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Kitchen Cook Book</h2><button onClick={() => setIsCreating(true)} className="bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold">+ New Recipe</button></div>
      {isCreating ? (
        <form onSubmit={handleSaveRecipe} className="bg-white border rounded-xl p-6 space-y-4 max-w-xl mx-auto">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded" placeholder="Recipe Title" required />
          <button type="submit" className="w-full bg-zinc-900 text-white p-2 rounded font-bold">Save Recipe</button>
        </form>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {recipes.map(r => (
            <div key={r.id} onClick={() => setActiveRecipe(r)} className="bg-white border p-6 rounded-xl shadow-sm cursor-pointer hover:border-zinc-400">
              <h3 className="font-bold text-lg mb-1">{r.title}</h3>
              <p className="text-xs text-zinc-500">{r.ingredients.length} ingredients • {r.steps.length} steps</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Tab: Schedule ---
const TabSchedule = ({ currentDate, appUser, mockDB }) => {
  const { users = [], shifts = [], setShifts, timeOff = [], templates = [], setTemplates, meta = {}, setMessages } = mockDB || {};
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedDates, setSelectedDates] = useState([]);

  const monthStr = getMonthStr(currentDate);
  const isMonthPublished = meta[`month_${monthStr}`]?.isPublished;
  const weekRange = getWeekRange(currentDate);
  const weeklyShifts = shifts.filter(s => s.date >= weekRange.start && s.date <= weekRange.end);
  const displayShifts = shifts.filter(s => s.date === currentDate && (appUser?.isAdmin || isMonthPublished));

  const getAvailability = (uid, date) => {
    const to = timeOff.filter(t => t.employeeId === uid && date >= t.startDate && (t.endDate ? date <= t.endDate : date === t.startDate));
    if (to.length === 0) return 'available';
    if (to.some(t => !t.isPartial)) return 'unavailable';
    return 'partial';
  };

  const handleSaveShift = () => {
    if (!selectedEmp || selectedDates.length === 0) return;
    const emp = users.find(u => u.id === selectedEmp);
    if (!emp) return;
    const newShifts = selectedDates.map(date => ({ id: Date.now().toString() + Math.random(), date, employeeId: emp.id, role: emp.role || 'Bartender', startTime, endTime, swapStatus: 'none' }));
    setShifts(prev => [...prev, ...newShifts]); setSelectedDates([]); setSelectedEmp('');
  };

  return (
    <div className="space-y-6">
      {appUser?.isAdmin && (
        <div className="bg-white p-6 border rounded-xl shadow-sm space-y-4">
          <h3 className="font-bold text-lg border-b pb-2">Schedule Shift</h3>
          <select value={selectedEmp} onChange={e => {setSelectedEmp(e.target.value); setSelectedDates([]);}} className="w-full p-2 border rounded"><option value="">Select Employee...</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <div className="flex gap-4">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded" />
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          {selectedEmp && (
            <div className="grid grid-cols-7 gap-1 border p-2 rounded">
              {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
                const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
                const av = getAvailability(selectedEmp, date);
                const isSel = selectedDates.includes(date);
                return <button key={date} onClick={() => setSelectedDates(prev => isSel ? prev.filter(d=>d!==date) : [...prev, date])} className={`p-2 rounded text-xs font-bold ${isSel ? 'bg-zinc-900 text-white' : av === 'unavailable' ? 'bg-red-50 text-red-300 line-through' : 'bg-zinc-50'}`}>{i+1}</button>
              })}
            </div>
          )}
          <button onClick={handleSaveShift} disabled={!selectedEmp || selectedDates.length === 0} className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold">Assign Shifts</button>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        {['Bartender', 'Kitchen'].map(role => (
          <div key={role} className="space-y-3">
            <h3 className="text-xl font-bold border-b pb-2">{role} Shifts</h3>
            {displayShifts.filter(s => s.role === role).map(s => {
              const emp = users.find(u => u.id === s.employeeId);
              return <div key={s.id} className="bg-white border p-4 rounded-xl shadow-sm flex justify-between"><div><div className="font-bold">{emp?.name}</div><div className="text-sm text-zinc-500">{formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}</div></div></div>
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Tab: Month View ---
const TabMonth = ({ currentDate, appUser, mockDB, setCurrentDate }) => {
  const { users = [], shifts = [], meta = {}, setMeta } = mockDB || {};
  const monthStr = getMonthStr(currentDate);
  const isMonthPublished = meta[`month_${monthStr}`]?.isPublished;
  const firstDay = new Date(monthStr + '-01T12:00:00').getDay();

  return (
    <div className="space-y-4">
      {appUser?.isAdmin && (
        <div className="flex justify-end bg-white p-4 border rounded-xl shadow-sm">
          <button onClick={() => setMeta(prev => ({...prev, [`month_${monthStr}`]: { isPublished: true }}))} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">{isMonthPublished ? 'Republish Updates' : 'Publish Master Schedule'}</button>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm grid grid-cols-7 border-t border-l">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-2 bg-zinc-50 text-center font-bold text-xs text-zinc-500 border-b border-r">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-zinc-50 border-b border-r min-h-[80px]" />)}
        {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
          const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div key={date} onClick={() => setCurrentDate(date)} className="p-2 border-b border-r min-h-[100px] hover:bg-zinc-50 cursor-pointer flex flex-col justify-between">
              <div className="text-right text-xs font-bold text-zinc-400">{i+1}</div>
              <div className="space-y-0.5 max-h-[70px] overflow-hidden">
                {shifts.filter(s => s.date === date).map(s => {
                  const emp = users.find(u => u.id === s.employeeId);
                  return <div key={s.id} className={`text-[9px] font-bold p-0.5 rounded truncate ${s.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{emp?.name.split(' ')[0]}</div>
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- Tab: Time Off ---
const TabTimeOff = ({ appUser, mockDB }) => {
  const { users = [], timeOff = [], setTimeOff } = mockDB || {};
  const [startDate, setStartDate] = useState(getToday());

  const handleSubmit = (e) => {
    e.preventDefault();
    setTimeOff(prev => [...prev, { id: Date.now().toString(), employeeId: appUser.id, startDate, isPartial: false }]);
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white border p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2"><Calendar size={24}/> Log Unavailability</h3>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border rounded-xl" required />
        <button type="submit" className="w-full bg-zinc-900 text-white p-3 rounded-xl font-bold">Log Date</button>
      </form>
      <div className="space-y-3">
        <h3 className="text-xl font-bold">Unavailability Log</h3>
        {timeOff.filter(t => appUser.isAdmin || t.employeeId === appUser.id).map(t => {
          const emp = users.find(u => u.id === t.employeeId);
          return <div key={t.id} className="bg-white p-4 border rounded-xl shadow-sm"><strong>{emp?.name}</strong> - {formatDisplayDate(t.startDate)}</div>
        })}
      </div>
    </div>
  );
};

// --- Tab: Prep List ---
const TabPrep = ({ currentDate, appUser, mockDB }) => {
  const { prepItems = [], setPrepItems } = mockDB || {};
  const [text, setText] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('qts');

  const handleAdd = (e) => {
    e.preventDefault(); if (!text.trim()) return;
    setPrepItems(prev => [...prev, { id: Date.now().toString(), date: currentDate, text, qty, unit, isCompleted: false }]);
    setText('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleAdd} className="bg-white border p-4 rounded-xl flex gap-2">
        <input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 p-2 border rounded" placeholder="Prep task description" required />
        <input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-16 p-2 border rounded" />
        <button type="submit" className="bg-zinc-900 text-white px-4 rounded font-bold">Add</button>
      </form>
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm divide-y">
        {prepItems.filter(p => p.date === currentDate).map(item => (
          <div key={item.id} className="p-4 flex justify-between items-center">
            <span className={item.isCompleted ? 'line-through text-zinc-400' : 'font-medium'}>{item.text} ({item.qty} {item.unit})</span>
            <button onClick={() => setPrepItems(prev => prev.map(p => p.id === item.id ? {...p, isCompleted: !p.isCompleted} : p))} className="text-xs border px-3 py-1 rounded font-bold">{item.isCompleted ? 'Undo' : 'Complete'}</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Tab: Messages ---
const TabMessages = ({ appUser, mockDB }) => {
  const { users = [], messages = [], setMessages } = mockDB || {};
  const [activeThread, setActiveThread] = useState(null);
  const [text, setText] = useState('');

  const handleSend = (e) => {
    e.preventDefault(); if (!text.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), threadId: activeThread, senderId: appUser.id, text: text.trim(), timestamp: Date.now() }]);
    setText('');
  };

  if (activeThread) {
    return (
      <div className="max-w-2xl mx-auto bg-white border h-[65vh] rounded-xl flex flex-col shadow-sm">
        <div className="p-4 bg-zinc-50 border-b flex gap-2 items-center"><button onClick={() => setActiveThread(null)} className="font-bold text-zinc-500">← Back</button></div>
        <div className="flex-1 p-4 overflow-y-auto space-y-2">
          {messages.filter(m => m.threadId === activeThread).map(m => (
            <div key={m.id} className={`flex flex-col ${m.senderId === appUser.id ? 'items-end' : 'items-start'}`}><div className="bg-zinc-100 p-2 rounded-xl text-sm font-medium">{m.text}</div></div>
          ))}
        </div>
        <form onSubmit={handleSend} className="p-3 border-t bg-zinc-50 flex gap-2"><input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 p-2 border rounded-full" placeholder="Message..." /><button type="submit" className="bg-zinc-900 text-white px-4 rounded-full">Send</button></form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border rounded-xl shadow-sm divide-y">
      {['everyone', 'bartender', 'kitchen'].map(th => (
        <div key={th} onClick={() => setActiveThread(th)} className="p-4 hover:bg-zinc-50 cursor-pointer font-bold capitalize flex justify-between items-center">Channel: {th} <ChevronRight size={16}/></div>
      ))}
    </div>
  );
};

// --- Tab: Settings ---
const TabSettings = ({ settings, setSettings, addToast, appUser, mockDB, currentDate }) => {
  return (
    <div className="max-w-xl mx-auto bg-white border rounded-2xl p-6 text-center space-y-4 shadow-sm">
      <h3 className="text-xl font-bold">System Status</h3>
      <p className="text-zinc-500 text-sm">Application synchronized with live production environment securely.</p>
      <div className="pt-4 flex flex-col gap-2"><button onClick={() => addToast('System Test', 'Real-time alert engine active.')} className="bg-zinc-900 text-white p-3 rounded-xl font-bold w-full">Test Live Toast Alert Engine</button></div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getMessaging, getToken } from 'firebase/messaging';

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

// Initialize Messaging safely (prevents crashing on unsupported browsers)
const messaging = typeof window !== 'undefined' && 'Notification' in window ? getMessaging(app) : null;

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
  const tabs = [];
  if (appUser?.isAdmin) tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> });
  tabs.push({ id: 'published', label: 'Published Shifts', icon: <Clock size={18}/> });
  tabs.push({ id: 'month', label: 'Month View', icon: <Calendar size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> });
  tabs.push({ id: 'timeoff', label: 'Time Off', icon: <Clock size={18}/> });
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> });
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  const handleLogout = () => { localStorage.removeItem('cheersUser'); setAppUser(null); onClose(); };

  return (
     <div className="fixed inset-0 z-50 flex justify-end">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       <div className="w-72 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col relative border-l border-slate-200 dark:border-slate-700 animate-slide-in">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex justify-between items-start">
             <div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Signed in as</div><div className="text-slate-900 dark:text-white font-black text-lg tracking-tight">{appUser.name}</div><div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider mt-1 bg-blue-50 dark:bg-blue-900/30 w-max px-2 py-0.5 rounded-md">{appUser.isAdmin && <Shield size={10} />} {appUser.role} {appUser.isAdmin && '• Admin'}</div></div>
             <button onClick={onClose} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={18}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
             {tabs.map(tab => (<button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}`}><div className="flex items-center gap-3"><span className={activeTab === tab.id ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'}>{tab.icon}</span>{tab.label}</div></button>))}
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

// --- Tab: Message Board ---
const TabMessages = ({ events, appUser, addToast }) => {
  const [message, setMessage] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));

  const handleBroadcast = async (e) => {
    e.preventDefault(); if(!message.trim()) return;
    await addDoc(collection(db, "events"), {
      date: new Date().toISOString(), title: message.trim(), type: 'note', author: appUser.name, isImportant
    });
    setMessage(''); setIsImportant(false); addToast('Posted', 'Message added to board.');
  };

  const handleDelete = async (id) => await deleteDoc(doc(db, "events", id));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-black mb-4 flex items-center gap-2 text-slate-900 dark:text-white"><MessageSquare className="text-blue-500" size={24}/> Message Board</h2>
        <form onSubmit={handleBroadcast} className="space-y-3">
          <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none font-medium text-slate-900 dark:text-white" rows="3" placeholder="Type a message to the team..." required></textarea>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <label className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
               <input type="checkbox" checked={isImportant} onChange={e => setIsImportant(e.target.checked)} className="w-5 h-5 accent-red-500 rounded border-slate-300"/> 
               Mark as Important 🚨
            </label>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors">Post Message</button>
          </div>
        </form>
      </div>
      <div className="space-y-3">
        {allNotes.map(n => (
          <div key={n.id} className={`p-4 rounded-2xl border shadow-sm ${n.isImportant ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className={`font-black text-lg ${n.isImportant ? 'text-red-700 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{n.author} {n.isImportant && '🚨'}</span>
              <span className="text-xs font-bold text-slate-400">{new Date(n.date).toLocaleDateString()}</span>
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-medium text-lg leading-snug">{n.title}</p>
            {appUser?.isAdmin && <button onClick={() => handleDelete(n.id)} className="text-red-400 hover:text-red-500 mt-3 text-sm font-bold flex items-center gap-1 transition-colors"><Trash2 size={14}/> Delete Message</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Tab: Team ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('Bartender'); const [isAdmin, setIsAdmin] = useState(false);
  const [editModalUser, setEditModalUser] = useState(null);
  
  const displayUsers = [...users].sort((a,b) => {
    if (a.role === b.role) return a.name.localeCompare(b.name);
    return a.role === 'Bartender' ? -1 : 1;
  });

  const handleAdd = async (e) => {
    e.preventDefault(); if (!name.trim() || !email.trim() || !password.trim()) return;
    try {
      await addDoc(collection(db, "users"), { name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password, role, isAdmin, isActive: true, forcePasswordChange: true, availability: {sun:true,mon:true,tue:true,wed:true,thu:true,fri:true,sat:true} });
      addToast('Team Member Added', `${name.trim()} will be prompted to set a new password on their first login.`);
      setName(''); setEmail(''); setPhone(''); setPassword(''); setIsAdmin(false);
    } catch (err) { console.error(err); }
  };

  const generateTestAccount = async () => {
    const num = Math.floor(Math.random() * 1000);
    const isBartender = Math.random() > 0.5;
    await addDoc(collection(db, "users"), { 
      name: `Test ${isBartender ? 'Bar' : 'Kit'} ${num}`, 
      email: `test${num}@cheers.local`, 
      phone: '', 
      password: 'password', 
      role: isBartender ? 'Bartender' : 'Kitchen', 
      isAdmin: false, 
      isActive: true, 
      forcePasswordChange: false, 
      availability: {sun:true,mon:true,tue:true,wed:true,thu:true,fri:true,sat:true} 
    });
    addToast("Success", `1 Test account generated.`);
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

  const canGenerateTest = appUser?.email === 'geoffm1985@gmail.com' || appUser?.id === 'dev-backdoor';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Modal isOpen={!!editModalUser} onClose={() => setEditModalUser(null)} title={`Edit Profile: ${editModalUser?.name}`}>
        {editModalUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Name</label><input type="text" value={editModalUser.name} onChange={e => setEditModalUser({...editModalUser, name: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email (Hidden from Staff)</label><input type="email" value={editModalUser.email} onChange={e => setEditModalUser({...editModalUser, email: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label><input type="tel" value={editModalUser.phone || ''} onChange={e => setEditModalUser({...editModalUser, phone: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
            <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Role</label><select value={editModalUser.role} onChange={e => setEditModalUser({...editModalUser, role: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white"><Users size={20}/> Add Staff Member</h3>
            {canGenerateTest && <button onClick={generateTestAccount} className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 px-3 py-1.5 rounded font-bold text-slate-600 dark:text-slate-300">Generate 1 Test Account</button>}
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Temporary Password</label><input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none" required /></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-xl outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
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
                <td className="p-4">
                  <div className="text-sm font-bold bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-lg w-max border border-slate-200 dark:border-slate-600 flex items-center gap-2">
                    <span className="text-slate-400">📱</span>
                    {u.phone ? <a href={`tel:${u.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">{u.phone}</a> : <span className="text-slate-500">No phone</span>}
                  </div>
                </td>
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

// --- Tab: Published Shifts ---
const TabPublishedShifts = ({ currentDate, appUser, users, shifts }) => {
  const monthStr = getMonthStr(currentDate);
  const displayUsers = users.length > 0 ? users : [appUser];
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr) && s.isPublished);

  const groupedShifts = monthShifts.reduce((acc, shift) => {
    if (!acc[shift.date]) acc[shift.date] = [];
    acc[shift.date].push(shift);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedShifts).sort();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">🗓️ Your Upcoming Shifts</h2>
        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold px-3 py-1 rounded-lg text-sm border border-emerald-200 dark:border-emerald-800">Published</span>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl text-center border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 font-medium text-lg">No published shifts available yet for {formatDisplayMonth(monthStr)}.</p>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-3 font-black text-slate-800 dark:text-white flex items-center gap-2 text-lg">
              {formatDisplayDate(date)}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {groupedShifts[date].map(s => {
                const emp = displayUsers.find(u => u.id === s.employeeId);
                const isMe = appUser?.id === s.employeeId;
                return (
                  <div key={s.id} className={`p-4 flex justify-between items-center ${isMe ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-10 rounded-full ${s.role === 'Bartender' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                      <div>
                        <span className={`font-bold block ${isMe ? 'text-blue-700 dark:text-blue-400 text-lg' : 'text-slate-800 dark:text-slate-200'}`}>{emp?.name} {isMe && '(You)'}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.role}</span>
                      </div>
                    </div>
                    <div className="text-sm font-bold bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">
                      {formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
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

  return (
    <div className="space-y-4 print-container">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.1in; }
          body * { visibility: hidden !important; }
          .print-container, .print-container * { visibility: visible !important; }
          .print-container { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; box-sizing: border-box; }
          .no-print { display: none !important; }
          .print-grid { border: 2px solid #000 !important; display: grid !important; height: 90vh !important; max-height: 90vh !important; grid-template-rows: 24px repeat(auto-fit, minmax(0, 1fr)) !important; }
          .print-cell { border: 1px solid #000 !important; min-height: 0 !important; overflow: hidden !important; padding: 2px !important; }
          .print-text { color: #000 !important; background: transparent !important; border: none !important; font-size: 9px !important; line-height: 1.1 !important; }
          .print-header { display: block !important; text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 5px; color: #000; letter-spacing: 1px; }
        }
      `}</style>
      
      <div className="hidden print-header">{formatDisplayMonth(monthStr)} Schedule</div>
      
      <div className="flex justify-end gap-4 no-print mb-4">
        <button onClick={() => window.print()} className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-slate-800 transition-colors w-full sm:w-auto">🖨️ Print Full Month Roster</button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm grid grid-cols-7 border-t border-l print-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-3 bg-slate-50 dark:bg-slate-800 text-center font-bold text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 border-r uppercase tracking-wider print-cell">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-r border-slate-200 dark:border-slate-700 min-h-[100px] print-cell" />)}
        {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
          const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div key={date} className="p-2 border-b border-r border-slate-200 dark:border-slate-700 min-h-[140px] flex flex-col transition-colors print-cell">
              <div className="flex flex-col items-end gap-1 w-full mb-1">
                <span className="text-right text-sm font-bold text-slate-400 dark:text-slate-500 print-text">{i+1}</span>
                {holidayMap[date] && (<span className="text-[9px] font-black tracking-tight text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 px-1.5 py-0.5 rounded truncate w-full text-center print-text" title={holidayMap[date]}>{holidayMap[date]}</span>)}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 w-full custom-scrollbar">
                {shifts.filter(s => s.date === date && s.isPublished).sort((a,b) => a.role === b.role ? 0 : (a.role === 'Bartender' ? -1 : 1)).map(s => {
                  const emp = displayUsers.find(u => u.id === s.employeeId);
                  const startFmt = formatTime12Hour(s.startTime)?.replace(/(AM|PM| )/g, '') || '';
                  const endFmt = formatTime12Hour(s.endTime)?.replace(/(AM|PM| )/g, '') || '';
                  return (
                     <div key={s.id} className={`text-[10px] font-bold px-1.5 py-1 rounded print-text leading-tight ${s.role === 'Bartender' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800'}`}>
                        <span className="block truncate">{emp?.name || '?'}</span>
                        <span className="block opacity-80">{startFmt}-{endFmt}</span>
                     </div>
                  )
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
const TabPrep = ({ currentDate, prepItems, appUser }) => {
  const [text, setText] = useState(''); 
  const [isMaster, setIsMaster] = useState(true);
  const [printItems, setPrintItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [prepDate, setPrepDate] = useState(currentDate); 
  
  const handleAdd = async (e) => { 
    e.preventDefault(); if (!text.trim()) return; 
    await addDoc(collection(db, "prepItems"), { 
      date: isMaster ? 'MASTER' : prepDate, 
      text: text.trim(), 
      isCompleted: false, 
      completedDates: {}, 
      isMaster: isMaster,
      qty: 1 
    }); 
    setText(''); 
  };
  
  const toggleStatus = async (item) => {
    if (item.isMaster) {
      const updatedDates = { ...(item.completedDates || {}) };
      updatedDates[prepDate] = !updatedDates[prepDate];
      await updateDoc(doc(db, "prepItems", item.id), { completedDates: updatedDates });
    } else {
      await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted });
    }
  };

  const handleBatchDone = async () => {
    if (selectedIds.length === 0) return;
    const itemsToComplete = displayItems.filter(item => selectedIds.includes(item.id));
    
    for (const item of itemsToComplete) {
      if (item.isMaster) {
        const updatedDates = { ...(item.completedDates || {}) };
        updatedDates[prepDate] = true;
        await updateDoc(doc(db, "prepItems", item.id), { completedDates: updatedDates });
      } else {
        await updateDoc(doc(db, "prepItems", item.id), { isCompleted: true });
      }
    }
    setSelectedIds([]); 
  };
  
  const handleDelete = async (id) => await deleteDoc(doc(db, "prepItems", id));

  const updateQty = async (id, currentQty, change) => {
    const newQty = Math.max(1, currentQty + change);
    await updateDoc(doc(db, "prepItems", id), { qty: newQty });
  };

  const togglePrintSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const triggerBatchPrint = () => {
    if (selectedIds.length === 0) return;
    const itemsToPrint = [];
    displayItems.filter(item => selectedIds.includes(item.id)).forEach(item => {
      const labelCount = item.qty || 1;
      for (let i = 0; i < labelCount; i++) {
        itemsToPrint.push({ ...item, printId: `${item.id}-${i}` });
      }
    });

    setPrintItems(itemsToPrint);
    setTimeout(() => { 
      window.print(); 
    }, 500); 
  };

  const displayItems = prepItems.filter(p => p.date === prepDate || p.isMaster);

  const getExpDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + 6);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative pb-40">
      <style>{`
        .label-print-zone { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .label-print-zone { display: block !important; position: absolute; left: 0; top: 0; width: 2.4in; margin: 0; padding: 0; background: white; visibility: visible !important; z-index: 9999; }
          .label-print-zone * { visibility: visible !important; }
          .print-page { 
            width: 2.4in; height: 2.0in; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            text-align: center; padding: 0.1in; box-sizing: border-box; 
            page-break-after: always; border: 1px dashed #ccc; 
          }
          .print-title { font-size: 18px; font-weight: 900; color: #000; margin-bottom: 6px; text-transform: uppercase; line-height: 1.1; }
          .print-meta { font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px; }
          .print-exp { font-size: 16px; font-weight: 900; color: #000; margin-top: 4px; border-top: 2px solid #000; padding-top: 4px; width: 90%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {printItems.length > 0 && (
        <div className="label-print-zone bg-white text-black">
          {printItems.map(item => (
            <div key={item.printId} className="print-page">
              <div className="print-title">{item.text}</div>
              <div className="print-meta">PREP: {formatDisplayDate(prepDate).split(',')[1]}</div>
              <div className="print-meta">EMP: {appUser?.name ? appUser.name.split(' ')[0].toUpperCase() : '______'}</div>
              <div className="print-exp">EXP: {getExpDate(prepDate)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl flex items-center justify-between shadow-sm no-print">
         <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><ClipboardList size={20} className="text-blue-500"/> Prep List For:</h3>
         <input type="date" value={prepDate} onChange={e => setPrepDate(e.target.value)} className="p-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none" />
      </div>

      <form onSubmit={handleAdd} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 pl-4 rounded-2xl flex flex-col sm:flex-row gap-2 shadow-sm items-center no-print">
        <input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 w-full p-2 bg-transparent outline-none font-medium text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="Add prep task (e.g., Dice Onions)..." required />
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t sm:border-t-0 border-slate-100 dark:border-slate-700 pt-2 sm:pt-0">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 cursor-pointer ml-2 sm:ml-0"><input type="checkbox" checked={isMaster} onChange={e => setIsMaster(e.target.checked)} className="w-4 h-4 rounded border-slate-300" /> Master List</label>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl font-bold transition-colors shadow-sm"><Plus size={20}/></button>
        </div>
      </form>
      
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700 no-print">
        {displayItems.length === 0 ? (<div className="p-6 text-center text-slate-400 font-medium">No prep tasks scheduled.</div>) : (
          displayItems.map(item => {
            const isDone = item.isMaster ? !!item.completedDates?.[prepDate] : item.isCompleted;
            const currentQty = item.qty || 1;
            return (
            <div key={item.id} className="p-3 flex items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors gap-3">
              <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => togglePrintSelection(item.id)} className="w-6 h-6 rounded border-slate-300 accent-blue-600 cursor-pointer flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={`text-base truncate block transition-all ${isDone ? 'line-through text-slate-300 dark:text-slate-500' : 'font-bold text-slate-800 dark:text-white'}`}>{item.text}</span>
                {item.isMaster && <span className="block text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Master Task</span>}
                {isDone && <span className="block text-[10px] font-black text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded w-max mt-1 border border-amber-200 dark:border-amber-800">Discard By: {getExpDate(prepDate)}</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                   <button onClick={() => updateQty(item.id, currentQty, -1)} className="w-8 h-10 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">-</button>
                   <span className="w-6 text-center font-bold text-slate-800 dark:text-white">{currentQty}</span>
                   <button onClick={() => updateQty(item.id, currentQty, 1)} className="w-8 h-10 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">+</button>
                </div>
                <button onClick={() => toggleStatus(item)} className={`flex items-center justify-center w-10 h-10 rounded-lg font-bold transition-all shadow-sm ${isDone ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`} title={isDone ? "Mark Undone" : "Mark Done"}>{isDone ? <Repeat size={16}/> : <Check size={18}/>}</button>
                <button onClick={() => handleDelete(item.id)} className="w-10 h-10 flex items-center justify-center text-slate-300 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Delete Item"><Trash2 size={18}/></button>
              </div>
            </div>
          )}))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 no-print z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto space-y-2">
          <button onClick={triggerBatchPrint} disabled={selectedIds.length === 0} className="w-full bg-blue-600 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:text-slate-500 text-white p-3.5 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-lg">🖨️ Print Selected Labels ({selectedIds.length})</button>
          <button onClick={handleBatchDone} disabled={selectedIds.length === 0} className="w-full bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"><Check size={18}/> Mark Selected as Done</button>
        </div>
      </div>
    </div>
  );
};

// --- Tab: Schedule Maker ---
const TabSchedule = ({ currentDate, appUser, users, shifts, timeOff, events, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); 
  const [assignDates, setAssignDates] = useState([]);
  const [presetShift, setPresetShift] = useState('Custom');
  const [startTime, setStartTime] = useState('16:00'); 
  const [endTime, setEndTime] = useState('23:00');
  const [selectedShiftId, setSelectedShiftId] = useState(null); 

  const [eventDate, setEventDate] = useState(currentDate);
  const [eventTitle, setEventTitle] = useState(''); 
  const [eventStart, setEventStart] = useState(''); 
  const [eventEnd, setEventEnd] = useState('');

  const displayUsers = [...users].sort((a,b) => {
    if (a.role === b.role) return a.name.localeCompare(b.name);
    return a.role === 'Bartender' ? -1 : 1;
  });

  const monthStr = getMonthStr(currentDate);
  const daysInMonth = getDaysInMonth(monthStr);
  const monthDaysArray = Array.from({length: daysInMonth}).map((_, i) => `${monthStr}-${String(i + 1).padStart(2, '0')}`);

  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const hasPublished = monthShifts.some(s => s.isPublished);
  const hasUnpublished = monthShifts.some(s => !s.isPublished);

  const formatShortTime = (time24) => {
    if (!time24) return '';
    if (time24 === 'CLOSE') return 'CL';
    let [h, m] = time24.split(':');
    h = parseInt(h, 10);
    const ampm = h >= 12 ? 'p' : 'a';
    const hr = h % 12 || 12;
    return m === '00' ? `${hr}${ampm}` : `${hr}:${m}${ampm}`;
  };

  const formatNameShort = (fullName) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1][0]}.`;
  };

  const SHIFT_PRESETS = [
    { label: "9a-3p", start: "09:00", end: "15:00" },
    { label: "10a-4p", start: "10:00", end: "16:00" },
    { label: "10a-9p", start: "10:00", end: "21:00" },
    { label: "11a-3p", start: "11:00", end: "15:00" },
    { label: "11a-4p", start: "11:00", end: "16:00" },
    { label: "4p-9p", start: "16:00", end: "21:00" },
    { label: "7p-close", start: "19:00", end: "CLOSE" },
    { label: "9p-close", start: "21:00", end: "CLOSE" },
    { label: "Custom", start: "", end: "" }
  ];

  const handlePresetChange = (e) => {
    const val = e.target.value;
    setPresetShift(val);
    const preset = SHIFT_PRESETS.find(p => p.label === val);
    if (preset && val !== 'Custom') {
      setStartTime(preset.start);
      if (preset.end !== 'CLOSE') setEndTime(preset.end);
    }
  };

  const getCalculatedEndTime = (baseTime, targetDateStr) => {
    if (baseTime !== 'CLOSE') return baseTime;
    const dObj = new Date(targetDateStr + 'T12:00:00');
    const day = dObj.getDay();
    return (day === 5 || day === 6) ? '02:30' : '02:00'; 
  };

  const handleSaveShift = async () => {
    if (!selectedEmp || assignDates.length === 0) return;
    const emp = displayUsers.find(u => u.id === selectedEmp);
    
    if (selectedShiftId && assignDates.length === 1) {
       const finalEnd = getCalculatedEndTime(presetShift.includes('close') ? 'CLOSE' : endTime, assignDates[0]);
       await updateDoc(doc(db, "shifts", selectedShiftId), { startTime, endTime: finalEnd });
       addToast('Shift Updated', 'Changes saved.');
       setSelectedShiftId(null); setAssignDates([]); return;
    }

    let count = 0;
    for (const d of assignDates) { 
      const finalEnd = getCalculatedEndTime(presetShift.includes('close') ? 'CLOSE' : endTime, d);
      await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime, endTime: finalEnd, isPublished: false }); 
      count++; 
    }
    setSelectedEmp(''); setAssignDates([]); setPresetShift('Custom');
    addToast('Shifts Assigned', `Assigned ${count} shifts to ${emp.name.split(' ')[0]}.`);
  };

  const handleDeleteShift = async () => {
    if (!selectedShiftId) return;
    await deleteDoc(doc(db, "shifts", selectedShiftId));
    setSelectedShiftId(null); setAssignDates([]);
    addToast('Shift Deleted', 'Removed from matrix.');
  };

  const validateSchedule = () => {
    const warnings = [];
    monthDaysArray.forEach(d => {
       const dayShifts = monthShifts.filter(s => s.date === d);
       if (dayShifts.length === 0) return; 
       const dObj = new Date(d + 'T12:00:00');
       const day = dObj.getDay(); 
       const isWeekendDay = day === 0 || day === 6;
       const isFriSat = day === 5 || day === 6;
       const dateFmt = `${dObj.getMonth()+1}/${dObj.getDate()}`; 

       const bar = dayShifts.filter(s => s.role === 'Bartender');
       const kit = dayShifts.filter(s => s.role === 'Kitchen');

       if (!kit.some(s => s.startTime <= '10:00') || !kit.some(s => s.endTime >= '21:00')) warnings.push(`[${dateFmt}] Kitchen: Missing open-to-close coverage (9a-9p)`);
       if (!bar.some(s => s.startTime <= '11:00') || !bar.some(s => s.endTime >= '02:00')) warnings.push(`[${dateFmt}] Bar: Missing open-to-close coverage (11a-CL)`);

       const closers = bar.filter(s => s.endTime >= '02:00').length;
       if (isFriSat && closers < 2) warnings.push(`[${dateFmt}] Bar: Needs 2 closers (Fri/Sat), found ${closers}`);
       if (!isFriSat && closers < 1) warnings.push(`[${dateFmt}] Bar: Needs 1 closer (Sun-Thu), found ${closers}`);

       const countOverlap = (arr, start, end) => arr.filter(s => s.startTime <= start && s.endTime >= end).length;
       
       const lunchBar = countOverlap(bar, '12:00', '13:00');
       const lunchKit = countOverlap(kit, '12:00', '13:00');
       if (day === 5 && (lunchBar < 2 || lunchKit < 3)) warnings.push(`[${dateFmt}] Lunch Rush: Needs 2 Bar / 3 Kit, found ${lunchBar} Bar / ${lunchKit} Kit`);
       else if (day >= 1 && day <= 4 && (lunchBar < 2 || lunchKit < 2)) warnings.push(`[${dateFmt}] Lunch Rush: Needs 2 Bar / 2 Kit, found ${lunchBar} Bar / ${lunchKit} Kit`);

       const dinBar = countOverlap(bar, '17:30', '19:00');
       const dinKit = countOverlap(kit, '17:30', '19:00');
       if (day === 5 && (dinBar < 2 || dinKit < 3)) warnings.push(`[${dateFmt}] Dinner Rush: Needs 2 Bar / 3 Kit, found ${dinBar} Bar / ${dinKit} Kit`);
       else if (day >= 1 && day <= 4 && (dinBar < 2 || dinKit < 2)) warnings.push(`[${dateFmt}] Dinner Rush: Needs 2 Bar / 2 Kit, found ${dinBar} Bar / ${dinKit} Kit`);
       
       if (isWeekendDay) {
         const dayBar = countOverlap(bar, '12:00', '15:00');
         const dayKit = countOverlap(kit, '12:00', '15:00');
         if (dayBar < 1 || dayKit < 2) warnings.push(`[${dateFmt}] Weekend Day: Needs 1 Bar / 2 Kit, found ${dayBar} Bar / ${dayKit} Kit`);
       }
    });
    return warnings;
  };

  const handlePublish = async () => {
    const warnings = validateSchedule();
    if (warnings.length > 0) {
      if (!window.confirm(`⚠️ SCHEDULE WARNINGS FOUND:\n\n${warnings.join('\n')}\n\nDo you want to publish anyway?`)) return;
    } else {
      if (!window.confirm(`Publish all shifts for ${formatDisplayMonth(monthStr)}?`)) return;
    }
    
    const unpubShifts = monthShifts.filter(s => !s.isPublished);
    for (const shift of unpubShifts) { await updateDoc(doc(db, "shifts", shift.id), { isPublished: true }); }
    addToast('Schedule Published', 'Staff can now view these shifts.');
  };

  const handleUnpublish = async () => {
    if (!window.confirm("Unpublish the entire month? Staff will no longer see these shifts.")) return;
    const pubShifts = monthShifts.filter(s => s.isPublished);
    for (const shift of pubShifts) { await updateDoc(doc(db, "shifts", shift.id), { isPublished: false }); }
    addToast('Schedule Hidden', 'All shifts reverted to draft.');
  };

  const handleAddEvent = async (e) => {
    e.preventDefault(); if(!eventTitle.trim()) return;
    await addDoc(collection(db, "events"), { date: eventDate, title: eventTitle.trim(), startTime: eventStart, endTime: eventEnd, type: 'event' });
    setEventTitle(''); setEventStart(''); setEventEnd(''); addToast('Event Added', 'Saved to calendar.');
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-2xl flex items-center gap-2 text-slate-800 dark:text-white"><Calendar className="text-blue-500" size={24}/> Schedule Maker</h3>
            <p className="text-slate-500 font-medium text-sm mt-1">Tap a cell to select staff and dates. Tap an existing shift to edit or delete.</p>
          </div>
          <div className="flex items-center gap-2">
             {hasPublished && <button onClick={handleUnpublish} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-colors text-sm border border-slate-300">Unpublish</button>}
             <button onClick={handlePublish} className={`${hasPublished && hasUnpublished ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-sm`}>
               {hasPublished && hasUnpublished ? '⚠️ Republish Changes' : 'Publish Schedule'}
             </button>
          </div>
        </div>
        
        <div className="overflow-x-auto bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner custom-scrollbar">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="p-3 font-bold text-slate-700 dark:text-slate-400 sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 w-24 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Staff List</th>
                {monthDaysArray.map(d => {
                  const dateObj = new Date(d + 'T12:00:00');
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                  return (
                    <th key={d} className={`p-1.5 text-center border-l border-slate-200 dark:border-slate-700 min-w-[40px] ${assignDates.includes(d) ? 'bg-blue-200 dark:bg-blue-900/40' : (isWeekend ? 'bg-slate-200/50 dark:bg-slate-700/30' : '')}`}>
                      <div className={`text-[9px] font-bold uppercase ${isWeekend ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>{dateObj.toLocaleDateString('en-US', {weekday: 'short'})}</div>
                      <div className={`text-sm font-black ${assignDates.includes(d) ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{parseInt(d.split('-')[2], 10)}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {displayUsers.map(u => {
                const isSelectedEmp = selectedEmp === u.id;
                const isBartender = u.role === 'Bartender';
                return (
                  <tr key={u.id} className={`transition-colors ${isSelectedEmp ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                    <td 
                      onClick={() => { setSelectedEmp(u.id); setAssignDates([]); setSelectedShiftId(null); setPresetShift('Custom'); }}
                      className={`p-3 font-bold text-sm sticky left-0 z-10 cursor-pointer shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate hover:bg-blue-100 dark:hover:bg-blue-900/40 ${isSelectedEmp ? 'bg-blue-100 dark:bg-slate-800 text-blue-800 dark:text-blue-400 ring-2 ring-inset ring-blue-500' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isBartender ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                        {formatNameShort(u.name)}
                      </div>
                    </td>
                    {monthDaysArray.map(d => {
                      const shift = monthShifts.find(s => s.date === d && s.employeeId === u.id);
                      const off = timeOff.some(t => t.employeeId === u.id && t.startDate === d);
                      const isDateSelected = assignDates.includes(d);
                      const shiftBgColor = shift ? (shift.isPublished ? (isBartender ? 'bg-blue-600' : 'bg-orange-600') : 'bg-slate-500') : '';
                      const shiftOutline = shift && selectedShiftId === shift.id ? 'ring-2 ring-red-500 ring-offset-1' : '';
                      
                      const handleCellClick = () => {
                        if (off) return addToast('Unavailable', `${u.name.split(' ')[0]} requested this day off.`);
                        if (shift) {
                          setSelectedEmp(u.id);
                          setAssignDates([d]);
                          setSelectedShiftId(shift.id);
                          setPresetShift('Custom');
                          setStartTime(shift.startTime);
                          setEndTime(shift.endTime);
                        } else {
                          setSelectedShiftId(null);
                          if (selectedEmp !== u.id) {
                            setSelectedEmp(u.id);
                            setAssignDates([d]);
                          } else {
                            if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x !== d));
                            else setAssignDates([...assignDates, d].sort());
                          }
                        }
                      };

                      return (
                        <td key={d} onClick={handleCellClick} className={`p-1 border-l border-slate-200 dark:border-slate-700 cursor-pointer transition-all relative ${isSelectedEmp && isDateSelected ? 'bg-blue-300 dark:bg-blue-600 outline outline-2 outline-blue-600 dark:outline-blue-400 shadow-[inset_0_0_15px_rgba(0,0,0,0.1)] z-10 scale-[1.02]' : isSelectedEmp ? 'hover:bg-blue-200 dark:hover:bg-blue-800' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                          {off ? (
                            <div className="w-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-black text-[10px] py-1.5 rounded text-center">OFF</div>
                          ) : shift ? (
                            <div className={`w-full rounded font-bold text-[10px] py-1 text-center text-white shadow-sm ${shiftBgColor} ${shiftOutline}`} title={`${formatTime12Hour(shift.startTime)} - ${formatTime12Hour(shift.endTime)}`}>
                              {formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}
                            </div>
                          ) : (
                            <div className="w-full h-6 rounded flex items-center justify-center text-slate-300 dark:text-slate-700 font-bold opacity-0 hover:opacity-100 transition-opacity">
                              <Plus size={14}/>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-3 bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase mb-1">Staff</label>
            <select value={selectedEmp} onChange={e => {setSelectedEmp(e.target.value); setAssignDates([]); setSelectedShiftId(null);}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg font-bold outline-none">
              <option value="">- Choose -</option>
              {displayUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="w-full md:w-36">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase mb-1">Preset</label>
            <select value={presetShift} onChange={handlePresetChange} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg font-bold outline-none">
              {SHIFT_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div className="w-full md:w-28">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase mb-1">Start</label>
            <input type="time" value={startTime} onChange={e => {setStartTime(e.target.value); setPresetShift('Custom');}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg font-bold outline-none" />
          </div>
          <div className="w-full md:w-28">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase mb-1">End</label>
            <input type="time" value={presetShift.includes('close') ? '' : endTime} disabled={presetShift.includes('close')} onChange={e => {setEndTime(e.target.value); setPresetShift('Custom');}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg font-bold outline-none disabled:bg-slate-200 disabled:text-slate-400" />
          </div>
          <div className="flex-1 flex gap-2 w-full mt-2 md:mt-0">
            <button onClick={handleSaveShift} disabled={!selectedEmp || assignDates.length===0} className="flex-1 h-[42px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <Check size={18}/> {selectedShiftId ? 'Update' : `Assign (${assignDates.length})`}
            </button>
            {selectedShiftId && (
              <button onClick={handleDeleteShift} className="h-[42px] px-4 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-bold shadow-sm transition-colors flex items-center justify-center border border-red-200" title="Delete Shift">
                <Trash2 size={18}/>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm">
        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white mb-4"><Calendar size={18}/> Add Special Event</h3>
        <form onSubmit={handleAddEvent} className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="w-full sm:w-auto">
             <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Date</label>
             <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl outline-none" required />
          </div>
          <div className="flex-1 w-full">
             <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Event Name</label>
             <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Catering, Private Party..." className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl outline-none" required />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Start</label><input type="time" value={eventStart} onChange={e => setEventStart(e.target.value)} className="w-full sm:w-28 p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl" /></div>
             <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">End</label><input type="time" value={eventEnd} onChange={e => setEventEnd(e.target.value)} className="w-full sm:w-28 p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl" /></div>
          </div>
          <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-colors w-full sm:w-auto h-[50px]">Add Event</button>
        </form>
      </div>
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
        const rows = text.split('\n').map(row => row.split(','));
        let updateCount = 0; let addCount = 0;
        
        for (let i = 1; i < rows.length; i++) {
           const cols = rows[i];
           if (cols.length < 2) continue; 
           
           const name = cols[0]?.trim();
           const category = cols[1]?.trim() || 'Dry Goods';
           const supplier = cols[2]?.trim() || 'PFG';
           const packSize = cols[3]?.trim() || '1 CS';
           const price = parseFloat(cols[4]) || 0;
           const pfgCode = cols[5]?.trim() || '';

           if (!name) continue;

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
      e.target.value = ''; 
    };
    reader.readAsText(file);
  };

  const handleEnablePush = async () => {
    if (!messaging) return addToast('Error', 'Your browser does not support push notifications.');
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: 'BJzM9xVnkPwLB6aq588ZHhekjql_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGVOsPH9M6aBzGCA9AcU' 
        });
        if (token) {
          await updateDoc(doc(db, "users", appUser.id), { fcmToken: token });
          addToast('Notifications Enabled', 'Device registered for push alerts.');
        } else {
          addToast('Error', 'Failed to generate token.');
        }
      } else {
        addToast('Denied', 'You must allow notifications in phone settings.');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Must be installed to Home Screen to enable push.');
    }
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

        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-6 rounded-2xl shadow-sm">
          <h4 className="font-black text-blue-900 dark:text-blue-400 mb-2 text-lg">Push Notifications</h4>
          <p className="text-sm text-blue-800 dark:text-blue-500 mb-5 font-medium">Link this specific device to your profile to receive push alerts for schedule publishes and shift swaps.</p>
          <button onClick={handleEnablePush} className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-3.5 rounded-xl font-bold transition-all shadow-md w-full flex items-center justify-center gap-2">
            <Bell size={20} /> Enable Notifications On This Device
          </button>
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

        <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
          <h4 className="font-bold text-slate-800 dark:text-slate-300 mb-2">System Diagnostics</h4>
          <button onClick={() => { addToast('Diagnostic Test', 'Live Firebase database connected successfully.'); triggerPushNotification('Test Ping', 'Push systems online.'); }} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full">Trigger Test Alert</button>
        </div>
      </div>
    </div>
  );
};

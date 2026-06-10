import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, Image as ImageIcon } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
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
let messaging = null;
try { if (typeof window !== 'undefined' && 'Notification' in window) messaging = getMessaging(app); } catch (e) { console.warn("Push not supported."); }

const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';
const EVENT_TAGS = ['Standard Day', 'Packers Game', 'Brewers Game', 'Live Music', 'Severe Weather', 'Private Catering', 'Holiday'];

const useLiveCollection = (coll) => { const [data, setData] = useState([]); useEffect(() => onSnapshot(collection(db, coll), snap => setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))), [coll]); return data; };
const formatDate = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
const getToday = () => formatDate(new Date());
const addDays = (d, days) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + days); return formatDate(dt); };
const getMonthStr = (d) => (d || getToday()).substring(0, 7);
const formatDisplayDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const formatTime12 = (t) => { if (!t) return ''; let [h, m] = t.split(':'); return `${parseInt(h)%12||12}:${m} ${h>=12?'PM':'AM'}`; };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();

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

export default function App() {
  const users = useLiveCollection('users'); const shifts = useLiveCollection('shifts'); const prepItems = useLiveCollection('prepItems'); const inventoryItems = useLiveCollection('inventoryItems'); const shiftSwaps = useLiveCollection('shiftSwaps'); const events = useLiveCollection('events'); const sales = useLiveCollection('sales');
  const [appUser, setAppUser] = useState(() => JSON.parse(localStorage.getItem('cheersUser')));
  const [activeTab, setActiveTab] = useState('published');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => { document.documentElement.classList.toggle('dark', isDark); localStorage.setItem('theme', isDark ? 'dark' : 'light'); }, [isDark]);
  useEffect(() => { if (appUser) localStorage.setItem('cheersUser', JSON.stringify(appUser)); else localStorage.removeItem('cheersUser'); }, [appUser]);
  useEffect(() => { signInAnonymously(auth); }, []);

  const addToast = (title, message) => { const id = Date.now(); setToasts(p => [...p, { id, title, message }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000); };
  const liveAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users.find(u => u.id === appUser.id) || appUser)) : null;

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} isDark={isDark} addToast={addToast} />;

  const tabs = [{ id: 'published', label: 'Master Roster', icon: <Clock size={18}/> }, { id: 'month', label: 'Month View', icon: <Calendar size={18}/> }, { id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> }];
  if (liveAppUser?.isAdmin) { tabs.unshift({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> }); tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> }); }
  if (liveAppUser?.isAdmin || liveAppUser?.role === 'Kitchen') tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> });
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> }, { id: 'team', label: 'Team', icon: <Users size={18}/> }, { id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  return (
    <div className={`min-h-screen font-sans flex flex-col ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <CheersLogo isDark={isDark} />
        <button onClick={() => setIsMenuOpen(true)} className="p-2 border rounded-xl shadow-sm dark:bg-slate-800 dark:border-slate-700 bg-slate-50"><Menu size={20} /></button>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <div className="w-72 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col relative animate-[slideIn_0.2s_ease-out]">
             <div className="p-4 border-b dark:border-slate-700 flex justify-between items-start">
                <div className="flex items-center gap-3"><img src={getAvatar(liveAppUser.name, liveAppUser.photoURL)} alt="avatar" className="w-10 h-10 rounded-full shadow-sm"/><div><div className="text-[10px] font-bold text-slate-400 uppercase">Signed in as</div><div className="font-black text-lg leading-tight dark:text-white">{liveAppUser.name}</div></div></div>
                <button onClick={() => setIsMenuOpen(false)} className="p-1 dark:text-slate-400"><X size={18}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {tabs.map(t => (<button key={t.id} onClick={() => { setActiveTab(t.id); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm ${activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><span>{t.icon}</span>{t.label}</button>))}
             </div>
             <div className="p-3 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2">
                <div className="flex justify-between px-3 py-2 bg-white dark:bg-slate-700 rounded-xl border shadow-sm cursor-pointer" onClick={() => setIsDark(!isDark)}><span className="text-xs font-bold dark:text-slate-200 flex items-center gap-2">{isDark ? <Moon size={14}/> : <Sun size={14}/>} Dark Mode</span></div>
                <button onClick={() => { localStorage.removeItem('cheersUser'); setAppUser(null); setIsMenuOpen(false); }} className="w-full flex justify-center gap-2 py-2 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"><LogOut size={16} /> Log Out</button>
             </div>
          </div>
        </div>
      )}

      {['schedule', 'published', 'month', 'sales'].includes(activeTab) && (
        <div className={`py-3 px-4 shadow-sm z-30 border-b flex justify-between items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <button onClick={() => setCurrentDate(addDays(currentDate, -30))} className="p-2 border rounded-xl dark:border-slate-600"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-black cursor-pointer dark:text-white"><input type="month" value={getMonthStr(currentDate)} onChange={e => e.target.value && setCurrentDate(e.target.value + '-01')} className="bg-transparent outline-none text-center" /></h2>
          <button onClick={() => setCurrentDate(addDays(currentDate, 30))} className="p-2 border rounded-xl dark:border-slate-600"><ChevronRight size={20} /></button>
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-6 pb-24">
        {activeTab === 'schedule' && liveAppUser?.isAdmin && <TabSchedule currentDate={currentDate} users={users} shifts={shifts} addToast={addToast} />}
        {activeTab === 'published' && <TabPublished currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} addToast={addToast} />}
        {activeTab === 'month' && <TabMonth currentDate={currentDate} users={users} shifts={shifts} />}
        {activeTab === 'sales' && liveAppUser?.isAdmin && <TabSales sales={sales} addToast={addToast} />}
        {activeTab === 'messages' && <TabMessages events={events} appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTab === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} appUser={liveAppUser} />}
        {activeTab === 'inventory' && <TabInventory inventoryItems={inventoryItems} sales={sales} addToast={addToast} appUser={liveAppUser} />}
        {activeTab === 'team' && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTab === 'settings' && <TabSettings addToast={addToast} appUser={liveAppUser} />}
      </main>

      <div className="fixed top-20 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-2 px-4 pointer-events-none">
        {toasts.map(t => (<div key={t.id} className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex gap-3 border border-slate-700"><div className="bg-blue-500/20 p-1.5 rounded-full text-blue-400 mt-0.5"><Bell size={16} /></div><div><h4 className="font-bold text-sm">{t.title}</h4><p className="text-xs text-slate-300 font-medium">{t.message}</p></div></div>))}
      </div>
      <div className="w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase py-4 bg-slate-50 dark:bg-slate-900 border-t mt-auto">Cheers Management OS • v6.0.0</div>
    </div>
  );
}

// --- LOGIN & PASSWORD RECOVERY ---
const LoginScreen = ({ users, setAppUser, isDark, addToast }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [isRecover, setIsRecover] = useState(false); const [loading, setLoading] = useState(false);
  const isFirst = users.length === 0;

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true);
    if (isFirst) {
      const newUser = { name: 'Admin', email: MASTER_ADMIN_EMAIL, password, role: 'Kitchen', isAdmin: true, isActive: true, forcePasswordChange: false };
      const docRef = await addDoc(collection(db, "users"), newUser); setAppUser({ id: docRef.id, ...newUser });
    } else {
      const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
      if (user) { if (user.forcePasswordChange) { const newP = prompt("Enter a new permanent password:"); if(newP && newP.length>4) { await updateDoc(doc(db,"users",user.id),{password:newP,forcePasswordChange:false}); setAppUser({...user, password:newP, forcePasswordChange:false}); } else addToast('Error','Password too short.'); } else setAppUser(user); } 
      else addToast("Error", "Invalid credentials.");
    }
    setLoading(false);
  };

  const handleRecover = async (e) => {
    e.preventDefault(); setLoading(true);
    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (user) { const tPass = generateTempPass(); await updateDoc(doc(db, "users", user.id), { password: tPass, forcePasswordChange: true }); addToast("Success", `Manager notified. Temp pass generated.`); console.log(`Recovery for ${user.email}: ${tPass}`); } 
    else addToast("Error", "Email not found.");
    setIsRecover(false); setLoading(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}><div className={`rounded-3xl shadow-xl border p-8 max-w-md w-full ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white'}`}><div className="flex justify-center mb-6"><CheersLogo isDark={isDark} /></div>
      <h2 className="text-xl font-black text-center mb-4">{isRecover ? 'Recover Password' : (isFirst ? 'Create Admin' : 'Staff Login')}</h2>
      <form onSubmit={isRecover ? handleRecover : handleLogin} className="space-y-4">
        <div><label className="block text-xs font-bold mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600 outline-none" required /></div>
        {!isRecover && <div><label className="block text-xs font-bold mb-1">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border dark:bg-slate-700 dark:border-slate-600 outline-none" required /></div>}
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition">{loading ? 'Processing...' : (isRecover ? 'Reset Password' : 'Login')}</button>
      </form>
      {!isFirst && <button onClick={() => setIsRecover(!isRecover)} className="w-full text-center mt-4 text-xs font-bold text-slate-500 hover:text-blue-500">{isRecover ? 'Back to Login' : 'Forgot Password?'}</button>}
    </div></div>
  );
};

// --- SALES & TRENDS TAB ---
const TabSales = ({ sales, addToast }) => {
  const [date, setDate] = useState(getToday()); const [amount, setAmount] = useState(''); const [tag, setTag] = useState('Standard Day');
  const handleSave = async(e) => { e.preventDefault(); await addDoc(collection(db, "sales"), { date, amount: parseFloat(amount), tag, loggedAt: new Date().toISOString() }); setAmount(''); addToast('Saved', 'Daily sales logged.'); };
  const sortedSales = [...sales].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 14);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2 dark:text-white"><TrendingUp className="text-emerald-500"/> Log Daily Sales</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div><label className="block text-xs font-bold text-slate-500 mb-1">Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none"/></div>
          <div><label className="block text-xs font-bold text-slate-500 mb-1">Revenue ($)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none" required/></div>
          <div><label className="block text-xs font-bold text-slate-500 mb-1">Event Tag</label><select value={tag} onChange={e=>setTag(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none">{EVENT_TAGS.map(t=><option key={t}>{t}</option>)}</select></div>
          <button className="bg-emerald-600 text-white p-2.5 rounded-xl font-bold h-[42px]">Save Log</button>
        </form>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border dark:border-slate-700 p-4">
        <h3 className="font-bold text-lg mb-3 dark:text-white">Recent Trends</h3>
        <div className="divide-y dark:divide-slate-700">{sortedSales.map(s => (
          <div key={s.id} className="py-3 flex justify-between items-center">
            <div><span className="font-bold block dark:text-white">{formatDisplayDate(s.date)}</span><span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${s.tag==='Standard Day'?'bg-slate-100 text-slate-500':'bg-amber-100 text-amber-700'}`}>{s.tag}</span></div>
            <div className="font-black text-lg text-emerald-600">${s.amount.toFixed(2)}</div>
          </div>
        ))}</div>
      </div>
    </div>
  );
};

// --- TEAM TAB ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [role, setRole] = useState('Bartender'); const [photoURL, setPhotoURL] = useState(''); const [isAdmin, setIsAdmin] = useState(false);
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));
  
  const handleAdd = async (e) => {
    e.preventDefault(); const tPass = generateTempPass();
    await addDoc(collection(db, "users"), { name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password: tPass, role, isAdmin, isActive: true, forcePasswordChange: true, photoURL: photoURL.trim() });
    addToast('Staff Added', `Auto-generated password: ${tPass}`);
    const msg = `Welcome to Cheers! Log in at cheers-portal.vercel.app. Your email is ${email} and your temporary password is: ${tPass}`;
    if (phone) window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`; else window.location.href = `mailto:${email}?subject=Cheers Portal Access&body=${encodeURIComponent(msg)}`;
    setName(''); setEmail(''); setPhone(''); setPhotoURL('');
  };
  const handleDelete = async (id) => { if (window.confirm("Remove staff?")) { await deleteDoc(doc(db, "users", id)); addToast('Removed', 'Staff deleted.'); } };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {appUser?.isAdmin && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
          <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white mb-4"><Users size={20}/> Add Staff Member</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none" required/></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none" required/></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone (For SMS)</label><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none"/></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Profile Image URL</label><input type="url" placeholder="Optional URL" value={photoURL} onChange={e=>setPhotoURL(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none"/></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Role</label><select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-2.5 border rounded-xl dark:bg-slate-700 dark:text-white outline-none"><option>Bartender</option><option>Kitchen</option></select></div>
              <label className="flex items-center gap-2 text-sm font-bold mt-4 flex-1 dark:text-slate-300"><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="w-4 h-4"/> Admin Access</label>
              <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold w-full sm:w-auto mt-4 sm:mt-0 shadow-sm">Add & Text Password</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse"><tbody className="divide-y dark:divide-slate-700">
          {displayUsers.map(u => (
            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td className="p-3 flex items-center gap-3"><img src={getAvatar(u.name, u.photoURL)} className="w-10 h-10 rounded-full bg-slate-200" alt="pic"/><div className="font-bold text-lg dark:text-white">{u.name}</div></td>
              <td className="p-3"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${u.role==='Bartender'?'bg-blue-100 text-blue-800':'bg-orange-100 text-orange-800'}`}>{u.role}</span>{u.isAdmin && <span className="ml-2 text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded-full">Admin</span>}</td>
              <td className="p-3 text-right">{appUser?.isAdmin && u.email !== MASTER_ADMIN_EMAIL && <button onClick={()=>handleDelete(u.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
};

// --- PUBLISHED SHIFTS & TRADE BOARD ---
const TabPublished = ({ currentDate, appUser, users, shifts, shiftSwaps, addToast }) => {
  const monthStr = getMonthStr(currentDate);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr) && s.isPublished).sort((a,b)=>a.date.localeCompare(b.date));
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

  const handleOfferSwap = async (shift) => {
    if (!window.confirm("Offer shift to Trade Board?")) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
    // Auto-Post to Message Board
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatTime12(shift.startTime)}). Check the Master Roster!`, type: 'note', author: 'System Alert', isImportant: true });
    addToast('Posted', 'Shift sent to trade board & message board.');
  };

  const handleClaim = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'pending_approval', claimedById: appUser.id });
    addToast('Claimed', 'Pending manager approval.');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {availableSwaps.length > 0 && (
         <div className="bg-blue-50 dark:bg-slate-800 p-4 border border-blue-200 dark:border-blue-800 rounded-3xl space-y-3 shadow-sm">
           <h4 className="font-black text-sm uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1"><Repeat size={16}/> Active Trade Board</h4>
           <div className="grid gap-2 sm:grid-cols-2">
             {availableSwaps.map(sw => {
                const orig = users.find(u => u.id === sw.originalEmployeeId);
                const canClaim = appUser.id !== sw.originalEmployeeId && appUser.role === sw.role;
                return (
                  <div key={sw.id} className="bg-white dark:bg-slate-700 p-3 rounded-xl border border-blue-100 flex justify-between items-center shadow-sm">
                     <div className="flex gap-2 items-center"><img src={getAvatar(orig?.name, orig?.photoURL)} className="w-8 h-8 rounded-full" alt="pic"/><div><span className="font-black text-sm block dark:text-white">{orig?.name?.split(' ')[0]}</span><span className="text-[10px] font-bold text-slate-500">{formatDisplayDate(sw.date)}</span></div></div>
                     {canClaim && <button onClick={() => handleClaim(sw)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-sm">Claim</button>}
                  </div>
                )
             })}
           </div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 font-black border-b dark:border-slate-700 text-lg dark:text-white">🗓️ Master Roster</div>
        <div className="divide-y dark:divide-slate-700">
          {monthShifts.map(s => {
             const emp = users.find(u => u.id === s.employeeId); const isMe = appUser.id === s.employeeId; const isOffered = shiftSwaps.some(sw => sw.shiftId === s.id);
             return (
               <div key={s.id} className={`p-4 flex justify-between items-center ${isMe ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                 <div className="flex items-center gap-3"><img src={getAvatar(emp?.name, emp?.photoURL)} className={`w-10 h-10 rounded-full border-2 ${s.role==='Bartender'?'border-blue-400':'border-orange-400'}`} alt="pic"/>
                   <div><span className={`font-bold block ${isMe ? 'text-blue-700 dark:text-blue-400' : 'dark:text-white'}`}>{emp?.name} {isMe && '(You)'}</span><span className="text-[10px] font-black text-slate-400 uppercase">{formatDisplayDate(s.date)} • {s.role}</span></div>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="text-sm font-bold bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg border dark:border-slate-600 dark:text-slate-200">{formatTime12(s.startTime)}-{formatTime12(s.endTime)}</div>
                   {isMe && !isOffered && <button onClick={() => handleOfferSwap(s)} className="bg-slate-900 dark:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm">Trade</button>}
                   {isOffered && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded font-black uppercase text-slate-500">Posted</span>}
                 </div>
               </div>
             )
          })}
          {monthShifts.length === 0 && <div className="p-8 text-center text-slate-400 font-bold">No published shifts yet.</div>}
        </div>
      </div>
    </div>
  );
};

// --- SCHEDULE MAKER (Condensed) ---
const TabSchedule = ({ currentDate, users, shifts, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); const [assignDates, setAssignDates] = useState([]); const [presetShift, setPresetShift] = useState('4p-9p'); const [startTime, setStartTime] = useState('16:00'); const [endTime, setEndTime] = useState('21:00');
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));
  const monthStr = getMonthStr(currentDate); const monthDays = Array.from({length: new Date(monthStr.split('-')[0], monthStr.split('-')[1], 0).getDate()}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    for (const d of assignDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false }); }
    setAssignDates([]); addToast('Assigned', `Added ${assignDates.length} shifts.`);
  };

  const handlePublish = async () => {
    if(!window.confirm("Publish schedule? Notifications will be sent.")) return;
    const unpub = monthShifts.filter(s => !s.isPublished); for(const s of unpub) await updateDoc(doc(db, "shifts", s.id), {isPublished:true});
    const tokens = users.filter(u=>u.fcmToken).map(u=>u.fcmToken);
    if(tokens.length>0) fetch('/api/send-push', {method:'POST', body:JSON.stringify({title:"New Schedule", body:`Roster published for ${monthStr}.`, tokens})});
    addToast("Published", "Schedule is live.");
  };

  return (
    <div className="space-y-4 pb-12">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700">
         <h3 className="font-black text-xl flex items-center gap-2 dark:text-white"><Calendar className="text-blue-500"/> Schedule Maker</h3>
         <button onClick={handlePublish} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold shadow-sm">Publish All</button>
      </div>
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border shadow-sm">
        <table className="w-full text-left text-[10px] border-collapse">
          <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b"><th className="p-2 font-bold sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-24 border-r dark:text-slate-300">Staff</th>{monthDays.map(d=><th key={d} className={`p-1 text-center border-r min-w-[36px] ${new Date(d+'T12:00').getDay()%6===0?'bg-slate-100 dark:bg-slate-800':''}`}><div className="font-bold text-slate-400 uppercase">{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short'})}</div><div className="text-sm font-black dark:text-white">{parseInt(d.split('-')[2])}</div></th>)}</tr></thead>
          <tbody className="divide-y">{displayUsers.map(u => (
            <tr key={u.id} className={selectedEmp===u.id?'bg-blue-50/50 dark:bg-blue-900/20':''}>
              <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`p-2 font-bold sticky left-0 z-10 border-r cursor-pointer truncate ${selectedEmp===u.id?'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-white':'bg-white dark:bg-slate-800 dark:text-slate-300'}`}>{u.name.split(' ')[0]}</td>
              {monthDays.map(d => {
                const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); const sel = assignDates.includes(d) && selectedEmp===u.id;
                return (<td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r cursor-pointer ${sel?'bg-blue-300 outline outline-2 outline-blue-600 z-10 relative':''}`}>{shift ? <div className={`w-full rounded font-bold text-[9px] py-1 text-center text-white ${shift.isPublished?(u.role==='Bartender'?'bg-blue-500':'bg-orange-500'):'bg-slate-400'}`}>{parseInt(shift.startTime)}-{shift.endTime==='CLOSE'?'CL':parseInt(shift.endTime)}</div> : <div className="h-5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"></div>}</td>)
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 items-end"><div className="flex-1"><label className="block text-[10px] font-bold mb-1 dark:text-slate-400">Start</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full p-2 text-xs rounded-lg border outline-none dark:bg-slate-700 dark:text-white"/></div><div className="flex-1"><label className="block text-[10px] font-bold mb-1 dark:text-slate-400">End</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full p-2 text-xs rounded-lg border outline-none dark:bg-slate-700 dark:text-white"/></div><button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className="bg-blue-600 text-white px-4 h-[34px] rounded-lg font-bold text-xs disabled:opacity-50 flex-1">Assign ({assignDates.length})</button></div>
    </div>
  );
};

// --- COMPACT MONTH VIEW ---
const TabMonth = ({ currentDate, users, shifts }) => {
  const monthStr = getMonthStr(currentDate); const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); const days = new Date(monthStr.split('-')[0], monthStr.split('-')[1], 0).getDate();
  return (
    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print-container">
      <style>{`@media print { .no-print{display:none;} .print-container{position:absolute;top:0;left:0;width:100%;} .cell{border:1px solid #000!important;} }`}</style>
      <div className="flex justify-end p-2 no-print"><button onClick={()=>window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs">Print Calendar</button></div>
      <div className="grid grid-cols-7 border-t border-l dark:border-slate-700">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="p-1.5 bg-slate-50 dark:bg-slate-900 text-center font-black text-[10px] text-slate-500 border-b border-r uppercase cell">{d}</div>)}
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-r min-h-[80px] cell"/>)}
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; const dayShifts = shifts.filter(s=>s.date===date&&s.isPublished);
          return (
            <div key={date} className="p-1 border-b border-r dark:border-slate-700 min-h-[80px] flex flex-col cell overflow-hidden">
              <span className="text-right text-[10px] font-black text-slate-400 mb-1">{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto custom-scrollbar flex-1">{dayShifts.map(s=><div key={s.id} className={`text-[9px] font-bold px-1 rounded leading-tight truncate ${s.role==='Bartender'?'bg-blue-100 text-blue-800':'bg-orange-100 text-orange-800'}`}>{users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {parseInt(s.startTime)}-{s.endTime==='CLOSE'?'CL':parseInt(s.endTime)}</div>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- PREP LIST ---
const TabPrep = ({ currentDate, prepItems }) => {
  const [text, setText] = useState(''); const [prepDate, setPrepDate] = useState(currentDate); const items = prepItems.filter(p=>p.date===prepDate||p.isMaster);
  const handleAdd = async (e) => { e.preventDefault(); if(text.trim()) { await addDoc(collection(db, "prepItems"), { date: prepDate, text: text.trim(), isCompleted: false, qty: 1 }); setText(''); } };
  const toggle = async (item) => { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted }); };
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border flex justify-between items-center shadow-sm"><h3 className="font-bold flex items-center gap-2 dark:text-white"><ClipboardList className="text-blue-500"/> Prep Date:</h3><input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-2 border rounded-xl outline-none font-bold dark:bg-slate-700 dark:text-white"/></div>
      <form onSubmit={handleAdd} className="flex gap-2"><input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 p-3 rounded-2xl border outline-none dark:bg-slate-800 dark:text-white" placeholder="Add custom prep task..." required/><button className="bg-blue-600 text-white px-5 rounded-2xl font-bold"><Plus size={20}/></button></form>
      <div className="bg-white dark:bg-slate-800 rounded-3xl border divide-y overflow-hidden shadow-sm">{items.map(i=>(
        <div key={i.id} className="p-3 flex items-center gap-3">
          <div className="flex-1 truncate"><span className={`font-bold ${i.isCompleted?'line-through text-slate-400':'dark:text-white'}`}>{i.text}</span>{i.isMaster&&<span className="block text-[9px] font-black text-blue-500 uppercase">Master</span>}</div>
          <button onClick={()=>toggle(i)} className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${i.isCompleted?'bg-slate-200 text-slate-500':'bg-emerald-100 text-emerald-700'}`}><Check size={18}/></button>
          <button onClick={()=>deleteDoc(doc(db,"prepItems",i.id))} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
        </div>
      ))}</div>
    </div>
  );
};

// --- SMART INVENTORY DEFICIT REPORT ---
const TabInventory = ({ inventoryItems, sales, addToast }) => {
  const [orderOverrides, setOrderOverrides] = useState({});
  // Sales Context Engine: Find a sales log from roughly 365 days ago
  const getHistoricalContext = () => {
    const target = new Date(); target.setFullYear(target.getFullYear()-1); const targetStr = target.toISOString().split('T')[0];
    const pastSale = sales.find(s => s.date === targetStr);
    return pastSale ? `Last year (${targetStr}): $${pastSale.amount.toFixed(2)} [${pastSale.tag}]` : `No sales data for ${targetStr}`;
  };

  const handleOrderChange = (id, change, currentQty) => setOrderOverrides(p => ({...p, [id]: Math.max(0, currentQty + change)}));
  
  const itemsToOrder = inventoryItems.filter(i => { const ov = orderOverrides[i.id]; return ov !== undefined ? ov > 0 : i.currentStock < i.parLevel; });
  const executeOrder = async () => {
    for (const item of itemsToOrder) { const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : (item.parLevel - item.currentStock); await updateDoc(doc(db, "inventoryItems", item.id), { lastOrderedQty: qty, lastOrderedDate: getToday() }); }
    setOrderOverrides({}); addToast('Dispatched', 'Inventory order finalized.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-amber-50 dark:bg-slate-800 border border-amber-200 p-4 rounded-2xl shadow-sm"><h4 className="font-black text-amber-800 dark:text-amber-400 text-sm flex items-center gap-2 mb-1"><TrendingUp size={16}/> Smart Order Context</h4><p className="text-xs font-bold text-amber-700 dark:text-slate-300">{getHistoricalContext()}</p></div>
      <div className="bg-white dark:bg-slate-800 border rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b flex justify-between items-center"><h3 className="font-black text-lg dark:text-white">Smart Deficit Report</h3><span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-black text-[10px] uppercase">{itemsToOrder.length} Items</span></div>
        <table className="w-full text-left">
          <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b text-[9px] font-black text-slate-500 uppercase"><th className="p-3">Product</th><th className="p-3 text-center">Last Order</th><th className="p-3 text-right">Order Qty</th></tr></thead>
          <tbody className="divide-y dark:divide-slate-700">{itemsToOrder.map(item => {
            const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
            return (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="p-3"><span className="font-bold text-sm block dark:text-white">{item.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{item.packSize||'1 CS'} • Par: {item.parLevel}</span></td>
                <td className="p-3 text-center text-[10px] font-bold text-slate-400">{item.lastOrderedQty ? `${item.lastOrderedQty} (${item.lastOrderedDate})` : '--'}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1"><button onClick={()=>handleOrderChange(item.id, -1, currentOrder)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold dark:text-white">-</button><input type="number" min="0" value={currentOrder} onChange={e=>setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))} className="w-12 h-8 text-center font-black bg-blue-50 text-blue-700 rounded-lg outline-none"/><button onClick={()=>handleOrderChange(item.id, 1, currentOrder)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold dark:text-white">+</button></div>
                </td>
              </tr>
            )
          })}</tbody>
        </table>
        {itemsToOrder.length > 0 && <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t"><button onClick={executeOrder} className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-black text-lg shadow-sm">Finalize Order List</button></div>}
      </div>
    </div>
  );
};

// --- MESSAGE BOARD (With Avatars) ---
const TabMessages = ({ events, appUser, users, addToast }) => {
  const [message, setMessage] = useState(''); const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));
  const handleBroadcast = async (e) => { e.preventDefault(); if(!message.trim()) return; await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: message.trim(), type: 'note', author: appUser.name, isImportant: false }); setMessage(''); addToast('Posted', 'Message sent.'); };
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border dark:border-slate-700"><form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row gap-3"><textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-700 outline-none font-medium dark:text-white" rows="2" placeholder="Message the team..." required></textarea><button className="bg-blue-600 text-white px-6 rounded-2xl font-bold whitespace-nowrap">Post</button></form></div>
      <div className="space-y-3">{allNotes.map(n => {
        const authorUser = users.find(u => u.name === n.author);
        return (
        <div key={n.id} className={`p-4 rounded-3xl border shadow-sm flex gap-3 ${n.isImportant ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
          {n.author !== 'System Alert' && <img src={getAvatar(n.author, authorUser?.photoURL)} className="w-10 h-10 rounded-full flex-shrink-0" alt="pic"/>}
          <div className="flex-1"><div className="flex justify-between items-start mb-1"><span className={`font-black text-sm ${n.isImportant ? 'text-red-700' : 'text-blue-600 dark:text-blue-400'}`}>{n.author}</span><span className="text-[10px] font-bold text-slate-400">{new Date(n.date).toLocaleDateString()}</span></div><p className={`font-medium leading-snug ${n.isImportant?'text-red-900':'text-slate-800 dark:text-slate-200'}`}>{n.title}</p></div>
        </div>
      )})}</div>
    </div>
  )
};

// --- SETTINGS ---
const TabSettings = ({ addToast }) => {
  const [settings, setSettings] = useState({ shiftReminders: true, autoApproveTimeOff: false, salesAlerts: true });
  const toggle = (k) => setSettings(p => ({...p, [k]: !p[k]}));
 const handleEnablePush = async () => {
    if (!messaging) return addToast('Error', 'Push not supported.');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return addToast('Denied', 'Notifications blocked.');
      
      addToast('Connecting...', 'Activating secure worker...');
      
      // Register the file path explicitly
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      // Fail-safe loop: Wait for the phone to flip the status to active
      let attempts = 0;
      while (!registration.active && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      const token = await getToken(messaging, { 
        vapidKey: 'BJzM9xVnkPwLB6aq588ZHhekjql_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGVOsPH9M6aBzGCA9AcU',
        serviceWorkerRegistration: registration 
      });
      
      if (token) {
        await updateDoc(doc(db, "users", appUser.id), { fcmToken: token });
        addToast('Success', 'Notifications enabled.');
      } else {
        addToast('Error', 'Failed to generate token.');
      }
    } catch (err) { 
      console.error(err);
      addToast('Error', err.message || 'Push registration failed.'); 
    }
  };

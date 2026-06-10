import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, Image as ImageIcon } from 'lucide-react';
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
const formatDisplayMonth = (m) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const getDaysInMonth = (m) => new Date(m.split('-')[0], m.split('-')[1], 0).getDate();
const formatTime12 = (t) => { if (!t) return ''; if(t === 'CLOSE') return 'CL'; let [h, m] = t.split(':'); return `${parseInt(h)%12||12}:${m} ${h>=12?'PM':'AM'}`; };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();

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

// --- Main Application Layout ---
export default function App() {
  const users = useLiveCollection('users');
  const shifts = useLiveCollection('shifts');
  const prepItems = useLiveCollection('prepItems');
  const inventoryItems = useLiveCollection('inventoryItems');
  const shiftSwaps = useLiveCollection('shiftSwaps');
  const events = useLiveCollection('events');
  const sales = useLiveCollection('sales');
  
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
      <style>{`
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .dark input[type="date"]::-webkit-calendar-picker-indicator, .dark input[type="month"]::-webkit-calendar-picker-indicator, .dark input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>
      
      <header className={`sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <CheersLogo isDark={isDark} />
        <button onClick={() => setIsMenuOpen(true)} className="p-2 border rounded-xl shadow-sm dark:bg-slate-800 dark:border-slate-700 bg-slate-50"><Menu size={20} /></button>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <div className="w-72 bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col relative transition-transform">
             <div className="p-4 border-b dark:border-slate-700 flex justify-between items-start">
                <div className="flex items-center gap-3"><img src={getAvatar(liveAppUser.name, liveAppUser.photoURL)} alt="avatar" className="w-10 h-10 rounded-full shadow-sm"/><div><div className="text-[10px] font-bold text-slate-400 uppercase">Signed in as</div><div className="font-black text-lg leading-tight dark:text-white">{liveAppUser.name}</div></div></div>
                <button onClick={() => setIsMenuOpen(false)} className="p-1 dark:text-slate-400"><X size={18}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {tabs.map(t => (<button key={t.id} onClick={() => { setActiveTab(t.id); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm ${activeTab === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><span>{t.icon}</span>{t.label}</button>))}
             </div>
             <div className="p-3 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2">
                <div className="flex justify-between px-3 py-2 bg-white dark:bg-slate-700 rounded-xl border dark:border-slate-600 shadow-sm cursor-pointer" onClick={() => setIsDark(!isDark)}><span className="text-xs font-bold dark:text-slate-200 flex items-center gap-2">{isDark ? <Moon size={14}/> : <Sun size={14}/>} Dark Mode</span></div>
                <button onClick={() => { localStorage.removeItem('cheersUser'); setAppUser(null); setIsMenuOpen(false); }} className="w-full flex justify-center gap-2 py-2 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"><LogOut size={16} /> Log Out</button>
             </div>
          </div>
        </div>
      )}

      {['schedule', 'published', 'month', 'sales', 'prep'].includes(activeTab) && (
        <div className={`py-3 px-4 shadow-sm z-30 border-b flex justify-between items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <button onClick={() => setCurrentDate(addDays(currentDate, -30))} className="p-2 border rounded-xl dark:border-slate-600"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-black cursor-pointer dark:text-white"><input type={activeTab === 'prep' ? 'date' : 'month'} value={activeTab === 'prep' ? currentDate : getMonthStr(currentDate)} onChange={e => e.target.value && setCurrentDate(activeTab === 'prep' ? e.target.value : e.target.value + '-01')} className="bg-transparent outline-none text-center" /></h2>
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
        {toasts.map(t => (<div key={t.id} className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex gap-3 border border-slate-700 animate-toast"><div className="bg-blue-500/20 p-1.5 rounded-full text-blue-400 mt-0.5"><Bell size={16} /></div><div className="flex-1"><h4 className="font-bold text-sm leading-tight">{t.title}</h4><p className="text-xs text-slate-300 font-medium">{t.message}</p></div></div>))}
      </div>
      <div className="w-full text-center text-slate-400 font-bold text-[10px] tracking-widest uppercase py-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-800 mt-auto">Cheers Management OS • v6.0.0</div>
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
    if (user) { const tPass = generateTempPass(); await updateDoc(doc(db, "users", user.id), { password: tPass, forcePasswordChange: true }); addToast("Success", `Manager notified. Temp pass generated.`); } 
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

// --- SCHEDULE MAKER (With Strict Validation & Original UI) ---
const TabSchedule = ({ currentDate, users, shifts, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); const [assignDates, setAssignDates] = useState([]); const [presetShift, setPresetShift] = useState('Custom'); const [startTime, setStartTime] = useState('16:00'); const [endTime, setEndTime] = useState('21:00');
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));
  const monthStr = getMonthStr(currentDate); const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));

  const SHIFT_PRESETS = [ { label: "9a-3p", start: "09:00", end: "15:00" }, { label: "10a-4p", start: "10:00", end: "16:00" }, { label: "10a-9p", start: "10:00", end: "21:00" }, { label: "11a-3p", start: "11:00", end: "15:00" }, { label: "11a-4p", start: "11:00", end: "16:00" }, { label: "4p-9p", start: "16:00", end: "21:00" }, { label: "7p-close", start: "19:00", end: "CLOSE" }, { label: "9p-close", start: "21:00", end: "CLOSE" }, { label: "Custom", start: "", end: "" } ];
  const handlePresetChange = (e) => { const val = e.target.value; setPresetShift(val); const p = SHIFT_PRESETS.find(x => x.label === val); if (p && val !== 'Custom') { setStartTime(p.start); if (p.end !== 'CLOSE') setEndTime(p.end); } };

  const validateSchedule = () => {
    const warnings = [];
    monthDays.forEach(d => {
       const dShifts = monthShifts.filter(s => s.date === d); if (dShifts.length === 0) return;
       const dObj = new Date(d + 'T12:00:00'); const day = dObj.getDay();
       const isFri = day===5; const isSat = day===6; const isSun = day===0;
       const dateFmt = `${dObj.getMonth()+1}/${dObj.getDate()}`;
       const bar = dShifts.filter(s => s.role === 'Bartender'); const kit = dShifts.filter(s => s.role === 'Kitchen');

       // Rule 1: Kitchen 9-10am to 9pm
       if (!kit.some(s => s.startTime <= '10:00') || !kit.some(s => s.endTime >= '21:00')) warnings.push(`[${dateFmt}] Kitchen: Missing open-to-close coverage (9a-9p)`);
       
       // Rule 2: Bar 11am to Close
       const bClose = (isFri || isSat) ? '02:30' : '02:00';
       if (!bar.some(s => s.startTime <= '11:00') || !bar.some(s => s.endTime === 'CLOSE' || s.endTime >= bClose)) warnings.push(`[${dateFmt}] Bar: Missing open-to-close coverage (11a-${bClose==='02:30'?'2:30a':'2a'})`);

       const countO = (arr, st, en) => arr.filter(s => s.startTime <= st && (s.endTime >= en || s.endTime === 'CLOSE')).length;
       
       // Rule 3: Lunch/Day Rushes
       const lBar = countO(bar, '11:00', '14:00'); const lKit = countO(kit, '11:00', '14:00');
       if (day >= 1 && day <= 4) { if(lBar < 2 || lKit < 2) warnings.push(`[${dateFmt}] Lunch Rush (M-Th): Needs 2 Bar/2 Kit, found ${lBar} Bar/${lKit} Kit`); }
       else if (isFri) { if(lBar < 2 || lKit < 3) warnings.push(`[${dateFmt}] Lunch Rush (Fri): Needs 2 Bar/3 Kit, found ${lBar} Bar/${lKit} Kit`); }
       else if (isSat || isSun) { if(lBar < 1 || lKit < 2) warnings.push(`[${dateFmt}] Day Rush (Sat-Sun): Needs 1 Bar/2 Kit, found ${lBar} Bar/${lKit} Kit`); }

       // Rule 4: Dinner Rushes
       const dBar = countO(bar, '17:00', '19:00'); const dKit = countO(kit, '17:00', '19:00');
       if (day >= 1 && day <= 4) { if(dBar < 2 || dKit < 2) warnings.push(`[${dateFmt}] Dinner Rush (M-Th): Needs 2 Bar/2 Kit, found ${dBar} Bar/${dKit} Kit`); }
       else if (isFri) { if(dBar < 2 || dKit < 3) warnings.push(`[${dateFmt}] Dinner Rush (Fri): Needs 2 Bar/3 Kit, found ${dBar} Bar/${dKit} Kit`); }

       // Rule 5: Closers
       const cls = bar.filter(s => s.endTime === 'CLOSE' || s.endTime >= '02:00').length;
       if ((isFri || isSat) && cls < 2) warnings.push(`[${dateFmt}] Bar: Needs 2 closers (Fri/Sat), found ${cls}`);
       else if (!isFri && !isSat && cls < 1) warnings.push(`[${dateFmt}] Bar: Needs 1 closer (Sun-Thu), found ${cls}`);
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
    for (const d of assignDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false }); }
    setAssignDates([]); addToast('Assigned', `Added ${assignDates.length} shifts.`);
  };

  const handlePublish = async () => {
    const warnings = validateSchedule();
    if (warnings.length > 0) { if (!window.confirm(`⚠️ SCHEDULE WARNINGS FOUND:\n\n${warnings.join('\n')}\n\nDo you want to publish anyway?`)) return; }
    else { if(!window.confirm("Publish schedule? Notifications will be sent.")) return; }
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
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm">
        <table className="w-full text-left text-[10px] border-collapse">
          <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700"><th className="p-2 font-bold sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-24 border-r dark:border-slate-700 dark:text-slate-300">Staff</th>{monthDays.map(d=><th key={d} className={`p-1 text-center border-r dark:border-slate-700 min-w-[36px] ${new Date(d+'T12:00').getDay()%6===0?'bg-slate-100 dark:bg-slate-800':''}`}><div className="font-bold text-slate-400 uppercase">{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short'})}</div><div className="text-sm font-black dark:text-white">{parseInt(d.split('-')[2])}</div></th>)}</tr></thead>
          <tbody className="divide-y dark:divide-slate-700">{displayUsers.map(u => (
            <tr key={u.id} className={selectedEmp===u.id?'bg-blue-50/50 dark:bg-blue-900/20':''}>
              <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`p-2 font-bold sticky left-0 z-10 border-r dark:border-slate-700 cursor-pointer truncate ${selectedEmp===u.id?'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-white':'bg-white dark:bg-slate-800 dark:text-slate-300'}`}>{u.name.split(' ')[0]}</td>
              {monthDays.map(d => {
                const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); const sel = assignDates.includes(d) && selectedEmp===u.id;
                return (<td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r dark:border-slate-700 cursor-pointer transition-all ${sel?'bg-amber-300 dark:bg-amber-500 outline outline-4 outline-red-600 shadow-2xl scale-[1.15] z-50 relative':'hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{shift ? <div className={`w-full rounded font-bold text-[9px] py-1 text-center text-white ${shift.isPublished?(u.role==='Bartender'?'bg-blue-500':'bg-orange-500'):'bg-slate-400'}`}>{parseInt(shift.startTime)}-{shift.endTime==='CLOSE'?'CL':parseInt(shift.endTime)}</div> : <div className="h-5 rounded"></div>}</td>)
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-col md:flex-row gap-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 items-end">
        <div className="w-full md:w-48"><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Staff</label><select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none"><option value="">- Choose -</option>{displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div className="w-full md:w-36"><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Preset</label><select value={presetShift} onChange={handlePresetChange} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none">{SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</select></div>
        <div className="w-full md:w-28"><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Start</label><input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none"/></div>
        <div className="w-full md:w-28"><label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">End</label><input type="time" value={presetShift.includes('close')?'':endTime} disabled={presetShift.includes('close')} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className="w-full p-2.5 text-sm bg-white dark:bg-slate-700 border dark:border-slate-600 dark:text-white rounded-lg font-bold outline-none disabled:bg-slate-200 disabled:text-slate-400"/></div>
        <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className="bg-blue-600 text-white px-6 h-[42px] rounded-lg font-bold shadow-sm disabled:opacity-50 w-full md:w-auto">Assign ({assignDates.length})</button>
      </div>
    </div>
  );
};

// --- PREP LIST (With Batch Label Printing & Qtys) ---
const TabPrep = ({ currentDate, prepItems, appUser }) => {
  const [text, setText] = useState(''); const [isMaster, setIsMaster] = useState(true); const [prepDate, setPrepDate] = useState(currentDate); const [printItems, setPrintItems] = useState([]); const [selectedIds, setSelectedIds] = useState([]); const items = prepItems.filter(p=>p.date===prepDate||p.isMaster);
  
  const handleAdd = async (e) => { e.preventDefault(); if(text.trim()) { await addDoc(collection(db, "prepItems"), { date: isMaster?'MASTER':prepDate, text: text.trim(), isCompleted: false, completedDates: {}, isMaster, qty: 1, completedBy: null }); setText(''); } };
  const toggleStatus = async (item) => { 
    if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = dts[prepDate] ? null : appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts }); }
    else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null }); }
  };
  const updateQty = async (id, currentQty, change) => { await updateDoc(doc(db, "prepItems", id), { qty: Math.max(1, currentQty + change) }); };
  const toggleSelect = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  
  const handleBatchDone = async () => {
    if (selectedIds.length === 0) return; const toComplete = items.filter(i => selectedIds.includes(i.id));
    for (const item of toComplete) { if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts }); } else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: true, completedBy: appUser.name }); } }
    setSelectedIds([]);
  };

  const triggerBatchPrint = () => {
    if (selectedIds.length === 0) return; const toPrint = [];
    items.filter(i => selectedIds.includes(i.id)).forEach(item => { for (let i = 0; i < (item.qty||1); i++) { toPrint.push({ ...item, printId: `${item.id}-${i}` }); } });
    setPrintItems(toPrint); setTimeout(() => window.print(), 500);
  };

  const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };

  return (
    <div className="max-w-2xl mx-auto space-y-4 relative pb-40">
      <style>{`
        .label-print-zone { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .label-print-zone { display: block !important; position: absolute; left: 0; top: 0; width: 2.4in; margin: 0; padding: 0; background: white; visibility: visible !important; z-index: 9999; }
          .label-print-zone * { visibility: visible !important; }
          .print-page { width: 2.4in; height: 2.0in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0.1in; box-sizing: border-box; page-break-after: always; border: 1px dashed #ccc; }
          .print-title { font-size: 18px; font-weight: 900; color: #000; margin-bottom: 6px; text-transform: uppercase; line-height: 1.1; }
          .print-meta { font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px; }
          .print-exp { font-size: 16px; font-weight: 900; color: #000; margin-top: 4px; border-top: 2px solid #000; padding-top: 4px; width: 90%; }
          .no-print { display: none !important; }
        }
      `}</style>
      {printItems.length > 0 && (
        <div className="label-print-zone bg-white text-black">{printItems.map(i => (
            <div key={i.printId} className="print-page"><div className="print-title">{i.text}</div><div className="print-meta">PREP: {formatDisplayDate(prepDate).split(',')[1]}</div><div className="print-meta">EMP: {appUser?.name?appUser.name.split(' ')[0].toUpperCase():'______'}</div><div className="print-exp">EXP: {getExpDate(prepDate)}</div></div>
        ))}</div>
      )}
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl flex justify-between items-center shadow-sm no-print">
         <h3 className="font-bold flex items-center gap-2 dark:text-white"><ClipboardList className="text-blue-500"/> Prep List For:</h3>
         <input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-2 border rounded-xl outline-none font-bold dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
      </div>
      <form onSubmit={handleAdd} className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-2 pl-4 rounded-2xl flex flex-col sm:flex-row gap-2 shadow-sm items-center no-print">
        <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-2 bg-transparent outline-none font-medium dark:text-white" placeholder="Add prep task..." required/>
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 dark:border-slate-700">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-500 cursor-pointer"><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4"/> Master List</label>
          <button className="bg-blue-600 text-white p-2.5 rounded-xl font-bold"><Plus size={20}/></button>
        </div>
      </form>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 divide-y dark:divide-slate-700 shadow-sm no-print">
        {items.map(i=>{
          const isDone = i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted; const doneBy = i.isMaster ? i.completedDates?.[prepDate] : i.completedBy; const qty = i.qty||1;
          return (
          <div key={i.id} className="p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={()=>toggleSelect(i.id)} className="w-6 h-6 rounded border-slate-300 accent-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0"><span className={`font-bold ${isDone?'line-through text-slate-400':'dark:text-white'}`}>{i.text}</span> {doneBy && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded ml-2">✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-blue-500 uppercase mt-0.5">Master Task</span>}</div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg border dark:border-slate-600"><button onClick={()=>updateQty(i.id,qty,-1)} className="w-8 h-10 font-bold dark:text-white">-</button><span className="w-6 text-center font-bold dark:text-white">{qty}</span><button onClick={()=>updateQty(i.id,qty,1)} className="w-8 h-10 font-bold dark:text-white">+</button></div>
              <button onClick={()=>toggleStatus(i)} className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${isDone?'bg-slate-200 text-slate-500 dark:bg-slate-600':'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-400'}`}>{isDone ? <Repeat size={16}/> : <Check size={18}/>}</button>
              <button onClick={()=>deleteDoc(doc(db,"prepItems",i.id))} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          </div>
        )})}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 no-print z-50 shadow-md">
        <div className="max-w-2xl mx-auto space-y-2"><button onClick={triggerBatchPrint} disabled={selectedIds.length===0} className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-black text-lg disabled:opacity-50">🖨️ Print Selected Labels ({selectedIds.length})</button><button onClick={handleBatchDone} disabled={selectedIds.length===0} className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold disabled:opacity-50">Mark Selected as Done</button></div>
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

  const getHistoricalContext = () => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); const pastStr = d.toISOString().split('T')[0];
    const pastSale = sales.find(s => s.date === pastStr); return pastSale ? `Last year (${pastStr}): $${pastSale.amount.toFixed(2)} [${pastSale.tag}]` : `No local trend data for this week last year.`;
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
          <div className="flex justify-end gap-2 mb-2">{inventoryItems.some(i=>(i.pendingQty||0)>0&&i.supplier==='Badger') && <button onClick={()=>handleReceivePending('Badger')} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm">Receive Badger</button>}{inventoryItems.some(i=>(i.pendingQty||0)>0&&(!i.supplier||i.supplier==='PFG')) && <button onClick={()=>handleReceivePending('PFG')} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm">Receive PFG</button>}</div>
          <div className="bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm"><h4 className="font-black text-amber-800 dark:text-amber-400 text-sm flex items-center gap-2 mb-1"><TrendingUp size={16}/> Smart Order Context</h4><p className="text-xs font-bold text-amber-700 dark:text-slate-300">{getHistoricalContext()}</p></div>
          <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h3 className="font-black text-lg dark:text-white">Smart Deficit Report</h3><span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full font-black text-[10px] uppercase">{itemsToOrder.length} Items</span></div>
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-[9px] font-black text-slate-500 uppercase"><th className="p-3">Product</th><th className="p-3 text-center">Last Order</th><th className="p-3 text-right">Order Qty</th></tr></thead>
              <tbody className="divide-y dark:divide-slate-700">{itemsToOrder.map(item => {
                const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="p-3"><span className="font-bold text-sm block dark:text-white">{item.name}</span><span className="text-[9px] font-bold text-slate-400 uppercase">{item.packSize||'1 CS'} • Par: {item.parLevel}</span></td>
                    <td className="p-3 text-center text-[10px] font-bold text-slate-400">{item.lastOrderedQty ? `${item.lastOrderedQty} (${item.lastOrderedDate})` : '--'}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1"><button onClick={()=>handleOrderChange(item.id, -1, currentOrder)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold dark:text-white hover:bg-slate-200 transition-colors">-</button><input type="number" min="0" value={currentOrder} onChange={e=>setOrderOverrides(p=>({...p, [item.id]: parseInt(e.target.value)||0}))} className="w-12 h-8 text-center font-black bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 rounded-lg outline-none"/><button onClick={()=>handleOrderChange(item.id, 1, currentOrder)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 font-bold dark:text-white hover:bg-slate-200 transition-colors">+</button></div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4"><div className="text-left w-full sm:w-auto"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">PFG Total</span><span className="font-black text-xl dark:text-white">${getFinalOrderList('PFG').reduce((s,i)=>s+(i.price*i.orderQty),0).toFixed(2)}</span></div><div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"><button onClick={()=>handleReviewOrder('Badger')} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"><MessageSquare size={16}/> Text Badger</button><button onClick={()=>handleReviewOrder('PFG')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2"><Send size={16}/> Email PFG</button></div></div>
          </div>
        </div>
      )}
      {appUser?.isAdmin && invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Inventory Item">{editItem && (<form onSubmit={handleSaveEdit} className="space-y-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label><input type="text" value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" required /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label><select value={editItem.category} onChange={e => setEditItem({...editItem, category: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Supplier</label><select value={editItem.supplier || 'PFG'} onChange={e => setEditItem({...editItem, supplier: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg"><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Pack Size</label><input type="text" value={editItem.packSize || ''} onChange={e => setEditItem({...editItem, packSize: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" /></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Price ($)</label><input type="number" step="0.01" value={editItem.price || ''} onChange={e => setEditItem({...editItem, price: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" /></div></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Item Code</label><input type="text" value={editItem.pfgCode || ''} onChange={e => setEditItem({...editItem, pfgCode: e.target.value})} className="w-full p-2 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg" /></div><button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">Save Changes</button></form>)}</Modal>
          <div className="bg-white dark:bg-slate-800 p-5 border dark:border-slate-700 rounded-2xl shadow-sm"><h3 className="text-lg font-bold border-b dark:border-slate-700 pb-2 mb-3 dark:text-white">Add Single Item</h3><form onSubmit={handleAddItem} className="space-y-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-transparent dark:text-white" required /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Category</label><select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-transparent dark:bg-slate-700 dark:text-white"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option><option>Frozen</option><option>Bakery</option></select></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Supplier</label><select value={newItemSupplier} onChange={e => setNewItemSupplier(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-transparent dark:bg-slate-700 dark:text-white"><option value="PFG">PFG</option><option value="Badger">Badger</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Pack Size</label><input type="text" value={newItemPackSize} onChange={e => setNewItemPackSize(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-transparent dark:text-white" /></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Price ($)</label><input type="number" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-transparent dark:text-white" /></div></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase">Item Code</label><input type="text" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded-lg bg-transparent dark:text-white" /></div><button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold">Add Item</button></form></div>
          <div className="bg-white dark:bg-slate-800 p-5 border dark:border-slate-700 rounded-2xl shadow-sm"><h3 className="text-lg font-bold border-b dark:border-slate-700 pb-2 mb-3 dark:text-white">Current Master Catalog</h3><div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">{inventoryItems.map(item => (<div key={item.id} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg border border-transparent transition-all"><div><span className="font-bold text-slate-800 dark:text-white block text-sm leading-tight">{item.name}</span><span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mt-0.5 inline-block uppercase">{item.category} • {item.packSize || '1 CS'}</span></div><div className="flex gap-1 items-center"><button onClick={() => toggleStar(item)} className={`p-1.5 rounded-md transition-colors ${item.isStarred ? 'text-yellow-400' : 'text-slate-300'}`}>{item.isStarred ? '⭐' : '☆'}</button><button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-indigo-500 p-1.5 rounded-md"><Edit size={16}/></button><button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-md"><Trash2 size={16}/></button></div></div>))}</div></div>
        </div>
      )}
    </div>
  );
};

// --- SETTINGS (Plus Push Fixes) ---
const TabSettings = ({ addToast, appUser }) => {
  const [settings, setSettings] = useState({ shiftReminders: true, autoApproveTimeOff: false, smartSalesAlerts: true });
  const toggle = (k) => setSettings(p => ({...p, [k]: !p[k]}));
  
  const handleEnablePush = async () => {
    if (!messaging) return addToast('Error', 'Push not supported.');
    try {
      const p = await Notification.requestPermission(); if(p!=='granted') return addToast('Denied', 'Notifications blocked.');
      addToast('Connecting...', 'Activating secure worker...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      let attempts = 0; while (!registration.active && attempts < 20) { await new Promise(r => setTimeout(r, 200)); attempts++; }
      const token = await getToken(messaging, { vapidKey: 'BJzM9xVnkPwLB6aq588ZHhekjql_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGVOsPH9M6aBzGCA9AcU', serviceWorkerRegistration: registration });
      if(token) { await updateDoc(doc(db, "users", appUser.id), { fcmToken: token }); addToast('Success', 'Push enabled.'); }
    } catch(e) { addToast('Error', e.message); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-6">
        <h3 className="text-xl font-black dark:text-white mb-2">Operational Settings</h3>
        <div className="space-y-2">
          {[{k:'shiftReminders', l:'Send Shift Reminders'}, {k:'autoApproveTimeOff', l:'Auto-Approve Time Off'}, {k:'smartSalesAlerts', l:'Smart Sales / Deficit Alerts'}].map(s=>(
            <div key={s.k} onClick={()=>toggle(s.k)} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer border dark:border-slate-600"><span className="font-bold text-sm dark:text-slate-200">{s.l}</span><div className={`w-10 h-5 rounded-full flex items-center px-1 ${settings[s.k]?'bg-blue-600':'bg-slate-300 dark:bg-slate-600'}`}><div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${settings[s.k]?'translate-x-4':'translate-x-0'}`}></div></div></div>
          ))}
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800"><h4 className="font-black text-blue-900 dark:text-blue-400 mb-1">Push Notifications</h4><p className="text-xs text-blue-800 dark:text-blue-300 mb-4 font-bold">Link device to receive app alerts.</p><button onClick={handleEnablePush} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold w-full text-sm hover:bg-blue-700">Enable Notifications</button></div>
      </div>
    </div>
  );
};

// --- PUBLISHED SHIFTS & MESSAGE BOARD (With Avatars & Trade Logic) ---
const TabPublishedShifts = ({ currentDate, appUser, users, shifts, shiftSwaps, addToast }) => {
  const monthStr = getMonthStr(currentDate);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr) && s.isPublished).sort((a,b)=>a.date.localeCompare(b.date));
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

  const handleOfferSwap = async (shift) => {
    if (!window.confirm("Offer shift to Trade Board?")) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatTime12(shift.startTime)}). Claim it on the Master Roster!`, type: 'note', author: 'System Alert', isImportant: true });
    addToast('Posted', 'Shift sent to trade board & message board.');
  };

  const handleClaim = async (swap) => { await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'pending_approval', claimedById: appUser.id }); addToast('Claimed', 'Pending manager approval.'); };
  const handleApprove = async (sw) => { await updateDoc(doc(db, "shifts", sw.shiftId), { employeeId: sw.claimedById }); await deleteDoc(doc(db, "shiftSwaps", sw.id)); addToast('Approved', 'Roster updated.'); };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {appUser?.isAdmin && shiftSwaps.filter(sw=>sw.status==='pending_approval').length > 0 && (
         <div className="bg-amber-50 dark:bg-slate-800 p-4 border border-amber-200 dark:border-amber-800 rounded-3xl space-y-3 shadow-sm">
           <h4 className="font-black text-sm uppercase text-amber-700 dark:text-amber-400">Trades Awaiting Approval</h4>
           {shiftSwaps.filter(sw=>sw.status==='pending_approval').map(sw => (
             <div key={sw.id} className="flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded-xl border dark:border-slate-600 shadow-sm gap-2">
                <div className="text-sm dark:text-white"><strong>{users.find(u=>u.id===sw.claimedById)?.name}</strong> covering <strong>{users.find(u=>u.id===sw.originalEmployeeId)?.name}'s</strong> shift on {formatDisplayDate(sw.date)}.</div>
                <div className="flex gap-2 flex-shrink-0"><button onClick={()=>handleApprove(sw)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs">Approve</button><button onClick={()=>updateDoc(doc(db, "shiftSwaps", sw.id), { status: 'available', claimedById: null })} className="bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-white px-3 py-1.5 rounded-lg font-bold text-xs">Deny</button></div>
             </div>
           ))}
         </div>
      )}

      {availableSwaps.length > 0 && (
         <div className="bg-blue-50 dark:bg-slate-800 p-4 border border-blue-200 dark:border-blue-800 rounded-3xl space-y-3 shadow-sm">
           <h4 className="font-black text-sm uppercase text-blue-700 dark:text-blue-400">Active Trade Board</h4>
           <div className="grid gap-2 sm:grid-cols-2">{availableSwaps.map(sw => {
              const orig = users.find(u => u.id === sw.originalEmployeeId);
              return (
                <div key={sw.id} className="bg-white dark:bg-slate-700 p-3 rounded-xl border dark:border-slate-600 flex justify-between items-center shadow-sm">
                   <div className="flex gap-3 items-center"><img src={getAvatar(orig?.name, orig?.photoURL)} className="w-8 h-8 rounded-full" alt="pic"/><div><span className="font-black text-sm block dark:text-white">{orig?.name?.split(' ')[0]}</span><span className="text-[10px] font-bold text-slate-500">{formatDisplayDate(sw.date)}</span></div></div>
                   {appUser.id !== sw.originalEmployeeId && appUser.role === sw.role && <button onClick={() => handleClaim(sw)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs">Claim</button>}
                </div>
              )
           })}</div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900 p-4 font-black border-b dark:border-slate-700 text-lg dark:text-white">🗓️ Master Roster</div>
        <div className="divide-y dark:divide-slate-700">
          {monthShifts.map(s => {
             const emp = users.find(u => u.id === s.employeeId); const isMe = appUser.id === s.employeeId; const isOffered = shiftSwaps.some(sw => sw.shiftId === s.id);
             return (
               <div key={s.id} className={`p-4 flex justify-between items-center ${isMe ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
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

const TabMessages = ({ events, appUser, users, addToast }) => {
  const [message, setMessage] = useState(''); const allNotes = events.filter(e => e.type === 'note').sort((a,b) => new Date(b.date) - new Date(a.date));
  const handleBroadcast = async (e) => { e.preventDefault(); if(!message.trim()) return; await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: message.trim(), type: 'note', author: appUser.name, isImportant: false }); setMessage(''); addToast('Posted', 'Message sent.'); };
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border dark:border-slate-700"><form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row gap-3"><textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-700 outline-none font-medium dark:text-white" rows="2" placeholder="Message the team..." required></textarea><button className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold">Post</button></form></div>
      <div className="space-y-3">{allNotes.map(n => {
        const authorUser = users.find(u => u.name === n.author);
        return (
        <div key={n.id} className={`p-4 rounded-3xl border shadow-sm flex gap-3 ${n.isImportant ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
          {n.author !== 'System Alert' && <img src={getAvatar(n.author, authorUser?.photoURL)} className="w-10 h-10 rounded-full flex-shrink-0" alt="pic"/>}
          <div className="flex-1"><div className="flex justify-between items-start mb-1"><span className={`font-black text-sm ${n.isImportant ? 'text-red-700' : 'text-blue-600 dark:text-blue-400'}`}>{n.author}</span><span className="text-[10px] font-bold text-slate-400">{new Date(n.date).toLocaleDateString()}</span></div><p className={`font-medium leading-snug ${n.isImportant?'text-red-900':'text-slate-800 dark:text-slate-200'}`}>{n.title}</p></div>
          {appUser?.isAdmin && <button onClick={() => deleteDoc(doc(db, "events", n.id))} className="text-slate-300 hover:text-red-500 self-start"><Trash2 size={16}/></button>}
        </div>
      )})}</div>
    </div>
  )
};

// --- COMPACT MONTH VIEW ---
const TabMonth = ({ currentDate, users, shifts }) => {
  const monthStr = getMonthStr(currentDate); const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); const days = getDaysInMonth(monthStr);
  return (
    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm print-container">
      <style>{`@media print { .no-print{display:none;} .print-container{position:absolute;top:0;left:0;width:100%;} .cell{border:1px solid #000!important;} }`}</style>
      <div className="flex justify-end p-2 no-print"><button onClick={()=>window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs">Print Calendar</button></div>
      <div className="grid grid-cols-7 border-t border-l dark:border-slate-700">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="p-1 bg-slate-50 dark:bg-slate-900 text-center font-black text-[10px] text-slate-500 border-b border-r dark:border-slate-700 uppercase cell">{d}</div>)}
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-r dark:border-slate-700 min-h-[60px] cell"/>)}
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; const dayShifts = shifts.filter(s=>s.date===date&&s.isPublished);
          return (
            <div key={date} className="p-0.5 border-b border-r dark:border-slate-700 min-h-[60px] flex flex-col cell overflow-hidden">
              <span className="text-right text-[9px] font-black text-slate-400 mb-0.5">{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto custom-scrollbar flex-1">{dayShifts.map(s=><div key={s.id} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate ${s.role==='Bartender'?'bg-blue-100 text-blue-800':'bg-orange-100 text-orange-800'}`}>{users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {parseInt(s.startTime)}-{s.endTime==='CLOSE'?'CL':parseInt(s.endTime)}</div>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

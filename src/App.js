import React, { useState, useEffect } from 'react';
import { Bell, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, where, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

// --- COMPONENTS ---
import CheersLogo from './components/CheersLogo';
import Modal from './components/Modal';
import DrawerMenu from './components/DrawerMenu';
import DayDotPrintScreen from './components/DayDotPrintScreen';
import LoginScreen from './components/LoginScreen';
import TabMasterSchedule from './components/TabMasterSchedule';
import TabSchedule from './components/TabSchedule';
import TabMonth from './components/TabMonth';
import TabTimeOff from './components/TabTimeOff';
import TabPrep from './components/TabPrep';
import TabInventory from './components/TabInventory';
import TabRecipes from './components/TabRecipes';
import TabTeam from './components/TabTeam';
import TabMessages from './components/TabMessages';
import TabSales from './components/TabSales';
import TabSettings from './components/TabSettings';
import TabGodMode from './components/TabGodMode';
import TabAuditLog from './components/TabAuditLog';

// --- MASTER THEME ---
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

// --- FIREBASE INITIALIZATION ---
const testConfig = { apiKey: "AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw", authDomain: "chaos-test-d1601.firebaseapp.com", projectId: "chaos-test-d1601", storageBucket: "chaos-test-d1601.firebasestorage.app", messagingSenderId: "534993379994", appId: "1:534993379994:web:9fefb6e10309223afe7523" };
const prodConfig = { apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA", authDomain: "cheers-34b8d.firebaseapp.com", projectId: "cheers-34b8d", storageBucket: "cheers-34b8d.firebasestorage.app", messagingSenderId: "762225019248", appId: "1:762225019248:web:3e142c9563e58ca762a7b5", measurementId: "G-JFZ6EZB0E3" };
const firebaseConfig = window.location.hostname === 'app.86chaos.com' ? prodConfig : testConfig;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
enableIndexedDbPersistence(db).catch((err) => console.warn("Offline mode issue:", err.code));
const auth = getAuth(app);

// --- CONFIG & CONSTANTS ---
const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';
const CURRENT_VERSION = '8.0.0';
const HOLIDAYS = {
  "01-01": "New Year's Day", "02-14": "Valentine's Day", "03-17": "St. Patrick's Day", 
  "05-05": "Cinco de Mayo", "07-04": "Independence Day", "10-31": "Halloween", 
  "11-11": "Veterans Day", "12-24": "Christmas Eve", "12-25": "Christmas Day", "12-31": "NYE",
  "2026-02-08": "Super Bowl", "2026-03-31": "Opening Day", "2026-04-05": "Easter", "2026-05-10": "Mother's Day", 
  "2026-05-25": "Memorial Day", "2026-06-21": "Father's Day", "2026-09-07": "Labor Day", "2026-11-26": "Thanksgiving"
};

// --- HELPERS ---
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
const getHoliday = (dateStr) => { if (!dateStr) return null; const mmdd = dateStr.substring(5); return HOLIDAYS[dateStr] || HOLIDAYS[mmdd] || null; };

// --- CRASH REPORTER & AUDIT LOGS ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) { 
  window.crashCatcherAttached = true; 
  window.breadcrumbs = [];
  window.addEventListener('click', (e) => {
    let btn = e.target.closest('button');
    if (btn) {
      let text = btn.innerText || btn.getAttribute('aria-label') || 'Icon Button';
      if (text.length > 40) text = text.substring(0, 40) + '...';
      window.breadcrumbs.push({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}), action: 'Clicked', target: text.trim().replace(/\n/g, ' ') });
      if (window.breadcrumbs.length > 15) window.breadcrumbs.shift();
    }
  }, true);
  window.onerror = (msg, url, lineNo, columnNo, error) => { 
    addDoc(collection(db, "crashReports"), { type: 'error', message: msg, stack: error?.stack || '', breadcrumbs: window.breadcrumbs || [], time: new Date().toISOString() }).catch(()=>{}); 
    return false; 
  }; 
}
const logAudit = async (user, action, target, details) => {
  if (!user || !user.restaurantId) return;
  try { await addDoc(collection(db, "auditLogs"), { userId: user.id || 'system', userName: user.name || 'System', action, target, details, timestamp: new Date().toISOString(), restaurantId: user.restaurantId, isGhost: user.isGhost || false }); } catch (err) {}
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function App() {
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('86chaosUser'); return saved ? JSON.parse(saved) : null; });
  const [ghostTenant, setGhostTenant] = useState(null);
  const rId = ghostTenant ? ghostTenant.id : appUser?.restaurantId;
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) { const data = await response.json(); if (data.version !== CURRENT_VERSION) setShowUpdateBanner(true); }
      } catch (error) {}
    };
    checkAppVersion();
    const versionInterval = setInterval(checkAppVersion, 3 * 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);

  useEffect(() => {
    const handleAppInstall = () => {
      const currentUser = JSON.parse(localStorage.getItem('86chaosUser'));
      logAudit(currentUser, 'APP_INSTALLED', 'Device OS', 'User installed 86chaos as a native app to their device.');
    };
    window.addEventListener('appinstalled', handleAppInstall);
    return () => window.removeEventListener('appinstalled', handleAppInstall);
  }, []);

  // --- DATABASE DATA ---
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
  const timePunches = useLiveCollection('timePunches', rId);
  
  // --- USER MAPPING ---
  let liveAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users?.find(u => u.id === appUser.id) || appUser)) : null;
  if (ghostTenant && liveAppUser) {
    if (ghostTenant.impersonate) { liveAppUser = { ...ghostTenant.impersonate, isGhost: true }; } 
    else { liveAppUser = { ...liveAppUser, restaurantId: ghostTenant.id, restaurantName: ghostTenant.name, isAdmin: true, role: 'System Administrator', isGhost: true }; }
  }

  const [clientData, setClientData] = useState({});
  const clientFeatures = clientData?.features || {};
  if (liveAppUser && clientData?.systemSettings) liveAppUser = { ...liveAppUser, systemSettings: clientData.systemSettings };

  useEffect(() => {
    if (!rId) return;
    const unsub = onSnapshot(doc(db, 'restaurants', rId), (d) => {
      if (d.exists()) {
         const data = d.data();
         setClientData(data);
         const localRefresh = sessionStorage.getItem('lastRefreshSignal');
         if (data.forceRefresh && data.forceRefresh !== localRefresh) {
            sessionStorage.setItem('lastRefreshSignal', data.forceRefresh);
            if (localRefresh) window.location.reload(true);
         }
      }
    });

    if (!ghostTenant) {
      const today = new Date().toDateString();
      const lastPing = localStorage.getItem(`ping_${rId}`);
      if (lastPing !== today) {
        updateDoc(doc(db, 'restaurants', rId), { lastActive: new Date().toISOString() }).catch(()=>{});
        localStorage.setItem(`ping_${rId}`, today);
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
    if (appUser) localStorage.setItem('86chaosUser', JSON.stringify(appUser));
    else localStorage.removeItem('86chaosUser');
  }, [appUser]);

  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  if (labelsToPrint) return <DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} formatDisplayDate={formatDisplayDate} getExpDate={getExpDate} />;

  if (!liveAppUser) return <LoginScreen setAppUser={setAppUser} auth={auth} db={db} />;

  // BILLING LOCK
  if (clientData?.billingStatus === 'Past Due' && !ghostTenant) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${T.bg}`}>
        <div className="bg-[#1A2126] p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-md w-full">
          <span className="text-6xl mb-4 block">💸</span>
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
            <span className="flex-shrink-0 animate-pulse text-sm">👻</span>
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

      {showUpdateBanner && (
        <div className="bg-red-600 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[9999] shadow-2xl uppercase tracking-wider">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 animate-pulse text-sm">🚨</span>
            <span className="truncate">System update available. Refresh to prevent database desync.</span>
          </div>
          <button onClick={() => window.location.reload(true)} className="bg-white text-red-600 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3">
            REFRESH NOW
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 bg-[#12161A]/95 backdrop-blur-md border-[#2A353D]">
        <CheersLogo />
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

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} clientFeatures={clientFeatures} T={T} getAvatar={getAvatar} MASTER_ADMIN_EMAIL={MASTER_ADMIN_EMAIL} />
      
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

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date" T={T}>
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
        {activeTabState === 'schedule' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule) && <TabSchedule currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} db={db} storage={storage} Modal={Modal} T={T} getToday={getToday} getMonthStr={getMonthStr} getDaysInMonth={getDaysInMonth} formatDisplayDate={formatDisplayDate} formatShortTime={formatShortTime} getHoliday={getHoliday} logAudit={logAudit} />}
        {activeTabState === 'published' && <TabMasterSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} db={db} Modal={Modal} T={T} getToday={getToday} getMonthStr={getMonthStr} formatDisplayDate={formatDisplayDate} formatShortTime={formatShortTime} />}
        {activeTabState === 'sales' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.sales) && <TabSales sales={sales} timePunches={timePunches} users={users} addToast={addToast} appUser={liveAppUser} db={db} T={T} getToday={getToday} />}
        {activeTabState === 'messages' && <TabMessages events={events} appUser={liveAppUser} users={users} addToast={addToast} db={db} T={T} storage={storage} />}
        {activeTabState === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} tasks={tasks} appUser={liveAppUser} setLabelsToPrint={setLabelsToPrint} db={db} T={T} useLiveCollection={useLiveCollection} formatDate={formatDate} getToday={getToday} addToast={addToast} />}
        {activeTabState === 'recipes' && <TabRecipes recipes={recipes} appUser={liveAppUser} addToast={addToast} db={db} Modal={Modal} T={T} MASTER_ADMIN_EMAIL={MASTER_ADMIN_EMAIL} />}
        {activeTabState === 'inventory' && <TabInventory inventoryItems={inventoryItems} vendors={vendors} wasteLogs={wasteLogs} sales={sales} addToast={addToast} appUser={liveAppUser} db={db} Modal={Modal} T={T} getToday={getToday} useLiveCollection={useLiveCollection} />}
        {activeTabState === 'team' && <TabTeam users={users} appUser={liveAppUser} addToast={addToast} db={db} auth={auth} firebaseConfig={firebaseConfig} T={T} useLiveCollection={useLiveCollection} getAvatar={getAvatar} />}
        {activeTabState === 'settings' && <TabSettings addToast={addToast} appUser={liveAppUser} clientData={clientData} users={users} db={db} auth={auth} T={T} useLiveCollection={useLiveCollection} getAvatar={getAvatar} logAudit={logAudit} MASTER_ADMIN_EMAIL={MASTER_ADMIN_EMAIL} />}
        {activeTabState === 'godmode' && <TabGodMode appUser={liveAppUser} addToast={addToast} setGhostTenant={setGhostTenant} db={db} auth={auth} Modal={Modal} T={T} getToday={getToday} generateTempPass={generateTempPass} firebaseConfig={firebaseConfig} CURRENT_VERSION={CURRENT_VERSION} />}
        {activeTabState === 'audit' && (liveAppUser?.isAdmin || liveAppUser?.isSuperAdmin) && <TabAuditLog appUser={liveAppUser} useLiveCollection={useLiveCollection} T={T} />}
        {activeTabState === 'month' && <TabMonth currentDate={currentDate} users={users} shifts={shifts} T={T} getMonthStr={getMonthStr} getDaysInMonth={getDaysInMonth} formatDisplayMonth={formatDisplayMonth} formatShortTime={formatShortTime} />}
        {activeTabState === 'time-off' && <TabTimeOff timeOffRequests={timeOffRequests} appUser={liveAppUser} users={users} addToast={addToast} events={events} db={db} T={T} getToday={getToday} getDaysInMonth={getDaysInMonth} formatDisplayDate={formatDisplayDate} formatShortTime={formatShortTime} getHoliday={getHoliday} formatDisplayMonth={formatDisplayMonth} />}
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
        <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Beta Version {CURRENT_VERSION}</span>
      </div>
    </div>
  );
}

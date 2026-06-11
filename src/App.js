import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star } from 'lucide-react';
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
const formatShortTime = (t) => { if (!t) return ''; if(t === 'CLOSE') return 'CL'; let [h, m] = t.split(':'); h = parseInt(h, 10); return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h >= 12 ? 'p' : 'a'}`; };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();

// Wisconsin Food Code: 7-day total shelf life. Prep Day is Day 1. Expires on Prep Date + 6 days.
const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };

// --- Global Crash Reporter ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) {
  window.crashCatcherAttached = true;
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    addDoc(collection(db, "crashReports"), { type: 'error', message: msg, stack: error?.stack || '', time: new Date().toISOString() }).catch(()=>{});
    return false;
  };
  window.addEventListener('unhandledrejection', (event) => {
    addDoc(collection(db, "crashReports"), { type: 'promise_rejection', message: event.reason?.message || 'Unknown', time: new Date().toISOString() }).catch(()=>{});
  });
}

// --- Audit Log Helper (Failsafe) ---
const logAudit = async (user, action, target, details) => {
  try {
    await addDoc(collection(db, "auditLogs"), { 
      userName: user?.name || user?.email || "Unknown User", 
      action: action || "UNKNOWN_ACTION", 
      target: target || "System", 
      details: details || "No details provided.", 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error("Audit failed to save:", error);
  }
};

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
  
  if (appUser?.isAdmin) { 
    tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> }); 
    tabs.push({ id: 'timeoff', label: 'Request Off', icon: <Coffee size={18}/> });
  } else {
    tabs.push({ id: 'timeoff', label: 'Request Off', icon: <Coffee size={18}/> });
  }
  
  tabs.push({ id: 'published', label: 'Master Roster', icon: <Clock size={18}/> });
  tabs.push({ id: 'month', label: 'Month View', icon: <Calendar size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> });
  
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') { 
    tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> }); 
    tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> });
  }
  
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  
  if (appUser?.isAdmin) { 
    tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> }); 
    if (appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      tabs.push({ id: 'audit', label: 'Audit Logs', icon: <Shield size={18}/> });
    }
  }
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

import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star } from 'lucide-react';
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
const formatShortTime = (t) => { if (!t) return ''; if(t === 'CLOSE') return 'CL'; let [h, m] = t.split(':'); h = parseInt(h, 10); return `${h % 12 || 12}${m === '00' ? '' : ':' + m}${h >= 12 ? 'p' : 'a'}`; };
const getAvatar = (name, url) => url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'Staff')}&background=random&color=fff&bold=true`;
const generateTempPass = () => Math.random().toString(36).slice(-6).toUpperCase();

// Wisconsin Food Code: 7-day total shelf life. Prep Day is Day 1. Expires on Prep Date + 6 days.
const getExpDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 6); return `${dt.getMonth()+1}/${dt.getDate()}/${dt.getFullYear().toString().slice(-2)}`; };

// --- Global Crash Reporter ---
if (typeof window !== 'undefined' && !window.crashCatcherAttached) {
  window.crashCatcherAttached = true;
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    addDoc(collection(db, "crashReports"), { type: 'error', message: msg, stack: error?.stack || '', time: new Date().toISOString() }).catch(()=>{});
    return false;
  };
  window.addEventListener('unhandledrejection', (event) => {
    addDoc(collection(db, "crashReports"), { type: 'promise_rejection', message: event.reason?.message || 'Unknown', time: new Date().toISOString() }).catch(()=>{});
  });
}

// --- Audit Log Helper (Failsafe) ---
const logAudit = async (user, action, target, details) => {
  try {
    await addDoc(collection(db, "auditLogs"), { 
      userName: user?.name || user?.email || "Unknown User", 
      action: action || "UNKNOWN_ACTION", 
      target: target || "System", 
      details: details || "No details provided.", 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error("Audit failed to save:", error);
  }
};

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
  
  if (appUser?.isAdmin) { 
    tabs.push({ id: 'schedule', label: 'Schedule Maker', icon: <Calendar size={18}/> }); 
    tabs.push({ id: 'timeoff', label: 'Request Off', icon: <Coffee size={18}/> });
  } else {
    tabs.push({ id: 'timeoff', label: 'Request Off', icon: <Coffee size={18}/> });
  }
  
  tabs.push({ id: 'published', label: 'Master Roster', icon: <Clock size={18}/> });
  tabs.push({ id: 'month', label: 'Month View', icon: <Calendar size={18}/> });
  tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/> });
  
  if (appUser?.isAdmin || appUser?.role === 'Kitchen') { 
    tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> }); 
    tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> });
  }
  
  tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  
  if (appUser?.isAdmin) { 
    tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> }); 
    if (appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
      tabs.push({ id: 'audit', label: 'Audit Logs', icon: <Shield size={18}/> });
    }
  }
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


// --- PUBLISHED SHIFTS & TRADE BOARD (Compacted) ---
const TabPublishedShifts = ({ currentDate, appUser, users, shifts, shiftSwaps, addToast }) => {
  const monthStr = getMonthStr(currentDate);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr) && s.isPublished).sort((a,b)=>a.date.localeCompare(b.date));
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

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
                   <div className="flex gap-2 items-center"><img src={getAvatar(orig?.name, orig?.photoURL)} className="w-6 h-6 rounded-full" alt="pic"/><div><span className="font-bold text-xs block dark:text-white leading-tight">{orig?.name?.split(' ')[0]}</span><span className="text-[9px] font-bold text-slate-500">{formatDisplayDate(sw.date)}</span></div></div>
                   {appUser.id !== sw.originalEmployeeId && appUser.role === sw.role && <button onClick={() => handleClaim(sw)} className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-[10px]">Claim</button>}
                </div>
              )
           })}</div>
         </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900 p-3 font-black border-b dark:border-slate-700 text-base flex items-center gap-2 dark:text-white"><Calendar size={16}/> Master Roster</div>
        <div className="divide-y dark:divide-slate-700">
          {monthShifts.map(s => {
             const emp = users.find(u => u.id === s.employeeId); const isMe = appUser.id === s.employeeId; const isOffered = shiftSwaps.some(sw => sw.shiftId === s.id);
             return (
               <div key={s.id} className={`p-2.5 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isMe ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                 <div className="flex items-center gap-2.5">
                   <img src={getAvatar(emp?.name, emp?.photoURL)} className={`w-8 h-8 rounded-full border-2 object-cover ${s.role==='Bartender'?'border-blue-400':'border-orange-400'}`} alt="pic"/>
                   <div>
                     <span className={`font-bold text-sm block leading-tight ${isMe ? 'text-blue-700 dark:text-blue-400' : 'dark:text-white'}`}>{emp?.name} {isMe && '(You)'}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase">{formatDisplayDate(s.date)} • {s.role}</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md border dark:border-slate-600 dark:text-slate-200">{formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}</div>
                   {isMe && !isOffered && <button onClick={() => handleOfferSwap(s)} className="bg-slate-900 dark:bg-slate-600 text-white px-2 py-1 rounded-md font-bold text-[10px] shadow-sm hover:bg-slate-800 transition-colors">Trade</button>}
                   {isOffered && <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-black uppercase text-slate-500">Posted</span>}
                 </div>
               </div>
             )
          })}
          {monthShifts.length === 0 && <div className="p-6 text-center text-xs text-slate-400 font-bold">No published shifts yet.</div>}
        </div>
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
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-r dark:border-slate-700 min-h-[50px] cell"/>)}
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; const dayShifts = shifts.filter(s=>s.date===date&&s.isPublished);
          return (
            <div key={date} className="p-0.5 border-b border-r dark:border-slate-700 min-h-[50px] flex flex-col cell overflow-hidden">
              <span className="text-right text-[9px] font-black text-slate-400 mb-0.5">{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto custom-scrollbar flex-1">{dayShifts.map(s=><div key={s.id} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate ${s.role==='Bartender'?'bg-blue-100 text-blue-800':'bg-orange-100 text-orange-800'}`}>{users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}</div>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- SCHEDULE MAKER (Redesigned & Sleek + Events & Time Off Blocks) ---
const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, addToast, appUser }) => {
  const [selectedEmp, setSelectedEmp] = useState(''); const [assignDates, setAssignDates] = useState([]); const [presetShift, setPresetShift] = useState('Custom'); const [startTime, setStartTime] = useState('16:00'); const [endTime, setEndTime] = useState('21:00');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false); const [eventDate, setEventDate] = useState(getToday()); const [eventTitle, setEventTitle] = useState('');
  
  const displayUsers = [...users].sort((a,b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));
  const monthStr = getMonthStr(currentDate); const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => a.date.localeCompare(b.date));

  const SHIFT_PRESETS = [ { label: "9a-3p", start: "09:00", end: "15:00" }, { label: "10a-4p", start: "10:00", end: "16:00" }, { label: "10a-9p", start: "10:00", end: "21:00" }, { label: "11a-3p", start: "11:00", end: "15:00" }, { label: "11a-4p", start: "11:00", end: "16:00" }, { label: "4p-9p", start: "16:00", end: "21:00" }, { label: "7p-close", start: "19:00", end: "CLOSE" }, { label: "9p-close", start: "21:00", end: "CLOSE" }, { label: "Custom", start: "", end: "" } ];
  const handlePresetChange = (e) => { const val = e.target.value; setPresetShift(val); const p = SHIFT_PRESETS.find(x => x.label === val); if (p && val !== 'Custom') { setStartTime(p.start); if (p.end !== 'CLOSE') setEndTime(p.end); } };

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    const sTime = startTime; const eTime = presetShift.includes('close') ? '23:59' : endTime;
    
    const validDates = [];
    for (const d of assignDates) { 
      const req = timeOffRequests.find(r => r.date === d && r.userId === emp.id);
      if (req) {
        if (!req.isPartial) {
          addToast('Blocked', `${emp.name.split(' ')[0]} requested ${formatDisplayDate(d)} completely off.`);
          return; // Abort entire assignment block
        } else {
          const reqEnd = req.endTime || '23:59';
          if ((sTime < reqEnd) && (eTime > req.startTime)) {
            addToast('Blocked', `${emp.name.split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`);
            return; // Abort due to time overlap
          }
        }
      }
      validDates.push(d);
    }

    for (const d of validDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role, startTime: sTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false }); }
    setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shifts.`);
  };

  const handlePublish = async () => {
    if(!window.confirm("Publish schedule? Notifications will be sent.")) return;
    const unpub = monthShifts.filter(s => !s.isPublished); for(const s of unpub) await updateDoc(doc(db, "shifts", s.id), {isPublished:true});
    addToast("Published", "Schedule is live.");
    if (typeof logAudit === 'function') logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', 'Pushed a new schedule live.');
  };

  const handleAddEvent = async (e) => {
    e.preventDefault(); if(!eventTitle.trim()) return;
    await addDoc(collection(db, "events"), { type: 'special_event', date: eventDate, title: eventTitle.trim(), addedBy: appUser.name });
    setEventTitle(''); setIsEventModalOpen(false); addToast('Event Added', 'Calendar updated.');
  };

  return (
    <div className="space-y-6 pb-12">
      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title="Add Special Event">
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none font-bold dark:text-white" required/></div>
          <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Event Title (e.g. Wedding Reception)</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none font-bold dark:text-white" required/></div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">Save Event</button>
        </form>
      </Modal>

      {/* SLEEK CONTROL DOCK */}
      <div className="bg-slate-900 dark:bg-slate-800 p-2 sm:p-3 rounded-2xl shadow-xl flex flex-col lg:flex-row gap-3 items-center justify-between border border-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap md:flex-nowrap gap-2 w-full lg:w-auto items-center">
          <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className="w-full md:w-40 p-2 text-sm bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white rounded-lg font-bold outline-none"><option value="">👤 Select Staff</option>{displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select value={presetShift} onChange={handlePresetChange} className="w-full md:w-32 p-2 text-sm bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white rounded-lg font-bold outline-none">{SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</select>
          <div className="flex gap-2 w-full md:w-auto">
            <input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className="w-full md:w-28 p-2 text-sm bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white rounded-lg font-bold outline-none"/>
            <input type="time" value={presetShift.includes('close')?'':endTime} disabled={presetShift.includes('close')} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className="w-full md:w-28 p-2 text-sm bg-slate-800 dark:bg-slate-900 border border-slate-700 text-white rounded-lg font-bold outline-none disabled:opacity-50"/>
          </div>
          <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-black shadow-sm disabled:opacity-50 transition-colors">Assign ({assignDates.length})</button>
        </div>
        <button onClick={handlePublish} className="w-full lg:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-black shadow-sm transition-colors whitespace-nowrap">Publish All</button>
      </div>

      {/* SCHEDULE GRID */}
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="w-full text-left text-[10px] border-collapse">
          <thead><tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700"><th className="p-2 font-bold sticky left-0 bg-slate-50 dark:bg-slate-900 z-20 w-24 border-r border-slate-200 dark:border-slate-700 dark:text-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Staff</th>{monthDays.map(d=>{
            const hasEvent = monthEvents.some(e => e.date === d);
            return (
            <th key={d} className={`p-1 text-center border-r border-slate-200 dark:border-slate-700 min-w-[38px] ${new Date(d+'T12:00').getDay()%6===0?'bg-slate-100 dark:bg-slate-800':''}`}><div className="font-bold text-slate-400 uppercase">{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'short'})}</div><div className="text-sm font-black dark:text-white relative">{parseInt(d.split('-')[2])} {hasEvent && <Star size={8} className="absolute top-0 right-1 text-amber-500 fill-amber-500"/>}</div></th>
          )})}</tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{displayUsers.map(u => (
            <tr key={u.id} className={selectedEmp===u.id?'bg-blue-50/50 dark:bg-blue-900/20':''}>
              <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`p-2 font-bold sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 cursor-pointer truncate shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${selectedEmp===u.id?'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-white':'bg-white dark:bg-slate-800 dark:text-slate-300'}`}>{u.name.split(' ')[0]}</td>
              {monthDays.map(d => {
                const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); 
                const req = timeOffRequests.find(r=>r.date===d&&r.userId===u.id);
                const sel = assignDates.includes(d) && selectedEmp===u.id;
                
                return (<td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-slate-100 dark:border-slate-700 cursor-pointer transition-all ${sel?'bg-amber-400 dark:bg-amber-500 outline outline-4 outline-amber-500 shadow-xl scale-[1.15] z-50 relative':'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  <div className="flex flex-col gap-[1px]">
                    {req && !req.isPartial && <div className="w-full rounded font-black text-[8px] py-1 text-center text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-tighter leading-tight" title="Requested Off">Unavail</div>}
                    {req && req.isPartial && <div className="w-full rounded font-black text-[8px] py-1 px-0.5 text-center text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 uppercase tracking-tighter leading-tight" title={`Off: ${formatShortTime(req.startTime)}-${formatShortTime(req.endTime)}`}>Off: {formatShortTime(req.startTime)}-{formatShortTime(req.endTime)}</div>}
                    {shift && <div className={`w-full rounded font-bold text-[9px] py-1 text-center text-white ${shift.isPublished?(u.role==='Bartender'?'bg-blue-500':'bg-orange-500'):'bg-slate-400'}`} title={`${formatShortTime(shift.startTime)} - ${formatShortTime(shift.endTime)}`}>{formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}</div>}
                    {!req && !shift && <div className="h-5 rounded"></div>}
                  </div>
                </td>)
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* SPECIAL EVENTS SECTION */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-black text-lg flex items-center gap-2 dark:text-white"><Star className="text-amber-500"/> Special Events</h3>
          <button onClick={() => {setEventDate(currentDate); setIsEventModalOpen(true);}} className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm dark:text-white">Add Event</button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {monthEvents.length === 0 && <div className="p-6 text-center text-sm font-bold text-slate-400">No special events scheduled this month.</div>}
          {monthEvents.map(ev => (
            <div key={ev.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 font-black text-center rounded-xl p-2 w-14 shadow-sm flex-shrink-0">
                  <div className="text-[10px] uppercase">{new Date(ev.date+'T12:00').toLocaleDateString('en-US',{month:'short'})}</div>
                  <div className="text-lg leading-tight">{parseInt(ev.date.split('-')[2])}</div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{ev.title}</h4>
                  <span className="text-[10px] font-bold text-slate-400">Added by {ev.addedBy}</span>
                </div>
              </div>
              <button onClick={() => { if(window.confirm("Delete event?")) deleteDoc(doc(db,"events",ev.id)); }} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};


// --- PREP LIST (Normal UI - Triggers the App-Level Print Screen) ---
const TabPrep = ({ currentDate, prepItems, appUser, setLabelsToPrint }) => {
  const [text, setText] = useState(''); const [cat, setCat] = useState('General'); const [isMaster, setIsMaster] = useState(true); const [prepDate, setPrepDate] = useState(currentDate);
  const items = prepItems.filter(p=>p.date===prepDate||p.isMaster);

  const handleAdd = async (e) => { e.preventDefault(); if(text.trim()) { await addDoc(collection(db, "prepItems"), { date: isMaster?'MASTER':prepDate, text: text.trim(), category: cat, isCompleted: false, completedDates: {}, isMaster, qty: 1, completedBy: null, isSelected: false }); setText(''); } };
  const toggleStatus = async (item) => { 
    if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = dts[prepDate] ? null : appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); }
    else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted, completedBy: !item.isCompleted ? appUser.name : null, isSelected: false }); }
  };
  const updateQty = async (id, currentQty, change) => { await updateDoc(doc(db, "prepItems", id), { qty: Math.max(1, currentQty + change) }); };
  const toggleSelect = async (i) => await updateDoc(doc(db, "prepItems", i.id), { isSelected: !i.isSelected });
  
  const handleBatchDone = async () => {
    const toComplete = items.filter(i => i.isSelected); if (toComplete.length === 0) return;
    for (const item of toComplete) { if (item.isMaster) { const dts = {...(item.completedDates||{})}; dts[prepDate] = appUser.name; await updateDoc(doc(db, "prepItems", item.id), { completedDates: dts, isSelected: false }); } else { await updateDoc(doc(db, "prepItems", item.id), { isCompleted: true, completedBy: appUser.name, isSelected: false }); } }
  };

  const triggerBatchPrint = () => {
    const selected = items.filter(i => i.isSelected); if (selected.length === 0) return;
    const toPrint = []; selected.forEach(item => { for (let i = 0; i < (item.qty||1); i++) { toPrint.push({ ...item, printId: `${item.id}-${i}-${Date.now()}` }); } });
    setLabelsToPrint({ items: toPrint, prepDate }); 
  };

  const globalSelectedCount = items.filter(i => i.isSelected).length;
  const groupedItems = items.reduce((acc, i) => { const c = i.category || 'General'; if(!acc[c]) acc[c]=[]; acc[c].push(i); return acc; }, {});

  return (
    <div className="max-w-2xl mx-auto space-y-3 relative pb-40">
      <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-3 rounded-xl flex justify-between items-center shadow-sm">
         <h3 className="font-bold flex items-center gap-2 text-sm dark:text-white"><ClipboardList className="text-blue-500" size={18}/> Prep List For:</h3>
         <input type="date" value={prepDate} onChange={e=>setPrepDate(e.target.value)} className="p-1.5 border rounded-lg outline-none text-sm font-bold dark:bg-slate-700 dark:border-slate-600 dark:text-white"/>
      </div>
      <form onSubmit={handleAdd} className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-2 pl-3 rounded-xl flex flex-col sm:flex-row gap-2 shadow-sm items-center">
        <input type="text" value={text} onChange={e=>setText(e.target.value)} className="flex-1 w-full p-1.5 bg-transparent text-sm outline-none font-medium dark:text-white" placeholder="Add prep task..." required/>
        <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full sm:w-28 p-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-lg outline-none dark:text-white"><option>General</option><option>Meat</option><option>Produce</option><option>Dairy</option><option>Sauces</option><option>Line Prep</option></select>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 dark:border-slate-700">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer"><input type="checkbox" checked={isMaster} onChange={e=>setIsMaster(e.target.checked)} className="w-4 h-4"/> Master</label>
          <button className="bg-blue-600 text-white p-2 rounded-lg font-bold"><Plus size={18}/></button>
        </div>
      </form>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
        {Object.entries(groupedItems).map(([category, catItems]) => (
          <div key={category}>
            <div className="bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 border-y dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 tracking-wider flex justify-between"><span>{category}</span><span>{catItems.filter(i => (i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted)).length}/{catItems.length} Done</span></div>
            <div className="divide-y dark:divide-slate-700">
              {catItems.map(i=>{
                const isDone = i.isMaster ? !!i.completedDates?.[prepDate] : i.isCompleted; const doneBy = i.isMaster ? i.completedDates?.[prepDate] : i.completedBy; const qty = i.qty||1;
                return (
                <div key={i.id} className={`p-2 flex items-center gap-2 transition-colors ${i.isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                  <input type="checkbox" checked={!!i.isSelected} onChange={()=>toggleSelect(i)} className="w-5 h-5 rounded border-slate-300 accent-blue-600 flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0"><span className={`text-sm font-bold ${isDone?'line-through text-slate-400':'dark:text-white'}`}>{i.text}</span> {doneBy && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded ml-2">✓ {doneBy}</span>} {i.isMaster&&<span className="block text-[9px] font-black text-blue-500 uppercase mt-0.5">Master Task</span>}</div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg border dark:border-slate-600 h-8"><button onClick={()=>updateQty(i.id,qty,-1)} className="w-6 h-full font-bold dark:text-white hover:bg-slate-200 transition-colors">-</button><span className="w-5 text-center text-xs font-bold dark:text-white">{qty}</span><button onClick={()=>updateQty(i.id,qty,1)} className="w-6 h-full font-bold dark:text-white hover:bg-slate-200 transition-colors">+</button></div>
                    <button onClick={()=>toggleStatus(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${isDone?'bg-slate-200 text-slate-500 dark:bg-slate-600':'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-400'}`}>{isDone ? <Repeat size={14}/> : <Check size={16}/>}</button>
                    <button onClick={()=>{ deleteDoc(doc(db,"prepItems",i.id)); if(typeof logAudit === 'function') logAudit(appUser, 'DELETE_PREP', i.text, 'Deleted a master prep item.'); }} className="text-slate-300 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button onClick={triggerBatchPrint} disabled={globalSelectedCount===0} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-black text-sm disabled:opacity-50">
            🖨️ Print Labels ({globalSelectedCount})
          </button>
          <button onClick={handleBatchDone} disabled={globalSelectedCount===0} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-black text-sm disabled:opacity-50">Mark Done</button>
        </div>
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
          <div className="bg-white dark:bg-slate-800 p-5 border dark:border-slate-700 rounded-2xl shadow-sm"><h3 className="text-lg font-bold border-b dark:border-slate-700 pb-2 mb-3 dark:text-white">Current Master Catalog</h3><div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">{inventoryItems.map(item => (<div key={item.id} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg border border-transparent transition-all"><div><span className="font-bold text-slate-800 dark:text-white block text-sm leading-tight">{item.name}</span><span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded mt-0.5 inline-block uppercase">{item.category} • {item.packSize || '1 CS'}</span></div><div className="flex gap-1 items-center"><button onClick={() => toggleStar(item)} className={`p-1.5 rounded-md transition-colors ${item.isStarred ? 'text-yellow-400' : 'text-slate-300'}`}>{item.isStarred ? '⭐' : '☆'}</button><button onClick={() => setEditItem(item)} className="text-slate-400 hover:text-indigo-500 p-1.5 rounded-md"><Edit size={16}/></button><button onClick={() => deleteDoc(doc(db, "inventoryItems", item.id))} className="text-slate-400 hover:text-red-500 p-1.5 rounded-md"><Trash2 size={16}/></button></div></div>))}</div></div>
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
      registration.showNotification("Cheers OS", {
        body: "Loud and clear! Push notifications are locked and loaded.",
        icon: "/app-icon.png"
      });
    } catch(e) { 
      console.error(e); 
      addToast('Error', 'Failed to trigger local push.');
    }
  };

  const handleEnablePush = async () => {
    if (!messaging) return addToast('Error', 'Push not supported.');
    try {
      const p = await Notification.requestPermission(); 
      if(p !== 'granted') return addToast('Denied', 'Notifications blocked.');
      
      addToast('Connecting...', 'Activating secure worker...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      
      let attempts = 0; 
      while (!registration.active && attempts < 20) { 
        await new Promise(r => setTimeout(r, 200)); 
        attempts++; 
      }
      
      const token = await getToken(messaging, { 
        vapidKey: 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU', 
        serviceWorkerRegistration: registration 
      });
      
      if(token) { 
        await updateDoc(doc(db, "users", appUser.id), { fcmToken: token }); 
        addToast('Success', 'Push enabled.'); 
      }
    } catch(e) { 
      addToast('Error', e.message); 
      console.error(e);
    }
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
          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border dark:border-slate-600 flex justify-between items-center">
             <div><h4 className="font-bold text-sm dark:text-slate-200">Profile Picture</h4><p className="text-xs text-slate-500 dark:text-slate-400">Upload a custom avatar</p></div>
             <label className="bg-white dark:bg-slate-800 border dark:border-slate-600 px-4 py-2 rounded-lg font-bold text-xs cursor-pointer hover:bg-slate-100 transition-colors shadow-sm dark:text-white">Upload Image<input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border dark:border-slate-600 space-y-3">
             <div className="flex justify-between items-center cursor-pointer" onClick={toggleReminder}>
               <div><h4 className="font-bold text-sm dark:text-slate-200">Shift Reminders</h4><p className="text-xs text-slate-500 dark:text-slate-400">Alert me before my shifts</p></div>
               <div className={`w-10 h-5 rounded-full flex items-center px-1 ${appUser.shiftRemindersEnabled?'bg-blue-600':'bg-slate-300 dark:bg-slate-600'}`}><div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${appUser.shiftRemindersEnabled?'translate-x-4':'translate-x-0'}`}></div></div>
             </div>
             {appUser.shiftRemindersEnabled && (
               <div className="flex items-center justify-between border-t dark:border-slate-600 pt-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Hours before shift:</span>
                  <input type="number" min="1" max="72" value={appUser.reminderLeadTime || 24} onChange={(e) => updateLeadTime(e.target.value)} className="w-16 p-1.5 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg text-center font-bold text-sm outline-none dark:text-white shadow-sm" />
               </div>
             )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
           <h4 className="font-black text-blue-900 dark:text-blue-400 mb-1">Device Push Notifications</h4>
           <p className="text-xs text-blue-800 dark:text-blue-300 mb-4 font-medium">Link this device to receive alerts.</p>
           <div className="flex gap-2">
             <button onClick={handleEnablePush} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex-1 text-sm hover:bg-blue-700 shadow-sm">Enable Alerts</button>
             {appUser.fcmToken && <button onClick={testPush} className="bg-slate-900 dark:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex-1 text-sm shadow-sm hover:bg-slate-800">Test Push</button>}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- AUDIT LOGS & CRASH VIEWER (Self-Contained) ---
const TabAuditLog = ({ appUser }) => {
  const [logs, setLogs] = useState([]);
  const [crashes, setCrashes] = useState([]);
  const [view, setView] = useState('audit'); // 'audit' or 'crashes'

  useEffect(() => {
    if (appUser?.email?.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) return;
    const unsubLogs = onSnapshot(collection(db, "auditLogs"), snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    const unsubCrashes = onSnapshot(collection(db, "crashReports"), snap => {
      setCrashes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.time) - new Date(a.time)));
    });
    return () => { unsubLogs(); unsubCrashes(); };
  }, [appUser]);

  if (appUser?.email?.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      <div className="bg-slate-900 dark:bg-slate-800 p-5 rounded-3xl shadow-xl border border-slate-800 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Shield className={view === 'crashes' ? 'text-orange-500' : 'text-red-500'}/> 
            {view === 'crashes' ? 'System Crash Reports' : 'System Audit Logs'}
            {view === 'audit' && (
               <button onClick={() => logAudit(appUser, 'TEST_FIRE', 'Connection', 'Manual test triggered.')} className="ml-2 bg-emerald-600 text-white px-3 py-1 rounded text-[10px] uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all">
                 Force Test
               </button>
            )}
          </h2>
          <div className="flex gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button onClick={() => setView('audit')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${view === 'audit' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Logs</button>
            <button onClick={() => setView('crashes')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${view === 'crashes' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}>Crashes ({crashes.length})</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
            {view === 'audit' ? (
              <>
                {logs.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-400">No events logged yet.</div>}
                {logs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-white">{log.userName}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-md">{log.action}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Target: <span className="font-bold text-slate-800 dark:text-slate-300">{log.target}</span> • {log.details}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {crashes.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-400 text-emerald-500">Zero system crashes detected. Clear skies!</div>}
                {crashes.map(crash => (
                  <div key={crash.id} className="p-4 bg-orange-50/30 dark:bg-orange-950/10 hover:bg-orange-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wide">{crash.type}</span>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(crash.time).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mb-1">{crash.message}</p>
                    {crash.stack && <pre className="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-40">{crash.stack}</pre>}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- RECIPE BOOK (Digital Spec Sheets) ---
const TabRecipes = ({ recipes, appUser, addToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState(null);

  // Form State
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Sauce/Dressing');
  const [prepTime, setPrepTime] = useState(''); const [yieldAmt, setYieldAmt] = useState('');
  const [ingredients, setIngredients] = useState(''); const [instructions, setInstructions] = useState('');

  const categories = ['All', 'Sauce/Dressing', 'Meat Prep', 'Appetizer', 'Entree', 'Side', 'Dessert', 'Cocktail'];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !ingredients.trim() || !instructions.trim()) return addToast('Error', 'Missing required fields.');
    try {
      await addDoc(collection(db, "recipes"), {
        title: title.trim(), category, prepTime: prepTime.trim() || '--', yieldAmt: yieldAmt.trim() || '--',
        ingredients: ingredients.trim(), instructions: instructions.trim(),
        authorName: appUser.name, authorId: appUser.id, lastUpdated: new Date().toISOString()
      });
      addToast('Recipe Saved', `${title} added to the book.`);
      setIsFormOpen(false); setTitle(''); setPrepTime(''); setYieldAmt(''); setIngredients(''); setInstructions('');
    } catch (err) { addToast('Error', 'Could not save recipe.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this recipe?")) return;
    await deleteDoc(doc(db, "recipes", id));
    setActiveRecipe(null); addToast('Deleted', 'Recipe removed.');
  };

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.ingredients.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCat === 'All' || r.category === filterCat;
    return matchesSearch && matchesCat;
  }).sort((a,b) => a.title.localeCompare(b.title));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      
      {/* SEARCH & FILTER HEADER */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
          <input type="text" placeholder="Search recipes or ingredients..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"/>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className="flex-1 md:w-48 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none dark:text-white">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setIsFormOpen(true)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"><Plus size={18}/> New Spec</button>
        </div>
      </div>

      {/* RECIPE GRID */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-20 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl"><ChefHat className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48}/><h3 className="text-lg font-black text-slate-500 dark:text-slate-400">No recipes found.</h3><p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-1">Adjust your search or add a new spec.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map(r => (
            <div key={r.id} onClick={() => setActiveRecipe(r)} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-md">{r.category}</span>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">View Spec →</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-auto leading-tight">{r.title}</h3>
              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400"><Clock size={14}/> {r.prepTime}</div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400"><Scale size={14}/> Yield: {r.yieldAmt}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW MODAL (The Spec Sheet) */}
      <Modal isOpen={!!activeRecipe} onClose={() => setActiveRecipe(null)} title="Spec Sheet">
        {activeRecipe && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2">{activeRecipe.title}</h2>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{activeRecipe.category}</span>
                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md flex items-center gap-1"><Clock size={12}/> {activeRecipe.prepTime}</span>
                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md flex items-center gap-1"><Scale size={12}/> Yield: {activeRecipe.yieldAmt}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-1">Ingredients</h4>
                <ul className="space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  {activeRecipe.ingredients.split('\n').map((ing, i) => ing.trim() && <li key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"/><span>{ing}</span></li>)}
                </ul>
              </div>
              
              <div className="md:col-span-3 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 pb-1">Method</h4>
                <div className="space-y-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {activeRecipe.instructions.split('\n').map((step, i) => step.trim() && <p key={i} className="leading-relaxed"><strong className="text-slate-900 dark:text-white mr-1">{i+1}.</strong>{step}</p>)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-700 mt-6">
              <div className="text-[10px] font-bold text-slate-400">Added by {activeRecipe.authorName}</div>
              {(appUser?.isAdmin || appUser?.id === activeRecipe.authorId) && (
                <button onClick={() => handleDelete(activeRecipe.id)} className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"><Trash2 size={14}/> Delete Recipe</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ADD MODAL */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Add New Spec">
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Recipe Title</label><input type="text" value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" required placeholder="e.g. House Ranch"/></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Category</label><select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl font-bold text-sm outline-none">{categories.slice(1).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Prep Time</label><input type="text" value={prepTime} onChange={(e)=>setPrepTime(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl font-bold text-sm outline-none" placeholder="e.g. 15 mins"/></div>
            <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Yield</label><input type="text" value={yieldAmt} onChange={(e)=>setYieldAmt(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl font-bold text-sm outline-none" placeholder="e.g. 4 Quarts"/></div>
          </div>
          <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ingredients (One per line)</label><textarea value={ingredients} onChange={(e)=>setIngredients(e.target.value)} rows="5" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl font-medium text-sm outline-none custom-scrollbar" required placeholder="1 Cup Mayo&#10;1/2 Cup Buttermilk&#10;1 Tbsp Dill"/></div>
          <div><label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Method / Instructions (One step per line)</label><textarea value={instructions} onChange={(e)=>setInstructions(e.target.value)} rows="5" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 dark:text-white rounded-xl font-medium text-sm outline-none custom-scrollbar" required placeholder="Combine mayo and buttermilk in cambro.&#10;Whisk in dry seasoning.&#10;Label and date."/></div>
          <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl font-black text-sm shadow-md hover:bg-blue-700 transition-colors">Save Recipe</button>
        </form>
      </Modal>

    </div>
  );
};

// --- TIME OFF REQUESTS (Compact, Direct Logic, No Approvals) ---
const TabTimeOff = ({ timeOffRequests, appUser, users, addToast }) => {
  const [calMonth, setCalMonth] = useState(getToday().substring(0, 7));
  const [selectedDates, setSelectedDates] = useState([]);
  const [isPartial, setIsPartial] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const myRequests = timeOffRequests.filter(r => r.userId === appUser.id).sort((a,b) => new Date(a.date) - new Date(b.date));
  const allFutureRequests = timeOffRequests.filter(r => r.date >= getToday()).sort((a,b) => new Date(a.date) - new Date(b.date));

  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`);
  const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();

  const changeMonth = (offset) => {
    const d = new Date(calMonth + '-01T12:00:00');
    d.setMonth(d.getMonth() + offset);
    setCalMonth(d.toISOString().substring(0, 7));
  };

  const handleToggleDate = (d) => {
    if (d < getToday()) return addToast('Locked', 'Cannot request past dates.');
    if (myRequests.some(r => r.date === d)) return addToast('Exists', 'Already requested this date.');
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    if (selectedDates.length === 0) return addToast('Error', 'Select days on the calendar first.');
    if (isPartial && (!startTime || !endTime)) return addToast('Error', 'Please set partial times.');

    for (const d of selectedDates) {
      await addDoc(collection(db, "timeOffRequests"), { 
        userId: appUser.id, userName: appUser.name, date: d, 
        isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null, 
        submittedAt: new Date().toISOString() 
      });
    }
    
    addToast('Recorded', `Logged ${selectedDates.length} days off.`);
    setSelectedDates([]); setIsPartial(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      
      {/* ADMIN OVERRIDE VIEW */}
      {appUser?.isAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
          <div className="bg-slate-50 dark:bg-slate-900 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
             <h3 className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2"><Shield size={14} className="text-red-500"/> Master Override Log</h3>
             <span className="text-[10px] font-bold text-slate-500">Delete a record to allow scheduling.</span>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-700">
            {allFutureRequests.length === 0 && <div className="p-4 text-center text-xs font-bold text-slate-400">No upcoming time off for any staff.</div>}
            {allFutureRequests.map(r => (
              <div key={r.id} className="p-2 sm:px-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex-1">
                  <div className="font-black text-sm text-slate-900 dark:text-white leading-tight">{r.userName}</div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatDisplayDate(r.date)} {r.isPartial && <span className="ml-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 rounded">({formatShortTime(r.startTime)} - {formatShortTime(r.endTime)})</span>}
                  </div>
                </div>
                <button onClick={() => { if(window.confirm("Force delete this request? This will allow them to be scheduled.")) deleteDoc(doc(db,"timeOffRequests",r.id)); }} className="text-slate-300 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAFF VIEW: COMPACT CALENDAR & SUBMIT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COMPACT CALENDAR */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <button onClick={() => changeMonth(-1)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white transition-colors"><ChevronLeft size={16}/></button>
            <h3 className="font-black text-base dark:text-white tracking-tight">{formatDisplayMonth(calMonth)}</h3>
            <button onClick={() => changeMonth(1)} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white transition-colors"><ChevronRight size={16}/></button>
          </div>
          
          <div className="grid grid-cols-7 border-t border-slate-100 dark:border-slate-700">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="py-1.5 text-center text-[9px] font-black text-slate-400 uppercase border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">{d}</div>)}
            {Array.from({length: firstDayOffset}).map((_,i) => <div key={`empty-${i}`} className="p-1 border-b border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 min-h-[45px]" />)}
            {monthDays.map(d => {
              const isSelected = selectedDates.includes(d);
              const existingReq = myRequests.find(r => r.date === d);
              const isPast = d < getToday();
              
              return (
                <div key={d} onClick={() => !isPast && !existingReq && handleToggleDate(d)} className={`p-1.5 border-b border-r border-slate-100 dark:border-slate-700 min-h-[45px] flex flex-col items-center justify-center transition-colors ${(isPast || existingReq) ? 'bg-slate-50 dark:bg-slate-900/50 opacity-60 cursor-not-allowed' : isSelected ? 'bg-blue-100 dark:bg-blue-900/40 cursor-pointer shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer'}`}>
                  <span className={`text-xs font-black ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                  {existingReq && <span className="text-[7px] font-black uppercase text-red-500 mt-0.5">Off</span>}
                  {isSelected && <Check size={10} className="text-blue-600 dark:text-blue-400 mt-0.5"/>}
                </div>
              )
            })}
          </div>
        </div>

        {/* SUBMISSION PANEL */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 sticky top-20">
            <h3 className="font-black text-base mb-1 dark:text-white">Log Availability</h3>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-4 leading-tight">Tap days on the calendar to mark yourself unavailable.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <input type="checkbox" checked={isPartial} onChange={e=>setIsPartial(e.target.checked)} className="w-4 h-4 rounded border-slate-300 accent-blue-600" />
                Partial Day Only?
              </label>

              {isPartial && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/50">
                  <div><label className="block text-[9px] font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Start Time</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg outline-none font-bold text-xs dark:text-white" required/></div>
                  <div><label className="block text-[9px] font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">End Time</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg outline-none font-bold text-xs dark:text-white" required/></div>
                </div>
              )}
              
              <button type="submit" disabled={selectedDates.length === 0} className="w-full bg-slate-900 dark:bg-blue-600 text-white p-3.5 rounded-xl font-black text-sm shadow-md hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Submit {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};



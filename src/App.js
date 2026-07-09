import React, { useState, useEffect } from 'react';
import { Bell, ChevronLeft, ChevronRight, Menu, Moon, X } from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import 'leaflet/dist/leaflet.css';
import { T, db, messaging, CURRENT_VERSION, MASTER_ADMIN_EMAIL, useLiveCollection, getToday, getMonthStr, formatDate, formatDisplayFullDate, formatDisplayMonth, logAudit, setActiveTimeFormat } from './core/appCore';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, GlobalSearchModal, KitchenTVMode, ChangeLogModal, UndoBar, QuickActionDock } from './components/common';
import { LoginScreen, TabMasterSchedule, TabSchedule, TabScheduleWorkbench, TabOpsCenter, TabSales, TabLabor, TabMessages, TabPrep, TabRecipes, TabInventory, TabTeam, TabMaintenance, TabSettings, TabHelpCenter, TabGodMode, TabAuditLog, TabToday } from './features';

export default function App() {
  const [appUser, setAppUser] = useState(() => { 
    try {
      const savedLocal = localStorage.getItem('86chaosUser'); 
      const savedSession = sessionStorage.getItem('86chaosUser');
      return savedLocal ? JSON.parse(savedLocal) : (savedSession ? JSON.parse(savedSession) : null);
    } catch (err) {
      console.warn('Stored session was corrupted. Clearing local session cache.', err);
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
      return null;
    }
  });
  // --- GHOST MODE & ROUTING STATE ---
  const [ghostTenant, setGhostTenant] = useState(null);
      
  const rId = ghostTenant ? ghostTenant.id : appUser?.restaurantId;
  const [activeTabState, setActiveTabState] = useState(() => appUser?.preferences?.defaultTab || 'today');
  const [clientData, setClientData] = useState(null);
  const clientFeatures = clientData?.features || {};
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  
  // --- VERSION CHECKER STATE & LOGIC ---
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.version !== CURRENT_VERSION) {
            setShowUpdateBanner(true);
          }
        }
      } catch (error) {
        console.warn("Background version check failed:", error);
      }
    };

    checkAppVersion();
    const versionInterval = setInterval(checkAppVersion, 3 * 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);



  
                    
  // --- APP INSTALL TRACKER (NEW) ---
  useEffect(() => {
    const handleAppInstall = () => {
      const currentUser = JSON.parse(localStorage.getItem('86chaosUser'));
      logAudit(currentUser, 'APP_INSTALLED', 'Device OS', 'User installed 86chaos as a native app to their device.');
    };
    window.addEventListener('appinstalled', handleAppInstall);
    return () => window.removeEventListener('appinstalled', handleAppInstall);
  }, []);

// --- DATABASE IMPORTS (Read-Optimized) ---
  // Loads only the sections the current screen needs and caps large collections.
  const wantsToday = activeTabState === 'today';
  const wantsScheduleData = wantsToday || ['schedule', 'events', 'published', 'labor', 'ops'].includes(activeTabState);
  const wantsLaborData = wantsToday || ['labor', 'sales', 'ops', 'schedule'].includes(activeTabState);
  const wantsInventoryData = wantsToday || ['inventory', 'ops'].includes(activeTabState) || isGlobalSearchOpen;
  const wantsPrepData = wantsToday || ['prep', 'ops'].includes(activeTabState);
  const wantsRecipesData = wantsToday || activeTabState === 'recipes' || isGlobalSearchOpen;
  const wantsMaintenanceData = wantsToday || ['maintenance', 'ops'].includes(activeTabState);
  const wantsSalesData = wantsToday || ['sales', 'ops', 'labor'].includes(activeTabState);

  const users = useLiveCollection('users', rId, { enabled: !!rId, limitCount: 500 });
  const shifts = useLiveCollection('shifts', rId, { enabled: !!rId && wantsScheduleData, limitCount: 650 });
  const shiftSwaps = useLiveCollection('shiftSwaps', rId, { enabled: !!rId && wantsScheduleData, limitCount: 150 });
  const events = useLiveCollection('events', rId, { enabled: !!rId && (wantsToday || activeTabState === 'messages' || activeTabState === 'events' || isGlobalSearchOpen), limitCount: 250 });
  const sales = useLiveCollection('sales', rId, { enabled: !!rId && wantsSalesData, limitCount: 120 });
  const timeOffRequests = useLiveCollection('timeOffRequests', rId, { enabled: !!rId && wantsScheduleData, limitCount: 180 });
  const timePunches = useLiveCollection('timePunches', rId, { enabled: !!rId && wantsLaborData, limitCount: 500 });
  const inventoryItems = useLiveCollection('inventoryItems', rId, { enabled: !!rId && wantsInventoryData, limitCount: 500 });
  const maintenanceLogs = useLiveCollection('maintenanceLogs', rId, { enabled: !!rId && wantsMaintenanceData, limitCount: 180 });
  const prepItems = useLiveCollection('prepItems', rId, { enabled: !!rId && wantsPrepData, limitCount: 250 });
  const tasks = useLiveCollection('tasks', rId, { enabled: !!rId && wantsPrepData, limitCount: 350 });
  const recipes = useLiveCollection('recipes', rId, { enabled: !!rId && wantsRecipesData, limitCount: 350 });
  
// --- LIVE APP USER LOGIC ---
  const fullGhostPermissions = { schedule: true, events: true, ops: true, inventory: true, prep: true, sales: true, team: true, labor: true, help: true };
  const realAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users?.find(u => u.id === appUser.id) || appUser)) : null;
  let liveAppUser = realAppUser;

  if (ghostTenant && realAppUser) {
    const ghostWorkspaceId = ghostTenant.id || ghostTenant.restaurantId;
    const realName = realAppUser.name || realAppUser.email || 'System Admin';

    if (ghostTenant.impersonate) {
       // USER POSSESSION MODE:
       // Show the target user's "My Schedule" and profile identity, but keep your support/admin powers
       // so Schedule Builder, Team, Settings, Sales, Inventory, etc. still load for that workspace.
       liveAppUser = {
         ...ghostTenant.impersonate,
         restaurantId: ghostWorkspaceId,
         restaurantName: ghostTenant.name,
         isAdmin: true,
         isSuperAdmin: realAppUser.isSuperAdmin || realAppUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase(),
         role: `Ghosting ${ghostTenant.impersonate.role || 'User'}`,
         permissions: { ...fullGhostPermissions, ...(ghostTenant.impersonate.permissions || {}) },
         isGhost: true,
         ghostMode: 'user',
         ghostRealUserId: realAppUser.id,
         ghostRealUserName: realName,
         ghostTargetUserId: ghostTenant.impersonate.id,
         ghostTargetUserName: ghostTenant.impersonate.name || ghostTenant.impersonate.email || 'Target User'
       };
    } else {
       // WORKSPACE GHOST MODE: Enter the client account as a full support administrator.
       liveAppUser = {
         ...realAppUser,
         restaurantId: ghostWorkspaceId,
         restaurantName: ghostTenant.name,
         isAdmin: true,
         isSuperAdmin: true,
         role: 'System Administrator',
         permissions: { ...fullGhostPermissions, ...(realAppUser.permissions || {}) },
         isGhost: true,
         ghostMode: 'workspace',
         ghostRealUserId: realAppUser.id,
         ghostRealUserName: realName,
         ghostWorkspaceName: ghostTenant.name
       };
    }
  }

  // --- REMOTE SESSION KILL SWITCH ---
  useEffect(() => {
    if (liveAppUser?.forceLogout) {
      updateDoc(doc(db, "users", liveAppUser.id), { forceLogout: false }).catch(()=>{});
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
      setAppUser(null);
      alert("Session terminated by System Administrator to clear a cache error. Please log in again.");
    }
  }, [liveAppUser?.forceLogout]);



  const [labelsToPrint, setLabelsToPrint] = useState(null);

  // --- GLOBAL WORKSPACE & HEALTH PING ---

  // Safety net: if System Admin disables a module while a user still has that tab open,
  // send them back to the main Time Clock/Shifts screen instead of showing a blank page.
  useEffect(() => {
    const gatedTabs = ['ops', 'events', 'messages', 'prep', 'recipes', 'inventory', 'sales', 'team', 'maintenance', 'schedule', 'labor'];
    if (gatedTabs.includes(activeTabState) && clientFeatures?.[activeTabState] === false) {
      setActiveTab('published');
    }
  }, [activeTabState, clientFeatures]);

// THE FIX: Safely attach BOTH the System Settings and the Plan Tier to the live user
if (liveAppUser && clientData) {
     liveAppUser = { 
       ...liveAppUser, 
       systemSettings: clientData.systemSettings || {},
       planType: clientData.planType || 'Pro'
     };
  }
  setActiveTimeFormat(liveAppUser?.preferences?.timeFormat || '12h');

  useEffect(() => {
    if (!rId) return;
    
    // 1. Fetch Master Client Data (Features & Billing)
    const unsub = onSnapshot(doc(db, 'restaurants', rId), (d) => {
      if (d.exists()) {
         const data = d.data();
         setClientData(data);
         
         // FORCE REFRESH LISTENER
         const localRefresh = sessionStorage.getItem('lastRefreshSignal');
         if (data.forceRefresh && data.forceRefresh !== localRefresh) {
            sessionStorage.setItem('lastRefreshSignal', data.forceRefresh);
            if (localRefresh) {
                // Instantly triggers a hard reload and pulls fresh cache from Vercel
                window.location.reload(true);
            }
         }
      }
    });

// 2. Live Presence Heartbeat (Only real users, never Ghost Mode)
    let heartbeatTimer = null;
    let handleVisibility = null;
    let handleBeforeUnload = null;

    if (!ghostTenant && appUser?.id) {
      let sessionId = sessionStorage.getItem('chaosSessionId');
      if (!sessionId) {
        sessionId = `${appUser.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem('chaosSessionId', sessionId);
      }

      const sendHeartbeat = (state = 'online') => {
        const stamp = new Date().toISOString();
        const device = (navigator.userAgent || 'Unknown device').substring(0, 140);
        updateDoc(doc(db, 'restaurants', rId), { lastActive: stamp }).catch(()=>{});
        updateDoc(doc(db, 'users', appUser.id), {
          lastActive: stamp,
          lastSeen: stamp,
          onlineState: state,
          activeTab: activeTabState,
          activeSessionId: sessionId,
          activeDevice: device,
          activeHost: window.location.hostname
        }).catch(()=>{});
      };

      sendHeartbeat(document.hidden ? 'away' : 'online');
      heartbeatTimer = setInterval(() => sendHeartbeat(document.hidden ? 'away' : 'online'), 60000);
      handleVisibility = () => sendHeartbeat(document.hidden ? 'away' : 'online');
      handleBeforeUnload = () => sendHeartbeat('offline');
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      unsub();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (handleVisibility) document.removeEventListener('visibilitychange', handleVisibility);
      if (handleBeforeUnload) window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [rId, ghostTenant, appUser?.id, activeTabState]);

 
  useEffect(() => {
    const handlePopState = (e) => { if (e.state && e.state.tab) setActiveTabState(e.state.tab); else setActiveTabState('published'); };
    window.addEventListener('popstate', handlePopState);
    const params = new URLSearchParams(window.location.search);
    const preferredTab = appUser?.preferences?.defaultTab || 'today';
    const tab = params.get('tab') || preferredTab;
    setActiveTabState(tab); window.history.replaceState({ tab }, '', `?tab=${tab}`);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appUser]);

  const setActiveTab = (tab) => {
    if (liveAppUser?.id) {
      try {
        const key = `recentTabs_${liveAppUser.id}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]').filter(t => t !== tab);
        localStorage.setItem(key, JSON.stringify([tab, ...current].slice(0, 6)));
      } catch(e) {}
    }
    window.history.pushState({ tab }, '', `?tab=${tab}`); setActiveTabState(tab);
  };

useEffect(() => {
    const shouldRemember = localStorage.getItem('chaosRememberMe') !== 'false';
    if (appUser) {
      if (shouldRemember) {
        localStorage.setItem('86chaosUser', JSON.stringify(appUser));
        sessionStorage.removeItem('86chaosUser');
      } else {
        sessionStorage.setItem('86chaosUser', JSON.stringify(appUser));
        localStorage.removeItem('86chaosUser');
      }
    } else {
      localStorage.removeItem('86chaosUser');
      sessionStorage.removeItem('86chaosUser');
    }
  }, [appUser]);

  // --- AUTO-LOGOUT INACTIVITY TIMER (30 MINUTES) ---
  useEffect(() => {
    if (!appUser) return;
    let timeoutId;
    
    const logoutUser = () => {
      setAppUser(null);
      alert("You have been automatically logged out due to inactivity.");
    };
    
    const resetTimer = () => {
      clearTimeout(timeoutId);
      // Change the 30 below to whatever minute threshold you prefer
      timeoutId = setTimeout(logoutUser, 30 * 60 * 1000); 
    };
    
    // Listen for any kind of interaction
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();
    
    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [appUser]);
  

  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKitchenTVOpen, setIsKitchenTVOpen] = useState(false);
  const [undoItem, setUndoItem] = useState(null);
  const [showChangeLog, setShowChangeLog] = useState(() => localStorage.getItem(`seen_${CURRENT_VERSION}`) !== 'true');
  const registerUndo = (item) => { setUndoItem(item); setTimeout(() => setUndoItem(prev => prev === item ? null : prev), 12000); };


// --- NOTIFICATION DOT LOGIC (WITH READ RECEIPTS) ---
  // 1. Unread Messages (with NaN safety fallback)
  const latestNoteDate = events.filter(e => e.type === 'note').reduce((max, n) => {
     const dTime = new Date(n.date || 0).getTime();
     return isNaN(dTime) ? max : Math.max(max, dTime);
  }, 0);
  const lastReadMsg = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadMsg`) || '0') : 0;
  const hasUnreadMessages = latestNoteDate > lastReadMsg && activeTabState !== 'messages';

  // 2. Shift Swaps (Clear dot when they visit My Shift / Trade Board)
  const latestSwap = shiftSwaps.filter(s => s.status === 'available' && s.originalEmployeeId !== liveAppUser?.id).reduce((max, s) => Math.max(max, new Date(s.date).getTime()), 0);
  const lastReadSwaps = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadSwaps`) || '0') : 0;
  const hasAvailableSwaps = latestSwap > lastReadSwaps && activeTabState !== 'published'; 

  // 3. Manager Alerts (Clear dot when they visit Schedule Builder)
  const realCurrentMonthStr = getToday().substring(0, 7);
  const latestTimeOffReq = timeOffRequests.filter(r => r.status === 'pending' && r.date?.startsWith(realCurrentMonthStr)).reduce((max, r) => Math.max(max, new Date(r.submittedAt || 0).getTime()), 0);
  const lastReadTimeOff = liveAppUser ? parseInt(localStorage.getItem(`${liveAppUser.id}_lastReadTimeOff`) || '0') : 0;
  const isManagerAlert = !!(liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule) && (latestTimeOffReq > lastReadTimeOff) && activeTabState !== 'schedule';

  // Consolidated Alerts
  const hasMyShiftAlert = hasAvailableSwaps; 
  const hasScheduleBuilderAlert = isManagerAlert; 
  const hasAnyMenuAlert = hasUnreadMessages || hasMyShiftAlert || hasScheduleBuilderAlert; 

  // The "Read Receipt" Engine - Clears the dots instantly when tabs are opened
  useEffect(() => {
    if (!liveAppUser) return;
    if (activeTabState === 'messages') localStorage.setItem(`${liveAppUser.id}_lastReadMsg`, Date.now().toString());
    if (activeTabState === 'published') localStorage.setItem(`${liveAppUser.id}_lastReadSwaps`, Date.now().toString());
    if (activeTabState === 'schedule') localStorage.setItem(`${liveAppUser.id}_lastReadTimeOff`, Date.now().toString());
  }, [activeTabState, events, shiftSwaps, timeOffRequests, liveAppUser]);

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

// --- AUTO-ASK FOR NOTIFICATIONS ON LOGIN ---
  useEffect(() => {
    if (liveAppUser && !ghostTenant && typeof window !== 'undefined' && 'Notification' in window) {
      // Only ask if they haven't made a decision yet
      if (Notification.permission === 'default') {
        // Wait 2.5 seconds after app load so the browser doesn't flag it as spam
        setTimeout(() => {
          Notification.requestPermission().then(async (permission) => {
            if (permission === 'granted' && messaging) {
              
              // THE FIX: Apply the Smart Target Lock here too
              const activeVapidKey = window.location.hostname === 'app.86chaos.com' 
                ? 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU' // Production
                : 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc'; // Testing Sandbox

              const currentToken = await getToken(messaging, { 
                vapidKey: activeVapidKey 
              });
              if (currentToken) {
                await updateDoc(doc(db, "users", liveAppUser.id), { fcmToken: currentToken });
                addToast('Success', 'Push notifications enabled for this device.');
              }
            }
          });
        }, 2500);
      }
    }
  }, [liveAppUser?.id]);
                      
  // --- FOREGROUND NOTIFICATION CATCHER ---
  useEffect(() => {
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      console.log("Foreground message caught:", payload);
      addToast(
        payload.notification?.title || 'System Alert', 
        payload.notification?.body || 'You have a new notification.'
      );
    });
    return () => unsub();
  }, [addToast, messaging]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setIsGlobalSearchOpen(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const prevDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setCurrentDate(formatDate(d)); };
  const nextDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setCurrentDate(formatDate(d)); };
  const prevMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setCurrentDate(formatDate(d)); };
  const nextMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); setCurrentDate(formatDate(d)); };

  if (labelsToPrint) return <DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} />;

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} addToast={addToast} />;

  // BILLING LOCK SCREEN (Only locks real users, Super Admins in Ghost Mode bypass this)
  if (clientData?.billingStatus === 'Past Due' && !ghostTenant) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${T.bg}`}>
        <div className="bg-[#1A2126] p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-md w-full">
          <span className="text-6xl mb-4 block">🚫</span>
          <h1 className="text-2xl font-black text-white mb-2">Subscription Past Due</h1>
          <p className="text-slate-400 font-medium mb-6">Access to 86 Chaos has been temporarily suspended for {clientData.name || 'this workspace'}. Please contact your management team or 86 Chaos Support to renew your plan.</p>
          <button onClick={() => { localStorage.removeItem('86chaosUser'); setAppUser(null); }} className="w-full bg-red-900/20 text-red-500 font-black py-3 rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-all uppercase tracking-widest">Log Out</button>
        </div>
      </div>
    );
  }

return (
    <div className={`ui-v16-command-center ui-v13-polished ui-v12-compact cockpit-shell relative isolate ui-density-${liveAppUser?.preferences?.uiDensity || clientData?.systemSettings?.uiDensity || 'compact'} recipe-density-${liveAppUser?.preferences?.recipeDensity || clientData?.systemSettings?.recipeCardDensity || 'tight'} motion-${liveAppUser?.preferences?.motionMode || clientData?.systemSettings?.cockpitLights || 'normal'} min-h-screen font-sans flex flex-col w-full max-w-[100vw] overflow-x-hidden ${T.bg}`}>
      
      {/* GHOST MODE BANNER */}
      {ghostTenant && (
        <div className="bg-gradient-to-r from-purple-900 to-fuchsia-900 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[99999] shadow-2xl uppercase tracking-wider border-b border-fuchsia-500/50">
          <div className="flex items-center gap-2 min-w-0">
            <Moon size={16} className="flex-shrink-0 animate-pulse text-fuchsia-300" />
            <span className="truncate">GHOST MODE OVERRIDE: {ghostTenant.impersonate ? `${ghostTenant.impersonate.name || ghostTenant.impersonate.email} @ ${ghostTenant.name}` : ghostTenant.name}</span>
          </div>
          <button onClick={() => { setGhostTenant(null); window.history.pushState({ tab: 'godmode' }, '', '?tab=godmode'); setActiveTabState('godmode'); }} className="bg-white text-purple-900 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3">
            EXIT GHOST MODE
          </button>
        </div>
      )}
      
      <style>{`
        html, body { overflow-x: hidden !important; max-width: 100vw !important; width: 100% !important; background-color: #05080A !important; color-scheme: dark; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 138, 28, .38); border-radius: 999px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .cockpit-shell {
          --chaos-bg: #05080A;
          --chaos-deck: #070A0D;
          --chaos-panel: #111821;
          --chaos-panel-2: #151D24;
          --chaos-border: rgba(92, 112, 126, .56);
          --chaos-border-strong: rgba(255, 138, 28, .42);
          --chaos-accent: #F97316;
          --chaos-accent-2: #FFB34D;
          --chaos-accent-3: #C76712;
          --chaos-text: #F8FAFC;
          --chaos-muted: #94A3B8;
          --chaos-shadow: 0 24px 80px rgba(0,0,0,.42);
          --chaos-glass: linear-gradient(180deg, rgba(21,29,36,.92), rgba(7,10,13,.94));
          background:
            radial-gradient(circle at 12% -10%, rgba(249, 115, 22, .18), transparent 32%),
            radial-gradient(circle at 88% 8%, rgba(56, 189, 248, .08), transparent 28%),
            linear-gradient(180deg, #070A0D 0%, #05080A 48%, #081016 100%);
        }
        .ui-v16-command-center [class*="bg-[#1A2126]"] { background-color: rgba(17,24,33,.94) !important; }
        .ui-v16-command-center [class*="bg-[#161D22]"] { background-color: rgba(13,19,24,.96) !important; }
        .ui-v16-command-center [class*="bg-[#12161A]"] { background-color: rgba(7,10,13,.9) !important; }
        .ui-v16-command-center [class*="bg-[#0B0E11]"] { background-color: rgba(5,8,10,.94) !important; }
        .ui-v16-command-center [class*="border-[#2A353D]"] { border-color: var(--chaos-border) !important; }
        .ui-v16-command-center [class*="text-[#D4A381]"], .ui-v16-command-center [class*="hover:text-[#D4A381]"]:hover { color: var(--chaos-accent-2) !important; }
        .ui-v16-command-center [class*="border-[#D4A381]"], .ui-v16-command-center [class*="focus:border-[#D4A381]"]:focus { border-color: var(--chaos-accent) !important; }
        .ui-v16-command-center [class*="bg-[#D4A381]"] { background-color: var(--chaos-accent) !important; }
        .ui-v16-command-center [class*="accent-[#D4A381]"] { accent-color: var(--chaos-accent) !important; }
        .ui-v16-command-center [class*="from-[#C59373]"][class*="to-[#8F6040]"],
        .ui-v16-command-center [class*="from-[#D4A381]"][class*="to-[#b58563]"] { background-image: linear-gradient(135deg, var(--chaos-accent), var(--chaos-accent-2), var(--chaos-accent-3)) !important; }
        .ui-v16-command-center input, .ui-v16-command-center select, .ui-v16-command-center textarea {
          min-height: 44px;
          border-radius: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
        }
        .ui-v16-command-center input:focus, .ui-v16-command-center select:focus, .ui-v16-command-center textarea:focus {
          box-shadow: 0 0 0 2px rgba(249,115,22,.18), inset 0 1px 0 rgba(255,255,255,.035);
        }
        .ui-v16-command-center table { border-collapse: separate; border-spacing: 0; }
        .ui-v16-command-center th { background: rgba(7,10,13,.96) !important; color: var(--chaos-accent-2) !important; }
        .ui-v16-command-center td { border-color: rgba(92,112,126,.38) !important; }
        .ui-v16-command-center .brand-logo-stack img { object-fit: contain; }
        .ui-v12-compact button { touch-action: manipulation; }
        .ui-v12-compact textarea { line-height: 1.35 !important; }
        .cockpit-light { position: relative; display: inline-flex; width: .55rem; height: .55rem; border-radius: 999px; box-shadow: 0 0 6px currentColor; }
        .cockpit-light::after { content: ''; position: absolute; inset: -4px; border-radius: 999px; background: currentColor; opacity: .08; animation: none; }
        .cockpit-light.quiet::after { animation: none !important; opacity: .08; }
        .cockpit-light.slow::after { animation: cockpitPing 5.5s infinite; opacity: .12; }
        .cockpit-light.hot::after { animation: cockpitPing 1.8s infinite; opacity: .24; }
        @keyframes cockpitPing { 0% { transform: scale(.75); opacity: .28; } 70%,100% { transform: scale(1.8); opacity: 0; } }
        @keyframes softGlow { 0%,100% { box-shadow: 0 0 0 rgba(249,115,22,0); } 50% { box-shadow: 0 0 22px rgba(249,115,22,.24); } }
        .cockpit-panel { background: var(--chaos-glass); border: 1px solid var(--chaos-border); box-shadow: inset 0 1px 0 rgba(255,255,255,.055), var(--chaos-shadow); backdrop-filter: blur(18px); }
        .cockpit-grid { background-image: radial-gradient(circle at 1px 1px, rgba(255,179,77,.11) 1px, transparent 0); background-size: 18px 18px; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .message-pro .message-card-pro { box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 14px 38px rgba(0,0,0,.24); }
        .recipe-card-v13 { min-height: 0 !important; }
        .recipe-card-v13:hover { transform: translateY(-1px); }
        .ui-density-ultra main { padding: .6rem !important; }
        .ui-density-ultra .p-5 { padding: .75rem !important; }
        .ui-density-ultra .p-4 { padding: .65rem !important; }
        .ui-density-ultra .gap-4 { gap: .55rem !important; }
        .ui-density-comfortable main { padding: 1.25rem !important; }
        .recipe-density-tight .recipe-card-v13 .p-2\.5 { padding: .55rem !important; }
        .recipe-density-tight .recipe-card-v13 h3 { font-size: .9rem !important; line-height: 1.15rem !important; }
        .motion-reduced .cockpit-light::after, .motion-quiet .cockpit-light::after { animation: none !important; opacity: .08 !important; }
        .motion-quiet .cockpit-light { box-shadow: none !important; }

        @media (max-width: 640px) {
          .ui-v12-compact main { padding: .75rem !important; }
          .ui-v12-compact button:not(.no-compact) { min-height: 42px !important; padding-top: .55rem !important; padding-bottom: .55rem !important; }
          .ui-v12-compact textarea { min-height: 46px !important; font-size: 14px !important; }
          .ui-v12-compact .rounded-3xl { border-radius: 1rem !important; }
          .ui-v12-compact .rounded-2xl { border-radius: .85rem !important; }
          .ui-v12-compact .p-6 { padding: 1rem !important; }
          .ui-v12-compact .p-5 { padding: .85rem !important; }
          .ui-v12-compact .p-4 { padding: .75rem !important; }
          .ui-v12-compact .gap-5 { gap: .75rem !important; }
          .ui-v12-compact .gap-4 { gap: .65rem !important; }
          .ui-v12-compact .text-2xl { font-size: 1.25rem !important; line-height: 1.55rem !important; }
          .ui-v12-compact .text-xl { font-size: 1.05rem !important; line-height: 1.4rem !important; }
          .ui-v12-compact .text-lg { font-size: .98rem !important; line-height: 1.3rem !important; }
        }
      `}</style>

      {/* UPDATE ALERT BANNER */}
      {showUpdateBanner && (
        <div className="bg-red-600 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[9999] shadow-2xl uppercase tracking-wider">
          <div className="flex items-center gap-2 min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 animate-pulse text-white"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
            <span className="truncate">System update available. Refresh to prevent database desync.</span>
          </div>
          <button 
            onClick={() => window.location.reload(true)} 
            className="bg-white text-red-600 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3"
          >
            REFRESH NOW
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b min-h-16 flex items-center justify-between gap-3 px-3 sm:px-5 bg-[#070A0D]/92 backdrop-blur-xl border-[#33414B] shadow-[0_14px_42px_rgba(0,0,0,0.34)]">
        <CheersLogo clientData={clientData} />

        {/* DYNAMIC RESTAURANT NAME */}
        {liveAppUser && (
          <div className="flex-1 min-w-0 text-center px-1 sm:px-4 truncate">
            <span className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#FFB34D]">
              Command Center
            </span>
            <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 truncate">
              {liveAppUser.restaurantName || "Cheers"}
            </span>
          </div>
        )}

        <button onClick={() => setIsMenuOpen(true)} className={`no-compact relative h-11 w-11 border rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,.28)] transition-all outline-none bg-[#111821] border-[#33414B] ${T.copper} hover:text-white hover:border-[#F97316]/70 flex items-center justify-center flex-shrink-0`} aria-label="Open navigation menu">
          <Menu size={20} />
          {hasAnyMenuAlert && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#12161A] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
        </button>
      </header>

      {/* SYSTEM BROADCAST BANNER */}
      {clientData?.systemBanner && (
        <div className="bg-blue-600 border-b border-blue-800 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-center shadow-lg uppercase tracking-wider w-full relative z-30 animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 text-center">
            <Bell size={14} className="animate-pulse flex-shrink-0" />
            <span>{clientData.systemBanner}</span>
          </div>
        </div>
      )}

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} hasMyShiftAlert={hasMyShiftAlert} hasScheduleBuilderAlert={hasScheduleBuilderAlert} clientFeatures={clientFeatures} clientData={clientData} addToast={addToast} />
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} queryText={globalSearchQuery} setQueryText={setGlobalSearchQuery} users={users} events={events} shifts={shifts} recipes={recipes} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} setActiveTab={setActiveTab} />
      <KitchenTVMode isOpen={isKitchenTVOpen} onClose={() => setIsKitchenTVOpen(false)} shifts={shifts} events={events} prepItems={prepItems} maintenanceLogs={maintenanceLogs} inventoryItems={inventoryItems} />
      <ChangeLogModal isOpen={showChangeLog} onClose={() => { localStorage.setItem(`seen_${CURRENT_VERSION}`, 'true'); setShowChangeLog(false); }} />
      <UndoBar undoItem={undoItem} clearUndo={() => setUndoItem(null)} />
      <QuickActionDock appUser={liveAppUser} setActiveTab={setActiveTab} openSearch={() => setIsGlobalSearchOpen(true)} openTV={() => setIsKitchenTVOpen(true)} addToast={addToast} />    

      {ghostTenant?.impersonate && (
        <div className="bg-fuchsia-950/60 border-b border-fuchsia-500/30 px-4 py-2 text-[10px] sm:text-xs text-fuchsia-100 font-bold flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Viewing user: <strong>{ghostTenant.impersonate.name || 'Unnamed'}</strong></span>
          <span>Email: <strong>{ghostTenant.impersonate.email || 'No email'}</strong></span>
          <span>Role: <strong>{ghostTenant.impersonate.role || 'No role'}</strong></span>
          <span>User ID: <strong className="font-mono">{ghostTenant.impersonate.id}</strong></span>
        </div>
      )}
      
      {['schedule', 'events', 'published', 'month', 'sales', 'prep'].includes(activeTabState) && (
        <div className="py-3 sm:py-4 px-3 sm:px-4 shadow-[0_14px_35px_rgba(0,0,0,.22)] z-30 border-b flex justify-between items-center bg-[#0D1318]/95 backdrop-blur-xl border-[#33414B] relative">
          {activeTabState === 'sales' ? (
            <div className="w-full text-center">
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">Sales & Trends</h2>
            </div>
          ) : (
            <>
              <button onClick={activeTabState === 'prep' ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#070A0D] border-[#33414B] text-slate-400 hover:text-[#FFB34D] hover:border-[#F97316]/60 relative z-10" aria-label="Previous period"><ChevronLeft size={20} /></button>
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381] pointer-events-auto">
                  {activeTabState === 'prep' ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
                </h2>
              </div>

              <button onClick={activeTabState === 'prep' ? nextDay : nextMonth} className="p-2 border rounded-xl transition-colors bg-[#070A0D] border-[#33414B] text-slate-400 hover:text-[#FFB34D] hover:border-[#F97316]/60 relative z-10" aria-label="Next period"><ChevronRight size={20} /></button>
            </>
          )}
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
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
        {activeTabState === 'today' && <TabToday key={`tdy-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} sales={sales} timePunches={timePunches} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} prepItems={prepItems} tasks={tasks} recipes={recipes} clientData={clientData} setActiveTab={setActiveTab} addToast={addToast} registerUndo={registerUndo} />}
        {activeTabState === 'schedule' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule) && <TabScheduleWorkbench key={`schwork-${rId}`} currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'events' && clientFeatures?.events !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.events || liveAppUser?.permissions?.schedule || liveAppUser?.permissions?.team) && <TabSchedule key={`evt-${rId}`} currentDate={currentDate} users={users} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} initialSubTab="events" hideSubTabs />}
        {activeTabState === 'published' && <TabMasterSchedule key={`pub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} />}
        {activeTabState === 'ops' && clientFeatures?.ops !== false && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.ops) && <TabOpsCenter key={`ops-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} events={events} sales={sales} timePunches={timePunches} addToast={addToast} />}
        {activeTabState === 'sales' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.sales) && <TabSales key={`sal-${rId}`} sales={sales} timePunches={timePunches} users={users} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'labor' && clientFeatures?.labor !== false && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.labor || liveAppUser?.permissions?.schedule || liveAppUser?.permissions?.sales) && <TabLabor key={`lab-${rId}`} currentDate={currentDate} users={users} shifts={shifts} sales={sales} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'messages' && <TabMessages key={`msg-${rId}`} events={events} appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'prep' && <TabPrep key={`prp-${rId}`} currentDate={currentDate} appUser={liveAppUser} setLabelsToPrint={setLabelsToPrint} />}
        {activeTabState === 'recipes' && <TabRecipes key={`rec-${rId}`} appUser={liveAppUser} addToast={addToast} />}
        {activeTabState === 'inventory' && clientFeatures?.inventory !== false && <TabInventory key={`inv-${rId}`} addToast={addToast} appUser={liveAppUser} />}
        {activeTabState === 'team' && clientFeatures?.team !== false && <TabTeam key={`tea-${rId}`} appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTabState === 'maintenance' && clientFeatures?.maintenance !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.team) && <TabMaintenance key={`mtn-${rId}`} appUser={liveAppUser} addToast={addToast} />}
        {activeTabState === 'settings' && <TabSettings key={`set-${rId}`} addToast={addToast} appUser={liveAppUser} clientData={clientData} users={users} />}
        {activeTabState === 'help' && <TabHelpCenter key={`help-${rId}`} appUser={liveAppUser} activeTab={activeTabState} addToast={addToast} />}
        {activeTabState === 'godmode' && ((liveAppUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() || liveAppUser?.isSuperAdmin === true) && <TabGodMode key={`god-${rId}`} appUser={liveAppUser} addToast={addToast} setGhostTenant={setGhostTenant} setActiveTab={setActiveTab} />}
        {activeTabState === 'audit' && (liveAppUser?.isAdmin || liveAppUser?.isSuperAdmin) && <TabAuditLog key={`aud-${rId}`} appUser={liveAppUser} />}
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
      
      <div className="w-full flex flex-col items-center justify-center py-4 border-t z-10 mt-auto bg-[#070A0D]/95 border-[#33414B]">
        <img src="/6139.png" alt="86 Chaos OS" className="h-6 sm:h-8 w-auto mb-1.5 rounded shadow-sm opacity-90" onError={(e) => e.currentTarget.style.display = 'none'}/>
        <span className="text-slate-400 font-black text-[10px] tracking-widest uppercase">Version {CURRENT_VERSION}</span>
        <span className="text-slate-600 font-bold text-[8px] tracking-widest uppercase mt-1">Copyright 2026 Chilton App Works LLC</span>
      </div>
    </div>
  );
}

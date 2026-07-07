import React, { useState, useEffect, useMemo } from 'react';
import { Bell, ChevronLeft, ChevronRight, Menu, Moon, X } from 'lucide-react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import 'leaflet/dist/leaflet.css';
import { T, db, auth, messaging, CURRENT_VERSION, MASTER_ADMIN_EMAIL, useLiveCollection, secureFetch, waitForAuthCurrentUser, getToday, getMonthStr, formatDate, formatDisplayFullDate, formatDisplayMonth, logAudit, setActiveTimeFormat } from './core/appCore';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, GlobalSearchModal, KitchenTVMode, UndoBar, VoiceCommandDock } from './components/common';
import { LoginScreen, TabMasterSchedule, TabSchedule, TabScheduleWorkbench, TabOpsCenter, TabFinancials, TabMessages, TabPrep, TabRecipes, TabInventory, TabTeam, TabMaintenance, TabSettings, TabHelpCenter, TabGodMode, TabAuditLog, TabToday } from './features';

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
  const [heartbeatDebug, setHeartbeatDebug] = useState(null);
  const clientFeatures = clientData?.features || {};
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [voiceScheduleSubTabTarget, setVoiceScheduleSubTabTarget] = useState(null);
  const [voiceHelpSearchTarget, setVoiceHelpSearchTarget] = useState(null);
  const [voiceRecipeTarget, setVoiceRecipeTarget] = useState(null);
  
  // --- VERSION CHECKER STATE & LOGIC ---
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [hasHelpUpdate, setHasHelpUpdate] = useState(() => localStorage.getItem(`helpBriefSeen_${CURRENT_VERSION}`) !== 'true');
  const [tourMode, setTourMode] = useState(null);
  const [tourStep, setTourStep] = useState(0);

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

const [currentDate, setCurrentDate] = useState(getToday());

  useEffect(() => {
    try {
      const postRestoreTab = sessionStorage.getItem('86chaosPostRestoreTab');
      if (postRestoreTab) {
        sessionStorage.removeItem('86chaosPostRestoreTab');
        setCurrentDate('2026-07-01');
        setActiveTabState(postRestoreTab);
      }
    } catch (_) {}
  }, []);

  const addDays = (dateStr, amount) => {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return formatDate(d);
  };
  const getMonthBounds = (dateStr) => {
    const [year, month] = getMonthStr(dateStr).split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    return { start, end: formatDate(endDate) };
  };
  const monthBounds = getMonthBounds(currentDate);
  const scheduleWindowStart = addDays(monthBounds.start, -7);
  const scheduleWindowEnd = addDays(monthBounds.end, 14);
  const recentWindowStart = addDays(getToday(), -30);
  const futureWindowEnd = addDays(getToday(), 14);
  const todayOpsWindowEnd = addDays(getToday(), 7);
  const laborPunchWindowStart = addDays(currentDate, -14);
  const laborPunchWindowEnd = addDays(currentDate, 7);
  const lightPunchWindowStart = addDays(getToday(), -1);
  const lightPunchWindowEnd = addDays(getToday(), 1);

  // --- DATABASE IMPORTS (Read Saver + Schedule Restore Safe Mode) ---
  // Schedule shifts are loaded with a single tenant query and filtered in the app.
  // That avoids the missing Firestore composite-index fallback that could briefly show restored shifts
  // and then replace them with a tiny, stale capped snapshot. Other tabs still use tighter windows.
  const wantsToday = activeTabState === 'today';
  const wantsScheduleScreen = ['schedule', 'events', 'published'].includes(activeTabState);
  const wantsScheduleData = wantsToday || wantsScheduleScreen || ['labor', 'ops'].includes(activeTabState);
  const wantsLaborData = wantsToday || ['financials', 'labor', 'sales', 'ops'].includes(activeTabState);
  const wantsInventoryData = wantsToday || ['inventory', 'ops'].includes(activeTabState) || isGlobalSearchOpen;
  const wantsPrepData = wantsToday || ['prep', 'ops'].includes(activeTabState);
  const wantsRecipesData = true; // Keep recipe titles available for 86 Voice exact-recipe navigation.
  const wantsMaintenanceData = wantsToday || ['maintenance', 'ops'].includes(activeTabState);
  const wantsSalesData = ['financials', 'sales', 'ops', 'labor'].includes(activeTabState);
  const shiftRangeStart = wantsScheduleScreen ? scheduleWindowStart : getToday();
  const shiftRangeEnd = wantsScheduleScreen ? scheduleWindowEnd : todayOpsWindowEnd;
  const messageRangeStart = activeTabState === 'messages' ? addDays(getToday(), -60) : recentWindowStart;
  const prepDateWindow = Array.from(new Set([currentDate, getToday(), 'MASTER']));

  const users = useLiveCollection('users', rId, { enabled: !!rId, limitCount: activeTabState === 'godmode' ? 400 : 160, fallbackLimitCount: 60 });
  const presenceSessions = useLiveCollection('presenceSessions', rId, { enabled: !!rId, limitCount: 500, fallbackLimitCount: 180 });
  // Stable per-user live presence. Unlike presenceSessions, this collection has only
  // one document per user, so old sessions cannot push current users out of capped reads.
  const livePresenceRecords = useLiveCollection('livePresence', rId, { enabled: !!rId, limitCount: 500, fallbackLimitCount: 180 });
  const rawShifts = useLiveCollection('shifts', rId, { enabled: !!rId && wantsScheduleData, limitCount: wantsScheduleScreen ? 1500 : 180, fallbackLimitCount: wantsScheduleScreen ? 1500 : 120 });
  const shifts = useMemo(() => {
    const start = shiftRangeStart;
    const end = shiftRangeEnd;
    const rescuedMonths = Array.isArray(clientData?.scheduleRescueProtectedMonths) ? clientData.scheduleRescueProtectedMonths : [];
    const rescueEnforced = clientData?.scheduleRescueEnforceProtected === true;
    return (rawShifts || [])
      .filter(s => {
        const d = String(s.date || s.scheduleDateKey || '');
        const month = String(s.scheduleMonth || d.slice(0, 7) || '');
        if (rescueEnforced && rescuedMonths.includes(month)) {
          // Emergency rescue armor: keep old/restored junk from taking the month back over,
          // but still allow Schedule Builder edits made after the rescue.
          const rescueAt = String(clientData?.lastScheduleRescueAt || '');
          const touchedAt = String(s.updatedAt || s.createdAt || s.importedAt || s.restoredAt || s.publishedAt || '');
          const sourceText = `${s.restoreSourceKey || ''} ${s.sourceKey || ''} ${s.source || ''}`.toLowerCase();
          const protectedSeed = s.rescueProtected === true || s.scheduleBuilderDraft === true || s.readyToPublish === true || s.rescueEditable === true || sourceText.includes('cheers-july-2026');
          const editedAfterRescue = !!rescueAt && !!touchedAt && touchedAt >= rescueAt;
          if (!(protectedSeed || editedAfterRescue)) return false;
        }
        return !d || (d >= start && d <= end);
      })
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.startTime || '').localeCompare(String(b.startTime || '')) || String(a.employeeName || '').localeCompare(String(b.employeeName || '')));
  }, [rawShifts, shiftRangeStart, shiftRangeEnd, clientData?.scheduleRescueEnforceProtected, clientData?.lastScheduleRescueAt, JSON.stringify(clientData?.scheduleRescueProtectedMonths || [])]);
  const shiftSwaps = useLiveCollection('shiftSwaps', rId, { enabled: !!rId && wantsScheduleData, whereClauses: [['date','>=', getToday()], ['date','<=', futureWindowEnd]], orderByField: 'date', orderDirection: 'asc', limitCount: 50, fallbackLimitCount: 25 });
  const events = useLiveCollection('events', rId, { enabled: !!rId && (wantsToday || activeTabState === 'messages' || activeTabState === 'events' || isGlobalSearchOpen), whereClauses: [['date','>=', messageRangeStart]], orderByField: 'date', orderDirection: 'desc', limitCount: activeTabState === 'messages' ? 90 : 35, fallbackLimitCount: 25 });
  const sales = useLiveCollection('sales', rId, { enabled: !!rId && wantsSalesData, whereClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], orderByField: 'date', orderDirection: 'desc', limitCount: 45, fallbackLimitCount: 20 });
  const timeOffRequests = useLiveCollection('timeOffRequests', rId, { enabled: !!rId && wantsScheduleData, limitCount: wantsScheduleScreen ? 70 : 30, fallbackLimitCount: 25 });
  const timePunches = useLiveCollection('timePunches', rId, { enabled: !!rId && wantsLaborData, whereClauses: [['date','>=', activeTabState === 'labor' ? laborPunchWindowStart : lightPunchWindowStart], ['date','<=', activeTabState === 'labor' ? laborPunchWindowEnd : lightPunchWindowEnd]], orderByField: 'date', orderDirection: 'desc', limitCount: activeTabState === 'labor' ? 180 : 35, fallbackLimitCount: 30 });
  const inventoryItems = useLiveCollection('inventoryItems', rId, { enabled: !!rId && wantsInventoryData, limitCount: activeTabState === 'inventory' ? 240 : 75, fallbackLimitCount: 55 });
  const maintenanceLogs = useLiveCollection('maintenanceLogs', rId, { enabled: !!rId && wantsMaintenanceData, limitCount: activeTabState === 'maintenance' ? 110 : 30, fallbackLimitCount: 25 });
  const prepItems = useLiveCollection('prepItems', rId, { enabled: !!rId && wantsPrepData, whereClauses: [['date','in', prepDateWindow]], limitCount: 80, fallbackLimitCount: 35 });
  const tasks = useLiveCollection('tasks', rId, { enabled: !!rId && wantsPrepData, limitCount: 75, fallbackLimitCount: 35 });
  const recipes = useLiveCollection('recipes', rId, { enabled: !!rId && wantsRecipesData, limitCount: 500, fallbackLimitCount: 120 });
  
// --- LIVE APP USER LOGIC ---
  const fullGhostPermissions = { schedule: true, events: true, ops: true, inventory: true, prep: true, sales: true, team: true, labor: true, help: true };
  const realAppUser = appUser ? (appUser.id === 'dev-backdoor' ? appUser : (users?.find(u => u.id === appUser.id) || appUser)) : null;
  let liveAppUser = realAppUser;

  if (ghostTenant && realAppUser) {
    const ghostWorkspaceId = ghostTenant.id || ghostTenant.restaurantId;
    const realName = realAppUser.name || realAppUser.email || 'System Admin';

    if (ghostTenant.demoMode) {
       const demoRole = ghostTenant.demoMode.role || 'manager';
       const demoFeatures = ghostTenant.demoMode.features || {};
       const managerPerms = { schedule: !!(demoFeatures.schedule || demoFeatures.published), events: !!demoFeatures.events, ops: !!demoFeatures.ops, inventory: !!demoFeatures.inventory, prep: !!demoFeatures.prep, sales: !!demoFeatures.financials, team: !!demoFeatures.team, labor: !!demoFeatures.financials, help: true };
       liveAppUser = {
         ...realAppUser,
         id: `${realAppUser.id}_demo`,
         restaurantId: ghostWorkspaceId,
         restaurantName: `${ghostTenant.name} Demo`,
         name: demoRole === 'employee' ? 'Demo Employee' : 'Demo Manager',
         email: 'demo@hidden.example',
         phone: 'Hidden for demo',
         isAdmin: demoRole !== 'employee',
         isSuperAdmin: false,
         role: demoRole === 'employee' ? 'Demo Employee' : 'Demo Manager',
         permissions: demoRole === 'employee' ? { help: true } : managerPerms,
         isGhost: true,
         isDemo: true,
         demoRole,
         demoFeatures,
         planType: ghostTenant.demoMode.plan || 'Pro',
         ghostMode: 'demo',
         ghostRealUserId: realAppUser.id,
         ghostRealUserName: realName,
         ghostWorkspaceName: ghostTenant.name
       };
    } else if (ghostTenant.impersonate) {
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

// THE FIX: Safely attach BOTH the System Settings and the Plan Tier to the live user
if (liveAppUser && clientData) {
     liveAppUser = { 
       ...liveAppUser, 
       systemSettings: clientData.systemSettings || {},
       planType: clientData.planType || 'Pro',
       restaurantName: liveAppUser.restaurantName || clientData.name || clientData.businessName || clientData.restaurantName || '86 Chaos'
     };
  }
  setActiveTimeFormat(liveAppUser?.preferences?.timeFormat || '12h');

  const isDemoMode = !!liveAppUser?.isDemo;
  const rawDemoFeatures = liveAppUser?.demoFeatures || {};
  const displayClientFeatures = isDemoMode ? {
    schedule: rawDemoFeatures.published !== false && rawDemoFeatures.schedule !== false,
    events: rawDemoFeatures.events !== false,
    ops: rawDemoFeatures.ops !== false,
    messages: rawDemoFeatures.messages !== false,
    prep: rawDemoFeatures.prep !== false,
    recipes: rawDemoFeatures.recipes !== false,
    inventory: rawDemoFeatures.inventory !== false,
    team: rawDemoFeatures.team !== false && liveAppUser?.demoRole !== 'employee',
    maintenance: rawDemoFeatures.maintenance !== false,
    labor: rawDemoFeatures.financials !== false && liveAppUser?.demoRole !== 'employee',
    sales: rawDemoFeatures.financials !== false && liveAppUser?.demoRole !== 'employee'
  } : clientFeatures;
  const maskDemoUser = (u, idx = 0) => ({ ...u, name: u.name || `Demo Staff ${idx+1}`, email: `employee${idx+1}@demo.hidden`, phone: 'Hidden for demo', address: 'Hidden for demo', emergencyContact: 'Hidden for demo', wage: 0, photoURL: u.photoURL || '' });
  const parsePresenceTimeMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
    if (typeof value === 'string') { const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : 0; }
    if (typeof value?.toDate === 'function') { const parsed = value.toDate().getTime(); return Number.isFinite(parsed) ? parsed : 0; }
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  };
  const mergePresenceIntoUsers = (userList = [], sessionList = []) => {
    if (!Array.isArray(userList) || !Array.isArray(sessionList) || sessionList.length === 0) return userList || [];
    const now = Date.now();
    const liveWindowMs = 5 * 60 * 1000;
    const sessionsByUser = {};
    sessionList.forEach(session => {
      const userId = session.userId || session.uid || session.id;
      if (!userId) return;
      const lastMs = Math.max(
        parsePresenceTimeMs(session.lastHeartbeatAt),
        parsePresenceTimeMs(session.presenceUpdatedAt),
        parsePresenceTimeMs(session.lastActive),
        parsePresenceTimeMs(session.lastSeen),
        parsePresenceTimeMs(session.heartbeatEpochMs)
      );
      if (!lastMs) return;
      const enriched = { ...session, _presenceLastMs: lastMs, _presenceLive: (now - lastMs) < liveWindowMs && session.onlineState !== 'offline' };
      if (!sessionsByUser[userId]) sessionsByUser[userId] = [];
      sessionsByUser[userId].push(enriched);
    });
    return (userList || []).map(user => {
      const sessions = (sessionsByUser[user.id] || []).sort((a, b) => b._presenceLastMs - a._presenceLastMs);
      if (sessions.length === 0) return user;
      const liveSession = sessions.find(s => s._presenceLive);
      const best = liveSession || sessions[0];
      const bestTime = new Date(best._presenceLastMs).toISOString();
      return {
        ...user,
        lastActive: bestTime,
        lastSeen: bestTime,
        lastHeartbeatAt: best.lastHeartbeatAt || bestTime,
        presenceUpdatedAt: best.presenceUpdatedAt || bestTime,
        onlineState: liveSession ? (best.onlineState || 'online') : (best.onlineState || user.onlineState),
        activeTab: best.activeTab || user.activeTab,
        activeSessionId: best.activeSessionId || user.activeSessionId,
        activeDevice: best.activeDevice || user.activeDevice,
        activeHost: best.activeHost || user.activeHost,
        notificationPermission: best.notificationPermission || user.notificationPermission,
        gpsPermission: best.gpsPermission || user.gpsPermission,
        deviceDiagnostics: best.deviceDiagnostics || user.deviceDiagnostics,
        presenceSessionCount: sessions.length,
        presenceSource: liveSession ? 'live-session' : 'session-history'
      };
    });
  };
  const wageSettings = clientData?.systemSettings || {};
  const wageViewAccess = Array.isArray(wageSettings.wageAccess) ? wageSettings.wageAccess : [];
  const wageEditAccess = Array.isArray(wageSettings.wageEditAccess) ? wageSettings.wageEditAccess : [];
  const sessionEmail = (liveAppUser?.email || appUser?.email || '').toLowerCase().trim();
  const sessionOwnerEmail = (clientData?.ownerEmail || '').toLowerCase().trim();
  const sessionIsOwner = Boolean(liveAppUser?.isSuperAdmin || sessionEmail === MASTER_ADMIN_EMAIL.toLowerCase() || liveAppUser?.isOwner || liveAppUser?.accountOwner || (sessionOwnerEmail && sessionEmail === sessionOwnerEmail));
  const sessionCanViewWages = Boolean(sessionIsOwner || liveAppUser?.permissions?.wageView || liveAppUser?.permissions?.wageEdit || wageViewAccess.includes(liveAppUser?.id) || wageEditAccess.includes(liveAppUser?.id));

  const displayUsers = useMemo(() => {
    const baseUsers = isDemoMode ? (users || []).map(maskDemoUser) : (users || []);
    const sharedPresence = [...(livePresenceRecords || []), ...(presenceSessions || [])];
    let merged = isDemoMode ? baseUsers : mergePresenceIntoUsers(baseUsers, sharedPresence);
    // Current-device safety net: a regular employee should never see their own row drop back
    // to a days-old timestamp while this browser is actively sending heartbeats.
    if (!isDemoMode && appUser?.id && rId) {
      let localMs = 0;
      try { localMs = Number(localStorage.getItem(`chaosLastHeartbeat_${rId}_${appUser.id}`) || 0); } catch (err) {}
      if (localMs && (Date.now() - localMs) < 5 * 60 * 1000) {
        const localIso = new Date(localMs).toISOString();
        merged = merged.map(u => u.id === appUser.id ? {
          ...u,
          lastActive: localIso,
          lastSeen: localIso,
          lastHeartbeatAt: localIso,
          presenceUpdatedAt: localIso,
          heartbeatEpochMs: localMs,
          onlineState: 'online',
          activeTab: activeTabState,
          activeHost: window.location.hostname,
          presenceSource: u.presenceSource || 'local-current-device'
        } : u);
      }
    }
    if (!isDemoMode && !sessionCanViewWages) {
      merged = merged.map(u => ({ ...u, wage: 0, wageHidden: true }));
    }
    return merged;
  }, [isDemoMode, users, presenceSessions, livePresenceRecords, appUser?.id, rId, activeTabState, sessionCanViewWages]);
  if (isDemoMode && liveAppUser?.demoRole === 'employee' && displayUsers?.[0]) {
    liveAppUser = { ...liveAppUser, id: displayUsers[0].id, name: 'Demo Employee', role: displayUsers[0].role || 'Demo Employee', isAdmin: false, isSuperAdmin: false, permissions: { help: true } };
  }
  const displayClientData = isDemoMode && clientData ? { ...clientData, ownerEmail: 'Hidden for demo', ownerPhone: 'Hidden for demo', address: 'Hidden for demo', businessAddress: 'Hidden for demo', systemSettings: { ...(clientData.systemSettings || {}), address: 'Hidden for demo', geofenceAddress: 'Hidden for demo' } } : clientData;
  const demoWritableText = /save|add|create|delete|remove|publish|apply|copy previous|smart fill|clock|send|post|approve|restore|backup|upload|scan|reset|deactivate|terminate|deploy|update|edit|fix|out/i;
  const blockDemoMutation = (e) => {
    if (!isDemoMode) return;
    const el = e.target?.closest?.('button,input[type="submit"]');
    if (!el) return;
    const text = `${el.innerText || el.value || el.getAttribute('aria-label') || ''}`;
    if (demoWritableText.test(text)) {
      e.preventDefault();
      e.stopPropagation();
      addToast('Demo Mode', 'Read-only demo. Nothing was saved.');
    }
  };

  const employeeTourSteps = [
    { title:'Welcome to 86 Chaos', body:'This quick tour shows how to save the web app, clock in/out, view your schedule, read messages, and get help.' },
    { title:'Add it to your phone', body:'Android: open in Chrome, tap ⋮, then Add to Home screen or Install App. iPhone: open in Safari, tap Share, then Add to Home Screen.' },
    { title:'Clock in and out', body:'Use Time Clock & Schedule for punches. If the browser asks for location permission, tap Allow so your punch can be verified.' },
    { title:'Find your schedule', body:'Open Time Clock & Schedule to see your full schedule, shift trades, and request-off tools.' },
    { title:'Help Center', body:'Open Help Center any time for Employee Quick Start, app install steps, clock help, and password help.' }
  ];
  const managerTourSteps = [
    { title:'Workspace Setup', body:'This quick tour gets a new restaurant ready for staff, scheduling, clock rules, backups, and Help Center training.' },
    { title:'Save the app', body:'On PC, open the app in Chrome or Edge and choose Install App near the address bar. On phones, add it to the home screen.' },
    { title:'Add employees', body:'Go to Staff Roster. New employee logins now pop up with generated email and one-time temporary password.' },
    { title:'Set permissions', body:'Give each person only the tabs they need. Financials and Schedule Builder stay protected by role and permission.' },
    { title:'Clock rules', body:'Set the work-area geofence in Settings. Outside-area clock-outs still save, but managers get alerted and the timesheet is marked.' },
    { title:'Backups and help', body:'Backup Center lives under System Administrator → Forensics. Help Center has Quick Start Guides and restart buttons.' }
  ];
  const activeTourSteps = tourMode === 'manager' ? managerTourSteps : employeeTourSteps;
  const getTourSessionKey = (mode = tourMode) => `tourSeenThisSession_${liveAppUser?.id || 'guest'}_${mode || 'tour'}_${CURRENT_VERSION}`;
  const getTourCompleteKey = (mode = tourMode) => mode === 'manager' ? `managerTourComplete_${rId || 'workspace'}` : `employeeTourComplete_${liveAppUser?.id || 'employee'}`;
  const dismissTourForNow = () => {
    const mode = tourMode;
    if (liveAppUser?.id) sessionStorage.setItem(getTourSessionKey(mode), 'true');
    setTourMode(null);
    setTourStep(0);
  };
  const finishTour = async () => {
    const mode = tourMode;
    setTourMode(null);
    setTourStep(0);
    if (!liveAppUser || isDemoMode) return;
    try {
      localStorage.setItem(getTourCompleteKey(mode), 'true');
      if (mode === 'manager' && rId) await updateDoc(doc(db, 'restaurants', rId), { workspaceOnboardingComplete: true, workspaceOnboardingCompletedAt: new Date().toISOString(), workspaceOnboardingSkipped: false });
      if (mode === 'employee' && liveAppUser?.id) await updateDoc(doc(db, 'users', liveAppUser.id), { onboardingComplete: true, onboardingCompletedAt: new Date().toISOString(), onboardingSkipped: false });
    } catch(e) { console.warn('Tour completion save failed', e); }
  };

  // Safety net: if System Admin disables a module while a user still has that tab open,
  // send them back to the main Time Clock/Schedule screen instead of showing a blank page.
  useEffect(() => {
    const gatedTabs = ['ops', 'events', 'messages', 'prep', 'recipes', 'inventory', 'sales', 'team', 'maintenance', 'schedule', 'labor'];
    if (gatedTabs.includes(activeTabState) && displayClientFeatures?.[activeTabState] === false) {
      setActiveTab('published');
    }
  }, [activeTabState, displayClientFeatures]);

  useEffect(() => {
    if (!liveAppUser || isDemoMode || tourMode) return;
    const managerCompleteLocal = rId ? localStorage.getItem(`managerTourComplete_${rId}`) === 'true' : false;
    const employeeCompleteLocal = liveAppUser?.id ? localStorage.getItem(`employeeTourComplete_${liveAppUser.id}`) === 'true' : false;
    if ((liveAppUser.isAdmin || liveAppUser.permissions?.team) && displayClientData && !displayClientData.workspaceOnboardingComplete && !managerCompleteLocal) {
      const key = `tourSeenThisSession_${liveAppUser.id}_manager_${CURRENT_VERSION}`;
      if (sessionStorage.getItem(key) === 'true') return;
      sessionStorage.setItem(key, 'true');
      setTourMode('manager');
      setTourStep(0);
    } else if (!liveAppUser.onboardingComplete && !employeeCompleteLocal) {
      const key = `tourSeenThisSession_${liveAppUser.id}_employee_${CURRENT_VERSION}`;
      if (sessionStorage.getItem(key) === 'true') return;
      sessionStorage.setItem(key, 'true');
      setTourMode('employee');
      setTourStep(0);
    }
  }, [liveAppUser?.id, liveAppUser?.onboardingComplete, liveAppUser?.isAdmin, displayClientData?.workspaceOnboardingComplete, rId, isDemoMode, tourMode]);

  useEffect(() => {
    const restart = (e) => { setTourMode(e.detail?.mode || (liveAppUser?.isAdmin ? 'manager' : 'employee')); setTourStep(0); };
    window.addEventListener('chaosRestartTour', restart);
    return () => window.removeEventListener('chaosRestartTour', restart);
  }, [liveAppUser?.isAdmin]);


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
      // Keep live presence sessions tied to the current user + workspace.
      // Reusing one generic session id after account switching can make Firestore reject
      // the heartbeat update because the old session belongs to a different user.
      const presenceSessionKey = `chaosSessionId_${rId}_${appUser.id}`;
      let sessionId = sessionStorage.getItem(presenceSessionKey);
      if (!sessionId) {
        sessionId = `${rId}_${appUser.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(presenceSessionKey, sessionId);
      }

      const collectDeviceDiagnostics = async () => {
        const diag = {
          notifications: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          geolocation: navigator.geolocation ? 'supported' : 'unsupported',
          gpsPermission: 'unknown',
          serviceWorker: 'serviceWorker' in navigator,
          indexedDb: 'indexedDB' in window,
          language: navigator.language || 'unknown',
          platform: navigator.platform || 'unknown',
          screen: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
        };
        try {
          if (navigator.permissions?.query && navigator.geolocation) {
            const gps = await navigator.permissions.query({ name: 'geolocation' });
            diag.gpsPermission = gps.state || 'unknown';
          }
        } catch (err) {
          diag.gpsPermission = 'unknown';
        }
        return diag;
      };

      const saveHeartbeatDebug = (next) => {
        const packed = { ...(next || {}), at: new Date().toISOString(), restaurantId: rId, userId: appUser.id };
        setHeartbeatDebug(packed);
        try { localStorage.setItem(`chaosHeartbeatDebug_${rId}_${appUser.id}`, JSON.stringify(packed)); } catch (err) {}
      };

      const sendHeartbeat = async (state = 'online') => {
        const stamp = new Date().toISOString();
        const firebaseUser = await waitForAuthCurrentUser(8000);
        if (!firebaseUser) {
          try { localStorage.removeItem(`chaosLastHeartbeat_${rId}_${appUser.id}`); } catch (err) {}
          saveHeartbeatDebug({ ok: false, channel: 'auth-wait', state, message: 'Firebase login session is not active yet on this device. Log out and back in if this keeps showing.', heartbeatEpochMs: Date.now() });
          return;
        }
        const authUid = firebaseUser.uid;
        if (appUser.id && appUser.id !== authUid) {
          try { localStorage.removeItem(`chaosLastHeartbeat_${rId}_${appUser.id}`); } catch (err) {}
          saveHeartbeatDebug({ ok: false, channel: 'auth-mismatch', state, message: `Cached app user does not match Firebase Auth user. Cached ${appUser.id}; Auth ${authUid}. Please log out and back in.`, heartbeatEpochMs: Date.now() });
          return;
        }
        const device = (navigator.userAgent || 'Unknown device').substring(0, 140);
        const deviceDiagnostics = await collectDeviceDiagnostics();
        const heartbeatEpochMs = Date.now();
        const presencePayload = {
          lastActive: stamp,
          lastSeen: stamp,
          lastHeartbeatAt: stamp,
          presenceUpdatedAt: stamp,
          heartbeatEpochMs,
          onlineState: state,
          activeTab: activeTabState,
          activeSessionId: sessionId,
          activeDevice: device,
          activeHost: window.location.hostname,
          notificationPermission: deviceDiagnostics.notifications,
          gpsPermission: deviceDiagnostics.gpsPermission,
          deviceDiagnostics
        };
        const safeSessionId = String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
        const createdAt = sessionStorage.getItem(`chaosPresenceCreatedAt_${sessionId}`) || stamp;
        sessionStorage.setItem(`chaosPresenceCreatedAt_${sessionId}`, createdAt);
        const livePresencePayload = {
          ...presencePayload,
          userId: authUid,
          uid: authUid,
          restaurantId: rId,
          userName: appUser.name || '',
          userEmail: appUser.email || '',
          email: appUser.email || '',
          role: appUser.role || '',
          photoURL: appUser.photoURL || '',
          createdAt,
          updatedAt: stamp,
          source: 'app-heartbeat'
        };
        const presenceSessionPayload = {
          ...livePresencePayload,
          sessionId: safeSessionId
        };

        // Local self-signal is written only after Firebase confirms the heartbeat.
        // This prevents a stale/cached login from falsely showing Online Now when Firestore rejected the save.
        const markVerifiedLocalHeartbeat = () => {
          try { localStorage.setItem(`chaosLastHeartbeat_${rId}_${appUser.id}`, String(heartbeatEpochMs)); } catch (err) {}
        };
        const clearVerifiedLocalHeartbeat = () => {
          try { localStorage.removeItem(`chaosLastHeartbeat_${rId}_${appUser.id}`); } catch (err) {}
        };

        let apiOk = false;
        let apiMessage = '';
        try {
          const response = await secureFetch('/api/presence-heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId: rId,
              state,
              activeTab: activeTabState,
              sessionId: safeSessionId,
              device,
              deviceDiagnostics,
              notificationPermission: deviceDiagnostics.notifications,
              gpsPermission: deviceDiagnostics.gpsPermission,
              heartbeatEpochMs,
              stamp
            })
          });
          const data = await response.json().catch(() => ({}));
          apiOk = response.ok && data?.ok !== false;
          apiMessage = data?.error || data?.message || `API ${response.status}`;
          if (apiOk) {
            markVerifiedLocalHeartbeat();
            saveHeartbeatDebug({ ok: true, channel: 'api', state, message: 'Heartbeat saved by server API.', heartbeatEpochMs, apiProjectId: data?.projectId || '' });
            return;
          }
        } catch (err) {
          apiMessage = err?.message || String(err);
        }

        // Fallback for local development or a missing Vercel function. livePresence is overwritten,
        // not merged, so old poisoned presence docs cannot keep blocking fresh writes.
        const results = await Promise.allSettled([
          setDoc(doc(db, 'livePresence', authUid), livePresencePayload),
          setDoc(doc(db, 'presenceSessions', safeSessionId), presenceSessionPayload),
          setDoc(doc(db, 'users', authUid), presencePayload, { merge: true }),
          updateDoc(doc(db, 'restaurants', rId), { lastActive: stamp, lastActiveUserId: authUid }).catch(()=>{})
        ]);
        const rejected = results.filter(r => r.status === 'rejected');
        const primarySaved = results[0]?.status === 'fulfilled' || results[2]?.status === 'fulfilled';
        if (rejected.length && !primarySaved) {
          clearVerifiedLocalHeartbeat();
          const errText = rejected.map(r => r.reason?.code || r.reason?.message || String(r.reason)).join(' | ');
          console.warn('86 Chaos heartbeat fallback blocked or delayed:', errText);
          saveHeartbeatDebug({ ok: false, channel: 'client-fallback', state, message: `${apiMessage || 'API heartbeat failed'}; fallback failed: ${errText}`, heartbeatEpochMs });
        } else if (rejected.length && primarySaved) {
          markVerifiedLocalHeartbeat();
          const errText = rejected.map(r => r.reason?.code || r.reason?.message || String(r.reason)).join(' | ');
          console.warn('86 Chaos heartbeat partially saved:', errText);
          saveHeartbeatDebug({ ok: true, channel: 'client-fallback-partial', state, message: `Live heartbeat saved; secondary write issue: ${errText}`, heartbeatEpochMs });
        } else {
          markVerifiedLocalHeartbeat();
          saveHeartbeatDebug({ ok: true, channel: 'client-fallback', state, message: `Saved by client fallback after API issue: ${apiMessage || 'unknown'}`, heartbeatEpochMs });
        }
      };

      sendHeartbeat(document.hidden ? 'away' : 'online');
      heartbeatTimer = setInterval(() => sendHeartbeat(document.hidden ? 'away' : 'online'), 25000);
      handleVisibility = () => sendHeartbeat(document.hidden ? 'away' : 'online');
      handleBeforeUnload = () => sendHeartbeat('offline');
      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleVisibility);
      window.addEventListener('online', handleVisibility);
      window.addEventListener('pagehide', handleBeforeUnload);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      unsub();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (handleVisibility) {
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleVisibility);
        window.removeEventListener('online', handleVisibility);
      }
      if (handleBeforeUnload) {
        window.removeEventListener('pagehide', handleBeforeUnload);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
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
    if (isDemoMode) {
      const allowedDemoTabs = ['today', 'help'];
      if (displayClientFeatures.schedule !== false) allowedDemoTabs.push('published');
      if (displayClientFeatures.schedule !== false && liveAppUser?.demoRole !== 'employee') allowedDemoTabs.push('schedule');
      if ((displayClientFeatures.sales !== false || displayClientFeatures.labor !== false) && liveAppUser?.demoRole !== 'employee') allowedDemoTabs.push('financials', 'sales', 'labor');
      ['events','ops','messages','prep','recipes','inventory','team','maintenance'].forEach(t => { if (displayClientFeatures[t] !== false && liveAppUser?.demoRole !== 'employee') allowedDemoTabs.push(t); });
      if (!allowedDemoTabs.includes(tab)) { addToast('Demo Mode', 'That tab is hidden for this demo.'); tab = 'published'; }
    }
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

  // Auto-return-to-landing was removed. Users stay on their current page when they come back.

  useEffect(() => {
    if (activeTabState === 'help' && hasHelpUpdate) {
      localStorage.setItem(`helpBriefSeen_${CURRENT_VERSION}`, 'true');
      setHasHelpUpdate(false);
    }
  }, [activeTabState, hasHelpUpdate]);
  

  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isKitchenTVOpen, setIsKitchenTVOpen] = useState(false);
  const [undoItem, setUndoItem] = useState(null);
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

// --- AUTO-ASK + TOKEN REPAIR FOR PUSH NOTIFICATIONS ---
  useEffect(() => {
    if (!liveAppUser?.id || ghostTenant || typeof window === 'undefined' || !('Notification' in window) || !messaging) return;

    let canceled = false;
    const activeVapidKey = window.location.hostname === 'app.86chaos.com'
      ? 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU'
      : 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc';

    const syncPushToken = async (permission, showToast = false) => {
      if (canceled || permission !== 'granted') {
        if (!canceled && liveAppUser?.id) {
          updateDoc(doc(db, 'users', liveAppUser.id), {
            notificationPermission: permission,
            pushTokenPermission: permission,
            lastPushTokenSyncAt: new Date().toISOString()
          }).catch(() => {});
        }
        return;
      }

      try {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => null);
        }
        const currentToken = await getToken(messaging, { vapidKey: activeVapidKey });
        if (!currentToken || canceled) return;
        await updateDoc(doc(db, 'users', liveAppUser.id), {
          fcmToken: currentToken,
          fcmTokenUpdatedAt: new Date().toISOString(),
          lastPushTokenSyncAt: new Date().toISOString(),
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushTokenHost: window.location.hostname
        });
        if (showToast) addToast('Push Ready', 'Push notifications are enabled for this device.');
      } catch (err) {
        console.warn('86 Chaos push token sync failed:', err?.message || err);
        updateDoc(doc(db, 'users', liveAppUser.id), {
          notificationPermission: permission,
          pushTokenPermission: permission,
          lastPushTokenSyncAt: new Date().toISOString()
        }).catch(() => {});
      }
    };

    const timer = setTimeout(async () => {
      if (Notification.permission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          await syncPushToken(permission, permission === 'granted');
        } catch (err) {
          console.warn('86 Chaos notification permission request failed:', err?.message || err);
        }
      } else {
        await syncPushToken(Notification.permission, false);
      }
    }, 2500);

    return () => { canceled = true; clearTimeout(timer); };
  }, [liveAppUser?.id, ghostTenant]);
                      
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

  if (!liveAppUser) return <LoginScreen users={displayUsers} setAppUser={setAppUser} addToast={addToast} />;


  const renderMainContent = () => {
    if (activeTabState === 'today') return <TabToday key={`tdy-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} sales={sales} timePunches={timePunches} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} prepItems={prepItems} tasks={tasks} recipes={recipes} clientData={displayClientData} setActiveTab={setActiveTab} addToast={addToast} registerUndo={registerUndo} />;
    if (activeTabState === 'schedule' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule)) return <TabMasterSchedule key={`schpub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} initialSubTab="schedule-builder" voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'events' && displayClientFeatures?.events !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.events || liveAppUser?.permissions?.schedule || liveAppUser?.permissions?.team)) return <TabSchedule key={`evt-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab="events" hideSubTabs />;
    if (activeTabState === 'published') return <TabMasterSchedule key={`pub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'ops' && displayClientFeatures?.ops !== false && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.ops)) return <TabOpsCenter key={`ops-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} events={events} sales={sales} timePunches={timePunches} addToast={addToast} setActiveTab={setActiveTab} />;
    if ((activeTabState === 'financials' || activeTabState === 'sales' || activeTabState === 'labor') && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.labor || liveAppUser?.permissions?.sales)) return <TabFinancials key={`fin-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} sales={sales} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} initialSubTab={activeTabState === 'sales' ? 'ledger' : activeTabState === 'labor' ? 'labor' : 'labor'} />;
    if (activeTabState === 'messages' && displayClientFeatures?.messages !== false) return <TabMessages key={`msg-${rId}`} events={events} appUser={liveAppUser} users={displayUsers} addToast={addToast} />;
    if (activeTabState === 'prep' && displayClientFeatures?.prep !== false) return <TabPrep key={`prp-${rId}`} currentDate={currentDate} appUser={liveAppUser} addToast={addToast} setLabelsToPrint={setLabelsToPrint} />;
    if (activeTabState === 'recipes' && displayClientFeatures?.recipes !== false) return <TabRecipes key={`rec-${rId}`} appUser={liveAppUser} addToast={addToast} voiceRecipeTarget={voiceRecipeTarget} />;
    if (activeTabState === 'inventory' && displayClientFeatures?.inventory !== false) return <TabInventory key={`inv-${rId}`} addToast={addToast} appUser={liveAppUser} />;
    if (activeTabState === 'team' && displayClientFeatures?.team !== false) return <TabTeam key={`tea-${rId}`} appUser={liveAppUser} users={displayUsers} clientData={displayClientData} addToast={addToast} heartbeatDebug={heartbeatDebug} />;
    if (activeTabState === 'maintenance' && displayClientFeatures?.maintenance !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.team)) return <TabMaintenance key={`mtn-${rId}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'settings' && !isDemoMode) return <TabSettings key={`set-${rId}`} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} users={displayUsers} />;
    if (activeTabState === 'help') return <TabHelpCenter key={`help-${rId}`} appUser={liveAppUser} activeTab={activeTabState} voiceHelpSearchTarget={voiceHelpSearchTarget} addToast={addToast} />;
    if (activeTabState === 'godmode' && ((liveAppUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase() || liveAppUser?.isSuperAdmin === true)) return <TabGodMode key={`god-${rId}`} appUser={liveAppUser} addToast={addToast} setGhostTenant={setGhostTenant} setActiveTab={setActiveTab} />;
    if (activeTabState === 'audit' && !isDemoMode && (liveAppUser?.isAdmin || liveAppUser?.isSuperAdmin)) return <TabAuditLog key={`aud-${rId}`} appUser={liveAppUser} />;

    return (
      <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4`}>
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#12161A] border border-[#2A353D] flex items-center justify-center text-[#D4A381]">
          <Menu size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">This page is not available</h2>
          <p className="text-sm font-bold text-slate-400 mt-2">The tab may be turned off for this workspace, your permissions may have changed, or an old app link opened a page that no longer exists.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => setActiveTab('today')} className={T.btn}>Go to Today</button>
          <button onClick={() => setIsMenuOpen(true)} className={T.btnAlt}>Open Menu</button>
        </div>
      </div>
    );
  };

  // MAINTENANCE LOCK SCREEN
  // Global lockdown should affect every workspace, including Cheers, but never lock out
  // the platform owner/super-admin account that needs to lift the lockdown.
  const maintenanceBypass = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    (liveAppUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()
  );
  const maintenanceEndsMs = clientData?.maintenanceEndsAt ? new Date(clientData.maintenanceEndsAt).getTime() : 0;
  const maintenanceExpired = maintenanceEndsMs && Number.isFinite(maintenanceEndsMs) && maintenanceEndsMs <= Date.now();
  const maintenanceAudience = clientData?.maintenanceAudience || 'everyone_except_super_admin';
  const maintenanceAppliesToUser = maintenanceAudience === 'employees_only'
    ? !liveAppUser?.isAdmin
    : maintenanceAudience === 'non_admins'
      ? !liveAppUser?.isAdmin
      : true;
  if (clientData?.billingStatus === 'Past Due' && !maintenanceExpired && maintenanceAppliesToUser && !ghostTenant && !maintenanceBypass) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${T.bg}`}>
        <div className="bg-[#1A2126] p-8 rounded-3xl border border-red-900/50 shadow-2xl max-w-md w-full">
          <span className="text-6xl mb-4 block">🛠️</span>
          <h1 className="text-2xl font-black text-white mb-2">Down for Maintenance</h1>
          <p className="text-slate-400 font-medium mb-6">{clientData.maintenanceMessage || `86 Chaos is temporarily down for maintenance for ${clientData.name || 'this workspace'}. Please check back shortly or contact your management team if service does not return soon.`}</p>
          {clientData.maintenanceEndsAt && <div className="mb-4 bg-[#12161A] border border-[#2A353D] rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Scheduled return: {new Date(clientData.maintenanceEndsAt).toLocaleString()}</div>}
          <button onClick={() => { localStorage.removeItem('86chaosUser'); setAppUser(null); }} className="w-full bg-red-900/20 text-red-500 font-black py-3 rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-all uppercase tracking-widest">Log Out</button>
        </div>
      </div>
    );
  }

  const appAccentColor = /^#[0-9A-Fa-f]{6}$/.test(displayClientData?.systemSettings?.accentColor || '') ? displayClientData.systemSettings.accentColor : '#D4A381';
  const appThemeStyle = { '--chaos-accent': appAccentColor };

return (
    <div style={appThemeStyle} onClickCapture={blockDemoMutation} onSubmitCapture={blockDemoMutation} className={`ui-v13-polished ui-v12-compact cockpit-shell ui-density-${liveAppUser?.preferences?.uiDensity || displayClientData?.systemSettings?.uiDensity || 'compact'} recipe-density-${liveAppUser?.preferences?.recipeDensity || displayClientData?.systemSettings?.recipeCardDensity || 'tight'} motion-${liveAppUser?.preferences?.motionMode || displayClientData?.systemSettings?.cockpitLights || 'normal'} min-h-screen font-sans flex flex-col w-full max-w-[100vw] overflow-x-hidden ${T.bg}`}>
      
      {/* GHOST / DEMO MODE BANNER */}
      {ghostTenant && (
        <div className={`${isDemoMode ? 'bg-gradient-to-r from-blue-900 to-cyan-900 border-cyan-500/50' : 'bg-gradient-to-r from-purple-900 to-fuchsia-900 border-fuchsia-500/50'} text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[99999] shadow-2xl uppercase tracking-wider border-b`}>
          <div className="flex items-center gap-2 min-w-0">
            <Moon size={16} className={`flex-shrink-0 animate-pulse ${isDemoMode ? 'text-cyan-300' : 'text-fuchsia-300'}`} />
            <span className="truncate">{isDemoMode ? `DEMO MODE: ${liveAppUser?.demoRole === 'employee' ? 'Regular Employee' : 'Manager'} view @ ${ghostTenant.name} • contact info hidden • read-only` : `GHOST MODE OVERRIDE: ${ghostTenant.impersonate ? `${ghostTenant.impersonate.name || ghostTenant.impersonate.email} @ ${ghostTenant.name}` : ghostTenant.name}`}</span>
          </div>
          <button onClick={() => { setGhostTenant(null); window.history.pushState({ tab: 'godmode' }, '', '?tab=godmode'); setActiveTabState('godmode'); }} className="bg-white text-slate-900 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest flex-shrink-0 ml-3">
            {isDemoMode ? 'EXIT DEMO' : 'EXIT GHOST MODE'}
          </button>
        </div>
      )}
      
      <style>{`
        html, body { overflow-x: hidden !important; max-width: 100vw !important; width: 100% !important; background-color: #0F1318 !important; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .cockpit-shell { --chaos-copper: var(--chaos-accent, #D4A381); --chaos-panel: #1A2126; --chaos-deck: #12161A; --chaos-accent-soft: color-mix(in srgb, var(--chaos-accent, #D4A381) 82%, white); --chaos-accent-strong: color-mix(in srgb, var(--chaos-accent, #D4A381) 78%, black); }
        .cockpit-shell [class*="text-[#D4A381]"], .cockpit-shell [class*="hover:text-[#D4A381]"]:hover { color: var(--chaos-accent, #D4A381) !important; }
        .cockpit-shell [class*="border-[#D4A381]"], .cockpit-shell [class*="focus:border-[#D4A381]"]:focus { border-color: var(--chaos-accent, #D4A381) !important; }
        .cockpit-shell [class*="bg-[#8F6040]"] { background-color: var(--chaos-accent-strong) !important; }
        .cockpit-shell [class*="accent-[#8F6040]"] { accent-color: var(--chaos-accent, #D4A381) !important; }
        .cockpit-shell [class*="from-[#C59373]"][class*="to-[#8F6040]"] { background-image: linear-gradient(to right, var(--chaos-accent-soft), var(--chaos-accent-strong)) !important; }
        .cockpit-shell .brand-logo-stack img { object-fit: contain; }
        .ui-v12-compact button { touch-action: manipulation; }
        .ui-v12-compact textarea { line-height: 1.35 !important; }
        .cockpit-light { position: relative; display: inline-flex; width: .55rem; height: .55rem; border-radius: 999px; box-shadow: 0 0 6px currentColor; }
        .cockpit-light::after { content: ''; position: absolute; inset: -4px; border-radius: 999px; background: currentColor; opacity: .08; animation: none; }
        .cockpit-light.quiet::after { animation: none !important; opacity: .08; }
        .cockpit-light.slow::after { animation: cockpitPing 5.5s infinite; opacity: .12; }
        .cockpit-light.hot::after { animation: cockpitPing 1.8s infinite; opacity: .24; }
        @keyframes cockpitPing { 0% { transform: scale(.75); opacity: .28; } 70%,100% { transform: scale(1.8); opacity: 0; } }
        @keyframes softGlow { 0%,100% { box-shadow: 0 0 0 rgba(212,163,129,0); } 50% { box-shadow: 0 0 18px rgba(212,163,129,.22); } }
        .cockpit-panel { background: linear-gradient(180deg, rgba(26,33,38,.98), rgba(15,19,24,.98)); border: 1px solid #2A353D; box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 16px 50px rgba(0,0,0,.18); }
        .cockpit-grid { background-image: radial-gradient(circle at 1px 1px, rgba(212,163,129,.09) 1px, transparent 0); background-size: 18px 18px; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .message-pro .message-card-pro { box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 8px 28px rgba(0,0,0,.12); }
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
          .ui-v12-compact button:not(.no-compact) { min-height: 32px !important; padding-top: .42rem !important; padding-bottom: .42rem !important; }
          .ui-v12-compact textarea { min-height: 42px !important; font-size: 14px !important; }
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

      <header className="sticky top-0 z-40 shadow-sm border-b h-16 flex items-center justify-between px-4 bg-[#12161A]/95 backdrop-blur-md border-[#2A353D]">
        <CheersLogo clientData={displayClientData} />

        {/* DYNAMIC RESTAURANT NAME */}
        {liveAppUser && (
          <div className="flex-1 text-center px-4 truncate mt-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-500">
              {liveAppUser.restaurantName || "Cheers"}
            </span>
          </div>
        )}

        <button onClick={() => setIsMenuOpen(true)} className={`relative p-2 border rounded-xl shadow-sm transition-all outline-none bg-[#1A2126] border-[#2A353D] ${T.copper} hover:text-white flex-shrink-0`}>
          <Menu size={20} />
          {hasAnyMenuAlert && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#12161A] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
        </button>
      </header>

      {/* SYSTEM BROADCAST BANNER */}
      {displayClientData?.systemBanner && (
        <div className="bg-blue-600 border-b border-blue-800 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-center shadow-lg uppercase tracking-wider w-full relative z-30 animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 text-center">
            <Bell size={14} className="animate-pulse flex-shrink-0" />
            <span>{displayClientData.systemBanner}</span>
          </div>
        </div>
      )}

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} hasMyShiftAlert={hasMyShiftAlert} hasScheduleBuilderAlert={hasScheduleBuilderAlert} hasHelpUpdate={hasHelpUpdate} clientFeatures={displayClientFeatures} addToast={addToast} />
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} queryText={globalSearchQuery} setQueryText={setGlobalSearchQuery} users={displayUsers} events={events} shifts={shifts} recipes={recipes} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} setActiveTab={setActiveTab} />
      <KitchenTVMode isOpen={isKitchenTVOpen} onClose={() => setIsKitchenTVOpen(false)} shifts={shifts} events={events} prepItems={prepItems} maintenanceLogs={maintenanceLogs} inventoryItems={inventoryItems} />
      <UndoBar undoItem={undoItem} clearUndo={() => setUndoItem(null)} />
      <VoiceCommandDock appUser={liveAppUser} inventoryItems={inventoryItems} recipes={recipes} users={displayUsers} clientFeatures={displayClientFeatures} setActiveTab={setActiveTab} setCurrentDate={setCurrentDate} setScheduleSubTabTarget={setVoiceScheduleSubTabTarget} setHelpSearchTarget={setVoiceHelpSearchTarget} setRecipeTarget={setVoiceRecipeTarget} addToast={addToast} />

      {ghostTenant?.impersonate && (
        <div className="bg-fuchsia-950/60 border-b border-fuchsia-500/30 px-4 py-2 text-[10px] sm:text-xs text-fuchsia-100 font-bold flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Viewing user: <strong>{ghostTenant.impersonate.name || 'Unnamed'}</strong></span>
          <span>Email: <strong>{ghostTenant.impersonate.email || 'No email'}</strong></span>
          <span>Role: <strong>{ghostTenant.impersonate.role || 'No role'}</strong></span>
          <span>User ID: <strong className="font-mono">{ghostTenant.impersonate.id}</strong></span>
        </div>
      )}
      
      {['schedule', 'events', 'published', 'month', 'financials', 'sales', 'prep'].includes(activeTabState) && (
        <div className="py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center bg-[#1A2126] border-[#2A353D] relative">
          {(activeTabState === 'sales' || activeTabState === 'financials') ? (
            <div className="w-full text-center">
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">Financials</h2>
            </div>
          ) : (
            <>
              <button onClick={activeTabState === 'prep' ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronLeft size={20} /></button>
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381] pointer-events-auto">
                  {activeTabState === 'prep' ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
                </h2>
              </div>

              <button onClick={activeTabState === 'prep' ? nextDay : nextMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronRight size={20} /></button>
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

      <Modal isOpen={!!tourMode} onClose={dismissTourForNow} title={tourMode === 'manager' ? 'Manager Quick Start' : 'Employee Quick Start'}>
        {tourMode && <div className="space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Step {tourStep + 1} of {activeTourSteps.length}</div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-4">
            <h3 className="text-xl font-black text-white">{activeTourSteps[tourStep]?.title}</h3>
            <p className="text-sm text-slate-300 font-bold mt-2 leading-relaxed">{activeTourSteps[tourStep]?.body}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setTourStep(Math.max(0, tourStep - 1))} className={T.btnAlt} disabled={tourStep === 0}>Back</button>
            {tourStep < activeTourSteps.length - 1 ? <button type="button" onClick={() => setTourStep(tourStep + 1)} className={`${T.btn} flex-1`}>Next</button> : <button type="button" onClick={finishTour} className={`${T.btn} flex-1`}>Finish</button>}
          </div>
          <button type="button" onClick={dismissTourForNow} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Skip for now</button>
        </div>}
      </Modal>

      <main className="flex-1 max-w-6xl mx-auto w-full p-3 sm:p-6 pb-24">
        {renderMainContent()}
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
        <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Version {CURRENT_VERSION}</span>
        <span className="text-slate-600 font-bold text-[8px] tracking-widest uppercase mt-1">© 2026 Chilton App Works LLC</span>
      </div>
    </div>
  );
}
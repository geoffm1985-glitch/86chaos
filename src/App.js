import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertTriangle, Bell, Bug, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Home, Loader2, Menu, Moon, MoreHorizontal, Send, X } from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import 'leaflet/dist/leaflet.css';
import { T, db, auth, messaging, firebaseConfig, CURRENT_VERSION, MASTER_ADMIN_EMAIL, useLiveCollection, secureFetch, waitForAuthCurrentUser, getToday, getMonthStr, formatDate, formatDisplayFullDate, formatDisplayMonth, logAudit, setActiveTimeFormat, getOfflineQueue, replayOfflineQueue } from './core/appCore';
import { buildAlertFingerprint, useRememberedAlert } from './core/alertMemory';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, GlobalSearchModal, KitchenTVMode, UndoBar, VoiceCommandDock } from './components/common';
import { LockedFeatureScreen } from './components/PlanGate';
import { usePlanAccess } from './hooks/usePlanAccess';
import { resolveFeatureAccess } from './lib/featureAccess';
import { FEATURE_KEYS } from './config/plans';
import { LoginScreen } from './features/auth';

const lazyFeature = (loader, exportName) => React.lazy(() => loader().then(module => ({ default: module[exportName] })));
const TabMasterSchedule = lazyFeature(() => import('./features/schedule'), 'TabMasterSchedule');
const TabSchedule = lazyFeature(() => import('./features/schedule'), 'TabSchedule');
const TabOpsCenter = lazyFeature(() => import('./features/operations'), 'TabOpsCenter');
const TabToday = lazyFeature(() => import('./features/operations'), 'TabToday');
const TabPrep = lazyFeature(() => import('./features/operations'), 'TabPrep');
const TabRecipes = lazyFeature(() => import('./features/operations'), 'TabRecipes');
const TabMaintenance = lazyFeature(() => import('./features/operations'), 'TabMaintenance');
const TabInventory = lazyFeature(() => import('./features/inventory'), 'TabInventory');
const TabFinancials = lazyFeature(() => import('./features/management'), 'TabFinancials');
const TabBackOffice = lazyFeature(() => import('./features/management'), 'TabBackOffice');
const TabMessages = lazyFeature(() => import('./features/management'), 'TabMessages');
const TabTeam = lazyFeature(() => import('./features/management'), 'TabTeam');
const TabSettings = lazyFeature(() => import('./features/management'), 'TabSettings');
const TabHelpCenter = lazyFeature(() => import('./features/management'), 'TabHelpCenter');
const TabGodMode = lazyFeature(() => import('./features/management'), 'TabGodMode');
const TabAuditLog = lazyFeature(() => import('./features/management'), 'TabAuditLog');
const TabPersonalReminders = lazyFeature(() => import('./features/intelligence'), 'TabPersonalReminders');
const TabMenuIntelligence = lazyFeature(() => import('./features/intelligence'), 'TabMenuIntelligence');
const TabAITools = lazyFeature(() => import('./features/intelligence'), 'TabAITools');
const TabHrTraining = lazyFeature(() => import('./features/hr'), 'TabHrTraining');

const RouteLoading = ({ label = 'Loading section...' }) => (
  <div className="native-route-loader max-w-3xl mx-auto rounded-2xl border border-[#2A353D] bg-[#11181E]/92 p-4 sm:p-5 shadow-2xl">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-2xl bg-[#D4A381]/10 border border-[#D4A381]/30 flex items-center justify-center text-[#D4A381]">
        <Loader2 className="animate-spin" size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4A381]">86 Chaos</div>
        <p className="text-sm font-bold text-slate-300">{label}</p>
      </div>
    </div>
    <div className="mt-4 grid gap-2">
      <div className="h-3 rounded-full bg-slate-700/40 overflow-hidden"><span className="native-loader-bar block h-full w-1/2 rounded-full bg-[#D4A381]/40" /></div>
      <div className="h-3 w-3/4 rounded-full bg-slate-700/30" />
      <div className="h-3 w-1/2 rounded-full bg-slate-700/20" />
    </div>
  </div>
);

const normalizeEmail = (value) => String(value || '').toLowerCase().trim();
const safeWorkspaceName = (workspace = {}) => workspace.restaurantName || workspace.name || workspace.businessName || workspace.restaurantId || '86 Chaos Workspace';

const LEGACY_TAB_ALIASES = {
  'manager-brief': 'today',
  'today-home': 'today',
  'kitchen-command': 'ops',
  'command-center': 'ops',
  'time-clock': 'published',
  'timeclock': 'published',
  'my-schedule': 'published',
  'staff-roster': 'team',
  'roster': 'team',
  'message-board': 'messages',
  'help-center': 'help',
  'admin-manual': 'help',
  'backoffice': 'back-office',
  'owner-office': 'back-office',
  'office': 'back-office',
  'back-office-suite': 'back-office'
};
const normalizeRouteTab = (tab = 'today') => LEGACY_TAB_ALIASES[String(tab || '').trim()] || String(tab || 'today').trim() || 'today';
const buildSafeSessionCache = (user = {}) => user ? {
  id: user.id || user.userId || '',
  userId: user.userId || user.id || '',
  name: user.name || 'Staff',
  photoURL: user.photoURL || '',
  restaurantId: user.restaurantId || '',
  activeRestaurantId: user.activeRestaurantId || user.restaurantId || '',
  defaultRestaurantId: user.defaultRestaurantId || user.restaurantId || '',
  restaurantName: user.restaurantName || '',
  membershipId: user.membershipId || '',
  workspaceSwitcherReady: user.workspaceSwitcherReady === true,
  sessionCached: true
} : null;
const parseCachedSessionUser = (raw = '') => {
  try { return buildSafeSessionCache(JSON.parse(raw)); }
  catch (_) { return null; }
};
const hasOwn = (value, key) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
const resolveWorkspaceAccess = (currentUser = {}, workspace = {}) => {
  const restaurantId = workspace.restaurantId || currentUser.restaurantId || '';
  const mappedMembership = currentUser?.memberships?.[restaurantId];
  const hasScopedMembership = Boolean(
    mappedMembership ||
    workspace.membershipSource ||
    workspace.workspaceMemberId ||
    ['permissions', 'isAdmin', 'isOwner', 'accountOwner', 'workspaceOwner'].some(key => hasOwn(workspace, key))
  );
  const scoped = mappedMembership ? { ...mappedMembership, ...workspace, permissions: { ...(mappedMembership.permissions || {}), ...(workspace.permissions || {}) } } : workspace;
  const primaryIds = new Set([
    currentUser.restaurantId,
    currentUser.defaultRestaurantId,
    currentUser?.accountProfile?.defaultRestaurantId
  ].filter(Boolean));
  const mayUseLegacyProfile = !hasScopedMembership && (!restaurantId || primaryIds.has(restaurantId));
  return {
    restaurantId,
    hasScopedMembership,
    permissions: hasScopedMembership ? { ...(scoped.permissions || {}) } : (mayUseLegacyProfile ? { ...(currentUser.permissions || {}) } : {}),
    isAdmin: hasScopedMembership ? scoped.isAdmin === true : Boolean(mayUseLegacyProfile && currentUser.isAdmin === true),
    isOwner: hasScopedMembership
      ? Boolean(scoped.isOwner === true || scoped.accountOwner === true || scoped.workspaceOwner === true)
      : Boolean(mayUseLegacyProfile && (currentUser.isOwner === true || currentUser.accountOwner === true || currentUser.owner === true || currentUser.workspaceOwner === true || String(currentUser.accountRole || '').toLowerCase() === 'owner')),
    accountOwner: hasScopedMembership ? scoped.accountOwner === true : Boolean(mayUseLegacyProfile && currentUser.accountOwner === true),
    workspaceOwner: hasScopedMembership ? scoped.workspaceOwner === true : Boolean(mayUseLegacyProfile && currentUser.workspaceOwner === true),
    accountRole: hasScopedMembership ? String(scoped.accountRole || '') : (mayUseLegacyProfile ? String(currentUser.accountRole || '') : '')
  };
};
const buildWorkspaceUser = (currentUser = {}, workspace = {}) => {
  const accountProfile = currentUser.accountProfile || {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
    photoURL: currentUser.photoURL,
    isSuperAdmin: currentUser.isSuperAdmin,
    systemAccess: currentUser.systemAccess,
    defaultRestaurantId: currentUser.defaultRestaurantId || currentUser.restaurantId,
    workspaceIds: currentUser.workspaceIds || [],
    memberships: currentUser.memberships || {}
  };
  const userId = currentUser.id || workspace.userId || workspace.uid || accountProfile.id;
  const scopedAccess = resolveWorkspaceAccess(currentUser, workspace);
  return {
    ...currentUser,
    id: userId,
    userId,
    accountProfile: { ...accountProfile, id: userId },
    restaurantId: workspace.restaurantId || currentUser.restaurantId,
    restaurantName: safeWorkspaceName(workspace),
    membershipId: workspace.membershipId || workspace.id || currentUser.membershipId || '',
    name: workspace.name || currentUser.name || accountProfile.name || 'Staff',
    email: normalizeEmail(workspace.email || currentUser.email || accountProfile.email),
    phone: workspace.phone || currentUser.phone || accountProfile.phone || '',
    role: workspace.role || currentUser.role || 'Staff',
    wage: workspace.wage ?? currentUser.wage ?? 0,
    photoURL: workspace.photoURL || currentUser.photoURL || accountProfile.photoURL || '',
    isAdmin: currentUser.isSuperAdmin === true || scopedAccess.isAdmin,
    isOwner: scopedAccess.isOwner,
    owner: scopedAccess.isOwner,
    accountOwner: scopedAccess.accountOwner,
    workspaceOwner: scopedAccess.workspaceOwner,
    accountRole: scopedAccess.accountRole,
    permissions: scopedAccess.permissions,
    activeRestaurantId: workspace.restaurantId || currentUser.activeRestaurantId || currentUser.restaurantId,
    defaultRestaurantId: currentUser.defaultRestaurantId || workspace.restaurantId || currentUser.restaurantId,
    availableWorkspaces: currentUser.availableWorkspaces || [],
    workspaceSwitcherReady: true
  };
};
const userFromWorkspaceMember = (member = {}, accountUser = {}) => {
  const memberOwner = Boolean(member.isOwner === true || member.accountOwner === true || member.workspaceOwner === true);
  return {
    ...accountUser,
    ...Object.fromEntries(Object.entries(member).filter(([key]) => key !== 'id')),
    id: member.userId || member.uid || accountUser.id || member.id,
    userId: member.userId || member.uid || accountUser.id || member.id,
    membershipId: member.membershipId || member.id || '',
    restaurantId: member.restaurantId || accountUser.restaurantId,
    restaurantName: safeWorkspaceName(member),
    permissions: { ...(member.permissions || {}) },
    isAdmin: member.isAdmin === true || accountUser.isSuperAdmin === true,
    isOwner: memberOwner,
    owner: memberOwner,
    accountOwner: member.accountOwner === true,
    workspaceOwner: member.workspaceOwner === true,
    accountRole: memberOwner ? 'owner' : String(member.accountRole || ''),
    isActive: member.isActive !== false && accountUser.isActive !== false
  };
};

export default function App() {
  const [appUser, setAppUser] = useState(() => { 
    try {
      const savedLocal = localStorage.getItem('86chaosUser'); 
      const savedSession = sessionStorage.getItem('86chaosUser');
      return savedLocal ? parseCachedSessionUser(savedLocal) : (savedSession ? parseCachedSessionUser(savedSession) : null);
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
  const [activeTabState, setActiveTabState] = useState(() => normalizeRouteTab(appUser?.preferences?.defaultTab || 'today'));
  const [clientData, setClientData] = useState(null);
  const [heartbeatDebug, setHeartbeatDebug] = useState(null);
  const clientFeatures = clientData?.features || {};
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [voiceScheduleSubTabTarget, setVoiceScheduleSubTabTarget] = useState(null);
  const [voiceHelpSearchTarget, setVoiceHelpSearchTarget] = useState(null);
  const [voiceRecipeTarget, setVoiceRecipeTarget] = useState(null);
  const [inventorySubTabTarget, setInventorySubTabTarget] = useState(null);
  const [isWorkspaceSwitcherOpen, setIsWorkspaceSwitcherOpen] = useState(false);
  const [workspaceMembershipRefreshKey] = useState(0);
  const [isPushRepairing, setIsPushRepairing] = useState(false);
  const [pushRepairDismissed, setPushRepairDismissed] = useState(false);
  const [serverAdminCheck, setServerAdminCheck] = useState(null);
  
  // --- VERSION CHECKER STATE & LOGIC ---
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [availableVersion, setAvailableVersion] = useState('');
  const [hasHelpUpdate, setHasHelpUpdate] = useState(false);
  const [tourMode, setTourMode] = useState(null);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.version !== CURRENT_VERSION) {
            setAvailableVersion(data.version || 'new-version');
            setShowUpdateBanner(true);
          } else {
            setAvailableVersion('');
            setShowUpdateBanner(false);
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


  useEffect(() => {
    if (!appUser?.id || appUser.id === 'dev-backdoor') {
      setServerAdminCheck(null);
      return;
    }
    let canceled = false;
    const checkServerAdminAccess = async () => {
      try {
        const res = await secureFetch('/api/whoami');
        const data = await res.json().catch(() => ({}));
        if (canceled) return;
        setServerAdminCheck({ ok: res.ok, ...data });
        if (res.ok && data.superAdmin === true) {
          setAppUser(prev => {
            if (!prev?.id || prev.id !== appUser.id || prev.isSuperAdmin === true) return prev;
            const next = {
              ...prev,
              isSuperAdmin: true,
              systemAccess: { ...(prev.systemAccess || {}), superAdmin: true },
              superAdminAccessSource: data.serverMasterAdminMatched ? 'server-master-admin-env' : data.customClaimSuperAdmin ? 'firebase-custom-claim' : data.firestoreSuperAdmin ? 'firestore-profile-flag' : 'api-whoami'
            };
            try {
              const storage = localStorage.getItem('86chaosUser') ? localStorage : sessionStorage;
              storage.setItem('86chaosUser', JSON.stringify(buildSafeSessionCache(next)));
            } catch (_) {}
            return next;
          });
        }
      } catch (err) {
        if (!canceled) setServerAdminCheck({ ok: false, error: err?.message || 'Could not check server admin config.' });
      }
    };
    checkServerAdminAccess();
    return () => { canceled = true; };
  }, [appUser?.id, appUser?.email]);

const [currentDate, setCurrentDate] = useState(getToday());
  const [activeScheduleSubTab, setActiveScheduleSubTab] = useState('my-schedule');

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
  const scheduleWindowStart = addDays(monthBounds.start, -14);
  const scheduleWindowEnd = addDays(monthBounds.end, 60);
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
  const subscriptionProbeUser = { ...(appUser || {}), isSuperAdmin: appUser?.isSuperAdmin === true || serverAdminCheck?.superAdmin === true };
  const featureAccessForShell = (featureKey) => {
    if (!featureKey) return null;
    return resolveFeatureAccess({ workspace: clientData || {}, user: subscriptionProbeUser, featureKey });
  };
  const planAllowsFeature = (featureKey) => {
    const access = featureAccessForShell(featureKey);
    return Boolean(access?.master || access?.planAllowed || access?.manualEnabled);
  };
  const roleAndPlanAllowFeature = (featureKey) => Boolean(featureAccessForShell(featureKey)?.allowed);
  const canReadScheduleView = roleAndPlanAllowFeature(FEATURE_KEYS.BASIC_SCHEDULE_VIEW);
  const canReadScheduleBuilder = roleAndPlanAllowFeature(FEATURE_KEYS.SCHEDULE_BUILDER);
  const canReadOperationsLabor = [FEATURE_KEYS.TIMESHEETS, FEATURE_KEYS.LABOR_COMMAND, FEATURE_KEYS.TIP_CENTER, FEATURE_KEYS.PAYROLL_READINESS].some(roleAndPlanAllowFeature);
  const canReadSalesCollections = [FEATURE_KEYS.DAILY_CLOSE, FEATURE_KEYS.SALES_BREAKDOWN, FEATURE_KEYS.FINANCIAL_OVERVIEW, FEATURE_KEYS.PRIME_COST].some(roleAndPlanAllowFeature);
  const canReadBasicInventory = [FEATURE_KEYS.BASIC_INVENTORY, FEATURE_KEYS.BURN_LOG].some(roleAndPlanAllowFeature);
  const canReadSmartInventory = [FEATURE_KEYS.COGS_CENTER, FEATURE_KEYS.INVOICE_TOTALS, FEATURE_KEYS.VENDOR_SPEND, FEATURE_KEYS.INVOICE_SCANNING].some(roleAndPlanAllowFeature);
  const canReadMenuCollections = [FEATURE_KEYS.MENU_INTELLIGENCE, FEATURE_KEYS.DEPENDENCY_TOOLS, FEATURE_KEYS.SMART_86_ALERTS].some(roleAndPlanAllowFeature);
  const canReadMaintenance = roleAndPlanAllowFeature(FEATURE_KEYS.CLEANING_ROUTINES);
  const wantsScheduleData = (wantsToday && canReadScheduleView) || (wantsScheduleScreen && (canReadScheduleView || canReadScheduleBuilder)) || (['labor', 'ops'].includes(activeTabState) && (canReadScheduleView || canReadOperationsLabor));
  const wantsLaborData = (['financials', 'labor', 'sales', 'ops'].includes(activeTabState) || (wantsToday && canReadOperationsLabor)) && canReadOperationsLabor;
  const wantsInventoryData = (((wantsToday || activeTabState === 'ops' || isGlobalSearchOpen) && (canReadBasicInventory || canReadSmartInventory)) || (activeTabState === 'menu-intelligence' && canReadMenuCollections));
  const wantsPrepData = wantsToday || ['prep', 'ops'].includes(activeTabState);
  const wantsMenuData = (activeTabState === 'menu-intelligence' || wantsToday) && canReadMenuCollections;
  const wantsRecipesData = activeTabState === 'recipes' || activeTabState === 'today' || activeTabState === 'ops' || isGlobalSearchOpen; // Load recipe data only where it is displayed, searched, or used by active dashboards.
  const wantsMaintenanceData = (wantsToday || ['maintenance', 'ops'].includes(activeTabState)) && canReadMaintenance;
  const wantsSalesData = ['financials', 'sales', 'ops', 'labor'].includes(activeTabState) && canReadSalesCollections;
  const shiftRangeStart = wantsScheduleScreen ? scheduleWindowStart : getToday();
  const shiftRangeEnd = wantsScheduleScreen ? scheduleWindowEnd : todayOpsWindowEnd;
  const messageRangeStart = activeTabState === 'messages' ? addDays(getToday(), -60) : recentWindowStart;
  const prepDateWindow = Array.from(new Set([currentDate, getToday(), 'MASTER']));
  const canViewTeamScheduleData = Boolean(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.workspaceOwner || appUser?.permissions?.schedule || appUser?.permissions?.team);
  const timeOffRequestClauses = canViewTeamScheduleData ? [] : [['userId', '==', appUser?.id || '']];

  const users = useLiveCollection('users', rId, { enabled: !!rId, limitCount: activeTabState === 'godmode' ? 400 : 160, fallbackLimitCount: 60 });
  const workspaceMembers = useLiveCollection('workspaceMembers', rId, { enabled: !!rId, limitCount: activeTabState === 'team' ? 400 : 180, fallbackLimitCount: 80 });
  // Presence is intentionally not subscribed here. System Administrator now uses
  // a Super Admin-only manual snapshot button so regular app sessions do not create
  // constant livePresence reads.
  const presenceSessions = [];
  const livePresenceRecords = [];
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
  const events = useLiveCollection('events', rId, { enabled: !!rId && (wantsToday || activeTabState === 'messages' || activeTabState === 'events' || activeTabState === 'ops' || isGlobalSearchOpen), whereClauses: [['date','>=', messageRangeStart]], orderByField: 'date', orderDirection: 'desc', limitCount: activeTabState === 'messages' ? 90 : 35, fallbackLimitCount: 25 });
  const sales = useLiveCollection('sales', rId, { enabled: !!rId && wantsSalesData, whereClauses: [['date','>=', monthBounds.start], ['date','<=', monthBounds.end]], orderByField: 'date', orderDirection: 'desc', limitCount: 45, fallbackLimitCount: 20 });
  const timeOffRequests = useLiveCollection('timeOffRequests', rId, { enabled: !!rId && wantsScheduleData, whereClauses: timeOffRequestClauses, limitCount: wantsScheduleScreen ? 70 : 30, fallbackLimitCount: 25 });
  const timePunches = useLiveCollection('timePunches', rId, { enabled: !!rId && wantsLaborData, whereClauses: [['date','>=', activeTabState === 'labor' ? laborPunchWindowStart : lightPunchWindowStart], ['date','<=', activeTabState === 'labor' ? laborPunchWindowEnd : lightPunchWindowEnd]], orderByField: 'date', orderDirection: 'desc', limitCount: activeTabState === 'labor' ? 180 : 35, fallbackLimitCount: 30 });
  const inventoryItems = useLiveCollection('inventoryItems', rId, { enabled: !!rId && wantsInventoryData, limitCount: activeTabState === 'inventory' ? 240 : 75, fallbackLimitCount: 55 });
  const menuDependencies = useLiveCollection('menuDependencies', rId, { enabled: !!rId && wantsMenuData, limitCount: activeTabState === 'menu-intelligence' ? 500 : 120, fallbackLimitCount: 80 });
  const maintenanceLogs = useLiveCollection('maintenanceLogs', rId, { enabled: !!rId && wantsMaintenanceData, limitCount: activeTabState === 'maintenance' ? 110 : 30, fallbackLimitCount: 25 });
  const prepItems = useLiveCollection('prepItems', rId, { enabled: !!rId && wantsPrepData, whereClauses: [['date','in', prepDateWindow]], limitCount: 80, fallbackLimitCount: 35 });
  const tasks = useLiveCollection('tasks', rId, { enabled: !!rId && wantsPrepData, limitCount: 75, fallbackLimitCount: 35 });
  const recipes = useLiveCollection('recipes', rId, { enabled: !!rId && wantsRecipesData, limitCount: 500, fallbackLimitCount: 120 });
  
// --- LIVE APP USER LOGIC ---
  const fullGhostPermissions = { schedule: true, events: true, ops: true, inventory: true, prep: true, sales: true, team: true, labor: true, help: true };
  const workspaceMemberForAppUser = useMemo(() => {
    if (!appUser?.id && !appUser?.email) return null;
    const emailKey = normalizeEmail(appUser?.email);
    return (workspaceMembers || []).find(m =>
      (m.userId && m.userId === appUser.id) ||
      (m.uid && m.uid === appUser.id) ||
      (emailKey && normalizeEmail(m.email) === emailKey)
    ) || null;
  }, [workspaceMembers, appUser?.id, appUser?.email]);
  const accountUserFromTenantList = appUser ? (users?.find(u => u.id === appUser.id) || null) : null;
  const realAppUser = appUser ? (
    appUser.id === 'dev-backdoor'
      ? appUser
      : (workspaceMemberForAppUser ? userFromWorkspaceMember(workspaceMemberForAppUser, accountUserFromTenantList || appUser) : (accountUserFromTenantList || appUser))
  ) : null;
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
         planId: ghostTenant.demoMode.plan || 'smart_kitchen',
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
         isSuperAdmin: realAppUser.isSuperAdmin || (MASTER_ADMIN_EMAIL && realAppUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()),
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


  const isDemoMode = !!liveAppUser?.isDemo;
  const serverSaysSuperAdmin = Boolean(serverAdminCheck?.superAdmin === true);
  if (!isDemoMode && liveAppUser && serverSaysSuperAdmin && liveAppUser.isSuperAdmin !== true) {
    liveAppUser = {
      ...liveAppUser,
      isSuperAdmin: true,
      systemAccess: { ...(liveAppUser.systemAccess || {}), superAdmin: true },
      superAdminAccessSource: serverAdminCheck.serverMasterAdminMatched ? 'server-master-admin-env' : serverAdminCheck.customClaimSuperAdmin ? 'firebase-custom-claim' : serverAdminCheck.firestoreSuperAdmin ? 'firestore-profile-flag' : 'api-whoami'
    };
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
       systemSettings: { tips: true, ...(clientData.systemSettings || {}) },
       planId: clientData?.subscription?.planId || clientData?.planId || 'smart_kitchen',
       restaurantName: liveAppUser.restaurantName || clientData.name || clientData.businessName || clientData.restaurantName || '86 Chaos'
     };
  }
  setActiveTimeFormat(liveAppUser?.preferences?.timeFormat || '12h');
  const canSeeRestaurantAdminAlerts = Boolean(liveAppUser && !liveAppUser.isDemo && (
    liveAppUser.isSuperAdmin || liveAppUser.isOwner || liveAppUser.owner || liveAppUser.accountOwner ||
    liveAppUser.workspaceOwner || liveAppUser.isAdmin || liveAppUser.permissions?.settings || liveAppUser.permissions?.team
  ));
  const restaurantAdminAlerts = useLiveCollection('restaurantAdminAlerts', rId, { enabled: !!rId && canSeeRestaurantAdminAlerts && (activeTabState === 'today' || activeTabState === 'godmode' || activeTabState === 'back-office'), limitCount: 30, fallbackLimitCount: 10 });

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
  const sessionIsOwner = Boolean(liveAppUser?.isSuperAdmin || serverSaysSuperAdmin || (MASTER_ADMIN_EMAIL && sessionEmail === MASTER_ADMIN_EMAIL.toLowerCase()) || liveAppUser?.isOwner || liveAppUser?.accountOwner || (sessionOwnerEmail && sessionEmail === sessionOwnerEmail));
  const sessionCanViewWages = Boolean(sessionIsOwner || liveAppUser?.permissions?.wageView || liveAppUser?.permissions?.wageEdit || wageViewAccess.includes(liveAppUser?.id) || wageEditAccess.includes(liveAppUser?.id));

  const displayUsers = useMemo(() => {
    const accountById = new Map((users || []).map(u => [u.id, u]));
    const memberUsers = (workspaceMembers || [])
      .filter(m => m.isActive !== false)
      .map(m => userFromWorkspaceMember(m, accountById.get(m.userId || m.uid) || {}));
    const memberIds = new Set(memberUsers.map(u => u.id).filter(Boolean));
    const legacyUsers = (users || []).filter(u => !memberIds.has(u.id) && u.isActive !== false);
    const combinedUsers = memberUsers.length ? [...memberUsers, ...legacyUsers] : (users || []);
    const baseUsers = isDemoMode ? combinedUsers.map(maskDemoUser) : combinedUsers;
    // Roster/user lists no longer merge online presence. Online status is hidden from
    // regular staff and managers; System Administrator can run a manual presence snapshot.
    let merged = baseUsers;
    if (!isDemoMode && !sessionCanViewWages) {
      merged = merged.map(u => ({ ...u, wage: 0, wageHidden: true }));
    }
    return merged;
  }, [isDemoMode, users, workspaceMembers, sessionCanViewWages]);
  if (isDemoMode && liveAppUser?.demoRole === 'employee' && displayUsers?.[0]) {
    liveAppUser = { ...liveAppUser, id: displayUsers[0].id, name: 'Demo Employee', role: displayUsers[0].role || 'Demo Employee', isAdmin: false, isSuperAdmin: false, permissions: { help: true } };
  }
  const displayClientData = isDemoMode && clientData ? { ...clientData, ownerEmail: 'Hidden for demo', ownerPhone: 'Hidden for demo', address: 'Hidden for demo', businessAddress: 'Hidden for demo', systemSettings: { tips: true, ...(clientData.systemSettings || {}), address: 'Hidden for demo', geofenceAddress: 'Hidden for demo' } } : clientData;
  const planAccess = usePlanAccess(liveAppUser, displayClientData);
  const mfaEnvValue = String(process.env.REACT_APP_MFA_ENFORCE_ELEVATED_ROLES || '').toLowerCase().trim();
  const mfaFrontendEnforced = ['true', '1', 'yes', 'enforce'].includes(mfaEnvValue) || displayClientData?.systemSettings?.mfaEnforceElevatedRoles === true || displayClientData?.securityCenter?.mfaEnforceElevatedRoles === true;
  const elevatedRoleText = `${liveAppUser?.role || ''} ${liveAppUser?.accountRole || ''} ${liveAppUser?.title || ''}`.toLowerCase();
  const userNeedsMfa = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    liveAppUser?.isAdmin === true ||
    liveAppUser?.isOwner === true ||
    liveAppUser?.accountOwner === true ||
    liveAppUser?.workspaceOwner === true ||
    liveAppUser?.permissions?.team === true ||
    liveAppUser?.permissions?.settings === true ||
    /owner|manager|admin|administrator|supervisor|lead|gm|general manager/.test(elevatedRoleText)
  );
  const userHasMfaEnrollment = Boolean(
    liveAppUser?.mfaEnabled === true ||
    liveAppUser?.multiFactorEnabled === true ||
    liveAppUser?.accountSecurity?.mfaEnabled === true ||
    Number(liveAppUser?.mfaFactorCount || liveAppUser?.accountSecurity?.factorCount || 0) > 0
  );
  const mfaFrontendLockActive = Boolean(!ghostTenant && !isDemoMode && mfaFrontendEnforced && userNeedsMfa && !userHasMfaEnrollment);
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

// 2. Low-frequency presence check-in (no live scanner, no interval)
    let cancelledPresenceCheck = false;

    if (!ghostTenant && appUser?.id) {
      const saveHeartbeatDebug = (next) => {
        const packed = { ...(next || {}), at: new Date().toISOString(), restaurantId: rId, userId: appUser.id };
        if (!cancelledPresenceCheck) setHeartbeatDebug(packed);
        try { sessionStorage.setItem(`chaosPresenceCheckInDebug_${rId}_${appUser.id}`, JSON.stringify(packed)); } catch (err) {}
      };

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

      const sendPresenceCheckIn = async () => {
        const checkKey = `chaosPresenceCheckIn_${rId}_${appUser.id}`;
        let lastCheckIn = 0;
        try { lastCheckIn = Number(sessionStorage.getItem(checkKey) || 0); } catch (err) {}
        if (lastCheckIn && Date.now() - lastCheckIn < 10 * 60 * 1000) {
          saveHeartbeatDebug({ ok: true, channel: 'manual-presence-mode', state: 'online', message: 'Presence check-in already saved for this browser session. No live heartbeat interval is running.', heartbeatEpochMs: lastCheckIn });
          return;
        }

        const firebaseUser = await waitForAuthCurrentUser(8000);
        if (!firebaseUser) {
          saveHeartbeatDebug({ ok: false, channel: 'auth-wait', state: 'online', message: 'Presence check-in skipped because Firebase login is not active yet.', heartbeatEpochMs: Date.now() });
          return;
        }
        const authUid = firebaseUser.uid;
        if (appUser.id && appUser.id !== authUid) {
          saveHeartbeatDebug({ ok: false, channel: 'auth-mismatch', state: 'online', message: `Cached app user does not match Firebase Auth user. Cached ${appUser.id}; Auth ${authUid}.`, heartbeatEpochMs: Date.now() });
          return;
        }

        const stamp = new Date().toISOString();
        const heartbeatEpochMs = Date.now();
        const deviceDiagnostics = await collectDeviceDiagnostics();
        const presenceSessionKey = `chaosSessionId_${rId}_${appUser.id}`;
        let sessionId = sessionStorage.getItem(presenceSessionKey);
        if (!sessionId) {
          sessionId = `${rId}_${appUser.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem(presenceSessionKey, sessionId);
        }
        const safeSessionId = String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140);
        const device = (navigator.userAgent || 'Unknown device').substring(0, 140);

        try {
          const response = await secureFetch('/api/presence-heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId: rId,
              state: 'online',
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
          if (!response.ok || data?.ok === false) throw new Error(data?.error || `API ${response.status}`);
          try { sessionStorage.setItem(checkKey, String(heartbeatEpochMs)); } catch (err) {}
          saveHeartbeatDebug({ ok: true, channel: data?.mode || 'presence-check-in', state: 'online', message: 'One app-open presence check-in saved. No repeating heartbeat timer is running.', heartbeatEpochMs, apiProjectId: data?.projectId || '' });
        } catch (err) {
          saveHeartbeatDebug({ ok: false, channel: 'presence-check-in', state: 'online', message: err?.message || String(err), heartbeatEpochMs });
        }
      };

      sendPresenceCheckIn();
    }

    return () => {
      cancelledPresenceCheck = true;
      unsub();
    };
  }, [rId, ghostTenant, appUser?.id]);

 
  useEffect(() => {
    const handlePopState = (e) => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = normalizeRouteTab(e?.state?.tab || params.get('tab') || 'published');
      setActiveTabState(nextTab);
    };
    window.addEventListener('popstate', handlePopState);
    const params = new URLSearchParams(window.location.search);
    const preferredTab = normalizeRouteTab(appUser?.preferences?.defaultTab || 'today');
    const rawTab = params.get('tab') || preferredTab;
    const tab = normalizeRouteTab(rawTab);
    setActiveTabState(tab); window.history.replaceState({ tab }, '', `?tab=${tab}`);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appUser]);

  const setActiveTab = (tab) => {
    tab = normalizeRouteTab(tab);
    if (mfaFrontendLockActive && !['settings', 'help'].includes(tab)) {
      addToast('Two-Step Login Required', 'Open Account Security in Settings to finish MFA setup before using elevated tools.');
      tab = 'settings';
    }
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
        localStorage.setItem('86chaosUser', JSON.stringify(buildSafeSessionCache(appUser)));
        sessionStorage.removeItem('86chaosUser');
      } else {
        sessionStorage.setItem('86chaosUser', JSON.stringify(buildSafeSessionCache(appUser)));
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
  const [problemModal, setProblemModal] = useState({ open: false, title: '', message: '', category: 'Bug / Error' });
  const [problemText, setProblemText] = useState('');
  const [isSubmittingProblem, setIsSubmittingProblem] = useState(false);
  const [offlineQueueTick, setOfflineQueueTick] = useState(0);
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const registerUndo = (item) => { setUndoItem(item); setTimeout(() => setUndoItem(prev => prev === item ? null : prev), 12000); };

  useEffect(() => {
    const openFromMenu = () => {
      setProblemModal({ open: true, title: 'Manual Problem Report', message: `Page: ${activeTabState}`, category: 'Bug / Error' });
      setProblemText(`What happened:\nPage: ${activeTabState}\n\nWhat I clicked / expected:\n`);
    };
    window.addEventListener('chaosOpenProblemReport', openFromMenu);
    return () => window.removeEventListener('chaosOpenProblemReport', openFromMenu);
  }, [activeTabState]);


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

  const isReportableToast = (title = '', message = '') => /error|failed|blocked|denied|missing|invalid|crash|permission|offline|stopped/i.test(`${title} ${message}`);
  const openProblemReport = ({ title = 'Report Problem', message = '', category = 'Bug / Error' } = {}) => {
    setProblemModal({ open: true, title, message, category });
    setProblemText(message ? `What happened:
${message}

What I clicked / expected:
` : '');
  };

  const getDeviceDiagnostics = () => {
    if (typeof window === 'undefined') return [];
    const queue = getOfflineQueue(liveAppUser?.restaurantId, liveAppUser?.id);
    let storageOk = false;
    try { localStorage.setItem('__chaos_storage_test__', '1'); localStorage.removeItem('__chaos_storage_test__'); storageOk = true; } catch (_) { storageOk = false; }
    return [
      ['App version', CURRENT_VERSION],
      ['Firebase project', firebaseConfig?.projectId || 'unknown'],
      ['Host', window.location.host],
      ['Browser online', navigator.onLine ? 'yes' : 'no'],
      ['Service worker', 'serviceWorker' in navigator ? 'available' : 'missing'],
      ['Notifications', typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'],
      ['Camera/Mic API', navigator.mediaDevices?.getUserMedia ? 'available' : 'missing'],
      ['Local storage', storageOk ? 'available' : 'blocked'],
      ['Offline queue', `${queue.length} queued action${queue.length === 1 ? '' : 's'}`],
      ['Screen', `${window.innerWidth}x${window.innerHeight}`]
    ];
  };

  const submitProblemReport = async (e) => {
    e?.preventDefault?.();
    if (!problemText.trim()) return;
    setIsSubmittingProblem(true);
    try {
      const diagnostics = Object.fromEntries(getDeviceDiagnostics());
      const res = await secureFetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: problemModal.category || 'Bug / Error',
          title: problemModal.title || 'Report Problem',
          message: problemText.trim(),
          sourceToastMessage: problemModal.message || '',
          restaurantId: liveAppUser?.restaurantId || 'Unknown',
          restaurantName: liveAppUser?.restaurantName || '',
          activeTab: activeTabState || '',
          diagnostics,
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Could not send problem report.');
      }
      setProblemModal({ open: false, title: '', message: '', category: 'Bug / Error' });
      setProblemText('');
      addToast('Report Sent', 'Support report sent with device diagnostics.');
    } catch (err) {
      addToast('Report Failed', err.message || 'Could not send problem report.');
    } finally {
      setIsSubmittingProblem(false);
    }
  };

  const syncOfflineQueueFromShell = async () => {
    if (offlineSyncing) return;
    setOfflineSyncing(true);
    try {
      const result = await replayOfflineQueue(liveAppUser, addToast);
      setOfflineQueueTick(t => t + 1);
      addToast('Offline Queue Checked', `${result.saved || 0} saved • ${result.failed || 0} still queued.`);
    } catch (err) {
      addToast('Offline Sync Failed', err.message || 'Could not replay queued actions.');
    } finally {
      setOfflineSyncing(false);
    }
  };

  const toastDedupeRef = useRef({});
  const addToast = useCallback((title, message) => {
    const cleanTitle = String(title || '').trim();
    const cleanMessage = String(message || '').trim();
    const key = `${cleanTitle.toLowerCase()}::${cleanMessage.toLowerCase()}`;
    const now = Date.now();
    const last = toastDedupeRef.current[key] || 0;
    if (now - last < 2500) {
      if (process.env.NODE_ENV !== 'production') console.debug('[86chaos] duplicate toast suppressed', { title: cleanTitle, message: cleanMessage });
      return;
    }
    toastDedupeRef.current[key] = now;
    Object.keys(toastDedupeRef.current).forEach(k => { if (now - toastDedupeRef.current[k] > 10000) delete toastDedupeRef.current[k]; });
    const id = now + Math.random();
    const reportable = isReportableToast(cleanTitle, cleanMessage);
    setToasts(prev => [...prev, { id, title: cleanTitle, message: cleanMessage, reportable }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), reportable ? 9000 : 6000);
  }, []);

  const offlineQueue = liveAppUser ? getOfflineQueue(liveAppUser.restaurantId, liveAppUser.id) : [];

  const availableWorkspaces = useMemo(() => {
    const byId = new Map();
    const addWorkspace = (w = {}) => {
      const restaurantId = w.restaurantId || w.id;
      if (!restaurantId) return;
      byId.set(restaurantId, {
        ...w,
        restaurantId,
        restaurantName: safeWorkspaceName(w),
        membershipId: w.membershipId || w.id || `${appUser?.id || 'user'}_${restaurantId}`,
        userId: w.userId || appUser?.id,
        email: normalizeEmail(w.email || appUser?.email),
        name: w.name || appUser?.name || 'Staff',
        isActive: w.isActive !== false
      });
    };
    (appUser?.availableWorkspaces || []).forEach(addWorkspace);
    if (appUser?.memberships && typeof appUser.memberships === 'object') {
      Object.entries(appUser.memberships).forEach(([restaurantId, membership]) => addWorkspace({ ...(membership || {}), restaurantId }));
    }
    if (appUser?.restaurantId) addWorkspace({ ...appUser, restaurantId: appUser.restaurantId, restaurantName: appUser.restaurantName || clientData?.name || appUser.restaurantName });
    return Array.from(byId.values()).filter(w => w.isActive !== false);
  }, [appUser, clientData?.name]);

  useEffect(() => {
    if (!appUser?.id || appUser.id === 'dev-backdoor' || ghostTenant || isDemoMode) return;
    let canceled = false;
    const refreshMemberships = async () => {
      try {
        const res = await secureFetch('/api/workspace-memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: appUser.email, userId: appUser.id })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.workspaces) || canceled) return;
        const nextWorkspaces = data.workspaces.filter(w => w?.restaurantId && w.isActive !== false);
        if (!nextWorkspaces.length) return;
        const active = nextWorkspaces.find(w => w.restaurantId === appUser.restaurantId) || nextWorkspaces.find(w => w.restaurantId === data.activeRestaurantId) || nextWorkspaces[0];
        setAppUser(prev => {
          if (!prev?.id || prev.id !== appUser.id) return prev;
          const merged = buildWorkspaceUser({ ...prev, availableWorkspaces: nextWorkspaces }, active);
          return { ...merged, availableWorkspaces: nextWorkspaces, workspaceSwitcherReady: true };
        });
        const seenKey = `chaosWorkspacePickerSeen_${appUser.id}`;
        if (nextWorkspaces.length > 1 && sessionStorage.getItem(seenKey) !== 'true') {
          sessionStorage.setItem(seenKey, 'true');
          setIsWorkspaceSwitcherOpen(true);
        }
      } catch (err) {
        console.warn('Workspace membership refresh failed:', err?.message || err);
      }
    };
    refreshMemberships();
    return () => { canceled = true; };
  }, [appUser?.id, workspaceMembershipRefreshKey]);

  const closeWorkspaceSwitcher = () => {
    if (appUser?.id) {
      try { sessionStorage.setItem(`chaosWorkspacePickerSeen_${appUser.id}`, 'true'); } catch (_) {}
    }
    setIsWorkspaceSwitcherOpen(false);
  };

  const switchWorkspace = (workspace) => {
    if (!workspace?.restaurantId || workspace.restaurantId === rId) {
      setIsWorkspaceSwitcherOpen(false);
      return;
    }
    const nextUser = buildWorkspaceUser({ ...appUser, availableWorkspaces }, workspace);
    try {
      localStorage.setItem(`chaosActiveRestaurantId_${nextUser.id}`, workspace.restaurantId);
      sessionStorage.setItem('chaosWorkspaceSwitchedAt', new Date().toISOString());
      sessionStorage.setItem(`chaosWorkspacePickerSeen_${nextUser.id}`, 'true');
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('chaosLastHeartbeat_') || k.startsWith('chaosHeartbeatDebug_')) localStorage.removeItem(k);
      });
    } catch (_) {}
    if (nextUser.id && nextUser.id !== 'dev-backdoor') {
      updateDoc(doc(db, 'users', nextUser.id), {
        activeRestaurantId: workspace.restaurantId,
        lastWorkspaceId: workspace.restaurantId,
        lastWorkspaceSwitchedAt: new Date().toISOString()
      }).catch(() => {});
    }
    setGhostTenant(null);
    setClientData(null);
    setAppUser(nextUser);
    const nextDefaultTab = normalizeRouteTab(nextUser.preferences?.defaultTab || 'today');
    setActiveTabState(nextDefaultTab);
    try { window.history.replaceState({ tab: nextDefaultTab }, '', `?tab=${nextDefaultTab}`); } catch (_) {}
    setIsWorkspaceSwitcherOpen(false);
    addToast('Workspace Switched', `Now working in ${safeWorkspaceName(workspace)}.`);
  };

// --- AUTO-ASK + TOKEN REPAIR FOR PUSH NOTIFICATIONS ---
  const getActiveVapidKey = () => firebaseConfig?.projectId === 'cheers-34b8d'
    ? 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU'
    : 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc';

  const repairPushOnThisDevice = async (source = 'manual') => {
    if (!liveAppUser?.id || ghostTenant || isDemoMode || typeof window === 'undefined' || !('Notification' in window) || !messaging) {
      addToast('Push Repair Blocked', 'Push repair is only available from the real logged-in device.');
      return false;
    }
    setIsPushRepairing(true);
    try {
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await updateDoc(doc(db, 'users', liveAppUser.id), {
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushRepairStatus: permission === 'denied' ? 'blocked-by-browser' : 'permission-not-granted',
          lastPushRepairError: 'Browser notification permission is not granted.',
          lastPushTokenSyncAt: new Date().toISOString()
        }).catch(() => {});
        addToast('Notifications Blocked', 'This device needs browser notification permission before 86 Chaos can save a push token.');
        return false;
      }

      let registration = null;
      if ('serviceWorker' in navigator) {
        if (liveAppUser?.pushForceServiceWorkerRefresh) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
          await Promise.all((regs || []).filter(reg => (reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '').includes('firebase-messaging-sw')).map(reg => reg.unregister().catch(() => false)));
        }
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' }).catch(() => null);
        if (registration?.update) await registration.update().catch(() => null);
      }

      const tokenOptions = { vapidKey: getActiveVapidKey() };
      if (registration) tokenOptions.serviceWorkerRegistration = registration;
      const currentToken = await getToken(messaging, tokenOptions);
      if (!currentToken) throw new Error('Firebase returned no push token for this browser.');

      const stamp = new Date().toISOString();
      await updateDoc(doc(db, 'users', liveAppUser.id), {
        fcmToken: currentToken,
        fcmTokenUpdatedAt: stamp,
        lastPushTokenSyncAt: stamp,
        notificationPermission: permission,
        pushTokenPermission: permission,
        pushTokenHost: window.location.hostname,
        pushTokenCanonical: true,
        pushTokenDedupeVersion: '15.0.102',
        pushNeedsRepair: false,
        pushForceServiceWorkerRefresh: false,
        pushRepairStatus: 'connected',
        pushRepairCompletedAt: stamp,
        pushRepairCompletedHost: window.location.hostname,
        lastPushRepairError: null,
        lastPushFailureCode: null
      });
      setAppUser(prev => prev?.id === liveAppUser.id ? { ...prev, fcmToken: currentToken, pushNeedsRepair: false, pushForceServiceWorkerRefresh: false, notificationPermission: permission, pushTokenPermission: permission, pushTokenHost: window.location.hostname } : prev);
      setPushRepairDismissed(true);
      addToast(source === 'auto' ? 'Push Reconnected' : 'Notifications Fixed', 'This device is connected for 86 Chaos push notifications.');
      return true;
    } catch (err) {
      console.warn('86 Chaos push repair failed:', err?.message || err);
      await updateDoc(doc(db, 'users', liveAppUser.id), {
        notificationPermission: Notification.permission,
        pushTokenPermission: Notification.permission,
        pushRepairStatus: 'repair-failed',
        lastPushRepairError: err?.message || String(err),
        lastPushTokenSyncAt: new Date().toISOString()
      }).catch(() => {});
      addToast('Push Repair Failed', err?.message || 'Could not reconnect push notifications on this device.');
      return false;
    } finally {
      setIsPushRepairing(false);
    }
  };

  const pushRepairRequestedByLink = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pushRepair') === '1';
  const pushRepairRequested = Boolean(!ghostTenant && !isDemoMode && liveAppUser?.id && (pushRepairRequestedByLink || liveAppUser?.pushNeedsRepair === true || liveAppUser?.pushForceServiceWorkerRefresh === true));

  useEffect(() => {
    if (!liveAppUser?.id || ghostTenant || isDemoMode || typeof window === 'undefined' || !('Notification' in window) || !messaging) return;

    let canceled = false;

    const syncPushToken = async (permission, showToast = false) => {
      if (canceled || permission !== 'granted') {
        if (!canceled && liveAppUser?.id) {
          updateDoc(doc(db, 'users', liveAppUser.id), {
            notificationPermission: permission,
            pushTokenPermission: permission,
            pushRepairStatus: permission === 'denied' ? 'blocked-by-browser' : 'permission-not-granted',
            lastPushTokenSyncAt: new Date().toISOString()
          }).catch(() => {});
        }
        return;
      }

      try {
        let registration = null;
        if ('serviceWorker' in navigator) {
          if (liveAppUser?.pushForceServiceWorkerRefresh) {
            const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
            await Promise.all((regs || []).filter(reg => (reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '').includes('firebase-messaging-sw')).map(reg => reg.unregister().catch(() => false)));
          }
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' }).catch(() => null);
          if (registration?.update) await registration.update().catch(() => null);
        }
        const tokenOptions = { vapidKey: getActiveVapidKey() };
        if (registration) tokenOptions.serviceWorkerRegistration = registration;
        const currentToken = await getToken(messaging, tokenOptions);
        if (!currentToken || canceled) return;
        const stamp = new Date().toISOString();
        await updateDoc(doc(db, 'users', liveAppUser.id), {
          fcmToken: currentToken,
          fcmTokenUpdatedAt: stamp,
          lastPushTokenSyncAt: stamp,
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushTokenHost: window.location.hostname,
          pushTokenCanonical: true,
          pushTokenDedupeVersion: '15.0.102',
          pushNeedsRepair: false,
          pushForceServiceWorkerRefresh: false,
          pushRepairStatus: 'connected',
          pushRepairCompletedAt: stamp,
          pushRepairCompletedHost: window.location.hostname,
          lastPushRepairError: null,
          lastPushFailureCode: null
        });
        if (showToast) addToast('Push Ready', 'Push notifications are enabled for this device.');
      } catch (err) {
        console.warn('86 Chaos push token sync failed:', err?.message || err);
        updateDoc(doc(db, 'users', liveAppUser.id), {
          notificationPermission: permission,
          pushTokenPermission: permission,
          pushRepairStatus: 'sync-failed',
          lastPushRepairError: err?.message || String(err),
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
      } else if (pushRepairRequested || Notification.permission === 'granted') {
        await syncPushToken(Notification.permission, pushRepairRequested);
      } else {
        await syncPushToken(Notification.permission, false);
      }
    }, pushRepairRequested ? 600 : 2500);

    return () => { canceled = true; clearTimeout(timer); };
  }, [liveAppUser?.id, liveAppUser?.pushNeedsRepair, liveAppUser?.pushForceServiceWorkerRefresh, ghostTenant, isDemoMode]);                      
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

  const updateAlertMemory = useRememberedAlert({
    user: liveAppUser,
    workspaceId: rId,
    alertId: 'system-update-available',
    fingerprint: buildAlertFingerprint(CURRENT_VERSION, availableVersion || 'unknown')
  });
  const broadcastAlertMemory = useRememberedAlert({
    user: liveAppUser,
    workspaceId: rId,
    alertId: 'workspace-system-banner',
    fingerprint: buildAlertFingerprint(displayClientData?.systemBanner || '', displayClientData?.systemBannerUpdatedAt || '')
  });
  const pushRepairAlertMemory = useRememberedAlert({
    user: liveAppUser,
    workspaceId: rId,
    alertId: 'push-repair-needed',
    fingerprint: buildAlertFingerprint(
      liveAppUser?.pushNeedsRepair === true,
      liveAppUser?.pushForceServiceWorkerRefresh === true,
      liveAppUser?.lastPushFailureCode || '',
      liveAppUser?.pushRepairStatus || '',
      typeof window !== 'undefined' ? window.location.hostname : ''
    )
  });

  const prevDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setCurrentDate(formatDate(d)); };
  const nextDay = () => { const d = new Date(currentDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setCurrentDate(formatDate(d)); };
  const prevMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() - 1); setCurrentDate(formatDate(d)); };
  const nextMonth = () => { const d = new Date(currentDate + 'T12:00:00'); d.setMonth(d.getMonth() + 1); setCurrentDate(formatDate(d)); };

  const needsEyesCount = useMemo(() => {
    const lowStock = (inventoryItems || []).filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) < Number(i.parLevel || 0)).length;
    const urgentMaintenance = (maintenanceLogs || []).filter(m => !['completed', 'closed', 'resolved'].includes(String(m.status || '').toLowerCase()) && ['high', 'critical', 'urgent'].includes(String(m.urgency || m.priority || '').toLowerCase())).length;
    const peopleQueue = (timeOffRequests || []).filter(r => String(r.status || '').toLowerCase() === 'pending').length + (shiftSwaps || []).filter(sw => ['available', 'pending'].includes(String(sw.status || '').toLowerCase())).length;
    return lowStock + urgentMaintenance + peopleQueue;
  }, [inventoryItems, maintenanceLogs, timeOffRequests, shiftSwaps]);

  const primaryAppNav = useMemo(() => {
    const items = [
      { id: 'today', label: 'Today', Icon: Home, badge: needsEyesCount > 0 ? String(Math.min(needsEyesCount, 9)) : '' },
      { id: 'published', label: 'Schedule', Icon: CalendarDays, badge: hasMyShiftAlert ? '!' : '' },
      { id: 'prep', label: 'Prep', Icon: ClipboardList, badge: '' },
      { id: 'inventory', label: '86', Icon: AlertTriangle, badge: '' },
    ];
    return items.filter(item => {
      if (item.id === 'published') return displayClientFeatures?.schedule !== false;
      if (item.id === 'prep') return displayClientFeatures?.prep !== false;
      if (item.id === 'inventory') return displayClientFeatures?.inventory !== false;
      return true;
    });
  }, [displayClientFeatures, hasMyShiftAlert, needsEyesCount]);

  const NativeNavButton = ({ item, mode = 'mobile' }) => {
    const Icon = item.Icon;
    const active = activeTabState === item.id || (item.id === 'published' && ['schedule', 'events', 'month'].includes(activeTabState));
    return (
      <button
        type="button"
        onClick={() => setActiveTab(item.id)}
        className={`native-nav-btn native-nav-${mode} ${active ? 'is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={item.label}
      >
        <span className="native-nav-icon-wrap">
          <Icon size={mode === 'desktop' ? 18 : 20} />
          {item.badge && <span className="native-nav-badge">{item.badge}</span>}
        </span>
        <span className="native-nav-label">{item.label}</span>
      </button>
    );
  };

  const activeScreenTitle = useMemo(() => {
    const labels = {
      today: 'Today',
      ops: 'Command Center',
      published: 'Schedule',
      schedule: 'Schedule Builder',
      events: 'Events',
      month: 'Month View',
      prep: 'Prep',
      inventory: 'Inventory',
      recipes: 'Recipes',
      maintenance: 'Maintenance',
      financials: 'Financials',
      sales: 'Sales',
      'back-office': 'Back Office',
      messages: 'Messages',
      team: 'Team',
      settings: 'Settings',
      help: 'Help Center',
      reminders: 'Reminders',
      menu: 'Menu Intelligence',
      ai: 'AI Tools',
      manuals: 'HR & Training',
      audit: 'Audit Log',
      godmode: 'System Administrator'
    };
    return labels[activeTabState] || String(activeTabState || 'Today').replace(/[-_]/g, ' ');
  }, [activeTabState]);

  const globalManagerBriefMathText = useMemo(() => {
    const today = getToday();
    const activeUserIds = new Set((displayUsers || []).filter(u => u?.isActive !== false).flatMap(u => [u.id, u.uid, u.authUid, u.userId].filter(Boolean)));
    const scheduled = (shifts || []).filter(s => {
      const shiftDate = String(s.date || s.scheduleDateKey || '');
      const statusText = String(s.status || s.scheduleStatus || '').toLowerCase();
      const deleted = s.isDeleted === true || s.cancelled === true || !!s.deletedAt || ['cancelled', 'canceled', 'deleted'].includes(statusText);
      const employeeOk = !s.employeeId || activeUserIds.has(s.employeeId);
      return shiftDate === today && !deleted && employeeOk;
    }).length;
    const rawClockedIn = (timePunches || []).filter(p => {
      const punchDate = String(p.date || p.shiftDate || p.clockInDate || '').slice(0, 10);
      const status = String(p.status || '').toLowerCase();
      const openPunch = Boolean(p.clockIn || p.clockInAt || p.startTime) && !(p.clockOut || p.clockOutAt || p.endTime);
      return (!punchDate || punchDate === today) && (['clocked_in', 'clocked in', 'on_break', 'on break'].includes(status) || openPunch);
    }).length;
    const clockedIn = Math.min(rawClockedIn, Math.max(scheduled, 0));
    const lowStock = (inventoryItems || []).filter(i => Number(i.parLevel || 0) > 0 && Number(i.currentStock || 0) < Number(i.parLevel || 0)).length;
    const urgentMaintenance = (maintenanceLogs || []).filter(m => !['completed', 'closed', 'resolved'].includes(String(m.status || '').toLowerCase()) && ['high', 'critical', 'urgent'].includes(String(m.urgency || m.priority || '').toLowerCase())).length;
    const pendingPeople = (timeOffRequests || []).filter(r => String(r.status || '').toLowerCase() === 'pending').length + (shiftSwaps || []).filter(sw => ['available', 'pending'].includes(String(sw.status || '').toLowerCase())).length;
    const needsEyes = lowStock + urgentMaintenance + pendingPeople;
    return `${scheduled} On Schedule ${clockedIn} Clocked In ${needsEyes} Needs Eyes`;
  }, [displayUsers, shifts, timePunches, inventoryItems, maintenanceLogs, timeOffRequests, shiftSwaps]);

  if (labelsToPrint) return <div className="non-admin-controls-compact"><DayDotPrintScreen labelsToPrint={labelsToPrint.items} prepDate={labelsToPrint.prepDate} appUser={liveAppUser} onClose={() => setLabelsToPrint(null)} /></div>;

  if (!liveAppUser) return <div className="non-admin-controls-compact"><LoginScreen users={displayUsers} setAppUser={setAppUser} addToast={addToast} /></div>;


  const renderMainContent = () => {
    if (mfaFrontendLockActive && !['settings', 'help'].includes(activeTabState)) {
      return (
        <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4 border-amber-500/40`}>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">🔐</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">Elevated Account Protection</p>
            <h2 className="text-2xl font-black text-white mt-2">Two-Step Login Required</h2>
            <p className="text-sm font-bold text-slate-400 mt-3">This owner/manager/admin account needs MFA enrollment before elevated tools unlock. Open Account Security in Settings, finish setup, then log out and sign back in with the second factor.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => setActiveTab('settings')} className={T.btn}>Open Account Security</button>
            <button onClick={() => { localStorage.removeItem('86chaosUser'); sessionStorage.removeItem('86chaosUser'); setAppUser(null); }} className={T.btnAlt}>Log Out</button>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Keep enforcement off until every elevated account has tested enrollment and a fresh MFA login.</p>
        </div>
      );
    }
    const routeAccess = planAccess.canRoute(activeTabState);
    const routeIsInternalAdmin = activeTabState === 'godmode' || activeTabState === 'audit';
    if (!routeIsInternalAdmin && routeAccess && routeAccess.allowed === false) return <LockedFeatureScreen access={routeAccess} appUser={liveAppUser} setActiveTab={setActiveTab} />;
    if (activeTabState === 'today') return <TabToday key={`tdy-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} sales={sales} timePunches={timePunches} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} prepItems={prepItems} tasks={tasks} recipes={recipes} menuDependencies={menuDependencies} restaurantAdminAlerts={restaurantAdminAlerts} clientData={displayClientData} setActiveTab={setActiveTab} addToast={addToast} registerUndo={registerUndo} />;
    if (activeTabState === 'schedule' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule)) return <TabMasterSchedule key={`schpub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} setCurrentDate={setCurrentDate} onSubTabChange={setActiveScheduleSubTab} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} initialSubTab="schedule-builder" voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} clientData={displayClientData} scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'events' && displayClientFeatures?.events !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.events || liveAppUser?.permissions?.schedule || liveAppUser?.permissions?.team)) return <TabSchedule key={`evt-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} events={events} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab="events" hideSubTabs />;
    if (activeTabState === 'published') return <TabMasterSchedule key={`pub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} setCurrentDate={setCurrentDate} onSubTabChange={setActiveScheduleSubTab} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} addToast={addToast} voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} clientData={displayClientData} scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'ops' && displayClientFeatures?.ops !== false && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.ops)) return <TabOpsCenter key={`ops-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} events={events} sales={sales} timePunches={timePunches} addToast={addToast} setActiveTab={setActiveTab} clientData={displayClientData} />;
    if (activeTabState === 'back-office' && !isDemoMode) return <TabBackOffice key={`bo-${rId}`} currentDate={currentDate} users={displayUsers} sales={sales} timePunches={timePunches} restaurantAdminAlerts={restaurantAdminAlerts} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} addToast={addToast} />;
    if ((activeTabState === 'financials' || activeTabState === 'sales' || activeTabState === 'labor') && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.labor || liveAppUser?.permissions?.sales)) return <TabFinancials key={`fin-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} sales={sales} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} initialSubTab={activeTabState === 'sales' ? 'ledger' : activeTabState === 'labor' ? 'labor' : 'overview'} />;
    if (activeTabState === 'messages' && displayClientFeatures?.messages !== false) return <TabMessages key={`msg-${rId}`} events={events} appUser={liveAppUser} users={displayUsers} addToast={addToast} />;
    if (activeTabState === 'prep' && displayClientFeatures?.prep !== false) return <TabPrep key={`prp-${rId}`} currentDate={currentDate} appUser={liveAppUser} addToast={addToast} setLabelsToPrint={setLabelsToPrint} />;
    if (activeTabState === 'recipes' && displayClientFeatures?.recipes !== false) return <TabRecipes key={`rec-${rId}`} appUser={liveAppUser} addToast={addToast} voiceRecipeTarget={voiceRecipeTarget} />;
    if (activeTabState === 'inventory' && displayClientFeatures?.inventory !== false) return <TabInventory key={`inv-${rId}-${inventorySubTabTarget || 'default'}`} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab={inventorySubTabTarget} onInitialSubTabConsumed={() => setInventorySubTabTarget(null)} />;
    if (activeTabState === 'ai-tools' && !isDemoMode && (liveAppUser?.isAdmin || liveAppUser?.permissions?.inventory || liveAppUser?.permissions?.prep || liveAppUser?.permissions?.team)) return <TabAITools key={`ai-${rId}`} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} setInventorySubTabTarget={setInventorySubTabTarget} addToast={addToast} />;
    if (activeTabState === 'menu-intelligence' && !isDemoMode) return <TabMenuIntelligence key={`mi-${rId}`} appUser={liveAppUser} clientData={displayClientData} inventoryItems={inventoryItems} addToast={addToast} />;
    if (activeTabState === 'reminders' && !isDemoMode) return <TabPersonalReminders key={`rem-${rId}-${liveAppUser?.id}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'team' && displayClientFeatures?.team !== false) return <TabTeam key={`tea-${rId}`} appUser={liveAppUser} users={displayUsers} clientData={displayClientData} addToast={addToast} />;
    if (activeTabState === 'hr-training' && !isDemoMode && displayClientFeatures?.hr !== false) return <TabHrTraining key={`hrt-${rId}-${liveAppUser?.id}`} appUser={liveAppUser} users={displayUsers} addToast={addToast} />;
    if (activeTabState === 'maintenance' && displayClientFeatures?.maintenance !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.team)) return <TabMaintenance key={`mtn-${rId}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'settings' && !isDemoMode) return <TabSettings key={`set-${rId}`} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} users={displayUsers} />;
    if (activeTabState === 'help') return <TabHelpCenter key={`help-${rId}`} appUser={liveAppUser} activeTab={activeTabState} voiceHelpSearchTarget={voiceHelpSearchTarget} addToast={addToast} />;
    if (activeTabState === 'godmode' && (liveAppUser?.isSuperAdmin === true || serverSaysSuperAdmin || (MASTER_ADMIN_EMAIL && (liveAppUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()))) return <TabGodMode key={`god-${rId}`} appUser={{ ...liveAppUser, isSuperAdmin: true, serverAdminCheck }} addToast={addToast} setGhostTenant={setGhostTenant} setActiveTab={setActiveTab} />;
    if (activeTabState === 'godmode') return (
      <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4 border-red-900/40`}>
        <div className="mx-auto w-12 h-12 rounded-2xl bg-red-900/20 border border-red-900/50 flex items-center justify-center text-red-300 text-2xl">🔐</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300">Plan & Permission Gate</p>
          <h2 className="text-xl font-black text-white mt-2">Your role does not include this tool</h2>
          <p className="text-sm font-bold text-slate-400 mt-2">System Administrator tools are internal-only. This account does not have the required permission for this area.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => setActiveTab('today')} className={T.btn}>Go to Today</button>
          <button onClick={() => setActiveTab('help')} className={T.btnAlt}>Open Help Center</button>
          <button onClick={() => { localStorage.removeItem('86chaosUser'); sessionStorage.removeItem('86chaosUser'); setAppUser(null); }} className={T.btnAlt}>Log Out</button>
        </div>
      </div>
    );
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
  // Global lockdown should affect every workspace, including the active workspace, but never lock out
  // the platform owner/super-admin account that needs to lift the lockdown.
  const maintenanceBypass = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    serverSaysSuperAdmin ||
    (MASTER_ADMIN_EMAIL && (liveAppUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase())
  );
  const maintenanceEndsMs = clientData?.maintenanceEndsAt ? new Date(clientData.maintenanceEndsAt).getTime() : 0;
  const maintenanceExpired = maintenanceEndsMs && Number.isFinite(maintenanceEndsMs) && maintenanceEndsMs <= Date.now();
  const maintenanceAudience = clientData?.maintenanceAudience || 'everyone_except_super_admin';
  const maintenanceAppliesToUser = maintenanceAudience === 'employees_only'
    ? !liveAppUser?.isAdmin
    : maintenanceAudience === 'non_admins'
      ? !liveAppUser?.isAdmin
      : true;
  if ((clientData?.maintenanceMode === true || clientData?.subscription?.status === 'past_due') && !maintenanceExpired && maintenanceAppliesToUser && !ghostTenant && !maintenanceBypass) {
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
    <div style={appThemeStyle} onClickCapture={blockDemoMutation} onSubmitCapture={blockDemoMutation} className={`native-app-shell premium-app-shell desktop-pro-shell ui-v13-polished ui-v12-compact cockpit-shell ${activeTabState === 'godmode' ? '' : 'non-admin-controls-compact'} kitchen-simple-shell ui-density-${liveAppUser?.preferences?.uiDensity || displayClientData?.systemSettings?.uiDensity || 'compact'} recipe-density-${liveAppUser?.preferences?.recipeDensity || displayClientData?.systemSettings?.recipeCardDensity || 'tight'} motion-${liveAppUser?.preferences?.motionMode || displayClientData?.systemSettings?.cockpitLights || 'normal'} min-h-screen font-sans flex flex-col w-full max-w-[100vw] overflow-x-hidden ${T.bg}`}>
      
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
        .kitchen-simple-shell .cockpit-grid { background-image: none; }
        .kitchen-simple-shell .cockpit-light { box-shadow: none; }
        .kitchen-simple-shell [class*="tracking-[0.35em]"] { letter-spacing: .18em !important; }
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

        .native-app-shell {
          --native-bottom-nav-height: 74px;
          --native-desktop-rail-width: 72px;
          background:
            radial-gradient(circle at top left, rgba(212,163,129,.075), transparent 32rem),
            radial-gradient(circle at bottom right, rgba(73,95,112,.10), transparent 34rem),
            #0F1318 !important;
        }
        .native-app-shell .app-header {
          height: 58px;
          border-bottom-color: rgba(212,163,129,.18) !important;
          box-shadow: 0 10px 34px rgba(0,0,0,.26);
        }
        .native-app-shell .app-content-shell {
          min-height: calc(100dvh - 120px);
        }
        @media (min-width: 768px) {
          .native-app-shell {
            background:
              linear-gradient(180deg, rgba(15,19,24,.98), rgba(11,14,17,.98)),
              #0F1318 !important;
          }
          .native-app-shell .app-header {
            height: 54px !important;
          }
        }
        .native-route-loader {
          backdrop-filter: blur(18px);
        }
        .native-loader-bar {
          animation: nativeLoaderSweep 1.4s ease-in-out infinite;
        }
        @keyframes nativeLoaderSweep {
          0% { transform: translateX(-105%); }
          55%, 100% { transform: translateX(210%); }
        }
        .native-version-pill {
          border: 1px solid rgba(212,163,129,.18);
          background: rgba(18,24,29,.72);
          backdrop-filter: blur(14px);
        }
        .native-desktop-rail {
          position: fixed;
          left: 12px;
          top: 72px;
          bottom: 18px;
          width: 66px;
          z-index: 35;
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 10px 8px;
          border: 1px solid rgba(42,53,61,.95);
          border-radius: 22px;
          background: rgba(15,19,24,.82);
          box-shadow: 0 18px 55px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.035);
          backdrop-filter: blur(18px);
        }
        .native-desktop-rail-divider {
          width: 28px;
          height: 1px;
          background: rgba(212,163,129,.18);
          margin: 4px 0;
        }
        .native-mobile-bottom-nav {
          position: fixed;
          left: max(10px, env(safe-area-inset-left));
          right: max(10px, env(safe-area-inset-right));
          bottom: max(10px, env(safe-area-inset-bottom));
          z-index: 60;
          min-height: 64px;
          display: none;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 4px;
          padding: 8px;
          border: 1px solid rgba(42,53,61,.95);
          border-radius: 24px;
          background: rgba(15,19,24,.92);
          box-shadow: 0 20px 60px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.04);
          backdrop-filter: blur(20px);
        }
        .native-nav-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          color: #94a3b8;
          background: transparent;
          font-weight: 900;
          transition: color .16s ease, background .16s ease, border-color .16s ease, transform .16s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .native-nav-mobile {
          flex-direction: column;
          gap: 3px;
          min-height: 48px;
          border-radius: 17px;
          padding: 5px 2px;
          font-size: 10px;
          letter-spacing: .01em;
        }
        .native-nav-desktop {
          width: 48px;
          height: 50px;
          flex-direction: column;
          gap: 2px;
          border-radius: 16px;
          font-size: 9px;
        }
        .native-nav-btn:hover {
          color: #fff;
          background: rgba(212,163,129,.08);
          border-color: rgba(212,163,129,.18);
        }
        .native-nav-btn.is-active {
          color: #fff;
          background: linear-gradient(180deg, rgba(212,163,129,.22), rgba(143,96,64,.14));
          border-color: rgba(212,163,129,.36);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 8px 24px rgba(0,0,0,.22);
        }
        .native-nav-icon-wrap { position: relative; display: inline-flex; }
        .native-nav-badge {
          position: absolute;
          top: -8px;
          right: -10px;
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ef4444;
          color: #fff;
          border: 2px solid #0F1318;
          font-size: 9px;
          line-height: 1;
          font-weight: 1000;
        }
        .native-nav-label {
          line-height: 1;
          white-space: nowrap;
        }

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

        @media (max-width: 767px) {
          .native-mobile-bottom-nav { display: grid !important; }
          .native-app-shell .native-desktop-rail { display: none !important; }
          .native-app-shell .app-header {
            height: 56px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
          .native-app-shell .app-content-shell {
            padding-bottom: calc(var(--native-bottom-nav-height) + 36px) !important;
          }
          .native-app-shell .desktop-date-strip {
            position: sticky;
            top: 56px;
            z-index: 29;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          .native-app-shell .app-footer {
            padding-bottom: calc(var(--native-bottom-nav-height) + 12px) !important;
          }
        }

        @media (min-width: 768px) {
          .native-app-shell .native-mobile-bottom-nav { display: none !important; }
          .native-app-shell .native-desktop-rail { display: flex !important; }
          .native-app-shell .app-content-shell {
            margin-left: calc(var(--native-desktop-rail-width) + 22px) !important;
            padding-left: 14px !important;
            padding-right: 18px !important;
            padding-bottom: 18px !important;
            max-width: none !important;
          }
          .native-app-shell .desktop-date-strip {
            margin-left: calc(var(--native-desktop-rail-width) + 18px);
            border-left: 1px solid rgba(42,53,61,.72);
            border-bottom-left-radius: 18px;
            background: rgba(18,24,29,.84) !important;
            backdrop-filter: blur(14px);
          }
          .native-app-shell .app-footer {
            display: none !important;
          }
        }

        @media (min-width: 1180px) {
          .native-app-shell .app-content-shell {
            padding-left: 18px !important;
            padding-right: 22px !important;
          }
        }

        /* 15.0.102 desktop shell correction: no webpage-style action boxes/chips and no clipped desktop content. */
        @media (min-width: 768px) {
          .native-app-shell .app-header,
          .premium-app-shell .native-command-bar {
            padding-right: 28px !important;
            overflow: visible !important;
          }
          .native-app-shell .app-content-shell,
          .premium-app-shell .app-content-shell {
            width: calc(100vw - 80px) !important;
            max-width: calc(100vw - 80px) !important;
            margin-left: 80px !important;
            margin-right: 0 !important;
            padding-right: 34px !important;
            box-sizing: border-box !important;
            overflow-x: auto !important;
          }
          .native-app-shell .app-content-shell > *,
          .premium-app-shell .app-content-shell > * {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        }
        .premium-app-shell .native-version-pill,
        .premium-app-shell .native-icon-button,
        .premium-app-shell .native-queue-button,
        .premium-app-shell .native-workspace-chip,
        .native-app-shell .native-version-pill,
        .native-app-shell .native-icon-button,
        .native-app-shell .native-queue-button,
        .native-app-shell .native-workspace-chip {
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          outline: 0 !important;
        }
        .premium-app-shell .native-icon-button,
        .native-app-shell .native-icon-button {
          width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          padding: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #B7C1CA !important;
        }
        .premium-app-shell .native-menu-button,
        .native-app-shell .native-menu-button {
          color: var(--chaos-accent, #D4A381) !important;
        }
        .premium-app-shell .native-icon-button:hover,
        .premium-app-shell .native-queue-button:hover,
        .premium-app-shell .native-workspace-chip:hover,
        .native-app-shell .native-icon-button:hover,
        .native-app-shell .native-queue-button:hover,
        .native-app-shell .native-workspace-chip:hover {
          background: transparent !important;
          border: 0 !important;
          color: #FFFFFF !important;
          transform: none !important;
        }
        .premium-app-shell .native-version-pill,
        .native-app-shell .native-version-pill {
          padding: 0 !important;
          min-height: 0 !important;
          color: #8996A3 !important;
          letter-spacing: .10em !important;
        }
        .premium-app-shell .native-workspace-chip,
        .native-app-shell .native-workspace-chip {
          padding: 0 !important;
          min-height: 0 !important;
          max-width: min(30vw, 340px) !important;
          justify-content: center !important;
        }
        .premium-app-shell .native-command-actions,
        .native-app-shell .native-command-actions {
          gap: 14px !important;
        }
        .premium-app-shell .native-alert-dot,
        .native-app-shell .native-alert-dot {
          top: 3px !important;
          right: 1px !important;
          width: 7px !important;
          height: 7px !important;
          border-width: 1px !important;
        }
      `}</style>

      {/* UPDATE ALERT BANNER */}
      {showUpdateBanner && !updateAlertMemory.isDismissed && (
        <div className="bg-red-600 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-between sticky top-0 z-[9999] shadow-2xl uppercase tracking-wider">
          <div className="flex items-center gap-2 min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 animate-pulse text-white"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
            <span className="truncate">System update available. Refresh to prevent database desync.</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button 
              onClick={() => window.location.reload(true)} 
              className="bg-white text-red-600 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md hover:bg-slate-100 transition-all tracking-widest"
            >
              REFRESH NOW
            </button>
            <button type="button" onClick={updateAlertMemory.dismiss} className="p-1.5 rounded-lg bg-red-700/70 hover:bg-red-800 text-white" title="Dismiss this update notice"><X size={14}/></button>
          </div>
        </div>
      )}

      {pushRepairRequested && !pushRepairDismissed && !pushRepairAlertMemory.isDismissed && (
        <div className="bg-amber-500 text-slate-950 text-[11px] sm:text-xs font-black px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 z-[9998] shadow-2xl uppercase tracking-wider border-b border-amber-300">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={15} className="flex-shrink-0" />
            <span className="truncate">Reconnect notifications on this device so your restaurant can send alerts.</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => repairPushOnThisDevice('manual')} disabled={isPushRepairing} className="bg-slate-950 text-amber-200 px-3 py-1.5 rounded-lg font-black text-[10px] shadow-md disabled:opacity-60">{isPushRepairing ? 'FIXING...' : 'FIX NOW'}</button>
            <button onClick={() => { setPushRepairDismissed(true); pushRepairAlertMemory.dismiss(); }} className="bg-amber-200/60 text-slate-950 px-3 py-1.5 rounded-lg font-black text-[10px]">DON'T SHOW AGAIN</button>
          </div>
        </div>
      )}

      <header className="app-header native-command-bar sticky top-0 z-40 border-b flex items-center justify-between px-3 sm:px-4 bg-[#0F1318]/96 backdrop-blur-md border-[#202A31]">
        <div className="native-command-left min-w-0 flex items-center gap-3">
          <CheersLogo clientData={displayClientData} />
          <div className="native-command-separator hidden md:block" />
          <div className="native-command-title min-w-0 hidden sm:block">
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 leading-none">Current Tool</div>
            <div className="text-sm font-black text-white leading-tight truncate">{activeScreenTitle}</div>
          </div>
        </div>

        {/* ACTIVE WORKSPACE NAME / SWITCHER */}
        {liveAppUser && (
          <button
            type="button"
            onClick={() => availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode ? setIsWorkspaceSwitcherOpen(true) : null}
            className={`native-workspace-chip min-w-0 truncate ${availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode ? 'is-switchable' : ''}`}
            title={availableWorkspaces.length > 1 ? 'Switch workspace' : 'Active workspace'}
          >
            <span className="native-workspace-name truncate">{liveAppUser.restaurantName || 'Restaurant'}</span>
            {availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode && <span className="native-workspace-action hidden sm:inline">Switch</span>}
          </button>
        )}

        <div className="native-command-actions flex items-center gap-2 flex-shrink-0">
          <span className="native-version-pill hidden lg:inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-400">v{CURRENT_VERSION}</span>
          <button type="button" onClick={() => openProblemReport({ title: 'Manual Problem Report', message: `Page: ${activeTabState}`, category: 'Bug / Error' })} className="native-icon-button hidden sm:flex" title="Report a problem"><Bug size={17}/></button>
          {offlineQueue.length > 0 && <button type="button" onClick={() => openProblemReport({ title: 'Offline Queue', message: `${offlineQueue.length} queued action(s) waiting to sync.`, category: 'Data Looks Wrong' })} className="native-queue-button hidden sm:flex" title="Offline queued actions">Queue {offlineQueue.length}</button>}
          <button onClick={() => setIsMenuOpen(true)} className="native-icon-button native-menu-button relative" title="Open menu">
            <Menu size={20} />
            {hasAnyMenuAlert && <span className="native-alert-dot"></span>}
          </button>
        </div>
      </header>

      {/* SYSTEM BROADCAST BANNER */}
      {displayClientData?.systemBanner && !broadcastAlertMemory.isDismissed && (
        <div className="bg-blue-600 border-b border-blue-800 text-white text-[11px] sm:text-xs font-black px-4 py-2.5 flex items-center justify-center shadow-lg uppercase tracking-wider w-full relative z-30 animate-[slideIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 text-center pr-10">
            <Bell size={14} className="animate-pulse flex-shrink-0" />
            <span>{displayClientData.systemBanner}</span>
          </div>
          <button type="button" onClick={broadcastAlertMemory.dismiss} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-blue-700/70 hover:bg-blue-800 text-white" title="Dismiss this announcement"><X size={14}/></button>
        </div>
      )}

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTabState} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} hasUnreadMessages={hasUnreadMessages} hasMyShiftAlert={hasMyShiftAlert} hasScheduleBuilderAlert={hasScheduleBuilderAlert} hasHelpUpdate={hasHelpUpdate} clientFeatures={displayClientFeatures} clientData={displayClientData} addToast={addToast} availableWorkspaces={availableWorkspaces} activeWorkspaceName={liveAppUser?.restaurantName || displayClientData?.name || ''} onOpenWorkspaceSwitcher={() => !ghostTenant && !isDemoMode && setIsWorkspaceSwitcherOpen(true)} />
      <nav className="native-desktop-rail" aria-label="Primary app shortcuts">
        {primaryAppNav.map(item => <NativeNavButton key={item.id} item={item} mode="desktop" />)}
        <div className="native-desktop-rail-divider" />
        <button type="button" onClick={() => setIsMenuOpen(true)} className="native-nav-btn native-nav-desktop" title="More tools">
          <span className="native-nav-icon-wrap"><MoreHorizontal size={19} /></span>
          <span className="native-nav-label">More</span>
        </button>
      </nav>

      <nav className="native-mobile-bottom-nav" aria-label="Primary app navigation">
        {primaryAppNav.map(item => <NativeNavButton key={item.id} item={item} mode="mobile" />)}
        <button type="button" onClick={() => setIsMenuOpen(true)} className="native-nav-btn native-nav-mobile" title="More tools">
          <span className="native-nav-icon-wrap"><MoreHorizontal size={20} />{hasAnyMenuAlert && <span className="native-nav-badge">!</span>}</span>
          <span className="native-nav-label">More</span>
        </button>
      </nav>
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} queryText={globalSearchQuery} setQueryText={setGlobalSearchQuery} users={displayUsers} events={events} shifts={shifts} recipes={recipes} inventoryItems={inventoryItems} maintenanceLogs={maintenanceLogs} setActiveTab={setActiveTab} />
      <KitchenTVMode isOpen={isKitchenTVOpen} onClose={() => setIsKitchenTVOpen(false)} shifts={shifts} events={events} prepItems={prepItems} maintenanceLogs={maintenanceLogs} inventoryItems={inventoryItems} />
      <UndoBar undoItem={undoItem} clearUndo={() => setUndoItem(null)} />
      <VoiceCommandDock appUser={liveAppUser} inventoryItems={inventoryItems} recipes={recipes} users={displayUsers} prepItems={prepItems} tasks={tasks} events={events} maintenanceLogs={maintenanceLogs} menuDependencies={menuDependencies} clientFeatures={displayClientFeatures} clientData={displayClientData} setActiveTab={setActiveTab} setCurrentDate={setCurrentDate} setScheduleSubTabTarget={setVoiceScheduleSubTabTarget} setHelpSearchTarget={setVoiceHelpSearchTarget} setRecipeTarget={setVoiceRecipeTarget} addToast={addToast} />

      <Modal isOpen={problemModal.open} onClose={() => !isSubmittingProblem && setProblemModal({ open: false, title: '', message: '', category: 'Bug / Error' })} title="Report Problem" sizeClass="max-w-3xl">
        <form onSubmit={submitProblemReport} className="space-y-4">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Problem context</div>
            <div className="text-sm font-black text-white mt-1">{problemModal.title || 'Manual report'}</div>
            {problemModal.message && <div className="text-xs font-bold text-slate-400 mt-1 whitespace-pre-wrap">{problemModal.message}</div>}
          </div>
          <select value={problemModal.category || 'Bug / Error'} onChange={e => setProblemModal(prev => ({ ...prev, category: e.target.value }))} className={T.input}>
            <option>Bug / Error</option><option>Permission Problem</option><option>Data Looks Wrong</option><option>Mobile Layout Problem</option><option>Device Problem</option><option>Feature Request</option>
          </select>
          <textarea value={problemText} onChange={e => setProblemText(e.target.value)} rows={5} className={T.input} placeholder="Tell me what you clicked, what you expected, and what happened." required />
          <div className="grid sm:grid-cols-2 gap-2">
            {getDeviceDiagnostics().map(([label, value]) => <div key={label} className="bg-[#12161A] border border-[#2A353D] rounded-xl px-3 py-2"><div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div><div className="text-xs font-bold text-slate-200 break-all mt-1">{value}</div></div>)}
          </div>
          {offlineQueue.length > 0 && <button type="button" onClick={syncOfflineQueueFromShell} disabled={offlineSyncing} className={`${T.btnAlt} w-full disabled:opacity-50`}>{offlineSyncing ? 'Syncing Offline Queue...' : `Try Sync Offline Queue (${offlineQueue.length})`}</button>}
          <button type="submit" disabled={isSubmittingProblem || !problemText.trim()} className={`${T.btn} w-full flex items-center justify-center gap-2 disabled:opacity-50`}>{isSubmittingProblem ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>} Send Problem Report</button>
        </form>
      </Modal>

      {ghostTenant?.impersonate && (
        <div className="bg-fuchsia-950/60 border-b border-fuchsia-500/30 px-4 py-2 text-[10px] sm:text-xs text-fuchsia-100 font-bold flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Viewing user: <strong>{ghostTenant.impersonate.name || 'Unnamed'}</strong></span>
          <span>Email: <strong>{ghostTenant.impersonate.email || 'No email'}</strong></span>
          <span>Role: <strong>{ghostTenant.impersonate.role || 'No role'}</strong></span>
          <span>User ID: <strong className="font-mono">{ghostTenant.impersonate.id}</strong></span>
        </div>
      )}
      
      {['schedule', 'events', 'published', 'month', 'financials', 'sales', 'back-office', 'prep'].includes(activeTabState) && !( ['schedule','published'].includes(activeTabState) && activeScheduleSubTab === 'time-off') && (
        <div className="desktop-date-strip py-4 px-4 shadow-sm z-30 border-b flex justify-between items-center bg-[#1A2126] border-[#2A353D] relative">
          {(activeTabState === 'sales' || activeTabState === 'financials' || activeTabState === 'back-office') ? (
            <div className="w-full text-center">
              <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">{activeTabState === 'back-office' ? 'Back Office' : 'Financials'}</h2>
            </div>
          ) : (
            <>
              <button onClick={activeTabState === 'prep' ? prevDay : prevMonth} className="p-2 border rounded-xl transition-colors bg-[#12161A] border-[#2A353D] text-slate-400 hover:text-[#D4A381] relative z-10"><ChevronLeft size={20} /></button>
              
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <h2 onClick={() => setIsDateModalOpen(true)} className="text-xl sm:text-2xl font-black tracking-tight text-center cursor-pointer transition-colors text-white hover:text-[#D4A381] pointer-events-auto">
                  {activeTabState === 'events' ? 'Event Calendar' : activeTabState === 'prep' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? formatDisplayFullDate(currentDate) : formatDisplayMonth(getMonthStr(currentDate))}
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
            type={activeTabState === 'prep' || activeTabState === 'sales' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? 'date' : 'month'} 
            value={activeTabState === 'prep' || activeTabState === 'sales' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? currentDate : getMonthStr(currentDate)} 
            onChange={e => { 
              if (e.target.value) { 
                setCurrentDate(activeTabState === 'prep' || activeTabState === 'sales' || ((activeTabState === 'schedule' || activeTabState === 'published') && activeScheduleSubTab === 'full-schedule') ? e.target.value : e.target.value + '-01'); 
                setIsDateModalOpen(false); 
              } 
            }} 
            className={T.input} 
          />
          <button onClick={() => setIsDateModalOpen(false)} className={`w-full ${T.btn}`}>Close</button>
        </div>
      </Modal>


      <Modal isOpen={isWorkspaceSwitcherOpen} onClose={closeWorkspaceSwitcher} title="Switch Workspace">
        <div className="space-y-3">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 text-xs font-bold text-slate-300">
            One login can belong to more than one restaurant. Pick the workplace you are clocking in, scheduling, or managing right now.
          </div>
          {availableWorkspaces.map(workspace => {
            const selected = workspace.restaurantId === rId;
            return (
              <button
                key={workspace.restaurantId}
                type="button"
                onClick={() => selected ? setIsWorkspaceSwitcherOpen(false) : switchWorkspace(workspace)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${selected ? 'bg-[#D4A381]/10 border-[#D4A381] text-white' : 'bg-[#12161A] border-[#2A353D] text-slate-300 hover:border-[#D4A381]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-sm truncate">{safeWorkspaceName(workspace)}</div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 truncate">{workspace.role || 'Staff'}{workspace.isAdmin ? ' • Admin' : ''}</div>
                  </div>
                  {selected && <span className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">Current</span>}
                </div>
              </button>
            );
          })}
          <button type="button" onClick={closeWorkspaceSwitcher} className={`w-full ${T.btnAlt}`}>Close</button>
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

      <main className="app-content-shell native-console-content flex-1 max-w-[1480px] mx-auto w-full p-3 sm:p-5 lg:p-4 xl:p-5 pb-28">
        <span
          data-testid="manager-brief-math-summary-global"
          aria-label={globalManagerBriefMathText}
          className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden whitespace-nowrap"
        >
          {globalManagerBriefMathText}
        </span>
        <React.Suspense fallback={<RouteLoading />} >
          {renderMainContent()}
        </React.Suspense>
      </main>
      
      <div className="fixed top-20 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-2 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#1A2126] text-white p-3 rounded-xl shadow-2xl pointer-events-auto flex items-start gap-3 border border-[#2A353D] animate-toast">
            <div className="bg-[#12161A] p-1.5 rounded-full text-[#D4A381] mt-0.5 border border-[#2A353D]"><Bell size={16} /></div>
            <div className="flex-1"><h4 className="font-bold text-sm leading-tight">{t.title}</h4><p className="text-xs text-slate-300 font-medium mt-0.5">{t.message}</p>{t.reportable && <button type="button" onClick={() => openProblemReport({ title: t.title, message: t.message, category: 'Bug / Error' })} className="mt-2 text-[9px] font-black uppercase tracking-widest text-orange-300 hover:text-white">Report Problem</button>}</div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
      
      <div className="app-footer w-full flex items-center justify-center sm:justify-end gap-2 py-2 px-4 border-t z-10 mt-auto bg-[#161D22] border-[#2A353D]">
        <span className="text-slate-500 font-black text-[9px] tracking-widest uppercase">Version {CURRENT_VERSION}</span>
        <span className="text-slate-700 font-black text-[9px] tracking-widest uppercase">•</span>
        <span className="text-slate-600 font-black text-[9px] tracking-widest uppercase">Chilton App Works</span>
      </div>
    </div>
  );
}

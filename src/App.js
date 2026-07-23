import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertTriangle, Bell, BookOpen, Briefcase, Bug, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock, Database, DollarSign, HelpCircle, Home, Loader2, Lock, Menu, MessageSquare, Mic, Moon, MoreHorizontal, Package, Rocket, Search, Settings, Shield, Send, TrendingUp, Users, X } from 'lucide-react';
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
const TabMasterSchedule = lazyFeature(() => import('./features/reference'), 'ReferenceSchedule');
const TabSchedule = lazyFeature(() => import('./features/reference'), 'ReferenceSchedule');
const TabOpsCenter = lazyFeature(() => import('./features/reference'), 'ReferenceToday');
const TabToday = lazyFeature(() => import('./features/reference'), 'ReferenceToday');
const TabPrep = lazyFeature(() => import('./features/reference'), 'ReferencePrep');
const TabRecipes = lazyFeature(() => import('./features/reference'), 'ReferenceRecipes');
const TabMaintenance = lazyFeature(() => import('./features/operations'), 'TabMaintenance');
const TabInventory = lazyFeature(() => import('./features/reference'), 'ReferenceInventory');
const TabFinancials = lazyFeature(() => import('./features/reference'), 'ReferenceFinancials');
const TabBackOffice = lazyFeature(() => import('./features/reference'), 'ReferenceFinancials');
const TabMessages = lazyFeature(() => import('./features/reference'), 'ReferenceMessages');
const TabTeam = lazyFeature(() => import('./features/reference'), 'ReferenceTeam');
const TabSettings = lazyFeature(() => import('./features/reference'), 'ReferenceSettings');
const TabHelpCenter = lazyFeature(() => import('./features/management'), 'TabHelpCenter');
const TabGodMode = lazyFeature(() => import('./features/reference'), 'ReferenceSystemAdmin');
const TabAuditLog = lazyFeature(() => import('./features/management'), 'TabAuditLog');
const TabPersonalReminders = lazyFeature(() => import('./features/intelligence'), 'TabPersonalReminders');
const TabMenuIntelligence = lazyFeature(() => import('./features/intelligence'), 'TabMenuIntelligence');
const TabAITools = lazyFeature(() => import('./features/intelligence'), 'TabAITools');
const TabHrTraining = lazyFeature(() => import('./features/hr'), 'TabHrTraining');


class ChaosErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    try {
      console.error('86 Chaos UI failed safely:', error, info);
    } catch (_) {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error?.message || 'The app hit a display error while opening this screen.';
    return (
      <div className="chaos-runtime-fallback max-w-2xl mx-auto rounded-2xl border border-red-500/30 bg-[#11181E] p-5 sm:p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 h-11 w-11 rounded-xl border border-red-500/40 bg-red-950/20 flex items-center justify-center text-red-300">
          <AlertTriangle size={22} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">Screen failed safely</p>
        <h2 className="mt-2 text-xl font-black text-white">This screen failed to load, but the app shell is still running.</h2>
        <p className="mt-2 text-sm font-bold text-slate-400">{message}</p>
        <div className="mt-4 flex flex-col sm:flex-row justify-center gap-2">
          <button type="button" onClick={() => { window.location.href = '/?tab=today'; }} className={T.btn}>Go to Today</button>
          <button type="button" onClick={() => { window.location.reload(); }} className={T.btnAlt}>Reload App</button>
        </div>
      </div>
    );
  }
}

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
  const [activeAdminSection, setActiveAdminSection] = useState('overview');
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

  const canUseSystemAdmin = Boolean(
    liveAppUser?.isSuperAdmin === true ||
    serverSaysSuperAdmin ||
    (MASTER_ADMIN_EMAIL && (liveAppUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase())
  );

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
    if (tab !== 'godmode') setActiveAdminSection('overview');
    window.history.pushState({ tab }, '', `?tab=${tab}`); setActiveTabState(tab);
  };

  useEffect(() => {
    const handleAdminPanelAction = (event) => {
      if (activeTabState !== 'godmode') return;
      const detail = event?.detail || {};
      const text = `${detail.title || ''} ${detail.action || ''}`.toLowerCase();
      const nextSection = text.includes('workspace') || text.includes('client') ? 'workspaces'
        : text.includes('user') ? 'users'
        : text.includes('security') ? 'security'
        : text.includes('backup') || text.includes('restore') ? 'backup'
        : text.includes('push') ? 'push'
        : text.includes('forensic') || text.includes('audit') ? 'forensics'
        : text.includes('automation') || text.includes('ops intelligence') ? 'automation'
        : text.includes('support') || text.includes('diagnostic') ? 'support'
        : text.includes('retention') ? 'retention'
        : text.includes('access') ? 'access'
        : text.includes('deploy') || text.includes('readiness') || text.includes('feature flags') ? 'deployment'
        : text.includes('operation') || text.includes('summary') ? 'operations'
        : 'overview';
      setActiveAdminSection(nextSection);
      addToast?.('System Administrator', `Opened ${nextSection.replace(/-/g, ' ')}.`);
    };
    window.addEventListener('chaos-ref-panel-action', handleAdminPanelAction);
    return () => window.removeEventListener('chaos-ref-panel-action', handleAdminPanelAction);
  }, [activeTabState]);

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
  }, [activeTabState, canUseSystemAdmin]);


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
        pushTokenDedupeVersion: '15.0.104',
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
          pushTokenDedupeVersion: '15.0.104',
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
      { id: 'mobile-clock', label: 'Clock', Icon: Clock, route: 'published', badge: hasMyShiftAlert ? '!' : '' },
      { id: 'mobile-schedule', label: 'Schedule', Icon: CalendarDays, route: 'schedule', badge: '' },
      { id: 'prep', label: 'Prep', Icon: ClipboardList, badge: '' },
    ];
    return items.filter(item => {
      if (item.id === 'mobile-schedule' || item.id === 'mobile-clock') return displayClientFeatures?.schedule !== false;
      if (item.id === 'prep') return displayClientFeatures?.prep !== false;
      if (item.id === 'inventory') return displayClientFeatures?.inventory !== false;
      return true;
    });
  }, [displayClientFeatures, hasMyShiftAlert, needsEyesCount]);

  const NativeNavButton = ({ item, mode = 'mobile' }) => {
    const Icon = item.Icon;
    const targetTab = item.route || item.id;
    const active = item.id === 'mobile-clock'
      ? activeTabState === 'published'
      : item.id === 'mobile-schedule'
        ? ['schedule', 'events', 'month'].includes(activeTabState)
        : activeTabState === targetTab || activeTabState === item.id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(targetTab)}
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



  const referenceNavItems = useMemo(() => ([
    { id: 'today', label: 'Today', Icon: Home, route: 'today', badge: needsEyesCount > 0 ? String(Math.min(needsEyesCount, 9)) : '' },
    { id: 'published', label: 'Schedule', Icon: CalendarDays, route: 'published', badge: hasMyShiftAlert ? '!' : '' },
    { id: 'financials', label: 'Financials', Icon: DollarSign, route: 'financials', adminOrPerm: 'sales' },
    { id: 'inventory', label: 'Inventory', Icon: Package, route: 'inventory', feature: 'inventory' },
    { id: 'recipes', label: 'Recipes', Icon: BookOpen, route: 'recipes', feature: 'recipes' },
    { id: 'prep', label: 'Prep & Tasks', Icon: ClipboardList, route: 'prep', feature: 'prep' },
    { id: 'messages', label: 'Message Board', Icon: MessageSquare, route: 'messages', feature: 'messages', badge: hasUnreadMessages ? '!' : '' },
    { id: 'team', label: 'Staff Roster', Icon: Users, route: 'team' },
    { id: 'ai-tools', label: 'Voice Command', Icon: Mic, route: 'ai-tools' },
    { id: 'ops', label: 'Manager Brief', Icon: Rocket, route: 'ops' },
    { id: 'settings', label: 'Settings', Icon: Settings, route: 'settings' },
    { id: 'help', label: 'Help Center', Icon: HelpCircle, route: 'help' },
    { id: 'godmode', label: 'System Admin', Icon: Shield, route: 'godmode', superAdminOnly: true },
  ]).filter(item => {
    if (item.superAdminOnly) return canUseSystemAdmin;
    if (item.adminOnly) return liveAppUser?.isAdmin || liveAppUser?.isSuperAdmin || serverSaysSuperAdmin;
    if (item.feature && displayClientFeatures?.[item.feature] === false) return false;
    if (item.adminOrPerm) return liveAppUser?.isAdmin || liveAppUser?.isSuperAdmin || Boolean(liveAppUser?.permissions?.[item.adminOrPerm]) || serverSaysSuperAdmin;
    return true;
  }), [displayClientFeatures, hasMyShiftAlert, hasUnreadMessages, liveAppUser, needsEyesCount, serverSaysSuperAdmin, canUseSystemAdmin]);

  const adminReferenceNavItems = useMemo(() => ([
    { id: 'admin-exit', label: 'Exit to App', Icon: ChevronLeft, route: 'today', exitAdmin: true },
    { id: 'admin-overview', label: 'Overview', Icon: Home, route: 'godmode', section: 'overview' },
    { id: 'admin-workspaces', label: 'Workspaces', Icon: Briefcase, route: 'godmode', section: 'workspaces' },
    { id: 'admin-users', label: 'Global Users', Icon: Users, route: 'godmode', section: 'users' },
    { id: 'admin-security', label: 'Security Center', Icon: Shield, route: 'godmode', section: 'security' },
    { id: 'admin-backup', label: 'Backup Center', Icon: Database, route: 'godmode', section: 'backup' },
    { id: 'admin-push', label: 'Push Health', Icon: Send, route: 'godmode', section: 'push' },
    { id: 'admin-forensics', label: 'Forensics', Icon: Bug, route: 'godmode', section: 'forensics' },
    { id: 'admin-automation', label: 'Automation', Icon: Settings, route: 'godmode', section: 'automation' },
    { id: 'admin-support', label: 'Support', Icon: HelpCircle, route: 'godmode', section: 'support' },
    { id: 'admin-retention', label: 'Retention', Icon: ClipboardList, route: 'godmode', section: 'retention' },
    { id: 'admin-access', label: 'Access Control', Icon: Lock, route: 'godmode', section: 'access' },
    { id: 'admin-deployment', label: 'Deployment', Icon: Rocket, route: 'godmode', section: 'deployment' },
    { id: 'admin-operations', label: 'Operations', Icon: Settings, route: 'godmode', section: 'operations' },
  ]), []);

  const activeReferenceNavItems = activeTabState === 'godmode' && canUseSystemAdmin ? adminReferenceNavItems : referenceNavItems;

  const ReferenceSidebarButton = ({ item }) => {
    const Icon = item.Icon;
    const isAdminRail = activeTabState === 'godmode' && canUseSystemAdmin && String(item.id || '').startsWith('admin-');
    const active = isAdminRail
      ? (!item.exitAdmin && (item.section || 'overview') === activeAdminSection)
      : activeTabState === item.route || (item.route === 'published' && ['schedule','published','events','month'].includes(activeTabState)) || (item.route === 'schedule' && ['schedule','published','events','month'].includes(activeTabState));
    const handleClick = () => {
      if (isAdminRail && item.exitAdmin) { setActiveTab(item.route || 'today'); return; }
      if (isAdminRail) setActiveAdminSection(item.section || 'overview');
      setActiveTab(item.route);
    };
    return (
      <button type="button" onClick={handleClick} className={`reference-sidebar-link ${item.exitAdmin ? 'exit-admin' : ''} ${active ? 'active' : ''}`} title={item.label}>
        <Icon size={17} />
        <span>{item.label}</span>
        {item.badge && <b>{item.badge}</b>}
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
      'menu-intelligence': 'Menu Intelligence',
      'ai-tools': 'AI Tools',
      manuals: 'HR & Training',
      audit: 'Audit Log',
      godmode: 'System Administrator'
    };
    if (activeTabState === 'godmode' && !canUseSystemAdmin) return 'Access Required';
    return labels[activeTabState] || String(activeTabState || 'Today').replace(/[-_]/g, ' ');
  }, [activeTabState, canUseSystemAdmin]);

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
    if (activeTabState === 'schedule' && (liveAppUser?.isAdmin || liveAppUser?.permissions?.schedule)) return <TabMasterSchedule key={`schpub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} setCurrentDate={setCurrentDate} onSubTabChange={setActiveScheduleSubTab} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} sales={sales} timePunches={timePunches} addToast={addToast} initialSubTab="schedule-builder" voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} clientData={displayClientData} scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'events' && displayClientFeatures?.events !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.events || liveAppUser?.permissions?.schedule || liveAppUser?.permissions?.team)) return <TabSchedule key={`evt-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} events={events} sales={sales} timeOffRequests={timeOffRequests} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab="events" hideSubTabs />;
    if (activeTabState === 'published') return <TabMasterSchedule key={`pub-${rId}-${liveAppUser?.id}`} currentDate={currentDate} setCurrentDate={setCurrentDate} onSubTabChange={setActiveScheduleSubTab} appUser={liveAppUser} users={displayUsers} shifts={shifts} shiftSwaps={shiftSwaps} timeOffRequests={timeOffRequests} events={events} sales={sales} timePunches={timePunches} addToast={addToast} voiceScheduleSubTabTarget={voiceScheduleSubTabTarget} clientData={displayClientData} scheduleBuilderProps={{ currentDate, users: displayUsers, shifts, events, timeOffRequests, timePunches, addToast, appUser: liveAppUser, clientData: displayClientData }} />;
    if (activeTabState === 'ops' && displayClientFeatures?.ops !== false && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.ops)) return <TabOpsCenter key={`ops-${rId}`} currentDate={currentDate} appUser={liveAppUser} users={displayUsers} shifts={shifts} events={events} sales={sales} timePunches={timePunches} addToast={addToast} setActiveTab={setActiveTab} clientData={displayClientData} />;
    if (activeTabState === 'back-office' && !isDemoMode) return <TabBackOffice key={`bo-${rId}`} currentDate={currentDate} users={displayUsers} sales={sales} timePunches={timePunches} restaurantAdminAlerts={restaurantAdminAlerts} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} addToast={addToast} />;
    if ((activeTabState === 'financials' || activeTabState === 'sales' || activeTabState === 'labor') && (liveAppUser?.isSuperAdmin || liveAppUser?.isAdmin || liveAppUser?.permissions?.labor || liveAppUser?.permissions?.sales)) return <TabFinancials key={`fin-${rId}`} currentDate={currentDate} users={displayUsers} shifts={shifts} sales={sales} timePunches={timePunches} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} initialSubTab={activeTabState === 'sales' ? 'ledger' : activeTabState === 'labor' ? 'labor' : 'overview'} />;
    if (activeTabState === 'messages' && displayClientFeatures?.messages !== false) return <TabMessages key={`msg-${rId}`} events={events} appUser={liveAppUser} users={displayUsers} addToast={addToast} setActiveTab={setActiveTab} />;
    if (activeTabState === 'prep' && displayClientFeatures?.prep !== false) return <TabPrep key={`prp-${rId}`} currentDate={currentDate} appUser={liveAppUser} prepItems={prepItems} tasks={tasks} inventoryItems={inventoryItems} addToast={addToast} setLabelsToPrint={setLabelsToPrint} setActiveTab={setActiveTab} />;
    if (activeTabState === 'recipes' && displayClientFeatures?.recipes !== false) return <TabRecipes key={`rec-${rId}`} appUser={liveAppUser} addToast={addToast} voiceRecipeTarget={voiceRecipeTarget} setActiveTab={setActiveTab} />;
    if (activeTabState === 'inventory' && displayClientFeatures?.inventory !== false) return <TabInventory key={`inv-${rId}-${inventorySubTabTarget || 'default'}`} inventoryItems={inventoryItems} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} initialSubTab={inventorySubTabTarget} onInitialSubTabConsumed={() => setInventorySubTabTarget(null)} setActiveTab={setActiveTab} />;
    if (activeTabState === 'ai-tools' && !isDemoMode && (liveAppUser?.isAdmin || liveAppUser?.permissions?.inventory || liveAppUser?.permissions?.prep || liveAppUser?.permissions?.team)) return <TabAITools key={`ai-${rId}`} appUser={liveAppUser} clientData={displayClientData} setActiveTab={setActiveTab} setInventorySubTabTarget={setInventorySubTabTarget} addToast={addToast} />;
    if (activeTabState === 'menu-intelligence' && !isDemoMode) return <TabMenuIntelligence key={`mi-${rId}`} appUser={liveAppUser} clientData={displayClientData} inventoryItems={inventoryItems} addToast={addToast} />;
    if (activeTabState === 'reminders' && !isDemoMode) return <TabPersonalReminders key={`rem-${rId}-${liveAppUser?.id}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'team' && displayClientFeatures?.team !== false) return <TabTeam key={`tea-${rId}`} appUser={liveAppUser} users={displayUsers} clientData={displayClientData} addToast={addToast} />;
    if (activeTabState === 'hr-training' && !isDemoMode && displayClientFeatures?.hr !== false) return <TabHrTraining key={`hrt-${rId}-${liveAppUser?.id}`} appUser={liveAppUser} users={displayUsers} addToast={addToast} />;
    if (activeTabState === 'maintenance' && displayClientFeatures?.maintenance !== false && (liveAppUser?.isAdmin || liveAppUser?.permissions?.team)) return <TabMaintenance key={`mtn-${rId}`} appUser={liveAppUser} addToast={addToast} />;
    if (activeTabState === 'settings' && !isDemoMode) return <TabSettings key={`set-${rId}`} addToast={addToast} appUser={liveAppUser} clientData={displayClientData} users={displayUsers} />;
    if (activeTabState === 'help') return <TabHelpCenter key={`help-${rId}`} appUser={liveAppUser} activeTab={activeTabState} voiceHelpSearchTarget={voiceHelpSearchTarget} addToast={addToast} />;
    if (activeTabState === 'godmode' && canUseSystemAdmin) return <TabGodMode key={`god-${rId}`} appUser={{ ...liveAppUser, isSuperAdmin: true, serverAdminCheck }} addToast={addToast} setGhostTenant={setGhostTenant} setActiveTab={setActiveTab} activeAdminSection={activeAdminSection} setActiveAdminSection={setActiveAdminSection} />;
    if (activeTabState === 'godmode') return (
      <div className={`${T.card} p-5 sm:p-8 max-w-2xl mx-auto text-center space-y-4 border-red-900/40`}>
        <div className="mx-auto w-12 h-12 rounded-2xl bg-red-900/20 border border-red-900/50 flex items-center justify-center text-red-300 text-2xl">🔐</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300">Plan & Permission Gate</p>
          <h2 className="text-xl font-black text-white mt-2">Your role does not include this tool</h2>
          <p className="text-sm font-bold text-slate-400 mt-2">This internal area is not available to this account. Ask the account owner if you believe you should have access.</p>
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
  const maintenanceBypass = canUseSystemAdmin;
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
    <div style={appThemeStyle} onClickCapture={blockDemoMutation} onSubmitCapture={blockDemoMutation} className={`native-app-shell premium-app-shell serious-app-system-v104 exact-reference-ui-v108 reference-app-v151 desktop-pro-shell ui-v13-polished ui-v12-compact cockpit-shell ${activeTabState === 'godmode' ? '' : 'non-admin-controls-compact'} kitchen-simple-shell ui-density-${liveAppUser?.preferences?.uiDensity || displayClientData?.systemSettings?.uiDensity || 'compact'} recipe-density-${liveAppUser?.preferences?.recipeDensity || displayClientData?.systemSettings?.recipeCardDensity || 'tight'} motion-${liveAppUser?.preferences?.motionMode || displayClientData?.systemSettings?.cockpitLights || 'normal'} min-h-screen font-sans flex flex-col w-full max-w-[100vw] overflow-x-hidden ${T.bg}`}>
      
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


        /* 15.0.103 chrome purge: remove the remaining webpage-like chips, pills, and square icon backgrounds from navigation chrome. */
        .premium-app-shell .native-version-pill,
        .premium-app-shell .native-workspace-chip,
        .premium-app-shell .native-icon-button,
        .premium-app-shell .native-queue-button,
        .premium-app-shell .native-command-actions button,
        .premium-app-shell .app-header button,
        .premium-app-shell .app-header span.native-version-pill,
        .premium-app-shell .native-desktop-rail .native-nav-btn,
        .premium-app-shell .native-mobile-bottom-nav .native-nav-btn {
          background: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          backdrop-filter: none !important;
        }
        .premium-app-shell .native-icon-button,
        .premium-app-shell .native-command-actions button {
          width: auto !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
        }
        .premium-app-shell .native-desktop-rail .native-nav-btn:hover,
        .premium-app-shell .native-mobile-bottom-nav .native-nav-btn:hover,
        .premium-app-shell .native-desktop-rail .native-nav-btn.is-active,
        .premium-app-shell .native-mobile-bottom-nav .native-nav-btn.is-active {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }
        .premium-app-shell .app-drawer-readable button,
        .premium-app-shell .app-drawer-readable .drawer-icon-button,
        .premium-app-shell .app-drawer-readable [class*="rounded"],
        .premium-app-shell .app-drawer-readable [class*="bg-"],
        .premium-app-shell .app-drawer-readable [class*="border"] {
          background: transparent !important;
          background-image: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .premium-app-shell .app-drawer-readable button,
        .premium-app-shell .app-drawer-readable .drawer-icon-button {
          border-color: transparent !important;
        }
        .premium-app-shell .app-drawer-readable input {
          background: transparent !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        /* 15.0.104 Serious App Design System Cleanup
           A stricter operations-console layer: calmer surfaces, fewer decorative containers,
           better desktop fit, and app-like navigation without webpage chrome. */
        .serious-app-system-v104 {
          --ops-bg: #0B0F13;
          --ops-surface: #10161C;
          --ops-panel: #141B22;
          --ops-panel-2: #182129;
          --ops-border: rgba(122,139,154,.20);
          --ops-border-strong: rgba(122,139,154,.34);
          --ops-text: #F3F7FA;
          --ops-muted: #97A6B3;
          --ops-copper: var(--chaos-accent, #D4A381);
          background: var(--ops-bg) !important;
        }
        .serious-app-system-v104.native-app-shell,
        .serious-app-system-v104.cockpit-shell {
          background-image: none !important;
          background-color: var(--ops-bg) !important;
        }
        .serious-app-system-v104 .app-header.native-command-bar {
          height: 52px !important;
          background: #0B0F13 !important;
          border-bottom: 1px solid var(--ops-border) !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }
        .serious-app-system-v104 .native-command-separator {
          width: 1px;
          height: 28px;
          background: var(--ops-border) !important;
        }
        .serious-app-system-v104 .native-command-title > div:first-child {
          color: #667582 !important;
          letter-spacing: .18em !important;
        }
        .serious-app-system-v104 .native-command-title > div:last-child {
          color: var(--ops-text) !important;
          font-size: .92rem !important;
        }
        .serious-app-system-v104 .native-workspace-chip,
        .serious-app-system-v104 .native-version-pill,
        .serious-app-system-v104 .native-command-actions button,
        .serious-app-system-v104 .native-icon-button,
        .serious-app-system-v104 .native-queue-button {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
          backdrop-filter: none !important;
        }
        .serious-app-system-v104 .native-workspace-name,
        .serious-app-system-v104 .native-version-pill {
          color: #8E9CA8 !important;
          font-weight: 900 !important;
        }
        .serious-app-system-v104 .native-menu-button { color: var(--ops-copper) !important; }
        .serious-app-system-v104 .native-command-actions { gap: 16px !important; }
        .serious-app-system-v104 .native-desktop-rail {
          left: 0 !important;
          top: 52px !important;
          bottom: 0 !important;
          width: 72px !important;
          padding: 14px 0 !important;
          border: 0 !important;
          border-right: 1px solid var(--ops-border) !important;
          border-radius: 0 !important;
          background: #0C1116 !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          gap: 4px !important;
        }
        .serious-app-system-v104 .native-desktop-rail-divider {
          width: 38px !important;
          background: var(--ops-border) !important;
          margin: 7px 0 !important;
        }
        .serious-app-system-v104 .native-nav-btn {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #8996A3 !important;
          transition: color .14s ease !important;
        }
        .serious-app-system-v104 .native-nav-desktop {
          width: 72px !important;
          height: 58px !important;
          gap: 4px !important;
          font-size: 9px !important;
        }
        .serious-app-system-v104 .native-nav-btn:hover,
        .serious-app-system-v104 .native-nav-btn.is-active {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #FFFFFF !important;
        }
        .serious-app-system-v104 .native-nav-btn.is-active::before {
          content: '';
          position: absolute;
          left: 0 !important;
          top: 12px !important;
          bottom: 12px !important;
          width: 3px !important;
          border-radius: 0 !important;
          background: var(--ops-copper) !important;
        }
        .serious-app-system-v104 .native-mobile-bottom-nav {
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          min-height: 68px !important;
          border: 0 !important;
          border-top: 1px solid var(--ops-border) !important;
          border-radius: 0 !important;
          background: #0B0F13 !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          padding: 6px max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-right)) !important;
        }
        .serious-app-system-v104 .native-mobile-bottom-nav .native-nav-mobile {
          border-radius: 0 !important;
          min-height: 50px !important;
        }
        .serious-app-system-v104 .native-mobile-bottom-nav .native-nav-mobile.is-active::before {
          left: 24% !important;
          right: 24% !important;
          top: auto !important;
          bottom: 0 !important;
          height: 2px !important;
          width: auto !important;
        }
        @media (min-width: 768px) {
          .serious-app-system-v104 .app-content-shell {
            width: calc(100vw - 72px) !important;
            max-width: calc(100vw - 72px) !important;
            margin-left: 72px !important;
            padding: 16px 28px 22px 20px !important;
            overflow-x: hidden !important;
          }
          .serious-app-system-v104 .app-content-shell > * {
            max-width: 100% !important;
          }
        }
        @media (max-width: 767px) {
          .serious-app-system-v104 .app-content-shell {
            padding-bottom: 84px !important;
          }
        }
        .serious-app-system-v104 .app-footer {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          opacity: .68 !important;
          padding: 4px 12px !important;
        }
        .serious-app-system-v104 .chaos-card,
        .serious-app-system-v104 .cockpit-panel,
        .serious-app-system-v104 .app-content-shell .bg-\[\#1A2126\],
        .serious-app-system-v104 .app-content-shell .bg-\[\#12161A\],
        .serious-app-system-v104 .app-content-shell .bg-\[\#0B0E11\] {
          background: var(--ops-panel) !important;
          background-image: none !important;
          border-color: var(--ops-border) !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .app-content-shell .rounded-3xl,
        .serious-app-system-v104 .app-content-shell .rounded-2xl,
        .serious-app-system-v104 .chaos-card,
        .serious-app-system-v104 .cockpit-panel {
          border-radius: 10px !important;
        }
        .serious-app-system-v104 .app-content-shell .shadow-2xl,
        .serious-app-system-v104 .app-content-shell .shadow-xl,
        .serious-app-system-v104 .app-content-shell .shadow-lg,
        .serious-app-system-v104 .app-content-shell .shadow-md {
          box-shadow: none !important;
        }
        .serious-app-system-v104 .chaos-button-primary,
        .serious-app-system-v104 .app-content-shell .from-\[\#C59373\].to-\[\#8F6040\] {
          background: var(--ops-copper) !important;
          background-image: none !important;
          color: #0B0F13 !important;
          border: 0 !important;
          box-shadow: none !important;
          border-radius: 8px !important;
        }
        .serious-app-system-v104 .chaos-button-secondary,
        .serious-app-system-v104 .app-content-shell button.bg-\[\#12161A\] {
          background: transparent !important;
          border-color: var(--ops-border-strong) !important;
          color: #D8E1E8 !important;
          box-shadow: none !important;
          border-radius: 8px !important;
        }
        .serious-app-system-v104 .chaos-input,
        .serious-app-system-v104 .app-content-shell input,
        .serious-app-system-v104 .app-content-shell select,
        .serious-app-system-v104 .app-content-shell textarea {
          background: #0E141A !important;
          border-color: var(--ops-border-strong) !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          color: var(--ops-text) !important;
        }
        .serious-app-system-v104 .chaos-input:focus,
        .serious-app-system-v104 .app-content-shell input:focus,
        .serious-app-system-v104 .app-content-shell select:focus,
        .serious-app-system-v104 .app-content-shell textarea:focus {
          border-color: rgba(212,163,129,.60) !important;
          outline: 1px solid rgba(212,163,129,.22) !important;
          outline-offset: 1px !important;
        }
        .serious-app-system-v104 .text-slate-400,
        .serious-app-system-v104 .text-slate-500 {
          color: var(--ops-muted) !important;
        }
        .serious-app-system-v104 .native-route-loader {
          background: var(--ops-panel) !important;
          border-color: var(--ops-border) !important;
          box-shadow: none !important;
          border-radius: 10px !important;
          backdrop-filter: none !important;
        }
        .serious-app-system-v104 .native-loader-bar {
          background: rgba(212,163,129,.38) !important;
        }
        .serious-app-system-v104 .premium-inventory .inventory-subtabs {
          background: #0E141A !important;
          border: 1px solid var(--ops-border) !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .premium-inventory .inventory-count-row {
          min-height: 58px !important;
          border-radius: 8px !important;
          background: #111820 !important;
          border-color: var(--ops-border) !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .premium-inventory .inventory-count-row:hover {
          background: #151E27 !important;
          border-color: rgba(212,163,129,.32) !important;
        }
        .serious-app-system-v104 .premium-inventory .inventory-count-controls {
          background: transparent !important;
          border-color: var(--ops-border) !important;
          border-radius: 8px !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .premium-inventory .inventory-stepper-btn,
        .serious-app-system-v104 .premium-inventory .inventory-count-input {
          background: #0E141A !important;
          border-color: var(--ops-border) !important;
          border-radius: 7px !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .app-drawer-v104 > aside {
          background: #0B0F13 !important;
          border-left: 1px solid var(--ops-border) !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .app-drawer-v104 .drawer-menu-row,
        .serious-app-system-v104 .app-drawer-v104 .drawer-utility-row,
        .serious-app-system-v104 .app-drawer-v104 .drawer-close-button {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .serious-app-system-v104 .app-drawer-v104 .drawer-menu-row {
          position: relative;
          justify-content: flex-start !important;
          border-left: 2px solid transparent !important;
        }
        .serious-app-system-v104 .app-drawer-v104 .drawer-menu-row.is-active {
          border-left-color: var(--ops-copper) !important;
          color: white !important;
        }
        .serious-app-system-v104 .app-drawer-v104 .drawer-menu-row:hover {
          color: #FFFFFF !important;
        }
        .serious-app-system-v104 .app-drawer-v104 .drawer-active-bar {
          display: none !important;
        }
        .serious-app-system-v104 .app-drawer-v104 [class*="bg-"] {
          background-image: none !important;
        }
        .serious-app-system-v104 .app-drawer-v104 input {
          background: #0E141A !important;
          border: 1px solid var(--ops-border-strong) !important;
          border-radius: 8px !important;
        }

        .serious-app-system-v104 .app-drawer-v104 .drawer-backdrop-v104 {
          background: rgba(0,0,0,.55) !important;
          backdrop-filter: blur(2px) !important;
        }
        .serious-app-system-v104 .app-drawer-v104 > aside > div:first-child,
        .serious-app-system-v104 .app-drawer-v104 > aside > div:last-child {
          background: #0B0F13 !important;
          border-color: var(--ops-border) !important;
        }
        .serious-app-system-v104 .cockpit-grid {
          background-image: none !important;
        }




        /* 15.1.0 FULL REFERENCE UI REBUILD LAYER
           This is the global app shell and data-screen restyle based on the supplied reference images.
           It intentionally overrides the old website-like shell: desktop uses a full fixed sidebar,
           a compact command bar, dense grid panels, flatter dark surfaces, copper active states,
           and no decorative webpage bubbles/pills. */
        .reference-app-v151 {
          --ref151-bg: #071014;
          --ref151-sidebar: #081117;
          --ref151-panel: #10191f;
          --ref151-panel-2: #111d24;
          --ref151-panel-3: #0d171d;
          --ref151-line: rgba(136,153,166,.20);
          --ref151-line-2: rgba(136,153,166,.30);
          --ref151-text: #f2f5f7;
          --ref151-muted: #a3afb7;
          --ref151-faint: #6f7d86;
          --ref151-copper: #c47c3f;
          --ref151-copper-2: #8b512e;
          --ref151-green: #77b848;
          --ref151-red: #e04b3c;
          --ref151-yellow: #e1a33c;
          --ref151-blue: #4aa3d8;
          color: var(--ref151-text) !important;
          background: radial-gradient(circle at 72% -18%, rgba(42,80,92,.16), transparent 34rem), linear-gradient(180deg, #071014 0%, #05090d 100%) !important;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          letter-spacing: 0 !important;
        }
        .reference-app-v151 * { scrollbar-width: thin; scrollbar-color: rgba(196,124,63,.75) rgba(255,255,255,.04); }
        .reference-app-v151 ::-webkit-scrollbar { width: 8px; height: 8px; }
        .reference-app-v151 ::-webkit-scrollbar-track { background: rgba(255,255,255,.035); }
        .reference-app-v151 ::-webkit-scrollbar-thumb { background: rgba(196,124,63,.70); border-radius: 0; }
        @media (min-width: 900px) {
          .reference-app-v151 .reference-sidebar { display: flex !important; }
          .reference-app-v151 .native-desktop-rail { display: none !important; }
          .reference-app-v151 .native-mobile-bottom-nav { display: none !important; }
          .reference-app-v151 .app-header.native-command-bar {
            position: sticky !important;
            top: 0 !important;
            left: 248px !important;
            height: 70px !important;
            margin-left: 248px !important;
            width: calc(100vw - 248px) !important;
            padding: 0 22px !important;
            background: rgba(7,16,20,.985) !important;
            border: 0 !important;
            border-bottom: 1px solid var(--ref151-line) !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            z-index: 42 !important;
          }
          .reference-app-v151 .app-content-shell {
            margin-left: 248px !important;
            width: calc(100vw - 248px) !important;
            max-width: none !important;
            padding: 18px 22px 24px !important;
            overflow-x: hidden !important;
            box-sizing: border-box !important;
          }
          .reference-app-v151 .desktop-date-strip { margin-left: 248px !important; width: calc(100vw - 248px) !important; background: #071014 !important; border-color: var(--ref151-line) !important; box-shadow: none !important; }
        }
        @media (max-width: 899px) {
          .reference-app-v151 .reference-sidebar { display: none !important; }
          .reference-app-v151 .native-mobile-bottom-nav { display: grid !important; }
          .reference-app-v151 .app-header.native-command-bar {
            height: 58px !important;
            padding: 0 10px !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 8px !important;
            overflow: hidden !important;
          }
          .reference-app-v151 .native-command-left { gap: 8px !important; min-width: 0 !important; overflow: hidden !important; }
          .reference-app-v151 .reference-tool-dropdown {
            min-width: 0 !important;
            width: auto !important;
            max-width: 46vw !important;
            padding: 0 !important;
            border: 0 !important;
            background: transparent !important;
            gap: 7px !important;
          }
          .reference-app-v151 .reference-tool-dropdown svg:last-child { display: none !important; }
          .reference-app-v151 .reference-tool-dropdown div { min-width: 0 !important; }
          .reference-app-v151 .reference-tool-dropdown strong { display: block !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; font-size: 12px !important; }
          .reference-app-v151 .reference-tool-dropdown small { font-size: 9px !important; }
          .reference-app-v151 .reference-command-search {
            width: 34px !important;
            min-width: 34px !important;
            height: 34px !important;
            padding: 0 !important;
            justify-content: center !important;
            border: 0 !important;
            background: transparent !important;
          }
          .reference-app-v151 .reference-command-search input { display: none !important; }
          .reference-app-v151 .reference-command-search kbd { display: none !important; }
          .reference-app-v151 .native-command-actions { gap: 6px !important; min-width: 0 !important; }
          .reference-app-v151 .reference-top-action {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            padding: 0 !important;
            justify-content: center !important;
            border: 0 !important;
            background: transparent !important;
          }
          .reference-app-v151 .reference-top-action span { display: none !important; }
          .reference-app-v151 .native-icon-button { width: 34px !important; min-width: 34px !important; height: 34px !important; min-height: 34px !important; border: 0 !important; background: transparent !important; }
          .reference-app-v151 .reference-profile-button {
            width: 34px !important;
            min-width: 34px !important;
            height: 34px !important;
            padding: 0 !important;
            border: 0 !important;
            background: transparent !important;
          }
          .reference-app-v151 .reference-profile-button .avatar { width: 32px !important; height: 32px !important; font-size: 11px !important; }
          .reference-app-v151 .app-content-shell { width: 100% !important; margin-left: 0 !important; padding: 12px 12px 96px !important; overflow-x: hidden !important; }
          .reference-app-v151 .app-content-shell h1,
          .reference-app-v151 .app-content-shell .text-4xl,
          .reference-app-v151 .app-content-shell .text-3xl { font-size: 1.55rem !important; line-height: 1.8rem !important; letter-spacing: .12em !important; }
          .reference-app-v151 .app-content-shell .grid { grid-template-columns: 1fr !important; }
          .reference-app-v151 .app-content-shell button { max-width: 100% !important; }
        }
        .reference-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 248px;
          z-index: 60;
          background: linear-gradient(180deg, #081117 0%, #060b10 100%);
          border-right: 1px solid var(--ref151-line);
          display: none;
          flex-direction: column;
          padding: 16px 14px;
          overflow: hidden;
        }
        .reference-sidebar-logo { height: 54px; display: flex; align-items: center; border-bottom: 1px solid var(--ref151-line); margin-bottom: 10px; }
        .reference-sidebar-logo .brand-logo-stack img { max-height: 34px !important; width: auto !important; object-fit: contain !important; }
        .reference-sidebar-nav { display: grid; gap: 2px; overflow-y: auto; padding: 8px 0 10px; }
        .reference-app-v151 .reference-sidebar { width: 248px !important; }
        .reference-app-v151 .reference-sidebar-nav { gap: 1px !important; }
        .reference-app-v151 .reference-sidebar-link { min-height: 35px !important; font-size: 12.5px !important; letter-spacing: .01em !important; }
        .reference-app-v151 .reference-sidebar-link.active { background: rgba(196,124,63,.16) !important; border-color: rgba(196,124,63,.50) !important; }
        .reference-app-v151 .reference-sidebar-link b { border-radius: 3px !important; min-width: 18px !important; height: 18px !important; }
        .reference-sidebar-link {
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr) auto;
          align-items: center;
          gap: 11px;
          min-height: 38px;
          padding: 0 10px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--ref151-muted);
          text-align: left;
          font-size: 13px;
          font-weight: 650;
          border-radius: 4px;
          transition: background .13s ease, color .13s ease, border-color .13s ease;
        }
        .reference-sidebar-link svg { color: currentColor; opacity: .92; }
        .reference-sidebar-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .reference-sidebar-link b { min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: rgba(196,124,63,.78); color: #fff; font-size: 11px; }
        .reference-sidebar-link:hover { color: #fff; background: rgba(255,255,255,.035); }
        .reference-sidebar-link.active { color: #fff; background: linear-gradient(90deg, rgba(129,74,40,.62), rgba(81,48,32,.28)); border-color: rgba(196,124,63,.58); box-shadow: inset 3px 0 0 var(--ref151-copper); }
        .reference-sidebar-link.exit-admin { color:#f6c99d !important; border-color:rgba(196,124,63,.30) !important; background:rgba(196,124,63,.08) !important; margin-bottom:6px !important; }
        .reference-sidebar-foot { margin-top: auto; display: grid; gap: 10px; padding-top: 12px; border-top: 1px solid var(--ref151-line); }
        .reference-sidebar-card { border: 1px solid var(--ref151-line); background: rgba(255,255,255,.025); padding: 12px; border-radius: 5px; color: var(--ref151-muted); font-size: 12px; line-height: 1.35; }
        .reference-sidebar-card strong { display:block; color:#fff; font-size:13px; margin-bottom:4px; }
        .reference-sidebar-card .green { color: var(--ref151-green); font-weight: 800; }
        .reference-user-mini { display:grid; grid-template-columns: 34px 1fr; gap:10px; align-items:center; }
        .reference-user-mini span { width:34px; height:34px; border:1px solid var(--ref151-copper); color:#fff; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:900; }
        .reference-user-mini small { color: var(--ref151-muted); }
        .reference-app-v151 .native-command-left { gap: 18px !important; min-width: 0; }
        .reference-app-v151 .native-command-left .brand-logo-stack { display: none !important; }
        .reference-app-v151 .native-command-title { display: none !important; }
        .reference-app-v151 .reference-tool-dropdown,
        .reference-app-v151 .reference-command-search,
        .reference-app-v151 .reference-top-action,
        .reference-app-v151 .reference-profile-button {
          height: 42px;
          border: 1px solid var(--ref151-line-2);
          background: rgba(255,255,255,.018);
          color: var(--ref151-text);
          border-radius: 5px;
        }
        .reference-tool-dropdown { min-width: 210px; padding: 0 12px; display: flex; align-items: center; gap: 10px; }
        .reference-tool-dropdown strong { font-size: 13px; line-height: 1; }
        .reference-tool-dropdown small { display:block; color:var(--ref151-faint); font-size:10px; margin-top:3px; }
        .reference-command-search { width: min(420px, 32vw); padding: 0 12px; display: flex; align-items: center; gap: 11px; color: var(--ref151-faint); }
        .reference-command-search input { width: 100%; border: 0 !important; outline: 0 !important; background: transparent !important; color: var(--ref151-text) !important; font-size: 13px; padding: 0 !important; }
        .reference-command-search kbd { color: var(--ref151-faint); font-size: 11px; font-weight: 800; }
        .reference-app-v151 .native-command-actions { gap: 14px !important; }
        .reference-top-action { padding: 0 13px; display: inline-flex; align-items:center; gap:8px; color:#fff !important; font-weight:800; font-size:13px; }
        .reference-voice-action { min-width: 178px !important; height: 48px !important; padding: 0 18px !important; border-radius: 8px !important; border-color: rgba(196,124,63,.72) !important; background: linear-gradient(180deg, rgba(196,124,63,.42), rgba(143,96,64,.34)) !important; color: #fff4e8 !important; box-shadow: 0 0 0 1px rgba(196,124,63,.18), 0 12px 30px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.08) !important; font-size: 14px !important; }
        .reference-voice-action svg { width: 23px !important; height: 23px !important; color: #ffd1a3 !important; filter: drop-shadow(0 0 8px rgba(196,124,63,.55)); }
        .reference-voice-action:hover { transform: translateY(-1px); border-color: rgba(255,186,124,.9) !important; background: linear-gradient(180deg, rgba(214,148,88,.55), rgba(143,96,64,.42)) !important; }
        .reference-profile-button { display:flex; align-items:center; gap:10px; padding:0 2px 0 10px; border-color: transparent !important; background: transparent !important; }
        .reference-profile-button .avatar { width:36px; height:36px; border-radius:50%; border:1px solid var(--ref151-copper); display:flex; align-items:center; justify-content:center; font-weight:900; color:#fff; }
        .reference-profile-button strong { font-size: 13px; color:#fff; display:block; }
        .reference-profile-button small { color: var(--ref151-muted); display:block; font-size: 10px; margin-top:2px; }
        .reference-app-v151 .voice-floating-dock,
        .reference-app-v151 .voice-command-dock,
        .reference-app-v151 .quick-action-dock { display: none !important; }
        .reference-app-v151 .native-version-pill { display:none !important; }
        .reference-app-v151 .native-icon-button,
        .reference-app-v151 .native-menu-button,
        .reference-app-v151 .native-queue-button { color: var(--ref151-copper) !important; min-width: 30px !important; min-height: 30px !important; }
        .reference-app-v151 .app-content-shell > div,
        .reference-app-v151 .app-content-shell section,
        .reference-app-v151 .app-content-shell article,
        .reference-app-v151 .app-content-shell aside,
        .reference-app-v151 .app-content-shell form,
        .reference-app-v151 .app-content-shell .cockpit-panel,
        .reference-app-v151 .app-content-shell .admin108-panel {
          border-color: var(--ref151-line) !important;
          background: linear-gradient(180deg, rgba(17,29,36,.82), rgba(10,18,23,.82)) !important;
          box-shadow: none !important;
        }
        .reference-app-v151 .app-content-shell .rounded-3xl,
        .reference-app-v151 .app-content-shell .rounded-2xl,
        .reference-app-v151 .app-content-shell .rounded-xl { border-radius: 5px !important; }
        .reference-app-v151 .app-content-shell h1,
        .reference-app-v151 .app-content-shell h2 { letter-spacing: .16em !important; text-transform: uppercase !important; color: var(--ref151-text) !important; font-weight: 800 !important; }
        .reference-app-v151 .app-content-shell h3,
        .reference-app-v151 .app-content-shell h4 { color: var(--ref151-text) !important; font-weight: 800 !important; }
        .reference-app-v151 .app-content-shell p,
        .reference-app-v151 .app-content-shell small,
        .reference-app-v151 .app-content-shell span { border-radius: 3px; }
        .reference-app-v151 .app-content-shell input,
        .reference-app-v151 .app-content-shell select,
        .reference-app-v151 .app-content-shell textarea {
          background: rgba(3,10,14,.72) !important;
          border: 1px solid var(--ref151-line-2) !important;
          border-radius: 4px !important;
          color: var(--ref151-text) !important;
          box-shadow: none !important;
        }
        .reference-app-v151 .app-content-shell button {
          border-radius: 4px !important;
          box-shadow: none !important;
        }
        .reference-app-v151 .app-content-shell button:not(.reference-sidebar-link):not(.native-nav-btn) {
          border-color: rgba(196,124,63,.36) !important;
        }
        .reference-app-v151 .app-content-shell table,
        .reference-app-v151 .app-content-shell [role="table"] { border-collapse: collapse !important; }
        .reference-app-v151 .app-content-shell th,
        .reference-app-v151 .app-content-shell td { border-color: var(--ref151-line) !important; }
        .reference-app-v151 .app-footer { display:none !important; }



        /* 15.1.8 exact mockup dashboard layer */
        .reference-app-v151 .app-content-shell > .ref-screen {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .reference-app-v151 .ref-screen,
        .reference-app-v151 .ref-screen * { box-sizing: border-box; }
        .reference-app-v151 .ref-screen {
          --ref-panel-bg: linear-gradient(180deg, rgba(16,29,36,.94), rgba(8,16,21,.96));
          --ref-panel-flat: #0e181e;
          --ref-border: rgba(129,145,154,.22);
          --ref-border-strong: rgba(196,124,63,.38);
          --ref-text: #f3f7f9;
          --ref-muted: #9aa8b1;
          --ref-faint: #6f7d86;
          --ref-copper: #c47c3f;
          --ref-copper-dark: #77462b;
          --ref-green: #75b84a;
          --ref-yellow: #e0a33d;
          --ref-red: #ec5347;
          --ref-blue: #4ea6d8;
          display: grid;
          gap: 12px;
          color: var(--ref-text);
          width: 100%;
          min-width: 0;
        }
        .reference-app-v151 .ref-page-title {
          display:flex; justify-content:space-between; align-items:flex-end; gap:16px;
          min-height: 44px; padding: 0 2px 2px;
        }
        .reference-app-v151 .ref-page-title h1 {
          margin:0 !important; font-size: 19px !important; line-height: 1 !important; letter-spacing:.22em !important;
          text-transform:uppercase; font-weight: 800 !important; color: var(--ref-text) !important;
        }
        .reference-app-v151 .ref-page-title p { margin:5px 0 0 !important; color:var(--ref-muted) !important; font-size:12px !important; font-weight:600 !important; }
        .reference-app-v151 .ref-page-title > div > span { display:block; color:var(--ref-copper); text-transform:uppercase; letter-spacing:.18em; font-size:10px; font-weight:900; margin-bottom:5px; }
        .reference-app-v151 .ref-page-actions, .reference-app-v151 .ref-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
        .reference-app-v151 .ref-top-date,
        .reference-app-v151 .ref-actions button,
        .reference-app-v151 .ref-wide-action,
        .reference-app-v151 .ref-action-row,
        .reference-app-v151 .ref-screen button.primary {
          min-height:32px; border:1px solid var(--ref-border-strong) !important; border-radius:4px !important;
          background: linear-gradient(180deg, rgba(109,64,39,.48), rgba(65,37,24,.42)) !important;
          color:#f6c28c !important; padding:0 12px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; gap:7px;
        }
        .reference-app-v151 .ref-screen button.primary,
        .reference-app-v151 .ref-actions button.primary { background: linear-gradient(180deg, #9b613c, #603724) !important; color:#ffd3a8 !important; }
        .reference-app-v151 .ref-screen button.success { background: linear-gradient(180deg, rgba(76,132,54,.88), rgba(49,93,37,.88)) !important; color:white !important; border-color:rgba(117,184,74,.35) !important; }
        .reference-app-v151 .ref-screen button.danger,
        .reference-app-v151 .ref-wide-action.danger { background: rgba(112,35,31,.58) !important; color:#ff8a81 !important; border-color:rgba(236,83,71,.45) !important; }
        .reference-app-v151 .ref-metric-grid { display:grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap:8px; }
        .reference-app-v151 .ref-metric {
          min-height:86px; display:grid; grid-template-columns:40px minmax(0,1fr) 64px; align-items:center; gap:10px;
          border:1px solid var(--ref-border) !important; background: var(--ref-panel-bg) !important; border-radius:5px !important; padding:12px; overflow:hidden;
        }
        .reference-app-v151 .ref-metric-icon { width:38px; height:38px; border:1px solid rgba(196,124,63,.55); border-radius:50%; display:grid; place-items:center; color:var(--ref-copper); }
        .reference-app-v151 .ref-metric small { color:var(--ref-muted) !important; text-transform:uppercase; letter-spacing:.11em; font-size:9px !important; font-weight:800; display:block; }
        .reference-app-v151 .ref-metric strong { display:block; color:white; font-size:22px; line-height:1.05; font-weight:650; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .reference-app-v151 .ref-metric span.up { color:var(--ref-green); font-size:10px; font-weight:800; }
        .reference-app-v151 .ref-metric span.down { color:var(--ref-red); font-size:10px; font-weight:800; }
        .reference-app-v151 .ref-spark { display:flex; align-items:flex-end; gap:3px; height:44px; justify-content:flex-end; opacity:.68; }
        .reference-app-v151 .ref-spark i { width:4px; min-height:5px; background:var(--ref-green); border-radius:1px; }
        .reference-app-v151 .ref-spark.tone-copper i { background:var(--ref-copper); }
        .reference-app-v151 .ref-spark.tone-red i { background:var(--ref-red); }
        .reference-app-v151 .ref-spark.tone-yellow i { background:var(--ref-yellow); }
        .reference-app-v151 .ref-panel {
          background: var(--ref-panel-bg) !important; border:1px solid var(--ref-border) !important; border-radius:5px !important;
          box-shadow: none !important; overflow:hidden; min-width:0;
        }
        .reference-app-v151 .ref-panel-head { min-height:36px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 12px; border-bottom:1px solid var(--ref-border); }
        .reference-app-v151 .ref-panel-head > div { display:flex; align-items:center; gap:8px; min-width:0; color:var(--ref-copper); }
        .reference-app-v151 .ref-panel-head h3 { margin:0 !important; color:var(--ref-text) !important; text-transform:uppercase; letter-spacing:.11em; font-size:11px !important; font-weight:850 !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .reference-app-v151 .ref-panel-action { min-height:24px !important; padding:0 !important; border:0 !important; background:transparent !important; color:var(--ref-copper) !important; font-size:10px !important; font-weight:800; display:flex; align-items:center; gap:3px; white-space:nowrap; }
        .reference-app-v151 .ref-panel-body { padding:10px 12px; min-width:0; }
        .reference-app-v151 .ref-kv, .reference-app-v151 .ref-row, .reference-app-v151 .ref-alert-row { min-height:28px; display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:10px; border-bottom:1px solid rgba(129,145,154,.13); color:var(--ref-muted); font-size:12px; }
        .reference-app-v151 .ref-kv:last-child, .reference-app-v151 .ref-row:last-child, .reference-app-v151 .ref-alert-row:last-child { border-bottom:0; }
        .reference-app-v151 .ref-kv b, .reference-app-v151 .ref-row b, .reference-app-v151 .ref-alert-row b { color:var(--ref-text); font-weight:800; }
        .reference-app-v151 .ref-kv small, .reference-app-v151 .ref-row small { color:var(--ref-faint) !important; font-size:10px !important; }
        .reference-app-v151 .good, .reference-app-v151 .tone-green { color:var(--ref-green) !important; }
        .reference-app-v151 .warn, .reference-app-v151 .tone-yellow { color:var(--ref-yellow) !important; }
        .reference-app-v151 .bad, .reference-app-v151 .tone-red { color:var(--ref-red) !important; }
        .reference-app-v151 .tone-blue { color:var(--ref-blue) !important; }
        .reference-app-v151 .ref-status { min-height:19px; padding:2px 7px; border:1px solid currentColor; border-radius:4px !important; background:rgba(255,255,255,.03); font-size:10px !important; font-weight:850; color:var(--ref-green); white-space:nowrap; }
        .reference-app-v151 .ref-status.tone-yellow { color:var(--ref-yellow) !important; }
        .reference-app-v151 .ref-status.tone-red { color:var(--ref-red) !important; }
        .reference-app-v151 .ref-status.tone-blue { color:var(--ref-blue) !important; }
        .reference-app-v151 .ref-status.tone-slate { color:var(--ref-faint) !important; }
        .reference-app-v151 .ref-dot { width:9px; height:9px; border-radius:50%; background:var(--ref-green); display:inline-block; flex:0 0 auto; }
        .reference-app-v151 .ref-dot.tone-yellow { background:var(--ref-yellow); }
        .reference-app-v151 .ref-dot.tone-red { background:var(--ref-red); }
        .reference-app-v151 .ref-dot.tone-blue { background:var(--ref-blue); }
        .reference-app-v151 .ref-dot.tone-slate { background:var(--ref-faint); }
        .reference-app-v151 .ref-progress { height:8px; background:rgba(255,255,255,.08); border-radius:999px; overflow:hidden; min-width:48px; }
        .reference-app-v151 .ref-progress i { display:block; height:100%; background:var(--ref-green); }
        .reference-app-v151 .ref-progress i.tone-yellow { background:var(--ref-yellow); }
        .reference-app-v151 .ref-progress i.tone-red { background:var(--ref-red); }
        .reference-app-v151 .ref-table { display:grid; gap:0; min-width:0; overflow:auto; }
        .reference-app-v151 .ref-table .head, .reference-app-v151 .ref-table .tr { display:grid; align-items:center; gap:10px; min-height:31px; border-bottom:1px solid rgba(129,145,154,.14); padding:0 2px; font-size:11.5px; color:var(--ref-muted); }
        .reference-app-v151 .ref-table .head { color:var(--ref-faint); text-transform:uppercase; letter-spacing:.08em; font-size:9px; font-weight:900; }
        .reference-app-v151 .ref-table .tr > * { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .reference-app-v151 .ref-table.compact .head, .reference-app-v151 .ref-table.compact .tr { grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); }
        .reference-app-v151 .ref-table.inventory .head, .reference-app-v151 .ref-table.inventory .tr { grid-template-columns:1.5fr 1fr .65fr .55fr .55fr .8fr .9fr .8fr .8fr; min-width:780px; }
        .reference-app-v151 .ref-table.ledger .head, .reference-app-v151 .ref-table.ledger .tr { grid-template-columns:.75fr .75fr 1.35fr 1fr .75fr 1fr .8fr .8fr; min-width:760px; }
        .reference-app-v151 .ref-table.timesheets .head, .reference-app-v151 .ref-table.timesheets .tr { grid-template-columns:1.25fr .95fr .55fr .75fr .75fr .55fr .6fr .55fr .65fr .75fr .65fr .8fr; min-width:930px; }
        .reference-app-v151 .ref-table.roster .head, .reference-app-v151 .ref-table.roster .tr { grid-template-columns:1.4fr 1fr .8fr .9fr 1.4fr .8fr; }
        .reference-app-v151 .ref-donut { --donut-color: var(--ref-green); width:112px; height:112px; border-radius:50%; background:conic-gradient(var(--donut-color) 0 var(--value), rgba(255,255,255,.15) var(--value) 100%); position:relative; display:grid; place-items:center; flex:0 0 auto; }
        .reference-app-v151 .ref-donut::after { content:""; position:absolute; inset:22px; border-radius:50%; background:#0a151b; border:1px solid rgba(255,255,255,.04); }
        .reference-app-v151 .ref-donut strong, .reference-app-v151 .ref-donut span { position:relative; z-index:1; display:block; text-align:center; }
        .reference-app-v151 .ref-donut strong { align-self:end; font-size:24px; font-weight:650; color:white; }
        .reference-app-v151 .ref-donut span { align-self:start; color:var(--ref-muted) !important; font-size:10px !important; }
        .reference-app-v151 .ref-donut.tone-copper { --donut-color: var(--ref-copper); }
        .reference-app-v151 .ref-donut.tone-yellow { --donut-color: var(--ref-yellow); }
        .reference-app-v151 .ref-side-stat { display:grid; grid-template-columns:auto minmax(0,1fr); gap:14px; align-items:center; }
        .reference-app-v151 .ref-list { display:grid; gap:6px; }
        .reference-app-v151 .ref-list.tight { gap:0; }
        .reference-app-v151 .ref-tabs { display:flex; align-items:center; gap:3px; border-bottom:1px solid var(--ref-border); overflow-x:auto; }
        .reference-app-v151 .ref-tabs.top { margin-bottom:8px; }
        .reference-app-v151 .ref-tabs button { min-height:34px; border:0 !important; border-radius:0 !important; background:transparent !important; color:var(--ref-muted) !important; padding:0 14px; font-size:12px; font-weight:800; white-space:nowrap; }
        .reference-app-v151 .ref-tabs button.active { color:#f2b475 !important; box-shadow: inset 0 -2px 0 var(--ref-copper) !important; }
        .reference-app-v151 .ref-tabs span { flex:1; }
        .reference-app-v151 .ref-panel-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; color:var(--ref-muted); font-size:11px; }
        .reference-app-v151 .ref-panel-toolbar .search { min-width:220px; flex:1; display:flex; align-items:center; gap:8px; min-height:34px; border:1px solid var(--ref-border); background:#081218; border-radius:4px; padding:0 10px; }
        .reference-app-v151 .ref-panel-toolbar input { border:0 !important; background:transparent !important; min-height:0 !important; padding:0 !important; width:100%; }
        .reference-app-v151 .ref-screen select, .reference-app-v151 .ref-screen input, .reference-app-v151 .ref-screen textarea { min-height:32px !important; background:#081218 !important; border:1px solid var(--ref-border) !important; border-radius:4px !important; color:var(--ref-text) !important; padding:0 9px !important; font-size:12px !important; }
        .reference-app-v151 .ref-screen textarea { min-height:120px !important; padding:10px !important; }

        .reference-app-v151 .ref-today-grid { display:grid; grid-template-columns: 1.25fr 1.25fr .95fr; gap:10px; }
        .reference-app-v151 .ref-chart-line, .reference-app-v151 .ref-bar-chart { min-height:170px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; }
        .reference-app-v151 .ref-chart-line svg, .reference-app-v151 .ref-bar-chart svg { width:100%; height:100%; min-height:150px; overflow:visible; }
        .reference-app-v151 .ref-chart-line polyline, .reference-app-v151 .ref-bar-chart polyline { fill:none; stroke:var(--ref-copper); stroke-width:3; }
        .reference-app-v151 .ref-chart-line .ghost, .reference-app-v151 .ref-bar-chart .green { stroke:var(--ref-green); opacity:.75; }
        .reference-app-v151 .ref-coverage-chart { display:grid; gap:15px; }
        .reference-app-v151 .ref-coverage-row { display:grid; grid-template-columns:45px 1fr 40px; align-items:center; gap:10px; color:var(--ref-muted); font-size:12px; }
        .reference-app-v151 .ref-coverage-row div { height:32px; position:relative; background:repeating-linear-gradient(90deg, rgba(255,255,255,.055), rgba(255,255,255,.055) 1px, transparent 1px, transparent 48px), rgba(255,255,255,.04); }
        .reference-app-v151 .ref-coverage-row i { display:block; height:100%; background:linear-gradient(90deg, rgba(117,184,74,.85), rgba(117,184,74,.55)); }
        .reference-app-v151 .ref-coverage-row em { position:absolute; top:0; width:34px; height:100%; background:rgba(224,163,61,.85); }
        .reference-app-v151 .ref-legend { display:flex; flex-wrap:wrap; gap:13px; color:var(--ref-muted); font-size:11px; }
        .reference-app-v151 .ref-legend span { display:flex; align-items:center; gap:6px; }
        .reference-app-v151 .ref-prep-mini { display:grid; grid-template-columns:1fr 90px auto; gap:8px; align-items:center; min-height:24px; font-size:12px; color:var(--ref-muted); }
        .reference-app-v151 .ref-voice-quick div:last-child { display:flex; flex-wrap:wrap; gap:6px; }
        .reference-app-v151 .ref-voice-quick button { min-height:28px; padding:0 8px; font-size:10px; color:#f4b878 !important; background:rgba(196,124,63,.12) !important; border:1px solid rgba(196,124,63,.35) !important; }
        .reference-app-v151 .ref-mic-orb { width:78px; height:78px; margin:0 auto 8px; border-radius:50%; display:grid; place-items:center; color:#ffd1a3; background:radial-gradient(circle, rgba(196,124,63,.48), rgba(196,124,63,.08) 55%, transparent 56%); border:1px solid rgba(196,124,63,.55); }
        .reference-app-v151 .ref-mic-orb.large { width:134px; height:134px; }
        .reference-app-v151 .ref-message-preview, .reference-app-v151 .ref-note-card { border:1px solid rgba(196,124,63,.28); background:rgba(196,124,63,.08); padding:10px; border-radius:4px; margin-bottom:8px; }
        .reference-app-v151 .ref-message-preview b, .reference-app-v151 .ref-note-card b { display:block; color:white; margin-bottom:4px; }
        .reference-app-v151 .ref-message-preview p, .reference-app-v151 .ref-note-card p { margin:0 !important; color:var(--ref-muted) !important; font-size:12px !important; line-height:1.35; }

        .reference-app-v151 .ref-schedule-layout, .reference-app-v151 .ref-inventory-layout, .reference-app-v151 .ref-finance-layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:12px; }
        .reference-app-v151 .ref-schedule-main, .reference-app-v151 .ref-inventory-main, .reference-app-v151 .ref-finance-main { display:grid; gap:10px; min-width:0; }
        .reference-app-v151 .ref-right-rail { display:grid; gap:10px; align-content:start; min-width:0; }
        .reference-app-v151 .ref-filter-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; min-height:40px; color:var(--ref-muted); font-size:11px; }
        .reference-app-v151 .ref-filter-row label { display:flex; align-items:center; gap:8px; }
        .reference-app-v151 .ref-schedule-table { overflow:auto; border:1px solid var(--ref-border); background:#0a141a; }
        .reference-app-v151 .schedule-head, .reference-app-v151 .schedule-row, .reference-app-v151 .schedule-foot { min-width:980px; display:grid; grid-template-columns:180px 70px repeat(7, minmax(92px,1fr)) 74px; gap:1px; align-items:stretch; border-bottom:1px solid rgba(129,145,154,.16); }
        .reference-app-v151 .schedule-head > *, .reference-app-v151 .schedule-foot > * { padding:8px 8px; color:var(--ref-muted); font-size:11px; background:rgba(255,255,255,.025); }
        .reference-app-v151 .schedule-head b, .reference-app-v151 .schedule-foot b { color:var(--ref-text); font-size:11px; text-align:center; }
        .reference-app-v151 .schedule-head em, .reference-app-v151 .schedule-foot em { display:block; color:var(--ref-faint); font-style:normal; font-size:9px; margin-top:2px; }
        .reference-app-v151 .schedule-row .person { padding:6px 8px; display:grid; grid-template-columns:28px 1fr; gap:8px; align-items:center; }
        .reference-app-v151 .schedule-row .person i { grid-row:1/3; width:28px; height:28px; display:grid; place-items:center; background:rgba(255,255,255,.08); border:1px solid var(--ref-border); border-radius:50%; color:white; font-style:normal; }
        .reference-app-v151 .schedule-row .person strong { color:white; font-size:12px; }
        .reference-app-v151 .schedule-row .person small { color:var(--ref-muted); font-size:10px; }
        .reference-app-v151 .schedule-row > small, .reference-app-v151 .schedule-row > b { display:grid; place-items:center; color:var(--ref-muted); font-size:11px; }
        .reference-app-v151 .schedule-row button { margin:4px; min-height:31px; background:linear-gradient(180deg, rgba(83,139,61,.65), rgba(45,91,38,.70)) !important; border:1px solid rgba(117,184,74,.25) !important; color:white !important; font-size:12px; }
        .reference-app-v151 .schedule-row button.off { background:repeating-linear-gradient(135deg, rgba(88,42,33,.42), rgba(88,42,33,.42) 4px, rgba(16,29,36,.75) 4px, rgba(16,29,36,.75) 8px) !important; color:var(--ref-muted) !important; border-color:rgba(236,83,71,.28) !important; }
        .reference-app-v151 .schedule-row button.late { background:linear-gradient(180deg, rgba(196,124,63,.78), rgba(107,62,38,.80)) !important; }
        .reference-app-v151 .schedule-row button.open { background:rgba(29,68,93,.45) !important; border-color:rgba(78,166,216,.45) !important; }
        .reference-app-v151 .ref-schedule-bottom { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; }
        .reference-app-v151 .ref-next-shift { display:grid; gap:8px; }
        .reference-app-v151 .ref-next-shift .avatar { width:48px; height:48px; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.1); border:1px solid var(--ref-border); }
        .reference-app-v151 .ref-next-shift b, .reference-app-v151 .ref-next-shift strong { color:white; }
        .reference-app-v151 .ref-next-shift span, .reference-app-v151 .ref-next-shift small { color:var(--ref-muted); }
        .reference-app-v151 .ref-clock { display:grid; gap:9px; }
        .reference-app-v151 .ref-clock strong { font-size:29px; color:white; font-weight:400; }

        .reference-app-v151 .ref-prep-layout { display:grid; grid-template-columns:minmax(0,1fr) 290px 230px 190px; gap:10px; align-items:start; }
        .reference-app-v151 .ref-prep-main { display:grid; gap:10px; min-width:0; }
        .reference-app-v151 .ref-station-grid { display:grid; grid-template-columns:repeat(4,minmax(190px,1fr)); gap:8px; overflow:auto; }
        .reference-app-v151 .ref-station-card { border:1px solid var(--ref-border); background:rgba(255,255,255,.025); border-radius:4px; padding:8px; min-width:190px; }
        .reference-app-v151 .ref-station-card h4 { margin:0 0 8px !important; display:flex; justify-content:space-between; color:white !important; font-size:13px !important; }
        .reference-app-v151 .ref-station-card h4 span { color:var(--ref-green); }
        .reference-app-v151 .ref-station-card .head, .reference-app-v151 .prep-item { display:grid; grid-template-columns:minmax(0,1fr) 48px 58px 58px; gap:6px; min-height:25px; align-items:center; font-size:10px; color:var(--ref-muted); border-bottom:1px solid rgba(255,255,255,.05); }
        .reference-app-v151 .prep-item span { display:flex; align-items:center; gap:5px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .reference-app-v151 .ref-task-lanes { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        .reference-app-v151 .ref-task-lane { border:1px solid var(--ref-border); background:rgba(255,255,255,.02); border-radius:4px; padding:8px; }
        .reference-app-v151 .ref-task-lane h4 { margin:0 0 8px !important; display:flex; justify-content:space-between; text-transform:uppercase; letter-spacing:.08em; color:white !important; font-size:12px !important; }
        .reference-app-v151 .task-card { min-height:54px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); border-radius:4px; padding:7px; margin-bottom:6px; display:grid; gap:2px; font-size:12px; }
        .reference-app-v151 .task-card span { color:white; }
        .reference-app-v151 .task-card small { color:var(--ref-muted) !important; }
        .reference-app-v151 .ref-three-cards { display:grid; grid-template-columns:1fr 1.25fr 1fr; gap:10px; }
        .reference-app-v151 .ref-alert-stack { display:grid; gap:6px; }
        .reference-app-v151 .ref-alert-card { min-height:57px; display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:8px; align-items:center; border:1px solid rgba(236,83,71,.22); background:rgba(255,255,255,.035); padding:8px; border-radius:4px; color:var(--ref-red); }
        .reference-app-v151 .ref-alert-card.small { min-height:44px; }
        .reference-app-v151 .ref-alert-card b { color:white; display:block; font-size:12px; }
        .reference-app-v151 .ref-alert-card span { color:var(--ref-muted); display:block; font-size:11px; }
        .reference-app-v151 .ref-alert-card em { color:var(--ref-faint); font-size:10px; font-style:normal; }
        .reference-app-v151 .ref-big-voice { text-align:center; display:grid; gap:8px; }
        .reference-app-v151 .ref-big-voice h4 { margin:10px 0 0 !important; color:white !important; text-align:left; text-transform:uppercase; letter-spacing:.08em; font-size:11px !important; }
        .reference-app-v151 .ref-big-voice .ref-row { text-align:left; }
        .reference-app-v151 .ref-big-voice button { width:100%; justify-content:flex-start; min-height:31px; background:rgba(255,255,255,.05) !important; color:var(--ref-muted) !important; border-color:rgba(255,255,255,.08) !important; margin-top:3px; }

        .reference-app-v151 .ref-inventory-mid { display:grid; grid-template-columns:1.25fr .9fr .9fr 1fr; gap:10px; }
        .reference-app-v151 .ref-upload-zone { min-height:92px; border:1px dashed rgba(129,145,154,.45); border-radius:4px; display:grid; place-items:center; align-content:center; gap:5px; color:var(--ref-muted); background:rgba(255,255,255,.02); text-align:center; padding:14px; }
        .reference-app-v151 .ref-upload-zone.small { min-height:108px; }
        .reference-app-v151 .ref-upload-zone b { color:white; }
        .reference-app-v151 .ref-kpi-trip { display:grid; grid-template-columns:repeat(3,1fr); gap:0; border:1px solid var(--ref-border); }
        .reference-app-v151 .ref-kpi-trip.big { grid-template-columns:repeat(4,1fr); }
        .reference-app-v151 .ref-kpi-trip div { padding:12px; border-right:1px solid var(--ref-border); }
        .reference-app-v151 .ref-kpi-trip div:last-child { border-right:0; }
        .reference-app-v151 .ref-kpi-trip b { display:block; color:white; font-size:22px; }
        .reference-app-v151 .ref-kpi-trip span, .reference-app-v151 .ref-kpi-trip small { display:block; color:var(--ref-muted); font-size:10px; text-transform:uppercase; letter-spacing:.08em; }
        .reference-app-v151 .ref-ordering { display:grid; grid-template-columns:minmax(0,1fr) 260px; gap:10px; }
        .reference-app-v151 .ref-order-total { border:1px solid var(--ref-border); background:rgba(255,255,255,.025); padding:14px; display:grid; gap:8px; align-content:center; }
        .reference-app-v151 .ref-order-total b { color:white; font-size:24px; }

        .reference-app-v151 .ref-recipes-layout { display:grid; grid-template-columns: 500px minmax(0,1fr) 360px; gap:10px; }
        .reference-app-v151 .ref-recipe-list { display:grid; gap:6px; }
        .reference-app-v151 .ref-recipe-list button { display:grid; grid-template-columns:54px minmax(0,1fr) 76px 62px 24px; gap:9px; align-items:center; min-height:66px; border:1px solid transparent !important; background:transparent !important; color:var(--ref-muted) !important; text-align:left; }
        .reference-app-v151 .ref-recipe-list button.active { background:rgba(196,124,63,.08) !important; border-color:rgba(196,124,63,.32) !important; }
        .reference-app-v151 .ref-recipe-list .thumb, .reference-app-v151 .ref-recipe-hero .photo { width:50px; height:50px; display:grid; place-items:center; border:1px solid var(--ref-border); background:rgba(255,255,255,.08); border-radius:5px; font-size:28px; }
        .reference-app-v151 .ref-recipe-list b { color:white; display:block; }
        .reference-app-v151 .ref-recipe-list small, .reference-app-v151 .ref-recipe-list em { color:var(--ref-muted); font-style:normal; font-size:11px; }
        .reference-app-v151 .ref-recipe-list strong { justify-self:end; }
        .reference-app-v151 .ref-recipe-detail { display:grid; gap:10px; min-width:0; }
        .reference-app-v151 .ref-recipe-hero { display:grid; grid-template-columns:130px minmax(0,1fr) 210px; gap:14px; align-items:start; border:1px solid var(--ref-border) !important; background:var(--ref-panel-bg) !important; padding:12px; border-radius:5px !important; }
        .reference-app-v151 .ref-recipe-hero .photo { width:130px; height:116px; font-size:64px; }
        .reference-app-v151 .ref-recipe-hero h2 { margin:0 0 4px !important; color:white !important; font-size:22px !important; letter-spacing:0 !important; text-transform:none !important; }
        .reference-app-v151 .ref-cost-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:0; border-left:1px solid var(--ref-border); }
        .reference-app-v151 .ref-cost-strip div { padding:0 10px; border-right:1px solid var(--ref-border); }
        .reference-app-v151 .ref-dependency { display:grid; grid-template-columns:1fr 1.2fr 1fr; gap:8px; align-items:center; }
        .reference-app-v151 .ref-dependency span { display:block; border:1px solid rgba(196,124,63,.35); color:var(--ref-muted); padding:5px 7px; margin:5px 0; border-radius:4px; font-size:10px; }
        .reference-app-v151 .ref-dependency b { border:1px solid var(--ref-copper); color:white; padding:14px; border-radius:999px; text-align:center; font-size:12px; }
        .reference-app-v151 .ref-dependency small { display:block; color:var(--ref-muted) !important; font-size:9px !important; }
        .reference-app-v151 .ref-ai-card { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.035); padding:9px; border-radius:4px; margin-bottom:8px; display:grid; gap:4px; }
        .reference-app-v151 .ref-ai-card b { color:white; }
        .reference-app-v151 .ref-ai-card p { margin:0 !important; color:var(--ref-muted) !important; font-size:11px !important; }
        .reference-app-v151 .ref-alert-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
        .reference-app-v151 .ref-alert-strip > div { border:1px solid rgba(224,163,61,.55); background:rgba(224,163,61,.05); padding:12px; border-radius:4px; display:grid; gap:4px; color:var(--ref-yellow); }
        .reference-app-v151 .ref-alert-strip > div.critical { border-color:rgba(236,83,71,.65); color:var(--ref-red); }
        .reference-app-v151 .ref-alert-strip > div.info { border-color:rgba(78,166,216,.65); color:var(--ref-blue); }

        .reference-app-v151 .ref-finance-top { display:grid; grid-template-columns:1.55fr 1fr .75fr; gap:10px; }
        .reference-app-v151 .ref-sales-aside { display:grid; align-content:center; gap:2px; width:90px; }
        .reference-app-v151 .ref-sales-aside b { color:white; }
        .reference-app-v151 .ref-sales-aside span { color:var(--ref-muted); font-size:10px; }
        .reference-app-v151 .ref-total-line { display:flex; justify-content:space-between; padding:12px 2px; color:white; font-weight:800; }
        .reference-app-v151 .ref-hours-row { display:grid; grid-template-columns:1fr 110px 60px; align-items:center; gap:8px; min-height:27px; color:var(--ref-muted); font-size:12px; }
        .reference-app-v151 .ref-action-row { width:100%; justify-content:space-between !important; margin-top:6px; }

        .reference-app-v151 .ref-settings-layout { display:grid; grid-template-columns:270px minmax(0,1fr); gap:0; border:1px solid var(--ref-border); background:rgba(255,255,255,.015); }
        .reference-app-v151 .ref-settings-menu { border-right:1px solid var(--ref-border); padding:20px; display:grid; align-content:start; gap:7px; }
        .reference-app-v151 .ref-settings-menu button { display:grid; grid-template-columns:22px 1fr; gap:12px; align-items:center; min-height:46px; text-align:left; border:1px solid transparent !important; background:transparent !important; color:var(--ref-muted) !important; padding:0 12px; }
        .reference-app-v151 .ref-settings-menu button svg { width:18px; color:var(--ref-copper); }
        .reference-app-v151 .ref-settings-menu button.active { color:white !important; border-color:rgba(196,124,63,.55) !important; background:linear-gradient(90deg, rgba(114,66,41,.45), rgba(62,37,25,.24)) !important; }
        .reference-app-v151 .ref-settings-main { padding:22px; display:grid; gap:8px; }
        .reference-app-v151 .ref-setting-row { display:grid; grid-template-columns:210px minmax(0,1fr) 230px; gap:18px; align-items:center; min-height:70px; border:1px solid var(--ref-border) !important; background:var(--ref-panel-bg) !important; padding:12px 18px; border-radius:5px !important; }
        .reference-app-v151 .ref-setting-row.tall { grid-template-columns:210px 320px 170px minmax(160px,1fr) minmax(160px,1fr); align-items:start; }
        .reference-app-v151 .ref-setting-row h3 { margin:0 0 4px !important; color:white !important; text-transform:uppercase; letter-spacing:.14em; font-size:12px !important; }
        .reference-app-v151 .ref-setting-row p { margin:0 !important; color:var(--ref-muted) !important; font-size:12px !important; line-height:1.35; }
        .reference-app-v151 .ref-setting-content { display:flex; align-items:center; gap:18px; flex-wrap:wrap; color:var(--ref-muted); font-size:12px; }
        .reference-app-v151 .ref-setting-row label { display:grid; gap:6px; color:var(--ref-muted); font-size:11px; }
        .reference-app-v151 .ref-setting-row label input { width:100%; }
        .reference-app-v151 .ref-setting-row > button { justify-self:end; min-width:170px; }

        .reference-app-v151 .ref-admin-layout { display:grid; grid-template-columns:minmax(0,1fr) 285px; gap:10px; }
        .reference-app-v151 .ref-admin-layout main { display:grid; gap:10px; min-width:0; }
        .reference-app-v151 .ref-admin-top { display:grid; grid-template-columns:1.35fr 1fr 1fr; gap:10px; }
        .reference-app-v151 .ref-admin-mid { display:grid; grid-template-columns:.95fr .95fr 1.35fr 1fr; gap:10px; }
        .reference-app-v151 .ref-admin-bottom { display:grid; grid-template-columns:1.4fr 1fr .85fr; gap:10px; }
        .reference-app-v151 .ref-admin-section-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .reference-app-v151 .ref-admin-section-grid { display:grid; grid-template-columns:.75fr 1.25fr .85fr; gap:10px; }
        .reference-app-v151 .reference-admin-exit-action { color:#f6c99d !important; border-color:rgba(196,124,63,.38) !important; background:rgba(196,124,63,.08) !important; }
        .reference-app-v151 .ref-timeline { display:grid; gap:0; }
        .reference-app-v151 .ref-timeline div { min-height:31px; display:grid; grid-template-columns:12px minmax(0,1fr) auto; gap:8px; align-items:center; border-bottom:1px solid rgba(255,255,255,.06); font-size:11px; }
        .reference-app-v151 .ref-timeline i { width:8px; height:8px; border-radius:50%; background:var(--ref-green); }
        .reference-app-v151 .ref-timeline b { color:white; }
        .reference-app-v151 .ref-timeline span { color:var(--ref-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .reference-app-v151 .ref-timeline small { grid-column:2 / 4; color:var(--ref-faint) !important; margin-top:-8px; }

        .reference-app-v151 .ref-message-layout { display:grid; grid-template-columns:1.3fr 1fr .9fr; gap:10px; }

        @media (max-width: 1500px) {
          .reference-app-v151 .ref-metric-grid { grid-template-columns: repeat(3, minmax(160px, 1fr)); }
          .reference-app-v151 .ref-today-grid, .reference-app-v151 .ref-finance-top { grid-template-columns: 1fr 1fr; }
          .reference-app-v151 .ref-prep-layout { grid-template-columns: minmax(0,1fr) 280px; }
          .reference-app-v151 .ref-voice-panel, .reference-app-v151 .ref-manager-panel { grid-column:auto; }
          .reference-app-v151 .ref-recipes-layout { grid-template-columns: 420px minmax(0,1fr); }
          .reference-app-v151 .ref-right-rail.recipes { grid-column: 1 / -1; grid-template-columns: repeat(3,1fr); display:grid; }
        }
        @media (max-width: 1180px) {
          .reference-app-v151 .ref-schedule-layout, .reference-app-v151 .ref-inventory-layout, .reference-app-v151 .ref-finance-layout, .reference-app-v151 .ref-admin-layout { grid-template-columns: 1fr; }
          .reference-app-v151 .ref-right-rail, .reference-app-v151 .ref-right-rail.inventory, .reference-app-v151 .ref-right-rail.finance, .reference-app-v151 .ref-right-rail.admin { grid-template-columns: repeat(3, minmax(0,1fr)); display:grid; }
          .reference-app-v151 .ref-inventory-mid, .reference-app-v151 .ref-schedule-bottom, .reference-app-v151 .ref-admin-mid { grid-template-columns:1fr 1fr; }
          .reference-app-v151 .ref-recipes-layout { grid-template-columns:1fr; }
          .reference-app-v151 .ref-right-rail.recipes { grid-template-columns:1fr; }
          .reference-app-v151 .ref-settings-layout { grid-template-columns:1fr; }
          .reference-app-v151 .ref-settings-menu { border-right:0; border-bottom:1px solid var(--ref-border); grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width: 899px) {
          .reference-app-v151 .ref-page-title { align-items:flex-start; flex-direction:column; }
          .reference-app-v151 .ref-metric-grid, .reference-app-v151 .ref-today-grid, .reference-app-v151 .ref-schedule-bottom, .reference-app-v151 .ref-inventory-mid, .reference-app-v151 .ref-finance-top, .reference-app-v151 .ref-prep-layout, .reference-app-v151 .ref-three-cards, .reference-app-v151 .ref-task-lanes, .reference-app-v151 .ref-admin-top, .reference-app-v151 .ref-admin-mid, .reference-app-v151 .ref-admin-bottom, .reference-app-v151 .ref-message-layout, .reference-app-v151 .ref-right-rail, .reference-app-v151 .ref-right-rail.inventory, .reference-app-v151 .ref-right-rail.finance, .reference-app-v151 .ref-right-rail.admin { grid-template-columns:1fr !important; }
          .reference-app-v151 .ref-metric { grid-template-columns:38px minmax(0,1fr); }
          .reference-app-v151 .ref-metric .ref-spark { display:none; }
          .reference-app-v151 .ref-panel-body { padding:9px; }
          .reference-app-v151 .ref-page-title h1 { font-size:16px !important; }
          .reference-app-v151 .ref-station-grid { grid-template-columns:1fr; overflow:visible; }
          .reference-app-v151 .ref-setting-row, .reference-app-v151 .ref-setting-row.tall { grid-template-columns:1fr !important; }
          .reference-app-v151 .ref-setting-row > button { justify-self:stretch; }
          .reference-app-v151 .ref-settings-main { padding:12px; }
          .reference-app-v151 .ref-settings-menu { grid-template-columns:1fr; padding:12px; }
          .reference-app-v151 .ref-ordering, .reference-app-v151 .ref-side-stat, .reference-app-v151 .ref-recipe-hero, .reference-app-v151 .ref-kpi-trip, .reference-app-v151 .ref-kpi-trip.big, .reference-app-v151 .ref-alert-strip, .reference-app-v151 .ref-dependency { grid-template-columns:1fr !important; }
          .reference-app-v151 .ref-screen { gap:10px; }
        }

        /* Reference login/workspace picker reshape */
        .chaos-login-screen { background-image: none !important; background: #071014 !important; padding: 24px !important; display: grid !important; place-items: center !important; }
        .chaos-login-screen > .absolute { display:none !important; }
        .chaos-login-card { width: min(96vw, 1760px) !important; max-width: none !important; min-height: min(880px, calc(100vh - 48px)) !important; display: grid !important; grid-template-columns: minmax(360px, 520px) minmax(420px, 1fr) minmax(340px, 500px) !important; align-items: start !important; gap: 44px !important; padding: 72px 60px !important; border-radius: 10px !important; background: linear-gradient(180deg, rgba(14,25,31,.96), rgba(6,12,16,.96)) !important; border: 1px solid var(--ref151-line) !important; box-shadow: none !important; }
        .chaos-login-logo { grid-column: 1 !important; width: 340px !important; height: auto !important; max-height: 116px !important; background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 0 34px !important; justify-self: start !important; }
        .chaos-login-card form { grid-column: 1 !important; width: 100% !important; align-self: start !important; }
        .chaos-login-card form::before { content: 'Welcome back'; display:block; color:#fff; font-size:24px; font-weight:800; margin-bottom:10px; }
        .chaos-login-card form::after { content: 'System Status  •  All Systems Operational'; display:block; margin-top:26px; padding-top:24px; border-top:1px solid var(--ref151-line); color: var(--ref151-green); font-size:13px; }
        .chaos-login-card input { text-align:left !important; height:54px !important; border-radius:5px !important; background:#091116 !important; border:1px solid var(--ref151-line-2) !important; padding:0 14px !important; }
        .chaos-login-card button[type="submit"] { height:56px !important; border-radius:5px !important; background: linear-gradient(180deg, #b8794c, #7c4629) !important; color:#fff !important; font-size:15px !important; letter-spacing:0 !important; text-transform:none !important; }
        @media (max-width: 980px) { .chaos-login-card { grid-template-columns: 1fr !important; padding: 34px 22px !important; } .chaos-login-logo { width: 260px !important; } }

        /* 15.1.9 pixel-lock pass: tighter 1672px mockup proportions, admin rail swap, image-backed recipe cards. */
        .reference-app-v151 { --ref151-sidebar-w: 188px; --ref151-header-h: 64px; --ref151-panel: #0d181e; --ref151-panel-2:#0b151a; --ref151-line: rgba(117,135,145,.24); --ref151-line-2: rgba(117,135,145,.34); --ref151-copper:#bd743d; --ref151-copper-hot:#e19858; --ref151-green:#74b84c; }
        @media (min-width: 900px) {
          .reference-app-v151 .reference-sidebar { width: var(--ref151-sidebar-w) !important; padding: 15px 12px !important; }
          .reference-app-v151 .reference-sidebar-logo { height: 52px !important; margin-bottom: 8px !important; }
          .reference-app-v151 .reference-sidebar-logo .brand-logo-stack img { max-height: 38px !important; max-width: 148px !important; }
          .reference-app-v151 .reference-sidebar-link { min-height: 37px !important; padding: 0 9px !important; grid-template-columns: 20px minmax(0,1fr) auto !important; gap: 9px !important; font-size: 12.3px !important; }
          .reference-app-v151 .app-header.native-command-bar { left: var(--ref151-sidebar-w) !important; margin-left: var(--ref151-sidebar-w) !important; width: calc(100vw - var(--ref151-sidebar-w)) !important; height: var(--ref151-header-h) !important; padding: 0 18px !important; }
          .reference-app-v151 .app-content-shell { margin-left: var(--ref151-sidebar-w) !important; width: calc(100vw - var(--ref151-sidebar-w)) !important; padding: 14px 18px 18px !important; }
          .reference-app-v151 .desktop-date-strip { margin-left: var(--ref151-sidebar-w) !important; width: calc(100vw - var(--ref151-sidebar-w)) !important; }
        }
        .reference-app-v151 .reference-sidebar-card { border-radius: 6px !important; background: rgba(9,17,22,.82) !important; padding: 11px !important; font-size: 11.5px !important; }
        .reference-app-v151 .reference-sidebar-card.system-admin-foot small { display:block; color:var(--ref151-copper-hot) !important; text-transform:uppercase; letter-spacing:.08em; font-weight:900; margin-bottom:4px; }
        .reference-app-v151 .reference-sidebar-card.system-admin-foot strong { font-size:12px !important; }
        .reference-app-v151 .ref-screen { gap: 9px !important; }
        .reference-app-v151 .ref-page-title { min-height: 40px !important; }
        .reference-app-v151 .ref-page-title h1 { font-size: 18px !important; letter-spacing: .24em !important; }
        .reference-app-v151 .ref-page-title p { font-size: 11.5px !important; margin-top: 4px !important; }
        .reference-app-v151 .ref-metric-grid { grid-template-columns: repeat(6, minmax(132px, 1fr)) !important; gap: 8px !important; }
        .reference-app-v151 .ref-metric { min-height: 78px !important; grid-template-columns: 38px minmax(0,1fr) 54px !important; padding: 10px !important; border-color: rgba(117,135,145,.26) !important; }
        .reference-app-v151 .ref-metric-icon { width: 36px !important; height: 36px !important; border-radius: 50% !important; color: var(--ref151-copper-hot) !important; }
        .reference-app-v151 .ref-metric strong { font-size: 19px !important; font-weight: 650 !important; }
        .reference-app-v151 .ref-metric small { font-size: 8.5px !important; }
        .reference-app-v151 .ref-spark { height: 36px !important; }
        .reference-app-v151 .ref-panel { border-radius: 6px !important; background: linear-gradient(180deg, rgba(13,25,31,.97), rgba(8,16,21,.98)) !important; }
        .reference-app-v151 .ref-panel-head { min-height: 34px !important; padding: 0 11px !important; }
        .reference-app-v151 .ref-panel-head h3 { font-size: 10.5px !important; letter-spacing: .10em !important; }
        .reference-app-v151 .ref-panel-body { padding: 9px 11px !important; }
        .reference-app-v151 .ref-table .head, .reference-app-v151 .ref-table .tr { min-height: 29px !important; font-size: 11px !important; }
        .reference-app-v151 .ref-today-grid { grid-template-columns: 1.22fr 1.18fr .92fr !important; gap: 9px !important; }
        .reference-app-v151 .ref-schedule-layout, .reference-app-v151 .ref-inventory-layout, .reference-app-v151 .ref-finance-layout { grid-template-columns: minmax(0,1fr) 314px !important; gap: 10px !important; }
        .reference-app-v151 .ref-prep-layout { grid-template-columns: minmax(0,1fr) 246px 212px 180px !important; gap: 9px !important; }
        .reference-app-v151 .ref-admin-layout { grid-template-columns: minmax(0,1fr) 268px !important; gap: 9px !important; }
        .reference-app-v151 .ref-admin-top { grid-template-columns: 1.55fr 1fr 1fr !important; gap: 9px !important; }
        .reference-app-v151 .ref-admin-mid { grid-template-columns: .94fr .94fr 1.28fr 1fr !important; gap: 9px !important; }
        .reference-app-v151 .ref-admin-bottom { grid-template-columns: 1.55fr 1.05fr .88fr !important; gap: 9px !important; }
        .reference-app-v151 .ref-recipes-layout { grid-template-columns: 438px minmax(0,1fr) 356px !important; gap: 9px !important; }
        .reference-app-v151 .ref-recipe-list button { min-height: 58px !important; grid-template-columns: 48px minmax(0,1fr) 68px 54px 20px !important; gap: 8px !important; }
        .reference-app-v151 .ref-recipe-list .thumb { color: transparent !important; background-size: cover !important; background-position: center !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08) !important; }
        .reference-app-v151 .ref-recipe-list .thumb-0 { background-image: url('/ref-food-0.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-1 { background-image: url('/ref-food-1.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-2 { background-image: url('/ref-food-2.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-3 { background-image: url('/ref-food-3.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-4 { background-image: url('/ref-food-4.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-5 { background-image: url('/ref-food-5.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-6 { background-image: url('/ref-food-6.jpg') !important; }
        .reference-app-v151 .ref-recipe-list .thumb-7 { background-image: url('/ref-food-7.jpg') !important; }
        .reference-app-v151 .ref-recipe-hero .recipe-photo-hero { background-image: url('/ref-food-hero.jpg') !important; background-size: cover !important; background-position: center !important; color: transparent !important; }
        .reference-app-v151 .ref-setting-row { min-height: 63px !important; padding: 10px 16px !important; }
        .reference-app-v151 .ref-setting-row.tall { grid-template-columns: 210px 300px 160px minmax(150px,1fr) minmax(150px,1fr) !important; }
        .reference-app-v151 .reference-tool-dropdown { min-width: 220px !important; }
        .reference-app-v151 .reference-command-search { width: min(420px, 33vw) !important; }

        /* 15.1.13 live graph primitives: charts use computed live arrays, not static art. */
        .reference-app-v151 .ref-chart-line.live { min-height: 172px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
        .reference-app-v151 .ref-chart-line.live svg { width: 100%; height: 152px; display: block; overflow: visible; }
        .reference-app-v151 .ref-chart-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--ref151-muted); font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .reference-app-v151 .ref-chart-legend span { display: inline-flex; align-items: center; gap: 5px; }
        .reference-app-v151 .ref-chart-legend i { width: 18px; height: 3px; border-radius: 999px; display: inline-block; background: var(--ref151-copper-hot); }
        .reference-app-v151 .ref-chart-legend i.secondary { background: var(--ref151-green); }
        .reference-app-v151 .ref-empty-live { border: 1px dashed rgba(117,135,145,.32); background: rgba(255,255,255,.025); border-radius: 5px; min-height: 108px; display: grid; place-items: center; text-align: center; padding: 14px; color: var(--ref151-muted); font-size: 12px; font-weight: 700; }
        .reference-app-v151 .ref-live-bars { min-height: 190px; display: flex; align-items: flex-end; gap: 6px; border-left: 1px solid rgba(117,135,145,.22); border-bottom: 1px solid rgba(117,135,145,.22); padding: 10px 8px 24px; position: relative; overflow: hidden; background: linear-gradient(180deg, rgba(255,255,255,.015), rgba(255,255,255,.005)); }
        .reference-app-v151 .ref-live-bars::before { content: ''; position: absolute; inset: 10px 8px 24px; background: repeating-linear-gradient(to top, rgba(117,135,145,.12) 0 1px, transparent 1px 28px); pointer-events: none; }
        .reference-app-v151 .ref-live-bars > div { flex: 1; min-width: 16px; display: flex; align-items: flex-end; justify-content: center; gap: 2px; height: 150px; position: relative; z-index: 1; }
        .reference-app-v151 .ref-live-bars i { width: 42%; min-height: 2px; border-radius: 3px 3px 0 0; display: block; box-shadow: 0 -4px 14px rgba(0,0,0,.16); }
        .reference-app-v151 .ref-live-bars i.sales { background: linear-gradient(180deg, var(--ref151-copper-hot), rgba(184,115,51,.72)); }
        .reference-app-v151 .ref-live-bars i.labor { background: linear-gradient(180deg, var(--ref151-green), rgba(96,174,65,.70)); }
        .reference-app-v151 .ref-live-bars small { position: absolute; bottom: -19px; left: 50%; transform: translateX(-50%); font-size: 8px; color: var(--ref151-faint); white-space: nowrap; }
        .reference-app-v151 .mobile-clock-schedule-quick { display: none; }

        @media (max-width: 1600px) {
          .reference-app-v151 .ref-metric-grid { grid-template-columns: repeat(6, minmax(116px, 1fr)) !important; }
          .reference-app-v151 .ref-metric { grid-template-columns: 34px minmax(0,1fr) 44px !important; padding: 9px !important; }
          .reference-app-v151 .ref-metric-icon { width: 32px !important; height: 32px !important; }
          .reference-app-v151 .ref-metric strong { font-size: 17px !important; }
          .reference-app-v151 .ref-recipes-layout { grid-template-columns: 400px minmax(0,1fr) 320px !important; }
        }
        @media (max-width: 1280px) {
          .reference-app-v151 .ref-metric-grid { grid-template-columns: repeat(3, minmax(160px, 1fr)) !important; }
          .reference-app-v151 .ref-today-grid, .reference-app-v151 .ref-finance-top { grid-template-columns: 1fr 1fr !important; }
          .reference-app-v151 .ref-schedule-layout, .reference-app-v151 .ref-inventory-layout, .reference-app-v151 .ref-finance-layout, .reference-app-v151 .ref-admin-layout { grid-template-columns: 1fr !important; }
          .reference-app-v151 .ref-prep-layout, .reference-app-v151 .ref-recipes-layout { grid-template-columns: 1fr !important; }
        }

        /* 15.1.13 mobile layout lock: one-column sleek panels, clipped page overflow, scroll only inside real data grids, and quick clock/schedule access. */
        @media (max-width: 899px) {
          .reference-app-v151,
          .reference-app-v151 .app-content-shell,
          .reference-app-v151 .ref-screen,
          .reference-app-v151 .ref-screen * { max-width: 100% !important; box-sizing: border-box !important; }
          .reference-app-v151 { overflow-x: clip !important; }
          .reference-app-v151 .app-content-shell {
            width: 100vw !important;
            max-width: 100vw !important;
            margin-left: 0 !important;
            padding: 16px 12px calc(154px + env(safe-area-inset-bottom, 0px)) !important;
            overflow-x: hidden !important;
          }
          .reference-app-v151 .ref-screen { width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; gap: 12px !important; }
          .reference-app-v151 .reference-sidebar { display: none !important; }
          .reference-app-v151 .reference-topbar { left: 0 !important; right: 0 !important; width: 100vw !important; max-width: 100vw !important; padding: 10px 12px !important; grid-template-columns: minmax(0,1fr) auto auto auto !important; gap: 8px !important; overflow: hidden !important; }
          .reference-app-v151 .reference-command-search { display: none !important; }
          .reference-app-v151 .reference-workspace-switch { min-width: 0 !important; max-width: 222px !important; width: auto !important; }
          .reference-app-v151 .reference-workspace-switch strong { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          .reference-app-v151 .mobile-clock-schedule-quick {
            position: fixed !important;
            left: 10px !important;
            right: 10px !important;
            bottom: calc(70px + env(safe-area-inset-bottom, 0px)) !important;
            z-index: 79 !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            padding: 8px !important;
            border: 1px solid rgba(196,124,63,.36) !important;
            border-radius: 12px !important;
            background: rgba(5, 12, 16, .96) !important;
            backdrop-filter: blur(14px) !important;
            box-shadow: 0 16px 42px rgba(0,0,0,.45) !important;
          }
          .reference-app-v151 .mobile-clock-schedule-quick button {
            min-height: 42px !important;
            border: 1px solid rgba(196,124,63,.40) !important;
            border-radius: 8px !important;
            background: linear-gradient(180deg, rgba(109,64,39,.64), rgba(65,37,24,.58)) !important;
            color: #ffd0a0 !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 7px !important;
          }
          .reference-app-v151 .ref-page-title { display: grid !important; grid-template-columns: 1fr !important; gap: 10px !important; align-items: start !important; width: 100% !important; }
          .reference-app-v151 .ref-page-title h1 { font-size: clamp(20px, 6.4vw, 27px) !important; line-height: 1.15 !important; letter-spacing: .13em !important; overflow-wrap: anywhere !important; }
          .reference-app-v151 .ref-page-title p { font-size: 12px !important; line-height: 1.35 !important; }
          .reference-app-v151 .ref-page-actions, .reference-app-v151 .ref-actions { display: grid !important; grid-template-columns: 1fr !important; justify-content: stretch !important; width: 100% !important; gap: 8px !important; }
          .reference-app-v151 .ref-top-date, .reference-app-v151 .ref-actions button, .reference-app-v151 .ref-wide-action { width: 100% !important; min-width: 0 !important; justify-content: center !important; }
          .reference-app-v151 .ref-metric-grid,
          .reference-app-v151 .ref-today-grid,
          .reference-app-v151 .ref-finance-top,
          .reference-app-v151 .ref-schedule-layout,
          .reference-app-v151 .ref-schedule-bottom,
          .reference-app-v151 .ref-inventory-layout,
          .reference-app-v151 .ref-inventory-mid,
          .reference-app-v151 .ref-finance-layout,
          .reference-app-v151 .ref-prep-layout,
          .reference-app-v151 .ref-three-cards,
          .reference-app-v151 .ref-task-lanes,
          .reference-app-v151 .ref-admin-layout,
          .reference-app-v151 .ref-admin-top,
          .reference-app-v151 .ref-admin-mid,
          .reference-app-v151 .ref-admin-bottom,
          .reference-app-v151 .ref-recipes-layout,
          .reference-app-v151 .ref-message-layout,
          .reference-app-v151 .ref-right-rail,
          .reference-app-v151 .ref-right-rail.inventory,
          .reference-app-v151 .ref-right-rail.finance,
          .reference-app-v151 .ref-right-rail.admin,
          .reference-app-v151 .ref-right-rail.recipes,
          .reference-app-v151 .ref-settings-layout,
          .reference-app-v151 .ref-settings-menu,
          .reference-app-v151 .ref-setting-row,
          .reference-app-v151 .ref-setting-row.tall,
          .reference-app-v151 .ref-ordering,
          .reference-app-v151 .ref-side-stat,
          .reference-app-v151 .ref-recipe-hero,
          .reference-app-v151 .ref-kpi-trip,
          .reference-app-v151 .ref-kpi-trip.big,
          .reference-app-v151 .ref-alert-strip,
          .reference-app-v151 .ref-dependency { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; width: 100% !important; min-width: 0 !important; gap: 12px !important; }
          .reference-app-v151 .ref-metric { grid-template-columns: 40px minmax(0, 1fr) !important; min-height: 96px !important; padding: 13px !important; width: 100% !important; min-width: 0 !important; }
          .reference-app-v151 .ref-metric-icon { width: 40px !important; height: 40px !important; }
          .reference-app-v151 .ref-metric .ref-spark { display: none !important; }
          .reference-app-v151 .ref-metric strong { white-space: normal !important; overflow-wrap: anywhere !important; font-size: 23px !important; }
          .reference-app-v151 .ref-metric small { white-space: normal !important; overflow-wrap: anywhere !important; font-size: 9.5px !important; }
          .reference-app-v151 .ref-panel { width: 100% !important; max-width: 100% !important; min-width: 0 !important; overflow: hidden !important; }
          .reference-app-v151 .ref-panel-head { min-width: 0 !important; gap: 8px !important; }
          .reference-app-v151 .ref-panel-head h3 { max-width: min(72vw, 280px) !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          .reference-app-v151 .ref-panel-body { min-width: 0 !important; overflow-x: hidden !important; }
          .reference-app-v151 .ref-table { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; max-width: 100% !important; }
          .reference-app-v151 .ref-table.compact .head,
          .reference-app-v151 .ref-table.compact .tr { grid-template-columns: minmax(110px,1.25fr) minmax(74px,.9fr) minmax(74px,.9fr) minmax(84px,.95fr) !important; min-width: 0 !important; }
          .reference-app-v151 .ref-table.inventory .head,
          .reference-app-v151 .ref-table.inventory .tr,
          .reference-app-v151 .ref-table.ledger .head,
          .reference-app-v151 .ref-table.ledger .tr,
          .reference-app-v151 .ref-table.timesheets .head,
          .reference-app-v151 .ref-table.timesheets .tr { min-width: 760px !important; }
          .reference-app-v151 .schedule-head,
          .reference-app-v151 .schedule-row,
          .reference-app-v151 .schedule-foot { min-width: 980px !important; }
          .reference-app-v151 .ref-chart-line,
          .reference-app-v151 .ref-chart-line.live,
          .reference-app-v151 .ref-bar-chart { grid-template-columns: 1fr !important; min-height: 150px !important; overflow: hidden !important; }
          .reference-app-v151 .ref-chart-line.live svg { height: 138px !important; }
          .reference-app-v151 .ref-live-bars { min-height: 132px !important; overflow-x: auto !important; padding-bottom: 24px !important; }
          .reference-app-v151 .ref-admin-section-grid { grid-template-columns: 1fr !important; }
          .reference-app-v151 .ref-live-bars > div { min-width: 19px !important; height: 104px !important; }
          .reference-app-v151 .ref-chart-legend { flex-wrap: wrap !important; }
          .reference-app-v151 .ref-station-grid { grid-template-columns: 1fr !important; overflow: visible !important; }
          .reference-app-v151 .ref-station-card { min-width: 0 !important; }
          .reference-app-v151 .ref-panel-toolbar { display: grid !important; grid-template-columns: 1fr !important; gap: 8px !important; }
          .reference-app-v151 .ref-panel-toolbar > *,
          .reference-app-v151 .ref-panel-toolbar button,
          .reference-app-v151 .ref-panel-toolbar select { width: 100% !important; min-width: 0 !important; }
          .reference-app-v151 .native-mobile-bottom-nav { position: fixed !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100vw !important; z-index: 80 !important; grid-template-columns: repeat(5, minmax(0,1fr)) !important; }
          .reference-app-v151 .native-mobile-bottom-nav .native-nav-label { font-size: 10px !important; }
          .reference-app-v151 .reference-voice-action { min-width: 54px !important; width: 54px !important; height: 48px !important; padding: 0 !important; border-radius: 999px !important; }
          .reference-app-v151 .reference-admin-exit-action { min-width: 42px !important; width: 42px !important; padding: 0 !important; }


        /* 15.1.14 MOBILE POLISH LOCK
           Fixes phone UI collisions: content no longer hides under quick actions/bottom nav,
           the command bar is leaner, and wide grids/tables scroll inside their cards only. */
        @media (max-width: 899px) {
          html, body, #root {
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
            background: #05090d !important;
          }
          .reference-app-v151,
          .reference-app-v151 .native-app-shell {
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          .reference-app-v151 .app-header.native-command-bar {
            position: sticky !important;
            top: 0 !important;
            height: 56px !important;
            min-height: 56px !important;
            padding: 0 8px !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            background: rgba(5, 10, 14, .985) !important;
            border-bottom: 1px solid rgba(196,124,63,.20) !important;
            box-shadow: 0 10px 28px rgba(0,0,0,.38) !important;
            z-index: 92 !important;
          }
          .reference-app-v151 .native-command-left {
            min-width: 0 !important;
            overflow: hidden !important;
            gap: 6px !important;
          }
          .reference-app-v151 .reference-tool-dropdown {
            max-width: min(52vw, 210px) !important;
            height: 38px !important;
            min-height: 38px !important;
            padding: 0 6px !important;
            border-radius: 12px !important;
            background: rgba(15, 25, 31, .74) !important;
            border: 1px solid rgba(196,124,63,.16) !important;
          }
          .reference-app-v151 .reference-tool-dropdown svg:first-child {
            width: 16px !important;
            height: 16px !important;
            color: var(--ref151-copper) !important;
            flex: 0 0 auto !important;
          }
          .reference-app-v151 .reference-tool-dropdown strong {
            max-width: 100% !important;
            font-size: 11.5px !important;
            line-height: 1.05 !important;
          }
          .reference-app-v151 .reference-tool-dropdown small {
            font-size: 8.5px !important;
            line-height: 1 !important;
          }
          .reference-app-v151 .reference-command-search {
            width: 36px !important;
            min-width: 36px !important;
            height: 38px !important;
            border-radius: 12px !important;
            background: rgba(15, 25, 31, .56) !important;
            border: 1px solid rgba(136,153,166,.16) !important;
          }
          .reference-app-v151 .native-command-actions {
            gap: 4px !important;
            flex: 0 0 auto !important;
          }
          .reference-app-v151 .native-command-actions .native-icon-button,
          .reference-app-v151 .native-command-actions .reference-profile-button {
            display: none !important;
          }
          .reference-app-v151 .reference-admin-exit-action {
            display: inline-flex !important;
            min-width: 38px !important;
            width: 38px !important;
            height: 38px !important;
            border-radius: 12px !important;
            border: 1px solid rgba(196,124,63,.28) !important;
            background: rgba(196,124,63,.10) !important;
            color: #f1bb88 !important;
          }
          .reference-app-v151 .reference-voice-action {
            display: inline-flex !important;
            width: 52px !important;
            min-width: 52px !important;
            height: 44px !important;
            padding: 0 !important;
            border-radius: 999px !important;
            border: 1px solid rgba(224,161,96,.72) !important;
            background: linear-gradient(180deg, #c47c3f 0%, #8b512e 100%) !important;
            color: #fff6ed !important;
            box-shadow: 0 10px 24px rgba(196,124,63,.24), inset 0 1px 0 rgba(255,255,255,.20) !important;
          }
          .reference-app-v151 .reference-voice-action svg {
            width: 24px !important;
            height: 24px !important;
          }
          .reference-app-v151 .reference-voice-action span,
          .reference-app-v151 .reference-admin-exit-action span {
            display: none !important;
          }
          .reference-app-v151 .app-content-shell {
            width: 100% !important;
            max-width: 100vw !important;
            margin-left: 0 !important;
            padding: 10px 10px calc(164px + env(safe-area-inset-bottom)) !important;
            overflow-x: hidden !important;
            box-sizing: border-box !important;
          }
          .reference-app-v151 .desktop-date-strip {
            display: none !important;
          }
          .reference-app-v151 .ref-page,
          .reference-app-v151 .ref-page > *,
          .reference-app-v151 .ref-panel,
          .reference-app-v151 .ref-panel-body,
          .reference-app-v151 .ref-page-head,
          .reference-app-v151 .ref-page-title,
          .reference-app-v151 .ref-metric,
          .reference-app-v151 .ref-setting-row,
          .reference-app-v151 .ref-alert-card,
          .reference-app-v151 .ref-row,
          .reference-app-v151 .ref-action-row,
          .reference-app-v151 .ref-wide-action {
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }
          .reference-app-v151 .ref-page {
            gap: 10px !important;
          }
          .reference-app-v151 .ref-page-head {
            display: grid !important;
            grid-template-columns: minmax(0,1fr) !important;
            gap: 10px !important;
            padding: 0 !important;
          }
          .reference-app-v151 .ref-page-title h1 {
            font-size: clamp(20px, 6vw, 25px) !important;
            line-height: 1.08 !important;
            letter-spacing: .08em !important;
          }
          .reference-app-v151 .ref-page-title p {
            font-size: 12px !important;
            line-height: 1.35 !important;
            color: #aab5bd !important;
          }
          .reference-app-v151 .ref-top-date,
          .reference-app-v151 .ref-page-actions button,
          .reference-app-v151 .ref-page-actions select,
          .reference-app-v151 .ref-actions button,
          .reference-app-v151 .ref-actions select,
          .reference-app-v151 .ref-panel-head button,
          .reference-app-v151 .ref-panel-head select {
            min-height: 40px !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 12px !important;
          }
          .reference-app-v151 .ref-panel {
            border-radius: 18px !important;
            background: linear-gradient(180deg, rgba(14,24,30,.98), rgba(9,16,21,.98)) !important;
            border-color: rgba(136,153,166,.18) !important;
            overflow: hidden !important;
          }
          .reference-app-v151 .ref-panel-head {
            min-height: 48px !important;
            padding: 10px 11px !important;
            align-items: center !important;
          }
          .reference-app-v151 .ref-panel-head h3 {
            max-width: 100% !important;
            font-size: 12px !important;
            white-space: normal !important;
            line-height: 1.2 !important;
          }
          .reference-app-v151 .ref-panel-body {
            padding: 11px !important;
            overflow-x: hidden !important;
          }
          .reference-app-v151 .ref-metric-grid,
          .reference-app-v151 .ref-today-grid,
          .reference-app-v151 .ref-finance-top,
          .reference-app-v151 .ref-schedule-layout,
          .reference-app-v151 .ref-schedule-bottom,
          .reference-app-v151 .ref-inventory-layout,
          .reference-app-v151 .ref-inventory-mid,
          .reference-app-v151 .ref-finance-layout,
          .reference-app-v151 .ref-prep-layout,
          .reference-app-v151 .ref-three-cards,
          .reference-app-v151 .ref-task-lanes,
          .reference-app-v151 .ref-admin-layout,
          .reference-app-v151 .ref-admin-top,
          .reference-app-v151 .ref-admin-mid,
          .reference-app-v151 .ref-admin-bottom,
          .reference-app-v151 .ref-recipes-layout,
          .reference-app-v151 .ref-message-layout,
          .reference-app-v151 .ref-settings-layout,
          .reference-app-v151 .ref-settings-menu,
          .reference-app-v151 .ref-setting-row,
          .reference-app-v151 .ref-setting-row.tall,
          .reference-app-v151 .ref-ordering,
          .reference-app-v151 .ref-side-stat,
          .reference-app-v151 .ref-recipe-hero,
          .reference-app-v151 .ref-kpi-trip,
          .reference-app-v151 .ref-kpi-trip.big,
          .reference-app-v151 .ref-alert-strip,
          .reference-app-v151 .ref-dependency,
          .reference-app-v151 .ref-right-rail,
          .reference-app-v151 .ref-right-rail.inventory,
          .reference-app-v151 .ref-right-rail.finance,
          .reference-app-v151 .ref-right-rail.admin,
          .reference-app-v151 .ref-right-rail.recipes {
            display: grid !important;
            grid-template-columns: minmax(0,1fr) !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .reference-app-v151 .ref-metric {
            grid-template-columns: 38px minmax(0,1fr) !important;
            min-height: 82px !important;
            padding: 11px !important;
            border-radius: 16px !important;
          }
          .reference-app-v151 .ref-metric-icon {
            width: 38px !important;
            height: 38px !important;
            border-radius: 14px !important;
          }
          .reference-app-v151 .ref-metric strong {
            font-size: 21px !important;
            line-height: 1.05 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }
          .reference-app-v151 .ref-metric small,
          .reference-app-v151 .ref-metric span {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
          }
          .reference-app-v151 .ref-metric .ref-spark {
            display: none !important;
          }
          .reference-app-v151 .ref-table,
          .reference-app-v151 .ref-schedule-grid {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            border-radius: 14px !important;
            overscroll-behavior-x: contain !important;
          }
          .reference-app-v151 .ref-table::after,
          .reference-app-v151 .ref-schedule-grid::after {
            content: 'Swipe for more';
            display: block;
            padding: 6px 2px 0;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: .12em;
            text-transform: uppercase;
            color: rgba(224,161,96,.72);
          }
          .reference-app-v151 .ref-table .head,
          .reference-app-v151 .ref-table .tr,
          .reference-app-v151 .schedule-head,
          .reference-app-v151 .schedule-row,
          .reference-app-v151 .schedule-foot {
            width: max-content !important;
            min-width: 720px !important;
          }
          .reference-app-v151 .ref-table.compact .head,
          .reference-app-v151 .ref-table.compact .tr {
            min-width: 520px !important;
          }
          .reference-app-v151 .schedule-head,
          .reference-app-v151 .schedule-row,
          .reference-app-v151 .schedule-foot {
            min-width: 860px !important;
          }
          .reference-app-v151 .ref-live-bars {
            display: flex !important;
            align-items: end !important;
            gap: 8px !important;
            min-height: 130px !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 8px 2px 24px !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .reference-app-v151 .ref-live-bars > div {
            flex: 0 0 22px !important;
            min-width: 22px !important;
            height: 102px !important;
          }
          .reference-app-v151 .ref-chart-line,
          .reference-app-v151 .ref-chart-line.live,
          .reference-app-v151 .ref-bar-chart {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 140px !important;
            overflow: hidden !important;
          }
          .reference-app-v151 .ref-chart-line svg,
          .reference-app-v151 .ref-chart-line.live svg {
            width: 100% !important;
            height: 128px !important;
          }
          .reference-app-v151 .ref-chart-legend {
            flex-wrap: wrap !important;
            gap: 8px !important;
            font-size: 10px !important;
          }
          .reference-app-v151 .ref-action-row,
          .reference-app-v151 .ref-wide-action,
          .reference-app-v151 .ref-setting-row > button,
          .reference-app-v151 .ref-panel button {
            min-height: 42px !important;
            border-radius: 12px !important;
            white-space: normal !important;
            line-height: 1.15 !important;
          }
          .reference-app-v151 .mobile-clock-schedule-quick {
            position: fixed !important;
            left: max(10px, env(safe-area-inset-left)) !important;
            right: max(10px, env(safe-area-inset-right)) !important;
            bottom: calc(82px + env(safe-area-inset-bottom)) !important;
            z-index: 89 !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            gap: 8px !important;
            pointer-events: auto !important;
          }
          .reference-app-v151 .mobile-clock-schedule-quick button {
            min-height: 44px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            border-radius: 16px !important;
            border: 1px solid rgba(224,161,96,.42) !important;
            background: linear-gradient(180deg, rgba(196,124,63,.96), rgba(139,81,46,.96)) !important;
            color: #fff6ed !important;
            font-size: 12px !important;
            font-weight: 950 !important;
            letter-spacing: .02em !important;
            box-shadow: 0 12px 30px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.18) !important;
          }
          .reference-app-v151 .mobile-clock-schedule-quick button svg {
            width: 17px !important;
            height: 17px !important;
          }
          .reference-app-v151 .native-mobile-bottom-nav {
            position: fixed !important;
            left: max(10px, env(safe-area-inset-left)) !important;
            right: max(10px, env(safe-area-inset-right)) !important;
            bottom: max(8px, env(safe-area-inset-bottom)) !important;
            width: auto !important;
            min-height: 66px !important;
            height: 66px !important;
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0,1fr)) !important;
            gap: 2px !important;
            padding: 6px !important;
            z-index: 88 !important;
            border-radius: 20px !important;
            background: rgba(6, 12, 16, .96) !important;
            border: 1px solid rgba(196,124,63,.28) !important;
            box-shadow: 0 18px 48px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.05) !important;
          }
          .reference-app-v151 .native-mobile-bottom-nav .native-nav-mobile {
            min-height: 52px !important;
            height: 52px !important;
            border-radius: 15px !important;
            gap: 2px !important;
            padding: 4px 1px !important;
          }
          .reference-app-v151 .native-mobile-bottom-nav .native-nav-mobile.is-active {
            background: rgba(196,124,63,.16) !important;
            color: #fff !important;
          }
          .reference-app-v151 .native-mobile-bottom-nav .native-nav-label {
            font-size: 9.5px !important;
            line-height: 1 !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .reference-app-v151 .native-mobile-bottom-nav svg {
            width: 19px !important;
            height: 19px !important;
          }
          .reference-app-v151 .app-drawer-v104,
          .reference-app-v151 .app-drawer-readable {
            z-index: 120 !important;
          }
          .reference-app-v151 .app-drawer-readable > aside,
          .reference-app-v151 .app-drawer-v104 > aside {
            width: min(90vw, 360px) !important;
            max-width: 90vw !important;
          }
        }
        @media (max-width: 420px) {
          .reference-app-v151 .reference-tool-dropdown { max-width: 43vw !important; }
          .reference-app-v151 .reference-command-search { display: none !important; }
          .reference-app-v151 .app-header.native-command-bar { grid-template-columns: minmax(0, 1fr) auto !important; }
          .reference-app-v151 .reference-voice-action { width: 50px !important; min-width: 50px !important; }
          .reference-app-v151 .ref-page-title h1 { font-size: 20px !important; }
          .reference-app-v151 .ref-panel-head { grid-template-columns: minmax(0,1fr) !important; }
        }
        }

        /* 15.1.13 deep-deep voice tap-target hotfix
           Keep the top 86Voice control large enough for real desktop clicks and phone taps. */
        .reference-app-v151 .native-command-actions > .reference-voice-action.reference-top-action,
        .reference-app-v151 button.reference-voice-action {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          height: 48px !important;
          min-height: 48px !important;
          line-height: 1 !important;
          border: 1px solid rgba(224,161,96,.78) !important;
          background: linear-gradient(180deg, #c47c3f 0%, #8b512e 100%) !important;
          color: #fff6ed !important;
        }
        .reference-app-v151 .native-command-actions > .reference-voice-action.reference-top-action svg,
        .reference-app-v151 button.reference-voice-action svg {
          width: 24px !important;
          height: 24px !important;
          flex: 0 0 auto !important;
        }



      `}</style>


      <aside className="reference-sidebar" aria-label="86 Chaos primary navigation">
        <div className="reference-sidebar-logo"><CheersLogo clientData={displayClientData} /></div>
        <nav className="reference-sidebar-nav">
          {activeReferenceNavItems.map(item => <ReferenceSidebarButton key={item.id} item={item} />)}
        </nav>
        <div className="reference-sidebar-foot">
          {activeTabState === 'godmode' && canUseSystemAdmin ? (
            <>
              <div className="reference-sidebar-card system-admin-foot"><small>System Time</small><strong>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><div>{new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div></div>
              <div className="reference-sidebar-card system-admin-foot"><small>Environment</small><strong className="green">Production</strong></div>
            </>
          ) : (
            <>
              <div className="reference-sidebar-card"><strong>{liveAppUser?.restaurantName || displayClientData?.name || 'Restaurant'}</strong><div>{displayClientData?.address || '123 Main St.'}</div><div>{displayClientData?.city || 'Chilton'}, {displayClientData?.state || 'WI'} {displayClientData?.zip || '53014'}</div><div className="green">Open • {displayClientData?.openHours || '10:30 AM – 12:00 AM'}</div></div>
              <div className="reference-sidebar-card reference-user-mini"><span>{(liveAppUser?.name || liveAppUser?.email || 'SA').slice(0,2).toUpperCase()}</span><div><strong>{liveAppUser?.name || 'User'}</strong><small>{liveAppUser?.role || (liveAppUser?.isSuperAdmin ? 'Super Administrator' : 'Staff')}</small></div></div>
            </>
          )}
        </div>
      </aside>

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
          <button type="button" onClick={() => !(activeTabState === 'godmode' && canUseSystemAdmin) && availableWorkspaces.length > 1 && !ghostTenant && !isDemoMode ? setIsWorkspaceSwitcherOpen(true) : null} className="reference-tool-dropdown" title={activeTabState === 'godmode' && canUseSystemAdmin ? 'System Administrator' : 'Active workspace'}>
            {activeTabState === 'godmode' && canUseSystemAdmin ? <Shield size={18}/> : <Package size={18}/>}<div><strong>{activeTabState === 'godmode' && canUseSystemAdmin ? 'System Administrator' : (liveAppUser?.restaurantName || displayClientData?.name || '86 Chaos')}</strong><small>{activeTabState === 'godmode' && canUseSystemAdmin ? 'Super Administrator' : 'Workspace'}</small></div><ChevronRight size={14}/>
          </button>
          <button type="button" className="reference-command-search" onClick={() => setIsGlobalSearchOpen(true)}>
            <Search size={17}/><input readOnly value="" placeholder="Search or run command..."/>
          </button>
        </div>
        <div className="native-command-actions flex items-center gap-2 flex-shrink-0">
          {activeTabState === 'godmode' && canUseSystemAdmin && <button type="button" onClick={() => setActiveTab('today')} className="reference-top-action reference-admin-exit-action"><ChevronLeft size={17}/> <span className="hidden sm:inline">Exit Admin</span></button>}
          <button type="button" onClick={() => window.dispatchEvent(new Event('chaos-open-voice-dock'))} className="reference-top-action reference-voice-action"><Mic size={22}/> <span className="hidden sm:inline">86Voice Command</span></button>
          <button type="button" onClick={() => setActiveTab('messages')} className="native-icon-button" title="Messages"><MessageSquare size={18}/>{hasUnreadMessages && <span className="native-alert-dot"></span>}</button>
          <button type="button" onClick={() => setActiveTab('reminders')} className="native-icon-button" title="Notifications"><Bell size={18}/>{needsEyesCount > 0 && <span className="native-alert-dot"></span>}</button>
          <button type="button" onClick={() => setActiveTab('settings')} className="reference-profile-button" title="Profile / settings">
            <span className="avatar">{(liveAppUser?.name || liveAppUser?.email || 'SA').slice(0,2).toUpperCase()}</span>
            <div className="hidden lg:block text-left"><strong>{liveAppUser?.name || 'System Admin'}</strong><small>{liveAppUser?.role || (liveAppUser?.isSuperAdmin ? 'Super Administrator' : 'User')}</small></div>
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
      <div className="mobile-clock-schedule-quick" aria-label="Quick time clock and schedule actions">
        <button type="button" onClick={() => setActiveTab('published')}><Clock size={16}/> Time Clock</button>
        <button type="button" onClick={() => setActiveTab('schedule')}><CalendarDays size={16}/> Schedule</button>
      </div>

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
        <ChaosErrorBoundary key={`${rId || 'no-workspace'}-${activeTabState}`}>
          <React.Suspense fallback={<RouteLoading />} >
            {renderMainContent()}
          </React.Suspense>
        </ChaosErrorBoundary>
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

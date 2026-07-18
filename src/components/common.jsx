import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe, Mic, MicOff, Sparkles } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon } from '../core/appCore';
import { buildPrepCreatePayload, buildPrepQuantityUpdate, findPrepMatch, formatPrepAmount, isLikelyPrepCommand, normalizePrepText, parsePrepCommandItems, parsePrepTargetDate, summarizePrepResults } from '../core/smartPrep';
import { buildEightySixAlertDetails, canUseMenuIntelligence, resolveStrictEightySixMatch } from '../core/menuIntelligence';
import { parseReminderCommand } from '../core/reminderUtils';
import { getVoiceMatchScore, resolveVoiceMatch } from '../core/voiceIntelligence';
import { resolveFeatureAccess, featureForRoute, isMasterAdminUser } from '../lib/featureAccess';
import { FEATURE_KEYS } from '../config/plans';

const CheersLogo = ({ clientData }) => {
  const settings = clientData?.systemSettings || {};
  const branding = settings.branding || clientData?.branding || {};
  const logoUrl = settings.showRestaurantLogo === false || branding.showRestaurantLogo === false
    ? ''
    : (settings.restaurantLogoUrl || branding.restaurantLogoUrl || branding.logoUrl || '');
  return (
    <div className="brand-logo-stack flex items-center gap-2 sm:gap-3 cursor-pointer transition-opacity hover:opacity-80 min-w-0">
      <div className="flex items-center gap-2 flex-shrink-0" title="86 Chaos branding is always displayed">
        <img src="/wisco.png" alt="86 Chaos app icon" className="h-8 w-8 sm:h-9 w-auto" />
        <img src="/6139.png" alt="86 Chaos" className="h-5 sm:h-6 w-auto" />
      </div>
      {logoUrl && (
        <div className="hidden sm:flex items-center gap-2 min-w-0 pl-2 border-l border-[#2A353D]">
          <img src={logoUrl} alt="Restaurant logo" className="h-8 sm:h-9 max-w-[92px] sm:max-w-[140px] object-contain rounded-md bg-white/5 p-1" />
        </div>
      )}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children, sizeClass = 'max-w-md' }) => {
  if (!isOpen) return null;
  return (
    <div className="chaos-modal-backdrop fixed inset-0 bg-[#12161A]/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md transition-opacity">
      <div className={`chaos-modal-panel ${T.card} ${sizeClass} w-full max-h-[90vh] overflow-y-auto`}>
        <div className={`chaos-modal-header flex justify-between items-center p-4 border-b ${T.border}`}>
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[#12161A] rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        <div className="chaos-modal-body p-4">{children}</div>
      </div>
    </div>
  );
};


const reminderNeedsAttention = (reminder = {}, appUser = {}) => {
  if (!reminder || ['done', 'completed', 'cancelled', 'canceled', 'archived'].includes(String(reminder.status || '').toLowerCase())) return false;
  const userId = appUser?.id || appUser?.uid || '';
  const isCreator = reminder.userId === userId || reminder.createdBy === userId;
  const isAssigned = reminder.assignedToUserId === userId || (Array.isArray(reminder.recipientUserIds) && reminder.recipientUserIds.includes(userId));
  const isPrivate = reminder.visibility === 'private_reminder' || reminder.scope === 'private' || reminder.isPrivate === true;
  if (isPrivate && !isCreator) return false;
  if (!isCreator && !isAssigned && reminder.visibility !== 'workspace') return false;
  const dueValue = reminder.snoozedUntil || reminder.nextReminderAt || reminder.scheduledAt || reminder.dueAt;
  if (!dueValue) return false;
  const dueAt = new Date(dueValue).getTime();
  return Number.isFinite(dueAt) && dueAt <= Date.now();
};

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, hasUnreadMessages, hasMyShiftAlert, hasScheduleBuilderAlert, hasHelpUpdate = false, clientFeatures = {}, clientData = {}, addToast, availableWorkspaces = [], activeWorkspaceName = '', onOpenWorkspaceSwitcher }) => {
  const [menuSearch, setMenuSearch] = useState('');

  // Reset the drawer search every time the hamburger menu opens/closes.
  // This prevents an old search term from reappearing and making the drawer look auto-filled.
  useEffect(() => {
    setMenuSearch('');
  }, [isOpen]);

  const drawerReminders = useLiveCollection('personalReminders', appUser?.restaurantId, { enabled: !!isOpen && !!appUser?.restaurantId && !!appUser?.id, limitCount: 120, fallbackLimitCount: 60 });
  const hasReminderAlert = (drawerReminders || []).some(reminder => reminderNeedsAttention(reminder, appUser));

  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};
  const isGod = Boolean((MASTER_ADMIN_EMAIL && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) || appUser?.isSuperAdmin || isMasterAdminUser(appUser));

  const isEnabled = (feat) => clientFeatures[feat] !== false;
  const planAllowsTab = (tabId) => {
    const featureKey = featureForRoute(tabId);
    if (!featureKey) return true;
    return resolveFeatureAccess({ workspace: clientData || {}, user: appUser || {}, featureKey }).allowed;
  };
  const pushTab = (tab) => { if (planAllowsTab(tab.id)) tabs.push(tab); };

  const managerBriefAccess = resolveFeatureAccess({ workspace: clientData || {}, user: appUser || {}, featureKey: FEATURE_KEYS.MANAGER_BRIEF });
  pushTab({ id: 'today', label: managerBriefAccess.allowed ? 'Manager Brief' : 'Today Home', icon: <Star size={18}/>, dot: hasUnreadMessages || hasMyShiftAlert || hasScheduleBuilderAlert });
  if (isEnabled('schedule')) pushTab({ id: 'published', label: 'Time Clock & Schedule', icon: <Clock size={18}/>, dot: hasMyShiftAlert }); 
  if ((isEnabled('labor') || isEnabled('sales')) && (isGod || appUser?.isAdmin || perms.labor || perms.schedule || perms.sales)) pushTab({ id: 'financials', label: 'Financials', icon: <Scale size={18}/> });
  if (isEnabled('ops') && (isGod || appUser?.isAdmin || perms.ops)) pushTab({ id: 'ops', label: 'Kitchen Command Center', icon: <ChefHat size={18}/> }); 
  if (isEnabled('messages')) pushTab({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/>, dot: hasUnreadMessages });
  if (isEnabled('events')) pushTab({ id: 'events', label: 'Event Calendar', icon: <Star size={18}/> });
  if (isEnabled('prep')) pushTab({ id: 'prep', label: 'Prep & Tasks', icon: <ClipboardList size={18}/> });
  if (isEnabled('recipes')) pushTab({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> });
  if (isEnabled('inventory')) pushTab({ id: 'inventory', label: 'Inventory & Orders', icon: <Package size={18}/> });  
  if (!appUser?.isDemo) pushTab({ id: 'ai-tools', label: 'AI Tools', icon: <Sparkles size={18}/> });
  if (canUseMenuIntelligence(appUser, clientData)) pushTab({ id: 'menu-intelligence', label: 'Menu Intelligence', icon: <Sparkles size={18}/> });
  pushTab({ id: 'reminders', label: 'My Reminders', icon: <Bell size={18}/>, dot: hasReminderAlert });
  if (isEnabled('team')) pushTab({ id: 'team', label: 'Staff Roster', icon: <Users size={18}/> });
  if (!appUser?.isDemo && isEnabled('hr')) pushTab({ id: 'hr-training', label: 'HR & Training', icon: <BookOpen size={18}/> });
  if (isEnabled('maintenance') && (appUser?.isAdmin || perms.team)) pushTab({ id: 'maintenance', label: 'Maintenance Log', icon: <Wrench size={18}/> });
  
  const isTrueGod = Boolean((MASTER_ADMIN_EMAIL && (appUser?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) || appUser?.isSuperAdmin === true);
  if (isTrueGod) pushTab({ id: 'godmode', label: 'System Administrator', icon: <Globe size={18}/> });
  if (!appUser?.isDemo && (appUser?.isAdmin || isTrueGod)) pushTab({ id: 'audit', label: 'System Audit', icon: <Shield size={18}/> });  
  pushTab({ id: 'help', label: 'Help Center', icon: <BookOpen size={18}/>, dot: hasHelpUpdate });
  if (!appUser?.isDemo) pushTab({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  const menuActions = [
    { id: 'help-add-staff', label: 'How to add staff', tab: 'help', keywords: 'employee team roster invite user password' },
    { id: 'help-fix-punch', label: 'Fix a missed punch', tab: 'help', keywords: 'time clock timesheet labor punch clock out forgot' },
    { id: 'help-schedule-template', label: 'Create schedule templates', tab: 'help', keywords: 'copy week schedule template coverage smart fill' },
    { id: 'help-permissions', label: 'Update permissions', tab: 'help', keywords: 'tab access manage user permissions ops labor inventory' },
    { id: 'go-labor-punch', label: 'Add/Edit Time Punch', tab: 'financials', keywords: 'timesheet labor clock in out edit punch payroll financials' },
    { id: 'go-schedule-template', label: 'Schedule Templates', tab: 'published', keywords: 'schedule builder copy previous week template smart fill coverage' },
    { id: 'go-support', label: 'Contact Support / Bug Report', tab: 'help', keywords: 'support faq problem broken help manual' }
  ];
  const menuSections = [
    { label: 'PEOPLE & SCHEDULING', ids: ['published', 'team', 'hr-training'] },
    { label: 'TODAY', ids: ['today', 'ops', 'reminders', 'events', 'messages'] },
    { label: 'KITCHEN OPERATIONS', ids: ['prep', 'inventory', 'recipes', 'menu-intelligence', 'maintenance'] },
    { label: 'BUSINESS & FINANCIALS', ids: ['financials'] },
    { label: 'TOOLS & AUTOMATION', ids: ['ai-tools'] },
    { label: 'SYSTEM & SUPPORT', ids: ['settings', 'help', 'audit', 'godmode'] }
  ].map(section => ({ ...section, tabs: section.ids.map(id => tabs.find(tab => tab.id === id)).filter(Boolean) })).filter(section => section.tabs.length > 0);

  const q = menuSearch.trim().toLowerCase();
  const visibleSections = menuSections
    .map(section => ({
      ...section,
      tabs: q ? section.tabs.filter(tab => `${tab.label} ${tab.id} ${section.label}`.toLowerCase().includes(q)) : section.tabs
    }))
    .filter(section => section.tabs.length > 0);
  const visibleActions = q ? menuActions.filter(a => `${a.label} ${a.keywords}`.toLowerCase().includes(q)).slice(0, 8) : [];
  const activeWorkspaceLabel = activeWorkspaceName || appUser?.restaurantName || appUser?.workspaceName || appUser?.businessName || 'Current Restaurant';
  const switchableWorkspaceCount = Array.isArray(availableWorkspaces) ? availableWorkspaces.filter(w => w?.isActive !== false).length : 0;
  const canSwitchWorkspace = switchableWorkspaceCount > 1 && typeof onOpenWorkspaceSwitcher === 'function' && !appUser?.isDemo;
  const openWorkspaceSwitcherFromMenu = () => {
    if (!canSwitchWorkspace) return;
    onClose?.();
    window.setTimeout(() => onOpenWorkspaceSwitcher(), 0);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-[#12161A]/60 backdrop-blur-sm" onClick={onClose}></div>
          <div className={`app-drawer-readable w-72 bg-[#1A2126] border-l ${T.border} h-full shadow-2xl flex flex-col relative animate-[slideIn_0.3s_ease-out]`}>
            <div className={`p-4 border-b ${T.border} bg-[#12161A] flex justify-between items-start`}>
               <div className="flex items-center gap-3">
                 <img src={getAvatar(appUser.name, appUser.photoURL)} alt="Profile" className={`w-10 h-10 rounded-full border ${T.border} object-cover`}/>
                 <div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Signed in as</div>
                   <div className="text-white font-black text-lg tracking-tight leading-none">{appUser.name}</div>
                   <div className={`flex items-center gap-1 ${T.copper} text-[10px] font-bold uppercase tracking-wider mt-1 bg-[#1A2126] border ${T.border} w-max px-2 py-0.5 rounded-md`}>{appUser.isAdmin && <Shield size={10} />} {appUser.role}</div>
                   <button
                     type="button"
                     onClick={openWorkspaceSwitcherFromMenu}
                     disabled={!canSwitchWorkspace}
                     className={`mt-2 max-w-[170px] flex items-center gap-1.5 rounded-lg border ${T.border} bg-[#0B0E11] px-2 py-1 text-left text-[10px] font-black uppercase tracking-wider ${canSwitchWorkspace ? 'text-[#D4A381] hover:border-[#D4A381] hover:text-white cursor-pointer' : 'text-slate-500 cursor-default'}`}
                     title={canSwitchWorkspace ? 'Change restaurant workspace' : 'Current restaurant workspace'}
                   >
                     <Globe size={11} className="flex-shrink-0" />
                     <span className="truncate">{activeWorkspaceLabel}</span>
                     {canSwitchWorkspace && <Repeat size={10} className="flex-shrink-0 opacity-80" />}
                   </button>
                 </div>
               </div>
               <button onClick={onClose} className="drawer-icon-button no-compact p-1.5 bg-[#1A2126] border border-[#2A353D] rounded-full text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
            </div>
            <div className="p-2 border-b border-[#2A353D]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)} placeholder="Search menu, help, tools..." className="w-full bg-[#12161A] border border-[#2A353D] rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-white outline-none focus:border-[#D4A381]" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
               {visibleSections.length === 0 && visibleActions.length === 0 && <div className="p-4 text-center text-xs font-bold text-slate-500 border border-dashed border-[#2A353D] rounded-xl">No menu results. Try “schedule”, “punch”, “recipe”, or “help”.</div>}
               {visibleSections.map(section => (
                 <div key={section.label} className="mb-1.5 last:mb-0">
                   <div className="drawer-section-label px-2 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{section.label}</div>
                   <div className="space-y-0.5">
                     {section.tabs.map(tab => (
                       <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg font-bold text-[13px] transition-all duration-200 ${activeTab === tab.id ? `${T.grad} text-slate-900 shadow-md` : 'text-slate-400 hover:bg-[#12161A] hover:text-white'}`}>
                         <div className="flex items-center gap-2.5">
                           <div className="relative flex items-center">
                             <span className={activeTab === tab.id ? 'text-slate-900' : T.copper}>{tab.icon}</span>
                             {tab.dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1A2126] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></span>}
                           </div>
                           {tab.label}
                         </div>
                       </button>
                     ))}
                   </div>
                 </div>
               ))}
               {visibleActions.length > 0 && <div className="pt-2 mt-1 border-t border-[#2A353D]"><div className="text-[9px] uppercase tracking-widest font-black text-slate-500 px-2 mb-0.5">Suggested actions</div>{visibleActions.map(a => (
                 <button key={a.id} onClick={() => { setActiveTab(a.tab); setMenuSearch(''); onClose(); }} className="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-slate-300 hover:bg-[#12161A] hover:text-[#D4A381] transition-colors flex items-center gap-2"><Search size={13}/> {a.label}</button>
               ))}</div>}
            </div>
            <div className={`p-3 border-t ${T.border} bg-[#12161A] space-y-2`}>
             <button onClick={() => { setActiveTab('help'); onClose(); window.setTimeout(() => window.dispatchEvent(new CustomEvent('chaosOpenProblemReport')), 150); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-orange-400 text-sm font-bold rounded-xl hover:bg-orange-900/20 transition-colors border border-orange-900/30"><Bug size={16} /> Report Problem</button>
             <button onClick={() => { setAppUser(null); localStorage.removeItem('86chaosUser'); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 text-sm font-bold rounded-xl hover:bg-red-900/20 transition-colors"><LogOut size={16} /> Log Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const PREP_LABEL_PRINT_PROFILES = {
  brotherQl810w: {
    name: 'Brother QL-810W',
    pageSize: '3.5in 1.1in',
    labelWidth: '3.5in',
    labelHeight: '1.1in'
  }
};

const ACTIVE_PREP_LABEL_PRINT_PROFILE = PREP_LABEL_PRINT_PROFILES.brotherQl810w;

const DayDotPrintScreen = ({ labelsToPrint, prepDate, appUser, onClose }) => {
  const onCloseRef = useRef(onClose);
  const historyPushedRef = useRef(false);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const handleBackButton = () => onCloseRef.current?.();
    if (!historyPushedRef.current) {
      window.history.pushState({ tab: 'prep', printScreen: true }, '');
      historyPushedRef.current = true;
    }
    window.addEventListener('popstate', handleBackButton);
    const timer = setTimeout(() => window.print(), 800);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', handleBackButton); };
  }, []);
  return (
    <div id="master-print-wrapper" className="fixed inset-0 z-[999999] bg-white overflow-y-auto text-black print:static print:block print:overflow-visible print:h-auto print:w-auto">
      <style>{`@media print { 
        @page { size: ${ACTIVE_PREP_LABEL_PRINT_PROFILE.pageSize}; margin: 0; } 
        body, html { margin: 0 !important; background: white !important; height: auto !important; } 
        #master-print-wrapper { position: static !important; overflow: visible !important; height: auto !important; display: block !important; }
        .no-print { display: none !important; } 
        .dk-label { width: ${ACTIVE_PREP_LABEL_PRINT_PROFILE.labelWidth} !important; height: ${ACTIVE_PREP_LABEL_PRINT_PROFILE.labelHeight} !important; display: flex !important; flex-direction: column !important; justify-content: center !important; padding: 0.04in 0.13in !important; box-sizing: border-box !important; page-break-after: always !important; break-after: page !important; margin: 0 !important; font-family: Arial, sans-serif !important; overflow: hidden !important; } 
        .dk-label:last-child { page-break-after: auto !important; break-after: auto !important; } 
        .dk-title { display: -webkit-box !important; -webkit-box-orient: vertical !important; -webkit-line-clamp: 2 !important; max-height: 0.34in !important; overflow: hidden !important; font-size: 14px !important; line-height: 1.02 !important; font-weight: 900 !important; text-transform: uppercase !important; text-align: center !important; margin-bottom: 2px !important; } 
        .dk-row { display: flex !important; justify-content: space-between !important; gap: 8px !important; font-size: 9px !important; line-height: 1.05 !important; font-weight: 800 !important; margin-bottom: 2px !important; text-transform: uppercase !important; white-space: nowrap !important; overflow: hidden !important; } 
        .dk-row span { overflow: hidden !important; text-overflow: ellipsis !important; } 
        .dk-exp { display: flex !important; justify-content: center !important; font-size: 13px !important; line-height: 1.05 !important; font-weight: 900 !important; border-top: 2px solid black !important; padding-top: 2px !important; } 
      }`}</style>
      <div className="no-print p-6 flex flex-col items-center justify-center min-h-screen bg-slate-100">
         <Loader2 className="animate-spin text-[#8F6040] mb-6" size={64} />
         <h2 className="text-3xl font-black text-slate-900 mb-2">Generating Labels</h2>
         <p className="text-sm font-bold text-slate-600 text-center max-w-xs">* Intended for use with Brother QL-810W label printer.</p>
         <button onClick={() => window.history.back()} className="bg-slate-900 text-white px-10 py-5 rounded-xl font-black text-lg shadow-xl hover:bg-slate-800 w-full max-w-xs mt-8">Return to App</button>
      </div>
      <div id="print-data">
        {(Array.isArray(labelsToPrint) ? labelsToPrint : []).map((item, idx) => {
          const prepDateParts = formatDisplayDate(prepDate).split(','); const prepStr = prepDateParts.length > 1 ? prepDateParts[1].trim() : formatDisplayDate(prepDate);
          const quantity = String(item.labelQuantity || `${item.qty ?? 1} ${item.unit || 'item'}`).trim();
          const station = String(item.station || 'General').trim();
          const expiration = item.expirationDate || item.expDate || getExpDate(prepDate);
          return (<div key={item.printId || `print-${idx}`} className="dk-label"><div className="dk-title">{item.text || item.name || 'Prep Item'}</div><div className="dk-row"><span>PREP: {prepStr}</span><span>BY: {appUser?.name ? appUser.name.split(' ')[0].toUpperCase() : '___'}</span></div><div className="dk-row"><span>QTY: {quantity}</span><span>STATION: {station}</span></div><div className="dk-exp">USE BY: {expiration}</div></div>);
        })}
      </div>
    </div>
  );
};

const MapClickListener = ({ setLat, setLon }) => {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat);
      setLon(e.latlng.lng);
    },
  });
  return null;
};

const SmartEmptyState = ({ icon = <Star size={24}/>, title, desc, actionLabel, onAction }) => (
  <div className="rounded-2xl border border-dashed border-[#2A353D] bg-[#12161A]/60 p-5 text-center">
    <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-[#0B0E11] border border-[#2A353D] text-[#D4A381] flex items-center justify-center">{icon}</div>
    <h3 className="text-sm font-black text-white">{title}</h3>
    {desc && <p className="text-xs text-slate-500 font-bold mt-1 leading-snug">{desc}</p>}
    {actionLabel && onAction && <button onClick={onAction} className="mt-3 px-3 py-2 rounded-lg bg-[#D4A381] text-slate-900 text-[10px] font-black uppercase tracking-widest">{actionLabel}</button>}
  </div>
);

const MiniProblemCard = ({ tone='amber', title, detail, action, onClick }) => {
  const tones = {
    red: 'border-red-500/40 bg-red-950/10 text-red-300',
    amber: 'border-amber-500/40 bg-amber-950/10 text-amber-300',
    blue: 'border-blue-500/40 bg-blue-950/10 text-blue-300',
    emerald: 'border-emerald-500/40 bg-emerald-950/10 text-emerald-300'
  };
  return <div className={`mini-problem-card rounded-xl border p-3 ${tones[tone] || tones.amber}`}>
    <div className="text-[10px] font-black uppercase tracking-widest">{title}</div>
    <div className="text-xs text-slate-300 font-bold mt-1 leading-snug">{detail}</div>
    {action && <button onClick={onClick} className="mt-2 text-[9px] font-black uppercase tracking-widest underline underline-offset-4">{action}</button>}
  </div>;
};

const getHomeProfile = (user) => {
  const role = (user?.role || '').toLowerCase();
  if (user?.isSuperAdmin || (MASTER_ADMIN_EMAIL && user?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase())) return 'system';
  if (user?.isAdmin || user?.permissions?.ops || user?.permissions?.sales || user?.permissions?.team || user?.permissions?.schedule || user?.permissions?.labor) return 'manager';
  if (role.includes('cook') || role.includes('chef') || role.includes('kitchen') || role.includes('prep') || user?.permissions?.prep) return 'kitchen';
  if (role.includes('bartender') || role.includes('bar')) return 'bar';
  if (role.includes('server') || role.includes('host')) return 'service';
  return 'staff';
};

const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
  if (!inTime || !outTime) return 0;
  const start = new Date(inTime);
  const end = new Date(outTime);
  const diff = (end - start) / 36e5;
  return Math.max(0, diff - ((parseFloat(breakMins) || 0) / 60));
};

const getWeekStart = (dateStr) => {
  const d = new Date((dateStr || getToday()) + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return formatDate(d);
};

const getWeekDates = (dateStr) => {
  const start = new Date(getWeekStart(dateStr) + 'T12:00:00');
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatDate(d);
  });
};


const ROLE_KEYWORDS = {
  Manager: ['manager','gm','owner','lead','supervisor'],
  Kitchen: ['cook','chef','kitchen','prep','dish'],
  Bar: ['bar','bartender'],
  Service: ['server','host','wait','expo','runner'],
};

const roleMatches = (userRole = '', targetRole = '') => {
  // Roster roles are customer-defined in Preferences. Match exact/custom role
  // names and simple contained text only; do not force every restaurant into
  // a generic cook/server/bartender bucket.
  if (!targetRole) return true;
  const u = String(userRole || '').trim().toLowerCase();
  const t = String(targetRole || '').trim().toLowerCase();
  if (!u || !t) return false;
  return u === t || u.includes(t) || t.includes(u);
};

const toLocalTimeInput = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toTimeString().slice(0,5); } catch(e) { return ''; }
};

const makeLocalIso = (date, time) => {
  if (!date || !time) return '';
  return new Date(`${date}T${time}:00`).toISOString();
};

const PunchTable = ({ rows, openEditPunch, forceOut, approvePunch, deletePunch }) => (
  <div className={`${T.card} overflow-hidden`}>
    <div className="bg-[#12161A] border-b border-[#2A353D] p-3 flex justify-between items-center"><h3 className="font-black text-[#D4A381] text-xs uppercase tracking-widest">Punch Ledger</h3><span className="text-[10px] font-bold text-slate-500">{rows.length} records</span></div>
    <div className="divide-y divide-[#2A353D]">
      {rows.length === 0 && <div className="p-8 text-center text-sm font-bold text-slate-500">No punches match this filter.</div>}
      {rows.map(({ punch:p, emp, hours, pay, tips, issue }) => <div key={p.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#12161A]/50">
        <div className="min-w-0"><div className="font-black text-white text-sm">{emp.name || p.employeeName || 'Unknown'} {issue && <span className="ml-2 text-[8px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded uppercase tracking-widest">{issue}</span>}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.date ? formatDisplayDate(p.date) : 'No date'} • {emp.role || 'No role'}</div>{p.managerNote && <div className="mt-1 text-[10px] font-bold text-amber-300 bg-amber-900/10 border border-amber-900/40 rounded-lg px-2 py-1 max-w-xl">⚠ {p.managerNote}</div>}</div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 text-xs font-mono"><span className="text-emerald-400">IN {formatClockTime(p.clockInTime) || '—'}</span><span className="text-red-400">OUT {formatClockTime(p.clockOutTime) || '—'}</span><span className="text-white">{Math.max(0,hours).toFixed(2)}h</span><span className="text-[#D4A381]">${pay.toFixed(2)}</span><span className="text-slate-400">Tips ${tips.toFixed(2)}</span></div>
        <div className="flex gap-2"><button onClick={() => openEditPunch(p)} className="p-2 bg-[#12161A] border border-[#2A353D] rounded-lg text-slate-400 hover:text-[#D4A381]"><Edit size={14}/></button>{['clocked_in','on_break'].includes(p.status) && <button onClick={() => forceOut(p)} className="px-2 bg-red-900/20 border border-red-900/50 rounded-lg text-[10px] font-black text-red-300">Out</button>}{p.isUnscheduled && !p.isApproved && <button onClick={() => approvePunch(p)} className="px-2 bg-amber-900/20 border border-amber-900/50 rounded-lg text-[10px] font-black text-amber-300">Approve</button>}<button onClick={() => deletePunch(p)} className="p-2 bg-[#12161A] border border-[#2A353D] rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={14}/></button></div>
      </div>)}
    </div>
  </div>
);

const StatusTile = ({ label, value }) => <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase tracking-widest font-black text-slate-500">{label}</div><div className="text-xl font-black text-white">{value}</div></div>;

const FriendlyEmpty = ({ title, text }) => <div className="border border-dashed border-[#2A353D] rounded-xl p-5 text-center"><div className="font-black text-white text-sm">{title}</div><p className="text-xs text-slate-400 font-bold mt-1">{text}</p></div>;

const GlobalSearchModal = ({ isOpen, onClose, queryText, setQueryText, users, events, shifts, recipes, inventoryItems, maintenanceLogs, setActiveTab }) => {
  if (!isOpen) return null;
  const q = queryText.trim().toLowerCase();
  const results = q ? [
    ...users.filter(u => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'User', title: x.name, detail: x.email || x.role, tab: 'team' })),
    ...recipes.filter(r => `${r.title} ${r.ingredients}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Recipe', title: x.title, detail: x.category, tab: 'recipes' })),
    ...inventoryItems.filter(i => `${i.name} ${i.category}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Inventory', title: x.name, detail: `Stock ${x.currentStock || 0} / Par ${x.parLevel || 0}`, tab: 'inventory' })),
    ...events.filter(e => `${e.title} ${e.author} ${e.notes}`.toLowerCase().includes(q)).slice(0, 6).map(x => ({ kind: x.type === 'special_event' ? 'Event' : 'Message', title: x.title, detail: x.date || x.author, tab: x.type === 'special_event' ? 'events' : 'messages' })),
    ...maintenanceLogs.filter(m => `${m.equipment} ${m.issue}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Maintenance', title: x.equipment, detail: x.issue, tab: 'maintenance' })),
    ...shifts.filter(s => `${s.role} ${s.date}`.toLowerCase().includes(q)).slice(0, 5).map(x => ({ kind: 'Shift', title: `${x.role} ${x.date}`, detail: `${formatShortTime(x.startTime)}-${formatShortTime(x.endTime)}`, tab: 'schedule' }))
  ].slice(0, 18) : [];
  return <div className="fixed inset-0 z-[100000] bg-[#0B0E11]/90 backdrop-blur-md p-4 flex items-start justify-center pt-10">
    <div className="w-full max-w-2xl cockpit-panel rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-[#2A353D] flex items-center gap-2"><Search size={18} className="text-[#D4A381]"/><input autoFocus value={queryText} onChange={e=>setQueryText(e.target.value)} placeholder="Search people, recipes, messages, inventory, events..." className="flex-1 bg-transparent outline-none text-white font-bold"/><button onClick={onClose} className="p-2 rounded-lg hover:bg-[#12161A]"><X size={18}/></button></div>
      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-2 space-y-1">{q && results.length === 0 && <SmartEmptyState title="Nothing found" desc="Try a recipe name, employee, inventory item, or event." />}{results.map((r, idx) => <button key={idx} onClick={() => { setActiveTab(r.tab); onClose(); }} className="w-full text-left p-3 rounded-xl border border-[#2A353D] bg-[#12161A] hover:border-[#D4A381]/40"><div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381]">{r.kind}</div><div className="font-black text-white text-sm mt-1">{r.title}</div><div className="text-xs text-slate-500 font-bold mt-0.5 truncate">{r.detail}</div></button>)}</div>
    </div>
  </div>;
};

const QuickActionDock = ({ appUser, setActiveTab, openSearch, openTV, addToast }) => {
  const [open, setOpen] = useState(false);
  const profile = getHomeProfile(appUser);
  const actions = [
    { label: 'Manager Brief', tab: 'today' },
    { label: 'Search', fn: openSearch },
    { label: 'Kitchen TV', fn: openTV },
    profile === 'kitchen' ? { label: 'Recipes', tab: 'recipes' } : null,
    profile === 'kitchen' ? { label: 'Prep', tab: 'prep' } : null,
    ['manager','system'].includes(profile) ? { label: 'Kitchen Command', tab: 'ops' } : null,
    ['manager','system'].includes(profile) ? { label: 'Schedule', tab: 'schedule' } : null,
    { label: 'Message Board', tab: 'messages' },
    { label: 'My Shift', tab: 'published' }
  ].filter(Boolean);
  return <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-2">
    {open && <div className="cockpit-panel rounded-2xl p-2 w-52 space-y-1 shadow-2xl">{actions.map(a => <button key={a.label} onClick={() => { setOpen(false); a.fn ? a.fn() : setActiveTab(a.tab); }} className="w-full text-left px-3 py-2 rounded-xl bg-[#0B0E11] hover:bg-[#12161A] border border-[#2A353D] text-xs font-black uppercase tracking-widest text-slate-300 hover:text-[#D4A381]">{a.label}</button>)}</div>}
    <button onClick={() => setOpen(!open)} className="no-compact w-14 h-14 rounded-full bg-[#0B0E11] border border-[#D4A381]/50 text-[#D4A381] shadow-2xl flex items-center justify-center"><Menu size={24}/></button>
  </div>;
};



const normalizeVoiceText = (text = '') => String(text || '').toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
const cleanVoiceItemName = (text = '') => String(text || '')
  .replace(/^(the|a|an)\s+/i, '')
  .replace(/\b(all out of|out of|to|in|on|for|please|right now|today)\b/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const findVoiceMatch = (items = [], spoken = '') => {
  const q = normalizeVoiceText(spoken);
  if (!q) return null;
  const scored = (items || []).map(item => {
    const name = normalizeVoiceText(item.name || item.title || item.equipment || '');
    if (!name) return { item, score: 0 };
    let score = 0;
    if (name === q) score += 100;
    if (name.includes(q) || q.includes(name)) score += 50;
    const qWords = q.split(' ').filter(w => w.length > 2);
    const nWords = name.split(' ').filter(w => w.length > 2);
    score += qWords.filter(w => nWords.some(n => n.includes(w) || w.includes(n))).length * 12;
    return { item, score };
  }).sort((a,b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].item : null;
};

const extractRecipeVoiceQuery = (raw = '') => {
  const q = normalizeVoiceText(raw);
  const patterns = [
    /^(?:open|show|pull up|bring up|display|go to|find|search for|look up)\s+(?:the\s+)?(.+?)\s+(?:recipe|recipes|spec|spec sheet|recipe card)$/,
    /^(?:open|show|pull up|bring up|display|go to|find|search for|look up)\s+(?:the\s+)?(?:recipe|recipes|recipe book|spec|spec sheet|recipe card)\s+(?:for|called|named)?\s*(.+)$/,
    /^(?:recipe|recipes|recipe book|spec|spec sheet|recipe card)\s+(?:for|called|named)?\s*(.+)$/,
    /^(?:how do i make|how to make|show me how to make|what is the recipe for)\s+(.+)$/
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanVoiceItemName(match[1]
        .replace(/\b(recipe|recipes|recipe book|spec|spec sheet|recipe card|please|open|show|pull up|bring up|display)\b/g, ' ')
      );
      if (cleaned) return cleaned;
    }
  }
  return '';
};

const findVoiceRecipeMatch = (recipes = [], spoken = '') => {
  const q = normalizeVoiceText(spoken);
  if (!q) return null;
  const qWords = q.split(' ').filter(w => w.length > 2);
  const scored = (recipes || []).map(recipe => {
    const title = normalizeVoiceText(recipe.title || recipe.name || '');
    const category = normalizeVoiceText(recipe.category || '');
    const ingredients = normalizeVoiceText(recipe.ingredients || '').slice(0, 800);
    const haystack = `${title} ${category} ${ingredients}`.trim();
    if (!title && !haystack) return { recipe, score: 0 };
    let score = 0;
    if (title === q) score += 160;
    if (title.startsWith(q) || q.startsWith(title)) score += 95;
    if (title.includes(q) || q.includes(title)) score += 75;
    const titleWords = title.split(' ').filter(w => w.length > 2);
    const hitCount = qWords.filter(w => titleWords.some(t => t === w || t.includes(w) || w.includes(t))).length;
    score += hitCount * 24;
    if (qWords.length && hitCount === qWords.length) score += 35;
    if (ingredients && qWords.some(w => ingredients.includes(w))) score += 8;
    if (category && qWords.some(w => category.includes(w))) score += 4;
    return { recipe, score };
  }).sort((a,b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].recipe : null;
};
const VOICE_NUMBER_WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12 };
const parseVoiceAmount = (text = '') => {
  const normalized = normalizeVoiceText(text);
  const numberMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) return parseFloat(numberMatch[1]);
  for (const [word, value] of Object.entries(VOICE_NUMBER_WORDS)) if (new RegExp(`\\b${word}\\b`).test(normalized)) return value;
  return 1;
};
const parsePrepVoicePayload = (text = '') => {
  const q = normalizeVoiceText(text);
  const amount = parseVoiceAmount(q);
  const unitMatch = q.match(/\b(pan|pans|quart|quarts|gallon|gallons|lb|lbs|pound|pounds|case|cases|batch|batches|tray|trays|bucket|buckets|container|containers|order|orders)\b/);
  const unit = unitMatch ? unitMatch[1] : '';
  const numberWords = Object.keys(VOICE_NUMBER_WORDS).join('|');
  let itemText = q
    .replace(/\b(we need to|we need|need to|need|add|create|put|make|please|to|the|a|an|prep|prepare|task|list|prep list|of|for)\b/g, ' ')
    .replace(new RegExp(`\\b(${numberWords})\\b`, 'g'), ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ');
  if (unit) itemText = itemText.replace(new RegExp(`\\b${unit}\\b`, 'gi'), ' ');
  itemText = cleanVoiceItemName(itemText.replace(/\s+/g, ' ').trim()) || 'Prep task';
  return { amount, unit: unit || 'item', itemText };
};
const VOICE_WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const getVoiceWeekdayName = (text = '') => {
  const q = normalizeVoiceText(text);
  const day = VOICE_WEEKDAYS.find(d => new RegExp(`\\b${d}\\b`).test(q));
  return day ? day.charAt(0).toUpperCase() + day.slice(1) : '';
};
const getCurrentWeekdayName = () => VOICE_WEEKDAYS[new Date().getDay()].charAt(0).toUpperCase() + VOICE_WEEKDAYS[new Date().getDay()].slice(1);
const getCurrentMonthDay = () => String(new Date().getDate());
const parseVoiceMonthlyDate = (text = '') => {
  const q = normalizeVoiceText(text);
  const match = q.match(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/);
  if (match?.[1]) return String(Math.min(31, Math.max(1, parseInt(match[1], 10))));
  return '';
};
const titleCaseVoiceTask = (text = '') => String(text || '').trim().split(' ').filter(Boolean).map(w => w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const inferVoiceTaskCategory = (title = '') => /\b(clean|sanitize|sweep|mop|scrub|wash|wipe|dust|degrease|dish|bathroom|restroom|floor|hood|fryer|grill)\b/i.test(title) ? 'Cleaning' : 'General';
const parseRecurringTaskVoicePayload = (text = '') => {
  const q = normalizeVoiceText(text);
  if (!/\b(add|create|make|put|new)\b/.test(q) || !/\b(task|tasks)\b/.test(q)) return null;
  let frequency = '';
  if (/\b(daily|day|every day|each day)\b/.test(q)) frequency = 'daily';
  if (/\b(weekly|week|every week|each week)\b/.test(q)) frequency = 'weekly';
  if (/\b(monthly|month|every month|each month)\b/.test(q)) frequency = 'monthly';
  if (!frequency) return null;

  const weekday = getVoiceWeekdayName(q);
  const monthlyDate = parseVoiceMonthlyDate(q);
  const numberWords = Object.keys(VOICE_NUMBER_WORDS).join('|');
  let taskTitle = q
    .replace(/\b(add|create|make|put|new|please|task|tasks|to|into|onto|list|recurring|repeat|repeating|daily|weekly|monthly|day|week|month|every|each|on|for|the|a|an|called|named)\b/g, ' ')
    .replace(/\b(cleaning|general)\s+task\b/g, ' ')
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, ' ')
    .replace(new RegExp(`\\b(${numberWords})\\b`, 'g'), ' ')
    .replace(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  taskTitle = cleanVoiceItemName(taskTitle) || '';
  if (!taskTitle) return null;

  const title = titleCaseVoiceTask(taskTitle);
  return {
    title,
    frequency,
    category: inferVoiceTaskCategory(taskTitle),
    targetDay: frequency === 'weekly' ? (weekday || getCurrentWeekdayName()) : null,
    targetDate: frequency === 'monthly' ? (monthlyDate || getCurrentMonthDay()) : null
  };
};
const describeRecurringTaskSchedule = (task = {}) => {
  if (task.frequency === 'weekly') return `weekly on ${task.targetDay || getCurrentWeekdayName()}`;
  if (task.frequency === 'monthly') return `monthly on day ${task.targetDate || getCurrentMonthDay()}`;
  return 'daily';
};
const parseNextWeekday = (phrase = '') => {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const q = normalizeVoiceText(phrase);
  const idx = days.findIndex(d => q.includes(d));
  if (idx < 0) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const delta = (idx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return formatDate(d);
};

const isVoiceSuperAdmin = (user = {}) => Boolean((MASTER_ADMIN_EMAIL && (user?.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) || user?.isSuperAdmin === true || user?.systemAccess?.superAdmin === true);
const isVoiceAdmin = (user = {}) => Boolean(isVoiceSuperAdmin(user) || user?.isAdmin === true);
const isVoiceManagerOrAdmin = (user = {}, clientData = {}) => {
  const role = normalizeVoiceText(user?.role || '');
  const perms = user?.permissions || {};
  const rosterRoles = Array.isArray(clientData?.rosterRoles) ? clientData.rosterRoles : (Array.isArray(clientData?.systemSettings?.rosterRoles) ? clientData.systemSettings.rosterRoles : []);
  const allowLegacyRoleFallback = rosterRoles.length === 0;
  return Boolean(
    isVoiceAdmin(user) ||
    user?.isOwner === true ||
    user?.accountOwner === true ||
    user?.owner === true ||
    user?.workspaceOwner === true ||
    perms.team === true ||
    perms.ops === true ||
    perms.prep === true ||
    (allowLegacyRoleFallback && (['general manager', 'manager', 'kitchen manager', 'bar manager', 'schedule manager', 'operations manager', 'store manager', 'owner', 'shift lead', 'lead', 'supervisor'].includes(role) || /\b(manager|owner|supervisor|lead|gm)\b/.test(role)))
  );
};
const voiceFeatureEnabled = (features = {}, feature) => !feature || features?.[feature] !== false;
const canVoiceOpenTab = (user = {}, clientFeatures = {}, tab = 'today', clientData = {}) => {
  const featureKey = featureForRoute(tab);
  if (featureKey) {
    const access = resolveFeatureAccess({ workspace: clientData || {}, user: user || {}, featureKey });
    if (!access.allowed) return false;
  }
  const perms = user?.permissions || {};
  const isSuper = isVoiceSuperAdmin(user);
  const isAdmin = isVoiceAdmin(user);
  const role = normalizeVoiceText(user?.role || '');
  const rosterRoles = Array.isArray(clientData?.rosterRoles) ? clientData.rosterRoles : (Array.isArray(clientData?.systemSettings?.rosterRoles) ? clientData.systemSettings.rosterRoles : []);
  const hasCustomRosterRoles = rosterRoles.length > 0;
  const isKitchenRole = !hasCustomRosterRoles && (role.includes('kitchen') || role.includes('cook') || role.includes('chef'));
  const isLegacyManagerRole = !hasCustomRosterRoles && (role.includes('manager') || role.includes('owner') || role.includes('lead') || role.includes('supervisor'));
  if (tab === 'today' || tab === 'help') return true;
  if (tab === 'published') return voiceFeatureEnabled(clientFeatures, 'schedule');
  if (tab === 'schedule') return voiceFeatureEnabled(clientFeatures, 'schedule') && (isAdmin || !!perms.schedule);
  if (tab === 'events') return voiceFeatureEnabled(clientFeatures, 'events') && (isAdmin || !!perms.events || !!perms.schedule || !!perms.team);
  if (tab === 'financials' || tab === 'sales' || tab === 'labor') return (voiceFeatureEnabled(clientFeatures, 'labor') || voiceFeatureEnabled(clientFeatures, 'sales')) && (isSuper || isAdmin || !!perms.labor || !!perms.sales || !!perms.schedule);
  if (tab === 'ops') return voiceFeatureEnabled(clientFeatures, 'ops') && (isSuper || isAdmin || !!perms.ops || isLegacyManagerRole);
  if (tab === 'messages') return voiceFeatureEnabled(clientFeatures, 'messages');
  if (tab === 'prep') return voiceFeatureEnabled(clientFeatures, 'prep') && (isAdmin || isKitchenRole || !!perms.prep);
  if (tab === 'reminders') return true;
  if (tab === 'menu-intelligence') return canUseMenuIntelligence(user, clientData);
  if (tab === 'recipes') return voiceFeatureEnabled(clientFeatures, 'recipes') && (isAdmin || isKitchenRole || !!perms.prep || !!perms.team);
  if (tab === 'inventory') return voiceFeatureEnabled(clientFeatures, 'inventory') && (isAdmin || !!perms.inventory || !!perms.team || isLegacyManagerRole);
  if (tab === 'team') return voiceFeatureEnabled(clientFeatures, 'team');
  if (tab === 'maintenance') return voiceFeatureEnabled(clientFeatures, 'maintenance') && (isAdmin || !!perms.team || !!perms.maintenance || isLegacyManagerRole);
  if (tab === 'settings') return !user?.isDemo;
  if (tab === 'audit') return !user?.isDemo && (isSuper || isAdmin);
  if (tab === 'godmode') return isSuper;
  return false;
};
const fetchVoicePrepMatchCandidates = async (restaurantId = '', prepDates = [], existingPrepItems = []) => {
  const byId = new Map();
  const addCandidate = (item) => {
    if (!item) return;
    const key = item.id || `${item.date || ''}:${item.text || item.title || item.name || ''}:${item.station || ''}`;
    if (key && !byId.has(key)) byId.set(key, item);
  };
  (existingPrepItems || []).forEach(addCandidate);

  if (!restaurantId) return Array.from(byId.values());
  const dates = Array.from(new Set([...(prepDates || []), 'MASTER'].map(v => String(v || '').trim()).filter(Boolean)));
  for (let i = 0; i < dates.length; i += 10) {
    const chunk = dates.slice(i, i + 10);
    if (!chunk.length) continue;
    try {
      const snap = await getDocs(query(collection(db, 'prepItems'), where('restaurantId', '==', restaurantId), where('date', 'in', chunk)));
      snap.forEach((docSnap) => addCandidate({ id: docSnap.id, ...docSnap.data() }));
    } catch (err) {
      console.warn('86 Voice prep match refresh failed; using loaded prep snapshot.', err?.message || err);
    }
  }
  return Array.from(byId.values());
};



const isVoiceCompletionCommand = (text = '') => {
  const q = normalizeVoiceText(text);
  if (!q) return false;
  return /\b(mark|marked|check|checked|complete|completed|finish|finished|done|clear|cleared|cross|crossed)\b/.test(q) &&
    /\b(done|complete|completed|finished|off|task|tasks|prep|prepped|list|clear|cleared|check|checked|mark|marked)\b/.test(q);
};

const extractVoiceCompletionPayload = (text = '') => {
  const raw = String(text || '').trim();
  const q = normalizeVoiceText(raw);
  if (!isVoiceCompletionCommand(q)) return null;
  const dateInfo = parsePrepTargetDate(raw);
  const date = dateInfo.date || getToday();
  const cleanedForDate = dateInfo.cleanedText || raw;
  const frequency = /\bweekly|week\b/.test(q) ? 'weekly' : /\bmonthly|month\b/.test(q) ? 'monthly' : /\bdaily|day\b/.test(q) ? 'daily' : '';
  const scopeHint = /\bprep|prepped|prep list|food prep\b/.test(q)
    ? 'prep'
    : /\btask|tasks|daily task|weekly task|monthly task|cleaning|routine|routines\b/.test(q)
      ? 'task'
      : '';
  let itemText = normalizeVoiceText(cleanedForDate)
    .replace(/\b(i|i'm|im|i am|we|we're|were|we are|it's|its|it is|the|a|an|please|can you|could you)\b/g, ' ')
    .replace(/\b(mark|marked|check|checked|complete|completed|finish|finished|done|clear|cleared|cross|crossed|off|with|up|out|that|this|item|items|prep|prepped|prepare|list|task|tasks|daily|weekly|monthly|today|tonight)\b/g, ' ')
    .replace(/\bis\s+done\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  itemText = cleanVoiceItemName(itemText);
  if (!itemText) return null;
  return { itemText, date, frequency, scopeHint };
};

const normalizeVoiceListName = (value = '') => normalizePrepText(value)
  .replace(/\b(cleaning|general|station|master)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const singularizeVoiceToken = (value = '') => String(value || '').replace(/\b([a-z]{4,})s\b/g, '$1').trim();

const levenshteinDistance = (a = '', b = '') => {
  const aa = String(a || '');
  const bb = String(b || '');
  if (aa === bb) return 0;
  if (!aa) return bb.length;
  if (!bb) return aa.length;
  const prev = Array.from({ length: bb.length + 1 }, (_, idx) => idx);
  const curr = Array.from({ length: bb.length + 1 }, () => 0);
  for (let i = 1; i <= aa.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bb.length; j += 1) prev[j] = curr[j];
  }
  return prev[bb.length];
};

const scoreVoiceListCandidate = (spoken = '', candidateName = '') => {
  const q = singularizeVoiceToken(normalizeVoiceListName(spoken));
  const name = singularizeVoiceToken(normalizeVoiceListName(candidateName));
  if (!q || !name) return 0;
  return getVoiceMatchScore(q, name);
};

const getVoiceTaskPeriodKey = (frequency = 'daily', prepDate = getToday()) => {
  if (frequency === 'weekly') {
    const d = new Date(`${prepDate}T12:00:00`);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return formatDate(d);
  }
  if (frequency === 'monthly') return String(prepDate || getToday()).substring(0, 7);
  return prepDate || getToday();
};

const isVoicePrepDone = (item = {}, prepDate = getToday()) => item?.isMaster || item?.date === 'MASTER'
  ? !!item?.completedDates?.[prepDate]
  : !!item?.isCompleted;

const fetchVoiceTaskCandidates = async (restaurantId = '', existingTasks = []) => {
  const byId = new Map();
  (existingTasks || []).forEach(task => { if (task?.id) byId.set(task.id, task); });
  if (!restaurantId) return Array.from(byId.values());
  try {
    const snap = await getDocs(query(collection(db, 'tasks'), where('restaurantId', '==', restaurantId)));
    snap.forEach(docSnap => byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn('86 Voice task match refresh failed; using loaded task snapshot.', err?.message || err);
  }
  return Array.from(byId.values());
};

const resolveVoiceCompletionMatch = async ({ restaurantId = '', parsed = {}, prepItems = [], tasks = [] }) => {
  const prepDate = parsed.date || getToday();
  const allowPrep = parsed.scopeHint !== 'task';
  const allowTasks = parsed.scopeHint !== 'prep';
  const candidates = [];
  if (allowPrep) {
    const prepCandidates = await fetchVoicePrepMatchCandidates(restaurantId, [prepDate], prepItems);
    prepCandidates
      .filter(item => item && (item.isMaster || item.date === 'MASTER' || item.date === prepDate))
      .forEach(item => {
        const name = item.text || item.title || item.name || 'Prep item';
        const score = scoreVoiceListCandidate(parsed.itemText, name) + (isVoicePrepDone(item, prepDate) ? -14 : 8);
        candidates.push({ type:'prep', item, label:name, listLabel:'Prep List', prepDate, score, alreadyDone:isVoicePrepDone(item, prepDate) });
      });
  }
  if (allowTasks) {
    const taskCandidates = await fetchVoiceTaskCandidates(restaurantId, tasks);
    taskCandidates
      .filter(task => !parsed.frequency || task.frequency === parsed.frequency)
      .forEach(task => {
        const name = task.title || task.text || task.name || 'Task';
        const periodKey = getVoiceTaskPeriodKey(task.frequency || 'daily', prepDate);
        const alreadyDone = !!task?.completions?.[periodKey];
        const score = scoreVoiceListCandidate(parsed.itemText, name) + (alreadyDone ? -14 : 6) + (parsed.frequency && task.frequency === parsed.frequency ? 10 : 0);
        candidates.push({ type:'task', item:task, label:name, listLabel:`${String(task.frequency || 'daily').replace(/^./, c => c.toUpperCase())} Tasks`, prepDate, periodKey, score, alreadyDone });
      });
  }
  const ranked = candidates
    .filter(candidate => candidate.score >= 42)
    .sort((a, b) => (b.score - a.score) || (a.alreadyDone === b.alreadyDone ? 0 : a.alreadyDone ? 1 : -1));
  const top = ranked[0] || null;
  const second = ranked[1] || null;
  const isConfident = !!top && top.score >= 86 && (!second || top.score - second.score >= 18);
  return { top, candidates: ranked.slice(0, 5), isConfident };
};


const isVoiceUndoCommand = (text = '') => {
  const q = normalizeVoiceText(text);
  return /\b(undo that|undo last|cancel last|cancel that|take that back|never mind|nevermind|scratch that)\b/.test(q);
};

const cleanVoiceTaskTitle = (text = '') => cleanVoiceItemName(String(text || '')
  .replace(/^(add|create|make|put|new)\s+/i, '')
  .replace(/\b(to|into|onto)\s+(the\s+)?(task|tasks|task list|daily tasks|weekly tasks|monthly tasks|prep tasks)\b/ig, ' ')
  .replace(/\b(task|tasks|list|please|tonight|today|tomorrow)\b/ig, ' ')
  .replace(/\s+/g, ' ')
  .trim());

const parseVoiceTaskUpsertPayload = (text = '') => {
  const raw = String(text || '').trim();
  const q = normalizeVoiceText(raw);
  if (!/\b(add|create|make|put|new)\b/.test(q)) return null;
  if (!/\b(task|tasks|daily task|weekly task|monthly task|line check|checklist|cleaning list|routine|routines|tonight)\b/.test(q)) return null;
  const recurring = parseRecurringTaskVoicePayload(raw);
  if (recurring) return { ...recurring, mode: 'upsert_task' };
  let frequency = 'daily';
  if (/\bweekly|week\b/.test(q)) frequency = 'weekly';
  if (/\bmonthly|month\b/.test(q)) frequency = 'monthly';
  const weekday = getVoiceWeekdayName(q);
  const monthlyDate = parseVoiceMonthlyDate(q);
  let title = q
    .replace(/\b(add|create|make|put|new|please|to|into|onto|the|a|an|called|named)\b/g, ' ')
    .replace(/\b(task|tasks|task list|line check|checklist|cleaning list|routine|routines|tonight|today|tomorrow|daily|weekly|monthly|day|week|month|every|each|on|for)\b/g, ' ')
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g, ' ')
    .replace(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  title = cleanVoiceTaskTitle(title) || '';
  if (!title) return null;
  const properTitle = titleCaseVoiceTask(title);
  return {
    mode: 'upsert_task',
    title: properTitle,
    frequency,
    category: inferVoiceTaskCategory(title),
    targetDay: frequency === 'weekly' ? (weekday || getCurrentWeekdayName()) : null,
    targetDate: frequency === 'monthly' ? (monthlyDate || getCurrentMonthDay()) : null
  };
};

const getVoiceRosterRoles = (clientData = {}) => Array.isArray(clientData?.rosterRoles)
  ? clientData.rosterRoles
  : (Array.isArray(clientData?.systemSettings?.rosterRoles) ? clientData.systemSettings.rosterRoles : []);

const canVoiceManageRecurringTasks = (user = {}, clientData = {}) => {
  const perms = user?.permissions || {};
  if (isVoiceSuperAdmin(user) || isVoiceAdmin(user) || user?.isOwner || user?.accountOwner || user?.owner || user?.workspaceOwner || perms.team || perms.ops || perms.prep) return true;
  const rosterRoles = getVoiceRosterRoles(clientData);
  if (rosterRoles.length) return false;
  const role = normalizeVoiceText(user?.role || '');
  return ['general manager', 'manager', 'kitchen manager', 'bar manager', 'schedule manager', 'operations manager', 'store manager', 'owner', 'shift lead', 'lead', 'supervisor'].includes(role) || /\b(manager|owner|supervisor|lead|gm)\b/.test(role);
};

const canVoiceShareReminder = (user = {}, clientData = {}) => {
  const perms = user?.permissions || {};
  if (isVoiceSuperAdmin(user) || isVoiceAdmin(user) || user?.isOwner || user?.accountOwner || user?.workspaceOwner || perms.team || perms.schedule || perms.ops) return true;
  const rosterRoles = getVoiceRosterRoles(clientData);
  if (rosterRoles.length) return false;
  const role = normalizeVoiceText(user?.role || '');
  return /\b(manager|owner|supervisor|lead|gm)\b/.test(role);
};


const makeVoiceDefaultReminderIso = (dateKey = '', hour = 9, minute = 0) => {
  const base = dateKey ? new Date(`${dateKey}T12:00:00`) : new Date();
  if (!dateKey) base.setDate(base.getDate() + 1);
  base.setHours(hour, minute, 0, 0);
  return base.toISOString();
};

const parseVoiceRecurringReminderPayload = (text = '') => {
  const raw = String(text || '').trim();
  const q = normalizeVoiceText(raw);
  if (!/\b(reminder|remind me)\b/.test(q) || !/\b(daily|weekly|monthly|every day|every week|every month)\b/.test(q)) return null;
  const frequency = /\b(monthly|every month)\b/.test(q) ? 'monthly' : /\b(weekly|every week)\b/.test(q) ? 'weekly' : 'daily';
  const parsed = parseReminderCommand(raw);
  const dateInfo = parsePrepTargetDate(raw);
  let title = String(parsed?.title || raw)
    .replace(/\b(create|add|set|make|a|an|the|reminder|remind me|to|daily|weekly|monthly|every day|every week|every month|recurring|repeat|repeating)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  title = cleanVoiceItemName(title) || 'Recurring reminder';
  let scheduledAt = parsed?.scheduledAt || '';
  if (!scheduledAt) scheduledAt = makeVoiceDefaultReminderIso(dateInfo.date || '', 9, 0);
  return {
    title,
    scheduledAt,
    recurrence: frequency,
    recurrenceLabel: frequency === 'daily' ? 'daily' : frequency === 'weekly' ? 'weekly' : 'monthly'
  };
};

const parseVoiceSharedReminderPayload = (text = '') => {
  const raw = String(text || '').trim();
  const q = normalizeVoiceText(raw);
  if (!/^remind\s+/.test(q) || /^remind\s+me\b/.test(q)) return null;

  const timingPattern = '(?:in\\s+(?:an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|half|quarter|\\d+(?:\\.\\d+)?)\\s*(?:minutes?|mins?|min|hours?|hrs?|hr|days?|weeks?)|(?:at|by|around|about)\\s*\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a m|p m)?|today|tomorrow|tonight|next\\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
  const beforeTo = raw.match(new RegExp(`^remind\\s+(.+?)\\s+(${timingPattern})\\s+to\\s+(.+)$`, 'i'));
  const normal = raw.match(/^remind\s+(.+?)\s+to\s+(.+)$/i) || raw.match(/^remind\s+(\S+)\s+(.+)$/i);
  const match = beforeTo || normal;
  if (!match?.[1]) return null;

  const assigneePhrase = cleanVoiceItemName(match[1]);
  const reminderText = beforeTo ? `${match[3]} ${match[2]}` : String(match[2] || '').trim();
  if (!assigneePhrase || !reminderText) return null;

  const parsed = parseReminderCommand(`remind me to ${reminderText}`);
  let scheduledAt = parsed?.scheduledAt || '';
  if (!scheduledAt) {
    const dateOnly = parsePrepTargetDate(reminderText).date;
    if (dateOnly) scheduledAt = new Date(`${dateOnly}T09:00:00`).toISOString();
  }
  return {
    assigneePhrase,
    title: cleanVoiceItemName(parsed?.title || reminderText) || reminderText,
    scheduledAt,
    needsManualTime: !scheduledAt,
    rawReminderText: reminderText
  };
};

const resolveVoiceUserMatch = (users = [], spokenName = '') => resolveVoiceMatch(
  (users || []).filter(u => u && (u.id || u.email || u.name)),
  spokenName,
  {
    getLabel: (user) => `${user.name || ''} ${user.displayName || ''} ${user.email || ''}`.trim(),
    getAliases: (user) => [user.name, user.displayName, user.firstName, user.email].filter(Boolean),
    minScore: 35,
    highThreshold: 92,
    margin: 16,
    limit: 5
  }
);

const filterApprovedVoiceMenuDependencies = (deps = []) => (deps || []).filter(dep => {
  const status = normalizeVoiceText(dep.status || dep.reviewStatus || dep.approvalStatus || dep.sourceStatus || 'approved');
  return !status || ['approved', 'active', 'verified', 'manager approved', 'reviewed'].includes(status) || dep.approved === true || dep.managerApproved === true;
});

const getVoiceMenuImpactRows = (itemOrPhrase = '', inventoryItems = [], menuDependencies = []) => {
  const approvedDeps = filterApprovedVoiceMenuDependencies(menuDependencies);
  const itemName = typeof itemOrPhrase === 'string' ? itemOrPhrase : (itemOrPhrase?.name || itemOrPhrase?.title || '');
  const itemId = typeof itemOrPhrase === 'string' ? '' : (itemOrPhrase?.id || '');
  const requested = normalizeVoiceText(itemName);
  return approvedDeps.filter(dep => {
    const depItemId = dep.inventoryItemId || dep.itemId || dep.inventoryId || '';
    const depIngredient = dep.inventoryItemName || dep.ingredientName || dep.itemName || dep.name || '';
    const depMenu = dep.menuItemName || dep.recipeName || dep.dishName || dep.menuName || '';
    if (itemId && depItemId === itemId) return true;
    return getVoiceMatchScore(requested, depIngredient) >= 78 || getVoiceMatchScore(requested, depMenu) >= 116;
  }).map(dep => ({
    menuItemName: dep.menuItemName || dep.recipeName || dep.dishName || dep.menuName || dep.name || 'Menu item',
    ingredientName: dep.inventoryItemName || dep.ingredientName || dep.itemName || itemName,
    severity: dep.severity || dep.impactSeverity || dep.impact || 'check stock'
  }));
};

const extractVoiceMenuImpactQuestion = (text = '') => {
  const q = normalizeVoiceText(text);
  const patterns = [
    /^what\s+does\s+(.+?)\s+(?:affect|impact)\??$/,
    /^what\s+menu\s+items\s+(?:use|need|have)\s+(.+)\??$/,
    /^if\s+(?:we are|we're|were)\s+out\s+of\s+(.+?)\s+what\s+(?:can'?t|cannot|can't)\s+we\s+make\??$/,
    /^(?:show|find|check)\s+(?:menu\s+)?(?:impact|effects?)\s+(?:for|of|from)\s+(.+)$/
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) return cleanVoiceItemName(match[1]);
  }
  return '';
};

const isVoiceWorkStatusQuestion = (text = '') => {
  const q = normalizeVoiceText(text);
  return /\b(what needs done|what needs to be done|what prep is left|prep left|how many prep tasks are left|what needs attention|any urgent issues|what is late|what's late|whats late)\b/.test(q);
};

const isVoiceOutOfStockQuestion = (text = '') => {
  const q = normalizeVoiceText(text);
  return /\b(what are we out of|what am i out of|what is eighty sixed|what is 86ed|what's 86|whats 86|active 86|low stock)\b/.test(q);
};

const getActiveVoice86Alerts = (events = []) => (events || [])
  .filter(event => {
    const haystack = normalizeVoiceText(`${event.title || ''} ${event.category || ''} ${event.messageCategory || ''} ${event.notes || ''}`);
    return event.type === 'note' && (event.isImportant || event.commandCenterAlert || event.managerBriefAlert) && /\b(86|eighty six|out of|alert)\b/.test(haystack);
  })
  .slice(0, 8);

const buildVoiceOutOfStockSummary = ({ events = [], inventoryItems = [], appUser = {}, clientFeatures = {}, clientData = {} }) => {
  const alerts = getActiveVoice86Alerts(events);
  const canSeeInventory = canVoiceOpenTab(appUser, clientFeatures, 'inventory', clientData);
  const lowStock = canSeeInventory ? (inventoryItems || [])
    .filter(item => Number(item.parLevel || 0) > 0 && Number(item.currentStock || 0) <= Number(item.parLevel || 0))
    .sort((a, b) => (Number(a.currentStock || 0) - Number(a.parLevel || 0)) - (Number(b.currentStock || 0) - Number(b.parLevel || 0)))
    .slice(0, 8) : [];
  const lines = [];
  if (alerts.length) lines.push(`Active 86 alerts: ${alerts.map(a => a.title || a.inventoryItemName || '86 alert').join(', ')}.`);
  if (lowStock.length) lines.push(`Low stock: ${lowStock.map(i => `${i.name || 'Item'} (${i.currentStock || 0}/${i.parLevel || 0})`).join(', ')}.`);
  if (!alerts.length && !lowStock.length) lines.push(canSeeInventory ? 'No active 86 alerts or low-stock items were found in the current workspace snapshot.' : 'No active 86 alerts were found. Low-stock inventory is restricted for your account.');
  return lines.join(' ');
};

const buildVoiceWorkStatusSummary = ({ prepItems = [], tasks = [], events = [], inventoryItems = [], maintenanceLogs = [], appUser = {}, clientFeatures = {}, clientData = {} }) => {
  const today = getToday();
  const openPrep = (prepItems || []).filter(item => (item.date === today || item.date === 'MASTER' || item.isMaster) && !isVoicePrepDone(item, today)).slice(0, 8);
  const openTasks = (tasks || []).filter(task => {
    const key = getVoiceTaskPeriodKey(task.frequency || 'daily', today);
    return !task?.completions?.[key];
  }).slice(0, 8);
  const alerts = getActiveVoice86Alerts(events).slice(0, 5);
  const lowSummary = buildVoiceOutOfStockSummary({ events: [], inventoryItems, appUser, clientFeatures, clientData });
  const canSeeMaintenance = canVoiceOpenTab(appUser, clientFeatures, 'maintenance', clientData);
  const urgentMaint = canSeeMaintenance ? (maintenanceLogs || []).filter(m => !['completed','closed','resolved'].includes(normalizeVoiceText(m.status || ''))).slice(0, 5) : [];
  const parts = [];
  parts.push(openPrep.length ? `Open prep: ${openPrep.map(p => p.text || p.title || p.name || 'Prep item').join(', ')}.` : 'Prep looks clear for today.');
  parts.push(openTasks.length ? `Open tasks: ${openTasks.map(t => t.title || t.text || t.name || 'Task').join(', ')}.` : 'No open daily/weekly/monthly task rows were found.');
  if (alerts.length) parts.push(`Active alerts: ${alerts.map(a => a.title || '86 alert').join(', ')}.`);
  if (urgentMaint.length) parts.push(`Maintenance needing attention: ${urgentMaint.map(m => m.equipment || m.issue || 'Maintenance issue').join(', ')}.`);
  if (!/No active 86 alerts/.test(lowSummary)) parts.push(lowSummary);
  return parts.join(' ');
};

const fetchVoiceEightySixContext = async (restaurantId = '', loadedInventoryItems = [], loadedMenuDependencies = [], options = {}) => {
  const inventoryById = new Map();
  const depById = new Map();
  (loadedInventoryItems || []).forEach(item => { if (item?.id) inventoryById.set(item.id, item); });
  (loadedMenuDependencies || []).forEach(dep => { if (dep?.id) depById.set(dep.id, dep); });
  if (!restaurantId) {
    return { inventoryItems: Array.from(inventoryById.values()), menuDependencies: Array.from(depById.values()) };
  }
  const allowInventory = options.allowInventory !== false;
  const allowMenuDependencies = options.allowMenuDependencies !== false;
  try {
    const reads = [];
    if (allowInventory) reads.push(getDocs(query(collection(db, 'inventoryItems'), where('restaurantId', '==', restaurantId))));
    if (allowMenuDependencies) reads.push(getDocs(query(collection(db, 'menuDependencies'), where('restaurantId', '==', restaurantId))));
    const snaps = await Promise.all(reads);
    let idx = 0;
    if (allowInventory) {
      const inventorySnap = snaps[idx++];
      inventorySnap.forEach(docSnap => inventoryById.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    }
    if (allowMenuDependencies) {
      const depSnap = snaps[idx++];
      depSnap.forEach(docSnap => depById.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    }
  } catch (err) {
    console.warn('86 Voice 86-context refresh failed; using loaded snapshots.', err?.message || err);
  }
  return { inventoryItems: Array.from(inventoryById.values()), menuDependencies: Array.from(depById.values()) };
};

const makeVoiceNav = ({ label, tab, summary, subTab = null, date = null, helpQuery = '', localSearch = '' }) => ({
  intent: helpQuery ? 'help_search' : (subTab ? 'navigate_schedule' : 'navigate'),
  label, tab, subTab, date, helpQuery, localSearch, summary, safe:true
});

const extractHelpSearchQuery = (raw = '') => {
  const q = normalizeVoiceText(raw);
  const patterns = [
    /^(?:search|find|look up)\s+(?:the\s+)?(?:help center|help|manual|administrator manual)\s*(?:for|about|on)?\s+(.+)$/,
    /^(?:help center|help|manual|administrator manual)\s+(?:search|find|look up)\s*(?:for|about|on)?\s+(.+)$/,
    /^(?:show|open|go to|take me to)\s+(?:the\s+)?(?:help center|help|manual)\s+(?:for|about|on)\s+(.+)$/,
    /^(?:help me with|help with|how do i|how to)\s+(.+)$/
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) return cleanVoiceItemName(match[1]);
  }
  return '';
};
const inferVoiceBurnMode = (text = '', item = {}) => {
  const q = normalizeVoiceText(text);
  if (/\b(lb|lbs|pound|pounds|oz|ounce|ounces)\b/.test(q)) return 'weight';
  if (/\b(case|cases|box|boxes|stock unit|stock units)\b/.test(q)) return 'stock';
  return item?.burnDefaultMode || 'count';
};
const getVoiceUnitsPerStockUnit = (item = {}) => Math.max(1, parseFloat(item.unitsPerStockUnit || item.unitsPerCase || item.yieldQty || item.caseQty || 1) || 1);
const getVoiceWeightPerStockUnit = (item = {}) => {
  const direct = parseFloat(item.weightPerStockUnit || item.caseWeight || item.packWeight || item.weightLbs || 0) || 0;
  if (direct > 0) return direct;
  const pack = String(item.packSize || item.size || '').toLowerCase();
  const m = pack.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds)/);
  return m ? parseFloat(m[1]) : 0;
};


const buildVoiceNavigationAction = (q = '') => {
  const date = parseNextWeekday(q);
  if (/\b(manager brief|today brief|today command center|home screen|home|dashboard)\b/.test(q)) return makeVoiceNav({ label:'Open Manager Brief', tab:'today', summary:'Open Manager Brief.' });
  if (/\b(kitchen command center|ops command center|ops center|kitchen command|command center)\b/.test(q)) return makeVoiceNav({ label:'Open Kitchen Command Center', tab:'ops', summary:'Open Kitchen Command Center.' });
  if (/\b(schedule builder|schedule maker|builder|copilot|coverage target|coverage targets|smart fill)\b/.test(q)) return makeVoiceNav({ label:'Open Schedule Builder', tab:'schedule', subTab:'schedule-builder', date, summary:'Open Time Clock & Schedule → Schedule Builder.' });
  if (/\b(month view|monthly view|month schedule|calendar view)\b/.test(q)) return makeVoiceNav({ label:'Open Month View', tab:'published', subTab:'month-view', date, summary:'Open Time Clock & Schedule → Month View.' });
  if (/\b(my schedule|my shifts|mine|my shift|next shift|time clock|clock in|clock out)\b/.test(q)) return makeVoiceNav({ label:'Open My Schedule', tab:'published', subTab:'my-schedule', date, summary:'Open Time Clock & Schedule → My Schedule.' });
  if (/\b(trade board|shift swap|swap board)\b/.test(q)) return makeVoiceNav({ label:'Open Trade Board', tab:'published', subTab:'trade-board', date, summary:'Open Time Clock & Schedule → Trade Board.' });
  if (/\b(time off|request off|vacation request|availability)\b/.test(q)) return makeVoiceNav({ label:'Open Time Off', tab:'published', subTab:'time-off', date, summary:'Open Time Clock & Schedule → Request Off.' });
  if (/\b(full schedule|schedule days|published schedule|whole schedule|team schedule|all schedule|everyone schedule|schedule)\b/.test(q) && !/\b(my schedule|my shifts|mine|my shift|schedule builder|schedule maker)\b/.test(q)) return makeVoiceNav({ label:'Open Full Schedule', tab:'published', subTab:'full-schedule', date, summary: date ? `Open the full schedule on ${formatDisplayDate(date)}.` : 'Open Time Clock & Schedule → Full Schedule.' });
  if (/\b(staff list|staff roster|team list|employee list|employees|roster|team)\b/.test(q)) return makeVoiceNav({ label:'Open Staff Roster', tab:'team', summary:'Open Staff Roster.' });
  if (/\b(inventory|orders|order guide|stock count|stock)\b/.test(q)) return makeVoiceNav({ label:'Open Inventory', tab:'inventory', summary:'Open Inventory & Orders.' });
  if (/\b(prep list|prep tasks|prep and tasks|prep)\b/.test(q) && !isLikelyPrepCommand(q)) return makeVoiceNav({ label:'Open Prep', tab:'prep', summary:'Open Prep & Tasks.' });
  if (/\b(reminder|reminders|my reminders)\b/.test(q)) return makeVoiceNav({ label:'Open My Reminders', tab:'reminders', summary:'Open your private reminders.' });
  if (/\b(menu intelligence|menu scanner|menu scan|scan menu|intelligent menu)\b/.test(q)) return makeVoiceNav({ label:'Open Menu Intelligence', tab:'menu-intelligence', summary:'Open Menu Intelligence.' });
  if (/\b(recipe book|recipes|recipe|spec sheet)\b/.test(q)) return makeVoiceNav({ label:'Open Recipes', tab:'recipes', summary:'Open Recipe Book.' });
  if (/\b(message board|messages|message|announcement|announcements)\b/.test(q)) return makeVoiceNav({ label:'Open Messages', tab:'messages', summary:'Open the Message Board.' });
  if (/\b(maintenance log|maintenance|repair|broken|fix it)\b/.test(q)) return makeVoiceNav({ label:'Open Maintenance', tab:'maintenance', summary:'Open the Maintenance Log.' });
  if (/\b(labor|timesheet|time sheet|financial|financials|daily ledger|sales)\b/.test(q)) return makeVoiceNav({ label:'Open Financials', tab:'financials', summary:'Open Financials for labor, timesheets, and daily ledger.' });
  if (/\b(help center|help|manual)\b/.test(q)) return makeVoiceNav({ label:'Open Help Center', tab:'help', summary:'Open Help Center.' });
  if (/\b(settings|preferences|workspace settings)\b/.test(q)) return makeVoiceNav({ label:'Open Settings', tab:'settings', summary:'Open Settings.' });
  if (/\b(system administrator|administrator|admin)\b/.test(q)) return makeVoiceNav({ label:'Open System Administrator', tab:'godmode', summary:'Open System Administrator.' });
  return null;
};

const isPlainNavigationPhrase = (q = '') => {
  const cleaned = q.replace(/\b(open|go to|show|take me to|pull up|bring up|display|take me|please)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.split(' ').length <= 4 && !!buildVoiceNavigationAction(cleaned);
};


const normalizeVoiceReminderTitle = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildVoiceClientCommandId = (voiceSessionId = '', action = {}, sourceText = '') => [
  'voice-reminder',
  voiceSessionId || 'manual',
  normalizeVoiceReminderTitle(action.title || sourceText).slice(0, 60),
  String(action.scheduledAt || action.dueAt || '').slice(0, 25),
  action.intent || 'reminder'
].join(':');

const VoiceCommandDock = ({ appUser, inventoryItems = [], recipes = [], users = [], prepItems = [], tasks = [], events = [], maintenanceLogs = [], menuDependencies = [], clientFeatures = {}, clientData = {}, setActiveTab, setCurrentDate, setScheduleSubTabTarget, setHelpSearchTarget, setRecipeTarget, addToast }) => {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heardText, setHeardText] = useState('');
  const [manualText, setManualText] = useState('');
  const [pending, setPending] = useState(null);
  const [lastUndo, setLastUndo] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);
  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const canUseSpeech = Boolean(SpeechRecognition);
  const eightySixContextRef = useRef({ restaurantId: '', loadedAt: 0, inventoryItems: [], menuDependencies: [] });
  const voiceSessionRef = useRef({ id: '', startedAt: 0, commits: 0, finalFingerprint: '' });
  const processedVoiceCommandRef = useRef(new Set());

  const resetVoiceReminderSession = () => {
    const id = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    voiceSessionRef.current = { id, startedAt: Date.now(), commits: 0, finalFingerprint: '' };
    return id;
  };

  const findRecentReminderDuplicate = async ({ title, scheduledAt, visibility, assignedToUserId, clientCommandId }) => {
    if (!appUser?.restaurantId) return null;
    const titleNormalized = normalizeVoiceReminderTitle(title);
    const since = Date.now() - 30000;
    try {
      const snap = await getDocs(query(
        collection(db, 'personalReminders'),
        where('restaurantId', '==', appUser.restaurantId),
        where('createdBy', '==', appUser.id || '')
      ));
      let found = null;
      snap.forEach(docSnap => {
        if (found) return;
        const r = { id: docSnap.id, ...docSnap.data() };
        const createdAt = new Date(r.createdAt || r.updatedAt || 0).getTime();
        if (!Number.isFinite(createdAt) || createdAt < since) return;
        const sameCommand = clientCommandId && r.clientCommandId === clientCommandId;
        const sameTitle = normalizeVoiceReminderTitle(r.title || r.titleNormalized || '') === titleNormalized;
        const sameDue = String(r.scheduledAt || r.dueAt || '') === String(scheduledAt || '');
        const sameVisibility = String(r.visibility || '') === String(visibility || '');
        const sameAssignee = String(r.assignedToUserId || '') === String(assignedToUserId || '');
        if (sameCommand || (sameTitle && sameDue && sameVisibility && sameAssignee)) found = r;
      });
      return found;
    } catch (err) {
      console.warn('Voice reminder duplicate check failed:', err?.message || err);
      return null;
    }
  };

  const getVoiceEightySixContext = async () => {
    const now = Date.now();
    const cached = eightySixContextRef.current || {};
    if (cached.restaurantId === appUser?.restaurantId && now - Number(cached.loadedAt || 0) < 90000 && cached.inventoryItems?.length) {
      return { inventoryItems: cached.inventoryItems || [], menuDependencies: cached.menuDependencies || [] };
    }
    const fresh = await fetchVoiceEightySixContext(appUser?.restaurantId, inventoryItems, menuDependencies, {
      allowInventory: canVoiceOpenTab(appUser, clientFeatures, 'inventory', clientData) || isVoiceSuperAdmin(appUser),
      allowMenuDependencies: canUseMenuIntelligence(appUser, clientData) || isVoiceSuperAdmin(appUser)
    });
    eightySixContextRef.current = { restaurantId: appUser?.restaurantId || '', loadedAt: now, ...fresh };
    return fresh;
  };

  const openDock = () => {
    setOpen(true);
    setPending(null);
    setHeardText('');
    setManualText('');
    setVoiceResult(null);
    setTimeout(() => startListening(), 80);
  };

  const parseCommand = async (spokenText) => {
    const raw = String(spokenText || '').trim();
    const q = normalizeVoiceText(raw);
    if (!q) return null;

    if (isVoiceUndoCommand(raw)) {
      return { intent:'undo_last_voice', label:'Undo last voice command', summary:'Undo the most recent safe voice action if rollback is available.', needsConfirmation:false, safe:true };
    }

    if (isVoiceWorkStatusQuestion(raw)) {
      return {
        intent:'status_summary',
        label:'What needs done',
        summary: buildVoiceWorkStatusSummary({ prepItems, tasks, events, inventoryItems, maintenanceLogs, appUser, clientFeatures, clientData }),
        tab:'prep',
        safe:true,
        needsConfirmation:false
      };
    }

    if (isVoiceOutOfStockQuestion(raw)) {
      return {
        intent:'out_of_stock_summary',
        label:'What are we out of',
        summary: buildVoiceOutOfStockSummary({ events, inventoryItems, appUser, clientFeatures, clientData }),
        tab:'messages',
        safe:true,
        needsConfirmation:false
      };
    }

    const impactQuestion = extractVoiceMenuImpactQuestion(raw);
    if (impactQuestion) {
      if (!canUseMenuIntelligence(appUser, clientData) && !isVoiceSuperAdmin(appUser)) {
        return { intent:'blocked', label:'Menu impact unavailable', summary:'Menu impact questions require Menu Intelligence access for this workspace and user.', blocked:true, needsConfirmation:false, safe:true };
      }
      const liveContext = await getVoiceEightySixContext();
      const voiceInventoryItems = liveContext.inventoryItems || inventoryItems || [];
      const voiceMenuDependencies = liveContext.menuDependencies || menuDependencies || [];
      const match = resolveVoiceMatch(voiceInventoryItems, impactQuestion, { getLabel: item => item.name || item.title || '', getAliases: item => [item.category, item.vendor, ...(Array.isArray(item.aliases) ? item.aliases : [])].filter(Boolean), minScore: 40, highThreshold: 90, margin: 14 });
      const subject = match.top?.item || impactQuestion;
      const impactRows = getVoiceMenuImpactRows(subject, voiceInventoryItems, voiceMenuDependencies);
      const displayName = match.top?.item?.name || impactQuestion;
      return {
        intent:'menu_impact_answer',
        label:`Menu impact: ${displayName}`,
        itemName: displayName,
        impactRows,
        matchConfidence: match.confidence,
        summary: impactRows.length
          ? `${displayName} affects: ${impactRows.slice(0, 8).map(row => `${row.menuItemName}${row.severity ? ` (${row.severity})` : ''}`).join(', ')}.`
          : 'Menu impact needs approved menu ingredient links first. Scan or enter the menu, review the ingredient links, and approve them before 86Voice can answer impact questions.',
        safe:true,
        needsConfirmation:false
      };
    }

    const parsedRecurringReminder = parseVoiceRecurringReminderPayload(raw);
    if (parsedRecurringReminder) {
      return {
        intent:'create_personal_reminder',
        label:`Create ${parsedRecurringReminder.recurrenceLabel} reminder`,
        title: parsedRecurringReminder.title,
        scheduledAt: parsedRecurringReminder.scheduledAt,
        recurrence: parsedRecurringReminder.recurrence,
        summary:`Create a ${parsedRecurringReminder.recurrenceLabel} reminder: ${parsedRecurringReminder.title} starting ${formatClockDateTime(parsedRecurringReminder.scheduledAt)}.`,
        needsConfirmation:false,
        safe:true
      };
    }

    const parsedSharedReminder = parseVoiceSharedReminderPayload(raw);
    if (parsedSharedReminder) {
      const resolvedUser = resolveVoiceUserMatch(users, parsedSharedReminder.assigneePhrase);
      if (!canVoiceShareReminder(appUser, clientData)) {
        return { intent:'blocked', label:'Shared reminder blocked', summary:'You do not have permission to assign shared reminders by voice.', blocked:true, needsConfirmation:false, safe:true };
      }
      if (parsedSharedReminder.needsManualTime) {
        return { intent:'navigate', label:'Open My Reminders', tab:'reminders', summary:'Open My Reminders so you can choose the exact shared reminder date and time.', safe:true };
      }
      if (!resolvedUser.isHighConfidence || !resolvedUser.top?.item) {
        return {
          intent:'shared_reminder_review',
          label:'Choose teammate for reminder',
          assigneePhrase: parsedSharedReminder.assigneePhrase,
          title: parsedSharedReminder.title,
          scheduledAt: parsedSharedReminder.scheduledAt,
          candidates: resolvedUser.alternatives,
          summary: resolvedUser.alternatives.length ? `I found more than one possible teammate for “${parsedSharedReminder.assigneePhrase}.” Choose the right person before sharing.` : `I could not find a teammate matching “${parsedSharedReminder.assigneePhrase}.”`,
          needsConfirmation:true,
          safe:true
        };
      }
      return {
        intent:'create_shared_reminder',
        label:`Share reminder with ${resolvedUser.top.item.name || resolvedUser.top.item.email}`,
        assignee: resolvedUser.top.item,
        title: parsedSharedReminder.title,
        scheduledAt: parsedSharedReminder.scheduledAt,
        matchConfidence: resolvedUser.confidence,
        summary:`Share reminder with ${resolvedUser.top.item.name || resolvedUser.top.item.email}: ${parsedSharedReminder.title} at ${formatClockDateTime(parsedSharedReminder.scheduledAt)}.`,
        needsConfirmation:true,
        safe:true
      };
    }

    const parsedReminder = parseReminderCommand(raw);
    if (parsedReminder) {
      if (parsedReminder.needsManualTime) {
        return { intent:'navigate', label:'Open My Reminders', tab:'reminders', summary:'Open My Reminders so you can choose the exact date and time.', safe:true };
      }
      return {
        intent:'create_personal_reminder',
        label:'Create personal reminder',
        ...parsedReminder,
        summary:`Remind you: ${parsedReminder.title} at ${formatClockDateTime(parsedReminder.scheduledAt)}.`,
        needsConfirmation:false
      };
    }

    // Specific recipe commands should open/search the live Recipe Book by title, including future recipes.
    // Keep this ahead of generic navigation so “open beer cheese recipe” does not stop at the Recipe Book landing page.
    const recipeQuery = extractRecipeVoiceQuery(raw);
    if (recipeQuery) {
      const recipe = findVoiceRecipeMatch(recipes, recipeQuery);
      const displayName = recipe?.title || recipeQuery;
      return {
        intent:'open_recipe',
        label:`Open recipe: ${displayName}`,
        tab:'recipes',
        recipeQuery,
        recipeTitle: recipe?.title || '',
        recipeId: recipe?.id || '',
        summary: recipe?.title
          ? `Open Recipe Book directly to ${recipe.title}.`
          : `Open Recipe Book and search for “${recipeQuery}”. If the recipe exists now or is added later, the app will use the recipe list instead of a hardcoded command.`,
        safe:true,
        needsConfirmation:false
      };
    }

    // Help Center search commands. These must open Help Center and pre-fill only the useful search phrase.
    const helpSearch = extractHelpSearchQuery(raw);
    if (helpSearch) {
      return makeVoiceNav({ label:'Search Help Center', tab:'help', helpQuery: helpSearch, summary:`Search Help Center for “${helpSearch}”.` });
    }

    // Navigation commands first because they are safe and fast.
    if (/\b(open|go to|show|take me to|pull up|bring up|display)\b/.test(q) || isPlainNavigationPhrase(q)) {
      const navAction = buildVoiceNavigationAction(q);
      if (navAction) return navAction;
      const recipePhrase = q.replace(/\b(open|go to|show|take me to|pull up|bring up|display|recipe|recipes)\b/g, ' ').trim();
      const recipe = findVoiceMatch(recipes, recipePhrase);
      if (recipe) return makeVoiceNav({ label:`Open recipe: ${recipe.title}`, tab:'recipes', summary:`Open Recipe Book and search for ${recipe.title}.`, localSearch: recipe.title });
    }

    // 86 / out-of-stock commands. These create an 86 alert only. They do NOT edit inventory.
    let itemPhrase = '';
    if (/\b(86|eighty six)\b/.test(q)) itemPhrase = q.replace(/\b(86|eighty six|item|the|please|send|post|alert|for)\b/g, ' ');
    const outPatterns = [
      /^(?:we are|we're|were)\s+(?:all\s+)?out of\s+(.+)$/,
      /^(?:we are|we're|were)\s+outta\s+(.+)$/,
      /^(?:we\s+)?ran out of\s+(.+)$/,
      /^out of\s+(.+)$/,
      /^all out of\s+(.+)$/,
      /^no more\s+(.+)$/,
      /^kill\s+(.+?)(?:\s+for\s+tonight|\s+tonight)?$/
    ];
    if (!itemPhrase) {
      for (const pattern of outPatterns) {
        const match = q.match(pattern);
        if (match?.[1]) { itemPhrase = match[1]; break; }
      }
    }
    if (itemPhrase) {
      const cleaned = cleanVoiceItemName(itemPhrase);
      const liveContext = await getVoiceEightySixContext();
      const voiceInventoryItems = liveContext.inventoryItems || inventoryItems || [];
      const voiceMenuDependencies = liveContext.menuDependencies || menuDependencies || [];
      const resolved = resolveStrictEightySixMatch(cleaned, voiceInventoryItems, voiceMenuDependencies);
      const requestedItemName = cleaned || 'Item';

      if (resolved.status !== 'strong' || !resolved.item?.id) {
        if (resolved.candidates?.length) {
          return {
            intent:'eighty_six_review',
            label:`Review 86 item: ${requestedItemName}`,
            requestedItemName,
            candidates: resolved.candidates || [],
            resolvedMenuDependencies: voiceMenuDependencies,
            summary:`I could not safely choose one inventory item for “${requestedItemName}.” Select the correct item below. Nothing will be sent or changed until you choose an item and confirm the alert.`,
            highRisk:true,
            needsConfirmation:true
          };
        }
        return {
          intent:'eighty_six_text_alert',
          label:`Confirm 86 alert: ${requestedItemName}`,
          requestedItemName,
          resolvedMenuDependencies: voiceMenuDependencies,
          summary:`Confirm a basic 86 alert for “${requestedItemName}.” I did not find approved inventory/menu links yet, so the alert will include setup guidance and inventory stock will not be changed.`,
          highRisk:true,
          needsConfirmation:true,
          matchVerified:false
        };
      }

      const item = resolved.item;
      const impactPreview = buildEightySixAlertDetails({ requestedName: requestedItemName, inventoryItem: item, menuDependencies: voiceMenuDependencies, matchMethod: resolved.method, matchedMenuItemName: resolved.matchedMenuItemName }).impactText;
      const matchNote = normalizeVoiceText(item.name) !== normalizeVoiceText(requestedItemName)
        ? ` Matched inventory item: ${item.name}${resolved.method === 'menuIntelligence' ? ' through Menu Intelligence' : ''}.`
        : '';
      return {
        intent:'eighty_six_alert',
        label:`Confirm 86 alert: ${item.name}`,
        item,
        itemName:item.name,
        requestedItemName,
        menuMatchMethod: resolved.method,
        matchedMenuItemName: resolved.matchedMenuItemName || '',
        matchedIngredientName: resolved.matchedIngredientName || '',
        matchConfidence: resolved.confidence || 0,
        matchVerified:true,
        resolvedMenuDependencies: voiceMenuDependencies,
        summary:`Confirm the important 86 alert for ${item.name}.${matchNote}${impactPreview ? ` ${impactPreview}.` : ''} Inventory stock will not be changed.`,
        highRisk:true,
        needsConfirmation:true
      };
    }

    // Mark prep-list or recurring task items done by voice. The parser uses fuzzy matching because kitchen speech rarely matches the row exactly.
    const parsedCompletion = extractVoiceCompletionPayload(raw);
    if (parsedCompletion) {
      const resolvedCompletion = await resolveVoiceCompletionMatch({
        restaurantId: appUser?.restaurantId,
        parsed: parsedCompletion,
        prepItems,
        tasks
      });
      if (resolvedCompletion.isConfident && resolvedCompletion.top) {
        const candidate = resolvedCompletion.top;
        return {
          intent:'complete_list_item',
          label:`Mark done: ${candidate.label}`,
          ...candidate,
          requestedItemName: parsedCompletion.itemText,
          summary:`Mark ${candidate.label} done on ${candidate.listLabel}${candidate.alreadyDone ? ' (already marked done)' : ''}.`,
          needsConfirmation:false,
          safe:true
        };
      }
      if (resolvedCompletion.candidates.length) {
        return {
          intent:'complete_list_review',
          label:`Choose item to mark done`,
          requestedItemName: parsedCompletion.itemText,
          candidates: resolvedCompletion.candidates,
          summary:`I heard “${parsedCompletion.itemText}.” Choose the matching prep item or task so I do not mark the wrong row done.`,
          needsConfirmation:true,
          safe:true
        };
      }
      return {
        intent:'navigate',
        label:'Open Prep & Tasks',
        tab:'prep',
        summary:`I could not find an open prep item or task matching “${parsedCompletion.itemText}.” Opening Prep & Tasks so you can check the list.`,
        safe:true
      };
    }

    // Daily/weekly/monthly task commands. 86Voice upserts when a matching routine already exists.
    // Keep this ahead of prep parsing so “add weekly task clean fryer” becomes a task, not a prep item.
    const parsedTaskUpsert = parseVoiceTaskUpsertPayload(raw);
    if (parsedTaskUpsert) {
      return {
        intent:'upsert_task',
        label:`Update ${parsedTaskUpsert.frequency} task`,
        ...parsedTaskUpsert,
        summary:`Add or update ${describeRecurringTaskSchedule(parsedTaskUpsert)} task: ${parsedTaskUpsert.title}. Managers/admins only.`,
        needsConfirmation:false
      };
    }

    // Prep tasks. Only the useful item name goes into the prep name field.
    // Quantities are stored separately so “prep 2 of ranch” becomes qty=2, text=Ranch.
    if (isLikelyPrepCommand(raw)) {
      const parsedPrepItems = parsePrepCommandItems(raw);
      if (parsedPrepItems.length) {
        const prepDate = parsedPrepItems.find(item => item.prepDate)?.prepDate || getToday();
        const preview = parsedPrepItems.slice(0, 3).map(item => `${item.itemText} (${formatPrepAmount(item.amount, item.unit)}${item.station ? ` • ${item.station}` : ''})`).join(', ');
        return {
          intent:'smart_prep',
          label:'Update prep list',
          prepItems: parsedPrepItems,
          prepDate,
          summary:`Update prep list for ${formatDisplayDate(prepDate)}: ${preview}${parsedPrepItems.length > 3 ? '...' : ''}.`,
          needsConfirmation:false
        };
      }
    }

    // Message board posts.
    if (/\b(post|send|message|announce|announcement)\b/.test(q)) {
      const msg = raw.replace(/^(post|send|message|announce|announcement)\s*(message|announcement)?\s*:?\s*/i, '').trim() || raw;
      return { intent:'post_message', label:'Post message', messageText: msg, summary:`Post to Message Board: “${msg}”`, needsConfirmation:true };
    }

    // Maintenance.
    if (/\b(report|maintenance|broken|leaking|not working|won't|wont)\b/.test(q)) {
      const issue = raw.replace(/^(report|maintenance|add maintenance issue)\s*/i, '').trim() || raw;
      return { intent:'maintenance', label:'Create maintenance issue', issue, summary:`Create maintenance issue: ${issue}`, needsConfirmation:true };
    }

    // Burn/waste.
    if (/\b(waste|burn|spill|spilled|throw away|toss)\b/.test(q)) {
      const amount = parseVoiceAmount(q);
      const itemPhrase = q.replace(/\b(waste|burn|log|record|spilled|spill|throw away|toss|of|the|please)\b/g, ' ').replace(/\b\d+(?:\.\d+)?\b/g, ' ').trim();
      const item = findVoiceMatch(inventoryItems, itemPhrase);
      if (item) {
        const mode = inferVoiceBurnMode(q, item);
        const weightPerStockUnit = getVoiceWeightPerStockUnit(item);
        const unitsPerStockUnit = getVoiceUnitsPerStockUnit(item);
        const stockDeducted = mode === 'weight'
          ? (weightPerStockUnit > 0 ? amount / weightPerStockUnit : 0)
          : mode === 'stock'
            ? amount
            : amount / unitsPerStockUnit;
        const label = mode === 'weight' ? 'lb' : mode === 'stock' ? 'stock unit' : (item.burnUnitLabel || 'unit');
        const needsSetup = mode === 'weight' && weightPerStockUnit <= 0;
        return { intent:'burn_log', label:`Log burn: ${item.name}`, item, amount, mode, labelUnit:label, stockDeducted, needsSetup, summary: needsSetup ? `Open Inventory to set weight per stock unit for ${item.name} before logging a weight burn.` : `Log ${amount} ${label} ${item.name} and deduct ${stockDeducted.toFixed(3)} stock units.`, needsConfirmation:!needsSetup, safe:needsSetup };
      }
      return { intent:'navigate', label:'Open Burn Log', tab:'inventory', summary:'Open Inventory/Burn Log. I could not confidently match the item.', safe:true };
    }

    // Optional AI fallback. If the route is not installed, ignore and use help.
    try {
      const res = await secureFetch('/api/voice-command', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ text: raw, restaurantId: appUser?.restaurantId })
      });
      if (res.ok) {
        const ai = await res.json();
        if (ai?.intent === 'eighty_six_alert') {
          return {
            intent:'eighty_six_review',
            label:'Review 86 item',
            requestedItemName: cleanVoiceItemName(ai.itemName || ai.requestedItemName || raw),
            candidates:[],
            summary:'AI recognized a possible 86 command, but AI is not allowed to select or send a risky 86 alert. Use the exact inventory item name and try again.',
            highRisk:true,
            needsConfirmation:true
          };
        }
        if (ai?.intent && ai.intent !== 'unknown') {
          const safeAiIntents = ['navigate', 'navigate_schedule', 'help', 'help_search'];
          if (safeAiIntents.includes(ai.intent)) return { ...ai, summary: ai.summary || `AI suggested: ${ai.intent}`, needsConfirmation: true, source:'optional_ai_voice_parser' };
          return { intent:'help', label:'Search Help', tab:'help', summary:`I recognized a possible ${ai.intent} command, but 86Voice needs the local parser or a review screen before changing restaurant data. Try a more direct phrase or open the target screen.`, safe:true };
        }
      }
    } catch(e) {}

    return { intent:'help', label:'Search Help', tab:'help', summary:`I could not safely turn “${raw}” into an action. Opening Help Center/search is safer.`, safe:true };
  };

  const processText = async (text) => {
    if (pending && /\b(cancel|never mind|nevermind|stop|scratch that)\b/i.test(String(text || ''))) {
      setPending(null);
      setVoiceResult({ label:'Voice command cancelled', summary:'Pending voice action was cancelled before anything else was saved.' });
      setHeardText(text);
      addToast('Voice Cancelled', 'Pending voice action cancelled.');
      return;
    }
    const action = await parseCommand(text);
    setHeardText(text);
    if (!action) return addToast('Voice Command', 'I did not hear a command. Try again or type it.');
    const actionWithVoiceMeta = sourceMeta.fromVoice ? { ...action, voiceSessionId: sourceMeta.voiceSessionId, createdFromFinalTranscript: true } : action;
    setPending(actionWithVoiceMeta);
    const instantIntents = ['navigate', 'navigate_schedule', 'help_search', 'open_recipe', 'smart_prep', 'complete_list_item', 'create_personal_reminder', 'upsert_task', 'status_summary', 'out_of_stock_summary', 'menu_impact_answer', 'undo_last_voice', 'blocked'];
    if (!actionWithVoiceMeta.needsConfirmation && instantIntents.includes(actionWithVoiceMeta.intent)) {
      await executeAction(actionWithVoiceMeta, text, true, false);
    }
  };

  const startListening = () => {
    if (!canUseSpeech) return setOpen(true);
    try {
      const voiceSessionId = resetVoiceReminderSession();
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      setListening(true);
      setOpen(true);
      rec.onresult = (event) => {
        for (let i = event.resultIndex || 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result?.[0]?.transcript || '';
          if (!result?.isFinal) {
            setHeardText(text);
            continue;
          }
          const fingerprint = normalizeVoiceText(text);
          if (!fingerprint) continue;
          if (voiceSessionRef.current.finalFingerprint === fingerprint) {
            logAudit(appUser, 'VOICE_DUPLICATE_FINAL_BLOCKED', 'Duplicate final transcript', text);
            continue;
          }
          voiceSessionRef.current.finalFingerprint = fingerprint;
          setListening(false);
          try { rec.stop(); } catch (e) {}
          processText(text, { fromVoice: true, isFinal: true, voiceSessionId });
          break;
        }
      };
      rec.onerror = () => { setListening(false); addToast('Voice Error', 'Microphone recognition failed. You can type the command instead.'); };
      rec.onend = () => setListening(false);
      rec.start();
    } catch (err) {
      setListening(false);
      addToast('Voice Unavailable', 'Browser voice recognition is unavailable. Use the text box instead.');
    }
  };

  const rememberVoiceUndo = (label, operations = []) => {
    const safeOps = (operations || []).filter(op => op && op.collectionName && op.id && ['delete', 'update'].includes(op.kind));
    if (!safeOps.length) return;
    setLastUndo({ label, operations: safeOps, createdAt: Date.now() });
  };

  const runVoiceUndo = async (sourceText = '') => {
    if (!lastUndo?.operations?.length) {
      addToast('Nothing to Undo', 'No safe recent voice action can be undone here. Review it manually if needed.');
      return;
    }
    const tooOld = Date.now() - Number(lastUndo.createdAt || 0) > 10 * 60 * 1000;
    if (tooOld) {
      setLastUndo(null);
      addToast('Undo Expired', 'That voice action is too old to undo safely here. Review it manually.');
      return;
    }
    for (const op of lastUndo.operations) {
      if (op.kind === 'delete') await deleteDoc(doc(db, op.collectionName, op.id));
      if (op.kind === 'update') await updateDoc(doc(db, op.collectionName, op.id), { ...(op.data || {}), lastUndoAt: new Date().toISOString(), lastUndoBy: appUser?.id || appUser?.email || '', lastUndoSource: '86_voice_undo' });
    }
    await logAudit(appUser, 'VOICE_UNDO', lastUndo.label || 'Last voice action', sourceText || 'Undo last voice command');
    addToast('Voice Undo Complete', `${lastUndo.label || 'Last voice action'} was rolled back where possible.`);
    setVoiceResult({ label:'Undo complete', summary:`Rolled back: ${lastUndo.label || 'last safe voice action'}.` });
    setLastUndo(null);
  };

  const executeAction = async (actionToRun = pending, sourceText = heardText, closeWhenDone = true, confirmedByUser = false) => {
    if (!actionToRun || !appUser?.restaurantId) return;
    try {
      if (['navigate', 'navigate_schedule', 'help_search', 'open_recipe'].includes(actionToRun.intent)) {
        const targetTab = actionToRun.tab || 'today';
        if (!canVoiceOpenTab(appUser, clientFeatures, targetTab, clientData)) {
          addToast('Access Blocked', 'You do not have permission to open that area.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        if (actionToRun.date && setCurrentDate) setCurrentDate(actionToRun.date);
        if (actionToRun.subTab && setScheduleSubTabTarget) setScheduleSubTabTarget({ subTab: actionToRun.subTab, id: Date.now() });
        if (actionToRun.helpQuery && setHelpSearchTarget) setHelpSearchTarget({ query: actionToRun.helpQuery, id: Date.now() });
        if (actionToRun.intent === 'open_recipe' && setRecipeTarget) {
          setRecipeTarget({
            query: actionToRun.recipeQuery || actionToRun.recipeTitle || actionToRun.localSearch || '',
            recipeId: actionToRun.recipeId || '',
            recipeTitle: actionToRun.recipeTitle || '',
            id: Date.now()
          });
        }
        setActiveTab(targetTab);
        addToast('Voice Navigation', actionToRun.summary || `Opening ${targetTab}.`);
        if (closeWhenDone) setOpen(false);
        return;
      }
      if (actionToRun.intent === 'undo_last_voice') {
        await runVoiceUndo(sourceText);
        return;
      }
      if (['status_summary', 'out_of_stock_summary', 'menu_impact_answer'].includes(actionToRun.intent)) {
        setVoiceResult({ label: actionToRun.label || 'Voice Result', summary: actionToRun.summary || '', rows: actionToRun.impactRows || [], itemName: actionToRun.itemName || '', matchConfidence: actionToRun.matchConfidence || 0 });
        addToast(actionToRun.label || '86 Voice', actionToRun.summary || 'Done.');
        return;
      }
      if (actionToRun.intent === 'blocked') {
        await logAudit(appUser, 'VOICE_BLOCKED', actionToRun.label || 'Blocked voice command', `${sourceText} | ${actionToRun.summary || ''}`);
        setVoiceResult({ label: actionToRun.label || 'Blocked', summary: actionToRun.summary || 'This command is not available for your account.' });
        addToast(actionToRun.label || 'Access Blocked', actionToRun.summary || 'You do not have access to that voice action.');
        return;
      }
      if (appUser?.isDemo) return addToast('Demo Mode', 'Demo mode is read-only. Nothing was saved.');
      if (actionToRun.intent === 'eighty_six_review') {
        addToast('86 Review Required', 'Choose a specific inventory item before an 86 alert can be confirmed.');
        return;
      }
      if (actionToRun.intent === 'eighty_six_text_alert') {
        if (!confirmedByUser) {
          addToast('86 Alert Needs Confirmation', 'Confirm before posting a basic 86 alert. Inventory stock will not be changed.');
          return;
        }
        if (!voiceFeatureEnabled(clientFeatures, 'messages') || !canVoiceOpenTab(appUser, clientFeatures, 'messages', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_86_ALERT', actionToRun.requestedItemName || '86 alert', sourceText);
          addToast('Access Blocked', 'You do not have permission to post 86 alerts.');
          return;
        }
        const requestedName = String(actionToRun.requestedItemName || 'Item').trim();
        const alertTitle = `86 ${requestedName}`;
        const details = `Voice-created 86 alert. Inventory stock was not changed. Menu impact needs approved menu ingredient links first.`;
        await addDoc(collection(db, 'events'), {
          restaurantId: appUser.restaurantId,
          type:'note',
          category:'86 Alert',
          messageCategory:'86 Alert',
          title: alertTitle,
          notes: details,
          author: appUser.name || appUser.email || 'Voice Command',
          date:new Date().toISOString(),
          isImportant:true,
          replies:[],
          readBy: [{ userId: appUser.id, name: appUser.name, at: new Date().toISOString() }],
          voiceCommand: sourceText,
          createdAt:new Date().toISOString(),
          confirmedAt:new Date().toISOString(),
          confirmedBy:appUser.id || appUser.email || '',
          source:'86_voice_basic_text_alert',
          inventoryNotModified:true,
          commandCenterAlert:true,
          managerBriefAlert:true,
          kitchenCommandCenterAlert:true,
          menuImpact:'Menu impact needs approved menu ingredient links first.',
          menuImpactItems:[],
          requestedItemName: requestedName,
          voiceMatchStatus:'text_only_confirmed',
          voiceMatchConfidence:0
        });
        await logAudit(appUser, 'VOICE_86_TEXT_ALERT', requestedName, `${sourceText} | ${details}`);
        addToast('86 Alert Sent', `${requestedName} was posted as a basic 86 alert. Inventory was not changed.`);
        setActiveTab('today'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'eighty_six_alert') {
        if (!confirmedByUser || actionToRun.matchVerified !== true || !actionToRun.item?.id) {
          addToast('86 Alert Blocked', 'This high-risk alert needs a verified inventory match and your confirmation. Nothing was sent.');
          return;
        }
        if (!voiceFeatureEnabled(clientFeatures, 'messages') || !canVoiceOpenTab(appUser, clientFeatures, 'messages', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_86_ALERT', actionToRun.itemName || actionToRun.requestedItemName || '86 alert', sourceText);
          addToast('Access Blocked', 'You do not have permission to post 86 alerts.');
          return;
        }
        const freshContext = await fetchVoiceEightySixContext(appUser?.restaurantId, inventoryItems, menuDependencies, { allowInventory: true, allowMenuDependencies: canUseMenuIntelligence(appUser, clientData) || isVoiceSuperAdmin(appUser) });
        eightySixContextRef.current = { restaurantId: appUser?.restaurantId || '', loadedAt: Date.now(), ...freshContext };
        const liveItem = (freshContext.inventoryItems || []).find(item => item.id === actionToRun.item.id);
        if (!liveItem) {
          setPending({
            intent:'eighty_six_review',
            label:'Review 86 item again',
            requestedItemName: actionToRun.requestedItemName || actionToRun.itemName || '',
            candidates:[],
            summary:'The matched inventory item changed or is no longer available. No alert was sent. Search Inventory and try the command again.',
            highRisk:true,
            needsConfirmation:true
          });
          addToast('86 Match Changed', 'The inventory match could not be re-verified. Nothing was sent.');
          return;
        }
        const requestedPhrase = String(actionToRun.requestedItemName || liveItem.name || 'Item').trim();
        const requestedName = String(liveItem.name || requestedPhrase).trim();
        const alertTitle = `86 ${requestedName}`;
        const alertMenuDependencies = freshContext.menuDependencies || actionToRun.resolvedMenuDependencies || menuDependencies;
        const { inventoryName, impactText, impactedItems, matchText, details } = buildEightySixAlertDetails({
          requestedName: requestedPhrase,
          inventoryItem: liveItem,
          menuDependencies: alertMenuDependencies,
          matchMethod: actionToRun.menuMatchMethod,
          matchedMenuItemName: actionToRun.matchedMenuItemName
        });
        await addDoc(collection(db, 'events'), {
          restaurantId: appUser.restaurantId,
          type:'note',
          category:'86 Alert',
          messageCategory:'86 Alert',
          title: alertTitle,
          notes: details,
          author: appUser.name || appUser.email || 'Voice Command',
          date:new Date().toISOString(),
          isImportant:true,
          replies:[],
          readBy: [{ userId: appUser.id, name: appUser.name, at: new Date().toISOString() }],
          voiceCommand: sourceText,
          createdAt:new Date().toISOString(),
          confirmedAt:new Date().toISOString(),
          confirmedBy:appUser.id || appUser.email || '',
          source:'86_voice_alert',
          inventoryNotModified:true,
          commandCenterAlert:true,
          managerBriefAlert:true,
          kitchenCommandCenterAlert:true,
          menuImpact: impactText,
          menuImpactItems: impactedItems,
          menuImpactItemId: liveItem.id,
          inventoryItemName: inventoryName,
          requestedItemName: requestedPhrase,
          voiceMatchStatus: actionToRun.selectionConfirmed ? 'user_selected' : 'strict_match_confirmed',
          voiceMatchConfidence: Number(actionToRun.matchConfidence || 0),
          menuMatchMethod: actionToRun.menuMatchMethod || ''
        });
        await secureFetch('/api/send-push', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({
            restaurantId: appUser.restaurantId,
            title: alertTitle,
            body: `${requestedName} is out.${impactText ? ` ${impactText}.` : ''}${matchText ? ` ${matchText}` : ''}`,
            type:'message',
            isCritical:true,
            textContent: details ? `${alertTitle} - ${details}` : alertTitle
          })
        }).catch((err) => console.warn('86 voice push failed:', err?.message || err));
        await logAudit(appUser, 'VOICE_86_ALERT', requestedName, `${sourceText}${details ? ` | ${details}` : ''}`);
        addToast('86 Alert Sent', `${requestedName} was added to Manager Brief, Kitchen Command Center, and Message Board.`);
        setActiveTab('today'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'complete_list_review') {
        addToast('Choose a Match', 'Select the correct prep item or task before marking anything done.');
        return;
      }
      if (actionToRun.intent === 'complete_list_item') {
        if (!voiceFeatureEnabled(clientFeatures, 'prep') || !canVoiceOpenTab(appUser, clientFeatures, 'prep', clientData)) {
          addToast('Access Blocked', 'You do not have permission to update Prep & Tasks.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const actor = appUser.name || appUser.email || 'Voice Command';
        const prepDate = actionToRun.prepDate || getToday();
        if (actionToRun.type === 'prep') {
          const item = actionToRun.item || {};
          if (!item.id) throw new Error('No prep item was selected.');
          const previousPrepUndo = item.isMaster || item.date === 'MASTER'
            ? { completedDates: { ...(item.completedDates || {}) }, lastCompletedAt: item.lastCompletedAt || null, lastCompletedBy: item.lastCompletedBy || null, lastCompletedById: item.lastCompletedById || null, lastCompletionSource: item.lastCompletionSource || null, lastVoiceCommand: item.lastVoiceCommand || null }
            : { isCompleted: !!item.isCompleted, completedBy: item.completedBy || null, completedAt: item.completedAt || null, lastCompletedAt: item.lastCompletedAt || null, lastCompletedBy: item.lastCompletedBy || null, lastCompletedById: item.lastCompletedById || null, lastCompletionSource: item.lastCompletionSource || null, lastVoiceCommand: item.lastVoiceCommand || null };
          if (item.isMaster || item.date === 'MASTER') {
            const updatedDates = { ...(item.completedDates || {}) };
            if (!updatedDates[prepDate]) updatedDates[prepDate] = actor;
            await updateDoc(doc(db, 'prepItems', item.id), {
              completedDates: updatedDates,
              lastCompletedAt: new Date().toISOString(),
              lastCompletedBy: actor,
              lastCompletedById: appUser.id || '',
              lastCompletionSource: '86_voice_mark_done',
              lastVoiceCommand: sourceText
            });
          } else {
            await updateDoc(doc(db, 'prepItems', item.id), {
              isCompleted: true,
              completedBy: item.completedBy || actor,
              completedAt: item.completedAt || new Date().toISOString(),
              lastCompletedAt: new Date().toISOString(),
              lastCompletedBy: actor,
              lastCompletedById: appUser.id || '',
              lastCompletionSource: '86_voice_mark_done',
              lastVoiceCommand: sourceText
            });
          }
          rememberVoiceUndo(`prep completion: ${item.text || item.title || item.name || 'Prep item'}`, [{ kind:'update', collectionName:'prepItems', id:item.id, data:previousPrepUndo }]);
          await logAudit(appUser, 'VOICE_MARK_PREP_DONE', item.text || item.title || item.name || 'Prep item', sourceText);
          addToast(actionToRun.alreadyDone ? 'Already Done' : 'Prep Marked Done', `${actionToRun.label || item.text || 'Prep item'} is marked done for ${formatDisplayDate(prepDate)}.`);
          if (setCurrentDate) setCurrentDate(prepDate);
          setActiveTab('prep'); if (closeWhenDone) setOpen(false); return;
        }
        if (actionToRun.type === 'task') {
          const task = actionToRun.item || {};
          if (!task.id) throw new Error('No task was selected.');
          const periodKey = actionToRun.periodKey || getVoiceTaskPeriodKey(task.frequency || 'daily', prepDate);
          const previousTaskUndo = { completions: { ...(task.completions || {}) }, lastCompletedAt: task.lastCompletedAt || null, lastCompletedBy: task.lastCompletedBy || null, lastCompletedById: task.lastCompletedById || null, lastCompletionSource: task.lastCompletionSource || null, lastVoiceCommand: task.lastVoiceCommand || null };
          const completions = { ...(task.completions || {}) };
          if (!completions[periodKey]) completions[periodKey] = { by: actor, at: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), source: '86_voice_mark_done' };
          await updateDoc(doc(db, 'tasks', task.id), {
            completions,
            lastCompletedAt: new Date().toISOString(),
            lastCompletedBy: actor,
            lastCompletedById: appUser.id || '',
            lastCompletionSource: '86_voice_mark_done',
            lastVoiceCommand: sourceText
          });
          rememberVoiceUndo(`task completion: ${task.title || task.text || task.name || 'Task'}`, [{ kind:'update', collectionName:'tasks', id:task.id, data:previousTaskUndo }]);
          await logAudit(appUser, 'VOICE_MARK_TASK_DONE', task.title || task.text || task.name || 'Task', sourceText);
          addToast(actionToRun.alreadyDone ? 'Already Done' : 'Task Marked Done', `${actionToRun.label || task.title || 'Task'} is marked done.`);
          if (setCurrentDate) setCurrentDate(prepDate);
          setActiveTab('prep'); if (closeWhenDone) setOpen(false); return;
        }
      }
      if (actionToRun.intent === 'upsert_task') {
        if (!canVoiceManageRecurringTasks(appUser, clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_TASK', actionToRun.title || 'Task', sourceText);
          addToast('Access Blocked', 'Only managers/admins or users with task permissions can add or update recurring tasks by voice.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        if (!voiceFeatureEnabled(clientFeatures, 'prep') || !canVoiceOpenTab(appUser, clientFeatures, 'prep', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_TASK', actionToRun.title || 'Task', sourceText);
          addToast('Prep & Tasks Disabled', 'The Prep & Tasks module is not available for your plan or permissions.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const title = String(actionToRun.title || 'Task').trim();
        const frequency = ['daily', 'weekly', 'monthly'].includes(actionToRun.frequency) ? actionToRun.frequency : 'daily';
        const candidateTasks = await fetchVoiceTaskCandidates(appUser?.restaurantId, tasks);
        const sameFrequencyTasks = candidateTasks.filter(task => (task.frequency || 'daily') === frequency);
        const match = resolveVoiceMatch(sameFrequencyTasks, title, { getLabel: task => task.title || task.text || task.name || '', getAliases: task => [task.category].filter(Boolean), minScore: 45, highThreshold: 96, margin: 18 });
        const payload = {
          title,
          category: actionToRun.category || inferVoiceTaskCategory(title),
          frequency,
          targetDay: frequency === 'weekly' ? (actionToRun.targetDay || getCurrentWeekdayName()) : null,
          targetDate: frequency === 'monthly' ? String(actionToRun.targetDate || getCurrentMonthDay()) : null,
          updatedAt: new Date().toISOString(),
          lastUpdatedBy: appUser.name || appUser.email || 'Voice Command',
          lastUpdatedById: appUser.id || '',
          lastVoiceCommand: sourceText,
          source: '86_voice_task_upsert'
        };
        const forcedTask = actionToRun.forcedTaskId ? candidateTasks.find(task => task.id === actionToRun.forcedTaskId) : null;
        if ((forcedTask?.id) || (match.isHighConfidence && match.top?.item?.id)) {
          const existing = forcedTask || match.top.item;
          const previous = {
            title: existing.title || '',
            category: existing.category || 'General',
            frequency: existing.frequency || 'daily',
            targetDay: existing.targetDay || null,
            targetDate: existing.targetDate || null
          };
          await updateDoc(doc(db, 'tasks', existing.id), payload);
          rememberVoiceUndo(`task update: ${title}`, [{ kind:'update', collectionName:'tasks', id:existing.id, data:previous }]);
          await logAudit(appUser, 'VOICE_UPDATE_TASK', title, `${sourceText} | matched ${existing.title || existing.name || ''} with confidence ${match.confidence}`);
          addToast('Task Updated', `${existing.title || title} was updated instead of duplicated.`);
        } else if (match.alternatives?.length && match.confidence >= 70) {
          setPending({
            intent:'task_upsert_review',
            label:'Review task match',
            title,
            frequency,
            category: payload.category,
            targetDay: payload.targetDay,
            targetDate: payload.targetDate,
            candidates: match.alternatives,
            summary:`I found similar ${frequency} tasks. Choose one to update, or cancel and add it manually so I do not duplicate or overwrite the wrong task.`,
            needsConfirmation:true,
            safe:true
          });
          return;
        } else {
          const createdRef = await addDoc(collection(db, 'tasks'), { ...payload, restaurantId: appUser.restaurantId, completions: {}, createdAt: new Date().toISOString(), createdBy: appUser.name || appUser.email || 'Voice Command', createdById: appUser.id || '' });
          rememberVoiceUndo(`task create: ${title}`, [{ kind:'delete', collectionName:'tasks', id:createdRef.id }]);
          await logAudit(appUser, 'VOICE_CREATE_TASK', `${frequency}: ${title}`, sourceText);
          addToast('Task Added', `${title} was added as a ${describeRecurringTaskSchedule(payload)} task.`);
        }
        setActiveTab('prep'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'task_upsert_review') {
        addToast('Choose a Task', 'Choose the matching task before updating it.');
        return;
      }
      if (actionToRun.intent === 'shared_reminder_review') {
        addToast('Choose Teammate', 'Select the teammate before the shared reminder is saved.');
        return;
      }
      if (actionToRun.intent === 'create_shared_reminder') {
        if (!confirmedByUser) {
          addToast('Shared Reminder Needs Confirmation', 'Confirm before sending a shared reminder to a teammate.');
          return;
        }
        if (!canVoiceShareReminder(appUser, clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_SHARED_REMINDER', actionToRun.title || 'Shared reminder', sourceText);
          addToast('Access Blocked', 'You do not have permission to assign shared reminders by voice.');
          return;
        }
        const assignee = actionToRun.assignee || {};
        if (!assignee.id && !assignee.email) throw new Error('No teammate was selected.');
        const title = String(actionToRun.title || 'Shared reminder').trim();
        if (!actionToRun.scheduledAt) {
          setActiveTab('reminders');
          addToast('Reminder Needs Time', 'Open My Reminders and choose the date and time.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const voiceSessionId = actionToRun.voiceSessionId || voiceSessionRef.current.id || '';
        const clientCommandId = actionToRun.clientCommandId || buildVoiceClientCommandId(voiceSessionId, actionToRun, sourceText);
        const isVoiceReminder = !!voiceSessionId || actionToRun.createdFromFinalTranscript;
        if (isVoiceReminder && voiceSessionRef.current.commits >= 1 && !actionToRun.allowsMultipleReminders) {
          await logAudit(appUser, 'VOICE_REMINDER_DUPLICATE_BLOCKED', title, `${sourceText} | session already committed`);
          addToast('Duplicate Blocked', 'That voice session already saved a reminder.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        if (processedVoiceCommandRef.current.has(clientCommandId)) {
          await logAudit(appUser, 'VOICE_REMINDER_DUPLICATE_BLOCKED', title, `${sourceText} | repeated clientCommandId`);
          addToast('Duplicate Blocked', 'That reminder was already saved.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const existingDuplicate = await findRecentReminderDuplicate({ title, scheduledAt: actionToRun.scheduledAt, visibility: 'shared_reminder', assignedToUserId: assignee.id || '', clientCommandId });
        if (existingDuplicate) {
          await logAudit(appUser, 'VOICE_REMINDER_DUPLICATE_BLOCKED', title, `${sourceText} | matched ${existingDuplicate.id}`);
          addToast('Duplicate Blocked', 'That reminder was already saved once.');
          setActiveTab('reminders');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const reminderRef = await addDoc(collection(db, 'personalReminders'), {
          restaurantId: appUser.restaurantId,
          userId: appUser.id || '',
          userEmail: appUser.email || '',
          assignedToUserId: assignee.id || '',
          assignedToName: assignee.name || assignee.displayName || assignee.email || 'Teammate',
          assignedToEmail: assignee.email || '',
          createdByName: appUser.name || appUser.email || '',
          createdByEmail: appUser.email || '',
          shared: true,
          visibility: 'shared_reminder',
          title,
          titleNormalized: normalizeVoiceReminderTitle(title),
          notes: '',
          scheduledAt: actionToRun.scheduledAt,
          dueAt: actionToRun.scheduledAt,
          recurrence: actionToRun.recurrence || 'none',
          recurrenceSource: actionToRun.recurrence ? '86_voice_recurring_reminder' : '',
          status: 'scheduled',
          createdAt: new Date().toISOString(),
          createdBy: appUser.id || '',
          source: '86_voice_shared_reminder',
          voiceCommand: sourceText,
          voiceSessionId,
          clientCommandId,
          createdFromFinalTranscript: !!actionToRun.createdFromFinalTranscript,
          voiceFinalTranscript: !!actionToRun.createdFromFinalTranscript,
          voiceMatchConfidence: Number(actionToRun.matchConfidence || 0),
          dispatchedAt: null,
          dispatchKey: ''
        });
        processedVoiceCommandRef.current.add(clientCommandId);
        if (isVoiceReminder) voiceSessionRef.current.commits += 1;
        rememberVoiceUndo(`shared reminder: ${title}`, [{ kind:'delete', collectionName:'personalReminders', id:reminderRef.id }]);
        await logAudit(appUser, 'VOICE_SHARED_REMINDER', title, `Assigned to ${assignee.name || assignee.email || 'teammate'} | ${actionToRun.scheduledAt}`);
        addToast('Shared Reminder Saved', `${title} was assigned to ${assignee.name || assignee.email || 'teammate'}.`);
        setActiveTab('reminders'); setPending(null); setListening(false); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'create_personal_reminder') {
        const title = String(actionToRun.title || 'Personal reminder').trim();
        if (!actionToRun.scheduledAt || !title || title.length < 3) {
          setPending({ ...actionToRun, needsConfirmation: true, summary: 'I need a clearer reminder title and time before saving this voice reminder.' });
          setActiveTab('reminders');
          addToast('Reminder Needs Review', 'Confirm a clear title and time before I save it.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const voiceSessionId = actionToRun.voiceSessionId || voiceSessionRef.current.id || '';
        const clientCommandId = actionToRun.clientCommandId || buildVoiceClientCommandId(voiceSessionId, actionToRun, sourceText);
        const isVoiceReminder = !!voiceSessionId || actionToRun.createdFromFinalTranscript;
        if (isVoiceReminder && voiceSessionRef.current.commits >= 1 && !actionToRun.allowsMultipleReminders) {
          await logAudit(appUser, 'VOICE_REMINDER_DUPLICATE_BLOCKED', title, `${sourceText} | session already committed`);
          addToast('Duplicate Blocked', 'That voice session already saved a reminder.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        if (processedVoiceCommandRef.current.has(clientCommandId)) {
          await logAudit(appUser, 'VOICE_REMINDER_DUPLICATE_BLOCKED', title, `${sourceText} | repeated clientCommandId`);
          addToast('Duplicate Blocked', 'That reminder was already saved.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const existingDuplicate = await findRecentReminderDuplicate({ title, scheduledAt: actionToRun.scheduledAt, visibility: 'private_reminder', assignedToUserId: appUser.id || '', clientCommandId });
        if (existingDuplicate) {
          await logAudit(appUser, 'VOICE_REMINDER_DUPLICATE_BLOCKED', title, `${sourceText} | matched ${existingDuplicate.id}`);
          addToast('Duplicate Blocked', 'That reminder was already saved once.');
          setActiveTab('reminders');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const reminderRef = await addDoc(collection(db, 'personalReminders'), {
          restaurantId: appUser.restaurantId,
          userId: appUser.id || '',
          userEmail: appUser.email || '',
          assignedToUserId: appUser.id || '',
          assignedToName: appUser.name || appUser.email || 'Me',
          assignedToEmail: appUser.email || '',
          createdByName: appUser.name || appUser.email || '',
          createdByEmail: appUser.email || '',
          shared: false,
          visibility: 'private_reminder',
          title,
          titleNormalized: normalizeVoiceReminderTitle(title),
          notes: '',
          scheduledAt: actionToRun.scheduledAt,
          dueAt: actionToRun.scheduledAt,
          recurrence: actionToRun.recurrence || 'none',
          recurrenceSource: actionToRun.recurrence ? '86_voice_recurring_reminder' : '',
          status: 'scheduled',
          createdAt: new Date().toISOString(),
          createdBy: appUser.id || '',
          source: actionToRun.recurrence ? '86_voice_recurring_reminder' : '86_voice_personal_reminder',
          voiceCommand: sourceText,
          voiceSessionId,
          clientCommandId,
          createdFromFinalTranscript: !!actionToRun.createdFromFinalTranscript,
          voiceFinalTranscript: !!actionToRun.createdFromFinalTranscript,
          dispatchedAt: null,
          dispatchKey: ''
        });
        processedVoiceCommandRef.current.add(clientCommandId);
        if (isVoiceReminder) voiceSessionRef.current.commits += 1;
        rememberVoiceUndo(`personal reminder: ${title}`, [{ kind:'delete', collectionName:'personalReminders', id:reminderRef.id }]);
        await logAudit(appUser, 'VOICE_PERSONAL_REMINDER', title, actionToRun.scheduledAt);
        addToast('Reminder Saved', `${title} at ${formatClockDateTime(actionToRun.scheduledAt)}.`);
        setActiveTab('reminders'); setPending(null); setListening(false); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'smart_prep') {
        if (!voiceFeatureEnabled(clientFeatures, 'prep') || !canVoiceOpenTab(appUser, clientFeatures, 'prep', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_PREP', 'Smart prep', sourceText);
          addToast('Prep & Tasks Disabled', 'The Prep & Tasks module is not available for your plan or permissions.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        const targetPrepDate = actionToRun.prepDate || getToday();
        const requestedPrepItems = actionToRun.prepItems || [];
        const prepDatesToCheck = Array.from(new Set(requestedPrepItems.map(item => item.prepDate || targetPrepDate).filter(Boolean)));
        const matchCandidates = await fetchVoicePrepMatchCandidates(appUser?.restaurantId, prepDatesToCheck, prepItems);
        const results = [];
        const undoOps = [];
        for (const parsed of requestedPrepItems) {
          const prepDate = parsed.prepDate || targetPrepDate;
          const match = findPrepMatch(matchCandidates, parsed, prepDate);
          if (match?.id) {
            const previousPrepData = { qty: match.qty ?? 1, unit: match.unit || 'item', amount: match.amount || null, text: match.text || '', station: match.station || '', isCompleted: !!match.isCompleted, completedDates: { ...(match.completedDates || {}) }, lastVoiceCommand: match.lastVoiceCommand || null, lastUpdatedAt: match.lastUpdatedAt || null };
            const data = buildPrepQuantityUpdate({
              existingItem: match,
              parsedItem: parsed,
              actorName: appUser.name || appUser.email || 'Voice Command',
              prepDate,
              source: '86_voice_smart_prep'
            });
            await updateDoc(doc(db, 'prepItems', match.id), data);
            undoOps.push({ kind:'update', collectionName:'prepItems', id:match.id, data:previousPrepData });
            Object.assign(match, data);
            results.push({ type: 'updated', name: match.text || parsed.itemText });
          } else {
            const createdPrepRef = await addDoc(collection(db, 'prepItems'), buildPrepCreatePayload({
              parsedItem: parsed,
              appUser,
              prepDate,
              station: parsed.station || 'Voice',
              isMaster: false,
              sourceText,
              source: '86_voice_smart_prep'
            }));
            undoOps.push({ kind:'delete', collectionName:'prepItems', id:createdPrepRef.id });
            results.push({ type: 'created', name: parsed.itemText });
          }
          await logAudit(appUser, 'VOICE_SMART_PREP', parsed.itemText, sourceText);
        }
        if (undoOps.length) rememberVoiceUndo('smart prep update', undoOps);
        if (setCurrentDate) setCurrentDate(targetPrepDate);
        addToast('Prep Updated', `${summarizePrepResults(results)} for ${formatDisplayDate(targetPrepDate)}`);
        setActiveTab('prep'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'create_prep') {
        const text = String(actionToRun.itemText || 'Prep task').trim();
        const createdPrepRef = await addDoc(collection(db, 'prepItems'), { restaurantId: appUser.restaurantId, date:getToday(), text, station:'Voice', isCompleted:false, qty: actionToRun.amount || 1, unit: actionToRun.unit || 'item', createdAt:new Date().toISOString(), createdBy: appUser.name || appUser.email || 'Voice Command', voiceCommand: sourceText });
        rememberVoiceUndo(`prep create: ${text}`, [{ kind:'delete', collectionName:'prepItems', id:createdPrepRef.id }]);
        await logAudit(appUser, 'VOICE_PREP_TASK', text, sourceText);
        addToast('Prep Added', text);
        setActiveTab('prep'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'post_message') {
        if (!canVoiceOpenTab(appUser, clientFeatures, 'messages', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_MESSAGE', 'Message Board', sourceText);
          addToast('Access Blocked', 'You do not have permission to post messages.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        await addDoc(collection(db, 'events'), { restaurantId: appUser.restaurantId, type:'note', category:'Announcement', title: actionToRun.messageText, author: appUser.name || appUser.email || 'Voice Command', date:new Date().toISOString(), isImportant:false, replies:[], voiceCommand: sourceText, createdAt:new Date().toISOString() });
        await logAudit(appUser, 'VOICE_MESSAGE', 'Message Board', actionToRun.messageText);
        addToast('Message Posted', actionToRun.messageText);
        setActiveTab('messages'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'maintenance') {
        if (!canVoiceOpenTab(appUser, clientFeatures, 'maintenance', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_MAINTENANCE', 'Maintenance', sourceText);
          addToast('Access Blocked', 'You do not have permission to create maintenance issues.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        await addDoc(collection(db, 'maintenanceLogs'), { restaurantId: appUser.restaurantId, equipment:'Voice Report', issue: actionToRun.issue, status:'Open', priority:'Medium', reportedBy: appUser.name || appUser.email || 'Voice Command', date:getToday(), createdAt:new Date().toISOString(), voiceCommand: sourceText });
        await logAudit(appUser, 'VOICE_MAINTENANCE', 'Maintenance', actionToRun.issue);
        addToast('Maintenance Added', actionToRun.issue);
        setActiveTab('maintenance'); if (closeWhenDone) setOpen(false); return;
      }
      if (actionToRun.intent === 'burn_log') {
        if (!canVoiceOpenTab(appUser, clientFeatures, 'inventory', clientData)) {
          await logAudit(appUser, 'VOICE_BLOCKED_BURN_LOG', actionToRun.item?.name || 'Burn log', sourceText);
          addToast('Access Blocked', 'You do not have permission to update inventory or burn logs.');
          if (closeWhenDone) setOpen(false);
          return;
        }
        if (actionToRun.needsSetup) { setActiveTab('inventory'); if (closeWhenDone) setOpen(false); return; }
        const item = actionToRun.item;
        const stockDeducted = Math.max(0, Number(actionToRun.stockDeducted || 0));
        const costLost = (parseFloat(item.price || 0) || 0) * stockDeducted;
        await addDoc(collection(db, 'wasteLogs'), { restaurantId: appUser.restaurantId, itemId:item.id, itemName:item.name, qty:actionToRun.amount, burnAmount:actionToRun.amount, burnUnitLabel:actionToRun.labelUnit, burnMode:actionToRun.mode, stockDeducted, costLost, reason:'Voice command', loggedBy: appUser.name || appUser.email || 'Voice Command', date:getToday(), timestamp:new Date().toISOString(), voiceCommand: sourceText });
        if (stockDeducted > 0) await updateDoc(doc(db, 'inventoryItems', item.id), { currentStock: Math.max(0, (parseFloat(item.currentStock) || 0) - stockDeducted), updatedAt:new Date().toISOString() });
        await logAudit(appUser, 'VOICE_BURN_LOG', item.name, sourceText);
        addToast('Burn Logged', `${actionToRun.amount} ${actionToRun.labelUnit} ${item.name}.`);
        setActiveTab('inventory'); if (closeWhenDone) setOpen(false); return;
      }
      setActiveTab(actionToRun.tab || 'help'); if (closeWhenDone) setOpen(false);
    } catch(err) {
      addToast('Voice Command Error', err.message || 'Could not complete the command.');
    }
  };

  const selectEightySixCandidate = (candidate = {}) => {
    if (!candidate?.item?.id) return;
    const item = candidate.item;
    const requestedItemName = pending?.requestedItemName || item.name || 'Item';
    setPending({
      intent:'eighty_six_alert',
      label:`Confirm 86 alert: ${item.name}`,
      item,
      itemName:item.name,
      requestedItemName,
      menuMatchMethod:candidate.method || 'userSelection',
      matchedMenuItemName:candidate.matchedMenuItemName || '',
      matchedIngredientName:candidate.matchedIngredientName || item.name || '',
      matchConfidence:Number(candidate.confidence || 0),
      matchVerified:true,
      selectionConfirmed:true,
      resolvedMenuDependencies:pending?.resolvedMenuDependencies || menuDependencies,
      summary:`You selected ${item.name}. Confirm once more to send the 86 alert. Inventory stock will not be changed.`,
      highRisk:true,
      needsConfirmation:true
    });
  };

  const selectVoiceCompletionCandidate = (candidate = {}) => {
    if (!candidate?.item?.id) return;
    setPending({
      intent:'complete_list_item',
      label:`Mark done: ${candidate.label}`,
      ...candidate,
      requestedItemName: pending?.requestedItemName || candidate.label,
      summary:`You selected ${candidate.label} from ${candidate.listLabel}. Confirm to mark it done.`,
      needsConfirmation:true,
      safe:true
    });
  };

  const selectVoiceTaskCandidate = (candidate = {}) => {
    if (!candidate?.item?.id) return;
    setPending({
      intent:'upsert_task',
      label:`Update task: ${candidate.label}`,
      title: pending?.title || candidate.label,
      frequency: pending?.frequency || candidate.item?.frequency || 'daily',
      category: pending?.category || candidate.item?.category || 'General',
      targetDay: pending?.targetDay || candidate.item?.targetDay || null,
      targetDate: pending?.targetDate || candidate.item?.targetDate || null,
      forcedTaskId: candidate.item.id,
      summary:`You selected ${candidate.label}. Confirm to update this existing task instead of creating a duplicate.`,
      needsConfirmation:true,
      safe:true
    });
  };

  const selectSharedReminderCandidate = (candidate = {}) => {
    if (!candidate?.item) return;
    const assignee = candidate.item;
    setPending({
      intent:'create_shared_reminder',
      label:`Share reminder with ${assignee.name || assignee.email}`,
      assignee,
      title: pending?.title || 'Shared reminder',
      scheduledAt: pending?.scheduledAt || '',
      matchConfidence: candidate.score || 0,
      summary:`You selected ${assignee.name || assignee.email}. Confirm to send the shared reminder: ${pending?.title || 'Shared reminder'}.`,
      needsConfirmation:true,
      safe:true
    });
  };

  const executePending = () => executeAction(pending, heardText, true, true);

  return <div className="fixed bottom-5 left-4 z-50 flex flex-col items-start gap-2">
    {open && <div className="cockpit-panel rounded-2xl p-3 w-[min(92vw,360px)] shadow-2xl border border-[#2A353D] bg-[#1A2126]">
      <div className="flex items-center justify-between gap-2 border-b border-[#2A353D] pb-2 mb-3">
        <div><div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] flex items-center gap-1"><Sparkles size={13}/> 86 Voice</div><div className="text-[10px] text-slate-500 font-bold">Tap once, speak, and safe commands run. Destructive commands still ask first.</div></div>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#12161A] text-slate-400"><X size={16}/></button>
      </div>
      <div className="space-y-2">
        <button type="button" onClick={startListening} className={`w-full ${listening ? 'bg-red-900/30 text-red-300 border-red-500/40' : 'bg-[#12161A] text-[#D4A381] border-[#2A353D]'} border rounded-xl py-3 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2`}>
          {listening ? <MicOff size={16}/> : <Mic size={16}/>} {listening ? 'Listening...' : 'Start Listening'}
        </button>
        <textarea value={manualText} onChange={e=>setManualText(e.target.value)} className={T.input} rows="2" placeholder='Try: "86 salmon", "prep 2 pans tomatoes", "mark onions done", "finish clean fryer", "open Friday schedule"' />
        <button type="button" onClick={() => processText(manualText)} className={`${T.btnAlt} w-full`}>Parse Typed Command</button>
        {heardText && <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2 text-xs"><span className="text-slate-500 font-black uppercase tracking-widest">Heard</span><div className="font-bold text-white mt-1">{heardText}</div></div>}
        {pending && <div className="bg-[#0B0E11] border border-[#D4A381]/40 rounded-xl p-3">
          <div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381]">{pending.highRisk ? 'High-Risk Review' : 'Suggested Action'}</div>
          <div className="text-sm font-black text-white mt-1">{pending.label || pending.intent}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-[#12161A] border border-[#2A353D] rounded-full px-2 py-0.5">Intent: {pending.intent}</span>
            {(pending.matchConfidence || pending.score) && <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-[#12161A] border border-[#2A353D] rounded-full px-2 py-0.5">Confidence: {Math.round(Number(pending.matchConfidence || pending.score || 0))}</span>}
            {pending.blocked && <span className="text-[9px] font-black uppercase tracking-widest text-red-300 bg-red-900/20 border border-red-900/40 rounded-full px-2 py-0.5">Blocked</span>}
          </div>
          <div className="text-xs text-slate-400 font-bold mt-1 leading-snug">{pending.summary}</div>
          {pending.intent === 'eighty_six_review' && pending.candidates?.length > 0 && <div className="space-y-2 mt-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Choose the exact inventory item</div>
            {pending.candidates.map((candidate, idx) => <button key={`${candidate.item?.id || candidate.item?.name || 'candidate'}-${idx}`} type="button" onClick={() => selectEightySixCandidate(candidate)} className="w-full text-left bg-[#12161A] border border-[#2A353D] hover:border-[#D4A381]/60 rounded-xl px-3 py-2 transition-colors">
              <div className="text-xs font-black text-white">{candidate.item?.name || 'Unnamed item'}</div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">{candidate.item?.category || 'Inventory'} • {candidate.method === 'menuIntelligence' ? 'Menu Intelligence match' : 'Inventory match'}</div>
            </button>)}
          </div>}
          {pending.intent === 'complete_list_review' && pending.candidates?.length > 0 && <div className="space-y-2 mt-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Choose the prep item or task</div>
            {pending.candidates.map((candidate, idx) => <button key={`${candidate.type || 'list'}-${candidate.item?.id || candidate.label || 'candidate'}-${idx}`} type="button" onClick={() => selectVoiceCompletionCandidate(candidate)} className="w-full text-left bg-[#12161A] border border-[#2A353D] hover:border-[#D4A381]/60 rounded-xl px-3 py-2 transition-colors">
              <div className="text-xs font-black text-white">{candidate.label || 'Unnamed item'}</div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">{candidate.listLabel || 'Prep & Tasks'} • {candidate.alreadyDone ? 'already done' : 'open'} • match {candidate.score}</div>
            </button>)}
          </div>}
          {pending.intent === 'task_upsert_review' && pending.candidates?.length > 0 && <div className="space-y-2 mt-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Choose existing task to update</div>
            {pending.candidates.map((candidate, idx) => <button key={`task-${candidate.item?.id || candidate.label || 'candidate'}-${idx}`} type="button" onClick={() => selectVoiceTaskCandidate(candidate)} className="w-full text-left bg-[#12161A] border border-[#2A353D] hover:border-[#D4A381]/60 rounded-xl px-3 py-2 transition-colors">
              <div className="text-xs font-black text-white">{candidate.label || candidate.item?.title || 'Task'}</div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">{candidate.item?.frequency || 'daily'} • {candidate.item?.category || 'General'} • match {candidate.score}</div>
            </button>)}
          </div>}
          {pending.intent === 'shared_reminder_review' && pending.candidates?.length > 0 && <div className="space-y-2 mt-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Choose teammate</div>
            {pending.candidates.map((candidate, idx) => <button key={`share-${candidate.item?.id || candidate.item?.email || candidate.label || 'candidate'}-${idx}`} type="button" onClick={() => selectSharedReminderCandidate(candidate)} className="w-full text-left bg-[#12161A] border border-[#2A353D] hover:border-[#D4A381]/60 rounded-xl px-3 py-2 transition-colors">
              <div className="text-xs font-black text-white">{candidate.item?.name || candidate.item?.displayName || candidate.item?.email || 'Teammate'}</div>
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">{candidate.item?.role || 'Staff'} • match {candidate.score}</div>
            </button>)}
          </div>}
          {voiceResult && <div className="mt-3 bg-[#12161A] border border-[#2A353D] rounded-xl p-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Last result</div>
            <div className="text-xs font-black text-white mt-1">{voiceResult.label}</div>
            <div className="text-[11px] text-slate-400 font-bold leading-snug mt-1">{voiceResult.summary}</div>
            {voiceResult.rows?.length > 0 && <div className="mt-2 space-y-1">{voiceResult.rows.slice(0, 6).map((row, idx) => <div key={idx} className="text-[10px] text-slate-300 bg-[#0B0E11] rounded-lg px-2 py-1 border border-[#2A353D]">{row.menuItemName} • {row.severity || 'check stock'}</div>)}</div>}
          </div>}
          {lastUndo && <button type="button" onClick={() => executeAction({ intent:'undo_last_voice', label:'Undo last voice command', safe:true }, 'Undo button', false, true)} className={`${T.btnAlt} w-full mt-3`}>Undo Last Safe Voice Action</button>}
          <div className="flex gap-2 mt-3">
            {!['eighty_six_review','complete_list_review','task_upsert_review','shared_reminder_review'].includes(pending.intent) && <button onClick={executePending} className={`${T.btn} flex-1`}>{pending.safe && !pending.needsConfirmation ? 'Go' : 'Confirm'}</button>}
            <button onClick={() => setPending(null)} className={`${T.btnAlt} ${['eighty_six_review','complete_list_review','task_upsert_review','shared_reminder_review'].includes(pending.intent) ? 'w-full' : ''}`}>Cancel</button>
          </div>
        </div>}
        {!canUseSpeech && <div className="text-[10px] text-amber-300 bg-amber-900/10 border border-amber-900/40 rounded-xl p-2 font-bold">This browser does not support built-in speech recognition. Type the command here, or use Chrome/Android for voice.</div>}
      </div>
    </div>}
    <button onClick={open ? () => setOpen(false) : openDock} className="no-compact w-14 h-14 rounded-full bg-[#0B0E11] border border-[#D4A381]/70 text-[#D4A381] shadow-2xl flex items-center justify-center hover:scale-105 transition-transform" title="86 Voice Assistant Preview"><div className="relative"><Mic size={24}/><span className="absolute -right-6 -top-3 bg-blue-600 text-white text-[8px] font-black px-1 rounded-full border border-blue-300">PREVIEW</span></div></button>
  </div>;
};

const KitchenTVMode = ({ isOpen, onClose, shifts, events, prepItems, maintenanceLogs, inventoryItems }) => {
  if (!isOpen) return null;
  const today = getToday();
  const todaysShifts = shifts.filter(s => s.date === today && s.isPublished).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  const prep = prepItems.filter(p => (p.date === today || p.date === 'MASTER') && !p.isCompleted).slice(0, 10);
  const alerts = events.filter(e => e.type === 'note' && e.isImportant).slice(0, 5);
  const todayEvents = events.filter(e => e.type === 'special_event' && e.date === today);
  const maint = maintenanceLogs.filter(m => !['Completed','Closed','Resolved'].includes(m.status)).slice(0, 5);
  const low = inventoryItems.filter(i => Number(i.parLevel||0) > 0 && Number(i.currentStock||0) < Number(i.parLevel||0)).slice(0, 6);
  return <div className="fixed inset-0 z-[100000] bg-[#0B0E11] text-white p-5 sm:p-8 overflow-y-auto">
    <div className="flex justify-between items-start mb-6"><div><div className="text-[#D4A381] text-sm font-black uppercase tracking-widest">86 Chaos Kitchen TV</div><h1 className="text-4xl sm:text-6xl font-black">{formatDisplayFullDate(today)}</h1></div><button onClick={onClose} className="bg-white text-slate-900 rounded-xl px-4 py-2 font-black uppercase text-xs">Exit</button></div>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="cockpit-panel rounded-2xl p-5"><h2 className="text-2xl font-black mb-3">Prep Now</h2>{prep.length ? prep.map(p => <div key={p.id} className="text-xl font-bold border-b border-[#2A353D] py-2">{p.text}</div>) : <p className="text-slate-500 text-xl">Prep is clear.</p>}</div>
      <div className="cockpit-panel rounded-2xl p-5"><h2 className="text-2xl font-black mb-3">86 / Alerts</h2>{alerts.length ? alerts.map(a => <div key={a.id} className="text-xl font-bold border-b border-red-500/30 py-2 text-red-300">{a.title}</div>) : <p className="text-slate-500 text-xl">No active alerts.</p>}{low.map(i => <div key={i.id} className="text-xl font-bold border-b border-red-500/30 py-2 text-red-300">Low: {i.name}</div>)}</div>
      <div className="cockpit-panel rounded-2xl p-5"><h2 className="text-2xl font-black mb-3">Today</h2>{todayEvents.map(e => <div key={e.id} className="text-xl font-bold border-b border-[#2A353D] py-2">{e.time || ''} {e.title}</div>)}{todaysShifts.slice(0,8).map(s => <div key={s.id} className="text-xl font-bold border-b border-[#2A353D] py-2">{formatShortTime(s.startTime)} {s.role}</div>)}{maint.map(m => <div key={m.id} className="text-xl font-bold border-b border-amber-500/30 py-2 text-amber-300">Fix: {m.equipment}</div>)}</div>
    </div>
  </div>;
};

const ChangeLogModal = ({ isOpen, onClose }) => isOpen ? <Modal isOpen={isOpen} onClose={onClose} title={`What's New in ${CURRENT_VERSION}`}>
  <div className="space-y-3 text-sm text-slate-300 font-bold leading-snug">
    <p>Voice reminders now commit once per final transcript, reminders have snooze and due dots, request-offs move cleanly into history after publish, and Availability now helps managers schedule without hard-blocking control.</p>
    <div className="grid grid-cols-2 gap-2 text-[10px] uppercase tracking-widest font-black">
      {['Voice dedupe','Request-off archive','Availability warnings','Event/order reminders','Brother QL-810W labels','Menu reordered'].map(x => <div key={x} className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 text-[#D4A381]">{x}</div>)}
    </div>
    <button onClick={onClose} className={`w-full ${T.btn}`}>Got it</button>
  </div>
</Modal> : null;

const UndoBar = ({ undoItem, clearUndo }) => {
  if (!undoItem) return null;
  return <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-[99999] cockpit-panel rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xl">
    <div><div className="text-xs font-black text-white uppercase tracking-widest">Action saved</div><div className="text-[10px] text-slate-500 font-bold">You can reverse this for a short time.</div></div>
    <button onClick={async () => { await undoItem.action(); clearUndo(); }} className="px-3 py-2 bg-[#D4A381] text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest">{undoItem.label || 'Undo'}</button>
  </div>;
};

export { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, VoiceCommandDock, KitchenTVMode, ChangeLogModal, UndoBar };

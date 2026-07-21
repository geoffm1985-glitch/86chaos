import React from 'react';
import { X, Clock, MessageSquare, Calendar, ClipboardList, BookOpen, Package, Users, TrendingUp, Shield, Settings, Bug, LogOut, Globe, Repeat, Sparkles } from 'lucide-react';

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, hasUnreadMessages, clientFeatures = {}, T, getAvatar, MASTER_ADMIN_EMAIL, availableWorkspaces = [], activeWorkspaceName = '', onOpenWorkspaceSwitcher }) => {
  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};
  const isGod = Boolean((MASTER_ADMIN_EMAIL && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) || appUser?.isSuperAdmin);
  const knownRosterRoles = Array.isArray(appUser?.rosterRoles) ? appUser.rosterRoles : Array.isArray(appUser?.customRosterRoles) ? appUser.customRosterRoles : [];
  const hasCustomRosterRoles = knownRosterRoles.length > 0;
  const roleText = String(appUser?.role || '').toLowerCase();
  const isLegacyKitchenFallback = !hasCustomRosterRoles && ['kitchen', 'cook', 'chef', 'prep'].some(token => roleText.includes(token));

  const isEnabled = (feat) => clientFeatures[feat] !== false;

  const activeWorkspaceLabel = activeWorkspaceName || appUser?.restaurantName || appUser?.workspaceName || appUser?.businessName || 'Current Restaurant';
  const switchableWorkspaceCount = Array.isArray(availableWorkspaces) ? availableWorkspaces.filter(w => w?.isActive !== false).length : 0;
  const canSwitchWorkspace = switchableWorkspaceCount > 1 && typeof onOpenWorkspaceSwitcher === 'function' && !appUser?.isDemo;
  const openWorkspaceSwitcherFromMenu = () => {
    if (!canSwitchWorkspace) return;
    onClose?.();
    window.setTimeout(() => onOpenWorkspaceSwitcher(), 0);
  };

  if (isEnabled('schedule')) tabs.push({ id: 'published', label: 'Schedule & Time Clock', icon: <Clock size={18}/> });
  if (isEnabled('messages')) tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/>, dot: hasUnreadMessages });

  if (isEnabled('schedule') && (appUser?.isAdmin || perms.schedule)) tabs.push({ id: 'schedule', label: 'Schedule Builder', icon: <Calendar size={18}/> });
  if (isEnabled('prep') && (appUser?.isAdmin || isLegacyKitchenFallback || perms.prep)) tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> });
  if (isEnabled('recipes') && (appUser?.isAdmin || isLegacyKitchenFallback || perms.prep || perms.team)) tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> });
  if (isEnabled('inventory') && (appUser?.isAdmin || perms.inventory || perms.team)) tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });
  if (!appUser?.isDemo && (appUser?.isAdmin || perms.inventory || perms.prep || perms.team)) tabs.push({ id: 'ai-tools', label: 'AI Tools', icon: <Sparkles size={18}/> });

  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  if (isEnabled('sales') && (appUser?.isAdmin || perms.sales)) tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> });

  if (isGod) tabs.push({ id: 'godmode', label: 'System Administrator', icon: <Shield size={18}/> });
  if (appUser?.isAdmin || isGod) tabs.push({ id: 'audit', label: 'Audit Logs', icon: <Shield size={18}/> });
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  return (
     <div className="fixed inset-0 z-[70] flex justify-end app-drawer-readable app-drawer-v104">
       <div className="drawer-backdrop-v104 absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose}></div>
       <aside className={`w-[19rem] max-w-[88vw] bg-[#0B0F13] border-l ${T.border} h-full shadow-2xl flex flex-col relative animate-[slideIn_0.24s_ease-out]`} aria-label="App menu">
          <div className={`px-4 py-4 border-b ${T.border} bg-[#0B0F13] flex justify-between items-start gap-3`}>
             <div className="flex items-start gap-3 min-w-0">
               <img src={getAvatar(appUser.name, appUser.photoURL)} alt="Profile" className={`w-10 h-10 rounded-full border ${T.border} object-cover flex-shrink-0`}/>
               <div className="min-w-0">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Signed in as</div>
                 <div className="text-white font-black text-lg tracking-tight leading-none truncate">{appUser.name}</div>
                 <div className="flex items-center gap-1.5 text-[#D4A381] text-[10px] font-black uppercase tracking-[0.16em] mt-1">
                   {appUser.isAdmin && <Shield size={10} />}
                   <span>{appUser.role || 'Staff'}</span>
                 </div>
                 <button
                   type="button"
                   onClick={openWorkspaceSwitcherFromMenu}
                   disabled={!canSwitchWorkspace}
                   className={`mt-2 max-w-[190px] flex items-center gap-1.5 text-left text-[10px] font-black uppercase tracking-[0.14em] ${canSwitchWorkspace ? 'text-slate-200 hover:text-[#D4A381] cursor-pointer' : 'text-slate-500 cursor-default'}`}
                   title={canSwitchWorkspace ? 'Change restaurant workspace' : 'Current restaurant workspace'}
                 >
                   <Globe size={11} className="flex-shrink-0" />
                   <span className="truncate">{activeWorkspaceLabel}</span>
                   {canSwitchWorkspace && <Repeat size={10} className="flex-shrink-0 opacity-80" />}
                 </button>
               </div>
             </div>
             <button onClick={onClose} className="drawer-close-button text-slate-400 hover:text-white transition-colors p-0.5" title="Close menu"><X size={22}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0.5 custom-scrollbar">
             {tabs.map(tab => {
               const active = activeTab === tab.id;
               return (
                 <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`drawer-menu-row group w-full flex items-center justify-between px-2.5 py-2.5 font-bold text-sm transition-colors duration-150 ${active ? 'is-active text-white' : 'text-slate-400 hover:text-white'}`}>
                   <span className="drawer-active-bar" aria-hidden="true" />
                   <span className="flex items-center gap-3 min-w-0">
                     <span className={`relative flex-shrink-0 ${active ? 'text-[#D4A381]' : 'text-slate-500 group-hover:text-[#D4A381]'}`}>
                       {tab.icon}
                       {tab.dot && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
                     </span>
                     <span className="truncate">{tab.label}</span>
                   </span>
                 </button>
               );
             })}
          </div>
          <div className={`px-3 py-3 border-t ${T.border} bg-[#0B0F13] space-y-2`}>
           <button
              onClick={() => { setActiveTab('help'); onClose(); window.setTimeout(() => window.dispatchEvent(new CustomEvent('chaosOpenProblemReport')), 150); }}
              className="drawer-utility-row w-full flex items-center justify-center gap-2 py-2 text-orange-300 hover:text-white text-sm font-bold transition-colors"
            >
              <Bug size={16} /> Report Problem
            </button>
             <button onClick={() => { localStorage.removeItem('86chaosUser'); setAppUser(null); onClose(); }} className="drawer-utility-row w-full flex items-center justify-center gap-2 py-2 text-red-300 hover:text-white text-sm font-bold transition-colors"><LogOut size={16} /> Log Out</button>
          </div>
       </aside>
     </div>
  );
};

export default DrawerMenu;

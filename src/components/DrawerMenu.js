import React from 'react';
import { X, Clock, MessageSquare, Calendar, ClipboardList, BookOpen, Package, Users, TrendingUp, Shield, Settings, Bug, LogOut, Globe, Repeat, Sparkles } from 'lucide-react';

const DrawerMenu = ({ isOpen, onClose, activeTab, setActiveTab, appUser, setAppUser, hasUnreadMessages, clientFeatures = {}, T, getAvatar, MASTER_ADMIN_EMAIL, availableWorkspaces = [], activeWorkspaceName = '', onOpenWorkspaceSwitcher }) => {
  if (!isOpen) return null;
  const tabs = [];
  const perms = appUser?.permissions || {};
  const isGod = Boolean((MASTER_ADMIN_EMAIL && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) || appUser?.isSuperAdmin);

  // Helper: If a feature is undefined, it defaults to true (prevents breaking legacy setups)
  const isEnabled = (feat) => clientFeatures[feat] !== false;

  const activeWorkspaceLabel = activeWorkspaceName || appUser?.restaurantName || appUser?.workspaceName || appUser?.businessName || 'Current Restaurant';
  const switchableWorkspaceCount = Array.isArray(availableWorkspaces) ? availableWorkspaces.filter(w => w?.isActive !== false).length : 0;
  const canSwitchWorkspace = switchableWorkspaceCount > 1 && typeof onOpenWorkspaceSwitcher === 'function' && !appUser?.isDemo;
  const openWorkspaceSwitcherFromMenu = () => {
    if (!canSwitchWorkspace) return;
    onClose?.();
    window.setTimeout(() => onOpenWorkspaceSwitcher(), 0);
  };

  // Dynamic Module Checks
  if (isEnabled('schedule')) tabs.push({ id: 'published', label: 'Schedule & Time Clock', icon: <Clock size={18}/> });  
  if (isEnabled('messages')) tabs.push({ id: 'messages', label: 'Message Board', icon: <MessageSquare size={18}/>, dot: hasUnreadMessages });
  
  if (isEnabled('schedule') && (appUser?.isAdmin || perms.schedule)) tabs.push({ id: 'schedule', label: 'Schedule Builder', icon: <Calendar size={18}/> });
  if (isEnabled('prep') && (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep)) tabs.push({ id: 'prep', label: 'Prep List', icon: <ClipboardList size={18}/> });
  if (isEnabled('recipes') && (appUser?.isAdmin || appUser?.role === 'Kitchen' || perms.prep || perms.team)) tabs.push({ id: 'recipes', label: 'Recipe Book', icon: <BookOpen size={18}/> });  
  if (isEnabled('inventory') && (appUser?.isAdmin || perms.inventory || perms.team)) tabs.push({ id: 'inventory', label: 'Inventory', icon: <Package size={18}/> });  
  if (!appUser?.isDemo && (appUser?.isAdmin || perms.inventory || perms.prep || perms.team)) tabs.push({ id: 'ai-tools', label: 'AI Tools', icon: <Sparkles size={18}/> });
  
  // Core UI (Always active)
  tabs.push({ id: 'team', label: 'Team', icon: <Users size={18}/> });
  if (isEnabled('sales') && (appUser?.isAdmin || perms.sales)) tabs.push({ id: 'sales', label: 'Sales & Trends', icon: <TrendingUp size={18}/> });
  
  if (isGod) tabs.push({ id: 'godmode', label: 'System Administrator', icon: <Shield size={18}/> });
  if (appUser?.isAdmin || isGod) tabs.push({ id: 'audit', label: 'Audit Logs', icon: <Shield size={18}/> });  
  tabs.push({ id: 'settings', label: 'Settings', icon: <Settings size={18}/> });

  return (
     <div className="fixed inset-0 z-[70] flex justify-end">
       <div className="absolute inset-0 bg-[#05090D]/72 backdrop-blur-md" onClick={onClose}></div>
       <div className={`chaos-drawer w-80 max-w-[88vw] bg-[#071017] border-l border-[#D4A381]/25 h-full shadow-[0_0_60px_rgba(0,0,0,0.55)] flex flex-col relative animate-[slideIn_0.3s_ease-out]`}>
          <div className={`p-4 border-b border-[#D4A381]/20 bg-[#05090D] flex justify-between items-start`}>
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
             <button onClick={onClose} className="p-1.5 bg-[#101820] border border-[#2B4150] rounded-full text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
             {tabs.map(tab => (
               <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${activeTab === tab.id ? `${T.grad} text-slate-950 shadow-[0_14px_30px_rgba(212,163,129,0.20)]` : 'text-slate-400 hover:bg-[#D4A381]/10 hover:text-white hover:border-[#D4A381]/40'}`}>
                 <div className="flex items-center gap-3">
                   <div className="relative">
                     <span className={activeTab === tab.id ? 'text-slate-900' : T.copper}>{tab.icon}</span>
                     {tab.dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1A2126] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
                   </div>
                   {tab.label}
                 </div>
               </button>
             ))}
          </div>
          <div className={`p-3 border-t border-[#D4A381]/20 bg-[#05090D] space-y-2`}>
           <button 
              onClick={() => { setActiveTab('help'); onClose(); window.setTimeout(() => window.dispatchEvent(new CustomEvent('chaosOpenProblemReport')), 150); }} 
              className="w-full flex items-center justify-center gap-2 py-2.5 text-[#D4A381] text-sm font-bold rounded-xl hover:bg-[#8F6040]/20 transition-colors border border-[#8F6040]/30"
            >
              <Bug size={16} /> Report a Bug / Error
            </button>
             <button onClick={() => { localStorage.removeItem('86chaosUser'); setAppUser(null); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 text-sm font-bold rounded-xl hover:bg-red-900/20 transition-colors"><LogOut size={16} /> Log Out</button>
          </div>
       </div>
     </div>
  );
};

export default DrawerMenu;

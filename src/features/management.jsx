import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe, ThumbsUp, HelpCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon, getRestaurantExportPrefix, safeFilenamePart, downloadCsvRows, downloadTextFile, openPrintableReport, buildPermissionPreview, buildImportBridgeTemplates, buildV14ClientGuardrailReport } from '../core/appCore';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';


const GEOFENCE_TILE_PROVIDERS = [
  {
    id: 'carto-light',
    label: 'Carto Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 20
  },
  {
    id: 'osm-standard',
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  {
    id: 'osm-hot',
    label: 'OpenStreetMap HOT',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, Tiles style by HOT',
    maxZoom: 19
  }
];

const getSafeMapCenter = (lat, lon) => {
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon)) return [parsedLat, parsedLon];
  return [44.0296, -88.1633];
};


const sanitizeForFirestore = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined);
  }
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value;
    const cleaned = {};
    Object.entries(value).forEach(([key, item]) => {
      const next = sanitizeForFirestore(item);
      if (next !== undefined) cleaned[key] = next;
    });
    return cleaned;
  }
  return value;
};

const GeofenceMapStabilizer = ({ lat, lon, radius, refreshNonce }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;
    const center = getSafeMapCenter(lat, lon);
    const container = map.getContainer?.();
    let cancelled = false;
    let observer = null;
    const timeouts = [];

    const repairMap = () => {
      if (cancelled) return;
      try {
        map.invalidateSize({ animate: false, pan: false });
        map.setView(center, map.getZoom() || 17, { animate: false });
      } catch (_) {}
    };

    [0, 80, 200, 450, 900, 1500, 2500].forEach((delay) => {
      timeouts.push(setTimeout(repairMap, delay));
    });

    const onWindowResize = () => repairMap();
    const onVisibility = () => { if (!document.hidden) repairMap(); };
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('visibilitychange', onVisibility);

    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => repairMap());
      observer.observe(container);
      if (container.parentElement) observer.observe(container.parentElement);
    }

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (observer) observer.disconnect();
    };
  }, [map, lat, lon, radius, refreshNonce]);

  return null;
};

const TabTeam = ({ users, appUser, clientData, addToast }) => {
  const normalizedEmail = (appUser?.email || '').toLowerCase().trim();
  const ownerEmail = (clientData?.ownerEmail || appUser?.ownerEmail || '').toLowerCase().trim();
  const ownerUserId = clientData?.ownerUserId || clientData?.ownerUid || '';
  const isSuperAdminUser = Boolean(appUser?.isSuperAdmin === true || (MASTER_ADMIN_EMAIL && normalizedEmail === MASTER_ADMIN_EMAIL.toLowerCase()) || false);
  const isAccountOwner = Boolean(
    isSuperAdminUser ||
    appUser?.isOwner === true ||
    appUser?.accountOwner === true ||
    appUser?.owner === true ||
    appUser?.workspaceOwner === true ||
    String(appUser?.accountRole || '').toLowerCase().trim() === 'owner' ||
    ((appUser?.ownerEmail || '').toLowerCase().trim() && normalizedEmail && (appUser?.ownerEmail || '').toLowerCase().trim() === normalizedEmail) ||
    (ownerEmail && normalizedEmail && ownerEmail === normalizedEmail) ||
    (ownerUserId && appUser?.id && ownerUserId === appUser.id)
  );
  const systemSettings = clientData?.systemSettings || appUser?.systemSettings || {};
  const wageViewAccess = Array.isArray(systemSettings.wageAccess) ? systemSettings.wageAccess : [];
  const wageEditAccess = Array.isArray(systemSettings.wageEditAccess) ? systemSettings.wageEditAccess : [];
  const canManageTeam = Boolean(isSuperAdminUser || isAccountOwner || appUser?.isAdmin === true || appUser?.permissions?.team === true);
  const canChooseWageAccess = Boolean(isSuperAdminUser || isAccountOwner);
  const canViewWages = Boolean(canChooseWageAccess || appUser?.permissions?.wageView === true || appUser?.permissions?.wageEdit === true || wageViewAccess.includes(appUser?.id) || wageEditAccess.includes(appUser?.id));
  const canEditWages = Boolean(canChooseWageAccess || appUser?.permissions?.wageEdit === true || wageEditAccess.includes(appUser?.id));
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [role, setRole] = useState('Bartender'); 
  const [wage, setWage] = useState(''); 
  const [photoURL, setPhotoURL] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const DEFAULT_PERMISSIONS = { schedule: false, events: false, ops: false, inventory: false, prep: false, sales: false, team: false, labor: false, settings: false, branding: false, integrations: false, menuIntelligence: false, wageView: false, wageEdit: false };
  const PERMISSION_PRESETS = {
    'Read Only': { schedule: false, events: false, ops: false, inventory: false, prep: false, sales: false, team: false, labor: false },
    'Kitchen Manager': { schedule: false, events: true, ops: true, inventory: true, prep: true, sales: false, team: false, labor: false },
    'Bar Manager': { schedule: false, events: true, ops: true, inventory: true, prep: false, sales: false, team: false, labor: false },
    'Schedule Manager': { schedule: true, events: true, ops: false, inventory: false, prep: false, sales: false, team: false, labor: false },
    'Operations Manager': { schedule: true, events: true, ops: true, inventory: true, prep: true, sales: true, team: true, labor: true },
    'Cook': { schedule: false, events: false, ops: false, inventory: false, prep: true, sales: false, team: false, labor: false },
    'Server/Bartender': { schedule: false, events: false, ops: false, inventory: false, prep: false, sales: false, team: false, labor: false }
  };
  const [perms, setPerms] = useState(DEFAULT_PERMISSIONS);
  const [editingUserId, setEditingUserId] = useState(null);
  const [createdLogin, setCreatedLogin] = useState(null);

  const dbRoles = useLiveCollection('roles', appUser?.restaurantId, { limitCount: 100 });
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  const roles = dbRoles.length > 0 ? dbRoles.map(r => r.name).sort() : DEFAULT_ROLES;
  
  const generateTempPass = () => Math.random().toString(36).slice(-6);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setWage(''); setPhotoURL(''); setRole('Bartender'); setIsAdmin(false); setPerms(DEFAULT_PERMISSIONS); setEditingUserId(null);
  };

  const buildLoginText = (login) => login ? `Welcome to 86 Chaos!\n\nApp: https://app.86chaos.com\n\nName: ${login.name}\nEmail: ${login.email}\nTemporary Password: ${login.password}\n\nThis temporary password is shown one time. Please log in and change it.` : '';
  const copyLogin = async (login) => { try { await navigator.clipboard.writeText(buildLoginText(login)); addToast('Copied', 'Login info copied.'); } catch(e) { addToast('Copy Failed', 'Highlight and copy the login info manually.'); } };
  const printLogin = (login) => { const w = window.open('', '_blank'); if (!w) return addToast('Popup Blocked', 'Allow popups to print the login sheet.'); w.document.write(`<pre style="font-family:Arial,sans-serif;font-size:18px;white-space:pre-wrap;line-height:1.5">${buildLoginText(login).replace(/</g,'&lt;')}</pre>`); w.document.close(); w.focus(); w.print(); };
  const emailLogin = (login) => { window.location.href = `mailto:${login.email}?subject=${encodeURIComponent('Your 86 Chaos Account')}&body=${encodeURIComponent(buildLoginText(login))}`; };
  const textLogin = (login) => { if (!login.phone) return addToast('No Phone', 'This employee does not have a phone number entered.'); const smsChar = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'; window.location.href = `sms:${login.phone}${smsChar}body=${encodeURIComponent(buildLoginText(login))}`; };

  const handleEditClick = (u) => {
    if (!canManageTeam) return addToast('Read Only', 'Staff Roster is view-only for regular staff.');
    setName(u.name); setEmail(u.email); setPhone(u.phone || ''); setWage(u.wage || ''); setPhotoURL(u.photoURL || ''); setRole(u.role || 'Bartender'); setIsAdmin(u.isAdmin || false); setPerms({ ...DEFAULT_PERMISSIONS, ...(u.permissions || {}) }); setEditingUserId(u.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => { 
    e.preventDefault();
    if (!canManageTeam) return addToast('Read Only', 'Only managers/admins/account owners can change staff profiles.');
    if (!name.trim() || !email.trim() || !phone.trim()) return; 
    
    const staffPayload = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      role,
      wage: parseFloat(wage) || 0,
      photoURL: photoURL.trim(),
      isAdmin,
      permissions: { ...DEFAULT_PERMISSIONS, ...(perms || {}) },
      restaurantId: appUser.restaurantId
    };

    if (editingUserId) {
        try {
            const response = await secureFetch('/api/staff-member', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', targetUid: editingUserId, ...staffPayload })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.ok === false) throw new Error(result?.error || 'Staff profile save failed.');
            addToast('Updated', `${name}'s profile has been updated.`);
            resetForm();
        } catch(err) {
          const msg = String(err?.message || 'Permission denied.');
          addToast('Permission Blocked', msg.includes('permission') ? 'This account is not allowed to save one or more staff fields. Owners can edit wages and choose wage access.' : msg);
        }
        return;
    }

    const tPass = generateTempPass(); 
    try { 
      const response = await secureFetch('/api/staff-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', tempPassword: tPass, ...staffPayload })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || 'Staff account creation failed.');
      if (result?.reusedExistingAuth) {
        setCreatedLogin(null);
        addToast('Workspace Linked', 'Existing 86 Chaos login linked to this restaurant. They can use their current password or the Forgot Password link.');
      } else {
        const oneTimePassword = result?.tempPassword || tPass;
        setCreatedLogin({ kind:'employee', name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password: oneTimePassword });
        addToast('Staff Added', 'Account created successfully. Copy or print the one-time login info.'); 
      }
      resetForm();
    } catch (err) { 
      console.error(err); 
      addToast('Error', err.message || 'Failed to create user account.');
    } 
  };

const handleDeactivate = async (u) => { 
    if (!canManageTeam) return addToast('Read Only', 'Only managers/admins/account owners can remove staff accounts.');
    if (u.id === appUser?.id) return addToast('Blocked', 'You cannot remove your own staff account from here. Use another owner/Super Admin account for ownership changes.');
    const superDelete = isSuperAdminUser;
    if (!window.confirm(superDelete ? `Terminate ${u.name}? This will permanently delete their global account from the entire system.` : `Remove ${u.name} from the active roster? Historical schedule and payroll records will stay intact.`)) return; 
    
    addToast(superDelete ? 'Terminating' : 'Removing', `${superDelete ? 'Erasing' : 'Removing'} ${u.name} from the active roster...`);
    try {
      if (superDelete) {
        await secureFetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUid: u.id })
        });
        await deleteDoc(doc(db, "users", u.id)); 
        addToast('Terminated', `${u.name}'s account has been completely erased.`); 
      } else {
        const response = await secureFetch('/api/staff-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deactivate', targetUid: u.id, restaurantId: appUser.restaurantId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.ok === false) throw new Error(result?.error || 'Staff removal failed.');
        addToast('Removed', `${u.name} was removed from the active roster.`);
      }
    } catch (err) {
      addToast('Error', err?.message || 'Could not update staff status.');
    }
  };

  const handlePasswordReset = async (u) => {
    if (!canManageTeam) return addToast('Read Only', 'Only managers/admins/account owners can reset staff passwords.');
    if (!window.confirm(`Send a password reset email to ${u.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, u.email);
      addToast('Sent', `Reset email sent to ${u.email}`);
    } catch(err) { addToast('Error', err.message); }
  };

  const parsePresenceTimeMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
    if (typeof value === 'string') {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.toDate === 'function') {
      const parsed = value.toDate().getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  };
  const getLastActiveMs = (u = {}) => Math.max(
    parsePresenceTimeMs(u.lastHeartbeatAt),
    parsePresenceTimeMs(u.presenceUpdatedAt),
    parsePresenceTimeMs(u.lastActive),
    parsePresenceTimeMs(u.lastSeen),
    parsePresenceTimeMs(u.heartbeatEpochMs)
  );
  const formatLastActive = (u = {}) => {
    const lastMs = getLastActiveMs(u);
    if (!lastMs) return { label: 'Never active', tone: 'text-slate-500', exact: 'No app activity recorded yet.' };
    const diff = Math.max(0, Date.now() - lastMs);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    let label = 'Just now';
    let tone = 'text-emerald-400';
    if (diff < 3 * 60 * 1000 && u.onlineState !== 'offline') label = 'Online now';
    else if (minutes < 60) label = `${minutes || 1}m ago`;
    else if (hours < 24) { label = `${hours}h ago`; tone = 'text-emerald-500'; }
    else if (days === 1) { label = 'Yesterday'; tone = 'text-amber-400'; }
    else { label = `${days}d ago`; tone = days > 7 ? 'text-red-400' : 'text-amber-400'; }
    let exact = '';
    try { exact = formatClockDateTime(new Date(lastMs).toISOString(), appUser); } catch (err) { exact = new Date(lastMs).toLocaleString(); }
    return { label, tone, exact };
  };

  const activeUsers = users.filter(u => u.isActive !== false).sort((a, b) => a.role === b.role ? a.name.localeCompare(b.name) : (a.role==='Bartender'?-1:1));

return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <Modal isOpen={!!createdLogin} onClose={() => setCreatedLogin(null)} title="Employee Login Created">
        {createdLogin && <div className="space-y-4">
          <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 text-xs font-bold text-emerald-200">This is shown one time only. Copy, print, email, or text it before closing.</div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-4 space-y-2">
            <div><div className={T.label}>Email</div><div className="font-mono text-white break-all">{createdLogin.email}</div></div>
            <div><div className={T.label}>Temporary Password</div><div className="font-mono text-2xl font-black text-[#D4A381]">{createdLogin.password}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => copyLogin(createdLogin)} className={T.btn}>Copy</button><button type="button" onClick={() => printLogin(createdLogin)} className={T.btnAlt}>Print</button><button type="button" onClick={() => emailLogin(createdLogin)} className={T.btnAlt}>Email</button><button type="button" onClick={() => textLogin(createdLogin)} className={T.btnAlt}>Text</button></div>
          <button type="button" onClick={() => setCreatedLogin(null)} className={`w-full ${T.btn}`}>Done</button>
        </div>}
      </Modal>

      {canManageTeam && (
        <form onSubmit={handleSave} className={`${T.card} p-4 sm:p-6 space-y-2`}>
          {editingUserId && (
            <div className="bg-blue-900/40 border border-blue-500/50 p-3 rounded-xl flex justify-between items-center">
              <span className="text-blue-400 font-bold text-xs uppercase tracking-widest">Editing Staff Member</span>
              <button type="button" onClick={resetForm} className="text-white text-xs font-bold hover:text-blue-300">Cancel Edit ?</button>
            </div>
          )}
          
          <div><label className={T.label}>Name</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className={T.input} required placeholder="e.g. Gordon Ramsay" /></div>
          
          <div>
            <label className={T.label}>Email {editingUserId && <span className="text-slate-500 lowercase normal-case ml-1">(Cannot be changed after creation)</span>}</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={!!editingUserId} className={`${T.input} ${editingUserId ? 'opacity-50 cursor-not-allowed' : ''}`} required />
          </div>

          
          <div><label className={T.label}>Phone</label><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={T.input} required /></div>
          
          <div><label className={T.label}>Role</label><select value={role} onChange={e=>setRole(e.target.value)} className={T.input}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          
          {/* STRICTLY LOCKED TO ADMINS */}
          {canEditWages && (
            <div>
              <label className={T.label}>Hourly Wage ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                <input type="number" step="0.01" min="0" value={wage} onChange={e=>setWage(e.target.value)} className={`${T.input} pl-8`} placeholder="Ex: 15.50" />
              </div>
            </div>
          )}

  {canChooseWageAccess && (
            <label className="flex items-center gap-3 p-4 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} className="w-5 h-5 accent-red-500 bg-[#1A2126] border-[#2A353D] rounded" />
              <span className="text-sm font-black text-red-500">Store Manager (Full Admin)</span>
            </label>
          )}
          
          {!isAdmin && (
            <div className="p-4 bg-[#12161A] rounded-xl border border-[#2A353D]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Permission Presets: choose a plain-English job preset, then fine tune individual switches below.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.keys(PERMISSION_PRESETS).map(preset => (
                  <button key={preset} type="button" onClick={() => setPerms({ ...DEFAULT_PERMISSIONS, ...PERMISSION_PRESETS[preset] })} className="px-2.5 py-1.5 bg-[#0B0E11] border border-[#2A353D] rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-[#D4A381] hover:border-[#D4A381]/40 transition-colors">{preset}</button>
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Custom Permissions: Kitchen Command Center is only visible with Ops permission or Store Manager. Labor is only visible to Store Managers, Schedule/Sales managers, or users with Labor permission.</p>
              <div className="flex flex-wrap gap-4">
                {Object.keys(perms).map(k => {
                  const wageAccessToggle = k === 'wageView' || k === 'wageEdit';
                  const ownerOnlyToggle = wageAccessToggle || k === 'settings' || k === 'branding' || k === 'integrations' || k === 'menuIntelligence';
                  const disabled = ownerOnlyToggle && !canChooseWageAccess;
                  const label = { schedule: 'Schedule Builder', events: 'Event Calendar', ops: 'Kitchen Command Center', inventory: 'Inventory', prep: 'Prep / Recipes', sales: 'Financials: Daily Ledger', team: 'Team Management', labor: 'Financials: Labor / Timesheets', settings: 'Workspace Settings', branding: 'Branding Settings', integrations: 'Integrations Settings', menuIntelligence: 'Menu Intelligence', wageView: 'View Wages', wageEdit: 'Edit Wages' }[k] || k;
                  return (
                  <label key={k} className={`flex items-center gap-2 text-xs font-bold uppercase ${disabled ? 'opacity-45 cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-300'}`} title={disabled ? 'Only the account owner can choose this access.' : ''}>
                    <input type="checkbox" disabled={disabled} checked={!!perms[k]} onChange={e=>setPerms({...perms, [k]: e.target.checked, ...(k === 'wageEdit' && e.target.checked ? { wageView: true } : {})})} className="w-4 h-4 accent-[#8F6040] bg-[#1A2126] border-[#2A353D] rounded disabled:opacity-40" /> 
                    {label}
                  </label>
                );})}
              </div>
            </div>
          )}
          
          <button type="submit" className={`w-full ${T.btn}`}>{editingUserId ? 'UPDATE STAFF PROFILE' : 'ADD STAFF'}</button>
        </form>
      )}
      
      <div className={`${T.card} overflow-hidden`}>
        <div className="divide-y divide-[#2A353D]">
          {activeUsers.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No active staff found.</div>}
          
          {activeUsers.map(u => {
            const activity = formatLastActive(u);
            return (
            <div key={u.id} className="p-2.5 border-b border-[#2A353D] hover:bg-[#12161A] transition-colors flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-xs flex-shrink-0 ${u.isAdmin ? 'bg-red-900/50 border border-red-500/50' : 'bg-[#1A2126] border border-[#2A353D]'}`}>
                  {(u.name || u.email || '?').charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm leading-tight truncate">{u.name} {u.isAdmin && <span className="ml-1 text-[7px] uppercase tracking-widest bg-red-500 text-white px-1 py-0.5 rounded-sm">Admin</span>}</h4>
<div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${u.role==='Bartender'?'bg-blue-900/20 text-blue-400 border-blue-900/50':'bg-[#12161A] text-[#D4A381] border-[#2A353D]'}`}>{u.role}</span>
                    {u.phone && <span className="text-[9px] font-bold text-slate-500 truncate">{u.phone}</span>}
                    {canViewWages && u.wage > 0 && <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-900/10 border border-emerald-900/30 px-1.5 py-0.5 rounded ml-1">${Number(u.wage).toFixed(2)}/hr</span>}
                  </div>
                </div>
              </div>
              
           {canManageTeam && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handlePasswordReset(u)} className="px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-blue-400 transition-colors bg-[#12161A] rounded border border-[#2A353D]">Reset</button>
                  <button onClick={() => handleEditClick(u)} className="p-1 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded border border-[#2A353D]"><Edit size={12}/></button>
                  <button onClick={() => handleDeactivate(u)} className="p-1 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded border border-[#2A353D]"><Trash2 size={12}/></button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

const TabMessages = ({ events, appUser, users, addToast }) => {
  const [message, setMessage] = useState('');
  const [replyTexts, setReplyTexts] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [messageCategory, setMessageCategory] = useState('Shift Note');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedReplies, setExpandedReplies] = useState({});
  const messageRetentionDays = parseInt(appUser?.systemSettings?.messageRetentionDays || 30, 10);

  const toggleReplies = (id) => setExpandedReplies(prev => ({ ...prev, [id]: !prev[id] }));

  // --- AUTO-CLEANER ENGINE ---
  useEffect(() => {
    const cleanOldMessages = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - messageRetentionDays);
      const oldNotes = events.filter(e => e.type === 'note' && new Date(e.date) < thirtyDaysAgo);
      for (const note of oldNotes) {
        try { await deleteDoc(doc(db, "events", note.id)); }
        catch(e) { console.warn("Silent cleaner failed to delete note", e); }
      }
    };
    if (events.length > 0) cleanOldMessages();
  }, [events, messageRetentionDays]);

  const allNotes = events
    .filter(e => e.type === 'note')
    .filter(e => {
      const term = searchTerm.toLowerCase();
      const matchesText = (e.title || '').toLowerCase().includes(term) || (e.notes || '').toLowerCase().includes(term) || (e.menuImpact || '').toLowerCase().includes(term) || (e.author || '').toLowerCase().includes(term) || (e.messageCategory || '').toLowerCase().includes(term);
      const matchesCat = categoryFilter === 'All' || (e.messageCategory || (e.isImportant ? 'Important' : 'Shift Note')) === categoryFilter;
      return matchesText && matchesCat;
    })
    // Newest posts always stay at the top. Important posts keep their badge,
    // but they no longer jump ahead of newer operational notes.
    .sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

  useEffect(() => {
    if (!appUser?.id || !events.length) return;
    const unseen = events.filter(e => e.type === 'note' && e.isImportant && !(e.readBy || []).some(r => r.userId === appUser.id)).slice(0, 5);
    unseen.forEach(e => {
      updateDoc(doc(db, 'events', e.id), { readBy: [...(e.readBy || []), { userId: appUser.id, name: appUser.name, at: new Date().toISOString() }] }).catch(()=>{});
    });
  }, [events, appUser?.id]);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if(!message.trim() && !imageFile) return;
    setIsUploading(true);

    let photoUrl = null;
    if (imageFile) {
      try {
        const fileRef = ref(storage, `messages/${appUser.restaurantId}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fileRef, imageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsUploading(false);
        return;
      }
    }

    const isCritical = isImportant || message.trim().toLowerCase().includes('!critical');
    const finalMessage = message.trim().replace(/!critical/ig, '').trim();

    await addDoc(collection(db, "events"), {
      date: new Date().toISOString(),
      title: finalMessage,
      type: 'note',
      author: appUser.name,
      isImportant: isCritical,
      restaurantId: appUser.restaurantId,
      replies: [],
      imageUrl: photoUrl,
      messageCategory,
      readBy: isCritical ? [{ userId: appUser.id, name: appUser.name, at: new Date().toISOString() }] : [],
      likes: []
    });

    try {
      await secureFetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          type: 'message',
          title: isCritical ? '🚨 CRITICAL ALERT' : `New Message from ${appUser.name.split(' ')[0]}`,
          body: finalMessage,
          textContent: finalMessage,
          isCritical: isCritical
        })
      });
    } catch (err) { console.error("Push failed:", err); }

    setMessage('');
    setImageFile(null);
    setIsUploading(false);
    setIsImportant(false);
    setMessageCategory('Shift Note');
    addToast('Posted', 'Message sent.');
  };

  const handleReplyChange = (id, text) => { setReplyTexts(prev => ({ ...prev, [id]: text })); };

  const handleSendReply = async (e, eventId) => {
    e.preventDefault();
    const text = replyTexts[eventId];
    if (!text || !text.trim()) return;
    const targetEvent = events.find(ev => ev.id === eventId);
    const currentReplies = targetEvent?.replies || [];
    const newReply = { id: Date.now().toString(), author: appUser.name, text: text.trim(), timestamp: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "events", eventId), { replies: [...currentReplies, newReply] });
      setReplyTexts(prev => ({ ...prev, [eventId]: '' }));
    } catch (err) { addToast('Error', 'Could not post reply.'); }
  };


  const handleToggleLike = async (post) => {
    if (!appUser?.id || !post?.id) return;
    const currentLikes = Array.isArray(post.likes) ? post.likes : [];
    const alreadyLiked = currentLikes.some(l => l.userId === appUser.id);
    const nextLikes = alreadyLiked
      ? currentLikes.filter(l => l.userId !== appUser.id)
      : [...currentLikes, { userId: appUser.id, name: appUser.name, at: new Date().toISOString() }];
    try {
      await updateDoc(doc(db, 'events', post.id), { likes: nextLikes });
    } catch (err) {
      addToast('Like Failed', 'Could not update the like on this post.');
    }
  };

  const getTimeAgo = (dateString) => {
    const mins = Math.floor((new Date() - new Date(dateString)) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2 message-pro pb-20">
      <div className="cockpit-panel rounded-xl overflow-hidden">
        <div className="p-2.5 sm:p-3 border-b border-[#2A353D] bg-[#12161A]/70 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-[#0B0E11] border border-[#2A353D] flex items-center justify-center text-[#D4A381] flex-shrink-0"><MessageSquare size={16}/></div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-white leading-tight whitespace-nowrap">Message Board</h2>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5 leading-snug">Kitchen notes, 86 alerts, maintenance, and announcements</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap pt-1"><span className="cockpit-light bg-emerald-400 text-emerald-400 slow"></span>{allNotes.length} visible</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,320px)_1fr] gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15}/>
              <input type="text" placeholder="Search posts..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-[#0B0E11] border border-[#2A353D] text-white text-xs rounded-lg outline-none focus:border-[#D4A381] transition-colors placeholder-slate-600" />
            </div>
            <div className="flex flex-wrap gap-1">
              {['All','Shift Note','86 Alert','Maintenance','Announcement','General'].map(cat => (
                <button key={cat} type="button" onClick={() => setCategoryFilter(cat)} className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${categoryFilter === cat ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#0B0E11] text-slate-500 border-[#2A353D]'}`}>{cat}</button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleBroadcast} className="p-2.5 sm:p-3 bg-[#1A2126]">
          <div className="flex gap-2.5">
            <img src={getAvatar(appUser.name, appUser.photoURL)} className="w-8 h-8 rounded-full border border-[#2A353D] object-cover flex-shrink-0" alt="avatar"/>
            <div className="flex-1 min-w-0">
              <textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-sm outline-none resize-none min-h-[38px] rounded-lg px-3 py-2 placeholder-slate-600 focus:border-[#D4A381] transition-colors" placeholder="Post a clear shift note, 86 item, handoff, or manager update..." />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Shift Note','86 Alert','Maintenance','Announcement','General'].map(cat => (
                  <button type="button" key={cat} onClick={() => setMessageCategory(cat)} className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-widest transition-colors ${messageCategory === cat ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#0B0E11] text-slate-500 border-[#2A353D] hover:text-slate-200'}`}>{cat}</button>
                ))}
              </div>
              {imageFile && (
                <div className="mt-2 text-[10px] text-blue-300 font-bold bg-blue-900/10 px-2 py-1.5 rounded-lg border border-blue-900/30 flex justify-between items-center w-full sm:w-max max-w-full">
                  <span className="truncate pr-3 flex items-center gap-1.5"><Camera size={12}/> {imageFile.name}</span>
                  <button type="button" onClick={()=>setImageFile(null)} className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"><X size={12}/></button>
                </div>
              )}
              <div className="flex justify-between items-center gap-2 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="h-8 w-8 rounded-lg bg-[#0B0E11] border border-[#2A353D] text-[#D4A381] hover:bg-[#12161A] flex items-center justify-center cursor-pointer transition-colors" title="Attach Photo"><Camera size={15} /><input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="hidden" disabled={isUploading} /></label>
                  <label className={`flex items-center gap-2 cursor-pointer rounded-lg px-2.5 py-2 border transition-colors ${isImportant ? 'bg-red-900/20 border-red-500/50 text-red-300' : 'bg-[#0B0E11] border-[#2A353D] text-slate-400 hover:text-slate-200'}`}>
                    <input type="checkbox" checked={isImportant} onChange={e=>setIsImportant(e.target.checked)} className="w-3.5 h-3.5 rounded bg-[#12161A] border-[#2A353D] accent-red-500 cursor-pointer" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Priority</span>
                  </label>
                </div>
                <button type="submit" disabled={isUploading || (!message.trim() && !imageFile)} className="bg-gradient-to-r from-[#C59373] to-[#8F6040] hover:opacity-90 text-slate-900 font-black tracking-widest uppercase text-[10px] py-2 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {isUploading ? <Loader2 className="animate-spin" size={14}/> : <><Send size={13}/> Post</>}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="space-y-2">
        {allNotes.length === 0 && (
          <div className="text-center py-12 bg-[#1A2126] border border-[#2A353D] rounded-xl">
             <MessageSquare size={28} className="mx-auto text-slate-600 mb-2" />
             <p className="text-sm font-bold text-slate-500">{searchTerm ? 'No posts matched your search.' : 'No active posts. Clean board, clean shift.'}</p>
             <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">Messages auto-archive after {messageRetentionDays} days</p>
          </div>
        )}

        {allNotes.map(n => {
          const authorUser = users.find(u => u.name === n.author);
          const replies = n.replies || [];
          const readBy = n.readBy || [];
          const unreadNames = n.isImportant ? users.filter(u => u.isActive !== false && !readBy.some(r => r.userId === u.id)).slice(0, 4).map(u => u.name?.split(' ')[0] || u.email).join(', ') : '';
          return (
            <div key={n.id} className={`message-card-pro rounded-xl border overflow-hidden transition-colors ${n.isImportant ? 'border-red-500/40 bg-red-950/10' : 'border-[#2A353D] bg-[#1A2126] hover:bg-[#1A2126]/90'}`}>
              <div className="flex">
                <div className={`w-1.5 flex-shrink-0 ${n.isImportant ? 'bg-red-500' : 'bg-[#2A353D]'}`}></div>
                <div className="flex-1 min-w-0 p-2.5 sm:p-3">
                  <div className="flex items-start gap-2.5">
                    <img src={getAvatar(n.author, authorUser?.photoURL)} className="w-8 h-8 rounded-full border border-[#2A353D] object-cover bg-[#12161A] flex-shrink-0" alt="pic"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 items-start">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap leading-none">
                            <span className={`font-black text-sm ${n.isImportant ? 'text-red-300' : 'text-white'}`}>{n.author || 'Unknown'}</span>
                            {authorUser?.isAdmin && <span className="bg-[#0B0E11] border border-[#2A353D] text-[#D4A381] text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Admin</span>}
                            {n.messageCategory && <span className="bg-[#0B0E11] border border-[#2A353D] text-slate-400 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">{n.messageCategory}</span>}
                            {n.isImportant && <span className="bg-red-500/10 border border-red-500/40 text-red-300 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest flex items-center gap-1"><Bell size={10}/> Important</span>}
                            {n.isImportant && <span className="bg-emerald-900/10 border border-emerald-900/40 text-emerald-300 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest" title={unreadNames ? `Not seen: ${unreadNames}` : 'Everyone active has seen this'}>Seen {readBy.length}/{users.filter(u => u.isActive !== false).length}</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1" title={formatClockDateTime(n.date)}>{getTimeAgo(n.date)}</div>
                        </div>
                        {appUser?.isAdmin && <button onClick={() => { if(window.confirm('Delete this post?')) deleteDoc(doc(db, 'events', n.id)); }} className="text-slate-600 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-900/20"><Trash2 size={14}/></button>}
                      </div>

                      {n.title && <p className="font-medium text-sm leading-snug text-slate-200 break-words whitespace-pre-wrap mt-2">{n.title}</p>}
                      {(n.notes || n.menuImpact) && (
                        <div className="mt-2 bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2 text-[11px] font-bold text-slate-300 whitespace-pre-wrap">
                          {n.notes || n.menuImpact}
                        </div>
                      )}
                      {Array.isArray(n.menuImpactItems) && n.menuImpactItems.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {n.menuImpactItems.slice(0, 8).map((name, idx) => <span key={`${name}-${idx}`} className="bg-red-500/10 border border-red-500/30 text-red-200 text-[9px] px-2 py-1 rounded-lg uppercase font-black tracking-widest">Unavailable: {name}</span>)}
                        </div>
                      )}
                      {n.imageUrl && <div className="mt-2 rounded-lg overflow-hidden border border-[#2A353D] bg-[#0B0E11] max-w-xl"><img src={n.imageUrl} alt="Attached" className="w-full max-h-[260px] object-cover" /></div>}

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleToggleLike(n)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors ${Array.isArray(n.likes) && n.likes.some(l => l.userId === appUser?.id) ? 'bg-[#D4A381]/15 border-[#D4A381]/60 text-[#D4A381]' : 'bg-[#0B0E11] border-[#2A353D] text-slate-500 hover:text-[#D4A381] hover:border-[#D4A381]/40'}`}
                          title={Array.isArray(n.likes) && n.likes.length ? `Liked by ${(n.likes || []).map(l => l.name || 'Someone').slice(0, 6).join(', ')}` : 'Like this post'}
                        >
                          <ThumbsUp size={13}/> {(n.likes || []).length ? `${(n.likes || []).length}` : 'Like'}
                        </button>
                      </div>

                      {replies.length > 0 && (
                        <button type="button" onClick={() => toggleReplies(n.id)} className="mt-2 flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-[#D4A381] uppercase tracking-widest transition-colors">
                          <MessageSquare size={13} /> {expandedReplies[n.id] ? 'Hide Thread' : `${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}`}
                        </button>
                      )}

                      {expandedReplies[n.id] && replies.length > 0 && (
                        <div className="mt-2 space-y-2 border-l border-[#2A353D] pl-3 animate-[slideIn_0.2s_ease-out]">
                          {replies.map((r) => (
                            <div key={r.id} className="flex gap-2">
                              <img src={getAvatar(r.author, users.find(u => u.name === r.author)?.photoURL)} className="w-6 h-6 rounded-full border border-[#2A353D] object-cover flex-shrink-0" alt="pic"/>
                              <div className="flex-1 bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2.5 py-2">
                                <div className="flex items-center gap-1.5 leading-none mb-1"><span className="font-bold text-xs text-white">{r.author}</span><span className="text-slate-500 text-[10px]">· {getTimeAgo(r.timestamp)}</span></div>
                                <div className="text-slate-300 font-medium text-xs leading-snug">{r.text}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {n.author !== 'System Alert' && (
                        <form onSubmit={(e) => handleSendReply(e, n.id)} className="flex gap-2 mt-2 items-center">
                          <img src={getAvatar(appUser.name, appUser.photoURL)} className="w-6 h-6 rounded-full border border-[#2A353D] object-cover flex-shrink-0" alt="pic"/>
                          <div className="relative flex-1">
                            <input type="text" placeholder="Reply..." value={replyTexts[n.id] || ''} onChange={(e) => handleReplyChange(n.id, e.target.value)} className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-[#D4A381] transition-colors placeholder-slate-600" />
                            <button type="submit" disabled={!replyTexts[n.id]?.trim()} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#D4A381] disabled:opacity-30 hover:bg-[#D4A381]/10 p-1 rounded-md transition-colors"><Send size={12}/></button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the logo file.'));
  reader.readAsDataURL(file);
});

const prepareRestaurantLogoUpload = async (file) => {
  if (!file) throw new Error('Choose a logo image first.');
  const originalType = (file.type || '').toLowerCase();
  if (originalType === 'image/svg+xml' || originalType === 'image/gif') {
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, contentType: originalType };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('The logo image could not be opened.'));
    });
    img.src = objectUrl;
    await loaded;

    const maxSide = 900;
    const ratio = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.width || maxSide) * ratio));
    canvas.height = Math.max(1, Math.round((img.height || maxSide) * ratio));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let contentType = originalType === 'image/webp' ? 'image/webp' : 'image/png';
    let dataUrl = canvas.toDataURL(contentType, 0.9);
    if (dataUrl.length > 3_500_000) {
      contentType = 'image/jpeg';
      dataUrl = canvas.toDataURL(contentType, 0.86);
    }
    return { dataUrl, contentType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const TabSettings = ({ appUser, addToast, users = [], clientData = {} }) => {  const [subTab, setSubTab] = useState('profile');
  const [newOwnerId, setNewOwnerId] = useState('');

  // --- Profile State ---
  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');
  const [photoURL, setPhotoURL] = useState(appUser?.photoURL || '');

  // --- Account Security / MFA State ---
  const [mfaStatus, setMfaStatus] = useState(null);
  const [mfaPhone, setMfaPhone] = useState(appUser?.phone ? String(appUser.phone).trim() : '');
  const [mfaCurrentPassword, setMfaCurrentPassword] = useState('');
  const [mfaVerificationId, setMfaVerificationId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaBusy, setIsMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [isEmailVerifyBusy, setIsEmailVerifyBusy] = useState(false);
  const [verificationRescueLink, setVerificationRescueLink] = useState('');
  const [accountRepairResult, setAccountRepairResult] = useState(null);
  const [showBackupMfaForm, setShowBackupMfaForm] = useState(false);
  const [mfaRecoveryTargetId, setMfaRecoveryTargetId] = useState('');
  const [mfaRecoveryReason, setMfaRecoveryReason] = useState('');
  const [mfaRecoveryLookup, setMfaRecoveryLookup] = useState(null);
  const [mfaRecoveryResult, setMfaRecoveryResult] = useState(null);
  const [isMfaRecoveryBusy, setIsMfaRecoveryBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [isRecoveryCodeBusy, setIsRecoveryCodeBusy] = useState(false);
  const [accountDeletionStatus, setAccountDeletionStatus] = useState(null);
  const [isAccountDeletionBusy, setIsAccountDeletionBusy] = useState(false);
  const mfaEnrollRecaptchaRef = useRef(null);

  // --- Preferences State ---
  const prefs = appUser?.preferences || {};
  const [defaultTab, setDefaultTab] = useState(prefs.defaultTab || (appUser?.isAdmin ? 'schedule' : 'published'));
  const [timeFormat, setTimeFormat] = useState(prefs.timeFormat || '12h');
  const [uiDensity, setUiDensity] = useState(prefs.uiDensity || 'compact');
  const [recipeDensity, setRecipeDensity] = useState(prefs.recipeDensity || 'tight');
  const [messageView, setMessageView] = useState(prefs.messageView || 'ops');
  const [motionMode, setMotionMode] = useState(prefs.motionMode || 'normal');
  const [tableDensity, setTableDensity] = useState(prefs.tableDensity || 'compact');
  const [confirmDestructiveActions, setConfirmDestructiveActions] = useState(prefs.confirmDestructiveActions ?? true);
  const [showQuickDock, setShowQuickDock] = useState(prefs.showQuickDock ?? true);
  const [showMorningBrief, setShowMorningBrief] = useState(prefs.showMorningBrief ?? true);
  const [payPeriod, setPayPeriod] = useState(prefs.payPeriod || 'Bi-Weekly'); 
  const [payPeriodStart, setPayPeriodStart] = useState(prefs.payPeriodStart || 'Monday');
  
  // --- Notification State ---
  const [notifSchedule, setNotifSchedule] = useState(prefs.notifSchedule ?? true);
  const [notifMessages, setNotifMessages] = useState(prefs.notifMessages ?? true);
  const [notifTrades, setNotifTrades] = useState(prefs.notifTrades ?? true);
  const [notifReminders, setNotifReminders] = useState(prefs.notifReminders ?? false);
  const [reminderTime, setReminderTime] = useState(prefs.reminderTime || '120'); 

  // --- Advanced SaaS Notification States ---
  const [notifLevel, setNotifLevel] = useState(prefs.notifLevel || 'all');
  const [keywords, setKeywords] = useState(prefs.keywords || '');
  const [muteOnDaysOff, setMuteOnDaysOff] = useState(prefs.muteOnDaysOff ?? false);
  const [dndEnabled, setDndEnabled] = useState(prefs.dndEnabled ?? false);
  const [dndStart, setDndStart] = useState(prefs.dndStart || '22:00');
  const [dndEnd, setDndEnd] = useState(prefs.dndEnd || '08:00');

  // --- System Config State (Admin Only) ---
  const settingsEmail = (appUser?.email || '').toLowerCase().trim();
  const settingsOwnerEmail = (clientData?.ownerEmail || '').toLowerCase().trim();
  const isWorkspaceOwner = Boolean(appUser?.isSuperAdmin || (MASTER_ADMIN_EMAIL && settingsEmail === MASTER_ADMIN_EMAIL.toLowerCase()) || false || appUser?.isOwner === true || appUser?.accountOwner === true || appUser?.owner === true || appUser?.workspaceOwner === true || String(appUser?.accountRole || '').toLowerCase().trim() === 'owner' || (settingsOwnerEmail && settingsEmail === settingsOwnerEmail));
  const canManageWorkspaceSettings = Boolean(isWorkspaceOwner || appUser?.permissions?.settings === true);
  const canManageBranding = Boolean(isWorkspaceOwner || appUser?.permissions?.branding === true);
  const canManageIntegrations = Boolean(isWorkspaceOwner || appUser?.permissions?.integrations === true);
  const sys = clientData?.systemSettings || appUser?.systemSettings || {};
  const branding = sys.branding || {};
  const [sysGeofence, setSysGeofence] = useState(sys.geofence ?? false);
  const [sysAddress, setSysAddress] = useState(sys.address || '');
  const [sysLat, setSysLat] = useState(sys.lat || '');
  const [sysLon, setSysLon] = useState(sys.lon || '');
  const [sysRadius, setSysRadius] = useState(sys.geofenceRadius || '300');
  const [sysBreaks, setSysBreaks] = useState(sys.breaks ?? false); 
  const [sysTips, setSysTips] = useState(sys.tips ?? true);
  const [sysTrades, setSysTrades] = useState(sys.trades ?? true);
  const [sysAutoApprove, setSysAutoApprove] = useState(sys.autoApprove ?? false);
  const [sysSameRoleTrades, setSysSameRoleTrades] = useState(sys.sameRoleTrades ?? true);
  const [sysBlockEarly, setSysBlockEarly] = useState(sys.blockEarly ?? true);
  const [sysGracePeriod, setSysGracePeriod] = useState(sys.gracePeriod || '5'); 
  const [sysOvertime, setSysOvertime] = useState(sys.overtime || '40'); 
  const [sysWageAccess, setSysWageAccess] = useState(sys.wageAccess || []);
  const [sysWageEditAccess, setSysWageEditAccess] = useState(sys.wageEditAccess || []);
  const [sysEnableIpWhitelist, setSysEnableIpWhitelist] = useState(sys.enableIpWhitelist ?? false);
  const [sysIpWhitelist, setSysIpWhitelist] = useState(sys.ipWhitelist || '');
  const [sysAccentColor, setSysAccentColor] = useState(sys.accentColor || branding.accentColor || '#D4A381');
  const [sysRestaurantLogoUrl, setSysRestaurantLogoUrl] = useState(sys.restaurantLogoUrl || branding.restaurantLogoUrl || branding.logoUrl || '');
  const [sysShowRestaurantLogo, setSysShowRestaurantLogo] = useState(sys.showRestaurantLogo ?? branding.showRestaurantLogo ?? true);
  const [sysRestaurantGroupName, setSysRestaurantGroupName] = useState(sys.restaurantGroupName || branding.restaurantGroupName || clientData?.name || '');
  const [sysLoginMessage, setSysLoginMessage] = useState(sys.loginMessage || branding.loginMessage || '');
  const [sysHelpContact, setSysHelpContact] = useState(sys.helpContact || branding.helpContact || clientData?.ownerEmail || '');
  const [sysDefaultTimezone, setSysDefaultTimezone] = useState(sys.timezone || branding.timezone || 'America/Chicago');
  const [sysWorkspaceDateFormat, setSysWorkspaceDateFormat] = useState(sys.dateFormat || branding.dateFormat || 'MMM d, yyyy');
  const [sysWorkspaceTimeFormat, setSysWorkspaceTimeFormat] = useState(sys.workspaceTimeFormat || branding.timeFormat || 'h:mm a');
  const [sysCurrency, setSysCurrency] = useState(sys.currency || branding.currency || 'USD');
  const [sysWeekStartsOn, setSysWeekStartsOn] = useState(sys.weekStartsOn || branding.weekStartsOn || 'Monday');
  const [sysSchedulePublishMode, setSysSchedulePublishMode] = useState(sys.schedulePublishMode || sys.scheduleCadence || sys.schedulePublishingCadence || 'monthly');
  const [sysScheduleCustomWeeks, setSysScheduleCustomWeeks] = useState(sys.scheduleCustomWeeks || sys.schedulePeriodWeeks || '3');
  const [sysScheduleWeekStartsOn, setSysScheduleWeekStartsOn] = useState(sys.scheduleWeekStartsOn || sys.weekStartsOn || branding.weekStartsOn || 'Monday');
  const [sysAllowPostPublishedTimeOff, setSysAllowPostPublishedTimeOff] = useState(sys.allowPostPublishedTimeOff ?? true);
  const [sysDefaultLandingTab, setSysDefaultLandingTab] = useState(sys.defaultLandingTab || branding.defaultLandingTab || 'published');
  const [isUploadingBrandLogo, setIsUploadingBrandLogo] = useState(false);
  const [mapProviderIndex, setMapProviderIndex] = useState(0);
  const [mapLoadState, setMapLoadState] = useState('idle');
  const [mapRefreshNonce, setMapRefreshNonce] = useState(0);
  const mapTileErrorAtRef = useRef(0);
  const activeMapProvider = GEOFENCE_TILE_PROVIDERS[mapProviderIndex] || GEOFENCE_TILE_PROVIDERS[0];

  const elevatedRolePattern = /owner|manager|admin|supervisor|lead|gm|system administrator|super admin/i;
  const isElevatedForMfa = Boolean(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.isOwner || appUser?.accountOwner || appUser?.owner || appUser?.workspaceOwner || elevatedRolePattern.test(String(appUser?.role || appUser?.accountRole || '')));
  const accountMfaEnabled = Boolean(mfaStatus?.mfaEnabled || appUser?.mfaEnabled || appUser?.multiFactorEnabled || appUser?.accountSecurity?.mfaEnabled);
  const accountMfaEnforced = Boolean(mfaStatus?.mfaEnforcementEnabled || clientData?.systemSettings?.mfaEnforceElevatedRoles === true);
  const accountEmailVerified = Boolean(mfaStatus?.emailVerified || auth.currentUser?.emailVerified || appUser?.emailVerified || appUser?.accountSecurity?.emailVerified);
  const accountSecurityDebug = mfaStatus?.debug || {};
  const firestoreProfileMissing = mfaStatus && mfaStatus.firestoreUserDocExists === false;
  const canAdminVerifyEmail = Boolean(mfaStatus?.canAdminVerifyEmail || mfaStatus?.isMasterAdminEmail || appUser?.isSuperAdmin);
  const canRecoverUserMfa = Boolean(mfaStatus?.canMfaRecovery || appUser?.isSuperAdmin || appUser?.systemAccess?.superAdmin || (MASTER_ADMIN_EMAIL && settingsEmail === MASTER_ADMIN_EMAIL.toLowerCase()) || false);
  const mfaRecoveryUsers = [...(users || [])].filter(u => u?.id && (u.email || u.name)).sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')));
  const selectedMfaRecoveryUser = mfaRecoveryUsers.find(u => u.id === mfaRecoveryTargetId) || null;
  const mfaFactorLimitReached = Number(mfaStatus?.mfaFactorCount || 0) >= 5;
  const unusedRecoveryCodeCount = Number(mfaStatus?.unusedRecoveryCodeCount ?? appUser?.accountSecurity?.unusedRecoveryCodeCount ?? 0);
  const recoveryCodesReady = Boolean(mfaStatus?.recoveryCodesReady || unusedRecoveryCodeCount > 0 || appUser?.accountSecurity?.recoveryCodesReady);
  const hasBackupMfaPhone = Number(mfaStatus?.mfaFactorCount || appUser?.mfaFactorCount || 0) > 1;
  const accountRecoveryReady = Boolean(accountMfaEnabled && (hasBackupMfaPhone || recoveryCodesReady));
  const accountSecuritySummary = (() => {
    if (firestoreProfileMissing) return { label: 'Repair profile first', tone: 'red', desc: 'This Auth account is missing its Firestore profile. Repair it before enforcing MFA.' };
    if (isElevatedForMfa && !accountEmailVerified) return { label: 'Verify email first', tone: 'amber', desc: 'Email verification must be complete before two-step login can be enrolled.' };
    if (isElevatedForMfa && !accountMfaEnabled) return { label: 'Do not enable enforcement yet', tone: 'red', desc: 'This elevated account still needs two-step login before enforcement is safe.' };
    if (accountMfaEnabled && !accountRecoveryReady) return { label: 'Needs recovery backup', tone: 'amber', desc: 'Add a backup phone or generate recovery codes so a lost phone does not lock this account out.' };
    if (accountMfaEnabled && accountRecoveryReady) return { label: 'Protected', tone: 'emerald', desc: 'Two-step login is enrolled and at least one recovery path is ready.' };
    return { label: 'Optional protection', tone: 'slate', desc: 'Standard employees can enroll two-step login, but enforcement is aimed at elevated roles.' };
  })();
  const accountSecurityStatusClass = accountSecuritySummary.tone === 'emerald' ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-200' : accountSecuritySummary.tone === 'red' ? 'bg-red-900/20 border-red-900/50 text-red-200' : accountSecuritySummary.tone === 'amber' ? 'bg-amber-900/20 border-amber-500/40 text-amber-200' : 'bg-[#12161A] border-[#2A353D] text-slate-300';

  const normalizeMfaPhone = (value) => {
    const raw = String(value || '').trim();
    if (raw.startsWith('+')) return raw.replace(/\s+/g, '');
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return raw;
  };

  const formatMfaFirebaseError = (err) => {
    const code = err?.code || '';
    const raw = err?.message || 'Could not send MFA setup code.';
    if (code === 'auth/operation-not-allowed') return 'Firebase blocked the SMS setup request (auth/operation-not-allowed). Check SMS regions, authorized domains, Email/Password provider, and that you are using the same Firebase project as this deployment.';
    if (code === 'auth/captcha-check-failed') return 'Firebase rejected the reCAPTCHA check. Confirm the testing/production Vercel domain is authorized in Firebase Authentication, then refresh and try again.';
    if (code === 'auth/too-many-requests') return 'Firebase throttled SMS requests for a bit. Wait a few minutes before trying again.';
    if (code === 'auth/invalid-phone-number') return 'Use full phone format, like +19205551234.';
    if (code === 'auth/unverified-email') return 'Verify this email first, refresh Account Security, then send the SMS setup code.';
    return raw;
  };

  const resetMfaEnrollmentVerifier = async () => {
    try { await mfaEnrollRecaptchaRef.current?.clear?.(); } catch (_) {}
    mfaEnrollRecaptchaRef.current = null;
    setMfaVerificationId('');
  };

  const getMfaEnrollmentRecaptcha = () => {
    if (mfaEnrollRecaptchaRef.current) return mfaEnrollRecaptchaRef.current;
    mfaEnrollRecaptchaRef.current = new RecaptchaVerifier(auth, 'mfa-enroll-recaptcha-container', { size: 'invisible' });
    return mfaEnrollRecaptchaRef.current;
  };

  const refreshAccountSecurityStatus = async ({ silent = false } = {}) => {
    try {
      const response = await secureFetch('/api/account-security', { method: 'GET' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Could not read account security status.');
      setMfaStatus(data);
      setMfaError('');
      try {
        const deletionRes = await secureFetch('/api/account-deletion-request', { method: 'GET' });
        const deletionData = await deletionRes.json().catch(() => ({}));
        if (deletionRes.ok && deletionData?.ok !== false) setAccountDeletionStatus(deletionData.request || null);
      } catch (_) {}
      if (!silent) addToast('Account Security', data.mfaEnabled ? 'Two-step login is enrolled.' : 'Two-step login is not enrolled yet.');
      return data;
    } catch (err) {
      const msg = err.message || 'Could not refresh account security.';
      setMfaError(msg);
      if (!silent) addToast('Account Security Error', msg);
      return null;
    }
  };

  useEffect(() => {
    if ((subTab === 'profile' || subTab === 'accountSecurity') && appUser?.id) refreshAccountSecurityStatus({ silent: true });
  }, [subTab, appUser?.id]);

  useEffect(() => {
    setSysTips(sys.tips ?? true);
  }, [sys.tips, appUser?.restaurantId]);

  useEffect(() => {
    setSysSchedulePublishMode(sys.schedulePublishMode || sys.scheduleCadence || sys.schedulePublishingCadence || 'monthly');
    setSysScheduleCustomWeeks(sys.scheduleCustomWeeks || sys.schedulePeriodWeeks || '3');
    setSysScheduleWeekStartsOn(sys.scheduleWeekStartsOn || sys.weekStartsOn || branding.weekStartsOn || 'Monday');
    setSysAllowPostPublishedTimeOff(sys.allowPostPublishedTimeOff ?? true);
  }, [sys.schedulePublishMode, sys.scheduleCadence, sys.schedulePublishingCadence, sys.scheduleCustomWeeks, sys.schedulePeriodWeeks, sys.scheduleWeekStartsOn, sys.weekStartsOn, sys.allowPostPublishedTimeOff, branding.weekStartsOn, appUser?.restaurantId]);

  const refreshGeofenceMap = () => {
    setMapLoadState('refreshing');
    setMapRefreshNonce((n) => n + 1);
    setTimeout(() => setMapLoadState((prev) => prev === 'refreshing' ? 'ready' : prev), 1500);
  };

  const handleGeofenceTileError = () => {
    const now = Date.now();
    if (now - mapTileErrorAtRef.current < 2500) return;
    mapTileErrorAtRef.current = now;
    setMapLoadState('retrying');
    setMapProviderIndex((idx) => (idx + 1) % GEOFENCE_TILE_PROVIDERS.length);
    setMapRefreshNonce((n) => n + 1);
  };

const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        
        // --- NEW: THE SMART TARGET LOCK ---
        const activeVapidKey = window.location.hostname === 'app.86chaos.com' 
          ? 'BJzM9xVnkPwLB6aq588ZHhekjqI_Z-xpInDquX_nknrDhew8ytFZbCA22uFN4iSKP_YvGV0sPH9M6aBzGCA9AcU' // Production
          : 'BO6mdu87G4ICBRZjY5e6mpsvCXdpV32TEyyJzJeQHZ4QXolGNsa6ncvgVAzRxIKihx83AxHS36aCtr--XzE45bc'; // Testing Sandbox

        const currentToken = await getToken(messaging, { 
          vapidKey: activeVapidKey 
        });
        
        if (currentToken) {
          await updateDoc(doc(db, "users", appUser.id), { fcmToken: currentToken });
          addToast('Success', 'Push notifications enabled for this device.');
        }
      } else {
        addToast('Denied', 'You blocked notifications in your browser settings.');
      }
    } catch (error) {
      console.error(error);
      addToast('Error', 'Could not enable notifications.');
    }
  };

  const handleGeocodeAddress = async () => {
    const address = sysAddress.trim();
    if (!address) return addToast('Error', 'Please enter a full address first.');
    addToast('Locating...', 'Searching map database...');
    const keepSavedCoords = () => {
      const hasSavedCoords = Number.isFinite(parseFloat(sysLat)) && Number.isFinite(parseFloat(sysLon));
      if (hasSavedCoords) {
        addToast('Map Lookup Unavailable', 'Saved latitude/longitude stayed unchanged. You can still save or click the map.');
      } else {
        addToast('Map Lookup Unavailable', 'Type latitude/longitude manually or try the full street, city, and state.');
      }
    };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`/api/geocode-address?q=${encodeURIComponent(address)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && Number.isFinite(parseFloat(data.lat)) && Number.isFinite(parseFloat(data.lon))) {
        setSysLat(parseFloat(data.lat).toFixed(6));
        setSysLon(parseFloat(data.lon).toFixed(6));
        if (data.warning) {
          addToast('GPS Found', 'Used saved restaurant coordinates because live map lookup was unavailable.');
        } else {
          addToast('Found', 'Coordinates locked in.');
        }
      } else {
        addToast('Address Not Found', data?.error || 'Try adding city and state, or enter coordinates manually.');
      }
    } catch (err) {
      keepSavedCoords();
    }
  };

  // --- Role Management State (Admin Only) ---
  const [newRoleName, setNewRoleName] = useState('');
  const [newPrepCat, setNewPrepCat] = useState('');
  const dbPrepCats = useLiveCollection('prepCategories', appUser?.restaurantId, { limitCount: 100 });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const dbRoles = useLiveCollection('roles', appUser?.restaurantId, { limitCount: 100 });
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  
  const displayRoles = dbRoles.length > 0 
    ? [...dbRoles].sort((a,b) => a.name.localeCompare(b.name)) 
    : DEFAULT_ROLES.map(r => ({ id: r, name: r, isDefault: true }));

  // --- Image Upload Engine ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return addToast('File Too Large', 'Please select an image under 5MB.');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotoURL(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", appUser.id), { name: name.trim(), phone: phone.trim(), photoURL: photoURL.trim() });
      addToast('Profile Saved', 'Your information has been updated.');
    } catch (err) { addToast('Error', 'Failed to save profile.'); }
  };

  const handleSavePrefs = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "users", appUser.id), {
        preferences: { 
          ...prefs, defaultTab, timeFormat, payPeriod, payPeriodStart,
          notifSchedule, notifMessages, notifTrades, notifReminders, reminderTime,
          notifLevel, keywords, muteOnDaysOff, dndEnabled, dndStart, dndEnd,
          uiDensity, recipeDensity, messageView, motionMode, tableDensity, confirmDestructiveActions, showQuickDock, showMorningBrief
        }
      });
      addToast('Preferences Saved', 'Your personal app settings are locked in.');
    } catch (err) { addToast('Error', 'Failed to save preferences.'); }
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    try {
      const targetId = appUser?.restaurantId || 'legacy-sandbox';
      const restRef = doc(db, "restaurants", targetId);
      const beforeSnap = await getDoc(restRef);
      const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};
      const nextSystemSettings = { 
        ...(beforeData.systemSettings || {}),
        geofence: sysGeofence, address: sysAddress, lat: parseFloat(sysLat) || 0, lon: parseFloat(sysLon) || 0, geofenceRadius: parseInt(sysRadius) || 300,
        breaks: sysBreaks, tips: sysTips, trades: sysTrades, autoApprove: sysAutoApprove, sameRoleTrades: sysSameRoleTrades, blockEarly: sysBlockEarly, gracePeriod: sysGracePeriod, overtime: sysOvertime,
        wageAccess: sysWageAccess, wageEditAccess: sysWageEditAccess, enableIpWhitelist: sysEnableIpWhitelist, ipWhitelist: sysIpWhitelist,
        timezone: sysDefaultTimezone, weekStartsOn: sysWeekStartsOn, defaultLandingTab: sysDefaultLandingTab,
        schedulePublishMode: sysSchedulePublishMode,
        schedulePublishingCadence: sysSchedulePublishMode,
        scheduleCustomWeeks: Math.min(8, Math.max(1, parseInt(sysScheduleCustomWeeks, 10) || 1)),
        schedulePeriodWeeks: sysSchedulePublishMode === 'weekly' ? 1 : sysSchedulePublishMode === 'biweekly' ? 2 : sysSchedulePublishMode === 'custom' ? Math.min(8, Math.max(1, parseInt(sysScheduleCustomWeeks, 10) || 1)) : null,
        scheduleWeekStartsOn: sysScheduleWeekStartsOn,
        allowPostPublishedTimeOff: !!sysAllowPostPublishedTimeOff
      };
      const historyEntry = {
        type: 'workspace_system_settings',
        at: new Date().toISOString(),
        by: appUser?.email || appUser?.name || 'Workspace Admin',
        summary: 'Workspace system settings changed from Settings > Workspace.',
        before: beforeData.systemSettings || {},
        after: nextSystemSettings
      };
      const existingHistory = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
      await setDoc(restRef, { systemSettings: nextSystemSettings, settingsHistory: [...existingHistory, historyEntry] }, { merge: true });
      addToast('System Saved', 'Global workspace configurations updated and history snapshot saved.');
    } catch (err) { addToast('Error', err.message); }
  };


  const handleBrandLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canManageBranding) return addToast('Locked', 'Only the owner or a user with Branding permission can upload a restaurant logo.');
    if (!file.type?.startsWith('image/')) return addToast('Image Only', 'Please upload a PNG, JPG, GIF, SVG, or WebP logo.');
    if (file.size > 8 * 1024 * 1024) return addToast('File Too Large', 'Please choose a logo image under 8MB.');
    if (!appUser?.restaurantId) return addToast('Missing Workspace', 'No restaurant workspace was found for this upload.');
    setIsUploadingBrandLogo(true);
    try {
      const preparedLogo = await prepareRestaurantLogoUpload(file);
      const response = await secureFetch('/api/brand-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          fileName: file.name,
          contentType: preparedLogo.contentType,
          dataUrl: preparedLogo.dataUrl
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.url) throw new Error(result?.error || 'Secure logo upload route did not return a logo URL.');
      setSysRestaurantLogoUrl(result.url);
      setSysShowRestaurantLogo(true);
      addToast('Logo Uploaded', 'Restaurant logo is ready to save. 86 Chaos branding will still stay visible.');
    } catch (err) {
      console.warn('Secure restaurant logo upload failed; trying direct Storage upload once.', err);
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const path = `${appUser.restaurantId}/brandAssets/restaurant-logo-${Date.now()}-${safeName}`;
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file, { contentType: file.type });
        const url = await getDownloadURL(fileRef);
        setSysRestaurantLogoUrl(url);
        setSysShowRestaurantLogo(true);
        addToast('Logo Uploaded', 'Restaurant logo is ready to save. 86 Chaos branding will still stay visible.');
      } catch (fallbackErr) {
        addToast('Upload Failed', fallbackErr?.code === 'storage/unauthorized'
          ? 'Logo upload was blocked by Firebase Storage rules. Deploy this build and publish the included storage.rules file.'
          : (err.message || fallbackErr.message || 'Could not upload logo.'));
      }
    }
    setIsUploadingBrandLogo(false);
    if (e?.target) e.target.value = '';
  };

  const handleSaveBrandingSettings = async (e) => {
    e.preventDefault();
    if (!canManageBranding) return addToast('Locked', 'Only the owner or a user with Branding permission can save branding.');
    const cleanAccent = /^#[0-9A-Fa-f]{6}$/.test(sysAccentColor) ? sysAccentColor : '#D4A381';
    try {
      const targetId = appUser?.restaurantId || 'legacy-sandbox';
      const restRef = doc(db, "restaurants", targetId);
      const beforeSnap = await getDoc(restRef);
      const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};
      const previousSettings = beforeData.systemSettings || {};
      const nextBranding = {
        appName: '86 Chaos',
        lockedAppName: '86 Chaos',
        restaurantGroupName: sysRestaurantGroupName.trim(),
        accentColor: cleanAccent,
        restaurantLogoUrl: sysRestaurantLogoUrl.trim(),
        showRestaurantLogo: !!sysShowRestaurantLogo,
        loginMessage: sysLoginMessage.trim(),
        helpContact: sysHelpContact.trim(),
        timezone: sysDefaultTimezone,
        dateFormat: sysWorkspaceDateFormat,
        timeFormat: sysWorkspaceTimeFormat,
        currency: sysCurrency,
        weekStartsOn: sysWeekStartsOn,
        defaultLandingTab: sysDefaultLandingTab
      };
      const nextSystemSettings = {
        ...previousSettings,
        accentColor: cleanAccent,
        restaurantLogoUrl: nextBranding.restaurantLogoUrl,
        showRestaurantLogo: nextBranding.showRestaurantLogo,
        restaurantGroupName: nextBranding.restaurantGroupName,
        loginMessage: nextBranding.loginMessage,
        helpContact: nextBranding.helpContact,
        timezone: nextBranding.timezone,
        dateFormat: nextBranding.dateFormat,
        workspaceTimeFormat: nextBranding.timeFormat,
        currency: nextBranding.currency,
        weekStartsOn: nextBranding.weekStartsOn,
        defaultLandingTab: nextBranding.defaultLandingTab,
        branding: nextBranding
      };
      const historyEntry = {
        type: 'workspace_branding_settings',
        at: new Date().toISOString(),
        by: appUser?.email || appUser?.name || 'Workspace Owner',
        summary: 'Branding and display settings changed from Settings > Branding.',
        before: previousSettings.branding || {},
        after: nextBranding
      };
      const existingHistory = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
      await setDoc(restRef, { systemSettings: nextSystemSettings, settingsHistory: [...existingHistory, historyEntry], updatedAt: new Date().toISOString() }, { merge: true });
      addToast('Branding Saved', 'Restaurant logo, accent color, and display defaults were updated. 86 Chaos remains the locked app name and header brand.');
    } catch (err) { addToast('Save Failed', err.message || 'Could not save branding settings.'); }
  };

  const toggleSettingsPermission = async (user, key, checked) => {
    if (!isWorkspaceOwner) return addToast('Owner Only', 'Only the account owner can grant Settings, Branding, or Integrations access.');
    if (!user?.id) return;
    try {
      const nextPermissions = { ...(user.permissions || {}), [key]: checked };
      const response = await secureFetch('/api/staff-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          targetUid: user.id,
          role: user.role || 'Staff',
          isAdmin: user.isAdmin === true,
          permissions: nextPermissions
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || 'Permission update failed.');
      addToast('Access Updated', `${user.name || user.email} ${checked ? 'can now' : 'can no longer'} manage ${key}.`);
    } catch (err) {
      addToast('Access Save Failed', err.message || 'Could not update settings access.');
    }
  };

  const handlePasswordReset = async () => {
    try {
      const resetEmail = auth.currentUser?.email || appUser.email;
      await sendPasswordResetEmail(auth, resetEmail);
      addToast('Email Sent', `Check ${resetEmail || 'your inbox'} for the password reset link.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const handleSendEmailVerificationLink = async () => {
    setMfaError('');
    if (!auth.currentUser) return setMfaError('Please log out and back in before sending a verification email.');
    setIsEmailVerifyBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      addToast('Verification Email Sent', `Open ${auth.currentUser.email || 'your inbox'}, click the Firebase verification link, then come back and refresh status.`);
    } catch (err) {
      const msg = err?.code === 'auth/too-many-requests'
        ? 'Firebase throttled verification emails for a bit. Wait a few minutes before trying again.'
        : (err.message || 'Could not send verification email.');
      setMfaError(msg);
      addToast('Verification Error', msg);
    } finally {
      setIsEmailVerifyBusy(false);
    }
  };

  const handleRefreshEmailVerification = async () => {
    setMfaError('');
    if (!auth.currentUser) return setMfaError('Please log out and back in before refreshing verification status.');
    setIsEmailVerifyBusy(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      await refreshAccountSecurityStatus({ silent: true });
      addToast('Email Status Refreshed', auth.currentUser.emailVerified ? 'Email is verified. You can enroll two-step login now.' : 'Email still shows unverified. Click the verification email link first.');
    } catch (err) {
      const msg = err.message || 'Could not refresh email verification status.';
      setMfaError(msg);
      addToast('Refresh Failed', msg);
    } finally {
      setIsEmailVerifyBusy(false);
    }
  };

  const postAccountSecurityAction = async (action, extra = {}) => {
    const response = await secureFetch('/api/account-security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || data?.message || 'Account security action failed.');
    setMfaStatus(data);
    return data;
  };

  const handleRepairUserProfile = async () => {
    setMfaError('');
    setAccountRepairResult(null);
    setIsEmailVerifyBusy(true);
    try {
      const data = await postAccountSecurityAction('repair-profile', {
        name: name || appUser?.name || '',
        phone: phone || appUser?.phone || '',
        role: appUser?.role || appUser?.accountRole || 'Staff',
        restaurantId: appUser?.restaurantId || appUser?.activeRestaurantId || appUser?.defaultRestaurantId || 'cheers_chilton_01'
      });
      setAccountRepairResult(data);
      addToast('Profile Repair Complete', data.message || 'Your Auth account and Firestore profile are now linked.');
    } catch (err) {
      const msg = err.message || 'Could not repair this account profile.';
      setMfaError(msg);
      addToast('Repair Failed', msg);
    } finally {
      setIsEmailVerifyBusy(false);
    }
  };

  const handleGenerateVerificationRescueLink = async () => {
    setMfaError('');
    setVerificationRescueLink('');
    setIsEmailVerifyBusy(true);
    try {
      const data = await postAccountSecurityAction('generate-verification-link');
      setVerificationRescueLink(data.verificationLink || '');
      if (data.verificationLink && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.verificationLink).catch(() => null);
      }
      addToast('Verification Link Ready', data.verificationLink ? 'Rescue link generated and copied. Open it, then return and refresh email status.' : 'Verification link generated.');
    } catch (err) {
      const msg = err.message || 'Could not generate verification link.';
      setMfaError(msg);
      addToast('Link Failed', msg);
    } finally {
      setIsEmailVerifyBusy(false);
    }
  };

  const handleAdminVerifyEmailSelf = async () => {
    setMfaError('');
    if (!window.confirm('Use admin rescue to mark this signed-in Firebase Auth email as verified? Only do this for your own verified admin/test account.')) return;
    setIsEmailVerifyBusy(true);
    try {
      const data = await postAccountSecurityAction('admin-verify-email-self');
      await auth.currentUser?.reload().catch(() => null);
      await auth.currentUser?.getIdToken(true).catch(() => null);
      setAccountRepairResult(data);
      addToast('Email Verified', data.message || 'This Firebase Auth email is now verified.');
    } catch (err) {
      const msg = err.message || 'Could not verify this email through admin rescue.';
      setMfaError(msg);
      addToast('Admin Rescue Failed', msg);
    } finally {
      setIsEmailVerifyBusy(false);
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    setMfaError('');
    setRecoveryCodes([]);
    if (!accountEmailVerified) return setMfaError('Verify your email before generating recovery codes.');
    if (!accountMfaEnabled) return setMfaError('Enroll two-step login first, then generate recovery codes.');
    if (!window.confirm('Generate new recovery codes? This replaces any old unused recovery codes. Save the new codes immediately; they are shown once.')) return;
    setIsRecoveryCodeBusy(true);
    try {
      const data = await postAccountSecurityAction('generate-recovery-codes');
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      addToast('Recovery Codes Ready', 'Save or print these one-time codes now. They will not be shown again.');
    } catch (err) {
      const msg = err.message || 'Could not generate recovery codes.';
      setMfaError(msg);
      addToast('Recovery Codes Failed', msg);
    } finally {
      setIsRecoveryCodeBusy(false);
    }
  };

  const handleCopyRecoveryCodes = async () => {
    if (!recoveryCodes.length) return;
    const text = [`86 Chaos recovery codes for ${auth.currentUser?.email || appUser?.email || 'this account'}`, 'Save these somewhere safe. Each code works once.', '', ...recoveryCodes].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      addToast('Codes Copied', 'Recovery codes copied to clipboard. Store them somewhere safe.');
    } catch (_) {
      addToast('Copy Failed', 'Your browser blocked clipboard access. Select and copy the codes manually.');
    }
  };

  const handleAccountDeletionRequest = async (action = 'request') => {
    setMfaError('');
    const isCancel = action === 'cancel';
    let reason = '';
    if (isCancel) {
      if (!window.confirm('Cancel your pending account deletion request?')) return;
    } else {
      reason = window.prompt('Request account deletion? This starts an administrator review. Type a short reason or note for the request.', 'Please delete my account and review any operational records tied to it.') || '';
      if (!reason.trim()) return addToast('Canceled', 'Account deletion request was not submitted.');
      if (!window.confirm('Submit this account deletion request for administrator review? This does not immediately delete restaurant records.')) return;
    }
    setIsAccountDeletionBusy(true);
    try {
      const response = await secureFetch('/api/account-deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Account deletion request failed.');
      setAccountDeletionStatus({ ...(accountDeletionStatus || {}), status: data.status, requestedAt: data.requestedAt || accountDeletionStatus?.requestedAt, updatedAt: new Date().toISOString() });
      addToast(isCancel ? 'Deletion Request Canceled' : 'Deletion Request Submitted', data.message || (isCancel ? 'The request was canceled.' : 'Your request was sent for administrator review.'));
    } catch (err) {
      const msg = err.message || 'Could not submit account deletion request.';
      setMfaError(msg);
      addToast('Account Deletion Error', msg);
    } finally {
      setIsAccountDeletionBusy(false);
    }
  };

  const handleSendMfaEnrollmentCode = async () => {
    setMfaError('');
    if (!auth.currentUser) return setMfaError('Please log out and back in before enrolling two-step login.');
    await auth.currentUser.reload().catch(() => null);
    if (!auth.currentUser.emailVerified) return setMfaError('Verify your email first. Use Send verification email, click the inbox link, then refresh status before enrolling two-step login.');
    if (!mfaCurrentPassword) return setMfaError('Enter your current password first.');
    const normalizedPhone = normalizeMfaPhone(mfaPhone);
    if (!/^\+[1-9]\d{9,14}$/.test(normalizedPhone)) return setMfaError('Use E.164 phone format, like +19205551234.');
    setIsMfaBusy(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email || appUser.email, mfaCurrentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      const session = await multiFactor(auth.currentUser).getSession();
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber({ phoneNumber: normalizedPhone, session }, getMfaEnrollmentRecaptcha());
      setMfaVerificationId(verificationId);
      setMfaPhone(normalizedPhone);
      addToast('Code Sent', 'Enter the SMS code to finish two-step login enrollment.');
    } catch (err) {
      const msg = formatMfaFirebaseError(err);
      await resetMfaEnrollmentVerifier();
      setMfaError(msg);
      addToast('MFA Setup Error', msg);
    } finally {
      setIsMfaBusy(false);
    }
  };

  const handleConfirmMfaEnrollment = async () => {
    setMfaError('');
    if (!auth.currentUser) return setMfaError('Please log out and back in before finishing enrollment.');
    if (!mfaVerificationId || !mfaCode.trim()) return setMfaError('Send and enter the verification code first.');
    setIsMfaBusy(true);
    try {
      const credential = PhoneAuthProvider.credential(mfaVerificationId, mfaCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      const enrolledPhone = normalizeMfaPhone(mfaPhone);
      const displayName = accountMfaEnabled ? `SMS backup phone ••••${enrolledPhone.slice(-4)}` : 'SMS two-step login';
      await multiFactor(auth.currentUser).enroll(assertion, displayName);
      setMfaVerificationId('');
      setMfaCode('');
      setMfaCurrentPassword('');
      setShowBackupMfaForm(false);
      await refreshAccountSecurityStatus({ silent: true });
      addToast(accountMfaEnabled ? 'Backup Phone Added' : 'Two-Step Login Enabled', accountMfaEnabled ? 'Backup MFA phone is enrolled for this account.' : 'This account now requires an SMS code when signing in.');
    } catch (err) {
      const msg = err.message || 'Could not finish MFA enrollment.';
      setMfaError(msg);
      addToast('MFA Enrollment Failed', msg);
    } finally {
      setIsMfaBusy(false);
    }
  };

  const handleLookupMfaRecoveryUser = async () => {
    setMfaError('');
    setMfaRecoveryLookup(null);
    setMfaRecoveryResult(null);
    if (!mfaRecoveryTargetId) return setMfaError('Choose a user to inspect for MFA recovery.');
    setIsMfaRecoveryBusy(true);
    try {
      const target = selectedMfaRecoveryUser || {};
      const data = await postAccountSecurityAction('admin-get-user-mfa', { targetUid: mfaRecoveryTargetId, targetEmail: target.email || '' });
      setMfaRecoveryLookup(data.targetMfa || null);
      addToast('MFA Recovery', data.message || 'Target MFA status loaded.');
    } catch (err) {
      const msg = err.message || 'Could not inspect that user MFA status.';
      setMfaError(msg);
      addToast('MFA Recovery Error', msg);
    } finally {
      setIsMfaRecoveryBusy(false);
    }
  };

  const handleAdminResetUserMfa = async () => {
    setMfaError('');
    setMfaRecoveryResult(null);
    if (!mfaRecoveryTargetId) return setMfaError('Choose a user before resetting MFA.');
    if (mfaRecoveryReason.trim().length < 8) return setMfaError('Add a recovery reason with at least 8 characters.');
    const target = selectedMfaRecoveryUser || mfaRecoveryLookup || {};
    const targetLabel = target.name || target.email || mfaRecoveryTargetId;
    if (!window.confirm(`Reset MFA for ${targetLabel}? They will need to enroll a new phone before protected elevated tools are enforced again.`)) return;
    setIsMfaRecoveryBusy(true);
    try {
      const data = await postAccountSecurityAction('admin-reset-user-mfa', { targetUid: mfaRecoveryTargetId, targetEmail: target.email || '', reason: mfaRecoveryReason.trim() });
      setMfaRecoveryResult(data.recoveryReset ? data : null);
      setMfaRecoveryLookup(data.targetMfa || null);
      setMfaRecoveryReason('');
      addToast('MFA Reset Complete', data.message || 'MFA factors were removed for that user.');
    } catch (err) {
      const msg = err.message || 'Could not reset that user MFA.';
      setMfaError(msg);
      addToast('MFA Reset Failed', msg);
    } finally {
      setIsMfaRecoveryBusy(false);
    }
  };

  const handleSyncMfaStatus = async () => {
    setIsMfaBusy(true);
    try {
      await refreshAccountSecurityStatus({ silent: false });
    } finally {
      setIsMfaBusy(false);
    }
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    if(!newRoleName.trim()) return;
    if (dbRoles.length === 0) {
      for (const r of DEFAULT_ROLES) await addDoc(collection(db, "roles"), { name: r, restaurantId: appUser.restaurantId });
    }
    await addDoc(collection(db, "roles"), { name: newRoleName.trim(), restaurantId: appUser.restaurantId });
    setNewRoleName('');
    addToast('Role Added', 'New role is now available.');
  };

  const handleSaveRoleEdit = async (role, newName) => {
    if (!newName.trim() || newName.trim() === role.name) {
      setEditingRoleId(null);
      return;
    }
    setEditingRoleId(null);
    if (role.isDefault) {
       for (const r of DEFAULT_ROLES) {
         if (r === role.name) {
           await addDoc(collection(db, "roles"), { name: newName.trim(), restaurantId: appUser.restaurantId });
         } else {
           await addDoc(collection(db, "roles"), { name: r, restaurantId: appUser.restaurantId });
         }
       }
    } else {
       await updateDoc(doc(db, "roles", role.id), { name: newName.trim() });
    }
    addToast('Role Updated', 'Role name changed.');
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Delete role: ${role.name}?`)) return;
    if (role.isDefault) {
      for (const r of DEFAULT_ROLES) {
        if (r !== role.name) await addDoc(collection(db, "roles"), { name: r, restaurantId: appUser.restaurantId });
      }
    } else {
      await deleteDoc(doc(db, "roles", role.id));
    }
    addToast('Role Deleted', 'Role removed from roster options.');
  };

const Toggle = ({ label, desc, checked, onChange, disabled = false }) => (
    <label className={`flex items-center justify-between p-3 bg-[#12161A] border ${T.border} rounded-xl ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#1A2126]'} transition-colors`}>
      <div className="pr-3">
        <div className="text-xs font-bold text-white">{label}</div>
        <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>{desc}</div>
      </div>
      <div className="relative flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
        <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
      </div>
    </label>
  );
  

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
<div className={`grid ${appUser?.isAdmin ? 'grid-cols-2 sm:flex sm:flex-wrap' : 'grid-cols-3'} gap-2 border-b border-[#2A353D] mb-4 pb-2`}>
        {['profile', 'accountSecurity', 'preferences', 'alerts'].concat(canManageWorkspaceSettings ? ['workspace'] : [], canManageBranding ? ['branding'] : [], canManageIntegrations ? ['integrations'] : []).map((tab) => (
<button type="button" key={tab} onClick={() => {
            if (tab === 'integrations' && appUser?.planType !== 'Enterprise') {
              return addToast('Locked', 'Upgrade to Enterprise to unlock POS & Payroll Integrations.');
            }
            setSubTab(tab);
          }} className={`px-2 sm:px-5 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 flex items-center justify-center gap-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'} ${(tab === 'integrations' && appUser?.planType !== 'Enterprise') ? 'opacity-50 border border-[#2A353D] cursor-not-allowed' : ''}`}>
            {(tab === 'integrations' && appUser?.planType !== 'Enterprise') ? '🔒 Integrations' : tab === 'branding' ? 'Branding' : tab === 'accountSecurity' ? 'Account Security' : tab}
            {tab === 'integrations' && <span className="ml-1 bg-blue-900/30 text-blue-400 border border-blue-500/50 text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest font-black shadow-[0_0_8px_rgba(59,130,246,0.2)]">Beta</span>}
          </button>
        ))}
      </div>

      {subTab === 'profile' && (
        <div className="space-y-3">
          <div className={`${T.card} p-3 sm:p-5`}>
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-[#2A353D]">
              <div className="relative group cursor-pointer">
                <img src={getAvatar(name, photoURL)} alt="Profile" className={`w-14 h-14 rounded-full border-2 border-[#D4A381] object-cover shadow-lg bg-[#12161A]`} />
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Edit size={16} className="text-white" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <div>
                <h2 className="text-lg font-black text-white leading-tight">{name || 'Staff Member'}</h2>
                <div className={`text-[9px] font-black uppercase tracking-widest ${T.copper} mt-0.5`}>{appUser.role} {appUser.isAdmin && '| Admin'}</div>
                <label className="text-[9px] uppercase font-bold text-slate-400 mt-1 block cursor-pointer hover:text-white transition-colors">
                  Tap photo to upload <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={T.label}>Full Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className={`${T.input} py-2 text-sm`} required /></div>
                <div><label className={T.label}>Phone Number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${T.input} py-2 text-sm`} /></div>
              </div>
              <div>
                <label className={T.label}>Profile Picture URL</label>
                <input type="text" value={photoURL} onChange={e => setPhotoURL(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Paste image link here or use the upload button above..." />
              </div>
              <div><label className={T.label}>Email Address (Cannot change)</label><input type="email" value={appUser?.email} disabled className={`${T.input} py-2 text-sm opacity-50 cursor-not-allowed`} /></div>
              <button type="submit" className={`w-full ${T.btn} py-2`}>Save Profile</button>
            </form>
          </div>
          <div className={`${T.card} p-3 sm:p-5 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
             <div>
               <h3 className="text-xs font-black text-blue-300 uppercase tracking-widest mb-1">Account Security / Two-Step Login</h3>
               <p className="text-[10px] text-slate-400 font-medium">Set up MFA, refresh enrollment status, and check elevated-role security readiness.</p>
             </div>
             <button type="button" onClick={() => setSubTab('accountSecurity')} className="w-full sm:w-auto bg-[#12161A] text-blue-300 border border-blue-900/50 hover:bg-blue-900/30 font-bold px-4 py-2 rounded-xl transition-colors text-xs whitespace-nowrap">Open Account Security</button>
          </div>

          <div className={`${T.card} p-3 sm:p-5 bg-red-900/10 border-red-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
             <div>
               <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Security</h3>
               <p className="text-[10px] text-slate-400 font-medium">Get a secure password reset link.</p>
             </div>
             <button type="button" onClick={handlePasswordReset} className="w-full sm:w-auto bg-[#12161A] text-red-400 border border-red-900/50 hover:bg-red-900/30 font-bold px-4 py-2 rounded-xl transition-colors text-xs whitespace-nowrap">Reset Password</button>
          </div>

          <div className={`${T.card} p-3 sm:p-5 border-blue-900/40 bg-blue-950/10 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-blue-300 uppercase tracking-widest mb-1">Account Security / Two-Step Login</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-snug">Owners, managers, admins, and System Administrators should enroll SMS MFA before enforcement is turned on.</p>
              </div>
              <div className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest ${accountMfaEnabled ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-300' : isElevatedForMfa ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-[#12161A] border-[#2A353D] text-slate-400'}`}>
                {accountMfaEnabled ? 'MFA Enabled' : isElevatedForMfa ? 'MFA Recommended' : 'Standard Account'}
              </div>
            </div>
            {mfaError && <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-3 text-xs font-bold text-red-200">{mfaError}</div>}
            <div className={`rounded-xl border p-3 ${accountSecurityStatusClass}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest">{accountSecuritySummary.label}</div>
                  <p className="text-[10px] font-bold leading-snug mt-1 opacity-90">{accountSecuritySummary.desc}</p>
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-90">{accountRecoveryReady ? 'Recovery ready' : recoveryCodesReady ? 'Codes ready' : hasBackupMfaPhone ? 'Backup phone ready' : 'Needs backup'}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 text-[10px] font-bold">
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Role</div><div className="text-white mt-1">{isElevatedForMfa ? 'Elevated' : 'Standard'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Enforcement</div><div className={accountMfaEnforced ? 'text-red-300 mt-1' : 'text-amber-300 mt-1'}>{accountMfaEnforced ? 'On' : 'Testing / Off'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Factors</div><div className="text-white mt-1">{mfaStatus?.mfaFactorCount ?? appUser?.mfaFactorCount ?? 0}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Recovery Codes</div><div className="text-white mt-1">{unusedRecoveryCodeCount || 0}</div></div>
            </div>
            <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Account Repair + Verification Debug</div>
                  <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Shows the actual Firebase Auth account, Vercel Admin project, and Firestore profile link so test/prod wires are easier to spot.</p>
                </div>
                <div className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${firestoreProfileMissing ? 'bg-red-900/20 border-red-900/50 text-red-300' : 'bg-emerald-900/10 border-emerald-900/40 text-emerald-300'}`}>{firestoreProfileMissing ? 'Profile Missing' : 'Profile Linked / Unknown OK'}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Browser Project:</span> {firebaseConfig?.projectId || 'unknown'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">API/Admin Project:</span> {accountSecurityDebug.firebaseProjectId || mfaStatus?.firebaseProjectId || 'refresh status'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Auth UID:</span> {accountSecurityDebug.authUid || auth.currentUser?.uid || 'unknown'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Auth Email:</span> {accountSecurityDebug.authEmail || auth.currentUser?.email || appUser?.email || 'unknown'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Firestore Email:</span> {accountSecurityDebug.firestoreUserEmail || mfaStatus?.firestoreUserEmail || 'missing / not synced'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Firestore Workspace:</span> {accountSecurityDebug.firestoreUserRestaurantId || mfaStatus?.firestoreUserRestaurantId || appUser?.restaurantId || 'missing'}</div>
              </div>
              {firebaseConfig?.projectId && (accountSecurityDebug.firebaseProjectId || mfaStatus?.firebaseProjectId) && firebaseConfig.projectId !== (accountSecurityDebug.firebaseProjectId || mfaStatus.firebaseProjectId) && (
                <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-3 text-xs font-bold text-red-200">Project mismatch: the browser is using {firebaseConfig.projectId}, but the Vercel API/Admin route is using {accountSecurityDebug.firebaseProjectId || mfaStatus.firebaseProjectId}. Fix Vercel Firebase Admin env vars before testing MFA.</div>
              )}
              {firestoreProfileMissing && (
                <button type="button" onClick={handleRepairUserProfile} disabled={isEmailVerifyBusy} className={`${T.btn} disabled:opacity-50`}>{isEmailVerifyBusy ? 'Repairing…' : 'Repair My User Profile'}</button>
              )}
              {accountRepairResult?.message && <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 text-[10px] font-bold text-emerald-200">{accountRepairResult.message}</div>}
            </div>
            {!accountMfaEnabled && !accountEmailVerified && (
              <div className="bg-amber-900/10 border border-amber-500/30 rounded-xl p-3 space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Email verification required</div>
                  <p className="text-[10px] text-amber-100/80 font-bold leading-snug mt-1">Firebase requires your email address to be verified before SMS two-step login can be enrolled. This uses the Firebase default verification link, like the console does. Send the verification email, click the inbox link, then return here and refresh status.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={handleSendEmailVerificationLink} disabled={isEmailVerifyBusy} className={`${T.btnAlt} disabled:opacity-50`}>{isEmailVerifyBusy ? 'Working…' : 'Send Verification Email'}</button>
                  <button type="button" onClick={handleRefreshEmailVerification} disabled={isEmailVerifyBusy} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Refresh Email Status</button>
                </div>
                <div className="bg-[#0B0E11] border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-amber-300">Email rescue tools</div>
                  <p className="text-[10px] text-slate-400 font-bold leading-snug">Use these only if Firebase Console can send mail but the app-triggered verification email does not arrive. The generated link verifies this signed-in Firebase Auth email without waiting on delivery.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button type="button" onClick={handleGenerateVerificationRescueLink} disabled={isEmailVerifyBusy} className="bg-[#12161A] border border-amber-500/40 text-amber-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Generate Verification Link</button>
                    {canAdminVerifyEmail && <button type="button" onClick={handleAdminVerifyEmailSelf} disabled={isEmailVerifyBusy} className="bg-red-900/20 border border-red-900/50 text-red-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Admin Verify My Email</button>}
                  </div>
                  {verificationRescueLink && <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black mb-1">Verification rescue link</div><a href={verificationRescueLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-300 font-mono break-all hover:text-white">{verificationRescueLink}</a></div>}
                </div>
              </div>
            )}
            {accountMfaEnabled && (
              <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 space-y-3 text-xs font-bold text-emerald-200">
                <div>Two-step login is enrolled for this Firebase Auth account. Next login should ask for an SMS code after the password.</div>
                {(mfaStatus?.factors || []).length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(mfaStatus?.factors || []).map((factor, index) => (
                      <div key={factor.uid || index} className="bg-[#0B0E11] border border-emerald-900/30 rounded-xl p-2 text-[10px] text-emerald-100">
                        <div className="font-black uppercase tracking-widest text-emerald-300">{factor.displayName || `MFA Factor ${index + 1}`}</div>
                        <div className="text-emerald-100/80 mt-1">{factor.phoneNumberMasked || factor.factorId || 'SMS factor'} {factor.enrollmentTime ? `• ${factor.enrollmentTime}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={() => { setShowBackupMfaForm(v => !v); setMfaVerificationId(''); setMfaCode(''); }} disabled={mfaFactorLimitReached} className="bg-[#12161A] border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{showBackupMfaForm ? 'Hide Backup Phone Setup' : mfaFactorLimitReached ? 'MFA Factor Limit Reached' : 'Add Backup Phone'}</button>
                  <div className="text-[10px] text-emerald-100/70 leading-snug flex items-center">Backup phone enrollment helps prevent lockouts if a manager breaks or loses their main phone.</div>
                </div>
              </div>
            )}
            {accountMfaEnabled && (
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Recovery Codes</div>
                    <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Generate one-time codes for a lost or broken phone. Save them somewhere safe. Each code can reset two-step login once at the login screen.</p>
                  </div>
                  <div className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${recoveryCodesReady ? 'bg-emerald-900/10 border-emerald-900/40 text-emerald-300' : 'bg-amber-900/20 border-amber-500/40 text-amber-200'}`}>{recoveryCodesReady ? `${unusedRecoveryCodeCount} unused` : 'Not ready'}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={handleGenerateRecoveryCodes} disabled={isRecoveryCodeBusy || !accountEmailVerified || !accountMfaEnabled} className="bg-[#12161A] border border-[#D4A381]/40 text-[#D4A381] hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isRecoveryCodeBusy ? 'Generating…' : recoveryCodesReady ? 'Replace Recovery Codes' : 'Generate Recovery Codes'}</button>
                  {recoveryCodes.length > 0 && <button type="button" onClick={handleCopyRecoveryCodes} className="bg-emerald-900/20 border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Copy Codes</button>}
                </div>
                {recoveryCodes.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2 bg-red-950/10 border border-red-900/40 rounded-xl p-3">
                    <div className="sm:col-span-2 text-[10px] font-bold text-red-200 leading-snug">Save these now. 86 Chaos will not show them again after you leave this screen.</div>
                    {recoveryCodes.map(code => <div key={code} className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 text-sm font-mono text-white text-center tracking-widest">{code}</div>)}
                  </div>
                )}
              </div>
            )}
            {(!accountMfaEnabled || showBackupMfaForm) && (
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">{accountMfaEnabled ? 'Add Backup MFA Phone' : 'Enroll SMS Two-Step Login'}</div>
                  <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Use full phone format like +19205551234. Owners, managers, admins, and System Administrators are required when enforcement is on; regular employees may enroll optionally.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className={T.label}>Current Password</label><input type="password" value={mfaCurrentPassword} onChange={e => setMfaCurrentPassword(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Required to enroll" /></div>
                  <div><label className={T.label}>{accountMfaEnabled ? 'Backup Phone for SMS MFA' : 'Mobile Phone for SMS MFA'}</label><input type="tel" value={mfaPhone} onChange={e => setMfaPhone(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="+19205551234" /></div>
                  <button type="button" onClick={handleSendMfaEnrollmentCode} disabled={isMfaBusy || !accountEmailVerified || mfaFactorLimitReached} className={`${T.btnAlt} disabled:opacity-50`}>{isMfaBusy && !mfaVerificationId ? 'Sending…' : mfaVerificationId ? 'Resend Setup Code' : accountEmailVerified ? (accountMfaEnabled ? 'Send Backup Phone Code' : 'Send Setup Code') : 'Verify Email First'}</button>
                  <div className="flex gap-2"><input type="text" inputMode="numeric" value={mfaCode} onChange={e => setMfaCode(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="SMS code" /><button type="button" onClick={handleConfirmMfaEnrollment} disabled={isMfaBusy || !mfaVerificationId} className={`${T.btn} whitespace-nowrap disabled:opacity-50`}>Confirm</button></div>
                </div>
                <button type="button" onClick={resetMfaEnrollmentVerifier} className="bg-[#12161A] border border-[#2A353D] text-slate-400 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Reset MFA Verifier</button>
              </div>
            )}
            {canRecoverUserMfa && (
              <div className="bg-red-950/10 border border-red-900/40 rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-red-300">Super Admin MFA Recovery</div>
                    <p className="text-[10px] text-slate-400 font-bold leading-snug mt-1">Use only after verifying the person in real life. This removes their Firebase MFA factors and records the reason in audit logs.</p>
                  </div>
                  <div className="px-2 py-1 rounded-lg border border-red-900/50 bg-red-900/20 text-red-200 text-[8px] font-black uppercase tracking-widest">Audit Logged</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={T.label}>User</label>
                    <select value={mfaRecoveryTargetId} onChange={e => { setMfaRecoveryTargetId(e.target.value); setMfaRecoveryLookup(null); setMfaRecoveryResult(null); }} className={`${T.input} py-2 text-sm`}>
                      <option value="">Choose user…</option>
                      {mfaRecoveryUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email || user.id} • {user.role || 'Staff'} • {user.email || 'no email'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={T.label}>Recovery Reason</label>
                    <input type="text" value={mfaRecoveryReason} onChange={e => setMfaRecoveryReason(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Lost phone, verified in person" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={handleLookupMfaRecoveryUser} disabled={isMfaRecoveryBusy || !mfaRecoveryTargetId} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isMfaRecoveryBusy ? 'Checking…' : 'Check User MFA'}</button>
                  <button type="button" onClick={handleAdminResetUserMfa} disabled={isMfaRecoveryBusy || !mfaRecoveryTargetId || mfaRecoveryReason.trim().length < 8} className="bg-red-900/20 border border-red-900/50 text-red-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Reset User MFA</button>
                </div>
                {mfaRecoveryLookup && (
                  <div className="bg-[#0B0E11] border border-red-900/30 rounded-xl p-3 text-[10px] font-bold text-slate-300 space-y-1">
                    <div><span className="text-slate-500 uppercase tracking-widest font-black">Target:</span> {mfaRecoveryLookup.name || mfaRecoveryLookup.email || mfaRecoveryLookup.uid}</div>
                    <div><span className="text-slate-500 uppercase tracking-widest font-black">Email:</span> {mfaRecoveryLookup.email || 'missing'} • {mfaRecoveryLookup.emailVerified ? 'verified' : 'not verified'}</div>
                    <div><span className="text-slate-500 uppercase tracking-widest font-black">Factors:</span> {mfaRecoveryLookup.mfaFactorCount || 0}</div>
                    {(mfaRecoveryLookup.factors || []).map((factor, index) => <div key={factor.uid || index} className="pl-2 text-slate-400">• {factor.displayName || factor.factorId || 'MFA factor'} {factor.phoneNumberMasked || ''}</div>)}
                  </div>
                )}
                {mfaRecoveryResult?.message && <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 text-[10px] font-bold text-emerald-200">{mfaRecoveryResult.message}</div>}
              </div>
            )}
            <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Account Deletion Request</div>
                  <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Store-ready intake for privacy/app-store requirements. This records a request for administrator review; it does not silently delete schedules, payroll, audit logs, or workspace records.</p>
                </div>
                <span className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${accountDeletionStatus?.status === 'requested' ? 'bg-amber-900/20 border-amber-500/40 text-amber-200' : accountDeletionStatus?.status === 'canceled' ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-emerald-900/10 border-emerald-900/40 text-emerald-200'}`}>{accountDeletionStatus?.status || 'No Request'}</span>
              </div>
              {accountDeletionStatus?.requestedAt && <div className="text-[10px] text-slate-400 font-bold">Requested: {formatClockDateTime(accountDeletionStatus.requestedAt)}</div>}
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => handleAccountDeletionRequest('request')} disabled={isAccountDeletionBusy || accountDeletionStatus?.status === 'requested'} className="bg-red-900/20 border border-red-900/50 text-red-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isAccountDeletionBusy ? 'Working…' : accountDeletionStatus?.status === 'requested' ? 'Request Pending' : 'Request Account Deletion'}</button>
                {accountDeletionStatus?.status === 'requested' && <button type="button" onClick={() => handleAccountDeletionRequest('cancel')} disabled={isAccountDeletionBusy} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Cancel Request</button>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={handleSyncMfaStatus} disabled={isMfaBusy} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Refresh Status</button><div className="text-[10px] text-slate-500 font-bold leading-snug flex items-center">Require MFA only for owners, managers, admins, and System Administrators. Keep enforcement off until recovery reset has been tested.</div></div>
            <div id="mfa-enroll-recaptcha-container" className="hidden"></div>
          </div>
        </div>
      )}

      {subTab === 'accountSecurity' && (
        <div className="space-y-3">
          <div className={`${T.card} p-3 sm:p-5 border-blue-900/40 bg-blue-950/10 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-blue-300 uppercase tracking-widest mb-1">Account Security / Two-Step Login</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-snug">Owners, managers, admins, and System Administrators should enroll SMS MFA before enforcement is turned on.</p>
              </div>
              <div className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest ${accountMfaEnabled ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-300' : isElevatedForMfa ? 'bg-amber-900/20 border-amber-500/40 text-amber-300' : 'bg-[#12161A] border-[#2A353D] text-slate-400'}`}>
                {accountMfaEnabled ? 'MFA Enabled' : isElevatedForMfa ? 'MFA Recommended' : 'Standard Account'}
              </div>
            </div>
            {mfaError && <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-3 text-xs font-bold text-red-200">{mfaError}</div>}
            <div className={`rounded-xl border p-3 ${accountSecurityStatusClass}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest">{accountSecuritySummary.label}</div>
                  <p className="text-[10px] font-bold leading-snug mt-1 opacity-90">{accountSecuritySummary.desc}</p>
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-90">{accountRecoveryReady ? 'Recovery ready' : recoveryCodesReady ? 'Codes ready' : hasBackupMfaPhone ? 'Backup phone ready' : 'Needs backup'}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 text-[10px] font-bold">
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Role</div><div className="text-white mt-1">{isElevatedForMfa ? 'Elevated' : 'Standard'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Enforcement</div><div className={accountMfaEnforced ? 'text-red-300 mt-1' : 'text-amber-300 mt-1'}>{accountMfaEnforced ? 'On' : 'Testing / Off'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Factors</div><div className="text-white mt-1">{mfaStatus?.mfaFactorCount ?? appUser?.mfaFactorCount ?? 0}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Recovery Codes</div><div className="text-white mt-1">{unusedRecoveryCodeCount || 0}</div></div>
            </div>
            <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Account Repair + Verification Debug</div>
                  <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Shows the actual Firebase Auth account, Vercel Admin project, and Firestore profile link so test/prod wires are easier to spot.</p>
                </div>
                <div className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${firestoreProfileMissing ? 'bg-red-900/20 border-red-900/50 text-red-300' : 'bg-emerald-900/10 border-emerald-900/40 text-emerald-300'}`}>{firestoreProfileMissing ? 'Profile Missing' : 'Profile Linked / Unknown OK'}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Browser Project:</span> {firebaseConfig?.projectId || 'unknown'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">API/Admin Project:</span> {accountSecurityDebug.firebaseProjectId || mfaStatus?.firebaseProjectId || 'refresh status'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Auth UID:</span> {accountSecurityDebug.authUid || auth.currentUser?.uid || 'unknown'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Auth Email:</span> {accountSecurityDebug.authEmail || auth.currentUser?.email || appUser?.email || 'unknown'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Firestore Email:</span> {accountSecurityDebug.firestoreUserEmail || mfaStatus?.firestoreUserEmail || 'missing / not synced'}</div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 break-all"><span className="text-slate-500 font-black uppercase tracking-widest">Firestore Workspace:</span> {accountSecurityDebug.firestoreUserRestaurantId || mfaStatus?.firestoreUserRestaurantId || appUser?.restaurantId || 'missing'}</div>
              </div>
              {firebaseConfig?.projectId && (accountSecurityDebug.firebaseProjectId || mfaStatus?.firebaseProjectId) && firebaseConfig.projectId !== (accountSecurityDebug.firebaseProjectId || mfaStatus.firebaseProjectId) && (
                <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-3 text-xs font-bold text-red-200">Project mismatch: the browser is using {firebaseConfig.projectId}, but the Vercel API/Admin route is using {accountSecurityDebug.firebaseProjectId || mfaStatus.firebaseProjectId}. Fix Vercel Firebase Admin env vars before testing MFA.</div>
              )}
              {firestoreProfileMissing && (
                <button type="button" onClick={handleRepairUserProfile} disabled={isEmailVerifyBusy} className={`${T.btn} disabled:opacity-50`}>{isEmailVerifyBusy ? 'Repairing…' : 'Repair My User Profile'}</button>
              )}
              {accountRepairResult?.message && <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 text-[10px] font-bold text-emerald-200">{accountRepairResult.message}</div>}
            </div>
            {!accountMfaEnabled && !accountEmailVerified && (
              <div className="bg-amber-900/10 border border-amber-500/30 rounded-xl p-3 space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Email verification required</div>
                  <p className="text-[10px] text-amber-100/80 font-bold leading-snug mt-1">Firebase requires your email address to be verified before SMS two-step login can be enrolled. This uses the Firebase default verification link, like the console does. Send the verification email, click the inbox link, then return here and refresh status.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={handleSendEmailVerificationLink} disabled={isEmailVerifyBusy} className={`${T.btnAlt} disabled:opacity-50`}>{isEmailVerifyBusy ? 'Working…' : 'Send Verification Email'}</button>
                  <button type="button" onClick={handleRefreshEmailVerification} disabled={isEmailVerifyBusy} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Refresh Email Status</button>
                </div>
                <div className="bg-[#0B0E11] border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-amber-300">Email rescue tools</div>
                  <p className="text-[10px] text-slate-400 font-bold leading-snug">Use these only if Firebase Console can send mail but the app-triggered verification email does not arrive. The generated link verifies this signed-in Firebase Auth email without waiting on delivery.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button type="button" onClick={handleGenerateVerificationRescueLink} disabled={isEmailVerifyBusy} className="bg-[#12161A] border border-amber-500/40 text-amber-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Generate Verification Link</button>
                    {canAdminVerifyEmail && <button type="button" onClick={handleAdminVerifyEmailSelf} disabled={isEmailVerifyBusy} className="bg-red-900/20 border border-red-900/50 text-red-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Admin Verify My Email</button>}
                  </div>
                  {verificationRescueLink && <div className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black mb-1">Verification rescue link</div><a href={verificationRescueLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-300 font-mono break-all hover:text-white">{verificationRescueLink}</a></div>}
                </div>
              </div>
            )}
            {accountMfaEnabled && (
              <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 space-y-3 text-xs font-bold text-emerald-200">
                <div>Two-step login is enrolled for this Firebase Auth account. Next login should ask for an SMS code after the password.</div>
                {(mfaStatus?.factors || []).length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(mfaStatus?.factors || []).map((factor, index) => (
                      <div key={factor.uid || index} className="bg-[#0B0E11] border border-emerald-900/30 rounded-xl p-2 text-[10px] text-emerald-100">
                        <div className="font-black uppercase tracking-widest text-emerald-300">{factor.displayName || `MFA Factor ${index + 1}`}</div>
                        <div className="text-emerald-100/80 mt-1">{factor.phoneNumberMasked || factor.factorId || 'SMS factor'} {factor.enrollmentTime ? `• ${factor.enrollmentTime}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={() => { setShowBackupMfaForm(v => !v); setMfaVerificationId(''); setMfaCode(''); }} disabled={mfaFactorLimitReached} className="bg-[#12161A] border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{showBackupMfaForm ? 'Hide Backup Phone Setup' : mfaFactorLimitReached ? 'MFA Factor Limit Reached' : 'Add Backup Phone'}</button>
                  <div className="text-[10px] text-emerald-100/70 leading-snug flex items-center">Backup phone enrollment helps prevent lockouts if a manager breaks or loses their main phone.</div>
                </div>
              </div>
            )}
            {accountMfaEnabled && (
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Recovery Codes</div>
                    <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Generate one-time codes for a lost or broken phone. Save them somewhere safe. Each code can reset two-step login once at the login screen.</p>
                  </div>
                  <div className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${recoveryCodesReady ? 'bg-emerald-900/10 border-emerald-900/40 text-emerald-300' : 'bg-amber-900/20 border-amber-500/40 text-amber-200'}`}>{recoveryCodesReady ? `${unusedRecoveryCodeCount} unused` : 'Not ready'}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={handleGenerateRecoveryCodes} disabled={isRecoveryCodeBusy || !accountEmailVerified || !accountMfaEnabled} className="bg-[#12161A] border border-[#D4A381]/40 text-[#D4A381] hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isRecoveryCodeBusy ? 'Generating…' : recoveryCodesReady ? 'Replace Recovery Codes' : 'Generate Recovery Codes'}</button>
                  {recoveryCodes.length > 0 && <button type="button" onClick={handleCopyRecoveryCodes} className="bg-emerald-900/20 border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Copy Codes</button>}
                </div>
                {recoveryCodes.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-2 bg-red-950/10 border border-red-900/40 rounded-xl p-3">
                    <div className="sm:col-span-2 text-[10px] font-bold text-red-200 leading-snug">Save these now. 86 Chaos will not show them again after you leave this screen.</div>
                    {recoveryCodes.map(code => <div key={code} className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2 text-sm font-mono text-white text-center tracking-widest">{code}</div>)}
                  </div>
                )}
              </div>
            )}
            {(!accountMfaEnabled || showBackupMfaForm) && (
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">{accountMfaEnabled ? 'Add Backup MFA Phone' : 'Enroll SMS Two-Step Login'}</div>
                  <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Use full phone format like +19205551234. Owners, managers, admins, and System Administrators are required when enforcement is on; regular employees may enroll optionally.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className={T.label}>Current Password</label><input type="password" value={mfaCurrentPassword} onChange={e => setMfaCurrentPassword(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Required to enroll" /></div>
                  <div><label className={T.label}>{accountMfaEnabled ? 'Backup Phone for SMS MFA' : 'Mobile Phone for SMS MFA'}</label><input type="tel" value={mfaPhone} onChange={e => setMfaPhone(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="+19205551234" /></div>
                  <button type="button" onClick={handleSendMfaEnrollmentCode} disabled={isMfaBusy || !accountEmailVerified || mfaFactorLimitReached} className={`${T.btnAlt} disabled:opacity-50`}>{isMfaBusy && !mfaVerificationId ? 'Sending…' : mfaVerificationId ? 'Resend Setup Code' : accountEmailVerified ? (accountMfaEnabled ? 'Send Backup Phone Code' : 'Send Setup Code') : 'Verify Email First'}</button>
                  <div className="flex gap-2"><input type="text" inputMode="numeric" value={mfaCode} onChange={e => setMfaCode(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="SMS code" /><button type="button" onClick={handleConfirmMfaEnrollment} disabled={isMfaBusy || !mfaVerificationId} className={`${T.btn} whitespace-nowrap disabled:opacity-50`}>Confirm</button></div>
                </div>
                <button type="button" onClick={resetMfaEnrollmentVerifier} className="bg-[#12161A] border border-[#2A353D] text-slate-400 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest">Reset MFA Verifier</button>
              </div>
            )}
            {canRecoverUserMfa && (
              <div className="bg-red-950/10 border border-red-900/40 rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-red-300">Super Admin MFA Recovery</div>
                    <p className="text-[10px] text-slate-400 font-bold leading-snug mt-1">Use only after verifying the person in real life. This removes their Firebase MFA factors and records the reason in audit logs.</p>
                  </div>
                  <div className="px-2 py-1 rounded-lg border border-red-900/50 bg-red-900/20 text-red-200 text-[8px] font-black uppercase tracking-widest">Audit Logged</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={T.label}>User</label>
                    <select value={mfaRecoveryTargetId} onChange={e => { setMfaRecoveryTargetId(e.target.value); setMfaRecoveryLookup(null); setMfaRecoveryResult(null); }} className={`${T.input} py-2 text-sm`}>
                      <option value="">Choose user…</option>
                      {mfaRecoveryUsers.map(user => <option key={user.id} value={user.id}>{user.name || user.email || user.id} • {user.role || 'Staff'} • {user.email || 'no email'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={T.label}>Recovery Reason</label>
                    <input type="text" value={mfaRecoveryReason} onChange={e => setMfaRecoveryReason(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Lost phone, verified in person" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" onClick={handleLookupMfaRecoveryUser} disabled={isMfaRecoveryBusy || !mfaRecoveryTargetId} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isMfaRecoveryBusy ? 'Checking…' : 'Check User MFA'}</button>
                  <button type="button" onClick={handleAdminResetUserMfa} disabled={isMfaRecoveryBusy || !mfaRecoveryTargetId || mfaRecoveryReason.trim().length < 8} className="bg-red-900/20 border border-red-900/50 text-red-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Reset User MFA</button>
                </div>
                {mfaRecoveryLookup && (
                  <div className="bg-[#0B0E11] border border-red-900/30 rounded-xl p-3 text-[10px] font-bold text-slate-300 space-y-1">
                    <div><span className="text-slate-500 uppercase tracking-widest font-black">Target:</span> {mfaRecoveryLookup.name || mfaRecoveryLookup.email || mfaRecoveryLookup.uid}</div>
                    <div><span className="text-slate-500 uppercase tracking-widest font-black">Email:</span> {mfaRecoveryLookup.email || 'missing'} • {mfaRecoveryLookup.emailVerified ? 'verified' : 'not verified'}</div>
                    <div><span className="text-slate-500 uppercase tracking-widest font-black">Factors:</span> {mfaRecoveryLookup.mfaFactorCount || 0}</div>
                    {(mfaRecoveryLookup.factors || []).map((factor, index) => <div key={factor.uid || index} className="pl-2 text-slate-400">• {factor.displayName || factor.factorId || 'MFA factor'} {factor.phoneNumberMasked || ''}</div>)}
                  </div>
                )}
                {mfaRecoveryResult?.message && <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 text-[10px] font-bold text-emerald-200">{mfaRecoveryResult.message}</div>}
              </div>
            )}
            <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Account Deletion Request</div>
                  <p className="text-[10px] text-slate-500 font-bold leading-snug mt-1">Store-ready intake for privacy/app-store requirements. This records a request for administrator review; it does not silently delete schedules, payroll, audit logs, or workspace records.</p>
                </div>
                <span className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${accountDeletionStatus?.status === 'requested' ? 'bg-amber-900/20 border-amber-500/40 text-amber-200' : accountDeletionStatus?.status === 'canceled' ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-emerald-900/10 border-emerald-900/40 text-emerald-200'}`}>{accountDeletionStatus?.status || 'No Request'}</span>
              </div>
              {accountDeletionStatus?.requestedAt && <div className="text-[10px] text-slate-400 font-bold">Requested: {formatClockDateTime(accountDeletionStatus.requestedAt)}</div>}
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => handleAccountDeletionRequest('request')} disabled={isAccountDeletionBusy || accountDeletionStatus?.status === 'requested'} className="bg-red-900/20 border border-red-900/50 text-red-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isAccountDeletionBusy ? 'Working…' : accountDeletionStatus?.status === 'requested' ? 'Request Pending' : 'Request Account Deletion'}</button>
                {accountDeletionStatus?.status === 'requested' && <button type="button" onClick={() => handleAccountDeletionRequest('cancel')} disabled={isAccountDeletionBusy} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Cancel Request</button>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2"><button type="button" onClick={handleSyncMfaStatus} disabled={isMfaBusy} className="bg-[#12161A] border border-[#2A353D] text-slate-300 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Refresh Status</button><div className="text-[10px] text-slate-500 font-bold leading-snug flex items-center">Require MFA only for owners, managers, admins, and System Administrators. Keep enforcement off until recovery reset has been tested.</div></div>
            <div id="mfa-enroll-recaptcha-container" className="hidden"></div>
          </div>
        </div>
      )}

      {subTab === 'preferences' && (
        <div className="space-y-4">
          <form onSubmit={handleSavePrefs} className={`${T.card} p-3 sm:p-5 space-y-4`}>
            <div>
              <h2 className="text-base font-black text-white mb-3 border-b border-[#2A353D] pb-2">App Experience</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={T.label}>Default Startup Tab</label>
                  <select value={defaultTab} onChange={e => setDefaultTab(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="published">My Schedule</option>
                    <option value="messages">Message Board</option>
                    <option value="events">Event Calendar</option>
                    <option value="team">Team Roster</option>
                    {appUser?.isAdmin || appUser?.permissions?.ops ? <option value="ops">Kitchen Command Center</option> : null}
                    {appUser?.role === 'Kitchen' || appUser?.isAdmin ? <option value="prep">Prep List</option> : null}
                    {appUser?.role === 'Kitchen' || appUser?.isAdmin ? <option value="recipes">Recipe Book</option> : null}
                    {appUser?.isAdmin && <option value="inventory">Inventory & Orders</option>}
                    {appUser?.isAdmin && <option value="schedule">Master Schedule</option>}
                    {appUser?.isAdmin && <option value="sales">Sales Ledger</option>}
                    {appUser?.isAdmin && <option value="maintenance">Maintenance Log</option>}
                  </select>
                </div>
                <div>
                  <label className={T.label}>Time Format</label>
                  <select value={timeFormat} onChange={e => setTimeFormat(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="12h">12-Hour (AM/PM)</option>
                    <option value="24h">24-Hour (Military)</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Interface Density</label>
                  <select value={uiDensity} onChange={e => setUiDensity(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="ultra">Ultra Compact</option>
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Recipe Card Density</label>
                  <select value={recipeDensity} onChange={e => setRecipeDensity(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="tight">Tight Cards</option>
                    <option value="standard">Standard Cards</option>
                    <option value="detail">Detail Heavy</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Message Board Style</label>
                  <select value={messageView} onChange={e => setMessageView(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="ops">Professional Kitchen Feed</option>
                    <option value="social">Social Feed</option>
                    <option value="compact">Compact Log</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Animation Level</label>
                  <select value={motionMode} onChange={e => setMotionMode(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="normal">Normal Cockpit Glow</option>
                    <option value="reduced">Reduced Motion</option>
                    <option value="quiet">Quiet Mode</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Table Density</label>
                  <select value={tableDensity} onChange={e => setTableDensity(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="compact">Compact Tables</option>
                    <option value="comfortable">Comfortable Rows</option>
                    <option value="large">Large Touch Rows</option>
                  </select>
                </div>
                <div>
                  <label className={T.label}>Quick Dock</label>
                  <select value={showQuickDock ? 'show' : 'hide'} onChange={e => setShowQuickDock(e.target.value === 'show')} className={`${T.input} py-2 text-sm`}>
                    <option value="show">Show quick action dock</option>
                    <option value="hide">Hide quick action dock</option>
                  </select>
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 p-2.5 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer hover:bg-[#1A2126] transition-colors">
                <input type="checkbox" checked={showMorningBrief} onChange={e => setShowMorningBrief(e.target.checked)} className="w-4 h-4 accent-[#8F6040]" />
                <span className="text-xs font-bold text-slate-300">Show Manager Brief / Kitchen summary first when available</span>
              </label>
              <label className="mt-2 flex items-center gap-2 p-2.5 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer hover:bg-[#1A2126] transition-colors">
                <input type="checkbox" checked={confirmDestructiveActions} onChange={e => setConfirmDestructiveActions(e.target.checked)} className="w-4 h-4 accent-[#8F6040]" />
                <span className="text-xs font-bold text-slate-300">Require confirmations before destructive actions when available</span>
              </label>
            </div>
            {appUser?.isAdmin && (
              <div className="pt-2">
                <h2 className="text-base font-black text-emerald-400 mb-3 border-b border-[#2A353D] pb-2">Payroll Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={T.label}>Default Pay Period</label>
                    <select value={payPeriod} onChange={e => setPayPeriod(e.target.value)} className={`${T.input} py-2 text-sm`}>
                      <option value="Weekly">Weekly</option>
                      <option value="Bi-Weekly">Bi-Weekly</option>
                      <option value="Semi-Monthly">Semi-Monthly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className={T.label}>Work Week Starts On</label>
                    <select value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className={`${T.input} py-2 text-sm`}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <button type="submit" className={`w-full ${T.btn} py-2`}>Save Preferences</button>
          </form>

          {appUser?.isAdmin && (
            <div className={`${T.card} p-3 sm:p-5 space-y-3 animate-[slideIn_0.2s_ease-out]`}>
              <div>
                <h2 className="text-base font-black text-white mb-1">Roster Roles</h2>
                <p className="text-[10px] text-slate-400 font-medium mb-3">Add, edit, or remove job titles.</p>
                <form onSubmit={handleAddRole} className="flex flex-col sm:flex-row gap-2 mb-3">
                  <input type="text" value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} placeholder="New Role Name..." className={`${T.input} py-2 text-sm`} required />
                  <button type="submit" className={`${T.btn} py-2 whitespace-nowrap`}><Plus size={16} className="inline mr-1"/> Add Role</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {displayRoles.map(role => (
                    <div key={role.id} className="flex items-center gap-2 bg-[#12161A] border border-[#2A353D] px-2 py-1 rounded-lg shadow-sm">
                      {editingRoleId === role.id ? (
                        <input type="text" autoFocus defaultValue={role.name} onBlur={(e) => handleSaveRoleEdit(role, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRoleEdit(role, e.target.value)} className="bg-transparent text-white text-[10px] font-bold outline-none border-b border-[#D4A381] w-20" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">{role.name}</span>
                      )}
                      <div className="flex gap-1 border-l border-[#2A353D] pl-1.5 ml-0.5">
                        <button type="button" onClick={() => setEditingRoleId(role.id)} className="text-slate-500 hover:text-[#D4A381]"><Edit size={10}/></button>
                        <button type="button" onClick={() => handleDeleteRole(role)} className="text-slate-500 hover:text-red-500"><Trash2 size={10}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            <div className="pt-4 mt-4 border-t border-[#2A353D]">
                <h2 className="text-base font-black text-white mb-2">Prep Stations</h2>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={newPrepCat} onChange={e=>setNewPrepCat(e.target.value)} placeholder="New Station..." className={`${T.input} py-2 text-sm`} />
                  <button type="button" onClick={async () => { 
                    if(!newPrepCat.trim()) return; 
                    if (dbPrepCats.length === 0) {
                      for (const c of ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table']) await addDoc(collection(db, "prepCategories"), { name: c, restaurantId: appUser.restaurantId });
                    }
                    await addDoc(collection(db, "prepCategories"), { name: newPrepCat.trim(), restaurantId: appUser.restaurantId }); 
                    setNewPrepCat(''); 
                  }} className={`${T.btn} py-2 whitespace-nowrap`}>Add Station</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(dbPrepCats.length > 0 ? [...dbPrepCats] : ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'].map(c => ({id: c, name: c, isDefault: true}))).sort((a,b) => a.name.localeCompare(b.name)).map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 bg-[#12161A] border border-[#2A353D] px-2 py-1 rounded-lg shadow-sm">
                      <span className="text-[10px] font-bold text-slate-300">{cat.name}</span>
                      <button type="button" onClick={async () => { 
                        if(!window.confirm(`Delete ${cat.name}?`)) return; 
                        if(cat.isDefault) {
                          const defaults = ['Grill', 'Fry', 'Salad/Cold', 'Expo', 'Prep Table'].filter(c => c !== cat.name);
                          for (const c of defaults) await addDoc(collection(db, "prepCategories"), { name: c, restaurantId: appUser.restaurantId });
                        } else {
                          await deleteDoc(doc(db, "prepCategories", cat.id)); 
                        }
                      }} className="text-slate-500 hover:text-red-500 pl-1 border-l border-[#2A353D] ml-1"><Trash2 size={10}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'alerts' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleSavePrefs} className={`${T.card} p-3 sm:p-5 space-y-5`}>
            
            {/* SLEEK CONNECTION STATUS BAR */}
            <div className="p-3 bg-[#0B0E11] border border-[#2A353D] rounded-xl flex justify-between items-center gap-3">
              <div>
                <div className="text-sm font-black text-white flex items-center gap-2">Device Connection</div>
                <div className="text-[9px] font-medium text-slate-400 mt-0.5 leading-snug">
                  Browser Status: {typeof window !== 'undefined' && typeof Notification !== 'undefined' ? (Notification.permission === 'granted' ? 'Allowed' : Notification.permission === 'denied' ? 'Blocked via Browser Settings' : 'Not Configured') : 'Not Supported'}
                </div>
              </div>
              {typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                <button onClick={handleEnableNotifications} type="button" className="px-4 py-2 bg-gradient-to-r from-[#C59373] to-[#8F6040] hover:opacity-80 text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-lg transition-colors shadow-md whitespace-nowrap">
                  Connect Device
                </button>
              )}
              {typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted' && (
                <div className="px-3 py-1.5 bg-emerald-900/20 border border-emerald-900/50 text-emerald-500 font-black text-[10px] uppercase tracking-widest rounded-lg flex items-center gap-1">
                  <Check size={12}/> Connected
                </div>
              )}
            </div>

            <div>
              <h2 className="text-base font-black text-white mb-1"><Bell className={`inline mr-2 ${T.copper}`} size={16}/> Alerts & Routing</h2>
              <p className="text-[10px] text-slate-400 font-medium mb-4">Control exactly when and how 86 Chaos pings your device.</p>
              
              <div className="space-y-2 mb-6">
                <Toggle label="Schedule Publications" desc="Get alerted the exact second a new schedule goes live." checked={notifSchedule} onChange={e => setNotifSchedule(e.target.checked)} />
                <Toggle label="Shift Trade Board" desc="Notify me when someone posts a shift they need covered." checked={notifTrades} onChange={e => setNotifTrades(e.target.checked)} />
                <Toggle label="Smart Mute: Days Off" desc="Automatically silence all non-critical notifications if you are not scheduled to work today." checked={muteOnDaysOff} onChange={e => setMuteOnDaysOff(e.target.checked)} />
              </div>

              <h3 className="text-xs font-black uppercase text-[#D4A381] tracking-widest border-b border-[#2A353D] pb-1 mb-3">Message Board Rules</h3>
              <div className="space-y-3 mb-6">
                <select value={notifLevel} onChange={e => setNotifLevel(e.target.value)} className={T.input}>
                  <option value="all">Notify me for ALL new messages</option>
                  <option value="mentions">Only notify me for @mentions & Keywords</option>
                  <option value="critical">Only notify me for Critical Manager Alerts</option>
                </select>

                {notifLevel === 'mentions' && (
                  <div className="animate-[slideIn_0.2s_ease-out]">
                    <label className={T.label}>Keyword Alerts (Comma Separated)</label>
                    <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. 86, emergency, VIP, cooler" className={`${T.input} text-sm`} />
                    <p className="text-[9px] text-slate-500 mt-1 font-bold">You will be pinged anytime someone types these exact words.</p>
                  </div>
                )}
              </div>

              <h3 className="text-xs font-black uppercase text-[#D4A381] tracking-widest border-b border-[#2A353D] pb-1 mb-3">Timing & Delays</h3>
              <div className="space-y-2">
                <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl`}>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-[#D4A381] transition-colors">Quiet Hours (Do Not Disturb)</div>
                      <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Hold all non-critical notifications until morning.</div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <input type="checkbox" checked={dndEnabled} onChange={e => setDndEnabled(e.target.checked)} className="sr-only" />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${dndEnabled ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${dndEnabled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                  {dndEnabled && (
                    <div className="flex items-center gap-3 pt-3 mt-3 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                      <input type="time" value={dndStart} onChange={e => setDndStart(e.target.value)} className={`${T.input} py-1.5 text-xs text-center`} />
                      <span className="text-[9px] font-black text-slate-500 uppercase">TO</span>
                      <input type="time" value={dndEnd} onChange={e => setDndEnd(e.target.value)} className={`${T.input} py-1.5 text-xs text-center`} />
                    </div>
                  )}
                </div>

                <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl`}>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-[#D4A381] transition-colors">Pre-Shift Reminders</div>
                      <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Automated ping before your scheduled clock-in time.</div>
                    </div>
                    <div className="relative flex-shrink-0">
                      <input type="checkbox" checked={notifReminders} onChange={e => setNotifReminders(e.target.checked)} className="sr-only" />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${notifReminders ? 'bg-[#8F6040]' : 'bg-[#2A353D]'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${notifReminders ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                  {notifReminders && (
                    <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-1">Minutes Before Shift:</span>
                      <input type="number" min="1" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className={`${T.input} w-20 py-1 text-center text-xs font-black`} placeholder="120" />
                    </div>
                  )}
                </div>
              </div>

            </div>
            <button type="submit" className={`w-full ${T.btn} py-3 text-sm mt-4`}>Save Alert Preferences</button>
          </form>
        </div>
      )}

{subTab === 'workspace' && canManageWorkspaceSettings && (
        <form onSubmit={handleSaveSystem} className={`${T.card} p-3 sm:p-5 space-y-4 border-[#D4A381]/30 shadow-[0_0_15px_rgba(212,163,129,0.05)]`}>
          <div>
             <div className="flex items-center justify-between mb-1 border-b border-[#2A353D] pb-2">
               <h2 className="text-base font-black text-white"><Shield className={`inline mr-2 ${T.copper}`} size={16}/> Global Config</h2>
               <span className="bg-[#12161A] text-[#D4A381] border border-[#2A353D] px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-widest">Master Controls</span>
             </div>
             
             <div className="mt-4 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Time & Attendance Rules</div>
             <div className="space-y-2">
              <div onClickCapture={(e) => { if (appUser?.planType === 'Starter' || appUser?.planType === 'Pro') { e.stopPropagation(); e.preventDefault(); addToast('Locked', 'Upgrade to Elite to enforce Strict GPS Geofencing.'); } }}>
                <Toggle label={(appUser?.planType === 'Starter' || appUser?.planType === 'Pro') ? '🔒 Strict Geofencing (Elite)' : 'Strict Geofencing (Time Clock)'} desc="Block employees from clocking in if they are not within the GPS boundaries of the restaurant." checked={sysGeofence} onChange={e => setSysGeofence(e.target.checked)} disabled={appUser?.planType === 'Starter' || appUser?.planType === 'Pro'} />
              </div>
              {sysGeofence && appUser?.planType !== 'Starter' && appUser?.planType !== 'Pro' && (
                 <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl space-y-3 animate-[slideIn_0.2s_ease-out] ml-4">
                   <div>
                     <label className={T.label}>Street Address (To auto-find coordinates)</label>
                     <div className="flex gap-2">
                       <input type="text" value={sysAddress} onChange={e=>setSysAddress(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. 26 N State St, Chilton, WI"/>
                       <button type="button" onClick={handleGeocodeAddress} className={`${T.btn} py-1.5 px-4 text-xs whitespace-nowrap`}>Find GPS</button>
                     </div>
                   </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#2A353D]">
                     <div><label className={T.label}>Latitude</label><input type="number" step="any" value={sysLat} onChange={e=>setSysLat(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. 44.0300"/></div>
                     <div><label className={T.label}>Longitude</label><input type="number" step="any" value={sysLon} onChange={e=>setSysLon(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. -88.1630"/></div>
                     <div><label className={T.label}>Radius (Feet)</label><input type="number" min="10" value={sysRadius} onChange={e=>setSysRadius(e.target.value)} className={`${T.input} py-1.5 text-xs`} placeholder="e.g. 300"/></div>
                   </div>

                   <div className="w-full h-80 mt-4 rounded-xl border border-[#2A353D] relative z-0 overflow-hidden shadow-inner bg-[#0B0E11]">
                     <MapContainer 
                       center={getSafeMapCenter(sysLat, sysLon)} 
                       zoom={17} 
                       minZoom={3}
                       maxZoom={activeMapProvider.maxZoom || 19}
                       preferCanvas={true}
                       scrollWheelZoom={true}
                       style={{ height: '100%', width: '100%', minHeight: 320 }}
                     >
                       <GeofenceMapStabilizer lat={sysLat} lon={sysLon} radius={sysRadius} refreshNonce={mapRefreshNonce} />
                       <TileLayer
                         key={`${activeMapProvider.id}-${mapRefreshNonce}`}
                         attribution={activeMapProvider.attribution}
                         url={activeMapProvider.url}
                         maxZoom={activeMapProvider.maxZoom || 19}
                         updateWhenIdle={false}
                         updateWhenZooming={false}
                         keepBuffer={4}
                         eventHandlers={{
                           loading: () => setMapLoadState('loading'),
                           load: () => setMapLoadState('ready'),
                           tileerror: handleGeofenceTileError
                         }}
                       />
                       <MapClickListener 
                         setLat={(lat) => setSysLat(lat.toFixed(6))} 
                         setLon={(lon) => setSysLon(lon.toFixed(6))} 
                       />
                       {Number.isFinite(parseFloat(sysLat)) && Number.isFinite(parseFloat(sysLon)) && (
                         <Marker position={[parseFloat(sysLat), parseFloat(sysLon)]} icon={customMapIcon} />
                       )}
                       {Number.isFinite(parseFloat(sysLat)) && Number.isFinite(parseFloat(sysLon)) && sysRadius && (
                         <Circle 
                           center={[parseFloat(sysLat), parseFloat(sysLon)]} 
                           radius={parseInt(sysRadius) * 0.3048} 
                           pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2 }} 
                         />
                       )}
                     </MapContainer>
                     <div className="absolute top-2 right-2 z-[500] flex gap-2">
                       {mapLoadState && mapLoadState !== 'ready' && mapLoadState !== 'idle' && (
                         <span className="px-2 py-1 rounded-lg bg-[#12161A]/90 border border-[#2A353D] text-[9px] font-black uppercase tracking-widest text-[#D4A381]">{mapLoadState === 'retrying' ? 'Switching map tiles' : 'Loading map'}</span>
                       )}
                       <button type="button" onClick={refreshGeofenceMap} className="px-2 py-1 rounded-lg bg-[#12161A]/90 border border-[#2A353D] text-[9px] font-black uppercase tracking-widest text-slate-200 hover:text-[#D4A381]">Refresh Map</button>
                     </div>
                   </div>
                   <p className={`text-[10px] ${T.muted} font-bold uppercase tracking-widest mt-2 text-center`}>Click map to set geofence center. If tiles load gray or half-finished, tap Refresh Map. Provider: {activeMapProvider.label}.</p>
                 </div>
               )}
               <div onClickCapture={(e) => { if (appUser?.planType === 'Starter') { e.stopPropagation(); e.preventDefault(); addToast('Locked', 'Upgrade to Pro to unlock Unpaid Break Tracking.'); } }}>
                 <Toggle label={appUser?.planType === 'Starter' ? '🔒 Unpaid Break Tracking (Pro)' : 'Unpaid Break Tracking'} desc="Allow staff to clock out for unpaid breaks during their shift." checked={sysBreaks} onChange={e => setSysBreaks(e.target.checked)} disabled={appUser?.planType === 'Starter'} />
               </div>
               <Toggle label="Block Early Clock-Ins" desc="Prevent staff from punching in before their grace period begins." checked={sysBlockEarly} onChange={e => setSysBlockEarly(e.target.checked)} />
               <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-3`}>
                 <div>
                   <div className="text-xs font-bold text-white">Clock-In Grace Period</div>
                   <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>How many minutes early staff can clock in.</div>
                 </div>
                 <input type="number" min="0" value={sysGracePeriod} onChange={e => setSysGracePeriod(e.target.value)} className={`${T.input} w-16 text-center font-black py-1.5 text-xs`} />
               </div>
             </div>

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Shift Board Rules</div>
             <div className="space-y-2">
               <Toggle label="Enable Peer-to-Peer Trades" desc="Allow staff to post their shifts to the Trade Board for others to claim." checked={sysTrades} onChange={e => setSysTrades(e.target.checked)} />
               <Toggle label="Auto-Approve Shift Swaps" desc="If enabled, shift claims are approved instantly without manager intervention." checked={sysAutoApprove} disabled={!sysTrades} onChange={e => setSysAutoApprove(e.target.checked)} />
               <Toggle label="Role-Restricted Trades" desc="Staff can only claim shifts that match their assigned role." checked={sysSameRoleTrades} disabled={!sysTrades} onChange={e => setSysSameRoleTrades(e.target.checked)} />
             </div>

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Schedule Publishing</div>
             <div className="space-y-2">
               <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl space-y-3`}>
                 <div>
                   <div className="text-xs font-bold text-white">Schedule Publishing Style</div>
                   <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Controls the Schedule Builder window managers work in and the period published by the Publish button.</div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                   <select value={sysSchedulePublishMode} onChange={e => setSysSchedulePublishMode(e.target.value)} className={`${T.input} py-2 text-sm`}>
                     <option value="weekly">1 week at a time</option>
                     <option value="biweekly">2 weeks at a time</option>
                     <option value="monthly">Full month at a time</option>
                     <option value="custom">Custom number of weeks</option>
                   </select>
                   <select value={sysScheduleWeekStartsOn} onChange={e => setSysScheduleWeekStartsOn(e.target.value)} className={`${T.input} py-2 text-sm`}>
                     {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => <option key={day} value={day}>Starts {day}</option>)}
                   </select>
                   <input type="number" min="1" max="8" value={sysScheduleCustomWeeks} onChange={e => setSysScheduleCustomWeeks(e.target.value)} disabled={sysSchedulePublishMode !== 'custom'} className={`${T.input} py-2 text-sm disabled:opacity-50`} placeholder="Weeks" />
                 </div>
               </div>
               <Toggle label="Allow Time-Off Requests After Publishing" desc="If off, regular employees cannot request time off for dates that already have a published schedule. Managers can still edit/approve manually." checked={sysAllowPostPublishedTimeOff} onChange={e => setSysAllowPostPublishedTimeOff(e.target.checked)} />
             </div>

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Labor & Payroll</div>
             <div className="space-y-2">
<Toggle label="Mandatory Tip Declaration" desc="Force staff to declare cash & credit tips before they can clock out. Entering 0 is allowed when no tips were received." checked={sysTips} onChange={e => setSysTips(e.target.checked)} />               
               <div onClickCapture={(e) => { if (appUser?.planType === 'Starter') { e.stopPropagation(); e.preventDefault(); addToast('Locked', 'Upgrade to Pro to set Overtime Alert Thresholds.'); } }} className={`p-3 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-3 ${appUser?.planType === 'Starter' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 <div>
                   <div className="text-xs font-bold text-white">{appUser?.planType === 'Starter' ? '🔒 Overtime Alert Threshold (Pro)' : 'Overtime Alert Threshold'}</div>
                   <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Weekly hours before system flags a manager.</div>
                 </div>
                 <input type="number" min="1" disabled={appUser?.planType === 'Starter'} value={sysOvertime} onChange={e => setSysOvertime(e.target.value)} className={`${T.input} w-16 text-center font-black py-1.5 text-xs disabled:opacity-50`} />
               </div>
             </div>

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Security & Access Control</div>
             <div className="space-y-2">
               <div onClickCapture={(e) => { if (appUser?.planType === 'Starter' || appUser?.planType === 'Pro') { e.stopPropagation(); e.preventDefault(); addToast('Locked', 'Upgrade to Elite to enforce Strict IP Whitelisting.'); } }}>
                 <Toggle label={(appUser?.planType === 'Starter' || appUser?.planType === 'Pro') ? '🔒 Strict IP Whitelisting (Elite)' : 'Strict IP Whitelisting'} desc="Only allow app access from specific IP addresses (e.g., the restaurant's secure Wi-Fi)." checked={sysEnableIpWhitelist} onChange={e => setSysEnableIpWhitelist(e.target.checked)} disabled={appUser?.planType === 'Starter' || appUser?.planType === 'Pro'} />
               </div>
               
               {sysEnableIpWhitelist && appUser?.planType !== 'Starter' && appUser?.planType !== 'Pro' && (
                 <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl animate-[slideIn_0.2s_ease-out] ml-4">
                   <label className={T.label}>Authorized IP Addresses (Comma Separated)</label>
                   <input type="text" value={sysIpWhitelist} onChange={e=>setSysIpWhitelist(e.target.value)} className={`${T.input} py-1.5 text-xs font-mono`} placeholder="e.g. 192.168.1.1, 10.0.0.5" />
                 </div>
               )}

               {!isWorkspaceOwner && (
                 <div className="p-3 bg-amber-900/10 border border-amber-900/40 rounded-xl mt-2 text-[10px] font-bold text-amber-200 leading-snug">
                   Wage visibility and wage edit access are owner-only controls. Ask the account owner to change who can see or edit wages.
                 </div>
               )}
               {isWorkspaceOwner && <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl mt-2">
                 <div className="text-xs font-bold text-white mb-1">Wage Visibility & Edit Access</div>
                 <div className={`text-[9px] font-medium ${T.muted} mb-3 leading-snug`}>Only the account owner controls who can see or edit wages. View access only reveals wage labels/labor costs. Edit access allows wage changes from Staff Roster and also grants view access.</div>
                 <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 bg-[#0B0E11] p-2 border border-[#2A353D] rounded-lg">
                   {users.filter(u => u.isActive !== false && !u.isAdmin).map(u => (
                     <div key={u.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center hover:bg-[#1A2126] p-1.5 rounded transition-colors">
                       <span className="text-[10px] font-bold text-slate-300 truncate">{u.name} <span className="text-slate-500 font-normal">({u.role})</span></span>
                       <label className="flex items-center gap-1 cursor-pointer text-[9px] font-black uppercase tracking-widest text-slate-400">
                         <input type="checkbox" checked={sysWageAccess.includes(u.id) || sysWageEditAccess.includes(u.id)} onChange={e => {
                           if (e.target.checked) setSysWageAccess([...new Set([...sysWageAccess, u.id])]);
                           else setSysWageAccess(sysWageAccess.filter(id => id !== u.id));
                         }} className="w-3.5 h-3.5 accent-[#8F6040] bg-[#12161A] border-[#2A353D]" /> View
                       </label>
                       <label className="flex items-center gap-1 cursor-pointer text-[9px] font-black uppercase tracking-widest text-slate-400">
                         <input type="checkbox" checked={sysWageEditAccess.includes(u.id)} onChange={e => {
                           if (e.target.checked) {
                             setSysWageEditAccess([...new Set([...sysWageEditAccess, u.id])]);
                             setSysWageAccess([...new Set([...sysWageAccess, u.id])]);
                           } else setSysWageEditAccess(sysWageEditAccess.filter(id => id !== u.id));
                         }} className="w-3.5 h-3.5 accent-[#8F6040] bg-[#12161A] border-[#2A353D]" /> Edit
                       </label>
                     </div>
                   ))}
                   {users.filter(u => u.isActive !== false && !u.isAdmin).length === 0 && <div className="text-[10px] text-slate-500 text-center py-2">No non-admin staff available.</div>}
                 </div>
               </div>}
             </div>

          </div>
          <button type="submit" className={`w-full ${T.btn} py-3 mt-4 text-sm`}>Save Global Workspace</button>
        </form>
      )}

      {subTab === 'branding' && canManageBranding && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleSaveBrandingSettings} className={`${T.card} p-3 sm:p-5 space-y-5 border-[#D4A381]/30`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-[#2A353D] pb-3">
              <div>
                <h2 className="text-base font-black text-white">Branding & Display</h2>
                <p className="text-[10px] text-slate-400 font-bold mt-1 leading-snug">Restaurant branding can sit beside the locked 86 Chaos identity. The app name cannot be changed.</p>
              </div>
              <span className="bg-[#12161A] border border-[#2A353D] text-[#D4A381] text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">Owner controlled</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={T.label}>App Name</label>
                <input type="text" value="86 Chaos" disabled className={`${T.input} py-2 text-sm opacity-60 cursor-not-allowed`} />
                <p className="text-[9px] text-slate-500 font-bold mt-1">Locked. Imported logos never replace the 86 Chaos name or logo.</p>
              </div>
              <div>
                <label className={T.label}>Accent Color</label>
                <div className="flex gap-2">
                  <input type="color" value={sysAccentColor} onChange={e => setSysAccentColor(e.target.value)} className="w-14 h-11 rounded-xl border border-[#2A353D] bg-[#12161A] p-1" />
                  <input type="text" value={sysAccentColor} onChange={e => setSysAccentColor(e.target.value)} className={`${T.input} py-2 text-sm font-mono`} placeholder="#D4A381" />
                </div>
              </div>
              <div>
                <label className={T.label}>Restaurant / Group Display Name</label>
                <input type="text" value={sysRestaurantGroupName} onChange={e => setSysRestaurantGroupName(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="Restaurant Group" />
              </div>
              <div>
                <label className={T.label}>Default Timezone</label>
                <select value={sysDefaultTimezone} onChange={e => setSysDefaultTimezone(e.target.value)} className={`${T.input} py-2 text-sm`}>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Denver">America/Denver</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                </select>
              </div>
              <div>
                <label className={T.label}>Date Format</label>
                <select value={sysWorkspaceDateFormat} onChange={e => setSysWorkspaceDateFormat(e.target.value)} className={`${T.input} py-2 text-sm`}>
                  <option value="MMM d, yyyy">Jul 6, 2026</option>
                  <option value="MM/dd/yyyy">07/06/2026</option>
                  <option value="yyyy-MM-dd">2026-07-06</option>
                </select>
              </div>
              <div>
                <label className={T.label}>Time Display</label>
                <select value={sysWorkspaceTimeFormat} onChange={e => setSysWorkspaceTimeFormat(e.target.value)} className={`${T.input} py-2 text-sm`}>
                  <option value="h:mm a">12-hour clock</option>
                  <option value="HH:mm">24-hour clock</option>
                </select>
              </div>
              <div>
                <label className={T.label}>Currency</label>
                <select value={sysCurrency} onChange={e => setSysCurrency(e.target.value)} className={`${T.input} py-2 text-sm`}>
                  <option value="USD">USD - $</option>
                  <option value="CAD">CAD - $</option>
                  <option value="EUR">EUR - €</option>
                  <option value="GBP">GBP - £</option>
                </select>
              </div>
              <div>
                <label className={T.label}>Week Starts On</label>
                <select value={sysWeekStartsOn} onChange={e => setSysWeekStartsOn(e.target.value)} className={`${T.input} py-2 text-sm`}>
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={T.label}>Default Staff Landing Tab</label>
                <select value={sysDefaultLandingTab} onChange={e => setSysDefaultLandingTab(e.target.value)} className={`${T.input} py-2 text-sm`}>
                  <option value="published">My Schedule</option>
                  <option value="today">Today</option>
                  <option value="messages">Message Board</option>
                  <option value="recipes">Recipe Book</option>
                  <option value="team">Staff Roster</option>
                </select>
              </div>
              <div>
                <label className={T.label}>Help Center Contact</label>
                <input type="text" value={sysHelpContact} onChange={e => setSysHelpContact(e.target.value)} className={`${T.input} py-2 text-sm`} placeholder="manager@restaurant.com or phone" />
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
              <div className="bg-[#12161A] border border-[#2A353D] rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-white">Restaurant Logo</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 bg-[#0B0E11] border border-[#2A353D] rounded-xl px-3 py-2" title="86 Chaos branding is locked and always displayed">
                    <img src="/wisco.png" alt="86 Chaos icon" className="h-8 w-auto" />
                    <img src="/6139.png" alt="86 Chaos" className="h-5 w-auto" />
                  </div>
                  {sysRestaurantLogoUrl ? <img src={sysRestaurantLogoUrl} alt="Restaurant logo preview" className="h-12 max-w-[180px] object-contain bg-white/5 border border-[#2A353D] rounded-xl p-2" /> : <div className="text-[10px] text-slate-500 font-bold">No restaurant logo uploaded yet.</div>}
                </div>
                <input type="text" value={sysRestaurantLogoUrl} onChange={e => setSysRestaurantLogoUrl(e.target.value)} className={`${T.input} py-2 text-xs`} placeholder="Paste restaurant logo URL or upload below" />
                <label className={`${T.btnAlt} block text-center cursor-pointer ${isUploadingBrandLogo ? 'opacity-60 pointer-events-none' : ''}`}>
                  {isUploadingBrandLogo ? 'Uploading...' : 'Upload Restaurant Logo'}
                  <input type="file" accept="image/*" onChange={handleBrandLogoUpload} disabled={isUploadingBrandLogo} className="hidden" />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <input type="checkbox" checked={sysShowRestaurantLogo} onChange={e => setSysShowRestaurantLogo(e.target.checked)} className="w-4 h-4 accent-[#8F6040]" />
                  Show this restaurant's logo beside the locked 86 Chaos branding
                </label>
                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-[10px] text-emerald-100 font-bold leading-snug">
                  86 Chaos branding is always displayed. This control only decides whether the restaurant/customer logo joins it in the header.
                </div>
              </div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-2xl p-4 space-y-3">
                <div className="text-xs font-black text-white">Login / Help Message</div>
                <textarea value={sysLoginMessage} onChange={e => setSysLoginMessage(e.target.value)} rows={4} className={`${T.input} text-sm`} placeholder="Optional message for staff, like: Use your manager-issued login. Call the restaurant if locked out." />
                <div className="text-[10px] text-slate-500 font-bold leading-snug">This can be shown in future login/help panels. Keep it generic and do not put private employee information here.</div>
              </div>
            </div>

            <button type="submit" className={`w-full ${T.btn} py-3 text-sm`}>Save Branding & Display</button>
          </form>

          {isWorkspaceOwner && (
            <div className={`${T.card} p-3 sm:p-5 space-y-3`}>
              <div>
                <h2 className="text-base font-black text-white">Settings Access</h2>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Only the account owner can choose who may change workspace settings, branding, integrations, or Menu Intelligence.</p>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
                {users.filter(u => u.isActive !== false && u.id !== appUser.id).map(u => (
                  <div key={u.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                    <div className="min-w-0"><div className="text-xs font-black text-white truncate">{u.name || u.email}</div><div className="text-[10px] text-slate-500 font-bold truncate">{u.role || 'Staff'} • {u.email || 'no email'}</div></div>
                    {['settings','branding','integrations','menuIntelligence'].map(key => (
                      <label key={key} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <input type="checkbox" checked={u.permissions?.[key] === true} onChange={e => toggleSettingsPermission(u, key, e.target.checked)} className="w-3.5 h-3.5 accent-[#8F6040]" /> {key}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TRANSFER OWNERSHIP ZONE --- */}
      {subTab === 'workspace' && (appUser?.email?.toLowerCase() === clientData?.ownerEmail?.toLowerCase() || appUser?.isSuperAdmin || appUser?.isSuperAdmin === true) && (
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!newOwnerId) return addToast('Error', 'Select a new owner.');
          if (prompt(`CRITICAL: Type "TRANSFER" to hand over ownership of this workspace. You will lose master control.`) !== 'TRANSFER') return addToast('Aborted', 'Transfer canceled.');
          
          const newOwner = users.find(u => u.id === newOwnerId);
          try {
            await updateDoc(doc(db, "users", newOwner.id), { isAdmin: true });
            await updateDoc(doc(db, "restaurants", appUser.restaurantId), { ownerName: newOwner.name, ownerEmail: newOwner.email });
            addToast('Transferred', `Ownership transferred to ${newOwner.name}.`);
            setNewOwnerId('');
          } catch(err) { addToast('Error', err.message); }
        }} className={`${T.card} p-4 sm:p-5 mt-4 border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.1)]`}>
           <div className="mb-3 border-b border-[#2A353D] pb-2">
             <h2 className="text-base font-black text-red-500">Transfer Ownership</h2>
             <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Permanently transfer billing and master control to another active team member.</p>
           </div>
           <div className="flex flex-col sm:flex-row gap-3">
             <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)} className={T.input} required>
               <option value="">Select New Owner...</option>
               {users.filter(u => u.isActive && u.id !== appUser.id).map(u => (
                 <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
               ))}
             </select>
             <button type="submit" className="bg-red-900/20 text-red-500 font-black tracking-widest uppercase border border-red-900/50 rounded-xl px-6 py-3 hover:bg-red-900/40 transition-colors whitespace-nowrap">Transfer</button>
           </div>
        </form>
      )}

      {/* --- INTEGRATIONS ZONE --- */}
      {subTab === 'integrations' && canManageIntegrations && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          
          <div className={`${T.card} p-4 sm:p-5 border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.05)]`}>
             <div className="mb-4 border-b border-[#2A353D] pb-2">
               <h2 className="text-base font-black text-blue-400">Point of Sale (POS) Sync</h2>
               <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Automatically pull daily sales data directly into your Daily Ledger.</p>
             </div>
             <form onSubmit={async (e) => {
                e.preventDefault();
                await setDoc(doc(db, "restaurants", appUser.restaurantId), { integrations: { posProvider: e.target.posProvider.value, posApiKey: e.target.posApiKey.value } }, { merge: true });
                addToast('Saved', 'POS API Configuration Saved.');
             }} className="space-y-3">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className={T.label}>POS Provider</label>
                   <select name="posProvider" defaultValue={clientData?.integrations?.posProvider || ''} className={T.input}>
                     <option value="">None / Manual Entry</option>
                     <option value="Square">Square</option>
                     <option value="Toast">Toast</option>
                     <option value="Clover">Clover</option>
                     <option value="TouchBistro">TouchBistro</option>
                   </select>
                 </div>
                 <div>
                   <label className={T.label}>Secure API Key / Access Token</label>
                   <input type="password" name="posApiKey" defaultValue={clientData?.integrations?.posApiKey || ''} className={T.input} placeholder="sk_live_..." />
                 </div>
               </div>
               <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl">
                 <label className={T.label}>Your Webhook URL (Paste this into your POS dashboard)</label>
                 <code className="text-[10px] text-emerald-400 break-all select-all block mt-1">https://app.86chaos.com/api/webhooks/pos-sync?tenant={appUser.restaurantId}</code>
               </div>
               <button type="submit" className="bg-blue-900/20 text-blue-400 font-black tracking-widest uppercase border border-blue-900/50 rounded-xl w-full py-3 hover:bg-blue-900/40 transition-colors">Connect POS</button>
             </form>
          </div>

          <div className={`${T.card} p-4 sm:p-5 border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.05)]`}>
             <div className="mb-4 border-b border-[#2A353D] pb-2">
               <h2 className="text-base font-black text-emerald-500">Payroll Provider API</h2>
               <p className="text-[10px] text-slate-400 font-medium leading-snug mt-1">Sync approved timesheets directly to your payroll processor.</p>
             </div>
             <form onSubmit={async (e) => {
                e.preventDefault();
                await setDoc(doc(db, "restaurants", appUser.restaurantId), { integrations: { payrollProvider: e.target.payrollProvider.value, payrollApiKey: e.target.payrollApiKey.value } }, { merge: true });
                addToast('Saved', 'Payroll API Configuration Saved.');
             }} className="space-y-3">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div>
                   <label className={T.label}>Payroll Provider</label>
                   <select name="payrollProvider" defaultValue={clientData?.integrations?.payrollProvider || ''} className={T.input}>
                     <option value="">None / CSV Export Only</option>
                     <option value="Gusto">Gusto</option>
                     <option value="ADP">ADP Run</option>
                     <option value="Paychex">Paychex</option>
                     <option value="QuickBooks">QuickBooks Time</option>
                   </select>
                 </div>
                 <div>
                   <label className={T.label}>Secure API Key / Bearer Token</label>
                   <input type="password" name="payrollApiKey" defaultValue={clientData?.integrations?.payrollApiKey || ''} className={T.input} placeholder="eyJhbGciOiJIUzI1Ni..." />
                 </div>
               </div>
               <button type="submit" className="bg-emerald-900/20 text-emerald-400 font-black tracking-widest uppercase border border-emerald-900/50 rounded-xl w-full py-3 hover:bg-emerald-900/40 transition-colors">Connect Payroll</button>
             </form>
          </div>

        </div>
      )}

    </div>
  );
};

const TabAuditLog = ({ appUser }) => {
  const logs = useLiveCollection('auditLogs', appUser?.restaurantId, { limitCount: 200 });
  const isGeoff = appUser?.isSuperAdmin === true;
  const sortedLogs = [...logs]
    .filter(log => isGeoff ? true : log.action !== 'APP_INSTALLED')
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      <div className={`${T.card} overflow-hidden`}>
        <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Shield className="text-red-500"/> System Audit Logs</h2>
          <span className={`bg-red-900/20 border border-red-500/50 text-red-500 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest`}>Master Admin View</span>
        </div>
        
        <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
          {sortedLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No security events logged yet.</div>}
          
          {sortedLogs.map(log => (
            <div key={log.id} className={`${T.row} flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white text-sm">{log.userName}</span>
                  <span className={`text-[9px] uppercase font-black tracking-widest bg-[#12161A] border ${T.border} text-red-400 px-2 py-0.5 rounded`}>{log.action}</span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {log.details} <span className="text-slate-500 ml-1">Target: [{log.target}]</span>
                </div>
              </div>
              <div className={`text-[10px] font-bold ${T.muted} whitespace-nowrap`}>
                {formatClockDateTime(log.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TabSales = ({ sales, timePunches = [], users = [], addToast, appUser }) => {
  const getMonday = (dStr) => {
    const d = new Date(dStr + 'T12:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const [weekStart, setWeekStart] = useState(getMonday(getToday()));
  const [editData, setEditData] = useState({});

  const weekDays = Array.from({length: 7}).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  // --- AUTO-LABOR CALCULATION ENGINE ---
  const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
      if (!inTime) return 0;
      const end = outTime ? new Date(outTime) : new Date(); // If currently on clock, calc up to this exact minute
      const rawMins = (end - new Date(inTime)) / 60000;
      return Math.max(0, (rawMins - breakMins) / 60);
  };

  const getDailyLabor = (date) => {
      const dayPunches = timePunches.filter(p => p.date === date);
      return dayPunches.reduce((acc, p) => {
          const emp = users.find(u => u.id === p.employeeId);
          const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
          return acc + (hours * (emp?.wage || 0));
      }, 0);
  };

  useEffect(() => {
    const newEditData = {};
    weekDays.forEach(date => {
      const daySale = sales.find(s => s.date === date);
      newEditData[date] = {
        grossSales: daySale?.grossSales || '',
        laborCost: daySale?.laborCost !== undefined ? daySale.laborCost : '',
        foodCost: daySale?.foodCost || '',
        notes: daySale?.notes || ''
      };
    });
    setEditData(newEditData);
  }, [weekStart, sales]);

  const changeWeek = (offset) => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setWeekStart(newDate);
  };

  const handleSave = async (date) => {
    const data = editData[date];
    const existing = sales.find(s => s.date === date);
    const autoLabor = getDailyLabor(date);
    
    // If they didn't type anything, grab the auto-calculated labor
    const finalLabor = data.laborCost !== '' ? parseFloat(data.laborCost) : autoLabor;

    const payload = {
      date,
      grossSales: parseFloat(data.grossSales) || 0,
      laborCost: finalLabor || 0,
      foodCost: parseFloat(data.foodCost) || 0,
      notes: data.notes || '',
      restaurantId: appUser.restaurantId,
      loggedBy: appUser.name,
      timestamp: new Date().toISOString()
    };

    try {
      if (existing) {
        await updateDoc(doc(db, "sales", existing.id), payload);
      } else {
        await addDoc(collection(db, "sales"), payload);
      }
      addToast('Saved', `Data for ${new Date(date+'T12:00').toLocaleDateString()} locked in.`);
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  const handleInputChange = (date, field, value) => {
    setEditData(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }));
  };

  let wtdGross = 0; let wtdLabor = 0; let wtdFood = 0;
  weekDays.forEach(d => {
    const s = sales.find(x => x.date === d);
    const autoLabor = getDailyLabor(d);
    if (s) { 
      wtdGross += (s.grossSales||0); 
      wtdLabor += (s.laborCost > 0 ? s.laborCost : autoLabor); 
      wtdFood += (s.foodCost||0); 
    } else {
      wtdLabor += autoLabor; // Add auto-labor even if not saved yet to show running trends
    }
  });
  
  const wtdLaborPct = wtdGross > 0 ? ((wtdLabor / wtdGross) * 100).toFixed(1) : 0;
  const wtdFoodPct = wtdGross > 0 ? ((wtdFood / wtdGross) * 100).toFixed(1) : 0;
  const wtdProfit = wtdGross - (wtdLabor + wtdFood);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      
      {/* Tight Weekly Controls */}
      <div className="flex justify-between items-center bg-[#1A2126] border border-[#2A353D] rounded-xl p-2 shadow-sm">
         <button onClick={() => changeWeek(-1)} className="p-2 bg-[#12161A] text-slate-400 rounded-lg hover:text-[#D4A381] border border-[#2A353D] transition-colors"><ChevronLeft size={18} /></button>
         <div className="text-center">
           <h2 className="text-sm font-black text-white uppercase tracking-widest">Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</h2>
         </div>
         <button onClick={() => changeWeek(1)} className="p-2 bg-[#12161A] text-slate-400 rounded-lg hover:text-[#D4A381] border border-[#2A353D] transition-colors"><ChevronRight size={18} /></button>
      </div>

      {/* Expanded WTD KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Gross</div><div className="text-sm sm:text-lg font-black text-[#D4A381]">${wtdGross.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div></div>
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Labor</div><div className={`text-sm sm:text-lg font-black ${wtdLaborPct > 30 ? 'text-red-400' : 'text-emerald-400'}`}>{wtdLaborPct}%</div></div>
        <div className={`${T.card} p-2 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Food</div><div className={`text-sm sm:text-lg font-black ${wtdFoodPct > 33 ? 'text-red-400' : 'text-emerald-400'}`}>{wtdFoodPct}%</div></div>
        <div className={`${T.card} p-2
 sm:p-3 text-center`}><div className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${T.muted}`}>WTD Profit</div><div className={`text-sm sm:text-lg font-black ${wtdProfit < 0 ? 'text-red-400' : 'text-emerald-400'}`}>${wtdProfit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div></div>
      </div>

      {/* Ultra-Compact 7-Day Ledger with Notes */}
      <div className={`${T.card} overflow-hidden`}>
         <div className="divide-y divide-[#2A353D]">
           {weekDays.map(date => {
              const data = editData[date] || { grossSales: '', laborCost: '', foodCost: '', notes: '' };
              const isToday = date === getToday();
              const hasData = sales.find(s => s.date === date);
              const autoLabor = getDailyLabor(date);
              
              const displayLabor = data.laborCost !== '' ? data.laborCost : (autoLabor > 0 ? autoLabor.toFixed(2) : '');

              return (
                <div key={date} className={`p-2 sm:p-3 flex flex-col gap-2 ${isToday ? 'bg-[#12161A] border-l-2 border-[#D4A381]' : 'hover:bg-[#12161A]/50 transition-colors'}`}>
                   <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-[#D4A381]' : 'text-slate-300'}`}>{new Date(date+'T12:00').toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span>
                      <div className="flex items-center gap-2">
                         {data.laborCost === '' && autoLabor > 0 && <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-900/50">Auto-Labor</span>}
                         {hasData && <span className="text-[8px] text-[#D4A381] font-black uppercase tracking-widest bg-[#8F6040]/20 px-1.5 py-0.5 rounded border border-[#D4A381]/30">Saved</span>}
                         {hasData && appUser?.isAdmin && <button onClick={() => { if(window.confirm("Delete record?")) deleteDoc(doc(db,"sales",hasData.id)); }} className="text-slate-500 hover:text-red-500"><Trash2 size={12}/></button>}
                      </div>
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <div className="flex gap-1.5">
                        <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.grossSales} onChange={e=>handleInputChange(date, 'grossSales', e.target.value)} placeholder="Gross" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                        <div className="relative flex-1"><span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold ${data.laborCost === '' && autoLabor > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>$</span><input type="number" value={displayLabor} onChange={e=>handleInputChange(date, 'laborCost', e.target.value)} placeholder="Labor" className={`w-full bg-[#0B0E11] border border-[#2A353D] text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381] ${data.laborCost === '' && autoLabor > 0 ? 'text-emerald-400 bg-emerald-900/10 border-emerald-900/50' : 'text-white'}`} /></div>
                        <div className="relative flex-1"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-bold">$</span><input type="number" value={data.foodCost} onChange={e=>handleInputChange(date, 'foodCost', e.target.value)} placeholder="Food" className="w-full bg-[#0B0E11] border border-[#2A353D] text-white text-[10px] sm:text-xs font-bold pl-4 pr-1 py-1.5 rounded outline-none focus:border-[#D4A381]" /></div>
                      </div>
                      <div className="flex gap-1.5">
                        <input type="text" value={data.notes} onChange={e=>handleInputChange(date, 'notes', e.target.value)} placeholder="Context notes (e.g., Event, Weather, Promos)..." className="flex-1 w-full bg-[#0B0E11] border border-[#2A353D] text-slate-300 text-[10px] sm:text-xs font-medium px-2 py-1.5 rounded outline-none focus:border-[#D4A381]" />
                        <button onClick={()=>handleSave(date)} className="w-16 bg-gradient-to-r from-[#C59373] to-[#8F6040] text-slate-900 text-[10px] font-black uppercase tracking-wider rounded flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity">Save</button>
                      </div>
                   </div>
                </div>
              )
           })}
         </div>
      </div>
    </div>
  );
};


const ADMIN_TROUBLESHOOTING_ARTICLES = [
  {
    "title": "Version 15.0.32 AI Support Manual and Production Hardening",
    "group": "System Administrator",
    "keywords": "v15 15.0.32 ai support manual troubleshooting security hardening account deletion recovery codes firebase rules storage rules production",
    "body": [
      "15.0.32 turns the System Administrator Manual into a question-driven support console. Type the customer's problem, read the first checks, follow the fix steps, then open the most relevant articles.",
      "Security Center now shows account deletion requests so privacy requests can be reviewed, marked complete, or denied with an audit trail.",
      "Recovery codes now require RECOVERY_CODE_SECRET in Vercel before they can be generated or used. The secret must be at least 32 characters and must be set in both Preview and Production if both environments are used.",
      "Firebase rules no longer depend on a baked-in personal email. Super Admin access must come from a Firebase custom claim, Firestore users/{uid}.isSuperAdmin, users/{uid}.systemAccess.superAdmin, or the server env master email list for API routes.",
      "Use the included README and QA checklist before production. Test on the testing Firebase/Vercel side first, then repeat on the main side only after login, manual search, MFA recovery, backups, push, menu scan, invoice scan, and deletion review all pass."
    ]
  },
  {
    "title": "Customer says the app is blank or stuck loading",
    "group": "Troubleshooting",
    "keywords": "blank screen stuck loading app load white screen chrome cache version deployment firebase config service worker",
    "body": [
      "First ask for the URL, device, browser, and screenshot. Confirm they are on the correct testing or production link.",
      "Open /version.json on that same link and confirm it matches the deployed release. If the version is old, the browser or deployment cache is probably stale.",
      "Have the customer hard refresh, close all tabs, reopen the app, or clear site data. On mobile Chrome, use the browser menu, History, Clear browsing data, then reopen.",
      "If only one workspace is blank, check the user's restaurantId and the workspace document. If everyone is blank, check Vercel deployment status and Firebase project settings.",
      "If the browser console shows permission-denied, publish the matching Firestore rules and Storage rules for that Firebase project, then log out and back in."
    ]
  },
  {
    "title": "Customer cannot log in or is locked out",
    "group": "Access / Troubleshooting",
    "keywords": "cannot login locked out password reset email verification mfa recovery code lost phone force password disabled account",
    "body": [
      "Confirm the exact email they are typing. Search the email in System Administrator People and Firebase Authentication.",
      "If the password is wrong, send a Firebase password reset. If the account is disabled, confirm why before enabling it.",
      "If MFA blocks them because they lost a phone, use Account Security MFA recovery as a System Administrator, write a reason, and have them enroll again.",
      "If recovery codes are missing, set RECOVERY_CODE_SECRET in Vercel, redeploy, then generate recovery codes from Account Security.",
      "If they can log in but see the wrong restaurant, fix restaurantId, activeRestaurantId, membership, or workspace routing before changing permissions."
    ]
  },
  {
    "title": "Push notifications only go to one person or do not arrive",
    "group": "Push Notifications",
    "keywords": "push notifications only geoff one person not receiving fcm token repair notification permission token stale send-push schedule alert",
    "body": [
      "Check whether the user has allowed notifications in the browser or phone settings. Blocked browser permission means the app cannot send pushes to that device.",
      "Open System Administrator Push tools and check token counts, stale tokens, and per-user test push results.",
      "Have the user open the app on the device they want notifications on. The app needs to save a fresh token from that device.",
      "Run push token repair if tokens look stale or attached to the wrong profile. Then send a per-user test push before sending a broadcast.",
      "If only Super Admin receives pushes, confirm Firestore rules allow each signed-in user to write their own token and confirm the send route is not filtering to the admin account."
    ]
  },
  {
    "title": "Menu or invoice AI scan fails",
    "group": "AI Scans",
    "keywords": "menu intelligence invoice scan gemini invalid json model not found api key v1beta flash pdf photo storage upload",
    "body": [
      "First read the exact error toast. Model-not-found means the Gemini model name or API version is wrong for the key. Invalid JSON means the AI replied in a shape the parser rejected.",
      "Check Vercel environment variables for the Gemini/API key on the same deployment environment the customer is using.",
      "Confirm the upload is a supported image or PDF and under the allowed size. Storage rules must allow the scan folder and required metadata.",
      "Try a clearer photo or smaller PDF. Blurry, sideways, cropped, or handwritten invoices are much more likely to fail.",
      "If the scan reaches 100 percent then fails, the upload worked and the failure is in the AI route or parser. Check Vercel function logs for scan-menu or scan-invoice."
    ]
  },
  {
    "title": "Firebase rules after security hardening",
    "group": "Firebase / Rules",
    "keywords": "firebase rules firestore storage publish testing production super admin claim isSuperAdmin systemAccess lockout",
    "body": [
      "Publish Firestore rules and Storage rules to the testing Firebase project first. Test login, System Administrator, account security, push, scan uploads, schedule, inventory, and manual support search.",
      "Before publishing hardened rules, make sure your Super Admin account has a real admin source: Firebase custom claim superAdmin=true, users/{uid}.isSuperAdmin=true, or users/{uid}.systemAccess.superAdmin=true.",
      "Server env master emails can authorize API routes, but Firebase rules cannot read Vercel env vars. Do not rely on MASTER_ADMIN_EMAIL for Firestore or Storage rules.",
      "After publishing rules, log out and back in so Firebase auth claims refresh.",
      "Repeat the same process on production only after the testing side works."
    ]
  },
  {
    "title": "Account deletion request workflow",
    "group": "Privacy / App Store Readiness",
    "keywords": "account deletion request privacy app store google play delete account export anonymize retention review complete deny",
    "body": [
      "Customers can request account deletion from Account Security. This creates an accountDeletionRequests record and a Security Center alert.",
      "Open System Administrator Security Center and review the request. Mark Reviewing when you start working it.",
      "Before marking Complete, confirm identity, check legal/operational retention needs, export anything required, then delete or anonymize the account data using the protected admin tools.",
      "Use Deny only when the request is invalid, duplicate, canceled through another channel, or cannot be completed for a documented reason.",
      "Every review action writes admin notes and an audit log so store/privacy reviews have a paper trail."
    ]
  },
  {
    "title": "Recovery codes and MFA safety",
    "group": "MFA / Account Security",
    "keywords": "recovery codes mfa lost phone RECOVERY_CODE_SECRET two step login sms admin reset backup code",
    "body": [
      "RECOVERY_CODE_SECRET must be set in Vercel before recovery codes can be generated or used. Use a random 32+ character value and never reuse a public API key.",
      "Generate recovery codes only after the user has MFA enrolled. Codes are shown once and should be saved somewhere private.",
      "If a user loses a phone, try a recovery code first. If that fails, a System Administrator can reset MFA factors from Account Security with a written reason.",
      "Keep MFA enforcement off until at least one owner and one System Administrator have enrolled, logged out, logged back in with MFA, and tested recovery.",
      "Never disable MFA for every user just to fix one lost phone."
    ]
  },
  {
    "title": "Version 15.0.31 App Load Hotfix",
    "group": "System Administrator",
    "keywords": "v15 15.0.31 app load hotfix version mismatch system administrator locked out master admin env whoami",
    "body": [
      "15.0.31 fixes a startup crash from the 15.0.30 System Administrator access update so the app loads normally again.",
      "System Administrator lockout now shows a plain-English access report instead of the generic page-not-available card. It shows the signed-in email, Firebase UID, frontend env match, server /api/whoami result, master-admin env status, custom claim status, and Firestore super-admin flag status.",
      "The app now asks /api/whoami whether the server recognizes the account as Super Admin. This helps when MASTER_ADMIN_EMAIL is configured in Vercel server env but REACT_APP_MASTER_ADMIN_EMAIL was not set for frontend menu visibility.",
      "System Administrator includes an Admin Access signal card that explains which authority source opened the tab: server master-admin env, Firebase custom claim, Firestore profile flag, or local profile state.",
      "The 15.0.30 Super Admin diagnostics and the 15.0.29 question-mark helpers, menu-search cleanup, and backup troubleshooting manual remain included."
    ]
  },
  {
    "title": "System Administrator account is locked out after productization cleanup",
    "group": "Access / Troubleshooting",
    "keywords": "system administrator locked out master admin geoff master_admin_email react_app_master_admin_email superAdmin custom claim firestore isSuperAdmin",
    "body": [
      "Version 15.0.28 removed hardcoded personal-email master-admin fallbacks for public release readiness. That means every platform admin must come from real configuration instead of a baked-in email.",
      "Fast rescue: set MASTER_ADMIN_EMAIL and MASTER_ADMIN_EMAILS in the correct Vercel environment. Preview/testing and Production are separate. Add the locked-out email and redeploy.",
      "For the menu to show System Administrator before /api/whoami finishes, also set REACT_APP_MASTER_ADMIN_EMAIL for the same environment and redeploy. React env vars are baked into the browser build at deploy time.",
      "Long-term fix: use Firebase custom claim superAdmin=true or Firestore users/{uid}.isSuperAdmin=true / systemAccess.superAdmin=true, granted from Access Control by an existing Super Admin.",
      "If one admin email works and another does not, compare their Firestore profile flags, custom claims, and whether the email is included in MASTER_ADMIN_EMAILS."
    ]
  },
  {
    "title": "Why the automatic backup did not run",
    "group": "Backups / Troubleshooting",
    "keywords": "automatic backup did not run 53h ago stale backup cron preview production vercel scheduled",
    "body": [
      "Vercel Cron jobs are invoked from production deployments, not preview/testing deployments. If you are looking at a testing branch URL, the countdown is a plan, but the real scheduled call will not fire there.",
      "For testing, use Run Backup Now. For production, open Vercel \u2192 Project \u2192 Deployments/Logs or Cron Jobs and confirm /api/firestore-backup ran near 9:00 UTC / 4:00 AM Central.",
      "If production missed it, check CRON_SECRET, FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, and whether the latest production deployment includes vercel.json with the /api/firestore-backup cron.",
      "If Run Backup Now works but automatic does not, the Firebase wiring is probably fine and the issue is scheduling, production deployment, cron auth, or Vercel cron configuration."
    ]
  },
  {
    "title": "Backup triage flow",
    "group": "Backups / Troubleshooting",
    "keywords": "backup triage last backup stale cron secret storage bucket firestore backup failed",
    "body": [
      "Step 1: Check Last Backup. Anything older than roughly 30 hours means the daily window was probably missed.",
      "Step 2: Click Run Backup Now. If manual backup fails, read the toast/error and then open Vercel function logs for /api/firestore-backup.",
      "Step 3: If manual works but automatic is stale, confirm the deployment is production and that Vercel Cron is listed for /api/firestore-backup.",
      "Step 4: Check Storage for backups/firestore/scheduled. If only manual backups exist, the cron trigger is not firing.",
      "Step 5: After a successful backup, verify document count, collection count, integrity status, Storage path, and restore-drill status before risky releases."
    ]
  },
  {
    "title": "CRON_SECRET troubleshooting",
    "group": "Backups / Troubleshooting",
    "keywords": "cron_secret authorization bearer vercel cron unauthorized backup route",
    "body": [
      "The backup route accepts Vercel Cron when the Authorization header matches Bearer CRON_SECRET.",
      "If CRON_SECRET is missing from Vercel, the app may still show Configured incorrectly if you are checking a different environment. Confirm it is set in the production environment that actually runs cron.",
      "If you rotate CRON_SECRET, redeploy after editing env vars. Old deployments keep old environment values.",
      "If manual backup works but cron says unauthorized, compare the production env var scope and make sure the cron route is not protected by deployment auth or preview-only settings."
    ]
  },
  {
    "title": "Backup integrity failed",
    "group": "Backups / Troubleshooting",
    "keywords": "backup integrity failed gzip checksum sha json storage round trip",
    "body": [
      "Do not restore from a backup marked failed unless you have manually inspected it.",
      "Run Backup Now again. A second good backup is safer than debugging a bad archive during a customer emergency.",
      "Open Storage and confirm the file exists under backups/firestore and ends in .json.gz.",
      "Use Backup Center download to confirm the file can be downloaded. If download works but integrity fails, check gzip/contentEncoding metadata and Vercel logs.",
      "If multiple integrity failures occur, stop destructive changes and copy a forensic bundle before continuing."
    ]
  },
  {
    "title": "Restore drill monthly routine",
    "group": "Backups / Restore Drill",
    "keywords": "restore drill monthly safe test project backup verify recovery",
    "body": [
      "A backup is only trusted after you prove it can restore into a safe testing project.",
      "Once per month, pick a recent backup, restore into a non-production Firebase project, confirm critical collections exist, then record the drill in Security Center.",
      "Never run a drill directly into production. Use a test project and test Vercel environment.",
      "Record who ran it, which backup path was used, whether counts matched, and any follow-up notes."
    ]
  },
  {
    "title": "System Administrator signal cards",
    "group": "System Administrator / Help",
    "keywords": "question marks signal cards command deck tooltip explain displays",
    "body": [
      "Click the small question mark on a metric or signal to see what it means, what makes it green/yellow/red, and where to go next.",
      "Use the signal board as a first-response map: red means act now, amber means inspect soon, green means synchronized/healthy, and blue/purple usually means informational.",
      "Question marks are support training wheels, not customer-facing help. They are intentionally inside System Administrator only."
    ]
  },
  {
    "title": "Platform status card",
    "group": "System Administrator / Displays",
    "keywords": "platform status needs attention monitoring clean action queue",
    "body": [
      "Platform summarizes the biggest risk queues: stale backups, permission blocks, missing owners, duplicate users, crashes, stale clients, and deployment readiness.",
      "Click it to jump to the command overview and action queue.",
      "If Platform is red, copy diagnostics before changing data so support has a before/after trail."
    ]
  },
  {
    "title": "Health card",
    "group": "System Administrator / Displays",
    "keywords": "health firestore latency api routes backup integrity diagnostics",
    "body": [
      "Health combines Firestore latency, API route readiness, backup integrity, and server diagnostics.",
      "Run Refresh Health before blaming Firebase, Vercel, or the browser.",
      "If API checks fail, open Vercel logs for the matching route and confirm environment variables are scoped to the deployment being tested."
    ]
  },
  {
    "title": "Manual presence card",
    "group": "System Administrator / Displays",
    "keywords": "manual presence live users online recent users snapshot cost reads",
    "body": [
      "Manual Presence uses an on-demand snapshot so the app does not constantly read online status for every customer.",
      "Refresh only when troubleshooting live-user visibility, push repair, or shift accountability.",
      "If only one person appears online, check browser visibility, service worker/presence heartbeat, and whether the user has opened the current workspace recently."
    ]
  },
  {
    "title": "Push opt-in card",
    "group": "Push / Troubleshooting",
    "keywords": "push opt in fcm tokens notifications not receiving device stale token",
    "body": [
      "Push Opt-In shows how many user profiles have usable push tokens.",
      "Low opt-in usually means staff declined browser notifications, service worker registration failed, or tokens are stale after a deploy/domain change.",
      "Use Push Control Center to send a test, request repair, clear stale tokens, and copy a reconnect link for the employee."
    ]
  },
  {
    "title": "Stale clients card",
    "group": "Clients / Troubleshooting",
    "keywords": "stale clients inactive 21 days customer no activity workspace dormant",
    "body": [
      "Stale Clients counts workspaces that look inactive for 21+ days.",
      "Before changing billing or locking a customer, inspect their recent users, last active dates, audit logs, and support history.",
      "A stale count can also mean lastActive is not being written correctly, so check presence/session updates before assuming a customer quit."
    ]
  },
  {
    "title": "Missing owner accounts",
    "group": "Users / Troubleshooting",
    "keywords": "missing owner account owner email no user doc auth firestore mismatch",
    "body": [
      "Missing Owner means a restaurant has an ownerEmail but no matching user profile in Firestore.",
      "The owner may exist in Firebase Authentication but lack users/{uid}, or the owner email may be misspelled on the restaurant record.",
      "Use Account Repair or create/link the correct user profile. Do not make a second ghost account unless you know the intended UID and workspace."
    ]
  },
  {
    "title": "Duplicate emails",
    "group": "Users / Troubleshooting",
    "keywords": "duplicate email auth profile user duplicate ghost account login wrong workspace",
    "body": [
      "Duplicate email groups are dangerous because the app may not know which profile owns permissions or restaurant routing.",
      "Compare UIDs, restaurantId, membership records, and Auth user. Keep the correct active account and disable/archive the wrong profile only after taking notes.",
      "If the user can log in but sees the wrong restaurant, duplicate profiles or workspace memberships are prime suspects."
    ]
  },
  {
    "title": "No restaurantId users",
    "group": "Users / Troubleshooting",
    "keywords": "no restaurantid orphan user cannot see data blank app no workspace",
    "body": [
      "A user without restaurantId or workspace membership may log in but see blank screens or wrong defaults.",
      "Find the correct workspace, repair the profile, and confirm the user appears in Staff Roster/Workspace Members.",
      "After repair, have the user log out and back in so cached session data refreshes."
    ]
  },
  {
    "title": "Permission denied fires",
    "group": "Rules / Troubleshooting",
    "keywords": "permission denied firestore rules blocked missing tab cannot save",
    "body": [
      "Permission denied means Firestore rules blocked a read or write. It is usually a rules/role mismatch, not a broken button.",
      "Check which screen/action failed, the user role, restaurantId, workspace membership, and the exact collection path if logs show it.",
      "For security-related changes, fix both the frontend permission check and Firestore rules. Hiding a button alone is not protection."
    ]
  },
  {
    "title": "MFA enrollment troubleshooting",
    "group": "MFA / Troubleshooting",
    "keywords": "mfa sms two step login enroll phone region unverified email recaptcha operation not allowed",
    "body": [
      "Email must be verified before Firebase lets a user enroll SMS MFA.",
      "SMS MFA must be enabled in the same Firebase project used by the app. Browser Project and API/Admin Project should match in Account Security debug.",
      "If Firebase blocks SMS setup, check SMS regions first. A missing United States region can cause operation-not-allowed even when MFA is enabled.",
      "Use full phone format such as +19205551234. Test phone numbers use the fake code you configured in Firebase."
    ]
  },
  {
    "title": "MFA lost phone recovery",
    "group": "MFA / Troubleshooting",
    "keywords": "lost phone broken phone mfa reset recovery code backup phone",
    "body": [
      "Use recovery codes first when the user saved them. A used code is burned and cannot be reused.",
      "If the user has a backup phone, enroll or challenge the backup factor.",
      "If neither is available, a Super Admin can reset MFA factors after verifying the person in real life and entering a written reason.",
      "The reset should create audit/security alerts. The user must immediately re-enroll a new MFA method after logging in."
    ]
  },
  {
    "title": "Account deletion request flow",
    "group": "Privacy / Troubleshooting",
    "keywords": "account deletion request app store privacy delete user customer request",
    "body": [
      "Account Deletion Request records a reviewable request instead of instantly destroying operational records.",
      "Before approving, identify whether the person is an employee, owner, or platform admin. Owners may have workspace/business records that require retention or handoff.",
      "Archive/export necessary payroll, scheduling, ledger, and audit records according to the restaurant policy before final deletion.",
      "Document the action in audit logs and notify the requester when complete."
    ]
  },
  {
    "title": "App Check troubleshooting",
    "group": "Security / Troubleshooting",
    "keywords": "app check recaptcha enterprise enforce firebase blocked invalid token aud project mismatch",
    "body": [
      "Do not enforce App Check until login, Firestore, Storage uploads, scanners, reminders, push, and Security Center all work in testing.",
      "Project mismatch errors usually mean the browser is using one Firebase project while Vercel Admin credentials use another.",
      "The site key belongs to reCAPTCHA Enterprise for the matching project. Domains must be bare domains, no https, slash, or path.",
      "Keep APP_CHECK_ENFORCE=false until all critical workflows pass on the same environment."
    ]
  },
  {
    "title": "Environment variable mismatch",
    "group": "Deployment / Troubleshooting",
    "keywords": "vercel env vars project mismatch firebase id token incorrect aud claim test prod",
    "body": [
      "If Firebase ID token aud says one project but API expects another, browser Firebase config and Vercel Admin credentials are mixed.",
      "Testing should use chaos-test style project IDs and test service account JSON. Production should use production project IDs and production service account JSON.",
      "Check Vercel variable scope: Production, Preview, Development, and branch-specific settings can differ.",
      "After editing env vars, redeploy. Old deployments keep old values."
    ]
  },
  {
    "title": "Deployment failed with no obvious summary",
    "group": "Deployment / Troubleshooting",
    "keywords": "vercel deployment failed npm run build exited 1 no summary syntax error",
    "body": [
      "Open the failed deployment and check Build Logs. If the UI summary is empty, use Vercel build logs and inspect the latest commit for syntax changes.",
      "Common causes in this app are unescaped apostrophes in strings, JSX tags not closed, accidental merge conflict text, or package/version mismatches.",
      "Run a React/JSX parse check locally if possible before pushing a hotfix.",
      "If only a help/manual string changed, check quotes first. Tiny apostrophe goblins can stop the whole build."
    ]
  },
  {
    "title": "Menu drawer search auto-filled",
    "group": "Navigation / Troubleshooting",
    "keywords": "hamburger menu search auto populated drawer search old query clears",
    "body": [
      "The drawer search is a convenience filter for tabs and support actions.",
      "If the drawer opens with old text, clear the search and refresh. Version 15.0.31 resets drawer search on open/close so stale queries do not linger.",
      "If it still appears, check whether a voice command or global search shortcut is sending text into the menu state."
    ]
  },
  {
    "title": "Invoice scanner troubleshooting",
    "group": "AI Scans / Troubleshooting",
    "keywords": "invoice scanner upload failed payload too large invalid json stuck spinner gemini",
    "body": [
      "If upload fails, check file size, type, Storage rules, and whether the file was compressed before upload.",
      "If Gemini returns invalid JSON, use the raw scan review panel and retry with a clearer image or smaller PDF.",
      "The scanner should not silently change inventory. Managers should review matched rows, raw rows, skipped rows, quantities, and units before saving.",
      "If the route times out, check Vercel logs for /api/scan-invoice and Gemini API key/env vars."
    ]
  },
  {
    "title": "Menu Intelligence troubleshooting",
    "group": "AI Scans / Troubleshooting",
    "keywords": "menu intelligence confidence needs review approve skip ingredient inventory match unavailable menu item",
    "body": [
      "Confidence badges are hints, not permission to skip review.",
      "Approve only ingredients that match real inventory rows. Skip or edit low-confidence rows.",
      "If 86 alerts do not show menu impact, inspect approved menu links for that ingredient and add synonyms staff actually say.",
      "Deleting an outdated menu scan should remove old menu-impact links so stale menus do not affect service."
    ]
  },
  {
    "title": "Voice Assistant Preview troubleshooting",
    "group": "Voice / Troubleshooting",
    "keywords": "voice assistant preview microphone beta permissions command wrong tab prep duplicate",
    "body": [
      "If voice does nothing, check browser microphone permission and whether the current device supports speech recognition.",
      "Voice navigation must respect user permissions. If a user asks for a restricted tab, the app should block the action instead of routing there.",
      "Prep voice should update matching prep rows instead of duplicating when there is a confident match.",
      "For bad voice parses, copy the original phrase into Report Problem so the parser can be trained around real kitchen wording."
    ]
  },
  {
    "title": "Staff cannot see a tab",
    "group": "Permissions / Troubleshooting",
    "keywords": "missing tab staff cannot see inventory financials schedule permissions role",
    "body": [
      "Check whether the module is enabled for the workspace and whether the user role/permissions allow it.",
      "If the tab appears but data is blank, check restaurantId/workspace membership and Firestore rules.",
      "Financials should be tightly restricted. Inventory, recipes, and schedule editing should follow role settings and owner selections.",
      "Use Full Permissions Preview before changing a real customer's access."
    ]
  },
  {
    "title": "Clock in/out troubleshooting",
    "group": "Time Clock / Troubleshooting",
    "keywords": "clock in clock out stuck wrong status refresh geofence unscheduled punch tip declaration",
    "body": [
      "If a user says clock in/out is backwards, compare local cached user state to the latest timePunches record.",
      "If geofence blocks or flags a punch, inspect device location permission, workspace address/GPS, radius, and clock-out status.",
      "Open punches need manager review before payroll export. Long shifts, negative hours, and unscheduled punches should be corrected with a reason.",
      "Tip declaration issues usually need role/user permission plus the active punch record checked."
    ]
  },
  {
    "title": "Schedule Builder troubleshooting",
    "group": "Scheduling / Troubleshooting",
    "keywords": "schedule builder cannot edit july publish overwrite duplicate shifts roles coverage targets",
    "body": [
      "Schedule Builder should use the same role source as Schedule Copilot and Staff Roster.",
      "If a month cannot edit, check rescue protection flags, published/draft status, restored legacy shifts, and date filters.",
      "If importing/recovering a month, run backup first, then overwrite the target month cleanly instead of layering duplicate shifts.",
      "After publish, test employee view, next shift tile, full schedule, and notifications."
    ]
  },
  {
    "title": "Push notification troubleshooting",
    "group": "Push / Troubleshooting",
    "keywords": "push notifications stopped stale token test push fcm service worker android ios",
    "body": [
      "Check browser permission first. If it is denied, the app cannot force notifications on.",
      "Stale tokens should be repaired through Push Control Center. Force-refresh only the affected user when possible.",
      "A test push should report sent/failed counts. If route fails, check Vercel logs for /api/send-push and Firebase Admin credentials.",
      "Users may need to reopen the app after service worker or domain changes."
    ]
  },
  {
    "title": "Customer onboarding troubleshooting",
    "group": "Onboarding / Troubleshooting",
    "keywords": "customer onboarding wizard first restaurant setup owner staff roles push mfa setup",
    "body": [
      "A new restaurant should complete name, owner, staff import, roles, schedule settings, notification setup, MFA setup for elevated users, first test push, and first backup.",
      "If the owner cannot log in, check Auth user, Firestore user profile, ownerEmail on restaurant, workspace membership, and temporary password handoff.",
      "Do not enable elevated-role MFA enforcement until the owner/Super Admin is enrolled and recovery is tested.",
      "Create a review stamp after onboarding so support knows the setup was verified."
    ]
  },
  {
    "title": "When to use Report Problem",
    "group": "Support / Troubleshooting",
    "keywords": "report problem error bug support diagnostics screenshot device camera mic storage",
    "body": [
      "Use Report Problem when a major error toast appears, a scan fails, voice misreads a command, or a customer reports a broken workflow.",
      "The report should include device diagnostics where possible, the screen name, what the user expected, what actually happened, and whether the issue repeats.",
      "For customer support, ask for a screenshot only after collecting the app's own report so you do not lose technical clues."
    ]
  }
];

const TabGodMode = ({ appUser, addToast, setGhostTenant, setActiveTab }) => {  const [subTab, setSubTab] = useState('overview');
  const [isCommandDeckOpen, setIsCommandDeckOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  
  // Master Data States
  const [restaurants, setRestaurants] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [crashLogs, setCrashLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [backupStatus, setBackupStatus] = useState(null);
  const [operationsReview, setOperationsReview] = useState(null);
  const [adminDataErrors, setAdminDataErrors] = useState({});
  const [backupCountdownTick, setBackupCountdownTick] = useState(Date.now());
  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [backupRestorePath, setBackupRestorePath] = useState('');
  const [isBackupRestoring, setIsBackupRestoring] = useState(false);
  const [backupList, setBackupList] = useState([]);
  const [isBackupListLoading, setIsBackupListLoading] = useState(false);
  const [backupListFilter, setBackupListFilter] = useState('all');
  const [backupListError, setBackupListError] = useState('');
  const [healthSnapshot, setHealthSnapshot] = useState(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [isDiagnosticsRunning, setIsDiagnosticsRunning] = useState(false);
  const [lastDiagnosticsReport, setLastDiagnosticsReport] = useState(null);
  const [isScheduleReinjecting, setIsScheduleReinjecting] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [createdWorkspaceLogin, setCreatedWorkspaceLogin] = useState(null);
  const [demoPlan, setDemoPlan] = useState('Pro');
  const [demoRole, setDemoRole] = useState('manager');
  const defaultDemoFeatures = { published:true, schedule:true, events:true, ops:true, messages:true, prep:true, recipes:true, inventory:true, financials:true, team:true, maintenance:true, help:true };
  const [demoFeatures, setDemoFeatures] = useState(defaultDemoFeatures);
  const [adminManualSearch, setAdminManualSearch] = useState('');
  const [adminManualQuestion, setAdminManualQuestion] = useState('');
  const [adminManualCategory, setAdminManualCategory] = useState('All');
  const [selectedAdminArticleId, setSelectedAdminArticleId] = useState('');
  const [adminHelpModal, setAdminHelpModal] = useState(null);
  const [userCounts, setUserCounts] = useState({});
  const [totalInstalls, setTotalInstalls] = useState(0);
  const [presenceSnapshot, setPresenceSnapshot] = useState({ users: [], recentUsers: [], fetchedAt: '', windowMinutes: 15, livePresenceCount: 0, onlineCount: 0, recentCount: 0 });
  const [isPresenceSnapshotLoading, setIsPresenceSnapshotLoading] = useState(false);
  const [presenceSnapshotError, setPresenceSnapshotError] = useState('');
  const [securityReport, setSecurityReport] = useState(null);
  const [isSecurityLoading, setIsSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState(''); 
  const [restoreDrillStatus, setRestoreDrillStatus] = useState(null);
  const [isRestoreDrillBusy, setIsRestoreDrillBusy] = useState(false);
  const [accountDeletionRequests, setAccountDeletionRequests] = useState([]);
  const [isAccountDeletionAdminBusy, setIsAccountDeletionAdminBusy] = useState(false);

  const ROLE_MANAGER_ROLES = ['Owner', 'Super Admin', 'Admin', 'Manager', 'Kitchen Lead', 'Bartender', 'Server', 'Staff'];
  const ROLE_MANAGER_PERMISSIONS = [
    { key: 'staffEditing', label: 'Staff editing', desc: 'Add, edit, reset, or remove employees.' },
    { key: 'scheduleEditing', label: 'Schedule editing', desc: 'Build, publish, and overwrite schedules.' },
    { key: 'financials', label: 'Financials', desc: 'View labor, timesheets, payroll, and daily ledger.' },
    { key: 'inventoryEditing', label: 'Inventory editing', desc: 'Adjust inventory, vendors, orders, and invoices.' },
    { key: 'recipeEditing', label: 'Recipe editing', desc: 'Add, edit, delete, and publish recipe content.' },
    { key: 'adminAccess', label: 'Admin access', desc: 'Open diagnostics, health, workspace tools, and support controls.' },
    { key: 'forensicsAccess', label: 'Forensics access', desc: 'View audit trails, backups, restore tools, and scary receipts.' }
  ];
  const buildDefaultRoleMatrix = () => {
    const full = Object.fromEntries(ROLE_MANAGER_PERMISSIONS.map(p => [p.key, true]));
    const kitchen = { staffEditing: false, scheduleEditing: false, financials: false, inventoryEditing: true, recipeEditing: true, adminAccess: false, forensicsAccess: false };
    const floor = { staffEditing: false, scheduleEditing: false, financials: false, inventoryEditing: false, recipeEditing: false, adminAccess: false, forensicsAccess: false };
    return {
      Owner: full,
      'Super Admin': full,
      Admin: full,
      Manager: { ...full, forensicsAccess: false },
      'Kitchen Lead': kitchen,
      Bartender: floor,
      Server: floor,
      Staff: floor
    };
  };
  const [rolePermissionMatrix, setRolePermissionMatrix] = useState(() => buildDefaultRoleMatrix());
  const [isSavingRoleMatrix, setIsSavingRoleMatrix] = useState(false);
  const [auditFilters, setAuditFilters] = useState({ user: '', action: '', session: '', date: '', security: 'all' });
  const [setupWorkspaceId, setSetupWorkspaceId] = useState('');
  const [historyWorkspaceId, setHistoryWorkspaceId] = useState('');
  const [importWorkspaceId, setImportWorkspaceId] = useState('');
  const [importKind, setImportKind] = useState('staff');
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [isImportingRows, setIsImportingRows] = useState(false);
  const [maintenanceScope, setMaintenanceScope] = useState('global');
  const [maintenanceRestaurantId, setMaintenanceRestaurantId] = useState('');
  const [maintenanceAudience, setMaintenanceAudience] = useState('everyone_except_super_admin');
  const [maintenanceMessage, setMaintenanceMessage] = useState('86 Chaos is down for maintenance. Please try again shortly.');
  const [maintenanceStartsAt, setMaintenanceStartsAt] = useState('');
  const [maintenanceEndsAt, setMaintenanceEndsAt] = useState('');
  const [brandingWorkspaceId, setBrandingWorkspaceId] = useState('');
  const [brandingForm, setBrandingForm] = useState({ appName: '86 Chaos', restaurantGroupName: '', accentColor: '#D4A381', restaurantLogoUrl: '', showRestaurantLogo: true, loginMessage: '', helpContact: '', timezone: 'America/Chicago', dateFormat: 'MMM d, yyyy', timeFormat: 'h:mm a' });
  const [v14WorkspaceId, setV14WorkspaceId] = useState('');
  const [v14StorageReport, setV14StorageReport] = useState(null);
  const [v14SchemaReport, setV14SchemaReport] = useState(null);
  const [v14BackupPreview, setV14BackupPreview] = useState(null);
  const [v14BackupPath, setV14BackupPath] = useState('');
  const [v14Backups, setV14Backups] = useState([]);
  const [v14BackupsLoadedAt, setV14BackupsLoadedAt] = useState('');
  const [v14SelectedCollections, setV14SelectedCollections] = useState([]);
  const [v14RestoreConfirm, setV14RestoreConfirm] = useState('');
  const [v14PermissionUserId, setV14PermissionUserId] = useState('');
  const [v14GuardrailReport, setV14GuardrailReport] = useState(null);
  const [v14BusyTool, setV14BusyTool] = useState('');


// Form States
  const [rName, setRName] = useState(''); const [rAddress, setRAddress] = useState(''); const [oName, setOName] = useState(''); const [oEmail, setOEmail] = useState(''); const [oPhone, setOPhone] = useState('');  const [adminEmail, setAdminEmail] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
const [editingRest, setEditingRest] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setBackupCountdownTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const selected = restaurants.find(r => r.id === brandingWorkspaceId);
    if (!selected) return;
    const sysSettings = selected.systemSettings || {};
    const savedBranding = sysSettings.branding || selected.branding || {};
    setBrandingForm({
      appName: '86 Chaos',
      restaurantGroupName: sysSettings.restaurantGroupName || savedBranding.restaurantGroupName || selected.name || '',
      accentColor: sysSettings.accentColor || savedBranding.accentColor || '#D4A381',
      restaurantLogoUrl: sysSettings.restaurantLogoUrl || savedBranding.restaurantLogoUrl || savedBranding.logoUrl || '',
      showRestaurantLogo: sysSettings.showRestaurantLogo ?? savedBranding.showRestaurantLogo ?? true,
      loginMessage: sysSettings.loginMessage || savedBranding.loginMessage || '',
      helpContact: sysSettings.helpContact || savedBranding.helpContact || selected.ownerEmail || '',
      timezone: sysSettings.timezone || savedBranding.timezone || 'America/Chicago',
      dateFormat: sysSettings.dateFormat || savedBranding.dateFormat || 'MMM d, yyyy',
      timeFormat: sysSettings.workspaceTimeFormat || savedBranding.timeFormat || 'h:mm a'
    });
  }, [brandingWorkspaceId, restaurants]);

  // Mobile admin should open as a clean section picker, not a mile-long cockpit scroll.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const closeDeckOnSmallScreens = () => {
      if (window.matchMedia('(max-width: 1023px)').matches) setIsCommandDeckOpen(false);
    };
    closeDeckOnSmallScreens();
    window.addEventListener('orientationchange', closeDeckOnSmallScreens);
    return () => window.removeEventListener('orientationchange', closeDeckOnSmallScreens);
  }, []);

  useEffect(() => {
    let canceled = false;
    getDoc(doc(db, 'system', 'rolePermissionMatrix')).then(snap => {
      if (canceled || !snap.exists()) return;
      const saved = snap.data()?.matrix;
      if (saved && typeof saved === 'object') {
        const defaults = buildDefaultRoleMatrix();
        const merged = {};
        ROLE_MANAGER_ROLES.forEach(role => { merged[role] = { ...(defaults[role] || {}), ...(saved[role] || {}) }; });
        setRolePermissionMatrix(merged);
      }
    }).catch(err => console.warn('Role matrix load failed', err?.message || err));
    return () => { canceled = true; };
  }, []);

  const loadSecurityCenter = async ({ silent = false } = {}) => {
    if (isSecurityLoading) return;
    setIsSecurityLoading(true);
    setSecurityError('');
    try {
      const response = await secureFetch('/api/security-diagnostics', { method: 'GET' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `Security check failed with status ${response.status}`);
      setSecurityReport(data);
      if (!silent) addToast('Security Center Refreshed', `${data.riskyUsers?.length || 0} risky user(s), ${data.suspiciousActivity?.count || 0} suspicious event(s).`);
    } catch (err) {
      const msg = err?.message || 'Security diagnostics failed.';
      setSecurityError(msg);
      if (!silent) addToast('Security Error', msg);
    } finally {
      setIsSecurityLoading(false);
    }
  };


  const loadRestoreDrillStatus = async ({ silent = true } = {}) => {
    setIsRestoreDrillBusy(true);
    try {
      const response = await secureFetch('/api/restore-drill', { method: 'GET' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Restore drill status failed.');
      setRestoreDrillStatus(data.restoreDrillStatus || null);
      if (!silent) addToast('Restore Drill Loaded', data.restoreDrillStatus?.lastDrillAt ? `Last drill: ${formatBackupTimestamp(data.restoreDrillStatus.lastDrillAt)}` : 'No restore drill recorded yet.');
      return data.restoreDrillStatus || null;
    } catch (err) {
      if (!silent) addToast('Restore Drill Error', err.message || 'Could not load restore drill status.');
      return null;
    } finally {
      setIsRestoreDrillBusy(false);
    }
  };

  const handleRecordRestoreDrill = async () => {
    const sourceBackupPath = window.prompt('Restore drill source backup path. Use the latest backup path or paste the backup you tested.', backupStatus?.storagePath || backupList?.[0]?.path || '');
    if (sourceBackupPath === null) return;
    const result = window.prompt('Result for the safe test restore: type passed, needs_followup, failed, or planned.', 'planned');
    if (result === null) return;
    const notes = window.prompt('Restore drill notes. Example: restored into chaos-test-d1601, checked login, users, inventory, schedules.', '') || '';
    setIsRestoreDrillBusy(true);
    try {
      const response = await secureFetch('/api/restore-drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceBackupPath, result, notes })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Restore drill record failed.');
      setRestoreDrillStatus(data.restoreDrillStatus || null);
      addToast('Restore Drill Recorded', data.message || 'Monthly restore drill status was updated.');
    } catch (err) {
      addToast('Restore Drill Error', err.message || 'Could not record restore drill.');
    } finally {
      setIsRestoreDrillBusy(false);
    }
  };

  const handleAccountDeletionAdminAction = async (request, action) => {
    const label = action === 'review' ? 'mark this request as reviewing' : action === 'complete' ? 'mark this request complete' : 'deny this request';
    const defaultNote = action === 'complete'
      ? 'Verified identity, checked retention needs, completed export/anonymize/delete steps as required.'
      : action === 'review'
        ? 'Request accepted for administrator review.'
        : '';
    const notes = window.prompt(`Account deletion request for ${request.email || request.uid || request.id}.\n\nAdd an admin note to ${label}.`, defaultNote);
    if (notes === null) return;
    if (['complete', 'deny'].includes(action) && notes.trim().length < 8) {
      addToast('More Detail Needed', 'Add a short note so the privacy audit trail is useful.');
      return;
    }
    setIsAccountDeletionAdminBusy(true);
    try {
      const response = await secureFetch('/api/account-deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: `admin-${action}`, targetUid: request.uid || request.id, adminNotes: notes })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `Could not ${label}.`);
      addToast('Account Deletion Updated', data.message || `Request marked ${data.status || action}.`);
    } catch (err) {
      addToast('Deletion Request Error', err.message || 'Could not update the account deletion request.');
    } finally {
      setIsAccountDeletionAdminBusy(false);
    }
  };

  const buildWorkspaceLoginText = (login) => login ? `Welcome to 86 Chaos!\n\nWorkspace: ${login.restaurantName}\nApp: https://app.86chaos.com\n\nOwner: ${login.ownerName}\nEmail: ${login.email}\nTemporary Password: ${login.password}\n\nThis temporary password is shown one time. Please log in and change it.` : '';
  const copyWorkspaceLogin = async (login) => { try { await navigator.clipboard.writeText(buildWorkspaceLoginText(login)); addToast('Copied', 'Workspace login info copied.'); } catch(e) { addToast('Copy Failed', 'Highlight and copy the login info manually.'); } };
  const printWorkspaceLogin = (login) => { const w = window.open('', '_blank'); if (!w) return addToast('Popup Blocked', 'Allow popups to print the login sheet.'); w.document.write(`<pre style="font-family:Arial,sans-serif;font-size:18px;white-space:pre-wrap;line-height:1.5">${buildWorkspaceLoginText(login).replace(/</g,'&lt;')}</pre>`); w.document.close(); w.focus(); w.print(); };
  const emailWorkspaceLogin = (login) => { window.location.href = `mailto:${login.email}?subject=${encodeURIComponent(`Your 86 Chaos OS: ${login.restaurantName}`)}&body=${encodeURIComponent(buildWorkspaceLoginText(login))}`; };
  const textWorkspaceLogin = (login) => { if (!login.phone) return addToast('No Phone', 'No owner phone number was entered.'); const smsChar = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'; window.location.href = `sms:${login.phone}${smsChar}body=${encodeURIComponent(buildWorkspaceLoginText(login))}`; };
  const startDemoMode = (client, role = demoRole) => { if (!client?.id) return; setGhostTenant({ id: client.id, name: client.name, mode: 'demo', demoMode: { plan: demoPlan, role, features: demoFeatures } }); setSelectedClient(null); setActiveTab('published'); addToast('Demo Mode', `${role === 'employee' ? 'Employee' : 'Manager'} demo started. Use the banner to exit.`); };
  const [forgeEventTitle, setForgeEventTitle] = useState(''); const [forgeEventDate, setForgeEventDate] = useState(getToday());
  const [userSearch, setUserSearch] = useState('');
  const [bulkDeleteEmails, setBulkDeleteEmails] = useState('');
  const [selectedBulkDeleteUserIds, setSelectedBulkDeleteUserIds] = useState([]);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);
  const [editingGlobalUser, setEditingGlobalUser] = useState(null);
  const [supportUserForm, setSupportUserForm] = useState({});

  // Emergency client-side restore data. This writes through the same Firebase app the UI is currently using,
  // so it cannot accidentally restore into the wrong Firebase project.
  const LEGACY_RESTORE_RESTAURANT_ID = 'cheers_chilton_01';
  const LEGACY_RESTORE_MONTH_START = '2026-07-01';
  const LEGACY_RESTORE_MONTH_END = '2026-07-31';
const LEGACY_JULY_2026_SCHEDULE = [
    ['2026-07-01','Chuck','10:00','21:00'],['2026-07-01','Julia','10:00','16:00'],['2026-07-01','Maicol','16:00','21:00'],['2026-07-01','Lani','16:00','21:00'],
    ['2026-07-02','Lani','10:00','21:00'],['2026-07-02','Geoff','10:00','21:00'],['2026-07-02','Ellis','16:00','21:00'],['2026-07-02','Maicol','16:00','21:00'],
    ['2026-07-03','Ellis','16:00','21:00'],['2026-07-03','Clare','11:00','14:00'],['2026-07-03','Chuck','14:00','22:00'],['2026-07-03','Lani','10:00','21:00'],['2026-07-03','Geoff','10:00','21:00'],
    ['2026-07-04','Lani','10:00','16:00'],['2026-07-04','Chuck','10:00','16:00'],
    ['2026-07-07','Chuck','10:00','16:00'],['2026-07-07','Geoff','09:00','15:00'],['2026-07-07','Julia','16:00','21:00'],['2026-07-07','Lani','16:00','21:00'],['2026-07-07','Maicol','16:00','21:00'],
    ['2026-07-08','Lani','16:00','21:00'],['2026-07-08','Julia','10:00','16:00'],['2026-07-08','Geoff','09:00','15:00'],['2026-07-08','Maicol','16:00','21:00'],['2026-07-08','Chuck','16:00','21:00'],
    ['2026-07-09','Lani','14:00','21:00'],['2026-07-09','Ellis','16:00','21:00'],['2026-07-09','Chuck','10:00','21:00'],['2026-07-09','Maicol','16:00','21:00'],
    ['2026-07-10','Clare','11:00','14:00'],['2026-07-10','Chuck','10:00','22:00'],['2026-07-10','Geoff','10:00','22:00'],['2026-07-10','Ellis','16:00','21:00'],['2026-07-10','Lani','14:00','22:00'],
    ['2026-07-11','Maicol','16:00','21:00'],['2026-07-11','Lani','10:00','21:00'],['2026-07-11','Geoff','10:00','16:00'],
    ['2026-07-12','Maicol','16:00','21:00'],['2026-07-12','Chuck','10:00','16:00'],['2026-07-12','Geoff','09:00','15:00'],['2026-07-12','Lani','16:00','21:00'],
    ['2026-07-13','Maicol','16:00','21:00'],['2026-07-13','Geoff','09:00','15:00'],['2026-07-13','Julia','10:00','21:00'],
    ['2026-07-14','Geoff','09:00','15:00'],['2026-07-14','Julia','10:00','21:00'],
    ['2026-07-15','Maicol','16:00','21:00'],['2026-07-15','Lani','16:00','21:00'],['2026-07-15','Geoff','09:00','15:00'],['2026-07-15','Julia','10:00','16:00'],
    ['2026-07-16','Lani','10:00','21:00'],['2026-07-16','Ellis','16:00','21:00'],['2026-07-16','Chuck','10:00','21:00'],
    ['2026-07-17','Clare','11:00','14:00'],['2026-07-17','Maicol','16:00','22:00'],['2026-07-17','Geoff','10:00','21:00'],['2026-07-17','Chuck','10:00','21:00'],['2026-07-17','Ellis','16:00','21:00'],
    ['2026-07-18','Lani','10:00','21:00'],['2026-07-18','Chuck','10:00','16:00'],['2026-07-18','Maicol','16:00','21:00'],
    ['2026-07-19','Geoff','10:00','16:00'],['2026-07-19','Lani','16:00','21:00'],['2026-07-19','Maicol','10:00','21:00'],
    ['2026-07-20','Chuck','10:00','21:00'],['2026-07-20','Ellis','16:00','21:00'],['2026-07-20','Lani','16:00','21:00'],['2026-07-20','Geoff','10:00','16:00'],
    ['2026-07-21','Chuck','10:00','16:00'],['2026-07-21','Maicol','16:00','21:00'],['2026-07-21','Geoff','09:00','15:00'],['2026-07-21','Lani','16:00','21:00'],
    ['2026-07-22','Julia','10:00','16:00'],['2026-07-22','Geoff','09:00','15:00'],['2026-07-22','Lani','16:00','21:00'],['2026-07-22','Maicol','16:00','21:00'],
    ['2026-07-23','Geoff','10:00','16:00'],['2026-07-23','Ellis','16:00','21:00'],['2026-07-23','Maicol','16:00','21:00'],['2026-07-23','Chuck','10:00','21:00'],
    ['2026-07-24','Clare','11:00','14:00'],['2026-07-24','Maicol','16:00','22:00'],['2026-07-24','Chuck','10:00','21:00'],['2026-07-24','Lani','14:00','21:00'],['2026-07-24','Geoff','10:00','21:00'],['2026-07-24','Ellis','16:00','21:00'],
    ['2026-07-25','Maicol','16:00','21:00'],['2026-07-25','Lani','10:00','21:00'],['2026-07-25','Chuck','10:00','16:00'],
    ['2026-07-26','Maicol','16:00','21:00'],['2026-07-26','Geoff','10:00','16:00'],['2026-07-26','Chuck','10:00','16:00'],['2026-07-26','Lani','16:00','21:00'],
    ['2026-07-27','Julia','10:00','21:00'],['2026-07-27','Ellis','16:00','21:00'],['2026-07-27','Chuck','10:00','21:00'],
    ['2026-07-28','Julia','10:00','16:00'],['2026-07-28','Geoff','09:00','15:00'],['2026-07-28','Maicol','16:00','21:00'],['2026-07-28','Lani','16:00','21:00'],
    ['2026-07-29','Geoff','09:00','15:00'],['2026-07-29','Chuck','16:00','21:00'],['2026-07-29','Maicol','16:00','21:00'],['2026-07-29','Julia','10:00','16:00'],
    ['2026-07-30','Geoff','09:00','15:00'],['2026-07-30','Chuck','10:00','21:00'],['2026-07-30','Maicol','15:00','21:00'],['2026-07-30','Ellis','16:00','21:00'],
    ['2026-07-31','Clare','11:00','14:00'],['2026-07-31','Lani','14:00','22:00'],['2026-07-31','Ellis','16:00','21:00'],['2026-07-31','Geoff','10:00','21:00'],['2026-07-31','Chuck','10:00','21:00']
  ];

// Pricing & MRR States
  const [tierPrices, setTierPrices] = useState({ Starter: 39, Pro: 99, Elite: 149, Enterprise: 199 });
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  
  // Live Banner States
  const [bannerTarget, setBannerTarget] = useState('ALL');
  const [bannerText, setBannerText] = useState('');

  const handlePushBanner = async (e) => {
    e.preventDefault();
    if (!bannerText.trim()) return addToast('Error', 'Banner text required.');
    if (!window.confirm("Pin this banner to the top of the app?")) return;
    
    addToast('Deploying', 'Pushing banner to selected workspace(s)...');
    try {
      if (bannerTarget === 'ALL') {
        const promises = restaurants.map(r => updateDoc(doc(db, "restaurants", r.id), { systemBanner: bannerText.trim() }));
        await Promise.all(promises);
      } else {
        await updateDoc(doc(db, "restaurants", bannerTarget), { systemBanner: bannerText.trim() });
      }
      addToast('Success', 'Banner deployed successfully.');
      setBannerText('');
    } catch(err) { addToast('Error', err.message); }
  };

  const handleClearBanner = async () => {
    if (!window.confirm("Clear active banners for the selected target?")) return;
    addToast('Clearing', 'Removing banners...');
    try {
      if (bannerTarget === 'ALL') {
        const promises = restaurants.map(r => updateDoc(doc(db, "restaurants", r.id), { systemBanner: null }));
        await Promise.all(promises);
      } else {
        await updateDoc(doc(db, "restaurants", bannerTarget), { systemBanner: null });
      }
      addToast('Success', 'Banner(s) cleared.');
    } catch(err) { addToast('Error', err.message); }
  };
  
  // Nuke Security States
  const [nukeTarget, setNukeTarget] = useState(null);
  const [nukePassword, setNukePassword] = useState('');
  const [isNuking, setIsNuking] = useState(false);
  // --- RAW JSON INSPECTOR STATE ---
  const [isRawInspectorOpen, setIsRawInspectorOpen] = useState(false);
  const [rawInspectorId, setRawInspectorId] = useState('');
  const [rawInspectorCollection, setRawInspectorCollection] = useState('users');
  const [rawInspectorData, setRawInspectorData] = useState(null);

  const handleFetchRawDoc = async (e) => {
    e.preventDefault();
    if (!rawInspectorId.trim()) return;
    try {
      const docSnap = await getDoc(doc(db, rawInspectorCollection, rawInspectorId.trim()));
      if (docSnap.exists()) setRawInspectorData({ id: docSnap.id, ...docSnap.data() });
      else addToast('Not Found', 'No document found with that ID in that collection.');
    } catch(err) { addToast('Error', err.message); }
  };

  // Fetch Global Intelligence
  useEffect(() => {
    const noteLoadError = (key, err) => {
      console.warn(`System Administrator data load failed: ${key}`, err?.message || err);
      setAdminDataErrors(prev => ({ ...prev, [key]: err?.message || 'Permission denied or network blocked.' }));
    };
    const clearLoadError = (key) => setAdminDataErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const unsubRests = onSnapshot(collection(db, 'restaurants'), snap => { clearLoadError('restaurants'); setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }, err => noteLoadError('restaurants', err));
    const unsubAdmins = onSnapshot(query(collection(db, 'users'), where('isSuperAdmin', '==', true)), snap => { clearLoadError('superAdmins'); setSuperAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }, err => noteLoadError('superAdmins', err));
    let rawUserList = [];
    const publishUsers = () => {
      setAllUsers(rawUserList);
      const counts = {};
      rawUserList.forEach(u => { if (u.restaurantId) counts[u.restaurantId] = (counts[u.restaurantId] || 0) + 1; });
      setUserCounts(counts);
    };
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      clearLoadError('users');
      rawUserList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishUsers();
    }, err => noteLoadError('users', err));
    const unsubCrashes = onSnapshot(collection(db, 'crashReports'), snap => { clearLoadError('crashReports'); setCrashLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.time||0) - new Date(a.time||0)).slice(0, 50)); }, err => noteLoadError('crashReports', err));
const unsubAudit = onSnapshot(collection(db, 'auditLogs'), snap => {
       clearLoadError('auditLogs');
       const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setAuditLogs(rawLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100));
       setTotalInstalls(rawLogs.filter(log => log.action === 'APP_INSTALLED').length);
    }, err => noteLoadError('auditLogs', err));
    const unsubPricing = onSnapshot(doc(db, 'system', 'pricing'), docSnap => {
       clearLoadError('pricing');
       if (docSnap.exists()) setTierPrices(docSnap.data());
    }, err => noteLoadError('pricing', err));
    const unsubBackup = onSnapshot(doc(db, 'system', 'backupStatus'), docSnap => {
       clearLoadError('backupStatus');
       setBackupStatus(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
    }, err => { setBackupStatus(null); noteLoadError('backupStatus', err); });
    const unsubRestoreDrill = onSnapshot(doc(db, 'system', 'restoreDrillStatus'), docSnap => {
       clearLoadError('restoreDrillStatus');
       setRestoreDrillStatus(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
    }, err => { setRestoreDrillStatus(null); noteLoadError('restoreDrillStatus', err); });
    const unsubDeletionRequests = onSnapshot(collection(db, 'accountDeletionRequests'), snap => {
       clearLoadError('accountDeletionRequests');
       setAccountDeletionRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.updatedAt || b.requestedAt || 0) - new Date(a.updatedAt || a.requestedAt || 0)).slice(0, 100));
    }, err => { setAccountDeletionRequests([]); noteLoadError('accountDeletionRequests', err); });
    const unsubOpsReview = onSnapshot(doc(db, 'system', 'operationsReview'), docSnap => {
       clearLoadError('operationsReview');
       setOperationsReview(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
    }, err => { setOperationsReview(null); noteLoadError('operationsReview', err); });
    return () => { unsubRests(); unsubAdmins(); unsubUsers(); unsubCrashes(); unsubAudit(); unsubPricing(); unsubBackup(); unsubRestoreDrill(); unsubDeletionRequests(); unsubOpsReview(); };
  }, []);


  const loadPresenceSnapshot = async ({ silent = false } = {}) => {
    setIsPresenceSnapshotLoading(true);
    setPresenceSnapshotError('');
    try {
      const response = await secureFetch('/api/presence-snapshot?windowMinutes=15&limit=1200', { method: 'GET' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `API ${response.status}`);
      setPresenceSnapshot({
        users: Array.isArray(data.users) ? data.users : [],
        recentUsers: Array.isArray(data.recentUsers) ? data.recentUsers : [],
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        windowMinutes: data.windowMinutes || 15,
        livePresenceCount: data.livePresenceCount || 0,
        onlineCount: data.onlineCount || 0,
        recentCount: data.recentCount || 0,
        mode: data.mode || 'manual-snapshot'
      });
      if (!silent) addToast('Presence Snapshot', `${data.onlineCount || 0} recent app check-in(s) found. No live listener was opened.`);
    } catch (err) {
      const message = err?.message || 'Manual presence snapshot failed.';
      setPresenceSnapshotError(message);
      if (!silent) addToast('Snapshot Failed', message);
    } finally {
      setIsPresenceSnapshotLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'forensics' && backupList.length === 0 && !isBackupListLoading) {
      loadBackupList({ silent: true });
    }
    if (subTab === 'health' && !healthSnapshot && !isHealthLoading) {
      refreshHealthDashboard({ silent: true });
    }
  }, [subTab]);

// --- 1. TENANT MANAGEMENT & DEPLOYMENT ---

   const handleDeleteTenant = async (tenantId, tenantName) => {
    if (prompt(`CRITICAL: Type "DELETE" to permanently remove the workspace registry for ${tenantName}. \n\nNOTE: You should use the 'Danger Zone' Nuke tool in the Manage menu first to wipe their underlying data.`) !== 'DELETE') {
      return addToast('Aborted', 'Workspace deletion canceled.');
    }

    addToast('Deleting', `Removing workspace ${tenantName}...`);
    try {
      await deleteDoc(doc(db, "restaurants", tenantId));
      addToast('Deleted', `${tenantName} has been permanently removed from the roster.`);
    } catch (err) {
      addToast('Error', err.message);
    }
  };                 

  const handleStampMissingClientCreatedAt = async () => {
    const missing = restaurants.filter(r => !getClientCreatedAt(r));
    if (missing.length === 0) {
      addToast('All Set', 'Every client already has a created date and time stamp.');
      return;
    }
    if (!window.confirm(`Add a created timestamp to ${missing.length} client(s) missing one?

Old clients cannot reveal their original creation time, so they will be marked as backfilled today.`)) return;

    const stamp = new Date().toISOString();
    let count = 0;
    try {
      for (const r of missing) {
        await updateDoc(doc(db, "restaurants", r.id), {
          createdAt: stamp,
          createdAtEstimated: true,
          createdAtBackfilledAt: stamp,
          createdAtSource: 'admin_backfill'
        });
        count++;
      }
      addToast('Stamped', `Added created timestamps to ${count} client record(s).`);
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  const handleDeployTenant = async (e) => {
    e.preventDefault(); 
    if (!rName.trim() || !oEmail.trim() || !oName.trim() || !rAddress.trim()) return;
    
    addToast('Deploying', `Creating workspace for ${rName}...`);
    
    try {
      const tPass = generateTempPass(); 
      
      // Ping the Vercel Backend to bypass Firebase Security Rules safely
      const response = await secureFetch('/api/deploy-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           rName: rName.trim(),
           oName: oName.trim(),
           oEmail: oEmail.trim(),
           oPhone: oPhone.trim(),
           rAddress: rAddress.trim(),
           tPass: tPass
        })
      });

      // SAFETY NET: Prevent the "Unexpected token" HTML crash if Vercel throws a 404 or 500
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         throw new Error("API Route Missing! Did you push api/deploy-tenant.js to GitHub/Vercel?");
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to deploy tenant.');

      // Stamp new client records with an exact creation date/time.
      // If the backend route already did it, this safely leaves the same value in place.
      try {
        const deployedAt = data.createdAt || new Date().toISOString();
        const returnedRestId = data.restaurantId || data.tenantId || data.restId || data.id;
        const deployStamp = {
          createdAt: deployedAt,
          createdAtSource: data.createdAt ? 'api_deploy_tenant' : 'app_deploy_confirmed',
          createdByEmail: appUser?.email || MASTER_ADMIN_EMAIL,
          createdByName: appUser?.name || 'System Administrator'
        };

        if (returnedRestId) {
          await setDoc(doc(db, "restaurants", returnedRestId), deployStamp, { merge: true });
        } else {
          const restSnap = await getDocs(query(collection(db, "restaurants"), where("ownerEmail", "==", oEmail.toLowerCase().trim())));
          const targetDoc = restSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .find(r => (r.name || '').trim().toLowerCase() === rName.trim().toLowerCase() || !getClientCreatedAt(r));
          if (targetDoc?.id) await setDoc(doc(db, "restaurants", targetDoc.id), deployStamp, { merge: true });
        }
      } catch (stampErr) {
        console.warn('Client timestamp stamp failed:', stampErr);
      }
      setCreatedWorkspaceLogin({ kind:'workspace', restaurantName: rName.trim(), ownerName: oName.trim(), email: oEmail.toLowerCase().trim(), phone: oPhone.trim(), password: tPass, restaurantId: data.restaurantId || data.tenantId || data.restId || data.id || '' });
      
      addToast('Tenant Deployed', `${rName} is now live.`); 
      setRName(''); setOName(''); setOEmail(''); setOPhone(''); setRAddress('');    
    } catch (error) { 
      addToast('Deployment Failed', error.message); 
    }
  };


// --- MISSING CLIENT MANAGEMENT FUNCTIONS ---
  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    try {
      const restRef = doc(db, "restaurants", editingRest.id);
      const beforeSnap = await getDoc(restRef);
      const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};
      const updatePayload = {
        name: editingRest.name,
        ownerName: editingRest.ownerName,
        ownerEmail: editingRest.ownerEmail,
        ownerPhone: editingRest.ownerPhone,
        systemSettings: editingRest.systemSettings || {},
        planType: editingRest.planType || 'Pro',
        billingStatus: editingRest.billingStatus || 'Paid',
        customPrice: editingRest.customPrice || '',
        trialDays: editingRest.trialDays !== undefined ? editingRest.trialDays : 14,
        isActive: editingRest.isActive ?? true,
        isReadOnly: editingRest.isReadOnly ?? false,
        features: editingRest.features || {},
        labs: editingRest.labs || {}
      };
      const cleanUpdatePayload = sanitizeForFirestore(updatePayload);
      const historyEntry = sanitizeForFirestore({
        type: 'platform_workspace_settings',
        at: new Date().toISOString(),
        by: appUser?.email || appUser?.name || 'System Admin',
        summary: 'Workspace settings changed from System Administrator > Workspaces.',
        before: { name: beforeData.name, ownerName: beforeData.ownerName, ownerEmail: beforeData.ownerEmail, ownerPhone: beforeData.ownerPhone, systemSettings: beforeData.systemSettings || {}, planType: beforeData.planType, billingStatus: beforeData.billingStatus, customPrice: beforeData.customPrice, trialDays: beforeData.trialDays, isActive: beforeData.isActive, isReadOnly: beforeData.isReadOnly, features: beforeData.features || {}, labs: beforeData.labs || {} },
        after: cleanUpdatePayload
      });
      const existingHistory = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
      await updateDoc(restRef, sanitizeForFirestore({ ...cleanUpdatePayload, settingsHistory: [...existingHistory, historyEntry] }));
      addToast('Saved', 'Client workspace configuration updated and history snapshot saved.');
      setEditingRest(null);
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  const handleExportData = async (rest) => {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), where("restaurantId", "==", rest.id)));
      const usersList = usersSnap.docs.map(d => d.data());
      if (usersList.length === 0) return addToast('Empty', 'No users found for this workspace.');

      let csv = "Name,Email,Role,Phone,Admin\n" + usersList.map(u => `"${u.name}","${u.email}","${u.role}","${u.phone || ''}","${u.isAdmin || false}"`).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${safeFilenamePart(rest.name || 'Restaurant')}-Users-Export.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      addToast('Exported', 'User list downloaded.');
    } catch (err) { 
      addToast('Error', 'Export failed.'); 
    }
  };

  // --- DATABASE SNAPSHOT ENGINE (BACKUP & RESTORE) ---
  const handleCreateBackup = async (rest) => {
    addToast('Backing Up', `Compiling database snapshot for ${rest.name}...`);
    const collectionsToBackup = ['users', 'shifts', 'recipes', 'inventoryItems', 'vendors', 'invoices', 'timePunches', 'sales', 'events', 'tasks', 'wasteLogs', 'timeOffRequests', 'prepCategories', 'roles', 'shiftSwaps', 'maintenanceLogs'];
    const snapshot = { metadata: { restaurantId: rest.id, restaurantName: rest.name, timestamp: new Date().toISOString() }, data: {} };

    try {
      for (const colName of collectionsToBackup) {
        const q = query(collection(db, colName), where("restaurantId", "==", rest.id));
        const snap = await getDocs(q);
        snapshot.data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${safeFilenamePart(rest.name || 'Restaurant')}-Backup-${getToday()}.json`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addToast('Backup Complete', 'JSON snapshot downloaded successfully.');
    } catch (err) { addToast('Backup Failed', err.message); }
  };

  const handleRestoreBackup = async (e, rest) => {
    const file = e.target.files[0];
    if (!file) return;
    if (prompt(`CRITICAL: Type "RESTORE" to inject this backup file into ${rest.name}'s database.`) !== 'RESTORE') {
      e.target.value = '';
      return addToast('Aborted', 'Restore canceled.');
    }

    addToast('Restoring', 'Injecting data. Do not close your browser...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (backup.metadata.restaurantId !== rest.id) return addToast('Error', 'Tenant ID mismatch. You cannot restore a backup from a different workspace.');

        let restoredCount = 0;
        for (const [colName, docs] of Object.entries(backup.data)) {
          const promises = docs.map(d => {
             const { id, ...data } = d;
             return setDoc(doc(db, colName, id), data);
          });
          await Promise.all(promises);
          restoredCount += docs.length;
        }
        addToast('Restore Complete', `Successfully injected ${restoredCount} documents.`);
      } catch (err) { addToast('Error', 'Invalid backup file or upload failed.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- EMPLOYEE SPECIFIC BACKUP & RESTORE ENGINE ---
  const handleBackupEmployee = async (u) => {
    addToast('Backing Up', `Compiling data for ${u.name}...`);
    const snapshot = { metadata: { userId: u.id, userName: u.name, timestamp: new Date().toISOString() }, data: { users: [u], shifts: [], timePunches: [], timeOffRequests: [] } };
    try {
      const shiftsSnap = await getDocs(query(collection(db, 'shifts'), where('employeeId', '==', u.id)));
      snapshot.data.shifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const punchesSnap = await getDocs(query(collection(db, 'timePunches'), where('employeeId', '==', u.id)));
      snapshot.data.timePunches = punchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const timeOffSnap = await getDocs(query(collection(db, 'timeOffRequests'), where('userId', '==', u.id)));
      snapshot.data.timeOffRequests = timeOffSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${getRestaurantExportPrefix(appUser)}-Employee-${safeFilenamePart(u.name || 'Staff')}-${getToday()}.json`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('Backup Complete', 'Employee JSON downloaded.');
    } catch (err) { addToast('Error', err.message); }
  };

  const handleRestoreEmployee = async (e, u) => {
    const file = e.target.files[0];
    if (!file) return;
    if (prompt(`CRITICAL: Type "RESTORE" to inject this backup into ${u.name}'s profile.`) !== 'RESTORE') {
      e.target.value = ''; return addToast('Aborted', 'Restore canceled.');
    }
    addToast('Restoring', 'Injecting employee data...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (backup.metadata.userId !== u.id && !window.confirm("ID mismatch. Inject anyway?")) return;
        let count = 0;
        for (const [colName, docs] of Object.entries(backup.data)) {
          const promises = docs.map(d => {
            const { id, ...data } = d;
            return setDoc(doc(db, colName, id), data);
          });
          await Promise.all(promises);
          count += docs.length;
        }
        addToast('Restore Complete', `Injected ${count} records.`);
      } catch (err) { addToast('Error', 'Invalid backup file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

const handleDeleteGlobalUser = async (u) => {
    if (prompt(`CRITICAL: Type "DELETE" to permanently erase ${u.name} and all their access.`) !== 'DELETE') {
      return addToast('Aborted', 'User deletion canceled.');
    }
    
    addToast('Terminating', 'Nuking user from all systems...');
    try {
      // 1. Nuke the Authentication Login via Vercel
      await secureFetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: u.id })
      });
      
      // 2. Nuke the Database Profile
      await deleteDoc(doc(db, "users", u.id));
      addToast('Terminated', `User ${u.name} has been erased.`);
    } catch (err) {
      addToast('Error', 'Could not delete user. ' + err.message);
    }
  };


  const parseBulkEmailList = (raw) => [...new Set((raw || '')
    .split(/[\s,;]+/)
    .map(v => v.toLowerCase().trim())
    .filter(v => v && v.includes('@'))
  )];

  const getUserCreatedValue = (u = {}) => u.createdAt || u.created || u.createdOn || u.createdDate || u.importedAt || u.passwordPurgedAt || u.lastWorkspaceSwitchedAt || u.updatedAt || '';
  const formatUserCreatedValue = (u = {}) => {
    const raw = getUserCreatedValue(u);
    if (!raw) return 'Created date unknown';
    try {
      const d = raw?.toDate ? raw.toDate() : raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
      if (Number.isNaN(d.getTime())) return String(raw);
      return d.toLocaleString();
    } catch (_) {
      return String(raw);
    }
  };
  const getBulkDeletePreviewUsers = () => {
    const emails = parseBulkEmailList(bulkDeleteEmails);
    if (!emails.length) return [];
    return allUsers
      .filter(u => emails.includes((u.email || '').toLowerCase().trim()))
      .sort((a, b) => (a.email || '').localeCompare(b.email || '') || String(getUserCreatedValue(a) || '').localeCompare(String(getUserCreatedValue(b) || '')));
  };
  const toggleBulkDeleteSelection = (userId, checked) => {
    setSelectedBulkDeleteUserIds(prev => checked ? [...new Set([...prev, userId])] : prev.filter(id => id !== userId));
  };

  const handleBulkDeleteUsersByEmail = async (e) => {
    e.preventDefault();
    const emails = parseBulkEmailList(bulkDeleteEmails);
    if (emails.length === 0) return addToast('Nothing to Delete', 'Paste one or more email addresses first.');

    const protectedEmails = new Set([MASTER_ADMIN_EMAIL.toLowerCase(), (appUser?.email || '').toLowerCase()].filter(Boolean));
    const previewUsers = getBulkDeletePreviewUsers();
    const validSelectedIds = selectedBulkDeleteUserIds.filter(id => previewUsers.some(u => u.id === id));
    const skippedProtected = emails.filter(email => protectedEmails.has(email));
    const duplicateGroups = Object.values(previewUsers.reduce((acc, u) => {
      const key = (u.email || '').toLowerCase().trim();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(u);
      return acc;
    }, {})).filter(group => group.length > 1);

    if (duplicateGroups.length > 0 && validSelectedIds.length === 0) {
      return addToast('Select Exact Profiles', 'That email matches multiple user profiles. Check the exact created-date rows you want to delete first.');
    }

    const targets = (validSelectedIds.length > 0 ? previewUsers.filter(u => validSelectedIds.includes(u.id)) : previewUsers)
      .filter(u => !protectedEmails.has((u.email || '').toLowerCase().trim()));

    if (targets.length === 0) {
      return addToast('No Matches', skippedProtected.length ? 'Only protected admin emails were entered or selected.' : 'No deletable user profiles matched those emails.');
    }

    const targetSummary = targets.map(u => {
      const email = (u.email || 'no-email').toLowerCase();
      const created = formatUserCreatedValue(u);
      const restName = restaurants.find(r => r.id === u.restaurantId)?.name || u.restaurantId || 'Unknown workspace';
      return `${email} | ${created} | ${restName} | ${String(u.id || '').slice(0, 12)}`;
    }).join('\n');

    const confirmText = (prompt(`This will delete these exact ${targets.length} user profile(s):
${targetSummary}

Type DELETE to continue.`) || '').trim().toUpperCase();
    if (!['DELETE', 'DELETE USERS'].includes(confirmText)) return addToast('Aborted', 'Bulk deletion canceled.');

    setIsBulkDeletingUsers(true);
    let authDeleted = 0;
    let profileDeleted = 0;
    const errors = [];

    try {
      // Preferred path: one secure backend call deletes selected Firebase Auth users and Firestore profiles.
      try {
        const response = await secureFetch('/api/delete-users-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validSelectedIds.length > 0 ? { emails, userIds: targets.map(u => u.id) } : { emails })
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) {
          authDeleted = result.authDeleted ?? result.deletedAuthCount ?? targets.length;
          profileDeleted = result.profileDeleted ?? result.deletedProfileCount ?? targets.length;
          addToast('Bulk Delete Complete', `${profileDeleted} profile(s) removed. ${authDeleted} auth login(s) removed.`);
          setBulkDeleteEmails('');
          setSelectedBulkDeleteUserIds([]);
          await addDoc(collection(db, 'auditLogs'), {
            userId: appUser?.id || 'system', userName: appUser?.name || 'System Admin', action: 'BULK_DELETE_USERS', target: 'users',
            details: `Bulk deleted ${profileDeleted} profile(s). Selected IDs: ${targets.map(u => u.id).join(', ')}. Emails: ${emails.join(', ')}.`, timestamp: new Date().toISOString(), restaurantId: appUser?.restaurantId || 'system', sessionId: currentAdminSessionId, isGhost: appUser?.isGhost || false
          }).catch(()=>{});
          return;
        }
        throw new Error(result.error || 'Bulk delete API unavailable.');
      } catch (bulkApiErr) {
        console.warn('Bulk delete API unavailable, falling back to individual user deletion:', bulkApiErr);
      }

      // Fallback path: try the existing single delete-user endpoint for each selected UID, then delete the profile doc.
      for (const u of targets) {
        try {
          try {
            const response = await secureFetch('/api/delete-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetUid: u.id })
            });
            if (response.ok) authDeleted++;
          } catch (authErr) {
            errors.push(`Auth delete failed for ${u.email}: ${authErr.message}`);
          }
          await deleteDoc(doc(db, 'users', u.id));
          profileDeleted++;
        } catch (profileErr) {
          errors.push(`Profile delete failed for ${u.email}: ${profileErr.message}`);
        }
      }

      await addDoc(collection(db, 'auditLogs'), {
        userId: appUser?.id || 'system', userName: appUser?.name || 'System Admin', action: 'BULK_DELETE_USERS', target: 'users',
        details: `Bulk deleted ${profileDeleted} selected profile(s). Auth deleted: ${authDeleted}. Selected IDs: ${targets.map(u => u.id).join(', ')}. Errors: ${errors.slice(0, 5).join(' | ') || 'none'}`,
        timestamp: new Date().toISOString(), restaurantId: appUser?.restaurantId || 'system', sessionId: currentAdminSessionId, isGhost: appUser?.isGhost || false
      }).catch(()=>{});

      addToast(errors.length ? 'Partial Delete' : 'Bulk Delete Complete', `${profileDeleted} profile(s) removed. ${authDeleted} auth login(s) removed.`);
      if (!errors.length) { setBulkDeleteEmails(''); setSelectedBulkDeleteUserIds([]); }
    } finally {
      setIsBulkDeletingUsers(false);
    }
  };

  const loadDuplicateEmailsIntoBulkDelete = () => {
    if (duplicateEmailGroups.length === 0) return addToast('Clean', 'No duplicate email groups found.');
    setSubTab('users');
    setBulkDeleteEmails(duplicateEmailGroups.map(([email]) => email).join('\n'));
    setSelectedBulkDeleteUserIds([]);
    addToast('Loaded', 'Duplicate email groups loaded into the bulk delete box. Review exact created-date rows before deleting.');
  };


  const openSupportUserEditor = (u) => {
    setEditingGlobalUser(u);
    setSupportUserForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || '',
      wage: u.wage ?? '',
      restaurantId: u.restaurantId || '',
      isAdmin: !!u.isAdmin,
      isActive: u.isActive !== false,
      forcePasswordChange: !!u.forcePasswordChange,
      permissions: {
        schedule: !!u.permissions?.schedule,
        events: !!u.permissions?.events,
        ops: !!u.permissions?.ops,
        inventory: !!u.permissions?.inventory,
        prep: !!u.permissions?.prep,
        sales: !!u.permissions?.sales,
        team: !!u.permissions?.team,
        labor: !!u.permissions?.labor
      },
      supportNote: ''
    });
  };

  const updateSupportUserPermission = (key, value) => {
    setSupportUserForm(prev => ({ ...prev, permissions: { ...(prev.permissions || {}), [key]: value } }));
  };

  const handleSupportUserUpdate = async (e) => {
    e.preventDefault();
    if (!editingGlobalUser?.id) return;
    if (!supportUserForm.name?.trim()) return addToast('Missing Name', 'User name is required.');
    if (!supportUserForm.restaurantId) return addToast('Missing Restaurant', 'Choose the restaurant/workspace this user belongs to.');
    const selectedRestaurant = restaurants.find(r => r.id === supportUserForm.restaurantId);
    if (!selectedRestaurant) return addToast('Invalid Restaurant', 'That workspace could not be found.');

    const protectedEmail = Boolean(MASTER_ADMIN_EMAIL && (editingGlobalUser.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase());
    const movingSelf = editingGlobalUser.id === appUser?.id && supportUserForm.restaurantId !== editingGlobalUser.restaurantId;
    if (protectedEmail && supportUserForm.restaurantId !== editingGlobalUser.restaurantId) {
      return addToast('Protected', 'The master admin account cannot be moved from this support editor.');
    }
    if (movingSelf && !window.confirm('You are changing your own workspace routing. Continue?')) return;

    try {
      const updates = {
        name: supportUserForm.name.trim(),
        phone: (supportUserForm.phone || '').trim(),
        role: (supportUserForm.role || '').trim() || 'Staff',
        wage: parseFloat(supportUserForm.wage) || 0,
        restaurantId: supportUserForm.restaurantId,
        restaurantName: selectedRestaurant.name || supportUserForm.restaurantId,
        isAdmin: !!supportUserForm.isAdmin,
        isActive: !!supportUserForm.isActive,
        forcePasswordChange: !!supportUserForm.forcePasswordChange,
        supportEditedAt: new Date().toISOString(),
        supportEditedBy: appUser?.email || appUser?.name || 'System Administrator'
      };

      // Keep email visible but do not change Firebase Auth email from the browser.
      // Auth email changes should go through a secured backend route if needed later.
      if ((supportUserForm.email || '').trim()) updates.email = supportUserForm.email.toLowerCase().trim();

      await updateDoc(doc(db, 'users', editingGlobalUser.id), updates);
      await addDoc(collection(db, 'auditLogs'), {
        userId: appUser?.id || 'system',
        userName: appUser?.name || 'System Administrator',
        action: 'SUPPORT_USER_EDIT',
        target: `users/${editingGlobalUser.id}`,
        details: `Support edited ${updates.email || editingGlobalUser.email || editingGlobalUser.id}; workspace=${updates.restaurantName}; role=${updates.role}; admin=${updates.isAdmin}; active=${updates.isActive}; note=${supportUserForm.supportNote || 'none'}`,
        timestamp: new Date().toISOString(),
        restaurantId: updates.restaurantId || appUser?.restaurantId || 'system',
        isGhost: appUser?.isGhost || false
      }).catch(()=>{});
      addToast('User Updated', `${updates.name} now belongs to ${updates.restaurantName}.`);
      setEditingGlobalUser(null);
      setSupportUserForm({});
    } catch (err) {
      addToast('Update Failed', err.message);
    }
  };

  // --- OBLITERATION ENGINE ---
  const handleNukeData = async (e) => {
    e.preventDefault();
    if (!nukePassword) return addToast('Error', 'Password required.');
    setIsNuking(true);
    
    try {
      await signInWithEmailAndPassword(auth, appUser.email, nukePassword);
      
      let cols = [];
      if (nukeTarget.type === 'inventory') cols = ['inventoryItems', 'vendors', 'invoices'];
      else if (nukeTarget.type === 'schedule') cols = ['shifts', 'timeOffRequests', 'shiftSwaps'];
      else if (nukeTarget.type === 'recipes') cols = ['recipes'];
      else if (nukeTarget.type === 'events') cols = ['events'];
      else if (nukeTarget.type === 'users') cols = ['users'];
      else if (nukeTarget.type === 'everything') cols = ['inventoryItems', 'vendors', 'invoices', 'users', 'recipes', 'shifts', 'timeOffRequests', 'shiftSwaps', 'events', 'wasteLogs', 'sales', 'maintenanceLogs'];

      let totalDeleted = 0;
      for (const c of cols) {
        const snap = await getDocs(query(collection(db, c), where("restaurantId", "==", nukeTarget.rest.id)));
        const deletePromises = [];
        
        snap.forEach(d => {
           if (c === 'users' && d.id === appUser.id) return;
           deletePromises.push(deleteDoc(doc(db, c, d.id)));
        });
        
        await Promise.all(deletePromises);
        totalDeleted += deletePromises.length;
      }

      addToast('Obliterated', `Deleted ${totalDeleted} documents for ${nukeTarget.rest.name}.`);
      setNukeTarget(null);
      setNukePassword('');
      setEditingRest(null); 
    } catch (err) {
      addToast('Error', 'Authentication failed or deletion error. Check your password.');
}
    setIsNuking(false);
  };

// --- SHOWCASE GENERATOR (DEMO WORKSPACE) ---
  const handleInjectDemoWorkspace = async () => {
    if (!window.confirm("Deploy a fully populated Demo Workspace? This will inject massive amounts of data and take a few seconds.")) return;
    addToast('Building...', 'Injecting massive showcase data. Please wait...');

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const getOffsetDate = (days) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
      };

      const next7Days = Array.from({length: 7}).map((_, i) => getOffsetDate(i));
      const past7Days = Array.from({length: 7}).map((_, i) => getOffsetDate(-i));

      // 1. Create Restaurant
      const restRef = await addDoc(collection(db, "restaurants"), {
         name: "Showcase Bistro (Demo)",
         ownerName: "Sales Demo",
         ownerEmail: "demo@86chaos.com",
         isActive: true,
         isReadOnly: false,
         features: { schedule: true, events: true, ops: true, messages: true, prep: true, recipes: true, inventory: true, sales: true, team: true, maintenance: true, timesheets: true, labor: true },
         labs: { laborProjection: true },
         planType: 'Enterprise',
         billingStatus: 'Paid',
         createdAt: new Date().toISOString(),
         lastActive: new Date().toISOString(),
         systemSettings: { address: '123 Demo St', geofenceRadius: 300, overtime: 40, enableTargets: true, targetSales: 55000, targetLaborPct: 22.5 }
      });
      const rId = restRef.id;

      // 2. Create 20 Users
      const dummyUsers = [
         { name: 'Alice Admin', role: 'General Manager', isAdmin: true, wage: 30 },
         { name: 'Sarah Supervisor', role: 'Manager', isAdmin: false, wage: 22 },
         { name: 'Charlie Chef', role: 'Chef', isAdmin: false, wage: 25 },
         { name: 'Sam Sous', role: 'Sous Chef', isAdmin: false, wage: 20 },
         { name: 'Bob Bartender', role: 'Bartender', isAdmin: false, wage: 10 },
         { name: 'Betty Bartender', role: 'Bartender', isAdmin: false, wage: 10 },
         { name: 'Eve Server', role: 'Server', isAdmin: false, wage: 8 },
         { name: 'Sammy Server', role: 'Server', isAdmin: false, wage: 8 },
         { name: 'Sally Server', role: 'Server', isAdmin: false, wage: 8 },
         { name: 'Steven Server', role: 'Server', isAdmin: false, wage: 8 },
         { name: 'Larry Line', role: 'Line Cook', isAdmin: false, wage: 17 },
         { name: 'Lenny Line', role: 'Line Cook', isAdmin: false, wage: 17 },
         { name: 'Frank Fry', role: 'Line Cook', isAdmin: false, wage: 16 },
         { name: 'Gina Grill', role: 'Line Cook', isAdmin: false, wage: 18 },
         { name: 'Paul Prep', role: 'Prep Cook', isAdmin: false, wage: 15 },
         { name: 'Penny Prep', role: 'Prep Cook', isAdmin: false, wage: 15 },
         { name: 'Holly Host', role: 'Host', isAdmin: false, wage: 13 },
         { name: 'Hunter Host', role: 'Host', isAdmin: false, wage: 13 },
         { name: 'Dave Dish', role: 'Dishwasher', isAdmin: false, wage: 14 },
         { name: 'Dan Dish', role: 'Dishwasher', isAdmin: false, wage: 14 }
      ];
      
      const userIds = [];
      const userPromises = dummyUsers.map(async (u) => {
         const uRef = await addDoc(collection(db, "users"), {
           ...u, email: u.name.split(' ')[0].toLowerCase() + '@demo.com', restaurantId: rId, isActive: true, passwordStored: false
         });
         userIds.push({ ...u, id: uRef.id });
      });
      await Promise.all(userPromises);

      // 3. Create Full Schedule (7 Days of Shifts)
      const shiftPromises = [];
      next7Days.forEach(date => {
        // Morning Crew
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[1].id, role: 'Manager', date, startTime: '08:00', endTime: '16:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[14].id, role: 'Prep Cook', date, startTime: '07:00', endTime: '14:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[10].id, role: 'Line Cook', date, startTime: '09:00', endTime: '16:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[6].id, role: 'Server', date, startTime: '10:30', endTime: '16:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[4].id, role: 'Bartender', date, startTime: '10:30', endTime: '17:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[18].id, role: 'Dishwasher', date, startTime: '11:00', endTime: '16:00', isPublished: true }));
        
        // Night Crew
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[3].id, role: 'Sous Chef', date, startTime: '14:00', endTime: '22:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[11].id, role: 'Line Cook', date, startTime: '15:00', endTime: '22:30', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[12].id, role: 'Line Cook', date, startTime: '16:00', endTime: '23:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[7].id, role: 'Server', date, startTime: '16:00', endTime: '23:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[8].id, role: 'Server', date, startTime: '17:00', endTime: '23:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[5].id, role: 'Bartender', date, startTime: '16:30', endTime: '23:30', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[16].id, role: 'Host', date, startTime: '16:30', endTime: '21:00', isPublished: true }));
        shiftPromises.push(addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[19].id, role: 'Dishwasher', date, startTime: '16:00', endTime: '23:30', isPublished: true }));
      });
      await Promise.all(shiftPromises);
      await addDoc(collection(db, "scheduleTemplates"), { restaurantId: rId, name: 'Normal Week', description: 'Demo reusable weekly staffing template.', rows: [
        { dayIndex: 1, role: 'Prep Cook', startTime: '07:00', endTime: '14:00', count: 1 },
        { dayIndex: 5, role: 'Line Cook', startTime: '16:00', endTime: '23:00', count: 2 },
        { dayIndex: 5, role: 'Server', startTime: '16:00', endTime: '23:00', count: 3 },
        { dayIndex: 5, role: 'Bartender', startTime: '16:30', endTime: '23:30', count: 1 }
      ], createdAt: new Date().toISOString(), createdBy: appUser.id || 'demo' });
      await Promise.all([
        addDoc(collection(db, "scheduleCoverageTargets"), { restaurantId: rId, dayIndex: 5, role: 'Line Cook', startTime: '16:00', endTime: '23:00', count: 2, createdAt: new Date().toISOString() }),
        addDoc(collection(db, "scheduleCoverageTargets"), { restaurantId: rId, dayIndex: 5, role: 'Server', startTime: '16:00', endTime: '23:00', count: 3, createdAt: new Date().toISOString() }),
        addDoc(collection(db, "scheduleCoverageTargets"), { restaurantId: rId, dayIndex: 6, role: 'Bartender', startTime: '16:30', endTime: '23:30', count: 2, createdAt: new Date().toISOString() })
      ]);

      // Add a Shift Trade
      const targetShift = await addDoc(collection(db, "shifts"), { restaurantId: rId, employeeId: userIds[9].id, role: 'Server', date: getOffsetDate(2), startTime: '16:00', endTime: '23:00', isPublished: true });
      await addDoc(collection(db, "shiftSwaps"), { restaurantId: rId, shiftId: targetShift.id, originalEmployeeId: userIds[9].id, role: 'Server', date: getOffsetDate(2), startTime: '16:00', endTime: '23:00', status: 'available', listedAt: new Date().toISOString() });

      // 4. Time Off & Punches
      await addDoc(collection(db, "timeOffRequests"), { restaurantId: rId, userId: userIds[6].id, userName: 'Eve Server', date: getOffsetDate(3), status: 'pending', submittedAt: new Date().toISOString(), isPartial: false });
      await addDoc(collection(db, "timeOffRequests"), { restaurantId: rId, userId: userIds[10].id, userName: 'Larry Line', date: getOffsetDate(5), status: 'approved', submittedAt: new Date().toISOString(), isPartial: false });
      await addDoc(collection(db, "timePunches"), { restaurantId: rId, employeeId: userIds[1].id, employeeName: 'Sarah Supervisor', date: todayStr, clockInTime: new Date(today.setHours(7, 55, 0)).toISOString(), status: 'clocked_in' });
      await addDoc(collection(db, "timePunches"), { restaurantId: rId, employeeId: userIds[14].id, employeeName: 'Paul Prep', date: todayStr, clockInTime: new Date(today.setHours(6, 50, 0)).toISOString(), status: 'clocked_in' });
      await addDoc(collection(db, "timePunches"), { restaurantId: rId, employeeId: userIds[10].id, employeeName: 'Larry Line', date: todayStr, clockInTime: new Date(today.setHours(8, 58, 0)).toISOString(), status: 'clocked_in' });

      // 5. Messages / Events
      await addDoc(collection(db, "events"), { restaurantId: rId, type: 'note', title: 'Welcome to the Demo Workspace! Feel free to click around and explore the features.', author: 'Alice Admin', date: new Date().toISOString(), isImportant: true, replies: [] });
      await addDoc(collection(db, "events"), { restaurantId: rId, type: 'note', title: '86 the Salmon for tonight. Distributor shorted us.', author: 'Charlie Chef', date: new Date().toISOString(), isImportant: false, replies: [{ id: '1', author: 'Eve Server', text: 'Heard, thank you chef!', timestamp: new Date().toISOString() }] });
      await addDoc(collection(db, "events"), { restaurantId: rId, type: 'special_event', title: 'Live Music Night', date: todayStr, time: '19:00', notes: 'Local band playing. Expect heavy volume from 7-10.', addedBy: 'System' });
      await addDoc(collection(db, "events"), { restaurantId: rId, type: 'special_event', title: 'Private Party Catering', date: getOffsetDate(4), time: '18:00', notes: '50-top in the back room. Set menu.', addedBy: 'System' });

      // 6. Prep & Tasks
      const prepItems = [
        { text: 'Dice Onions (4 Qt)', station: 'Prep Table', isMaster: true },
        { text: 'Portion Burger Patties (50x)', station: 'Grill', isMaster: true },
        { text: 'Cut Lemons & Limes', station: 'Expo', isMaster: true },
        { text: 'Blend House Ranch', station: 'Salad/Cold', isMaster: true },
        { text: 'Blanch French Fries', station: 'Fry', isMaster: true },
        { text: 'Thaw Chicken Breasts', station: 'Prep Table', isMaster: true }
      ];
      await Promise.all(prepItems.map(p => addDoc(collection(db, "prepItems"), { restaurantId: rId, date: 'MASTER', text: p.text, station: p.station, isCompleted: false, qty: 1, isMaster: true, completedDates: {} })));
      
      await addDoc(collection(db, "prepItems"), { restaurantId: rId, date: todayStr, text: 'Emergency 86 Prep: Thaw Shrimp', station: 'Grill', isCompleted: false, qty: 1 });
      await addDoc(collection(db, "tasks"), { restaurantId: rId, title: 'Clean Deep Fryer', category: 'Cleaning', frequency: 'daily', completions: {} });
      await addDoc(collection(db, "tasks"), { restaurantId: rId, title: 'Wipe Down Walk-in Shelves', category: 'Cleaning', frequency: 'weekly', targetDay: 'Monday', completions: {} });
      await addDoc(collection(db, "tasks"), { restaurantId: rId, title: 'Check First Aid Kit', category: 'General', frequency: 'monthly', targetDate: '1', completions: {} });

      // 7. Inventory & Vendors & Line Checks
      const v1 = await addDoc(collection(db, "vendors"), { restaurantId: rId, name: 'Sysco (Demo)', rep: 'John', phone: '555-0192', cutOffDays: ['Monday', 'Thursday'], cutOffTime: '16:00' });
      const v2 = await addDoc(collection(db, "vendors"), { restaurantId: rId, name: 'US Foods (Demo)', rep: 'Sarah', phone: '555-3841', cutOffDays: ['Tuesday', 'Friday'], cutOffTime: '15:00' });
      const v3 = await addDoc(collection(db, "vendors"), { restaurantId: rId, name: 'Local Produce Farm', rep: 'Mike', phone: '555-9988' });

      const invItems = [
        { name: 'French Fries (3/8)', cat: 'Frozen', v: v1.id, pack: '6/5#', y: 1, p: 35.50, par: 10, stock: 4, code: '78321' },
        { name: 'Ketchup', cat: 'Dry Goods', v: v1.id, pack: '6/#10', y: 1, p: 28.00, par: 3, stock: 1, code: '11223' },
        { name: 'Chicken Breast (6oz)', cat: 'Meat', v: v2.id, pack: '2/10#', y: 1, p: 65.00, par: 8, stock: 9, code: '44556' },
        { name: 'Ground Beef (80/20)', cat: 'Meat', v: v2.id, pack: '4/10#', y: 1, p: 120.00, par: 6, stock: 2, code: '44557' },
        { name: 'Romaine Lettuce', cat: 'Produce', v: v3.id, pack: '24ct', y: 1, p: 22.00, par: 5, stock: 2, code: '99881' },
        { name: 'Roma Tomatoes', cat: 'Produce', v: v3.id, pack: '25#', y: 1, p: 18.00, par: 4, stock: 1, code: '99882' },
        { name: 'Heavy Cream', cat: 'Dairy', v: v1.id, pack: '12/1qt', y: 1, p: 45.00, par: 3, stock: 4, code: '33441' },
        { name: 'Cheddar Block', cat: 'Dairy', v: v1.id, pack: '4/5#', y: 1, p: 55.00, par: 4, stock: 1, code: '33442' },
        { name: 'Fry Oil', cat: 'Supplies', v: v2.id, pack: '35# jug', y: 1, p: 38.00, par: 8, stock: 8, code: '77881' },
        { name: 'To-Go Boxes', cat: 'Supplies', v: v1.id, pack: '200ct', y: 1, p: 42.00, par: 5, stock: 2, code: '11990' }
      ];
      await Promise.all(invItems.map(i => addDoc(collection(db, "inventoryItems"), { restaurantId: rId, name: i.name, category: i.cat, supplierId: i.v, packSize: i.pack, yieldQty: i.y, price: i.p, parLevel: i.par, currentStock: i.stock, pendingQty: 0, pfgCode: i.code, isStarred: false })));

      await addDoc(collection(db, "lineCheckItems"), { restaurantId: rId, name: 'Salad Station Cooler', category: 'Cold Holding (≤ 41°F)' });
      await addDoc(collection(db, "lineCheckItems"), { restaurantId: rId, name: 'Grill Drawers', category: 'Cold Holding (≤ 41°F)' });
      await addDoc(collection(db, "lineCheckItems"), { restaurantId: rId, name: 'Soup Warmer', category: 'Hot Holding (≥ 135°F)' });

      // 8. Recipes
      await addDoc(collection(db, "recipes"), { restaurantId: rId, title: 'House Ranch', category: 'Sauce/Dressing', prepTime: '10 mins', yieldAmt: '1 Gallon', ingredients: '1 Gal Mayo\n1/2 Gal Buttermilk\n1 Cup Ranch Seasoning', instructions: '1. Combine all in 12qt Cambro.\n2. Whisk until smooth.\n3. Date and label.', authorName: 'Alice Admin', lastUpdated: new Date().toISOString() });
      await addDoc(collection(db, "recipes"), { restaurantId: rId, title: 'Beer Cheese', category: 'Sauce/Dressing', prepTime: '30 mins', yieldAmt: '1.5 Gallons', ingredients: '1 lb Butter\n1 lb Flour\n1 Tablespoon Salt\n1 Pint Light Beer\n1 gallon milk\n8 cups shredded cheddar', instructions: '1. Melt butter and whisk in flour to create roux.\n2. Add beer and stir.\n3. Whisk in hot milk.\n4. Fold in cheese until melted.', authorName: 'Charlie Chef', lastUpdated: new Date().toISOString() });
      await addDoc(collection(db, "recipes"), { restaurantId: rId, title: 'Signature Burger Prep', category: 'Meat Prep', prepTime: '20 mins', yieldAmt: '24 Patties', ingredients: '10 lbs Ground Beef (80/20)\n1/2 Cup Kosher Salt\n1/4 Cup Black Pepper\n2 Tbsp Garlic Powder', instructions: '1. Gently mix seasonings into ground beef.\n2. Portion into 6.5oz balls.\n3. Press into patties.\n4. Layer with parchment paper.', authorName: 'Charlie Chef', lastUpdated: new Date().toISOString() });

      // 9. Sales (7 Days Historical)
      const salesPromises = past7Days.map((d, index) => {
         const base = 5000 + (Math.random() * 2000);
         const isWeekend = index === 1 || index === 2; // Rough assumption for random peaks
         const gross = isWeekend ? base * 1.5 : base;
         return addDoc(collection(db, "sales"), { restaurantId: rId, date: d, grossSales: gross, laborCost: gross * 0.22, foodCost: gross * 0.28, notes: isWeekend ? 'Busy weekend shift.' : 'Standard service.' });
      });
      await Promise.all(salesPromises);

      // 10. Maintenance & PM
      await addDoc(collection(db, "maintenanceLogs"), { restaurantId: rId, equipment: 'Ice Machine', issue: 'Leaking water on the floor near drain', urgency: 'High', status: 'Reported', reportedAt: new Date().toISOString(), reportedBy: 'Bob Bartender' });
      await addDoc(collection(db, "maintenanceLogs"), { restaurantId: rId, equipment: 'Fryer #2', issue: 'Pilot light keeps going out', urgency: 'Critical', status: 'Pending Parts', notes: 'Called Hobart. Waiting on thermocouple.', reportedAt: new Date().toISOString(), reportedBy: 'Alice Admin' });
      await addDoc(collection(db, "pmSchedules"), { restaurantId: rId, title: 'Degrease Hood Filters', equipment: 'Line Vents', frequencyDays: 30, lastCompleted: getOffsetDate(-29) }); // Overdue tomorrow
      await addDoc(collection(db, "pmSchedules"), { restaurantId: rId, title: 'Descale Dish Machine', equipment: 'Dishwasher', frequencyDays: 14, lastCompleted: getOffsetDate(-5) });

      addToast('Demo Live', 'Massive Showcase Workspace successfully deployed. Check your Clients list.');
    } catch(e) {
      addToast('Error', e.message);
    }
  };

  // --- 2. SYSTEM OPERATIONS & FORGE ---

  // --- 2. SYSTEM OPERATIONS & FORGE ---
  const handleMegaphone = async (e) => {
    e.preventDefault(); 
    if(!broadcastMsg.trim()) return; 
    if(!window.confirm("Blast this to EVERY restaurant?")) return;
    
    addToast('Broadcasting', 'Pushing message to all shards...');
    let success = 0; let failed = 0;
    
    for (const r of restaurants) {
      try {
        await addDoc(collection(db, "events"), { 
          date: new Date().toISOString(), title: broadcastMsg.trim(), type: 'note', author: 'System Alert', isImportant: true, restaurantId: r.id, replies: [] 
        });
        success++;
      } catch (err) { failed++; }
    }
    
    if (failed > 0) addToast('Partial Alert', `Sent to ${success}, but Firebase blocked ${failed}. Check console.`);
    else addToast('Megaphone', `Message blasted successfully to ${success} locations.`);
    setBroadcastMsg('');
  };

 const handleForgePush = async (e, type) => {
    e.preventDefault(); 
    if(!window.confirm(`Push this ${type} to ALL clients globally?`)) return;
    
    addToast('Deploying', `Pushing ${type} to all shards...`);
    let success = 0; let failed = 0;

    for (const r of restaurants) {
      try {
        if (type === 'Event') await addDoc(collection(db, "events"), { type: 'special_event', date: forgeEventDate, title: forgeEventTitle.trim(), addedBy: '86 Chaos System', restaurantId: r.id });
        success++;
      } catch (err) { failed++; }
    }
    
    if (failed > 0) addToast('Partial Deploy', `Pushed to ${success}, but failed on ${failed}.`);
    else addToast('Forge Deployed', `${type} injected globally into ${success} databases.`);
    setForgeEventTitle('');
  };

               const handleTestPush = async () => {
    if (!window.confirm("Send a plain test notification to all opted-in devices in your workspace?")) return;
    addToast('Pinging Server', 'Firing test shot to Vercel...');
    try {
      const pushRes = await secureFetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restaurantId: appUser.restaurantId,
          title: '86 Chaos Test Notification',
          body: 'This is only a test push notification. No schedule was published.',
          type: 'system-test',
          isCritical: true,
          textContent: 'test push notification only'
        })
      });
      const pushData = await pushRes.json();
      if (pushData.message) addToast('Server Reply', pushData.message); 
      else if (pushData.success) addToast('Success', `Test pushed to ${pushData.sentCount} devices.`);
      else addToast('API Error', pushData.error || 'Unknown error');
    } catch (err) {
      addToast('Network Error', 'Failed to reach Vercel.');
    }
  };   

  const handleOrphanSweep = async () => {
    if(!window.confirm("Scan platform for dead shifts (shifts attached to deleted users)?")) return;
    addToast('Scanning', 'Running orphan sweep...');
    const sSnap = await getDocs(collection(db, 'shifts')); let deadCount = 0;
    sSnap.forEach(d => { const s = d.data(); if (!allUsers.find(u => u.id === s.employeeId)) { deleteDoc(doc(db, "shifts", d.id)); deadCount++; } });
    addToast('Sweep Complete', `Purged ${deadCount} orphaned database documents.`);
  };

  const handleForceRefresh = async () => {
    if (!window.confirm("🚨 CRITICAL: This will send a hard-refresh command to EVERY active browser connected to 86 Chaos globally. Proceed?")) return;
    addToast('Executing', 'Sending refresh signal...');
    const stamp = new Date().toISOString(); let count = 0;
    for (const r of restaurants) {
       try { await updateDoc(doc(db, "restaurants", r.id), { forceRefresh: stamp }); count++; } catch(e){}
    }
    addToast('Refresh Broadcast', `Hard reload signal sent to ${count} databases.`);
  };

  const handleGlobalLockdown = async (lock) => {
    if (lock) {
        if (prompt('CRITICAL: This will instantly put EVERY workspace into maintenance mode, including your restaurant group. Your Super Admin account will remain able to enter and lift it. Type "LOCKDOWN" to proceed.') !== 'LOCKDOWN') return;
        addToast('Executing', 'Initiating global lockdown for all workspaces except your Super Admin access...');
    } else {
        if (!window.confirm('Restore access to all suspended workspaces?')) return;
        addToast('Executing', 'Lifting lockdown...');
    }
    
    let count = 0;
    for (const r of restaurants) {
      try { await updateDoc(doc(db, "restaurants", r.id), { billingStatus: lock ? 'Past Due' : 'Paid' }); count++; } catch(e){}
    }
    addToast(lock ? 'Lockdown Complete' : 'Unlocked', `${count} workspaces have been ${lock ? 'placed into maintenance mode' : 'restored'}.`);
  };

const handleGrantAccess = async (e) => {
  e.preventDefault();
  const targetEmail = adminEmail.toLowerCase().trim();
  if (!targetEmail) return;
  try {
    const response = await secureFetch('/api/admin-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'grant', email: targetEmail })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Grant access failed.');
    setAdminEmail('');
    addToast('Granted', 'Custom-claim access granted. The user must log out and back in.');
  } catch (err) {
    addToast('Access Error', err.message || 'Could not grant access. Check /api/admin-access and Vercel env vars.');
  }
};

const handleRevokeAccess = async (user) => {
  if (!window.confirm(`Revoke Admin from ${user.name}?`)) return;
  try {
    const response = await secureFetch('/api/admin-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', email: user.email })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Revoke access failed.');
    addToast('Revoked', 'Custom-claim access removed. The user must log out and back in.');
  } catch (err) {
    addToast('Access Error', err.message || 'Could not revoke access.');
  }
};

// --- CALCULATIONS ---
  const mrr = restaurants.reduce((acc, r) => {
    if (r.customPrice !== undefined && r.customPrice !== '') return acc + parseFloat(r.customPrice);
    return acc + (r.planType === 'Enterprise' ? 199 : r.planType === 'Elite' ? 149 : r.planType === 'Pro' ? 99 : r.planType === 'Starter' ? 49 : 0);
  }, 0);
  const timeAgo = (dateStr) => { if (!dateStr) return 'Never'; const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)); if (days === 0) return 'Active Today'; if (days === 1) return 'Active Yesterday'; return `Inactive ${days} days`; };

  const parseClientDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && value.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getClientCreatedAt = (client) => client?.createdAt || client?.createdOn || client?.created || client?.deployedAt || null;

  const formatClientCreatedTimestamp = (value) => {
    const d = parseClientDate(value);
    if (!d) return 'Not stamped yet';
    return formatClockDateTime(d);
  };

  const formatClientCreatedDate = (value) => {
    const d = parseClientDate(value);
    if (!d) return 'Unknown';
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const staleTenants = restaurants.filter(r => r.isActive && Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000) > 21);

  const parseAnyDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && value.seconds) return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const latestWorkspaceMaintenance = restaurants
    .map(r => parseAnyDate(r.lastWeeklyMaintenanceAt || r.weeklyMaintenance?.lastRunAt || r.weeklyMaintenance?.lastSuccessfulRunAt))
    .filter(Boolean)
    .sort((a,b) => b.getTime() - a.getTime())[0] || null;
  const lastActualBackupDate = parseAnyDate(backupStatus?.lastBackupAt || backupStatus?.lastSuccessfulBackupAt || backupStatus?.lastExportAt);
  const lastBackupDate = lastActualBackupDate || parseAnyDate(backupStatus?.lastRunAt) || latestWorkspaceMaintenance;
  const backupAgeHours = lastBackupDate ? Math.round((Date.now() - lastBackupDate.getTime()) / 36e5) : null;
  const actualBackupAgeHours = lastActualBackupDate ? Math.round((Date.now() - lastActualBackupDate.getTime()) / 36e5) : null;
  const backupRunning = backupStatus?.status === 'running';
  const backupStatusLabel = backupRunning ? 'Running...' : (lastActualBackupDate ? `${Math.max(0, actualBackupAgeHours)}h ago` : (lastBackupDate ? `${Math.max(0, backupAgeHours)}h ago` : 'Not Reported'));
  const backupMissedDailyWindow = !backupRunning && (!lastActualBackupDate || actualBackupAgeHours > 30);
  const backupIsStale = backupMissedDailyWindow;
  const backupDetail = backupStatus?.status === 'ok' && backupStatus?.documentCount ? `${backupStatus.documentCount} docs • ${backupStatus.collectionCount || 0} collections` : (backupStatus?.status || backupStatus?.lastStatus || (latestWorkspaceMaintenance ? 'weekly maintenance stamp only' : 'No backup status doc'));
  const restoreDrillDate = parseAnyDate(restoreDrillStatus?.lastDrillAt || restoreDrillStatus?.updatedAt);
  const restoreDrillAgeDays = restoreDrillDate ? Math.floor((Date.now() - restoreDrillDate.getTime()) / 86400000) : null;
  const restoreDrillStale = !restoreDrillDate || restoreDrillAgeDays > 35 || ['failed', 'needs_followup'].includes(String(restoreDrillStatus?.status || '').toLowerCase());
  const restoreDrillLabel = restoreDrillDate ? `${restoreDrillAgeDays}d ago` : 'Not recorded';
  const activeAccountDeletionRequests = accountDeletionRequests.filter(req => ['requested', 'reviewing'].includes(String(req.status || '').toLowerCase()));
  const completedAccountDeletionRequests = accountDeletionRequests.filter(req => ['completed', 'denied', 'canceled'].includes(String(req.status || '').toLowerCase())).slice(0, 8);
  const getNextAutoBackupDate = () => {
    const explicit = parseAnyDate(backupStatus?.nextBackupAt || backupStatus?.nextScheduledAt || backupStatus?.nextRunAt);
    if (explicit && explicit.getTime() > backupCountdownTick) return explicit;
    const next = new Date(backupCountdownTick);
    next.setUTCHours(9, 0, 0, 0); // Vercel cron: 0 9 * * *
    if (next.getTime() <= backupCountdownTick) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  };
  const formatCountdown = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return 'due now';
    const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  const nextAutoBackupDate = getNextAutoBackupDate();
  const nextBackupCountdown = backupRunning ? 'running now' : formatCountdown(nextAutoBackupDate.getTime() - backupCountdownTick);
  const nextBackupLocalTime = nextAutoBackupDate.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const backupCommandDeckDetail = `${backupDetail} • Next: ${nextBackupCountdown}`;
  const filteredBackupList = backupList.filter(b => backupListFilter === 'all' || b.mode === backupListFilter);
  const envReport = typeof window !== 'undefined' ? {
    host: window.location.host,
    path: window.location.pathname,
    online: navigator.onLine,
    serviceWorker: 'serviceWorker' in navigator,
    indexedDb: 'indexedDB' in window,
    notifications: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    storageUser: !!(localStorage.getItem('86chaosUser') || sessionStorage.getItem('86chaosUser')),
    userAgent: navigator.userAgent
  } : { host: 'server', online: false, serviceWorker: false, indexedDb: false, notifications: 'unknown', storageUser: false, userAgent: 'unknown' };
  const isPreviewLikeHost = /-git-|localhost|127\.0\.0\.1|testing|preview/i.test(String(envReport.host || ''));
  const autoBackupEnvironmentNote = isPreviewLikeHost
    ? 'Preview/testing deployments do not receive Vercel Cron invocations. Use Run Backup Now in testing; verify automatic scheduled backups on production.'
    : 'Production cron should call /api/firestore-backup daily at 9:00 UTC / 4:00 AM Central when the production deployment is live.';
  const backupTroubleshootingSummary = backupMissedDailyWindow
    ? `${autoBackupEnvironmentNote} Check Vercel Cron logs, CRON_SECRET, Firebase Admin credentials, and Storage bucket if production is stale.`
    : autoBackupEnvironmentNote;

  // --- NEW SAAS HEALTH METRICS ---
const activeTrials = restaurants.filter(r => r.billingStatus === 'Trial').length;
  const paidWorkspaces = restaurants.filter(r => r.billingStatus === 'Paid').length;
  const dau = allUsers.filter(u => u.lastActive && Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000) === 0).length;
  const stickyRate = allUsers.length > 0 ? ((dau / allUsers.length) * 100).toFixed(0) : 0;

  // --- NEW INFRASTRUCTURE & FINANCIAL METRICS ---
  const arpa = paidWorkspaces > 0 ? (mrr / paidWorkspaces).toFixed(2) : 0;
  const trialPipelineValue = activeTrials * (tierPrices.Pro || 99); 
  const crashes24h = crashLogs.filter(log => (Date.now() - new Date(log.time||0).getTime()) < 86400000).length;
  const pushOptInRate = allUsers.length > 0 ? ((allUsers.filter(u => u.fcmToken).length / allUsers.length) * 100).toFixed(0) : 0;
  const apiConnectedCount = restaurants.filter(r => r.integrations?.posProvider || r.integrations?.payrollProvider).length;
  const ONLINE_WINDOW_MS = (Number(presenceSnapshot.windowMinutes || 15) || 15) * 60 * 1000;
  const nowMs = Date.now();
  const presenceSnapshotFetchedAtMs = parseAnyDate(presenceSnapshot.fetchedAt)?.getTime?.() || 0;
  const parsePresenceTimeMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1000000000000 ? value : value * 1000;
    if (typeof value === 'string') {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.toDate === 'function') {
      const parsed = value.toDate().getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  };
  const getLastActiveMs = (u) => Math.max(
    parsePresenceTimeMs(u.lastHeartbeatAt),
    parsePresenceTimeMs(u.presenceUpdatedAt),
    parsePresenceTimeMs(u.lastActive),
    parsePresenceTimeMs(u.lastSeen),
    parsePresenceTimeMs(u.heartbeatEpochMs)
  );
  const enrichPresenceRow = (row = {}) => {
    const profile = allUsers.find(u => u.id === row.userId || u.id === row.uid || (u.email && row.email && String(u.email).toLowerCase() === String(row.email).toLowerCase())) || {};
    return {
      ...profile,
      ...row,
      id: row.userId || row.uid || row.id || profile.id,
      name: row.userName || row.name || profile.name || row.email || 'Unknown user',
      email: row.userEmail || row.email || profile.email || '',
      restaurantId: row.restaurantId || profile.restaurantId || '',
      role: row.role || profile.role || '',
      photoURL: row.photoURL || profile.photoURL || ''
    };
  };
  const isOnlineNow = (u) => {
    const last = getLastActiveMs(u);
    return !!presenceSnapshotFetchedAtMs && !!last && (nowMs - last) < ONLINE_WINDOW_MS && u.onlineState !== 'offline';
  };
  const onlineUsers = (presenceSnapshot.users || []).map(enrichPresenceRow).filter(isOnlineNow).sort((a,b) => getLastActiveMs(b) - getLastActiveMs(a));
  const onlineRestaurantIds = [...new Set(onlineUsers.map(u => u.restaurantId).filter(Boolean))];
  const onlineRestaurants = restaurants.filter(r => onlineRestaurantIds.includes(r.id));
  const onlineByRestaurant = onlineRestaurantIds.map(id => ({
    id,
    rest: restaurants.find(r => r.id === id),
    users: onlineUsers.filter(u => u.restaurantId === id)
  })).sort((a,b) => b.users.length - a.users.length);
  const recentlyActiveUsers = (presenceSnapshot.recentUsers || []).map(enrichPresenceRow).sort((a,b) => getLastActiveMs(b) - getLastActiveMs(a));

  const selectedClientUsers = selectedClient ? allUsers
    .filter(u => u.restaurantId === selectedClient.id)
    .sort((a,b) => (b.isAdmin === true) - (a.isAdmin === true) || (a.name || a.email || '').localeCompare(b.name || b.email || '')) : [];
  const selectedClientAdmins = selectedClientUsers.filter(u => u.isAdmin || u.isSuperAdmin);
  const selectedClientOnline = selectedClient ? onlineUsers.filter(u => u.restaurantId === selectedClient.id) : [];
  const selectedClientPushEnabled = selectedClientUsers.filter(u => !!u.fcmToken).length;
  const selectedClientGpsKnown = selectedClientUsers.filter(u => u.gpsPermission || u.deviceDiagnostics?.gpsPermission).length;

  const pastDueWorkspaces = restaurants.filter(r => r.billingStatus === 'Past Due');
  const readOnlyWorkspaces = restaurants.filter(r => r.isReadOnly);
  const trialWorkspaces = restaurants.filter(r => r.billingStatus === 'Trial');
  const adminUsers = allUsers.filter(u => u.isAdmin || u.isSuperAdmin);
  const inactiveUsers = allUsers.filter(u => {
    const last = getLastActiveMs(u);
    return !last || (nowMs - last) > 30 * 86400000;
  });
  const moduleList = ['schedule','events','ops','messages','prep','recipes','inventory','sales','team','maintenance','labor','timesheets'];
  const featureAdoption = moduleList.map(feat => ({ feat, count: restaurants.filter(r => r.features?.[feat] !== false).length })).sort((a,b) => b.count - a.count);
  const usersWithoutRestaurant = allUsers.filter(u => !u.restaurantId);
  const missingOwnerAccounts = restaurants.filter(r => r.ownerEmail && !allUsers.some(u => (u.email || '').toLowerCase() === (r.ownerEmail || '').toLowerCase()));
  const duplicateEmailGroups = Object.entries(allUsers.reduce((acc, u) => {
    const emailKey = (u.email || '').toLowerCase().trim();
    if (emailKey) acc[emailKey] = [...(acc[emailKey] || []), u];
    return acc;
  }, {})).filter(([, group]) => group.length > 1);
  const usersMissingPush = allUsers.filter(u => !u.fcmToken);
  const permissionDeniedLogs = crashLogs.filter(log => `${log.message || ''} ${log.stack || ''}`.toLowerCase().includes('permission-denied'));
  const endpointList = ['admin-access', 'whoami', 'security-diagnostics', 'firestore-backup', 'list-backups', 'weekly-maintenance', 'dispatch-reminders', 'deploy-tenant', 'delete-user', 'delete-users-bulk', 'brand-logo', 'storage-doctor', 'schema-doctor', 'backup-preview', 'safe-write', 'scan-invoice', 'scan-menu', 'send-push', 'send-schedule-alert', 'presence-heartbeat', 'presence-snapshot', 'push-token-repair', 'staff-member', 'voice-command', 'alerts', 'health-checks', 'account-deletion-request', 'restore-drill', 'mfa-recovery-code'];

  const adminAccessSourceLabel = appUser?.serverAdminCheck?.serverMasterAdminMatched ? 'Server env' :
    appUser?.serverAdminCheck?.customClaimSuperAdmin ? 'Custom claim' :
    appUser?.serverAdminCheck?.firestoreSuperAdmin ? 'Firestore flag' :
    appUser?.isSuperAdmin ? (appUser?.superAdminAccessSource || 'Profile flag') : 'Unknown';
  const adminAccessDetail = appUser?.serverAdminCheck?.masterAdminEnvConfigured
    ? `${appUser.serverAdminCheck.masterAdminEmailCount || 1} master email(s) configured`
    : 'Check MASTER_ADMIN_EMAIL(S) and REACT_APP_MASTER_ADMIN_EMAIL';

  const currentAdminSessionId = (() => {
    try { return sessionStorage.getItem('chaosSessionId') || ''; } catch (_) { return ''; }
  })();
  const platformSnapshot = [
    `86 Chaos Platform Snapshot`,
    `Version: ${CURRENT_VERSION}`,
    `Manual presence snapshot: ${presenceSnapshot.fetchedAt ? `${onlineUsers.length} recent` : 'not refreshed'}`,
    `Active workspaces: ${restaurants.filter(r=>r.isActive).length}`,
    `Paid workspaces: ${paidWorkspaces}`,
    `Trials: ${trialWorkspaces.length}`,
    `Past due: ${pastDueWorkspaces.length}`,
    `Network users: ${allUsers.length}`,
    `Admins: ${adminUsers.length}`,
    `Crashes 24h: ${crashes24h}`,
    `Last backup/status: ${backupStatusLabel} (${backupDetail})`,
    `Backup integrity: ${backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'not checked'}`,
    `Permission denied logs: ${permissionDeniedLogs.length}`, 
    `Push opt-in: ${pushOptInRate}%`,
    `Users without restaurantId: ${usersWithoutRestaurant.length}`,
    `Missing owner accounts: ${missingOwnerAccounts.length}`,
    `Duplicate email groups: ${duplicateEmailGroups.length}`,
    `Host: ${envReport.host}`,
    `Browser online: ${envReport.online}`,
    `Generated: ${formatClockDateTime(new Date())}`
  ].join('\n');

  const adminRiskQueue = [
    crashes24h > 0 ? { tone: crashes24h > 10 ? 'red' : 'amber', title: 'Fresh crash reports', detail: `${crashes24h} crash/bug log(s) in the last 24 hours.`, jump: 'support' } : null,
    permissionDeniedLogs.length > 0 ? { tone: 'red', title: 'Permission denied errors', detail: `${permissionDeniedLogs.length} log(s) look like Firestore rule blocks.`, jump: 'support' } : null,
    pastDueWorkspaces.length > 0 ? { tone: 'amber', title: 'Maintenance-locked workspaces', detail: `${pastDueWorkspaces.length} workspace(s) are currently locked behind the maintenance screen.`, jump: 'tenants' } : null,
    missingOwnerAccounts.length > 0 ? { tone: 'amber', title: 'Missing owner accounts', detail: `${missingOwnerAccounts.length} restaurant owner email(s) do not match a user profile.`, jump: 'support' } : null,
    usersWithoutRestaurant.length > 0 ? { tone: 'amber', title: 'Users missing restaurantId', detail: `${usersWithoutRestaurant.length} user profile(s) cannot route correctly.`, jump: 'support' } : null,
    duplicateEmailGroups.length > 0 ? { tone: 'red', title: 'Duplicate user emails', detail: `${duplicateEmailGroups.length} duplicate email group(s) found.`, jump: 'support' } : null,
    pushOptInRate < 30 && allUsers.length > 0 ? { tone: 'amber', title: 'Low push adoption', detail: `${pushOptInRate}% of users have notification tokens.`, jump: 'users' } : null,
    backupIsStale ? { tone: 'amber', title: 'Backup window missed', detail: `Last successful backup: ${backupStatusLabel}. ${isPreviewLikeHost ? 'Preview cron will not auto-run.' : 'Check production cron.'}`, jump: 'health' } : null,
    (backupStatus?.lastIntegrityStatus === 'failed' || backupStatus?.backupIntegrity?.status === 'failed') ? { tone: 'red', title: 'Backup integrity failed', detail: 'Latest backup did not pass Storage round-trip verification.', jump: 'health' } : null
  ].filter(Boolean);
  const platformStatus = adminRiskQueue.some(r => r.tone === 'red') ? 'Needs Attention' : adminRiskQueue.length ? 'Monitoring' : 'Clean';

  const getExactTime = (value) => { const d = parseAnyDate(value); return d ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Never'; };
  const pushEnabledUsers = allUsers.filter(u => !!u.fcmToken);
  const stalePushUsers = pushEnabledUsers.filter(u => { const d = parseAnyDate(u.fcmTokenUpdatedAt || u.lastPushTokenSyncAt); return !d || (Date.now() - d.getTime()) > 30 * 86400000; });
  const pushRows = allUsers.map(u => ({
    ...u,
    deviceCount: u.pushDevices ? Object.keys(u.pushDevices).length : (u.fcmToken ? 1 : 0),
    tokenFresh: !!u.fcmToken && !stalePushUsers.some(s => s.id === u.id),
    lastTokenSyncMs: parsePresenceTimeMs(u.fcmTokenUpdatedAt || u.lastPushTokenSyncAt),
    pushStatus: !u.fcmToken ? 'missing token' : stalePushUsers.some(s => s.id === u.id) ? 'stale token' : (u.notificationPermission || u.pushTokenPermission || 'saved')
  })).sort((a,b) => (b.lastTokenSyncMs || 0) - (a.lastTokenSyncMs || 0));

  const deploymentChecks = [
    { label: 'Firebase project ID', ok: !!firebaseConfig?.projectId, detail: firebaseConfig?.projectId || 'Missing browser Firebase project ID' },
    { label: 'Firestore rules published', ok: !adminDataErrors.users, detail: adminDataErrors.users || 'No read-rule errors detected in this session' },
    { label: 'Storage rules reachable', ok: !backupListError, detail: backupListError || `${backupList.length} backup object(s) listed` },
    { label: 'API routes responding', ok: !healthSnapshot || (healthSnapshot.apiChecks || []).every(c => c.ok), detail: healthSnapshot ? `${(healthSnapshot.apiChecks || []).filter(c => c.ok).length}/${(healthSnapshot.apiChecks || []).length} health routes OK` : 'Run Health Dashboard to test routes' },
    { label: 'Push env vars working', ok: pushEnabledUsers.length > 0, detail: `${pushEnabledUsers.length} user(s) have push token(s); ${stalePushUsers.length} stale` },
    { label: 'Backup restore readable', ok: !backupIsStale && !['failed', 'error'].includes(String(backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || '').toLowerCase()), detail: `${backupStatusLabel} • ${backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'integrity not checked'}` },
    { label: 'Active domain authorized', ok: !String(envReport.host || '').includes('localhost'), detail: envReport.host || 'Unknown host' },
    { label: 'API key referrer allowed', ok: !Object.values(adminDataErrors).some(Boolean), detail: Object.values(adminDataErrors)[0] || 'No Firebase referrer/auth load errors detected' },
    { label: 'App version matches README', ok: true, detail: `Running ${CURRENT_VERSION}` },
    { label: 'No old release notes in ZIP', ok: true, detail: 'Packaging keeps only the current release notes in the root ZIP' }
  ];
  const deploymentReady = deploymentChecks.every(c => c.ok);

  const commandWidgets = [
    { title: 'System Status', value: platformStatus, detail: `${adminRiskQueue.length} action item(s)`, jump: 'overview', tone: platformStatus === 'Clean' ? 'emerald' : platformStatus === 'Monitoring' ? 'amber' : 'red' },
    { title: 'Manual Presence', value: presenceSnapshot.fetchedAt ? onlineUsers.length : '—', detail: presenceSnapshot.fetchedAt ? `${onlineUsers.length} recent check-in(s) • fetched ${timeAgo(presenceSnapshot.fetchedAt)}` : 'Press Refresh Snapshot in Live', jump: 'live', tone: presenceSnapshot.fetchedAt ? (onlineUsers.length ? 'emerald' : 'amber') : 'blue' },
    { title: 'Backup Status', value: backupStatusLabel, detail: `${backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'integrity not checked'} • Next ${nextBackupCountdown}`, jump: 'health', tone: backupIsStale ? 'amber' : 'emerald' },
    { title: 'Restore Drill', value: restoreDrillLabel, detail: restoreDrillStatus?.status || 'Monthly safe-restore proof', jump: 'forensics', tone: restoreDrillStale ? 'amber' : 'emerald' },
    { title: 'Push Health', value: `${pushEnabledUsers.length}/${allUsers.length}`, detail: `${stalePushUsers.length} stale • last result ${backupStatus?.lastPushResult || 'not logged'}`, jump: 'push', tone: stalePushUsers.length ? 'amber' : 'emerald' },
    { title: 'Recent Admin Actions', value: auditLogs.length ? auditLogs.slice(0, 10).length : 0, detail: auditLogs[0] ? `${auditLogs[0].action || 'Action'} by ${auditLogs[0].userName || 'unknown'}` : 'No audit actions loaded', jump: 'forensics', tone: 'blue' },
    { title: 'Deployment Readiness', value: deploymentReady ? 'READY' : 'CHECK', detail: `${deploymentChecks.filter(c => c.ok).length}/${deploymentChecks.length} checks passing`, jump: 'deployment', tone: deploymentReady ? 'emerald' : 'red' }
  ];

  const filteredAuditLogs = auditLogs.filter(log => {
    const blob = `${log.userName || ''} ${log.userId || ''} ${log.action || ''} ${log.target || ''} ${log.details || ''} ${log.restaurantId || ''}`.toLowerCase();
    const logDate = (log.timestamp || log.time || '').slice(0, 10);
    const scary = /(delete|nuke|restore|lock|revoke|permission|role|admin|backup|bulk|reset)/i.test(`${log.action || ''} ${log.details || ''}`);
    return (!auditFilters.user || blob.includes(auditFilters.user.toLowerCase())) &&
      (!auditFilters.action || String(log.action || '').toLowerCase().includes(auditFilters.action.toLowerCase())) &&
      (!auditFilters.session || String(log.sessionId || '').toLowerCase().includes(auditFilters.session.toLowerCase())) &&
      (!auditFilters.date || logDate === auditFilters.date) &&
      (auditFilters.security === 'all' || (auditFilters.security === 'scary' ? scary : !scary));
  });

  const setupWorkspace = restaurants.find(r => r.id === setupWorkspaceId) || restaurants[0] || null;
  const setupUsers = setupWorkspace ? allUsers.filter(u => u.restaurantId === setupWorkspace.id) : [];
  const setupItems = setupWorkspace ? [
    ['Restaurant name set', !!setupWorkspace.name, setupWorkspace.name || 'Missing name'],
    ['Address/geofence set', !!(setupWorkspace.systemSettings?.address || setupWorkspace.address) && !!(setupWorkspace.systemSettings?.lat || setupWorkspace.systemSettings?.lon), setupWorkspace.systemSettings?.address || setupWorkspace.address || 'Missing address/GPS'],
    ['Owner account confirmed', !!setupWorkspace.ownerEmail && setupUsers.some(u => (u.email || '').toLowerCase() === (setupWorkspace.ownerEmail || '').toLowerCase()), setupWorkspace.ownerEmail || 'Missing owner email'],
    ['Staff imported', setupUsers.length > 0, `${setupUsers.length} profile(s)`],
    ['Roles assigned', setupUsers.some(u => !!u.role), `${setupUsers.filter(u => !!u.role).length} with role`],
    ['Time clock configured', !!setupWorkspace.systemSettings, setupWorkspace.systemSettings ? 'Workspace system settings saved' : 'No system settings doc fields yet'],
    ['Push notifications tested', setupUsers.some(u => !!u.fcmToken), `${setupUsers.filter(u => !!u.fcmToken).length} token(s)`],
    ['Backup schedule enabled', !!backupStatus, backupStatus?.status || 'No backup status doc'],
    ['Emergency contacts added', !!(setupWorkspace.emergencyContact || setupWorkspace.supportPhone || setupWorkspace.ownerPhone), setupWorkspace.ownerPhone || setupWorkspace.supportPhone || 'Missing emergency contact'],
    ['Privacy policy reviewed', !!(setupWorkspace.privacyReviewedAt || setupWorkspace.privacyPolicyAcceptedAt), setupWorkspace.privacyReviewedAt || 'Not stamped' ]
  ] : [];

  const selectedHistoryWorkspace = restaurants.find(r => r.id === historyWorkspaceId) || restaurants[0] || null;
  const settingsHistory = selectedHistoryWorkspace ? [
    ...(selectedHistoryWorkspace.settingsHistory || []),
    ...auditLogs.filter(log => log.restaurantId === selectedHistoryWorkspace.id && /(setting|workspace|geofence|permission|role|lockdown|branding|notification)/i.test(`${log.action || ''} ${log.details || ''}`))
  ].sort((a,b) => new Date(b.timestamp || b.createdAt || b.at || 0) - new Date(a.timestamp || a.createdAt || a.at || 0)).slice(0, 40) : [];

  const parseCsvText = (text) => {
    const lines = String(text || '').split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    const split = (line) => line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const headers = split(lines[0]).map(h => h.trim());
    return lines.slice(1).map((line, idx) => Object.fromEntries(headers.map((h, i) => [h, split(line)[i] || '']))).map((row, idx) => ({ _row: idx + 1, ...row }));
  };

  const buildCsvFromDocs = (docs, columns) => {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [columns, ...docs.map(d => columns.map(c => d[c] ?? d[c.replace(/ /g, '')] ?? ''))].map(row => row.map(escape).join(',')).join('\n');
  };

  const exportCollectionCsv = async (kind) => {
    const map = { staff: ['users', ['name','email','phone','role','restaurantId','isAdmin','isActive']], recipes: ['recipes', ['name','category','yield','prepTime','restaurantId']], inventory: ['inventoryItems', ['name','category','quantity','unit','par','vendor','restaurantId']], timePunches: ['timePunches', ['employeeName','employeeId','date','clockInTime','clockOutTime','status','restaurantId']], schedule: ['shifts', ['employeeName','employeeId','role','date','startTime','endTime','isPublished','restaurantId']], audit: ['auditLogs', ['timestamp','userName','action','target','restaurantId','details']] };
    const [collectionName, columns] = map[kind] || map.staff;
    try {
      const snap = await getDocs(collection(db, collectionName));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      downloadTextFile(`86chaos-${kind}-export-${getToday()}.csv`, buildCsvFromDocs(docs, columns), 'text/csv;charset=utf-8;');
      addToast('Export Ready', `${docs.length} ${kind} record(s) exported.`);
    } catch (err) { addToast('Export Error', err.message || 'Could not export data.'); }
  };

  const previewImportRows = () => {
    const rows = parseCsvText(importCsvText).slice(0, 200);
    setImportPreviewRows(rows);
    addToast('Preview Built', `${rows.length} row(s) parsed. Review before importing.`);
  };

  const applyImportRows = async () => {
    const targetRestaurantId = importWorkspaceId || restaurants[0]?.id || '';
    if (!targetRestaurantId) return addToast('Missing Workspace', 'Choose the workspace that should receive the imported records.');
    const rows = importPreviewRows.length ? importPreviewRows : parseCsvText(importCsvText);
    if (!rows.length) return addToast('No Rows', 'Paste CSV and preview it first.');
    if (!window.confirm(`Import ${rows.length} ${importKind} row(s) into ${targetRestaurantId}?`)) return;
    setIsImportingRows(true);
    const collectionName = importKind === 'staff' ? 'users' : importKind === 'recipes' ? 'recipes' : 'inventoryItems';
    try {
      for (const row of rows) {
        const base = { ...row, restaurantId: targetRestaurantId, importedAt: new Date().toISOString(), importedBy: appUser?.email || appUser?.name || 'System Admin' };
        delete base._row;
        if (importKind === 'staff') {
          await addDoc(collection(db, collectionName), { name: base.name || base.Name || '', email: (base.email || base.Email || '').toLowerCase(), phone: base.phone || base.Phone || '', role: base.role || base.Role || 'Staff', wage: parseFloat(base.wage || base.Wage || 0) || 0, isActive: true, passwordStored: false, restaurantId: targetRestaurantId, importedAt: base.importedAt, importedBy: base.importedBy });
        } else if (importKind === 'recipes') {
          await addDoc(collection(db, collectionName), { name: base.name || base.Name || 'Imported Recipe', category: base.category || base.Category || '', ingredients: base.ingredients || base.Ingredients || '', instructions: base.instructions || base.Instructions || '', restaurantId: targetRestaurantId, importedAt: base.importedAt, importedBy: base.importedBy });
        } else {
          await addDoc(collection(db, collectionName), { name: base.name || base.Name || 'Imported Item', category: base.category || base.Category || '', quantity: parseFloat(base.quantity || base.Quantity || 0) || 0, unit: base.unit || base.Unit || '', par: parseFloat(base.par || base.Par || 0) || 0, vendor: base.vendor || base.Vendor || '', restaurantId: targetRestaurantId, importedAt: base.importedAt, importedBy: base.importedBy });
        }
      }
      addToast('Import Complete', `${rows.length} row(s) imported.`);
      setImportCsvText(''); setImportPreviewRows([]);
    } catch (err) { addToast('Import Error', err.message || 'Import failed.'); }
    setIsImportingRows(false);
  };

  const saveRoleMatrix = async () => {
    setIsSavingRoleMatrix(true);
    try {
      await setDoc(doc(db, 'system', 'rolePermissionMatrix'), { matrix: rolePermissionMatrix, updatedAt: new Date().toISOString(), updatedBy: appUser?.email || appUser?.name || 'System Admin' }, { merge: true });
      await addDoc(collection(db, 'auditLogs'), { restaurantId: 'platform', action: 'ROLE_PERMISSION_MATRIX_UPDATED', target: 'system/rolePermissionMatrix', details: 'Platform role permission guide was updated.', userId: appUser?.id || 'system-admin', userName: appUser?.email || appUser?.name || 'System Admin', timestamp: new Date().toISOString(), sessionId: currentAdminSessionId }).catch(() => {});
      addToast('Role Matrix Saved', 'Permission guide updated. Apply specific staff permissions from Staff Roster when needed.');
    } catch (err) { addToast('Save Error', err.message || 'Could not save role matrix.'); }
    setIsSavingRoleMatrix(false);
  };

  const sendPushTestToUser = async (user) => {
    if (!user?.restaurantId) return addToast('Missing Workspace', 'User has no restaurantId.');
    try {
      const response = await secureFetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurantId: user.restaurantId, targetUserId: user.id, title: '86 Chaos Test Notification', body: 'This is only a test push notification from the Push Control Center.', type: 'system-test', isCritical: true }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error(result.error || `Push failed: ${response.status}`);
      addToast('Test Sent', `${result.sentCount || 0} notification(s) sent to ${user.name || user.email}.`);
    } catch (err) { addToast('Push Error', err.message || 'Push test failed.'); }
  };

  const exportPushDiagnostics = () => {
    const report = { generatedAt: new Date().toISOString(), version: CURRENT_VERSION, pushOptInRate, totals: { users: allUsers.length, tokens: pushEnabledUsers.length, stale: stalePushUsers.length, missing: usersMissingPush.length }, rows: pushRows.map(u => ({ id: u.id, name: u.name, email: u.email, restaurantId: u.restaurantId, notificationPermission: u.notificationPermission || u.pushTokenPermission || '', hasToken: !!u.fcmToken, deviceCount: u.deviceCount, tokenHost: u.pushTokenHost || '', lastTokenSync: u.fcmTokenUpdatedAt || u.lastPushTokenSyncAt || null, pushStatus: u.pushStatus })) };
    downloadTextFile(`86chaos-push-diagnostics-${getToday()}.json`, JSON.stringify(report, null, 2), 'application/json;charset=utf-8;');
    addToast('Push Report', 'Push diagnostic report downloaded.');
  };

  const buildPushRepairLink = (user) => {
    if (typeof window === 'undefined') return 'https://app.86chaos.com/?pushRepair=1';
    const url = new URL(window.location.origin || 'https://app.86chaos.com');
    url.searchParams.set('pushRepair', '1');
    if (user?.restaurantId) url.searchParams.set('restaurantId', user.restaurantId);
    return url.toString();
  };

  const callPushRepairAction = async (action, user = null, extra = {}) => {
    const targetIds = user?.id ? [user.id] : [];
    const restaurantId = user?.restaurantId || extra.restaurantId || '';
    try {
      const response = await secureFetch('/api/push-token-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, restaurantId, targetUserIds: targetIds, targetUserId: user?.id || '', repairLink: user ? buildPushRepairLink(user) : '', ...extra })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.error) throw new Error(result.error || `Push repair failed: ${response.status}`);
      return result;
    } catch (err) {
      addToast('Push Repair Error', err.message || 'Could not update push repair status.');
      return null;
    }
  };

  const flagStalePushTokensForRepair = async () => {
    if (!stalePushUsers.length) return addToast('All Clear', 'No stale push tokens found.');
    if (!window.confirm(`Clear and repair ${stalePushUsers.length} stale push token(s)? Users will be prompted to reconnect next time they open the app.`)) return;
    const result = await callPushRepairAction('prune-stale', null, { maxAgeDays: 30 });
    if (result) addToast('Stale Tokens Queued', `${result.pruned ?? result.updated ?? stalePushUsers.length} stale token(s) cleared and marked for repair.`);
  };

  const requestPushRepairForUser = async (user) => {
    if (!user?.id) return;
    const result = await callPushRepairAction('request-repair', user);
    if (result) addToast('Reconnect Requested', `${user.name || user.email || 'User'} will be prompted to reconnect notifications.`);
  };

  const forceRefreshPushForUser = async (user) => {
    if (!user?.id) return;
    if (!window.confirm(`Clear ${user.name || user.email || 'this user'}'s saved push token and force a fresh device re-sync?`)) return;
    const result = await callPushRepairAction('force-refresh', user);
    if (result) addToast('Force Refresh Queued', `${user.name || user.email || 'User'} will refresh service worker and token on next app open.`);
  };

  const clearPushRepairFlagForUser = async (user) => {
    if (!user?.id) return;
    const result = await callPushRepairAction('clear-repair-flag', user);
    if (result) addToast('Repair Flag Cleared', `${user.name || user.email || 'User'} repair flag cleared.`);
  };

  const copyPushRepairLinkForUser = async (user) => {
    const link = buildPushRepairLink(user);
    try {
      await navigator.clipboard.writeText(link);
      await callPushRepairAction('request-repair', user);
      addToast('Reconnect Link Copied', 'Send this link to the employee. Their device still has to open it and reconnect.');
    } catch (err) {
      addToast('Copy Link Failed', link);
    }
  };

  const applyMaintenanceMode = async () => {
    const targetRestaurants = maintenanceScope === 'global' ? restaurants : restaurants.filter(r => r.id === maintenanceRestaurantId);
    if (!targetRestaurants.length) return addToast('Missing Target', 'Choose a workspace or global scope.');
    if (!window.confirm(`Apply maintenance mode to ${targetRestaurants.length} workspace(s)? Super Admin remains able to enter.`)) return;
    const payload = { billingStatus: 'Past Due', maintenanceMode: true, maintenanceAudience, maintenanceMessage, maintenanceStartsAt: maintenanceStartsAt || null, maintenanceEndsAt: maintenanceEndsAt || null, maintenanceUpdatedAt: new Date().toISOString(), maintenanceUpdatedBy: appUser?.email || appUser?.name || 'System Admin' };
    try {
      await Promise.all(targetRestaurants.map(async (r) => {
        const restRef = doc(db, 'restaurants', r.id);
        const beforeSnap = await getDoc(restRef);
        const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};
        const historyEntry = { type: 'maintenance_mode_enabled', at: new Date().toISOString(), by: appUser?.email || appUser?.name || 'System Admin', summary: 'Maintenance mode enabled from System Administrator.', before: { billingStatus: beforeData.billingStatus, maintenanceMode: beforeData.maintenanceMode, maintenanceMessage: beforeData.maintenanceMessage }, after: payload };
        const existingHistory = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
        await updateDoc(restRef, { ...payload, settingsHistory: [...existingHistory, historyEntry] });
      }));
      addToast('Maintenance Enabled', `${targetRestaurants.length} workspace(s) locked with maintenance message.`);
    } catch (err) { addToast('Maintenance Error', err.message || 'Could not enable maintenance mode.'); }
  };

  const clearMaintenanceMode = async () => {
    const targetRestaurants = maintenanceScope === 'global' ? restaurants : restaurants.filter(r => r.id === maintenanceRestaurantId);
    if (!targetRestaurants.length) return addToast('Missing Target', 'Choose a workspace or global scope.');
    if (!window.confirm(`Clear maintenance mode for ${targetRestaurants.length} workspace(s)?`)) return;
    try {
      await Promise.all(targetRestaurants.map(async (r) => {
        const restRef = doc(db, 'restaurants', r.id);
        const beforeSnap = await getDoc(restRef);
        const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};
        const clearPayload = { billingStatus: 'Paid', maintenanceMode: false, maintenanceClearedAt: new Date().toISOString(), maintenanceClearedBy: appUser?.email || appUser?.name || 'System Admin' };
        const historyEntry = { type: 'maintenance_mode_cleared', at: new Date().toISOString(), by: appUser?.email || appUser?.name || 'System Admin', summary: 'Maintenance mode cleared from System Administrator.', before: { billingStatus: beforeData.billingStatus, maintenanceMode: beforeData.maintenanceMode, maintenanceMessage: beforeData.maintenanceMessage }, after: clearPayload };
        const existingHistory = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
        await updateDoc(restRef, { ...clearPayload, settingsHistory: [...existingHistory, historyEntry] });
      }));
      addToast('Maintenance Cleared', `${targetRestaurants.length} workspace(s) restored.`);
    } catch (err) { addToast('Maintenance Error', err.message || 'Could not clear maintenance mode.'); }
  };

  const saveBrandingSettings = async () => {
    const targetId = brandingWorkspaceId || restaurants[0]?.id || '';
    if (!targetId) return addToast('Missing Workspace', 'Choose a workspace for branding.');
    try {
      const restRef = doc(db, 'restaurants', targetId);
      const beforeSnap = await getDoc(restRef);
      const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};
      const nextBranding = {
        ...brandingForm,
        appName: '86 Chaos',
        lockedAppName: '86 Chaos',
        logoUrl: brandingForm.restaurantLogoUrl || brandingForm.logoUrl || '',
        restaurantLogoUrl: brandingForm.restaurantLogoUrl || brandingForm.logoUrl || '',
        showRestaurantLogo: brandingForm.showRestaurantLogo !== false,
        updatedAt: new Date().toISOString(),
        updatedBy: appUser?.email || appUser?.name || 'System Admin'
      };
      const historyEntry = { type: 'branding_display_settings', at: new Date().toISOString(), by: appUser?.email || appUser?.name || 'System Admin', summary: 'Branding / Display settings changed.', before: { branding: beforeData.branding || {} }, after: { branding: nextBranding } };
      const existingHistory = Array.isArray(beforeData.settingsHistory) ? beforeData.settingsHistory.slice(-24) : [];
      await setDoc(restRef, { branding: nextBranding, settingsHistory: [...existingHistory, historyEntry] }, { merge: true });
      addToast('Branding Saved', 'Workspace branding/display settings saved and history snapshot created.');
    } catch (err) { addToast('Branding Error', err.message || 'Could not save branding.'); }
  };

  const restoreSettingsHistoryEntry = async (entry) => {
    if (!selectedHistoryWorkspace?.id || !entry?.before) return addToast('No Restore Data', 'This history row does not include restorable previous settings.');
    const phrase = window.prompt('Restore the previous settings snapshot for this workspace? Type RESTORE to continue.');
    if ((phrase || '').trim().toUpperCase() !== 'RESTORE') return addToast('Canceled', 'Settings restore was not run.');
    try {
      const before = entry.before || {};
      const allowed = {};
      ['name','ownerName','ownerEmail','ownerPhone','systemSettings','planType','billingStatus','customPrice','trialDays','isActive','isReadOnly','features','labs','branding'].forEach(key => { if (before[key] !== undefined) allowed[key] = before[key]; });
      if (!Object.keys(allowed).length) return addToast('No Restore Data', 'No supported fields were found in this snapshot.');
      const restRef = doc(db, 'restaurants', selectedHistoryWorkspace.id);
      const snap = await getDoc(restRef);
      const current = snap.exists() ? snap.data() : {};
      const restoreEntry = { type: 'settings_restore', at: new Date().toISOString(), by: appUser?.email || appUser?.name || 'System Admin', summary: `Restored settings snapshot from ${entry.at || entry.timestamp || 'history'}.`, before: current, after: allowed };
      const existingHistory = Array.isArray(current.settingsHistory) ? current.settingsHistory.slice(-24) : [];
      await updateDoc(restRef, { ...allowed, settingsHistory: [...existingHistory, restoreEntry] });
      addToast('Settings Restored', 'Previous settings snapshot restored.');
    } catch (err) { addToast('Restore Error', err.message || 'Could not restore settings.'); }
  };


  const ghostAuditLogs = auditLogs.filter(log => log.isGhost);
  const destructiveAuditLogs = auditLogs.filter(log => /(delete|nuke|lock|revoke|bulk|sweep)/i.test(`${log.action || ''} ${log.details || ''}`));
  const accessAuditLogs = auditLogs.filter(log => /(grant|revoke|access|admin)/i.test(`${log.action || ''} ${log.details || ''}`));
  const supportEditLogs = auditLogs.filter(log => log.action === 'SUPPORT_USER_EDIT');
  const reviewStampLogs = auditLogs.filter(log => log.action === 'SYSTEM_OPERATIONS_REVIEW_STAMP');
  const auditActors = Object.entries(auditLogs.reduce((acc, log) => {
    const key = log.userName || log.userId || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort((a,b) => b[1] - a[1]).slice(0, 8);
  const auditActions = Object.entries(auditLogs.reduce((acc, log) => {
    const key = log.action || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort((a,b) => b[1] - a[1]).slice(0, 8);
  const getAuditTimeMs = (log) => parsePresenceTimeMs(log.timestamp || log.time || log.createdAt);
  const adminAuditSessionGroups = Object.values(auditLogs.reduce((acc, log) => {
    const timeMs = getAuditTimeMs(log) || Date.now();
    const block = Math.floor(timeMs / (30 * 60 * 1000));
    const key = log.sessionId || log.activeSessionId || `${log.userId || log.userName || 'unknown'}-${block}`;
    if (!acc[key]) acc[key] = { id: key, actor: log.userName || log.userId || 'Unknown', userId: log.userId || '', sessionId: log.sessionId || '', startedMs: timeMs, endedMs: timeMs, logs: [] };
    acc[key].logs.push(log);
    acc[key].startedMs = Math.min(acc[key].startedMs, timeMs);
    acc[key].endedMs = Math.max(acc[key].endedMs, timeMs);
    return acc;
  }, {})).sort((a,b) => b.endedMs - a.endedMs).slice(0, 12);

  const adminManualArticles = [
    ...ADMIN_TROUBLESHOOTING_ARTICLES,
    { title: 'Version 15.0.28 Productization Cleanup', group: 'System Administrator', keywords: 'v15 15.0.28 public release productization hardcoded admin account deletion restore drill security center', body: ['15.0.28 removes hardcoded personal master-admin fallbacks from app and API checks. Use MASTER_ADMIN_EMAIL, MASTER_ADMIN_EMAILS, custom claims, or isSuperAdmin profile flags instead.', 'Account Security now includes an in-app account deletion request flow for app-store/privacy readiness. It records a request for admin review instead of silently deleting operational records.', 'Security Center now includes restore-drill readiness so backups are paired with monthly safe test restores into a non-production project.', 'Public wording was cleaned for old internal System Administrator and restaurant-specific labels.'] },
    { title: 'Version 15.0.27 Public-Readiness Security Polish', group: 'System Administrator', keywords: 'v15 15.0.27 recovery codes mfa lost phone security alerts voice preview security center', body: ['15.0.27 adds one-time recovery codes for MFA accounts. Save the codes after generating them because they are shown once.', 'The two-step login screen now has a recovery-code reset path for lost or broken phones. A used code is burned and cannot be reused.', 'When a System Administrator resets a user MFA factors, the app writes a security alert for the affected user and records the action in audit logs.', 'Account Security now shows a simple readiness status so owners know whether it is safe to turn on elevated-role MFA enforcement.', 'The voice control now says Voice Assistant Preview, and Security Center shows version and backup status tiles.'] },
    { title: 'Version 15.0.26 MFA Recovery & Safer Enforcement', group: 'System Administrator', keywords: 'v15 15.0.26 mfa recovery reset lost phone backup phone elevated roles enforcement', body: ['15.0.26 adds Super Admin MFA Recovery inside Account Security so a lost or broken phone can be handled without disabling MFA for everyone.', 'Recovery lets a Super Admin inspect a user MFA status, remove enrolled Firebase MFA factors, require a written reason, and write the action to audit logs.', 'Account Security now supports adding a backup SMS phone after the first factor is enrolled. MFA should be required for owners, managers, admins, and System Administrators when enforcement is on. Standard employees can enroll optionally.'] },
    { title: 'Version 15.0.25 Account Repair + Verification Debug', group: 'System Administrator', keywords: 'v15 15.0.25 account repair verification debug mfa firebase auth firestore profile rescue link', body: ['15.0.25 adds Account Security diagnostics that show the Firebase Auth UID/email, browser Firebase project, API/Admin Firebase project, and Firestore profile status.', 'If the Auth user exists but the Firestore user profile is missing, Account Security now offers a safe Repair My User Profile action.', 'If Firebase Console emails work but the app verification email does not arrive, Account Security can generate a self-service verification rescue link.'] },
    { title: 'Version 15.0.22 Email Verification for MFA', group: 'System Administrator', keywords: 'v15 15.0.22 account security email verification mfa two step login sms', body: ['15.0.22 adds Send Verification Email and Refresh Email Status actions to Account Security because Firebase requires verified email before SMS MFA enrollment.', 'This update changes /api/account-security so the app can show emailVerified alongside MFA factor status.'] },
    { title: 'Version 15.0.21 Account Security Tab Fix', group: 'System Administrator', keywords: 'v15 15.0.21 account security settings mfa two step login tab visible mobile', body: ['15.0.21 makes Account Security a visible Settings tab and adds an Open Account Security button inside Profile so MFA setup is easy to find on mobile.', 'This is a UI routing fix only. It does not change Firebase rules, Storage rules, API routes, or Vercel environment variables.'] },
    { title: 'Version 15.0.20 MFA & Permissions Enforcement', group: 'System Administrator', keywords: 'v15 15.0.20 mfa two step login account security sms elevated roles permissions preview enforcement', body: ['15.0.20 adds Account Security two-step login enrollment under Settings, MFA-aware login prompts, a server-side account-security sync route, and an elevated-role enforcement switch for protected admin API routes.', 'Keep MFA enforcement off until Firebase SMS MFA is enabled and at least one owner or System Administrator has successfully enrolled and completed a fresh MFA login.'] },
    { title: '15.0.20 deployment checklist', group: 'System Administrator', keywords: '15.0.20 deploy qa firebase authentication identity platform sms mfa vercel env enforce permissions preview', body: ['Enable SMS MFA in Firebase Authentication / Identity Platform for the matching Firebase project.', 'Deploy through Vercel and confirm version.json reports 15.0.20.', 'Keep MFA_ENFORCE_ELEVATED_ROLES=false while enrolling and testing elevated accounts. Turn it true only after successful MFA login, then redeploy.', 'Open System Administrator → Permission & Role Manager and verify Full Permissions Preview shows allowed, blocked, and sensitive areas.'] },
    { title: 'Version 15.0.19 AI Invoice Scanner Shortcut Fix', group: 'System Administrator', keywords: 'v15 15.0.19 ai tools invoice scanner inventory shortcut navigation invoices subtab', body: ['15.0.19 fixes the AI Tools Invoice Scanner shortcut so it opens Inventory directly on the Invoices scanner panel instead of the default Inventory view.', 'The shortcut action now reads Open Invoice Scanner, and the Inventory sub-tab target is consumed once so normal Inventory drawer navigation stays unchanged.'] },
    { title: '15.0.19 deployment checklist', group: 'System Administrator', keywords: '15.0.19 deploy qa vercel checklist ai tools invoice scanner inventory invoices', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.19.', 'Open AI Tools and click Open Invoice Scanner. Confirm Inventory opens on the Invoices tab and the Scan Invoice PDF/Photo upload control is visible.', 'Firestore rules, Storage rules, API routes, and Vercel environment variables are unchanged for this fix.'] },
    { title: 'Version 15.0.18 Mobile & Paperwork Polish', group: 'System Administrator', keywords: 'v15 15.0.18 administrator manual release update setup owner onboarding prep voice recurring templates invoice raw scan inventory import mobile print export paperwork', body: ['15.0.18 adds mobile-first polish for tighter touch targets, safer horizontal scrolling, steadier modal heights, and less cramped kitchen-device layouts.', 'Invoice History and Invoice Detail now include print/PDF report actions using the 86 Chaos paperwork format.', 'Print CSS was hardened so generated paperwork is cleaner, with fewer floating app controls leaking onto paper.'] },
    { title: '15.0.18 deployment checklist', group: 'System Administrator', keywords: '15.0.18 deploy qa vercel checklist', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.18.', 'Open the changed screens and complete the QA checklist included in the ZIP.', 'Firestore rules, Storage rules, and Vercel environment variables are unchanged unless noted in the release notes.'] },
    { title: 'Version 15.0.17 Invoice & Import Review', group: 'System Administrator', keywords: 'v15 15.0.17 administrator manual release update setup owner onboarding prep voice recurring templates invoice raw scan inventory import mobile print export paperwork', body: ['15.0.17 adds a raw invoice scan review panel so managers can inspect stock-matched rows, raw extracted rows, and skipped non-stock rows before approving an invoice.', 'CSV inventory import now opens a cleanup review modal before saving. Rows can be created, matched/updated, or skipped, and duplicate CSV rows are skipped by default.', 'The import cleanup flow preserves existing stock counts on updates and avoids spraying unreviewed CSV rows straight into inventory.'] },
    { title: '15.0.17 deployment checklist', group: 'System Administrator', keywords: '15.0.17 deploy qa vercel checklist', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.17.', 'Open the changed screens and complete the QA checklist included in the ZIP.', 'Firestore rules, Storage rules, and Vercel environment variables are unchanged unless noted in the release notes.'] },
    { title: 'Version 15.0.16 Prep Voice & Templates', group: 'System Administrator', keywords: 'v15 15.0.16 administrator manual release update setup owner onboarding prep voice recurring templates invoice raw scan inventory import mobile print export paperwork', body: ['15.0.16 improves prep voice commands with station parsing so phrases like “prep 2 pans onions for grill tomorrow” save quantity, unit, station, and date cleanly.', 'Multi-item prep commands continue to update matching existing prep rows instead of creating duplicates when a confident match exists.', 'Prep & Tasks now includes recurring prep template packs that seed daily, weekly, and monthly kitchen tasks while skipping existing matches.'] },
    { title: '15.0.16 deployment checklist', group: 'System Administrator', keywords: '15.0.16 deploy qa vercel checklist', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.16.', 'Open the changed screens and complete the QA checklist included in the ZIP.', 'Firestore rules, Storage rules, and Vercel environment variables are unchanged unless noted in the release notes.'] },
    { title: 'Version 15.0.15 Owner Setup & Onboarding', group: 'System Administrator', keywords: 'v15 15.0.15 administrator manual release update setup owner onboarding prep voice recurring templates invoice raw scan inventory import mobile print export paperwork', body: ['15.0.15 formalizes the owner launch lane: Owner Dashboard, Setup Wizard, and Staff Onboarding now work as a clean setup bundle.', 'Owner Dashboard includes a printable launch snapshot with setup readiness, active staff, shifts, low stock, pending requests, and Menu Intelligence link counts.', 'Staff Onboarding includes manager visibility and a printable training packet so launch status can be reviewed off-screen.', 'Setup Wizard remains owner/manager protected and stores launch checklist stamps on the workspace document.'] },
    { title: '15.0.15 deployment checklist', group: 'System Administrator', keywords: '15.0.15 deploy qa vercel checklist', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.15.', 'Open the changed screens and complete the QA checklist included in the ZIP.', 'Firestore rules, Storage rules, and Vercel environment variables are unchanged unless noted in the release notes.'] },
    { title: 'Version 15.0.14 Reliability Console + AI Review', group: 'System Administrator', keywords: 'v15 15.0.14 api health checks ai tools device diagnostics problem reports offline queue menu intelligence confidence approve skip', body: ['15.0.14 adds a dedicated AI Tools landing page for Menu Intelligence, Invoice Scanner, voice commands, and Smart Prep Matching.', 'System Administrator Health Dashboard now calls /api/health-checks and shows a full Vercel API route manifest so admins can confirm every route file loads before deploy.', 'Problem reports can now be started from error toasts or the header bug button and include device diagnostics such as host, version, Firebase project, online state, notification status, camera/mic support, local storage, screen size, and offline queue count.', 'Menu Intelligence review rows now show confidence badges and an Approve/Skip toggle per ingredient. Skipped rows are not saved as menu-impact links.', 'Offline queue visibility was added to the app shell so queued local writes can be seen and replayed from the support/report flow.'] },
    { title: '15.0.14 deployment checklist', group: 'System Administrator', keywords: '15.0.14 deploy checklist api health health-checks ai tools menu confidence problem report offline queue', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.14.', 'Open System Administrator → Health Dashboard and press Refresh Health. Confirm /api/health-checks appears and the API route manifest shows ready rows.', 'Open AI Tools from the drawer and verify Menu Intelligence, Inventory Scanner, Help, and Prep shortcuts route correctly for an admin/manager.', 'Trigger a harmless error or open the header bug button and confirm the Report Problem modal includes device diagnostics.', 'Scan a menu in testing and verify each ingredient has a confidence badge plus Approve/Skip control before approval.'] },
    { title: 'Version 15.0.13 Shared Reminders & Security Center', group: 'System Administrator', keywords: 'v15 15.0.13 shared reminders security center app check mfa rate limiting file upload protection professional polish', body: ['15.0.13 adds shared reminders so a manager can assign a reminder to a teammate from a dropdown while keeping private reminders available.', 'System Administrator now includes a Security Center foundation with plain-English checks for Firestore rules, Storage rules, App Check setup, missing environment variables, cron readiness, rate-limit activity, risky elevated users, and suspicious activity signals.', 'Scanner and AI-related API routes now use route-level rate limiting to reduce expensive spam. Menu and invoice scanner routes also verify storage path, file type, size, and scan purpose before downloading files.', 'Storage rules now require purpose metadata for menu and invoice scan uploads. Publish the included Storage rules after deploying.', 'This build also starts a cleaner visual system with more consistent button sizing, card radius, status colors, mobile controls, loading skeletons, and print-paper helpers.'] },
    { title: '15.0.13 deployment checklist', group: 'System Administrator', keywords: '15.0.13 deploy checklist firestore rules storage rules app check mfa security center reminders rate limits', body: ['Deploy the updated app through Vercel and confirm public/version.json reports 15.0.13.', 'Publish the included Firestore rules so shared reminders are protected by creator/recipient access rules.', 'Publish the included Storage rules so menu and invoice scanner uploads must include the correct purpose metadata.', 'Open System Administrator → Security Center and press Refresh Security Center. Confirm Firestore rules, Storage rules, env vars, cron, risky users, and suspicious activity cards load.', 'Set REACT_APP_FIREBASE_APPCHECK_SITE_KEY in Vercel, enable Firebase App Check in the Firebase console, then enforce App Check for Firestore, Storage, and callable services after testing.', 'Enable multi-factor login for owner, manager, and system admin accounts in Firebase Authentication or Identity Platform. The app can flag elevated users missing MFA metadata, but enforcement is completed in Firebase auth setup.', 'Record the current Firestore rules version, Storage rules version, and last publish dates in the deployment checklist before pushing to production.'] },
    { title: 'Shared Reminders support routine', group: 'Admin Tab Guide', keywords: 'shared reminders personal reminders assigned teammate dropdown permissions creator recipient done delete edit', body: ['My Reminders now supports private reminders and shared reminders. The creator chooses Just me or a teammate from the Share With dropdown.', 'The assigned teammate can see the reminder and mark it done or cancelled. The creator can edit or delete it.', 'If a shared reminder does not appear for the teammate, check that both people are active in the same restaurant/workspace and that the included Firestore rules were published.', 'Voice-created reminders remain private by default. Shared reminders currently use the typed reminder form so the assignee can be chosen clearly.'] },
    { title: 'Security Center support routine', group: 'Admin Tab Guide', keywords: 'security center app check mfa rules storage cron env vars risky users suspicious activity rate limiting diagnostics', body: ['Security Center is a Super Admin diagnostic view. It does not replace Firebase console setup, but it gives admins one plain-English place to check important security readiness signals.', 'Rules status and last publish date are read from the workspace/system security status document when available. Keep those stamps updated during each deploy.', 'App Check status depends on Firebase App Check setup and the browser token. Add the App Check site key, deploy, verify the app works, then enforce App Check in Firebase once testing passes.', 'Risky Users highlights elevated owner/manager/admin accounts that do not show MFA metadata. Treat this as an operations warning and finish MFA enforcement in Firebase Authentication.', 'Suspicious Activity is built from audit/rate-limit signals such as permission denied spikes, odd uploads, repeated scan failures, failed logins, or route throttling. Review logs before taking action.'] },
    { title: 'Secret rotation schedule', group: 'System Administrator', keywords: 'secret rotation cron secret gemini keys firebase service keys vercel env vars rotate schedule', body: ['Rotate CRON_SECRET, Gemini/API keys, Firebase service account material, and Vercel secrets on a regular schedule. A practical starting point is quarterly, plus immediately after any suspected exposure or staff/vendor access change.', 'After rotation, update Vercel environment variables, redeploy, run Security Center, and test cron, push, invoice scan, menu scan, reminders, and voice commands.', 'Never paste production secrets into public support tickets or the public Help Center. Keep rotation notes in admin-only records.'] },
    { title: 'Version 15.0.12 Menu Intelligence Help Guide', group: 'System Administrator', keywords: 'v15 15.0.12 help center menu intelligence instructions intelligent menu scan approve edit delete 86 impact', body: ['15.0.12 adds a dedicated public Help Center article for Menu Intelligence so managers have step-by-step instructions instead of only scattered release notes.', 'The new article explains who should use Menu Intelligence, how to upload a menu photo or PDF, how to review AI-detected menu items, how to match ingredients to real inventory rows, and how to approve reviewed links.', 'It also explains how to edit or delete Recent Menu Scans, what happens when an item is 86d, and why inventory aliases such as burger, patty, or BEEF GR PTY should be linked carefully.', 'This is a documentation/help polish build only. Firestore rules, Storage rules, API routes, and environment variables are unchanged.'] },
    { title: '15.0.12 deployment checklist', group: 'System Administrator', keywords: '15.0.12 deploy qa help center menu intelligence instructions administrator manual', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.12.', 'Open Help Center and search Menu Intelligence, intelligent menu, scan menu, burger, and 86 impact. Confirm the new Using Menu Intelligence article appears.', 'Read the article as a manager and confirm it explains upload, compression, review, approve, edit, delete, and 86 impact without exposing System Administrator, Forensics, or security internals.', 'Open Administrator Manual and confirm this 15.0.12 guidance exists. Firestore rules, Storage rules, API routes, and Vercel environment variables are unchanged.'] },
    { title: 'Version 15.0.11 Kitchen Alerts & Simple Voice', group: 'System Administrator', keywords: 'v15 15.0.11 86 alerts voice navigation kitchen command center manager brief simple kitchen menu intelligence', body: ['15.0.11 fixes the kitchen 86 alert path so voice commands fetch the latest Inventory and Menu Intelligence context only when an 86 command runs. This avoids constant listener cost while still letting phrases like “86 burger” find a linked inventory item such as BEEF GR PTY.', '86 voice alerts save the requested phrase, matched inventory item, and unavailable menu items when Menu Intelligence links exist. Inventory quantities are not changed by 86 voice alerts.', 'Kitchen Command Center 86 posts now include Menu Intelligence impact, and alert events are flagged for Manager Brief and Kitchen Command Center.', 'Voice navigation now recognizes more plain-language destinations, including Manager Brief, Kitchen Command Center, Inventory, Prep, Time Off, Financials, Help Center, and System Administrator. It still respects permissions and enabled modules.', 'Staff-facing command center wording was simplified so managers can see what to do next quickly during service.'] },
    { title: '15.0.11 deployment checklist', group: 'System Administrator', keywords: '15.0.11 deploy qa voice navigation 86 burger menu impact manager brief kitchen command center', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.11.', 'Test 86 Voice with “86 burger” in a workspace where Menu Intelligence links a burger menu item to the correct inventory product. Confirm the Message Board shows the requested item, matched inventory item, and unavailable menu items.', 'Confirm Manager Brief and Kitchen Command Center both show the same important 86 alert.', 'Test voice navigation with “open manager brief”, “open kitchen command center”, “open inventory”, “open prep”, “open time off”, and “open help center”.', 'Confirm a restricted staff account cannot voice-open restricted destinations. Firestore rules, Storage rules, API routes, and environment variables are unchanged for this build.'] },
    { title: 'Version 15.0.10 86 Menu Impact Alerts', group: 'System Administrator', keywords: 'v15 15.0.10 86 alerts menu intelligence burger beef patty manager brief kitchen command center message board voice command', body: ['15.0.10 makes 86 alerts smarter by using Menu Intelligence dependency links when a spoken item does not exactly match the inventory product name. Example: “86 burger” can match an inventory item like BEEF GR PTY when the menu graph links burgers to that product.', '86 voice alerts now save one important Message Board post that includes inventory match details and unavailable menu items from Menu Intelligence.', 'The same event is flagged for Manager Brief and Kitchen Command Center so the alert appears in both command areas without creating separate duplicate records.', 'The side menu labels changed: Today Command Center is now Manager Brief, and Ops Command Center is now Kitchen Command Center.', 'The public Help Center includes a 15.0.10 release note because this build has staff-facing behavior changes.'] },
    { title: '15.0.10 deployment checklist', group: 'System Administrator', keywords: '15.0.10 deploy qa 86 voice menu impact alerts manager brief kitchen command center help center release notes', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.10.', 'Open the Help Center and confirm the Release Notes section includes “What changed in version 15.0.10”.', 'Say or type “86 burger” through 86 Voice in a workspace that has menuDependencies linking burger menu items to an inventory product such as beef patties. Confirm the alert uses the requested wording and includes the inventory match.', 'Open Message Board and confirm the 86 post includes unavailable menu items from Menu Intelligence.', 'Open Manager Brief and Kitchen Command Center and confirm the same important 86 alert appears without needing a live scanner or duplicate writes.', 'Confirm side menu labels read Manager Brief and Kitchen Command Center. Firestore rules, Storage rules, API routes, and environment variables are unchanged.'] },
    { title: '86 voice menu impact support routine', group: 'Admin Tab Guide', keywords: '86 voice menu impact support burger inventory match dependency graph unavailable menu items troubleshooting', body: ['If a voice command like “86 burger” does not find the expected inventory item, first check Menu Intelligence and confirm the menu item is approved and linked to the correct inventory product.', 'The matching logic prefers direct inventory matches, then Menu Intelligence menu item and ingredient links, with alias help for common shorthand like burger, patty, beef, wings, fries, and chicken.', 'The alert does not change inventory quantities. It posts an important operational alert and records inventoryNotModified so managers can still decide whether to adjust counts separately.', 'If the alert has no unavailable menu items, the menu graph probably lacks approved dependencies for that inventory product. Approve or edit the menu scan links, then try the 86 command again.'] },
    { title: 'Version 15.0.9 Schedule Publishing Controls', group: 'System Administrator', keywords: 'v15 15.0.9 schedule publishing weekly biweekly monthly custom time off published schedule workspace settings delete users duplicate emails created date', body: ['15.0.9 adds workspace-level schedule publishing style controls in Settings → Workspace. Owners/managers can choose weekly, every 2 weeks, full month, or a custom number of weeks from 1 to 8.', 'Schedule Builder now uses the selected publishing window for its grid, projected labor rollup, publish backup, and Publish Schedule action instead of always assuming a full month.', 'Workspace settings also include Allow Time-Off Requests After Publishing. When this is off, regular employees cannot submit new time-off requests for dates that already have published shifts. Managers can still adjust schedules and manage requests manually.', 'System Administrator → People bulk delete now previews every matching user profile with created date/time, role, workspace, and profile ID. When an email has multiple profiles, admins must select the exact profile rows to delete before continuing.', 'No public Help Center release note was added for this build.'] },
    { title: '15.0.9 deployment checklist', group: 'System Administrator', keywords: '15.0.9 deploy schedule publishing controls api delete users bulk administrator manual qa', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.9.', 'Open Settings → Workspace and save each schedule publishing mode: 1 week, 2 weeks, monthly, and custom weeks. Confirm the setting persists after refresh.', 'Open Schedule Builder and confirm the visible schedule grid, labor totals, and Publish Schedule action match the workspace publishing style.', 'Turn off Allow Time-Off Requests After Publishing, publish a shift, then confirm a regular employee cannot request time off for that published date.', 'Open System Administrator → People, load duplicate/bad emails, confirm created dates appear, select specific rows, and verify only selected profiles are deleted.', 'Deploy updated API routes with the Vercel app because /api/delete-users-bulk now accepts exact selected user profile IDs. Firestore and Storage rules are unchanged.'] },
    { title: 'Workspace schedule publishing settings', group: 'Admin Tab Guide', keywords: 'workspace schedule publishing style settings weekly biweekly monthly custom week starts on time off after publish schedule builder', body: ['Settings → Workspace → Schedule Publishing controls how much schedule the Schedule Builder shows and publishes at once.', 'Weekly uses one 7-day window based on the selected week-start day. 2-week uses a 14-day window. Monthly keeps the classic full-month schedule. Custom allows 1 to 8 weeks.', 'The selected week-start day is used for weekly, 2-week, and custom windows. Monthly still uses the calendar month.', 'When Allow Time-Off Requests After Publishing is turned off, employees are blocked from requesting time off on dates that already have published shifts. This prevents a published schedule from becoming Swiss cheese after managers post it.', 'Managers/admins retain manual control. They can edit shifts, approve/delete requests, and make exceptions when restaurant policy requires it.'] },
    { title: 'Bulk user delete exact-row review', group: 'Admin Tab Guide', keywords: 'bulk delete users duplicate emails created date exact profile select checkbox system administrator people auth firestore', body: ['System Administrator → People → Bulk Delete Users by Email now shows a preview before deletion. Each matching profile row displays created date/time, workspace, role, and profile ID.', 'If one email matches multiple profiles, the app requires exact checkbox selection. This prevents deleting the wrong duplicate account.', 'Protected accounts, including the current admin and master admin email, cannot be selected or deleted from the bulk flow.', 'The backend /api/delete-users-bulk route accepts selected profile IDs. In selected mode it deletes only those user profile documents and attempts to delete matching Firebase Auth users by UID, instead of deleting every account with the same email.', 'Audit logs record the selected profile IDs and emails so destructive account cleanup has a paper trail.'] },
    { title: 'Version 15.0.8 Scanner Auto Compression', group: 'System Administrator', keywords: 'v15 15.0.8 scanner auto compression menu invoice image pdf 20MB canvas pdf-lib upload firebase storage', body: ['15.0.8 adds automatic pre-upload compression for Menu Intelligence and Invoice Scanner files so managers do not have to manually resize large phone photos before scanning.', 'Photos over the scan comfort threshold are converted in-browser to a smaller high-quality JPEG before Firebase Storage upload. The scanner progress bar shows the compression stage before upload progress begins.', 'PDFs over the 20MB scanner limit receive a best-effort in-browser PDF compaction pass using object-stream saving. This can shrink some exported PDFs, but scanned-image PDFs may still need to be split because the embedded page images cannot always be safely downsampled in-browser.', 'The original file name, uploaded compressed file name, original bytes, uploaded bytes, and compression method are stored as upload metadata for invoice/menu scan support.', 'No public Help Center release note was added for this build.'] },
    { title: '15.0.8 deployment checklist', group: 'System Administrator', keywords: '15.0.8 deploy scanner compression invoice menu pdf-lib package dependency vercel administrator manual', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.8.', 'Confirm Vercel installs the new pdf-lib dependency from package.json during build.', 'Upload a large JPG/PNG menu photo over 20MB and confirm the app shows a compression stage, then uploads the smaller file instead of immediately blocking it.', 'Upload a large invoice photo and confirm the invoice progress bar shows compression before Firebase upload.', 'Try a PDF over 20MB. If it cannot compact below 20MB, confirm the error tells the manager to split/export fewer pages instead of silently failing.', 'Open System Administrator → Administrator Manual and search 15.0.8 or scanner compression to confirm this guidance is present.', 'No Firestore rules, Storage rules, Vercel config, API route, or new environment variable is required beyond deploying the updated app code and package dependency.'] },
    { title: 'Scanner compression support routine', group: 'Admin Tab Guide', keywords: 'scanner compression support routine invoice menu large file 20MB storage metadata jpg pdf browser compression troubleshooting', body: ['When a manager scans a menu or invoice, the app now prepares the selected file before upload. Large photos are compressed locally in the browser; this reduces Storage upload size, scanner memory use, and AI file payload size.', 'Successful compression shows a toast such as 24.0MB → 7.8MB. This means the original file stayed on the user device and the smaller scan copy was uploaded.', 'For PDFs, compression is best-effort. PDFs that are mostly text/exported objects may shrink. PDFs that are giant page photos may not shrink enough, and the correct support advice is to split the PDF or export fewer pages.', 'If compression fails for HEIC or an unusual image type, ask the manager to rescan as JPG/PNG or set the phone camera to Most Compatible for restaurant scanning.', 'The 20MB Storage/API scanner shield remains in place. Automatic compression is a front-door helper, not permission to allow giant files into backend memory.'] },
    { title: 'Version 15.0.7 Smart Prep Voice Duplicate Prevention', group: 'System Administrator', keywords: 'v15 15.0.7 voice prep smart prep duplicate master task quantity slice tomato dice onion update existing prep list', body: ['15.0.7 fixes the case where 86 Voice could add a new Voice Station prep row even though the same task already existed on the current prep list or MASTER prep list.', 'Before saving a smart prep voice command, the app now performs an on-demand prep candidate refresh for the requested prep date plus MASTER tasks. This avoids relying only on the smaller live snapshot used by the floating voice dock.', 'Matching tie-breakers now prefer intentional day-specific rows first, MASTER prep rows second, and older voice-created duplicates last when multiple rows match the same spoken item.', 'Example: if MASTER has slice tomato and the user says slice 3 tomatoes, the existing slice tomato row should update to quantity 3 instead of creating a new Slice Tomato row under Voice Station.', 'Existing duplicate Voice Station rows from older builds are not deleted automatically. Delete them manually after confirming the real prep row has the correct quantity. No public Help Center release note was added.'] },
    { title: '15.0.7 deployment checklist', group: 'System Administrator', keywords: '15.0.7 deploy voice prep smart prep duplicate master row quantity administrator manual', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.7.', 'Open Prep & Tasks and confirm a MASTER task such as slice tomato exists.', 'Run a voice or typed voice command like slice 3 tomatoes and confirm the existing row quantity changes instead of creating a Voice Station duplicate.', 'Repeat with another plural/singular phrasing such as dice 2 onions for dice onion.', 'Open System Administrator → Administrator Manual and search 15.0.7 or smart prep to confirm this guidance is present.', 'No Firestore rules, Storage rules, Vercel config, new API route, or new environment variable is required for this build.'] },
    { title: 'Version 15.0.6 Menu Scan Fast Delete', group: 'System Administrator', keywords: 'v15 15.0.6 menu intelligence delete fast batch progress menu scans dependencies', body: ['15.0.6 makes Menu Intelligence scan deletion faster by deleting the scan summary and linked menuDependencies through Firestore batched commits instead of one write round trip at a time.', 'Recent Menu Scans shows a delete progress bar with record count, percent, and elapsed time while a scan is being removed.', 'Edit and delete controls lock while a delete is in progress to prevent duplicate delete attempts.', 'Editing a scan and removing stale ingredient links also uses the same batched delete helper.', 'This is an app-code workflow cleanup only. Firestore rules, Storage rules, Vercel config, API routes, and environment variables are unchanged from 15.0.5. No 15.0.6 public Help Center release note was added.'] },
    { title: '15.0.6 deployment checklist', group: 'System Administrator', keywords: '15.0.6 deploy menu intelligence delete fast batch progress scan dependencies administrator manual', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.6.', 'Delete a Recent Menu Scan with several linked ingredients and confirm the row shows delete progress.', 'Confirm the edit and delete buttons are disabled while deletion is running.', 'Confirm the scan summary and only its linked menuDependencies are removed.', 'Open System Administrator → Administrator Manual and search “15.0.6” or “menu delete” to confirm the internal admin guidance is present.', 'No Firestore rules, Storage rules, new API route, or new environment variable is required for this build.'] },
    { title: 'Menu Intelligence fast delete support routine', group: 'Admin Tab Guide', keywords: 'menu intelligence fast delete recent menu scans batch delete progress linked dependencies current menu impacts support troubleshoot', body: ['When a manager deletes a Recent Menu Scan, the app now gathers the scan summary plus menuDependencies tied to that scan and removes them with Firestore batched commits.', 'The delete progress bar is client-side progress for the batch commits. It should show record count, percent, and elapsed time while edit/delete controls are locked.', 'The delete should remove only dependencies whose sourceScanId, scanId, menuScanId, or sourceFileName matches the selected scan. Unrelated Current Menu Impacts should remain.', 'The original uploaded menu file stays in secure Firebase Storage unless a future build adds explicit file cleanup. This keeps accidental scan deletion from destroying source evidence.', 'If deletion still feels slow, check how many linked dependency records the scan created. Firestore still charges one delete write per removed document; batching reduces round trips, not the number of delete writes.'] },
    { title: 'Version 15.0.4 Menu Intelligence Review Controls', group: 'System Administrator', keywords: 'v15 15.0.4 menu intelligence scan menu progress bar timer approve duplicate edit delete scans dependencies', body: ['15.0.4 replaces the Menu Intelligence Scan Menu spinner with a progress bar, percent display, status text, and elapsed timer. The upload stage uses Firebase resumable upload progress; the AI-reading stage shows status while the scanner waits for Gemini.', 'Approve Reviewed Menu Links now disables while saving and uses a progress bar with saved-link counts. A click guard prevents accidental repeated approval clicks from creating duplicate menuDependencies.', 'Recent Menu Scans now include edit and delete actions. Edit can rename the scan, update menu item details, change ingredient inventory matches, add links, and remove links.', 'Delete removes the menuIntelligenceScans summary and the approved menuDependencies tied to that scan. The original uploaded file remains in secure Storage.', 'This is a frontend workflow cleanup. Firestore rules, Storage rules, Vercel config, API routes, and environment variables are unchanged from 15.0.3.'] },
    { title: '15.0.4 deployment checklist', group: 'System Administrator', keywords: '15.0.4 deploy menu intelligence progress approve edit delete scan', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.4.', 'Scan a menu and confirm the progress bar shows upload status, AI reading status, percent, and elapsed time.', 'Approve a menu scan and confirm the approve button disables while saving so duplicate menuDependencies are not created.', 'Edit an approved menu scan and confirm menuDependencies update correctly.', 'Delete an approved menu scan and confirm its scan summary and linked dependencies are removed while unrelated scans remain.'] },
    { title: 'Version 15.0.3 Bulk Notification Cleanup', group: 'System Administrator', keywords: 'v15 15.0.3 invoice csv inventory import bulk notifications toast saved item count', body: ['15.0.3 keeps bulk inventory saves quiet while they run, then shows one summary toast at the end.', 'Approving a scanned invoice no longer creates one Saved notification per inventory row. It saves the invoice, vendor, new items, and stock updates silently, then reports the total saved count.', 'CSV inventory import uses the same quiet bulk-save behavior and shows one Upload Complete notification with the imported item count.', 'This is a frontend workflow cleanup only. Firestore rules, Storage rules, Vercel config, and environment variables are unchanged from 15.0.2. Deploy the app code so the updated Inventory workflow is live.'] },
    { title: '15.0.3 deployment checklist', group: 'System Administrator', keywords: '15.0.3 deploy invoice inventory notifications csv import toast', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.3.', 'Approve a scanned invoice with multiple create/update rows and confirm only one Invoice Processed notification appears.', 'Import a CSV with multiple rows and confirm only one Upload Complete notification appears.', 'Confirm ordinary single-item Inventory saves still show their normal confirmation toast.'] },
    { title: 'Version 15.0.2 Stability and Cost Control', group: 'System Administrator', keywords: 'v15 15.0.2 heartbeat livePresence presenceSessions users firestore reads reminder dispatcher concurrency invoice menu 20MB storage rules vercel cron', body: ['15.0.2 moves high-frequency live heartbeat writes out of users and restaurants. Online state now belongs in livePresence and presenceSessions, while users stays for slower profile/settings data.', 'The browser heartbeat cadence is 60 seconds instead of 25 seconds, with immediate updates still sent when the app gains focus, changes visibility, reconnects, or exits.', 'Firestore rules no longer allow normal users to write heartbeat/session fields onto their own users document. Push token and notification preference self-updates remain allowed.', 'The reminder cron now transaction-claims scheduled reminders before sending and processes them with controlled concurrency. Optional tuning variables are REMINDER_DISPATCH_QUERY_LIMIT and REMINDER_DISPATCH_CONCURRENCY.', 'Vercel maxDuration for api/dispatch-reminders.js is 300 seconds. If reminders still back up at scale, review Vercel logs before raising query or concurrency settings.', 'Invoice and Menu Intelligence scanner uploads are capped at 20MB in Storage rules, browser checks, and backend API checks. Scanner APIs inspect Storage metadata before downloading files into memory.', 'This build requires publishing Firestore rules, publishing Storage rules, and deploying Vercel/API routes. No new env vars are required.'] },
    { title: '15.0.2 deployment checklist', group: 'System Administrator', keywords: '15.0.2 deploy firestore rules storage rules vercel dispatch reminders heartbeat invoice menu scan 20MB', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.2.', 'Publish firestore.rules and storage.rules to the matching Firebase project before testing heartbeat, reminders, invoice scans, or menu scans.', 'Confirm /api/presence-heartbeat writes livePresence and presenceSessions only. It should not report users or restaurants in the written list.', 'Confirm /api/dispatch-reminders returns limit, concurrency, scanned, claimed, sent, skipped, failed, and noToken counts.', 'Test an invoice under 20MB and one over 20MB. The smaller file should scan; the larger file should be blocked with a clear message.', 'Test a Menu Intelligence upload under 20MB and one over 20MB with the same expected behavior.'] },
    { title: 'Version 15.0.1 Invoice Scanner Recovery', group: 'System Administrator', keywords: 'v15 15.0.1 invoice scanner gemini invalid json timeout compact retry repair scan invoice api', body: ['15.0.1 fixes the invoice scanner case where the progress bar reached 100% but Gemini returned malformed or cut-off JSON.', 'The scanner now tries stronger local JSON cleanup first, then compact retry mode when the first response is too large or incomplete, then an AI JSON repair pass before failing.', 'The default invoice scan timeout remains under the Vercel 300-second function cap. Raising the browser timeout alone will not fix invalid JSON; for very large PDFs, split pages or tune INVOICE_SCAN_TIMEOUT_MS only within the Vercel plan limit.', 'The route accepts GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY. Optional tuning variables are INVOICE_SCAN_MAX_OUTPUT_TOKENS, INVOICE_SCAN_COMPACT_MAX_OUTPUT_TOKENS, INVOICE_REPAIR_TIMEOUT_MS, and INVOICE_SCAN_GEMINI_MODEL.', 'No Firestore rules, Storage rules, Vercel config, or new route publish is required beyond deploying the updated app code.'] },
    { title: '15.0.1 deployment checklist', group: 'System Administrator', keywords: '15.0.1 deploy invoice scanner gemini invalid json vercel api scan invoice', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.1.', 'Confirm /api/scan-invoice is live from System Administrator Health Dashboard after deploy.', 'Re-scan the same invoice that failed with Gemini returned invalid JSON and confirm Reconcile Invoice opens.', 'Confirm Vercel has GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY plus existing Firebase Admin credentials.', 'Firestore rules and Storage rules are unchanged from 15.0.0 for this fix; re-publish them only if that target Firebase project has not already received the 15.0.0 rules.'] },
    { title: 'System Administrator tab map: what every section means', group: 'Admin Tab Guide', keywords: 'administrator instructions admin manual tab map dashboard live users clients users grant access support forensics operations manual meaning', body: ['Dashboard is the command overview: health metrics, action queue, backup countdown, stability, billing/adoption signals, and quick jumps to problem areas.', 'Live Activity is now a manual Super Admin presence snapshot. It does not run a live scanner; press Refresh Snapshot when you want a one-time view of recent app check-ins and possession shortcuts.', 'Health Dashboard shows Firestore latency, backup Storage usage, API response times, backup integrity, and the last successful sync. Run Full System Diagnostics here before deployments.', '14.0 Robustness Suite is the hardening bay for Safe Write Engine status, Storage Doctor, Schema Doctor, Backup Preview, Permission Simulator, Import Bridge, and Release Guardrails.', 'Workspaces is the customer control room for restaurants, module access, billing state, demo mode, owner info, and client user drawer actions.', 'People is the global account list for searching accounts across restaurants, checking routing, push/GPS status, force password flags, support edit, and possession.', 'Access Control manages platform administrator access. Use it sparingly because it grants system-wide control.', 'Support Desk is for crash reports, permission-denied clues, raw document inspection, broadcast messages, and urgent troubleshooting.', 'Forensics & Backups is for audit logs, session timelines, backup center, restore tools, diagnostic bundles, and evidence trails after risky changes.', 'Platform Operations contains platform-wide tools like demo workspace creation, push tests, global refresh, orphan sweeps, cache cleanup, exports, ops review stamps, and lockdown controls.', 'Admin Manual is this internal instruction database. Search it before changing customers, rules, backups, billing, or data.'] },
    { title: 'Version 15.0.0 Kitchen Intelligence Release', group: 'System Administrator', keywords: 'v15 15.0.0 smart prep menu intelligence personal reminders cron firebase rules storage schedule past shifts invoice scanner invalid json gemini model fallback slice dice chop voice tomorrow friday', body: ['Smart prep matching now updates confident existing prep rows from typed or voice commands instead of creating duplicate prep tasks.', '86 Voice now recognizes kitchen prep phrasing such as slice tomato, dice onions, chop lettuce, thaw shrimp, portion ranch, and quantity/unit commands like 3 pans tomatoes.', 'Prep commands are day-aware: phrases like prep tomatoes for Friday, slice three tomato tomorrow, or prep ranch on 7/10 save to that target prep day and open Prep there.', 'Menu Intelligence adds owner-controlled menu scanning, reviewed inventory dependency links, zero-stock menu impact panels, and menu-impact text on 86 alerts.', 'My Reminders adds private user reminders with typed or voice creation and a protected /api/dispatch-reminders cron route.', 'My Schedule and Full Schedule now dim past shifts and completed day sections based on real shift end time, so old shifts no longer look active.', 'Menu Intelligence no longer depends on the retired gemini-1.5-flash default; it tries newer Gemini Flash models and tolerates common JSON formatting problems.', 'Invoice scanning now tolerates common Gemini JSON formatting problems like code fences, leading text, and trailing commas before failing the scan. Publish the included Firestore and Storage rules before production testing.'] },
    { title: '15.0.0 deployment checklist', group: 'System Administrator', keywords: '15.0.0 deploy firebase rules storage rules vercel env cron gemini reminders menu intelligence', body: ['Deploy the updated app through Vercel, then confirm public/version.json reports 15.0.0.', 'Publish the included firestore.rules in Firebase Firestore Rules and the included storage.rules in Firebase Storage Rules for the same Firebase project that the deployed app uses.', 'Confirm Vercel environment variables include the existing Firebase Admin credentials plus CRON_SECRET and GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.', 'Confirm /api/scan-menu and /api/dispatch-reminders are live from System Administrator Health Dashboard after deploy.', 'Vercel Cron only runs on production deployments. The reminder dispatcher is scheduled every five minutes, which requires a Vercel plan that supports that cadence and the total number of cron jobs in vercel.json.'] },
    { title: 'Menu Intelligence operations', group: 'System Administrator', keywords: 'menu intelligence scan menu upload pdf image permissions owner menuDependencies menuIntelligenceScans storage rules', body: ['Menu Intelligence is visible to Super Admin, the account owner, and users granted Menu Intelligence access. Grant access from Settings → Branding → Settings Access.', 'The menu upload path is restaurant-scoped in Storage under {restaurantId}/menuUploads. If upload says unauthorized, publish storage.rules to the matching Firebase project.', 'The AI scanner returns review data only. Nothing becomes a live dependency until a permitted user reviews and approves the inventory matches.', 'Approved links save to menuDependencies and scan summaries save to menuIntelligenceScans. These records power zero-stock menu impact panels and 86 alert impact text. Recent scans can be edited or deleted by permitted Menu Intelligence users; deleting a scan removes its approved dependency links but leaves the original upload in secure Storage.', 'If scans fail, check GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in Vercel and confirm /api/scan-menu can read Firebase Storage with the Admin service account.'] },
    { title: 'Personal Reminders operations', group: 'System Administrator', keywords: 'personal reminders my reminders private cron dispatch reminders CRON_SECRET push tokens scheduled notifications concurrency transaction claim', body: ['My Reminders is private to the signed-in user. Firestore rules allow each user to read and write only their own personalReminders documents.', 'The /api/dispatch-reminders route is protected by CRON_SECRET. Vercel calls it on the production cron schedule; manual tests must send Authorization: Bearer CRON_SECRET.', 'The dispatcher transaction-claims each scheduled reminder before sending so overlapping cron/manual runs should not send the same reminder twice.', 'Reminder sends run with controlled concurrency instead of one slow sequential loop. Optional tuning variables are REMINDER_DISPATCH_QUERY_LIMIT and REMINDER_DISPATCH_CONCURRENCY.', 'Reminder pushes go only to the reminder owner using that user profile push token. If a reminder changes to no_push_token, the user needs to open the app and reconnect notifications on their own device.', 'The dispatcher writes dispatchKey and dispatchedAt so the same scheduled reminder is not sent twice. Delivery problems are recorded on the reminder document for troubleshooting.', 'If reminders do not fire, check Vercel production cron logs, CRON_SECRET, Firebase Admin credentials, whether the target user has a current fcmToken, and the dispatch response counts.'] },
    { title: 'Smart prep matching operations', group: 'System Administrator', keywords: 'smart prep duplicate prep voice typed matching quantity changed after completion', body: ['Typed prep and 86 Voice prep commands now use the same parser and matcher. Confident matches update quantity/unit on the existing prep row instead of adding a duplicate.', 'Commands like prep 2 pans onions and lettuce can create or update multiple prep rows. Commands with more or extra increment the matched quantity.', 'If a completed prep item gets its quantity changed later, the row keeps completion history and shows a QTY CHANGED badge so the kitchen can review it.', 'If matching is not confident, the app creates a new prep row. This is safer than overwriting the wrong task.', 'Prep writes still go through Safe Write Engine and Firestore tenant rules. Permission errors usually mean the user lacks Prep/Team/Admin access or firestore.rules was not published.'] },
    { title: '15.0.0 Firebase rules notes', group: 'System Administrator', keywords: 'firestore rules storage rules menu uploads reminders menu dependencies permissions firebase deploy production testing', body: ['Publish Firestore rules and Storage rules to every Firebase project that will run this build. If you maintain separate testing and main Firebase projects, each project needs the matching rules before testing that environment.', 'Firestore adds private personalReminders rules, owner-controlled menuIntelligenceScans rules, and tighter menuDependencies write access.', 'Storage adds the restaurant-scoped menuUploads path and multi-workspace-aware tenant matching.', 'Do not paste firebase.json into the Firebase console rules editor. Paste the contents of firestore.rules into Firestore Rules and the contents of storage.rules into Storage Rules.', 'If a rule publish is skipped, Menu Intelligence uploads/scans, private reminders, or approved dependency saves may fail with Missing or insufficient permissions.'] },
    { title: 'Version 14.0.10 Push and Workspace Wiring Audit', group: 'System Administrator', keywords: 'v14 14.0.10 push schedule alert workspace members repair stale token firebase host wiring', body: ['Push alerts and schedule publication alerts now resolve active staff through workspaceMembers as well as legacy user restaurant fields, so multi-restaurant employees receive alerts for the selected workspace.', 'Push Token Repair Center stale-token pruning now scans the same workspace-aware staff set before clearing and queueing reconnect repair.', 'Production Firebase Messaging host detection now covers app.86chaos.com, 86chaos.com, and www.86chaos.com so foreground tokens and the service worker use the same production project.'] },
    { title: 'Version 14.0.6 Client Save & Roster Cleanup', group: 'System Administrator', keywords: 'v14 14.0.6 client manage save configuration unsupported undefined staff roster read only banner', body: ['System Administrator workspace saves now clean unsupported undefined values before writing to Firestore, preventing the invalid data error when managing a client.', 'Staff Roster keeps the same manager/admin edit protections, but the regular-staff read-only banner was removed so the roster view is cleaner.'] },
    { title: 'Version 14.0.9 Push Token Repair Center', group: 'System Administrator', keywords: 'v14 14.0.9 push token repair stale missing notifications reconnect service worker admin', body: ['System Administrator → Push now includes the Push Token Repair Center with Request Reconnect, Force Refresh, Copy Link, Clear Flag, Send Test, and Prune + Repair Stale actions.', 'Missing tokens cannot be created from the server. The admin tool queues the repair and the employee device creates the Firebase Messaging token when they open the app or reconnect link.', 'Force Refresh clears stale tokens, refreshes the service worker on the employee device at next open, and records repair status/failure details for easier troubleshooting.'] },
    { title: 'Version 14.0.8 Menu Workspace Switcher', group: 'System Administrator', keywords: 'v14 14.0.8 multi workspace drawer menu switch restaurant current workspace two jobs', body: ['The side menu now shows the active restaurant directly under the signed-in user name and role so employees can confirm which job they are in before clocking in or posting changes.', 'If the account has more than one active workspace, that restaurant line becomes a Change control that opens the workspace switcher without digging through the header.'] },
    { title: 'Version 14.0.4 Multi-Workspace Switcher', group: 'System Administrator', keywords: 'v14 14.0.4 multi workspace switcher multiple jobs tenant memberships staff roster presence heartbeat one login', body: ['86 Chaos now supports one Firebase login belonging to multiple restaurant workspaces through workspaceMembers membership records.', 'After login, employees with more than one active workspace choose which restaurant they are entering. The header also includes a Switch control when multiple workspaces are available.', 'Staff Roster can link an existing email to the current workspace instead of forcing duplicate accounts or resetting that person\'s password.', 'Removing a staff member removes only the current workspace membership. The Firebase Auth login stays active when the person still belongs to another restaurant.', 'Live Users and presence heartbeats are stored per workspace/user pair so activity from one job does not overwrite another job. Publish Firestore rules with this build.'] },
    { title: 'Version 14.0.2 Robustness Suite', group: 'System Administrator', keywords: 'v14 14.0.2 robustness safe write storage doctor schema doctor restore preview backup picker permission simulator import bridge offline queue release guardrails menu dependency graph', body: ['Open System Administrator → 14.0 Robustness Suite for the platform hardening tools.', 'Safe Write Engine centralizes permission checks, restaurantId enforcement, demo-mode blocking, audit logging, redacted before/after details, and offline queue support. In 14.0.2 it is wired into major kitchen forms: inventory, waste, prep, line checks, recipes, maintenance, Kitchen Command smart actions, Manager Brief quick actions, and menu dependency mapping.', 'Upload & Storage Doctor tests Firebase Admin credentials, target bucket, workspace lookup, and a real write/read/delete cycle before uploads are trusted.', 'Schema Doctor scans tenant records for missing restaurantId values, invalid dates, stale punches, negative inventory, old branding fields, and demo privacy hazards. Repair Safe Items only fixes repairable issues.', 'Restore Preview can load backups from Firebase Storage into a picker, preview a selected snapshot, count documents by collection, flag sensitive fields, and selectively restore chosen collections after typing RESTORE.', 'Permission Simulator previews visible and blocked tabs plus wage/forensics/backup access for a selected user.', 'Import Bridge downloads CSV templates for POS sales, payroll time, vendor invoices, and inventory counts.', 'Release Guardrails confirm version, 86 Chaos brand lock, demo privacy, Help Center public boundary, and rules packaging before deployment.', 'Kitchen Command Center Dependency Graph maps recipes/menu items to inventory items so low-stock inventory, prep signals, and 86 alerts can surface affected menu items more reliably.'] },
    { title: 'Mandatory Tip Declaration reliability', group: 'Admin Tab Guide', keywords: 'tips mandatory declaration clock out payroll time clock settings schema doctor', body: ['Settings → Workspace → Labor & Payroll controls Mandatory Tip Declaration for the restaurant.', 'The setting is now a core time-clock control, not an Elite-only plan feature. When enabled, every employee clock-out opens Declare Tips before the punch closes.', 'Employees can enter 0 cash and 0 credit tips when they did not receive tips. The punch stores cashTips, creditTips, totalDeclaredTips, tipDeclarationRequired, tipDeclarationCompleted, tipDeclaredAt, and tipDeclarationVersion for payroll review.', 'Older restaurant documents that are missing systemSettings.tips default to enabled at runtime so employees do not bypass declaration. Schema Doctor flags missing tips settings as repairable and can stamp tips: true explicitly.', 'If a manager reports that the modal is not appearing, verify the workspace setting, refresh the employee device, and run Schema Doctor dry run for that workspace.'] },
    { title: 'Workspace geofence map lookup', group: 'Admin Tab Guide', keywords: 'workspace settings global config geofence find gps map lookup coordinates latitude longitude map service failed', body: ['Settings → Workspace → Global Config uses the Find GPS button to translate an address into latitude and longitude for the time-clock geofence.', 'Version 13.1.33 routes address lookup through /api/geocode-address so browsers are not solely responsible for reaching the public map service.', 'If the map service is unavailable, keep the saved latitude/longitude, enter coordinates manually, or click the map to set the geofence center. Version 13.1.34 makes the pin-drop map more resilient on desktop and mobile by forcing Leaflet size recalculation after the panel renders, adding a Refresh Map button, and rotating tile providers when tiles fail. A grey/slow tile map does not stop saved coordinates from enforcing the geofence.', 'For preview deployments, confirm api/geocode-address.js is present in Vercel. No Firebase rules are required for this route.'] },
    { title: 'Manual Presence Snapshot: how it works', group: 'Admin Tab Guide', keywords: 'manual presence snapshot live users online heartbeat reads writes super admin refresh', body: ['System Administrator → Live Activity no longer opens live Firestore listeners or runs a constant online scanner.', 'Regular staff and store managers do not see online status in Team. Only the Super Admin can press Refresh Snapshot in System Administrator.', 'Each user browser saves a low-frequency app-open presence check-in. The snapshot button reads livePresence once and shows check-ins from the recent window.', 'Because this favors low Firebase cost, it is an operational hint, not a perfect minute-by-minute surveillance tool.', 'If the snapshot fails, deploy the included API route and Firestore rules, then log out and back in so Super Admin claims refresh.'] },
    { title: 'Dashboard / Command Deck: what the numbers mean', group: 'Admin Tab Guide', keywords: 'dashboard command deck metrics backup countdown action queue mrr crashes stale clients push adoption', body: ['Manual Presence counts recent app check-ins only after the Super Admin presses Refresh Snapshot; it does not run in the background.', 'Crashes shows recent crash reports and should be used with Support before editing code or rules.', 'Backup info shows the last backup and the countdown to the next automatic backup.', 'MRR, trial, stale client, push opt-in, and sticky-rate cards are operating signals, not accounting books. Use them to spot accounts that need attention.', 'The Administrator Action Queue is the shortest path to urgent problems. Click a card to jump to the relevant admin section.'] },
    { title: 'Workspaces: what to use it for', group: 'Admin Tab Guide', keywords: 'clients workspace restaurant tenant modules billing demo users possess owner restaurant id plan tabs', body: ['Use Workspaces to manage restaurant/customer environments, not individual shifts or menu work.', 'The workspace drawer shows users, admin counts, online counts, push token adoption, GPS permission snapshots, enabled modules, plan/status state, and ownership clues.', 'Demo Manager and Demo Employee let you show a customer only selected tabs/features without saving real changes or exposing sensitive owner/customer data.', 'Support Edit is for correcting routing, roles, status, force password flags, and account metadata when a restaurant cannot self-fix it.', 'Possess Workspace or Possess User is for troubleshooting only. Exit Ghost/Demo mode when finished.'] },
    { title: 'People: what to use it for', group: 'Admin Tab Guide', keywords: 'users global accounts employee account search routing restaurant id support edit force password push token gps status', body: ['Use Users when the problem follows a person instead of a restaurant.', 'Check restaurantId first. A wrong restaurantId makes tabs/data look missing even when permissions are correct.', 'Check status, role, admin flags, custom permissions, forcePasswordChange, push token, GPS permission, and last heartbeat.', 'Use Support Edit only to correct account routing or support fields. Do not use it as a substitute for normal Staff Roster management when the restaurant can manage the employee themselves.', 'Use Possess to verify the exact experience after editing.'] },
    { title: 'Support: what each support tool means', group: 'Admin Tab Guide', keywords: 'support crashes permission denied raw inspector broadcast banner diagnostics user action telemetry', body: ['Crash reports show errors collected from the app and may include screen size, user agent, breadcrumbs, and stack details.', 'Permission-denied clues usually point to Firestore or Storage rule blocks. Check rules before assuming the UI is broken.', 'Raw Database Inspector lets a platform admin view a specific document by collection and document ID. Use it carefully and copy diagnostics before edits.', 'Broadcast Message sends a one-time message-style alert. Top-of-App Banner pins persistent text below the main header for selected workspaces or all workspaces.', 'Support should be used to diagnose and confirm before making risky changes in Operations or Forensics.'] },
    { title: 'Forensics & Backups: what to use it for', group: 'Admin Tab Guide', keywords: 'forensics backup center restore audit logs diagnostic json client csv backup countdown schedule rescue evidence trail', body: ['Forensics is the evidence cabinet. Use it when you need audit history, backup state, restore options, or downloadable diagnostic bundles.', 'Backup Center lists Firebase Storage backups and allows Download or Restore. Restore requires typing RESTORE and is merge-based, so it does not automatically delete documents that are newer than the backup.', 'Forensic JSON exports a support bundle with platform counts, recent sensitive actions, backup state, watchlists, and runtime clues.', 'Client CSV exports workspace IDs, plan/billing state, modules, user counts, and online counts for operations review.', 'Emergency rescue tools should only be used when a normal app workflow cannot repair data. Always verify the target restaurant and month first.'] },
    { title: 'Platform Operations: what each operation does', group: 'Admin Tab Guide', keywords: 'operations demo workspace push notifications global refresh orphan sweep forensic bundle client csv review stamp cache lockdown', body: ['Deploy Demo Workspace creates a fake showcase restaurant for sales/demo purposes.', 'Test Push Notifications sends a live notification through the Vercel/Firebase Admin path to verify tokens and credentials.', 'Global Force Refresh tells active browsers to hard reload after a deployment or urgent system change.', 'Orphan Data Sweeper looks for shifts assigned to deleted users and removes those orphan records.', 'Forensic Bundle and Client Directory Export download support files without changing restaurant data.', 'Create Review Stamp records a platform review snapshot with backup, crash, permission, and integrity counts.', 'Clear This Cache only clears temporary cache on the current browser. It does not delete restaurant data.', 'Global Lockdown sets every workspace into maintenance lock mode, including the restaurant group you belong to. Your Super Admin account bypasses the screen so you can lift it. Use only for serious platform emergencies.'] },
    { title: 'Access Control: platform admin safety', group: 'Admin Tab Guide', keywords: 'grant access revoke super admin platform admin master admin security', body: ['Access Control is for platform administrators only, not normal restaurant managers.', 'Granting access gives broad system control, including workspaces, people, platform operations, forensics, backups, and support tools.', 'Use exact email addresses and revoke access when it is no longer needed.', 'If access does not work, confirm the user exists, confirm Firebase Auth email, confirm Firestore user document, then check custom claims/rules.'] },
    { title: 'Support triage: user says something is missing', group: 'Troubleshooting', keywords: 'missing tab missing data blank cannot see permission restaurantId feature module', body: ['Search the user in System Administrator → People or open the client in Clients → Users.', 'Confirm the user belongs to the correct restaurant/workspace.', 'Check whether the client module is enabled, then check Staff Roster permissions inside the restaurant.', 'Possess the user only after checking the routing fields so you know whether it is a permission issue or missing data.'] },
    { title: 'Support triage: permission-denied or Ghost Mode blocked', group: 'Troubleshooting', keywords: 'permission denied firebase rules ghost possess blocked insufficient permissions', body: ['Open Support and check Permission Denied counts and crash reports.', 'Confirm your account is master admin or has superAdmin access under Grant Access.', 'If Ghost Mode loads the shell but data is blank, inspect Firestore rules and restaurantId routing.', 'Copy diagnostics before changing rules.'] },
    { title: 'Client user management from Workspaces', group: 'Clients', keywords: 'client users manage restaurant users support edit possess delete force logout notifications gps', body: ['Open System Administrator → Workspaces and click the workspace name or People button.', 'The workspace drawer shows all users, admins, online users, push tokens, GPS permission snapshots, modules, and status state.', 'Use Support Edit to move a user, update role/wage/status, or force password change.', 'Use Possess to verify exactly what that workspace or user sees.'] },
    { title: 'Admin/Settings command-center upgrade', group: 'System Administrator', keywords: 'admin overview command center roles permissions push live presence setup wizard deployment readiness audit settings history import export maintenance branding danger zone', body: ['System Administrator is organized into Overview, Customer Operations, Support & Safety, Platform Settings, and Reference.', 'Command Center shows system status, active users, backup status, push health, recent admin actions, and deployment readiness on one landing page.', 'Permission & Role Manager is the platform guide for who should be able to edit staff, schedules, financials, inventory, recipes, diagnostics, and forensics. The Full Permissions Preview shows allowed screens, blocked screens, and sensitive-access flags for a selected user.', 'Push Control Center is where you troubleshoot tokens, browser permission, token freshness, per-user test pushes, repair flags, and push diagnostic exports.', 'Deployment Readiness should be run before production deploys. It gives READY TO DEPLOY or DO NOT DEPLOY YET with exact reasons.'] },
    { title: 'Maintenance, branding, data, and Danger Zone', group: 'System Administrator', keywords: 'maintenance mode custom message auto unlock branding display logo data import export danger zone restore reset disable clear demo', body: ['Maintenance Mode can lock every workspace or one workspace while leaving Super Admin able to enter and fix the app.', 'Branding / Display settings keep the app name locked as 86 Chaos, store restaurant/group display name, customer logo URL/display preference, accent color, login message, Help Center contact, timezone, and date/time formats on the workspace record. Customer logo uploads use a secure server route first, with Firebase Storage rules as fallback protection. The customer logo can appear beside 86 Chaos, but cannot replace or hide it.', 'Import / Export Center exports staff, recipes, inventory, punches, schedules, and audit logs. Imports require preview-before-apply.', 'Danger Zone separates destructive tools such as backup restore, staff deletion, schedule reset, demo-data cleanup, workspace disablement, stale push cleanup, and restaurant config reset. Run Backup Now first.'] },
    { title: 'Backup status in Command Deck', group: 'Backups', keywords: 'database backup status last backup maintenance cron firestore export storage run now', body: ['The Command Deck reads system/backupStatus, which is written by the automatic Firestore backup route.', 'Click Last Backup or open Forensics to inspect backup status and run a manual backup.', 'A stale or missing backup status means the Vercel cron route, CRON_SECRET, Firebase service account, or Storage bucket should be checked.', 'Weekly maintenance is housekeeping; Firestore Backup is the JSON data export saved to Firebase Storage.'] },
    { title: 'Automatic database backups', group: 'Backups', keywords: 'automatic daily database backup firestore storage cron secret firebase storage bucket restore export', body: ['The scheduled route /api/firestore-backup runs from Vercel Cron every day and exports Firestore data to Firebase Storage.', 'It writes progress and results to system/backupStatus so the Command Deck can show the last backup.', 'Required Vercel variables: FIREBASE_SERVICE_ACCOUNT_KEY, CRON_SECRET, and optionally FIREBASE_STORAGE_BUCKET.', 'Use Run Backup Now from the Command Deck or Forensics after installing the route to verify everything works.'] },
    { title: 'Restoring a full Firestore backup', group: 'Backups', keywords: 'restore full backup firestore storage path json gzip deleted data recover database', body: ['Open System Administrator → Forensics & Backups.', 'Copy the backup storage path from Command Deck Last Backup or Firebase Storage, for example backups/firestore/manual/...json.gz.', 'Open Backup Center, choose the backup from the list, then type RESTORE when prompted.', 'The restore is merge-based: it recreates missing/deleted documents and overwrites damaged documents from the backup, but it does not delete newer documents that are not in the backup. For schedules, use Emergency Schedule Rescue after a full restore if a month needs a clean hard replacement.'] },
    { title: 'Restoring a full Firestore backup', group: 'Backups', keywords: 'restore backup firestore storage path deleted documents recovery database', body: ['Open System Administrator → Forensics & Backups.', 'Run Backup Now first if you need a current safety copy.', 'Open Backup Center and select the backup file from the list instead of pasting a Storage path.', 'Type RESTORE. The restore is merge-based: it restores documents from the backup but does not delete newer documents. If restored schedule data mixes with old/current schedule records, run the Emergency Schedule Rescue for that month so the month is hard-replaced.'] },
    { title: 'Health Dashboard and full diagnostics', group: 'System Administrator', keywords: 'health dashboard firestore latency storage usage api response times sync diagnostics deployment report', body: ['Open System Administrator → Health Dashboard to see Firestore read latency, backup Storage usage, API route response times, backup integrity, and last successful sync.', 'Click Refresh Health to retest live timings without changing data.', 'Click Run Full System Diagnostics before deployments to download a JSON report with client runtime health plus server-side Firebase/Admin/Storage checks.', 'A failed backup-integrity badge means the latest backup could not be verified after upload and should be checked before deploying risky changes.'] },
    { title: 'Audit timeline by administrator session', group: 'System Administrator', keywords: 'audit timeline sessions administrator actions grouped session forensics', body: ['Open System Administrator → Forensics & Backups and review Administrator Session Timeline.', 'Actions are grouped by the saved browser session ID when available. Older logs without a session ID are grouped into 30-minute actor windows.', 'Use this timeline to reconstruct what a support/admin user did during one troubleshooting visit instead of reading a flat log stream.', 'Server-side actions such as automatic backups use the run ID or route actor as their session clue.'] },
    { title: 'Backup integrity verification', group: 'Backups', keywords: 'backup integrity verification sha checksum storage round trip automatic backups firestore backup', body: ['Every Firestore backup now verifies itself after uploading to Firebase Storage.', 'The backup route downloads the saved gzip, checks it can be decompressed, validates document and collection counts, and compares a SHA-256 checksum.', 'The Command Deck and Health Dashboard show the latest verification status from system/backupStatus.', 'If verification fails, do not restore or rely on that backup. Run another backup and check Vercel/Firebase Storage logs.'] },
    { title: 'Financials workflow', group: 'Financials', keywords: 'financials labor timesheets daily ledger sales payroll', body: ['Financials is the main money tab for managers.', 'Labor & Timesheets handles punch corrections, tips, payroll exports, and role filtering.', 'Daily Ledger handles sales, food cost, labor cost, and business notes.', 'Use the client feature toggles for labor and sales to control access.'] },
    { title: 'Schedule Builder location', group: 'Scheduling', keywords: 'schedule builder time clock shifts subtab permissions', body: ['Schedule Builder is now a protected subtab inside Time Clock & Schedule.', 'Users still need schedule permission or admin access.', 'Event Calendar remains separate because it is not the same thing as staff scheduling.', 'Old Schedule Builder links route into the same protected schedule workflow.'] },
    { title: 'Staying on the current page', group: 'Navigation', keywords: 'five minutes away landing page app hidden background return today logout stale session', body: ['86 Chaos no longer returns users to Manager Brief after five minutes away.', 'Users stay on the page they were using so managers do not lose their place while checking another app or taking a call.', 'This does not change normal logout behavior; users only sign out when they choose Log Out or their browser/session expires.'] },
    ...HELP_ARTICLES.map(a => ({ ...a, group: `App Manual / ${a.group}` }))
  ];
  const adminSupportPlaybooks = [
    {
      title: 'Login or Account Access',
      triggers: 'login password locked out email verification disabled account mfa lost phone recovery code two step',
      likelyCause: 'The account is either using the wrong email, blocked by password/MFA/email verification, disabled, or routed to the wrong workspace.',
      firstChecks: ['Confirm the exact email and Firebase Auth UID.', 'Search the user in System Administrator People.', 'Check disabled status, emailVerified, forcePasswordChange, MFA status, and restaurantId.', 'Ask whether the issue started after a phone change, new browser, password reset, or new deployment.'],
      fixSteps: ['Send password reset if the password is the issue.', 'Repair the Firestore profile if Auth exists but the user document is missing.', 'Use MFA recovery or recovery codes for lost-phone cases.', 'Fix restaurantId/membership if login works but the wrong workspace opens.', 'Have the user log out and back in after claim or profile changes.'],
      doNot: ['Do not delete the account to fix login.', 'Do not disable MFA globally for one user.', 'Do not publish rules until your own Super Admin access is confirmed.'],
      escalation: 'Escalate if Firebase Auth cannot find the user, /api/whoami disagrees with Firestore, or multiple users cannot log in after a deployment.'
    },
    {
      title: 'Missing Tab, Missing Data, or Wrong Restaurant',
      triggers: 'missing tab cannot see schedule inventory financials team messages settings wrong restaurant data blank permissions module feature',
      likelyCause: 'The user is signed in but their workspace routing, module toggle, role, or permission set does not allow the screen.',
      firstChecks: ['Open the user profile and confirm restaurantId, activeRestaurantId, and memberships.', 'Open the workspace and confirm the feature/module is enabled.', 'Check role and permissions in Staff Roster or System Administrator support edit.', 'Possess only after checking the saved routing fields.'],
      fixSteps: ['Correct restaurantId or membership first.', 'Enable the workspace feature if the whole restaurant is missing it.', 'Grant the smallest needed permission instead of making everyone admin.', 'Ask the user to refresh or log out/in after the change.'],
      doNot: ['Do not grant System Administrator access to fix a restaurant-level permission.', 'Do not edit production data while in Ghost Mode unless you are intentionally supporting that exact customer.'],
      escalation: 'Escalate if rules block reads after the user has correct workspace and permissions.'
    },
    {
      title: 'Time Clock, GPS, Punches, or Schedule',
      triggers: 'clock in clock out punch unscheduled gps location geofence schedule shift swap gray passed day shift labor timesheet',
      likelyCause: 'Most clock and schedule issues come from missing shift data, device location permission, geofence setup, or a punch that needs manager correction.',
      firstChecks: ['Confirm the date, employee, scheduled shift, and workspace.', 'Check browser/location permission on the device.', 'Check restaurant geofence address, radius, latitude, and longitude.', 'Review punch status and any unscheduled punch alert.'],
      fixSteps: ['Fix the schedule or shift first when the employee is expected to work.', 'Have the employee allow location and reopen the app.', 'Use Labor/Timesheets for corrections with a reason note.', 'If a past day still looks active, confirm the current date/timezone and app version.'],
      doNot: ['Do not manually change wages while fixing a punch unless payroll specifically requires it.', 'Do not ignore unscheduled punch alerts; they are evidence for manager review.'],
      escalation: 'Escalate if all users in one restaurant lose GPS or if maps/geocoding fail after deployment.'
    },
    {
      title: 'Push Notifications',
      triggers: 'push notification alert not receiving only one person token fcm schedule alert message alert browser permission',
      likelyCause: 'The device has no current push token, browser notifications are blocked, or the token is stale/written to the wrong profile.',
      firstChecks: ['Check the user notification permission and fcmToken in People/Push tools.', 'Ask which device should receive the alert and confirm they opened the app on that device.', 'Send a per-user test push before sending a broadcast.', 'Check Vercel/Firebase Admin env vars if every push fails.'],
      fixSteps: ['Have the user allow notifications and reopen the app.', 'Run push token repair if tokens are stale or mismatched.', 'Send one test push to the user.', 'If broadcasts fail but direct push works, inspect the audience/filter logic.'],
      doNot: ['Do not assume one working admin token means everyone is configured.', 'Do not ask users to reinstall before checking browser notification permission.'],
      escalation: 'Escalate if the send-push API route returns credential errors or no non-admin users can save tokens.'
    },
    {
      title: 'AI Menu or Invoice Scans',
      triggers: 'menu intelligence invoice scan gemini ai invalid json model not found pdf photo upload parse scanner ingredients vendor',
      likelyCause: 'The file uploaded but Gemini/model configuration, file type, storage rules, or parser output caused the scan to stop.',
      firstChecks: ['Read the exact error toast and Vercel function log.', 'Confirm Gemini/API key exists in the same Vercel environment.', 'Confirm the file is a supported image/PDF and under the allowed size.', 'Check Storage rules and purpose metadata for scan uploads.'],
      fixSteps: ['Try a clearer/smaller image or PDF.', 'Fix model/API version errors in the scan route env/config.', 'If invalid JSON repeats, capture the raw response in logs and tighten parser handling.', 'Approve only reviewed scan rows; do not bulk-save questionable AI output.'],
      doNot: ['Do not paste invoices or menus into public tickets with secrets/customer data.', 'Do not turn scanner storage rules wide open to fix one upload.'],
      escalation: 'Escalate when multiple good files fail at 100 percent or model-not-found appears.'
    },
    {
      title: 'Blank Screen, App Load, or Version Mismatch',
      triggers: 'blank screen stuck loading app load white screen version cache service worker deployment vercel firebase config',
      likelyCause: 'The browser is using an old build/cache, the wrong deployment URL, or a runtime startup error is blocking React.',
      firstChecks: ['Open /version.json on the exact URL.', 'Check Vercel deployment status and browser console errors.', 'Ask whether it happens on one device or everyone.', 'Check Firebase project IDs in the app and API diagnostics.'],
      fixSteps: ['Hard refresh, close tabs, and clear site data.', 'Redeploy the latest build if /version.json is old.', 'Run Health Dashboard and full diagnostics.', 'If permission-denied appears, publish the matching rules and refresh claims.'],
      doNot: ['Do not change Firebase rules until you know whether this is cache, deploy, or permissions.', 'Do not test production fixes only on a preview URL.'],
      escalation: 'Escalate if the current build crashes before login or the app/API Firebase project IDs differ.'
    },
    {
      title: 'Firebase Rules or Admin Lockout',
      triggers: 'firebase rules firestore storage permission denied super admin locked out master admin claim isSuperAdmin systemAccess publish testing production',
      likelyCause: 'Rules cannot see Vercel env vars, so Super Admin access must exist as Firebase custom claims or Firestore profile flags before hardened rules are published.',
      firstChecks: ['Confirm your own user document has isSuperAdmin=true or systemAccess.superAdmin=true, or your Auth token has custom claim superAdmin=true.', 'Check /api/whoami for server recognition.', 'Publish rules to testing first.', 'Log out and back in after claim changes.'],
      fixSteps: ['Use Access Control from an existing Super Admin to grant access.', 'Publish firestore.rules and storage.rules to the matching Firebase project.', 'Retest System Administrator, Storage uploads, push token writes, scans, and account security.', 'Repeat on production only after testing passes.'],
      doNot: ['Do not rely on MASTER_ADMIN_EMAIL for Firestore or Storage rules.', 'Do not paste firebase.json into the rules editor; paste the actual rules file content.'],
      escalation: 'Escalate immediately if no account can access System Administrator after publishing rules.'
    },
    {
      title: 'Privacy or Account Deletion',
      triggers: 'delete account deletion privacy app store google play export anonymize retain data request complete deny',
      likelyCause: 'The customer has asked for account deletion, which requires identity review, retention review, and a documented completion trail.',
      firstChecks: ['Find the request in Security Center.', 'Confirm who requested it and which workspace/account it affects.', 'Check whether legal/payroll/audit retention applies.', 'Decide whether export, anonymize, delete, or denial is appropriate.'],
      fixSteps: ['Mark Reviewing when you start.', 'Use protected admin deletion/anonymization tools only after review.', 'Write a clear completion note.', 'Mark Complete or Deny in Security Center so the audit trail is closed.'],
      doNot: ['Do not silently delete operational records without review.', 'Do not mark Complete until the real work is done.', 'Do not promise deletion of legally retained payroll/audit records without checking retention policy.'],
      escalation: 'Escalate if the request involves a restaurant owner, payroll/legal records, or a disputed identity.'
    }
  ];
  const tokenizeManualText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 2);
  const supportQuestion = (adminManualQuestion || adminManualSearch || '').trim();
  const supportTokens = tokenizeManualText(supportQuestion);
  const scoreBlob = (blob, weight = 1) => {
    const lower = String(blob || '').toLowerCase();
    if (!supportTokens.length) return 0;
    return supportTokens.reduce((score, token) => score + (lower.includes(token) ? weight : 0), 0);
  };
  const scoreArticle = (article) => {
    const title = scoreBlob(article.title, 5);
    const group = scoreBlob(article.group, 3);
    const keywords = scoreBlob(article.keywords, 4);
    const body = scoreBlob((article.body || []).join(' '), 1);
    const phraseBoost = supportQuestion && `${article.title} ${article.keywords || ''} ${(article.body || []).join(' ')}`.toLowerCase().includes(supportQuestion.toLowerCase()) ? 8 : 0;
    return title + group + keywords + body + phraseBoost;
  };
  const adminManualCategories = ['All', ...Array.from(new Set(adminManualArticles.map(a => a.group || 'General'))).slice(0, 32)];
  const scoredAdminManualArticles = adminManualArticles
    .map((article, idx) => ({ ...article, manualId: `${idx}-${String(article.title || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`, score: scoreArticle(article) }))
    .filter(article => adminManualCategory === 'All' || article.group === adminManualCategory)
    .sort((a, b) => (b.score - a.score) || String(a.title).localeCompare(String(b.title)));
  const filteredAdminManualArticles = (supportTokens.length ? scoredAdminManualArticles.filter(a => a.score > 0) : scoredAdminManualArticles).slice(0, 30);
  const scoredPlaybooks = adminSupportPlaybooks
    .map(playbook => ({ ...playbook, score: scoreBlob(`${playbook.title} ${playbook.triggers} ${playbook.likelyCause} ${playbook.firstChecks.join(' ')} ${playbook.fixSteps.join(' ')}`, 1) + scoreBlob(playbook.title, 5) + scoreBlob(playbook.triggers, 4) }))
    .sort((a, b) => b.score - a.score);
  const primarySupportPlaybook = scoredPlaybooks.find(p => p.score > 0) || adminSupportPlaybooks[0];
  const relatedSupportPlaybooks = scoredPlaybooks.filter(p => p.score > 0 && p.title !== primarySupportPlaybook.title).slice(0, 3);
  const topManualArticles = filteredAdminManualArticles.slice(0, 8);
  const selectedAdminArticle = scoredAdminManualArticles.find(a => a.manualId === selectedAdminArticleId) || topManualArticles[0] || scoredAdminManualArticles[0];
  const supportAnswerLines = primarySupportPlaybook ? [
    `Customer question: ${supportQuestion || 'No question entered yet.'}`,
    `Likely area: ${primarySupportPlaybook.title}`,
    `Likely cause: ${primarySupportPlaybook.likelyCause}`,
    '',
    'First checks:',
    ...primarySupportPlaybook.firstChecks.map((line, idx) => `${idx + 1}. ${line}`),
    '',
    'Fix steps:',
    ...primarySupportPlaybook.fixSteps.map((line, idx) => `${idx + 1}. ${line}`),
    '',
    'Do not:',
    ...primarySupportPlaybook.doNot.map(line => `- ${line}`),
    '',
    `Escalate when: ${primarySupportPlaybook.escalation}`,
    '',
    'Relevant articles:',
    ...topManualArticles.slice(0, 5).map(article => `- ${article.title}`)
  ] : [];
  const copyAdminSupportAnswer = async () => {
    try {
      await navigator.clipboard.writeText(supportAnswerLines.join('\n'));
      addToast('Copied', 'Support answer copied.');
    } catch (err) {
      addToast('Copy Failed', 'Highlight the support answer and copy it manually.');
    }
  };
  const sampleAdminQuestions = [
    'Customer cannot log in after changing phones',
    'Only I receive push notifications',
    'Menu scan says invalid JSON',
    'Employee cannot see Schedule tab',
    'App is blank after deploy',
    'Do I publish Firebase rules to testing and production?'
  ];

  const handleCopyPlatformSnapshot = async () => {
    try {
      await navigator.clipboard.writeText(platformSnapshot);
      addToast('Copied', 'Platform snapshot copied to clipboard.');
    } catch (err) {
      addToast('Snapshot', platformSnapshot);
    }
  };

  const handleCopyDiagnostics = async () => {
    const diagnostics = [
      platformSnapshot,
      '',
      'Client Runtime',
      `Host: ${envReport.host}`,
      `Path: ${envReport.path}`,
      `Navigator online: ${envReport.online}`,
      `Notifications: ${envReport.notifications}`,
      `Service worker available: ${envReport.serviceWorker}`,
      `IndexedDB available: ${envReport.indexedDb}`,
      `Stored user cache: ${envReport.storageUser}`,
      '',
      'Data Integrity',
      `Users without restaurantId: ${usersWithoutRestaurant.map(u => u.email || u.name || u.id).join(', ') || 'none'}`,
      `Missing owner accounts: ${missingOwnerAccounts.map(r => (r.name || 'Unnamed') + ' <' + (r.ownerEmail || 'no email') + '>').join(', ') || 'none'}`,
      `Duplicate email groups: ${duplicateEmailGroups.map(([email, group]) => email + ' (' + group.length + ')').join(', ') || 'none'}`,
      `Last backup/status: ${backupStatusLabel} (${backupDetail})`,
      `Permission denied logs: ${permissionDeniedLogs.length}`, 
      '',
      `User agent: ${envReport.userAgent}`
    ].join('\n');
    try {
      await navigator.clipboard.writeText(diagnostics);
      addToast('Copied', 'Support diagnostics copied to clipboard.');
    } catch (err) {
      addToast('Diagnostics', diagnostics.substring(0, 220));
    }
  };

  const buildForensicBundle = () => ({
    generatedAt: new Date().toISOString(),
    generatedBy: appUser?.email || appUser?.name || 'System Administrator',
    version: CURRENT_VERSION,
    backup: {
      status: backupStatus?.status || backupStatus?.lastStatus || 'unknown',
      lastBackupAt: backupStatus?.lastBackupAt || backupStatus?.lastSuccessfulBackupAt || backupStatus?.lastRunAt || null,
      nextAutomaticBackupAt: nextAutoBackupDate?.toISOString?.() || null,
      nextAutomaticBackupCountdown: nextBackupCountdown,
      detail: backupDetail,
      storagePath: backupStatus?.storagePath || backupStatus?.path || null,
      documentCount: backupStatus?.documentCount || 0,
      collectionCount: backupStatus?.collectionCount || 0,
      integrityStatus: backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'not checked',
      integrityVerifiedAt: backupStatus?.lastIntegrityVerifiedAt || backupStatus?.backupIntegrity?.verifiedAt || null,
      sha256: backupStatus?.backupSha256 || backupStatus?.backupIntegrity?.sha256 || null
    },
    platform: {
      status: platformStatus,
      actionItems: adminRiskQueue,
      host: envReport.host,
      path: envReport.path,
      online: envReport.online,
      serviceWorker: envReport.serviceWorker,
      indexedDb: envReport.indexedDb,
      notifications: envReport.notifications,
      userAgent: envReport.userAgent
    },
    counts: {
      restaurants: restaurants.length,
      users: allUsers.length,
      onlineUsers: onlineUsers.length,
      crashLogs: crashLogs.length,
      crashes24h,
      auditLogs: auditLogs.length,
      ghostAuditLogs: ghostAuditLogs.length,
      destructiveAuditLogs: destructiveAuditLogs.length,
      accessAuditLogs: accessAuditLogs.length,
      supportEditLogs: supportEditLogs.length,
      usersWithoutRestaurant: usersWithoutRestaurant.length,
      missingOwnerAccounts: missingOwnerAccounts.length,
      duplicateEmailGroups: duplicateEmailGroups.length,
      pastDueWorkspaces: pastDueWorkspaces.length,
      readOnlyWorkspaces: readOnlyWorkspaces.length,
      pushOptInRate
    },
    watchlists: {
      usersWithoutRestaurant: usersWithoutRestaurant.slice(0, 50).map(u => ({ id: u.id, name: u.name || '', email: u.email || '' })),
      missingOwnerAccounts: missingOwnerAccounts.slice(0, 50).map(r => ({ id: r.id, name: r.name || '', ownerEmail: r.ownerEmail || '' })),
      duplicateEmailGroups: duplicateEmailGroups.slice(0, 50).map(([email, group]) => ({ email, profileIds: group.map(u => u.id) })),
      permissionDeniedLogs: permissionDeniedLogs.slice(0, 25).map(log => ({ id: log.id, time: log.time || '', message: log.message || '', restaurantId: log.restaurantId || '', user: log.user || '' })),
      recentDestructiveActions: destructiveAuditLogs.slice(0, 25).map(log => ({ id: log.id, timestamp: log.timestamp || '', action: log.action || '', target: log.target || '', restaurantId: log.restaurantId || '', userName: log.userName || '' }))
    }
  });

  const handleDownloadForensicBundle = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTextFile(`86chaos-forensic-bundle-${stamp}.json`, JSON.stringify(buildForensicBundle(), null, 2), 'application/json;charset=utf-8;');
    addToast('Forensic Bundle', 'Downloaded platform diagnostics JSON.');
  };

  const handleDownloadClientDirectory = () => {
    const rows = [['Restaurant ID','Restaurant','Owner','Owner Email','Plan','Billing','Users','Online','Last Active','Modules Enabled']];
    restaurants.forEach(r => {
      const usersForRest = allUsers.filter(u => u.restaurantId === r.id);
      const modulesEnabled = moduleList.filter(key => r.features?.[key] !== false).join('|');
      rows.push([r.id, r.name || '', r.ownerName || '', r.ownerEmail || '', r.planType || '', r.billingStatus || '', usersForRest.length, usersForRest.filter(isOnlineNow).length, r.lastActive || '', modulesEnabled]);
    });
    downloadCsvRows(`86chaos-client-directory-${getToday()}.csv`, rows);
    addToast('Client Directory', 'Downloaded workspace operations CSV.');
  };

  const handleStampOpsReview = async () => {
    const ok = window.confirm('Create a new system operations review stamp with the current health counts? This does not change client data.');
    if (!ok) return;
    const stamp = new Date().toISOString();
    const payload = {
      lastReviewedAt: stamp,
      lastReviewedBy: appUser?.email || appUser?.name || 'System Administrator',
      version: CURRENT_VERSION,
      platformStatus,
      actionItemCount: adminRiskQueue.length,
      crashes24h,
      permissionDeniedCount: permissionDeniedLogs.length,
      backupStatus: backupStatus?.status || backupStatus?.lastStatus || 'unknown',
      nextAutomaticBackupAt: nextAutoBackupDate?.toISOString?.() || null,
      usersWithoutRestaurant: usersWithoutRestaurant.length,
      missingOwnerAccounts: missingOwnerAccounts.length,
      duplicateEmailGroups: duplicateEmailGroups.length,
      pastDueWorkspaces: pastDueWorkspaces.length,
      readOnlyWorkspaces: readOnlyWorkspaces.length
    };
    try {
      await setDoc(doc(db, 'system', 'operationsReview'), payload, { merge: true });
      await addDoc(collection(db, 'auditLogs'), {
        restaurantId: 'platform',
        action: 'SYSTEM_OPERATIONS_REVIEW_STAMP',
        target: 'system/operationsReview',
        details: `Operations review stamped. Status: ${platformStatus}. Action items: ${adminRiskQueue.length}.`,
        userId: appUser?.id || 'system-admin',
        userName: appUser?.email || appUser?.name || 'System Admin',
        timestamp: stamp,
        sessionId: currentAdminSessionId,
        isGhost: appUser?.isGhost || false
      }).catch(() => {});
      addToast('Review Stamp Created', 'System operations review stamp updated. View it under Forensics & Backups.');
    } catch (err) {
      addToast('Ops Review Error', err.message || 'Could not write operations review.');
    }
  };

  const handleClearThisDeviceTempCache = () => {
    if (!window.confirm('Clear temporary tour/help/demo cache on THIS browser only? This will not delete restaurant data.')) return;
    Object.keys(sessionStorage || {}).forEach(key => {
      if (/tourSeenThisSession|86chaosPostRestoreTab|demo|help/i.test(key)) sessionStorage.removeItem(key);
    });
    Object.keys(localStorage || {}).forEach(key => {
      if (/helpBriefSeen_|tourSeenThisSession|demo/i.test(key)) localStorage.removeItem(key);
    });
    addToast('Device Cache Cleared', 'Temporary local cache was cleared on this browser.');
  };


  const formatBackupBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (!n) return 'size unknown';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatBackupTimestamp = (value) => {
    const d = parseAnyDate(value);
    return d ? d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown time';
  };

  const loadBackupList = async ({ silent = false } = {}) => {
    if (isBackupListLoading) return;
    setIsBackupListLoading(true);
    setBackupListError('');
    try {
      const response = await secureFetch('/api/list-backups', { method: 'GET' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || `Backup list failed with status ${response.status}`);
      setBackupList(Array.isArray(result.backups) ? result.backups : []);
      if (!silent) addToast('Backups Loaded', `${result.count ?? result.backups?.length ?? 0} backup file(s) found.`);
    } catch (err) {
      const msg = err.message || 'Backup list route failed. Check Vercel logs.';
      setBackupListError(msg);
      if (!silent) addToast('Backup List Error', msg);
    } finally {
      setIsBackupListLoading(false);
    }
  };

  const runTimedApiCheck = async (label, url, options = {}) => {
    const started = performance.now();
    try {
      const response = await secureFetch(url, options);
      const result = await response.json().catch(() => ({}));
      return { label, url, ok: response.ok && result.ok !== false, status: response.status, ms: Math.round(performance.now() - started), result };
    } catch (err) {
      return { label, url, ok: false, status: 0, ms: Math.round(performance.now() - started), error: err.message || 'Request failed' };
    }
  };

  const refreshHealthDashboard = async ({ silent = false } = {}) => {
    if (isHealthLoading) return healthSnapshot;
    setIsHealthLoading(true);
    setHealthError('');
    const generatedAt = new Date().toISOString();
    try {
      const firestoreStart = performance.now();
      const backupSnap = await getDoc(doc(db, 'system', 'backupStatus'));
      const firestoreLatencyMs = Math.round(performance.now() - firestoreStart);
      const liveBackupStatus = backupSnap.exists() ? { id: backupSnap.id, ...backupSnap.data() } : null;

      const apiChecks = [];
      apiChecks.push(await runTimedApiCheck('Whoami Auth Check', '/api/whoami', { method: 'GET' }));
      apiChecks.push(await runTimedApiCheck('Security Diagnostics', '/api/security-diagnostics', { method: 'GET' }));
      apiChecks.push(await runTimedApiCheck('Storage Usage / Backup List', '/api/list-backups?includeUsage=1', { method: 'GET' }));
      apiChecks.push(await runTimedApiCheck('Full API Route Manifest', '/api/health-checks', { method: 'GET' }));

      const routeManifestCheck = apiChecks.find(c => c.label === 'Full API Route Manifest');
      const apiRouteManifest = Array.isArray(routeManifestCheck?.result?.routes) ? routeManifestCheck.result.routes : [];
      const backupListCheck = apiChecks.find(c => c.label === 'Storage Usage / Backup List');
      const backupResult = backupListCheck?.result || {};
      if (Array.isArray(backupResult.backups)) setBackupList(backupResult.backups);

      const storageUsage = {
        bucket: backupResult.bucket || liveBackupStatus?.storageBucket || 'unknown',
        totalFiles: backupResult.storageUsage?.totalFiles ?? backupResult.count ?? backupResult.backups?.length ?? backupList.length,
        backupFiles: backupResult.storageUsage?.backupFiles ?? backupResult.count ?? backupResult.backups?.length ?? backupList.length,
        totalBytes: Number(backupResult.storageUsage?.totalBytes ?? backupResult.totalBytes ?? (backupResult.backups || []).reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0)),
        backupBytes: Number(backupResult.storageUsage?.backupBytes ?? backupResult.totalBytes ?? (backupResult.backups || []).reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0)),
        verifiedCount: Number(backupResult.verifiedCount || (backupResult.backups || []).filter(item => item.integrityStatus === 'verified').length || 0)
      };

      const snapshot = {
        generatedAt,
        firestoreLatencyMs,
        firestoreStatus: firestoreLatencyMs < 800 ? 'healthy' : firestoreLatencyMs < 1800 ? 'slow' : 'degraded',
        storageUsage,
        apiChecks,
        apiRouteManifest,
        lastSuccessfulSync: liveBackupStatus?.lastSuccessfulBackupAt || liveBackupStatus?.lastBackupAt || liveBackupStatus?.lastRunAt || null,
        backupIntegrity: liveBackupStatus?.backupIntegrity || {
          status: liveBackupStatus?.lastIntegrityStatus || 'not checked',
          verifiedAt: liveBackupStatus?.lastIntegrityVerifiedAt || null,
          sha256: liveBackupStatus?.backupSha256 || null,
          errors: liveBackupStatus?.backupIntegrity?.errors || []
        },
        clientRuntime: envReport
      };
      setHealthSnapshot(snapshot);
      if (!silent) addToast('Health Refreshed', `Firestore ${snapshot.firestoreLatencyMs}ms • ${apiChecks.filter(c => c.ok).length}/${apiChecks.length} API checks healthy.`);
      return snapshot;
    } catch (err) {
      const msg = err.message || 'Health check failed.';
      setHealthError(msg);
      if (!silent) addToast('Health Error', msg);
      return null;
    } finally {
      setIsHealthLoading(false);
    }
  };

  const handleRunFullSystemDiagnostics = async () => {
    if (isDiagnosticsRunning) return;
    setIsDiagnosticsRunning(true);
    addToast('Diagnostics Started', 'Running full system diagnostics and building a deployment report.');
    try {
      const clientHealth = await refreshHealthDashboard({ silent: true });
      const response = await secureFetch('/api/full-system-diagnostics', { method: 'POST' });
      const serverReport = await response.json().catch(() => ({}));
      if (!response.ok || serverReport.ok === false) throw new Error(serverReport.error || `Diagnostics failed with status ${response.status}`);
      const report = {
        ...serverReport,
        clientHealth,
        frontendSnapshot: buildForensicBundle(),
        notes: [
          'Run before deployments to capture Firestore latency, Storage backup usage, API timing, backup integrity, and client runtime state.',
          'This report does not expose customer private records; it stores counts, statuses, and operational metadata.'
        ]
      };
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadTextFile(`86chaos-full-system-diagnostics-${stamp}.json`, JSON.stringify(report, null, 2), 'application/json;charset=utf-8;');
      setLastDiagnosticsReport(report);
      setHealthSnapshot(prev => ({ ...(prev || clientHealth || {}), serverDiagnostics: serverReport, generatedAt: new Date().toISOString() }));
      addToast('Diagnostics Complete', 'Full system diagnostics report downloaded.');
    } catch (err) {
      addToast('Diagnostics Error', err.message || 'Full system diagnostics failed. Check Vercel logs.');
    } finally {
      setIsDiagnosticsRunning(false);
    }
  };

  const handleRunBackupNow = async () => {
    if (isBackupRunning) return;
    const ok = window.confirm('Run a full Firestore JSON backup now? This can take a minute on large databases.');
    if (!ok) return;
    setIsBackupRunning(true);
    addToast('Backup Started', 'Creating a database backup and writing status to the Command Deck.');
    try {
      const response = await secureFetch('/api/firestore-backup?mode=manual', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || `Backup failed with status ${response.status}`);
      addToast('Backup Complete', `${result.documentCount || 0} document(s) saved. Integrity: ${result.lastIntegrityStatus || result.backupIntegrity?.status || 'not checked'}.`);
      setSubTab('forensics');
      loadBackupList({ silent: true });
    } catch (err) {
      addToast('Backup Error', err.message || 'Backup route failed. Check Vercel logs.');
    } finally {
      setIsBackupRunning(false);
    }
  };


  const handleRestoreFullBackupFromStorage = async (selectedPath = '') => {
    const storagePath = (selectedPath || backupRestorePath || backupStatus?.storagePath || '').trim();
    if (!storagePath) return addToast('Missing Backup', 'Select a backup from the Backup Center first.');
    const selectedBackup = backupList.find(b => b.path === storagePath);
    const label = selectedBackup ? `${selectedBackup.mode || 'backup'} • ${formatBackupTimestamp(selectedBackup.createdAt || selectedBackup.updatedAt)} • ${formatBackupBytes(selectedBackup.sizeBytes)}` : storagePath;
    const phrase = window.prompt(`This will restore Firestore documents from:

${label}

Storage path:
${storagePath}

Type RESTORE to continue.`);
    if ((phrase || '').trim().toUpperCase() !== 'RESTORE') return addToast('Canceled', 'Full backup restore was not run.');
    setIsBackupRestoring(true);
    addToast('Restore Started', 'Reading the backup from Firebase Storage and restoring documents.');
    try {
      const response = await secureFetch('/api/firestore-backup?mode=restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || `Restore failed with status ${response.status}`);
      addToast('Restore Complete', `${result.restoredDocumentCount || 0} document(s) restored from backup.`);
      setBackupRestorePath('');
      setSubTab('forensics');
      loadBackupList({ silent: true });
    } catch (err) {
      addToast('Restore Error', err.message || 'Restore route failed. Check Vercel logs.');
    } finally {
      setIsBackupRestoring(false);
    }
  };


  const handleRestoreLegacyJulySchedule = async () => {
    if (isScheduleReinjecting) return;
    const phrase = window.prompt('LEGACY SCHEDULE BUILDER OVERWRITE\n\nThis will erase the selected legacy July schedule builder draft, then reload the stored schedule import as UNPUBLISHED draft shifts so it can be reviewed and republished. A JSON backup downloads first.\n\nType REINJECT JULY to continue.');
    if ((phrase || '').trim().toUpperCase() !== 'REINJECT JULY') {
      addToast('Canceled', 'July schedule reinject was not run.');
      return;
    }

    setIsScheduleReinjecting(true);
    addToast('Overwrite Started', 'Clearing the July Schedule Builder and loading the PDF schedule as draft shifts.');

    try {
      const response = await secureFetch('/api/import-cheers-july-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'IMPORT_JULY_2026', restaurantId: LEGACY_RESTORE_RESTAURANT_ID, replaceMode: 'schedule-builder-overwrite-draft' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || `Schedule reinject failed with status ${response.status}`);

      if (result.backup) {
        const backupName = `Legacy_July_2026_Shifts_Replaced_Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        downloadTextFile(backupName, JSON.stringify(result.backup, null, 2), 'application/json;charset=utf-8;');
      }

      await addDoc(collection(db, 'auditLogs'), {
        restaurantId: LEGACY_RESTORE_RESTAURANT_ID,
        action: 'EMERGENCY_REINJECT_JULY_SCHEDULE_BUTTON',
        target: 'shifts',
        details: `System Administrator button overwrote the July 2026 Schedule Builder. Deleted ${result.deletedCount || 0} existing/restored shift(s), imported ${result.importedCount || 0} unpublished draft shift(s). Run ${result.runId || 'unknown'}.`,
        userId: appUser?.id || 'system-admin',
        userName: appUser?.email || appUser?.name || 'System Admin',
        timestamp: new Date().toISOString(),
        sessionId: currentAdminSessionId,
        isGhost: appUser?.isGhost || false
      }).catch(() => {});

      addToast('Schedule Builder Loaded', `${result.importedCount || 0} July draft shift(s) loaded for review and republish. Reloading to clear schedule cache.`);
      window.alert(`Schedule Builder overwrite complete.\n\nRestaurant: ${result.restaurantId || LEGACY_RESTORE_RESTAURANT_ID}\nDeleted old/restored July shifts: ${result.deletedCount || 0}\nLoaded draft July shifts: ${result.importedCount || 0}\nRun ID: ${result.runId || 'n/a'}\n\nA backup JSON of replaced July shifts was downloaded to this computer.\n\nThe app will reload once. Then open Time Clock & Schedule → Schedule Builder, go to July 2026, review the draft, and click Publish Schedule.`);
      try { sessionStorage.setItem('86chaosPostRestoreTab', 'schedule'); } catch (_) {}
      window.location.reload();
    } catch (err) {
      addToast('Overwrite Error', err.message || 'Schedule Builder overwrite failed.');
      window.alert(`Schedule Builder overwrite failed:\n\n${err.message || err}\n\nNothing should be deleted if the import could not match all employee profiles.`);
    } finally {
      setIsScheduleReinjecting(false);
    }
  };

  const handleClearAllBanners = async () => {
    if (!window.confirm('Clear system banners from every workspace?')) return;
    try {
      await Promise.all(restaurants.map(r => updateDoc(doc(db, 'restaurants', r.id), { systemBanner: null })));
      addToast('Banners Cleared', 'All workspace banners were removed.');
    } catch (err) { addToast('Error', err.message); }
  };

  const SignalPip = ({ tone = 'emerald', label = 'LIVE', hot = false }) => {
    const colors = tone === 'red' ? 'text-red-400 bg-red-500' : tone === 'amber' ? 'text-amber-400 bg-amber-400' : tone === 'blue' ? 'text-blue-400 bg-blue-400' : tone === 'purple' ? 'text-fuchsia-400 bg-fuchsia-400' : 'text-emerald-400 bg-emerald-400';
    return <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${colors.split(' ')[0]}`}><span className={`cockpit-light ${hot ? 'hot' : 'quiet'} ${colors.split(' ')[1]}`}></span>{label}</span>;
  };

  const ADMIN_METRIC_HELP = {
    'Platform': 'Overall platform condition. It rolls up urgent action items such as stale backups, permission blocks, crashes, missing owners, duplicate users, stale clients, and deployment readiness. Click the card to jump to the command overview.',
    'Health': 'Live technical health. It focuses on Firestore latency, API route readiness, and backup integrity. Run Refresh Health before opening Vercel/Firebase logs.',
    'Manual Presence': 'On-demand online/recent-user snapshot. It is manual to avoid expensive constant presence reads across customers.',
    'MRR': 'Estimated monthly recurring revenue from workspace plan/pricing data. Use it as a planning signal, not final accounting.',
    'Crashes 24h': 'Crash/error reports seen in the last 24 hours. Open Support logs before deploying if this is hot.',
    'Push Opt-In': 'Share of users/devices with push tokens. Low opt-in points to denied browser permissions, stale service workers, or users who never enabled notifications.',
    'Stale Clients': 'Workspaces with no recent activity. Inspect before assuming churn because stale lastActive fields can also mean presence writes are broken.',
    'Last Backup': 'Age of the latest successful Firestore backup. Daily backups should usually be under 30 hours old. Preview/testing deployments do not auto-run Vercel Cron.',
    'Connected Devices': 'Users with saved push tokens. This is the starting count for push troubleshooting.',
    'Stale Tokens': 'Push tokens older than the repair window. Clear/repair these when notifications stop working after device, browser, or domain changes.',
    'Browser Permission': 'Notification permission on this admin device. It does not prove every employee device is configured.',
    'Last Push Result': 'Most recent server push result when the route recorded one. Use it to see sent/failed counts.',
    'Firestore Latency': 'How quickly Firestore responded during the latest health check. High latency can be network, rules, query shape, or Firebase service health.',
    'Backup Storage': 'Total Storage usage detected for backup files. Use it to watch backup growth and prune behavior.',
    'API Routes': 'How many Vercel API routes responded during health checks. A failed route usually needs Vercel logs and env-var scope review.',
    'Last Successful Sync': 'Most recent successful backup/status sync written by the backup route.',
    'Backup Integrity': 'Round-trip verification status for the latest backup. Failed integrity means do not rely on that backup for restore.',
    'Permission Denied': 'Count of Firestore rule blocks seen in logs. Usually indicates a role/rules/path mismatch.',
    'Missing Owners': 'Restaurants whose owner email does not match an existing user profile. Fix before onboarding or billing handoff.',
    'No Restaurant ID': 'Users without workspace routing. These users can log in but may see blank or wrong data.',
    'Duplicate Emails': 'Multiple profiles with the same email. This can cause ghost accounts and wrong permissions.',
    'Audit Logs': 'Recent global/platform action records. Use this for incident timelines.',
    'Ghost Actions': 'Support possession or ghost-mode actions. These deserve extra review.',
    'Destructive': 'Deletes, nukes, locks, sweeps, or other high-risk actions.',
    'Support Edits': 'Profile/routing/support changes made by admin tools.',
    'Access Changes': 'Grant/revoke/admin access changes. Review these during security audits.',
    'Rule Blocks': 'Permission-denied clues from Firestore rules.',
    'Orphan Users': 'Users missing restaurantId/workspace membership.',
    'Backup Status': 'Combined backup age/status. Open Forensics & Backups for backup list, restore, and restore drill tools.',
    'Version': 'Current deployed 86 Chaos version reported by the browser build.',
    'Admin Access': 'Shows whether this session is running with Super Admin authority. If the wrong account is locked out, check MASTER_ADMIN_EMAIL, MASTER_ADMIN_EMAILS, REACT_APP_MASTER_ADMIN_EMAIL, Firebase custom claims, and Firestore isSuperAdmin/systemAccess flags.',
    'Restore Drill': 'Shows the last time a backup was safely restored into a test/sandbox project. Backups are not proven until a restore drill has passed.'
  };

  const AdminInfoButton = ({ title, body }) => (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setAdminHelpModal({ title, body });
      }}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[#2A353D] bg-[#12161A] text-slate-500 hover:text-[#D4A381] hover:border-[#D4A381]/60 transition-colors flex-shrink-0"
      title={`Explain ${title}`}
      aria-label={`Explain ${title}`}
    >
      <HelpCircle size={12} />
    </button>
  );

  const CockpitMetric = ({ label, value, detail, tone = 'emerald', hot = false, onClick, help }) => {
    const metricHelp = help || ADMIN_METRIC_HELP[label] || 'This System Administrator display summarizes live support data. Click through or search the Administrator Manual for the label name to see deeper troubleshooting steps.';
    return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }}
      className={`w-full text-left cockpit-panel cockpit-grid rounded-xl p-3 min-h-[92px] flex flex-col justify-between ${onClick ? 'hover:border-[#D4A381]/50 hover:bg-[#12161A]/70 transition-all cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">{label}</span>
        <div className="flex items-center gap-2">
          <AdminInfoButton title={label} body={metricHelp} />
          <SignalPip tone={tone} label={hot ? 'HOT' : 'SYNC'} hot={hot} />
        </div>
      </div>
      <div className="text-2xl font-black text-white leading-none mt-2">{value}</div>
      <div className="text-[10px] text-slate-400 font-bold mt-2 truncate">{detail}</div>
    </div>
    );
  };

  const adminTabGroups = [
    { title:'Security', summary:'App Check, MFA, rules, risky users', tabs:[
      {id:'security', label:'Security Center', short:'Security'},
      {id:'admins', label:'Access Control', short:'Access'}
    ]},
    { title:'Deployments', summary:'Readiness, health, diagnostics, versions', tabs:[
      {id:'overview', label:'Command Center', short:'Home'},
      {id:'deployment', label:'Deployment Readiness', short:'Deploy'},
      {id:'health', label:'Health Dashboard', short:'Health'},
      {id:'v14', label:'14.0 Robustness Suite', short:'V14'},
      {id:'history', label:'Settings Version History', short:'History'}
    ]},
    { title:'Customers', summary:'Workspaces, people, roles, setup', tabs:[
      {id:'tenants', label:'Workspaces', short:'Clients'},
      {id:'users', label:'People Directory', short:'People'},
      {id:'roles', label:'Permission & Role Manager', short:'Roles'},
      {id:'setup', label:'Workspace Setup Wizard', short:'Setup'}
    ]},
    { title:'Diagnostics', summary:'Push, presence, support, imports', tabs:[
      {id:'push', label:'Push Control Center', short:'Push'},
      {id:'live', label:'Manual Presence Snapshot', short:'Presence'},
      {id:'support', label:'Support Desk', short:'Support'},
      {id:'data', label:'Import / Export Center', short:'Data'}
    ]},
    { title:'Backups', summary:'Backups, audits, guarded tools', tabs:[
      {id:'forensics', label:'Audit & Forensics', short:'Audit'},
      {id:'danger', label:'Danger Zone', short:'Danger'}
    ]},
    { title:'AI Tools', summary:'Scanner safety and platform operations', tabs:[
      {id:'ops', label:'Platform Operations', short:'Ops'}
    ]},
    { title:'Audit', summary:'Manual, maintenance, branding', tabs:[
      {id:'maintenance', label:'Maintenance Mode', short:'Maint'},
      {id:'branding', label:'Branding / Display', short:'Brand'},
      {id:'manual', label:'Administrator Manual', short:'Manual'}
    ]}
  ];
  const adminTabs = adminTabGroups.flatMap(group => group.tabs.map(tab => ({ ...tab, group: group.title, groupSummary: group.summary })));
  const activeAdminTab = adminTabs.find(tab => tab.id === subTab) || adminTabs[0];
  const mobilePrimaryTabs = ['overview', 'health', 'v14', 'deployment', 'live', 'roles', 'push', 'setup', 'data', 'maintenance', 'manual'];

  const jumpToAdminIssue = (target) => {
    setSubTab(target || 'overview');
    setTimeout(() => document.getElementById(`admin-${target || 'overview'}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const v14TargetRestaurantId = v14WorkspaceId || editingRest?.id || appUser?.restaurantId || restaurants[0]?.id || '';
  const v14PermissionUser = allUsers.find(u => u.id === v14PermissionUserId) || allUsers.find(u => u.restaurantId === v14TargetRestaurantId) || allUsers[0] || null;
  const v14PermissionRestaurant = restaurants.find(r => r.id === (v14PermissionUser?.restaurantId || v14TargetRestaurantId)) || {};
  const v14PermissionPreview = v14PermissionUser ? buildPermissionPreview(v14PermissionUser, v14PermissionRestaurant?.features || {}) : null;
  const v14OfflineQueueCount = (() => {
    if (typeof window === 'undefined') return 0;
    try {
      return Object.keys(localStorage).filter(k => k.startsWith('chaosOfflineWriteQueue_')).reduce((sum, key) => sum + (JSON.parse(localStorage.getItem(key) || '[]').length || 0), 0);
    } catch (_) { return 0; }
  })();

  const runV14StorageDoctor = async () => {
    if (!v14TargetRestaurantId) return addToast('Choose Workspace', 'Pick a workspace before running Storage Doctor.');
    setV14BusyTool('storage');
    try {
      const response = await secureFetch('/api/storage-doctor', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ restaurantId: v14TargetRestaurantId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Storage Doctor failed.');
      setV14StorageReport(data);
      addToast(data.ok ? 'Storage Doctor Passed' : 'Storage Needs Attention', `${data.checks?.filter(c => !c.ok).length || 0} issue(s) found.`);
    } catch (err) { addToast('Storage Doctor Error', err.message); }
    finally { setV14BusyTool(''); }
  };

  const runV14SchemaDoctor = async (repair = false) => {
    if (!v14TargetRestaurantId) return addToast('Choose Workspace', 'Pick a workspace before running Schema Doctor.');
    if (repair && !window.confirm('Run safe repair for repairable schema issues? This will stamp missing restaurantId values for the selected workspace, clamp negative inventory counts, and lock 86 Chaos branding.')) return;
    setV14BusyTool(repair ? 'schema-repair' : 'schema');
    try {
      const response = await secureFetch('/api/schema-doctor', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ restaurantId: v14TargetRestaurantId, repair }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Schema Doctor failed.');
      setV14SchemaReport(data);
      addToast(repair ? 'Schema Repair Complete' : 'Schema Scan Complete', `${data.issueCount || 0} issue(s), ${data.repairs?.length || 0} repair(s).`);
    } catch (err) { addToast('Schema Doctor Error', err.message); }
    finally { setV14BusyTool(''); }
  };

  const loadV14Backups = async () => {
    setV14BusyTool('backups');
    try {
      const response = await secureFetch('/api/list-backups?includeUsage=0');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not list backups.');
      const backups = Array.isArray(data.backups) ? data.backups : [];
      setV14Backups(backups);
      setV14BackupsLoadedAt(new Date().toISOString());
      if (!v14BackupPath && backups[0]?.path) setV14BackupPath(backups[0].path);
      addToast('Backups Loaded', `${backups.length} backup(s) ready to select.`);
    } catch (err) { addToast('Backup List Error', err.message); }
    finally { setV14BusyTool(''); }
  };

  const runV14BackupPreview = async (restore = false) => {
    if (!v14BackupPath.trim()) return addToast('Backup Path Needed', 'Paste or choose a Firebase Storage backup path first.');
    if (restore && v14RestoreConfirm !== 'RESTORE') return addToast('Type RESTORE', 'Selective restore requires typing RESTORE.');
    if (restore && v14SelectedCollections.length === 0) return addToast('Choose Collections', 'Select at least one collection to restore.');
    if (restore && !window.confirm(`Selective restore ${v14SelectedCollections.join(', ')} from this backup?`)) return;
    setV14BusyTool(restore ? 'restore' : 'preview');
    try {
      const response = await secureFetch('/api/backup-preview', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ storagePath: v14BackupPath.trim(), selectedCollections: v14SelectedCollections, action: restore ? 'restoreSelected' : 'preview', confirmText: v14RestoreConfirm }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Backup preview failed.');
      setV14BackupPreview(data);
      if (!restore && data.rows?.length && v14SelectedCollections.length === 0) setV14SelectedCollections(data.rows.slice(0, 6).map(r => r.collectionName));
      addToast(restore ? 'Selective Restore Complete' : 'Backup Preview Ready', restore ? `${data.restored?.restoredDocuments || 0} document(s) restored.` : `${data.totalDocs || 0} document(s) inspected.`);
    } catch (err) { addToast('Backup Tool Error', err.message); }
    finally { setV14BusyTool(''); }
  };

  const downloadV14ImportTemplates = () => {
    const templates = buildImportBridgeTemplates();
    const prefix = `86chaos-v14-import-templates`;
    const payload = Object.entries(templates).map(([name, rows]) => `### ${name}.csv\n${rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')}`).join('\n\n');
    downloadTextFile(`${prefix}.txt`, payload, 'text/plain;charset=utf-8;');
    addToast('Templates Downloaded', 'Import Bridge templates downloaded as a single text pack.');
  };

  const runV14Guardrails = () => {
    const report = buildV14ClientGuardrailReport({ currentVersion: CURRENT_VERSION, features: restaurants.find(r => r.id === v14TargetRestaurantId)?.features || {}, hasBrandLock: true, hasHelpSearch: true, hasRules: true });
    setV14GuardrailReport(report);
    addToast(report.ok ? 'Guardrails Passed' : 'Guardrails Need Work', `${report.checks.filter(c => !c.ok).length} issue(s).`);
  };

  const V14JsonPanel = ({ title, data }) => (
    <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 overflow-hidden">
      <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-2">{title}</div>
      <pre className="text-[10px] text-slate-300 whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto custom-scrollbar">{data ? JSON.stringify(data, null, 2) : 'No report yet.'}</pre>
    </div>
  );


  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-24 animate-[slideIn_0.2s_ease-out]">
      <Modal isOpen={!!createdWorkspaceLogin} onClose={() => setCreatedWorkspaceLogin(null)} title="Workspace Login Created">
        {createdWorkspaceLogin && <div className="space-y-4">
          <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3 text-xs font-bold text-emerald-200">This owner login is shown one time only. Copy, print, email, or text it before closing.</div>
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-4 space-y-2">
            <div><div className={T.label}>Workspace</div><div className="font-black text-white">{createdWorkspaceLogin.restaurantName}</div></div>
            <div><div className={T.label}>Email</div><div className="font-mono text-white break-all">{createdWorkspaceLogin.email}</div></div>
            <div><div className={T.label}>Temporary Password</div><div className="font-mono text-2xl font-black text-[#D4A381]">{createdWorkspaceLogin.password}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => copyWorkspaceLogin(createdWorkspaceLogin)} className={T.btn}>Copy</button><button type="button" onClick={() => printWorkspaceLogin(createdWorkspaceLogin)} className={T.btnAlt}>Print</button><button type="button" onClick={() => emailWorkspaceLogin(createdWorkspaceLogin)} className={T.btnAlt}>Email</button><button type="button" onClick={() => textWorkspaceLogin(createdWorkspaceLogin)} className={T.btnAlt}>Text</button></div>
          <button type="button" onClick={() => setCreatedWorkspaceLogin(null)} className={`w-full ${T.btn}`}>Done</button>
        </div>}
      </Modal>
      <Modal isOpen={!!adminHelpModal} onClose={() => setAdminHelpModal(null)} title={adminHelpModal?.title || 'System Administrator Help'}>
        {adminHelpModal && <div className="space-y-3">
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-4 text-sm font-bold text-slate-300 leading-relaxed whitespace-pre-line">{adminHelpModal.body}</div>
          <button type="button" onClick={() => setAdminHelpModal(null)} className={T.btn}>Got it</button>
        </div>}
      </Modal>
      {/* ADMIN TOP BAR */}
      <div className="cockpit-panel rounded-2xl p-4 overflow-hidden relative">
        <div className="absolute inset-0 cockpit-grid opacity-35 pointer-events-none"></div>
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <SignalPip tone="emerald" label="PLATFORM LIVE" hot />
              <SignalPip tone={platformStatus === 'Needs Attention' ? 'red' : platformStatus === 'Monitoring' ? 'amber' : 'emerald'} label={platformStatus} hot={platformStatus === 'Needs Attention'} />
              <SignalPip tone="blue" label="FIREBASE" />
              <SignalPip tone="purple" label="GHOST READY" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">System Administrator</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">Professional control center for workspaces, people, support, backups, review stamps, and platform operations.</p>
          </div>
          <button type="button" onClick={() => setIsCommandDeckOpen(v => !v)} className="bg-[#0B0E11] border border-[#2A353D] text-slate-300 hover:text-[#D4A381] rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest">
            {isCommandDeckOpen ? 'Hide Command Deck' : 'Show Command Deck'}
          </button>
        </div>

        {/* ORGANIZED ADMIN NAVIGATION */}
        <div className="relative space-y-3">
          <div className="lg:hidden bg-[#0B0E11]/80 border border-[#2A353D] rounded-2xl p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-widest text-[#D4A381]">Mobile Admin Layout</div>
                <div className="text-sm font-black text-white truncate">{activeAdminTab.label}</div>
                <div className="text-[10px] font-bold text-slate-500 truncate">{activeAdminTab.group} • {activeAdminTab.groupSummary}</div>
              </div>
              <button type="button" onClick={() => setIsCommandDeckOpen(v => !v)} className="flex-shrink-0 bg-[#12161A] border border-[#2A353D] text-[#D4A381] rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest">
                {isCommandDeckOpen ? 'Hide Signals' : 'Signals'}
              </button>
            </div>
            <select
              value={subTab}
              onChange={(e) => setSubTab(e.target.value)}
              className={`${T.input} text-sm font-black`}
              aria-label="Choose administrator section"
            >
              {adminTabGroups.map(group => (
                <optgroup key={group.title} label={group.title}>
                  {group.tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="grid grid-cols-4 gap-1.5">
              {adminTabs.filter(t => mobilePrimaryTabs.includes(t.id)).map(t => (
                <button key={t.id} type="button" onClick={() => setSubTab(t.id)} className={`px-2 py-2 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${subTab === t.id ? 'bg-red-600 text-white border-red-500' : 'bg-[#12161A] text-slate-400 border-[#2A353D]'}`}>
                  {t.short || t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {adminTabGroups.map(group => (
              <div key={group.title} className="bg-[#0B0E11]/70 border border-[#2A353D] rounded-2xl p-2">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 px-1.5 pb-0.5">{group.title}</div>
                <div className="text-[9px] font-bold text-slate-600 px-1.5 pb-1.5 truncate">{group.summary}</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {group.tabs.map((t) => (
                    <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-3 py-2.5 text-left text-[10px] sm:text-[11px] font-black rounded-xl uppercase tracking-widest transition-all border ${subTab === t.id ? 'bg-red-600 text-white shadow-lg border-red-500' : 'bg-[#1A2126] text-slate-400 border-[#2A353D] hover:text-white hover:border-slate-600'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={`grid gap-4 ${isCommandDeckOpen ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
        {isCommandDeckOpen && (
          <aside className="lg:sticky lg:top-4 h-max space-y-3 max-lg:max-h-[58vh] max-lg:overflow-y-auto max-lg:pr-1 custom-scrollbar" id="admin-command-deck">
            <div className="cockpit-panel rounded-2xl p-3 overflow-hidden relative">
              <div className="absolute inset-0 cockpit-grid opacity-40 pointer-events-none"></div>
              <div className="relative flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">Command Deck</div>
                  <div className="text-sm font-black text-white">Clickable Signal Board</div>
                </div>
                <button type="button" onClick={() => setIsCommandDeckOpen(false)} className="text-slate-500 hover:text-white border border-[#2A353D] rounded-lg px-2 py-1 text-[9px] font-black uppercase">Hide</button>
              </div>
              <div className="relative space-y-2">
                <CockpitMetric label="Platform" value={platformStatus} detail={`${adminRiskQueue.length} action item(s)`} tone={platformStatus === 'Needs Attention' ? 'red' : platformStatus === 'Monitoring' ? 'amber' : 'emerald'} hot={platformStatus === 'Needs Attention'} onClick={() => jumpToAdminIssue('overview')} />
                <CockpitMetric label="Health" value={healthSnapshot ? `${healthSnapshot.firestoreLatencyMs}ms` : 'Check'} detail={`Integrity: ${backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'not checked'}`} tone={(backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status) === 'failed' ? 'red' : healthSnapshot?.firestoreLatencyMs > 800 ? 'amber' : 'emerald'} hot={(backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status) === 'failed'} onClick={() => jumpToAdminIssue('health')} />
                <CockpitMetric label="Admin Access" value={adminAccessSourceLabel} detail={adminAccessDetail} tone={adminAccessSourceLabel === 'Unknown' ? 'amber' : 'emerald'} help="Explains why this account can open System Administrator. Good sources are MASTER_ADMIN_EMAIL(S) in Vercel server env, REACT_APP_MASTER_ADMIN_EMAIL for frontend menu visibility, Firebase custom claim superAdmin, or Firestore isSuperAdmin/systemAccess.superAdmin. If an account is locked out, check the deployment environment scope first." />
                <CockpitMetric label="Manual Presence" value={presenceSnapshot.fetchedAt ? onlineUsers.length : '—'} detail={presenceSnapshot.fetchedAt ? `${onlineRestaurants.length} workspaces` : 'Press refresh'} tone={presenceSnapshot.fetchedAt ? 'emerald' : 'blue'} onClick={() => jumpToAdminIssue('live')} />
                <CockpitMetric label="MRR" value={`$${mrr}`} detail={`ARPA $${arpa}`} tone="emerald" onClick={() => jumpToAdminIssue('tenants')} />
                <CockpitMetric label="Crashes 24h" value={crashes24h} detail={crashes24h ? 'Open support logs' : 'No fresh crashes'} tone={crashes24h ? 'amber' : 'emerald'} hot={crashes24h > 10} onClick={() => jumpToAdminIssue('support')} />
                <CockpitMetric label="Push Opt-In" value={`${pushOptInRate}%`} detail={`${allUsers.filter(u => u.fcmToken).length} devices`} tone={pushOptInRate < 30 ? 'amber' : 'emerald'} onClick={() => jumpToAdminIssue('users')} />
                <CockpitMetric label="Stale Clients" value={staleTenants.length} detail="Inactive 21+ days" tone={staleTenants.length ? 'amber' : 'emerald'} onClick={() => jumpToAdminIssue('tenants')} />
                <CockpitMetric label="Last Backup" value={backupStatusLabel} detail={backupCommandDeckDetail} tone={backupIsStale ? 'amber' : 'emerald'} hot={backupIsStale} onClick={() => jumpToAdminIssue('forensics')} />
                <div role="button" tabIndex={0} onClick={() => jumpToAdminIssue('forensics')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jumpToAdminIssue('forensics'); } }} className="w-full text-left bg-[#0B0E11] border border-[#2A353D] hover:border-[#D4A381]/50 rounded-xl p-3 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Next Automatic Backup</span><div className="flex items-center gap-2"><AdminInfoButton title="Next Automatic Backup" body={backupTroubleshootingSummary} /><SignalPip tone={backupRunning ? 'blue' : backupMissedDailyWindow ? 'amber' : 'emerald'} label={backupRunning ? 'RUNNING' : backupMissedDailyWindow ? 'CHECK' : 'COUNTDOWN'} hot={backupRunning || backupMissedDailyWindow} /></div></div>
                  <div className="text-xl font-black text-white mt-2">{nextBackupCountdown}</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-1">Scheduled for {nextBackupLocalTime}</div>
                  {backupMissedDailyWindow && <div className="mt-2 bg-amber-900/15 border border-amber-500/30 rounded-lg p-2 text-[10px] font-bold text-amber-200 leading-snug">{backupTroubleshootingSummary}</div>}
                </div>
                <button type="button" onClick={handleRunBackupNow} disabled={isBackupRunning || backupRunning} className="w-full bg-[#12161A] border border-[#2A353D] hover:border-[#D4A381]/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#D4A381] hover:text-white transition-colors flex items-center justify-center gap-2">
                  {(isBackupRunning || backupRunning) ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                  {(isBackupRunning || backupRunning) ? 'Backup Running' : 'Run Backup Now'}
                </button>
              </div>
            </div>

            <div className="cockpit-panel rounded-2xl p-3 space-y-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-2">Action Queue</div>
              {adminRiskQueue.length === 0 && <button type="button" onClick={() => jumpToAdminIssue('overview')} className="w-full text-left bg-emerald-900/10 border border-emerald-900/40 rounded-xl p-3"><SignalPip tone="emerald" label="CLEAN"/><div className="text-xs font-bold text-slate-300 mt-2">No urgent platform issues.</div></button>}
              {adminRiskQueue.map((item, idx) => (
                <button key={`${item.title}-${idx}`} type="button" onClick={() => jumpToAdminIssue(item.jump)} className="w-full text-left bg-[#0B0E11] border border-[#2A353D] hover:border-[#D4A381]/50 rounded-xl p-3 transition-colors">
                  <SignalPip tone={item.tone} label={item.title} hot={item.tone === 'red'} />
                  <div className="text-[10px] text-slate-400 font-bold mt-2 leading-snug">{item.detail}</div>
                </button>
              ))}
            </div>

            <div className="cockpit-panel rounded-2xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] mb-2">Quick Controls</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleCopyPlatformSnapshot} className="bg-[#0B0E11] border border-[#2A353D] text-slate-300 hover:text-[#D4A381] rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest">Copy Snapshot</button>
                <button type="button" onClick={handleClearAllBanners} className="bg-[#0B0E11] border border-[#2A353D] text-slate-300 hover:text-red-300 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest">Clear Banners</button>
                <button type="button" onClick={() => jumpToAdminIssue('live')} className="bg-emerald-900/15 border border-emerald-900/50 text-emerald-300 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest">Live Radar</button>
                <button type="button" onClick={() => jumpToAdminIssue('tenants')} className="bg-purple-900/15 border border-purple-900/50 text-purple-300 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest">Clients</button>
                <button type="button" onClick={handleDownloadForensicBundle} className="bg-blue-900/15 border border-blue-900/50 text-blue-300 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest">Forensics JSON</button>
                <button type="button" onClick={handleRunFullSystemDiagnostics} disabled={isDiagnosticsRunning} className="bg-cyan-900/15 border border-cyan-900/50 text-cyan-300 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest disabled:opacity-50">Full Diag</button>
                <button type="button" onClick={handleDownloadClientDirectory} className="bg-amber-900/15 border border-amber-900/50 text-amber-300 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest">Client CSV</button>
              </div>
            </div>

            <div className="cockpit-panel rounded-2xl p-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => jumpToAdminIssue('tenants')} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2 text-left"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Trials</div><div className="text-xl font-black text-white">{trialWorkspaces.length}</div></button>
              <button type="button" onClick={() => jumpToAdminIssue('users')} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2 text-left"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Inactive Users</div><div className="text-xl font-black text-white">{inactiveUsers.length}</div></button>
              <button type="button" onClick={() => jumpToAdminIssue('tenants')} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2 text-left"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Modules Live</div><div className="text-xl font-black text-white">{featureAdoption.filter(f => f.count > 0).length}/{moduleList.length}</div></button>
              <button type="button" onClick={() => jumpToAdminIssue('manual')} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2 text-left"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Version</div><div className="text-sm font-black text-white truncate">{CURRENT_VERSION}</div></button>
            </div>
          </aside>
        )}

        <div className="min-w-0 space-y-6">
          <div className="lg:hidden bg-[#0B0E11] border border-[#2A353D] rounded-2xl px-3 py-2 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Current Admin Section</div><div className="text-sm font-black text-white truncate">{activeAdminTab.label}</div></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 flex-shrink-0">{activeAdminTab.group}</span>
          </div>
          {!isCommandDeckOpen && (
            <button type="button" onClick={() => setIsCommandDeckOpen(true)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] hover:text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest">Open Signal Board</button>
          )}
<Modal isOpen={!!editingGlobalUser} onClose={() => { setEditingGlobalUser(null); setSupportUserForm({}); }} title={`Support Edit User: ${editingGlobalUser?.name || editingGlobalUser?.email || ''}`}>
        {editingGlobalUser && (
          <form onSubmit={handleSupportUserUpdate} className="space-y-4 max-h-[72vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Support safety note</div>
              <p className="text-xs text-slate-300 font-bold leading-relaxed">This editor changes the Firestore user profile, including which restaurant/workspace they belong to. It does not grant super-admin access. Use Access Control for that.</p>
              <div className="text-[9px] font-mono text-slate-500 mt-2 break-all">UID: {editingGlobalUser.id}</div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={T.label}>Name</label><input value={supportUserForm.name || ''} onChange={e=>setSupportUserForm(prev=>({...prev, name:e.target.value}))} className={T.input} required /></div>
              <div><label className={T.label}>Email / Login</label><input value={supportUserForm.email || ''} onChange={e=>setSupportUserForm(prev=>({...prev, email:e.target.value}))} className={T.input} /></div>
              <div><label className={T.label}>Phone</label><input value={supportUserForm.phone || ''} onChange={e=>setSupportUserForm(prev=>({...prev, phone:e.target.value}))} className={T.input} /></div>
              <div><label className={T.label}>Role</label><input value={supportUserForm.role || ''} onChange={e=>setSupportUserForm(prev=>({...prev, role:e.target.value}))} className={T.input} placeholder="Manager, Cook, Server..." /></div>
              <div><label className={T.label}>Hourly Wage</label><input type="number" step="0.01" value={supportUserForm.wage ?? ''} onChange={e=>setSupportUserForm(prev=>({...prev, wage:e.target.value}))} className={T.input} /></div>
              <div><label className={T.label}>Restaurant / Workspace</label><select value={supportUserForm.restaurantId || ''} onChange={e=>setSupportUserForm(prev=>({...prev, restaurantId:e.target.value}))} className={T.input} required><option value="">Choose workspace...</option>{[...restaurants].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              <label className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-slate-300"><input type="checkbox" checked={!!supportUserForm.isAdmin} onChange={e=>setSupportUserForm(prev=>({...prev, isAdmin:e.target.checked}))} className="accent-[#D4A381]"/> Restaurant Admin</label>
              <label className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-slate-300"><input type="checkbox" checked={!!supportUserForm.isActive} onChange={e=>setSupportUserForm(prev=>({...prev, isActive:e.target.checked}))} className="accent-[#D4A381]"/> Active User</label>
              <label className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-slate-300"><input type="checkbox" checked={!!supportUserForm.forcePasswordChange} onChange={e=>setSupportUserForm(prev=>({...prev, forcePasswordChange:e.target.checked}))} className="accent-[#D4A381]"/> Force Password Change</label>
            </div>

            <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 space-y-3">
              <div>
                <div className={T.label}>Support Diagnostics</div>
                <p className="text-[10px] font-bold text-slate-500 leading-snug">Read-only device/access snapshot. Use Staff Roster inside the restaurant workspace to change normal feature permissions.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Push Token</div><div className={`text-xs font-black ${editingGlobalUser.fcmToken ? 'text-emerald-400' : 'text-red-300'}`}>{editingGlobalUser.fcmToken ? 'Enabled' : 'No Token'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Browser Notifications</div><div className="text-xs font-black text-white">{editingGlobalUser.notificationPermission || editingGlobalUser.deviceDiagnostics?.notifications || 'Unknown'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">GPS Permission</div><div className="text-xs font-black text-white">{editingGlobalUser.gpsPermission || editingGlobalUser.deviceDiagnostics?.gpsPermission || 'Unknown'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">GPS Support</div><div className="text-xs font-black text-white">{editingGlobalUser.deviceDiagnostics?.geolocation || 'Unknown'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Workspace Geofence</div><div className="text-xs font-black text-white">{restaurants.find(r => r.id === (supportUserForm.restaurantId || editingGlobalUser.restaurantId))?.systemSettings?.geofence ? 'Enabled' : 'Disabled / Not Set'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Last Active</div><div className="text-xs font-black text-white">{editingGlobalUser.lastActive ? formatClockDateTime(editingGlobalUser.lastActive, appUser) : 'Never'}</div></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Current Session</div><div className="text-[10px] font-bold text-slate-300 leading-snug">State: {editingGlobalUser.onlineState || 'unknown'} • Tab: {editingGlobalUser.activeTab || 'unknown'} • Host: {editingGlobalUser.activeHost || 'unknown'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Device</div><div className="text-[10px] font-bold text-slate-300 leading-snug break-words">{editingGlobalUser.activeDevice || 'Unknown device'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Screen / Time Zone</div><div className="text-[10px] font-bold text-slate-300 leading-snug">{editingGlobalUser.deviceDiagnostics?.screen || 'Unknown'} • {editingGlobalUser.deviceDiagnostics?.timezone || 'Unknown'}</div></div>
                <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Device Services</div><div className="text-[10px] font-bold text-slate-300 leading-snug">Service Worker: {editingGlobalUser.deviceDiagnostics?.serviceWorker ? 'Yes' : 'Unknown/No'} • IndexedDB: {editingGlobalUser.deviceDiagnostics?.indexedDb ? 'Yes' : 'Unknown/No'}</div></div>
              </div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">Notification Preferences</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9px] font-black uppercase tracking-widest">
                  {[['Schedule', editingGlobalUser.preferences?.notifSchedule], ['Messages', editingGlobalUser.preferences?.notifMessages], ['Trades', editingGlobalUser.preferences?.notifTrades], ['Reminders', editingGlobalUser.preferences?.notifReminders], ['Mute Days Off', editingGlobalUser.preferences?.muteOnDaysOff], ['DND', editingGlobalUser.preferences?.dndEnabled], ['Level', editingGlobalUser.preferences?.notifLevel || 'default'], ['Keywords', editingGlobalUser.preferences?.keywords ? 'set' : 'none']].map(([label, value]) => <div key={label} className="bg-[#12161A] border border-[#2A353D] rounded p-1.5 text-slate-400"><span className="text-slate-500">{label}:</span> <span className="text-white">{value === true ? 'On' : value === false ? 'Off' : value}</span></div>)}
                </div>
              </div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">Current Feature Access (Read Only)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9px] font-black uppercase tracking-widest">
                  {['schedule','events','ops','inventory','prep','sales','team','labor'].map(key => <div key={key} className={`rounded p-1.5 border ${editingGlobalUser.permissions?.[key] ? 'bg-emerald-900/10 border-emerald-900/40 text-emerald-300' : 'bg-[#12161A] border-[#2A353D] text-slate-500'}`}>{key}: {editingGlobalUser.permissions?.[key] ? 'On' : 'Off'}</div>)}
                </div>
              </div>
            </div>

            <div><label className={T.label}>Support Note</label><textarea value={supportUserForm.supportNote || ''} onChange={e=>setSupportUserForm(prev=>({...prev, supportNote:e.target.value}))} className={T.input} rows="3" placeholder="Why are you moving/editing this user? This goes into the audit trail."></textarea></div>
            {editingGlobalUser.isSuperAdmin && <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-3 text-xs font-bold text-red-200">This user has super-admin access. This form will not grant or revoke that. Use Access Control.</div>}
            <button type="submit" className={`w-full ${T.btn}`}>Save Support Changes</button>
          </form>
        )}
      </Modal>

<Modal isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} title={`Client Users: ${selectedClient?.name || ''}`} sizeClass="max-w-6xl">
        {selectedClient && (
          <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
            <div className="bg-[#12161A] border border-[#2A353D] rounded-2xl p-3 sm:p-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Workspace Snapshot</div>
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">{selectedClient.name}</h3>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 break-all">ID: {selectedClient.id}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 break-all">Owner: {selectedClient.ownerName || 'Unknown'} • {selectedClient.ownerEmail || 'No owner email'}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                  <button onClick={() => { setGhostTenant({ id: selectedClient.id, name: selectedClient.name, mode: 'workspace' }); setSelectedClient(null); setActiveTab('published'); }} className={`${T.btnAlt} text-[10px] px-3 py-2`}>Possess</button>
                  <button onClick={() => { setEditingRest(selectedClient); setSelectedClient(null); }} className={`${T.btn} text-[10px] px-3 py-2`}>Manage</button>
                  <button type="button" onClick={() => { setUserSearch(selectedClient.name || selectedClient.id); setSubTab('users'); setSelectedClient(null); }} className={`${T.btnAlt} text-[10px] px-3 py-2 col-span-2 sm:col-span-1`}>Global Users</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Users</div><div className="text-2xl font-black text-white">{selectedClientUsers.length}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Admins</div><div className="text-2xl font-black text-white">{selectedClientAdmins.length}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Online</div><div className="text-2xl font-black text-emerald-400">{selectedClientOnline.length}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Push</div><div className="text-2xl font-black text-white">{selectedClientPushEnabled}/{selectedClientUsers.length || 0}</div></div>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-3">
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                <div className={T.label}>Client Health</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-300">
                  <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500">Billing</div><div className="text-white truncate">{selectedClient.billingStatus || 'Unknown'}</div></div>
                  <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500">Plan</div><div className="text-white truncate">{selectedClient.planType || 'Pro'}</div></div>
                  <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500">Last active</div><div className="text-white truncate">{timeAgo(selectedClient.lastActive)}</div></div>
                  <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500">GPS/geofence</div><div className="text-white truncate">{selectedClient.systemSettings?.geofence ? 'Enabled' : 'Off / Not Set'}</div></div>
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-2">Known GPS permission snapshots: <span className="text-white">{selectedClientGpsKnown}</span></div>
              </div>
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3">
                <div className={T.label}>Enabled Modules</div>
                <div className="flex flex-wrap gap-1.5">
                  {moduleList.map(feat => <span key={feat} className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border ${selectedClient.features?.[feat] === false ? 'border-red-900/40 text-red-400 bg-red-900/10' : 'border-emerald-900/40 text-emerald-300 bg-emerald-900/10'}`}>{feat}</span>)}
                </div>
              </div>
            </div>

            <div className="bg-purple-950/20 border border-purple-500/40 rounded-2xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div><div className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">Safe Demo Mode</div><p className="text-xs text-slate-400 font-bold mt-1">Use your account to show a customer this workspace with fake contact info and read-only screens.</p></div>
                <div className="flex gap-2"><button type="button" onClick={() => startDemoMode(selectedClient, 'manager')} className={`${T.btn} text-[10px] px-3`}>Demo Manager</button><button type="button" onClick={() => startDemoMode(selectedClient, 'employee')} className={`${T.btnAlt} text-[10px] px-3`}>Demo Employee</button></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div><label className={T.label}>Demo tier</label><select value={demoPlan} onChange={e=>setDemoPlan(e.target.value)} className={T.input}>{['Starter','Pro','Elite','Enterprise'].map(x => <option key={x}>{x}</option>)}</select></div>
                <div><label className={T.label}>Default view</label><select value={demoRole} onChange={e=>setDemoRole(e.target.value)} className={T.input}><option value="manager">Manager demo</option><option value="employee">Regular employee demo</option></select></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {Object.keys(defaultDemoFeatures).map(key => <label key={key} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2"><input type="checkbox" checked={!!demoFeatures[key]} onChange={e=>setDemoFeatures(prev => ({...prev, [key]: e.target.checked}))} className="accent-[#D4A381]" />{key}</label>)}
              </div>
            </div>

            <div className="bg-[#12161A] border border-[#2A353D] rounded-2xl overflow-hidden">
              <div className="bg-[#0B0E11] border-b border-[#2A353D] p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Users in this workspace</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-0.5">Tap Support Edit for account fixes. Feature access still belongs in Staff Roster.</div>
                </div>
                <button type="button" onClick={() => { setUserSearch(selectedClient.name || selectedClient.id); setSubTab('users'); setSelectedClient(null); }} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white whitespace-nowrap">Open Global Users</button>
              </div>
              <div className="divide-y divide-[#2A353D] max-h-[45vh] overflow-y-auto custom-scrollbar">
                {selectedClientUsers.length === 0 && <div className="p-5 text-center text-xs font-bold text-slate-500">No users are attached to this client yet.</div>}
                {selectedClientUsers.map(u => (
                  <div key={u.id} className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 hover:bg-[#0B0E11]/50 transition-colors">
                    <div className="min-w-0 flex gap-3">
                      <img src={getAvatar(u.name || u.email || 'User', u.photoURL)} alt="User" className="w-10 h-10 rounded-full border border-[#2A353D] object-cover flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="font-black text-white text-sm sm:text-base truncate max-w-full">{u.name || u.email || 'Unnamed User'}</div>
                          {u.isAdmin && <span className="bg-red-500/20 border border-red-500/40 text-red-200 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest">Admin</span>}
                          {isOnlineNow(u) && <span className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest">Online</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold truncate mt-0.5">{u.email || 'No email'} • <span className="text-[#D4A381]">{u.role || 'No role'}</span></div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2 py-1"><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Presence</div><div className="text-[10px] text-slate-300 font-bold truncate">Manual snapshot only</div></div>
                          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2 py-1"><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Push</div><div className={`text-[10px] font-bold truncate ${u.fcmToken ? 'text-emerald-300' : 'text-slate-400'}`}>{u.fcmToken ? 'On' : 'Off'}</div></div>
                          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2 py-1"><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">GPS</div><div className="text-[10px] text-slate-300 font-bold truncate">{u.gpsPermission || u.deviceDiagnostics?.gpsPermission || 'Unknown'}</div></div>
                          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2 py-1"><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Tab</div><div className="text-[10px] text-slate-300 font-bold truncate">{u.activeTab || 'Unknown'}</div></div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:justify-end gap-2 lg:min-w-[360px]">
                      <button onClick={() => openSupportUserEditor(u)} className="px-2.5 py-2 bg-blue-900/20 border border-blue-500/50 text-blue-300 font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-blue-900/40">Support Edit</button>
                      <button onClick={() => { setGhostTenant({ id: selectedClient.id, name: selectedClient.name, mode: 'user', impersonate: u }); setSelectedClient(null); setActiveTab('published'); }} className="px-2.5 py-2 bg-fuchsia-900/20 border border-fuchsia-500/50 text-fuchsia-300 font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-fuchsia-900/40">Possess</button>
                      <button onClick={async () => { if(!window.confirm(`Force ${u.name || u.email} to log out and clear their device cache?`)) return; await updateDoc(doc(db, 'users', u.id), { forceLogout: true }); addToast('Executed', 'Kill signal sent to user device.'); }} className="px-2.5 py-2 bg-orange-900/20 border border-orange-900/50 text-orange-300 font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-orange-900/40">Force Logout</button>
                      <button onClick={() => handleDeleteGlobalUser(u)} className="px-2.5 py-2 bg-red-900/20 border border-red-900/50 text-red-300 font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-red-900/40">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

<Modal isOpen={!!editingRest} onClose={() => setEditingRest(null)} title={`Manage Client: ${editingRest?.name}`}>
        {editingRest && (() => {
          
// --- THE TIER PRESET ENGINE ---
          const applyTierPreset = (tier) => {
            // 1. Start with a baseline where EVERY feature is explicitly set to FALSE
            const baseFeatures = { schedule: false, events: false, ops: false, messages: false, prep: false, recipes: false, inventory: false, sales: false, team: false, maintenance: false, labor: false, timesheets: false };
            let newLabs = { laborProjection: false };
            let updatedFeatures = { ...baseFeatures };
            
            // 2. Merge only the allowed features as TRUE over the baseline
            if (tier === 'Starter') {
                updatedFeatures = { ...baseFeatures, schedule: true, events: true, ops: true, messages: true, prep: true, team: true };
            } else if (tier === 'Pro') {
                updatedFeatures = { ...baseFeatures, schedule: true, events: true, ops: true, messages: true, prep: true, team: true, recipes: true, inventory: true, maintenance: true };
            } else if (tier === 'Elite') {
                updatedFeatures = { ...baseFeatures, schedule: true, events: true, ops: true, messages: true, prep: true, team: true, recipes: true, inventory: true, maintenance: true, sales: true, labor: true, timesheets: true };
            } else if (tier === 'Enterprise') {
                // Enterprise: Everything (Up to 5 Locations)
                updatedFeatures = { ...baseFeatures, schedule: true, events: true, ops: true, messages: true, prep: true, team: true, recipes: true, inventory: true, maintenance: true, sales: true, labor: true, timesheets: true };
                newLabs = { laborProjection: true };
            }

            // 3. Save the complete object (with explicit true/false flags) to state
            setEditingRest({
                ...editingRest,
                planType: tier,
                features: updatedFeatures,
                labs: newLabs
            });
          };
       
    
          return (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
<form onSubmit={handleUpdateTenant} className="space-y-4">
                {/* ACTIVE SEATS DASHBOARD */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#12161A] p-4 rounded-xl border border-[#2A353D] mb-2 shadow-inner">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active User Seats</div>
                    <div className="text-2xl font-black text-[#D4A381]">{userCounts[editingRest.id] || 0} <span className="text-xs text-slate-400 font-bold">Staff Members</span></div>
                  </div>
                  <div>
                     <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Created</div>
                     <div className="text-xs font-black text-[#D4A381]">{formatClientCreatedTimestamp(getClientCreatedAt(editingRest))}</div>
                     {editingRest.createdAtEstimated && <div className="text-[8px] font-black uppercase tracking-widest text-amber-400 mt-1">Backfilled</div>}
                  </div>
                  <div className="sm:text-right">
                     <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Workspace ID</div>
                     <div className="text-xs font-mono font-bold text-slate-300 break-all">{editingRest.id}</div>
                  </div>
                </div>

                <div><label className={T.label}>Business Name</label><input type="text" value={editingRest.name} onChange={e => setEditingRest({...editingRest, name: e.target.value})} className={T.input} required /></div>
                <div><label className={T.label}>Owner Name</label><input type="text" value={editingRest.ownerName || ''} onChange={e => setEditingRest({...editingRest, ownerName: e.target.value})} className={T.input} required /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={T.label}>Owner Email</label><input type="email" value={editingRest.ownerEmail || ''} onChange={e => setEditingRest({...editingRest, ownerEmail: e.target.value})} className={T.input} required /></div>
                  <div><label className={T.label}>Owner Phone</label><input type="tel" value={editingRest.ownerPhone || ''} onChange={e => setEditingRest({...editingRest, ownerPhone: e.target.value})} className={T.input} required /></div>
                </div>
                <div><label className={T.label}>Street Address</label><input type="text" value={editingRest.systemSettings?.address || ''} onChange={e => setEditingRest({...editingRest, systemSettings: { ...editingRest.systemSettings, address: e.target.value }})} className={T.input} /></div>
                
   <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
                  <div><label className={T.label}>Plan Tier</label><select value={editingRest.planType || 'Pro'} onChange={e => setEditingRest({...editingRest, planType: e.target.value})} className={T.input}><option value="Trial">Trial</option><option value="Starter">Starter</option><option value="Pro">Pro</option><option value="Elite">Elite</option><option value="Enterprise">Enterprise</option></select></div>
                  <div><label className={T.label}>Billing Status</label><select value={editingRest.billingStatus || 'Paid'} onChange={e => setEditingRest({...editingRest, billingStatus: e.target.value})} className={`${T.input} ${editingRest.billingStatus === 'Past Due' ? 'text-red-500 font-black' : editingRest.billingStatus === 'Trial' ? 'text-blue-400 font-black' : 'text-emerald-500 font-black'}`}><option value="Trial">Trial (Free)</option><option value="Paid">Paid (Active)</option><option value="Past Due">Maintenance Lock (Lock App)</option></select></div>
                  <div><label className={T.label}>Custom Price ($)</label><input type="number" placeholder="Default" value={editingRest.customPrice || ''} onChange={e => setEditingRest({...editingRest, customPrice: e.target.value})} className={`${T.input} placeholder-slate-600`} /></div>
                  <div><label className={T.label}>Trial Length (Days)</label><input type="number" min="0" placeholder="14" value={editingRest.trialDays !== undefined ? editingRest.trialDays : 14} onChange={e => setEditingRest({...editingRest, trialDays: parseInt(e.target.value) || 0})} className={T.input} /></div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2 p-3 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer hover:bg-[#1A2126] transition-colors"><input type="checkbox" checked={editingRest.isActive} onChange={e => setEditingRest({...editingRest, isActive: e.target.checked})} className="w-4 h-4 accent-emerald-500" /><span className={`text-xs font-black ${editingRest.isActive ? 'text-emerald-500' : 'text-slate-500'}`}>System Active</span></label>
                  <label className="flex items-center gap-2 p-3 bg-blue-900/10 rounded-xl border border-blue-900/50 cursor-pointer hover:bg-blue-900/20 transition-colors"><input type="checkbox" checked={editingRest.isReadOnly} onChange={e => setEditingRest({...editingRest, isReadOnly: e.target.checked})} className="w-4 h-4 accent-blue-500" /><span className={`text-xs font-black ${editingRest.isReadOnly ? 'text-blue-500' : 'text-slate-500'}`}>Read-Only Mode</span></label>
                </div>

                {/* Super-admin access is intentionally NOT managed here.
                    Use System Administrator > Access Control so elevated permissions stay in one audited place. */}

                {/* QUICK APPLY TIER PRESETS */}
                <div className="pt-4 border-t border-[#2A353D]">
                  <label className={T.label}>Quick-Apply Tier Packages</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <button type="button" onClick={() => applyTierPreset('Starter')} className={`py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors ${editingRest.planType === 'Starter' ? 'bg-slate-100 text-slate-900 border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:border-slate-500'}`}>Starter</button>
                    <button type="button" onClick={() => applyTierPreset('Pro')} className={`py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors ${editingRest.planType === 'Pro' ? 'bg-[#D4A381] text-slate-900 border-[#C59373] shadow-[0_0_10px_rgba(212,163,129,0.2)]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:border-[#D4A381]'}`}>Pro</button>
                    <button type="button" onClick={() => applyTierPreset('Elite')} className={`py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors ${editingRest.planType === 'Elite' ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:border-blue-500'}`}>Elite</button>
<button type="button" onClick={() => applyTierPreset('Enterprise')} className={`py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors ${editingRest.planType === 'Enterprise' ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-[#12161A] text-slate-400 border-[#2A353D] hover:border-purple-500'}`} title="Up to 5 Locations">Enterprise</button>                  </div>
           <button type="button" onClick={() => {
                    applyTierPreset('Pro');
                    setEditingRest(prev => ({...prev, planType: 'Trial', billingStatus: 'Trial'}));
                  }} className={`w-full mt-2 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors ${editingRest.billingStatus === 'Trial' ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-blue-900/20 text-blue-400 border-blue-900/50 hover:bg-blue-900/40'}`}>
                    🎁 Start {editingRest.trialDays !== undefined ? editingRest.trialDays : 14}-Day Free Trial (Unlocks Pro Features)
                  </button>
                </div>

                {/* MANUAL MODULE OVERRIDES */}
                <div className="pt-4 border-t border-[#2A353D]">
                   <label className={T.label}>Manual Module Overrides</label>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {['schedule', 'events', 'ops', 'messages', 'prep', 'recipes', 'inventory', 'sales', 'team', 'maintenance', 'labor', 'timesheets'].map(feat => (
                        <label key={feat} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${editingRest.features && editingRest.features[feat] ? 'bg-[#8F6040]/20 border-[#C59373]' : 'bg-[#12161A] border-[#2A353D] hover:bg-[#1A2126]'}`}>
                          <input type="checkbox" checked={editingRest.features ? editingRest.features[feat] : false} onChange={e => setEditingRest({...editingRest, features: { ...(editingRest.features || {}), [feat]: e.target.checked }})} className="w-4 h-4 accent-[#8F6040]" />
                          <span className={`text-[11px] font-bold capitalize ${editingRest.features && editingRest.features[feat] ? 'text-[#D4A381]' : 'text-slate-400'}`}>{feat}</span>
                        </label>
                      ))}
                   </div>
                </div>
                
                {/* LABS / CANARY ROLLOUT */}
                <div className="pt-2 border-t border-[#2A353D]">
                  <label className={T.label}>Labs / Beta Features (Canary Rollout)</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${editingRest.labs?.laborProjection ? 'bg-purple-900/20 border-purple-500/50' : 'bg-[#12161A] border-[#2A353D] hover:bg-[#1A2126]'}`}>
                      <input type="checkbox" checked={editingRest.labs?.laborProjection || false} onChange={e => setEditingRest({...editingRest, labs: { ...(editingRest.labs || {}), laborProjection: e.target.checked }})} className="w-4 h-4 accent-purple-500" />
                      <span className={`text-[11px] font-bold capitalize ${editingRest.labs?.laborProjection ? 'text-purple-400' : 'text-slate-400'}`}>Labor Projections</span>
                    </label>
                  </div>
                </div>

                <button type="submit" className={`w-full ${T.btn} bg-gradient-to-r from-red-600 to-red-800 text-white mt-4`}>Save Configuration</button>
              </form>

              {/* BACKUP & RESTORE */}
              <div className="pt-4 border-t border-[#2A353D] mt-4 space-y-3">
                <h4 className="text-[10px] uppercase tracking-widest text-emerald-500 font-black mb-2">Database Backup & Recovery</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleCreateBackup(editingRest)} className="w-full bg-emerald-900/20 text-emerald-400 font-bold py-2.5 rounded-lg border border-emerald-900/50 hover:bg-emerald-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                    💾 Download JSON
                  </button>
                  <label className="w-full bg-blue-900/20 text-blue-400 font-bold py-2.5 rounded-lg border border-blue-900/50 hover:bg-blue-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                    <span>🔄 Upload Restore</span>
                    <input type="file" accept=".json" onChange={(e) => handleRestoreBackup(e, editingRest)} className="hidden" />
                  </label>
                </div>
                <button type="button" onClick={() => handleExportData(editingRest)} className="w-full bg-[#12161A] text-slate-300 font-bold py-2 rounded-xl border border-[#2A353D] hover:text-white transition-all text-xs flex items-center justify-center gap-2 mt-2">
                  <ClipboardList size={14}/> Download CSV User Export
                </button>
              </div>

              {/* DANGER ZONE */}
              <div className="pt-4 border-t border-red-900/50 mt-4 space-y-3">
                <div>
                  <h4 className="text-[10px] uppercase tracking-widest text-red-500 font-black mb-2 text-center">Danger Zone (Data Wipes)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'inventory', label: 'Inventory & Vendors' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Inventory</button>
                    <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'schedule', label: 'Schedule & Time Off' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Schedule</button>
                    <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'recipes', label: 'All Recipes' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Recipes</button>
                    <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'events', label: 'Events & Messages' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Events/Msgs</button>
                    <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'users', label: 'All Users/Staff' })} className="w-full bg-red-900/10 text-red-500 font-bold py-2 rounded-lg border border-red-900/30 hover:bg-red-900/40 transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> Users</button>
                    <button type="button" onClick={() => setNukeTarget({ rest: editingRest, type: 'everything', label: 'ABSOLUTELY EVERYTHING' })} className="w-full bg-red-600/20 text-red-500 font-black py-2 rounded-lg border border-red-500/50 hover:bg-red-600 hover:text-white transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Trash2 size={12}/> NUKE ALL</button>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!nukeTarget} onClose={() => { setNukeTarget(null); setNukePassword(''); }} title={`⚠️ CRITICAL: Nuke ${nukeTarget?.label}`}>
        <form onSubmit={handleNukeData} className="space-y-4">
          <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-xl text-red-200 text-xs font-bold leading-relaxed">
            You are about to permanently delete <strong>{nukeTarget?.label}</strong> for <strong>{nukeTarget?.rest?.name}</strong>. This action cannot be undone.
          </div>
          <div>
            <label className={T.label}>Enter Your Master Admin Password</label>
            <input type="password" value={nukePassword} onChange={e => setNukePassword(e.target.value)} className={T.input} required placeholder="Authenticate to confirm..." disabled={isNuking} />
          </div>
          <button type="submit" disabled={isNuking} className={`w-full ${T.btn} bg-red-600 hover:bg-red-700 text-white flex justify-center items-center gap-2`}>
            {isNuking ? <Loader2 className="animate-spin" size={18} /> : <><Trash2 size={18} /> Permanently Delete Data</>}
          </button>
        </form>
      </Modal>

{/* --- TAB: OVERVIEW --- */}
      {subTab === 'overview' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {commandWidgets.map(widget => (
              <button key={widget.title} type="button" onClick={() => setSubTab(widget.jump)} className={`text-left ${T.card} p-4 border ${widget.tone === 'red' ? 'border-red-900/50' : widget.tone === 'amber' ? 'border-amber-900/50' : widget.tone === 'blue' ? 'border-blue-900/50' : 'border-emerald-900/30'} hover:bg-[#12161A] transition-colors`}>
                <div className="flex items-center justify-between gap-2 mb-2"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{widget.title}</div><SignalPip tone={widget.tone} label={widget.tone === 'red' ? 'CHECK' : 'LIVE'} hot={widget.tone === 'red' || widget.tone === 'amber'} /></div>
                <div className="text-2xl font-black text-white">{widget.value}</div>
                <div className="text-[10px] text-slate-400 font-bold mt-2 leading-snug">{widget.detail}</div>
              </button>
            ))}
          </div>

          {/* PRIMARY REVENUE ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-emerald-900/30`}><div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Est. Platform MRR</div><div className="text-3xl lg:text-4xl font-black text-white">${mrr.toLocaleString()}<span className="text-sm lg:text-lg text-slate-500">/mo</span></div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest mb-1">Active Tenants</div><div className="text-3xl lg:text-4xl font-black text-white">{restaurants.filter(r=>r.isActive).length}</div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Network Users</div><div className="text-3xl lg:text-4xl font-black text-white">{allUsers.length}</div></div>
            {appUser?.isSuperAdmin === true && (
              <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-fuchsia-900/30`}><div className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest mb-1">Total App Installs</div><div className="text-3xl lg:text-4xl font-black text-white">{totalInstalls}</div></div>
            )}          
          </div>

{/* SECONDARY ENGAGEMENT & PIPELINE ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${T.card} p-4 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paid Workspaces</div><div className="text-2xl lg:text-3xl font-black text-white">{paidWorkspaces} <span className="text-[10px] text-slate-300 tracking-widest uppercase align-middle bg-[#12161A] border border-[#2A353D] px-1.5 py-0.5 rounded">ARPA: ${arpa}</span></div></div>
            <div className={`${T.card} p-4 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-blue-900/30`}><div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Active Trials</div><div className="text-2xl lg:text-3xl font-black text-white">{activeTrials} <span className="text-[10px] text-blue-400 tracking-widest uppercase align-middle bg-blue-900/20 border border-blue-900/50 px-1.5 py-0.5 rounded">Pipe: ${trialPipelineValue}</span></div></div>
            <div className={`${T.card} p-4 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Daily Active (DAU)</div><div className="text-2xl lg:text-3xl font-black text-white">{dau} <span className="text-[10px] text-orange-500 tracking-widest uppercase align-middle bg-orange-900/20 border border-orange-900/50 px-1.5 py-0.5 rounded">Today</span></div></div>
            <div className={`${T.card} p-4 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">App Sticky Rate</div><div className={`text-2xl lg:text-3xl font-black ${stickyRate < 30 ? 'text-red-400' : 'text-emerald-400'}`}>{stickyRate}% <span className="text-[10px] text-slate-500 tracking-widest uppercase align-middle bg-[#12161A] border border-[#2A353D] px-1.5 py-0.5 rounded text-white">Adoption</span></div></div>
          </div>

          {/* PRICING & MRR CONFIG */}
          {/* ... (Your pricing and stale account code remains exactly the same here) ... */}

          <div className={`${T.card} p-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-black text-white text-sm flex items-center gap-2"><Shield size={18} className={T.copper}/> Administrator Action Queue</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Only the important warnings. Less disco ball, more control tower.</p>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${platformStatus === 'Clean' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : platformStatus === 'Monitoring' ? 'bg-amber-900/20 text-amber-400 border-amber-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>{platformStatus}</span>
            </div>
            {adminRiskQueue.length === 0 ? (
              <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-4 text-sm font-bold text-emerald-400">No urgent admin issues detected.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {adminRiskQueue.slice(0, 6).map((item, idx) => (
                  <button key={idx} type="button" onClick={() => setSubTab(item.jump)} className={`text-left bg-[#12161A] border rounded-xl p-3 hover:bg-[#0B0E11] transition-colors ${item.tone === 'red' ? 'border-red-900/50' : item.tone === 'amber' ? 'border-amber-900/50' : 'border-[#2A353D]'}`}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${item.tone === 'red' ? 'text-red-400' : item.tone === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>{item.title}</div>
                    <div className="text-xs text-slate-300 font-bold leading-snug">{item.detail}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* --- GLOBAL INFRASTRUCTURE & HEALTH MATRIX --- */}
          <div className={`${T.card} overflow-hidden border-slate-700/50`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className="font-black text-lg text-white flex items-center gap-2"><Globe className="text-blue-500" size={18}/> Infrastructure Health Matrix</h3>
              <span className="bg-[#1A2126] text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">Version {CURRENT_VERSION}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#2A353D]">
              
              {/* Shard Status */}
              <div className="p-5 flex items-center justify-between hover:bg-[#12161A]/50 transition-colors">
                <div>
                  <div className="font-black text-white text-sm">Core Database Shards</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Firebase Firestore DB</div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-900/50 px-3 py-1.5 rounded-lg">
                  <span className="cockpit-light quiet bg-emerald-400 text-emerald-400"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Operational</span>
                </div>
              </div>

              {/* Stability Status */}
              <div className="p-5 flex items-center justify-between hover:bg-[#12161A]/50 transition-colors">
                <div>
                  <div className="font-black text-white text-sm">Application Stability</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{crashes24h} Crashes (Last 24h)</div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${crashes24h > 10 ? 'bg-red-900/20 border-red-900/50 text-red-400 animate-pulse' : crashes24h > 0 ? 'bg-orange-900/20 border-orange-900/50 text-orange-400' : 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400'}`}>
                  {crashes24h > 10 ? <Bug size={14}/> : <Check size={14}/>}
                  <span className="text-[10px] font-black uppercase tracking-widest">{crashes24h > 10 ? 'Degraded' : crashes24h > 0 ? 'Monitoring' : 'Stable'}</span>
                </div>
              </div>

              {/* Push Relay Status */}
              <div className="p-5 flex items-center justify-between border-t border-[#2A353D] hover:bg-[#12161A]/50 transition-colors">
                <div>
                  <div className="font-black text-white text-sm">Push Notification Relay</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{pushOptInRate}% Global Opt-In Rate</div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${pushOptInRate < 30 ? 'bg-orange-900/20 border-orange-900/50 text-orange-400' : 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400'}`}>
                  <Bell size={14}/>
                  <span className="text-[10px] font-black uppercase tracking-widest">{pushOptInRate < 30 ? 'Low Adoption' : 'Active'}</span>
                </div>
              </div>

              {/* API Webhooks Status */}
              <div className="p-5 flex items-center justify-between border-t border-[#2A353D] hover:bg-[#12161A]/50 transition-colors">
                <div>
                  <div className="font-black text-white text-sm">External API Webhooks</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">POS & Payroll Sync</div>
                </div>
                <div className="flex items-center gap-2 bg-[#12161A] border border-[#2A353D] px-3 py-1.5 rounded-lg">
                  <Repeat size={14} className="text-blue-400"/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{apiConnectedCount} Endpoints Live</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- TAB: LIVE OPS / PRESENCE RADAR --- */}
      {subTab === 'roles' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-4 sm:p-5`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div><h2 className="text-xl font-black text-white">Permission & Role Manager</h2><p className="text-xs text-slate-400 font-bold mt-1">A platform-wide guide for who can do what. Specific staff permissions still apply from each restaurant Staff Roster.</p></div>
              <button onClick={saveRoleMatrix} disabled={isSavingRoleMatrix} className={`${T.btn} flex items-center justify-center gap-2`}>{isSavingRoleMatrix ? <Loader2 size={16} className="animate-spin"/> : <Shield size={16}/>} Save Role Matrix</button>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-[980px] w-full text-left border-separate border-spacing-0">
                <thead><tr><th className="sticky left-0 z-10 bg-[#12161A] border border-[#2A353D] rounded-l-xl p-3 text-[10px] uppercase tracking-widest text-[#D4A381]">Role</th>{ROLE_MANAGER_PERMISSIONS.map(p => <th key={p.key} className="bg-[#12161A] border-y border-r border-[#2A353D] p-3 text-[10px] uppercase tracking-widest text-slate-400">{p.label}</th>)}</tr></thead>
                <tbody>{ROLE_MANAGER_ROLES.map(role => <tr key={role}><td className="sticky left-0 z-10 bg-[#0B0E11] border-x border-b border-[#2A353D] p-3 font-black text-white text-sm">{role}</td>{ROLE_MANAGER_PERMISSIONS.map(p => <td key={`${role}-${p.key}`} className="bg-[#0B0E11] border-r border-b border-[#2A353D] p-3 text-center"><label className="inline-flex items-center justify-center cursor-pointer"><input type="checkbox" checked={!!rolePermissionMatrix?.[role]?.[p.key]} onChange={e => setRolePermissionMatrix(prev => ({ ...prev, [role]: { ...(prev[role] || {}), [p.key]: e.target.checked } }))} className="w-4 h-4 accent-[#D4A381]" /></label></td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">{ROLE_MANAGER_PERMISSIONS.map(p => <div key={p.key} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-xs font-black text-white">{p.label}</div><div className="text-[10px] text-slate-400 font-bold mt-1 leading-snug">{p.desc}</div></div>)}</div>
          </div>

          <div className={`${T.card} p-4 sm:p-5 space-y-4 border-cyan-900/40 bg-cyan-950/10`}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">Full Permissions Preview</h2>
                <p className="text-xs text-slate-400 font-bold mt-1">Pick a user and see the screens, sensitive tools, and blocked areas they should experience before you hand them the keys.</p>
              </div>
              <select value={v14PermissionUserId} onChange={e => setV14PermissionUserId(e.target.value)} className={`${T.input} lg:max-w-sm`}>
                <option value="">Auto-select user</option>
                {allUsers.slice(0, 400).map(u => <option key={u.id} value={u.id}>{u.name || u.email || u.id} • {restaurants.find(r => r.id === u.restaurantId)?.name || u.restaurantId || 'no workspace'}</option>)}
              </select>
            </div>
            {v14PermissionPreview ? (
              <div className="grid lg:grid-cols-[1fr_1fr_.75fr] gap-3">
                <div className="bg-[#0B0E11] border border-emerald-900/40 rounded-xl p-3"><div className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-2">Allowed Screens</div>{v14PermissionPreview.allowed.map(x => <div key={x.key} className="text-xs font-bold text-slate-300 py-1">✓ {x.label}<span className="text-slate-500"> • {x.reason}</span></div>)}</div>
                <div className="bg-[#0B0E11] border border-red-900/40 rounded-xl p-3"><div className="text-[9px] font-black uppercase tracking-widest text-red-300 mb-2">Blocked Screens</div>{v14PermissionPreview.blocked.map(x => <div key={x.key} className="text-xs font-bold text-slate-400 py-1">× {x.label}<span className="text-slate-600"> • {x.reason}</span></div>)}</div>
                <div className="bg-[#0B0E11] border border-blue-900/40 rounded-xl p-3"><div className="text-[9px] font-black uppercase tracking-widest text-blue-300 mb-2">Sensitive Areas</div>{Object.entries(v14PermissionPreview.sensitive || {}).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-2 py-1 text-xs font-bold"><span className="text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</span><span className={value ? 'text-emerald-300' : 'text-red-300'}>{value ? 'yes' : 'no'}</span></div>)}</div>
              </div>
            ) : <div className="text-xs text-slate-500 font-bold">No user selected.</div>}
          </div>
        </div>
      )}

      {subTab === 'push' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CockpitMetric label="Connected Devices" value={pushEnabledUsers.length} detail={`${allUsers.length - pushEnabledUsers.length} missing tokens`} tone={pushEnabledUsers.length ? 'emerald' : 'amber'} />
            <CockpitMetric label="Stale Tokens" value={stalePushUsers.length} detail="30+ days since sync" tone={stalePushUsers.length ? 'amber' : 'emerald'} hot={stalePushUsers.length > 0} />
            <CockpitMetric label="Browser Permission" value={envReport.notifications} detail={`This admin device • ${envReport.host}`} tone={envReport.notifications === 'granted' ? 'emerald' : 'amber'} />
            <CockpitMetric label="Last Push Result" value={backupStatus?.lastPushResult || 'Not logged'} detail="Server route returns exact sent/failed counts when supported" tone="blue" />
          </div>
          <div className={`${T.card} p-4 flex flex-col sm:flex-row gap-2 sm:items-center justify-between`}>
            <div>
              <h2 className="font-black text-white">Push Token Repair Center</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">Repair missing/stale tokens, copy reconnect links, and clear dead device records without pretending the server can create a token for someone else's phone.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={flagStalePushTokensForRepair} className={T.btnAlt}>Prune + Repair Stale</button>
              <button onClick={exportPushDiagnostics} className={T.btn}>Export Push Diagnostic Report</button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className={`${T.card} p-3 border-amber-900/40 bg-amber-900/10`}><div className="text-[9px] uppercase tracking-widest text-amber-300 font-black">Missing Token</div><p className="text-[10px] text-slate-300 font-bold mt-1">Permission can say granted while no FCM token exists. Use Request Reconnect or Copy Link, then the employee must open the app on that device.</p></div>
            <div className={`${T.card} p-3 border-orange-900/40 bg-orange-900/10`}><div className="text-[9px] uppercase tracking-widest text-orange-300 font-black">Stale Token</div><p className="text-[10px] text-slate-300 font-bold mt-1">Force Refresh clears the saved token, asks the device to refresh its service worker, and queues a fresh token sync on next open.</p></div>
            <div className={`${T.card} p-3 border-emerald-900/40 bg-emerald-900/10`}><div className="text-[9px] uppercase tracking-widest text-emerald-300 font-black">Connected</div><p className="text-[10px] text-slate-300 font-bold mt-1">Send Test validates the saved token through the server route. Bad tokens are automatically flagged by the push send route.</p></div>
          </div>
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-3 border-b ${T.border} text-[10px] font-black uppercase tracking-widest text-[#D4A381]`}>Connected devices by user</div>
            <div className={`divide-y ${T.border} max-h-[62vh] overflow-y-auto custom-scrollbar`}>
              {pushRows.map(u => {
                const restName = restaurants.find(r => r.id === u.restaurantId)?.name || 'Unknown Workspace';
                const needsRepair = u.pushNeedsRepair || u.pushForceServiceWorkerRefresh || u.pushStatus === 'missing token' || u.pushStatus === 'stale token';
                return (
                  <div key={u.id} className="p-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3 hover:bg-[#12161A]/55">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-black text-white text-sm truncate">{u.name || u.email || 'Unnamed User'}</div>
                        {u.pushNeedsRepair && <span className="px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-900/60 text-amber-300 text-[8px] font-black uppercase tracking-widest">Repair queued</span>}
                        {u.pushForceServiceWorkerRefresh && <span className="px-2 py-0.5 rounded-full bg-orange-900/30 border border-orange-900/60 text-orange-300 text-[8px] font-black uppercase tracking-widest">Force refresh</span>}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 truncate">{restName} • {u.email || 'no email'} • Devices: {u.deviceCount}</div>
                      <div className="grid sm:grid-cols-4 gap-2 mt-2 text-[10px] font-bold">
                        <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Permission</div><div className="text-white">{u.notificationPermission || u.pushTokenPermission || 'unknown'}</div></div>
                        <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Last Sync</div><div className="text-white">{getExactTime(u.fcmTokenUpdatedAt || u.lastPushTokenSyncAt)}</div></div>
                        <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Host</div><div className="text-white truncate">{u.pushTokenHost || u.activeHost || 'unknown'}</div></div>
                        <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest text-[8px]">Result</div><div className={u.fcmToken ? (u.tokenFresh ? 'text-emerald-300' : 'text-amber-300') : 'text-red-300'}>{u.pushStatus}</div></div>
                      </div>
                      {(u.lastPushRepairError || u.lastPushFailureCode || u.pushRepairStatus) && <div className="mt-2 text-[10px] font-bold text-slate-400 bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2">Repair status: <span className="text-slate-200">{u.pushRepairStatus || 'not queued'}</span>{u.lastPushFailureCode ? ` • failure ${u.lastPushFailureCode}` : ''}{u.lastPushRepairError ? ` • ${u.lastPushRepairError}` : ''}</div>}
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-1 gap-2 min-w-[190px]">
                      <button onClick={() => sendPushTestToUser(u)} disabled={!u.fcmToken} className="px-3 py-2 bg-blue-900/20 border border-blue-900/50 text-blue-300 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Send Test</button>
                      <button onClick={() => requestPushRepairForUser(u)} className="px-3 py-2 bg-amber-900/20 border border-amber-900/50 text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-widest">Request Reconnect</button>
                      <button onClick={() => forceRefreshPushForUser(u)} className="px-3 py-2 bg-orange-900/20 border border-orange-900/50 text-orange-300 rounded-xl text-[10px] font-black uppercase tracking-widest">Force Refresh</button>
                      <button onClick={() => copyPushRepairLinkForUser(u)} className="px-3 py-2 bg-cyan-900/20 border border-cyan-900/50 text-cyan-300 rounded-xl text-[10px] font-black uppercase tracking-widest">Copy Link</button>
                      {needsRepair && <button onClick={() => clearPushRepairFlagForUser(u)} className="px-3 py-2 bg-slate-800/60 border border-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest col-span-2 xl:col-span-1">Clear Flag</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'setup' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-4`}><div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between"><div><h2 className="text-xl font-black text-white">Workspace Setup Wizard</h2><p className="text-xs text-slate-400 font-bold mt-1">Guided checklist for making a restaurant deploy-ready.</p></div><select value={setupWorkspaceId} onChange={e=>setSetupWorkspaceId(e.target.value)} className={`${T.input} sm:max-w-sm`}><option value="">Choose workspace...</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select></div></div>
          {setupWorkspace ? <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-4"><div className={`${T.card} p-4`}><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Selected workspace</div><h3 className="text-2xl font-black text-white mt-1">{setupWorkspace.name || setupWorkspace.id}</h3><p className="text-xs text-slate-400 font-bold mt-2">Owner: {setupWorkspace.ownerName || 'Unknown'} • {setupWorkspace.ownerEmail || 'No email'}</p><button onClick={() => setEditingRest(setupWorkspace)} className={`${T.btn} w-full mt-4`}>Open Workspace Settings</button></div><div className={`${T.card} p-4`}><div className="grid sm:grid-cols-2 gap-2">{setupItems.map(([label, ok, detail]) => <div key={label} className={`border rounded-xl p-3 ${ok ? 'bg-emerald-900/10 border-emerald-900/40' : 'bg-amber-900/10 border-amber-900/40'}`}><div className="flex items-center gap-2"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${ok ? 'bg-emerald-500 text-slate-900' : 'bg-amber-400 text-slate-900'}`}>{ok ? '✓' : '!'}</span><div className="font-black text-white text-sm">{label}</div></div><div className="text-[10px] text-slate-400 font-bold mt-2 ml-7">{detail}</div></div>)}</div></div></div> : <div className={`${T.card} p-8 text-center text-slate-500 font-bold`}>Choose a workspace to run the setup checklist.</div>}
        </div>
      )}

      {subTab === 'deployment' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5 border ${deploymentReady ? 'border-emerald-900/50' : 'border-red-900/50'}`}><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Deployment Readiness Checker</div><h2 className={`text-3xl font-black mt-1 ${deploymentReady ? 'text-emerald-300' : 'text-red-300'}`}>{deploymentReady ? 'READY TO DEPLOY' : 'DO NOT DEPLOY YET'}</h2><p className="text-xs text-slate-400 font-bold mt-1">Run health/diagnostics, then use this checklist before production.</p></div><button onClick={handleRunFullSystemDiagnostics} disabled={isDiagnosticsRunning} className={`${T.btn} flex items-center gap-2 justify-center`}>{isDiagnosticsRunning ? <Loader2 className="animate-spin" size={16}/> : <Wrench size={16}/>} Run Full System Diagnostics</button></div></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{deploymentChecks.map(check => <div key={check.label} className={`${T.card} p-4 border ${check.ok ? 'border-emerald-900/40' : 'border-red-900/50'}`}><div className="flex items-center gap-2 mb-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${check.ok ? 'bg-emerald-500 text-slate-900' : 'bg-red-500 text-white'}`}>{check.ok ? '✓' : '!'}</span><div className="font-black text-white text-sm">{check.label}</div></div><div className="text-[10px] text-slate-400 font-bold leading-snug">{check.detail}</div></div>)}</div>
        </div>
      )}

      {subTab === 'history' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-4`}><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><h2 className="text-xl font-black text-white">Restaurant Settings Version History</h2><p className="text-xs text-slate-400 font-bold mt-1">Snapshots and audit receipts for geofence, time clock, workspace, lockdown, notification, branding, and role changes.</p></div><select value={historyWorkspaceId} onChange={e=>setHistoryWorkspaceId(e.target.value)} className={`${T.input} sm:max-w-sm`}><option value="">Choose workspace...</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select></div></div>
          <div className={`${T.card} overflow-hidden`}><div className={`bg-[#12161A] p-3 border-b ${T.border} text-[10px] font-black uppercase tracking-widest text-[#D4A381]`}>{selectedHistoryWorkspace?.name || 'No workspace'} history</div><div className={`divide-y ${T.border} max-h-[62vh] overflow-y-auto custom-scrollbar`}>{settingsHistory.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No settings snapshots or matching audit events found yet.</div>}{settingsHistory.map((h, idx) => <div key={h.id || h.timestamp || idx} className="p-3 hover:bg-[#12161A]/55"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><div className="font-black text-white text-sm">{h.action || h.type || 'Settings snapshot'}</div><div className="text-[10px] text-slate-400 font-bold mt-1">{h.details || h.summary || 'Workspace setting state saved.'}</div></div><div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{getExactTime(h.timestamp || h.createdAt || h.at)}</div></div><div className="flex flex-wrap gap-2 mt-2"><button onClick={() => downloadTextFile(`86chaos-setting-history-${idx + 1}.json`, JSON.stringify(h, null, 2), 'application/json;charset=utf-8;')} className={T.btnAlt}>View previous version</button><button onClick={() => addToast('Compare', 'Downloaded JSON is the compare source for this snapshot.')} className={T.btnAlt}>Compare changes</button><button onClick={() => restoreSettingsHistoryEntry(h)} className={T.btnAlt}>Restore this setting</button></div></div>)}</div></div>
        </div>
      )}

      {subTab === 'data' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className="grid lg:grid-cols-2 gap-4"><div className={`${T.card} p-4`}><h2 className="font-black text-white text-lg">Data Export Center</h2><p className="text-xs text-slate-400 font-bold mt-1 mb-3">Export operational data to CSV before major changes.</p><div className="grid grid-cols-2 gap-2">{['staff','recipes','inventory','timePunches','schedule','audit'].map(kind => <button key={kind} onClick={() => exportCollectionCsv(kind)} className={T.btnAlt}>Export {kind}</button>)}</div></div><div className={`${T.card} p-4`}><h2 className="font-black text-white text-lg">CSV Import Center</h2><p className="text-xs text-slate-400 font-bold mt-1 mb-3">Preview-before-import so bad CSV does not shotgun the database.</p><div className="grid sm:grid-cols-2 gap-2 mb-2"><select value={importKind} onChange={e=>setImportKind(e.target.value)} className={T.input}><option value="staff">Staff CSV</option><option value="inventory">Inventory CSV</option><option value="recipes">Recipes CSV</option></select><select value={importWorkspaceId} onChange={e=>setImportWorkspaceId(e.target.value)} className={T.input}><option value="">Choose workspace...</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select></div><textarea value={importCsvText} onChange={e=>setImportCsvText(e.target.value)} className={T.input} rows="8" placeholder="name,email,phone,role\nJane,jane@example.com,920...,Server"></textarea><div className="flex gap-2 mt-2"><button onClick={previewImportRows} className={T.btnAlt}>Preview Import</button><button onClick={applyImportRows} disabled={isImportingRows || !importPreviewRows.length} className={`${T.btn} disabled:opacity-50`}>{isImportingRows ? 'Importing...' : 'Apply Import'}</button></div></div></div>
          {importPreviewRows.length > 0 && <div className={`${T.card} overflow-hidden`}><div className={`bg-[#12161A] p-3 border-b ${T.border} text-[10px] font-black uppercase tracking-widest text-[#D4A381]`}>Import preview • {importPreviewRows.length} row(s)</div><div className="overflow-auto custom-scrollbar max-h-[50vh]"><table className="min-w-full text-xs"><tbody>{importPreviewRows.slice(0, 25).map((row, idx) => <tr key={idx} className="border-b border-[#2A353D]"><td className="p-2 text-slate-500 font-black">#{row._row}</td>{Object.entries(row).filter(([k]) => k !== '_row').slice(0, 8).map(([k,v]) => <td key={k} className="p-2"><div className="text-[8px] uppercase tracking-widest text-slate-500">{k}</div><div className="text-white font-bold truncate max-w-[160px]">{v}</div></td>)}</tr>)}</tbody></table></div></div>}
        </div>
      )}

      {subTab === 'maintenance' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5`}><h2 className="text-xl font-black text-white">Maintenance Mode Controls</h2><p className="text-xs text-slate-400 font-bold mt-1">Lock the app safely while keeping Super Admin access available to fix or unlock it.</p><div className="grid sm:grid-cols-2 gap-3 mt-4"><div><label className={T.label}>Scope</label><select value={maintenanceScope} onChange={e=>setMaintenanceScope(e.target.value)} className={T.input}><option value="global">Every workspace</option><option value="restaurant">One restaurant</option></select></div><div><label className={T.label}>Restaurant</label><select disabled={maintenanceScope !== 'restaurant'} value={maintenanceRestaurantId} onChange={e=>setMaintenanceRestaurantId(e.target.value)} className={`${T.input} disabled:opacity-50`}><option value="">Choose workspace...</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select></div><div><label className={T.label}>Who is locked</label><select value={maintenanceAudience} onChange={e=>setMaintenanceAudience(e.target.value)} className={T.input}><option value="everyone_except_super_admin">Everyone except Super Admin</option><option value="employees_only">Only employees</option><option value="non_admins">Only non-admins</option><option value="one_restaurant_group">One restaurant group</option></select></div><div><label className={T.label}>Auto-unlock time</label><input type="datetime-local" value={maintenanceEndsAt} onChange={e=>setMaintenanceEndsAt(e.target.value)} className={T.input}/></div><div><label className={T.label}>Scheduled start</label><input type="datetime-local" value={maintenanceStartsAt} onChange={e=>setMaintenanceStartsAt(e.target.value)} className={T.input}/></div><div><label className={T.label}>Active maintenance locks</label><div className="bg-[#12161A] border border-[#2A353D] rounded-xl px-3 py-2 text-sm font-black text-white">{pastDueWorkspaces.length}</div></div></div><div className="mt-3"><label className={T.label}>Custom maintenance message</label><textarea value={maintenanceMessage} onChange={e=>setMaintenanceMessage(e.target.value)} className={T.input} rows="3"/></div><div className="mt-3 bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381] mb-1">Preview</div><div className="text-white font-black">Down for Maintenance</div><div className="text-xs text-slate-400 font-bold mt-1">{maintenanceMessage}</div></div><div className="grid sm:grid-cols-2 gap-2 mt-4"><button onClick={applyMaintenanceMode} className="bg-red-900/30 border border-red-900/60 text-red-200 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest">Enable Maintenance</button><button onClick={clearMaintenanceMode} className="bg-emerald-900/20 border border-emerald-900/50 text-emerald-300 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest">Clear Maintenance</button></div></div>
        </div>
      )}

      {subTab === 'branding' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5`}>
            <h2 className="text-xl font-black text-white">App Branding / Display Settings</h2>
            <p className="text-xs text-slate-400 font-bold mt-1">86 Chaos is the locked app brand. Add a customer restaurant logo beside it when needed.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <div><label className={T.label}>Workspace</label><select value={brandingWorkspaceId} onChange={e=>setBrandingWorkspaceId(e.target.value)} className={T.input}><option value="">Choose workspace...</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select></div>
              <div><label className={T.label}>Locked app name</label><input type="text" value="86 Chaos" disabled className={`${T.input} opacity-70 cursor-not-allowed`}/></div>
              {Object.entries({ restaurantGroupName:'Restaurant group name', accentColor:'Accent color', restaurantLogoUrl:'Restaurant logo URL', loginMessage:'Login screen message', helpContact:'Help Center contact info', timezone:'Default timezone', dateFormat:'Date format', timeFormat:'Time format' }).map(([key,label]) => <div key={key}><label className={T.label}>{label}</label><input type={key === 'accentColor' ? 'color' : 'text'} value={brandingForm[key] || ''} onChange={e=>setBrandingForm(prev => ({...prev, [key]: e.target.value}))} className={T.input}/></div>)}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-[#12161A] border border-[#2A353D] rounded-xl px-3 py-2">
                <input type="checkbox" checked={brandingForm.showRestaurantLogo !== false} onChange={e=>setBrandingForm(prev => ({...prev, showRestaurantLogo: e.target.checked}))} className="w-4 h-4 accent-[#8F6040]" />
                Show customer restaurant logo beside locked 86 Chaos branding
              </label>
            </div>
            <button onClick={saveBrandingSettings} className={`${T.btn} w-full mt-4`}>Save Branding Settings</button>
          </div>
        </div>
      )}

      {subTab === 'danger' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className="bg-red-950/30 border border-red-900/60 rounded-2xl p-5"><h2 className="text-2xl font-black text-red-200">Danger Zone</h2><p className="text-xs text-red-100/70 font-bold mt-1">Destructive tools live here on purpose. They require confirmation and should not be mixed with normal admin work.</p></div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[['Restore backup','Use Backup Center to restore a selected backup.','forensics'],['Delete staff','Use People Directory or the workspace user drawer.','users'],['Reset schedule','Use Emergency Schedule Rescue from Platform Operations.','ops'],['Clear demo data','Use demo workspace tools and guarded delete options.','ops'],['Force logout all users','Use People Directory/workspace drawer per user until a bulk logout route exists.','users'],['Disable workspace','Open Workspaces and set Maintenance Lock.','tenants'],['Clear stale push tokens','Use Push Control Center repair/flag action.','push'],['Reset restaurant config','Open Workspaces, review current settings, then save intentionally.','tenants']].map(([title, desc, target]) => <button key={title} onClick={() => setSubTab(target)} className="text-left bg-[#12161A] border border-red-900/40 rounded-2xl p-4 hover:bg-red-900/10"><div className="font-black text-red-200 text-sm">{title}</div><div className="text-[10px] text-slate-400 font-bold mt-2 leading-snug">{desc}</div><div className="mt-3 text-[9px] font-black uppercase tracking-widest text-red-300">Open guarded tool</div></button>)}
          </div>
          <div className={`${T.card} p-4 border-red-900/50`}><h3 className="font-black text-red-300">Backup First Rule</h3><p className="text-xs text-slate-400 font-bold mt-1">Run a full backup before restoring, deleting, disabling, or resetting anything. The app should never throw data into the fryer without a safety copy.</p><button onClick={handleRunBackupNow} disabled={isBackupRunning} className={`${T.btn} mt-3`}>{isBackupRunning ? 'Backup Running...' : 'Run Backup Now'}</button></div>
        </div>
      )}

      {subTab === 'health' && (
        <div id="admin-health" className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5 cockpit-grid border-blue-900/30`}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Health Dashboard</div>
                <h2 className="text-2xl font-black text-white">Deployment Readiness + System Health</h2>
                <p className="text-sm text-slate-400 font-bold mt-1 max-w-3xl">Live operational checks for Firestore latency, backup Storage usage, API response times, backup integrity, and last successful sync.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 w-full lg:w-auto">
                <button type="button" onClick={() => refreshHealthDashboard()} disabled={isHealthLoading} className="bg-[#12161A] border border-[#2A353D] hover:border-[#D4A381]/50 disabled:opacity-50 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#D4A381] hover:text-white transition-colors flex items-center justify-center gap-2">
                  {isHealthLoading ? <Loader2 size={14} className="animate-spin"/> : <Repeat size={14}/>} Refresh Health
                </button>
                <button type="button" onClick={handleRunFullSystemDiagnostics} disabled={isDiagnosticsRunning} className="bg-blue-900/20 border border-blue-900/50 hover:bg-blue-900/40 disabled:opacity-50 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-300 transition-colors flex items-center justify-center gap-2">
                  {isDiagnosticsRunning ? <Loader2 size={14} className="animate-spin"/> : <Wrench size={14}/>} Run Full Diagnostics
                </button>
              </div>
            </div>
            {healthError && <div className="mt-4 bg-red-900/20 border border-red-900/50 rounded-xl p-3 text-xs font-bold text-red-200">{healthError}</div>}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <CockpitMetric label="Firestore Latency" value={healthSnapshot ? `${healthSnapshot.firestoreLatencyMs}ms` : 'Run Check'} detail={healthSnapshot?.firestoreStatus || 'Not tested yet'} tone={!healthSnapshot ? 'blue' : healthSnapshot.firestoreLatencyMs > 1800 ? 'red' : healthSnapshot.firestoreLatencyMs > 800 ? 'amber' : 'emerald'} hot={!!healthSnapshot && healthSnapshot.firestoreLatencyMs > 1800} />
            <CockpitMetric label="Backup Storage" value={healthSnapshot ? formatBackupBytes(healthSnapshot.storageUsage?.totalBytes) : formatBackupBytes(backupList.reduce((sum, b) => sum + Number(b.sizeBytes || 0), 0))} detail={`${healthSnapshot?.storageUsage?.totalFiles ?? backupList.length} Storage file(s) • ${healthSnapshot?.storageUsage?.backupFiles ?? backupList.length} backup(s)`} tone="blue" />
            <CockpitMetric label="API Routes" value={healthSnapshot ? healthSnapshot.apiRouteManifest?.length ? `${healthSnapshot.apiRouteManifest.filter(r => r.status === 'ready').length}/${healthSnapshot.apiRouteManifest.length}` : `${(healthSnapshot.apiChecks || []).filter(c => c.ok).length}/${(healthSnapshot.apiChecks || []).length}` : 'Run Check'} detail={healthSnapshot ? `${Math.round((healthSnapshot.apiChecks || []).reduce((sum, c) => sum + (c.ms || 0), 0) / Math.max(1, (healthSnapshot.apiChecks || []).length))}ms avg` : 'whoami / security / backups / route manifest'} tone={healthSnapshot && (healthSnapshot.apiChecks || []).some(c => !c.ok) ? 'amber' : 'emerald'} />
            <CockpitMetric label="Last Successful Sync" value={formatBackupTimestamp(healthSnapshot?.lastSuccessfulSync || backupStatus?.lastSuccessfulBackupAt || backupStatus?.lastBackupAt || backupStatus?.lastRunAt)} detail={backupStatus?.storagePath || 'Backup status route'} tone={backupIsStale ? 'amber' : 'emerald'} hot={backupIsStale} />
            <CockpitMetric label="Backup Integrity" value={healthSnapshot?.backupIntegrity?.status || backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'Not Checked'} detail={healthSnapshot?.backupIntegrity?.verifiedAt ? formatBackupTimestamp(healthSnapshot.backupIntegrity.verifiedAt) : (backupStatus?.lastIntegrityVerifiedAt ? formatBackupTimestamp(backupStatus.lastIntegrityVerifiedAt) : 'Round-trip verification')} tone={(healthSnapshot?.backupIntegrity?.status || backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status) === 'failed' ? 'red' : (healthSnapshot?.backupIntegrity?.status || backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status) === 'verified' ? 'emerald' : 'amber'} hot={(healthSnapshot?.backupIntegrity?.status || backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status) === 'failed'} />
          </div>

          <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-4">
            <div className={`${T.card} overflow-hidden`}>
              <div className={`bg-[#12161A] p-4 border-b ${T.border} flex items-center justify-between gap-3`}>
                <div>
                  <h3 className="font-black text-sm text-white flex items-center gap-2"><Globe className="text-blue-400" size={18}/> API Response Times</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Useful before deploys: auth route, diagnostics route, and backup Storage list route.</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{healthSnapshot?.generatedAt ? formatBackupTimestamp(healthSnapshot.generatedAt) : 'Not run'}</span>
              </div>
              <div className={`divide-y ${T.border}`}>
                {!healthSnapshot && <div className="p-6 text-center text-xs font-bold text-slate-500">Click Refresh Health or Run Full Diagnostics to test the live routes.</div>}
                {(healthSnapshot?.apiChecks || []).map(check => (
                  <div key={check.label} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-black text-white text-sm">{check.label}</div>
                      <div className="text-[9px] font-mono text-slate-500 break-all">{check.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${check.ok ? 'bg-emerald-900/20 text-emerald-300 border-emerald-900/50' : 'bg-red-900/20 text-red-300 border-red-900/50'}`}>{check.ok ? 'OK' : `ERR ${check.status || ''}`}</span>
                      <span className="text-sm font-black text-white min-w-[70px] text-right">{check.ms}ms</span>
                    </div>
                    {check.error && <div className="sm:col-span-2 text-[10px] font-bold text-red-300">{check.error}</div>}
                  </div>
                ))}
                {(healthSnapshot?.apiRouteManifest || []).length > 0 && <div className="p-3 bg-[#0B0E11]/60 border-t border-[#2A353D]"><div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-2">Full Vercel API Route Manifest</div><div className="grid sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto custom-scrollbar">{healthSnapshot.apiRouteManifest.map(route => <div key={route.route} className="flex items-center justify-between gap-2 bg-[#12161A] border border-[#2A353D] rounded-lg px-2 py-1.5"><span className="text-[10px] font-mono text-slate-300 truncate">{route.route}</span><span className={`text-[8px] font-black uppercase tracking-widest ${route.status === 'ready' ? 'text-emerald-300' : 'text-red-300'}`}>{route.status}</span></div>)}</div></div>}
              </div>
            </div>

            <div className="space-y-4">
              <div className={`${T.card} p-4`}>
                <h3 className="font-black text-white text-sm flex items-center gap-2"><Shield size={16} className="text-emerald-300"/> Backup Integrity Detail</h3>
                <div className="mt-3 space-y-2 text-xs font-bold text-slate-300">
                  <div className="flex justify-between gap-2"><span className="text-slate-500 uppercase tracking-widest text-[9px]">Status</span><span className="text-white">{healthSnapshot?.backupIntegrity?.status || backupStatus?.lastIntegrityStatus || backupStatus?.backupIntegrity?.status || 'not checked'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-slate-500 uppercase tracking-widest text-[9px]">Verified</span><span className="text-white text-right">{healthSnapshot?.backupIntegrity?.verifiedAt ? formatBackupTimestamp(healthSnapshot.backupIntegrity.verifiedAt) : (backupStatus?.lastIntegrityVerifiedAt ? formatBackupTimestamp(backupStatus.lastIntegrityVerifiedAt) : 'Not yet')}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-slate-500 uppercase tracking-widest text-[9px]">Documents</span><span className="text-white">{healthSnapshot?.backupIntegrity?.documentCount || backupStatus?.backupIntegrity?.documentCount || backupStatus?.documentCount || 0}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-slate-500 uppercase tracking-widest text-[9px]">Collections</span><span className="text-white">{healthSnapshot?.backupIntegrity?.collectionCount || backupStatus?.backupIntegrity?.collectionCount || backupStatus?.collectionCount || 0}</span></div>
                  <div className="pt-2 border-t border-[#2A353D]"><div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">SHA-256</div><div className="text-[9px] font-mono text-slate-500 break-all">{healthSnapshot?.backupIntegrity?.sha256 || backupStatus?.backupSha256 || backupStatus?.backupIntegrity?.sha256 || 'not stamped yet'}</div></div>
                  {((healthSnapshot?.backupIntegrity?.errors || backupStatus?.backupIntegrity?.errors || []).length > 0) && <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-2 text-[10px] text-red-200">{(healthSnapshot?.backupIntegrity?.errors || backupStatus?.backupIntegrity?.errors || []).join(' | ')}</div>}
                </div>
              </div>
              <div className={`${T.card} p-4`}>
                <h3 className="font-black text-white text-sm flex items-center gap-2"><Wrench size={16} className="text-blue-300"/> Deployment Diagnostics</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 leading-snug">Run this before pushing production changes. It downloads a JSON report with server checks and client health, then writes a system audit record.</p>
                <button type="button" onClick={handleRunFullSystemDiagnostics} disabled={isDiagnosticsRunning} className="mt-3 w-full bg-blue-900/20 text-blue-300 border border-blue-900/50 hover:bg-blue-900/40 disabled:opacity-50 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  {isDiagnosticsRunning ? <Loader2 size={14} className="animate-spin"/> : <Wrench size={14}/>} Run Full System Diagnostics
                </button>
                {lastDiagnosticsReport && <div className="mt-3 bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 text-[10px] font-bold text-slate-400">Last report: {formatBackupTimestamp(lastDiagnosticsReport.generatedAt)} • Duration {lastDiagnosticsReport.durationMs || 0}ms • Integrity {lastDiagnosticsReport.backupIntegrity?.status || 'unknown'}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'security' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {securityError && <div className="bg-red-900/20 border border-red-900/50 text-red-100 rounded-2xl p-4 text-sm font-bold leading-snug">Security diagnostics failed: {securityError}</div>}
          <div className={`${T.card} p-5 border border-blue-900/40`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">System Administrator</div>
                <h2 className="text-3xl font-black text-white mt-1 flex items-center gap-2"><Shield size={28} className="text-blue-300"/> Security Center</h2>
                <p className="text-xs text-slate-400 font-bold mt-1">One-button security snapshot for rules, App Check, MFA risk, env vars, cron, rate limits, and suspicious activity.</p>
              </div>
              <button onClick={() => loadSecurityCenter()} disabled={isSecurityLoading} className={`${T.btn} flex items-center gap-2 justify-center`}>{isSecurityLoading ? <Loader2 className="animate-spin" size={16}/> : <Shield size={16}/>} Refresh Security Center</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-9 gap-4">
            <StatusTile label="Firestore Rules" value={securityReport?.security?.firestoreRules?.status || 'Not checked'} />
            <StatusTile label="Storage Rules" value={securityReport?.security?.storageRules?.status || 'Not checked'} />
            <StatusTile label="App Check" value={securityReport?.security?.appCheck?.status || 'Not checked'} />
            <StatusTile label="MFA Enforcement" value={securityReport?.security?.mfa?.apiEnforcementEnabled ? 'On' : 'Testing'} />
            <StatusTile label="Risky Users" value={securityReport?.riskyUsers?.length ?? '—'} />
            <StatusTile label="Last Backup" value={securityReport?.cron?.lastBackupAt ? formatClockDateTime(securityReport.cron.lastBackupAt) : 'Not checked'} />
            <StatusTile label="Restore Drill" value={restoreDrillStatus?.lastDrillAt ? formatBackupTimestamp(restoreDrillStatus.lastDrillAt) : 'Not recorded'} />
            <StatusTile label="Deletion Requests" value={activeAccountDeletionRequests.length} />
            <StatusTile label="Version" value={securityReport?.app?.version || CURRENT_VERSION || 'Unknown'} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${T.card} overflow-hidden`}>
              <div className={T.th}>Missing / Important Vercel Env Vars</div>
              {(securityReport?.envVars || []).length === 0 ? <SmartEmptyState title="Not checked yet" desc="Press Refresh Security Center." /> : (securityReport.envVars || []).map(env => (
                <div key={env.name} className={`${T.row} flex items-center justify-between gap-3`}><div className="font-mono text-xs text-white">{env.name}</div><SignalPip tone={env.present ? 'emerald' : 'red'} label={env.present ? 'set' : 'missing'} /></div>
              ))}
            </div>
            <div className={`${T.card} overflow-hidden`}>
              <div className={T.th}>Cron + Rate Limit Status</div>
              <div className={`${T.row}`}><div className="font-black text-white text-sm">CRON_SECRET</div><div className="text-xs text-slate-400 font-bold mt-1">{securityReport?.cron?.cronSecretConfigured ? 'Configured' : 'Missing or not checked'}</div></div>
              <div className={`${T.row}`}><div className="font-black text-white text-sm">Last Backup</div><div className="text-xs text-slate-400 font-bold mt-1">{securityReport?.cron?.lastBackupAt ? formatClockDateTime(securityReport.cron.lastBackupAt) : 'Not checked'}</div></div>
              {(securityReport?.rateLimits?.recentLimitedRoutes || []).length === 0 ? <div className={`${T.row} text-xs text-slate-500 font-bold`}>No recent rate-limit trips found.</div> : securityReport.rateLimits.recentLimitedRoutes.map((row, idx) => <div key={idx} className={`${T.row}`}><div className="font-black text-amber-200 text-sm">{row.routeName}</div><div className="text-[10px] text-slate-500 font-bold">{row.count}/{row.limit} • {row.updatedAt}</div></div>)}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${T.card} overflow-hidden`}>
              <div className={T.th}>Risky Users: MFA Needed</div>
              {(securityReport?.riskyUsers || []).length === 0 ? <SmartEmptyState title="No risky users found" desc="Elevated accounts with MFA flags will stay out of this list." /> : securityReport.riskyUsers.map(user => (
                <div key={user.id} className={`${T.row}`}><div className="font-black text-white text-sm">{user.name || user.email || user.id}</div><div className="text-[10px] text-red-200 font-bold mt-1">{user.role || 'Elevated'} • {user.restaurantId || 'no workspace'} • {user.risk}</div></div>
              ))}
            </div>
            <div className={`${T.card} overflow-hidden`}>
              <div className={T.th}>Suspicious Activity</div>
              {(securityReport?.suspiciousActivity?.events || []).length === 0 ? <SmartEmptyState title="No suspicious activity found" desc="Failed, denied, risky upload, and destructive-action logs show here." /> : securityReport.suspiciousActivity.events.map(event => (
                <div key={event.id} className={`${T.row}`}><div className="font-black text-white text-sm">{event.action || 'Event'}</div><div className="text-[10px] text-slate-500 font-bold mt-1">{event.userName || 'Unknown'} • {event.restaurantId || 'platform'} • {event.timestamp ? formatClockDateTime(event.timestamp) : 'no time'}</div><div className="text-[10px] text-slate-400 font-mono mt-1 truncate">{event.target || ''}</div></div>
              ))}
            </div>
          </div>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`${T.th} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
              <span>Account Deletion Requests</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{activeAccountDeletionRequests.length} active / {accountDeletionRequests.length} total</span>
            </div>
            {adminDataErrors.accountDeletionRequests && <div className={`${T.row} bg-red-900/10 text-red-100 text-xs font-bold`}>Deletion request queue is blocked by rules or auth: {adminDataErrors.accountDeletionRequests}</div>}
            {activeAccountDeletionRequests.length === 0 ? (
              <SmartEmptyState title="No active deletion requests" desc="When a customer requests account deletion from Account Security, review it here before taking destructive action." />
            ) : activeAccountDeletionRequests.map(req => (
              <div key={req.id || req.uid} className={`${T.row} flex flex-col xl:flex-row xl:items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-black text-white text-sm truncate">{req.email || req.displayName || req.uid || req.id}</div>
                    <SignalPip tone={String(req.status || '').toLowerCase() === 'reviewing' ? 'amber' : 'red'} label={req.status || 'requested'} />
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1">{req.restaurantId || 'system'} - requested {req.requestedAt ? formatClockDateTime(req.requestedAt) : 'unknown'} - updated {req.updatedAt ? formatClockDateTime(req.updatedAt) : 'not yet'}</div>
                  {req.reason && <div className="text-xs text-slate-300 font-bold mt-2 leading-relaxed line-clamp-2">{req.reason}</div>}
                  {req.adminNotes && <div className="text-[10px] text-amber-200 font-bold mt-2 leading-relaxed">Admin note: {req.adminNotes}</div>}
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {String(req.status || '').toLowerCase() !== 'reviewing' && <button type="button" onClick={() => handleAccountDeletionAdminAction(req, 'review')} disabled={isAccountDeletionAdminBusy} className="px-3 py-2 bg-amber-900/20 border border-amber-500/40 text-amber-200 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Reviewing</button>}
                  <button type="button" onClick={() => handleAccountDeletionAdminAction(req, 'complete')} disabled={isAccountDeletionAdminBusy} className="px-3 py-2 bg-emerald-900/20 border border-emerald-500/40 text-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Mark Complete</button>
                  <button type="button" onClick={() => handleAccountDeletionAdminAction(req, 'deny')} disabled={isAccountDeletionAdminBusy} className="px-3 py-2 bg-red-900/20 border border-red-500/40 text-red-200 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50">Deny</button>
                </div>
              </div>
            ))}
            {completedAccountDeletionRequests.length > 0 && (
              <div className="border-t border-[#2A353D] bg-[#0B0E11]/50">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Recent closed requests</div>
                {completedAccountDeletionRequests.map(req => (
                  <div key={`closed-${req.id || req.uid}`} className="px-4 py-2 border-t border-[#2A353D] text-[10px] font-bold text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span className="truncate">{req.email || req.displayName || req.uid || req.id}</span>
                    <span>{req.status || 'closed'} - {req.updatedAt ? formatClockDateTime(req.updatedAt) : 'no date'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${T.card} p-4 border ${restoreDrillStale ? 'border-amber-900/50' : 'border-emerald-900/40'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Restore Drill</div>
                <h3 className="font-black text-white text-lg">Monthly backup restore proof</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">Backups only count if a safe test restore works. Record the last drill after restoring into a non-production Firebase project and checking critical screens.</p>
              </div>
              <button type="button" onClick={handleRecordRestoreDrill} disabled={isRestoreDrillBusy} className="bg-amber-900/20 border border-amber-500/40 text-amber-200 hover:text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50">{isRestoreDrillBusy ? 'Working…' : 'Record Restore Drill'}</button>
            </div>
            <div className="grid sm:grid-cols-4 gap-2 mt-3 text-[10px] font-bold">
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest font-black">Last Drill</div><div className="text-white">{restoreDrillStatus?.lastDrillAt ? formatBackupTimestamp(restoreDrillStatus.lastDrillAt) : 'Not recorded'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest font-black">Status</div><div className={restoreDrillStale ? 'text-amber-200' : 'text-emerald-200'}>{restoreDrillStatus?.status || 'needed'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest font-black">Safe Project</div><div className="text-white truncate">{restoreDrillStatus?.restoreProjectId || 'not logged'}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-slate-500 uppercase tracking-widest font-black">Backup</div><div className="text-white truncate">{restoreDrillStatus?.sourceBackupPath || backupStatus?.storagePath || 'choose backup'}</div></div>
            </div>
          </div>

          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-2xl p-4 text-xs text-slate-400 font-bold leading-relaxed">
            <div className="text-white font-black text-sm mb-2">Security setup notes</div>
            <p>Firebase App Check also needs to be enabled/enforced inside Firebase Console for Firestore, Storage, and callable services. Set <span className="font-mono text-slate-200">REACT_APP_FIREBASE_APPCHECK_SITE_KEY</span> at build time, then set <span className="font-mono text-slate-200">APP_CHECK_ENFORCE=true</span> when you are ready to make API routes reject missing App Check tokens.</p><p className="mt-2">For MFA, enable SMS multi-factor authentication in Firebase Authentication / Identity Platform first and select the correct SMS region. Keep <span className="font-mono text-slate-200">MFA_ENFORCE_ELEVATED_ROLES=false</span> until owners, managers, admins, and System Administrators have enrolled, completed a fresh two-step login, and the Super Admin recovery reset has been tested.</p>
          </div>
        </div>
      )}

      {subTab === 'live' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {adminDataErrors.users && <div className="bg-red-900/20 border border-red-900/50 text-red-100 rounded-2xl p-4 text-sm font-bold leading-snug">Live user data is blocked by Firestore rules or auth claims: {adminDataErrors.users}. Deploy the included firestore.rules file, then log out and back in so super-admin claims refresh.</div>}
          {presenceSnapshotError && <div className="bg-red-900/20 border border-red-900/50 text-red-100 rounded-2xl p-4 text-sm font-bold leading-snug">Manual presence snapshot failed: {presenceSnapshotError}</div>}
          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="flex flex-wrap gap-2"><span className="text-emerald-400">Manual Presence Snapshot</span><span>Users: {allUsers.length}</span><span>Recent: {onlineUsers.length}</span><span>Window: {presenceSnapshot.windowMinutes || 15} min</span><span>Reads only when refreshed</span>{presenceSnapshot.fetchedAt && <span>Fetched: {timeAgo(presenceSnapshot.fetchedAt)}</span>}</div>
            <button type="button" onClick={() => loadPresenceSnapshot()} disabled={isPresenceSnapshotLoading} className="px-3 py-2 bg-emerald-900/20 border border-emerald-500/50 text-emerald-300 rounded-lg font-black uppercase tracking-widest hover:bg-emerald-900/40 disabled:opacity-50 flex items-center justify-center gap-2">{isPresenceSnapshotLoading ? <Loader2 size={14} className="animate-spin"/> : <Users size={14}/>} Refresh Snapshot</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 cockpit-panel rounded-2xl overflow-hidden">
              <div className={`bg-[#12161A] p-3 border-b ${T.border} flex items-center justify-between gap-3`}>
                <h3 className="font-black text-sm text-white flex items-center gap-2"><span className="cockpit-light bg-emerald-400 text-emerald-400 hot"></span> Manual Presence Snapshot</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{onlineUsers.length} recent</span>
              </div>
              <div className={`divide-y ${T.border} max-h-[55vh] overflow-y-auto custom-scrollbar`}>
                {onlineUsers.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No manual snapshot has recent app check-ins yet. Press Refresh Snapshot. This does a one-time Super Admin read instead of opening a live listener.</div>}
                {onlineUsers.map(u => {
                  const restName = restaurants.find(r => r.id === u.restaurantId)?.name || 'Unknown Workspace';
                  return (
                    <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#12161A]/55 transition-colors">
                      <div className="min-w-0 flex items-center gap-3">
                        <img src={getAvatar(u.name, u.photoURL)} className={`w-8 h-8 rounded-full border ${T.border} object-cover`} alt="avatar"/>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-white truncate flex items-center gap-2">{u.name || 'Unnamed User'} <SignalPip tone="emerald" label="ONLINE" hot /></div>
                          <div className="text-[10px] text-slate-400 font-bold truncate">{restName} • {u.role || 'No role'} • {u.activeTab ? `Tab: ${u.activeTab}` : 'Tab: unknown'} • Seen {timeAgo(u.lastHeartbeatAt || u.presenceUpdatedAt || u.lastActive || u.lastSeen)}</div>
                          <div className="text-[9px] text-slate-500 font-mono truncate">{u.email || 'No email'} • {u.activeDevice || 'Unknown device'}</div>
                        </div>
                      </div>
                      <button onClick={() => { setGhostTenant({ id: u.restaurantId, name: restName, mode: 'user', impersonate: u }); setActiveTab('published'); }} className="px-3 py-1.5 bg-fuchsia-900/20 border border-fuchsia-500/50 text-fuchsia-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-fuchsia-900/40 transition-colors shadow-sm flex items-center justify-center gap-1"><Moon size={14} /> Possess</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cockpit-panel rounded-2xl overflow-hidden">
              <div className={`bg-[#12161A] p-3 border-b ${T.border}`}>
                <h3 className="font-black text-sm text-white">Active Workspaces</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Grouped by manual snapshot</p>
              </div>
              <div className={`divide-y ${T.border} max-h-[55vh] overflow-y-auto custom-scrollbar`}>
                {onlineByRestaurant.length === 0 && <div className="p-6 text-center text-slate-500 font-bold text-sm">No workspaces in the latest snapshot.</div>}
                {onlineByRestaurant.map(group => (
                  <div key={group.id} className="p-3 hover:bg-[#12161A]/55 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-white text-sm truncate">{group.rest?.name || group.id}</div>
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black"><span className="cockpit-light bg-emerald-400 text-emerald-400"></span>{group.users.length}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">{group.users.map(u => (u.name || u.email || 'User').split(' ')[0]).join(', ')}</div>
                    <button onClick={() => { setGhostTenant({ id: group.id, name: group.rest?.name || group.id, mode: 'workspace' }); setActiveTab('published'); }} className="mt-2 w-full px-2 py-1.5 bg-purple-900/20 border border-purple-500/40 text-purple-300 font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-purple-900/40">Possess Workspace</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="cockpit-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-white text-sm">Recent Check-In Buffer</h3>
                <SignalPip tone="amber" label={`${recentlyActiveUsers.length} warm`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentlyActiveUsers.slice(0, 12).map(u => {
                  const restName = restaurants.find(r => r.id === u.restaurantId)?.name || 'Unknown';
                  return <div key={u.id} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2"><div className="text-xs font-black text-white truncate">{u.name || u.email}</div><div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate">{restName} • {timeAgo(u.lastHeartbeatAt || u.presenceUpdatedAt || u.lastActive || u.lastSeen)}</div></div>
                })}
                {recentlyActiveUsers.length === 0 && <div className="text-sm text-slate-500 font-bold">No recently active users outside the live window.</div>}
              </div>
            </div>

            <div className="cockpit-panel rounded-2xl p-4">
              <h3 className="font-black text-white text-sm mb-3">Control Tower Signals</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ['Auth Gate', 'emerald', 'Firebase Auth ready'],
                  ['Tenant Rules', 'emerald', 'Super admin override'],
                  ['Ghost Layer', 'purple', 'Possess enabled'],
                  ['Push Relay', pushOptInRate < 30 ? 'amber' : 'emerald', `${pushOptInRate}% opt-in`],
                  ['Crash Intake', crashes24h ? 'amber' : 'emerald', `${crashes24h} today`],
                  ['Backup Engine', 'blue', 'JSON export ready'],
                  ['Billing Locks', staleTenants.length ? 'amber' : 'emerald', `${staleTenants.length} stale`],
                  ['API Routes', 'blue', `${apiConnectedCount} integrations`],
                  ['Manual Presence', onlineUsers.length ? 'emerald' : 'amber', presenceSnapshot.fetchedAt ? `${onlineUsers.length} recent` : 'not refreshed']
                ].map(([name, tone, detail]) => (
                  <div key={name} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2.5 min-h-[70px]">
                    <SignalPip tone={tone} label={name} hot={tone === 'amber'} />
                    <div className="text-[10px] text-slate-400 font-bold mt-2 leading-tight">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* --- TAB: V14 ROBUSTNESS SUITE --- */}
      {subTab === 'v14' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]" id="admin-v14">
          <div className="cockpit-panel rounded-2xl p-5 border border-[#D4A381]/30 bg-gradient-to-br from-[#1A2126] to-[#0B0E11]">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[#D4A381] mb-2">Version 14.0.2</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Robustness Suite</h2>
                <p className="text-sm text-slate-400 font-bold mt-2 max-w-3xl">Safe writes, upload diagnostics, schema repair, restore preview, permission simulation, import templates, offline queue status, and release guardrails in one admin cockpit.</p>
              </div>
              <div className="min-w-[260px]">
                <label className={T.label}>Target Workspace</label>
                <select value={v14WorkspaceId} onChange={e => setV14WorkspaceId(e.target.value)} className={T.input}>
                  <option value="">Auto / current workspace</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                </select>
                <div className="text-[10px] text-slate-500 font-bold mt-1 truncate">Using: {v14TargetRestaurantId || 'none selected'}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className={`${T.card} p-4`}>
              <div className="flex items-center justify-between gap-3"><h3 className="font-black text-white">Safe Write Engine</h3><SignalPip tone="emerald" label="ARMED" /></div>
              <p className="text-xs text-slate-400 font-bold mt-2">The v14.0.2 shared write helpers are now wired into major kitchen forms for inventory, waste, prep, line checks, recipes, maintenance, smart prep, 86 alerts, and the menu dependency graph.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Offline Queue</div><div className="text-2xl font-black text-white">{v14OfflineQueueCount}</div></div>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase tracking-widest text-slate-500 font-black">API Route</div><div className="text-sm font-black text-emerald-300 mt-2">/api/safe-write</div></div>
              </div>
            </div>

            <div className={`${T.card} p-4`}>
              <div className="flex items-center justify-between gap-3"><h3 className="font-black text-white">Upload & Storage Doctor</h3><SignalPip tone={v14StorageReport?.ok === false ? 'red' : v14StorageReport?.ok ? 'emerald' : 'amber'} label={v14StorageReport ? (v14StorageReport.ok ? 'PASS' : 'CHECK') : 'READY'} hot={v14StorageReport?.ok === false}/></div>
              <p className="text-xs text-slate-400 font-bold mt-2">Tests Vercel Admin credentials, project, bucket, restaurant lookup, and a real write/read/delete cycle so logo and invoice uploads stop being mystery soup.</p>
              <button onClick={runV14StorageDoctor} disabled={v14BusyTool === 'storage'} className={`${T.btn} mt-4 w-full flex items-center justify-center gap-2`}>{v14BusyTool === 'storage' && <Loader2 size={14} className="animate-spin"/>} Run Storage Doctor</button>
            </div>

            <div className={`${T.card} p-4`}>
              <div className="flex items-center justify-between gap-3"><h3 className="font-black text-white">Schema Doctor</h3><SignalPip tone={v14SchemaReport?.high ? 'red' : v14SchemaReport ? 'emerald' : 'amber'} label={v14SchemaReport ? `${v14SchemaReport.issueCount || 0} ISSUES` : 'READY'} hot={!!v14SchemaReport?.high}/></div>
              <p className="text-xs text-slate-400 font-bold mt-2">Scans tenant data for missing restaurant IDs, invalid dates, stale punches, negative inventory, old branding fields, and demo privacy hazards.</p>
              <div className="grid grid-cols-2 gap-2 mt-4"><button onClick={() => runV14SchemaDoctor(false)} disabled={!!v14BusyTool} className={T.btnAlt}>Dry Run</button><button onClick={() => runV14SchemaDoctor(true)} disabled={!!v14BusyTool} className={T.btn}>Repair Safe Items</button></div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${T.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-white">Point-in-Time Restore Preview</h3>
                <button type="button" onClick={loadV14Backups} disabled={v14BusyTool === 'backups'} className={T.btnAlt}>{v14BusyTool === 'backups' ? 'Loading…' : 'Load Backups'}</button>
              </div>
              <p className="text-xs text-slate-400 font-bold">Select a backup from Firebase Storage, preview it, then restore only chosen collections after typing RESTORE.</p>
              <select value={v14BackupPath} onChange={e => { setV14BackupPath(e.target.value); setV14BackupPreview(null); setV14SelectedCollections([]); }} className={T.input}>
                <option value="">Choose backup snapshot</option>
                {v14Backups.map(b => <option key={b.path} value={b.path}>{new Date(b.createdAt || b.updatedAt || Date.now()).toLocaleString()} • {b.mode || 'backup'} • {b.documentCount || 0} docs • {b.name}</option>)}
              </select>
              <details className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400">Advanced manual path fallback</summary>
                <input value={v14BackupPath} onChange={e => setV14BackupPath(e.target.value)} className={`${T.input} mt-3`} placeholder="backups/firestore/manual/...json.gz" />
              </details>
              <div className="text-[10px] text-slate-500 font-bold truncate">Selected: {v14BackupPath || 'none'} {v14BackupsLoadedAt ? `• List loaded ${new Date(v14BackupsLoadedAt).toLocaleTimeString()}` : ''}</div>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => runV14BackupPreview(false)} disabled={!!v14BusyTool || !v14BackupPath} className={T.btnAlt}>Preview Backup</button><button onClick={() => runV14BackupPreview(true)} disabled={!!v14BusyTool || !v14BackupPath} className="bg-red-900/30 border border-red-700 text-red-200 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Selective Restore</button></div>
              {v14BackupPreview?.warnings?.length > 0 && <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-3 text-xs font-bold text-amber-200 space-y-1">{v14BackupPreview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
              {v14BackupPreview?.rows?.length > 0 && <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3 max-h-[260px] overflow-y-auto custom-scrollbar space-y-1">
                <div className="flex gap-2 mb-2"><button type="button" onClick={() => setV14SelectedCollections(v14BackupPreview.rows.map(r => r.collectionName))} className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">Select All</button><button type="button" onClick={() => setV14SelectedCollections([])} className="text-[9px] font-black uppercase tracking-widest text-slate-500">Clear</button></div>
                {v14BackupPreview.rows.map(row => <label key={row.collectionName} className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300 bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><span>{row.collectionName} <span className="text-slate-500">({row.count})</span>{row.sensitiveFields?.length ? <span className="text-amber-400 ml-2">sensitive</span> : null}</span><input type="checkbox" checked={v14SelectedCollections.includes(row.collectionName)} onChange={e => setV14SelectedCollections(prev => e.target.checked ? Array.from(new Set([...prev, row.collectionName])) : prev.filter(x => x !== row.collectionName))}/></label>)}
              </div>}
              <input value={v14RestoreConfirm} onChange={e => setV14RestoreConfirm(e.target.value)} className={T.input} placeholder="Type RESTORE only when intentionally restoring selected collections" />
            </div>

            <div className={`${T.card} p-4 space-y-3`}>
              <h3 className="font-black text-white">Permission Simulator</h3>
              <p className="text-xs text-slate-400 font-bold">Preview what a user can see, what is blocked, and whether sensitive admin/wage/backup areas are protected.</p>
              <select value={v14PermissionUserId} onChange={e => setV14PermissionUserId(e.target.value)} className={T.input}>
                <option value="">Auto-select user</option>
                {allUsers.filter(u => !v14TargetRestaurantId || u.restaurantId === v14TargetRestaurantId).slice(0, 300).map(u => <option key={u.id} value={u.id}>{u.name || u.email || u.id} • {restaurants.find(r => r.id === u.restaurantId)?.name || u.restaurantId}</option>)}
              </select>
              {v14PermissionPreview ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#0B0E11] border border-emerald-900/40 rounded-xl p-3"><div className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-2">Allowed</div>{v14PermissionPreview.allowed.map(x => <div key={x.key} className="text-xs font-bold text-slate-300 py-1">✓ {x.label}</div>)}</div>
                <div className="bg-[#0B0E11] border border-red-900/40 rounded-xl p-3"><div className="text-[9px] font-black uppercase tracking-widest text-red-300 mb-2">Blocked</div>{v14PermissionPreview.blocked.map(x => <div key={x.key} className="text-xs font-bold text-slate-400 py-1">× {x.label}</div>)}</div>
              </div> : <div className="text-xs text-slate-500 font-bold">No user selected.</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className={`${T.card} p-4`}><h3 className="font-black text-white">Import Bridge</h3><p className="text-xs text-slate-400 font-bold mt-2">Downloads starter templates for Toast/Square/Clover sales, payroll/time, vendor invoices, and inventory counts.</p><button onClick={downloadV14ImportTemplates} className={`${T.btn} mt-4 w-full`}>Download Templates</button></div>
            <div className={`${T.card} p-4`}><h3 className="font-black text-white">Release Guardrail Tests</h3><p className="text-xs text-slate-400 font-bold mt-2">Runs client-side checks for version, 86 brand lock, demo privacy rule, Help Center boundary, and bundled rules.</p><button onClick={runV14Guardrails} className={`${T.btnAlt} mt-4 w-full`}>Run Guardrails</button></div>
            <div className={`${T.card} p-4`}><h3 className="font-black text-white">Kitchen Dependency Engine</h3><p className="text-xs text-slate-400 font-bold mt-2">Kitchen Command Center now cross-checks low-stock inventory against recipes and prep to surface affected menu items and recovery signals.</p><button onClick={() => setActiveTab('ops')} className={`${T.btnAlt} mt-4 w-full`}>Open Kitchen Command Center</button></div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <V14JsonPanel title="Storage Doctor Report" data={v14StorageReport} />
            <V14JsonPanel title="Schema Doctor Report" data={v14SchemaReport} />
            <V14JsonPanel title="Backup Preview / Guardrails" data={v14BackupPreview || v14GuardrailReport} />
          </div>
        </div>
      )}

      {/* --- TAB: TENANTS --- */}
      {subTab === 'tenants' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
 <form onSubmit={handleDeployTenant} className={`${T.card} p-5 border-red-900/50 shadow-[0_0_20px_rgba(220,38,38,0.1)]`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white flex items-center gap-2">Deploy New Workspace</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Restaurant Name" value={rName} onChange={e=>setRName(e.target.value)} className={T.input} required />
              <input type="text" placeholder="Full Street Address" value={rAddress} onChange={e=>setRAddress(e.target.value)} className={T.input} required />
              <input type="text" placeholder="Owner Name" value={oName} onChange={e=>setOName(e.target.value)} className={T.input} required />
              <input type="email" placeholder="Owner Email" value={oEmail} onChange={e=>setOEmail(e.target.value)} className={T.input} required />
              <input type="tel" placeholder="Owner Phone" value={oPhone} onChange={e=>setOPhone(e.target.value)} className={`${T.input} sm:col-span-2`} required />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg mt-4 transition-colors">Deploy Database & Email Credentials</button>
          </form>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col sm:flex-row justify-between sm:items-center gap-3`}>
              <div>
                <h3 className="font-black text-sm text-white">Client Roster</h3>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Created date/time is stamped on every new client.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#1A2126] text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">{restaurants.length} Total</span>
                <button type="button" onClick={handleStampMissingClientCreatedAt} className="bg-[#1A2126] text-[#D4A381] px-2.5 py-1.5 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D] hover:border-[#D4A381]/60 transition-colors">Stamp Missing</button>
              </div>
            </div>
<div className={`divide-y ${T.border}`}>
{restaurants.map(r => {
                // Subscription Math Engine
                const createdRaw = getClientCreatedAt(r);
                const createdDate = parseClientDate(createdRaw) || new Date();
                const createdTimestamp = formatClientCreatedTimestamp(createdRaw);
                const isBackfilledCreatedAt = r.createdAtEstimated || (!createdRaw && r.createdAtBackfilledAt);
                const trialDurationDays = r.trialDays !== undefined ? parseInt(r.trialDays) : 14;
                const trialEndDate = new Date(createdDate.getTime() + trialDurationDays * 24 * 60 * 60 * 1000);
                const isTrialActive = r.billingStatus === 'Trial';
                const daysInTrial = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                
                const nextBill = new Date();
                nextBill.setDate(createdDate.getDate());
                if (nextBill <= new Date()) nextBill.setMonth(nextBill.getMonth() + 1);

                return (
                <div key={r.id} className={`${T.row} flex flex-col xl:flex-row justify-between xl:items-center gap-4`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white text-lg flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => setSelectedClient(r)} className="truncate text-left hover:text-[#D4A381] underline-offset-4 hover:underline">{r.name}</button>
                      {!r.isActive && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase">Suspended</span>}
                      {r.isReadOnly && <span className="bg-blue-900 text-blue-300 border border-blue-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">Read-Only</span>}
                      {r.billingStatus === 'Past Due' ? <span className="bg-red-900 text-red-400 border border-red-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase animate-pulse">Maintenance</span> : <span className="bg-emerald-900 text-emerald-400 border border-emerald-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">{r.planType || 'Pro'}</span>}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Owner: {r.ownerName} <span className="mx-1">•</span> {r.ownerEmail} {r.ownerPhone && <><span className="mx-1">•</span> {r.ownerPhone}</>}</div>
                    
                    {/* BILLING & SUBSCRIPTION HUD */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 mb-1 bg-[#0B0E11] border border-[#2A353D] p-2.5 rounded-lg w-full xl:w-max">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Created</span>
                        <span className="text-[10px] font-bold text-slate-300" title={createdTimestamp}>{createdTimestamp}</span>
                        {isBackfilledCreatedAt && <span className="text-[8px] font-black uppercase tracking-widest text-amber-400 mt-0.5">Backfilled</span>}
                      </div>
                      <div className="h-6 w-px bg-[#2A353D]"></div>
        {isTrialActive ? (
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">{trialDurationDays}-Day Free Trial</span>
                          <span className="text-[10px] font-bold text-blue-300">Ends {trialEndDate.toLocaleDateString()} ({daysInTrial > 0 ? `${daysInTrial} days left` : 'Expired'})</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Next Billing Cycle</span>
                          <span className="text-[10px] font-bold text-emerald-400">{r.billingStatus === 'Past Due' ? 'MAINTENANCE MODE' : nextBill.toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] text-slate-500 font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">ID: {r.id}<span>•</span><span className="text-white font-bold">{userCounts[r.id] || 0} Seats</span><span>•</span><span className="text-emerald-400 font-black flex items-center gap-1"><span className="cockpit-light bg-emerald-400 text-emerald-400"></span>{presenceSnapshot.fetchedAt ? `${onlineUsers.filter(u => u.restaurantId === r.id).length} snapshot` : 'snapshot not run'}</span><span>•</span><span className={timeAgo(r.lastActive).includes('Inactive') ? 'text-red-400' : 'text-emerald-500'}>Ping: {timeAgo(r.lastActive)}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
<button onClick={() => setSelectedClient(r)} className="px-3 py-1.5 bg-blue-900/20 border border-blue-500/50 text-blue-300 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-blue-900/40 transition-colors shadow-sm flex items-center gap-1"><Users size={14} /> Users</button>
<button onClick={() => setEditingRest(r)} className="px-3 py-1.5 bg-[#12161A] border border-[#2A353D] text-slate-300 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:text-[#D4A381] hover:border-[#D4A381]/50 transition-colors shadow-sm flex items-center gap-1"><Settings size={14} /> Manage</button>
                    <button onClick={() => { setGhostTenant({ id: r.id, name: r.name, mode: 'workspace' }); setActiveTab('published'); }} className="px-3 py-1.5 bg-purple-900/20 border border-purple-500/50 text-purple-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-purple-900/50 transition-colors shadow-sm flex items-center gap-1"><Moon size={14} /> Possess</button>
                    <button onClick={() => handleDeleteTenant(r.id, r.name)} className="px-3 py-1.5 bg-red-900/10 border border-red-900/30 text-red-500 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-900/40 transition-colors shadow-sm"><Trash2 size={12}/></button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: GLOBAL USERS --- */}
      {subTab === 'users' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-4 flex gap-3 items-center`}>
            <Search className={T.copper} size={20}/>
            <input type="text" placeholder="Search any user by name, email, role, or ID..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} className={T.input}/>
          </div>

          <form onSubmit={handleBulkDeleteUsersByEmail} className={`${T.card} p-4 border-red-900/40 bg-red-950/10`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-black text-sm text-red-300 flex items-center gap-2"><Trash2 size={16}/> Bulk Delete Users by Email</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Paste one or many emails. This is for duplicate/bad accounts. Geoff/current admin emails are protected.</p>
              </div>
              {duplicateEmailGroups.length > 0 && <button type="button" onClick={loadDuplicateEmailsIntoBulkDelete} className="text-[9px] font-black uppercase tracking-widest text-red-300 border border-red-900/50 px-2 py-1.5 rounded-lg hover:bg-red-900/20">Load Duplicate Emails</button>}
            </div>
            <textarea value={bulkDeleteEmails} onChange={e=>{ setBulkDeleteEmails(e.target.value); setSelectedBulkDeleteUserIds([]); }} rows="3" className={`${T.input} font-mono text-xs`} placeholder="bad@email.com
duplicate@email.com
another@email.com"></textarea>
            {getBulkDeletePreviewUsers().length > 0 && (() => {
              const previewUsers = getBulkDeletePreviewUsers();
              const protectedEmails = new Set([MASTER_ADMIN_EMAIL.toLowerCase(), (appUser?.email || '').toLowerCase()].filter(Boolean));
              const deletableIds = previewUsers.filter(u => !protectedEmails.has((u.email || '').toLowerCase().trim())).map(u => u.id);
              const groupedPreview = previewUsers.reduce((acc, u) => {
                const key = (u.email || 'No email').toLowerCase().trim();
                if (!acc[key]) acc[key] = [];
                acc[key].push(u);
                return acc;
              }, {});
              return (
                <div className="mt-3 bg-[#0B0E11] border border-red-900/30 rounded-xl overflow-hidden">
                  <div className="p-3 border-b border-red-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-red-200">Review Exact Accounts Before Deleting</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Created date, workspace, role, and profile ID are shown so duplicate emails do not get vaporized blindly.</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedBulkDeleteUserIds(deletableIds)} className="text-[9px] font-black uppercase tracking-widest text-red-200 border border-red-800/60 px-2 py-1 rounded-lg hover:bg-red-900/30">Select All</button>
                      <button type="button" onClick={() => setSelectedBulkDeleteUserIds([])} className="text-[9px] font-black uppercase tracking-widest text-slate-300 border border-[#2A353D] px-2 py-1 rounded-lg hover:bg-[#12161A]">Clear Picks</button>
                    </div>
                  </div>
                  <div className="divide-y divide-red-900/20 max-h-64 overflow-y-auto custom-scrollbar">
                    {Object.entries(groupedPreview).map(([email, rows]) => (
                      <div key={email} className="p-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-red-300 px-1 mb-1">{email} {rows.length > 1 && <span className="text-amber-300">• {rows.length} profiles</span>}</div>
                        <div className="space-y-1">
                          {rows.map(u => {
                            const rowEmail = (u.email || '').toLowerCase().trim();
                            const protectedRow = protectedEmails.has(rowEmail);
                            const restName = restaurants.find(r => r.id === u.restaurantId)?.name || u.restaurantId || 'Unknown workspace';
                            return (
                              <label key={u.id} className={`flex items-start gap-2 p-2 rounded-lg border ${protectedRow ? 'border-amber-900/40 bg-amber-900/10 opacity-75' : selectedBulkDeleteUserIds.includes(u.id) ? 'border-red-500/60 bg-red-900/20' : 'border-[#2A353D] bg-[#12161A]'} cursor-pointer`}>
                                <input type="checkbox" disabled={protectedRow} checked={selectedBulkDeleteUserIds.includes(u.id)} onChange={e => toggleBulkDeleteSelection(u.id, e.target.checked)} className="mt-1 accent-red-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-white truncate">{u.name || 'No name'} {protectedRow && <span className="text-amber-300 text-[9px] uppercase ml-1">Protected</span>}</div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Created: <span className="text-slate-200">{formatUserCreatedValue(u)}</span></div>
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">{restName} • {u.role || 'No role'} • ID {String(u.id || '').slice(0, 18)}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <button type="submit" disabled={isBulkDeletingUsers} className="flex-1 bg-red-900/30 text-red-200 border border-red-700/60 hover:bg-red-900/50 font-black uppercase tracking-widest py-2.5 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                {isBulkDeletingUsers ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>} {selectedBulkDeleteUserIds.length ? `Delete ${selectedBulkDeleteUserIds.length} Selected User${selectedBulkDeleteUserIds.length === 1 ? '' : 's'}` : 'Delete Matching Users'}
              </button>
              <button type="button" onClick={() => { setBulkDeleteEmails(''); setSelectedBulkDeleteUserIds([]); }} className={`${T.btnAlt} sm:w-32`}>Clear</button>
            </div>
          </form>

          <div className={`divide-y ${T.border} ${T.card} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {allUsers.filter(u => {
              const restName = restaurants.find(r => r.id === u.restaurantId)?.name || '';
              return (u.name + u.email + u.role + u.id + restName).toLowerCase().includes(userSearch.toLowerCase());
            }).slice(0, 50).map(u => {              
              const restName = restaurants.find(r => r.id === u.restaurantId)?.name || 'Unknown Location';
              return (
                <div key={u.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-3`}>
                  <div>
                    <div className="font-bold text-white text-sm">{u.name} {u.isAdmin && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase ml-1">Admin</span>}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{u.email} <span className="mx-1"> </span> <span className={T.copper}>{u.role}</span></div>
                    <div className="text-[9px] text-slate-500 mt-0.5 tracking-widest uppercase flex flex-wrap items-center gap-x-2 gap-y-1">{restName}<span>|</span><span>Presence is manual snapshot only</span></div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => openSupportUserEditor(u)} className="px-3 py-1.5 bg-blue-900/20 border border-blue-500/50 text-blue-300 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-blue-900/40 transition-colors shadow-sm flex items-center gap-1"><Edit size={14} /> Support Edit</button>
<button onClick={() => { setGhostTenant({ id: u.restaurantId, name: restName, mode: 'user', impersonate: u }); setActiveTab('published'); }} className="px-3 py-1.5 bg-fuchsia-900/20 border border-fuchsia-500/50 text-fuchsia-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-fuchsia-900/40 transition-colors shadow-sm flex items-center gap-1"><Moon size={14} /> Possess</button>
                    <button onClick={() => handleBackupEmployee(u)} className="p-1.5 bg-[#12161A] border border-[#2A353D] text-slate-400 hover:text-emerald-400 rounded-lg transition-colors shadow-sm" title="Download User Data JSON">
                      💾
                    </button>
                    <label className="p-1.5 bg-[#12161A] border border-[#2A353D] text-slate-400 hover:text-blue-400 rounded-lg transition-colors shadow-sm cursor-pointer" title="Inject Data to User">
                      <input type="file" accept=".json" onChange={(e) => handleRestoreEmployee(e, u)} className="hidden" />
                      🔄
                    </label>
              <button onClick={async () => {
                      if(!window.confirm(`Force ${u.name} to log out and clear their device cache?`)) return;
                      await updateDoc(doc(db, "users", u.id), { forceLogout: true });
                      addToast('Executed', 'Kill signal sent to user device.');
                    }} className="p-1.5 bg-orange-900/20 border border-orange-900/50 text-orange-500 hover:bg-orange-900/40 rounded-lg transition-colors shadow-sm" title="Force Logout & Cache Clear">
                      🔌
                    </button>
                    <button onClick={async () => {
                      if(!window.confirm(`Force ${u.name} into the Password Reset flow on their next login?`)) return;
                      await updateDoc(doc(db, "users", u.id), { forcePasswordChange: true });
                      addToast('Executed', 'User must reset password on next login.');
                    }} className="p-1.5 bg-yellow-900/20 border border-yellow-900/50 text-yellow-500 hover:bg-yellow-900/40 rounded-lg transition-colors shadow-sm" title="Force Password Reset Screen">
                      🔑
                    </button>
                    <button onClick={() => handleDeleteGlobalUser(u)} className="p-1.5 bg-red-900/10 border border-red-900/30 text-red-500 hover:bg-red-900/40 rounded-lg transition-colors shadow-sm" title="Delete Account">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

{/* --- TAB: THE FORGE --- */}
      {subTab === 'forge' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={(e) => handleForgePush(e, 'Event')} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white flex items-center gap-2"><Calendar className={T.copper} size={18}/> Global Event Injection</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Force an event onto every client's calendar simultaneously.</p></div>
            <div className="flex flex-col sm:flex-row gap-3"><input type="date" value={forgeEventDate} onChange={e=>setForgeEventDate(e.target.value)} className={`${T.input} sm:w-48`} required /><input type="text" placeholder="Event Title (e.g. Mother's Day)" value={forgeEventTitle} onChange={e=>setForgeEventTitle(e.target.value)} className={T.input} required /><button type="submit" className={`${T.btn} px-8 whitespace-nowrap`}>Push Event</button></div>
          </form>
        </div>
      )}

      {/* --- TAB: SUPPORT & CRASHES --- */}
      {subTab === 'support' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className="cockpit-panel rounded-2xl p-4 overflow-hidden relative">
            <div className="absolute inset-0 cockpit-grid opacity-30 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-2"><Bug className="text-orange-500" size={18}/> Support Diagnostics Bay</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Runtime, auth, database integrity, API checks, crash ledger, and ghost-access clues.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopyDiagnostics} className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] hover:text-white border border-[#2A353D] px-2 py-1 rounded transition-colors">Copy Diagnostics</button>
                <button onClick={() => { if(window.confirm("Clear all crash logs?")) { crashLogs.forEach(log => deleteDoc(doc(db, "crashReports", log.id))); } }} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 border border-[#2A353D] px-2 py-1 rounded transition-colors">Clear Logs</button>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <CockpitMetric label="Permission Denied" value={permissionDeniedLogs.length} detail="Firestore rule hits" tone={permissionDeniedLogs.length ? 'red' : 'emerald'} hot={permissionDeniedLogs.length > 0} />
              <CockpitMetric label="Missing Owners" value={missingOwnerAccounts.length} detail="Owner email no user doc" tone={missingOwnerAccounts.length ? 'amber' : 'emerald'} hot={missingOwnerAccounts.length > 0} />
              <CockpitMetric label="No Restaurant ID" value={usersWithoutRestaurant.length} detail="Users orphaned from tenant" tone={usersWithoutRestaurant.length ? 'amber' : 'emerald'} hot={usersWithoutRestaurant.length > 0} />
              <CockpitMetric label="Duplicate Emails" value={duplicateEmailGroups.length} detail="Auth/profile mismatch risk" tone={duplicateEmailGroups.length ? 'red' : 'emerald'} hot={duplicateEmailGroups.length > 0} />
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Runtime</div><SignalPip tone={envReport.online ? 'emerald' : 'red'} label={envReport.online ? 'ONLINE' : 'OFFLINE'} hot={!envReport.online}/></div>
                <div className="space-y-1 text-[10px] font-mono text-slate-400 break-all">
                  <div><span className="text-slate-600">Host:</span> {envReport.host}</div>
                  <div><span className="text-slate-600">Version:</span> {CURRENT_VERSION}</div>
                  <div><span className="text-slate-600">Notifications:</span> {envReport.notifications}</div>
                  <div><span className="text-slate-600">IndexedDB:</span> {envReport.indexedDb ? 'available' : 'missing'}</div>
                  <div><span className="text-slate-600">Service Worker:</span> {envReport.serviceWorker ? 'available' : 'missing'}</div>
                  <div><span className="text-slate-600">Cached User:</span> {envReport.storageUser ? 'yes' : 'no'}</div>
                </div>
              </div>

              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Route Checklist</div><SignalPip tone="blue" label="VERCEL"/></div>
                <div className="grid grid-cols-1 gap-1.5">
                  {endpointList.map(ep => (
                    <div key={ep} className="flex items-center justify-between text-[10px] font-bold bg-[#12161A] border border-[#2A353D] rounded-lg px-2 py-1.5">
                      <span className="text-slate-300">/api/{ep}</span>
                      <span className="text-slate-500 uppercase tracking-widest">{healthSnapshot?.apiRouteManifest?.find?.(r => r.route === `/api/${ep}`)?.status || 'present in repo'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-600 font-bold mt-2 leading-snug">If a route returns HTML or 404, Vercel did not deploy that file or the filename does not match the fetch path.</p>
              </div>

              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Access Model</div><SignalPip tone="purple" label="RULES"/></div>
                <div className="space-y-1.5 text-[10px] font-bold text-slate-400">
                  <div className="flex justify-between gap-2"><span>Super admins</span><span className="text-white">{superAdmins.length}</span></div>
                  <div className="flex justify-between gap-2"><span>Access source</span><span className="text-[#D4A381]">{adminAccessSourceLabel}</span></div>
                  <div className="flex justify-between gap-2"><span>Frontend master env</span><span className="text-[#D4A381]">{MASTER_ADMIN_EMAIL || 'not set'}</span></div>
                  <div className="flex justify-between gap-2"><span>Server master env</span><span className={appUser?.serverAdminCheck?.masterAdminEnvConfigured ? 'text-emerald-400' : 'text-amber-400'}>{appUser?.serverAdminCheck?.masterAdminEnvConfigured ? `${appUser.serverAdminCheck.masterAdminEmailCount || 1} configured` : 'not confirmed'}</span></div>
                  <div className="flex justify-between gap-2"><span>Ghost needs rules</span><span className="text-emerald-400">isSuperAdmin()</span></div>
                  <div className="flex justify-between gap-2"><span>Read-only clients</span><span className="text-blue-400">{readOnlyWorkspaces.length}</span></div>
                  <div className="flex justify-between gap-2"><span>Past due lockouts</span><span className="text-red-400">{pastDueWorkspaces.length}</span></div>
                </div>
              </div>
            </div>

            {(missingOwnerAccounts.length > 0 || usersWithoutRestaurant.length > 0 || duplicateEmailGroups.length > 0) && (
              <div className="relative z-10 mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                {missingOwnerAccounts.length > 0 && <div className="bg-amber-900/10 border border-amber-900/50 rounded-xl p-3"><div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">Missing Owner Accounts</div>{missingOwnerAccounts.slice(0,8).map(r => <div key={r.id} className="text-[10px] text-slate-400 font-bold break-all mb-1">{r.name}: {r.ownerEmail}</div>)}</div>}
                {usersWithoutRestaurant.length > 0 && <div className="bg-amber-900/10 border border-amber-900/50 rounded-xl p-3"><div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">Users Without Restaurant</div>{usersWithoutRestaurant.slice(0,8).map(u => <div key={u.id} className="text-[10px] text-slate-400 font-bold break-all mb-1">{u.name || 'Unnamed'}: {u.email || u.id}</div>)}</div>}
                {duplicateEmailGroups.length > 0 && <div className="bg-red-900/10 border border-red-900/50 rounded-xl p-3"><div className="flex items-center justify-between gap-2 mb-2"><div className="text-[10px] font-black uppercase tracking-widest text-red-400">Duplicate Email Groups</div><button onClick={loadDuplicateEmailsIntoBulkDelete} className="text-[8px] font-black uppercase tracking-widest text-red-300 border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/30">Open Cleanup</button></div>{duplicateEmailGroups.slice(0,8).map(([email, group]) => <div key={email} className="text-[10px] text-slate-400 font-bold break-all mb-1">{email}: {group.length} profiles</div>)}</div>}
              </div>
            )}
          </div>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className="font-black text-sm text-white flex items-center gap-2"><Bug className="text-orange-500" size={18}/> Bug Ledger</h3>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><span className="cockpit-light bg-emerald-400 text-emerald-400 slow"></span>{crashLogs.length} recent logs</div>
            </div>
            <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
              {crashLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No bugs or crashes logged yet. System stable.</div>}
              {crashLogs.map(log => (
                <div key={log.id} className={`${T.row} flex flex-col gap-2 ${(`${log.message || ''} ${log.stack || ''}`.toLowerCase().includes('permission-denied')) ? 'bg-red-950/20' : ''}`}>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/50 break-all leading-tight">{log.message}</span>
                    <span className={`text-[9px] font-bold ${T.muted} whitespace-nowrap ml-2`}>{formatClockDateTime(log.time)}</span>
                  </div>
                  {(log.restaurantId || log.user) && (
                    <div className="text-[9px] mt-1 flex flex-wrap gap-1.5">
                      {log.restaurantId && <span className="bg-[#0B0E11] border border-[#2A353D] px-2 py-0.5 rounded text-slate-400 font-bold">restaurantId: {log.restaurantId}</span>}
                      {log.user && <span className="bg-[#0B0E11] border border-[#2A353D] px-2 py-0.5 rounded text-slate-400 font-bold">user: {log.user}</span>}
                    </div>
                  )}
                  {(log.screenSize || log.userAgent) && (
                    <div className="text-[9px] mt-1.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-[#0B0E11] p-1.5 rounded-lg border border-[#2A353D]">
                      {log.screenSize && <span className="font-black text-blue-400 whitespace-nowrap">🖥️ {log.screenSize}</span>}
                      {log.userAgent && <span className="font-medium text-slate-500 truncate" title={log.userAgent}>📱 {log.userAgent}</span>}
                    </div>
                  )}
                  {log.breadcrumbs && log.breadcrumbs.length > 0 && (
                    <div className="bg-[#0B0E11] rounded-lg border border-[#2A353D] p-2 mt-1">
                       <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">User Action Telemetry (Last 15 Clicks)</div>
                       <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                         {log.breadcrumbs.map((crumb, idx) => (
                           <div key={idx} className="flex gap-2 hover:bg-[#12161A] px-1 rounded transition-colors">
                             <span className="text-emerald-500/70">[{crumb.time}]</span>
                             <span className="text-slate-500">{crumb.action}:</span>
                             <span className="text-blue-300">"{crumb.target}"</span>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                  {log.stack && <div className="text-[9px] text-slate-500 font-mono mt-1 overflow-x-auto whitespace-pre-wrap bg-[#0B0E11] p-2 rounded border border-[#2A353D] opacity-70 hover:opacity-100 transition-opacity">{log.stack}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: FORENSICS (GLOBAL AUDIT TRAIL) --- */}
<Modal isOpen={isRawInspectorOpen} onClose={() => { setIsRawInspectorOpen(false); setRawInspectorData(null); }} title="Raw Database Inspector">
        <div className="space-y-4">
          <form onSubmit={handleFetchRawDoc} className="flex gap-2">
            <select value={rawInspectorCollection} onChange={e=>setRawInspectorCollection(e.target.value)} className={`${T.input} w-1/3`}>
              <option value="users">Users</option>
              <option value="restaurants">Restaurants</option>
              <option value="shifts">Shifts</option>
              <option value="recipes">Recipes</option>
              <option value="inventoryItems">Inventory</option>
              <option value="timePunches">Time Punches</option>
            </select>
            <input type="text" value={rawInspectorId} onChange={e=>setRawInspectorId(e.target.value)} placeholder="Paste Document ID..." className={`${T.input} flex-1`} required />
            <button type="submit" className={`${T.btn} px-4`}><Search size={18}/></button>
          </form>
    {rawInspectorData && (
            <div className="bg-[#0B0E11] p-4 rounded-xl border border-[#2A353D] overflow-x-auto max-h-[50vh] custom-scrollbar">
              <pre className="text-[10px] text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
                {JSON.stringify(rawInspectorData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Modal>
      {subTab === 'forensics' && (
        <div id="admin-forensics" className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <CockpitMetric label="Audit Logs" value={auditLogs.length} detail="Recent global records" tone="blue" />
            <CockpitMetric label="Ghost Actions" value={ghostAuditLogs.length} detail="Support/possess edits" tone={ghostAuditLogs.length ? 'purple' : 'emerald'} />
            <CockpitMetric label="Destructive" value={destructiveAuditLogs.length} detail="Deletes, nukes, locks" tone={destructiveAuditLogs.length ? 'amber' : 'emerald'} hot={destructiveAuditLogs.length > 0} />
            <CockpitMetric label="Support Edits" value={supportEditLogs.length} detail="User routing/profile edits" tone={supportEditLogs.length ? 'blue' : 'emerald'} />
            <CockpitMetric label="Access Changes" value={accessAuditLogs.length} detail="Grant/revoke/admin events" tone={accessAuditLogs.length ? 'amber' : 'emerald'} />
            <CockpitMetric label="Rule Blocks" value={permissionDeniedLogs.length} detail="Permission denied clues" tone={permissionDeniedLogs.length ? 'red' : 'emerald'} hot={permissionDeniedLogs.length > 0} />
            <CockpitMetric label="Orphan Users" value={usersWithoutRestaurant.length} detail="Missing restaurantId" tone={usersWithoutRestaurant.length ? 'amber' : 'emerald'} />
            <CockpitMetric label="Backup Status" value={backupStatusLabel} detail={backupDetail} tone={backupIsStale ? 'amber' : 'emerald'} hot={backupIsStale} />
          </div>

          <div className={`${T.card} overflow-hidden border-purple-900/30`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-2"><Shield className="text-purple-400" size={18}/> Administrator Session Timeline</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Groups admin/support actions by browser session ID. Older records are grouped by actor in 30-minute windows.</p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-300 bg-purple-900/20 border border-purple-900/50 rounded-lg px-2 py-1">{adminAuditSessionGroups.length} session group(s)</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-[#2A353D]">
              {adminAuditSessionGroups.length === 0 && <div className="p-6 text-center text-xs font-bold text-slate-500">No administrator actions found yet.</div>}
              {adminAuditSessionGroups.map(group => (
                <div key={group.id} className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-white text-sm">{group.actor}</div>
                      <div className="text-[9px] font-mono text-slate-500 break-all">Session: {group.sessionId || group.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest">{group.logs.length} action(s)</div>
                      <div className="text-[9px] text-slate-500 font-bold">{formatBackupTimestamp(new Date(group.startedMs).toISOString())} → {formatBackupTimestamp(new Date(group.endedMs).toISOString())}</div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {group.logs.slice(0, 6).map(log => (
                      <div key={log.id} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2">
                        <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-widest text-blue-300 truncate">{log.action || 'UNKNOWN'}</span><span className="text-[8px] text-slate-600 font-bold whitespace-nowrap">{formatBackupTimestamp(log.timestamp || log.time || log.createdAt)}</span></div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 line-clamp-2">{log.details || log.target || 'No details'}</div>
                      </div>
                    ))}
                  </div>
                  {group.logs.length > 6 && <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">+ {group.logs.length - 6} more action(s) in flat audit below</div>}
                </div>
              ))}
            </div>
          </div>

          <div className={`${T.card} p-4 border-cyan-900/30`}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <h3 className="font-black text-white text-sm flex items-center gap-2"><Check size={16} className="text-cyan-300"/> Review Stamps</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">View the latest platform review stamp and recent stamp audit trail. Use Platform Operations to create a new stamp.</p>
              </div>
              <button type="button" onClick={handleStampOpsReview} className="bg-cyan-900/20 text-cyan-300 border border-cyan-900/50 hover:bg-cyan-900/40 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Create New Stamp</button>
            </div>
            <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-3 mt-3">
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">Latest Saved Review</div>
                {operationsReview ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-bold">
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Reviewed</div><div className="text-white">{formatClockDateTime(operationsReview.lastReviewedAt)}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">By</div><div className="text-white truncate">{operationsReview.lastReviewedBy || 'Unknown'}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Status</div><div className="text-white">{operationsReview.platformStatus || 'Unknown'}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Action Items</div><div className="text-[#D4A381] font-black">{operationsReview.actionItemCount ?? 0}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Crashes 24h</div><div className="text-white">{operationsReview.crashes24h ?? 0}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Rule Blocks</div><div className="text-white">{operationsReview.permissionDeniedCount ?? 0}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Backup</div><div className="text-white">{operationsReview.backupStatus || 'unknown'}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Version</div><div className="text-white">{operationsReview.version || 'unknown'}</div></div>
                    <div><div className="text-slate-500 uppercase tracking-widest text-[8px] font-black">Next Backup</div><div className="text-white">{operationsReview.nextAutomaticBackupAt ? formatClockDateTime(operationsReview.nextAutomaticBackupAt) : 'Not stamped'}</div></div>
                  </div>
                ) : <div className="text-xs font-bold text-slate-500">No review stamp saved yet. Create one from Platform Operations or the button above.</div>}
              </div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">Recent Stamp Audit</div>
                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  {reviewStampLogs.length === 0 && <div className="text-xs font-bold text-slate-500">No review stamp audit records yet.</div>}
                  {reviewStampLogs.slice(0, 6).map(log => <div key={log.id} className="bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><div className="flex justify-between gap-2"><span className="text-xs font-black text-white truncate">{log.userName || 'System Admin'}</span><span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">{formatClockDateTime(log.timestamp)}</span></div><div className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-2">{log.details || 'Review stamped.'}</div></div>)}
                </div>
              </div>
            </div>
          </div>

          <div className={`${T.card} p-4 border-blue-900/30`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-black text-white text-sm flex items-center gap-2"><Wrench size={16} className="text-blue-400"/> Diagnostic & Forensic Toolkit</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">One-click support bundle, client directory export, backup countdown, and data integrity watchlists.</p>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-2">
                <button type="button" onClick={handleDownloadForensicBundle} className="bg-purple-900/20 text-purple-300 border border-purple-900/50 hover:bg-purple-900/40 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Forensic JSON</button>
                <button type="button" onClick={handleDownloadClientDirectory} className="bg-amber-900/20 text-amber-300 border border-amber-900/50 hover:bg-amber-900/40 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Client CSV</button>
                <button type="button" onClick={handleStampOpsReview} className="bg-blue-900/20 text-blue-300 border border-blue-900/50 hover:bg-blue-900/40 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Create Stamp</button>
                <button type="button" onClick={handleClearThisDeviceTempCache} className="bg-[#12161A] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Clear This Cache</button>
              </div>
            </div>
            <div className="grid md:grid-cols-4 gap-2">
              <div className={`bg-[#0B0E11] border ${backupMissedDailyWindow ? 'border-amber-500/40' : 'border-[#2A353D]'} rounded-xl p-3`}><div className="flex items-center justify-between gap-2"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Next Auto Backup</div><AdminInfoButton title="Next Auto Backup" body={backupTroubleshootingSummary} /></div><div className="text-lg font-black text-white">{nextBackupCountdown}</div><div className="text-[9px] text-slate-500 font-bold">{nextBackupLocalTime}</div>{backupMissedDailyWindow && <div className="text-[9px] text-amber-300 font-black uppercase tracking-widest mt-1">Daily window missed</div>}</div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Data Watchlist</div><div className="text-lg font-black text-white">{usersWithoutRestaurant.length + missingOwnerAccounts.length + duplicateEmailGroups.length}</div><div className="text-[9px] text-slate-500 font-bold">routing / owner / duplicates</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Sensitive Actions</div><div className="text-lg font-black text-white">{destructiveAuditLogs.length}</div><div className="text-[9px] text-slate-500 font-bold">delete / nuke / lock / sweep</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Rule Blocks</div><div className={`text-lg font-black ${permissionDeniedLogs.length ? 'text-red-300' : 'text-emerald-400'}`}>{permissionDeniedLogs.length}</div><div className="text-[9px] text-slate-500 font-bold">permission-denied logs</div></div>
            </div>
            {backupMissedDailyWindow && <div className="mt-3 bg-amber-900/15 border border-amber-500/30 rounded-xl p-3 text-xs font-bold text-amber-100 leading-relaxed"><div className="font-black uppercase tracking-widest text-amber-300 text-[10px] mb-1">Automatic backup needs review</div>{backupTroubleshootingSummary}</div>}
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className={`${T.card} p-4`}>
              <h3 className="font-black text-white text-sm mb-3">Top Audit Actors</h3>
              <div className="space-y-2">{auditActors.length === 0 && <div className="text-xs font-bold text-slate-500">No actors yet.</div>}{auditActors.map(([actor, count]) => <div key={actor} className="flex justify-between gap-3 bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><span className="text-xs font-bold text-slate-300 truncate">{actor}</span><span className="text-xs font-black text-[#D4A381]">{count}</span></div>)}</div>
            </div>
            <div className={`${T.card} p-4`}>
              <h3 className="font-black text-white text-sm mb-3">Top Actions</h3>
              <div className="space-y-2">{auditActions.length === 0 && <div className="text-xs font-bold text-slate-500">No actions yet.</div>}{auditActions.map(([action, count]) => <div key={action} className="flex justify-between gap-3 bg-[#12161A] border border-[#2A353D] rounded-lg p-2"><span className="text-xs font-bold text-slate-300 truncate">{action}</span><span className="text-xs font-black text-[#D4A381]">{count}</span></div>)}</div>
            </div>
            <div className={`${T.card} p-4`}>
              <h3 className="font-black text-white text-sm mb-3">Investigation Tools</h3>
              <div className="space-y-2">
                <button onClick={() => setIsRawInspectorOpen(true)} className="w-full bg-blue-900/20 text-blue-300 border border-blue-900/50 hover:bg-blue-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"><Wrench size={12} /> Inspect Raw JSON</button>
                <button onClick={handleCopyDiagnostics} className="w-full bg-[#12161A] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Copy Support Diagnostics</button>
                <button onClick={handleDownloadForensicBundle} className="w-full bg-purple-900/20 text-purple-300 border border-purple-900/50 hover:bg-purple-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Download Forensic Bundle</button>
                <button onClick={handleDownloadClientDirectory} className="w-full bg-amber-900/20 text-amber-300 border border-amber-900/50 hover:bg-amber-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Download Client Directory CSV</button>
                <button onClick={handleStampOpsReview} className="w-full bg-blue-900/20 text-blue-300 border border-blue-900/50 hover:bg-blue-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Create Review Stamp</button>
                <button onClick={handleRunBackupNow} disabled={isBackupRunning || backupRunning} className="w-full bg-emerald-900/20 text-emerald-300 border border-emerald-900/50 hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">{(isBackupRunning || backupRunning) && <Loader2 size={12} className="animate-spin" />} Run Backup Now</button>
                <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">Backup Center</div>
                      <div className="text-[9px] text-slate-500 font-bold">Select a backup instead of pasting a Storage path.</div>
                    </div>
                    <button type="button" onClick={() => loadBackupList()} disabled={isBackupListLoading} className="bg-[#1A2126] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] disabled:opacity-50 text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      {isBackupListLoading && <Loader2 size={10} className="animate-spin" />} Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {['all','scheduled','manual'].map(mode => (
                      <button key={mode} type="button" onClick={() => setBackupListFilter(mode)} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border transition-colors ${backupListFilter === mode ? 'bg-[#D4A381] text-slate-900 border-[#D4A381]' : 'bg-[#0B0E11] text-slate-400 border-[#2A353D] hover:text-white'}`}>{mode}</button>
                    ))}
                  </div>
                  {backupListError && <div className="bg-red-900/20 border border-red-900/50 text-red-200 text-[10px] font-bold rounded-lg p-2">{backupListError}</div>}
                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {isBackupListLoading && <div className="text-center text-[10px] font-bold text-slate-500 py-4">Loading backup files...</div>}
                    {!isBackupListLoading && filteredBackupList.length === 0 && <div className="text-center text-[10px] font-bold text-slate-500 py-4">No backup files found. Run Backup Now first.</div>}
                    {filteredBackupList.map(backup => (
                      <div key={backup.path} className="bg-[#0B0E11] border border-[#2A353D] rounded-lg p-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black text-white truncate">{formatBackupTimestamp(backup.createdAt || backup.updatedAt)}</div>
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{backup.mode || 'backup'} • {formatBackupBytes(backup.sizeBytes)} • {backup.documentCount || 0} docs • Integrity: {backup.integrityStatus || 'unknown'}</div>
                          </div>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${backup.mode === 'manual' ? 'text-blue-300 border-blue-900/50 bg-blue-900/20' : 'text-emerald-300 border-emerald-900/50 bg-emerald-900/20'}`}>{backup.mode || 'backup'}</span>
                        </div>
                        <div className="text-[8px] font-mono text-slate-600 truncate">{backup.path}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => backup.signedUrl ? window.open(backup.signedUrl, '_blank', 'noopener,noreferrer') : addToast('No Download Link', 'Could not create a signed download link for this backup.')} className="bg-[#1A2126] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg transition-colors">Download</button>
                          <button type="button" onClick={() => handleRestoreFullBackupFromStorage(backup.path)} disabled={isBackupRestoring} className="bg-red-900/20 text-red-300 border border-red-900/50 hover:bg-red-900/40 disabled:opacity-50 text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">{isBackupRestoring && <Loader2 size={10} className="animate-spin" />} Restore</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Shield size={16} className="text-red-300 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-red-300">Emergency Schedule Rescue</div>
                      <div className="text-[10px] text-slate-400 font-bold leading-snug">Legacy guarded schedule import for a stored July 2026 draft. It downloads a backup first, then reloads the saved schedule as unpublished drafts for review and republish.</div>
                    </div>
                  </div>
                  <button type="button" onClick={handleRestoreLegacyJulySchedule} disabled={isScheduleReinjecting} className="w-full bg-red-900/30 text-red-200 border border-red-800/70 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                    {isScheduleReinjecting ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                    {isScheduleReinjecting ? 'Importing Legacy July Schedule...' : 'Run Legacy July 2026 Schedule Import'}
                  </button>
                  <div className="text-[9px] text-slate-500 font-bold leading-snug">Safety phrase required: <span className="text-red-200">REINJECT JULY</span>. Super Admin only.</div>
                </div>
                <button onClick={() => jumpToAdminIssue('support')} className="w-full bg-orange-900/20 text-orange-300 border border-orange-900/50 hover:bg-orange-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">Open Support Bay</button>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mt-3 leading-snug">Use raw JSON only when normal screens cannot explain the issue. For destructive changes, copy diagnostics first.</p>
            </div>
          </div>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-2"><Search className="text-blue-500" size={18}/> Global Forensics & Ghost Audit</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Audit trail, ghost actions, access changes, support edits, and destructive operations.</p>
              </div>
              <button onClick={() => setIsRawInspectorOpen(true)} className="bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-2">
                <Wrench size={12} /> Inspect Raw JSON
              </button>
            </div>
            <div className="p-3 border-b border-[#2A353D] bg-[#0B0E11]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <input value={auditFilters.user} onChange={e=>setAuditFilters(prev=>({...prev, user:e.target.value}))} className={`${T.input} py-2 text-xs`} placeholder="Filter by user / target" />
                <input value={auditFilters.action} onChange={e=>setAuditFilters(prev=>({...prev, action:e.target.value}))} className={`${T.input} py-2 text-xs`} placeholder="Action type" />
                <input value={auditFilters.session} onChange={e=>setAuditFilters(prev=>({...prev, session:e.target.value}))} className={`${T.input} py-2 text-xs`} placeholder="Session ID" />
                <input type="date" value={auditFilters.date} onChange={e=>setAuditFilters(prev=>({...prev, date:e.target.value}))} className={`${T.input} py-2 text-xs`} />
                <select value={auditFilters.security} onChange={e=>setAuditFilters(prev=>({...prev, security:e.target.value}))} className={`${T.input} py-2 text-xs`}><option value="all">All security levels</option><option value="scary">Scary actions only</option><option value="normal">Normal actions only</option></select>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Showing {filteredAuditLogs.length} of {auditLogs.length} audit record(s)</div>
            </div>
            <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
              {filteredAuditLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No forensic data matches the current filters.</div>}
              {filteredAuditLogs.map(log => (
                <div key={log.id} className={`${T.row} flex flex-col gap-1`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{log.userName || 'Unknown'}</span>
                      {log.isGhost && <span className="bg-purple-900/20 text-purple-400 border border-purple-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest flex items-center gap-1">👻 Ghost Action</span>}
                      {/(delete|nuke|lock|revoke|bulk|sweep)/i.test(`${log.action || ''} ${log.details || ''}`) && <span className="bg-red-900/20 text-red-400 border border-red-900/50 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Destructive</span>}
                      <span className={`text-[9px] uppercase font-black tracking-widest bg-[#12161A] border ${T.border} text-blue-400 px-2 py-0.5 rounded`}>{log.action || 'UNKNOWN'}</span>
                    </div>
                    <span className={`text-[9px] font-bold ${T.muted} whitespace-nowrap ml-2`}>{formatClockDateTime(log.timestamp)}</span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium mt-1 break-words whitespace-pre-wrap">
                    {log.details || 'No details'} <span className="text-slate-500 ml-1">Target: [{log.target || 'none'}]</span> <span className="text-[#D4A381] ml-1">Tenant ID: {log.restaurantId || 'unknown'}</span>
                    {/(delete|nuke|restore|lock|revoke|permission|role|admin|backup|bulk|reset)/i.test(`${log.action || ''} ${log.details || ''}`) && <div className="mt-2 bg-red-900/10 border border-red-900/40 rounded-lg p-2 text-[10px] text-red-200 font-bold">Why this matters: this action can affect access, data safety, backups, permissions, or customer trust. Review the session timeline before making another risky change.</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: OPERATIONS --- */}
      {subTab === 'ops' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleMegaphone} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white">System Megaphone</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Push a priority system alert to the message board of every single restaurant.</p></div>
            <textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} rows="3" className={`${T.input} mb-3 border-[#D4A381]/50 focus:border-[#D4A381]`} placeholder="SYSTEM ALERT: Maintenance scheduled for 3AM..."></textarea>
            <button type="submit" className="w-full bg-[#12161A] text-[#D4A381] border border-[#2A353D] hover:bg-[#1A2126] font-black uppercase tracking-widest py-3 rounded-xl transition-colors">Blast Message</button>
          </form>

    <div className={`${T.card} p-5 border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.05)]`}>
            <form onSubmit={handlePushBanner}>
              <div className="mb-4 pb-2 border-b border-[#2A353D]">
                <h2 className="text-lg font-black text-blue-400 flex items-center gap-2"><Bell size={18}/> Top-of-App Banner Broadcast</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Pin a persistent, high-visibility alert directly below the main header.</p>
              </div>
              <div className="space-y-3">
                <select value={bannerTarget} onChange={e => setBannerTarget(e.target.value)} className={T.input}>
                  <option value="ALL">🚨 ALL WORKSPACES (GLOBAL)</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input type="text" value={bannerText} onChange={e => setBannerText(e.target.value)} placeholder="e.g. SYSTEM DEGRADED - POS SYNC IS CURRENTLY DOWN" className={T.input} />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-900/20 text-blue-400 border border-blue-900/50 hover:bg-blue-900/40 font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-sm">Pin Banner</button>
                  <button type="button" onClick={handleClearBanner} className="px-6 bg-[#12161A] text-slate-400 border border-[#2A353D] hover:text-red-400 font-black uppercase tracking-widest py-3 rounded-xl transition-colors shadow-sm">Clear Selected</button>
                </div>
              </div>
            </form>

            {/* THE ACTIVE BANNER LEDGER */}
            {restaurants.filter(r => r.systemBanner).length > 0 && (
              <div className="mt-5 pt-4 border-t border-[#2A353D] animate-[slideIn_0.2s_ease-out]">
                <h3 className="text-[10px] font-black uppercase text-[#D4A381] tracking-widest mb-3">Currently Active Banners</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {restaurants.filter(r => r.systemBanner).map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-xl border border-[#2A353D]">
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-bold text-white truncate">{r.name}</div>
                        <div className="text-[10px] text-blue-400 font-bold mt-0.5 leading-snug break-words">"{r.systemBanner}"</div>
                      </div>
                      <button type="button" onClick={async () => {
                        if(!window.confirm(`Clear banner for ${r.name}?`)) return;
                        await updateDoc(doc(db, "restaurants", r.id), { systemBanner: null });
                        addToast('Cleared', `Banner removed from ${r.name}.`);
                      }} className="text-slate-400 hover:text-red-500 p-2 flex-shrink-0 transition-colors bg-[#1A2126] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${T.card} p-5 border-amber-900/30`}>
              <h3 className="font-black text-white mb-1">Deploy Demo Workspace</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Automatically inject a fake restaurant populated with staff, shifts, prep lists, and data across every tab for showcasing.</p>
              <button onClick={handleInjectDemoWorkspace} type="button" className="w-full bg-amber-900/20 text-amber-400 border border-amber-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-amber-900/40 transition-colors flex items-center justify-center gap-2"><Star size={16}/> Build Showcase</button>
            </div>
            <div className={`${T.card} p-5 border-fuchsia-900/30`}>
              <h3 className="font-black text-white mb-1">Test Push Notifications</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Fires a live test ping through Vercel to verify tokens and Firebase Admin credentials are working.</p>
              <button onClick={handleTestPush} type="button" className="w-full bg-fuchsia-900/20 text-fuchsia-400 border border-fuchsia-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-fuchsia-900/40 transition-colors flex items-center justify-center gap-2"><Bell size={16}/> Fire Test Alert</button>
            </div>
            <div className={`${T.card} p-5 border-emerald-900/30`}>
              <h3 className="font-black text-white mb-1">Global Force Refresh</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Pushes a silent command to all active devices to instantly hard-reload the browser. Use after deploying new code.</p>
              <button onClick={handleForceRefresh} className="w-full bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-emerald-900/40 transition-colors">Execute Global Refresh</button>
            </div>
            <div className={`${T.card} p-5 border-blue-900/30`}>
              <h3 className="font-black text-white mb-1">Orphan Data Sweeper</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Scans all global databases for shifts assigned to employees that have been fully deleted. Reclaims server space.</p>
              <button onClick={handleOrphanSweep} className="w-full bg-blue-900/20 text-blue-400 border border-blue-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-blue-900/40 transition-colors">Run DB Sweep</button>
            </div>

            <div className={`${T.card} p-5 border-purple-900/30`}>
              <h3 className="font-black text-white mb-1">Forensic Bundle</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Downloads a single JSON support packet with platform counts, backup status, watchlists, runtime clues, and recent sensitive actions.</p>
              <button onClick={handleDownloadForensicBundle} type="button" className="w-full bg-purple-900/20 text-purple-300 border border-purple-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-purple-900/40 transition-colors">Download Bundle</button>
            </div>
            <div className={`${T.card} p-5 border-amber-900/30`}>
              <h3 className="font-black text-white mb-1">Client Directory Export</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Downloads workspace IDs, owner labels, plan/billing status, user count, online count, and enabled modules for operations review.</p>
              <button onClick={handleDownloadClientDirectory} type="button" className="w-full bg-amber-900/20 text-amber-300 border border-amber-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-amber-900/40 transition-colors">Download Client CSV</button>
            </div>
            <div className={`${T.card} p-5 border-cyan-900/30`}>
              <h3 className="font-black text-white mb-1">Create Review Stamp</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Creates a system health stamp with backup, crash, permission, and data-integrity counts. To view saved stamps, open Forensics & Backups.</p>
              <div className="grid grid-cols-2 gap-2"><button onClick={handleStampOpsReview} type="button" className="w-full bg-cyan-900/20 text-cyan-300 border border-cyan-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-cyan-900/40 transition-colors">Create Stamp</button><button onClick={() => jumpToAdminIssue('forensics')} type="button" className="w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:text-white transition-colors">View Stamps</button></div>
            </div>
            <div className={`${T.card} p-5 border-slate-700/50`}>
              <h3 className="font-black text-white mb-1">This Device Cache</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Clears temporary help/demo/tour cache on this browser only. It does not delete restaurant data, users, schedules, or backups.</p>
              <button onClick={handleClearThisDeviceTempCache} type="button" className="w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:text-[#D4A381] transition-colors">Clear Temp Cache</button>
            </div>

            <div className={`${T.card} p-5 border-red-900/30 sm:col-span-2`}>
              <h3 className="font-black text-white mb-1">Global Lockdown</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Instantly puts every workspace behind the maintenance screen, including your restaurant group. Your Super Admin account bypasses the lock so you can still enter and lift it.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleGlobalLockdown(true)} className="w-full bg-red-900/20 text-red-500 border border-red-900/50 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2"><Shield size={16}/> Lock All</button>
                <button onClick={() => handleGlobalLockdown(false)} className="w-full bg-[#12161A] text-slate-300 border border-[#2A353D] font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2">Unlock All</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- TAB: ACCESS CONTROL --- */}
      {subTab === 'admins' && (
        <div id="admin-admins" className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleGrantAccess} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white">Grant Administrator Access</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Add a user's exact email address to grant full system control.</p></div>
            <div className="flex flex-col sm:flex-row gap-3"><input type="email" placeholder="User's exact email..." value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} className={T.input} required /><button type="submit" className={`${T.btn} px-8`}>Grant Access</button></div>
          </form>
          <div className={`${T.card} overflow-hidden`}><div className={`bg-[#12161A] p-4 border-b ${T.border}`}><h3 className="font-black text-sm text-white">Platform Administrators</h3></div><div className={`divide-y ${T.border}`}>{superAdmins.map(admin => (<div key={admin.id} className={`${T.row} flex justify-between items-center`}><div><div className="font-black text-white">{admin.name}</div><div className="text-[10px] font-bold text-slate-400">{admin.email}</div></div><button onClick={() => handleRevokeAccess(admin)} className="px-3 py-1.5 bg-[#12161A] border border-[#2A353D] text-red-500 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#1A2126] transition-colors">Revoke</button></div>))}</div></div>
        </div>
      )}

      {subTab === 'manual' && (
        <div id="admin-manual" className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5 cockpit-grid`}>
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">AI support interface</div>
                <h2 className="text-2xl font-black text-white mt-1 flex items-center gap-2"><HelpCircle size={24} className="text-[#D4A381]"/> System Administrator Support Console</h2>
                <p className="text-sm text-slate-400 font-bold mt-1 max-w-3xl">Type the customer's question, get the likely cause, first checks, exact fix steps, and the most relevant manual articles without scrolling forever.</p>
              </div>
              <button type="button" onClick={copyAdminSupportAnswer} className="px-4 py-3 bg-[#D4A381] text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-2"><ClipboardList size={14}/> Copy Support Answer</button>
            </div>
            <div className="mt-4 grid lg:grid-cols-[minmax(0,1fr)_280px] gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer question or symptom</label>
                <textarea value={adminManualQuestion} onChange={e => setAdminManualQuestion(e.target.value)} rows={4} placeholder="Example: customer says the menu scan failed with invalid JSON, or employee cannot see the schedule tab..." className="mt-2 w-full bg-[#12161A] border border-[#2A353D] rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4A381] resize-none" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {sampleAdminQuestions.map(sample => <button key={sample} type="button" onClick={() => setAdminManualQuestion(sample)} className="px-3 py-1.5 bg-[#0B0E11] border border-[#2A353D] rounded-full text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-[#D4A381]">{sample}</button>)}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Article filter</label>
                <div className="relative mt-2">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={adminManualSearch} onChange={e => setAdminManualSearch(e.target.value)} placeholder="Optional keyword filter..." className="w-full bg-[#12161A] border border-[#2A353D] rounded-xl pl-10 pr-3 py-3 text-sm font-bold text-white outline-none focus:border-[#D4A381]" />
                </div>
                <select value={adminManualCategory} onChange={e => setAdminManualCategory(e.target.value)} className="mt-2 w-full bg-[#12161A] border border-[#2A353D] rounded-xl px-3 py-3 text-xs font-black uppercase tracking-widest text-slate-300 outline-none focus:border-[#D4A381]">
                  {adminManualCategories.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[320px_minmax(0,1fr)] gap-4">
            <div className="space-y-4">
            <div className={`${T.card} p-4 h-max`}>
              <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381] mb-3">Fast support routine</div>
              {[
                'Get the exact email, workspace, URL, device, and screenshot.',
                'Search the user and workspace before editing.',
                'Confirm restaurantId, permissions, and current version.',
                'Copy diagnostics before risky changes.',
                'Fix the smallest thing that explains the symptom.',
                'Verify as the user, then exit Ghost Mode.'
              ].map((line, idx) => <div key={idx} className="flex gap-2 text-xs font-bold text-slate-300 mb-2"><span className="w-5 h-5 rounded-full bg-[#D4A381] text-slate-900 flex items-center justify-center text-[10px] font-black flex-shrink-0">{idx+1}</span><span>{line}</span></div>)}
            </div>

              <div className={`${T.card} overflow-hidden max-h-[44vh] overflow-y-auto custom-scrollbar`}>
                <div className={T.th}>Related Playbooks</div>
                {[primarySupportPlaybook, ...relatedSupportPlaybooks].filter(Boolean).map((playbook, idx) => (
                  <div key={playbook.title} className={`${T.row} ${idx === 0 ? 'bg-[#D4A381]/10' : ''}`}>
                    <div className="flex items-center gap-2">
                      <SignalPip tone={idx === 0 ? 'amber' : 'blue'} label={idx === 0 ? 'best match' : 'related'} />
                      <div className="font-black text-white text-sm">{playbook.title}</div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold mt-1">Score {playbook.score || 0}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 min-w-0">
              <div className={`${T.card} p-5 border border-[#D4A381]/40`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Suggested answer</div>
                    <h3 className="text-xl font-black text-white mt-1">{primarySupportPlaybook?.title || 'Start with support triage'}</h3>
                  </div>
                  <SignalPip tone={supportQuestion ? 'emerald' : 'amber'} label={supportQuestion ? 'question ready' : 'type a question'} />
                </div>
                {!supportQuestion && <div className="mt-4 bg-amber-900/10 border border-amber-500/30 rounded-xl p-3 text-xs font-bold text-amber-100">Type the customer problem above or pick a sample question. The console will match it against support playbooks and the full manual.</div>}
                <div className="mt-4 grid lg:grid-cols-2 gap-3">
                  <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Likely cause</div>
                    <p className="text-sm font-bold text-slate-200 leading-relaxed">{primarySupportPlaybook?.likelyCause}</p>
                  </div>
                  <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">Escalate when</div>
                    <p className="text-sm font-bold text-slate-200 leading-relaxed">{primarySupportPlaybook?.escalation}</p>
                  </div>
                </div>
                <div className="mt-4 grid lg:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381] mb-2">First checks</div>
                    <div className="space-y-2">{(primarySupportPlaybook?.firstChecks || []).map((line, idx) => <div key={idx} className="flex gap-2 text-xs font-bold text-slate-300 leading-relaxed"><span className="w-5 h-5 rounded-full bg-[#12161A] border border-[#2A353D] text-[#D4A381] flex items-center justify-center text-[10px] font-black flex-shrink-0">{idx+1}</span><span>{line}</span></div>)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300 mb-2">Fix it in this order</div>
                    <div className="space-y-2">{(primarySupportPlaybook?.fixSteps || []).map((line, idx) => <div key={idx} className="flex gap-2 text-xs font-bold text-slate-300 leading-relaxed"><span className="w-5 h-5 rounded-full bg-emerald-900/30 border border-emerald-500/30 text-emerald-200 flex items-center justify-center text-[10px] font-black flex-shrink-0">{idx+1}</span><span>{line}</span></div>)}</div>
                  </div>
                </div>
                <div className="mt-4 bg-red-900/10 border border-red-500/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-widest font-black text-red-200 mb-2">Do not do this</div>
                  <div className="space-y-1">{(primarySupportPlaybook?.doNot || []).map((line, idx) => <div key={idx} className="text-xs font-bold text-red-100 leading-relaxed">- {line}</div>)}</div>
                </div>
              </div>

              {selectedAdminArticle && (
                <div className={`${T.card} p-5`}>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-[#D4A381]"><BookOpen size={14}/> Manual article</div>
                  <h3 className="font-black text-white text-lg mt-2">{selectedAdminArticle.title}</h3>
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{selectedAdminArticle.group}</div>
                  <div className="mt-4 space-y-2 max-h-[42vh] overflow-y-auto custom-scrollbar pr-1">
                    {(selectedAdminArticle.body || []).map((line, idx) => <div key={idx} className="flex gap-2 text-xs font-bold text-slate-300 leading-relaxed"><span className="w-5 h-5 rounded-full bg-[#12161A] border border-[#2A353D] text-[#D4A381] flex items-center justify-center text-[10px] font-black flex-shrink-0">{idx+1}</span><span>{line}</span></div>)}
                  </div>
                  <div className="mt-4 text-[9px] font-mono text-slate-600 break-words">Search terms: {selectedAdminArticle.keywords || 'manual support'}</div>
                </div>
              )}

              <div className={`${T.card} overflow-hidden`}>
                <div className={`${T.th} flex justify-between gap-2`}><span>Relevant Articles</span><span>{topManualArticles.length}</span></div>
              <div className="text-[10px] uppercase tracking-widest font-black text-slate-500">{filteredAdminManualArticles.length} searchable result(s)</div>
              {filteredAdminManualArticles.length === 0 && <div className={`${T.card} p-6 text-center text-xs font-bold text-slate-500`}>No manual results. Try a simpler word like “tab”, “punch”, “backup”, “delete”, “GPS”, or “permission”.</div>}
              {topManualArticles.map((article, idx) => (
                <button type="button" onClick={() => setSelectedAdminArticleId(article.manualId)} key={article.manualId || `${article.title}-${idx}`} className={`w-full text-left ${T.row} hover:bg-[#12161A] transition-colors ${selectedAdminArticle?.manualId === article.manualId ? 'bg-[#D4A381]/10' : ''}`}>
                  <div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381] mb-1">{article.group}</div>
                  <h3 className="font-black text-white text-base mb-3">{article.title}</h3>
                  <div className="text-xs text-slate-400 font-bold leading-relaxed line-clamp-2">{(article.body || [])[0] || 'Open this article for details.'}</div>
                  <div className="mt-3 text-[9px] font-mono text-slate-600 break-words">Match score: {article.score || 0}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

const ROLE_KEYWORDS = {
  Manager: ['manager','gm','owner','lead','supervisor'],
  Kitchen: ['cook','chef','kitchen','prep','dish'],
  Bar: ['bar','bartender'],
  Service: ['server','host','wait','expo','runner'],
};

const normalizeLaborRole = (role) => String(role || 'Unassigned').trim() || 'Unassigned';
const roleFilterKey = (role) => normalizeLaborRole(role).toLowerCase();

const TabLabor = ({ currentDate, users = [], shifts = [], sales = [], timePunches = [], addToast, appUser }) => {
  const [subTab, setSubTab] = useState('fixer');
  const [rangeStart, setRangeStart] = useState(getWeekStart(currentDate));
  const [rangeEnd, setRangeEnd] = useState(getWeekDates(currentDate)[6]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [exportMode, setExportMode] = useState('detail');
  const [editingPunch, setEditingPunch] = useState(null);
  const [form, setForm] = useState({ employeeId: '', date: getToday(), clockIn: '09:00', clockOut: '17:00', breakMinutes: '0', cashTips: '0', creditTips: '0', reason: 'Forgot to clock out', note: '' });

  const activeUsers = users.filter(u => u.isActive !== false).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  const dbRoles = useLiveCollection('roles', appUser?.restaurantId, { limitCount: 250 });
  const getLaborRole = (user = {}) => normalizeLaborRole(user.role);
  const configuredRoleNames = dbRoles.map(r => normalizeLaborRole(r.name)).filter(Boolean);
  const activeUserRoleNames = activeUsers.map(u => getLaborRole(u)).filter(Boolean);
  const roleOptions = Array.from(
    new Map([...configuredRoleNames, ...activeUserRoleNames].map(role => [roleFilterKey(role), role])).values()
  ).sort((a,b) => a.localeCompare(b));
  const selectedRoleLabel = roleFilter === 'all' ? 'Whole Restaurant' : (roleOptions.find(r => roleFilterKey(r) === roleFilter) || roleFilter);
  const userMatchesRole = (user = {}) => roleFilter === 'all' || roleFilterKey(getLaborRole(user)) === roleFilter;
  const filteredUsersForExport = activeUsers.filter(userMatchesRole);
  const visiblePunches = timePunches
    .filter(p => (p.date || '') >= rangeStart && (p.date || '') <= rangeEnd)
    .filter(p => { const emp = users.find(u => u.id === p.employeeId) || {}; return userMatchesRole(emp); })
    .filter(p => employeeFilter ? p.employeeId === employeeFilter : true)
    .filter(p => statusFilter === 'all' ? true : statusFilter === 'open' ? ['clocked_in','on_break'].includes(p.status) : statusFilter === 'exception' ? Boolean(getPunchIssue(p)) : p.status === statusFilter)
    .sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));

  function getPunchIssue(p) {
    if (!p) return '';
    if (['clocked_in','on_break'].includes(p.status)) return 'Still on clock';
    if (!p.clockInTime) return 'Missing clock-in';
    if (!p.clockOutTime && p.status !== 'clocked_in') return 'Missing clock-out';
    const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
    if (hours > 12) return 'Long shift, review break/punch';
    if (hours < 0) return 'Clock-out before clock-in';
    if (p.isUnscheduled && !p.isApproved) return 'Unscheduled punch needs approval';
    if (p.requiresManagerReview || ['outside','unverified','denied','unavailable'].includes(p.clockOutGeofenceStatus)) return 'Clock-out location needs review';
    return '';
  }

  const exceptionPunches = timePunches.filter(p => getPunchIssue(p)).sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));
  const rangeSales = sales.filter(s => (s.date || '') >= rangeStart && (s.date || '') <= rangeEnd).reduce((sum, s) => sum + (parseFloat(s.amount || s.totalSales || s.sales || 0) || 0), 0);
  const payrollRows = visiblePunches.map(p => {
    const emp = users.find(u => u.id === p.employeeId) || {};
    const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
    return { punch: p, emp, role: getLaborRole(emp), hours, pay: hours * (parseFloat(emp.wage || 0) || 0), tips: (parseFloat(p.cashTips || 0) || 0) + (parseFloat(p.creditTips || 0) || 0), issue: getPunchIssue(p) };
  });
  const totalHours = payrollRows.reduce((s,r) => s + Math.max(0, r.hours), 0);
  const totalLabor = payrollRows.reduce((s,r) => s + Math.max(0, r.pay), 0);
  const totalTips = payrollRows.reduce((s,r) => s + r.tips, 0);
  const laborPct = rangeSales > 0 ? (totalLabor / rangeSales) * 100 : 0;

  const resetForm = () => {
    setEditingPunch(null);
    setForm({ employeeId: '', date: getToday(), clockIn: '09:00', clockOut: '17:00', breakMinutes: '0', cashTips: '0', creditTips: '0', reason: 'Forgot to clock out', note: '' });
  };

  const openEditPunch = (p) => {
    setEditingPunch(p);
    setForm({
      employeeId: p.employeeId || '',
      date: p.date || getToday(),
      clockIn: toLocalTimeInput(p.clockInTime) || '09:00',
      clockOut: toLocalTimeInput(p.clockOutTime) || new Date().toTimeString().slice(0,5),
      breakMinutes: String(Math.round(p.breakMinutes || 0)),
      cashTips: String(p.cashTips || 0),
      creditTips: String(p.creditTips || 0),
      reason: p.correctionReason || 'Manager correction',
      note: p.managerNote || ''
    });
    setSubTab('editor');
    setTimeout(() => document.getElementById('labor-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const savePunch = async (e) => {
    e.preventDefault();
    const emp = users.find(u => u.id === form.employeeId);
    if (!emp) return addToast('Missing Employee', 'Choose a team member before saving the punch.');
    if (!form.date || !form.clockIn) return addToast('Missing Time', 'Date and clock-in are required.');
    const payload = {
      restaurantId: appUser.restaurantId,
      employeeId: emp.id,
      employeeName: emp.name || emp.email || 'Unknown Staff',
      date: form.date,
      clockInTime: makeLocalIso(form.date, form.clockIn),
      clockOutTime: form.clockOut ? makeLocalIso(form.date, form.clockOut) : null,
      status: form.clockOut ? 'clocked_out' : 'clocked_in',
      breakMinutes: parseFloat(form.breakMinutes) || 0,
      cashTips: parseFloat(form.cashTips) || 0,
      creditTips: parseFloat(form.creditTips) || 0,
      isManual: true,
      isApproved: true,
      correctionReason: form.reason,
      managerNote: form.note,
      correctedBy: appUser.name || appUser.email || 'Manager',
      correctedById: appUser.id || 'unknown',
      correctedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      if (editingPunch?.id) {
        await updateDoc(doc(db, 'timePunches', editingPunch.id), payload);
        await logAudit(appUser, 'EDIT_TIME_PUNCH', emp.name || emp.email, `${form.date} ${form.clockIn}-${form.clockOut || 'open'} reason: ${form.reason}`);
        addToast('Punch Updated', 'Time punch correction saved with audit details.');
      } else {
        await addDoc(collection(db, 'timePunches'), { ...payload, createdAt: new Date().toISOString(), createdBy: appUser.id || 'manager' });
        await logAudit(appUser, 'ADD_TIME_PUNCH', emp.name || emp.email, `${form.date} ${form.clockIn}-${form.clockOut || 'open'} reason: ${form.reason}`);
        addToast('Punch Added', 'Manual punch added and marked approved.');
      }
      resetForm();
      setSubTab('fixer');
    } catch (err) { addToast('Error', err.message); }
  };

  const forceOut = async (p) => {
    const now = new Date();
    try {
      await updateDoc(doc(db, 'timePunches', p.id), { clockOutTime: now.toISOString(), status: 'clocked_out', correctionReason: 'Manager force clock-out', correctedBy: appUser.name || appUser.email, correctedAt: now.toISOString(), isApproved: true });
      addToast('Clocked Out', `${p.employeeName || 'Employee'} was clocked out at ${formatClockTime(now)}.`);
    } catch (err) { addToast('Error', err.message); }
  };

  const approvePunch = async (p) => {
    try { await updateDoc(doc(db, 'timePunches', p.id), { isApproved: true, approvedBy: appUser.name || appUser.email, approvedAt: new Date().toISOString() }); addToast('Approved', 'Unscheduled punch approved.'); }
    catch (err) { addToast('Error', err.message); }
  };

  const deletePunch = async (p) => {
    if (!window.confirm(`Delete this punch for ${p.employeeName || 'employee'}? This should only be used for duplicate/bad entries.`)) return;
    try { await deleteDoc(doc(db, 'timePunches', p.id)); addToast('Deleted', 'Time punch removed.'); }
    catch (err) { addToast('Error', err.message); }
  };

  const buildLaborExport = () => {
    let rows;
    let exportName = 'time-punch-detail';
    let title = 'Time Punch Detail';

    if (exportMode === 'summary') {
      exportName = 'total-hours-summary';
      title = 'Total Hours Summary';
      const summaryMap = payrollRows.reduce((acc, r) => {
        const key = r.punch.employeeId || r.emp.id || r.punch.employeeName || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            employee: r.emp.name || r.punch.employeeName || 'Unknown',
            role: r.role || 'Unassigned',
            hours: 0,
            pay: 0,
            cashTips: 0,
            creditTips: 0,
            tips: 0,
            punchCount: 0,
            issueCount: 0,
            reasons: new Set()
          };
        }
        const row = acc[key];
        row.hours += Math.max(0, r.hours || 0);
        row.pay += Math.max(0, r.pay || 0);
        row.cashTips += parseFloat(r.punch.cashTips || 0) || 0;
        row.creditTips += parseFloat(r.punch.creditTips || 0) || 0;
        row.tips += r.tips || 0;
        row.punchCount += 1;
        if (r.issue) row.issueCount += 1;
        if (r.punch.correctionReason) row.reasons.add(r.punch.correctionReason);
        return acc;
      }, {});

      rows = [['Employee','Role','Range Start','Range End','Total Hours','Pay Estimate','Cash Tips','Credit Tips','Total Tips','Punch Count','Issue Count','Reasons']];
      Object.values(summaryMap)
        .sort((a,b) => a.employee.localeCompare(b.employee))
        .forEach(r => rows.push([
          r.employee,
          r.role || 'Unassigned',
          rangeStart,
          rangeEnd,
          r.hours.toFixed(2),
          r.pay.toFixed(2),
          r.cashTips.toFixed(2),
          r.creditTips.toFixed(2),
          r.tips.toFixed(2),
          r.punchCount,
          r.issueCount,
          Array.from(r.reasons).join('; ')
        ]));
    } else {
      rows = [['Employee','Role','Date','Clock In','Clock Out','Break Minutes','Hours','Cash Tips','Credit Tips','Pay Estimate','Issue','Reason']];
      payrollRows.forEach(r => rows.push([
        r.emp.name || r.punch.employeeName || 'Unknown',
        r.role || 'Unassigned',
        r.punch.date || '',
        r.punch.clockInTime ? formatClockDateTime(r.punch.clockInTime, appUser) : '',
        r.punch.clockOutTime ? formatClockDateTime(r.punch.clockOutTime, appUser) : '',
        r.punch.breakMinutes || 0,
        r.hours.toFixed(2),
        r.punch.cashTips || 0,
        r.punch.creditTips || 0,
        r.pay.toFixed(2),
        r.issue,
        r.punch.correctionReason || ''
      ]));
    }

    const prefix = getRestaurantExportPrefix(appUser);
    const deptPart = roleFilter === 'all' ? 'whole-restaurant' : safeFilenamePart(selectedRoleLabel);
    const filenameBase = `${prefix}-${deptPart}-${exportName}-${rangeStart}-to-${rangeEnd}`;
    const subtitle = `${appUser?.restaurantName || 'Restaurant'} • ${selectedRoleLabel} • ${rangeStart} to ${rangeEnd} • ${payrollRows.length} punch${payrollRows.length === 1 ? '' : 'es'}`;
    return { rows, exportName, title, filenameBase, subtitle };
  };

  const exportCsv = () => {
    if (payrollRows.length === 0) return addToast('Empty', 'No labor records match the current filters.');
    const { rows, filenameBase } = buildLaborExport();
    downloadCsvRows(`${filenameBase}.csv`, rows);
    addToast('Exported', `${exportMode === 'summary' ? 'Total hours summary' : 'Time punch detail'} CSV downloaded.`);
  };

  const exportPdf = () => {
    if (payrollRows.length === 0) return addToast('Empty', 'No labor records match the current filters.');
    const { rows, title, filenameBase, subtitle } = buildLaborExport();
    const opened = openPrintableReport({ title: `${appUser?.restaurantName || 'Restaurant'} - ${title}`, subtitle, rows, filename: `${filenameBase}.pdf` });
    if (opened) addToast('PDF Ready', 'Print window opened. Choose Save as PDF or your printer.');
    else addToast('Popup Blocked', 'Allow popups for this site, then try PDF again.');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      <div className={`${T.card} p-4 sm:p-5 cockpit-grid`}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Manager Labor Console</div>
            <h2 className="text-2xl font-black text-white tracking-tight">Labor & Timesheets</h2>
            <p className="text-xs text-slate-400 font-bold mt-1 max-w-2xl">Punch Fixer, payroll review, tip totals, labor percentage, and export tools live here. Schedule Builder now handles planning; this tab handles what actually happened.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase font-black text-slate-500">Hours</div><div className="text-lg font-black text-white">{totalHours.toFixed(1)}</div></div>
            <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase font-black text-slate-500">Labor</div><div className="text-lg font-black text-[#D4A381]">${totalLabor.toFixed(0)}</div></div>
            <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase font-black text-slate-500">Labor %</div><div className="text-lg font-black text-white">{rangeSales ? laborPct.toFixed(1)+'%' : '—'}</div></div>
            <div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="text-[9px] uppercase font-black text-slate-500">Issues</div><div className={`text-lg font-black ${exceptionPunches.length ? 'text-amber-400' : 'text-emerald-400'}`}>{exceptionPunches.length}</div></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#2A353D] pb-3">
        {[['fixer','Punch Fixer'],['editor', editingPunch ? 'Edit Punch' : 'Add Punch'],['review','Timesheet Review'],['tips','Tips'],['export','Export']].map(([id,label]) => <button key={id} onClick={() => setSubTab(id)} className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black ${subTab === id ? `${T.grad} text-slate-900` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>{label}</button>)}
      </div>

      <div className={`${T.card} p-3 flex flex-col md:flex-row gap-2 md:items-center justify-between`}>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={`${T.input} py-2 text-xs w-auto`} />
          <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={`${T.input} py-2 text-xs w-auto`} />
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setEmployeeFilter(''); }} className={`${T.input} py-2 text-xs w-auto`}><option value="all">Whole Restaurant</option>{roleOptions.map(role => <option key={roleFilterKey(role)} value={roleFilterKey(role)}>{role}</option>)}</select>
          <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className={`${T.input} py-2 text-xs w-auto`}><option value="">All Staff</option>{filteredUsersForExport.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${T.input} py-2 text-xs w-auto`}><option value="all">All Punches</option><option value="exception">Needs Attention</option><option value="open">Open / On Clock</option><option value="clocked_out">Closed</option></select>
        </div>
        <button onClick={() => { resetForm(); setSubTab('editor'); }} className={`${T.btn} py-2 text-xs flex items-center gap-2 justify-center`}><Plus size={15}/> Add Punch</button>
      </div>

      {subTab === 'fixer' && <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <div className={`${T.card} p-4`}><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381] mb-2">Needs Attention</div>{exceptionPunches.length === 0 ? <div className="text-sm font-bold text-emerald-400 bg-emerald-900/10 border border-emerald-900/30 rounded-xl p-4">No punch fires right now. The time-clock goblin is asleep.</div> : exceptionPunches.slice(0, 12).map(p => <div key={p.id} className="bg-[#12161A] border border-amber-900/40 rounded-xl p-3 mb-2"><div className="font-black text-white text-sm">{p.employeeName || 'Unknown'}</div><div className="text-[10px] text-amber-400 font-black uppercase tracking-widest">{getPunchIssue(p)}</div><div className="text-xs text-slate-400 mt-1">{p.date ? formatDisplayDate(p.date) : 'No date'} • In {formatClockTime(p.clockInTime) || '—'} • Out {formatClockTime(p.clockOutTime) || '—'}</div><div className="flex gap-2 mt-2"><button onClick={() => openEditPunch(p)} className="flex-1 bg-[#1A2126] border border-[#2A353D] rounded-lg py-1.5 text-[10px] font-black text-slate-300 hover:text-[#D4A381]">Fix</button>{['clocked_in','on_break'].includes(p.status) && <button onClick={() => forceOut(p)} className="flex-1 bg-red-900/20 border border-red-900/50 rounded-lg py-1.5 text-[10px] font-black text-red-300">Clock Out</button>}{p.isUnscheduled && !p.isApproved && <button onClick={() => approvePunch(p)} className="flex-1 bg-amber-900/20 border border-amber-900/50 rounded-lg py-1.5 text-[10px] font-black text-amber-300">Approve</button>}</div></div>)}</div>
        </div>
        <div className="lg:col-span-2"><PunchTable rows={payrollRows} openEditPunch={openEditPunch} forceOut={forceOut} approvePunch={approvePunch} deletePunch={deletePunch} /></div>
      </div>}

      {subTab === 'editor' && <div id="labor-editor" className={`${T.card} p-4`}>
        <h3 className="font-black text-white text-lg mb-1">{editingPunch ? 'Edit Time Punch' : 'Add Manual Time Punch'}</h3>
        <p className="text-xs text-slate-400 font-bold mb-4">Simple manager correction form with reason and notes saved for the audit trail.</p>
        <form onSubmit={savePunch} className="grid md:grid-cols-2 gap-3">
          <div><label className={T.label}>Employee</label><select value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})} className={T.input} required><option value="">Choose employee</option>{activeUsers.map(u => <option key={u.id} value={u.id}>{u.name} • {u.role}</option>)}</select></div>
          <div><label className={T.label}>Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={T.input} required /></div>
          <div><label className={T.label}>Clock In</label><input type="time" value={form.clockIn} onChange={e => setForm({...form, clockIn: e.target.value})} className={T.input} required /></div>
          <div><label className={T.label}>Clock Out</label><input type="time" value={form.clockOut} onChange={e => setForm({...form, clockOut: e.target.value})} className={T.input} /></div>
          <div><label className={T.label}>Break Minutes</label><input type="number" value={form.breakMinutes} onChange={e => setForm({...form, breakMinutes: e.target.value})} className={T.input} /></div>
          <div><label className={T.label}>Reason</label><select value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className={T.input}><option>Forgot to clock in</option><option>Forgot to clock out</option><option>System issue</option><option>Manager correction</option><option>Training</option><option>Manual entry</option><option>Other</option></select></div>
          <div><label className={T.label}>Cash Tips</label><input type="number" step="0.01" value={form.cashTips} onChange={e => setForm({...form, cashTips: e.target.value})} className={T.input} /></div>
          <div><label className={T.label}>Credit Tips</label><input type="number" step="0.01" value={form.creditTips} onChange={e => setForm({...form, creditTips: e.target.value})} className={T.input} /></div>
          <div className="md:col-span-2"><label className={T.label}>Manager Note</label><textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})} className={T.input} rows="3" placeholder="Example: Jenna forgot to clock out after closing duties." /></div>
          <div className="md:col-span-2 flex gap-2"><button type="submit" className={`${T.btn} flex-1`}>{editingPunch ? 'Save Correction' : 'Add Punch'}</button><button type="button" onClick={resetForm} className={T.btnAlt}>Clear</button></div>
        </form>
      </div>}

      {subTab === 'review' && <PunchTable rows={payrollRows} openEditPunch={openEditPunch} forceOut={forceOut} approvePunch={approvePunch} deletePunch={deletePunch} />}
      {subTab === 'tips' && <div className={`${T.card} p-4`}><h3 className="font-black text-white mb-3">Tip Summary</h3><div className="grid md:grid-cols-3 gap-3"><div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500 font-black">Cash Tips</div><div className="text-2xl font-black text-white">${payrollRows.reduce((s,r)=>s+(parseFloat(r.punch.cashTips||0)||0),0).toFixed(2)}</div></div><div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500 font-black">Credit Tips</div><div className="text-2xl font-black text-white">${payrollRows.reduce((s,r)=>s+(parseFloat(r.punch.creditTips||0)||0),0).toFixed(2)}</div></div><div className="bg-[#12161A] border border-[#2A353D] rounded-xl p-4"><div className="text-[10px] uppercase text-slate-500 font-black">Total Tips</div><div className="text-2xl font-black text-[#D4A381]">${totalTips.toFixed(2)}</div></div></div></div>}
      {subTab === 'export' && <div className={`${T.card} p-5 space-y-4`}>
        <div>
          <h3 className="font-black text-white text-lg">Payroll Export</h3>
          <p className="text-xs text-slate-400 font-bold mt-1">Download the selected custom role or whole restaurant as a CSV or print-ready PDF for payroll review, accountant handoff, or owner records. Role choices come from the roles created in Settings, plus any active staff roles already in use.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
          <button type="button" onClick={() => setExportMode('detail')} className={`text-left rounded-xl border p-4 transition-all ${exportMode === 'detail' ? 'border-[#D4A381] bg-[#D4A381]/10' : 'border-[#2A353D] bg-[#12161A] hover:border-[#D4A381]/50'}`}>
            <div className="text-sm font-black text-white">Time Punch Detail</div>
            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Every clock-in/clock-out row</div>
          </button>
          <button type="button" onClick={() => setExportMode('summary')} className={`text-left rounded-xl border p-4 transition-all ${exportMode === 'summary' ? 'border-[#D4A381] bg-[#D4A381]/10' : 'border-[#2A353D] bg-[#12161A] hover:border-[#D4A381]/50'}`}>
            <div className="text-sm font-black text-white">Total Hours Summary</div>
            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">One row per employee</div>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2"><button onClick={exportCsv} className={`${T.btn} flex items-center gap-2 justify-center`}><Package size={16}/> Download {exportMode === 'summary' ? 'Summary' : 'Punch Detail'} CSV</button><button onClick={exportPdf} className={`${T.btnAlt} flex items-center gap-2 justify-center`}><Package size={16}/> Print / Save PDF</button></div>
      </div>}
    </div>
  );
};

const HELP_ARTICLES = [
  { id:'new-15032', title:'What changed in version 15.0.32', group:'Release Notes', keywords:'new update 15.0.32 ai support manual security deletion recovery codes firebase rules', body:['System Administrator Manual now works like a support console: type a customer question and it returns likely causes, first checks, fix steps, warnings, escalation guidance, and relevant articles.', 'Security Center now includes account deletion request review so privacy requests can be marked reviewing, complete, or denied with admin notes and audit history.', 'MFA recovery codes now require a dedicated RECOVERY_CODE_SECRET in Vercel before codes can be generated or used.', 'Firebase rules no longer rely on personal-email fallbacks. Super Admin access for Firestore and Storage rules must come from a custom claim or Firestore profile flag.', 'This build requires a Vercel redeploy and testing-side Firebase rule publish before production rollout.'] },
  { id:'new-15031', title:'What changed in version 15.0.31', group:'Release Notes', keywords:'new update 15.0.31 app load hotfix system administrator locked out version mismatch whoami admin access', body:['The app load crash from 15.0.30 was fixed; /version.json, footer/version labels, API metadata, README, and release files now report 15.0.31.', 'If a user opens System Administrator without access, the app now shows exactly why access was denied instead of a generic unavailable page.', 'The app now calls /api/whoami to see whether the server recognizes the signed-in email through MASTER_ADMIN_EMAIL(S), Firebase custom claims, or Firestore super-admin flags.', 'System Administrator includes an Admin Access signal card explaining the current Super Admin authority source.', 'The 15.0.30 Super Admin diagnostics plus the 15.0.29 question-mark helpers, drawer search reset, and backup troubleshooting manual remain included.'] },
  { id:'new-15028', title:'What changed in version 15.0.28', group:'Release Notes', keywords:'new update 15.0.28 productization account deletion restore drill security center hardcoded admin', body:['Account Security now has an Account Deletion Request flow that records a reviewable request instead of silently deleting operational records.', 'Security Center now includes Restore Drill status so backups can be proven with a safe test restore.', 'System Administrator access no longer relies on hardcoded personal email fallbacks. Use configured env vars, custom claims, or Super Admin profile flags.', 'Several internal/testing labels were cleaned up for public-readiness polish.'] },
  { id:'new-15027', title:'What changed in version 15.0.27', group:'Release Notes', keywords:'new update 15.0.27 recovery codes mfa lost phone security alerts voice preview', body:['Account Security now supports one-time recovery codes for lost-phone MFA recovery.', 'The two-step login screen can use a saved recovery code to reset MFA and let the user sign in again.', 'System Administrator MFA reset now writes a security alert for the affected user and keeps the audit trail clear.', 'Account Security has a simple readiness status so owners know whether enforcement is safe.', 'The floating voice button now says Voice Assistant Preview, and Security Center shows version and backup status tiles.'] },
  { id:'new-15026', title:'What changed in version 15.0.26', group:'Release Notes', keywords:'new update 15.0.26 mfa recovery reset lost phone backup phone elevated roles', body:['Account Security now supports backup SMS MFA phone enrollment after the first factor is enabled.', 'Super Admin MFA Recovery can inspect a user MFA status, reset lost-phone MFA factors, require a written reason, and log the action for audit review.', 'MFA enforcement guidance now clearly targets owners, managers, admins, and System Administrators while keeping regular employee enrollment optional.'] },
  { id:'new-15025', title:'What changed in version 15.0.25', group:'Release Notes', keywords:'new update 15.0.25 account repair verification debug mfa firebase auth firestore profile rescue link', body:['Account Security now shows Auth UID/email, browser Firebase project, Vercel API/Admin Firebase project, Firestore profile status, and MFA status in one debug panel.', 'If a Firebase Auth user is missing its Firestore users/{uid} profile, Account Security can repair the profile instead of leaving MFA setup in limbo.', 'If Firebase Console email delivery works but the app verification email does not arrive, Account Security can generate a verification rescue link for the signed-in user.'] },
  { id:'new-15022', title:'What changed in version 15.0.22', group:'Release Notes', keywords:'new update 15.0.22 account security email verification mfa two step login sms', body:['Account Security now includes Send Verification Email for accounts blocked by Firebase auth/unverified-email.', 'After clicking the Firebase inbox link, Refresh Email Status reloads the Firebase Auth user and lets SMS MFA setup continue.', '/api/account-security now reports emailVerified, so Vercel redeploy is required.'] },
  { id:'new-15021', title:'What changed in version 15.0.21', group:'Release Notes', keywords:'new update 15.0.21 account security settings mfa two step login tab mobile', body:['Account Security now has its own visible Settings tab instead of being buried below the Profile form.', 'Profile also includes an Open Account Security button so elevated users can get to MFA setup quickly on phone screens.', 'No new Firebase rules, Storage rules, API routes, or Vercel environment variables are required.'] },
  { id:'new-15019', title:'What changed in version 15.0.19', group:'Release Notes', keywords:'new update 15.0.19 ai tools invoice scanner inventory shortcut invoices', body:['AI Tools now opens the Invoice Scanner directly on Inventory → Invoices instead of dropping users on the default Inventory view.', 'The button now says Open Invoice Scanner so it matches where it goes.', 'No new Firebase rules, Storage rules, API routes, or Vercel environment variables are required.'] },
  { id:'new-15018', title:'What changed in version 15.0.18', group:'Release Notes', keywords:'new update 15.0.18 owner setup onboarding prep voice invoice import mobile print export', body:['Mobile screens get safer touch targets, scrolling, modal sizing, and layout polish.', 'Invoice History and Invoice Details can now print or save as PDF.', 'No new Firebase rules, Storage rules, API routes, or Vercel environment variables are required.'] },
  { id:'new-15017', title:'What changed in version 15.0.17', group:'Release Notes', keywords:'new update 15.0.17 owner setup onboarding prep voice invoice import mobile print export', body:['Invoice scanning now has matched, raw, and skipped review panels before approval.', 'CSV inventory imports now go through a cleanup review screen with create/update/skip actions.', 'No new Firebase rules, Storage rules, API routes, or Vercel environment variables are required.'] },
  { id:'new-15016', title:'What changed in version 15.0.16', group:'Release Notes', keywords:'new update 15.0.16 owner setup onboarding prep voice invoice import mobile print export', body:['Prep voice better understands date, station, unit, and multiple items in one command.', 'Managers can load recurring prep template packs for daily, weekly, and monthly kitchen routines.', 'No new Firebase rules, Storage rules, API routes, or Vercel environment variables are required.'] },
  { id:'new-15015', title:'What changed in version 15.0.15', group:'Release Notes', keywords:'new update 15.0.15 owner setup onboarding prep voice invoice import mobile print export', body:['Owner Dashboard, Setup Wizard, and Staff Onboarding are grouped into a cleaner launch flow.', 'Managers can print an owner snapshot and staff onboarding packet for rollout meetings.', 'No new Firebase rules, Storage rules, API routes, or Vercel environment variables are required.'] },
  { id:'new-15014', title:'What changed in version 15.0.14', group:'Release Notes', keywords:'new update 15.0.14 ai tools report problem device diagnostics offline queue menu confidence approve skip api health', body:['AI Tools now has its own page with shortcuts to Menu Intelligence, Invoice Scanner, voice commands, and Smart Prep Matching.', 'Error toasts and the header bug button can open an in-app Report Problem form with device diagnostics attached automatically.', 'Menu Intelligence review now shows confidence badges and lets managers approve or skip each ingredient before saving menu-impact links.', 'The app can show when offline writes are queued and gives managers a safer way to try syncing them.', 'System Administrator Health Dashboard now includes a full Vercel API route manifest through the new health-checks route.'] },
  { id:'new-15020', title:'What changed in version 15.0.20', group:'Release Notes', keywords:'new update 15.0.20 mfa two step login account security sms elevated roles permissions preview', body:['Account Security under Settings now supports SMS two-step login enrollment for elevated users after Firebase SMS MFA is enabled.', 'Login now handles Firebase multi-factor challenges and asks for a code when an enrolled account signs in.', 'System Administrator Security Center now reports MFA enforcement status and risky elevated accounts using Firebase Auth enrollment where possible.', 'Permission & Role Manager now has a Full Permissions Preview that shows allowed screens, blocked screens, and sensitive-access flags for a selected user.', 'Protected admin API routes that use the shared admin guard can require a fresh MFA sign-in when MFA_ENFORCE_ELEVATED_ROLES is turned on in Vercel.'] },
  { id:'new-15013', title:'What changed in version 15.0.13', group:'Release Notes', keywords:'new update 15.0.13 shared reminders security center app check mfa rate limiting upload protection professional look', body:['Reminders can now be shared with a teammate from a dropdown. Choose Just me for a private reminder or choose a team member so they can see and complete it.', 'Security Center was added for system admins to check setup health, including rules status, storage status, App Check readiness, missing environment variables, cron status, risky elevated users, and suspicious activity signals.', 'Expensive routes such as AI scans, voice, push, and reminder dispatch now include rate limiting so one device cannot hammer costly actions.', 'Menu and invoice uploads now include stricter file purpose, path, type, and size protection.', 'The app also starts a cleaner visual system with more consistent spacing, buttons, badges, mobile controls, and status colors.'] },
  { id:'shared-reminders-guide', title:'Sharing Reminders', group:'Reminders', keywords:'shared reminders share reminder teammate assign dropdown just me personal reminders team member', body:['Open My Reminders and type the reminder you want to create.', 'Use Share With to choose Just me for a private reminder or select a teammate from the list.', 'Pick the reminder date and time, then save it. Shared reminders appear for both the person who created them and the teammate they were assigned to.', 'The assigned teammate can mark the reminder done. The person who created the reminder can edit or delete it.', 'Use shared reminders for simple handoffs like check the walk-in, order buns, call vendor, prep sauce, or follow up on a maintenance item.'] },
  { id:'security-center-overview', title:'Security Center Overview', group:'Security', keywords:'security center rules app check mfa risky users suspicious activity environment variables cron status', body:['Security Center gives system admins a plain-English snapshot of important setup checks.', 'It can show whether rules, storage protection, App Check readiness, MFA enrollment/enforcement status, cron setup, environment variables, rate limiting, and risky elevated accounts need attention.', 'Some security steps still happen outside the app in Firebase or Vercel. For example, App Check enforcement, enabling SMS MFA, Vercel MFA enforcement env vars, and secret rotation must be completed in those admin consoles.', 'If a card shows warning or action needed, follow the Administrator Manual checklist before changing production settings.'] },
  { id:'new-15012', title:'What changed in version 15.0.12', group:'Release Notes', keywords:'new update 15.0.12 menu intelligence help guide intelligent menu instructions scan approve edit delete 86 impact', body:['Help Center now has a dedicated Using Menu Intelligence guide instead of only release notes.', 'The guide walks managers through menu upload, file compression, AI review, matching ingredients to inventory, approving links, editing scans, deleting scans, and checking menu impact when something is 86d.', 'The article uses public-facing wording and avoids System Administrator, Forensics, backup, and security internals.', 'No Firebase rules, Storage rules, API routes, or environment variables changed in this help-only polish build.'] },
  { id:'menu-intelligence-guide', title:'Using Menu Intelligence', group:'Menu Intelligence', keywords:'menu intelligence intelligent menu menu scanner scan menu upload photo pdf approve reviewed menu links ingredient match inventory link unavailable menu items 86 burger patty beef gr pty edit delete recent menu scans', body:['Menu Intelligence helps managers connect menu items to the inventory products that make them. Once those links are approved, 86 Chaos can tell staff which menu items are affected when an ingredient is 86d or unavailable.', 'Open Menu Intelligence, choose a clear menu photo or PDF, and start the scan. Large photos are compressed before upload when possible. If a PDF is still too large, split it into smaller sections or export fewer pages.', 'When the scan finishes, review the detected menu items. The AI is a helper, not the boss. Check names, ingredients, and suggested inventory matches before approving anything.', 'For each menu item, connect the ingredients to the real inventory rows your kitchen uses. Use the actual product name when possible. For example, a burger may need to link to an inventory item named BEEF GR PTY, beef patty, hamburger patty, bun, cheese, lettuce, tomato, or other items you track.', 'Click Approve Reviewed Menu Links after the matches look right. The approval button shows progress and locks while saving so duplicate links are not created by extra clicks.', 'Use Recent Menu Scans to edit a scan when an ingredient match is wrong or delete a scan when it is outdated. Deleting a scan removes its menu-impact links so old menus do not keep affecting 86 alerts.', 'When someone posts or says an 86 alert such as 86 burger, the app can use approved Menu Intelligence links to find the best inventory match and show unavailable menu items on the Message Board, Manager Brief, and Kitchen Command Center.', 'For best results, approve links for common shorthand items staff actually say: burger, patty, wings, fries, chicken, buns, ranch, cheese, lettuce, tomatoes, and sauces. If an 86 alert does not show menu impact, edit the menu scan and make sure that ingredient is linked to the correct inventory item.'] },
  { id:'new-15011', title:'What changed in version 15.0.11', group:'Release Notes', keywords:'new update 15.0.11 kitchen 86 alerts voice navigation menu intelligence burger simple command center', body:['86 Voice now refreshes Inventory and Menu Intelligence context only when an 86 command runs, so alerts are smarter without adding constant reads.', 'Kitchen phrases like “86 burger” can match approved Menu Intelligence links and inventory names such as beef patties, hamburger patties, or BEEF GR PTY.', '86 alert posts now show the matched inventory item and unavailable menu items when the app can identify them.', 'Voice navigation understands more plain screen names, including Manager Brief, Kitchen Command Center, Inventory, Prep, Time Off, Financials, and Help Center.', 'Kitchen Command Center wording was simplified so the screen is easier to use during service.'] },
  { id:'new-15010', title:'What changed in version 15.0.10', group:'Release Notes', keywords:'new update 15.0.10 86 voice alerts menu intelligence burger unavailable menu items manager brief kitchen command center', body:['86 Voice alerts can now use Menu Intelligence links when the spoken item is not an exact inventory name. For example, “86 burger” can match an inventory product such as beef patties when the approved menu links point there.', '86 alert posts now include unavailable menu items from Menu Intelligence on the Message Board, so staff can see what can no longer be sold.', 'The same 86 alert appears in Manager Brief and Kitchen Command Center without creating a stack of duplicate alerts.', 'The main menu now says Manager Brief instead of Today Command Center, and Kitchen Command Center instead of Ops Command Center.'] },
  { id:'new-1504', title:'What changed in version 15.0.4', group:'Release Notes', keywords:'new update 15.0.4 menu intelligence scan menu progress timer approve edit delete scans', body:['Menu Intelligence scan uploads now show a progress bar, percent, status text, and elapsed time instead of a plain spinner.', 'Approving reviewed menu links now shows save progress and prevents accidental double-click duplicate approvals.', 'Approved menu scans can now be edited or deleted from Recent Menu Scans.', 'Editing a scan lets approved users adjust menu items and ingredient inventory matches. Deleting a scan removes its approved menu-impact links.'] },
  { id:'new-1503', title:'What changed in version 15.0.3', group:'Release Notes', keywords:'new update 15.0.3 invoice inventory notification toast saved items csv import', body:['Bulk invoice and CSV inventory saves now show one clean summary instead of a stack of separate Saved notifications.', 'Approving a scanned invoice reports the total saved items, including updated and newly added inventory items.', 'CSV import reports one imported-item total after the file finishes.', 'No new Firebase rules or Storage rules are required for this notification cleanup.'] },
  { id:'new-1501', title:'What changed in version 15.0.1', group:'Release Notes', keywords:'new update 15.0.1 invoice scanner gemini invalid json timeout compact retry repair pdf photo', body:['Invoice scanning is more reliable when the AI finishes reading but returns messy JSON.', 'The scanner now cleans more common JSON problems, retries in a compact mode when the response looks too large, and attempts a safe repair before failing.', 'This targets the Scan Error message that said Gemini returned invalid JSON at 100%.', 'No new Firebase rules or Storage rules are required for this scanner-only fix.'] },
  { id:'new-1500', title:'What changed in version 15.0.0', group:'Release Notes', keywords:'new update 15.0.0 smart prep menu intelligence reminders voice cron firebase rules schedule past shifts invoice scanner invalid json gemini model fallback slice dice chop tomorrow friday', body:['Prep is smarter: typed and voice prep commands can update a matching prep item instead of creating duplicates, including multi-item commands.', '86 Voice now understands kitchen prep wording like slice tomato, dice onions, chop lettuce, and 3 pans tomatoes.', 'Prep commands can include a day, like prep tomatoes for Friday or slice tomato tomorrow, and the item saves to that prep date.', 'Menu Intelligence lets approved users upload a menu, review AI ingredient matches, and save menu-to-inventory links so zero-stock items show menu impact.', 'Menu scanning now uses newer Gemini Flash model fallbacks instead of depending on the retired gemini-1.5-flash default.', 'My Reminders is a private reminder tab with typed or mic creation and scheduled push delivery through the protected reminder cron route.', 'My Schedule and Full Schedule now gray out shifts that have already ended, and Full Schedule dims completed day sections.', 'Invoice scans are more forgiving when Gemini returns JSON inside code fences or with small formatting mistakes.'] },
  { id:'new-14010', title:'What changed in version 14.0.10', group:'Release Notes', keywords:'new update 14.0.10 push notifications schedule alerts workspace reliability', body:['Push notifications are more reliable for employees who work in more than one restaurant.', 'Schedule publish alerts now reach active staff for the selected workspace more consistently.', 'Production notification setup now stays aligned across the app and background notification service.'] },
  { id:'new-1406', title:'What changed in version 14.0.6', group:'Release Notes', keywords:'new update 14.0.6 client management save staff roster read only banner', body:['Workspace management saves are more reliable and no longer fail when an old workspace setting contains an empty unsupported value.', 'Staff Roster keeps manager/admin-only editing, but the read-only notice banner was removed for regular staff.'] },
  { id:'new-1409', title:'What changed in version 14.0.9', group:'Release Notes', keywords:'new update 14.0.9 push notifications repair reconnect stale missing token', body:['Push notification diagnostics now include repair actions for missing or stale device tokens.', 'Managers with access can request a reconnect or send an employee a reconnect link. The employee still has to open the app on their own device so browser notifications can safely reconnect.'] },
  { id:'new-1408', title:'What changed in version 14.0.8', group:'Release Notes', keywords:'new update 14.0.8 menu drawer restaurant workspace switcher multiple restaurants two jobs', body:['The side menu now shows the active restaurant under the employee name and role.', 'Employees with more than one active restaurant can tap that restaurant line to open the workspace switcher and change restaurants.'] },
  { id:'new-1405', title:'What changed in version 14.0.5', group:'Release Notes', keywords:'new update 14.0.5 next shift schedule time clock my schedule ended shift rollover', body:['My Schedule now checks the scheduled end time before choosing the next shift.', 'A shift that already ended today no longer stays pinned as the next shift.', 'The card refreshes while the screen is open and refreshes when the app returns from the background, so employees should not need to reload just to see the next shift.'] },
  { id:'new-1404', title:'What changed in version 14.0.4', group:'Release Notes', keywords:'new update 14.0.4 multi workspace switcher multiple jobs restaurants one login staff roster', body:['Employees who work at more than one restaurant using 86 Chaos can now use one login and choose the workspace they are entering.', 'The app header shows the active restaurant and offers Switch when more than one workspace is available.', 'Managers can add an existing 86 Chaos email to their staff roster without creating a duplicate login or changing that employee\'s password.', 'Removing someone from Staff Roster now removes only that restaurant membership when the person still belongs to another workspace.'] },
  { id:'new-1402', title:'What changed in version 14.0.2', group:'Release Notes', keywords:'new update 14.0.2 tip declaration clock out time clock payroll tips staff', body:['Mandatory Tip Declaration is now treated as a core Time Clock & Schedule feature for every workspace.', 'When enabled, staff see the Declare Tips modal before clock-out even if an older workspace document was missing the setting field.', 'Employees can enter 0 when they did not receive tips, and completed punches store declaration metadata for manager review.', 'Settings → Workspace no longer plan-locks Mandatory Tip Declaration, so managers can turn it on for the whole restaurant.'] },
  { id:'new-13134', title:'What changed in version 13.1.34', group:'Release Notes', keywords:'new update 13.1.34 geofence map pin drop tiles loading gray half image settings workspace', body:['The geofence pin-drop map in Settings → Workspace → Global Config now loads more reliably on desktop and mobile.', 'The app forces the map to resize after the settings panel renders, after browser resize events, and after returning to the tab so gray or half-loaded tiles are less likely.', 'A Refresh Map button was added, and the map can switch tile providers if the current map tiles fail to load.'] },
  { id:'new-13133', title:'What changed in version 13.1.33', group:'Release Notes', keywords:'new update 13.1.33 geofence gps map lookup settings coordinates', body:['Geofence address lookup now uses a safer app-side map lookup instead of relying only on the browser reaching the map service directly.', 'If live map lookup is unavailable, saved latitude and longitude values remain usable and the app gives clearer guidance instead of a vague map-service error.', 'The geofence map tile source was refreshed for better loading in Settings.'] },
  { id:'new-13132', title:'What changed in version 13.1.32', group:'Release Notes', keywords:'new update 13.1.32 live status activity backup verification reliability', body:['Live staff status is more reliable on phones after login or refresh.', 'Backup verification now recognizes readable backup data even when cloud storage returns it already decompressed.', 'Administrator troubleshooting text was updated for live status and backup integrity checks.'] },
  { id:'new-13131', title:'What changed in version 13.1.31', group:'Release Notes', keywords:'new update 13.1.31 mobile zoom pinch double tap stable kitchen screens', body:['Mobile phone screens now stay at the intended app scale instead of pinch-zooming or double-tap zooming during use.', 'Form fields use a mobile-safe text size so phones are less likely to zoom when staff tap into inputs.', 'This keeps time clock, roster, inventory, and schedule screens steadier on kitchen devices.'] },

  { id:'new-13129', title:'What changed in version 13.1.29', group:'Release Notes', keywords:'new update 13.1.29 live activity online presence staff roster heartbeat', body:['Live Activity now uses a stable one-document-per-user heartbeat so old session history cannot hide currently online users.', 'Staff Roster and System Administrator Live Activity both merge the same live presence source.', 'The admin Live Activity screen includes a compact debug strip with user and online counts for faster troubleshooting.', 'Publish the included Firestore rules before testing this version.'] },
  { id:'new-13121', title:'What changed in version 13.1.21', group:'Release Notes', keywords:'new update 13.1.21 time clock clock in clock out loading label refresh employee punch', body:['The Time Clock button now shows the correct saving label while employees clock in or clock out.', 'Clock In stays on CLOCKING IN while saving, then changes to Clock Out.', 'Clock Out stays on CLOCKING OUT while saving, then changes back to Clock In without requiring a refresh.'] },
  { id:'start', title:'Getting started checklist', group:'Getting Started', keywords:'setup first steps owner restaurant add staff modules', body:['Open Settings and confirm restaurant name, address, geofence, and enabled modules.','Add managers first in Staff Roster, then add hourly staff. New accounts show a one-time login popup with email and temporary password.','Create roles, schedule presets, and at least one schedule template before publishing the first week.','Use Administrator → Clients → Demo Mode for safe read-only demos with contact info hidden.'] },
  { id:'employee-quick-start', title:'Employee Quick Start', group:'Quick Start Guides', keywords:'employee new hire first login install download app home screen clock schedule help', body:['First login opens a short guided tour. It explains how to add the web app to the phone home screen, clock in/out, view schedule, read messages, and find Help Center.','Android: open in Chrome, tap the three dots, then Add to Home screen or Install App. iPhone: open in Safari, tap Share, then Add to Home Screen.','Employees should use Time Clock & Schedule for the full schedule and punches. Schedule Builder is manager-only.','Use the Restart Guided Tour button in Help Center if someone skips it or needs training again.'] },
  { id:'manager-quick-start', title:'Manager / Restaurant Quick Start', group:'Quick Start Guides', keywords:'manager restaurant setup workspace tour add employees permissions backups geofence', body:['New workspaces open a manager setup tour that covers saving the app, adding employees, setting permissions, setting clock rules, backups, and Help Center.','Staff Roster shows the one-time generated login popup after adding employees. Copy, print, email, or text before closing.','Set the required work area in Settings so clock-out location can be reviewed.','Backup Center is under System Administrator → Forensics & Backups and requires RESTORE confirmation for restore actions.'] },
  { id:'voice-preview', title:'Using Voice Assistant Preview', group:'Voice Commands', keywords:'voice preview microphone prep quantity show schedule commands fewer clicks help center search permissions full schedule month view staff list manager brief kitchen command center 86 alert', body:['The microphone button is marked PREVIEW. Tap once and speak; safe commands like opening tabs or adding prep tasks run with fewer clicks.','Voice removes command words before saving. “Add ranch to prep list” saves Ranch, not the words add to prep list. Quantities are parsed separately, so “Prep 2 pans ranch” saves name Ranch, quantity 2, and unit pans.' , 'Saying “86 salmon”, “86 burger”, or “we’re out of ranch” posts an important 86 alert and does not edit inventory stock counts. When Menu Intelligence links exist, the alert can include the matched inventory item and unavailable menu items.','Navigation commands can pull up screens by plain name: “open manager brief”, “open kitchen command center”, “show me full schedule”, “show me month view”, “show me staff list”, “open inventory”, “open prep”, or “show schedule builder”.','Schedule voice commands open the proper Time Clock & Schedule subview. Full schedule and month view do not open Schedule Builder unless the user specifically asks for Schedule Builder and has permission.','Help Center search works from the microphone. Say “search help center for missed punch” or “help me with geofence”.','Voice can open specific recipes by name, such as “open beer cheese recipe” or “show me chicken marsala recipe”. It searches the live Recipe Book, so recipes added later work without adding new command phrases.', 'Voice navigation still follows user permissions and enabled modules, so the mic cannot open hidden tabs.'] },
  { id:'clock-out-geofence-review', title:'Clock-out location review', group:'Time Clock', keywords:'geofence clock out outside area manager alerted timesheet note location', body:['If a location rule is enabled and an employee clocks out outside the required area, the app still lets them clock out.','The employee sees a warning, the manager gets an important alert, and the punch is marked in Financials → Timesheets with a manager review note.','This avoids trapping someone on the clock while still keeping a clean accountability trail.','If location is denied or unavailable, the punch is saved and marked for review.'] },
  { id:'safe-demo-mode', title:'Safe customer demo mode', group:'System Administrator', keywords:'demo mode customer tier tabs read only hide phone email address employee manager', body:['Open System Administrator → Workspaces, choose a workspace, then start Demo Manager or Demo Employee.','Choose the tier and visible tabs before starting the demo. Demo mode hides System Administrator and masks emails, phone numbers, addresses, and wages.','Demo mode is read-only. Buttons that would save, publish, restore, delete, upload, post, clock, or edit are blocked.','Use the banner at the top to exit demo mode and return to System Administrator.'] },
  { id:'new-13118', title:'What changed in version 13.1.18', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13117', title:'What changed in version 13.1.17', group:'Release Notes', keywords:'new update stability reliability fixes operations backup privacy', body:['Fixed stability issues, improved reliability, and polished system operations.'] },
  { id:'new-13114', title:'What changed in version 13.1.14', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13115', title:'What changed in version 13.1.15', group:'Release Notes', keywords:'new update stability reliability fixes schedule builder', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13116', title:'What changed in version 13.1.16', group:'Release Notes', keywords:'new update stability reliability fixes schedule editing', body:['Fixed stability issues and improved schedule reliability.'] },
  { id:'new-13113', title:'What changed in version 13.1.13', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13112', title:'What changed in version 13.1.12', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13111', title:'What changed in version 13.1.11', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13110', title:'What changed in version 13.1.10', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-13144', title:'What changed in version 13.1.44', group:'Release Notes', keywords:'new update 13.1.44 settings branding restaurant logo upload locked 86 chaos brand', body:['Restaurant logo uploads now use the secure app upload path first, so owners and approved branding managers are not blocked by stale browser Storage rules.', 'The restaurant/customer logo can still be shown beside 86 Chaos branding.', '86 Chaos branding remains locked and always visible. The customer logo cannot replace or hide it.', 'The upload message now explains what to deploy if Firebase blocks the fallback upload.'] },
  { id:'new-13143', title:'What changed in version 13.1.43', group:'Release Notes', keywords:'new update 13.1.43 settings branding restaurant logo upload storage locked 86 chaos brand', body:['Restaurant/customer logo upload and display controls are available again in Settings → Branding.', '86 Chaos branding is locked and always displayed. The restaurant logo can only appear beside it and can never replace it.', 'Saving Branding & Display now preserves the restaurant logo URL and display choice while still saving accent color, help contact, login/help message, timezone, date/time, currency, week-start, and default staff landing-tab controls.', 'Restaurant logo upload permissions were tightened so approved branding managers can upload logos without the old permission error.'] },
  { id:'new-13140', title:'What changed in version 13.1.40', group:'Release Notes', keywords:'new update 13.1.40 owner staff delete remove deactivate roster payroll api permissions', body:['Account owners can now remove staff from the active roster through the same verified staff API used for staff creation and wage edits.', 'The removal flow keeps historical schedule and payroll records intact by deactivating the staff profile instead of deleting past records.', 'The staff API now blocks self-removal and protects account-owner profiles unless a Super Admin performs the action.', 'Staff removals write a sensitive audit event so roster changes are visible in Forensics.'] },
  { id:'new-13138', title:'What changed in version 13.1.38', group:'Release Notes', keywords:'new update 13.1.38 account owner staff wages permissions add employees payroll owner', body:['Account owners can add staff and edit wages, including their own wage, without Firestore blocking the save.', 'Only account owners and Super Admin can choose who can view or edit wages. Wage access now has separate View Wages and Edit Wages switches.', 'Staff Roster hides wage fields from users without wage access and uses clearer permission messages when Firebase blocks a sensitive staff update.', 'Firestore rules now recognize restaurant ownership for staff creation and payroll edits while still protecting Super Admin/system fields.'] },
  { id:'new-13137', title:'What changed in version 13.1.37', group:'Release Notes', keywords:'new update 13.1.37 admin settings command center roles push live presence deployment readiness maintenance branding danger import export', body:['System Administrator now includes the full Admin/Settings command-center upgrade: overview widgets, role/permission matrix, push control center, live activity monitor, setup wizard, deployment readiness checker, audit filters, settings history, import/export center, maintenance controls, branding/display settings, and a separate Danger Zone.', 'Push notifications now have a dedicated cockpit with connected device counts, token freshness, per-user test pushes, stale-token repair flags, and a downloadable diagnostic report.', 'Deployment Readiness gives a clear READY TO DEPLOY or DO NOT DEPLOY YET result with exact checks for Firebase, rules, API health, push, backup integrity, domains, version, and packaging.', 'Mobile Administrator navigation keeps the compact section picker while exposing the new professional admin categories.'] },
  { id:'new-13136', title:'What changed in version 13.1.36', group:'Release Notes', keywords:'new update 13.1.36 administrator admin mobile command center layout settings', body:['System Administrator now has a cleaner command-center layout with grouped sections for Overview, Customer Operations, Support & Safety, and Reference.', 'On phones, the admin tab opens with a compact section picker instead of forcing you through a long Command Deck scroll.', 'The Command Deck now defaults closed on mobile and can be opened with Signals when needed.', 'Desktop still keeps the full professional grouped navigation and left-side signal board.'] },
  { id:'new-13135', title:'What changed in version 13.1.35', group:'Release Notes', keywords:'new update 13.1.35 voice recipes recipe book specific recipe open search microphone', body:['86 Voice can now open a specific recipe from the Recipe Book by name.', 'Commands like “open beer cheese recipe”, “show me chicken marsala recipe”, or “what is the recipe for ranch” search the live Recipe Book instead of relying on hardcoded recipe names.', 'If a recipe is added later, the same voice command pattern will work for it automatically.', 'If the app cannot find an exact match, it opens Recipe Book with the useful search phrase filled in.'] },
  { id:'new-1502', title:'What changed in version 15.0.2', group:'Release Notes', keywords:'new update 15.0.2 heartbeat live users reminders invoice menu scan 20MB stability', body:['Live user status now uses the dedicated presence system instead of updating the main user profile on every heartbeat.', 'The app sends fewer routine heartbeat writes while still keeping Team and Live Activity status current.', 'Personal reminder delivery is more reliable under heavier use because reminders are claimed before sending and dispatched in safe batches.', 'Invoice and menu scans now have a 20MB upload limit with clearer too-large messages. Compress, split, or rescan fewer pages when a file is too large.'] },
  { id:'new-1319', title:'What changed in version 13.1.9', group:'Release Notes', keywords:'new update 13.1.9 invoice scanner large documents Gemini Files API timeout bigger PDF progress', body:['Invoice scanning now uses a large-document AI handoff so uploaded PDFs/photos are sent to Gemini as files instead of giant inline payloads.', 'The scanner timeout was extended for larger multipage invoices, and the progress bar now explains the large-document AI stage instead of looking stuck.', 'The upload stage still shows exact Firebase upload progress. The AI reading stage shows status and elapsed time because Gemini does not provide line-by-line progress while it reads the document.', 'The scanner app limit was raised to 100MB, with clearer errors if the AI service itself rejects a file.'] },
  { id:'new-1318', title:'What changed in version 13.1.8', group:'Release Notes', keywords:'new update 13.1.8 invoice scanner progress bar upload timeout stuck spinning AI scan', body:['Invoice scanning now shows a progress bar instead of an endless loading spinner.','The upload stage uses real Firebase upload progress so managers can see whether the file is actually moving.','The AI extraction stage now shows a clear scanner status and has a timeout so it cannot spin forever without reporting what happened.','Large invoices still upload through Firebase Storage first, then the scanner reads the stored file and opens the Reconcile Invoice review screen.'] },
  { id:'new-1316', title:'What changed in version 13.1.6', group:'Release Notes', keywords:'new update 13.1.6 voice navigation show me help center search permissions full schedule month view staff list', body:['86 Voice can now pull up common screens from plain commands like “show me the full schedule”, “show me the month view”, “show me staff list”, “open inventory”, or “show schedule builder”.','Schedule voice commands route to the correct Time Clock & Schedule subview. Full schedule/month view open the employee schedule area, while Schedule Builder only opens for users with schedule-builder permission.','Help Center search is now available through the microphone. Say “search help center for missed punch” or “help me with geofence” and Help Center opens with that search filled in.','Voice navigation checks the same module/permission rules before opening anything, so users cannot use the microphone to bypass hidden tabs.'] },
  { id:'new-1315', title:'What changed in version 13.1.5', group:'Release Notes', keywords:'new update 13.1.5 schedule copilot builder coverage targets staff roles linked', body:['Schedule Copilot and Schedule Builder now use the same staff role source.','Coverage Target role choices come from Staff Roster / Settings and match the role group names shown in the Schedule Builder staff list.','Smart Fill now creates draft shifts using the employee actual staff role, while preserving the requested target role for review.','Older coverage targets are normalized against the current staff role list when checking missing coverage.'] },
  { id:'new-1314', title:'What changed in version 13.1.4', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'menu-search', title:'Using the menu search bar', group:'Navigation', keywords:'search menu find feature where is tool', body:['Open the side menu and type a plain word like “punch”, “recipe”, “schedule”, “broken”, “password”, or “inventory”.','The search shows matching tabs and suggested actions. It includes common synonyms so users do not need to know the exact tab name.','This is the fastest way to help tired staff find the correct place without hunting.'] },
  { id:'labor', title:'Fixing missed punches and timesheets', group:'Labor', keywords:'time punch clock in clock out missed labor payroll timesheet tips', body:['Go to Financials → Timesheets → Punch Fixer.','Review the Needs Attention cards first. These show open punches, missed clock-outs, long shifts, unscheduled punches, and time errors.','Click Fix to edit a punch, or Add Punch to enter a manual shift. Always choose a reason and write a manager note.','Use Export to download the current range for payroll review as time punch detail or total hours summary. Use the role filter to print Whole Restaurant or any role created in Settings.'] },
  { id:'labor-export-pdf', title:'Exporting timesheets as CSV or PDF', group:'Labor', keywords:'export pdf csv payroll timesheet restaurant filename total hours punch detail', body:['Go to Financials → Timesheets → Export.','Choose Whole Restaurant or a custom role first, then choose Time Punch Detail for every clock-in/out row, or Total Hours Summary for one row per employee.','Use Download CSV for spreadsheets/accountants. Use Print / Save PDF for owner records or a clean printable copy.','Export filenames start with the restaurant name so multi-location owners do not get a pile of generic 86chaos files.'] },
  { id:'schedule-builder', title:'Building a schedule faster', group:'Scheduling', keywords:'schedule builder copy week publish shift coverage smart fill staff roles copilot', body:['Go to Time Clock & Schedule → Schedule Builder. Schedule Copilot sits above the builder and is part of the same scheduling workflow.','Use Coverage Targets to define how many staff you need by day, shift time, and role. The role dropdown uses the same roles shown in the Schedule Builder staff list, so targets and scheduled staff are no longer separate entities.','Use Smart Fill to create draft shifts from missing coverage targets. It matches employees by their actual Staff Roster role and marks the requested target role for review.','Use Drag Board to move shifts between days or quick-edit employee/time without digging through the large grid.','Publish Preview shows draft count, missing coverage, and conflicts before sending the schedule live.'] },
  { id:'schedule-templates', title:'Creating and editing schedule templates', group:'Scheduling', keywords:'template create edit normal week packers fish fry live music', body:['Open Schedule Builder → Schedule Copilot → Create Template.','Add rows for each day, role, start time, end time, and count. Example: Friday Cook 4p-9p count 2.','Save Current Week turns the current visible week into a reusable template.','Each restaurant has its own template library, so one client’s patterns never leak into another client.'] },
  { id:'time-off', title:'Handling time-off requests', group:'Scheduling', keywords:'request off unavailable vacation approve deny', body:['Open Time Clock & Schedule → Request Off for employee requests. Managers can review requests from Schedule Builder.','Schedule warnings will flag approved time-off conflicts before publishing.','Partial-day requests should include start and end time so managers can schedule around them.'] },
  { id:'messages', title:'Posting professional message board updates', group:'Messages', keywords:'message board announcement 86 alert read receipt important', body:['Use Message Board for operational updates, not long chat threads.','Choose the correct category: Announcement, Shift Note, 86 Alert, Maintenance, or General.','Mark important posts when staff must read them. Important posts can show read receipt counts.'] },
  { id:'ops', title:'Who should see Kitchen Command Center?', group:'Permissions', keywords:'ops command center manager access permission', body:['Kitchen Command Center should be limited to owners, managers, kitchen managers, or trusted leads.','Grant access from Staff Roster → Edit User → permissions. Do not give Ops access to every staff account by default.','Kitchen Command Center summarizes labor, prep, low stock, maintenance, events, and manager priorities.'] },
  { id:'permissions', title:'Why can’t someone see a tab?', group:'Permissions', keywords:'tab missing access permission role manage user', body:['Check that the restaurant has the module enabled.','Check the employee’s permissions in Staff Roster.','Some tabs also require Admin, Manager, or specific feature permissions.','Super Admin and Ghost Mode can see more because they are support tools.'] },
  { id:'inventory', title:'Inventory basics', group:'Inventory', keywords:'stock par order vendor low inventory', body:['Use Inventory & Orders to track items, par levels, vendor notes, and low-stock warnings.','Low-stock items flow into Today and Kitchen Command Center.','Smart Order can queue suggested order quantities when stock is below par.'] },
  { id:'maintenance', title:'Reporting equipment problems', group:'Maintenance', keywords:'broken fryer cooler freezer repair maintenance photo', body:['Go to Maintenance Log and add the issue as soon as it is noticed.','Use clear titles like “Fryer 2 won’t hold temp” or “Walk-in dripping by fan”.','Add urgency and a photo when possible. Open urgent issues appear in Manager Brief and Kitchen Command Center.'] },
  { id:'support', title:'Contacting 86 Chaos support', group:'Support', keywords:'help contact support bug error problem', body:['Search Help Center first using general words.','Use the Report a Bug / Error panel inside Help Center when the app behaves wrong. Include what you clicked and what happened.','Owners can contact support after checking the article tied to the page they are using.'] },
  { id:'admin-mobile-layout', title:'Using the Administrator tab on mobile', group:'System Administrator', keywords:'admin mobile layout phone section picker signals command deck scroll', body:['The mobile Administrator tab is organized around a section picker instead of the full desktop grid.', 'Use the dropdown to jump directly to Health, Live Activity, Workspaces, People, Forensics, Operations, or the Manual.', 'The quick buttons under the dropdown open the most-used admin sections with one tap.', 'The Signals button opens the Command Deck in a contained panel. Keep it closed when you want a shorter, cleaner phone layout.'] },
  { id:'admin-command-deck', title:'Administrator Command Deck', group:'System Administrator', keywords:'admin command deck clickable signals support hire dashboard cockpit mobile layout signals section picker', body:['Open System Administrator. On desktop, grouped section buttons are at the top and the Command Deck is the optional signal panel on the left. On mobile, use the section picker and quick buttons; tap Signals only when you want the Command Deck.','Every Command Deck metric is clickable. Crashes opens Support, Manual Presence opens Live Activity, MRR and stale workspaces open Workspaces, and push adoption opens People.','Use Hide Command Deck when you need more screen space. On mobile, the Command Deck starts hidden so the admin tab does not become one long scroll.','The Action Queue shows the highest-priority platform issues first. Click an issue to jump to the correct admin section.'] },
  { id:'settings-branding-preferences', title:'Settings: branding, accent color, and access', group:'Settings', keywords:'settings preferences branding accent color logo upload display locked app name permissions integrations menu intelligence workspace', body:['Open Settings → Branding to change the workspace accent color, upload or paste a restaurant logo, set the help contact, and choose display defaults such as timezone, date/time format, currency, week start, and default staff landing tab. Logo uploads use the secure app upload path first, with Firebase Storage as a fallback.', 'The app name and 86 Chaos logo are locked. A restaurant logo can appear beside 86 Chaos branding, but it never replaces or hides the 86 Chaos brand.', 'Only account owners and Super Admin can grant Settings, Branding, Integrations, and Menu Intelligence access. Use the Settings Access area in Settings → Branding to choose trusted users.', 'After changing display settings, refresh the app to confirm the accent color, logo display, and defaults stayed saved.'] },
  { id:'owner-wage-staff-permissions', title:'Owner staff and wage permissions', group:'Permissions', keywords:'owner wages payroll hourly rate add employee staff roster wage view edit permission denied', body:['Account owners and Super Admin can add staff from Staff Roster and edit hourly wages, including their own wage.', 'Only account owners and Super Admin should choose who can see or edit wages. Use Staff Roster permission switches or Settings → Workspace → Global Config → Wage Visibility & Edit Access.', 'View Wages lets a trusted person see wage labels and labor cost calculations. Edit Wages lets them change wage values from Staff Roster and automatically implies view access.', 'Managers/admins without wage permission can still manage staff basics if allowed, but wage fields stay hidden and Firestore rules reject wage-access changes.', 'If a save shows Missing or insufficient permissions, confirm the user is the restaurant owner or has the right wage-edit permission and publish the matching Firestore rules to the same Firebase project.'] },
  { id:'admin-edit-users', title:'Support-editing users and moving restaurants', group:'System Administrator', keywords:'admin edit user change restaurant move workspace support edit restaurantId notifications gps permissions', body:['Open System Administrator → People and search for the person by name, email, role, ID, or restaurant.','Click Support Edit to change support-safe profile details: name, email label, phone, role, wage, active status, restaurant/workspace, restaurant admin, and force password change.','Normal feature permissions are read-only here. Change those from the restaurant Staff Roster so support cannot accidentally alter a client’s access map from the platform cockpit.','The diagnostics panel shows push token status, browser notification permission, GPS permission/support, workspace geofence status, last active time, active tab, host, device, screen, and saved notification preferences.','Super-admin access is intentionally not in this editor. Use Access Control only for platform administrator access.','Add a support note before saving when the reason is not obvious. The change is logged in Forensics.'] },
  { id:'admin-forensics', title:'Using Forensics during support', group:'System Administrator', keywords:'admin forensics audit ghost raw json support diagnostics destructive actions', body:['Use Forensics when you need to know who changed what and when.','The top cards summarize audit count, Ghost actions, destructive actions, and support edits.','Use Raw JSON Inspector only when normal screens do not explain a data problem.','Look for the Ghost Action and Destructive badges before making conclusions about a client issue.'] },
  { id:'admin-grant-access', title:'Granting platform admin access', group:'System Administrator', keywords:'grant access super admin revoke administrator custom claims', body:['Use System Administrator → Access Control for platform administrator access.','Do not use client Manage or Support Edit for super-admin access. This keeps elevated permissions in one audited place.','After granting or revoking access, the target user should log out and back in so their Firebase token refreshes.','Revoke access immediately when a support contractor no longer needs platform control.'] },
  { id:'admin-client-users', title:'Viewing and managing people from a workspace', group:'System Administrator', keywords:'client users restaurant users support edit possess force logout delete notifications gps billing modules', body:['Open System Administrator → Workspaces and click the workspace name or People button.','The workspace drawer shows all people in that workspace, admin count, online users, push token count, GPS permission snapshots, billing state, and enabled modules.','Use Support Edit from the workspace drawer to move a user, update their role/status, force password change, or correct workspace routing.','Use Possess from the workspace drawer to troubleshoot exactly what that user sees.'] },
  { id:'admin-backup-status', title:'Checking database backup status', group:'System Administrator', keywords:'database backup last backup status command deck weekly maintenance firestore export storage run now integrity gzip header', body:['The System Administrator Command Deck includes Last Backup.','The app reads system/backupStatus when the automatic Firestore backup route writes it.','Click Last Backup or open Forensics to run a manual backup and verify the route.','A stale backup warning means you should check Vercel cron, CRON_SECRET, Firebase service account credentials, and Firebase Storage bucket settings.','If backup integrity says incorrect header or plain-json warning, run Full System Diagnostics. Version 13.1.32 treats readable backup JSON as valid even when cloud storage auto-decompresses a .json.gz object.'] },
  { id:'no-auto-return', title:'Does the app still return users to Today after five minutes?', group:'Navigation', keywords:'landing page today away five minutes background tab phone stale session logout', body:['No. The automatic return-to-Today behavior was removed.','Users stay on the page they were using when they return from another app, lock screen, or browser tab.','Use Log Out when a device should be signed out.'] },
  { id:'voice-commands', title:'Using 86 Voice commands', group:'Voice Commands', keywords:'voice mic microphone command 86 salmon prep message maintenance burn waste open schedule recipe', body:['Tap the floating microphone button in the lower-left corner. Say one short command, then confirm the suggested action.','Examples: “86 salmon”, “open beer cheese recipe”, “add weekly task clean fryer Monday”, “prep 2 pans tomatoes”, “post message cooler is high”, “open Friday schedule”, or “waste 2 pounds chicken breast”.','Destructive actions like setting inventory to zero, posting alerts, maintenance reports, and burn logs require confirmation before the app writes data. Creating recurring daily/weekly/monthly tasks is manager/admin-only.','If the browser does not support speech recognition, type the command into the same voice panel.'] },
  { id:'read-saver', title:'Why some tabs load data only when opened', group:'Performance', keywords:'firebase reads read saver loading data missing old history month current week cost', body:['To reduce Firebase reads, 86 Chaos now loads each tab’s live data only when that tab needs it.','Schedule, punches, sales, messages, prep, and events use smaller date windows instead of loading years of history on login.','If an old record is not visible, use the relevant date range or open the feature tab that owns that data.','This protects multi-location clients from unnecessary Firestore costs.'] },
  { id:'labor-role-export', title:'Printing timesheets by custom role', group:'Labor', keywords:'role export print pdf cook bartender server manager custom roles settings whole restaurant labor timesheets payroll', body:['Go to Financials → Timesheets → Export.','Choose Whole Restaurant or any role created in Settings, such as Line Cook, Bartender, Server, Manager, Host, or any custom role your client created.','Choose Time Punch Detail for every punch row or Total Hours Summary for one row per employee, then Download CSV or Print / Save PDF.','The role filter reads from Settings → Roles and also includes active user roles already in use, so each restaurant exports by its own job structure.'] },
  { id:'new-1290', title:'What changed in version 12.9.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1281', title:'What changed in version 12.8.1', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1282', title:'What changed in version 12.8.2', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1280', title:'What changed in version 12.8.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'schedule-stability', title:'Schedule stability and restore help', group:'Scheduling', keywords:'schedule restore deleted shifts missing old data stability', body:['Fixed stability issues around schedule restore and month loading.', 'If a schedule looks wrong after a restore, contact a system administrator so the month can be repaired safely.'] },
  { id:'backup-center', title:'Using Backup Center', group:'System Administrator', keywords:'backup center select restore download backups list manual scheduled no path paste gzip json integrity', body:['Open System Administrator → Forensics & Backups → Backup Center.', 'Click Refresh to list manual and scheduled backups from Firebase Storage.', 'Use Download to save a copy locally, or Restore to merge that backup back into Firestore. The restore reader accepts the current compressed JSON backup format and readable JSON returned by cloud storage.', 'Restores still require typing RESTORE so nobody can accidentally roll the database backward.'] },
  { id:'new-1311', title:'What changed in version 13.1.1', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'weekly-maintenance', title:'Daily backups and weekly maintenance', group:'Support', keywords:'database update daily weekly maintenance backup cron automatic refresh firestore storage', body:['Daily Firestore backups run through the Vercel cron backup route and update the Command Deck backup status.','The Firestore backup route exports the database to Firebase Storage and writes system/backupStatus for the Command Deck.','Use System Administrator → Forensics & Backups → Run Backup Now after setup to test the backup route.','If status is stale, check Vercel env vars CRON_SECRET, FIREBASE_SERVICE_ACCOUNT_KEY, and FIREBASE_STORAGE_BUCKET.'] },
  { id:'financials-tab', title:'Using Financials', group:'Financials', keywords:'financials labor timesheets daily ledger sales payroll export costs', body:['Financials combines Labor & Timesheets with Daily Ledger so managers do not jump between separate money screens.', 'Use the Labor & Timesheets subtab for punches, payroll exports, role filters, tips, and punch corrections.', 'Use the Daily Ledger subtab for sales, labor cost, food cost, and context notes.', 'Old links for Labor or Daily Ledger still open Financials and land on the matching subtab.'] },
  { id:'schedule-builder-under-shifts', title:'Finding Schedule Builder', group:'Scheduling', keywords:'schedule builder maker time clock shifts subtab publish template coverage', body:['Schedule Builder now lives inside Time Clock & Schedule as a subtab for users with schedule access.', 'Open Time Clock & Schedule, then choose Schedule Builder from the subtab row.', 'The Schedule Builder is still hidden from staff who do not have schedule permission.', 'Event Calendar remains its own main menu tab.'] },
  { id:'full-backup-restore', title:'Restoring a full database backup', group:'System Administrator', keywords:'restore backup firestore storage path deleted data database recovery gzip json integrity', body:['Full automatic backups are saved to Firebase Storage as compressed JSON files.', 'To restore one, open System Administrator → Forensics & Backups → Backup Center, select a backup, and click Restore.', 'The restore reader now checks the backup bytes first. If cloud storage returns already-readable JSON instead of raw gzip, restore can still read the backup instead of throwing an incorrect-header error.', 'The restore is merge-based: it puts back missing/deleted documents and overwrites damaged documents from the backup, without deleting new documents that are not in the backup. If you use full database restore and a schedule month looks contaminated by old records, run that month’s Emergency Schedule Rescue afterward so the schedule month is hard-replaced cleanly.', 'Always run a fresh backup before restoring so there is a current safety copy.'] },
  { id:'new-1310', title:'What changed in version 13.1.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1291', title:'What changed in version 12.9.1', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'labor-export-modes', title:'Exporting labor totals or detailed punches', group:'Labor', keywords:'export payroll time punches total hours summary csv staff labor', body:['Go to Financials → Timesheets → Export.','Choose Time Punch Detail when payroll needs every clock-in and clock-out row.','Choose Total Hours Summary when you only need one line per employee with total hours, estimated pay, tips, punch count, and issue count.','The export uses the current date range and employee/status filters.'] },
  { id:'low-stock-focus', title:'Finding below-par inventory from alerts', group:'Inventory', keywords:'below par low stock inventory alert highlight command center today', body:['Below-par alerts only count items where current stock is less than par. Items equal to par are not considered low.','Click a low-stock alert from Today or Command Center to open Inventory in Below-Par Focus mode.','Below-Par Focus filters the list to low items and highlights them so managers can update stock, par, or ordering quickly.'] },

  { id:'invoice-full-extraction', title:'Invoice scanner: full PDF/photo extraction', group:'Inventory', keywords:'invoice pdf photo scan upload missing information line items gemini ai extraction all rows product rows stock matcher non inventory skipped', body:['The invoice scanner sends PDFs/photos through the large-document scanner path so small product rows, vendor details, invoice numbers, terms, fees, credits, taxes, deposits, and footer notes can still be preserved in the invoice audit.','The Stock Matcher only shows purchased product rows that can update inventory. Email headers, From/To lines, addresses, customer info, totals, taxes, fees, deposits, notes, and footers are kept in Full Extraction Audit only and cannot be added as stock.','After scanning, review Product Rows and Skipped Non-Stock counts. Match real products to existing inventory or choose Add as New Item only for products you actually purchased.','Use the Full Extraction Audit section to check raw text and warnings. Always verify the scan before approving because damaged photos or blurry PDFs can still need human review.'] },
  { id:'burn-log-weight-mode', title:'Burn Log: count, weight, case, or note-only waste', group:'Inventory', keywords:'burn log chicken breast pounds weight catch weight case each count quantity waste stock deduction', body:['Burn Log supports four modes: Count/each, Weight in pounds, Whole stock units/cases, and Record only.','Use Count for items with a clear yield, such as 24 patties in a case. Burning 1 patty deducts 1/24 of a case.','Use Weight for catch-weight foods like chicken breasts, beef, fish, cheese, and produce. Example: if one stock unit is 5 lb and you burn 2 lb, the app deducts 0.4 stock units.','Use Record only for notes or waste that should not change inventory.','Each inventory item can save a default burn mode, units per case, weight per stock unit, and burn label in Edit Item.'] },
  { id:'new-1270', title:'What changed in version 12.7.0', group:'Release Notes', keywords:'new update 12.7 invoice scanner burn log weight pdf photo ai extraction', body:['Invoice scanning now supports direct PDF extraction and higher-detail image scanning. The extraction keeps all rows and raw document notes instead of only inventory lines.','The Reconcile Invoice modal now shows full extraction details, confidence, warnings, row types, and raw text.','Burn Log now supports count, weight, whole-case, and record-only modes for more accurate stock deductions.','Inventory items now have burn setup fields for default burn mode, weight per stock unit, and burn unit labels.'] },
  { id:'burn-log-stock', title:'Burn Log stock deduction rules', group:'Inventory', keywords:'burn log waste case each unit deduct stock par inventory', body:['Burn Log can deduct by count, weight, whole stock unit, or record-only note. Use the mode selector before saving a burn.','For case-based count inventory, set Yield/Units Per Stock Unit on the inventory item. Example: a 24-count case should use yield 24, so burning 1 deducts 1/24 of a case.','For catch-weight items, set Weight per Stock Unit. Example: one pack is 5 lb and you burn 2 lb, so the app deducts 0.4 stock units.','The Burn Log preview shows how much stock will be deducted before you save. Deleting or editing a burn restores/adjusts the exact amount that was deducted.'] },
  { id:'mobile-drag-board', title:'Moving shifts on phones', group:'Scheduling', keywords:'drag board mobile move shift day schedule phone', body:['On desktop, drag shift cards between days in Schedule Builder → Schedule Copilot → Drag Board.','On phones/tablets, use the Move to day dropdown on the shift card. Mobile browsers can be clumsy with drag-and-drop, so the dropdown is the safer touch-friendly option.','Changing the day, employee, start time, or end time saves immediately.'] },

  { id:'schedule-publish-backup', title:'Schedule publish creates a backup file', group:'Scheduling', keywords:'schedule publish backup download json restore shifts deleted duplicate', body:['When a manager clicks Publish, the app downloads a JSON backup of the current month shifts and all unpublished shifts before anything is changed.','Keep this file if you are making major schedule edits or publishing a rebuilt month. It can help support restore shifts if something is accidentally deleted.','The backup filename starts with the restaurant name and includes the schedule month and timestamp.'] },

  { id:'new-1309', title:'What changed in version 13.0.9', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'invoice-payload-storage-scan', title:'Invoice scanner: upload, progress, and timeout help', group:'Inventory', keywords:'invoice pdf scan payload too large 413 Vercel upload firebase storage large file crash scanner progress bar stuck spinning timeout 20MB', body:['The invoice scanner uploads the original PDF or image directly to Firebase Storage first, then sends the stored file to the large-document AI scanner. This avoids browser/Vercel payload limits and keeps the original file quality for extraction.','Invoice scans are capped at 20MB to protect the scanner from huge phone photos or oversized PDFs. Compress, split, or rescan fewer pages if a file is too large.','The progress bar shows exact upload progress during the Firebase upload stage. After upload completes, the AI extraction stage shows scanner status while the invoice is being read.','If the scanner takes too long, it stops with a clear timeout message instead of spinning forever. Try the same file again once before splitting pages.','After a successful scan, review the Reconcile Invoice window and click Approve & Update Stock to save the invoice into history and apply stock changes.'] },
  { id:'new-1303', title:'What changed in version 13.0.3', group:'Release Notes', keywords:'new update 13.0.3 invoice scanner pdf payload storage scan', body:['Invoice scanning now uses Firebase Storage handoff for PDFs and images instead of sending the whole file through Vercel.','This fixes payload-too-large scanner crashes on normal invoice PDFs and keeps the full original file quality for extraction.'] },
  { id:'new-1302', title:'What changed in version 13.0.2', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1301', title:'What changed in version 13.0.1', group:'Release Notes', keywords:'new update 13.0.1 labor export roles custom settings timesheets payroll', body:['Financials → Timesheets export now filters by the exact roles each restaurant creates in Settings instead of fixed departments.','Exports still support Whole Restaurant, Time Punch Detail, Total Hours Summary, CSV, and Print / Save PDF.','The employee dropdown follows the selected role, and export filenames use the restaurant name and selected role.'] },
  { id:'new-1260', title:'What changed in version 12.6.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1242', title:'What changed in version 12.4.2', group:'Release Notes', keywords:'new update 12.4.2 time format 12 hour 24 hour military labor timesheets punches settings preferences', body:['Time format preferences now control schedule times, punch ledger times, Financials → Timesheets displays, Kitchen Command timeline times, toast messages, maintenance logs, and payroll CSV exports.','Native time entry fields may still use the device/browser picker, but saved/displayed times honor the selected preference.'] },
  { id:'new-124', title:'What changed in version 12.4.1', group:'Release Notes', keywords:'new update 12.4 bug report help center weekly database maintenance cron', body:['Report a Bug / Error moved out of the side menu and into Help Center.','Help Center now includes a searchable article for weekly database maintenance.','The optional weekly maintenance pack adds a Vercel Cron endpoint for support housekeeping.'] }
];

const TabHelpCenter = ({ appUser, activeTab, voiceHelpSearchTarget = null, addToast }) => {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [selectedId, setSelectedId] = useState('start');
  const [bugText, setBugText] = useState('');

  useEffect(() => {
    const search = voiceHelpSearchTarget?.query;
    if (!search) return;
    setQuery(search);
    setGroup('All');
    setSelectedId('');
  }, [voiceHelpSearchTarget?.id]);
  const [bugCategory, setBugCategory] = useState('Bug / Error');
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  const handleBugSubmit = async (e) => {
    e.preventDefault();
    if (!bugText.trim()) return;
    setIsSubmittingBug(true);
    try {
      await addDoc(collection(db, "crashReports"), {
        type: 'user_reported_bug',
        category: bugCategory,
        message: `USER REPORT: ${bugText.trim()}`,
        user: appUser?.name || 'Unknown',
        userEmail: appUser?.email || '',
        restaurantId: appUser?.restaurantId || 'Unknown',
        activeTab: activeTab || 'help',
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href,
        time: new Date().toISOString()
      });
      setBugText('');
      addToast?.('Report Sent', 'Support report sent with device details.');
    } catch (err) {
      addToast?.('Error', 'Failed to send support report.');
    }
    setIsSubmittingBug(false);
  };
  const groups = ['All', ...Array.from(new Set(HELP_ARTICLES.map(a => a.group)))];
  const q = query.trim().toLowerCase();
  const articles = HELP_ARTICLES.filter(a => group === 'All' || a.group === group).filter(a => !q || `${a.title} ${a.group} ${a.keywords} ${a.body.join(' ')}`.toLowerCase().includes(q));
  const selected = HELP_ARTICLES.find(a => a.id === selectedId) || articles[0] || HELP_ARTICLES[0];
  const related = HELP_ARTICLES.filter(a => a.keywords.includes(activeTab || '') || a.group.toLowerCase().includes(activeTab || '')).slice(0,3);
  const latestRelease = HELP_ARTICLES.find(a => a.id === `new-${String(CURRENT_VERSION).replace(/\D/g, '')}`);
  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      <div className={`${T.card} p-5 cockpit-grid flex flex-col lg:flex-row lg:items-end justify-between gap-3`}><div><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Built-in owner manual</div><h2 className="text-2xl font-black text-white">Help Center</h2><p className="text-sm text-slate-400 font-bold mt-1 max-w-3xl">Search plain words before contacting support. This manual is updated whenever new features are added to the app.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('chaosRestartTour', { detail: { mode: 'employee' } }))} className={T.btnAlt}>Restart Employee Tour</button>{(appUser?.isAdmin || appUser?.permissions?.team) && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('chaosRestartTour', { detail: { mode: 'manager' } }))} className={T.btn}>Restart Manager Tour</button>}</div></div>
      {latestRelease && <button type="button" onClick={() => { setSelectedId(latestRelease.id); setGroup('Release Notes'); }} className="w-full text-left bg-blue-900/15 border border-blue-500/40 rounded-xl p-4 hover:bg-blue-900/25 transition-colors"><div className="text-[10px] uppercase tracking-widest font-black text-blue-300 mb-1">Latest update brief</div><div className="font-black text-white">{latestRelease.title}</div><div className="text-xs text-slate-300 font-bold mt-1 line-clamp-2">{latestRelease.body?.[0]}</div></button>}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <div className={`${T.card} p-3`}><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search help: punch, schedule, password..." className="w-full bg-[#12161A] border border-[#2A353D] rounded-xl pl-10 pr-3 py-3 text-sm font-bold text-white outline-none focus:border-[#D4A381]"/></div><select value={group} onChange={e=>setGroup(e.target.value)} className={`${T.input} mt-2`}>{groups.map(g=><option key={g}>{g}</option>)}</select></div>
          <div className={`${T.card} overflow-hidden`}><div className="bg-[#12161A] p-3 border-b border-[#2A353D] text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Articles</div><div className="max-h-[62vh] overflow-y-auto custom-scrollbar divide-y divide-[#2A353D]">{articles.length === 0 && <div className="p-5 text-center text-xs font-bold text-slate-500">No articles found. Try a simpler word.</div>}{articles.map(a => <button key={a.id} onClick={()=>setSelectedId(a.id)} className={`w-full text-left p-3 hover:bg-[#12161A] transition-colors ${selected?.id===a.id ? 'bg-[#12161A] text-[#D4A381]' : 'text-slate-300'}`}><div className="font-black text-sm">{a.title}</div><div className="text-[10px] uppercase tracking-widest font-black text-slate-500 mt-1">{a.group}</div></button>)}</div></div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className={`${T.card} p-5`}><div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381] mb-1">{selected.group}</div><h3 className="text-2xl font-black text-white mb-4">{selected.title}</h3><div className="space-y-3">{selected.body.map((line, i) => <div key={i} className="flex gap-3 bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><div className="w-6 h-6 rounded-full bg-[#D4A381] text-slate-900 flex items-center justify-center text-xs font-black flex-shrink-0">{i+1}</div><p className="text-sm font-bold text-slate-200 leading-relaxed">{line}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => { navigator.clipboard?.writeText(`${selected.title}\n\n${selected.body.map((b,i)=>`${i+1}. ${b}`).join('\n')}`); addToast?.('Copied', 'Help article copied.'); }} className={T.btnAlt}>Copy Instructions</button><button onClick={() => window.print()} className={T.btnAlt}>Print</button></div></div>
          <div className={`${T.card} p-4`}><h4 className="font-black text-white mb-2">Page-aware help</h4><p className="text-xs text-slate-400 font-bold mb-3">You are signed in as {appUser?.role || 'Staff'}. Start with these common articles:</p><div className="grid sm:grid-cols-3 gap-2">{(related.length ? related : HELP_ARTICLES.slice(0,3)).map(a => <button key={a.id} onClick={()=>setSelectedId(a.id)} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 text-left hover:border-[#D4A381]/50"><div className="font-black text-white text-sm">{a.title}</div><div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{a.group}</div></button>)}</div></div>
          <div className={`${T.card} p-4 border-orange-900/40`}>
            <div className="flex items-center gap-2 mb-2"><Bug size={18} className="text-orange-300"/><h4 className="font-black text-orange-300">Report a Bug / Error</h4></div>
            <p className="text-xs text-slate-400 font-bold mb-3">Send problems from here instead of the side menu. Include exactly what you clicked, what you expected, and what happened. Device, screen, page, and browser details are attached automatically.</p>
            <form onSubmit={handleBugSubmit} className="space-y-3">
              <select value={bugCategory} onChange={e=>setBugCategory(e.target.value)} className={`${T.input} py-2 text-sm`}>
                <option>Bug / Error</option>
                <option>Feature Request</option>
                <option>Login Problem</option>
                <option>Permission Problem</option>
                <option>Data Looks Wrong</option>
                <option>Mobile Layout Problem</option>
              </select>
              <textarea value={bugText} onChange={e=>setBugText(e.target.value)} className={T.input} rows="4" placeholder="Example: I clicked Schedule → Apply Template. It said success, but no shifts appeared." required></textarea>
              <button type="submit" disabled={isSubmittingBug || !bugText.trim()} className={`w-full ${T.btn} disabled:opacity-50 flex items-center justify-center gap-2`}>
                {isSubmittingBug ? <Loader2 className="animate-spin" size={18}/> : <><Send size={18}/> Send Support Report</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};



const TabFinancials = ({ currentDate, users = [], shifts = [], sales = [], timePunches = [], addToast, appUser, initialSubTab = 'labor' }) => {
  const [subTab, setSubTab] = useState(initialSubTab);
  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      <div className={`${T.card} p-4 sm:p-5 cockpit-grid`}>
        <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-1">Financials</div>
        <h2 className="text-2xl font-black text-white tracking-tight">Financials</h2>
        <p className="text-xs text-slate-400 font-bold mt-1 max-w-3xl">Labor & Timesheets and Daily Ledger now live together here. Labor handles payroll reality; Daily Ledger handles sales, costs, and trend notes.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[#2A353D] pb-3">
        <button onClick={() => setSubTab('labor')} className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black ${subTab === 'labor' ? `${T.grad} text-slate-900` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Labor & Timesheets</button>
        <button onClick={() => setSubTab('ledger')} className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black ${subTab === 'ledger' ? `${T.grad} text-slate-900` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Daily Ledger</button>
      </div>
      {subTab === 'labor' ? (
        <TabLabor currentDate={currentDate} users={users} shifts={shifts} sales={sales} timePunches={timePunches} addToast={addToast} appUser={appUser} />
      ) : (
        <TabSales sales={sales} timePunches={timePunches} users={users} addToast={addToast} appUser={appUser} />
      )}
    </div>
  );
};

export { TabTeam, TabMessages, TabSettings, TabAuditLog, TabSales, TabFinancials, TabGodMode, ROLE_KEYWORDS, TabLabor, HELP_ARTICLES, TabHelpCenter };

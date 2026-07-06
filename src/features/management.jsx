import React, { useState, useEffect } from 'react';
import { Bell, Check, Camera, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, X, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, Edit, Moon, Sun, TrendingUp, BookOpen, Search, ChefHat, Scale, Coffee, Star, Bug, Wrench, Globe, ThumbsUp } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { T, db, storage, auth, messaging, firebaseConfig, secureFetch, MASTER_ADMIN_EMAIL, EVENT_TAGS, CURRENT_VERSION, useLiveCollection, formatDate, getToday, getMonthStr, formatDisplayDate, formatDisplayFullDate, formatDisplayMonth, getDaysInMonth, formatShortTime, formatClockTime, formatClockDateTime, getAvatar, generateTempPass, getExpDate, getHoliday, logAudit, customMapIcon, getRestaurantExportPrefix, safeFilenamePart, downloadCsvRows, downloadTextFile, openPrintableReport } from '../core/appCore';
import { CheersLogo, Modal, DrawerMenu, DayDotPrintScreen, MapClickListener, SmartEmptyState, MiniProblemCard, getHomeProfile, calculatePunchHours, getWeekStart, getWeekDates, roleMatches, toLocalTimeInput, makeLocalIso, PunchTable, StatusTile, FriendlyEmpty, GlobalSearchModal, QuickActionDock, KitchenTVMode, ChangeLogModal, UndoBar } from '../components/common';

const TabTeam = ({ users, appUser, addToast }) => {
  const canManageTeam = appUser.isAdmin || appUser.permissions?.team;
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [role, setRole] = useState('Bartender'); 
  const [wage, setWage] = useState(''); 
  const [photoURL, setPhotoURL] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const DEFAULT_PERMISSIONS = { schedule: false, events: false, ops: false, inventory: false, prep: false, sales: false, team: false, labor: false };
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
    setName(u.name); setEmail(u.email); setPhone(u.phone || ''); setWage(u.wage || ''); setPhotoURL(u.photoURL || ''); setRole(u.role || 'Bartender'); setIsAdmin(u.isAdmin || false); setPerms({ ...DEFAULT_PERMISSIONS, ...(u.permissions || {}) }); setEditingUserId(u.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => { 
    e.preventDefault(); if (!name.trim() || !email.trim() || !phone.trim()) return; 
    
    if (editingUserId) {
        try {
            await updateDoc(doc(db, "users", editingUserId), {
                name: name.trim(), phone: phone.trim(), role, wage: parseFloat(wage) || 0, isAdmin, permissions: perms, photoURL: photoURL.trim()
            });
            addToast('Updated', `${name}'s profile has been updated.`);
            resetForm();
        } catch(err) { addToast('Error', err.message); }
        return;
    }

    const tPass = generateTempPass(); 
    try { 
      const secondaryApp = initializeApp(firebaseConfig, "TeamBuilderApp_" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.toLowerCase().trim(), tPass);
      const newAuthUid = userCredential.user.uid;
      
      await secondaryAuth.signOut();

      await setDoc(doc(db, "users", newAuthUid), { 
        name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), 
        role, wage: parseFloat(wage) || 0, isAdmin, permissions: perms, isActive: true, 
        forcePasswordChange: true, photoURL: photoURL.trim(), restaurantId: appUser.restaurantId,
        passwordStored: false, passwordPurgedAt: new Date().toISOString()
      });
      setCreatedLogin({ kind:'employee', name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password: tPass });
      addToast('Staff Added', `Account created successfully. Copy or print the one-time login info.`); 
      resetForm();
    } catch (err) { 
      console.error(err); 
      addToast('Error', err.message || 'Failed to create user account.');
    } 
  };

const handleDeactivate = async (u) => { 
    if (!window.confirm(`Terminate ${u.name}? This will permanently delete their global account from the entire system.`)) return; 
    
    addToast('Terminating', `Erasing ${u.name} from the system...`);
    try {
      // 1. Nuke the Authentication Login via Vercel
      await secureFetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: u.id })
      });
      
      // 2. Nuke the Database Profile
      await deleteDoc(doc(db, "users", u.id)); 
      addToast('Terminated', `${u.name}'s account has been completely erased.`); 
    } catch (err) {
      addToast('Error', 'Could not delete authentication credential. See logs.');
    }
  };

  const handlePasswordReset = async (u) => {
    if (!window.confirm(`Send a password reset email to ${u.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, u.email);
      addToast('Sent', `Reset email sent to ${u.email}`);
    } catch(err) { addToast('Error', err.message); }
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
          {appUser?.isAdmin && (
            <div>
              <label className={T.label}>Hourly Wage ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                <input type="number" step="0.01" min="0" value={wage} onChange={e=>setWage(e.target.value)} className={`${T.input} pl-8`} placeholder="Ex: 15.50" />
              </div>
            </div>
          )}

  {appUser?.isAdmin && (
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
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Custom Permissions: Ops Command Center is only visible with Ops permission or Store Manager. Labor is only visible to Store Managers, Schedule/Sales managers, or users with Labor permission.</p>
              <div className="flex flex-wrap gap-4">
                {Object.keys(perms).map(k => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 uppercase">
                    <input type="checkbox" checked={perms[k]} onChange={e=>setPerms({...perms, [k]: e.target.checked})} className="w-4 h-4 accent-[#8F6040] bg-[#1A2126] border-[#2A353D] rounded" /> 
                    {{ schedule: 'Schedule Builder', events: 'Event Calendar', ops: 'Ops Command Center', inventory: 'Inventory', prep: 'Prep / Recipes', sales: 'Financials: Daily Ledger', team: 'Team Management', labor: 'Financials: Labor / Timesheets' }[k] || k}
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <button type="submit" className={`w-full ${T.btn}`}>{editingUserId ? 'UPDATE STAFF PROFILE' : 'ADD STAFF'}</button>
        </form>
      )}
      
      <div className={`${T.card} overflow-hidden`}>
        <div className="divide-y divide-[#2A353D]">
          {activeUsers.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No active staff found.</div>}
          
          {activeUsers.map(u => (
            <div key={u.id} className="p-2.5 border-b border-[#2A353D] hover:bg-[#12161A] transition-colors flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-xs flex-shrink-0 ${u.isAdmin ? 'bg-red-900/50 border border-red-500/50' : 'bg-[#1A2126] border border-[#2A353D]'}`}>
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-sm leading-tight truncate">{u.name} {u.isAdmin && <span className="ml-1 text-[7px] uppercase tracking-widest bg-red-500 text-white px-1 py-0.5 rounded-sm">Admin</span>}</h4>
<div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${u.role==='Bartender'?'bg-blue-900/20 text-blue-400 border-blue-900/50':'bg-[#12161A] text-[#D4A381] border-[#2A353D]'}`}>{u.role}</span>
                    {u.phone && <span className="text-[9px] font-bold text-slate-500 truncate">{u.phone}</span>}
                    {appUser?.isAdmin && u.wage > 0 && <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-900/10 border border-emerald-900/30 px-1.5 py-0.5 rounded ml-1">${Number(u.wage).toFixed(2)}/hr</span>}
                    {appUser?.isAdmin && <span className={`text-[8px] font-black uppercase tracking-widest ml-1 ${(!u.lastActive || Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000) > 1) ? 'text-red-500' : 'text-emerald-500'}`}>{!u.lastActive ? 'Never' : Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000) === 0 ? 'Active Today' : `Inactive ${Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000)} days`}</span>}
                  </div>
                </div>
              </div>
              
           {(appUser?.isAdmin || (canManageTeam && !u.isAdmin)) && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handlePasswordReset(u)} className="px-2 py-1 text-[9px] font-bold text-slate-400 hover:text-blue-400 transition-colors bg-[#12161A] rounded border border-[#2A353D]">Reset</button>
                  <button onClick={() => handleEditClick(u)} className="p-1 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded border border-[#2A353D]"><Edit size={12}/></button>
                  <button onClick={() => handleDeactivate(u)} className="p-1 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded border border-[#2A353D]"><Trash2 size={12}/></button>
                </div>
              )}
            </div>
          ))}
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
      const matchesText = (e.title || '').toLowerCase().includes(term) || (e.author || '').toLowerCase().includes(term) || (e.messageCategory || '').toLowerCase().includes(term);
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
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5 leading-snug">Ops notes, 86 alerts, maintenance, and announcements</p>
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

const TabSettings = ({ appUser, addToast, users = [], clientData = {} }) => {  const [subTab, setSubTab] = useState('profile');
  const [newOwnerId, setNewOwnerId] = useState('');

  // --- Profile State ---
  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');
  const [photoURL, setPhotoURL] = useState(appUser?.photoURL || '');

  // --- Preferences State ---
  const prefs = appUser?.preferences || {};
  const [defaultTab, setDefaultTab] = useState(prefs.defaultTab || (appUser?.isAdmin ? 'schedule' : 'published'));
  const [timeFormat, setTimeFormat] = useState(prefs.timeFormat || '12h');
  const [uiDensity, setUiDensity] = useState(prefs.uiDensity || 'compact');
  const [recipeDensity, setRecipeDensity] = useState(prefs.recipeDensity || 'tight');
  const [messageView, setMessageView] = useState(prefs.messageView || 'ops');
  const [motionMode, setMotionMode] = useState(prefs.motionMode || 'normal');
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
  const sys = appUser?.systemSettings || {};
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
  const [sysEnableIpWhitelist, setSysEnableIpWhitelist] = useState(sys.enableIpWhitelist ?? false);
  const [sysIpWhitelist, setSysIpWhitelist] = useState(sys.ipWhitelist || '');

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
    if (!sysAddress.trim()) return addToast('Error', 'Please enter a full address first.');
    addToast('Locating...', 'Searching map database...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sysAddress)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setSysLat(parseFloat(data[0].lat).toFixed(4));
        setSysLon(parseFloat(data[0].lon).toFixed(4));
        addToast('Found', 'Coordinates locked in.');
      } else {
        addToast('Error', 'Address not found. Try adding city and state.');
      }
    } catch (err) { addToast('Error', 'Failed to reach map service.'); }
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
          uiDensity, recipeDensity, messageView, motionMode, showMorningBrief
        }
      });
      addToast('Preferences Saved', 'Your personal app settings are locked in.');
    } catch (err) { addToast('Error', 'Failed to save preferences.'); }
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    try {
      const targetId = appUser?.restaurantId || 'legacy-sandbox';
      await setDoc(doc(db, "restaurants", targetId), {
        systemSettings: { 
          geofence: sysGeofence, address: sysAddress, lat: parseFloat(sysLat) || 0, lon: parseFloat(sysLon) || 0, geofenceRadius: parseInt(sysRadius) || 300,
          breaks: sysBreaks, tips: sysTips, trades: sysTrades, autoApprove: sysAutoApprove, sameRoleTrades: sysSameRoleTrades, blockEarly: sysBlockEarly, gracePeriod: sysGracePeriod, overtime: sysOvertime,
          wageAccess: sysWageAccess, enableIpWhitelist: sysEnableIpWhitelist, ipWhitelist: sysIpWhitelist
        }
      }, { merge: true });
      addToast('System Saved', 'Global workspace configurations updated.');
    } catch (err) { addToast('Error', err.message); }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, appUser.email);
      addToast('Email Sent', 'Check your inbox for the password reset link.');
    } catch (err) { addToast('Error', err.message); }
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
        {['profile', 'preferences', 'alerts'].concat(appUser?.isAdmin ? ['workspace', 'integrations'] : []).map((tab) => (
<button type="button" key={tab} onClick={() => {
            if (tab === 'integrations' && appUser?.planType !== 'Enterprise') {
              return addToast('Locked', 'Upgrade to Enterprise to unlock POS & Payroll Integrations.');
            }
            setSubTab(tab);
          }} className={`px-2 sm:px-5 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 flex items-center justify-center gap-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'} ${(tab === 'integrations' && appUser?.planType !== 'Enterprise') ? 'opacity-50 border border-[#2A353D] cursor-not-allowed' : ''}`}>
            {(tab === 'integrations' && appUser?.planType !== 'Enterprise') ? '🔒 Integrations' : tab}
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
          <div className={`${T.card} p-3 sm:p-5 bg-red-900/10 border-red-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
             <div>
               <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1">Security</h3>
               <p className="text-[10px] text-slate-400 font-medium">Get a secure password reset link.</p>
             </div>
             <button type="button" onClick={handlePasswordReset} className="w-full sm:w-auto bg-[#12161A] text-red-400 border border-red-900/50 hover:bg-red-900/30 font-bold px-4 py-2 rounded-xl transition-colors text-xs whitespace-nowrap">Reset Password</button>
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
                    {appUser?.isAdmin || appUser?.permissions?.ops ? <option value="ops">Ops Command Center</option> : null}
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
                    <option value="ops">Professional Ops Feed</option>
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
              </div>
              <label className="mt-3 flex items-center gap-2 p-2.5 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer hover:bg-[#1A2126] transition-colors">
                <input type="checkbox" checked={showMorningBrief} onChange={e => setShowMorningBrief(e.target.checked)} className="w-4 h-4 accent-[#8F6040]" />
                <span className="text-xs font-bold text-slate-300">Show Morning Brief / Ops summary first when available</span>
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

{subTab === 'workspace' && appUser?.isAdmin && (
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

                   <div className="w-full h-80 mt-4 rounded-xl border border-[#2A353D] relative z-0 overflow-hidden shadow-inner">
                     <MapContainer 
                       center={[parseFloat(sysLat) || 44.0296, parseFloat(sysLon) || -88.1633]} 
                       zoom={17} 
                       style={{ height: '100%', width: '100%' }}
                     >
                       <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                       <MapClickListener 
                         setLat={(lat) => setSysLat(lat.toFixed(6))} 
                         setLon={(lon) => setSysLon(lon.toFixed(6))} 
                       />
                       {sysLat && sysLon && (
                         <Marker position={[parseFloat(sysLat), parseFloat(sysLon)]} icon={customMapIcon} />
                       )}
                       {sysLat && sysLon && sysRadius && (
                         <Circle 
                           center={[parseFloat(sysLat), parseFloat(sysLon)]} 
                           radius={parseInt(sysRadius) * 0.3048} 
                           pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2 }} 
                         />
                       )}
                     </MapContainer>
                   </div>
                   <p className={`text-[10px] ${T.muted} font-bold uppercase tracking-widest mt-2 text-center`}>Click map to set geofence center</p>
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

             <div className="mt-5 mb-2 text-[9px] font-black uppercase text-[#D4A381] tracking-widest">Labor & Payroll</div>
             <div className="space-y-2">
<div onClickCapture={(e) => { if (appUser?.planType === 'Starter' || appUser?.planType === 'Pro') { e.stopPropagation(); e.preventDefault(); addToast('Locked', 'Upgrade to Elite to unlock Mandatory Tip Declarations.'); } }}>
                 <Toggle label={(appUser?.planType === 'Starter' || appUser?.planType === 'Pro') ? '🔒 Mandatory Tip Declaration (Elite)' : 'Mandatory Tip Declaration'} desc="Force tipped employees to declare cash & credit tips before they can clock out." checked={sysTips} onChange={e => setSysTips(e.target.checked)} disabled={appUser?.planType === 'Starter' || appUser?.planType === 'Pro'} />
               </div>               
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

               <div className="p-3 bg-[#12161A] border border-[#2A353D] rounded-xl mt-2">
                 <div className="text-xs font-bold text-white mb-1">Wage Visibility Exceptions</div>
                 <div className={`text-[9px] font-medium ${T.muted} mb-3 leading-snug`}>By default, only Full Admins can see hourly wages and labor costs. Select specific employees below to grant them exception access to view wages.</div>
                 <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-[#0B0E11] p-2 border border-[#2A353D] rounded-lg">
                   {users.filter(u => u.isActive !== false && !u.isAdmin).map(u => (
                     <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#1A2126] p-1.5 rounded transition-colors">
                       <input type="checkbox" checked={sysWageAccess.includes(u.id)} onChange={e => {
                         if (e.target.checked) setSysWageAccess([...sysWageAccess, u.id]);
                         else setSysWageAccess(sysWageAccess.filter(id => id !== u.id));
                       }} className="w-3.5 h-3.5 accent-[#8F6040] bg-[#12161A] border-[#2A353D]" />
                       <span className="text-[10px] font-bold text-slate-300">{u.name} <span className="text-slate-500 font-normal">({u.role})</span></span>
                     </label>
                   ))}
                   {users.filter(u => u.isActive !== false && !u.isAdmin).length === 0 && <div className="text-[10px] text-slate-500 text-center py-2">No non-admin staff available.</div>}
                 </div>
               </div>
             </div>

          </div>
          <button type="submit" className={`w-full ${T.btn} py-3 mt-4 text-sm`}>Save Global Workspace</button>
        </form>
      )}

      {/* --- TRANSFER OWNERSHIP ZONE --- */}
      {subTab === 'workspace' && (appUser?.email?.toLowerCase() === clientData?.ownerEmail?.toLowerCase() || appUser?.isSuperAdmin || appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com') && (
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
      {subTab === 'integrations' && appUser?.isAdmin && (
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
  const isGeoff = appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com';
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

const TabGodMode = ({ appUser, addToast, setGhostTenant, setActiveTab }) => {  const [subTab, setSubTab] = useState('overview');
  const [isCommandDeckOpen, setIsCommandDeckOpen] = useState(true);
  
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
  const [isScheduleReinjecting, setIsScheduleReinjecting] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [createdWorkspaceLogin, setCreatedWorkspaceLogin] = useState(null);
  const [demoPlan, setDemoPlan] = useState('Pro');
  const [demoRole, setDemoRole] = useState('manager');
  const defaultDemoFeatures = { published:true, schedule:true, events:true, ops:true, messages:true, prep:true, recipes:true, inventory:true, financials:true, team:true, maintenance:true, help:true };
  const [demoFeatures, setDemoFeatures] = useState(defaultDemoFeatures);
  const [adminManualSearch, setAdminManualSearch] = useState('');
  const [userCounts, setUserCounts] = useState({});
  const [totalInstalls, setTotalInstalls] = useState(0); 

// Form States
  const [rName, setRName] = useState(''); const [rAddress, setRAddress] = useState(''); const [oName, setOName] = useState(''); const [oEmail, setOEmail] = useState(''); const [oPhone, setOPhone] = useState('');  const [adminEmail, setAdminEmail] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
const [editingRest, setEditingRest] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setBackupCountdownTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const buildWorkspaceLoginText = (login) => login ? `Welcome to 86 Chaos!\n\nWorkspace: ${login.restaurantName}\nApp: https://app.86chaos.com\n\nOwner: ${login.ownerName}\nEmail: ${login.email}\nTemporary Password: ${login.password}\n\nThis temporary password is shown one time. Please log in and change it.` : '';
  const copyWorkspaceLogin = async (login) => { try { await navigator.clipboard.writeText(buildWorkspaceLoginText(login)); addToast('Copied', 'Workspace login info copied.'); } catch(e) { addToast('Copy Failed', 'Highlight and copy the login info manually.'); } };
  const printWorkspaceLogin = (login) => { const w = window.open('', '_blank'); if (!w) return addToast('Popup Blocked', 'Allow popups to print the login sheet.'); w.document.write(`<pre style="font-family:Arial,sans-serif;font-size:18px;white-space:pre-wrap;line-height:1.5">${buildWorkspaceLoginText(login).replace(/</g,'&lt;')}</pre>`); w.document.close(); w.focus(); w.print(); };
  const emailWorkspaceLogin = (login) => { window.location.href = `mailto:${login.email}?subject=${encodeURIComponent(`Your 86 Chaos OS: ${login.restaurantName}`)}&body=${encodeURIComponent(buildWorkspaceLoginText(login))}`; };
  const textWorkspaceLogin = (login) => { if (!login.phone) return addToast('No Phone', 'No owner phone number was entered.'); const smsChar = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'; window.location.href = `sms:${login.phone}${smsChar}body=${encodeURIComponent(buildWorkspaceLoginText(login))}`; };
  const startDemoMode = (client, role = demoRole) => { if (!client?.id) return; setGhostTenant({ id: client.id, name: client.name, mode: 'demo', demoMode: { plan: demoPlan, role, features: demoFeatures } }); setSelectedClient(null); setActiveTab('published'); addToast('Demo Mode', `${role === 'employee' ? 'Employee' : 'Manager'} demo started. Use the banner to exit.`); };
  const [forgeEventTitle, setForgeEventTitle] = useState(''); const [forgeEventDate, setForgeEventDate] = useState(getToday());
  const [userSearch, setUserSearch] = useState('');
  const [bulkDeleteEmails, setBulkDeleteEmails] = useState('');
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);
  const [editingGlobalUser, setEditingGlobalUser] = useState(null);
  const [supportUserForm, setSupportUserForm] = useState({});

  // Emergency client-side restore data. This writes through the same Firebase app the UI is currently using,
  // so it cannot accidentally restore into the wrong Firebase project.
  const CHEERS_RESTORE_RESTAURANT_ID = 'cheers_chilton_01';
  const CHEERS_RESTORE_MONTH_START = '2026-07-01';
  const CHEERS_RESTORE_MONTH_END = '2026-07-31';
const CHEERS_JULY_2026_SCHEDULE = [
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
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      clearLoadError('users');
      const uList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(uList);
      const counts = {}; uList.forEach(u => { if (u.restaurantId) counts[u.restaurantId] = (counts[u.restaurantId] || 0) + 1; });
      setUserCounts(counts);
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
    const unsubOpsReview = onSnapshot(doc(db, 'system', 'operationsReview'), docSnap => {
       clearLoadError('operationsReview');
       setOperationsReview(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
    }, err => { setOperationsReview(null); noteLoadError('operationsReview', err); });
    return () => { unsubRests(); unsubAdmins(); unsubUsers(); unsubCrashes(); unsubAudit(); unsubPricing(); unsubBackup(); unsubOpsReview(); };
  }, []);

  useEffect(() => {
    if (subTab === 'forensics' && backupList.length === 0 && !isBackupListLoading) {
      loadBackupList({ silent: true });
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
      await updateDoc(doc(db, "restaurants", editingRest.id), {
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
      });
      addToast('Saved', 'Client workspace configuration updated.');
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

  const handleBulkDeleteUsersByEmail = async (e) => {
    e.preventDefault();
    const emails = parseBulkEmailList(bulkDeleteEmails);
    if (emails.length === 0) return addToast('Nothing to Delete', 'Paste one or more email addresses first.');

    const protectedEmails = new Set([MASTER_ADMIN_EMAIL.toLowerCase(), (appUser?.email || '').toLowerCase()].filter(Boolean));
    const targets = allUsers.filter(u => emails.includes((u.email || '').toLowerCase().trim()) && !protectedEmails.has((u.email || '').toLowerCase().trim()));
    const skippedProtected = emails.filter(email => protectedEmails.has(email));

    if (targets.length === 0) {
      return addToast('No Matches', skippedProtected.length ? 'Only protected admin emails were entered.' : 'No user profiles matched those emails.');
    }

    const duplicateSummary = Object.entries(targets.reduce((acc, u) => {
      const key = (u.email || '').toLowerCase().trim();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([email, count]) => `${email} (${count})`).join(', ');

    const confirmText = (prompt(`This will delete ${targets.length} user profile(s) matching:
${duplicateSummary}

Type DELETE to continue.`) || '').trim().toUpperCase();
    if (!['DELETE', 'DELETE USERS'].includes(confirmText)) return addToast('Aborted', 'Bulk deletion canceled.');

    setIsBulkDeletingUsers(true);
    let authDeleted = 0;
    let profileDeleted = 0;
    const errors = [];

    try {
      // Preferred path: one secure backend call deletes Firebase Auth users and Firestore profiles.
      try {
        const response = await secureFetch('/api/delete-users-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails })
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok) {
          authDeleted = result.authDeleted ?? result.deletedAuthCount ?? targets.length;
          profileDeleted = result.profileDeleted ?? result.deletedProfileCount ?? targets.length;
          addToast('Bulk Delete Complete', `${profileDeleted} profile(s) removed. ${authDeleted} auth login(s) removed.`);
          setBulkDeleteEmails('');
          await addDoc(collection(db, 'auditLogs'), {
            userId: appUser?.id || 'system', userName: appUser?.name || 'System Admin', action: 'BULK_DELETE_USERS', target: 'users',
            details: `Bulk deleted users by email: ${emails.join(', ')}`, timestamp: new Date().toISOString(), restaurantId: appUser?.restaurantId || 'system', isGhost: appUser?.isGhost || false
          }).catch(()=>{});
          return;
        }
        throw new Error(result.error || 'Bulk delete API unavailable.');
      } catch (bulkApiErr) {
        console.warn('Bulk delete API unavailable, falling back to individual user deletion:', bulkApiErr);
      }

      // Fallback path: try the existing single delete-user endpoint for each UID, then delete the profile doc.
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
        details: `Bulk deleted ${profileDeleted} profile(s) by email. Auth deleted: ${authDeleted}. Errors: ${errors.slice(0, 5).join(' | ') || 'none'}`,
        timestamp: new Date().toISOString(), restaurantId: appUser?.restaurantId || 'system', isGhost: appUser?.isGhost || false
      }).catch(()=>{});

      addToast(errors.length ? 'Partial Delete' : 'Bulk Delete Complete', `${profileDeleted} profile(s) removed. ${authDeleted} auth login(s) removed.`);
      if (!errors.length) setBulkDeleteEmails('');
    } finally {
      setIsBulkDeletingUsers(false);
    }
  };

  const loadDuplicateEmailsIntoBulkDelete = () => {
    if (duplicateEmailGroups.length === 0) return addToast('Clean', 'No duplicate email groups found.');
    setSubTab('users');
    setBulkDeleteEmails(duplicateEmailGroups.map(([email]) => email).join('\n'));
    addToast('Loaded', 'Duplicate email groups loaded into the bulk delete box. Review before deleting.');
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

    const protectedEmail = (editingGlobalUser.email || '').toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
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
    if (!window.confirm("Fire a test notification to all opted-in devices in your workspace?")) return;
    addToast('Pinging Server', 'Firing test shot to Vercel...');
    try {
      const pushRes = await secureFetch('/api/send-schedule-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          restaurantId: appUser.restaurantId,
          restaurantName: 'TEST MODE'
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
        if (prompt('CRITICAL: This will instantly lock out EVERY client workspace (except yours) by triggering the maintenance lock screen. Type "LOCKDOWN" to proceed.') !== 'LOCKDOWN') return;
        addToast('Executing', 'Initiating global lockdown...');
    } else {
        if (!window.confirm('Restore access to all suspended workspaces?')) return;
        addToast('Executing', 'Lifting lockdown...');
    }
    
    let count = 0;
    for (const r of restaurants) {
      if (r.id !== appUser.restaurantId) {
        try { await updateDoc(doc(db, "restaurants", r.id), { billingStatus: lock ? 'Past Due' : 'Paid' }); count++; } catch(e){}
      }
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
  const lastBackupDate = parseAnyDate(backupStatus?.lastBackupAt || backupStatus?.lastSuccessfulBackupAt || backupStatus?.lastExportAt || backupStatus?.lastRunAt) || latestWorkspaceMaintenance;
  const backupAgeHours = lastBackupDate ? Math.round((Date.now() - lastBackupDate.getTime()) / 36e5) : null;
  const backupRunning = backupStatus?.status === 'running';
  const backupStatusLabel = backupRunning ? 'Running...' : (lastBackupDate ? `${Math.max(0, backupAgeHours)}h ago` : 'Not Reported');
  const backupIsStale = !backupRunning && (!lastBackupDate || backupAgeHours > 7 * 24);
  const backupDetail = backupStatus?.status === 'ok' && backupStatus?.documentCount ? `${backupStatus.documentCount} docs • ${backupStatus.collectionCount || 0} collections` : (backupStatus?.status || backupStatus?.lastStatus || (latestWorkspaceMaintenance ? 'weekly maintenance stamp' : 'No backup status doc'));
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
  const ONLINE_WINDOW_MS = 3 * 60 * 1000;
  const nowMs = Date.now();
  const parsePresenceTimeMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'string' || typeof value === 'number') {
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
    parsePresenceTimeMs(u.lastSeen)
  );
  const isOnlineNow = (u) => {
    const last = getLastActiveMs(u);
    return !!last && (nowMs - last) < ONLINE_WINDOW_MS && u.onlineState !== 'offline';
  };
  const onlineUsers = allUsers.filter(isOnlineNow).sort((a,b) => getLastActiveMs(b) - getLastActiveMs(a));
  const onlineRestaurantIds = [...new Set(onlineUsers.map(u => u.restaurantId).filter(Boolean))];
  const onlineRestaurants = restaurants.filter(r => onlineRestaurantIds.includes(r.id));
  const onlineByRestaurant = onlineRestaurantIds.map(id => ({
    id,
    rest: restaurants.find(r => r.id === id),
    users: onlineUsers.filter(u => u.restaurantId === id)
  })).sort((a,b) => b.users.length - a.users.length);
  const recentlyActiveUsers = allUsers.filter(u => {
    const last = getLastActiveMs(u);
    return !!last && (nowMs - last) < 15 * 60 * 1000 && !isOnlineNow(u);
  }).sort((a,b) => getLastActiveMs(b) - getLastActiveMs(a));

  const selectedClientUsers = selectedClient ? allUsers
    .filter(u => u.restaurantId === selectedClient.id)
    .sort((a,b) => (b.isAdmin === true) - (a.isAdmin === true) || (a.name || a.email || '').localeCompare(b.name || b.email || '')) : [];
  const selectedClientAdmins = selectedClientUsers.filter(u => u.isAdmin || u.isSuperAdmin);
  const selectedClientOnline = selectedClientUsers.filter(isOnlineNow);
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
  const endpointList = ['admin-access', 'whoami', 'security-diagnostics', 'firestore-backup', 'list-backups', 'weekly-maintenance', 'deploy-tenant', 'delete-user', 'scan-invoice', 'send-push', 'send-schedule-alert', 'import-cheers-july-schedule'];
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
  const platformSnapshot = [
    `86 Chaos Platform Snapshot`,
    `Version: ${CURRENT_VERSION}`,
    `Online users: ${onlineUsers.length}`,
    `Active workspaces: ${restaurants.filter(r=>r.isActive).length}`,
    `Paid workspaces: ${paidWorkspaces}`,
    `Trials: ${trialWorkspaces.length}`,
    `Past due: ${pastDueWorkspaces.length}`,
    `Network users: ${allUsers.length}`,
    `Admins: ${adminUsers.length}`,
    `Crashes 24h: ${crashes24h}`,
    `Last backup/status: ${backupStatusLabel} (${backupDetail})`,
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
    backupIsStale ? { tone: 'amber', title: 'Backup status stale', detail: `Last reported backup/maintenance: ${backupStatusLabel}.`, jump: 'support' } : null
  ].filter(Boolean);
  const platformStatus = adminRiskQueue.some(r => r.tone === 'red') ? 'Needs Attention' : adminRiskQueue.length ? 'Monitoring' : 'Clean';


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

  const adminManualArticles = [
    { title: 'System Administrator tab map: what every section means', group: 'Admin Tab Guide', keywords: 'administrator instructions admin manual tab map dashboard live users clients users grant access support forensics operations manual meaning', body: ['Dashboard is the command overview: health metrics, action queue, backup countdown, stability, billing/adoption signals, and quick jumps to problem areas.', 'Live Activity shows who is currently heartbeating into the app, what workspace they are in, what tab they are using, and gives support a Possess option when troubleshooting.', 'Workspaces is the customer control room for restaurants, module access, billing state, demo mode, owner info, and client user drawer actions.', 'People is the global account list for searching accounts across restaurants, checking routing, push/GPS status, force password flags, support edit, and possession.', 'Access Control manages platform administrator access. Use it sparingly because it grants system-wide control.', 'Support Desk is for crash reports, permission-denied clues, raw document inspection, broadcast messages, and urgent troubleshooting.', 'Forensics & Backups is for audit logs, backup center, restore tools, diagnostic bundles, and evidence trails after risky changes.', 'Platform Operations contains platform-wide tools like demo workspace creation, push tests, global refresh, orphan sweeps, cache cleanup, exports, ops review stamps, and lockdown controls.', 'Admin Manual is this internal instruction database. Search it before changing customers, rules, backups, billing, or data.'] },
    { title: 'Live Activity: why online users may not appear', group: 'Admin Tab Guide', keywords: 'live users online heartbeat presence last active last seen firestore rules gps notification active tab', body: ['A live user appears when their browser writes a presence heartbeat to their user profile. The app writes lastActive, lastSeen, lastHeartbeatAt, onlineState, activeTab, activeDevice, notificationPermission, GPS permission, and device diagnostics.', 'If the Live Activity panel is empty while people are online, first confirm the deployed Firestore rules include the presence fields in userSafeSelfUpdate.', 'Open the app as a normal employee, wait about 25 seconds, then check System Administrator → Live Activity. The user should appear within the three-minute live window.', 'If they appear under Recent Activity but not Live Activity, their heartbeat is stale, the tab is hidden, or their browser/device went offline.', 'If no profile updates occur at all, check browser console for permission-denied and confirm the logged-in Firebase Auth UID matches the users document ID.'] },
    { title: 'Dashboard / Command Deck: what the numbers mean', group: 'Admin Tab Guide', keywords: 'dashboard command deck metrics backup countdown action queue mrr crashes stale clients push adoption', body: ['Online Now counts users with a fresh heartbeat in the last few minutes.', 'Crashes shows recent crash reports and should be used with Support before editing code or rules.', 'Backup info shows the last backup and the countdown to the next automatic backup.', 'MRR, trial, stale client, push opt-in, and sticky-rate cards are operating signals, not accounting books. Use them to spot accounts that need attention.', 'The Administrator Action Queue is the shortest path to urgent problems. Click a card to jump to the relevant admin section.'] },
    { title: 'Workspaces: what to use it for', group: 'Admin Tab Guide', keywords: 'clients workspace restaurant tenant modules billing demo users possess owner restaurant id plan tabs', body: ['Use Workspaces to manage restaurant/customer environments, not individual shifts or menu work.', 'The workspace drawer shows users, admin counts, online counts, push token adoption, GPS permission snapshots, enabled modules, plan/status state, and ownership clues.', 'Demo Manager and Demo Employee let you show a customer only selected tabs/features without saving real changes or exposing sensitive owner/customer data.', 'Support Edit is for correcting routing, roles, status, force password flags, and account metadata when a restaurant cannot self-fix it.', 'Possess Workspace or Possess User is for troubleshooting only. Exit Ghost/Demo mode when finished.'] },
    { title: 'People: what to use it for', group: 'Admin Tab Guide', keywords: 'users global accounts employee account search routing restaurant id support edit force password push token gps status', body: ['Use Users when the problem follows a person instead of a restaurant.', 'Check restaurantId first. A wrong restaurantId makes tabs/data look missing even when permissions are correct.', 'Check status, role, admin flags, custom permissions, forcePasswordChange, push token, GPS permission, and last heartbeat.', 'Use Support Edit only to correct account routing or support fields. Do not use it as a substitute for normal Staff Roster management when the restaurant can manage the employee themselves.', 'Use Possess to verify the exact experience after editing.'] },
    { title: 'Support: what each support tool means', group: 'Admin Tab Guide', keywords: 'support crashes permission denied raw inspector broadcast banner diagnostics user action telemetry', body: ['Crash reports show errors collected from the app and may include screen size, user agent, breadcrumbs, and stack details.', 'Permission-denied clues usually point to Firestore or Storage rule blocks. Check rules before assuming the UI is broken.', 'Raw Database Inspector lets a platform admin view a specific document by collection and document ID. Use it carefully and copy diagnostics before edits.', 'Broadcast Message sends a one-time message-style alert. Top-of-App Banner pins persistent text below the main header for selected workspaces or all workspaces.', 'Support should be used to diagnose and confirm before making risky changes in Operations or Forensics.'] },
    { title: 'Forensics & Backups: what to use it for', group: 'Admin Tab Guide', keywords: 'forensics backup center restore audit logs diagnostic json client csv backup countdown schedule rescue evidence trail', body: ['Forensics is the evidence cabinet. Use it when you need audit history, backup state, restore options, or downloadable diagnostic bundles.', 'Backup Center lists Firebase Storage backups and allows Download or Restore. Restore requires typing RESTORE and is merge-based, so it does not automatically delete documents that are newer than the backup.', 'Forensic JSON exports a support bundle with platform counts, recent sensitive actions, backup state, watchlists, and runtime clues.', 'Client CSV exports workspace IDs, plan/billing state, modules, user counts, and online counts for operations review.', 'Emergency rescue tools should only be used when a normal app workflow cannot repair data. Always verify the target restaurant and month first.'] },
    { title: 'Platform Operations: what each operation does', group: 'Admin Tab Guide', keywords: 'operations demo workspace push notifications global refresh orphan sweep forensic bundle client csv review stamp cache lockdown', body: ['Deploy Demo Workspace creates a fake showcase restaurant for sales/demo purposes.', 'Test Push Notifications sends a live notification through the Vercel/Firebase Admin path to verify tokens and credentials.', 'Global Force Refresh tells active browsers to hard reload after a deployment or urgent system change.', 'Orphan Data Sweeper looks for shifts assigned to deleted users and removes those orphan records.', 'Forensic Bundle and Client Directory Export download support files without changing restaurant data.', 'Create Review Stamp records a platform review snapshot with backup, crash, permission, and integrity counts.', 'Clear This Cache only clears temporary cache on the current browser. It does not delete restaurant data.', 'Global Lockdown sets workspaces into maintenance lock mode. Use only for serious platform emergencies.'] },
    { title: 'Access Control: platform admin safety', group: 'Admin Tab Guide', keywords: 'grant access revoke super admin platform admin master admin security', body: ['Access Control is for platform administrators only, not normal restaurant managers.', 'Granting access gives broad system control, including workspaces, people, platform operations, forensics, backups, and support tools.', 'Use exact email addresses and revoke access when it is no longer needed.', 'If access does not work, confirm the user exists, confirm Firebase Auth email, confirm Firestore user document, then check custom claims/rules.'] },
    { title: 'Support triage: user says something is missing', group: 'Troubleshooting', keywords: 'missing tab missing data blank cannot see permission restaurantId feature module', body: ['Search the user in System Administrator → People or open the client in Clients → Users.', 'Confirm the user belongs to the correct restaurant/workspace.', 'Check whether the client module is enabled, then check Staff Roster permissions inside the restaurant.', 'Possess the user only after checking the routing fields so you know whether it is a permission issue or missing data.'] },
    { title: 'Support triage: permission-denied or Ghost Mode blocked', group: 'Troubleshooting', keywords: 'permission denied firebase rules ghost possess blocked insufficient permissions', body: ['Open Support and check Permission Denied counts and crash reports.', 'Confirm your account is master admin or has superAdmin access under Grant Access.', 'If Ghost Mode loads the shell but data is blank, inspect Firestore rules and restaurantId routing.', 'Copy diagnostics before changing rules.'] },
    { title: 'Client user management from Workspaces', group: 'Clients', keywords: 'client users manage restaurant users support edit possess delete force logout notifications gps', body: ['Open System Administrator → Workspaces and click the workspace name or People button.', 'The workspace drawer shows all users, admins, online users, push tokens, GPS permission snapshots, modules, and status state.', 'Use Support Edit to move a user, update role/wage/status, or force password change.', 'Use Possess to verify exactly what that workspace or user sees.'] },
    { title: 'Backup status in Command Deck', group: 'Backups', keywords: 'database backup status last backup maintenance cron firestore export storage run now', body: ['The Command Deck reads system/backupStatus, which is written by the automatic Firestore backup route.', 'Click Last Backup or open Forensics to inspect backup status and run a manual backup.', 'A stale or missing backup status means the Vercel cron route, CRON_SECRET, Firebase service account, or Storage bucket should be checked.', 'Weekly maintenance is housekeeping; Firestore Backup is the JSON data export saved to Firebase Storage.'] },
    { title: 'Automatic database backups', group: 'Backups', keywords: 'automatic daily database backup firestore storage cron secret firebase storage bucket restore export', body: ['The scheduled route /api/firestore-backup runs from Vercel Cron every day and exports Firestore data to Firebase Storage.', 'It writes progress and results to system/backupStatus so the Command Deck can show the last backup.', 'Required Vercel variables: FIREBASE_SERVICE_ACCOUNT_KEY, CRON_SECRET, and optionally FIREBASE_STORAGE_BUCKET.', 'Use Run Backup Now from the Command Deck or Forensics after installing the route to verify everything works.'] },
    { title: 'Restoring a full Firestore backup', group: 'Backups', keywords: 'restore full backup firestore storage path json gzip deleted data recover database', body: ['Open System Administrator → Forensics & Backups.', 'Copy the backup storage path from Command Deck Last Backup or Firebase Storage, for example backups/firestore/manual/...json.gz.', 'Open Backup Center, choose the backup from the list, then type RESTORE when prompted.', 'The restore is merge-based: it recreates missing/deleted documents and overwrites damaged documents from the backup, but it does not delete newer documents that are not in the backup. For schedules, use Emergency Schedule Rescue after a full restore if a month needs a clean hard replacement.'] },
    { title: 'Restoring a full Firestore backup', group: 'Backups', keywords: 'restore backup firestore storage path deleted documents recovery database', body: ['Open System Administrator → Forensics & Backups.', 'Run Backup Now first if you need a current safety copy.', 'Open Backup Center and select the backup file from the list instead of pasting a Storage path.', 'Type RESTORE. The restore is merge-based: it restores documents from the backup but does not delete newer documents. If restored schedule data mixes with old/current schedule records, run the Emergency Schedule Rescue for that month so the month is hard-replaced.'] },
    { title: 'Financials workflow', group: 'Financials', keywords: 'financials labor timesheets daily ledger sales payroll', body: ['Financials is the main money tab for managers.', 'Labor & Timesheets handles punch corrections, tips, payroll exports, and role filtering.', 'Daily Ledger handles sales, food cost, labor cost, and business notes.', 'Use the client feature toggles for labor and sales to control access.'] },
    { title: 'Schedule Builder location', group: 'Scheduling', keywords: 'schedule builder time clock shifts subtab permissions', body: ['Schedule Builder is now a protected subtab inside Time Clock & Schedule.', 'Users still need schedule permission or admin access.', 'Event Calendar remains separate because it is not the same thing as staff scheduling.', 'Old Schedule Builder links route into the same protected schedule workflow.'] },
    { title: 'Staying on the current page', group: 'Navigation', keywords: 'five minutes away landing page app hidden background return today logout stale session', body: ['86 Chaos no longer returns users to Today Command Center after five minutes away.', 'Users stay on the page they were using so managers do not lose their place while checking another app or taking a call.', 'This does not change normal logout behavior; users only sign out when they choose Log Out or their browser/session expires.'] },
    ...HELP_ARTICLES.map(a => ({ ...a, group: `App Manual / ${a.group}` }))
  ];
  const adminManualQuery = adminManualSearch.trim().toLowerCase();
  const filteredAdminManualArticles = adminManualArticles.filter(a => !adminManualQuery || `${a.title} ${a.group} ${a.keywords || ''} ${(a.body || []).join(' ')}`.toLowerCase().includes(adminManualQuery)).slice(0, 80);

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
      collectionCount: backupStatus?.collectionCount || 0
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
      addToast('Backup Complete', `${result.documentCount || 0} document(s) saved to Storage.`);
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


  const handleRestoreCheersJulySchedule = async () => {
    if (isScheduleReinjecting) return;
    const phrase = window.prompt('EMERGENCY SCHEDULE BUILDER OVERWRITE\n\nThis will erase every July 2026 shift currently on the Schedule Builder for cheers_chilton_01, then reload the uploaded July PDF schedule as UNPUBLISHED draft shifts so you can review it and republish it. A JSON backup downloads first.\n\nType REINJECT JULY to continue.');
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
        body: JSON.stringify({ confirm: 'IMPORT_JULY_2026', restaurantId: CHEERS_RESTORE_RESTAURANT_ID, replaceMode: 'schedule-builder-overwrite-draft' })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || `Schedule reinject failed with status ${response.status}`);

      if (result.backup) {
        const backupName = `Cheers_Chilton_July_2026_Shifts_Replaced_Backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        downloadTextFile(backupName, JSON.stringify(result.backup, null, 2), 'application/json;charset=utf-8;');
      }

      await addDoc(collection(db, 'auditLogs'), {
        restaurantId: CHEERS_RESTORE_RESTAURANT_ID,
        action: 'EMERGENCY_REINJECT_JULY_SCHEDULE_BUTTON',
        target: 'shifts',
        details: `System Administrator button overwrote the July 2026 Schedule Builder. Deleted ${result.deletedCount || 0} existing/restored shift(s), imported ${result.importedCount || 0} unpublished draft shift(s). Run ${result.runId || 'unknown'}.`,
        userId: appUser?.id || 'system-admin',
        userName: appUser?.email || appUser?.name || 'System Admin',
        timestamp: new Date().toISOString(),
        isGhost: appUser?.isGhost || false
      }).catch(() => {});

      addToast('Schedule Builder Loaded', `${result.importedCount || 0} July draft shift(s) loaded for review and republish. Reloading to clear schedule cache.`);
      window.alert(`Schedule Builder overwrite complete.\n\nRestaurant: ${result.restaurantId || CHEERS_RESTORE_RESTAURANT_ID}\nDeleted old/restored July shifts: ${result.deletedCount || 0}\nLoaded draft July shifts: ${result.importedCount || 0}\nRun ID: ${result.runId || 'n/a'}\n\nA backup JSON of replaced July shifts was downloaded to this computer.\n\nThe app will reload once. Then open Time Clock & Schedule → Schedule Builder, go to July 2026, review the draft, and click Publish Schedule.`);
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

  const CockpitMetric = ({ label, value, detail, tone = 'emerald', hot = false, onClick }) => {
    const Wrapper = onClick ? 'button' : 'div';
    return (
      <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className={`w-full text-left cockpit-panel cockpit-grid rounded-xl p-3 min-h-[92px] flex flex-col justify-between ${onClick ? 'hover:border-[#D4A381]/50 hover:bg-[#12161A]/70 transition-all cursor-pointer' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">{label}</span>
          <SignalPip tone={tone} label={hot ? 'HOT' : 'SYNC'} hot={hot} />
        </div>
        <div className="text-2xl font-black text-white leading-none mt-2">{value}</div>
        <div className="text-[10px] text-slate-400 font-bold mt-2 truncate">{detail}</div>
      </Wrapper>
    );
  };

  const adminTabGroups = [
    { title:'Overview', tabs:[
      {id:'overview', label:'Dashboard'},
      {id:'live', label:'Live Activity'}
    ]},
    { title:'Customer Operations', tabs:[
      {id:'tenants', label:'Workspaces'},
      {id:'users', label:'People'},
      {id:'admins', label:'Access Control'}
    ]},
    { title:'Support & Safety', tabs:[
      {id:'support', label:'Support Desk'},
      {id:'forensics', label:'Forensics & Backups'},
      {id:'ops', label:'Platform Operations'}
    ]},
    { title:'Reference', tabs:[
      {id:'manual', label:'Admin Manual'}
    ]}
  ];
  const adminTabs = adminTabGroups.flatMap(group => group.tabs.map(tab => ({ ...tab, group: group.title })));

  const jumpToAdminIssue = (target) => {
    setSubTab(target || 'overview');
    setTimeout(() => document.getElementById(`admin-${target || 'overview'}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

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
        <div className="relative grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {adminTabGroups.map(group => (
            <div key={group.title} className="bg-[#0B0E11]/70 border border-[#2A353D] rounded-2xl p-2">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 px-1.5 pb-1.5">{group.title}</div>
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
      <div className={`grid gap-4 ${isCommandDeckOpen ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'lg:grid-cols-1'}`}>
        {isCommandDeckOpen && (
          <aside className="lg:sticky lg:top-4 h-max space-y-3" id="admin-command-deck">
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
                <CockpitMetric label="Online Now" value={onlineUsers.length} detail={`${onlineRestaurants.length} workspaces`} tone="emerald" onClick={() => jumpToAdminIssue('live')} />
                <CockpitMetric label="MRR" value={`$${mrr}`} detail={`ARPA $${arpa}`} tone="emerald" onClick={() => jumpToAdminIssue('tenants')} />
                <CockpitMetric label="Crashes 24h" value={crashes24h} detail={crashes24h ? 'Open support logs' : 'No fresh crashes'} tone={crashes24h ? 'amber' : 'emerald'} hot={crashes24h > 10} onClick={() => jumpToAdminIssue('support')} />
                <CockpitMetric label="Push Opt-In" value={`${pushOptInRate}%`} detail={`${allUsers.filter(u => u.fcmToken).length} devices`} tone={pushOptInRate < 30 ? 'amber' : 'emerald'} onClick={() => jumpToAdminIssue('users')} />
                <CockpitMetric label="Stale Clients" value={staleTenants.length} detail="Inactive 21+ days" tone={staleTenants.length ? 'amber' : 'emerald'} onClick={() => jumpToAdminIssue('tenants')} />
                <CockpitMetric label="Last Backup" value={backupStatusLabel} detail={backupCommandDeckDetail} tone={backupIsStale ? 'amber' : 'emerald'} hot={backupIsStale} onClick={() => jumpToAdminIssue('forensics')} />
                <button type="button" onClick={() => jumpToAdminIssue('forensics')} className="w-full text-left bg-[#0B0E11] border border-[#2A353D] hover:border-[#D4A381]/50 rounded-xl p-3 transition-colors">
                  <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Next Automatic Backup</span><SignalPip tone={backupRunning ? 'blue' : 'emerald'} label={backupRunning ? 'RUNNING' : 'COUNTDOWN'} hot={backupRunning} /></div>
                  <div className="text-xl font-black text-white mt-2">{nextBackupCountdown}</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-1">Scheduled for {nextBackupLocalTime}</div>
                </button>
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
          {!isCommandDeckOpen && (
            <button type="button" onClick={() => setIsCommandDeckOpen(true)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] hover:text-white rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest">Show Command Deck</button>
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
                          <div className="bg-[#0B0E11] border border-[#2A353D] rounded-lg px-2 py-1"><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">Ping</div><div className="text-[10px] text-slate-300 font-bold truncate">{isOnlineNow(u) ? 'Online now' : timeAgo(u.lastHeartbeatAt || u.presenceUpdatedAt || u.lastActive || u.lastSeen)}</div></div>
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
          
          {/* PRIMARY REVENUE ROW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-emerald-900/30`}><div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Est. Platform MRR</div><div className="text-3xl lg:text-4xl font-black text-white">${mrr.toLocaleString()}<span className="text-sm lg:text-lg text-slate-500">/mo</span></div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest mb-1">Active Tenants</div><div className="text-3xl lg:text-4xl font-black text-white">{restaurants.filter(r=>r.isActive).length}</div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Network Users</div><div className="text-3xl lg:text-4xl font-black text-white">{allUsers.length}</div></div>
            {appUser?.email?.toLowerCase() === 'geoffm1985@gmail.com' && (
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
      {subTab === 'live' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {adminDataErrors.users && <div className="bg-red-900/20 border border-red-900/50 text-red-100 rounded-2xl p-4 text-sm font-bold leading-snug">Live user data is blocked by Firestore rules or auth claims: {adminDataErrors.users}. Deploy the included firestore.rules file, then log out and back in so super-admin claims refresh.</div>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 cockpit-panel rounded-2xl overflow-hidden">
              <div className={`bg-[#12161A] p-3 border-b ${T.border} flex items-center justify-between gap-3`}>
                <h3 className="font-black text-sm text-white flex items-center gap-2"><span className="cockpit-light bg-emerald-400 text-emerald-400 hot"></span> Live Activity Now</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{onlineUsers.length} active</span>
              </div>
              <div className={`divide-y ${T.border} max-h-[55vh] overflow-y-auto custom-scrollbar`}>
                {onlineUsers.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No users are reporting live presence yet. Open the app on another device, wait about 25 seconds, then refresh this panel. If it stays empty, deploy the included Firestore rules and confirm the user document can write heartbeat fields.</div>}
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
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Grouped by live heartbeat</p>
              </div>
              <div className={`divide-y ${T.border} max-h-[55vh] overflow-y-auto custom-scrollbar`}>
                {onlineByRestaurant.length === 0 && <div className="p-6 text-center text-slate-500 font-bold text-sm">No active workspaces.</div>}
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
                <h3 className="font-black text-white text-sm">Recent Activity Buffer</h3>
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
                  ['Online Radar', onlineUsers.length ? 'emerald' : 'amber', `${onlineUsers.length} live`]
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

                    <div className="text-[9px] text-slate-500 font-medium mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">ID: {r.id}<span>•</span><span className="text-white font-bold">{userCounts[r.id] || 0} Seats</span><span>•</span><span className="text-emerald-400 font-black flex items-center gap-1"><span className="cockpit-light bg-emerald-400 text-emerald-400"></span>{onlineUsers.filter(u => u.restaurantId === r.id).length} Online</span><span>•</span><span className={timeAgo(r.lastActive).includes('Inactive') ? 'text-red-400' : 'text-emerald-500'}>Ping: {timeAgo(r.lastActive)}</span></div>
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
            <textarea value={bulkDeleteEmails} onChange={e=>setBulkDeleteEmails(e.target.value)} rows="3" className={`${T.input} font-mono text-xs`} placeholder="bad@email.com
duplicate@email.com
another@email.com"></textarea>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <button type="submit" disabled={isBulkDeletingUsers} className="flex-1 bg-red-900/30 text-red-200 border border-red-700/60 hover:bg-red-900/50 font-black uppercase tracking-widest py-2.5 rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                {isBulkDeletingUsers ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>} Delete Matching Users
              </button>
              <button type="button" onClick={() => setBulkDeleteEmails('')} className={`${T.btnAlt} sm:w-32`}>Clear</button>
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
                    <div className="text-[9px] text-slate-500 mt-0.5 tracking-widest uppercase flex flex-wrap items-center gap-x-2 gap-y-1">{restName}<span>|</span>{isOnlineNow(u) ? <span className="text-emerald-400 font-black flex items-center gap-1"><span className="cockpit-light bg-emerald-400 text-emerald-400 hot"></span>Online Now</span> : <span className={timeAgo(u.lastHeartbeatAt || u.presenceUpdatedAt || u.lastActive || u.lastSeen).includes('Inactive') ? 'text-red-400' : 'text-emerald-500'}>Ping: {timeAgo(u.lastHeartbeatAt || u.presenceUpdatedAt || u.lastActive || u.lastSeen)}</span>}</div>
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
                      <span className="text-slate-500 uppercase tracking-widest">present in repo</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-600 font-bold mt-2 leading-snug">If a route returns HTML or 404, Vercel did not deploy that file or the filename does not match the fetch path.</p>
              </div>

              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Access Model</div><SignalPip tone="purple" label="RULES"/></div>
                <div className="space-y-1.5 text-[10px] font-bold text-slate-400">
                  <div className="flex justify-between gap-2"><span>Super admins</span><span className="text-white">{superAdmins.length}</span></div>
                  <div className="flex justify-between gap-2"><span>Master email</span><span className="text-[#D4A381]">{MASTER_ADMIN_EMAIL}</span></div>
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
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Next Auto Backup</div><div className="text-lg font-black text-white">{nextBackupCountdown}</div><div className="text-[9px] text-slate-500 font-bold">{nextBackupLocalTime}</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Data Watchlist</div><div className="text-lg font-black text-white">{usersWithoutRestaurant.length + missingOwnerAccounts.length + duplicateEmailGroups.length}</div><div className="text-[9px] text-slate-500 font-bold">routing / owner / duplicates</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Sensitive Actions</div><div className="text-lg font-black text-white">{destructiveAuditLogs.length}</div><div className="text-[9px] text-slate-500 font-bold">delete / nuke / lock / sweep</div></div>
              <div className="bg-[#0B0E11] border border-[#2A353D] rounded-xl p-3"><div className="text-[8px] font-black uppercase tracking-widest text-slate-500">Rule Blocks</div><div className={`text-lg font-black ${permissionDeniedLogs.length ? 'text-red-300' : 'text-emerald-400'}`}>{permissionDeniedLogs.length}</div><div className="text-[9px] text-slate-500 font-bold">permission-denied logs</div></div>
            </div>
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
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{backup.mode || 'backup'} • {formatBackupBytes(backup.sizeBytes)} • {backup.documentCount || 0} docs</div>
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
                      <div className="text-[10px] text-slate-400 font-bold leading-snug">Overwrites the July 2026 Schedule Builder for <span className="text-slate-200">cheers_chilton_01</span>. It deletes that restaurant's July 2026 builder shifts, downloads a backup, then reloads the PDF schedule as unpublished drafts so it can be reviewed and republished.</div>
                    </div>
                  </div>
                  <button type="button" onClick={handleRestoreCheersJulySchedule} disabled={isScheduleReinjecting} className="w-full bg-red-900/30 text-red-200 border border-red-800/70 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                    {isScheduleReinjecting ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                    {isScheduleReinjecting ? 'Reinjecting July Schedule...' : 'Reinject Cheers July 2026 Schedule'}
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
            <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
              {auditLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No forensic data logged yet.</div>}
              {auditLogs.map(log => (
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
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4 leading-snug">Instantly puts every tenant behind the maintenance screen. Bypasses your own workspace to prevent self-lockout.</p>
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
            <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381]">Internal support manual</div>
            <h2 className="text-2xl font-black text-white">Administrator Manual + Troubleshooting Database</h2>
            <p className="text-sm text-slate-400 font-bold mt-1 max-w-3xl">Search this before touching a client. It covers administrator workflows and the entire app help library so future support hires can debug from keywords users actually say.</p>
            <div className="relative mt-4 max-w-3xl">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={adminManualSearch} onChange={e => setAdminManualSearch(e.target.value)} placeholder="Search admin manual: permission denied, missing tab, punch, backup, ghost, GPS, schedule..." className="w-full bg-[#12161A] border border-[#2A353D] rounded-xl pl-10 pr-3 py-3 text-sm font-bold text-white outline-none focus:border-[#D4A381]" />
            </div>
          </div>

          <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
            <div className={`${T.card} p-4 h-max`}>
              <div className="text-[10px] uppercase tracking-widest font-black text-[#D4A381] mb-3">Fast support routine</div>
              {[
                'Search the client or user first.',
                'Confirm restaurantId before editing.',
                'Check Command Deck action queue.',
                'Copy diagnostics before risky changes.',
                'Use Grant Access only for platform admin.',
                'Possess, verify, fix, then exit Ghost Mode.'
              ].map((line, idx) => <div key={idx} className="flex gap-2 text-xs font-bold text-slate-300 mb-2"><span className="w-5 h-5 rounded-full bg-[#D4A381] text-slate-900 flex items-center justify-center text-[10px] font-black flex-shrink-0">{idx+1}</span><span>{line}</span></div>)}
            </div>

            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-widest font-black text-slate-500">{filteredAdminManualArticles.length} searchable result(s)</div>
              {filteredAdminManualArticles.length === 0 && <div className={`${T.card} p-6 text-center text-xs font-bold text-slate-500`}>No manual results. Try a simpler word like “tab”, “punch”, “backup”, “delete”, “GPS”, or “permission”.</div>}
              {filteredAdminManualArticles.map((article, idx) => (
                <div key={`${article.title}-${idx}`} className={`${T.card} p-4`}>
                  <div className="text-[9px] uppercase tracking-widest font-black text-[#D4A381] mb-1">{article.group}</div>
                  <h3 className="font-black text-white text-base mb-3">{article.title}</h3>
                  <div className="space-y-2">
                    {(article.body || []).map((line, i) => <div key={i} className="flex gap-2 text-xs font-bold text-slate-300 leading-relaxed"><span className="w-5 h-5 rounded-full bg-[#12161A] border border-[#2A353D] text-[#D4A381] flex items-center justify-center text-[10px] font-black flex-shrink-0">{i+1}</span><span>{line}</span></div>)}
                  </div>
                  <div className="mt-3 text-[9px] font-mono text-slate-600 break-words">Search terms: {article.keywords || 'manual support'}</div>
                </div>
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
  { id:'new-13121', title:'What changed in version 13.1.21', group:'Release Notes', keywords:'new update 13.1.21 time clock clock in clock out loading label refresh employee punch', body:['The Time Clock button now shows the correct saving label while employees clock in or clock out.', 'Clock In stays on CLOCKING IN while saving, then changes to Clock Out.', 'Clock Out stays on CLOCKING OUT while saving, then changes back to Clock In without requiring a refresh.'] },
  { id:'start', title:'Getting started checklist', group:'Getting Started', keywords:'setup first steps owner restaurant add staff modules', body:['Open Settings and confirm restaurant name, address, geofence, and enabled modules.','Add managers first in Staff Roster, then add hourly staff. New accounts show a one-time login popup with email and temporary password.','Create roles, schedule presets, and at least one schedule template before publishing the first week.','Use Administrator → Clients → Demo Mode for safe read-only demos with contact info hidden.'] },
  { id:'employee-quick-start', title:'Employee Quick Start', group:'Quick Start Guides', keywords:'employee new hire first login install download app home screen clock schedule help', body:['First login opens a short guided tour. It explains how to add the web app to the phone home screen, clock in/out, view schedule, read messages, and find Help Center.','Android: open in Chrome, tap the three dots, then Add to Home screen or Install App. iPhone: open in Safari, tap Share, then Add to Home Screen.','Employees should use Time Clock & Schedule for the full schedule and punches. Schedule Builder is manager-only.','Use the Restart Guided Tour button in Help Center if someone skips it or needs training again.'] },
  { id:'manager-quick-start', title:'Manager / Restaurant Quick Start', group:'Quick Start Guides', keywords:'manager restaurant setup workspace tour add employees permissions backups geofence', body:['New workspaces open a manager setup tour that covers saving the app, adding employees, setting permissions, setting clock rules, backups, and Help Center.','Staff Roster shows the one-time generated login popup after adding employees. Copy, print, email, or text before closing.','Set the required work area in Settings so clock-out location can be reviewed.','Backup Center is under System Administrator → Forensics & Backups and requires RESTORE confirmation for restore actions.'] },
  { id:'voice-beta', title:'Using 86 Voice beta', group:'Voice Commands', keywords:'voice beta microphone prep quantity show schedule commands fewer clicks help center search permissions full schedule month view staff list', body:['The microphone button is marked BETA. Tap once and speak; safe commands like opening tabs or adding prep tasks run with fewer clicks.','Voice removes command words before saving. “Add ranch to prep list” saves Ranch, not the words add to prep list. Quantities are parsed separately, so “Prep 2 pans ranch” saves name Ranch, quantity 2, and unit pans.' , 'Saying “86 salmon” or “we’re out of ranch” posts an important 86 alert and does not edit inventory stock counts.','Navigation commands can pull up screens by plain name: “show me full schedule”, “show me month view”, “show me staff list”, “open inventory”, or “show schedule builder”.','Schedule voice commands open the proper Time Clock & Schedule subview. Full schedule and month view do not open Schedule Builder unless the user specifically asks for Schedule Builder and has permission.','Help Center search works from the microphone. Say “search help center for missed punch” or “help me with geofence”.','Voice navigation still follows user permissions and enabled modules, so the mic cannot open hidden tabs.'] },
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
  { id:'ops', title:'Who should see Ops Command Center?', group:'Permissions', keywords:'ops command center manager access permission', body:['Ops Command Center should be limited to owners, managers, kitchen managers, or trusted leads.','Grant access from Staff Roster → Edit User → permissions. Do not give Ops access to every staff account by default.','Ops summarizes labor, prep, low stock, maintenance, events, and manager priorities.'] },
  { id:'permissions', title:'Why can’t someone see a tab?', group:'Permissions', keywords:'tab missing access permission role manage user', body:['Check that the restaurant has the module enabled.','Check the employee’s permissions in Staff Roster.','Some tabs also require Admin, Manager, or specific feature permissions.','Super Admin and Ghost Mode can see more because they are support tools.'] },
  { id:'inventory', title:'Inventory basics', group:'Inventory', keywords:'stock par order vendor low inventory', body:['Use Inventory & Orders to track items, par levels, vendor notes, and low-stock warnings.','Low-stock items flow into Today and Ops Command Center.','Smart Order can queue suggested order quantities when stock is below par.'] },
  { id:'maintenance', title:'Reporting equipment problems', group:'Maintenance', keywords:'broken fryer cooler freezer repair maintenance photo', body:['Go to Maintenance Log and add the issue as soon as it is noticed.','Use clear titles like “Fryer 2 won’t hold temp” or “Walk-in dripping by fan”.','Add urgency and a photo when possible. Open urgent issues appear in Today and Ops.'] },
  { id:'support', title:'Contacting 86 Chaos support', group:'Support', keywords:'help contact support bug error problem', body:['Search Help Center first using general words.','Use the Report a Bug / Error panel inside Help Center when the app behaves wrong. Include what you clicked and what happened.','Owners can contact support after checking the article tied to the page they are using.'] },
  { id:'admin-command-deck', title:'Administrator Command Deck', group:'System Administrator', keywords:'admin command deck clickable signals support hire dashboard cockpit', body:['Open System Administrator. The grouped section buttons are at the top. The Command Deck is the optional signal panel on the left.','Every Command Deck metric is clickable. Crashes opens Support, Online Now opens Live Activity, MRR and stale workspaces open Workspaces, and push adoption opens People.','Use the Hide Command Deck button when you need more screen space. Use Show Command Deck to bring it back.','The Action Queue shows the highest-priority platform issues first. Click an issue to jump to the correct admin section.'] },
  { id:'admin-edit-users', title:'Support-editing users and moving restaurants', group:'System Administrator', keywords:'admin edit user change restaurant move workspace support edit restaurantId notifications gps permissions', body:['Open System Administrator → People and search for the person by name, email, role, ID, or restaurant.','Click Support Edit to change support-safe profile details: name, email label, phone, role, wage, active status, restaurant/workspace, restaurant admin, and force password change.','Normal feature permissions are read-only here. Change those from the restaurant Staff Roster so support cannot accidentally alter a client’s access map from the platform cockpit.','The diagnostics panel shows push token status, browser notification permission, GPS permission/support, workspace geofence status, last active time, active tab, host, device, screen, and saved notification preferences.','Super-admin access is intentionally not in this editor. Use Access Control only for platform administrator access.','Add a support note before saving when the reason is not obvious. The change is logged in Forensics.'] },
  { id:'admin-forensics', title:'Using Forensics during support', group:'System Administrator', keywords:'admin forensics audit ghost raw json support diagnostics destructive actions', body:['Use Forensics when you need to know who changed what and when.','The top cards summarize audit count, Ghost actions, destructive actions, and support edits.','Use Raw JSON Inspector only when normal screens do not explain a data problem.','Look for the Ghost Action and Destructive badges before making conclusions about a client issue.'] },
  { id:'admin-grant-access', title:'Granting platform admin access', group:'System Administrator', keywords:'grant access super admin revoke administrator custom claims', body:['Use System Administrator → Access Control for platform administrator access.','Do not use client Manage or Support Edit for super-admin access. This keeps elevated permissions in one audited place.','After granting or revoking access, the target user should log out and back in so their Firebase token refreshes.','Revoke access immediately when a support contractor no longer needs platform control.'] },
  { id:'admin-client-users', title:'Viewing and managing people from a workspace', group:'System Administrator', keywords:'client users restaurant users support edit possess force logout delete notifications gps billing modules', body:['Open System Administrator → Workspaces and click the workspace name or People button.','The workspace drawer shows all people in that workspace, admin count, online users, push token count, GPS permission snapshots, billing state, and enabled modules.','Use Support Edit from the workspace drawer to move a user, update their role/status, force password change, or correct workspace routing.','Use Possess from the workspace drawer to troubleshoot exactly what that user sees.'] },
  { id:'admin-backup-status', title:'Checking database backup status', group:'System Administrator', keywords:'database backup last backup status command deck weekly maintenance firestore export storage run now', body:['The System Administrator Command Deck includes Last Backup.','The app reads system/backupStatus when the automatic Firestore backup route writes it.','Click Last Backup or open Forensics to run a manual backup and verify the route.','A stale backup warning means you should check Vercel cron, CRON_SECRET, Firebase service account credentials, and Firebase Storage bucket settings.'] },
  { id:'no-auto-return', title:'Does the app still return users to Today after five minutes?', group:'Navigation', keywords:'landing page today away five minutes background tab phone stale session logout', body:['No. The automatic return-to-Today behavior was removed.','Users stay on the page they were using when they return from another app, lock screen, or browser tab.','Use Log Out when a device should be signed out.'] },
  { id:'voice-commands', title:'Using 86 Voice commands', group:'Voice Commands', keywords:'voice mic microphone command 86 salmon prep message maintenance burn waste open schedule recipe', body:['Tap the floating microphone button in the lower-left corner. Say one short command, then confirm the suggested action.','Examples: “86 salmon”, “prep 2 pans tomatoes”, “post message cooler is high”, “open Friday schedule”, “open beer cheese recipe”, or “waste 2 pounds chicken breast”.','Destructive actions like setting inventory to zero, posting alerts, maintenance reports, and burn logs require confirmation before the app writes data.','If the browser does not support speech recognition, type the command into the same voice panel.'] },
  { id:'read-saver', title:'Why some tabs load data only when opened', group:'Performance', keywords:'firebase reads read saver loading data missing old history month current week cost', body:['To reduce Firebase reads, 86 Chaos now loads each tab’s live data only when that tab needs it.','Schedule, punches, sales, messages, prep, and events use smaller date windows instead of loading years of history on login.','If an old record is not visible, use the relevant date range or open the feature tab that owns that data.','This protects multi-location clients from unnecessary Firestore costs.'] },
  { id:'labor-role-export', title:'Printing timesheets by custom role', group:'Labor', keywords:'role export print pdf cook bartender server manager custom roles settings whole restaurant labor timesheets payroll', body:['Go to Financials → Timesheets → Export.','Choose Whole Restaurant or any role created in Settings, such as Line Cook, Bartender, Server, Manager, Host, or any custom role your client created.','Choose Time Punch Detail for every punch row or Total Hours Summary for one row per employee, then Download CSV or Print / Save PDF.','The role filter reads from Settings → Roles and also includes active user roles already in use, so each restaurant exports by its own job structure.'] },
  { id:'new-1290', title:'What changed in version 12.9.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1281', title:'What changed in version 12.8.1', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1282', title:'What changed in version 12.8.2', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1280', title:'What changed in version 12.8.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'schedule-stability', title:'Schedule stability and restore help', group:'Scheduling', keywords:'schedule restore deleted shifts missing old data stability', body:['Fixed stability issues around schedule restore and month loading.', 'If a schedule looks wrong after a restore, contact a system administrator so the month can be repaired safely.'] },
  { id:'backup-center', title:'Using Backup Center', group:'System Administrator', keywords:'backup center select restore download backups list manual scheduled no path paste', body:['Open System Administrator → Forensics & Backups → Backup Center.', 'Click Refresh to list manual and scheduled backups from Firebase Storage.', 'Use Download to save a copy locally, or Restore to merge that backup back into Firestore.', 'Restores still require typing RESTORE so nobody can accidentally roll the database backward.'] },
  { id:'new-1311', title:'What changed in version 13.1.1', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'weekly-maintenance', title:'Daily backups and weekly maintenance', group:'Support', keywords:'database update daily weekly maintenance backup cron automatic refresh firestore storage', body:['Daily Firestore backups run through the Vercel cron backup route and update the Command Deck backup status.','The Firestore backup route exports the database to Firebase Storage and writes system/backupStatus for the Command Deck.','Use System Administrator → Forensics & Backups → Run Backup Now after setup to test the backup route.','If status is stale, check Vercel env vars CRON_SECRET, FIREBASE_SERVICE_ACCOUNT_KEY, and FIREBASE_STORAGE_BUCKET.'] },
  { id:'financials-tab', title:'Using Financials', group:'Financials', keywords:'financials labor timesheets daily ledger sales payroll export costs', body:['Financials combines Labor & Timesheets with Daily Ledger so managers do not jump between separate money screens.', 'Use the Labor & Timesheets subtab for punches, payroll exports, role filters, tips, and punch corrections.', 'Use the Daily Ledger subtab for sales, labor cost, food cost, and context notes.', 'Old links for Labor or Daily Ledger still open Financials and land on the matching subtab.'] },
  { id:'schedule-builder-under-shifts', title:'Finding Schedule Builder', group:'Scheduling', keywords:'schedule builder maker time clock shifts subtab publish template coverage', body:['Schedule Builder now lives inside Time Clock & Schedule as a subtab for users with schedule access.', 'Open Time Clock & Schedule, then choose Schedule Builder from the subtab row.', 'The Schedule Builder is still hidden from staff who do not have schedule permission.', 'Event Calendar remains its own main menu tab.'] },
  { id:'full-backup-restore', title:'Restoring a full database backup', group:'System Administrator', keywords:'restore backup firestore storage path deleted data database recovery gzip json', body:['Full automatic backups are saved to Firebase Storage as compressed JSON files.', 'To restore one, open System Administrator → Forensics & Backups → Backup Center, select a backup, and click Restore.', 'The restore is merge-based: it puts back missing/deleted documents and overwrites damaged documents from the backup, without deleting new documents that are not in the backup. If you use full database restore and a schedule month looks contaminated by old records, run that month’s Emergency Schedule Rescue afterward so the schedule month is hard-replaced cleanly.', 'Always run a fresh backup before restoring so there is a current safety copy.'] },
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
  { id:'invoice-payload-storage-scan', title:'Invoice scanner: upload, progress, and timeout help', group:'Inventory', keywords:'invoice pdf scan payload too large 413 Vercel upload firebase storage large file crash scanner progress bar stuck spinning timeout', body:['The invoice scanner uploads the original PDF or image directly to Firebase Storage first, then sends the stored file to the large-document AI scanner. This avoids browser/Vercel payload limits and handles bigger multipage invoices more reliably.','The progress bar shows exact upload progress during the Firebase upload stage. After upload completes, the AI extraction stage shows scanner status while the invoice is being read.','If the scanner takes too long, it now stops with a clear timeout message instead of spinning forever. The timeout is longer for large invoices, so try the same file again once before splitting pages.','After a successful scan, review the Reconcile Invoice window and click Approve & Update Stock to save the invoice into history and apply stock changes.'] },
  { id:'new-1303', title:'What changed in version 13.0.3', group:'Release Notes', keywords:'new update 13.0.3 invoice scanner pdf payload storage scan', body:['Invoice scanning now uses Firebase Storage handoff for PDFs and images instead of sending the whole file through Vercel.','This fixes payload-too-large scanner crashes on normal invoice PDFs and keeps the full original file quality for extraction.'] },
  { id:'new-1302', title:'What changed in version 13.0.2', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1301', title:'What changed in version 13.0.1', group:'Release Notes', keywords:'new update 13.0.1 labor export roles custom settings timesheets payroll', body:['Financials → Timesheets export now filters by the exact roles each restaurant creates in Settings instead of fixed departments.','Exports still support Whole Restaurant, Time Punch Detail, Total Hours Summary, CSV, and Print / Save PDF.','The employee dropdown follows the selected role, and export filenames use the restaurant name and selected role.'] },
  { id:'new-1260', title:'What changed in version 12.6.0', group:'Release Notes', keywords:'new update stability reliability fixes', body:['Fixed stability issues, cleaned up internal tools, and improved reliability.'] },
  { id:'new-1242', title:'What changed in version 12.4.2', group:'Release Notes', keywords:'new update 12.4.2 time format 12 hour 24 hour military labor timesheets punches settings preferences', body:['Time format preferences now control schedule times, punch ledger times, Financials → Timesheets displays, Ops timeline times, toast messages, maintenance logs, and payroll CSV exports.','Native time entry fields may still use the device/browser picker, but saved/displayed times honor the selected preference.'] },
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
  const latestRelease = HELP_ARTICLES.find(a => a.id === `new-${String(CURRENT_VERSION).replace(/\D/g, '')}`) || HELP_ARTICLES.find(a => a.group === 'Release Notes');
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

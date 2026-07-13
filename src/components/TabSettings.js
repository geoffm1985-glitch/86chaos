import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Edit, Bell, Shield, Plus, Trash2, Package } from 'lucide-react';

const MASTER_ADMIN_EMAIL = (process.env.REACT_APP_MASTER_ADMIN_EMAIL || '').toLowerCase().trim();

const TabSettings = ({ appUser, addToast, users = [], clientData = {}, db, auth, T, useLiveCollection, getAvatar, logAudit }) => {
  const [subTab, setSubTab] = useState('profile');
  const [newOwnerId, setNewOwnerId] = useState('');

  // --- Profile State ---
  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');
  const [photoURL, setPhotoURL] = useState(appUser?.photoURL || '');

  // --- Preferences State ---
  const prefs = appUser?.preferences || {};
  const [defaultTab, setDefaultTab] = useState(prefs.defaultTab || (appUser?.isAdmin ? 'schedule' : 'published'));
  const [timeFormat, setTimeFormat] = useState(prefs.timeFormat || '12h');
  const [payPeriod, setPayPeriod] = useState(prefs.payPeriod || 'Bi-Weekly'); 
  const [payPeriodStart, setPayPeriodStart] = useState(prefs.payPeriodStart || 'Monday');
  
  // --- Notification State ---
  const [notifSchedule, setNotifSchedule] = useState(prefs.notifSchedule ?? true);
  const [notifMessages, setNotifMessages] = useState(prefs.notifMessages ?? true);
  const [notifTrades, setNotifTrades] = useState(prefs.notifTrades ?? true);
  const [notifReminders, setNotifReminders] = useState(prefs.notifReminders ?? false);
  const [reminderTime, setReminderTime] = useState(prefs.reminderTime || '120'); 

  // --- System Config State (Admin Only) ---
  const sys = appUser?.systemSettings || {};
  const [sysGeofence, setSysGeofence] = useState(sys.geofence ?? false);
  const [sysBreaks, setSysBreaks] = useState(sys.breaks ?? false); 
  const [sysTips, setSysTips] = useState(sys.tips ?? true);
  const [sysTrades, setSysTrades] = useState(sys.trades ?? true);
  const [sysAutoApprove, setSysAutoApprove] = useState(sys.autoApprove ?? false);
  const [sysSameRoleTrades, setSysSameRoleTrades] = useState(sys.sameRoleTrades ?? true);
  const [sysBlockEarly, setSysBlockEarly] = useState(sys.blockEarly ?? true);
  const [sysGracePeriod, setSysGracePeriod] = useState(sys.gracePeriod || '5'); 
  const [sysOvertime, setSysOvertime] = useState(sys.overtime || '40'); 

  // --- Role Management State (Admin Only) ---
  const [newRoleName, setNewRoleName] = useState('');
  const [newPrepCat, setNewPrepCat] = useState('');
  const dbPrepCats = useLiveCollection('prepCategories', appUser?.restaurantId);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const dbRoles = useLiveCollection('roles', appUser?.restaurantId);
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  
  // Unpacked the arrays to prevent the frozen data crash
  const displayRoles = dbRoles.length > 0 
    ? [...dbRoles].sort((a,b) => a.name.localeCompare(b.name)) 
    : DEFAULT_ROLES.map(r => ({ id: r, name: r, isDefault: true }));
  const hasCustomRosterRoles = dbRoles.length > 0;
  const roleTextForSettings = String(appUser?.role || '').toLowerCase();
  const isLegacyKitchenFallback = !hasCustomRosterRoles && ['kitchen', 'cook', 'chef', 'prep'].some(token => roleTextForSettings.includes(token));

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
        preferences: { ...prefs, defaultTab, timeFormat, notifSchedule, notifMessages, notifTrades, notifReminders, reminderTime, payPeriod, payPeriodStart }
      });
      addToast('Preferences Saved', 'Your personal app settings are locked in.');
    } catch (err) { addToast('Error', 'Failed to save preferences.'); }
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    try {
      const targetId = appUser?.restaurantId || 'legacy-sandbox';
      await setDoc(doc(db, "restaurants", targetId), {
        systemSettings: { geofence: sysGeofence, breaks: sysBreaks, tips: sysTips, trades: sysTrades, autoApprove: sysAutoApprove, sameRoleTrades: sysSameRoleTrades, blockEarly: sysBlockEarly, gracePeriod: sysGracePeriod, overtime: sysOvertime }
      }, { merge: true });
      addToast('System Saved', 'Global workspace configurations updated.');
      logAudit(appUser, 'UPDATE_SYS_CONFIG', 'Global Settings', 'Modified core workspace settings.');
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
        {['profile', 'preferences', 'alerts'].concat(appUser?.isAdmin ? ['workspace'] : []).map((tab) => (
          <button type="button" key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-5 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab}
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
                    <option value="team">Team Roster</option>
                    {isLegacyKitchenFallback || appUser?.isAdmin ? <option value="prep">Prep List</option> : null}
                    {appUser?.isAdmin && <option value="schedule">Master Schedule</option>}
                    {appUser?.isAdmin && <option value="sales">Sales Ledger</option>}
                  </select>
                </div>
                <div>
                  <label className={T.label}>Time Format</label>
                  <select value={timeFormat} onChange={e => setTimeFormat(e.target.value)} className={`${T.input} py-2 text-sm`}>
                    <option value="12h">12-Hour (AM/PM)</option>
                    <option value="24h">24-Hour (Military)</option>
                  </select>
                </div>
              </div>
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
        <form onSubmit={handleSavePrefs} className={`${T.card} p-3 sm:p-5 space-y-4`}>
          <div>
            <h2 className="text-base font-black text-white mb-1"><Bell className={`inline mr-2 ${T.copper}`} size={16}/> Alerts & Routing</h2>
            <p className="text-[10px] text-slate-400 font-medium mb-3">Control how 86 Chaos pings your device.</p>
            <div className="space-y-2">
              <Toggle label="Schedule Publications" desc="Get alerted the exact second a new schedule goes live." checked={notifSchedule} onChange={e => setNotifSchedule(e.target.checked)} />
              <Toggle label="Shift Trade Board" desc="Notify me when someone posts a shift they need covered." checked={notifTrades} onChange={e => setNotifTrades(e.target.checked)} />
              <Toggle label="Urgent Message Board" desc="Receive push alerts for announcements marked 'Critical' by managers." checked={notifMessages} onChange={e => setNotifMessages(e.target.checked)} />
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
          <button type="submit" className={`w-full ${T.btn} py-2`}>Save Alerts</button>
        </form>
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
               <Toggle label="Strict Geofencing (Time Clock)" desc="Block employees from clocking in if they are not within the GPS boundaries of the restaurant." checked={sysGeofence} onChange={e => setSysGeofence(e.target.checked)} />
               <Toggle label="Unpaid Break Tracking" desc="Allow staff to clock out for unpaid breaks during their shift." checked={sysBreaks} onChange={e => setSysBreaks(e.target.checked)} />
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
               <Toggle label="Mandatory Tip Declaration" desc="Force staff to declare cash & credit tips before they can clock out. Entering 0 is allowed when no tips were received." checked={sysTips} onChange={e => setSysTips(e.target.checked)} />
               <div className={`p-3 bg-[#12161A] border ${T.border} rounded-xl flex justify-between items-center gap-3`}>
                 <div>
                   <div className="text-xs font-bold text-white">Overtime Alert Threshold</div>
                   <div className={`text-[9px] font-medium ${T.muted} mt-0.5 leading-snug`}>Weekly hours before system flags a manager.</div>
                 </div>
                 <input type="number" min="1" value={sysOvertime} onChange={e => setSysOvertime(e.target.value)} className={`${T.input} w-16 text-center font-black py-1.5 text-xs`} />
               </div>
             </div>

          </div>
          <button type="submit" className={`w-full ${T.btn} py-3 mt-4 text-sm`}>Save Global Workspace</button>
        </form>
      )}

      {/* --- TRANSFER OWNERSHIP ZONE --- */}
      {subTab === 'workspace' && (appUser?.email?.toLowerCase() === clientData?.ownerEmail?.toLowerCase() || appUser?.isSuperAdmin || (MASTER_ADMIN_EMAIL && appUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase())) && (
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
               <option value="">-- Select New Owner --</option>
               {users.filter(u => u.isActive && u.id !== appUser.id).map(u => (
                 <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
               ))}
             </select>
             <button type="submit" className="bg-red-900/20 text-red-500 font-black tracking-widest uppercase border border-red-900/50 rounded-xl px-6 py-3 hover:bg-red-900/40 transition-colors whitespace-nowrap">Transfer</button>
           </div>
        </form>
      )}

    </div>
  );
};

export default TabSettings;

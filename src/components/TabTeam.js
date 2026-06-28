import React, { useState } from 'react';
import { collection, doc, updateDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Edit, Trash2 } from 'lucide-react';

const TabTeam = ({ users, appUser, addToast, db, auth, firebaseConfig, T, useLiveCollection, getAvatar }) => {
  const canManageTeam = appUser.isAdmin || appUser.permissions?.team;
  const [name, setName] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [role, setRole] = useState('Bartender'); 
  const [wage, setWage] = useState(''); 
  const [photoURL, setPhotoURL] = useState(''); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState({ schedule: false, inventory: false, prep: false, sales: false, team: false });
  const [editingUserId, setEditingUserId] = useState(null);

  const dbRoles = useLiveCollection('roles', appUser?.restaurantId);
  const DEFAULT_ROLES = ['General Manager', 'Manager', 'Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Bartender', 'Server', 'Host', 'Dishwasher'];
  const roles = dbRoles.length > 0 ? dbRoles.map(r => r.name).sort() : DEFAULT_ROLES;
  
  const generateTempPass = () => Math.random().toString(36).slice(-6);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setWage(''); setPhotoURL(''); setRole('Bartender'); setIsAdmin(false); setPerms({ schedule: false, inventory: false, prep: false, sales: false, team: false }); setEditingUserId(null);
  };

  const handleEditClick = (u) => {
    setName(u.name); setEmail(u.email); setPhone(u.phone || ''); setWage(u.wage || ''); setPhotoURL(u.photoURL || ''); setRole(u.role || 'Bartender'); setIsAdmin(u.isAdmin || false); setPerms(u.permissions || { schedule: false, inventory: false, prep: false, sales: false, team: false }); setEditingUserId(u.id);
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
        password: tPass, role, wage: parseFloat(wage) || 0, isAdmin, permissions: perms, isActive: true, 
        forcePasswordChange: true, photoURL: photoURL.trim(), restaurantId: appUser.restaurantId 
      }); 
      
      const welcomeMsg = `Welcome to 86chaos!\n\nAccess the 86 Chaos OS here: https://app.86chaos.com\n\nUsername: ${email.toLowerCase().trim()}\nTemporary Password: ${tPass}\n\nPlease log in and update your password.`;
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && phone.trim()) {
        const smsChar = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
        window.location.href = `sms:${phone.trim()}${smsChar}body=${encodeURIComponent(welcomeMsg)}`;
      } else {
        window.location.href = `mailto:${email.toLowerCase().trim()}?subject=${encodeURIComponent("Your 86 Chaos Account")}&body=${encodeURIComponent(welcomeMsg)}`;
      }

      addToast('Staff Added', `Account created successfully.`); 
      resetForm();
    } catch (err) { 
      console.error(err); 
      addToast('Error', err.message || 'Failed to create user account.');
    } 
  };

  const handleDeactivate = async (u) => { 
    if (!window.confirm(`Terminate ${u.name}? They will be removed from the active roster but their historical schedule data will be preserved.`)) return; 
    await updateDoc(doc(db, "users", u.id), { isActive: false }); 
    addToast('Terminated', `${u.name} deactivated.`); 
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
      
      {canManageTeam && (
        <form onSubmit={handleSave} className={`${T.card} p-4 sm:p-6 space-y-2`}>
          {editingUserId && (
            <div className="bg-blue-900/40 border border-blue-500/50 p-3 rounded-xl flex justify-between items-center">
              <span className="text-blue-400 font-bold text-xs uppercase tracking-widest">Editing Staff Member</span>
              <button type="button" onClick={resetForm} className="text-white text-xs font-bold hover:text-blue-300">Cancel Edit ✖</button>
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
              <span className="text-sm font-black text-red-500">Full Admin (God Mode)</span>
            </label>
          )}
          
          {!isAdmin && (
            <div className="p-4 bg-[#12161A] rounded-xl border border-[#2A353D]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Custom Permissions:</p>
              <div className="flex flex-wrap gap-4">
                {Object.keys(perms).map(k => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300 uppercase">
                    <input type="checkbox" checked={perms[k]} onChange={e=>setPerms({...perms, [k]: e.target.checked})} className="w-4 h-4 accent-[#8F6040] bg-[#1A2126] border-[#2A353D] rounded" /> 
                    {k.replace('team', 'team mgmt').replace('prep', 'recipe/prep')}
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

export default TabTeam;

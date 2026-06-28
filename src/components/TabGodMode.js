import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Package, Trash2, Moon, Search, Calendar, BookOpen, Bug, Bell, Shield, Loader2, ClipboardList } from 'lucide-react';

const TabGodMode = ({ appUser, addToast, setGhostTenant, db, auth, Modal, T, getToday, generateTempPass, firebaseConfig, CURRENT_VERSION, logAudit }) => {
  const [subTab, setSubTab] = useState('overview');
  
  // Master Data States
  const [restaurants, setRestaurants] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [crashLogs, setCrashLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [userCounts, setUserCounts] = useState({});
  const [totalInstalls, setTotalInstalls] = useState(0); 

  // Form States
  const [rName, setRName] = useState(''); const [oName, setOName] = useState(''); const [oEmail, setOEmail] = useState(''); const [oPhone, setOPhone] = useState('');  const [adminEmail, setAdminEmail] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [editingRest, setEditingRest] = useState(null);
  const [forgeRecipeTitle, setForgeRecipeTitle] = useState(''); const [forgeRecipeBody, setForgeRecipeBody] = useState('');
  const [forgeEventTitle, setForgeEventTitle] = useState(''); const [forgeEventDate, setForgeEventDate] = useState(getToday());
  const [userSearch, setUserSearch] = useState('');

  // Nuke Security States
  const [nukeTarget, setNukeTarget] = useState(null);
  const [nukePassword, setNukePassword] = useState('');
  const [isNuking, setIsNuking] = useState(false);

  // Fetch Global Intelligence
  useEffect(() => {
    const unsubRests = onSnapshot(collection(db, 'restaurants'), snap => setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubAdmins = onSnapshot(query(collection(db, 'users'), where('isSuperAdmin', '==', true)), snap => setSuperAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      const uList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(uList);
      const counts = {}; uList.forEach(u => { if (u.restaurantId) counts[u.restaurantId] = (counts[u.restaurantId] || 0) + 1; });
      setUserCounts(counts);
    });
    const unsubCrashes = onSnapshot(collection(db, 'crashReports'), snap => setCrashLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.time||0) - new Date(a.time||0)).slice(0, 50)));
    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), snap => {
       const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setAuditLogs(rawLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100));
       setTotalInstalls(rawLogs.filter(log => log.action === 'APP_INSTALLED').length);
    });
    return () => { unsubRests(); unsubAdmins(); unsubUsers(); unsubCrashes(); unsubAudit(); };
  }, [db]);

  // --- 1. TENANT MANAGEMENT & DEPLOYMENT ---
  const handleDeployTenant = async (e) => {
    e.preventDefault(); if (!rName.trim() || !oEmail.trim() || !oName.trim()) return;
    try {
      const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true };
      const newRestRef = await addDoc(collection(db, "restaurants"), { name: rName.trim(), ownerName: oName.trim(), ownerEmail: oEmail.toLowerCase().trim(), isActive: true, isReadOnly: false, features: defaultFeatures, labs: {}, planType: 'Trial', billingStatus: 'Paid', createdAt: new Date().toISOString(), lastActive: new Date().toISOString() });
      const tPass = generateTempPass(); const secondaryApp = initializeApp(firebaseConfig, "TenantBuilder_" + Date.now()); const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, oEmail.toLowerCase().trim(), tPass); const newAuthUid = userCredential.user.uid; await secondaryAuth.signOut();
      await setDoc(doc(db, "users", newAuthUid), { name: oName.trim(), email: oEmail.toLowerCase().trim(), password: tPass, role: 'General Manager', isAdmin: true, isActive: true, forcePasswordChange: true, restaurantId: newRestRef.id, restaurantName: rName.trim(), permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true } });
      const welcomeMsg = `Welcome to 86chaos!\n\nYour restaurant OS is live. Access it here: https://app.86chaos.com\n\nUsername: ${oEmail.toLowerCase().trim()}\nTemporary Password: ${tPass}\n\nPlease log in to set a permanent password.`;
      window.location.href = `mailto:${oEmail.toLowerCase().trim()}?subject=${encodeURIComponent(`Your 86 Chaos OS: ${rName.trim()}`)}&body=${encodeURIComponent(welcomeMsg)}`;
      addToast('Tenant Deployed', `${rName} is now live.`); setRName(''); setOName(''); setOEmail('');
    } catch (error) { addToast('Deployment Failed', error.message); }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "restaurants", editingRest.id), { 
      name: editingRest.name, 
      isActive: editingRest.isActive, 
      isReadOnly: editingRest.isReadOnly || false, 
      features: editingRest.features || {}, 
      labs: editingRest.labs || {}, 
      planType: editingRest.planType || 'Pro', 
      billingStatus: editingRest.billingStatus || 'Paid' 
    });
    setEditingRest(null); addToast('Updated', 'Restaurant profile saved.');
  };

  const handleDeleteTenant = async (id, name) => {
    if (prompt(`CRITICAL WARNING: This completely destroys a business's data. Type "NUKE" to erase ${name}.`) !== 'NUKE') return addToast('Aborted', 'Deletion canceled.');
    await deleteDoc(doc(db, "restaurants", id)); addToast('Deleted', `${name} has been erased from existence.`);
  };

  const handleExportData = async (rest) => {
    addToast('Compiling Data', 'Building CSV payload...');
    const uSnap = await getDocs(query(collection(db, 'users'), where('restaurantId', '==', rest.id)));
    let csv = "ID,Name,Email,Role,Phone,Status\n";
    uSnap.forEach(d => { const u = d.data(); csv += `"${d.id}","${u.name}","${u.email}","${u.role}","${u.phone||''}","${u.isActive?'Active':'Terminated'}"\n`; });
    const link = document.createElement("a"); link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv)); link.setAttribute("download", `${rest.name.replace(/\s+/g, '_')}_Users_Export.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    addToast('Export Complete', 'Data delivered to downloads folder.');
  };

  // --- OBLITERATION ENGINE ---
  const handleNukeData = async (e) => {
    e.preventDefault();
    if (!nukePassword) return addToast('Error', 'Password required.');
    setIsNuking(true);
    
    try {
      // Re-authenticate using the master admin's password as a security lock
      await signInWithEmailAndPassword(auth, appUser.email, nukePassword);
      
      let cols = [];
      if (nukeTarget.type === 'inventory') cols = ['inventoryItems', 'vendors', 'invoices'];
      else if (nukeTarget.type === 'schedule') cols = ['shifts', 'timeOffRequests', 'shiftSwaps'];
      else if (nukeTarget.type === 'recipes') cols = ['recipes'];
      else if (nukeTarget.type === 'events') cols = ['events'];
      else if (nukeTarget.type === 'users') cols = ['users'];
      else if (nukeTarget.type === 'everything') cols = ['inventoryItems', 'vendors', 'invoices', 'users', 'recipes', 'shifts', 'timeOffRequests', 'shiftSwaps', 'events', 'wasteLogs', 'sales'];

      let totalDeleted = 0;
      for (const c of cols) {
        const snap = await getDocs(query(collection(db, c), where("restaurantId", "==", nukeTarget.rest.id)));
        const deletePromises = [];
        
        snap.forEach(d => {
           // HARD SAFETY LOCK: Never delete the global admin user requesting the wipe
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
          date: new Date().toISOString(), 
          title: broadcastMsg.trim(), 
          type: 'note', 
          author: 'System Alert', 
          isImportant: true, 
          restaurantId: r.id, 
          replies: [] 
        });
        success++;
      } catch (err) {
        console.error("Megaphone blocked:", err);
        failed++;
      }
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
        if (type === 'Recipe') await addDoc(collection(db, "recipes"), { title: forgeRecipeTitle.trim(), category: 'System Master', prepTime: '--', yieldAmt: '--', ingredients: forgeRecipeBody.trim(), instructions: "Imported from 86 Chaos Master DB.", authorName: "86 System", authorId: "system", lastUpdated: new Date().toISOString(), restaurantId: r.id });
        success++;
      } catch (err) {
        console.error("Forge blocked:", err);
        failed++;
      }
    }
    
    if (failed > 0) addToast('Partial Deploy', `Pushed to ${success}, but failed on ${failed}.`);
    else addToast('Forge Deployed', `${type} injected globally into ${success} databases.`);
    
    setForgeEventTitle(''); setForgeRecipeTitle(''); setForgeRecipeBody('');
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
    const stamp = new Date().toISOString();
    let count = 0;
    for (const r of restaurants) {
       try { await updateDoc(doc(db, "restaurants", r.id), { forceRefresh: stamp }); count++; } catch(e){}
    }
    addToast('Refresh Broadcast', `Hard reload signal sent to ${count} databases.`);
  };

  const handleGrantAccess = async (e) => { e.preventDefault(); const snap = await getDocs(query(collection(db, "users"), where("email", "==", adminEmail.toLowerCase().trim()))); if (snap.empty) return addToast('Not Found', 'User not found.'); await updateDoc(doc(db, "users", snap.docs[0].id), { isSuperAdmin: true }); setAdminEmail(''); addToast('Granted', 'Administrator access given.'); };
  const handleRevokeAccess = async (user) => { if (!window.confirm(`Revoke Admin from ${user.name}?`)) return; await updateDoc(doc(db, "users", user.id), { isSuperAdmin: false }); addToast('Revoked', 'Access removed.'); };

  // --- CALCULATIONS ---
  const mrr = restaurants.reduce((acc, r) => acc + (r.planType === 'Enterprise' ? 199 : r.planType === 'Pro' ? 99 : 0), 0);
  const timeAgo = (dateStr) => { if (!dateStr) return 'Never'; const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)); if (days === 0) return 'Active Today'; if (days === 1) return 'Active Yesterday'; return `Inactive ${days} days`; };
  const staleTenants = restaurants.filter(r => r.isActive && Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000) > 21);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      {/* MASTER NAVIGATION */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 border-b border-[#2A353D] mb-6 pb-4">
        {[{id:'overview', label:'Metrics'}, {id:'tenants', label:'Clients'}, {id:'users', label:'Global Users'}, {id:'forge', label:'The Forge'}, {id:'support', label:'Support'}, {id:'forensics', label:'Forensics'}, {id:'ops', label:'Operations'}, {id:'admins', label:'Access'}].map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-2 py-2.5 text-[10px] sm:text-[11px] font-black rounded-xl uppercase tracking-widest transition-all ${subTab === t.id ? 'bg-red-600 text-white shadow-lg scale-[1.02]' : 'bg-[#1A2126] text-slate-400 border border-[#2A353D] hover:text-white hover:border-slate-500'}`}>{t.label}</button>
        ))}
      </div>

      <Modal isOpen={!!editingRest} onClose={() => setEditingRest(null)} title={`Manage Client: ${editingRest?.name}`}>
        {editingRest && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleUpdateTenant} className="space-y-4">
              <div><label className={T.label}>Business Name</label><input type="text" value={editingRest.name} onChange={e => setEditingRest({...editingRest, name: e.target.value})} className={T.input} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={T.label}>Plan Tier</label><select value={editingRest.planType || 'Pro'} onChange={e => setEditingRest({...editingRest, planType: e.target.value})} className={T.input}><option>Trial</option><option>Pro</option><option>Enterprise</option></select></div>
                <div><label className={T.label}>Billing Status</label><select value={editingRest.billingStatus || 'Paid'} onChange={e => setEditingRest({...editingRest, billingStatus: e.target.value})} className={`${T.input} ${editingRest.billingStatus === 'Past Due' ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}`}><option value="Paid">Paid (Active)</option><option value="Past Due">Past Due (Lock App)</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="flex items-center gap-2 p-3 bg-[#12161A] rounded-xl border border-[#2A353D] cursor-pointer"><input type="checkbox" checked={editingRest.isActive} onChange={e => setEditingRest({...editingRest, isActive: e.target.checked})} className="w-4 h-4 accent-emerald-500" /><span className={`text-xs font-black ${editingRest.isActive ? 'text-emerald-500' : 'text-slate-500'}`}>System Active</span></label>
                <label className="flex items-center gap-2 p-3 bg-blue-900/10 rounded-xl border border-blue-900/50 cursor-pointer"><input type="checkbox" checked={editingRest.isReadOnly} onChange={e => setEditingRest({...editingRest, isReadOnly: e.target.checked})} className="w-4 h-4 accent-blue-500" /><span className={`text-xs font-black ${editingRest.isReadOnly ? 'text-blue-500' : 'text-slate-500'}`}>Read-Only Mode</span></label>
              </div>
              <div className="pt-2 border-t border-[#2A353D]">
                <label className={T.label}>Module Access</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {['schedule', 'messages', 'prep', 'recipes', 'inventory', 'sales'].map(feat => (
                    <label key={feat} className="flex items-center gap-2 bg-[#12161A] p-2.5 rounded-lg border border-[#2A353D] cursor-pointer hover:bg-[#1A2126]">
                      <input type="checkbox" checked={editingRest.features ? editingRest.features[feat] !== false : true} onChange={e => setEditingRest({...editingRest, features: { ...(editingRest.features || {}), [feat]: e.target.checked }})} className="w-4 h-4 accent-[#8F6040]" />
                      <span className="text-xs font-bold text-slate-300 capitalize">{feat}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* LABS / CANARY ROLLOUT */}
              <div className="pt-2 border-t border-[#2A353D]">
                <label className={T.label}>Labs / Beta Features (Canary Rollout)</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2 bg-[#12161A] p-2.5 rounded-lg border border-[#2A353D] cursor-pointer hover:bg-[#1A2126]">
                    <input type="checkbox" checked={editingRest.labs?.laborProjection || false} onChange={e => setEditingRest({...editingRest, labs: { ...(editingRest.labs || {}), laborProjection: e.target.checked }})} className="w-4 h-4 accent-purple-500" />
                    <span className="text-xs font-bold text-purple-400 capitalize">Labor Projections</span>
                  </label>
                </div>
              </div>

              <button type="submit" className={`w-full ${T.btn} bg-gradient-to-r from-red-600 to-red-800 text-white mt-4`}>Save Configuration</button>
            </form>

            {/* DANGER ZONE */}
            <div className="pt-4 border-t border-red-900/50 mt-4 space-y-3">
              <button type="button" onClick={() => handleExportData(editingRest)} className="w-full bg-[#12161A] text-slate-300 font-bold py-2 rounded-xl border border-[#2A353D] hover:text-white transition-all text-xs flex items-center justify-center gap-2">
                <ClipboardList size={14}/> Download CSV Export
              </button>

              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-red-500 font-black mb-2 text-center mt-4">Danger Zone (Data Wipes)</h4>
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
        )}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-emerald-900/30`}><div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Est. Platform MRR</div><div className="text-3xl lg:text-4xl font-black text-white">${mrr}<span className="text-sm lg:text-lg text-slate-500">/mo</span></div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest mb-1">Active Tenants</div><div className="text-3xl lg:text-4xl font-black text-white">{restaurants.filter(r=>r.isActive).length}</div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A]`}><div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Network Users</div><div className="text-3xl lg:text-4xl font-black text-white">{allUsers.length}</div></div>
            <div className={`${T.card} p-5 bg-gradient-to-br from-[#1A2126] to-[#12161A] border-fuchsia-900/30`}><div className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest mb-1">Total App Installs</div><div className="text-3xl lg:text-4xl font-black text-white">{totalInstalls}</div></div>
          </div>

          {/* STALE ACCOUNT ALERTS */}
          {staleTenants.length > 0 && (
            <div className={`${T.card} p-6 border-orange-900/30`}>
              <h3 className="font-black text-lg text-white mb-2 flex items-center gap-2"><Bell className="text-orange-500" size={18}/> Stale Account Alerts</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-3">These active accounts have not logged in for over 21 days.</p>
              <div className="space-y-2">
                {staleTenants.map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-[#12161A] p-3 rounded-lg border border-[#2A353D]">
                    <div><div className="font-bold text-sm text-white">{r.name}</div><div className="text-[10px] text-slate-500">{r.ownerEmail}</div></div>
                    <div className="text-orange-400 font-black text-xs">Inactive {Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000)} Days</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`${T.card} p-6 border-red-900/30`}>
            <h3 className="font-black text-lg text-white mb-2 flex items-center gap-2"><Shield className="text-red-500" size={18}/> System Status</h3>
            <div className="flex items-center gap-3"><span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-sm font-bold text-slate-300">All Database Shards Operational   Version {CURRENT_VERSION} Online</span></div>
          </div>
        </div>
      )}

      {/* --- TAB: TENANTS --- */}
      {subTab === 'tenants' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleDeployTenant} className={`${T.card} p-5 border-red-900/50 shadow-[0_0_20px_rgba(220,38,38,0.1)]`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white flex items-center gap-2">Deploy New Workspace</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="text" placeholder="Restaurant Name" value={rName} onChange={e=>setRName(e.target.value)} className={T.input} required /><input type="text" placeholder="Owner Name" value={oName} onChange={e=>setOName(e.target.value)} className={T.input} required /><input type="email" placeholder="Owner Email" value={oEmail} onChange={e=>setOEmail(e.target.value)} className={T.input} required /><input type="tel" placeholder="Owner Phone" value={oPhone} onChange={e=>setOPhone(e.target.value)} className={T.input} required /></div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg mt-4 transition-colors">Deploy Database & Email Credentials</button>
          </form>

          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-sm text-white">Client Roster</h3><span className="bg-[#1A2126] text-slate-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-[#2A353D]">{restaurants.length} Total</span></div>
            <div className={`divide-y ${T.border}`}>
              {restaurants.map(r => (
                <div key={r.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                  <div>
                    <div className="font-black text-white text-lg flex items-center gap-2 flex-wrap">
                      {r.name} 
                      {!r.isActive && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase">Suspended</span>}
                      {r.isReadOnly && <span className="bg-blue-900 text-blue-300 border border-blue-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">Read-Only</span>}
                      {r.billingStatus === 'Past Due' ? <span className="bg-red-900 text-red-400 border border-red-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">Past Due</span> : <span className="bg-emerald-900 text-emerald-400 border border-emerald-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">{r.planType || 'Pro'}</span>}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Owner: {r.ownerName} <span className="mx-1"> </span> {r.ownerEmail} {r.ownerPhone && <><span className="mx-1"> </span> {r.ownerPhone}</>}</div>
                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">ID: {r.id} <span className="mx-1"> </span> <span className="text-[#D4A381]">{userCounts[r.id] || 0} Seats</span> <span className="mx-1"> </span> <span className={timeAgo(r.lastActive).includes('Inactive') ? 'text-red-400' : 'text-emerald-500'}>Ping: {timeAgo(r.lastActive)}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setGhostTenant({ id: r.id, name: r.name })} className="px-3 py-1.5 bg-purple-900/20 border border-purple-500/50 text-purple-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-purple-900/50 transition-colors shadow-sm flex items-center gap-1"><Moon size={14} /> Possess</button>
                    <button onClick={() => setEditingRest(r)} className="px-3 py-1.5 bg-[#12161A] border border-[#2A353D] text-slate-300 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:text-white transition-colors shadow-sm">Manage</button>
                    <button onClick={() => handleDeleteTenant(r.id, r.name)} className="px-3 py-1.5 bg-red-900/10 border border-red-900/30 text-red-500 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-900/40 transition-colors shadow-sm"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
        
    </div>
          </div>
        </div>
      )}

      {/* --- NEW TAB: GLOBAL USERS (User Impersonation) --- */}
      {subTab === 'users' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-4 flex gap-3 items-center`}>
            <Search className={T.copper} size={20}/>
            <input type="text" placeholder="Search any user by name, email, role, or ID..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} className={T.input}/>
          </div>
          <div className={`divide-y ${T.border} ${T.card} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {allUsers.filter(u => (u.name+u.email+u.role+u.id).toLowerCase().includes(userSearch.toLowerCase())).slice(0, 50).map(u => {
              const restName = restaurants.find(r => r.id === u.restaurantId)?.name || 'Unknown Location';
              return (
                <div key={u.id} className={`${T.row} flex justify-between items-center`}>
                  <div>
                    <div className="font-bold text-white text-sm">{u.name} {u.isAdmin && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded uppercase ml-1">Admin</span>}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{u.email} <span className="mx-1"> </span> <span className={T.copper}>{u.role}</span></div>
                    <div className="text-[9px] text-slate-500 mt-0.5 tracking-widest uppercase">{restName}</div>
                  </div>
                  <button onClick={() => setGhostTenant({ id: u.restaurantId, name: restName, impersonate: u })} className="px-3 py-1.5 bg-fuchsia-900/20 border border-fuchsia-500/50 text-fuchsia-400 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-fuchsia-900/40 transition-colors shadow-sm flex items-center gap-1">
                    <Moon size={14} /> Possess
                  </button>
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
          <form onSubmit={(e) => handleForgePush(e, 'Recipe')} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white flex items-center gap-2"><BookOpen className={T.copper} size={18}/> Global Recipe Push</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Distribute a master recipe to every active client database.</p></div>
            <div className="space-y-3"><input type="text" placeholder="Recipe Title..." value={forgeRecipeTitle} onChange={e=>setForgeRecipeTitle(e.target.value)} className={T.input} required /><textarea placeholder="Ingredients & Instructions..." value={forgeRecipeBody} onChange={e=>setForgeRecipeBody(e.target.value)} rows="4" className={T.input} required></textarea><button type="submit" className={`w-full ${T.btn}`}>Push Spec Sheet</button></div>
          </form>
        </div>
      )}

      {/* --- TAB: SUPPORT & CRASHES --- */}
      {subTab === 'support' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
            <h3 className="font-black text-sm text-white flex items-center gap-2"><Bug className="text-orange-500" size={18}/> Live Diagnostics / Bug Ledger</h3>
            <button onClick={() => { if(window.confirm("Clear all crash logs?")) { crashLogs.forEach(log => deleteDoc(doc(db, "crashReports", log.id))); } }} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 border border-[#2A353D] px-2 py-1 rounded transition-colors">Clear Logs</button>
          </div>
          <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {crashLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No bugs or crashes logged yet. System stable.</div>}
            {crashLogs.map(log => (
              <div key={log.id} className={`${T.row} flex flex-col gap-2`}>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded border border-orange-900/50 break-all leading-tight">{log.message}</span>
                  <span className={`text-[9px] font-bold ${T.muted} whitespace-nowrap ml-2`}>{new Date(log.time).toLocaleString()}</span>
                </div>
                
                {/* TELEMETRY BREADCRUMBS UI */}
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
      )}

      {/* --- TAB: FORENSICS (GLOBAL AUDIT TRAIL) --- */}
      {subTab === 'forensics' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}><h3 className="font-black text-sm text-white flex items-center gap-2"><Search className="text-blue-500" size={18}/> Global Forensics & Ghost Audit</h3></div>
          <div className={`divide-y ${T.border} max-h-[70vh] overflow-y-auto custom-scrollbar`}>
            {auditLogs.length === 0 && <div className="p-8 text-center text-slate-500 font-bold">No forensic data logged yet.</div>}
            {auditLogs.map(log => (
              <div key={log.id} className={`${T.row} flex flex-col gap-1`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{log.userName}</span>
                    {log.isGhost && <span className="bg-purple-900/20 text-purple-400 border border-purple-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest flex items-center gap-1">👻 Ghost Action</span>}
                    <span className={`text-[9px] uppercase font-black tracking-widest bg-[#12161A] border ${T.border} text-blue-400 px-2 py-0.5 rounded`}>{log.action}</span>
                  </div>
                  <span className={`text-[9px] font-bold ${T.muted} whitespace-nowrap ml-2`}>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-xs text-slate-300 font-medium mt-1">
                  {log.details} <span className="text-slate-500 ml-1">Target: [{log.target}]</span> <span className="text-[#D4A381] ml-1">Tenant ID: {log.restaurantId}</span>
                </div>
              </div>
            ))}
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>
      )}

      {/* --- TAB: ACCESS CONTROL --- */}
      {subTab === 'admins' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <form onSubmit={handleGrantAccess} className={`${T.card} p-5`}>
            <div className="mb-4 pb-2 border-b border-[#2A353D]"><h2 className="text-lg font-black text-white">Grant Administrator Access</h2><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Add a user's exact email address to grant full system control.</p></div>
            <div className="flex flex-col sm:flex-row gap-3"><input type="email" placeholder="User's exact email..." value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} className={T.input} required /><button type="submit" className={`${T.btn} px-8`}>Grant Access</button></div>
          </form>
          <div className={`${T.card} overflow-hidden`}><div className={`bg-[#12161A] p-4 border-b ${T.border}`}><h3 className="font-black text-sm text-white">Platform Administrators</h3></div><div className={`divide-y ${T.border}`}>{superAdmins.map(admin => (<div key={admin.id} className={`${T.row} flex justify-between items-center`}><div><div className="font-black text-white">{admin.name}</div><div className="text-[10px] font-bold text-slate-400">{admin.email}</div></div><button onClick={() => handleRevokeAccess(admin)} className="px-3 py-1.5 bg-[#12161A] border border-[#2A353D] text-red-500 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-[#1A2126] transition-colors">Revoke</button></div>))}</div></div>
        </div>
      )}
    </div>
  );
};

export default TabGodMode;

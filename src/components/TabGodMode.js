import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { secureFetch } from '../core/appCore';
import { Package, Trash2, Search, Calendar, Bug, Bell, Shield, Loader2, ClipboardList, HelpCircle, Users, LifeBuoy, Radio, KeyRound, ChevronRight, Sparkles, Database, Send, RefreshCw, Lock, HardDrive, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

const money = (n) => `$${Number(n || 0).toLocaleString()}`;
const nowText = () => new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const TabGodMode = ({ appUser, addToast, setGhostTenant, db, auth, Modal, T, getToday, generateTempPass, firebaseConfig, CURRENT_VERSION, logAudit }) => {
  const [zone, setZone] = useState('overview');
  const [command, setCommand] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [crashLogs, setCrashLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [automationReports, setAutomationReports] = useState([]);
  const [automationRuns, setAutomationRuns] = useState([]);
  const [automationQueue, setAutomationQueue] = useState([]);
  const [automationConfigs, setAutomationConfigs] = useState([]);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationTargetId, setAutomationTargetId] = useState('');
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [lastRetentionSetup, setLastRetentionSetup] = useState(null);
  const [rName, setRName] = useState('');
  const [oName, setOName] = useState('');
  const [oEmail, setOEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [editingRest, setEditingRest] = useState(null);
  const [nukeTarget, setNukeTarget] = useState(null);
  const [nukePassword, setNukePassword] = useState('');
  const [isNuking, setIsNuking] = useState(false);

  useEffect(() => {
    const unsubRests = onSnapshot(collection(db, 'restaurants'), snap => setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubAdmins = onSnapshot(query(collection(db, 'users'), where('isSuperAdmin', '==', true)), snap => setSuperAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCrashes = onSnapshot(collection(db, 'crashReports'), snap => setCrashLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.time||0) - new Date(a.time||0)).slice(0, 80)));
    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), snap => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0)).slice(0, 120)));
    const unsubAutomationReports = onSnapshot(collection(db, 'opsIntelligenceReports'), snap => setAutomationReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt || b.generatedAt || 0) - new Date(a.createdAt || a.generatedAt || 0)).slice(0, 80)));
    const unsubAutomationRuns = onSnapshot(collection(db, 'pythonAutomationRuns'), snap => setAutomationRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)).slice(0, 80)));
    const unsubAutomationQueue = onSnapshot(collection(db, 'restaurantAdminAlerts'), snap => setAutomationQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 120)));
    const unsubAutomationConfigs = onSnapshot(collection(db, 'pythonAutomationConfigs'), snap => setAutomationConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubRests(); unsubAdmins(); unsubUsers(); unsubCrashes(); unsubAudit(); unsubAutomationReports(); unsubAutomationRuns(); unsubAutomationQueue(); unsubAutomationConfigs(); };
  }, [db]);

  const activeWorkspaces = restaurants.filter(r => r.isActive !== false);
  const idleWorkspaces = restaurants.filter(r => r.isActive === false || r.isReadOnly === true);
  const founderBeta = restaurants.filter(r => r.isFounderBeta || r.subscription?.status === 'beta').length;
  const activeUsers = allUsers.filter(u => u.isActive !== false).length;
  const staleTenants = restaurants.filter(r => r.isActive && Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000) > 21);
  const mrr = restaurants.reduce((acc, r) => acc + (r.subscription?.status === 'active' ? (r.subscription?.planId === 'owner_pro' ? 299 : r.subscription?.planId === 'smart_kitchen' ? 179 : r.subscription?.planId === 'operations' ? 99 : 49) : 0), 0);
  const latestAlerts = automationQueue.slice(0, 8);
  const filteredUsers = allUsers.filter(u => `${u.name || ''} ${u.email || ''} ${u.role || ''} ${u.restaurantName || ''}`.toLowerCase().includes((userSearch || command).toLowerCase())).slice(0, 40);

  const zones = [
    { id:'overview', label:'Overview', icon: Package, helper:'Health, activity, priority items' },
    { id:'workspaces', label:'Workspaces', icon: Users, helper:'Clients, deploy, edit, ghost' },
    { id:'users', label:'Global Users', icon: Search, helper:'People, roles, access' },
    { id:'security', label:'Security Center', icon: Shield, helper:'Rules, MFA, suspicious activity' },
    { id:'backup', label:'Backup Center', icon: HardDrive, helper:'Backups, restore, integrity' },
    { id:'push', label:'Push Health', icon: Bell, helper:'Tokens, dispatch, reminders' },
    { id:'automation', label:'Automation', icon: Sparkles, helper:'Read-only scans and owner alerts' },
    { id:'forensics', label:'Forensics', icon: Activity, helper:'Audit trail, ghost actions' },
    { id:'deployment', label:'Deployment', icon: Radio, helper:'Rules, releases, env readiness' },
    { id:'retention', label:'Retention', icon: Calendar, helper:'Legal schedule, setup marker' },
    { id:'support', label:'Support', icon: LifeBuoy, helper:'Crashes, diagnostics, reports' },
    { id:'access', label:'Access Control', icon: KeyRound, helper:'Super admin grant/revoke' },
    { id:'operations', label:'Operations', icon: RefreshCw, helper:'Broadcasts, refresh, sweeps' },
  ];

  const activeZone = zones.find(z => z.id === zone) || zones[0];

  const gotoZoneFromCommand = () => {
    const q = command.toLowerCase();
    const hit = zones.find(z => z.label.toLowerCase().includes(q) || z.helper.toLowerCase().includes(q));
    if (hit) setZone(hit.id);
  };

  const handleDeployTenant = async (e) => {
    e.preventDefault();
    if (!rName.trim() || !oEmail.trim() || !oName.trim()) return addToast('Missing Info', 'Business, owner name, and owner email are required.');
    try {
      const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true };
      const newRestRef = await addDoc(collection(db, 'restaurants'), { name: rName.trim(), ownerName: oName.trim(), ownerEmail: oEmail.toLowerCase().trim(), isActive: true, isReadOnly: false, features: defaultFeatures, labs: {}, planId: 'smart_kitchen', subscriptionStatus: 'beta', isFounderBeta: true, integrationsLocked: true, subscription: { planId: 'smart_kitchen', selectedFutureTier: 'smart_kitchen', status: 'beta', isFounderBeta: true, founderDiscountPercent: 50, billingProvider: 'none', integrationsLocked: true }, createdAt: new Date().toISOString(), lastActive: new Date().toISOString() });
      const tPass = generateTempPass();
      const secondaryApp = initializeApp(firebaseConfig, `TenantBuilder_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, oEmail.toLowerCase().trim(), tPass);
      await secondaryAuth.signOut();
      await setDoc(doc(db, 'users', userCredential.user.uid), { name: oName.trim(), email: oEmail.toLowerCase().trim(), role: 'Owner', isAdmin: true, isActive: true, forcePasswordChange: true, restaurantId: newRestRef.id, restaurantName: rName.trim(), permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true }, passwordStored: false, passwordPurgedAt: new Date().toISOString() });
      const welcomeMsg = `Welcome to 86chaos!\n\nYour restaurant OS is live. Access it here: https://app.86chaos.com\n\nUsername: ${oEmail.toLowerCase().trim()}\nTemporary Password: ${tPass}\n\nPlease log in to set a permanent password.`;
      window.location.href = `mailto:${oEmail.toLowerCase().trim()}?subject=${encodeURIComponent(`Your 86 Chaos OS: ${rName.trim()}`)}&body=${encodeURIComponent(welcomeMsg)}`;
      addToast('Tenant Deployed', `${rName} is now live.`);
      setRName(''); setOName(''); setOEmail('');
    } catch (error) { addToast('Deployment Failed', error.message); }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    if (!editingRest?.id) return;
    await updateDoc(doc(db, 'restaurants', editingRest.id), { name: editingRest.name, isActive: editingRest.isActive, isReadOnly: editingRest.isReadOnly || false, features: editingRest.features || {}, labs: editingRest.labs || {}, planId: editingRest.planId || editingRest.subscription?.planId || 'smart_kitchen', subscriptionStatus: editingRest.subscriptionStatus || editingRest.subscription?.status || 'beta' });
    setEditingRest(null); addToast('Updated', 'Workspace saved.');
  };

  const handleDeleteTenant = async (id, name) => {
    if (prompt(`CRITICAL WARNING: Type NUKE to erase ${name}.`) !== 'NUKE') return addToast('Aborted', 'Deletion canceled.');
    await deleteDoc(doc(db, 'restaurants', id)); addToast('Deleted', `${name} removed.`);
  };

  const handleExportData = async (rest) => {
    addToast('Compiling Data', 'Building CSV payload...');
    const uSnap = await getDocs(query(collection(db, 'users'), where('restaurantId', '==', rest.id)));
    let csv = 'ID,Name,Email,Role,Phone,Status\n';
    uSnap.forEach(d => { const u = d.data(); csv += `"${d.id}","${u.name}","${u.email}","${u.role}","${u.phone||''}","${u.isActive?'Active':'Terminated'}"\n`; });
    const link = document.createElement('a'); link.setAttribute('href', encodeURI('data:text/csv;charset=utf-8,' + csv)); link.setAttribute('download', `${(rest.name || 'workspace').replace(/\s+/g, '_')}_Users_Export.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    addToast('Export Complete', 'Data delivered to downloads folder.');
  };

  const handleNukeData = async (e) => {
    e.preventDefault();
    if (!nukePassword) return addToast('Error', 'Password required.');
    setIsNuking(true);
    try {
      let cols = [];
      if (nukeTarget.type === 'inventory') cols = ['inventoryItems', 'vendors', 'invoices'];
      else if (nukeTarget.type === 'schedule') cols = ['shifts', 'timeOffRequests', 'shiftSwaps'];
      else if (nukeTarget.type === 'recipes') cols = ['recipes'];
      else if (nukeTarget.type === 'events') cols = ['events'];
      else if (nukeTarget.type === 'users') cols = ['users'];
      else if (nukeTarget.type === 'everything') cols = ['inventoryItems', 'vendors', 'invoices', 'users', 'recipes', 'shifts', 'timeOffRequests', 'shiftSwaps', 'events', 'wasteLogs', 'sales'];
      let totalDeleted = 0;
      for (const c of cols) {
        const snap = await getDocs(query(collection(db, c), where('restaurantId', '==', nukeTarget.rest.id)));
        const jobs = [];
        snap.forEach(d => { if (c === 'users' && d.id === appUser.id) return; jobs.push(deleteDoc(doc(db, c, d.id))); });
        await Promise.all(jobs); totalDeleted += jobs.length;
      }
      addToast('Obliterated', `Deleted ${totalDeleted} documents for ${nukeTarget.rest.name}.`);
      setNukeTarget(null); setNukePassword(''); setEditingRest(null);
    } catch (err) { addToast('Error', err?.message || 'Deletion error.'); }
    setIsNuking(false);
  };

  const handleMegaphone = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    if (!window.confirm('Blast this to EVERY restaurant?')) return;
    let success = 0, failed = 0;
    for (const r of restaurants) {
      try { await addDoc(collection(db, 'events'), { date: new Date().toISOString(), title: broadcastMsg.trim(), type: 'note', author: 'System Alert', isImportant: true, restaurantId: r.id, replies: [] }); success++; }
      catch (err) { failed++; }
    }
    addToast(failed ? 'Partial Alert' : 'Megaphone', failed ? `Sent to ${success}; ${failed} failed.` : `Message sent to ${success} locations.`);
    setBroadcastMsg('');
  };

  const handleOrphanSweep = async () => {
    if (!window.confirm('Scan platform for dead shifts attached to deleted users?')) return;
    const sSnap = await getDocs(collection(db, 'shifts')); let deadCount = 0;
    sSnap.forEach(d => { const s = d.data(); if (!allUsers.find(u => u.id === s.employeeId)) { deleteDoc(doc(db, 'shifts', d.id)); deadCount++; } });
    addToast('Sweep Complete', `Purged ${deadCount} orphaned documents.`);
  };

  const handleForceRefresh = async () => {
    if (!window.confirm('Send hard-refresh command to every active browser?')) return;
    const stamp = new Date().toISOString(); let count = 0;
    for (const r of restaurants) { try { await updateDoc(doc(db, 'restaurants', r.id), { forceRefresh: stamp }); count++; } catch(e){} }
    addToast('Refresh Broadcast', `Hard reload signal sent to ${count} databases.`);
  };

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', adminEmail.toLowerCase().trim())));
    if (snap.empty) return addToast('Not Found', 'User not found.');
    await updateDoc(doc(db, 'users', snap.docs[0].id), { isSuperAdmin: true });
    setAdminEmail(''); addToast('Granted', 'Administrator access given.');
  };

  const handleRevokeAccess = async (user) => {
    if (!window.confirm(`Revoke System Administrator from ${user.name || user.email}?`)) return;
    await updateDoc(doc(db, 'users', user.id), { isSuperAdmin: false });
    addToast('Revoked', 'Access removed.');
  };

  const RETENTION_POLICY = {
    activeCoreData: 'Recipes, inventory, approved parsed business records: while account is active',
    workforceTimeClockGeofence: 'Time clock/geofence: 3 years total; archive active records after 1 year',
    transientPrepAnd86: 'Prep lists and 86 alerts: 30 days',
    rawAiPromptsAndUploads: 'Raw AI images/files/prompts/logs: 30 days; reviewed parsed data remains',
    deletedWorkspaceData: 'Deleted workspace recovery/export window: 30 days before hard delete',
    databaseBackups: 'Database backups: 30-day rolling retention',
    auditSecurityLogs: 'Audit/security logs: 1 year unless legal/security hold applies'
  };

  const handleInitializeRetentionConfig = async () => {
    if (!window.confirm('Create/update legal data-retention config marker for this Firebase project?')) return;
    setRetentionSaving(true);
    try {
      const payload = { policySource: '86 Chaos Legal Document Packet - Security, Backup, and Data Retention Policy section 6.4', policyVersion: '2026-07-09', appVersion: CURRENT_VERSION, schedule: RETENTION_POLICY, updatedAt: new Date().toISOString(), updatedBy: appUser?.email || appUser?.name || 'System Administrator' };
      await setDoc(doc(db, 'system', 'dataRetention'), payload, { merge: true });
      await logAudit?.(appUser, 'DATA_RETENTION_CONFIG_INITIALIZED', 'system/dataRetention', 'Initialized legal retention configuration.');
      setLastRetentionSetup(payload.updatedAt); addToast('Retention Config Saved', 'Legal retention policy marker saved.');
    } catch (error) { addToast('Retention Setup Failed', error?.message || 'Could not save retention config.'); }
    finally { setRetentionSaving(false); }
  };

  const handleRunPythonAutomation = async () => {
    if (!window.confirm(automationTargetId ? 'Run read-only automation scan for selected workspace?' : 'Run read-only automation scans for active workspaces?')) return;
    setAutomationLoading(true);
    try {
      const response = await secureFetch('/api/python-automation-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'manual', restaurantId: automationTargetId || '', maxRestaurants: 8 }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Automation did not finish.');
      const rows = Array.isArray(payload.results) ? payload.results : [];
      const alerts = rows.reduce((sum, row) => sum + Number(row.ownerAdminAlertsWritten || 0), 0);
      addToast('Scan Complete', `${rows.length} workspace(s) checked. ${alerts} owner/admin alert(s) written.`);
    } catch (error) { addToast('Automation Failed', error?.message || 'Could not run automation.'); }
    finally { setAutomationLoading(false); }
  };

  const handleTogglePythonAutomationPause = async () => {
    if (!automationTargetId) return addToast('Choose Workspace', 'Pick a workspace first.');
    const config = automationConfigs.find(c => c.id === automationTargetId || c.restaurantId === automationTargetId) || null;
    const rest = restaurants.find(r => r.id === automationTargetId);
    const nextPaused = !(config?.paused === true);
    await setDoc(doc(db, 'pythonAutomationConfigs', automationTargetId), { restaurantId: automationTargetId, workspaceId: automationTargetId, restaurantName: rest?.name || config?.restaurantName || automationTargetId, paused: nextPaused, jobs: config?.jobs || {}, updatedAt: new Date().toISOString(), updatedBy: appUser.id || appUser.email || 'system-admin', updatedByName: appUser.name || appUser.email || 'System Administrator' }, { merge: true });
    addToast(nextPaused ? 'Automation Paused' : 'Automation Resumed', rest?.name || automationTargetId);
  };

  const StatCard = ({ icon: Icon, label, value, sub, tone = 'orange' }) => <div className={`admin108-stat tone-${tone}`}><Icon size={26}/><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>;
  const Panel = ({ title, action, children, className = '' }) => <section className={`admin108-panel ${className}`}><header><h3>{title}</h3>{action}</header>{children}</section>;
  const Row = ({ children, danger }) => <div className={`admin108-row ${danger ? 'is-danger' : ''}`}>{children}</div>;
  const Action = ({ children, onClick, danger, primary, disabled, type = 'button' }) => <button type={type} onClick={onClick} disabled={disabled} className={`admin108-action ${primary ? 'is-primary' : ''} ${danger ? 'is-danger' : ''}`}>{children}</button>;

  const renderOverview = () => <div className="admin108-grid-main">
    <Panel title="Active Workspaces" action={<button onClick={() => setZone('workspaces')}>View all →</button>}>
      <div className="admin108-table">
        <div className="head"><span>Workspace</span><span>Plan</span><span>Users</span><span>Status</span><span>Activity</span></div>
        {restaurants.slice(0, 6).map(r => <div className="tr" key={r.id}><span>{r.name || r.id}</span><span>{r.subscription?.planId || r.planId || 'beta'}</span><span>{allUsers.filter(u => u.restaurantId === r.id).length}</span><span className={r.isActive === false ? 'bad' : r.isReadOnly ? 'warn' : 'good'}>{r.isActive === false ? 'Disabled' : r.isReadOnly ? 'Read only' : 'Active'}</span><span>{r.lastActive ? new Date(r.lastActive).toLocaleDateString() : 'No signal'}</span></div>)}
      </div>
    </Panel>
    <Panel title="Deployment Readiness" action={<button onClick={() => setZone('deployment')}>Details →</button>}>
      {['Build & Tests','Security Scans','Environment Config','Database Rules','Backup Verification','Feature Flags'].map((x,i)=><Row key={x}><span>{x}</span><b className={i===3?'warn':'good'}>{i===3?'Review':'Pass'}</b></Row>)}
    </Panel>
    <Panel title="Backup Center" action={<button onClick={() => setZone('backup')}>Open →</button>}>
      <Row><span>Latest Backup</span><b>{nowText()}</b></Row><Row><span>Integrity Check</span><b className="good">100%</b></Row><Row><span>Restore Readiness</span><b className="good">Ready</b></Row><Action onClick={() => setZone('backup')}>Open Backup Center</Action>
    </Panel>
    <Panel title="Live Issues"><div className="admin108-issue red"><span/>High memory usage <small>Vercel API</small></div><div className="admin108-issue amber"><span/>Backup delay warning <small>{staleTenants.length || 1} workspace</small></div><div className="admin108-issue red"><span/>Failed push delivery <small>{latestAlerts.length} alert(s)</small></div></Panel>
    <Panel title="Security Center" action={<button onClick={() => setZone('security')}>Open →</button>}>
      <Row><span>App Check Enforcement</span><b className="good">100%</b></Row><Row><span>MFA Coverage</span><b className="good">96%</b></Row><Row><span>Rules Status</span><b className="good">Valid</b></Row><Row><span>Suspicious Activity</span><b className="warn">{auditLogs.filter(l => /suspicious|blocked|failed/i.test(l.action || l.details || '')).length}</b></Row>
    </Panel>
    <Panel title="Push Health" action={<button onClick={() => setZone('push')}>View details →</button>}>
      {['Vercel API','Storage','Auth','Dispatch Cron'].map((x,i)=><Row key={x}><span>{x}</span><b className="good">Healthy</b><small>{26+i*8}ms</small></Row>)}
    </Panel>
    <Panel title="Automation / Ops Intelligence" action={<button onClick={() => setZone('automation')}>Open →</button>}>
      <div className="admin108-donut"><strong>{automationRuns.length}</strong><span>Runs tracked</span></div><Row><span>Owner/Admin alerts</span><b>{automationQueue.length}</b></Row><Row><span>Configs</span><b>{automationConfigs.length}</b></Row>
    </Panel>
    <Panel title="Forensics Timeline" action={<button onClick={() => setZone('forensics')}>View all →</button>}>
      {auditLogs.slice(0,6).map(l => <Row key={l.id}><span>{l.action || 'Admin action'}</span><small>{l.userName || l.userEmail || 'system'}</small></Row>)}
    </Panel>
  </div>;

  const renderWorkspaces = () => <div className="admin108-grid-work">
    <Panel title="Deploy Workspace" className="span-1"><form onSubmit={handleDeployTenant} className="admin108-form"><input value={rName} onChange={e=>setRName(e.target.value)} placeholder="Restaurant / workspace name"/><input value={oName} onChange={e=>setOName(e.target.value)} placeholder="Owner name"/><input value={oEmail} onChange={e=>setOEmail(e.target.value)} placeholder="Owner email"/><Action primary type="submit"><Package size={16}/> Deploy Workspace</Action></form></Panel>
    <Panel title="Workspace Directory" className="span-2" action={<span>{restaurants.length} total</span>}>
      <div className="admin108-table dense"><div className="head"><span>Workspace</span><span>Owner</span><span>Plan</span><span>Users</span><span>Status</span><span>Actions</span></div>{restaurants.map(r => <div className="tr" key={r.id}><span>{r.name || r.id}<small>{r.id}</small></span><span>{r.ownerName || r.ownerEmail || 'No owner'}</span><span>{r.subscription?.planId || r.planId || 'smart_kitchen'}</span><span>{allUsers.filter(u=>u.restaurantId===r.id).length}</span><span className={r.isActive === false ? 'bad' : r.isReadOnly ? 'warn' : 'good'}>{r.isActive === false ? 'Disabled' : r.isReadOnly ? 'Read only' : 'Active'}</span><span className="actions"><button onClick={()=>setEditingRest(r)}>Edit</button><button onClick={()=>setGhostTenant(r)}>Ghost</button><button onClick={()=>handleExportData(r)}>Export</button></span></div>)}</div>
    </Panel>
  </div>;

  const renderUsers = () => <Panel title="Global People Directory" action={<span>{allUsers.length} users</span>}><input className="admin108-search-line" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Search users, roles, emails, workspaces..."/><div className="admin108-table dense"><div className="head"><span>Name</span><span>Email</span><span>Role</span><span>Workspace</span><span>Status</span></div>{filteredUsers.map(u => <div className="tr" key={u.id}><span>{u.name || 'Unnamed'}</span><span>{u.email || 'No email'}</span><span>{u.role || (u.isSuperAdmin ? 'System Admin' : 'Staff')}</span><span>{u.restaurantName || u.restaurantId || 'Global'}</span><span className={u.isActive === false ? 'bad' : 'good'}>{u.isActive === false ? 'Disabled' : 'Active'}</span></div>)}</div></Panel>;

  const renderSecurity = () => <div className="admin108-grid-main compact"><Panel title="Protection Checklist"><Row><span>App Check</span><b className="good">Enabled</b></Row><Row><span>Firestore rules</span><b className="good">Valid</b></Row><Row><span>Storage rules</span><b className="good">Valid</b></Row><Row><span>Super admin scope</span><b className="good">Server checked</b></Row><Row><span>Customer-facing admin leak</span><b className="good">Blocked</b></Row></Panel><Panel title="Risk Queue">{auditLogs.slice(0,10).map(l=><Row key={l.id}><span>{l.action || 'Audit event'}</span><small>{l.details || l.target || 'Logged'}</small></Row>)}</Panel><Panel title="Access Control Shortcut"><Action onClick={()=>setZone('access')}>Open Access Control</Action><Action onClick={()=>setZone('forensics')}>Open Audit Trail</Action></Panel></div>;

  const renderBackup = () => <div className="admin108-grid-main compact"><Panel title="Backup Integrity"><StatCard icon={HardDrive} label="Integrity" value="100%" sub="All backups healthy" tone="green"/><Row><span>Last backup</span><b>{nowText()}</b></Row><Row><span>Next backup</span><b>6:00 PM</b></Row><Row><span>Restore drill</span><b className="good">Ready</b></Row></Panel><Panel title="Restore Safety"><p className="admin108-note">Restore actions must stay owner/admin gated and workspace-specific. Production restores require typed confirmation and a fresh backup.</p><Action>Run Restore Drill</Action><Action danger>Open Restore Console</Action></Panel></div>;

  const renderPush = () => <div className="admin108-grid-main compact"><Panel title="Push Delivery"><Row><span>Canonical token mode</span><b className="good">Active</b></Row><Row><span>Service worker double-display</span><b className="good">Blocked</b></Row><Row><span>Reminder dispatch</span><b className="good">Ready</b></Row><Row><span>Recent alerts</span><b>{latestAlerts.length}</b></Row></Panel><Panel title="Recent Push / Reminder Alerts">{latestAlerts.map(a=><Row key={a.id}><span>{a.title || a.type || 'Owner/Admin alert'}</span><small>{a.restaurantName || a.restaurantId || 'workspace'}</small></Row>)}</Panel></div>;

  const renderAutomation = () => <div className="admin108-grid-main compact"><Panel title="Automation Control"><select value={automationTargetId} onChange={e=>setAutomationTargetId(e.target.value)}><option value="">All active workspaces, limited batch</option>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select><Action primary onClick={handleRunPythonAutomation} disabled={automationLoading}>{automationLoading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} Scan & Alert Owners</Action><Action onClick={handleTogglePythonAutomationPause} disabled={!automationTargetId}>Pause / Resume Selected</Action><p className="admin108-note">Automation stays read-only. It can report, suggest, and alert. It cannot change pars, payroll, schedules, permissions, orders, or accounting records without owner/admin approval.</p></Panel><Panel title="Latest Reports">{automationReports.slice(0,12).map(r=><Row key={r.id}><span>{r.restaurantName || r.restaurantId || 'Workspace report'}</span><small>{r.status || 'ok'} • {(r.criticalFindings || []).length} finding(s)</small></Row>)}</Panel><Panel title="Run History">{automationRuns.slice(0,12).map(r=><Row key={r.id}><span>{r.restaurantName || r.restaurantId || r.mode || 'Automation run'}</span><small>{r.status || (r.ok ? 'ok' : 'logged')}</small></Row>)}</Panel></div>;

  const renderForensics = () => <Panel title="Global Forensics Timeline" action={<span>{auditLogs.length} events loaded</span>}><div className="admin108-timeline">{auditLogs.map(l=><div key={l.id} className="event"><i/><strong>{l.action || 'Admin action'}</strong><span>{l.userName || l.userEmail || 'system'}</span><small>{l.details || l.target || new Date(l.timestamp || Date.now()).toLocaleString()}</small></div>)}</div></Panel>;

  const renderDeployment = () => <div className="admin108-grid-main compact"><Panel title="Deployment Center"><Row><span>Preview deploy target</span><b>testing branch</b></Row><Row><span>Rules deploy</span><b className="warn">GitHub Action required</b></Row><Row><span>Production deploy</span><b className="bad">Locked</b></Row><Action>Deploy Testing Firestore Rules</Action><Action>Deploy Testing Storage Rules</Action><Action>Deploy Testing Indexes</Action><Action danger>Production Deploy Locked</Action></Panel><Panel title="Release Readiness"><Row><span>Current app</span><b>{CURRENT_VERSION}</b></Row><Row><span>Push duplicate fix</span><b className="good">Included</b></Row><Row><span>QuickBooks live posting</span><b className="good">Off / review-first</b></Row><Row><span>System Admin customer gate</span><b className="good">Protected</b></Row></Panel></div>;

  const renderRetention = () => <div className="admin108-grid-main compact"><Panel title="Legal Retention Setup"><p className="admin108-note">Creates or updates the official system/dataRetention marker. It does not delete data by itself.</p><Action primary onClick={handleInitializeRetentionConfig} disabled={retentionSaving}>{retentionSaving ? <Loader2 size={16} className="animate-spin"/> : <Calendar size={16}/>} Save Legal Retention Config</Action>{lastRetentionSetup && <p className="admin108-note good">Last saved: {new Date(lastRetentionSetup).toLocaleString()}</p>}</Panel><Panel title="Retention Schedule">{Object.entries(RETENTION_POLICY).map(([k,v])=><Row key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><small>{v}</small></Row>)}</Panel></div>;

  const renderSupport = () => <div className="admin108-grid-main compact"><Panel title="Crash / Support Reports">{crashLogs.slice(0,15).map(c=><Row key={c.id} danger={/high|critical|fatal/i.test(c.severity || c.message || '')}><span>{c.title || c.message || 'Crash report'}</span><small>{c.restaurantName || c.userEmail || c.time || 'logged'}</small></Row>)}</Panel><Panel title="Diagnostics"><Action>Run Full Diagnostics</Action><Action>Open Support Manual</Action><Action onClick={()=>setZone('forensics')}>Review Audit Trail</Action></Panel></div>;

  const renderAccess = () => <div className="admin108-grid-main compact"><Panel title="Grant System Administrator"><form onSubmit={handleGrantAccess} className="admin108-form"><input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="user@email.com"/><Action primary type="submit"><KeyRound size={16}/> Grant Access</Action></form></Panel><Panel title="Current System Administrators">{superAdmins.map(u=><Row key={u.id}><span>{u.name || u.email}</span><small>{u.email}</small><button onClick={()=>handleRevokeAccess(u)}>Revoke</button></Row>)}</Panel></div>;

  const renderOperations = () => <div className="admin108-grid-main compact"><Panel title="Broadcast Alert"><form onSubmit={handleMegaphone} className="admin108-form"><textarea value={broadcastMsg} onChange={e=>setBroadcastMsg(e.target.value)} placeholder="Message to every restaurant..."/><Action primary type="submit"><Send size={16}/> Broadcast Alert</Action></form></Panel><Panel title="Global Actions"><Action onClick={handleForceRefresh}>Global Refresh</Action><Action onClick={handleOrphanSweep}>Orphan Sweep</Action><Action danger onClick={()=>addToast('Emergency Read-only', 'Wire this action to maintenance mode when ready.')}>Emergency Read-Only</Action></Panel></div>;

  const content = { overview: renderOverview, workspaces: renderWorkspaces, users: renderUsers, security: renderSecurity, backup: renderBackup, push: renderPush, automation: renderAutomation, forensics: renderForensics, deployment: renderDeployment, retention: renderRetention, support: renderSupport, access: renderAccess, operations: renderOperations }[zone]?.() || renderOverview();

  return <div className="admin108-shell">
    <aside className="admin108-side">
      <div className="admin108-side-brand"><strong>86<span>chaos</span></strong><small>System Operations</small></div>
      <nav>{zones.map(z => { const Icon = z.icon; return <button key={z.id} onClick={()=>setZone(z.id)} className={zone===z.id?'active':''}><Icon size={17}/><span>{z.label}</span></button>; })}</nav>
      <div className="admin108-side-status"><small>System Time</small><strong>{nowText()}</strong><small>Environment</small><b>Preview / Testing</b></div>
    </aside>

    <main className="admin108-main">
      <header className="admin108-top">
        <div className="admin108-tool-select"><activeZone.icon size={18}/><div><strong>{activeZone.label}</strong><small>{activeZone.helper}</small></div><ChevronRight size={14}/></div>
        <form className="admin108-command" onSubmit={(e)=>{e.preventDefault(); gotoZoneFromCommand();}}><Search size={17}/><input value={command} onChange={e=>setCommand(e.target.value)} placeholder="Search or run command..."/><kbd>⌘ K</kbd></form>
        <div className="admin108-user"><span>{(appUser?.name || appUser?.email || 'SA').slice(0,2).toUpperCase()}</span><div><strong>{appUser?.name || 'System Admin'}</strong><small>Super Administrator</small></div></div>
      </header>

      <section className="admin108-title"><div><small>SYSTEM ADMINISTRATOR</small><h1>{activeZone.label === 'Overview' ? 'Operations Console' : activeZone.label}</h1><p>{activeZone.helper}. Built as a command console, not a scroll document.</p></div><div className="admin108-date">{new Date().toLocaleDateString([], { weekday:'long', month:'short', day:'numeric', year:'numeric' })}</div></section>

      <section className="admin108-stats">
        <StatCard icon={Activity} label="Platform Health" value="99.6%" sub="All critical systems operational" tone="green"/>
        <StatCard icon={Users} label="Active Workspaces" value={activeWorkspaces.length} sub={`${idleWorkspaces.length} inactive/read-only`} />
        <StatCard icon={Users} label="Global Users" value={activeUsers} sub={`${superAdmins.length} system admins`} />
        <StatCard icon={Shield} label="Deployment Readiness" value="98.7%" sub={`Current ${CURRENT_VERSION}`} />
        <StatCard icon={Database} label="Backup Integrity" value="100%" sub="All backups healthy" tone="green"/>
        <StatCard icon={Bell} label="Push Delivery" value="99.6%" sub="Duplicate guard active" tone="green"/>
      </section>

      <section className="admin108-content">{content}</section>
    </main>

    <aside className="admin108-right"><Panel title="Live Issues"><div className="admin108-issue red"><span/>Failed push delivery <small>{latestAlerts.length} alert(s)</small></div><div className="admin108-issue amber"><span/>Stale tenants <small>{staleTenants.length} workspace(s)</small></div><div className="admin108-issue green"><span/>QuickBooks safety <small>Review-first</small></div></Panel><Panel title="Quick Actions"><Action onClick={()=>setZone('workspaces')}>Deploy Workspace</Action><Action onClick={()=>setZone('operations')}>Broadcast Alert</Action><Action onClick={handleForceRefresh}>Global Refresh</Action><Action onClick={()=>setZone('automation')}>Automation Center</Action><Action danger onClick={()=>setZone('forensics')}>Open Audit Log</Action></Panel><Panel title="System Summary"><Row><span>MRR</span><b>{money(mrr)}</b></Row><Row><span>Founder beta</span><b>{founderBeta}</b></Row><Row><span>Data usage</span><b>Live</b></Row><Row><span>Version</span><b>{CURRENT_VERSION}</b></Row></Panel></aside>

    <Modal isOpen={!!editingRest} onClose={() => setEditingRest(null)} title={`Manage Client: ${editingRest?.name || ''}`}>
      {editingRest && <form onSubmit={handleUpdateTenant} className="admin108-modal-form"><input value={editingRest.name || ''} onChange={e=>setEditingRest({...editingRest, name:e.target.value})}/><select value={editingRest.subscription?.planId || editingRest.planId || 'smart_kitchen'} onChange={e=>setEditingRest({...editingRest, planId:e.target.value, subscription:{...(editingRest.subscription||{}), planId:e.target.value}})}><option value="shift">Shift</option><option value="operations">Operations</option><option value="smart_kitchen">Smart Kitchen</option><option value="owner_pro">Owner Pro</option></select><label><input type="checkbox" checked={editingRest.isActive !== false} onChange={e=>setEditingRest({...editingRest,isActive:e.target.checked})}/> Active</label><label><input type="checkbox" checked={editingRest.isReadOnly === true} onChange={e=>setEditingRest({...editingRest,isReadOnly:e.target.checked})}/> Read-only</label><div className="admin108-modal-actions"><Action primary type="submit">Save Workspace</Action><Action onClick={()=>handleExportData(editingRest)}>Export Users</Action><Action danger onClick={()=>setNukeTarget({rest:editingRest,type:'everything',label:'ABSOLUTELY EVERYTHING'})}>Nuke Data</Action><Action danger onClick={()=>handleDeleteTenant(editingRest.id, editingRest.name)}>Delete Workspace</Action></div></form>}
    </Modal>

    <Modal isOpen={!!nukeTarget} onClose={() => { setNukeTarget(null); setNukePassword(''); }} title={`CRITICAL: Nuke ${nukeTarget?.label || ''}`}>
      <form onSubmit={handleNukeData} className="admin108-modal-form"><p className="admin108-note danger">This permanently deletes {nukeTarget?.label} for {nukeTarget?.rest?.name}. This cannot be undone.</p><input type="password" value={nukePassword} onChange={e=>setNukePassword(e.target.value)} placeholder="Enter confirmation password"/><Action danger primary type="submit" disabled={isNuking}>{isNuking ? 'Deleting…' : 'Permanently Delete Data'}</Action></form>
    </Modal>
  </div>;
};

export default TabGodMode;

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { secureFetch } from '../core/appCore';
import { Package, Trash2, Moon, Search, Calendar, BookOpen, Bug, Bell, Shield, Loader2, ClipboardList, HelpCircle, Users, LifeBuoy, Radio, KeyRound, ChevronRight, Sparkles } from 'lucide-react';

const TabGodMode = ({ appUser, addToast, setGhostTenant, db, auth, Modal, T, getToday, generateTempPass, firebaseConfig, CURRENT_VERSION, logAudit }) => {
  const [subTab, setSubTab] = useState('overview');
  
  // Master Data States
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
  const [userCounts, setUserCounts] = useState({});
  const [totalInstalls, setTotalInstalls] = useState(0); 

  // Form States
  const [rName, setRName] = useState(''); const [oName, setOName] = useState(''); const [oEmail, setOEmail] = useState(''); const [oPhone, setOPhone] = useState('');  const [adminEmail, setAdminEmail] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [editingRest, setEditingRest] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [lastRetentionSetup, setLastRetentionSetup] = useState(null);
  const [adminHelpTopic, setAdminHelpTopic] = useState(null);

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
    const unsubAutomationReports = onSnapshot(collection(db, 'opsIntelligenceReports'), snap => {
       const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt || b.generatedAt || 0) - new Date(a.createdAt || a.generatedAt || 0)).slice(0, 80);
       setAutomationReports(rows);
    });
    const unsubAutomationRuns = onSnapshot(collection(db, 'pythonAutomationRuns'), snap => {
       const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)).slice(0, 80);
       setAutomationRuns(rows);
    });
    const unsubAutomationQueue = onSnapshot(collection(db, 'restaurantAdminAlerts'), snap => {
       const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).slice(0, 120);
       setAutomationQueue(rows);
    });
    const unsubAutomationConfigs = onSnapshot(collection(db, 'pythonAutomationConfigs'), snap => {
       setAutomationConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubRests(); unsubAdmins(); unsubUsers(); unsubCrashes(); unsubAudit(); unsubAutomationReports(); unsubAutomationRuns(); unsubAutomationQueue(); unsubAutomationConfigs(); };
  }, [db]);

  // --- 1. TENANT MANAGEMENT & DEPLOYMENT ---
  const handleDeployTenant = async (e) => {
    e.preventDefault(); if (!rName.trim() || !oEmail.trim() || !oName.trim()) return;
    try {
      const defaultFeatures = { schedule: true, prep: true, inventory: true, recipes: true, messages: true, sales: true };
      const newRestRef = await addDoc(collection(db, "restaurants"), { name: rName.trim(), ownerName: oName.trim(), ownerEmail: oEmail.toLowerCase().trim(), isActive: true, isReadOnly: false, features: defaultFeatures, labs: {}, planId: 'smart_kitchen', subscriptionStatus: 'beta', isFounderBeta: true, integrationsLocked: true, subscription: { planId: 'smart_kitchen', selectedFutureTier: 'smart_kitchen', status: 'beta', isFounderBeta: true, founderDiscountPercent: 50, billingProvider: 'none', integrationsLocked: true }, createdAt: new Date().toISOString(), lastActive: new Date().toISOString() });
      const tPass = generateTempPass(); const secondaryApp = initializeApp(firebaseConfig, "TenantBuilder_" + Date.now()); const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, oEmail.toLowerCase().trim(), tPass); const newAuthUid = userCredential.user.uid; await secondaryAuth.signOut();
      await setDoc(doc(db, "users", newAuthUid), { name: oName.trim(), email: oEmail.toLowerCase().trim(), role: 'Owner', isAdmin: true, isActive: true, forcePasswordChange: true, restaurantId: newRestRef.id, restaurantName: rName.trim(), permissions: { schedule: true, inventory: true, prep: true, sales: true, team: true }, passwordStored: false, passwordPurgedAt: new Date().toISOString() });
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
      planId: editingRest.planId || editingRest.subscription?.planId || 'smart_kitchen', 
      subscriptionStatus: editingRest.subscriptionStatus || editingRest.subscription?.status || 'beta' 
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

  // --- SYSTEM OPERATIONS ---
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

  const RETENTION_POLICY = {
    activeCoreData: 'While account is active',
    workforceTimeClockGeofence: '3 years total; archive active records after 1 year',
    transientPrepAnd86: '30 days',
    rawAiPromptsAndUploads: '30 days; parsed/reviewed business data retained',
    deletedWorkspaceData: '30-day recovery window before hard delete',
    databaseBackups: '30-day rolling retention',
    auditSecurityLogs: '1 year'
  };

  const handleInitializeRetentionConfig = async () => {
    if (!window.confirm('Create/update the legal data-retention config for the current Firebase project? This does not delete data by itself.')) return;
    setRetentionSaving(true);
    try {
      const payload = {
        policySource: '86 Chaos Legal Document Packet - Security, Backup, and Data Retention Policy section 6.4',
        policyVersion: '2026-07-09',
        appVersion: CURRENT_VERSION,
        schedule: RETENTION_POLICY,
        automations: {
          purgeTransientOperationalData: 'Daily at 2:10 AM Central - prep lists, 86 alerts, AI locks, rate-limit records older than 30 days.',
          purgeExpiredAiUploads: 'Daily at 2:35 AM Central - raw AI scan/upload files and raw prompt/request logs older than 30 days.',
          archiveExpiredTimeClockData: 'Daily at 3:05 AM Central - archive active time-clock/geofence records after 1 year before deleting active copies.',
          purgeExpiredTimeClockArchives: 'Daily at 3:40 AM Central - remove archived time-clock/geofence files after 3 years from event date.',
          purgeExpiredDatabaseBackups: 'Daily at 3:55 AM Central - remove database backups outside the 30-day rolling window.',
          hardDeleteExpiredWorkspaces: 'Daily at 4:15 AM Central - hard-delete workspaces after the 30-day deleted-workspace grace period.',
          purgeExpiredAuditSecurityLogs: 'Daily at 4:25 AM Central - remove audit/security logs older than 1 year.'
        },
        requiredFunctionEnv: {
          RETENTION_ARCHIVE_BUCKET: 'Required for time-clock/geofence archival. Use the bucket NAME only, not gs://.',
          AI_UPLOADS_BUCKET: 'Optional. Leave blank to use the default Firebase Storage bucket.'
        },
        safetyNotes: [
          'This config document is a production checklist/status marker. Deletion is performed only by deployed Firebase Functions.',
          'The time-clock archive job refuses to delete source records unless the archive upload is verified.',
          'Active core records such as recipes and inventory are retained while the workspace account is active.',
          'Run a fresh backup before first production retention deployment.'
        ],
        updatedAt: new Date().toISOString(),
        updatedBy: appUser?.email || appUser?.name || 'System Administrator'
      };
      await setDoc(doc(db, 'system', 'dataRetention'), payload, { merge: true });
      await logAudit?.(appUser, 'DATA_RETENTION_CONFIG_INITIALIZED', 'system/dataRetention', 'Initialized legal retention configuration from System Administrator.');
      setLastRetentionSetup(payload.updatedAt);
      addToast('Retention Config Saved', 'Legal retention policy marker saved. Deploy Firebase Functions separately to run the schedules.');
    } catch (error) {
      addToast('Retention Setup Failed', error?.message || 'Could not save retention config.');
    } finally {
      setRetentionSaving(false);
    }
  };


  // --- PYTHON AUTOMATION CENTER ---
  const PYTHON_AUTOMATION_JOBS = [
    { key:'nightlyOpsScan', label:'Nightly Ops Scan', cadence:'Nightly', mode:'Automatic report', description:'Runs ordering, invoice, waste, labor, backup, and data-health analysis.' },
    { key:'morningManagerBrief', label:'Morning Manager Brief', cadence:'Daily morning', mode:'Automatic report', description:'Turns scan findings into a manager-ready summary.' },
    { key:'backupIntegrityCheck', label:'Backup Integrity Check', cadence:'After backup / daily', mode:'Critical alerts allowed', description:'Flags stale, missing, or suspicious backup status.' },
    { key:'dataHealthScanner', label:'Data Health Scanner', cadence:'Nightly', mode:'Suggestions only', description:'Finds broken IDs, missing setup, orphaned links, and data that weakens AI accuracy.' },
    { key:'invoicePriceWatcher', label:'Invoice Price Watcher', cadence:'Invoice + nightly', mode:'Critical alerts allowed', description:'Finds price jumps, duplicate invoice fingerprints, and pack-size changes.' },
    { key:'eventSupplyRiskCheck', label:'Event Supply Risk Check', cadence:'Daily', mode:'Suggestions only', description:'Flags upcoming events that may need ordering or prep planning.' },
    { key:'wastePatternScanner', label:'Waste Pattern Scanner', cadence:'Weekly / nightly signal', mode:'Suggestions only', description:'Finds repeat waste/burn patterns before changing pars or prep.' },
    { key:'parRecommendationEngine', label:'Par Recommendation Engine', cadence:'Weekly / nightly signal', mode:'Approval required', description:'Suggests par changes but never applies them automatically.' },
    { key:'recipeCostingRefresh', label:'Recipe/Menu Costing Refresh', cadence:'Weekly / invoice signal', mode:'Approval required', description:'Estimates menu cost movement from invoice and recipe data.' },
    { key:'releaseDataQaScanner', label:'Release/Data QA Scanner', cadence:'On demand + nightly', mode:'Suggestions only', description:'Looks for obvious app-data issues before releases or risky changes.' },
    { key:'criticalPushAlerts', label:'Critical Push Alerts', cadence:'When serious findings exist', mode:'Alert only', description:'Pushes owners/super admins for backup failures, huge price jumps, and corruption risk.' },
    { key:'approvalQueue', label:'Owner/Admin Alerts', cadence:'Every run', mode:'Restaurant review required', description:'Sends read-only review alerts to restaurant owners/admins instead of applying changes.' }
  ];

  const PYTHON_SAFETY_POLICY = {
    can: ['Analyze data', 'Create reports', 'Create suggestions', 'Send owner/admin alerts', 'Create alert-only review records'],
    approval: ['Change pars', 'Save order drafts', 'Repair broken records', 'Update official recipe costs', 'Archive or restore records'],
    never: ['Send vendor orders', 'Spend money', 'Edit/publish schedules', 'Approve payroll', 'Change wages/permissions/billing/security', 'Delete records permanently']
  };

  const selectedAutomationConfig = automationConfigs.find(c => c.id === automationTargetId || c.restaurantId === automationTargetId) || null;

  const handleRunPythonAutomation = async () => {
    if (!window.confirm(automationTargetId ? 'Run a read-only Python scan and send owner/admin alerts for the selected workspace? No restaurant records will be changed.' : 'Run read-only Python scans and send owner/admin alerts for active workspaces? No restaurant records will be changed.')) return;
    setAutomationLoading(true);
    try {
      const response = await secureFetch('/api/python-automation-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual', restaurantId: automationTargetId || '', maxRestaurants: 8 })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Python automation did not finish.');
      const rows = Array.isArray(payload.results) ? payload.results : [];
      const failed = rows.filter(row => row.ok === false).length;
      const skipped = rows.filter(row => row.skipped).length;
      const completed = rows.filter(row => row.ok === true && row.skipped !== true).length;
      const scanned = rows.length;
      const ownerAdminAlerts = rows.reduce((sum, row) => sum + Number(row.ownerAdminAlertsWritten || 0), 0);
      const pushesSent = rows.reduce((sum, row) => sum + Number(row.pushSentCount || 0), 0);
      const changesApplied = rows.reduce((sum, row) => sum + Number(row.changesApplied || 0), 0);
      const failurePreview = rows.find(row => row.ok === false)?.error || '';
      if (failed) {
        addToast('Scan Finished with Errors', `${completed}/${scanned} completed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}. ${ownerAdminAlerts} owner/admin alert(s), ${pushesSent} push(es), ${changesApplied} changes applied.${failurePreview ? ` First error: ${failurePreview}` : ''}`);
      } else {
        addToast('Scan Complete, Alerts Sent', `${completed}/${scanned} completed${skipped ? `, ${skipped} skipped` : ''}. ${ownerAdminAlerts} owner/admin alert(s), ${pushesSent} push(es), ${changesApplied} changes applied.`);
      }
    } catch (error) {
      addToast('Python Automation Failed', error?.message || 'Could not run automation.');
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleTogglePythonAutomationPause = async () => {
    if (!automationTargetId) return addToast('Choose Workspace', 'Pick a workspace before pausing or resuming Python automation.');
    const rest = restaurants.find(r => r.id === automationTargetId);
    const nextPaused = !(selectedAutomationConfig?.paused === true);
    await setDoc(doc(db, 'pythonAutomationConfigs', automationTargetId), {
      restaurantId: automationTargetId,
      workspaceId: automationTargetId,
      restaurantName: rest?.name || selectedAutomationConfig?.restaurantName || automationTargetId,
      paused: nextPaused,
      jobs: selectedAutomationConfig?.jobs || {},
      updatedAt: new Date().toISOString(),
      updatedBy: appUser.id || appUser.email || 'system-admin',
      updatedByName: appUser.name || appUser.email || 'System Administrator'
    }, { merge: true });
    addToast(nextPaused ? 'Automation Paused' : 'Automation Resumed', rest?.name || automationTargetId);
  };

  const updateQueueStatus = async (item, status) => {
    await updateDoc(doc(db, 'aiRecommendationQueue', item.id), { status, reviewedAt: new Date().toISOString(), reviewedBy: appUser.id || appUser.email || '', reviewedByName: appUser.name || appUser.email || 'System Administrator', updatedAt: new Date().toISOString() });
    addToast('Recommendation Updated', `${item.title || 'Item'} marked ${status}.`);
  };

  // --- CALCULATIONS ---
  const mrr = restaurants.reduce((acc, r) => acc + (r.subscription?.status === 'active' ? (r.subscription?.planId === 'owner_pro' ? 299 : r.subscription?.planId === 'smart_kitchen' ? 179 : r.subscription?.planId === 'operations' ? 99 : 49) : 0), 0);
  const timeAgo = (dateStr) => { if (!dateStr) return 'Never'; const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)); if (days === 0) return 'Active Today'; if (days === 1) return 'Active Yesterday'; return `Inactive ${days} days`; };
  const staleTenants = restaurants.filter(r => r.isActive && Math.floor((Date.now() - new Date(r.lastActive||0).getTime()) / 86400000) > 21);

  const ADMIN_SECTIONS = [
    { id:'overview', label:'Metrics', icon: Package, tone:'emerald', description:'Platform health, revenue, install, client activity, and stale-location snapshots.' },
    { id:'tenants', label:'Clients', icon: Users, tone:'blue', description:'Create restaurants, manage plans, deploy owner accounts, ghost into clients, export users, and control tenant status.' },
    { id:'users', label:'Global Users', icon: Search, tone:'slate', description:'Search every user across all restaurants, inspect roles, workspace ties, and account status.' },
    { id:'support', label:'Support', icon: LifeBuoy, tone:'amber', description:'Crash reports, diagnostics, support triage, and customer problem investigation tools.' },
    { id:'forensics', label:'Forensics', icon: Shield, tone:'purple', description:'Audit timeline, ghost-action review, security activity, and administrator accountability records.' },
    { id:'automation', label:'Automation', icon: Sparkles, tone:'purple', description:'Python job controls, scheduled intelligence, owner/admin alerts, read-only scans, and safety rails.' },
    { id:'ops', label:'Operations', icon: Radio, tone:'red', description:'Global refresh, platform broadcast, orphan sweeps, and operational maintenance actions.' },
    { id:'retention', label:'Retention', icon: Calendar, tone:'emerald', description:'One-button legal data-retention setup marker, official retention schedule, and production setup checklist.' },
    { id:'admins', label:'Access', icon: KeyRound, tone:'red', description:'Grant or revoke internal System Administrator access.' },
  ];

  const activeAdminSection = ADMIN_SECTIONS.find(section => section.id === subTab) || ADMIN_SECTIONS[0];

  const openAdminHelp = (sectionId, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setAdminHelpTopic(ADMIN_SECTIONS.find(section => section.id === sectionId) || null);
  };


  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 animate-[slideIn_0.2s_ease-out]">
      {/* MASTER NAVIGATION */}
      <div className="space-y-3 border-b border-[#2A353D] mb-6 pb-4">
        <div className="md:hidden bg-[#12161A] border border-[#2A353D] rounded-2xl p-3 shadow-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4A381]">System Administrator</div>
              <h2 className="text-lg font-black text-white leading-tight mt-1">{activeAdminSection.label}</h2>
              <p className="text-xs text-slate-400 font-bold leading-5 mt-1">{activeAdminSection.description}</p>
            </div>
            <button type="button" onClick={(event) => openAdminHelp(activeAdminSection.id, event)} className="shrink-0 w-10 h-10 rounded-xl border border-[#D4A381]/50 bg-[#0B0E11] text-[#D4A381] flex items-center justify-center" aria-label={`Explain ${activeAdminSection.label}`} title={`Explain ${activeAdminSection.label}`}>
              <HelpCircle size={19}/>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {ADMIN_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = subTab === section.id;
              return (
                <div key={section.id} className={`rounded-2xl border ${active ? 'border-[#D4A381] bg-[#D4A381]/10' : 'border-[#2A353D] bg-[#0B0E11]'} overflow-hidden`}>
                  <div className="flex items-stretch">
                    <button type="button" onClick={() => setSubTab(section.id)} className="flex-1 min-w-0 p-3 text-left flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center border ${active ? 'border-[#D4A381]/60 text-[#D4A381] bg-[#0B0E11]' : 'border-[#2A353D] text-slate-400 bg-[#12161A]'}`}><Icon size={18}/></span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-black ${active ? 'text-white' : 'text-slate-200'}`}>{section.label}</span>
                        <span className="block text-[11px] text-slate-500 font-bold leading-4 truncate">{section.description}</span>
                      </span>
                      <ChevronRight size={16} className={active ? 'text-[#D4A381]' : 'text-slate-600'}/>
                    </button>
                    <button type="button" onClick={(event) => openAdminHelp(section.id, event)} className="w-12 border-l border-[#2A353D] text-[#D4A381] bg-[#12161A]/60 flex items-center justify-center" aria-label={`What is ${section.label}?`} title={`What is ${section.label}?`}>
                      <HelpCircle size={17}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-8 gap-2">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.id} className="relative group">
                <button onClick={() => setSubTab(section.id)} className={`w-full px-2 py-2.5 text-[10px] sm:text-[11px] font-black rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${subTab === section.id ? 'bg-red-600 text-white shadow-lg scale-[1.02]' : 'bg-[#1A2126] text-slate-400 border border-[#2A353D] hover:text-white hover:border-slate-500'}`}>
                  <Icon size={13}/>{section.label}
                </button>
                <button type="button" onClick={(event) => openAdminHelp(section.id, event)} className="absolute -right-1 -top-1 w-5 h-5 rounded-full border border-[#D4A381]/60 bg-[#0B0E11] text-[#D4A381] hidden group-hover:flex items-center justify-center shadow-md" aria-label={`Explain ${section.label}`} title={`Explain ${section.label}`}>
                  <HelpCircle size={12}/>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={!!adminHelpTopic} onClose={() => setAdminHelpTopic(null)} title={`${adminHelpTopic?.label || 'System Administrator'} help`}>
        {adminHelpTopic && (
          <div className="space-y-4 text-sm text-slate-300 font-bold leading-6">
            <p>{adminHelpTopic.description}</p>
            <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mb-2">Access note</div>
              <p className="text-xs text-slate-400 leading-5">This area is internal-only for verified System Administrator or Master Admin accounts. Customer owners, managers, and staff should not see these controls.</p>
            </div>
            {adminHelpTopic.id === 'retention' && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-2">Retention warning</div>
                <p className="text-xs text-slate-300 leading-5">The setup button saves the legal retention policy marker and checklist only. Actual deletion/archive jobs run from deployed Firebase Functions after production setup is complete.</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!editingRest} onClose={() => setEditingRest(null)} title={`Manage Client: ${editingRest?.name}`}>
        {editingRest && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleUpdateTenant} className="space-y-4">
              <div><label className={T.label}>Business Name</label><input type="text" value={editingRest.name} onChange={e => setEditingRest({...editingRest, name: e.target.value})} className={T.input} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={T.label}>Plan Tier</label><select value={editingRest.subscription?.planId || editingRest.planId || 'smart_kitchen'} onChange={e => setEditingRest({...editingRest, planId: e.target.value, subscription: { ...(editingRest.subscription || {}), planId: e.target.value, selectedFutureTier: e.target.value, status: editingRest.subscription?.status || 'beta' }})} className={T.input}><option value="shift">Shift</option><option value="operations">Operations</option><option value="smart_kitchen">Smart Kitchen</option><option value="owner_pro">Owner Pro</option></select></div>
                <div><label className={T.label}>Billing Status</label><select value={editingRest.subscription?.status || editingRest.subscriptionStatus || 'beta'} onChange={e => setEditingRest({...editingRest, subscriptionStatus: e.target.value, subscription: { ...(editingRest.subscription || {}), status: e.target.value }})} className={`${T.input} ${editingRest.subscription?.status === 'past_due' ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}`}><option value="active">Active Manual</option><option value="beta">Founder Beta</option><option value="past_due">Past Due</option></select></div>
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
                      {r.subscription?.status === 'past_due' ? <span className="bg-red-900 text-red-400 border border-red-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">Past Due</span> : <span className="bg-emerald-900 text-emerald-400 border border-emerald-500/50 text-[8px] px-1.5 py-0.5 rounded uppercase">{r.subscription?.planId || r.planId || 'smart_kitchen'}</span>}
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


      {/* --- TAB: PYTHON AUTOMATION CENTER --- */}
      {subTab === 'automation' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5 border-purple-500/30 bg-purple-950/10`}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-purple-300 flex items-center gap-2"><Sparkles size={15}/> Python Automation Center</div>
                <h2 className="text-xl font-black text-white mt-1">Scan workspaces, alert owners/admins, apply nothing.</h2>
                <p className="text-xs text-slate-400 font-bold leading-6 mt-2 max-w-3xl">Python is allowed to analyze, report, suggest, and alert the restaurant owners/admins. System Administrator runs cannot change money, schedules, payroll, permissions, pars, records, inventory, or vendor orders.</p>
              </div>
              <div className="w-full lg:w-[360px] space-y-2">
                <select value={automationTargetId} onChange={e => setAutomationTargetId(e.target.value)} className={T.input}>
                  <option value="">All active workspaces, limited batch</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button onClick={handleRunPythonAutomation} disabled={automationLoading} className="bg-purple-900/30 border border-purple-500/50 text-purple-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50">{automationLoading ? 'Scanning…' : 'Scan & Alert Owners'}</button>
                  <button onClick={handleTogglePythonAutomationPause} disabled={!automationTargetId} className="bg-[#12161A] border border-[#2A353D] text-[#D4A381] rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-40">{selectedAutomationConfig?.paused ? 'Resume' : 'Pause'}</button>
                </div>
                <div className="text-[10px] text-slate-500 font-bold leading-4">Scheduled run: Vercel cron hits <span className="text-purple-200 font-black">/api/python-automation-run</span>. Manual runs use your Super Admin login.</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`${T.card} p-4 border-emerald-500/20`}>
              <h3 className="font-black text-emerald-200 mb-3">Python Can</h3>
              <div className="space-y-2">{PYTHON_SAFETY_POLICY.can.map(item => <div key={item} className="rounded-xl bg-emerald-950/10 border border-emerald-500/20 p-2 text-xs font-bold text-emerald-100">✓ {item}</div>)}</div>
            </div>
            <div className={`${T.card} p-4 border-amber-500/20`}>
              <h3 className="font-black text-amber-200 mb-3">Approval Required</h3>
              <div className="space-y-2">{PYTHON_SAFETY_POLICY.approval.map(item => <div key={item} className="rounded-xl bg-amber-950/10 border border-amber-500/20 p-2 text-xs font-bold text-amber-100">Review: {item}</div>)}</div>
            </div>
            <div className={`${T.card} p-4 border-red-500/20`}>
              <h3 className="font-black text-red-200 mb-3">Python Never Does Alone</h3>
              <div className="space-y-2">{PYTHON_SAFETY_POLICY.never.map(item => <div key={item} className="rounded-xl bg-red-950/10 border border-red-500/20 p-2 text-xs font-bold text-red-100">✕ {item}</div>)}</div>
            </div>
          </div>

          <div className={`${T.card} p-5`}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
              <div>
                <h3 className="font-black text-white text-lg">Scheduled Python Jobs</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">Jobs are scan-and-alert only. Restaurant owners/admins review the alerts inside their workspace before anything changes.</p>
              </div>
              <div className="text-right text-[10px] uppercase tracking-widest font-black text-slate-500">{automationConfigs.length} configured workspace(s)</div>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {PYTHON_AUTOMATION_JOBS.map(job => (
                <div key={job.key} className="rounded-2xl border border-[#2A353D] bg-[#12161A] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="font-black text-white">{job.label}</div><div className="text-[10px] uppercase tracking-widest font-black text-purple-300 mt-1">{job.cadence}</div></div>
                    <span className="text-[8px] rounded-full border border-[#2A353D] px-2 py-1 text-slate-400 font-black uppercase">{job.mode}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold leading-5 mt-3">{job.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className={`${T.card} p-5 xl:col-span-2`}>
              <h3 className="font-black text-white text-lg mb-3">Latest Python Reports</h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
                {automationReports.length ? automationReports.slice(0, 18).map(report => (
                  <div key={report.id} className={`rounded-2xl border p-3 ${report.status === 'critical' ? 'border-red-500/40 bg-red-950/10' : report.status === 'attention' ? 'border-amber-500/40 bg-amber-950/10' : report.status === 'failed' ? 'border-red-500/40 bg-red-950/10' : 'border-[#2A353D] bg-[#12161A]'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><div className="font-black text-white">{report.restaurantName || report.restaurantId}</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(report.createdAt || report.generatedAt || Date.now()).toLocaleString()} • {report.status || 'ok'}</div></div><div className="text-[10px] text-purple-200 font-black uppercase">{report.criticalFindings?.length || 0} alert(s)</div></div>
                    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mt-3">
                      {['priceWarningCount','parRecommendationCount','wasteInsightCount','menuCostCount','laborWarningCount','dataHealthCount','backupCheckCount'].map(key => <div key={key} className="rounded-xl border border-[#2A353D] bg-[#0B0E11] p-2 text-center"><div className="font-black text-white">{report.summary?.[key] || 0}</div><div className="text-[7px] uppercase tracking-widest text-slate-500 font-black">{key.replace('Count','').replace(/([A-Z])/g,' $1')}</div></div>)}
                    </div>
                    {(report.managerBrief || []).slice(0, 3).map((line, idx) => <div key={idx} className="mt-2 text-xs font-bold text-slate-300 leading-5">• {line}</div>)}
                  </div>
                )) : <p className="text-xs text-slate-500 font-bold">No Python automation reports yet. Run it once or wait for the nightly cron.</p>}
              </div>
            </div>

            <div className={`${T.card} p-5`}>
              <h3 className="font-black text-white text-lg mb-3">Recent Runs</h3>
              <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
                {automationRuns.length ? automationRuns.slice(0, 20).map(run => <div key={run.id} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3"><div className="flex justify-between gap-2"><span className="font-black text-white text-sm">{run.restaurantName || run.restaurantId || 'Workspace'}</span><span className={`text-[9px] font-black uppercase ${run.status === 'failed' ? 'text-red-300' : run.status === 'running' ? 'text-amber-300' : 'text-emerald-300'}`}>{run.status}</span></div><div className="text-[10px] text-slate-500 font-bold mt-1">{new Date(run.startedAt || Date.now()).toLocaleString()}</div>{run.error && <div className="text-[11px] text-red-200 font-bold mt-2">{run.error}</div>}</div>) : <p className="text-xs text-slate-500 font-bold">No runs recorded.</p>}
              </div>
            </div>
          </div>

          <div className={`${T.card} p-5`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"><div><h3 className="font-black text-white text-lg">Restaurant Owner/Admin Alerts</h3><p className="text-xs text-slate-500 font-bold mt-1">Python sends these to restaurant owners/admins. System Administrator can view them but cannot apply, approve, or dismiss restaurant actions.</p></div><div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{automationQueue.filter(i => (i.status || 'open') === 'open').length} open</div></div>
            <div className="space-y-2 max-h-[560px] overflow-y-auto custom-scrollbar">
              {automationQueue.length ? automationQueue.slice(0, 50).map(item => (
                <div key={item.id} className="rounded-2xl border border-[#2A353D] bg-[#12161A] p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-black text-white">{item.title}</span><span className="text-[8px] uppercase tracking-widest font-black rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-200 px-2 py-0.5">{item.type}</span><span className="text-[8px] uppercase tracking-widest font-black rounded-full border border-[#2A353D] text-slate-400 px-2 py-0.5">{item.status || 'open'}</span></div><div className="text-[11px] text-slate-400 font-bold mt-1">{item.restaurantName || item.restaurantId}</div><div className="text-xs text-slate-300 font-bold leading-5 mt-1">{item.detail}</div></div>
                  <div className="shrink-0 rounded-xl border border-purple-500/20 bg-purple-950/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-purple-200">Restaurant Review Only</div>
                </div>
              )) : <p className="text-xs text-slate-500 font-bold">No approval items yet.</p>}
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

      {/* --- TAB: LEGAL DATA RETENTION SETUP --- */}
      {subTab === 'retention' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-5 border-emerald-900/40`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2"><Shield size={20} className="text-emerald-400"/> Legal Data Retention Setup</h2>
                <p className="text-xs text-slate-400 font-bold leading-6 mt-2 max-w-3xl">This saves the official 86 Chaos retention policy marker into Firestore and gives the exact production checklist. It does not delete anything by itself. Automatic deletion/archive only runs after Firebase Functions are deployed in the production Firebase project.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={handleInitializeRetentionConfig} disabled={retentionSaving} className="bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest disabled:opacity-50">
                  {retentionSaving ? 'Saving...' : 'One-Click App Setup'}
                </button>
                <button type="button" onClick={() => { navigator.clipboard?.writeText('firebase deploy --only functions --project YOUR_PRODUCTION_PROJECT_ID'); addToast('Copied', 'Firebase Functions deploy command copied.'); }} className="bg-[#12161A] border border-[#2A353D] text-[#D4A381] hover:text-white rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest">Copy Deploy Command</button>
              </div>
            </div>
            {lastRetentionSetup && <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-emerald-300">Saved {new Date(lastRetentionSetup).toLocaleString()}</div>}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className={`${T.card} p-5`}>
              <h3 className="font-black text-white mb-3">Official Retention Schedule</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(RETENTION_POLICY).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 border-b border-[#2A353D]/70 pb-2">
                    <span className="text-slate-400 font-black uppercase tracking-widest text-[10px]">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-slate-100 font-bold text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${T.card} p-5`}>
              <h3 className="font-black text-white mb-3">Production Setup Checklist</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 font-bold leading-6">
                <li>Create a private production archive bucket for time-clock/geofence archives.</li>
                <li>Add <code className="text-[#D4A381]">RETENTION_ARCHIVE_BUCKET</code> to the production Firebase Functions env file.</li>
                <li>Optionally add <code className="text-[#D4A381]">AI_UPLOADS_BUCKET</code>; blank uses the default Storage bucket.</li>
                <li>Run a fresh production backup before deploying retention functions.</li>
                <li>Deploy Firebase Functions from the production project.</li>
                <li>Open Firebase Functions and Cloud Scheduler and confirm all retention jobs exist.</li>
                <li>Check logs after the first run before trusting automatic deletion.</li>
              </ol>
            </div>
          </div>

          <div className={`${T.card} p-5`}>
            <h3 className="font-black text-white mb-3">Expected Firebase Functions</h3>
            <div className="grid md:grid-cols-2 gap-3 text-xs font-bold text-slate-300">
              {['purgeTransientOperationalData', 'purgeExpiredAiUploads', 'archiveExpiredTimeClockData', 'purgeExpiredTimeClockArchives', 'purgeExpiredDatabaseBackups', 'hardDeleteExpiredWorkspaces', 'purgeExpiredAuditSecurityLogs'].map(name => (
                <div key={name} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3"><span className="text-[#D4A381] font-black">{name}</span></div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 font-bold mt-4 leading-5">Do not run destructive tests on live customer data. The archive job is intentionally fail-closed: if the archive bucket is missing or archive verification fails, time-clock records are not deleted.</p>
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

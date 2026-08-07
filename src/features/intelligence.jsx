import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Calendar, Check, Clock, Edit3, Loader2, Mic, Package, Plus, Save, Share2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, writeBatch, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { T, db, storage, auth, secureFetch, useLiveCollection, formatClockDateTime, getToday, logAudit } from '../core/appCore';
import { requestPersonalReminderRefresh, usePersonalReminderRows } from '../core/personalReminderQueries';
import { Modal, SmartEmptyState } from '../components/common';
import { canUseMenuIntelligence, getZeroStockMenuImpacts } from '../core/menuIntelligence';
import { buildMenuCostBreakdowns, summarizeMenuCostBreakdowns } from '../core/menuCosting';
import { prepareScannerUploadFile, formatScannerBytes } from '../core/fileCompression';
import { createAiScanIdempotencyKey, resolveClientScanPageCount, normalizeAiUsage, aiPageLimitMessage } from '../core/aiScanUsage';
import { makeReminderDate, parseReminderCommand, toDateInputValue, toTimeInputValue } from '../core/reminderUtils';
import { usePlanAccess } from '../hooks/usePlanAccess';
import { FEATURE_KEYS } from '../config/plans';

const getInitialReminderDate = () => {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return { date: toDateInputValue(d), time: toTimeInputValue(d) };
};

const formatElapsedSeconds = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatUploadBytes = (bytes = 0) => `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)}MB`;


const REMINDER_SNOOZE_OPTIONS = [30, 60, 90, 120, 180, 240];

const getReminderWakeAt = (reminder = {}) => reminder.snoozedUntil || reminder.nextReminderAt || reminder.scheduledAt || '';


const reminderNeedsAttention = (reminder = {}) => {
  const status = String(reminder.status || '').toLowerCase();
  if (status === 'done' || status === 'cancelled' || status === 'archived') return false;
  const target = Date.parse(getReminderWakeAt(reminder));
  return Number.isFinite(target) && target <= Date.now();
};

const formatSnoozeLabel = (minutes = 30) => {
  const safe = Math.max(30, Number(minutes) || 30);
  if (safe === 30) return '30 minutes';
  if (safe % 60 === 0) return `${safe / 60} hour${safe === 60 ? '' : 's'}`;
  return `${safe / 60} hours`;
};

const FIRESTORE_BATCH_DELETE_LIMIT = 450;

const batchDeleteRefs = async (refs = [], onProgress = null) => {
  const cleanRefs = refs.filter(Boolean);
  let deleted = 0;
  for (let i = 0; i < cleanRefs.length; i += FIRESTORE_BATCH_DELETE_LIMIT) {
    const chunk = cleanRefs.slice(i, i + FIRESTORE_BATCH_DELETE_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach(refToDelete => batch.delete(refToDelete));
    await batch.commit();
    deleted += chunk.length;
    if (typeof onProgress === 'function') onProgress(deleted, cleanRefs.length);
  }
  return deleted;
};

const WorkProgressBar = ({ label, detail, percent = 0, elapsedSeconds = 0 }) => {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return (
    <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest">
        <span className="text-white truncate">{label || 'Working'}</span>
        <span className="text-[#D4A381] shrink-0">{safePercent}% · {formatElapsedSeconds(elapsedSeconds)}</span>
      </div>
      <div className="h-3 rounded-full bg-black/40 border border-[#2A353D] overflow-hidden">
        <div className="h-full rounded-full bg-[#D4A381] transition-all duration-500" style={{ width: `${safePercent}%` }} />
      </div>
      {detail && <div className="text-[10px] text-slate-500 font-bold leading-snug">{detail}</div>}
    </div>
  );
};

const TabPersonalReminders = ({ appUser, addToast }) => {
  const initial = getInitialReminderDate();
  const currentUserId = auth?.currentUser?.uid || appUser?.id || '';
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dateInput, setDateInput] = useState(initial.date);
  const [timeInput, setTimeInput] = useState(initial.time);
  const [shareMode, setShareMode] = useState('self');
  const [assignedToUserId, setAssignedToUserId] = useState(currentUserId);
  const [editing, setEditing] = useState(null);
  const [listening, setListening] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoadError, setTeamLoadError] = useState('');
  const reminderRecognitionRef = useRef(null);


  const stopReminderRecognition = () => {
    const rec = reminderRecognitionRef.current;
    if (rec) {
      try { rec._chaosIntentionalStop = true; } catch (_) {}
      try { rec.abort?.(); } catch (_) { try { rec.stop?.(); } catch (e) {} }
      reminderRecognitionRef.current = null;
    }
    setListening(false);
  };

  useEffect(() => () => stopReminderRecognition(), [appUser?.id, appUser?.restaurantId]);

  const reminderVoiceErrorMessage = (error = {}) => {
    const code = String(error?.error || error?.name || error?.message || '').toLowerCase();
    if (/not-allowed|permission|denied/.test(code)) return 'Microphone permission is blocked. Type the reminder instead.';
    if (/audio-capture|device/.test(code)) return 'No microphone was found. Type the reminder instead.';
    if (/no-speech/.test(code)) return 'No speech was detected. Try again or type the reminder.';
    if (/network/.test(code)) return 'Speech recognition had a network problem. Type the reminder instead.';
    if (/abort/.test(code)) return '';
    return 'Could not hear the reminder clearly. Type it instead.';
  };

  const allReminderRows = usePersonalReminderRows(appUser, {
    enabled: !!appUser?.restaurantId && !!appUser?.id,
    limitCount: 120,
    fallbackLimitCount: 60,
    debugLabel: 'personal-reminders'
  });
  const sortedActiveReminders = useMemo(() => [...(allReminderRows || [])]
    .filter(r => r.dispatchEligible !== false)
    .sort((a, b) => String(a.nextDispatchAt || a.scheduledAt || '').localeCompare(String(b.nextDispatchAt || b.scheduledAt || ''))), [allReminderRows]);
  const pendingReminders = sortedActiveReminders.filter(r => !['done','completed','cancelled','canceled','dismissed','archived','sent'].includes(String(r.status || '').toLowerCase()));
  const completedReminders = useMemo(() => showCompleted ? [...(allReminderRows || [])]
    .filter(r => ['sent','done','completed','dismissed','archived','cancelled','canceled'].includes(String(r.status || '').toLowerCase()))
    .sort((a,b) => String(b.terminalAt || b.completedAt || b.dispatchedAt || b.updatedAt || '').localeCompare(String(a.terminalAt || a.completedAt || a.dispatchedAt || a.updatedAt || ''))) : [], [allReminderRows, showCompleted]);
  const dueReminderCount = pendingReminders.filter(reminderNeedsAttention).length;

  useEffect(() => {
    let cancelled = false;
    if (!appUser?.restaurantId || shareMode !== 'team') {
      setTeamMembers([]);
      return undefined;
    }
    const loadTeam = async () => {
      try {
        setTeamLoadError('');
        const snap = await getDocs(query(collection(db, 'users'), where('restaurantId', '==', appUser.restaurantId), where('isActive', '==', true), orderBy('name', 'asc'), firestoreLimit(80)));
        if (cancelled) return;
        const rows = snap.docs
          .map(row => ({ id: row.id, ...row.data() }))
          .filter(row => row.active !== false && row.disabled !== true)
          .sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')));
        const hasSelf = rows.some(row => row.id === currentUserId);
        setTeamMembers(hasSelf ? rows : [{ id: currentUserId, name: appUser.name, email: appUser.email, role: appUser.role }, ...rows]);
      } catch (err) {
        if (!cancelled) {
          setTeamLoadError(err?.message || 'Team list could not load.');
          setTeamMembers([{ id: currentUserId, name: appUser.name, email: appUser.email, role: appUser.role }]);
        }
      }
    };
    loadTeam();
    return () => { cancelled = true; };
  }, [appUser?.restaurantId, currentUserId, shareMode]);

  const applyParsedText = (value) => {
    const parsed = parseReminderCommand(value);
    if (parsed) {
      if (parsed.validationError) {
        addToast('Reminder Date Blocked', parsed.validationError);
        setTitle(parsed.title || value);
        return;
      }
      setTitle(parsed.title);
      if (parsed.dateInput) setDateInput(parsed.dateInput);
      if (parsed.timeInput) setTimeInput(parsed.timeInput);
      if (parsed.needsManualTime) addToast('Needs Time', 'I found the reminder text. Pick the date and time before saving.');
    } else {
      setTitle(value);
    }
  };

  const startListening = () => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) return addToast('Mic Unavailable', 'This browser does not support built-in speech recognition. Type the reminder instead.');
    if (reminderRecognitionRef.current) return addToast('Already Listening', 'Speak Reminder is already listening. Stop it before starting another microphone session.');
    try {
      const rec = new SpeechRecognition();
      reminderRecognitionRef.current = rec;
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setListening(true);
      rec.onresult = (event) => {
        if (reminderRecognitionRef.current !== rec) return;
        const text = event.results?.[0]?.[0]?.transcript || '';
        reminderRecognitionRef.current = null;
        setListening(false);
        applyParsedText(text);
      };
      rec.onerror = (event) => {
        if (reminderRecognitionRef.current !== rec) return;
        reminderRecognitionRef.current = null;
        setListening(false);
        const message = rec._chaosIntentionalStop ? '' : reminderVoiceErrorMessage(event);
        if (message) addToast('Voice Error', message);
      };
      rec.onend = () => {
        if (reminderRecognitionRef.current !== rec) return;
        reminderRecognitionRef.current = null;
        setListening(false);
      };
      rec.start();
    } catch (err) {
      reminderRecognitionRef.current = null;
      setListening(false);
      addToast('Voice Error', reminderVoiceErrorMessage(err) || 'Could not start the microphone.');
    }
  };

  const resetForm = () => {
    const next = getInitialReminderDate();
    setTitle('');
    setNotes('');
    setDateInput(next.date);
    setTimeInput(next.time);
    setShareMode('self');
    setAssignedToUserId(auth?.currentUser?.uid || appUser?.id || '');
    setEditing(null);
  };

  const saveReminder = async (e) => {
    e.preventDefault();
    if (!title.trim()) return addToast('Missing Text', 'Type what you want to be reminded about.');
    const scheduledDate = makeReminderDate(dateInput, timeInput);
    if (!scheduledDate) return addToast('Missing Time', 'Choose a valid reminder date and time.');
    const targetUserId = shareMode === 'team' ? (assignedToUserId || auth?.currentUser?.uid || appUser.id || '') : (auth?.currentUser?.uid || appUser.id || '');
    const response = await secureFetch('/api/personal-reminder-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reminderId: editing?.id || '',
        restaurantId: appUser.restaurantId,
        assignedToUserId: targetUserId,
        title: title.trim(),
        notes: notes.trim(),
        scheduledAt: scheduledDate.toISOString(),
        recurrence: editing?.recurrence || 'none',
        timezone: editing?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || 'Reminder could not be saved.');
    if (editing?.id) addToast('Reminder Updated', title.trim());
    else addToast('Reminder Saved', `${title.trim()} at ${formatClockDateTime(scheduledDate.toISOString())}.`);
    await logAudit(appUser, editing ? 'REMINDER_UPDATED' : 'REMINDER_CREATED', title.trim(), scheduledDate.toISOString());
    requestPersonalReminderRefresh({ restaurantId: appUser.restaurantId, uid: auth?.currentUser?.uid || appUser?.authUid || appUser?.id || '' });
    resetForm();
  };

  const editReminder = (reminder) => {
    const d = reminder.scheduledAt ? new Date(reminder.scheduledAt) : new Date();
    setEditing(reminder);
    setTitle(reminder.title || '');
    setNotes(reminder.notes || '');
    setDateInput(toDateInputValue(d));
    setTimeInput(toTimeInputValue(d));
    const targetUserId = reminder.assignedToUserId || reminder.userId || currentUserId;
    setAssignedToUserId(targetUserId);
    setShareMode(targetUserId && targetUserId !== currentUserId ? 'team' : 'self');
  };

  const runReminderAction = async (reminder, action, extra = {}) => {
    const response = await secureFetch('/api/personal-reminder-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderId: reminder.id, action, ...extra })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Reminder action failed.');
    requestPersonalReminderRefresh({ restaurantId: appUser.restaurantId, uid: auth?.currentUser?.uid || appUser?.authUid || appUser?.id || '' });
    return result;
  };

  const markDone = async (reminder) => {
    try {
      await runReminderAction(reminder, 'complete');
      addToast('Reminder Done', reminder.title || 'Reminder');
    } catch (err) { addToast('Reminder Error', err.message || 'Could not complete reminder.'); }
  };

  const reopenReminder = async (reminder) => {
    try {
      const wakeAt = getReminderWakeAt(reminder) || new Date().toISOString();
      await runReminderAction(reminder, 'reopen', { scheduledAt: wakeAt });
      addToast('Reminder Reopened', reminder.title || 'Reminder');
    } catch (err) { addToast('Reminder Error', err.message || 'Could not reopen reminder.'); }
  };

  const snoozeReminder = async (reminder, minutes) => {
    try {
      const next = new Date(Date.now() + Number(minutes || 0) * 60000).toISOString();
      await runReminderAction(reminder, 'snooze', { minutes });
      addToast('Reminder Snoozed', `${reminder.title || 'Reminder'} will return ${formatClockDateTime(next)}.`);
    } catch (err) { addToast('Reminder Error', err.message || 'Could not snooze reminder.'); }
  };

  const removeReminder = async (reminder) => {
    try {
      await runReminderAction(reminder, 'cancel');
      addToast('Reminder Cancelled', reminder.title || 'Reminder');
    } catch (err) { addToast('Reminder Error', err.message || 'Could not cancel reminder.'); }
  };

  return (
    <div className="space-y-4 animate-[slideIn_0.25s_ease-out]">
      <div className={`${T.card} p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
        <div><h2 className="text-xl font-black text-white">Personal Reminders</h2><p className="text-xs text-slate-400 font-bold">Private or teammate reminders, queued for the optimized dispatcher.</p></div>
        <button type="button" aria-label={listening ? 'Stop reminder voice entry' : 'Speak Reminder'} aria-pressed={listening} onClick={listening ? stopReminderRecognition : startListening} className={`${T.btnAlt} flex items-center justify-center gap-2 ${listening ? 'text-red-300 border-red-500/40' : ''}`}><Mic size={16}/> {listening ? 'Listening' : 'Speak Reminder'}</button>
      </div>

      <form onSubmit={saveReminder} className={`${T.card} p-4 grid lg:grid-cols-[1.35fr_.62fr_.52fr_.72fr_auto] gap-3 items-end`}>
        <div><label className={T.label}>Reminder</label><input value={title} onChange={e => setTitle(e.target.value)} onBlur={e => /^remind me/i.test(e.target.value) && applyParsedText(e.target.value)} className={T.input} placeholder="Remind me tomorrow at 9 AM to order buns" /></div>
        <div><label className={T.label}>Date</label><input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} className={T.input} /></div>
        <div><label className={T.label}>Time</label><input type="time" value={timeInput} onChange={e => setTimeInput(e.target.value)} className={T.input} /></div>
        <div>
          <label className={T.label}>Sharing</label>
          <select value={shareMode} onChange={e => { const mode = e.target.value; setShareMode(mode); if (mode === 'self') setAssignedToUserId(auth?.currentUser?.uid || appUser?.id || ''); }} className={T.input}>
            <option value="self">Just me</option>
            <option value="team">Share with teammate</option>
          </select>
        </div>
        <button className={`${T.btn} h-11 flex items-center justify-center gap-2`}>{editing ? <Save size={16}/> : <Plus size={16}/>} {editing ? 'Save' : 'Add'}</button>
        {shareMode === 'team' && <div className="lg:col-span-5"><label className={T.label}>Teammate</label><select value={assignedToUserId} onChange={e => setAssignedToUserId(e.target.value)} className={T.input}>{teamMembers.length === 0 && <option value="">Loading teammates…</option>}{teamMembers.filter(member => member.id !== currentUserId).map(member => <option key={member.id} value={member.id}>{member.name || member.email || 'Team member'}{member.role ? ` • ${member.role}` : ''}</option>)}</select>{teamLoadError && <div className="mt-2 text-[10px] font-bold text-amber-300">Team list warning: {teamLoadError}</div>}</div>}
        <div className="lg:col-span-5"><label className={T.label}>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className={T.input} placeholder="Optional private note" />{editing && <button type="button" onClick={resetForm} className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Cancel edit</button>}</div>
      </form>

      <div className="grid lg:grid-cols-[1fr_.8fr] gap-4">
        <div className={`${T.card} overflow-hidden`}>
          <div className={`${T.th} flex items-center justify-between`}><span>Upcoming</span>{dueReminderCount > 0 && <span className="inline-flex items-center gap-1 text-[10px] text-red-200"><span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,.8)]"/> Due / overdue</span>}</div>
          {pendingReminders.length === 0 ? <SmartEmptyState title="No reminders yet" desc="Add one by typing, sharing, or using the mic." /> : pendingReminders.map(reminder => {
            const createdByMe = (reminder.createdBy || reminder.userId) === currentUserId;
            const assignedToMe = (reminder.assignedToUserId || reminder.userId) === currentUserId;
            const wakeAt = getReminderWakeAt(reminder);
            const shareLabel = reminder.shared ? (createdByMe ? `For ${reminder.assignedToName || 'team member'}` : `From ${reminder.createdByName || 'team member'}`) : 'Just me';
            return <div key={reminder.id} className={`${T.row} flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${reminderNeedsAttention(reminder) ? 'bg-red-950/10 border-red-500/25' : ''}`}><div className="min-w-0 flex-1"><div className="font-black text-white text-sm truncate flex items-center gap-2">{reminder.shared && <Share2 size={13} className="text-blue-300"/>}{reminder.title}</div><div className="text-[10px] text-[#D4A381] font-black uppercase tracking-widest mt-1 flex flex-wrap items-center gap-1"><Clock size={12}/> {wakeAt ? formatClockDateTime(wakeAt) : 'No time'} • {shareLabel}</div>{reminder.notes && <div className="text-xs text-slate-500 font-bold mt-1 truncate">{reminder.notes}</div>}</div><div className="flex flex-wrap items-center gap-1 justify-end"><select aria-label="Snooze reminder" value="" onChange={e => { if (e.target.value) snoozeReminder(reminder, Number(e.target.value)); }} disabled={!assignedToMe && !createdByMe} className="h-9 rounded-lg bg-[#12161A] border border-[#2A353D] px-2 text-[10px] font-black uppercase tracking-widest text-slate-300 disabled:opacity-40"><option value="">Snooze</option>{REMINDER_SNOOZE_OPTIONS.map(minutes => <option key={minutes} value={minutes}>{formatSnoozeLabel(minutes)}</option>)}</select><button onClick={() => markDone(reminder)} disabled={!assignedToMe && !createdByMe} className="p-2 rounded-lg bg-emerald-900/20 text-emerald-300 border border-emerald-900/50 disabled:opacity-40"><Check size={16}/></button><button onClick={() => editReminder(reminder)} disabled={!createdByMe} className="p-2 rounded-lg bg-[#12161A] text-slate-300 border border-[#2A353D] disabled:opacity-40"><Edit3 size={16}/></button><button onClick={() => removeReminder(reminder)} disabled={!createdByMe} className="p-2 rounded-lg bg-red-900/20 text-red-300 border border-red-900/50 disabled:opacity-40"><Trash2 size={16}/></button></div></div>;
          })}
        </div>
        <div className={`${T.card} overflow-hidden`}>
          <div className={`${T.th} flex items-center justify-between`}><span>Recently Closed</span><button type="button" onClick={() => setShowCompleted(v => !v)} className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">{showCompleted ? 'Hide' : 'Load History'}</button></div>
          {!showCompleted ? <div className="p-6 text-center text-xs font-bold text-slate-500">Completed history loads only when requested.</div> : completedReminders.length === 0 ? <div className="p-6 text-center text-xs font-bold text-slate-500">No completed reminders on this page.</div> : completedReminders.map(reminder => <div key={reminder.id} className={`${T.row} flex items-center justify-between gap-3`}><div className="min-w-0"><div className="font-bold text-slate-300 text-sm line-through truncate">{reminder.title}</div><div className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">{reminder.status}{reminder.completedAt ? ` • ${formatClockDateTime(reminder.completedAt)}` : ''}</div></div><button onClick={() => reopenReminder(reminder)} title="Unmark done" className="p-2 rounded-lg bg-emerald-900/20 text-emerald-300 border border-emerald-900/50"><Check size={16}/></button></div>)}
        </div>
      </div>
    </div>
  );
};

const TabMenuIntelligence = ({ appUser, clientData, inventoryItems = [], addToast }) => {
  const allowed = canUseMenuIntelligence(appUser, clientData);
  const menuDependencies = useLiveCollection('menuDependencies', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && allowed, limitCount: 500 });
  const scans = useLiveCollection('menuIntelligenceScans', appUser?.restaurantId, { enabled: !!appUser?.restaurantId && allowed, limitCount: 60 });
  const [file, setFile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveProgress, setApproveProgress] = useState(null);
  const [editingScan, setEditingScan] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingScanId, setDeletingScanId] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(null);
  const [progressTick, setProgressTick] = useState(Date.now());
  const [menuAiUsage, setMenuAiUsage] = useState({ menuPagesUsed: 0, menuPagesLimit: 10, menuPagesProcessed: 0, menuBypassPagesProcessed: 0 });
  const [menuAiUsageLoading, setMenuAiUsageLoading] = useState(false);
  const [menuAiExempt, setMenuAiExempt] = useState(false);
  const scanBusyRef = useRef(false);
  const approvingRef = useRef(false);
  const editSavingRef = useRef(false);
  const deleteBusyRef = useRef(false);
  const impacts = getZeroStockMenuImpacts(inventoryItems, menuDependencies);
  const approvedMenuCostRows = buildMenuCostBreakdowns({ menuDependencies, inventoryItems });
  const approvedMenuCostSummary = summarizeMenuCostBreakdowns(approvedMenuCostRows);

  const loadMenuAiUsage = async () => {
    if (!appUser?.restaurantId || !allowed) return;
    setMenuAiUsageLoading(true);
    try {
      const response = await secureFetch(`/api/ai-usage?restaurantId=${encodeURIComponent(appUser.restaurantId)}&eventLimit=5`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Could not load AI page usage.');
      setMenuAiUsage(payload.usage || { menuPagesUsed: 0, menuPagesLimit: 10, menuPagesProcessed: 0, menuBypassPagesProcessed: 0 });
      setMenuAiExempt(payload.isExempt === true);
    } catch (error) {
      console.warn('Menu AI usage could not load:', error?.message || error);
    } finally {
      setMenuAiUsageLoading(false);
    }
  };

  useEffect(() => { loadMenuAiUsage(); }, [appUser?.restaurantId, allowed]);

  const isIngredientApproved = (ingredient = {}) => ingredient.reviewStatus !== 'rejected' && ingredient.approved !== false;
  const normalizeReviewResult = (result = {}) => ({
    ...result,
    menuItems: (result.menuItems || []).map(item => ({
      ...item,
      price: item.price ?? item.menuPrice ?? '',
      priceText: item.priceText || item.priceLabel || '',
      ingredients: (item.ingredients || []).map(ingredient => ({
        ...ingredient,
        estimatedQuantity: ingredient.estimatedQuantity ?? ingredient.quantity ?? ingredient.portionQuantity ?? '',
        estimatedUnit: ingredient.estimatedUnit || ingredient.unit || ingredient.portionUnit || '',
        portionConfidence: ingredient.portionConfidence || ingredient.confidence || 'review',
        reviewStatus: ingredient.reviewStatus || (ingredient.matchedInventoryItemId ? 'approved' : 'needs-match')
      }))
    }))
  });
  const confidenceLabel = (value) => {
    if (value === undefined || value === null || value === '') return 'manual';
    if (typeof value === 'number') return `${Math.round(value * 100)}%`;
    const text = String(value).trim();
    if (/^0?\.\d+$/.test(text)) return `${Math.round(Number(text) * 100)}%`;
    return text.replace(/_/g, ' ');
  };
  const confidenceClass = (value) => {
    const text = String(value || '').toLowerCase();
    const num = typeof value === 'number' ? value : (/^0?\.\d+$/.test(text) ? Number(text) : null);
    if (num !== null) return num >= 0.82 ? 'text-emerald-300 border-emerald-900/50 bg-emerald-900/20' : num >= 0.55 ? 'text-amber-300 border-amber-900/50 bg-amber-900/20' : 'text-red-300 border-red-900/50 bg-red-900/20';
    if (/high|strong|exact|reviewed|manual/.test(text)) return 'text-emerald-300 border-emerald-900/50 bg-emerald-900/20';
    if (/medium|possible|ai/.test(text)) return 'text-amber-300 border-amber-900/50 bg-amber-900/20';
    if (/low|weak|unknown/.test(text)) return 'text-red-300 border-red-900/50 bg-red-900/20';
    return 'text-slate-300 border-[#2A353D] bg-[#0B0E11]';
  };

  useEffect(() => {
    if (!busy && !approving && !editSaving && !deletingScanId) return undefined;
    const timer = setInterval(() => setProgressTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy, approving, editSaving, deletingScanId]);

  const progressElapsed = (progress) => Math.max(0, Math.floor((progressTick - (progress?.startedAt || Date.now())) / 1000));
  const displayedPercent = (progress, cap = 96) => {
    if (!progress) return 0;
    const elapsed = progressElapsed(progress);
    const base = Number(progress.percent) || 0;
    return Math.min(progress.done ? 100 : cap, Math.max(base, base + Math.min(18, elapsed * 1.4)));
  };

  const getScanDependencies = (scan) => {
    if (!scan) return [];
    const storagePath = scan.storagePath || '';
    const fileName = scan.fileName || '';
    return menuDependencies.filter(dep => {
      if (storagePath && dep.scanStoragePath === storagePath) return true;
      if (!storagePath && fileName && dep.scanFileName === fileName) return true;
      return false;
    });
  };

  const buildEditableScanResult = (scan, loadedDeps = null) => {
    const deps = loadedDeps || getScanDependencies(scan);
    const groups = [];
    const keyToIndex = new Map();
    deps.forEach(dep => {
      const key = [dep.menuItemName || 'Menu item', dep.menuCategory || '', dep.menuDescription || ''].join('||');
      if (!keyToIndex.has(key)) {
        keyToIndex.set(key, groups.length);
        groups.push({
          name: dep.menuItemName || 'Menu item',
          category: dep.menuCategory || '',
          description: dep.menuDescription || '',
          price: dep.menuItemPrice ?? dep.menuPrice ?? '',
          priceText: dep.menuItemPriceText || dep.menuPriceText || '',
          ingredients: []
        });
      }
      groups[keyToIndex.get(key)].ingredients.push({
        dependencyId: dep.id,
        name: dep.ingredientName || dep.inventoryItemName || '',
        matchedInventoryItemId: dep.inventoryItemId || '',
        matchedInventoryItemName: dep.inventoryItemName || '',
        estimatedQuantity: dep.estimatedQuantity ?? dep.portionQuantity ?? '',
        estimatedUnit: dep.estimatedUnit || dep.portionUnit || '',
        portionConfidence: dep.portionConfidence || dep.confidence || 'manual',
        confidence: dep.confidence || 'manual',
        reviewStatus: dep.status === 'rejected' ? 'rejected' : 'approved'
      });
    });
    return {
      fileName: scan?.fileName || 'Menu scan',
      storagePath: scan?.storagePath || '',
      downloadUrl: scan?.downloadUrl || '',
      menuItems: groups
    };
  };

  const fetchScanDependencies = async (scan) => {
    if (!scan) return [];
    const cachedDeps = getScanDependencies(scan);
    try {
      if (scan.storagePath) {
        const snap = await getDocs(query(collection(db, 'menuDependencies'), where('restaurantId', '==', appUser.restaurantId), where('scanStoragePath', '==', scan.storagePath)));
        return snap.docs.map(row => ({ id: row.id, ...row.data() })).filter(dep => dep.restaurantId === appUser.restaurantId);
      }
      if (scan.fileName) {
        const snap = await getDocs(query(collection(db, 'menuDependencies'), where('restaurantId', '==', appUser.restaurantId), where('scanFileName', '==', scan.fileName)));
        return snap.docs.map(row => ({ id: row.id, ...row.data() })).filter(dep => dep.restaurantId === appUser.restaurantId);
      }
      return cachedDeps;
    } catch (err) {
      if (cachedDeps.length) return cachedDeps;
      throw err;
    }
  };

  const openEditScan = async (scan) => {
    setEditingScan(scan);
    setEditResult({ fileName: scan?.fileName || 'Menu scan', storagePath: scan?.storagePath || '', downloadUrl: scan?.downloadUrl || '', menuItems: [] });
    setEditOpen(true);
    try {
      const deps = await fetchScanDependencies(scan);
      setEditResult(buildEditableScanResult(scan, deps));
    } catch (err) {
      addToast('Could Not Load Links', err.message || 'Could not load menu links for this scan.');
    }
  };

  const updateMenuItem = (itemIdx, patch, mode = 'scan') => {
    const source = mode === 'edit' ? editResult : scanResult;
    const menuItems = [...(source?.menuItems || [])];
    menuItems[itemIdx] = { ...menuItems[itemIdx], ...patch };
    if (mode === 'edit') setEditResult({ ...editResult, menuItems });
    else setScanResult({ ...scanResult, menuItems });
  };

  const updateIngredient = (itemIdx, ingIdx, patch, mode = 'scan') => {
    const source = mode === 'edit' ? editResult : scanResult;
    const menuItems = [...(source?.menuItems || [])];
    const ingredients = [...(menuItems[itemIdx].ingredients || [])];
    ingredients[ingIdx] = { ...ingredients[ingIdx], ...patch };
    menuItems[itemIdx] = { ...menuItems[itemIdx], ingredients };
    if (mode === 'edit') setEditResult({ ...editResult, menuItems });
    else setScanResult({ ...scanResult, menuItems });
  };

  const removeIngredient = (itemIdx, ingIdx, mode = 'scan') => {
    const source = mode === 'edit' ? editResult : scanResult;
    const item = (source?.menuItems || [])[itemIdx] || {};
    const ingredients = [...(item.ingredients || [])];
    ingredients.splice(ingIdx, 1);
    updateMenuItem(itemIdx, { ingredients }, mode);
  };

  const addIngredientToItem = (itemIdx, mode = 'scan') => {
    const source = mode === 'edit' ? editResult : scanResult;
    const item = (source?.menuItems || [])[itemIdx] || {};
    updateMenuItem(itemIdx, { ingredients: [...(item.ingredients || []), { name: '', matchedInventoryItemId: '', estimatedQuantity: '', estimatedUnit: '', portionConfidence: 'manual', confidence: 'manual', reviewStatus: 'needs-match' }] }, mode);
  };

  const addMenuItemToEdit = () => {
    setEditResult({
      ...(editResult || {}),
      menuItems: [...(editResult?.menuItems || []), { name: '', category: '', description: '', price: '', priceText: '', ingredients: [{ name: '', matchedInventoryItemId: '', estimatedQuantity: '', estimatedUnit: '', portionConfidence: 'manual', confidence: 'manual', reviewStatus: 'needs-match' }] }]
    });
  };

  const removeEditMenuItem = (itemIdx) => {
    const menuItems = [...(editResult?.menuItems || [])];
    menuItems.splice(itemIdx, 1);
    setEditResult({ ...editResult, menuItems });
  };

  if (!allowed) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className={`${T.card} p-8 text-center`}>
          <Sparkles className="mx-auto text-slate-500 mb-3" size={38}/>
          <h2 className="text-xl font-black text-white">Menu Intelligence is owner controlled</h2>
          <p className="text-sm text-slate-400 font-bold mt-2">Ask the account owner to grant Menu Intelligence access in Settings.</p>
        </div>
      </div>
    );
  }

  const scanMenu = async () => {
    if (scanBusyRef.current) return;
    if (!file) return addToast('Choose File', 'Upload a menu image or PDF first.');
    scanBusyRef.current = true;
    let requestedPages = 0;
    try {
      requestedPages = await resolveClientScanPageCount(file);
    } catch (pageError) {
      addToast('Cannot Count PDF Pages', pageError.message || 'The page count could not be verified safely.');
      scanBusyRef.current = false;
      return;
    }
    const currentUsage = normalizeAiUsage(menuAiUsage, 'menu');
    if (!menuAiExempt && requestedPages > currentUsage.remaining) {
      addToast('Menu AI Page Limit', aiPageLimitMessage('menu', menuAiUsage, requestedPages));
      scanBusyRef.current = false;
      return;
    }
    const idempotencyKey = createAiScanIdempotencyKey('menu', appUser?.restaurantId);
    setBusy(true);
    const scanStartedAt = Date.now();
    setProgressTick(scanStartedAt);
    setScanProgress({ label: 'Preparing menu file', detail: 'Checking whether the menu needs automatic compression.', percent: 4, startedAt: scanStartedAt });
    try {
      const prepared = await prepareScannerUploadFile(file, {
        label: 'Menu file',
        maxBytes: 20 * 1024 * 1024,
        imageCompressAboveBytes: 6 * 1024 * 1024,
        targetImageBytes: 8 * 1024 * 1024,
        maxImageDimension: 2600,
        onProgress: info => setScanProgress({
          label: info.label || 'Preparing menu file',
          detail: info.detail || '',
          percent: Math.max(4, Math.min(42, info.percent || 10)),
          startedAt: scanStartedAt
        })
      });
      const uploadFile = prepared.file;
      if (prepared.wasCompressed) addToast('Menu Compressed', `${prepared.displaySizeBefore} → ${prepared.displaySizeAfter}. Scanning the smaller copy.`);

      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90);
      const path = `${appUser.restaurantId}/menuUploads/menu-${Date.now()}-${safeName}`;
      const fileRef = ref(storage, path);
      setScanProgress({ label: 'Uploading menu', detail: `Starting secure upload (${formatScannerBytes(uploadFile.size)}).`, percent: 42, startedAt: scanStartedAt });
      const uploadTask = uploadBytesResumable(fileRef, uploadFile, {
        contentType: uploadFile.type || file.type || 'application/octet-stream',
        customMetadata: {
          originalName: file.name || '',
          uploadedName: uploadFile.name || '',
          originalBytes: String(file.size || 0),
          uploadedBytes: String(uploadFile.size || 0),
          compressionMethod: prepared.compression?.method || 'none',
          compressed: prepared.wasCompressed ? 'true' : 'false',
          purpose: 'menu-scan',
          restaurantId: appUser.restaurantId
        }
      });
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed', snapshot => {
          const ratio = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
          setScanProgress({
            label: 'Uploading menu',
            detail: `Uploaded ${formatUploadBytes(snapshot.bytesTransferred)} of ${formatUploadBytes(snapshot.totalBytes || uploadFile.size)}.`,
            percent: 42 + Math.round(ratio * 20),
            startedAt: scanStartedAt
          });
        }, reject, resolve);
      });
      setScanProgress({ label: 'Upload complete', detail: 'Preparing the AI menu reader.', percent: 63, startedAt: scanStartedAt });
      const downloadUrl = await getDownloadURL(fileRef);
      setScanProgress({ label: 'Reading menu with AI', detail: 'Finding menu items, ingredients, and inventory matches. This can take a minute for big menus.', percent: 70, startedAt: scanStartedAt });
      const response = await secureFetch('/api/scan-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: appUser.restaurantId,
          fileName: file.name,
          uploadedFileName: uploadFile.name,
          contentType: uploadFile.type || file.type,
          storagePath: path,
          downloadUrl,
          compression: prepared.compression,
          inventoryItems: inventoryItems.map(i => ({ id: i.id, name: i.name, category: i.category, packSize: i.packSize, yieldQty: i.yieldQty, price: i.price, supplierName: i.supplierName, pfgCode: i.pfgCode, sku: i.sku })),
          idempotencyKey
        })
      });
      setScanProgress({ label: 'Building review screen', detail: 'Loading the menu matches for approval.', percent: 90, startedAt: scanStartedAt });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        if (result.code === 'AI_PAGE_LIMIT_REACHED') {
          setMenuAiUsage(previous => ({ ...previous, menuPagesUsed: result.used, menuPagesLimit: result.limit }));
          throw new Error(`This restaurant has used all menu AI pages for ${result.monthKey}. Used ${result.used} of ${result.limit}; ${result.remaining} remain.`);
        }
        if (result.code === 'AI_SCAN_ALREADY_SUBMITTED') throw new Error('This menu scan was already submitted. Wait for the first request to finish before trying again.');
        throw new Error(result?.error || 'Menu scan failed.');
      }
      if (result.aiUsage) setMenuAiUsage(previous => ({ ...previous, menuPagesUsed: result.aiUsage.usedAfter, menuPagesLimit: result.aiUsage.limit, menuPagesProcessed: result.aiUsage.processedAfter ?? Math.max(Number(previous.menuPagesProcessed || 0), Number(result.aiUsage.usedAfter || 0)), menuBypassPagesProcessed: result.aiUsage.bypassPagesAfter ?? Number(previous.menuBypassPagesProcessed || 0) }));
      setScanResult(normalizeReviewResult({ ...result, storagePath: path, downloadUrl, fileName: file.name, uploadedFileName: uploadFile.name, compression: prepared.compression }));
      setReviewOpen(true);
      setScanProgress({ label: 'Menu scan ready', detail: 'Review the AI matches before saving.', percent: 100, done: true, startedAt: scanStartedAt });
      addToast('Menu Scanned', 'Review the AI matches before saving.');
      setTimeout(() => setScanProgress(null), 1400);
    } catch (err) {
      const message = err.message || 'Could not scan menu.';
      setScanProgress({ label: 'Scan stopped', detail: message, percent: 100, done: true, startedAt: scanStartedAt });
      addToast(/over|compress|split|large/i.test(message) ? 'Menu Too Large' : 'Scan Failed', message);
      setTimeout(() => setScanProgress(null), 2200);
    } finally {
      scanBusyRef.current = false;
      setBusy(false);
      loadMenuAiUsage();
    }
  };

  const approveMenu = async () => {
    if (approvingRef.current) return;
    approvingRef.current = true;
    const menuItems = scanResult?.menuItems || [];
    const totalLinks = menuItems.reduce((sum, item) => sum + (item.ingredients || []).filter(ingredient => ingredient.matchedInventoryItemId && isIngredientApproved(ingredient)).length, 0);
    let saved = 0;
    setApproving(true);
    const approveStartedAt = Date.now();
    setProgressTick(approveStartedAt);
    setApproveProgress({ label: 'Approving menu links', detail: `Saving ${totalLinks} reviewed ingredient ${totalLinks === 1 ? 'link' : 'links'}.`, percent: 5, startedAt: approveStartedAt });
    try {
      for (const item of menuItems) {
        for (const ingredient of item.ingredients || []) {
          if (!ingredient.matchedInventoryItemId || !isIngredientApproved(ingredient)) continue;
          const inventoryItem = inventoryItems.find(inv => inv.id === ingredient.matchedInventoryItemId);
          await addDoc(collection(db, 'menuDependencies'), {
            restaurantId: appUser.restaurantId,
            menuItemName: item.name || 'Menu item',
            menuCategory: item.category || '',
            menuDescription: item.description || '',
            menuItemPrice: Number.parseFloat(item.price ?? item.menuPrice ?? 0) || 0,
            menuItemPriceText: item.priceText || '',
            ingredientName: ingredient.name || inventoryItem?.name || '',
            inventoryItemId: ingredient.matchedInventoryItemId,
            inventoryItemName: inventoryItem?.name || ingredient.matchedInventoryItemName || ingredient.name || '',
            estimatedQuantity: Number.parseFloat(ingredient.estimatedQuantity ?? ingredient.quantity ?? 0) || 0,
            estimatedUnit: ingredient.estimatedUnit || ingredient.unit || '',
            portionConfidence: ingredient.portionConfidence || ingredient.confidence || item.confidence || 'reviewed',
            confidence: ingredient.confidence || item.confidence || 'reviewed',
            source: 'menu_intelligence_ai_review',
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: appUser.name || appUser.email || appUser.id || '',
            scanFileName: scanResult.fileName || '',
            scanStoragePath: scanResult.storagePath || ''
          });
          saved++;
          const pct = totalLinks ? Math.min(88, 8 + Math.round((saved / totalLinks) * 78)) : 70;
          setApproveProgress({ label: 'Approving menu links', detail: `Saved ${saved} of ${totalLinks} reviewed links.`, percent: pct, startedAt: approveStartedAt });
        }
      }
      setApproveProgress({ label: 'Saving scan summary', detail: 'Locking in this approved menu scan.', percent: 92, startedAt: approveStartedAt });
      await addDoc(collection(db, 'menuIntelligenceScans'), {
        restaurantId: appUser.restaurantId,
        fileName: scanResult.fileName || '',
        uploadedFileName: scanResult.uploadedFileName || '',
        storagePath: scanResult.storagePath || '',
        downloadUrl: scanResult.downloadUrl || '',
        compression: scanResult.compression || null,
        menuItemCount: menuItems.length,
        dependencyCount: saved,
        menuItemsWithPrices: menuItems.filter(item => Number.parseFloat(item.price ?? item.menuPrice ?? 0) > 0).length,
        menuCostingEnabled: true,
        status: 'approved',
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: appUser.id || ''
      });
      await logAudit(appUser, 'MENU_INTELLIGENCE_APPROVED', `${menuItems.length} menu items`, `${saved} dependencies`);
      setApproveProgress({ label: 'Menu Intelligence saved', detail: `${saved} ingredient links approved.`, percent: 100, done: true, startedAt: approveStartedAt });
      addToast('Menu Intelligence Saved', `${saved} ingredient links approved.`);
      setReviewOpen(false);
      setScanResult(null);
      setFile(null);
      setTimeout(() => setApproveProgress(null), 1200);
    } catch (err) {
      setApproveProgress({ label: 'Approval stopped', detail: err.message || 'Could not approve menu links.', percent: 100, done: true, startedAt: approveStartedAt });
      addToast('Approval Failed', err.message || 'Could not approve menu links.');
      setTimeout(() => setApproveProgress(null), 2200);
    } finally {
      approvingRef.current = false;
      setApproving(false);
    }
  };

  const saveEditedScan = async () => {
    if (editSavingRef.current || !editingScan?.id) return;
    editSavingRef.current = true;
    setEditSaving(true);
    try {
      const existingDeps = await fetchScanDependencies(editingScan);
      const existingIds = new Set(existingDeps.map(dep => dep.id).filter(Boolean));
      const retainedIds = new Set();
      let savedLinks = 0;
      for (const item of editResult?.menuItems || []) {
        for (const ingredient of item.ingredients || []) {
          if (!ingredient.matchedInventoryItemId || !isIngredientApproved(ingredient)) continue;
          const inventoryItem = inventoryItems.find(inv => inv.id === ingredient.matchedInventoryItemId);
          const payload = {
            restaurantId: appUser.restaurantId,
            menuItemName: item.name || 'Menu item',
            menuCategory: item.category || '',
            menuDescription: item.description || '',
            menuItemPrice: Number.parseFloat(item.price ?? item.menuPrice ?? 0) || 0,
            menuItemPriceText: item.priceText || '',
            ingredientName: ingredient.name || inventoryItem?.name || '',
            inventoryItemId: ingredient.matchedInventoryItemId,
            inventoryItemName: inventoryItem?.name || ingredient.matchedInventoryItemName || ingredient.name || '',
            estimatedQuantity: Number.parseFloat(ingredient.estimatedQuantity ?? ingredient.quantity ?? 0) || 0,
            estimatedUnit: ingredient.estimatedUnit || ingredient.unit || '',
            portionConfidence: ingredient.portionConfidence || ingredient.confidence || 'manual_review',
            confidence: ingredient.confidence || 'manual_review',
            source: ingredient.dependencyId ? 'menu_intelligence_manual_update' : 'menu_intelligence_manual_add',
            status: 'approved',
            updatedAt: new Date().toISOString(),
            updatedBy: appUser.id || '',
            scanFileName: editResult.fileName || editingScan.fileName || '',
            scanStoragePath: editingScan.storagePath || ''
          };
          if (ingredient.dependencyId && existingIds.has(ingredient.dependencyId)) {
            await updateDoc(doc(db, 'menuDependencies', ingredient.dependencyId), payload);
            retainedIds.add(ingredient.dependencyId);
          } else {
            await addDoc(collection(db, 'menuDependencies'), {
              ...payload,
              approvedAt: new Date().toISOString(),
              approvedBy: appUser.name || appUser.email || appUser.id || ''
            });
          }
          savedLinks++;
        }
      }
      const staleRefs = existingDeps
        .filter(dep => dep.id && !retainedIds.has(dep.id))
        .map(dep => doc(db, 'menuDependencies', dep.id));
      if (staleRefs.length) await batchDeleteRefs(staleRefs);
      await updateDoc(doc(db, 'menuIntelligenceScans', editingScan.id), {
        fileName: editResult?.fileName || editingScan.fileName || '',
        menuItemCount: (editResult?.menuItems || []).length,
        dependencyCount: savedLinks,
        menuItemsWithPrices: (editResult?.menuItems || []).filter(item => Number.parseFloat(item.price ?? item.menuPrice ?? 0) > 0).length,
        menuCostingEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: appUser.id || ''
      });
      await logAudit(appUser, 'MENU_INTELLIGENCE_SCAN_EDITED', editResult?.fileName || editingScan.fileName || 'Menu scan', `${savedLinks} dependencies`);
      addToast('Menu Scan Updated', `${savedLinks} menu links saved.`);
      setEditOpen(false);
      setEditingScan(null);
      setEditResult(null);
    } catch (err) {
      addToast('Update Failed', err.message || 'Could not update menu scan.');
    } finally {
      editSavingRef.current = false;
      setEditSaving(false);
    }
  };

  const deleteMenuScan = async (scan) => {
    if (deleteBusyRef.current || !scan?.id) return;
    const knownDeps = getScanDependencies(scan);
    const expectedCount = Number(scan.dependencyCount || 0) || knownDeps.length;
    if (!window.confirm(`Delete this menu scan and ${expectedCount} linked ${expectedCount === 1 ? 'ingredient' : 'ingredients'}? This removes the approved menu-impact links for this scan.`)) return;
    deleteBusyRef.current = true;
    setDeletingScanId(scan.id);
    const deleteStartedAt = Date.now();
    setProgressTick(deleteStartedAt);
    setDeleteProgress({
      scanId: scan.id,
      label: 'Preparing fast delete',
      detail: 'Finding approved menu-impact links tied to this scan.',
      percent: 5,
      startedAt: deleteStartedAt
    });
    try {
      const deps = await fetchScanDependencies(scan);
      const refsToDelete = [
        ...deps.filter(dep => dep.id).map(dep => doc(db, 'menuDependencies', dep.id)),
        doc(db, 'menuIntelligenceScans', scan.id)
      ];
      if (refsToDelete.length === 0) {
        throw new Error('No menu scan record was found to delete.');
      }
      setDeleteProgress({
        scanId: scan.id,
        label: 'Deleting menu scan',
        detail: `Deleting 0 of ${refsToDelete.length} Firestore records in batches.`,
        percent: 10,
        startedAt: deleteStartedAt
      });
      await batchDeleteRefs(refsToDelete, (deleted, total) => {
        const pct = total ? Math.min(96, 10 + Math.round((deleted / total) * 86)) : 96;
        setDeleteProgress({
          scanId: scan.id,
          label: 'Deleting menu scan',
          detail: `Deleted ${deleted} of ${total} Firestore records.`,
          percent: pct,
          startedAt: deleteStartedAt
        });
      });
      await logAudit(appUser, 'MENU_INTELLIGENCE_SCAN_DELETED', scan.fileName || 'Menu scan', `${deps.length} dependencies removed with batched delete`);
      setDeleteProgress({
        scanId: scan.id,
        label: 'Menu scan deleted',
        detail: `${deps.length} linked ${deps.length === 1 ? 'ingredient was' : 'ingredients were'} removed.`,
        percent: 100,
        done: true,
        startedAt: deleteStartedAt
      });
      addToast('Menu Scan Deleted', `${deps.length} linked ingredients removed.`);
      setTimeout(() => setDeleteProgress(null), 1400);
    } catch (err) {
      setDeleteProgress({
        scanId: scan.id,
        label: 'Delete stopped',
        detail: err.message || 'Could not delete menu scan.',
        percent: 100,
        done: true,
        startedAt: deleteStartedAt
      });
      addToast('Delete Failed', err.message || 'Could not delete menu scan.');
      setTimeout(() => setDeleteProgress(null), 2600);
    } finally {
      deleteBusyRef.current = false;
      setDeletingScanId(null);
    }
  };

  const renderMenuEditor = (source, mode = 'scan') => {
    const costingRows = buildMenuCostBreakdowns({ menuItems: source?.menuItems || [], inventoryItems });
    return (
    <div className="space-y-4">
      {(source?.menuItems || []).length === 0 ? <SmartEmptyState title="Nothing found" desc="Add menu items and ingredient links before saving." /> : (source.menuItems || []).map((item, itemIdx) => {
        const costRow = costingRows.find(row => row.menuItemName === (item.name || item.menuItemName || 'Menu item'));
        return (
        <div key={itemIdx} className="bg-[#12161A] border border-[#2A353D] rounded-xl p-3 space-y-3">
          <div className={`grid ${mode === 'edit' ? 'sm:grid-cols-[1fr_.45fr_.28fr_auto]' : 'sm:grid-cols-[1fr_.45fr_.28fr]'} gap-2 items-center`}>
            <input value={item.name || ''} onChange={e => updateMenuItem(itemIdx, { name: e.target.value }, mode)} className={T.input} placeholder="Menu item name" />
            <input value={item.category || ''} onChange={e => updateMenuItem(itemIdx, { category: e.target.value }, mode)} className={T.input} placeholder="Category" />
            <input value={item.price ?? item.menuPrice ?? ''} onChange={e => updateMenuItem(itemIdx, { price: e.target.value }, mode)} className={T.input} placeholder="Menu price" inputMode="decimal" />
            {mode === 'edit' && <button type="button" onClick={() => removeEditMenuItem(itemIdx)} disabled={editSaving} className="p-3 rounded-xl border border-red-900/50 text-red-300 bg-red-900/10 disabled:opacity-50"><Trash2 size={16}/></button>}
          </div>
          <textarea value={item.description || ''} onChange={e => updateMenuItem(itemIdx, { description: e.target.value }, mode)} className={T.input} rows={2} placeholder="Description" />
          {costRow && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-[#2A353D] bg-[#0B0E11] p-2 text-center">
            <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Item Cost</div><div className="font-black text-white">${Number(costRow.totalCost || 0).toFixed(2)}</div></div>
            <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Food Cost</div><div className={costRow.foodCostPct > 38 ? 'font-black text-red-300' : 'font-black text-emerald-300'}>{costRow.foodCostPct ? `${costRow.foodCostPct.toFixed(1)}%` : 'Need price'}</div></div>
            <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Profit</div><div className="font-black text-[#D4A381]">${Number(costRow.grossProfit || 0).toFixed(2)}</div></div>
            <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Confidence</div><div className="font-black text-white">{costRow.confidenceLabel}</div></div>
          </div>}
          <div className="space-y-2">
            {(item.ingredients || []).map((ingredient, ingIdx) => (
              <div key={`${ingredient.dependencyId || 'new'}-${ingIdx}`} className={`grid sm:grid-cols-[1fr_1fr_.34fr_.32fr_.85fr_auto] gap-2 items-center ${!isIngredientApproved(ingredient) ? 'opacity-60' : ''}`}>
                <input value={ingredient.name || ''} onChange={e => updateIngredient(itemIdx, ingIdx, { name: e.target.value }, mode)} className={T.input} placeholder="Ingredient" />
                <select value={ingredient.matchedInventoryItemId || ''} onChange={e => updateIngredient(itemIdx, ingIdx, { matchedInventoryItemId: e.target.value, reviewStatus: e.target.value ? 'approved' : 'needs-match' }, mode)} className={T.input}>
                  <option value="">No inventory match</option>
                  {inventoryItems.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                </select>
                <input value={ingredient.estimatedQuantity ?? ''} onChange={e => updateIngredient(itemIdx, ingIdx, { estimatedQuantity: e.target.value }, mode)} className={T.input} placeholder="Qty" inputMode="decimal" />
                <input value={ingredient.estimatedUnit || ''} onChange={e => updateIngredient(itemIdx, ingIdx, { estimatedUnit: e.target.value }, mode)} className={T.input} placeholder="Unit" />
                <div className="flex items-center gap-2">
                  <span className={`flex-1 text-center px-2 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest ${confidenceClass(ingredient.confidence || item.confidence)}`}>Conf {confidenceLabel(ingredient.confidence || item.confidence)}</span>
                  <button type="button" onClick={() => updateIngredient(itemIdx, ingIdx, { reviewStatus: isIngredientApproved(ingredient) ? 'rejected' : (ingredient.matchedInventoryItemId ? 'approved' : 'needs-match'), approved: !isIngredientApproved(ingredient) }, mode)} disabled={approving || editSaving} className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest disabled:opacity-50 ${isIngredientApproved(ingredient) ? 'border-emerald-900/50 text-emerald-300 bg-emerald-900/20' : 'border-red-900/50 text-red-300 bg-red-900/20'}`}>{isIngredientApproved(ingredient) ? 'Approve' : 'Skip'}</button>
                </div>
                <button type="button" onClick={() => removeIngredient(itemIdx, ingIdx, mode)} disabled={approving || editSaving} className="p-3 rounded-xl border border-red-900/50 text-red-300 bg-red-900/10 disabled:opacity-50"><X size={16}/></button>
              </div>
            ))}
            <button type="button" onClick={() => addIngredientToItem(itemIdx, mode)} disabled={approving || editSaving} className={`${T.btnAlt} disabled:opacity-50`}>Add Ingredient</button>
          </div>
        </div>
      );})}
    </div>
    );
  };

  const menuUsageSummary = normalizeAiUsage(menuAiUsage, 'menu');
  const menuUsageWarning = aiPageLimitMessage('menu', menuAiUsage);

  return (
    <div className="intelligence-desktop max-w-7xl mx-auto space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A353D] pb-3">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-white"><Sparkles size={24} className={T.copper}/> Menu Intelligence</h2>
          <p className="text-xs text-slate-400 font-bold mt-1">Upload a menu, review AI ingredient links, and let 86 alerts show menu impact.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_.9fr] gap-4">
        <div className={`${T.card} p-4 space-y-4`}>
          <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-black text-white">Menu AI pages: {menuUsageSummary.used} / {menuUsageSummary.limit} quota · {menuUsageSummary.processed} actually processed this month</div>
              <button type="button" onClick={loadMenuAiUsage} disabled={menuAiUsageLoading} className="text-[9px] font-black uppercase tracking-widest text-[#D4A381] disabled:opacity-50">{menuAiUsageLoading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
            {menuAiExempt && <div className="mt-1 text-[10px] font-bold text-blue-300">Testing bypass active. Processed pages are logged separately and do not consume the customer quota.</div>}
            {!menuAiExempt && menuUsageWarning && <div className={`mt-1 text-[10px] font-bold ${menuUsageSummary.reached ? 'text-red-300' : 'text-amber-300'}`}>{menuUsageWarning}</div>}
          </div>
          <div className="border border-dashed border-[#2A353D] rounded-xl p-5 text-center bg-[#12161A]">
            <Upload className="mx-auto text-[#D4A381] mb-3" size={30}/>
            <label className={`${T.btnAlt} inline-flex items-center gap-2 cursor-pointer ${(busy || (!menuAiExempt && menuUsageSummary.reached)) ? 'opacity-50 pointer-events-none' : ''}`}>
              Choose Menu Image or PDF
              <input type="file" accept="image/*,application/pdf" disabled={busy || (!menuAiExempt && menuUsageSummary.reached)} onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
            <div className="text-xs font-bold text-slate-400 mt-3">{file ? file.name : 'No file selected'}</div>
          </div>
          {scanProgress && <WorkProgressBar label={scanProgress.label} detail={scanProgress.detail} percent={displayedPercent(scanProgress, busy ? 96 : 100)} elapsedSeconds={progressElapsed(scanProgress)} />}
          <button onClick={scanMenu} disabled={busy || !file || (!menuAiExempt && menuUsageSummary.reached)} className={`${T.btn} w-full flex items-center justify-center gap-2 disabled:opacity-50`}>{busy ? <Upload size={18}/> : <Sparkles size={18}/>} {busy ? 'Scanning Menu' : 'Scan Menu'}</button>
          {!menuAiExempt && menuUsageSummary.reached && <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-[11px] font-bold text-red-200">This restaurant has used all menu AI pages for this month.</div>}
          <div className="text-[10px] text-slate-500 font-bold leading-snug">AI results are not saved until you approve them. Regular staff cannot browse uploaded menu records unless the owner grants access.</div>
        </div>

        <div className={`${T.card} overflow-hidden`}>
          <div className={T.th}>Current Menu Impacts</div>
          {impacts.length === 0 ? <div className="p-6 text-center text-xs text-slate-500 font-bold">No zero-stock menu impacts found yet.</div> : impacts.slice(0, 10).map(row => (
            <div key={row.item.id} className={`${T.row}`}>
              <div className="font-black text-white text-sm flex items-center gap-2"><Package size={14} className="text-red-300"/> {row.item.name}</div>
              <div className="text-[10px] text-red-200 font-bold mt-1">Impacts: {row.impacts.map(i => i.name).join(', ')}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${T.card} overflow-hidden`}>
        <div className={`${T.th} flex items-center justify-between gap-3`}><span>Menu Cost Breakdown</span><span className="text-[9px] font-black uppercase tracking-widest text-[#D4A381]">{approvedMenuCostSummary.pricedCount} priced</span></div>
        {approvedMenuCostRows.length === 0 ? <div className="p-6 text-center text-xs text-slate-500 font-bold">Upload a menu, approve AI inventory matches, and add/confirm portions to see cost by menu item.</div> : (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Items</div><div className="font-black text-white">{approvedMenuCostSummary.menuItemCount}</div></div>
              <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Avg Food Cost</div><div className="font-black text-[#D4A381]">{approvedMenuCostSummary.averageFoodCostPct ? `${approvedMenuCostSummary.averageFoodCostPct.toFixed(1)}%` : 'Need prices'}</div></div>
              <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Needs Review</div><div className="font-black text-amber-300">{approvedMenuCostSummary.needsReviewCount}</div></div>
              <div className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3 text-center"><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Missing Costs</div><div className="font-black text-red-300">{approvedMenuCostSummary.missingCostCount}</div></div>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {approvedMenuCostRows.slice(0, 14).map(row => (
                <div key={`${row.menuItemName}-${row.category}`} className="rounded-xl border border-[#2A353D] bg-[#12161A] p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0"><div className="font-black text-white truncate">{row.menuItemName}</div><div className="text-[10px] text-slate-500 font-bold mt-1">{row.ingredients.length} linked ingredient{row.ingredients.length === 1 ? '' : 's'} • confidence {row.confidenceLabel}</div></div>
                    <div className="grid grid-cols-3 gap-2 text-center shrink-0">
                      <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Cost</div><div className="font-black text-white">${Number(row.totalCost || 0).toFixed(2)}</div></div>
                      <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Price</div><div className="font-black text-[#D4A381]">{row.menuPrice ? `$${row.menuPrice.toFixed(2)}` : 'Missing'}</div></div>
                      <div><div className="text-[8px] uppercase tracking-widest text-slate-500 font-black">Food</div><div className={row.foodCostPct > 38 ? 'font-black text-red-300' : 'font-black text-emerald-300'}>{row.foodCostPct ? `${row.foodCostPct.toFixed(1)}%` : '—'}</div></div>
                    </div>
                  </div>
                  {(row.missingIngredients.length > 0 || row.estimatedIngredients.length > 0) && <div className="mt-2 text-[10px] font-bold text-amber-200">Review: {row.missingIngredients.length ? `${row.missingIngredients.length} missing inventory/cost match` : ''}{row.missingIngredients.length && row.estimatedIngredients.length ? ' • ' : ''}{row.estimatedIngredients.length ? `${row.estimatedIngredients.length} estimated portion${row.estimatedIngredients.length === 1 ? '' : 's'}` : ''}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`${T.card} overflow-hidden`}>
        <div className={T.th}>Recent Menu Scans</div>
        {scans.length === 0 ? <div className="p-6 text-center text-xs text-slate-500 font-bold">No approved menu scans yet.</div> : scans.slice(0, 12).map(scan => {
          const isDeletingThisScan = deletingScanId === scan.id || deleteProgress?.scanId === scan.id;
          return (
          <div key={scan.id} className={`${T.row} space-y-3 ${isDeletingThisScan ? 'opacity-80' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0"><div className="font-black text-white text-sm truncate">{scan.fileName || 'Menu scan'}</div><div className="text-[10px] text-slate-500 font-bold mt-1">{scan.menuItemCount || 0} menu items, {scan.dependencyCount || 0} links</div></div>
              <div className="flex items-center gap-2 justify-end">
                <div className="text-[10px] text-[#D4A381] font-black uppercase tracking-widest">{isDeletingThisScan ? 'deleting' : (scan.status || 'saved')}</div>
                <button type="button" onClick={() => openEditScan(scan)} disabled={isDeletingThisScan || editSaving || !!deletingScanId} className="p-2 rounded-lg bg-[#12161A] text-slate-300 border border-[#2A353D] disabled:opacity-50" title="Edit menu scan"><Edit3 size={15}/></button>
                <button type="button" onClick={() => deleteMenuScan(scan)} disabled={isDeletingThisScan || !!deletingScanId} className="p-2 rounded-lg bg-red-900/20 text-red-300 border border-red-900/50 disabled:opacity-50" title="Delete menu scan"><Trash2 size={15}/></button>
              </div>
            </div>
            {isDeletingThisScan && deleteProgress && <WorkProgressBar label={deleteProgress.label} detail={deleteProgress.detail} percent={displayedPercent(deleteProgress, deleteProgress.done ? 100 : 98)} elapsedSeconds={progressElapsed(deleteProgress)} />}
          </div>
        );})}
      </div>

      <Modal isOpen={reviewOpen} onClose={() => { if (!approving) setReviewOpen(false); }} title="Review Menu Intelligence" sizeClass="max-w-5xl">
        <div className="space-y-4">
          {approveProgress && <WorkProgressBar label={approveProgress.label} detail={approveProgress.detail} percent={displayedPercent(approveProgress, approving ? 99 : 100)} elapsedSeconds={progressElapsed(approveProgress)} />}
          <div className="bg-blue-900/10 border border-blue-900/40 rounded-xl p-3 text-xs font-bold text-blue-100">Each ingredient now has a confidence badge and an Approve/Skip toggle. Skipped rows are not saved into Menu Impact links.</div>
          {renderMenuEditor(scanResult, 'scan')}
          <button onClick={approveMenu} disabled={approving} className={`${T.btn} w-full flex items-center justify-center gap-2 disabled:opacity-50`}><Check size={18}/> {approving ? 'Approving Reviewed Menu Links' : 'Approve Reviewed Menu Links'}</button>
        </div>
      </Modal>

      <Modal isOpen={editOpen} onClose={() => { if (!editSaving) setEditOpen(false); }} title="Edit Menu Scan" sizeClass="max-w-5xl">
        <div className="space-y-4">
          <div>
            <label className={T.label}>Menu scan name</label>
            <input value={editResult?.fileName || ''} onChange={e => setEditResult({ ...(editResult || {}), fileName: e.target.value })} disabled={editSaving} className={T.input} placeholder="Menu scan name" />
          </div>
          {renderMenuEditor(editResult, 'edit')}
          <button type="button" onClick={addMenuItemToEdit} disabled={editSaving} className={`${T.btnAlt} disabled:opacity-50`}>Add Menu Item</button>
          <button onClick={saveEditedScan} disabled={editSaving} className={`${T.btn} w-full flex items-center justify-center gap-2 disabled:opacity-50`}>{editSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} {editSaving ? 'Saving Menu Scan' : 'Save Menu Scan Changes'}</button>
          <div className="text-[10px] text-slate-500 font-bold leading-snug">Deleting or removing a match here removes that approved menu-impact link. The original uploaded file stays in secure storage.</div>
        </div>
      </Modal>
    </div>
  );
};


const TabAITools = ({ appUser, clientData, setActiveTab, setInventorySubTabTarget, addToast }) => {
  const planAccess = usePlanAccess(appUser, clientData);
  const canMenu = canUseMenuIntelligence(appUser, clientData);
  const canAiOrder = planAccess.canUse(FEATURE_KEYS.AI_ORDER_ASSISTANT).allowed;
  const aiLockedText = 'AI assisted ordering and Python intelligence start with Smart Kitchen.';
  const cards = [
    {
      title: 'Menu Intelligence',
      tag: canMenu ? 'Ready' : 'Owner-controlled',
      desc: 'Upload a menu, review AI ingredient matches, and power 86 Menu Impact Alerts.',
      action: 'Open Menu Intelligence',
      tab: 'menu-intelligence',
      enabled: canMenu,
      note: 'Best for owners/managers after inventory names are cleaned up.'
    },
    {
      title: 'AI Order Assistant',
      tag: canAiOrder ? 'Smart Kitchen' : 'Smart Kitchen+',
      desc: 'Build manager-reviewed order drafts, event supply plans, prep predictions, and Python forecasts. Python Ops Scan now lives in Manager Brief.',
      action: 'Open AI Order Assistant',
      tab: 'inventory',
      subTab: 'ai-order',
      enabled: canAiOrder,
      lockedMessage: aiLockedText,
      note: 'AI and Python only suggest, report, and draft. Managers still approve, edit, and send vendor orders.'
    },
    {
      title: 'Invoice Scanner',
      tag: 'Inventory',
      desc: 'Scan vendor invoices from Inventory, review raw extraction details, and approve stock changes.',
      action: 'Open Invoice Scanner',
      tab: 'inventory',
      subTab: 'invoices',
      enabled: true,
      note: 'Always review scanned rows before approving. Blurry invoices still need human eyeballs.'
    },
    {
      title: 'Voice Commands',
      tag: 'Beta',
      desc: 'Use the microphone dock to navigate, add prep, search Help Center, and trigger kitchen actions.',
      action: 'Open Help Article',
      tab: 'help',
      enabled: true,
      note: 'Voice obeys the same permissions as tapping through the app.'
    },
    {
      title: 'Smart Prep Matching',
      tag: 'Kitchen',
      desc: 'Recognizes matching prep items by name, quantity, unit, station, and date so new prep requests update the right row instead of creating duplicate work.',
      action: 'Open Prep',
      tab: 'prep',
      enabled: true,
      note: 'Use clear item names and quantities: “prep 2 pans onions.”'
    }
  ];
  return (
    <div className="intelligence-desktop max-w-7xl mx-auto space-y-4 pb-24">
      <div className="cockpit-panel cockpit-grid rounded-2xl p-5 border border-[#2A353D]">
        <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381]">Dedicated AI Tools</div>
        <h2 className="text-2xl font-black text-white mt-1 flex items-center gap-2"><Sparkles size={24}/> AI Tools</h2>
        <p className="text-sm text-slate-400 font-bold mt-2 max-w-3xl">One landing pad for the app’s AI-powered kitchen tools. Results should still be reviewed by a manager before they change real restaurant data.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map(card => (
          <div key={card.title} className={`${T.card} p-4 space-y-3 ${card.enabled ? '' : 'opacity-80'}`}>
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-black text-white text-lg">{card.title}</h3><p className="text-xs font-bold text-slate-400 mt-1 leading-relaxed">{card.desc}</p></div>
              <span className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${card.enabled ? 'bg-emerald-900/20 text-emerald-300 border-emerald-900/50' : 'bg-amber-900/20 text-amber-300 border-amber-900/50'}`}>{card.tag}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 leading-snug">{card.note}</p>
            <button type="button" onClick={() => { if (!card.enabled) return addToast?.('Access Needed', card.lockedMessage || 'Ask the account owner to enable this tool first.'); if (card.tab === 'inventory' && card.subTab) setInventorySubTabTarget?.(card.subTab); setActiveTab(card.tab); }} className={card.enabled ? T.btn : T.btnAlt}>{card.action}</button>
          </div>
        ))}
      </div>
      <div className={`${T.card} p-4 border-blue-900/40`}>
        <h3 className="font-black text-blue-200">AI safety rule</h3>
        <p className="text-xs text-slate-400 font-bold mt-1 leading-relaxed">AI can read, suggest, and match. Humans still approve anything that affects stock, prep, menu availability, reminders, or customer-facing paperwork.</p>
      </div>
    </div>
  );
};

export { TabPersonalReminders, TabMenuIntelligence, TabAITools };

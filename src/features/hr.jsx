import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck
} from 'lucide-react';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getBlob, ref, uploadBytesResumable } from 'firebase/storage';
import {
  T,
  auth,
  db,
  storage,
  isWorkspaceManager,
  safeWrite,
  useLiveCollection
} from '../core/appCore';
import { FriendlyEmpty, Modal } from '../components/common';

const MANUAL_STORAGE_MAX_BYTES = 15 * 1024 * 1024;
const MANUAL_ORIGINAL_MAX_BYTES = 50 * 1024 * 1024;
const MANUAL_MAX_BYTES = MANUAL_STORAGE_MAX_BYTES;
const MANUAL_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);
const DEFAULT_ONBOARDING_TASKS = [
  'Review the employee handbook and workplace policies',
  'Complete food safety and sanitation orientation',
  'Review emergency, injury, and incident procedures',
  'Complete position and station orientation',
  'Review scheduling, attendance, and time-clock expectations',
  'Meet the manager and assigned trainer',
  'Complete the first-shift check-in'
];
const TABS = [
  ['overview', 'Overview'],
  ['manuals', 'Training Manuals'],
  ['onboarding', 'Onboarding'],
  ['certifications', 'Certifications'],
  ['performance', 'Performance Notes']
];

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const safeFileName = (name = 'manual') => String(name).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120);

const mbLabel = (bytes = 0) => `${Math.max(0.01, Number(bytes || 0) / 1048576).toFixed(2)} MB`;
const supportsGzipCompression = () => typeof window !== 'undefined' && typeof window.CompressionStream === 'function';
const supportsGzipDecompression = () => typeof window !== 'undefined' && typeof window.DecompressionStream === 'function';
const gzipBlob = async (blob) => {
  if (!supportsGzipCompression()) throw new Error('This browser cannot compress large manuals. Use Chrome or Edge, or export the file as a smaller PDF.');
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
};
const gunzipBlob = async (blob, contentType = 'application/octet-stream') => {
  if (!supportsGzipDecompression()) return null;
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressed = await new Response(stream).blob();
  return new Blob([decompressed], { type: contentType || 'application/octet-stream' });
};
const prepareTrainingManualUpload = async (file) => {
  if (!file) throw new Error('Choose a training manual file.');
  if (file.size <= 0) throw new Error('The selected training manual is empty.');
  if (file.size > MANUAL_ORIGINAL_MAX_BYTES) throw new Error('Training manuals can be up to 50 MB before compression. Split the file or reduce image quality.');
  if (file.size <= MANUAL_STORAGE_MAX_BYTES) {
    return {
      blob: file,
      compressed: false,
      compression: '',
      uploadName: safeFileName(file.name),
      uploadSize: file.size,
      contentType: file.type,
      originalContentType: file.type
    };
  }
  const compressedBlob = await gzipBlob(file);
  if (compressedBlob.size > MANUAL_STORAGE_MAX_BYTES) {
    throw new Error(`Compressed manual is still ${mbLabel(compressedBlob.size)}. Reduce image quality or split the manual so the stored file is under 15 MB.`);
  }
  return {
    blob: compressedBlob,
    compressed: true,
    compression: 'gzip',
    uploadName: `${safeFileName(file.name)}.gz`,
    uploadSize: compressedBlob.size,
    contentType: 'application/gzip',
    originalContentType: file.type
  };
};

const prettyDate = (value) => {
  if (!value) return 'Not set';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const currentUid = (appUser) => auth.currentUser?.uid || appUser?.uid || appUser?.id || '';
const employeeAuthUid = (user = {}) => user.authUid || user.uid || user.id || '';
const canManageHr = (appUser = {}) => Boolean(
  isWorkspaceManager(appUser) || appUser?.permissions?.hr === true
);
const sortNewest = (rows = []) => [...rows].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

const SectionHeader = ({ eyebrow, title, text, action }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D4A381]">{eyebrow}</div>
      <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-300">{text}</p>
    </div>
    {action}
  </div>
);

const StatusPill = ({ children, tone = 'blue' }) => {
  const tones = {
    blue: 'border-blue-400/25 bg-blue-500/10 text-blue-200',
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    amber: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
    slate: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
    red: 'border-red-400/25 bg-red-500/10 text-red-200'
  };
  return <span className={`inline-flex min-h-[26px] items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.blue}`}>{children}</span>;
};

const MetricCard = ({ icon, label, value, detail }) => (
  <div className={`${T.card} min-h-[132px] p-4`}>
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-xl border border-[#D4A381]/25 bg-[#D4A381]/10 p-2 text-[#E6BB9F]">{icon}</span>
      <strong className="text-3xl font-black text-white">{value}</strong>
    </div>
    <div className="mt-3 text-sm font-black text-white">{label}</div>
    <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">{detail}</div>
  </div>
);

const Empty = ({ title, text }) => <FriendlyEmpty title={title} text={text} />;

const ManualUploadModal = ({ open, onClose, appUser, manuals, addToast }) => {
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0');
  const [category, setCategory] = useState('General Training');
  const [description, setDescription] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [required, setRequired] = useState(true);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setTitle('');
    setVersion('1.0');
    setCategory('General Training');
    setDescription('');
    setEffectiveDate(todayIso());
    setRequired(true);
    setFile(null);
    setProgress(0);
  };
  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !version.trim() || !file) {
      addToast?.('Missing Information', 'Add a title, version, and training manual file.');
      return;
    }
    if (!MANUAL_TYPES.has(file.type)) {
      addToast?.('File Not Accepted', 'Use a PDF, Word document, DOCX file, or plain-text file.');
      return;
    }
    if (file.size <= 0 || file.size > MANUAL_ORIGINAL_MAX_BYTES) {
      addToast?.('File Too Large', 'Training manuals can be up to 50 MB before compression. Split the file or reduce image quality.');
      return;
    }
    setSaving(true);
    let manualId = '';
    let storagePath = '';
    try {
      const prepared = await prepareTrainingManualUpload(file);
      const manualRef = doc(collection(db, 'trainingManuals'));
      manualId = manualRef.id;
      storagePath = `${appUser.restaurantId}/hrTrainingManuals/${manualId}/${prepared.uploadName}`;
      await safeWrite({
        user: appUser,
        action: 'set',
        collectionName: 'trainingManuals',
        docId: manualId,
        label: 'Create secure training manual record',
        data: {
          title: title.trim(),
          version: version.trim(),
          category,
          description: description.trim(),
          effectiveDate,
          required,
          status: 'Uploading',
          fileName: file.name,
          fileType: file.type,
          fileSize: prepared.uploadSize,
          originalFileSize: file.size,
          compressed: prepared.compressed,
          compression: prepared.compression,
          storedFileName: prepared.uploadName,
          storedFileType: prepared.contentType,
          storagePath,
          uploadedById: currentUid(appUser),
          uploadedByName: appUser.name || appUser.email || 'Manager',
          createdAt: nowIso()
        }
      });

      const uploadRef = ref(storage, storagePath);
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(uploadRef, prepared.blob, {
          contentType: prepared.contentType,
          customMetadata: {
            purpose: 'hr-training-manual',
            restaurantId: appUser.restaurantId,
            manualId,
            originalFileName: file.name,
            originalContentType: prepared.originalContentType,
            compression: prepared.compression,
            compressed: prepared.compression
          }
        });
        task.on('state_changed', snapshot => {
          setProgress(Math.round((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100));
        }, reject, resolve);
      });

      await safeWrite({
        user: appUser,
        action: 'update',
        collectionName: 'trainingManuals',
        docId: manualId,
        label: `Publish ${title.trim()} version ${version.trim()}`,
        data: { status: 'Published', publishedAt: nowIso() }
      });
      const sameTitle = manuals.filter(item => item.id !== manualId && item.status === 'Published' && String(item.title || '').trim().toLowerCase() === title.trim().toLowerCase());
      let archiveFailures = 0;
      for (const prior of sameTitle) {
        try {
          await safeWrite({
            user: appUser,
            action: 'update',
            collectionName: 'trainingManuals',
            docId: prior.id,
            before: prior,
            label: `Archive ${prior.title} version ${prior.version}`,
            data: { status: 'Archived', archivedAt: nowIso(), supersededById: manualId }
          });
        } catch (archiveError) {
          archiveFailures += 1;
          console.error('A prior training-manual version could not be archived after the new version was published:', archiveError);
        }
      }
      addToast?.('Manual Published', `${title.trim()} version ${version.trim()} is available to the team.${file.size > MANUAL_STORAGE_MAX_BYTES ? ` Large file compressed from ${mbLabel(file.size)} before secure storage.` : ''}${archiveFailures ? ` ${archiveFailures} older version(s) still need archival review.` : ''}`);
      reset();
      onClose();
    } catch (error) {
      if (storagePath) {
        try { await deleteObject(ref(storage, storagePath)); } catch (_) { /* best-effort cleanup */ }
      }
      if (manualId) {
        try { await safeWrite({ user: appUser, action: 'delete', collectionName: 'trainingManuals', docId: manualId, label: 'Clean up failed manual upload' }); } catch (_) { /* keep original error */ }
      }
      addToast?.('Upload Failed', error?.message || 'The training manual could not be uploaded.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={close} title="Publish a Training Manual" sizeClass="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm font-semibold leading-5 text-emerald-100">
          This upload does not use AI. The original document is stored securely and published exactly as provided.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={T.label}>Manual title</span><input className={T.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Example: Kitchen Safety Manual" maxLength={120} /></label>
          <label><span className={T.label}>Version</span><input className={T.input} value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0" maxLength={24} /></label>
          <label><span className={T.label}>Category</span><select className={T.input} value={category} onChange={e => setCategory(e.target.value)}><option>General Training</option><option>Food Safety</option><option>Kitchen Operations</option><option>Front of House</option><option>Workplace Safety</option><option>Human Resources</option><option>Management</option></select></label>
          <label><span className={T.label}>Effective date</span><input type="date" className={T.input} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></label>
          <label className="flex min-h-[44px] items-end gap-2 pb-2 text-sm font-bold text-slate-200"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="h-5 w-5 accent-[#D4A381]" /> Required training</label>
          <label className="sm:col-span-2"><span className={T.label}>Plain-language summary</span><textarea className={`${T.input} min-h-[88px]`} value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain what employees will learn and who should read it." maxLength={600} /></label>
        </div>
        <label className="block cursor-pointer rounded-2xl border border-dashed border-[#D4A381]/45 bg-[#D4A381]/5 p-5 text-center transition hover:bg-[#D4A381]/10">
          <Upload className="mx-auto text-[#E6BB9F]" size={28} />
          <div className="mt-2 text-sm font-black text-white">{file ? `${file.name} • ${mbLabel(file.size)}` : 'Choose a PDF, Word document, DOCX, or text file'}</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">Files up to 50 MB are compressed into the 15 MB secure storage envelope. No AI processing.</div>
          <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
        {saving && <div><div className="mb-1 flex justify-between text-xs font-bold text-slate-300"><span>Secure upload</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#12161A]"><div className="h-full bg-[#D4A381] transition-all" style={{ width: `${progress}%` }} /></div></div>}
        <div className="flex justify-end gap-2"><button type="button" className={T.btnAlt} onClick={close} disabled={saving}>Cancel</button><button className={T.btn} disabled={saving}>{saving ? `Uploading ${progress}%` : 'Publish Manual'}</button></div>
      </form>
    </Modal>
  );
};

const AddOnboardingModal = ({ open, onClose, appUser, users, addToast }) => {
  const [userId, setUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tasksText, setTasksText] = useState(DEFAULT_ONBOARDING_TASKS.join('\n'));
  const [saving, setSaving] = useState(false);
  const eligibleUsers = users.filter(user => employeeAuthUid(user) && employeeAuthUid(user) !== 'unknown');
  const submit = async (event) => {
    event.preventDefault();
    const employee = eligibleUsers.find(user => employeeAuthUid(user) === userId);
    const taskNames = tasksText.split('\n').map(item => item.trim()).filter(Boolean).slice(0, 30);
    if (!employee || !taskNames.length) {
      addToast?.('Missing Information', 'Choose an employee and include at least one onboarding task.');
      return;
    }
    setSaving(true);
    try {
      for (const title of taskNames) {
        await safeWrite({
          user: appUser,
          action: 'add',
          collectionName: 'hrOnboardingTasks',
          label: `Assign onboarding task to ${employee.name || employee.email}`,
          data: {
            userId,
            employeeName: employee.name || employee.email || 'Employee',
            title,
            dueDate: dueDate || '',
            completed: false,
            assignedById: currentUid(appUser),
            assignedByName: appUser.name || appUser.email || 'Manager',
            createdAt: nowIso()
          }
        });
      }
      addToast?.('Onboarding Assigned', `${taskNames.length} task${taskNames.length === 1 ? '' : 's'} assigned to ${employee.name || employee.email}.`);
      setUserId('');
      setDueDate('');
      setTasksText(DEFAULT_ONBOARDING_TASKS.join('\n'));
      onClose();
    } catch (error) {
      addToast?.('Assignment Failed', error?.message || 'Onboarding tasks could not be assigned.');
    } finally { setSaving(false); }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Assign Onboarding Checklist" sizeClass="max-w-4xl">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={T.label}>Employee</span><select className={T.input} value={userId} onChange={e => setUserId(e.target.value)}><option value="">Select employee</option>{eligibleUsers.map(user => <option key={employeeAuthUid(user)} value={employeeAuthUid(user)}>{user.name || user.email || employeeAuthUid(user)}</option>)}</select></label>
          <label><span className={T.label}>Target completion date</span><input className={T.input} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
        </div>
        <label><span className={T.label}>Checklist — one task per line</span><textarea className={`${T.input} min-h-[360px] text-base leading-7`} rows={14} value={tasksText} onChange={e => setTasksText(e.target.value)} /></label>
        <div className="flex justify-end gap-2"><button type="button" className={T.btnAlt} onClick={onClose}>Cancel</button><button className={T.btn} disabled={saving}>{saving ? 'Assigning…' : 'Assign Checklist'}</button></div>
      </form>
    </Modal>
  );
};

const AddCertificationModal = ({ open, onClose, appUser, users, addToast }) => {
  const [form, setForm] = useState({ userId: '', name: '', issuer: '', issuedDate: '', expiresDate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const eligibleUsers = users.filter(user => employeeAuthUid(user));
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const employee = eligibleUsers.find(user => employeeAuthUid(user) === form.userId);
    if (!employee || !form.name.trim()) {
      addToast?.('Missing Information', 'Choose an employee and enter the certification name.');
      return;
    }
    setSaving(true);
    try {
      await safeWrite({ user: appUser, action: 'add', collectionName: 'hrCertifications', label: `Add ${form.name.trim()} certification`, data: { ...form, name: form.name.trim(), issuer: form.issuer.trim(), notes: form.notes.trim(), employeeName: employee.name || employee.email || 'Employee', createdAt: nowIso(), createdById: currentUid(appUser) } });
      addToast?.('Certification Added', `${form.name.trim()} was added for ${employee.name || employee.email}.`);
      setForm({ userId: '', name: '', issuer: '', issuedDate: '', expiresDate: '', notes: '' });
      onClose();
    } catch (error) { addToast?.('Save Failed', error?.message || 'The certification could not be saved.'); }
    finally { setSaving(false); }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Add Certification" sizeClass="max-w-2xl">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={T.label}>Employee</span><select className={T.input} value={form.userId} onChange={e => change('userId', e.target.value)}><option value="">Select employee</option>{eligibleUsers.map(user => <option key={employeeAuthUid(user)} value={employeeAuthUid(user)}>{user.name || user.email || employeeAuthUid(user)}</option>)}</select></label>
          <label><span className={T.label}>Certification</span><input className={T.input} value={form.name} onChange={e => change('name', e.target.value)} placeholder="ServSafe Food Handler" maxLength={120} /></label>
          <label><span className={T.label}>Issuer</span><input className={T.input} value={form.issuer} onChange={e => change('issuer', e.target.value)} placeholder="Issuing organization" maxLength={120} /></label>
          <label><span className={T.label}>Issued date</span><input className={T.input} type="date" value={form.issuedDate} onChange={e => change('issuedDate', e.target.value)} /></label>
          <label><span className={T.label}>Expiration date</span><input className={T.input} type="date" value={form.expiresDate} onChange={e => change('expiresDate', e.target.value)} /></label>
          <label className="sm:col-span-2"><span className={T.label}>Administrative note</span><textarea className={`${T.input} min-h-[80px]`} value={form.notes} onChange={e => change('notes', e.target.value)} maxLength={500} /></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className={T.btnAlt} onClick={onClose}>Cancel</button><button className={T.btn} disabled={saving}>{saving ? 'Saving…' : 'Add Certification'}</button></div>
      </form>
    </Modal>
  );
};

const AddPerformanceNoteModal = ({ open, onClose, appUser, users, addToast }) => {
  const [form, setForm] = useState({ userId: '', type: 'Coaching', date: todayIso(), confidentialSummary: '', nextSteps: '' });
  const [saving, setSaving] = useState(false);
  const eligibleUsers = users.filter(user => employeeAuthUid(user));
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const employee = eligibleUsers.find(user => employeeAuthUid(user) === form.userId);
    if (!employee || !form.confidentialSummary.trim()) {
      addToast?.('Missing Information', 'Choose an employee and enter the confidential note.');
      return;
    }
    setSaving(true);
    try {
      await safeWrite({ user: appUser, action: 'add', collectionName: 'hrPerformanceNotes', label: `Add confidential ${form.type.toLowerCase()} note`, data: { ...form, confidentialSummary: form.confidentialSummary.trim(), nextSteps: form.nextSteps.trim(), employeeName: employee.name || employee.email || 'Employee', confidential: true, createdAt: nowIso(), createdById: currentUid(appUser), createdByName: appUser.name || appUser.email || 'Manager' } });
      addToast?.('Confidential Note Saved', 'The note is visible only to authorized HR managers.');
      setForm({ userId: '', type: 'Coaching', date: todayIso(), confidentialSummary: '', nextSteps: '' });
      onClose();
    } catch (error) { addToast?.('Save Failed', error?.message || 'The confidential note could not be saved.'); }
    finally { setSaving(false); }
  };
  return (
    <Modal isOpen={open} onClose={onClose} title="Add Confidential Performance Note" sizeClass="max-w-2xl">
      <form className="space-y-4" onSubmit={submit}>
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm font-semibold leading-5 text-amber-100"><LockKeyhole size={17} className="mr-2 inline" />Employees cannot view this section or its records. Keep notes factual, job-related, and appropriate for an employment record.</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={T.label}>Employee</span><select className={T.input} value={form.userId} onChange={e => change('userId', e.target.value)}><option value="">Select employee</option>{eligibleUsers.map(user => <option key={employeeAuthUid(user)} value={employeeAuthUid(user)}>{user.name || user.email || employeeAuthUid(user)}</option>)}</select></label>
          <label><span className={T.label}>Record type</span><select className={T.input} value={form.type} onChange={e => change('type', e.target.value)}><option>Coaching</option><option>Recognition</option><option>Performance Review</option><option>Attendance</option><option>Corrective Action</option><option>Manager Follow-up</option></select></label>
          <label><span className={T.label}>Date</span><input className={T.input} type="date" value={form.date} onChange={e => change('date', e.target.value)} /></label>
          <label className="sm:col-span-2"><span className={T.label}>Factual summary</span><textarea className={`${T.input} min-h-[130px]`} value={form.confidentialSummary} onChange={e => change('confidentialSummary', e.target.value)} maxLength={3000} placeholder="Document what occurred, when, where, and the business impact. Avoid assumptions." /></label>
          <label className="sm:col-span-2"><span className={T.label}>Next steps and follow-up</span><textarea className={`${T.input} min-h-[90px]`} value={form.nextSteps} onChange={e => change('nextSteps', e.target.value)} maxLength={1600} /></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className={T.btnAlt} onClick={onClose}>Cancel</button><button className={T.btn} disabled={saving}>{saving ? 'Saving…' : 'Save Confidential Note'}</button></div>
      </form>
    </Modal>
  );
};

export const TabHrTraining = ({ appUser, users = [], addToast }) => {
  const manager = canManageHr(appUser);
  const uid = currentUid(appUser);
  const restaurantId = appUser?.restaurantId || '';
  const [activeTab, setActiveTab] = useState('overview');
  const [manualModal, setManualModal] = useState(false);
  const [onboardingModal, setOnboardingModal] = useState(false);
  const [certModal, setCertModal] = useState(false);
  const [performanceModal, setPerformanceModal] = useState(false);
  const [busyId, setBusyId] = useState('');

  const manuals = useLiveCollection('trainingManuals', restaurantId, { enabled: !!restaurantId, whereClauses: manager ? [] : [['status', '==', 'Published']], limitCount: 150, fallbackLimitCount: manager ? 150 : 0 });
  const acknowledgements = useLiveCollection('trainingAcknowledgements', restaurantId, { enabled: !!restaurantId, whereClauses: manager ? [] : [['userId', '==', uid]], limitCount: 500, fallbackLimitCount: manager ? 500 : 0 });
  const onboardingTasks = useLiveCollection('hrOnboardingTasks', restaurantId, { enabled: !!restaurantId, whereClauses: manager ? [] : [['userId', '==', uid]], limitCount: 500, fallbackLimitCount: manager ? 500 : 0 });
  const certifications = useLiveCollection('hrCertifications', restaurantId, { enabled: !!restaurantId, whereClauses: manager ? [] : [['userId', '==', uid]], limitCount: 300, fallbackLimitCount: manager ? 300 : 0 });
  const performanceNotes = useLiveCollection('hrPerformanceNotes', restaurantId, { enabled: !!restaurantId && manager, limitCount: 300, fallbackLimitCount: 300 });

  const publishedManuals = useMemo(() => sortNewest(manuals.filter(item => item.status === 'Published')), [manuals]);
  const visibleManuals = useMemo(() => manager ? sortNewest(manuals) : publishedManuals, [manager, manuals, publishedManuals]);
  const acknowledgedIds = useMemo(() => new Set(acknowledgements.filter(item => item.userId === uid).map(item => item.manualId)), [acknowledgements, uid]);
  const completedTasks = onboardingTasks.filter(task => task.completed).length;
  const expiringCerts = certifications.filter(cert => {
    if (!cert.expiresDate) return false;
    const days = (new Date(`${cert.expiresDate}T23:59:59`).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  const expiredCerts = certifications.filter(cert => cert.expiresDate && new Date(`${cert.expiresDate}T23:59:59`).getTime() < Date.now()).length;

  const downloadManual = async (manual) => {
    if (!manual.storagePath) return;
    setBusyId(`download:${manual.id}`);
    try {
      const storedLimit = Math.max(MANUAL_STORAGE_MAX_BYTES, Number(manual.fileSize || 0) + 1024);
      const blob = await getBlob(ref(storage, manual.storagePath), storedLimit);
      let downloadBlob = blob;
      let downloadName = manual.fileName || `${safeFileName(manual.title)}.${String(manual.fileName || '').split('.').pop() || 'pdf'}`;
      if (manual.compressed === true || manual.compression === 'gzip') {
        const unzipped = await gunzipBlob(blob, manual.fileType || 'application/octet-stream');
        if (unzipped) {
          downloadBlob = unzipped;
        } else {
          downloadName = manual.storedFileName || `${downloadName}.gz`;
          addToast?.('Download Needs Decompression', 'This browser could not expand the compressed manual, so the stored .gz file is downloading.');
        }
      }
      const url = URL.createObjectURL(downloadBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) { addToast?.('Download Failed', error?.message || 'The manual could not be downloaded.'); }
    finally { setBusyId(''); }
  };
  const acknowledgeManual = async (manual) => {
    if (!uid || manual.status !== 'Published') return;
    setBusyId(`ack:${manual.id}`);
    try {
      const ackId = `${manual.id}_${uid}`;
      await setDoc(doc(db, 'trainingAcknowledgements', ackId), {
        restaurantId,
        manualId: manual.id,
        manualTitle: manual.title,
        manualVersion: manual.version,
        userId: uid,
        attestation: 'I acknowledge that I received and reviewed this training manual.',
        acknowledgedAt: serverTimestamp()
      }, { merge: false });
      addToast?.('Training Acknowledged', `${manual.title} version ${manual.version} has been recorded.`);
    } catch (error) { addToast?.('Acknowledgment Failed', error?.message || 'The acknowledgment could not be recorded.'); }
    finally { setBusyId(''); }
  };
  const deleteManual = async (manual) => {
    if (!manager || !window.confirm(`Delete ${manual.title} version ${manual.version}? This cannot be undone.`)) return;
    setBusyId(`delete:${manual.id}`);
    try {
      await safeWrite({ user: appUser, action: 'delete', collectionName: 'trainingManuals', docId: manual.id, before: manual, label: `Delete ${manual.title} version ${manual.version}` });
      let fileRemoved = true;
      if (manual.storagePath) {
        try { await deleteObject(ref(storage, manual.storagePath)); }
        catch (error) {
          if (error?.code !== 'storage/object-not-found') {
            fileRemoved = false;
            console.error('Training manual file cleanup failed after the protected record was deleted:', error);
          }
        }
      }
      addToast?.('Manual Deleted', fileRemoved ? 'The manual and secure file were removed.' : 'The manual was unpublished and removed. Secure file cleanup can be retried by the System Administrator.');
    } catch (error) { addToast?.('Delete Failed', error?.message || 'The manual could not be deleted.'); }
    finally { setBusyId(''); }
  };
  const toggleTask = async (task) => {
    setBusyId(`task:${task.id}`);
    try {
      const next = !task.completed;
      await updateDoc(doc(db, 'hrOnboardingTasks', task.id), {
        completed: next,
        completedAt: next ? nowIso() : '',
        completedBy: next ? uid : '',
        updatedAt: nowIso(),
        updatedBy: appUser.name || appUser.email || 'Employee'
      });
    } catch (error) { addToast?.('Update Failed', error?.message || 'The onboarding task could not be updated.'); }
    finally { setBusyId(''); }
  };
  const deleteRecord = async (collectionName, record, label) => {
    if (!manager || !window.confirm(`Delete ${label}?`)) return;
    setBusyId(`delete:${record.id}`);
    try {
      await safeWrite({ user: appUser, action: 'delete', collectionName, docId: record.id, before: record, label: `Delete ${label}` });
      addToast?.('Record Deleted', `${label} was removed.`);
    } catch (error) { addToast?.('Delete Failed', error?.message || 'The record could not be deleted.'); }
    finally { setBusyId(''); }
  };

  const availableTabs = TABS.filter(([id]) => id !== 'performance' || manager);

  return (
    <div className="hr-desktop mx-auto w-full max-w-7xl space-y-4 px-3 pb-12 sm:px-5">
      <div className={`${T.card} overflow-hidden p-0`}>
        <div className="border-b border-[#2A353D] bg-gradient-to-br from-[#1B242B] via-[#171D22] to-[#12161A] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-[#D4A381]/30 bg-[#D4A381]/10 p-3 text-[#E6BB9F]"><GraduationCap size={30} /></div>
              <div><div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#D4A381]">People Operations</div><h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">HR &amp; Training</h1><p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-300">Secure training records, clear onboarding, certification tracking, and professional employee documentation in one workspace.</p></div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-200"><ShieldCheck size={17} /> {manager ? 'Manager access' : 'Employee self-service'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap">
          {availableTabs.map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-black transition sm:text-sm ${activeTab === id ? 'border-[#D4A381]/50 bg-[#D4A381]/15 text-white shadow-sm' : 'border-[#2A353D] bg-[#12161A]/55 text-slate-300 hover:border-[#D4A381]/30 hover:text-white'}`}>{label}</button>)}
        </div>
      </div>

      {activeTab === 'overview' && <>
        <SectionHeader eyebrow="At a glance" title={manager ? 'People readiness dashboard' : 'My training dashboard'} text={manager ? 'See training publication, acknowledgment, onboarding, and certification readiness without exposing confidential records.' : 'Review your required manuals, onboarding progress, and certification records.'} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={<BookOpen size={20} />} label="Published manuals" value={publishedManuals.length} detail="Current documents available to employees" />
          <MetricCard icon={<CheckCircle2 size={20} />} label={manager ? 'Acknowledgments' : 'My acknowledgments'} value={manager ? acknowledgements.length : acknowledgedIds.size} detail={manager ? 'Immutable employee attestations recorded' : `${Math.max(0, publishedManuals.length - acknowledgedIds.size)} current manual(s) still to acknowledge`} />
          <MetricCard icon={<ClipboardCheck size={20} />} label={manager ? 'Onboarding complete' : 'My onboarding'} value={`${completedTasks}/${onboardingTasks.length}`} detail="Checklist items completed" />
          <MetricCard icon={<Award size={20} />} label="Certification attention" value={expiredCerts + expiringCerts} detail={`${expiredCerts} expired • ${expiringCerts} expiring within 60 days`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${T.card} p-5`}><h3 className="text-base font-black text-white">Training that needs attention</h3><div className="mt-4 space-y-2">{publishedManuals.filter(manual => !acknowledgedIds.has(manual.id)).slice(0, 5).map(manual => <button key={manual.id} type="button" onClick={() => setActiveTab('manuals')} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#2A353D] bg-[#12161A]/65 p-3 text-left"><div><div className="text-sm font-black text-white">{manual.title}</div><div className="mt-1 text-xs font-semibold text-slate-400">Version {manual.version} • {manual.category}</div></div><StatusPill tone="amber">Review</StatusPill></button>)}{publishedManuals.filter(manual => !acknowledgedIds.has(manual.id)).length === 0 && <Empty title="Training is current" text="There are no published manuals waiting for your acknowledgment." />}</div></div>
          <div className={`${T.card} p-5`}><h3 className="text-base font-black text-white">Onboarding progress</h3><div className="mt-4 space-y-2">{sortNewest(onboardingTasks).slice(0, 5).map(task => <div key={task.id} className="flex items-center gap-3 rounded-xl border border-[#2A353D] bg-[#12161A]/65 p-3"><span className={`rounded-full p-1 ${task.completed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/10 text-slate-400'}`}>{task.completed ? <Check size={16} /> : <Clock3 size={16} />}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-white">{task.title}</div><div className="mt-1 text-xs font-semibold text-slate-400">{manager ? task.employeeName : task.dueDate ? `Due ${prettyDate(task.dueDate)}` : 'No due date'}</div></div></div>)}{onboardingTasks.length === 0 && <Empty title="No checklist assigned" text={manager ? 'Assign an onboarding checklist when a new employee starts.' : 'Your manager has not assigned onboarding tasks.'} />}</div></div>
        </div>
      </>}

      {activeTab === 'manuals' && <>
        <SectionHeader eyebrow="Controlled documents" title="Training manuals" text="Employees see only published manuals. Each version is stored as the original file, with no AI conversion or rewriting." action={manager ? <button className={T.btn} type="button" onClick={() => setManualModal(true)}><Plus size={17} className="mr-2 inline" />Publish Manual</button> : null} />
        <div className="space-y-3">
          {visibleManuals.map(manual => {
            const acknowledged = acknowledgedIds.has(manual.id);
            const ackCount = acknowledgements.filter(item => item.manualId === manual.id).length;
            return <article key={manual.id} className={`${T.card} p-4 sm:p-5`}><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 gap-3"><div className="h-fit rounded-xl border border-blue-400/20 bg-blue-500/10 p-2.5 text-blue-200"><FileText size={22} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-white">{manual.title}</h3><StatusPill tone={manual.status === 'Published' ? 'green' : manual.status === 'Uploading' ? 'amber' : 'slate'}>{manual.status}</StatusPill>{manual.required && <StatusPill tone="blue">Required</StatusPill>}</div><div className="mt-1 text-xs font-bold text-slate-400">Version {manual.version} • {manual.category} • Effective {prettyDate(manual.effectiveDate)}</div>{manual.description && <p className="mt-2 text-sm font-medium leading-6 text-slate-300">{manual.description}</p>}<div className="mt-2 text-[11px] font-semibold text-slate-500">{manual.fileName} • {mbLabel(manual.originalFileSize || manual.fileSize)}{manual.compressed ? ` • compressed to ${mbLabel(manual.fileSize)}` : ''}{manager ? ` • ${ackCount} acknowledgment${ackCount === 1 ? '' : 's'}` : ''}</div></div></div><div className="flex flex-wrap gap-2"><button type="button" className={T.btnAlt} onClick={() => downloadManual(manual)} disabled={!!busyId || manual.status === 'Uploading'}><Download size={16} className="mr-2 inline" />{busyId === `download:${manual.id}` ? 'Preparing…' : 'Download'}</button>{manual.status === 'Published' && !acknowledged && <button type="button" className={T.btn} onClick={() => acknowledgeManual(manual)} disabled={!!busyId}><CheckCircle2 size={16} className="mr-2 inline" />Acknowledge</button>}{acknowledged && <span className="flex min-h-[42px] items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-200"><Check size={16} />Acknowledged</span>}{manager && <button type="button" className="min-h-[42px] rounded-xl border border-red-400/20 bg-red-500/5 px-3 text-red-300 hover:bg-red-500/10" onClick={() => deleteManual(manual)} disabled={!!busyId} aria-label={`Delete ${manual.title}`}><Trash2 size={16} /></button>}</div></div></article>;
          })}
          {visibleManuals.length === 0 && <Empty title="No training manuals yet" text={manager ? 'Publish the first controlled training document for this workspace.' : 'Your employer has not published a training manual yet.'} />}
        </div>
      </>}

      {activeTab === 'onboarding' && <>
        <SectionHeader eyebrow="New-hire readiness" title="Onboarding checklists" text={manager ? 'Assign consistent, auditable onboarding tasks and monitor completion.' : 'Complete each assigned item as you finish it with your trainer or manager.'} action={manager ? <button className={T.btn} type="button" onClick={() => setOnboardingModal(true)}><UserCheck size={17} className="mr-2 inline" />Assign Checklist</button> : null} />
        <div className="space-y-2">{sortNewest(onboardingTasks).map(task => <div key={task.id} className={`${T.card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}><button type="button" onClick={() => toggleTask(task)} disabled={!!busyId || (!manager && task.userId !== uid)} className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl border ${task.completed ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' : 'border-[#3A464E] bg-[#12161A] text-slate-400 hover:border-[#D4A381]/40'}`} aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}>{task.completed ? <Check size={20} /> : <span className="h-4 w-4 rounded border border-current" />}</button><div className="min-w-0 flex-1"><div className={`text-sm font-black ${task.completed ? 'text-slate-400 line-through' : 'text-white'}`}>{task.title}</div><div className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold text-slate-400">{manager && <span>{task.employeeName}</span>}<span>{task.dueDate ? `Due ${prettyDate(task.dueDate)}` : 'No due date'}</span>{task.completedAt && <span>Completed {prettyDate(task.completedAt)}</span>}</div></div>{manager && <button type="button" className="min-h-[42px] rounded-xl border border-red-400/20 px-3 text-red-300" onClick={() => deleteRecord('hrOnboardingTasks', task, task.title)}><Trash2 size={16} /></button>}</div>)}{onboardingTasks.length === 0 && <Empty title="No onboarding tasks" text={manager ? 'Assign a consistent checklist to a new employee.' : 'You have no onboarding tasks assigned.'} />}</div>
      </>}

      {activeTab === 'certifications' && <>
        <SectionHeader eyebrow="Compliance readiness" title="Certifications" text={manager ? 'Track food safety, alcohol service, first aid, and other role-required credentials.' : 'Review the certifications your employer has recorded for you.'} action={manager ? <button className={T.btn} type="button" onClick={() => setCertModal(true)}><Plus size={17} className="mr-2 inline" />Add Certification</button> : null} />
        <div className="grid gap-3 lg:grid-cols-2">{sortNewest(certifications).map(cert => { const expired = cert.expiresDate && new Date(`${cert.expiresDate}T23:59:59`).getTime() < Date.now(); const days = cert.expiresDate ? (new Date(`${cert.expiresDate}T23:59:59`).getTime() - Date.now()) / 86400000 : 9999; const expiring = !expired && days <= 60; return <article key={cert.id} className={`${T.card} p-4`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><div className="rounded-xl border border-[#D4A381]/25 bg-[#D4A381]/10 p-2 text-[#E6BB9F]"><Award size={22} /></div><div><h3 className="text-base font-black text-white">{cert.name}</h3><div className="mt-1 text-xs font-bold text-slate-400">{manager && `${cert.employeeName} • `}{cert.issuer || 'Issuer not listed'}</div><div className="mt-2 text-xs font-semibold text-slate-300">Issued {prettyDate(cert.issuedDate)} • Expires {prettyDate(cert.expiresDate)}</div>{cert.notes && <p className="mt-2 text-sm font-medium text-slate-300">{cert.notes}</p>}</div></div><div className="flex flex-col items-end gap-2"><StatusPill tone={expired ? 'red' : expiring ? 'amber' : 'green'}>{expired ? 'Expired' : expiring ? 'Expiring' : 'Current'}</StatusPill>{manager && <button type="button" className="min-h-[38px] rounded-lg border border-red-400/20 px-2.5 text-red-300" onClick={() => deleteRecord('hrCertifications', cert, cert.name)}><Trash2 size={15} /></button>}</div></div></article>; })}{certifications.length === 0 && <div className="lg:col-span-2"><Empty title="No certifications recorded" text={manager ? 'Add role-required credentials and expiration dates here.' : 'Your employer has not added a certification record for you.'} /></div>}</div>
      </>}

      {activeTab === 'performance' && manager && <>
        <SectionHeader eyebrow="Restricted records" title="Confidential performance notes" text="Visible only to authorized HR managers, workspace owners, administrators, and the System Administrator. Employees never receive read access to these records." action={<button className={T.btn} type="button" onClick={() => setPerformanceModal(true)}><LockKeyhole size={17} className="mr-2 inline" />Add Confidential Note</button>} />
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-amber-100"><ShieldCheck size={18} className="mr-2 inline" />Use this record for factual, job-related documentation. 86 Chaos provides secure recordkeeping, not legal advice; employers remain responsible for applicable employment and retention requirements.</div>
        <div className="space-y-3">{sortNewest(performanceNotes).map(note => <article key={note.id} className={`${T.card} p-4 sm:p-5`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-white">{note.employeeName}</h3><StatusPill tone="amber">{note.type}</StatusPill><StatusPill tone="slate">Confidential</StatusPill></div><div className="mt-1 text-xs font-bold text-slate-400">{prettyDate(note.date)} • Recorded by {note.createdByName || 'Manager'}</div><p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-200">{note.confidentialSummary}</p>{note.nextSteps && <div className="mt-3 rounded-xl border border-[#2A353D] bg-[#12161A]/65 p-3"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#D4A381]">Next steps</div><p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-300">{note.nextSteps}</p></div>}</div><button type="button" className="min-h-[42px] rounded-xl border border-red-400/20 px-3 text-red-300" onClick={() => deleteRecord('hrPerformanceNotes', note, `${note.type} note for ${note.employeeName}`)}><Trash2 size={16} /></button></div></article>)}{performanceNotes.length === 0 && <Empty title="No confidential notes" text="No performance documentation has been recorded in this workspace." />}</div>
      </>}

      <ManualUploadModal open={manualModal} onClose={() => setManualModal(false)} appUser={appUser} manuals={manuals} addToast={addToast} />
      <AddOnboardingModal open={onboardingModal} onClose={() => setOnboardingModal(false)} appUser={appUser} users={users} addToast={addToast} />
      <AddCertificationModal open={certModal} onClose={() => setCertModal(false)} appUser={appUser} users={users} addToast={addToast} />
      {manager && <AddPerformanceNoteModal open={performanceModal} onClose={() => setPerformanceModal(false)} appUser={appUser} users={users} addToast={addToast} />}
    </div>
  );
};

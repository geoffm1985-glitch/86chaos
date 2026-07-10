import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Clock, Star, Edit, Trash2, Plus, Camera, Loader2, X, Package, Shield, Send, MessageSquare, ClipboardList } from 'lucide-react';

const TabSchedule = ({ currentDate, users, shifts, events, timeOffRequests, timePunches = [], addToast, appUser, db, storage, Modal, T, getToday, getMonthStr, getDaysInMonth, formatDisplayDate, formatShortTime, getHoliday, logAudit }) => {
  const [subTab, setSubTab] = useState('schedule'); 
  const [selectedEmp, setSelectedEmp] = useState(''); 
  const [assignDates, setAssignDates] = useState([]); 
  const [presetShift, setPresetShift] = useState('Custom'); 
  const [startTime, setStartTime] = useState('16:00'); 
  const [endTime, setEndTime] = useState('21:00');
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false); 
  const [eventDate, setEventDate] = useState(getToday()); 
  const [eventTime, setEventTime] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [isEventUploading, setIsEventUploading] = useState(false);
  
  const monthStr = getMonthStr(currentDate); 
  const monthDays = Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => `${monthStr}-${String(i+1).padStart(2, '0')}`);
  const monthShifts = shifts.filter(s => s.date.startsWith(monthStr));
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(monthStr)).sort((a,b) => (a.date || '').localeCompare(b.date || ''));

  // --- NEW STATE: CUSTOM PAYROLL DATE RANGE ---
  const [periodStart, setPeriodStart] = useState(`${monthStr}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);

  // Auto-sync the date pickers if they use the master calendar dropdown
  useEffect(() => {
    setPeriodStart(`${monthStr}-01`);
    setPeriodEnd(`${monthStr}-${String(getDaysInMonth(monthStr)).padStart(2, '0')}`);
  }, [monthStr]);

  const activeRoster = users.filter(u => u.isActive !== false);

  const displayUsers = [...activeRoster].sort((a,b) => {
    const roleA = a.role || 'Unassigned';
    const roleB = b.role || 'Unassigned';
    const nameA = a.name || 'Unknown';
    const nameB = b.name || 'Unknown';
    return roleA === roleB ? nameA.localeCompare(nameB) : roleA.localeCompare(roleB);
  });
  
  const groupedUsers = activeRoster.reduce((acc, user) => {
    const role = user.role || 'Unassigned';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});
  const sortedRoles = Object.keys(groupedUsers).sort();

  const getRoleColors = (role, isPublished) => {
    if (!isPublished) return 'bg-slate-400 text-slate-900';
    const r = (role || '').toLowerCase();
    if (r.includes('bartender')) return 'bg-blue-400 text-blue-950';
    if (r.includes('cook') || r.includes('chef') || r.includes('kitchen')) return 'bg-[#D4A381] text-[#26170F]';
    if (r.includes('server') || r.includes('wait')) return 'bg-pink-400 text-pink-950';
    if (r.includes('host')) return 'bg-emerald-400 text-emerald-950';
    if (r.includes('manager')) return 'bg-purple-400 text-purple-950';
    if (r.includes('dish')) return 'bg-cyan-400 text-cyan-950';
    return 'bg-[#D4A381] text-slate-900'; 
  };

  const SHIFT_PRESETS = [ { label: "9a-3p", start: "09:00", end: "15:00" }, { label: "10a-4p", start: "10:00", end: "16:00" }, { label: "10a-9p", start: "10:00", end: "21:00" }, { label: "11a-3p", start: "11:00", end: "15:00" }, { label: "11a-4p", start: "11:00", end: "16:00" }, { label: "4p-9p", start: "16:00", end: "21:00" }, { label: "7p-close", start: "19:00", end: "CLOSE" }, { label: "9p-close", start: "21:00", end: "CLOSE" }, { label: "Custom", start: "", end: "" } ];
  const handlePresetChange = (e) => { const val = e.target.value; setPresetShift(val); const p = SHIFT_PRESETS.find(x => x.label === val); if (p && val !== 'Custom') { setStartTime(p.start); if (p.end !== 'CLOSE') setEndTime(p.end); } };

  const handleCellClick = (d, empId) => {
    if (d < getToday()) return addToast("Locked", "Cannot edit past dates.");
    const existing = monthShifts.find(s => s.date === d && s.employeeId === empId);
    if (existing) { if(window.confirm("Delete shift?")) deleteDoc(doc(db,"shifts",existing.id)); return; }
    setSelectedEmp(empId); if (assignDates.includes(d)) setAssignDates(assignDates.filter(x => x!==d)); else setAssignDates([...assignDates, d]);
  };

  const handleAssign = async () => {
    if (!selectedEmp || assignDates.length === 0) return; const emp = users.find(u => u.id === selectedEmp);
    const sTime = startTime; const eTime = presetShift.includes('close') ? '23:59' : endTime;
    const validDates = [];
    for (const d of assignDates) { 
      const existingShift = monthShifts.find(s => s.date === d && s.employeeId === emp.id);
      if (existingShift) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is already scheduled on ${formatDisplayDate(d)}.`); return; }
      
      const req = timeOffRequests.find(r => r.date === d && r.userId === emp.id);
      if (req) {
        if (!req.isPartial) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} requested ${formatDisplayDate(d)} off.`); return; } 
        else { const reqEnd = req.endTime || '23:59'; if ((sTime < reqEnd) && (eTime > req.startTime)) { addToast('Blocked', `${(emp.name||'Unknown').split(' ')[0]} is unavailable from ${formatShortTime(req.startTime)} to ${formatShortTime(req.endTime)} on ${formatDisplayDate(d)}.`); return; } }
      }
      validDates.push(d);
    }
    for (const d of validDates) { await addDoc(collection(db, "shifts"), { date: d, employeeId: emp.id, role: emp.role || 'Unassigned', startTime: sTime, endTime: presetShift.includes('close')?'CLOSE':endTime, isPublished: false, restaurantId: appUser.restaurantId }); }
    setAssignDates([]); addToast('Assigned', `Added ${validDates.length} shifts.`);
  };

  const handlePublish = async () => { if(!window.confirm("Publish schedule? Notifications will be sent.")) return; const unpub = monthShifts.filter(s => !s.isPublished); for(const s of unpub) await updateDoc(doc(db, "shifts", s.id), {isPublished:true}); addToast("Published", "Schedule is live."); logAudit(appUser, 'PUBLISH_SCHEDULE', 'Master Roster', 'Pushed a new schedule live.'); };
  
  const handleAddEvent = async (e) => { 
    e.preventDefault(); 
    if(!eventTitle.trim()) return; 
    setIsEventUploading(true);

    let photoUrl = null;
    if (eventImageFile) {
      try {
        const fileRef = ref(storage, `events/${appUser.restaurantId}/${Date.now()}_${eventImageFile.name}`);
        await uploadBytes(fileRef, eventImageFile);
        photoUrl = await getDownloadURL(fileRef);
      } catch (error) {
        addToast('Error', 'Image upload failed. Check connection.');
        setIsEventUploading(false);
        return;
      }
    }

    const eventData = { date: eventDate, time: eventTime, title: eventTitle.trim(), notes: eventNotes.trim() };
    if (photoUrl) eventData.imageUrl = photoUrl; // Only overwrite image if a new one is uploaded

    if (editingEventId) {
      await updateDoc(doc(db, "events", editingEventId), eventData);
      addToast('Updated', 'Event modified successfully.');
    } else {
      await addDoc(collection(db, "events"), { type: 'special_event', ...eventData, addedBy: appUser.name, restaurantId: appUser.restaurantId }); 
      addToast('Event Added', 'Calendar updated.');
    }
    setEventTitle(''); setEventTime(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventUploading(false); setIsEventModalOpen(false); 
  };

  const openEditEventModal = (ev) => {
    setEventDate(ev.date); setEventTime(ev.time || ''); setEventTitle(ev.title || ''); setEventNotes(ev.notes || ''); setEditingEventId(ev.id); setEventImageFile(null); setIsEventModalOpen(true);
  };

  const openNewEventModal = () => {
    setEventDate(currentDate); setEventTime(''); setEventTitle(''); setEventNotes(''); setEditingEventId(null); setEventImageFile(null); setIsEventModalOpen(true);
  };

  // --- LABOR PROJECTION ENGINE ---
  const calculateShiftHours = (start, end) => {
    if (!start || !end) return 0;
    let sH = parseInt(start.split(':')[0]), sM = parseInt(start.split(':')[1]) / 60;
    let eH = end === 'CLOSE' ? 23 : parseInt(end.split(':')[0]), eM = end === 'CLOSE' ? 59 / 60 : parseInt(end.split(':')[1]) / 60;
    let total = (eH + eM) - (sH + sM);
    if (total < 0) total += 24; 
    return total;
  };

  let projectedMonthLabor = 0;
  const projectedDailyLabor = {};
  monthDays.forEach(d => projectedDailyLabor[d] = 0);

  monthShifts.forEach(shift => {
    const emp = users.find(u => u.id === shift.employeeId);
    const wage = emp?.wage || 0; 
    const hours = calculateShiftHours(shift.startTime, shift.endTime);
    const cost = hours * wage;
    
    projectedMonthLabor += cost;
    if (projectedDailyLabor[shift.date] !== undefined) {
      projectedDailyLabor[shift.date] += cost;
    }
  });

  // --- NEW TIMESHEET & OT ENGINE (TIED TO CUSTOM PERIOD) ---
  const periodPunches = timePunches.filter(p => p.date >= periodStart && p.date <= periodEnd).sort((a,b) => new Date(a.clockInTime || 0) - new Date(b.clockInTime || 0));
  
  const calculatePunchHours = (inTime, outTime, breakMins = 0) => {
      if (!inTime || !outTime) return 0;
      const rawMins = (new Date(outTime) - new Date(inTime)) / 60000;
      return Math.max(0, (rawMins - breakMins) / 60);
  };

  const getWeekStart = (dateString) => {
      const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
      let d = new Date(dateString + 'T12:00:00');
      while (d.getDay() !== startDayInt) { d.setDate(d.getDate() - 1); }
      return d.toISOString().split('T')[0];
  };
  
  const payrollSummary = {};
  const weeklyHours = {}; 
  const OT_THRESHOLD = parseFloat(appUser?.systemSettings?.overtime || 40);

  periodPunches.forEach(p => {
      if (p.status === 'clocked_in' || !p.clockOutTime) return;
      
      const emp = users.find(u => u.id === p.employeeId);
      if (!payrollSummary[p.employeeId]) {
          payrollSummary[p.employeeId] = {
              name: p.employeeName || 'Unknown',
              regHours: 0,
              otHours: 0,
              cashTips: 0,
              creditTips: 0,
              rate: emp?.wage || 0,
              pay: 0
          };
      }
      
      const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
      const weekKey = `${p.employeeId}_${getWeekStart(p.date)}`;
      const prevWeeklyHours = weeklyHours[weekKey] || 0;
      const newWeeklyHours = prevWeeklyHours + hours;
      
      let reg = 0; let ot = 0;
      if (prevWeeklyHours >= OT_THRESHOLD) {
          ot = hours;
      } else if (newWeeklyHours > OT_THRESHOLD) {
          reg = OT_THRESHOLD - prevWeeklyHours;
          ot = newWeeklyHours - OT_THRESHOLD;
      } else {
          reg = hours;
      }
      
      weeklyHours[weekKey] = newWeeklyHours;
      
      payrollSummary[p.employeeId].regHours += reg;
      payrollSummary[p.employeeId].otHours += ot;
      payrollSummary[p.employeeId].cashTips += (parseFloat(p.cashTips) || 0);
      payrollSummary[p.employeeId].creditTips += (parseFloat(p.creditTips) || 0);
      
      const rate = emp?.wage || 0;
      payrollSummary[p.employeeId].pay += (reg * rate) + (ot * rate * 1.5);
  });
  
  const summaryList = Object.values(payrollSummary).sort((a, b) => a.name.localeCompare(b.name));
  const actualPeriodLabor = summaryList.reduce((acc, s) => acc + s.pay, 0);

  const handleForceClockOut = async (punch) => {
      if (!window.confirm(`Force clock out ${punch.employeeName}?`)) return;
      await updateDoc(doc(db, "timePunches", punch.id), { clockOutTime: new Date().toISOString(), status: 'clocked_out' });
      addToast('Updated', `Punched out ${punch.employeeName}.`);
  };

  const handleDeletePunch = async (id) => {
      if (!window.confirm("Delete this time punch permanently?")) return;
      await deleteDoc(doc(db, "timePunches", id));
      addToast('Deleted', 'Time punch removed.');
  };

  // --- EDIT PUNCH ENGINE ---
  const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
  const [editingPunch, setEditingPunch] = useState(null);
  const [editPunchIn, setEditPunchIn] = useState('');
  const [editPunchOut, setEditPunchOut] = useState('');
  const [editBreakMins, setEditBreakMins] = useState('');
  const [editCash, setEditCash] = useState('');
  const [editCredit, setEditCredit] = useState('');

  const openEditPunchModal = (punch) => {
    setEditingPunch(punch);
    const formatForInput = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setEditPunchIn(formatForInput(punch.clockInTime));
    setEditPunchOut(punch.clockOutTime && punch.status === 'clocked_out' ? formatForInput(punch.clockOutTime) : '');
    setEditBreakMins(punch.breakMinutes || 0);
    setEditCash(punch.cashTips || 0);
    setEditCredit(punch.creditTips || 0);
    setIsPunchModalOpen(true);
  };

  const handleSavePunchEdit = async (e) => {
    e.preventDefault();
    if (!editingPunch || !editPunchIn) return;
    try {
      const updateData = { 
          clockInTime: new Date(editPunchIn).toISOString(),
          breakMinutes: parseFloat(editBreakMins) || 0,
          cashTips: parseFloat(editCash) || 0,
          creditTips: parseFloat(editCredit) || 0
      };
      if (editPunchOut) {
        updateData.clockOutTime = new Date(editPunchOut).toISOString();
        updateData.status = 'clocked_out';
      } else {
        updateData.clockOutTime = null;
        updateData.status = 'clocked_in';
      }
      await updateDoc(doc(db, "timePunches", editingPunch.id), updateData);
      addToast('Updated', 'Time punch modified successfully.');
      setIsPunchModalOpen(false);
      setEditingPunch(null);
    } catch (err) {
      addToast('Error', err.message);
    }
  };

  // --- EXPORT TIMESHEETS ENGINE ---
  const handleExportTimesheets = () => {
    if (periodPunches.length === 0) return addToast("Empty", "No punches to export for this period.");
    
    const pStartStr = new Date(periodStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const pEndStr = new Date(periodEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    let csv = `"--- PAYROLL SUMMARY ---"\n`;
    csv += `"Pay Period: ${pStartStr} - ${pEndStr}"\n\n`;
    csv += '"Employee Name","Reg Hours","OT Hours","Hourly Rate","Total Gross Pay","Declared Cash Tips","Declared Credit Tips"\n';
    
    summaryList.forEach(s => {
       csv += `"${s.name}","${s.regHours.toFixed(2)}","${s.otHours.toFixed(2)}","$${s.rate.toFixed(2)}","$${s.pay.toFixed(2)}","$${s.cashTips.toFixed(2)}","$${s.creditTips.toFixed(2)}"\n`;
    });
    
    csv += '\n"--- INDIVIDUAL PUNCHES ---"\n';
    csv += '"Employee Name","Date","Clock In","Clock Out","Break (Mins)","Total Hours","Hourly Rate","Total Pay","Cash Tips","Credit Tips"\n';
    
    // Sort reverse chronological for the individual punch view
    const sortedPunches = [...periodPunches].sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));
    
    sortedPunches.forEach(p => {
       const emp = users.find(u => u.id === p.employeeId);
       const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
       const rate = emp?.wage || 0;
       const estCost = hours * rate; 
       
       const inStr = p.clockInTime ? new Date(p.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown';
       const outStr = p.status === 'clocked_in' ? 'ON CLOCK' : (p.clockOutTime ? new Date(p.clockOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown');
       
       csv += `"${p.employeeName || 'Unknown'}","${p.date || 'Unknown'}","${inStr}","${outStr}","${p.breakMinutes||0}","${hours.toFixed(2)}","$${rate.toFixed(2)}","$${estCost.toFixed(2)}","$${parseFloat(p.cashTips||0).toFixed(2)}","$${parseFloat(p.creditTips||0).toFixed(2)}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a"); 
    link.setAttribute("href", url); 
    link.setAttribute("download", `Payroll_Export_${periodStart}_to_${periodEnd}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addToast('Exported', 'Spreadsheet generated.');
  };

  // --- WEEKLY HOURS TRACKER ENGINE ---
  const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  const startDayInt = daysMap[appUser?.preferences?.payPeriodStart || 'Monday'];
  const endDayInt = startDayInt === 0 ? 6 : startDayInt - 1;

  const weeksInMonth = [];
  let currentWeek = [];
  monthDays.forEach(d => {
      currentWeek.push(d);
      if (new Date(d+'T12:00').getDay() === endDayInt) {
          weeksInMonth.push(currentWeek);
          currentWeek = [];
      }
  });
  if (currentWeek.length > 0) weeksInMonth.push(currentWeek);

  const scheduledHours = displayUsers.map(u => {
     const userShifts = monthShifts.filter(s => s.employeeId === u.id);
     const weekly = weeksInMonth.map(weekDaysArr => {
        return weekDaysArr.reduce((sum, d) => {
           const shift = userShifts.find(s => s.date === d);
           return sum + (shift ? calculateShiftHours(shift.startTime, shift.endTime) : 0);
        }, 0);
     });
     return { id: u.id, name: u.name, weekly, total: weekly.reduce((a,b)=>a+b,0) };
  }).filter(u => u.total > 0);

  return (
    <div className="space-y-4 pb-12 w-full">
      <Modal isOpen={isEventModalOpen} onClose={()=>setIsEventModalOpen(false)} title={editingEventId ? "Edit Special Event" : "Add Special Event"}>
        <form onSubmit={handleAddEvent} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={T.label}>Date</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} className={T.input} required/></div>
            <div><label className={T.label}>Time (Optional)</label><input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)} className={T.input}/></div>
          </div>
        <div><label className={T.label}>Event Title</label><input type="text" value={eventTitle} onChange={e=>setEventTitle(e.target.value)} className={T.input} placeholder="e.g., Packers Playoff Game" required/></div>
          <div>
            <label className={T.label}>Notes & Photo (Optional)</label>
            <textarea rows="2" value={eventNotes} onChange={e=>setEventNotes(e.target.value)} className={`${T.input} mb-2`} placeholder="Extra details..."/>
            
            {eventImageFile && (
              <div className="text-xs text-emerald-400 font-bold bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50 flex justify-between items-center mb-2">
                <span className="truncate pr-2">📷 {eventImageFile.name} attached</span>
                <button type="button" onClick={()=>setEventImageFile(null)} className="text-red-400 hover:text-red-300 p-1"><X size={14}/></button>
              </div>
            )}
            
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center w-full">
              <div className={`flex flex-1 sm:flex-none bg-[#12161A] border border-[#2A353D] rounded-xl overflow-hidden shadow-sm h-12 ${isEventUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="flex-1 sm:w-16 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors border-r border-[#2A353D] text-[#D4A381]" title="Take Photo">
                    <Camera size={20} />
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
                 <label className="flex-1 sm:w-20 flex items-center justify-center cursor-pointer hover:bg-[#1A2126] transition-colors text-[#D4A381]" title="Upload Photo">
                    <span className="text-[10px] font-black uppercase tracking-wider">Upload</span>
                    <input type="file" accept="image/*" onChange={(e) => setEventImageFile(e.target.files[0])} className="hidden" disabled={isEventUploading} />
                 </label>
              </div>
              <button type="submit" disabled={isEventUploading || !eventTitle.trim()} className={`flex-1 sm:flex-1 ${T.btn} h-12 disabled:opacity-50 flex items-center justify-center`}>
                {isEventUploading ? <Loader2 className="animate-spin" size={20}/> : (editingEventId ? 'Update Event' : 'Save Event')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPunchModalOpen} onClose={()=>setIsPunchModalOpen(false)} title={`Edit Punch: ${editingPunch?.employeeName}`}>
        <form onSubmit={handleSavePunchEdit} className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={T.label}>Clock In Time</label>
              <input type="datetime-local" value={editPunchIn} onChange={e=>setEditPunchIn(e.target.value)} className={T.input} required/>
            </div>
            <div>
              <label className={T.label}>Clock Out Time (Leave blank if currently on clock)</label>
              <input type="datetime-local" value={editPunchOut} onChange={e=>setEditPunchOut(e.target.value)} className={T.input}/>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={T.label}>Break (Mins)</label>
              <input type="number" min="0" value={editBreakMins} onChange={e=>setEditBreakMins(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Cash Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCash} onChange={e=>setEditCash(e.target.value)} className={T.input}/>
            </div>
            <div>
              <label className={T.label}>Credit Tips ($)</label>
              <input type="number" step="0.01" min="0" value={editCredit} onChange={e=>setEditCredit(e.target.value)} className={T.input}/>
            </div>
          </div>
          <button type="submit" className={`w-full ${T.btn}`}>Save Time Punch</button>
        </form>
      </Modal>

      {/* TOP NAVIGATION TOGGLE */}
      <div className="flex flex-wrap gap-2 border-b border-[#2A353D] pb-3 mb-2">
        <button onClick={() => setSubTab('schedule')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'schedule' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Schedule Builder</button>
        <button onClick={() => setSubTab('events')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'events' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Events Ledger</button>
        {appUser?.isAdmin && (
          <button onClick={() => setSubTab('timesheets')} className={`px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all ${subTab === 'timesheets' ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>Timesheets & Labor</button>
        )}
      </div>

      {subTab === 'schedule' && (
        <div className="space-y-6 animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} p-2 sm:p-3 flex flex-col lg:flex-row gap-2 items-center justify-between`}>
            <div className="grid grid-cols-2 lg:flex lg:flex-nowrap gap-2 w-full lg:w-auto items-center">
              <select value={selectedEmp} onChange={e=>{setSelectedEmp(e.target.value); setAssignDates([]);}} className={`${T.input} col-span-1 py-1.5 px-2 text-[11px] sm:text-xs h-9`}>
                <option value="">-- Select Staff --</option>
                {displayUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={presetShift} onChange={handlePresetChange} className={`${T.input} col-span-1 py-1.5 px-2 text-[11px] sm:text-xs h-9`}>{SHIFT_PRESETS.map(p=><option key={p.label} value={p.label}>{p.label}</option>)}</select>
              <div className="flex gap-2 w-full col-span-2 lg:col-span-1 lg:w-auto">
                <input type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-1/2 lg:w-auto py-1.5 px-2 text-[11px] sm:text-xs h-9`}/>
                <input type="time" value={presetShift.includes('close')?'':endTime} disabled={presetShift.includes('close')} onChange={e=>{setEndTime(e.target.value);setPresetShift('Custom');}} className={`${T.input} w-1/2 lg:w-auto py-1.5 px-2 text-[11px] sm:text-xs h-9 disabled:opacity-50`}/>
              </div>
              <button onClick={handleAssign} disabled={!selectedEmp||assignDates.length===0} className={`w-full col-span-2 lg:col-span-1 lg:w-auto ${T.btn} py-1.5 px-3 text-xs h-9 disabled:opacity-50 flex items-center justify-center`}>Assign ({assignDates.length})</button>
            </div>
            <div className="flex w-full lg:w-auto gap-2 items-center">
              <div className="hidden lg:flex flex-col items-end mr-2 bg-[#12161A] border border-[#2A353D] px-3 py-1 rounded-lg">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Proj. Month Labor</span>
                <span className="text-emerald-400 font-black text-sm">${projectedMonthLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <button onClick={handlePublish} className={`flex-1 lg:flex-none ${T.btnAlt} py-1.5 text-xs h-9 flex items-center justify-center`}>Publish</button>
              <button onClick={openNewEventModal} className={`flex-1 lg:flex-none ${T.btnAlt} border-[#D4A381] text-[#D4A381] py-1.5 text-xs h-9 flex items-center justify-center`}>+ Event</button>
            </div>
          </div>

          <div className={`${T.card} w-full overflow-hidden`}>
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full text-left text-[10px] border-collapse table-fixed min-w-[1200px] xl:min-w-full">
                <thead>
                  <tr className="bg-[#12161A] border-b border-[#2A353D]">
                    <th className={`p-1 sm:p-2 font-bold bg-[#12161A] sticky left-0 z-20 w-16 sm:w-24 border-r border-[#2A353D] ${T.copper} truncate`}>Staff</th>
                    {monthDays.map(d => {
                      const holiday = getHoliday(d);
                      const dayEvents = monthEvents.filter(e => e.date === d);
                      const hasAlert = holiday || dayEvents.length > 0;
                      
                      return (
                      <th key={d} className={`p-0.5 sm:p-1 text-center border-r border-[#2A353D] align-top relative group cursor-help ${new Date(d+'T12:00').getDay()%6===0?'bg-[#1A2126]':''}`}>
                        <div className={`font-bold uppercase text-[8px] sm:text-[9px] ${T.muted}`}>{new Date(d+'T12:00').toLocaleDateString('en-US',{weekday:'narrow'})}</div>
                        <div className={`text-xs sm:text-sm font-black mt-0.5 ${hasAlert ? (holiday ? 'text-amber-400' : 'text-red-400') : 'text-white'}`}>
                          {parseInt(d.split('-')[2])}
                        </div>
                        
                        {hasAlert && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-[#1A2126] border border-[#D4A381] text-white text-[10px] p-2 rounded shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 pointer-events-none transition-all">
                            {holiday && <div className="text-amber-400 font-black mb-1 leading-tight">{holiday}</div>}
                            {dayEvents.map(ev => (
                              <div key={ev.id} className="text-red-400 font-bold leading-tight mt-1 border-t border-[#2A353D] pt-1">
                                {ev.title} {ev.time && <span className="block text-white opacity-80">{formatShortTime(ev.time)}</span>}
                                {ev.notes && <span className="block text-slate-300 font-normal mt-0.5">{ev.notes}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </th>
                    )})}
                  </tr>
                </thead>
              <tbody className="divide-y divide-[#2A353D]">
                  {sortedRoles.map(role => (
                    <React.Fragment key={`role-group-${role}`}>
                      <tr className="bg-[#1A2126]">
                        <td colSpan={monthDays.length + 1} className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${T.copper} border-b border-[#2A353D] sticky left-0 z-10`}>
                          {role}
                        </td>
                      </tr>
                      {groupedUsers[role].sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(u => (
                        <tr key={u.id} className={selectedEmp===u.id?'bg-[#12161A]/50':''}>
                          <td onClick={()=>{setSelectedEmp(u.id);setAssignDates([]);}} className={`px-2 py-1 text-xs font-bold sticky left-0 z-10 border-r border-[#2A353D] cursor-pointer truncate shadow-sm ${selectedEmp===u.id?`${T.grad} text-slate-900`:'bg-[#1A2126] text-white'}`}>{u.name.split(' ')[0]}</td>
                          {monthDays.map(d => {
                            const shift = monthShifts.find(s=>s.date===d&&s.employeeId===u.id); 
                            const req = timeOffRequests.find(r=>r.date===d&&r.userId===u.id); 
                            const sel = assignDates.includes(d) && selectedEmp===u.id;
                            return (
                            <td key={d} onClick={()=>handleCellClick(d,u.id)} className={`p-0.5 border-r border-[#2A353D] cursor-pointer transition-all align-top h-7 sm:h-8 ${sel?'bg-[#8F6040] outline outline-2 outline-[#D4A381] shadow-inner z-0 relative':'hover:bg-[#12161A]'}`}>
                            <div className="flex flex-col gap-[1px] w-full justify-start overflow-hidden">
                              {req && !req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-red-400 bg-red-900/40 uppercase tracking-tighter" title="Requested Off">Off</div>}
                              {req && req.isPartial && <div className="w-full rounded font-black text-[7px] sm:text-[8px] py-0.5 text-center text-amber-400 bg-amber-900/40 uppercase tracking-tighter truncate" title={`Off: ${formatShortTime(req.startTime)}-${formatShortTime(req.endTime)}`}>{formatShortTime(req.startTime)}-{formatShortTime(req.endTime)}</div>}
                              {shift && <div className={`w-full rounded font-bold text-[7px] sm:text-[8px] py-0.5 text-center truncate ${getRoleColors(shift.role, shift.isPublished)}`} title={`${formatShortTime(shift.startTime)} - ${formatShortTime(shift.endTime)}`}>{formatShortTime(shift.startTime)}-{formatShortTime(shift.endTime)}</div>}
                            </div>
                          </td>)
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr className="bg-[#0B0E11] border-t-2 border-[#D4A381]/30">
                    <td className={`px-2 py-2 text-[8px] font-black uppercase tracking-widest text-[#D4A381] sticky left-0 z-10 border-r border-[#2A353D] text-right shadow-md`}>
                      Proj. Cost
                    </td>
                    {monthDays.map(d => (
                      <td key={`cost-${d}`} className={`p-1 border-r border-[#2A353D] text-center align-middle font-black text-[9px] sm:text-[10px] ${projectedDailyLabor[d] > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        ${projectedDailyLabor[d].toFixed(0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className={`${T.card} overflow-hidden mt-6`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-sm flex items-center gap-2 ${T.copper}`}><Clock className={T.copper} size={16}/> Scheduled Hours Tracker</h3>
              <span className={`text-[9px] font-bold ${T.muted} uppercase tracking-widest`}>OT Threshold: {appUser?.systemSettings?.overtime || 40}h</span>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#1A2126] border-b border-[#2A353D] text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="p-3 border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 w-24">Employee</th>
                    {weeksInMonth.map((w, i) => <th key={i} className="p-3 text-center border-r border-[#2A353D]">Wk {i+1}<div className="text-[7px] text-slate-600 mt-0.5">{parseInt(w[0].split('-')[2])}-{parseInt(w[w.length-1].split('-')[2])}</div></th>)}
                    <th className="p-3 text-center text-[#D4A381]">Month Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A353D]">
                  {scheduledHours.length === 0 && <tr><td colSpan={weeksInMonth.length + 2} className="p-6 text-center text-slate-500 font-bold">No hours scheduled yet.</td></tr>}
                  {scheduledHours.map(u => (
                    <tr key={u.id} className="hover:bg-[#12161A]/50 transition-colors">
                      <td className="p-3 font-bold text-white border-r border-[#2A353D] sticky left-0 bg-[#1A2126] z-10 truncate">{u.name.split(' ')[0]}</td>
                      {u.weekly.map((hrs, i) => (
                        <td key={i} className={`p-3 text-center font-black border-r border-[#2A353D] ${hrs > parseFloat(appUser?.systemSettings?.overtime || 40) ? 'text-red-500 bg-red-900/10' : hrs > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {hrs > 0 ? hrs.toFixed(1) : '-'}
                        </td>
                      ))}
                      <td className="p-3 text-center font-black text-[#D4A381] bg-[#12161A]/30">{u.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- THE NEW EVENTS LEDGER SUB-TAB --- */}
      {subTab === 'events' && (
        <div className="animate-[slideIn_0.2s_ease-out] space-y-4">
          <div className="flex gap-2">
             <button onClick={openNewEventModal} className={`${T.btn} flex items-center justify-center gap-2`}><Plus size={16}/> Add Special Event</button>
          </div>
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Star className={T.copper}/> Monthly Events Ledger</h3>
            </div>
            <div className={`divide-y ${T.border}`}>
              {monthEvents.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No special events scheduled this month.</div>}
              {monthEvents.map(ev => (
                <div key={ev.id} className={`${T.row} flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`bg-[#12161A] border ${T.border} ${T.copper} font-black text-center rounded-xl p-2 w-14 shadow-sm flex-shrink-0`}>
                      <div className="text-[10px] uppercase">{new Date(ev.date+'T12:00').toLocaleDateString('en-US',{month:'short'})}</div><div className="text-lg leading-tight">{parseInt(ev.date.split('-')[2])}</div>
                    </div>
                  <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white">{ev.title} {ev.time && <span className="text-[#D4A381] ml-2">@ {formatShortTime(ev.time)}</span>}</h4>
                      {ev.notes && <p className="text-xs text-slate-300 mt-1 font-medium bg-[#12161A] p-2 rounded-lg border border-[#2A353D] whitespace-pre-wrap">{ev.notes}</p>}
                      {ev.imageUrl && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-[#2A353D] shadow-inner bg-[#0B0E11] max-w-sm">
                          <img src={ev.imageUrl} alt="Attached" className="w-full max-h-48 object-contain" />
                        </div>
                      )}
                      <span className={`text-[10px] font-bold ${T.muted} block mt-1`}>Added by {ev.addedBy}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:self-end self-start">
                    <button onClick={() => openEditEventModal(ev)} className="p-2 text-slate-400 hover:text-[#D4A381] transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Edit size={14}/></button>
                    <button onClick={() => { if(window.confirm("Delete event?")) deleteDoc(doc(db,"events",ev.id)); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-[#12161A] rounded-lg border border-[#2A353D]"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* THE TIMESHEET SUB-TAB (Secured & Safed) */}
      {subTab === 'timesheets' && appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          
          <div className={`bg-[#12161A] p-4 border-b ${T.border} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}>Payroll</h3>
              <div className="flex items-center gap-2 bg-[#1A2126] border border-[#2A353D] p-1.5 rounded-lg shadow-inner">
                 <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
                 <span className="text-slate-500 font-black text-[10px] uppercase">to</span>
                 <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="bg-transparent text-[#D4A381] text-xs font-bold outline-none cursor-pointer" />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={handleExportTimesheets} className="bg-[#1A2126] border border-[#2A353D] text-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs hover:text-emerald-400 transition-colors flex items-center gap-2">📋 Export CSV</button>
              <div className="bg-[#1A2126] border border-[#2A353D] px-3 py-1.5 rounded-lg flex flex-col items-end shadow-sm">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Period Labor</span>
                <span className="text-emerald-400 font-black text-sm">${actualPeriodLabor.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

          {summaryList.length > 0 && (
            <div className="p-4 border-b border-[#2A353D] bg-[#0B0E11]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Period Payroll Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {summaryList.map(s => (
                  <div key={s.name} className="bg-[#1A2126] p-3 rounded-xl border border-[#2A353D] flex justify-between items-center shadow-sm hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                        REG: {s.regHours.toFixed(2)}h | OT: {s.otHours.toFixed(2)}h
                      </div>
                      <div className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mt-0.5">
                        TIPS: ${(s.cashTips + s.creditTips).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[#D4A381] font-black text-lg">${s.pay.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`divide-y ${T.border}`}>
            {periodPunches.length === 0 && <div className={`p-6 text-center text-sm font-bold ${T.muted}`}>No clock-ins recorded for this period.</div>}
            
            {periodPunches.sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0)).map(p => {
               const emp = users.find(u => u.id === p.employeeId);
               const hours = calculatePunchHours(p.clockInTime, p.clockOutTime, p.breakMinutes || 0);
               const cost = hours * (emp?.wage || 0);
               const isClockedIn = p.status === 'clocked_in' || p.status === 'on_break';
               
               const safeIn = p.clockInTime ? new Date(p.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'ERR';
               const safeOut = isClockedIn ? '---' : (p.clockOutTime ? new Date(p.clockOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'ERR');
               
               return (
                 <div key={p.id} className={`${T.row} flex flex-col md:flex-row justify-between md:items-center gap-4`}>
                   <div>
                     <div className="font-bold text-white text-base">{p.employeeName || 'Unknown'}</div>
                     <div className={`text-[10px] font-black uppercase tracking-widest ${T.muted} mt-0.5`}>
                       {p.date ? formatDisplayDate(p.date) : 'Unknown Date'}
                     </div>
                   </div>
                   <div className="flex items-center gap-6">
                     <div className="text-right">
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-emerald-400">IN:</span> {safeIn}
                       </div>
                       <div className="text-xs font-mono text-slate-300">
                         <span className="text-red-400">OUT:</span> {safeOut}
                       </div>
                     </div>
                     <div className="text-right border-l border-[#2A353D] pl-6 w-24">
                       <div className={`text-sm font-black ${isClockedIn ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{isClockedIn ? 'ON CLOCK' : `${hours.toFixed(2)} hrs`}</div>
                       <div className="text-[10px] font-black text-[#D4A381] uppercase tracking-widest">${cost.toFixed(2)}</div>
                     </div>
                     <div className="flex gap-2 border-l border-[#2A353D] pl-4">
                       {isClockedIn && <button onClick={() => handleForceClockOut(p)} className="px-3 py-1 bg-red-900/20 text-red-500 text-[10px] font-black uppercase rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Force Out</button>}
                       <button onClick={() => openEditPunchModal(p)} className="p-2 text-slate-400 hover:text-[#D4A381] bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Edit size={14}/></button>
                       <button onClick={() => handleDeletePunch(p.id)} className="p-2 text-slate-400 hover:text-red-500 bg-[#12161A] rounded-lg border border-[#2A353D] transition-colors"><Trash2 size={14}/></button>
                     </div>
                   </div>
                 </div>
               )
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TabSchedule;

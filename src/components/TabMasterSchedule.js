import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Bell, Calendar, Repeat, Clock } from 'lucide-react';
import TabMonth from './TabMonth';
import TabTimeOff from './TabTimeOff';

const TabMasterSchedule = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOffRequests, events, addToast, db, Modal, T, getToday, getMonthStr, formatDisplayDate, formatShortTime, getDaysInMonth, formatDisplayMonth, getHoliday }) => {
  const [subTab, setSubTab] = useState('my-schedule');
  const monthStr = getMonthStr(currentDate);
  
  // --- TIME CLOCK LOGIC ---
  const [activePunch, setActivePunch] = useState(null);
  const [clockActionBusy, setClockActionBusy] = useState(false);
  const [clockActionType, setClockActionType] = useState(null);
  const [clockActionPunch, setClockActionPunch] = useState(null);
  const recentlyClockedOutRef = useRef({});
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipCash, setTipCash] = useState('');
  const [tipCredit, setTipCredit] = useState('');

  useEffect(() => {
    if (!appUser?.id || !appUser?.restaurantId) {
      setActivePunch(null);
      return;
    }
    const q = query(
      collection(db, 'timePunches'),
      where('restaurantId', '==', appUser.restaurantId),
      where('employeeId', '==', appUser.id)
    );
    const unsub = onSnapshot(q, snap => {
      const punches = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => ['clocked_in', 'on_break'].includes(p.status))
        .sort((a,b) => new Date(b.clockInTime || 0) - new Date(a.clockInTime || 0));
      const newest = punches[0] || null;
      setActivePunch(prev => {
        if (newest?.id) {
          const suppressUntil = recentlyClockedOutRef.current[newest.id] || 0;
          return Date.now() < suppressUntil ? null : newest;
        }
        if (prev?._optimisticUntil && Date.now() < prev._optimisticUntil) return prev;
        return null;
      });
    });
    return () => unsub();
  }, [appUser?.id, appUser?.restaurantId, db]);

  const handleClockIn = async () => {
    if (clockActionBusy || activePunch) return;
    setClockActionType('in');
    setClockActionBusy(true);
    try {
      const punchData = { 
        employeeId: appUser.id, 
        employeeName: appUser.name, 
        clockInTime: new Date().toISOString(), 
        status: 'clocked_in', 
        restaurantId: appUser.restaurantId, 
        date: getToday(),
        breakMinutes: 0
      };
      const punchRef = await addDoc(collection(db, "timePunches"), punchData);
      setActivePunch({ id: punchRef.id, ...punchData, _optimisticUntil: Date.now() + 30000 });
      addToast('Clocked In', 'Shift started successfully.');
    } catch (e) {
      setActivePunch(null);
      addToast('Error', e.message);
    } finally {
      setClockActionBusy(false);
      setClockActionType(null);
      setClockActionPunch(null);
    }
  };

  const handleStartBreak = async () => {
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: new Date().toISOString(), status: 'on_break' });
    addToast('Break Started', 'Enjoy your break.');
  };

  const handleEndBreak = async () => {
    const breakStart = new Date(activePunch.breakStartTime);
    const now = new Date();
    const mins = (now - breakStart) / 60000;
    const currentBreaks = activePunch.breakMinutes || 0;
    await updateDoc(doc(db, "timePunches", activePunch.id), { breakStartTime: null, breakMinutes: currentBreaks + mins, status: 'clocked_in' });
    addToast('Break Ended', 'Welcome back to work.');
  };

  const initiateClockOut = () => {
    if (clockActionBusy) return;
    if (appUser?.systemSettings?.tips) { setIsTipModalOpen(true); } 
    else { finalizeClockOut(); }
  };

  const finalizeClockOut = async (e) => {
    if(e) e.preventDefault();
    if (!activePunch || clockActionBusy) return;
    const punchToClose = activePunch;
    try {
      let finalBreakMins = punchToClose.breakMinutes || 0;
      if (punchToClose.status === 'on_break') {
         const breakStart = new Date(punchToClose.breakStartTime);
         finalBreakMins += (new Date() - breakStart) / 60000;
      }
      const clockOutTime = new Date().toISOString();
      setClockActionType('out');
      setClockActionPunch(punchToClose);
      setClockActionBusy(true);
      recentlyClockedOutRef.current[punchToClose.id] = Date.now() + 30000;
      await updateDoc(doc(db, "timePunches", punchToClose.id), { 
        clockOutTime, 
        status: 'clocked_out',
        cashTips: parseFloat(tipCash) || 0,
        creditTips: parseFloat(tipCredit) || 0,
        breakMinutes: finalBreakMins,
        breakStartTime: null
      });
      setActivePunch(null);
      
      setIsTipModalOpen(false);
      setTipCash(''); setTipCredit('');
      addToast('Clocked Out', 'Shift ended. Great work today!');
    } catch (err) {
      if (punchToClose?.id) delete recentlyClockedOutRef.current[punchToClose.id];
      setActivePunch(punchToClose || null);
      addToast('Error', err.message);
    } finally {
      setClockActionBusy(false);
      setClockActionType(null);
      setClockActionPunch(null);
    }
  };

  // --- SHIFT LOGIC ---
  const myMonthShifts = shifts
    .filter(s => s.employeeId === appUser.id && s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date));

  const myNextShift = shifts
    .filter(s => s.employeeId === appUser.id && s.date >= getToday() && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date))[0];

  const activeMonthShifts = shifts
    .filter(s => s.date.startsWith(monthStr) && s.isPublished)
    .sort((a,b) => a.date.localeCompare(b.date));

  const handleOfferSwap = async (shift) => {
    if (!window.confirm(`Offer your ${formatDisplayDate(shift.date)} shift to the Trade Board?`)) return;
    await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available', restaurantId: appUser.restaurantId });
    await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `🚨 Shift Available! ${appUser.name.split(' ')[0]} needs cover for a ${shift.role} shift on ${formatDisplayDate(shift.date)} (${formatShortTime(shift.startTime)}).`, type: 'note', author: 'System Alert', isImportant: true, restaurantId: appUser.restaurantId });
    addToast('Posted', 'Shift sent to trade board.');
  };

  // --- TRADE BOARD LOGIC ---
  const availableSwaps = shiftSwaps
    .filter(s => s.status === 'available' && s.date >= getToday())
    .sort((a,b) => a.date.localeCompare(b.date));

  const handleCancelSwap = async (swapId) => {
    if (!window.confirm("Remove this shift from the Trade Board?")) return;
    await deleteDoc(doc(db, "shiftSwaps", swapId));
    addToast('Revoked', 'Shift removed from Trade Board.');
  };

  const handleClaimShift = async (swap) => {
    if (!window.confirm(`Claim the ${swap.role} shift on ${formatDisplayDate(swap.date)}?`)) return;
    try {
       await updateDoc(doc(db, "shifts", swap.shiftId), { employeeId: appUser.id });
       await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'claimed', claimedBy: appUser.id });
       await addDoc(collection(db, "events"), { date: new Date().toISOString(), title: `✅ Shift Claimed! ${appUser.name.split(' ')[0]} picked up a ${swap.role} shift on ${formatDisplayDate(swap.date)}.`, type: 'note', author: 'System Alert', isImportant: false, restaurantId: appUser.restaurantId });
       addToast('Claimed', 'Shift successfully added to your schedule.');
       setSubTab('my-schedule'); 
    } catch (e) {
       addToast('Error', e.message);
    }
  };

  const effectiveActivePunch = clockActionBusy && clockActionType === 'out' ? (clockActionPunch || activePunch) : (activePunch && !(clockActionBusy && clockActionType === 'in') ? activePunch : null);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      
      <Modal isOpen={isTipModalOpen} onClose={() => setIsTipModalOpen(false)} title="Declare Tips">
        <form onSubmit={finalizeClockOut} className="space-y-4">
          <p className="text-xs text-slate-300 font-bold mb-2">Please declare your tips for this shift before clocking out.</p>
          <div>
            <label className={T.label}>Cash Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCash} onChange={e=>setTipCash(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <div>
            <label className={T.label}>Credit Card Tips ($)</label>
            <input type="number" step="0.01" min="0" value={tipCredit} onChange={e=>setTipCredit(e.target.value)} className={T.input} placeholder="0.00"/>
          </div>
          <button type="submit" disabled={clockActionBusy} className={`w-full ${T.btn} disabled:opacity-60 disabled:cursor-not-allowed`}>{clockActionBusy ? 'Finalizing...' : 'Finalize Clock Out'}</button>
        </form>
      </Modal>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-[#2A353D] mb-4 pb-2">
        {['my-schedule', 'full-schedule', 'month-view', 'time-off'].map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} className={`px-2 sm:px-4 py-2 text-[10px] sm:text-xs font-black rounded-xl uppercase tracking-widest transition-all sm:flex-1 ${subTab === tab ? `${T.grad} text-slate-900 shadow-md` : 'bg-[#1A2126] text-slate-400 hover:text-white'}`}>
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {subTab === 'my-schedule' && (
        <div className="space-y-4 animate-[slideIn_0.2s_ease-out]">
          {events.filter(e => e.type === 'note' && e.isImportant).slice(0,1).map(alert => (
            <div key={alert.id} className="bg-gradient-to-r from-[#7A4F31]/30 to-[#1A2126] border border-[#B88764]/40 p-3 rounded-xl flex gap-3 shadow-lg">
              <Bell size={24} className="text-red-500 flex-shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase text-[#D4A381] tracking-widest block">System Alert</span>
                <p className="text-xs text-slate-200 font-medium leading-snug">{alert.title}</p>
              </div>
            </div>
          ))}
          <div className={`${T.grad} rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-[#D4A381]/30`}>
            <div className="absolute -top-4 -right-4 text-8xl font-black text-slate-900/10">86</div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900/60 mb-1">My Schedule</h3>
            {myNextShift ? (
              <div className="mb-6"><div className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">Next: {myNextShift.role}</div><div className="text-sm font-bold text-slate-900/80 flex items-center gap-1.5">{formatDisplayDate(myNextShift.date)}   {formatShortTime(myNextShift.startTime)} - {formatShortTime(myNextShift.endTime)} {myNextShift.endTime === 'CLOSE' && <span className="bg-slate-900 text-[#D4A381] text-[9px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-wider">Close</span>}</div></div>
            ) : (<div className="mb-6 text-slate-900 font-bold">No upcoming shifts scheduled.</div>)}
            
            {effectiveActivePunch ? (
              <div className="space-y-2 relative z-10">
                <button onClick={initiateClockOut} disabled={clockActionBusy} className="w-full py-4 bg-red-900/80 text-red-100 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:bg-red-800 border border-red-500/50 transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed">
                  <span>{clockActionBusy && clockActionType === 'out' ? 'CLOCKING OUT...' : 'CLOCK OUT'}</span>
                  <span className="text-[10px] text-red-300 font-medium normal-case tracking-normal">Clocked in at {new Date(effectiveActivePunch.clockInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </button>
                {appUser?.systemSettings?.breaks && (
                  effectiveActivePunch.status === 'on_break' ? (
                    <button onClick={handleEndBreak} className="w-full py-3 bg-blue-900/80 text-blue-100 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-800 border border-blue-500/50 transition-all">END BREAK</button>
                  ) : (
                    <button onClick={handleStartBreak} className="w-full py-3 bg-slate-800/50 text-slate-900 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 hover:text-white border border-slate-700 transition-all">START UNPAID BREAK</button>
                  )
                )}
              </div>
            ) : (
              <button onClick={handleClockIn} disabled={clockActionBusy} className="w-full py-4 bg-emerald-600/20 text-emerald-400 rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-600/30 border border-emerald-500/50 transition-all relative z-10 disabled:opacity-60 disabled:cursor-not-allowed">
                {clockActionBusy && clockActionType === 'in' ? 'CLOCKING IN...' : 'CLOCK IN'}
              </button>
            )}

          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSubTab('trade-board')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors relative`}>
              <Repeat size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Trade Board</span>
              {availableSwaps.length > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">{availableSwaps.length}</span>}
            </button>
            <button onClick={() => setSubTab('time-off')} className={`${T.card} p-4 flex flex-col items-center justify-center gap-2 hover:bg-[#2A353D] transition-colors`}>
              <Calendar size={24} className={T.copper}/>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Request Off</span>
            </button>
          </div>

          <div className={`${T.card} overflow-hidden mt-4`}>
            <div className={T.th}>My Month Shifts</div>
            <div className={`divide-y ${T.border}`}>
              {myMonthShifts.length === 0 ? (
                <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No shifts scheduled for you this month.</div>
              ) : (
                myMonthShifts.map(s => {
                  const isFuture = s.date >= getToday();
                  const isOffered = shiftSwaps.some(swap => swap.shiftId === s.id && swap.status === 'available');

                  return (
                    <div key={s.id} className={`${T.row} flex justify-between items-center`}>
                      <div>
                        <div className="font-bold text-white text-sm">{formatDisplayDate(s.date)}</div>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${T.copper} mt-0.5`}>{s.role}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>
                          {formatShortTime(s.startTime)} - {formatShortTime(s.endTime)}
                        </div>
                        {isFuture && (
                          isOffered ? (
                            <span className="text-[8px] font-black uppercase tracking-widest text-orange-400 bg-orange-900/20 border border-orange-900/50 px-2 py-1 rounded">Listed</span>
                          ) : (
                            <button onClick={() => handleOfferSwap(s)} className="text-[8px] font-black uppercase tracking-widest bg-[#1A2126] text-slate-300 border border-[#2A353D] hover:text-[#D4A381] hover:border-[#D4A381]/50 px-2 py-1 rounded transition-colors shadow-sm">
                              Swap
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* THE TRADE BOARD */}
      {subTab === 'trade-board' && (
        <div className="animate-[slideIn_0.2s_ease-out]">
          <div className={`${T.card} overflow-hidden`}>
            <div className={`bg-[#12161A] p-4 border-b ${T.border} flex justify-between items-center`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${T.copper}`}><Repeat size={18} /> Trade Board</h3>
              <button onClick={() => setSubTab('my-schedule')} className="text-xs font-bold text-slate-400 hover:text-white border border-[#2A353D] px-3 py-1.5 rounded-lg">Back to Dashboard</button>
            </div>
            
            <div className={`divide-y ${T.border}`}>
              {availableSwaps.length === 0 ? (
                <div className={`p-8 text-center text-sm font-bold ${T.muted}`}>No shifts currently available.</div>
              ) : (
                availableSwaps.map(swap => {
                  const isMine = swap.originalEmployeeId === appUser.id;
                  const originalEmp = users.find(u => u.id === swap.originalEmployeeId);
                  
                  return (
                    <div key={swap.id} className={`${T.row} p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                      <div>
                        <div className="font-bold text-white text-base">{formatDisplayDate(swap.date)}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#D4A381] mt-0.5">
                          {swap.role}   {formatShortTime(swap.startTime)} - {formatShortTime(swap.endTime)}
                        </div>
                        <div className="text-xs text-slate-400 font-medium mt-1">Listed by {originalEmp?.name || 'Unknown Staff'}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {isMine ? (
                          <button onClick={() => handleCancelSwap(swap.id)} className="w-full sm:w-auto px-4 py-2 bg-red-900/20 text-red-500 text-xs font-black uppercase tracking-widest rounded-lg border border-red-900/50 hover:bg-red-900/40 transition-colors">Revoke Listing</button>
                        ) : (
                          <button onClick={() => handleClaimShift(swap)} className="w-full sm:w-auto px-4 py-2 bg-emerald-900/20 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-lg border border-emerald-900/50 hover:bg-emerald-900/40 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.1)]">Claim Shift</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'full-schedule' && (
        <div className={`${T.card} overflow-hidden animate-[slideIn_0.2s_ease-out]`}>
          <div className="bg-[#12161A] p-3 border-b border-[#2A353D] flex justify-between items-center">
            <h3 className={`text-xs font-black uppercase tracking-widest ${T.copper}`}>Active Roster</h3>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{formatDisplayMonth(monthStr)}</span>
          </div>
          <div className="divide-y divide-[#2A353D]">
            {activeMonthShifts.map((shift, index) => {
               const emp = users.find(u => u.id === shift.employeeId);
               const showDivider = index === 0 || shift.date !== activeMonthShifts[index - 1].date;
               
               return (
                 <React.Fragment key={shift.id}>
                   {showDivider && (
                     <div className="bg-[#1A2126] px-3 py-2 border-y border-[#2A353D] text-[10px] font-black uppercase tracking-widest text-[#D4A381] sticky top-0 z-10 shadow-sm flex flex-wrap items-center gap-2">
                       <span>{formatDisplayDate(shift.date)}</span>
                       {getHoliday(shift.date) && <span className="bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">{getHoliday(shift.date)}</span>}
                     </div>
                   )}
                   <div className={`${T.row} hover:bg-[#12161A]`}>
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full border border-[#2A353D] bg-[#12161A] flex items-center justify-center text-xs font-black text-white uppercase">{emp?.name ? emp.name.charAt(0) : '?'}</div>
                         <div>
                           <div className="text-sm font-bold text-white">{emp?.name ? emp.name.split(' ')[0] : 'Unknown'}</div>
                           <div className={`text-[9px] ${T.muted} font-bold uppercase`}>{shift.role}</div>
                         </div>
                       </div>
                       <div className={`text-xs font-mono font-bold bg-[#12161A] ${T.copper} px-2 py-1 rounded-md border ${T.border}`}>{formatShortTime(shift.startTime)} - {formatShortTime(shift.endTime)}</div>
                     </div>
                   </div>
                 </React.Fragment>
               )
            })}
            {activeMonthShifts.length === 0 && <div className={`p-6 text-center text-xs font-bold ${T.muted}`}>No shifts published for this period.</div>}
          </div>
        </div>
      )}

      {subTab === 'month-view' && <div className="animate-[slideIn_0.2s_ease-out]"><TabMonth currentDate={currentDate} users={users} shifts={shifts} T={T} getMonthStr={getMonthStr} getDaysInMonth={getDaysInMonth} formatDisplayMonth={formatDisplayMonth} formatShortTime={formatShortTime} /></div>}
      {subTab === 'time-off' && <div className="animate-[slideIn_0.2s_ease-out]"><TabTimeOff timeOffRequests={timeOffRequests} appUser={appUser} users={users} addToast={addToast} events={events} db={db} T={T} getToday={getToday} getDaysInMonth={getDaysInMonth} formatDisplayDate={formatDisplayDate} formatShortTime={formatShortTime} getHoliday={getHoliday} formatDisplayMonth={formatDisplayMonth} /></div>}  
    </div>
  );
};

export default TabMasterSchedule;

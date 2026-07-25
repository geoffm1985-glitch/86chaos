import React, { useState } from 'react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Shield, Trash2, ChevronLeft, ChevronRight, Check } from 'lucide-react';

const TabTimeOff = ({ timeOffRequests, appUser, users, addToast, events = [], db, T, getToday, getDaysInMonth, formatDisplayDate, formatShortTime, getHoliday, formatDisplayMonth }) => {
  const [calMonth, setCalMonth] = useState(getToday().substring(0, 7)); 
  const [selectedDates, setSelectedDates] = useState([]); 
  const [isPartial, setIsPartial] = useState(false); 
  const [startTime, setStartTime] = useState('09:00'); 
  const [endTime, setEndTime] = useState('17:00');

  // Filter requests specific to the logged-in user
  const myRequests = timeOffRequests.filter(r => r.userId === appUser.id).sort((a,b) => new Date(a.date) - new Date(b.date)); 
  const myFutureRequests = myRequests.filter(r => r.date >= getToday());
  const allFutureRequests = timeOffRequests.filter(r => r.date >= getToday()).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const monthDays = Array.from({length: getDaysInMonth(calMonth)}).map((_, i) => `${calMonth}-${String(i+1).padStart(2, '0')}`); 
  const firstDayOffset = new Date(calMonth+'-01T12:00:00').getDay();

  // Pull in the events for the current calendar month
  const monthEvents = events.filter(e => e.type === 'special_event' && e.date.startsWith(calMonth));

  const changeMonth = (offset) => { 
    const d = new Date(calMonth + '-01T12:00:00'); d.setMonth(d.getMonth() + offset); setCalMonth(d.toISOString().substring(0, 7)); 
  };

  const handleToggleDate = (d) => { 
    if (d < getToday()) return addToast('Locked', 'Cannot request past dates.'); 
    
    // Check if they already requested this day
    const existingReq = myRequests.find(r => r.date === d); 
    if (existingReq) { 
      if (window.confirm(`Cancel your time-off request for ${formatDisplayDate(d)}?`)) {
        deleteDoc(doc(db, "timeOffRequests", existingReq.id));
        addToast('Canceled', 'Time off request removed.');
      }
      return; 
    } 
    
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); 
  };
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if (selectedDates.length === 0) return addToast('Error', 'Select days on the calendar first.'); 
    if (isPartial && (!startTime || !endTime)) return addToast('Error', 'Please set partial times.'); 
    
    for (const d of selectedDates) { 
      await addDoc(collection(db, "timeOffRequests"), { 
        userId: appUser.id, userName: appUser.name, date: d, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null, submittedAt: new Date().toISOString(), restaurantId: appUser.restaurantId 
      }); 
    } 
    addToast('Recorded', `Logged ${selectedDates.length} days off.`); 
    setSelectedDates([]); 
    setIsPartial(false); 
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {appUser?.isAdmin && (
        <div className={`${T.card} overflow-hidden mb-6`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
            <h3 className="font-black text-sm text-white flex items-center gap-2"><Shield size={14} className="text-red-500"/> Master Override Log</h3>
            <span className={`text-[10px] font-bold ${T.muted}`}>Delete a record to allow scheduling.</span>
          </div>
          <div className={`max-h-48 overflow-y-auto custom-scrollbar divide-y ${T.border}`}>
            {allFutureRequests.length === 0 && <div className={`p-4 text-center text-xs font-bold ${T.muted}`}>No upcoming time off for any staff.</div>}
            {allFutureRequests.map(r => (
              <div key={r.id} className={T.row}>
                <div className="flex-1">
                  <div className="font-black text-sm text-white leading-tight">{r.userName}</div>
                  <div className={`text-[10px] font-bold ${T.muted} mt-0.5`}>{formatDisplayDate(r.date)} {r.isPartial && <span className={`ml-1 text-[#D4A381] bg-[#12161A] border ${T.border} px-1 rounded`}>({formatShortTime(r.startTime)} - {formatShortTime(r.endTime)})</span>}</div>
                </div>
                <button onClick={() => { if(window.confirm("Force delete this request?")) deleteDoc(doc(db,"timeOffRequests",r.id)); }} className="text-slate-400 hover:text-red-500 p-1.5"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 ${T.card} overflow-hidden`}>
          <div className={`bg-[#12161A] p-3 border-b ${T.border} flex justify-between items-center`}>
            <button onClick={() => changeMonth(-1)} className={T.btnAlt}><ChevronLeft size={16}/></button>
            <h3 className="font-black text-base text-white tracking-tight">{formatDisplayMonth(calMonth)}</h3>
            <button onClick={() => changeMonth(1)} className={T.btnAlt}><ChevronRight size={16}/></button>
          </div>
          <div className={`grid grid-cols-7 border-t ${T.border}`}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`py-1.5 text-center text-[9px] font-black ${T.copper} uppercase border-b border-[#2A353D] bg-[#12161A]`}>{d}</div>)}
            {Array.from({length: firstDayOffset}).map((_,i) => <div key={`empty-${i}`} className={`p-1 border-b border-r ${T.border} bg-[#1A2126] min-h-[45px]`} />)}
            {monthDays.map(d => {
              const isSelected = selectedDates.includes(d); 
              const existingReq = myRequests.find(r => r.date === d); 
              const isPast = d < getToday();
              const holiday = getHoliday(d);
              const dayEvents = monthEvents.filter(e => e.date === d);

              return (
                <div key={d} onClick={() => !isPast && handleToggleDate(d)} className={`p-1 border-b border-r ${T.border} min-h-[50px] flex flex-col items-center justify-start pt-1 transition-colors ${isPast ? 'bg-[#12161A]/50 opacity-50 cursor-not-allowed' : existingReq ? 'bg-red-900/10 cursor-pointer hover:bg-red-900/20 border border-red-900/30 shadow-inner' : isSelected ? 'bg-[#8F6040]/20 border border-[#C59373] cursor-pointer shadow-inner' : 'hover:bg-[#12161A] cursor-pointer'}`}>
                  <span className={`text-xs font-black ${isSelected ? T.copper : existingReq ? 'text-red-400' : 'text-slate-300'}`}>{parseInt(d.split('-')[2])}</span>
                  
                  {holiday && <span className="text-[6px] sm:text-[7px] text-amber-500 font-bold uppercase text-center leading-tight mt-0.5 px-0.5">{holiday}</span>}
                  {dayEvents.map(ev => (
                    <span key={ev.id} className="text-[6px] sm:text-[7px] text-blue-400 font-bold uppercase text-center leading-tight mt-0.5 px-0.5 w-full truncate" title={ev.title}>
                      {ev.title}
                    </span>
                  ))}

                  {existingReq && <span className="text-[7px] font-black uppercase text-red-500 mt-auto mb-1">Off</span>}
                  {isSelected && <Check size={10} className={`mt-auto mb-1 ${T.copper}`}/>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className={`${T.card} p-4 sm:p-5 sticky top-20`}>
            <h3 className="font-black text-base mb-1 text-white">Log Availability</h3>
            <p className={`text-[10px] font-bold ${T.muted} mb-4 leading-tight`}>Tap days on the calendar to mark yourself unavailable.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className={`flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer p-2.5 bg-[#12161A] rounded-xl border ${T.border}`}>
                <input type="checkbox" checked={isPartial} onChange={e=>setIsPartial(e.target.checked)} className="w-4 h-4 rounded bg-[#1A2126] border-[#2A353D] accent-[#8F6040]" />
                Partial Day Only?
              </label>
              {isPartial && (
                <div className={`grid grid-cols-2 gap-2 p-3 bg-[#12161A] rounded-xl border ${T.border}`}>
                  <div><label className={T.label}>Start Time</label><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={T.input} required/></div>
                  <div><label className={T.label}>End Time</label><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className={T.input} required/></div>
                </div>
              )}
              <button type="submit" disabled={selectedDates.length === 0} className={`w-full ${T.btn} disabled:opacity-50 disabled:cursor-not-allowed`}>Submit {selectedDates.length > 0 ? `(${selectedDates.length})` : ''}</button>
            </form>

            {/* --- NEW SECTION: MY PENDING REQUESTS --- */}
            <div className="mt-6 pt-6 border-t border-[#2A353D]">
              <h3 className="font-black text-sm text-white mb-3">My Pending Requests</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {myFutureRequests.length === 0 && <div className="text-xs font-bold text-slate-500 text-center py-2 border border-dashed border-[#2A353D] rounded-xl">No upcoming requests.</div>}
                {myFutureRequests.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-[#12161A] p-2.5 rounded-xl border border-[#2A353D] hover:border-[#D4A381]/50 transition-colors">
                    <div>
                      <div className="text-xs font-bold text-white">{formatDisplayDate(r.date)}</div>
                      {r.isPartial ? (
                        <div className="text-[9px] text-[#D4A381] font-black uppercase tracking-wider mt-0.5">{formatShortTime(r.startTime)} - {formatShortTime(r.endTime)}</div>
                      ) : (
                        <div className="text-[9px] text-red-400 font-black uppercase tracking-wider mt-0.5">Full Day Off</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { if(window.confirm(`Cancel your request for ${formatDisplayDate(r.date)}?`)) deleteDoc(doc(db,"timeOffRequests",r.id)); }}
                      className="text-slate-400 hover:text-red-500 p-2 transition-colors bg-[#1A2126] rounded-lg border border-[#2A353D]"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TabTimeOff;

import React, { useState } from 'react';

const TabMonth = ({ currentDate, users, shifts, T, getMonthStr, getDaysInMonth, formatDisplayMonth, formatShortTime }) => {
  const [roleFilter, setRoleFilter] = useState('All');
  const uniqueRoles = ['All', ...new Set(users.map(u => u.role).filter(Boolean))].sort();

  const monthStr = getMonthStr(currentDate); 
  const firstDay = new Date(monthStr+'-01T12:00:00').getDay(); 
  const days = getDaysInMonth(monthStr);
  
  // Calculate how many weeks this month spans to perfectly stretch the grid rows on paper
  const totalCells = firstDay + days;
  const weeks = Math.ceil(totalCells / 7);

  return (
    <div className={`${T.card} overflow-hidden print-container`}>
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          body * { visibility: hidden; }
          
          /* Hijack the entire printed page */
          .print-container, .print-container * { visibility: visible; }
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            background: white !important;
            z-index: 999999 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: hidden !important; 
            page-break-inside: avoid !important;
          }
          
          .no-print { display: none !important; }
          
          /* The Header */
          .print-header { 
            display: block !important; 
            text-align: center !important; 
            font-size: 22px !important; 
            font-weight: 900 !important; 
            color: black !important; 
            margin-top: 0 !important;
            margin-bottom: 8px !important; 
            text-transform: uppercase !important; 
            height: 30px !important;
          }
          
          /* The Grid - Stretches to fill exact remaining space on the paper */
          .print-grid {
            flex-grow: 1 !important;
            display: grid !important;
            grid-template-rows: 25px repeat(${weeks}, 1fr) !important;
            border-top: 2px solid black !important;
            border-left: 2px solid black !important;
            height: calc(100vh - 45px) !important; /* Math: 100% minus the header height to prevent page 2 bleed */
            max-height: calc(100vh - 45px) !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
          }
          
          /* The Cells */
          .cell {
            border-right: 2px solid black !important;
            border-bottom: 2px solid black !important;
            background: white !important;
            color: black !important;
            min-height: 0 !important;
            padding: 3px !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          
          .cell-header-text { color: black !important; font-size: 11px !important; font-weight: 900 !important; }
          .cell-date { font-size: 13px !important; font-weight: 900 !important; color: black !important; margin-bottom: 2px !important; }
          
          /* The Shifts */
          .print-shift {
            background: #f8fafc !important;
            color: black !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 4px !important;
            padding: 1px 4px !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            margin-bottom: 2px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      
      <div className="flex justify-between items-center p-2 no-print border-b border-[#2A353D] bg-[#12161A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">Filter Role:</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] text-xs font-bold rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-inner">
            {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? 'Whole Schedule' : r}</option>)}
          </select>
        </div>
        <button onClick={()=>window.print()} className={T.btnAlt}>🖨️ Print Calendar</button>
      </div>
      
      <div className="hidden print:block print-header">
        86chaos Schedule {roleFilter !== 'All' ? `- ${roleFilter}` : ''}   {formatDisplayMonth(monthStr)}
      </div>

      <div className={`grid grid-cols-7 border-t border-l ${T.border} print-grid`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}><span className="print-text-dark cell-header-text">{d}</span></div>)}
        
        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}
        
        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`; 
          const dayShifts = shifts
            .filter(s => s.date === date && s.isPublished && (roleFilter === 'All' || s.role === roleFilter))
            .sort((a, b) => {
              if (a.role !== b.role) return (a.role || '').localeCompare(b.role || '');
              return (a.startTime || '').localeCompare(b.startTime || '');
            });
          return (
            <div key={date} className={`p-0.5 border-b border-r ${T.border} min-h-[50px] flex flex-col cell`}>
              <span className={`text-right text-[9px] font-black ${T.muted} mb-0.5 cell-date`}>{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto no-scrollbar flex-1">
                {dayShifts.map(s=>(
                  <div key={s.id} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate bg-[#12161A] border ${T.border} text-[#D4A381] print-shift`}>
                    {users.find(u=>u.id===s.employeeId)?.name.split(' ')[0]} {formatShortTime(s.startTime)}-{formatShortTime(s.endTime)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default TabMonth;

import React, { useMemo, useState } from 'react';

const escapeHtml = (value = '') => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeIdentity = (value = '') => String(value ?? '').trim().toLowerCase();

const getShiftDateKey = (shift = {}) => String(shift?.date || shift?.scheduleDateKey || shift?.shiftDate || '').trim();

const getUserIdentityKeys = (user = {}) => [
  user.id,
  user.uid,
  user.authUid,
  user.userId,
  user.accountUserId,
  user.scheduleUserId,
  user.employeeId,
  user.rosterUserId,
  user.membershipId,
  user.workspaceMemberId,
  user.email,
  user.emailLower,
  user.employeeEmail,
  user.userEmail,
  user.name,
  user.displayName,
  user.fullName
].map(normalizeIdentity).filter(Boolean);

const getShiftIdentityKeys = (shift = {}) => [
  shift.employeeId,
  shift.scheduleUserId,
  shift.rosterUserId,
  shift.userId,
  shift.uid,
  shift.authUid,
  shift.accountUserId,
  shift.staffId,
  shift.employeeEmail,
  shift.assignedEmail,
  shift.userEmail,
  shift.email,
  shift.emailLower,
  shift.employeeName,
  shift.assignedName,
  shift.userName,
  shift.name,
  shift.displayName,
  shift.fullName
].map(normalizeIdentity).filter(Boolean);

const buildUserLookup = (users = []) => {
  const lookup = new Map();
  (Array.isArray(users) ? users : []).forEach((user) => {
    getUserIdentityKeys(user).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, user);
    });
  });
  return lookup;
};

const resolveShiftUser = (shift = {}, userLookup = new Map()) => {
  for (const key of getShiftIdentityKeys(shift)) {
    if (userLookup.has(key)) return userLookup.get(key);
  }
  return null;
};

const firstName = (value = '') => String(value || '').trim().split(/\s+/)[0] || '';

const getShiftDisplayName = (shift = {}, userLookup = new Map()) => {
  const user = resolveShiftUser(shift, userLookup);
  return firstName(user?.name || user?.displayName || user?.fullName || shift.employeeName || shift.assignedName || shift.userName || shift.name || shift.displayName || shift.fullName || 'Unknown');
};

const TabMonth = ({ currentDate, users, shifts, T, getMonthStr, getDaysInMonth, formatDisplayMonth, formatShortTime }) => {
  const [roleFilter, setRoleFilter] = useState('All');
  const userLookup = useMemo(() => buildUserLookup(users), [users]);
  const uniqueRoles = useMemo(() => ['All', ...new Set((users || []).map(u => u.role).filter(Boolean))].sort(), [users]);

  const monthStr = getMonthStr(currentDate);
  const firstDay = new Date(`${monthStr}-01T12:00:00`).getDay();
  const days = getDaysInMonth(monthStr);

  // Calculate how many weeks this month spans to perfectly stretch the grid rows on paper.
  const totalCells = firstDay + days;
  const weeks = Math.ceil(totalCells / 7);

  const visibleMonthShifts = useMemo(() => {
    return (Array.isArray(shifts) ? shifts : [])
      .filter((shift) => {
        const dateKey = getShiftDateKey(shift);
        const role = shift?.role || shift?.targetRole || '';
        return dateKey.startsWith(monthStr) && shift?.isPublished === true && (roleFilter === 'All' || role === roleFilter);
      })
      .sort((a, b) => {
        const dateSort = getShiftDateKey(a).localeCompare(getShiftDateKey(b));
        if (dateSort) return dateSort;
        const roleSort = String(a.role || '').localeCompare(String(b.role || ''));
        if (roleSort) return roleSort;
        const timeSort = String(a.startTime || '').localeCompare(String(b.startTime || ''));
        if (timeSort) return timeSort;
        return getShiftDisplayName(a, userLookup).localeCompare(getShiftDisplayName(b, userLookup));
      });
  }, [shifts, monthStr, roleFilter, userLookup]);

  const shiftsByDate = useMemo(() => {
    const grouped = new Map();
    visibleMonthShifts.forEach((shift) => {
      const dateKey = getShiftDateKey(shift);
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(shift);
    });
    return grouped;
  }, [visibleMonthShifts]);

  const renderShiftText = (shift) => {
    const name = getShiftDisplayName(shift, userLookup);
    const role = String(shift.role || shift.targetRole || '').trim();
    const time = `${formatShortTime(shift.startTime)}-${formatShortTime(shift.endTime)}`;
    return `${name}${role ? ` ${role}` : ''} ${time}`;
  };

  const buildPrintableCalendarHtml = () => {
    const monthTitle = `${roleFilter !== 'All' ? `${roleFilter} - ` : ''}${formatDisplayMonth(monthStr)}`;
    const weekdayHeader = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<div class="weekday">${escapeHtml(day)}</div>`).join('');
    const blanks = Array.from({ length: firstDay }).map(() => '<div class="day blank"></div>').join('');
    const dayCells = Array.from({ length: days }).map((_, index) => {
      const dayNumber = index + 1;
      const date = `${monthStr}-${String(dayNumber).padStart(2, '0')}`;
      const dayShifts = shiftsByDate.get(date) || [];
      const shiftRows = dayShifts.map(shift => `<div class="shift">${escapeHtml(renderShiftText(shift))}</div>`).join('');
      return `<div class="day"><div class="date">${dayNumber}</div><div class="shiftStack">${shiftRows}</div></div>`;
    }).join('');
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>86 Chaos Schedule ${escapeHtml(monthTitle)}</title>
  <style>
    @page { size: landscape; margin: 0.25in; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; }
    .calendar { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; padding: 0; }
    h1 { margin: 0 0 8px; text-align: center; font-size: 20px; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.04em; }
    .meta { margin: 0 0 8px; display: flex; justify-content: space-between; gap: 12px; font-size: 10px; font-weight: 700; color: #111; }
    .grid { flex: 1 1 auto; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: 24px repeat(${weeks}, minmax(82px, 1fr)); border-top: 2px solid #000; border-left: 2px solid #000; }
    .weekday, .day { border-right: 2px solid #000; border-bottom: 2px solid #000; }
    .weekday { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; text-transform: uppercase; background: #f1f5f9; }
    .day { min-height: 82px; padding: 3px; overflow: hidden; }
    .blank { background: #f8fafc; }
    .date { text-align: right; font-size: 12px; font-weight: 900; margin-bottom: 2px; }
    .shiftStack { display: flex; flex-direction: column; gap: 1px; }
    .shift { border: 1px solid #94a3b8; border-radius: 3px; background: #f8fafc; padding: 1px 2px; font-size: 7.4px; line-height: 1.05; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: clip; color: #000; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="calendar">
    <h1>86 Chaos Schedule ${escapeHtml(monthTitle)}</h1>
    <div class="meta"><span>${escapeHtml(visibleMonthShifts.length)} published shifts</span><span>Printed ${escapeHtml(new Date().toLocaleString())}</span></div>
    <div class="grid">${weekdayHeader}${blanks}${dayCells}</div>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 150); });</script>
</body>
</html>`;
  };

  const handlePrintCalendar = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintableCalendarHtml());
    printWindow.document.close();
  };

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
            gap: 1px !important;
          }

          .cell-header-text { color: black !important; font-size: 11px !important; font-weight: 900 !important; }
          .cell-date { font-size: 13px !important; font-weight: 900 !important; color: black !important; margin-bottom: 2px !important; }

          /* The Shifts */
          .print-shift-stack {
            display: flex !important;
            flex-direction: column !important;
            gap: 1px !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          .print-shift {
            background: #f8fafc !important;
            color: black !important;
            border: 1px solid #94a3b8 !important;
            border-radius: 3px !important;
            padding: 0 2px !important;
            font-size: 7.6px !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
            margin-bottom: 0 !important;
            min-height: 0 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: clip !important;
            flex: 0 0 auto !important;
          }

          .print-day-dense .print-shift {
            border-radius: 2px !important;
            padding: 0 1px !important;
            font-size: 7px !important;
            line-height: 1 !important;
          }

          .print-shift [class~="hidden"][class~="sm:inline"] { display: inline !important; }
          .print-shift [class~="sm:hidden"] { display: none !important; }
        }
      `}</style>

      <div className="flex justify-between items-center p-2 no-print border-b border-[#2A353D] bg-[#12161A]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:inline">Filter Role:</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-[#1A2126] border border-[#2A353D] text-[#D4A381] text-xs font-bold rounded-lg px-2 py-1.5 outline-none cursor-pointer shadow-inner">
            {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? 'Whole Schedule' : r}</option>)}
          </select>
        </div>
        <button type="button" onClick={handlePrintCalendar} className={T.btnAlt}>🖨️ Print Calendar</button>
      </div>

      <div className="hidden print:block print-header">
        86chaos Schedule {roleFilter !== 'All' ? `- ${roleFilter}` : ''}   {formatDisplayMonth(monthStr)}
      </div>

      <div className={`grid grid-cols-7 border-t border-l ${T.border} print-grid`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className={`p-1 bg-[#12161A] text-center font-black text-[10px] ${T.copper} border-b border-r ${T.border} uppercase cell`}><span className="print-text-dark cell-header-text">{d}</span></div>)}

        {Array.from({length:firstDay}).map((_,i)=><div key={`e-${i}`} className={`bg-[#12161A]/50 border-b border-r ${T.border} min-h-[50px] cell`}/>)}

        {Array.from({length:days}).map((_,i)=>{
          const date = `${monthStr}-${String(i+1).padStart(2,'0')}`;
          const dayShifts = shiftsByDate.get(date) || [];
          return (
            <div key={date} className={`p-0.5 border-b border-r ${T.border} min-h-[50px] flex flex-col cell ${dayShifts.length >= 6 ? 'print-day-dense' : ''}`}>
              <span className={`text-right text-[9px] font-black ${T.muted} mb-0.5 cell-date`}>{i+1}</span>
              <div className="space-y-0.5 overflow-y-auto no-scrollbar flex-1 print-shift-stack">
                {dayShifts.map(s=>(
                  <div key={s.id || `${getShiftDateKey(s)}-${s.employeeId || s.scheduleUserId || s.employeeEmail || s.employeeName}-${s.startTime}-${s.endTime}`} className={`text-[8px] font-bold px-0.5 rounded leading-tight truncate bg-[#12161A] border ${T.border} text-[#D4A381] print-shift`}>
                    {renderShiftText(s)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabMonth;

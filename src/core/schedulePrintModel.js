const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const validMonth = value => /^\d{4}-\d{2}$/.test(String(value || ''));

export function formatScheduleTime12Hour(value) {
  const source = clean(value);
  if (!source) return '';
  const twentyFour = source.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (twentyFour) {
    const hour24 = Number(twentyFour[1]);
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${twentyFour[2]} ${hour24 < 12 ? 'AM' : 'PM'}`;
  }
  const twelveHour = source.match(/^(\d{1,2})(?::([0-5]\d))?\s*([ap])(?:\.?m\.?)?$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    if (hour >= 1 && hour <= 12) return `${hour}:${twelveHour[2] || '00'} ${twelveHour[3].toUpperCase()}M`;
  }
  return source;
}

export function buildMonthSchedulePrintModel({ monthStr, roleFilter = 'All', restaurantName = '', shifts = [], prefiltered = false }) {
  if (!validMonth(monthStr)) throw new Error('A valid schedule month is required for PDF printing.');
  const firstDay = new Date(`${monthStr}-01T12:00:00`).getDay();
  const daysInMonth = new Date(Number(monthStr.slice(0, 4)), Number(monthStr.slice(5, 7)), 0).getDate();
  const filtered = (Array.isArray(shifts) ? shifts : []).filter(shift => {
    if (!shift || !String(shift.date || '').startsWith(monthStr)) return false;
    if (prefiltered) return true;
    if (shift.deleted === true || shift.published !== true) return false;
    if (roleFilter === 'All') return true;
    if (roleFilter === 'ME') return shift.isMine === true;
    return clean(shift.role) === clean(roleFilter);
  });
  const byKey = new Map();
  filtered.forEach(shift => {
    const key = clean(shift.dedupeKey || shift.id) || JSON.stringify([clean(shift.date), clean(shift.employeeName), clean(shift.role), clean(shift.startTime), clean(shift.endTime)]);
    if (!byKey.has(key)) byKey.set(key, { ...shift, dedupeKey: key });
  });
  const visibleShifts = Array.from(byKey.values()).sort((a, b) => clean(a.date).localeCompare(clean(b.date)) || clean(a.role).localeCompare(clean(b.role)) || clean(a.startTime).localeCompare(clean(b.startTime)) || clean(a.employeeName).localeCompare(clean(b.employeeName)));
  const shiftsByDate = new Map();
  visibleShifts.forEach(shift => {
    if (!shiftsByDate.has(shift.date)) shiftsByDate.set(shift.date, []);
    const employeeName = clean(shift.employeeName) || 'Open Shift';
    const startTime = formatScheduleTime12Hour(shift.startTime);
    const endTime = formatScheduleTime12Hour(shift.endTime);
    const timeLabel = [startTime, endTime].filter(Boolean).join(' – ') || clean(shift.timeLabel);
    const role = clean(shift.role);
    shiftsByDate.get(shift.date).push({
      dedupeKey: shift.dedupeKey,
      employeeName, role,
      startTime: clean(shift.startTime), endTime: clean(shift.endTime),
      timeLabel,
      label: [employeeName, timeLabel].filter(Boolean).join(' · ')
    });
  });
  const totalCells = firstDay + daysInMonth;
  const weekCount = Math.ceil(totalCells / 7);
  const cells = [];
  for (let cellIndex = 0; cellIndex < weekCount * 7; cellIndex += 1) {
    const dayNumber = cellIndex - firstDay + 1;
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const date = inMonth ? `${monthStr}-${String(dayNumber).padStart(2, '0')}` : null;
    cells.push({ cellIndex, weekIndex: Math.floor(cellIndex / 7), weekdayIndex: cellIndex % 7, inMonth, dayNumber: inMonth ? dayNumber : null, date, shifts: date ? (shiftsByDate.get(date) || []) : [] });
  }
  const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${monthStr}-01T12:00:00Z`));
  return {
    schemaVersion: 1, page: { width: 792, height: 612, orientation: 'landscape', paper: 'US Letter' },
    restaurantName: clean(restaurantName), monthStr, monthTitle, roleFilter: clean(roleFilter) || 'All',
    weekdayHeadings: [...WEEKDAYS], firstDay, daysInMonth, weekCount, shiftCount: visibleShifts.length, cells, visibleShifts
  };
}

export { WEEKDAYS };

function pad(n) { return String(n).padStart(2, '0'); }
function isoDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseTimeToken(raw) {
  const text = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!text) return { ok: false, reason: 'blank' };
  if (text === 'close') return { ok: true, minutes: 21 * 60, meridiem: 'p', normalized: '9p', source: raw };
  const m12 = text.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)$/);
  if (m12) {
    let hour = Number(m12[1]);
    const minute = m12[2] === undefined ? 0 : Number(m12[2]);
    const meridiem = m12[3].startsWith('a') ? 'a' : 'p';
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return { ok: false, reason: 'out-of-range', source: raw };
    let h24 = hour % 12;
    if (meridiem === 'p') h24 += 12;
    return { ok: true, minutes: h24 * 60 + minute, meridiem, normalized: `${hour}${minute ? `:${pad(minute)}` : ''}${meridiem}`, source: raw };
  }
  const m24 = text.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const hour = Number(m24[1]);
    const minute = Number(m24[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return { ok: false, reason: 'out-of-range', source: raw };
    return { ok: true, minutes: hour * 60 + minute, meridiem: null, normalized: `${pad(hour)}:${pad(minute)}`, source: raw };
  }
  return { ok: false, reason: 'unrecognized', source: raw };
}

function durationForShift(startRaw, endRaw, options = {}) {
  const start = parseTimeToken(startRaw);
  const end = parseTimeToken(endRaw);
  if (!start.ok || !end.ok) return { ok: false, hours: 0, minutes: 0, reason: `bad-token:${start.reason || ''}:${end.reason || ''}`, start, end };
  let endMinutes = end.minutes;
  const crossesMidnight = end.minutes <= start.minutes;
  if (crossesMidnight) {
    if (start.meridiem === 'p' && end.meridiem === 'a') endMinutes += 24 * 60;
    else if (options.explicitOvernight === true) endMinutes += 24 * 60;
    else return { ok: false, hours: 0, minutes: 0, reason: 'invalid-range', start, end };
  }
  const minutes = endMinutes - start.minutes;
  if (minutes <= 0 || minutes > 18 * 60) return { ok: false, hours: 0, minutes: 0, reason: 'impossible-duration', start, end };
  return { ok: true, hours: minutes / 60, minutes, start, end, interval: [start.minutes, endMinutes] };
}

function mergeIntervals(intervals) {
  const sorted = intervals.filter(Boolean).map(([s, e]) => [Number(s), Number(e)]).filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const int of sorted) {
    const last = merged[merged.length - 1];
    if (!last || int[0] > last[1]) merged.push([...int]);
    else last[1] = Math.max(last[1], int[1]);
  }
  return merged;
}

function normalizeShiftKey(shift) {
  return [shift.employeeId || shift.employeeName || '', shift.date || '', String(shift.startTime || '').toLowerCase(), String(shift.endTime || '').toLowerCase(), shift.role || ''].join('|');
}

function summarizeSchedule(shifts) {
  const seen = new Set();
  const byEmployeeWeek = new Map();
  const invalid = [];
  const duplicate = [];
  const counted = [];

  for (const shift of shifts) {
    const key = normalizeShiftKey(shift);
    if (seen.has(key)) { duplicate.push(shift); continue; }
    seen.add(key);
    if (shift.kind === 'off' || shift.isOff === true || shift.type === 'off') continue;
    const date = new Date(`${shift.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) { invalid.push({ ...shift, reason: 'bad-date' }); continue; }
    const dur = durationForShift(shift.startTime, shift.endTime, shift);
    if (!dur.ok) { invalid.push({ ...shift, reason: dur.reason }); continue; }
    const weekStart = isoDate(startOfWeekMonday(date));
    const groupKey = `${shift.employeeId || shift.employeeName}|${weekStart}`;
    if (!byEmployeeWeek.has(groupKey)) byEmployeeWeek.set(groupKey, { employeeId: shift.employeeId, employeeName: shift.employeeName, weekStart, byDate: new Map() });
    const group = byEmployeeWeek.get(groupKey);
    if (!group.byDate.has(shift.date)) group.byDate.set(shift.date, []);
    group.byDate.get(shift.date).push({ shift, duration: dur });
    counted.push({ ...shift, hours: dur.hours, interval: dur.interval });
  }

  const totals = [];
  for (const group of byEmployeeWeek.values()) {
    let minutes = 0;
    const days = [];
    for (const [date, entries] of Array.from(group.byDate.entries()).sort()) {
      const merged = mergeIntervals(entries.map(e => e.duration.interval));
      const dayMinutes = merged.reduce((sum, [s, e]) => sum + e - s, 0);
      minutes += dayMinutes;
      days.push({ date, hours: dayMinutes / 60, shifts: entries.map(e => ({ startTime: e.shift.startTime, endTime: e.shift.endTime, hours: e.duration.hours })) });
    }
    totals.push({ employeeId: group.employeeId, employeeName: group.employeeName, weekStart: group.weekStart, hours: minutes / 60, days });
  }
  return { totals, invalid, duplicate, counted };
}

function buildAuditScheduleFixture(anchor = new Date()) {
  const monday = startOfWeekMonday(anchor);
  const prevMonday = addDays(monday, -7);
  const nextMonday = addDays(monday, 7);
  const allenId = 'qa-allen';
  const chuckId = 'qa-chuck';
  const laniId = 'qa-lani';
  const shifts = [
    // Allen current week, exact visible-grid truth total = 28. Invalid 10p-3p is visible but must not count.
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(monday), startTime: '3p', endTime: '9p' },
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(addDays(monday, 1)), startTime: '10a', endTime: '9p' },
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(addDays(monday, 2)), startTime: '3p', endTime: '9p' },
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(addDays(monday, 4)), startTime: '10p', endTime: '3p' },
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(addDays(monday, 5)), startTime: '4p', endTime: '9p' },
    // Duplicate should count once.
    { employeeId: chuckId, employeeName: 'Chuck QA', role: 'Bartender', date: isoDate(addDays(monday, 1)), startTime: '10a', endTime: '4p' },
    { employeeId: chuckId, employeeName: 'Chuck QA', role: 'Bartender', date: isoDate(addDays(monday, 1)), startTime: '10a', endTime: '4p' },
    // Overlap should merge to 8 total, not 11.
    { employeeId: chuckId, employeeName: 'Chuck QA', role: 'Bartender', date: isoDate(addDays(monday, 2)), startTime: '9a', endTime: '3p' },
    { employeeId: chuckId, employeeName: 'Chuck QA', role: 'Bartender', date: isoDate(addDays(monday, 2)), startTime: '1p', endTime: '5p' },
    // Real overnight should count.
    { employeeId: laniId, employeeName: 'Lani QA', role: 'Closing Cook', date: isoDate(addDays(monday, 3)), startTime: '10p', endTime: '3a' },
    // Pay-period/week boundary with previous and next weeks.
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(prevMonday), startTime: '10a', endTime: '4p' },
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(addDays(prevMonday, 1)), startTime: '10a', endTime: '4p' },
    { employeeId: allenId, employeeName: 'Allen QA', role: 'Cook', date: isoDate(nextMonday), startTime: '11a', endTime: '9p' },
  ];
  const summary = summarizeSchedule(shifts);
  return { anchor: isoDate(anchor), currentWeekStart: isoDate(monday), shifts, expected: summary };
}

function expectedHoursFor(summary, employeeName, weekStart) {
  const row = summary.totals.find(t => t.employeeName === employeeName && t.weekStart === weekStart);
  return row ? row.hours : 0;
}

module.exports = { parseTimeToken, durationForShift, mergeIntervals, summarizeSchedule, buildAuditScheduleFixture, expectedHoursFor, isoDate, addDays, startOfWeekMonday };

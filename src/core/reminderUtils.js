const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11
};

const pad = (n) => String(n).padStart(2, '0');
export const toDateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const toTimeInputValue = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();

const nextWeekdayDate = (weekday, now = new Date()) => {
  const idx = WEEKDAYS.indexOf(weekday);
  if (idx < 0) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  let delta = (idx - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
};

const parseDatePart = (text = '', now = new Date()) => {
  const q = normalize(text);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  if (/\btoday\b/.test(q)) return base;
  if (/\btonight\b/.test(q)) return base;
  if (/\btomorrow\b/.test(q)) {
    base.setDate(base.getDate() + 1);
    return base;
  }
  const slash = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : now.getFullYear();
    return new Date(year, Number(slash[1]) - 1, Number(slash[2]), 12, 0, 0, 0);
  }
  const monthName = q.match(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (monthName) {
    const d = new Date(now.getFullYear(), MONTHS[monthName[1]], Number(monthName[2]), 12, 0, 0, 0);
    if (d.getTime() < now.getTime() - 86400000) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  const weekday = WEEKDAYS.find(day => new RegExp(`\\b(next\\s+)?${day}\\b`).test(q));
  if (weekday) return nextWeekdayDate(weekday, now);
  return null;
};

const parseTimePart = (text = '') => {
  const q = normalize(text);
  if (/\b(noon|lunch)\b/.test(q)) return { hour: 12, minute: 0 };
  if (/\b(midnight)\b/.test(q)) return { hour: 0, minute: 0 };
  const match = q.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?\b/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || '').replace(/\s+/g, '');
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

const cleanReminderTitle = (text = '') => String(text || '')
  .replace(/^\s*(please\s+)?remind\s+me\s+(to\s+)?/i, '')
  .replace(/\b(today|tomorrow|tonight|next\s+sunday|next\s+monday|next\s+tuesday|next\s+wednesday|next\s+thursday|next\s+friday|next\s+saturday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig, ' ')
  .replace(/\b(at|by|on)\s+\d{1,2}(?::\d{2})?\s*(am|pm|a m|p m)?\b/ig, ' ')
  .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
  .replace(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'ig'), ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const parseReminderCommand = (input = '', now = new Date()) => {
  const raw = String(input || '').trim();
  const q = normalize(raw);
  const isReminder = /\b(remind me|personal reminder|my reminder|reminder)\b/.test(q);
  if (!isReminder) return null;
  const date = parseDatePart(q, now);
  const time = parseTimePart(q);
  const scheduled = date && time ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hour, time.minute, 0, 0) : null;
  const title = cleanReminderTitle(raw) || raw.replace(/^reminder\s*/i, '').trim() || 'Personal reminder';
  return {
    title,
    dateInput: scheduled ? toDateInputValue(scheduled) : (date ? toDateInputValue(date) : ''),
    timeInput: scheduled ? toTimeInputValue(scheduled) : '',
    scheduledAt: scheduled ? scheduled.toISOString() : '',
    needsManualTime: !scheduled,
    sourceText: raw
  };
};

export const makeReminderDate = (dateInput = '', timeInput = '') => {
  if (!dateInput || !timeInput) return null;
  const d = new Date(`${dateInput}T${timeInput}:00`);
  return Number.isFinite(d.getTime()) ? d : null;
};

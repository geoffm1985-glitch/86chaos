const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11
};

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  half: 0.5, quarter: 0.25
};

const pad = (n) => String(n).padStart(2, '0');
export const toDateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const toTimeInputValue = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const normalize = (value = '') => String(value || '').toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();

const parseAmount = (value = '') => {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return NaN;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  if (NUMBER_WORDS[raw] !== undefined) return NUMBER_WORDS[raw];
  const parts = raw.split(/[\s-]+/).filter(Boolean);
  if (parts.length === 2 && NUMBER_WORDS[parts[0]] && NUMBER_WORDS[parts[1]]) return NUMBER_WORDS[parts[0]] + NUMBER_WORDS[parts[1]];
  return NaN;
};

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

const parseRelativePart = (text = '', now = new Date()) => {
  const q = normalize(text);
  const match = q.match(/\b(?:in|after)\s+(an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|half|quarter|\d+(?:\.\d+)?)\s*(minutes?|mins?|min|hours?|hrs?|hr|days?|weeks?)\b/);
  if (!match) return null;
  let amount = /^an?$/.test(match[1]) ? 1 : parseAmount(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;
  // Kitchen speech usually means “half an hour,” even when speech-to-text drops “an.”
  if (amount < 1 && !/^hours?|hrs?|hr$/.test(unit)) amount = 1;
  const d = new Date(now.getTime());
  if (/^minutes?|mins?|min$/.test(unit)) d.setMinutes(d.getMinutes() + Math.round(amount));
  else if (/^hours?|hrs?|hr$/.test(unit)) d.setMinutes(d.getMinutes() + Math.round(amount * 60));
  else if (/^days?$/.test(unit)) d.setDate(d.getDate() + Math.round(amount));
  else if (/^weeks?$/.test(unit)) d.setDate(d.getDate() + Math.round(amount * 7));
  else return null;
  d.setSeconds(0, 0);
  return d;
};

const parseTimePart = (text = '') => {
  const q = normalize(text);
  if (/\b(noon|lunch)\b/.test(q)) return { hour: 12, minute: 0 };
  if (/\b(midnight)\b/.test(q)) return { hour: 0, minute: 0 };
  // Require a time-ish phrase so “in 20 minutes” is not misread as 8:00 PM.
  const match = q.match(/\b(?:at|by|around|about)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?\b|\b(\d{1,2})(?::(\d{2}))\s*(am|pm|a m|p m)?\b|\b(\d{1,2})\s*(am|pm|a m|p m)\b/);
  if (!match) return null;
  const hourRaw = match[1] || match[4] || match[7];
  const minuteRaw = match[2] || match[5] || '0';
  const meridiemRaw = match[3] || match[6] || match[8] || '';
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw || 0);
  const meridiem = String(meridiemRaw || '').replace(/\s+/g, '');
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && hour >= 1 && hour <= 7) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

const removeKnownDateTimePhrases = (text = '') => String(text || '')
  .replace(/\b(?:in|after)\s+(?:an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|half|quarter|\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|hours?|hrs?|hr|days?|weeks?)\b/ig, ' ')
  .replace(/\b(today|tomorrow|tonight|next\s+sunday|next\s+monday|next\s+tuesday|next\s+wednesday|next\s+thursday|next\s+friday|next\s+saturday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig, ' ')
  .replace(/\b(?:at|by|around|about)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a m|p m)?\b/ig, ' ')
  .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|a m|p m)?\b/ig, ' ')
  .replace(/\b\d{1,2}\s*(?:am|pm|a m|p m)\b/ig, ' ')
  .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
  .replace(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'ig'), ' ');

const cleanReminderTitle = (text = '') => {
  let cleaned = String(text || '')
    .replace(/^\s*(please\s+)?(?:create|add|set|make)?\s*(?:a\s+)?(?:personal\s+)?reminder\s*(?:for\s+me\s*)?(?:to\s+)?/i, ' ')
    .replace(/^\s*(please\s+)?remind\s+me\s*/i, ' ');
  cleaned = removeKnownDateTimePhrases(cleaned)
    .replace(/^\s*(to|that|about)\s+/i, ' ')
    .replace(/\s+\b(to|that|about)\s*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
};

const buildScheduledFromDateAndTime = (date, time, now = new Date(), dateWasExplicit = false) => {
  if (!time) return null;
  const base = date ? new Date(date.getTime()) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const scheduled = new Date(base.getFullYear(), base.getMonth(), base.getDate(), time.hour, time.minute, 0, 0);
  // “Remind me at 6pm” should mean the next 6pm, not a time that already passed.
  if (!dateWasExplicit && scheduled.getTime() <= now.getTime() + 30 * 1000) scheduled.setDate(scheduled.getDate() + 1);
  return scheduled;
};

export const parseReminderCommand = (input = '', now = new Date()) => {
  const raw = String(input || '').trim();
  const q = normalize(raw);
  const isReminder = /\b(remind me|personal reminder|my reminder|reminder)\b/.test(q);
  if (!isReminder) return null;

  const relative = parseRelativePart(raw, now);
  const date = parseDatePart(q, now);
  const time = parseTimePart(q);
  const dateWasExplicit = Boolean(date);
  const scheduled = relative || buildScheduledFromDateAndTime(date, time, now, dateWasExplicit);
  const dateOnly = !scheduled && date ? date : null;
  const title = cleanReminderTitle(raw) || 'Reminder';

  return {
    title,
    dateInput: scheduled ? toDateInputValue(scheduled) : (dateOnly ? toDateInputValue(dateOnly) : ''),
    timeInput: scheduled ? toTimeInputValue(scheduled) : '',
    scheduledAt: scheduled ? scheduled.toISOString() : '',
    needsManualTime: !scheduled,
    sourceText: raw,
    relativeReminder: Boolean(relative)
  };
};

export const makeReminderDate = (dateInput = '', timeInput = '') => {
  if (!dateInput || !timeInput) return null;
  const d = new Date(`${dateInput}T${timeInput}:00`);
  return Number.isFinite(d.getTime()) ? d : null;
};

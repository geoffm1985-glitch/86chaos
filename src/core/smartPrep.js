const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20
};

const PREP_UNITS = [
  'pan', 'pans', 'quart', 'quarts', 'gallon', 'gallons', 'lb', 'lbs',
  'pound', 'pounds', 'case', 'cases', 'batch', 'batches', 'tray', 'trays',
  'bucket', 'buckets', 'container', 'containers', 'order', 'orders',
  'cup', 'cups', 'bag', 'bags', 'box', 'boxes', 'bottle', 'bottles',
  'portion', 'portions', 'each', 'ea', 'item', 'items'
];

const PREP_ACTION_WORDS = [
  'slice', 'sliced', 'dice', 'diced', 'chop', 'chopped', 'cut', 'julienne',
  'shred', 'shredded', 'portion', 'portioned', 'pull', 'pulled', 'thaw',
  'thawed', 'wash', 'washed', 'rinse', 'rinsed', 'peel', 'peeled', 'mix',
  'mixed', 'batch', 'batches', 'tray', 'trayed', 'pan', 'panned', 'label',
  'labeled', 'stock', 'restock'
];

const PROTECTED_AND_PHRASES = [
  'mac and cheese',
  'salt and pepper',
  'fish and chips',
  'oil and vinegar',
  'biscuits and gravy',
  'sweet and sour',
  'peanut butter and jelly'
];

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11
};

const formatPrepDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addPrepDays = (date, days) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

const nextPrepWeekday = (weekdayIndex, now = new Date(), forceFuture = false) => {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  let delta = (weekdayIndex - base.getDay() + 7) % 7;
  if (forceFuture && delta === 0) delta = 7;
  base.setDate(base.getDate() + delta);
  return base;
};

export const parsePrepTargetDate = (input = '', now = new Date()) => {
  const raw = String(input || '');
  const q = raw.toLowerCase();
  let date = '';
  let cleanedText = raw;

  const apply = (nextDate, pattern) => {
    if (!date && nextDate) date = formatPrepDateKey(nextDate);
    if (pattern) cleanedText = cleanedText.replace(pattern, ' ');
  };

  const numericDate = q.match(/\b(?:for|on|by)?\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/i);
  if (numericDate) {
    const yearRaw = numericDate[3] ? Number(numericDate[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    apply(new Date(year, Number(numericDate[1]) - 1, Number(numericDate[2]), 12, 0, 0), new RegExp(numericDate[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }

  if (!date) {
    const monthPattern = Object.keys(MONTHS).join('|');
    const monthDate = q.match(new RegExp(`\\b(?:for|on|by)?\\s*(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i'));
    if (monthDate) {
      apply(new Date(Number(monthDate[3] || now.getFullYear()), MONTHS[monthDate[1]], Number(monthDate[2]), 12, 0, 0), new RegExp(monthDate[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  }

  if (!date && /\b(day after tomorrow)\b/i.test(q)) apply(addPrepDays(now, 2), /\b(?:for|on|by)?\s*day after tomorrow\b/i);
  if (!date && /\btomorrow\b/i.test(q)) apply(addPrepDays(now, 1), /\b(?:for|on|by)?\s*tomorrow\b/i);
  if (!date && /\b(today|tonight)\b/i.test(q)) apply(now, /\b(?:for|on|by)?\s*(today|tonight)\b/i);

  if (!date) {
    const weekdayMatch = q.match(/\b(?:for|on|by)?\s*(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (weekdayMatch) {
      const idx = WEEKDAYS.indexOf(weekdayMatch[2]);
      apply(nextPrepWeekday(idx, now, Boolean(weekdayMatch[1])), new RegExp(weekdayMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  }

  return {
    date,
    cleanedText: cleanedText.replace(/\s+/g, ' ').trim()
  };
};

export const normalizePrepText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(new RegExp(`\\b(${PREP_ACTION_WORDS.join('|')})\\b`, 'g'), ' ')
  .replace(/\b(the|a|an|of|for|to|prep|prepare|task|list|need|needs|needed|make|made|add|added|please|more|extra|another|additional)\b/g, ' ')
  .replace(/\b(pans?|quarts?|gallons?|lbs?|pounds?|cases?|batches?|trays?|buckets?|containers?|orders?|cups?|bags?|boxes?|bottles?|portions?|each|ea|items?)\b/g, ' ')
  .replace(/\b(\d+(?:\.\d+)?)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const singularize = (value = '') => String(value || '').replace(/\b([a-z]{4,})s\b/g, '$1').trim();

const titleCasePrepName = (value = '') => String(value || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map(word => word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const parseAmount = (segment = '') => {
  const numberMatch = segment.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numberMatch) return parseFloat(numberMatch[1]);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(segment)) return value;
  }
  return null;
};

const parseUnit = (segment = '') => {
  const unitPattern = PREP_UNITS.join('|');
  const match = segment.match(new RegExp(`\\b(${unitPattern})\\b`, 'i'));
  return match?.[1]?.toLowerCase() || '';
};

const stripCommandWords = (value = '') => {
  const numberWords = Object.keys(NUMBER_WORDS).join('|');
  const unitPattern = PREP_UNITS.join('|');
  const dateCleaned = parsePrepTargetDate(value).cleanedText || value;
  return String(value || '')
    .replace(value, dateCleaned)
    .toLowerCase()
    .replace(/\b(we need to|we need|need to|need|can you|could you|please|add|create|put|make|prep|prepare|task|list|prep list|to prep|to the prep list|of|for|the|a|an)\b/g, ' ')
    .replace(new RegExp(`\\b(${numberWords})\\b`, 'g'), ' ')
    .replace(new RegExp(`\\b(${unitPattern})\\b`, 'g'), ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isLikelyPrepCommand = (input = '') => {
  const q = String(input || '').toLowerCase().trim();
  if (!q) return false;
  if (/\b(prep|prepare)\b/.test(q) || /we need\s+(.+)/.test(q) || /add\s+(.+)\s+to\s+prep/.test(q)) return true;

  const actionPattern = PREP_ACTION_WORDS.join('|');
  const hasPrepAction = new RegExp(`\\b(${actionPattern})\\b`, 'i').test(q);
  const parsedName = stripCommandWords(parsePrepTargetDate(q).cleanedText || q);
  if (hasPrepAction && normalizePrepText(parsedName)) return true;

  const numberWords = Object.keys(NUMBER_WORDS).join('|');
  const unitPattern = PREP_UNITS.join('|');
  const quantityUnitPattern = new RegExp(`\\b(\\d+(?:\\.\\d+)?|${numberWords})\\b\\s+\\b(${unitPattern})\\b`, 'i');
  return quantityUnitPattern.test(q) && normalizePrepText(parsedName);
};

export const parsePrepCommandItems = (input = '') => {
  const raw = String(input || '').trim();
  if (!raw) return [];
  const targetDate = parsePrepTargetDate(raw);
  const lowered = (targetDate.cleanedText || raw).toLowerCase();
  const increment = /\b(more|extra|another|additional)\b/.test(lowered);
  let prepared = lowered
    .replace(/[;,\n]+/g, ' | ')
    .replace(/\b(to|onto|on)\s+(the\s+)?prep\s+(list|board)?\b/g, ' ')
    .replace(/\bprep\s+list\b/g, 'prep');

  PROTECTED_AND_PHRASES.forEach((phrase) => {
    prepared = prepared.replace(new RegExp(phrase, 'g'), phrase.replace(' and ', ' & '));
  });

  const segments = prepared
    .split(/\s+\|\s+|\s+\b(?:and|plus|also)\b\s+/)
    .map(segment => segment.replace(/ & /g, ' and ').trim())
    .filter(Boolean);

  let lastAmount = 1;
  let lastUnit = 'item';
  return segments.map((segment) => {
    const amount = parseAmount(segment) ?? lastAmount ?? 1;
    const unit = parseUnit(segment) || lastUnit || 'item';
    const cleanName = titleCasePrepName(stripCommandWords(segment)) || titleCasePrepName(segment);
    lastAmount = amount;
    lastUnit = unit;
    return {
      itemText: cleanName || 'Prep Task',
      amount: Math.max(0, amount || 1),
      unit: unit || 'item',
      increment,
      prepDate: targetDate.date || '',
      sourceSegment: segment
    };
  }).filter(item => item.itemText && normalizePrepText(item.itemText));
};

const getPrepMatchPriority = (item = {}, prepDate = '') => {
  const isMasterTask = item?.isMaster === true || item?.date === 'MASTER';
  const isTargetDayTask = prepDate && item?.date === prepDate;
  const isVoiceCreated = /voice/i.test(String(item?.source || item?.createdBy || item?.station || ''));

  // Prefer a real day-specific row when it was intentionally created outside 86 Voice.
  if (isTargetDayTask && !isMasterTask && !isVoiceCreated) return 5;
  // If the same task exists as a master task and as an accidental old Voice duplicate, update the master task.
  if (isMasterTask) return 4;
  if (isTargetDayTask) return isVoiceCreated ? 2 : 3;
  return 1;
};

export const findPrepMatch = (prepItems = [], parsedItem = {}, prepDate = '') => {
  const itemKey = singularize(normalizePrepText(parsedItem.itemText || ''));
  if (!itemKey) return null;
  const itemTokens = itemKey.split(' ').filter(w => w.length > 1);
  const scored = (prepItems || [])
    .filter(item => item && (item.isMaster || item.date === 'MASTER' || item.date === prepDate))
    .map(item => {
      const candidateKey = singularize(normalizePrepText(item.text || item.title || item.name || ''));
      const candidateTokens = candidateKey.split(' ').filter(w => w.length > 1);
      if (!candidateKey) return { item, score: 0, priority: 0 };
      let score = 0;
      if (candidateKey === itemKey) score = 100;
      else if (candidateKey.includes(itemKey) || itemKey.includes(candidateKey)) score = 88;
      else {
        const hits = itemTokens.filter(token => candidateTokens.includes(token) || candidateKey.includes(token));
        score = hits.length ? Math.round((hits.length / Math.max(itemTokens.length, candidateTokens.length, 1)) * 78) : 0;
        if (hits.length === itemTokens.length && itemTokens.length > 1) score += 12;
      }
      return { item, score, priority: getPrepMatchPriority(item, prepDate) };
    })
    .sort((a, b) => (b.score - a.score) || (b.priority - a.priority));
  return scored[0]?.score >= 70 ? scored[0].item : null;
};

export const buildPrepQuantityUpdate = ({ existingItem, parsedItem, actorName = '', prepDate = '', source = 'smart_prep' }) => {
  const currentQty = Number(existingItem?.qty ?? 0) || 0;
  const amount = Math.max(0, Number(parsedItem?.amount || 1) || 1);
  const nextQty = parsedItem?.increment ? currentQty + amount : amount;
  const completedOnDate = existingItem?.isMaster ? !!existingItem?.completedDates?.[prepDate] : !!existingItem?.isCompleted;
  return {
    qty: nextQty,
    unit: parsedItem?.unit && parsedItem.unit !== 'item' ? parsedItem.unit : (existingItem?.unit || parsedItem?.unit || 'item'),
    lastQuantityChangeAt: new Date().toISOString(),
    lastQuantityChangeBy: actorName || '86 Chaos',
    lastQuantityChangeSource: source,
    quantityChangedAfterCompletion: completedOnDate === true
  };
};

export const buildPrepCreatePayload = ({ parsedItem, appUser, prepDate, station = 'General', isMaster = false, sourceText = '', source = 'smart_prep' }) => ({
  restaurantId: appUser?.restaurantId,
  date: isMaster ? 'MASTER' : prepDate,
  text: parsedItem?.itemText || 'Prep Task',
  station,
  isCompleted: false,
  completedDates: {},
  isMaster,
  qty: Math.max(0, Number(parsedItem?.amount || 1) || 1),
  unit: parsedItem?.unit || 'item',
  createdAt: new Date().toISOString(),
  createdBy: appUser?.name || appUser?.email || '86 Chaos',
  createdById: appUser?.id || '',
  source,
  sourceText
});

export const formatPrepAmount = (qty, unit = 'item') => {
  const amount = Number(qty ?? 1);
  const cleanQty = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, '');
  const cleanUnit = unit && unit !== 'item' ? ` ${unit}` : '';
  return `${cleanQty}${cleanUnit}`;
};

export const summarizePrepResults = (results = []) => {
  const updated = results.filter(r => r.type === 'updated').length;
  const created = results.filter(r => r.type === 'created').length;
  const names = results.map(r => r.name).filter(Boolean).slice(0, 3).join(', ');
  const parts = [];
  if (updated) parts.push(`${updated} updated`);
  if (created) parts.push(`${created} added`);
  return `${parts.join(', ') || 'Prep updated'}${names ? `: ${names}` : ''}`;
};

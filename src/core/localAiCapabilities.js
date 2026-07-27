const DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeAiText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const toDateKey = (value = '') => {
  if (!value) return '';
  const raw = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
};

const todayKey = () => toDateKey(new Date());
const addDays = (dateKey = todayKey(), days = 0) => {
  const d = new Date(`${dateKey || todayKey()}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return toDateKey(d);
};

const num = (value, fallback = 0) => {
  const n = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

const words = (value = '') => normalizeAiText(value).split(' ').filter(w => w.length > 2);

export const classifyRestaurantText = (text = '') => {
  const q = normalizeAiText(text);
  const rows = [
    { intent: 'weather_insight', score: /\b(weather|rain|snow|storm|heat|cold|patio|forecast)\b/.test(q) ? 95 : 0 },
    { intent: 'food_data_lookup', score: /\b(nutrition|allergen|allergy|calorie|calories|barcode|ingredient info|food data)\b/.test(q) ? 92 : 0 },
    { intent: 'manager_readiness', score: /\b(ready|prepared|hurt us|needs attention|what will hurt|how do we look|service tonight|rush)\b/.test(q) ? 88 : 0 },
    { intent: 'labor_risk', score: /\b(labor|overtime|over time|staffing|coverage|too many hours|thin|short staffed)\b/.test(q) ? 86 : 0 },
    { intent: 'maintenance_risk', score: /\b(maintenance|broken|repair|equipment|leak|down|not working)\b/.test(q) ? 80 : 0 },
    { intent: 'help_search', score: /\b(help|manual|how do i|how to|where do i|explain)\b/.test(q) ? 72 : 0 }
  ].filter(row => row.score > 0).sort((a, b) => b.score - a.score);
  return rows[0] || { intent: 'unknown', score: 0 };
};

export const semanticScoreText = (query = '', candidate = '') => {
  const qTokens = words(query);
  const cTokens = words(candidate);
  if (!qTokens.length || !cTokens.length) return 0;
  const candidateText = ` ${cTokens.join(' ')} `;
  let score = 0;
  qTokens.forEach(token => {
    if (candidateText.includes(` ${token} `)) score += 18;
    else if (cTokens.some(other => other.includes(token) || token.includes(other))) score += 8;
  });
  const qText = qTokens.join(' ');
  const cText = cTokens.join(' ');
  if (cText.includes(qText)) score += 45;
  if (qTokens.length >= 2) {
    for (let i = 0; i < qTokens.length - 1; i += 1) {
      if (cText.includes(`${qTokens[i]} ${qTokens[i + 1]}`)) score += 14;
    }
  }
  return score;
};

export const rankSemanticRecords = (records = [], query = '', options = {}) => {
  const getText = options.getText || (record => [record?.title, record?.group, record?.keywords, ...(record?.body || [])].filter(Boolean).join(' '));
  const minScore = Number(options.minScore ?? 1);
  return (records || [])
    .map(record => ({ record, score: semanticScoreText(query, getText(record)) }))
    .filter(row => row.score >= minScore)
    .sort((a, b) => b.score - a.score);
};

const isOpenMaintenance = item => item && !['completed', 'closed', 'resolved', 'archived', 'done'].includes(String(item.status || '').toLowerCase());
const isOpenTask = item => item && item.isCompleted !== true && !['completed', 'closed', 'done', 'archived'].includes(String(item.status || '').toLowerCase());
const activePunch = punch => ['clocked_in', 'on_break'].includes(String(punch.status || '').toLowerCase());

export const buildOperationalReadiness = ({ inventoryItems = [], prepItems = [], tasks = [], events = [], maintenanceLogs = [], shifts = [], timePunches = [], currentDate = todayKey() } = {}) => {
  const tomorrow = addDays(currentDate, 1);
  const nextWeek = addDays(currentDate, 7);
  const lowStock = (inventoryItems || []).filter(item => num(item.parLevel) > 0 && num(item.currentStock) < num(item.parLevel)).slice(0, 6);
  const zeroStock = (inventoryItems || []).filter(item => num(item.currentStock) <= 0 && (num(item.parLevel) > 0 || item.isCritical || item.isStarred)).slice(0, 6);
  const openPrep = (prepItems || []).filter(item => (item.date === currentDate || item.prepDate === currentDate || item.date === 'MASTER') && item.isCompleted !== true).slice(0, 6);
  const openTasks = (tasks || []).filter(isOpenTask).slice(0, 6);
  const openMaintenance = (maintenanceLogs || []).filter(isOpenMaintenance).slice(0, 5);
  const upcomingEvents = (events || []).map(ev => ({ ...ev, dateKey: toDateKey(ev.date || ev.startDate || ev.createdAt) })).filter(ev => ev.dateKey && ev.dateKey >= currentDate && ev.dateKey <= nextWeek).slice(0, 5);
  const todaysShifts = (shifts || []).filter(shift => toDateKey(shift.date || shift.shiftDate) === currentDate);
  const currentPunches = (timePunches || []).filter(activePunch);
  const problems = [];
  if (zeroStock.length) problems.push(`${zeroStock.length} zero/critical stock item${zeroStock.length === 1 ? '' : 's'}: ${zeroStock.map(i => i.name || i.itemName).filter(Boolean).slice(0, 3).join(', ')}`);
  if (lowStock.length) problems.push(`${lowStock.length} below-par item${lowStock.length === 1 ? '' : 's'}: ${lowStock.map(i => i.name || i.itemName).filter(Boolean).slice(0, 3).join(', ')}`);
  if (openPrep.length) problems.push(`${openPrep.length} prep item${openPrep.length === 1 ? '' : 's'} still open today`);
  if (openTasks.length) problems.push(`${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}`);
  if (openMaintenance.length) problems.push(`${openMaintenance.length} unresolved maintenance item${openMaintenance.length === 1 ? '' : 's'}`);
  if (upcomingEvents.length) problems.push(`${upcomingEvents.length} event/special item${upcomingEvents.length === 1 ? '' : 's'} in the next week`);
  if (!todaysShifts.length) problems.push('no published shift data loaded for today');
  return {
    problems,
    severity: zeroStock.length || openMaintenance.some(m => /urgent|critical|high/i.test(String(m.priority || m.severity || ''))) ? 'high' : problems.length ? 'medium' : 'low',
    summary: problems.length
      ? `Readiness check: ${problems.slice(0, 5).join('; ')}. Open Manager Brief or Kitchen Command Center for the safest next action.`
      : `Readiness check: no obvious low-stock, prep, task, maintenance, or event pressure in the currently loaded app data.`,
    rows: [
      ...zeroStock.map(item => ({ label: item.name || item.itemName || 'Zero stock', severity: 'critical' })),
      ...lowStock.map(item => ({ label: item.name || item.itemName || 'Below par', severity: 'high' })),
      ...openPrep.map(item => ({ label: item.text || item.title || item.name || 'Open prep', severity: 'medium' })),
      ...openMaintenance.map(item => ({ label: item.title || item.equipment || item.issue || 'Maintenance', severity: item.priority || item.severity || 'medium' }))
    ].slice(0, 8),
    counts: { lowStock: lowStock.length, zeroStock: zeroStock.length, openPrep: openPrep.length, openTasks: openTasks.length, openMaintenance: openMaintenance.length, upcomingEvents: upcomingEvents.length, todaysShifts: todaysShifts.length, activePunches: currentPunches.length }
  };
};

export const buildLaborRiskSummary = ({ users = [], shifts = [], timePunches = [], currentDate = todayKey() } = {}) => {
  const todayShifts = (shifts || []).filter(shift => toDateKey(shift.date || shift.shiftDate) === currentDate);
  const activePunches = (timePunches || []).filter(activePunch);
  const userById = new Map((users || []).map(user => [String(user.id || user.uid || ''), user]));
  const missing = todayShifts.filter(shift => {
    const shiftUserId = String(shift.scheduleUserId || shift.employeeId || shift.userId || '');
    if (!shiftUserId) return false;
    return !activePunches.some(punch => String(punch.scheduleUserId || punch.employeeId || punch.userId || '') === shiftUserId);
  }).slice(0, 6);
  const unscheduledPunches = activePunches.filter(punch => {
    const punchUserId = String(punch.scheduleUserId || punch.employeeId || punch.userId || '');
    return punchUserId && !todayShifts.some(shift => String(shift.scheduleUserId || shift.employeeId || shift.userId || '') === punchUserId);
  }).slice(0, 6);
  const rows = [
    ...missing.map(shift => ({ label: shift.employeeName || userById.get(String(shift.scheduleUserId || shift.employeeId || shift.userId || ''))?.name || 'Scheduled employee', severity: 'not clocked in' })),
    ...unscheduledPunches.map(punch => ({ label: punch.employeeName || userById.get(String(punch.scheduleUserId || punch.employeeId || punch.userId || ''))?.name || 'Clocked employee', severity: 'not scheduled' }))
  ];
  const parts = [];
  if (missing.length) parts.push(`${missing.length} scheduled person${missing.length === 1 ? '' : 's'} not currently clocked in`);
  if (unscheduledPunches.length) parts.push(`${unscheduledPunches.length} active punch${unscheduledPunches.length === 1 ? '' : 'es'} without a loaded shift`);
  if (!todayShifts.length) parts.push('no loaded shift coverage for today');
  return {
    summary: parts.length ? `Labor check: ${parts.join('; ')}.` : `Labor check: current punches and loaded shifts do not show an obvious coverage mismatch.`,
    rows,
    counts: { shifts: todayShifts.length, activePunches: activePunches.length, missing: missing.length, unscheduled: unscheduledPunches.length }
  };
};

export const buildVoiceCapabilityAction = ({ raw = '', inventoryItems = [], recipes = [], users = [], prepItems = [], tasks = [], events = [], maintenanceLogs = [], shifts = [], timePunches = [], currentDate = todayKey(), appUser = {}, clientData = {} } = {}) => {
  const q = normalizeAiText(raw);
  const intent = classifyRestaurantText(raw).intent;
  if (intent === 'weather_insight') {
    return { intent: 'weather_insight', label: 'Weather-aware operations check', summary: 'Check free weather data for this restaurant and explain likely prep, patio, staffing, and vendor impact.', needsConfirmation: false, safe: true };
  }
  if (intent === 'food_data_lookup') {
    const phrase = q.replace(/\b(nutrition|allergen|allergy|calorie|calories|barcode|look up|lookup|food data|ingredient info|for|please|show|me)\b/g, ' ').trim();
    return { intent: 'food_data_lookup', label: 'Food data lookup', queryText: phrase || raw, summary: `Look up public food data for “${phrase || raw}”.`, needsConfirmation: false, safe: true };
  }
  if (intent === 'manager_readiness') {
    const readiness = buildOperationalReadiness({ inventoryItems, prepItems, tasks, events, maintenanceLogs, shifts, timePunches, currentDate });
    return { intent: 'operational_ai_summary', label: 'Readiness check', summary: readiness.summary, rows: readiness.rows, counts: readiness.counts, tab: 'today', safe: true, needsConfirmation: false };
  }
  if (intent === 'labor_risk') {
    if (!(appUser?.isSuperAdmin || appUser?.isAdmin || appUser?.permissions?.labor || appUser?.permissions?.schedule)) {
      return { intent: 'blocked', label: 'Labor voice check blocked', summary: 'Labor and schedule risk checks follow the same permissions as the app screens.', blocked: true, safe: true, needsConfirmation: false };
    }
    const labor = buildLaborRiskSummary({ users, shifts, timePunches, currentDate });
    return { intent: 'operational_ai_summary', label: 'Labor risk check', summary: labor.summary, rows: labor.rows, counts: labor.counts, tab: 'financials', safe: true, needsConfirmation: false };
  }
  if (intent === 'maintenance_risk') {
    const open = (maintenanceLogs || []).filter(isOpenMaintenance).slice(0, 6);
    return { intent: 'operational_ai_summary', label: 'Maintenance risk check', summary: open.length ? `Maintenance check: ${open.length} unresolved item${open.length === 1 ? '' : 's'}: ${open.map(item => item.equipment || item.title || item.issue || 'maintenance').slice(0, 4).join(', ')}.` : 'Maintenance check: no unresolved maintenance items are currently loaded.', rows: open.map(item => ({ label: item.equipment || item.title || item.issue || 'Maintenance', severity: item.priority || item.severity || 'open' })), tab: 'maintenance', safe: true, needsConfirmation: false };
  }
  return null;
};

export const summarizeFoodDataResults = (payload = {}, queryText = '') => {
  const products = Array.isArray(payload.products) ? payload.products : [];
  if (!products.length) return `No public food-data match found for “${queryText}”. Try a shorter item name or barcode.`;
  const top = products[0];
  const bits = [top.productName || top.name || queryText];
  if (top.brands) bits.push(top.brands);
  if (top.allergens?.length) bits.push(`allergens: ${top.allergens.join(', ')}`);
  if (top.nutritionGrade) bits.push(`nutrition grade ${top.nutritionGrade}`);
  return `Food data: ${bits.filter(Boolean).join(' • ')}. Verify labels before using for guest allergy or nutrition decisions.`;
};

export const summarizeWeatherInsights = (payload = {}) => {
  if (!payload?.ok) return payload?.error || 'Weather insight is unavailable right now.';
  const periods = Array.isArray(payload.periods) ? payload.periods : [];
  const first = periods[0] || {};
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const parts = [];
  if (first.name && first.shortForecast) parts.push(`${first.name}: ${first.shortForecast}${Number.isFinite(Number(first.temperature)) ? `, ${first.temperature}°${first.temperatureUnit || 'F'}` : ''}`);
  if (alerts.length) parts.push(`${alerts.length} weather alert${alerts.length === 1 ? '' : 's'} active`);
  if (payload.operationNote) parts.push(payload.operationNote);
  return parts.length ? `Weather check: ${parts.join('; ')}.` : 'Weather check loaded, but no operational weather signal was found.';
};

export const FREE_AI_CAPABILITY_REGISTRY = [
  { id:'voice-command-grammar', label:'86Voice command grammar', mode:'local', cost:'free', purpose:'Routes kitchen speech into safe app actions before any cloud AI is needed.' },
  { id:'browser-speech', label:'Browser speech recognition', mode:'browser', cost:'free when supported', purpose:'Lets users speak commands or type the same command when speech is unavailable.' },
  { id:'semantic-help-search', label:'Semantic-style Help search', mode:'local', cost:'free', purpose:'Uses token scoring over existing Help Center content rather than calling a model.' },
  { id:'local-text-classifier', label:'Local restaurant intent classifier', mode:'local', cost:'free', purpose:'Classifies manager questions into weather, labor, readiness, maintenance, help, or food-data checks.' },
  { id:'weather-public-data', label:'National Weather Service public weather', mode:'public-api', cost:'free public endpoint', purpose:'Adds weather-aware prep, patio, staffing, and vendor-risk context when coordinates exist.' },
  { id:'open-food-facts', label:'Open Food Facts lookup', mode:'public-api', cost:'free public endpoint', purpose:'Looks up barcode/product/allergen/nutrition hints for ingredient review.' },
  { id:'client-ocr-gateway', label:'Client OCR gateway', mode:'optional-local', cost:'free when a browser OCR provider is present', purpose:'Allows future Tesseract/browser OCR preflight without changing existing scanner behavior.' },
  { id:'cloud-ai-fallback', label:'Cloud AI fallback', mode:'optional', cost:'controlled', purpose:'Reserved for unclear/long summaries after local grammar and public data have tried first.' }
];

export const getFreeAiCapabilitySummary = () => FREE_AI_CAPABILITY_REGISTRY
  .map(cap => `${cap.label}: ${cap.purpose}`)
  .join(' ');

export const buildWeatherLocationFromRestaurant = (clientData = {}, appUser = {}) => {
  const candidates = [
    clientData?.location,
    clientData?.restaurantLocation,
    clientData?.profile,
    clientData?.restaurantProfile,
    clientData?.settings,
    clientData?.systemSettings,
    clientData,
    appUser?.restaurant,
    appUser
  ].filter(Boolean);
  for (const item of candidates) {
    const lat = item.latitude ?? item.lat ?? item.geoLat ?? item.locationLat;
    const lon = item.longitude ?? item.lng ?? item.lon ?? item.geoLng ?? item.locationLng;
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { latitude, longitude, label: item.name || item.restaurantName || appUser?.restaurantName || 'Restaurant' };
    }
  }
  return null;
};

export const tryClientSideOcr = async (file, options = {}) => {
  const provider = typeof window !== 'undefined' ? window.Tesseract : null;
  if (!provider || typeof provider.recognize !== 'function') {
    return { ok:false, unavailable:true, text:'', reason:'No local browser OCR provider is loaded. Existing secure scanner workflow remains unchanged.' };
  }
  const result = await provider.recognize(file, options.language || 'eng', options.tesseractOptions || {});
  return { ok:true, text:result?.data?.text || '', confidence:result?.data?.confidence ?? null, provider:'tesseract-browser' };
};

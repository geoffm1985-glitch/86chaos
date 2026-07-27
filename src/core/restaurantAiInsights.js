const DAY_MS = 24 * 60 * 60 * 1000;

export const toDateKey = (value = '') => {
  if (!value) return '';
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export const addDaysKey = (dateKey = '', days = 0) => {
  const base = new Date(`${dateKey || toDateKey(new Date())}T12:00:00`);
  base.setDate(base.getDate() + Number(days || 0));
  return toDateKey(base);
};

const num = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clean = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (value = '') => clean(value).replace(/\b([a-z]{4,})ies\b/g, '$1y').replace(/\b([a-z]{4,})es\b/g, '$1').replace(/\b([a-z]{4,})s\b/g, '$1');
const itemName = (item = {}) => item.name || item.itemName || item.title || item.text || item.description || '';

export const semanticScore = (query = '', text = '') => {
  const q = singular(query).split(' ').filter(w => w.length > 2);
  const t = singular(text).split(' ').filter(w => w.length > 2);
  if (!q.length || !t.length) return 0;
  const tSet = new Set(t);
  const qText = q.join(' ');
  const tText = t.join(' ');
  let score = qText === tText ? 100 : 0;
  if (qText && tText && (qText.includes(tText) || tText.includes(qText))) score += 40;
  q.forEach(token => {
    if (tSet.has(token)) score += 18;
    else if (t.some(other => other.includes(token) || token.includes(other))) score += 7;
  });
  return score;
};

export const extractRestaurantGeofenceLocation = (clientData = {}, appUser = {}) => {
  const sources = [
    clientData?.geofence,
    clientData?.clockGeofence,
    clientData?.clockSettings?.geofence,
    clientData?.clockSettings?.location,
    clientData?.settings?.geofence,
    clientData?.settings?.clockGeofence,
    clientData?.location,
    clientData?.restaurantLocation,
    clientData,
    appUser?.geofence,
    appUser?.restaurantLocation
  ].filter(Boolean);
  for (const source of sources) {
    const lat = num(source.lat ?? source.latitude ?? source.geofenceLat ?? source.clockLat ?? source.centerLat ?? source.center?.lat ?? source.center?.latitude, NaN);
    const lng = num(source.lng ?? source.lon ?? source.longitude ?? source.geofenceLng ?? source.geofenceLon ?? source.clockLng ?? source.clockLon ?? source.centerLng ?? source.centerLon ?? source.center?.lng ?? source.center?.lon ?? source.center?.longitude, NaN);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, radiusMeters: num(source.radiusMeters ?? source.radius ?? source.geofenceRadius ?? source.allowedRadiusMeters, 0), source: source === clientData ? 'restaurant_profile' : 'geofence' };
    }
  }
  const address = [clientData.address, clientData.city, clientData.state, clientData.zip, appUser.restaurantAddress].filter(Boolean).join(', ');
  return address ? { address, source: 'address', missingCoordinates: true } : null;
};

export const normalizeInvoiceLineItem = (row = {}, existingItems = []) => {
  const rawName = String(row.itemName || row.name || row.description || row.rawText || '').trim();
  let name = rawName
    .replace(/\b(?:case|cs|each|ea|lb|lbs|oz|gal|qt|pt|pack|pk|bag|can|btl)\b\s*$/i, '')
    .replace(/^\d{2,}\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const productCode = String(row.productCode || row.sku || row.pfgCode || row.itemCode || '').trim();
  const packSize = String(row.packSize || row.pack || row.size || row.uom || '').replace(/\s+/g, ' ').trim();
  const qty = num(row.quantity ?? row.qty ?? row.shippedQty ?? row.receivedQty, 0);
  const total = num(row.totalPrice ?? row.extendedPrice ?? row.lineTotal, 0);
  const unit = num(row.unitPrice ?? row.priceEach ?? row.casePrice, total && qty ? total / Math.max(1, qty) : 0);
  if (!name && rawName) name = rawName;
  const best = (existingItems || []).map(item => ({ item, score: Math.max(semanticScore(name, itemName(item)), semanticScore(productCode, item.pfgCode || item.sku || '')) }))
    .sort((a, b) => b.score - a.score)[0];
  return {
    ...row,
    itemName: name || rawName || 'Invoice line',
    productCode,
    packSize,
    quantity: qty || row.quantity || '',
    unitPrice: unit || row.unitPrice || '',
    totalPrice: total || row.totalPrice || '',
    cleanedBy: '86chaos-smart-line-cleaner',
    cleanerConfidence: best?.score >= 70 ? 'high' : best?.score >= 40 ? 'medium' : 'review',
    matchedItemId: row.matchedItemId || row.matchId || (best?.score >= 70 ? best.item.id : ''),
    matchId: row.matchId || row.matchedItemId || (best?.score >= 70 ? best.item.id : ''),
    matchName: row.matchName || (best?.score >= 70 ? itemName(best.item) : row.matchName || '')
  };
};

export const cleanInvoiceLineItems = (rows = [], existingItems = []) => (rows || []).map(row => normalizeInvoiceLineItem(row, existingItems));

const invoiceRows = (invoices = []) => {
  const rows = [];
  (invoices || []).forEach(inv => {
    const date = toDateKey(inv.invoiceDate || inv.date || inv.processedAt || inv.createdAt);
    (inv.lineItems || inv.rows || inv.invoiceRows || []).forEach(line => rows.push({ invoice: inv, date, line: normalizeInvoiceLineItem(line) }));
  });
  return rows.filter(row => row.date && row.line.itemName);
};

export const buildPriceJumpWarnings = ({ invoices = [], inventoryItems = [], thresholdPct = 12 } = {}) => {
  const rows = invoiceRows(invoices);
  const warnings = [];
  (inventoryItems || []).forEach(item => {
    const matches = rows.filter(row => {
      const line = row.line;
      return (item.id && [line.matchedItemId, line.matchId, line.itemId, line.inventoryItemId].includes(item.id)) || semanticScore(itemName(item), line.itemName) >= 58;
    }).map(row => ({ ...row, unitPrice: num(row.line.unitPrice, 0) || (num(row.line.totalPrice, 0) / Math.max(1, num(row.line.quantity, 1))) }))
      .filter(row => row.unitPrice > 0)
      .sort((a, b) => `${b.date}-${b.invoice.id || ''}`.localeCompare(`${a.date}-${a.invoice.id || ''}`));
    if (matches.length < 2) return;
    const latest = matches[0];
    const previous = matches.find(row => row.date !== latest.date) || matches[1];
    const pct = previous.unitPrice ? ((latest.unitPrice - previous.unitPrice) / previous.unitPrice) * 100 : 0;
    if (Math.abs(pct) < thresholdPct) return;
    warnings.push({
      itemId: item.id || '',
      itemName: itemName(item),
      latestPrice: latest.unitPrice,
      previousPrice: previous.unitPrice,
      latestDate: latest.date,
      previousDate: previous.date,
      changePct: pct,
      severity: pct >= 25 ? 'high' : pct >= thresholdPct ? 'medium' : 'low',
      summary: `${itemName(item)} ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(0)}% since last invoice.`
    });
  });
  return warnings.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 20);
};

export const buildScheduleRiskInsights = ({ shifts = [], timePunches = [], timeOffRequests = [], users = [], currentDate = toDateKey(new Date()) } = {}) => {
  const risks = [];
  const todayShifts = (shifts || []).filter(s => toDateKey(s.date || s.shiftDate) === currentDate && s.isDeleted !== true && s.cancelled !== true);
  const activePunches = (timePunches || []).filter(p => ['clocked_in', 'on_break'].includes(String(p.status || '').toLowerCase()));
  const pendingRequests = (timeOffRequests || []).filter(r => String(r.status || '').toLowerCase() === 'pending');
  const kitchenShifts = todayShifts.filter(s => /cook|kitchen|line|fry|prep|chef/i.test(`${s.role || ''} ${s.station || ''} ${s.department || ''}`));
  const closers = todayShifts.filter(s => /close|closer|closing/i.test(`${s.role || ''} ${s.notes || ''} ${s.shiftLabel || ''}`) || String(s.endTime || '').replace(':','') >= '2100');
  if (!todayShifts.length) risks.push({ title: 'No published shifts today', detail: 'There are no visible shifts for today. Check schedule coverage before service.', severity: 'high', tab: 'published' });
  if (kitchenShifts.length > 0 && kitchenShifts.length < 2) risks.push({ title: 'Thin kitchen coverage', detail: `${kitchenShifts.length} kitchen/line shift is visible today. Verify rush coverage.`, severity: 'medium', tab: 'published' });
  if (!closers.length && todayShifts.length) risks.push({ title: 'No closer detected', detail: 'No obvious closer was found. Confirm closing coverage before service.', severity: 'medium', tab: 'published' });
  if (activePunches.length > todayShifts.length && todayShifts.length) risks.push({ title: 'Clocked-in count exceeds schedule', detail: `${activePunches.length} active punches against ${todayShifts.length} scheduled shifts. Review labor.`, severity: 'medium', tab: 'financials' });
  if (pendingRequests.length) risks.push({ title: 'Pending time-off requests', detail: `${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'} waiting. Approve or deny before building coverage.`, severity: 'low', tab: 'published' });
  const byUser = new Map();
  (shifts || []).filter(s => toDateKey(s.date || s.shiftDate) >= addDaysKey(currentDate, -6) && toDateKey(s.date || s.shiftDate) <= currentDate).forEach(s => {
    const id = s.scheduleUserId || s.employeeId || s.userId || s.rosterUserId || s.employeeName;
    if (!id) return;
    byUser.set(id, (byUser.get(id) || 0) + 1);
  });
  const heavy = Array.from(byUser.entries()).filter(([, count]) => count >= 6).slice(0, 3);
  if (heavy.length) risks.push({ title: 'Possible overtime / fatigue', detail: `${heavy.length} employee${heavy.length === 1 ? '' : 's'} appear scheduled 6+ days in the last week.`, severity: 'medium', tab: 'financials' });
  return risks.slice(0, 8);
};

export const buildMaintenancePatternInsights = ({ maintenanceLogs = [], currentDate = toDateKey(new Date()), days = 45 } = {}) => {
  const since = addDaysKey(currentDate, -days);
  const groups = new Map();
  (maintenanceLogs || []).forEach(log => {
    const date = toDateKey(log.date || log.reportedAt || log.createdAt || log.updatedAt);
    if (!date || date < since || date > currentDate) return;
    const key = singular(log.equipment || log.assetName || log.location || log.issue || 'General');
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(log);
  });
  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length >= 3 || rows.some(row => /critical|high/i.test(String(row.urgency || row.priority || ''))))
    .map(([key, rows]) => ({
      title: `${rows[0]?.equipment || rows[0]?.assetName || key} pattern`,
      detail: `${rows.length} issue${rows.length === 1 ? '' : 's'} in ${days} days. Consider service before the next rush/weekend.`,
      severity: rows.some(row => /critical|high/i.test(String(row.urgency || row.priority || ''))) ? 'high' : 'medium',
      records: rows.slice(0, 5),
      tab: 'maintenance'
    }))
    .sort((a, b) => b.records.length - a.records.length)
    .slice(0, 8);
};

export const buildRecipeMenuInsights = ({ recipes = [], menuDependencies = [], inventoryItems = [] } = {}) => {
  const invById = new Map((inventoryItems || []).map(item => [item.id, item]));
  const activeDeps = (menuDependencies || []).filter(dep => !/deleted|archived|inactive/i.test(String(dep.status || dep.reviewStatus || dep.approvalStatus || 'active')));
  const recipeRows = (recipes || []).map(recipe => {
    const deps = activeDeps.filter(dep => [dep.recipeId, dep.menuItemId, dep.recipeName, dep.menuItemName].some(v => v && [recipe.id, recipe.title, recipe.name].includes(v)) || semanticScore(recipe.title || recipe.name, dep.recipeName || dep.menuItemName) >= 70);
    const missing = deps.filter(dep => dep.inventoryItemId && !invById.has(dep.inventoryItemId));
    const low = deps.map(dep => invById.get(dep.inventoryItemId)).filter(Boolean).filter(item => num(item.parLevel, 0) > 0 && num(item.currentStock, 0) <= Math.max(0, num(item.parLevel, 0) * 0.25));
    const allergenText = `${recipe.allergens || ''} ${recipe.ingredients || ''} ${deps.map(d => d.ingredientName || d.inventoryItemName || '').join(' ')}`;
    const allergens = ['milk','egg','fish','shellfish','tree nut','peanut','wheat','soy','sesame'].filter(word => new RegExp(`\\b${word.replace(' ', '\\s+')}s?\\b`, 'i').test(allergenText));
    return { recipeId: recipe.id || '', recipeName: recipe.title || recipe.name || 'Recipe', missing, low, allergens, dependencyCount: deps.length };
  }).filter(row => row.missing.length || row.low.length || row.allergens.length || row.dependencyCount === 0);
  return recipeRows.slice(0, 12).map(row => ({
    title: row.recipeName,
    detail: row.dependencyCount === 0 ? 'No approved ingredient links yet. Add recipe/menu dependencies so 86 alerts and costing can work.' : [
      row.missing.length ? `${row.missing.length} missing dependency link${row.missing.length === 1 ? '' : 's'}` : '',
      row.low.length ? `${row.low.length} low ingredient${row.low.length === 1 ? '' : 's'}` : '',
      row.allergens.length ? `Allergen flags: ${row.allergens.join(', ')}` : ''
    ].filter(Boolean).join(' • '),
    severity: row.missing.length || row.low.length ? 'medium' : 'low',
    tab: 'menu-intelligence'
  }));
};

export const buildPrepPredictorInsights = ({ sales = [], events = [], specials = [], wasteLogs = [], prepItems = [], inventoryItems = [], currentDate = toDateKey(new Date()), weather = null } = {}) => {
  const tomorrow = addDaysKey(currentDate, 1);
  const upcoming = (events || []).filter(ev => {
    const key = toDateKey(ev.date || ev.startDate);
    return key >= currentDate && key <= addDaysKey(currentDate, 7);
  });
  const wasteNames = new Map();
  (wasteLogs || []).filter(w => toDateKey(w.date || w.createdAt) >= addDaysKey(currentDate, -21)).forEach(w => {
    const name = w.itemName || w.name || '';
    if (!name) return;
    wasteNames.set(name, (wasteNames.get(name) || 0) + Math.max(1, num(w.qty ?? w.amount ?? w.stockDeducted, 1)));
  });
  const openPrep = (prepItems || []).filter(p => !p.isCompleted && !/done|complete/i.test(String(p.status || '')));
  const signals = [];
  if (upcoming.length) signals.push({ title: 'Event prep forecast', detail: `${upcoming.length} event${upcoming.length === 1 ? '' : 's'} in the next 7 days. Build prep around event notes, specials, and menu links.`, severity: 'medium', tab: 'prep' });
  if (openPrep.length) signals.push({ title: 'Open prep pressure', detail: `${openPrep.length} prep/task item${openPrep.length === 1 ? '' : 's'} still open. Review before service.`, severity: openPrep.length >= 8 ? 'high' : 'medium', tab: 'prep' });
  const topWaste = Array.from(wasteNames.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topWaste.length) signals.push({ title: 'Waste-aware prep', detail: `Recent waste is highest on ${topWaste.map(([name]) => name).join(', ')}. Prep tighter unless events/sales justify it.`, severity: 'low', tab: 'inventory' });
  const lowStock = (inventoryItems || []).filter(i => num(i.parLevel, 0) > 0 && num(i.currentStock, 0) < num(i.parLevel, 0)).slice(0, 5);
  if (lowStock.length) signals.push({ title: 'Prep supply check', detail: `${lowStock.length} below-par item${lowStock.length === 1 ? '' : 's'} could block prep: ${lowStock.map(itemName).slice(0, 4).join(', ')}.`, severity: 'medium', tab: 'inventory' });
  const recentSales = (sales || []).filter(s => toDateKey(s.date || s.businessDate || s.createdAt) >= addDaysKey(currentDate, -28));
  if (recentSales.length >= 7) signals.push({ title: 'Sales-history prep signal', detail: `${recentSales.length} recent sales record${recentSales.length === 1 ? '' : 's'} available. Compare same weekday before increasing prep.`, severity: 'low', tab: 'financials' });
  if (weather?.summary) signals.push({ title: 'Weather-aware prep', detail: weather.summary, severity: weather.severity || 'low', tab: 'today' });
  return signals.slice(0, 8);
};

export const buildNeedAttentionExplanation = (problem = {}) => {
  const title = problem.title || 'Needs attention';
  const detail = problem.detail || 'Review this item before service.';
  const why = /inventory|below par|86/i.test(title) ? 'Low stock can block prep, specials, and menu items during service.'
    : /maintenance|urgent/i.test(title) ? 'Equipment issues tend to get worse under rush pressure and can affect food safety or service speed.'
    : /time off|schedule|shift|closer/i.test(title) ? 'Coverage gaps become harder to fix the closer you get to service.'
    : /owner|admin/i.test(title) ? 'Owner/admin alerts usually indicate a system or data-health issue that needs review before it becomes noisy.'
    : 'This is surfaced because it can affect today’s service or manager follow-through.';
  const what = /inventory|below par|86/i.test(title) ? 'Open Inventory or AI Order, confirm stock/par, then add the item to a draft order or post an 86 alert if needed.'
    : /maintenance|urgent/i.test(title) ? 'Open Maintenance, confirm priority, assign/resolve the issue, or leave a note for the next manager.'
    : /time off|schedule|shift|closer/i.test(title) ? 'Open Time Clock & Schedule, review requests/coverage, and publish or adjust the schedule.'
    : /owner|admin/i.test(title) ? 'Open the alert details, acknowledge it after review, and only take the suggested action if it matches the restaurant’s real data.'
    : 'Open the linked area, review the source record, and take the safest small action.';
  return { title, detail, why, what, tab: problem.tab || 'today' };
};

export const buildRestaurantAiInsightBundle = (input = {}) => {
  const currentDate = input.currentDate || toDateKey(new Date());
  return {
    prepPredictions: buildPrepPredictorInsights({ ...input, currentDate }),
    scheduleRisks: buildScheduleRiskInsights({ ...input, currentDate }),
    maintenancePatterns: buildMaintenancePatternInsights({ ...input, currentDate }),
    recipeMenuInsights: buildRecipeMenuInsights(input),
    priceJumps: buildPriceJumpWarnings(input),
    geofenceLocation: extractRestaurantGeofenceLocation(input.clientData || {}, input.appUser || {})
  };
};

export const summarizeInsightBundleForVoice = (bundle = {}, topic = 'readiness') => {
  const all = [
    ...(bundle.prepPredictions || []),
    ...(bundle.scheduleRisks || []),
    ...(bundle.maintenancePatterns || []),
    ...(bundle.recipeMenuInsights || []),
    ...(bundle.priceJumps || []).map(w => ({ title: 'Price jump', detail: w.summary, severity: w.severity, tab: 'inventory' }))
  ];
  const topicRows = topic === 'labor' || topic === 'schedule' ? (bundle.scheduleRisks || [])
    : topic === 'maintenance' ? (bundle.maintenancePatterns || [])
    : topic === 'prep' ? (bundle.prepPredictions || [])
    : topic === 'prices' ? (bundle.priceJumps || []).map(w => ({ title: w.itemName, detail: w.summary, severity: w.severity, tab: 'inventory' }))
    : all;
  const rows = topicRows.slice(0, 6);
  if (!rows.length) return { summary: `No major ${topic} warning found in the currently loaded data.`, rows: [] };
  return {
    summary: rows.map(row => `${row.title}: ${row.detail}`).join(' '),
    rows: rows.map(row => ({ menuItemName: row.title, severity: row.detail || row.severity || '' }))
  };
};

export const searchHelpContentSemantically = (query = '', articles = [], chapters = []) => {
  const articleRows = (articles || []).map(article => ({ type: 'article', id: article.id, title: article.title, group: article.group, item: article, score: semanticScore(query, `${article.title} ${article.group} ${article.keywords || ''} ${(article.body || []).join(' ')}`) }));
  const chapterRows = (chapters || []).map(chapter => ({ type: 'chapter', id: chapter.id, title: chapter.title, group: chapter.group || chapter.tab || 'Training Manual', item: chapter, score: semanticScore(query, `${chapter.title} ${chapter.group || ''} ${chapter.tab || ''} ${chapter.audience || ''} ${chapter.summary || ''} ${chapter.keywords || ''} ${(chapter.sections || []).map(section => `${section.title || ''} ${(section.steps || []).join(' ')}`).join(' ')}`) }));
  return [...articleRows, ...chapterRows].filter(row => row.score >= 18).sort((a, b) => b.score - a.score).slice(0, 10);
};

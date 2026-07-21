const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (value = '') => {
  if (!value) return '';
  const raw = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const todayKey = () => toDateKey(new Date());
const addDays = (dateKey, days = 0) => {
  const d = new Date(`${dateKey || todayKey()}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return toDateKey(d);
};
const daysBetween = (startKey, endKey) => {
  const start = new Date(`${startKey || todayKey()}T12:00:00`).getTime();
  const end = new Date(`${endKey || todayKey()}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / DAY_MS);
};
const num = (value, fallback = 0) => {
  const n = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const clean = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (value = '') => clean(value).replace(/\b([a-z]{4,})ies\b/g, '$1y').replace(/\b([a-z]{4,})es\b/g, '$1').replace(/\b([a-z]{4,})s\b/g, '$1');
const words = (value = '') => singular(value).split(' ').filter(w => w.length > 2);
const titleize = (value = '') => String(value || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const textScore = (query = '', candidate = '') => {
  const q = words(query);
  const c = words(candidate);
  if (!q.length || !c.length) return 0;
  let score = 0;
  const qText = q.join(' ');
  const cText = c.join(' ');
  if (qText === cText) score += 100;
  if (qText.includes(cText) || cText.includes(qText)) score += 45;
  q.forEach(token => {
    if (c.includes(token)) score += 18;
    else if (c.some(other => other.includes(token) || token.includes(other))) score += 8;
  });
  return score;
};

const itemLabel = (item = {}) => item.name || item.itemName || item.title || item.text || '';
const eventText = (event = {}) => [event.title, event.name, event.notes, event.description, event.menu, event.menuNotes, event.type, event.category].filter(Boolean).join(' ');
const lineItemText = (line = {}) => [line.itemName, line.name, line.description, line.productCode, line.sku, line.pfgCode].filter(Boolean).join(' ');

const getItemVendor = (item = {}, vendors = []) => vendors.find(v => v.id === item.supplierId || v.id === item.vendorId || v.name === item.vendorName) || null;

const getVendorCutoffWarning = (vendor = {}, currentDate = todayKey()) => {
  if (!vendor) return '';
  const cutoffTime = vendor.cutoffTime || vendor.orderCutoffTime || '';
  const cutoffDays = Array.isArray(vendor.cutoffDays) ? vendor.cutoffDays : String(vendor.cutoffDays || vendor.orderDays || '').split(',').map(v => v.trim()).filter(Boolean);
  const method = vendor.orderMethod || vendor.preferredOrderMethod || '';
  if (!cutoffTime && !cutoffDays.length) return method ? `Order method: ${method}` : '';
  const dayText = cutoffDays.length ? cutoffDays.join(', ') : 'order day';
  return `Review by ${cutoffTime || 'cutoff'} on ${dayText}${method ? ` via ${method}` : ''}.`;
};

export const isLikelyInvoiceNoiseInventoryItem = (item = {}) => {
  const label = itemLabel(item).trim();
  if (!label) return true;
  const compact = label.toLowerCase().replace(/\s+/g, ' ').trim();
  const source = clean([item.source, item.importSource, item.scanSource, item.category, item.vendorName].filter(Boolean).join(' '));
  const obviousNoise = /\b(group total|sub total|invoice total|invoice date|customer invoice|remit to|remittance|p\.?o\.? box|shipper#?|manifest#?|driver['’]?s?|payable on or before|fuel surcharge|misc charges?|important pack provision|representative capacity|gross wt|open:\s*\d|close:\s*\d|code price|price code|qty pack size|last page|signed invoice|invoice evidences|route terms|past due balances|subject to service charge|customer number|customer invoice|purchase order|sales tax|taxable|non taxable|measure$|invoice$)\b/i;
  const categoryOnly = /^(?:dairy products|produce|poultry|canned & dry|canned dry|misc charges|tax|measure|invoice|total|subtotal|sub total|remit to|driver|route terms)$/i;
  const numericSummaryOnly = /^(?:total|sub\s*total|group\s*total|tax|t\/?wt|gross\s+wt)\b[\s*$#:\-.0-9/]*$/i;
  const weightSummaryOnly = /^\d+(?:\.\d+)?\s+(?:t\/?wt|gross\s+wt)\b/i;
  const invoiceLegalOrHeader = /^(?:important pack provision|representative capacity|route terms|cases split|qty pack size|code price|invoice date|driver:|sign delvd|manifest#?|customer invoice number)\b/i;
  const addressOrContact = /\b(?:fairfax|virginia|west jordan|utah|lee highway|suite\s+\d|p\.?o\.? box|\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})\b/i;
  const productWords = /\b(?:cheese|chicken|wing|fries|sauce|lemon|tortilla|salt|seasoning|perch|fish|carrot|salad|lettuce|tomato|onion|potato|beef|pork|bacon|ham|turkey|bread|bun|roll|milk|cream|butter|egg|flour|rice|bean|coke|syrup|coffee|tea|ranch|dip|soup|pepper|jalapeno|pickle|mushroom|oil|vinegar)\b/i;
  if (obviousNoise.test(compact) || categoryOnly.test(label) || numericSummaryOnly.test(label) || weightSummaryOnly.test(label) || invoiceLegalOrHeader.test(label)) return true;
  if (/^total\b/i.test(label) || /^sub\s*total\b/i.test(label) || /^group\s*total/i.test(label)) return true;
  if (addressOrContact.test(label) && !productWords.test(label)) return true;
  if (label.length > 96 && !item.sku && !item.pfgCode && !item.productCode && !productWords.test(label)) return true;
  if (/^(\d+[\s.\-\/]+){4,}/.test(compact)) return true;
  if (/^[\d\s.,$*-]+$/.test(compact)) return true;
  if (/^[A-Z0-9\s.,#:/&'’*\-]{18,}$/.test(label) && !productWords.test(label) && !/\b(?:CS|CASE|EA|LB|OZ|GAL|QT|PT|PACK|PK|BAG|BTL|CAN)\b/.test(label)) return true;
  if (source.includes('invoice noise') || source.includes('ocr noise')) return true;
  return false;
};

export const cleanInventoryItemDisplayName = (item = {}) => {
  const raw = itemLabel(item).trim();
  if (!raw) return '';
  let label = raw.replace(/\s+/g, ' ').trim();
  label = label.replace(/^(?:C|D)\s+/i, '');
  label = label.replace(/^(?:\d+[A-Z]?\s*){1,3}(?:ONLYS?|SCS|CS|CASE|EA|LB|OZ|GAL|QT|PT|PACK|PK|BAG|BTL|CAN|#?AVG[A-Z]*|SYS\s+CLS|IMP\/?MCC|IMPFRSH|PACKER|MORTON|BBRLCLS)\s+/i, '');
  label = label.replace(/\s+\d{5,}\s+\d{5,}(?:\s+\d+(?:\.\d{2,3})?){1,3}$/i, '');
  label = label.replace(/\s+\d{4,}(?:\s+\d+(?:\.\d{2,3})?){1,3}$/i, '');
  label = label.replace(/\s+\d+(?:\.\d{2,3})\s+\d+(?:\.\d{2,3})$/i, '');
  return label.trim() || raw;
};

const approvedDependencies = (deps = []) => (deps || []).filter(dep => {
  const status = clean(dep.status || dep.reviewStatus || dep.approvalStatus || dep.sourceStatus || 'approved');
  return !status || ['approved', 'active', 'linked', 'verified'].includes(status);
});

const getMenuImpactCount = (item = {}, deps = []) => {
  const label = itemLabel(item);
  if (!label) return 0;
  const q = singular(label);
  const seen = new Set();
  approvedDependencies(deps).forEach(dep => {
    const ing = singular(dep.inventoryItemName || dep.ingredientName || dep.ingredient || dep.sourceName || '');
    const itemId = dep.inventoryItemId || dep.inventoryId || dep.itemId || '';
    const match = (item.id && itemId === item.id) || textScore(q, ing) >= 40;
    if (match) seen.add(dep.menuItemName || dep.recipeName || dep.menuItemId || dep.id || ing);
  });
  return seen.size;
};

const getUpcomingEvents = (events = [], { currentDate = todayKey(), daysAhead = 14 } = {}) => {
  const end = addDays(currentDate, daysAhead);
  return (events || [])
    .filter(ev => ev?.date || ev?.startDate)
    .map(ev => ({ ...ev, eventDateKey: toDateKey(ev.date || ev.startDate) }))
    .filter(ev => ev.eventDateKey && ev.eventDateKey >= currentDate && ev.eventDateKey <= end)
    .sort((a, b) => `${a.eventDateKey} ${a.time || ''}`.localeCompare(`${b.eventDateKey} ${b.time || ''}`));
};

const getItemEventMatches = (item = {}, events = [], deps = []) => {
  const label = itemLabel(item);
  const depMenuNames = approvedDependencies(deps)
    .filter(dep => (item.id && [dep.inventoryItemId, dep.inventoryId, dep.itemId].includes(item.id)) || textScore(label, dep.inventoryItemName || dep.ingredientName || dep.ingredient || '') >= 40)
    .map(dep => dep.menuItemName || dep.recipeName || '')
    .filter(Boolean);
  return (events || []).map(ev => {
    const haystack = `${eventText(ev)} ${depMenuNames.join(' ')}`;
    const score = Math.max(textScore(label, haystack), ...depMenuNames.map(name => textScore(name, haystack)), 0);
    return score >= 18 ? { event: ev, score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
};

const getRecentWaste = (item = {}, wasteLogs = [], { currentDate = todayKey(), days = 30 } = {}) => {
  const since = addDays(currentDate, -days);
  return (wasteLogs || []).filter(log => {
    const key = toDateKey(log.date || log.timestamp || log.createdAt);
    if (!key || key < since || key > currentDate) return false;
    return (item.id && log.itemId === item.id) || textScore(itemLabel(item), log.itemName || '') >= 55;
  }).reduce((acc, log) => acc + num(log.stockDeducted, num(log.qty, 0)), 0);
};

const getPrepDemandScore = (item = {}, prepItems = [], { currentDate = todayKey(), daysAhead = 7 } = {}) => {
  const end = addDays(currentDate, daysAhead);
  return (prepItems || []).filter(prep => {
    const key = toDateKey(prep.date || prep.prepDate || prep.dueDate || currentDate);
    if (key && (key < currentDate || key > end)) return false;
    return textScore(itemLabel(item), prep.text || prep.title || prep.name || '') >= 35;
  }).reduce((acc, prep) => acc + Math.max(1, num(prep.qty, 1)), 0);
};

const getInvoiceRowsForItem = (item = {}, invoices = []) => {
  const label = itemLabel(item);
  const rows = [];
  (invoices || []).forEach(inv => {
    const date = toDateKey(inv.invoiceDate || inv.processedAt || inv.createdAt || inv.date);
    (inv.lineItems || inv.rows || []).forEach(row => {
      const rowLabel = lineItemText(row);
      const matched = (item.id && [row.matchedItemId, row.matchId, row.itemId, row.inventoryItemId].includes(item.id)) || textScore(label, rowLabel) >= 55;
      if (!matched) return;
      const qty = Math.max(1, num(row.quantity, num(row.qty, 1)) || 1);
      const unitPrice = num(row.unitPrice, 0) || (num(row.totalPrice, num(row.extendedPrice, 0)) / qty);
      if (unitPrice > 0) rows.push({ invoice: inv, row, date, unitPrice, qty });
    });
  });
  return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
};

const getPriceWarning = (item = {}, invoices = []) => {
  const rows = getInvoiceRowsForItem(item, invoices);
  if (rows.length < 2) return null;
  const latest = rows[0];
  const previous = rows.find(row => row.unitPrice > 0 && row.date !== latest.date) || rows[1];
  if (!previous?.unitPrice) return null;
  const changePct = ((latest.unitPrice - previous.unitPrice) / previous.unitPrice) * 100;
  if (Math.abs(changePct) < 12) return null;
  return {
    itemId: item.id,
    itemName: itemLabel(item),
    latestPrice: latest.unitPrice,
    previousPrice: previous.unitPrice,
    changePct,
    direction: changePct > 0 ? 'up' : 'down',
    latestDate: latest.date,
    previousDate: previous.date,
    summary: `${itemLabel(item)} is ${changePct > 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(0)}% from the previous invoice price.`
  };
};

export const buildAiOrderAssistant = ({ inventoryItems = [], vendors = [], wasteLogs = [], invoices = [], events = [], prepItems = [], menuDependencies = [], currentDate = todayKey(), daysAhead = 7, eventDaysAhead = 14 } = {}) => {
  const upcomingEvents = getUpcomingEvents(events, { currentDate, daysAhead: eventDaysAhead });
  const orderableItems = (inventoryItems || []).filter(item => !isLikelyInvoiceNoiseInventoryItem(item));
  const recommendations = orderableItems.map(item => {
    const par = num(item.parLevel, 0);
    const stock = num(item.currentStock, 0);
    const pending = num(item.pendingQty, 0);
    const deficit = Math.max(0, par - stock - pending);
    const menuImpactCount = getMenuImpactCount(item, menuDependencies);
    const eventMatches = getItemEventMatches(item, upcomingEvents, menuDependencies);
    const prepDemand = getPrepDemandScore(item, prepItems, { currentDate, daysAhead });
    const recentWaste = getRecentWaste(item, wasteLogs, { currentDate, days: 30 });
    const eventBoost = eventMatches.length ? Math.max(1, Math.min(3, Math.ceil(eventMatches[0].score / 60))) : 0;
    const prepBoost = prepDemand >= 4 ? 1 : 0;
    const wasteAdjustment = recentWaste >= Math.max(2, par * 0.5) ? -1 : 0;
    const suggestedQty = Math.max(0, Math.ceil(deficit + eventBoost + prepBoost + wasteAdjustment));
    const reasons = [];
    if (deficit > 0) reasons.push(`Below par by ${deficit.toFixed(2).replace(/\.00$/, '')}`);
    if (pending > 0) reasons.push(`${pending} already pending`);
    if (eventMatches.length) reasons.push(`Upcoming event signal: ${eventMatches[0].event.title || 'event'}`);
    if (prepDemand > 0) reasons.push(`Prep demand found (${prepDemand})`);
    if (menuImpactCount > 0) reasons.push(`Affects ${menuImpactCount} menu item${menuImpactCount === 1 ? '' : 's'}`);
    if (recentWaste > 0) reasons.push(`Recent burn/waste: ${recentWaste.toFixed(1).replace(/\.0$/, '')}`);
    const priorityScore = (deficit > 0 ? 50 : 0) + Math.min(45, deficit * 8) + Math.min(35, menuImpactCount * 8) + Math.min(30, eventMatches.length * 12) + Math.min(20, prepDemand * 4) - Math.min(18, recentWaste * 2);
    const priority = priorityScore >= 90 ? 'critical' : priorityScore >= 60 ? 'high' : priorityScore >= 30 ? 'medium' : 'low';
    return {
      itemId: item.id,
      item,
      itemName: itemLabel(item),
      vendor: getItemVendor(item, vendors),
      vendorId: item.supplierId || item.vendorId || '',
      vendorName: getItemVendor(item, vendors)?.name || item.vendorName || 'No Vendor',
      vendorCutoff: getItemVendor(item, vendors)?.cutoffTime || getItemVendor(item, vendors)?.orderCutoffTime || '',
      cutoffWarning: getVendorCutoffWarning(getItemVendor(item, vendors), currentDate),
      orderMethod: getItemVendor(item, vendors)?.orderMethod || getItemVendor(item, vendors)?.preferredOrderMethod || '',
      currentStock: stock,
      stock,
      par,
      pending,
      deficit,
      suggestedQty,
      packSize: item.packSize || '',
      price: num(item.price, 0),
      estimatedCost: num(item.price, 0) * suggestedQty,
      priority,
      confidence: priorityScore >= 75 ? 'high' : priorityScore >= 40 ? 'medium' : 'low',
      priorityScore,
      reasons,
      reasonTags: reasons.map(r => r.split(':')[0]).slice(0, 5),
      reviewFirst: true,
      eventMatches: eventMatches.slice(0, 3),
      menuImpactCount,
      prepDemand,
      recentWaste,
      priceWarning: getPriceWarning(item, invoices)
    };
  }).filter(row => row.suggestedQty > 0 || row.priorityScore >= 35 || row.priceWarning)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.suggestedQty - a.suggestedQty);

  const priceWarnings = recommendations.map(r => r.priceWarning).filter(Boolean);
  const eventNeeds = upcomingEvents.map(event => {
    const matches = recommendations
      .filter(rec => rec.eventMatches.some(m => m.event.id === event.id))
      .slice(0, 8);
    const rawMentions = orderableItems.map(item => {
      const score = textScore(itemLabel(item), eventText(event));
      return score >= 35 ? { item, score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 8);
    return { event, date: event.eventDateKey, items: matches, mentionedItems: rawMentions };
  }).filter(row => row.items.length || row.mentionedItems.length);

  const prepSuggestions = recommendations
    .filter(row => row.prepDemand > 0 || row.eventMatches.length || row.deficit > 0)
    .slice(0, 10)
    .map(row => ({ itemName: row.itemName, text: `Prep/check ${row.itemName}${row.eventMatches.length ? ` before ${row.eventMatches[0].event.title || 'upcoming event'}` : ''}`, reason: row.reasons.join(' • '), suggestedQty: row.suggestedQty }));

  const wasteWarnings = recommendations
    .filter(row => row.recentWaste >= Math.max(2, row.par * 0.5))
    .slice(0, 8)
    .map(row => ({ itemName: row.itemName, recentWaste: row.recentWaste, summary: `${row.itemName} has high recent waste. Review prep/par before increasing order quantity.` }));

  const vendorDrafts = groupAiOrderByVendor(recommendations);
  const top = recommendations.slice(0, 6);
  const managerBrief = [
    top.length ? `Order focus: ${top.slice(0, 3).map(r => `${r.itemName} (${r.suggestedQty})`).join(', ')}.` : 'No urgent order suggestions right now.',
    eventNeeds.length ? `Upcoming event needs detected for ${eventNeeds.slice(0, 3).map(e => e.event.title || e.date).join(', ')}.` : '',
    priceWarnings.length ? `${priceWarnings.length} invoice price warning${priceWarnings.length === 1 ? '' : 's'} need review.` : '',
    wasteWarnings.length ? `${wasteWarnings.length} item${wasteWarnings.length === 1 ? '' : 's'} have waste/par warnings.` : ''
  ].filter(Boolean);

  return { generatedAt: new Date().toISOString(), currentDate, daysAhead, eventDaysAhead, recommendations, vendorDrafts, upcomingEvents, eventNeeds, prepSuggestions, priceWarnings, wasteWarnings, managerBrief };
};

export const groupAiOrderByVendor = (recommendations = []) => {
  const map = new Map();
  (recommendations || []).filter(row => row.suggestedQty > 0).forEach(row => {
    const key = row.vendorId || row.vendorName || 'No Vendor';
    if (!map.has(key)) map.set(key, { vendorId: row.vendorId || '', vendorName: row.vendorName || 'No Vendor', vendor: row.vendor || null, items: [], total: 0 });
    const bucket = map.get(key);
    bucket.items.push(row);
    bucket.total += row.estimatedCost || 0;
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.vendorName.localeCompare(b.vendorName));
};

export const formatAiOrderDraftText = (assistant = {}, { includeReasons = true } = {}) => {
  const lines = ['86 Chaos AI Order Draft', `Generated: ${new Date(assistant.generatedAt || Date.now()).toLocaleString()}`, 'Review-first only. This draft does not send orders automatically.', ''];
  (assistant.vendorDrafts || []).forEach(group => {
    lines.push(`${group.vendorName}`);
    group.items.forEach(row => {
      lines.push(`- ${row.suggestedQty} x ${row.itemName}${row.packSize ? ` (${row.packSize})` : ''}${row.price ? ` est. $${(row.price * row.suggestedQty).toFixed(2)}` : ''}`);
      if (includeReasons && row.reasons?.length) lines.push(`  Reason: ${row.reasons.slice(0, 3).join('; ')}`);
    });
    lines.push('');
  });
  if (assistant.eventNeeds?.length) {
    lines.push('Event Supply Checks');
    assistant.eventNeeds.slice(0, 6).forEach(row => lines.push(`- ${row.event.title || 'Event'} (${row.date}): ${[...row.items.map(i => i.itemName), ...row.mentionedItems.map(m => itemLabel(m.item))].slice(0, 6).join(', ') || 'Review event notes'}`));
    lines.push('');
  }
  if (assistant.priceWarnings?.length) {
    lines.push('Invoice Price Warnings');
    assistant.priceWarnings.slice(0, 8).forEach(w => lines.push(`- ${w.summary}`));
  }
  return lines.join('\n').trim();
};

export const summarizeAiOrderAssistant = (assistant = {}) => {
  const count = assistant.recommendations?.filter(r => r.suggestedQty > 0).length || 0;
  const critical = assistant.recommendations?.filter(r => r.priority === 'critical').length || 0;
  const events = assistant.eventNeeds?.length || 0;
  const price = assistant.priceWarnings?.length || 0;
  return `${count} order suggestion${count === 1 ? '' : 's'}${critical ? `, ${critical} critical` : ''}${events ? `, ${events} event supply check${events === 1 ? '' : 's'}` : ''}${price ? `, ${price} price warning${price === 1 ? '' : 's'}` : ''}.`;
};

export const parseAiOrderingVoiceIntent = (text = '') => {
  const q = clean(text);
  if (!q) return null;
  if (/\b(what should i order|what do we need to order|build an order|order draft|suggest order|ordering assistant|ai order|smart order|low stock priority|what do we need for|supplies for|supply check)\b/.test(q)) {
    const eventish = /\b(event|party|banquet|catering|reservation|saturday|sunday|monday|tuesday|wednesday|thursday|friday|weekend|tomorrow)\b/.test(q);
    return { intent: eventish ? 'ai_event_supply_summary' : 'ai_order_summary', label: eventish ? 'AI Event Supply Check' : 'AI Order Assistant' };
  }
  const addMatch = q.match(/\b(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:the\s+)?(?:order draft|order|smart order)\b/);
  if (addMatch) return { intent: 'ai_order_add_item', itemPhrase: addMatch[1], label: `Add ${titleize(addMatch[1])} to order draft` };
  const whyMatch = q.match(/\b(?:why|explain)\s+(?:are you suggesting|suggest|order|ordering)?\s*(.+)$/);
  if (whyMatch && /\b(suggest|order|ordering|why)\b/.test(q)) return { intent: 'ai_order_explain_item', itemPhrase: whyMatch[1], label: `Explain ${titleize(whyMatch[1])}` };
  return null;
};

export default buildAiOrderAssistant;

const DAY_MS = 24 * 60 * 60 * 1000;

export const ATTENTION_SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const toStringValue = (value = '') => String(value ?? '').trim();
const lower = (value = '') => toStringValue(value).toLowerCase();
const num = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const dateKey = (value = '') => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};
const todayKey = () => dateKey(new Date());
const addDays = (baseKey, days = 0) => {
  const date = new Date(`${baseKey || todayKey()}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return dateKey(date);
};
const hoursFromNow = (value) => {
  if (!value) return null;
  const raw = value?.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(raw.getTime())) return null;
  return (raw.getTime() - Date.now()) / (60 * 60 * 1000);
};
const clean = (value = '') => lower(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const textScore = (a = '', b = '') => {
  const left = clean(a);
  const right = clean(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  let score = 0;
  if (left.includes(right) || right.includes(left)) score += 45;
  const aw = left.split(' ').filter(w => w.length > 2);
  const bw = right.split(' ').filter(w => w.length > 2);
  aw.forEach(w => {
    if (bw.includes(w)) score += 16;
    else if (bw.some(x => x.includes(w) || w.includes(x))) score += 7;
  });
  return score;
};
const unique = (items = []) => Array.from(new Set(items.filter(Boolean)));
const firstDate = (item = {}) => dateKey(item.date || item.createdAt || item.updatedAt || item.reportedAt || item.dueDate || item.invoiceDate || item.processedAt);
const itemName = (item = {}) => item.name || item.itemName || item.title || item.text || item.inventoryItemName || 'Item';
const roleKey = (value = '') => clean(value || 'unassigned');
const openStatus = (status = '') => !['done', 'complete', 'completed', 'closed', 'resolved', 'dismissed', 'cancelled', 'canceled', 'archived'].includes(lower(status));

export const makeAttentionCard = (card = {}) => ({
  id: card.id || `${card.source || 'unknown'}:${card.area || 'general'}:${clean(card.title || card.detail || Math.random())}`,
  source: card.source || '86chaos',
  area: card.area || 'Operations',
  title: card.title || 'Needs attention',
  detail: card.detail || '',
  reason: card.reason || card.detail || '',
  suggestedAction: card.suggestedAction || 'Open the related tool and review it.',
  severity: ['critical', 'high', 'medium', 'low'].includes(card.severity) ? card.severity : 'medium',
  tab: card.tab || 'today',
  focus: card.focus || '',
  primaryActionLabel: card.primaryActionLabel || 'Open',
  secondaryActionLabel: card.secondaryActionLabel || '',
  relatedIds: Array.isArray(card.relatedIds) ? card.relatedIds.filter(Boolean) : [],
  restaurantId: card.restaurantId || '',
  createdAt: card.createdAt || card.generatedAt || new Date().toISOString(),
  generatedAt: card.generatedAt || new Date().toISOString(),
  urgencyAt: card.urgencyAt || card.dueAt || '',
  permissionKey: card.permissionKey || '',
  usefulness: Number(card.usefulness ?? 50)
});

export const sortAttentionCards = (cards = []) => cards.slice().sort((a, b) => {
  const severity = (ATTENTION_SEVERITY_RANK[a.severity] ?? 2) - (ATTENTION_SEVERITY_RANK[b.severity] ?? 2);
  if (severity !== 0) return severity;
  const aHours = hoursFromNow(a.urgencyAt || a.createdAt);
  const bHours = hoursFromNow(b.urgencyAt || b.createdAt);
  if (aHours !== null && bHours !== null && Math.abs(aHours - bHours) > 0.01) return aHours - bHours;
  return Number(b.usefulness || 0) - Number(a.usefulness || 0);
});

export const dedupeAttentionCards = (cards = []) => {
  const byKey = new Map();
  sortAttentionCards(cards).forEach(card => {
    const key = [card.restaurantId, card.source, card.area, clean(card.title), clean(card.focus || card.detail), (card.relatedIds || []).slice(0, 2).join('|')].join('::');
    if (!byKey.has(key)) byKey.set(key, card);
  });
  return sortAttentionCards(Array.from(byKey.values()));
};

const hasAccess = (permissions = {}, key) => !key || permissions[key] !== false;
const affectedMenuItems = (inventoryItem = {}, menuDependencies = []) => {
  const hits = new Map();
  (menuDependencies || []).forEach(dep => {
    const depInventoryId = dep.inventoryItemId || dep.inventoryId || dep.itemId || '';
    const depName = dep.inventoryItemName || dep.ingredientName || dep.ingredient || '';
    const matches = (inventoryItem.id && depInventoryId === inventoryItem.id) || textScore(itemName(inventoryItem), depName) >= 45;
    if (!matches) return;
    const name = dep.menuItemName || dep.recipeName || dep.dishName || dep.name || '';
    if (name) hits.set(clean(name), name);
  });
  return Array.from(hits.values()).slice(0, 8);
};

export const buildSetupQuality = ({ clientData = {}, users = [], shifts = [], sales = [], inventoryItems = [], vendors = [], invoices = [], recipes = [], menuDependencies = [], events = [], rosterRoles = [], pushTokens = [], currentDate = todayKey() } = {}) => {
  const activeUsers = (users || []).filter(u => u?.isActive !== false);
  const inventoryWithPars = (inventoryItems || []).filter(i => num(i.parLevel, 0) > 0);
  const mappedInventoryIds = new Set((menuDependencies || []).map(d => d.inventoryItemId || d.inventoryId || d.itemId).filter(Boolean));
  const approvedLinks = (menuDependencies || []).filter(d => !d.status || ['approved', 'active', 'linked', 'verified'].includes(lower(d.status)));
  const open86 = (events || []).filter(e => lower(e.messageCategory) === '86 alert' && lower(e.status || 'open') !== 'resolved');
  const currentMonth = currentDate.slice(0, 7);
  const recentSales = (sales || []).filter(s => dateKey(s.date || s.createdAt).slice(0, 7) >= currentMonth || (sales || []).length < 12);
  const pct = (done, total) => total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
  const menuPct = pct(approvedLinks.length, Math.max(1, (recipes || []).length || approvedLinks.length || 1));
  const parPct = pct(inventoryWithPars.length, Math.max(1, (inventoryItems || []).filter(i => itemName(i)).length));
  const vendorPct = pct((vendors || []).filter(v => v.name || v.vendorName).length, Math.max(1, Math.min(6, (inventoryItems || []).length ? 3 : 1)));
  const rosterPct = pct((rosterRoles || []).filter(r => r.name || r.label).length || unique(activeUsers.map(u => u.role)).length, Math.max(1, 4));
  const salesReady = recentSales.length >= 7 ? 'ready' : recentSales.length >= 1 ? 'partial' : 'needs sales';
  const aiReady = inventoryWithPars.length && (vendors || []).length ? 'ready' : inventoryWithPars.length ? 'partial / needs vendors' : 'needs inventory pars';
  const laborReady = activeUsers.length && (shifts || []).length && recentSales.length ? 'ready' : activeUsers.length && (shifts || []).length ? 'partial / needs sales' : 'needs team and schedule';
  return {
    menuIntelligencePct: menuPct,
    inventoryParPct: parPct,
    vendorPct,
    rosterRolePct: rosterPct,
    salesData: salesReady,
    laborForecast: laborReady,
    aiOrdering: aiReady,
    alertReadiness: open86.length || inventoryWithPars.length ? 'ready' : 'needs inventory/par setup',
    pushReadiness: pushTokens.length ? 'ready' : 'partial / device opt-in needed',
    items: [
      { label: 'Restaurant profile', done: Boolean(clientData?.name || clientData?.restaurantName), tab: 'settings', focus: 'profile', reason: 'Names, owner info, and workspace settings make reports clear.' },
      { label: 'Team members', done: activeUsers.length > 1, tab: 'team', focus: 'staff', reason: 'Staff records power schedule, labor, tips, and permissions.' },
      { label: 'Roster roles', done: rosterPct >= 50, tab: 'settings', focus: 'roles', reason: 'Roster Roles are the source of truth for labor and scheduling logic.' },
      { label: 'Schedule published', done: (shifts || []).some(s => s.isPublished && dateKey(s.date) >= currentDate), tab: 'schedule', focus: 'builder', reason: 'Published shifts unlock coverage and labor warnings.' },
      { label: 'Sales history', done: recentSales.length > 0, tab: 'financials', focus: 'sales-import', reason: 'Sales history improves labor, prep, and ordering signals.' },
      { label: 'Inventory items', done: (inventoryItems || []).length > 0, tab: 'inventory', focus: 'items', reason: 'Inventory drives 86 risk and ordering review.' },
      { label: 'Par levels', done: parPct >= 50, tab: 'inventory', focus: 'belowPar', reason: 'Pars tell the app what actually needs attention.' },
      { label: 'Vendors', done: (vendors || []).length > 0, tab: 'inventory', focus: 'vendors', reason: 'Vendors and cutoffs make order recommendations useful.' },
      { label: 'Invoices/history', done: (invoices || []).length > 0, tab: 'inventory', focus: 'invoices', reason: 'Invoice history unlocks price-jump warnings.' },
      { label: 'Recipes/menu', done: (recipes || []).length > 0, tab: 'recipes', focus: 'recipes', reason: 'Recipes help staff execute and support menu intelligence.' },
      { label: 'Menu dependencies', done: menuPct >= 40, tab: 'menu-intelligence', focus: 'mapping', reason: 'Ingredient links let 86 alerts show menu impact.' },
      { label: '86 alert readiness', done: inventoryWithPars.length > 0, tab: 'inventory', focus: 'belowPar', reason: 'The app needs items and pars before it can spot 86 risk.' },
      { label: 'AI ordering readiness', done: aiReady === 'ready', tab: 'inventory', focus: 'aiOrder', reason: 'AI ordering works best with pars, vendors, invoices, and sales.' },
      { label: 'Push readiness', done: pushTokens.length > 0, tab: 'settings', focus: 'notifications', reason: 'Push lets urgent alerts reach the right people quickly.' },
      { label: 'Permissions setup', done: activeUsers.some(u => u.permissions && Object.keys(u.permissions).length), tab: 'team', focus: 'permissions', reason: 'Permissions keep staff out of owner/admin areas.' }
    ]
  };
};

const buildInventoryCards = ({ inventoryItems = [], menuDependencies = [], restaurantId = '', permissions = {} } = {}) => {
  if (!hasAccess(permissions, 'inventory')) return [];
  const cards = [];
  (inventoryItems || []).forEach(item => {
    const stock = num(item.currentStock ?? item.stock ?? item.quantity, 0);
    const par = num(item.parLevel ?? item.par ?? item.targetPar, 0);
    if (par <= 0 && stock > 0) return;
    const impacts = affectedMenuItems(item, menuDependencies);
    const itemLabel = itemName(item);
    if (stock <= 0) {
      cards.push(makeAttentionCard({
        id: `zero-stock:${item.id || clean(itemLabel)}`,
        source: 'inventory', area: 'Inventory', restaurantId,
        title: `${itemLabel} is out or at zero`,
        detail: impacts.length ? `Affects ${impacts.slice(0, 3).join(', ')}${impacts.length > 3 ? ` and ${impacts.length - 3} more` : ''}.` : 'Staff may need an 86 alert before service.',
        reason: 'Current stock is zero. Verify the count, post/confirm an 86 alert, and review any order draft.',
        suggestedAction: impacts.length ? 'Review menu impact and order draft.' : 'Confirm whether this item should be 86’d.',
        severity: 'critical', tab: 'inventory', focus: 'belowPar', primaryActionLabel: 'Review order draft', relatedIds: [item.id], usefulness: 98
      }));
    } else if (par > 0 && stock < par) {
      const deficit = Math.max(0, par - stock);
      cards.push(makeAttentionCard({
        id: `below-par:${item.id || clean(itemLabel)}`,
        source: 'inventory', area: 'Inventory', restaurantId,
        title: `${itemLabel} is below par`,
        detail: impacts.length ? `Stock ${stock}/${par}. Affects ${impacts.slice(0, 2).join(', ')}${impacts.length > 2 ? ` and ${impacts.length - 2} more` : ''}.` : `Stock ${stock}/${par}. Suggested review: order ${deficit}.`,
        reason: 'This item is under the level the restaurant says it needs to run service.',
        suggestedAction: 'Review order draft before the next vendor cutoff.',
        severity: stock <= par * 0.35 ? 'high' : 'medium', tab: 'inventory', focus: 'aiOrder', primaryActionLabel: 'Review order draft', relatedIds: [item.id], usefulness: 86
      }));
    }
  });
  return cards;
};

const buildEightySixCards = ({ events = [], inventoryItems = [], menuDependencies = [], restaurantId = '', permissions = {} } = {}) => {
  if (!hasAccess(permissions, 'messages')) return [];
  return (events || [])
    .filter(e => lower(e.messageCategory) === '86 alert' || /^86\b|86 alert/i.test(String(e.title || '')))
    .filter(e => lower(e.status || 'open') !== 'resolved')
    .slice(0, 12)
    .map(e => {
      const inventoryItem = inventoryItems.find(i => i.id && i.id === e.inventoryItemId);
      const impacts = e.menuImpactItems?.length ? e.menuImpactItems : (inventoryItem ? affectedMenuItems(inventoryItem, menuDependencies) : []);
      return makeAttentionCard({
        id: `86-alert:${e.id || clean(e.title)}`,
        source: 'events', area: '86 Alerts', restaurantId,
        title: e.title || `86 alert: ${e.inventoryItemName || e.requestedItemName || 'item'}`,
        detail: impacts.length ? `Menu impact: ${impacts.slice(0, 4).join(', ')}${impacts.length > 4 ? ` and ${impacts.length - 4} more` : ''}.` : (e.notes || 'Staff should acknowledge before service.'),
        reason: lower(e.status) === 'acknowledged' ? 'This 86 alert is acknowledged but still not resolved.' : 'Open 86 alerts should be acknowledged by staff and cleared by a manager when fixed.',
        suggestedAction: lower(e.status) === 'acknowledged' ? 'Resolve it when the item is back or keep it posted.' : 'Have staff acknowledge it, then resolve when fixed.',
        severity: 'high', tab: 'messages', focus: '86-alerts', primaryActionLabel: 'Open Message Board', relatedIds: [e.id, e.inventoryItemId], createdAt: e.date || e.createdAt, usefulness: 95
      });
    });
};

const buildMaintenanceCards = ({ maintenanceLogs = [], restaurantId = '', permissions = {} } = {}) => {
  if (!hasAccess(permissions, 'maintenance')) return [];
  const open = (maintenanceLogs || []).filter(m => openStatus(m.status));
  const cards = [];
  open.filter(m => ['critical', 'urgent', 'high'].includes(lower(m.urgency || m.priority))).slice(0, 5).forEach(m => cards.push(makeAttentionCard({
    id: `maintenance:${m.id || clean(m.equipment || m.issue)}`,
    source: 'maintenance', area: 'Maintenance', restaurantId,
    title: `${m.equipment || 'Equipment'} needs attention`, detail: m.issue || m.notes || 'High priority maintenance is open.',
    reason: 'Urgent equipment problems can slow service or become safety issues.', suggestedAction: 'Open the maintenance log and assign/resolve the issue.',
    severity: lower(m.urgency) === 'critical' ? 'critical' : 'high', tab: 'maintenance', focus: 'urgent', primaryActionLabel: 'Open Maintenance', relatedIds: [m.id], createdAt: m.reportedAt || m.createdAt, usefulness: 82
  })));
  open.filter(m => m.nextDueDate && dateKey(m.nextDueDate) <= todayKey()).slice(0, 5).forEach(m => cards.push(makeAttentionCard({
    id: `pm-overdue:${m.id || clean(m.title || m.equipment)}`,
    source: 'maintenance', area: 'Maintenance', restaurantId,
    title: `Preventive maintenance overdue: ${m.title || m.equipment || 'item'}`, detail: `Due ${dateKey(m.nextDueDate)}.`,
    reason: 'Preventive maintenance is overdue and can create bigger failures during service.', suggestedAction: 'Schedule or complete the preventive maintenance task.',
    severity: 'medium', tab: 'maintenance', focus: 'preventive', primaryActionLabel: 'Open Maintenance', relatedIds: [m.id], urgencyAt: m.nextDueDate, usefulness: 62
  })));
  return cards;
};

const buildPrepTaskCards = ({ prepItems = [], tasks = [], currentDate = todayKey(), restaurantId = '', permissions = {} } = {}) => {
  if (!hasAccess(permissions, 'prep')) return [];
  const prepOpen = (prepItems || []).filter(p => !p.isCompleted && !p.completed && (dateKey(p.date || p.prepDate) === currentDate || p.isMaster || p.date === 'MASTER'));
  const taskOpen = (tasks || []).filter(t => openStatus(t.status) && !t.isCompleted && !t.completed && (!t.dueDate || dateKey(t.dueDate) <= currentDate));
  const cards = [];
  if (prepOpen.length >= 4) cards.push(makeAttentionCard({
    id: 'prep-open-pressure', source: 'prep', area: 'Prep', restaurantId,
    title: `${prepOpen.length} prep items are still open`, detail: `Top item: ${itemName(prepOpen[0])}.`, reason: 'Open prep before service creates line pressure and missed handoffs.', suggestedAction: 'Open the prep plan and knock down the most important items first.', severity: prepOpen.length >= 10 ? 'high' : 'medium', tab: 'prep', focus: 'plan', primaryActionLabel: 'Open Prep Plan', relatedIds: prepOpen.slice(0, 8).map(p => p.id), usefulness: 73
  }));
  if (taskOpen.length >= 3) cards.push(makeAttentionCard({
    id: 'tasks-open-pressure', source: 'tasks', area: 'Tasks', restaurantId,
    title: `${taskOpen.length} task/routine items need follow-up`, detail: `Top item: ${itemName(taskOpen[0])}.`, reason: 'Overdue tasks pile up and make closing/opening harder.', suggestedAction: 'Open Prep & Tasks and assign or complete the oldest items.', severity: 'medium', tab: 'prep', focus: 'tasks', primaryActionLabel: 'Open Tasks', relatedIds: taskOpen.slice(0, 8).map(t => t.id), usefulness: 55
  }));
  return cards;
};

const buildScheduleLaborCards = ({ users = [], shifts = [], timePunches = [], timeOffRequests = [], shiftSwaps = [], sales = [], currentDate = todayKey(), restaurantId = '', permissions = {}, rosterRoles = [] } = {}) => {
  const canSchedule = hasAccess(permissions, 'schedule');
  const canLabor = hasAccess(permissions, 'labor');
  if (!canSchedule && !canLabor) return [];
  const cards = [];
  const activeUsers = (users || []).filter(u => u.isActive !== false);
  const activeIds = new Set(activeUsers.flatMap(u => [u.id, u.uid, u.authUid, u.userId].filter(Boolean)));
  const todayShifts = (shifts || []).filter(s => dateKey(s.date) === currentDate && s.cancelled !== true && s.isDeleted !== true && (!s.employeeId || activeIds.has(s.employeeId)));
  const published = todayShifts.filter(s => s.isPublished);
  const activePunches = (timePunches || []).filter(p => ['clocked_in', 'on_break'].includes(lower(p.status)));
  const scheduledIds = new Set(published.map(s => s.employeeId).filter(Boolean));
  if (canSchedule && !published.length) cards.push(makeAttentionCard({ id: 'no-published-shifts-today', source: 'schedule', area: 'Schedule', restaurantId, title: 'No published shifts today', detail: 'Staff may not see a schedule for today.', reason: 'Published shifts drive staff schedule views, coverage checks, and labor expectations.', suggestedAction: 'Open Schedule Builder and publish today’s coverage.', severity: 'high', tab: 'schedule', focus: 'builder', primaryActionLabel: 'Open Schedule', usefulness: 78 }));
  if (canSchedule && (timeOffRequests || []).some(r => lower(r.status) === 'pending')) {
    const pending = (timeOffRequests || []).filter(r => lower(r.status) === 'pending');
    cards.push(makeAttentionCard({ id: 'pending-time-off', source: 'schedule', area: 'Schedule', restaurantId, title: `${pending.length} time-off request${pending.length === 1 ? '' : 's'} pending`, detail: 'Pending requests can affect published schedules.', reason: 'A request can leave coverage thin if it is approved after the schedule is built.', suggestedAction: 'Review time-off requests before changing the schedule.', severity: 'medium', tab: 'schedule', focus: 'time-off', primaryActionLabel: 'Review Requests', relatedIds: pending.slice(0, 8).map(r => r.id), usefulness: 64 }));
  }
  if (canSchedule && (shiftSwaps || []).some(s => ['available', 'pending'].includes(lower(s.status)) && dateKey(s.date) >= currentDate)) {
    const swaps = (shiftSwaps || []).filter(s => ['available', 'pending'].includes(lower(s.status)) && dateKey(s.date) >= currentDate);
    cards.push(makeAttentionCard({ id: 'shift-trades-open', source: 'schedule', area: 'Schedule', restaurantId, title: `${swaps.length} shift trade${swaps.length === 1 ? '' : 's'} open`, detail: 'Trade board has shifts waiting for action.', reason: 'Open trades can leave managers surprised when coverage changes.', suggestedAction: 'Open the schedule/trade board and approve or reject trades.', severity: 'low', tab: 'published', focus: 'trade-board', primaryActionLabel: 'Open Trade Board', relatedIds: swaps.slice(0, 8).map(s => s.id), usefulness: 38 }));
  }
  if (canLabor && activePunches.length) {
    const unscheduledPunches = activePunches.filter(p => p.employeeId && !scheduledIds.has(p.employeeId));
    if (unscheduledPunches.length) cards.push(makeAttentionCard({ id: 'clocked-in-not-scheduled', source: 'labor', area: 'Labor', restaurantId, title: `${unscheduledPunches.length} active punch${unscheduledPunches.length === 1 ? '' : 'es'} without today’s schedule match`, detail: 'Someone is clocked in but not matched to a published shift.', reason: 'Clocked-in-not-scheduled punches can affect labor cost and payroll review.', suggestedAction: 'Open Labor and review the punch/schedule match.', severity: 'medium', tab: 'labor', focus: 'punches', primaryActionLabel: 'Open Labor', relatedIds: unscheduledPunches.slice(0, 8).map(p => p.id), usefulness: 72 }));
    const longPunches = activePunches.filter(p => {
      const started = p.clockInTime || p.startedAt || p.createdAt;
      const d = started?.toDate ? started.toDate() : new Date(started || 0);
      return Number.isFinite(d.getTime()) && (Date.now() - d.getTime()) / DAY_MS > 0.55;
    });
    if (longPunches.length) cards.push(makeAttentionCard({ id: 'long-open-punch', source: 'labor', area: 'Labor', restaurantId, title: `${longPunches.length} long open punch${longPunches.length === 1 ? '' : 'es'} need review`, detail: 'A clock-in may be missing a clock-out.', reason: 'Long open punches can distort payroll and labor reporting.', suggestedAction: 'Open Labor and fix missing clock-outs.', severity: 'high', tab: 'labor', focus: 'open-punches', primaryActionLabel: 'Review Punches', relatedIds: longPunches.slice(0, 8).map(p => p.id), usefulness: 88 }));
  }
  if (canLabor && published.length) {
    const nowHour = new Date().getHours();
    const unclocked = published.filter(s => {
      const start = Number(String(s.startTime || '99:00').slice(0, 2));
      return start <= nowHour && s.employeeId && !activePunches.some(p => p.employeeId === s.employeeId);
    });
    if (unclocked.length) cards.push(makeAttentionCard({ id: 'scheduled-not-clocked-in', source: 'labor', area: 'Labor', restaurantId, title: `${unclocked.length} scheduled staff not clocked in`, detail: 'A scheduled shift should already be active.', reason: 'Late/missing punches can mean coverage problems or payroll cleanup later.', suggestedAction: 'Open Labor or Schedule to verify coverage.', severity: 'medium', tab: 'labor', focus: 'attendance', primaryActionLabel: 'Open Labor', relatedIds: unclocked.slice(0, 8).map(s => s.id), usefulness: 67 }));
  }
  const roleNames = (rosterRoles || []).map(r => r.name || r.label).filter(Boolean);
  const lineRoles = roleNames.length ? roleNames.filter(r => /cook|line|prep|kitchen|expo|dish/i.test(r)) : ['cook', 'line', 'prep', 'kitchen'];
  const dinnerShifts = published.filter(s => {
    const role = s.role || activeUsers.find(u => u.id === s.employeeId)?.role || '';
    const isLine = lineRoles.some(r => roleKey(role).includes(roleKey(r)) || roleKey(r).includes(roleKey(role)));
    const start = String(s.startTime || '00:00');
    const end = String(s.endTime || '00:00');
    return isLine && start <= '19:00' && end >= '17:00';
  });
  const sameWeekdaySales = (sales || []).filter(s => new Date(`${dateKey(s.date)}T12:00:00`).getDay() === new Date(`${currentDate}T12:00:00`).getDay()).map(s => num(s.netSales || s.grossSales, 0)).filter(Boolean);
  const avgSales = sameWeekdaySales.length ? sameWeekdaySales.reduce((a, b) => a + b, 0) / sameWeekdaySales.length : 0;
  if (canSchedule && published.length && dinnerShifts.length <= 1) cards.push(makeAttentionCard({ id: 'thin-dinner-coverage', source: 'schedule', area: 'Schedule', restaurantId, title: 'Dinner coverage looks thin', detail: `${dinnerShifts.length || 0} line/prep role${dinnerShifts.length === 1 ? '' : 's'} scheduled between 5 PM and 7 PM.${avgSales ? ` Same-weekday sales average is about $${Math.round(avgSales).toLocaleString()}.` : ' Add sales history for stronger forecasting.'}`, reason: 'Friday/dinner rushes need enough line/prep coverage. This uses Roster Roles when configured.', suggestedAction: 'Open Schedule Builder and review peak coverage.', severity: 'medium', tab: 'schedule', focus: 'coverage', primaryActionLabel: 'Open Schedule', relatedIds: dinnerShifts.map(s => s.id), usefulness: 70 }));
  return cards;
};

const latestInvoiceRows = (invoices = []) => {
  const rows = [];
  (invoices || []).forEach(inv => {
    const invDate = dateKey(inv.invoiceDate || inv.date || inv.processedAt || inv.createdAt);
    (inv.lineItems || inv.rows || inv.items || []).forEach(row => {
      const name = row.itemName || row.name || row.description || row.productName || '';
      const qty = Math.max(1, num(row.quantity || row.qty, 1));
      const unitPrice = num(row.unitPrice, 0) || (num(row.totalPrice || row.extendedPrice || row.amount, 0) / qty);
      if (name && unitPrice > 0) rows.push({ ...row, name, invoiceId: inv.id, vendorName: inv.vendorName || inv.vendor || row.vendorName || '', date: invDate, unitPrice });
    });
  });
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
};

const buildAiOrderingCards = ({ aiOrderAssistant = {}, invoices = [], restaurantId = '', permissions = {} } = {}) => {
  if (!hasAccess(permissions, 'aiOrdering')) return [];
  const cards = [];
  const recommendations = (aiOrderAssistant.recommendations || []).filter(r => num(r.suggestedQty, 0) > 0).slice(0, 5);
  recommendations.forEach(row => cards.push(makeAttentionCard({ id: `ai-order:${row.itemId || clean(row.itemName)}`, source: 'aiOrdering', area: 'AI Ordering', restaurantId, title: `Review order: ${row.itemName || 'item'}`, detail: `Stock ${row.currentStock ?? '?'} / Par ${row.par ?? '?'}. Suggested ${row.suggestedQty}. ${(row.vendorName || row.vendor) ? `Vendor: ${row.vendorName || row.vendor}. ` : ''}${row.cutoffWarning || row.reasons?.[0] || 'Review before ordering.'}`, reason: (row.reasonTags || row.reasons || []).slice(0, 3).join(' • ') || 'The item appears below par or demand is expected.', suggestedAction: 'Review the draft. 86 Chaos will not send the order automatically.', severity: row.confidence === 'low' ? 'medium' : 'high', tab: 'inventory', focus: 'aiOrder', primaryActionLabel: 'Review AI Order', relatedIds: [row.itemId], usefulness: 84 })));
  (aiOrderAssistant.priceWarnings || []).slice(0, 4).forEach(row => cards.push(makeAttentionCard({ id: `price-warning:${clean(row.itemName || row.name)}`, source: 'invoicePriceWatch', area: 'Invoices', restaurantId, title: `Invoice price jump: ${row.itemName || row.name || 'item'}`, detail: row.summary || row.detail || 'Latest invoice price is meaningfully above recent history.', reason: 'Price changes should be reviewed before they affect food cost or order decisions.', suggestedAction: 'Open invoice review and confirm the item/cost.', severity: 'medium', tab: 'inventory', focus: 'invoices', primaryActionLabel: 'Review Invoice', usefulness: 68 })));
  const rows = latestInvoiceRows(invoices);
  const byName = new Map();
  rows.forEach(row => {
    const key = clean(row.name);
    if (!key) return;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  });
  Array.from(byName.entries()).slice(0, 80).forEach(([key, rowsForItem]) => {
    if (rowsForItem.length < 3) return;
    const latest = rowsForItem[0];
    const prev = rowsForItem.slice(1, 6);
    const avg = prev.reduce((s, r) => s + r.unitPrice, 0) / Math.max(1, prev.length);
    if (avg > 0 && latest.unitPrice > avg * 1.15) cards.push(makeAttentionCard({ id: `invoice-jump:${key}`, source: 'invoicePriceWatch', area: 'Invoices', restaurantId, title: `Invoice price jump detected`, detail: `${latest.name} is up ${Math.round(((latest.unitPrice - avg) / avg) * 100)}% from recent invoice history.`, reason: 'This can change food cost and order decisions.', suggestedAction: 'Review invoice pricing before approving the order.', severity: 'medium', tab: 'inventory', focus: 'invoices', primaryActionLabel: 'Review Invoice', relatedIds: [latest.invoiceId], usefulness: 65 }));
  });
  return cards;
};

export const buildNeedsAttentionCards = (input = {}) => {
  const permissions = input.permissions || {};
  const restaurantId = input.restaurantId || input.appUser?.restaurantId || input.clientData?.id || '';
  const setupQuality = input.setupQuality || buildSetupQuality({ ...input, currentDate: input.currentDate || todayKey() });
  const cards = [
    ...buildInventoryCards({ ...input, restaurantId, permissions }),
    ...buildEightySixCards({ ...input, restaurantId, permissions }),
    ...buildMaintenanceCards({ ...input, restaurantId, permissions }),
    ...buildPrepTaskCards({ ...input, restaurantId, permissions }),
    ...buildScheduleLaborCards({ ...input, restaurantId, permissions }),
    ...buildAiOrderingCards({ ...input, restaurantId, permissions })
  ];
  if (hasAccess(permissions, 'adminAlerts')) {
    (input.restaurantAdminAlerts || []).filter(a => openStatus(a.status)).slice(0, 5).forEach(alert => cards.push(makeAttentionCard({ id: `admin-alert:${alert.id || clean(alert.title)}`, source: 'ownerAdminAlerts', area: 'Owner/Admin', restaurantId, title: alert.title || 'Owner/admin alert needs review', detail: alert.detail || alert.message || 'Review the scan recommendation before changing data.', reason: 'System/Python findings are alert-only and need owner/admin review.', suggestedAction: 'Open the alert and acknowledge or resolve it.', severity: lower(alert.severity) === 'critical' ? 'critical' : 'medium', tab: 'today', focus: 'owner-admin-alerts', primaryActionLabel: 'Review Alert', relatedIds: [alert.id], usefulness: 75 })));
  }
  if (setupQuality.inventoryParPct < 50 && hasAccess(permissions, 'inventory')) cards.push(makeAttentionCard({ id: 'setup-gap-inventory-pars', source: 'setupQuality', area: 'Setup', restaurantId, title: 'Inventory setup is not smart yet', detail: `Only ${setupQuality.inventoryParPct}% of inventory items have par levels.`, reason: 'The app cannot reliably know what needs ordering until pars are set.', suggestedAction: 'Open Inventory and add par levels to common items.', severity: 'low', tab: 'inventory', focus: 'belowPar', primaryActionLabel: 'Set Pars', usefulness: 34 }));
  if (setupQuality.menuIntelligencePct < 40 && hasAccess(permissions, 'menuIntelligence')) cards.push(makeAttentionCard({ id: 'setup-gap-menu-mapping', source: 'setupQuality', area: 'Setup', restaurantId, title: 'Menu impact needs more mapping', detail: `Menu Intelligence is about ${setupQuality.menuIntelligencePct}% mapped.`, reason: '86 alerts get smarter when menu items are connected to inventory ingredients.', suggestedAction: 'Open Menu Intelligence and approve ingredient links.', severity: 'low', tab: 'menu-intelligence', focus: 'mapping', primaryActionLabel: 'Map Menu', usefulness: 30 }));
  if (setupQuality.salesData !== 'ready' && hasAccess(permissions, 'labor')) cards.push(makeAttentionCard({ id: 'setup-gap-sales-data', source: 'setupQuality', area: 'Setup', restaurantId, title: 'Sales history will improve forecasts', detail: setupQuality.salesData === 'partial' ? 'Only limited sales history is available.' : 'No sales history is available yet.', reason: 'Sales history helps labor, prep pressure, and AI ordering warnings avoid guessing.', suggestedAction: 'Enter daily sales or import a CSV sales history.', severity: 'low', tab: 'financials', focus: 'sales-import', primaryActionLabel: 'Import Sales', usefulness: 36 }));
  return dedupeAttentionCards(cards).filter(card => !card.permissionKey || hasAccess(permissions, card.permissionKey));
};

export const buildManagerBriefSummary = (input = {}) => {
  const cards = buildNeedsAttentionCards(input);
  const setupQuality = input.setupQuality || buildSetupQuality(input);
  return {
    generatedAt: new Date().toISOString(),
    attentionCount: cards.length,
    criticalCount: cards.filter(c => c.severity === 'critical').length,
    highCount: cards.filter(c => c.severity === 'high').length,
    topCards: cards.slice(0, 8),
    setupQuality
  };
};

export const buildKitchenCommandSummary = (input = {}) => {
  const cards = buildNeedsAttentionCards(input);
  const critical = cards.filter(c => c.severity === 'critical').length;
  const high = cards.filter(c => c.severity === 'high').length;
  const medium = cards.filter(c => c.severity === 'medium').length;
  const healthScore = Math.max(0, Math.min(100, 100 - critical * 20 - high * 10 - medium * 4));
  return {
    generatedAt: new Date().toISOString(),
    healthScore,
    servicePriorities: cards.slice(0, 8),
    lowStockRadar: cards.filter(c => c.area === 'Inventory' || c.area === '86 Alerts').slice(0, 8),
    laborPressure: cards.filter(c => c.area === 'Labor' || c.area === 'Schedule').slice(0, 8),
    maintenancePressure: cards.filter(c => c.area === 'Maintenance').slice(0, 8),
    setupQuality: input.setupQuality || buildSetupQuality(input)
  };
};

export const buildOpsSummaryDocs = (input = {}) => {
  const managerBrief = buildManagerBriefSummary(input);
  const kitchenCommand = buildKitchenCommandSummary(input);
  const now = new Date().toISOString();
  return {
    'opsInsights/current': { generatedAt: now, healthScore: kitchenCommand.healthScore, attentionCount: managerBrief.attentionCount, topCards: managerBrief.topCards },
    'managerBrief/today': managerBrief,
    'inventoryHealth/current': { generatedAt: now, cards: kitchenCommand.lowStockRadar, setupPct: managerBrief.setupQuality.inventoryParPct },
    'laborHealth/today': { generatedAt: now, cards: kitchenCommand.laborPressure, status: managerBrief.setupQuality.laborForecast },
    'menuImpact/current': { generatedAt: now, cards: managerBrief.topCards.filter(c => /menu|86|inventory/i.test(`${c.area} ${c.detail}`)), setupPct: managerBrief.setupQuality.menuIntelligencePct }
  };
};

export const buildEightySixAlertEventPayload = ({ appUser = {}, requestedItemName = '', inventoryItem = null, menuImpactItems = [], menuImpact = '', source = 'manager_brain', extra = {} } = {}) => {
  const requested = toStringValue(requestedItemName || inventoryItem?.name || 'Item');
  return {
    restaurantId: appUser.restaurantId || '',
    type: 'note',
    title: `86 ALERT: ${requested}`,
    messageCategory: '86 Alert',
    isImportant: true,
    commandCenterAlert: true,
    managerBriefAlert: true,
    kitchenCommandCenterAlert: true,
    inventoryItemId: inventoryItem?.id || '',
    inventoryItemName: inventoryItem?.name || '',
    requestedItemName: requested,
    menuImpact: menuImpact || (menuImpactItems.length ? `Affects ${menuImpactItems.slice(0, 6).join(', ')}${menuImpactItems.length > 6 ? ` and ${menuImpactItems.length - 6} more` : ''}.` : ''),
    menuImpactItems: menuImpactItems || [],
    status: 'open',
    acknowledgedBy: [],
    acknowledgedAt: null,
    resolvedBy: '',
    resolvedAt: null,
    source,
    author: appUser.name || appUser.email || 'Manager',
    date: new Date().toISOString(),
    replies: [],
    readBy: appUser?.id ? [{ userId: appUser.id, name: appUser.name || appUser.email || 'Manager', at: new Date().toISOString() }] : [],
    ...extra
  };
};

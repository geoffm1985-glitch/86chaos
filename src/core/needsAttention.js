const rows = value => Array.isArray(value) ? value : [];
const text = value => String(value == null ? '' : value).trim();
const lower = value => text(value).toLowerCase();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const severityRank = Object.freeze({ critical: 5, high: 4, attention: 3, medium: 3, low: 2, 'needs-data': 1, info: 0 });
const closed = value => ['completed','closed','resolved','done','archived','cancelled','canceled','paid','matched'].includes(lower(value));
const dateKey = value => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
};
const stableHash = value => {
  let hash = 2166136261;
  const input = text(value);
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};
const safeEvidence = value => rows(value).map(item => text(item)).filter(Boolean).slice(0, 8);

function freshnessFor(value, now = new Date()) {
  if (!value) return { status:'unknown', observedAt:'', ageHours:null };
  const date = typeof value?.toDate === 'function' ? value.toDate() : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value);
  if (!Number.isFinite(date.getTime())) return { status:'unknown', observedAt:'', ageHours:null };
  const ageHours = Math.max(0, Math.round(((now.getTime() - date.getTime()) / 36e5) * 10) / 10);
  return { status: ageHours <= 24 ? 'current' : ageHours <= 72 ? 'aging' : 'stale', observedAt:date.toISOString(), ageHours };
}

function makeAttentionItem(input = {}, context = {}) {
  const workspaceId = text(input.workspaceId || context.workspaceId || context.restaurantId || 'unknown-workspace');
  const category = lower(input.category || 'operations').replace(/[^a-z0-9-]+/g, '-') || 'operations';
  const sourceKey = text(input.sourceKey || input.id || input.title || input.reason || 'finding');
  const stableId = `attention:${stableHash(`${workspaceId}|${category}|${sourceKey}`)}`;
  const freshness = input.freshness && typeof input.freshness === 'object'
    ? input.freshness
    : freshnessFor(input.observedAt || input.updatedAt || input.createdAt, context.now || new Date());
  const completeness = ['complete','partial','incomplete','unknown'].includes(lower(input.completeness)) ? lower(input.completeness) : 'complete';
  const confidenceValue = Number(input.confidence);
  const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : completeness === 'complete' ? 1 : completeness === 'partial' ? 0.6 : 0.25;
  return {
    id: stableId,
    stableId,
    workspaceId,
    locationId: text(input.locationId || context.locationId || workspaceId),
    category,
    severity: severityRank[lower(input.severity)] == null ? 'attention' : lower(input.severity),
    title: text(input.title || 'Review needed').slice(0, 180),
    reason: text(input.reason || 'Review the available evidence.').slice(0, 800),
    evidence: safeEvidence(input.evidence),
    freshness,
    completeness,
    confidence,
    permission: text(input.permission || 'manager'),
    visibility: rows(input.visibility).length ? rows(input.visibility).map(lower) : ['owner','admin','manager'],
    action: {
      label: text(input.action?.label || 'Review'),
      tab: text(input.action?.tab || 'today'),
      focus: text(input.action?.focus || ''),
      route: text(input.action?.route || '')
    },
    approvalRequired: input.approvalRequired !== false,
    reviewOnly: true,
    sourceType: text(input.sourceType || category),
    sourceKey,
    dedupeKey: text(input.dedupeKey || `${category}:${sourceKey}`)
  };
}

function canViewAttentionItem(item = {}, actor = {}) {
  const role = lower(actor.role || actor.accountRole || (actor.isOwner || actor.owner ? 'owner' : actor.isAdmin ? 'admin' : actor.isManager ? 'manager' : 'staff'));
  const elevated = Boolean(actor.isOwner || actor.owner || actor.accountOwner || actor.workspaceOwner || actor.isAdmin || actor.isManager || /owner|admin|manager/.test(role));
  if (item.workspaceId && actor.restaurantId && item.workspaceId !== actor.restaurantId) return false;
  if (elevated) return true;
  return rows(item.visibility).includes('staff') && !['financial','system','security','backup'].includes(item.category);
}

function buildNeedsAttention(input = {}) {
  const workspaceId = text(input.workspaceId || input.restaurantId || 'unknown-workspace');
  const currentDate = input.currentDate || new Date().toISOString().slice(0, 10);
  const context = { workspaceId, locationId:input.locationId, now:input.now ? new Date(input.now) : new Date() };
  const findings = [];
  const add = row => findings.push(makeAttentionItem({ ...row, workspaceId }, context));

  const inventory = rows(input.inventoryItems);
  if (!inventory.length) add({ category:'inventory', sourceKey:'inventory-data', severity:'needs-data', title:'Inventory data is incomplete', reason:'No inventory records are available, so stock readiness cannot be assumed.', completeness:'incomplete', confidence:0, action:{label:'Review inventory',tab:'inventory',focus:'belowPar'}, visibility:['owner','admin','manager','staff'] });
  for (const item of inventory) {
    const par = number(item.parLevel ?? item.par), stock = number(item.currentStock ?? item.onHand);
    if (par > 0 && stock < par) add({ category:'inventory', sourceKey:`below-par:${item.id || item.name}`, severity:stock <= 0 ? 'critical' : 'high', title:stock <= 0 ? `${item.name || 'Inventory item'} is out` : `${item.name || 'Inventory item'} is below par`, reason:`On hand ${stock}; configured par ${par}.`, evidence:[`stock=${stock}`,`par=${par}`], observedAt:item.updatedAt || item.countedAt, action:{label:'Review stock',tab:'inventory',focus:'belowPar'}, visibility:['owner','admin','manager','staff'] });
  }

  const prepItems = rows(input.prepItems);
  const tasks = rows(input.tasks);
  if (!prepItems.length && !tasks.length) add({ category:'prep', sourceKey:'prep-data', severity:'needs-data', title:'Prep status is unknown', reason:'No prep or task records are available for today.', completeness:'incomplete', confidence:0, action:{label:'Review prep',tab:'prep',focus:'plan'}, visibility:['owner','admin','manager','staff'] });
  for (const item of prepItems.filter(row => [currentDate,'MASTER'].includes(text(row.date)) && row.isCompleted !== true && !closed(row.status))) add({ category:'prep', sourceKey:`prep:${item.id || item.text || item.title}`, severity:'attention', title:item.text || item.title || 'Open prep item', reason:'This prep item is still open for today.', observedAt:item.updatedAt || item.createdAt, action:{label:'Open prep',tab:'prep',focus:'plan'}, visibility:['owner','admin','manager','staff'] });
  for (const item of tasks.filter(row => !closed(row.status) && row.isCompleted !== true && dateKey(row.dueDate || row.date) && dateKey(row.dueDate || row.date) < currentDate)) add({ category:'prep', sourceKey:`task-overdue:${item.id || item.title}`, severity:'high', title:item.title || item.text || 'Overdue task', reason:`Due ${dateKey(item.dueDate || item.date)} and still open.`, observedAt:item.updatedAt, action:{label:'Review tasks',tab:'prep',focus:'tasks'}, visibility:['owner','admin','manager','staff'] });

  const activeUsers = rows(input.users).filter(user => user?.isActive !== false);
  const todayShifts = rows(input.shifts).filter(shift => dateKey(shift.date) === currentDate && shift.isDeleted !== true && shift.cancelled !== true && shift.isPublished === true);
  if (!activeUsers.length && !rows(input.shifts).length) add({ category:'staffing', sourceKey:'staffing-data', severity:'needs-data', title:'Staffing coverage is unknown', reason:'Roster and schedule evidence is unavailable.', completeness:'incomplete', confidence:0, action:{label:'Review schedule',tab:'schedule',focus:'schedule-builder'}, visibility:['owner','admin','manager'] });
  else if (activeUsers.length && !todayShifts.length) add({ category:'staffing', sourceKey:`no-published-shifts:${currentDate}`, severity:'critical', title:'No published shifts today', reason:'Active employees exist but no published shift is visible for today.', action:{label:'Open schedule',tab:'schedule',focus:'schedule-builder'}, visibility:['owner','admin','manager'] });
  for (const request of rows(input.timeOffRequests).filter(row => ['pending','requested','awaiting_review','awaiting review'].includes(lower(row.status)))) add({ category:'staffing', sourceKey:`time-off:${request.id || request.userId || request.date}`, severity:'attention', title:'Time-off request needs review', reason:`${request.employeeName || request.userName || 'A team member'} has a pending request.`, observedAt:request.updatedAt || request.createdAt, action:{label:'Review time off',tab:'published',focus:'time-off'}, visibility:['owner','admin','manager'] });
  for (const trade of rows(input.shiftTrades || input.shiftSwaps).filter(row => !closed(row.status) && ['available','pending','requested','open'].includes(lower(row.status)))) add({ category:'staffing', sourceKey:`shift-trade:${trade.id || trade.shiftId}`, severity:'attention', title:'Shift trade needs review', reason:'An open shift trade can affect service coverage.', observedAt:trade.updatedAt || trade.createdAt, action:{label:'Review trades',tab:'published',focus:'trades'}, visibility:['owner','admin','manager'] });
  for (const punch of rows(input.timePunches).filter(row => ['clocked_in','on_break'].includes(lower(row.status)) && number(row.hours || row.elapsedHours) >= 10)) add({ category:'financial', sourceKey:`long-punch:${punch.id || punch.userId}`, severity:'high', title:'Long active shift needs review', reason:`${punch.employeeName || 'Employee'} has an active ${number(punch.hours || punch.elapsedHours).toFixed(1)} hour shift.`, action:{label:'Review labor',tab:'financials',focus:'labor'}, visibility:['owner','admin','manager'] });

  const maintenance = rows(input.maintenanceLogs);
  if (!maintenance.length) add({ category:'maintenance', sourceKey:'maintenance-data', severity:'needs-data', title:'Maintenance status is unknown', reason:'No maintenance evidence is loaded.', completeness:'incomplete', confidence:0, action:{label:'Review maintenance',tab:'maintenance'}, visibility:['owner','admin','manager','staff'] });
  for (const item of maintenance.filter(row => !closed(row.status))) add({ category:'maintenance', sourceKey:`maintenance:${item.id || item.equipment || item.title}`, severity:['critical','urgent','high'].includes(lower(item.urgency || item.priority)) ? 'critical' : 'attention', title:item.equipment || item.title || 'Open maintenance issue', reason:item.issue || item.reason || 'Maintenance work remains open.', observedAt:item.updatedAt || item.reportedAt, action:{label:'Review maintenance',tab:'maintenance'}, visibility:['owner','admin','manager','staff'] });

  const safetyPattern = /food\s*safety|haccp|temp(?:erature)?|cool(?:ing)?|hot\s*hold|cold\s*hold|sanitize|sanitizer|allergen|line\s*check/i;
  const safetyRows = [...tasks, ...prepItems].filter(row => safetyPattern.test([row.title,row.text,row.category,row.notes].filter(Boolean).join(' ')));
  if (!safetyRows.length) add({ category:'food-safety', sourceKey:'food-safety-data', severity:'needs-data', title:'Food-safety checks are unknown', reason:'No food-safety or temperature-check evidence is loaded.', completeness:'incomplete', confidence:0, action:{label:'Review checks',tab:'prep',focus:'checks'}, visibility:['owner','admin','manager','staff'] });
  for (const check of safetyRows.filter(row => row.isCompleted !== true && !closed(row.status))) add({ category:'food-safety', sourceKey:`safety:${check.id || check.title || check.text}`, severity:'high', title:check.title || check.text || 'Food-safety check incomplete', reason:'A food-safety control remains incomplete and requires human review.', action:{label:'Review checks',tab:'prep',focus:'checks'}, visibility:['owner','admin','manager','staff'] });

  const sales = rows(input.sales).filter(row => dateKey(row.businessDate || row.date || row.createdAt) === currentDate);
  if (!sales.length) add({ category:'financial', sourceKey:`sales-data:${currentDate}`, severity:'needs-data', title:'Current-day financial picture is incomplete', reason:'No current-day sales evidence is loaded.', completeness:'incomplete', confidence:0, action:{label:'Review financials',tab:'financials'}, visibility:['owner','admin','manager'] });
  for (const invoice of rows(input.invoices).filter(row => !closed(row.status) && (row.reviewRequired || ['price_discrepancy','quantity_discrepancy','low_confidence','duplicate_suspicion'].includes(lower(row.classification))))) add({ category:'financial', sourceKey:`invoice:${invoice.id || invoice.invoiceNumber}`, severity:lower(invoice.classification).includes('duplicate') ? 'high' : 'attention', title:`Invoice ${invoice.invoiceNumber || invoice.vendorName || ''} needs review`.trim(), reason:invoice.reason || invoice.classification || 'Invoice evidence does not reconcile cleanly.', evidence:invoice.evidence, observedAt:invoice.updatedAt || invoice.invoiceDate, completeness:invoice.confidence != null && Number(invoice.confidence) < 0.7 ? 'partial' : 'complete', confidence:invoice.confidence, action:{label:'Review invoice',tab:'inventory',focus:'invoices'}, visibility:['owner','admin','manager'] });
  for (const waste of rows(input.wasteLogs || input.burnLogs).filter(row => number(row.cost || row.extendedCost || row.quantity) > 0 && !closed(row.status))) add({ category:'operations', sourceKey:`waste:${waste.id || waste.itemName || waste.date}`, severity:number(waste.cost || waste.extendedCost) >= 100 ? 'high' : 'attention', title:`Waste review: ${waste.itemName || waste.name || 'record'}`, reason:waste.reason || 'Open waste/burn evidence may affect prep and ordering.', observedAt:waste.updatedAt || waste.date, action:{label:'Review waste',tab:'inventory',focus:'waste'}, visibility:['owner','admin','manager'] });
  for (const event of rows(input.events).filter(row => dateKey(row.date) === currentDate && (row.isImportant === true || ['special_event','event'].includes(lower(row.type))))) add({ category:'operations', sourceKey:`event:${event.id || event.title}`, severity:'attention', title:event.title || event.name || 'Important event today', reason:event.notes || 'Today’s event may affect staffing, prep, inventory, or service.', action:{label:'Review operations',tab:'ops'}, visibility:['owner','admin','manager','staff'] });

  const backup = input.backupStatus;
  if (!backup || !Object.keys(backup).length) add({ category:'system', sourceKey:'backup-status', severity:'needs-data', title:'Backup status is unknown', reason:'No verified backup evidence is available. Unknown is not healthy.', completeness:'unknown', confidence:0, action:{label:'Open Backup Center',tab:'godmode',focus:'forensics'}, visibility:['owner','admin'] });
  else if (['failed','error','stale','attention'].includes(lower(backup.status || backup.lastStatus)) || backup.backupStale === true) add({ category:'system', sourceKey:'backup-status', severity:'critical', title:'Backup protection needs attention', reason:backup.lastError || 'The last backup failed or is stale.', observedAt:backup.lastErrorAt || backup.lastRunAt, action:{label:'Open Backup Center',tab:'godmode',focus:'forensics'}, visibility:['owner','admin'] });
  for (const alert of rows(input.securityAlerts || input.restaurantAdminAlerts).filter(row => !closed(row.status))) add({ category:'system', sourceKey:`security:${alert.id || alert.title}`, severity:['critical','high'].includes(lower(alert.severity)) ? 'critical' : 'attention', title:alert.title || 'Security/system finding', reason:alert.detail || alert.reason || 'Owner/admin review is required.', observedAt:alert.updatedAt || alert.createdAt, action:{label:'Open Security Center',tab:'godmode',focus:'security'}, visibility:['owner','admin'] });
  for (const integration of rows(input.integrations).filter(row => ['error','failed','disconnected','expired','unknown'].includes(lower(row.status)))) add({ category:'system', sourceKey:`integration:${integration.id || integration.provider}`, severity:lower(integration.status) === 'unknown' ? 'needs-data' : 'high', title:`${integration.name || integration.provider || 'Integration'} needs review`, reason:integration.message || `Integration status is ${integration.status || 'unknown'}.`, completeness:lower(integration.status) === 'unknown' ? 'unknown' : 'complete', action:{label:'Review integration',tab:'settings',focus:'integrations'}, visibility:['owner','admin'] });
  for (const gap of rows(input.setupGaps)) add({ category:gap.category || 'operations', sourceKey:`setup:${gap.id || gap.title}`, severity:'needs-data', title:gap.title || 'Setup is incomplete', reason:gap.reason || 'Required setup or source data is missing.', completeness:'incomplete', confidence:0, action:gap.action || {label:'Finish setup',tab:'settings'}, visibility:gap.visibility || ['owner','admin','manager'] });

  const deduped = new Map();
  for (const item of findings) {
    const prior = deduped.get(item.dedupeKey);
    if (!prior || (severityRank[item.severity] || 0) > (severityRank[prior.severity] || 0)) deduped.set(item.dedupeKey, item);
    else if (prior) prior.evidence = Array.from(new Set([...prior.evidence, ...item.evidence])).slice(0, 8);
  }
  return [...deduped.values()].sort((a,b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0) || a.category.localeCompare(b.category) || a.stableId.localeCompare(b.stableId));
}

export { buildNeedsAttention, makeAttentionItem, canViewAttentionItem, freshnessFor, stableHash, severityRank };

export default { buildNeedsAttention, makeAttentionItem, canViewAttentionItem, freshnessFor, stableHash, severityRank };

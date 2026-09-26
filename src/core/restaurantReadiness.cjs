'use strict';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const rows = value => Array.isArray(value) ? value : [];
const lower = value => String(value || '').trim().toLowerCase();
const active = value => !['completed','closed','resolved','done','archived','cancelled','canceled'].includes(lower(value));
const pending = value => ['pending','requested','open','awaiting_review','awaiting review'].includes(lower(value));
const dateKey = value => {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  try { return new Date(value).toISOString().slice(0, 10); } catch (_) { return ''; }
};
const severityRank = Object.freeze({ critical: 4, attention: 3, 'needs-data': 2, ready: 1 });

function category({ key, label, score = null, status = 'ready', reason, evidence = [], action }) {
  return {
    key,
    label,
    score: Number.isFinite(score) ? clamp(Math.round(score)) : null,
    status,
    statusLabel: status === 'critical' ? 'Critical' : status === 'attention' ? 'Needs attention' : status === 'needs-data' ? 'Needs data' : 'Ready',
    reason: String(reason || ''),
    evidence: rows(evidence).filter(Boolean).slice(0, 6),
    action: action || { label: 'Review', tab: 'today' }
  };
}

function buildRestaurantReadiness(input = {}) {
  const currentDate = input.currentDate || new Date().toISOString().slice(0, 10);
  const inventoryItems = rows(input.inventoryItems);
  const prepItems = rows(input.prepItems);
  const tasks = rows(input.tasks);
  const users = rows(input.users).filter(user => user?.isActive !== false);
  const shifts = rows(input.shifts);
  const timePunches = rows(input.timePunches);
  const timeOffRequests = rows(input.timeOffRequests);
  const maintenanceLogs = rows(input.maintenanceLogs);
  const sales = rows(input.sales);
  const events = rows(input.events);
  const restaurantAdminAlerts = rows(input.restaurantAdminAlerts);

  const belowPar = inventoryItems.filter(item => Number(item?.parLevel || 0) > 0 && Number(item?.currentStock || 0) < Number(item?.parLevel || 0));
  const zeroStock = belowPar.filter(item => Number(item?.currentStock || 0) <= 0);
  const inventory = inventoryItems.length === 0
    ? category({ key:'inventory', label:'Inventory', status:'needs-data', reason:'No inventory records are loaded on Manager Brief, so readiness is not assumed.', action:{ label:'Review inventory', tab:'inventory', focus:'belowPar' } })
    : category({
        key:'inventory', label:'Inventory',
        score:100 - zeroStock.length * 22 - Math.max(0, belowPar.length - zeroStock.length) * 8,
        status:zeroStock.length ? 'critical' : belowPar.length ? 'attention' : 'ready',
        reason:zeroStock.length ? `${zeroStock.length} item${zeroStock.length===1?' is':'s are'} at zero stock and ${belowPar.length} total are below par.` : belowPar.length ? `${belowPar.length} item${belowPar.length===1?' is':'s are'} below par.` : 'Loaded inventory is at or above configured pars.',
        evidence:belowPar.slice(0,4).map(item => `${item.name || 'Item'}: ${Number(item.currentStock || 0)} / par ${Number(item.parLevel || 0)}`),
        action:{ label:'Review inventory', tab:'inventory', focus:'belowPar' }
      });

  const todayPrep = prepItems.filter(item => ['MASTER', currentDate].includes(String(item?.date || '')) && item?.isCompleted !== true && !['completed','done'].includes(lower(item?.status)));
  const incompleteTasks = tasks.filter(task => active(task?.status) && task?.isCompleted !== true);
  const overdueTasks = incompleteTasks.filter(task => dateKey(task?.dueDate || task?.date) && dateKey(task?.dueDate || task?.date) < currentDate);
  const prep = prepItems.length === 0 && tasks.length === 0
    ? category({ key:'prep', label:'Prep', status:'needs-data', reason:'No prep or task records are loaded, so prep readiness is unknown.', action:{ label:'Review prep', tab:'prep', focus:'plan' } })
    : category({
        key:'prep', label:'Prep',
        score:100 - todayPrep.length * 4 - overdueTasks.length * 12,
        status:overdueTasks.length ? 'critical' : todayPrep.length || incompleteTasks.length ? 'attention' : 'ready',
        reason:overdueTasks.length ? `${overdueTasks.length} overdue task${overdueTasks.length===1?'':'s'} plus ${todayPrep.length} open prep item${todayPrep.length===1?'':'s'} need review.` : todayPrep.length ? `${todayPrep.length} prep item${todayPrep.length===1?' remains':'s remain'} open for today.` : 'No open prep work is visible for today.',
        evidence:[...overdueTasks.slice(0,3).map(task => `Overdue: ${task.title || task.text || 'Task'}`), ...todayPrep.slice(0,3).map(item => `Open prep: ${item.text || item.title || 'Prep item'}`)],
        action:{ label:'Review prep', tab:'prep', focus:'plan' }
      });

  const todayShifts = shifts.filter(shift => dateKey(shift?.date) === currentDate && shift?.isPublished === true && shift?.isDeleted !== true && shift?.cancelled !== true);
  const pendingTimeOff = timeOffRequests.filter(request => pending(request?.status));
  const activePunches = timePunches.filter(punch => ['clocked_in','on_break'].includes(lower(punch?.status)));
  const staffingNoData = users.length === 0 && shifts.length === 0 && timeOffRequests.length === 0;
  const staffing = staffingNoData
    ? category({ key:'staffing', label:'Staffing', status:'needs-data', reason:'No roster, schedule, or request-off evidence is loaded, so staffing readiness is unknown.', action:{ label:'Review schedule', tab:'schedule', focus:'schedule-builder' } })
    : category({
        key:'staffing', label:'Staffing',
        score:100 - (users.length > 0 && todayShifts.length === 0 ? 35 : 0) - pendingTimeOff.length * 7,
        status:users.length > 0 && todayShifts.length === 0 ? 'critical' : pendingTimeOff.length ? 'attention' : 'ready',
        reason:users.length > 0 && todayShifts.length === 0 ? 'No published shifts are visible for today.' : pendingTimeOff.length ? `${pendingTimeOff.length} request-off item${pendingTimeOff.length===1?' is':'s are'} waiting for review.` : `${todayShifts.length} published shift${todayShifts.length===1?' is':'s are'} visible today; ${activePunches.length} active punch${activePunches.length===1?'':'es'}.`,
        evidence:[`${todayShifts.length} published today`, `${activePunches.length} active punches`, `${pendingTimeOff.length} pending requests`],
        action:{ label:'Review schedule', tab:'schedule', focus:'schedule-builder' }
      });

  const openMaintenance = maintenanceLogs.filter(log => active(log?.status));
  const urgentMaintenance = openMaintenance.filter(log => ['high','critical','urgent'].includes(lower(log?.urgency || log?.priority)));
  const maintenance = maintenanceLogs.length === 0
    ? category({ key:'maintenance', label:'Maintenance', status:'needs-data', reason:'No maintenance history is loaded, so equipment readiness is not assumed.', action:{ label:'Review maintenance', tab:'maintenance' } })
    : category({
        key:'maintenance', label:'Maintenance',
        score:100 - urgentMaintenance.length * 25 - Math.max(0, openMaintenance.length - urgentMaintenance.length) * 6,
        status:urgentMaintenance.length ? 'critical' : openMaintenance.length ? 'attention' : 'ready',
        reason:urgentMaintenance.length ? `${urgentMaintenance.length} high/critical maintenance issue${urgentMaintenance.length===1?' needs':'s need'} action.` : openMaintenance.length ? `${openMaintenance.length} maintenance item${openMaintenance.length===1?' is':'s are'} still open.` : 'No open maintenance issues are visible.',
        evidence:openMaintenance.slice(0,4).map(log => `${log.equipment || 'Equipment'}: ${log.issue || log.title || log.status || 'Open'}`),
        action:{ label:'Review maintenance', tab:'maintenance' }
      });

  const safetyPattern = /food\s*safety|haccp|temp(?:erature)?|cool(?:ing)?|hot\s*hold|cold\s*hold|sanitize|sanitizer|allergen|line\s*check/i;
  const safetyChecks = [...tasks, ...prepItems].filter(row => safetyPattern.test([row?.title,row?.text,row?.category,row?.notes].filter(Boolean).join(' ')));
  const openSafetyChecks = safetyChecks.filter(row => row?.isCompleted !== true && active(row?.status));
  const foodSafety = safetyChecks.length === 0
    ? category({ key:'food-safety', label:'Food Safety', status:'needs-data', reason:'No food-safety or temperature checks are visible in the loaded prep/task data.', action:{ label:'Review checks', tab:'prep', focus:'checks' } })
    : category({
        key:'food-safety', label:'Food Safety',
        score:100 - openSafetyChecks.length * 18,
        status:openSafetyChecks.length ? 'attention' : 'ready',
        reason:openSafetyChecks.length ? `${openSafetyChecks.length} food-safety check${openSafetyChecks.length===1?' remains':'s remain'} incomplete.` : 'Loaded food-safety checks are complete.',
        evidence:openSafetyChecks.slice(0,4).map(row => row.title || row.text || row.category || 'Open check'),
        action:{ label:'Review checks', tab:'prep', focus:'checks' }
      });

  const todaySales = sales.filter(row => dateKey(row?.businessDate || row?.date || row?.createdAt) === currentDate);
  const financial = todaySales.length === 0
    ? category({ key:'financial', label:'Financial', status:'needs-data', reason:'No current-day sales evidence is loaded on Manager Brief. Open Financials before judging financial readiness.', action:{ label:'Review financials', tab:'financials' } })
    : category({ key:'financial', label:'Financial', score:100, status:'ready', reason:`${todaySales.length} current-day sales record${todaySales.length===1?' is':'s are'} available for review.`, evidence:[`${todaySales.length} current-day sales records loaded`], action:{ label:'Review financials', tab:'financials' } });

  const importantEvents = events.filter(event => dateKey(event?.date) === currentDate && (event?.isImportant === true || ['special_event','event'].includes(lower(event?.type))));
  const operations = category({ key:'operations', label:'Operations', score:100 - importantEvents.length * 5, status:importantEvents.length > 3 ? 'attention' : 'ready', reason:importantEvents.length ? `${importantEvents.length} important event${importantEvents.length===1?' is':'s are'} on today’s operating picture.` : 'No high-load event signal is visible for today.', evidence:importantEvents.slice(0,4).map(event => event.title || event.name || 'Important event'), action:{ label:'Open command center', tab:'ops' } });

  const openAdminAlerts = restaurantAdminAlerts.filter(alert => active(alert?.status));
  const criticalAdminAlerts = openAdminAlerts.filter(alert => ['critical','high'].includes(lower(alert?.severity)));
  const system = input.systemDataVisible === false
    ? category({ key:'system', label:'System', status:'needs-data', reason:'System/admin health evidence is not available to this role.', action:{ label:'Open back office', tab:'back-office' } })
    : category({ key:'system', label:'System', score:100 - criticalAdminAlerts.length * 28 - Math.max(0, openAdminAlerts.length - criticalAdminAlerts.length) * 7, status:criticalAdminAlerts.length ? 'critical' : openAdminAlerts.length ? 'attention' : 'ready', reason:criticalAdminAlerts.length ? `${criticalAdminAlerts.length} high/critical owner-admin alert${criticalAdminAlerts.length===1?' needs':'s need'} review.` : openAdminAlerts.length ? `${openAdminAlerts.length} owner/admin alert${openAdminAlerts.length===1?' is':'s are'} still open.` : 'No open owner/admin system alerts are visible.', evidence:openAdminAlerts.slice(0,4).map(alert => alert.title || alert.detail || 'Open system alert'), action:{ label:'Open back office', tab:'back-office' } });

  const categories=[inventory,prep,staffing,maintenance,foodSafety,financial,operations,system];
  const scored=categories.filter(row => Number.isFinite(row.score));
  const overallScore=scored.length ? Math.round(scored.reduce((sum,row)=>sum+row.score,0)/scored.length) : null;
  const coveragePct=Math.round(scored.length/categories.length*100);
  const needsAttention=[...categories].filter(row => row.status !== 'ready').sort((a,b)=>(severityRank[b.status]||0)-(severityRank[a.status]||0) || a.label.localeCompare(b.label));
  const status=categories.some(row => row.status === 'critical') ? 'critical' : categories.some(row => row.status === 'attention') ? 'attention' : categories.some(row => row.status === 'needs-data') ? 'partial' : 'ready';
  return { schemaVersion:1, currentDate, overallScore, coveragePct, groundedCategoryCount:scored.length, totalCategoryCount:categories.length, status, categories, needsAttention, reviewOnly:true };
}

module.exports={ buildRestaurantReadiness };

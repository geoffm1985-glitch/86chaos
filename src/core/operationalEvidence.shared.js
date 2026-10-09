'use strict';
const evidenceRows = value => Array.isArray(value) ? value : [];
const evidenceText = value => String(value == null ? '' : value).trim();
const evidenceNumber = value => value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const evidenceTime = value => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const normalized = typeof value?.toDate === 'function' ? value.toDate() : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) : value;
  const result = new Date(normalized).getTime();
  return Number.isFinite(result) ? result : null;
};
const soldUnits = new Set(['each','ea','unit','units','portion','portions','serving','servings','count']);

function evidenceQuality(state, limit = Infinity) {
  const reasons = [];
  if (!state || state.resolved !== true) reasons.push('Source is not loaded.');
  if (state?.allowed === false) reasons.push('Source is unavailable to this role.');
  if (state?.error) reasons.push('Source could not be verified; retry.');
  if (state?.stale || state?.cached) reasons.push('Source has not been verified by the server.');
  if (state?.complete === false || state?.truncated || evidenceRows(state?.data).length >= (state?.limit || limit)) reasons.push('Source coverage is incomplete.');
  return {complete:reasons.length === 0,reasons};
}

function buildFoodSafetyEvidence({workspaceId,items,logs,itemState,logState,now = Date.now()} = {}) {
  const scoped = list => evidenceRows(list).filter(row => row.restaurantId === workspaceId);
  const checks = scoped(items).filter(row => !row.archived && row.isActive !== false);
  const records = scoped(logs);
  const quality = [evidenceQuality(itemState),evidenceQuality(logState)];
  const complete = quality.every(row => row.complete);
  const findings = [];
  for (const item of checks) {
    const itemLogs = records.filter(row => row.itemId === item.id).sort((a,b) => (evidenceTime(b.timestamp) || 0)-(evidenceTime(a.timestamp) || 0));
    const latest = Math.max(evidenceTime(item.lastLoggedAt) || 0,evidenceTime(itemLogs[0]?.timestamp) || 0);
    if (Number(item.requiredEveryHours) > 0 && complete && now-latest > Number(item.requiredEveryHours)*3600000) findings.push({id:`missed:${item.id}`,itemId:item.id,title:`Check overdue: ${item.name || item.title || 'Line check'}`,reason:'The configured check interval has elapsed.',severity:'high',evidenceIds:[item.id],action:{label:'Review line checks',tab:'prep',focus:'checks'}});
  }
  for (const log of records) {
    if ((log.managerReviewRequired || String(log.status).toLowerCase() === 'attention') && log.reviewedByManager !== true) findings.push({id:`review:${log.id}`,itemId:log.itemId,title:'Food-safety corrective action needs sign-off',reason:log.correctiveAction ? 'A corrective action was recorded; manager sign-off is still required.' : 'Review the attention result and record the required corrective action.',severity:'high',evidenceIds:[log.id],action:{label:'Review corrective action',tab:'prep',focus:'checks'}});
  }
  return {complete,reasons:quality.flatMap(row => row.reasons),configuredChecks:checks.length,observedLogs:records.length,findings,reviewOnly:true};
}

function reviewedServingConversion(recipe = {}, candidate = {}) {
  const unit = evidenceText(recipe.batchYieldUnit || 'each').toLowerCase();
  if (soldUnits.has(unit)) return {ready:true,bulk:false,unit:'each',servingsPerBatch:null};
  const yieldQuantity = evidenceNumber(recipe.batchYieldQuantity);
  const yieldPercent = evidenceNumber(recipe.batchYieldPercent ?? 100);
  const servings = evidenceNumber(candidate.servingsPerBatch);
  if (!evidenceText(recipe.costingApprovedAt) || !(yieldQuantity > 0) || !(yieldPercent > 0 && yieldPercent <= 100) || !(servings > 0 && servings <= 100000) || candidate.reviewed !== true || candidate.yieldUnit !== unit || Number(candidate.yieldQuantity) !== yieldQuantity || Number(candidate.yieldPercent) !== yieldPercent || evidenceText(candidate.costingApprovedAt) !== evidenceText(recipe.costingApprovedAt)) return {ready:false,bulk:true,reason:'Approve the recipe yield, then review sold servings per usable batch against that current yield.'};
  return {ready:true,bulk:true,servingsPerBatch:servings,yieldQuantity,yieldPercent,unit,usableYield:yieldQuantity*yieldPercent/100,costingApprovedAt:evidenceText(recipe.costingApprovedAt),reviewed:true};
}

function graphMenuIdentity(row) { return evidenceText(row.menuItemId) || (row.menuItemName ? `menu:${evidenceText(row.menuItemName).toLowerCase()}|${evidenceText(row.menuCategory).toLowerCase()}|${evidenceText(row.menuDescription).toLowerCase()}` : ''); }

function buildGraphMenuRows({workspaceId,dependencies,recipes,specials} = {}) {
  const menus = new Map();
  for (const link of evidenceRows(dependencies).filter(row => row.restaurantId === workspaceId && graphMenuIdentity(row))) {
    const menuId=graphMenuIdentity(link);
    const previous = menus.get(menuId) || {id:menuId,restaurantId:workspaceId,name:link.menuItemName || link.menuItemId,recipeIds:[],sourceIds:[],allergens:[]};
    const references = Array.isArray(link.recipeIds) ? link.recipeIds : [link.recipeId || link.batchRecipeId].filter(Boolean);
    previous.recipeIds = [...new Set([...previous.recipeIds,...references])];
    previous.sourceIds = [...new Set([...previous.sourceIds,link.id].filter(Boolean))];
    // Conflicting menu prices are unknown, rather than whichever dependency loaded last.
    const price = evidenceNumber(link.menuPrice ?? link.menuItemPrice ?? link.price);
    if (price !== null) { previous.priceConflict = previous.priceConflict || (previous.price != null && previous.price !== price); previous.price = previous.priceConflict ? null : price; }
    previous.allergens = [...new Set([...previous.allergens,...evidenceRows(link.allergens)])];
    // One reviewed dependency cannot verify labels contributed by another source.
    if (evidenceRows(link.allergens).length) previous.safetyVerified = previous.safetyVerified !== false && Boolean(link.allergensReviewedAt && link.allergensReviewedBy);
    menus.set(menuId,previous);
  }
  for (const special of evidenceRows(specials).filter(row => row.restaurantId === workspaceId && row.recipeId)) menus.set(special.id,{...special,recipeIds:[special.recipeId],sourceIds:[special.id],safetyVerified:Boolean(special.allergensReviewedAt && special.allergensReviewedBy)});
  for (const recipe of evidenceRows(recipes).filter(row => row.restaurantId === workspaceId)) if (!Array.from(menus.values()).some(menu => menu.recipeIds.includes(recipe.id))) menus.set(`recipe-menu:${recipe.id}`,{id:`recipe-menu:${recipe.id}`,restaurantId:workspaceId,name:recipe.title || recipe.name,recipeIds:[recipe.id],price:recipe.menuPrice ?? null,allergens:recipe.allergens || [],safetyVerified:Boolean(recipe.allergensReviewedAt && recipe.allergensReviewedBy),sourceIds:[recipe.id],inferred:true});
  return [...menus.values()];
}

function buildTrainingFollowUp({workspaceId,tasks,events,sourceState,now = Date.now()} = {}) {
  const groups = new Map();
  for (const task of evidenceRows(tasks).filter(row => row.restaurantId === workspaceId && row.operationalEvidence?.evidenceIds?.length)) {
    const ids = [...new Set(task.operationalEvidence.evidenceIds.map(evidenceText))].sort();
    const key = JSON.stringify([task.userId,ids]);
    const group = groups.get(key) || {id:key,employeeId:task.userId,employeeName:task.employeeName || 'Employee',evidenceIds:ids,tasks:[]};
    group.tasks.push(task);groups.set(key,group);
  }
  return [...groups.values()].map(group => {
    const completed = group.tasks.filter(task => task.completed === true);
    const completedAt = completed.length === group.tasks.length ? Math.max(...completed.map(task => evidenceTime(task.completedAt) || 0)) : 0;
    const repeated = completedAt ? evidenceRows(events).filter(event => !group.evidenceIds.includes(event.evidenceId || event.id) && evidenceTime(event.at) > completedAt && group.tasks.some(task => task.operationalEvidence.cause && task.operationalEvidence.cause === event.cause && (!task.operationalEvidence.category || task.operationalEvidence.category===event.category))) : [];
    const complete = evidenceQuality(sourceState).complete;
    return {...group,completed:completed.length,total:group.tasks.length,state:!completedAt ? 'in-progress' : !complete ? 'follow-up-incomplete' : 'review-outcomes',completedAt:completedAt ? new Date(completedAt).toISOString() : '',observedDays:completedAt ? Math.max(0,Math.floor((now-completedAt)/86400000)) : 0,repeatedEvidenceIds:repeated.map(row => row.evidenceId || row.id),reason:!completedAt ? 'Review assignment completion before evaluating outcomes.' : !complete ? 'Historical evidence is incomplete; no effectiveness claim is available.' : `${repeated.length} matching issue(s) observed after completion. A manager must assess context; this is not an employee performance score.`,reviewOnly:true};
  });
}

const operationalEvidence = {evidenceQuality,evidenceTime,buildFoodSafetyEvidence,reviewedServingConversion,buildGraphMenuRows,graphMenuIdentity,buildTrainingFollowUp};
Object.defineProperty(globalThis,'__86ChaosOperationalEvidence',{value:operationalEvidence,configurable:true,writable:true});

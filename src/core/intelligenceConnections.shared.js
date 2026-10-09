const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const text = value => String(value == null ? '' : value).trim();
const nameKey = value => text(value).toLowerCase().replace(/\s+/g, ' ');
const finite = value => !['number','string'].includes(typeof value) || text(value) === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const belongs = (row, workspaceId) => Boolean(workspaceId && text(row.restaurantId || row.workspaceId) === workspaceId);
const owned = (values, workspaceId) => list(values).filter(row => belongs(row, workspaceId));
function isoTime(value) {
  try {
    const raw = value?.toDate ? value.toDate() : value?.seconds != null ? new Date(Number(value.seconds) * 1000) : value;
    const date = new Date(raw || '');
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  } catch (_) { return ''; }
}
function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const iso = isoTime(`${value}T12:00:00Z`);
    return iso.slice(0,10) === value ? value : '';
  }
  return isoTime(value).slice(0,10);
}
const shiftDate = row => dateKey(row.businessDate || row.date || row.shiftDate);
const weekday = value => new Date(`${value}T12:00:00Z`).getUTCDay();
const daysBetween = (a,b) => (new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000;
const ownerAuthority = actor => Boolean(actor?.isOwner || actor?.owner || actor?.accountOwner || actor?.workspaceOwner || actor?.isAdmin || text(actor?.accountRole).toLowerCase() === 'owner');
function hasAuthority(actor, workspaceId, permissions) {
  return Boolean(belongs(actor || {},workspaceId) && (ownerAuthority(actor) || permissions.some(key => actor?.permissions?.[key] === true)));
}
function sourceCompleteness(state = {}, limit = 400) {
  const reasons = [];
  if (state.resolved !== true) reasons.push('History is still loading.');
  if (state.allowed === false || state.complete === false || state.truncated) reasons.push('History coverage or permission is incomplete.');
  if (state.error) reasons.push('History could not be verified; retry when the connection recovers.');
  if (state.stale || state.cached) reasons.push('History has not been verified by the server.');
  if (list(state.data).length >= limit) reasons.push('The history row limit was reached; the loaded window may be incomplete.');
  return { complete:reasons.length === 0, reasons };
}
function normalizeItemSalesHistory({ workspaceId, sales, recipes, menuDependencies, targetDate, sourceState, limit = 400 } = {}) {
  const quality = sourceCompleteness(sourceState,limit);
  const recipeRows = owned(recipes,workspaceId);
  const links = owned(menuDependencies,workspaceId);
  const rows = [], seen = new Set();
  let rejectedRows = 0, aggregateOnlyDays = 0;
  for (const sale of owned(sales,workspaceId).slice(0,limit)) {
    const date = shiftDate(sale);
    if (!date) { rejectedRows++;continue; }
    if (date >= targetDate) continue;
    const items = Array.isArray(sale.lineItems) ? sale.lineItems : Array.isArray(sale.items) ? sale.items : Array.isArray(sale.menuItems) ? sale.menuItems : sale.recipeId || sale.menuItemId ? [sale] : [];
    if (!items.length) { aggregateOnlyDays++; continue; }
    for (const [index,item] of items.entries()) {
      if (!item || (item.restaurantId && item.restaurantId !== workspaceId)) { rejectedRows++; continue; }
      const candidates = new Set();
      if (item.recipeId) recipeRows.filter(recipe => recipe.id === item.recipeId).forEach(recipe => candidates.add(recipe.id));
      else if (item.menuItemId || item.itemId) {
        const id = item.menuItemId || item.itemId;
        recipeRows.filter(recipe => recipe.id === id).forEach(recipe => candidates.add(recipe.id));
        links.filter(link => link.menuItemId === id).forEach(link => {
          const ids = Array.isArray(link.recipeIds) ? link.recipeIds : [link.recipeId || link.batchRecipeId];
          ids.forEach(recipeId => { if (recipeRows.some(recipe => recipe.id === recipeId)) candidates.add(recipeId); });
        });
      } else {
        const key = nameKey(item.itemName || item.name);
        if (key) recipeRows.filter(recipe => nameKey(recipe.title || recipe.name) === key).forEach(recipe => candidates.add(recipe.id));
      }
      const quantity = finite(item.quantity ?? item.qty ?? item.count ?? item.units);
      const unit = nameKey(item.quantityUnit || item.unit || item.uom || 'each');
      if (candidates.size !== 1 || quantity === null || quantity < 0 || quantity > 100000 || !['each','ea','units','unit','portion','portions','serving','servings','count'].includes(unit)) { rejectedRows++; continue; }
      const recipeId = [...candidates][0];
      const matchedRecipe=recipeRows.find(recipe=>recipe.id===recipeId);
      const conversion = globalThis.__86ChaosOperationalEvidence.reviewedServingConversion(matchedRecipe,item.servingConversion || {});
      if (!conversion.ready) { rejectedRows++;continue; }
      const sourceId = text(sale.sourceId || sale.receiptId || sale.id);
      if (!sourceId) { rejectedRows++; continue; }
      const sourceLineId = `${sourceId}:${item.sourceLineId || item.lineId || index}`;
      if (seen.has(sourceLineId)) continue;
      seen.add(sourceLineId);
      rows.push({ id:sourceLineId, restaurantId:workspaceId, businessDate:date, recipeId, itemId:recipeId, quantity, unit:'each', sourceId, sourceLineId, ...(conversion.bulk ? {servingConversion:item.servingConversion} : {}) });
    };
  }
  if (rejectedRows) quality.reasons.push(`${rejectedRows} item row(s) have unresolved identity, quantity, or units.`);
  return { rows, rejectedRows, aggregateOnlyDays, complete:quality.complete && rejectedRows === 0, reasons:quality.reasons, mutationAllowed:false };
}
function buildReadinessSnapshot({ actor, workspaceId, date, readiness, existingSnapshots } = {}) {
  if (!hasAuthority(actor,workspaceId,['schedule','team','events'])) throw new Error('Event management permission is required to save readiness.');
  if (!dateKey(date)) throw new Error('A valid readiness date is required.');
  const sharedCategories = new Set(['inventory','prep','staffing','maintenance','foodSafety','food-safety','operations']);
  const snapshots = list(readiness?.categories).filter(row => sharedCategories.has(row.key)).map(row => ({ key:row.key, title:`Readiness: ${text(row.label || row.key)}`, status:text(row.status), score:finite(row.score) }));
  if (!snapshots.length) throw new Error('No shared readiness categories are available.');
  const signature = JSON.stringify(snapshots);
  if (owned(existingSnapshots,workspaceId).some(row => row.type === 'readiness_snapshot' && row.date === date && JSON.stringify(row.snapshots) === signature)) return null;
  return { restaurantId:workspaceId, type:'readiness_snapshot', title:'Restaurant readiness observation', date, createdAt:new Date().toISOString(), snapshots, source:'manager_readiness_review' };
}
function buildHistoryInputs({ workspaceId, events, invoices, alerts } = {}) {
  const readinessSnapshots = owned(events,workspaceId).filter(row => row.type === 'readiness_snapshot').flatMap(row => list(row.snapshots).map(category => ({ id:`${row.id}:${category.key}`,restaurantId:workspaceId,date:isoTime(row.createdAt) || dateKey(row.date),title:text(category.title || `Readiness: ${category.key}`),cause:`${category.key}:${category.status}`,status:category.status,evidenceId:row.id })));
  const receivingHistory = owned(invoices,workspaceId).filter(row => row.status === 'approved' && row.approvedAt).flatMap(row => list(row.lineItems).filter(line => finite(line.approvedStockQuantity) !== null).map((line,index) => ({ id:`${row.id}:received:${index}`,restaurantId:workspaceId,date:isoTime(row.approvedAt),title:'Approved invoice receiving',cause:line.substitution ? 'reviewed-substitution' : 'reviewed-receiving',status:'approved',evidenceId:row.id })));
  // Classified alert evidence only: raw error messages/request material are never copied.
  const errors = owned(alerts,workspaceId).filter(row => row.errorCategory || /error|failure|sync|integration/.test(nameKey(row.area || row.category || row.type))).map(row => ({ id:row.id,restaurantId:workspaceId,date:isoTime(row.createdAt || row.timestamp || row.updatedAt || row.date),title:'Operational error review',cause:text(row.errorCategory || row.category || row.area || 'operational-error').replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60),severity:text(row.severity),evidenceId:row.id }));
  return { readinessSnapshots, receivingHistory, errors };
}
function timeMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(text(value))) return null;
  const [hour,minute] = value.split(':').map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
function overlaps(a,b) {
  const start = timeMinutes(a.startTime), end = timeMinutes(a.endTime), otherStart = timeMinutes(b.startTime), otherEnd = timeMinutes(b.endTime);
  if ([start,end,otherStart,otherEnd].some(value => value === null)) return false;
  const finish = end <= start ? end + 1440 : end;
  const otherFinish = otherEnd <= otherStart ? otherEnd + 1440 : otherEnd;
  return start < otherFinish && otherStart < finish;
}
function buildScheduleForecast({ workspaceId, actor, currentDate, dates, sales, sourceState, coverageTargets, shifts, limit = 400 } = {}) {
  const allowed = hasAuthority(actor,workspaceId,['schedule','team']) && hasAuthority(actor,workspaceId,['sales','salesRead','financialRead','labor','laborRead','wageView','wageEdit']);
  if (!allowed) return { allowed:false,rows:[],automaticPublish:false,reason:'Schedule and sales/labor read permission are required.' };
  const quality = sourceCompleteness(sourceState,limit);
  const byDate = new Map();
  for (const sale of owned(sales,workspaceId)) {
    const date = shiftDate(sale), amount = finite(sale.netSales ?? sale.grossSales ?? sale.totalSales ?? sale.total);
    if (!date || date >= currentDate || amount === null || amount < 0) continue;
    if (byDate.has(date) && byDate.get(date) !== amount) byDate.set(date,null);
    else if (!byDate.has(date)) byDate.set(date,amount);
  }
  const rows = [];
  for (const date of list(dates).slice(0,35)) for (const target of owned(coverageTargets,workspaceId)) {
    if (!dateKey(date) || Number(target.dayIndex) !== weekday(date)) continue;
    const samples = [...byDate.entries()].filter(([day]) => day < date && weekday(day) === weekday(date) && daysBetween(day,currentDate) <= 112).sort(([a],[b]) => a.localeCompare(b)).slice(-8);
    const valid = samples.filter(([,amount]) => amount !== null);
    const baselineCount = finite(target.count);
    const role = text(target.role), targetStart = timeMinutes(target.startTime), targetEnd = timeMinutes(target.endTime);
    let reason = quality.reasons.join(' ');
    if (!quality.complete || samples.length !== valid.length) reason ||= 'Comparable daily totals conflict; review duplicate sales records.';
    else if (valid.length < 3) reason = `Only ${valid.length} comparable weekdays are available; 3 are required.`;
    else if (daysBetween(valid.at(-1)[0],currentDate) > 28) reason = 'Comparable sales history is more than 28 days old.';
    else if (daysBetween(currentDate,date) < 0 || daysBetween(currentDate,date) > 35) reason = 'Forecasts cover today through the next 35 days.';
    else if (!role || !(baselineCount > 0 && baselineCount <= 50) || targetStart === null || targetEnd === null || targetStart === targetEnd) reason = 'Configure a valid role, coverage count, and shift time window.';
    const base = { id:`forecast:${target.id}:${date}`,targetId:target.id,workspaceId,date,role,baselineCount,startTime:target.startTime,endTime:target.endTime,reviewRequired:true };
    if (reason) { rows.push({...base,state:'insufficient-data',reason,needed:null});continue; }
    const average = valid.reduce((sum,[,amount])=>sum+amount,0) / valid.length;
    if (average <= 0) { rows.push({...base,state:'insufficient-data',reason:'Comparable sales are zero; demand cannot establish a staffing ratio.',needed:null});continue; }
    const recent = valid.slice(-3).reduce((sum,[,amount])=>sum+amount,0)/Math.min(3,valid.length);
    const expectedDemand = average*0.6+recent*0.4;
    const factor = Math.max(0.8,Math.min(1.5,expectedDemand/average));
    const forecastCount = Math.min(50,Math.ceil(baselineCount*factor));
    const existing = owned(shifts,workspaceId).filter(shift => shiftDate(shift) === date && !shift.isDeleted && !shift.deletedAt && !shift.cancelled && nameKey(shift.role || shift.targetRole) === nameKey(role) && overlaps(shift,target)).length;
    rows.push({...base,state:'recommendation',forecastCount,existing,needed:Math.max(0,forecastCount-existing),confidence:Math.min(0.9,0.45+valid.length*0.05),reason:`Configured coverage ${baselineCount}; recent comparable sales trend ${Math.round((factor-1)*100)}%. Review ${forecastCount} ${role} shifts.`,evidence:{dates:valid.map(([day])=>day),average,recent,expectedDemand,factor},automaticPublish:false});
  }
  return { allowed,rows:rows.slice(0,100),complete:quality.complete,automaticPublish:false };
}
function buildTrainingDraft({ actor, workspaceId, opportunity, now = new Date().toISOString() } = {}) {
  if (!hasAuthority(actor,workspaceId,['hr'])) throw new Error('HR permission is required to review operational training.');
  if (!belongs(opportunity || {},workspaceId)) throw new Error('Training evidence belongs to another workspace.');
  return { workspaceId,title:text(opportunity.title).slice(0,160),reason:text(opportunity.reason).slice(0,500),evidenceIds:list(opportunity.evidenceIds).map(text).slice(0,20),roleScope:list(opportunity.roleScope).map(text).slice(0,10),createdAt:isoTime(now),automaticAssignment:false,cause:text(opportunity.cause).slice(0,160),category:text(opportunity.category).slice(0,40) };
}
function forecastDraftId(row,workspaceId,slot) {
  if (row.workspaceId !== workspaceId || !row.targetId || !dateKey(row.date) || !Number.isInteger(slot) || slot < 0 || slot >= 50) throw new Error('Invalid forecast draft identity.');
  return `forecast_${encodeURIComponent(workspaceId)}_${encodeURIComponent(row.targetId)}_${row.date}_${slot}`;
}
function isForecastCandidateEligible({person,date,startTime,endTime,shifts,loadedDates} = {}) {
  if (!person || person.isActive === false) return false;
  const aliases = new Set([person.id,person.uid,person.authUid,person.userId,person.rosterUserId].filter(Boolean));
  if (!aliases.size) return false;
  const mine = owned(shifts,person.restaurantId).filter(row => !row.isDeleted && !row.deletedAt && !row.cancelled && [row.employeeId,row.scheduleUserId,row.userId,row.rosterUserId].some(id => aliases.has(id)));
  const start = timeMinutes(startTime), end = timeMinutes(endTime);
  if (start === null || end === null) return false;
  const duration = end <= start ? end+1440-start : end-start;
  const begin = new Date(`${date}T00:00:00Z`).getTime()/60000+start;
  for (const shift of mine) {
    const otherDate = shiftDate(shift), otherStart = timeMinutes(shift.startTime), otherEnd = timeMinutes(shift.endTime);
    if (!otherDate || otherStart === null || otherEnd === null) return false;
    const otherBegin = new Date(`${otherDate}T00:00:00Z`).getTime()/60000+otherStart;
    const otherFinish = otherBegin+(otherEnd <= otherStart ? otherEnd+1440-otherStart : otherEnd-otherStart);
    if (begin < otherFinish && otherBegin < begin+duration) return false;
  }
  const maximum = finite(person.maxWeeklyHours ?? person.maxHoursPerWeek);
  if (maximum !== null) {
    const monday = new Date(`${date}T12:00:00Z`);monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
    const week = Array.from({length:7},(_,index)=>{const day=new Date(monday);day.setUTCDate(day.getUTCDate()+index);return day.toISOString().slice(0,10);});
    if (!week.every(day=>list(loadedDates).includes(day))) return false;
    const hours = mine.filter(shift=>week.includes(shiftDate(shift))).reduce((sum,shift)=>{const a=timeMinutes(shift.startTime),b=timeMinutes(shift.endTime);return sum+(b <= a ? b+1440-a : b-a)/60;},0);
    if (hours+duration/60 > maximum) return false;
  }
  return true;
}
async function saveForecastDraft({ transact, ref, payload } = {}) {
  return transact(async transaction => {
    const prior = await transaction.get(ref);
    if (prior.exists()) {
      if (prior.data().restaurantId !== payload.restaurantId) throw new Error('Forecast draft belongs to another workspace.');
      return {created:false};
    }
    transaction.set(ref,payload);
    return {created:true};
  });
}
function readTrainingDraft(draft,workspaceId,actor,now = new Date().toISOString()) {
  if (!draft || !hasAuthority(actor,workspaceId,['hr']) || draft.workspaceId !== workspaceId || !isoTime(draft.createdAt)) return null;
  const age = new Date(now)-new Date(draft.createdAt);
  if (!Number.isFinite(age) || age < 0 || age > 10*60000) return null;
  return buildTrainingDraft({actor,workspaceId,opportunity:draft,now:draft.createdAt});
}
function buildClockAwareness({ workspaceId,actor,timePunches,users,shifts,shiftSourceState,attendancePolicy,now = new Date().toISOString(),sourceState,limit = 200 } = {}) {
  const allowed = hasAuthority(actor,workspaceId,['labor','laborRead','wageView','wageEdit']);
  const quality = sourceCompleteness(sourceState,limit);
  if (!allowed) return { allowed:false,complete:false,findings:[],mutationAllowed:false };
  const active = owned(timePunches,workspaceId).filter(row => ['clocked_in','on_break'].includes(nameKey(row.status)) && !row.clockOut && !row.clockOutTime);
  const groups = new Map(), findings = [];
  for (const row of active) {
    const employeeId = text(row.userId || row.employeeId || row.authUid);
    if (!employeeId) continue;
    if (!groups.has(employeeId)) groups.set(employeeId,[]);
    groups.get(employeeId).push(row);
    const start = isoTime(row.clockIn || row.clockInTime || row.clockInAt);
    const hours = start ? (new Date(now)-new Date(start))/3600000 : NaN;
    if (Number.isFinite(hours) && hours > 12 && quality.complete) findings.push({id:`clock:long:${row.id}`,kind:'long-open-punch',employeeId,evidenceIds:[row.id],reason:`An open punch is ${Math.floor(hours)} hours old. Verify whether a clock-out is missing.`});
  }
  if (quality.complete) for (const [employeeId,group] of groups) if (group.length > 1) findings.push({id:`clock:duplicate:${employeeId}`,kind:'duplicate-active-punch',employeeId,evidenceIds:group.map(row=>row.id),reason:`${group.length} active punches share this employee identity. Review before payroll.`});
  let attendance = {findings:[],reasons:[],policyConfigured:false};
  if (shifts !== undefined) {
    const shiftQuality=sourceCompleteness(shiftSourceState,shiftSourceState?.limit || 500);
    if(quality.complete && shiftQuality.complete)attendance=globalThis.__86ChaosAttendanceEvidence.attendanceFindings({workspaceId,shifts:owned(shifts,workspaceId),punches:owned(timePunches,workspaceId),users:owned(users,workspaceId),policy:attendancePolicy,now:new Date(now).getTime()});
    else attendance.reasons=['Shift/punch coverage is incomplete; attendance exceptions are not inferred.'];
    findings.push(...attendance.findings);
  }
  const roster = owned(users,workspaceId);
  return {allowed,complete:quality.complete,reasons:[...quality.reasons,...attendance.reasons],attendanceComplete:attendance.policyConfigured && !attendance.reasons.length,policyConfigured:attendance.policyConfigured,findings:findings.slice(0,30).map(row=>({...row,employeeName:text(roster.find(person=>[person.id,person.uid,person.authUid,person.userId].includes(row.employeeId))?.name || 'Employee'),reviewRequired:true})),mutationAllowed:false};
}
const intelligenceConnections = { isoTime,dateKey,sourceCompleteness,normalizeItemSalesHistory,buildReadinessSnapshot,buildHistoryInputs,buildScheduleForecast,forecastDraftId,isForecastCandidateEligible,saveForecastDraft,buildTrainingDraft,readTrainingDraft,buildClockAwareness };
Object.defineProperty(globalThis,'__86ChaosIntelligenceConnections',{value:intelligenceConnections,configurable:true,writable:true});

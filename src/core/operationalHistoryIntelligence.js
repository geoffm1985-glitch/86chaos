const rows = value => Array.isArray(value) ? value : [];
const text = value => String(value == null ? '' : value).trim();
const lower = value => text(value).toLowerCase();
const permitted = actor => Boolean(actor?.isOwner || actor?.owner || actor?.accountOwner || actor?.workspaceOwner || actor?.isAdmin || actor?.isManager || actor?.permissions?.ops || actor?.permissions?.team || actor?.permissions?.hr || /(?:^|\s)(?:owner|admin|manager)(?:\s|$)/.test(lower(actor?.role || actor?.accountRole)));

function buildOperationalHistory(input = {}) {
  const workspaceId = text(input.workspaceId || input.restaurantId);
  const actor = input.actor || {};
  if (!permitted(actor) || (actor.restaurantId && actor.restaurantId !== workspaceId)) return { schemaVersion:1, workspaceId, allowed:false, events:[], trends:[], trainingOpportunities:[], reason:'Manager, admin, or owner permission is required.' };
  const retentionDays = Math.max(7, Math.min(730, Number(input.retentionDays || 180)));
  const now = input.now ? new Date(input.now) : new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 86400000);
  const sources = [
    ['readiness', input.readinessSnapshots], ['86', input.outageEvents], ['prep', input.prepHistory], ['receiving', input.receivingHistory],
    ['invoice', input.invoiceHistory], ['waste', input.wasteLogs], ['maintenance', input.maintenanceLogs], ['incident', input.incidents], ['error', input.errors]
  ];
  const events = [];
  for (const [category,list] of sources) for (const row of rows(list)) {
    if (row.restaurantId && workspaceId && text(row.restaurantId) !== workspaceId) continue;
    const at = new Date(row.at || row.date || row.createdAt || row.updatedAt || 0);
    if (!Number.isFinite(at.getTime()) || at < cutoff || at > now) continue;
    events.push({ id:text(row.id || `${category}:${at.toISOString()}:${row.title || row.reason || events.length}`), workspaceId, category, at:at.toISOString(), title:text(row.title || row.itemName || row.equipment || row.reason || category), cause:text(row.cause || row.reason || row.classification || row.errorCategory || 'unknown'), outcome:text(row.outcome || row.status || ''), severity:lower(row.severity || row.priority || 'info'), evidenceId:text(row.evidenceId || row.sourceId || row.id || '') });
  }
  events.sort((a,b) => b.at.localeCompare(a.at));
  events.splice(500);
  const buckets = new Map();
  for (const event of events) {
    const key = `${event.category}|${lower(event.cause || event.title)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(event);
  }
  const trends = [...buckets.entries()].filter(([,group]) => group.length >= 2).map(([key,group]) => ({ id:`trend:${key}`, workspaceId, category:group[0].category, cause:group[0].cause, count:group.length, firstSeen:group[group.length-1].at, lastSeen:group[0].at, severity:group.some(row => ['critical','high'].includes(row.severity)) ? 'high' : 'attention', evidenceIds:group.map(row => row.evidenceId || row.id).slice(0,20), explainable:true })).sort((a,b) => b.count-a.count || a.id.localeCompare(b.id));
  const trainingOpportunities = trends.filter(row => ['86','prep','receiving','waste','incident','error','readiness','maintenance'].includes(row.category) && !(row.category === 'readiness' && row.cause.endsWith(':ready'))).map(row => ({ id:`training:${row.id}`, workspaceId, title:`Review repeated ${row.category} issue`, reason:`${row.count} events share the cause “${row.cause}”.`, roleScope:row.category === 'receiving' ? ['manager','receiver'] : row.category === 'error' ? ['manager'] : ['manager','kitchen'], reviewRequired:true, automaticAssignment:false, evidenceIds:row.evidenceIds }));
  return { schemaVersion:1, workspaceId, allowed:true, retentionDays, events:events.slice(0,500), trends:trends.slice(0,100), trainingOpportunities:trainingOpportunities.slice(0,40), bounded:true, queryGuidance:{ orderBy:'at desc', limit:500, tenantFilterRequired:true } };
}

export { buildOperationalHistory };

export default { buildOperationalHistory };

'use strict';
function normalize(value = '') { return String(value ?? ''); }
function cacheEntryMatchesBoundary(row = {}, boundary = {}) {
  const clearAll = boundary.all === true;
  if (clearAll) return true;
  const projectId = boundary.projectId || null;
  const restaurantId = boundary.restaurantId || boundary.restId || null;
  const viewerUid = boundary.viewerUid || boundary.userId || null;
  const userSensitiveOnly = boundary.userSensitiveOnly === true;
  const cacheScope = boundary.cacheScope || boundary.cacheTag || '';
  const debugLabelPrefix = boundary.debugLabelPrefix || '';
  if (userSensitiveOnly && row.userSensitive !== true) return false;
  if (cacheScope && normalize(row.cacheScope || row.cacheTag || '') !== normalize(cacheScope)) return false;
  if (debugLabelPrefix && !normalize(row.debugLabel || '').startsWith(normalize(debugLabelPrefix))) return false;
  if (projectId && normalize(row.projectId || '') !== normalize(projectId)) return false;
  if (restaurantId && normalize(row.restaurantId || row.restId || '') !== normalize(restaurantId)) return false;
  if (viewerUid && normalize(row.viewerUid || '') !== normalize(viewerUid)) return false;
  return Boolean(projectId || restaurantId || viewerUid || userSensitiveOnly || cacheScope || debugLabelPrefix);
}
function buildTodayBriefCacheBoundary({ projectId = 'default', restaurantId = '', viewerUid = '' } = {}) {
  return { projectId, restaurantId, viewerUid, cacheScope: 'today-brief' };
}
module.exports = { cacheEntryMatchesBoundary, buildTodayBriefCacheBoundary };

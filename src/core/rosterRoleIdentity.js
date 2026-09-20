const rosterRoleCore = require('./rosterRoleIdentity.shared.js');
const { cleanRoleName, roleNameKey, normalizeRosterRole, activeRosterRoles, resolveShiftRosterRole, copyRosterRoleFields } = rosterRoleCore;
export { normalizeRosterRole, activeRosterRoles, resolveShiftRosterRole, copyRosterRoleFields };

export function buildRosterRoleCreateFields(name, restaurantId, nowIso = new Date().toISOString()) {
  return { name: cleanRoleName(name), restaurantId: String(restaurantId || '').trim(), revision: 1, previousNames: [], archived: false, archivedAt: null, createdAt: nowIso, updatedAt: nowIso };
}

export function buildRosterRoleRenameFields(role, nextName, nowIso = new Date().toISOString()) {
  const current = normalizeRosterRole(role);
  const name = cleanRoleName(nextName);
  const previousNames = Array.from(new Set([...current.previousNames, current.name].map(cleanRoleName).filter(value => value && roleNameKey(value) !== roleNameKey(name))));
  return { name, previousNames, revision: current.revision + 1, updatedAt: nowIso };
}

export function buildRosterRoleArchiveFields(role, nowIso = new Date().toISOString()) {
  const current = normalizeRosterRole(role);
  return { archived: true, archivedAt: nowIso, revision: current.revision + 1, updatedAt: nowIso };
}

export function rosterRoleConfigurationRevision(roles = []) {
  const rows = (roles || []).map(normalizeRosterRole).filter(role => role.id)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(role => `${role.id}:${role.revision}:${role.archived ? 1 : 0}:${roleNameKey(role.name)}:${role.previousNames.map(roleNameKey).sort().join(',')}`).join('|');
  return `roles-v1|${rows || 'empty'}`;
}

export { cleanRoleName, roleNameKey };

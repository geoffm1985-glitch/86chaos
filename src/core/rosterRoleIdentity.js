const cleanRoleName = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const roleNameKey = (value = '') => cleanRoleName(value).toLocaleLowerCase();

export function normalizeRosterRole(role = {}) {
  const id = String(role.id || role.rosterRoleId || '').trim();
  const name = cleanRoleName(role.name || role.label || role.title || '');
  return {
    ...role,
    id,
    rosterRoleId: id,
    name,
    revision: Math.max(1, Number(role.revision || 1)),
    previousNames: Array.from(new Set((Array.isArray(role.previousNames) ? role.previousNames : [])
      .map(cleanRoleName).filter(Boolean))),
    archived: role.archived === true || Boolean(role.archivedAt),
  };
}

export function activeRosterRoles(roles = []) {
  return (roles || []).map(normalizeRosterRole).filter(role => role.id && role.name && !role.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveShiftRosterRole(shift = {}, roles = []) {
  const normalized = (roles || []).map(normalizeRosterRole).filter(role => role.id);
  const explicitId = String(shift.rosterRoleId || '').trim();
  if (explicitId) {
    const exact = normalized.find(role => role.id === explicitId);
    if (!exact) return { ok: false, reason: 'role-id-not-found', rosterRoleId: explicitId };
    return { ok: true, source: 'canonical-id', role: exact, rosterRoleId: exact.id, rosterRoleNameSnapshot: exact.name, migratable: false };
  }

  const legacyName = cleanRoleName(shift.rosterRoleNameSnapshot || shift.role || shift.scheduleRole || shift.targetRole || '');
  if (!legacyName) return { ok: false, reason: 'missing-role-identity' };
  const key = roleNameKey(legacyName);
  const matches = normalized.filter(role => roleNameKey(role.name) === key || role.previousNames.some(name => roleNameKey(name) === key));
  if (matches.length !== 1) return { ok: false, reason: matches.length ? 'ambiguous-legacy-role-name' : 'legacy-role-name-not-found', legacyName };
  const match = matches[0];
  if (match.archived) return { ok: false, reason: 'legacy-role-resolves-to-archived-role', legacyName, rosterRoleId: match.id };
  return { ok: true, source: 'unique-legacy-name', role: match, rosterRoleId: match.id, rosterRoleNameSnapshot: match.name, migratable: true };
}

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

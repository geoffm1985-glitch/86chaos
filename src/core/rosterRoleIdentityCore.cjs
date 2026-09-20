'use strict';
const cleanRoleName = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
const roleNameKey = (value = '') => cleanRoleName(value).toLowerCase();

function normalizeRosterRole(role = {}) {
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

function activeRosterRoles(roles = []) {
  return (roles || []).map(normalizeRosterRole).filter(role => role.id && role.name && !role.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function resolveShiftRosterRole(shift = {}, roles = []) {
  const normalized = (roles || []).map(normalizeRosterRole).filter(role => role.id);
  const explicitId = String(shift.rosterRoleId || '').trim();
  if (explicitId) {
    const exactRows = normalized.filter(role => role.id === explicitId);
    if (exactRows.length > 1) return { ok: false, reason: 'duplicate-role-id', rosterRoleId: explicitId };
    const exact = exactRows[0];
    if (!exact) return { ok: false, reason: 'role-id-not-found', rosterRoleId: explicitId };
    return { ok: true, source: 'canonical-id', role: exact, rosterRoleId: exact.id, rosterRoleNameSnapshot: exact.name, migratable: false };
  }

  // Trim each field before selecting; whitespace snapshots must not hide valid legacy metadata.
  const legacyName = [shift.rosterRoleNameSnapshot, shift.scheduleRole, shift.targetRole, shift.role].map(cleanRoleName).find(Boolean) || '';
  if (!legacyName) return { ok: false, reason: 'missing-role-identity' };
  const key = roleNameKey(legacyName);
  const matches = normalized.filter(role => roleNameKey(role.name) === key || role.previousNames.some(name => roleNameKey(name) === key));
  if (matches.length !== 1) return { ok: false, reason: matches.length ? 'ambiguous-legacy-role-name' : 'legacy-role-name-not-found', legacyName };
  const match = matches[0];
  if (match.archived) return { ok: false, reason: 'legacy-role-resolves-to-archived-role', legacyName, rosterRoleId: match.id };
  return { ok: true, source: 'unique-legacy-name', role: match, rosterRoleId: match.id, rosterRoleNameSnapshot: match.name, migratable: true };
}


function copyRosterRoleFields(shift = {}) {
  return Object.fromEntries(['rosterRoleId','rosterRoleNameSnapshot','scheduleRole','targetRole','role'].filter(key => shift[key] !== undefined).map(key => [key, shift[key]]));
}
module.exports = { cleanRoleName, roleNameKey, normalizeRosterRole, activeRosterRoles, resolveShiftRosterRole, copyRosterRoleFields };

'use strict';
function clean(value = '') { return String(value == null ? '' : value).trim(); }
function normalizeTime(value = '') {
  const raw = clean(value);
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
function normalizePreset(input = {}) {
  const label = clean(input.label || input.name).replace(/\s+/g, ' ').slice(0, 48);
  const start = normalizeTime(input.start || input.startTime);
  const end = normalizeTime(input.end || input.endTime);
  const id = clean(input.id || input.presetId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  if (!label || !start || !end || start === end) return null;
  return { id, label, start, end };
}
function presetKey(p = {}) { return `${String(p.label || '').toLowerCase()}|${p.start}|${p.end}`; }
function dedupePresets(rows = []) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const p = normalizePreset(row);
    if (!p) continue;
    const key = presetKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label));
}
function canEditSchedule(ctx = {}) {
  const user = ctx.user || {};
  const permissions = user.permissions || ctx.permissions || {};
  return Boolean(ctx.isSuperAdmin || user.isOwner || user.accountOwner || user.owner || user.workspaceOwner || user.isAdmin || /owner|manager|admin/i.test(String(user.role || user.accountRole || '')) || permissions.schedule === true || permissions.scheduleEditing === true || permissions.scheduleBuilder === true);
}

module.exports = { normalizeTime, normalizePreset, presetKey, dedupePresets, canEditSchedule };

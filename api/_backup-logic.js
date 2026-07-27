'use strict';

function durationToSeconds(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d+d$/i.test(text)) return Number(text.slice(0, -1)) * 86400;
  const match = text.match(/^(\d+)(?:\.(\d{1,9}))?s$/i);
  if (match) return Number(match[1]) + Number(`0.${match[2] || '0'}`);
  if (/^\d+$/.test(text)) return Number(text);
  return null;
}

function secondsToDays(seconds) {
  return Number.isFinite(Number(seconds)) ? Math.round((Number(seconds) / 86400) * 100) / 100 : null;
}

function exactDatabaseResource(projectId, databaseId) {
  return `projects/${String(projectId || '').trim()}/databases/${String(databaseId || '').trim()}`;
}

function databaseResourceFromSchedule(schedule = {}) {
  if (typeof schedule.database === 'string' && schedule.database.trim()) return schedule.database.trim();
  const candidates = [schedule.name, schedule.parent, schedule.databaseName].filter(value => typeof value === 'string' && value.trim());
  for (const text of candidates) {
    const match = text.match(/^projects\/[^/\s]+\/databases\/[^/\s]+(?:\/backupSchedules\/[^/\s]+)?$/);
    if (match) return match[0].replace(/\/backupSchedules\/[^/\s]+$/, '');
    const embedded = text.match(/projects\/[^"\s/]+\/databases\/[^"\s/,}]+/);
    if (embedded) return embedded[0];
  }
  return '';
}

function scheduleRetentionSeconds(schedule = {}) {
  return durationToSeconds(schedule.retention || schedule.retentionDuration || schedule.retentionPeriod || schedule.backupRetention || '');
}

function scheduleIsDaily(schedule = {}) {
  if (schedule.dailyRecurrence && typeof schedule.dailyRecurrence === 'object') return true;
  const recurrence = String(schedule.recurrence || schedule.frequency || '').toUpperCase();
  return recurrence === 'DAILY' || recurrence.includes('DAILY');
}

function successfulBackupForDatabase(backups = [], databaseResource = '') {
  const successfulStates = new Set(['READY']);
  return (Array.isArray(backups) ? backups : [])
    .filter(row => String(row?.database || '') === databaseResource)
    .filter(row => successfulStates.has(String(row?.state || '').toUpperCase()))
    .filter(row => row?.snapshotTime || row?.createTime)
    .sort((a, b) => String(b.snapshotTime || b.createTime || '').localeCompare(String(a.snapshotTime || a.createTime || '')))[0] || null;
}

function sanitizeBackupError(value, fallback = 'Native backup verification failed') {
  return String(value || fallback)
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/(private[_ -]?key|token|secret|authorization|credential)[=:]\s*[^\s,;}]+/gi, '$1=[redacted]')
    .replace(/[A-Za-z0-9_\-]{100,}/g, '[redacted]')
    .slice(0, 220);
}

module.exports = {
  durationToSeconds,
  secondsToDays,
  exactDatabaseResource,
  databaseResourceFromSchedule,
  scheduleRetentionSeconds,
  scheduleIsDaily,
  successfulBackupForDatabase,
  sanitizeBackupError
};

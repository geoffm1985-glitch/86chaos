'use strict';
function withPresenceTimeout(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: 'PRESENCE_TIMEOUT' })), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
function presenceDiagnostic(app, error, source) {
  const raw = String(error?.message || '');
  return { projectId: String(app?.options?.projectId || ''), configuredDatabaseUrl: Boolean(app?.options?.databaseURL),
    code: /404/.test(raw) ? 'RTDB_INSTANCE_NOT_FOUND' : /401|403/.test(raw) ? 'RTDB_ACCESS_DENIED' : /timed out|abort/i.test(raw) ? 'RTDB_TIMEOUT' : error ? 'RTDB_UNAVAILABLE' : 'RTDB_READ_OK',
    source, pathFamily: 'statusSummary', checkedAt: new Date().toISOString(),
    guidance: /404/.test(raw) ? 'Verify the database instance and project URL for the selected environment. An empty RTDB path normally returns null, not 404.' : '' };
}
module.exports = { withPresenceTimeout, presenceDiagnostic };

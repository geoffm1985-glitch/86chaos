const { initAdmin, authorize, requireAppCheckIfEnforced, writeAudit } = require('./_chaos-admin');
const { APP_VERSION } = require('./_version');
const { durationToSeconds, secondsToDays, exactDatabaseResource, databaseResourceFromSchedule, scheduleRetentionSeconds, scheduleIsDaily, successfulBackupForDatabase, sanitizeBackupError } = require('./_backup-logic');
const { projectCredentialStatus } = require('./_firebase-project-admin');

const DEFAULT_STALE_HOURS = 26;
const REQUIRED_NATIVE_BACKUP_PERMISSIONS = ['datastore.backupSchedules.list', 'datastore.backups.list'];
const RECOMMENDED_NATIVE_BACKUP_ROLES = ['roles/datastore.backupSchedulesViewer', 'roles/datastore.backupsViewer'];

async function authorizeWatchdog(req, app) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return { ok: true, source: 'vercel-cron', actor: 'Vercel Cron Watchdog', isSuperAdmin: true };
  const appCheck = await requireAppCheckIfEnforced(app, req);
  if (!appCheck.ok) return appCheck;
  const ctx = await authorize(req, app, { allowTenantAdmin: false });
  if (!ctx.ok || !ctx.isSuperAdmin) return { ok: false, status: ctx.status || 403, error: ctx.error || 'Super admin required.' };
  return { ...ctx, source: 'manual-watchdog', actor: ctx.email || ctx.uid || 'System Administrator' };
}
async function accessTokenForApp(app) {
  const credential = app.options?.credential;
  if (credential && typeof credential.getAccessToken === 'function') {
    const token = await credential.getAccessToken();
    return token.access_token || token.accessToken;
  }
  throw Object.assign(new Error('Firebase Admin credential cannot mint a Google API access token for backup verification.'), { statusCode: 503 });
}
async function googleGet(app, url) {
  const token = await accessTokenForApp(app);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = body?.error?.message || response.statusText || 'Firestore Admin API request failed';
    const safe = String(raw).replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/[A-Za-z0-9_\-]{80,}/g, '[redacted]').slice(0, 220);
    const err = new Error(`Firestore Admin API ${response.status}: ${safe}`);
    err.statusCode = response.status === 401 ? 401 : response.status === 403 ? 403 : 503;
    err.safeCategory = response.status === 401 ? 'auth_required' : response.status === 403 ? 'permission_denied' : 'admin_api_unavailable';
    throw err;
  }
  return body;
}
async function googleGetPaged(app, url, arrayKey) {
  const rows = [];
  const unreachableLocations = [];
  let pageToken = '';
  let pageCount = 0;
  do {
    const sep = url.includes('?') ? '&' : '?';
    const body = await googleGet(app, pageToken ? `${url}${sep}pageToken=${encodeURIComponent(pageToken)}` : url);
    pageCount += 1;
    if (Array.isArray(body[arrayKey])) rows.push(...body[arrayKey]);
    if (Array.isArray(body.unreachable)) unreachableLocations.push(...body.unreachable);
    if (Array.isArray(body.unreachableLocations)) unreachableLocations.push(...body.unreachableLocations);
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return { rows, unreachableLocations: [...new Set(unreachableLocations)], pageCount, status: 200 };
}
function shouldWriteStatus(previous = {}, next = {}, manual = false) {
  if (manual) return true;
  return ['status','lastStatus','nativeBackupVerified','nativeBackupScheduleName','nativeBackupLatestState','lastError','nativeBackupLastSuccessfulAt','nativeBackupSetupIncompleteReason','nativeBackupRetentionSeconds','backupWatchdogStale']
    .some(key => String(previous[key] ?? '') !== String(next[key] ?? ''));
}
function statusCodeForHealth({ authorized = true, setupComplete = false, apiError = false, forbidden = false }) {
  if (!authorized) return 401;
  if (forbidden) return 403;
  if (apiError) return 503;
  if (!setupComplete) return 424;
  return 200;
}

function nativeBackupIamDiagnostic(projectId = '', databaseId = '') {
  const credential = projectCredentialStatus(projectId);
  return {
    requiredPermissions: REQUIRED_NATIVE_BACKUP_PERMISSIONS,
    recommendedRoles: RECOMMENDED_NATIVE_BACKUP_ROLES,
    projectId,
    databaseId,
    serviceAccountEmail: credential.serviceAccountEmail || '',
    credentialSource: credential.source || credential.recommendedEnv || credential.error || ''
  };
}
function nativeBackupPermissionMessage(projectId = '', serviceAccountEmail = '') {
  const target = serviceAccountEmail ? `runtime service account ${serviceAccountEmail}` : 'the runtime Firebase Admin service account';
  return `The Firebase Admin service account can authenticate but does not have permission to read native Firestore backup schedules/backups. Grant ${RECOMMENDED_NATIVE_BACKUP_ROLES.join(' and ')} to ${target} in project ${projectId || 'the active Firebase project'}.`;
}

module.exports = async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET for cron or POST for manual watchdog check.' });
  const startedAt = new Date();
  let app;
  let db;
  let statusRef;
  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID || '';
  const databaseId = process.env.FIRESTORE_NATIVE_BACKUP_DATABASE_ID || '(default)';
  const retentionInput = process.env.FIRESTORE_NATIVE_BACKUP_RETENTION || `${process.env.FIRESTORE_NATIVE_BACKUP_RETENTION_DAYS || 30}d`;
  const expectedRetentionSeconds = durationToSeconds(retentionInput);
  const staleHours = Math.max(1, Number(process.env.BACKUP_WATCHDOG_STALE_HOURS || DEFAULT_STALE_HOURS));
  let previous = {};
  try {
    app = initAdmin(req);
    db = app.firestore();
    projectId = app.options?.projectId || projectId;
    statusRef = db.collection('system').doc('backupStatus');
    const ctx = await authorizeWatchdog(req, app);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ ok: false, error: ctx.error });
    const previousSnap = await statusRef.get();
    previous = previousSnap.exists ? previousSnap.data() || {} : {};
    const dbResource = exactDatabaseResource(projectId, databaseId);
    const scheduleUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/backupSchedules`;
    const backupsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/locations/-/backups`;
    const [schedulePage, backupPage] = await Promise.all([googleGetPaged(app, scheduleUrl, 'backupSchedules'), googleGetPaged(app, backupsUrl, 'backups')]);
    const allSchedules = schedulePage.rows;
    const allBackups = backupPage.rows;
    const unreachableLocations = [...new Set([...(schedulePage.unreachableLocations || []), ...(backupPage.unreachableLocations || [])])];
    const schedules = allSchedules.filter(s => databaseResourceFromSchedule(s) === dbResource && scheduleIsDaily(s));
    const retentionMatches = schedules.filter(s => scheduleRetentionSeconds(s) === expectedRetentionSeconds);
    const backups = allBackups.filter(b => String(b.database || '') === dbResource);
    const successful = successfulBackupForDatabase(backups, dbResource);
    const latestAt = successful?.snapshotTime || successful?.createTime || '';
    const ageHours = latestAt ? (startedAt.getTime() - new Date(latestAt).getTime()) / 36e5 : Infinity;
    const exactlyOneSchedule = schedules.length === 1;
    const retentionOk = exactlyOneSchedule && retentionMatches.length === 1;
    const backupReady = Boolean(successful && Number.isFinite(ageHours));
    const fresh = backupReady && ageHours < staleHours;
    const verified = exactlyOneSchedule && retentionOk && backupReady && fresh && unreachableLocations.length === 0;
    const setupIncompleteReason = verified ? '' : (unreachableLocations.length ? `Firestore Admin API reported unreachable backup locations: ${unreachableLocations.join(', ')}` : !exactlyOneSchedule ? `Expected exactly one daily schedule for ${dbResource}; found ${schedules.length}.` : !retentionOk ? `Daily schedule retention does not match ${retentionInput}.` : !backupReady ? 'No successful READY native backup is visible for the exact database.' : 'Latest native backup is stale.');
    const next = {
      status: verified ? 'ok' : 'attention',
      lastStatus: verified ? 'ok' : 'attention',
      backupMode: 'native-scheduled-plus-manual-json',
      nativeBackupVerified: verified,
      nativeBackupSetupIncompleteReason: setupIncompleteReason,
      nativeBackupScheduleName: schedules[0]?.name || '',
      nativeBackupScheduleCount: schedules.length,
      nativeBackupSchedulePages: schedulePage.pageCount,
      nativeBackupPages: backupPage.pageCount,
      nativeBackupUnreachableLocations: unreachableLocations,
      nativeBackupScheduleRecurrence: schedules[0] ? 'DAILY' : '',
      nativeBackupRetention: schedules[0]?.retention || schedules[0]?.retentionDuration || retentionInput,
      nativeBackupRetentionSeconds: schedules[0] ? scheduleRetentionSeconds(schedules[0]) : null,
      nativeBackupRetentionDays: schedules[0] ? secondsToDays(scheduleRetentionSeconds(schedules[0])) : secondsToDays(expectedRetentionSeconds),
      nativeBackupLatestName: successful?.name || '',
      nativeBackupLatestState: successful?.state || '',
      nativeBackupLastSuccessfulAt: latestAt || '',
      nativeBackupSnapshotTime: successful?.snapshotTime || '',
      nativeBackupExpireTime: successful?.expireTime || '',
      backupAgeHours: Number.isFinite(ageHours) ? Math.round(ageHours * 10) / 10 : null,
      backupWatchdogStale: !fresh,
      backupWatchdogStaleHours: staleHours,
      lastWatchdogCheckAt: startedAt.toISOString(),
      lastWatchdogSource: ctx.source,
      lastWatchdogVersion: APP_VERSION,
      lastWatchdogResult: verified ? 'verified' : 'attention',
      nativeBackupPermissionState: 'ok',
      nativeBackupVerificationState: verified ? 'verified' : 'attention',
      manualJsonBackupEndpointPreserved: true,
      automaticCustomJsonBackupDisabled: true,
      lastError: ''
    };
    if (shouldWriteStatus(previous, next, ctx.source === 'manual-watchdog')) {
      await statusRef.set(next, { merge: true });
      if (!verified) await writeAudit(db, ctx, 'BACKUP_WATCHDOG_NATIVE_ATTENTION', 'system/backupStatus', setupIncompleteReason, 'platform').catch(() => null);
    }
    return res.status(statusCodeForHealth({ setupComplete: verified, apiError: unreachableLocations.length > 0 })).json({ ok: verified, version: APP_VERSION, mode: 'native-admin-api-watchdog', projectId, databaseId, scheduleCount: schedules.length, backupCount: backups.length, unreachableLocations, schedulePages: schedulePage.pageCount, backupPages: backupPage.pageCount, ...next });
  } catch (err) {
    const code = err.statusCode || (/permission|forbidden/i.test(err.message) ? 403 : 503);
    const isPermissionDenied = code === 403 || err.safeCategory === 'permission_denied';
    const iam = isPermissionDenied ? nativeBackupIamDiagnostic(projectId, databaseId) : {};
    const preciseMessage = isPermissionDenied
      ? nativeBackupPermissionMessage(projectId, iam.serviceAccountEmail)
      : sanitizeBackupError(err.message);
    const next = {
      status: 'attention',
      lastStatus: 'attention',
      nativeBackupVerified: false,
      nativeBackupSetupIncompleteReason: isPermissionDenied ? 'Native backup check blocked by IAM permission.' : 'Native backup setup incomplete',
      nativeBackupPermissionState: isPermissionDenied ? 'permission_required' : 'unknown',
      nativeBackupVerificationState: isPermissionDenied ? 'blocked_by_iam' : 'configuration_error',
      lastWatchdogResult: isPermissionDenied ? 'iam_permission_required' : 'configuration_error',
      lastError: sanitizeBackupError(preciseMessage),
      lastErrorAt: new Date().toISOString(),
      lastWatchdogVersion: APP_VERSION,
      manualJsonBackupEndpointPreserved: true,
      ...iam
    };
    if (statusRef && shouldWriteStatus(previous, next, req.method === 'POST')) await statusRef.set(next, { merge: true }).catch(() => null);
    return res.status(code).json({ ok: false, version: APP_VERSION, error: next.lastError || 'Native backup verification failed', errorCategory: isPermissionDenied ? 'permission_denied' : (err.safeCategory || 'backup_watchdog_error'), ...next });
  }
};
module.exports.config = { maxDuration: 60 };

module.exports.REQUIRED_NATIVE_BACKUP_PERMISSIONS = REQUIRED_NATIVE_BACKUP_PERMISSIONS;
module.exports.RECOMMENDED_NATIVE_BACKUP_ROLES = RECOMMENDED_NATIVE_BACKUP_ROLES;
module.exports.nativeBackupIamDiagnostic = nativeBackupIamDiagnostic;
module.exports.nativeBackupPermissionMessage = nativeBackupPermissionMessage;

const { initAdmin, authorize, requireAppCheckIfEnforced, writeAudit } = require('./_chaos-admin');
const { APP_VERSION } = require('./_version');

const DEFAULT_STALE_HOURS = 26;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function authorizeWatchdog(req, app) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';
  const scheduleHeader = req.headers['x-vercel-cron-schedule'] || '';
  const userAgent = req.headers['user-agent'] || '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true, source: 'vercel-cron', actor: 'Vercel Cron Watchdog', scheduleHeader, userAgent, isSuperAdmin: true };
  }
  const appCheck = await requireAppCheckIfEnforced(app, req);
  if (!appCheck.ok) return appCheck;
  const ctx = await authorize(req, app, { allowTenantAdmin: false });
  if (!ctx.ok || !ctx.isSuperAdmin) return { ok: false, status: ctx.status || 403, error: ctx.error || 'Super admin required.' };
  return { ...ctx, source: 'manual-watchdog', actor: ctx.email || ctx.uid || 'System Administrator' };
}

function nativeBackupMetadataFromEnv() {
  return {
    nativeBackupExpected: String(process.env.FIRESTORE_NATIVE_BACKUP_ENABLED || '').toLowerCase() === 'true',
    nativeBackupScheduleId: process.env.FIRESTORE_NATIVE_BACKUP_SCHEDULE_ID || '',
    nativeBackupRetentionDays: process.env.FIRESTORE_NATIVE_BACKUP_RETENTION_DAYS || '',
    nativeBackupLocation: process.env.FIRESTORE_NATIVE_BACKUP_LOCATION || '',
    nativeBackupConfiguredAt: process.env.FIRESTORE_NATIVE_BACKUP_CONFIGURED_AT || ''
  };
}

function shouldWriteStatus(previous = {}, next = {}, manual = false) {
  if (manual) return true;
  return ['status', 'lastStatus', 'nativeBackupExpected', 'nativeBackupScheduleId', 'nativeBackupRetentionDays', 'backupWatchdogStale', 'lastError']
    .some(key => String(previous[key] ?? '') !== String(next[key] ?? ''));
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET for cron or POST for manual watchdog check.' });
  const app = initAdmin(req);
  const db = app.firestore();
  const startedAt = new Date();
  try {
    const ctx = await authorizeWatchdog(req, app);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ ok: false, error: ctx.error });

    const statusRef = db.collection('system').doc('backupStatus');
    const snap = await statusRef.get();
    const previous = snap.exists ? snap.data() || {} : {};
    const native = nativeBackupMetadataFromEnv();
    const staleHours = Math.max(1, Number(process.env.BACKUP_WATCHDOG_STALE_HOURS || DEFAULT_STALE_HOURS));
    const lastNative = parseDate(previous.nativeBackupLastSuccessfulAt || previous.lastNativeBackupAt || previous.lastSuccessfulBackupAt);
    const ageHours = lastNative ? (startedAt.getTime() - lastNative.getTime()) / 36e5 : Infinity;
    const stale = !native.nativeBackupExpected || !native.nativeBackupScheduleId || !Number.isFinite(ageHours) || ageHours >= staleHours;
    const nextStatus = {
      ...native,
      status: stale ? 'attention' : 'ok',
      lastStatus: stale ? 'attention' : 'ok',
      backupMode: 'native-scheduled-plus-manual-json',
      backupWatchdogStale: stale,
      backupWatchdogStaleHours: staleHours,
      backupAgeHours: Number.isFinite(ageHours) ? Math.round(ageHours * 10) / 10 : null,
      lastWatchdogCheckAt: startedAt.toISOString(),
      lastWatchdogSource: ctx.source,
      lastWatchdogVersion: APP_VERSION,
      manualJsonBackupEndpointPreserved: true,
      automaticCustomJsonBackupDisabled: true,
      lastWatchdogResult: stale ? 'native-backup-needs-attention' : 'native-backup-healthy'
    };

    if (shouldWriteStatus(previous, nextStatus, ctx.source === 'manual-watchdog')) {
      await statusRef.set(nextStatus, { merge: true });
      if (stale) await writeAudit(db, ctx, 'BACKUP_WATCHDOG_NATIVE_ATTENTION', 'system/backupStatus', 'Native backup schedule is missing, stale, or not verified. Manual JSON backup endpoint remains available.', 'platform').catch(() => null);
    }

    return res.status(200).json({ ok: true, version: APP_VERSION, ranCustomBackup: false, mode: 'native-scheduled-watchdog', ...nextStatus });
  } catch (err) {
    const failedAt = new Date().toISOString();
    await db.collection('system').doc('backupStatus').set({ status: 'error', lastStatus: 'error', lastWatchdogResult: 'error', lastWatchdogError: err.message, lastError: err.message, lastErrorAt: failedAt, version: APP_VERSION }, { merge: true }).catch(() => null);
    return res.status(500).json({ ok: false, version: APP_VERSION, error: err.message || 'Backup watchdog failed.' });
  }
};

module.exports.config = { maxDuration: 60 };

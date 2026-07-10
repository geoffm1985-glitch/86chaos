const { initAdmin, authorize, requireAppCheckIfEnforced, writeAudit } = require('./_chaos-admin');

const APP_VERSION = '15.0.44';
const DEFAULT_STALE_HOURS = 23;

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getLastSuccessfulBackup(data = {}) {
  return parseDate(data.lastSuccessfulBackupAt || data.lastBackupAt || data.lastExportAt || data.runFinishedAt || data.lastRunAt);
}

function getBaseUrl(req) {
  const explicit = String(process.env.BACKUP_BASE_URL || process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_URL || '').trim();
  if (!host) throw new Error('Could not determine app host for backup watchdog. Set BACKUP_BASE_URL in Vercel.');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  return `${proto}://${host.replace(/^https?:\/\//, '')}`.replace(/\/+$/, '');
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

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'Use GET for cron or POST for manual watchdog check.' });
  const app = initAdmin();
  const db = app.firestore();
  const startedAt = new Date();
  try {
    const ctx = await authorizeWatchdog(req, app);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ ok: false, error: ctx.error });

    const statusRef = db.collection('system').doc('backupStatus');
    const snap = await statusRef.get();
    const status = snap.exists ? snap.data() || {} : {};
    const staleHours = Math.max(1, Number(process.env.BACKUP_WATCHDOG_STALE_HOURS || DEFAULT_STALE_HOURS));
    const lastSuccess = getLastSuccessfulBackup(status);
    const ageHours = lastSuccess ? (startedAt.getTime() - lastSuccess.getTime()) / 36e5 : Infinity;
    const due = !Number.isFinite(ageHours) || ageHours >= staleHours;

    const watchdogMeta = {
      lastWatchdogCheckAt: startedAt.toISOString(),
      lastWatchdogSource: ctx.source,
      lastWatchdogScheduleHeader: ctx.scheduleHeader || '',
      lastWatchdogUserAgent: ctx.userAgent || '',
      lastWatchdogVersion: APP_VERSION,
      backupWatchdogStaleHours: staleHours,
      backupAgeHours: Number.isFinite(ageHours) ? Math.round(ageHours * 10) / 10 : null,
      backupWatchdogDue: due
    };

    if (!due) {
      await statusRef.set({ ...watchdogMeta, lastWatchdogResult: 'fresh-no-backup-needed' }, { merge: true });
      return res.status(200).json({ ok: true, version: APP_VERSION, ranBackup: false, reason: 'fresh', ...watchdogMeta });
    }

    if (!process.env.CRON_SECRET) {
      await statusRef.set({ ...watchdogMeta, lastWatchdogResult: 'missing-cron-secret' }, { merge: true });
      return res.status(500).json({ ok: false, version: APP_VERSION, ranBackup: false, error: 'CRON_SECRET is required for the watchdog to trigger /api/firestore-backup.' });
    }

    const backupUrl = `${getBaseUrl(req)}/api/firestore-backup?mode=watchdog`;
    await statusRef.set({ ...watchdogMeta, status: 'watchdog-triggering', lastWatchdogResult: 'triggering-backup', lastWatchdogBackupUrlHost: new URL(backupUrl).host }, { merge: true });
    const backupRes = await fetch(backupUrl, { method: 'GET', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-86chaos-watchdog': APP_VERSION } });
    const backupData = await backupRes.json().catch(() => ({}));
    if (!backupRes.ok || backupData.ok === false) {
      const message = backupData.error || `Backup route returned HTTP ${backupRes.status}`;
      await statusRef.set({ ...watchdogMeta, status: 'error', lastStatus: 'error', lastWatchdogResult: 'backup-failed', lastWatchdogError: message, lastError: message, lastErrorAt: new Date().toISOString() }, { merge: true });
      return res.status(backupRes.status || 500).json({ ok: false, version: APP_VERSION, ranBackup: true, error: message, backup: backupData, ...watchdogMeta });
    }

    await statusRef.set({ ...watchdogMeta, lastWatchdogResult: 'backup-ran', lastWatchdogBackupRunId: backupData.runId || '', lastWatchdogBackupAt: new Date().toISOString() }, { merge: true });
    await writeAudit(db, ctx, 'BACKUP_WATCHDOG_RAN_BACKUP', 'system/backupStatus', `Backup watchdog ran a catch-up backup after ${Number.isFinite(ageHours) ? Math.round(ageHours) : 'unknown'}h without a successful backup.`, 'platform');
    return res.status(200).json({ ok: true, version: APP_VERSION, ranBackup: true, reason: 'stale', backup: backupData, ...watchdogMeta });
  } catch (err) {
    const failedAt = new Date().toISOString();
    await db.collection('system').doc('backupStatus').set({ status: 'error', lastStatus: 'error', lastWatchdogResult: 'error', lastWatchdogError: err.message, lastError: err.message, lastErrorAt: failedAt, version: APP_VERSION }, { merge: true }).catch(() => null);
    return res.status(500).json({ ok: false, version: APP_VERSION, error: err.message || 'Backup watchdog failed.' });
  }
};

module.exports.config = { maxDuration: 120 };

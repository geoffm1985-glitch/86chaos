const fs = require('fs');
const path = require('path');
const { initAdmin, authorize, requireAppCheckIfEnforced } = require('./_chaos-admin');
const { projectCredentialStatus } = require('./_firebase-project-admin');

const ROUTE_CHECKS = [
  { route: '/api/account-security', file: 'account-security.js', method: 'GET/POST', auth: 'signed-in-user', notes: 'MFA enrollment/status/recovery route.' },
  { route: '/api/admin-access', file: 'admin-access.js', method: 'POST', auth: 'super-admin', notes: 'Admin access escalation route.' },
  { route: '/api/master-admin-repair', file: 'master-admin-repair.js', method: 'GET/POST', auth: 'configured-master-admin', notes: 'Repairs missing Firestore users profiles for emails listed in MASTER_ADMIN_EMAIL(S).' },
  { route: '/api/alerts', file: 'alerts.js', method: 'POST', auth: 'workspace-admin', notes: 'Alert writer route.' },
  { route: '/api/backup-preview', file: 'backup-preview.js', method: 'POST', auth: 'super-admin', notes: 'Reads backup files for preview only.' },
  { route: '/api/brand-logo', file: 'brand-logo.js', method: 'POST', auth: 'workspace-admin', notes: 'Customer logo upload route.' },
  { route: '/api/delete-user', file: 'delete-user.js', method: 'POST', auth: 'super-admin', notes: 'Destructive single-user delete route.' },
  { route: '/api/delete-users-bulk', file: 'delete-users-bulk.js', method: 'POST', auth: 'super-admin', notes: 'Guarded bulk user cleanup route.' },
  { route: '/api/deploy-tenant', file: 'deploy-tenant.js', method: 'POST', auth: 'super-admin', notes: 'Workspace deployment helper.' },
  { route: '/api/dispatch-reminders', file: 'dispatch-reminders.js', method: 'POST', auth: 'cron-or-admin', notes: 'Reminder dispatcher cron route.' },
  { route: '/api/firestore-backup', file: 'firestore-backup.js', method: 'GET/POST', auth: 'cron-or-admin', notes: 'Firestore backup route.' },
  { route: '/api/firestore-backup-watchdog', file: 'firestore-backup-watchdog.js', method: 'GET/POST', auth: 'cron-or-admin', notes: 'Daily backup fallback watchdog. Runs a catch-up backup only when last successful backup is stale.' },
  { route: '/api/gemini-admin-manual', file: 'gemini-admin-manual.js', method: 'POST', auth: 'super-admin', notes: 'Gemini-powered System Administrator manual assistant.' },
  { route: '/api/openai-diagnostics-explain', file: 'openai-diagnostics-explain.js', method: 'POST', auth: 'super-admin', notes: 'OpenAI structured diagnostics repair guidance with server-side redaction.' },
  { route: '/api/python-order-intelligence', file: 'python-order-intelligence.js', method: 'POST', auth: 'workspace-inventory-admin', notes: 'Node auth wrapper for Python order forecasting, par tuning, price trend, waste, prep, and event supply analysis.' },
  { route: '/api/python-order-engine', file: 'python-order-engine.py', method: 'POST', auth: 'internal-python-secret', notes: 'Vercel Python Function that runs the order intelligence engine without Node spawning Python.' },
  { route: '/api/python-ops-intelligence', file: 'python-ops-intelligence.js', method: 'POST', auth: 'workspace-manager', notes: 'Node auth wrapper for Python operations scans, invoice anomalies, menu costing, labor warnings, data health, backup checks, and report exports.' },
  { route: '/api/python-ops-engine', file: 'python-ops-engine.py', method: 'POST', auth: 'internal-python-secret', notes: 'Vercel Python Function that runs the Ops Intelligence engine without Node spawning Python.' },
  { route: '/api/python-automation-run', file: 'python-automation-run.js', method: 'GET/POST', auth: 'cron-or-super-admin', notes: 'Scheduled Python Automation Center runner that calls the Vercel Python Ops engine for nightly scans, manager briefs, owner/admin alert records, scan reports, and critical push alerts without applying restaurant changes.' },
  { route: '/api/full-system-diagnostics', file: 'full-system-diagnostics.js', method: 'POST', auth: 'super-admin', notes: 'Full diagnostics bundle route.' },
  { route: '/api/geocode-address', file: 'geocode-address.js', method: 'POST', auth: 'workspace-admin', notes: 'Address/geofence helper.' },
  { route: '/api/import-cheers-july-schedule', file: 'import-cheers-july-schedule.js', method: 'POST', auth: 'super-admin', notes: 'Legacy guarded schedule import helper. Hidden from public workflows.' },
  { route: '/api/account-deletion-request', file: 'account-deletion-request.js', method: 'GET/POST', auth: 'user', notes: 'Store-ready in-app account deletion request intake.' },
  { route: '/api/restore-drill', file: 'restore-drill.js', method: 'GET/POST', auth: 'super-admin', notes: 'Record monthly safe restore drill status.' },
  { route: '/api/list-backups', file: 'list-backups.js', method: 'GET', auth: 'super-admin', notes: 'Backup Storage listing route.' },
  { route: '/api/mfa-recovery-code', file: 'mfa-recovery-code.js', method: 'POST', auth: 'recovery-code', notes: 'Self-service MFA recovery code route for lost phones.' },
  { route: '/api/presence-heartbeat', file: 'presence-heartbeat.js', method: 'POST', auth: 'signed-in-user', notes: 'Low-cost presence heartbeat.' },
  { route: '/api/presence-snapshot', file: 'presence-snapshot.js', method: 'GET', auth: 'super-admin', notes: 'Manual live-users snapshot route.' },
  { route: '/api/push-token-repair', file: 'push-token-repair.js', method: 'POST', auth: 'signed-in-user', notes: 'Push token repair helper.' },
  { route: '/api/report-bug', file: 'report-bug.js', method: 'POST', auth: 'signed-in-user', notes: 'Saves user bug reports and sends super-admin push alerts.' },
  { route: '/api/safe-write', file: 'safe-write.js', method: 'POST', auth: 'workspace-user', notes: 'Server-side safe write guard.' },
  { route: '/api/scan', file: 'scan.js', method: 'POST', auth: 'workspace-user', notes: 'Legacy scanner route.' },
  { route: '/api/scan-invoice', file: 'scan-invoice.js', method: 'POST', auth: 'workspace-admin', notes: 'AI invoice scanner route.' },
  { route: '/api/scan-menu', file: 'scan-menu.js', method: 'POST', auth: 'workspace-owner', notes: 'AI menu intelligence scanner route.' },
  { route: '/api/ai-usage', file: 'ai-usage.js', method: 'GET/POST', auth: 'workspace-user-or-super-admin', notes: 'Monthly AI page usage, events, and Super Admin limit controls.' },
  { route: '/api/schema-doctor', file: 'schema-doctor.js', method: 'POST', auth: 'super-admin', notes: 'Schema diagnostics route.' },
  { route: '/api/security-diagnostics', file: 'security-diagnostics.js', method: 'GET', auth: 'super-admin', notes: 'Security Center diagnostics route.' },
  { route: '/api/send-push', file: 'send-push.js', method: 'POST', auth: 'workspace-admin', notes: 'Push delivery route.' },
  { route: '/api/send-schedule-alert', file: 'send-schedule-alert.js', method: 'POST', auth: 'workspace-admin', notes: 'Schedule alert sender.' },
  { route: '/api/staff-member', file: 'staff-member.js', method: 'POST', auth: 'workspace-admin', notes: 'Staff member create/update route.' },
  { route: '/api/storage-doctor', file: 'storage-doctor.js', method: 'POST', auth: 'super-admin', notes: 'Storage diagnostics route.' },
  { route: '/api/voice-command', file: 'voice-command.js', method: 'POST', auth: 'workspace-user', notes: 'Voice command parser route.' },
  { route: '/api/weekly-maintenance', file: 'weekly-maintenance.js', method: 'POST', auth: 'cron-or-admin', notes: 'Weekly maintenance cron route.' },
  { route: '/api/whoami', file: 'whoami.js', method: 'GET', auth: 'signed-in-user', notes: 'Auth echo route.' }
];

const hasEnv = (name) => Boolean(process.env[name] && String(process.env[name]).trim());

const HANDLER_LOADERS = {
  'account-security.js': () => require('./account-security'),
  'admin-access.js': () => require('./admin-access'),
  'master-admin-repair.js': () => require('./master-admin-repair'),
  'alerts.js': () => require('./alerts'),
  'backup-preview.js': () => require('./backup-preview'),
  'brand-logo.js': () => require('./brand-logo'),
  'delete-user.js': () => require('./delete-user'),
  'delete-users-bulk.js': () => require('./delete-users-bulk'),
  'deploy-tenant.js': () => require('./deploy-tenant'),
  'dispatch-reminders.js': () => require('./dispatch-reminders'),
  'firestore-backup.js': () => require('./firestore-backup'),
  'firestore-backup-watchdog.js': () => require('./firestore-backup-watchdog'),
  'gemini-admin-manual.js': () => require('./gemini-admin-manual'),
  'openai-diagnostics-explain.js': () => require('./openai-diagnostics-explain'),
  'python-order-intelligence.js': () => require('./python-order-intelligence'),
  'python-ops-intelligence.js': () => require('./python-ops-intelligence'),
  'python-automation-run.js': () => require('./python-automation-run'),
  'full-system-diagnostics.js': () => require('./full-system-diagnostics'),
  'geocode-address.js': () => require('./geocode-address'),
  'import-cheers-july-schedule.js': () => require('./import-cheers-july-schedule'),
  'account-deletion-request.js': () => require('./account-deletion-request'),
  'restore-drill.js': () => require('./restore-drill'),
  'list-backups.js': () => require('./list-backups'),
  'mfa-recovery-code.js': () => require('./mfa-recovery-code'),
  'presence-heartbeat.js': () => require('./presence-heartbeat'),
  'presence-snapshot.js': () => require('./presence-snapshot'),
  'push-token-repair.js': () => require('./push-token-repair'),
  'report-bug.js': () => require('./report-bug'),
  'safe-write.js': () => require('./safe-write'),
  'scan.js': () => require('./scan'),
  'scan-invoice.js': () => require('./scan-invoice'),
  'scan-menu.js': () => require('./scan-menu'),
  'ai-usage.js': () => require('./ai-usage'),
  'schema-doctor.js': () => require('./schema-doctor'),
  'security-diagnostics.js': () => require('./security-diagnostics'),
  'send-push.js': () => require('./send-push'),
  'send-schedule-alert.js': () => require('./send-schedule-alert'),
  'staff-member.js': () => require('./staff-member'),
  'storage-doctor.js': () => require('./storage-doctor'),
  'voice-command.js': () => require('./voice-command'),
  'weekly-maintenance.js': () => require('./weekly-maintenance'),
  'whoami.js': () => require('./whoami')
};

const safeRequire = (file) => {
  try {
    if (/\.py$/i.test(file)) {
      const exists = fs.existsSync(path.join(__dirname, file));
      return { ok: exists, exists, error: exists ? '' : 'Python route file is missing.' };
    }
    const loader = HANDLER_LOADERS[file];
    if (!loader) return { ok: false, exists: false, error: 'Route is listed but no static loader is registered.' };
    const loaded = loader();
    return { ok: typeof loaded === 'function' || typeof loaded?.default === 'function', exists: true, error: '' };
  } catch (err) {
    return { ok: false, exists: true, error: err.message };
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET.' });
  try {
    const app = initAdmin(req);
    const appCheck = await requireAppCheckIfEnforced(app, req);
    if (!appCheck.ok) return res.status(appCheck.status || 401).json({ ok: false, error: appCheck.error });
    const ctx = await authorize(req, app, { allowTenantAdmin: false });
    if (!ctx.ok || !ctx.isSuperAdmin) return res.status(ctx.status || 403).json({ ok: false, error: ctx.error || 'Super admin required.' });

    const startedAt = Date.now();
    const rows = ROUTE_CHECKS.map(check => {
      const parse = safeRequire(check.file);
      return {
        ...check,
        exists: parse.exists !== false,
        handlerLoads: parse.ok,
        status: parse.ok ? 'ready' : 'attention',
        error: parse.error || '',
        destructive: /(delete|restore|backup|import)/i.test(check.route)
      };
    });
    const runtimeProjectId = ctx.app?.options?.projectId || ctx.decoded?.aud || app.options?.projectId || 'unknown';
    const runtimeCredential = projectCredentialStatus(runtimeProjectId);
    const env = {
      firebaseProjectId: runtimeProjectId,
      firebaseTokenProjectId: ctx.decoded?.aud || runtimeProjectId,
      firebaseStorageBucket: ctx.app?.options?.storageBucket || app.options?.storageBucket || `${runtimeProjectId}.firebasestorage.app`,
      firebaseCredentialConfigured: runtimeCredential.configured,
      firebaseCredentialSource: runtimeCredential.source || runtimeCredential.recommendedEnv || runtimeCredential.error || 'missing',
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      cronSecretConfigured: hasEnv('CRON_SECRET'),
      geminiConfigured: hasEnv('GEMINI_API_KEY') || hasEnv('GOOGLE_API_KEY') || hasEnv('GOOGLE_GENERATIVE_AI_API_KEY'),
      openaiDiagnosticsConfigured: hasEnv('OPENAI_API_KEY'),
      openaiDiagnosticsModel: process.env.OPENAI_DIAGNOSTICS_MODEL || 'gpt-5-mini',
      appCheckEnvConfigured: hasEnv('APP_CHECK_ENFORCE') || hasEnv('FIREBASE_APP_CHECK_ENFORCE'),
      mfaEnforcementConfigured: hasEnv('MFA_ENFORCE_ELEVATED_ROLES') || hasEnv('FIREBASE_MFA_ENFORCE_ELEVATED_ROLES') || hasEnv('REACT_APP_MFA_ENFORCE_ELEVATED_ROLES')
    };
    return res.status(200).json({
      ok: rows.every(r => r.status === 'ready'),
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      count: rows.length,
      readyCount: rows.filter(r => r.status === 'ready').length,
      attentionCount: rows.filter(r => r.status !== 'ready').length,
      env,
      routes: rows
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Health checks failed.' });
  }
};

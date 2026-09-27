'use strict';

const crypto = require('node:crypto');
const SENSITIVE_KEY = /(token|password|passwd|secret|api.?key|authorization|cookie|oauth|credential|private.?key|service.?account|refresh.?token|access.?token|client.?secret)/i;
const JWT = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g;
const JWT_TEST = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const API_KEY = /\b(?:AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{16,}|gh[opusr]_[A-Za-z0-9_]{20,})\b/g;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

function redactText(value = '') {
  return String(value || '')
    .replace(PRIVATE_KEY, '[redacted-private-key]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(JWT, '[redacted-token]')
    .replace(API_KEY, '[redacted-api-key]')
    .replace(/\b(password|passwd|secret|api[_-]?key|authorization|cookie|client[_-]?secret|refresh[_-]?token|access[_-]?token)\s*[:=]\s*([^\s,;}]+)/gi, '$1=[redacted]')
    .slice(0, 2000);
}

function redactDiagnostic(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redactDiagnostic(item, depth + 1));
  if (typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, 200)) {
      const nestedObject=item && typeof item === 'object';
      result[key] = SENSITIVE_KEY.test(key) && !nestedObject ? '[redacted]' : redactDiagnostic(item, depth + 1);
    }
    return result;
  }
  return redactText(value);
}

function sanitizedCorrelationId(value = '') {
  const input = String(value || '').trim();
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{5,79}$/.test(input) && !JWT_TEST.test(input)) return input;
  return `corr_${crypto.createHash('sha256').update(input || crypto.randomUUID()).digest('hex').slice(0, 16)}`;
}

function classifyDiagnosticError(value = '') {
  const message = String(value?.message || value || '').toLowerCase();
  if (/permission|forbidden|unauthoriz|denied/.test(message)) return 'authorization';
  if (/tenant|workspace|restaurant/.test(message)) return 'tenant-boundary';
  if (/timeout|timed out|deadline/.test(message)) return 'timeout';
  if (/network|fetch|unavailable|connection/.test(message)) return 'network';
  if (/app.?check|mfa|second.?factor/.test(message)) return 'authentication-assurance';
  if (/backup|restore/.test(message)) return 'backup-recovery';
  if (/deploy|commit|version|source.?hash|environment/.test(message)) return 'release-identity';
  if (/rate|quota|limit/.test(message)) return 'rate-limit';
  return 'application';
}

function buildBackupRecoveryStatus(status = {}, now = new Date()) {
  const lastSuccessRaw = status.lastSuccessfulBackupAt || status.lastBackupAt || status.nativeBackupLastSuccessfulAt || '';
  const lastFailureRaw = status.lastFailedBackupAt || status.lastErrorAt || '';
  const lastSuccess = lastSuccessRaw ? new Date(lastSuccessRaw) : null;
  const validSuccess = lastSuccess && Number.isFinite(lastSuccess.getTime());
  const ageHours = validSuccess ? Math.max(0, Math.round(((now.getTime() - lastSuccess.getTime()) / 36e5) * 10) / 10) : null;
  const failed = ['failed','error'].includes(String(status.status || status.lastStatus || '').toLowerCase()) || Boolean(status.lastError && (!validSuccess || (lastFailureRaw && new Date(lastFailureRaw) > lastSuccess)));
  const stale = ageHours != null && ageHours > Number(status.maximumHealthyAgeHours || 30);
  const verified = ['verified','passed','ready'].includes(String(status.lastIntegrityStatus || status.backupIntegrity?.status || status.nativeBackupVerificationState || '').toLowerCase()) || status.nativeBackupVerified === true;
  const state = failed ? 'failed' : !validSuccess ? 'unknown' : stale ? 'stale' : verified ? 'healthy' : 'unverified';
  return {
    state,
    healthy:state === 'healthy',
    lastSuccessfulBackupAt:validSuccess ? lastSuccess.toISOString() : '',
    backupAgeHours:ageHours,
    verification:verified ? 'verified' : validSuccess ? 'unknown' : 'unknown',
    lastFailedBackupAt:lastFailureRaw || '',
    failureExplanation:failed ? redactText(status.lastError || status.error || 'The latest backup attempt failed.') : '',
    restoreReadiness:verified && !stale && !failed ? 'review-ready' : 'not-proven',
    boundedTimeoutState:String(status.timeoutState || status.lastWatchdogResult || 'unknown'),
    rollbackEvidence:String(status.rollbackEvidence || 'unknown'),
    deploymentRecoveryEvidence:String(status.deploymentRecoveryEvidence || 'unknown'),
    destructiveRestoreAutomatic:false
  };
}

function buildPermissionBoundaryDiagnostics(input = {}) {
  const role = String(input.role || '').toLowerCase();
  const owner = Boolean(input.isOwner || input.owner || input.accountOwner || input.workspaceOwner || role.includes('owner'));
  const admin = Boolean(input.isAdmin || input.isSuperAdmin || role.includes('admin'));
  const manager = Boolean(input.isManager || role.includes('manager'));
  return {
    role:owner ? 'owner' : admin ? 'admin' : manager ? 'manager' : 'staff',
    boundaries:{ ownerOnly:['staff-delete','wage-read','billing','workspace-delete'], adminOrOwner:['security-diagnostics','backup-review','integration-config'], managerOrHigher:['schedule-publish','time-off-review','invoice-review'], staff:['self-schedule-read','own-time-off','assigned-prep'] },
    effective:{ canReviewSecurity:owner || admin, canReviewBackup:owner || admin, canManageTeam:owner || admin || manager, canViewWages:owner },
    tenantIsolationRequired:true,
    workspaceId:String(input.restaurantId || input.workspaceId || '')
  };
}

function buildSecurityMaturityReport(input = {}) {
  const environment = input.environment || {};
  const expectedProject = String(input.expectedFirebaseProject || '');
  const runtimeProject = String(environment.projectId || '');
  const environmentIdentity = !runtimeProject || !expectedProject ? 'unknown' : runtimeProject !== expectedProject ? 'mismatch' : 'verified';
  const checks = [
    ['mfa', input.mfa?.apiEnforcementEnabled === true ? 'healthy' : 'attention', 'Require MFA enforcement for elevated accounts after enrollment is verified.'],
    ['app-check', input.appCheck?.status === 'valid' && input.appCheck?.enforcedByApi ? 'healthy' : input.appCheck?.status || 'unknown', 'Verify App Check token validation and enforcement.'],
    ['firestore-rules', input.firestoreRules?.status || 'unknown', 'Record and verify the deployed Firestore rules version.'],
    ['storage-rules', input.storageRules?.status || 'unknown', 'Record and verify the deployed Storage rules version.'],
    ['environment', environmentIdentity, 'Firebase runtime and expected environment must match.'],
    ['service-account', environment.credentialConfigured ? 'configured' : 'missing', 'Service-account material stays server-only and values are never returned.'],
    ['oauth-state', input.oauthStateProtected === true ? 'healthy' : 'unknown', 'OAuth state must be single-use, expiring, and tenant-bound.'],
    ['deployment-identity', input.deploymentIdentityVerified === true ? 'verified' : 'unknown', 'Version, commit, deployment, and source hash must be proven together.']
  ].map(([id,status,action]) => ({ id,status,action }));
  return redactDiagnostic({ schemaVersion:1, generatedAt:new Date().toISOString(), correlationId:sanitizedCorrelationId(input.correlationId), environmentIdentity, checks, permissionBoundaries:buildPermissionBoundaryDiagnostics(input.caller || {}), backupRecovery:buildBackupRecoveryStatus(input.backupStatus || {}), secrets:{ valuesExposed:false, serverOnly:true, redactionApplied:true }, integrations:{ authentication:'server-only', tenantIsolationRequired:true, oauthStateProtection:input.oauthStateProtected === true ? 'verified' : 'unknown' } });
}

module.exports = { redactText, redactDiagnostic, sanitizedCorrelationId, classifyDiagnosticError, buildBackupRecoveryStatus, buildPermissionBoundaryDiagnostics, buildSecurityMaturityReport };

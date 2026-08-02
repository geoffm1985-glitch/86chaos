const APPROVED_TEST_PROJECT = 'chaos-test-d1601';
const PRODUCTION_PROJECT = 'cheers-34b8d';
const PRODUCTION_HOSTS = new Set(['86chaos.com', 'www.86chaos.com', 'app.86chaos.com']);
const APPROVED_QA_EMAIL_RE = /^86chaos\.qa\.(system-admin|owner|manager|staff)\.\d{8}-\d{4}@example\.test$/i;

function normalizeHost(value = '') {
  const host = String(value || '').trim().toLowerCase().replace(/\.+$/, '');
  return host;
}
function parseHost(url = '') {
  try { return normalizeHost(new URL(String(url || '')).hostname); } catch (_) { return ''; }
}
function isProductionHost(host = '') {
  const clean = normalizeHost(host);
  return PRODUCTION_HOSTS.has(clean) || /(^|\.)86chaos\.com$/i.test(clean);
}
function isTestingPreviewHost(host = '') {
  const clean = normalizeHost(host);
  if (!clean) return false;
  if (isProductionHost(clean)) return false;
  return /\.vercel\.app$/i.test(clean) || /(?:^|\.)localhost$/i.test(clean) || /^(127\.0\.0\.1|0\.0\.0\.0)$/i.test(clean) || /testing|preview|qa|git-/i.test(clean);
}
function redactSecrets(value = '') {
  return String(value || '').replace(/(password|token|secret|key)(["'\s:=]+)[^\s"'}]+/gi, '$1$2[redacted]');
}
function collectQaEmails(env = process.env) {
  return ['SYSTEM_ADMIN_EMAIL','OWNER_EMAIL','MANAGER_EMAIL','STAFF_EMAIL'].map(name => String(env[name] || env[`CHAOS_${name}`] || '').trim().toLowerCase()).filter(Boolean);
}
function assertMutationSafety(options = {}) {
  const env = options.env || process.env;
  const projectSources = {
    optionProjectId: options.projectId,
    reactAppProjectId: env.REACT_APP_FIREBASE_PROJECT_ID,
    reactAppTestProjectId: env.REACT_APP_TEST_FIREBASE_PROJECT_ID,
    gcloudProject: env.GCLOUD_PROJECT,
    googleCloudProject: env.GOOGLE_CLOUD_PROJECT,
    firebaseProjectId: env.FIREBASE_PROJECT_ID,
    credentialProjectId: options.credentialProjectId || env.FIREBASE_ADMIN_PROJECT_ID || env.FIREBASE_TEST_ADMIN_PROJECT_ID || ''
  };
  const suppliedProjectValues = Object.values(projectSources).map(value => String(value || '').trim()).filter(Boolean);
  const uniqueProjectValues = Array.from(new Set(suppliedProjectValues));
  const projectId = String(options.projectId || env.REACT_APP_FIREBASE_PROJECT_ID || env.REACT_APP_TEST_FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || env.FIREBASE_PROJECT_ID || '').trim();
  const url = String(options.appUrl || env.APP_URL || env.CHAOS_BASE_URL || env.PLAYWRIGHT_BASE_URL || env.BASE_URL || '').trim();
  const host = parseHost(url);
  const runId = String(options.runId || env.CHAOS_RELEASE_GATE_RUN_ID || env.CHAOS_FULL_AUDIT_RUN_ID || '').trim();
  const testMode = options.testMode === true || /^(1|true|yes)$/i.test(String(env.CHAOS_RELEASE_GATE_TEST_MODE || env.CHAOS_ALLOW_MUTATION || env.CHAOS_QA_AUTO_PROVISION_TEST_USERS || ''));
  const adminCredentialPresent = options.adminCredentialPresent === true || Boolean(env.FIREBASE_TEST_SERVICE_ACCOUNT_KEY || env.FIREBASE_SERVICE_ACCOUNT_KEY || env.GOOGLE_APPLICATION_CREDENTIALS || env.GCLOUD_SERVICE_ACCOUNT_KEY);
  const qaEmails = options.qaEmails || collectQaEmails(env);
  const errors = [];
  if (!suppliedProjectValues.length) errors.push('Refusing mutation because Firebase project identity is missing.');
  if (uniqueProjectValues.length > 1) errors.push(`Refusing mutation because Firebase project identities disagree: ${uniqueProjectValues.join(', ')}.`);
  if (projectId !== APPROVED_TEST_PROJECT) errors.push(`Refusing mutation for Firebase project ${projectId || '(missing)'}; expected ${APPROVED_TEST_PROJECT}.`);
  if (projectId === PRODUCTION_PROJECT || uniqueProjectValues.includes(PRODUCTION_PROJECT)) errors.push(`Refusing mutation for production Firebase project ${PRODUCTION_PROJECT}.`);
  if (!url) errors.push('Refusing mutation because APP_URL/CHAOS_BASE_URL is missing.');
  if (url && !host) errors.push(`Refusing mutation because deployment URL is malformed: ${redactSecrets(url)}`);
  if (host && isProductionHost(host)) errors.push(`Refusing mutation against production host ${host}.`);
  if (host && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host) && options.allowLocalEmulator !== true) errors.push(`Refusing mutation against localhost host ${host} outside explicit emulator-only mode.`);
  if (host && !isTestingPreviewHost(host) && options.allowLocalEmulator !== true) errors.push(`Refusing mutation because ${host} is not a recognized testing/preview deployment.`);
  if (!testMode) errors.push('Refusing mutation because release-gate test mode is not active.');
  if (!runId) errors.push('Refusing mutation because the release-gate run ID is missing.');
  if (!adminCredentialPresent && options.requireAdminCredentials !== false) errors.push('Refusing mutation because testing Firebase Admin credentials are unavailable.');
  for (const email of qaEmails) {
    if (!APPROVED_QA_EMAIL_RE.test(email)) errors.push(`Refusing mutation for non-approved QA identity: ${email || '(missing)'}.`);
  }
  const result = { ok: errors.length === 0, errors: [...new Set(errors)], projectId, projectSources, projectIdentitiesCompared: uniqueProjectValues, projectIdentitySupplied: suppliedProjectValues.length > 0, host, runId, testingProject: APPROVED_TEST_PROJECT, productionProject: PRODUCTION_PROJECT, qaEmailsApproved: errors.filter(e => /non-approved QA/i.test(e)).length === 0 };
  if (!result.ok && options.throwOnFailure) throw new Error(result.errors.join('\n'));
  return result;
}
module.exports = { APPROVED_TEST_PROJECT, PRODUCTION_PROJECT, PRODUCTION_HOSTS, APPROVED_QA_EMAIL_RE, normalizeHost, parseHost, isProductionHost, isTestingPreviewHost, assertMutationSafety, redactSecrets, collectQaEmails };

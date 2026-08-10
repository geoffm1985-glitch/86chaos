#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ensureRunDir, writeJson } = require('./run-context.cjs');
const { loadEnv, env } = require('../86chaos-full-audit/env-loader.cjs');
const { readFirebaseConfig } = require('../86chaos-full-audit/firebase-client.cjs');
const {
  EXPECTED_FIREBASE_PROJECT,
  readConfiguredAccounts,
  buildFirebaseAuthFetchOptions,
} = require('./verify-role-accounts.cjs');

const PRODUCTION_FIREBASE_PROJECT = 'cheers-34b8d';
const SERVER_BOUNDARY_REPORT = 'server-firebase-boundary-preflight.json';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function appUrl(pathOrTab = '') {
  const base = env('APP_URL', 'CHAOS_BASE_URL', 'PLAYWRIGHT_BASE_URL', 'BASE_URL').replace(/\/+$/, '');
  if (!base) return '';
  if (!pathOrTab) return base;
  if (/^https?:\/\//i.test(pathOrTab)) return pathOrTab;
  if (String(pathOrTab).startsWith('/')) return `${base}${pathOrTab}`;
  return `${base}/?tab=${encodeURIComponent(pathOrTab)}`;
}

function truncate(value = '', max = 1200) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function redactCredentialContents(value = '') {
  return String(value || '')
    .replace(/"private_key"\s*:\s*"(?:\\.|[^"])*"/gi, '"private_key":"[redacted]"')
    .replace(/"client_email"\s*:\s*"[^"]+"/gi, '"client_email":"[redacted]"')
    .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[redacted]"')
    .replace(/"idToken"\s*:\s*"[^"]+"/gi, '"idToken":"[redacted]"')
    .replace(/"refreshToken"\s*:\s*"[^"]+"/gi, '"refreshToken":"[redacted]"')
    .replace(/(password|private[_-]?key|token|secret)([\s:=]+)[^\s"'}]+/gi, '$1$2[redacted]');
}

function safeDiagnostic(value = '') {
  return truncate(redactCredentialContents(value), 1000);
}

function extractServerFirebaseProjectId(data = {}, text = '') {
  const direct = data?.runtime?.firebaseProjectId || data?.runtimeProjectId || data?.serverFirebaseProjectId || data?.firebaseProjectId || '';
  if (direct) return String(direct).trim();
  const haystack = `${data?.diagnostic || ''}\n${data?.error || ''}\n${text || ''}`;
  const genericMatch = haystack.match(/FIREBASE_SERVICE_ACCOUNT_KEY\s+currently\s+contains\s+project_id\s+([A-Za-z0-9-]+)/i);
  if (genericMatch) return genericMatch[1];
  const sourceMatch = haystack.match(/server\s+Firebase\s+Admin\s+(?:credential\s+)?(?:project|identity)\s+(?:is|resolves\s+to)\s+([A-Za-z0-9-]+)/i);
  if (sourceMatch) return sourceMatch[1];
  const projectIdMatch = haystack.match(/project_id["'\s:=]+([A-Za-z0-9-]+)/i);
  if (projectIdMatch) return projectIdMatch[1];
  return '';
}

function extractCredentialSourceName(data = {}, text = '') {
  const direct = data?.runtime?.credentialSourceName || data?.credentialSourceName || data?.credentialSource || data?.platformAuthority?.source || '';
  if (direct && /^[A-Z0-9_/. -]{3,}$/i.test(String(direct))) return String(direct).trim();
  const haystack = `${data?.diagnostic || ''}\n${data?.error || ''}\n${text || ''}`;
  const match = haystack.match(/\b(FIREBASE_[A-Z0-9_]*SERVICE_ACCOUNT[A-Z0-9_]*|FIREBASE_SERVICE_ACCOUNT_KEY|FIREBASE_ADMIN_CREDENTIALS|FIREBASE_TEST_SERVICE_ACCOUNT_KEY|FIREBASE_PRODUCTION_SERVICE_ACCOUNT_KEY|GOOGLE_APPLICATION_CREDENTIALS(?:_JSON)?)\b/);
  return match ? match[1] : '';
}

function classifyWhoamiBoundary({ appUrlValue = '', expectedProject = EXPECTED_FIREBASE_PROJECT, clientProjectId = '', responseStatus = 0, responseOk = false, data = {}, text = '' }) {
  const serverFirebaseProjectId = extractServerFirebaseProjectId(data, text);
  const credentialSourceName = extractCredentialSourceName(data, text);
  const reasonCategory = String(data?.reasonCategory || '').trim();
  const safeText = safeDiagnostic(text || data?.diagnostic || data?.error || '');
  const beforeMutation = true;
  const errors = [];
  let failureCategory = '';
  let primaryBlockingFailure = '';

  if (clientProjectId && clientProjectId !== expectedProject) {
    failureCategory = 'clientFirebaseBoundaryFailure';
    primaryBlockingFailure = `Preview Firebase boundary mismatch: browser/test project is ${clientProjectId} but expected ${expectedProject}.`;
    errors.push(primaryBlockingFailure);
  }

  if (!failureCategory && responseStatus === 503 && reasonCategory === 'firebase-admin-initialization') {
    failureCategory = 'previewServerFirebaseBoundaryFailure';
    const observed = serverFirebaseProjectId || '(missing)';
    primaryBlockingFailure = `Preview Firebase boundary mismatch: browser/test project is ${clientProjectId || expectedProject} but deployed server Firebase Admin credential resolves to ${observed}. Correct the canonical 86chaos Vercel Preview environment. Do not change Firebase rules or authorization logic.`;
    errors.push(primaryBlockingFailure);
  }

  if (!failureCategory && ![200, 403].includes(Number(responseStatus))) {
    failureCategory = reasonCategory === 'invalid-token' || responseStatus === 401 ? 'testAccountConfigurationFailure' : 'previewServerFirebaseBoundaryFailure';
    primaryBlockingFailure = `Preview server Firebase identity preflight could not verify /api/whoami before mutation. HTTP ${responseStatus || '(no response)'}${reasonCategory ? ` (${reasonCategory})` : ''}.`;
    errors.push(primaryBlockingFailure);
  }

  if (!failureCategory) {
    if (!serverFirebaseProjectId) {
      failureCategory = 'previewServerFirebaseBoundaryFailure';
      primaryBlockingFailure = 'Preview server Firebase identity preflight could not detect the deployed server Firebase Admin project before mutation.';
      errors.push(primaryBlockingFailure);
    } else if (serverFirebaseProjectId !== expectedProject) {
      failureCategory = 'previewServerFirebaseBoundaryFailure';
      primaryBlockingFailure = `Preview Firebase boundary mismatch: browser/test project is ${clientProjectId || expectedProject} but deployed server Firebase Admin credential resolves to ${serverFirebaseProjectId}. Correct the canonical 86chaos Vercel Preview environment. Do not change Firebase rules or authorization logic.`;
      errors.push(primaryBlockingFailure);
    }
  }

  const ok = errors.length === 0;
  return {
    ok,
    failureCategory,
    primaryBlockingFailure,
    errors,
    appUrl: appUrlValue,
    vercelEnvironment: process.env.VERCEL_ENV || 'preview',
    expectedFirebaseProjectId: expectedProject,
    clientFirebaseProjectId: clientProjectId || '',
    deployedServerFirebaseProjectId: serverFirebaseProjectId || '',
    credentialSourceName: credentialSourceName || '',
    whoamiStatus: Number(responseStatus || 0),
    whoamiReasonCategory: reasonCategory,
    beforeMutation,
    testAccountProvisioningAttempted: false,
    qaMutationAllowed: ok,
    safeDiagnostic: ok ? '' : safeText,
  };
}

async function fetchDetailedJson(url, options = {}, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Global fetch is unavailable. Run the release gate under Node 24.');
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; }
  catch (_) { data = { rawText: truncate(text, 400) }; }
  return { response, text, data };
}

async function signInAccount(account, config, fetchImpl = global.fetch) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;
  const { response, text, data } = await fetchDetailedJson(url, buildFirebaseAuthFetchOptions({
    method: 'POST',
    body: JSON.stringify({ email: account.email, password: account.password, returnSecureToken: true }),
  }), fetchImpl);
  if (!response.ok) {
    const safeError = safeDiagnostic(data?.error?.message || text || `HTTP ${response.status}`);
    throw new Error(`${account.emailEnv} could not authenticate to Firebase ${config.projectId}: ${safeError}`);
  }
  if (!data?.idToken || !data?.localId) throw new Error(`${account.emailEnv} did not return a Firebase ID token.`);
  return { ...account, uid: data.localId, idToken: data.idToken, firebaseProjectId: config.projectId };
}

function chooseProbeAccount(accounts = []) {
  const order = ['systemAdmin', 'owner', 'manager', 'staff'];
  for (const key of order) {
    const match = accounts.find(account => account.key === key && account.email && account.password);
    if (match) return match;
  }
  return accounts.find(account => account.email && account.password) || null;
}

async function runServerFirebaseBoundaryPreflight(options = {}) {
  const root = options.root || process.cwd();
  if (options.loadEnvironment !== false) loadEnv(root);
  const { runId, runDir } = ensureRunDir();
  const expectedProject = options.expectedProject || EXPECTED_FIREBASE_PROJECT;
  const fetchImpl = options.fetchImpl || global.fetch;
  const out = options.reportPath || path.join(runDir, SERVER_BOUNDARY_REPORT);
  const appUrlValue = appUrl();
  let config = null;
  let report = null;

  try {
    config = options.config || readFirebaseConfig();
    const accounts = options.accounts || readConfiguredAccounts();
    const account = chooseProbeAccount(accounts);
    const baseErrors = [];
    if (!appUrlValue) baseErrors.push('APP_URL or CHAOS_BASE_URL is missing, so deployed server Firebase identity cannot be verified before mutation.');
    if (!config?.projectId) baseErrors.push('Testing Firebase client config did not resolve a project ID.');
    if (config?.projectId && config.projectId !== expectedProject) baseErrors.push(`Testing Firebase client project is ${config.projectId}; expected ${expectedProject}.`);
    if (!account) baseErrors.push('No existing configured test account is available to authenticate /api/whoami before mutation. Configure a reusable release-gate test account or correct the environment before provisioning.');
    if (baseErrors.length) {
      report = {
        ok: false,
        runId,
        generatedAt: new Date().toISOString(),
        phase: 'server-firebase-boundary-preflight',
        failureCategory: 'previewServerFirebaseBoundaryFailure',
        primaryBlockingFailure: baseErrors[0],
        errors: baseErrors,
        appUrl: appUrlValue,
        expectedFirebaseProjectId: expectedProject,
        clientFirebaseProjectId: config?.projectId || '',
        deployedServerFirebaseProjectId: '',
        credentialSourceName: '',
        beforeMutation: true,
        testAccountProvisioningAttempted: false,
      };
      writeJson(out, report);
      return { report, out };
    }

    const signed = await signInAccount(account, config, fetchImpl);
    const whoamiUrl = new URL('/api/whoami', appUrlValue).toString();
    const { response, text, data } = await fetchDetailedJson(whoamiUrl, buildFirebaseAuthFetchOptions({ method: 'GET', headers: { Authorization: `Bearer ${signed.idToken}` } }), fetchImpl);
    const classified = classifyWhoamiBoundary({
      appUrlValue,
      expectedProject,
      clientProjectId: config.projectId,
      responseStatus: response.status,
      responseOk: response.ok,
      data,
      text,
    });
    report = {
      runId,
      generatedAt: new Date().toISOString(),
      phase: 'server-firebase-boundary-preflight',
      probeAccount: {
        key: signed.key || '',
        emailEnv: signed.emailEnv || '',
        email: normalizeEmail(signed.email),
        uid: signed.uid || '',
      },
      ...classified,
    };
    writeJson(out, report);
    return { report, out };
  } catch (error) {
    const message = safeDiagnostic(error.message || String(error));
    report = {
      ok: false,
      runId,
      generatedAt: new Date().toISOString(),
      phase: 'server-firebase-boundary-preflight-crash',
      failureCategory: /password|auth|INVALID|EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/i.test(message) ? 'testAccountConfigurationFailure' : 'previewServerFirebaseBoundaryFailure',
      primaryBlockingFailure: /password|auth|INVALID|EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/i.test(message)
        ? `Release-gate test account could not authenticate before server Firebase identity preflight: ${message}`
        : `Preview server Firebase identity preflight failed before mutation: ${message}`,
      errors: [/password|auth|INVALID|EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/i.test(message)
        ? `Release-gate test account could not authenticate before server Firebase identity preflight: ${message}`
        : `Preview server Firebase identity preflight failed before mutation: ${message}`],
      appUrl: appUrlValue,
      expectedFirebaseProjectId: expectedProject,
      clientFirebaseProjectId: config?.projectId || '',
      deployedServerFirebaseProjectId: '',
      credentialSourceName: '',
      beforeMutation: true,
      testAccountProvisioningAttempted: false,
    };
    writeJson(out, report);
    return { report, out };
  }
}

if (require.main === module) {
  runServerFirebaseBoundaryPreflight({})
    .then(({ report, out }) => {
      console.log(JSON.stringify({
        ok: report.ok,
        output: out,
        failureCategory: report.failureCategory || '',
        primaryBlockingFailure: report.primaryBlockingFailure || '',
        expectedFirebaseProjectId: report.expectedFirebaseProjectId || '',
        clientFirebaseProjectId: report.clientFirebaseProjectId || '',
        deployedServerFirebaseProjectId: report.deployedServerFirebaseProjectId || '',
        credentialSourceName: report.credentialSourceName || '',
        beforeMutation: report.beforeMutation === true,
        errors: report.errors || [],
      }, null, 2));
      if (!report.ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(safeDiagnostic(error.stack || error.message || String(error)));
      process.exit(1);
    });
}

module.exports = {
  SERVER_BOUNDARY_REPORT,
  PRODUCTION_FIREBASE_PROJECT,
  extractServerFirebaseProjectId,
  extractCredentialSourceName,
  classifyWhoamiBoundary,
  chooseProbeAccount,
  runServerFirebaseBoundaryPreflight,
  redactCredentialContents,
};

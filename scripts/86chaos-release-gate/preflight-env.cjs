const fs = require('fs');
const path = require('path');
const { loadEnv, env, boolEnv } = require('../86chaos-full-audit/env-loader.cjs');
const { ensureRunDir, writeJson } = require('./run-context.cjs');
const { applyQaWorkspaceEnv, validateQaWorkspaceName } = require('./qa-workspace.cjs');
const { assertMutationSafety } = require('./mutation-safety.cjs');

const { root, runId, runDir } = ensureRunDir();
const loaded = loadEnv(root);

const errors = [];
const warnings = [];
const present = {};

function value(...names) {
  const v = env(...names);
  for (const n of names) if (process.env[n]) present[n] = true;
  return v;
}

function sanitizeVersionText(text = '') {
  return String(text || '').trim().replace(/^v(?:ersion)?\s*/i, '').trim();
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'Cache-Control': 'no-cache', ...(options.headers || {}) } });
    const text = await response.text().catch(() => '');
    return { ok: response.ok, status: response.status, url: response.url || url, headers: Object.fromEntries(response.headers.entries()), text };
  } finally {
    clearTimeout(timeout);
  }
}

function requirePair(prefix) {
  const email = value(`${prefix}_EMAIL`, `CHAOS_${prefix}_EMAIL`);
  const password = value(`${prefix}_PASSWORD`, `CHAOS_${prefix}_PASSWORD`);
  if (!email) errors.push(`Missing ${prefix}_EMAIL.`);
  if (!password) errors.push(`Missing ${prefix}_PASSWORD.`);
  if (/example\.com|REPLACE_ME|YOUR_/i.test(String(email || ''))) errors.push(`${prefix}_EMAIL still contains a template placeholder.`);
  if (/^REPLACE_ME$/i.test(String(password || ''))) errors.push(`${prefix}_PASSWORD still contains a template placeholder.`);
  return { prefix, email: String(email || '').trim().toLowerCase(), passwordPresent: Boolean(password) };
}

async function main() {
  const appUrl = value('APP_URL', 'CHAOS_BASE_URL', 'BASE_URL');
  const expectedVersion = sanitizeVersionText(value('CHAOS_EXPECTED_VERSION'));
  const qaWorkspaceName = applyQaWorkspaceEnv(process.env, runId);
  const qaNameCheck = validateQaWorkspaceName(qaWorkspaceName, runId);
  if (!qaNameCheck.ok) errors.push(...qaNameCheck.errors);
  if (!appUrl) errors.push('Missing APP_URL or CHAOS_BASE_URL.');
  if (/YOUR-LATEST|REPLACE_ME|example\.com/i.test(String(appUrl || ''))) errors.push('APP_URL still contains a template placeholder. Replace it with the real safe testing-preview URL.');
  if (!expectedVersion) errors.push('Missing CHAOS_EXPECTED_VERSION.');

  let parsedUrl = null;
  try { parsedUrl = appUrl ? new URL(appUrl) : null; }
  catch (_) { errors.push(`APP_URL is not a valid absolute URL: ${appUrl}`); }
  if (parsedUrl) {
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsedUrl.hostname) && !boolEnv('CHAOS_ALLOW_LOCAL_UI_ONLY')) {
      errors.push('APP_URL points to localhost. A React dev server cannot fully exercise Vercel /api routes. Use the latest safe Vercel testing preview, or explicitly set CHAOS_ALLOW_LOCAL_UI_ONLY=true for a non-release diagnostic run.');
    }
    if (!/^https?:$/.test(parsedUrl.protocol)) errors.push('APP_URL must use http or https.');
  }

  const accounts = [requirePair('OWNER'), requirePair('MANAGER'), requirePair('STAFF'), requirePair('SYSTEM_ADMIN')];
  const seenEmails = new Map();
  for (const account of accounts) {
    if (!account.email) continue;
    if (seenEmails.has(account.email)) errors.push(`${seenEmails.get(account.email)}_EMAIL and ${account.prefix}_EMAIL must be different accounts so role isolation can be tested.`);
    else seenEmails.set(account.email, account.prefix);
  }

  const major = Number(process.versions.node.split('.')[0]);
  if (major < 24) errors.push(`Node 24.x is required. Current Node is ${process.version}.`);

  for (const required of ['package.json', 'package-lock.json', 'src/App.js', 'src/core/appCore.js', 'firestore.rules', 'storage.rules', 'vercel.json']) {
    if (!fs.existsSync(path.join(root, required))) errors.push(`Missing required app file: ${required}`);
  }

  let sourceVersion = '';
  let packageVersion = '';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    packageVersion = pkg.version || '';
    sourceVersion = packageVersion;
    if (expectedVersion && pkg.version && pkg.version !== expectedVersion) errors.push(`package.json version is ${pkg.version}, but CHAOS_EXPECTED_VERSION is ${expectedVersion}. Refusing to test mismatched expectations.`);
  } catch (error) {
    errors.push(`Could not read package.json: ${error.message}`);
  }

  let deployedVersion = '';
  let visibleVersion = '';
  let htmlVersion = '';
  let versionFetch = null;
  let htmlFetch = null;
  if (appUrl && parsedUrl && /^https?:$/.test(parsedUrl.protocol)) {
    try {
      const versionUrl = new URL('/version.json', appUrl).toString();
      versionFetch = await fetchText(`${versionUrl}?releaseGateRun=${encodeURIComponent(runId)}`);
      if (!versionFetch.ok) errors.push(`/version.json returned HTTP ${versionFetch.status}.`);
      else {
        const parsed = JSON.parse(versionFetch.text || '{}');
        deployedVersion = sanitizeVersionText(parsed.version || parsed.build || parsed.appVersion || '');
      }
    } catch (error) {
      errors.push(`Could not fetch /version.json from deployed preview: ${error.message}`);
    }
    try {
      htmlFetch = await fetchText(`${appUrl.replace(/\/+$/, '')}/?releaseGateVersionCheck=${encodeURIComponent(runId)}`);
      if (!htmlFetch.ok) errors.push(`Application HTML returned HTTP ${htmlFetch.status}.`);
      else {
        const text = htmlFetch.text || '';
        const versionMatch = text.match(/(?:VERSION|Version|version|appVersion)[^0-9]{0,30}(\d+\.\d+\.\d+)/i) || text.match(/86 Chaos\s+(\d+\.\d+\.\d+)/i);
        htmlVersion = sanitizeVersionText(versionMatch?.[1] || '');
      }
    } catch (error) {
      errors.push(`Could not fetch application HTML from deployed preview: ${error.message}`);
    }
  }
  visibleVersion = htmlVersion || '';
  if (expectedVersion && deployedVersion && deployedVersion !== expectedVersion) errors.push(`Deployed /version.json reports ${deployedVersion}, but CHAOS_EXPECTED_VERSION is ${expectedVersion}. Stop now; the preview is stale.`);
  if (expectedVersion && visibleVersion && visibleVersion !== expectedVersion) errors.push(`Application HTML/visible version evidence reports ${visibleVersion}, but CHAOS_EXPECTED_VERSION is ${expectedVersion}. Stop now; the preview is stale.`);

  let firebaseProjectId = '';
  try {
    const { readFirebaseConfig } = require('../86chaos-full-audit/firebase-client.cjs');
    const config = readFirebaseConfig();
    present.FIREBASE_CLIENT_CONFIG = true;
    firebaseProjectId = config.projectId || '';
    if (!config.projectId) errors.push('Testing Firebase projectId could not be resolved.');
    const expectedTestProject = value('CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID') || 'chaos-test-d1601';
    if (config.projectId && expectedTestProject && String(config.projectId) !== String(expectedTestProject)) {
      errors.push(`Resolved Firebase project ${config.projectId} does not match CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID=${expectedTestProject}.`);
    }
    if (boolEnv('CHAOS_ALLOW_MUTATION') && /^(cheers-34b8d)$/i.test(String(config.projectId || ''))) {
      errors.push(`Mutation testing refuses the known production Firebase project: ${config.projectId}.`);
    }
    if (boolEnv('CHAOS_QA_USE_PROD_FIREBASE')) errors.push('CHAOS_QA_USE_PROD_FIREBASE must not be true for the full mutation release gate.');
  } catch (error) {
    errors.push(`Firebase TEST client config could not be resolved: ${error.message}`);
  }


  const safetyForMutation = assertMutationSafety({
    env: process.env,
    appUrl,
    projectId: firebaseProjectId || process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID,
    runId,
    requireAdminCredentials: boolEnv('CHAOS_ALLOW_MUTATION') || boolEnv('CHAOS_QA_AUTO_PROVISION_TEST_USERS'),
    allowLocalEmulator: boolEnv('CHAOS_ALLOW_LOCAL_UI_ONLY')
  });
  if (!safetyForMutation.ok && (boolEnv('CHAOS_ALLOW_MUTATION') || boolEnv('CHAOS_QA_AUTO_PROVISION_TEST_USERS'))) errors.push(...safetyForMutation.errors);

  if (/^(1|true|yes)$/i.test(String(process.env.DISABLE_ESLINT_PLUGIN || ''))) {
    warnings.push('DISABLE_ESLINT_PLUGIN=true was found. The release runner overrides it to false so build linting cannot be hidden.');
  }

  if (boolEnv('CHAOS_REQUIRE_NOTIFICATION_PIPELINE')) {
    const expectedBugEmail = value('CHAOS_EXPECTED_BUG_EMAIL_TO');
    const expectedPushEmail = value('CHAOS_EXPECTED_PUSH_RECIPIENT_EMAIL');
    if (!expectedBugEmail) errors.push('CHAOS_EXPECTED_BUG_EMAIL_TO is required when CHAOS_REQUIRE_NOTIFICATION_PIPELINE=true.');
    if (!expectedPushEmail) errors.push('CHAOS_EXPECTED_PUSH_RECIPIENT_EMAIL is required when CHAOS_REQUIRE_NOTIFICATION_PIPELINE=true.');
    if (/example\.com|REPLACE_ME/i.test(String(expectedBugEmail || ''))) errors.push('CHAOS_EXPECTED_BUG_EMAIL_TO still contains a template placeholder.');
    if (/example\.com|REPLACE_ME/i.test(String(expectedPushEmail || ''))) errors.push('CHAOS_EXPECTED_PUSH_RECIPIENT_EMAIL still contains a template placeholder.');
  }

  const result = {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    runId,
    node: process.version,
    appUrl,
    sourceVersion,
    packageVersion,
    expectedVersion,
    deployedVersion,
    visibleVersion,
    htmlVersion,
    firebaseProjectId,
    envFilesLoaded: loaded,
    accounts: accounts.map(a => ({ prefix: a.prefix, emailPresent: Boolean(a.email), passwordPresent: a.passwordPresent })),
    firebaseConfigResolved: Boolean(present.FIREBASE_CLIENT_CONFIG),
    notificationEvidenceRequired: boolEnv('CHAOS_REQUIRE_NOTIFICATION_PIPELINE'),
    mutationRequested: boolEnv('CHAOS_ALLOW_MUTATION'),
    qaWorkspaceName,
    qaWorkspaceValidation: qaNameCheck,
    mutationSafety: safetyForMutation,
    versionEvidence: {
      versionJsonStatus: versionFetch?.status || null,
      versionJsonUrl: versionFetch?.url || '',
      htmlStatus: htmlFetch?.status || null,
      htmlUrl: htmlFetch?.url || '',
    },
    errors,
    warnings,
  };
  const output = path.join(runDir, 'environment-preflight.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(`Source version: ${sourceVersion || '(unknown)'}`);
  console.log(`Expected version: ${expectedVersion || '(missing)'}`);
  console.log(`Deployed version: ${deployedVersion || '(unknown)'}`);
  console.log(`Visible version: ${visibleVersion || '(not available before login)'}`);
  console.log(`Firebase testing project: ${firebaseProjectId || '(unknown)'}`);
  console.log(JSON.stringify({ ...result, output }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  const result = { ok: false, generatedAt: new Date().toISOString(), runId, error: error.stack || error.message, errors: [error.message] };
  fs.writeFileSync(path.join(runDir, 'environment-preflight.json'), JSON.stringify(result, null, 2));
  console.error(error.stack || error.message);
  process.exit(1);
});

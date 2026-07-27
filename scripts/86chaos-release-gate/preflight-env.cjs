const fs = require('fs');
const path = require('path');
const { loadEnv, env, boolEnv } = require('../86chaos-full-audit/env-loader.cjs');

const root = process.cwd();
const outDir = path.join(root, 'test-results', '86chaos-play-store-release-gate');
fs.mkdirSync(outDir, { recursive: true });
const loaded = loadEnv(root);

const errors = [];
const warnings = [];
const present = {};

function value(...names) {
  const v = env(...names);
  for (const n of names) if (process.env[n]) present[n] = true;
  return v;
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

const appUrl = value('APP_URL', 'CHAOS_BASE_URL', 'BASE_URL');
const expectedVersion = value('CHAOS_EXPECTED_VERSION');
const qaWorkspaceName = value('CHAOS_QA_WORKSPACE_NAME', 'CHAOS_QA_WORKSPACE') || '86 Chaos Full Audit QA Restaurant';
if (qaWorkspaceName !== '86 Chaos Full Audit QA Restaurant') errors.push('CHAOS_QA_WORKSPACE_NAME must be exactly "86 Chaos Full Audit QA Restaurant" so Platform Operations cleanup can identify it.');
if (!appUrl) errors.push('Missing APP_URL or CHAOS_BASE_URL.');
if (/YOUR-LATEST|REPLACE_ME|example\.com/i.test(String(appUrl || ''))) errors.push('APP_URL still contains a template placeholder. Replace it with the real safe testing-preview URL.');
if (!expectedVersion) errors.push('Missing CHAOS_EXPECTED_VERSION.');

let parsedUrl = null;
try { parsedUrl = appUrl ? new URL(appUrl) : null; }
catch (_) { errors.push(`APP_URL is not a valid absolute URL: ${appUrl}`); }
if (parsedUrl) {
  if (parsedUrl.hostname === 'app.86chaos.com') errors.push('The full release gate refuses production app.86chaos.com. Use a safe testing/preview deployment.');
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsedUrl.hostname) && !boolEnv('CHAOS_ALLOW_LOCAL_UI_ONLY')) {
    errors.push('APP_URL points to localhost. A React dev server cannot fully exercise Vercel /api routes. Use the latest safe Vercel testing preview, or explicitly set CHAOS_ALLOW_LOCAL_UI_ONLY=true for a non-release diagnostic run.');
  }
  if (!/^https?:$/.test(parsedUrl.protocol)) errors.push('APP_URL must use http or https.');
}

const accounts = [requirePair('OWNER'), requirePair('MANAGER'), requirePair('STAFF'), requirePair('SYSTEM_ADMIN')];
const owner = accounts[0];
const manager = accounts[1];
const staff = accounts[2];
if (owner.email && manager.email && owner.email === manager.email) errors.push('OWNER_EMAIL and MANAGER_EMAIL must be different accounts so role isolation can be tested.');
if (owner.email && staff.email && owner.email === staff.email) errors.push('OWNER_EMAIL and STAFF_EMAIL must be different accounts so role isolation can be tested.');
if (manager.email && staff.email && manager.email === staff.email) errors.push('MANAGER_EMAIL and STAFF_EMAIL must be different accounts so role isolation can be tested.');

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) errors.push(`Node 24.x is required. Current Node is ${process.version}.`);

for (const required of ['package.json', 'package-lock.json', 'src/App.js', 'src/core/appCore.js', 'firestore.rules', 'storage.rules', 'vercel.json']) {
  if (!fs.existsSync(path.join(root, required))) errors.push(`Missing required app file: ${required}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (expectedVersion && pkg.version && pkg.version !== expectedVersion) warnings.push(`package.json version is ${pkg.version}, but CHAOS_EXPECTED_VERSION is ${expectedVersion}. The runtime version test will decide whether this is a release blocker.`);
} catch (error) {
  errors.push(`Could not read package.json: ${error.message}`);
}

try {
  const { readFirebaseConfig } = require('../86chaos-full-audit/firebase-client.cjs');
  const config = readFirebaseConfig();
  present.FIREBASE_CLIENT_CONFIG = true;
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
  node: process.version,
  appUrl,
  expectedVersion,
  envFilesLoaded: loaded,
  accounts: accounts.map(a => ({ prefix: a.prefix, emailPresent: Boolean(a.email), passwordPresent: a.passwordPresent })),
  firebaseConfigResolved: Boolean(present.FIREBASE_CLIENT_CONFIG),
  notificationEvidenceRequired: boolEnv('CHAOS_REQUIRE_NOTIFICATION_PIPELINE'),
  mutationRequested: boolEnv('CHAOS_ALLOW_MUTATION'),
  qaWorkspaceName,
  errors,
  warnings,
};
const output = path.join(outDir, 'environment-preflight.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, output }, null, 2));
if (!result.ok) process.exitCode = 1;

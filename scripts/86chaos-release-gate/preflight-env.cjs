const fs = require('fs');
const path = require('path');
const { loadEnv, env, boolEnv } = require('../86chaos-full-audit/env-loader.cjs');
const { ensureRunDir, writeJson } = require('./run-context.cjs');
const { applyQaWorkspaceEnv, validateQaWorkspaceName } = require('./qa-workspace.cjs');
const { assertMutationSafety } = require('./mutation-safety.cjs');
const { captureSourceIdentity, hash, sourceBytes } = require('./source-identity.cjs');
const {
  CANONICAL_VERCEL_PROJECT_SLUG,
  inspectReleaseTargetEnvConflicts,
  validateReleaseTarget,
} = require('./vercel-targets.cjs');
const { validateFirebaseAuthReferrer, firebaseAuthReferrerUrl } = require('./firebase-auth-referrer.cjs');

const { root, runId, runDir } = ensureRunDir();
const errors = [];
const warnings = [];
const targetEnvConflicts = inspectReleaseTargetEnvConflicts(root, process.env);
if (!targetEnvConflicts.ok) errors.push(...targetEnvConflicts.errors);
const loaded = loadEnv(root);
const present = {};

function value(...names) {
  const v = env(...names);
  for (const n of names) if (process.env[n]) present[n] = true;
  return v;
}

function sanitizeVersionText(text = '') {
  return String(text || '').trim().replace(/^v(?:ersion)?\s*/i, '').trim();
}

function immutableVercelUrl(value = '') {
  try {
    const url = new URL(String(value || ''));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    if (!host.endsWith('.vercel.app')) return '';
    if (/-git-[^.]+-/i.test(host)) return '';
    return `${url.protocol}//${url.host}`;
  } catch (_) { return ''; }
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
  const expectedVersion = sanitizeVersionText(value('CHAOS_EXPECTED_VERSION') || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
  const certificationMode=boolEnv('CHAOS_CERTIFICATION_MODE');
  const configuredCommit=value('CHAOS_EXPECTED_GIT_COMMIT');
  const expectedBranch=value('CHAOS_EXPECTED_BRANCH')||'testing';
  const configuredManifest=value('CHAOS_SOURCE_MANIFEST_HASH');
  const expectedArchiveSha256=value('CHAOS_SOURCE_ARCHIVE_SHA256');
  const configuredDeploymentId=value('CHAOS_IMMUTABLE_VERCEL_DEPLOYMENT_ID','CHAOS_VERCEL_DEPLOYMENT_ID');
  const configuredDeploymentUrl=value('CHAOS_IMMUTABLE_VERCEL_URL');
  const configuredVercelProjectId=value('CHAOS_EXPECTED_VERCEL_PROJECT_ID');
  const expectedTestProject=value('CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID')||'chaos-test-d1601';
  const qaWorkspaceName = applyQaWorkspaceEnv(process.env, runId);
  const qaNameCheck = validateQaWorkspaceName(qaWorkspaceName, runId);
  if (!qaNameCheck.ok) errors.push(...qaNameCheck.errors);
  if (!appUrl) errors.push('Missing APP_URL or CHAOS_BASE_URL.');
  if (/YOUR-LATEST|REPLACE_ME|example\.com/i.test(String(appUrl || ''))) errors.push('APP_URL still contains a template placeholder. Replace it with the real safe testing-preview URL.');
  if (!expectedVersion) errors.push('Missing CHAOS_EXPECTED_VERSION.');
  const sourceIdentity=captureSourceIdentity(root);
  const expectedCommit=String(configuredCommit||sourceIdentity.commit||'').trim();
  const expectedManifest=String(configuredManifest||sourceIdentity.sourceHash||'').trim();
  let expectedDeploymentId=String(configuredDeploymentId||'').trim();
  let expectedDeploymentUrl=String(configuredDeploymentUrl||'').trim();
  let expectedVercelProjectId=String(configuredVercelProjectId||'').trim();
  if(certificationMode){
    if(!sourceIdentity.commit)errors.push('Exact local Git commit identity is required for full certification.');
    if(configuredCommit&&sourceIdentity.commit!==configuredCommit)errors.push('Local HEAD does not match configured CHAOS_EXPECTED_GIT_COMMIT.');
    if(sourceIdentity.branch!==expectedBranch)errors.push(`Full certification must run from the ${expectedBranch} branch.`);
    if(sourceIdentity.dirty)errors.push(`Full certification requires a clean Git working tree${sourceIdentity.dirtyPaths?.length?`: ${sourceIdentity.dirtyPaths.join(', ')}`:''}.`);
    if(!/^[a-f0-9]{64}$/i.test(expectedManifest)||sourceIdentity.sourceHash!==expectedManifest)errors.push('Local source manifest is unavailable or does not match the configured certification manifest.');
    if(expectedArchiveSha256&&!/^[a-f0-9]{64}$/i.test(expectedArchiveSha256))errors.push('CHAOS_SOURCE_ARCHIVE_SHA256 is malformed.');
  }

  let parsedUrl = null;
  try { parsedUrl = appUrl ? new URL(appUrl) : null; }
  catch (_) { errors.push(`APP_URL is not a valid absolute URL: ${appUrl}`); }
  if (parsedUrl) {
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsedUrl.hostname) && !boolEnv('CHAOS_ALLOW_LOCAL_UI_ONLY')) {
      errors.push('APP_URL points to localhost. A React dev server cannot fully exercise Vercel /api routes. Use the latest safe Vercel testing preview, or explicitly set CHAOS_ALLOW_LOCAL_UI_ONLY=true for a non-release diagnostic run.');
    }
    if (!/^https?:$/.test(parsedUrl.protocol)) errors.push('APP_URL must use http or https.');
  }

  let targetValidation = validateReleaseTarget({
    appUrl,
    chaosBaseUrl: process.env.CHAOS_BASE_URL || '',
    expectedProjectSlug: value('CHAOS_EXPECTED_VERCEL_PROJECT_SLUG') || CANONICAL_VERCEL_PROJECT_SLUG,
    expectedVersion,
    allowLocal: boolEnv('CHAOS_ALLOW_LOCAL_UI_ONLY'),
  });
  if (!targetValidation.ok) errors.push(...targetValidation.errors);
  if (targetValidation.warnings?.length) warnings.push(...targetValidation.warnings);

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
  let clientBuildIdentity=null,serverBuildIdentity=null;
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
    try{const response=await fetchText(`${new URL('/build-identity.json',appUrl)}?releaseGateRun=${encodeURIComponent(runId)}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);clientBuildIdentity=JSON.parse(response.text||'{}');}catch(error){errors.push(`Could not fetch deployed client build identity: ${error.message}`);}
    try{const response=await fetchText(`${new URL('/api/build-identity',appUrl)}?releaseGateRun=${encodeURIComponent(runId)}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);serverBuildIdentity=JSON.parse(response.text||'{}');}catch(error){errors.push(`Could not fetch deployed server build identity: ${error.message}`);}
    if(certificationMode&&clientBuildIdentity&&serverBuildIdentity){
      expectedDeploymentUrl=expectedDeploymentUrl||immutableVercelUrl(serverBuildIdentity.vercelDeploymentUrl);
      expectedDeploymentId=expectedDeploymentId||String(serverBuildIdentity.vercelDeploymentId||'').trim();
      expectedVercelProjectId=expectedVercelProjectId||String(serverBuildIdentity.vercelProjectId||'').trim();
      for(const [label,identity] of [['client',clientBuildIdentity],['server',serverBuildIdentity]]){
        const manifest=identity.sourceManifestHash||identity.sourceHash;
        if(identity.identityStampStatus!=='verified')errors.push(`Deployed ${label} build identity is degraded and cannot be certified.`);
        if(manifest!==expectedManifest)errors.push(`Deployed ${label} source manifest does not match the local certification source manifest.`);
        if(String(identity.version||'')!==expectedVersion)errors.push(`Deployed ${label} version does not match CHAOS_EXPECTED_VERSION.`);
      }
      if(!serverBuildIdentity.gitCommit||serverBuildIdentity.gitCommit!==expectedCommit)errors.push('Deployed server Git commit does not match the clean local certification commit.');
      if(serverBuildIdentity.gitBranch!==expectedBranch)errors.push('Deployed server Git branch does not match CHAOS_EXPECTED_BRANCH.');
      const observedImmutableUrl=immutableVercelUrl(serverBuildIdentity.vercelDeploymentUrl);
      if(!observedImmutableUrl)errors.push('Deployed server did not expose a stable immutable Vercel deployment URL.');
      if(expectedDeploymentUrl&&observedImmutableUrl!==immutableVercelUrl(expectedDeploymentUrl))errors.push('Deployed server URL does not match the expected immutable Vercel URL.');
      if(configuredDeploymentId&&serverBuildIdentity.vercelDeploymentId!==configuredDeploymentId)errors.push('Deployed server identity does not match configured CHAOS_IMMUTABLE_VERCEL_DEPLOYMENT_ID.');
      if(!expectedVercelProjectId)errors.push('Deployed server did not expose a Vercel project ID.');
      else if(serverBuildIdentity.vercelProjectId!==expectedVercelProjectId)errors.push('Deployed server identity does not match the expected Vercel project ID.');
      if(serverBuildIdentity.firebaseTestingProject!==expectedTestProject)errors.push('Deployed server Firebase target does not match the required testing project.');
      if(clientBuildIdentity.firebaseTestingProject&&clientBuildIdentity.firebaseTestingProject!==expectedTestProject)errors.push('Deployed client build identity does not match the required testing Firebase project.');
      if(expectedArchiveSha256&&serverBuildIdentity.sourceArchiveSha256&&serverBuildIdentity.sourceArchiveSha256!==expectedArchiveSha256)errors.push('Optional deployed archive identity conflicts with CHAOS_SOURCE_ARCHIVE_SHA256.');
      for(const [key,file] of Object.entries({rulesHash:'firestore.rules',firebaseConfigHash:'firebase.json',vercelConfigHash:'vercel.json'})) {
        const localHash=hash(sourceBytes(file,fs.readFileSync(path.join(root,file))));
        if(clientBuildIdentity[key]!==localHash||serverBuildIdentity[key]!==localHash) errors.push(`Deployed protected configuration ${file} does not match local source.`);
      }
      if (expectedDeploymentUrl) {
        const pinnedClient=await fetchText(`${expectedDeploymentUrl}/build-identity.json?releaseGateRun=${encodeURIComponent(runId)}`);
        const pinnedServer=await fetchText(`${expectedDeploymentUrl}/api/build-identity?releaseGateRun=${encodeURIComponent(runId)}`);
        if(!pinnedClient.ok||!pinnedServer.ok) errors.push('Immutable deployment identity could not be fetched.');
        else {
          const client=JSON.parse(pinnedClient.text),server=JSON.parse(pinnedServer.text);
          for(const key of ['sourceManifestHash','gitCommit','gitBranch','vercelDeploymentId','vercelDeploymentUrl','vercelProjectId','firebaseTestingProject','rulesHash','firebaseConfigHash','vercelConfigHash','version','identityStampStatus','sourceEvidence','workspaceVerification']) if(server[key]!==serverBuildIdentity[key]) errors.push(`Immutable deployment differs from alias identity: ${key}.`);
          if((client.sourceManifestHash||client.sourceHash)!==expectedManifest || client.version!==expectedVersion) errors.push('Immutable client source/version differs from the confirmed candidate.');
        }
      }
      if(clientBuildIdentity.sourceFiles && clientBuildIdentity.sourceManifestHash!==expectedManifest) {
        const deployed=new Map(clientBuildIdentity.sourceFiles.map(row=>[row.file,row.sha256]));
        const differing=sourceIdentity.files.filter(row=>deployed.get(row.file)!==row.sha256).map(row=>row.file);
        errors.push(`Source differences: ${differing.slice(0,12).join(', ') || 'deployment contains additional files'}. Rebuild the exact testing commit.`);
      }
    }
  }
  visibleVersion = htmlVersion || '';
  targetValidation = validateReleaseTarget({
    appUrl,
    chaosBaseUrl: process.env.CHAOS_BASE_URL || '',
    expectedProjectSlug: value('CHAOS_EXPECTED_VERCEL_PROJECT_SLUG') || CANONICAL_VERCEL_PROJECT_SLUG,
    expectedVersion,
    certificationMode,
    sourceIdentity:{version:sourceIdentity.version,sourceHash:sourceIdentity.sourceHash,commit:sourceIdentity.commit,branch:sourceIdentity.branch,dirty:sourceIdentity.dirty},
    expectedIdentity:{commit:expectedCommit||null,branch:expectedBranch,sourceManifestHash:expectedManifest||null,sourceArchiveSha256:expectedArchiveSha256||null,vercelDeploymentId:expectedDeploymentId||null,vercelDeploymentUrl:expectedDeploymentUrl||null,vercelProjectId:expectedVercelProjectId||null},
    deploymentIdentityStart:{client:clientBuildIdentity,server:serverBuildIdentity},
    sourceVersion,
    deployedVersion,
    allowLocal: boolEnv('CHAOS_ALLOW_LOCAL_UI_ONLY'),
  });
  if (!targetValidation.ok) errors.push(...targetValidation.errors);
  if (targetValidation.warnings?.length) warnings.push(...targetValidation.warnings);
  if (expectedVersion && visibleVersion && visibleVersion !== expectedVersion) errors.push(`Application HTML/visible version evidence reports ${visibleVersion}, but CHAOS_EXPECTED_VERSION is ${expectedVersion}. Stop now; the preview is stale.`);

  let firebaseProjectId = '';
  try {
    const { readFirebaseConfig } = require('../86chaos-full-audit/firebase-client.cjs');
    const config = readFirebaseConfig();
    present.FIREBASE_CLIENT_CONFIG = true;
    firebaseProjectId = config.projectId || '';
    if (!config.projectId) errors.push('Testing Firebase projectId could not be resolved.');
    if (config.projectId && expectedTestProject && String(config.projectId) !== String(expectedTestProject)) {
      errors.push(`Resolved Firebase project ${config.projectId} does not match CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID=${expectedTestProject}.`);
    }
    if (boolEnv('CHAOS_ALLOW_MUTATION') && /^(cheers-34b8d)$/i.test(String(config.projectId || ''))) {
      errors.push(`Mutation testing refuses the known production Firebase project: ${config.projectId}.`);
    }
    if (boolEnv('CHAOS_QA_USE_PROD_FIREBASE')) errors.push('CHAOS_QA_USE_PROD_FIREBASE must not be true for the full mutation release gate.');
    const authReferrerValidation = validateFirebaseAuthReferrer({ firebaseProjectId: config.projectId || '' });
    if (!authReferrerValidation.ok) errors.push(...authReferrerValidation.errors);
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
    primaryBlockingFailure: errors[0] || '',
    generatedAt: new Date().toISOString(),
    runId,
    node: process.version,
    appUrl,
    chaosBaseUrl: process.env.CHAOS_BASE_URL || '',
    canonicalVercelProjectSlug: targetValidation.canonicalVercelProjectSlug || CANONICAL_VERCEL_PROJECT_SLUG,
    appUrlHostname: targetValidation.hostname || '',
    appUrlHostAppearsCanonical: Boolean(targetValidation.hostAppearsCanonical),
    retiredVercelProject: targetValidation.retiredVercelProject || '',
    targetEnvConflicts,
    sourceVersion,
    packageVersion,
    expectedVersion,
    deployedVersion,
    visibleVersion,
    htmlVersion,
    firebaseProjectId,
    firebaseAuthReferrerUrl: firebaseAuthReferrerUrl(),
    envFilesLoaded: loaded,
    accounts: accounts.map(a => ({ prefix: a.prefix, emailPresent: Boolean(a.email), passwordPresent: a.passwordPresent })),
    firebaseConfigResolved: Boolean(present.FIREBASE_CLIENT_CONFIG),
    notificationEvidenceRequired: boolEnv('CHAOS_REQUIRE_NOTIFICATION_PIPELINE'),
    mutationRequested: boolEnv('CHAOS_ALLOW_MUTATION'),
    qaWorkspaceName,
    qaWorkspaceValidation: qaNameCheck,
    mutationSafety: safetyForMutation,
    certificationMode,
    sourceIdentity: { version: sourceIdentity.version, sourceHash: sourceIdentity.sourceHash, commit: sourceIdentity.commit, branch: sourceIdentity.branch, dirty: sourceIdentity.dirty },
    expectedIdentity: {
      commit: expectedCommit || null,
      branch: expectedBranch,
      sourceManifestHash: expectedManifest || null,
      sourceArchiveSha256: expectedArchiveSha256 || null,
      vercelDeploymentId: expectedDeploymentId || null,
      vercelDeploymentUrl: expectedDeploymentUrl || null,
      vercelProjectId: expectedVercelProjectId || null,
      firebaseTestingProject: expectedTestProject,
    },
    deploymentIdentityStart: { client: clientBuildIdentity, server: serverBuildIdentity },
    resolvedImmutableDeploymentUrl: immutableVercelUrl(serverBuildIdentity?.vercelDeploymentUrl || expectedDeploymentUrl),
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

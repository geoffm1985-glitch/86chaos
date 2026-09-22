'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { captureBuildSourceIdentity, sourceBytes, readBundledSourceManifest } = require('./86chaos-release-gate/source-identity.cjs');

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function safeHash(file) {
  try { return crypto.createHash('sha256').update(sourceBytes(file, fs.readFileSync(file))).digest('hex'); } catch (_) { return null; }
}

function manifestSourceHash(root, file) {
  try {
    const manifest = readBundledSourceManifest(root);
    const row = manifest?.files?.find(entry => entry.file === file);
    return row?.sha256 || null;
  } catch (_) { return null; }
}
function protectedSourceHash(root, file) {
  // Vercel may materialize/normalize configuration files in its temporary build
  // workspace. Certification is bound to the committed release manifest, so use
  // that source-of-truth on Vercel and actual local bytes everywhere else.
  if (process.env.VERCEL) return manifestSourceHash(root, file);
  return safeHash(path.join(root, file));
}

function fallbackIdentity(root, error) {
  const pkg = readJson(path.join(root, 'package.json'));
  return {
    schemaVersion: 5,
    version: pkg.version || null,
    sourceHash: null,
    files: [],
    commit: String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim() || null,
    branch: String(process.env.VERCEL_GIT_COMMIT_REF || '').trim() || null,
    dirty: false,
    buildSourceChanges: [],
    sourceEvidence: 'unavailable',
    workspaceVerification: 'not-run',
    identityStampStatus: 'degraded',
    identityStampError: String(error?.message || error || 'Unknown build identity error').slice(0, 2000),
    capturedAt: new Date().toISOString(),
    previewUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.APP_URL || null,
    intendedProductionUrl: 'https://app.86chaos.com',
  };
}
function buildIdentityPayload(root = process.cwd()) {
  let fullIdentity;
  try {
    fullIdentity = { ...captureBuildSourceIdentity(root), identityStampStatus: 'verified', identityStampError: null };
  } catch (error) {
    // Deployment availability and certification evidence are separate concerns.
    // Never take down a valid application build solely because identity evidence
    // could not be stamped. The release gate rejects degraded/missing manifest
    // evidence before certification.
    fullIdentity = fallbackIdentity(root, error);
    console.warn(`Build identity degraded: ${fullIdentity.identityStampError}`);
  }
  const { files = [], dirtyPaths, ...identity } = fullIdentity;
  const groupsPath = path.join(root, 'test-tools/certification/groups.json');
  const versionPath = path.join(root, 'public/version.json');
  const groups = fs.existsSync(groupsPath) ? fs.readFileSync(groupsPath, 'utf8') : '';
  const version = readJson(versionPath, { version: identity.version || null, releaseTitle: null });
  let firebaseTestingProject = process.env.CHAOS_FIREBASE_TEST_PROJECT
    || process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID
    || process.env.REACT_APP_FIREBASE_PROJECT_ID
    || null;
  if (!firebaseTestingProject) {
    try { firebaseTestingProject = require('./86chaos-full-audit/firebase-client.cjs').readFirebaseConfig().projectId || null; } catch (_) {}
  }
  const inRoot = file => path.join(root, file);
  return {
    ...identity,
    sourceFiles: files,
    sourceArchiveSha256: process.env.CHAOS_SOURCE_ARCHIVE_SHA256 || null,
    sourceManifestHash: identity.sourceHash || null,
    expectedBranch: process.env.CHAOS_EXPECTED_BRANCH || 'testing',
    immutableVercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.CHAOS_VERCEL_DEPLOYMENT_ID || null,
    firebaseTestingProject,
    rulesHash: protectedSourceHash(root, 'firestore.rules'),
    firebaseConfigHash: protectedSourceHash(root, 'firebase.json'),
    vercelConfigHash: protectedSourceHash(root, 'vercel.json'),
    protectedConfigEvidence: process.env.VERCEL ? 'bundled-manifest' : 'workspace-source',
    clientVersion: version.version || identity.version || null,
    serverVersion: version.version || identity.version || null,
    releaseTitle: version.releaseTitle || null,
    mandatoryGroupsHash: groups ? crypto.createHash('sha256').update(groups).digest('hex') : null,
    buildTimestamp: new Date().toISOString(),
    certified: false,
  };
}
function writeBuildIdentity(root = process.cwd()) {
  const payload = buildIdentityPayload(root);
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'build-identity.json'), JSON.stringify(payload, null, 2) + '\n');
  console.log(`Build ${payload.version || 'unknown'}: source ${payload.sourceManifestHash || 'unavailable'}, commit ${payload.commit || 'ZIP source'}, branch ${payload.branch || 'unknown'}, identity ${payload.identityStampStatus}`);
  return payload;
}

if (require.main === module) writeBuildIdentity();
module.exports = { buildIdentityPayload, writeBuildIdentity, fallbackIdentity };

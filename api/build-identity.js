'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { APP_VERSION } = require('./_version');

module.exports = function buildIdentity(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Use GET.' });
  const file = path.join(process.cwd(), 'public', 'build-identity.json');
  let stamped = {};
  try { stamped = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return res.status(503).json({ ok: false, error: 'Build identity is unavailable.' }); }
  const firebaseTestingProject = process.env.CHAOS_FIREBASE_TEST_PROJECT
    || process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID
    || stamped.firebaseTestingProject
    || null;
  return res.status(200).json({
    ok: true,
    version: APP_VERSION,
    sourceManifestHash: stamped.sourceManifestHash || stamped.sourceHash || null,
    sourceEvidence: stamped.sourceEvidence || null,
    workspaceVerification: stamped.workspaceVerification || null,
    identityStampStatus: stamped.identityStampStatus || null,
    identityStampError: stamped.identityStampError || null,
    sourceArchiveSha256: process.env.CHAOS_SOURCE_ARCHIVE_SHA256 || stamped.sourceArchiveSha256 || null,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || stamped.commit || null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || stamped.branch || null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.CHAOS_VERCEL_DEPLOYMENT_ID || null,
    vercelDeploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : stamped.previewUrl || null,
    vercelProjectId: process.env.VERCEL_PROJECT_ID || process.env.CHAOS_VERCEL_PROJECT_ID || null,
    firebaseTestingProject,
    rulesHash: stamped.rulesHash || null,
    firebaseConfigHash: stamped.firebaseConfigHash || null,
    vercelConfigHash: stamped.vercelConfigHash || null,
    protectedConfigEvidence: stamped.protectedConfigEvidence || null,
  });
};

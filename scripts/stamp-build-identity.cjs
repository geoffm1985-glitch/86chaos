'use strict';
const fs = require('fs');
const crypto = require('crypto');
const { captureBuildSourceIdentity, sourceBytes } = require('./86chaos-release-gate/source-identity.cjs');
const { files, dirtyPaths, ...identity } = captureBuildSourceIdentity();
const groups = fs.readFileSync('test-tools/certification/groups.json', 'utf8');
const version = JSON.parse(fs.readFileSync('public/version.json', 'utf8'));
const shaFile = file => fs.existsSync(file) ? crypto.createHash('sha256').update(sourceBytes(file, fs.readFileSync(file))).digest('hex') : null;
let firebaseTestingProject = process.env.CHAOS_FIREBASE_TEST_PROJECT
  || process.env.REACT_APP_TEST_FIREBASE_PROJECT_ID
  || process.env.REACT_APP_FIREBASE_PROJECT_ID
  || null;
if (!firebaseTestingProject) {
  try { firebaseTestingProject = require('./86chaos-full-audit/firebase-client.cjs').readFirebaseConfig().projectId || null; } catch (_) {}
}
fs.writeFileSync('public/build-identity.json', JSON.stringify({
  ...identity,
  sourceFiles: files,
  sourceArchiveSha256: process.env.CHAOS_SOURCE_ARCHIVE_SHA256 || null,
  sourceManifestHash: identity.sourceHash,
  expectedBranch: process.env.CHAOS_EXPECTED_BRANCH || 'testing',
  immutableVercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID || process.env.CHAOS_VERCEL_DEPLOYMENT_ID || null,
  firebaseTestingProject,
  rulesHash: shaFile('firestore.rules'),
  firebaseConfigHash: shaFile('firebase.json'),
  vercelConfigHash: shaFile('vercel.json'),
  clientVersion: version.version,
  serverVersion: version.version,
  releaseTitle: version.releaseTitle,
  mandatoryGroupsHash: crypto.createHash('sha256').update(groups).digest('hex'),
  buildTimestamp: new Date().toISOString(),
  certified: false,
}, null, 2) + '\n');
console.log(`Build ${identity.version}: source ${identity.sourceHash}, commit ${identity.commit || 'ZIP source'}, branch ${identity.branch || 'unknown'}`);

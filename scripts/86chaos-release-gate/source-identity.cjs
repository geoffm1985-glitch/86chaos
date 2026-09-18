'use strict';
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const cp = require('child_process');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const excluded = new Set(['.git', 'node_modules', 'build', 'coverage', 'test-results', 'playwright-report', 'release-evidence', '__pycache__']);
function sourceFiles(root, directory = root, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('.log') || entry.name.endsWith('.pyc')) continue;
    const absolute = path.join(directory, entry.name); const relative = path.relative(root, absolute).replace(/\\/g, '/');
    if (relative === 'public/build-identity.json') continue;
    if (entry.isDirectory()) sourceFiles(root, absolute, files);
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}
function git(root, args) { const result = cp.spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000 }); return result.status === 0 ? result.stdout.trim() : ''; }
function captureSourceIdentity(root = process.cwd()) {
  const files = sourceFiles(root).map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
  const packagePath = path.join(root, 'package.json');
  let version = null;
  try { version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || null; } catch (_) {}
  return { schemaVersion: 1, version,
    sourceHash: hash(JSON.stringify(files)), files, commit: git(root, ['rev-parse', 'HEAD']) || null, branch: git(root, ['branch', '--show-current']) || null,
    dirty: Boolean(git(root, ['status', '--porcelain', '--untracked-files=normal'])), capturedAt: new Date().toISOString(),
    previewUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.APP_URL || null,
    intendedProductionUrl: 'https://app.86chaos.com', sourceArtifact: process.env.CHAOS_SOURCE_ARTIFACT || null };
}
function compareSourceIdentity(before, after, options = {}) {
  const failures = [];
  if (!before || !after) return { ok: false, failures: ['Source identity evidence is missing.'] };
  if (!before.version || !after.version) failures.push('Source package/version identity is unavailable; this artifact cannot certify a release.');
  if (before.sourceHash !== after.sourceHash) failures.push('Source files changed after this release-gate run started.');
  if (before.commit !== after.commit) failures.push('Git commit changed after this release-gate run started.');
  if (before.version !== after.version) failures.push('Version changed during this release-gate run.');
  if(options.requireCertification===true){
    const expectedVersion=String(options.expectedVersion||'').trim(),expectedCommit=String(options.expectedCommit||'').trim(),expectedBranch=String(options.expectedBranch||'testing').trim(),expectedManifest=String(options.expectedManifest||'').trim(),archiveSha256=String(options.archiveSha256||'').trim();
    if(!before.commit||!after.commit)failures.push('Exact Git commit identity is required for full certification; null ZIP-source commits cannot certify.');
    if(!before.branch||!after.branch)failures.push('Exact Git branch identity is required for full certification.');
    if(before.dirty||after.dirty)failures.push('The Git working tree must be clean for full certification.');
    if(!expectedCommit)failures.push('CHAOS_EXPECTED_GIT_COMMIT is required for full certification.');else if(before.commit!==expectedCommit||after.commit!==expectedCommit)failures.push('Tested Git commit does not match CHAOS_EXPECTED_GIT_COMMIT.');
    if(!expectedBranch)failures.push('CHAOS_EXPECTED_BRANCH is required for full certification.');else if(before.branch!==expectedBranch||after.branch!==expectedBranch)failures.push(`Tested branch must remain ${expectedBranch}.`);
    if(!expectedManifest||!/^[a-f0-9]{64}$/i.test(expectedManifest))failures.push('CHAOS_SOURCE_MANIFEST_HASH must contain the delivered 64-character source manifest SHA-256.');else if(before.sourceHash!==expectedManifest||after.sourceHash!==expectedManifest)failures.push('Tested source does not match the delivered source manifest.');
    if(!archiveSha256||!/^[a-f0-9]{64}$/i.test(archiveSha256))failures.push('CHAOS_SOURCE_ARCHIVE_SHA256 must contain the delivered archive SHA-256.');
    if(!expectedVersion)failures.push('CHAOS_EXPECTED_VERSION is required for full certification.');else if(before.version!==expectedVersion||after.version!==expectedVersion)failures.push('Tested version does not match CHAOS_EXPECTED_VERSION.');
  }
  return { ok: failures.length === 0, failures, sourceHash: after.sourceHash, commit: after.commit, testedAt: new Date().toISOString() };
}
module.exports = { sourceFiles, captureSourceIdentity, compareSourceIdentity };

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const excludedDirectories = new Set(['.git', '.vercel', '.firebase', 'node_modules', 'build', 'coverage', 'test-results', 'playwright-report', 'release-evidence', '__pycache__']);

function normalizeRelative(value = '') { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, ''); }
function excludedFile(relative = '') {
  const file = normalizeRelative(relative);
  const base = path.posix.basename(file);
  if (!file || file === 'public/build-identity.json') return true;
  if (file.split('/').some(part => excludedDirectories.has(part))) return true;
  if (base.startsWith('.env') || base.endsWith('.log') || base.endsWith('.pyc')) return true;
  if (/^86chaos-release-gate-.*\.zip$/i.test(base)) return true;
  if (/^86chaos_.*_app_only(?:\([^)]*\))?\.zip$/i.test(base)) return true;
  return false;
}

function runGit(root, args, timeout = 5000) {
  const result = cp.spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout, windowsHide: true });
  return result.status === 0 ? String(result.stdout || '') : '';
}

function trackedSourceFiles(root) {
  const output = runGit(root, ['ls-files', '-z'], 10000);
  if (!output) return null;
  const files = output.split('\0').map(normalizeRelative).filter(Boolean).filter(file => !excludedFile(file)).filter(file => fs.existsSync(path.join(root, file)));
  return files.sort();
}

function sourceFiles(root, directory = root, files = []) {
  if (directory === root) {
    const tracked = trackedSourceFiles(root);
    if (tracked && tracked.length) return tracked;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excludedDirectories.has(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('.log') || entry.name.endsWith('.pyc')) continue;
    const absolute = path.join(directory, entry.name);
    const relative = normalizeRelative(path.relative(root, absolute));
    if (excludedFile(relative)) continue;
    if (entry.isDirectory()) sourceFiles(root, absolute, files);
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

function gitIdentity(root) {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_GIT_COMMIT_SHA);
  const localCommit = runGit(root, ['rev-parse', 'HEAD']).trim();
  const localBranch = runGit(root, ['branch', '--show-current']).trim();
  const commit = (isVercel ? String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim() : '') || localCommit || String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim() || null;
  const branch = (isVercel ? String(process.env.VERCEL_GIT_COMMIT_REF || '').trim() : '') || localBranch || String(process.env.VERCEL_GIT_COMMIT_REF || '').trim() || null;
  const status = runGit(root, ['status', '--porcelain', '--untracked-files=normal'], 10000);
  const relevantStatus = status.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean).filter(line => {
    let file = line.length > 3 ? line.slice(3).trim() : '';
    if (file.includes(' -> ')) file = file.split(' -> ').pop();
    return !excludedFile(file);
  });
  return { commit, branch, dirty: relevantStatus.length > 0, dirtyPaths: relevantStatus };
}

function captureSourceIdentity(root = process.cwd()) {
  const files = sourceFiles(root).map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
  const packagePath = path.join(root, 'package.json');
  let version = null;
  try { version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || null; } catch (_) {}
  const git = gitIdentity(root);
  return {
    schemaVersion: 2,
    version,
    sourceHash: hash(JSON.stringify(files)),
    files,
    commit: git.commit,
    branch: git.branch,
    dirty: git.dirty,
    dirtyPaths: git.dirtyPaths,
    capturedAt: new Date().toISOString(),
    previewUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.APP_URL || null,
    intendedProductionUrl: 'https://app.86chaos.com',
    sourceArtifact: process.env.CHAOS_SOURCE_ARTIFACT || null,
  };
}

function compareSourceIdentity(before, after, options = {}) {
  const failures = [];
  if (!before || !after) return { ok: false, failures: ['Source identity evidence is missing.'] };
  if (!before.version || !after.version) failures.push('Source package/version identity is unavailable; this artifact cannot certify a release.');
  if (before.sourceHash !== after.sourceHash) failures.push('Source files changed after this release-gate run started.');
  if (before.commit !== after.commit) failures.push('Git commit changed after this release-gate run started.');
  if (before.version !== after.version) failures.push('Version changed during this release-gate run.');
  if (options.requireCertification === true) {
    const expectedVersion = String(options.expectedVersion || '').trim();
    const expectedCommit = String(options.expectedCommit || '').trim();
    const expectedBranch = String(options.expectedBranch || 'testing').trim();
    const expectedManifest = String(options.expectedManifest || '').trim();
    const archiveSha256 = String(options.archiveSha256 || '').trim();
    if (!before.commit || !after.commit) failures.push('Exact Git commit identity is required for full certification; null ZIP-source commits cannot certify.');
    if (!before.branch || !after.branch) failures.push('Exact Git branch identity is required for full certification.');
    if (before.dirty || after.dirty) failures.push('The Git working tree must be clean for full certification.');
    if (!expectedCommit) failures.push('Expected Git commit identity is required for full certification.');
    else if (before.commit !== expectedCommit || after.commit !== expectedCommit) failures.push('Tested Git commit does not match the expected certification commit.');
    if (!expectedBranch) failures.push('Expected Git branch identity is required for full certification.');
    else if (before.branch !== expectedBranch || after.branch !== expectedBranch) failures.push(`Tested branch must remain ${expectedBranch}.`);
    if (!expectedManifest || !/^[a-f0-9]{64}$/i.test(expectedManifest)) failures.push('A valid 64-character source manifest SHA-256 is required for full certification.');
    else if (before.sourceHash !== expectedManifest || after.sourceHash !== expectedManifest) failures.push('Tested source does not match the certification source manifest.');
    if (archiveSha256 && !/^[a-f0-9]{64}$/i.test(archiveSha256)) failures.push('Provided source archive SHA-256 is malformed.');
    if (!expectedVersion) failures.push('Expected application version is required for full certification.');
    else if (before.version !== expectedVersion || after.version !== expectedVersion) failures.push('Tested version does not match the expected certification version.');
  }
  return { ok: failures.length === 0, failures, sourceHash: after.sourceHash, commit: after.commit, testedAt: new Date().toISOString() };
}

module.exports = { hash, excludedFile, sourceFiles, gitIdentity, captureSourceIdentity, compareSourceIdentity };

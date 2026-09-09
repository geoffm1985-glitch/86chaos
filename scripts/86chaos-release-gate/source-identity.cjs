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
function compareSourceIdentity(before, after) {
  const failures = [];
  if (!before || !after) return { ok: false, failures: ['Source identity evidence is missing.'] };
  if (!before.version || !after.version) failures.push('Source package/version identity is unavailable; this artifact cannot certify a release.');
  if (before.sourceHash !== after.sourceHash) failures.push('Source files changed after this release-gate run started.');
  if (before.commit !== after.commit) failures.push('Git commit changed after this release-gate run started.');
  if (before.version !== after.version) failures.push('Version changed during this release-gate run.');
  return { ok: failures.length === 0, failures, sourceHash: after.sourceHash, commit: after.commit, testedAt: new Date().toISOString() };
}
module.exports = { sourceFiles, captureSourceIdentity, compareSourceIdentity };

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const FORBIDDEN_DIR_NAMES = new Set([
  'node_modules',
  'build',
  'coverage',
  '.git',
  '86chaos-play-store-release-gate',
  '__pycache__',
  'test-results',
]);

const FORBIDDEN_FILE_NAMES = new Set([
  '.last-run.json',
  '.env',
  '.env.local',
  '.env.test.local',
]);

function normalizeRel(value) {
  return String(value || '').split(path.sep).join('/').replace(/^\.\//, '');
}

function isForbiddenRelativePath(relativePath) {
  const rel = normalizeRel(relativePath);
  if (!rel) return false;
  const parts = rel.split('/').filter(Boolean);
  if (parts.some(part => FORBIDDEN_DIR_NAMES.has(part))) return true;
  const base = parts[parts.length - 1] || '';
  return FORBIDDEN_FILE_NAMES.has(base) || base.endsWith('.pyc');
}

function listTrackedFiles(root) {
  if (!fs.existsSync(path.join(root, '.git'))) return null;
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || '').trim();
    throw new Error(`Unable to inspect source-controlled package hygiene with git ls-files.${detail ? ` ${detail}` : ''}`);
  }
  return String(result.stdout || '')
    .split('\0')
    .map(normalizeRel)
    .filter(Boolean);
}

function walkPackageTree(root, dir = root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    const rel = normalizeRel(path.relative(root, absolutePath));
    if (isForbiddenRelativePath(rel)) {
      out.push(rel);
      if (entry.isDirectory()) continue;
    }
    if (entry.isDirectory()) walkPackageTree(root, absolutePath, out);
  }
  return out;
}

function isGeneratedTestArtifact(relativePath) {
  const rel = normalizeRel(relativePath);
  return rel === 'test-results'
    || rel.startsWith('test-results/')
    || rel.endsWith('/__pycache__')
    || rel === '__pycache__'
    || rel.endsWith('.pyc');
}

function isLocalReadinessArtifact(relativePath) {
  const rel = normalizeRel(relativePath);
  const parts = rel.split('/').filter(Boolean);
  const first = parts[0] || '';
  const base = parts[parts.length - 1] || '';
  // Local release readiness runs after npm ci and may run after a production
  // build in the same working directory. Those generated directories must not
  // prevent Playwright from starting. Final app-only ZIP validation still uses
  // strict package-artifact mode and rejects these paths.
  return first === 'node_modules'
    || first === 'build'
    || first === 'test-results'
    || first === '86chaos-play-store-release-gate'
    || first.startsWith('.vite-build-root')
    || base === '.last-run.json'
    || rel.endsWith('/__pycache__')
    || rel === '__pycache__'
    || rel.endsWith('.pyc');
}

function shouldAllowLocalReadinessArtifacts(root, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'allowLocalReadinessArtifacts')) {
    return options.allowLocalReadinessArtifacts === true;
  }
  return process.env.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS === '1'
    && path.resolve(root) === process.cwd();
}

function findAppOnlyHygieneOffenders(root, options = {}) {
  const isActiveWorkingRoot = path.resolve(root) === process.cwd();
  const allowGeneratedTestArtifacts = Object.prototype.hasOwnProperty.call(options, 'allowGeneratedTestArtifacts')
    ? options.allowGeneratedTestArtifacts === true
    : (process.env.CHAOS_ALLOW_GENERATED_TEST_ARTIFACTS === '1' || isActiveWorkingRoot);
  const allowLocalReadinessArtifacts = shouldAllowLocalReadinessArtifacts(root, options);
  const trackedFiles = listTrackedFiles(root);
  if (trackedFiles) {
    // A normal developer checkout is expected to contain generated working
    // artifacts while tests/builds are running. Local readiness may ignore
    // those generated artifacts so Playwright can start, but it never ignores
    // tracked secrets or other forbidden source-controlled files.
    return trackedFiles
      .filter(isForbiddenRelativePath)
      .filter(rel => !(allowGeneratedTestArtifacts && isGeneratedTestArtifact(rel)))
      .filter(rel => !(allowLocalReadinessArtifacts && isLocalReadinessArtifact(rel)))
      .sort();
  }

  // An extracted final app-only release has no .git metadata. In strict mode,
  // the physical package tree itself is the artifact, so forbidden files/dirs
  // must be absent from disk. Local readiness mode is intentionally narrower
  // and exists only to prevent generated npm/build/test outputs in a working
  // checkout from blocking browser/page-load tests before they execute.
  return walkPackageTree(root)
    .filter(rel => !(allowGeneratedTestArtifacts && isGeneratedTestArtifact(rel)))
    .filter(rel => !(allowLocalReadinessArtifacts && isLocalReadinessArtifact(rel)))
    .sort();
}

module.exports = {
  FORBIDDEN_DIR_NAMES,
  FORBIDDEN_FILE_NAMES,
  normalizeRel,
  isForbiddenRelativePath,
  listTrackedFiles,
  walkPackageTree,
  isGeneratedTestArtifact,
  isLocalReadinessArtifact,
  shouldAllowLocalReadinessArtifacts,
  findAppOnlyHygieneOffenders,
};

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

function findAppOnlyHygieneOffenders(root, options = {}) {
  const allowGeneratedTestArtifacts = Object.prototype.hasOwnProperty.call(options, 'allowGeneratedTestArtifacts')
    ? options.allowGeneratedTestArtifacts === true
    : process.env.CHAOS_ALLOW_GENERATED_TEST_ARTIFACTS === '1';
  const trackedFiles = listTrackedFiles(root);
  if (trackedFiles) {
    // A normal developer checkout is expected to contain .git, node_modules,
    // and local ignored test environment files. The release safety question is
    // whether any forbidden artifact is SOURCE CONTROLLED and can therefore be
    // shipped by a source-based deployment/package operation.
    return trackedFiles.filter(isForbiddenRelativePath).sort();
  }

  // An extracted app-only release has no .git metadata. In that mode the
  // physical package tree itself is the artifact, so forbidden files/dirs must
  // be absent from disk.
  return walkPackageTree(root)
    .filter(rel => !(allowGeneratedTestArtifacts && (rel === 'test-results' || rel.startsWith('test-results/') || rel.endsWith('/__pycache__') || rel === '__pycache__' || rel.endsWith('.pyc'))))
    .sort();
}

module.exports = {
  FORBIDDEN_DIR_NAMES,
  FORBIDDEN_FILE_NAMES,
  normalizeRel,
  isForbiddenRelativePath,
  listTrackedFiles,
  walkPackageTree,
  findAppOnlyHygieneOffenders,
};

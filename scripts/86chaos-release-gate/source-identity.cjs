'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const textExtensions = /\.(?:js|jsx|cjs|mjs|ts|tsx|json|css|html|md|txt|ps1|cmd|yml|yaml|rules|py|toml|sh)$/i;
function sourceBytes(file, bytes) { return textExtensions.test(file) || ['.gitignore','.gitattributes','.npmrc'].includes(path.posix.basename(file)) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes; }
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const excludedDirectories = new Set(['.git', '.vercel', '.firebase', 'node_modules', 'build', 'coverage', 'test-results', 'playwright-report', 'release-evidence', '__pycache__', 'dist', '.cache']);

function normalizeRelative(value = '') { return String(value || '').replace(/\\/g, '/').replace(/^\.\//, ''); }
function excludedFile(relative = '') {
  const file = normalizeRelative(relative);
  const base = path.posix.basename(file);
  if (!file || file === 'public/build-identity.json' || file === 'release-source-manifest.json') return true;
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
  const files = output.split('\0').map(normalizeRelative).filter(Boolean).filter(file => !excludedFile(file));
  return files.sort();
}

function sourceFiles(root, directory = root, files = []) {
  if (directory === root && !process.env.VERCEL) {
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
  if (isVercel) {
    return {
      commit: String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim() || null,
      branch: String(process.env.VERCEL_GIT_COMMIT_REF || '').trim() || null,
      dirty: false,
      dirtyPaths: [],
    };
  }
  const localCommit = runGit(root, ['rev-parse', 'HEAD']).trim();
  const localBranch = runGit(root, ['branch', '--show-current']).trim();
  const status = runGit(root, ['status', '--porcelain', '--untracked-files=normal'], 10000);
  const relevantStatus = status.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean).filter(line => {
    let file = line.length > 3 ? line.slice(3).trim() : '';
    if (file.includes(' -> ')) file = file.split(' -> ').pop();
    return !excludedFile(file);
  });
  return { commit: localCommit || null, branch: localBranch || null, dirty: relevantStatus.length > 0, dirtyPaths: relevantStatus };
}

function captureSourceIdentity(root = process.cwd()) {
  const files = sourceFiles(root).map(file => ({ file, sha256: hash(sourceBytes(file, fs.readFileSync(path.join(root, file)))) }));
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


// Bind Vercel's source to the committed tree, then independently check every
// build/runtime input still present in the build workspace against that tree.
// Platform-filtered test/docs files must not change the deployment fingerprint.
function committedSourceFiles(root) {
  const tree = runGit(root, ['ls-tree', '-r', '-z', 'HEAD'], 10000);
  if (!tree) return null;
  const rows = tree.split('\0').filter(Boolean).map(row => {
    const tab = row.indexOf('\t'), [mode, type, oid] = row.slice(0, tab).split(' ');
    return { file: row.slice(tab + 1), mode, type, oid };
  }).filter(row => !excludedFile(row.file)).sort((a,b)=>a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  if (rows.some(row => row.type !== 'blob' || row.mode === '120000')) throw new Error('Release source may not contain submodules or symbolic links.');
  const result = cp.spawnSync('git', ['cat-file', '--batch'], {cwd:root, input:rows.map(row=>row.oid).join('\n')+'\n', maxBuffer:128*1024*1024, timeout:30000});
  if (result.status !== 0) throw new Error('Could not read committed release source.');
  let offset=0;
  return rows.map(row => {
    const end=result.stdout.indexOf(10,offset), header=result.stdout.subarray(offset,end).toString('utf8');
    const size=Number(header.split(' ')[2]);
    if (!Number.isSafeInteger(size)) throw new Error('Incomplete Git source evidence.');
    const bytes=result.stdout.subarray(end+1,end+1+size); offset=end+1+size+1;
    return {file:row.file,sha256:hash(sourceBytes(row.file,bytes))};
  });
}
function isBuildInput(file) {
  return /^(src|api|public|scripts)\//.test(file) || /^(package(?:-lock)?\.json|vercel\.json|firebase\.json|firestore.*|storage\.rules|requirements\.txt)$/.test(file);
}
function readBundledSourceManifest(root) {
  const manifestPath = path.join(root, 'release-source-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) { throw new Error('Bundled release source manifest is invalid JSON.'); }
  const files = Array.isArray(manifest.files) ? manifest.files.map(row => ({ file: normalizeRelative(row.file), sha256: String(row.sha256 || '') })) : [];
  if (!files.length || files.some(row => !row.file || !/^[a-f0-9]{64}$/i.test(row.sha256) || excludedFile(row.file))) throw new Error('Bundled release source manifest is incomplete.');
  files.sort((a,b)=>a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const sourceHash = hash(JSON.stringify(files));
  if (!/^[a-f0-9]{64}$/i.test(String(manifest.sourceHash || '')) || sourceHash !== manifest.sourceHash) throw new Error('Bundled release source manifest hash is invalid.');
  return { files, sourceHash };
}
function verifyBuildWorkspaceAgainstManifest(root, authoritative) {
  const changes=[];
  for (const row of authoritative) {
    const absolute=path.join(root,row.file);
    const current=fs.existsSync(absolute)?hash(sourceBytes(row.file,fs.readFileSync(absolute))):null;
    if (current!==row.sha256) changes.push({file:row.file,reason:current?'modified':'absent',buildInput:isBuildInput(row.file)});
  }
  const blocked=changes.filter(row=>row.buildInput);
  if(blocked.length) throw new Error('Build source differs from release source: '+blocked.map(row=>row.file+' ('+row.reason+')').join(', '));
  const expected=new Set(authoritative.map(row=>row.file));
  const unexpected=sourceFiles(root).filter(file=>isBuildInput(file)&&!expected.has(file));
  if(unexpected.length) throw new Error('Unmanifested build inputs: '+unexpected.join(', '));
  return changes;
}

function captureBuildSourceIdentity(root = process.cwd()) {
  if (!process.env.VERCEL) return captureSourceIdentity(root);
  // Vercel Git deployments are bound to VERCEL_GIT_COMMIT_SHA/REF. Do not make
  // the temporary platform build workspace a second source of truth. Vercel can
  // filter or transform its workspace independently of the Git commit, and a
  // byte-for-byte workspace assertion previously blocked otherwise valid builds.
  // The full release gate still verifies the local clean Git tree against this
  // deterministic manifest and then requires the immutable deployment commit,
  // branch and manifest hash to match before certification.
  const bundled = readBundledSourceManifest(root);
  const authoritative = bundled?.files;
  if (!authoritative) throw new Error('Vercel build requires the bundled release source manifest.');
  const strictWorkspace = String(process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE || '').trim() === '1';
  const changes = strictWorkspace ? verifyBuildWorkspaceAgainstManifest(root, authoritative) : [];
  const git=gitIdentity(root);
  return {schemaVersion:5,version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,
    sourceHash:bundled.sourceHash,files:authoritative,...git,buildSourceChanges:changes,sourceEvidence:'bundled-manifest',
    workspaceVerification:strictWorkspace?'strict-diagnostic':'vercel-git-metadata',
    capturedAt:new Date().toISOString(),previewUrl:process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:process.env.APP_URL||null,intendedProductionUrl:'https://app.86chaos.com'};
}

module.exports = { sourceBytes, committedSourceFiles, readBundledSourceManifest, verifyBuildWorkspaceAgainstManifest, captureBuildSourceIdentity, hash, excludedFile, sourceFiles, gitIdentity, captureSourceIdentity, compareSourceIdentity };

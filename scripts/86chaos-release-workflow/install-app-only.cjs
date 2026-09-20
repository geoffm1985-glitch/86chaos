'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const FORBIDDEN_PARTS = new Set(['.git', '.vercel', '.firebase', 'node_modules', 'build', 'coverage', 'playwright-report', 'test-results', 'release-evidence', '__pycache__', 'dist', '.cache']);
const REQUIRED_PATHS = ['package.json', 'package-lock.json', 'src', 'api', 'scripts', 'test-tools', 'tests', 'release-source-manifest.json', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'];
const TEXT_EXTENSIONS = /\.(?:js|jsx|cjs|mjs|json|css|html|md|txt|ps1|cmd|yml|yaml|rules|py|toml|sh)$/i;

function normalize(value = '') { return String(value).replace(/\\/g, '/').replace(/^\.\//, ''); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sourceBytes(file, bytes) {
  return TEXT_EXTENSIONS.test(file) || ['.gitignore', '.gitattributes', '.npmrc'].includes(path.posix.basename(file))
    ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
    : bytes;
}

function forbiddenSourcePath(relative = '') {
  const file = normalize(relative);
  const parts = file.split('/');
  const base = parts.at(-1) || '';
  return parts.some(part => FORBIDDEN_PARTS.has(part))
    || file === 'public/build-identity.json'
    || base.startsWith('.env')
    || /\.(?:zip|log|pem|p12|pfx|key|pyc)$/i.test(base)
    || /(?:service[-_]?account|credentials|private[-_]?key).*\.json$/i.test(base);
}

function listTree(root, directory = root, rows = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = normalize(path.relative(root, absolute));
    rows.push({ relative, absolute, directory: entry.isDirectory(), file: entry.isFile(), symlink: entry.isSymbolicLink() });
    if (entry.isDirectory()) listTree(root, absolute, rows);
  }
  return rows;
}

function readPackageVersion(root) {
  try { return String(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || ''); }
  catch (_) { throw new Error(`Invalid package.json in application: ${path.join(root, 'package.json')}`); }
}

function readReleaseManifest(root) {
  const manifestPath = path.join(root, 'release-source-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`release-source-manifest.json is missing: ${manifestPath}`);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (_) { throw new Error(`Invalid release-source-manifest.json: ${manifestPath}`); }
  const files = Array.isArray(manifest.files)
    ? manifest.files.map(row => ({ file: normalize(row?.file), sha256: String(row?.sha256 || '').toLowerCase() }))
    : [];
  files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  if (!files.length || files.some(row => !row.file || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error(`Incomplete release-source-manifest.json: ${manifestPath}`);
  const calculated = sha256(Buffer.from(JSON.stringify(files)));
  if (!/^[a-f0-9]{64}$/.test(String(manifest.sourceHash || '').toLowerCase()) || calculated !== String(manifest.sourceHash).toLowerCase()) {
    throw new Error(`release-source-manifest.json sourceHash is invalid: ${manifestPath}`);
  }
  return { sourceHash: calculated, files };
}

function verifyManifestSnapshot(root, manifest = readReleaseManifest(root)) {
  const mismatches = [];
  for (const row of manifest.files) {
    const absolute = path.join(root, row.file);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      mismatches.push({ file: row.file, reason: 'missing' });
      continue;
    }
    const actual = sha256(sourceBytes(row.file, fs.readFileSync(absolute)));
    if (actual !== row.sha256) mismatches.push({ file: row.file, reason: 'modified', expected: row.sha256, actual });
  }
  return { ok: mismatches.length === 0, mismatches, sourceHash: manifest.sourceHash };
}

function validateExtractedApplication(sourceRoot, expectedVersion) {
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) throw new Error(`Extracted application directory does not exist: ${sourceRoot}`);
  const missing = REQUIRED_PATHS.filter(relative => !fs.existsSync(path.join(sourceRoot, relative)));
  if (missing.length) throw new Error(`Extracted ZIP is not a complete 86 Chaos application. Missing: ${missing.join(', ')}`);
  const version = readPackageVersion(sourceRoot);
  if (version !== expectedVersion) throw new Error(`Extracted package.json version is ${version}; expected ${expectedVersion}.`);
  const unsafe = listTree(sourceRoot).filter(row => row.symlink || forbiddenSourcePath(row.relative));
  if (unsafe.length) throw new Error(`Extracted ZIP contains forbidden content: ${unsafe.map(row => row.relative).join(', ')}`);
  const manifest = readReleaseManifest(sourceRoot);
  const forbiddenManifestRows = manifest.files.filter(row => forbiddenSourcePath(row.file) || row.file === 'release-source-manifest.json');
  if (forbiddenManifestRows.length) throw new Error(`release-source-manifest.json contains forbidden source paths: ${forbiddenManifestRows.slice(0, 10).map(row => row.file).join(', ')}`);
  const snapshot = verifyManifestSnapshot(sourceRoot, manifest);
  if (!snapshot.ok) throw new Error(`Extracted ZIP does not match its release manifest: ${snapshot.mismatches.slice(0, 10).map(row => `${row.file} (${row.reason})`).join(', ')}`);
  const manifestedFiles = new Set(manifest.files.map(row => row.file));
  const unmanifested = listTree(sourceRoot).filter(row => row.file && row.relative !== 'release-source-manifest.json' && !manifestedFiles.has(row.relative));
  if (unmanifested.length) throw new Error(`Extracted ZIP contains unmanifested content: ${unmanifested.slice(0, 10).map(row => row.relative).join(', ')}`);
  return { version, files: listTree(sourceRoot).filter(row => row.file).length, sourceHash: manifest.sourceHash };
}

function git(repositoryRoot, args) {
  const result = cp.spawnSync('git', ['--no-pager', ...args], { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    if (result.error) throw new Error(`git ${args.join(' ')} failed: ${result.error.message}`);
    throw new Error(String(result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  }
  return String(result.stdout || '');
}

function expandUntrackedDirectory(repositoryRoot, relativeDirectory) {
  const directory = normalize(relativeDirectory).replace(/\/+$/, '');
  const absoluteRoot = path.join(repositoryRoot, directory);
  if (!directory || !fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) return [{ status: '??', file: directory || normalize(relativeDirectory) }];
  const rows = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = normalize(path.relative(repositoryRoot, absolute));
      if (entry.isSymbolicLink()) rows.push({ status: '??', file: relative });
      else if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) rows.push({ status: '??', file: relative });
    }
  };
  walk(absoluteRoot);
  return rows.length ? rows : [{ status: '??', file: directory }];
}

function repositoryChangeEntries(repositoryRoot) {
  const rows = git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=normal'])
    .split(/\r?\n/).filter(Boolean).map(line => {
      const status = line.slice(0, 2);
      let file = line.length > 3 ? line.slice(3).trim() : line.trim();
      if (file.includes(' -> ')) file = file.split(' -> ').pop().trim();
      return { status, file: normalize(file.replace(/^"|"$/g, '')) };
    });
  const expanded = [];
  for (const row of rows) {
    if (row.status === '??' && row.file.endsWith('/') && !preservedLocalArtifactPath(row.file)) expanded.push(...expandUntrackedDirectory(repositoryRoot, row.file));
    else expanded.push(row);
  }
  return expanded;
}

function preservedLocalArtifactPath(relative = '') {
  const file = normalize(relative);
  const base = path.posix.basename(file);
  const parts = file.split('/');
  return forbiddenSourcePath(file)
    || file === 'public/build-identity.json'
    || parts.includes('__pycache__')
    || /\.pyc$/i.test(base);
}

function ignorableUntrackedRepositoryEntry(row = {}) {
  return String(row.status || '') === '??' && preservedLocalArtifactPath(row.file);
}

function meaningfulRepositoryChangeEntries(repositoryRoot) {
  return repositoryChangeEntries(repositoryRoot).filter(row => !ignorableUntrackedRepositoryEntry(row));
}

function meaningfulRepositoryChanges(repositoryRoot) {
  return meaningfulRepositoryChangeEntries(repositoryRoot).map(row => row.file);
}

function gitShow(repositoryRoot, spec) {
  const result = cp.spawnSync('git', ['--no-pager', 'show', spec], { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || `git show ${spec} failed`).trim());
  return String(result.stdout || '');
}

function committedCandidate(repositoryRoot) {
  let pkg;
  let manifest;
  try { pkg = JSON.parse(gitShow(repositoryRoot, 'HEAD:package.json')); }
  catch (error) { throw new Error(`Git HEAD does not contain a readable package.json: ${error.message}`); }
  try { manifest = JSON.parse(gitShow(repositoryRoot, 'HEAD:release-source-manifest.json')); }
  catch (error) { throw new Error(`Git HEAD does not contain a readable release-source-manifest.json: ${error.message}`); }
  const files = Array.isArray(manifest.files)
    ? manifest.files.map(row => ({ file: normalize(row?.file), sha256: String(row?.sha256 || '').toLowerCase() })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
    : [];
  if (!files.length || files.some(row => !row.file || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error('Git HEAD release-source-manifest.json is incomplete.');
  const calculated = sha256(Buffer.from(JSON.stringify(files)));
  if (calculated !== String(manifest.sourceHash || '').toLowerCase()) throw new Error('Git HEAD release-source-manifest.json sourceHash is invalid.');
  return { version: String(pkg.version || ''), manifest: { sourceHash: calculated, files } };
}

function recoverableIncompleteCheckout(repositoryRoot) {
  const entries = meaningfulRepositoryChangeEntries(repositoryRoot);
  if (!entries.length) return null;
  const committed = committedCandidate(repositoryRoot);
  const allowed = new Set([...committed.manifest.files.map(row => row.file), 'release-source-manifest.json']);
  const unsafe = entries.filter(row => !row.status.includes('D') || !allowed.has(row.file));
  return { ok: unsafe.length === 0, committed, entries, unsafe };
}

function coherentInstalledCandidate(repositoryRoot) {
  const version = readPackageVersion(repositoryRoot);
  const manifest = readReleaseManifest(repositoryRoot);
  const snapshot = verifyManifestSnapshot(repositoryRoot, manifest);
  const changes = meaningfulRepositoryChanges(repositoryRoot);
  const allowed = new Set([...manifest.files.map(row => row.file), 'release-source-manifest.json']);
  const unexpectedChanges = changes.filter(file => !allowed.has(file));
  return { ok: snapshot.ok && unexpectedChanges.length === 0, version, manifest, snapshot, changes, unexpectedChanges };
}

function removeVerifiedStaleSource(repositoryRoot, currentManifest, incomingManifest) {
  if (!currentManifest) return [];
  const incoming = new Set(incomingManifest.files.map(row => row.file));
  const stale = currentManifest.files.map(row => row.file).filter(file => !incoming.has(file));
  for (const file of stale) {
    const absolute = path.join(repositoryRoot, file);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) fs.rmSync(absolute, { force: true });
  }
  return stale;
}

function copyApplicationOverlay(sourceRoot, repositoryRoot, expectedVersion) {
  const sourceValidation = validateExtractedApplication(sourceRoot, expectedVersion);
  const gitDirectory = path.join(repositoryRoot, '.git');
  if (!fs.existsSync(gitDirectory)) throw new Error(`Target is not the expected Git repository; .git is missing: ${repositoryRoot}`);

  const rawChanges = repositoryChangeEntries(repositoryRoot);
  const ignoredLocalArtifacts = rawChanges.filter(ignorableUntrackedRepositoryEntry).map(row => row.file);
  const changes = rawChanges.filter(row => !ignorableUntrackedRepositoryEntry(row)).map(row => row.file);
  let prior = null;
  let recoveredIncompleteCheckout = false;
  if (changes.length) {
    try {
      prior = coherentInstalledCandidate(repositoryRoot);
    } catch (coherentError) {
      let recovery = null;
      try { recovery = recoverableIncompleteCheckout(repositoryRoot); } catch (_) {}
      if (!recovery?.ok) {
        const unsafe = recovery?.unsafe || [];
        const details = unsafe.length
          ? unsafe.slice(0, 10).map(row => `${row.file} (${row.status.trim() || 'changed'})`)
          : [coherentError.message];
        throw new Error(`Refusing to overwrite meaningful pre-existing repository changes:
${details.map(file => ` - ${file}`).join('\n')}`);
      }
      prior = {
        ok: true,
        version: recovery.committed.version,
        manifest: recovery.committed.manifest,
        snapshot: { ok: false, mismatches: recovery.entries.map(row => ({ file: row.file, reason: 'missing-from-working-tree' })) },
        changes: recovery.entries.map(row => row.file),
        unexpectedChanges: [],
      };
      recoveredIncompleteCheckout = true;
    }
    if (!prior.ok) {
      let recovery = null;
      try { recovery = recoverableIncompleteCheckout(repositoryRoot); } catch (_) {}
      if (recovery?.ok) {
        prior = {
          ok: true,
          version: recovery.committed.version,
          manifest: recovery.committed.manifest,
          snapshot: { ok: false, mismatches: recovery.entries.map(row => ({ file: row.file, reason: 'missing-from-working-tree' })) },
          changes: recovery.entries.map(row => row.file),
          unexpectedChanges: [],
        };
        recoveredIncompleteCheckout = true;
      } else {
        const details = [
          ...prior.snapshot.mismatches.slice(0, 10).map(row => `${row.file} (${row.reason})`),
          ...prior.unexpectedChanges.slice(0, 10).map(file => `${file} (unmanifested dirty path)`),
          ...(recovery?.unsafe || []).slice(0, 10).map(row => `${row.file} (${row.status.trim() || 'changed'})`),
        ];
        throw new Error(`Refusing to overwrite meaningful pre-existing repository changes:
${[...new Set(details)].map(file => ` - ${file}`).join('\n')}`);
      }
    }
  } else if (fs.existsSync(path.join(repositoryRoot, 'release-source-manifest.json')) && fs.existsSync(path.join(repositoryRoot, 'package.json'))) {
    try {
      const candidate = coherentInstalledCandidate(repositoryRoot);
      if (candidate.snapshot.ok) prior = candidate;
    } catch (_) {}
  }

  const incomingManifest = readReleaseManifest(sourceRoot);
  const gitHeadPath = path.join(gitDirectory, 'HEAD');
  const gitHeadBefore = fs.readFileSync(gitHeadPath);
  const removedFiles = removeVerifiedStaleSource(repositoryRoot, prior?.manifest || null, incomingManifest);

  for (const row of listTree(sourceRoot)) {
    const destination = path.join(repositoryRoot, row.relative);
    if (row.directory) fs.mkdirSync(destination, { recursive: true });
    else if (row.file) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(row.absolute, destination);
    }
  }

  if (!fs.existsSync(gitDirectory) || !fs.readFileSync(gitHeadPath).equals(gitHeadBefore)) throw new Error('Git metadata changed during application overlay; stop and inspect the repository.');
  if (readPackageVersion(repositoryRoot) !== expectedVersion) throw new Error(`Repository version does not match ${expectedVersion} after overlay.`);
  const finalSnapshot = verifyManifestSnapshot(repositoryRoot, incomingManifest);
  if (!finalSnapshot.ok) throw new Error(`Repository does not match the incoming release manifest after overlay: ${finalSnapshot.mismatches.slice(0, 10).map(row => `${row.file} (${row.reason})`).join(', ')}`);

  return {
    version: expectedVersion,
    copiedFiles: listTree(sourceRoot).filter(row => row.file).length,
    removedFiles,
    gitPreserved: true,
    resumedVerifiedCandidate: Boolean(changes.length && prior?.ok),
    recoveredIncompleteCheckout,
    ignoredLocalArtifacts,
    sourceHash: sourceValidation.sourceHash,
  };
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) if (argv[index].startsWith('--')) values[argv[index].slice(2)] = argv[index + 1], index += 1;
  return values;
}

if (require.main === module) {
  try {
    const args = parseArguments(process.argv.slice(2));
    if (!args.source || !args.repository || !args['expected-version']) throw new Error('Usage: node install-app-only.cjs --source <directory> --repository <directory> --expected-version <version>');
    const result = copyApplicationOverlay(path.resolve(args.source), path.resolve(args.repository), args['expected-version']);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  REQUIRED_PATHS,
  forbiddenSourcePath,
  preservedLocalArtifactPath,
  ignorableUntrackedRepositoryEntry,
  repositoryChangeEntries,
  meaningfulRepositoryChangeEntries,
  listTree,
  readPackageVersion,
  readReleaseManifest,
  verifyManifestSnapshot,
  validateExtractedApplication,
  meaningfulRepositoryChanges,
  committedCandidate,
  recoverableIncompleteCheckout,
  coherentInstalledCandidate,
  copyApplicationOverlay,
};

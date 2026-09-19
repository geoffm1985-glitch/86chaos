'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const FORBIDDEN_PARTS = new Set(['.git', '.vercel', '.firebase', 'node_modules', 'build', 'coverage', 'playwright-report', 'test-results', 'release-evidence']);
const REQUIRED_PATHS = ['package.json', 'package-lock.json', 'src', 'api', 'scripts', 'test-tools', 'tests', 'release-source-manifest.json', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'];

function normalize(value = '') { return String(value).replace(/\\/g, '/').replace(/^\.\//, ''); }

function forbiddenSourcePath(relative = '') {
  const file = normalize(relative);
  const parts = file.split('/');
  const base = parts.at(-1) || '';
  return parts.some(part => FORBIDDEN_PARTS.has(part))
    || base.startsWith('.env')
    || /\.(?:zip|log|pem|p12|pfx|key)$/i.test(base)
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
  catch (_) { throw new Error(`Invalid package.json in extracted application: ${path.join(root, 'package.json')}`); }
}

function validateExtractedApplication(sourceRoot, expectedVersion) {
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) throw new Error(`Extracted application directory does not exist: ${sourceRoot}`);
  const missing = REQUIRED_PATHS.filter(relative => !fs.existsSync(path.join(sourceRoot, relative)));
  if (missing.length) throw new Error(`Extracted ZIP is not a complete 86 Chaos application. Missing: ${missing.join(', ')}`);
  const version = readPackageVersion(sourceRoot);
  if (version !== expectedVersion) throw new Error(`Extracted package.json version is ${version}; expected ${expectedVersion}.`);
  const unsafe = listTree(sourceRoot).filter(row => row.symlink || forbiddenSourcePath(row.relative));
  if (unsafe.length) throw new Error(`Extracted ZIP contains forbidden content: ${unsafe.map(row => row.relative).join(', ')}`);
  return { version, files: listTree(sourceRoot).filter(row => row.file).length };
}

function git(repositoryRoot, args) {
  const result = cp.spawnSync('git', ['--no-pager', ...args], { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  return String(result.stdout || '');
}

function meaningfulRepositoryChanges(repositoryRoot) {
  return git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/).filter(Boolean).map(line => line.length > 3 ? line.slice(3).trim() : line.trim());
}

function copyApplicationOverlay(sourceRoot, repositoryRoot, expectedVersion) {
  validateExtractedApplication(sourceRoot, expectedVersion);
  const gitDirectory = path.join(repositoryRoot, '.git');
  if (!fs.existsSync(gitDirectory)) throw new Error(`Target is not the expected Git repository; .git is missing: ${repositoryRoot}`);
  const changes = meaningfulRepositoryChanges(repositoryRoot);
  if (changes.length) throw new Error(`Refusing to overwrite meaningful pre-existing repository changes:\n${changes.map(file => ` - ${file}`).join('\n')}`);
  const gitHeadPath = path.join(gitDirectory, 'HEAD');
  const gitHeadBefore = fs.readFileSync(gitHeadPath);
  for (const row of listTree(sourceRoot)) {
    const destination = path.join(repositoryRoot, row.relative);
    if (row.directory) fs.mkdirSync(destination, { recursive: true });
    else if (row.file) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(row.absolute, destination);
    }
  }
  if (!fs.existsSync(gitDirectory) || !fs.readFileSync(gitHeadPath).equals(gitHeadBefore)) throw new Error('Git metadata changed during application overlay; stop and inspect the repository.');
  return { version: expectedVersion, copiedFiles: listTree(sourceRoot).filter(row => row.file).length, gitPreserved: true };
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

module.exports = { REQUIRED_PATHS, forbiddenSourcePath, listTree, readPackageVersion, validateExtractedApplication, meaningfulRepositoryChanges, copyApplicationOverlay };

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { ensureRunDir, writeJson, readJsonIfExists } = require('./run-context.cjs');

const REQUIRED_MODULES = [
  '@playwright/test',
  '@babel/parser',
  '@babel/traverse',
  'vite',
  '@vitejs/plugin-react',
  'jest',
  'eslint',
];

function npmVersion(cwd) {
  try {
    const out = cp.execFileSync('npm', ['--version'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return String(out || '').trim();
  } catch (error) {
    return '';
  }
}

function packageRootFromNodeModulesPath(entryPath, name) {
  const normalized = String(entryPath || '');
  const parts = normalized.split(/[\\/]+/);
  const marker = 'node_modules';
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index] !== marker) continue;
    const first = parts[index + 1];
    if (!first) continue;
    const candidateParts = first.startsWith('@') ? parts.slice(index + 1, index + 3) : parts.slice(index + 1, index + 2);
    if (candidateParts.join('/') === name) return parts.slice(0, index + 1 + candidateParts.length).join(path.sep);
  }
  return '';
}

function packageRootFromLocalNodeModules(root, name) {
  const parts = String(name || '').split('/').filter(Boolean);
  if (!parts.length) return '';
  if (name.startsWith('@') && parts.length >= 2) return path.join(root, 'node_modules', parts[0], parts[1]);
  return path.join(root, 'node_modules', parts[0]);
}

function findPhysicalPackageJson(root, name, entryPath = '') {
  const candidates = [];
  const entryRoot = packageRootFromNodeModulesPath(entryPath, name);
  if (entryRoot) candidates.push(entryRoot);
  candidates.push(packageRootFromLocalNodeModules(root, name));
  for (const candidate of candidates) {
    if (!candidate) continue;
    const pkgPath = path.join(candidate, 'package.json');
    if (fs.existsSync(pkgPath)) return pkgPath;
  }
  return '';
}

function resolvePackage(root, name) {
  let entryPath = '';
  let entryError = null;
  try {
    entryPath = require.resolve(name, { paths: [root] });
  } catch (error) {
    entryError = error;
  }

  if (!entryPath) {
    const localPackageDir = packageRootFromLocalNodeModules(root, name);
    const localPackageJson = path.join(localPackageDir, 'package.json');
    if (!fs.existsSync(localPackageDir) && !fs.existsSync(localPackageJson)) {
      return {
        name,
        ok: false,
        version: '',
        entryPath: '',
        packagePath: '',
        resolutionMethod: 'missing',
        errorCode: entryError?.code || 'MODULE_NOT_FOUND',
        error: entryError?.message || `Cannot resolve ${name} from ${root}`,
        classification: 'missing',
      };
    }
    if (!fs.existsSync(localPackageJson)) {
      return {
        name,
        ok: false,
        version: '',
        entryPath: '',
        packagePath: '',
        resolutionMethod: 'local-package-dir',
        errorCode: entryError?.code || 'MODULE_NOT_FOUND',
        error: `Local package directory exists but package.json was not found: ${localPackageJson}`,
        classification: 'metadata-missing',
      };
    }
  }

  let packageJsonExportErrorCode = '';
  try { require.resolve(`${name}/package.json`, { paths: [root] }); } catch (error) { packageJsonExportErrorCode = error?.code || ''; }
  const packagePath = findPhysicalPackageJson(root, name, entryPath);
  const pkg = packagePath ? readJsonIfExists(packagePath) : null;
  const metadataError = packagePath && !pkg ? `Package metadata could not be parsed: ${packagePath}` : '';
  return {
    name,
    ok: Boolean(entryPath),
    version: String(pkg?.version || ''),
    entryPath,
    packagePath,
    resolutionMethod: entryPath ? 'package-entry' : 'local-package-dir',
    errorCode: entryError?.code || '',
    packageJsonExportErrorCode,
    error: metadataError,
    classification: entryPath ? (pkg ? 'installed' : 'metadata-unreadable') : 'metadata-only-no-entry',
  };
}

function localPlaywrightExecutable(root, platform = process.platform) {
  const cmdPath = path.join(root, 'node_modules', '.bin', 'playwright.cmd');
  const unixPath = path.join(root, 'node_modules', '.bin', 'playwright');
  const requiredPath = platform === 'win32' ? cmdPath : unixPath;
  return {
    path: requiredPath,
    exists: fs.existsSync(requiredPath),
    windowsCmdPath: cmdPath,
    windowsCmdExists: fs.existsSync(cmdPath),
    unixPath,
    unixExists: fs.existsSync(unixPath),
  };
}

function buildDependencyPreflight({ root = process.cwd(), runId = process.env.CHAOS_RELEASE_GATE_RUN_ID || '', runDir = '' } = {}) {
  const packageLockPath = path.join(root, 'package-lock.json');
  const packageLock = readJsonIfExists(packageLockPath);
  const modules = REQUIRED_MODULES.map(name => resolvePackage(root, name));
  const playwrightExecutable = localPlaywrightExecutable(root);
  const errors = [];
  if (!packageLock) errors.push('package-lock.json is missing or could not be parsed. The release gate requires npm ci from the committed lockfile.');
  for (const mod of modules) {
    if (!mod.ok) errors.push(`Required local test module is missing: ${mod.name}. Run npm ci --include=dev --no-audit --no-fund from the app root. Resolution error: ${mod.errorCode || 'unknown'}${mod.error ? ` - ${mod.error}` : ''}`);
    else if (!mod.version) errors.push(`Required local test module is installed but metadata could not be read: ${mod.name}. Entry: ${mod.entryPath || 'unknown'}.`);
  }
  if (!playwrightExecutable.exists) errors.push(`Local Playwright executable is missing: ${playwrightExecutable.path}. The release gate will not use npx package downloads.`);
  return {
    runId,
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    npmVersion: npmVersion(root),
    packageLockPresent: Boolean(packageLock),
    packageLockVersion: packageLock ? packageLock.lockfileVersion || null : null,
    requiredModules: modules,
    localPlaywrightExecutablePath: playwrightExecutable.path,
    localPlaywrightExecutableExists: playwrightExecutable.exists,
    errors,
    ok: errors.length === 0,
  };
}

function writeDependencyPreflight() {
  const { root, runId, runDir } = ensureRunDir();
  const report = buildDependencyPreflight({ root, runId, runDir });
  const out = path.join(runDir, 'dependency-preflight.json');
  writeJson(out, report);
  return { report, out };
}

if (require.main === module) {
  const { report, out } = writeDependencyPreflight();
  console.log(JSON.stringify({
    ok: report.ok,
    output: out,
    nodeVersion: report.nodeVersion,
    npmVersion: report.npmVersion,
    modules: report.requiredModules.map(m => ({
      name: m.name,
      ok: m.ok,
      version: m.version,
      entryPath: m.entryPath,
      packagePath: m.packagePath,
      resolutionMethod: m.resolutionMethod,
      errorCode: m.errorCode,
      packageJsonExportErrorCode: m.packageJsonExportErrorCode,
      classification: m.classification,
    })),
    localPlaywrightExecutablePath: report.localPlaywrightExecutablePath,
    errors: report.errors,
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  REQUIRED_MODULES,
  buildDependencyPreflight,
  writeDependencyPreflight,
  localPlaywrightExecutable,
  resolvePackage,
  findPhysicalPackageJson,
  packageRootFromNodeModulesPath,
};

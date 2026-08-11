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

function resolvePackage(root, name) {
  try {
    const pkgPath = require.resolve(`${name}/package.json`, { paths: [root] });
    const pkg = readJsonIfExists(pkgPath) || {};
    return { name, ok: true, packagePath: pkgPath, version: String(pkg.version || '') };
  } catch (error) {
    return { name, ok: false, packagePath: '', version: '', error: error.message };
  }
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
    if (!mod.ok) errors.push(`Required local test module is missing: ${mod.name}. Run npm ci --include=dev --no-audit --no-fund from the app root.`);
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
  console.log(JSON.stringify({ ok: report.ok, output: out, nodeVersion: report.nodeVersion, npmVersion: report.npmVersion, modules: report.requiredModules.map(m => ({ name: m.name, ok: m.ok, version: m.version })), localPlaywrightExecutablePath: report.localPlaywrightExecutablePath, errors: report.errors }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

module.exports = {
  REQUIRED_MODULES,
  buildDependencyPreflight,
  writeDependencyPreflight,
  localPlaywrightExecutable,
};

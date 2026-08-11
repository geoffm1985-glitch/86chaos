const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  REQUIRED_MODULES,
  buildDependencyPreflight,
  resolvePackage,
} = require('../scripts/86chaos-release-gate/dependency-preflight.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function createPackage(root, name, version, { exportsPackageJson = true } = {}) {
  const parts = name.startsWith('@') ? name.split('/') : [name];
  const packageRoot = path.join(root, 'node_modules', ...parts);
  fs.mkdirSync(path.join(packageRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, 'dist', 'index.js'), 'module.exports = {};\n');
  const pkg = {
    name,
    version,
    main: './dist/index.js',
    exports: exportsPackageJson ? {
      '.': './dist/index.js',
      './package.json': './package.json',
    } : {
      '.': './dist/index.js',
    },
  };
  writeJson(path.join(packageRoot, 'package.json'), pkg);
  return packageRoot;
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-preflight-'));
  writeJson(path.join(root, 'package-lock.json'), { name: '86chaos', lockfileVersion: 3, packages: { '': { name: '86chaos' } } });
  for (const name of REQUIRED_MODULES) {
    createPackage(root, name, name === '@vitejs/plugin-react' ? '6.0.4' : '1.0.0', {
      exportsPackageJson: name !== '@vitejs/plugin-react',
    });
  }
  fs.mkdirSync(path.join(root, 'node_modules', '.bin'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', '.bin', 'playwright'), '#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(root, 'node_modules', '.bin', 'playwright.cmd'), '@echo off\r\n');
  return root;
}

test('@vitejs/plugin-react 6.0.4 is recognized when package.json subpath is not exported', () => {
  const root = createFixture();
  assert.throws(() => require.resolve('@vitejs/plugin-react/package.json', { paths: [root] }), /Package subpath|ERR_PACKAGE_PATH_NOT_EXPORTED/);
  const result = resolvePackage(root, '@vitejs/plugin-react');
  assert.equal(result.ok, true);
  assert.equal(result.version, '6.0.4');
  assert.match(result.entryPath, /node_modules[/\\]@vitejs[/\\]plugin-react[/\\]dist[/\\]index\.js$/);
  assert.match(result.packagePath, /node_modules[/\\]@vitejs[/\\]plugin-react[/\\]package\.json$/);
  assert.equal(result.resolutionMethod, 'package-entry');
  assert.equal(result.classification, 'installed');
});

test('ordinary and scoped packages report entry and metadata without package-json export assumptions', () => {
  const root = createFixture();
  const ordinary = resolvePackage(root, 'vite');
  assert.equal(ordinary.ok, true);
  assert.equal(ordinary.version, '1.0.0');
  assert.match(ordinary.entryPath, /node_modules[/\\]vite[/\\]dist[/\\]index\.js$/);
  const scoped = resolvePackage(root, '@babel/parser');
  assert.equal(scoped.ok, true);
  assert.equal(scoped.version, '1.0.0');
  assert.match(scoped.packagePath, /node_modules[/\\]@babel[/\\]parser[/\\]package\.json$/);
});

test('genuinely missing packages are still classified as blockers', () => {
  const root = createFixture();
  const missing = resolvePackage(root, '@not-real/missing-package');
  assert.equal(missing.ok, false);
  assert.equal(missing.classification, 'missing');
  assert.match(missing.errorCode, /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/);
});

test('dependency preflight passes the full locked local dependency tree fixture', () => {
  const root = createFixture();
  const report = buildDependencyPreflight({ root, runId: 'unit-preflight' });
  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
  const viteReact = report.requiredModules.find(row => row.name === '@vitejs/plugin-react');
  assert.equal(viteReact.ok, true);
  assert.equal(viteReact.version, '6.0.4');
  assert.equal(viteReact.resolutionMethod, 'package-entry');
  assert.equal(report.localPlaywrightExecutableExists, true);
});

test('full-mode blocked report guidance remains full-mode, not delta', () => {
  const collector = fs.readFileSync(path.join(__dirname, '../scripts/86chaos-release-gate/collect-release-gate-report.cjs'), 'utf8');
  assert.match(collector, /function releaseGateRerunCommandForMode/);
  assert.match(collector, /return 'npm run test:play-store';/);
  assert.doesNotMatch(collector, /failed-only' \? 'npm run test:play-store:failed' : 'npm run test:play-store:delta'/);
});

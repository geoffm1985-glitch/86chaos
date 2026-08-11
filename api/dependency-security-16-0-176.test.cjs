'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_FULL_TEST_SUITE.ps1'), 'utf8');

test('dependency security gate remains real and package metadata stays internally consistent', () => {
  assert.equal(pkg.scripts['test:source'], `node scripts/validate-${pkg.version.replace(/\./g, '-')}.js`);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.match(runner, /npm audit --audit-level=high/);
  assert.doesNotMatch(JSON.stringify(pkg), /npm audit fix --force/);
  assert.equal(pkg.dependencies.firebase, '11.10.0');
  assert.equal(pkg.dependencies['firebase-admin'], '13.10.0');
  assert.equal(pkg.devDependencies['firebase-tools'], '15.24.0');
  assert.equal(pkg.devDependencies['@firebase/rules-unit-testing'], '4.0.1');
  assert.equal(lock.packages['node_modules/@firebase/rules-unit-testing']?.version, '4.0.1');
  assert.equal(lock.packages['node_modules/@firebase/rules-unit-testing']?.peerDependencies?.firebase, '^11.0.0');
});

test('CRA/react-scripts direct dependency is removed and Vite build tooling is pinned', () => {
  assert.equal(pkg.dependencies['react-scripts'], undefined);
  assert.equal(pkg.dependencies.vite, '8.1.5');
  assert.equal(pkg.dependencies['@vitejs/plugin-react'], '6.0.4');
  assert.equal(pkg.scripts.start, 'vite --host 0.0.0.0');
  assert.equal(pkg.scripts.build, 'node scripts/vite-build-with-asset-manifest.cjs');
  assert.equal(pkg.scripts['test:client'], 'jest --watchAll=false');
  assert.ok(lock.packages['node_modules/vite'], 'vite is represented in package-lock packages');
  assert.ok(lock.packages['node_modules/@vitejs/plugin-react'], '@vitejs/plugin-react is represented in package-lock packages');
  assert.ok(lock.packages['node_modules/jest'], 'direct Jest test runner is represented in package-lock packages');
  assert.equal(lock.packages['node_modules/react-scripts'], undefined, 'stale react-scripts lock entry is absent');
  assert.equal(lock.packages['node_modules/svgo/node_modules/nth-check'], undefined, 'stale vulnerable CRA nth-check chain is absent');
  assert.equal(lock.packages['node_modules/resolve-url-loader/node_modules/postcss'], undefined, 'stale vulnerable CRA PostCSS chain is absent');
  assert.equal(lock.packages['node_modules/rollup-plugin-terser/node_modules/serialize-javascript'], undefined, 'stale vulnerable CRA serialize-javascript chain is absent');
});

test('Vite migration preserves build output, browser env allowlist, and asset manifest generation', () => {
  assert.ok(fs.existsSync(path.join(root, 'vite.config.js')));
  assert.ok(fs.existsSync(path.join(root, 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/generate-vite-asset-manifest.cjs')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/vite-build-with-asset-manifest.cjs')));
  const viteConfig = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
  assert.match(viteConfig, /outDir:\s*'build'/);
  assert.match(viteConfig, /browserEnvKeys/);
  assert.match(viteConfig, /REACT_APP_FIREBASE_PROJECT_ID/);
  assert.doesNotMatch(viteConfig, /JSON\.stringify\(process\.env\)/);
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(index, /<div id="root"><\/div>/);
  assert.match(index, /type="module" src="\/src\/index\.js"/);
  assert.doesNotMatch(index, /%PUBLIC_URL%/);
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(vercel.framework, 'vite');
  assert.equal(vercel.outputDirectory, 'build');
});

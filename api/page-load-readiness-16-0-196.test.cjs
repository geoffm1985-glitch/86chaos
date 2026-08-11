'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('accessibility release spec does not require optional axe modules during Playwright list discovery', () => {
  const source = read('tests/86chaos-release-gate/16-accessibility-release-gate.spec.cjs');
  assert.match(source, /function loadAxeRuntime\(/, 'axe runtime is loaded lazily');
  assert.doesNotMatch(source, /let AxeBuilder = null;\s*let axeCore = null;\s*try \{ AxeBuilder = require\('@axe-core\/playwright'\)/s, 'no top-level axe require can break playwright --list');
  assert.match(source, /test\.skip\(!axeDependencyAvailable\(\)/, 'axe-only route scan skips honestly if local axe dependency is absent');
});

test('Jest setup provides fetch-compatible globals before Firebase Auth modules load', () => {
  const source = read('src/setupTests.js');
  assert.match(source, /function installFetchShim\(/, 'fetch shim helper exists');
  assert.match(source, /require\('undici'\)/, 'uses local undici implementation when Jest jsdom lacks fetch');
  assert.match(source, /globalThis\.fetch\s*=/, 'defines global fetch for Firebase Auth import-time checks');
  assert.match(source, /installFetchShim\(\);[\s\S]*jest\.mock\('firebase\/messaging'/, 'fetch shim is installed before Firebase mocks and test imports execute');
});

test('production Vite build runner does not depend on fragile node_modules .bin shims', () => {
  const source = read('scripts/vite-build-with-asset-manifest.cjs');
  assert.match(source, /function resolveViteCli\(/, 'Vite CLI resolver exists');
  assert.match(source, /require\.resolve\('vite\/bin\/vite\.js'/, 'resolver targets Vite package CLI entrypoint');
  assert.match(source, /spawnSync\(process\.execPath, \[\s*viteCli,/s, 'Vite is launched through Node and the resolved CLI');
  assert.doesNotMatch(source, /node_modules['"], ['"]\.bin['"], ['"]vite\.cmd/, 'Windows vite.cmd shim is not the build launch dependency');
  assert.match(source, /Failed to launch Vite CLI/, 'spawn errors are reported instead of producing blank build failures');
});

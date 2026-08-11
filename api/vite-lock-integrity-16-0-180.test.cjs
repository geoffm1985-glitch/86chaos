'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = lock.packages || {};

const lightningPlatforms = [
  'lightningcss-android-arm64', 'lightningcss-darwin-arm64', 'lightningcss-darwin-x64',
  'lightningcss-freebsd-x64', 'lightningcss-linux-arm-gnueabihf', 'lightningcss-linux-arm64-gnu',
  'lightningcss-linux-arm64-musl', 'lightningcss-linux-x64-gnu', 'lightningcss-linux-x64-musl',
  'lightningcss-win32-arm64-msvc', 'lightningcss-win32-x64-msvc'
];
const rolldownPlatforms = [
  '@rolldown/binding-android-arm64', '@rolldown/binding-darwin-arm64', '@rolldown/binding-darwin-x64',
  '@rolldown/binding-freebsd-x64', '@rolldown/binding-linux-arm-gnueabihf', '@rolldown/binding-linux-arm64-gnu',
  '@rolldown/binding-linux-arm64-musl', '@rolldown/binding-linux-ppc64-gnu', '@rolldown/binding-linux-s390x-gnu',
  '@rolldown/binding-linux-x64-gnu', '@rolldown/binding-linux-x64-musl', '@rolldown/binding-openharmony-arm64',
  '@rolldown/binding-win32-arm64-msvc', '@rolldown/binding-win32-x64-msvc'
];

test('Vite production dependency closure is fully represented for clean npm ci installs', () => {
  assert.match(pkg.version, /^16\.0\.\d+$/, 'current app version remains in the 16.0.x release line');
  assert.equal(pkg.dependencies.vite, '8.1.5');
  assert.equal(pkg.scripts['vercel:install'], 'npm ci --omit=dev --no-audit --no-fund --progress=false');
  assert.ok(!pkg.scripts['vercel:install'].includes('--omit=optional'), 'Vercel must install optional Vite/Rolldown native bindings');
  assert.equal(packages['node_modules/vite']?.version, '8.1.5');
  assert.equal(packages['node_modules/lightningcss']?.version, '1.33.0');
  assert.equal(packages['node_modules/detect-libc']?.version, '2.1.2');
  assert.equal(packages['node_modules/rolldown']?.version, '1.2.3');
  assert.equal(packages['node_modules/@oxc-project/types']?.version, '0.143.0');
  assert.equal(packages['node_modules/@rolldown/pluginutils']?.version, '1.0.1');
  assert.equal(packages['node_modules/postcss']?.version, '8.5.26');
  assert.equal(packages['node_modules/vite/node_modules/picomatch']?.version, '4.0.5');
  assert.ok(packages['node_modules/tinyglobby'], 'tinyglobby remains locked');
  for (const name of lightningPlatforms) {
    const row = packages[`node_modules/${name}`];
    assert.equal(row?.version, '1.33.0', `${name} is locked at 1.33.0`);
    assert.equal(row?.optional, true, `${name} remains optional`);
  }
  for (const name of rolldownPlatforms) {
    const row = packages[`node_modules/${name}`];
    assert.equal(row?.version, '1.2.3', `${name} is locked at 1.2.3`);
    assert.equal(row?.optional, true, `${name} remains optional`);
  }
});

test('Vite build-time dependencies are production reachable and the stale CRA security chains stay absent', () => {
  for (const name of ['lightningcss', 'detect-libc', 'rolldown', '@oxc-project/types', '@rolldown/pluginutils', 'postcss']) {
    assert.notEqual(packages[`node_modules/${name}`]?.dev, true, `${name} must not be dev-only because Vercel omits dev dependencies`);
  }
  assert.equal(packages['node_modules/react-scripts'], undefined);
  assert.equal(packages['node_modules/svgo/node_modules/nth-check'], undefined);
  assert.equal(packages['node_modules/resolve-url-loader/node_modules/postcss'], undefined);
  assert.equal(packages['node_modules/rollup-plugin-terser/node_modules/serialize-javascript'], undefined);
});

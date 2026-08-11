'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const packages = lock.packages || {};
const expectedInstall = 'npm ci --omit=dev --no-audit --no-fund --progress=false';

test('Vercel clean install preserves optional native dependencies required by Vite 8 / Rolldown', () => {
  assert.equal(pkg.version, '16.0.181');
  assert.equal(pkg.scripts['vercel:install'], expectedInstall);
  assert.equal(vercel.installCommand, expectedInstall);
  assert.ok(!expectedInstall.includes('--omit=optional'));
  assert.equal(pkg.dependencies.vite, '8.1.5');
  assert.equal(packages['node_modules/rolldown']?.version, '1.2.3');
  assert.equal(packages['node_modules/@rolldown/binding-linux-x64-gnu']?.version, '1.2.3');
  assert.equal(packages['node_modules/@rolldown/binding-linux-x64-gnu']?.optional, true);
  assert.notEqual(packages['node_modules/@rolldown/binding-linux-x64-gnu']?.dev, true, 'Linux Rolldown binding must remain production reachable');
});

test('Vercel remains deterministic and still omits dev dependencies', () => {
  assert.ok(expectedInstall.startsWith('npm ci '));
  assert.ok(expectedInstall.includes('--omit=dev'));
  assert.ok(expectedInstall.includes('--no-audit'));
  assert.ok(expectedInstall.includes('--no-fund'));
  assert.equal(vercel.framework, 'vite');
  assert.equal(vercel.outputDirectory, 'build');
});

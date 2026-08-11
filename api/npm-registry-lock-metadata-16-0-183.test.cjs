'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = lock.packages || {};

const expectedRegistryRecords = {
  'node_modules/undici': {
    version: '6.28.0',
    resolved: 'https://registry.npmjs.org/undici/-/undici-6.28.0.tgz',
    integrity: 'sha512-LIY910g9TI13YS95lrMFrs8Rm/u/irgHeTWoKCoteeJ04CUJ92eEfj0rVn+7VKMPBpUPiUoBKfhNyLI23EE/KA=='
  },
  'node_modules/vite': {
    version: '8.1.5',
    resolved: 'https://registry.npmjs.org/vite/-/vite-8.1.5.tgz',
    integrity: 'sha1-zP/OPuSHsYhiI7JOuye5FnSCfTA='
  },
  'node_modules/@vitejs/plugin-react': {
    version: '6.0.4',
    resolved: 'https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-6.0.4.tgz',
    integrity: 'sha512-XcCQz0TBpBgljhj0gMuuDj49i6Ytqh5q1osT/Gp5uAVJUCTWxyskk/l1jwYYiu2xcNHHipdMz40EGfM1VdamVg=='
  },
  'node_modules/@firebase/rules-unit-testing': {
    version: '4.0.1',
    resolved: 'https://registry.npmjs.org/@firebase/rules-unit-testing/-/rules-unit-testing-4.0.1.tgz',
    integrity: 'sha512-Vu8iMLP+dO9hCAqUCitWZQdORyM6CxucilRZtleeTZd5bejZmyOiaBPwYm3NOYG6025ac99CEeA+ETmJRxa9zg=='
  }
};

test('manually repaired registry records use published package versions with authoritative integrity metadata', () => {
  for (const [key, expected] of Object.entries(expectedRegistryRecords)) {
    const row = packages[key];
    assert.ok(row, `${key} exists in package-lock`);
    assert.equal(row.version, expected.version, `${key} version`);
    assert.equal(row.resolved, expected.resolved, `${key} tarball URL`);
    assert.equal(row.integrity, expected.integrity, `${key} integrity`);
  }
  assert.equal(packages['node_modules/firebase-tools']?.dependencies?.undici, '^6.19.0');
  assert.doesNotMatch(JSON.stringify(lock), /undici-6\.27\.1\.tgz|"version":\s*"6\.27\.1"/);
});

test('every npm registry tarball record in the lock carries integrity metadata', () => {
  const missing = [];
  for (const [key, row] of Object.entries(packages)) {
    if (!key || !row || typeof row !== 'object') continue;
    if (String(row.resolved || '').startsWith('https://registry.npmjs.org/') && !row.integrity) missing.push(key);
  }
  assert.deepEqual(missing, []);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  const rows = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) rows.push(...walk(rel));
    else if (/\.(?:js|cjs|mjs|ts|tsx)$/.test(entry.name)) rows.push(rel);
  }
  return rows;
}

test('17.0.36 uses Firebase Admin 14.5 with no legacy namespace imports', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.dependencies['firebase-admin'], '14.5.0');
  assert.equal(lock.packages['node_modules/firebase-admin'].version, '14.5.0');
  const offenders = [...walk('api'), ...walk('scripts'), ...walk('test-tools'), ...walk('functions')]
    .filter(file => file !== 'api/firebase-admin-url-api-17-0-36.test.cjs')
    .filter(file => /require\(['"]firebase-admin['"]\)|from\s+['"]firebase-admin['"]/.test(read(file)));
  assert.deepEqual(offenders, [], 'server/test code must use modular Firebase Admin entry points or the internal compatibility facade');
});

test('17.0.36 compatibility facade preserves legacy service access on modular Admin SDK', () => {
  const source = read('api/_firebase-admin-compat.js');
  for (const entry of ['firebase-admin/app', 'firebase-admin/auth', 'firebase-admin/firestore', 'firebase-admin/app-check', 'firebase-admin/messaging', 'firebase-admin/storage', 'firebase-admin/database']) {
    assert.ok(source.includes(entry), `compat facade imports ${entry}`);
  }
  assert.ok(!/require\(['"]firebase-admin['"]\)/.test(source));
  const admin = require('./_firebase-admin-compat.js');
  assert.equal(typeof admin.initializeApp, 'function');
  assert.equal(typeof admin.auth, 'function');
  assert.equal(typeof admin.firestore, 'function');
  assert.equal(typeof admin.appCheck, 'function');
  assert.equal(typeof admin.firestore.FieldValue.serverTimestamp, 'function');
  assert.equal(typeof admin.firestore.Timestamp.now, 'function');
  assert.ok(Array.isArray(admin.apps));
});

test('installed Firebase Admin request and URL validators do not use url.parse', () => {
  const files = [
    'node_modules/firebase-admin/lib/utils/api-request.js',
    'node_modules/firebase-admin/lib/utils/validator.js'
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist after npm ci`);
    const source = read(file);
    assert.ok(!/\burl\.parse\s*\(/.test(source), `${file} must not call legacy url.parse()`);
    assert.ok(!/\burl\.resolve\s*\(/.test(source), `${file} must not call legacy url.resolve()`);
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { publicPathFromUrl } = require('../scripts/86chaos-release-gate/icon-source-validator.cjs');

function assertPublicPathEqual(actual, parts, message) {
  assert.strictEqual(path.normalize(actual), path.normalize(path.join(...parts)), message);
}

function toBrowserAssetUrl(src = '') {
  const cleaned = String(src || '')
    .split('#')[0]
    .split('?')[0]
    .replace(/^%PUBLIC_URL%\/?/, '')
    .replace(/^public[\\/]/, '')
    .replace(/^[\\/]+/, '');
  return `/${cleaned.replace(/\\/g, '/')}`.replace(/\/+/g, '/');
}

test('PWA icon source paths normalize PUBLIC_URL and root-relative forms', () => {
  const expected = ['public', '86chaos-icon-16-v1.png'];
  assertPublicPathEqual(publicPathFromUrl('/86chaos-icon-16-v1.png'), expected, 'root-relative URL resolves to native public path');
  assertPublicPathEqual(publicPathFromUrl('%PUBLIC_URL%/86chaos-icon-16-v1.png'), expected, 'PUBLIC_URL URL resolves to native public path');
  assertPublicPathEqual(publicPathFromUrl('86chaos-icon-16-v1.png'), expected, 'bare filename resolves to native public path');

  for (const src of [
    '/86chaos-icon-16-v1.png',
    '%PUBLIC_URL%/86chaos-icon-16-v1.png',
    '86chaos-icon-16-v1.png',
  ]) {
    const resolved = publicPathFromUrl(src);
    assert.doesNotMatch(resolved, /%PUBLIC_URL%/, `${src} must not leave PUBLIC_URL in the filesystem path`);
    assert.doesNotMatch(path.normalize(resolved), /public[\\/]%PUBLIC_URL%[\\/]/, `${src} must not become public/%PUBLIC_URL%/...`);
  }
});

test('PWA icon source paths normalize nested icon paths without duplicate PUBLIC_URL slashes', () => {
  const expected = ['public', 'icons', 'nested-icon.png'];
  assertPublicPathEqual(publicPathFromUrl('%PUBLIC_URL%/icons/nested-icon.png'), expected);
  assertPublicPathEqual(publicPathFromUrl('/icons/nested-icon.png'), expected);
  assertPublicPathEqual(publicPathFromUrl('icons/nested-icon.png'), expected);
  assertPublicPathEqual(publicPathFromUrl('public/icons/nested-icon.png'), expected);
});

test('PWA icon URL normalization keeps browser URLs slash-based', () => {
  assert.strictEqual(toBrowserAssetUrl('%PUBLIC_URL%/86chaos-icon-16-v1.png'), '/86chaos-icon-16-v1.png');
  assert.strictEqual(toBrowserAssetUrl('/86chaos-icon-16-v1.png'), '/86chaos-icon-16-v1.png');
  assert.strictEqual(toBrowserAssetUrl('86chaos-icon-16-v1.png'), '/86chaos-icon-16-v1.png');
  assert.strictEqual(toBrowserAssetUrl('public\\icons\\nested-icon.png'), '/icons/nested-icon.png');
});

test('PWA source paths compare semantically across Windows and POSIX separators', () => {
  const nativeExpected = path.join('public', '86chaos-icon-16-v1.png');
  assert.strictEqual(path.normalize('public/86chaos-icon-16-v1.png'), path.normalize(nativeExpected));
  assert.strictEqual(path.win32.normalize('public/86chaos-icon-16-v1.png'), path.win32.normalize('public\\86chaos-icon-16-v1.png'));
  assert.strictEqual(path.win32.join('public', '86chaos-icon-16-v1.png'), path.win32.normalize('public/86chaos-icon-16-v1.png'));
  assert.strictEqual(path.posix.normalize('public/86chaos-icon-16-v1.png'), 'public/86chaos-icon-16-v1.png');
});

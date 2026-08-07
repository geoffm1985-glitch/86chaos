'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { publicPathFromUrl } = require('../scripts/86chaos-release-gate/icon-source-validator.cjs');

test('PWA icon source paths normalize PUBLIC_URL and root-relative forms', () => {
  assert.equal(publicPathFromUrl('/86chaos-icon-16-v1.png'), 'public/86chaos-icon-16-v1.png');
  assert.equal(publicPathFromUrl('%PUBLIC_URL%/86chaos-icon-16-v1.png'), 'public/86chaos-icon-16-v1.png');
  assert.equal(publicPathFromUrl('86chaos-icon-16-v1.png'), 'public/86chaos-icon-16-v1.png');
});

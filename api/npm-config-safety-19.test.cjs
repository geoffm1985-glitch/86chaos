'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { safeNpmConfig } = require('../scripts/npm-config-safety.cjs');
test('public dependency options are allowed without allowing credentials or arbitrary registries', () => {
  assert.equal(safeNpmConfig('registry=https://registry.npmjs.org/\nlegacy-peer-deps=true\naudit=false\nfund=false\nprogress=false\nengine-strict=true\n'),true);
  for(const value of ['//registry.npmjs.org/:_authToken=private','registry=https://attacker.example','password=secret','legacy-peer-deps=true\n_auth=private'])assert.equal(safeNpmConfig(value),false);
});

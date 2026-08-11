'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const config = require(path.join(root, '.eslintrc.cjs'));
const esmApiFiles = [
  'api/alerts.js',
  'api/scan.js',
  'api/send-push.js',
  'api/send-schedule-alert.js'
];

test('ESLint keeps general API files in script mode and parses the four ESM API files as modules', () => {
  const overrides = Array.isArray(config.overrides) ? config.overrides : [];
  const generalApi = overrides.find((row) => Array.isArray(row.files) && row.files.includes('api/**/*.js'));
  assert.ok(generalApi, 'general api/**/*.js override exists');
  assert.equal(generalApi.parserOptions?.sourceType, 'script');

  const esmApi = overrides.find((row) => Array.isArray(row.files) && esmApiFiles.every((file) => row.files.includes(file)));
  assert.ok(esmApi, 'four-file ESM API override exists');
  assert.equal(esmApi.parserOptions?.sourceType, 'module');
  assert.equal(esmApi.parserOptions?.ecmaVersion, 2022);

  for (const file of esmApiFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /^\s*import\s/m, `${file} still uses ESM imports`);
  }
});

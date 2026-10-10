'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./mobile-capabilities'), 'utf8');

function request(method, credentialStatus) {
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, process: { env: { VERCEL_GIT_COMMIT_SHA: 'local-commit' } },
    require(name) {
      if (name === './_version') return { APP_VERSION: '18.0.12' };
      if (name === './_firebase-project-admin') return { projectCredentialStatus: credentialStatus };
      throw new Error('Unexpected dependency: ' + name);
    }
  });
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  module.exports({ method }, response);
  return response;
}

test('public mobile readiness returns metadata without credential material', () => {
  for (const configured of [true, false]) {
    const response = request('GET', project => {
      assert.equal(project, 'cheers-34b8d');
      return { configured, privateKey: 'must-not-leak' };
    });
    assert.equal(response.statusCode, configured ? 200 : 503);
    assert.equal(response.body.ok, configured);
    assert.equal(response.body.productionCredentialsConfigured, configured);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(JSON.stringify(response.body).includes('must-not-leak'), false);
  }
});

test('mobile readiness controls credential inspection failures without leaking details', () => {
  const response = request('GET', () => { throw new Error('private credential details'); });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, 'Mobile readiness is unavailable.');
  assert.equal(JSON.stringify(response.body).includes('private credential details'), false);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('mobile readiness rejects writes before inspecting credentials', () => {
  const response = request('POST', () => { throw new Error('must not inspect credentials'); });
  assert.equal(response.statusCode, 405);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.js');
const app = fs.readFileSync(appPath, 'utf8');
const messageLiteral = app.match(/const CHUNK_LOAD_ERROR_MESSAGE_RE = \/(.+)\/i;/);
const nameLiteral = app.match(/const CHUNK_LOAD_ERROR_NAME_RE = \/(.+)\/i;/);
assert.ok(messageLiteral, 'App.js exposes chunk load message classifier regex');
assert.ok(nameLiteral, 'App.js exposes chunk load name classifier regex');
const messageRe = new RegExp(messageLiteral[1], 'i');
const nameRe = new RegExp(nameLiteral[1], 'i');
const classifyLikeApp = (error = {}) => {
  const name = String(error.name || error.reason?.name || error.cause?.name || '');
  if (nameRe.test(name)) return true;
  const signal = [error.name, error.message, error.reason?.name, error.reason?.message, error.cause?.name, error.cause?.message]
    .map(value => String(value || ''))
    .filter(Boolean)
    .join(' ');
  return messageRe.test(signal);
};

test('normal TypeError stack containing /static/js is not classified as a chunk failure', () => {
  const error = {
    name: 'TypeError',
    message: "Cannot read properties of undefined (reading 'map')",
    stack: "TypeError: Cannot read properties\n    at TabGodMode (https://app.86chaos.com/static/js/main.abc123.js:2:1234)"
  };
  assert.equal(classifyLikeApp(error), false);
  assert.match(app, /const extractChunkUrl = \(error\) => \{/);
  assert.doesNotMatch(app, /const isChunkLoadFailure[\s\S]{0,220}stack/);
});

test('genuine ChunkLoadError is classified as a chunk failure', () => {
  assert.equal(classifyLikeApp({ name: 'ChunkLoadError', message: 'Loading chunk 451 failed.' }), true);
  assert.equal(classifyLikeApp({ name: 'TypeError', message: 'Failed to fetch dynamically imported module: /static/js/451.chunk.js' }), true);
});

test('runtime errors report through the section runtime reporter instead of chunk recovery', () => {
  assert.match(app, /reportRuntimeSectionError/);
  assert.match(app, /react_section_runtime_error/);
  assert.match(app, /Retry This Section/);
});

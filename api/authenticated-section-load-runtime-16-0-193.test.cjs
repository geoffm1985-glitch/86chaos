'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function hookBody(source, exportName, nextExportName) {
  const startToken = `export const ${exportName}`;
  const endToken = `export const ${nextExportName}`;
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(start, -1, `${exportName} exists`);
  assert.notEqual(end, -1, `${nextExportName} follows ${exportName}`);
  return source.slice(start, end);
}

test('useLiveCollectionState declares and propagates cacheScope before building its query key', () => {
  const source = read('src/core/appCore.js');
  const hook = hookBody(source, 'useLiveCollectionState', 'makeLiveDocumentKey');

  assert.match(hook, /debugLabel\s*=\s*['"]['"]\s*,\s*cacheScope\s*=\s*['"]['"]/s,
    'cacheScope is explicitly declared in hook options');
  assert.match(hook, /makeLiveCollectionKey\(\{[^}]*cacheScope[^}]*\}\)/s,
    'cacheScope participates in the live-collection key');
  assert.match(hook, /acquireSharedLiveCollection\(\{[^}]*cacheScope[^}]*\}\)/s,
    'cacheScope is propagated into the shared listener/cache entry');
  assert.match(hook, /\[[^\]]*cacheScope[^\]]*normalizeWhereClausesForKey/s,
    'cacheScope participates in the effect dependency list');
});

test('authenticated workspace-membership fallback chain still uses the repaired state hook', () => {
  const app = read('src/App.js');
  const calls = [...app.matchAll(/useLiveCollectionState\(\s*['"]workspaceMembers['"]/g)];
  assert.equal(calls.length, 4, 'all four sequential legacy workspace-member fallback queries remain wired');
  assert.match(app, /currentMembershipCanonical\s*=\s*useLiveCollectionState/);
  assert.match(app, /currentMembershipUid\s*=\s*useLiveCollectionState/);
  assert.match(app, /currentMembershipAuthUid\s*=\s*useLiveCollectionState/);
  assert.match(app, /currentMembershipEmail\s*=\s*useLiveCollectionState/);
});

test('runtime regression guard documents the deployed 16.0.192 failure class', () => {
  const source = read('src/core/appCore.js');
  const hook = hookBody(source, 'useLiveCollectionState', 'makeLiveDocumentKey');
  // The 16.0.192 bug referenced cacheScope without binding it. This lexical binding is
  // deliberately checked separately so a future partial cache migration cannot recreate it.
  const declaration = hook.match(/const\s*\{([\s\S]*?)\}\s*=\s*options\s*\|\|\s*\{\}/);
  assert.ok(declaration, 'hook options destructuring is present');
  assert.match(declaration[1], /\bcacheScope\b/, 'cacheScope is lexically bound before use');
});

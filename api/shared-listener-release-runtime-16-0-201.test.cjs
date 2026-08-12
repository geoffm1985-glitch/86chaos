'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = () => fs.readFileSync(path.join(root, 'src/core/appCore.js'), 'utf8');

test('shared Firestore listener cleanup does not reference hook-local debugLabelRef outside hook scope', () => {
  const appCore = source();
  const helperStart = appCore.indexOf('const acquireSharedLiveCollection =');
  const helperEnd = appCore.indexOf('export const useLiveCollection =', helperStart);
  assert.ok(helperStart > 0 && helperEnd > helperStart, 'acquireSharedLiveCollection helper can be inspected');
  const helper = appCore.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /debugLabelRef\b/, 'module-scope shared listener helper must not reference hook-local debugLabelRef');
  assert.match(helper, /const releaseLabel = subscriber\?\.debugLabel \|\| debugLabel \|\| ['"]['"];/, 'cleanup derives release label from subscriber/debugLabel available in helper scope');
  assert.match(helper, /liveCollectionReleaseGraceMs\(coll, releaseLabel\)/, 'release grace policy uses the scoped release label');
});

test('useLiveCollection and useLiveCollectionState may still use debugLabelRef inside their hook scopes', () => {
  const appCore = source();
  const liveHookStart = appCore.indexOf('export const useLiveCollection =');
  const snapshotHookStart = appCore.indexOf('export const useSnapshotCollection =', liveHookStart);
  const stateHookStart = appCore.indexOf('export const useLiveCollectionState =', snapshotHookStart);
  const documentKeyStart = appCore.indexOf('export const makeLiveDocumentKey', stateHookStart);
  const liveHook = appCore.slice(liveHookStart, snapshotHookStart);
  const stateHook = appCore.slice(stateHookStart, documentKeyStart);
  assert.match(liveHook, /const debugLabelRef = React\.useRef\(debugLabel \|\| ['"]['"]\)/, 'useLiveCollection keeps hook-local debug label ref');
  assert.match(stateHook, /const debugLabelRef = React\.useRef\(debugLabel \|\| ['"]['"]\)/, 'useLiveCollectionState keeps hook-local debug label ref');
});

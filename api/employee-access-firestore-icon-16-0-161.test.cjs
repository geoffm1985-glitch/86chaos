'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

test('staff removal fails closed when only-workspace Firebase Auth disable fails', () => {
  const src = read('api/staff-member.js');
  assert.match(src, /collectTargetWorkspaceMembershipDocs/);
  assert.match(src, /collectRemainingActiveMemberships/);
  assert.match(src, /auth\.updateUser\(targetUid, \{ disabled: true \}\)/);
  assert.match(src, /authDisableFailed: true/);
  assert.doesNotMatch(src, /could not disable auth user:[\s\S]*console\.warn[\s\S]*batch\.commit/);
  assert.match(src, /forceLogout/);
  assert.match(src, /deactivatedMemberships/);
});

test('login and workspace bootstrap explicit inactive workspace state beats stale legacy fallbacks', () => {
  const loginSrc = read('api/login-bootstrap.js');
  assert.match(loginSrc, /inactiveMembershipState/);
  assert.match(loginSrc, /Explicit inactive\/deleted workspace state wins/);
  assert.match(loginSrc, /currentInactive && !rawInactive/);
  assert.match(loginSrc, /filter\(\(workspace\) => workspace\.isActive !== false\)/);
  const workspaceSrc = read('api/workspace-memberships.js');
  assert.match(workspaceSrc, /inactiveMembershipState/);
  assert.match(workspaceSrc, /mergeWorkspaceOption/);
  assert.match(workspaceSrc, /currentInactive && !rawInactive/);
});

test('shared Firestore listeners ignore stale callbacks after release or tenant cleanup', () => {
  const src = read('src/core/appCore.js');
  assert.match(src, /closed: false/);
  assert.match(src, /entry\.closed === true \|\| liveCollectionRegistry\.get\(key\) !== entry/);
  assert.match(src, /entry\.closed === true \|\| liveDocumentRegistry\.get\(key\) !== entry/);
  assert.match(src, /latest\.closed = true/);
});

test('metallic 86 Chaos icon is active in manifest, favicon, apple touch, and header mark', () => {
  const manifest = json('public/manifest.json');
  const iconSources = manifest.icons.map(icon => icon.src);
  assert.ok(iconSources.every(src => src.includes('-v2.png')), 'all manifest icons should use v2 cache-busted files');
  for (const size of [16,32,48,144,180,192,256,384,512]) {
    assert.ok(fs.existsSync(path.join(root, `public/86chaos-icon-${size}-v2.png`)), `icon ${size} exists`);
  }
  assert.ok(fs.existsSync(path.join(root, 'public/86chaos-maskable-192-v2.png')));
  assert.ok(fs.existsSync(path.join(root, 'public/86chaos-maskable-512-v2.png')));
  assert.match(read('public/index.html'), /86chaos-icon-180-v2\.png/);
  assert.match(read('public/index.html'), /86chaos-icon-32-v2\.png/);
  assert.match(read('src/components/common.jsx'), /86chaos-icon-48-v2\.png/);
  assert.match(read('src/components/CheersLogo.js'), /86chaos-icon-48-v2\.png/);
  assert.doesNotMatch(read('src/components/common.jsx') + read('src/components/CheersLogo.js'), /wisco\.png/);
});

test('reported failed-current runner remains exactly six historical Request Off failures', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-failed-only-20260809-004632.json');
  assert.strictEqual(manifest.mode, 'reported-failed-only');
  assert.strictEqual(manifest.selected.length, 6);
  assert.strictEqual(manifest.selected.filter(row => row.project === 'chromium').length, 3);
  assert.strictEqual(manifest.selected.filter(row => row.project === 'mobile-chromium').length, 3);
  const titles = new Set(manifest.selected.map(row => row.leafTitle || row.title));
  assert.deepStrictEqual([...titles].sort(), [
    'Approve All Visible updates only filtered visible pending requests',
    'Archive All Visible archives only filtered visible eligible requests',
    'Request Off employee filter narrows and clears manager-visible requests'
  ].sort());
});

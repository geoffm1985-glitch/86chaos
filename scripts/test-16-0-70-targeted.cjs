#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const app = read('src/App.js');
const admin = read('api/admin-global-operation.js');
const version = JSON.parse(read('public/version.json'));
const pkg = JSON.parse(read('package.json'));

assert.strictEqual(version.version, '16.0.70', 'public version should be 16.0.70');
assert.strictEqual(pkg.version, '16.0.70', 'package version should be 16.0.70');
assert.match(read('src/core/appCore.js'), /CURRENT_VERSION\s*=\s*'16\.0\.70'/, 'app core version should be 16.0.70');

assert.match(app, /maybeApplyRemoteRefreshSignal/, 'App should have a centralized remote refresh signal handler.');
assert.match(app, /REMOTE_REFRESH_RECENT_SIGNAL_MS/, 'Remote refresh should handle recent first-seen signals for clients without an old baseline.');
assert.match(app, /restaurant:\$\{rId\}/, 'Restaurant listener should use per-workspace refresh keys.');
assert.match(app, /user:\$\{id\}/, 'User profile listener should handle user-level refresh signals.');
assert.match(app, /forceRefreshAt[\s\S]*clientRefreshAt[\s\S]*globalRefreshAt/, 'App should read multiple refresh signal fields.');
assert.doesNotMatch(app, /if \(localRefresh\) \{\s*\/\/ Instantly triggers a hard reload/, 'Global refresh must not require an old session baseline before reloading.');

assert.match(app, /shouldHonorForceLogoutNow/, 'App should decide whether a forceLogout is still current before signing out.');
assert.match(app, /FORCE_LOGOUT_LEGACY_BLOCK_MS/, 'Legacy forceLogout flags should not create permanent login bans.');
assert.match(app, /authSessionStarted/, 'Force logout checks should use a local auth-session start fallback.');
assert.match(app, /forceLogoutNonce/, 'Force logout events should include a nonce to distinguish events.');
assert.match(app, /client-stale-session-guard/, 'Stale logout flags should be cleared/ignored instead of trapping employees.');

assert.match(admin, /async function pageUsers/, 'Global operation API should be able to page users.');
assert.match(admin, /usersAffected/, 'Global refresh should report how many user profiles were signaled.');
assert.match(admin, /clientRefreshAt:\s*now/, 'Global refresh should write user-level refresh signals.');
assert.match(admin, /forceRefreshAt:\s*now/, 'Global refresh should write timestamped refresh signals.');
assert.match(admin, /forceLogoutNonce:\s*idempotencyKey/, 'Global logout should write a nonce so clients do not confuse old and new logout events.');
assert.match(admin, /restaurantsAffected/, 'Global refresh should still update restaurant/workspace refresh signals.');

console.log('16.0.70 targeted global refresh/login-loop checks passed.');

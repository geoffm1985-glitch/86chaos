#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const jsDir = path.join(build, 'static', 'js');
const mediaDir = path.join(build, 'static', 'media');
assert(fs.statSync(jsDir).isDirectory(), 'production build/static/js is missing');

const jsFiles = fs.readdirSync(jsDir).filter(name => name.endsWith('.js'));
assert(jsFiles.length > 0, 'production build contains no JavaScript bundles');
const bundleText = jsFiles.map(name => fs.readFileSync(path.join(jsDir, name), 'utf8')).join('\n');
for (const moduleName of ['scheduleRuntimeSafety', 'requestOffRuntimeSafety', 'rosterRoleIdentityCore']) {
  assert(!new RegExp(`static/media/${moduleName}\\.[^"']+\\.cjs`).test(bundleText), `${moduleName}.cjs was emitted as a URL instead of executable JavaScript`);
}
if (fs.existsSync(mediaDir)) {
  const emitted = fs.readdirSync(mediaDir).filter(name => /^(scheduleRuntimeSafety|requestOffRuntimeSafety|rosterRoleIdentityCore).*\.cjs$/i.test(name));
  assert.deepEqual(emitted, [], `runtime safety modules were emitted as static media: ${emitted.join(', ')}`);
}
console.log(`Schedule/roster runtime production-bundle contract passed across ${jsFiles.length} JavaScript assets.`);

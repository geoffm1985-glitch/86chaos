#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-11.js');
assert.equal(pkg.scripts['validate:17.0.11'], 'node scripts/validate-17-0-11.js');
assert.equal(pkg.version, '17.0.11');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.releaseTitle, 'Schedule Builder Runtime Repair');
for (const file of ['src/core/appCore.js', 'api/_version.js', 'api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.11'"));
for (const file of ['src/core/scheduleBuilderRuntime.js', 'src/core/scheduleBuilderRuntime.test.js', 'src/core/requestOffRuntimeSafety.js', 'src/core/rosterRoleIdentity.js', 'RELEASE_17_0_11.md']) assert(fs.statSync(file).isFile());
const schedule = read('src/features/schedule.jsx');
assert(schedule.includes("from '../core/scheduleBuilderRuntime'"));
assert(schedule.includes('normalizeScheduleBuilderEvents(rawEvents)'));
assert(!schedule.includes('__86Chaos'));
assert(!read('src/core/scheduleBuilderRuntime.js').includes('.cjs'));
assert(!read('src/core/requestOffRuntimeSafety.js').includes('.cjs'));
assert(!read('src/core/rosterRoleIdentity.js').includes('.cjs'));
for (const file of ['test-tools/certification/groups.json', 'test-tools/regressions/registry.json', 'test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release, pkg.version);
console.log('17.0.11 source validation passed; this does not certify the release.');

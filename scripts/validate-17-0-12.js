#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-12.js');
assert.equal(pkg.scripts['validate:17.0.12'], 'node scripts/validate-17-0-12.js');
assert.equal(pkg.version, '17.0.12');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.releaseTitle, 'Schedule Publish Candidate Repair and PWA Gate Hardening');
for (const file of ['src/core/appCore.js', 'api/_version.js', 'api/_pos-bridge-config.js']) assert(read(file).includes("'17.0.12'"));
for (const file of ['src/core/schedulePublicationPlan.js', 'src/core/schedulePublicationPlan.test.js', 'src/features/schedule.jsx', 'tests/86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs', 'RELEASE_17_0_12.md']) assert(fs.statSync(file).isFile());
const schedule = read('src/features/schedule.jsx');
assert(schedule.includes('getDocsFromServer(candidateQuery)'), 'schedule publish uses server-authoritative candidate reads');
assert(schedule.includes('isIntentionalOpenScheduleShift(shift)'), 'schedule publish keeps intentional open shift parity with the server');
assert(schedule.includes('desiredEmployeeIdentity: item.intentionalOpen ? null'), 'open-shift evidence follows server canonical fingerprinting');
const pwaSpec = read('tests/86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs');
assert(!pwaSpec.includes('{ page,'), 'PWA metadata matrix does not request a browser page fixture');
assert(pwaSpec.includes('request.get(rootUrl'), 'PWA metadata matrix verifies app-shell metadata by request');
for (const file of ['test-tools/certification/groups.json', 'test-tools/regressions/registry.json', 'test-tools/certification/cost-performance-baselines.json']) assert.equal(json(file).release, pkg.version);
console.log('17.0.12 source validation passed; this does not certify the release.');

#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const exists = file => fs.existsSync(path.join(root, file));

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.version, '17.0.48');
assert.equal(lock.version, '17.0.48');
assert.equal(lock.packages[''].version, '17.0.48');
assert.equal(version.version, '17.0.48');
assert.equal(version.build, '17.0.48');
assert.equal(version.releaseTitle, 'Emergency Schedule Publish Permission Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-48.js');
assert.equal(pkg.scripts['validate:17.0.48'], 'node scripts/validate-17-0-48.js');
assert.equal(pkg.scripts['test:emergency-schedule-publish-permissions'], 'node --test api/emergency-schedule-publish-permissions-17-0-47.test.cjs');
assert(pkg.scripts['test:current-release-targeted']?.includes('test:emergency-schedule-publish-permissions:rules'));
assert(pkg.scripts['test:current-release-targeted']?.includes('test:emergency-schedule-publish-permissions:play-store'));
const workflow = read('.github/workflows/testing-targeted-delta.yml');
assert(workflow.includes('actions/setup-java@v4') && workflow.includes("java-version: '21'"), 'targeted Firestore emulator runner provisions Java 21');

for (const [file, needle] of [
  ['src/core/appCore.js', "CURRENT_VERSION = '17.0.48'"],
  ['api/_version.js', "APP_VERSION = '17.0.48'"],
  ['api/_version.js', "SECURITY_SCHEMA_VERSION = '17.0.48'"],
  ['api/_pos-bridge-config.js', "APP_RELEASE = '17.0.48'"],
  ['src/core/customerHelpKnowledge.js', "CUSTOMER_HELP_VERSION = '17.0.48'"],
  ['src/core/customerHelpKnowledge.cjs', "CUSTOMER_HELP_VERSION = '17.0.48'"],
  ['src/core/schedulePdf.js', '86 Chaos 17.0.48'],
]) assert(read(file).includes(needle), `${file} carries 17.0.48 release identity`);

const schedule = read('src/features/schedule.jsx');
const start = schedule.indexOf('const fetchSchedulePublishCandidatesForDaySet');
const end = schedule.indexOf('const eventsByScheduleDay', start);
assert(start >= 0 && end > start, 'Schedule Publish candidate helper exists');
const publishBlock = schedule.slice(start, end);
assert(!publishBlock.includes("where('workspaceId', '==', appUser.restaurantId)"), 'Schedule Publish does not issue rules-incompatible workspaceId-only reads');
assert(publishBlock.includes("where('restaurantId', '==', appUser.restaurantId), where('date', '==', day)"), 'canonical restaurantId/date query remains');
assert(publishBlock.includes("where('restaurantId', '==', appUser.restaurantId), where('scheduleDateKey', '==', day)"), 'restaurantId/scheduleDateKey compatibility query remains');
assert(publishBlock.includes('Publish candidate query failed for ${day}. No shifts were changed.'), 'fail-closed no-write message remains');

const rules = read('firestore.rules');
assert(rules.includes("match /shifts/{docId}"), 'shift rules remain present');
assert(rules.includes("allow read: if signedIn() && (isSuperAdmin() || (resource.data.restaurantId is string && isTenantMatch(resource.data.restaurantId)));"), 'shift reads remain restaurantId tenant scoped');

for (const file of [
  'api/emergency-schedule-publish-permissions-17-0-47.test.cjs',
  'scripts/run-schedule-publish-permission-targeted.cjs',
  'tests/86chaos-release-gate/62-emergency-schedule-publish-permissions.spec.cjs',
]) assert(exists(file), `${file} emergency regression coverage is retained`);

for (const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) {
  assert.equal(json(file).release, '17.0.48', `${file} release identity matches`);
}

console.log('17.0.48 Emergency Schedule Publish Permission Repair validation passed; this does not certify the release.');

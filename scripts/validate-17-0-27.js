#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { captureSourceIdentity, hash } = require('./86chaos-release-gate/source-identity.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');

assert.equal(pkg.version, '17.0.27');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(version.version, pkg.version);
assert.equal(version.build, pkg.version);
assert.equal(version.releaseTitle, 'Emergency Schedule Assignment Reliability Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-27.js');
assert.equal(pkg.scripts['validate:17.0.27'], 'node scripts/validate-17-0-27.js');
assert(pkg.scripts['test:repair:17.0.27']?.includes('test:current-release-targeted'), '17.0.27 repair command uses current release targeted suite');
assert(pkg.scripts['test:schedule-shift-assignment']?.includes('schedule-shift-assignment-emergency-17-0-27.test.cjs'), 'direct assignment regression command exists');
for (const regression of [
  'api/schedule-shift-assignment-emergency-17-0-27.test.cjs',
  'api/i18n-phase1-17-0-26.test.cjs',
  'api/schedule-shift-delete-17-0-25.test.cjs',
  'api/release-gate-delta-clean-baseline-17-0-25.test.cjs',
  'api/time-off-policy-17-0-23.test.cjs',
]) assert(pkg.scripts['test:current-release-targeted']?.includes(regression), `current targeted suite retains ${regression}`);
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'), 'delta runs current targeted regressions before scoped Playwright');

const schedule = read('src/features/schedule.jsx');
const assignRoute = read('api/schedule-shift-assign.js');
const assignTest = read('api/schedule-shift-assignment-emergency-17-0-27.test.cjs');
const browserTest = read('tests/86chaos-new-implementations/09-schedule-builder-shift-assignment.spec.cjs');
const deltaScope = read('scripts/86chaos-release-gate/current-release-repair-scope.cjs');
const releaseUniverse = read('scripts/86chaos-release-gate/release-test-universe.cjs');

const assignStart = schedule.indexOf('const handleAssign = async () =>');
const assignEnd = schedule.indexOf('const saveReviewedRoles', assignStart);
assert(assignStart >= 0 && assignEnd > assignStart, 'Schedule Builder handleAssign block exists');
const assignBlock = schedule.slice(assignStart, assignEnd);
assert(assignBlock.includes("secureFetch('/api/schedule-shift-assign'"), 'Schedule Builder assigns shifts through authenticated server route');
assert(assignBlock.includes('assignmentOperationId'), 'Schedule Builder supplies an idempotent assignment operation id');
assert(assignBlock.includes('setLocalBuilderDeletedShiftMarkers(prev => prev.filter'), 'successful assignment clears matching stale local delete tombstones');
assert(assignBlock.includes("addToast('Assignment Failed'"), 'assignment failures are visible to the scheduler');
assert(!/addDoc\(collection\(db, ["']shifts["']/.test(assignBlock), 'handleAssign no longer directly writes shift documents from the browser');
assert(schedule.includes('data-testid="schedule-builder-assign"'), 'assignment control has a stable release-gate selector');
assert(schedule.includes('data-testid="schedule-builder-cell"'), 'Schedule Builder cells have stable release-gate selectors');

for (const contract of [
  "requireAppCheckIfEnforced",
  "requiredPermissions: ['schedule']",
  'db.batch()',
  'deterministicShiftId',
  "isPublished: false",
  "publishState: 'draft'",
  "SCHEDULE_SHIFT_ASSIGN",
]) assert(assignRoute.includes(contract), `assignment API retains ${contract}`);
assert(assignRoute.includes('restaurantId,') && assignRoute.includes('workspaceId: restaurantId'), 'server canonicalizes tenant identity');
assert(assignTest.includes('ignores client publication/tenant authority'), 'Node regression covers canonical server authority');
assert(assignTest.includes('idempotent for an accidental request replay'), 'Node regression covers replay idempotency');
assert(assignTest.includes('requires actual Schedule Builder authority'), 'Node regression covers permissions');
assert(browserTest.includes('schedule-builder-assign'), 'browser release-gate test exercises real assignment control');
assert(browserTest.includes('schedule-delete-shift'), 'browser release-gate test cleans up the QA-created shift');
assert(releaseUniverse.includes("'86chaos-new-implementations/**/*.spec.cjs'"), 'new assignment browser test is inside the full release-gate universe');
assert(deltaScope.includes("const CURRENT_RELEASE_VERSION = '17.0.27'"), 'delta current-release scope is advanced to 17.0.27');
assert(deltaScope.includes('08-phase1-spanish-interface.spec.cjs'), 'delta retains Phase 1 Spanish browser regression');
assert(deltaScope.includes('09-schedule-builder-shift-assignment.spec.cjs'), 'delta selects emergency assignment browser regression');

// Preserve the already-delivered Phase 1 Spanish, delete reliability, delta baseline, and Request Off policy boundaries.
const app = read('src/App.js');
const i18n = read('src/core/i18n.cjs');
const management = read('src/features/management.jsx');
const deleteRoute = read('api/schedule-shift-delete.js');
const delta = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const policy = read('src/core/timeOffPolicy.js');
assert(app.includes('I18nProvider'), 'Phase 1 Spanish provider remains installed');
assert(i18n.includes("SUPPORTED_APP_LANGUAGES = Object.freeze(['en', 'es'])"), 'English/Spanish language support remains intact');
assert(i18n.includes("'drawer.timeClockSchedule': 'Reloj y horario'"), 'Spanish dictionary remains intact');
assert(management.includes('data-testid="app-language-select"'), 'per-user language selector remains present');
assert(schedule.includes("secureFetch('/api/schedule-shift-delete'"), 'authenticated schedule deletion remains intact');
assert(deleteRoute.includes("action === 'clear-month'"), 'Clear Month remains intact');
assert(delta.includes('A clean full baseline with zero FAIL/TIMEOUT rows is still a valid delta baseline.'), 'clean-baseline delta repair remains intact');
assert(!/permissions\?\.(?:schedule|team|settings)/.test(policy), 'Request Off policy configuration remains owner/admin only');

for (const file of [
  'src/core/appCore.js',
  'api/_version.js',
  'api/_pos-bridge-config.js',
  'src/core/customerHelpKnowledge.js',
  'src/core/customerHelpKnowledge.cjs',
  'src/core/schedulePdf.js',
]) assert(read(file).includes('17.0.27'), `${file} carries current version 17.0.27`);
for (const file of [
  'test-tools/certification/groups.json',
  'test-tools/regressions/registry.json',
  'test-tools/certification/cost-performance-baselines.json',
]) assert.equal(json(file).release, pkg.version, `${file} release identity matches package version`);

const manifestPath = path.join(root, 'release-source-manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = json('release-source-manifest.json');
  const identity = captureSourceIdentity(root);
  assert.equal(manifest.sourceHash, identity.sourceHash, 'release source manifest matches current source tree');
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.sourceHash, 'release source manifest self-hash is valid');
  assert.deepEqual(manifest.files, identity.files, 'release source manifest file inventory matches current source tree');
  const buildIdentity = json('public/build-identity.json');
  assert.equal(buildIdentity.version, pkg.version, 'build identity version matches package version');
  assert.equal(buildIdentity.sourceHash, identity.sourceHash, 'build identity source hash matches manifest');
}

console.log('17.0.27 Emergency Schedule Assignment Reliability Repair validation passed; this does not certify the release.');

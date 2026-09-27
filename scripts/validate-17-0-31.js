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
assert.equal(pkg.version, '17.0.31');
assert.equal(lock.version, '17.0.31');
assert.equal(lock.packages[''].version, '17.0.31');
assert.equal(version.version, '17.0.31');
assert.equal(version.build, '17.0.31');
assert.equal(version.releaseTitle, 'Cross-Platform Source Manifest Parity Repair');
assert.equal(pkg.scripts['test:source'], 'node scripts/validate-17-0-31.js');
assert.equal(pkg.scripts['validate:17.0.31'], 'node scripts/validate-17-0-31.js');
assert(pkg.scripts['test:play-store:delta']?.startsWith('npm run test:current-release-targeted &&'));
assert(pkg.scripts['test:new-implementations']?.startsWith('npm run validate:17.0.31'));

for (const [file, needle] of [
  ['src/core/appCore.js', "CURRENT_VERSION = '17.0.31'"],
  ['api/_version.js', "APP_VERSION = '17.0.31'"],
  ['api/_version.js', "SECURITY_SCHEMA_VERSION = '17.0.31'"],
  ['api/_pos-bridge-config.js', "APP_RELEASE = '17.0.31'"],
  ['src/core/customerHelpKnowledge.js', "CUSTOMER_HELP_VERSION = '17.0.31'"],
  ['src/core/customerHelpKnowledge.cjs', "CUSTOMER_HELP_VERSION = '17.0.31'"],
  ['src/core/schedulePdf.js', '86 Chaos 17.0.31'],
]) assert(read(file).includes(needle), `${file} carries merged release identity`);

// 17.0.29 feature-line preservation.
const app = read('src/App.js');
const schedule = read('src/features/schedule.jsx');
assert(app.includes("from './core/i18n'"));
assert(app.includes('<I18nProvider language={appLanguage}>'));
assert(read('src/core/i18n.js').includes("SUPPORTED_APP_LANGUAGES = Object.freeze(['en', 'es'])"));
assert(schedule.includes("secureFetch('/api/schedule-shift-assign'"));
assert(schedule.includes("secureFetch('/api/schedule-shift-delete'"));
assert(schedule.includes('createSchedulePublishGuard'));
assert(schedule.includes('normalizeTimeOffPolicy'));
assert(schedule.includes('useI18n'));
for (const file of [
  'api/_pos-bridge-route.js','api/_pos-bridge-auth.js','api/schedule-publish.js','api/schedule-shift-delete.js',
  'src/core/schedulePublicationPlan.js','src/core/schedulePublishProgress.js','src/core/timeOffPolicy.js',
]) assert(exists(file), `${file} from the 17.x feature line is retained`);

// 16.0.244 robustness/certification preservation.
const runner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const mutation = read('scripts/86chaos-release-gate/mutation-safety.cjs');
const targets = read('scripts/86chaos-release-gate/vercel-targets.cjs');
const universe = read('scripts/86chaos-release-gate/release-test-universe.cjs');
assert(runner.includes('Initialize-AutoProvisionRoleAccounts'));
assert(runner.includes('RandomNumberGenerator]::Create()'));
assert(mutation.includes('testing.86chaos.com') && mutation.includes('experimental.86chaos.com'));
assert(targets.includes('APPROVED_NON_PRODUCTION_ALIASES'));
assert(read('src/core/appCore.js').includes("currentHostname === 'testing.86chaos.com'") && read('src/core/appCore.js').includes("currentHostname === 'experimental.86chaos.com'"));
for (const file of [
  'api/native-backup-watchdog-timeout-hardening.test.cjs','api/source-validator-line-ending-safety.test.cjs','api/release-gate-auto-provision-role-env.test.cjs',
  'tests/86chaos-release-gate/37-native-backup-watchdog-hardening.spec.cjs','tests/86chaos-release-gate/38-release-identity-deployment-parity.spec.cjs',
  'tests/86chaos-release-gate/39-testing-alias-mutation-safety.spec.cjs','tests/86chaos-release-gate/40-validator-line-ending-safety.spec.cjs',
  'tests/86chaos-release-gate/41-auto-provision-role-env.spec.cjs','tests/86chaos-release-gate/42-merged-17-0-30-parity.spec.cjs',
]) assert(exists(file), `${file} is retained`);
for (const n of [37,38,39,40,41,42]) assert(universe.includes(`tests/86chaos-release-gate/${n}-`), `release universe includes regression ${n}`);
assert(read('scripts/validate-16-0-231.js').includes("replace(/\\r\\n?/g, '\\n')"), 'source validator hash remains line-ending safe');
assert(read('api/firestore-backup-watchdog.js').includes('DEFAULT_ADMIN_API_TIMEOUT_MS'), 'backup watchdog timeout hardening is retained');

// Combined PDF behavior.
const model = read('src/core/schedulePrintModel.js');
const pdf = read('src/core/schedulePdf.js');
assert(model.includes('formatScheduleTime12Hour'));
assert(model.includes('detailLabel'));
assert(pdf.includes('candidateSizes = [8, 7.5, 7, MIN_FONT_SIZE]'));
assert(pdf.includes('detailCells'));
assert(pdf.includes('detail page'));
assert(pdf.includes('shift.detailLabel'));
assert(!pdf.includes('cannot fit all ${cell.shifts.length} shifts'));

for (const file of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json']) {
  assert.equal(json(file).release, '17.0.31', `${file} release identity matches`);
}

console.log('17.0.31 Cross-Platform Source Manifest Parity Repair validation passed; this does not certify the release.');

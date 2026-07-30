#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const schedule = read('src/features/schedule.jsx');
assert(schedule.includes('const visibleWeekStart = maxDateKey(fullWeekStart, schedulePeriodBounds.start);'), 'Week blocks must start no earlier than the visible schedule period.');
assert(schedule.includes('const visibleWeekEnd = minDateKey(fullWeekEnd, schedulePeriodBounds.end);'), 'Week blocks must end no later than the visible schedule period.');
assert(schedule.includes('days: buildDateRange(visibleWeekStart, visibleWeekEnd)'), 'Scheduled hour totals must use the clipped visible week day list.');
assert(schedule.includes('Visible schedule days in this week'), 'Week header title must explain the clipped visible range.');
assert(schedule.includes('min-w-[86px] whitespace-nowrap'), 'Scheduled-hours week cells must stay horizontal and readable on mobile.');
assert(schedule.includes('Proj. Cost') && schedule.includes('min-w-[96px]'), 'Projected cost label must not collapse into vertical stacked text.');

const globalSetup = read('tests/86chaos-release-gate/global-setup.cjs');
assert(globalSetup.includes('loadEnv(root);'), 'Playwright global setup must load the local testing env when direct Playwright is used.');
assert(globalSetup.includes('provisionTestAccounts'), 'Playwright global setup must be able to provision temp role accounts before seeding.');
assert(globalSetup.includes("verifyRoleAccounts({ root, loadEnvironment: false, writeReport: true, throwOnFailure: false, phase: 'global-setup-role-preflight' })"), 'Playwright global setup must write a fresh current-run role report before QA seed.');
assert(globalSetup.includes('Temporary test-account provisioning failed before QA setup'), 'Provisioning errors must block before QA data writes.');

const cleanup = read('scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
assert(cleanup.includes('getSetupStatePath'), 'Cleanup must read current-run setup state.');
assert(cleanup.includes('noCurrentRunQaData'), 'Cleanup must detect when no current-run QA data exists.');
assert(cleanup.includes('Cleanup safely skipped because QA setup did not create a current-run restaurant or seeded child records.'), 'Cleanup must report a safe skip for failed setup before data creation.');

const { validateSeedForCleanup } = require(path.join(root, 'scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs'));
const noDataValidation = validateSeedForCleanup({ ok: false, runId: 'unit-run', createdRestaurant: false, seededDocuments: [], verification: { ok: false } }, 'unit-run');
assert.strictEqual(noDataValidation.ok, false, 'A failed seed report should not be considered valid for destructive cleanup.');
assert(noDataValidation.errors.some((msg) => /restaurantId/i.test(msg)), 'Failed seed report without restaurantId must explain why cleanup cannot delete.');

console.log('16.0.57 targeted schedule-hours and release-gate seed-auth test passed.');

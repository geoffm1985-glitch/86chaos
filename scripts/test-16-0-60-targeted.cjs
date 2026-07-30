#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`PASS: ${message}`);

const schedulePath = path.join(root, 'src', 'features', 'schedule.jsx');
const schedule = fs.readFileSync(schedulePath, 'utf8');

if (schedule.includes('days: buildDateRange(fullWeekStart, fullWeekEnd)')) {
  pass('Scheduled Hours Tracker counts the full pay-period week, including previous/next month dates.');
} else {
  fail('Scheduled Hours Tracker still appears to clip week days to the visible schedule window.');
}

if (schedule.includes('visibleStart: visibleWeekStart') && schedule.includes('visibleEnd: visibleWeekEnd')) {
  pass('Visible schedule boundaries are preserved separately from pay-period hour boundaries.');
} else {
  fail('Visible schedule boundaries are not preserved separately from full pay-period week boundaries.');
}

if (/Pay-period week counted/.test(schedule) && /Pay-period week/.test(schedule)) {
  pass('Scheduled Hours Tracker labels/audits clearly refer to pay-period weeks.');
} else {
  fail('Scheduled Hours Tracker labels/audits do not clearly describe pay-period week calculations.');
}

const psPath = path.join(root, 'RUN_86CHAOS_FULL_TEST_SUITE.ps1');
if (fs.existsSync(psPath)) {
  const ps = fs.readFileSync(psPath, 'utf8');
  const nodeCheckIndex = ps.indexOf('Node version project check');
  const installIndex = ps.indexOf('Install locked dependencies');
  if (nodeCheckIndex >= 0 && installIndex >= 0 && nodeCheckIndex < installIndex) {
    pass('Full local test runner checks the required project Node version before npm ci.');
  } else {
    fail('Full local test runner does not check Node 24 before npm ci.');
  }
  if (ps.includes('npm ci --include=dev --no-audit --no-fund')) {
    pass('Full local test runner uses the correct locked dev dependency install command.');
  } else {
    fail('Full local test runner does not use npm ci --include=dev --no-audit --no-fund.');
  }
  if (ps.includes('Show-LogTail') && ps.includes('86 Chaos requires Node 24.x')) {
    pass('Full local test runner prints clearer install-failure diagnostics.');
  } else {
    fail('Full local test runner is missing clear dependency-install diagnostics.');
  }
} else {
  fail('RUN_86CHAOS_FULL_TEST_SUITE.ps1 is missing from the app root.');
}

if (process.exitCode) process.exit(process.exitCode);

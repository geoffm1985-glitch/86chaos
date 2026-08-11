#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const required = process.argv.includes('--required');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/repair-regression-16.0.192.json'), 'utf8'));
const selected = manifest.selected || [];
const firebaseProject = process.env.REACT_APP_FIREBASE_PROJECT_ID || process.env.CHAOS_TARGET_FIREBASE_PROJECT_ID || process.env.CHAOS_FIREBASE_PROJECT_ID || '';
const url = process.env.CHAOS_BASE_URL || process.env.APP_URL || '';
const expected = process.env.CHAOS_EXPECTED_VERSION || '';
const safeProject = firebaseProject === 'chaos-test-d1601';
const safeUrl = url && !/app\.86chaos\.com|cheers-34b8d|production/i.test(url);
const safeVersion = !expected || expected === manifest.version;
console.log('86 CHAOS REPAIR BROWSER REGRESSION');
console.log(`Release: ${manifest.version}`);
console.log(`TOTAL BROWSER IDENTITIES: ${selected.length}`);
for (const row of selected) console.log(`[${row.project}] ${row.specPath} :: ${row.fullSuitePath || '(root)'} :: ${row.leafTitle}`);
if (!safeProject || !safeUrl || !safeVersion) {
  console.log('BROWSER REPAIR REGRESSION: NOT RUN - SAFE TEST DEPLOYMENT NOT CONFIGURED');
  console.log(`firebaseProject=${firebaseProject || '(missing)'}`);
  console.log(`url=${url || '(missing)'}`);
  console.log(`expectedVersion=${expected || '(not set)'}`);
  process.exit(required ? 1 : 0);
}
console.error('BROWSER REPAIR REGRESSION: BLOCKED - exact repair browser executor is not available in this local container. Run this command from the configured QA Playwright environment.');
process.exit(required ? 1 : 0);

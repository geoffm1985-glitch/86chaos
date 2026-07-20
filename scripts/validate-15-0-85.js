#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
let failed = false;
function run(script) {
  console.log(`\n== ${script} ==`);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
function mustContain(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (!text.includes(needle)) {
    console.error(`Missing ${label}: ${file} should contain ${needle}`);
    failed = true;
  }
}
function mustMatch(file, regex, label) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (!regex.test(text)) {
    console.error(`Missing ${label}: ${file} should match ${regex}`);
    failed = true;
  }
}
run('validate-15-0-83.js');
mustContain('src/core/appCore.js', "LOCKED_TEST_FIREBASE_API_KEY = 'AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw'", 'locked testing Firebase browser API key');
mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.85'", 'runtime version update');
mustContain('public/version.json', '15.0.85', 'version JSON update');
mustContain('src/features/inventory.jsx', 'Use Suggested Qty', 'AI order button label');
mustContain('src/features/inventory.jsx', 'Applied ✓', 'AI order applied state');
mustContain('src/features/inventory.jsx', 'Apply Selected to Draft', 'AI order selected bulk apply');
mustContain('src/features/inventory.jsx', 'toggleAllAiOrderSelections', 'AI order select all handler');
mustContain('src/core/aiOrderAssistant.js', 'isLikelyInvoiceNoiseInventoryItem', 'invoice-noise inventory filter');
mustContain('src/features/operations.jsx', 'manager-brief-math-summary', 'Manager Brief math summary test hook');
mustContain('vercel.json', 'https://vercel.live', 'Vercel live CSP allowance');
mustContain('vercel.json', 'https://www.google.com', 'reCAPTCHA Enterprise connect allowance');
mustMatch('firestore.indexes.json', /"collectionGroup":\s*"timePunches"[\s\S]*"fieldPath":\s*"restaurantId"[\s\S]*"fieldPath":\s*"date"/, 'timePunches restaurant/date index');
mustMatch('firestore.indexes.json', /"collectionGroup":\s*"shiftSwaps"[\s\S]*"fieldPath":\s*"restaurantId"[\s\S]*"fieldPath":\s*"date"/, 'shiftSwaps restaurant/date index');
mustMatch('firestore.indexes.json', /"collectionGroup":\s*"events"[\s\S]*"fieldPath":\s*"restaurantId"[\s\S]*"fieldPath":\s*"date"/, 'events restaurant/date index');
process.exit(failed ? 1 : 0);

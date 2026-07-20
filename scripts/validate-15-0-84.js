#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const scripts = [
  'validate-15-0-83.js'
];
let failed = false;
for (const script of scripts) {
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
function mustNotContain(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (text.includes(needle)) {
    console.error(`Unexpected ${label}: ${file} contains ${needle}`);
    failed = true;
  }
}
mustContain('src/core/appCore.js', "LOCKED_TEST_FIREBASE_API_KEY = 'AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw'", 'locked testing Firebase browser API key');
mustContain('src/core/appCore.js', "isVercelPreviewHost || forceTestingFirebase", 'Vercel preview forced to testing Firebase project');
mustContain('src/core/appCore.js', "!isVercelPreviewHost && genericConfigIsUsable", 'generic Firebase browser config ignored on preview/local');
mustContain('src/core/appCore.js', "browserApiKeyTail", 'safe key-tail diagnostics');
mustContain('public/firebase-messaging-sw.js', "apiKey: \"AIzaSyBIRGMeLnVE3w3i1WZJzurcp-LkeaNZ3hw\"", 'service worker testing Firebase key');
mustContain('public/version.json', '15.0.84', 'version JSON update');
mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.84'", 'runtime version update');
process.exit(failed ? 1 : 0);

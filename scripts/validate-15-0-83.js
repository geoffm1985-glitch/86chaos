#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const scripts = [
  'validate-auth-hotfix.js',
  'validate-repair.js',
  'validate-rules.js',
  'validate-performance-split.js',
  'validate-python-ops-restore.js',
  'validate-python-auth-fallback.js',
  'validate-python-ops-fallback-fix.js'
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
mustContain('src/features/hr.jsx', 'MANUAL_ORIGINAL_MAX_BYTES = 50 * 1024 * 1024', '50MB training manual compression guard');
mustContain('src/features/hr.jsx', 'CompressionStream', 'browser gzip compression');
mustContain('src/features/hr.jsx', 'max-w-4xl', 'larger onboarding modal');
mustContain('src/features/operations.jsx', 'AI Ordering', 'AI Ordering label');
mustContain('src/features/operations.jsx', 'prepFocus', 'Prep Plan navigation focus');
mustContain('src/core/appCore.js', '15.0.83-precision-radar', 'precision menu dependency radar');
mustContain('api/_firebase-project-admin.js', 'FIREBASE_TEST_SERVICE_ACCOUNT_JSON', 'expanded test service-account alias');
mustContain('api/_firebase-project-admin.js', 'FIREBASE_PROD_SERVICE_ACCOUNT_JSON', 'expanded production service-account alias');
mustContain('storage.rules', 'application/gzip', 'compressed manual storage rule');
mustContain('firestore.rules', '50 * 1024 * 1024', 'manual original size metadata rule');
process.exit(failed ? 1 : 0);

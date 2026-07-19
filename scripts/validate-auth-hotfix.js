#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [
  {
    name: 'Current version marker is synced',
    pass: () => read('src/core/appCore.js').includes("CURRENT_VERSION = '15.0.77'") && JSON.parse(read('public/version.json')).version === '15.0.77' && JSON.parse(read('package.json')).version === '15.0.77'
  },
  {
    name: 'Preview Firebase selection ignores generic REACT_APP_FIREBASE_PROJECT_ID',
    pass: () => {
      const core = read('src/core/appCore.js');
      return core.includes("REACT_APP_FIREBASE_ACTIVE_PROJECT_ID") && !core.includes("env('REACT_APP_FIREBASE_ACTIVE_PROJECT_ID', env('REACT_APP_FIREBASE_PROJECT_ID'") && core.includes("currentHostname.endsWith('.vercel.app')");
    }
  },
  {
    name: 'Login button has busy guard and timeout',
    pass: () => {
      const auth = read('src/features/auth.jsx');
      return auth.includes('isLoginBusy') && auth.includes('withLoginTimeout') && auth.includes('Firebase Auth network request failed') && auth.includes('disabled={isLoginBusy || workspaceLoading}');
    }
  },
  {
    name: 'Firebase service account key handling still supports FIREBASE_SERVICE_ACCOUNT_KEY',
    pass: () => {
      const admin = read('api/_firebase-project-admin.js');
      return admin.includes('FIREBASE_SERVICE_ACCOUNT_KEY') && admin.includes('parseJsonCredential');
    }
  }
];
let failed = false;
for (const check of checks) {
  let ok = false;
  try { ok = Boolean(check.pass()); } catch (_) { ok = false; }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);

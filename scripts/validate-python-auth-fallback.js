#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const required = [
  'api/_python-auth-fallback.js',
  'api/python-ops-intelligence.js',
  'api/python-order-intelligence.js',
  'api/_firebase-project-admin.js'
];
let failed = false;
for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`Missing ${rel}`);
    failed = true;
  }
}
const fallback = fs.readFileSync(path.join(root, 'api/_python-auth-fallback.js'), 'utf8');
const ops = fs.readFileSync(path.join(root, 'api/python-ops-intelligence.js'), 'utf8');
const order = fs.readFileSync(path.join(root, 'api/python-order-intelligence.js'), 'utf8');
const projectAdmin = fs.readFileSync(path.join(root, 'api/_firebase-project-admin.js'), 'utf8');
const checks = [
  [fallback.includes('verified-token-payload-only'), 'fallback auth helper supports verified-token payload mode'],
  [fallback.includes('verifyTrustedFirebaseIdToken'), 'fallback verifies Firebase token with trusted public keys'],
  [ops.includes('authorizePythonPayloadRoute'), 'ops route uses shared Python auth fallback'],
  [ops.includes('if (ctx.db)'), 'ops route only writes audit logs when Firestore Admin is available'],
  [order.includes('authorizePythonPayloadRoute'), 'order route uses shared Python auth fallback'],
  [order.includes('if (ctx.db)'), 'order route only writes audit logs when Firestore Admin is available'],
  [projectAdmin.includes('FIREBASE_SERVICE_ACCOUNT_KEY_TEST'), 'test credential alias support includes legacy TEST suffix'],
  [projectAdmin.includes('FIREBASE_ADMIN_CREDENTIALS_PRODUCTION'), 'production credential alias support includes admin credentials suffix']
];
for (const [ok, label] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);

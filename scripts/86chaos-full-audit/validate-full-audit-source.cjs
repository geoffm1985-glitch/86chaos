#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, 'test-results');
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, '86chaos-full-audit-source-check.json');
const failures = [];
const warnings = [];
function read(rel) { const p = path.join(root, rel); if (!fs.existsSync(p)) { failures.push(`${rel} missing`); return ''; } return fs.readFileSync(p, 'utf8'); }
function json(rel) { try { return JSON.parse(read(rel)); } catch (e) { failures.push(`${rel} is not valid JSON: ${e.message}`); return {}; } }
function assert(cond, msg) { if (!cond) failures.push(msg); }
function warn(cond, msg) { if (!cond) warnings.push(msg); }

const pkg = json('package.json');
const lock = json('package-lock.json');
const versionJson = json('public/version.json');
const appCore = read('src/core/appCore.js');
const schedule = read('src/features/schedule.jsx');
const management = read('src/features/management.jsx');
const vercel = json('vercel.json');
const firebaseJson = json('firebase.json');
const lockText = read('package-lock.json');
const allSource = [appCore, schedule, management, read('src/App.js'), read('src/components/Modal.js')].join('\n');

const appVersion = pkg.version;
assert(Boolean(appVersion), 'package.json version missing');
assert(versionJson.version === appVersion, `public/version.json version ${versionJson.version} does not match package.json ${appVersion}`);
assert(lock.version === appVersion, `package-lock root version ${lock.version} does not match package.json ${appVersion}`);
assert(lock.packages && lock.packages[''] && lock.packages[''].version === appVersion, `package-lock packages[""].version does not match package.json ${appVersion}`);
assert(new RegExp(`CURRENT_VERSION\\s*=\\s*['\"]${String(appVersion).replace(/\./g, '\\.')}['\"]`).test(appCore), `CURRENT_VERSION does not equal ${appVersion}`);
assert(!/@types\/yargs-[0-9]+\.[0-9]+\.[0-9]+\.tgz/i.test(lockText), 'package-lock has fake @types/yargs app-version tarball');
assert(!Object.entries(lock.packages || {}).some(([name, meta]) => name && name !== '' && /^node_modules\//.test(name) && String(meta?.version || '') === appVersion && !/86chaos/i.test(name)), 'Nested dependency appears to have the app version');

for (const needle of ['chaos-test-d1601', 'cheers-34b8d', 'REACT_APP_TEST_FIREBASE_API_KEY', 'REACT_APP_PROD_FIREBASE_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY']) {
  assert(allSource.includes(needle) || read('api/_firebase-project-admin.js').includes(needle), `Expected Firebase/config safety marker missing: ${needle}`);
}
assert(!/["']private_key["']\s*:\s*["']-----BEGIN/i.test(allSource + lockText), 'Hardcoded private key value found in source/package-lock');
assert(!/unterminated/i.test(schedule), 'schedule.jsx contains literal word unterminated, check previous Vercel failure area');
assert(/INVALID TIME|Invalid time|CHECK TIME RANGE|invalid time/i.test(schedule), 'Schedule source should visibly flag invalid time ranges');
assert(/Online Now|Recently Active|Active Today|Last Seen/i.test(management), 'Presence board should have honest status labels');
assert(!/id:\s*['"]branding['"]\s*,\s*label:\s*['"]Branding\s*\/\s*Display['"]/i.test(management), 'System Administrator nav still exposes Branding / Display label');
assert(/special_event|Events \/ staff up|event/i.test(schedule), 'Schedule Builder source should include scheduled event visibility');
assert(/keyboard|focus|activeElement|modal/i.test(read('src/components/Modal.js') + schedule), 'Mobile modal/input focus protection is not obvious in source');

warn(pkg.scripts && pkg.scripts.build, 'package.json has no build script');
warn(vercel || firebaseJson, 'vercel.json/firebase.json missing or invalid');

const report = { ok: failures.length === 0, appVersion, generatedAt: new Date().toISOString(), failures, warnings, filesChecked: ['package.json','package-lock.json','public/version.json','src/core/appCore.js','src/features/schedule.jsx','src/features/management.jsx','src/App.js','src/components/Modal.js'] };
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error(`Full audit source guard failed. See ${reportPath}`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`Full audit source guard passed. See ${reportPath}`);

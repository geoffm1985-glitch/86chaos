
const fs = require('fs');
let failed = false;
function read(path) { return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''; }
function ok(cond, msg) { if (cond) console.log('OK  ', msg); else { console.error('FAIL', msg); failed = true; } }

ok(/"version"\s*:\s*"15\.1\.11"/.test(read('package.json')), 'package version is 15.1.11');
ok(/15\.1\.11/.test(read('public/version.json')), 'public version is 15.1.11');
ok(/CURRENT_VERSION\s*=\s*'15\.1\.11'/.test(read('src/core/appCore.js')), 'runtime CURRENT_VERSION is 15.1.11');
const admin = read('api/_firebase-project-admin.js');
ok(/GENERIC_SERVICE_ACCOUNT_ENV_NAMES/.test(admin), 'generic service account aliases are centralized');
ok(/FIREBASE_SERVICE_ACCOUNT_KEY/.test(admin), 'single existing Firebase service account key remains supported');
ok(/'FIREBASE_SERVICE_ACCOUNT'/.test(admin), 'common FIREBASE_SERVICE_ACCOUNT alias is supported');
ok(/discoveredCredentialEnvNames/.test(admin), 'credential loader can discover service account json aliases');
ok(!new RegExp('Redeploy after changing Vercel env' + ' vars').test(admin), 'old env split redeploy text removed from credential loader');
const dispatch = read('api/dispatch-reminders.js');
ok(/firebase_admin_unavailable_dispatch_skipped/.test(dispatch), 'dispatch route quietly skips if Admin is unavailable');
ok(!/Firebase Admin setup is missing/.test(dispatch), 'old dispatch error log string removed');
ok(!/console\.error\('\[dispatch-reminders\] Firebase Admin setup/.test(dispatch), 'dispatch no longer logs credential setup as an error');
ok(fs.existsSync('README_15_1_11_RELEASE_NOTES.md'), 'current release notes exist');
ok(fs.existsSync('QA_15_1_11_CREDENTIAL_LOADER_GUARD.md'), 'current QA checklist exists');
if (failed) process.exit(1);
console.log('15.1.11 Credential Loader Guard validation passed.');

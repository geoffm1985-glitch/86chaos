const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
let failed = false;
const checks = [
  ['package.json', /"version"\s*:\s*"15\.1\.8"/, 'package.json version 15.1.8'],
  ['public/version.json', /15\.1\.8/, 'public version 15.1.8'],
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.1\.8'/, 'runtime version 15.1.8'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceToday/, 'reference Today screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceSchedule/, 'reference Schedule screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferencePrep/, 'reference Prep screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceInventory/, 'reference Inventory screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceRecipes/, 'reference Recipes screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceFinancials/, 'reference Financials screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceSettings/, 'reference Settings screen exists'],
  ['src/features/reference.jsx', /export (?:const|function) ReferenceSystemAdmin/, 'reference System Admin screen exists'],
  ['src/App.js', /ReferenceToday/, 'App routes Today to reference UI'],
  ['src/App.js', /ReferenceSchedule/, 'App routes Schedule to reference UI'],
  ['src/App.js', /ReferenceFinancials/, 'App routes Financials to reference UI'],
  ['src/App.js', /label:\s*'Financials'/, 'Financials remains single top-level money menu item'],
  ['src/App.js', /label:\s*'Voice Command'/, 'Voice Command remains accessible in left nav'],
  ['src/App.js', /reference-top-action[\s\S]*86Voice Command/, 'desktop 86Voice button remains in top bar'],
  ['src/App.js', /title="Notifications"><Bell/, 'notification button uses bell icon'],
  ['src/features/auth.jsx', /reference-login-workspaces/, 'login workspace picker preview exists'],
  ['src/features/auth.jsx', /Why teams choose 86 Chaos/, 'login benefits panel exists'],
  ['src/styles.css', /15\.1\.8 exact mockup login/, 'login mockup CSS exists'],
  ['src/App.js', /ref-screen/, 'main reference CSS exists']
];
for (const [file, re, label] of checks) {
  let ok = false;
  try { ok = re.test(read(file)); } catch (_) { ok = false; }
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
const app = read('src/App.js');
const forbiddenTopLevel = ['Sales Import', 'Back Office', 'Maintenance', 'Reminders', 'Menu Intelligence'].filter(label => app.includes(`label: '${label}'`));
console.log(`${forbiddenTopLevel.length ? 'FAIL' : 'OK'} duplicate sidebar labels removed${forbiddenTopLevel.length ? ': ' + forbiddenTopLevel.join(', ') : ''}`);
if (forbiddenTopLevel.length) failed = true;
if (!exists('README_15_1_8_RELEASE_NOTES.md')) { console.error('FAIL release notes missing'); failed = true; } else console.log('OK release notes created');
if (!exists('QA_15_1_8_EXACT_MOCKUP_REDESIGN.md')) { console.error('FAIL QA checklist missing'); failed = true; } else console.log('OK QA checklist created');
if (exists('README_15_1_7_RELEASE_NOTES.md') || exists('QA_15_1_7_NAVIGATION_DEDUP_MOBILE_HEADER_FIX.md')) { console.error('FAIL old top-level release artifacts still present'); failed = true; } else console.log('OK old top-level release artifacts removed');
if (/FIREBASE_SERVICE_ACCOUNT_KEY\s*=/.test(read('package.json'))) { console.error('FAIL package must not contain Firebase service credentials'); failed = true; }
if (failed) process.exit(1);
console.log('15.1.8 Exact Mockup Redesign validation passed.');

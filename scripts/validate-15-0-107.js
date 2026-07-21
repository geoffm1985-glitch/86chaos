const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.0\.107'/, 'runtime version 15.0.107'],
  ['public/version.json', /15\.0\.107/, 'public version 15.0.107'],
  ['package.json', /"version"\s*:\s*"15\.0\.107"/, 'package version 15.0.107'],
  ['src/features/management.jsx', /system-admin-v107/, 'System Administrator v107 root class'],
  ['src/features/management.jsx', /admin107-command-board/, 'ground-up command board markup'],
  ['src/features/management.jsx', /admin107-category-strip/, 'category strip markup'],
  ['src/features/management.jsx', /admin107-tool-strip/, 'tool strip markup'],
  ['src/styles.css', /15\.0\.107 System Administrator ground-up console redesign/, 'v107 ground-up CSS'],
  ['src/styles.css', /#admin-left-nav,[\s\S]*?display:\s*none !important/, 'old left admin directory hidden in v107'],
  ['src/styles.css', /admin46-pagebar,[\s\S]*?display:\s*none !important/, 'old pagebar hidden in v107'],
  ['src/features/management.jsx', /label:'Automation Center'/, 'Automation Center label kept'],
  ['src/features/management.jsx', /Workspaces & Users/, 'Workspaces & Users category kept'],
  ['src/features/management.jsx', /Deployments & Releases/, 'Deployments & Releases category kept'],
  ['src/features/management.jsx', /Backups & Data Safety/, 'Backups & Data Safety category kept']
];
let failed = false;
for (const [file, re, label] of checks) {
  const ok = re.test(read(file));
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
const mgmt = read('src/features/management.jsx');
if (/id:'branding'|label:'Branding \/ Display'/.test(mgmt)) {
  console.error('FAIL Branding / Display still appears as a System Administrator tab.');
  failed = true;
} else {
  console.log('OK Branding / Display removed from System Administrator tabs.');
}
for (const old of ['README_15_0_106_RELEASE_NOTES.md','QA_15_0_106_SYSTEM_ADMIN_CONTENT_REBUILD.md']) {
  if (fs.existsSync(path.join(root, old))) {
    console.error(`FAIL old release/QA file still present: ${old}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('15.0.107 System Administrator ground-up console redesign validation passed.');

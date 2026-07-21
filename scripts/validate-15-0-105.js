const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.0\.105'/, 'runtime version 15.0.105'],
  ['public/version.json', /15\.0\.105/, 'public version 15.0.105'],
  ['src/features/management.jsx', /system-admin-v105/, 'System Administrator v105 class'],
  ['src/features/management.jsx', /Workspaces & Users/, 'new Workspaces & Users category'],
  ['src/features/management.jsx', /Deployments & Releases/, 'new Deployments & Releases category'],
  ['src/features/management.jsx', /Backups & Data Safety/, 'new Backups & Data Safety category'],
  ['src/features/management.jsx', /Push & Automation/, 'new Push & Automation category'],
  ['src/features/management.jsx', /Diagnostics & Support/, 'new Diagnostics & Support category'],
  ['src/features/management.jsx', /label:'Automation Center'/, 'renamed Automation Center nav label'],
  ['src/components/common.jsx', /drawer-search-input/, 'drawer search padding class'],
  ['src/components/common.jsx', /drawer-username/, 'drawer username truncation class'],
  ['src/styles.css', /15\.0\.105 lean System Administrator console overhaul/, 'v105 CSS overrides']
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
if (fs.existsSync(path.join(root, 'README_15_0_104_RELEASE_NOTES.md'))) {
  console.error('FAIL old 15.0.104 release notes still present.');
  failed = true;
}
if (failed) process.exit(1);
console.log('15.0.105 System Administrator console overhaul validation passed.');

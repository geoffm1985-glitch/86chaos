const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
let failed = false;
const checks = [
  ['package.json', /"version"\s*:\s*"15\.1\.9"/, 'package version 15.1.9'],
  ['public/version.json', /15\.1\.9/, 'public runtime version 15.1.9'],
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.1\.9'/, 'runtime CURRENT_VERSION 15.1.9'],
  ['src/App.js', /adminReferenceNavItems/, 'System Admin swaps to internal admin nav rail'],
  ['src/App.js', /--ref151-sidebar-w:\s*188px/, 'desktop sidebar locked to mockup width'],
  ['src/App.js', /ref151-header-h:\s*64px/, 'top command bar locked to mockup height'],
  ['src/App.js', /activeReferenceNavItems\.map/, 'sidebar uses active app/admin nav set'],
  ['src/App.js', /System Administrator' : 'Active workspace'/, 'top tool dropdown switches for System Admin'],
  ['src/features/reference.jsx', /React\.isValidElement\(action\)/, 'Panel action renders JSX actions safely'],
  ['src/features/reference.jsx', /onAction=\{\(\) => setActiveTab\?\.\('inventory'\)\}/, 'Today dashboard panel actions route without placeholders'],
  ['src/features/reference.jsx', /thumb-\$\{idx\}/, 'recipe catalog supports image-backed thumbnails'],
  ['src/features/reference.jsx', /recipe-photo-hero/, 'recipe hero supports image crop from mockup'],
  ['src/features/auth.jsx', /reference-login-workspaces/, 'login workspace picker mockup rail exists'],
  ['src/features/auth.jsx', /reference-system-health/, 'login system health panel exists'],
];
for (const [file, regex, label] of checks) {
  const body = read(file);
  if (!regex.test(body)) {
    console.error(`FAIL ${label}`);
    failed = true;
  } else {
    console.log(`OK ${label}`);
  }
}
for (let i = 0; i < 8; i += 1) {
  const file = `public/ref-food-${i}.jpg`;
  if (!exists(file)) {
    console.error(`FAIL missing ${file}`);
    failed = true;
  } else {
    console.log(`OK ${file}`);
  }
}
if (!exists('public/ref-food-hero.jpg')) {
  console.error('FAIL missing public/ref-food-hero.jpg');
  failed = true;
} else {
  console.log('OK public/ref-food-hero.jpg');
}
if (!exists('README_15_1_9_RELEASE_NOTES.md')) { console.error('FAIL release notes missing'); failed = true; } else console.log('OK release notes created');
if (!exists('QA_15_1_9_PIXEL_PRODUCTION_LOCK.md')) { console.error('FAIL QA checklist missing'); failed = true; } else console.log('OK QA checklist created');
if (failed) process.exit(1);
console.log('15.1.9 Pixel + Production Lock validation passed.');

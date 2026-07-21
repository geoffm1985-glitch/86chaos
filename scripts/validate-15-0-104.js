const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.0\.104'/, 'runtime version 15.0.104'],
  ['public/version.json', /15\.0\.104/, 'public version 15.0.104'],
  ['src/App.js', /serious-app-system-v104/, 'serious app design system shell class'],
  ['src/App.js', /15\.0\.104 Serious App Design System Cleanup/, 'release label not required but style layer present'],
  ['src/App.js', /Serious App Design System Cleanup/, 'inline design-system comments'],
  ['src/components/DrawerMenu.js', /app-drawer-v104/, 'drawer design cleanup class'],
  ['src/components/DrawerMenu.js', /drawer-menu-row/, 'drawer plain menu rows'],
  ['README_15_0_104_RELEASE_NOTES.md', /Serious App Design System Cleanup/, 'current release notes'],
  ['QA_15_0_104_SERIOUS_APP_DESIGN_SYSTEM_CLEANUP.md', /QA Checklist/, 'current QA checklist'],
];
let failed = false;
for (const [rel, re, label] of checks) {
  const ok = re.test(read(rel));
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
}
if (fs.existsSync(path.join(root, 'README_15_0_103_RELEASE_NOTES.md'))) {
  console.error('✗ old release notes should not remain');
  failed = true;
}
if (failed) process.exit(1);
console.log('15.0.104 serious app design system cleanup validation passed.');

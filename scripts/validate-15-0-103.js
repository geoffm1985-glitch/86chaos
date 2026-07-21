const fs = require('fs');
const checks = [
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.0\.103'/],
  ['public/version.json', /15\.0\.103/],
  ['src/App.js', /15\.0\.103 chrome purge/i],
  ['src/styles.css', /15\.0\.103 Chrome Purge/i],
  ['src/styles.css', /app-drawer-readable button[\s\S]*background:\s*transparent/i],
  ['src/components/common.jsx', /Search menu, help, tools/],
  ['src/components/common.jsx', /text-\[\#D4A381\]/],
  ['README_15_0_103_RELEASE_NOTES.md', /Navigation Chrome Purge/],
  ['QA_15_0_103_NAVIGATION_CHROME_PURGE.md', /QA Checklist/],
];
let failed = false;
for (const [file, pattern] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  if (!pattern.test(text)) {
    console.error(`Validation failed: ${file} did not match ${pattern}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('15.0.103 navigation chrome purge validation passed.');

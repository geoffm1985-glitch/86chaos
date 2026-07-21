const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.0\.101'/],
  ['public/version.json', /"version"\s*:\s*"15\.0\.101"/],
  ['package.json', /"version"\s*:\s*"15\.0\.101"/],
  ['src/App.js', /premium-app-shell/],
  ['src/App.js', /native-command-bar/],
  ['src/App.js', /activeScreenTitle/],
  ['src/features/inventory.jsx', /premium-inventory/],
  ['src/features/inventory.jsx', /inventory-count-row/],
  ['src/styles.css', /15\.0\.101 Premium App UI Polish/],
  ['src/styles.css', /premium-app-shell/],
  ['src/styles.css', /native-command-bar/],
  ['README_15_0_101_RELEASE_NOTES.md', /Premium App UI Polish/],
  ['QA_15_0_101_PREMIUM_APP_UI_POLISH.md', /QA Checklist/],
];

let failed = 0;
for (const [file, pattern] of checks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${file}`);
    failed += 1;
    continue;
  }
  const text = read(file);
  if (!pattern.test(text)) {
    console.error(`Failed check ${pattern} in ${file}`);
    failed += 1;
  }
}

for (const oldFile of ['README_15_0_100_RELEASE_NOTES.md', 'QA_15_0_100_DESKTOP_APP_SHELL_CORRECTION.md']) {
  if (fs.existsSync(path.join(root, oldFile))) {
    console.error(`Old release/QA file still present: ${oldFile}`);
    failed += 1;
  }
}

if (failed) process.exit(1);
console.log('15.0.101 premium app UI polish validation passed.');

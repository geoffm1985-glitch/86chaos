const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checks = [
  ['src/core/appCore.js', /CURRENT_VERSION = '15\.0\.102'/],
  ['public/version.json', /15\.0\.102/],
  ['src/App.js', /15\.0\.102 desktop shell correction/],
  ['src/App.js', /width: calc\(100vw - 80px\)/],
  ['src/styles.css', /15\.0\.102 Desktop Shell Clipping \+ Header Chrome Cleanup/],
  ['src/styles.css', /native-version-pill[\s\S]*background: transparent/],
  ['README_15_0_102_RELEASE_NOTES.md', /Desktop Shell Clipping/],
  ['QA_15_0_102_DESKTOP_SHELL_CLIPPING_HEADER_CHROME.md', /QA Checklist/],
];

for (const [file, regex] of checks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
  const text = fs.readFileSync(full, 'utf8');
  if (!regex.test(text)) {
    console.error(`Validation failed for ${file}: ${regex}`);
    process.exit(1);
  }
}

console.log('15.0.102 desktop shell clipping/header chrome validation passed.');

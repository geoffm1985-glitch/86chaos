const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checks = [
  ['package.json', /"version"\s*:\s*"16\.0\.64"/],
  ['package-lock.json', /"version"\s*:\s*"16\.0\.64"/],
  ['public/version.json', /"version"\s*:\s*"16\.0\.64"/],
  ['api/_version.js', /16\.0\.64/],
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'16\.0\.64'/]
];
let ok = true;
for (const [file, pattern] of checks) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (!pattern.test(text)) {
    console.error(`Version check failed: ${file}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('16.0.64 version wiring validated.');

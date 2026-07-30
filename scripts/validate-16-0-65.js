const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checks = [
  ['package.json', /"version"\s*:\s*"16\.0\.65"/],
  ['package-lock.json', /"version"\s*:\s*"16\.0\.65"/],
  ['public/version.json', /"version"\s*:\s*"16\.0\.65"/],
  ['api/_version.js', /16\.0\.65/],
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'16\.0\.65'/]
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
console.log('16.0.65 version wiring validated.');

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`✘ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ ${message}`);
  }
};

const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const appCore = read('src/core/appCore.js');
const vercel = JSON.parse(read('vercel.json'));
const management = read('src/features/management.jsx');
const csp = vercel.headers?.[0]?.headers?.find(h => h.key === 'Content-Security-Policy')?.value || '';
const frameSrc = (csp.match(/frame-src\s+([^;]+)/) || [])[1] || '';

assert(pkg.version === '16.0.4', 'package.json version is 16.0.4');
assert(version.version === '16.0.4' && version.build === '16.0.4', 'public/version.json is 16.0.4');
assert(appCore.includes("CURRENT_VERSION = '16.0.4'"), 'CURRENT_VERSION is 16.0.4');
assert(pkg.scripts.test === 'node scripts/validate-16-0-4.js' && pkg.scripts['test:ci'] === 'node scripts/validate-16-0-4.js', 'npm test and test:ci point to current validator');
assert(/https:\/\/\*\.firebaseapp\.com/.test(frameSrc), 'CSP frame-src allows Firebase Auth firebaseapp.com iframe domain');
assert(/https:\/\/\*\.web\.app/.test(frameSrc), 'CSP frame-src allows Firebase web.app iframe domain');
assert(/https:\/\/\*\.firebaseio\.com/.test(csp), 'CSP still allows RTDB firebaseio domains');
assert(/https:\/\/\*\.firebasedatabase\.app/.test(csp), 'CSP still allows RTDB firebasedatabase.app domains');
assert(/const SimpleTable = \(\{ headers = \[\], rows = \[\]/.test(management), 'shared SimpleTable component is available outside Financial Center');
assert((management.match(/<SimpleTable/g) || []).length >= 8, 'Back Office/Financial table surfaces still render through SimpleTable');

if (process.exitCode) process.exit(process.exitCode);
console.log('16.0.4 Firebase frame CSP and Back Office SimpleTable validator passed.');

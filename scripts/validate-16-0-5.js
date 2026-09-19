const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
};
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const lock = JSON.parse(read('package-lock.json'));
const appCore = read('src/core/appCore.js');
const management = read('src/features/management.jsx');
const styles = read('src/styles.css');
const vercel = read('vercel.json');
assert(pkg.version === '16.0.5', 'package.json version is 16.0.5');
assert(lock.version === '16.0.5' && lock.packages?.['']?.version === '16.0.5', 'package-lock.json version is 16.0.5');
assert(version.version === '16.0.5' && version.build === '16.0.5', 'public/version.json is 16.0.5');
assert(appCore.includes("CURRENT_VERSION = '16.0.5'"), 'CURRENT_VERSION is 16.0.5');
assert(pkg.scripts.test === 'node scripts/validate-16-0-5.js' && pkg.scripts['test:ci'] === 'node scripts/validate-16-0-5.js', 'npm test and test:ci point to current validator');
assert(vercel.includes('https://*.firebaseio.com') && vercel.includes('https://*.firebasedatabase.app') && vercel.includes('https://*.firebaseapp.com'), 'Firebase RTDB/Auth CSP allowances are preserved');
assert(management.includes('const SimpleTable =') || management.includes('function SimpleTable'), 'Back Office SimpleTable helper remains present');
assert(management.includes("label:'Online / Last Seen'") && management.includes('Last online is shown right here in People Directory'), 'System Administrator exposes Online / Last Seen clearly');
assert(management.includes('getUserPresenceSummary') && management.includes('Refresh Online / Last Seen'), 'People Directory rows can show last online, exact timestamp, device, and active tab');
assert(!management.includes("id:'branding', label:'Branding / Display'"), 'System Administrator Branding / Display navigation tab is removed');
assert(styles.includes('background: linear-gradient(135deg, #111820 0%, #0B0E11 62%, #16221d 100%)') && styles.includes('color: #f7d7bd'), 'Legal retention setup uses readable dark styling instead of the old pale background');
if (process.exitCode) process.exit(process.exitCode);
console.log('16.0.5 System Administrator presence and retention readability validator passed.');

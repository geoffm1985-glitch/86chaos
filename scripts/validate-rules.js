const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = ['firestore.rules', 'storage.rules'];
let failed = 0;
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const opens = (text.match(/\{/g) || []).length;
  const closes = (text.match(/\}/g) || []).length;
  if (opens !== closes) {
    console.error(`FAIL ${file}: brace mismatch ${opens} open vs ${closes} close.`);
    failed += 1;
  } else {
    console.log(`PASS ${file}: brace count balanced (${opens}).`);
  }
  if (/allow create: if signedIn\(\);/.test(text)) {
    console.error(`FAIL ${file}: broad signed-in create rule found.`);
    failed += 1;
  }
}
if (failed) process.exit(1);

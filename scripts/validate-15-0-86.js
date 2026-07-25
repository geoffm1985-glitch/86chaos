const fs = require('fs');

const mustContain = (file, text, label) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${label} missing from ${file}`);
  }
  console.log(`✓ ${label}`);
};

mustContain('vercel.json', 'script-src-elem', 'explicit script-src-elem CSP directive');
mustContain('vercel.json', 'https://*.vercel.live', 'Vercel live wildcard CSP allowance');
mustContain('vercel.json', 'https://*.google.com', 'Google reCAPTCHA wildcard connect/frame allowance');
mustContain('src/core/appCore.js', 'Firestore index pending', 'index-pending warnings instead of console errors');
mustContain('src/core/aiOrderAssistant.js', 'categoryOnly', 'expanded invoice/OCR noise filtering');
mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.86'", 'current version 15.0.86');
console.log('15.0.86 validation passed.');

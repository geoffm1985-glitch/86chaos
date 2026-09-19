const fs = require('fs');

const mustContain = (file, text, label) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${label} missing from ${file}`);
  }
  console.log(`✓ ${label}`);
};

mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.88'", 'current version 15.0.88');
mustContain('src/core/appCore.js', 'rawTestAppCheckSiteKey', 'test App Check site-key split');
mustContain('src/core/appCore.js', 'genericAppCheckIgnored', 'generic App Check ignored on testing preview');
mustContain('src/features/auth.jsx', 'loadLoginBootstrapFromServer', 'server login bootstrap fallback');
mustContain('src/features/auth.jsx', 'recoveredFromAuthState', 'Firebase Auth state recovery');
mustContain('api/login-bootstrap.js', 'workspaceMembers-email', 'server membership by email check');
mustContain('api/login-bootstrap.js', 'uidMismatch', 'UID mismatch diagnostic');
mustContain('public/version.json', '15.0.88', 'public version 15.0.88');
mustContain('vercel.json', 'script-src-elem', 'explicit script-src-elem CSP directive retained');
mustContain('src/core/aiOrderAssistant.js', 'categoryOnly', 'invoice/OCR noise filtering retained');
console.log('15.0.88 validation passed.');

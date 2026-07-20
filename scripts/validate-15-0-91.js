const fs = require('fs');

const mustContain = (file, text, label) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${label} missing from ${file}`);
  }
  console.log(`✓ ${label}`);
};

mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.91'", 'current version 15.0.91');
mustContain('src/core/appCore.js', 'rawTestAppCheckSiteKey', 'test App Check site-key split');
mustContain('src/core/appCore.js', 'genericAppCheckIgnored', 'generic App Check ignored on testing preview');
mustContain('src/features/auth.jsx', 'loadLoginBootstrapFromServer', 'server login bootstrap fallback');
mustContain('src/features/auth.jsx', 'recoveredFromAuthState', 'Firebase Auth state recovery');
mustContain('api/login-bootstrap.js', 'workspaceMembers-email', 'server membership by email check');
mustContain('api/login-bootstrap.js', 'uidMismatch', 'UID mismatch diagnostic');
mustContain('public/version.json', '15.0.91', 'public version 15.0.91');
mustContain('vercel.json', 'script-src-elem', 'explicit script-src-elem CSP directive retained');
mustContain('vercel.json', "img-src 'self' data: blob: https://www.google.com", 'Google cleardot image CSP allowance');
mustContain('src/App.js', "'time-clock': 'published'", 'legacy time-clock route alias');
mustContain('src/App.js', "'manager-brief': 'today'", 'legacy manager-brief route alias');
mustContain('src/App.js', "'help-center': 'help'", 'legacy help-center route alias');
mustContain('src/core/aiOrderAssistant.js', 'categoryOnly', 'invoice/OCR noise filtering retained');
mustContain('api/python-automation-run.js', 'restaurantAdminAlerts', 'restaurant owner/admin alert destination');
mustContain('api/python-automation-run.js', 'systemAdminCanApply: false', 'system admin cannot apply Python recommendations');
mustContain('api/python-automation-run.js', 'Send owner/admin alerts to the restaurant', 'owner/admin alert safety policy');
mustContain('src/features/operations.jsx', 'Owner/Admin Alerts', 'owner/admin alerts visible in Manager Brief');
mustContain('firestore.rules', 'match /restaurantAdminAlerts/{alertId}', 'restaurant admin alert rules');

console.log('15.0.91 validation passed.');

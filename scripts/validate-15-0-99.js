const fs = require('fs');

const mustContain = (file, text, label) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`${label} missing from ${file}`);
  }
  console.log(`✓ ${label}`);
};

mustContain('src/core/appCore.js', "CURRENT_VERSION = '15.0.99'", 'current version 15.0.99');
mustContain('public/version.json', '15.0.99', 'public version 15.0.99');
mustContain('src/App.js', 'native-app-shell', 'native app shell class');
mustContain('src/App.js', 'native-mobile-bottom-nav', 'mobile bottom navigation');
mustContain('src/App.js', 'native-desktop-rail', 'desktop shortcut rail');
mustContain('src/App.js', 'native-route-loader', 'native route loading skeleton');
mustContain('public/manifest.json', 'standalone', 'PWA standalone display retained');
mustContain('public/manifest.json', '/?tab=today', 'app-first start URL');
mustContain('api/dispatch-reminders.js', 'users.fcmToken as the current canonical device token', 'push duplicate canonical token guard retained');
mustContain('public/firebase-messaging-sw.js', 'recentNotificationKeys', 'service-worker notification tag dedupe retained');
mustContain('src/features/management.jsx', 'Review-first accounting drafts', 'QuickBooks review-first wording retained');
mustContain('api/python-automation-run.js', 'systemAdminCanApply: false', 'System Admin/Python scan-and-alert guard retained');

console.log('15.0.99 validation passed.');

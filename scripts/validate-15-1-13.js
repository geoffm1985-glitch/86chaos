const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
let failed = false;
const check = (file, regex, label) => {
  const body = read(file);
  if (!regex.test(body)) { console.error(`FAIL ${label}`); failed = true; }
  else console.log(`OK ${label}`);
};
check('package.json', /"version"\s*:\s*"15\.1\.13"/, 'package version 15.1.13');
check('public/version.json', /15\.1\.13/, 'public runtime version 15.1.13');
check('src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.1\.13'/, 'runtime CURRENT_VERSION 15.1.13');
check('src/App.js', /mobile-clock-schedule-quick/, 'mobile Time Clock and Schedule quick action strip exists');
check('src/App.js', /id:\s*'mobile-clock'[^\n]+route:\s*'published'/, 'mobile bottom nav has quick Clock route');
check('src/App.js', /id:\s*'mobile-schedule'[^\n]+route:\s*'schedule'/, 'mobile bottom nav has quick Schedule route');
check('src/App.js', /ref-live-bars/, 'live bar graph styles exist');
check('src/App.js', /ref-empty-live/, 'live empty state styles exist');
check('src/App.js', /overflow-x:\s*clip/, 'mobile page overflow is clipped');
check('src/App.js', /events=\{events\} sales=\{sales\} timePunches=\{timePunches\}/, 'schedule routes receive live sales/time punch data');
check('src/App.js', /prepItems=\{prepItems\} tasks=\{tasks\} inventoryItems=\{inventoryItems\}/, 'prep route receives live prep/task/inventory data');
check('src/App.js', /<TabInventory[^>]+inventoryItems=\{inventoryItems\}/, 'inventory route receives live inventory data');
check('src/App.js', /activeAdminSection/, 'System Admin left rail tracks a real active section');
check('src/App.js', /admin-exit[\s\S]*Exit to App/, 'System Admin rail includes Exit to App');
check('src/App.js', /reference-voice-action/, 'top 86Voice button has enlarged copper action styling');
check('src/App.js', /chaos-open-voice-dock/, 'top microphone dispatches real 86Voice dock open event');
check('src/App.js', /<VoiceCommandDock[^>]+appUser=\{liveAppUser\}/, 'real 86Voice dock is mounted in app shell');
check('src/features/reference.jsx', /dailySeries/, 'reference layer computes daily live series');
check('src/features/reference.jsx', /normalizePoints/, 'reference layer renders chart points from live arrays');
check('src/features/reference.jsx', /hasSeriesData/, 'reference layer supports live-empty graph states');
check('src/features/reference.jsx', /useLiveCollection\('(?:burnLogs|wasteLogs)'/, 'burn log panels read live burn/waste logs');
check('src/features/reference.jsx', /useLiveCollection\('(?:menuScans|menuIntelligenceScans)'/, 'menu scan panels read live menu scans');
check('src/features/reference.jsx', /useLiveCollection\('auditLogs'/, 'admin timeline reads live audit logs');
check('src/features/reference.jsx', /activeAdminSection/, 'System Admin screen renders selected admin sections');
check('src/features/reference.jsx', /goAdminSection/, 'System Admin buttons switch to real section views');
check('src/features/reference.jsx', /Emergency Read-Only[^]*Security Center/, 'Emergency Read-Only quick action routes to Security Center review');
check('src/components/common.jsx', /chaos-open-voice-dock/, '86Voice dock listens for header microphone open event');
check('src/features/reference.jsx', /No live (?:sales|graph|sales ledger) (?:records|data|rows)/, 'no fake sales chart fallback');
check('src/features/reference.jsx', /No live inventory records yet/, 'no fake inventory fallback');
if (!exists('README_15_1_13_LIVE_GRAPHS_MOBILE_LOCK.md')) { console.error('FAIL current release notes missing'); failed = true; } else console.log('OK current release notes created');
if (!exists('QA_15_1_13_LIVE_GRAPHS_MOBILE_LOCK.md')) { console.error('FAIL current QA checklist missing'); failed = true; } else console.log('OK current QA checklist created');
for (const rel of ['api/dispatch-reminders.js', 'api/_firebase-project-admin.js', 'api/_chaos-admin.js']) {
  const body = read(rel);
  for (const needle of [
    ['Firebase Admin setup', ' is missing or invalid'].join(''),
    ['No server credential', ' is configured', ' for Firebase project'].join(''),
    ['Use FIREBASE_', 'SERVICE_ACCOUNT_KEY', ' with the complete service-account JSON', ' for the active deployment project'].join(''),
    ['Redeploy after changing', ' Vercel env vars'].join('')
  ]) {
    if (body.includes(needle)) { console.error(`FAIL forbidden old Firebase Admin error string remains in ${rel}: ${needle}`); failed = true; }
  }
}
const dispatchBody = read('api/dispatch-reminders.js');
if (/console\.error\(\s*['"]\[dispatch-reminders\] Firebase Admin setup/.test(dispatchBody)) {
  console.error('FAIL dispatch-reminders still logs old setup error'); failed = true;
} else console.log('OK dispatch-reminders old setup error not present');
const apiChangedMarker = /15\.1\.13|live graph|mobile layout|mobile-clock-schedule-quick/;
for (const rel of ['api/dispatch-reminders.js', 'api/_firebase-project-admin.js', 'api/_chaos-admin.js']) {
  if (apiChangedMarker.test(read(rel))) { console.error(`FAIL ${rel} appears touched by 15.1.13 UI pass`); failed = true; }
  else console.log(`OK ${rel} untouched by UI pass markers`);
}
if (failed) process.exit(1);
console.log('15.1.13 Live Graph + Mobile Layout Lock validation passed.');

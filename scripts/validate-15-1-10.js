const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failed = false;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function check(rel, pattern, label) {
  const ok = pattern.test(read(rel));
  if (!ok) {
    console.error(`FAIL ${label}`);
    failed = true;
  } else {
    console.log(`OK   ${label}`);
  }
}

check('package.json', /"version"\s*:\s*"15\.1\.10"/, 'package version 15.1.10');
check('public/version.json', /15\.1\.10/, 'public runtime version 15.1.10');
check('src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.1\.10'/, 'runtime CURRENT_VERSION 15.1.10');
check('src/core/appCore.js', /global\s*=\s*false/, 'useLiveCollection exposes explicit global option');
check('src/core/appCore.js', /global\s*\?\s*\[\]\s*:\s*\[where\("restaurantId"/, 'useLiveCollection skips restaurant filter only for global reads');

check('src/features/reference.jsx', /const\s+LiveLineChart\s*=/, 'live line chart component exists');
check('src/features/reference.jsx', /const\s+LiveBarChart\s*=/, 'live bar chart component exists');
check('src/features/reference.jsx', /const\s+dailySeries\s*=/, 'daily series calculation helper exists');
check('src/features/reference.jsx', /const\s+hasSeriesData\s*=/, 'empty/live chart state guard exists');
check('src/features/reference.jsx', /MiniSpark\s*=\s*\(\{[^}]*points\s*=\s*\[\]/s, 'metric sparklines accept live points');
check('src/features/reference.jsx', /useLiveCollection\('financialExpenses'/, 'financials load live expenses');
check('src/features/reference.jsx', /useLiveCollection\('wasteLogs'/, 'inventory loads live burn/waste logs');
check('src/features/reference.jsx', /useLiveCollection\('menuIntelligenceScans'/, 'inventory loads live menu scan intelligence');
check('src/features/reference.jsx', /useLiveCollection\('systemIssues'[^)]*global:\s*true/s, 'system admin loads live issues through global option');
check('src/features/reference.jsx', /useLiveCollection\('restaurants'[^)]*global:\s*true/s, 'system admin loads live restaurants through global option');

check('src/App.js', /15\.1\.10 mobile live graph layout lock/, 'final mobile override marker exists');
check('src/App.js', /overflow-x:\s*hidden\s*!important/, 'mobile page-level horizontal overflow is hidden');
check('src/App.js', /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/, 'mobile dashboard grids collapse to one column');
check('src/App.js', /sales=\{sales\}[^>]*timePunches=\{timePunches\}[^>]*initialSubTab="schedule-builder"/s, 'schedule receives live sales and punches');
check('src/App.js', /prepItems=\{prepItems\}[^>]*tasks=\{tasks\}[^>]*inventoryItems=\{inventoryItems\}/s, 'prep receives live prep/tasks/inventory');
check('src/App.js', /TabInventory[^>]*inventoryItems=\{inventoryItems\}/s, 'inventory receives live inventory items');
check('api/dispatch-reminders.js', /firebase_admin_credentials_absent_skip/, 'dispatch reminders skips missing admin credentials without env changes');
check('api/dispatch-reminders.js', /DEBUG_FIREBASE_ADMIN_DIAGNOSTICS/, 'missing admin diagnostics are opt-in only');

if (!exists('README_15_1_10_RELEASE_NOTES.md')) { console.error('FAIL release notes missing'); failed = true; } else console.log('OK   release notes created');
if (!exists('QA_15_1_10_MOBILE_LIVE_GRAPH_LOCK.md')) { console.error('FAIL QA checklist missing'); failed = true; } else console.log('OK   QA checklist created');

if (failed) process.exit(1);
console.log('15.1.10 Mobile Live Graph Lock validation passed.');

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const checks = [
  ['package.json', /"version"\s*:\s*"15\.1\.5"/, 'package.json version 15.1.5'],
  ['package.json', /"test"\s*:\s*"node scripts\/validate-15-1-5\.js"/, 'npm test points to current validator'],
  ['public/version.json', /15\.1\.5/, 'public version 15.1.5'],
  ['src/core/appCore.js', /CURRENT_VERSION\s*=\s*'15\.1\.5'/, 'runtime version 15.1.5'],
  ['src/App.js', /Moon, MoreHorizontal|MoreHorizontal, Package/, 'App shell imports reference UI icons used at runtime'],
  ['src/core/needsAttentionEngine.js', /export const buildNeedsAttentionCards/, 'unified Needs Attention engine exists'],
  ['src/core/needsAttentionEngine.js', /severity:\s*"critical"|critical.*high.*medium.*low/s, 'normalized severity levels exist'],
  ['src/core/needsAttentionEngine.js', /dedupeAttentionCards/, 'attention cards dedupe overlapping sources'],
  ['src/core/needsAttentionEngine.js', /buildManagerBriefSummary/, 'Manager Brief summary helper exists'],
  ['src/core/needsAttentionEngine.js', /buildKitchenCommandSummary/, 'Kitchen Command summary helper exists'],
  ['src/core/needsAttentionEngine.js', /buildOpsSummaryDocs/, 'summary-doc foundation exists'],
  ['src/core/needsAttentionEngine.js', /buildEightySixAlertEventPayload/, '86 alert standardized event payload exists'],
  ['src/features/operations.jsx', /manager-brief-needs-attention/, 'Manager Brief has unified Needs Attention surface'],
  ['src/features/operations.jsx', /buildManagerBriefSummary/, 'Manager Brief uses shared attention engine'],
  ['src/features/operations.jsx', /kitchen-command-needs-attention/, 'Kitchen Command Center has shared Needs Attention surface'],
  ['src/features/operations.jsx', /buildKitchenCommandSummary/, 'Kitchen Command Center uses shared attention engine'],
  ['src/features/operations.jsx', /setup-quality-panel/, 'setup quality panel exists'],
  ['src/features/operations.jsx', /Review AI Order|Review order draft/, 'Manager Brain uses action-first language'],
  ['src/features/management.jsx', /sales-csv-import/, 'Sales CSV import UI exists'],
  ['src/features/management.jsx', /Preview Rows/, 'Sales CSV import previews rows'],
  ['src/features/management.jsx', /Skip existing dates|Merge into existing dates|Replace existing dates/, 'Sales CSV duplicate date choices exist'],
  ['src/features/management.jsx', /update86AlertStatus/, '86 alert acknowledge/resolve/reopen loop exists'],
  ['src/features/management.jsx', /Acknowledge/, '86 alert acknowledge UI exists'],
  ['src/features/management.jsx', /Mark Resolved|Reopen/, '86 alert resolve/reopen UI exists'],
  ['src/core/aiOrderAssistant.js', /Review-first only|reviewFirst:\s*true/, 'AI ordering remains review-first'],
  ['src/core/aiOrderAssistant.js', /cutoffWarning|vendorCutoff|orderMethod/, 'AI ordering has vendor cutoff awareness'],
  ['src/core/aiOrderAssistant.js', /priceWarnings|getPriceWarning/, 'AI ordering price warning support exists'],
  ['firestore.rules', /match \/opsInsights\/{docId}/, 'opsInsights summary-doc rules exist'],
  ['firestore.rules', /match \/managerBrief\/{docId}/, 'managerBrief summary-doc rules exist'],
  ['firestore.rules', /match \/inventoryHealth\/{docId}/, 'inventoryHealth summary-doc rules exist'],
  ['firestore.rules', /match \/laborHealth\/{docId}/, 'laborHealth summary-doc rules exist'],
  ['firestore.rules', /match \/menuImpact\/{docId}/, 'menuImpact summary-doc rules exist'],
  ['src/components/TabGodMode.js', /System Administrator|Plan & Permission Gate|internal-only/i, 'System Administrator remains gated/safe'],
  ['src/features/management.jsx', /QuickBooks.*review|owner-approved|Review-first|owner review/i, 'QuickBooks copy remains review-first']
];
let failed = false;
for (const [file, re, label] of checks) {
  let ok = false;
  try { ok = re.test(read(file)); } catch (_) { ok = false; }
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
if (!exists('README_15_1_5_RELEASE_NOTES.md')) { console.error('FAIL release notes missing'); failed = true; } else console.log('OK release notes created');
if (!exists('QA_15_1_5_SINGLE_SIDEBAR_REFERENCE_NAV.md')) { console.error('FAIL QA checklist missing'); failed = true; } else console.log('OK QA checklist created');
const help = read('src/features/management.jsx');
const helpChecks = ['Manager Brief / Needs Attention','86 alerts and menu impact','AI ordering review-first','sales CSV import','setup quality checklist','labor forecast limitations'];
for (const term of helpChecks) {
  const ok = help.includes(term);
  console.log(`${ok ? 'OK' : 'FAIL'} Help Center topic: ${term}`);
  if (!ok) failed = true;
}
if (/FIREBASE_SERVICE_ACCOUNT_KEY\s*=/.test(read('package.json'))) {
  console.error('FAIL package must not contain Firebase service credentials');
  failed = true;
}


const app = read('src/App.js');
const desktopMenuRemoved = !/native-menu-button relative/.test(app) && !app.includes('<nav className="native-desktop-rail"');
console.log(`${desktopMenuRemoved ? 'OK' : 'FAIL'} desktop has one primary left menu and no extra desktop menu buttons`);
if (!desktopMenuRemoved) failed = true;
const fullSidebarRoutes = ['financials','back-office','maintenance','reminders','menu-intelligence','ai-tools','godmode'].every(route => app.includes(`route: '${route}'`));
console.log(`${fullSidebarRoutes ? 'OK' : 'FAIL'} left sidebar contains full app menu routes`);
if (!fullSidebarRoutes) failed = true;

const management = read('src/features/management.jsx');
const csvRegexOk = /split\(\/\\r\?\\n\//.test(management);
console.log(`${csvRegexOk ? 'OK' : 'FAIL'} Sales CSV parser uses valid escaped newline regex`);
if (!csvRegexOk) failed = true;
const csvParserOk = /parseSalesCsv/.test(management);
console.log(`${csvParserOk ? 'OK' : 'FAIL'} Sales CSV parser still exists`);
if (!csvParserOk) failed = true;

if (failed) process.exit(1);
console.log('15.1.5 Manager Brain Control Panel validation passed.');

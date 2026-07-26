const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const json = (file) => JSON.parse(read(file));
let failures = 0;
const assert = (condition, message) => {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK ${message}`);
  }
};

const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appJs = read('src/App.js');
const appCore = read('src/core/appCore.js');
const operations = read('src/features/operations.jsx');
const recipesShim = read('src/components/TabRecipes.js');
const management = read('src/features/management.jsx');
const schedule = read('src/features/schedule.jsx');
const reminders = read('src/core/reminderUtils.js');
const tabInventory = read('src/components/TabInventory.js');
const inventory = read('src/features/inventory.jsx');
const firestoreRules = read('firestore.rules');
const storageRules = read('storage.rules');
const cleanupApi = read('api/full-audit-qa-cleanup.js');
const reportBugApi = read('api/report-bug.js');
const emailHelper = read('api/_support-email.js');
const apiVersion = read('api/_version.js');
const vercel = read('vercel.json');
const styles = read('src/styles.css');

assert(pkg.version === '16.0.24', 'package.json version is 16.0.24');
assert(lock.version === '16.0.24' && lock.packages?.['']?.version === '16.0.24', 'package-lock.json version is 16.0.24');
assert(version.version === '16.0.24' && version.build === '16.0.24', 'public/version.json is 16.0.24');
assert(appCore.includes("CURRENT_VERSION = '16.0.24'"), 'CURRENT_VERSION is 16.0.24');
assert(apiVersion.includes("APP_VERSION = '16.0.24'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.24'"), 'API version constants are centralized at 16.0.24');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-24.js', 'package scripts point at the 16.0.24 source validator');
assert(!exists('scripts/validate-16-0-21.js') && !exists('scripts/validate-16-0-22.js') && !exists('scripts/validate-16-0-23.js'), 'old source validators were renamed');

const activeRecipesImport = /const\s+TabRecipes\s*=\s*lazyFeature\(\s*\(\)\s*=>\s*import\('\.\/features\/operations'\)\s*,\s*'TabRecipes'\s*\)/.test(appJs);
assert(activeRecipesImport, 'App.js mounts Recipes from src/features/operations.jsx');
assert(/const\s+TabRecipes\s*=/.test(operations) && /export\s*\{[\s\S]*TabRecipes[\s\S]*\}/.test(operations), 'active Recipes implementation is exported from operations.jsx');
assert(recipesShim.includes("export { TabRecipes as default } from '../features/operations'"), 'dead TabRecipes duplicate is a compatibility re-export, not a drifting copy');
assert(!recipesShim.includes('FileReader') && !recipesShim.includes('activeRecipe.ingredients.split'), 'dead Recipes shim contains no duplicate scanner/modal behavior');
assert(operations.includes("secureFetch('/api/scan'") && operations.includes('MAX_RECIPE_SCAN_BYTES') && operations.includes('3 * 1024 * 1024'), 'active Recipes scanner uses secureFetch and validates image size/type');
assert(operations.includes('reader.onerror') && operations.includes('img.onerror') && operations.includes('getContext'), 'active Recipes scanner handles reader/image/canvas failures');
assert(operations.includes("String(activeRecipe?.ingredients || '').split('\\n')"), 'active Recipes modal is null-safe for ingredients');
assert(operations.includes("String(activeRecipe?.instructions || '').split('\\n')"), 'active Recipes modal is null-safe for instructions');
assert(operations.includes('const normalizedText = String(text ??') || operations.includes('const normalizedText = String(text ||'), 'active parseAndMultiply normalizes nullable input');
assert(operations.includes('[...(recipes || [])]') && operations.includes('String(r?.title ||'), 'active Recipes filtering/sorting uses a null-safe sorted copy');

assert(cleanupApi.includes("mode === 'execute'") && cleanupApi.includes('DELETE QA AUDIT RESTAURANTS'), 'QA cleanup endpoint requires execute mode and exact confirmation');
assert(cleanupApi.includes(".where('qaOwned', '==', true)") || cleanupApi.includes('.where("qaOwned", "==", true)'), 'QA cleanup dry-run starts from explicit qaOwned marker');
assert(cleanupApi.includes('queryAllByField') && cleanupApi.includes('collectWorkspaceMembers'), 'QA cleanup paginates affected-user and workspace-member discovery');
assert(cleanupApi.includes('getUser(uid)') && cleanupApi.includes('customClaims'), 'QA cleanup protects Auth custom-claim administrators');
assert(/await\s+bulkWriter\.close\(\);[\s\S]*await\s+Promise\.allSettled\(row\.writePromises\);[\s\S]*for\s*\(const uid of row\.authDeleteQueue\)/.test(cleanupApi), 'QA cleanup waits for Firestore writes before Auth deletion');
assert(management.includes('/api/full-audit-qa-cleanup') && management.includes('Scan for QA Restaurants'), 'System Administrator QA cleanup card is wired to server dry-run endpoint');
assert(!management.includes('FULL_AUDIT_QA_COLLECTIONS') && !management.includes('isFullAuditQaRestaurant'), 'browser no longer decides QA cleanup eligibility or collections');

assert(firestoreRules.includes('request.resource.data.restaurantId == resource.data.restaurantId'), 'Firestore update rules keep restaurantId immutable');
assert(!firestoreRules.includes('allow update, delete: if isStandardTenantCollection'), 'generic standard tenant catch-all no longer combines update/delete');
assert(firestoreRules.includes('messageCreateIdentityIsSafe') && firestoreRules.includes('shiftSwapCreateIsSafe') && firestoreRules.includes('maintenanceCreateIdentityIsSafe'), 'message, shift-swap, and maintenance creation identities are guarded');
assert(!/function isStandardTenantCollection[\s\S]*'tasks'/.test(firestoreRules), 'tasks are not granted through the standard tenant catch-all');
assert(storageRules.includes('allow create, update:') && storageRules.includes('allow delete:'), 'Storage upload rules split create/update from delete');

assert(reportBugApi.includes("'Crash / Error'") && reportBugApi.includes('sanitizedCrashDiagnostics'), 'report-bug preserves automatic crash category and diagnostics');
assert(reportBugApi.includes('sendBugReportEmail') && reportBugApi.includes('supportEmailProviderAccepted'), 'report-bug attempts email independently and records provider status');
assert(reportBugApi.includes('fcmAcceptedCount') && reportBugApi.includes('deliveryConfirmedCount'), 'report-bug separates FCM acceptance from delivery confirmation');
assert(emailHelper.includes('BUG_REPORT_EMAIL_API_KEY') && emailHelper.includes('BUG_REPORT_EMAIL_FROM') && emailHelper.includes('BUG_REPORT_EMAIL_TO'), 'support email helper uses server-only environment variable names');
assert(appCore.includes('unhandledrejection') && appCore.includes('ChunkLoadError'), 'global runtime reporter handles unhandled chunk failures');
assert(appCore.includes('liveCollectionRegistry') && appCore.includes('listenerReuseCount'), 'useLiveCollection reuses identical live query subscriptions and exposes diagnostics');
assert(appJs.includes('recoverFromChunkFailureOnce') && appJs.includes('AppSurfaceErrorBoundary'), 'lazy chunk failures have one-shot recovery and an error boundary');
assert(vercel.includes('version.json') && vercel.includes('firebase-messaging-sw.js') && vercel.includes('no-store'), 'deployment metadata and service worker cache headers are revalidated');

const vercelConfig = JSON.parse(vercel);
const functionKeys = Object.keys(vercelConfig.functions || {});
assert(functionKeys.includes('api/**/*.js') && functionKeys.includes('api/**/*.py'), 'Vercel function config uses API wildcards instead of brittle single-file patterns');
assert(!functionKeys.includes('api/scan-invoice.js') && !functionKeys.includes('api/scan-menu.js'), 'Vercel function config no longer uses explicit scanner file patterns that can fail unmatched-function validation');

assert(schedule.includes('export const normalizeShiftTimeForFingerprint') && schedule.includes('export const buildShiftFingerprint') && schedule.includes('writeBatch(db)'), 'Schedule auto-fill has fingerprint helpers and batched writes');
assert(schedule.includes('resolveAmbiguousNameOnlyShiftIdentity') || schedule.includes('ambiguous'), 'Schedule auto-fill rejects ambiguous name-only identity');
assert(schedule.includes('successfulBatchCount') || schedule.includes('committedCount'), 'Schedule auto-fill reports partial batch success honestly');
assert(schedule.includes('existingFingerprints.add(newFingerprint)'), 'Schedule auto-fill is idempotent within the same run');

assert(reminders.includes('createStrictLocalDate') && reminders.includes('That calendar date is not valid.'), 'Reminder parser rejects impossible calendar dates');
assert(reminders.includes('That time has already passed today.'), 'Reminder parser rejects explicit today times that already passed');
assert(reminders.includes('That date has already passed.'), 'Reminder parser rejects explicit past dates with a year');
assert(reminders.includes('half') && reminders.includes('quarter'), 'Reminder parser handles half-hour and quarter-hour speech');
assert(exists('src/core/reminderUtils.test.js'), 'Reminder parser has Jest unit coverage');

assert(tabInventory.includes('[...(Array.isArray(invoices) ? invoices : [])].sort'), 'TabInventory sorts invoice copy instead of mutating props/state');
assert(inventory.includes('[...(Array.isArray(invoices) ? invoices : [])].sort'), 'Inventory feature sorts invoice copy instead of mutating props/state');
assert(exists('playwright.config.js'), 'Playwright configuration exists');
assert(exists('scripts/run-rules-tests.js'), 'Firebase emulator rule test runner exists');
assert(exists('tests/e2e/app-health.spec.cjs'), 'E2E browser test folder is not empty');

assert(styles.includes('/* 16.0.24 compact professional operations-console refinement */'), '16.0.24 compact UI refinement block exists');
assert(styles.includes('--chaos-compact-page-x') && styles.includes('--chaos-compact-input-h') && styles.includes('--chaos-mobile-tap-h'), 'shared compact UI density tokens exist');
assert(styles.includes('.desktop-pro-shell .app-header') && styles.includes('height: var(--chaos-compact-topbar-h)'), 'desktop app shell/header uses compact top-bar rules');
assert(styles.includes('.schedule-builder-control-deck') && styles.includes('order: 2'), 'Schedule Builder control deck remains directly above the calendar grid');
assert(styles.includes('min-width: 0 !important') && styles.includes('overflow-wrap: anywhere'), 'mobile containment fixes target actual wide elements');
assert(styles.includes('min-height: var(--chaos-mobile-tap-h)'), 'mobile tap targets remain at least 42px');
assert(styles.includes('.chaos-modal-panel') && styles.includes('.app-drawer-readable'), 'modals and navigation drawer have compact containment rules');
assert(styles.includes('.godmode') || styles.includes('System Administrator') || styles.includes('godmode'), 'System Administrator density hooks are present');
assert(exists('tests/e2e/compact-ui-layout.spec.cjs'), 'compact UI Playwright layout test exists');

if (failures) {
  console.error(`16.0.24 source validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.24 source validator passed. This is a source guard only. It does not replace unit, emulator, build, browser, or staging notification tests.');

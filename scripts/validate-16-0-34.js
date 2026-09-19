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
const authScreen = read('src/features/auth.jsx');
const loginBootstrapApi = read('api/login-bootstrap.js');
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

assert(pkg.version === '16.0.34', 'package.json version is 16.0.34');
assert(lock.version === '16.0.34' && lock.packages?.['']?.version === '16.0.34', 'package-lock.json version is 16.0.34');
assert(version.version === '16.0.34' && version.build === '16.0.34', 'public/version.json is 16.0.34');
assert(appCore.includes("CURRENT_VERSION = '16.0.34'"), 'CURRENT_VERSION is 16.0.34');
assert(apiVersion.includes("APP_VERSION = '16.0.34'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.34'"), 'API version constants are centralized at 16.0.34');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-34.js', 'package scripts point at the 16.0.34 source validator');
assert(exists('scripts/validate-16-0-32.js'), 'historical 16.0.32 source validator remains for audit continuity');
assert(exists('scripts/check-node-version.js'), 'Node 24 preflight script exists');
assert(exists('scripts/check-lock-integrity.js'), 'lock integrity validator exists');
assert(exists('scripts/run-cost-regression-tests.js'), 'real cost-regression harness entrypoint exists');

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

assert(styles.includes('/* 16.0.24 compact professional operations-console refinement */'), 'compact UI refinement block is still present');
assert(styles.includes('--chaos-compact-page-x') && styles.includes('--chaos-compact-input-h') && styles.includes('--chaos-mobile-tap-h'), 'shared compact UI density tokens exist');
assert(styles.includes('.desktop-pro-shell .app-header') && styles.includes('height: var(--chaos-compact-topbar-h)'), 'desktop app shell/header uses compact top-bar rules');
assert(styles.includes('.schedule-builder-control-deck') && styles.includes('order: 2'), 'Schedule Builder control deck remains directly above the calendar grid');
assert(styles.includes('min-width: 0 !important') && styles.includes('overflow-wrap: anywhere'), 'mobile containment fixes target actual wide elements');
assert(styles.includes('min-height: var(--chaos-mobile-tap-h)'), 'mobile tap targets remain at least 42px');
assert(styles.includes('.chaos-modal-panel') && styles.includes('.app-drawer-readable'), 'modals and navigation drawer have compact containment rules');
assert(styles.includes('.godmode') || styles.includes('System Administrator') || styles.includes('godmode'), 'System Administrator density hooks are present');
assert(exists('tests/e2e/compact-ui-layout.spec.cjs'), 'compact UI Playwright layout test exists');


assert(appJs.includes('isSelectableWorkspace') && appJs.includes('chaos:workspace-memberships-changed') && appJs.includes('isFullAuditQaWorkspaceName(workspace)'), 'in-app workspace selector filters deleted/stale QA workspaces and responds to cleanup events');
assert(authScreen.includes('filterSelectableWorkspaceChoices') && authScreen.includes('isFullAuditQaWorkspace') && authScreen.includes('restaurantExists === false') && authScreen.includes('finishLoginWithPreloadedWorkspaces'), 'login-time Choose Workspace screen filters deleted and Full Audit QA workspace leftovers before showing choices');
assert(read('api/workspace-memberships.js').includes('__exists: false') && read('api/workspace-memberships.js').includes('isDeletedRestaurant') && read('api/workspace-memberships.js').includes('isFullAuditQaRestaurantName(rest, raw) || raw.qaOwned === true'), 'workspace-memberships API filters missing/deleted Full Audit QA restaurants');
assert(loginBootstrapApi.includes('__exists: false') && loginBootstrapApi.includes('isDeletedOrHiddenRestaurant') && loginBootstrapApi.includes('isFullAuditQaWorkspace'), 'login-bootstrap API filters missing/deleted Full Audit QA restaurants before preloading login choices');
assert(management.includes('chaos:workspace-memberships-changed') && management.includes('deletedRestaurantIds'), 'QA cleanup tells the app to refresh workspace membership choices after deletion');
assert(styles.includes('16.0.26 workspace selector + mobile tab/button correction') && styles.includes('writing-mode: horizontal-tb') && styles.includes('financial-center-desktop > .flex.overflow-x-auto > button'), 'mobile scroll-tab buttons stay horizontal instead of stacking one letter per line');


const dispatchApi = read('api/dispatch-reminders.js');
const pythonAutomation = read('api/python-automation-run.js');
const weeklyMaintenance = read('api/weekly-maintenance.js');
const watchdog = read('api/firestore-backup-watchdog.js');
const indexes = read('firestore.indexes.json');
assert(dispatchApi.includes("where('dispatchEligible', '==', true)") && dispatchApi.includes("where('nextDispatchAt', '<=', nowIso)") && dispatchApi.includes("orderBy('nextDispatchAt', 'asc')"), 'reminder dispatcher queries the canonical eligible due queue');
assert(!dispatchApi.includes('checkRateLimit') && dispatchApi.includes('rateLimitWritesSkipped'), 'reminder cron no longer creates Firestore-backed rate-limit writes');
assert(dispatchApi.includes('dispatchLeaseUntil') && dispatchApi.includes('runTransaction(async (tx)') && dispatchApi.includes('tx.update(ref'), 'reminder dispatcher uses a dispatch lease for idempotent claiming');
assert(weeklyMaintenance.includes("db.collection('system').doc('weeklyMaintenance')") && !weeklyMaintenance.includes("collection('restaurants').get()"), 'weekly maintenance writes one system-level state instead of rewriting every restaurant');
assert(watchdog.includes('backupSchedules') && watchdog.includes('locations/-/backups') && watchdog.includes('googleapis.com') && !watchdog.includes("/api/firestore-backup"), 'backup watchdog inspects native backup status instead of triggering custom full backup');
assert(!vercel.includes('"/api/firestore-backup"') && vercel.includes('"/api/firestore-backup-watchdog"'), 'automatic custom full backup cron was removed while watchdog remains');
assert(exists('scripts/setup-native-firestore-backup.js'), 'native Firestore backup setup helper exists');
assert(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(pythonAutomation), 'Python automation source has no invalid control characters');
assert(pythonAutomation.includes('COLLECTION_QUERY_PLANS') && pythonAutomation.includes('sourceQueryStats') && pythonAutomation.includes('contentHash'), 'Python automation uses bounded query plans and content hashing');
assert(pythonAutomation.includes("doc(`${restaurant.id}_current`)"), 'Python automation stores one stable current intelligence report per restaurant');
assert(appCore.includes('LIVE_COLLECTION_RELEASE_GRACE_MS = 6 * 60 * 1000') && appCore.includes('useLiveDocument') && appCore.includes('downloadFirebaseUsageDiagnostics'), 'shared listener registry keeps cached snapshots longer and exposes diagnostics');
assert(appJs.includes('wantsFullRosterData') && appJs.includes('wantsWorkspaceMembershipList') && appJs.includes('const wantsRecipesData = isGlobalSearchOpen'), 'App avoids always-on full roster/membership reads and does not load App-owned Recipes listener on the Recipes tab');
assert(operations.includes('today:current-ops-intelligence') && operations.includes('briefOpsIntel'), 'Today uses the stable current operations intelligence document instead of historical listeners');
assert(management.includes('section-scoped, bounded listeners') && management.includes('firestoreLimit') && management.includes("orderBy('time'") && management.includes("orderBy('timestamp'"), 'System Administrator global data loading is section-scoped and bounded');
assert(read('src/features/intelligence.jsx').includes('participantUserIds') && read('src/features/intelligence.jsx').includes("'array-contains'"), 'Personal Reminders uses one participant visibility query');
assert(indexes.includes('dispatchEligible') && indexes.includes('nextDispatchAt') && indexes.includes('participantUserIds') && indexes.includes('timePunches'), 'Firestore indexes include reminder queues, participant visibility, and schedule query plans');
assert(exists('scripts/migrate-reminder-dispatch-queue.js') && exists('scripts/migrate-schedule-query-fields.js') && exists('scripts/migrate-reminder-participants.js'), 'dry-run migration scripts exist for reminder queue, schedule dates, and reminder participants');


assert(read('src/components/common.jsx').includes('React.memo(({ isOpen, onClose, queryText') && read('src/components/common.jsx').includes('useDeferredValue(queryText'), 'Global search defers heavy matching while typing');
assert(read('src/components/common.jsx').includes('const VoiceCommandDock = React.memo(VoiceCommandDockBase, voiceDockPropsAreEqual)'), '86Voice dock is memoized against unrelated shell renders');
assert(read('src/components/common.jsx').includes('perfArraySignature') && read('src/components/common.jsx').includes('shallowObjectSignature'), '86Voice memo comparison uses lightweight data signatures instead of deep scans');
assert(read('src/components/common.jsx').includes('const KitchenTVMode = React.memo') && read('src/components/common.jsx').includes('useMemo(() => (shifts || [])'), 'Kitchen TV mode memoizes filtered dashboard lists');
assert(appJs.includes('transitionActiveTabState') && appJs.includes('React.startTransition'), 'tab switches use React startTransition when available');
assert(appJs.includes('stableSetActiveTab') && appJs.includes('setActiveTabRef'), 'overlay controls receive a stable tab-change handler');
assert(appJs.includes('openMenu = useCallback') && appJs.includes('closeGlobalSearch = useCallback') && appJs.includes('closeKitchenTV = useCallback'), 'top-bar and overlay click handlers are stable callbacks');
assert(operations.includes('useMemo(() => canUseAiOrdering ? buildAiOrderAssistant') && operations.includes('useMemo(() => buildRestaurantAiInsightBundle'), 'Manager Brief AI/order insights are memoized instead of recomputed on every shell render');
assert(management.includes('useMemo(() => HELP_ARTICLES.filter') && management.includes('useMemo(() => q ? searchHelpContentSemantically'), 'Help Center semantic search results are memoized');
assert(styles.includes('16.0.34 targeted render/performance pass') && styles.includes('content-visibility: auto') && styles.includes('chaos-perf-overlay'), 'targeted CSS containment/performance hooks are present');

if (failures) {
  console.error(`16.0.34 source validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.34 source validator passed. This is a source guard only. It does not replace unit, emulator, build, browser, or staging notification tests.');

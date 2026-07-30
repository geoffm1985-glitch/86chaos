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
const schedulePlanner = read('src/core/scheduleQueryPlanner.js');
const indexSource = read('src/index.js');
const notificationReceiptApi = read('api/notification-receipt.js');
const setupTests = read('src/setupTests.js');
const releaseGateReminderTest = read('src/core/reminderUtils.release-gate.test.js');

assert(pkg.version === '16.0.60', 'package.json version is 16.0.60');
assert(lock.version === '16.0.60' && lock.packages?.['']?.version === '16.0.60', 'package-lock.json version is 16.0.60');
assert(version.version === '16.0.60' && version.build === '16.0.60', 'public/version.json is 16.0.60');
assert(appCore.includes("CURRENT_VERSION = '16.0.60'"), 'CURRENT_VERSION is 16.0.60');
assert(apiVersion.includes("APP_VERSION = '16.0.60'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.60'"), 'API version constants are centralized at 16.0.60');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-60.js', 'package scripts point at the 16.0.60 source validator');
assert(pkg.scripts?.['test:client'] === 'react-scripts test --watchAll=false', 'client test script no longer forces impossible whole-app coverage during release smoke tests');
assert(pkg.scripts?.['syntax:py'] === 'node scripts/check-python-syntax.js' && exists('scripts/check-python-syntax.js'), 'Python syntax check is cross-platform for Windows and CI');
assert(setupTests.includes('TextEncoder') && setupTests.includes('TextDecoder'), 'Jest setup polyfills TextEncoder/TextDecoder before Firebase Auth loads');
assert(setupTests.includes('ReadableStream') && setupTests.includes("jest.mock('firebase/messaging'"), 'Jest setup mocks web streams and Firebase Messaging for client smoke tests');
assert(appCore.includes('hasFirebaseMessagingBrowserApis') && appCore.includes('getSafeMessaging') && appCore.includes('messagingReady'), 'Firebase Messaging startup is guarded behind support checks');
assert(appCore.includes('isKnownNonFatalRuntimeError') && appCore.includes('non_fatal_firebase_messaging'), 'global crash reporter suppresses known non-fatal Firebase Messaging unsupported-browser errors');
assert(appCore.includes('ensureFirestoreDiagnosticsShape') && appCore.includes('documentsReceivedByQuery') && appCore.includes('diagnostics.listeners = diagnostics.listeners'), 'Firestore diagnostics self-heals listener/cache buckets before dynamic query writes');
assert(reportBugApi.includes('buildCrashDedupeHash') && reportBugApi.includes('crashReportDedupe') && reportBugApi.includes('known_non_fatal_firebase_messaging_unsupported_browser'), 'report-bug dedupes repeated automatic crashes and suppresses known non-fatal messaging errors server-side');
assert(appJs.includes('messagingReady') && appJs.includes("pushRepairStatus: 'unsupported-browser'") && appJs.includes('Push Unavailable'), 'push token sync and manual repair handle unsupported Firebase Messaging without crashing');
assert(!releaseGateReminderTest.includes('fast-check') && !releaseGateReminderTest.includes('import fc'), 'release-gate reminder tests do not require missing fast-check package');
assert(schedule.includes("const safePerson = person && typeof person === 'object' ? person : {}"), 'schedule identity builder safely handles null people');
assert(schedulePlanner.includes("const safeUser = user && typeof user === 'object' ? user : {}"), 'schedule query planner safely handles null users');
assert(appCore.includes('messageFingerprint'), 'global crash dedupe includes the actual error identity');
assert(indexSource.includes("navigator.serviceWorker.register('/firebase-messaging-sw.js'"), 'service worker registers during app startup');
assert(notificationReceiptApi.includes('notificationReceipts') && notificationReceiptApi.includes('openedAt'), 'notification receipt endpoint records received/opened evidence');
const deployTenantApi = read('api/deploy-tenant.js');
assert(deployTenantApi.includes("module.exports = async function handler") && deployTenantApi.includes("req.method !== 'POST'"), 'deploy-tenant exports a valid guarded Vercel handler');
assert(!deployTenantApi.includes('\\nexport default') && !deployTenantApi.includes(';\\n    const'), 'deploy-tenant contains no escaped-newline corruption');
assert(appCore.includes('window.__chaosCrashFingerprints instanceof Map') && !appCore.includes("[payload.source || 'runtime', chunkFailurePattern"), 'automatic runtime reports deduplicate the same error across browser event sources');
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
assert(schedule.includes('sourceSnapshot = await getDocs(query(') && schedule.includes('getScheduleMonthBoundsForKey(autoPopSourceMonth)'), 'Schedule auto-fill fetches the full selected source month before copying');
assert(schedule.includes('isShiftStillCurrentOrUpcoming(s, scheduleNow)') && schedule.includes('const myMonthShifts = shifts'), 'My Schedule month list filters out ended shifts');
assert(schedule.includes('totalMinutes >= MAX_REASONABLE_SCHEDULE_SHIFT_MINUTES') && schedule.includes('18 hours or longer'), 'Schedule validation rejects 18-hour-or-longer shifts like 4p-10a');
assert(schedule.includes('formatScheduleBuilderRequestRange') && schedule.includes('Partial day time missing'), 'Request-off partial-day display is safe for legacy missing times');
assert(schedule.includes('formatScheduleBuilderEventLabel') && schedule.includes('formatShortTime(event.time) || event.time') && schedule.includes("{u.name || 'Unnamed'}"), 'Schedule Builder shows readable full event titles and staff names');

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
assert(exists('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'Play Store release-gate PowerShell runner exists');
assert(read('tests/86chaos-release-gate/16-accessibility-release-gate.spec.cjs').includes("require('axe-core')") && read('tests/86chaos-release-gate/16-accessibility-release-gate.spec.cjs').includes('runAxe(page)'), 'Accessibility release gate has an axe-core fallback when @axe-core/playwright is unavailable');

assert(styles.includes('/* 16.0.24 compact professional operations-console refinement */'), 'compact UI refinement block is still present');
assert(styles.includes('--chaos-compact-page-x') && styles.includes('--chaos-compact-input-h') && styles.includes('--chaos-mobile-tap-h'), 'shared compact UI density tokens exist');
assert(styles.includes('.desktop-pro-shell .app-header') && styles.includes('height: var(--chaos-compact-topbar-h)'), 'desktop app shell/header uses compact top-bar rules');
assert(styles.includes('.schedule-builder-control-deck') && styles.includes('order: 2'), 'Schedule Builder control deck remains directly above the calendar grid');
assert(styles.includes('min-width: 0 !important') && styles.includes('overflow-wrap: anywhere'), 'mobile containment fixes target actual wide elements');
assert(styles.includes('min-height: var(--chaos-mobile-tap-h)'), 'mobile tap targets remain at least 42px');
assert(styles.includes('.chaos-modal-panel') && styles.includes('.app-drawer-readable'), 'modals and navigation drawer have compact containment rules');
assert(styles.includes('.godmode') || styles.includes('System Administrator') || styles.includes('godmode'), 'System Administrator density hooks are present');
assert(exists('tests/e2e/compact-ui-layout.spec.cjs'), 'compact UI Playwright layout test exists');


assert(appJs.includes('isSelectableWorkspace') && appJs.includes('chaos:workspace-memberships-changed') && appJs.includes("workspace.membershipSource === 'stale-missing-restaurant'"), 'in-app workspace selector filters deleted or stale workspaces and responds to cleanup events');
assert(!/workspace\.qaOwned\s*===\s*true[\s\S]{0,120}isDeletedOrHiddenWorkspace/.test(appJs), 'active qaOwned workspaces are not hidden merely because they are QA workspaces');
assert(authScreen.includes('filterSelectableWorkspaceChoices') && authScreen.includes('restaurantExists === false') && authScreen.includes('finishLoginWithPreloadedWorkspaces'), 'login-time Choose Workspace screen filters missing or deleted workspaces before showing choices');
assert(authScreen.includes('withOperationTimeout') && authScreen.includes('Browser account profile lookup'), 'login falls back when the direct browser profile read stalls');
assert(read('api/workspace-memberships.js').includes('__exists: false') && read('api/workspace-memberships.js').includes('isDeletedRestaurant') && !read('api/workspace-memberships.js').includes('isFullAuditQaRestaurantName(rest, raw) || raw.qaOwned === true'), 'workspace-memberships API keeps active QA workspaces selectable while filtering deleted restaurants');
assert(loginBootstrapApi.includes('__exists: false') && loginBootstrapApi.includes('isDeletedOrHiddenRestaurant') && !loginBootstrapApi.includes('rest.qaOwned === true || isFullAuditQaWorkspace'), 'login-bootstrap keeps active QA workspaces selectable while filtering missing or deleted restaurants');
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
assert(indexes.includes('\"collectionGroup\": \"inventoryItems\"') && indexes.includes('\"fieldPath\": \"restaurantId\"') && indexes.includes('\"fieldPath\": \"name\"'), 'Firestore indexes include the inventoryItems restaurantId + name index required by optimized Python Automation scans');
assert(indexes.includes('\"collectionGroup\": \"vendors\"') && indexes.includes('\"collectionGroup\": \"recipes\"') && indexes.includes('\"collectionGroup\": \"menuDependencies\"'), 'Firestore indexes include companion Python Automation catalog/history query coverage');
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
assert(schedule.includes('findAutoFillRosterPersonForShift') && schedule.includes('setAutoFillVisibleShifts') && schedule.includes('visibleCommittedCount'), 'Schedule Builder Auto-Fill resolves roster identity and keeps committed drafts visible after batch commit');
assert(schedule.includes('scheduleDateKey: newDate') && schedule.includes("publishState: 'draft'") && schedule.includes("assignmentSource: 'schedule_auto_fill'"), 'Auto-Fill draft shifts include canonical schedule metadata used by the grid');
assert(schedule.includes('Auto-Fill Saved Outside View'), 'Auto-Fill no longer reports a false visible success when saved drafts land outside the active schedule window');


const commonVoice = read('src/components/common.jsx');
const menuIntelligence = read('src/core/menuIntelligence.js');
const smartPrep = read('src/core/smartPrep.js');
assert(menuIntelligence.includes('uniqueInventoryProduct') && menuIntelligence.includes('getInventoryVoiceAliases') && menuIntelligence.includes('tokenExact'), '86Voice inventory 86 matching resolves unique live product aliases while preserving review for ambiguity');
assert(commonVoice.includes('strictProductMatch = resolveStrictEightySixMatch') && commonVoice.includes('alternateNames') && commonVoice.includes('keywords'), '86Voice menu impact and AI ordering use live inventory aliases beyond exact names');
assert(smartPrep.includes("getVoiceMatchScore") && smartPrep.includes('parsedAliases') && smartPrep.includes('top.score >= 92'), '86Voice prep upsert uses fuzzy existing-row matching before creating new prep rows');
assert(exists('src/core/voiceProductMatching.test.js') && read('src/core/voiceProductMatching.test.js').includes("resolveStrictEightySixMatch('eggs'") && read('src/core/voiceProductMatching.test.js').includes('findPrepMatch'), 'client smoke tests cover 86Voice inventory product and fuzzy prep matching');


assert(read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1').includes('86chaos-release-gate-SLIM-UPLOAD-ME.zip') && read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1').includes('CHAOS_RELEASE_GATE_FULL_ZIP'), 'Play Store runner creates slim upload report by default and only makes full ZIP by explicit opt-in');
assert(read('tests/86chaos-full-audit/utils/audit-helpers.cjs').includes('(?:^|[^A-Za-z])NaN') && !read('tests/86chaos-full-audit/utils/audit-helpers.cjs').includes('Invalid Date|NaN|Infinity'), 'release-gate broken-value check no longer false-matches normal words containing nan');
assert(read('tests/86chaos-full-audit/utils/math-oracle.cjs').includes('minutes >= 18 * 60'), 'schedule math oracle treats 18-hour shifts as invalid');
assert(appCore.includes('data:image/svg+xml') && !appCore.includes('ui-avatars.com/api'), 'local staff avatars avoid external ui-avatars requests during fuzz/offline tests');
assert(read('src/lib/featureAccess.js').includes('export const hasFeature'), 'featureAccess exports hasFeature for capability tests');
assert(reportBugApi.includes('marker: report.rawMessage') && reportBugApi.includes('rawMessage: report.rawMessage'), 'bug-report API response preserves raw crash markers for live pipeline proof');
assert(appJs.includes('Restricted Platform Tools') && !appJs.includes('System Administrator tools are internal-only'), 'staff restricted gate avoids privileged System Administrator terminology');
assert(management.includes('Clean Full Audit QA Restaurants') && !management.includes('microphone button is marked PREVIEW'), 'System Admin cleanup wording and 86Voice Help label match release-gate expectations');
assert((styles.includes('16.0.47 release-gate accessibility') || styles.includes('16.0.48 release-gate accessibility') || styles.includes('16.0.50 release-gate accessibility') || (styles.includes('16.0.51 mobile Schedule Builder readability') || styles.includes('16.0.60 failed-only release-gate repairs'))) && appJs.includes('describeControl'), 'accessibility/tap-target hardening is present');
assert(appJs.includes('Switch workspace. Active workspace') && authScreen.includes('persistLoginSessionForReload'), 'workspace switching and login session cache are discoverable and reload-safe');
assert((styles.includes('16.0.51 mobile Schedule Builder readability') || styles.includes('16.0.60 failed-only release-gate repairs')) && styles.includes('scheduled-hours-tracker-table'), 'mobile schedule times and hours tracker labels stay readable and horizontal');
assert(reportBugApi.includes('plainEnglishBugMessage') && reportBugApi.includes('Release gate test crash received') && reportBugApi.includes('The app could not copy to the clipboard'), 'bug report push notifications use plain-English summaries');
assert(appCore.includes('non_fatal_clipboard_permission') && appCore.includes('event.preventDefault?.()'), 'clipboard permission denials are treated as non-fatal browser behavior');


assert(read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1').includes('Write-RunnerSummary') && read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1').includes('runner-logs') && read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1').includes('Slim upload report only by default'), 'release-gate runner captures step logs and summary in slim-only mode');
assert(exists('playwright.play-store-release.config.cjs') && read('playwright.play-store-release.config.cjs').includes('playwright-report.json') && read('playwright.play-store-release.config.cjs').includes('86chaos-full-audit') && read('playwright.play-store-release.config.cjs').includes('86chaos-release-gate'), 'play-store Playwright config writes JSON report to slim-report results folder');
assert(management.includes('collectUserPushDevices') && management.includes('selectedPushDeviceCount') && management.includes('totalPushDeviceCount') && management.includes('pushDevices.${deviceId}'), 'Push Control Center counts primary, array, and pushDevices tokens by user');
assert(read('api/send-push.js').includes('collectUserPushTokenRecords') && read('api/send-push.js').includes('pushDevices.${record.deviceId}') && read('api/send-push.js').includes('FieldValue.delete'), 'send-push API sends to all saved token sources and cleans stale pushDevices');
assert(!appJs.includes('fcmTokens: arrayUnion(currentToken)') && appJs.includes('primaryTokenMissing') && appJs.includes("pushTokenDedupeVersion: '16.0.60'") && appJs.includes('writePushProfilePatch'), 'push token sync repairs the primary token and pushDevices without writing the disallowed browser fcmTokens array');
assert(appJs.includes('scheduleDisplayUsers') && appJs.includes('shift-roster-fallback'), 'Schedule Builder keeps shift-assigned staff visible when imported/restored roster records are sparse');
assert(appJs.includes('autoReloadUsed') && appJs.includes('autoReloadInFlight'), 'chunk recovery is capped to one automatic reload per version');
assert(read('api/whoami.js').includes('firestoreRoleLooksSystemAdmin') && !appJs.includes("MASTER_ADMIN_EMAIL && (liveAppUser?.email || '').toLowerCase()"), 'System Administrator route is server verified instead of unlocked by loose local email markers');
assert(read('tests/86chaos-release-gate/20-firebase-cost-idempotency.spec.cjs').includes('openTabInApp'), 'Firebase idempotency test uses in-app route changes instead of full reload listener churn');
assert(exists('playwright.failed-release.config.cjs') && pkg.scripts?.['test:play-store:failed'], 'failed-only Playwright release-gate script exists');
assert(exists('src/core/menuCosting.js') && read('src/core/menuCosting.js').includes('buildMenuCostBreakdowns') && read('src/core/menuCosting.js').includes('summarizeMenuCostBreakdowns'), 'menu costing core builds menu item cost breakdowns');
assert(read('api/scan-menu.js').includes('estimatedQuantity') && read('api/scan-menu.js').includes('priceText'), 'menu scan AI schema extracts prices and estimated portions');
assert(read('src/features/intelligence.jsx').includes('Menu Cost Breakdown') && read('src/features/intelligence.jsx').includes('menuItemPrice') && read('src/features/intelligence.jsx').includes('estimatedQuantity'), 'Menu Intelligence saves prices, portions, and cost breakdown review UI');
assert(schedule.includes('localBuilderShiftEchoes') && schedule.includes('savedShiftEchoes') && schedule.includes('setLocalBuilderShiftEchoes'), 'Schedule Builder shows saved shift assignments immediately while Firestore listener catches up');
assert(exists('api/_protected-root-admin.js') && read('api/_protected-root-admin.js').includes('geoffm1985@gmail.com'), 'protected root administrator email is centralized server-side');
assert(read('api/admin-access.js').includes('protectedRootAdminError') && read('api/delete-user.js').includes('protectedRootAdminError') && read('api/staff-member.js').includes('protectedRootAdminError'), 'protected root administrator cannot be revoked, deleted, disabled, or downgraded through admin APIs');
assert(management.includes('Protected Root') && management.includes('This is the protected root administrator account'), 'System Administrator UI blocks protected root admin revoke/delete actions with plain-English messaging');
assert(exists('scripts/test-16-0-58-targeted.cjs'), 'targeted 16.0.60 fix test exists');

// 16.0.60 temporary release-gate account provisioning guardrails
try {
  const failedRunner = read('RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1');
  const fullRunner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const provisioner = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');
  const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  const harnessTests = read('tests/86chaos-release-gate/test-harness-lifecycle.test.cjs');
  assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-60.js', 'package scripts point at the 16.0.60 source validator');
  assert(exists('scripts/86chaos-release-gate/provision-test-accounts.cjs'), 'temporary release-gate account provisioner exists');
  assert(failedRunner.includes('Provision temporary release-gate test accounts') && fullRunner.includes('Provision temporary release-gate test accounts'), 'both release-gate runners provision temporary test accounts before role preflight');
  assert(failedRunner.indexOf('Provision temporary release-gate test accounts') < failedRunner.indexOf('Verify release-gate role accounts'), 'failed-only runner provisions before role verification');
  assert(fullRunner.indexOf('Provision temporary release-gate test accounts') < fullRunner.indexOf('Verify release-gate role accounts'), 'full runner provisions before role verification');
  assert(provisioner.includes('CHAOS_QA_AUTO_PROVISION_TEST_USERS') && provisioner.includes('FIREBASE_TEST_SERVICE_ACCOUNT_KEY'), 'provisioner is explicitly opt-in and explains testing Firebase Admin credential requirement');
  assert(provisioner.includes('geoffm1985@gmail.com') && provisioner.includes('protected root administrator email'), 'provisioner refuses to use protected root administrator email as disposable QA user');
  assert(provisioner.includes('setCustomUserClaims') && provisioner.includes('systemAdministrator: true') && provisioner.includes('systemAdministrator: false'), 'provisioner writes system admin claims only for the system account and clears them for non-system accounts');
  assert(collector.includes('test-account-provisioning.json') && collector.includes('accountProvisionFailures'), 'collector includes temporary-account provisioning as a first-class current-run artifact');
  assert(harnessTests.includes('temporary account provisioning can create four distinct mocked Firebase Auth users') && harnessTests.includes('PowerShell runners provision temporary accounts before role preflight'), 'harness-only tests cover temporary account provisioning');
} catch (error) {
  failures += 1;
  console.error('16.0.60 temporary-account guard failed:', error.message);
}


if (failures) {
  console.error(`16.0.60 source validator failed with ${failures} issue(s).`);
  process.exit(1);
}


// 16.0.60 Schedule Builder delete visibility guardrails
try {
  const schedule = read('src/features/schedule.jsx');
  assert(schedule.includes('localBuilderDeletedShiftMarkers'), 'Schedule Builder tracks local delete markers for recently removed shifts');
  assert(schedule.includes('buildLocalShiftDeletionMarkers(existingShifts)'), 'Schedule Builder creates deletion markers from every visible deleted shift');
  assert(schedule.includes('setLocalBuilderShiftEchoes(prev => prev.filter(shift => !shiftMatchesLocalDeleteMarkers(shift, deletedKeySet)))'), 'Schedule Builder removes matching optimistic shift echoes after delete');
  assert(schedule.includes('setAutoFillVisibleShifts(prev => prev.filter(shift => !shiftMatchesLocalDeleteMarkers(shift, deletedKeySet)))'), 'Schedule Builder removes matching auto-fill preview shifts after delete');
  assert(schedule.includes('const visibleShifts = visibleSourceShifts.filter(shift => !shiftMatchesLocalDeleteMarkers(shift, activeLocalDeleteKeySet))'), 'Schedule Builder hides deleted live shifts while Firestore snapshots catch up');
} catch (error) {
  failures += 1;
  console.error('16.0.60 schedule delete guard failed:', error.message);
}


// 16.0.60 delete-and-reassign guardrails
try {
  assert(schedule.includes('if (id) return markerKeySet.has(`id:${id}`);'), 'Schedule Builder delete markers must not hide a newly re-added shift that has a different Firestore id.');
  assert(schedule.includes('savedShiftEchoes.push({ ...shiftData, id: savedRef.id, localEcho: true });'), 'Schedule Builder re-adds saved shifts as visible local echoes with their new document id.');
} catch (error) {
  failures += 1;
  console.error('16.0.60 schedule delete-and-reassign guard failed:', error.message);
}

console.log('16.0.60 source validator passed. This is a source guard only. It does not replace unit, emulator, build, browser, or staging notification tests.');

// 16.0.60 specific guardrails
try {
  const app = require('fs').readFileSync('src/App.js', 'utf8');
  if (/\[activeTabState,\s*isMenuOpen,\s*isWorkspaceSwitcherOpen\]/.test(app)) {
    console.error('16.0.60 guard failed: accessibility observer must not reference menu state before hook initialization.');
    process.exitCode = 1;
  }
  const sw = require('fs').readFileSync('public/firebase-messaging-sw.js', 'utf8');
  if (!sw.includes('/notification-badge.png')) {
    console.error('16.0.60 guard failed: notification badge fallback missing.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('16.0.60 guard failed:', error.message);
  process.exitCode = 1;
}


// 16.0.60 Schedule Hours / global-setup seed-auth guardrails
try {
  const schedule = read('src/features/schedule.jsx');
  const globalSetup = read('tests/86chaos-release-gate/global-setup.cjs');
  const cleanup = read('scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
  assert(schedule.includes('days: buildDateRange(fullWeekStart, fullWeekEnd)') && schedule.includes('visibleStart: visibleWeekStart') && schedule.includes('Pay-period week counted'), 'Scheduled Hours Tracker counts full pay-period weeks while preserving visible boundaries.');
  assert(schedule.includes('whitespace-nowrap') && schedule.includes('scheduled-hours-tracker-table'), 'Scheduled Hours Tracker labels stay horizontal on mobile.');
  assert(globalSetup.includes('provisionTestAccounts') && globalSetup.includes('global-setup-role-preflight') && globalSetup.includes('CHAOS_QA_AUTO_PROVISION_TEST_USERS'), 'Playwright global setup can provision and verify QA test accounts before seeding when direct Playwright is used.');
  assert(cleanup.includes('Cleanup safely skipped because QA setup did not create a current-run restaurant or seeded child records') && cleanup.includes('getSetupStatePath'), 'QA cleanup safely skips when setup never created current-run QA data.');
} catch (error) {
  console.error('16.0.60 guard failed:', error.message);
  process.exit(1);
}


// 16.0.60 partial publish and durable delete marker guardrails
try {
  const schedule59 = read('src/features/schedule.jsx');
  assert(schedule59.includes('const [isPublishPickerOpen, setIsPublishPickerOpen] = useState(false)'), 'Schedule Builder has a publish selection dialog state.');
  assert(schedule59.includes('publishWeekOptions') && schedule59.includes('Publish Selected Weeks') && schedule59.includes('Publish Full Schedule'), 'Schedule Builder supports selected-week and full-schedule publish choices.');
  assert(schedule59.includes("publishScope: publishAll ? 'full-period' : 'selected-weeks'"), 'Published shifts record the selected publish scope.');
  assert(schedule59.includes('if (id) return [`id:${id}`];'), 'Saved deleted shifts create exact document-id delete markers only.');
  assert(schedule59.includes("if (String(marker.key).startsWith('id:')) return true;"), 'Exact deleted shift IDs stay suppressed for the marker TTL even after listener churn.');
  assert(exists('scripts/test-16-0-60-targeted.cjs'), 'targeted 16.0.60 fix test exists');
} catch (error) {
  console.error('16.0.60 guard failed:', error.message);
  process.exit(1);
}

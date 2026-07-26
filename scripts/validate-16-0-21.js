const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
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
const lockText = read('package-lock.json');
const lock = JSON.parse(lockText);
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const management = read('src/features/management.jsx');
const schedule = read('src/features/schedule.jsx');
const reminders = read('src/core/reminderUtils.js');
const recipes = read('src/components/TabRecipes.js');
const tabInventory = read('src/components/TabInventory.js');
const inventory = read('src/features/inventory.jsx');
const firestoreRules = read('firestore.rules');
const storageRules = read('storage.rules');
const cleanupApi = read('api/full-audit-qa-cleanup.js');
const apiVersion = read('api/_version.js');

assert(pkg.version === '16.0.21', 'package.json version is 16.0.21');
assert(lock.version === '16.0.21' && lock.packages?.['']?.version === '16.0.21', 'package-lock.json version is 16.0.21');
assert(version.version === '16.0.21' && version.build === '16.0.21', 'public/version.json is 16.0.21');
assert(appCore.includes("CURRENT_VERSION = '16.0.21'"), 'CURRENT_VERSION is 16.0.21');
assert(apiVersion.includes("APP_VERSION = '16.0.21'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.21'"), 'API version constants are centralized at 16.0.21');
assert(!/15\.0\.(?:13|48|55|64|91)|16\.0\.20/.test(read('api/whoami.js') + read('api/security-diagnostics.js') + read('api/python-automation-run.js') + read('api/gemini-admin-manual.js') + read('api/full-system-diagnostics.js') + read('api/master-admin-repair.js') + read('api/firestore-backup-watchdog.js') + read('api/firestore-backup.js')), 'stale API app-version constants were removed from diagnostic APIs');

assert(cleanupApi.includes("mode === 'execute'") && cleanupApi.includes('DELETE QA AUDIT RESTAURANTS'), 'QA cleanup endpoint requires execute mode and exact confirmation');
assert(cleanupApi.includes('function isVerifiedFullAuditQaRestaurant') && cleanupApi.includes('qaOwned === true'), 'QA cleanup uses strict server-side QA predicate');
assert(cleanupApi.includes("authorize(req, app, { allowTenantAdmin: false, allowCrossProjectMaster: true })"), 'QA cleanup endpoint requires cross-project master authorization path');
assert(management.includes("/api/full-audit-qa-cleanup") && management.includes('Scan for QA Restaurants'), 'System Administrator QA cleanup card is wired to server dry-run endpoint');
assert(!management.includes('FULL_AUDIT_QA_COLLECTIONS'), 'browser no longer contains QA cleanup collection deletion constants');
assert(!management.includes('isFullAuditQaRestaurant'), 'browser no longer decides QA cleanup eligibility');

assert(firestoreRules.includes('request.resource.data.restaurantId == resource.data.restaurantId'), 'Firestore update rules keep restaurantId immutable');
assert(firestoreRules.includes('match /events/{eventId}') && firestoreRules.includes('match /messages/{messageId}') && firestoreRules.includes('match /shiftSwaps/{swapId}') && firestoreRules.includes('match /maintenanceLogs/{logId}'), 'Firestore dedicated events/messages/shiftSwaps/maintenance rules exist');
const commonTenantWriteBlock = firestoreRules.slice(firestoreRules.indexOf('function commonTenantWriteAllowed'), firestoreRules.indexOf('function canModerateMessages'));
assert(!commonTenantWriteBlock.includes("'events'"), 'events removed from broad tenant write helper');
assert(!commonTenantWriteBlock.includes("'messages'"), 'messages removed from broad tenant write helper');

assert(storageRules.includes('allow create, update:') && storageRules.includes('allow delete:'), 'Storage upload rules split create/update from delete');
assert(storageRules.includes('request.resource.metadata.restaurantId == restaurantId'), 'Storage invoice/menu upload metadata must match restaurant path');

assert(schedule.includes('export const normalizeShiftTimeForFingerprint') && schedule.includes('export const buildShiftFingerprint') && schedule.includes('writeBatch(db)'), 'Schedule auto-fill has fingerprint helpers and batched writes');
assert(schedule.includes('existingFingerprints.add(newFingerprint)'), 'Schedule auto-fill is idempotent within the same run');
assert(schedule.includes('duplicateCount') && schedule.includes('invalidCount') && schedule.includes('outsideTargetMonthCount'), 'Schedule auto-fill reports duplicate/invalid/outside counts');

assert(reminders.includes('createStrictLocalDate') && reminders.includes('That calendar date is not valid.'), 'Reminder parser rejects impossible calendar dates');
assert(reminders.includes('That time has already passed today.'), 'Reminder parser rejects explicit today times that already passed');
assert(reminders.includes('half') && reminders.includes('quarter'), 'Reminder parser handles half-hour and quarter-hour speech');
assert(fs.existsSync(path.join(root, 'src/core/reminderUtils.test.js')), 'Reminder parser has Jest unit coverage');

assert(recipes.includes("secureFetch('/api/scan'") && recipes.includes('Recipe scans are limited to 3MB'), 'Recipe scanner uses secureFetch and validates image size/type');
assert(recipes.includes("String(activeRecipe?.ingredients || '').split('\\n')"), 'Recipe modal is null-safe for ingredients');
assert(recipes.includes("String(activeRecipe?.instructions || '').split('\\n')"), 'Recipe modal is null-safe for instructions');
assert(tabInventory.includes('[...(Array.isArray(invoices) ? invoices : [])].sort'), 'TabInventory sorts invoice copy instead of mutating props/state');
assert(inventory.includes('[...(Array.isArray(invoices) ? invoices : [])].sort'), 'Inventory feature sorts invoice copy instead of mutating props/state');

if (failures) {
  console.error(`16.0.21 source validator failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('16.0.21 source validator passed. This is a source guard, not a substitute for unit, rules, build, or browser tests.');

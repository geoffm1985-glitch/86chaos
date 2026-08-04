#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${message}`);
  }
};
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const versionJson = JSON.parse(read('public/version.json'));
assert(pkg.version === '16.0.113', 'package.json version is 16.0.113');
assert(versionJson.version === '16.0.113' && versionJson.build === '16.0.113', 'public/version.json version/build are 16.0.113');
assert(!/16\.0\.89 Admin Push Release Gate Fix/.test(JSON.stringify(versionJson)), 'release label does not restore stale 16.0.89 text');
const app = read('src/App.js');
assert(app.includes("'hr': 'hr-training'"), 'legacy hr deep links normalize to hr-training');
assert(app.includes("'hr-training', 'prep'") && !app.includes("'messages', 'hr', 'prep'"), 'App roster listener is keyed to hr-training instead of obsolete hr route');
const management = read('src/features/management.jsx');
assert(management.includes('Document Vault') && management.includes('uploadBytes(ref(storage, details.storagePath), file'), 'Back Office Document Vault uploads actual files to Firebase Storage');
assert(management.includes('deleteObject(ref(storage') && management.includes('getBlob(ref(storage, record.storagePath)'), 'Document Vault supports delete and authenticated SDK blob preview/download actions');
assert(!management.includes('getDownloadURL(ref(storage, record.storagePath)'), 'Document Vault does not expose persistent Storage download URLs for vault files');
assert(management.includes('No uploaded file attached'), 'Document Vault preserves metadata-only legacy records');

const storageRules = read('storage.rules');
assert(storageRules.includes("request.auth.token.get('superAdmin', false) == true") && !storageRules.includes('request.auth.token.superAdmin == true'), 'Storage super admin rule safely reads the optional token claim');
assert(storageRules.includes('match /restaurants/{restaurantId}/back-office/document-vault/{recordId}/{fileName}'), 'Storage rules include exact Document Vault path');
assert(storageRules.includes("request.resource.metadata.purpose == 'document-vault'") && storageRules.includes('request.resource.metadata.uploadedBy == request.auth.uid'), 'Document Vault Storage rule requires strict metadata and uploader identity');
assert(storageRules.includes('request.resource.size <= 12 * 1024 * 1024') && storageRules.includes('allowedVaultContentType(fileName)') && !storageRules.includes('blockedVaultFileName'), 'Document Vault Storage rule keeps 12 MB limit and uses MIME plus extension allowlist without oversized blocked-extension regex chain');
assert(storageRules.includes('isTenantMember(restaurantId)') && storageRules.includes('canUseBackOfficeVault(restaurantId)'), 'Storage rules use compact tenant and Document Vault access helpers');
const firestoreRules = read('firestore.rules');
assert(!firestoreRules.includes('backOfficeDocumentVaultFieldsAreValid') && !firestoreRules.includes('safeBackOfficeVaultPath'), 'Firestore rules avoid deploy-choking Document Vault file regex; Storage rules and app workflow enforce vault file security');

assert(firestoreRules.includes("request.auth.token.get('superAdmin', false) == true"), 'Firestore super admin rule safely reads token claims with defaults');
assert(firestoreRules.includes("let access = u.get('systemAccess', {})") && firestoreRules.includes("access is map && access.get('superAdmin', false) == true") && !firestoreRules.includes('userData().systemAccess.superAdmin'), 'Firestore super admin rule safely handles missing systemAccess maps');
const systemCreateBlock = firestoreRules.match(/function systemAccessCreateIsSafe\(data\) \{([\s\S]*?)function platformAuthorityCreateIsSafe/);
const platformCreateBlock = firestoreRules.match(/function platformAuthorityCreateIsSafe\(data\) \{([\s\S]*?)function protectedFoundingAdminKeys/);
assert(Boolean(systemCreateBlock) && Boolean(platformCreateBlock) && !systemCreateBlock[1].includes('?') && !platformCreateBlock[1].includes('?'), 'platform authority create guards are flattened with no nested ternary tree');
assert(firestoreRules.includes('platformAuthorityCreateIsSafe(request.resource.data) &&') && firestoreRules.includes('workspaceMemberHrCreateIsSafe(restId) &&') && firestoreRules.includes("taskCompletionUpdateIsSafe() || canManageTasks"), 'Firestore rules evaluate cheap safety checks before expensive permission helpers');
assert(!firestoreRules.includes('match /{collectionName}/{docId}') && !firestoreRules.includes('function isStandardTenantCollection'), 'Firestore rules no longer evaluate a generic top-level standard-tenant catch-all for every collection');
assert(firestoreRules.includes("match /shifts/{docId}") && firestoreRules.includes("canTenantWriteCollection('shifts'") && firestoreRules.includes("match /tempLogs/{docId}"), 'Firestore standard tenant collections use explicit collection matches');
assert(firestoreRules.includes("function isTenantMatch(restId)") && firestoreRules.includes("safeUserData()") && !firestoreRules.includes('userData().restaurantId'), 'Firestore tenant membership helpers avoid unsafe direct userData field reads');

assert(firestoreRules.includes('function safeUserData()') && firestoreRules.includes('function membershipDataFromUser(u, restId)') && firestoreRules.includes('function permissionDataFromUserAndMember(u, member, restId)') && !firestoreRules.includes('function membershipDataFor(restId)') && !firestoreRules.includes('function permissionDataFor(restId)'), 'Firestore rules reuse cached user and membership maps instead of re-reading through wrapper helpers');
const workspaceAuthorityBlock = firestoreRules.match(/function hasWorkspaceAuthorityFor\(restId, a, b, c, d, e, f\) \{([\s\S]*?)function hasFinancialReadAuthorityFor/);
assert(Boolean(workspaceAuthorityBlock) && (workspaceAuthorityBlock[1].match(/safeUserData\(\)/g) || []).length === 1 && !workspaceAuthorityBlock[1].includes('membershipDataFor(') && !workspaceAuthorityBlock[1].includes('permissionDataFor('), 'workspace authority performs one safe user lookup and derives membership and permissions from that cached map');
assert(firestoreRules.includes('function workspaceEntitlementAllows(restId, allowedPlans)') && !firestoreRules.includes('function workspaceSubscriptionStatus(restId)') && !firestoreRules.includes('function rawWorkspacePlanId(restId)'), 'plan entitlement checks use one compact restaurant/subscription path');
assert(firestoreRules.includes('function hasWorkspaceAuthorityFor(restId, a, b, c, d, e, f)') && firestoreRules.includes("hasWorkspaceAuthorityFor(restId, 'messageBoard', 'messages', 'team', 'ops'"), 'Firestore rules collapse repeated owner/admin/permission checks into one helper chain without exceeding the Firebase function argument limit');
assert(!firestoreRules.includes('function membershipMapHas') && !firestoreRules.includes('function workspaceIdsHas') && !firestoreRules.includes('function memberData(restId)'), 'Firestore rules remove unused helper functions that make the rules compiler fail');
assert(!firestoreRules.includes('function hasAnyPermissionFor(restId, a, b, c, d, e, f, g)') && !firestoreRules.includes('function hasWorkspaceAuthorityFor(restId, a, b, c, d, e, f, g)'), 'Firestore helper function signatures stay within the 7-argument Firebase rules limit');
assert(firestoreRules.includes("allow update: if signedIn() && resource.data.restaurantId is string && request.resource.data.restaurantId == resource.data.restaurantId && (isSuperAdmin()") && !firestoreRules.includes("allow update: if signedIn() && (isSuperAdmin() || (resource.data.restaurantId is string"), 'Firestore update rules check immutable restaurantId before expensive permission checks');


const helperCallPattern = /\b(hasAnyPermissionFor|hasWorkspaceAuthorityFor)\s*\(([^\n;)]*)\)/g;
let helperMatch;
while ((helperMatch = helperCallPattern.exec(firestoreRules)) !== null) {
  const args = helperMatch[2].split(',').map((part) => part.trim()).filter(Boolean);
  assert(args.length <= 7, `${helperMatch[1]} call stays within Firebase's 7-argument limit`);
}


assert(storageRules.includes("isTenantMember(restaurantId) &&\n          (\n            request.auth.uid == uid ||") && !storageRules.includes("return request.auth.uid == uid ||\n        isStorageSuperAdmin()"), 'profile photo writes require tenant membership before self or manager authorization');
assert(!storageRules.includes('request.auth.token.email') && storageRules.includes("request.auth.token.get('email', '')"), 'Storage rules safely read optional email claims');
assert(!firestoreRules.includes('request.auth.token.email') && firestoreRules.includes("request.auth.token.get('email', '')"), 'Firestore rules safely read optional email claims');
assert(firestoreRules.includes('function authEmailMatchesAny(values)') && firestoreRules.includes("request.auth.token.get('email', '') != ''"), 'missing email claims cannot match missing owner-email fields');
const salesCloseBlock = firestoreRules.match(/function salesCloseRecordIsValid\(data\) \{([\s\S]*?)function financialExpenseRecordIsValid/);
assert(Boolean(salesCloseBlock) && (salesCloseBlock[1].match(/optionalNumber\(/g) || []).length <= 5 && salesCloseBlock[1].includes("data.keys().hasOnly([") && salesCloseBlock[1].includes("data.date.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')"), 'daily-close rules retain structural security checks while avoiding exhaustive numeric-field evaluation');
assert((firestoreRules.match(/\?/g) || []).length <= 25, 'Firestore rules keep total ternary use below the remote-compiler complexity guardrail');
assert(management.includes('const validateFinanceClosePayload =') && management.includes('FINANCE_CLOSE_NUMERIC_FIELDS.find') && management.includes('const validationError = validateFinanceClosePayload(payload)'), 'daily-close exhaustive amount and text validation runs in the application before Firestore writes');
const selfUpdateBlock = firestoreRules.match(/function userSafeSelfUpdate\(\) \{([\s\S]*?)function presenceSessionKeys/);
assert(Boolean(selfUpdateBlock) && !/forcePasswordChange|passwordPurgedAt|passwordStored/.test(selfUpdateBlock[1]), 'users cannot directly edit server-controlled forced-password fields');
assert(!firestoreRules.includes('function isManagerRoleFor') && !firestoreRules.includes('isManagerRoleFor(restId)'), 'dead always-false manager-role helper is removed while permission helpers remain authoritative');
const forcedPasswordApi = read('api/complete-forced-password.js');
assert(forcedPasswordApi.includes("verifyIdToken(token, true)") && forcedPasswordApi.includes("auth.updateUser(uid, { password: newPassword })"), 'forced-password endpoint verifies a non-revoked token and changes Firebase Auth server-side');
assert(forcedPasswordApi.includes('forcePasswordChange: false') && forcedPasswordApi.includes('passwordStored: false') && !forcedPasswordApi.includes('password: newPassword,\n      forcePasswordChange'), 'forced-password endpoint clears protected Firestore flags without storing plaintext passwords');
const forcedPasswordAuthSource = read('src/features/auth.jsx');
assert(forcedPasswordAuthSource.includes("secureFetch('/api/complete-forced-password'") && !forcedPasswordAuthSource.includes('await updatePassword(auth.currentUser, newPass)'), 'active login flow uses the protected forced-password API instead of client-clearing Firestore flags');
const legacyLogin = read('src/components/LoginScreen.js');
assert(!legacyLogin.includes('password: newPass') && legacyLogin.includes("secureFetch('/api/complete-forced-password'"), 'legacy login component no longer writes plaintext passwords or clears reset flags directly');

const rulesRunner = read('scripts/run-rules-tests.js');
assert(rulesRunner.includes('cross-tenant.png') && rulesRunner.includes('forcePasswordChange: false'), 'rules emulator suite covers cross-tenant profile photos and self-clearing password flags');
assert(rulesRunner.includes("'close_bad_field'") && rulesRunner.includes("'close_bad_date'") && rulesRunner.includes("'close_huge_total'") && rulesRunner.includes("'close_cross_tenant'"), 'rules emulator suite covers the simplified daily-close security boundary');
assert(rulesRunner.includes('getMetadata') && !rulesRunner.includes('getBlob'), 'Storage emulator tests use Node-compatible authenticated read checks');
assert(rulesRunner.includes("'demo-no-project'") && !rulesRunner.includes("'chaos-rules-test-local'"), 'Firestore rules test runner uses emulator default project id to avoid single-project warnings');
const psFull = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
const psFailed = read('RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1');
assert(psFull.includes('$WritesStarted') && psFailed.includes('$WritesStarted') && !psFull.includes('$setup.attempted -and $setup.seeded -and $setup.verified') && !psFailed.includes('$setup.attempted -and $setup.seeded -and $setup.verified'), 'PowerShell release-gate runners clean partial current-run QA writes');
const qaRoles = read('scripts/86chaos-release-gate/qa-role-definitions.cjs');
assert(qaRoles.includes("role: 'Kitchen'") && qaRoles.includes('expectedPlatformAuthority: true') && qaRoles.includes('accountOwner: false'), 'QA System Administrator is canonical Kitchen non-owner with platform authority only');
const routeMatrix = read('scripts/86chaos-release-gate/route-access-matrix.cjs');
assert(routeMatrix.includes("'published'") && routeMatrix.includes("'hr-training'") && routeMatrix.includes("'ops'") && !routeMatrix.includes("'kitchen',"), 'canonical browser route matrix uses current route IDs and staff Published Schedule');
const workflowManifest = read('tests/86chaos-release-gate/mutation-workflow-manifest.cjs');
assert(workflowManifest.includes('actionIds') && !workflowManifest.includes('evidence:'), 'mutation coverage manifest requires executed action IDs instead of lexical evidence regex');

const safety = read('scripts/86chaos-release-gate/mutation-safety.cjs');
assert(safety.includes('projectIdentitySupplied') && safety.includes('project identity is missing') && !safety.includes("|| APPROVED_TEST_PROJECT || ''"), 'mutation safety requires explicit project identity and no longer defaults to testing project');
const teardown = read('tests/86chaos-release-gate/global-teardown.cjs');
assert(teardown.includes('writesStarted') && !teardown.includes('!setup.seeded || !setup.verified'), 'global teardown cleans when current-run writes started, even after partial setup failure');
const common = read('src/components/common.jsx');
assert(common.includes('activeRecognitionRef') && common.includes('pendingVoiceStartTimerRef'), '86Voice single-recognition lifecycle guard is preserved');
const featureAccess = read('src/lib/featureAccess.js');
assert(featureAccess.includes('isMasterAdminUser = (user = {}) => isVerifiedPlatformAdminUser(user)'), 'master-admin feature access uses verified platform authority, not role text');
const auth = read('src/features/auth.jsx');
const userDataMatch = auth.match(/userData\s*=\s*\{([\s\S]*?)\n\s*\};/);
assert(Boolean(userDataMatch) && (userDataMatch[1].match(/\bid:\s*firebaseUser\.uid/g) || []).length === 1, 'auth bootstrap userData has one id property and preserves identity fields');
if (process.exitCode) process.exit(process.exitCode);

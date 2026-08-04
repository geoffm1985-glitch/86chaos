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
assert(pkg.version === '16.0.104', 'package.json version is 16.0.104');
assert(versionJson.version === '16.0.104' && versionJson.build === '16.0.104', 'public/version.json version/build are 16.0.104');
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
assert(storageRules.includes('match /restaurants/{restaurantId}/back-office/document-vault/{recordId}/{fileName}'), 'Storage rules include exact Document Vault path');
assert(storageRules.includes("request.resource.metadata.purpose == 'document-vault'") && storageRules.includes('request.resource.metadata.uploadedBy == request.auth.uid'), 'Document Vault Storage rule requires strict metadata and uploader identity');
assert(storageRules.includes('request.resource.size <= 12 * 1024 * 1024') && storageRules.includes('allowedVaultContentType(fileName)') && !storageRules.includes('blockedVaultFileName'), 'Document Vault Storage rule keeps 12 MB limit and uses MIME plus extension allowlist without oversized blocked-extension regex chain');
assert(storageRules.includes('isTenantMember(restaurantId)') && storageRules.includes('canUseBackOfficeVault(restaurantId)'), 'Storage rules use compact tenant and Document Vault access helpers');
const firestoreRules = read('firestore.rules');
assert(!firestoreRules.includes('backOfficeDocumentVaultFieldsAreValid') && !firestoreRules.includes('safeBackOfficeVaultPath'), 'Firestore rules avoid deploy-choking Document Vault file regex; Storage rules and app workflow enforce vault file security');

assert(firestoreRules.includes("request.auth.token.get('superAdmin', false) == true"), 'Firestore super admin rule safely reads token claims with defaults');
assert(firestoreRules.includes("userData().get('systemAccess', {}) is map") && !firestoreRules.includes('userData().systemAccess.superAdmin'), 'Firestore super admin rule safely handles missing systemAccess maps');
assert(firestoreRules.includes("platformAuthorityCreateIsSafe(request.resource.data) &&\n        workspaceMemberHrCreateIsSafe") && firestoreRules.includes("taskCompletionUpdateIsSafe() || canManageTasks"), 'Firestore rules evaluate cheap safety checks before expensive permission helpers');
assert(!firestoreRules.includes('match /{collectionName}/{docId}') && !firestoreRules.includes('function isStandardTenantCollection'), 'Firestore rules no longer evaluate a generic top-level standard-tenant catch-all for every collection');
assert(firestoreRules.includes("match /shifts/{docId}") && firestoreRules.includes("canTenantWriteCollection('shifts'") && firestoreRules.includes("match /tempLogs/{docId}"), 'Firestore standard tenant collections use explicit collection matches');
assert(firestoreRules.includes("function isTenantMatch(restId)") && firestoreRules.includes("userData().get('workspaceIds', [])") && !firestoreRules.includes('userData().restaurantId'), 'Firestore tenant membership helpers avoid unsafe direct userData field reads');
const rulesRunner = read('scripts/run-rules-tests.js');
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

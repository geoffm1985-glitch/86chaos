#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${message}`);
  }
};
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(read(file)).digest('hex');

const pkg = json('package.json');
const lock = json('package-lock.json');
const versionJson = json('public/version.json');
const appCore = read('src/core/appCore.js');
const app = read('src/App.js');
const common = read('src/components/common.jsx');
const sessionAccess = read('src/core/sessionAccess.js');
const featureAccess = read('src/lib/featureAccess.js');
const whoami = read('api/whoami.js');
const protectedRoot = read('api/_protected-root-admin.js');
const apiVersion = read('api/_version.js');

assert(pkg.version === '16.0.117', 'package.json version is 16.0.117');
assert(lock.version === '16.0.117' && lock.packages?.['']?.version === '16.0.117', 'package-lock root versions are 16.0.117');
assert(versionJson.version === '16.0.117' && versionJson.build === '16.0.117', 'public/version.json version/build are 16.0.117');
assert(appCore.includes("export const CURRENT_VERSION = '16.0.117'"), 'src/core/appCore.js CURRENT_VERSION is 16.0.117');
assert(apiVersion.includes("APP_VERSION = '16.0.117'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.117'"), 'api/_version.js reports 16.0.117');

assert(sha256('firestore.rules') === '239f5c27bf0275f8aae86fed1e6478d3a10f6231cc225d17199086da5070b1ff', 'deployed firestore.rules SHA-256 is preserved byte-for-byte');
assert(sha256('storage.rules') === '4037c82b31a1a16cc0f7b5c43d8557a3c180adcf8011cc8c893465355c7f62be', 'storage.rules remains unchanged from the uploaded source ZIP');

assert(protectedRoot.includes("'geoffm1985@gmail.com'"), 'protected root administrator email remains server-side protected');
assert(whoami.includes("require('./_protected-root-admin')"), '/api/whoami imports protected-root administrator list');
assert(whoami.includes('authorityWithoutProfile') && whoami.includes('profileReadError && authorityWithoutProfile.superAdmin !== true'), '/api/whoami can verify protected root without relying on Firestore profile reads');
assert(whoami.includes('runtime:') && whoami.includes('firebaseProjectId') && whoami.includes('appVersion: APP_VERSION'), '/api/whoami returns safe runtime/version diagnostics');
assert(!/claims:\s*decoded/.test(whoami), '/api/whoami does not return the full decoded custom-claim payload');

assert(sessionAccess.includes('PLATFORM_ADMIN_ACCESS_STATES'), 'sessionAccess defines canonical platform-admin access states');
assert(sessionAccess.includes('resolvePlatformAdminAccessState'), 'sessionAccess exports canonical platform-admin state resolver');
assert(sessionAccess.includes('canRenderProtectedControls: false') && sessionAccess.includes('showDrawerEntry: localHint'), 'pending/local hints cannot render protected System Administrator controls');
assert(sessionAccess.includes('userHasServerVerifiedPlatformAuthority'), 'sessionAccess exposes server-verified authority check');
assert(sessionAccess.includes('whoami-non-json-response') || sessionAccess.includes('non-json'), 'whoami non-JSON/HTML failures are treated as diagnostic transient failures');

assert(featureAccess.includes("import { userHasServerVerifiedPlatformAuthority } from '../core/sessionAccess'"), 'featureAccess uses canonical server-verified platform authority');
assert(featureAccess.includes('isVerifiedPlatformAdminUser = (user = {}) => userHasServerVerifiedPlatformAuthority(user)'), 'featureAccess no longer treats local profile markers as final platform authority');
assert(!/role\) === 'system administrator'/.test(featureAccess), 'featureAccess does not grant platform authority from role text');

assert(app.includes('resolvePlatformAdminAccessState({ user: liveAppUser || appUser || {}, verification: serverAdminCheck, masterAdminEmail: MASTER_ADMIN_EMAIL })'), 'App uses canonical platform-admin state from /api/whoami');
assert(app.includes('platformAdminAccessState={platformAdminAccessState}'), 'App passes canonical platform-admin state into active DrawerMenu');
assert(app.includes("activeTabState === 'godmode' && serverSaysSuperAdmin") && !app.includes("activeTabState === 'godmode' && (hasLocalSystemAdminMarker || serverSaysSuperAdmin)"), 'App renders TabGodMode only after server verification');
assert(app.includes('Non-JSON /api/whoami response'), 'App preserves exact /api/whoami non-JSON failure diagnostics');
assert(app.includes('HTTP:') && app.includes('Reason:') && app.includes('Firebase:') && app.includes('State:'), 'direct godmode route shows safe verification diagnostics');
assert(app.includes('platformAdminVerification: platformAdminAccessState.verification'), 'verified platform authority is preserved through live user hydration');

assert(common.includes('resolvePlatformAdminAccessState'), 'active DrawerMenu uses canonical platform-admin state');
assert(common.includes('resolvedPlatformAdminAccessState.verified === true || platformAdminPendingForRoute'), 'Drawer shows godmode only for verified authority or secure pending hint');
assert(common.includes('System Administrator • Verifying'), 'Drawer labels pending System Administrator verification clearly');
assert(!common.includes('const isTrueGod = Boolean((MASTER_ADMIN_EMAIL'), 'Drawer no longer treats public master email as final authorization');
assert(common.includes("tabId === 'godmode' ? platformAdminPendingForRoute"), 'Drawer passes pending only to godmode route gate');

const projectAdmin = read('api/_firebase-project-admin.js');
const provisioner = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');

assert(projectAdmin.includes('function readServiceAccountFile') && projectAdmin.includes('GOOGLE_APPLICATION_CREDENTIALS'), 'Firebase admin helper can read the existing GOOGLE_APPLICATION_CREDENTIALS service-account JSON file path');
assert(projectAdmin.includes("'FIREBASE_SERVICE_ACCOUNT_KEY'") && projectAdmin.includes('credentialProjectId(generic.credential) === projectId'), 'Firebase admin helper still accepts the existing generic FIREBASE_SERVICE_ACCOUNT_KEY when it matches the requested project');
assert(provisioner.includes('verifyExistingAccountsWithoutProvisioning'), 'release-gate provisioner has credential-free existing-account verification fallback');
assert(provisioner.includes('No Firebase Admin credential was available, so the release gate skipped temporary account provisioning'), 'release-gate fallback explains that auto-provisioning was skipped instead of treating missing FIREBASE_TEST_SERVICE_ACCOUNT_KEY as the only path');
assert(provisioner.includes('This mode does not create users, change passwords, set custom claims, or write Firestore profiles.'), 'credential-free release-gate fallback does not mutate users or Firestore profiles');

const roleVerifier = read('scripts/86chaos-release-gate/verify-role-accounts.cjs');
assert(roleVerifier.includes('expectedNonPlatformDenial = !expectedPlatformAuthority && response.status === 403'), 'release-gate role verifier accepts authoritative 403 /api/whoami denial for normal non-platform QA accounts');
assert(roleVerifier.includes('if (!response.ok && !expectedNonPlatformDenial) throwHttpResponseError'), 'release-gate role verifier still rejects unexpected /api/whoami failures and System Administrator denial');
assert(roleVerifier.includes('whoamiStatus: response.status') && roleVerifier.includes('expectedDenialVerified'), 'release-gate role verifier records safe whoami status/denial diagnostics');
assert(read('tests/86chaos-release-gate/role-account-verification.test.cjs').includes('accepts authoritative 403 /api/whoami denial'), 'targeted release-gate role verification regression test exists');

const globalSetup = read('tests/86chaos-release-gate/global-setup.cjs');
const seedScript = read('scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
assert(globalSetup.includes('function verifiedRoleProjectId(report)'), 'release-gate global setup derives Firebase project identity from verified role preflight');
assert(globalSetup.includes('applyVerifiedRoleProjectEnv(verifiedRoleProjectId(roleReport))'), 'release-gate global setup applies verified role project before QA seed safety gate');
assert(globalSetup.includes('projectId: roleVerifiedProjectId'), 'release-gate global setup passes verified role project into mutation safety without requiring Admin credentials');
assert(seedScript.includes('readJsonIfExists(getRoleReportPath(RUN_ID))'), 'browser-origin QA seed reads current role preflight report for project identity');
assert(seedScript.includes('projectId: roleVerifiedProjectId'), 'browser-origin QA seed accepts verified role project identity before Firebase config validation');
assert(read('tests/86chaos-release-gate/test-harness-lifecycle.test.cjs').includes('global setup can carry verified role-project identity'), 'targeted release-gate QA seed project regression test exists');

if (process.exitCode) process.exit(process.exitCode);

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
function check(id, ok, message) {
  checks.push({ id, ok: Boolean(ok), message });
}

const plans = read('src/config/plans.js');
const deployTenant = read('api/deploy-tenant.js');
const featureAccess = read('src/lib/featureAccess.js');
const appCore = read('src/core/appCore.js');
const fireRules = read('firestore.rules');
const storageRules = read('storage.rules');
const aiUsage = read('api/_ai-usage.js');
const adminShared = read('api/_chaos-admin.js');
const adminProject = read('api/_firebase-project-admin.js');
const reminders = read('api/dispatch-reminders.js');
const appShell = read('src/App.js');

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const functionsPackageJson = JSON.parse(read('functions/package.json'));
const functionsPackageLock = JSON.parse(read('functions/package-lock.json'));
const publicVersion = JSON.parse(read('public/version.json'));
const currentVersionMatch = appCore.match(/export const CURRENT_VERSION = ['\"]([^'\"]+)['\"]/);
const currentVersion = currentVersionMatch ? currentVersionMatch[1] : '';
const versionValues = [
  ['src/core/appCore.js CURRENT_VERSION', currentVersion],
  ['public/version.json version', publicVersion.version],
  ['public/version.json build', publicVersion.build],
  ['package.json version', packageJson.version],
  ['package-lock.json version', packageLock.version],
  ['package-lock root package version', packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version],
  ['functions/package.json version', functionsPackageJson.version],
  ['functions/package-lock.json version', functionsPackageLock.version],
  ['functions/package-lock root package version', functionsPackageLock.packages && functionsPackageLock.packages[''] && functionsPackageLock.packages[''].version]
];
const mismatchedVersionValues = versionValues.filter(([, value]) => value !== currentVersion);

check('VERSION_FILES_SYNC', !!currentVersion && mismatchedVersionValues.length === 0, `App version files are synchronized. ${versionValues.map(([name, value]) => `${name}=${value || 'missing'}`).join('; ')}`);
check('BETA_DAYS_90', /FOUNDER_BETA_DAYS\s*=\s*90/.test(plans), 'Founder Beta default is 90 days.');
check('DEPLOY_TENANT_90', /betaEnds\.setDate\(betaEnds\.getDate\(\) \+ 90\)/.test(deployTenant), 'Tenant creation uses 90-day beta window.');
check('SERVICE_ACCOUNT_GENERIC_PRESERVED', /FIREBASE_SERVICE_ACCOUNT_KEY/.test(adminProject) && /JSON\.parse\((raw|value)\)/.test(adminProject), 'Generic FIREBASE_SERVICE_ACCOUNT_KEY JSON parsing remains available.');
check('AUDIT_LOG_SERVER_ENDPOINT', fs.existsSync(path.join(root, 'api/audit-log.js')) && /secureFetch\('\/api\/audit-log'/.test(appCore), 'Client audit logging is routed through the server API.');
check('AUDIT_LOG_RULE_NO_CLIENT_CREATE', /match \/auditLogs\/\{docId\}[\s\S]*allow create: if isSuperAdmin\(\)/.test(fireRules), 'Firestore auditLogs no longer accepts normal client-created records.');
check('CRASH_REPORT_RULE_NO_CLIENT_CREATE', /match \/crashReports\/\{docId\}[\s\S]*allow create: if false;/.test(fireRules), 'Firestore crashReports are server-only writes.');
check('TEAM_NOT_FINANCIAL_GATE', !/canWriteFinancials[\s\S]{0,260}hasPermFor\(restId, 'team'\)/.test(fireRules), 'Team Management permission is not a financial write grant in rules.');
check('TEAM_NOT_INVENTORY_GATE', !/canWriteBasicInventory[\s\S]{0,260}hasPermFor\(restId, 'team'\)/.test(fireRules), 'Team Management permission is not an inventory write grant in rules.');
check('STORAGE_INVOICE_SCANS_LIMITED', /function canUseInvoiceScans/.test(storageRules) && /match \/\{restaurantId\}\/invoices/.test(storageRules), 'Invoice files require scan/inventory/financial permissions.');
check('PROFILE_PHOTOS_SCOPED', /profilePhotos\/\{uid\}\/\{fileName\}/.test(storageRules) && /canManageProfilePhoto/.test(storageRules), 'Profile photo writes are scoped to the user or staff managers.');
check('AI_SCAN_NO_ROLE_LABEL_ADMIN', !/workspaceUser\?\.role\s*===\s*['"]Admin['"]/.test(aiUsage) && !/workspaceUser\?\.role\s*===\s*['"]Owner['"]/.test(aiUsage), 'AI scan server permission does not trust custom role labels named Admin/Owner.');
check('MFA_NOT_ROLE_NAME_ONLY', !/\['owner', 'manager', 'admin'/.test(adminShared), 'Elevated MFA no longer relies on hardcoded role-name strings.');
check('REMINDER_RETRYABLE_PERSONAL', /isRetryablePersonalReminderStatus/.test(reminders) && /addUtcMonthsClamped/.test(reminders), 'Reminder dispatcher retries personal reminders and clamps monthly recurrence dates.');
check('MESSAGING_SUPPORT_GUARD', /isSupported/.test(appCore) && /safeGetMessaging/.test(appCore), 'Firebase Messaging startup is guarded for unsupported browsers.');
check('GEOCODE_AUTHED', /authorize\(req, app/.test(read('api/geocode-address.js')) && /restaurantId=/.test(read('src/features/management.jsx')), 'Geocode lookup is routed through authenticated API authorization.');
check('STANDARD_TENANT_ALLOWLIST', /function isStandardTenantCollection/.test(fireRules), 'Catch-all tenant access is restricted to an explicit allowlist.');
check('LOGIN_SCREEN_EAGER', /import \{ LoginScreen \} from ['\"]\.\/features\/auth['\"]/.test(appShell) && !/const LoginScreen\s*=\s*lazyNamed/.test(appShell), 'LoginScreen is eagerly imported so unauthenticated users do not hit a lazy Suspense gap.');

const failed = checks.filter(c => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.id}: ${c.message}`);
if (failed.length) {
  console.error(`\n${failed.length} repair validation check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} repair validation checks passed.`);

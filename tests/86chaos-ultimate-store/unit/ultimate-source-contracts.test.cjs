'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const apiFiles = fs.readdirSync(path.join(root, 'api')).filter(name => name.endsWith('.js') && !name.startsWith('_')).sort();

function json(relative) { return JSON.parse(read(relative)); }
function pngDimensions(relative) {
  const buffer = fs.readFileSync(path.join(root, relative));
  const signature = buffer.subarray(0, 8).toString('hex');
  assert.equal(signature, '89504e470d0a1a0a', `${relative} must be a valid PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
function indexBefore(text, first, second, message) {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  assert.ok(a >= 0, `${message}: missing ${first}`);
  assert.ok(b >= 0, `${message}: missing ${second}`);
  assert.ok(a < b, `${message}: ${first} must occur before ${second}`);
}

test('active app version is consistent across active release files', () => {
  const pkg = json('package.json');
  const version = json('public/version.json');
  const apiVersion = read('api/_version.js');
  const core = read('src/core/appCore.js');
  const escaped = pkg.version.replace(/\./g, '\\.');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(version.version, pkg.version);
  assert.equal(version.build, pkg.version);
  assert.match(apiVersion, new RegExp(escaped));
  assert.match(core, new RegExp(escaped));
  assert.ok(exists(`scripts/validate-${pkg.version.replace(/\./g, '-')}.js`), 'current-version source validator should exist');
});

test('all major product routes are wired to real components or deliberate permission gates', () => {
  const app = read('src/App.js');
  const required = ['today','schedule','published','events','ops','back-office','financials','sales','labor','messages','prep','recipes','inventory','ai-tools','menu-intelligence','reminders','team','hr-training','maintenance','settings','help','audit','godmode'];
  const missing = required.filter(route => !app.includes(`activeTabState === '${route}'`) && !app.includes(`activeTabState === \"${route}\"`));
  assert.deepEqual(missing, []);
  assert.match(app, /LockedFeatureScreen/);
  assert.match(app, /This page is not available/);
});

test('training manual covers every major operational and administrative area', () => {
  const manual = read('src/features/trainingManual.js');
  const labels = ['Manager Brief','Time Clock & Schedule','Kitchen Command Center','Event Calendar','Financial Center','Message Board','Prep & Tasks','Recipe Book','Inventory & Orders','AI Tools','Menu Intelligence','My Reminders','HR & Training','Staff Roster','Maintenance Log','Settings','System Audit','Help Center','System Administrator'];
  const missing = labels.filter(label => !manual.includes(label));
  assert.deepEqual(missing, []);
});

test('protected founding System Administrator is centralized and cannot be revoked or deleted by app APIs', () => {
  const protectedRoot = read('api/_protected-root-admin.js');
  assert.match(protectedRoot, /geoffm1985@gmail\.com/);
  assert.match(protectedRoot, /cannot be revoked, deleted, disabled, or downgraded/i);
  const files = ['api/admin-access.js','api/delete-user.js','api/delete-users-bulk.js','api/staff-member.js'];
  for (const file of files) {
    const text = read(file);
    assert.match(text, /_protected-root-admin/);
  }
  const adminAccess = read('api/admin-access.js');
  indexBefore(adminAccess, "isProtectedRootAdminEmail(targetEmail)", 'setCustomUserClaims', 'admin-access revoke protection');
  const deleteUser = read('api/delete-user.js');
  indexBefore(deleteUser, 'isProtectedRootAdminEmail(targetEmail)', 'deleteUser(targetUid)', 'single-user delete protection');
  const bulk = read('api/delete-users-bulk.js');
  assert.match(bulk, /protectedRootAdminEmails\(\)/);
  assert.match(bulk, /skippedProtected/);
  const ui = read('src/features/management.jsx');
  assert.match(ui, /PROTECTED_ROOT_ADMIN_EMAIL\s*=\s*['"]geoffm1985@gmail\.com['"]/);
});

test('test-account provisioning refuses to mutate the protected root administrator', () => {
  const provisioner = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');
  assert.match(provisioner, /geoffm1985@gmail\.com/);
  assert.match(provisioner, /protected root administrator email/i);
  assert.match(provisioner, /cannot be used as a disposable release-gate test account/i);
});

test('PWA manifest, icons, service worker, and viewport foundations exist for store packaging', () => {
  const manifest = json('public/manifest.json');
  assert.match(`${manifest.name} ${manifest.short_name}`, /86\s*Chaos|86Chaos/i);
  assert.match(manifest.display, /standalone|fullscreen|minimal-ui/);
  assert.ok(manifest.start_url);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  for (const icon of manifest.icons) assert.ok(exists(path.join('public', icon.src)));
  assert.ok(exists('public/firebase-messaging-sw.js'));
  const html = read('public/index.html');
  assert.match(html, /rel=["']manifest["']/i);
  assert.match(html, /name=["']viewport["']/i);
});

test('PWA and store icon metadata truthfully matches real image dimensions', () => {
  const manifest = json('public/manifest.json');
  const html = read('public/index.html');
  const actualSizes = new Set();
  const issues = [];
  let hasMaskable512 = false;
  for (const icon of manifest.icons || []) {
    const relative = path.join('public', icon.src);
    if (!exists(relative)) {
      issues.push(`Manifest icon is missing: ${icon.src}`);
      continue;
    }
    if (!/png/i.test(icon.type || '') && !/\.png$/i.test(icon.src || '')) continue;
    const dimensions = pngDimensions(relative);
    if (dimensions.width !== dimensions.height) issues.push(`${icon.src} must be square, found ${dimensions.width}x${dimensions.height}`);
    const actual = `${dimensions.width}x${dimensions.height}`;
    const declared = String(icon.sizes || '').split(/\s+/).filter(Boolean);
    if (!declared.includes(actual)) issues.push(`${icon.src} is really ${actual}, but manifest declares ${declared.join(', ') || 'no sizes'}`);
    actualSizes.add(actual);
    if (/maskable/i.test(icon.purpose || '') && dimensions.width >= 512) hasMaskable512 = true;
  }
  if (!actualSizes.has('192x192')) issues.push('Manifest needs a truthful 192x192 PNG icon');
  if (!actualSizes.has('512x512')) issues.push('Manifest needs a truthful 512x512 PNG icon');
  if (!hasMaskable512) issues.push('Manifest needs a truthful maskable icon at least 512x512');
  const touchMatch = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i);
  if (!touchMatch) issues.push('public/index.html needs an apple-touch-icon link for iOS installability');
  assert.deepEqual(issues, []);
});



test('schedule partial publishing is complete, legacy-compatible, and verifies selected-week shifts', () => {
  const schedule = read('src/features/schedule.jsx');
  assert.match(schedule, /mergeSchedulePublishCandidates/);
  assert.match(schedule, /fetchSchedulePublishCandidatesForDaySet\(publishDaySet, localPublishCandidateSources\)/);
  assert.match(schedule, /const selectedCandidates = publishCandidates/);
  assert.match(schedule, /getShiftWritableDocId\(shift\)/);
  assert.match(schedule, /resolveSchedulePersonForShift\(shift, users\)/);
  assert.match(schedule, /buildCanonicalScheduleIdentityBlock\(resolved\.person, shift\)/);
  assert.match(schedule, /writeBatch\(db\)/);
  assert.match(schedule, /batch\.update\(doc\(db, ['"]shifts['"], item\.id\), item\.update\)/);
  assert.match(schedule, /verificationFailures/);
  assert.match(schedule, /getDoc\(doc\(db, ['"]shifts['"], item\.id\)\)/);
  assert.match(schedule, /published:\s*true/);
  assert.match(schedule, /status:\s*['"]published['"]/);
  assert.match(schedule, /publishStatus:\s*['"]published['"]/);
  assert.match(schedule, /scheduleDateKey:\s*dateKey/);
  assert.match(schedule, /Published with Employee Review Needed/);
});

test('employee My Schedule loads outer weeks but displays the selected month list safely', () => {
  const schedule = read('src/features/schedule.jsx');
  const planner = read('src/core/scheduleQueryPlanner.js');
  assert.match(schedule, /const masterMonthBounds = getScheduleMonthBoundsForKey\(monthStr\)/);
  assert.match(schedule, /return isMyMasterPublishedShift\(shift\) && d >= masterMonthBounds\.start && d <= masterMonthBounds\.end/);
  assert.match(schedule, /const myNextShift = \(shifts \|\| \[\]\)/);
  assert.match(schedule, /\.filter\(isMyMasterUpcomingShift\)/);
  assert.match(schedule, /My Published Schedule/);
  assert.match(schedule, /No published shifts found for this month\./);
  assert.match(planner, /getOuterScheduleWeekBounds\(monthBounds, safeAppUser\)/);
  assert.match(planner, /shiftClauses: \[\['date','>=', myScheduleBounds\.start\], \['date','<=', myScheduleBounds\.end\]\]/);
});

test('package lock pins the direct test toolchain required by the one-command gate', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  const required = ['@playwright/test','@babel/parser','@babel/traverse','@firebase/rules-unit-testing','eslint'];
  for (const dep of required) {
    assert.ok(pkg.devDependencies?.[dep], `${dep} must be a direct devDependency`);
    assert.ok(lock.packages?.[`node_modules/${dep}`]?.version, `${dep} must be locked`);
  }
  assert.match(pkg.engines?.node || '', /24/);
  assert.ok(pkg.scripts?.['test:rules']);
  assert.ok(pkg.scripts?.build);
});

test('public API handlers have explicit method handling and do not embed private keys', () => {
  const missingMethod = [];
  const suspiciousSecrets = [];
  for (const name of apiFiles) {
    const text = read(path.join('api', name));
    const hasExplicitMethodHandling = text.includes('req.method') || text.includes('res.status(405)') || /allowedMethods|method not allowed/i.test(text);
    if (!hasExplicitMethodHandling) missingMethod.push(name);
    const hasHardcodedPrivateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s*[\r\n]+[A-Za-z0-9+/=\r\n]{100,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text);
    const hasHardcodedApiKey = /['"`]AIza[0-9A-Za-z_-]{30,}['"`]|['"`]sk-[A-Za-z0-9]{20,}['"`]/.test(text);
    if (hasHardcodedPrivateKey || hasHardcodedApiKey) suspiciousSecrets.push(name);
    assert.match(text, /module\.exports\s*=|export\s+default/, `${name} should export a handler`);
  }
  assert.deepEqual(missingMethod, []);
  assert.deepEqual(suspiciousSecrets, []);
});

test('upload and scan endpoints enforce type, size, authorization, and controlled errors', () => {
  for (const file of ['api/scan.js','api/scan-invoice.js','api/scan-menu.js','api/brand-logo.js']) {
    const text = read(file);
    assert.match(text, /content[-_ ]?type|mime|image\//i, `${file} needs file-type checks`);
    assert.match(text, /size|bytes|max/i, `${file} needs size checks`);
    assert.match(text, /authorization|verifyIdToken|auth/i, `${file} needs authorization`);
    assert.match(text, /status\((400|401|403|405|413|415|429)\)|Method not allowed|too large|unsupported/i, `${file} needs controlled rejection paths`);
  }
});

test('notification and reminder delivery code includes dedupe, receipt, and safe retry evidence', () => {
  const appCore = read('src/core/appCore.js');
  const sendPush = read('api/send-push.js');
  const receipt = read('api/notification-receipt.js');
  const dispatch = read('api/dispatch-reminders.js');
  assert.match(appCore, /notification|push/i);
  assert.match(`${sendPush}\n${receipt}\n${dispatch}`, /dedup|idempot|messageId|delivery|receipt/i);
  assert.match(dispatch, /next|recurr|scheduled|dispatch/i);
  assert.match(receipt, /received|delivered|receipt|status/i);
});

test('backup and restore code is review-first, integrity-aware, and separates preview from execution', () => {
  const backup = read('api/firestore-backup.js');
  const preview = read('api/backup-preview.js');
  const drill = read('api/restore-drill.js');
  const list = read('api/list-backups.js');
  assert.match(preview, /preview/i);
  assert.match(`${backup}\n${drill}\n${list}`, /integrity|verify|checksum|drill|manifest/i);
  assert.match(preview, /require\(['"]\.\/_chaos-admin['"]\)[\s\S]*\bauthorize\b|\bauthorize\s*\(/i);
  assert.match(drill, /require\(['"]\.\/_chaos-admin['"]\)[\s\S]*\bauthorize\b|\bauthorize\s*\(/i);
  assert.doesNotMatch(preview, /deleteDatabase|recursiveDelete/i);
});

test('schedule data uses canonical user identity, valid time parsing, and desktop number readability protections', () => {
  const planner = read('src/core/scheduleQueryPlanner.js');
  const schedule = read('src/features/schedule.jsx');
  const styles = read('src/styles.css');
  assert.match(planner, /getCanonicalScheduleUserId/);
  assert.match(`${planner}\n${schedule}`, /scheduleUserId/);
  assert.match(schedule, /formatShortTime|formatClockTime|calculateShiftHours|overnight/i);
  assert.match(styles, /schedule|shift/i);
  assert.match(styles, /white-space|nowrap|min-width|font-size/i);
});

test('plan and permission gates cover paid, admin, manager, and staff-only routes', () => {
  const plans = read('src/config/plans.js');
  const featureAccess = read('src/lib/featureAccess.js');
  const planGate = read('src/components/PlanGate.jsx');
  const hook = read('src/hooks/usePlanAccess.js');
  for (const tier of ['Shift','Operations','Smart Kitchen','Owner Pro']) assert.match(`${plans}\n${featureAccess}`, new RegExp(tier.replace(' ', '\\s*'), 'i'));
  assert.match(`${planGate}\n${hook}`, /allowed|locked|required|plan|feature/i);
  assert.match(featureAccess, /schedule|inventory|recipes|prep|financial|owner/i);
});

test('plain-English recovery screens exist and raw runtime errors are not rendered as normal UI copy', () => {
  const app = read('src/App.js');
  const core = read('src/core/appCore.js');
  assert.match(app, /This page is not available/);
  assert.match(app, /Go to Today/);
  assert.match(core, /isKnownNonFatalRuntimeError|friendly|plain|report/i);
  assert.doesNotMatch(app, />\s*FirebaseError\s*</i);
  assert.doesNotMatch(app, />\s*ChunkLoadError\s*</i);
});

test('Firebase rules, indexes, and tenant markers are present for every core collection family', () => {
  const rules = read('firestore.rules');
  const storage = read('storage.rules');
  const indexes = json('firestore.indexes.json');
  const coreCollections = ['restaurants','users','workspaceMembers','shifts','timePunches','events','inventoryItems','recipes','tasks','prepItems','maintenanceLogs','sales','personalReminders'];
  const missing = coreCollections.filter(name => !rules.includes(name));
  assert.deepEqual(missing, []);
  assert.match(rules, /restaurantId|workspace|tenant/i);
  assert.match(storage, /request\.auth|restaurant|workspace/i);
  assert.ok(Array.isArray(indexes.indexes));
});

test('test coverage inventory includes every major route and every public API through dynamic contract tests', () => {
  const helper = read('tests/86chaos-full-audit/utils/audit-helpers.cjs');
  const apiContract = read('tests/86chaos-release-gate/18-api-contract-release-gate.spec.cjs');
  const requiredRoutes = ['today','schedule','published','events','financials','inventory','menu-intelligence','ai-tools','prep','recipes','messages','reminders','team','hr-training','maintenance','settings','help','audit','godmode'];
  for (const route of requiredRoutes) assert.match(helper, new RegExp(`tab:\\s*['"]${route}['"]`));
  assert.match(apiContract, /readdirSync|apiFiles|API_FILES|public API/i);
  assert.match(apiContract, /malformed unauthenticated calls/i);
});

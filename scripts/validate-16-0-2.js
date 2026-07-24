const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = JSON.parse(read('public/version.json'));
const app = read('src/App.js');
const appCore = read('src/core/appCore.js');
const management = read('src/features/management.jsx');
const schedule = read('src/features/schedule.jsx');
const presenceSnapshot = read('api/presence-snapshot.js');
const workspacePresence = read('api/presence-workspace-summary.js');
const firebaseJson = read('firebase.json');
const databaseRules = read('database.rules.json');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

assert(pkg.version === '16.0.2', 'package.json version is 16.0.2');
assert(version.version === '16.0.2' && version.build === '16.0.2', 'public/version.json is 16.0.2');
assert(appCore.includes("CURRENT_VERSION = '16.0.2'"), 'CURRENT_VERSION is 16.0.2');
assert(pkg.scripts.test === 'node scripts/validate-16-0-2.js' && pkg.scripts['test:ci'] === 'node scripts/validate-16-0-2.js', 'npm test and test:ci point to current validator');

assert(appCore.includes('startLowCostPresenceSession') && appCore.includes('rtdbOnDisconnect') && appCore.includes('statusSummary/${workspaceKey}/${userKey}'), 'RTDB onDisconnect presence session writes tiny status/summary rows');
assert(appCore.includes('useLowCostPresenceSummaries') && appCore.includes('useLowCostPresenceSummary'), 'RTDB has both team summary and single-user summary hooks');
assert(appCore.includes('pauseWhenHidden = true') && appCore.includes('usePageVisible') && appCore.includes('if (pauseWhenHidden && !pageVisible)'), 'Firestore live collection listeners pause while the browser tab is hidden');
assert(firebaseJson.includes('database.rules.json') && databaseRules.includes('statusSummary') && databaseRules.includes('auth.uid === $userId'), 'Realtime Database rules are included for own-session presence writes');

assert(app.includes("activeTabState === 'settings'") && app.includes('selfPresenceRecord') && app.includes('presenceSelf={selfPresenceRecord}'), 'Settings/Profile reads only the current user RTDB presence summary');
assert(app.includes("activeTabState === 'team'") && app.includes('/api/presence-workspace-summary') && app.includes('workspacePresenceRecords'), 'Staff Roster loads presence through one authorized RTDB API snapshot');
assert((app.match(/presence-workspace-summary/g) || []).length === 1 && !app.includes('messagePresence') && !app.includes('presenceMessage'), 'Message Board is not wired into presence reads');
assert(app.includes('explicitlyOnline') && app.includes('_presenceLive: explicitlyOnline'), 'RTDB online sessions remain online without stale five-minute false negatives');
assert(app.includes('false && !ghostTenant && appUser?.id'), 'old Firestore/API heartbeat check-in remains disabled');

assert(management.includes('Online Presence') && management.includes('selfPresenceLabel') && management.includes('presenceSelf = null'), 'Profile screen shows low-cost online presence / last online');
assert(management.includes('const activity = formatLastActive(u)') && management.includes('Online now') && management.includes('u.activeDevice'), 'Staff Roster renders online / last-online plus device hint');
assert(management.includes('Staff Roster shows simple Online now / Last online hints'), 'Internal admin manual explains the new presence placement');
assert(workspacePresence.includes('allowTenantAdmin: true') && workspacePresence.includes('statusSummary/${restaurantId}') && !workspacePresence.includes('writeAudit'), 'Staff Roster presence API reads RTDB summary without per-view audit writes');
assert(presenceSnapshot.includes("row.online === true") && presenceSnapshot.includes("row.onlineState !== 'offline'"), 'System Administrator presence snapshot honors active RTDB online state');

assert(schedule.includes('getSchedulePersonForAppUser') && schedule.includes('rosterUserId') && schedule.includes('accountUserId'), 'My Schedule keeps strict auth/roster identity matching');
assert(schedule.includes('Do NOT use createdBy/author fields here'), 'My Schedule still avoids showing every imported/createdBy shift to owners');
assert(schedule.includes('requestedAt: nowIso') && schedule.includes('priorRequestInfoForDate') && schedule.includes('has already been requested off'), '16.0.0 request-off timestamp and duplicate-day warning remain present');

if (process.exitCode) process.exit(1);
console.log('16.0.2 presence visibility and read saver validator passed.');

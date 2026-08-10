'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function tabGodModeSource() {
  const source = read('src/features/management.jsx');
  const start = source.indexOf('const TabGodMode');
  assert.ok(start >= 0, 'TabGodMode exists in active management feature');
  const end = source.indexOf('const TabLabor', start);
  return source.slice(start, end > start ? end : source.length);
}
const platformOnlyRoutes = [
  'api/system-admin/dashboard.js',
  'api/system-admin/platform-config.js',
  'api/system-admin/automation.js',
  'api/system-admin/user-actions.js',
  'api/system-admin/workspace-actions.js',
  'api/system-admin/raw-doc.js',
  'api/system-admin/crash-actions.js',
];

test('new System Administrator platform endpoints require server-verified platform authority', () => {
  for (const file of platformOnlyRoutes) {
    const source = read(file);
    assert.match(source, /allowTenantAdmin:\s*false/, `${file} rejects tenant admins`);
    assert.match(source, /allowCrossProjectMaster:\s*true/, `${file} supports server master/protected admin authority`);
    assert.match(source, /ctx\.isSuperAdmin\s*!==\s*true|!ctx\.isSuperAdmin/, `${file} requires ctx.isSuperAdmin`);
    assert.match(source, /system-admin-required/, `${file} returns platform-only denial`);
  }
});

test('new System Administrator mutation endpoints use action allowlists instead of arbitrary Firestore mutation', () => {
  for (const file of ['api/system-admin/platform-config.js','api/system-admin/automation.js','api/system-admin/user-actions.js','api/system-admin/workspace-actions.js','api/system-admin/crash-actions.js']) {
    const source = read(file);
    assert.match(source, /switch\s*\(action\)|if \(action ===|if \(action !==/, `${file} branches on explicit action`);
    assert.doesNotMatch(source, /body\.collection|body\.documentPath|body\.arbitraryPatch|body\.patch/, `${file} does not accept arbitrary mutation coordinates`);
  }
});

test('active TabGodMode no longer directly reads protected platform collections through browser Firestore', () => {
  const source = tabGodModeSource();
  const forbidden = [
    /getDoc\(\s*doc\(db,\s*['"]system['"],\s*['"]dataRetention['"]\s*\)/,
    /getDoc\(\s*doc\(db,\s*['"]system['"],\s*['"]rolePermissionMatrix['"]\s*\)/,
    /listen\(\s*['"]superAdmins['"][\s\S]{0,240}collection\(db,\s*['"]users['"]\)/,
    /listenDoc\(\s*['"]pricing['"]/,
    /listenDoc\(\s*['"]restoreDrillStatus['"]/,
    /listenDoc\(\s*['"]operationsReview['"]/,
    /listen\(\s*['"]crashReports['"]/,
    /listen\(\s*['"]auditLogs['"]/,
    /listen\(\s*['"]restaurantAdminAlerts['"]/,
    /listen\(\s*['"]opsIntelligenceReports['"]/,
    /listen\(\s*['"]pythonAutomationRuns['"]/,
    /listen\(\s*['"]pythonAutomationConfigs['"]/,
    /listen\(\s*['"]accountDeletionRequests['"]/,
  ];
  for (const re of forbidden) assert.doesNotMatch(source, re);
  assert.match(source, /\/api\/system-admin\/dashboard/);
});

test('active TabGodMode uses strict server actions for migrated platform writes', () => {
  const source = tabGodModeSource();
  assert.doesNotMatch(source, /doc\(db,\s*['"]pythonAutomationConfigs['"]/);
  assert.doesNotMatch(source, /doc\(db,\s*['"]aiRecommendationQueue['"]/);
  assert.doesNotMatch(source, /doc\(db,\s*['"]system['"],\s*['"]dataRetention['"]\s*\)/);
  assert.doesNotMatch(source, /doc\(db,\s*['"]system['"],\s*['"]rolePermissionMatrix['"]\s*\)/);
  assert.doesNotMatch(source, /doc\(db,\s*['"]system['"],\s*['"]operationsReview['"]\s*\)/);
  assert.match(source, /\/api\/system-admin\/platform-config/);
  assert.match(source, /\/api\/system-admin\/automation/);
  assert.match(source, /\/api\/system-admin\/user-actions/);
  assert.match(source, /\/api\/system-admin\/workspace-actions/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Audit authorization stays owner/platform only while ordinary manager access remains intact', () => {
  const access = read('src/lib/featureAccess.js');
  const app = read('src/App.js');
  assert.match(access, /routeId === 'audit'/);
  assert.match(access, /serverVerifiedPlatformAdmin|isVerifiedPlatformAdminUser|platformAdmin|isSuperAdmin/);
  assert.doesNotMatch(access, /ROUTE_OWNER_ADMIN_ALLOWED[\s\S]{0,200}audit/);
  assert.match(access, /schedule/);
  assert.doesNotMatch(app, /activeTabState\s*===\s*['"]audit['"][\s\S]{0,180}LockedFeatureScreen[\s\S]{0,180}return null/);
  assert.match(app, /godmode/);
});

'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('emergency schedule publish candidate reads remain Firestore-authorized', async () => {
  const schedule = read('src/features/schedule.jsx');
  const rules = read('firestore.rules');
  const start = schedule.indexOf('const fetchSchedulePublishCandidatesForDaySet');
  const end = schedule.indexOf('const eventsByScheduleDay', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const block = schedule.slice(start, end);

  expect(rules).toContain("allow read: if signedIn() && (isSuperAdmin() || (resource.data.restaurantId is string && isTenantMatch(resource.data.restaurantId)));");
  expect(block).not.toContain("where('workspaceId', '==', appUser.restaurantId)");
  expect(block).toContain("where('restaurantId', '==', appUser.restaurantId), where('date', '==', day)");
  expect(block).toContain("where('restaurantId', '==', appUser.restaurantId), where('scheduleDateKey', '==', day)");
  expect(block).toContain('Publish candidate query failed for ${day}. No shifts were changed.');
});

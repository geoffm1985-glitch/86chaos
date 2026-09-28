'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('schedule publish candidate reads stay inside the Firestore-authorized restaurantId tenant scope', () => {
  const schedule = read('src/features/schedule.jsx');
  const rules = read('firestore.rules');
  const start = schedule.indexOf('const fetchSchedulePublishCandidatesForDaySet');
  const end = schedule.indexOf('const eventsByScheduleDay', start);
  assert.ok(start >= 0 && end > start, 'publish candidate helper is present');
  const block = schedule.slice(start, end);

  assert.match(
    rules,
    /match \/shifts\/\{docId\}[\s\S]*?allow read: if signedIn\(\) && \(isSuperAdmin\(\) \|\| \(resource\.data\.restaurantId is string && isTenantMatch\(resource\.data\.restaurantId\)\)\);/,
    'shift reads are authorized by resource.data.restaurantId tenant membership'
  );

  assert.doesNotMatch(
    block,
    /where\('workspaceId',\s*'==',\s*appUser\.restaurantId\)/,
    'publish no longer issues workspaceId-only queries that Firestore rules cannot authorize'
  );

  const restaurantScopedQueries = block.match(/fetchAuthoritativeCandidates\(query\(collection\(db, 'shifts'\), where\('restaurantId', '==', appUser\.restaurantId\), where\('(date|scheduleDateKey)', '==', day\)\)\);/g) || [];
  assert.equal(restaurantScopedQueries.length, 2, 'publish performs exactly the two authorized date-key candidate reads');
  assert.match(block, /where\('date', '==', day\)/, 'canonical date query remains');
  assert.match(block, /where\('scheduleDateKey', '==', day\)/, 'scheduleDateKey compatibility query remains');
  assert.match(block, /Publish candidate query failed for \$\{day\}\. No shifts were changed\./, 'fail-closed no-write publish error remains');
});

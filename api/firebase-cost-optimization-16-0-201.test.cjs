'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('16.0.201 removes only the automatic legacy JSON Firestore backup cron', () => {
  const vercel = json('vercel.json');
  const cronPaths = (vercel.crons || []).map(row => row.path);
  assert.ok(!cronPaths.includes('/api/firestore-backup'));
  assert.ok(cronPaths.includes('/api/firestore-backup-watchdog'));
  assert.ok(fs.existsSync(path.join(root, 'api/firestore-backup.js')));
  const management = read('src/features/management.jsx');
  assert.match(management, /manual\/emergency JSON exports|manual JSON exporter/);
  assert.doesNotMatch(management, /confirm \/api\/firestore-backup ran near|both backup cron routes/);
});

test('16.0.201 gates legacy scheduleDateKey rescue behind canonical/known-rescue need', () => {
  const app = read('src/App.js');
  const planner = read('src/core/scheduleQueryPlanner.js');
  assert.match(planner, /shouldEnableScheduleDateKeyRescue/);
  assert.match(planner, /scheduleLegacyRescueKnownForRange/);
  assert.match(app, /const rawDateShiftsState = useLiveCollectionState\('shifts'/);
  assert.match(app, /enableScheduleDateKeyRescue = shouldEnableScheduleDateKeyRescue/);
  assert.match(app, /enabled: !!rId && enableScheduleDateKeyRescue/);
});

test('16.0.201 makes Global Search demand-driven instead of open-dialog-driven', () => {
  const app = read('src/App.js');
  assert.match(app, /debouncedGlobalSearchQuery/);
  assert.match(app, /globalSearchHasMeaningfulQuery = isGlobalSearchOpen && debouncedGlobalSearchQuery\.length >= 2/);
  const demandBlock = app.slice(app.indexOf('const wantsInventoryData'), app.indexOf('const users = useLiveCollection'));
  assert.ok(demandBlock.includes('globalSearchHasMeaningfulQuery'));
  assert.ok(!demandBlock.includes('|| isGlobalSearchOpen'));
  assert.ok(!demandBlock.includes('= isGlobalSearchOpen; // Recipes'));
});

test('16.0.201 uses adaptive listener retention and retains diagnostics', () => {
  const core = read('src/core/appCore.js');
  assert.match(core, /adaptiveReleaseGraceMs/);
  assert.match(core, /documentsReceivedInitial/);
  assert.match(core, /documentsReceivedChanges/);
  assert.match(core, /RELEASE_GRACE_BY_COLLECTION/);
  assert.match(core, /releaseGraceMs/);
});

test('16.0.201 custom shift mutations do not reread full collection and skip no-op writes', () => {
  const api = read('api/custom-shift-presets.js');
  assert.match(api, /writeSkipped: true/);
  assert.match(api, /noChange: true/);
  assert.match(api, /return res\.status\(200\)\.json\(\{ ok: true, action, restaurantId, preset \}\)/);
  assert.match(api, /return res\.status\(200\)\.json\(\{ ok: true, action: 'delete', restaurantId, id \}\)/);
  assert.equal((api.match(/dedupePresets\(await readRows\(db, restaurantId\)\)/g) || []).length, 2, 'readRows is limited to GET/list and merge pre-dedupe, not post-mutation refreshes');
});

test('16.0.201 presence summary times out internally and client keeps last-known-good rows', () => {
  const api = read('api/presence-workspace-summary.js');
  const app = read('src/App.js');
  assert.match(api, /PRESENCE_SUMMARY_TIMEOUT_MS/);
  assert.match(api, /withTimeout\(ctx\.app\.database\(\)\.ref\(`statusSummary/);
  assert.match(api, /status = err\?\.status \|\| \(err\?\.code === 'presence-summary-timeout' \? 504 : 500\)/);
  assert.match(app, /keeping last-known-good summary/);
  assert.doesNotMatch(app, /Workspace presence summary unavailable:[\s\S]{0,160}setWorkspacePresenceRecords\(\[\]\)/);
});

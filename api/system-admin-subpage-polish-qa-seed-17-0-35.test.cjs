'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const hostSafety = require('./_qa-host-safety.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadQaSeedApiWithAdminStub() {
  const chaosAdminPath = path.resolve(root, 'api/_chaos-admin.js');
  const qaSeedApiPath = path.resolve(root, 'api/full-audit-qa-seed.js');
  delete require.cache[chaosAdminPath];
  delete require.cache[qaSeedApiPath];
  require.cache[chaosAdminPath] = {
    id: chaosAdminPath,
    filename: chaosAdminPath,
    loaded: true,
    exports: {
      admin: { firestore: { FieldValue: { arrayUnion: () => ({}), arrayRemove: () => ({}), delete: () => ({}) } } },
      initAdmin: () => ({}),
      authorize: async () => ({ ok: true, isSuperAdmin: true }),
      readBody: async () => ({}),
      writeAudit: async () => {},
      clean: (value = '', fallback = '') => String(value == null ? fallback : value).trim(),
      norm: (value = '') => String(value || '').toLowerCase().trim(),
      memberDocId: (uid = '', restaurantId = '') => `${uid}__${restaurantId}`,
    },
  };
  return require(qaSeedApiPath);
}

test('17.0.35 QA seed host safety accepts only the canonical testing.86chaos.com exception inside the 86chaos.com family', () => {
  assert.equal(hostSafety.CANONICAL_TESTING_HOST, 'testing.86chaos.com');
  assert.equal(hostSafety.normalizeRequestHost('testing.86chaos.com:443'), 'testing.86chaos.com');
  assert.equal(hostSafety.normalizeRequestHost('testing.86chaos.com, proxy.internal'), 'testing.86chaos.com');
  assert.equal(hostSafety.isProductionQaHost('testing.86chaos.com'), false);
  assert.equal(hostSafety.isProductionQaHost('testing.86chaos.com:443'), false);
  for (const host of ['86chaos.com', 'www.86chaos.com', 'app.86chaos.com', 'staging.86chaos.com', 'testing-copy.86chaos.com']) {
    assert.equal(hostSafety.isProductionQaHost(host), true, `${host} must remain production-blocked`);
  }
  assert.equal(hostSafety.isProductionQaHost('86chaos-git-testing-cheers-portal-s-projects.vercel.app'), false);
});

test('17.0.35 full-audit QA seed route uses the shared testing-host classifier instead of the broad 86chaos.com production regex', () => {
  const source = read('api/full-audit-qa-seed.js');
  assert.match(source, /require\('\.\/_qa-host-safety\.cjs'\)/);
  assert.match(source, /normalizeRequestHost\(req\.headers\['x-forwarded-host'\] \|\| req\.headers\.host \|\| ''\)/);
  assert.match(source, /if \(isProductionQaHost\(host\)\) errors\.push\('QA seed route refused a production host\.'\)/);
  assert.doesNotMatch(source, /\/app\\\.86chaos\\\.com\|\(\^\|\\\.\)86chaos\\\.com\/i\.test\(host\)/);
});

test('17.0.35 QA seed base validation accepts testing.86chaos.com but still rejects production/custom 86chaos hosts', () => {
  const api = loadQaSeedApiWithAdminStub();
  const runId = 'qa-seed-host-regression-17035';
  const body = {
    runId,
    restaurantId: 'qa_seed_host_regression_17035',
    workspaceName: `86 Chaos Release Gate QA ${runId}`,
    expectedProjectId: 'chaos-test-d1601',
  };
  const auth = { isSuperAdmin: true };
  const testing = api.validateBase({ req: { headers: { 'x-forwarded-host': 'testing.86chaos.com' } }, auth, body, projectId: 'chaos-test-d1601' });
  assert.equal(testing.ok, true, testing.errors.join('\n'));
  for (const host of ['app.86chaos.com', '86chaos.com', 'staging.86chaos.com']) {
    const result = api.validateBase({ req: { headers: { host } }, auth, body, projectId: 'chaos-test-d1601' });
    assert.equal(result.ok, false, `${host} must stay blocked`);
    assert.match(result.errors.join('\n'), /production host/i);
  }
});

test('17.0.35 System Administrator subtabs reuse the Concept 1 hero and active-tab icon language', () => {
  const source = read('src/features/management.jsx');
  assert.match(source, /adminTabIcons\s*=\s*\{/);
  assert.match(source, /const ActiveAdminTabIcon = adminTabIcons\[activeAdminTab\.id\] \|\| Settings/);
  assert.match(source, /admin-concept1-subpage-hero-icon"><ActiveAdminTabIcon/);
  assert.match(source, /admin-concept1-subpage-active/);
  assert.match(source, /admin-concept1-metric-grid/);
});

test('17.0.35 admin metric cards stop truncating labels/details and mobile collapses diagnostic grids to one clean column', () => {
  const source = read('src/features/management.jsx');
  const css = read('src/styles.css');
  const metricStart = source.indexOf('const CockpitMetric');
  const metricEnd = source.indexOf('const loadAiUsageAdmin', metricStart);
  const metricSource = source.slice(metricStart, metricEnd);
  assert.match(metricSource, /admin-concept1-metric-label/);
  assert.match(metricSource, /admin-concept1-metric-detail/);
  assert.doesNotMatch(metricSource, /truncate/);
  assert.match(css, /\.admin46-shell \.admin-concept1-metric-grid/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.admin46-shell \.admin-concept1-timeline-group/);
  assert.match(css, /17\.0\.35 System Administrator subpage visual rebuild/);
});

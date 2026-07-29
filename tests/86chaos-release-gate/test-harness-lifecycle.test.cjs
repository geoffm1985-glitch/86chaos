const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cleanupPath = path.resolve(__dirname, '../../scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
const seedPath = path.resolve(__dirname, '../../scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
const runContextPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/run-context.cjs');
const failedManifestPath = path.resolve(__dirname, './failed-only-manifest.cjs');

function freshRequire(file) {
  delete require.cache[require.resolve(file)];
  return require(file);
}
function withTempCwd(fn) {
  const oldCwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-harness-'));
  process.chdir(dir);
  try { return fn(dir); }
  finally { process.chdir(oldCwd); fs.rmSync(dir, { recursive: true, force: true }); }
}
function firestoreValue(value) {
  if (typeof value === 'boolean') return { booleanValue: value };
  return { stringValue: String(value) };
}
function doc(name, fields = {}) {
  return { name, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValue(v)])) };
}
function makeMockPage(docs) {
  const deletes = [];
  return {
    deletes,
    async evaluate(_fn, request) {
      if (request.method === 'GET') {
        const name = request.url.replace('https://firestore.googleapis.com/v1/', '');
        if (!docs.has(name)) throw new Error(`HTTP 404 Not Found for ${request.url}: {}`);
        return docs.get(name);
      }
      if (request.method === 'DELETE') {
        const name = request.url.replace('https://firestore.googleapis.com/v1/', '');
        deletes.push(name);
        if (!docs.has(name)) throw new Error(`HTTP 404 Not Found for ${request.url}: {}`);
        docs.delete(name);
        return {};
      }
      if (request.method === 'POST' && request.url.endsWith(':runQuery')) {
        const collection = request.body.structuredQuery.from[0].collectionId;
        const matches = [...docs.values()].filter(d => d.name.includes(`/documents/${collection}/`));
        return matches.slice(0, request.body.structuredQuery.limit || 500).map(document => ({ document }));
      }
      throw new Error(`Unexpected request in mock: ${request.method} ${request.url}`);
    },
  };
}

test('one release-gate run ID and directory are reused across child scripts', () => withTempCwd(() => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'unit-run-123';
  delete process.env.CHAOS_FULL_AUDIT_RUN_ID;
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  const ctx = freshRequire(runContextPath);
  const first = ctx.ensureRunDir();
  const second = ctx.ensureRunDir();
  assert.equal(first.runId, 'unit-run-123');
  assert.equal(second.runId, 'unit-run-123');
  assert.equal(process.env.CHAOS_FULL_AUDIT_RUN_ID, 'unit-run-123');
  assert.equal(first.runDir, second.runDir);
  assert.match(first.runDir, /86chaos-play-store-release-gate/);
}));

test('failed-only config and full release config use the same current-run parent directory', () => {
  const failedConfig = fs.readFileSync(path.resolve(__dirname, '../../playwright.failed-release.config.cjs'), 'utf8');
  const fullConfig = fs.readFileSync(path.resolve(__dirname, '../../playwright.play-store-release.config.cjs'), 'utf8');
  assert.match(failedConfig, /ensureRunDir\(\)/);
  assert.match(fullConfig, /ensureRunDir\(\)/);
  assert.doesNotMatch(failedConfig, /86chaos-play-store-failed-only/);
});

test('cleanup refuses stale, mismatched, unverified, or empty seed reports before deleting', () => {
  const { validateSeedForCleanup } = freshRequire(cleanupPath);
  assert.equal(validateSeedForCleanup(null, 'run-a').ok, false);
  assert.equal(validateSeedForCleanup({ ok: true, runId: 'run-b', restaurantId: 'r1', createdRestaurant: true, verification: { ok: true }, seededDocuments: [{}] }, 'run-a').ok, false);
  assert.equal(validateSeedForCleanup({ ok: true, runId: 'run-a', restaurantId: 'r1', createdRestaurant: false, verification: { ok: true }, seededDocuments: [{}] }, 'run-a').ok, false);
  assert.equal(validateSeedForCleanup({ ok: true, runId: 'run-a', restaurantId: 'r1', createdRestaurant: true, verification: { ok: false }, seededDocuments: [{}] }, 'run-a').ok, false);
  assert.equal(validateSeedForCleanup({ ok: true, runId: 'run-a', restaurantId: 'r1', createdRestaurant: true, verification: { ok: true }, seededDocuments: [] }, 'run-a').ok, false);
});

test('seed verification fails when one required seeded record is missing', async () => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'seed-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'seed-unit';
  const { verifySeedDocuments } = freshRequire(seedPath);
  const existing = 'projects/test/databases/(default)/documents/users/u1';
  const missing = 'projects/test/databases/(default)/documents/vendors/v1';
  const docs = new Map([[existing, doc(existing, { restaurantId: 'r1', qaOwned: true, qaRunId: 'seed-unit' })]]);
  const page = makeMockPage(docs);
  const result = await verifySeedDocuments(page, { headers: {}, base: 'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents' }, [
    { collection: 'users', id: 'u1', docName: existing },
    { collection: 'vendors', id: 'v1', docName: missing },
  ], { users: 1, vendors: 1 }, 'r1');
  assert.equal(result.ok, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.countFailures.length, 1);
});

test('cleanup deletes exact seeded IDs before current-run query cleanup', async () => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'cleanup-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'cleanup-unit';
  const { cleanupCurrentRun } = freshRequire(cleanupPath);
  const exact = 'projects/test/databases/(default)/documents/users/u1';
  const extra = 'projects/test/databases/(default)/documents/users/u2';
  const docs = new Map([
    [exact, doc(exact, { restaurantId: 'r1', qaOwned: true, qaRunId: 'cleanup-unit' })],
    [extra, doc(extra, { restaurantId: 'r1', qaOwned: true, qaRunId: 'cleanup-unit' })],
  ]);
  const page = makeMockPage(docs);
  const result = await cleanupCurrentRun({ page, rest: { headers: {}, base: 'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents' }, seed: { expectedCounts: { users: 1 }, seededDocuments: [{ collection: 'users', id: 'u1', docName: exact }] }, restaurantId: 'r1' });
  assert.equal(result.deleted.users, 1);
  assert.equal(result.additionalRunRecords.users, 1);
  assert.deepEqual(result.remaining, {});
  assert.deepEqual(page.deletes.slice(0, 2), [exact, extra]);
});

test('cleanup paginates by repeatedly querying current-run records until none remain', async () => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'paginate-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'paginate-unit';
  const { cleanupCurrentRun } = freshRequire(cleanupPath);
  const docs = new Map();
  for (let i = 0; i < 510; i += 1) {
    const name = `projects/test/databases/(default)/documents/vendors/v${i}`;
    docs.set(name, doc(name, { restaurantId: 'r1', qaOwned: true, qaRunId: 'paginate-unit' }));
  }
  const page = makeMockPage(docs);
  const result = await cleanupCurrentRun({ page, rest: { headers: {}, base: 'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents' }, seed: { expectedCounts: {}, seededDocuments: [] }, restaurantId: 'r1' });
  assert.equal(result.additionalRunRecords.vendors, 510);
  assert.deepEqual(result.remaining, {});
});

test('remaining current-run records make cleanup evidence fail', async () => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'remaining-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'remaining-unit';
  const { cleanupCurrentRun } = freshRequire(cleanupPath);
  const name = 'projects/test/databases/(default)/documents/tasks/t1';
  const docs = new Map([[name, doc(name, { restaurantId: 'r1', qaOwned: true, qaRunId: 'remaining-unit' })]]);
  const page = makeMockPage(docs);
  page.evaluate = async (_fn, request) => {
    if (request.method === 'POST' && request.url.endsWith(':runQuery')) return [{ document: docs.get(name) }];
    if (request.method === 'DELETE') return { name: request.url };
    if (request.method === 'GET') return docs.get(request.url.replace('https://firestore.googleapis.com/v1/', ''));
    return {};
  };
  const result = await cleanupCurrentRun({ page, rest: { headers: {}, base: 'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents' }, seed: { expectedCounts: {}, seededDocuments: [] }, restaurantId: 'r1' });
  assert.equal(result.remaining.tasks, 1);
});

test('failed-only manifest has exact titles and refuses a zero-test diagnostic gate', () => {
  const { FAILED_ONLY_TESTS, specsFromManifest, grepFromManifest } = freshRequire(failedManifestPath);
  assert.ok(FAILED_ONLY_TESTS.length > 0);
  assert.ok(specsFromManifest().every(spec => spec.endsWith('.spec.cjs')));
  const grep = grepFromManifest();
  assert.equal(grep.test('01 auth and every-route health > owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx'), true);
  assert.equal(grepFromManifest([]).test('anything'), false);
});

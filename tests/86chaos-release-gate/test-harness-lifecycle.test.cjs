const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cleanupPath = path.resolve(__dirname, '../../scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');
const seedPath = path.resolve(__dirname, '../../scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
const runContextPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/run-context.cjs');
const failedManifestPath = path.resolve(__dirname, './failed-only-manifest.cjs');
const dependencyPreflightPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/dependency-preflight.cjs');
const sourceInventoryPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/source-inventory.cjs');

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

test('collector reports duplicate role preflight as environment blocker without pretending seed or cleanup failed', () => withTempCwd((dir) => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'preflight-block-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'preflight-block-unit';
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  const { ensureRunDir } = freshRequire(runContextPath);
  const { runDir } = ensureRunDir();
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'environment-preflight.json'), JSON.stringify({
    ok: false,
    runId: 'preflight-block-unit',
    appUrl: 'https://example.test/',
    expectedVersion: '16.0.53',
    sourceVersion: '16.0.53',
    deployedVersion: '16.0.53',
    firebaseProjectId: 'chaos-test-d1601',
    errors: ['OWNER_EMAIL and SYSTEM_ADMIN_EMAIL must be different accounts so role isolation can be tested.'],
  }));
  fs.writeFileSync(path.join(runDir, 'runner-state.json'), JSON.stringify({
    runId: 'preflight-block-unit',
    playwrightStarted: false,
    blockingReason: 'Release gate blocked before dependency installation because environment/deployment preflight failed.',
    steps: [{ name: 'Environment preflight', exitCode: 1, passed: false }],
  }, null, 2));
  const oldExit = process.exitCode;
  process.exitCode = 0;
  const collectorPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  freshRequire(collectorPath);
  const summaryFile = fs.readdirSync(runDir).find(name => name.startsWith('86chaos-play-store-release-gate-summary-') && name.endsWith('.json'));
  assert.ok(summaryFile);
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, summaryFile), 'utf8'));
  assert.equal(summary.ok, false);
  assert.deepEqual(summary.preflightFailures, ['OWNER_EMAIL and SYSTEM_ADMIN_EMAIL must be different accounts so role isolation can be tested.']);
  assert.equal(summary.setupFailures.length, 0);
  assert.equal(summary.cleanupFailures.length, 0);
  assert.ok(summary.artifactsSkippedByPreflight.includes('86chaos-full-audit-seed-report.json'));
  assert.equal(summary.failureGroups.some(group => group.group === 'environment-preflight'), true);
  assert.equal(summary.failureGroups.some(group => group.group === 'harness-seed-cleanup'), false);
  process.exitCode = oldExit;
}));

test('PowerShell runners keep step command output out of assigned exit-code variables', () => {
  for (const file of ['RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    assert.match(source, /Tee-Object -FilePath \$LogPath -Append \| Out-Host/, `${file} Run-Step must send command output to host, not the function success stream`);
    assert.match(source, /ForEach-Object \{ Add-Content -Path \$LogPath -Value \$_; Write-Host \$_ \}/, `${file} Run-LiveStep must log live output without returning it as function output`);
    assert.doesNotMatch(source, /powershell -NoProfile -ExecutionPolicy Bypass -Command \$Command 2>&1 \| Tee-Object -FilePath \$LogPath -Append\r?\n/, `${file} must not let Tee-Object output pollute assigned step results`);
  }
});



test('dependency preflight reports missing local modules and never points to remote npx installation', () => withTempCwd((dir) => {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '86chaos', version: '16.0.53' }, null, 2));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ name: '86chaos', version: '16.0.53', lockfileVersion: 3, packages: { '': { name: '86chaos', version: '16.0.53' } } }, null, 2));
  const { buildDependencyPreflight } = freshRequire(dependencyPreflightPath);
  const report = buildDependencyPreflight({ root: dir, runId: 'dep-unit', runDir: path.join(dir, 'test-results', '86chaos-play-store-release-gate', 'dep-unit') });
  assert.equal(report.ok, false);
  assert.equal(report.packageLockPresent, true);
  assert.ok(report.requiredModules.some(item => item.name === '@playwright/test' && item.ok === false));
  assert.ok(report.requiredModules.some(item => item.name === '@babel/parser' && item.ok === false));
  assert.match(report.localPlaywrightExecutablePath, /node_modules/);
  assert.doesNotMatch(JSON.stringify(report), /Ok to proceed\? \(y\)|Need to install|npx playwright/);
}));

test('source inventory stops cleanly when Babel dependencies are missing and does not invent unreachable files', () => withTempCwd((dir) => {
  for (const file of ['src/App.js', 'src/index.js', 'firestore.rules', 'storage.rules', 'vercel.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), file.endsWith('.js') ? 'export default function App(){ return null; }\n' : '{}\n');
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '86chaos', version: '16.0.53' }, null, 2));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ name: '86chaos', version: '16.0.53', lockfileVersion: 3, packages: { '': { name: '86chaos', version: '16.0.53' } } }, null, 2));
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'inventory-missing-babel-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'inventory-missing-babel-unit';
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  const oldExit = process.exitCode;
  process.exitCode = 0;
  delete require.cache[require.resolve(runContextPath)];
  freshRequire(sourceInventoryPath);
  const reportPath = path.join(dir, 'test-results', '86chaos-play-store-release-gate', 'inventory-missing-babel-unit', 'source-inventory.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.ok, false);
  assert.equal(report.importGraphSkipped, true);
  assert.deepEqual(report.unreachableSourceFiles, []);
  assert.ok(report.errors.some(error => /Babel parser\/traverse unavailable/.test(error)));
  process.exitCode = oldExit;
}));

test('collector classifies dependency installation block as pre-Playwright, not seed or cleanup failure', () => withTempCwd((dir) => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'dependency-block-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'dependency-block-unit';
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  process.env.CHAOS_RELEASE_GATE_STEP_FAILURES = '1';
  const { ensureRunDir } = freshRequire(runContextPath);
  const { runDir } = ensureRunDir();
  fs.writeFileSync(path.join(runDir, 'runner-state.json'), JSON.stringify({
    runId: 'dependency-block-unit',
    dependencyInstallAttempted: true,
    dependencyInstallPassed: false,
    dependencyPreflightPassed: false,
    sourceInventoryPassed: false,
    browserInstallPassed: false,
    playwrightStarted: false,
    cleanupAttempted: false,
    blockingReason: 'Release gate blocked before Playwright because locked development dependencies were not installed.',
    steps: [{ name: 'Install locked test dependencies', exitCode: 1, passed: false }],
  }, null, 2));
  fs.writeFileSync(path.join(runDir, 'environment-preflight.json'), JSON.stringify({
    ok: true,
    runId: 'dependency-block-unit',
    appUrl: 'https://preview.example.test/',
    expectedVersion: '16.0.53',
    sourceVersion: '16.0.53',
    deployedVersion: '16.0.53',
    visibleVersion: '16.0.53',
    firebaseProjectId: 'chaos-test-d1601',
  }, null, 2));
  const oldExit = process.exitCode;
  process.exitCode = 0;
  const collectorPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  freshRequire(collectorPath);
  const summaryFile = fs.readdirSync(runDir).find(name => name.startsWith('86chaos-play-store-release-gate-summary-') && name.endsWith('.json'));
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, summaryFile), 'utf8'));
  assert.equal(summary.ok, false);
  assert.match(summary.primaryBlockingFailure, /locked development dependencies/);
  assert.equal(summary.playwright.status, 'No tests executed');
  assert.equal(summary.setupFailures.length, 0);
  assert.equal(summary.cleanupFailures.length, 0);
  assert.ok(summary.artifactsSkippedByRunnerBlock.some(item => item.artifact === '86chaos-full-audit-cleanup-report.json'));
  assert.equal(summary.failureGroups.some(group => group.group === 'dependency-preflight'), true);
  process.exitCode = oldExit;
}));

test('PowerShell runners install locked dev dependencies before inventory or Playwright and never use npx downloads', () => {
  for (const file of ['RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    assert.match(source, /Install locked test dependencies/);
    assert.match(source, /npm ci --include=dev --no-audit --no-fund/);
    assert.match(source, /Dependency preflight/);
    assert.match(source, /dependency-preflight\.cjs/);
    assert.match(source, /Install Chromium browser/);
    assert.match(source, /node_modules\\\.bin\\playwright\.cmd/);
    assert.match(source, /& '\$PlaywrightExe' test --config/);
    assert.doesNotMatch(source, /npx\s+playwright|npx\s+--no-install\s+playwright|Ok to proceed\? \(y\)|Need to install/);
    assert.ok(source.indexOf('Install locked test dependencies') < source.indexOf('Source inventory'));
    assert.ok(source.indexOf('Dependency preflight') < source.indexOf('Source inventory'));
    assert.ok(source.indexOf('Source inventory') < source.indexOf('Install Chromium browser'));
    assert.ok(source.indexOf('Install Chromium browser') < source.indexOf('$RunnerState.playwrightStarted = $true'));
  }
});

test('PowerShell runners stop before Playwright for npm, dependency, source inventory, or browser failures', () => {
  for (const file of ['RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    assert.match(source, /locked development dependencies were not installed/);
    assert.match(source, /required local test modules or the local Playwright executable were missing/);
    assert.match(source, /source inventory failed/);
    assert.match(source, /Chromium browser installation failed/);
    assert.match(source, /\$RunnerState\.playwrightStarted = \$true/);
    assert.ok(source.indexOf('$RunnerState.playwrightStarted = $true') > source.indexOf('Install Chromium browser'));
  }
});

const rolePreflightPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/verify-role-accounts.cjs');

function roleRows(overrides = {}) {
  const base = [
    { key: 'systemAdmin', emailEnv: 'SYSTEM_ADMIN_EMAIL', email: 'sysadmin@example.test', uid: 'uid-sys', superAdmin: true, customClaimSuperAdmin: true, serverMasterAdminMatched: true, firestoreSuperAdmin: false, firestoreSystemAdministrator: false, firebaseProjectId: 'chaos-test-d1601', runtimeProjectId: 'chaos-test-d1601' },
    { key: 'owner', emailEnv: 'OWNER_EMAIL', email: 'owner@example.test', uid: 'uid-owner', superAdmin: false, customClaimSuperAdmin: false, serverMasterAdminMatched: false, firestoreSuperAdmin: false, firestoreSystemAdministrator: false, firebaseProjectId: 'chaos-test-d1601', runtimeProjectId: 'chaos-test-d1601' },
    { key: 'manager', emailEnv: 'MANAGER_EMAIL', email: 'manager@example.test', uid: 'uid-manager', superAdmin: false, customClaimSuperAdmin: false, serverMasterAdminMatched: false, firestoreSuperAdmin: false, firestoreSystemAdministrator: false, firebaseProjectId: 'chaos-test-d1601', runtimeProjectId: 'chaos-test-d1601' },
    { key: 'staff', emailEnv: 'STAFF_EMAIL', email: 'staff@example.test', uid: 'uid-staff', superAdmin: false, customClaimSuperAdmin: false, serverMasterAdminMatched: false, firestoreSuperAdmin: false, firestoreSystemAdministrator: false, firebaseProjectId: 'chaos-test-d1601', runtimeProjectId: 'chaos-test-d1601' },
  ];
  return base.map(row => ({ ...row, ...(overrides[row.key] || {}) }));
}

test('role preflight passes only when System Administrator is true and manager/owner/staff are false', () => {
  const { analyzeRoleRows } = freshRequire(rolePreflightPath);
  assert.deepEqual(analyzeRoleRows(roleRows()), []);
});

test('role preflight fails when MANAGER_EMAIL has a System Administrator custom claim', () => {
  const { analyzeRoleRows } = freshRequire(rolePreflightPath);
  const errors = analyzeRoleRows(roleRows({ manager: { superAdmin: true, customClaimSuperAdmin: true } }));
  assert.ok(errors.some(error => /MANAGER_EMAIL resolves to a System Administrator account/.test(error)));
  assert.ok(errors.some(error => /customClaimSuperAdmin=true/.test(error)));
});

test('role preflight fails when MANAGER_EMAIL matches MASTER_ADMIN_EMAIL', () => {
  const { validateLocalRoleEnv } = freshRequire(rolePreflightPath);
  const oldMaster = process.env.MASTER_ADMIN_EMAIL;
  process.env.MASTER_ADMIN_EMAIL = 'manager@example.test';
  try {
    const errors = validateLocalRoleEnv([
      { key: 'systemAdmin', emailEnv: 'SYSTEM_ADMIN_EMAIL', passwordEnv: 'SYSTEM_ADMIN_PASSWORD', label: 'System Administrator', email: 'sysadmin@example.test', password: 'x', emailPresent: true, passwordPresent: true },
      { key: 'owner', emailEnv: 'OWNER_EMAIL', passwordEnv: 'OWNER_PASSWORD', label: 'Owner', email: 'owner@example.test', password: 'x', emailPresent: true, passwordPresent: true },
      { key: 'manager', emailEnv: 'MANAGER_EMAIL', passwordEnv: 'MANAGER_PASSWORD', label: 'Manager', email: 'manager@example.test', password: 'x', emailPresent: true, passwordPresent: true },
      { key: 'staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', label: 'Staff', email: 'staff@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    ]);
    assert.ok(errors.some(error => /MANAGER_EMAIL resolves to a configured master-admin email/.test(error)));
  } finally {
    if (oldMaster === undefined) delete process.env.MASTER_ADMIN_EMAIL; else process.env.MASTER_ADMIN_EMAIL = oldMaster;
  }
});

test('manager with master-email match and custom claim reports clear configuration errors without token/password details', () => {
  const { analyzeRoleRows, validateLocalRoleEnv } = freshRequire(rolePreflightPath);
  const oldMaster = process.env.MASTER_ADMIN_EMAIL;
  process.env.MASTER_ADMIN_EMAIL = 'manager@example.test';
  try {
    const localErrors = validateLocalRoleEnv([
      { key: 'systemAdmin', emailEnv: 'SYSTEM_ADMIN_EMAIL', passwordEnv: 'SYSTEM_ADMIN_PASSWORD', label: 'System Administrator', email: 'sysadmin@example.test', password: 'x', emailPresent: true, passwordPresent: true },
      { key: 'owner', emailEnv: 'OWNER_EMAIL', passwordEnv: 'OWNER_PASSWORD', label: 'Owner', email: 'owner@example.test', password: 'x', emailPresent: true, passwordPresent: true },
      { key: 'manager', emailEnv: 'MANAGER_EMAIL', passwordEnv: 'MANAGER_PASSWORD', label: 'Manager', email: 'manager@example.test', password: 'x', emailPresent: true, passwordPresent: true },
      { key: 'staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', label: 'Staff', email: 'staff@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    ]);
    const roleErrors = analyzeRoleRows(roleRows({ manager: { superAdmin: true, customClaimSuperAdmin: true, serverMasterAdminMatched: true } }));
    const text = [...new Set([...localErrors, ...roleErrors])].join('\n');
    assert.match(text, /MANAGER_EMAIL/);
    assert.match(text, /dedicated non-System-Administrator/);
    assert.doesNotMatch(text, /password|idToken|refreshToken|apiKey/i);
  } finally {
    if (oldMaster === undefined) delete process.env.MASTER_ADMIN_EMAIL; else process.env.MASTER_ADMIN_EMAIL = oldMaster;
  }
});

test('role preflight fails when System Administrator is not superAdmin', () => {
  const { analyzeRoleRows } = freshRequire(rolePreflightPath);
  const errors = analyzeRoleRows(roleRows({ systemAdmin: { superAdmin: false, customClaimSuperAdmin: false, serverMasterAdminMatched: false } }));
  assert.ok(errors.some(error => /SYSTEM_ADMIN_EMAIL is not server-verified/.test(error)));
});

test('role preflight fails when two role emails are the same', () => {
  const { validateLocalRoleEnv } = freshRequire(rolePreflightPath);
  const errors = validateLocalRoleEnv([
    { key: 'systemAdmin', emailEnv: 'SYSTEM_ADMIN_EMAIL', passwordEnv: 'SYSTEM_ADMIN_PASSWORD', label: 'System Administrator', email: 'same@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'owner', emailEnv: 'OWNER_EMAIL', passwordEnv: 'OWNER_PASSWORD', label: 'Owner', email: 'same@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'manager', emailEnv: 'MANAGER_EMAIL', passwordEnv: 'MANAGER_PASSWORD', label: 'Manager', email: 'manager@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', label: 'Staff', email: 'staff@example.test', password: 'x', emailPresent: true, passwordPresent: true },
  ]);
  assert.ok(errors.some(error => /must be different accounts/.test(error)));
});

test('role preflight fails when two accounts resolve to the same Firebase UID', () => {
  const { analyzeRoleRows } = freshRequire(rolePreflightPath);
  const errors = analyzeRoleRows(roleRows({ manager: { uid: 'uid-owner' } }));
  assert.ok(errors.some(error => /resolve to the same Firebase UID/.test(error)));
});

test('role preflight fails when an account points to the wrong Firebase project', () => {
  const { analyzeRoleRows } = freshRequire(rolePreflightPath);
  const errors = analyzeRoleRows(roleRows({ manager: { firebaseProjectId: 'cheers-34b8d', runtimeProjectId: 'cheers-34b8d' } }));
  assert.ok(errors.some(error => /expected chaos-test-d1601/.test(error)));
});

test('collector classifies failed role preflight as test-account configuration with no tests executed and safe cleanup skip', () => withTempCwd((dir) => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'role-block-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'role-block-unit';
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  process.env.CHAOS_RELEASE_GATE_STEP_FAILURES = '1';
  const { ensureRunDir } = freshRequire(runContextPath);
  const { runDir } = ensureRunDir();
  fs.writeFileSync(path.join(runDir, 'runner-state.json'), JSON.stringify({
    runId: 'role-block-unit',
    dependencyInstallPassed: true,
    dependencyPreflightPassed: true,
    sourceInventoryPassed: true,
    browserInstallPassed: true,
    rolePreflightStarted: true,
    rolePreflightPassed: false,
    playwrightStarted: false,
    globalSetupStarted: false,
    qaSeedProcessStarted: false,
    qaDataWritesStarted: false,
    qaRestaurantCreated: false,
    cleanupAttempted: false,
    blockingReason: 'Release gate blocked before tests because MANAGER_EMAIL resolves to a System Administrator account. Configure MANAGER_EMAIL with a dedicated non-System-Administrator manager testing account.',
    steps: [{ name: 'Verify release-gate role accounts', exitCode: 1, passed: false }],
  }, null, 2));
  fs.writeFileSync(path.join(runDir, 'environment-preflight.json'), JSON.stringify({ ok: true, runId: 'role-block-unit', appUrl: 'https://preview.example.test/', expectedVersion: '16.0.53', sourceVersion: '16.0.53', deployedVersion: '16.0.53', visibleVersion: '16.0.53', firebaseProjectId: 'chaos-test-d1601' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'dependency-preflight.json'), JSON.stringify({ ok: true, runId: 'role-block-unit' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'source-inventory.json'), JSON.stringify({ ok: true, runId: 'role-block-unit', packageVersion: '16.0.53' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'test-account-provisioning.json'), JSON.stringify({ ok: true, skipped: true, runId: 'role-block-unit' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'role-identity-verification.json'), JSON.stringify({ ok: false, runId: 'role-block-unit', firebaseProjectId: 'chaos-test-d1601', errors: ['MANAGER_EMAIL resolves to a System Administrator account. Configure MANAGER_EMAIL with a dedicated non-System-Administrator manager testing account.'], accounts: roleRows({ manager: { superAdmin: true, customClaimSuperAdmin: true } }) }, null, 2));
  const oldExit = process.exitCode;
  process.exitCode = 0;
  const collectorPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  freshRequire(collectorPath);
  const summaryFile = fs.readdirSync(runDir).find(name => name.startsWith('86chaos-play-store-release-gate-summary-') && name.endsWith('.json'));
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, summaryFile), 'utf8'));
  assert.equal(summary.ok, false);
  assert.equal(summary.playwright.status, 'No tests executed');
  assert.equal(summary.testAccountConfigurationFailure, true);
  assert.ok(summary.roleFailures.some(error => /MANAGER_EMAIL resolves/.test(error)));
  assert.equal(summary.setupFailures.length, 0);
  assert.equal(summary.cleanupFailures.length, 0);
  assert.ok(summary.artifactsSkippedByRunnerBlock.some(item => item.artifact === '86chaos-full-audit-cleanup-report.json'));
  assert.equal(summary.failureGroups.some(group => group.group === 'test-account-configuration'), true);
  process.exitCode = oldExit;
}));

test('PowerShell runners verify role accounts after Chromium and before Playwright', () => {
  for (const file of ['RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    assert.match(source, /Verify release-gate role accounts/);
    assert.match(source, /verify-role-accounts\.cjs/);
    assert.match(source, /rolePreflightStarted/);
    assert.match(source, /rolePreflightPassed/);
    assert.ok(source.indexOf('Install Chromium browser') < source.indexOf('Verify release-gate role accounts'));
    assert.ok(source.indexOf('Verify release-gate role accounts') < source.indexOf('$RunnerState.playwrightStarted = $true'));
  }
});

const provisionAccountsPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/provision-test-accounts.cjs');

function withQaAccountEnv(fn) {
  const keys = ['SYSTEM_ADMIN_EMAIL','SYSTEM_ADMIN_PASSWORD','OWNER_EMAIL','OWNER_PASSWORD','MANAGER_EMAIL','MANAGER_PASSWORD','STAFF_EMAIL','STAFF_PASSWORD','CHAOS_QA_AUTO_PROVISION_TEST_USERS','CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS','MASTER_ADMIN_EMAIL','REACT_APP_FIREBASE_PROJECT_ID','REACT_APP_TEST_FIREBASE_PROJECT_ID'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.SYSTEM_ADMIN_EMAIL = '86chaos.qa.system.unit@example.test';
  process.env.SYSTEM_ADMIN_PASSWORD = 'UnitPass!111111111';
  process.env.OWNER_EMAIL = '86chaos.qa.owner.unit@example.test';
  process.env.OWNER_PASSWORD = 'UnitPass!222222222';
  process.env.MANAGER_EMAIL = '86chaos.qa.manager.unit@example.test';
  process.env.MANAGER_PASSWORD = 'UnitPass!333333333';
  process.env.STAFF_EMAIL = '86chaos.qa.staff.unit@example.test';
  process.env.STAFF_PASSWORD = 'UnitPass!444444444';
  process.env.CHAOS_QA_AUTO_PROVISION_TEST_USERS = 'true';
  process.env.CHAOS_QA_ALLOW_MUTATING_ROLE_ACCOUNTS = 'true';
  try { return fn(); }
  finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

function makeFakeAdminApp() {
  const usersByEmail = new Map();
  const claimsByUid = new Map();
  const profiles = new Map();
  const auth = {
    async getUserByEmail(email) {
      const row = usersByEmail.get(String(email).toLowerCase());
      if (!row) {
        const error = new Error('user-not-found');
        error.code = 'auth/user-not-found';
        throw error;
      }
      return row;
    },
    async createUser(input) {
      const uid = `uid-${usersByEmail.size + 1}`;
      const row = { uid, email: String(input.email).toLowerCase(), displayName: input.displayName, disabled: false };
      usersByEmail.set(row.email, row);
      return row;
    },
    async updateUser(uid, patch) {
      const row = [...usersByEmail.values()].find(user => user.uid === uid);
      Object.assign(row, patch);
      return row;
    },
    async setCustomUserClaims(uid, claims) {
      claimsByUid.set(uid, claims);
    },
  };
  const firestore = () => ({
    collection(collectionName) {
      return {
        doc(id) {
          return {
            async set(data) {
              profiles.set(`${collectionName}/${id}`, data);
            },
          };
        },
      };
    },
  });
  return { auth: () => auth, firestore, usersByEmail, claimsByUid, profiles };
}

test('temporary account provisioning refuses the protected root administrator email', () => {
  const { validateProvisionSafety } = freshRequire(provisionAccountsPath);
  const errors = validateProvisionSafety([
    { key: 'systemAdmin', emailEnv: 'SYSTEM_ADMIN_EMAIL', passwordEnv: 'SYSTEM_ADMIN_PASSWORD', label: 'System Administrator', email: 'geoffm1985@gmail.com', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'owner', emailEnv: 'OWNER_EMAIL', passwordEnv: 'OWNER_PASSWORD', label: 'Owner', email: '86chaos.qa.owner@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'manager', emailEnv: 'MANAGER_EMAIL', passwordEnv: 'MANAGER_PASSWORD', label: 'Manager', email: '86chaos.qa.manager@example.test', password: 'x', emailPresent: true, passwordPresent: true },
    { key: 'staff', emailEnv: 'STAFF_EMAIL', passwordEnv: 'STAFF_PASSWORD', label: 'Staff', email: '86chaos.qa.staff@example.test', password: 'x', emailPresent: true, passwordPresent: true },
  ]);
  assert.ok(errors.some(error => /protected root administrator email/.test(error)));
});

test('temporary account provisioning writes System Administrator claim only for the system account', () => {
  const { safeClaimPatchForAccount } = freshRequire(provisionAccountsPath);
  const sys = safeClaimPatchForAccount({ key: 'systemAdmin' });
  const manager = safeClaimPatchForAccount({ key: 'manager' });
  assert.equal(sys.superAdmin, true);
  assert.equal(sys.systemAdministrator, true);
  assert.equal(manager.superAdmin, false);
  assert.equal(manager.systemAdministrator, false);
});

test('temporary account provisioning can create four distinct mocked Firebase Auth users without writing secrets to the report', async () => withTempCwd(async () => {
  await withQaAccountEnv(async () => {
    process.env.CHAOS_RELEASE_GATE_RUN_ID = 'provision-unit';
    process.env.CHAOS_FULL_AUDIT_RUN_ID = 'provision-unit';
    delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
    const fake = makeFakeAdminApp();
    const { provisionTestAccounts } = freshRequire(provisionAccountsPath);
    const report = await provisionTestAccounts({ loadEnvironment: false, enabled: true, adminApp: fake });
    assert.equal(report.ok, true);
    assert.equal(report.accounts.length, 4);
    assert.equal(new Set(report.accounts.map(a => a.uid)).size, 4);
    assert.equal([...fake.claimsByUid.values()].filter(c => c.superAdmin === true).length, 1);
    const serialized = JSON.stringify(report);
    assert.doesNotMatch(serialized, /UnitPass|idToken|refreshToken|private_key/i);
    assert.ok(fake.profiles.size >= 4);
  });
}));

test('PowerShell runners provision temporary accounts before role preflight and before Playwright', () => {
  for (const file of ['RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    assert.match(source, /Provision temporary release-gate test accounts/);
    assert.match(source, /provision-test-accounts\.cjs/);
    assert.match(source, /testAccountProvisionAttempted/);
    assert.match(source, /testAccountProvisionPassed/);
    assert.ok(source.indexOf('Install Chromium browser') < source.indexOf('Provision temporary release-gate test accounts'));
    assert.ok(source.indexOf('Provision temporary release-gate test accounts') < source.indexOf('Verify release-gate role accounts'));
    assert.ok(source.indexOf('Verify release-gate role accounts') < source.indexOf('$RunnerState.playwrightStarted = $true'));
  }
});

test('collector reports account provisioning failure before Playwright without seed or cleanup blame', () => withTempCwd((dir) => {
  process.env.CHAOS_RELEASE_GATE_RUN_ID = 'provision-block-unit';
  process.env.CHAOS_FULL_AUDIT_RUN_ID = 'provision-block-unit';
  delete process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  process.env.CHAOS_RELEASE_GATE_STEP_FAILURES = '1';
  const { ensureRunDir } = freshRequire(runContextPath);
  const { runDir } = ensureRunDir();
  fs.writeFileSync(path.join(runDir, 'runner-state.json'), JSON.stringify({
    runId: 'provision-block-unit',
    dependencyInstallPassed: true,
    dependencyPreflightPassed: true,
    sourceInventoryPassed: true,
    browserInstallPassed: true,
    testAccountProvisionAttempted: true,
    testAccountProvisionPassed: false,
    rolePreflightStarted: false,
    playwrightStarted: false,
    qaDataWritesStarted: false,
    cleanupAttempted: false,
    blockingReason: 'Release gate blocked before tests because temporary release-gate test accounts could not be provisioned.',
    steps: [{ name: 'Provision temporary release-gate test accounts', exitCode: 1, passed: false }],
  }, null, 2));
  fs.writeFileSync(path.join(runDir, 'environment-preflight.json'), JSON.stringify({ ok: true, runId: 'provision-block-unit', appUrl: 'https://preview.example.test/', expectedVersion: '16.0.55', sourceVersion: '16.0.55', deployedVersion: '16.0.55', visibleVersion: '16.0.55', firebaseProjectId: 'chaos-test-d1601' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'dependency-preflight.json'), JSON.stringify({ ok: true, runId: 'provision-block-unit' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'source-inventory.json'), JSON.stringify({ ok: true, runId: 'provision-block-unit', packageVersion: '16.0.55' }, null, 2));
  fs.writeFileSync(path.join(runDir, 'test-account-provisioning.json'), JSON.stringify({ ok: false, runId: 'provision-block-unit', errors: ['Testing Firebase Admin credentials are required to auto-provision release-gate users.'] }, null, 2));
  const oldExit = process.exitCode;
  process.exitCode = 0;
  const collectorPath = path.resolve(__dirname, '../../scripts/86chaos-release-gate/collect-release-gate-report.cjs');
  freshRequire(collectorPath);
  const summaryFile = fs.readdirSync(runDir).find(name => name.startsWith('86chaos-play-store-release-gate-summary-') && name.endsWith('.json'));
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, summaryFile), 'utf8'));
  assert.equal(summary.ok, false);
  assert.equal(summary.playwright.status, 'No tests executed');
  assert.ok(summary.accountProvisionFailures.some(error => /Admin credentials/.test(error)));
  assert.equal(summary.setupFailures.length, 0);
  assert.equal(summary.cleanupFailures.length, 0);
  assert.equal(summary.failureGroups.some(group => group.group === 'test-account-provisioning'), true);
  process.exitCode = oldExit;
}));

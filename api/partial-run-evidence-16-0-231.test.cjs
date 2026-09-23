'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const progress = require('../scripts/86chaos-release-gate/partial-run-evidence.cjs');
const { captureSourceIdentity } = require('../scripts/86chaos-release-gate/source-identity.cjs');
const { generatePlaywrightInventory, stableIdentityKey } = require('../scripts/86chaos-release-gate/playwright-inventory.cjs');
const Reporter = require('../test-tools/reporters/chaos-release-gate-reporter.cjs');
const root = path.resolve(__dirname, '..');
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data));
function fakeTest(row, sourceRoot) {
  return { title: row.leafTitle, projectName: row.project, location: { file: path.join(sourceRoot, 'tests', row.specPath) },
    titlePath: () => ['', row.project, row.specPath, ...(row.fullSuitePath ? row.fullSuitePath.split(' > ') : []), row.leafTitle] };
}
function fixture(t, rows) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-progress-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourceRoot = path.join(directory, 'app'); fs.mkdirSync(sourceRoot);
  const prior = path.join(directory, 'old'); fs.mkdirSync(prior);
  const current = path.join(directory, 'current'); fs.mkdirSync(current);
  const source = { version: '16.0.231', sourceHash: 'a'.repeat(64), commit: 'b'.repeat(40) };
  const records = rows || ['passed', 'failed', 'timeout', 'not run', 'running', 'skipped'].map(leafTitle => ({ specPath: 'e2e/example.spec.cjs', fullSuitePath: 'owner > nested > nested', leafTitle, project: 'chromium' }));
  const preflight = { ok: true, runId: 'prior', sourceVersion: source.version, deployedVersion: source.version, firebaseProjectId: 'chaos-test-d1601', appUrl: 'https://testing.86chaos.com' };
  write(path.join(prior, 'source-identity-start.json'), source); write(path.join(prior, 'environment-preflight.json'), preflight);
  const tests = records.map(row => fakeTest(row, sourceRoot));
  const journal = progress.createProgressJournal({ root: sourceRoot, runDir: prior, tests, mode: 'full', currentSource: source });
  const options = { root: sourceRoot, resultsRoot: directory, baselineRunDir: prior, currentRunDir: current, currentRecords: records, currentSource: source,
    target: { currentSourceVersion: source.version, currentDeployedVersion: source.version, firebaseProjectId: preflight.firebaseProjectId, appUrl: preflight.appUrl } };
  const finish = (index, status) => { journal.record('start', tests[index], {}); journal.record('end', tests[index], { status }); };
  return { directory, sourceRoot, prior, current, source, tests, records, journal, options, finish };
}

test('completed exact identities survive without onEnd; unexecuted, interrupted, failed, timeout and skipped cases stay selected', t => {
  const f = fixture(t); f.finish(0, 'passed'); f.finish(1, 'failed'); f.finish(2, 'timedOut'); f.journal.record('start', f.tests[4]); f.finish(5, 'skipped');
  const result = progress.buildPartialResumeManifest(f.options);
  assert.equal(result.preservedCompletedPasses, 1); assert.equal(result.totalSelected, 5); assert.equal(result.fullReleaseCertified, false);
  assert.equal(result.previousFailuresSelected, 1); assert.equal(result.previousTimeoutsSelected, 1); assert.equal(result.partialNotRunSelected, 2);
  assert.equal(result.selected.some(row => row.leafTitle === 'passed'), false);
  assert.equal(result.selected[0].fullSuitePath, 'owner > nested > nested');
});

test('duplicate leaf titles remain separate by full suite and browser identity', t => {
  const rows = ['owner', 'staff'].flatMap(fullSuitePath => ['chromium', 'mobile-chromium'].map(project => ({ specPath: 'e2e/example.spec.cjs', fullSuitePath, leafTitle: 'same leaf', project })));
  const f = fixture(t, rows); f.finish(0, 'passed');
  const result = progress.buildPartialResumeManifest(f.options);
  assert.equal(result.totalSelected, 3); assert.equal(new Set(result.selected.map(stableIdentityKey)).size, 3);
});

for (const field of ['version', 'sourceHash', 'commit']) test(`source ${field} drift rejects reuse instead of falling back to old results`, t => {
  const f = fixture(t); f.finish(0, 'passed');
  assert.throws(() => progress.buildPartialResumeManifest({ ...f.options, currentSource: { ...f.source, [field]: 'changed' } }), new RegExp(field));
});

for (const [field, value] of [['currentDeployedVersion', '16.0.232'], ['firebaseProjectId', 'cheers-34b8d'], ['appUrl', 'https://different-preview.vercel.app']]) test(`target ${field} drift rejects resume`, t => {
  const f = fixture(t);
  assert.throws(() => progress.buildPartialResumeManifest({ ...f.options, target: { ...f.options.target, [field]: value } }), /Partial resume refused/);
});

test('a changed end-of-run source snapshot blocks resume even if the starting snapshot matches', t => {
  const f = fixture(t); write(path.join(f.prior, 'source-identity-end.json'), { ...f.source, commit: 'changed' });
  assert.throws(() => progress.buildPartialResumeManifest(f.options), /commit/);
});

test('inventory additions, removals, duplicate identities and renamed suites cannot silently reuse old passes', t => {
  const f = fixture(t);
  for (const records of [f.records.slice(1), [...f.records, f.records[0]], f.records.map((row, i) => i ? row : { ...row, fullSuitePath: 'renamed' })]) {
    assert.throws(() => progress.buildPartialResumeManifest({ ...f.options, currentRecords: records }), /inventory changed/);
  }
});

test('an interrupted final append is ignored and its started test remains pending', t => {
  const f = fixture(t); f.finish(0, 'passed'); f.journal.record('start', f.tests[1]);
  fs.appendFileSync(path.join(f.prior, progress.JOURNAL), '{"sequence":');
  const result = progress.buildPartialResumeManifest(f.options);
  assert.equal(result.incompleteTailIgnored, true); assert.equal(result.preservedCompletedPasses, 1);
  assert.equal(result.selected.find(row => row.leafTitle === 'failed').priorStatus, 'notRun');
});

test('completed-line corruption, reordering and an injected pass fail closed', t => {
  const f = fixture(t); f.finish(0, 'passed');
  const file = path.join(f.prior, progress.JOURNAL); const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('"passed"', '"failed"'));
  assert.throws(() => progress.buildPartialResumeManifest(f.options), /corrupt/);
  const lines = original.trimEnd().split('\n'); fs.writeFileSync(file, [lines[0], lines[2], lines[1]].join('\n') + '\n');
  assert.throws(() => progress.buildPartialResumeManifest(f.options), /corrupt/);
});

test('a failed retry followed by pass remains selected for review rather than erasing failure evidence', t => {
  const f = fixture(t); f.finish(0, 'failed'); f.finish(0, 'passed');
  const result = progress.buildPartialResumeManifest(f.options);
  assert.equal(result.selected.find(row => row.leafTitle === 'passed').priorStatus, 'failed');
});

test('required expected-skip companions are rerun, never copied into new PASS totals', t => {
  const leafTitle = 'every route and nested surface fits phone/tablet/laptop/desktop without unusable overflow or tap targets [phone]';
  const f = fixture(t, ['chromium', 'mobile-chromium'].map(project => ({ specPath: '86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs', fullSuitePath: '31 exhaustive responsive layout across nested states', leafTitle, project })));
  f.finish(0, 'passed'); f.finish(1, 'skipped');
  const result = progress.buildPartialResumeManifest(f.options);
  assert.equal(result.totalSelected, 2); assert.equal(result.preservedCompletedPasses, 0);
  assert.deepEqual(result.selected[0].selectionReasons, ['required_skip_companion']);
});

test('selection validation rejects altered identities, altered journal and false certification', t => {
  const f = fixture(t); f.finish(0, 'passed'); const manifest = progress.buildPartialResumeManifest(f.options);
  const options = { ...f.options, ...f.options.target };
  assert.equal(progress.validatePartialResumeManifest(manifest, options).ok, true);
  assert.equal(progress.validatePartialResumeManifest({ ...manifest, selected: manifest.selected.slice(1) }, options).ok, false);
  assert.equal(progress.validatePartialResumeManifest({ ...manifest, fullReleaseCertified: true }, options).ok, false);
  f.finish(1, 'passed'); assert.equal(progress.validatePartialResumeManifest(manifest, options).ok, false);
});

test('missing checkpoints do not select the bundled August interruption; prior journal is never overwritten', t => {
  const f = fixture(t);
  assert.throws(() => progress.createProgressJournal({ root: f.sourceRoot, runDir: f.prior, tests: f.tests, mode: 'full', currentSource: f.source }), /EEXIST/);
  fs.unlinkSync(path.join(f.prior, progress.JOURNAL));
  assert.throws(() => progress.selectPartialResumeManifest({ ...f.options, baselineRunDir: '' }), /no current full-run checkpoint/);
});

test('a certified run is preserved without needlessly rerunning its expected skips', t => {
  const f = fixture(t);
  write(path.join(f.prior, `86chaos-play-store-release-gate-summary-${f.source.version}-prior.json`), { fullReleaseCertified: true });
  assert.throws(() => progress.buildPartialResumeManifest(f.options), /already certified/);
});

test('focused reporters do not require or capture source checkpoints; slim uploads retain the journal', () => {
  assert.equal(progress.createProgressJournal({ root: '/does-not-exist', runDir: '/does-not-exist', mode: 'failed-only' }), null);
  const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  assert.match(runner, /\$allowed = @\([^\n]*'\.jsonl'/);
});

test('the actual reporter persists progress and the actual prepare command selects the current checkpoint', { timeout: 120000 }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-progress-integration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let gitRoot = root;
  let source = captureSourceIdentity(gitRoot);
  // Uploaded source ZIPs do not contain .git. Build an isolated Git fixture only
  // for that environment; a real checkout must use its existing repository and
  // must never require Windows developer-mode/admin symlink privileges.
  if (!source.commit) {
    gitRoot = path.join(directory, 'app');
    const excluded = new Set(['.git', 'node_modules', 'build', 'coverage', 'test-results', 'playwright-report', 'release-evidence']);
    fs.cpSync(root, gitRoot, { recursive: true, filter: candidate => !excluded.has(path.basename(candidate)) });
    cp.execFileSync('git', ['init', '--initial-branch=testing'], { cwd: gitRoot, stdio: 'ignore' });
    cp.execFileSync('git', ['config', 'user.email', 'release-gate-test@86chaos.invalid'], { cwd: gitRoot, stdio: 'ignore' });
    cp.execFileSync('git', ['config', 'user.name', '86 Chaos Release Gate Test'], { cwd: gitRoot, stdio: 'ignore' });
    cp.execFileSync('git', ['add', '.'], { cwd: gitRoot, stdio: 'ignore' });
    cp.execFileSync('git', ['commit', '-m', 'test checkpoint'], { cwd: gitRoot, stdio: 'ignore' });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(gitRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    source = captureSourceIdentity(gitRoot);
  }
  const prior = path.join(directory, 'prior'); const current = path.join(directory, 'current'); fs.mkdirSync(prior); fs.mkdirSync(current);
  assert.ok(source.commit);
  const preflight = { ok: true, runId: 'prior', sourceVersion: source.version, deployedVersion: source.version, firebaseProjectId: 'chaos-test-d1601', appUrl: 'https://testing.86chaos.com' };
  write(path.join(prior, 'source-identity-start.json'), source); write(path.join(prior, 'environment-preflight.json'), preflight);
  write(path.join(current, 'environment-preflight.json'), { ...preflight, runId: 'current' });
  const records = generatePlaywrightInventory({ root: gitRoot }).records;
  const tests = records.map(row => fakeTest(row, gitRoot)); const lines = [];
  const reporter = new Reporter({ root: gitRoot, runDir: prior, mode: 'full', output: line => lines.push(line) });
  reporter.onBegin({}, { allTests: () => tests }); assert.ok(reporter.progressJournal, lines.join('\n'));
  const index = records.findIndex(row => row.specPath.includes('36-restaurant-brain')); assert.ok(index >= 0);
  reporter.onTestBegin(tests[index], {}); reporter.onTestEnd(tests[index], { status: 'passed', duration: 1 });
  assert.equal(progress.readProgressJournal(prior).attempts.size, 1);
  // No onEnd call: simulate a process lost before Playwright writes its report.
  const child = cp.spawnSync(process.execPath, ['scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs', '--mode=partial-resume'], {
    cwd: gitRoot, encoding: 'utf8', timeout: 100000, maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, CHAOS_RELEASE_GATE_RUN_DIR: current, CHAOS_RELEASE_GATE_RUN_ID: 'current', CHAOS_PARTIAL_RESUME_RUN_DIR: prior },
  });
  assert.equal(child.status, 0, child.stderr + child.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(current, 'failed-only-test-manifest.json')));
  assert.equal(manifest.lineageMode, 'partial-checkpoint'); assert.equal(manifest.baselineFullRunId, 'prior');
  assert.equal(manifest.totalSelected, records.length - 1); assert.equal(manifest.fullReleaseCertified, false);
  assert.equal(manifest.selected.some(row => row.stableKey === stableIdentityKey(records[index])), false);
  assert.match(child.stdout, /preserves 1 completed PASS/);
});

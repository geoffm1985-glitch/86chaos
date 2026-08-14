const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

function projectOf(row) {
  return row.project || (row.projects || [])[0] || '';
}

test('partial-resume manifest reruns only failed timed-out and not-run Play Store identities', () => {
  const manifest = json('scripts/86chaos-release-gate/reported-partial-resume-20260813-205319.json');
  const rows = manifest.selected || [];
  const statuses = rows.reduce((acc, row) => {
    const key = String(row.priorStatus || '').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const keys = rows.map(row => row.stableKey || `${row.specPath || row.spec || ''}\u0000${row.fullSuitePath || ''}\u0000${row.leafTitle || row.exactTestTitle || row.title || ''}\u0000${projectOf(row)}`);
  assert.equal(manifest.mode, 'partial-resume');
  assert.equal(rows.length, 156);
  assert.equal(manifest.totalSelected, 156);
  assert.equal(rows.filter(row => projectOf(row) === 'chromium').length, 42);
  assert.equal(rows.filter(row => projectOf(row) === 'mobile-chromium').length, 106);
  assert.equal(statuses.failed, 2);
  assert.equal(statuses.timedout, 3);
  assert.equal(statuses.notrun, 151);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(rows.some(row => String(row.priorStatus || '').toLowerCase() === 'passed' || String(row.baselineStatus || '').toLowerCase() === 'passed'), false);
  assert.match(manifest.note, /excludes the 65 tests that already passed/i);
});

test('partial-resume command and selection guards are wired to the Play Store runner', () => {
  const pkg = json('package.json');
  const prepare = read('scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs');
  const failedConfig = read('playwright.failed-release.config.cjs');
  const psRunner = read('RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1');
  const wrapper = read('RUN_86CHAOS_PARTIAL_RESUME_RELEASE_GATE.ps1');
  assert.equal(pkg.scripts['test:play-store:resume-current'], 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_PARTIAL_RESUME_RELEASE_GATE.ps1');
  assert.equal(pkg.scripts['test:play-store:partial-resume'], 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\RUN_86CHAOS_PARTIAL_RESUME_RELEASE_GATE.ps1');
  assert.match(prepare, /validModes = new Set\(\['failed\+new', 'failed-only', 'repair', 'reported-failed-only', 'partial-resume'\]\)/);
  assert.match(prepare, /reported-partial-resume-20260813-205319\.json/);
  assert.match(prepare, /Partial resume guard: excludes all 65 passed tests from 20260813-205319/);
  assert.match(failedConfig, /resumePartialRun: releaseSelectionMode === 'partial-resume'/);
  assert.match(failedConfig, /partial-resume runs only the FAIL\/TIMEOUT plus NOT-RUN identities/);
  assert.match(psRunner, /ValidateSet\('failed\+new','failed-only','repair','reported-failed-only','partial-resume'\)/);
  assert.match(wrapper, /SelectionMode partial-resume/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const {
  generateFailedOnlyManifestFromRun,
  targetQualifiedManifest,
  validateManifestForCurrentRun,
  validateManifestTestIdentities,
  buildNarrowedManifestFromFailedOnlyRun,
  countPlaywrightResults,
} = require('../scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');

const BASELINE_SELECTIONS = [
  ['chromium', '86chaos-full-audit/01-auth-route-health.spec.cjs', 'owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx'],
  ['mobile-chromium', '86chaos-full-audit/01-auth-route-health.spec.cjs', 'owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx'],
  ['chromium', '86chaos-full-audit/02-permission-role-security.spec.cjs', 'staff account cannot see or use owner/system-admin-only surfaces'],
  ['mobile-chromium', '86chaos-full-audit/02-permission-role-security.spec.cjs', 'staff account cannot see or use owner/system-admin-only surfaces'],
  ['chromium', '86chaos-full-audit/03-safe-button-crawl.spec.cjs', 'safe visible buttons across every major tab do not crash or poison the next route'],
  ['mobile-chromium', '86chaos-full-audit/03-safe-button-crawl.spec.cjs', 'safe visible buttons across every major tab do not crash or poison the next route'],
  ['chromium', '86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs', '86Voice mic button is reachable, lifecycle-safe, and does not pass when missing'],
  ['mobile-chromium', '86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs', '86Voice mic button is reachable, lifecycle-safe, and does not pass when missing'],
  ['mobile-chromium', '86chaos-release-gate/15-interactive-control-census.spec.cjs', 'every visible control has an accessible name and every mutating control is explicitly covered'],
  ['chromium', '86chaos-release-gate/16-accessibility-release-gate.spec.cjs', 'every major route has zero serious or critical axe violations'],
  ['mobile-chromium', '86chaos-release-gate/16-accessibility-release-gate.spec.cjs', 'every major route has zero serious or critical axe violations'],
  ['chromium', '86chaos-release-gate/17-resilience-chunk-offline.spec.cjs', 'one failed lazy chunk never leaves a permanent blank screen or reload loop'],
  ['mobile-chromium', '86chaos-release-gate/17-resilience-chunk-offline.spec.cjs', 'one failed lazy chunk never leaves a permanent blank screen or reload loop'],
];

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-failed-only-'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function makePlaywrightReport(selections = BASELINE_SELECTIONS) {
  return {
    suites: [{
      title: 'failed baseline fixture',
      specs: selections.map(([project, specPath, title], index) => ({
        title,
        file: specPath,
        tests: [{
          title,
          projectName: project,
          results: [{ status: index === selections.length - 1 ? 'timedOut' : 'failed', duration: 1000 + index, error: { message: `baseline failure ${index}` } }],
        }],
      })),
    }],
  };
}

function makeBaselineRun({ sourceVersion = '16.0.133', deployedVersion = '16.0.133', mode = 'full', playwrightStarted = true, selections = BASELINE_SELECTIONS } = {}) {
  const dir = tempDir();
  writeJson(path.join(dir, 'runner-state.json'), { runId: 'baseline-run', mode, playwrightStarted });
  writeJson(path.join(dir, 'environment-preflight.json'), { runId: 'baseline-run', sourceVersion, deployedVersion, visibleVersion: deployedVersion, firebaseProjectId: 'chaos-test-d1601' });
  if (selections) writeJson(path.join(dir, 'playwright-report.json'), makePlaywrightReport(selections));
  return dir;
}


function makeFailedOnlyRunFromBaseline(manifest, { sourceVersion = '16.0.137', deployedVersion = '16.0.137' } = {}) {
  const dir = tempDir();
  writeJson(path.join(dir, 'runner-state.json'), { runId: 'failed-only-descendant', mode: 'failed-only', playwrightStarted: true, cleanupCompleted: true });
  writeJson(path.join(dir, 'environment-preflight.json'), { runId: 'failed-only-descendant', sourceVersion, deployedVersion, visibleVersion: deployedVersion, firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(dir, 'failed-only-test-manifest.json'), manifest);
  const passingKeys = new Set([
    'chromium|86chaos-full-audit/02-permission-role-security.spec.cjs',
    'mobile-chromium|86chaos-full-audit/02-permission-role-security.spec.cjs',
    'chromium|86chaos-release-gate/16-accessibility-release-gate.spec.cjs',
    'mobile-chromium|86chaos-release-gate/16-accessibility-release-gate.spec.cjs',
  ]);
  const timedOutKeys = new Set([
    'chromium|86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs',
    'mobile-chromium|86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs',
  ]);
  const report = {
    suites: [{
      title: 'failed-only descendant fixture',
      specs: manifest.selected.map((item, index) => {
        const key = `${item.project}|${item.specPath}`;
        const status = passingKeys.has(key) ? 'passed' : (timedOutKeys.has(key) ? 'timedOut' : 'failed');
        return {
          title: item.title,
          file: item.specPath,
          tests: [{
            projectName: item.project,
            results: [{ status, duration: 1000 + index, error: status === 'passed' ? undefined : { message: `${status} ${index}` } }],
          }],
        };
      }),
    }],
  };
  writeJson(path.join(dir, 'playwright-report.json'), report);
  return dir;
}


function makeNineCaseFailedOnlyRun(manifest, { sourceVersion = '16.0.139', deployedVersion = '16.0.139' } = {}) {
  const dir = tempDir();
  writeJson(path.join(dir, 'runner-state.json'), { runId: 'failed-only-nine-case', mode: 'failed-only', playwrightStarted: true, cleanupCompleted: true });
  writeJson(path.join(dir, 'environment-preflight.json'), { runId: 'failed-only-nine-case', sourceVersion, deployedVersion, visibleVersion: deployedVersion, firebaseProjectId: 'chaos-test-d1601' });
  writeJson(path.join(dir, 'failed-only-test-manifest.json'), manifest);
  const passingKeys = new Set([
    'chromium|86chaos-release-gate/17-resilience-chunk-offline.spec.cjs',
    'mobile-chromium|86chaos-release-gate/17-resilience-chunk-offline.spec.cjs',
    'mobile-chromium|86chaos-release-gate/15-interactive-control-census.spec.cjs',
  ]);
  const timedOutKeys = new Set([
    'mobile-chromium|86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs',
  ]);
  const report = {
    suites: [{
      title: 'failed-only nine-case fixture',
      specs: manifest.selected.map((item, index) => {
        const key = `${item.project}|${item.specPath}`;
        const status = passingKeys.has(key) ? 'passed' : (timedOutKeys.has(key) ? 'timedOut' : 'failed');
        return {
          title: item.title,
          file: item.specPath,
          tests: [{
            title: item.title,
            projectName: item.project,
            results: [{ status, duration: 1000 + index, error: status === 'passed' ? undefined : { message: `${status} ${index}` } }],
          }],
        };
      }),
    }],
  };
  writeJson(path.join(dir, 'playwright-report.json'), report);
  return dir;
}

function buildAcceptedManifest(targetSourceVersion = '16.0.135', targetDeployedVersion = targetSourceVersion) {
  const baselineDir = makeBaselineRun();
  const manifest = generateFailedOnlyManifestFromRun(baselineDir, { write: false, currentRunDir: tempDir() });
  return targetQualifiedManifest(manifest, {
    targetRunId: 'target-run',
    targetRunDir: tempDir(),
    targetSourceVersion,
    targetDeployedVersion,
  });
}

test('valid cross-version remediation preserves 16.0.133 baseline while accepting 16.0.135 target', () => {
  const manifest = buildAcceptedManifest('16.0.135');
  const validation = validateManifestForCurrentRun(manifest, {
    root,
    currentRunDir: manifest.targetRunDir,
    currentSourceVersion: '16.0.135',
    currentDeployedVersion: '16.0.135',
    firebaseProjectId: 'chaos-test-d1601',
    appUrl: 'https://testing-preview.vercel.app',
  });

  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(manifest.baselineSourceVersion, '16.0.133');
  assert.equal(manifest.baselineDeployedVersion, '16.0.133');
  assert.equal(manifest.targetSourceVersion, '16.0.135');
  assert.equal(manifest.targetDeployedVersion, '16.0.135');
  assert.equal(manifest.totalSelected, 13);
  assert.equal(manifest.desktopSelected, 6);
  assert.equal(manifest.mobileSelected, 7);
});

test('same-version diagnostic rerun is accepted when baseline and target are otherwise safe', () => {
  const manifest = buildAcceptedManifest('16.0.133');
  const validation = validateManifestForCurrentRun(manifest, {
    root,
    currentRunDir: manifest.targetRunDir,
    currentSourceVersion: '16.0.133',
    currentDeployedVersion: '16.0.133',
    firebaseProjectId: 'chaos-test-d1601',
    appUrl: 'https://testing-preview.vercel.app',
  });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
});

test('target preview mismatch is rejected before QA seeding', () => {
  const manifest = buildAcceptedManifest('16.0.135', '16.0.134');
  const validation = validateManifestForCurrentRun(manifest, {
    root,
    currentRunDir: manifest.targetRunDir,
    currentSourceVersion: '16.0.135',
    currentDeployedVersion: '16.0.134',
    firebaseProjectId: 'chaos-test-d1601',
    appUrl: 'https://testing-preview.vercel.app',
  });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /Target source\/deployed versions do not match/);
});

test('invalid baseline evidence is rejected precisely', () => {
  const mismatchDir = makeBaselineRun({ sourceVersion: '16.0.133', deployedVersion: '16.0.132' });
  const failedOnlyDir = makeBaselineRun({ mode: 'failed-only' });
  const noPlaywrightDir = makeBaselineRun({ playwrightStarted: false });
  fs.rmSync(path.join(noPlaywrightDir, 'playwright-report.json'));
  const zeroFailureDir = makeBaselineRun({ selections: [] });

  assert.throws(() => generateFailedOnlyManifestFromRun(mismatchDir, { write: false, currentRunDir: tempDir() }), /Baseline source\/deployed versions do not match/);
  assert.throws(() => generateFailedOnlyManifestFromRun(failedOnlyDir, { write: false, currentRunDir: tempDir() }), /failed-only run/);
  assert.throws(() => generateFailedOnlyManifestFromRun(noPlaywrightDir, { write: false, currentRunDir: tempDir() }), /Playwright execution did not start|no readable Playwright report/);
  assert.throws(() => generateFailedOnlyManifestFromRun(zeroFailureDir, { write: false, currentRunDir: tempDir() }), /zero failed or timed-out tests|zero tests/);
});

test('current test identity validation rejects removed specs, titles, projects, and zero-test false greens', () => {
  const manifest = buildAcceptedManifest('16.0.135');
  const missingSpec = { ...manifest, selected: [{ ...manifest.selected[0], specPath: 'missing/spec.cjs', spec: 'missing/spec.cjs' }] };
  const missingTitle = { ...manifest, selected: [{ ...manifest.selected[0], title: 'not the real title', exactTestTitle: 'not the real title' }] };
  const missingProject = { ...manifest, selected: [{ ...manifest.selected[0], project: 'old-browser', projects: ['old-browser'] }] };
  const empty = { ...manifest, selected: [] };

  assert.match(validateManifestTestIdentities(missingSpec, { root }).errors.join('\n'), /spec no longer exists/);
  assert.match(validateManifestTestIdentities(missingTitle, { root }).errors.join('\n'), /title no longer exists/);
  assert.match(validateManifestTestIdentities(missingProject, { root }).errors.join('\n'), /project no longer exists/);
  assert.match(validateManifestTestIdentities(empty, { root }).errors.join('\n'), /selected zero tests/);
});


test('latest compatible failed-only descendant narrows selection to nine remaining failures and timeouts', () => {
  const baselineManifest = buildAcceptedManifest('16.0.137');
  const failedOnlyDir = makeFailedOnlyRunFromBaseline(baselineManifest);
  const narrowed = buildNarrowedManifestFromFailedOnlyRun(failedOnlyDir, {
    baselineManifest,
    target: { targetRunId: 'target-138', targetSourceVersion: '16.0.138', targetDeployedVersion: '16.0.138' },
    currentRunDir: tempDir(),
  });
  const selectedKeys = narrowed.selected.map(item => `${item.project}|${item.specPath}`);

  assert.equal(narrowed.selectionSource, 'latest-compatible-failed-only-result');
  assert.equal(narrowed.baselineSourceVersion, '16.0.133');
  assert.equal(narrowed.previousFailedOnlySourceVersion, '16.0.137');
  assert.equal(narrowed.targetSourceVersion, '16.0.138');
  assert.equal(narrowed.totalSelected, 9);
  assert.equal(narrowed.desktopSelected, 4);
  assert.equal(narrowed.mobileSelected, 5);
  assert.equal(selectedKeys.includes('chromium|86chaos-full-audit/02-permission-role-security.spec.cjs'), false);
  assert.equal(selectedKeys.includes('mobile-chromium|86chaos-release-gate/16-accessibility-release-gate.spec.cjs'), false);
  assert.equal(selectedKeys.includes('mobile-chromium|86chaos-release-gate/15-interactive-control-census.spec.cjs'), true);
});

test('latest compatible nine-case failed-only descendant narrows selection to six inherited failures', () => {
  const baselineManifest = buildAcceptedManifest('16.0.137');
  const failedOnlyDir = makeFailedOnlyRunFromBaseline(baselineManifest);
  const nine = buildNarrowedManifestFromFailedOnlyRun(failedOnlyDir, {
    baselineManifest,
    target: { targetRunId: 'target-138', targetSourceVersion: '16.0.138', targetDeployedVersion: '16.0.138' },
    currentRunDir: tempDir(),
  });
  const nineDir = makeNineCaseFailedOnlyRun(nine);
  const six = buildNarrowedManifestFromFailedOnlyRun(nineDir, {
    baselineManifest,
    target: { targetRunId: 'target-140', targetSourceVersion: '16.0.140', targetDeployedVersion: '16.0.140' },
    currentRunDir: tempDir(),
  });
  const selectedKeys = six.selected.map(item => `${item.project}|${item.specPath}`);
  assert.equal(six.selectionSource, 'latest-compatible-failed-only-result');
  assert.equal(six.previousFailedOnlySourceVersion, '16.0.139');
  assert.equal(six.targetSourceVersion, '16.0.140');
  assert.equal(six.totalSelected, 6);
  assert.equal(six.desktopSelected, 3);
  assert.equal(six.mobileSelected, 3);
  assert.equal(selectedKeys.includes('chromium|86chaos-release-gate/17-resilience-chunk-offline.spec.cjs'), false);
  assert.equal(selectedKeys.includes('mobile-chromium|86chaos-release-gate/17-resilience-chunk-offline.spec.cjs'), false);
  assert.equal(selectedKeys.includes('mobile-chromium|86chaos-release-gate/15-interactive-control-census.spec.cjs'), false);
  assert.equal(selectedKeys.includes('chromium|86chaos-full-audit/01-auth-route-health.spec.cjs'), true);
  assert.equal(selectedKeys.includes('mobile-chromium|86chaos-full-audit/11-mobile-desktop-voice-upload.spec.cjs'), true);
});

test('failed-only status counts are mutually exclusive', () => {
  const manifest = buildAcceptedManifest('16.0.137');
  const failedOnlyDir = makeFailedOnlyRunFromBaseline(manifest);
  const report = JSON.parse(fs.readFileSync(path.join(failedOnlyDir, 'playwright-report.json'), 'utf8'));
  const counts = countPlaywrightResults(report);

  assert.equal(counts.total, 13);
  assert.equal(counts.passed, 4);
  assert.equal(counts.failed, 7);
  assert.equal(counts.timedOut, 2);
  assert.equal(counts.skipped, 0);
  assert.equal(counts.unexpected, 9);
});

test('failed-only reporting and runner source keep baseline and target distinct', () => {
  const helper = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/failed-only-manifest-utils.cjs'), 'utf8');
  const prepare = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/prepare-failed-only-manifest.cjs'), 'utf8');
  const runner = fs.readFileSync(path.join(root, 'RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1'), 'utf8');
  const collector = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/collect-release-gate-report.cjs'), 'utf8');

  assert.match(helper, /baselineSourceVersion/);
  assert.match(helper, /targetSourceVersion/);
  assert.match(prepare, /failed-only-manifest-validation\.json/);
  assert.match(runner, /ManifestValidation/);
  assert.doesNotMatch(runner, /missing, stale, empty, or version-mismatched/);
  assert.match(collector, /failedOnlyMode/);
  assert.match(collector, /fullGateOnlyArtifacts/);
  assert.match(collector, /attemptStatus/);
  assert.match(collector, /noTestsSelectedFailure/);
  assert.match(collector, /seedReportPresent/);
  assert.match(collector, /cleanupReportPresent/);
});


test('failed-only Playwright grep matches exact selected titles inside Playwright title paths', () => {
  const { grepForProject, specsFromManifest } = require('../tests/86chaos-release-gate/failed-only-manifest.cjs');
  const manifest = buildAcceptedManifest('16.0.136');
  const desktopGrep = grepForProject(manifest.selected, 'chromium');
  const mobileGrep = grepForProject(manifest.selected, 'mobile-chromium');

  assert.equal(specsFromManifest(manifest.selected).includes('**/86chaos-full-audit/01-auth-route-health.spec.cjs'), true);
  assert.equal(desktopGrep.test('01 auth and every-route health owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx'), true);
  assert.equal(desktopGrep.test('86chaos-full-audit/02-permission-role-security.spec.cjs staff account cannot see or use owner/system-admin-only surfaces'), true);
  assert.equal(mobileGrep.test('16 accessibility release gate every major route has zero serious or critical axe violations'), true);
  assert.equal(desktopGrep.test('owner-like account logs in and every major route renders without fatal UI, NaN, Invalid Date, or 5xx extra words'), false);
  assert.equal(desktopGrep.test('not the real selected test'), false);
});

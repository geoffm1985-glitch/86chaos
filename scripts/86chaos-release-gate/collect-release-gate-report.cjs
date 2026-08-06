const fs = require('fs');
const path = require('path');
const { ensureRunDir, readJsonIfExists } = require('./run-context.cjs');
const { generateFailedOnlyManifestFromRun } = require('./failed-only-manifest-utils.cjs');
const releaseGateJsonDiagnostics = [];

const { root, resultsRoot, runId, runDir } = ensureRunDir();
fs.mkdirSync(runDir, { recursive: true });

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}
function readJson(p) { return readJsonIfExists(p, releaseGateJsonDiagnostics); }
function rel(p) { return path.relative(root, p).replace(/\\/g, '/'); }
function hasOwn(data, key) { return Object.prototype.hasOwnProperty.call(data || {}, key); }

const requiredArtifacts = [
  'runner-state.json',
  'environment-preflight.json',
  'dependency-preflight.json',
  'source-inventory.json',
  'test-account-provisioning.json',
  'role-identity-verification.json',
  'java-prerequisite.json',
  'node-test-live-summary.json',
  'firebase-rules-release-gate.json',
  'qa-setup-state.json',
  '86chaos-full-audit-seed-report.json',
  'playwright-report.json',
  '86chaos-full-audit-cleanup-report.json',
];
const artifact = Object.fromEntries(requiredArtifacts.map(name => [name, path.join(runDir, name)]));
let missingArtifacts = requiredArtifacts.filter(name => !fs.existsSync(artifact[name]));

const runnerState = readJsonIfExists(artifact['runner-state.json'], releaseGateJsonDiagnostics) || {};
const preflight = readJsonIfExists(artifact['environment-preflight.json'], releaseGateJsonDiagnostics) || {};
const dependencyPreflight = readJsonIfExists(artifact['dependency-preflight.json'], releaseGateJsonDiagnostics) || {};
const sourceInventory = readJsonIfExists(artifact['source-inventory.json'], releaseGateJsonDiagnostics) || {};
const testAccountProvisioning = readJsonIfExists(artifact['test-account-provisioning.json'], releaseGateJsonDiagnostics) || {};
const roleVerification = readJsonIfExists(artifact['role-identity-verification.json'], releaseGateJsonDiagnostics) || {};
const javaPrerequisite = readJsonIfExists(artifact['java-prerequisite.json'], releaseGateJsonDiagnostics) || {};
const nodeTestSummary = readJsonIfExists(artifact['node-test-live-summary.json'], releaseGateJsonDiagnostics) || {};
const rulesGateReport = readJsonIfExists(artifact['firebase-rules-release-gate.json'], releaseGateJsonDiagnostics) || {};
const setupState = readJsonIfExists(artifact['qa-setup-state.json'], releaseGateJsonDiagnostics) || {};
const seedReport = readJsonIfExists(artifact['86chaos-full-audit-seed-report.json'], releaseGateJsonDiagnostics) || {};
const cleanupReport = readJsonIfExists(artifact['86chaos-full-audit-cleanup-report.json'], releaseGateJsonDiagnostics) || {};
let failedOnlyManifest = readJsonIfExists(path.join(runDir, 'failed-only-test-manifest.json'), releaseGateJsonDiagnostics) || null;
const failedOnlyManifestValidation = readJsonIfExists(path.join(runDir, 'failed-only-manifest-validation.json'), releaseGateJsonDiagnostics) || {};

const preflightRan = preflight && Object.keys(preflight).length > 0;
const preflightFailedBeforeMutation = preflightRan && preflight.ok === false;
const preflightFailures = preflightFailedBeforeMutation
  ? (Array.isArray(preflight.errors) && preflight.errors.length ? [...preflight.errors] : ['Environment preflight failed before QA seeding.'])
  : [];

const runnerBlockingReason = String(runnerState.blockingReason || '').trim();
const runnerPhase = String(runnerState.currentPhase || '').trim();
const failedOnlyMode = String(runnerState.mode || '').toLowerCase() === 'failed-only' || process.env.CHAOS_FAILED_ONLY_RELEASE_GATE === 'true';
const fullGateOnlyArtifacts = new Set(['java-prerequisite.json', 'node-test-live-summary.json', 'firebase-rules-release-gate.json']);
if (failedOnlyMode) missingArtifacts = missingArtifacts.filter(name => !fullGateOnlyArtifacts.has(name));
const playwrightStarted = runnerState.playwrightStarted === true;
const dependencyInstallIncomplete = runnerState.dependencyInstallAttempted === true && runnerState.dependencyInstallPassed !== true;
const blockedBeforePlaywright = Boolean((runnerBlockingReason || dependencyInstallIncomplete || /install-locked-test-dependencies|role|provision|account|playwright|java|coverage/i.test(runnerPhase)) && !playwrightStarted);
const rolePreflightFailed = runnerState.rolePreflightStarted === true && runnerState.rolePreflightPassed !== true;
const rolePreflightPassed = runnerState.rolePreflightPassed === true;

function skippedByRunnerBlock(name) {
  if (name === 'runner-state.json' || name === 'environment-preflight.json') return false;
  if (failedOnlyMode && fullGateOnlyArtifacts.has(name)) return true;
  if (preflightFailedBeforeMutation) return true;
  if (!blockedBeforePlaywright) return false;
  if (runnerState.dependencyInstallPassed !== true) {
    return ['dependency-preflight.json', 'source-inventory.json', 'test-account-provisioning.json', 'role-identity-verification.json', 'java-prerequisite.json', 'node-test-live-summary.json', 'firebase-rules-release-gate.json', 'qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  if (runnerState.dependencyPreflightPassed !== true) {
    return ['source-inventory.json', 'role-identity-verification.json', 'qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  if (runnerState.sourceInventoryPassed !== true) {
    return ['test-account-provisioning.json', 'role-identity-verification.json', 'qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  if (runnerState.browserInstallPassed !== true) {
    return ['test-account-provisioning.json', 'role-identity-verification.json', 'qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  if (name === 'java-prerequisite.json' && (runnerState.currentPhase || '').toLowerCase().indexOf('rules') < 0) return true;
  if (runnerState.testAccountProvisionAttempted === true && runnerState.testAccountProvisionPassed !== true) {
    return ['role-identity-verification.json', 'java-prerequisite.json', 'node-test-live-summary.json', 'firebase-rules-release-gate.json', 'qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  if (runnerState.rolePreflightStarted === true && runnerState.rolePreflightPassed !== true) {
    return ['qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  if (playwrightStarted !== true) {
    return ['qa-setup-state.json', '86chaos-full-audit-seed-report.json', 'playwright-report.json', '86chaos-full-audit-cleanup-report.json'].includes(name);
  }
  return false;
}

const artifactsSkippedByPreflight = preflightFailedBeforeMutation
  ? missingArtifacts.filter(name => skippedByRunnerBlock(name))
  : [];
const artifactsSkippedByRunnerBlock = blockedBeforePlaywright
  ? missingArtifacts.filter(name => skippedByRunnerBlock(name)).map(name => ({ artifact: name, reason: `Not created because test execution was blocked before Playwright global setup: ${runnerBlockingReason}` }))
  : [];
missingArtifacts = missingArtifacts.filter(name => !skippedByRunnerBlock(name));

const files = walk(runDir);
const jsonFiles = files.filter(p => p.endsWith('.json'));
const summaries = jsonFiles.map(p => ({ file: rel(p), data: readJson(p) })).filter(x => x.data);
const playwright = readJson(artifact['playwright-report.json']);
const tests = [];
function collectSuites(suites = [], parents = []) {
  for (const suite of suites) {
    const nextParents = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        for (const r of t.results || []) {
          tests.push({
            title: [...nextParents, spec.title, t.title].filter(Boolean).join(' > '),
            status: r.status,
            error: r.error?.message || '',
            duration: r.duration || 0,
            projectName: t.projectName || '',
            file: spec.file || '',
          });
        }
      }
    }
    collectSuites(suite.suites || [], nextParents);
  }
}
if (playwright) collectSuites(playwright.suites || []);
const failedTests = tests.filter(t => !['passed', 'skipped'].includes(t.status));
const skippedTests = tests.filter(t => t.status === 'skipped');
const timedOutTests = tests.filter(t => t.status === 'timedOut' || /timeout/i.test(t.error || ''));
if (!failedOnlyManifest && playwright && failedTests.length > 0 && String(runnerState.mode || '').toLowerCase() !== 'failed-only') {
  try {
    failedOnlyManifest = generateFailedOnlyManifestFromRun(runDir, { write: true });
  } catch (error) {
    releaseGateJsonDiagnostics.push({ file: 'failed-only-test-manifest.json', error: error?.message || String(error) });
  }
}

const appUrl = process.env.APP_URL || process.env.CHAOS_BASE_URL || preflight.appUrl || '';
const expectedVersion = process.env.CHAOS_EXPECTED_VERSION || preflight.expectedVersion || '';
const testedVersion = preflight.deployedVersion || preflight.visibleVersion || expectedVersion || '';
const stepFailures = Number(process.env.CHAOS_RELEASE_GATE_STEP_FAILURES || 0);
const versionMismatch = Boolean(expectedVersion && testedVersion && expectedVersion !== testedVersion);
if (versionMismatch) missingArtifacts.push(`version-mismatch expected=${expectedVersion} tested=${testedVersion}`);

const runMismatchFailures = [];
for (const [name, data] of Object.entries({ runnerState, preflight, dependencyPreflight, sourceInventory, testAccountProvisioning, roleVerification, javaPrerequisite, nodeTestSummary, rulesGateReport, setupState, seedReport, cleanupReport })) {
  if (data && data.runId && data.runId !== runId) runMismatchFailures.push(`${name} runId=${data.runId} expected=${runId}`);
}
if (runMismatchFailures.length) missingArtifacts.push(...runMismatchFailures.map(x => `run-mismatch ${x}`));

const dependencyFailures = [];
if (hasOwn(dependencyPreflight, 'ok') && dependencyPreflight.ok !== true) {
  dependencyFailures.push(...(Array.isArray(dependencyPreflight.errors) && dependencyPreflight.errors.length ? dependencyPreflight.errors : ['Dependency preflight failed.']));
}
if (blockedBeforePlaywright && /dependenc/i.test(runnerBlockingReason) && !dependencyFailures.length) dependencyFailures.push(runnerBlockingReason);
if (dependencyInstallIncomplete && !dependencyFailures.length) dependencyFailures.push(runnerBlockingReason || 'Dependency installation started but did not record completion, exit code, timeout, or failure details.');

const accountProvisionFailures = [];
if (hasOwn(testAccountProvisioning, 'ok') && testAccountProvisioning.ok !== true) {
  accountProvisionFailures.push(...(Array.isArray(testAccountProvisioning.errors) && testAccountProvisioning.errors.length ? testAccountProvisioning.errors : ['Temporary release-gate test account provisioning failed.']));
}
if (blockedBeforePlaywright && /provision|temporary release-gate test accounts/i.test(runnerBlockingReason) && !accountProvisionFailures.length) accountProvisionFailures.push(runnerBlockingReason);

const provisioningBlockedBeforeRole = Boolean(runnerState.testAccountProvisionAttempted === true && runnerState.testAccountProvisionPassed !== true);
const roleFailures = [];
if (!accountProvisionFailures.length && !provisioningBlockedBeforeRole && hasOwn(roleVerification, 'ok') && roleVerification.ok !== true) {
  roleFailures.push(...(Array.isArray(roleVerification.errors) && roleVerification.errors.length ? roleVerification.errors : ['Release-gate role account preflight failed.']));
}
if (!accountProvisionFailures.length && !provisioningBlockedBeforeRole && blockedBeforePlaywright && /role|account|MANAGER_EMAIL|OWNER_EMAIL|STAFF_EMAIL|SYSTEM_ADMIN_EMAIL|System Administrator|superAdmin/i.test(runnerBlockingReason) && !roleFailures.length) {
  roleFailures.push(runnerBlockingReason);
}

const setupFailures = [];
if (setupState && setupState.errors?.length) setupFailures.push(...setupState.errors);
if (!accountProvisionFailures.length && setupState && setupState.attempted && setupState.verified !== true) setupFailures.push('QA setup was attempted but not verified.');
if (fs.existsSync(artifact['86chaos-full-audit-seed-report.json']) && seedReport && seedReport.ok !== true) setupFailures.push(`Seed report not ok:true: ${seedReport.error || 'unknown seed failure'}`);
if (seedReport && seedReport.verification && seedReport.verification.ok !== true) setupFailures.push('Seed verification failed.');


function firstCleanupError(report = {}) {
  const failed = Array.isArray(report.failed) ? report.failed : [];
  if (failed.length) {
    const first = failed[0];
    return first.error || first.reason || first.message || JSON.stringify(first).slice(0, 500);
  }
  const failures = Array.isArray(report.failures) ? report.failures : [];
  if (failures.length) {
    const first = failures[0];
    return first.error || first.reason || first.message || JSON.stringify(first).slice(0, 500);
  }
  const storageFailures = Array.isArray(report.storage?.failures) ? report.storage.failures : [];
  if (storageFailures.length) {
    const first = storageFailures[0];
    return first.error || first.reason || first.message || JSON.stringify(first).slice(0, 500);
  }
  const unresolved = Array.isArray(report.storage?.unresolved) ? report.storage.unresolved : [];
  if (unresolved.length) {
    const first = unresolved[0];
    return first.error || (Array.isArray(first.errors) ? first.errors.join('; ') : '') || JSON.stringify(first).slice(0, 500);
  }
  return report.error || 'unknown cleanup failure';
}

const cleanupFailures = [];
const cleanupRequired = setupState && (setupState.writesStarted === true || setupState.qaDataWritesStarted === true || (setupState.attempted === true && setupState.seeded === true));
if (fs.existsSync(artifact['86chaos-full-audit-cleanup-report.json']) && cleanupReport && cleanupReport.ok !== true) cleanupFailures.push(`Cleanup report not ok:true: ${firstCleanupError(cleanupReport)}`);
if (cleanupRequired && !fs.existsSync(artifact['86chaos-full-audit-cleanup-report.json'])) cleanupFailures.push('Cleanup report is missing after verified QA seed.');
if (cleanupReport && cleanupReport.runId && cleanupReport.runId !== runId) cleanupFailures.push(`Cleanup used runId ${cleanupReport.runId} instead of ${runId}.`);
if (cleanupReport && cleanupReport.restaurantRemaining) cleanupFailures.push('Current-run restaurant still remains after cleanup.');
if (cleanupReport && cleanupReport.remaining && Object.keys(cleanupReport.remaining).length) cleanupFailures.push(`Current-run child records remain: ${JSON.stringify(cleanupReport.remaining)}`);
if (cleanupReport && cleanupReport.accountedFailures?.length) cleanupFailures.push(`Cleanup did not account for seeded records: ${JSON.stringify(cleanupReport.accountedFailures)}`);

const noTestsExecuted = tests.length === 0;
const blockedBeforeTestExecution = Boolean(noTestsExecuted && (blockedBeforePlaywright || runnerState.blockedBeforeTestExecution === true || !playwrightStarted));
const releaseGateStatus = ok => ok ? 'PASS' : (blockedBeforeTestExecution ? 'BLOCKED BEFORE TEST EXECUTION' : 'FAIL');
const executionBlockedMessage = blockedBeforePlaywright
  ? `Not created because test execution was blocked before Playwright global setup: ${runnerBlockingReason}`
  : '';
const earlyPrimaryBlockingFailurePlaceholder = '';

const failureGroups = [];
function addGroup(group, example) {
  if (!failureGroups.some(x => x.group === group)) failureGroups.push({ group, examples: [] });
  const row = failureGroups.find(x => x.group === group);
  if (example && row.examples.length < 5) row.examples.push(example);
}
if (failedOnlyManifestValidation && failedOnlyManifestValidation.ok === false) {
  const example = failedOnlyManifestValidation.primaryBlockingFailure || (Array.isArray(failedOnlyManifestValidation.errors) ? failedOnlyManifestValidation.errors[0] : '') || 'Failed-only manifest validation failed.';
  addGroup('failed-only-manifest', example);
}
if (runnerBlockingReason) {
  const group = provisioningBlockedBeforeRole || /provision/i.test(runnerBlockingReason)
    ? 'test-account-provisioning'
    : (/role|account|MANAGER_EMAIL|OWNER_EMAIL|STAFF_EMAIL|SYSTEM_ADMIN_EMAIL|System Administrator|superAdmin/i.test(runnerBlockingReason)
      ? 'test-account-configuration'
      : (/dependenc|npm ci|module|Playwright executable|Chromium/i.test(runnerBlockingReason) ? 'dependency-preflight' : 'runner-blocker'));
  addGroup(group, runnerBlockingReason);
}
for (const text of preflightFailures) addGroup('environment-preflight', text);
for (const text of dependencyFailures) addGroup('dependency-preflight', text);
for (const text of accountProvisionFailures) addGroup('test-account-provisioning', text);
if (!accountProvisionFailures.length && !provisioningBlockedBeforeRole) for (const text of roleFailures) addGroup('test-account-configuration', text);
const groupRe = [
  [/setup|seed|cleanup|stale|runId|artifact/i, 'harness-seed-cleanup'],
  [/timeout/i, 'timeout'],
  [/System Administrator|Restricted Platform Tools|superAdmin|manager/i, 'role-permission'],
  [/Schedule Builder|Allen QA|Chuck QA|Lani QA/i, 'schedule-seed-visibility'],
  [/axe|WCAG|contrast|keyboard|focus/i, 'accessibility'],
  [/listener|Firestore|write storm|Listen/i, 'firebase-idempotency'],
  [/chunk|reload loop/i, 'chunk-recovery'],
  [/400|5xx|requestfailed|connection reset/i, 'network-classification'],
  [/coverage|JavaScript/i, 'runtime-coverage'],
  [/control|mutating/i, 'control-census'],
];
for (const t of failedTests) {
  const text = `${t.title}\n${t.error}`;
  addGroup(groupRe.find(([re]) => re.test(text))?.[1] || 'other', t.title);
}
for (const text of [...setupFailures, ...cleanupFailures, ...missingArtifacts]) {
  const group = /seed|cleanup|setup|artifact|run/i.test(text) ? 'harness-seed-cleanup' : 'reporting';
  addGroup(group, text);
}


const javaFailures = [];
if (hasOwn(javaPrerequisite, 'ok') && javaPrerequisite.ok !== true) {
  javaFailures.push(javaPrerequisite.message || 'Java prerequisite missing; Firestore and Storage emulator rules tests were blocked.');
}
const nodeFailures = [];
if (hasOwn(nodeTestSummary, 'ok') && nodeTestSummary.ok !== true) {
  for (const t of (nodeTestSummary.results || nodeTestSummary.tests || [])) {
    if (['failed', 'cancelled', 'blocked'].includes(t.status)) nodeFailures.push(`${t.group || t.title || t.command}: ${t.firstUsefulFailure || t.error || t.status}`);
  }
  if (!nodeFailures.length) nodeFailures.push('Node test live summary reported failure without individual details.');
}
for (const text of javaFailures) addGroup('missing-java-prerequisite', text);
for (const text of nodeFailures) addGroup('node-test-failure', text);

const primaryBlockingFailure = preflightFailures[0]
  || dependencyFailures[0]
  || accountProvisionFailures[0]
  || roleFailures[0]
  || javaFailures[0]
  || nodeFailures[0]
  || setupFailures[0]
  || cleanupFailures[0]
  || (rulesGateReport?.firstActionableFailure || '')
  || (failedTests[0] ? `${failedTests[0].title}: ${failedTests[0].error}` : '')
  || runnerBlockingReason
  || (missingArtifacts[0] ? `Missing artifact: ${missingArtifacts[0]}` : '');

const ok = failedTests.length === 0
  && timedOutTests.length === 0
  && skippedTests.length === 0
  && stepFailures === 0
  && missingArtifacts.length === 0
  && !versionMismatch
  && setupFailures.length === 0
  && cleanupFailures.length === 0
  && preflightFailures.length === 0
  && dependencyFailures.length === 0
  && accountProvisionFailures.length === 0
  && roleFailures.length === 0
  && javaFailures.length === 0
  && nodeFailures.length === 0
  && !blockedBeforePlaywright
  && !(playwrightStarted && noTestsExecuted);

const summary = {
  ok,
  generatedAt: new Date().toISOString(),
  runId,
  runDir,
  appUrl,
  expectedVersion,
  sourceVersion: preflight.sourceVersion || sourceInventory.version || sourceInventory.packageVersion || '',
  deployedVersion: preflight.deployedVersion || '',
  visibleVersion: preflight.visibleVersion || '',
  testedVersion,
  firebaseProjectId: preflight.firebaseProjectId || sourceInventory.firebaseProjectId || '',
  node: process.version,
  stepFailures,
  outcome: releaseGateStatus(ok),
  blockedBeforeTestExecution,
  primaryBlockingFailure,
  runnerState,
  dependencyPreflight: dependencyPreflight && hasOwn(dependencyPreflight, 'ok') ? dependencyPreflight : null,
  dependencyFailures,
  accountProvisionFailures,
  testAccountProvisioning: testAccountProvisioning && hasOwn(testAccountProvisioning, 'ok') ? testAccountProvisioning : null,
  roleFailures,
  javaFailures,
  nodeFailures,
  rulesGateReport: rulesGateReport && Object.keys(rulesGateReport).length ? { ok: rulesGateReport.ok, totalCases: rulesGateReport.totalCases, passed: rulesGateReport.passed, failed: rulesGateReport.failed, blocked: rulesGateReport.blocked, firstActionableFailure: rulesGateReport.firstActionableFailure || '' } : null,
  testAccountConfigurationFailure: roleFailures.length > 0,
  playwright: { totalResults: tests.length, status: blockedBeforeTestExecution ? 'BLOCKED BEFORE TEST EXECUTION' : (noTestsExecuted ? 'No tests executed' : 'Tests executed'), failed: failedTests.length, timedOut: timedOutTests.length, skipped: skippedTests.length, failedTests: blockedBeforeTestExecution ? [] : failedTests.slice(0, 200), skippedTests: skippedTests.slice(0, 200) },
  attemptStatus: {
    browserInstallation: { attempted: runnerPhase === 'install-chromium' || runnerState.browserInstallPassed === true, status: runnerState.browserInstallPassed === true ? 'passed' : (blockedBeforePlaywright ? 'blocked' : 'not_run') },
    testAccountProvisioning: { attempted: runnerState.testAccountProvisionAttempted === true, status: runnerState.testAccountProvisionPassed === true ? 'passed' : (runnerState.testAccountProvisionAttempted === true ? 'failed' : (blockedBeforePlaywright ? 'blocked' : 'not_run')) },
    roleVerification: { attempted: runnerState.rolePreflightStarted === true, status: runnerState.rolePreflightPassed === true ? 'passed' : (runnerState.rolePreflightStarted === true ? 'failed' : (blockedBeforePlaywright ? 'blocked' : 'not_run')) },
    qaSeed: { attempted: runnerState.qaSeedAttempted === true || runnerState.qaSeedProcessStarted === true || runnerState.qaDataWritesStarted === true, status: runnerState.qaSeedVerified === true ? 'passed' : ((runnerState.qaSeedAttempted === true || runnerState.qaSeedProcessStarted === true || runnerState.qaDataWritesStarted === true) ? 'failed' : (blockedBeforePlaywright ? 'blocked' : 'not_run')) },
    playwright: { attempted: playwrightStarted, status: playwrightStarted ? (failedTests.length || timedOutTests.length ? 'failed' : 'passed') : (blockedBeforePlaywright ? 'blocked' : 'not_run') },
    cleanup: { attempted: runnerState.cleanupAttempted === true, status: runnerState.cleanupCompleted === true ? 'passed' : (runnerState.cleanupAttempted === true ? 'failed' : (blockedBeforePlaywright ? 'blocked' : 'not_run')) },
  },
  seed: seedReport && seedReport.ok !== undefined ? { ok: seedReport.ok, runId: seedReport.runId || '', restaurantId: seedReport.restaurantId || seedReport.profile?.restaurantId || '', restaurantName: seedReport.restaurantName || seedReport.profile?.restaurantName || '', expectedCounts: seedReport.expectedCounts || {}, verifiedCounts: seedReport.verification?.verifiedCounts || {}, verificationOk: seedReport.verification?.ok === true } : null,
  cleanup: cleanupReport && cleanupReport.ok !== undefined ? { ok: cleanupReport.ok, runId: cleanupReport.runId || '', expected: cleanupReport.expected || {}, deleted: cleanupReport.deleted || {}, alreadyAbsent: cleanupReport.alreadyAbsent || {}, remaining: cleanupReport.remaining || {}, additionalRunRecords: cleanupReport.additionalRunRecords || {}, restaurantDeleted: cleanupReport.restaurantDeleted || 0, failures: cleanupReport.failed || [], accountedFailures: cleanupReport.accountedFailures || [] } : null,
  releaseReadiness: {
    sourceVersion: preflight.sourceVersion || sourceInventory.version || sourceInventory.packageVersion || '',
    deployedVersion: preflight.deployedVersion || '',
    versionMatch: Boolean((preflight.sourceVersion || sourceInventory.version || sourceInventory.packageVersion || '') && preflight.deployedVersion && (preflight.sourceVersion || sourceInventory.version || sourceInventory.packageVersion || '') === preflight.deployedVersion),
    testingFirebaseProject: preflight.firebaseProjectId || sourceInventory.firebaseProjectId || '',
    localSourceChecks: nodeTestSummary?.results || [],
    rulesTests: nodeTestSummary?.results?.find?.(row => /rules/i.test(row.group || '')) || null,
    testAccountVerification: roleVerification?.ok === true,
    qaSeed: seedReport?.ok === true && seedReport?.verification?.ok === true,
    playwrightTotals: { passed: tests.filter(t => t.status === 'passed').length, failed: failedTests.length, timedOut: timedOutTests.length, skipped: skippedTests.length, blocked: blockedBeforeTestExecution ? 1 : 0, notRun: blockedBeforeTestExecution ? 1 : 0 },
    cleanup: cleanupReport?.ok === true,
    remainingQaRecordsOrStorageObjects: cleanupReport?.remaining || {},
    finalState: ok ? 'RELEASE READY' : (blockedBeforeTestExecution ? 'BLOCKED' : 'FAILED'),
    firstActionableBlocker: primaryBlockingFailure || 'None'
  },
  setupState,
  roleIdentityVerification: roleVerification && roleVerification.ok !== undefined ? roleVerification : null,
  failedOnlyManifest,
  failedOnlyManifestValidation: failedOnlyManifestValidation && Object.keys(failedOnlyManifestValidation).length ? failedOnlyManifestValidation : null,
  failedOnlyMode,
  failureGroups,
  missingArtifacts,
  setupFailures,
  cleanupFailures,
  preflightFailures,
  artifactsSkippedByPreflight,
  artifactsSkippedByRunnerBlock,
  expectedSkippedArtifacts: artifactsSkippedByRunnerBlock.map(item => item.artifact),
  jsonParseDiagnostics: releaseGateJsonDiagnostics,
  artifacts: summaries.map(x => x.file).filter(f => f.includes(`/86chaos-play-store-release-gate/${runId}/`)),
  truth: [
    'This report reads only the current run directory.',
    'Root-level legacy seed and cleanup reports are not authoritative.',
    'No tests executed is a blocked release gate, not a passing test suite, and not an app-test failure.',
    'Temporary test-account provisioning reports are current-run diagnostics and never include passwords or tokens.',
    'When Playwright never starts, missing role verification, setup, seed, Playwright, and cleanup artifacts are not seed or cleanup defects.',
    'Rules reports are read only from the current run directory.',
    'Cleanup is required after any verified QA seed, and not required when no QA setup or seed was attempted.',
    'Role-account configuration failures are test harness/account setup blockers, not app failures, seed defects, cleanup defects, or Playwright test failures.',
  ],
};

const jsonPath = path.join(runDir, `86chaos-play-store-release-gate-summary-${testedVersion || 'unknown'}-${runId}.json`);
const textPath = path.join(runDir, `86chaos-play-store-release-gate-UPLOAD-ME-${testedVersion || 'unknown'}-${runId}.txt`);
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
const lines = [
  '86 CHAOS PLAY STORE RELEASE GATE',
  `Generated: ${summary.generatedAt}`,
  `Run ID: ${runId}`,
  `Run directory: ${runDir}`,
  `App URL: ${summary.appUrl}`,
  `Expected Version: ${summary.expectedVersion}`,
  `Source Version: ${summary.sourceVersion}`,
  `Deployed Version: ${summary.deployedVersion}`,
  `Visible Version: ${summary.visibleVersion}`,
  `Testing Firebase project: ${summary.firebaseProjectId}`,
  `Node: ${summary.node}`,
  `Overall: ${summary.outcome}`,
  `Primary blocking failure: ${summary.primaryBlockingFailure || 'None'}`,
  `Runner step failures: ${summary.stepFailures}`,
  `Playwright results: ${tests.length}`,
  `Playwright status: ${summary.playwright.status}`,
  `Playwright failed: ${failedTests.length}`,
  `Playwright timed out: ${timedOutTests.length}`,
  `Playwright skipped: ${skippedTests.length}`,
  '',
  'DEPENDENCY PREFLIGHT',
  JSON.stringify(summary.dependencyPreflight || {}, null, 2),
  '',
  'RUNNER STATE',
  JSON.stringify(summary.runnerState || {}, null, 2),
  '',
  'RULES GATE REPORT',
  JSON.stringify(summary.rulesGateReport || {}, null, 2),
  '',
  'FAILED-ONLY MANIFEST VALIDATION',
  JSON.stringify(summary.failedOnlyManifestValidation || {}, null, 2),
  '',
  'ATTEMPT STATUS',
  JSON.stringify(summary.attemptStatus || {}, null, 2),
  '',
  'ENVIRONMENT PREFLIGHT FAILURES',
  ...(preflightFailures.length ? preflightFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'DEPENDENCY FAILURES',
  ...(dependencyFailures.length ? dependencyFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'ROLE ACCOUNT FAILURES',
  ...(roleFailures.length ? roleFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'ARTIFACTS SKIPPED BECAUSE PREFLIGHT STOPPED BEFORE MUTATION',
  ...(artifactsSkippedByPreflight.length ? artifactsSkippedByPreflight.map(f => `- ${f}`) : ['- None']),
  '',
  'ARTIFACTS SKIPPED BECAUSE RUNNER BLOCKED BEFORE PLAYWRIGHT GLOBAL SETUP',
  ...(artifactsSkippedByRunnerBlock.length ? artifactsSkippedByRunnerBlock.map(f => `- ${f.artifact}: ${f.reason}`) : ['- None']),
  '',
  'SEED VERIFICATION',
  JSON.stringify(summary.seed || {}, null, 2),
  '',
  'CLEANUP VERIFICATION',
  JSON.stringify(summary.cleanup || {}, null, 2),
  '',
  'IMPORTANT',
  ...summary.truth,
  '',
  'FAILURE GROUPS',
  ...(failureGroups.length ? failureGroups.map(g => `- ${g.group}: ${g.examples.join(' | ')}`) : ['- None']),
  '',
  'FAILED TESTS',
  ...(failedTests.length ? failedTests.map(t => `- ${t.title}: ${t.error}`) : ['- None']),
  '',
  'SKIPPED TESTS',
  ...(skippedTests.length ? skippedTests.map(t => `- ${t.title}`) : ['- None']),
  '',
  'MISSING ARTIFACTS',
  ...(missingArtifacts.length ? missingArtifacts.map(f => `- ${f}`) : ['- None']),
  '',
  'SETUP FAILURES',
  ...(setupFailures.length ? setupFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'CLEANUP FAILURES',
  ...(cleanupFailures.length ? cleanupFailures.map(f => `- ${f}`) : ['- None']),
  '',
  'JSON ARTIFACTS',
  ...summary.artifacts.map(f => `- ${f}`),
];
fs.writeFileSync(textPath, lines.join('\n'));
console.log(JSON.stringify({ summary, jsonPath, textPath, resultsRoot, runDir }, null, 2));
// Report collection succeeded when this accurate report was written.
// The release gate status is carried in summary.ok; the collector exit code must not
// become another cascade failure when earlier preflight steps blocked Playwright.
process.exitCode = 0;

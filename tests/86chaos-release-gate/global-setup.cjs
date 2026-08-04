const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
const { ensureRunDir, getSetupStatePath, getSeedReportPath, getRoleReportPath, readJsonIfExists, writeJson, getRunFile } = require('../../scripts/86chaos-release-gate/run-context.cjs');
const { validateRoleReportForSeed, verifyRoleAccounts } = require('../../scripts/86chaos-release-gate/verify-role-accounts.cjs');
const { provisionTestAccounts } = require('../../scripts/86chaos-release-gate/provision-test-accounts.cjs');
const { loadEnv } = require('../../scripts/86chaos-full-audit/env-loader.cjs');
const { applyQaWorkspaceEnv, validateQaWorkspaceName } = require('../../scripts/86chaos-release-gate/qa-workspace.cjs');
const { assertMutationSafety, isProductionHost, parseHost } = require('../../scripts/86chaos-release-gate/mutation-safety.cjs');

function bool(value) { return /^(1|true|yes)$/i.test(String(value || '')); }
function isSafeTestingUrl(value = '') {
  try {
    const url = new URL(value);
    if (isProductionHost(url.hostname)) return false;
    return /^https?:$/i.test(url.protocol);
  } catch (_) { return false; }
}

function updateRunnerState(runId, patch) {
  const statePath = getRunFile('runner-state.json', runId);
  const existing = readJsonIfExists(statePath) || { runId, steps: [] };
  writeJson(statePath, { ...existing, ...patch, updatedAt: new Date().toISOString() });
}

module.exports = async () => {
  const root = process.cwd();
  loadEnv(root);
  const { runId, runDir } = ensureRunDir();
  const setupStatePath = getSetupStatePath(runId);
  const seedReportPath = getSeedReportPath(runId);
  const roleReportPath = getRoleReportPath(runId);
  const appUrl = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || '';
  const state = {
    runId,
    runDir,
    generatedAt: new Date().toISOString(),
    globalSetupStarted: true,
    attempted: false,
    qaSeedProcessStarted: false,
    qaDataWritesStarted: false,
    seeded: false,
    verified: false,
    restaurantId: '',
    createdRestaurant: false,
    seedReportPath,
    roleReportPath,
    cleanupAllowed: false,
    qaWorkspaceName: process.env.CHAOS_QA_WORKSPACE_NAME || '',
    skipped: false,
    errors: [],
  };
  const writeState = () => writeJson(setupStatePath, state);
  const qaWorkspaceName = applyQaWorkspaceEnv(process.env, runId);
  const qaWorkspaceValidation = validateQaWorkspaceName(qaWorkspaceName, runId);
  if (!qaWorkspaceValidation.ok) {
    state.errors.push(...qaWorkspaceValidation.errors);
    writeState();
    throw new Error(state.errors.join('\n'));
  }
  process.env.CHAOS_RELEASE_GATE_RUN_ID = runId;
  process.env.CHAOS_FULL_AUDIT_RUN_ID = runId;
  process.env.CHAOS_RELEASE_GATE_RUN_DIR = runDir;

  writeState();
  updateRunnerState(runId, { globalSetupStarted: true });

  let roleReport = readJsonIfExists(roleReportPath);
  let roleValidation = validateRoleReportForSeed(roleReport, runId);
  if (!roleValidation.ok) {
    updateRunnerState(runId, { rolePreflightStarted: true });
    if (!bool(process.env.CHAOS_QA_DISABLE_AUTO_PROVISION_TEST_USERS)) {
      updateRunnerState(runId, { testAccountProvisionAttempted: true });
      const provision = await provisionTestAccounts({ root, loadEnvironment: false });
      updateRunnerState(runId, { testAccountProvisionPassed: provision?.ok === true });
      if (provision?.ok !== true) {
        const message = (Array.isArray(provision?.errors) && provision.errors[0]) || 'Temporary release-gate test account provisioning failed.';
        state.errors.push(message);
        state.skipped = true;
        state.skipReason = 'Temporary test-account provisioning failed before QA setup.';
        writeState();
        updateRunnerState(runId, { blockingReason: `Release gate blocked in global setup because ${message}`, rolePreflightPassed: false, qaSeedProcessStarted: false, qaDataWritesStarted: false, qaRestaurantCreated: false });
        throw new Error(message);
      }
    }
    const verified = await verifyRoleAccounts({ root, loadEnvironment: false, writeReport: true, throwOnFailure: false, phase: 'global-setup-role-preflight' });
    roleReport = verified.report;
    roleValidation = validateRoleReportForSeed(roleReport, runId);
    updateRunnerState(runId, { rolePreflightPassed: roleValidation.ok === true });
  }
  if (!roleValidation.ok) {
    const message = roleValidation.errors[0] || 'Release-gate role account preflight is invalid.';
    state.errors.push(message);
    state.skipped = true;
    state.skipReason = 'Role account preflight failed before QA setup.';
    writeState();
    updateRunnerState(runId, { blockingReason: `Release gate blocked in global setup because ${message}`, qaSeedProcessStarted: false, qaDataWritesStarted: false, qaRestaurantCreated: false });
    throw new Error(message);
  }

  if (!process.env.CHAOS_RELEASE_GATE_NO_MUTATION) {
    process.env.CHAOS_ALLOW_MUTATION = process.env.CHAOS_ALLOW_MUTATION || 'true';
    process.env.CHAOS_QA_CREATE_RESTAURANT = process.env.CHAOS_QA_CREATE_RESTAURANT || 'true';
  }
  const mutation = bool(process.env.CHAOS_ALLOW_MUTATION);
  const createRestaurant = bool(process.env.CHAOS_QA_CREATE_RESTAURANT);
  if (!mutation && !createRestaurant) {
    state.skipped = true;
    state.skipReason = 'Mutation mode and QA restaurant creation were not requested.';
    writeState();
    updateRunnerState(runId, { qaSeedProcessStarted: false, qaDataWritesStarted: false, qaRestaurantCreated: false });
    return;
  }
  if (!mutation || !createRestaurant) {
    state.errors.push('Disposable QA restaurant tests require CHAOS_ALLOW_MUTATION=true and CHAOS_QA_CREATE_RESTAURANT=true.');
    writeState();
    throw new Error(state.errors.join('\n'));
  }
  const mutationSafety = assertMutationSafety({ env: process.env, appUrl, runId, requireAdminCredentials: false });
  state.mutationSafety = mutationSafety;
  if (!mutationSafety.ok) {
    state.errors.push(...mutationSafety.errors);
    writeState();
    throw new Error(state.errors.join('\n'));
  }
  if (!isSafeTestingUrl(appUrl)) {
    state.errors.push(`Refusing QA seed against unsafe or production URL: ${appUrl || '(missing)'}`);
    writeState();
    throw new Error(state.errors.join('\n'));
  }

  state.attempted = true;
  state.qaSeedProcessStarted = true;
  writeState();
  updateRunnerState(runId, { qaSeedProcessStarted: true });
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/86chaos-full-audit/seed-fake-restaurant.cjs')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) {
    state.errors.push(result.error.message);
    writeState();
    throw result.error;
  }
  const seed = readJsonIfExists(seedReportPath);
  state.seeded = seed?.createdRestaurant === true || Boolean(seed?.restaurantId || seed?.profile?.restaurantId);
  state.verified = seed?.ok === true && seed?.verification?.ok === true;
  state.restaurantId = seed?.restaurantId || seed?.profile?.restaurantId || '';
  state.createdRestaurant = seed?.createdRestaurant === true;
  state.qaDataWritesStarted = state.seeded || state.createdRestaurant || Boolean(seed?.seededDocuments?.length) || seed?.writesStarted === true;
  state.writesStarted = state.qaDataWritesStarted;
  state.createdDocumentIds = Array.isArray(seed?.seededDocuments) ? seed.seededDocuments : [];
  state.cleanupAllowed = state.attempted && state.qaDataWritesStarted && Boolean(state.restaurantId);
  updateRunnerState(runId, { qaDataWritesStarted: state.qaDataWritesStarted, writesStarted: state.qaDataWritesStarted, qaRestaurantCreated: state.createdRestaurant, qaSeedVerified: state.verified, cleanupRequired: state.cleanupAllowed, temporaryRestaurantId: state.restaurantId });
  if (result.status !== 0 || !state.verified) {
    const seedError = seed?.error || (Array.isArray(seed?.verification?.missing) && seed.verification.missing.length ? `Seed verification missing ${seed.verification.missing.length} expected records.` : 'Seed report was not ok:true.');
    state.errors.push(`Disposable QA restaurant setup failed or did not verify. Exit=${result.status}. ${seedError}`);
    writeState();
    throw new Error(state.errors.join('\n'));
  }
  writeState();
};

const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
const { ensureRunDir, getSetupStatePath, getSeedReportPath, readJsonIfExists, writeJson } = require('../../scripts/86chaos-release-gate/run-context.cjs');

function bool(value) { return /^(1|true|yes)$/i.test(String(value || '')); }
function isSafeTestingUrl(value = '') {
  try {
    const url = new URL(value);
    if (/^(app\.)?86chaos\.com$/i.test(url.hostname)) return false;
    if (/86chaos\.com$/i.test(url.hostname) && !/vercel\.app$/i.test(url.hostname)) return false;
    return /^https?:$/i.test(url.protocol);
  } catch (_) { return false; }
}

module.exports = async () => {
  const root = process.cwd();
  const { runId, runDir } = ensureRunDir();
  const setupStatePath = getSetupStatePath(runId);
  const seedReportPath = getSeedReportPath(runId);
  const appUrl = process.env.APP_URL || process.env.CHAOS_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || '';
  const state = {
    runId,
    runDir,
    generatedAt: new Date().toISOString(),
    attempted: false,
    seeded: false,
    verified: false,
    restaurantId: '',
    createdRestaurant: false,
    seedReportPath,
    cleanupAllowed: false,
    skipped: false,
    errors: [],
  };
  const writeState = () => writeJson(setupStatePath, state);
  process.env.CHAOS_QA_WORKSPACE_NAME = '86 Chaos Full Audit QA Restaurant';
  process.env.CHAOS_QA_WORKSPACE = '86 Chaos Full Audit QA Restaurant';
  process.env.CHAOS_RELEASE_GATE_RUN_ID = runId;
  process.env.CHAOS_FULL_AUDIT_RUN_ID = runId;
  process.env.CHAOS_RELEASE_GATE_RUN_DIR = runDir;

  writeState();
  const mutation = bool(process.env.CHAOS_ALLOW_MUTATION);
  const createRestaurant = bool(process.env.CHAOS_QA_CREATE_RESTAURANT);
  if (!mutation && !createRestaurant) {
    state.skipped = true;
    state.skipReason = 'Mutation mode and QA restaurant creation were not requested.';
    writeState();
    return;
  }
  if (!mutation || !createRestaurant) {
    state.errors.push('Disposable QA restaurant tests require CHAOS_ALLOW_MUTATION=true and CHAOS_QA_CREATE_RESTAURANT=true.');
    writeState();
    throw new Error(state.errors.join('\n'));
  }
  if (!isSafeTestingUrl(appUrl)) {
    state.errors.push(`Refusing QA seed against unsafe or production URL: ${appUrl || '(missing)'}`);
    writeState();
    throw new Error(state.errors.join('\n'));
  }

  state.attempted = true;
  writeState();
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
  state.cleanupAllowed = state.attempted && state.seeded && state.verified && Boolean(state.restaurantId);
  if (result.status !== 0 || !state.cleanupAllowed) {
    state.errors.push(`Disposable QA restaurant setup failed or did not verify. Exit=${result.status}. Seed ok=${seed?.ok}. Verification ok=${seed?.verification?.ok}.`);
    writeState();
    throw new Error(state.errors.join('\n'));
  }
  writeState();
};

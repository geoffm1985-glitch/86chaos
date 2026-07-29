const { spawnSync } = require('child_process');
const path = require('path');
const { ensureRunDir, getSetupStatePath, getCleanupReportPath, readJsonIfExists, writeJson } = require('../../scripts/86chaos-release-gate/run-context.cjs');

function bool(value) { return /^(1|true|yes)$/i.test(String(value || '')); }

module.exports = async () => {
  const { runId, runDir } = ensureRunDir();
  const cleanupReportPath = getCleanupReportPath(runId);
  const keep = bool(process.env.CHAOS_KEEP_QA_RESTAURANT);
  const mutation = bool(process.env.CHAOS_ALLOW_MUTATION);
  const setupStatePath = getSetupStatePath(runId);
  const setup = readJsonIfExists(setupStatePath) || { runId, attempted: false, seeded: false, verified: false };
  if (keep || !mutation || !setup.attempted || !setup.seeded || !setup.verified || setup.runId !== runId || !setup.restaurantId) {
    writeJson(cleanupReportPath, {
      ok: !setup.seeded,
      generatedAt: new Date().toISOString(),
      runId,
      runDir,
      cleanupMethod: 'safely-skipped-by-global-teardown',
      skipped: true,
      reason: keep ? 'CHAOS_KEEP_QA_RESTAURANT=true' : (!mutation ? 'CHAOS_ALLOW_MUTATION was not true' : 'QA setup was skipped, failed, or not verified for this run'),
      setupState: setup,
      deleted: {},
      remaining: {},
      failures: [],
    });
    return;
  }
  const root = process.cwd();
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Automatic QA restaurant cleanup failed. Upload the current-run slim report. Cleanup did not use stale seed reports.');
  }
};

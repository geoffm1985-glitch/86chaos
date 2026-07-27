const { spawnSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const root = process.cwd();
  const mutation = /^(1|true|yes)$/i.test(process.env.CHAOS_ALLOW_MUTATION || '');
  const createRestaurant = /^(1|true|yes)$/i.test(process.env.CHAOS_QA_CREATE_RESTAURANT || '');
  process.env.CHAOS_QA_WORKSPACE_NAME = '86 Chaos Full Audit QA Restaurant';
  process.env.CHAOS_QA_WORKSPACE = '86 Chaos Full Audit QA Restaurant';
  if (!mutation || !createRestaurant) return;

  const result = spawnSync(process.execPath, [path.join(root, 'scripts/86chaos-full-audit/seed-fake-restaurant.cjs')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Disposable QA restaurant setup failed with exit ${result.status}.`);
};

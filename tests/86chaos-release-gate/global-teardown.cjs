const { spawnSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const keep = /^(1|true|yes)$/i.test(process.env.CHAOS_KEEP_QA_RESTAURANT || '');
  const mutation = /^(1|true|yes)$/i.test(process.env.CHAOS_ALLOW_MUTATION || '');
  if (keep || !mutation) return;
  const root = process.cwd();
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('Automatic QA restaurant cleanup failed. The leftover restaurant is named "86 Chaos Full Audit QA Restaurant" and can be deleted from System Administrator > Platform Operations.');
  }
};

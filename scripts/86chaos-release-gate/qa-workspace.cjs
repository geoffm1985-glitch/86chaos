const QA_WORKSPACE_PREFIX = '86 Chaos Release Gate QA ';
const LEGACY_QA_WORKSPACE_NAME = '86 Chaos Full Audit QA Restaurant';
const KNOWN_REAL_RESTAURANT_NAMES = new Set(['cheers', 'cheers chilton', 'cheers bar & grill', 'cheers bar and grill']);

function normalizeName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}
function buildQaWorkspaceName(runId = '') {
  const cleanRunId = String(runId || '').trim();
  if (!cleanRunId) return '';
  return `${QA_WORKSPACE_PREFIX}${cleanRunId}`;
}
function resolveQaWorkspaceName(env = process.env, runId = '') {
  const expected = buildQaWorkspaceName(runId || env.CHAOS_RELEASE_GATE_RUN_ID || env.CHAOS_FULL_AUDIT_RUN_ID || '');
  const provided = normalizeName(env.CHAOS_QA_WORKSPACE_NAME || env.CHAOS_QA_WORKSPACE || '');
  return provided || expected;
}
function validateQaWorkspaceName(name, runId, options = {}) {
  const errors = [];
  const cleanName = normalizeName(name);
  const cleanRunId = String(runId || '').trim();
  const expected = buildQaWorkspaceName(cleanRunId);
  const lower = cleanName.toLowerCase();
  if (!cleanRunId) errors.push('Release-gate run ID is required before a QA workspace name can be accepted.');
  if (!cleanName) errors.push('CHAOS_QA_WORKSPACE_NAME is required.');
  if (cleanName === LEGACY_QA_WORKSPACE_NAME && options.legacyCleanup !== true) errors.push(`The obsolete shared QA workspace name "${LEGACY_QA_WORKSPACE_NAME}" is not allowed for a current release-gate run.`);
  if (cleanName && !cleanName.startsWith(QA_WORKSPACE_PREFIX)) errors.push(`QA workspace name must start with "${QA_WORKSPACE_PREFIX}".`);
  if (expected && cleanName && cleanName !== expected) errors.push(`QA workspace name must be exactly "${expected}" for the current run.`);
  if (KNOWN_REAL_RESTAURANT_NAMES.has(lower)) errors.push(`QA workspace name must not be a real restaurant name: ${cleanName}.`);
  if (/^(cheers|cheers\s+bar\s*(?:&|and)\s*grill)$/i.test(cleanName)) errors.push(`QA workspace name must not target Cheers or any production restaurant: ${cleanName}.`);
  return { ok: errors.length === 0, errors, expected, actual: cleanName, runId: cleanRunId, prefix: QA_WORKSPACE_PREFIX };
}
function applyQaWorkspaceEnv(env = process.env, runId = '') {
  const name = resolveQaWorkspaceName(env, runId);
  env.CHAOS_QA_WORKSPACE_NAME = name;
  env.CHAOS_QA_WORKSPACE = name;
  return name;
}

module.exports = {
  QA_WORKSPACE_PREFIX,
  LEGACY_QA_WORKSPACE_NAME,
  KNOWN_REAL_RESTAURANT_NAMES,
  normalizeName,
  buildQaWorkspaceName,
  resolveQaWorkspaceName,
  validateQaWorkspaceName,
  applyQaWorkspaceEnv,
};

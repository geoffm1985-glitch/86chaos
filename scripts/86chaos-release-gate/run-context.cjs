const fs = require('fs');
const path = require('path');

const root = process.cwd();
const MAIN_RESULTS_DIR = '86chaos-play-store-release-gate';

function safeRunId(value) {
  const raw = String(value || new Date().toISOString()).trim();
  return raw.replace(/[:.]/g, '-').replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'run';
}

function getResultsRoot() {
  return path.join(root, 'test-results', MAIN_RESULTS_DIR);
}

function getRunId() {
  const existing = process.env.CHAOS_RELEASE_GATE_RUN_ID || process.env.CHAOS_FULL_AUDIT_RUN_ID || '';
  const runId = safeRunId(existing || new Date().toISOString());
  process.env.CHAOS_RELEASE_GATE_RUN_ID = runId;
  process.env.CHAOS_FULL_AUDIT_RUN_ID = runId;
  return runId;
}

function getRunDir(runId = getRunId()) {
  const explicit = process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  if (explicit) return path.resolve(explicit);
  return path.join(getResultsRoot(), runId);
}

function ensureRunDir(runId = getRunId()) {
  const resultsRoot = getResultsRoot();
  const runDir = getRunDir(runId);
  fs.mkdirSync(resultsRoot, { recursive: true });
  fs.mkdirSync(runDir, { recursive: true });
  process.env.CHAOS_RELEASE_GATE_RUN_ID = runId;
  process.env.CHAOS_FULL_AUDIT_RUN_ID = runId;
  process.env.CHAOS_RELEASE_GATE_RUN_DIR = runDir;
  fs.writeFileSync(path.join(resultsRoot, '.last-run.json'), JSON.stringify({ runId, runDir, updatedAt: new Date().toISOString() }, null, 2));
  return { root, resultsRoot, runId, runDir };
}

function readJsonIfExists(filePath) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null; }
  catch (_) { return null; }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

function getRunFile(name, runId = getRunId()) {
  return path.join(getRunDir(runId), name);
}
function getSeedReportPath(runId = getRunId()) { return getRunFile('86chaos-full-audit-seed-report.json', runId); }
function getCleanupReportPath(runId = getRunId()) { return getRunFile('86chaos-full-audit-cleanup-report.json', runId); }
function getSetupStatePath(runId = getRunId()) { return getRunFile('qa-setup-state.json', runId); }
function getRoleReportPath(runId = getRunId()) { return getRunFile('role-identity-verification.json', runId); }
function getFailedOnlyManifestPath(runId = getRunId()) { return getRunFile('failed-only-test-manifest.json', runId); }
function findCurrentRunFile(name, runId = getRunId()) {
  const direct = getRunFile(name, runId);
  return fs.existsSync(direct) ? direct : '';
}

function assertCurrentRunArtifact(filePath, runId = getRunId()) {
  const resolved = path.resolve(filePath || '');
  const runDir = path.resolve(getRunDir(runId));
  if (!resolved.startsWith(runDir + path.sep) && resolved !== runDir) {
    throw new Error(`Refusing stale/non-current-run artifact: ${filePath}. Current run directory is ${runDir}.`);
  }
  return resolved;
}

module.exports = {
  MAIN_RESULTS_DIR,
  safeRunId,
  getRunId,
  getResultsRoot,
  getRunDir,
  ensureRunDir,
  readJsonIfExists,
  writeJson,
  getRunFile,
  getSeedReportPath,
  getCleanupReportPath,
  getSetupStatePath,
  getRoleReportPath,
  getFailedOnlyManifestPath,
  findCurrentRunFile,
  assertCurrentRunArtifact,
};

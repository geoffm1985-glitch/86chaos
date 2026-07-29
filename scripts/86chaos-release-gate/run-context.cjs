const fs = require('fs');
const path = require('path');

const root = process.cwd();
function safeRunId(value) {
  const raw = String(value || new Date().toISOString()).trim();
  return raw.replace(/[:.]/g, '-').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80) || 'run';
}
function getRunId() {
  const runId = safeRunId(process.env.CHAOS_RELEASE_GATE_RUN_ID || process.env.CHAOS_FULL_AUDIT_RUN_ID || '');
  process.env.CHAOS_RELEASE_GATE_RUN_ID = runId;
  process.env.CHAOS_FULL_AUDIT_RUN_ID = runId;
  return runId;
}
function getResultsRoot() {
  return path.join(root, 'test-results', '86chaos-play-store-release-gate');
}
function getRunDir(runId = getRunId()) {
  const explicit = process.env.CHAOS_RELEASE_GATE_RUN_DIR;
  if (explicit) return explicit;
  return path.join(getResultsRoot(), runId);
}
function ensureRunDir(runId = getRunId()) {
  const resultsRoot = getResultsRoot();
  const runDir = getRunDir(runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(resultsRoot, '.last-run.json'), JSON.stringify({ runId, runDir, updatedAt: new Date().toISOString() }, null, 2));
  process.env.CHAOS_RELEASE_GATE_RUN_DIR = runDir;
  return { root, resultsRoot, runId, runDir };
}
function readJsonIfExists(filePath) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null; } catch (_) { return null; }
}
function getSeedReportPath(runId = getRunId()) {
  return path.join(getRunDir(runId), '86chaos-full-audit-seed-report.json');
}
function findCurrentRunFile(name, runId = getRunId()) {
  const direct = path.join(getRunDir(runId), name);
  if (fs.existsSync(direct)) return direct;
  return '';
}
module.exports = { safeRunId, getRunId, getResultsRoot, getRunDir, ensureRunDir, readJsonIfExists, getSeedReportPath, findCurrentRunFile };

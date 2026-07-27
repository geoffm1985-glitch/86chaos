const fs = require('fs');
const path = require('path');
const { loadEnv, env, boolEnv } = require('../86chaos-full-audit/env-loader.cjs');
loadEnv(process.cwd());

const root = process.cwd();
const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
const outDir = path.join(root, 'test-results', '86chaos-play-store-release-gate');
fs.mkdirSync(outDir, { recursive: true });
const result = { ok: false, summaryPath, thresholds: {}, actual: {}, missingSourceFiles: [], zeroCoveredSourceFiles: [], errors: [] };

for (const [metric, envName, fallback] of [
  ['lines', 'CHAOS_MIN_JEST_LINES', 90],
  ['statements', 'CHAOS_MIN_JEST_STATEMENTS', 90],
  ['functions', 'CHAOS_MIN_JEST_FUNCTIONS', 85],
  ['branches', 'CHAOS_MIN_JEST_BRANCHES', 80],
]) result.thresholds[metric] = Number(env(envName) || fallback);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.(test|spec)\.(js|jsx)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}
function norm(p) { return path.resolve(p).replace(/\\/g, '/').toLowerCase(); }

if (!fs.existsSync(summaryPath)) {
  result.errors.push('coverage/coverage-summary.json was not produced. A passing Jest command without a coverage artifact is invalid.');
} else {
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    for (const metric of Object.keys(result.thresholds)) {
      const pct = Number(summary?.total?.[metric]?.pct);
      result.actual[metric] = pct;
      if (!Number.isFinite(pct)) result.errors.push(`Coverage metric ${metric} is missing or invalid.`);
      else if (pct < result.thresholds[metric]) result.errors.push(`${metric} coverage ${pct}% is below required ${result.thresholds[metric]}%.`);
    }

    if (boolEnv('CHAOS_REQUIRE_EVERY_SOURCE_FILE_COVERED') || !process.env.CHAOS_REQUIRE_EVERY_SOURCE_FILE_COVERED) {
      const entries = new Map(Object.entries(summary).filter(([key]) => key !== 'total').map(([key, value]) => [norm(key), value]));
      for (const file of walk(path.join(root, 'src'))) {
        const key = norm(file);
        const record = entries.get(key);
        const rel = path.relative(root, file).replace(/\\/g, '/');
        if (!record) result.missingSourceFiles.push(rel);
        else if (Number(record?.lines?.total || 0) > 0 && Number(record?.lines?.covered || 0) === 0) result.zeroCoveredSourceFiles.push(rel);
      }
      if (result.missingSourceFiles.length) result.errors.push(`${result.missingSourceFiles.length} production source files are absent from the Jest coverage artifact.`);
      if (result.zeroCoveredSourceFiles.length) result.errors.push(`${result.zeroCoveredSourceFiles.length} production source files have zero covered lines.`);
    }
  } catch (error) {
    result.errors.push(`Could not parse Jest coverage summary: ${error.message}`);
  }
}

result.ok = result.errors.length === 0;
const output = path.join(outDir, 'jest-coverage-gate.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, output }, null, 2));
if (!result.ok) process.exitCode = 1;

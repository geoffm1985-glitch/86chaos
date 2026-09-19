#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
let ensureRunDir = () => ({ runDir: path.join(process.cwd(), 'test-results', '86chaos-play-store-release-gate'), runId: process.env.CHAOS_RELEASE_GATE_RUN_ID || '' });
let writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
try {
  ({ ensureRunDir, writeJson } = require('./run-context.cjs'));
} catch (_) {}

function checkJava({ cwd = process.cwd(), env = process.env } = {}) {
  const result = {
    ok: false,
    blocked: true,
    prerequisite: 'java',
    command: 'java -version',
    message: 'Firestore and Storage emulator tests are BLOCKED because a supported Java runtime is not installed or is not on PATH. Install Java and run java -version successfully before running rules tests.',
    stdout: '',
    stderr: '',
    error: '',
    generatedAt: new Date().toISOString(),
  };
  try {
    const child = cp.spawnSync('java', ['-version'], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    result.stdout = String(child.stdout || '').trim();
    result.stderr = String(child.stderr || '').trim();
    if (child.error) result.error = child.error.message;
    if (child.status === 0) {
      result.ok = true;
      result.blocked = false;
      result.message = 'Java prerequisite passed. Firestore and Storage emulator tests may run.';
    }
  } catch (error) {
    result.error = error.message;
  }
  return result;
}

function writeJavaPreflight() {
  const { runDir, runId } = ensureRunDir();
  fs.mkdirSync(runDir, { recursive: true });
  const report = { runId, ...checkJava() };
  const out = path.join(runDir, 'java-prerequisite.json');
  writeJson(out, report);
  return { report, out };
}

if (require.main === module) {
  const { report, out } = writeJavaPreflight();
  console.log(JSON.stringify({ ok: report.ok, blocked: report.blocked, output: out, message: report.message, stderr: report.stderr, error: report.error }, null, 2));
  if (!report.ok) process.exitCode = 2;
}

module.exports = { checkJava, writeJavaPreflight };

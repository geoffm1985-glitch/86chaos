#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { ensureRunDir, writeJson } = require('./run-context.cjs');
const { checkJava } = require('./check-java-prerequisite.cjs');

const { runDir, runId } = ensureRunDir();
fs.mkdirSync(runDir, { recursive: true });

const commands = [
  { group: 'source validator', command: 'npm run test:source', required: true },
  { group: 'api syntax', command: 'npm run syntax:api', required: true },
  { group: 'python syntax', command: 'npm run syntax:py', required: true },
  { group: 'server tests', command: 'npm run test:server --if-present', required: true },
  { group: 'client tests', command: 'npm run test:client -- --runInBand', required: true },
  { group: 'production build', command: 'npm run build', required: true }
];

function runCommand(row) {
  const startedAt = new Date();
  const result = {
    group: row.group,
    command: row.command,
    status: 'not run',
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    durationMs: 0,
    exitCode: null,
    firstUsefulFailure: '',
    stdoutTail: '',
    stderrTail: ''
  };
  console.log(`\n[release-check] ${row.group}: ${row.command}`);
  const child = cp.spawnSync(row.command, {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20
  });
  const finishedAt = new Date();
  result.finishedAt = finishedAt.toISOString();
  result.durationMs = finishedAt.getTime() - startedAt.getTime();
  result.exitCode = typeof child.status === 'number' ? child.status : (child.error ? 1 : 0);
  result.stdoutTail = String(child.stdout || '').slice(-5000);
  result.stderrTail = String(child.stderr || '').slice(-5000);
  const combined = `${child.stderr || ''}\n${child.stdout || ''}`.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  result.firstUsefulFailure = child.error?.message || combined.find(line => /error|failed|fail|not found|cannot find|exception|syntax/i.test(line)) || '';
  result.status = result.exitCode === 0 ? 'passed' : 'failed';
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  console.log(`[release-check] ${result.status.toUpperCase()} ${row.group} (${result.durationMs}ms)`);
  return result;
}

const results = [];
for (const row of commands) results.push(runCommand(row));

const java = checkJava();
const rules = {
  group: 'firestore/storage emulator rules tests',
  command: 'node scripts/86chaos-release-gate/run-rules-release-gate.cjs',
  status: java.ok ? 'not run' : 'blocked',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 0,
  exitCode: java.ok ? null : 2,
  firstUsefulFailure: java.ok ? '' : java.message
};
if (java.ok) {
  results.push(runCommand(rules));
} else {
  console.log(`[release-check] BLOCKED rules tests: ${java.message}`);
  results.push(rules);
}

const totals = results.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, { passed: 0, failed: 0, skipped: 0, blocked: 0, notRun: 0 });
const ok = results.every(row => row.status === 'passed' || (row.status === 'skipped' && row.required !== true));
const report = {
  runId,
  generatedAt: new Date().toISOString(),
  ok,
  totals,
  results,
  firstUsefulFailure: results.find(row => row.status === 'failed' || row.status === 'blocked')?.firstUsefulFailure || ''
};
writeJson(path.join(runDir, 'node-test-live-summary.json'), report);
if (!ok) process.exitCode = 1;

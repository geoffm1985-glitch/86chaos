#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { ensureRunDir, writeJson, readJsonIfExists } = require('./run-context.cjs');
const { writeJavaPreflight } = require('./check-java-prerequisite.cjs');
const { firstUsefulFailureFromOutput } = require('./failure-extractor.cjs');

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

function structuredFailureFor(row) {
  if (!/focused rules/i.test(row.group || '')) return '';
  const focusedReport = readJsonIfExists(path.join(runDir, 'firebase-rules-release-gate.json')) || null;
  if (focusedReport?.ok === false) {
    return focusedReport.firstActionableFailure || focusedReport.failures?.[0]?.error || focusedReport.failures?.[0]?.actualResult || '';
  }
  return '';
}

function runCommand(row) {
  const startedAt = new Date();
  const result = {
    group: row.group,
    command: row.command,
    required: row.required === true,
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
  const childEnv = { ...process.env };
  if (/^server tests$/i.test(row.group || '')) {
    childEnv.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS = '1';
  }
  const child = cp.spawnSync(row.command, {
    shell: true,
    cwd: process.cwd(),
    env: childEnv,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 30
  });
  const finishedAt = new Date();
  result.finishedAt = finishedAt.toISOString();
  result.durationMs = finishedAt.getTime() - startedAt.getTime();
  result.exitCode = typeof child.status === 'number' ? child.status : (child.error ? 1 : 0);
  result.stdoutTail = String(child.stdout || '').slice(-5000);
  result.stderrTail = String(child.stderr || '').slice(-5000);
  result.status = result.exitCode === 0 ? 'passed' : 'failed';
  result.firstUsefulFailure = result.status === 'passed'
    ? ''
    : (structuredFailureFor(row) || firstUsefulFailureFromOutput(child));
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  console.log(`[release-check] ${result.status.toUpperCase()} ${row.group} (${result.durationMs}ms)`);
  return result;
}

const results = [];
for (const row of commands) results.push(runCommand(row));

const { report: java } = writeJavaPreflight();
const javaRow = {
  group: 'java prerequisite',
  command: 'java -version',
  required: true,
  status: java.ok ? 'passed' : 'blocked',
  startedAt: java.generatedAt,
  finishedAt: new Date().toISOString(),
  durationMs: 0,
  exitCode: java.ok ? 0 : 2,
  firstUsefulFailure: java.ok ? '' : java.message,
  stdoutTail: java.stdout || '',
  stderrTail: java.stderr || java.error || ''
};
results.push(javaRow);
console.log(`[release-check] ${javaRow.status.toUpperCase()} java prerequisite`);

const rulesCommands = [
  {
    group: 'complete canonical firestore/storage emulator rules tests',
    command: 'npm run test:rules',
    required: true,
  },
  {
    group: 'optional focused rules smoke tests',
    command: 'firebase emulators:exec --only firestore,storage "node scripts/86chaos-release-gate/run-rules-release-gate.cjs"',
    required: false,
  },
];

if (java.ok) {
  for (const row of rulesCommands) results.push(runCommand(row));
} else {
  for (const row of rulesCommands) {
    const blocked = {
      group: row.group,
      command: row.command,
      required: row.required === true,
      status: 'blocked',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      exitCode: 2,
      firstUsefulFailure: java.message,
      stdoutTail: '',
      stderrTail: ''
    };
    console.log(`[release-check] BLOCKED ${row.group}: ${java.message}`);
    results.push(blocked);
  }
}

const totals = results.reduce((acc, row) => {
  const key = row.status === 'not run' ? 'notRun' : row.status;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, { passed: 0, failed: 0, skipped: 0, blocked: 0, notRun: 0 });
const ok = results.every(row => row.status === 'passed' || (row.status === 'skipped' && row.required !== true));
const report = {
  runId,
  generatedAt: new Date().toISOString(),
  ok,
  totals,
  results,
  firstUsefulFailure: results.find(row => ['failed', 'blocked'].includes(row.status))?.firstUsefulFailure || '',
  truth: [
    'Passed commands always have an empty firstUsefulFailure.',
    'The complete canonical npm run test:rules suite is required before Playwright may start.',
    'The focused rules smoke suite is additional evidence and does not replace the canonical suite.',
  ],
};
writeJson(path.join(runDir, 'node-test-live-summary.json'), report);
if (!ok) process.exitCode = 1;

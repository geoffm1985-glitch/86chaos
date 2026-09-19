#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ensureRunDir, writeJson, readJsonIfExists } = require('./run-context.cjs');
const { writeJavaPreflight } = require('./check-java-prerequisite.cjs');
const { firstUsefulFailureFromOutput } = require('./failure-extractor.cjs');
const { runStreamedCommand, formatDuration, positiveInteger } = require('./streamed-command-runner.cjs');

const { runDir, runId } = ensureRunDir();
fs.mkdirSync(runDir, { recursive: true });

const MINUTE = 60 * 1000;
const commands = [
  { group: 'source validator', command: 'npm run test:source', required: true, timeoutMs: 5 * MINUTE },
  { group: 'api syntax', command: 'npm run syntax:api', required: true, timeoutMs: 5 * MINUTE },
  { group: 'python syntax', command: 'npm run syntax:py', required: true, timeoutMs: 5 * MINUTE },
  { group: 'POS Bridge Firestore concurrency emulator tests', command: 'npm run test:pos-bridge:emulator', required: true, timeoutMs: 20 * MINUTE },
  { group: 'hostile certification', command: 'npm run test:release:hostile', required: true, timeoutMs: 20 * MINUTE },
  { group: 'schedule publication module and UI tests', command: 'npm run test:schedule-publish', required: true, timeoutMs: 20 * MINUTE },
  { group: 'schedule publication Firestore concurrency', command: 'npm run test:schedule-publish:emulator', required: true, timeoutMs: 20 * MINUTE },
  { group: 'recovery drill', command: 'npm run test:release:recovery', required: true, timeoutMs: 20 * MINUTE },
  { group: 'scale and completeness boundaries', command: 'npm run test:release:scale', required: true, timeoutMs: 10 * MINUTE },
  { group: 'server tests', command: 'npm run test:server', required: true, timeoutMs: 20 * MINUTE },
  { group: 'client tests', command: 'npm run test:client -- --runInBand', required: true, timeoutMs: 30 * MINUTE },
  { group: 'production build', command: 'npm run build', required: true, timeoutMs: 15 * MINUTE }
];

function structuredFailureFor(row) {
  if (!/focused rules/i.test(row.group || '')) return '';
  const focusedReport = readJsonIfExists(path.join(runDir, 'firebase-rules-release-gate.json')) || null;
  if (focusedReport?.ok === false) {
    return focusedReport.firstActionableFailure || focusedReport.failures?.[0]?.error || focusedReport.failures?.[0]?.actualResult || '';
  }
  return '';
}

async function runCommand(row) {
  const startedAt = new Date();
  const timeoutMs = positiveInteger(process.env.CHAOS_RELEASE_CHECK_TIMEOUT_MS, row.timeoutMs || 20 * MINUTE);
  const heartbeatMs = positiveInteger(process.env.CHAOS_RELEASE_CHECK_HEARTBEAT_MS, 15000);
  const result = {
    group: row.group,
    command: row.command,
    required: row.required === true,
    status: 'not run',
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    durationMs: 0,
    timeoutMs,
    exitCode: null,
    firstUsefulFailure: '',
    stdoutTail: '',
    stderrTail: ''
  };
  console.log(`\n[release-check] ${row.group}: ${row.command}`);
  console.log(`[release-check] timeout ${formatDuration(timeoutMs)} | heartbeat every ${formatDuration(heartbeatMs)}`);
  const child = await runStreamedCommand({
    command: row.command,
    cwd: process.cwd(),
    env: process.env,
    timeoutMs,
    heartbeatMs,
    onStdout: chunk => process.stdout.write(chunk),
    onStderr: chunk => process.stderr.write(chunk),
    onHeartbeat: ({ elapsedMs, silentMs }) => {
      console.log(`[release-check] STILL RUNNING ${row.group} | elapsed ${formatDuration(elapsedMs)} | no output ${formatDuration(silentMs)} | timeout ${formatDuration(timeoutMs)}`);
    },
  });
  const finishedAt = new Date();
  result.finishedAt = finishedAt.toISOString();
  result.durationMs = child.durationMs;
  result.exitCode = child.status;
  result.stdoutTail = String(child.stdout || '').slice(-5000);
  result.stderrTail = String(child.stderr || '').slice(-5000);
  result.status = child.timedOut ? 'timedOut' : (child.interrupted ? 'interrupted' : (result.exitCode === 0 ? 'passed' : 'failed'));
  result.firstUsefulFailure = result.status === 'passed'
    ? ''
    : (child.timedOut
      ? `${row.group} timed out after ${formatDuration(timeoutMs)}; the child process tree was terminated.`
      : child.interrupted
        ? `${row.group} was interrupted by ${child.interruptedSignal || 'a termination signal'}; the child process tree was terminated.`
        : (structuredFailureFor(row) || firstUsefulFailureFromOutput({ status: child.status, error: child.error, stdout: child.stdout, stderr: child.stderr })));
  console.log(`[release-check] ${result.status.toUpperCase()} ${row.group} (${result.durationMs}ms)`);
  return result;
}

function quoteShellArgument(value) {
  const text = String(value);
  if (process.platform === 'win32') return `"${text.replace(/"/g, '""')}"`;
  return `'${text.replace(/'/g, `'"'"'`)}'`;
}

function reserveAvailableLoopbackPorts(count) {
  const probe = cp.spawnSync(process.execPath, ['-e', `
    const net = require('net');
    const count = Number(process.argv[1]);
    const servers = [];
    const ports = [];
    const closeAll = () => Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    const fail = async error => {
      await closeAll();
      console.error(error && (error.stack || error.message) || error);
      process.exit(1);
    };
    const reserveNext = () => {
      if (ports.length === count) {
        closeAll().then(() => process.stdout.write(JSON.stringify(ports))).catch(fail);
        return;
      }
      const server = net.createServer();
      server.once('error', fail);
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
        servers.push(server);
        ports.push(server.address().port);
        reserveNext();
      });
    };
    reserveNext();
  `, String(count)], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
  });
  if (probe.status !== 0) {
    throw new Error(`Unable to reserve isolated Firebase emulator ports: ${String(probe.stderr || probe.error || 'port probe failed').trim()}`);
  }
  const ports = JSON.parse(String(probe.stdout || '[]'));
  if (ports.length !== count || ports.some(port => !Number.isInteger(port) || port < 1)) {
    throw new Error(`Unable to reserve ${count} isolated Firebase emulator ports.`);
  }
  return ports;
}

function createIsolatedEmulatorConfig() {
  const [firestorePort, storagePort] = reserveAvailableLoopbackPorts(2);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-rules-'));
  const configPath = path.join(tempDir, 'firebase.json');
  const root = process.cwd();
  const config = {
    firestore: {
      rules: path.join(root, 'firestore.rules'),
      indexes: path.join(root, 'firestore.indexes.json'),
    },
    storage: {
      rules: path.join(root, 'storage.rules'),
    },
    emulators: {
      firestore: { host: '127.0.0.1', port: firestorePort },
      storage: { host: '127.0.0.1', port: storagePort },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return { configPath, tempDir };
}

function resolveLockedFirebaseCli() {
  const packagePath = require.resolve('firebase-tools/package.json', { paths: [process.cwd()] });
  const firebasePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const binPath = typeof firebasePackage.bin === 'string' ? firebasePackage.bin : firebasePackage.bin?.firebase;
  if (!binPath) throw new Error('The locked firebase-tools package does not expose its Firebase CLI entry point.');
  return path.resolve(path.dirname(packagePath), binPath);
}

function removeIsolatedEmulatorConfig(temp) {
  try { fs.unlinkSync(temp.configPath); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try { fs.rmdirSync(temp.tempDir); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function isEmulatorPortCollision(result) {
  return /(?:port(?:\s+\d+)?\s+(?:is not open|taken)|EADDRINUSE|address already in use)/i.test(
    `${result.stdoutTail || ''}\n${result.stderrTail || ''}`
  );
}

async function runRulesCommand(row) {
  let lastResult = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const temp = createIsolatedEmulatorConfig();
    const firebaseCli = resolveLockedFirebaseCli();
    const emulatorCommand = [
      quoteShellArgument(process.execPath),
      quoteShellArgument(firebaseCli),
      'emulators:exec',
      '--only firestore,storage',
      '--project demo-no-project',
      `--config ${quoteShellArgument(temp.configPath)}`,
      quoteShellArgument(`node ${row.testScript}`),
    ].join(' ');
    try {
      lastResult = await runCommand({ ...row, command: emulatorCommand, timeoutMs: 20 * MINUTE });
    } finally {
      removeIsolatedEmulatorConfig(temp);
    }
    if (lastResult.status === 'passed' || !isEmulatorPortCollision(lastResult) || attempt === 2) return lastResult;
    console.warn(`[release-check] Firebase emulator startup port collision; retrying ${row.group} once with fresh isolated ports.`);
  }
  return lastResult;
}

async function main() {
  const results = [];
  let stoppedEarly = null;
  for (let index = 0; index < commands.length; index += 1) {
    const row = commands[index];
    const result = await runCommand(row);
    results.push(result);
    if ((result.status === 'timedOut' || result.status === 'interrupted') && result.required === true) {
      stoppedEarly = result;
      console.error(`[release-check] STOPPING remaining local release checks because required group ${row.group} ${result.status === 'timedOut' ? 'timed out' : 'was interrupted'} and its child tree was terminated.`);
      for (const skippedRow of commands.slice(index + 1)) {
        results.push({
          group: skippedRow.group,
          command: skippedRow.command,
          required: skippedRow.required === true,
          status: 'not run',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          timeoutMs: skippedRow.timeoutMs || null,
          exitCode: null,
          firstUsefulFailure: `Not run because ${row.group} ${result.status === 'timedOut' ? 'timed out' : 'was interrupted'}.`,
          stdoutTail: '',
          stderrTail: '',
        });
      }
      break;
    }
  }

  const rulesCommands = [
    {
      group: 'complete canonical firestore/storage emulator rules tests',
      testScript: 'scripts/run-rules-tests.js',
      required: true,
    },
    {
      group: 'optional focused rules smoke tests',
      testScript: 'scripts/86chaos-release-gate/run-rules-release-gate.cjs',
      required: false,
    },
  ];

  if (!stoppedEarly) {
    const { report: java } = writeJavaPreflight();
    const javaRow = {
      group: 'java prerequisite',
      command: 'java -version',
      required: true,
      status: java.ok ? 'passed' : 'blocked',
      startedAt: java.generatedAt,
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      timeoutMs: null,
      exitCode: java.ok ? 0 : 2,
      firstUsefulFailure: java.ok ? '' : java.message,
      stdoutTail: java.stdout || '',
      stderrTail: java.stderr || java.error || ''
    };
    results.push(javaRow);
    console.log(`[release-check] ${javaRow.status.toUpperCase()} java prerequisite`);

    if (java.ok) {
      for (const row of rulesCommands) results.push(await runRulesCommand(row));
    } else {
      for (const row of rulesCommands) {
        const blocked = {
          group: row.group,
          command: `firebase emulators:exec --only firestore,storage "node ${row.testScript}"`,
          required: row.required === true,
          status: 'blocked',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          timeoutMs: null,
          exitCode: 2,
          firstUsefulFailure: java.message,
          stdoutTail: '',
          stderrTail: ''
        };
        console.log(`[release-check] BLOCKED ${row.group}: ${java.message}`);
        results.push(blocked);
      }
    }
  } else {
    results.push({
      group: 'java prerequisite', command: 'java -version', required: true, status: 'not run',
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 0,
      timeoutMs: null, exitCode: null, firstUsefulFailure: 'Not run because an earlier required release-check group did not terminate cleanly.', stdoutTail: '', stderrTail: ''
    });
    for (const row of rulesCommands) {
      results.push({
        group: row.group,
        command: `firebase emulators:exec --only firestore,storage "node ${row.testScript}"`,
        required: row.required === true,
        status: 'not run',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        timeoutMs: null,
        exitCode: null,
        firstUsefulFailure: 'Not run because an earlier required release-check group did not terminate cleanly.',
        stdoutTail: '',
        stderrTail: ''
      });
    }
  }

  const totals = results.reduce((acc, row) => {
    const key = row.status === 'not run' ? 'notRun' : row.status;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { passed: 0, failed: 0, timedOut: 0, interrupted: 0, skipped: 0, blocked: 0, notRun: 0 });
  const ok = results.every(row => row.status === 'passed' || (row.status === 'skipped' && row.required !== true));
  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    ok,
    totals,
    results,
    firstUsefulFailure: results.find(row => ['failed', 'blocked', 'timedOut', 'interrupted'].includes(row.status))?.firstUsefulFailure || '',
    truth: [
      'Passed commands always have an empty firstUsefulFailure.',
      'Required release-check groups stream output live and have bounded execution time.',
      'Timeout or interruption kills the complete child process tree before remaining local checks are marked not-run.',
      'The complete canonical npm run test:rules suite is required before Playwright may start.',
      'The focused rules smoke suite is additional evidence and does not replace the canonical suite.',
    ],
  };
  writeJson(path.join(runDir, 'node-test-live-summary.json'), report);
  if (!ok) process.exitCode = process.exitCode || 1;
}

main().catch(error => {
  console.error(error && (error.stack || error.message) || error);
  process.exitCode = 1;
});

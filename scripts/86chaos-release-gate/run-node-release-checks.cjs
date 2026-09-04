#!/usr/bin/env node
'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
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
  const child = cp.spawnSync(row.command, {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
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

function runRulesCommand(row) {
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
      lastResult = runCommand({ ...row, command: emulatorCommand });
    } finally {
      removeIsolatedEmulatorConfig(temp);
    }
    if (lastResult.status === 'passed' || !isEmulatorPortCollision(lastResult) || attempt === 2) return lastResult;
    console.warn(`[release-check] Firebase emulator startup port collision; retrying ${row.group} once with fresh isolated ports.`);
  }
  return lastResult;
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
    testScript: 'scripts/run-rules-tests.js',
    required: true,
  },
  {
    group: 'optional focused rules smoke tests',
    testScript: 'scripts/86chaos-release-gate/run-rules-release-gate.cjs',
    required: false,
  },
];

if (java.ok) {
  for (const row of rulesCommands) results.push(runRulesCommand(row));
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

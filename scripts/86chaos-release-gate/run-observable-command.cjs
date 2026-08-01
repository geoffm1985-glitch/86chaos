#!/usr/bin/env node
'use strict';
const { spawn } = require('child_process');

const raw = process.argv.slice(2);
const splitAt = raw.indexOf('--');
const optionArgs = splitAt >= 0 ? raw.slice(0, splitAt) : [];
const commandArgs = splitAt >= 0 ? raw.slice(splitAt + 1) : raw;
function readOpt(name, fallback = '') {
  const idx = optionArgs.indexOf(`--${name}`);
  return idx >= 0 ? optionArgs[idx + 1] : fallback;
}
const label = readOpt('label', 'Observable command');
const heartbeatSeconds = Math.max(5, Number(readOpt('heartbeat', '20')) || 20);
const timeoutSeconds = Math.max(1, Number(readOpt('timeout', '1800')) || 1800);
if (!commandArgs.length) {
  console.error('No command supplied after --.');
  process.exit(2);
}

function normalizeSpawnCommand(command, args) {
  // Never use shell:true here. Windows splits executable paths such as
  // C:\Program Files\nodejs\node.exe into C:\Program when shell:true is used
  // with argument arrays. That made the release-gate dependency wrapper fail
  // before tests could run.
  if (process.platform === 'win32') {
    const lower = String(command || '').toLowerCase();
    const cmdShims = new Set(['npm', 'npx', 'yarn', 'pnpm']);
    if (cmdShims.has(lower)) return { command: `${command}.cmd`, args };
  }
  return { command, args };
}

const requestedCommand = commandArgs[0];
const requestedArgs = commandArgs.slice(1);
const normalized = normalizeSpawnCommand(requestedCommand, requestedArgs);
const command = normalized.command;
const args = normalized.args;
const start = Date.now();
let finished = false;
let timedOut = false;
let interrupted = false;

const stamp = () => new Date().toISOString();
const elapsed = () => Math.round((Date.now() - start) / 1000);
const commandLineForLog = [requestedCommand, ...requestedArgs].join(' ');
console.log(`[${stamp()}] START ${label}`);
console.log(`[${stamp()}] COMMAND ${commandLineForLog}`);
if (command !== requestedCommand) console.log(`[${stamp()}] SPAWN ${[command, ...args].join(' ')}`);
console.log(`[${stamp()}] TIMEOUT ${timeoutSeconds}s HEARTBEAT ${heartbeatSeconds}s`);

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32'
});

child.stdout.on('data', chunk => process.stdout.write(chunk));
child.stderr.on('data', chunk => process.stderr.write(chunk));
child.on('error', err => {
  if (finished) return;
  finished = true;
  clearInterval(heartbeat);
  clearTimeout(timeout);
  console.error(`[${stamp()}] PROCESS_ERROR ${err.message}`);
  console.log(`[${stamp()}] FINISHED ${label} elapsed=${elapsed()}s exitCode=1 signal= processError=true timedOut=${timedOut}`);
  process.exit(1);
});

function killTree() {
  if (finished) return;
  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (_) { try { child.kill('SIGTERM'); } catch (_) {} }
    setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { try { child.kill('SIGKILL'); } catch (_) {} } }, 3000).unref();
  }
}

const heartbeat = setInterval(() => {
  if (!finished) console.log(`[${stamp()}] STILL RUNNING ${label} elapsed=${elapsed()}s pid=${child.pid}`);
}, heartbeatSeconds * 1000);

const timeout = setTimeout(() => {
  if (finished) return;
  timedOut = true;
  console.error(`[${stamp()}] TIMED OUT ${label} elapsed=${elapsed()}s timeout=${timeoutSeconds}s`);
  killTree();
}, timeoutSeconds * 1000);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    console.error(`[${stamp()}] INTERRUPTED ${label} signal=${signal} elapsed=${elapsed()}s`);
    killTree();
    setTimeout(() => process.exit(130), 1500).unref();
  });
}

child.on('exit', (code, signal) => {
  if (finished) return;
  finished = true;
  clearInterval(heartbeat);
  clearTimeout(timeout);
  const exitCode = timedOut ? 124 : interrupted ? 130 : (typeof code === 'number' ? code : 1);
  console.log(`[${stamp()}] FINISHED ${label} elapsed=${elapsed()}s exitCode=${exitCode} signal=${signal || ''} timedOut=${timedOut}`);
  process.exit(exitCode);
});

#!/usr/bin/env node
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function quoteCmdArg(value) {
  const s = String(value ?? '');
  if (!s.length) return '""';
  if (!/[\s&()^%!<>|"']/u.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function firstExisting(candidates = []) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function resolveNpmCli(command) {
  const base = path.basename(String(command || '')).toLowerCase().replace(/\.cmd$/i, '').replace(/\.bat$/i, '');
  const cli = base === 'npx' ? 'npx-cli.js' : 'npm-cli.js';
  const execDir = path.dirname(process.execPath || '');
  const envCli = process.env.npm_execpath && path.basename(process.env.npm_execpath).toLowerCase() === cli ? process.env.npm_execpath : '';
  return firstExisting([
    envCli,
    path.join(execDir, 'node_modules', 'npm', 'bin', cli),
    path.join(path.dirname(execDir), 'lib', 'node_modules', 'npm', 'bin', cli),
    path.join(process.cwd(), 'node_modules', 'npm', 'bin', cli)
  ]);
}

function pathPreview() {
  return String(process.env.PATH || process.env.Path || '')
    .split(path.delimiter)
    .filter(Boolean)
    .filter(entry => /node|npm|program files/i.test(entry))
    .slice(0, 12)
    .join(path.delimiter);
}

function normalizeSpawnCommand(command, args) {
  const rawCommand = String(command || '');
  if (process.platform === 'win32') {
    const lowerBase = path.basename(rawCommand).toLowerCase();
    const npmLike = new Set(['npm', 'npm.cmd', 'npx', 'npx.cmd']);
    if (npmLike.has(lowerBase)) {
      const cliPath = resolveNpmCli(rawCommand);
      if (cliPath) {
        return {
          command: process.execPath,
          args: [cliPath, ...args],
          spawnDisplay: [process.execPath, cliPath, ...args].map(quoteCmdArg).join(' '),
          npmCliPath: cliPath
        };
      }
    }
    if (/\.(cmd|bat)$/i.test(rawCommand)) {
      const commandLine = [rawCommand, ...args].map(quoteCmdArg).join(' ');
      const comspec = process.env.ComSpec || 'cmd.exe';
      return {
        command: comspec,
        args: ['/d', '/s', '/c', commandLine],
        spawnDisplay: [comspec, '/d', '/s', '/c', commandLine].map(quoteCmdArg).join(' ')
      };
    }
  }
  return { command: rawCommand, args, spawnDisplay: [rawCommand, ...args].map(quoteCmdArg).join(' ') };
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
let heartbeat = null;
let timeout = null;

const stamp = () => new Date().toISOString();
const elapsed = () => Math.round((Date.now() - start) / 1000);
const commandLineForLog = [requestedCommand, ...requestedArgs].map(quoteCmdArg).join(' ');
console.log(`[${stamp()}] START ${label}`);
console.log(`[${stamp()}] COMMAND ${commandLineForLog}`);
console.log(`[${stamp()}] SPAWN ${normalized.spawnDisplay || [command, ...args].map(quoteCmdArg).join(' ')}`);
console.log(`[${stamp()}] NODE_EXECUTABLE ${process.execPath}`);
console.log(`[${stamp()}] NODE_VERSION ${process.version}`);
console.log(`[${stamp()}] CWD ${process.cwd()}`);
if (process.platform === 'win32') console.log(`[${stamp()}] COMSPEC ${process.env.ComSpec || 'cmd.exe'}`);
if (normalized.npmCliPath) {
  const npmVersion = spawnSync(process.execPath, [normalized.npmCliPath, '--version'], { encoding: 'utf8', timeout: 10000, shell: false });
  console.log(`[${stamp()}] NPM_CLI ${normalized.npmCliPath}`);
  console.log(`[${stamp()}] NPM_VERSION ${(npmVersion.stdout || npmVersion.stderr || '').trim() || `unavailable:${npmVersion.status}`}`);
}
console.log(`[${stamp()}] PATH_PREVIEW ${pathPreview()}`);
console.log(`[${stamp()}] TIMEOUT ${timeoutSeconds}s HEARTBEAT ${heartbeatSeconds}s`);

let child;
try {
  child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONUTF8: process.env.PYTHONUTF8 || '1', npm_config_color: process.env.npm_config_color || 'false' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });
} catch (err) {
  finished = true;
  console.error(`[${stamp()}] PROCESS_ERROR ${err && err.message ? err.message : String(err)}`);
  console.error(`[${stamp()}] PROCESS_ERROR_META code=${err?.code || ''} errno=${err?.errno || ''} syscall=${err?.syscall || ''} executable=${command} args=${JSON.stringify(args)} cwd=${process.cwd()} elapsed=${elapsed()}s`);
  console.log(`[${stamp()}] FINISHED ${label} elapsed=${elapsed()}s exitCode=1 signal= processError=true timedOut=${timedOut}`);
  process.exit(1);
}

child.stdout.on('data', chunk => process.stdout.write(chunk));
child.stderr.on('data', chunk => process.stderr.write(chunk));
child.on('error', err => {
  if (finished) return;
  finished = true;
  if (heartbeat) clearInterval(heartbeat);
  if (timeout) clearTimeout(timeout);
  console.error(`[${stamp()}] PROCESS_ERROR ${err && err.message ? err.message : String(err)}`);
  console.error(`[${stamp()}] PROCESS_ERROR_META code=${err?.code || ''} errno=${err?.errno || ''} syscall=${err?.syscall || ''} executable=${command} args=${JSON.stringify(args)} cwd=${process.cwd()} elapsed=${elapsed()}s`);
  console.log(`[${stamp()}] FINISHED ${label} elapsed=${elapsed()}s exitCode=1 signal= processError=true timedOut=${timedOut}`);
  process.exit(1);
});

function killTree() {
  if (finished || !child?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (_) { try { child.kill('SIGTERM'); } catch (_) {} }
    setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { try { child.kill('SIGKILL'); } catch (_) {} } }, 3000).unref();
  }
}

heartbeat = setInterval(() => {
  if (!finished) console.log(`[${stamp()}] STILL RUNNING ${label} elapsed=${elapsed()}s pid=${child.pid}`);
}, heartbeatSeconds * 1000);

timeout = setTimeout(() => {
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

#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function take(name, fallback = '') {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}
const label = take('--label', 'Test step');
const command = take('--command', '');
const tickSeconds = Math.max(2, Number(take('--tick-seconds', '10')) || 10);
if (!command) {
  console.error('run-command-with-timer requires --command.');
  process.exit(2);
}
function pad(value) { return String(value).padStart(2, '0'); }
function fmt(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
const startedAt = Date.now();
console.log(`\n================================================================`);
console.log(`START ${label}`);
console.log(`================================================================`);
console.log(command);
const child = spawn(process.platform === 'win32' ? 'cmd.exe' : '/bin/sh', process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});
const timer = setInterval(() => console.log(`[STEP RUNNING ${fmt(Date.now() - startedAt)}] ${label}`), tickSeconds * 1000);
timer.unref?.();
child.on('error', error => {
  clearInterval(timer);
  console.error(`FAILED TO START ${label}: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  clearInterval(timer);
  const durationMs = Date.now() - startedAt;
  const ok = code === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${fmt(durationMs)} ${label}${signal ? ` signal=${signal}` : ''}`);
  const runDir = process.env.CHAOS_RELEASE_GATE_RUN_DIR || '';
  if (runDir) {
    try {
      fs.mkdirSync(runDir, { recursive: true });
      const safe = label.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'step';
      fs.writeFileSync(path.join(runDir, `step-${safe}.json`), JSON.stringify({ label, command, ok, exitCode: code, signal: signal || '', startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), durationMs }, null, 2));
    } catch (_) {}
  }
  process.exit(code == null ? 1 : code);
});

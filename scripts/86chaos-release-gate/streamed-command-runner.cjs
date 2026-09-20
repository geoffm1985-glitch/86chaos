'use strict';

const cp = require('child_process');
const { createActionableFailureCapture } = require('./failure-extractor.cjs');

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function formatDuration(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  if (minutes) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function appendTail(current, chunk, limit = 5000) {
  const next = `${current || ''}${String(chunk || '')}`;
  return next.length > limit ? next.slice(-limit) : next;
}

function killProcessTree(pid) {
  if (!pid || !Number.isInteger(Number(pid))) return { ok: true, detail: 'no child pid' };
  const numericPid = Number(pid);
  if (process.platform === 'win32') {
    const killed = cp.spawnSync('taskkill', ['/PID', String(numericPid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    });
    const detail = `${killed.stdout || ''}${killed.stderr || ''}`.trim();
    // taskkill returns a failure when the process exited between timeout detection
    // and the kill attempt. Treat "not found" as already cleaned up.
    const alreadyGone = /not found|no running instance|not running/i.test(detail);
    return { ok: killed.status === 0 || alreadyGone, status: killed.status, detail };
  }
  try {
    // POSIX children are spawned detached so their entire process group can be
    // terminated, including nested npm/Playwright/Firebase descendants.
    process.kill(-numericPid, 'SIGKILL');
    return { ok: true, detail: 'killed process group' };
  } catch (groupError) {
    try {
      process.kill(numericPid, 'SIGKILL');
      return { ok: true, detail: 'killed child process' };
    } catch (childError) {
      if (childError?.code === 'ESRCH') return { ok: true, detail: 'child already exited' };
      return { ok: false, detail: childError?.message || groupError?.message || 'kill failed' };
    }
  }
}

function runStreamedCommand(options = {}) {
  const command = String(options.command || '').trim();
  if (!command) return Promise.reject(new Error('A command is required.'));
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const timeoutMs = positiveInteger(options.timeoutMs, 20 * 60 * 1000);
  const heartbeatMs = positiveInteger(options.heartbeatMs, 15 * 1000);
  const onStdout = typeof options.onStdout === 'function' ? options.onStdout : chunk => process.stdout.write(chunk);
  const onStderr = typeof options.onStderr === 'function' ? options.onStderr : chunk => process.stderr.write(chunk);
  const onHeartbeat = typeof options.onHeartbeat === 'function' ? options.onHeartbeat : () => {};
  const tailLimit = positiveInteger(options.tailLimit, 512 * 1024);
  const failureCapture = createActionableFailureCapture({ maxChars: positiveInteger(options.failureEvidenceLimit, 64 * 1024) });

  return new Promise(resolve => {
    const startedAt = Date.now();
    let stdoutTail = '';
    let stderrTail = '';
    let timedOut = false;
    let settled = false;
    let spawnError = null;
    let interruptedSignal = '';
    let lastOutputAt = startedAt;

    const child = cp.spawn(command, {
      shell: true,
      cwd,
      env,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearTimeout(timeout);
      process.removeListener('SIGINT', interruptHandler);
      process.removeListener('SIGTERM', terminateHandler);
      const durationMs = Date.now() - startedAt;
      resolve({
        status: typeof code === 'number' ? code : (timedOut || spawnError ? 1 : 0),
        signal: signal || null,
        error: spawnError,
        timedOut,
        interrupted: Boolean(interruptedSignal),
        interruptedSignal: interruptedSignal || null,
        durationMs,
        stdout: stdoutTail,
        stderr: stderrTail,
        pid: child.pid || null,
        lastOutputAt,
        failureEvidence: failureCapture.finish(),
      });
    };

    child.stdout?.on('data', chunk => {
      lastOutputAt = Date.now();
      stdoutTail = appendTail(stdoutTail, chunk, tailLimit);
      failureCapture.feed(chunk);
      onStdout(chunk);
    });
    child.stderr?.on('data', chunk => {
      lastOutputAt = Date.now();
      stderrTail = appendTail(stderrTail, chunk, tailLimit);
      failureCapture.feed(chunk);
      onStderr(chunk);
    });
    child.once('error', error => {
      spawnError = error;
      const errorText = `${error.stack || error.message || error}\n`;
      stderrTail = appendTail(stderrTail, errorText, tailLimit);
      failureCapture.feed(errorText);
    });
    child.once('close', finish);

    const heartbeat = setInterval(() => {
      if (settled) return;
      const now = Date.now();
      onHeartbeat({
        pid: child.pid || null,
        elapsedMs: now - startedAt,
        timeoutMs,
        silentMs: now - lastOutputAt,
      });
    }, heartbeatMs);
    heartbeat.unref?.();

    const timeout = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      const kill = killProcessTree(child.pid);
      const message = `Command timed out after ${formatDuration(timeoutMs)}. Process-tree cleanup: ${kill.ok ? 'ok' : 'FAILED'}${kill.detail ? ` (${kill.detail})` : ''}.\n`;
      stderrTail = appendTail(stderrTail, message, tailLimit);
      failureCapture.feed(message);
      onStderr(message);
      // If a platform fails to emit close after cleanup, do not leave the release
      // gate waiting forever. The child tree has already been force-killed above.
      setTimeout(() => finish(1, 'TIMEOUT'), 2000).unref?.();
    }, timeoutMs);
    timeout.unref?.();

    const handleParentSignal = signal => {
      if (settled) return;
      interruptedSignal = signal;
      const kill = killProcessTree(child.pid);
      const message = `Release-check runner received ${signal}; child process-tree cleanup: ${kill.ok ? 'ok' : 'FAILED'}${kill.detail ? ` (${kill.detail})` : ''}.\n`;
      try { onStderr(message); } catch (_) {}
      process.exitCode = signal === 'SIGINT' ? 130 : 143;
      finish(process.exitCode, signal);
    };
    const interruptHandler = () => handleParentSignal('SIGINT');
    const terminateHandler = () => handleParentSignal('SIGTERM');
    process.once('SIGINT', interruptHandler);
    process.once('SIGTERM', terminateHandler);
  });
}

module.exports = {
  positiveInteger,
  formatDuration,
  appendTail,
  killProcessTree,
  runStreamedCommand,
};

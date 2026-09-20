'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runStreamedCommand } = require('../scripts/86chaos-release-gate/streamed-command-runner.cjs');

const root = path.resolve(__dirname, '..');
const quote = value => `"${String(value).replace(/"/g, '\\"')}"`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('17.0.14 release checks stream child output and emit heartbeats instead of buffering silently', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-streamed-check-'));
  try {
    const fixture = path.join(temp, 'fixture.cjs');
    fs.writeFileSync(fixture, `process.stdout.write('alpha\\n'); setTimeout(() => { process.stdout.write('omega\\n'); process.exit(0); }, 180);`);
    let stdout = '';
    const heartbeats = [];
    const result = await runStreamedCommand({
      command: `${quote(process.execPath)} ${quote(fixture)}`,
      cwd: root,
      timeoutMs: 3000,
      heartbeatMs: 40,
      onStdout: chunk => { stdout += String(chunk); },
      onStderr: () => {},
      onHeartbeat: row => heartbeats.push(row),
    });
    assert.equal(result.status, 0);
    assert.equal(result.timedOut, false);
    assert.match(stdout, /alpha/);
    assert.match(stdout, /omega/);
    assert(heartbeats.length >= 1, 'long-running checks must expose heartbeat evidence while still alive');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('17.0.14 timed-out release checks kill nested child processes instead of leaving Playwright-style orphans', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-tree-kill-'));
  try {
    const marker = path.join(temp, 'orphan-marker.txt');
    const parent = path.join(temp, 'parent.cjs');
    fs.writeFileSync(parent, `
      const cp = require('node:child_process');
      const childCode = "setTimeout(() => require('node:fs').writeFileSync(process.env.ORPHAN_MARKER, 'orphan'), 700); setInterval(() => {}, 1000);";
      cp.spawn(process.execPath, ['-e', childCode], { stdio: 'ignore', env: process.env });
      process.stdout.write('parent-started\\n');
      setInterval(() => {}, 1000);
    `);
    let stderr = '';
    const result = await runStreamedCommand({
      command: `${quote(process.execPath)} ${quote(parent)}`,
      cwd: root,
      env: { ...process.env, ORPHAN_MARKER: marker },
      timeoutMs: 150,
      heartbeatMs: 40,
      onStdout: () => {},
      onStderr: chunk => { stderr += String(chunk); },
      onHeartbeat: () => {},
    });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.status, 0);
    assert.match(stderr, /timed out/i);
    await wait(900);
    assert.equal(fs.existsSync(marker), false, 'nested child survived release-check timeout and wrote after parent cleanup');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('17.0.14 hostile release checks are bounded, visible, controlled-concurrency, and preserve the one-paste full-gate workflow', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/run-node-release-checks.cjs'), 'utf8');
  const helper = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/streamed-command-runner.cjs'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'), 'utf8');
  assert.match(runner, /runStreamedCommand/);
  assert.match(runner, /STILL RUNNING/);
  assert.match(runner, /timedOut/);
  assert.match(runner, /STOPPING remaining .* checks/);
  assert.doesNotMatch(runner, /spawnSync\(row\.command/);
  assert.match(helper, /taskkill/);
  assert.match(helper, /'\/T', '\/F'/);
  assert.match(helper, /process\.kill\(-numericPid/);
  assert.match(pkg.scripts['test:hostile:contracts'], /--test-concurrency=1/);
  assert.match(workflow, /git --no-pager|--no-pager/);
  assert.match(workflow, /npm.*test:play-store|test:play-store/);
  assert.doesNotMatch(workflow, /test:play-store:(?:failed|delta|repair)/);
});

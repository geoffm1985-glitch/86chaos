'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { firstUsefulFailureFromOutput } = require('../scripts/86chaos-release-gate/failure-extractor.cjs');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('full release checks split schedule core tests from mobile layout Playwright', () => {
  const pkg = JSON.parse(read('package.json'));
  const runner = read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
  assert.match(pkg.scripts['test:schedule-publish:core'], /schedule-builder-route-and-publish-identity-17-0-17\.test\.cjs/);
  assert.match(pkg.scripts['test:schedule-publish:core'], /react-scripts test --watchAll=false --runInBand/);
  assert.doesNotMatch(pkg.scripts['test:schedule-publish:core'], /playwright|mobile-voice-layout/);
  assert.equal(pkg.scripts['test:schedule-publish'], 'npm run test:schedule-publish:core && npm run test:mobile-voice-layout');
  assert.match(runner, /--timeout 600 -- npm run test:schedule-publish:core/);
  assert.match(runner, /group: 'mobile layout Playwright smoke'/);
  assert.match(runner, /--timeout 180 -- node node_modules\/@playwright\/test\/cli\.js test --config=playwright\.layout\.config\.cjs/);
  assert.doesNotMatch(runner, /--timeout 900 -- npm run test:schedule-publish['"]/);
});

test('observable timeout is reported as timeout instead of TAP fail zero', () => {
  const wrapper = path.join(__dirname, '..', 'scripts', '86chaos-release-gate', 'run-observable-command.cjs');
  const fixture = "console.log('TAP version 13'); console.log('\\u2139 pass 19'); console.log('\\u2139 fail 0'); setInterval(() => {}, 1000);";
  const child = cp.spawnSync(process.execPath, [wrapper, '--label', 'Gate timeout fixture', '--heartbeat', '5', '--timeout', '1', '--', process.execPath, '-e', fixture], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000, windowsHide: true
  });
  assert.equal(child.status, 124, `${child.stdout || ''}\n${child.stderr || ''}`);
  const failure = firstUsefulFailureFromOutput(child);
  assert.match(failure, /TIMED OUT Gate timeout fixture/i);
  assert.match(failure, /timeout=1s/i);
  assert.doesNotMatch(failure, /fail 0/i);
});

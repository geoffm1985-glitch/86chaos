'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TARGET_ENV_KEYS, inspectReleaseTargetEnvConflicts } = require('../scripts/86chaos-release-gate/vercel-targets.cjs');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('full Play Store runner pins expected version to package.json after loading local env', () => {
  const runner = read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
  const packageVersion = JSON.parse(read('package.json')).version;
  const keyLine = runner.match(/\$ReleaseTargetKeys\s*=\s*@\([^\r\n]+\)/)?.[0] || '';
  assert.ok(keyLine, 'release target key list exists');
  assert.doesNotMatch(keyLine, /CHAOS_EXPECTED_VERSION/, 'persisted expected version is not a full-gate target conflict');
  assert.match(runner, /Get-Content \(Join-Path \$Root 'package\.json'\) -Raw \| ConvertFrom-Json/);
  assert.match(runner, /SetEnvironmentVariable\('CHAOS_EXPECTED_VERSION', \$PackageVersion, 'Process'\)/);
  assert.match(runner, /\$env:CHAOS_EXPECTED_VERSION = \$PackageVersion/);
  assert.match(runner, /Ignoring stale CHAOS_EXPECTED_VERSION=/);
  const imports = runner.indexOf('Import-EnvFile $EnvLocal');
  const pin = runner.indexOf("SetEnvironmentVariable('CHAOS_EXPECTED_VERSION', $PackageVersion, 'Process')");
  const preflight = runner.indexOf('preflight-and-start.cjs');
  assert.ok(imports >= 0 && pin > imports, 'version pin happens after local env import');
  assert.ok(preflight > pin, 'version pin happens before release preflight');
  assert.equal(packageVersion, '17.0.25');
});

test('certification preflight ignores persisted expected-version conflicts but non-certification checks remain strict', () => {
  const preflight = read('scripts/86chaos-release-gate/preflight-env.cjs');
  assert.match(preflight, /const certificationMode = boolEnv\('CHAOS_CERTIFICATION_MODE'\)/);
  assert.match(preflight, /TARGET_ENV_KEYS\.filter\(key => key !== 'CHAOS_EXPECTED_VERSION'\)/);
  assert.match(preflight, /const expectedVersion = certificationMode\s*\? packageVersionFromSource\s*:\s*\(configuredExpectedVersion \|\| packageVersionFromSource\)/s);
  assert.match(preflight, /if \(!certificationMode && expectedVersion && packageVersion && packageVersion !== expectedVersion\)/);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-version-conflict-'));
  try {
    fs.writeFileSync(path.join(temp, '.env.test.local'), 'CHAOS_EXPECTED_VERSION=17.0.8\n', 'utf8');
    const env = { CHAOS_EXPECTED_VERSION: '17.0.25' };
    const strict = inspectReleaseTargetEnvConflicts(temp, env);
    assert.equal(strict.ok, false, 'generic/non-certification conflict detection remains strict');
    assert.match(strict.errors.join('\n'), /Conflicting CHAOS_EXPECTED_VERSION values detected/);

    const certificationKeys = TARGET_ENV_KEYS.filter(key => key !== 'CHAOS_EXPECTED_VERSION');
    const certification = inspectReleaseTargetEnvConflicts(temp, env, certificationKeys);
    assert.equal(certification.ok, true, certification.errors.join('\n'));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

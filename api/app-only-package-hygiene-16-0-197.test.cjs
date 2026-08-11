'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  findAppOnlyHygieneOffenders,
  isForbiddenRelativePath,
} = require('../scripts/86chaos-release-gate/app-only-package-hygiene.cjs');

const root = path.resolve(__dirname, '..');

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr || result.error?.message || ''}`);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-hygiene-'));
}

test('current checkout hygiene ignores expected untracked .git, node_modules, and local test env files', () => {
  assert.deepEqual(findAppOnlyHygieneOffenders(root), []);
});

test('forbidden-path classifier covers release junk and local secrets', () => {
  for (const rel of ['node_modules/a.js', 'build/index.html', 'coverage/x', '.git/config', 'test-results/.last-run.json', '.env.test.local', 'x/__pycache__/a.pyc']) {
    assert.equal(isForbiddenRelativePath(rel), true, rel);
  }
  assert.equal(isForbiddenRelativePath('src/App.js'), false);
});

test('git checkout mode checks tracked files instead of normal local working artifacts', () => {
  const dir = makeTempDir();
  try {
    runGit(dir, ['init', '-q']);
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.env.test.local\n');
    fs.writeFileSync(path.join(dir, 'safe.txt'), 'safe\n');
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'local.js'), 'local\n');
    fs.writeFileSync(path.join(dir, '.env.test.local'), 'LOCAL_ONLY=1\n');
    runGit(dir, ['add', '.gitignore', 'safe.txt']);
    assert.deepEqual(findAppOnlyHygieneOffenders(dir), []);

    runGit(dir, ['add', '-f', '.env.test.local']);
    assert.deepEqual(findAppOnlyHygieneOffenders(dir), ['.env.test.local']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('extracted-package mode rejects forbidden physical artifacts when .git is absent', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.env.test.local'), 'DO_NOT_SHIP=1\n');
    fs.writeFileSync(path.join(dir, 'safe.txt'), 'safe\n');
    assert.deepEqual(findAppOnlyHygieneOffenders(dir), ['.env.test.local', 'node_modules']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('repair-run mode may ignore only generated test-results while still rejecting shipped junk', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'test-results', '.last-run.json'), '{}\n');
    assert.deepEqual(findAppOnlyHygieneOffenders(dir, { allowGeneratedTestArtifacts: false }), ['test-results']);
    assert.deepEqual(findAppOnlyHygieneOffenders(dir, { allowGeneratedTestArtifacts: true }), []);

    fs.mkdirSync(path.join(dir, 'scripts', 'python', '__pycache__'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts', 'python', '__pycache__', 'generated.pyc'), 'bytecode');
    assert.deepEqual(findAppOnlyHygieneOffenders(dir, { allowGeneratedTestArtifacts: true }), []);

    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    assert.deepEqual(findAppOnlyHygieneOffenders(dir, { allowGeneratedTestArtifacts: true }), ['node_modules']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('source inventory excludes generated release-gate results from package scans', () => {
  const inventory = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/source-inventory.cjs'), 'utf8');
  assert.match(inventory, /test-results/);
  assert.match(inventory, /node_modules/);
  assert.match(inventory, /build/);
});

test('release-readiness mode ignores generated local install/build outputs only for the active checkout root', () => {
  const dir = makeTempDir();
  const originalCwd = process.cwd();
  const originalEnv = process.env.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS;
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'local-checkout' }));
    fs.mkdirSync(path.join(dir, 'build', 'static'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'build', 'index.html'), '<!doctype html>');
    fs.mkdirSync(path.join(dir, 'node_modules', 'vite'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'vite', 'index.js'), 'module.exports = {};');
    fs.mkdirSync(path.join(dir, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'test-results', '.last-run.json'), '{}');

    assert.deepEqual(findAppOnlyHygieneOffenders(dir, { allowGeneratedTestArtifacts: false, allowLocalReadinessArtifacts: false }), ['build', 'node_modules', 'test-results'], 'strict package mode still rejects generated artifacts');

    process.env.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS = '1';
    process.chdir(dir);
    assert.deepEqual(findAppOnlyHygieneOffenders(dir), [], 'local readiness may ignore generated build/install/test outputs in the active checkout root');

    fs.writeFileSync(path.join(dir, '.env.local'), 'SECRET=must-not-pass');
    assert.deepEqual(findAppOnlyHygieneOffenders(dir), ['.env.local'], 'local readiness never ignores local secrets');
  } finally {
    process.chdir(originalCwd);
    if (originalEnv === undefined) delete process.env.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS;
    else process.env.CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS = originalEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('release-node readiness runner grants local artifact mode only to server tests', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts/86chaos-release-gate/run-node-release-checks.cjs'), 'utf8');
  assert.match(runner, /CHAOS_ALLOW_LOCAL_RELEASE_ARTIFACTS\s*=\s*['"]1['"]/, 'server-test local readiness environment is wired');
  assert.equal(runner.includes("/^server tests$/i.test(row.group || '')"), true, 'allowance is scoped to the server tests group');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const workflow = require('../scripts/86chaos-release-workflow/install-app-only.cjs');
const root = path.resolve(__dirname, '..');

function git(cwd, args) { const result = cp.spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout; }
function writeFixtureManifest(root) {
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).replace(/\\/g, '/');
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && relative !== 'release-source-manifest.json') files.push(relative);
    }
  };
  walk(root);
  const rows = files.sort().map(file => ({
    file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file)).toString('utf8').replace(/\r\n/g, '\n')).digest('hex'),
  }));
  fs.writeFileSync(path.join(root, 'release-source-manifest.json'), JSON.stringify({ schemaVersion:1, sourceHash:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'), files:rows }, null, 2)+'\n');
}
function createFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-workflow-1711-'));
  const source = path.join(fixture, 'source');
  const repository = path.join(fixture, 'repository');
  fs.mkdirSync(source); fs.mkdirSync(repository);
  for (const relative of workflow.REQUIRED_PATHS) {
    const target = path.join(source, relative);
    if (path.extname(relative) || /RUN_/.test(relative)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, relative === 'package.json' ? '{"version":"17.0.11"}\n' : '{}\n'); }
    else fs.mkdirSync(target, { recursive: true });
  }
  fs.writeFileSync(path.join(source, 'src', 'marker.js'), 'new source\n');
  writeFixtureManifest(source);
  git(repository, ['init', '-b', 'testing']);
  git(repository, ['config', 'user.email', 'test@example.invalid']); git(repository, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(repository, 'tracked.txt'), 'preserve\n');
  fs.writeFileSync(path.join(repository, 'package.json'), '{"version":"17.0.10"}\n');
  const repoRows = [
    { file: 'package.json', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repository, 'package.json'))).digest('hex') },
    { file: 'tracked.txt', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repository, 'tracked.txt'))).digest('hex') },
  ].sort((a,b)=>a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  fs.writeFileSync(path.join(repository, 'release-source-manifest.json'), JSON.stringify({ schemaVersion:1, sourceHash:crypto.createHash('sha256').update(JSON.stringify(repoRows)).digest('hex'), files:repoRows }, null, 2)+'\n');
  git(repository, ['add', '.']); git(repository, ['commit', '-m', 'fixture']);
  return { fixture, source, repository };
}

test('17.0.11 app-only overlay preserves .git and copies a validated complete source tree', () => {
  const item = createFixture();
  try {
    const headBefore = fs.readFileSync(path.join(item.repository, '.git', 'HEAD'), 'utf8');
    const result = workflow.copyApplicationOverlay(item.source, item.repository, '17.0.11');
    assert.equal(result.gitPreserved, true);
    assert.equal(fs.readFileSync(path.join(item.repository, '.git', 'HEAD'), 'utf8'), headBefore);
    assert.equal(fs.readFileSync(path.join(item.repository, 'src', 'marker.js'), 'utf8'), 'new source\n');
  } finally { fs.rmSync(item.fixture, { recursive: true, force: true }); }
});

test('17.0.11 app-only overlay refuses exact dirty paths before overwriting source', () => {
  const item = createFixture();
  try {
    fs.writeFileSync(path.join(item.repository, 'tracked.txt'), 'user edit\n');
    assert.throws(() => workflow.copyApplicationOverlay(item.source, item.repository, '17.0.11'), /tracked\.txt/);
    assert.equal(fs.existsSync(path.join(item.repository, 'src', 'marker.js')), false);
  } finally { fs.rmSync(item.fixture, { recursive: true, force: true }); }
});

test('17.0.11 automatic workflow forbids destructive Git and pager behavior and runs only the full user gate', () => {
  const script = fs.readFileSync(path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'), 'utf8');
  assert.match(script, /GIT_PAGER\s*=\s*'cat'/);
  assert.match(script, /PAGER\s*=\s*'cat'/);
  assert.match(script, /git --no-pager/);
  assert.match(script, /@\('switch', 'testing'\)/);
  assert.doesNotMatch(script, /git\s+rm\s+-r\s+--cached\s+\./i);
  assert.doesNotMatch(script, /git\s+reset\s+--hard/i);
  assert.doesNotMatch(script, /npm\s+audit\s+fix\s+--force/i);
  assert.match(script, /@\('run', 'test:play-store'\)/);
  assert.match(script, /CHAOS_AUTOMATED_RELEASE_WORKFLOW = 'true'/);
  assert.doesNotMatch(script, /test:play-store:(?:failed|delta|repair)/);
});

test('17.0.11 automatic workflow uses parser-safe PowerShell variable interpolation before colons', () => {
  const script = fs.readFileSync(path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'), 'utf8');
  const ambiguousReferences = [...script.matchAll(/\$(?!(?:env|script|global|local|private|using):)([A-Za-z_][A-Za-z0-9_]*):/g)]
    .map((match) => match[0]);
  assert.deepEqual(ambiguousReferences, []);
  assert.match(script, /Release \$\{ExpectedVersion\}:/);
});

test('17.0.11 release gate persists total timing into slim evidence and prints elapsed time last', () => {
  const script = fs.readFileSync(path.join(root, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1'), 'utf8');
  for (const field of ['startedAt', 'finishedAt', 'totalElapsedMs', 'totalElapsedFormatted']) assert.match(script, new RegExp(field));
  assert.match(script, /Update-TotalTimingEvidence/);
  assert.match(script, /New-Slim-ReleaseGateReport[\s\S]+Update-TotalTimingEvidence[\s\S]+New-Slim-ReleaseGateReport/);
  assert(script.lastIndexOf('TOTAL ELAPSED TIME:') > script.lastIndexOf('Exported:'));
});

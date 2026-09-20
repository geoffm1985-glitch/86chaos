'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const installer = require('../scripts/86chaos-release-workflow/install-app-only.cjs');

function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function write(rootDir, relative, contents = '') {
  const absolute = path.join(rootDir, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
}
function buildFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-package-preflight-'));
  for (const required of installer.REQUIRED_PATHS) {
    if (path.extname(required) || required.includes('.')) continue;
    fs.mkdirSync(path.join(dir, required), { recursive: true });
  }
  write(dir, 'package.json', JSON.stringify({ name: 'fixture', version: '17.0.24' }) + '\n');
  write(dir, 'package-lock.json', JSON.stringify({ name: 'fixture', version: '17.0.24', lockfileVersion: 3, packages: { '': { version: '17.0.24' } } }) + '\n');
  write(dir, 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1', "Write-Host 'fixture'\n");
  for (const folder of ['src','api','scripts','test-tools','tests']) write(dir, `${folder}/fixture.txt`, `${folder}\n`);
  const files = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(dir, absolute).replace(/\\/g, '/');
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && relative !== 'release-source-manifest.json') files.push(relative);
    }
  };
  walk(dir);
  files.sort();
  const rows = files.map(file => ({ file, sha256: hash(installer.forbiddenSourcePath(file) ? Buffer.alloc(0) : fs.readFileSync(path.join(dir, file)).toString('utf8').replace(/\r\n/g, '\n')) }));
  const manifest = { schemaVersion: 1, sourceHash: hash(Buffer.from(JSON.stringify(rows))), files: rows };
  write(dir, 'release-source-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return dir;
}

test('17.0.24 package preflight accepts a clean manifest-complete app-only source', t => {
  const dir = buildFixture();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = installer.validateExtractedApplication(dir, '17.0.24');
  assert.equal(result.version, '17.0.24');
  assert.match(result.sourceHash, /^[a-f0-9]{64}$/);
});

test('17.0.24 package preflight rejects generated test-results before repository installation', t => {
  const dir = buildFixture();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  write(dir, 'test-results/86chaos-play-store-release-gate/.last-run.json', '{}\n');
  assert.throws(() => installer.validateExtractedApplication(dir, '17.0.24'), /forbidden content:.*test-results/i);
});

test('17.0.24 package preflight rejects unmanifested stray source files', t => {
  const dir = buildFixture();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  write(dir, 'src/unmanifested.js', 'module.exports = true;\n');
  assert.throws(() => installer.validateExtractedApplication(dir, '17.0.24'), /unmanifested content:.*src\/unmanifested\.js/i);
});

test('17.0.24 one-paste updater performs deep app-only preflight before repository verification or installation', () => {
  const updater = fs.readFileSync(path.join(root, 'RUN_86CHAOS_UPDATE_TEST_DEPLOY.ps1'), 'utf8');
  const preflight = updater.indexOf('validate-app-only.cjs');
  const verifyRepo = updater.indexOf("Invoke-Stage 'verify repository and testing branch'");
  const install = updater.indexOf("Invoke-Stage 'install release ZIP into repository'");
  assert.ok(preflight > 0, 'deep package preflight must be wired into updater');
  assert.ok(verifyRepo > preflight, 'package preflight must run before repository verification');
  assert.ok(install > verifyRepo, 'repository installation must remain after verification');
});

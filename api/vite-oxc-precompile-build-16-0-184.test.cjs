'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  BUILD_WORKSPACE_PREFIX,
  OXC_JSX_OPTIONS,
  listSourceJsFiles,
  createBuildWorkspace,
  precompileWorkspaceSource,
  cleanupBuildWorkspace
} = require('../scripts/vite-build-source-precompile.cjs');

const root = path.resolve(__dirname, '..');

function makeFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), '86chaos-vite-precompile-'));
  fs.mkdirSync(path.join(fixture, 'src', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'public'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'src', 'index.js'), 'const view = <StrictMode />;\n');
  fs.writeFileSync(path.join(fixture, 'src', 'nested', 'plain.js'), 'export const answer = 42;\n');
  fs.writeFileSync(path.join(fixture, 'src', 'already.jsx'), 'export default <div />;\n');
  fs.writeFileSync(path.join(fixture, 'public', 'version.json'), '{"version":"fixture"}\n');
  fs.writeFileSync(path.join(fixture, 'index.html'), '<div id="root"></div>\n');
  return fixture;
}

test('temporary Vite workspace copies build inputs without mutating source tree', async () => {
  const fixture = makeFixture();
  const workspace = path.join(fixture, `${BUILD_WORKSPACE_PREFIX}test`);
  try {
    createBuildWorkspace(fixture, workspace);
    const before = fs.readFileSync(path.join(fixture, 'src', 'index.js'), 'utf8');
    const calls = [];
    const transformed = await precompileWorkspaceSource(workspace, async (code, filename, options) => {
      calls.push({ code, filename, options });
      return { code: code.replace('<StrictMode />', 'React.createElement(StrictMode, null)') };
    });

    assert.equal(transformed.length, 2, 'only src .js files are precompiled');
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.filename.endsWith('.jsx')), 'Oxc parser hint uses JSX filenames');
    assert.deepEqual(calls[0].options, OXC_JSX_OPTIONS);
    assert.equal(fs.readFileSync(path.join(fixture, 'src', 'index.js'), 'utf8'), before, 'real source stays untouched');
    assert.match(fs.readFileSync(path.join(workspace, 'src', 'index.js'), 'utf8'), /React\.createElement/);
    assert.equal(fs.readFileSync(path.join(workspace, 'src', 'already.jsx'), 'utf8'), 'export default <div />;\n', 'existing JSX source is left to normal Vite handling');
  } finally {
    cleanupBuildWorkspace(workspace);
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('build precompiler remains scoped to copied src .js files and cleans up safely', () => {
  const fixture = makeFixture();
  const workspace = path.join(fixture, `${BUILD_WORKSPACE_PREFIX}cleanup`);
  try {
    createBuildWorkspace(fixture, workspace);
    assert.deepEqual(
      listSourceJsFiles(workspace).map((file) => path.relative(workspace, file).replace(/\\/g, '/')),
      ['src/index.js', 'src/nested/plain.js']
    );
    cleanupBuildWorkspace(workspace);
    assert.equal(fs.existsSync(workspace), false);
    cleanupBuildWorkspace(workspace);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('production build runner uses Vite transformWithOxc, temporary root, real config, and asset manifest', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts', 'vite-build-with-asset-manifest.cjs'), 'utf8');
  const helper = fs.readFileSync(path.join(root, 'scripts', 'vite-build-source-precompile.cjs'), 'utf8');
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

  assert.ok(runner.includes("await import('vite')"));
  assert.ok(runner.includes('transformWithOxc'));
  assert.ok(runner.includes('createBuildWorkspace(root)'));
  assert.ok(runner.includes("'--config', path.join(root, 'vite.config.js')"));
  assert.ok(runner.includes('generateAssetManifest()'));
  assert.ok(runner.includes('cleanupBuildWorkspace(workspaceRoot)'));
  assert.ok(helper.includes("runtime: 'automatic'") && helper.includes("importSource: 'react'"));
  assert.ok(gitignore.includes('.vite-build-root-*/'));
});

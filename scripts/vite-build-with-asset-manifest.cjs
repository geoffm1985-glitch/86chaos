#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { generateAssetManifest } = require('./generate-vite-asset-manifest.cjs');
const {
  createBuildWorkspace,
  precompileWorkspaceSource,
  cleanupBuildWorkspace
} = require('./vite-build-source-precompile.cjs');

const root = path.resolve(__dirname, '..');

function findPackageRootFromEntry(entryPath, packageName) {
  let current = path.dirname(entryPath);
  for (let i = 0; i < 12; i += 1) {
    const candidate = path.join(current, 'package.json');
    if (require('node:fs').existsSync(candidate)) {
      try {
        const pkg = JSON.parse(require('node:fs').readFileSync(candidate, 'utf8'));
        if (!packageName || pkg.name === packageName) return { dir: current, pkg };
      } catch (_) {}
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return null;
}

function resolveViteCli() {
  try {
    return require.resolve('vite/bin/vite.js', { paths: [root] });
  } catch (_) {}
  const viteEntry = require.resolve('vite', { paths: [root] });
  const found = findPackageRootFromEntry(viteEntry, 'vite');
  const bin = found?.pkg?.bin?.vite || 'bin/vite.js';
  const resolved = path.join(found?.dir || path.join(root, 'node_modules', 'vite'), bin);
  if (!require('node:fs').existsSync(resolved)) {
    throw new Error(`Unable to locate Vite CLI entrypoint. Checked ${resolved}`);
  }
  return resolved;
}

async function main() {
  let workspaceRoot = null;
  try {
    const { transformWithOxc } = await import('vite');
    workspaceRoot = createBuildWorkspace(root);
    const transformedFiles = await precompileWorkspaceSource(workspaceRoot, transformWithOxc);
    console.log(`[vite-build] Oxc precompiled ${transformedFiles.length} src .js files in temporary build workspace.`);

    const viteCli = resolveViteCli();
    const result = spawnSync(process.execPath, [
      viteCli,
      'build',
      workspaceRoot,
      '--config', path.join(root, 'vite.config.js'),
      '--outDir', path.join(root, 'build')
    ], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
        GENERATE_SOURCEMAP: process.env.GENERATE_SOURCEMAP || 'false'
      }
    });

    const status = result.status ?? 1;
    if (result.error) {
      console.error('[vite-build] Failed to launch Vite CLI:', result.error.message || result.error);
      process.exitCode = 1;
      return;
    }

    if (status !== 0) {
      process.exitCode = status;
      return;
    }

    generateAssetManifest();
  } finally {
    cleanupBuildWorkspace(workspaceRoot);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

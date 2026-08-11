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
const viteBin = process.platform === 'win32'
  ? path.join(root, 'node_modules', '.bin', 'vite.cmd')
  : path.join(root, 'node_modules', '.bin', 'vite');

async function main() {
  let workspaceRoot = null;
  try {
    const { transformWithOxc } = await import('vite');
    workspaceRoot = createBuildWorkspace(root);
    const transformedFiles = await precompileWorkspaceSource(workspaceRoot, transformWithOxc);
    console.log(`[vite-build] Oxc precompiled ${transformedFiles.length} src .js files in temporary build workspace.`);

    const result = spawnSync(viteBin, [
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

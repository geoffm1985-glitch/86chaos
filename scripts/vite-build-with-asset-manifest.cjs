#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const { generateAssetManifest } = require('./generate-vite-asset-manifest.cjs');

const root = path.resolve(__dirname, '..');
const viteBin = process.platform === 'win32'
  ? path.join(root, 'node_modules', '.bin', 'vite.cmd')
  : path.join(root, 'node_modules', '.bin', 'vite');

const result = spawnSync(viteBin, ['build', '--outDir', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
    GENERATE_SOURCEMAP: process.env.GENERATE_SOURCEMAP || 'false'
  }
});

if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
generateAssetManifest();

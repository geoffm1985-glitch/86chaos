#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');
const manifestPath = path.join(buildDir, 'asset-manifest.json');

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

function logicalName(file) {
  const base = path.basename(file);
  if (/^index-[A-Za-z0-9_-]+\.js$/.test(base)) return 'main.js';
  if (/^index-[A-Za-z0-9_-]+\.css$/.test(base)) return 'main.css';
  return file;
}

function generateAssetManifest() {
  const files = {};
  const entrypoints = [];
  for (const file of walk(buildDir)) {
    if (file === 'asset-manifest.json') continue;
    const publicPath = `/${file}`;
    files[logicalName(file)] = publicPath;
    if (/^static\/.+\.(js|css)$/.test(file)) entrypoints.push(publicPath);
  }
  entrypoints.sort((a, b) => Number(a.endsWith('.css')) - Number(b.endsWith('.css')) || a.localeCompare(b));
  const manifest = { files, entrypoints };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  if (!fs.existsSync(buildDir)) {
    console.error('build directory does not exist; run vite build first');
    process.exit(1);
  }
  generateAssetManifest();
  console.log(`Generated ${path.relative(root, manifestPath)}`);
}

module.exports = { generateAssetManifest, walk, logicalName };

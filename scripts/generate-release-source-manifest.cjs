#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { sourceFiles, sourceBytes, hash } = require('./86chaos-release-gate/source-identity.cjs');

function generate(root = process.cwd()) {
  const files = sourceFiles(root).map(file => ({ file, sha256: hash(sourceBytes(file, fs.readFileSync(path.join(root, file)))) }));
  const manifest = { schemaVersion: 1, sourceHash: hash(JSON.stringify(files)), files };
  fs.writeFileSync(path.join(root, 'release-source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  const manifest = generate();
  console.log(JSON.stringify({ sourceHash: manifest.sourceHash, fileCount: manifest.files.length }));
}

module.exports = { generate };

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return {};
  }
}

function readField(kind, value = {}) {
  if (kind === 'commit') return String(value.gitCommit || value.commit || '');
  if (kind === 'version') return String(value.version || '');
  throw new Error(`Unsupported deployment identity field: ${kind}`);
}

if (require.main === module) {
  const [kind, file] = process.argv.slice(2);
  if (!kind || !file) {
    process.stderr.write('Usage: node scripts/ci/read-deployment-identity.cjs <commit|version> <json-file>\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(readField(kind, readJson(file)));
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
    }
  }
}

module.exports = { readJson, readField };

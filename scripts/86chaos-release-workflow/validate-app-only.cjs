#!/usr/bin/env node
'use strict';
const path = require('node:path');
const { validateExtractedApplication } = require('./install-app-only.cjs');

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    values[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  return values;
}

try {
  const args = parseArguments(process.argv.slice(2));
  if (!args.source || !args['expected-version']) {
    throw new Error('Usage: node validate-app-only.cjs --source <directory> --expected-version <version>');
  }
  const result = validateExtractedApplication(path.resolve(args.source), args['expected-version']);
  console.log(`App-only package preflight passed: version=${result.version} files=${result.files} source=${result.sourceHash}`);
} catch (error) {
  console.error(`APP-ONLY PACKAGE PREFLIGHT FAILED: ${error.message}`);
  process.exitCode = 1;
}

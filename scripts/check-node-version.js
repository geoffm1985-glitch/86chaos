#!/usr/bin/env node
const major = Number(String(process.versions.node || '').split('.')[0]);
console.log(`Detected Node ${process.versions.node}`);
if (major !== 24) {
  console.error('86 Chaos release validation requires Node 24.x. Install/use Node 24 before running npm ci, tests, build, or release gates.');
  process.exit(1);
}

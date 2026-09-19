#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.75 targeted test failed: ${message}`);
    process.exitCode = 1;
  }
};

const version = json('public/version.json');
const app = read('src/App.js');
const management = read('src/features/management.jsx');
const vercel = json('vercel.json');

assert(version.version === '16.0.75', 'version.json reports 16.0.75');
assert(app.includes('clearRuntimeRecoveryCaches'), 'runtime recovery can clear browser caches');
assert(app.includes('navigator.serviceWorker?.getRegistrations'), 'runtime recovery can unregister stale service workers');
assert(app.includes('window.caches.keys'), 'runtime recovery deletes Cache Storage entries');
assert(app.includes('chaosHardRefresh'), 'manual recovery reload uses a hard-refresh cache buster');
assert(app.includes('Clear App Cache & Reload'), 'manual recovery button is clear for stuck Schedule/Time Clock users');
assert(app.includes("await clearRuntimeRecoveryCaches('auto-chunk-recovery')"), 'one-shot automatic chunk recovery clears caches before trying again');
assert(!app.includes('manualRefresh=${Date.now()}'), 'old soft refresh-only recovery button was removed');
assert(management.includes('attention: response.ok && result.ok === false'), 'health diagnostics classify HTTP 200 ok:false as attention');
assert(management.includes("check.ok ? 'OK' : check.attention ? 'ATTENTION'"), 'health diagnostics do not show ERR 200 for attention-only health checks');
assert(vercel.crons.some(c => c.path === '/api/firestore-backup' && c.schedule === '0 9 * * *'), 'daily production Firestore backup cron exists');
assert(vercel.crons.some(c => c.path === '/api/firestore-backup-watchdog'), 'backup watchdog cron still exists');

if (!process.exitCode) console.log('16.0.75 targeted runtime recovery and backup cron tests passed.');

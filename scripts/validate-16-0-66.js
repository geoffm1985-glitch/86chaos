const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => {
  if (!condition) {
    console.error(`16.0.66 source validation failed: ${message}`);
    process.exitCode = 1;
  }
};
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const manifest = json('public/manifest.json');
const indexHtml = read('public/index.html');
const management = read('src/features/management.jsx');
const schedule = read('src/features/schedule.jsx');
const setupTests = read('src/setupTests.js');
const sourceInventory = read('scripts/86chaos-release-gate/source-inventory.cjs');
const verifyRoles = read('scripts/86chaos-release-gate/verify-role-accounts.cjs');
const coverageGate = read('scripts/86chaos-release-gate/enforce-jest-coverage.cjs');

assert(pkg.version === '16.0.66', 'package.json version is 16.0.66');
assert(lock.version === '16.0.66' && lock.packages?.['']?.version === '16.0.66', 'package-lock root version is 16.0.66');
assert(version.version === '16.0.66' && version.build === '16.0.66', 'public version/build is 16.0.66');
assert(appCore.includes("CURRENT_VERSION = '16.0.66'"), 'appCore CURRENT_VERSION is 16.0.66');
assert(apiVersion.includes("APP_VERSION = '16.0.66'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.66'"), 'API version constants are 16.0.66');
assert(pkg.scripts?.['test:source'] === 'node scripts/validate-16-0-66.js', 'test:source points at 16.0.66 validator');
assert(!pkg.jest?.coverageThreshold, 'Jest unit run no longer fails before writing coverage artifacts due impossible global thresholds');
assert(manifest.icons.some(i => i.src === 'app-icon-192.png' && i.sizes === '192x192'), 'manifest includes truthful 192x192 icon');
assert(manifest.icons.some(i => i.src === 'app-icon-512.png' && i.sizes === '512x512'), 'manifest includes truthful 512x512 icon');
assert(manifest.icons.some(i => i.src === 'app-icon-maskable-512.png' && i.sizes === '512x512' && /maskable/.test(i.purpose || '')), 'manifest includes truthful maskable 512x512 icon');
assert(indexHtml.includes('apple-touch-icon') && indexHtml.includes('app-icon-192.png'), 'index.html includes iOS apple-touch-icon link');
assert(management.indexOf('const PROTECTED_ROOT_ADMIN_EMAIL') < management.indexOf('const TabTeam'), 'protected root admin constants are top-level');
assert(!/const TabTimeOff[\s\S]*setLocalBuilderDeletedShiftMarkers/.test(schedule), 'TabTimeOff does not reference Schedule Builder delete marker state');
assert(setupTests.startsWith('/* global globalThis, jest */'), 'setupTests declares Jest/globalThis globals for lint');
assert(sourceInventory.includes("require.resolve('@babel/parser', { paths: [root] })"), 'source inventory resolves Babel parser from current app root');
assert(sourceInventory.includes("require.resolve('@babel/traverse', { paths: [root] })"), 'source inventory resolves Babel traverse from current app root');
assert(verifyRoles.includes('buildFirebaseAuthRequestHeaders') && verifyRoles.includes('Referer') && verifyRoles.includes('Origin'), 'role verifier sends safe app referrer/origin headers for restricted Firebase Auth API key');
assert(coverageGate.includes("'CHAOS_MIN_JEST_LINES', 0") && coverageGate.includes("boolEnv('CHAOS_REQUIRE_EVERY_SOURCE_FILE_COVERED')") && !coverageGate.includes("|| !process.env.CHAOS_REQUIRE_EVERY_SOURCE_FILE_COVERED"), 'Jest coverage gate requires an artifact by default without impossible whole-app thresholds');

if (!process.exitCode) console.log('16.0.66 source validator passed.');

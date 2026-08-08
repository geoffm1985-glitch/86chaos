#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateIconSourcePackage } = require('./86chaos-release-gate/icon-source-validator.cjs');
const { generatePlaywrightInventory } = require('./86chaos-release-gate/playwright-inventory.cjs');
const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'); }
let failures = 0;
function assert(ok, message) { if (ok) console.log(`✓ ${message}`); else { console.error(`✗ ${message}`); failures += 1; } }
const pkg = json('package.json');
const lock = json('package-lock.json');
const version = json('public/version.json');
const appCore = read('src/core/appCore.js');
const apiVersion = read('api/_version.js');
const manifest = json('public/manifest.json');
const indexHtml = read('public/index.html');
const failedUtils = read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');
const collector = read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
const scheduleMutation = read('tests/86chaos-full-audit/05-schedule-builder-mutation.spec.cjs');
const requestOffSpec = read('tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs');
const provisioner = read('scripts/86chaos-release-gate/provision-test-accounts.cjs');
const seed = read('scripts/86chaos-full-audit/seed-fake-restaurant.cjs');
const cleanup = read('scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs');

assert(pkg.version === '16.0.146', 'package.json version is 16.0.146');
assert(lock.version === '16.0.146' && lock.packages?.['']?.version === '16.0.146', 'package-lock root versions are 16.0.146');
assert(version.version === '16.0.146' && version.build === '16.0.146', 'public/version.json version/build are 16.0.146');
assert(appCore.includes("CURRENT_VERSION = '16.0.146'"), 'app core CURRENT_VERSION is 16.0.146');
assert(apiVersion.includes("APP_VERSION = '16.0.146'") && apiVersion.includes("SECURITY_SCHEMA_VERSION = '16.0.146'"), 'api version reports 16.0.146');
assert(pkg.scripts['test:source'] === 'node scripts/validate-16-0-146.js', 'test:source points at 16.0.146 validator');
assert(pkg.scripts['test:play-store:delta'] && pkg.scripts['test:play-store:delta'].includes('FAILED_AND_NEW'), 'failed+new delta command is present');
assert(!fs.existsSync(path.join(root, 'scripts/validate-16-0-144.js')), 'previous 16.0.144 validator was replaced');

assert(sha('firestore.rules') === '51bfd7d39edd59f680ae41a149c108cec8cd42d00b102d84cb00ee40d90264d9', 'firestore.rules unchanged');
assert(sha('storage.rules') === '174e7e9a140193ff69ccf0f0d3e5c65b81a9e0fbbd612bff45ce57e7a3a7ce9c', 'storage.rules unchanged');
assert(sha('database.rules.json') === '152b5cd3f9839f598c9602706d8205b96759296e865d540b52c780900bfba138', 'database.rules.json unchanged');
assert(sha('firestore.indexes.json') === 'ee666de303988cd269f7c09fa63678a2deb1cfcaa199cb4f1656dd9bddcc4b4b', 'firestore.indexes.json unchanged');
assert(sha('firebase.json') === 'bd837a11c71750d4da6ccfcb725ca54e78dd76008b525ec54c7fe79a5b8a3ca4', 'firebase.json unchanged');

const iconReport = validateIconSourcePackage(root);
assert(iconReport.ok, `PWA icon source package is complete${iconReport.errors.length ? ': ' + iconReport.errors.join('; ') : ''}`);
assert(manifest.name === '86 Chaos' && manifest.short_name === '86 Chaos' && manifest.display === 'standalone', 'manifest preserves 86 Chaos identity and standalone display');
assert(manifest.icons.every(icon => fs.existsSync(path.join(root, 'public', icon.src.replace(/^\//, '')))), 'every manifest icon exists in source');
assert(indexHtml.includes('86chaos-icon-180-v1.png') && indexHtml.includes('favicon.ico') && indexHtml.includes('manifest.json'), 'index.html declares apple touch icon, favicon, and manifest');

assert(failedUtils.includes('failed+new') && failedUtils.includes('newTestsCount') && failedUtils.includes('selectionReasons'), 'failed-only runner supports failed+new delta selection reasons');
assert(failedUtils.includes("status === 'timedOut'") && !failedUtils.includes("/timeout/i.test(String(result.error?.message"), 'Playwright status classification uses structured timedOut status only');
assert(collector.includes('assertionTimeoutTests') && collector.includes('perProject') && collector.includes('slowestTests'), 'release collector reports assertion timeouts, per-project totals, and slow tests');
assert(scheduleMutation.includes(".schedule-builder-desktop-table") && scheduleMutation.includes('hidden selector options'), 'Schedule Builder test scopes visibility to the real table');
assert(requestOffSpec.includes('Open People') && requestOffSpec.includes('ghostRequestOffConflictDate') && requestOffSpec.includes('Request Off unavailable'), 'Ghost Mode Request Off test navigates through People and uses seeded conflict date');
assert(!requestOffSpec.includes('test.skip(true, `Could not find selectable Request Off calendar cell'), 'critical Ghost Request Off workflow cannot silently skip missing date cells');
assert(provisioner.includes('GHOST_TARGET') && provisioner.includes('ghost-target-auth.runtime-secret') && provisioner.includes('provisionGhostTargetAuth'), 'temporary Ghost target Auth account is provisioned without reporting password');
assert(seed.includes('applyGhostTargetToLegacyProfile') && seed.includes('ghostRequestOffConflictDate'), 'QA seed exposes legacy Ghost target auth UID and deterministic conflict date');
assert(cleanup.includes('deleteGhostTargetAuthAccount') && cleanup.includes('temporaryAuthAccountsDeleted'), 'QA cleanup deletes temporary Ghost target Auth account');
assert(fs.existsSync(path.join(root, 'tests/86chaos-release-gate/26-pwa-icon-source-deployed-parity.spec.cjs')), 'PWA icon source/deployed parity Playwright test exists');
assert(fs.existsSync(path.join(root, 'tests/86chaos-release-gate/27-pwa-browser-icon-matrix.spec.cjs')), 'cross-browser PWA metadata matrix Playwright test exists');
const inventory = generatePlaywrightInventory({ root, releaseMode: false, allowStaticFallback: true });
assert(inventory.records.some(r => r.project === 'edge-pwa'), 'Playwright inventory includes Edge PWA project identities');
assert(inventory.unresolvedTemplateTitleCount === 0 || inventory.discoveryMode === 'static-fallback-for-source-tests-only', 'release inventory rejects unresolved template titles; source fallback remains diagnostic-only');
assert(inventory.records.some(r => r.specPath.includes('26-pwa-icon-source-deployed-parity')), 'Playwright inventory includes new PWA icon parity test');

assert(fs.existsSync(path.join(root, 'src/core/customerHelpKnowledge.cjs')), 'customer Help knowledge base exists');
assert(fs.existsSync(path.join(root, 'src/core/customerHelpKnowledge.js')), 'customer Help browser knowledge export exists');
assert(fs.existsSync(path.join(root, 'api/help-assistant.js')), 'Ask 86 help assistant API exists');
assert(fs.existsSync(path.join(root, 'public/customer-help-coverage.json')), 'customer help coverage artifact exists');
assert(fs.existsSync(path.join(root, 'public/customer-help-validation.json')), 'customer help validation artifact exists');
assert(fs.existsSync(path.join(root, 'public/ask-86-help-validation.json')), 'Ask 86 validation artifact exists');
assert(fs.existsSync(path.join(root, 'api/playwright-inventory-v3.test.cjs')), 'Playwright inventory schema v3 tests exist');
assert(fs.existsSync(path.join(root, 'api/customer-help-intelligence.test.cjs')), 'customer Help intelligence tests exist');
assert(fs.existsSync(path.join(root, 'api/help-assistant.test.cjs')), 'Ask 86 grounding tests exist');
assert(pkg.scripts['test:play-store:delta'], 'failed+new delta script alias exists');

const pwaPathTest = read('api/pwa-public-url-normalization.test.cjs');
const failureExtractor = read('scripts/86chaos-release-gate/failure-extractor.cjs');
const failureExtractorTest = read('api/release-gate-failure-extractor.test.cjs');
assert(pwaPathTest.includes('path.normalize(actual)') && pwaPathTest.includes("path.join(...parts)"), 'PWA path normalization test compares native filesystem paths semantically');
assert(pwaPathTest.includes('toBrowserAssetUrl') && pwaPathTest.includes("'/86chaos-icon-16-v1.png'"), 'PWA URL tests keep browser URLs slash-based');
assert(failureExtractor.includes('isSuccessfulLine') && failureExtractor.includes('✔') && failureExtractor.includes('PASS'), 'failure extractor recognizes successful test markers before scanning scary words');
assert(failureExtractor.includes('looksLikeNodeTestOutput') && failureExtractor.includes('extractNodeTestFailure'), 'Node test failure extraction uses Node test structure before generic text scanning');
assert(failureExtractorTest.includes('successful lines with scary words are never primary failures'), 'failure extractor regression covers scary words in passing test names');
assert(failureExtractorTest.includes('PWA icon source paths normalize PUBLIC_URL and root-relative forms'), 'failure extractor regression covers the 16.0.144 PWA failure fixture');

if (failures) { console.error(`\n${failures} validation check(s) failed.`); process.exit(1); }
console.log('\n16.0.146 source validation passed.');

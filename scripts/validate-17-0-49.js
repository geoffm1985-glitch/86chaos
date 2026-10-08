#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),version='17.0.49';
const p=json('package.json'),l=json('package-lock.json'),v=json('public/version.json');
assert.equal(p.version,version);assert.equal(l.version,version);assert.equal(l.packages[''].version,version);assert.equal(v.version,version);assert.equal(v.build,version);
assert.equal(p.scripts['test:source'],'node scripts/validate-17-0-49.js');assert.equal(p.scripts['validate:17.0.49'],'node scripts/validate-17-0-49.js');assert.equal(p.scripts['test:repair:17.0.49'],'npm run test:current-release-targeted');
assert.ok(p.scripts['test:current-release-targeted'].includes('api/testing-deployment-identity-file-reader-17-0-49.test.cjs'));assert.ok(p.scripts['test:current-release-targeted'].endsWith('node scripts/validate-17-0-49.js'));
assert.match(read('api/_version.js'),/APP_VERSION = '17\.0\.49'/);assert.match(read('api/_version.js'),/SECURITY_SCHEMA_VERSION = '17\.0\.49'/);assert.match(read('api/_pos-bridge-config.js'),/APP_RELEASE = '17\.0\.49'/);assert.match(read('src/core/appCore.js'),/CURRENT_VERSION = '17\.0\.49'/);
for(const f of ['src/core/customerHelpKnowledge.js','src/core/customerHelpKnowledge.cjs'])assert.match(read(f),/CUSTOMER_HELP_VERSION = '17\.0\.49'/);
for(const f of ['test-tools/certification/groups.json','test-tools/regressions/registry.json','test-tools/certification/cost-performance-baselines.json'])assert.equal(json(f).release,version);
assert.match(read('src/core/schedulePdf.js'),/document\.setProducer\('86 Chaos 17\.0\.49'\)/);
const workflow=read('.github/workflows/testing-targeted-delta.yml');
assert.match(workflow,/Run 17\.0\.49 targeted delta only/);assert.match(workflow,/curl --fail --silent --show-error -o \"\$identity_file\"/);assert.match(workflow,/read-deployment-identity\.cjs commit \"\$identity_file\"/);assert.doesNotMatch(workflow,/JSON\.parse\(process\.argv\[1\]\).*\"\$identity\"/);
assert.ok(read('scripts/86chaos-release-gate/release-test-universe.cjs').includes('63-testing-deployment-identity-file-reader-17-0-49.spec.cjs'));
for(const f of ['RELEASE_17_0_47.md','api/release-gate-portable-delta-baseline-17-0-47.test.cjs','scripts/validate-17-0-47.js','tests/86chaos-release-gate/62-portable-delta-baseline-17-0-47.spec.cjs'])assert.equal(fs.existsSync(path.join(root,f)),false,`unrelated portable 17.0.47 file must not be included: ${f}`);
const manifestUtils=read('scripts/86chaos-release-gate/failed-only-manifest-utils.cjs');assert.doesNotMatch(manifestUtils,/conservative-current-inventory-bootstrap|missing_local_full_baseline_conservative_recovery|conservative-bootstrap/);
console.log('17.0.49 ARG_MAX-safe testing deployment identity validation passed.');

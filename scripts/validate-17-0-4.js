#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));
let failures=0;
const check=(value,message)=>{if(value)console.log(`OK: ${message}`);else{failures+=1;console.error(`FAIL: ${message}`);}};

const pkg=json('package.json'),lock=json('package-lock.json'),version=json('public/version.json');
const groups=json('test-tools/certification/groups.json'),registry=json('test-tools/regressions/registry.json'),baselines=json('test-tools/certification/cost-performance-baselines.json');
check(pkg.version==='17.0.4'&&lock.version==='17.0.4'&&lock.packages[''].version==='17.0.4','package and lock versions are 17.0.4');
check(version.version==='17.0.4'&&version.build==='17.0.4'&&version.releaseTitle==='Release Gate Identity and Immutable Deployment Pinning Repair','public release identity is 17.0.4');
check(read('api/_version.js').includes("APP_VERSION = '17.0.4'")&&read('src/core/appCore.js').includes("CURRENT_VERSION = '17.0.4'")&&read('api/_pos-bridge-config.js').includes("APP_RELEASE = '17.0.4'"),'client, API and POS build identities agree');
for(const name of ['validate:17.0.4','test:release:fast','test:release:firebase','test:hostile','test:release:hostile','test:release:deployed','test:release:recovery','test:release:scale','test:hostile:contracts','test:hostile:mutations','test:schedule-publish','test:pos-bridge:emulator','test:schedule-publish:emulator'])check(Boolean(pkg.scripts[name]),`${name} is wired`);
check(pkg.scripts['test:source']==='node scripts/validate-17-0-4.js','test:source runs the 17.0.4 validator');
check(pkg.scripts['test:hostile:contracts'].includes('api/source-evidence-16-0-228.test.cjs'),'identity regression executes in mandatory hostile contracts');
check(groups.release==='17.0.4'&&Object.values(groups.groups).filter(row=>row.mandatory).length>=8,'mandatory certification manifest is version-bound');
for(const [id,group] of Object.entries(groups.groups))if(group.mandatory&&group.automated!==false){const scriptName=String(group.command||'').replace(/^npm run /,'');check(Boolean(scriptName&&pkg.scripts[scriptName]),`mandatory group ${id} resolves to a command`);}
check(Object.values(groups.groups).some(group=>group.mandatory&&group.automated===false&&group.artifact),'mandatory manual evidence remains explicit and artifact-bound');
check(registry.release==='17.0.4'&&registry.defects.every(row=>row.permanentTestIds?.length&&row.fidelity&&row.mandatoryGroup),'regression registry entries carry permanent evidence');
const identityDefect=registry.defects.find(row=>row.defectId==='RG-CERTIFICATION-IDENTITY-EXECUTION');
check(Boolean(identityDefect&&identityDefect.fixedVersion==='17.0.4'),'17.0.4 certification-identity execution defect is registered');
if(identityDefect){const source=read(`api/${identityDefect.reproducer}`);for(const id of identityDefect.permanentTestIds)check(source.includes(id),`identity permanent test resolves: ${id}`);}
check(baselines.release==='17.0.4'&&baselines.status==='CAPTURE_REQUIRED_ON_EXACT_DEPLOYED_CANDIDATE','uncaptured cost/performance baseline is version-bound and remains non-passing');

const sourceIdentity=read('scripts/86chaos-release-gate/source-identity.cjs');
check(sourceIdentity.includes("['ls-files', '-z']")&&sourceIdentity.includes('86chaos-release-gate-')&&sourceIdentity.includes("public/build-identity.json"),'source identity uses tracked files and excludes generated release artifacts');
check(sourceIdentity.includes('archiveSha256 && !/^[a-f0-9]{64}$/i.test(archiveSha256)'),'archive SHA is validated when supplied but is not a circular deployment prerequisite');
const preflight=read('scripts/86chaos-release-gate/preflight-env.cjs');
check(preflight.includes("configuredCommit||sourceIdentity.commit")&&preflight.includes("configuredManifest||sourceIdentity.sourceHash"),'preflight derives certification commit and manifest from clean local source when not manually duplicated');
check(preflight.includes('resolvedImmutableDeploymentUrl')&&preflight.includes('deploymentIdentityStart'),'preflight persists immutable deployment and start identity evidence for final certification');
check(!preflight.includes('CHAOS_IMMUTABLE_VERCEL_DEPLOYMENT_ID is required for full certification.')&&!preflight.includes('CHAOS_SOURCE_ARCHIVE_SHA256 must identify the delivered source archive.'),'preflight no longer requires impossible deployment/archive echo variables');
const runner=read('RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1');
check(runner.includes('Pinned release-gate deployment:')&&runner.includes('resolvedImmutableDeploymentUrl'),'full gate pins APP_URL and CHAOS_BASE_URL to the immutable deployment after preflight');
const stamp=read('scripts/stamp-build-identity.cjs');
check(stamp.includes("readFirebaseConfig().projectId")&&stamp.includes('sourceManifestHash: identity.sourceHash'),'build stamping records deterministic source and testing Firebase identity');
const endpoint=read('api/build-identity.js');
check(endpoint.includes('VERCEL_GIT_COMMIT_SHA')&&endpoint.includes('VERCEL_GIT_COMMIT_REF')&&endpoint.includes('VERCEL_URL'),'server identity exposes Vercel commit, branch and immutable deployment URL');
const collector=read('scripts/86chaos-release-gate/collect-release-gate-report.cjs');
check(collector.includes('preflight.deploymentIdentityStart')&&collector.includes('Deployment identity could not be verified after deployed testing.'),'postflight still fails closed on deployment drift or missing identity');

if(failures){console.error(`17.0.4 validation failed with ${failures} failure(s).`);process.exit(1);}console.log('17.0.4 source validation passed.');

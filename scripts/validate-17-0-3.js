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
check(pkg.version==='17.0.3'&&lock.version==='17.0.3'&&lock.packages[''].version==='17.0.3','package and lock versions are 17.0.3');
check(version.version==='17.0.3'&&version.build==='17.0.3'&&version.releaseTitle==='Publication Resume, Inventory Integrity, and Certification Identity Repair','public release identity is 17.0.3');
check(read('api/_version.js').includes("APP_VERSION = '17.0.3'")&&read('src/core/appCore.js').includes("CURRENT_VERSION = '17.0.3'")&&read('api/_pos-bridge-config.js').includes("APP_RELEASE = '17.0.3'"),'client, API and POS build identities agree');
for(const name of ['validate:17.0.3','test:release:fast','test:release:firebase','test:hostile','test:release:hostile','test:release:deployed','test:release:recovery','test:release:scale','test:hostile:contracts','test:hostile:mutations','test:schedule-publish','test:pos-bridge:emulator','test:schedule-publish:emulator'])check(Boolean(pkg.scripts[name]),`${name} is wired`);
check(groups.release==='17.0.3'&&Object.values(groups.groups).filter(row=>row.mandatory).length>=8,'mandatory certification manifest is version-bound');
for(const [id,group] of Object.entries(groups.groups))if(group.mandatory&&group.automated!==false){const scriptName=String(group.command||'').replace(/^npm run /,'');check(Boolean(scriptName&&pkg.scripts[scriptName]),`mandatory group ${id} resolves to a command`);}
check(Object.values(groups.groups).some(group=>group.mandatory&&group.automated===false&&group.artifact),'mandatory manual evidence is explicit and artifact-bound');
check(registry.release==='17.0.3'&&registry.defects.every(row=>row.permanentTestIds?.length&&row.fidelity&&row.mandatoryGroup),'regression registry entries carry permanent evidence');
const mutationIds=new Set(require('../test-tools/mutations/critical-mutations.cjs').map(row=>row.id));
for(const defect of registry.defects){
  check(Boolean(groups.groups[defect.mandatoryGroup])||defect.fixedVersion!=='17.0.3',`${defect.defectId} resolves to a mandatory group`);
  if(defect.fixedVersion==='17.0.3'&&defect.mutationId)check(mutationIds.has(defect.mutationId),`${defect.defectId} resolves to a mandatory mutation`);
  if(defect.fixedVersion==='17.0.3'){
    const reproducer=path.join(root,'api',defect.reproducer);check(fs.existsSync(reproducer),`${defect.defectId} reproducer exists`);
    const source=fs.existsSync(reproducer)?fs.readFileSync(reproducer,'utf8'):'';
    for(const id of defect.permanentTestIds)check(source.includes(id),`${defect.defectId} permanent test resolves: ${id}`);
  }
}
check(baselines.release==='17.0.3'&&baselines.status==='CAPTURE_REQUIRED_ON_EXACT_DEPLOYED_CANDIDATE','uncaptured cost/performance baseline is version-bound and remains non-passing');
const trace=read('test-tools/firestore-emulator-trace.cjs');
check(!trace.includes("require('firebase-admin/package.json')")&&trace.includes('read-submit')&&trace.includes('read-overlap'),'trace uses supported metadata and distinguishes SDK submission/overlap');
const service=read('api/_schedule-publish-service.cjs');
check(service.includes('committedShiftEvidence')&&service.includes('publishedCommitEvidence')&&service.includes("status:'recoverable'"),'publication resume, per-shift evidence, and time-off recovery are durable');
const safeWrite=read('api/safe-write.js');
check(safeWrite.includes('waste_item_mismatch')&&safeWrite.includes('operation_mismatch')&&safeWrite.includes('inventory-stock-set'),'inventory and waste invariants use guarded operations');
const releaseChecks=read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
check(releaseChecks.includes('npm run test:server')&&!releaseChecks.includes('npm run test:server --if-present'),'required server suite cannot be optional');
if(failures){console.error(`17.0.3 validation failed with ${failures} failure(s).`);process.exit(1);}console.log('17.0.3 source validation passed.');

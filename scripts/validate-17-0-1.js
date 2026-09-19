#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');const json=file=>JSON.parse(read(file));let failures=0;
const check=(value,message)=>{if(value)console.log(`OK: ${message}`);else{failures+=1;console.error(`FAIL: ${message}`);}};
const pkg=json('package.json'),lock=json('package-lock.json'),version=json('public/version.json'),groups=json('test-tools/certification/groups.json'),registry=json('test-tools/regressions/registry.json'),baselines=json('test-tools/certification/cost-performance-baselines.json');
check(pkg.version==='17.0.1'&&lock.version==='17.0.1'&&lock.packages[''].version==='17.0.1','package and lock versions are 17.0.1');
check(version.version==='17.0.1'&&version.build==='17.0.1'&&version.releaseTitle==='Publication Integrity and Hostile Certification Repair','public release identity is 17.0.1');
check(read('api/_version.js').includes("APP_VERSION = '17.0.1'")&&read('src/core/appCore.js').includes("CURRENT_VERSION = '17.0.1'")&&read('api/_pos-bridge-config.js').includes("APP_RELEASE = '17.0.1'"),'client, API and POS build identities agree');
for(const name of ['validate:17.0.1','test:release:fast','test:release:firebase','test:hostile','test:release:hostile','test:release:deployed','test:release:recovery','test:release:scale','test:hostile:contracts','test:hostile:mutations','test:schedule-publish'])check(Boolean(pkg.scripts[name]),`${name} is wired`);
check(groups.release==='17.0.1'&&Object.values(groups.groups).filter(row=>row.mandatory).length>=7,'mandatory certification manifest is version-bound');
for(const [id,group] of Object.entries(groups.groups))if(group.mandatory&&group.automated!==false){const scriptName=String(group.command||'').replace(/^npm run /,'');check(Boolean(scriptName&&pkg.scripts[scriptName]),`mandatory group ${id} resolves to a command`);}
check(registry.release==='17.0.1'&&registry.defects.every(row=>row.permanentTestIds?.length&&row.fidelity&&row.mandatoryGroup),'regression registry entries carry permanent evidence');
const mutationIds=new Set(require('../test-tools/mutations/critical-mutations.cjs').map(row=>row.id));
for(const defect of registry.defects.filter(row=>row.fixedVersion==='17.0.1')){check(Boolean(groups.groups[defect.mandatoryGroup]),`${defect.defectId} resolves to a mandatory group`);check(mutationIds.has(defect.mutationId),`${defect.defectId} resolves to a mandatory mutation`);check(fs.existsSync(path.join(root,'api',defect.reproducer)),`${defect.defectId} reproducer exists`);}
check(baselines.status!=='PASS','uncaptured cost/performance baselines are never represented as passing');
for(const file of ['api/safe-write.js','api/_chaos-admin.js','api/_schedule-publish-core.cjs','api/_schedule-publish-service.cjs','api/send-schedule-alert.js','api/_daily-close-service.cjs','api/daily-close.js','test-tools/contracts/api-contract-analyzer.cjs'])check(fs.existsSync(path.join(root,file)),`${file} exists`);
const safe=read('api/safe-write.js');check(safe.includes('GENERIC_COLLECTION_CONTRACTS')&&safe.includes('DENIED_COLLECTIONS')&&safe.includes('executeGenericMutation'),'safe-write is allowlisted and transactional');
const publish=read('api/_schedule-publish-service.cjs');for(const term of ['roleConfigurationGeneration','assertFenceState','processTimeOff','notificationState','remainingShiftIds'])check(publish.includes(term),`publication service contains ${term}`);
check(read('api/send-schedule-alert.js').includes('410'),'legacy schedule broadcast bypass is closed');
check(read('api/_pos-bridge-boundaries.js').includes('schedulePublishOperations')&&read('api/_pos-bridge-boundaries.js').includes('schedulePublishLeases'),'ordinary restore protects publication roots');
check(!/collection\(['"](?:inventoryItems|sales|timePunches|payroll|recipes|vendors)['"]\)/.test(read('api/_pos-bridge-events.js')),'POS Bridge remains staging-only');
if(failures){console.error(`17.0.1 validation failed with ${failures} failure(s).`);process.exit(1);}console.log('17.0.1 source validation passed.');

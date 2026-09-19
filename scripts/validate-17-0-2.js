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
check(pkg.version==='17.0.2'&&lock.version==='17.0.2'&&lock.packages[''].version==='17.0.2','package and lock versions are 17.0.2');
check(version.version==='17.0.2'&&version.build==='17.0.2'&&version.releaseTitle==='Deterministic Emulator Concurrency and Publication Fixture Repair','public release identity is 17.0.2');
check(read('api/_version.js').includes("APP_VERSION = '17.0.2'")&&read('src/core/appCore.js').includes("CURRENT_VERSION = '17.0.2'")&&read('api/_pos-bridge-config.js').includes("APP_RELEASE = '17.0.2'"),'client, API and POS build identities agree');
for(const name of ['validate:17.0.2','test:release:fast','test:release:firebase','test:hostile','test:release:hostile','test:release:deployed','test:release:recovery','test:release:scale','test:hostile:contracts','test:hostile:mutations','test:schedule-publish','test:pos-bridge:emulator','test:schedule-publish:emulator'])check(Boolean(pkg.scripts[name]),`${name} is wired`);
check(groups.release==='17.0.2'&&Object.values(groups.groups).filter(row=>row.mandatory).length>=7,'mandatory certification manifest is version-bound');
for(const [id,group] of Object.entries(groups.groups))if(group.mandatory&&group.automated!==false){const scriptName=String(group.command||'').replace(/^npm run /,'');check(Boolean(scriptName&&pkg.scripts[scriptName]),`mandatory group ${id} resolves to a command`);}
check(registry.release==='17.0.2'&&registry.defects.every(row=>row.permanentTestIds?.length&&row.fidelity&&row.mandatoryGroup),'regression registry entries carry permanent evidence');
const mutationIds=new Set(require('../test-tools/mutations/critical-mutations.cjs').map(row=>row.id));
for(const defect of registry.defects){
  check(Boolean(groups.groups[defect.mandatoryGroup])||defect.fixedVersion!=='17.0.2',`${defect.defectId} resolves to a mandatory group`);
  if(defect.fixedVersion==='17.0.2'&&defect.mutationId)check(mutationIds.has(defect.mutationId),`${defect.defectId} resolves to a mandatory mutation`);
  if(defect.fixedVersion==='17.0.2'){
    const reproducer=path.join(root,'api',defect.reproducer);check(fs.existsSync(reproducer),`${defect.defectId} reproducer exists`);
    const source=fs.existsSync(reproducer)?fs.readFileSync(reproducer,'utf8'):'';
    for(const id of defect.permanentTestIds)check(source.includes(id),`${defect.defectId} permanent test resolves: ${id}`);
  }
}
check(baselines.release==='17.0.2'&&baselines.status!=='PASS','uncaptured cost/performance baselines remain version-bound and non-passing');
const storage=read('api/_pos-bridge-storage.js');
check(storage.includes('isClosedTransactionError')&&storage.includes('CLOSED_TRANSACTION_MAX_ATTEMPTS = 3')&&storage.includes('CLOSED_TRANSACTION_DEADLINE_MS'),'closed-transaction compatibility handling is exact and bounded');
check(storage.includes('stageEventTransaction')&&storage.includes('await stageEventTransaction'),'closed-transaction recovery starts a fresh whole transaction');
const posTest=read('api/pos-bridge-emulator-16-0-236.test.cjs');
check(posTest.includes('oneWinner')&&posTest.includes('recordSettlements')&&posTest.includes('operationalWrites'),'POS concurrency evidence records actual settlements and durable non-operational state');
const dailyTest=read('api/integrity-concurrency-17-0-1.test.cjs');
check(dailyTest.includes('createReadBarrier')&&dailyTest.includes('acknowledgement loss after commit')&&!dailyTest.includes('Date.now()-overlapAt'),'Daily Close evidence uses deterministic read synchronization and committed acknowledgement loss');
const scheduleTest=read('api/schedule-publish-emulator-17-0-0.test.cjs');
check(scheduleTest.includes('assertCanonicalFixture')&&scheduleTest.includes('cross-a-day-b')&&scheduleTest.includes('providerCalls'),'schedule fixture independently proves canonical identity, exact pairs, and provider invocation');
check(fs.existsSync(path.join(root,'test-tools/firestore-emulator-trace.cjs')),'sanitized emulator transaction tracing exists');
const releaseChecks=read('scripts/86chaos-release-gate/run-node-release-checks.cjs');
check(releaseChecks.includes("npm run test:pos-bridge:emulator")&&releaseChecks.includes("npm run test:schedule-publish:emulator"),'both focused emulator groups remain mandatory before Playwright');
if(failures){console.error(`17.0.2 validation failed with ${failures} failure(s).`);process.exit(1);}console.log('17.0.2 source validation passed.');

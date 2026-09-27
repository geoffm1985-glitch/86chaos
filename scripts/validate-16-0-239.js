#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));
const exists=file=>fs.existsSync(path.join(root,file));
let failures=0;
const assert=(condition,message)=>condition?console.log(`OK: ${message}`):(failures+=1,console.error(`FAIL: ${message}`));

const inherited=cp.spawnSync(process.execPath,['scripts/validate-16-0-233.js'],{
  cwd:root,encoding:'utf8',
  env:{...process.env,CHAOS_VALIDATION_VERSION:'16.0.239',CHAOS_VALIDATION_RELEASE_TITLE:'Testing Alias Validator Repair',CHAOS_VALIDATION_SCRIPT:'scripts/validate-16-0-239.js'}
});
if(inherited.stdout)process.stdout.write(inherited.stdout);
if(inherited.stderr)process.stderr.write(inherited.stderr);
assert(inherited.status===0,'all inherited Schedule Tools, maturity, security, UI and release-evidence invariants pass');

const pkg=json('package.json');
const lock=json('package-lock.json');
const version=json('public/version.json');
assert(pkg.version==='16.0.239'&&lock.version==='16.0.239'&&lock.packages?.['']?.version==='16.0.239','package and lock versions are 16.0.239');
assert(version.version==='16.0.239'&&version.build==='16.0.239'&&version.releaseTitle==='Testing Alias Validator Repair','public version metadata identifies the validator repair');
assert(read('api/_version.js').includes("APP_VERSION = '16.0.239'")&&read('api/_version.js').includes("SECURITY_SCHEMA_VERSION = '16.0.239'"),'API reports 16.0.239');
assert(read('src/core/appCore.js').includes("CURRENT_VERSION = '16.0.239'"),'active client reports 16.0.239');
assert(read('src/core/customerHelpKnowledge.js').includes("CUSTOMER_HELP_VERSION = '16.0.239'")&&read('src/core/customerHelpKnowledge.cjs').includes("CUSTOMER_HELP_VERSION = '16.0.239'"),'customer Help version mirrors remain synchronized');
assert(pkg.scripts['test:source']==='node scripts/validate-16-0-239.js'&&pkg.scripts['validate:16.0.239']==='node scripts/validate-16-0-239.js','16.0.239 validator is wired');
assert(pkg.scripts['test:new-implementations']?.startsWith('npm run validate:16.0.239'),'new-implementation command uses the 16.0.239 validator');

const targets=require('./86chaos-release-gate/vercel-targets.cjs');
const safety=require('./86chaos-release-gate/mutation-safety.cjs');
const qaEnv={CHAOS_ALLOW_MUTATION:'true',CHAOS_RELEASE_GATE_RUN_ID:'validator-16-0-239',SYSTEM_ADMIN_EMAIL:'86chaos.qa.system-admin.20260729-1302@example.test',OWNER_EMAIL:'86chaos.qa.owner.20260729-1302@example.test',MANAGER_EMAIL:'86chaos.qa.manager.20260729-1302@example.test',STAFF_EMAIL:'86chaos.qa.staff.20260729-1302@example.test'};
for(const host of ['testing.86chaos.com','experimental.86chaos.com']){
  const target=targets.validateReleaseTarget({appUrl:`https://${host}`,expectedProjectSlug:'86chaos',expectedVersion:'16.0.239',sourceVersion:'16.0.239',deployedVersion:'16.0.239'});
  assert(target.ok,`${host} is accepted as an explicit non-production release-gate alias`);
  const mutation=safety.assertMutationSafety({env:{...qaEnv,APP_URL:`https://${host}`},projectId:'chaos-test-d1601',credentialProjectId:'chaos-test-d1601',runId:qaEnv.CHAOS_RELEASE_GATE_RUN_ID,adminCredentialPresent:true});
  assert(mutation.ok,`${host} remains mutation-safe only with testing Firebase identity and QA accounts`);
}
for(const host of ['app.86chaos.com','86chaos.com','www.86chaos.com','staging.86chaos.com']){
  const target=targets.validateReleaseTarget({appUrl:`https://${host}`,expectedVersion:'16.0.239',sourceVersion:'16.0.239',deployedVersion:'16.0.239'});
  assert(!target.ok,`${host} remains blocked from mutating release-gate testing`);
  assert(safety.isProductionHost(host),`${host} remains production-classified/fail-closed`);
}
assert(exists('tests/86chaos-release-gate/39-testing-alias-mutation-safety.spec.cjs'),'testing alias Play Store regression spec exists');
assert(read('scripts/86chaos-release-gate/release-test-universe.cjs').includes('tests/86chaos-release-gate/39-testing-alias-mutation-safety.spec.cjs'),'testing alias Play Store regression is release-critical');

const protectedPatterns=[
  /^api\/_shift4-/,
  /^api\/shift4-/,
  /^src\/components\/Shift4IntegrationPanel\.jsx$/,
  /^src\/core\/schedulePrintModel\.js$/,
  /^docs\/16\.0\.234-implementation-test-matrix\.json$/,
  /^firestore\.rules$/,
  /^firestore\.indexes\.json$/,
  /^storage\.rules$/,
  /^database\.rules\.json$/,
  /^firebase\.json$/,
  /^public\/firebase-messaging-sw\.js$/,
  /^vercel\.json$/
];
const diff=cp.spawnSync('git',['diff','--name-only','HEAD^','HEAD'],{cwd:root,encoding:'utf8'});
assert(diff.status===0,'Git diff evidence is available for the 16.0.239 repair');
const changed=String(diff.stdout||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
const protectedChanges=changed.filter(file=>protectedPatterns.some(re=>re.test(file)));
assert(protectedChanges.length===0,`validator repair leaves protected Shift4/PDF/Firebase/Vercel areas untouched${protectedChanges.length?': '+protectedChanges.join(', '):''}`);

if(failures){console.error(`16.0.239 source validation failed with ${failures} failure(s).`);process.exit(1);}
console.log('16.0.239 source validation passed.');

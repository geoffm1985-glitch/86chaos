const { test, expect } = require('@playwright/test');
const { validateReleaseTarget } = require('../../scripts/86chaos-release-gate/vercel-targets.cjs');
const { assertMutationSafety, isProductionHost, parseHost } = require('../../scripts/86chaos-release-gate/mutation-safety.cjs');
const qaEnv = { CHAOS_ALLOW_MUTATION:'true', CHAOS_RELEASE_GATE_RUN_ID:'play-store-alias-safety', SYSTEM_ADMIN_EMAIL:'86chaos.qa.system-admin.20260729-1302@example.test', OWNER_EMAIL:'86chaos.qa.owner.20260729-1302@example.test', MANAGER_EMAIL:'86chaos.qa.manager.20260729-1302@example.test', STAFF_EMAIL:'86chaos.qa.staff.20260729-1302@example.test' };
test.describe('39 testing alias mutation safety',()=>{
  test('testing aliases are allowed without weakening production-host protection', async ({},testInfo)=>{
    const evidence=[];
    for(const host of ['testing.86chaos.com','experimental.86chaos.com']){
      const target=validateReleaseTarget({appUrl:`https://${host}`,expectedProjectSlug:'86chaos',expectedVersion:'16.0.238',sourceVersion:'16.0.238',deployedVersion:'16.0.238'});
      const mutation=assertMutationSafety({env:{...qaEnv,APP_URL:`https://${host}`},projectId:'chaos-test-d1601',credentialProjectId:'chaos-test-d1601',runId:qaEnv.CHAOS_RELEASE_GATE_RUN_ID,adminCredentialPresent:true});
      evidence.push({host,targetOk:target.ok,mutationOk:mutation.ok,targetErrors:target.errors,mutationErrors:mutation.errors});
      expect(target.ok).toBe(true); expect(mutation.ok).toBe(true); expect(isProductionHost(parseHost(`https://${host}`))).toBe(false);
    }
    for(const host of ['app.86chaos.com','86chaos.com','www.86chaos.com','staging.86chaos.com']){
      const target=validateReleaseTarget({appUrl:`https://${host}`,expectedVersion:'16.0.238',sourceVersion:'16.0.238',deployedVersion:'16.0.238'});
      evidence.push({host,targetOk:target.ok,targetErrors:target.errors}); expect(target.ok).toBe(false); expect(isProductionHost(parseHost(`https://${host}`))).toBe(true);
    }
    await testInfo.attach('39-testing-alias-mutation-safety.json',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
  });
});

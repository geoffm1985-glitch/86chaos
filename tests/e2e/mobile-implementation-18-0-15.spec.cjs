'use strict';
const {test,expect}=require('@playwright/test');
const pkg=require('../../package.json');
test('local release client and API identity stay bound to the same sealed mobile source',async({request,baseURL})=>{
  expect(new URL(baseURL).hostname).toBe('127.0.0.1');
  const [clientResponse,serverResponse,targetResponse]=await Promise.all([request.get('/build-identity.json'),request.get('/api/build-identity'),request.get('/api/firebase-target')]);
  expect(clientResponse.status()).toBe(200);expect(serverResponse.status()).toBe(200);expect(targetResponse.status()).toBe(200);
  const client=await clientResponse.json(),server=await serverResponse.json(),target=await targetResponse.json();
  expect(client.version).toBe(pkg.version);expect(server.version).toBe(pkg.version);expect(server.gitCommit).toBe(client.commit);expect(server.sourceManifestHash).toBe(client.sourceManifestHash);expect(client.localRuntimePinned).toBe(true);expect(server.localRuntimePinned).toBe(true);
  expect(target).toMatchObject({target:'emulator',projectId:'demo-86chaos',blockLiveFirebase:true});
});
test('new employee and training actions reject anonymous acknowledgment and competency writes',async({request,baseURL})=>{
  expect(new URL(baseURL).hostname).toBe('127.0.0.1');
  for(const action of ['shift-change-list','shift-change-acknowledge','training-competency-list','training-competency-review','training-competency-revoke']){
    const response=await request.post('/api/safe-write',{data:{restaurantId:'qa_unauthorized_probe',action,confirmed:true}});
    expect(response.status(),action).toBe(401);expect((await response.json()).ok).toBe(false);
  }
});

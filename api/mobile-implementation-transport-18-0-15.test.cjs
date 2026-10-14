const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(response={status:200,data:{ok:true},headers:{'content-type':'application/json'}}){
  const source=fs.readFileSync(require.resolve('../src/core/appCore.js'),'utf8');
  const start=source.indexOf('export const NATIVE_API_BASE_URL =');
  const end=source.indexOf('export const installNativeApiFetchBridge',start);
  const calls=[],fallback=[];
  const context={env:(key,value)=>value,window:{location:{origin:'https://app.86chaos.com'},fetch:async(...args)=>{fallback.push(args);return 'browser';}},URL,URLSearchParams,Request,Response,Headers,FormData,
    isNativeMobileRuntime:()=>true,blobToBase64:async blob=>Buffer.from(await blob.arrayBuffer()).toString('base64'),CapacitorHttp:{request:async options=>{calls.push(options);return response;}}};
  const fetch=vm.runInNewContext(source.slice(start,end).replace(/export /g,'')+'\nnativeApiFetch;',context);
  return {fetch,calls,fallback};
}

test('new native operational workflows reach the matching mobile backend with bearer/App Check credentials intact',async()=>{
  const contract=JSON.parse(fs.readFileSync(require.resolve('../mobile/native-platform-contract.json'),'utf8'));
  for(const path of contract.nativeApiBridge.updatedRoutes.paths){
    const f=fixture();await f.fetch(path+'?restaurantId=workspace',{method:'POST',headers:{Authorization:'Bearer identity-token','X-Firebase-AppCheck':'appcheck-token','Content-Type':'application/json'},body:'{"restaurantId":"workspace"}'});
    assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,contract.nativeApiBridge.updatedRoutes.backendBaseUrl+path+'?restaurantId=workspace');
    assert.equal(f.calls[0].headers.authorization,'Bearer identity-token');assert.equal(f.calls[0].headers['x-firebase-appcheck'],'appcheck-token');
    assert.equal(JSON.parse(f.calls[0].data).restaurantId,'workspace');
  }
});
test('lookalike paths and external origins cannot select the privileged mobile backend',async()=>{
 const f=fixture();await f.fetch('/api/shift4-sync-lookalike');assert.equal(f.calls[0].url,'https://app.86chaos.com/api/shift4-sync-lookalike');
 assert.equal(await f.fetch('https://unrelated.example/api/shift4-sync'),'browser');assert.equal(f.calls.length,1);
});

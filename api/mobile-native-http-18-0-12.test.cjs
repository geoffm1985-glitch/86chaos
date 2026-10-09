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
test('mobile server actions use the matching branch backend and retain auth; other APIs use production',async()=>{
  const f=fixture();
  for(const path of ['/api/demand-history?restaurantId=r1','/api/operational-history','/api/safe-write','/api/free-ai-services']){
    const response=await f.fetch(path,{method:'POST',headers:{Authorization:'Bearer identity-token','Content-Type':'application/json'},body:'{"restaurantId":"r1"}'});
    assert.equal((await response.json()).ok,true);
    assert.match(f.calls.at(-1).url,/^https:\/\/86chaos-git-mobile-/);
    assert.equal(f.calls.at(-1).headers.authorization,'Bearer identity-token');
  }
  await f.fetch('/api/voice-command');assert.equal(f.calls.at(-1).url,'https://app.86chaos.com/api/voice-command');
  await f.fetch('/api/safe-write-lookalike');assert.equal(f.calls.at(-1).url,'https://app.86chaos.com/api/safe-write-lookalike');
});
test('native multipart uploads preserve duplicate text fields and exact binary file bytes with a native boundary',async()=>{
  const f=fixture(),form=new FormData(),bytes=Buffer.from([0,255,13,10,128]);
  form.append('label','one');form.append('label','two');form.append('document',new Blob([bytes],{type:'application/pdf'}),'invoice.pdf');
  await f.fetch('/api/scan-invoice',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=wrong-browser-boundary'},body:form});
  const call=f.calls[0];assert.equal(call.dataType,'formData');assert.equal(call.headers['Content-Type'],'multipart/form-data');
  assert.equal(call.data[0].value,'one');assert.equal(call.data[1].value,'two');
  const file=call.data[2];assert.equal(file.fileName,'invoice.pdf');assert.equal(file.contentType,'application/pdf');assert.deepEqual(Buffer.from(file.value,'base64'),bytes);
});
test('external URLs and packaged files keep browser transport; empty success returns a valid Response',async()=>{
  const f=fixture({status:204,data:'',headers:{}});
  assert.equal((await f.fetch('/api/push-token-repair',{method:'POST'})).status,204);
  for(const url of ['https://firebasestorage.googleapis.com/v0/file','/static/font.woff','blob:https://app.86chaos.com/file'])assert.equal(await f.fetch(url),'browser');
  assert.equal(f.calls.length,1);assert.equal(f.fallback.length,3);
});

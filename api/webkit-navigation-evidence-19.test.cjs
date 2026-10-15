'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http');
const {KNOWN_ENGINE,classifyNavigationError,listenIdentity,safeRuntimeError,observeSchedulingRuntime}=require('../tests/fixtures/webkit-navigation-evidence.cjs');
const url='https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fdemo-86chaos%2Fdatabases%2F(default)&SID=private-session';
const first=`XMLHttpRequest cannot load ${url} due to access control checks.`;
const native={name:first.slice(0,first.indexOf(':')),message:first.slice(first.indexOf(':')+2),stack:first+'\n    at unknown (https://fixture.local/app.js:1:2)'};
const evidence={...KNOWN_ENGINE,project:'demo-86chaos',explicitReload:true,mainFrameNavigation:true,successfulListen:true,applicationErrorEvent:false,elapsedMs:250};
test('classification requires exact reproduced engine, explicit main-frame reload and successful same-project read',()=>{
 assert.equal(classifyNavigationError(native,evidence)?.classification,'known-windows-webkit-navigation-cancellation');
 for(const patch of [{platform:'linux'},{playwrightVersion:'other'},{browserName:'chromium'},{browserVersion:'other'},{project:'cheers-34b8d'},{explicitReload:false},{mainFrameNavigation:false},{mainFrameCommitted:true},{successfulListen:false},{applicationErrorEvent:true},{elapsedMs:-1},{elapsedMs:2501}])assert.equal(classifyNavigationError(native,{...evidence,...patch}),null);
});
test('ordinary thrown lookalikes, unknown runtime errors, API writes and foreign endpoints remain fatal',()=>{
 assert.equal(classifyNavigationError(new Error(first),evidence),null);
 assert.equal(classifyNavigationError(new TypeError('application failure'),evidence),null);
 for(const value of [url.replace('demo-86chaos','cheers-34b8d'),url.replace('Listen','Write'),url.replace('firestore.googleapis.com','evil.example'),url.replace('https:','http:'),'https://testing.86chaos.com/api/schedule-workspace'])assert.equal(listenIdentity(value,'demo-86chaos'),false);
 assert.equal(classifyNavigationError({...native,stack:'Error: '+first},evidence),null);
});
test('classified and fatal evidence excludes session queries and credentials',()=>{
 const classified=JSON.stringify(classifyNavigationError(native,evidence));assert(!classified.includes('SID'));assert(!classified.includes('private-session'));
 const safe=safeRuntimeError({message:native.message+' Bearer secret-header eyJabc.def.ghi'});assert(!safe.includes('private-session'));assert(!safe.includes('secret-header'));assert(!safe.includes('eyJabc'));
});
test('real Windows WebKit navigation cancellation is separated but genuine application errors remain fatal',async()=>{
 const {webkit}=require('@playwright/test');let browser,release,signal,armed=false;
 const requested=new Promise(done=>signal=done);
 const server=http.createServer((req,res)=>{req.resume();const send=()=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Navigation contract fixture</title>');};if(armed){release=send;signal();}else send();});
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
  browser=await webkit.launch({headless:true});const context=await browser.newContext(),page=await context.newPage();
  const runtime=await observeSchedulingRuntime(page,{project:'demo-86chaos'});
  await page.route('https://firestore.googleapis.com/**',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, GET, OPTIONS','access-control-allow-headers':'content-type','content-type':'application/json'},body:'{}'}));
  await page.goto(base+'/initial');const handle=await page.evaluateHandle(url=>({send:()=>new Promise(resolve=>{const xhr=new XMLHttpRequest();xhr.addEventListener('loadend',()=>resolve(xhr.status),{once:true});xhr.open('POST',url);xhr.send('{}');})}),url);
  assert.equal(await handle.evaluate(o=>o.send()),200);
  armed=true;const reload=runtime.reload();await requested;let cancelled;
  try{cancelled=await handle.evaluate(o=>o.send());}finally{release();release=null;armed=false;}
  await reload;const report=await runtime.finish();assert.equal(cancelled,0);assert.deepEqual(report.fatalErrors,[]);assert.equal(report.classifiedEvents.length,1);assert.equal(report.applicationErrorEvents,0);
  await context.close();
  const next=await browser.newContext(),app=await next.newPage(),appRuntime=await observeSchedulingRuntime(app,{project:'demo-86chaos'});await app.goto(base+'/initial');
  const thrown=app.waitForEvent('pageerror');await app.evaluate(()=>{setTimeout(()=>{throw new Error('XMLHttpRequest cannot load https://firestore.googleapis.com/ due to access control checks.');},0);});await thrown;
  const appReport=await appRuntime.finish();assert.equal(appReport.classifiedEvents.length,0);assert.equal(appReport.fatalErrors.length,1);assert.equal(appReport.applicationErrorEvents,1);await next.close();
 }finally{release?.();await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
});

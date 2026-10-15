"use strict";
const crypto=require('node:crypto');
const {expectedFirebaseProject}=require('../../scripts/86chaos-firebase-target.cjs');
const {version:playwrightVersion}=require('@playwright/test/package.json');
const navigationEvidence=new WeakMap();
const KNOWN_ENGINE={platform:'win32',playwrightVersion:'1.62.0',browserName:'webkit',browserVersion:'26.5'};
function listenIdentity(value,project) {
  try{const url=new URL(value);return url.protocol==='https:' && url.hostname==='firestore.googleapis.com' && !url.port && !url.username && !url.password && url.pathname==='/google.firestore.v1.Firestore/Listen/channel' && url.searchParams.get('database')===`projects/${project}/databases/(default)`;}catch{return false;}
}
function engineMessage(error) {
  // Windows WebKit serializes native console errors with the first colon as name.
  // A JavaScript Error with the same message retains name Error and is never classified.
  if(!['XMLHttpRequest cannot load https','XMLHttpRequest cannot load http'].includes(error?.name))return null;
  const first=String(error.stack || '').split('\n')[0];
  const match=/^XMLHttpRequest cannot load (https:\/\/\S+) due to access control checks\.$/.exec(first);
  if(!match)return null;
  const colon=first.indexOf(':');
  if(first.slice(0,colon)!==error.name || first.slice(colon+2)!==error.message)return null;
  return match[1];
}
function classifyNavigationError(error,evidence={}) {
  if(Object.entries(KNOWN_ENGINE).some(([key,value])=>evidence[key]!==value))return null;
  if(!['chaos-test-d1601','demo-86chaos','demo-86chaos-scheduling'].includes(evidence.project))return null;
  if(!evidence.explicitReload || !evidence.mainFrameNavigation || evidence.mainFrameCommitted || !evidence.successfulListen || evidence.applicationErrorEvent || evidence.elapsedMs<0 || evidence.elapsedMs>2500)return null;
  const url=engineMessage(error);if(!url || !listenIdentity(url,evidence.project))return null;
  return {classification:'known-windows-webkit-navigation-cancellation',project:evidence.project,transport:'XMLHttpRequest',endpoint:'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',elapsedMs:Math.round(evidence.elapsedMs),engine:KNOWN_ENGINE,upstream:'https://github.com/microsoft/playwright/issues/43120',physicalSafariAcceptance:'pending'};
}
function safeRuntimeError(error) {
  return String(error?.message || error).replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[redacted token]').replace(/(?:https?:)?\/\/[^\s"']+|\/?firestore\.googleapis\.com[^\s"']+/g,'[redacted transport URL]').slice(0,1200);
}
async function observeSchedulingRuntime(page,{project=expectedFirebaseProject(process.env)}={}) {
  if(navigationEvidence.has(page))return navigationEvidence.get(page);
  const browser=page.context().browser();
  const facts={platform:process.platform,playwrightVersion,browserName:browser?.browserType().name(),browserVersion:browser?.version(),project};
  const errors=[],candidates=[],appEvents=[];let navigation=null,successfulListen=false;
  const binding='__chaosQaApplicationErrorEvidence_'+crypto.randomBytes(5).toString('hex');
  await page.exposeBinding(binding,()=>{appEvents.push(Date.now());});
  await page.addInitScript(name=>{window.addEventListener('error',event=>{if(event.error)window[name]().catch(()=>{});});},binding);
  const onResponse=response=>{if(response.status()===200 && response.request().resourceType()==='xhr' && listenIdentity(response.url(),project))successfulListen=true;};
  const onRequest=request=>{if(navigation && request.isNavigationRequest() && request.frame()===page.mainFrame() && new URL(request.url()).origin===navigation.origin)navigation.mainFrameNavigation=true;};
  const onCommitted=frame=>{if(navigation && frame===page.mainFrame())navigation.mainFrameCommitted=true;};
  const onError=error=>{
    const now=Date.now(),evidence={...facts,explicitReload:Boolean(navigation),mainFrameNavigation:Boolean(navigation?.mainFrameNavigation),mainFrameCommitted:Boolean(navigation?.mainFrameCommitted),successfulListen,elapsedMs:navigation?now-navigation.started:-1,applicationErrorEvent:false};
    const classified=classifyNavigationError(error,evidence);
    if(classified)candidates.push({error,classified,started:navigation.started,ended:now});else errors.push(safeRuntimeError(error));
  };
  page.on('response',onResponse);page.on('request',onRequest);page.on('framenavigated',onCommitted);page.on('pageerror',onError);
  const observer={
    async reload(){if(navigation)throw Error('Navigation evidence is already active');navigation={started:Date.now(),origin:new URL(page.url()).origin,mainFrameNavigation:false,mainFrameCommitted:false};try{return await page.reload();}finally{navigation=null;}},
    async finish(testInfo){
      // A real application ErrorEvent makes the exception ineligible, even if a
      // lookalike pageerror races the binding delivery during navigation.
      const classified=[];
      for(const item of candidates){if(appEvents.some(time=>time>=item.started && time<=item.ended+1000))errors.push(safeRuntimeError(item.error));else classified.push(item.classified);}
      await testInfo?.attach?.('webkit-navigation-engine-evidence',{body:JSON.stringify({scope:'explicit scheduling reload only',classifiedEvents:classified,applicationErrorEvents:appEvents.length,fatalErrorCount:errors.length,realDeviceAcceptance:'pending'}),contentType:'application/json'});
      page.off('response',onResponse);page.off('request',onRequest);page.off('framenavigated',onCommitted);page.off('pageerror',onError);return {fatalErrors:errors,classifiedEvents:classified,applicationErrorEvents:appEvents.length};
    },
  };
  navigationEvidence.set(page,observer);return observer;
}
module.exports={KNOWN_ENGINE,listenIdentity,classifyNavigationError,safeRuntimeError,observeSchedulingRuntime};

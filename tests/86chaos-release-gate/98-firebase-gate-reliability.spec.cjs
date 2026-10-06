'use strict';
const {test,expect}=require('@playwright/test');
const {login,watchForProblems}=require('../86chaos-full-audit/utils/audit-helpers.cjs');
async function installLoginFixture(page,mode) {
  let documents=0;
  await page.route('**/*',route=>{
    if(!route.request().isNavigationRequest())return route.fulfill({status:200,body:''});
    documents++;
    const error=mode==='invalid'?'auth/invalid-credential':mode==='persistent'||documents===1?'auth/the-service-is-currently-unavailable':'';
    const action=error?'document.getElementById("error").textContent="Firebase: Error ('+error+')."':'document.body.innerHTML="<main>Today Ready</main>"';
    return route.fulfill({contentType:'text/html',body:'<div class="chaos-login-screen"><label>Email Address<input aria-label="Email Address"></label><label>Password<input type="password" aria-label="Password" autocomplete="current-password"></label><button onclick=\'sessionStorage.submits=String(Number(sessionStorage.submits||0)+1);'+action+'\'>Unlock System</button><div id="error"></div></div>'});
  });
  return {documents:()=>documents,submits:()=>page.evaluate(()=>Number(sessionStorage.submits||0))};
}
test.describe('Firebase release-gate recovery boundaries',()=>{
  test('temporary Firebase Auth failure retries once on a fresh login document',async({page})=>{
    const fixture=await installLoginFixture(page,'transient');
    const recoveries=[];
    expect(await login(page,'fixture@example.test','fixture-only-password',{onAuthRecovery:row=>recoveries.push(row)})).toContain('Today Ready');
    expect(fixture.documents()).toBe(2);expect(await fixture.submits()).toBe(2);expect(recoveries).toHaveLength(1);
  });
  test('persistent Firebase Auth service failure remains blocking after one retry',async({page})=>{
    const fixture=await installLoginFixture(page,'persistent');
    await expect(login(page,'fixture@example.test','fixture-only-password')).rejects.toThrow(/Login did not leave the login screen/);
    expect(fixture.documents()).toBe(2);expect(await fixture.submits()).toBe(2);
  });
  test('invalid credentials never trigger a transient Auth retry',async({page})=>{
    const fixture=await installLoginFixture(page,'invalid');
    await expect(login(page,'fixture@example.test','fixture-only-password')).rejects.toThrow(/auth\/invalid-credential/);
    expect(fixture.documents()).toBe(1);expect(await fixture.submits()).toBe(1);
  });
  const listen='https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fchaos-test-d1601%2Fdatabases%2F(default)&RID=1';
  test('a closed Firestore Listen stream requires a successful reconnect',async({page})=>{
    let requests=0;
    await page.route('https://firestore.googleapis.com/**',route=>++requests===1?route.abort('connectionclosed'):route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'text/plain',body:'[]'}));
    const problems=[],watcher=watchForProblems(page,problems,{recoverFirestoreListen:true});
    await page.setContent('<main>Ready</main>');
    await page.evaluate(url=>fetch(url).catch(()=>null),listen);
    expect(problems.some(row=>row.type==='requestfailed')).toBe(true);
    await page.evaluate(url=>fetch(url).then(response=>response.text()),listen.replace('RID=1','RID=2'));
    await watcher.waitForTransportRecovery(2000);
    expect(problems).toEqual([]);expect(watcher.recoveredTransports).toHaveLength(1);
  });
  test('an unrecovered Firestore Listen stream remains a route-health failure',async({page})=>{
    await page.route('https://firestore.googleapis.com/**',route=>route.abort('connectionclosed'));
    const problems=[],watcher=watchForProblems(page,problems,{recoverFirestoreListen:true});
    await page.setContent('<main>Ready</main>');await page.evaluate(url=>fetch(url).catch(()=>null),listen);
    await watcher.waitForTransportRecovery(250);
    expect(problems.some(row=>row.type==='requestfailed'&&row.failure==='net::ERR_CONNECTION_CLOSED')).toBe(true);expect(watcher.recoveredTransports).toEqual([]);
  });
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {submitAuditLogin,firestoreListenKey,createFirestoreListenRecovery}=require('../tests/86chaos-full-audit/utils/firebase-transport-recovery.cjs');
const root=path.resolve(__dirname,'..');
const listen='https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fchaos-test-d1601%2Fdatabases%2F(default)&RID=1';
const request=()=>({type:'requestfailed',url:listen.split('?')[0],failure:'net::ERR_CONNECTION_CLOSED'});
const consoleRow=()=>({type:'console-error',message:'Failed to load resource: net::ERR_CONNECTION_CLOSED'});
function loginRun(states) {
  const calls={submit:0,refresh:0,pause:0,recoveries:[]};
  return {calls,run:()=>submitAuditLogin({submit:async()=>{calls.submit++;},wait:async()=>states.shift(),isLogin:text=>text.startsWith('Login'),refresh:async()=>{calls.refresh++;},pause:async()=>{calls.pause++;},onRecovery:row=>calls.recoveries.push(row)})};
}
test('service-unavailable login gets exactly one fresh attempt and must authenticate',async()=>{
  const fixture=loginRun(['Login Firebase: Error (auth/the-service-is-currently-unavailable.).','Authenticated shell']);
  assert.equal(await fixture.run(),'Authenticated shell');assert.equal(fixture.calls.submit,2);assert.equal(fixture.calls.refresh,1);assert.equal(fixture.calls.pause,1);assert.equal(fixture.calls.recoveries.length,1);
});
test('persistent temporary Auth failure remains a failure after the single retry',async()=>{
  const fixture=loginRun(['Login auth/network-request-failed','Login auth/network-request-failed']);
  await assert.rejects(fixture.run,/Login did not leave the login screen/);assert.equal(fixture.calls.submit,2);assert.equal(fixture.calls.refresh,1);
});
test('invalid credentials and internal Auth errors do not trigger service retries',async()=>{
  for(const error of ['auth/invalid-credential','auth/wrong-password','auth/internal-error']) {
    const fixture=loginRun(['Login Firebase: Error ('+error+').']);
    await assert.rejects(fixture.run,/Login did not leave/);assert.equal(fixture.calls.submit,1);assert.equal(fixture.calls.refresh,0);
  }
});
test('pending login retains the existing one-shot submit recovery without a reload',async()=>{
  const fixture=loginRun(['Login Unlocking','Authenticated shell']);await fixture.run();assert.equal(fixture.calls.submit,2);assert.equal(fixture.calls.refresh,0);
});
test('Firestore transport failure stays blocking until a later successful matching response',()=>{
  const rows=[request(),consoleRow()],tracker=createFirestoreListenRecovery(rows);
  tracker.track(rows[0],listen);tracker.track(rows[1],listen);assert.equal(rows.length,2);
  tracker.response(listen,503);assert.equal(rows.length,2);
  tracker.response(listen.replace('RID=1','RID=2'),200);assert.deepEqual(rows,[]);assert.equal(tracker.recoveries.length,1);assert.equal(tracker.recoveries[0].failures.length,2);
});
test('a successful stream before a failure cannot count as its recovery',()=>{
  const rows=[],tracker=createFirestoreListenRecovery(rows);tracker.response(listen,200);const row=request();rows.push(row);tracker.track(row,listen);assert.equal(rows.length,1);assert.equal(tracker.pending(),1);
});
test('a late resource console event needs the exact already recovered failed URL',()=>{
  const rows=[request()],tracker=createFirestoreListenRecovery(rows);tracker.track(rows[0],listen);tracker.response(listen,200);
  const row=consoleRow();rows.push(row);tracker.track(row,listen);assert.deepEqual(rows,[]);assert.equal(tracker.recoveries[0].failures.length,2);
  const unrelated=consoleRow();rows.push(unrelated);tracker.track(unrelated,'');assert.deepEqual(rows,[unrelated]);
});
test('Firestore recovery preserves page errors, HTTP errors, and app resource failures',()=>{
  const rows=[request(),{type:'page-error',message:'TypeError'}, {type:'http-5xx',status:503},consoleRow()],tracker=createFirestoreListenRecovery(rows);
  tracker.track(rows[0],listen);tracker.track(rows[3],'https://testing.86chaos.com/static/js/main.js');tracker.response(listen,200);assert.equal(rows.length,3);assert.equal(rows[0].type,'page-error');
});
test('other projects, hosts, and Firestore endpoints cannot supply recovery proof',()=>{
  for(const url of [listen.replace('chaos-test-d1601','production'),listen.replace('firestore.googleapis.com','firestore.googleapis.com.evil.example'),listen.replace('/Listen/channel','/Write/channel')])assert.equal(firestoreListenKey(url),'');
  const rows=[request()],tracker=createFirestoreListenRecovery(rows);tracker.track(rows[0],listen);tracker.response(listen.replace('chaos-test-d1601','production'),200);assert.equal(rows.length,1);
});
test('a later closed stream remains blocking after an earlier stream recovered',()=>{
  const rows=[request()],tracker=createFirestoreListenRecovery(rows);tracker.track(rows[0],listen);tracker.response(listen,200);const second=request();rows.push(second);tracker.track(second,listen);assert.deepEqual(rows,[second]);assert.equal(tracker.pending(),1);
});
test('the real problem watcher records repeated failures again after recovery',()=>{
  const helper=fs.readFileSync(path.join(root,'tests/86chaos-full-audit/utils/audit-helpers.cjs'),'utf8');
  const fn=helper.slice(helper.indexOf('function watchForProblems('),helper.indexOf('\nfunction summarizeProblems('));
  const watch=vm.runInNewContext('('+fn+')',{createFirestoreListenRecovery,isIgnorableStaticAssetFailure:()=>false,isExpectedEmulatorFirebaseAuthBootstrapNoise:()=>false});
  const page=new (require('node:events').EventEmitter)(),problems=[];
  watch(page,problems,{recoverFirestoreListen:true});
  const failed={url:()=>listen,failure:()=>({errorText:'net::ERR_CONNECTION_CLOSED'})};
  page.emit('requestfailed',failed);assert.equal(problems.length,1);
  page.emit('response',{url:()=>listen,status:()=>200});assert.equal(problems.length,0);
  page.emit('requestfailed',failed);assert.equal(problems.length,1);
});
test('layout smoke cleanup preserves full-gate preflight and rules evidence',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-layout-evidence-'));
  const code=fs.readFileSync(path.join(root,'playwright.layout.config.cjs'),'utf8');
  const context={require,module:{exports:{}},__dirname:temp,process:{env:{CHAOS_RELEASE_GATE_RUN_DIR:temp}}};vm.runInNewContext(code,context);
  const config=context.module.exports;assert.equal(config.outputDir,path.join(temp,'layout-smoke-artifacts'));
  for(const name of ['environment-preflight.json','node-test-live-summary.json','firebase-rules-release-gate.json'])fs.writeFileSync(path.join(temp,name),'verified evidence');
  fs.mkdirSync(config.outputDir);fs.writeFileSync(path.join(config.outputDir,'old-artifact.txt'),'old');
  // Simulate Playwright clearing only its configured output directory.
  assert.equal(path.dirname(config.outputDir),temp);fs.rmSync(config.outputDir,{recursive:true});
  for(const name of ['environment-preflight.json','node-test-live-summary.json','firebase-rules-release-gate.json'])assert.equal(fs.readFileSync(path.join(temp,name),'utf8'),'verified evidence');
  for(const name of fs.readdirSync(temp))fs.unlinkSync(path.join(temp,name));fs.rmdirSync(temp);
});
test('standalone layout smoke output is a child of test-results rather than its root',()=>{
  const code=fs.readFileSync(path.join(root,'playwright.layout.config.cjs'),'utf8'),context={require,module:{exports:{}},__dirname:root,process:{env:{}}};vm.runInNewContext(code,context);
  assert.equal(context.module.exports.outputDir,path.join(root,'test-results','layout-smoke-artifacts'));
});

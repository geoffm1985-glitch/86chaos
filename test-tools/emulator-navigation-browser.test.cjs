'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium,firefox,webkit,expect}=require('@playwright/test');
const {createTargetTracker}=require('../tests/fixtures/emulator-navigation.cjs');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const aa=require('firebase-admin/app'),af=require('firebase-admin/firestore'),au=require('firebase-admin/auth');
const owned='qa_listener_handshake_'+crypto.randomUUID(),password='QaTransient-'+crypto.randomUUID(),email=owned+'@example.test';
let admin,db,user,server;
test.before(async()=>{
  admin=aa.initializeApp({projectId:'demo-86chaos'},owned);db=af.getFirestore(admin);
  user=await au.getAuth(admin).createUser({email,password});
  await db.doc('users/'+user.uid).create({restaurantId:owned,isAdmin:true,isActive:true});
  await db.doc('shifts/'+owned).create({restaurantId:owned,notes:'Owned handshake contract'});
  const files=new Map(['app','auth','firestore'].map(name=>['/'+name+'.js',fs.readFileSync(path.resolve('node_modules/firebase/firebase-'+name+'-compat.js'))]));
  server=http.createServer((req,res)=>{
    if(files.has(req.url)){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(files.get(req.url));}
    else {res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Owned emulator transport contract</title>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
});
test.after(async()=>{
  if(db){await db.doc('shifts/'+owned).delete();if(user)await db.doc('users/'+user.uid).delete();assert.equal((await db.doc('shifts/'+owned).get()).exists,false);}
  if(user){await au.getAuth(admin).deleteUser(user.uid);await assert.rejects(au.getAuth(admin).getUser(user.uid),e=>e.code==='auth/user-not-found');}
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  if(db)await db.terminate();if(admin)await aa.deleteApp(admin);
});
for(const [project,engine,options] of [
  ['chromium',chromium,{}],['mobile-chromium',chromium,{isMobile:true,viewport:{width:390,height:844}}],
  ['edge-pwa',chromium,{channel:'msedge'}],['firefox-pwa',firefox,{}],
  ['webkit-pwa',webkit,{}],['mobile-webkit-pwa',webkit,{isMobile:true,viewport:{width:390,height:844}}],
])test(`actual ${project} SDK initial listen handshake and acknowledged unsubscribe release every target`,{timeout:60000},async()=>{
  let browser,page;const errors=[];const {channel,...contextOptions}=options;
  try {
    browser=await engine.launch({headless:true,...(channel?{channel}:{})});
    const context=await browser.newContext(contextOptions);page=await context.newPage();
    // This owned fixture has no live project registration or network fallback.
    await context.route('https://**',route=>route.abort());page.on('pageerror',()=>errors.push(true));
    const tracker=createTargetTracker();page.on('request',tracker.request);
    await page.goto('http://127.0.0.1:'+server.address().port);
    for(const name of ['app','auth','firestore'])await page.addScriptTag({url:'/'+name+'.js'});
    const reads=await page.evaluate(async({email,password,owned,uid})=>{
      const app=window.firebase.initializeApp({apiKey:'demo-only',projectId:'demo-86chaos'}),auth=app.auth(),db=app.firestore();
      auth.useEmulator('http://127.0.0.1:9099',{disableWarnings:true});db.useEmulator('127.0.0.1',8080);
      await auth.signInWithEmailAndPassword(email,password);const stops=[];
      window.__ownedFinish=async()=>{for(const stop of stops)stop();await db.terminate();await auth.signOut();await app.delete();};
      window.__ownedUnsubscribe=async()=>{await db.waitForPendingWrites();for(const stop of stops)stop();};
      const serverRead=query=>new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Owned server read deadline')),12000);
        stops.push(query.onSnapshot(snapshot=>{if(!snapshot.metadata.fromCache){clearTimeout(timer);resolve(snapshot.size===undefined?snapshot.exists:snapshot.size);}},()=>{clearTimeout(timer);reject(new Error('Owned emulator listener rejected'));}));
      });
      return Promise.all([serverRead(db.doc('users/'+uid)),serverRead(db.collection('shifts').where('restaurantId','==',owned))]);
    },{email,password,owned,uid:user.uid});
    assert.deepEqual(reads,[true,1]);
    await page.evaluate(()=>window.__ownedUnsubscribe());
    await expect.poll(()=>tracker.evidence(),{timeout:12000}).toMatchObject({active:0,pending:0,failure:false});
    assert(tracker.evidence().added>=2);assert(tracker.evidence().removed>=2);assert.equal(errors.length,0);
  } finally {
    try { if(page && !page.isClosed())await page.evaluate(()=>window.__ownedFinish?.()); }
    finally { await browser?.close(); }
  }
});

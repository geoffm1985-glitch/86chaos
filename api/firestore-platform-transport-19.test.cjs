'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {selectFirestoreTransport}=require('../src/core/firestorePlatformTransport.shared.js');
test('Android retains long polling and every supported WebKit browser explicitly selects XMLHttpRequest',()=>{
  const xhr={experimentalForceLongPolling:true,experimentalAutoDetectLongPolling:false};
  assert.deepEqual(selectFirestoreTransport({native:true,platform:'android'}),xhr);
  for(const userAgent of ['Mozilla/5.0 Macintosh AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15','Mozilla/5.0 iPhone AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1','Mozilla/5.0 iPhone AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148','Mozilla/5.0 iPhone AppleWebKit/605.1.15 FxiOS/130.0 Mobile/15E148','Mozilla/5.0 iPhone AppleWebKit/605.1.15 EdgiOS/130.0 Mobile/15E148'])assert.deepEqual(selectFirestoreTransport({userAgent}),{...xhr,useFetchStreams:false});
});
test('Windows Chrome and Edge, Android Chromium and Firefox retain their established transport',()=>{
  for(const userAgent of ['Mozilla/5.0 Windows AppleWebKit/537.36 Chrome/130.0 Safari/537.36','Mozilla/5.0 Windows AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0','Mozilla/5.0 Android AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36','Mozilla/5.0 Gecko/20100101 Firefox/130.0',''])assert.equal(selectFirestoreTransport({userAgent}),null);
});
test('installed pinned Firebase honors the WebKit XMLHttpRequest transport contract',async()=>{
  const {initializeApp,deleteApp}=require('firebase/app');
  const {initializeFirestore,terminate}=require('firebase/firestore');
  const app=initializeApp({projectId:'demo-86chaos-transport'},'xhr-contract');
  const db=initializeFirestore(app,selectFirestoreTransport({userAgent:'AppleWebKit/605.1.15 Safari/605.1.15'}));
  try{assert.equal(db._getSettings().useFetchStreams,false);assert.equal(db._getSettings().experimentalForceLongPolling,true);}
  finally{await terminate(db);await deleteApp(app);}
});

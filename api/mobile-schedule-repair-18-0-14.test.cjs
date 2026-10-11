'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore');
test('actual publisher queries work for a tenant manager and cannot read another tenant',{timeout:120000},async()=>{
  const emulatorHost=String(process.env.FIRESTORE_EMULATOR_HOST||'');
  assert.match(emulatorHost,/^127\.0\.0\.1:\d+$/,'This mutation test requires an explicit loopback emulator');
  const emulatorPort=Number(emulatorHost.split(':')[1]);
  assert(emulatorPort>0 && emulatorPort<65536);
  console.log('RULES: initialize');
  const env=await initializeTestEnvironment({projectId:'demo-schedule-repair',firestore:{host:'127.0.0.1',port:emulatorPort,rules:fs.readFileSync('firestore.rules','utf8')}});
  console.log('RULES: seed');
  try{
    await env.withSecurityRulesDisabled(async ctx=>{
      const db=ctx.firestore();
      await Promise.all([
        sdk.setDoc(sdk.doc(db,'users','schedule-manager'),{restaurantId:'tenant-a',workspaceIds:['tenant-a'],memberships:{'tenant-a':{isActive:true,isAdmin:true,permissions:{schedule:true}}}}),
        sdk.setDoc(sdk.doc(db,'restaurants','tenant-a'),{name:'Owned QA'}),
        sdk.setDoc(sdk.doc(db,'shifts','canonical'),{restaurantId:'tenant-a',workspaceId:'tenant-a',date:'2026-10-19',scheduleDateKey:'2026-10-19'}),
        sdk.setDoc(sdk.doc(db,'shifts','legacy-date-key'),{restaurantId:'tenant-a',scheduleDateKey:'2026-10-20'}),
        sdk.setDoc(sdk.doc(db,'shifts','foreign'),{restaurantId:'tenant-b',workspaceId:'tenant-b',date:'2026-10-19'})
      ]);
    });
    console.log('RULES: authenticated queries');
    const db=env.authenticatedContext('schedule-manager').firestore();
    // Execute the application's real candidate-loader body against authenticated rules.
    const source=fs.readFileSync('src/features/schedule.jsx','utf8');
    const start=source.indexOf('const fetchSchedulePublishCandidatesForDaySet = async');
    const end=source.indexOf('  const eventsByScheduleDay',start);
    assert(start>=0&&end>start);
    const run=vm.runInNewContext(source.slice(start,end)+'\nfetchSchedulePublishCandidatesForDaySet',{
      db,appUser:{restaurantId:'tenant-a'},query:sdk.query,collection:sdk.collection,where:sdk.where,getDocsFromServer:async q=>{console.log('RULES: candidate query');const result=await sdk.getDocsFromServer(q);console.log('RULES: candidate returned',result.size);return result;},
      recordScheduleOperationDiagnostic:()=>{},isDeletedScheduleShift:()=>false,getShiftDateKey:row=>row.date||row.scheduleDateKey,
      shiftMatchesLocalDeleteMarkers:()=>false,activeLocalDeleteKeySet:new Set(),activeLocalDeleteMarkerMap:new Map(),getShiftWritableDocId:row=>row.id,
      mergeSchedulePublishCandidates:rows=>rows
    });
    const rows=await run(new Set(['2026-10-19','2026-10-20']),[]);
    assert.deepEqual(Array.from(rows,row=>row.id).sort(),['canonical','legacy-date-key']);
    await assertFails(sdk.getDocs(sdk.query(sdk.collection(db,'shifts'),sdk.where('workspaceId','==','tenant-a'),sdk.where('date','==','2026-10-19'))));
    await assertFails(sdk.getDocs(sdk.query(sdk.collection(db,'shifts'),sdk.where('restaurantId','==','tenant-b'))));
    await assertFails(sdk.getDocs(sdk.collection(db,'shifts')));
    await assertSucceeds(sdk.getDocs(sdk.query(sdk.collection(db,'shifts'),sdk.where('restaurantId','==','tenant-a'))));
  }finally{await env.cleanup();}
});
test('stale schedule evidence stays blocked rather than passing completeness',()=>{
  const {assessScheduleToolsCompleteness}=require('../src/core/scheduleToolsPeriod.cjs');
  assert.equal(assessScheduleToolsCompleteness([{label:'shifts',resolved:true,stale:true}]).complete,false);
  assert.equal(assessScheduleToolsCompleteness([{label:'shifts',resolved:true,stale:false,count:0,limit:100}]).complete,true);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {childEnvironment,serverTestArguments}=require('../scripts/run-isolated-server-tests.cjs');
const {safeTestTarget}=require('../test-tools/pos-bridge-simulator.cjs');
test('a deployed testing gate pins its server children to their private emulator project',()=>{
  const parent={YARDMASTER_FIREBASE_TARGET:'live',REACT_APP_86CHAOS_FIREBASE_TARGET:'live',FIREBASE_PROJECT_ID:'chaos-test-d1601',FIREBASE_ACTIVE_PROJECT_ID:'chaos-test-d1601',GCLOUD_PROJECT:'demo-86chaos',FIRESTORE_EMULATOR_HOST:'127.0.0.1:32123',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:32124',APP_URL:'https://testing.86chaos.com'};
  const original={...parent},env=childEnvironment(parent);
  assert.equal(env.YARDMASTER_FIREBASE_TARGET,'emulator');
  assert.equal(env.CHAOS_BLOCK_LIVE_FIREBASE,'1');
  for(const key of ['GCLOUD_PROJECT','FIREBASE_PROJECT_ID','FIREBASE_ACTIVE_PROJECT_ID'])assert.equal(env[key],'demo-86chaos');
  assert.equal(env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:32123');
  assert.equal(env.FIREBASE_STORAGE_EMULATOR_HOST,'127.0.0.1:32124');
  assert.equal(safeTestTarget('http://127.0.0.1:5001',env),true);
  assert.deepEqual(parent,original);
});
test('isolated SDK hosts override inherited browser ports without mutating the parent',()=>{
  const parent={YARDMASTER_FIREBASE_TARGET:'emulator',FIRESTORE_EMULATOR_HOST:'127.0.0.1:32123',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:32124',REACT_APP_86CHAOS_FIRESTORE_EMULATOR_PORT:'8080',REACT_APP_86CHAOS_STORAGE_EMULATOR_PORT:'9199',TEMP:'private-service-temp',TMP:'private-service-temp',CHAOS_SERVER_PARENT_TEMP:'original-temp',CHAOS_SERVER_PARENT_TMP:'original-tmp'};
  const original={...parent},env=childEnvironment(parent);
  assert.equal(env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:32123');
  assert.equal(env.FIREBASE_STORAGE_EMULATOR_HOST,'127.0.0.1:32124');
  assert.equal(env.GCLOUD_PROJECT,'demo-86chaos');
  assert.equal(env.TEMP,'original-temp');assert.equal(env.TMP,'original-tmp');
  assert.equal(env.CHAOS_SERVER_PARENT_TEMP,undefined);
  assert.deepEqual(parent,original);
});

test('server concurrency defaults retain the complete test selection and reject malformed overrides',()=>{
  const args=serverTestArguments([],{});
  assert.equal(args[0],'--test');assert.equal(args.at(-1),'api/*.test.cjs');
  assert.equal(args[1],`--test-concurrency=${process.platform==='win32'?1:Math.min(2,require('os').availableParallelism())}`);
  for(const value of ['0','-1','1.5','33','NaN','1 --test-skip-pattern=.*'])assert.throws(()=>serverTestArguments([],{CHAOS_SERVER_TEST_CONCURRENCY:value}),/integer from 1 to 32/);
});

test('actual Node test files obey the configured serialization without dropping either file',t=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'86chaos-server-serial-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const lock=path.join(directory,'exclusive.lock'),completed=path.join(directory,'completed.jsonl');
  const files=[0,1].map(index=>{
    const file=path.join(directory,`worker-${index}.test.cjs`);
    fs.writeFileSync(file,`const test=require('node:test'),fs=require('node:fs');test('worker ${index}',async()=>{const fd=fs.openSync(${JSON.stringify(lock)},'wx');try{await new Promise(r=>setTimeout(r,200));fs.appendFileSync(${JSON.stringify(completed)},'${index}\\n');}finally{fs.closeSync(fd);fs.unlinkSync(${JSON.stringify(lock)});}});`);
    return file;
  });
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=cp.spawnSync(process.execPath,serverTestArguments(files,{CHAOS_SERVER_TEST_CONCURRENCY:'1'}),{env,encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,String(result.stderr||'')+String(result.stdout||''));
  assert.deepEqual(fs.readFileSync(completed,'utf8').trim().split(/\r?\n/).sort(),['0','1']);
});

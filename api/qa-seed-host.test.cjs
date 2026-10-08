const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const moduleFixture={exports:{}};
const env={YARDMASTER_FIREBASE_TARGET:'emulator'};
vm.runInNewContext(fs.readFileSync(path.join(root,'api/full-audit-qa-seed.js'),'utf8')+'\nmodule.exports.checkBase=validateBase;',{
  module:moduleFixture,process:{env},require(name){
    if(name==='./_chaos-admin')return {clean:(v,f='')=>String(v||f).trim(),norm:v=>String(v||'').toLowerCase()};
    return require(path.resolve(root,'api',name));
  },console
});
const check=moduleFixture.exports.checkBase;
function request(host,options={}){
  return check({req:{headers:{host,...options.headers}},auth:{isSuperAdmin:options.admin!==false},projectId:options.project||'demo-86chaos',body:{runId:'2026-10-02T16-11-45',restaurantId:'qa-fixture',expectedProjectId:'demo-86chaos'}});
}
test('QA seed accepts the exact Yardmaster loopback host with its HTTP port',()=>assert.equal(request('127.0.0.1:3000').ok,true));
test('testing preview hostname with port retains its existing allowance',()=>assert.equal(request('testing.86chaos.com:443').ok,true));
test('production host remains rejected with and without a port',()=>{for(const host of ['www.86chaos.com','www.86chaos.com:443','86chaos.com:3000'])assert.equal(request(host).ok,false,host)});
test('a forwarded production host cannot use the local allowance',()=>assert.equal(request('127.0.0.1:3000',{headers:{'x-forwarded-host':'www.86chaos.com:443'}}).ok,false));
test('loopback never overrides project identity or administrator requirements',()=>{assert.equal(request('127.0.0.1:3000',{project:'cheers-34b8d'}).ok,false);assert.equal(request('127.0.0.1:3000',{admin:false}).ok,false)});

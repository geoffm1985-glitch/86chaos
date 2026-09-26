'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const core=require('./_schedule-publish-core.cjs');
const rolesCore=require('../src/core/rosterRoleIdentityCore.cjs');
const identity=require('../scripts/86chaos-release-gate/source-identity.cjs');
const roles=[{id:'grill',name:'Grill',revision:2,previousNames:['Line']},{id:'bar',name:'Bar'}];
const person={id:'employee',scheduleUserId:'employee',employeeId:'employee',rosterUserId:'employee',userId:'employee',authUid:'employee',name:'Person',email:'person@example.invalid'};
function loadClient(file){
 const filename=path.resolve(__dirname,'../src/core',file),m=new (require('module'))(filename,module);
 m.filename=filename;m.paths=module.paths;
 const original=m.require.bind(m);
 m.require=name=>name.startsWith('./')&&!name.endsWith('.cjs')?loadClient(name.replace('./','')+'.js'):original(name);
 m._compile(require('@babel/core').transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
 return m.exports;
}
const clientRole=loadClient('rosterRoleIdentity.js'),clientPlan=loadClient('schedulePublicationPlan.js');
const variants=[
 ['current ID',{rosterRoleId:'grill',role:'Wrong'},true,'grill'],
 ['legacy unique',{role:' Grill '},true,'grill'],
 ['renamed history',{role:'Line'},true,'grill'],
 ['blank snapshot',{rosterRoleNameSnapshot:'  ',role:'Line'},true,'grill'],
 ['explicit target',{targetRole:'Bar',role:'Grill'},true,'bar'],
 ['missing',{},false],
 ['unknown ID',{rosterRoleId:'deleted',role:'Grill'},false],
 ['unknown name',{role:'Kitchen'},false]
];
for(const [name,shift,ok,id] of variants)test('17.0.5 shared client/server role decision: '+name,()=>{
 const server=core.resolveRole(shift,roles),client=clientRole.resolveShiftRosterRole(shift,roles);assert.deepEqual(client,server);assert.equal(server.ok,ok);if(id)assert.equal(server.rosterRoleId,id);
});
test('17.0.5 duplicate names and reused historical names remain ambiguous',()=>{
 for(const extra of [{id:'other',name:'Grill'},{id:'other',name:'Other',previousNames:['Grill']}])assert.equal(core.resolveRole({role:'Grill'},[...roles,extra]).reason,'ambiguous-legacy-role-name');
 assert.equal(core.resolveRole({role:'Bar'},[{id:'bar',name:'Bar',archived:true}]).ok,false);
 assert.equal(core.resolveRole({rosterRoleId:'bar'},[{id:'bar',name:'Bar',archived:true}]).ok,true);
});
test('17.0.5 actual client confirmation enters the canonical server publication plan',async()=>{
 for(const [name,fields,ok] of variants.filter(row=>row[2])){
  const shift={id:'s',restaurantId:'tenant',date:'2026-09-19',scheduleDateKey:'2026-09-19',employeeId:'employee',startTime:'09:00',endTime:'17:00',...fields};
  const plan=clientPlan.buildSchedulePublicationPlan({restaurantId:'tenant',allRoles:true,candidateShifts:[shift],rosterRoles:roles});
  assert.equal(plan.unresolvedRoles.length,0,name);
  const resolution=core.resolveRole(shift,roles);
  const expected=await clientPlan.buildConfirmedShiftEvidence({shift,resolvedRole:resolution,desiredEmployeeIdentity:core.canonicalEmployeeIdentity(person,shift)});
  const result=core.buildCanonicalServerPlan({restaurantId:'tenant',operationId:'operation_1705_1234',dayKeys:[shift.date],allRoles:true,roles,shifts:[{...shift,_employeeResolution:{ok:true,person}}],expectedShifts:[expected],roleConfigurationRevision:plan.roleConfigurationRevision});
  assert.equal(result.candidates.length,1,name);assert.equal(result.candidates[0].rosterRoleId,resolution.rosterRoleId);
 }
});
test('17.0.5 already published legacy role still requires normalization; modern live shifts stay unchanged',async()=>{
 const shift={id:'s',restaurantId:'tenant',date:'2026-09-19',scheduleDateKey:'2026-09-19',role:'Line',...core.canonicalEmployeeIdentity(person),isPublished:true,published:true,status:'published',publishStatus:'published',scheduleId:'existing',_employeeResolution:{ok:true,person}};
 const resolved=core.resolveRole(shift,roles),expected=await clientPlan.buildConfirmedShiftEvidence({shift,resolvedRole:resolved,desiredEmployeeIdentity:core.canonicalEmployeeIdentity(person,shift)});
 const params={restaurantId:'tenant',operationId:'operation_1705_live',dayKeys:[shift.date],allRoles:true,roles,roleConfigurationRevision:clientRole.rosterRoleConfigurationRevision(roles)};
 const result=core.buildCanonicalServerPlan({...params,shifts:[shift],expectedShifts:[expected]});assert.equal(result.candidates[0].migrateRoleIdentity,true);
 const modern={...shift,rosterRoleId:'grill',rosterRoleNameSnapshot:'Grill'};const unchanged=core.buildCanonicalServerPlan({...params,shifts:[modern],expectedShifts:[]});assert.equal(unchanged.candidates.length,0);assert.deepEqual(unchanged.unchangedShiftIds,['s']);
});
test('17.0.5 Copy Month retains canonical role across rename and duplicate display names',()=>{
 const source={rosterRoleId:'grill',rosterRoleNameSnapshot:'Line',role:'Line',targetRole:'Line'};
 const copied=rolesCore.copyRosterRoleFields(source);assert.deepEqual(copied,source);
 const renamed=[{id:'grill',name:'Hot Line',previousNames:['Line']},{id:'other',name:'Line'}];assert.equal(core.resolveRole(copied,renamed).rosterRoleId,'grill');
});
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'identity-1705-'));fs.mkdirSync(path.join(dir,'src'));fs.writeFileSync(path.join(dir,'package.json'),'{"version":"17.0.5"}\n');fs.writeFileSync(path.join(dir,'src/app.js'),'let value=1;\n');fs.writeFileSync(path.join(dir,'README.md'),'Source docs\n');const git=args=>{const r=cp.spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};git(['init','-b','testing']);git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture']);return{dir,git};}
test('17.0.5 build fingerprint survives filtered docs and catches altered or deleted runtime inputs',()=>{
 const {dir}=fixture(),oldVercel=process.env.VERCEL,oldStrict=process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE;
 try{const before=identity.captureSourceIdentity(dir);fs.writeFileSync(path.join(dir,'release-source-manifest.json'),JSON.stringify({schemaVersion:1,sourceHash:before.sourceHash,files:before.files},null,2)+'\n');process.env.VERCEL='1';process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE='1';fs.unlinkSync(path.join(dir,'README.md'));const build=identity.captureBuildSourceIdentity(dir);assert.equal(build.sourceHash,before.sourceHash);assert.deepEqual(build.buildSourceChanges,[{file:'README.md',reason:'absent',buildInput:false}]);fs.writeFileSync(path.join(dir,'src/app.js'),'let value=2;\n');assert.throws(()=>identity.captureBuildSourceIdentity(dir),/Build source differs/);fs.unlinkSync(path.join(dir,'src/app.js'));assert.throws(()=>identity.captureBuildSourceIdentity(dir),/absent/);}finally{if(oldVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=oldVercel;if(oldStrict===undefined)delete process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE;else process.env.CHAOS_STRICT_VERCEL_BUILD_WORKSPACE=oldStrict;fs.rmSync(dir,{recursive:true,force:true});}
});
test('17.0.5 CRLF, tracked generated junk and generated ZIPs cannot change source identity',()=>{
 const {dir,git}=fixture();try{
 const before=identity.captureSourceIdentity(dir);fs.writeFileSync(path.join(dir,'src/app.js'),'let value=1;\r\n');
 for(const folder of ['node_modules','test-results','build','coverage','playwright-report']){fs.mkdirSync(path.join(dir,folder));fs.writeFileSync(path.join(dir,folder,'junk.js'),'generated');git(['add','-f',folder]);}
 fs.writeFileSync(path.join(dir,'86chaos-release-gate-SLIM-UPLOAD-ME.zip'),'archive');git(['add','-f','86chaos-release-gate-SLIM-UPLOAD-ME.zip']);
 assert.equal(identity.captureSourceIdentity(dir).sourceHash,before.sourceHash);
 fs.unlinkSync(path.join(dir,'src/app.js'));assert.throws(()=>identity.captureSourceIdentity(dir),/ENOENT/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('source identity normalizes TypeScript line endings across Linux and Windows checkouts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'identity-ts-eol-'));try{
  fs.writeFileSync(path.join(dir,'package.json'),'{"version":"17.1.24"}\n');fs.mkdirSync(path.join(dir,'functions'),{recursive:true});
  fs.writeFileSync(path.join(dir,'functions','index.ts'),'export const value = 1;\n');const lf=identity.captureSourceIdentity(dir);
  fs.writeFileSync(path.join(dir,'functions','index.ts'),'export const value = 1;\r\n');const crlf=identity.captureSourceIdentity(dir);
  assert.equal(crlf.sourceHash,lf.sourceHash);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

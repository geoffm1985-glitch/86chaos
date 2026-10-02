'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'RUN_86CHAOS_FAILED_AND_NEW_RELEASE_GATE.ps1'),'utf8');
const helper=source.match(/function Set-VerifiedScopedEmulatorTarget \{[\s\S]*?(?=\r?\nSet-RunnerPhase 'environment-preflight')/)[0];
const report={ok:true,firebaseTarget:'EMULATOR',firebaseProjectId:'demo-86chaos',appUrl:'http://127.0.0.1:3000'};
function run(overrides={},selection='emulator'){
  const script=helper+"\n$env:APP_URL='https://testing.86chaos.com';$env:CHAOS_BASE_URL=$env:APP_URL;$env:CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL='https://stale.vercel.app';$report='"+JSON.stringify({...report,...overrides})+"'|ConvertFrom-Json;try{Set-VerifiedScopedEmulatorTarget -Report $report -Selection '"+selection+"';[pscustomobject]@{app=$env:APP_URL;base=$env:CHAOS_BASE_URL;pw=$env:PLAYWRIGHT_BASE_URL;immutable=$env:CHAOS_VERIFIED_IMMUTABLE_DEPLOYMENT_URL}|ConvertTo-Json -Compress}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 2}";
  return cp.spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{encoding:'utf8',windowsHide:true});
}
test('scoped emulator retest pins role verification and Playwright to verified loopback instead of stale cloud aliases',()=>{const r=run();assert.equal(r.status,0,r.stderr);const actual=JSON.parse(r.stdout.trim());assert.equal(actual.app,report.appUrl);assert.equal(actual.base,report.appUrl);assert.equal(actual.pw,report.appUrl);assert.ok(!actual.immutable);assert.ok(source.indexOf('Set-VerifiedScopedEmulatorTarget -Report $ScopedPreflight')<source.indexOf('Run-Step "Provision temporary release-gate test accounts"'));});
for(const [label,overrides] of [['cloud destination',{appUrl:'https://testing.86chaos.com'}],['live project',{firebaseProjectId:'cheers-34b8d'}],['unverified report',{ok:false}]])test('scoped emulator retest refuses '+label,()=>{const r=run(overrides);assert.equal(r.status,2);assert.match(r.stderr,/did not prove/)});
test('scoped live runner retains its cloud target and deployment evidence',()=>{const r=run({},'live');assert.equal(r.status,0,r.stderr);const actual=JSON.parse(r.stdout.trim());assert.equal(actual.app,'https://testing.86chaos.com');assert.equal(actual.immutable,'https://stale.vercel.app')});

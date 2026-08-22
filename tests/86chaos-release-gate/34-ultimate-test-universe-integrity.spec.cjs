const { test, expect } = require('@playwright/test');
const fs=require('fs');const path=require('path');
const { attachJson, ROUTE_SPECS }=require('../86chaos-full-audit/utils/audit-helpers.cjs');
const WORKFLOWS=require('./mutation-workflow-manifest.cjs');
const { APP_ROUTE_IDS }=require('../../scripts/86chaos-release-gate/route-access-matrix.cjs');

function walk(dir){const out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...walk(p));else if(e.isFile())out.push(p);}return out;}

test.describe('34 ultimate test-universe integrity',()=>{
 test('the release gate cannot silently drop routes, specs, workflow targets, or focus only a subset',async({},testInfo)=>{
   const all=walk(path.join(process.cwd(),'tests'));
   const specs=all.filter(p=>/\.spec\.cjs$/.test(p));
   const focused=[];const forbiddenFixme=[];
   for(const p of specs){const s=fs.readFileSync(p,'utf8');if(/\b(?:test|it|describe)\.only\s*\(/.test(s))focused.push(path.relative(process.cwd(),p));if(/\btest\.fixme\s*\(/.test(s))forbiddenFixme.push(path.relative(process.cwd(),p));}
   const requiredUltimate=[
    'tests/86chaos-release-gate/28-exhaustive-route-state-control-graph.spec.cjs',
    'tests/86chaos-release-gate/29-source-exhaustiveness-ledger.spec.cjs',
    'tests/86chaos-release-gate/30-exhaustive-role-route-permission-matrix.spec.cjs',
    'tests/86chaos-release-gate/31-exhaustive-responsive-nested-layout.spec.cjs',
    'tests/86chaos-release-gate/32-exhaustive-nested-accessibility.spec.cjs',
    'tests/86chaos-release-gate/33-business-math-exhaustiveness.spec.cjs',
    'tests/86chaos-full-audit/13-back-office-document-vault.spec.cjs',
   ];
   const missingUltimate=requiredUltimate.filter(rel=>!fs.existsSync(path.join(process.cwd(),rel)));
   const missingWorkflows=WORKFLOWS.filter(w=>!fs.existsSync(path.join(process.cwd(),w.testFile))).map(w=>w.testFile);
   const routes=ROUTE_SPECS.map(r=>r.tab).sort();const canonical=[...APP_ROUTE_IDS].sort();
   const result={specCount:specs.length,focused,forbiddenFixme,missingUltimate,missingWorkflows,routes,canonical,workflowCount:WORKFLOWS.length};
   await attachJson(testInfo,'34-test-universe-integrity.json',result);
   expect(focused,'No focused .only test is allowed in an end-all release gate').toEqual([]);
   expect(forbiddenFixme,'No Play Store spec may hide a known blocker behind test.fixme').toEqual([]);
   expect(missingUltimate,'Every ultimate coverage layer must remain installed').toEqual([]);
   expect(missingWorkflows,'Every mutation workflow manifest target must exist').toEqual([]);
   expect(routes,'Browser route inventory must exactly match canonical app routes').toEqual(canonical);
   expect(specs.length,'Play Store browser universe unexpectedly shrank').toBeGreaterThanOrEqual(40);
 });
});

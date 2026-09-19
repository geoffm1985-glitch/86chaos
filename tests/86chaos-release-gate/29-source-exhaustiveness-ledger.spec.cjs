const { test, expect } = require('@playwright/test');
const fs=require('fs');const path=require('path');
const { attachJson, ROUTE_SPECS } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { analyze } = require('../../test-tools/ultimate-source-inventory.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { APP_ROUTE_IDS } = require('../../scripts/86chaos-release-gate/route-access-matrix.cjs');
const WORKFLOWS = require('./mutation-workflow-manifest.cjs');

test.describe('29 source-derived exhaustiveness ledger',()=>{
 test('every production source file, function, event handler, interactive JSX control, API handler, route, and workflow target is inventoried',async({},testInfo)=>{
   const inv=analyze(process.cwd());
   const routeIds=ROUTE_SPECS.map(r=>r.tab).sort();
   const canonical=[...APP_ROUTE_IDS].sort();
   const missingMatrix=canonical.filter(r=>!Object.prototype.hasOwnProperty.call(ROUTE_STATES,r));
   const extraRoutes=routeIds.filter(r=>!canonical.includes(r));
   const missingRoutes=canonical.filter(r=>!routeIds.includes(r));
   const missingWorkflowFiles=WORKFLOWS.filter(w=>!fs.existsSync(path.join(process.cwd(),w.testFile))).map(w=>({name:w.name,testFile:w.testFile,actionIds:w.actionIds}));
   const controlFiles=inv.sourceFiles.filter(f=>f.interactiveControls>0).sort((a,b)=>b.interactiveControls-a.interactiveControls);
   await attachJson(testInfo,'29-ultimate-source-inventory.json',{totals:inv.totals,parseErrors:inv.parseErrors,focusedTests:inv.focusedTests,missingRoutes,extraRoutes,missingMatrix,missingWorkflowFiles,controlFiles,functions:inv.functions,interactiveControls:inv.interactiveControls,eventHandlers:inv.eventHandlers,mathExpressions:inv.mathExpressions,apiHandlers:inv.apiHandlers,testFiles:inv.testFiles});
   expect(inv.parseErrors,'All production source files must parse; a parse failure invalidates exhaustiveness accounting').toEqual([]);
   expect(inv.focusedTests,'No .only is allowed anywhere in the test universe').toEqual([]);
   expect(missingRoutes,'Every canonical application route must be in the Play Store route inventory').toEqual([]);
   expect(extraRoutes,'Play Store route inventory must not invent non-canonical routes').toEqual([]);
   expect(missingMatrix,'Every canonical route must have an explicit nested-state inventory, even if that inventory is empty').toEqual([]);
   expect(missingWorkflowFiles,'Every mutating workflow declared by the gate must point to a real browser test file').toEqual([]);
   // 16.0.191 source baselines. If these shrink unexpectedly, coverage accounting must be reviewed rather than silently losing surfaces.
   expect(inv.totals.sourceFiles,'Production source file inventory unexpectedly shrank').toBeGreaterThanOrEqual(60);
   expect(inv.totals.apiHandlers,'Recursive API inventory must include nested handlers').toBeGreaterThanOrEqual(70);
   expect(inv.totals.functions,'Function inventory must include the real application helper/component surface').toBeGreaterThanOrEqual(500);
   expect(inv.totals.interactiveControls,'Static JSX control inventory must include the real app control surface').toBeGreaterThanOrEqual(1000);
   expect(inv.totals.eventHandlers,'Static event-handler inventory must include all onClick/onChange/onSubmit/etc. handlers').toBeGreaterThanOrEqual(700);
   expect(inv.totals.mathExpressions,'Every arithmetic expression must be inventoried for business-math coverage review').toBeGreaterThanOrEqual(500);
 });
});

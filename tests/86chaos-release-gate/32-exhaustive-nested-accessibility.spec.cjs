const { test, expect } = require('@playwright/test');
let AxeBuilder=null, axeCore=null;
try{AxeBuilder=require('@axe-core/playwright').default;}catch(_){axeCore=require('axe-core');}
const { ROUTE_SPECS, ownerLikeCreds, creds, requireCreds, login, gotoTab, attachJson, PERMISSION_GATE_RE } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { applyStatePath } = require('./utils/exhaustive-ui-helpers.cjs');
const TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa'];
async function axe(page){if(AxeBuilder)return new AxeBuilder({page}).withTags(TAGS).analyze();if(!axeCore?.source)throw new Error('axe-core is required');await page.addScriptTag({content:axeCore.source});return page.evaluate(tags=>window.axe.run(document,{runOnly:{type:'tag',values:tags}}),TAGS);}
function simplify(v){return{id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,15).map(n=>({target:n.target,html:n.html.slice(0,300),failureSummary:n.failureSummary}))};}

test.describe('32 nested-state WCAG accessibility',()=>{
 test('every declared nested surface has zero serious/critical WCAG violations on desktop and mobile projects',async({page},testInfo)=>{
   test.setTimeout(95*60*1000);
   const owner=ownerLikeCreds();requireCreds(owner,'owner-like account');
   const sys=creds('SYSTEM_ADMIN');
   await login(page,owner.email,owner.password);
   let sysMode=false;const findings=[];
   for(const route of ROUTE_SPECS){
     if(route.tab==='godmode'&&!sysMode){
       if(!sys.email||!sys.password)throw new Error('SYSTEM_ADMIN credentials required for nested GodMode accessibility coverage.');
       await page.context().clearCookies().catch(()=>{});await page.goto('about:blank');await login(page,sys.email,sys.password);sysMode=true;
     }
     const states=[[]].concat(ROUTE_STATES[route.tab]||[]);
     const routeText=await gotoTab(page,route.tab,{settleMs:350,maxText:14000,force:true});
     const routeGated=PERMISSION_GATE_RE.test(routeText);
     for(const state of states){
       if(routeGated){findings.push({route:route.tab,state:state.map(String),gated:true});continue;}
       const applied=await applyStatePath(page,state,{strict:false});
       if(!applied.ok){findings.push({route:route.tab,state:state.map(String),missing:true});continue;}
       const result=await axe(page);
       const blocking=result.violations.filter(v=>v.impact==='serious'||v.impact==='critical').map(simplify);
       findings.push({route:route.tab,state:state.map(String),blocking});
     }
   }
   const missing=findings.filter(x=>x.missing);
   const blocking=findings.flatMap(x=>(x.blocking||[]).map(v=>({route:x.route,state:x.state,...v})));
   await attachJson(testInfo,'32-nested-accessibility.json',{states:findings.length,missing,blocking,findings});
   expect(missing,'Accessibility sweep must not silently miss a declared nested surface').toEqual([]);
   expect(blocking,'Every nested state must have zero serious/critical WCAG violations').toEqual([]);
 });
});

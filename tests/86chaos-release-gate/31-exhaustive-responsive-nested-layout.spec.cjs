const { test, expect } = require('@playwright/test');
const { ROUTE_SPECS, ownerLikeCreds, creds, requireCreds, login, gotoTab, viewportAudit, attachJson, PERMISSION_GATE_RE } = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { ROUTE_STATES } = require('./exhaustive-surface-matrix.cjs');
const { applyStatePath } = require('./utils/exhaustive-ui-helpers.cjs');

const VIEWPORTS=[
  {name:'narrow-phone',width:320,height:568,isMobile:true},
  {name:'phone',width:390,height:844,isMobile:true},
  {name:'tablet',width:768,height:1024,isMobile:true},
  {name:'laptop',width:1366,height:768,isMobile:false},
  {name:'desktop',width:1920,height:1080,isMobile:false},
];

test.describe('31 exhaustive responsive layout across nested states',()=>{
 test('every route and nested surface fits phone/tablet/laptop/desktop without unusable overflow or tap targets',async({browser},testInfo)=>{
   test.skip(testInfo.project.name!=='chromium','Responsive matrix is executed once from Chromium and creates its own viewport contexts.');
   test.setTimeout(120*60*1000);
   const owner=ownerLikeCreds(); requireCreds(owner,'owner-like account');
   const sys=creds('SYSTEM_ADMIN');
   const findings=[];
   for(const vp of VIEWPORTS){
     let context=await browser.newContext({viewport:{width:vp.width,height:vp.height},isMobile:vp.isMobile,hasTouch:vp.isMobile});
     let page=await context.newPage();
     await login(page,owner.email,owner.password);
     let asSystem=false;
     for(const route of ROUTE_SPECS){
       if(route.tab==='godmode'&&!asSystem){
         if(!sys.email||!sys.password) throw new Error('SYSTEM_ADMIN credentials are required for exhaustive GodMode responsive coverage.');
         await context.close();
         context=await browser.newContext({viewport:{width:vp.width,height:vp.height},isMobile:vp.isMobile,hasTouch:vp.isMobile});
         page=await context.newPage();
         await login(page,sys.email,sys.password); asSystem=true;
       }
       const states=[[]].concat(ROUTE_STATES[route.tab]||[]);
       for(let i=0;i<states.length;i++){
         const path=states[i];
         const text=await gotoTab(page,route.tab,{settleMs:350,maxText:16000,force:true});
         if(PERMISSION_GATE_RE.test(text)){findings.push({viewport:vp.name,route:route.tab,path:path.map(String),gated:true});continue;}
         const state=await applyStatePath(page,path,{strict:false});
         if(!state.ok){findings.push({viewport:vp.name,route:route.tab,path:path.map(String),missing:true});continue;}
         const audit=await viewportAudit(page);
         findings.push({viewport:vp.name,route:route.tab,path:path.map(String),horizontalOverflow:audit.horizontalOverflow,offenders:audit.offenders,smallButtons:audit.smallButtons});
       }
     }
     await context.close();
   }
   const overflow=findings.filter(x=>x.horizontalOverflow);
   const small=findings.flatMap(x=>(x.smallButtons||[]).map(b=>({viewport:x.viewport,route:x.route,path:x.path,...b})));
   const missing=findings.filter(x=>x.missing);
   await attachJson(testInfo,'31-exhaustive-responsive-layout.json',{totalStates:findings.length,overflow,smallTargets:small,missing,findings});
   expect(missing,'Responsive coverage may not silently skip declared nested surfaces').toEqual([]);
   expect(overflow,'No tested route/state may force whole-page horizontal overflow at supported viewport sizes').toEqual([]);
   expect(small,'Touch/mobile states must meet the app tap-target policy').toEqual([]);
 });
});

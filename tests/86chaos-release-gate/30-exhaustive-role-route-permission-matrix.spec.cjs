const { test, expect } = require('@playwright/test');
const {
  creds, login, gotoTab, bodyText, attachJson, ROUTE_SPECS,
  PERMISSION_GATE_RE, STAFF_FORBIDDEN_RE, STAFF_ACTION_RE,
} = require('../86chaos-full-audit/utils/audit-helpers.cjs');
const { expectedRoutesForRole } = require('../../scripts/86chaos-release-gate/route-access-matrix.cjs');

// This multi-minute test creates and closes four long-lived contexts and already
// attaches its complete route matrix. Avoid a continuous video per context while
// retaining configured traces and failure screenshots for diagnosis.
test.use({ video: 'off' });

function required(prefix){const a=creds(prefix);if(!a.email||!a.password)throw new Error(`Missing required ${prefix}_EMAIL/${prefix}_PASSWORD; exhaustive role coverage cannot skip an identity.`);return a;}

test.describe('30 exhaustive four-role x every-route permission matrix',()=>{
  test('system admin, owner, manager, and staff each exercise every canonical route with the exact allow/deny boundary',async({browser},testInfo)=>{
    test.setTimeout(75*60*1000);
    const roles=[
      ['system-admin',required('SYSTEM_ADMIN')],['owner',required('OWNER')],['manager',required('MANAGER')],['staff',required('STAFF')],
    ];
    const routeById=new Map(ROUTE_SPECS.map(r=>[r.tab,r]));
    const report=[];
    for(const [role,account] of roles){
      const context=await browser.newContext({viewport:/mobile/i.test(testInfo.project.name)?{width:390,height:844}:{width:1366,height:850},isMobile:/mobile/i.test(testInfo.project.name)});
      const page=await context.newPage();
      await login(page,account.email,account.password,{tab:'today'});
      for(const row of expectedRoutesForRole(role)){
        const spec=routeById.get(row.route);
        expect(spec,`Canonical route ${row.route} must exist in the exhaustive UI route inventory`).toBeTruthy();
        const text=await gotoTab(page,row.route,{settleMs:700,maxText:35000,force:true});
        const gated=PERMISSION_GATE_RE.test(text);
        const loginBounce=/Email Address\s*Password|Unlock System|Sign In/i.test(text);
        if(row.expectedVisible){
          expect(loginBounce,`${role} should remain authenticated on allowed route ${row.route}`).toBe(false);
          expect(gated,`${role} should not be permission-gated from canonical allowed route ${row.route}`).toBe(false);
          expect(text,`${role} allowed route ${row.route} should render expected content`).toMatch(spec.expect);
        }else{
          const privilegedLeak = spec.expect.test(text) && !gated;
          expect(privilegedLeak,`${role} must not receive working privileged surface ${row.route}; expected denial reason ${row.permissionReason}`).toBe(false);
        }
        if(role==='staff'){
          expect(text,`Staff route ${row.route} must not leak owner/platform actions`).not.toMatch(STAFF_ACTION_RE);
          if(!row.expectedVisible) expect(text,`Staff denied route ${row.route} must not leak privileged administrator text`).not.toMatch(STAFF_FORBIDDEN_RE);
        }
        report.push({role,route:row.route,expectedVisible:row.expectedVisible,gated,loginBounce,sample:text.slice(0,1800)});
      }
      await context.close();
    }
    await attachJson(testInfo,'30-exhaustive-role-route-matrix.json',{rows:report,total:report.length});
    expect(report.length,'All 4 roles x all 23 canonical routes must be exercised').toBe(4*23);
  });
});

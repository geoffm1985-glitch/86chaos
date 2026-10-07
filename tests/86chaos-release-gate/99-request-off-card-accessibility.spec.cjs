'use strict';
const {test,expect}=require('@playwright/test');
const {cardFixture}=require('../fixtures/request-off-card-fixture.cjs');
const {auditState}=require('./utils/exhaustive-ui-helpers.cjs');
const pending={id:'pending-request',employeeName:'Allen QA',date:'2026-10-07',status:'pending'};
async function showCard(page,fixture,row){
  const base=process.env.APP_URL||process.env.CHAOS_BASE_URL;
  if(!base)throw Error('Testing preview URL required for production styles');
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>link.href));
  expect(styles.length,'Deployed app must expose its actual stylesheet').toBeGreaterThan(0);
  await page.setContent('<!doctype html><html><head>'+styles.map(url=>'<link rel="stylesheet" href="'+url+'">').join('')+'</head><body><main>'+fixture.render(row)+'</main></body></html>',{waitUntil:'load'});
}
test.describe('Request Off card accessibility',()=>{
  test('pending manager request cards expose named actionable controls',async({page},testInfo)=>{
    await showCard(page,cardFixture(),pending);
    const select=page.getByRole('checkbox',{name:'Select Request Off for Allen QA on 2026-10-07',exact:true});await expect(select).toBeVisible();await select.check();await expect(select).toBeChecked();await select.uncheck();
    for(const action of ['Approve','Deny']){const button=page.getByRole('button',{name:action+' Request Off for Allen QA on 2026-10-07',exact:true});await expect(button).toBeVisible();await button.click({trial:true});const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(42);expect(box.height).toBeGreaterThanOrEqual(42);}
    await auditState(page,testInfo,'request-off-pending-card',{probeForms:false,probeSafeButtons:false,probeMutationActionability:true});
  });
  test('archived and employee cards preserve their allowed actions',async({page},testInfo)=>{
    await showCard(page,cardFixture(),{...pending,status:'archived'});await expect(page.getByRole('button',{name:'Restore',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Approve|Deny/})).toHaveCount(0);
    await auditState(page,testInfo,'request-off-archived-card',{probeForms:false,probeSafeButtons:false,probeMutationActionability:true});
    await showCard(page,cardFixture({canManage:false}),pending);await expect(page.getByRole('button',{name:'Cancel Request Off for 2026-10-07',exact:true})).toBeVisible();await expect(page.getByRole('checkbox')).toHaveCount(0);await expect(page.getByRole('button',{name:/Approve|Deny/})).toHaveCount(0);
  });
});

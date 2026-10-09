'use strict';
const {test,expect}=require('@playwright/test');
const {ownerLikeCreds,requireCreds,login,gotoTab,watchForProblems}=require('../86chaos-full-audit/utils/audit-helpers.cjs');
test.describe('98 intelligence connections 17.0.85',()=>{
  test('Today exposes real history coverage and explicit item matching without automatic imports',async({page})=>{
    test.setTimeout(6*60*1000);const account=ownerLikeCreds();requireCreds(account,'owner-like account');const problems=[];watchForProblems(page,problems);
    const imports=[];page.on('request',request=>{if(request.url().includes('/api/demand-history') && request.postDataJSON()?.action==='import')imports.push(request.postDataJSON());});
    await login(page,account.email,account.password);await gotoTab(page,'today',{settleMs:1500});
    await expect(page.getByTestId('demand-history-status')).toBeVisible();
    await expect(page.getByTestId('operational-history-sources')).toContainText(/readiness observations.*approved receiving rows.*classified error records/);
    await expect(page.getByTestId('save-readiness-observation')).toBeVisible();
    const review=page.getByTestId('item-sales-history-review');await review.getByRole('button',{name:'Review item sales history'}).click();
    await review.getByLabel('Item sales CSV').fill('date,item,quantity,sourceId,lineId\n2026-10-01,QA Unmapped Item,3,qa-preview,one');
    await review.getByRole('button',{name:'Preview and match rows'}).click();
    await expect(review.getByLabel('Recipe for sales row 1')).toHaveValue('');await expect(review.getByRole('button',{name:'Approve 1 reviewed sales rows'})).toBeDisabled();expect(imports).toEqual([]);
    await review.getByLabel('Item sales CSV').fill('date,item,quantity,sourceId,lineId\n2026-10-01,QA Unmapped Item,-1,qa-preview,one');await review.getByRole('button',{name:'Preview and match rows'}).click();await expect(review.getByRole('alert')).toContainText(/non-negative/);
    await expect(page.getByTestId('time-clock-awareness')).toContainText(/Punches and payroll are never changed/);
    await page.getByRole('button',{name:'Review Time Clock'}).click();await expect.poll(()=>new URL(page.url()).searchParams.get('tab')).toBe('labor');
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
  test('Schedule Copilot exposes forecast evidence and leaves publication under manager control',async({page})=>{
    test.setTimeout(6*60*1000);const account=ownerLikeCreds();requireCreds(account,'owner-like account');const problems=[];watchForProblems(page,problems);
    await login(page,account.email,account.password);await gotoTab(page,'schedule',{settleMs:1500});await page.getByRole('button',{name:'Open Copilot Tools',exact:true}).click();await page.getByRole('button',{name:'Demand forecast',exact:true}).click();
    const forecast=page.getByTestId('schedule-demand-forecast');await expect(forecast).toBeVisible();await expect(forecast).toContainText(/drafts only after review/);await expect(forecast).toContainText(/No automatic publishing/);
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
});

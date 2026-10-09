'use strict';
const {test,expect}=require('@playwright/test');
const {ownerLikeCreds,requireCreds,login,gotoTab,watchForProblems}=require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('99 operational completion 17.0.86',()=>{
  test('paged history retries a failed read and attendance stays explicitly reviewed',async({page})=>{
    test.setTimeout(6*60*1000);
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');
    const problems=[],writes=[];watchForProblems(page,problems);
    page.on('request',request=>{if(request.url().includes('/api/safe-write') && /attendance-policy|vendor-catalog-(import|revoke)/.test(request.postDataJSON()?.action || ''))writes.push(request.postDataJSON().action);});
    await login(page,account.email,account.password);await gotoTab(page,'today',{settleMs:1500});
    const history=page.getByTestId('history-source-review');await expect(history).toBeVisible();
    await expect(history).toContainText(/180-day history one page at a time/);
    let failed=false;
    await page.route('**/api/operational-history',route=>{
      if(route.request().postDataJSON()?.source==='prep' && !failed){failed=true;return route.abort('failed');}
      return route.continue();
    });
    await history.getByRole('button',{name:'Load prep history',exact:true}).click();
    const retry=history.getByRole('button',{name:'Retry prep history',exact:true});await expect(retry).toBeVisible();
    const response=page.waitForResponse(response=>response.url().includes('/api/operational-history') && response.request().postDataJSON()?.source==='prep');
    await retry.click();const loaded=await response;expect(loaded.status()).toBe(200);
    const body=await loaded.json();expect(body.ok).toBe(true);expect(body.readOnly).toBe(true);expect(body.scanned).toBeLessThanOrEqual(100);expect(body.window.days).toBe(180);
    await expect(history).toContainText(/Prep history: \d+ records · \d+ scanned/);
    const policy=page.getByTestId('attendance-policy-review');await expect(policy).toBeVisible();
    await expect(policy.getByLabel('Workspace attendance timezone')).not.toHaveValue('');
    await expect(policy.getByRole('button',{name:'Approve attendance review policy'})).toBeVisible();
    await expect(page.getByTestId('training-follow-up')).toBeVisible();
    expect(writes).toEqual([]);
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });

  test('vendor catalog preview exposes package evidence without changing purchasing records',async({page})=>{
    test.setTimeout(6*60*1000);
    const account=ownerLikeCreds();requireCreds(account,'owner-like account');
    const writes=[],problems=[];watchForProblems(page,problems);
    page.on('request',request=>{if(request.url().includes('/api/safe-write') && /vendor-catalog-(import|revoke)|invoice-approve/.test(request.postDataJSON()?.action || ''))writes.push(request.postDataJSON().action);});
    await login(page,account.email,account.password);await gotoTab(page,'inventory',{settleMs:1500});
    await page.getByRole('button',{name:'vendors',exact:true}).click();
    const catalog=page.getByTestId('vendor-catalog-review');await expect(catalog).toBeVisible();
    const vendor=catalog.getByLabel('Catalog vendor');await expect.poll(()=>vendor.locator('option').count()).toBeGreaterThan(1);
    const vendorId=await vendor.locator('option').nth(1).getAttribute('value');
    const response=page.waitForResponse(response=>response.url().includes('/api/safe-write') && response.request().postDataJSON()?.action==='vendor-catalog-list');
    await vendor.selectOption(vendorId);expect((await response).status()).toBe(200);
    await expect(vendor).toBeEnabled();
    await catalog.getByLabel('Vendor catalog CSV').fill('sku,name,packSize,purchaseUnit,unitPrice,sourceUrl\nQA-PREVIEW,QA Flour,1/10 LB,CS,20,https://vendor.example/flour');
    await catalog.getByRole('button',{name:'Preview catalog evidence'}).click();
    await expect(catalog).toContainText('QA-PREVIEW · QA Flour · 1/10 LB · CS · 20');
    await expect(catalog.getByRole('button',{name:'Approve 1 catalog rows'})).toBeVisible();
    expect(writes).toEqual([]);
    expect(problems.filter(row=>['page-error','http-5xx'].includes(row.type)),JSON.stringify(problems,null,2)).toEqual([]);
  });
});

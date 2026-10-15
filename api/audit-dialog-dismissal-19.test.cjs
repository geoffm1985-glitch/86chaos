'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const {dismissBlockingDialogs}=require('../tests/86chaos-full-audit/utils/audit-helpers.cjs');
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true});});
test.after(async()=>{await browser?.close();});
async function fixture(body,run){
 const page=await browser.newPage();
 try{await page.setContent('<!doctype html>'+body);await run(page);}finally{await page.close();}
}
const tour='<div class="chaos-modal-backdrop"><section role="dialog" aria-label="Welcome tour"><button data-chaos-modal-close="true" onclick="this.closest(\'.chaos-modal-backdrop\').remove()">Close Welcome tour</button><button onclick="this.closest(\'.chaos-modal-backdrop\').remove()">Skip and don\'t show again</button></section></div>';
test('an explicit tour-skip handler can complete dismissal during the pending header action',async()=>{
 await fixture(tour,async page=>{
  let skipped=0;
  await page.addLocatorHandler(page.getByRole('button',{name:"Skip and don't show again",exact:true}),async button=>{skipped++;await button.press('Enter');});
  const result=await dismissBlockingDialogs(page);
  assert.equal(result.ok,true);assert.equal(skipped,1);assert.equal(await page.getByRole('dialog').count(),0);
 });
});
test('an ordinary visible modal still closes through its authored header control',async()=>{
 await fixture(tour,async page=>{
  const result=await dismissBlockingDialogs(page);
  assert.equal(result.ok,true);assert.equal(result.dismissed.length,1);assert.equal(await page.getByRole('dialog').count(),0);
 });
});
test('a replacement consequential dialog remains blocked and is never automatically confirmed',async()=>{
 await fixture(tour,async page=>{
  await page.evaluate(()=>{window.confirmations=0;});
  await page.addLocatorHandler(page.getByRole('button',{name:"Skip and don't show again",exact:true}),async button=>{
   await button.press('Enter');
   await page.evaluate(()=>{document.body.insertAdjacentHTML('beforeend','<div class="chaos-modal-backdrop"><section role="dialog" aria-label="Publish schedule"><button onclick="window.confirmations++">Confirm publish</button></section></div>');});
  });
  const result=await dismissBlockingDialogs(page);
  assert.equal(result.ok,false);assert.equal(await page.evaluate(()=>window.confirmations),0);
  assert.equal(await page.getByRole('button',{name:'Confirm publish',exact:true}).isVisible(),true);
 });
});
test('a blocked header on the original visible modal retains the actionability failure',async()=>{
 await fixture(tour+'<div style="position:fixed;inset:0;z-index:999;background:white"></div>',async page=>{
  await assert.rejects(dismissBlockingDialogs(page),error=>error.name==='TimeoutError');
  assert.equal(await page.getByRole('dialog').isVisible(),true);
 });
});
test('an unknown close-action failure is fatal even when the original modal disappeared',async()=>{
 await fixture(tour,async page=>{
  // Inject the error at the awaited automation boundary. Throwing inside a
  // Playwright locator handler produces an out-of-band unhandled rejection,
  // rather than the action error this helper's catch must reject.
  const evaluateHandle=page.evaluateHandle.bind(page);
  page.evaluateHandle=async(...args)=>{
   const snapshot=await evaluateHandle(...args),getProperty=snapshot.getProperty.bind(snapshot);
   snapshot.getProperty=async name=>{
    const handle=await getProperty(name);
    if(name==='close'){
     const click=handle.click.bind(handle);
     handle.click=async options=>{await click(options);throw new Error('fixture close-action failure');};
    }
    return handle;
   };
   return snapshot;
  };
  await assert.rejects(dismissBlockingDialogs(page),/fixture close-action failure/);
  assert.equal(await page.getByRole('dialog').count(),0);
 });
});

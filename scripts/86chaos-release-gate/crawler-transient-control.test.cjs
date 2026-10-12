'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium,devices}=require('@playwright/test');
const {inspectControlGeometry,probeNonMutatingButtons}=require('../../tests/86chaos-release-gate/utils/exhaustive-ui-helpers.cjs');

for(const [name,options] of [['desktop',{}],['mobile',devices['Pixel 5']]]) {
  test(`${name}: crawler proves stable controls and handles expiring toast without hiding inspection errors`,async()=>{
    const browser=await chromium.launch();
    const context=await browser.newContext(options);
    const page=await context.newPage();
    try {
      await page.setContent('<button aria-label="Report a problem" style="width:100px;height:48px">Report</button>');
      const button=page.getByRole('button',{name:'Report a problem'});
      const visible=await inspectControlGeometry(button);
      assert.equal(visible.state,'visible');assert.equal(visible.box.width,100);assert.equal(visible.box.height,48);

      // Deterministically expire the actual DOM toast after the crawler's second
      // visibility check, exactly before the old boundingBox lookup would run.
      let checks=0;
      const wrappedPage={
        getByRole:(...args)=>{
          const locator=page.getByRole(...args).first();
          return {first:()=>new Proxy(locator,{get(target,key){
            if(key==='isVisible') return async(...args)=>{const result=await target.isVisible(...args);if(++checks===2) await page.locator('button').evaluate(node=>node.remove());return result;};
            const value=target[key];return typeof value==='function'?value.bind(target):value;
          }})};
        },url:()=>page.url()
      };
      const evidence=[];
      await probeNonMutatingButtons(wrappedPage,[{visible:true,role:'button',type:'button',label:'Report a problem'}],evidence);
      assert.equal(checks,2);assert.equal(evidence.length,1);
      assert.equal(evidence[0].action,'descriptor-replaced-before-geometry');
      assert.equal(evidence[0].state,'detached');
      assert(!evidence.some(item=>item.action==='navigation-control-visible-descriptor-proven'),'Expired toast must not count as proven geometry');

      await page.setContent('<button style="display:none">Hidden</button>');
      assert.equal((await inspectControlGeometry(page.locator('button'))).state,'hidden');
      await page.close();
      await assert.rejects(inspectControlGeometry(page.locator('button')),/closed/i,'Unexpected browser errors must propagate');
    } finally {await context.close();await browser.close();}
  });
}

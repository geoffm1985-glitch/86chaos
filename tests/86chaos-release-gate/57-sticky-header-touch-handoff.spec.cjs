const { test, expect } = require('@playwright/test');
const { ownerLikeCreds, requireCreds, login, gotoTab, attachJson } = require('../86chaos-full-audit/utils/audit-helpers.cjs');

test.describe('57 Schedule Builder direct-touch sticky header handoff', () => {
  test('mobile direct-touch drag keeps day header below sticky control deck', async ({ page }, testInfo) => {
    test.skip(!/mobile/i.test(testInfo.project.name), 'Direct-touch regression is mobile-specific.');
    const account=ownerLikeCreds(); requireCreds(account,'owner-like account');
    await login(page,account.email,account.password);
    await gotoTab(page,'schedule',{ settleMs:1400,maxText:50000 });
    const deck=page.getByTestId('schedule-builder-control-deck').first();
    const header=page.getByTestId('schedule-builder-sticky-day-header').first();
    const headerScroll=page.getByTestId('schedule-builder-header-scroll').first();
    await expect(deck).toBeVisible({timeout:15000}); await expect(header).toBeVisible({timeout:15000});
    await page.evaluate(()=>{
      const shell=document.querySelector('.desktop-pro-shell[data-active-tab="schedule"] .app-content-shell');
      if(shell) shell.scrollTop=Math.min(shell.scrollHeight-shell.clientHeight,Math.max(shell.scrollTop,700));
    });
    await page.waitForTimeout(250);
    const box=await headerScroll.boundingBox(); expect(box).toBeTruthy();
    const x=box.x+Math.min(box.width-20,Math.max(40,box.width*.55));
    const y=box.y+Math.min(box.height-8,Math.max(8,box.height*.5));
    const before=await page.evaluate(()=>{const s=document.querySelector('.desktop-pro-shell[data-active-tab="schedule"] .app-content-shell');return {scrollTop:s?.scrollTop||0};});
    await page.evaluate(({x,y})=>{
      const target=document.elementFromPoint(x,y);
      const touch=(cx,cy)=>({clientX:cx,clientY:cy});
      const fire=(type,cx,cy)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[touch(cx,cy)]});target.dispatchEvent(e);};
      fire('touchstart',x,y); fire('touchmove',x,y-60); fire('touchmove',x,y-120); fire('touchend',x,y-120);
    },{x,y});
    await page.waitForTimeout(120);
    const after=await page.evaluate(()=>{
      const deck=document.querySelector('[data-testid="schedule-builder-control-deck"]')?.getBoundingClientRect();
      const header=document.querySelector('[data-testid="schedule-builder-sticky-day-header"]')?.getBoundingClientRect();
      const shell=document.querySelector('.desktop-pro-shell[data-active-tab="schedule"] .app-content-shell');
      return {scrollTop:shell?.scrollTop||0,deckBottom:deck?.bottom??null,headerTop:header?.top??null,headerBottom:header?.bottom??null};
    });
    expect(after.scrollTop).toBeGreaterThan(before.scrollTop);
    expect(after.headerTop).toBeGreaterThanOrEqual((after.deckBottom??0)-8);
    expect(after.headerBottom).toBeGreaterThan(after.headerTop);
    await attachJson(testInfo,'57-sticky-header-touch-handoff.json',{project:testInfo.project.name,before,after});
  });
});

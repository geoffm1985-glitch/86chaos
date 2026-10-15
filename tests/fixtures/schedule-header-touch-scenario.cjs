'use strict';
const {expect}=require('@playwright/test');

// Exercise the application's explicit touch-to-vertical-scroll handoff. These
// synthetic TouchEvents verify that handler; physical-device acceptance is separate.
async function verifyHeaderTouchHandoff(page) {
  const header=page.getByTestId('schedule-builder-header-scroll').first();
  await expect(header).toBeVisible();
  await header.evaluate(element=>{
    const sticky=element.parentElement;
    let host=sticky.parentElement;
    while(host){const style=getComputedStyle(host);if(/auto|scroll/.test(style.overflowY)&&host.scrollHeight>host.clientHeight+8)break;host=host.parentElement;}
    if(!host)throw new Error('Schedule header needs its actual vertical scroll host');
    const offset=parseFloat(getComputedStyle(sticky).top)||0;
    const delta=sticky.getBoundingClientRect().top-host.getBoundingClientRect().top-offset+24;
    host.scrollTop=Math.max(0,Math.min(host.scrollHeight-host.clientHeight-120,host.scrollTop+delta));
  });
  const read=()=>header.evaluate(element=>{
    const sticky=element.parentElement;
    let host=sticky.parentElement;
    while(host){const style=getComputedStyle(host);if(/auto|scroll/.test(style.overflowY)&&host.scrollHeight>host.clientHeight+8)break;host=host.parentElement;}
    const rect=element.getBoundingClientRect(),hostRect=host.getBoundingClientRect();
    const x=rect.x+rect.width*.55,y=rect.y+rect.height*.5;
    return {scrollTop:host.scrollTop,maximum:host.scrollHeight-host.clientHeight,x,y,reachable:element.contains(document.elementFromPoint(x,y)),headerTop:rect.top,headerBottom:rect.bottom,hostTop:hostRect.top,hostBottom:hostRect.bottom,stickyOffset:parseFloat(getComputedStyle(sticky).top)||0};
  });
  await expect.poll(async()=>(await read()).reachable,'The gesture must hit the visible day/date header, not a footer or overlay').toBe(true);
  const before=await read();
  expect(before.headerTop).toBeGreaterThanOrEqual(before.hostTop);
  expect(before.headerBottom).toBeLessThanOrEqual(before.hostBottom);
  expect(before.maximum-before.scrollTop,'Leave room for the complete vertical gesture').toBeGreaterThanOrEqual(120);
  await header.evaluate((element,{x,y})=>{
    const target=document.elementFromPoint(x,y);
    if(!element.contains(target))throw new Error('Touch target moved off the schedule header');
    const fire=(type,cy)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:cy}]});target.dispatchEvent(event);};
    fire('touchstart',y);fire('touchmove',y-60);fire('touchmove',y-120);fire('touchend',y-120);
  },before);
  await expect.poll(async()=>(await read()).scrollTop).toBeGreaterThan(before.scrollTop);
  const after=await read();
  expect(after.reachable).toBe(true);
  expect(Math.abs(after.headerTop-before.headerTop),'The day/date header must stay pinned during a vertical gesture').toBeLessThanOrEqual(2);
  return {before,after};
}
module.exports={verifyHeaderTouchHandoff};

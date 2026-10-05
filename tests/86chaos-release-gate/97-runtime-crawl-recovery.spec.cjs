'use strict';
const {test,expect}=require('@playwright/test');
const {applyStatePath,recoverSiblingStatePath}=require('./utils/exhaustive-ui-helpers.cjs');

function delayedClickAcknowledgement(page){
  return new Proxy(page,{get(target,key){
    if(key==='getByRole') return (...args)=>{
      const locator=target.getByRole(...args);
      if(args[0]!=='button') return locator;
      return new Proxy(locator,{get(value,prop){
        if(prop==='nth') return index=>{
          const candidate=value.nth(index);
          return new Proxy(candidate,{get(control,method){
            if(method==='click') return async options=>{await control.click(options);throw new Error('Timeout waiting for click acknowledgement after role replacement');};
            const member=control[method];return typeof member==='function'?member.bind(control):member;
          }});
        };
        const member=value[prop];return typeof member==='function'?member.bind(value):member;
      }});
    };
    const member=target[key];return typeof member==='function'?member.bind(target):member;
  }});
}

test.describe('runtime crawl bounded role replacement recovery',()=>{
  test('a completed Drag Board click survives a delayed acknowledgement without waiting on the vanished button',async({page})=>{
    await page.setContent(`<button onclick="window.activations=(window.activations||0)+1;this.setAttribute('role','tab');this.setAttribute('aria-selected','true')">Drag Board</button>`);
    const started=Date.now();
    const result=await applyStatePath(delayedClickAcknowledgement(page),['Drag Board']);
    expect(result.ok).toBe(true);
    expect(result.steps[0].active).toBe(true);
    expect(await page.evaluate(()=>window.activations)).toBe(1);
    expect(Date.now()-started).toBeLessThan(8000);
  });
  test('a vanished control without selected-state evidence fails promptly instead of claiming coverage',async({page})=>{
    await page.setContent(`<button onclick="this.remove()">Drag Board</button>`);
    const started=Date.now();
    await expect(applyStatePath(delayedClickAcknowledgement(page),['Drag Board'])).rejects.toThrow(/disappeared before activation/);
    expect(Date.now()-started).toBeLessThan(8000);
  });
  test('sibling recovery visits real tabs without reopening and closing their shared parent',async({page})=>{
    await page.setContent(`<button aria-label="Schedule Builder" onclick="window.parentClicks=(window.parentClicks||0)+1">Schedule Builder</button><button role="tab" aria-selected="false" onclick="this.setAttribute('aria-selected','true')">Coverage</button><button role="tab" aria-selected="false" onclick="this.setAttribute('aria-selected','true')">Drag Board</button>`);
    const traversal=await recoverSiblingStatePath(page,['Schedule Builder','Coverage'],['Schedule Builder','Drag Board'],'schedule');
    expect(traversal).toEqual(['Drag Board']);
    expect((await applyStatePath(page,traversal)).ok).toBe(true);
    expect(await page.evaluate(()=>window.parentClicks||0)).toBe(0);
    await expect(page.getByRole('tab',{name:'Drag Board'})).toHaveAttribute('aria-selected','true');
  });
});

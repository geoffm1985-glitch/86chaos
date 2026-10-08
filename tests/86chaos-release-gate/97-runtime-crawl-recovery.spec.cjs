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
  test('sibling navigation cancels only the exited modal and never publishes or clicks background exits',async({page})=>{
    await page.setContent(`<button onclick="window.backgroundCancel=true">Cancel</button><button onclick="window.onboarding=true">Onboarding</button><div class="chaos-modal-backdrop" role="presentation" style="position:fixed;inset:0;background:white;z-index:60"><h2>Publish a Training Manual</h2><button onclick="window.published=true">Publish Manual</button><button onclick="window.cancelled=true;this.parentElement.remove()">Cancel</button></div>`);
    const traversal=await recoverSiblingStatePath(page,['Training Manuals','Publish Manual'],['Onboarding'],'hr-training');
    expect(traversal).toEqual(['Onboarding']);
    expect((await applyStatePath(page,traversal)).ok).toBe(true);
    expect(await page.evaluate(()=>({cancelled:!!window.cancelled,published:!!window.published,background:!!window.backgroundCancel,onboarding:!!window.onboarding}))).toEqual({cancelled:true,published:false,background:false,onboarding:true});
  });
  test('a requested child inside the current modal stays available until its state is audited',async({page})=>{
    await page.setContent(`<button onclick="window.background=true">Details</button><div class="chaos-modal-backdrop" role="dialog" style="position:fixed;inset:0;background:white;z-index:60"><button role="tab" aria-selected="false" onclick="this.setAttribute('aria-selected','true')">Details</button><button onclick="window.cancelled=true;this.parentElement.remove()">Cancel</button></div>`);
    const traversal=await recoverSiblingStatePath(page,['Training Manuals','Publish Manual'],['Training Manuals','Publish Manual','Details'],'hr-training');
    expect(traversal).toEqual(['Details']);
    expect((await applyStatePath(page,traversal)).ok).toBe(true);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('tab',{name:'Details'})).toHaveAttribute('aria-selected','true');
    expect(await page.evaluate(()=>!!window.cancelled||!!window.background)).toBe(false);
  });
  test('a modal without a safe exit remains a failure instead of forcing a background click',async({page})=>{
    await page.setContent(`<button onclick="window.onboarding=true">Onboarding</button><div class="chaos-modal-backdrop" style="position:fixed;inset:0;background:white;z-index:60"><button onclick="window.published=true">Publish Manual</button></div>`);
    await expect(recoverSiblingStatePath(page,['Training Manuals','Publish Manual'],['Onboarding'],'hr-training')).rejects.toThrow(/Cannot safely leave nested state modal/);
    expect(await page.evaluate(()=>!!window.published||!!window.onboarding)).toBe(false);
  });

  test('sibling navigation uses the shared Modal titled close button without publishing or clicking a background exit', async ({page}) => {
    await page.setContent(`<button aria-label="Close Background" onclick="window.background=true">Close</button><button onclick="window.onboarding=true">Onboarding</button><div class="chaos-modal-backdrop" role="presentation" style="position:fixed;inset:0;background:white;z-index:60"><div role="dialog" aria-modal="true" aria-labelledby="manual-title"><h3 id="manual-title">Publish a Training Manual</h3><button type="button" aria-label="Close Publish a Training Manual" onclick="window.modalWasClosed=true;this.closest('.chaos-modal-backdrop').remove()">×</button><button onclick="window.published=true">Publish Manual</button></div></div>`);
    const traversal = await recoverSiblingStatePath(page, ['Training Manuals', 'Publish Manual'], ['Onboarding'], 'hr-training');
    expect(traversal).toEqual(['Onboarding']);
    expect((await applyStatePath(page, traversal)).ok).toBe(true);
    expect(await page.evaluate(() => ({closed:!!window.modalWasClosed, published:!!window.published, background:!!window.background, onboarding:!!window.onboarding}))).toEqual({closed:true, published:false, background:false, onboarding:true});
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  test('sibling navigation skips hidden and disabled modal exits to use the enabled titled close control', async ({page}) => {
    await page.setContent('<button>Onboarding</button><div class="chaos-modal-backdrop" style="position:fixed;inset:0;background:white;z-index:60"><button style="display:none" onclick="window.wrong=true">Cancel</button><button disabled onclick="window.wrong=true">Cancel</button><button aria-label="Close Publish a Training Manual" onclick="window.modalWasClosed=true;this.parentElement.remove()">×</button><button onclick="window.published=true">Publish Manual</button></div>');
    expect(await recoverSiblingStatePath(page, ['Training Manuals','Publish Manual'], ['Onboarding'], 'hr-training')).toEqual(['Onboarding']);
    expect(await page.evaluate(() => ({closed:!!window.modalWasClosed, wrong:!!window.wrong, published:!!window.published}))).toEqual({closed:true, wrong:false, published:false});
    await expect(page.locator('.chaos-modal-backdrop')).toHaveCount(0);
  });

  test('an Event click with delayed acknowledgement proves its newly opened dialog without retrying the covered trigger', async ({page}) => {
    await page.setContent(`<button aria-label="Event" onclick="window.eventActivations=(window.eventActivations||0)+1;document.querySelector('#event-modal').style.display='block'">Event</button><div id="event-modal" class="chaos-modal-backdrop" role="presentation" style="display:none;position:fixed;inset:0;background:white;z-index:60"><div role="dialog" aria-modal="true" aria-labelledby="event-title"><h3 id="event-title">Add Special Event</h3><button aria-label="Close Add Special Event" onclick="window.eventModalWasClosed=true;document.querySelector('#event-modal').style.display='none'">×</button><button onclick="window.eventSaved=true">Save Event</button></div></div>`);
    const started = Date.now();
    const result = await applyStatePath(delayedClickAcknowledgement(page), [/^Event$/i]);
    expect(result.ok).toBe(true);
    expect(result.steps[0].active).toBe(true);
    expect(result.steps[0].openedDialogTitle).toBe('Add Special Event');
    expect(await page.evaluate(() => ({activations:window.eventActivations, closed:!!window.eventModalWasClosed, saved:!!window.eventSaved}))).toEqual({activations:1, closed:true, saved:false});
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(Date.now()-started).toBeLessThan(8000);
  });

  for (const [label, title] of [
  [
    "Edit Presets",
    "Manage Custom Shifts"
  ],
  [
    "Copy Month",
    "Auto-Populate Schedule"
  ],
  [
    "Publish Manual",
    "Publish a Training Manual"
  ],
  [
    "Assign Checklist",
    "Assign Onboarding Checklist"
  ],
  [
    "Add Certification",
    "Add Certification"
  ],
  [
    "Add Confidential Note",
    "Add Confidential Performance Note"
  ]
]) {
    test('a '+label+' click with delayed acknowledgement proves its declared dialog without repeating the action', async ({page}) => {
      await page.setContent(`<button aria-label="${label}" onclick="window.stateActivations=(window.stateActivations||0)+1;document.querySelector('#state-modal').style.display='block'">${label}</button><button>Onboarding</button><div id="state-modal" class="chaos-modal-backdrop" role="presentation" style="display:none;position:fixed;inset:0;background:white;z-index:60"><div role="dialog" aria-modal="true" aria-labelledby="state-title"><h3 id="state-title">${title}</h3><button type="button" aria-label="Close ${title}" onclick="window.stateModalWasClosed=true;document.querySelector('#state-modal').style.display='none'">×</button><button onclick="window.stateSaved=true">Save</button></div></div>`);
      const started = Date.now();
      const result = await applyStatePath(delayedClickAcknowledgement(page), [label]);
      expect(result.ok).toBe(true);
      expect(result.steps[0].active).toBe(true);
      expect(result.steps[0].openedDialogTitle).toBe(title);
      // Some forms intentionally stay open until sibling recovery safely exits.
      await recoverSiblingStatePath(page, [label], ['Onboarding'], 'hr-training');
      expect(await page.evaluate(() => ({activations:window.stateActivations, closed:!!window.stateModalWasClosed, saved:!!window.stateSaved}))).toEqual({activations:1, closed:true, saved:false});
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(Date.now()-started).toBeLessThan(8000);
    });
  }

  test('runtime coverage merges identical script captures across a real document reload',async({page})=>{
    const {summarizeScriptCoverage}=require('./utils/runtime-coverage-summary.cjs');
    const scriptUrl='http://127.0.0.1:3000/runtime-coverage-reload-fixture.js';
    const source='window.fixtureRuns=(window.fixtureRuns||0)+1; function coverageWork(){return 42;} if(window.location.search.includes("execute")) coverageWork();';
    await page.route('http://127.0.0.1:3000/runtime-coverage-reload-fixture**',route=>route.fulfill(route.request().url().includes('.js')?{contentType:'application/javascript',body:source}:{contentType:'text/html',body:'<script src="'+scriptUrl+'"></script>'}));
    await page.coverage.startJSCoverage({resetOnNavigation:false,reportAnonymousScripts:false});
    await page.goto('http://127.0.0.1:3000/runtime-coverage-reload-fixture?execute');
    await expect.poll(()=>page.evaluate(()=>window.fixtureRuns)).toBe(1);
    // V8 can discard the old document's script before a final coverage snapshot.
    // Capture each real document while it is alive, then merge the raw records.
    const beforeReload=(await page.coverage.stopJSCoverage()).filter(entry=>entry.url===scriptUrl);
    expect(beforeReload).toHaveLength(1);
    expect(beforeReload[0].source).toBe(source);
    expect(beforeReload[0].functions.find(fn=>fn.functionName==='coverageWork')?.ranges[0].count).toBeGreaterThan(0);
    // Clear the old document before enabling the second profiling session.
    await page.goto('about:blank');
    await page.coverage.startJSCoverage({resetOnNavigation:false,reportAnonymousScripts:false});
    await page.goto('http://127.0.0.1:3000/runtime-coverage-reload-fixture');
    await expect.poll(()=>page.evaluate(()=>window.fixtureRuns)).toBe(1);
    const afterReload=(await page.coverage.stopJSCoverage()).filter(entry=>entry.url===scriptUrl);
    expect(afterReload).toHaveLength(1);
    expect(afterReload[0].source).toBe(source);
    expect(afterReload[0].functions.find(fn=>fn.functionName==='coverageWork')?.ranges[0].count).toBe(0);
    const captures=[...beforeReload,...afterReload];
    const combined=summarizeScriptCoverage(captures);
    expect(combined.perScript).toHaveLength(1);
    expect(combined.aggregation).toEqual({rawScriptSamples:2,uniqueScriptVersions:1,duplicateScriptSamplesMerged:1});
    expect(combined.perScript[0].sampleCount).toBe(2);
    expect(combined.totals.totalBytes).toBe(Buffer.byteLength(source,'utf8'));
    expect(combined.perScript[0].uncoveredFunctions).not.toContain('coverageWork');
    expect(combined.totals.coveredBytes).toBeGreaterThanOrEqual(Math.max(...captures.map(entry=>summarizeScriptCoverage([entry]).totals.coveredBytes)));
  });

});

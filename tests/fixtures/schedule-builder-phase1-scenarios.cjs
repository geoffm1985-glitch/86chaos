'use strict';
const {expect}=require('@playwright/test');
const {ownerLikeCreds,login,gotoTab,dismissBlockingDialogs,readSeedReport,ALLOW_MUTATION,RUN_ID}=require('../86chaos-full-audit/utils/audit-helpers.cjs');
const {workspaceEvidence,workspaceEditable,shiftDateBy}=require('../../src/core/scheduleWorkspace.shared.js');

async function openWorkspace(page) {
  const seed=readSeedReport();
  expect(ALLOW_MUTATION,'These workflows require the canonical isolated QA workspace').toBe(true);
  expect(seed?.ok).toBe(true);expect(seed.runId).toBe(RUN_ID);expect(seed.restaurantId).toMatch(/^qa_/);
  const account=ownerLikeCreds();expect(Boolean(account.email && account.password)).toBe(true);
  await login(page,account.email,account.password);await gotoTab(page,'schedule',{force:true});await dismissBlockingDialogs(page);
  const workspace=page.getByTestId('schedule-workspace');
  if(!await workspace.isVisible())await page.getByRole('button',{name:/^Schedule Builder$/i}).first().click();
  await expect(workspace).toBeVisible();await expect(workspace.getByRole('status').first()).toContainText('Schedule loaded from the server');
  await expect(workspace.getByRole('button',{name:'Monthly & advanced tools',exact:true})).toBeVisible();
  await expect(workspace.getByRole('button',{name:'Undo',exact:true})).toBeVisible();
  return{seed,workspace,mobile:await page.getByTestId('mobile-schedule-calendar').isVisible(),headers:null,ids:new Set()};
}
async function mutate(page,ctx,action) {
  const waiting=page.waitForResponse(response=>response.url().endsWith('/api/schedule-workspace') && response.request().method()==='POST' && JSON.parse(response.request().postData() || '{}').action!=='read');
  await action();const response=await waiting;const result=await response.json();
  expect(response.status(),result.error || 'Scheduling API failed').toBe(200);expect(result.ok).toBe(true);expect(result.authoritative).toBe(true);
  const headers=await response.request().allHeaders();
  ctx.headers=Object.fromEntries(Object.entries(headers).filter(([key])=>['authorization','x-firebase-appcheck','content-type'].includes(key.toLowerCase())));
  for(const row of result.results || [])ctx.ids.add(row.id);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return result;
}
async function authoritativeRows(page,ctx,ids=[...ctx.ids]) {
  const response=await page.request.post('/api/schedule-workspace',{headers:ctx.headers,data:{action:'read',restaurantId:ctx.seed.restaurantId,ids}});
  expect(response.status()).toBe(200);const body=await response.json();expect(body.authoritative).toBe(true);return body.shifts;
}
async function cleanup(page,ctx) {
  if(!ctx?.headers || !ctx.ids.size)return;
  const rows=await authoritativeRows(page,ctx);
  const changes=rows.filter(row=>row.exists!==false).map(row=>({kind:'delete',id:row.id,expected:workspaceEvidence(row)}));
  if(!changes.length)return;
  const response=await page.request.post('/api/schedule-workspace',{headers:ctx.headers,data:{restaurantId:ctx.seed.restaurantId,operationId:'qa_cleanup_'+require('node:crypto').randomUUID(),changes,acknowledgedWarnings:true,confirmedPublished:true,reason:'Remove this test workflow own isolated QA shifts'}});
  expect(response.status(),'QA workflow cleanup must be authoritative').toBe(200);
  expect((await authoritativeRows(page,ctx)).every(row=>row.exists===false)).toBe(true);
}
async function revealDate(page,ctx,date) {
  if(ctx.mobile)await page.locator(`.sw-day-strip button[data-date="${date}"]`).click();
}
function card(page,ctx,id) {return page.locator(`${ctx.mobile?'.sw-mobile-calendar':'.sw-desktop-scroll'} [data-shift-id="${id}"]`);}
async function createShift(page,ctx,dateOverride='') {
  await ctx.workspace.getByRole('button',{name:'Add Shift',exact:true}).click();
  if(dateOverride)await page.getByTestId('shift-editor-date').fill(dateOverride);
  const date=await page.getByTestId('shift-editor-date').inputValue();
  await page.getByTestId('shift-editor-employee').selectOption({label:'Quincy Owner QA'});
  await page.getByTestId('shift-editor-role').selectOption({label:'Owner'});
  await page.getByTestId('shift-editor-start').fill('16:00');await page.getByTestId('shift-editor-end').fill('21:00');
  await page.getByTestId('shift-editor-notes').fill('Phase 1 owned regression shift');await page.getByLabel('Break minutes',{exact:true}).fill('30');
  await expect(page.getByRole('spinbutton',{name:'Break minutes',exact:true})).toHaveValue('30');
  await expect(page.getByRole('combobox',{name:'Assigned employee',exact:true})).toHaveValue(await page.getByTestId('shift-editor-employee').inputValue());
  const result=await mutate(page,ctx,()=>page.getByTestId('shift-editor-save').click());
  expect(result.results).toHaveLength(1);const row=result.results[0].after;
  expect(row.restaurantId).toBe(ctx.seed.restaurantId);expect(row.isPublished).toBe(false);expect(row.breakMinutes).toBe(30);
  if(!dateOverride){await revealDate(page,ctx,date);await expect(card(page,ctx,row.id)).toBeVisible();}return row;
}
async function verifyEditingRecovery({page}) {
  const ctx=await openWorkspace(page);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    const row=await createShift(page,ctx);
    await card(page,ctx,row.id).getByRole('button',{name:/Edit shift/}).click();
    const editor=page.getByRole('dialog',{name:'Edit shift',exact:true});await expect(editor).toBeVisible();
    await page.getByTestId('shift-editor-end').fill('22:00');await page.getByTestId('shift-editor-notes').fill('Reviewed dinner extension');await page.getByLabel('Paid break',{exact:true}).check();
    await mutate(page,ctx,()=>page.getByTestId('shift-editor-save').click());
    expect((await authoritativeRows(page,ctx))[0]).toMatchObject({endTime:'22:00',notes:'Reviewed dinner extension',paidBreak:true});
    await mutate(page,ctx,()=>ctx.workspace.getByRole('button',{name:'Undo',exact:true}).click());expect((await authoritativeRows(page,ctx))[0].endTime).toBe('21:00');
    await mutate(page,ctx,()=>ctx.workspace.getByRole('button',{name:'Redo',exact:true}).click());expect((await authoritativeRows(page,ctx))[0].endTime).toBe('22:00');
    await page.reload();await expect(ctx.workspace).toBeVisible();await revealDate(page,ctx,row.date);await card(page,ctx,row.id).getByRole('button',{name:/Edit shift/}).click();
    await expect(page.getByTestId('shift-editor-notes')).toHaveValue('Reviewed dinner extension');
    let mutations=0;const count=request=>{if(request.url().endsWith('/api/schedule-workspace') && JSON.parse(request.postData() || '{}').action!=='read')mutations++;};page.on('request',count);
    await page.getByTestId('shift-editor-save').click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(mutations).toBe(0);page.off('request',count);
    await card(page,ctx,row.id).getByRole('button',{name:/Edit shift/}).click();await page.getByRole('button',{name:'Delete shift',exact:true}).click();
    expect((await authoritativeRows(page,ctx))[0].exists).not.toBe(false);
    await mutate(page,ctx,()=>page.getByTestId('schedule-confirm-preview').click());expect((await authoritativeRows(page,ctx))[0].exists).toBe(false);
    await mutate(page,ctx,()=>ctx.workspace.getByRole('button',{name:'Undo',exact:true}).click());expect((await authoritativeRows(page,ctx))[0].notes).toBe('Reviewed dinner extension');
    expect(errors).toEqual([]);
  } finally {await cleanup(page,ctx);}
}
async function verifyMoveCopy({page}) {
  const ctx=await openWorkspace(page);
  try {
    const row=await createShift(page,ctx);
    if(ctx.mobile) {
      await card(page,ctx,row.id).getByRole('button',{name:/Edit shift/}).click();await page.getByRole('button',{name:'Reassign',exact:true}).click();
      await expect(page.getByTestId('shift-editor-employee')).toBeFocused();await page.getByTestId('shift-editor-employee').selectOption({label:'Mara Manager QA'});
      await mutate(page,ctx,()=>page.getByTestId('shift-editor-save').click());
    } else {
      const employeeId=await page.locator('.sw-desktop-scroll tr').filter({has:page.getByText('Mara Manager QA',{exact:true})}).locator('[data-employee-id]').first().getAttribute('data-employee-id');
      await card(page,ctx,row.id).dragTo(page.locator(`.sw-desktop-scroll [data-date="${row.date}"][data-employee-id="${employeeId}"]`));
      await expect(page.getByRole('dialog',{name:'Preview moved shifts'})).toBeVisible();expect((await authoritativeRows(page,ctx))[0].employeeId).toBe(row.employeeId);
      await mutate(page,ctx,()=>page.getByTestId('schedule-confirm-preview').click());
    }
    const moved=(await authoritativeRows(page,ctx))[0];expect(moved.employeeId).not.toBe(row.employeeId);expect(moved.date).toBe(row.date);
    await card(page,ctx,row.id).getByRole('checkbox').check();await ctx.workspace.getByRole('button',{name:'Copy Selected',exact:true}).click();
    const destination=shiftDateBy(row.date,row.date===await page.locator('.sw-day-strip button').last().getAttribute('data-date')?-1:1);
    await page.getByRole('dialog').getByLabel('Move the first selected shift to').fill(destination);await page.getByRole('button',{name:'Preview changes',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Preview copied shifts'})).toBeVisible();
    const copied=await mutate(page,ctx,()=>page.getByTestId('schedule-confirm-preview').click());expect(copied.results[0].id).not.toBe(row.id);expect(copied.results[0].after.date).toBe(destination);
    expect((await authoritativeRows(page,ctx,[row.id]))[0].date).toBe(row.date);
    await mutate(page,ctx,()=>ctx.workspace.getByRole('button',{name:'Undo',exact:true}).click());
    expect((await authoritativeRows(page,ctx,[copied.results[0].id]))[0].exists).toBe(false);
    await mutate(page,ctx,()=>ctx.workspace.getByRole('button',{name:'Undo',exact:true}).click());expect((await authoritativeRows(page,ctx,[row.id]))[0].employeeId).toBe(row.employeeId);
  } finally {await cleanup(page,ctx);}
}
async function verifyInterruptedSave({page,context}) {
  const ctx=await openWorkspace(page);
  try {
    const row=await createShift(page,ctx);await card(page,ctx,row.id).getByRole('button',{name:/Edit shift/}).click();await page.getByTestId('shift-editor-notes').fill('Explicit retry retains its operation identity');
    const attempts=[];let abort=true;
    await page.route('**/api/schedule-workspace',async route=>{const body=route.request().postDataJSON();if(body.action==='read')return route.continue();attempts.push(body);if(abort){abort=false;return route.abort('failed');}return route.continue();});
    await page.getByTestId('shift-editor-save').click();await expect(ctx.workspace.getByRole('status').first()).toContainText('Save outcome unknown');
    expect(attempts).toHaveLength(1);await context.setOffline(true);await context.setOffline(false);
    await expect(page.getByRole('button',{name:'Review outcome and retry the same saved request'})).toBeEnabled();expect(attempts).toHaveLength(1);
    await mutate(page,ctx,()=>page.getByRole('button',{name:'Review outcome and retry the same saved request'}).click());
    expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);expect((await authoritativeRows(page,ctx))[0].notes).toBe('Explicit retry retains its operation identity');
    await page.unroute('**/api/schedule-workspace');
  } finally {await context.setOffline(false);await cleanup(page,ctx);}
}
async function verifyLayoutAndKeyboard({page}) {
  const ctx=await openWorkspace(page);
  if(ctx.mobile) {
    for(const button of await ctx.workspace.locator('.sw-toolbar button').all()){const rect=await button.boundingBox();expect(rect.height).toBeGreaterThanOrEqual(44);expect(rect.width).toBeGreaterThanOrEqual(44);}
    const strip=page.locator('.sw-day-strip');await strip.scrollIntoViewIfNeeded();const before=await strip.boundingBox();
    await page.getByTestId('mobile-schedule-calendar').evaluate(element=>{element.scrollTop=180;});
    const after=await strip.boundingBox();expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(2);
    const filter=ctx.workspace.getByText('Filter schedule',{exact:true});await filter.click();await ctx.workspace.getByLabel('Employee',{exact:true}).selectOption({label:'Quincy Owner QA'});
    await page.getByRole('button',{name:'Next day',exact:true}).click();await expect(ctx.workspace.getByLabel('Employee',{exact:true})).not.toHaveValue('');
  } else {
    const scroll=page.getByTestId('weekly-schedule-scroll');await scroll.scrollIntoViewIfNeeded();
    const header=scroll.locator('thead th').nth(1),label=scroll.locator('tbody tr:not(.sw-role-group)>th').first();const before=await header.boundingBox(),left=await label.boundingBox();
    const moved=await scroll.evaluate(element=>{element.scrollTop=180;element.scrollLeft=160;return{top:element.scrollTop,left:element.scrollLeft};});expect(moved.top).toBeGreaterThan(0);
    const after=await header.boundingBox(),labelAfter=await label.boundingBox();expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(2);expect(Math.abs(labelAfter.x-left.x)).toBeLessThanOrEqual(2);
    expect(Math.abs((before.x-after.x)-moved.left)).toBeLessThanOrEqual(2);
  }
  await ctx.workspace.getByRole('button',{name:'Add Shift',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add shift',exact:true}),first=dialog.locator('button').first(),last=dialog.getByRole('button',{name:'Cancel',exact:true});
  await last.focus();await page.keyboard.press('Tab');await expect(first).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(last).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
}
async function verifyReviewedMonthRecovery({page}) {
  const ctx=await openWorkspace(page);
  try {
    const row=await createShift(page,ctx,'2031-02-12');
    const reviewResponse=await page.request.post('/api/schedule-shift-delete',{headers:ctx.headers,data:{action:'review-month',restaurantId:ctx.seed.restaurantId,month:'2031-02'}});
    expect(reviewResponse.status()).toBe(200);const review=await reviewResponse.json();expect(review.count,'Only this workflow owns shifts in the isolated future month').toBe(1);
    const addedResponse=await page.request.post('/api/schedule-workspace',{headers:ctx.headers,data:{restaurantId:ctx.seed.restaurantId,operationId:'qa_after_review_'+require('node:crypto').randomUUID(),acknowledgedWarnings:true,changes:[{kind:'create',patch:{...workspaceEditable(row),date:'2031-02-13',notes:'Added after frozen month review'}}]}});
    expect(addedResponse.status()).toBe(200);const added=await addedResponse.json();const later=added.results[0].after;ctx.ids.add(later.id);
    const body={action:'clear-month',restaurantId:ctx.seed.restaurantId,reviewId:review.reviewId,confirmed:true,reason:'Regression manager confirmed reviewed month clear'};
    for(let attempt=0;attempt<2;attempt++){
      const response=await page.request.post('/api/schedule-shift-delete',{headers:ctx.headers,data:body});expect(response.status()).toBe(200);expect(await response.json()).toMatchObject({ok:true,done:true,deletedCount:1,remainingCount:0});
      const rows=await authoritativeRows(page,ctx,[row.id,later.id]);expect(rows[0].exists).toBe(false);expect(rows[1].notes).toBe('Added after frozen month review');
    }
    const restore=await page.request.post('/api/schedule-shift-delete',{headers:ctx.headers,data:{...body,action:'restore-cleared-month',reason:'Regression manager confirmed reviewed restoration'}});
    expect(restore.status()).toBe(200);expect(await restore.json()).toMatchObject({ok:true,done:true,restoredCount:1});
    const restored=await authoritativeRows(page,ctx,[row.id,later.id]);expect(restored[0]).toMatchObject({date:'2031-02-12',notes:row.notes});expect(restored[1].notes).toBe('Added after frozen month review');
  } finally {await cleanup(page,ctx);}
}
module.exports={verifyEditingRecovery,verifyMoveCopy,verifyInterruptedSave,verifyLayoutAndKeyboard,verifyReviewedMonthRecovery};

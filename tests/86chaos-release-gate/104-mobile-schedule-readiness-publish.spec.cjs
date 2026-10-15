'use strict';
const {test,expect}=require('@playwright/test');
const {ownerLikeCreds,requireCreds,login,gotoTab,readSeedReport,RUN_ID,dismissBlockingDialogs}=require('../86chaos-full-audit/utils/audit-helpers.cjs');

test('Schedule Tools verifies all sources and publishes selected weeks without tenant permission errors',async({page},info)=>{
  test.setTimeout(150000);
  const target=require('../../scripts/86chaos-firebase-target.cjs').getFirebaseTarget(process.env);
  expect(target.emulator).toBe(true);
  const seed=readSeedReport();expect(seed?.ok).toBe(true);
  const db=require('../../api/_firebase-project-admin').getAdminAppForProject(target.projectId,{requireCredentials:true}).firestore();
  const tenant=seed.restaurantId,restaurant=db.collection('restaurants').doc(tenant);
  expect((await restaurant.get()).data()).toMatchObject({qaOwned:true,qaRunId:RUN_ID});
  const suffix=info.project.name.replace(/\W/g,'_'),roleId=`repair_role_${suffix}`,roleName=`QA Repair ${suffix}`;
  const refs=[];
  const existingRoles=await db.collection('roles').where('restaurantId','==',tenant).get();
  const existingShifts=await db.collection('shifts').where('restaurantId','==',tenant).get();
  const names=new Set(existingRoles.docs.map(d=>d.data().name));
  const legacyNames=[...new Set(existingShifts.docs.filter(d=>!d.data().rosterRoleId).map(d=>d.data().role).filter(Boolean))];
  for(const [index,name]of legacyNames.entries())if(!names.has(name)){
    const ref=db.collection('roles').doc(`repair_legacy_${suffix}_${index}`);refs.push(ref);
    await ref.set({restaurantId:tenant,name,revision:1,qaOwned:true,qaRunId:RUN_ID});
  }
  const roleRef=db.collection('roles').doc(roleId);refs.push(roleRef);
  await roleRef.set({restaurantId:tenant,name:roleName,revision:1,qaOwned:true,qaRunId:RUN_ID});
  const month=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'}).slice(0,7);
  const dates=[`${month}-19`,`${month}-26`];
  const shiftRefs=dates.map((date,index)=>db.collection('shifts').doc(`repair_publish_${suffix}_${index}`));refs.push(...shiftRefs);
  const stamp=new Date().toISOString();
  for(const [index,ref]of shiftRefs.entries())await ref.set({restaurantId:tenant,workspaceId:tenant,date:dates[index],scheduleDateKey:dates[index],scheduleMonth:month,month,role:roleName,rosterRoleId:roleId,rosterRoleNameSnapshot:roleName,isOpenShift:true,assignmentType:'open',startTime:'16:00',endTime:'21:00',isPublished:false,published:false,publishState:'draft',scheduleBuilderDraft:true,readyToPublish:true,revision:1,createdAt:stamp,updatedAt:stamp,qaOwned:true,qaRunId:RUN_ID});
  const api=[];page.on('response',async response=>{if(response.url().includes('/api/schedule-publish'))api.push({status:response.status(),body:await response.json().catch(()=>null)});});
  page.on('dialog',dialog=>dialog.type()==='confirm'?dialog.accept():dialog.dismiss());
  try{
    const account=ownerLikeCreds();requireCreds(account);await login(page,account.email,account.password);
    await gotoTab(page,'schedule',{force:true,settleMs:0});await dismissBlockingDialogs(page,{maxPasses:4});
    if(!await page.getByTestId('schedule-workspace').isVisible())await page.getByRole('button',{name:/^Schedule Builder$/i}).first().click();
    await page.getByRole('button',{name:'Smart Schedule',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Templates, coverage gaps, warnings, and publish review'})).toBeVisible();
    const review=page.locator('.schedule-copilot-compact').getByRole('button',{name:/Review.*Publish/i});
    await expect(review).toBeEnabled({timeout:35000});
    await expect(page.getByRole('status').filter({hasText:'Schedule check incomplete'})).toHaveCount(0);
    await review.click();
    await expect(page.getByText('Choose What to Publish',{exact:true})).toBeVisible();
    await page.getByRole('radio',{name:/Selected Roles/}).check();
    await page.getByRole('checkbox',{name:roleName,exact:true}).check();
    // The selected role isolates the two fixture shifts from the rest of the QA schedule.
    const weekInputs=page.locator('label').filter({hasText:/^Week \d+:/}).locator('input[type=checkbox]');
    for(let i=0;i<await weekInputs.count();i++)if(await weekInputs.nth(i).isEnabled())await weekInputs.nth(i).check();
    await expect(page.getByRole('button',{name:'Publish Selected Weeks',exact:true})).toBeEnabled();
    const publishedResponse=page.waitForResponse(response=>response.url().includes('/api/schedule-publish') && response.request().method()==='POST');
    await page.getByRole('button',{name:'Publish Selected Weeks',exact:true}).click();
    const response=await publishedResponse;const responseBody=await response.json();
    expect(response.status(),JSON.stringify(responseBody)).toBe(200);
    expect(responseBody.ok,JSON.stringify(responseBody)).toBe(true);
    await expect.poll(async()=> (await db.getAll(...shiftRefs)).map(d=>d.data()?.isPublished===true),{timeout:45000}).toEqual([true,true]);
    expect(api.some(row=>row.status>=400),JSON.stringify(api)).toBe(false);
    await expect.poll(()=>api.length).toBeGreaterThan(0);
    await page.reload({waitUntil:'domcontentloaded'});
    const persisted=await db.getAll(...shiftRefs);
    for(const row of persisted)expect(row.data()).toMatchObject({isPublished:true,published:true,status:'published',rosterRoleId:roleId,restaurantId:tenant});
    await info.attach('schedule-publish-api.json',{body:JSON.stringify(api,null,2),contentType:'application/json'});
  }finally{
    await info.attach('schedule-api-evidence.json',{body:JSON.stringify(api,null,2),contentType:'application/json'});
    expect((await restaurant.get()).data()).toMatchObject({qaOwned:true,qaRunId:RUN_ID});
    const batch=db.batch();refs.forEach(ref=>batch.delete(ref));await batch.commit();
  }
});

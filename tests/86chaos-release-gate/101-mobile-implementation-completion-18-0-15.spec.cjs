'use strict';
const {test:base,expect}=require('@playwright/test');
const crypto=require('node:crypto');
const {ownerLikeCreds,requireCreds,login,gotoTab,ALLOW_MUTATION,RUN_ID,readSeedReport}=require('../86chaos-full-audit/utils/audit-helpers.cjs');
const {recordPublication,headRef}=require('../../api/_shift-change-review.cjs');
const test=base.extend({completionFixture:async({},use,info)=>{
  expect(ALLOW_MUTATION).toBe(true);
  const target=require('../../scripts/86chaos-firebase-target.cjs').getFirebaseTarget(process.env);
  expect(target.emulator).toBe(true);expect(target.projectId).toBe('demo-86chaos');
  const seed=readSeedReport();expect(seed.ok).toBe(true);
  const app=require('../../api/_firebase-project-admin').getAdminAppForProject(target.projectId,{requireCredentials:true}),db=app.firestore(),tenant=seed.restaurantId;
  const restaurant=await db.collection('restaurants').doc(tenant).get();expect(restaurant.data()).toMatchObject({qaOwned:true,qaRunId:RUN_ID});
  const account=ownerLikeCreds();requireCreds(account,'owner-like implementation account');
  const uid=(await app.auth().getUserByEmail(account.email)).uid;
  const id=`qa_completion_${crypto.createHash('sha256').update(`${RUN_ID}|${info.project.name}|${info.title}`).digest('hex').slice(0,24)}`;
  const label=`QA Completion ${id.slice(-8)}`,refs=[];
  const put=async(collection,key,data)=>{const ref=db.collection(collection).doc(key);await ref.set({...data,restaurantId:tenant,qaOwned:true,qaRunId:RUN_ID});refs.push(ref);return ref;};
  const role=await put('roles',id,{name:label,revision:1});
  const shift=await put('shifts',id,{date:new Date().toISOString().slice(0,10),scheduleDateKey:new Date().toISOString().slice(0,10),startTime:'09:00',endTime:'17:00',rosterRoleId:role.id,rosterRoleNameSnapshot:label,role:label,authUid:uid,accountUserId:uid,employeeId:uid,scheduleUserId:uid,employeeName:label,isPublished:true,status:'published'});
  const publish=async patch=>db.runTransaction(async tx=>{const head=headRef(db,tenant,id),prior=await tx.get(head),current=await tx.get(shift);const value={...current.data(),...patch};const event=recordPublication({db,tx,head:prior.exists?prior.data():null,tenant,shiftId:id,shift:value,operationId:`${id}_${refs.length}`,actor:uid,at:new Date().toISOString()});tx.set(shift,value);if(event){refs.push(db.collection('scheduleChangeEvents').doc(event.version));if(!refs.some(ref=>ref.path===head.path))refs.push(head);}return event;});
  const event=await publish({});
  const item=await put('lineCheckItems',id,{name:label,category:'Cooler temperature',requiredMax:41});
  const date=new Date().toISOString().slice(0,10),original=await put('tempLogs',`${id}_attention`,{itemId:item.id,itemName:label,category:'Cooler temperature',location:'QA Cooler',date,temp:49,status:'Attention',result:'attention',managerReviewRequired:true,reviewedByManager:false,closureRequired:true,safetyRevision:1,requiredMin:null,requiredMax:41,correctiveAction:'Moved product to verified cold storage',timestamp:new Date(Date.now()-120000).toISOString(),loggedBy:label});
  const followUp=await put('tempLogs',`${id}_safe`,{itemId:item.id,itemName:label,category:'Cooler temperature',date,temp:39,status:'Safe',result:'pass',safetyRevision:1,requiredMin:null,requiredMax:41,timestamp:new Date(Date.now()-60000).toISOString(),loggedBy:label});
  const fixture={db,tenant,uid,id,label,event,shift,role,item,original,followUp,publish,refs};
  try{await use(fixture);}finally{
    const current=await restaurant.ref.get();expect(current.data()).toMatchObject({qaOwned:true,qaRunId:RUN_ID});
    refs.push(db.collection('foodSafetyClosures').doc(original.id));
    const reviews=await db.collection('trainingCompetencyReviews').where('restaurantId','==',tenant).get();for(const row of reviews.docs)if(row.data().station===label)refs.push(row.ref);
    const paths=new Set(refs.map(ref=>ref.path)),audits=await db.collection('auditLogs').where('restaurantId','==',tenant).get();
    for(const row of audits.docs)if(paths.has(row.data().target))refs.push(row.ref);
    for(const ref of new Map(refs.map(ref=>[ref.path,ref])).values()){const snap=await ref.get();if(snap.exists){expect(snap.data().restaurantId).toBe(tenant);await ref.delete();}}
  }
}});
test.use({actionTimeout:30000,navigationTimeout:60000});
test.beforeEach(()=>test.setTimeout(360000));
async function enter(page,tab){const account=ownerLikeCreds();requireCreds(account,'owner-like implementation account');await login(page,account.email,account.password);await gotoTab(page,tab,{settleMs:500});await page.addLocatorHandler(page.getByRole('button',{name:"Skip and don't show again",exact:true}),async button=>{await button.press('Enter');});}
async function shiftRow(page,fixture){const panel=page.getByTestId('published-shift-changes');await expect(panel).toBeVisible();await panel.getByRole('button',{name:'Load published changes',exact:true}).click();const row=panel.locator('article').filter({hasText:fixture.label});for(let n=0;n<40&&await row.count()===0;n++){const more=panel.getByRole('button',{name:'Load more published changes'});if(!await more.count())break;await expect(more).toBeEnabled();await more.click();}await expect(row.first()).toBeVisible();return{panel,row};}
async function safetyPanel(page){await enter(page,'prep');await page.getByRole('button',{name:/^(?:Open )?Line Check$/i}).click();const panel=page.getByTestId('food-safety-audit');await expect(panel).toBeVisible();return panel;}
test('published shift acknowledgment persists the exact version without changing the assignment',async({page,completionFixture:f})=>{
  await enter(page,'published');let {row}=await shiftRow(page,f);
  const pending=page.waitForResponse(r=>r.url().includes('/api/safe-write')&&r.request().postDataJSON()?.action==='shift-change-acknowledge');
  await row.getByRole('button',{name:'I reviewed this published shift'}).click();const response=await pending;expect(response.status()).toBe(200);expect(await response.json()).toMatchObject({ok:true,version:f.event.version});
  expect((await f.shift.get()).data().startTime).toBe('09:00');expect((await f.db.collection('scheduleChangeEvents').doc(f.event.version).get()).data().acknowledgments[f.uid]).toBeTruthy();
  await page.reload({waitUntil:'domcontentloaded'});({row}=await shiftRow(page,f));await expect(row).toContainText('Acknowledged');await expect(row.getByRole('button',{name:'I reviewed this published shift'})).toHaveCount(0);
});
test('stale published shift acknowledgment is rejected and the newer version remains unacknowledged',async({page,completionFixture:f})=>{
  await enter(page,'published');const {panel,row}=await shiftRow(page,f);const newer=await f.publish({startTime:'10:00'});
  const pending=page.waitForResponse(r=>r.url().includes('/api/safe-write')&&r.request().postDataJSON()?.action==='shift-change-acknowledge');
  await row.getByRole('button',{name:'I reviewed this published shift'}).click();expect((await pending).status()).toBe(409);await expect(panel.getByRole('alert')).toContainText(/newer publication/i);
  expect((await f.db.collection('scheduleChangeEvents').doc(newer.version).get()).data().acknowledgments).toEqual({});
});
test('manager closes food safety attention only with a later safe reading and preserves the original evidence',async({page,completionFixture:f})=>{
  const panel=await safetyPanel(page);await panel.getByRole('button',{name:'Load food safety audit'}).click();
  const review=panel.getByRole('button',{name:`Review closure for ${f.label}`});await expect(review).toBeVisible();await review.click();
  await expect(panel.getByRole('button',{name:'Save reviewed closure'})).toBeDisabled();await panel.getByLabel('Later safe check').selectOption(f.followUp.id);await panel.getByLabel('Manager closure note').fill('Verified product relocation and later safe temperature.');await panel.getByRole('checkbox').check();
  const pending=page.waitForResponse(r=>r.url().includes('/api/safe-write')&&r.request().postDataJSON()?.action==='food-safety-close');await panel.getByRole('button',{name:'Save reviewed closure'}).click();expect((await pending).status()).toBe(200);
  expect((await f.original.get()).data()).toMatchObject({temp:49,status:'Attention',closureRequired:false});expect((await f.db.collection('foodSafetyClosures').doc(f.original.id).get()).data()).toMatchObject({followUpLogId:f.followUp.id,closedBy:f.uid,status:'closed'});
  await panel.getByRole('button',{name:'Load food safety audit'}).click();await expect(panel.locator('article').filter({hasText:f.original.id})).toContainText('verified');
});
test('food safety audit retries a failed read without claiming an empty verified window',async({page,completionFixture})=>{
  const panel=await safetyPanel(page);let failed=false;await page.route('**/api/safe-write',route=>{if(route.request().postDataJSON()?.action==='food-safety-export'&&!failed){failed=true;return route.abort('failed');}return route.continue();});
  await panel.getByRole('button',{name:'Load food safety audit'}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('button',{name:'Export complete food safety audit CSV'})).toHaveCount(0);
  await panel.getByRole('button',{name:'Load food safety audit'}).click();await expect(panel).toContainText('Window fully loaded');await expect(panel.getByRole('button',{name:'Export complete food safety audit CSV'})).toBeEnabled();
});
test('role and station competency requires completed evidence and separate manager verification',async({page,completionFixture:f})=>{
  const members=await f.db.collection('workspaceMembers').where('restaurantId','==',f.tenant).get();let employee=null;
  for(const member of members.docs){const uid=member.data().authUid||member.data().uid||member.data().userId;if(uid&&uid!==f.uid&&(await f.db.collection('users').doc(uid).get()).exists){employee=uid;break;}}
  expect(employee,'A separate active QA employee is required for observed competency').toBeTruthy();const task=f.db.collection('hrOnboardingTasks').doc(f.id);await task.set({restaurantId:f.tenant,userId:employee,title:f.label,completed:true,completedAt:new Date(Date.now()-60000).toISOString(),qaOwned:true,qaRunId:RUN_ID});f.refs.push(task);
  await enter(page,'hr');const panel=page.getByTestId('training-competency-review');await expect(panel).toBeVisible();await panel.getByText('Record observed competency',{exact:true}).click();await panel.getByLabel('Competency employee').selectOption(employee);await panel.getByLabel('Competency role').selectOption(f.role.id);await panel.getByLabel('Competency station').fill(f.label);await panel.getByLabel('Competency verification note').fill('Observed safe thermometer use and corrective workflow.');
  await panel.getByLabel(new RegExp(f.label)).check();await expect(panel.getByRole('button',{name:'Save competency review'})).toBeDisabled();await panel.getByLabel('I observed the demonstrated workflow and verified these current records.').check();
  const pending=page.waitForResponse(r=>r.url().includes('/api/safe-write')&&r.request().postDataJSON()?.action==='training-competency-review');await panel.getByRole('button',{name:'Save competency review'}).click();expect((await pending).status()).toBe(200);await expect(panel).toContainText('Evidence remains current');expect((await task.get()).data().competent).toBeUndefined();
});
test('readiness shows configured source coverage instead of treating incomplete evidence as healthy',async({page})=>{
  await enter(page,'today');const panel=page.getByTestId('readiness-source-coverage');await panel.locator('summary').click();await expect(panel).toContainText('Food safety checks:');await expect(panel).toContainText('Backup and recovery:');await expect(panel).toContainText('Receiving and invoices:');
});
test('typed operational voice opens food safety review and performs no consequential writes',async({page})=>{
  await enter(page,'today');const writes=[];page.on('request',request=>{if(request.url().includes('/api/safe-write'))writes.push(request.postDataJSON()?.action);});
  await page.getByRole('button',{name:'Open 86Voice',exact:true}).click();await page.getByPlaceholder(/^Try:/).fill('review food safety');await page.getByRole('button',{name:'Check Typed Request',exact:true}).click();await expect(page.getByTestId('food-safety-audit')).toBeVisible();expect(writes).toEqual([]);
});

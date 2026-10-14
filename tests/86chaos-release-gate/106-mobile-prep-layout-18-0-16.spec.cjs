const {test,expect}=require('@playwright/test');
const {ownerLikeCreds,requireCreds,login,gotoTab}=require('../86chaos-full-audit/utils/audit-helpers.cjs');
test.beforeEach(async({page})=>{
  const account=ownerLikeCreds();requireCreds(account,'prep layout owner');await login(page,account.email,account.password);await gotoTab(page,'prep');
  // Await the real lazy section under the existing test deadline before asserting layout.
  await page.waitForFunction(()=>Boolean(document.querySelector('[data-testid="prep-action-bar"]')));
  await expect(page.getByTestId('prep-action-bar')).toBeVisible();
});
test('Master stays on one line at narrow phone width without overflowing the prep form',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  const master=page.getByLabel('Master',{exact:true});await expect(master).toBeVisible();
  const geometry=await master.evaluate(input=>{const label=input.closest('label'),form=input.closest('form'),box=label.getBoundingClientRect(),bounds=form.getBoundingClientRect();return{whiteSpace:getComputedStyle(label).whiteSpace,left:box.left,right:box.right,formLeft:bounds.left,formRight:bounds.right,scroll:document.documentElement.scrollWidth,width:innerWidth};});
  expect(geometry.whiteSpace).toBe('nowrap');expect(geometry.left).toBeGreaterThanOrEqual(geometry.formLeft);expect(geometry.right).toBeLessThanOrEqual(geometry.formRight);expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
});
test('microphone stays above the measured prep actions with Android styling and enlarged text',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.evaluate(()=>{document.documentElement.classList.add('chaos-native-android');document.documentElement.style.fontSize='20px';});
  const mic=page.locator('.voice-command-dock > button').first(),bar=page.getByTestId('prep-action-bar');await expect(mic).toBeVisible();
  await expect.poll(async()=>{const a=await mic.boundingBox(),b=await bar.boundingBox();return a&&b?b.y-(a.y+a.height):-1;}).toBeGreaterThanOrEqual(12);
  await mic.click();await expect(page.locator('.voice-command-dock .cockpit-panel').first()).toBeVisible();
});
test('printer setup and guidance belong below the prep list and move with page scrolling',async({page})=>{
  const printer=page.getByTestId('prep-printer-information');
  await expect(printer.getByText('Label printer setup')).toBeAttached();
  expect(await printer.evaluate(element=>{for(let p=element;p;p=p.parentElement){if(['fixed','sticky'].includes(getComputedStyle(p).position))return false;}return true;})).toBe(true);
  await expect(page.getByTestId('prep-action-bar').getByText(/Brother/)).toHaveCount(0);
  const before=await printer.boundingBox();await page.evaluate(()=>{const element=document.querySelector('[data-testid="prep-printer-information"]');element.scrollIntoView({block:'center'});});
  const after=await printer.boundingBox();expect(before).toBeTruthy();expect(after).toBeTruthy();expect(Math.abs(after.y-before.y)).toBeGreaterThan(1);
});
